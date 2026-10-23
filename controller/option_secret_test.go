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
*/

package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/uter-ai/uter/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// withOptionMap 在测试期间覆写 common.OptionMap 的若干键，返回时原样恢复。
func withOptionMap(t *testing.T, values map[string]string) {
	t.Helper()
	common.OptionMapRWMutex.Lock()
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	previous := make(map[string]string, len(values))
	for key, value := range values {
		previous[key] = common.OptionMap[key]
		common.OptionMap[key] = value
	}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		for key, value := range previous {
			if value == "" {
				delete(common.OptionMap, key)
				continue
			}
			common.OptionMap[key] = value
		}
		common.OptionMapRWMutex.Unlock()
	})
}

func decodedOptions(t *testing.T, body []byte) map[string]string {
	t.Helper()
	var payload struct {
		Success bool `json:"success"`
		Data    []struct {
			Key   string `json:"key"`
			Value string `json:"value"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(body, &payload))
	require.True(t, payload.Success)
	out := make(map[string]string, len(payload.Data))
	for _, item := range payload.Data {
		out[item.Key] = item.Value
	}
	return out
}

// TestGetOptionsMasksSecretKeys 锁定「读取时密钥按掩码下发」：
// 敏感键必须仍然出现在列表里（前端才能显示「已配置」与前后各 4 位核对），
// 但值必须是掩码串；非敏感键保持原值。
func TestGetOptionsMasksSecretKeys(t *testing.T) {
	withOptionMap(t, map[string]string{
		"WechatPayApiV3Key":   "0123456789abcdef0123456789abcdef",
		"WechatPayPublicKey":  "-----BEGIN PUBLIC KEY-----MIIBIjANBgkq-----END PUBLIC KEY-----",
		"StripeWebhookSecret": "whsec_abcdef1234567890",
		// 公开值：登记在 publicOptionKeys 里，必须原样下发。
		"TurnstileSiteKey": "0x4AAAAAASiteKeyPublic",
		// 普通配置：不受影响。
		"MinTopUp": "10",
	})

	response := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(response)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/option/", nil)

	GetOptions(context)

	require.Equal(t, http.StatusOK, response.Code)
	options := decodedOptions(t, response.Body.Bytes())

	for _, key := range []string{"WechatPayApiV3Key", "WechatPayPublicKey", "StripeWebhookSecret"} {
		value, ok := options[key]
		require.True(t, ok, "secret option %s must still be returned", key)
		assert.Contains(t, value, "*", "secret option %s must be masked", key)
		assert.NotContains(t, value, "0123456789abcdef")
	}
	assert.Equal(t, "0x4AAAAAASiteKeyPublic", options["TurnstileSiteKey"])
	assert.Equal(t, "10", options["MinTopUp"])
}

// TestUpdateOptionIgnoresMaskedSecretWrite 锁定「写入侧防掩码覆盖」：
// 前端把展示态掩码串原样提交时必须视为未修改，库中原密钥保持不变。
func TestUpdateOptionIgnoresMaskedSecretWrite(t *testing.T) {
	const storedSecret = "whsec_realsecretvalue1234567890"
	withOptionMap(t, map[string]string{"StripeWebhookSecret": storedSecret})

	response := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(response)
	context.Request = httptest.NewRequest(
		http.MethodPut,
		"/api/option/",
		strings.NewReader(`{"key":"StripeWebhookSecret","value":"whse****7890"}`),
	)

	UpdateOption(context)

	require.Equal(t, http.StatusOK, response.Code)
	var payload struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &payload))
	assert.True(t, payload.Success)

	common.OptionMapRWMutex.RLock()
	actual := common.OptionMap["StripeWebhookSecret"]
	common.OptionMapRWMutex.RUnlock()
	assert.Equal(t, storedSecret, actual, "masked write must not overwrite the stored secret")
}
