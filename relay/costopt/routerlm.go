package costopt

import (
	"context"
	"fmt"
	"strings"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"
	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
)

// ApplyRouterLM 用小型 router 模型替用户选最优上游模型，重写 req.Model。
// best-effort：任何错误/空结果不修改（保持原模型）。
func ApplyRouterLM(req *dto.GeneralOpenAIRequest, info *relaycommon.RelayInfo) bool {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.RouterLMEnabled || cfg.RouterLMModel == "" {
		return false
	}
	if cfg.RouterLMAPIBaseURL == "" || cfg.RouterLMAPIKey == "" {
		return false
	}
	if len(cfg.RouterLMFromModels) > 0 {
		matched := false
		for _, m := range cfg.RouterLMFromModels {
			if m == req.Model {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}
	lastUser := ""
	for i := len(req.Messages) - 1; i >= 0; i-- {
		if req.Messages[i].Role == "user" {
			lastUser = req.Messages[i].StringContent()
			break
		}
	}
	candidates := strings.Join(cfg.RouterLMFromModels, ", ")
	prompt := fmt.Sprintf("从以下候选模型中选择最适合处理该请求的一个，只输出模型名，不要解释：\n候选：%s\n请求：%s", candidates, lastUser)
	chosen, err := openAIChat(context.Background(), cfg.RouterLMAPIBaseURL, cfg.RouterLMAPIKey, cfg.RouterLMModel, "", prompt, 16)
	if err != nil || chosen == "" {
		return false
	}
	chosen = strings.TrimSpace(strings.Trim(chosen, "\"'"))
	if chosen != "" {
		req.Model = chosen
		return true
	}
	return false
}
