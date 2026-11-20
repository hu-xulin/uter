package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
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

func TestClassifyModelCategory(t *testing.T) {
	cases := map[string]string{
		"gpt-5":             "text",
		"text-embedding-v3": "embedding",
		"qwen3-asr-flash":   "audio",
		"cosyvoice-v2":      "audio",
		"wan2.2-t2v-plus":   "video",
		"kling-v2":          "video",
		"qwen-image-plus":   "image",
		"flux-1.1-pro":      "image",
	}
	for name, want := range cases {
		if got := ClassifyModelCategory(name); got != want {
			t.Fatalf("ClassifyModelCategory(%q) = %q, want %q", name, got, want)
		}
	}
}

func TestResolveBatchBasePriceRejectsLossyShapes(t *testing.T) {
	cases := []struct {
		name       string
		normalized string
		reason     string
	}{
		{
			name: "multiple tiers",
			normalized: `{"currency":"USD","unit":"per_1m_token","tiers":[
				{"range_name":"short","input_per_million_usd":1,"output_per_million_usd":2,"unit":"per_1m_token"},
				{"range_name":"long","input_per_million_usd":2,"output_per_million_usd":4,"unit":"per_1m_token"}
			]}`,
			reason: "multiple official price tiers",
		},
		{
			name: "ambiguous shape",
			normalized: `{"currency":"USD","unit":"mixed","tiers":[
				{"range_name":"mixed","input_per_million_usd":1,"per_unit_usd":0.1,"unit":"mixed"}
			]}`,
			reason: "ambiguous price shape",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, reason := resolveBatchBasePrice(model.ChannelModelPricing{
				ModelName: "m", NormalizedPricing: tc.normalized,
			}, BatchPricingBasisOfficial)
			require.Contains(t, reason, tc.reason)
		})
	}
}

func TestResolveBatchBasePriceChannelBasisUsesPurchasePrice(t *testing.T) {
	row := model.ChannelModelPricing{
		ModelName: "gpt-priced",
		NormalizedPricing: `{"currency":"USD","unit":"per_1m_token",
			"tiers":[{"range_name":"base","input_per_million_usd":2,"output_per_million_usd":4,"unit":"per_1m_token"}],
			"channel_price":{"range_name":"channel","input_per_million_usd":1.2,"output_per_million_usd":2.4,"unit":"per_1m_token"}}`,
	}
	base, reason := resolveBatchBasePrice(row, BatchPricingBasisChannel)
	require.Empty(t, reason)
	require.NotNil(t, base.inputUSD)
	assert.Equal(t, 1.2, *base.inputUSD)
	require.NotNil(t, base.outputUSD)
	assert.Equal(t, 2.4, *base.outputUSD)

	// Without a purchase price the channel basis must not reuse the list price.
	row.NormalizedPricing = `{"currency":"USD","unit":"per_1m_token",
		"tiers":[{"range_name":"base","input_per_million_usd":2,"output_per_million_usd":4,"unit":"per_1m_token"}]}`
	_, reason = resolveBatchBasePrice(row, BatchPricingBasisChannel)
	require.Contains(t, reason, "no upstream purchase price")

	// The official basis still uses the list price.
	base, reason = resolveBatchBasePrice(row, BatchPricingBasisOfficial)
	require.Empty(t, reason)
	assert.Equal(t, 2.0, *base.inputUSD)
}

func TestResolveBatchBasePriceSupportsPerSecond(t *testing.T) {
	base, reason := resolveBatchBasePrice(model.ChannelModelPricing{
		ModelName: "video-a",
		NormalizedPricing: `{"currency":"USD","unit":"per_second","tiers":[
			{"range_name":"video","per_unit_usd":0.08,"unit":"per_second"}
		]}`,
	}, BatchPricingBasisOfficial)
	require.Empty(t, reason)
	require.Equal(t, model.ChannelPricingModePerSecond, base.mode)
	require.NotNil(t, base.perSecondUSD)
	require.Equal(t, 0.08, *base.perSecondUSD)
}

func TestResolveBatchBasePriceSupportsPerImageAsPerCall(t *testing.T) {
	base, reason := resolveBatchBasePrice(model.ChannelModelPricing{
		ModelName: "image-a",
		NormalizedPricing: `{"currency":"USD","unit":"per_image","tiers":[
			{"range_name":"image","per_unit_usd":0.04,"unit":"per_image"}
		]}`,
	}, BatchPricingBasisOfficial)
	require.Empty(t, reason)
	require.Equal(t, model.ChannelPricingModePerCall, base.mode)
	require.NotNil(t, base.perCallUSD)
	require.Equal(t, 0.04, *base.perCallUSD)
}

func TestResolveBatchBasePriceIncludesCacheComponents(t *testing.T) {
	base, reason := resolveBatchBasePrice(model.ChannelModelPricing{
		ModelName: "gpt-a",
		NormalizedPricing: `{"currency":"USD","unit":"per_1m_token","tiers":[
			{"range_name":"base","input_per_million_usd":2,"output_per_million_usd":4,"cache_per_million_usd":1,"create_cache_per_million_usd":2.5,"unit":"per_1m_token"}
		]}`,
	}, BatchPricingBasisOfficial)
	require.Empty(t, reason)
	require.NotNil(t, base.cacheUSD)
	require.Equal(t, 1.0, *base.cacheUSD)
	require.NotNil(t, base.cacheWriteUSD)
	require.Equal(t, 2.5, *base.cacheWriteUSD)
}
