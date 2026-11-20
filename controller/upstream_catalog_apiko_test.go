package controller

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/pkg/billingexpr"
	"github.com/uter-ai/uter/setting/billing_setting"
)

func apikoFloatPtr(value float64) *float64 { return &value }

func TestApikoControlPlaneFor(t *testing.T) {
	for _, base := range []string{
		"https://api.apiko.app",
		"https://api.apiko.app/v1",
		"api.apiko.app",
		"https://apiko.app",
		"https://foo.apiko.app",
	} {
		control, ok := apikoControlPlaneFor(base)
		assert.True(t, ok, base)
		assert.Equal(t, apikoControlPlaneURL, control, base)
	}
	for _, base := range []string{
		"https://api.openai.com",
		"https://api.openai.com/v1",
		"https://apiko.example.com",
		"",
	} {
		_, ok := apikoControlPlaneFor(base)
		assert.False(t, ok, base)
	}
}

func TestApikoLinearTokenExpression(t *testing.T) {
	model := apikoModel{
		ID:           "claude-fable-5",
		Capabilities: []string{"chat"},
		Pricing: apikoPricing{
			InputPer1M:  apikoFloatPtr(2.25),
			OutputPer1M: apikoFloatPtr(11.2),
			CachePer1M:  apikoFloatPtr(0.225),
		},
	}
	expr, ok := apikoPriceExpression(model)
	require.True(t, ok)
	assert.Equal(t, `tier("base", p * 2.25 + c * 11.2 + cr * 0.225)`, expr)
	_, err := billingexpr.CompileFromCache(expr)
	require.NoError(t, err)
}

func TestApikoContextTierExpression(t *testing.T) {
	model := apikoModel{
		ID:           "claude-haiku-5-5",
		Capabilities: []string{"chat"},
		Pricing: apikoPricing{
			InputPer1M:  apikoFloatPtr(0.11),
			OutputPer1M: apikoFloatPtr(0.55),
			ContextTiers: []apikoContextTier{
				{UpTo: apikoFloatPtr(100000), InputPer1M: apikoFloatPtr(0.022), OutputPer1M: apikoFloatPtr(0.11)},
				{UpTo: nil, InputPer1M: apikoFloatPtr(0.11), OutputPer1M: apikoFloatPtr(0.55)},
			},
		},
	}
	expr, ok := apikoPriceExpression(model)
	require.True(t, ok)
	assert.Contains(t, expr, `len <= 100000`)
	assert.Contains(t, expr, `tier("tier_2"`)
	_, err := billingexpr.CompileFromCache(expr)
	require.NoError(t, err)
}

func TestApikoPerCallExpression(t *testing.T) {
	image := apikoModel{
		ID:           "doubao-seedream-5-0-pro",
		Capabilities: []string{"image"},
		Pricing: apikoPricing{
			PerCall: apikoFloatPtr(0.0337468),
		},
	}
	expr, ok := apikoPriceExpression(image)
	require.True(t, ok)
	// 图片按次必须乘以张数，否则 n>1 只收一张。
	assert.Equal(t, `tier("image", fixed(0.0337468)) * image_count`, expr)
	_, err := billingexpr.CompileFromCache(expr)
	require.NoError(t, err)

	request := apikoModel{
		ID:      "batch-job",
		Pricing: apikoPricing{PerCall: apikoFloatPtr(0.5)},
	}
	expr, ok = apikoPriceExpression(request)
	require.True(t, ok)
	assert.Equal(t, `tier("request", fixed(0.5))`, expr)
	_, err = billingexpr.CompileFromCache(expr)
	require.NoError(t, err)
}

func TestApikoTokenPricedImageExpression(t *testing.T) {
	model := apikoModel{
		ID:           "gpt-image-2",
		Capabilities: []string{"image"},
		Pricing: apikoPricing{
			TokenImage: &apikoTokenImage{
				TextInputPer1M:  apikoFloatPtr(4),
				ImageInputPer1M: apikoFloatPtr(6.4),
				OutputPer1M:     apikoFloatPtr(24),
			},
		},
	}
	expr, ok := apikoPriceExpression(model)
	require.True(t, ok)
	assert.Equal(t, `tier("base", p * 4 + img * 6.4 + c * 24)`, expr)
	_, err := billingexpr.CompileFromCache(expr)
	require.NoError(t, err)
}

func TestApikoSkipsPricingThatNeedsRequestParameters(t *testing.T) {
	// 分辨率档或时长档无法从表达式看到请求参数，宁可不报价也不猜。
	resolutionTiered := apikoModel{
		ID:      "gpt-image-2",
		Pricing: apikoPricing{PerCall: apikoFloatPtr(0.042336), Tiers: []jsonTier{{Name: "1k", PerCall: apikoFloatPtr(0.042336)}}},
	}
	_, ok := apikoPriceExpression(resolutionTiered)
	assert.False(t, ok)

	durationTiered := apikoModel{
		ID:      "gemini-omni-1.1-flash",
		Pricing: apikoPricing{PerSecondTiers: []jsonTier{{Name: "720p 4s", PerSecond: apikoFloatPtr(0.07875)}}},
	}
	_, ok = apikoPriceExpression(durationTiered)
	assert.False(t, ok)
}

func TestApikoModelsToPricingSyncData(t *testing.T) {
	models := []apikoModel{
		{ID: "a", Pricing: apikoPricing{InputPer1M: apikoFloatPtr(1), OutputPer1M: apikoFloatPtr(2)}},
		{ID: "b", Capabilities: []string{"video"}, Pricing: apikoPricing{PerSecondTiers: []jsonTier{{Name: "720p", PerSecond: apikoFloatPtr(1)}}}},
		{ID: "c", Pricing: apikoPricing{PerCall: apikoFloatPtr(0.5)}},
	}
	data, skipped, err := apikoModelsToPricingSyncData(models)
	require.NoError(t, err)
	require.Len(t, skipped, 1)
	assert.Equal(t, "b", skipped[0].Model)
	assert.Equal(t, "duration_tiered", skipped[0].Reason)

	modes := valueMap(data[billing_setting.BillingModeField])
	expressions := valueMap(data[billing_setting.BillingExprField])
	assert.Equal(t, billing_setting.BillingModeTieredExpr, modes["a"])
	assert.Equal(t, billing_setting.BillingModeTieredExpr, modes["c"])
	assert.NotContains(t, expressions, "b")
	assert.Equal(t, `tier("base", p * 1 + c * 2)`, expressions["a"])
}

func TestFetchApikoPricingData(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/public/models" {
			http.NotFound(writer, request)
			return
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"code":0,"message":"ok","data":{"total":1,"models":[
			{"id":"m1","provider":"openai","capabilities":["chat"],
			 "pricing":{"inputPer1M":1.5,"outputPer1M":6,"cachePer1M":0.15,"perCall":null,"tiers":[],"contextTiers":[],"currency":"USD"}}
		]}}`))
	}))
	t.Cleanup(server.Close)

	data, skipped, err := fetchApikoPricingData(context.Background(), server.URL)
	require.NoError(t, err)
	assert.Empty(t, skipped)
	assert.Equal(t, `tier("base", p * 1.5 + c * 6 + cr * 0.15)`, valueMap(data[billing_setting.BillingExprField])["m1"])
}

func TestApikoChannelDefaultBaseURLReachesControlPlane(t *testing.T) {
	base := constant.GetChannelBaseURL(constant.ChannelTypeApiko)
	require.NotEmpty(t, base)
	control, ok := apikoControlPlaneFor(base)
	require.True(t, ok)
	assert.Equal(t, apikoControlPlaneURL, control)
}
