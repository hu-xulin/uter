package service

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/pkg/billingexpr"
	"github.com/uter-ai/uter/setting/operation_setting"
)

func TestBailianTierExpressionPreservesContextTiers(t *testing.T) {
	low := 2.0
	lowOut := 8.0
	high := 4.0
	highOut := 16.0
	tiers := []model.ChannelPricingTier{
		{RangeName: "0-32K", MinInputTokens: 0, MaxInputTokens: 32000, Unit: "per_1m_token", InputPerMillionUSD: &low, OutputPerMillionUSD: &lowOut},
		{RangeName: "32K-128K", MinInputTokens: 32001, MaxInputTokens: 128000, Unit: "per_1m_token", InputPerMillionUSD: &high, OutputPerMillionUSD: &highOut},
	}
	expr := bailianTierExpression(tiers)
	require.NotEmpty(t, expr)
	snap := &billingexpr.BillingSnapshot{
		ExprString:   expr,
		ExprHash:     billingexpr.ExprHashString(expr),
		QuotaPerUnit: common.QuotaPerUnit,
		ExprVersion:  billingexpr.ExprVersion(expr),
	}
	short, err := billingexpr.ComputeTieredQuotaWithRequest(snap, billingexpr.TokenParams{P: 1000, C: 1000, Len: 1000}, billingexpr.RequestInput{})
	require.NoError(t, err)
	require.Equal(t, "0-32K", short.MatchedTier)
	require.InDelta(t, (1000*low+1000*lowOut)/1_000_000*common.QuotaPerUnit, short.ActualQuotaBeforeGroup, 1e-6)

	long, err := billingexpr.ComputeTieredQuotaWithRequest(snap, billingexpr.TokenParams{P: 1000, C: 1000, Len: 50000}, billingexpr.RequestInput{})
	require.NoError(t, err)
	require.Equal(t, "32K-128K", long.MatchedTier)
	require.InDelta(t, (1000*high+1000*highOut)/1_000_000*common.QuotaPerUnit, long.ActualQuotaBeforeGroup, 1e-6)
}

func TestBailianInternalPricingSkipsMultimodalShapes(t *testing.T) {
	view := model.ChannelOfficialPricing{Tiers: []model.ChannelPricingTier{
		{RangeName: "Default", Unit: "每次", PerUnitUSD: nil},
	}}
	require.Empty(t, bailianInternalPricing(view))
}

func TestBailianTierExpressionRejectsMultipleTimeBands(t *testing.T) {
	input := 1.0
	tiers := []model.ChannelPricingTier{
		{RangeName: "Default", TimeBand: "峰时", Unit: "per_1m_token", InputPerMillionUSD: &input},
		{RangeName: "Default", TimeBand: "非峰时", Unit: "per_1m_token", InputPerMillionUSD: &input},
	}
	require.Empty(t, bailianTierExpression(tiers))
}

func TestBailianTierExpressionIncludesCacheCreation(t *testing.T) {
	input := 2.0
	output := 8.0
	cache := 0.4
	createCache := 2.5
	tiers := []model.ChannelPricingTier{{
		RangeName: "Default", Unit: "per_1m_token", InputPerMillionUSD: &input,
		OutputPerMillionUSD: &output, CachePerMillionUSD: &cache, CreateCachePerMillionUSD: &createCache,
	}}
	expr := bailianTierExpression(tiers)
	require.NotEmpty(t, expr)
	assert.Contains(t, expr, "cr * 0.4")
	assert.Contains(t, expr, "cc * 2.5")
}

