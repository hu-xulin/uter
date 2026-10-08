package costopt

import (
	"strings"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"
	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
)

// ApplyCascade 若启用且当前模型非级联档，重写为级联廉价模型（第一档）。
// 升级到贵模型由 IsCascadeRefusal 在响应阶段判定，handler 据此重发。
func ApplyCascade(req *dto.GeneralOpenAIRequest, info *relaycommon.RelayInfo) bool {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.CascadeEnabled || cfg.CascadeCheapModel == "" {
		return false
	}
	if req.Model == cfg.CascadeCheapModel || req.Model == cfg.CascadePremiumModel {
		return false
	}
	req.Model = cfg.CascadeCheapModel
	return true
}

// IsCascadeRefusal 判断廉价模型响应是否像拒绝/低质（需升级到贵模型）。
func IsCascadeRefusal(text string) bool {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.CascadeEnabled || cfg.CascadePremiumModel == "" {
		return false
	}
	t := strings.ToLower(text)
	for _, kw := range cfg.CascadeRefusalKeywords {
		if kw != "" && strings.Contains(t, strings.ToLower(kw)) {
			return true
		}
	}
	for _, kw := range []string{"i cannot", "i can't", "i'm unable", "无法", "我不能", "作为人工智能", "as an ai"} {
		if strings.Contains(t, kw) {
			return true
		}
	}
	return false
}

// CascadeActiveFor 判断当前请求是否处于级联降级态且可升级（廉价模型 + 非流式）。
// 仅当启用、请求模型等于廉价模型、且贵模型已配置、且非流式时为 true。
func CascadeActiveFor(req *dto.GeneralOpenAIRequest) bool {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.CascadeEnabled || cfg.CascadeCheapModel == "" || cfg.CascadePremiumModel == "" {
		return false
	}
	if req.Model != cfg.CascadeCheapModel {
		return false
	}
	if req.Stream != nil && *req.Stream {
		return false
	}
	return true
}

// CascadePremiumModelName 返回级联升级目标（贵模型）名称。
func CascadePremiumModelName() string {
	return costoptcfg.GetCostOptSetting().CascadePremiumModel
}
