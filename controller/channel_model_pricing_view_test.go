package controller

import (
	"testing"
	"time"

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

func TestChannelModelPricingViewFlagsStaleUpstreamPrice(t *testing.T) {
	fresh := channelModelPricingToView(model.ChannelModelPricing{FetchedAt: time.Now().Unix()})
	require.False(t, fresh.Stale)

	stale := channelModelPricingToView(model.ChannelModelPricing{
		FetchedAt: time.Now().Add(-72 * time.Hour).Unix(),
	})
	require.True(t, stale.Stale)
	require.GreaterOrEqual(t, stale.FetchedAgeHours, int64(71))

	unknown := channelModelPricingToView(model.ChannelModelPricing{})
	require.False(t, unknown.Stale, "a record without a fetch time is not labelled stale")
}

func TestChannelModelPricingViewExposesAbsoluteProviderQuote(t *testing.T) {
	input, output := 2.0, 4.0
	normalized, err := common.Marshal(model.ChannelOfficialPricing{
		Currency: "USD",
		ChannelPriceTiers: []model.ChannelPricingTier{{
			Unit: "per_1m_token", InputPerMillionUSD: &input, OutputPerMillionUSD: &output,
		}},
	})
	require.NoError(t, err)

	view := channelModelPricingToView(model.ChannelModelPricing{
		ChannelId: 8, ModelName: "qwen-max", Provider: "alibaba-bailian",
		NormalizedPricing: string(normalized),
	})
	require.NotNil(t, view.UpstreamQuote)
	require.Equal(t, "CHANNEL_CATALOG", view.UpstreamQuote.PriceBasis)
	require.Equal(t, 2.0, *view.UpstreamQuote.InputPerMillionUSD)
	require.Equal(t, 4.0, *view.UpstreamQuote.OutputPerMillionUSD)
}

func floatPtr(value float64) *float64 { return &value }

func TestChannelModelPricingViewExposesDiscountedChannelQuote(t *testing.T) {
	input, output, discount := 6.0, 30.0, 0.6
	normalized, err := common.Marshal(model.ChannelOfficialPricing{
		Currency: "USD",
		Tiers: []model.ChannelPricingTier{{
			Unit: "per_1m_token", InputPerMillionUSD: floatPtr(10), OutputPerMillionUSD: floatPtr(50),
		}},
		ChannelPrice: &model.ChannelPricingTier{
			Unit: "per_1m_token", InputPerMillionUSD: &input, OutputPerMillionUSD: &output,
		},
		DiscountRatio: &discount,
		Source:        "dreamrouter-official",
	})
	require.NoError(t, err)

	view := channelModelPricingToView(model.ChannelModelPricing{
		ChannelId: 9, ModelName: "claude-a", Provider: "dreamrouter",
		NormalizedPricing: string(normalized),
	})
	require.NotNil(t, view.UpstreamQuote)
	require.Equal(t, "CHANNEL_DISCOUNT", view.UpstreamQuote.PriceBasis)
	require.Equal(t, 6.0, *view.UpstreamQuote.InputPerMillionUSD)
	require.Equal(t, 30.0, *view.UpstreamQuote.OutputPerMillionUSD)
	require.Equal(t, 0.6, *view.UpstreamQuote.DiscountRatio)
}

func TestChannelModelPricingViewExposesEveryUpstreamQuoteTier(t *testing.T) {
	lowInput, lowOutput := 1.0, 2.0
	highInput, highOutput := 2.0, 4.0
	normalized, err := common.Marshal(model.ChannelOfficialPricing{
		Currency: "USD",
		ChannelPriceTiers: []model.ChannelPricingTier{
			{RangeName: "0-32K", Unit: "per_1m_token", InputPerMillionUSD: &lowInput, OutputPerMillionUSD: &lowOutput},
			{RangeName: "32K-128K", Unit: "per_1m_token", InputPerMillionUSD: &highInput, OutputPerMillionUSD: &highOutput},
		},
	})
	require.NoError(t, err)
	view := channelModelPricingToView(model.ChannelModelPricing{
		ChannelId: 10, ModelName: "qwen-tiered", Provider: "alibaba-bailian",
		NormalizedPricing: string(normalized),
	})
	require.NotNil(t, view.UpstreamQuote)
	require.Len(t, view.UpstreamQuote.Tiers, 2)
	require.Equal(t, "0-32K", view.UpstreamQuote.Tiers[0].RangeName)
	require.Equal(t, "32K-128K", view.UpstreamQuote.Tiers[1].RangeName)
	require.Equal(t, 2.0, *view.UpstreamQuote.Tiers[1].InputPerMillionUSD)
}

func TestChannelModelPricingViewKeepsMediaAndThinkingQuoteFields(t *testing.T) {
	perImage := 0.04
	input, image, thinkingOut, thinkingCache := 1.0, 3.0, 4.0, 0.5
	normalized, err := common.Marshal(model.ChannelOfficialPricing{
		Currency: "USD",
		ChannelPriceTiers: []model.ChannelPricingTier{
			{RangeName: "image", Unit: "per_image", PerUnitUSD: &perImage},
			{
				RangeName: "text", Unit: "per_1m_token",
				InputPerMillionUSD: &input, ImageInputPerMillionUSD: &image,
				ThinkingOutputPerMillionUSD: &thinkingOut, ThinkingCachePerMillionUSD: &thinkingCache,
			},
		},
	})
	require.NoError(t, err)
	view := channelModelPricingToView(model.ChannelModelPricing{
		ChannelId: 11, ModelName: "vision-a", Provider: "apiko",
		NormalizedPricing: string(normalized),
	})
	require.NotNil(t, view.UpstreamQuote)
	require.Len(t, view.UpstreamQuote.Tiers, 2)
	imageTier := view.UpstreamQuote.Tiers[0]
	require.Equal(t, "per_image", imageTier.Unit)
	require.NotNil(t, imageTier.PerUnitUSD)
	require.InDelta(t, 0.04, *imageTier.PerUnitUSD, 1e-9)
	textTier := view.UpstreamQuote.Tiers[1]
	require.NotNil(t, textTier.ImageInputPerMillionUSD)
	require.InDelta(t, 3.0, *textTier.ImageInputPerMillionUSD, 1e-9)
	require.NotNil(t, textTier.ThinkingOutputPerMillionUSD)
	require.InDelta(t, 4.0, *textTier.ThinkingOutputPerMillionUSD, 1e-9)
	require.NotNil(t, textTier.ThinkingCachePerMillionUSD)
	require.InDelta(t, 0.5, *textTier.ThinkingCachePerMillionUSD, 1e-9)
}
