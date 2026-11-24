package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/setting/billing_setting"
)

// Regression: the channel-filtered plaza view used to be built from a separate
// PricingChannelPrice map, while the top-level "all channels" card was built
// from another copy that global billing settings could overwrite. The same
// configured channel price therefore rendered two different prices. Both views
// must now come from channelPriceDisplayView and agree field for field.
func TestPricingChannelViewsShareOnePriceContract(t *testing.T) {
	resetPricingEndpointTestTables(t)
	require.NoError(t, DB.AutoMigrate(&ChannelModelPricing{}))

	require.NoError(t, DB.Create(&Channel{
		Id:     1234,
		Type:   constant.ChannelTypeUterRoute,
		Key:    "key-1234",
		Status: common.ChannelStatusEnabled,
		Name:   "优特精选",
	}).Error)

	expr := `((tier("base", p * 10 + c * 50 + cr * 1 + cc * 12.5)) * 0.6) * 1.1`
	// gpt-6-astra has a built-in global expression. A configured channel price
	// must win over it, otherwise "all channels" shows the catalogue expression
	// while the channel filter shows the real discounted channel expression.
	insertPricingEndpointAbility(t, 1234, "gpt-6-astra")
	insertPricingEndpointAbility(t, 1234, "review-model")
	insertPricingEndpointAbility(t, 1234, "token-model")

	encodedExpr, err := common.Marshal(ChannelInternalPricing{
		Mode:        ChannelPricingModeTieredExpr,
		BillingExpr: expr,
		Source:      "uterroute-discount",
	})
	require.NoError(t, err)
	normalized := `{"currency":"USD","unit":"expression","tiers":[{"range_name":"base","input_per_million_usd":10,"output_per_million_usd":50,"cache_per_million_usd":1,"create_cache_per_million_usd":12.5,"unit":"per_1m_token"}]}`
	require.NoError(t, DB.Create(&ChannelModelPricing{
		ChannelId:         1234,
		Provider:          "uterroute",
		ModelName:         "gpt-6-astra",
		InternalPricing:   string(encodedExpr),
		NormalizedPricing: normalized,
		PricingStatus:     ChannelPricingStatusConfigured,
	}).Error)
	require.NoError(t, DB.Create(&ChannelModelPricing{
		ChannelId:     1234,
		Provider:      "uterroute",
		ModelName:     "review-model",
		PricingStatus: ChannelPricingStatusNeedsReview,
	}).Error)
	encodedToken, err := common.Marshal(ChannelInternalPricing{
		Mode:                     ChannelPricingModePerMillionTokens,
		InputUSDPerMillion:       float64Ptr(2),
		OutputUSDPerMillion:      float64Ptr(8),
		CacheUSDPerMillion:       float64Ptr(0.2),
		CreateCacheUSDPerMillion: float64Ptr(0.5),
	})
	require.NoError(t, err)
	require.NoError(t, DB.Create(&ChannelModelPricing{
		ChannelId:         1234,
		Provider:          "uterroute",
		ModelName:         "token-model",
		InternalPricing:   string(encodedToken),
		NormalizedPricing: normalized,
		PricingStatus:     ChannelPricingStatusConfigured,
	}).Error)

	globalExpr, _ := billing_setting.GetBillingExpr("gpt-6-astra")
	require.NotEmpty(t, globalExpr, "fixture must exercise a model with a built-in global expression")
	require.NotEqual(t, globalExpr, expr)

	InvalidatePricingCache()
	byName := map[string]Pricing{}
	for _, pricing := range GetPricing() {
		byName[pricing.ModelName] = pricing
	}

	expression := byName["gpt-6-astra"]
	entry, ok := expression.ChannelPrices["优特精选"]
	require.True(t, ok)
	assert.Equal(t, expr, expression.BillingExpr, "channel expression must beat the built-in global expression")
	assert.Equal(t, expr, entry.BillingExpr)
	assert.Equal(t, billing_setting.BillingModeTieredExpr, expression.BillingMode)
	assert.Equal(t, billing_setting.BillingModeTieredExpr, entry.BillingMode)
	assert.Equal(t, 0, expression.QuotaType)
	assert.Equal(t, 0, entry.QuotaType)
	assert.True(t, expression.ChannelPricingTiered)
	assert.Equal(t, ChannelPricingStatusConfigured, expression.ChannelPricingStatus)
	assert.Equal(t, ChannelPricingStatusConfigured, entry.Status)
	assert.Equal(t, 5.0, expression.ChannelOfficialModelRatio)
	assert.Equal(t, 5.0, entry.OfficialModelRatio)
	assert.Equal(t, 5.0, expression.ChannelOfficialCompletionRatio)
	assert.Equal(t, 5.0, entry.OfficialCompletionRatio)
	assert.Equal(t, 0.1, expression.ChannelOfficialCacheRatio)
	assert.Equal(t, 0.1, entry.OfficialCacheRatio)
	assert.Equal(t, 1.25, expression.ChannelOfficialCreateCacheRatio)
	assert.Equal(t, 1.25, entry.OfficialCreateCacheRatio)

	token := byName["token-model"]
	tokenEntry, ok := token.ChannelPrices["优特精选"]
	require.True(t, ok)
	assert.Equal(t, token.QuotaType, tokenEntry.QuotaType)
	assert.Equal(t, token.ModelRatio, tokenEntry.ModelRatio)
	assert.Equal(t, token.CompletionRatio, tokenEntry.CompletionRatio)
	assert.Equal(t, token.CacheRatio, float64Ptr(tokenEntry.CacheRatio))
	assert.Equal(t, token.CreateCacheRatio, float64Ptr(tokenEntry.CreateCacheRatio))
	assert.Empty(t, token.BillingExpr, "flat channel token price must clear the global expression")

	review := byName["review-model"]
	reviewEntry, ok := review.ChannelPrices["优特精选"]
	require.True(t, ok)
	assert.Equal(t, -1, reviewEntry.QuotaType)
	assert.Equal(t, ChannelPricingStatusNeedsReview, reviewEntry.Status, "review status must reach the channel view")
}

func float64Ptr(v float64) *float64 {
	return &v
}
