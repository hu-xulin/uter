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

package costopt

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"
)

// TestBatchChatEndpoint_DefaultIsOpenAI 未配置时默认 /v1/chat/completions（OpenAI 兼容）。
func TestBatchChatEndpoint_DefaultIsOpenAI(t *testing.T) {
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.BatchChatEndpoint = ""
	})
	require.Equal(t, "/v1/chat/completions", batchChatEndpoint(costoptcfg.GetCostOptSetting()))
}

// TestBatchChatEndpoint_ZhipuV4 配置智谱后使用 /v4/chat/completions。
func TestBatchChatEndpoint_ZhipuV4(t *testing.T) {
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.BatchChatEndpoint = "/v4/chat/completions"
	})
	require.Equal(t, "/v4/chat/completions", batchChatEndpoint(costoptcfg.GetCostOptSetting()))
}

// TestBuildBatchJSONL_UsesConfiguredEndpoint JSONL 每行的 url 必须跟随配置（智谱 /v4），
// 否则上游按 OpenAI 的 /v1 路由而拒绝批任务。
func TestBuildBatchJSONL_UsesConfiguredEndpoint(t *testing.T) {
	items := []BatchItem{{Model: "glm-4-flash", Payload: []byte(`{"model":"glm-4-flash"}`)}}

	// 默认
	lines := strings.Split(strings.TrimSpace(buildBatchJSONL(items, batchChatEndpoint(&costoptcfg.CostOptSetting{}))), "\n")
	require.Len(t, lines, 1)
	var first map[string]any
	require.NoError(t, json.Unmarshal([]byte(lines[0]), &first))
	require.Equal(t, "/v1/chat/completions", first["url"])

	// 智谱 /v4
	lines = strings.Split(strings.TrimSpace(buildBatchJSONL(items, "/v4/chat/completions")), "\n")
	require.Len(t, lines, 1)
	require.NoError(t, json.Unmarshal([]byte(lines[0]), &first))
	require.Equal(t, "/v4/chat/completions", first["url"])
}