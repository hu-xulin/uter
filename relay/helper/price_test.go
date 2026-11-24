package helper

import (
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/uter-ai/uter/model"
	"gorm.io/gorm"

	"net/http/httptest"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/i18n"
	"github.com/uter-ai/uter/pkg/billingexpr"
	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
	"github.com/uter-ai/uter/relaykit/types"
	"github.com/uter-ai/uter/service"
	"github.com/uter-ai/uter/setting/billing_setting"
	"github.com/uter-ai/uter/setting/config"
	"github.com/uter-ai/uter/setting/custom_pricing"
	"github.com/uter-ai/uter/setting/model_setting"
	"github.com/uter-ai/uter/setting/operation_setting"
	"github.com/uter-ai/uter/setting/ratio_setting"
	hosttypes "github.com/uter-ai/uter/types"
)

func TestModelPriceHelperTieredUsesPreloadedRequestInput(t *testing.T) {
	gin.SetMode(gin.TestMode)

	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})

	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": `{"tiered-test-model":"tiered_expr"}`,
		"billing_setting.billing_expr": `{"tiered-test-model":"param(\"stream\") == true ? tier(\"stream\", p * 3) : tier(\"base\", p * 2)"}`,
	}))

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodPost, "/api/channel/test/1", nil)
	req.Body = nil
	req.ContentLength = 0
	req.Header.Set("Content-Type", "application/json")
	ctx.Request = req
	ctx.Set("group", "default")

	info := &relaycommon.RelayInfo{
		OriginModelName: "tiered-test-model",
		UserGroup:       "default",
		UsingGroup:      "default",
		RequestHeaders:  map[string]string{"Content-Type": "application/json"},
		BillingRequestInput: &billingexpr.RequestInput{
			Headers: map[string]string{"Content-Type": "application/json"},
			Body:    []byte(`{"stream":true}`),
		},
	}

	priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{
		BillingRatios: map[string]float64{"n": 3},
	})
	require.NoError(t, err)
	require.Equal(t, 1500, priceData.QuotaToPreConsume)
	require.NotNil(t, info.TieredBillingSnapshot)
	require.Equal(t, "stream", info.TieredBillingSnapshot.EstimatedTier)
	require.Equal(t, billing_setting.BillingModeTieredExpr, info.TieredBillingSnapshot.BillingMode)
	require.Equal(t, common.QuotaPerUnit, info.TieredBillingSnapshot.QuotaPerUnit)
}

func TestFixedPricePreConsumeAndRealtimeRejection(t *testing.T) {
	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() { require.NoError(t, config.GlobalConfig.LoadFromDB(saved)) })
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode":    `{"fixed-test":"tiered_expr"}`,
		"billing_setting.billing_expr":    `{"fixed-test":"len <= 32000 ? tier(\"short\", fixed(0.01)) : tier(\"long\", p * 2)"}`,
		"group_ratio_setting.group_ratio": `{"default":1.5}`,
	}))
	for _, tc := range []struct {
		name      string
		format    types.RelayFormat
		prompt    int
		wantError bool
	}{
		{"HTTP charges once", types.RelayFormatOpenAI, 0, false},
		{"Realtime rejects even unselected fixed branch", types.RelayFormatOpenAIRealtime, 50000, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
			info := &relaycommon.RelayInfo{OriginModelName: "fixed-test", UserGroup: "default", UsingGroup: "default", RelayFormat: tc.format, BillingRequestInput: &billingexpr.RequestInput{}}
			price, err := ModelPriceHelper(ctx, info, tc.prompt, &types.TokenCountMeta{})
			if tc.wantError {
				require.ErrorContains(t, err, "Realtime")
				assert.Nil(t, info.TieredBillingSnapshot)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, 7500, price.QuotaToPreConsume)
			require.NotNil(t, info.TieredBillingSnapshot)
			assert.Equal(t, billingexpr.BillingUnitRequest, info.TieredBillingSnapshot.EstimatedBillingUnit)
			require.NotNil(t, info.TieredBillingSnapshot.EstimatedFixedPrice)
			assert.Equal(t, 0.01, *info.TieredBillingSnapshot.EstimatedFixedPrice)
		})
	}
}

func TestModelPriceHelperTieredInputPreConsumeMultiplier(t *testing.T) {
	gin.SetMode(gin.TestMode)

	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})

	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode":    `{"tiered-fallback-model":"tiered_expr"}`,
		"billing_setting.billing_expr":    `{"tiered-fallback-model":"len <= 1200 ? tier(\"base\", p * 3 + c * 15) : tier(\"long\", p * 30 + c * 150)"}`,
		"group_ratio_setting.group_ratio": `{"default":1,"free":0}`,
	}))

	cases := []struct {
		name       string
		group      string
		prompt     int
		maxTokens  int
		multiplier float64
		expected   int
	}{
		{"default uses only input", "default", 1000, 0, 1, 1500},
		{"explicit output limit does not increase reservation", "default", 1000, 100, 1, 1500},
		{"fraction below one", "default", 1000, 0, 0.5, 750},
		{"fraction above one preserves context tier", "default", 1000, 0, 2.5, 3750},
		{"small input has no token floor", "default", 100, 0, 1, 150},
		{"zero input", "default", 0, 100, 1, 0},
		{"free group", "free", 1000, 0, 2.5, 0},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
			req.Header.Set("Content-Type", "application/json")
			ctx.Request = req
			ctx.Set("group", tc.group)

			info := &relaycommon.RelayInfo{
				OriginModelName: "tiered-fallback-model",
				UserGroup:       tc.group,
				UsingGroup:      tc.group,
				RequestHeaders:  map[string]string{"Content-Type": "application/json"},
				BillingRequestInput: &billingexpr.RequestInput{
					Headers: map[string]string{"Content-Type": "application/json"},
					Body:    []byte(`{}`),
				},
			}

			operation_setting.GetQuotaSetting().PreConsumeMultiplier = tc.multiplier
			priceData, err := ModelPriceHelper(ctx, info, tc.prompt, &types.TokenCountMeta{MaxTokens: tc.maxTokens})
			require.NoError(t, err)
			assert.Equal(t, tc.expected, priceData.QuotaToPreConsume)
			require.NotNil(t, info.TieredBillingSnapshot)
			actual, err := billingexpr.ComputeTieredQuotaWithRequest(info.TieredBillingSnapshot, billingexpr.TokenParams{P: 1000, C: 100, Len: 1000}, *info.BillingRequestInput)
			require.NoError(t, err)
			wantActual := 2250
			if tc.group == "free" {
				wantActual = 0
			}
			assert.Equal(t, wantActual, actual.ActualQuotaAfterGroup, "reservation multiplier must not change settlement")
		})
	}
}

