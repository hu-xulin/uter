package service

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

func TestBuildUpstreamParityReportClassifiesRows(t *testing.T) {
	now := time.Unix(2_000_000, 0)
	price := 2.0
	channelTier, _ := common.Marshal(model.ChannelOfficialPricing{
		ChannelPriceTiers: []model.ChannelPricingTier{{Unit: "per_1m_token", InputPerMillionUSD: model.MoneyFromFloatPtr(&price)}},
		Source:            "bailian-channel",
	})
	configured, _ := common.Marshal(model.ChannelInternalPricing{
		Mode: model.ChannelPricingModePerMillionTokens, InputUSDPerMillion: model.MoneyFromFloatPtr(&price), OutputUSDPerMillion: model.MoneyFromFloatPtr(&price),
	})
	unsupported, _ := common.Marshal(model.ChannelOfficialPricing{
		ExpressionStatus: UpstreamExpressionUnsupported, BillingExpr: "not valid (", Source: "newapi",
	})
	verifiedPurchase, _ := common.Marshal(model.ChannelPurchaseCost{
		Pricing: model.ChannelInternalPricing{
			Mode: model.ChannelPricingModePerMillionTokens, InputUSDPerMillion: model.MoneyFromFloatPtr(&price),
		},
		Verified: true, Source: "contract",
	})
	rows := []model.ChannelModelPricing{
		{ModelName: "matched", LifecycleStatus: model.ChannelModelLifecycleActive, PricingStatus: model.ChannelPricingStatusConfigured, NormalizedPricing: string(channelTier), InternalPricing: string(configured), PurchasePricing: string(verifiedPurchase), FetchedAt: now.Add(-time.Hour).Unix()},
		{ModelName: "stale", LifecycleStatus: model.ChannelModelLifecycleActive, PricingStatus: model.ChannelPricingStatusConfigured, NormalizedPricing: string(channelTier), InternalPricing: string(configured), PurchasePricing: string(verifiedPurchase), FetchedAt: now.Add(-8 * 24 * time.Hour).Unix()},
		{ModelName: "no-sale", LifecycleStatus: model.ChannelModelLifecycleActive, PricingStatus: model.ChannelPricingStatusOfficialOnly, NormalizedPricing: string(channelTier), FetchedAt: now.Unix()},
		{ModelName: "disabled", LifecycleStatus: model.ChannelModelLifecycleDisabled, PricingStatus: model.ChannelPricingStatusConfigured, NormalizedPricing: string(channelTier), InternalPricing: string(configured), FetchedAt: now.Unix()},
		{ModelName: "unsupported", LifecycleStatus: model.ChannelModelLifecycleActive, PricingStatus: model.ChannelPricingStatusNeedsReview, NormalizedPricing: string(unsupported), FetchedAt: now.Unix()},
	}
	report := BuildUpstreamParityReport(1, "test", rows, now)
	byName := map[string]UpstreamParityModel{}
	for _, item := range report.Models {
		byName[item.ModelName] = item
	}
	require.Equal(t, UpstreamParityFullyMatched, byName["matched"].Status)
	require.Equal(t, UpstreamParityStale, byName["stale"].Status)
	require.Equal(t, UpstreamParityPriceMismatch, byName["no-sale"].Status)
	require.Equal(t, UpstreamParityModelMismatch, byName["disabled"].Status)
	require.Equal(t, UpstreamParityUnsupported, byName["unsupported"].Status)
	require.Equal(t, 1, report.Summary[UpstreamParityFullyMatched])
}

// TestParityAuditDetectsPurchaseUnverified proves that a ratio-derived sale
// price, even once auto-configured, is never reported as fully matched when no
// operator-confirmed contract cost exists. Without this gate the audit page
// hides PURCHASE_UNVERIFIED inside the success count and operators could trust
// a margin figure computed from a ratio estimate.
func TestParityAuditDetectsPurchaseUnverified(t *testing.T) {
	now := time.Unix(2_000_000, 0)
	price := 2.0
	ratioView, _ := common.Marshal(model.ChannelOfficialPricing{
		PriceKind: "RATIO_ONLY", Source: "uterroute-ratio-reference",
		Tiers: []model.ChannelPricingTier{{
			RangeName: "base", Unit: "per_1m_token", InputPerMillionUSD: model.MoneyFromFloatPtr(&price),
		}},
		ChannelPrice: &model.ChannelPricingTier{
			Unit: "per_1m_token", InputPerMillionUSD: model.MoneyFromFloatPtr(&price),
		},
		RatioBasis: &model.ChannelRatioBasis{
			RawRatio: 1, BasisUSDPerMillion: model.MoneyFromFloat(2),
			Formula: "reference_only: usd_per_1m = model_ratio * 2", FormulaVersion: "uterroute-ratio-v1",
		},
	})
	sale, _ := common.Marshal(model.ChannelInternalPricing{
		Mode:               model.ChannelPricingModePerMillionTokens,
		InputUSDPerMillion: model.MoneyFromFloatPtr(&price),
		Source:             "uterroute-discount",
	})
	rows := []model.ChannelModelPricing{{
		ModelName: "ratio-derived", LifecycleStatus: model.ChannelModelLifecycleActive,
		PricingStatus:     model.ChannelPricingStatusConfigured,
		NormalizedPricing: string(ratioView), InternalPricing: string(sale),
		// No PurchasePricing: cost is unverified.
		FetchedAt: now.Unix(),
	}}
	report := BuildUpstreamParityReport(1, "uterroute", rows, now)
	require.Len(t, report.Models, 1)
	require.Equal(t, UpstreamParityPurchaseUnverified, report.Models[0].Status)
	require.True(t, report.Models[0].HasOfficialEstimate)
	require.Equal(t, 1, report.PurchaseUnverified)
	require.Equal(t, 0, report.Summary[UpstreamParityFullyMatched])
	require.Contains(t, report.Models[0].Reasons[0], "purchase cost is not operator-verified")
}
