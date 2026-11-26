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
	"github.com/uter-ai/uter/relaykit/dto"
	"github.com/uter-ai/uter/service"
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
					{"model_name":"claude-a","enable_groups":["Claude-max","Claude-kiro","Claude-稳定","Codex Pro"],"billing_mode":"tiered_expr","billing_expr":"tier(\"base\", p * 1 + c * 2)"},
					{"model_name":"gpt-a","enable_groups":["Codex Pro"],"billing_mode":"tiered_expr","billing_expr":"tier(\"base\", p * 3 + c * 6)"}
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
	assert.Equal(t, dto.ChannelPricingModeScopedActive, claudeSettings.PricingMode)
	assert.Equal(t, common.ChannelStatusEnabled, claude.Status)
	assert.Equal(t, dto.ChannelPricingModeScopedActive, codex.GetOtherSettings().PricingMode)
	assert.Equal(t, common.ChannelStatusEnabled, codex.Status)

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

// 价格同步失败时渠道必须保持禁用，且声明为渠道独立定价待验证状态。
func TestCreateUterAPIChannelsKeepsChannelDisabledWhenPricingFails(t *testing.T) {
	setupUterAPIRecipeDB(t)
	// 第一次请求用于分组授权校验，第二次用于渠道价格同步；第二次失败模拟
	// “渠道已创建、价格同步失败”的真实场景。
	pricingCalls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/v1/models":
			_, _ = w.Write([]byte(`{"data":[{"id":"claude-a"}]}`))
		case "/api/pricing":
			pricingCalls++
			if pricingCalls != 2 {
				_, _ = w.Write([]byte(`{"success":true,"data":[
					{"model_name":"claude-a","enable_groups":["Claude-max"],
					 "billing_mode":"tiered_expr","billing_expr":"tier(\"base\", p * 1 + c * 2)"}
				],"group_ratio":{"Claude-max":2}}`))
				return
			}
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte(`{"error":"upstream down"}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(server.Close)
	previous := uterapiBaseURLForTest
	uterapiBaseURLForTest = server.URL
	t.Cleanup(func() { uterapiBaseURLForTest = previous })

	recorder := runUterAPICreate(t, `{"slots":[{"name":"failed-price","group":"Claude-max","keys":["claude-key"]}]}`)
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	assert.Contains(t, recorder.Body.String(), `"pricing_error"`)
	assert.Contains(t, recorder.Body.String(), `"pricing_verified":false`)

	all, err := model.GetAllChannels(0, 100, true, true)
	require.NoError(t, err)
	for _, channel := range all {
		if channel.Name != "failed-price" {
			continue
		}
		assert.Equal(t, 0, channel.Status)
		assert.Equal(t, dto.ChannelPricingModeScopedPending, channel.GetOtherSettings().PricingMode)
		return
	}
	t.Fatal("created channel not found")
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

// 创建接口必须接收向导生成的 -xc0 别名和映射，否则价格在保存后按上游原名
// 落库，渠道模型却是别名，最终表现为“0 个可计费 / 全部 missing”。
func TestCreateUterAPIChannelsPersistsXC0RedirectAlias(t *testing.T) {
	setupUterAPIRecipeDB(t)
	newUterAPISlotServer(t)

	recorder := runUterAPICreate(t, `{
		"slots":[{"name":"Uter.api-claude-xc0","group":"Claude-max","keys":["claude-key"]}],
		"group":"default",
		"models":"claude-a-xc0",
		"model_mapping":"{\"claude-a-xc0\":\"claude-a\"}"
	}`)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	assert.Contains(t, recorder.Body.String(), `"created":1`)
	assert.Contains(t, recorder.Body.String(), `"pricing_verified":true`)

	all, err := model.GetAllChannels(0, 100, true, false)
	require.NoError(t, err)
	var created *model.Channel
	for _, ch := range all {
		if ch.Name == "Uter.api-claude-xc0" {
			created = ch
		}
	}
	require.NotNil(t, created)
	assert.Equal(t, "claude-a-xc0", created.Models)
	assert.Equal(t, `{"claude-a-xc0":"claude-a"}`, created.GetModelMapping())

	row, err := model.GetChannelModelPricingFor(model.ChannelPricingIdentity{
		ChannelId: created.Id, ModelName: "claude-a-xc0",
	})
	require.NoError(t, err)
	assert.Equal(t, model.ChannelPricingStatusConfigured, row.PricingStatus)
}

// slot 没带 key 时，服务端用系统设置里的优特订阅 key 补齐。浏览器只拿到
// 掩码，明文补齐必须在服务端完成；operator 显式填的 key 始终优先。
func TestCreateUterAPIChannelsFillsKeyFromSystemSettings(t *testing.T) {
	setupUterAPIRecipeDB(t)
	newUterAPISlotServer(t)
	setChannelProviderOptionsForTest(t, map[string]string{
		service.ChannelProviderSubscriptionAPIKeyOption: "claude-stored-key",
	})

	// keys 完全省略，模拟前端提示「留空则使用系统设置中的 key」后的提交。
	recorder := runUterAPICreate(t, `{"slots":[
		{"name":"Uter.api-auto","group":"Claude-max","keys":[]}
	],"group":"default"}`)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	assert.Contains(t, recorder.Body.String(), `"created":1`)

	all, err := model.GetAllChannels(0, 100, true, false)
	require.NoError(t, err)
	var created *model.Channel
	for _, ch := range all {
		if ch.Name == "Uter.api-auto" {
			created = ch
		}
	}
	require.NotNil(t, created)
	assert.Equal(t, "claude-stored-key", created.Key)
	assert.Equal(t, "claude-a", created.Models)
}

// 多行订阅 key 按行拆分；不可用的行被 discovery 过滤，只留可用 key。
func TestCreateUterAPIChannelsFillsMultilineKeysFromSystemSettings(t *testing.T) {
	setupUterAPIRecipeDB(t)
	newUterAPISlotServer(t)
	setChannelProviderOptionsForTest(t, map[string]string{
		service.ChannelProviderSubscriptionAPIKeyOption: "bad-key\nclaude-stored-key",
	})

	recorder := runUterAPICreate(t, `{"slots":[
		{"name":"Uter.api-auto-multi","group":"Claude-max"}
	],"group":"default"}`)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	assert.Contains(t, recorder.Body.String(), `"created":1`)

	all, err := model.GetAllChannels(0, 100, true, false)
	require.NoError(t, err)
	var created *model.Channel
	for _, ch := range all {
		if ch.Name == "Uter.api-auto-multi" {
			created = ch
		}
	}
	require.NotNil(t, created)
	assert.Equal(t, "claude-stored-key", created.Key)
}

// operator 在向导里显式填的 key 必须压过系统设置，不被覆盖。
func TestCreateUterAPIChannelsExplicitKeyWinsOverSystemSettings(t *testing.T) {
	setupUterAPIRecipeDB(t)
	newUterAPISlotServer(t)
	setChannelProviderOptionsForTest(t, map[string]string{
		service.ChannelProviderSubscriptionAPIKeyOption: "claude-stored-key",
	})

	recorder := runUterAPICreate(t, `{"slots":[
		{"name":"Uter.api-explicit","group":"Claude-max","keys":["claude-operator-key"]}
	],"group":"default"}`)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	all, err := model.GetAllChannels(0, 100, true, false)
	require.NoError(t, err)
	var created *model.Channel
	for _, ch := range all {
		if ch.Name == "Uter.api-explicit" {
			created = ch
		}
	}
	require.NotNil(t, created)
	assert.Equal(t, "claude-operator-key", created.Key)
}

// 系统设置没配 key 且 slot 也没带 key 时不能凭空创建渠道。
func TestCreateUterAPIChannelsNoKeyNoCreate(t *testing.T) {
	setupUterAPIRecipeDB(t)
	newUterAPISlotServer(t)
	setChannelProviderOptionsForTest(t, map[string]string{
		service.ChannelProviderSubscriptionAPIKeyOption: "",
	})

	recorder := runUterAPICreate(t, `{"slots":[
		{"name":"Uter.api-nokey","group":"Claude-max"}
	],"group":"default"}`)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	all, err := model.GetAllChannels(0, 100, true, false)
	require.NoError(t, err)
	for _, ch := range all {
		assert.NotEqual(t, "Uter.api-nokey", ch.Name)
	}
}

func TestResolveUterAPICreateSlotsUsesSavedGroupMode(t *testing.T) {
	credentials := service.ChannelProviderCredentials{
		APIKey: "legacy-key",
		Slots: []service.ChannelProviderCredentialSlot{
			{
				ID:       "slot-economy",
				Group:    "Claude-max",
				Mode:     "batch",
				Strategy: "random",
				Keys:     []string{"claude-one", "claude-two"},
			},
			{
				ID:       "slot-codex",
				Group:    "Codex Pro",
				Mode:     "multi_to_single",
				Strategy: "polling",
				Keys:     []string{"codex-one", "codex-two"},
			},
		},
	}

	resolved := resolveUterAPICreateSlots([]uterapiKeySlot{
		{Name: "Economy", Group: "Claude-max", Keys: []string{}},
		{Name: "Codex", Group: "Codex Pro", Keys: []string{}},
	}, credentials)

	require.Equal(t, []resolvedUterapiSlot{
		{Name: "Economy 1", Group: "Claude-max", Keys: []string{"claude-one"}, Mode: "single"},
		{Name: "Economy 2", Group: "Claude-max", Keys: []string{"claude-two"}, Mode: "single"},
		{
			Name: "Codex", Group: "Codex Pro",
			Keys: []string{"codex-one", "codex-two"},
			Mode: "multi_to_single", Strategy: constant.MultiKeyModePolling,
		},
	}, resolved)
}
