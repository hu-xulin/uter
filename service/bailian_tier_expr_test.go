package service

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/pkg/billingexpr"
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
