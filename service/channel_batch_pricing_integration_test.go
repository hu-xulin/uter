package service

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"gorm.io/gorm"
)

func setupBatchPricingDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.ChannelModelPricing{}, &model.Option{}))
	previous := model.DB
	model.DB = db
	model.InvalidateChannelPricingCache()
	t.Cleanup(func() {
		model.DB = previous
		model.InvalidateChannelPricingCache()
	})
}

func batchOfficialRecord(channelID int, modelName string) model.ChannelOfficialPricingRecord {
	input, output := 3.0, 6.0
	normalized := model.ChannelOfficialPricing{
		Currency: "USD",
		Unit:     "per_1m_token",
		Tiers: []model.ChannelPricingTier{{
			RangeName:           "Default",
			InputPerMillionUSD:  &input,
			OutputPerMillionUSD: &output,
			Unit:                "per_1m_token",
		}},
	}
	encoded, _ := common.Marshal(normalized)
	return model.ChannelOfficialPricingRecord{
		ChannelId:         channelID,
		Provider:          "test",
		ModelName:         modelName,
		Currency:          "USD",
		OfficialPricing:   `{}`,
		NormalizedPricing: string(encoded),
		Source:            "test",
		FetchedAt:         100,
	}
}

func TestApplyChannelBatchPricingWritesOnlyTargetChannelAndPrefix(t *testing.T) {
	setupBatchPricingDB(t)
	_, err := model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{
		batchOfficialRecord(1, "gpt-a"),
		batchOfficialRecord(1, "claude-a"),
		batchOfficialRecord(2, "gpt-a"),
	})
	require.NoError(t, err)

	// Dry run reports matches but writes nothing.
	preview, err := ApplyChannelBatchPricingWithOptions(1, BatchPricingOptions{
		Basis: BatchPricingBasisOfficial, Mode: BatchPricingModeDiscount, Value: 0.6,
		ModelPrefixes: []string{"gpt-"}, DryRun: true,
	})
	require.NoError(t, err)
	require.Equal(t, 1, preview.Updated)
	_, billable := model.ResolveChannelBillingPricing(1, "gpt-a")
	require.False(t, billable, "dry run must not write")

	applied, err := ApplyChannelBatchPricingWithOptions(1, BatchPricingOptions{
		Basis: BatchPricingBasisOfficial, Mode: BatchPricingModeDiscount, Value: 0.6,
		ModelPrefixes: []string{"gpt-"}, DryRun: false,
	})
	require.NoError(t, err)
	require.Equal(t, 1, applied.Updated)

	pricing, ok := model.ResolveChannelBillingPricing(1, "gpt-a")
	require.True(t, ok)
	assert.InDelta(t, 0.9, pricing.ModelRatio, 1e-9) // $3 * 0.6 / 2
	assert.InDelta(t, 2.0, *pricing.CompletionRatio, 1e-9)

	// The non-matching model on the same channel and the same model on another
	// channel stay unbillable.
	if _, ok := model.ResolveChannelBillingPricing(1, "claude-a"); ok {
		t.Fatal("prefix scope must not price claude-a")
	}
	if _, ok := model.ResolveChannelBillingPricing(2, "gpt-a"); ok {
		t.Fatal("another channel must not inherit the price")
	}
}

func TestApplyChannelBatchPricingSupportsFixedAmountAndFixedPrice(t *testing.T) {
	setupBatchPricingDB(t)
	_, err := model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{
		batchOfficialRecord(3, "gpt-fixed"),
	})
	require.NoError(t, err)

	_, err = ApplyChannelBatchPricingWithOptions(3, BatchPricingOptions{
		Basis: BatchPricingBasisOfficial, Mode: BatchPricingModeAdd, Value: 1,
	})
	require.NoError(t, err)
	pricing, ok := model.ResolveChannelBillingPricing(3, "gpt-fixed")
	require.True(t, ok)
	assert.InDelta(t, 2.0, pricing.ModelRatio, 1e-9) // ($3 + 1) / 2

	_, err = ApplyChannelBatchPricingWithOptions(3, BatchPricingOptions{
		Basis: BatchPricingBasisOfficial, Mode: BatchPricingModeFixed, Value: 4,
	})
	require.NoError(t, err)
	pricing, ok = model.ResolveChannelBillingPricing(3, "gpt-fixed")
	require.True(t, ok)
	assert.InDelta(t, 2.0, pricing.ModelRatio, 1e-9) // fixed $4 / 2
}

func TestApplyChannelBatchPricingHonorsCategoryAndManualPriority(t *testing.T) {
	setupBatchPricingDB(t)
	_, err := model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{
		batchOfficialRecord(4, "gpt-chat"),
		batchOfficialRecord(4, "qwen-image-plus"),
	})
	require.NoError(t, err)

	// Category scope only touches image models.
	result, err := ApplyChannelBatchPricingWithOptions(4, BatchPricingOptions{
		Basis: BatchPricingBasisOfficial, Mode: BatchPricingModeDiscount, Value: 0.5,
		ModelCategories: []string{"image"},
	})
	require.NoError(t, err)
	require.Equal(t, 1, result.Updated)
	if _, ok := model.ResolveChannelBillingPricing(4, "gpt-chat"); ok {
		t.Fatal("text model must not match the image category")
	}

	// A hand-edited price outranks a later batch rule.
	input, output := 1.25, 2.5
	require.NoError(t, model.SetChannelInternalPricing(4, "gpt-chat", model.ChannelInternalPricing{
		Mode: model.ChannelPricingModePerMillionTokens, InputUSDPerMillion: &input, OutputUSDPerMillion: &output,
	}))
	_, err = ApplyChannelBatchPricingWithOptions(4, BatchPricingOptions{
		Basis: BatchPricingBasisOfficial, Mode: BatchPricingModeDiscount, Value: 0.5,
	})
	require.NoError(t, err)
	pricing, ok := model.ResolveChannelBillingPricing(4, "gpt-chat")
	require.True(t, ok)
	assert.InDelta(t, 0.625, pricing.ModelRatio, 1e-9) // manual $1.25 / 2

	// Explicit opt-in replaces the manual price; batch-owned rows keep updating.
	_, err = ApplyChannelBatchPricingWithOptions(4, BatchPricingOptions{
		Basis: BatchPricingBasisOfficial, Mode: BatchPricingModeDiscount, Value: 0.5,
		OverwriteManual: true,
	})
	require.NoError(t, err)
	pricing, ok = model.ResolveChannelBillingPricing(4, "gpt-chat")
	require.True(t, ok)
	assert.InDelta(t, 0.75, pricing.ModelRatio, 1e-9) // $3 * 0.5 / 2
}