func TestModelPriceHelperTieredRejectsPreConsumeOverflow(t *testing.T) {
	gin.SetMode(gin.TestMode)

	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})

	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode":    `{"tiered-overflow-model":"tiered_expr"}`,
		"billing_setting.billing_expr":    `{"tiered-overflow-model":"tier(\"overflow\", p * 100000000000000000)"}`,
		"group_ratio_setting.group_ratio": `{"default":1}`,
	}))

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Set("group", "default")
	info := &relaycommon.RelayInfo{
		OriginModelName: "tiered-overflow-model",
		UserGroup:       "default",
		UsingGroup:      "default",
		BillingRequestInput: &billingexpr.RequestInput{
			Body: []byte(`{}`),
		},
	}

	_, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})

	var clamp *common.QuotaClamp
	require.ErrorAs(t, err, &clamp)
	require.Equal(t, "QuotaRound", clamp.Op)
	require.Equal(t, common.QuotaClampOverflow, clamp.Kind)
}

func TestModelPriceHelperRequestBillingRatiosOnlyApplyToFixedPrice(t *testing.T) {
	gin.SetMode(gin.TestMode)
	savedModelPrices := ratio_setting.ModelPrice2JSONString()
	savedModelRatios := ratio_setting.ModelRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(savedModelPrices))
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(savedModelRatios))
	})

	modelPrices, err := common.Marshal(map[string]float64{
		"fixed-image-price":      0.04,
		"fractional-image-price": 0.0000012,
		"overflow-image-price":   float64(common.MaxQuota) / common.QuotaPerUnit / 2,
	})
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(string(modelPrices)))
	modelRatios, err := common.Marshal(map[string]float64{"ratio-image-price": 15})
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(string(modelRatios)))

	tests := []struct {
		name           string
		model          string
		wantQuota      int
		wantUsePrice   bool
		wantImageCount bool
	}{
		{
			name:           "fixed price applies image count",
			model:          "fixed-image-price",
			wantQuota:      180000,
			wantUsePrice:   true,
			wantImageCount: true,
		},
		{
			name:         "ratio price ignores request billing ratios",
			model:        "ratio-image-price",
			wantQuota:    15000,
			wantUsePrice: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			ctx.Set("group", "default")
			info := &relaycommon.RelayInfo{
				OriginModelName: tt.model,
				UserGroup:       "default",
				UsingGroup:      "default",
			}
			meta := &types.TokenCountMeta{
				ImagePriceRatio: 3,
				BillingRatios:   map[string]float64{"n": 3},
			}

			priceData, err := ModelPriceHelper(ctx, info, 1000, meta)

			require.NoError(t, err)
			require.Equal(t, tt.wantQuota, priceData.QuotaToPreConsume)
			require.Equal(t, tt.wantUsePrice, priceData.UsePrice)
			require.Equal(t, tt.wantImageCount, priceData.HasOtherRatio("n"))
			require.Equal(t, priceData.OtherRatios(), info.PriceData.OtherRatios())
		})
	}

	newInfo := func(model string) (*gin.Context, *relaycommon.RelayInfo) {
		ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
		ctx.Set("group", "default")
		return ctx, &relaycommon.RelayInfo{
			OriginModelName: model,
			UserGroup:       "default",
			UsingGroup:      "default",
		}
	}
	meta := &types.TokenCountMeta{BillingRatios: map[string]float64{"n": 3}}

	ctx, info := newInfo("fractional-image-price")
	priceData, err := ModelPriceHelper(ctx, info, 0, meta)
	require.NoError(t, err)
	// 0.0000012 * 500000 * 3 = 1.8, then truncate once to 1.
	require.Equal(t, 1, priceData.QuotaToPreConsume)

	ctx, info = newInfo("overflow-image-price")
	_, err = ModelPriceHelper(ctx, info, 0, meta)
	var clamp *common.QuotaClamp
	require.ErrorAs(t, err, &clamp)
	require.Equal(t, "QuotaFromFloat", clamp.Op)
	require.Equal(t, common.QuotaClampOverflow, clamp.Kind)
	require.Nil(t, info.Billing)
}