func TestBailianPricingRecordsResolvesExplicitAliases(t *testing.T) {
	prev := operation_setting.USDExchangeRate
	operation_setting.USDExchangeRate = 7
	t.Cleanup(func() { operation_setting.USDExchangeRate = prev })

	catalog := &BailianCatalog{
		ChannelID: 7,
		Region:    BailianRegionBeijing,
		FetchedAt: time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC),
		Models: []BailianModel{
			{Model: "qwen3.8-flash", Provider: "qwen", Prices: []BailianPriceRange{{
				RangeName: "Default", Prices: []BailianPrice{
					{Type: "input_token", Price: "7", PriceUnit: "每百万tokens", TimeBand: "standard"},
					{Type: "output_token", Price: "21", PriceUnit: "每百万tokens", TimeBand: "standard"},
				},
			}}},
			{Model: "qwen-plus", Provider: "qwen", Prices: []BailianPriceRange{{
				RangeName: "Default", Prices: []BailianPrice{
					{Type: "input_token", Price: "14", PriceUnit: "每百万tokens", TimeBand: "standard"},
					{Type: "output_token", Price: "42", PriceUnit: "每百万tokens", TimeBand: "standard"},
				},
			}}},
		},
	}
	records := BailianPricingRecords(catalog, []string{
		"cmaas-qwen3.8-flash", "qwen-plus-2025-11-05", "unknown-model",
	})
	require.Len(t, records, 2, "explicit aliases resolve, unknown names do not")
	byName := map[string]model.ChannelOfficialPricingRecord{}
	for _, record := range records {
		byName[record.ModelName] = record
	}
	require.Contains(t, byName, "cmaas-qwen3.8-flash")
	require.Contains(t, byName, "qwen-plus-2025-11-05")
	require.Contains(t, byName["cmaas-qwen3.8-flash"].NormalizedPricing, "qwen3.8-flash")
}

func TestBailianInternalPricingKeepsAudioAndPerSecondDimensions(t *testing.T) {
	input, output := 2.0, 8.0
	audioIn, audioOut := 16.0, 32.0
	view := model.ChannelOfficialPricing{
		Currency: "USD",
		Unit:     "per_1m_token",
		ChannelPriceTiers: []model.ChannelPricingTier{{
			RangeName:                "Default",
			Unit:                     "per_1m_token",
			InputPerMillionUSD:       &input,
			OutputPerMillionUSD:      &output,
			AudioInputPerMillionUSD:  &audioIn,
			AudioOutputPerMillionUSD: &audioOut,
		}},
	}
	encoded := bailianInternalPricing(view)
	require.NotEmpty(t, encoded)
	var internal model.ChannelInternalPricing
	require.NoError(t, common.UnmarshalJsonStr(encoded, &internal))
	require.Equal(t, model.ChannelPricingModePerMillionTokens, internal.Mode)
	require.NotNil(t, internal.AudioInputUSDPerMillion)
	require.NotNil(t, internal.AudioOutputUSDPerMillion)
	assert.InDelta(t, 16, *internal.AudioInputUSDPerMillion, 1e-9)
	assert.InDelta(t, 32, *internal.AudioOutputUSDPerMillion, 1e-9)
	billing, err := model.NormalizeChannelInternalPricing(&internal)
	require.NoError(t, err)
	require.NotNil(t, billing.AudioRatio)
	require.NotNil(t, billing.AudioCompletionRatio)
	assert.InDelta(t, 8, *billing.AudioRatio, 1e-9)
	assert.InDelta(t, 4, *billing.AudioCompletionRatio, 1e-9)

	perSecond := 0.05
	secondView := model.ChannelOfficialPricing{
		Currency: "USD",
		ChannelPriceTiers: []model.ChannelPricingTier{{
			RangeName: "Default", Unit: "per_second", PerUnitUSD: &perSecond,
		}},
	}
	secondEncoded := bailianInternalPricing(secondView)
	require.NotEmpty(t, secondEncoded)
	var secondInternal model.ChannelInternalPricing
	require.NoError(t, common.UnmarshalJsonStr(secondEncoded, &secondInternal))
	require.Equal(t, model.ChannelPricingModePerSecond, secondInternal.Mode)
	require.NotNil(t, secondInternal.PerSecondUSD)
	assert.InDelta(t, perSecond, *secondInternal.PerSecondUSD, 1e-9)
}
