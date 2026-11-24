package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
)

// Regression: the channel-filtered plaza view is built from a separate
// PricingChannelPrice map. It must describe the same pricing contract as the
// top-level fields -- an expression row has no flat ratio, so losing its
// billing_expr made every price on a tiered-expression channel render wrong.
func TestPricingChannelPricesCarryExpressionAndReviewStatus(t *testing.T) {
	resetPricingEndpointTestTables(t)
	require.NoError(t, DB.AutoMigrate(&ChannelModelPricing{}))

	require.NoError(t, DB.Create(&Channel{
		Id:     1234,
		Type:   constant.ChannelTypeUterRoute,
		Key:    "key-1234",
		Status: common.ChannelStatusEnabled,
		Name:   "优特精选",
	}).Error)
	insertPricingEndpointAbility(t, 1234, "expr-model")
	insertPricingEndpointAbility(t, 1234, "review-model")

	expr := `((tier("base", p * 10 + c * 50)) * 0.6) * 1.1`
	internal, err := common.Marshal(ChannelInternalPricing{
		Mode:        ChannelPricingModeTieredExpr,
		BillingExpr: expr,
		Source:      "uterroute-discount",
	})
	require.NoError(t, err)
	require.NoError(t, DB.Create(&ChannelModelPricing{
		ChannelId:       1234,
		Provider:        "uterroute",
		ModelName:       "expr-model",
		InternalPricing: string(internal),
		PricingStatus:   ChannelPricingStatusConfigured,
	}).Error)
	require.NoError(t, DB.Create(&ChannelModelPricing{
		ChannelId:     1234,
		Provider:      "uterroute",
		ModelName:     "review-model",
		PricingStatus: ChannelPricingStatusNeedsReview,
	}).Error)

	InvalidatePricingCache()
	byName := map[string]Pricing{}
	for _, pricing := range GetPricing() {
		byName[pricing.ModelName] = pricing
	}

	expression := byName["expr-model"]
	require.Equal(t, expr, expression.BillingExpr, "top-level view must keep the expression")
	entry, ok := expression.ChannelPrices["优特精选"]
	require.True(t, ok)
	assert.Equal(t, 4, entry.QuotaType)
	assert.Equal(t, expr, entry.BillingExpr, "per-channel view must carry the same expression")

	review := byName["review-model"]
	reviewEntry, ok := review.ChannelPrices["优特精选"]
	require.True(t, ok)
	assert.Equal(t, -1, reviewEntry.QuotaType)
	assert.Equal(t, ChannelPricingStatusNeedsReview, reviewEntry.Status, "review status must reach the channel view")
}
