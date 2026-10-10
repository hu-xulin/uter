package costopt

import (
	"strings"

	relaycommon "github.com/uter-ai/uter/relay/common"

	"github.com/uter-ai/uter/relaykit/dto"
)

// ApplyComplexityRouting 轻量复杂度路由：**已停用（模型保真）**。
//
// 原实现会把「简单任务」从客户选择的模型下沉到cheap_model（如 claude-opus → gpt-4o-mini）。
// 这属于把客户选择的模型换成另一个模型，违反客户明确要求，现整体停用：
// 恒定返回 false，绝不修改 req.Model。
//
// 保留函数签名以维持既有调用方与配置项。启发式函数（isLikelySimple 等）保留
// 但不再被调用，供将来需要「同模型内精简」时参考。
func ApplyComplexityRouting(req *dto.GeneralOpenAIRequest, info *relaycommon.RelayInfo) bool {
	// 模型保真：不做跨模型下沉。
	return false
}

var complexitySignals = []string{
	"```", "代码", "code", "function", "def ", "class ", "算法", "推理", "分析",
	"为什么", "比较", "设计", "架构", "step by step", "explain", "translate",
	"总结全文", "论文", "推导", "优化方案", "技术方案",
}

// isLikelySimple 启发式：短文本且无复杂度信号 => 简单任务。
func isLikelySimple(req *dto.GeneralOpenAIRequest) bool {
	text := lastUserMessageText(req)
	if len([]rune(text)) > 600 {
		return false
	}
	lower := strings.ToLower(text)
	for _, s := range complexitySignals {
		if strings.Contains(lower, strings.ToLower(s)) {
			return false
		}
	}
	return true
}

func lastUserMessageText(req *dto.GeneralOpenAIRequest) string {
	for i := len(req.Messages) - 1; i >= 0; i-- {
		m := req.Messages[i]
		if m.Role == "user" {
			return m.StringContent()
		}
	}
	return ""
}
