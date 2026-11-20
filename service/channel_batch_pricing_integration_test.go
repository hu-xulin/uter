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
	require.NoError(t, db.AutoMigrate(&model.ChannelModelPricing{}, &model.ChannelPricingHistory{}, &model.Option{}))
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

func TestApplyChannelBatchPricingTargetsSelectedDimensions(t *testing.T) {
	setupBatchPricingDB(t)
	_, err := model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{
		batchOfficialRecord(31, "gpt-dimensions"),
	})
	require.NoError(t, err)

	_, err = ApplyChannelBatchPricingWithOptions(31, BatchPricingOptions{
		Basis: BatchPricingBasisOfficial, Mode: BatchPricingModeDiscount, Value: 0.5,
		Dimensions: []string{"input"},
	})
	require.NoError(t, err)
	row, err := model.GetChannelModelPricing(31, "gpt-dimensions")
	require.NoError(t, err)
	var internal model.ChannelInternalPricing
	require.NoError(t, common.UnmarshalJsonStr(row.InternalPricing, &internal))
	require.NotNil(t, internal.InputUSDPerMillion)
	require.NotNil(t, internal.OutputUSDPerMillion)
	assert.InDelta(t, 1.5, *internal.InputUSDPerMillion, 1e-9)
	assert.InDelta(t, 6.0, *internal.OutputUSDPerMillion, 1e-9, "output must stay at the base price")
	assert.Contains(t, internal.Note, "base 3.0000", "the applied base must be auditable")

	_, err = ApplyChannelBatchPricingWithOptions(31, BatchPricingOptions{
		Basis: BatchPricingBasisOfficial, Mode: BatchPricingModeDiscount, Value: 0.5,
		Dimensions: []string{"audio"},
	})
	require.ErrorContains(t, err, "unknown price dimension")
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

func TestApplyChannelBatchPricingSupportsPerMinute(t *testing.T) {
	setupBatchPricingDB(t)
	perMinute := 6.0
	normalized, err := common.Marshal(model.ChannelOfficialPricing{
		Currency: "USD",
		Unit:     "per_minute",
		Tiers: []model.ChannelPricingTier{{
			RangeName: "Default", Unit: "per_minute", PerUnitUSD: &perMinute,
		}},
	})
	require.NoError(t, err)
	_, err = model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{{
		ChannelId: 5, Provider: "uter", ModelName: "video-per-minute", Currency: "USD",
		NormalizedPricing: string(normalized), Source: "uter-official",
	}})
	require.NoError(t, err)

	result, err := ApplyChannelBatchPricingWithOptions(5, BatchPricingOptions{
		Basis: BatchPricingBasisOfficial, Mode: BatchPricingModeMultiply, Value: 0.5,
	})
	require.NoError(t, err)
	require.Equal(t, 1, result.Updated)
	require.NotNil(t, result.Items[0].PerMinuteUSD)
	assert.InDelta(t, 3.0, *result.Items[0].PerMinuteUSD, 1e-9)

	effective := model.ResolveEffectiveChannelPricing(5, "video-per-minute")
	require.True(t, effective.Billable)
	require.True(t, effective.Pricing.UsePerSecond)
	assert.InDelta(t, 0.05, effective.Pricing.PerSecondPrice, 1e-9)
}

