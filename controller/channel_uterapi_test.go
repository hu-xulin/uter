package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
)

func setupUterAPIRecipeDB(t *testing.T) {
	t.Helper()
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(
		&model.ChannelModelPricing{}, &model.ChannelPricingHistory{},
		&model.Model{}, &model.Vendor{}, &model.Option{},
	))
}

func newUterAPISlotServer(t *testing.T) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		auth := r.Header.Get("Authorization")
		switch {
		case r.URL.Path == "/v1/models" && strings.HasPrefix(auth, "Bearer claude-"):
			_, _ = w.Write([]byte(`{"data":[{"id":"claude-a"}]}`))
		case r.URL.Path == "/v1/models" && strings.HasPrefix(auth, "Bearer codex-"):
			_, _ = w.Write([]byte(`{"data":[{"id":"gpt-a"}]}`))
		case r.URL.Path == "/v1/models":
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error":{"message":"bad key"}}`))
		case r.URL.Path == "/api/pricing":
			_, _ = w.Write([]byte(`{
				"success": true,
				"group_ratio": {"Claude-max": 2.5, "Codex Pro": 0.4},
				"group_display": {"Claude-max": {"name":"Claude Code · 标准（稳定）"}, "Codex Pro": {"name":"Codex · 标准（稳定）"}},
				"data": [
					{"model_name":"claude-a","billing_mode":"tiered_expr","billing_expr":"tier(\"base\", p * 1 + c * 2)"},
					{"model_name":"gpt-a","billing_mode":"tiered_expr","billing_expr":"tier(\"base\", p * 3 + c * 6)"}
				]
			}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(server.Close)
	previous := uterapiBaseURLForTest
	uterapiBaseURLForTest = server.URL
	t.Cleanup(func() { uterapiBaseURLForTest = previous })
	return server
}

func runUterAPICreate(t *testing.T, body string) *httptest.ResponseRecorder {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/uterapi", strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	CreateUterAPIChannels(ctx)
	return recorder
}

// 每个分组槽位独立密钥、独立渠道，并按分组倍率生成价格。
func TestCreateUterAPIChannelsCreatesOneChannelPerSlot(t *testing.T) {
	setupUterAPIRecipeDB(t)
	newUterAPISlotServer(t)

	recorder := runUterAPICreate(t, `{"slots":[
		{"name":"Uter.api-claude-标准","group":"Claude-max","keys":["claude-key"]},
		{"name":"Uter.api-codex-标准","group":"Codex Pro","keys":["codex-key"]}
	],"group":"default"}`)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	assert.Contains(t, recorder.Body.String(), `"created":2`)

	all, err := model.GetAllChannels(0, 100, true, true)
	require.NoError(t, err)
	byName := map[string]*model.Channel{}
	for _, ch := range all {
		byName[ch.Name] = ch
	}
	claude := byName["Uter.api-claude-标准"]
	codex := byName["Uter.api-codex-标准"]
	require.NotNil(t, claude)
	require.NotNil(t, codex)
	assert.Equal(t, constant.ChannelTypeUterAPI, claude.Type)
	assert.Equal(t, constant.ChannelTypeUterAPI, codex.Type)
	assert.Equal(t, "claude-a", claude.Models)
	assert.Equal(t, "gpt-a", codex.Models)
	claudeSettings := claude.GetOtherSettings()
	assert.True(t, claudeSettings.UpstreamModelUpdateCheckEnabled)
	assert.True(t, claudeSettings.UpstreamModelUpdateAutoSyncEnabled)

	claudeRow, err := model.GetChannelModelPricingFor(model.ChannelPricingIdentity{ChannelId: claude.Id, ModelName: "claude-a"})
	require.NoError(t, err)
	var claudeInternal model.ChannelInternalPricing
	require.NoError(t, common.UnmarshalJsonStr(claudeRow.InternalPricing, &claudeInternal))
	assert.Contains(t, claudeInternal.BillingExpr, "* 2.5")

	codexRow, err := model.GetChannelModelPricingFor(model.ChannelPricingIdentity{ChannelId: codex.Id, ModelName: "gpt-a"})
	require.NoError(t, err)
	var codexInternal model.ChannelInternalPricing
	require.NoError(t, common.UnmarshalJsonStr(codexRow.InternalPricing, &codexInternal))
	assert.Contains(t, codexInternal.BillingExpr, "* 0.4")
}

// 某个槽位密钥失效时，其他槽位仍然创建成功。
func TestCreateUterAPIChannelsReportsPerSlotFailure(t *testing.T) {
	setupUterAPIRecipeDB(t)
	newUterAPISlotServer(t)

	recorder := runUterAPICreate(t, `{"slots":[
		{"name":"Uter.api-claude-经济","group":"Claude-kiro","keys":["claude-key"]},
		{"name":"Uter.api-codex-企业","group":"Codex-企业稳定-专线毫秒响应","keys":["bad-key"]}
	]}`)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	assert.Contains(t, recorder.Body.String(), `"created":1`)
}

// 同一分组槽位可以放多把密钥，生成一个多密钥渠道，模型取并集。
func TestCreateUterAPIChannelsSupportsMultipleKeysInSlot(t *testing.T) {
	setupUterAPIRecipeDB(t)
	server := newUterAPISlotServer(t)
	_ = server

	recorder := runUterAPICreate(t, `{"slots":[
		{"name":"Uter.api-claude-高级","group":"Claude-稳定","keys":["claude-key-1","claude-key-2"]}
	]}`)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	all, err := model.GetAllChannels(0, 100, true, false)
	require.NoError(t, err)
	var created *model.Channel
	for _, ch := range all {
		if ch.Name == "Uter.api-claude-高级" {
			created = ch
		}
	}
	require.NotNil(t, created)
	assert.True(t, created.ChannelInfo.IsMultiKey)
	assert.Equal(t, 2, created.ChannelInfo.MultiKeySize)
	assert.Equal(t, "claude-key-1\nclaude-key-2", created.Key)
}
