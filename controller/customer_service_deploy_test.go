/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
package controller

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/uter-ai/uter/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockUterCS 模拟 uter-cs 的部署管理接口，记录被调用的路径与是否带上了 admin 令牌。
type mockUterCS struct {
	calls       []string
	gotToken    string
	configLLM   map[string]any
	sectionOK   bool
	sectionEcho bool
	applyStatus int
	applyError  string
}

func (m *mockUterCS) handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		m.calls = append(m.calls, r.Method+" "+r.URL.Path)
		m.gotToken = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.URL.Path == "/api/deploy/config" && r.Method == http.MethodGet:
			json.NewEncoder(w).Encode(map[string]any{
				"config": map[string]any{"llm": m.configLLM},
			})
		case r.URL.Path == "/api/deploy/section/llm" && r.Method == http.MethodPut:
			if m.sectionEcho {
				body, _ := io.ReadAll(r.Body)
				var echo map[string]any
				_ = json.Unmarshal(body, &echo)
				json.NewEncoder(w).Encode(map[string]any{"ok": true, "config": map[string]any{"llm": echo}})
			} else {
				json.NewEncoder(w).Encode(map[string]any{"ok": true})
			}
		case r.URL.Path == "/api/deploy/apply" && r.Method == http.MethodPost:
			// 真实 uter-cs 是 Fastify：声明了 application/json 却发空 body 会直接 400
			// （FST_ERR_CTP_EMPTY_JSON_BODY）。这里如实模拟，才能锁住「重载请求必须带 {}」。
			if r.ContentLength == 0 {
				w.WriteHeader(http.StatusBadRequest)
				json.NewEncoder(w).Encode(map[string]any{
					"code":    "FST_ERR_CTP_EMPTY_JSON_BODY",
					"message": "Body cannot be empty when content-type is set to 'application/json'",
				})
				return
			}
			w.WriteHeader(m.applyStatus)
			json.NewEncoder(w).Encode(map[string]any{
				"ok":    m.applyStatus == http.StatusOK,
				"error": m.applyError,
			})
		default:
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(map[string]any{"error": "not found"})
		}
	}
}

// withCS 把 Uter 侧的智能客服开关接到 mock，并在测试结束后还原。
func withCS(t *testing.T, m *mockUterCS) (baseURL string) {
	t.Helper()
	origToken := common.CustomerServiceAdminToken
	origCache := common.CustomerServiceLLMConfig
	srv := httptest.NewServer(m.handler())
	t.Cleanup(func() {
		srv.Close()
		common.CustomerServiceAdminToken = origToken
		common.CustomerServiceLLMConfig = origCache
	})
	t.Setenv("CUSTOMER_SERVICE_URL", srv.URL)
	common.CustomerServiceAdminToken = "test-cs-token"
	common.CustomerServiceLLMConfig = ""
	return srv.URL
}

func setCtx(body []byte, method string) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	resp := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(resp)
	ctx.Request = httptest.NewRequest(method, "/api/customer-service/deploy/llm", bytes.NewReader(body))
	return ctx, resp
}

func TestGetCustomerServiceLLMConfig_Preconditions(t *testing.T) {
	gin.SetMode(gin.TestMode)
	origToken := common.CustomerServiceAdminToken
	t.Cleanup(func() {
		common.CustomerServiceAdminToken = origToken
	})

	t.Run("missing URL returns 400", func(t *testing.T) {
		t.Setenv("CUSTOMER_SERVICE_URL", "")
		common.CustomerServiceAdminToken = "tok"
		ctx, resp := setCtx(nil, http.MethodGet)
		GetCustomerServiceLLMConfig(ctx)
		assert.Equal(t, http.StatusBadRequest, resp.Code)
	})

	t.Run("missing token returns 400 with needToken flag", func(t *testing.T) {
		t.Setenv("CUSTOMER_SERVICE_URL", "https://cs.uter.ai")
		common.CustomerServiceAdminToken = ""
		common.CustomerServiceLLMConfig = ""
		ctx, resp := setCtx(nil, http.MethodGet)
		GetCustomerServiceLLMConfig(ctx)
		assert.Equal(t, http.StatusBadRequest, resp.Code)
		var body map[string]any
		require.NoError(t, common.Unmarshal(resp.Body.Bytes(), &body))
		assert.Equal(t, true, body["needToken"])
	})
}

