package controller

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/pkg/billingexpr"
	"github.com/uter-ai/uter/service"
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

func TestApikoImageTierExpression(t *testing.T) {
	model := apikoModel{
		ID:           "nano-banana-2",
		Capabilities: []string{"image"},
		Pricing: apikoPricing{
			PerCall: apikoFloatPtr(0.0146986),
			Tiers: []jsonTier{
				{Name: "1k", PerCall: apikoFloatPtr(0.0146986)},
				{Name: "2k", PerCall: apikoFloatPtr(0.0157485)},
				{Name: "4k", PerCall: apikoFloatPtr(0.0167984)},
			},
		},
	}
	expr, ok := apikoPriceExpression(model)
	require.True(t, ok)
	assert.Contains(t, expr, `param("size") == "1024x1024"`)
	assert.Contains(t, expr, `param("parameters.resolution") == "1k"`)
	assert.Contains(t, expr, `tier("1k", fixed(0.0146986)) * image_count`)
	assert.Contains(t, expr, `tier("4k", fixed(0.0167984)) * image_count`)
	_, err := billingexpr.CompileFromCache(expr)
	require.NoError(t, err)
	// 未知/缺失参数落到最高档（4k），不会少收。
	assert.True(t, strings.HasSuffix(expr, `tier("4k", fixed(0.0167984)) * image_count`))
}

func TestApikoImageTierExpressionSupportsOnePointFiveK(t *testing.T) {
	model := apikoModel{
		ID:           "seedream-5.5",
		Capabilities: []string{"image"},
		Pricing: apikoPricing{
			Tiers: []jsonTier{
				{Name: "1K", PerCall: apikoFloatPtr(0.0208)},
				{Name: "1.5K", PerCall: apikoFloatPtr(0.0208)},
				{Name: "2K", PerCall: apikoFloatPtr(0.0364)},
			},
		},
	}
	expr, ok := apikoPriceExpression(model)
	require.True(t, ok)
	assert.Contains(t, expr, `param("size") == "1536x1536"`)
	assert.True(t, strings.HasSuffix(expr, `tier("2K", fixed(0.0364)) * image_count`))
	_, err := billingexpr.CompileFromCache(expr)
	require.NoError(t, err)
}

func TestApikoTokenPricingWinsOverResolutionTiers(t *testing.T) {
	model := apikoModel{
		ID:           "gpt-image-2",
		Capabilities: []string{"image"},
		Pricing: apikoPricing{
			Tiers:      []jsonTier{{Name: "1k", PerCall: apikoFloatPtr(0.042336)}},
			TokenImage: &apikoTokenImage{TextInputPer1M: apikoFloatPtr(4), ImageInputPer1M: apikoFloatPtr(6.4), OutputPer1M: apikoFloatPtr(24)},
		},
	}
	expr, ok := apikoPriceExpression(model)
	require.True(t, ok)
	assert.Equal(t, `tier("base", p * 4 + img * 6.4 + c * 24)`, expr)
}