// Pricing identity is resolved once in ModelPriceHelper via the candidate
// ladder: raw name (only when it has no @ modifiers) → canonical
// base@effort:E@thinking:S → base@thinking:S → base. Each level is looked up
// after FormatMatchingModelName wildcard normalization. A hit on the raw
// gemini-2.5-flash-thinking-* wildcard must keep the client origin as the
// consume-log name.
func TestModelPriceHelperUsesSuffixedOriginLikeMain(t *testing.T) {
	gin.SetMode(gin.TestMode)

	savedRatios := ratio_setting.ModelRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(savedRatios))
	})
	ratios := ratio_setting.GetModelRatioCopy()
	ratios["gemini-2.5-flash"] = 0.15
	ratios["gemini-2.5-flash-thinking-*"] = 0.075
	ratioJSON, err := common.Marshal(ratios)
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(string(ratioJSON)))

	oldSelfUse := operation_setting.SelfUseModeEnabled
	operation_setting.SelfUseModeEnabled = true
	t.Cleanup(func() { operation_setting.SelfUseModeEnabled = oldSelfUse })

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("group", "default")

	suffixed := &relaycommon.RelayInfo{
		OriginModelName: "gemini-2.5-flash-thinking-8192",
		UserGroup:       "default",
		UsingGroup:      "default",
	}
	suffixedPrice, err := ModelPriceHelper(ctx, suffixed, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	assert.Empty(t, suffixed.BillingModelName)
	assert.Equal(t, "gemini-2.5-flash-thinking-8192", suffixed.GetBillingModelName())
	assert.Equal(t, 0.075, suffixedPrice.ModelRatio)

	geminiSettings := model_setting.GetGeminiSettings()
	oldThinking := geminiSettings.ThinkingAdapterEnabled
	geminiSettings.ThinkingAdapterEnabled = true
	t.Cleanup(func() { geminiSettings.ThinkingAdapterEnabled = oldThinking })

	adapterOn := &relaycommon.RelayInfo{
		OriginModelName: "gemini-2.5-flash-thinking-8192",
		UserGroup:       "default",
		UsingGroup:      "default",
	}
	adapterOnPrice, err := ModelPriceHelper(ctx, adapterOn, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	assert.Empty(t, adapterOn.BillingModelName)
	assert.Equal(t, "gemini-2.5-flash-thinking-8192", adapterOn.GetBillingModelName())
	assert.Equal(t, 0.075, adapterOnPrice.ModelRatio)

	base := &relaycommon.RelayInfo{
		OriginModelName: "gemini-2.5-flash",
		UserGroup:       "default",
		UsingGroup:      "default",
	}
	basePrice, err := ModelPriceHelper(ctx, base, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	assert.Empty(t, base.BillingModelName)
	assert.Equal(t, "gemini-2.5-flash", base.GetBillingModelName())
	assert.Equal(t, 0.15, basePrice.ModelRatio)
}

func TestModelPriceHelperHonorsCustomClaudeThinkingAlias(t *testing.T) {
	gin.SetMode(gin.TestMode)

	savedRatios := ratio_setting.ModelRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(savedRatios))
	})
	ratios := ratio_setting.GetModelRatioCopy()
	ratios["claude-3-7-sonnet"] = 1.5
	ratios["claude-3-7-sonnet-thinking"] = 3.0
	ratioJSON, err := common.Marshal(ratios)
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(string(ratioJSON)))

	oldSelfUse := operation_setting.SelfUseModeEnabled
	operation_setting.SelfUseModeEnabled = false
	t.Cleanup(func() { operation_setting.SelfUseModeEnabled = oldSelfUse })

	claudeSettings := model_setting.GetClaudeSettings()
	oldThinking := claudeSettings.ThinkingAdapterEnabled
	claudeSettings.ThinkingAdapterEnabled = true
	t.Cleanup(func() { claudeSettings.ThinkingAdapterEnabled = oldThinking })

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("group", "default")
	info := &relaycommon.RelayInfo{
		OriginModelName: "claude-3-7-sonnet-thinking",
		UserGroup:       "default",
		UsingGroup:      "default",
	}
	priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	assert.Empty(t, info.BillingModelName)
	assert.Equal(t, "claude-3-7-sonnet-thinking", info.GetBillingModelName())
	assert.Equal(t, 3.0, priceData.ModelRatio)
}

func TestModelPriceHelperCanonicalBillingLadder(t *testing.T) {
	gin.SetMode(gin.TestMode)

	savedRatios := ratio_setting.ModelRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(savedRatios))
	})
	oldSelfUse := operation_setting.SelfUseModeEnabled
	operation_setting.SelfUseModeEnabled = false
	t.Cleanup(func() { operation_setting.SelfUseModeEnabled = oldSelfUse })

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("group", "default")

	t.Run("level2 full form", func(t *testing.T) {
		ratios := ratio_setting.GetModelRatioCopy()
		delete(ratios, "qwen3-max")
		ratios["qwen3-max@effort:high@thinking:on"] = 4.0
		ratios["qwen3-max@thinking:on"] = 3.0
		ratioJSON, err := common.Marshal(ratios)
		require.NoError(t, err)
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(string(ratioJSON)))

		info := &relaycommon.RelayInfo{
			OriginModelName: "qwen3-max@thinking:on@effort:high@temperature:0.2",
			UserGroup:       "default",
			UsingGroup:      "default",
		}
		priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
		require.NoError(t, err)
		assert.Equal(t, "qwen3-max@effort:high@thinking:on", info.BillingModelName)
		assert.Equal(t, 4.0, priceData.ModelRatio)
	})

	t.Run("level3 thinking form shuffled budget", func(t *testing.T) {
		ratios := ratio_setting.GetModelRatioCopy()
		delete(ratios, "qwen3-max")
		delete(ratios, "qwen3-max@effort:high@thinking:on")
		ratios["qwen3-max@thinking:on"] = 3.0
		ratioJSON, err := common.Marshal(ratios)
		require.NoError(t, err)
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(string(ratioJSON)))

		info := &relaycommon.RelayInfo{
			OriginModelName: "qwen3-max@temperature:0.3@thinking:8192",
			UserGroup:       "default",
			UsingGroup:      "default",
		}
		priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
		require.NoError(t, err)
		assert.Equal(t, "qwen3-max@thinking:on", info.BillingModelName)
		assert.Equal(t, 3.0, priceData.ModelRatio)
	})

	t.Run("level4 base fallback", func(t *testing.T) {
		ratios := ratio_setting.GetModelRatioCopy()
		delete(ratios, "qwen3-max@thinking:on")
		delete(ratios, "qwen3-max@effort:high@thinking:on")
		ratios["qwen3-max"] = 1.25
		ratioJSON, err := common.Marshal(ratios)
		require.NoError(t, err)
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(string(ratioJSON)))

		info := &relaycommon.RelayInfo{
			OriginModelName: "qwen3-max@thinking:off",
			UserGroup:       "default",
			UsingGroup:      "default",
		}
		priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
		require.NoError(t, err)
		assert.Equal(t, "qwen3-max", info.BillingModelName)
		assert.Equal(t, 1.25, priceData.ModelRatio)
	})

	t.Run("thinking minus one bills as on", func(t *testing.T) {
		ratios := ratio_setting.GetModelRatioCopy()
		ratios["qwen3-max@thinking:on"] = 3.0
		ratioJSON, err := common.Marshal(ratios)
		require.NoError(t, err)
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(string(ratioJSON)))

		info := &relaycommon.RelayInfo{
			OriginModelName: "qwen3-max@thinking:-1",
			UserGroup:       "default",
			UsingGroup:      "default",
		}
		priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
		require.NoError(t, err)
		assert.Equal(t, "qwen3-max@thinking:on", info.BillingModelName)
		assert.Equal(t, 3.0, priceData.ModelRatio)
	})
}

