package controller

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
)

func TestChannelModelPricingViewExposesUterRouteQuote(t *testing.T) {
	ratio, completion, cache := 2.5, 5.0, 0.1
	raw, err := common.Marshal(service.UpstreamModelRecord{
		ProviderID: "uterroute", ModelName: "gpt-a",
		ModelRatio: &ratio, CompletionRatio: &completion, CacheRatio: &cache,
	})
	require.NoError(t, err)

	view := channelModelPricingToView(model.ChannelModelPricing{
		ChannelId: 7, ModelName: "gpt-a", Provider: "uterroute",
		OfficialPricing: string(raw), NormalizedPricing: `{}`,
	})
	require.NotNil(t, view.UpstreamQuote)
	require.Equal(t, "DERIVED_FROM_RATIOS", view.UpstreamQuote.PriceBasis)
	require.Equal(t, 5.0, view.UpstreamQuote.InputPerMillionUSD.Float64())
	require.Equal(t, 25.0, view.UpstreamQuote.OutputPerMillionUSD.Float64())
	require.Equal(t, 0.5, view.UpstreamQuote.CachePerMillionUSD.Float64())
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
			Unit: "per_1m_token", InputPerMillionUSD: model.MoneyFromFloatPtr(&input), OutputPerMillionUSD: model.MoneyFromFloatPtr(&output),
		}},
	})
	require.NoError(t, err)

	view := channelModelPricingToView(model.ChannelModelPricing{
		ChannelId: 8, ModelName: "qwen-max", Provider: "alibaba-bailian",
		NormalizedPricing: string(normalized),
	})
	require.NotNil(t, view.UpstreamQuote)
	require.Equal(t, "CHANNEL_CATALOG", view.UpstreamQuote.PriceBasis)
	require.Equal(t, 2.0, view.UpstreamQuote.InputPerMillionUSD.Float64())
	require.Equal(t, 4.0, view.UpstreamQuote.OutputPerMillionUSD.Float64())
}

func floatPtr(value float64) *float64 { return &value }

// needs_review 的 Uter Route 行可能同时带有 billing_expr 解析出的权威官方价
// 与过时的 model_ratio。渠道报价不得用过时 ratio 重新推导并遮蔽解析价——
// 否则 claude-haiku-5-5 会显示 0.5/2.5，而非正确的 0.1/0.5。
func TestChannelModelPricingViewNeverShadowsParsedOfficialWithStaleRatio(t *testing.T) {
	staleRatio, completion := 0.25, 5.0
	raw, err := common.Marshal(service.UpstreamModelRecord{
		ProviderID: "uterroute", ModelName: "claude-haiku-5-5",
		ModelRatio: &staleRatio, CompletionRatio: &completion,
		OfficialPrice: &service.UpstreamPriceLine{
			Input: floatPtr(0.1), Output: floatPtr(0.5), Unit: "per_1m_token", Currency: "USD",
		},
		PriceStatus: "DERIVED_FROM_EXPR", PriceBasis: service.UpstreamPriceBasisRatioOnly,
	})
	require.NoError(t, err)

	input, output := 0.1, 0.5
	normalized, err := common.Marshal(model.ChannelOfficialPricing{
		Currency: "USD", Source: "uterroute-expression",
		Tiers: []model.ChannelPricingTier{{
			Unit: "per_1m_token", InputPerMillionUSD: model.MoneyFromFloatPtr(&input), OutputPerMillionUSD: model.MoneyFromFloatPtr(&output),
		}},
	})
	require.NoError(t, err)

	view := channelModelPricingToView(model.ChannelModelPricing{
		ChannelId: 1241, ModelName: "claude-haiku-5-5", Provider: "uterroute",
		OfficialPricing: string(raw), NormalizedPricing: string(normalized),
		PricingStatus: "needs_review",
	})
	require.NotNil(t, view.UpstreamQuote)
	require.NotEqual(t, "DERIVED_FROM_RATIOS", view.UpstreamQuote.PriceBasis,
		"过时的 ratio 不得覆盖已解析的官方价")
	require.InDelta(t, 0.1, view.UpstreamQuote.InputPerMillionUSD.Float64(), 1e-9)
	require.InDelta(t, 0.5, view.UpstreamQuote.OutputPerMillionUSD.Float64(), 1e-9)
}

