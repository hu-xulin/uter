package controller

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/pkg/billingexpr"
	"github.com/uter-ai/uter/service"
)

// 四类创建渠道 — DreamRouter、阿里百炼、Apiko、xxapi — 的同步矩阵：
// 每个供应商都必须完成「模型信息 → 价格 → 计费规则可执行」三件事。
func TestProviderSyncMatrix(t *testing.T) {
	t.Run("dreamrouter", testDreamRouterSyncMatrix)
	t.Run("bailian", testBailianSyncMatrix)
	t.Run("apiko", testApikoSyncMatrix)
	t.Run("xxapi", testXXAPISyncMatrix)
}

func migrateProviderMatrixDB(t *testing.T) *gorm.DB {
	t.Helper()
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(
		&model.ChannelModelPricing{}, &model.ChannelPricingHistory{},
		&model.Model{}, &model.Vendor{}, &model.VendorMergeRule{}, &model.Option{},
	))
	return db
}

func newMatrixChannel(t *testing.T, db *gorm.DB, name string, channelType int, baseURL, key, models string) *model.Channel {
	t.Helper()
	base := baseURL
	channel := &model.Channel{
		Type: channelType, Name: name, BaseURL: &base, Key: key,
		Models: models, Group: "default", Status: 1,
	}
	require.NoError(t, db.Create(channel).Error)
	return channel
}

// assertBillingRule proves the resolved channel price is executable: either a
// positive ratio, or an expression that returns a positive quota for real usage.
func assertBillingRule(t *testing.T, channelID int, modelName string, params billingexpr.TokenParams, input billingexpr.RequestInput) {
	t.Helper()
	pricing, ok := model.ResolveChannelBillingPricing(channelID, modelName)
	require.True(t, ok, "%s must resolve to a billable channel price", modelName)
	if strings.TrimSpace(pricing.BillingExpr) == "" {
		assert.Greater(t, pricing.ModelRatio, 0.0, "%s must have a positive ratio", modelName)
		return
	}
	snapshot := &billingexpr.BillingSnapshot{
		BillingMode:  "tiered_expr",
		ExprString:   pricing.BillingExpr,
		ExprHash:     billingexpr.ExprHashString(pricing.BillingExpr),
		GroupRatio:   1,
		QuotaPerUnit: 500_000,
	}
	result, err := billingexpr.ComputeTieredQuotaWithRequest(snapshot, params, input)
	require.NoError(t, err, "%s expression must execute: %s", modelName, pricing.BillingExpr)
	assert.Positive(t, result.ActualQuotaAfterGroup, "%s must charge a positive quota", modelName)
}

