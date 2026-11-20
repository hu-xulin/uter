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

func TestApplyChannelBatchPricingSupportsPerSecondAndCurrentBasis(t *testing.T) {
	setupBatchPricingDB(t)
	perSecond := 0.08
	normalized, _ := common.Marshal(model.ChannelOfficialPricing{
		Currency: "USD",
		Unit:     "per_second",
		Tiers: []model.ChannelPricingTier{{
			RangeName: "video", PerUnitUSD: &perSecond, Unit: "per_second",
		}},
	})
	_, err := model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{
		{
			ChannelId: 9, Provider: "test", ModelName: "wan-video", Currency: "USD",
			OfficialPricing: `{}`, NormalizedPricing: string(normalized),
			Source: "test", FetchedAt: 100,
		},
		batchOfficialRecord(9, "gpt-plain"),
	})
	require.NoError(t, err)

	result, err := ApplyChannelBatchPricingWithOptions(9, BatchPricingOptions{
		Basis: BatchPricingBasisOfficial, Mode: BatchPricingModeDiscount, Value: 0.5,
		Models: []string{"wan-video"},
	})
	require.NoError(t, err)
	require.Equal(t, 1, result.Updated)
	require.NotNil(t, result.Items[0].PerSecondUSD)
	assert.InDelta(t, 0.04, *result.Items[0].PerSecondUSD, 1e-9)
	effective := model.ResolveEffectiveChannelPricing(9, "wan-video")
	require.True(t, effective.Billable)
	require.NotNil(t, effective.Pricing)
	require.True(t, effective.Pricing.UsePerSecond)
	assert.InDelta(t, 0.04, effective.Pricing.PerSecondPrice, 1e-9)
	if _, ok := model.ResolveChannelBillingPricing(9, "wan-video"); ok {
		t.Fatal("the token/per-call accessor must not expose a per-second price")
	}

	// The current basis rebases on the sale price just written.
	result, err = ApplyChannelBatchPricingWithOptions(9, BatchPricingOptions{
		Basis: BatchPricingBasisCurrent, Mode: BatchPricingModeMarkup, Value: 0.1,
		Models: []string{"wan-video", "gpt-plain"},
	})
	require.NoError(t, err)
	require.Equal(t, 1, result.Updated)
	require.Len(t, result.Skipped, 1)
	require.Equal(t, "gpt-plain", result.Skipped[0].ModelName)
	require.Contains(t, result.Skipped[0].Reason, "no current channel price")
	effective = model.ResolveEffectiveChannelPricing(9, "wan-video")
	require.NotNil(t, effective.Pricing)
	assert.InDelta(t, 0.044, effective.Pricing.PerSecondPrice, 1e-9)
}

func TestApplyChannelBatchPricingReportsMarginAndChange(t *testing.T) {
	setupBatchPricingDB(t)
	input, output := 3.0, 6.0
	purchaseInput, purchaseOutput := 2.0, 4.0
	normalized, _ := common.Marshal(model.ChannelOfficialPricing{
		Currency: "USD",
		Unit:     "per_1m_token",
		Tiers: []model.ChannelPricingTier{{
			RangeName: "base", InputPerMillionUSD: &input, OutputPerMillionUSD: &output, Unit: "per_1m_token",
		}},
		ChannelPrice: &model.ChannelPricingTier{
			RangeName: "channel", InputPerMillionUSD: &purchaseInput, OutputPerMillionUSD: &purchaseOutput, Unit: "per_1m_token",
		},
	})
	_, err := model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{{
		ChannelId: 21, Provider: "test", ModelName: "gpt-margin", Currency: "USD",
		OfficialPricing: `{}`, NormalizedPricing: string(normalized), Source: "test", FetchedAt: 100,
	}})
	require.NoError(t, err)
	require.NoError(t, model.SetChannelInternalPricing(21, "gpt-margin", model.ChannelInternalPricing{
		Mode: model.ChannelPricingModePerMillionTokens, InputUSDPerMillion: &input, OutputUSDPerMillion: &output,
		Note: "batch: seed", Source: "batch",
	}))

	result, err := ApplyChannelBatchPricingWithOptions(21, BatchPricingOptions{
		Basis: BatchPricingBasisOfficial, Mode: BatchPricingModeDiscount, Value: 0.5, DryRun: true,
	})
	require.NoError(t, err)
	require.Len(t, result.Items, 1)
	item := result.Items[0]
	require.NotNil(t, item.PurchaseUSD)
	assert.Equal(t, 2.0, *item.PurchaseUSD)
	require.NotNil(t, item.PreviousUSD)
	assert.Equal(t, 3.0, *item.PreviousUSD)
	require.NotNil(t, item.ChangePercent)
	assert.InDelta(t, -50, *item.ChangePercent, 1e-9)
	require.NotNil(t, item.MarginUSD)
	assert.InDelta(t, -0.5, *item.MarginUSD, 1e-9)
	require.NotNil(t, item.MarginRate)
	assert.InDelta(t, -1.0/3.0, *item.MarginRate, 1e-9)
}

func TestApplyChannelBatchPricingRejectsStalePreviewVersion(t *testing.T) {
	setupBatchPricingDB(t)
	_, err := model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{
		batchOfficialRecord(11, "gpt-versioned"),
	})
	require.NoError(t, err)

	preview, err := ApplyChannelBatchPricingWithOptions(11, BatchPricingOptions{
		Basis: BatchPricingBasisOfficial, Mode: BatchPricingModeDiscount, Value: 0.5,
		ModelCategories: []string{"text"}, DryRun: true,
	})
	require.NoError(t, err)
	require.Equal(t, 1, preview.Updated)
	require.NotEmpty(t, preview.Items[0].Version)

	// A re-sync changes the row version after the preview was taken.
	updated := batchOfficialRecord(11, "gpt-versioned")
	updated.NormalizedPricing = `{"currency":"USD","unit":"per_1m_token","tiers":[
		{"range_name":"Default","input_per_million_usd":5,"output_per_million_usd":10,"unit":"per_1m_token"}]}`
	_, err = model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{updated})
	require.NoError(t, err)

	applied, err := ApplyChannelBatchPricingWithOptions(11, BatchPricingOptions{
		Basis: BatchPricingBasisOfficial, Mode: BatchPricingModeDiscount, Value: 0.5,
		ModelCategories:  []string{"text"},
		ExpectedVersions: map[string]string{"gpt-versioned": preview.Items[0].Version},
	})
	require.NoError(t, err)
	require.Zero(t, applied.Updated)
	require.Equal(t, []string{"gpt-versioned"}, applied.Conflicts)
	require.Contains(t, applied.Skipped[0].Reason, "re-run the preview")

	// Re-previewing against the new version applies cleanly.
	fresh, err := ApplyChannelBatchPricingWithOptions(11, BatchPricingOptions{
		Basis: BatchPricingBasisOfficial, Mode: BatchPricingModeDiscount, Value: 0.5,
		ModelCategories: []string{"text"}, DryRun: true,
	})
	require.NoError(t, err)
	_, err = ApplyChannelBatchPricingWithOptions(11, BatchPricingOptions{
		Basis: BatchPricingBasisOfficial, Mode: BatchPricingModeDiscount, Value: 0.5,
		ModelCategories:  []string{"text"},
		ExpectedVersions: map[string]string{"gpt-versioned": fresh.Items[0].Version},
	})
	require.NoError(t, err)
	pricing, ok := model.ResolveChannelBillingPricing(11, "gpt-versioned")
	require.True(t, ok)
	assert.InDelta(t, 1.25, pricing.ModelRatio, 1e-9) // $5 * 0.5 / 2
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