func TestApikoSkipsPricingThatNeedsRequestParameters(t *testing.T) {
	// 分辨率档或时长档无法从表达式看到请求参数，宁可不报价也不猜。
	resolutionTiered := apikoModel{
		ID:           "unmapped-image",
		Capabilities: []string{"image"},
		Pricing:      apikoPricing{PerCall: apikoFloatPtr(0.042336), Tiers: []jsonTier{{Name: "standard", PerCall: apikoFloatPtr(0.042336)}}},
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

func TestFetchApikoCatalogueModelIDs(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/public/models" {
			http.NotFound(writer, request)
			return
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"code":0,"message":"ok","data":{"total":3,"models":[
			{"id":"model-b"},{"id":"model-a"},{"id":"model-b"}
		]}}`))
	}))
	t.Cleanup(server.Close)

	previous := apikoControlPlaneBase
	apikoControlPlaneBase = server.URL
	t.Cleanup(func() { apikoControlPlaneBase = previous })

	ids, err := fetchApikoCatalogueModelIDs("https://api.apiko.app")
	require.NoError(t, err)
	assert.Equal(t, []string{"model-a", "model-b"}, ids)

	// A blank base URL keeps working: a channel created with the default
	// address must still sync.
	ids, err = fetchApikoCatalogueModelIDs("")
	require.NoError(t, err)
	assert.Equal(t, []string{"model-a", "model-b"}, ids)

	_, err = fetchApikoCatalogueModelIDs("https://example.com")
	require.Error(t, err)
}

func TestFetchChannelUpstreamModelIDsUsesApikoCatalogue(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"code":0,"message":"ok","data":{"models":[{"id":"apiko-video"},{"id":"apiko-chat"}]}}`))
	}))
	t.Cleanup(server.Close)

	previous := apikoControlPlaneBase
	apikoControlPlaneBase = server.URL
	t.Cleanup(func() { apikoControlPlaneBase = previous })

	base := "https://api.apiko.app"
	ids, err := fetchChannelUpstreamModelIDs(&model.Channel{
		Type: constant.ChannelTypeApiko, BaseURL: &base,
	})
	require.NoError(t, err)
	assert.Equal(t, []string{"apiko-chat", "apiko-video"}, ids)
}

func TestMergeApikoModelIDs(t *testing.T) {
	merged, added := mergeApikoModelIDs(
		[]string{"manual-model", " apiko-chat "},
		[]string{"apiko-chat", "apiko-video", "apiko-video"},
	)
	assert.Equal(t, []string{"manual-model", "apiko-chat", "apiko-video"}, merged)
	assert.Equal(t, 1, added)

	merged, added = mergeApikoModelIDs(merged, []string{"apiko-chat", "apiko-video"})
	assert.Equal(t, 0, added)
	assert.Len(t, merged, 3)
}

func TestSyncApikoChannelModelsAddsCatalogueModels(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"code":0,"message":"ok","data":{"models":[{"id":"apiko-chat"},{"id":"apiko-video"}]}}`))
	}))
	t.Cleanup(server.Close)
	previous := apikoControlPlaneBase
	apikoControlPlaneBase = server.URL
	t.Cleanup(func() { apikoControlPlaneBase = previous })

	base := "https://api.apiko.app"
	channel := &model.Channel{
		Type: constant.ChannelTypeApiko, Name: "apiko", BaseURL: &base,
		Models: "manual-model", Group: "default", Status: 1,
	}
	require.NoError(t, db.Create(channel).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/channel/%d/apiko/models/sync", channel.Id), nil)
	ctx.Params = gin.Params{{Key: "id", Value: fmt.Sprintf("%d", channel.Id)}}

	SyncApikoChannelModels(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var stored model.Channel
	require.NoError(t, db.First(&stored, channel.Id).Error)
	assert.Equal(t, "manual-model,apiko-chat,apiko-video", stored.Models)
	assert.Contains(t, recorder.Body.String(), `"added":2`)
}

func TestFetchApikoModelIDsPrefersCatalogue(t *testing.T) {
	authCalls := 0
	auth := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		authCalls++
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"data":[{"id":"auth-only"}]}`))
	}))
	t.Cleanup(auth.Close)

	catalogue := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"code":0,"message":"ok","data":{"total":1,"models":[{"id":"catalogue-only"}]}}`))
	}))
	t.Cleanup(catalogue.Close)
	previous := apikoControlPlaneBase
	apikoControlPlaneBase = catalogue.URL
	t.Cleanup(func() { apikoControlPlaneBase = previous })

	base := auth.URL
	channel := &model.Channel{Type: constant.ChannelTypeApiko, Key: "sk-test", BaseURL: &base}
	ids, err := fetchApikoModelIDs(channel)
	require.NoError(t, err)
	assert.Equal(t, []string{"catalogue-only"}, ids)
	assert.Zero(t, authCalls, "the key-scoped list must not replace the full catalogue")
}

func TestFetchApikoModelIDsFallsBackToAuthenticatedList(t *testing.T) {
	auth := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/v1/models" {
			http.NotFound(writer, request)
			return
		}
		if request.Header.Get("Authorization") != "Bearer sk-test" {
			writer.WriteHeader(http.StatusUnauthorized)
			return
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"data":[{"id":"z-model"},{"id":"a-model"}]}`))
	}))
	t.Cleanup(auth.Close)

	catalogue := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(catalogue.Close)
	previous := apikoControlPlaneBase
	apikoControlPlaneBase = catalogue.URL
	t.Cleanup(func() { apikoControlPlaneBase = previous })

	previousFetch := apikoFetchModelsResponse
	apikoFetchModelsResponse = func(method, requestURL string, _ *model.Channel, headers http.Header) ([]byte, error) {
		request, err := http.NewRequest(method, requestURL, nil)
		if err != nil {
			return nil, err
		}
		request.Header = headers.Clone()
		response, err := (&http.Client{Timeout: 10 * time.Second}).Do(request)
		if err != nil {
			return nil, err
		}
		defer response.Body.Close()
		if response.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("status %d", response.StatusCode)
		}
		return io.ReadAll(response.Body)
	}
	t.Cleanup(func() { apikoFetchModelsResponse = previousFetch })

	base := auth.URL
	channel := &model.Channel{Type: constant.ChannelTypeApiko, Key: "sk-test", BaseURL: &base}
	ids, err := fetchApikoModelIDs(channel)
	require.NoError(t, err)
	assert.Equal(t, []string{"a-model", "z-model"}, ids)
}