// 完全没有已解析的官方 tier 时，仍按既有约定（model_ratio 1 = $2/1M）推导并标注来源，
// 保证纯 ratio 渠道的展示契约不被本次修复破坏。
func TestChannelModelPricingViewStillDerivesRatioWithoutOfficialTier(t *testing.T) {
	ratio, completion := 2.5, 5.0
	raw, err := common.Marshal(service.UpstreamModelRecord{
		ProviderID: "uterroute", ModelName: "ratio-only",
		ModelRatio: &ratio, CompletionRatio: &completion,
	})
	require.NoError(t, err)

	view := channelModelPricingToView(model.ChannelModelPricing{
		ChannelId: 7, ModelName: "ratio-only", Provider: "uterroute",
		OfficialPricing: string(raw), NormalizedPricing: `{}`,
	})
	require.NotNil(t, view.UpstreamQuote)
	require.Equal(t, "DERIVED_FROM_RATIOS", view.UpstreamQuote.PriceBasis)
	require.InDelta(t, 5.0, view.UpstreamQuote.InputPerMillionUSD.Float64(), 1e-9)
	require.InDelta(t, 25.0, view.UpstreamQuote.OutputPerMillionUSD.Float64(), 1e-9)
}

// needs_review 行若后端回落到官方标价，必须用 OFFICIAL_REFERENCE 明确标记
// price_basis，前端才能据此拒绝把它当渠道价展示。数字可以相同，语义必须分离。
// 这条测试锁定"basis 是契约"：任何把官方价改标成 CHANNEL_* 的回归都会失败。
func TestChannelModelPricingViewMarksOfficialFallbackBasis(t *testing.T) {
	input, output := 10.0, 50.0
	normalized, err := common.Marshal(model.ChannelOfficialPricing{
		Currency: "USD", Source: "uterroute-expression",
		Tiers: []model.ChannelPricingTier{{
			Unit: "per_1m_token", InputPerMillionUSD: model.MoneyFromFloatPtr(&input),
			OutputPerMillionUSD: model.MoneyFromFloatPtr(&output),
		}},
		NeedsReview:   true,
		ReviewReasons: []string{"NO_UPSTREAM_DISCOUNT"},
	})
	require.NoError(t, err)

	view := channelModelPricingToView(model.ChannelModelPricing{
		ChannelId: 1245, ModelName: "claude-fable-5", Provider: "uterroute",
		NormalizedPricing: string(normalized), PricingStatus: "needs_review",
	})
	require.NotNil(t, view.UpstreamQuote)
	require.Equal(t, "OFFICIAL_REFERENCE", view.UpstreamQuote.PriceBasis,
		"官方价回落必须标注 OFFICIAL_REFERENCE，供展示层拒绝渲染为渠道价")
	require.Equal(t, 10.0, view.UpstreamQuote.InputPerMillionUSD.Float64())
	require.Equal(t, 50.0, view.UpstreamQuote.OutputPerMillionUSD.Float64())
}

