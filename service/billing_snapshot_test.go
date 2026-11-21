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
		ChannelPricingApplied:          true,
		ChannelPricingProvider:         "apiko",
		ChannelPricingRegion:           "us",
		ChannelPricingDeployment:       "dep-1",
		ChannelPricingVersion:          "sale-v1",
		ChannelPricingPurchaseVersion:  "cost-v1",
		ChannelPricingMode:             model.ChannelPricingModePerMillionTokens,
		ChannelPricingCurrency:         "USD",
		ChannelPricingFXRate:           1,
		ChannelPricingContractJSON:     `{"mode":"per_million_tokens","input_per_million_usd":1.2,"tiers":[{"range_name":"base","input_per_million_usd":1.2}],"source":"operator"}`,
		ChannelPricingPurchaseUSD:      snapshotFloatPtr(0.9),
		ChannelPricingPurchaseVerified: true,
		ChannelPricingPurchaseSource:   "contract-2026",
		FinalPreConsumedQuota:          2000,
		SettledQuota:                   1500,
		SettlementRecorded:             true,
		BillingUsageBreakdown:          map[string]any{"prompt_tokens": 100, "completion_tokens": 50},
	}
	info.ChannelMeta = &relaycommon.ChannelMeta{ChannelId: 9}
	info.PriceData.GroupRatioInfo.GroupRatio = 0.8
	RecordBillingPriceSnapshot(info, nil)

	got, err := model.GetBillingPriceSnapshot("req-live-1", "", "gpt-a")
	require.NoError(t, err)
	assert.Equal(t, 9, got.ChannelId)
	assert.Equal(t, "apiko", got.Provider)
	assert.Equal(t, "dep-1", got.DeploymentId)
	assert.Equal(t, "sale-v1", got.PricingVersion)
	assert.Equal(t, "cost-v1", got.PurchaseVersion)
	assert.InDelta(t, 0.8, got.GroupRatio, 1e-9)
	assert.Contains(t, got.PriceContract, `"input_per_million_usd":1.2`)
	assert.NotEmpty(t, got.PriceContractHash)
	assert.Equal(t, "operator", got.PriceSource)
	require.NotNil(t, got.PurchaseUSD)
	assert.InDelta(t, 0.9, *got.PurchaseUSD, 1e-9)
	assert.True(t, got.PurchaseVerified)
	assert.Equal(t, int64(2000), got.PreConsumedQuota)
	assert.Equal(t, int64(1500), got.SettledQuota)
	assert.Equal(t, int64(500), got.RefundQuota)
	assert.Equal(t, "settled", got.SettleStatus)
	assert.Contains(t, got.UsageBreakdown, `"prompt_tokens":100`)

	// A request without channel pricing and without an expression writes nothing.
	RecordBillingPriceSnapshot(&relaycommon.RelayInfo{RequestId: "plain", OriginModelName: "gpt-a"}, nil)
	_, err = model.GetBillingPriceSnapshot("plain", "", "gpt-a")
	require.Error(t, err)
}

func snapshotFloatPtr(v float64) *float64 { return &v }

func TestBillingSnapshotSettlementPatchFillsAmountsOnce(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.BillingPriceSnapshot{}))
	previous := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previous })

	require.NoError(t, model.SaveBillingPriceSnapshot(model.BillingPriceSnapshot{
		RequestId: "task-req", TaskId: "task-1", ModelName: "video-a",
		PriceContract: `{"mode":"per_second"}`, SettleStatus: "pending",
	}))
	require.NoError(t, model.UpdateBillingPriceSnapshotSettlement("task-req", "task-1", "video-a", model.SettlementPatch{
		UsageBreakdown: `{"seconds":5}`, PreConsumed: 5000, Settled: 4500, Refund: 500, Status: "settled",
	}))
	got, err := model.GetBillingPriceSnapshot("task-req", "task-1", "video-a")
	require.NoError(t, err)
	assert.Equal(t, int64(5000), got.PreConsumedQuota)
	assert.Equal(t, int64(4500), got.SettledQuota)
	assert.Equal(t, int64(500), got.RefundQuota)
	assert.Equal(t, "settled", got.SettleStatus)
	assert.Equal(t, `{"mode":"per_second"}`, got.PriceContract, "settlement must not rewrite the contract")

	// A duplicate callback cannot move an already settled voucher.
	require.NoError(t, model.UpdateBillingPriceSnapshotSettlement("task-req", "task-1", "video-a", model.SettlementPatch{
		Settled: 1, Status: "settled",
	}))
	got, err = model.GetBillingPriceSnapshot("task-req", "task-1", "video-a")
	require.NoError(t, err)
	assert.Equal(t, int64(4500), got.SettledQuota)
}

func TestTaskRefundCompletesSnapshotVoucher(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.BillingPriceSnapshot{}))
	previous := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previous })

	require.NoError(t, model.SaveBillingPriceSnapshot(model.BillingPriceSnapshot{
		RequestId: "req-task-refund", TaskId: "task-refund", ModelName: "video-a",
		PriceContract: `{"mode":"per_second"}`, PreConsumedQuota: 3000, SettleStatus: "pending",
	}))
	task := &model.Task{TaskID: "task-refund"}
	task.Properties.OriginModelName = "video-a"
	task.PrivateData.Execution = &model.TaskExecutionSnapshot{RequestID: "req-task-refund"}

	updateTaskPriceSnapshotSettlement(task, 3000, 0, `{"seconds":5}`, "refunded")

	got, err := model.GetBillingPriceSnapshot("req-task-refund", "task-refund", "video-a")
	require.NoError(t, err)
	assert.Equal(t, "refunded", got.SettleStatus)
	assert.Equal(t, int64(3000), got.RefundQuota)
	assert.Zero(t, got.SettledQuota)
	assert.Equal(t, `{"mode":"per_second"}`, got.PriceContract)
	assert.Contains(t, got.UsageBreakdown, `"seconds":5`)
}