func TestApikoRemovedModelsOnlyDropsPreviouslyCataloguedModels(t *testing.T) {
	previous := []string{"model-a", "model-b", "model-c"}
	current := []string{"model-a", "model-c", "model-new"}
	removed := apikoRemovedModels(previous, current)
	require.True(t, removed["model-b"])
	require.False(t, removed["model-a"])

	existing := []string{"model-a", "model-b", "manual-alias", "model-c"}
	filtered := filterApikoModels(existing, removed)
	require.Equal(t, []string{"model-a", "manual-alias", "model-c"}, filtered,
		"manual aliases never present in a prior catalogue snapshot must survive")
}

func TestSyncApikoChannelPricingWritesChannelScopedPrices(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.ChannelModelPricing{}, &model.ChannelPricingHistory{}))

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"code":0,"message":"ok","data":{"models":[
			{"id":"apiko-chat","capabilities":["chat"],"pricing":{"inputPer1M":1.25,"outputPer1M":5,"cachePer1M":0.125,"currency":"USD"}},
			{"id":"apiko-video","capabilities":["video"],"pricing":{"perSecondTiers":[{"name":"720p","perSecond":0.07}],"currency":"USD"}}
		]}}`))
	}))
	t.Cleanup(server.Close)
	previous := apikoControlPlaneBase
	apikoControlPlaneBase = server.URL
	t.Cleanup(func() { apikoControlPlaneBase = previous })

	base := "https://api.apiko.app"
	channel := &model.Channel{
		Type: constant.ChannelTypeApiko, Name: "apiko", BaseURL: &base,
		Key: "test-key", Models: "apiko-chat", Group: "default", Status: 1,
	}
	require.NoError(t, db.Create(channel).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/channel/%d/apiko/prices/sync", channel.Id), nil)
	ctx.Params = gin.Params{{Key: "id", Value: fmt.Sprintf("%d", channel.Id)}}

	SyncApikoChannelPricing(ctx)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	identity := model.ChannelPricingIdentity{ChannelId: channel.Id, Provider: "apiko", ModelName: "apiko-chat"}
	row, err := model.GetChannelModelPricingFor(identity)
	require.NoError(t, err)
	var internal model.ChannelInternalPricing
	require.NoError(t, common.UnmarshalJsonStr(row.InternalPricing, &internal))
	require.NotNil(t, internal.InputUSDPerMillion)
	assert.InDelta(t, 1.25, *internal.InputUSDPerMillion, 1e-9)
	require.NotNil(t, internal.OutputUSDPerMillion)
	assert.InDelta(t, 5, *internal.OutputUSDPerMillion, 1e-9)

	effective := model.ResolveEffectiveChannelPricingFor(identity)
	require.True(t, effective.Billable)
	require.NotNil(t, effective.Pricing)
	assert.InDelta(t, 0.625, effective.Pricing.ModelRatio, 1e-9)
	require.NotNil(t, effective.Pricing.CompletionRatio)
	assert.InDelta(t, 4, *effective.Pricing.CompletionRatio, 1e-9)

	// The video model has no request-parameter-free price; it gets an official
	// row with a review reason instead of a first-tier guess.
	video, err := model.GetChannelModelPricingFor(model.ChannelPricingIdentity{
		ChannelId: channel.Id, Provider: "apiko", ModelName: "apiko-video",
	})
	require.NoError(t, err)
	assert.Empty(t, video.InternalPricing)
	var view model.ChannelOfficialPricing
	require.NoError(t, common.UnmarshalJsonStr(video.NormalizedPricing, &view))
	assert.True(t, view.NeedsReview)
	assert.Contains(t, view.ReviewReasons, "duration-tiered pricing requires request parameters")
}

func TestApikoChannelPricingRecordsUseExecutableExpression(t *testing.T) {
	models := []apikoModel{{
		ID: "gpt-a", Pricing: apikoPricing{
			InputPer1M: apikoFloatPtr(1), OutputPer1M: apikoFloatPtr(2),
		},
	}}
	records := apikoChannelPricingRecords(91, []string{"gpt-a", "missing"}, models, time.Unix(1000, 0))
	require.Len(t, records, 1)
	require.Equal(t, "apiko", records[0].Provider)
	require.Contains(t, records[0].InternalPricing, `"mode":"tiered_expr"`)
	require.Contains(t, records[0].InternalPricing, `"source":"apiko-expression"`)
	var view model.ChannelOfficialPricing
	require.NoError(t, common.UnmarshalJsonStr(records[0].NormalizedPricing, &view))
	require.Empty(t, view.Tiers, "Apiko publishes the channel quote, not the vendor list")
	require.Len(t, view.ChannelPriceTiers, 1)
	require.Equal(t, service.UpstreamExpressionExecutable, view.ExpressionStatus)
}

func TestApikoSyncBackoffAndPrimaryPriceChanges(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Option{}, &model.ChannelModelPricing{}))

	now := time.Now().UTC()
	require.False(t, apikoBackoffActive(7, now))
	recordApikoSyncFailure(7, now)
	require.True(t, apikoBackoffActive(7, now.Add(30*time.Second)))
	clearApikoSyncFailure(7)
	require.False(t, apikoBackoffActive(7, now))

	oldPricing, err := common.Marshal(model.ChannelOfficialPricing{
		Currency: "USD",
		Tiers:    []model.ChannelPricingTier{{Unit: "per_1m_token", InputPerMillionUSD: apikoFloatPtr(1.0)}},
	})
	require.NoError(t, err)
	require.NoError(t, db.Create(&model.ChannelModelPricing{
		ChannelId: 7, Provider: "apiko", ModelName: "apiko-chat",
		NormalizedPricing: string(oldPricing), PricingStatus: model.ChannelPricingStatusOfficialOnly,
	}).Error)

	newPricing, err := common.Marshal(model.ChannelOfficialPricing{
		Currency: "USD",
		Tiers:    []model.ChannelPricingTier{{Unit: "per_1m_token", InputPerMillionUSD: apikoFloatPtr(5.0)}},
	})
	require.NoError(t, err)
	changes := apikoOfficialPriceChanges(7, []model.ChannelOfficialPricingRecord{{
		ChannelId: 7, Provider: "apiko", ModelName: "apiko-chat", NormalizedPricing: string(newPricing),
	}})
	require.Len(t, changes, 1)
	assert.Equal(t, "apiko-chat", changes[0].ModelID)
	assert.InDelta(t, 1.0, *changes[0].Old, 1e-9)
	assert.InDelta(t, 5.0, *changes[0].New, 1e-9)
}
