package costopt

import (
	"strings"

	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
	costoptcfg "github.com/uter-ai/uter/setting/costopt"
)

// matchConfiguredModel 判断请求当前模型是否命中配置里填写的模型名。
//
// 降本配置里填的是「网关别名」（客户端请求时用的模型名），但 relay 入口的
// ModelMappedHelper 已经把 request.Model 换成「上游名」了（如别名 sf-qwen3-8b
// 映射成上游 Qwen/Qwen3-8B）。因此两者都要比，否则守卫永远不命中，会把已经
// 在廉价档的请求再次改写、或让升级判定失效。
func matchConfiguredModel(reqModel, originModel, cfgModel string) bool {
	if cfgModel == "" {
		return false
	}
	if reqModel == cfgModel {
		return true
	}
	return originModel != "" && originModel == cfgModel
}

// ApplyCascade LLM 级联：**已停用（模型保真）**。
//
// 原实现把客户选择的模型重写为级联廉价档，并在拒答时升级重发。无论降级还是升级，
// 用的都不是客户点名要的那个模型，违反客户明确要求；且升级重发会让计费与
// 响应语义难以对齐。现整体停用：恒定返回 false，绝不修改 req.Model。
//
// 保留函数签名以维持既有调用方与配置项。
func ApplyCascade(req *dto.GeneralOpenAIRequest, info *relaycommon.RelayInfo) bool {
	// 模型保真：不把模型换成级联档。
	return false
}

// cascadeCheaperThan 判断级联廉价档是否真比当前模型便宜（按每 1M token 美元单价比较）。
// reqModel 是当前模型（可能是上游名），originModel 是网关别名（两者都要试，因模型映射后会变成上游名）。
// 仅当两者都能取到单价、且廉价档严格更便宜时返回 true；任一取不到单价时按「允许降级」处理
// （尊重用户显式配置的 Cascade 意图，不因为定价缺失而架空它）。
func cascadeCheaperThan(reqModel, originModel, cheapModel string) bool {
	cheap := unitPriceOfModel(cheapModel)
	if cheap <= 0 {
		return true
	}
	cur := unitPriceOfModel(reqModel)
	if cur <= 0 {
		cur = unitPriceOfModel(originModel)
	}
	if cur <= 0 {
		return true
	}
	return cheap < cur
}

// isValueTierTarget 判断某模型是否是价值层会下沉到的目标端点。
// 依据是 ValueTierModelEquivalents 的所有 value（等价组定义即「这些高档模型
// 可下沉到这些开源模型」），并兼容 vendor/model 形态的基准名比较。
func isValueTierTarget(reqModel, originModel string, cfg *costoptcfg.CostOptSetting) bool {
	for _, m := range cfg.ValueTierModels {
		if matchConfiguredModel(reqModel, originModel, m) {
			return true
		}
	}
	for _, group := range cfg.ValueTierModelEquivalents {
		for _, target := range group {
			if target == "" {
				continue
			}
			if matchConfiguredModel(reqModel, originModel, target) ||
				baseModelOf(target) == baseModelOf(reqModel) {
				return true
			}
		}
	}
	return false
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
//
// originModel 为客户端请求时的网关模型名：降本配置填的是网关别名，而 request.Model
// 可能已被 model_mapping 换成上游名，两者都要比对（见 matchConfiguredModel）。
func CascadeActiveFor(req *dto.GeneralOpenAIRequest, originModel string) bool {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.CascadeEnabled || cfg.CascadeCheapModel == "" || cfg.CascadePremiumModel == "" {
		return false
	}
	if !matchConfiguredModel(req.Model, originModel, cfg.CascadeCheapModel) {
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
