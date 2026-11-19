package service

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/model"
)

func TestResolveBatchBasePriceBailianOfficial(t *testing.T) {
	row := model.ChannelModelPricing{
		ModelName: "qwen-plus",
		NormalizedPricing: `{
			"currency":"USD","unit":"per_1m_token","tiers":[
				{"range_name":"Default","input_per_million_usd":0.8,"output_per_million_usd":2,"unit":"per_1m_token"}
			]
		}`,
	}
	base, reason := resolveBatchBasePrice(row, BatchPricingBasisOfficial)
	require.Empty(t, reason)
	require.Equal(t, model.ChannelPricingModePerMillionTokens, base.mode)
	require.NotNil(t, base.inputUSD)
	require.Equal(t, 0.8, *base.inputUSD)
	require.NotNil(t, base.outputUSD)
	require.Equal(t, 2.0, *base.outputUSD)
}

func TestResolveBatchBasePriceDreamRouterRejectsOfficialBasis(t *testing.T) {
	row := model.ChannelModelPricing{
		ModelName: "gpt-a",
		NormalizedPricing: `{
			"price_basis":"UPSTREAM_RATIO_ONLY","quota_type":0,
			"model_ratio":2.5,"completion_ratio":5
		}`,
	}
	_, reason := resolveBatchBasePrice(row, BatchPricingBasisOfficial)
	require.Contains(t, reason, "absolute official price unavailable")

	base, reason := resolveBatchBasePrice(row, BatchPricingBasisChannel)
	require.Empty(t, reason)
	require.Equal(t, model.ChannelPricingModePerMillionTokens, base.mode)
	require.NotNil(t, base.inputUSD)
	require.Equal(t, 5.0, *base.inputUSD)
	require.NotNil(t, base.outputUSD)
	require.Equal(t, 25.0, *base.outputUSD)
}

func TestResolveBatchBasePriceDreamRouterPerCall(t *testing.T) {
	row := model.ChannelModelPricing{
		ModelName: "image-a",
		NormalizedPricing: `{
			"price_basis":"UPSTREAM_RATIO_ONLY","quota_type":1,
			"model_price":0.04
		}`,
	}
	base, reason := resolveBatchBasePrice(row, BatchPricingBasisChannel)
	require.Empty(t, reason)
	require.Equal(t, model.ChannelPricingModePerCall, base.mode)
	require.NotNil(t, base.perCallUSD)
	require.Equal(t, 0.04, *base.perCallUSD)
}

func TestResolveBatchBasePriceWithoutAnyPrice(t *testing.T) {
	_, reason := resolveBatchBasePrice(model.ChannelModelPricing{ModelName: "empty"}, BatchPricingBasisOfficial)
	require.Contains(t, reason, "no absolute official price")
}

func TestApplyBatchRuleModes(t *testing.T) {
	cases := []struct {
		mode  string
		value float64
		want  float64
		ok    bool
	}{
		{BatchPricingModeDiscount, 0.6, 1.2, true},
		{BatchPricingModeMarkup, 0.1, 2.2, true},
		{BatchPricingModeMultiply, 0.8, 1.6, true},
		{BatchPricingModeAdd, 0.5, 2.5, true},
		{BatchPricingModeFixed, 3, 3, true},
		{BatchPricingModeNone, 0, 2, true},
		{BatchPricingModeAdd, -3, 0, false},
	}
	for _, tc := range cases {
		got, ok := applyBatchRule(2, tc.mode, tc.value)
		require.Equal(t, tc.ok, ok, tc.mode)
		if tc.ok {
			require.InDelta(t, tc.want, got, 1e-9, tc.mode)
		}
	}
}

func TestMatchesModelPrefixes(t *testing.T) {
	require.True(t, matchesModelPrefixes("gpt-5", []string{"gpt-"}))
	require.True(t, matchesModelPrefixes("Claude-4", []string{"claude-"}))
	require.False(t, matchesModelPrefixes("gemini-2", []string{"gpt-", "claude-"}))
	require.False(t, matchesModelPrefixes("gpt-5", nil))
}

func TestChannelPricingScheduleEffectiveIntervals(t *testing.T) {
	model, official, channel := (ChannelPricingSchedule{}).EffectiveIntervals()
	require.Equal(t, DefaultModelSyncIntervalMinutes, model)
	require.Equal(t, DefaultOfficialSyncIntervalMinutes, official)
	require.Equal(t, DefaultChannelSyncIntervalMinutes, channel)

	model, official, channel = (ChannelPricingSchedule{
		ModelSyncIntervalMinutes:    60,
		OfficialSyncIntervalMinutes: 120,
		ChannelSyncIntervalMinutes:  30,
	}).EffectiveIntervals()
	require.Equal(t, 60, model)
	require.Equal(t, 120, official)
	require.Equal(t, 30, channel)
}