func TestChannelModelPricingViewExposesDiscountedChannelQuote(t *testing.T) {
	input, output, discount := 6.0, 30.0, 0.6
	normalized, err := common.Marshal(model.ChannelOfficialPricing{
		Currency: "USD",
		Tiers: []model.ChannelPricingTier{{
			Unit: "per_1m_token", InputPerMillionUSD: model.MoneyFromFloatPtr(floatPtr(10)), OutputPerMillionUSD: model.MoneyFromFloatPtr(floatPtr(50)),
		}},
		ChannelPrice: &model.ChannelPricingTier{
			Unit: "per_1m_token", InputPerMillionUSD: model.MoneyFromFloatPtr(&input), OutputPerMillionUSD: model.MoneyFromFloatPtr(&output),
		},
		DiscountRatio: &discount,
		Source:        "uterroute-official",
	})
	require.NoError(t, err)

	view := channelModelPricingToView(model.ChannelModelPricing{
		ChannelId: 9, ModelName: "claude-a", Provider: "uterroute",
		NormalizedPricing: string(normalized),
	})
	require.NotNil(t, view.UpstreamQuote)
	require.Equal(t, "CHANNEL_DISCOUNT", view.UpstreamQuote.PriceBasis)
	require.Equal(t, 6.0, view.UpstreamQuote.InputPerMillionUSD.Float64())
	require.Equal(t, 30.0, view.UpstreamQuote.OutputPerMillionUSD.Float64())
	require.Equal(t, 0.6, *view.UpstreamQuote.DiscountRatio)
}

func TestChannelModelPricingViewExposesEveryUpstreamQuoteTier(t *testing.T) {
	lowInput, lowOutput := 1.0, 2.0
	highInput, highOutput := 2.0, 4.0
	normalized, err := common.Marshal(model.ChannelOfficialPricing{
		Currency: "USD",
		ChannelPriceTiers: []model.ChannelPricingTier{
			{RangeName: "0-32K", Unit: "per_1m_token", InputPerMillionUSD: model.MoneyFromFloatPtr(&lowInput), OutputPerMillionUSD: model.MoneyFromFloatPtr(&lowOutput)},
			{RangeName: "32K-128K", Unit: "per_1m_token", InputPerMillionUSD: model.MoneyFromFloatPtr(&highInput), OutputPerMillionUSD: model.MoneyFromFloatPtr(&highOutput)},
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
	require.Equal(t, 2.0, view.UpstreamQuote.Tiers[1].InputPerMillionUSD.Float64())
}

func TestChannelModelPricingViewKeepsMediaAndThinkingQuoteFields(t *testing.T) {
	perImage := 0.04
	input, image, thinkingOut, thinkingCache := 1.0, 3.0, 4.0, 0.5
	normalized, err := common.Marshal(model.ChannelOfficialPricing{
		Currency: "USD",
		ChannelPriceTiers: []model.ChannelPricingTier{
			{RangeName: "image", Unit: "per_image", PerUnitUSD: model.MoneyFromFloatPtr(&perImage)},
			{
				RangeName: "text", Unit: "per_1m_token",
				InputPerMillionUSD: model.MoneyFromFloatPtr(&input), ImageInputPerMillionUSD: model.MoneyFromFloatPtr(&image),
				ThinkingOutputPerMillionUSD: model.MoneyFromFloatPtr(&thinkingOut), ThinkingCachePerMillionUSD: model.MoneyFromFloatPtr(&thinkingCache),
			},
		},
	})
	require.NoError(t, err)
	view := channelModelPricingToView(model.ChannelModelPricing{
		ChannelId: 11, ModelName: "vision-a", Provider: "uterapi",
		NormalizedPricing: string(normalized),
	})
	require.NotNil(t, view.UpstreamQuote)
	require.Len(t, view.UpstreamQuote.Tiers, 2)
	imageTier := view.UpstreamQuote.Tiers[0]
	require.Equal(t, "per_image", imageTier.Unit)
	require.NotNil(t, imageTier.PerUnitUSD)
	require.InDelta(t, 0.04, imageTier.PerUnitUSD.Float64(), 1e-9)
	textTier := view.UpstreamQuote.Tiers[1]
	require.NotNil(t, textTier.ImageInputPerMillionUSD)
	require.InDelta(t, 3.0, textTier.ImageInputPerMillionUSD.Float64(), 1e-9)
	require.NotNil(t, textTier.ThinkingOutputPerMillionUSD)
	require.InDelta(t, 4.0, textTier.ThinkingOutputPerMillionUSD.Float64(), 1e-9)
	require.NotNil(t, textTier.ThinkingCachePerMillionUSD)
	require.InDelta(t, 0.5, textTier.ThinkingCachePerMillionUSD.Float64(), 1e-9)
}
