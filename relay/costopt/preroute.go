package costopt

import (
	"github.com/uter-ai/uter/relaykit/dto"
	costoptcfg "github.com/uter-ai/uter/setting/costopt"
)

// 选渠道之前（middleware/distributor 阶段）跑的模型改写规划。
//
// # 为什么需要「前置」
//
// 渠道在 middleware.Distribute 里选定，而所有 costopt 模型改写钩子原本都挂在
// relay/compatible_handler.go 的 TextHelper 里 —— 也就是**选渠道之后**。于是：
//
//	请求 claude-haiku-4-5（distributor 选中渠道 20）
//	  → ApplyValueTierRouting 把模型改成 groq-gpt-oss-120b
//	  → 但渠道不会重选，仍发往渠道 20（它不认识这个模型）
//	  → 503 / 上游 404
//
// 这就是 RouterLM 与价值层此前无法启用的根因：跨渠道改写必然打空。
//
// 本文件把这些「只改模型名、不碰 messages」的钩子提前到选渠道之前跑，让 distributor
// 直接用改写后的模型名去选渠道，后续TextHelper 阶段它们已是 no-op（幂等，见各Apply*）。
//
// # 边界（重要）
//
// 只有**改模型名**的钩子能前置。依赖上游响应或 messages 内容的钩子仍留在 TextHelper：
//   - RAG 注入 / Prompt 压缩 / 工具精简：改messages，前置会让 distributor 解析一个
//     与最终发送内容不同的 body，且这些钩子不影响选路。
//   - Cascade 升级：需要响应阶段判定拒答，属响应期行为。
//
// 前置后仍保留 TextHelper 里的调用作为兜底（幂等），这样即便将来有人在 relay 链路
// 绕过 distributor 直接进入 TextHelper，行为也不会退化。

// PlanModelRewrite 在选渠道之前应用所有「仅改模型名」的降本钩子。
//
// req 只需带 Model 与 Messages 字段（RouterLM 的选模提示词要看最后一条 user 消息）。
// 返回被改写后的模型名；未发生改写时返回原值。
//
// 调用方需要在改写后**回写请求体**（body 的 model 字段），否则 distributor 与
// relay 看到的仍是旧模型名。
func PlanModelRewrite(req *dto.GeneralOpenAIRequest) string {
	if req == nil || req.Model == "" {
		return ""
	}

	before := req.Model

	// 1) 价值层：把 serverless 开源模型的等价高档（claude/gemini 等）下沉到廉价端点。
	//    必须最先跑：它决定「这个请求该不该进便宜档」，后面的钩子都在便宜档内部做选择。
	ApplyValueTierRouting(req)
	if req.Model != before {
		return req.Model
	}

	// 2) 复杂度路由：短问题下沉到廉价模型（仅同渠道/跨渠道皆可，因已前置）。
	before = req.Model
	ApplyComplexityRouting(req, nil)
	if req.Model != before {
		return req.Model
	}

	// 3) 级联：任意模型降到廉价档。
	//    ⚠️ 只在前面都没做选择时兜底。Cascade 语义是「最后兜底的降级」，若无条件执行，
	//    会把价值层/复杂度路由已选好的模型（乃至更便宜的价值层端点）覆盖成廉价档，
	//    两个降本特性互相打架、白白浪费上游预算。
	ApplyCascade(req, nil)

	// 4) RouterLM：让小模型基于问题内容选最优上游（必须最后，它可能推翻前面的选择）。
	ApplyRouterLM(req, nil)

	return req.Model
}

// RewriteCostoptModelForRouting 便于 middleware 层复用：对原始请求体做规划并回写。
// 返回改写后的模型名（未改写则返回入参 original）。
func RewriteCostoptModelForRouting(req *dto.GeneralOpenAIRequest, original string) string {
	cfg := costoptcfg.GetCostOptSetting()
	// 任一改路特性都没开时不解析整个请求体，省掉一次 JSON 解码开销。
	if !cfg.ValueTierActive() && !cfg.ComplexityRoutingEnabled && !cfg.CascadeEnabled && !cfg.RouterLMEnabled {
		return original
	}
	if PlanModelRewrite(req) == "" {
		return original
	}
	return req.Model
}