func testDreamRouterSyncMatrix(t *testing.T) {
	db := migrateProviderMatrixDB(t)
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		assert.Equal(t, "/api/pricing", request.URL.Path)
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{
			"success": true, "pricing_version": "dr-v1",
			"group_ratio": {"default": 0.8},
			"vendors": [{"id": 7, "name": "Anthropic"}],
			"data": [
				{"model_name":"dr-token","vendor_id":7,"quota_type":0,"model_ratio":2,"completion_ratio":4,
				 "enable_groups":["default"],"supported_endpoint_types":["openai","anthropic"]},
				{"model_name":"dr-image","vendor_id":7,"quota_type":0,"billing_mode":"tiered_expr",
				 "billing_expr":"tier(\"image\", fixed(0.02)) * image_count",
				 "enable_groups":["default"],"supported_endpoint_types":["image-generation"]}
			]
		}`))
	}))
	t.Cleanup(server.Close)

	snapshot, err := service.FetchDreamRouterUpstream(context.Background(), server.URL)
	require.NoError(t, err)
	require.Len(t, snapshot.Models, 2)
	byName := map[string]service.UpstreamModelRecord{}
	for _, item := range snapshot.Models {
		byName[item.ModelName] = item
	}
	assert.Equal(t, "Anthropic", byName["dr-token"].VendorName)
	assert.Contains(t, byName["dr-token"].EnableGroups, "default")
	assert.Contains(t, byName["dr-token"].SupportedEndpoints, "openai")

	channel := newMatrixChannel(t, db, "dreamrouter", constant.ChannelTypeOpenAI, server.URL, "sk-test", "dr-token,dr-image")
	records, err := service.DreamRouterChannelPricingRecords(snapshot, channel.Id, []string{"dr-token", "dr-image"}, "default")
	require.NoError(t, err)
	require.Len(t, records, 2)
	recordsByName := map[string]model.ChannelOfficialPricingRecord{}
	for _, r := range records {
		recordsByName[r.ModelName] = r
	}
	_, err = model.UpsertChannelOfficialPricing(records)
	require.NoError(t, err)

	assertBillingRule(t, channel.Id, "dr-token", billingexpr.TokenParams{P: 1000, C: 500, Len: 1000}, billingexpr.RequestInput{})

	// An expression-only upstream rule is captured verbatim for review; Uter
	// does not auto-adopt it as the channel price, but it must execute.
	imagePricing := byName["dr-image"]
	require.NotEmpty(t, imagePricing.BillingExpr)
	two := 2
	imageSnapshot := &billingexpr.BillingSnapshot{
		BillingMode: "tiered_expr", ExprString: imagePricing.BillingExpr,
		ExprHash: billingexpr.ExprHashString(imagePricing.BillingExpr), GroupRatio: 1, QuotaPerUnit: 500_000,
	}
	imageResult, err := billingexpr.ComputeTieredQuotaWithRequest(imageSnapshot, billingexpr.TokenParams{}, billingexpr.RequestInput{ImageCount: &two})
	require.NoError(t, err)
	assert.Positive(t, imageResult.ActualQuotaAfterGroup)
}

func testBailianSyncMatrix(t *testing.T) {
	db := migrateProviderMatrixDB(t)
	pages := 0
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		pages++
		assert.Equal(t, "/api/v1/models", request.URL.Path)
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{
			"success": true,
			"output": {"total": 2, "page_no": 1, "page_size": 100, "models": [
				{"model":"qwen-plus","name":"Qwen Plus","provider":"qwen","capabilities":["text"],
				 "inference_provider":"aliyun-bailian",
				 "model_info":{"context_window":131072,"max_output_tokens":8192},
				 "inference_metadata":{"request_modality":"text","response_modality":"text"},
				 "prices":[{"range_name":"Default","prices":[
					{"type":"input_token","price":"0.0008","price_unit":"每千tokens"},
					{"type":"output_token","price":"0.002","price_unit":"每千tokens"}]}]},
				{"model":"qwen-vl","name":"Qwen VL","provider":"qwen","capabilities":["vision"],
				 "inference_provider":"aliyun-bailian",
				 "prices":[{"range_name":"Default","prices":[
					{"type":"input_token","price":"0.003","price_unit":"每千tokens"},
					{"type":"output_token","price":"0.009","price_unit":"每千tokens"}]}]}
			]}
		}`))
	}))
	t.Cleanup(server.Close)

	catalog, err := service.FetchBailianCatalog(context.Background(), server.URL, "sk-test")
	require.NoError(t, err)
	require.Len(t, catalog.Models, 2)
	assert.Equal(t, 1, pages, "a complete first page must stop pagination")

	channel := newMatrixChannel(t, db, "bailian", constant.ChannelTypeAli, server.URL, "sk-test", "qwen-plus,qwen-vl")
	catalog.ChannelID = channel.Id
	catalog.Region = service.BailianRegionBeijing
	catalog.ReferencePrice = service.NormalizeBailianPrices(catalog)

	applied, err := service.ApplyBailianCatalog(catalog, []string{"qwen-plus", "qwen-vl"})
	require.NoError(t, err)
	assert.Equal(t, 2, applied.MatchedModels)
	assert.NotEmpty(t, applied.Metadata.CreatedModels, "model metadata must be created")

	records := service.BailianPricingRecords(catalog, []string{"qwen-plus", "qwen-vl"})
	require.Len(t, records, 2)
	_, err = model.UpsertChannelOfficialPricing(records)
	require.NoError(t, err)
	seeded, _, err := service.SeedBailianInternalPricing(channel.Id, []string{"qwen-plus", "qwen-vl"}, false)
	require.NoError(t, err)
	assert.Equal(t, 2, seeded)

	assertBillingRule(t, channel.Id, "qwen-plus", billingexpr.TokenParams{P: 1000, C: 500, Len: 1000}, billingexpr.RequestInput{})
	assertBillingRule(t, channel.Id, "qwen-vl", billingexpr.TokenParams{P: 1000, C: 500, Len: 1000}, billingexpr.RequestInput{})
}