func TestModelPriceHelperMigratesLegacyGeminiWildcardToCanonical(t *testing.T) {
	gin.SetMode(gin.TestMode)

	savedRatios := ratio_setting.ModelRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(savedRatios))
	})
	ratios := ratio_setting.GetModelRatioCopy()
	delete(ratios, "gemini-2.5-flash-thinking-*")
	ratios["gemini-2.5-flash"] = 0.15
	ratios["gemini-2.5-flash@thinking:on"] = 0.09
	ratioJSON, err := common.Marshal(ratios)
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(string(ratioJSON)))

	oldSelfUse := operation_setting.SelfUseModeEnabled
	operation_setting.SelfUseModeEnabled = false
	t.Cleanup(func() { operation_setting.SelfUseModeEnabled = oldSelfUse })

	geminiSettings := model_setting.GetGeminiSettings()
	oldThinking := geminiSettings.ThinkingAdapterEnabled
	geminiSettings.ThinkingAdapterEnabled = true
	t.Cleanup(func() { geminiSettings.ThinkingAdapterEnabled = oldThinking })

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("group", "default")
	info := &relaycommon.RelayInfo{
		OriginModelName: "gemini-2.5-flash-thinking-8192",
		UserGroup:       "default",
		UsingGroup:      "default",
	}
	priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	assert.Equal(t, "gemini-2.5-flash@thinking:on", info.BillingModelName)
	assert.Equal(t, 0.09, priceData.ModelRatio)
}

func TestModelPriceHelperModifierNameFallsBackToBase(t *testing.T) {
	gin.SetMode(gin.TestMode)

	savedRatios := ratio_setting.ModelRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(savedRatios))
	})
	ratios := ratio_setting.GetModelRatioCopy()
	ratios["qwen3.8-max"] = 2.0
	ratioJSON, err := common.Marshal(ratios)
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(string(ratioJSON)))

	oldSelfUse := operation_setting.SelfUseModeEnabled
	operation_setting.SelfUseModeEnabled = false
	t.Cleanup(func() { operation_setting.SelfUseModeEnabled = oldSelfUse })

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("group", "default")
	info := &relaycommon.RelayInfo{
		OriginModelName: "qwen3.8-max@thinking:on@temperature:0.2",
		UserGroup:       "default",
		UsingGroup:      "default",
	}
	priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	assert.Equal(t, "qwen3.8-max", info.BillingModelName)
	assert.Equal(t, 2.0, priceData.ModelRatio)
}

func TestModelPriceHelperExemptAtNameBillsVerbatim(t *testing.T) {
	gin.SetMode(gin.TestMode)

	settings := model_setting.GetGlobalSettings()
	originalBlacklist := append([]string(nil), settings.ThinkingModelBlacklist...)
	t.Cleanup(func() { settings.ThinkingModelBlacklist = originalBlacklist })
	settings.ThinkingModelBlacklist = append(originalBlacklist, "re:.*@sha256:.*")

	savedRatios := ratio_setting.ModelRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(savedRatios))
	})
	ratios := ratio_setting.GetModelRatioCopy()
	ratios["opaque"] = 1.0
	ratios["opaque@sha256:deadbeef"] = 7.0
	ratioJSON, err := common.Marshal(ratios)
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(string(ratioJSON)))

	oldSelfUse := operation_setting.SelfUseModeEnabled
	operation_setting.SelfUseModeEnabled = false
	t.Cleanup(func() { operation_setting.SelfUseModeEnabled = oldSelfUse })

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("group", "default")
	info := &relaycommon.RelayInfo{
		OriginModelName: "opaque@sha256:deadbeef",
		UserGroup:       "default",
		UsingGroup:      "default",
	}
	priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	assert.Empty(t, info.BillingModelName)
	assert.Equal(t, "opaque@sha256:deadbeef", info.GetBillingModelName())
	assert.Equal(t, 7.0, priceData.ModelRatio)
}

func TestModelPriceHelperPreservesGpt51CodexMaxIdentity(t *testing.T) {
	gin.SetMode(gin.TestMode)

	savedRatios := ratio_setting.ModelRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(savedRatios))
	})
	ratios := ratio_setting.GetModelRatioCopy()
	ratios["gpt-5.1-codex-max"] = 1.75
	ratios["gpt-5.1-codex"] = 9.9
	ratioJSON, err := common.Marshal(ratios)
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(string(ratioJSON)))

	oldSelfUse := operation_setting.SelfUseModeEnabled
	operation_setting.SelfUseModeEnabled = false
	t.Cleanup(func() { operation_setting.SelfUseModeEnabled = oldSelfUse })

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("group", "default")
	info := &relaycommon.RelayInfo{
		OriginModelName: "gpt-5.1-codex-max",
		UserGroup:       "default",
		UsingGroup:      "default",
	}
	priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	assert.Empty(t, info.BillingModelName)
	assert.Equal(t, "gpt-5.1-codex-max", info.GetBillingModelName())
	assert.Equal(t, 1.75, priceData.ModelRatio)
}

