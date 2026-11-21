package service

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

func TestReconcileChannelUpstreamBillingExecutesRules(t *testing.T) {
	setupBatchPricingDB(t)
	valid := model.ChannelInternalPricing{
		Mode: model.ChannelPricingModeTieredExpr, BillingExpr: `tier("base", p * 1 + c * 2)`, Source: "newapi-expression",
	}
	invalid := model.ChannelInternalPricing{
		Mode: model.ChannelPricingModeTieredExpr, BillingExpr: `not valid (`, Source: "newapi-expression",
	}
	validRaw, err := common.Marshal(valid)
	require.NoError(t, err)
	invalidRaw, err := common.Marshal(invalid)
	require.NoError(t, err)
	_, err = model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{
		{ChannelId: 61, Provider: "newapi-compatible", ModelName: "valid", Currency: "USD", NormalizedPricing: `{}`, InternalPricing: string(validRaw), Source: "newapi:/api/pricing", FetchedAt: 100},
		{ChannelId: 61, Provider: "newapi-compatible", ModelName: "invalid", Currency: "USD", NormalizedPricing: `{}`, InternalPricing: string(invalidRaw), Source: "newapi:/api/pricing", FetchedAt: 100},
	})
	require.NoError(t, err)

	report, err := ReconcileChannelUpstreamBilling(61)
	require.NoError(t, err)
	require.Equal(t, UpstreamReconcilePartial, report.Status)
	require.Equal(t, 1, report.Summary[UpstreamReconcileRulesPassed])
	require.Equal(t, 1, report.Summary[UpstreamReconcileRuleFailed])
	require.Equal(t, "BLOCKED", report.UpstreamInvoice)
	require.NotEmpty(t, report.BlockedReason)
}