func testApikoSyncMatrix(t *testing.T) {
	db := migrateProviderMatrixDB(t)
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"code":0,"message":"ok","data":{"models":[
			{"id":"apiko-chat","capabilities":["chat"],"pricing":{"inputPer1M":1.25,"outputPer1M":5,"cachePer1M":0.125,"currency":"USD"}},
			{"id":"apiko-image","capabilities":["image"],"pricing":{"perCall":0.04,"currency":"USD"}}
		]}}`))
	}))
	t.Cleanup(server.Close)
	previous := apikoControlPlaneBase
	apikoControlPlaneBase = server.URL
	t.Cleanup(func() { apikoControlPlaneBase = previous })

	channel := newMatrixChannel(t, db, "apiko", constant.ChannelTypeApiko, "https://api.apiko.app", "sk-test", "manual-model")

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/channel/%d/apiko/models/sync", channel.Id), nil)
	ctx.Params = gin.Params{{Key: "id", Value: fmt.Sprintf("%d", channel.Id)}}
	SyncApikoChannelModels(ctx)

	stored, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	assert.Contains(t, stored.GetModels(), "manual-model")
	assert.Contains(t, stored.GetModels(), "apiko-chat")
	assert.Contains(t, stored.GetModels(), "apiko-image")

	ctx, _ = gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/channel/%d/apiko/prices/sync", channel.Id), nil)
	ctx.Params = gin.Params{{Key: "id", Value: fmt.Sprintf("%d", channel.Id)}}
	SyncApikoChannelPricing(ctx)

	assertBillingRule(t, channel.Id, "apiko-chat", billingexpr.TokenParams{P: 1000, C: 500, Len: 1000}, billingexpr.RequestInput{})
	two := 2
	assertBillingRule(t, channel.Id, "apiko-image", billingexpr.TokenParams{}, billingexpr.RequestInput{ImageCount: &two})
}

func testXXAPISyncMatrix(t *testing.T) {
	db := migrateProviderMatrixDB(t)
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"success":true,"pricing_version":"xx-v1","data":[
			{"model_name":"claude-sonnet-5","vendor_id":-1002,"billing_mode":"tiered_expr",
			 "billing_expr":"tier(\"standard\", p * 2 + cr * 0.2 + cc * 2.5 + cc1h * 4 + c * 10)",
			 "enable_groups":["Claude-稳定"],"supported_endpoint_types":["anthropic","openai"]},
			{"model_name":"gpt-image-2","vendor_id":-1012,"billing_mode":"tiered_expr",
			 "billing_expr":"tier(\"standard\", fixed(0.05)) * image_count",
			 "enable_groups":["image 图像"],"supported_endpoint_types":["image-generation","openai"]},
			{"model_name":"grok-4.5","vendor_id":-1014,"billing_mode":"tiered_expr",
			 "billing_expr":"len <= 200000 ? tier(\"0_200k\", p * 2 + cr * 0.3 + c * 6) : tier(\"200k_plus\", p * 4 + cr * 0.6 + c * 12)",
			 "enable_groups":["Grok-标准"],"supported_endpoint_types":["openai"]}
		]}`))
	}))
	t.Cleanup(server.Close)

	channel := newMatrixChannel(t, db, "xxapi", constant.ChannelTypeCustom, server.URL, "sk-placeholder", "")
	written, discovered, err := service.SyncGenericChannelPricingWithModels(context.Background(), channel)
	require.NoError(t, err)
	assert.Equal(t, 3, written)
	assert.Equal(t, []string{"claude-sonnet-5", "gpt-image-2", "grok-4.5"}, discovered)

	assertBillingRule(t, channel.Id, "claude-sonnet-5",
		billingexpr.TokenParams{P: 1000, C: 500, CR: 100, CC: 50, CC1h: 20, Len: 1000}, billingexpr.RequestInput{})
	two := 2
	assertBillingRule(t, channel.Id, "gpt-image-2", billingexpr.TokenParams{}, billingexpr.RequestInput{ImageCount: &two})
	assertBillingRule(t, channel.Id, "grok-4.5",
		billingexpr.TokenParams{P: 250000, C: 500, CR: 1000, Len: 250000}, billingexpr.RequestInput{})
}