// DeepSeek thinking tails and @ modifiers bill at the base model's built-in
// expression; a name on the thinking-suffix blacklist stays opaque and needs
// its own price.
func TestModelPriceHelperDeepSeekThinkingTailsBillAtBase(t *testing.T) {
	gin.SetMode(gin.TestMode)
	require.NoError(t, i18n.Init())
	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() { require.NoError(t, config.GlobalConfig.LoadFromDB(saved)) })
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": `{}`,
		"billing_setting.billing_expr": `{}`,
	}))
	oldSelfUse := operation_setting.SelfUseModeEnabled
	operation_setting.SelfUseModeEnabled = false
	t.Cleanup(func() { operation_setting.SelfUseModeEnabled = oldSelfUse })
	settings := model_setting.GetGlobalSettings()
	originalBlacklist := append([]string(nil), settings.ThinkingModelBlacklist...)
	t.Cleanup(func() { settings.ThinkingModelBlacklist = originalBlacklist })
	settings.ThinkingModelBlacklist = append(originalBlacklist, "deepseek-v4-pro-max")

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Set("group", "default")
	for origin, base := range map[string]string{
		"deepseek-flash-none":           "deepseek-flash",
		"deepseek-flash-low":            "deepseek-flash",
		"deepseek-flash-max":            "deepseek-flash",
		"deepseek-v4-pro-low":           "deepseek-v4-pro",
		"deepseek-flash@effort:max":     "deepseek-flash",
		"deepseek-flash-max@effort:low": "deepseek-flash",
		"deepseek-v4-pro@thinking:off":  "deepseek-v4-pro",
	} {
		info := &relaycommon.RelayInfo{
			OriginModelName: origin, UserGroup: "default", UsingGroup: "default",
			BillingRequestInput: &billingexpr.RequestInput{Body: []byte(`{}`)},
		}
		_, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
		require.NoError(t, err, origin)
		assert.Equal(t, base, info.BillingModelName, origin)
		expression, _ := billing_setting.GetBuiltinBillingExpr(base)
		require.NotNil(t, info.TieredBillingSnapshot, origin)
		assert.Equal(t, expression, info.TieredBillingSnapshot.ExprString, origin)
	}

	info := &relaycommon.RelayInfo{OriginModelName: "deepseek-v4-pro-max", UserGroup: "default", UsingGroup: "default"}
	_, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
	require.Error(t, err)
	assert.Equal(t, "deepseek-v4-pro-max", info.GetBillingModelName())
}

func TestModelPriceHelperNativeGeminiNoThinkingDoesNotAliasBillingModel(t *testing.T) {
	gin.SetMode(gin.TestMode)

	savedRatios := ratio_setting.ModelRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(savedRatios))
	})
	ratios := ratio_setting.GetModelRatioCopy()
	ratios["gemini-3-pro"] = 1.25
	ratioJSON, err := common.Marshal(ratios)
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(string(ratioJSON)))

	oldSelfUse := operation_setting.SelfUseModeEnabled
	operation_setting.SelfUseModeEnabled = true
	t.Cleanup(func() { operation_setting.SelfUseModeEnabled = oldSelfUse })

	geminiSettings := model_setting.GetGeminiSettings()
	oldThinking := geminiSettings.ThinkingAdapterEnabled
	geminiSettings.ThinkingAdapterEnabled = true
	t.Cleanup(func() { geminiSettings.ThinkingAdapterEnabled = oldThinking })

	budget := 0
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("group", "default")
	info := &relaycommon.RelayInfo{
		OriginModelName: "gemini-3-pro",
		UserGroup:       "default",
		UsingGroup:      "default",
		Request: &dto.GeminiChatRequest{
			GenerationConfig: dto.GeminiChatGenerationConfig{
				ThinkingConfig: &dto.GeminiThinkingConfig{
					ThinkingBudget: &budget,
				},
			},
		},
	}

	priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	assert.Empty(t, info.BillingModelName)
	assert.Equal(t, "gemini-3-pro", info.GetBillingModelName())
	assert.Equal(t, 1.25, priceData.ModelRatio)
	assert.NotEqual(t, 37.5, priceData.ModelRatio)
}

func TestInputPreConsumeMultiplierLegacyAndRequestPrices(t *testing.T) {
	previous := config.GlobalConfig.ExportAllConfigs()
	previousRatios, previousPrices := ratio_setting.ModelRatio2JSONString(), ratio_setting.ModelPrice2JSONString()
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(previous))
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(previousRatios))
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(previousPrices))
	})
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{"legacy-input-policy":1.5}`))
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{"request-input-policy":0.01}`))
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode":    `{"fixed-input-policy":"tiered_expr","image-input-policy":"tiered_expr"}`,
		"billing_setting.billing_expr":    `{"fixed-input-policy":"tier(\"request\", fixed(0.01))","image-input-policy":"tier(\"image\", p * 3) * image_count"}`,
		"group_ratio_setting.group_ratio": `{"default":1}`,
	}))
	for _, tc := range []struct {
		model        string
		multiplier   float64
		prompt, want int
	}{
		{"legacy-input-policy", 0.5, 100, 75},
		{"legacy-input-policy", 2.5, 100, 375},
		{"legacy-input-policy", 1, 0, 0},
		{"request-input-policy", 2.5, 100, 5000},
		{"fixed-input-policy", 2.5, 100, 5000},
		{"image-input-policy", 2.5, 100, 375},
	} {
		t.Run(tc.model+"/"+fmt.Sprint(tc.multiplier, "/", tc.prompt), func(t *testing.T) {
			operation_setting.GetQuotaSetting().PreConsumeMultiplier = tc.multiplier
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
			info := &relaycommon.RelayInfo{OriginModelName: tc.model, UserGroup: "default", UsingGroup: "default", BillingRequestInput: &billingexpr.RequestInput{}}
			price, err := ModelPriceHelper(ctx, info, tc.prompt, &types.TokenCountMeta{MaxTokens: 10000})
			require.NoError(t, err)
			assert.Equal(t, tc.want, price.QuotaToPreConsume)
			if tc.model == "image-input-policy" {
				reservation := &priceTestReservation{held: price.QuotaToPreConsume}
				info.Billing = reservation
				operation_setting.GetQuotaSetting().PreConsumeMultiplier = 10
				require.Nil(t, service.PrepareImageBillingForRequest(ctx, info, 2))
				assert.Equal(t, 750, reservation.held, "retry must reuse the original fractional multiplier")
			}
		})
	}
}