func seedMarginRow(t *testing.T, channelID int, modelName string, purchase, sale [4]float64) {
	t.Helper()
	pInput, pOutput, pCache, pCacheWrite := purchase[0], purchase[1], purchase[2], purchase[3]
	normalized := model.ChannelOfficialPricing{
		Currency: "USD",
		Unit:     "per_1m_token",
		ChannelPrice: &model.ChannelPricingTier{
			RangeName: "Default", Unit: "per_1m_token",
			InputPerMillionUSD: &pInput, OutputPerMillionUSD: &pOutput,
			CachePerMillionUSD: &pCache, CreateCachePerMillionUSD: &pCacheWrite,
		},
	}
	encoded, _ := common.Marshal(normalized)
	_, err := model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{{
		ChannelId: channelID, Provider: "test", ModelName: modelName,
		Currency: "USD", OfficialPricing: `{}`, NormalizedPricing: string(encoded),
		Source: "test", FetchedAt: 100,
	}})
	require.NoError(t, err)
	sInput, sOutput, sCache, sCacheWrite := sale[0], sale[1], sale[2], sale[3]
	require.NoError(t, model.SetChannelInternalPricingFor(model.ChannelPricingIdentity{
		ChannelId: channelID, Provider: "test", ModelName: modelName,
	}, model.ChannelInternalPricing{
		Mode:               model.ChannelPricingModePerMillionTokens,
		InputUSDPerMillion: &sInput, OutputUSDPerMillion: &sOutput,
		CacheUSDPerMillion: &sCache, CreateCacheUSDPerMillion: &sCacheWrite,
		Source: "manual",
	}))
}

func TestBatchPricingPartialSkipsOnlyTheLossDimension(t *testing.T) {
	setupBatchPricingDB(t)
	seedMarginRow(t, 9, "good-model", [4]float64{1, 2, 0.1, 0.2}, [4]float64{1.2, 2.4, 0.12, 0.24})
	seedMarginRow(t, 9, "bad-cache-model", [4]float64{1, 2, 0.1, 0.2}, [4]float64{1.2, 2.4, 0.08, 0.24})

	minMargin := 0.1
	result, err := ApplyChannelBatchPricingWithOptions(9, BatchPricingOptions{
		Models: []string{"good-model", "bad-cache-model"},
		Basis:  BatchPricingBasisCurrent, Mode: BatchPricingModeMarkup, Value: 0.1,
		MinMarginRate: &minMargin, ProtectionMode: BatchProtectionModePartial,
		OverwriteManual: true,
	})
	require.NoError(t, err)
	assert.Equal(t, 1, result.Blocked)
	require.Len(t, result.Skipped, 1)
	assert.Equal(t, "bad-cache-model", result.Skipped[0].ModelName)
	assert.Contains(t, result.Skipped[0].Reason, "cache_read")

	var bad []model.ChannelModelPricing
	require.NoError(t, model.DB.Where("channel_id = ? AND model_name = ?", 9, "bad-cache-model").Find(&bad).Error)
	require.Len(t, bad, 1)
	assert.Contains(t, bad[0].InternalPricing, `"source":"manual"`, "a blocked model must not be overwritten")

	var good []model.ChannelModelPricing
	require.NoError(t, model.DB.Where("channel_id = ? AND model_name = ?", 9, "good-model").Find(&good).Error)
	require.Len(t, good, 1)
	assert.Contains(t, good[0].InternalPricing, `"source":"batch"`)
}

func TestBatchPricingStrictBlocksEveryWrite(t *testing.T) {
	setupBatchPricingDB(t)
	seedMarginRow(t, 11, "good-model", [4]float64{1, 2, 0.1, 0.2}, [4]float64{1.2, 2.4, 0.12, 0.24})
	seedMarginRow(t, 11, "bad-cache-model", [4]float64{1, 2, 0.1, 0.2}, [4]float64{1.2, 2.4, 0.08, 0.24})

	minMargin := 0.1
	result, err := ApplyChannelBatchPricingWithOptions(11, BatchPricingOptions{
		Models: []string{"good-model", "bad-cache-model"},
		Basis:  BatchPricingBasisCurrent, Mode: BatchPricingModeMarkup, Value: 0.1,
		MinMarginRate: &minMargin, ProtectionMode: BatchProtectionModeStrict,
		OverwriteManual: true,
	})
	require.NoError(t, err)
	assert.Equal(t, 0, result.Updated)
	assert.Equal(t, 1, result.Blocked)
	require.Len(t, result.Skipped, 2, "strict mode must explain every model it held back")

	var good []model.ChannelModelPricing
	require.NoError(t, model.DB.Where("channel_id = ? AND model_name = ?", 11, "good-model").Find(&good).Error)
	require.Len(t, good, 1)
	assert.Contains(t, good[0].InternalPricing, `"source":"manual"`)
}

