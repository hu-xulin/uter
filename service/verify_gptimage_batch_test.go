package service

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

// A channel priced by an executable upstream expression must keep that
// expression under a batch markup. Flattening it to a per-1M amount would drop
// cache, image and tier dimensions the expression still bills.
func TestBatchPricingScalesTieredExpressionWithoutFlattening(t *testing.T) {
	setupBatchPricingDB(t)
	expr := `tier("short", p * 10 + c * 50 + cr * 0.25)`
	internal, err := common.Marshal(model.ChannelInternalPricing{
		Mode:        model.ChannelPricingModeTieredExpr,
		BillingExpr: expr,
		Source:      "newapi-expression",
	})
	require.NoError(t, err)
	official, err := common.Marshal(model.ChannelOfficialPricing{
		Currency:         "USD",
		Unit:             "expression",
		PriceKind:        "BILLING_EXPRESSION",
		BillingExpr:      expr,
		ExpressionStatus: "EXECUTABLE",
	})
	require.NoError(t, err)
	_, err = model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{{
		ChannelId:         7,
		Provider:          "newapi-compatible",
		ModelName:         "claude-fable-5",
		Currency:          "USD",
		OfficialPricing:   `{}`,
		NormalizedPricing: string(official),
		InternalPricing:   string(internal),
		Source:            "newapi:/api/pricing",
		FetchedAt:         time.Now().Unix(),
	}})
	require.NoError(t, err)

	preview, err := ApplyChannelBatchPricingWithOptions(7, BatchPricingOptions{
		Basis: BatchPricingBasisChannel, Mode: BatchPricingModeMarkup, Value: 0.1, DryRun: true,
	})
	require.NoError(t, err)
	require.Equal(t, 1, preview.Updated)
	require.Equal(t, model.ChannelPricingModeTieredExpr, preview.Items[0].Mode)
	require.Contains(t, preview.Items[0].BillingExpr, "tier(\"short\"")
	_, billable := model.ResolveChannelBillingPricing(7, "claude-fable-5")
	require.True(t, billable)
	before, ok := model.ResolveChannelBillingPricing(7, "claude-fable-5")
	require.True(t, ok)
	require.Equal(t, expr, before.BillingExpr, "dry run must not rewrite the expression")

	applied, err := ApplyChannelBatchPricingWithOptions(7, BatchPricingOptions{
		Basis: BatchPricingBasisChannel, Mode: BatchPricingModeMarkup, Value: 0.1,
	})
	require.NoError(t, err)
	require.Equal(t, 1, applied.Updated)
	after, ok := model.ResolveChannelBillingPricing(7, "claude-fable-5")
	require.True(t, ok)
	require.Equal(t, model.ChannelPricingModeTieredExpr, after.Mode)
	require.Contains(t, after.BillingExpr, "tier(\"short\"")
	require.NotEqual(t, expr, after.BillingExpr, "markup must scale the expression")
}
