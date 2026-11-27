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
package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 回归（2026-11-27）：渠道 base_url 只填根域名（如 https://xxapi.ai）时，
// 模型列表端点会补 /v1/models，但 chat 端点曾直接拼成 /chat/completions，
// 命中站点 SPA 首页（HTTP 200 + text/html），JSON 解析报
// `invalid character '<' looking for beginning of value`，所有监测任务
// 被误判为 fail。chat 与 models 必须共享同一个 /v1 前缀。
func TestUpstreamEndpointAddsV1LikeModelsEndpoint(t *testing.T) {
	cases := []struct {
		base string
		want string
	}{
		{"https://xxapi.ai", "https://xxapi.ai/v1/chat/completions"},
		{"https://xxapi.ai/", "https://xxapi.ai/v1/chat/completions"},
		{"https://dreamrouter.ai", "https://dreamrouter.ai/v1/chat/completions"},
		{"https://api.openai.com/v1", "https://api.openai.com/v1/chat/completions"},
		{"https://host/api/v1", "https://host/api/v1/chat/completions"},
		{"https://host/v1/chat/completions", "https://host/v1/chat/completions"},
	}
	for _, tc := range cases {
		got, err := upstreamEndpoint(UpstreamProbeConfig{
			BaseURL: tc.base, Protocol: UpstreamProtocolOpenAI,
		})
		require.NoError(t, err, tc.base)
		assert.Equal(t, tc.want, got, tc.base)
	}
}

// 两个端点必须由同一段 base 派生，否则「模型列表可达但最小生成失败」
// 这种自相矛盾的报告会反复出现。
func TestUpstreamEndpointAndModelsEndpointShareV1Base(t *testing.T) {
	for _, base := range []string{
		"https://xxapi.ai",
		"https://dreamrouter.ai",
		"https://api.openai.com/v1",
		"https://host/api/v1",
	} {
		cfg := UpstreamProbeConfig{BaseURL: base, Protocol: UpstreamProtocolOpenAI}
		chat, err := upstreamEndpoint(cfg)
		require.NoError(t, err, base)
		models, err := upstreamModelsEndpoint(cfg)
		require.NoError(t, err, base)
		assert.Equal(t,
			strings.TrimSuffix(models, "/models"),
			strings.TrimSuffix(chat, "/chat/completions"),
			base,
		)
	}
}

// 百炼 Model Studio 的兼容端点在 /compatible-mode/v1。历史渠道只填了根域名，
// 裸 /v1/* 会 404；监测侧需按权威 host 判断兜底补前缀，且不得重复添加。
func TestUpstreamAPIBaseAddsCompatibleModeForBailian(t *testing.T) {
	cases := []struct {
		base string
		want string
	}{
		{
			"https://ws-ssc8bd9i0yuj89n4.cn-beijing.maas.aliyuncs.com",
			"https://ws-ssc8bd9i0yuj89n4.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
		},
		{
			"https://dashscope.aliyuncs.com",
			"https://dashscope.aliyuncs.com/compatible-mode/v1",
		},
		{
			"https://dashscope.aliyuncs.com/compatible-mode/v1",
			"https://dashscope.aliyuncs.com/compatible-mode/v1",
		},
		{"https://xxapi.ai", "https://xxapi.ai/v1"},
	}
	for _, tc := range cases {
		assert.Equal(t, tc.want, upstreamAPIBase(tc.base), tc.base)
	}
}

// 端到端回归：根域名 base_url + 只在 /v1/* 提供 JSON 的上游必须被判为可用。
func TestRunUpstreamMonitor_RootBaseURLServesV1(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/models":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"data":[{"id":"test-model"}]}`))
		case "/v1/chat/completions":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"391"},"finish_reason":"stop"}],"usage":{"prompt_tokens":12,"completion_tokens":2,"total_tokens":14}}`))
		default:
			// 站点首页：与 xxapi.ai 的真实失败形态一致。
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = w.Write([]byte("<!doctype html><html lang=\"zh-CN\"><body>Uter</body></html>"))
		}
	}))
	defer server.Close()

	result := RunUpstreamMonitor(context.Background(), UpstreamProbeConfig{
		BaseURL: server.URL, APIKey: "sk-test", Model: "test-model",
		Protocol: UpstreamProtocolOpenAI, Depth: UpstreamDepthQuick,
		Timeout: 5 * time.Second,
	})
	assert.NotContains(t, result.Error, "invalid character '<'")
	assert.NotEqual(t, UpstreamVerdictFail, result.Verdict)
	assert.True(t, result.Metrics.ModelsEndpointOK)
	assert.Equal(t, http.StatusOK, result.Metrics.HTTPStatus)
}
