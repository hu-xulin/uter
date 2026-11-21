package service

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/uter-ai/uter/model"
	relaycommon "github.com/uter-ai/uter/relay/common"
)

func TestRecordBillingPriceSnapshotCapturesIdentityAndVersion(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.BillingPriceSnapshot{}))
	previous := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previous })

	info := &relaycommon.RelayInfo{
		RequestId: "req-live-1", OriginModelName: "gpt-a",
		ChannelPricingApplied:         true,
		ChannelPricingProvider:        "apiko",
		ChannelPricingRegion:          "us",
		ChannelPricingDeployment:      "dep-1",
		ChannelPricingVersion:         "sale-v1",
		ChannelPricingPurchaseVersion: "cost-v1",
		ChannelPricingMode:            model.ChannelPricingModePerMillionTokens,
		ChannelPricingCurrency:        "USD",
		ChannelPricingFXRate:          1,
	}
	info.ChannelMeta = &relaycommon.ChannelMeta{ChannelId: 9}
	info.PriceData.GroupRatioInfo.GroupRatio = 0.8
	RecordBillingPriceSnapshot(info)

	got, err := model.GetBillingPriceSnapshot("req-live-1", "", "gpt-a")
	require.NoError(t, err)
	assert.Equal(t, 9, got.ChannelId)
	assert.Equal(t, "apiko", got.Provider)
	assert.Equal(t, "dep-1", got.DeploymentId)
	assert.Equal(t, "sale-v1", got.PricingVersion)
	assert.Equal(t, "cost-v1", got.PurchaseVersion)
	assert.InDelta(t, 0.8, got.GroupRatio, 1e-9)

	// A request without channel pricing and without an expression writes nothing.
	RecordBillingPriceSnapshot(&relaycommon.RelayInfo{RequestId: "plain", OriginModelName: "gpt-a"})
	_, err = model.GetBillingPriceSnapshot("plain", "", "gpt-a")
	require.Error(t, err)
}
