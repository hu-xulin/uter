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
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/uter-ai/uter/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestGetStatusPublishesCustomerServicePages 锁定页面级开关的下发形态。
//
// 与总开关不同，这里下发的是**已规整的字符串数组**而不是原始逗号串：前端要拿它
// 直接与当前路由比对，原始串还得再解析一遍并自行过滤未知键。空配置必须已展开为
// 全部页面，前端才不必区分「未配置」与「全开」。
func TestGetStatusPublishesCustomerServicePages(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalPages := common.CustomerServicePages
	originalEnabled := common.CustomerServiceEnabled
	t.Cleanup(func() {
		common.CustomerServicePages = originalPages
		common.CustomerServiceEnabled = originalEnabled
	})
	// 页面级开关只在总开关开启时才有意义，这里固定为「开 + 有地址」，
	// 单独隔离出页面列表这一个变量。
	common.CustomerServiceEnabled = true
	t.Setenv("CUSTOMER_SERVICE_URL", "https://cs.uter.ai")

	tests := []struct {
		name  string
		pages string
		want  []any
	}{
		{
			// 向后兼容的核心：未配置 = 全部页面都开。
			name:  "unset publishes every page",
			pages: "",
			want: []any{
				"home", "dashboard", "pricing", "rankings", "docs", "about",
			},
		},
		{
			// 显式哨兵「全部关闭」：后端必须下发明示的空数组，而非缺失该字段；
			// 前端据此把入口在所有页面隐藏。空数组与 nil 不同，前端拿它做
			// .includes 比对时恒为 false，故入口不会在任一页面出现。
			name:  "none sentinel publishes empty array",
			pages: common.CustomerServicePagesAllOff,
			want:  []any{},
		},
		{
			name:  "subset publishes only that subset",
			pages: "home,docs",
			want:  []any{"home", "docs"},
		},
		{
			// 下发的是规整结果：顺序固定、未知键剔除、空白忽略。
			name:  "published list is normalized",
			pages: " Docs , bogus ,home,HOME ",
			want:  []any{"home", "docs"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			common.CustomerServicePages = tt.pages

			response := httptest.NewRecorder()
			context, _ := gin.CreateTestContext(response)
			context.Request = httptest.NewRequest(http.MethodGet, "/api/status", nil)

			GetStatus(context)

			var payload struct {
				Success bool           `json:"success"`
				Data    map[string]any `json:"data"`
			}
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &payload))
			require.True(t, payload.Success)
			// 必须是真正的数组：前端要 .includes(path) 比对，
			// 若下发成字符串则恒不包含、入口会在所有页面消失。
			assert.Equal(t, tt.want, payload.Data["customer_service_pages"])
		})
	}
}

// TestGetStatusPublishesCustomerServiceGates 锁定智能客服入口的两个独立门：
// customer_service_enabled（运营开关）与 customer_service_url（服务地址）。
//
// 两者必须**同时**下发且都位于 data 内：前端 useCustomerServiceBase 读顶层会恒为
// undefined、导致挂件被静默隐藏，所以这里连"字段在哪一层"一起钉住。
func TestGetStatusPublishesCustomerServiceGates(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalEnabled := common.CustomerServiceEnabled
	t.Cleanup(func() {
		common.CustomerServiceEnabled = originalEnabled
	})

	tests := []struct {
		name        string
		url         string
		enabled     bool
		wantURL     any
		wantEnabled bool
	}{
		{
			name:        "enabled with address",
			url:         "https://cs.uter.ai",
			enabled:     true,
			wantURL:     "https://cs.uter.ai",
			wantEnabled: true,
		},
		{
			name:        "disabled by operator",
			url:         "https://cs.uter.ai",
			enabled:     false,
			wantURL:     "https://cs.uter.ai",
			wantEnabled: false,
		},
		{
			name:        "no address configured",
			url:         "",
			enabled:     true,
			wantURL:     "",
			wantEnabled: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("CUSTOMER_SERVICE_URL", tt.url)
			common.CustomerServiceEnabled = tt.enabled

			response := httptest.NewRecorder()
			context, _ := gin.CreateTestContext(response)
			context.Request = httptest.NewRequest(http.MethodGet, "/api/status", nil)

			GetStatus(context)

			var payload struct {
				Success bool           `json:"success"`
				Data    map[string]any `json:"data"`
			}
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &payload))
			require.True(t, payload.Success)
			assert.Equal(t, tt.wantURL, payload.Data["customer_service_url"])
			// 必须是真正的 bool，而不是字符串 "true"/"false"：前端按 `=== false` 判定。
			assert.Equal(t, tt.wantEnabled, payload.Data["customer_service_enabled"])
		})
	}
}