func TestGetCustomerServiceLLMConfig_NoTokenUsesCache(t *testing.T) {
	gin.SetMode(gin.TestMode)
	origToken := common.CustomerServiceAdminToken
	origCache := common.CustomerServiceLLMConfig
	t.Cleanup(func() {
		common.CustomerServiceAdminToken = origToken
		common.CustomerServiceLLMConfig = origCache
	})

	// 无令牌，但有上一次成功缓存：直接回放缓存，fromCache=true，不报 needToken。
	t.Setenv("CUSTOMER_SERVICE_URL", "https://cs.uter.ai")
	common.CustomerServiceAdminToken = ""
	common.CustomerServiceLLMConfig = `{"provider":"api","model":"cached-model"}`

	ctx, resp := setCtx(nil, http.MethodGet)
	GetCustomerServiceLLMConfig(ctx)
	require.Equal(t, http.StatusOK, resp.Code)
	var body struct {
		Success bool `json:"success"`
		Data    struct {
			LLM       map[string]any `json:"llm"`
			FromCache bool           `json:"fromCache"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(resp.Body.Bytes(), &body))
	assert.True(t, body.Success)
	assert.Equal(t, "cached-model", body.Data.LLM["model"])
	assert.True(t, body.Data.FromCache)
}

func TestGetCustomerServiceLLMConfig_HappyPath(t *testing.T) {
	m := &mockUterCS{
		configLLM: map[string]any{
			"provider": "api",
			"model":    "deepseek-ai/DeepSeek-V3",
			"api_key":  "sk-secret",
		},
	}
	withCS(t, m)

	ctx, resp := setCtx(nil, http.MethodGet)
	GetCustomerServiceLLMConfig(ctx)

	require.Equal(t, http.StatusOK, resp.Code)
	var body struct {
		Success bool `json:"success"`
		Data    struct {
			LLM map[string]any `json:"llm"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(resp.Body.Bytes(), &body))
	assert.True(t, body.Success)
	assert.Equal(t, "deepseek-ai/DeepSeek-V3", body.Data.LLM["model"])
	assert.Equal(t, "sk-secret", body.Data.LLM["api_key"])
	// 必须带上 admin 令牌转发，否则 uter-cs 会 401。
	assert.Equal(t, "Bearer test-cs-token", m.gotToken)
	assert.Contains(t, m.calls, "GET /api/deploy/config")
}

func TestGetCustomerServiceLLMConfig_UpstreamError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("boom"))
	}))
	t.Cleanup(func() { srv.Close() })
	t.Setenv("CUSTOMER_SERVICE_URL", srv.URL)
	common.CustomerServiceAdminToken = "tok"
	common.CustomerServiceLLMConfig = "" // 无缓存时才应落到 502

	ctx, resp := setCtx(nil, http.MethodGet)
	GetCustomerServiceLLMConfig(ctx)
	assert.Equal(t, http.StatusBadGateway, resp.Code)
}

func TestUpdateCustomerServiceLLMConfig_Preconditions(t *testing.T) {
	gin.SetMode(gin.TestMode)
	origToken := common.CustomerServiceAdminToken
	t.Cleanup(func() {
		common.CustomerServiceAdminToken = origToken
	})

	t.Run("missing token returns 400", func(t *testing.T) {
		t.Setenv("CUSTOMER_SERVICE_URL", "https://cs.uter.ai")
		common.CustomerServiceAdminToken = ""
		ctx, resp := setCtx([]byte(`{"model":"x"}`), http.MethodPut)
		UpdateCustomerServiceLLMConfig(ctx)
		assert.Equal(t, http.StatusBadRequest, resp.Code)
	})

	t.Run("invalid JSON body returns 400", func(t *testing.T) {
		t.Setenv("CUSTOMER_SERVICE_URL", "https://cs.uter.ai")
		common.CustomerServiceAdminToken = "tok"
		ctx, resp := setCtx([]byte(`not-json`), http.MethodPut)
		UpdateCustomerServiceLLMConfig(ctx)
		assert.Equal(t, http.StatusBadRequest, resp.Code)
	})
}

func TestUpdateCustomerServiceLLMConfig_HappyPath(t *testing.T) {
	m := &mockUterCS{sectionEcho: true, applyStatus: http.StatusOK}
	withCS(t, m)

	payload := map[string]any{"provider": "api", "model": "new-model"}
	body, _ := json.Marshal(payload)
	ctx, resp := setCtx(body, http.MethodPut)
	UpdateCustomerServiceLLMConfig(ctx)

	require.Equal(t, http.StatusOK, resp.Code)
	var out struct {
		Success   bool   `json:"success"`
		ApplyNote string `json:"apply_note"`
	}
	require.NoError(t, common.Unmarshal(resp.Body.Bytes(), &out))
	assert.True(t, out.Success)
	// 重载必须真的成功：带空 body 会拿到 400 并写进 apply_note（曾经的常态）。
	assert.Empty(t, out.ApplyNote, "重载引擎不应降级")
	// 落盘路径 + 重载路径都被命中。
	assert.Contains(t, m.calls, "PUT /api/deploy/section/llm")
	assert.Contains(t, m.calls, "POST /api/deploy/apply")
	assert.Equal(t, "Bearer test-cs-token", m.gotToken)
}