// priceTestReservation observes the reservation requested before image submission.
type priceTestReservation struct{ held int }

func (s *priceTestReservation) Settle(int) error         { return nil }
func (s *priceTestReservation) Refund(*gin.Context)      {}
func (s *priceTestReservation) NeedsRefund() bool        { return false }
func (s *priceTestReservation) GetPreConsumedQuota() int { return s.held }
func (s *priceTestReservation) Reserve(quota int) error  { s.held = max(s.held, quota); return nil }

func (s *priceTestReservation) ReserveBeforeSubmit(quota int) error { return s.Reserve(quota) }

func TestUpstreamPricingEngineMatchesRatioStack(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ratio_setting.InitRatioSettings()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("group", "default")

	newInfo := func(engine string) *relaycommon.RelayInfo {
		return &relaycommon.RelayInfo{
			OriginModelName: "gpt-4o",
			UserGroup:       "default",
			UsingGroup:      "default",
			ChannelMeta: &relaycommon.ChannelMeta{
				ChannelSetting: dto.ChannelSettings{PricingEngine: engine},
			},
		}
	}
	uterInfo, upstreamInfo := newInfo(""), newInfo("upstream")
	uterPrice, err := ModelPriceHelper(ctx, uterInfo, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	upstreamPrice, err := ModelPriceHelper(ctx, upstreamInfo, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)

	assert.Equal(t, uterPrice.QuotaToPreConsume, upstreamPrice.QuotaToPreConsume)
	assert.Equal(t, uterPrice.ModelRatio, upstreamPrice.ModelRatio)
	assert.Equal(t, uterPrice.CompletionRatio, upstreamPrice.CompletionRatio)
	assert.Equal(t, uterPrice.GroupRatioInfo.GroupRatio, upstreamPrice.GroupRatioInfo.GroupRatio)
}

func TestUpstreamPricingEngineMatchesPerCallStack(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ratio_setting.InitRatioSettings()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	ctx.Set("group", "default")

	newInfo := func(engine string) *relaycommon.RelayInfo {
		return &relaycommon.RelayInfo{
			OriginModelName: "dall-e-3",
			UserGroup:       "default",
			UsingGroup:      "default",
			ChannelMeta: &relaycommon.ChannelMeta{
				ChannelSetting: dto.ChannelSettings{PricingEngine: engine},
			},
		}
	}
	uterPrice, err := ModelPriceHelperPerCall(ctx, newInfo(""))
	require.NoError(t, err)
	upstreamPrice, err := ModelPriceHelperPerCall(ctx, newInfo("upstream"))
	require.NoError(t, err)

	assert.Equal(t, uterPrice.QuotaToPreConsume, upstreamPrice.QuotaToPreConsume)
	assert.Equal(t, uterPrice.UsePrice, upstreamPrice.UsePrice)
	assert.Equal(t, uterPrice.ModelPrice, upstreamPrice.ModelPrice)
}

func TestHandleGroupRatioAppliesChannelPricing(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ratio_setting.InitRatioSettings()

	saved := common.OptionMap
	common.OptionMap = map[string]string{
		custom_pricing.ChannelPriceOptionKey: `{
			"enabled": true,
			"channels": {
				"7": {
					"enabled": true,
					"ratio": 0.8,
					"models": {"gpt-4o": {"mode": "ratio", "value": 0.5}}
				}
			}
		}`,
	}
	t.Cleanup(func() { common.OptionMap = saved })

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set(string(constant.ContextKeyChannelId), 7)

	infoFor := func(name string) *relaycommon.RelayInfo {
		return &relaycommon.RelayInfo{
			OriginModelName: name,
			UserGroup:       "default",
			UsingGroup:      "default",
		}
	}

	// Model and channel discounts multiply: 0.8 * 0.5 = 0.4.
	modelRule := HandleGroupRatio(ctx, infoFor("gpt-4o"))
	require.InDelta(t, 0.4, modelRule.GroupRatio, 1e-9)

	// A model without its own rule inherits the channel-wide ratio.
	channelRule := HandleGroupRatio(ctx, infoFor("gpt-4o-mini"))
	require.InDelta(t, 0.8, channelRule.GroupRatio, 1e-9)
}

func TestModelPriceHelperUsesChannelIsolatedPricing(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ratio_setting.InitRatioSettings()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.ChannelModelPricing{}))
	previousDB := model.DB
	model.DB = db
	model.InvalidateChannelPricingCache()
	t.Cleanup(func() {
		model.DB = previousDB
		model.InvalidateChannelPricingCache()
	})

	_, err = model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{{
		ChannelId: 7,
		ModelName: "channel-priced-model",
		Currency:  "USD",
		Source:    "bailian-official",
	}})
	require.NoError(t, err)
	_, err = model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{{
		ChannelId: 8,
		ModelName: "channel-priced-model",
		Currency:  "USD",
		Source:    "bailian-official",
	}})
	require.NoError(t, err)

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Set("group", "default")
	info := &relaycommon.RelayInfo{
		OriginModelName: "channel-priced-model",
		UserGroup:       "default",
		UsingGroup:      "default",
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: 7},
	}

	_, err = ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
	require.Error(t, err)
	assert.True(t, isChannelPricingError(err), err.Error())

	require.NoError(t, model.SetChannelInternalPricing(7, "channel-priced-model", model.ChannelInternalPricing{
		Mode:                     model.ChannelPricingModePerMillionTokens,
		InputUSDPerMillion:       floatPtr(2),
		OutputUSDPerMillion:      floatPtr(4),
		CacheUSDPerMillion:       floatPtr(1),
		CreateCacheUSDPerMillion: floatPtr(2.5),
	}))
	priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	assert.InDelta(t, 1.0, priceData.ModelRatio, 1e-9)
	assert.InDelta(t, 2.0, priceData.CompletionRatio, 1e-9)
	assert.InDelta(t, 0.5, priceData.CacheRatio, 1e-9)
	assert.InDelta(t, 1.25, priceData.CacheCreationRatio, 1e-9)
	assert.False(t, priceData.UsePrice)
	assert.True(t, info.ChannelPricingApplied)
	assert.Equal(t, model.ChannelPricingModePerMillionTokens, info.ChannelPricingMode)

	// The same model on another channel has no internal price and must not
	// inherit channel 7's numbers.
	other := &relaycommon.RelayInfo{
		OriginModelName: "channel-priced-model",
		UserGroup:       "default",
		UsingGroup:      "default",
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: 8},
	}
	require.NoError(t, model.SetChannelInternalPricing(8, "channel-priced-model", model.ChannelInternalPricing{
		Mode:                model.ChannelPricingModePerMillionTokens,
		InputUSDPerMillion:  floatPtr(4),
		OutputUSDPerMillion: floatPtr(8),
		CacheUSDPerMillion:  floatPtr(2),
	}))
	otherPrice, err := ModelPriceHelper(ctx, other, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	assert.InDelta(t, 2.0, otherPrice.ModelRatio, 1e-9)
	assert.True(t, other.ChannelPricingApplied)
	assert.NotEqual(t, info.ChannelPricingVersion, other.ChannelPricingVersion)
}

