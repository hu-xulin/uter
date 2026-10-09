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

// ApplyCascade 若启用且当前模型非级联档，重写为级联廉价模型（第一档）。
// 升级到贵模型由 IsCascadeRefusal 在响应阶段判定，handler 据此重发。
func ApplyCascade(req *dto.GeneralOpenAIRequest, info *relaycommon.RelayInfo) bool {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.CascadeEnabled || cfg.CascadeCheapModel == "" {
		return false
	}
	originModel := ""
	if info != nil {
		originModel = info.OriginModelName
	}
	if matchConfiguredModel(req.Model, originModel, cfg.CascadeCheapModel) ||
		matchConfiguredModel(req.Model, originModel, cfg.CascadePremiumModel) {
		return false
	}
	// 价值层模型（Groq 等 serverless 廉价端点）本身就是「便宜档」，不该再被级联
	// 降到廉价档：两者若指向不同渠道，改写后的模型所在渠道不会被重新选中 → 503/404。
	//
	// 判定不能只依赖 cfg.ValueTierModels —— 那是「允许下沉的**来源**模型白名单」
	// （见 ValueTierMatch），而这里要排除的是「**下沉目标**端点」，两者语义相反。
	// 实测：把来源白名单置空（正确用法，表示不限来源）后，本守卫随之失效，
	// 导致已下沉到价值层的请求又被改写成廉价档并发往价值层渠道 → 上游 404。
	// 故这里改为按等价组的**目标模型**判定，即价值层真正会选中的那些端点。
	if isValueTierTarget(req.Model, originModel, cfg) {
		return false
	}
	req.Model = cfg.CascadeCheapModel
	return true
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