func TestBatchPricingApprovalRequiresNoteAndRecordsSource(t *testing.T) {
	setupBatchPricingDB(t)
	seedMarginRow(t, 13, "bad-cache-model", [4]float64{1, 2, 0.1, 0.2}, [4]float64{1.2, 2.4, 0.08, 0.24})

	minMargin := 0.1
	blocked, err := ApplyChannelBatchPricingWithOptions(13, BatchPricingOptions{
		Models: []string{"bad-cache-model"},
		Basis:  BatchPricingBasisCurrent, Mode: BatchPricingModeMarkup, Value: 0.1,
		MinMarginRate: &minMargin, ProtectionMode: BatchProtectionModeApproval,
		OverwriteManual: true,
	})
	require.NoError(t, err)
	assert.Equal(t, 1, blocked.Blocked)
	require.Len(t, blocked.Skipped, 1)
	assert.Contains(t, blocked.Skipped[0].Reason, "approval note")

	approved, err := ApplyChannelBatchPricingWithOptions(13, BatchPricingOptions{
		Models: []string{"bad-cache-model"},
		Basis:  BatchPricingBasisCurrent, Mode: BatchPricingModeMarkup, Value: 0.1,
		MinMarginRate: &minMargin, ProtectionMode: BatchProtectionModeApproval,
		ApprovalNote: "finance approved campaign pricing", OverwriteManual: true,
	})
	require.NoError(t, err)
	assert.Equal(t, 0, approved.Blocked, "skipped=%+v", approved.Skipped)

	var rows []model.ChannelModelPricing
	require.NoError(t, model.DB.Where("channel_id = ? AND model_name = ?", 13, "bad-cache-model").Find(&rows).Error)
	require.Len(t, rows, 1)
	assert.Contains(t, rows[0].InternalPricing, `"source":"batch"`)
	assert.Contains(t, rows[0].InternalPricing, "approved: finance approved campaign pricing")

	history, err := model.ListChannelPricingHistory(13, 10)
	require.NoError(t, err)
	require.NotEmpty(t, history)
	assert.Equal(t, "batch-approved", history[0].Source)
}

