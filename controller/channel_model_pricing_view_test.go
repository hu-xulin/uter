package controller

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
)

func TestChannelModelPricingViewExposesDreamRouterQuote(t *testing.T) {
	ratio, completion, cache := 2.5, 5.0, 0.1
	raw, err := common.Marshal(service.UpstreamModelRecord{
		ProviderID: "dreamrouter", ModelName: "gpt-a",
		ModelRatio: &ratio, CompletionRatio: &completion, CacheRatio: &cache,
	})
	require.NoError(t, err)

	view := channelModelPricingToView(model.ChannelModelPricing{
		ChannelId: 7, ModelName: "gpt-a", Provider: "dreamrouter",
		OfficialPricing: string(raw), NormalizedPricing: `{}`,
	})
	require.NotNil(t, view.UpstreamQuote)
	require.Equal(t, "DERIVED_FROM_RATIOS", view.UpstreamQuote.PriceBasis)
	require.Equal(t, 5.0, *view.UpstreamQuote.InputPerMillionUSD)
	require.Equal(t, 25.0, *view.UpstreamQuote.OutputPerMillionUSD)
	require.Equal(t, 0.5, *view.UpstreamQuote.CachePerMillionUSD)
}

func TestChannelModelPricingViewExposesAbsoluteProviderQuote(t *testing.T) {
	input, output := 2.0, 4.0
	normalized, err := common.Marshal(model.ChannelOfficialPricing{
		Currency: "USD",
		Tiers: []model.ChannelPricingTier{{
			Unit: "per_1m_token", InputPerMillionUSD: &input, OutputPerMillionUSD: &output,
		}},
	})
	require.NoError(t, err)

	view := channelModelPricingToView(model.ChannelModelPricing{
		ChannelId: 8, ModelName: "qwen-max", Provider: "alibaba-bailian",
		NormalizedPricing: string(normalized),
	})
	require.NotNil(t, view.UpstreamQuote)
	require.Equal(t, "OFFICIAL_REFERENCE", view.UpstreamQuote.PriceBasis)
	require.Equal(t, 2.0, *view.UpstreamQuote.InputPerMillionUSD)
	require.Equal(t, 4.0, *view.UpstreamQuote.OutputPerMillionUSD)
}
