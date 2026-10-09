package costopt

import (
	"strings"

	"github.com/uter-ai/uter/relaykit/dto"
	costoptcfg "github.com/uter-ai/uter/setting/costopt"
)

// DetectLoop 检测最近是否有 >= threshold 条连续相同的用户消息（Agent 死循环信号）。
// 命中返回 true 与重复文本，调用方应直接返回收敛提示而非继续烧上游。
func DetectLoop(req *dto.GeneralOpenAIRequest) (bool, string) {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.LoopDetectionEnabled || cfg.LoopDetectionThreshold <= 0 {
		return false, ""
	}
	var userTexts []string
	for i := len(req.Messages) - 1; i >= 0; i-- {
		if req.Messages[i].Role == "user" {
			t := strings.TrimSpace(req.Messages[i].StringContent())
			if t == "" {
				continue
			}
			userTexts = append(userTexts, t)
			if len(userTexts) >= cfg.LoopDetectionThreshold {
				break
			}
		}
	}
	if len(userTexts) < cfg.LoopDetectionThreshold {
		return false, ""
	}
	ref := userTexts[len(userTexts)-1]
	for _, t := range userTexts {
		if t != ref {
			return false, ""
		}
	}
	return true, ref
}
