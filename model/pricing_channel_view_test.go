package model

import (
	"fmt"
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
	insertPricingEndpointAbility(t, 1234, "review-model-with-stale-price")
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
	// Batch-synced review rows may still carry a stale internal price in the
	// database. The pricing view must ignore it just like an empty review row.
	staleReviewPrice, err := common.Marshal(ChannelInternalPricing{
		Mode:                ChannelPricingModePerMillionTokens,
		InputUSDPerMillion:  MoneyFromFloatPtr(float64Ptr(1)),
		OutputUSDPerMillion: MoneyFromFloatPtr(float64Ptr(4)),
		Source:              "batch",
	})
	require.NoError(t, err)
	require.NoError(t, DB.Create(&ChannelModelPricing{
		ChannelId:         1234,
		Provider:          "uterroute",
		ModelName:         "review-model-with-stale-price",
		InternalPricing:   string(staleReviewPrice),
		NormalizedPricing: normalized,
		PricingStatus:     ChannelPricingStatusNeedsReview,
	}).Error)
	encodedToken, err := common.Marshal(ChannelInternalPricing{
		Mode:                     ChannelPricingModePerMillionTokens,
		InputUSDPerMillion:       MoneyFromFloatPtr(float64Ptr(2)),
		OutputUSDPerMillion:      MoneyFromFloatPtr(float64Ptr(8)),
		CacheUSDPerMillion:       MoneyFromFloatPtr(float64Ptr(0.2)),
		CreateCacheUSDPerMillion: MoneyFromFloatPtr(float64Ptr(0.5)),
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

	staleReview := byName["review-model-with-stale-price"]
	staleEntry, ok := staleReview.ChannelPrices["优特精选"]
	require.True(t, ok)
	assert.Equal(t, -1, staleEntry.QuotaType, "a review row's stale internal price must not become billable")
	assert.Zero(t, staleEntry.ModelRatio)
	assert.Equal(t, ChannelPricingStatusNeedsReview, staleEntry.Status)
}

func TestPricingTopLevelUsesBestConfiguredChannelPriceView(t *testing.T) {
	resetPricingEndpointTestTables(t)
	require.NoError(t, DB.AutoMigrate(&ChannelModelPricing{}))
	for _, channel := range []struct {
		id   int
		name string
	}{
		{1401, "渠道 A"},
		{1402, "渠道 B"},
	} {
		require.NoError(t, DB.Create(&Channel{
			Id: channel.id, Type: constant.ChannelTypeUterRoute,
			Key: fmt.Sprintf("key-%d", channel.id), Status: common.ChannelStatusEnabled,
			Name: channel.name,
		}).Error)
		insertPricingEndpointAbility(t, channel.id, "best-channel-price-model")
	}
	encoded := func(input, output float64) string {
		raw, err := common.Marshal(ChannelInternalPricing{
			Mode:                ChannelPricingModePerMillionTokens,
			InputUSDPerMillion:  MoneyFromFloatPtr(float64Ptr(input)),
			OutputUSDPerMillion: MoneyFromFloatPtr(float64Ptr(output)),
			Source:              "uterroute-discount",
		})
		require.NoError(t, err)
		return string(raw)
	}
	for _, row := range []ChannelModelPricing{
		{ChannelId: 1401, Provider: "uterroute", ModelName: "best-channel-price-model",
			InternalPricing: encoded(2, 8), PricingStatus: ChannelPricingStatusConfigured},
		{ChannelId: 1402, Provider: "uterroute", ModelName: "best-channel-price-model",
			InternalPricing: encoded(1, 4), PricingStatus: ChannelPricingStatusConfigured},
	} {
		require.NoError(t, DB.Create(&row).Error)
	}
	InvalidatePricingCache()

	byName := map[string]Pricing{}
	for _, pricing := range GetPricing() {
		byName[pricing.ModelName] = pricing
	}
	pricing, ok := byName["best-channel-price-model"]
	require.True(t, ok)
	require.Len(t, pricing.ChannelPrices, 2)
	assert.Equal(t, "渠道 B", pricing.ChannelPriceName)
	assert.Equal(t, 0.5, pricing.ModelRatio)
	assert.Equal(t, 0.5, pricing.ChannelPrices["渠道 B"].ModelRatio)
	assert.Equal(t, 1.0, pricing.ChannelPrices["渠道 A"].ModelRatio)
}

func float64Ptr(v float64) *float64 {
	return &v
}

// Regression: non-Alibaba Bailian models store their help-center quote in
// ChannelPriceTiers. That is a channel price, so the plaza must not present it
// as an official reference price.
func TestChannelPricingOfficialViewIgnoresChannelPriceTiers(t *testing.T) {
	// 10 CNY input / 30 CNY output per million tokens, converted to USD at 7.3,
	// in the exact shape bailianOfficialPricing persists (Tiers empty).
	raw := `{"currency":"CNY","source_currency":"CNY","normalized_currency":"USD",` +
		`"price_kind":"CHANNEL_QUOTE","source":"https://help.aliyun.com/zh/model-studio/model-pricing",` +
		`"unit":"per_1m_token","tiers":[],` +
		`"channel_price":{"range_name":"Default","unit":"per_1m_token",` +
		`"input_per_million_usd":1.36986301369863,"output_per_million_usd":4.10958904109589},` +
		`"channel_price_tiers":[{"range_name":"Default","unit":"per_1m_token",` +
		`"input_per_million_usd":1.36986301369863,"output_per_million_usd":4.10958904109589}]}`
	view, err := channelPricingOfficialView(raw)
	require.Error(t, err, "Bailian channel quotes must not become official tiers")
	assert.Nil(t, view.tier)
	assert.Empty(t, view.unit)
}
