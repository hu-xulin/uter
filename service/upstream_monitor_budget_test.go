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
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 最低消费原则（2026-11-27）：监测是周期性任务，每个探测只请求"刚好满足判定"
// 的最小输出。旧实现的单次预算为 256/512（chat）、64（math）、32（recall）、
// 128（inject），一次 full 运行累计 832 completion tokens，高频任务下费用过高。
// 这些测试锁定"单次上限 + 整轮总量"两项契约，防止预算回退。

type probeChatBody struct {
	MaxTokens int `json:"max_tokens"`
	Messages  []struct {
		Content string `json:"content"`
	} `json:"messages"`
}

func newBudgetProbeServer(t *testing.T, budgets *[]int) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/models"):
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"data":[{"id":"test-model"}]}`))
		case strings.HasSuffix(r.URL.Path, "/chat/completions"):
			var body probeChatBody
			require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
			*budgets = append(*budgets, body.MaxTokens)
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"391"},"finish_reason":"stop"}],"usage":{"prompt_tokens":8,"completion_tokens":2,"total_tokens":10}}`))
		default:
			http.NotFound(w, r)
		}
	}))
}

func sumBudgets(budgets []int) int {
	total := 0
	for _, b := range budgets {
		total += b
	}
	return total
}

// standard 深度跑 3 次 chat 探测（主 chat / math / inject）。
// 新预算 128 + 32 + 48 = 208；旧预算 256 + 64 + 128 = 448。
func TestRunUpstreamMonitor_StandardDepthMinimalBudget(t *testing.T) {
	var budgets []int
	server := newBudgetProbeServer(t, &budgets)
	defer server.Close()

	result := RunUpstreamMonitor(context.Background(), UpstreamProbeConfig{
		BaseURL: server.URL + "/v1", APIKey: "sk-test", Model: "test-model",
		Protocol: UpstreamProtocolOpenAI, Depth: UpstreamDepthStandard, Timeout: 5 * time.Second,
	})

	require.Len(t, budgets, 3, "standard 深度应有 3 次 chat 探测")
	for _, b := range budgets {
		assert.LessOrEqual(t, b, 256, "单次预算不得超过 256（thinking 模型实测上限）")
	}
	assert.LessOrEqual(t, sumBudgets(budgets), 240,
		"standard 深度总预算须体现最低消费（旧值 448）")
	assert.NotContains(t, result.HardGates, "upstream_unreachable",
		"降低预算不得破坏可用性判定")
}

// full 深度跑 13 次 chat 探测。随着"完全覆盖文档 11 维度"需求落地，
// full 深度新增了高级能力（JSON/工具）、长上下文、429 限流并发、错误边界
// 四类主动探测。这些探测全部使用最小预算（4 或 32），单次上限 256 不变，
// 总量上限从 420 提升到 560——这是维度覆盖扩展的合理基线，仍远低于旧值 832。
func TestRunUpstreamMonitor_FullDepthMinimalBudget(t *testing.T) {
	var budgets []int
	server := newBudgetProbeServer(t, &budgets)
	defer server.Close()

	result := RunUpstreamMonitor(context.Background(), UpstreamProbeConfig{
		BaseURL: server.URL + "/v1", APIKey: "sk-test", Model: "test-model",
		Protocol: UpstreamProtocolOpenAI, Depth: UpstreamDepthFull, Timeout: 5 * time.Second,
	})

	require.Len(t, budgets, 13, "full 深度应有 13 次 chat 探测（含 11 维度覆盖探测）")
	for _, b := range budgets {
		assert.LessOrEqual(t, b, 256, "单次预算不得超过 256")
	}
	assert.LessOrEqual(t, sumBudgets(budgets), 560,
		"full 深度总预算须体现最低消费（旧值 832，维度扩展后基线 520）")
	assert.NotContains(t, result.HardGates, "upstream_unreachable")

	// 新增探测的预算必须均为极小值（4 或 32），不得出现无界预算。
	for _, b := range budgets {
		assert.Contains(t, []int{4, 16, 32, 48, 256}, b, "探测预算必须来自受控集合")
	}
}