func floatPtr(value float64) *model.Money { return model.MoneyFromFloatPtr(&value) }

func isChannelPricingError(err error) bool {
	text := err.Error()
	return strings.Contains(text, i18n.MsgRelayChannelPriceNotConfigured) ||
		strings.Contains(text, "internal sale price") ||
		strings.Contains(text, "内部销售价")
}

func TestModelPriceHelperAppliesGroupRatioOnceToChannelPricing(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ratio_setting.InitRatioSettings()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.ChannelModelPricing{}))
	previousDB := model.DB
	model.DB = db
	model.InvalidateChannelPricingCache()
	t.Cleanup(func() {
		model.DB = previousDB
		model.InvalidateChannelPricingCache()
	})

	_, err = model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{{
		ChannelId: 11, ModelName: "group-ratio-model", Currency: "USD", Source: "test",
	}})
	require.NoError(t, err)
	require.NoError(t, model.SetChannelInternalPricing(11, "group-ratio-model", model.ChannelInternalPricing{
		Mode:                model.ChannelPricingModePerMillionTokens,
		InputUSDPerMillion:  floatPtr(2),
		OutputUSDPerMillion: floatPtr(4),
	}))

	savedGroups := ratio_setting.GetGroupRatioCopy()
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":0.5}`))
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(mustGroupRatioJSON(savedGroups)))
	})

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Set("group", "vip")
	info := &relaycommon.RelayInfo{
		OriginModelName: "group-ratio-model",
		UserGroup:       "vip",
		UsingGroup:      "vip",
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: 11},
	}

	priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	assert.InDelta(t, 0.5, priceData.GroupRatioInfo.GroupRatio, 1e-9)
	assert.InDelta(t, 1.0, priceData.ModelRatio, 1e-9)

	multiplier, err := operation_setting.InputPreConsumeMultiplier()
	require.NoError(t, err)
	expected, err := common.QuotaFromFloatStrict(1000 * multiplier * 1.0 * 0.5)
	require.NoError(t, err)
	assert.Equal(t, expected, priceData.QuotaToPreConsume)
}

func TestModelPriceHelperPerCallHonorsChannelFixedPriceAndGroupRatio(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ratio_setting.InitRatioSettings()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.ChannelModelPricing{}))
	previousDB := model.DB
	model.DB = db
	model.InvalidateChannelPricingCache()
	t.Cleanup(func() {
		model.DB = previousDB
		model.InvalidateChannelPricingCache()
	})

	_, err = model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{{
		ChannelId: 12, ModelName: "fixed-call-model", Currency: "USD", Source: "test",
	}})
	require.NoError(t, err)
	require.NoError(t, model.SetChannelInternalPricing(12, "fixed-call-model", model.ChannelInternalPricing{
		Mode: model.ChannelPricingModePerCall, PerCallUSD: floatPtr(2),
	}))

	savedGroups := ratio_setting.GetGroupRatioCopy()
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":0.5}`))
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(mustGroupRatioJSON(savedGroups)))
	})

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	ctx.Set("group", "vip")
	info := &relaycommon.RelayInfo{
		OriginModelName: "fixed-call-model",
		UserGroup:       "vip",
		UsingGroup:      "vip",
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: 12},
	}

	priceData, err := ModelPriceHelperPerCall(ctx, info)
	require.NoError(t, err)
	assert.True(t, priceData.UsePrice)
	assert.InDelta(t, 2, priceData.ModelPrice, 1e-9)
	assert.InDelta(t, 0.5, priceData.GroupRatioInfo.GroupRatio, 1e-9)
	expected, err := common.QuotaFromFloatStrict(2 * common.QuotaPerUnit * 0.5)
	require.NoError(t, err)
	assert.Equal(t, expected, priceData.Quota)
}

