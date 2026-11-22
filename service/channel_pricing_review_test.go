package service

import (
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/uter-ai/uter/model"
)

func TestBuildChannelPricingReviewsUsesThresholdAndChannelModels(t *testing.T) {
	oldRatio := 2.0
	newRatio := 3.0
	smallOld, smallNew := 2.0, 2.1
	detectedAt := time.Unix(1_700_000_000, 0).UTC()
	changes := []UpstreamPriceChange{
		{Kind: "price_changed", ModelID: "gpt-a", Field: "model_ratio", Old: &oldRatio, New: &newRatio, DetectedAt: detectedAt, PricingVersion: "v9"},
		{Kind: "price_changed", ModelID: "gpt-a", Field: "completion_ratio", Old: &smallOld, New: &smallNew},
		{Kind: "price_changed", ModelID: "other-model", Field: "model_ratio", Old: &oldRatio, New: &newRatio},
		{Kind: "model_added", ModelID: "gpt-new"},
	}
	entries := BuildChannelPricingReviews(changes, 7, []string{"gpt-a"}, 20)
	require.Len(t, entries, 1)
	require.Equal(t, 7, entries[0].ChannelID)
	require.Equal(t, "gpt-a", entries[0].ModelName)
	require.Equal(t, "model_ratio", entries[0].Field)
	require.InDelta(t, 50, entries[0].Percent, 1e-9)
	assert.Equal(t, detectedAt.Unix(), entries[0].SyncStartedAt)
	assert.Equal(t, "v9", entries[0].PricingVersion)
}

func TestBuildChannelPricingReviewsZeroThresholdIncludesAnyChange(t *testing.T) {
	oldRatio, newRatio := 2.0, 2.01
	changes := []UpstreamPriceChange{{
		Kind: "price_changed", ModelID: "gpt-a", Field: "model_ratio",
		Old: &oldRatio, New: &newRatio,
	}}
	require.Len(t, BuildChannelPricingReviews(changes, 7, []string{"gpt-a"}, 0), 1)
	require.Empty(t, BuildChannelPricingReviews(changes, 7, []string{"gpt-a"}, 20))
}

// 审批必须绑定生成审核时的价格版本；同步期间价格已变化时拒绝审批。
func TestValidateChannelPricingReviewsCurrentRejectsStaleReview(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.ChannelModelPricing{}, &model.ChannelPricingReview{}))
	previous := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previous })

	require.NoError(t, db.Create(&model.ChannelModelPricing{
		ChannelId: 31, Provider: "apiko", ModelName: "gpt-a",
		PricingStatus:  model.ChannelPricingStatusConfigured,
		PricingVersion: "v1", LifecycleStatus: model.ChannelModelLifecycleActive,
	}).Error)
	require.NoError(t, model.AppendChannelPricingReviews([]model.ChannelPricingReview{{
		ChannelID: 31, ModelName: "gpt-a", Provider: "apiko", PricingVersion: "v1",
		Field: "input", Old: 1, New: 2,
	}}))
	require.NoError(t, ValidateChannelPricingReviewsCurrent(31))

	require.NoError(t, db.Model(&model.ChannelModelPricing{}).
		Where("channel_id = ? AND model_name = ?", 31, "gpt-a").
		Update("pricing_version", "v2").Error)
	require.ErrorIs(t, ValidateChannelPricingReviewsCurrent(31), ErrPricingReviewStale)
}
