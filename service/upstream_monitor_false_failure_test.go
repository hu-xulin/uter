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

// 回归（2026-11-27）：百炼图像/音频专用模型对标准 chat/completions 返回
// HTTP 400 InvalidParameter（content 必须是多模态数组），不是 404。旧逻辑
// 只跳过 404，导致这些模型被判硬失败并把整个渠道拖成 fail。
func TestNonChatModelRejection(t *testing.T) {
	assert.True(t, isNonChatModelRejection("m", http.StatusNotFound, ""))
	assert.True(t, isNonChatModelRejection("m", http.StatusBadRequest,
		`upstream returned HTTP 400: {"code":"InvalidParameter","message":"Input should be a valid list: input.messages.0.content"}`))
	assert.True(t, isNonChatModelRejection("qwen-audio-3.0-asr-flash", http.StatusBadRequest,
		"upstream returned HTTP 400: {}"))
	assert.True(t, isNonChatModelRejection("wan2.7-image", http.StatusBadRequest,
		"upstream returned HTTP 400: {}"))
	// 真正的调用失败不得被误当作「非 chat 模型」而跳过。
	assert.False(t, isNonChatModelRejection("claude-sonnet-5", http.StatusBadRequest,
		"upstream returned HTTP 400: invalid model parameter"))
	assert.False(t, isNonChatModelRejection("claude-sonnet-5", http.StatusUnauthorized,
		"upstream returned HTTP 401: Invalid API key"))
	assert.False(t, isNonChatModelRejection("claude-sonnet-5", http.StatusInternalServerError,
		"upstream returned HTTP 500: boom"))
}

// 端到端：多模态模型的 400 应被跳过，而不是产生 upstream_unreachable 硬门禁。
func TestRunUpstreamMonitor_NonChatModel400IsSkipped(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/models":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"data":[{"id":"qwen-image-2.1-pro"}]}`))
		case "/v1/chat/completions":
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte(`{"code":"InvalidParameter","message":"Input should be a valid list: input.messages.0.content"}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	result := RunUpstreamMonitor(context.Background(), UpstreamProbeConfig{
		BaseURL: server.URL, APIKey: "sk-test", Model: "qwen-image-2.1-pro",
		Protocol: UpstreamProtocolOpenAI, Depth: UpstreamDepthStandard,
		Timeout: 5 * time.Second,
	})
	assert.NotContains(t, result.HardGates, "upstream_unreachable")
	assert.True(t, result.Metrics.ModelsEndpointOK)
	var chatProbeSkipped bool
	for _, p := range result.Probes {
		if p.Key == "availability.chat" {
			chatProbeSkipped = p.Skipped
		}
	}
	assert.True(t, chatProbeSkipped, "chat suite must be skipped for a multimodal-only model")
}

// 回归（2026-11-27）：token 膨胀检测曾只用 chat.Content 估算，忽略
// reasoning_content，而上游 usage.completion_tokens 包含思考链，导致
// 比值虚高到 3.2~4.1，被误判为 token_inflation_suspected 硬失败。
func TestUpstreamEstimateTokensIncludesReasoning(t *testing.T) {
	answer := "我是 Claude。"
	reasoning := strings.Repeat("thinking about the user question in detail ", 12)
	without := upstreamEstimateTokens(answer)
	with := upstreamEstimateTokens(reasoning + "\n" + answer)
	assert.Greater(t, with, without*3, "reasoning tokens must be part of the estimate")
}

// 端到端：估算比值偏高但上报量仍在探测预算内，不得触发硬门禁。
// xxapi 上 Claude 会报 90~120 completion tokens（max_tokens=256），
// 可见 SSE 文本很短且不含 reasoning_content，启发式估算必然偏低。
func TestRunUpstreamMonitor_HighRatioWithinBudgetIsNotHardGate(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/models":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"data":[{"id":"claude-sonnet-5"}]}`))
		case "/v1/chat/completions":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"我是 Claude。"},"finish_reason":"stop"}],"usage":{"prompt_tokens":20,"completion_tokens":120,"total_tokens":140}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	result := RunUpstreamMonitor(context.Background(), UpstreamProbeConfig{
		BaseURL: server.URL, APIKey: "sk-test", Model: "claude-sonnet-5",
		Protocol: UpstreamProtocolOpenAI, Depth: UpstreamDepthStandard,
		Timeout: 5 * time.Second,
	})
	assert.Greater(t, result.Metrics.TokenInflationRatio, 2.5)
	assert.NotContains(t, result.HardGates, "token_inflation_suspected",
		"heuristic ratio alone must not veto an otherwise healthy channel")
	var billingScore int
	for _, d := range result.Dimensions {
		if d.Key == "billing" {
			billingScore = d.Score
		}
	}
	assert.Equal(t, 0, billingScore, "billing dimension must still be penalised")
}

// 真实膨胀（上报量远超探测预算）仍必须触发硬门禁。
func TestRunUpstreamMonitor_ExtremeInflationStillHardGates(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/models":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"data":[{"id":"claude-sonnet-5"}]}`))
		case "/v1/chat/completions":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"我是 Claude。"},"finish_reason":"stop"}],"usage":{"prompt_tokens":20,"completion_tokens":1200,"total_tokens":1220}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	result := RunUpstreamMonitor(context.Background(), UpstreamProbeConfig{
		BaseURL: server.URL, APIKey: "sk-test", Model: "claude-sonnet-5",
		Protocol: UpstreamProtocolOpenAI, Depth: UpstreamDepthStandard,
		Timeout: 5 * time.Second,
	})
	assert.Contains(t, result.HardGates, "token_inflation_suspected")
	assert.Equal(t, UpstreamVerdictFail, result.Verdict)
}

// 端到端：带 reasoning 且 usage 合理的响应不得触发 token_inflation 硬门禁。
func TestRunUpstreamMonitor_ReasoningTokensNotFlagged(t *testing.T) {
	reasoning := strings.Repeat("thinking about the user question in detail ", 12)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/models":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"data":[{"id":"claude-sonnet-5"}]}`))
		case "/v1/chat/completions":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"我是 Claude。","reasoning_content":"` + reasoning + `"},"finish_reason":"stop"}],"usage":{"prompt_tokens":20,"completion_tokens":72,"total_tokens":92}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	result := RunUpstreamMonitor(context.Background(), UpstreamProbeConfig{
		BaseURL: server.URL, APIKey: "sk-test", Model: "claude-sonnet-5",
		Protocol: UpstreamProtocolOpenAI, Depth: UpstreamDepthStandard,
		Timeout: 5 * time.Second,
	})
	require.NotNil(t, result)
	assert.NotContains(t, result.HardGates, "token_inflation_suspected")
	assert.Greater(t, result.Metrics.EstimatedCompletionTokens, upstreamEstimateTokens("我是 Claude。"))
}
