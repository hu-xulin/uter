package costopt

import (
	"github.com/uter-ai/uter/relaykit/dto"
	costoptcfg "github.com/uter-ai/uter/setting/costopt"
)

// ApplyToolCallDedup 去除对话中连续重复的相同工具结果（role=tool 且内容相同），
// 降低 Agent 多轮重复调用同一工具/检索的浪费。best-effort，解析失败不修改。
func ApplyToolCallDedup(req *dto.GeneralOpenAIRequest) bool {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.ToolCallDedupEnabled || len(req.Messages) == 0 {
		return false
	}
	out := make([]dto.Message, 0, len(req.Messages))
	seen := map[string]bool{}
	modified := false
	for _, m := range req.Messages {
		if m.Role == "tool" {
			key := m.StringContent()
			if key != "" && seen[key] {
				modified = true
				continue // 跳过重复的同一工具结果
			}
			if key != "" {
				seen[key] = true
			}
		}
		out = append(out, m)
	}
	if modified {
		req.Messages = out
	}
	return modified
}
