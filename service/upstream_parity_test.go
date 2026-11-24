package service

import (
	"strings"
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
	salePrice := 2.2
	configured, _ := common.Marshal(model.ChannelInternalPricing{
		Mode:               model.ChannelPricingModePerMillionTokens,
		InputUSDPerMillion: model.MoneyFromFloatPtr(&salePrice), OutputUSDPerMillion: model.MoneyFromFloatPtr(&salePrice),
		Source: "bailian-official",
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
		{ModelName: "matched", LifecycleStatus: model.ChannelModelLifecycleActive, PricingStatus: model.ChannelPricingStatusConfigured, PricingSource: "bailian-official", NormalizedPricing: string(channelTier), InternalPricing: string(configured), PurchasePricing: string(verifiedPurchase), FetchedAt: now.Add(-time.Hour).Unix()},
		{ModelName: "stale", LifecycleStatus: model.ChannelModelLifecycleActive, PricingStatus: model.ChannelPricingStatusConfigured, PricingSource: "bailian-official", NormalizedPricing: string(channelTier), InternalPricing: string(configured), PurchasePricing: string(verifiedPurchase), FetchedAt: now.Add(-8 * 24 * time.Hour).Unix()},
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
	expectedSale := 2.2
	sale, _ := common.Marshal(model.ChannelInternalPricing{
		Mode:               model.ChannelPricingModePerMillionTokens,
		InputUSDPerMillion: model.MoneyFromFloatPtr(&expectedSale),
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

func verifiedParityPurchase(t *testing.T, input float64) string {
	t.Helper()
	raw, err := common.Marshal(model.ChannelPurchaseCost{
		Pricing: model.ChannelInternalPricing{
			Mode:               model.ChannelPricingModePerMillionTokens,
			InputUSDPerMillion: model.MoneyFromFloatPtr(&input),
		},
		Verified: true, Source: "contract",
	})
	require.NoError(t, err)
	return string(raw)
}

func TestParityAuditComparesEveryPriceDimension(t *testing.T) {
	now := time.Unix(2_000_000, 0)
	discount := 0.5
	officialInput, officialOutput, officialCache := 4.0, 10.0, 2.0
	channelInput, channelOutput, channelCache := 2.5, 5.0, 1.0 // input must be 2.0
	view, err := common.Marshal(model.ChannelOfficialPricing{
		Currency: "USD", Unit: "per_1m_token", PriceKind: "OFFICIAL_ABSOLUTE",
		DiscountRatio: &discount,
		Tiers: []model.ChannelPricingTier{{
			RangeName: "base", Unit: "per_1m_token",
			InputPerMillionUSD:  model.MoneyFromFloatPtr(&officialInput),
			OutputPerMillionUSD: model.MoneyFromFloatPtr(&officialOutput),
			CachePerMillionUSD:  model.MoneyFromFloatPtr(&officialCache),
		}},
		ChannelPrice: &model.ChannelPricingTier{
			RangeName: "channel", Unit: "per_1m_token",
			InputPerMillionUSD:  model.MoneyFromFloatPtr(&channelInput),
			OutputPerMillionUSD: model.MoneyFromFloatPtr(&channelOutput),
			CachePerMillionUSD:  model.MoneyFromFloatPtr(&channelCache),
		},
	})
	require.NoError(t, err)
	saleInput, saleOutput, saleCache := 2.75, 5.5, 1.1
	internal, err := common.Marshal(model.ChannelInternalPricing{
		Mode: model.ChannelPricingModePerMillionTokens, Source: "uterroute-discount",
		InputUSDPerMillion:  model.MoneyFromFloatPtr(&saleInput),
		OutputUSDPerMillion: model.MoneyFromFloatPtr(&saleOutput),
		CacheUSDPerMillion:  model.MoneyFromFloatPtr(&saleCache),
	})
	require.NoError(t, err)
	row := model.ChannelModelPricing{
		ModelName: "dimension-mismatch", LifecycleStatus: model.ChannelModelLifecycleActive,
		PricingStatus: model.ChannelPricingStatusConfigured, PricingSource: "uterroute-official",
		NormalizedPricing: string(view), InternalPricing: string(internal),
		PurchasePricing: verifiedParityPurchase(t, 2), FetchedAt: now.Unix(),
	}

	report := BuildUpstreamParityReport(1, "uterroute", []model.ChannelModelPricing{row}, now)
	require.Len(t, report.Models, 1)
	require.Equal(t, UpstreamParityPriceMismatch, report.Models[0].Status)
	joined := strings.Join(report.Models[0].Reasons, " | ")
	require.Contains(t, joined, "channel input=2.5")
	require.Contains(t, joined, "official input=4 × discount=2")
	require.Len(t, report.Models[0].Dimensions, 3)
	inputDimension := report.Models[0].Dimensions[0]
	require.Equal(t, "input", inputDimension.Name)
	require.True(t, inputDimension.Mismatch)
	require.Equal(t, "4", inputDimension.OfficialUSD)
	require.Equal(t, "2", inputDimension.ExpectedChannelUSD)
	require.Equal(t, "2.5", inputDimension.ChannelUSD)
}

func TestParityAuditDetectsUnitAndTierShapeMismatch(t *testing.T) {
	now := time.Unix(2_000_000, 0)
	first, second := 1.0, 2.0
	view, err := common.Marshal(model.ChannelOfficialPricing{
		Currency: "USD", Unit: "per_1m_token", PriceKind: "OFFICIAL_ABSOLUTE",
		Tiers: []model.ChannelPricingTier{
			{RangeName: "short", Unit: "per_1m_token", InputPerMillionUSD: model.MoneyFromFloatPtr(&first)},
			{RangeName: "long", Unit: "per_1m_token", InputPerMillionUSD: model.MoneyFromFloatPtr(&second)},
		},
		ChannelPrice: &model.ChannelPricingTier{
			RangeName: "channel", Unit: "per_call", InputPerMillionUSD: model.MoneyFromFloatPtr(&first),
		},
	})
	require.NoError(t, err)
	internal, err := common.Marshal(model.ChannelInternalPricing{
		Mode: model.ChannelPricingModePerMillionTokens, InputUSDPerMillion: model.MoneyFromFloatPtr(&first),
	})
	require.NoError(t, err)
	row := model.ChannelModelPricing{
		ModelName: "shape-mismatch", LifecycleStatus: model.ChannelModelLifecycleActive,
		PricingStatus:     model.ChannelPricingStatusConfigured,
		NormalizedPricing: string(view), InternalPricing: string(internal),
		PurchasePricing: verifiedParityPurchase(t, 1), FetchedAt: now.Unix(),
	}

	report := BuildUpstreamParityReport(1, "test", []model.ChannelModelPricing{row}, now)
	require.Len(t, report.Models, 1)
	require.Equal(t, UpstreamParityRuleMismatch, report.Models[0].Status)
	joined := strings.Join(report.Models[0].Reasons, " | ")
	require.Contains(t, joined, "inconsistent units")
	require.Contains(t, joined, "collapsed into a single channel tier")
}

func TestParityAuditDoesNotOverrideExplicitOperatorSalePrice(t *testing.T) {
	now := time.Unix(2_000_000, 0)
	channelPrice := 2.0
	manualSale := 1.9
	view, err := common.Marshal(model.ChannelOfficialPricing{
		Currency: "USD", Unit: "per_1m_token", PriceKind: "CHANNEL_QUOTE",
		ChannelPriceTiers: []model.ChannelPricingTier{{
			RangeName: "base", Unit: "per_1m_token",
			InputPerMillionUSD: model.MoneyFromFloatPtr(&channelPrice),
		}},
	})
	require.NoError(t, err)
	internal, err := common.Marshal(model.ChannelInternalPricing{
		Mode:               model.ChannelPricingModePerMillionTokens,
		InputUSDPerMillion: model.MoneyFromFloatPtr(&manualSale), Source: "manual",
	})
	require.NoError(t, err)
	row := model.ChannelModelPricing{
		ModelName: "manual-price", LifecycleStatus: model.ChannelModelLifecycleActive,
		PricingStatus: model.ChannelPricingStatusConfigured, PricingSource: "manual",
		PricingOwner:      model.ChannelPricingOwnerOperator,
		NormalizedPricing: string(view), InternalPricing: string(internal),
		PurchasePricing: verifiedParityPurchase(t, 1.5), FetchedAt: now.Add(-30 * 24 * time.Hour).Unix(),
	}

	report := BuildUpstreamParityReport(1, "test", []model.ChannelModelPricing{row}, now)
	require.Len(t, report.Models, 1)
	require.False(t, report.Models[0].Stale, "manual prices do not expire with the upstream snapshot")
	require.Equal(t, UpstreamParityFullyMatched, report.Models[0].Status)
	require.Equal(t, "1.9", report.Models[0].Dimensions[0].SaleUSD)
	require.Empty(t, report.Models[0].Dimensions[0].ExpectedSaleUSD,
		"an explicit operator price must not be compared against the default markup")
}