func TestBatchPricingRejectsInvalidProtectionOptions(t *testing.T) {
	setupBatchPricingDB(t)
	_, err := ApplyChannelBatchPricingWithOptions(1, BatchPricingOptions{
		Basis: BatchPricingBasisCurrent, Mode: BatchPricingModeNone,
		ProtectionMode: "yolo",
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "protection mode")

	negative := -0.1
	_, err = ApplyChannelBatchPricingWithOptions(1, BatchPricingOptions{
		Basis: BatchPricingBasisCurrent, Mode: BatchPricingModeNone,
		MinMarginRate: &negative,
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "minimum margin rate")
}

func seedTieredSaleRow(t *testing.T, channelID int, modelName string, saleInput [2]float64) {
	t.Helper()
	purchaseInput1, purchaseOutput1 := 1.0, 4.0
	purchaseInput2, purchaseOutput2 := 2.0, 8.0
	normalized := model.ChannelOfficialPricing{
		Currency: "USD",
		Unit:     "per_1m_token",
		ChannelPriceTiers: []model.ChannelPricingTier{
			{RangeName: "0-32k", MaxInputTokens: 32 * 1024, Unit: "per_1m_token", InputPerMillionUSD: &purchaseInput1, OutputPerMillionUSD: &purchaseOutput1},
			{RangeName: "32k-128k", MinInputTokens: 32 * 1024, MaxInputTokens: 128 * 1024, Unit: "per_1m_token", InputPerMillionUSD: &purchaseInput2, OutputPerMillionUSD: &purchaseOutput2},
		},
	}
	encoded, _ := common.Marshal(normalized)
	_, err := model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{{
		ChannelId: channelID, Provider: "test", ModelName: modelName,
		Currency: "USD", OfficialPricing: `{}`, NormalizedPricing: string(encoded),
		Source: "test", FetchedAt: 100,
	}})
	require.NoError(t, err)

	saleOutput1, saleOutput2 := saleInput[0]*4, saleInput[1]*4
	require.NoError(t, model.SetChannelInternalPricingFor(model.ChannelPricingIdentity{
		ChannelId: channelID, Provider: "test", ModelName: modelName,
	}, model.ChannelInternalPricing{
		Mode: model.ChannelPricingModeTieredTable,
		Tiers: []model.ChannelInternalPricingTier{
			{RangeName: "0-32k", MaxInputTokens: 32 * 1024, Unit: "per_1m_token", InputUSDPerMillion: &saleInput[0], OutputUSDPerMillion: &saleOutput1},
			{RangeName: "32k-128k", MinInputTokens: 32 * 1024, MaxInputTokens: 128 * 1024, Unit: "per_1m_token", InputUSDPerMillion: &saleInput[1], OutputUSDPerMillion: &saleOutput2},
		},
		Source: "manual",
	}))
}

func TestBatchPricingScalesTieredSalePrices(t *testing.T) {
	setupBatchPricingDB(t)
	seedTieredSaleRow(t, 21, "tiered-model", [2]float64{1.2, 2.4})

	result, err := ApplyChannelBatchPricingWithOptions(21, BatchPricingOptions{
		Models: []string{"tiered-model"},
		Basis:  BatchPricingBasisCurrent, Mode: BatchPricingModeMarkup, Value: 0.1,
		OverwriteManual: true,
	})
	require.NoError(t, err)
	require.Equal(t, 1, result.Updated)
	require.Len(t, result.Items, 1)
	require.Len(t, result.Items[0].Tiers, 2)
	assert.InDelta(t, 1.32, *result.Items[0].Tiers[0].InputUSD, 1e-9)
	assert.InDelta(t, 2.64, *result.Items[0].Tiers[1].InputUSD, 1e-9)

	row, err := model.GetChannelModelPricingFor(model.ChannelPricingIdentity{
		ChannelId: 21, Provider: "test", ModelName: "tiered-model",
	})
	require.NoError(t, err)
	var internal model.ChannelInternalPricing
	require.NoError(t, common.UnmarshalJsonStr(row.InternalPricing, &internal))
	assert.Equal(t, model.ChannelPricingModeTieredTable, internal.Mode)
	require.Len(t, internal.Tiers, 2)
	assert.InDelta(t, 1.32, *internal.Tiers[0].InputUSDPerMillion, 1e-9)

	effective := model.ResolveEffectiveChannelPricingFor(model.ChannelPricingIdentity{
		ChannelId: 21, Provider: "test", ModelName: "tiered-model",
	})
	require.True(t, effective.Billable)
	require.NotNil(t, effective.Pricing)
	assert.Contains(t, effective.Pricing.BillingExpr, "len <= 32768")
}

func TestBatchPricingTieredMarginBlocksLossBand(t *testing.T) {
	setupBatchPricingDB(t)
	seedTieredSaleRow(t, 23, "tiered-model", [2]float64{1.2, 1.5})

	minMargin := 0.1
	result, err := ApplyChannelBatchPricingWithOptions(23, BatchPricingOptions{
		Models: []string{"tiered-model"},
		Basis:  BatchPricingBasisCurrent, Mode: BatchPricingModeNone,
		OverwriteManual: true, MinMarginRate: &minMargin,
		ProtectionMode: BatchProtectionModePartial,
	})
	require.NoError(t, err)
	assert.Equal(t, 1, result.Blocked)
	require.Len(t, result.Skipped, 1)
	assert.Contains(t, result.Skipped[0].Reason, "32k-128k/input")
}