func mustGroupRatioJSON(groups map[string]float64) string {
	encoded, err := common.Marshal(groups)
	if err != nil {
		panic(err)
	}
	return string(encoded)
}

// A channel with the same model priced per region must bill the region its
// request actually targets; another region's price is never a fallback.
func TestModelPriceHelperUsesRequestRegionIdentity(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.ChannelModelPricing{}))
	previous := model.DB
	model.DB = db
	model.InvalidateChannelPricingCache()
	t.Cleanup(func() {
		model.DB = previous
		model.InvalidateChannelPricingCache()
	})

	for _, item := range []struct {
		region string
		input  float64
	}{
		{"cn-beijing", 2},
		{"ap-southeast-1", 4},
	} {
		output := item.input * 2
		_, err := model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{{
			ChannelId: 7, Provider: "alibaba-bailian", Region: item.region, ModelName: "regional-model",
			Currency: "USD", Source: "bailian-official", FetchedAt: time.Now().Unix(),
		}})
		require.NoError(t, err)
		require.NoError(t, model.SetChannelInternalPricingFor(model.ChannelPricingIdentity{
			ChannelId: 7, Provider: "alibaba-bailian", Region: item.region, ModelName: "regional-model",
		}, model.ChannelInternalPricing{
			Mode: model.ChannelPricingModePerMillionTokens, InputUSDPerMillion: model.MoneyFromFloatPtr(&item.input), OutputUSDPerMillion: model.MoneyFromFloatPtr(&output),
		}))
	}

	priceFor := func(baseURL string) (hosttypes.PriceData, error) {
		ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
		ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
		ctx.Set("group", "default")
		info := &relaycommon.RelayInfo{
			OriginModelName: "regional-model",
			UserGroup:       "default",
			UsingGroup:      "default",
			ChannelMeta: &relaycommon.ChannelMeta{
				ChannelId: 7, ChannelType: constant.ChannelTypeAli, ChannelBaseUrl: baseURL,
			},
		}
		return ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
	}

	beijing, err := priceFor("https://ws-1.cn-beijing.maas.aliyuncs.com")
	require.NoError(t, err)
	assert.InDelta(t, 1.0, beijing.ModelRatio, 1e-9)

	singapore, err := priceFor("https://dashscope-intl.aliyuncs.com")
	require.NoError(t, err)
	assert.InDelta(t, 2.0, singapore.ModelRatio, 1e-9)

	_, err = priceFor("https://dashscope-us.aliyuncs.com")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "identity_missing")
}

func TestHandleGroupRatioSnapshotsUserPricingPolicy(t *testing.T) {
	common.OptionMapRWMutex.Lock()
	if common.OptionMap == nil {
		common.OptionMap = map[string]string{}
	}
	previous, had := common.OptionMap[custom_pricing.UserPriceOptionKey]
	common.OptionMap[custom_pricing.UserPriceOptionKey] = `{"enabled": true, "tiers": [{"min_amount": 0, "ratio": 0.8}]}`
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		if had {
			common.OptionMap[custom_pricing.UserPriceOptionKey] = previous
		} else {
			delete(common.OptionMap, custom_pricing.UserPriceOptionKey)
		}
		common.OptionMapRWMutex.Unlock()
	})

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{
		OriginModelName: "user-priced-model",
		UserGroup:       "default",
		UsingGroup:      "default",
		UserId:          0,
	}
	groupRatio := HandleGroupRatio(ctx, info)
	require.True(t, info.UserPricingApplied)
	assert.InDelta(t, 0.8, info.UserPricingRatio, 1e-9)
	assert.InDelta(t, 0.8, groupRatio.GroupRatio, 1e-9)
}

func TestModelPriceHelperSelectsDeploymentPricingIdentity(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ratio_setting.InitRatioSettings()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.ChannelModelPricing{}))
	previousDB := model.DB
	model.DB = db
	model.InvalidateChannelPricingCache()
	t.Cleanup(func() {
		model.DB = previousDB
		model.InvalidateChannelPricingCache()
	})

	input, output := 2.0, 4.0
	normalized, err := common.Marshal(model.ChannelOfficialPricing{
		Currency: "USD", Unit: "per_1m_token",
		Tiers: []model.ChannelPricingTier{{
			Unit: "per_1m_token", InputPerMillionUSD: model.MoneyFromFloatPtr(&input), OutputPerMillionUSD: model.MoneyFromFloatPtr(&output),
		}},
	})
	require.NoError(t, err)
	_, err = model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{
		{ChannelId: 21, Provider: "uter", DeploymentId: "dep-a", ModelName: "m", Currency: "USD", NormalizedPricing: string(normalized), Source: "uter"},
		{ChannelId: 21, Provider: "uter", DeploymentId: "dep-b", ModelName: "m", Currency: "USD", NormalizedPricing: string(normalized), Source: "uter"},
	})
	require.NoError(t, err)
	three := 3.0
	four := 4.0
	require.NoError(t, model.SetChannelInternalPricingFor(model.ChannelPricingIdentity{
		ChannelId: 21, Provider: "uter", DeploymentId: "dep-b", ModelName: "m",
	}, model.ChannelInternalPricing{
		Mode: model.ChannelPricingModePerMillionTokens, InputUSDPerMillion: model.MoneyFromFloatPtr(&three), OutputUSDPerMillion: model.MoneyFromFloatPtr(&four),
	}))

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{
		OriginModelName: "m", UserGroup: "default", UsingGroup: "default",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId: 21, ChannelType: 60, ChannelBaseUrl: "https://api.example.com",
			ChannelOtherSettings: dto.ChannelOtherSettings{DeploymentID: "dep-b"},
		},
	}
	priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	assert.InDelta(t, 1.5, priceData.ModelRatio, 1e-9)
	assert.Equal(t, "dep-b", info.ChannelPricingDeployment)
}