func TestUpdateCustomerServiceLLMConfig_ApplyFailsDegrades(t *testing.T) {
	// 写回成功但重载失败：仍可返回 200，只在提示里说明，不让主目标（落盘）失败。
	m := &mockUterCS{sectionEcho: true, applyStatus: http.StatusInternalServerError, applyError: "engine busy"}
	withCS(t, m)

	payload := map[string]any{"model": "new-model"}
	body, _ := json.Marshal(payload)
	ctx, resp := setCtx(body, http.MethodPut)
	UpdateCustomerServiceLLMConfig(ctx)

	require.Equal(t, http.StatusOK, resp.Code)
	var out struct {
		Success   bool   `json:"success"`
		ApplyNote string `json:"apply_note"`
	}
	require.NoError(t, common.Unmarshal(resp.Body.Bytes(), &out))
	assert.True(t, out.Success)
	assert.Contains(t, out.ApplyNote, "应用生效")
}

// TestGetCustomerServiceLLMConfig_TokenRejected 锁定「令牌被拒」与「上游故障」的分流。
//
// 真实误配：运营把管理员密码填进令牌框（实测存进去的是 11 字符的密码），uter-cs 对
// 任何 /api/deploy/* 都稳定返回 401。若按 502「上游错误」呈现，页面只会显示
// `HTTP 401 —— {"error":"unauthorized"}`，运营根本看不出该去换令牌。
// 因此 401/403 必须是 400 + needToken + tokenInvalid，且消息点明「不是管理员密码」。
func TestGetCustomerServiceLLMConfig_TokenRejected(t *testing.T) {
	gin.SetMode(gin.TestMode)
	origToken := common.CustomerServiceAdminToken
	origCache := common.CustomerServiceLLMConfig
	t.Cleanup(func() {
		common.CustomerServiceAdminToken = origToken
		common.CustomerServiceLLMConfig = origCache
	})

	for _, status := range []int{http.StatusUnauthorized, http.StatusForbidden} {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(status)
			_, _ = w.Write([]byte(`{"error":"unauthorized"}`))
		}))
		t.Setenv("CUSTOMER_SERVICE_URL", srv.URL)
		common.CustomerServiceAdminToken = "Uter.ai2026" // 把密码当令牌
		common.CustomerServiceLLMConfig = ""

		ctx, resp := setCtx(nil, http.MethodGet)
		GetCustomerServiceLLMConfig(ctx)
		srv.Close()

		require.Equal(t, http.StatusBadRequest, resp.Code, "status=%d", status)
		var body map[string]any
		require.NoError(t, common.Unmarshal(resp.Body.Bytes(), &body))
		assert.Equal(t, true, body["needToken"], "status=%d", status)
		assert.Equal(t, true, body["tokenInvalid"], "status=%d", status)
		msg, _ := body["message"].(string)
		assert.Contains(t, msg, "不是管理员密码", "status=%d", status)
	}
}

// TestUpdateCustomerServiceLLMConfig_TokenRejected 锁定保存路径同样把 401 翻成
// 「令牌无效」，而不是让运营以为「保存成功了但参数没生效」。
func TestUpdateCustomerServiceLLMConfig_TokenRejected(t *testing.T) {
	gin.SetMode(gin.TestMode)
	origToken := common.CustomerServiceAdminToken
	t.Cleanup(func() {
		common.CustomerServiceAdminToken = origToken
	})

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"unauthorized"}`))
	}))
	t.Cleanup(func() { srv.Close() })
	t.Setenv("CUSTOMER_SERVICE_URL", srv.URL)
	common.CustomerServiceAdminToken = "Uter.ai2026"

	ctx, resp := setCtx([]byte(`{"model":"new-model"}`), http.MethodPut)
	UpdateCustomerServiceLLMConfig(ctx)

	require.Equal(t, http.StatusBadRequest, resp.Code)
	var body map[string]any
	require.NoError(t, common.Unmarshal(resp.Body.Bytes(), &body))
	assert.Equal(t, true, body["tokenInvalid"])
	msg, _ := body["message"].(string)
	assert.Contains(t, msg, "保存配置")
}
