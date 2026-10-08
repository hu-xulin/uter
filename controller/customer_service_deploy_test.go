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

// mockSmartCS 模拟 smart-cs 的部署管理接口，记录被调用的路径与是否带上了 admin 令牌。
type mockSmartCS struct {
	calls        []string
	gotToken     string
	configLLM    map[string]any
	sectionOK    bool
	sectionEcho  bool
	applyStatus  int
	applyError   string
}

func (m *mockSmartCS) handler() http.HandlerFunc {
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
func withCS(t *testing.T, m *mockSmartCS) (baseURL string) {
	t.Helper()
	origURL := common.CustomerServiceURL
	origToken := common.CustomerServiceAdminToken
	srv := httptest.NewServer(m.handler())
	t.Cleanup(func() {
		srv.Close()
		common.CustomerServiceURL = origURL
		common.CustomerServiceAdminToken = origToken
	})
	common.CustomerServiceURL = srv.URL
	common.CustomerServiceAdminToken = "test-cs-token"
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
	origURL := common.CustomerServiceURL
	origToken := common.CustomerServiceAdminToken
	t.Cleanup(func() {
		common.CustomerServiceURL = origURL
		common.CustomerServiceAdminToken = origToken
	})

	t.Run("missing URL returns 400", func(t *testing.T) {
		common.CustomerServiceURL = ""
		common.CustomerServiceAdminToken = "tok"
		ctx, resp := setCtx(nil, http.MethodGet)
		GetCustomerServiceLLMConfig(ctx)
		assert.Equal(t, http.StatusBadRequest, resp.Code)
	})

	t.Run("missing token returns 400 with needToken flag", func(t *testing.T) {
		common.CustomerServiceURL = "https://cs.uter.ai"
		common.CustomerServiceAdminToken = ""
		ctx, resp := setCtx(nil, http.MethodGet)
		GetCustomerServiceLLMConfig(ctx)
		assert.Equal(t, http.StatusBadRequest, resp.Code)
		var body map[string]any
		require.NoError(t, common.Unmarshal(resp.Body.Bytes(), &body))
		assert.Equal(t, true, body["needToken"])
	})
}

func TestGetCustomerServiceLLMConfig_HappyPath(t *testing.T) {
	m := &mockSmartCS{
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
	// 必须带上 admin 令牌转发，否则 smart-cs 会 401。
	assert.Equal(t, "Bearer test-cs-token", m.gotToken)
	assert.Contains(t, m.calls, "GET /api/deploy/config")
}

func TestGetCustomerServiceLLMConfig_UpstreamError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("boom"))
	}))
	t.Cleanup(func() { srv.Close() })
	common.CustomerServiceURL = srv.URL
	common.CustomerServiceAdminToken = "tok"

	ctx, resp := setCtx(nil, http.MethodGet)
	GetCustomerServiceLLMConfig(ctx)
	assert.Equal(t, http.StatusBadGateway, resp.Code)
}

func TestUpdateCustomerServiceLLMConfig_Preconditions(t *testing.T) {
	gin.SetMode(gin.TestMode)
	origURL := common.CustomerServiceURL
	origToken := common.CustomerServiceAdminToken
	t.Cleanup(func() {
		common.CustomerServiceURL = origURL
		common.CustomerServiceAdminToken = origToken
	})

	t.Run("missing token returns 400", func(t *testing.T) {
		common.CustomerServiceURL = "https://cs.uter.ai"
		common.CustomerServiceAdminToken = ""
		ctx, resp := setCtx([]byte(`{"model":"x"}`), http.MethodPut)
		UpdateCustomerServiceLLMConfig(ctx)
		assert.Equal(t, http.StatusBadRequest, resp.Code)
	})

	t.Run("invalid JSON body returns 400", func(t *testing.T) {
		common.CustomerServiceURL = "https://cs.uter.ai"
		common.CustomerServiceAdminToken = "tok"
		ctx, resp := setCtx([]byte(`not-json`), http.MethodPut)
		UpdateCustomerServiceLLMConfig(ctx)
		assert.Equal(t, http.StatusBadRequest, resp.Code)
	})
}

func TestUpdateCustomerServiceLLMConfig_HappyPath(t *testing.T) {
	m := &mockSmartCS{sectionEcho: true, applyStatus: http.StatusOK}
	withCS(t, m)

	payload := map[string]any{"provider": "api", "model": "new-model"}
	body, _ := json.Marshal(payload)
	ctx, resp := setCtx(body, http.MethodPut)
	UpdateCustomerServiceLLMConfig(ctx)

	require.Equal(t, http.StatusOK, resp.Code)
	var out struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(resp.Body.Bytes(), &out))
	assert.True(t, out.Success)
	// 落盘路径 + 重载路径都被命中。
	assert.Contains(t, m.calls, "PUT /api/deploy/section/llm")
	assert.Contains(t, m.calls, "POST /api/deploy/apply")
	assert.Equal(t, "Bearer test-cs-token", m.gotToken)
}

func TestUpdateCustomerServiceLLMConfig_ApplyFailsDegrades(t *testing.T) {
	// 写回成功但重载失败：仍可返回 200，只在提示里说明，不让主目标（落盘）失败。
	m := &mockSmartCS{sectionEcho: true, applyStatus: http.StatusInternalServerError, applyError: "engine busy"}
	withCS(t, m)

	payload := map[string]any{"model": "new-model"}
	body, _ := json.Marshal(payload)
	ctx, resp := setCtx(body, http.MethodPut)
	UpdateCustomerServiceLLMConfig(ctx)

	require.Equal(t, http.StatusOK, resp.Code)
	var out struct {
		Success    bool   `json:"success"`
		ApplyNote  string `json:"apply_note"`
	}
	require.NoError(t, common.Unmarshal(resp.Body.Bytes(), &out))
	assert.True(t, out.Success)
	assert.Contains(t, out.ApplyNote, "应用生效")
}
