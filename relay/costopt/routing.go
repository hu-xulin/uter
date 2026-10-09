package costopt

import (
	"strings"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"

	"github.com/uter-ai/uter/relaykit/dto"
)

// ApplyComplexityRouting 轻量复杂度路由：对未显式固定模型的简单任务，启发式降级到便宜模型。
// 保守策略：仅当 FromModels 为空（任意源模型）或命中列表，且启发式判定为"简单"才改写 Model。
// 不改 max_tokens，避免影响依赖长输出的客户端；改写后仍走正常计费/缓存路径。
func ApplyComplexityRouting(req *dto.GeneralOpenAIRequest, info any) bool {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.ComplexityRoutingEnabled || cfg.ComplexityRoutingCheapModel == "" {
		return false
	}
	if req.Model == "" || req.Model == cfg.ComplexityRoutingCheapModel {
		return false
	}
	if len(cfg.ComplexityRoutingFromModels) > 0 {
		hit := false
		for _, m := range cfg.ComplexityRoutingFromModels {
			if m == req.Model {
				hit = true
				break
			}
		}
		if !hit {
			return false
		}
	}
	if isLikelySimple(req) {
		req.Model = cfg.ComplexityRoutingCheapModel
		return true
	}
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
