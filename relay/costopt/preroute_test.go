package costopt

import (
	"testing"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"

	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/relaykit/dto"
)

// ----- 选渠道前置改路（preroute） -----
//
// 前置改路的意义：渠道在 middleware/distributor 阶段选定，之后再改模型名不会重选渠道，
// 跨渠道改写必然打空（503/404）。这组测试锁定「改写确实发生且顺序正确」。

func TestPlanModelRewrite_AllDisabled(t *testing.T) {
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.CascadeEnabled = false
		c.ComplexityRoutingEnabled = false
		c.RouterLMEnabled = false
		c.ValueTierMode = "off"
	})
	req := &dto.GeneralOpenAIRequest{Model: "claude-sonnet-4-6"}
	require.Equal(t, "claude-sonnet-4-6", PlanModelRewrite(req),
		"所有改路特性关闭时不应改写模型名")
}

func TestPlanModelRewrite_NilRequest(t *testing.T) {
	require.Equal(t, "", PlanModelRewrite(nil))
}

func TestPlanModelRewrite_EmptyModel(t *testing.T) {
	require.Equal(t, "", PlanModelRewrite(&dto.GeneralOpenAIRequest{}))
}

func TestPlanModelRewrite_CascadeRunsFirstTier(t *testing.T) {
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.CascadeEnabled = true
		c.CascadeCheapModel = "cheap-model"
		c.CascadePremiumModel = "premium-model"
		c.ComplexityRoutingEnabled = false
		c.RouterLMEnabled = false
		c.ValueTierMode = "off"
		c.ValueTierModels = nil
	})
	req := &dto.GeneralOpenAIRequest{Model: "some-frontier-model"}
	require.Equal(t, "some-frontier-model", PlanModelRewrite(req),
		"模型保真：即使 Cascade 开启也不得把任意模型降到廉价档")
}

// 已在廉价档的请求不应被重复改写（前置后 relay 侧还会再跑一次，需保证幂等）。
func TestPlanModelRewrite_IdempotentForCascadeTier(t *testing.T) {
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.CascadeEnabled = true
		c.CascadeCheapModel = "cheap-model"
		c.CascadePremiumModel = "premium-model"
		c.ComplexityRoutingEnabled = false
		c.RouterLMEnabled = false
		c.ValueTierMode = "off"
		c.ValueTierModels = nil
	})
	req := &dto.GeneralOpenAIRequest{Model: "cheap-model"}
	require.Equal(t, "cheap-model", PlanModelRewrite(req))
	require.Equal(t, "premium-model", PlanModelRewrite(&dto.GeneralOpenAIRequest{Model: "premium-model"}),
		"贵档同样保持不变（模型保真）")
}

// 价值层模型本身就是便宜档，不应再被级联降到廉价档（否则会指向别的渠道）。
func TestPlanModelRewrite_CascadeSkipsValueTierModel(t *testing.T) {
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.CascadeEnabled = true
		c.CascadeCheapModel = "cheap-model"
		c.CascadePremiumModel = "premium-model"
		c.ComplexityRoutingEnabled = false
		c.RouterLMEnabled = false
		c.ValueTierMode = "off"
		c.ValueTierModels = []string{"value-tier-model"}
	})
	req := &dto.GeneralOpenAIRequest{Model: "value-tier-model"}
	require.Equal(t, "value-tier-model", PlanModelRewrite(req),
		"价值层模型不该被级联抢走")
}

// RewriteCostoptModelForRouting 未改写时必须回传入参原值（middleware 依赖该契约）。
func TestRewriteCostoptModelForRouting_NoopReturnsOriginal(t *testing.T) {
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.CascadeEnabled = false
		c.ComplexityRoutingEnabled = false
		c.RouterLMEnabled = false
		c.ValueTierMode = "off"
	})
	req := &dto.GeneralOpenAIRequest{Model: "frontier"}
	require.Equal(t, "frontier", RewriteCostoptModelForRouting(req, "frontier"))
}

func TestRewriteCostoptModelForRouting_ReportsRewrite(t *testing.T) {
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.CascadeEnabled = true
		c.CascadeCheapModel = "cheap"
		c.CascadePremiumModel = "premium"
		c.ComplexityRoutingEnabled = false
		c.RouterLMEnabled = false
		c.ValueTierMode = "off"
		c.ValueTierModels = nil
	})
	req := &dto.GeneralOpenAIRequest{Model: "frontier"}
	require.Equal(t, "frontier", RewriteCostoptModelForRouting(req, "frontier"),
		"模型保真：middleware 入口不得返回新模型名，必须原样透传客户选择的模型")
}

