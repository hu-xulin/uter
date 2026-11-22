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
	"github.com/uter-ai/uter/model"
)

// xxapi 双密钥创建：每个密钥只启用它自己能访问的模型，并同步各自的计费规则。
func TestCreateXXAPIChannelsCreatesOneChannelPerKey(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(
		&model.ChannelModelPricing{}, &model.ChannelPricingHistory{},
		&model.Model{}, &model.Vendor{}, &model.Option{},
	))
	server := newXXAPIMockServer(t, true)
	previousBase := xxapiBaseURLForTest
	xxapiBaseURLForTest = server.URL
	t.Cleanup(func() { xxapiBaseURLForTest = previousBase })

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/xxapi",
		strings.NewReader(`{"claude_key":"claude-key","gpt_key":"gpt-key","group":"default"}`))
	ctx.Request.Header.Set("Content-Type", "application/json")

	CreateXXAPIChannels(ctx)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	assert.Contains(t, recorder.Body.String(), `"created":2`)

	all, err := model.GetAllChannels(0, 100, true, true)
	require.NoError(t, err)
	byName := map[string]*model.Channel{}
	for _, ch := range all {
		byName[ch.Name] = ch
	}
	claudeCh := byName["xxapi-claude"]
	gptCh := byName["xxapi-gpt"]
	require.NotNil(t, claudeCh)
	require.NotNil(t, gptCh)
	assert.Equal(t, "claude-a,claude-b", claudeCh.Models)
	assert.Equal(t, "gpt-a", gptCh.Models)

	for _, pair := range []struct {
		channelID int
		modelName string
	}{{claudeCh.Id, "claude-a"}, {claudeCh.Id, "claude-b"}, {gptCh.Id, "gpt-a"}} {
		row, err := model.GetChannelModelPricingFor(model.ChannelPricingIdentity{ChannelId: pair.channelID, ModelName: pair.modelName})
		require.NoError(t, err, "%s must have pricing", pair.modelName)
		assert.NotEmpty(t, row.InternalPricing, "%s must be billable", pair.modelName)
	}
}

// 单个密钥失败时，另一个仍然创建成功，并在结果中分别报告。
func TestCreateXXAPIChannelsReportsPerKeyFailure(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(
		&model.ChannelModelPricing{}, &model.ChannelPricingHistory{},
		&model.Model{}, &model.Vendor{}, &model.Option{},
	))
	server := newXXAPIMockServer(t, false)
	previousBase := xxapiBaseURLForTest
	xxapiBaseURLForTest = server.URL
	t.Cleanup(func() { xxapiBaseURLForTest = previousBase })

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/xxapi",
		strings.NewReader(`{"claude_key":"claude-key","gpt_key":"bad-key"}`))
	ctx.Request.Header.Set("Content-Type", "application/json")

	CreateXXAPIChannels(ctx)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	var payload struct {
		Success bool `json:"success"`
		Data    struct {
			Created  int           `json:"created"`
			Channels []interface{} `json:"channels"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	assert.True(t, payload.Success)
	assert.Equal(t, 1, payload.Data.Created)
	require.Len(t, payload.Data.Channels, 2)
}

func newXXAPIMockServer(t *testing.T, gptKeyValid bool) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		auth := r.Header.Get("Authorization")
		switch {
		case r.URL.Path == "/v1/models" && auth == "Bearer claude-key":
			_, _ = w.Write([]byte(`{"data":[{"id":"claude-a"},{"id":"claude-b"}]}`))
		case r.URL.Path == "/v1/models" && gptKeyValid && auth == "Bearer gpt-key":
			_, _ = w.Write([]byte(`{"data":[{"id":"gpt-a"}]}`))
		case r.URL.Path == "/v1/models":
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error":{"message":"bad key"}}`))
		case r.URL.Path == "/api/pricing":
			_, _ = w.Write([]byte(`{"success":true,"data":[
				{"model_name":"claude-a","billing_mode":"tiered_expr","billing_expr":"tier(\"base\", p + c)"},
				{"model_name":"claude-b","billing_mode":"tiered_expr","billing_expr":"tier(\"base\", p * 2 + c * 4)"},
				{"model_name":"gpt-a","billing_mode":"tiered_expr","billing_expr":"tier(\"base\", p * 3 + c * 6)"}
			]}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(server.Close)
	return server
}

// 分组决定价格：密钥所属分组的倍率必须乘进渠道价与采购成本。
func TestCreateXXAPIChannelsAppliesGroupMultiplier(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(
		&model.ChannelModelPricing{}, &model.ChannelPricingHistory{},
		&model.Model{}, &model.Vendor{}, &model.Option{},
	))
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.URL.Path == "/v1/models":
			_, _ = w.Write([]byte(`{"data":[{"id":"claude-a"}]}`))
		case r.URL.Path == "/api/pricing":
			_, _ = w.Write([]byte(`{
				"success": true,
				"group_ratio": {"Claude-max": 2.5, "Codex Pro": 0.4},
				"group_display": {"Claude-max": {"name":"Claude Code · 标准（稳定）"}, "Codex Pro": {"name":"Codex · 标准（稳定）"}},
				"data": [{"model_name":"claude-a","billing_mode":"tiered_expr","billing_expr":"tier(\"base\", p * 1 + c * 2)"}]
			}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(server.Close)
	previousBase := xxapiBaseURLForTest
	xxapiBaseURLForTest = server.URL
	t.Cleanup(func() { xxapiBaseURLForTest = previousBase })

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/xxapi",
		strings.NewReader(`{"claude_key":"claude-key","claude_group":"Claude-max"}`))
	ctx.Request.Header.Set("Content-Type", "application/json")

	CreateXXAPIChannels(ctx)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	var payload struct {
		Data struct {
			Channels []struct {
				ChannelId  int     `json:"channel_id"`
				PriceRatio float64 `json:"price_ratio"`
				GroupName  string  `json:"group_name"`
			} `json:"channels"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.Len(t, payload.Data.Channels, 1)
	entry := payload.Data.Channels[0]
	assert.InDelta(t, 2.5, entry.PriceRatio, 1e-9)
	assert.Equal(t, "Claude Code · 标准（稳定）", entry.GroupName)

	row, err := model.GetChannelModelPricingFor(model.ChannelPricingIdentity{ChannelId: entry.ChannelId, ModelName: "claude-a"})
	require.NoError(t, err)
	var internal model.ChannelInternalPricing
	require.NoError(t, common.UnmarshalJsonStr(row.InternalPricing, &internal))
	assert.Contains(t, internal.BillingExpr, "* 2.5")

	cost := model.ParseChannelPurchaseCost(row.PurchasePricing)
	require.NotNil(t, cost, "group multiplier must also produce a purchase contract")
	assert.Contains(t, cost.Pricing.BillingExpr, "* 2.5")
}