// Cascade 必须在价值层/复杂度路由已做选择时让位，否则两个降本特性互相覆盖。
//
// 真实语义：价值层端点被列在 ValueTierModels 里时，Cascade 的白名单会主动排除它
// （见 relay/costopt/cascade.go 里对 cfg.ValueTierModels 的遍历），故这里断言的是
// 「价值层端点不会被 Cascade 抢走」这一既有契约，与执行顺序共同构成双保险。
func TestPlanModelRewrite_ValueTierWinsOverCascade(t *testing.T) {
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.ValueTierMode = "off" // 价值层钩子本身 no-op，只用其白名单配置
		c.ValueTierModels = []string{"value-tier-model"}
		c.ValueTierModelEquivalents = nil
		c.CascadeEnabled = true
		c.CascadeCheapModel = "cascade-cheap"
		c.CascadePremiumModel = "cascade-premium"
		c.ComplexityRoutingEnabled = false
		c.RouterLMEnabled = false
	})
	req := &dto.GeneralOpenAIRequest{Model: "value-tier-model"}
	require.Equal(t, "value-tier-model", PlanModelRewrite(req),
		"已在价值层端点上的请求不应被 Cascade 覆盖成廉价档")
}

// 模型保真：Cascade 兜底降级已整体停用，客户选择的模型必须原样保留。
func TestPlanModelRewrite_CascadeStillRunsWhenNoOtherHookFired(t *testing.T) {
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.ValueTierMode = "off"
		c.ValueTierModels = []string{"value-tier-model"}
		c.ValueTierModelEquivalents = nil
		c.CascadeEnabled = true
		c.CascadeCheapModel = "cascade-cheap"
		c.CascadePremiumModel = "cascade-premium"
		c.ComplexityRoutingEnabled = false
		c.RouterLMEnabled = false
	})
	req := &dto.GeneralOpenAIRequest{Model: "claude-opus-4-5"}
	require.Equal(t, "claude-opus-4-5", PlanModelRewrite(req),
		"模型保真：Cascade 不得兜底降级客户选择的模型")
}

// 模型保真：价值层与复杂度路由均已停用，模型名必须保持不变。
// 这里用真实施行：ValueTierModelEquivalents 指向 Cascade 廉价档自身的反面 ——
// 若 Cascade 仍被执行，结果会变成 cascade-cheap（错误），正确应停在价值层端点。
func TestPlanModelRewrite_PriorityValueTierBeforeCascade(t *testing.T) {
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.ValueTierMode = "off"
		c.ValueTierModels = nil
		c.ValueTierModelEquivalents = nil
		c.CascadeEnabled = true
		c.CascadeCheapModel = "cascade-cheap"
		c.CascadePremiumModel = "cascade-premium"
		c.ComplexityRoutingEnabled = true
		c.ComplexityRoutingCheapModel = "complexity-cheap"
		c.ComplexityRoutingFromModels = []string{"frontier"}
		c.RouterLMEnabled = false
	})
	// 复杂度路由先命中 → Cascade 必须让位
	req := &dto.GeneralOpenAIRequest{
		Model:    "frontier",
		Messages: []dto.Message{{Role: "user", Content: "你好"}},
	}
	require.Equal(t, "frontier", PlanModelRewrite(req),
		"模型保真：复杂度路由与 Cascade 均不得下沉模型")
}

// 模型保真：复杂度路由已停用，短问题同样不得下沉到别的模型。
func TestPlanModelRewrite_ComplexityWinsOverCascade(t *testing.T) {
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.ValueTierMode = "off"
		c.ComplexityRoutingEnabled = true
		c.ComplexityRoutingCheapModel = "complexity-cheap"
		c.ComplexityRoutingFromModels = []string{"frontier"}
		c.CascadeEnabled = true
		c.CascadeCheapModel = "cascade-cheap"
		c.CascadePremiumModel = "cascade-premium"
		c.RouterLMEnabled = false
	})
	req := &dto.GeneralOpenAIRequest{
		Model:    "frontier",
		Messages: []dto.Message{{Role: "user", Content: "你好"}},
	}
	require.Equal(t, "frontier", PlanModelRewrite(req),
		"模型保真：复杂度路由不得下沉客户选择的模型")
}

// 回归：value_tier_models 置空（= 不限来源，正确用法）时，Cascade 仍必须放过价值层端点。
//
// 背景：ValueTierModels 语义是「允许下沉的**来源**白名单」，而 Cascade 的守卫需要排除
// 的是「**下沉目标**」。二者语义相反，早期实现只查前者，导致来源白箱一置空守卫即失效，
// 已下沉到价值层的请求又被改写成廉价档并发往价值层渠道 → 上游 404 model_not_found。
func TestPlanModelRewrite_CascadeSkipsValueTierTargetWhenSourceListEmpty(t *testing.T) {
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.ValueTierMode = "off" // 只用等价组配置，不触发真实下沉（无定价）
		c.ValueTierModels = nil // 来源白名单置空 = 不限来源
		c.ValueTierModelEquivalents = map[string][]string{
			"claude-sonnet-4-6": {"groq-gpt-oss-120b"},
		}
		c.CascadeEnabled = true
		c.CascadeCheapModel = "sf-qwen3-8b"
		c.CascadePremiumModel = "sf-qwen3-32b"
		c.ComplexityRoutingEnabled = false
		c.RouterLMEnabled = false
	})
	// 请求已在价值层端点 groq-gpt-oss-120b 上（前置阶段已完成下沉）
	req := &dto.GeneralOpenAIRequest{Model: "groq-gpt-oss-120b"}
	require.Equal(t, "groq-gpt-oss-120b", PlanModelRewrite(req),
		"价值层端点不应被 Cascade 改写成 sf-qwen3-8b（否则会发往错误渠道 404）")
}
