package costopt

import (
	"testing"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"
	"github.com/uter-ai/uter/setting/ratio_setting"

	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/relaykit/dto"
)

// ----- 1. Cascade 价格守卫：廉价档必须真比当前模型便宜，否则不降级 -----

func TestCascade_PriceGuardBlocksWhenCheapIsMoreExpensive(t *testing.T) {
	ratio_setting.InitRatioSettings() // 载入默认价目表，gpt-4o(1.25) / gpt-4o-mini(0.075) 才有单价
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.CascadeEnabled = true
		c.CascadeCheapModel = "gpt-4o"       // 贵 (1.25)
		c.CascadePremiumModel = "gpt-4o-32k" // 更贵
		c.ComplexityRoutingEnabled = false
		c.RouterLMEnabled = false
		c.ValueTierMode = "off"
		c.ValueTierModels = nil
		c.MetricsEnabled = true
	})
	// 用户点名最便宜的 gpt-4o-mini，廉价档 gpt-4o 更贵 → 绝不能降级（否则纯亏）。
	req := &dto.GeneralOpenAIRequest{Model: "gpt-4o-mini"}
	before := MetricsSnapshotNow().CascadeHits
	ok := ApplyCascade(req, nil)
	require.False(t, ok, "廉价档比当前模型贵时不应降级")
	require.Equal(t, "gpt-4o-mini", req.Model, "请求模型不应被换成更贵的")
	require.Equal(t, before, MetricsSnapshotNow().CascadeHits, "未改写则不应计入 cascade_hits")
}

func TestCascade_PriceGuardAllowsWhenCheapIsCheaper(t *testing.T) {
	ratio_setting.InitRatioSettings()
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.CascadeEnabled = true
		c.CascadeCheapModel = "gpt-4o-mini" // 便宜 (0.075)
		c.CascadePremiumModel = "gpt-4o-32k"
		c.ComplexityRoutingEnabled = false
		c.RouterLMEnabled = false
		c.ValueTierMode = "off"
		c.ValueTierModels = nil
		c.MetricsEnabled = true
	})
	req := &dto.GeneralOpenAIRequest{Model: "gpt-4o"} // 贵 (1.25)
	before := MetricsSnapshotNow().CascadeHits
	ok := ApplyCascade(req, nil)
	require.False(t, ok, "模型保真：Cascade 已停用，即使廉价档更便宜也不得降级模型")
	require.Equal(t, "gpt-4o", req.Model, "客户选择的模型必须保持不变")
	require.Equal(t, before, MetricsSnapshotNow().CascadeHits, "未发生降级则不应计入 cascade_hits")
}

func TestCascade_PriceGuardRespectsConfigWhenNoPrice(t *testing.T) {
	// 两者都取不到单价时，尊重用户显式配置的 Cascade 意图（允许降级）。
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.CascadeEnabled = true
		c.CascadeCheapModel = "unknown-cheap-model"
		c.CascadePremiumModel = "unknown-premium-model"
		c.ComplexityRoutingEnabled = false
		c.RouterLMEnabled = false
		c.ValueTierMode = "off"
		c.ValueTierModels = nil
	})
	req := &dto.GeneralOpenAIRequest{Model: "unknown-frontier"}
	require.False(t, ApplyCascade(req, nil), "模型保真：Cascade 已停用，定价缺失也不得降级")
	require.Equal(t, "unknown-frontier", req.Model, "客户选择的模型必须保持不变")
}

func TestPlanModelRewrite_KeepsCheapestModelWhenCascadeCheapIsPricier(t *testing.T) {
	ratio_setting.InitRatioSettings()
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.CascadeEnabled = true
		c.CascadeCheapModel = "gpt-4o" // 比 gpt-4o-mini 贵
		c.CascadePremiumModel = "gpt-4o-32k"
		c.ComplexityRoutingEnabled = false
		c.RouterLMEnabled = false
		c.ValueTierMode = "off"
		c.ValueTierModels = nil
	})
	// 用户直接请求最便宜模型，前置改路不应把它换成更贵的廉价档。
	req := &dto.GeneralOpenAIRequest{Model: "gpt-4o-mini"}
	require.Equal(t, "gpt-4o-mini", PlanModelRewrite(req))
}

// ----- 2. 压缩：reasoning 预算预留 + 总量上限 + 空内容告警 -----

func TestIsReasoningModel(t *testing.T) {
	require.True(t, isReasoningModel("openai/gpt-oss-120b"))
	require.True(t, isReasoningModel("deepseek-reasoner"))
	require.True(t, isReasoningModel("qwen-qwq-32b"))
	require.False(t, isReasoningModel("gpt-4o-mini"))
	require.False(t, isReasoningModel(""))
}

func TestCompressionBudget_ReasoningReserve(t *testing.T) {
	// 非 reasoning：输出预算 == 内容预算（contentBudget 直接传入）。
	require.Equal(t, 1000, compressionBudget(1000, 3000, false, 3.0, 0))
	// reasoning：预算按 reserve 倍放大，避免思考吃光 → 空输出。
	require.Equal(t, 3000, compressionBudget(1000, 3000, true, 3.0, 0))
}

func TestCompressionBudget_TotalTokenCap(t *testing.T) {
	// 无上限时即便 reasoning 也不裁剪。
	require.Equal(t, 3000, compressionBudget(1000, 3000, true, 3.0, 0))
	// 上限触发：输出预算被压到上限 - 输入估算（且不低于 64）。
	// 输入估算 = 24000/3 + 8 = 8008；36060 + 8008 远超 7000 → 7000-8008 < 0 → 钳到 64。
	require.Equal(t, 64, compressionBudget(12020, 24000, true, 3.0, 7000))
	// 温和上限：不触发裁剪。
	require.Equal(t, 1000, compressionBudget(1000, 3000, false, 3.0, 7000))
}

// ----- 3. RAG 净收益闸门 -----

func TestRAGNetBenefitPasses(t *testing.T) {
	cfg := &costoptcfg.CostOptSetting{}
	// 默认（闸门关）：永不拦截。
	require.True(t, ragNetBenefitPasses(cfg, "x", nil))

	msgs := []dto.Message{{Role: "user", Content: "短问题"}} // ≈ 3 token
	cfg.RAGNetBenefitEnabled = true
	cfg.RAGInjectedVsPromptTokensRatio = 4.0
	// 注入块远小于 prompt 的倍数 → 放行。
	require.True(t, ragNetBenefitPasses(cfg, "少量上下文片段", msgs))
	// 注入块远大于 prompt（≈ 2000 token vs 3 token）→ 拦截。
	big := ""
	for i := 0; i < 6000; i++ {
		big += "上下文"
	}
	require.False(t, ragNetBenefitPasses(cfg, big, msgs), "注入量远超 prompt 应判为净负、跳过")

	// 绝对上限：超过即拦截（15 字 ≈ 5 token，把上限设到 3 以稳定触发）。
	cfg.RAGInjectedVsPromptTokensRatio = 0 // 关闭比值闸门，仅测绝对上限
	cfg.RAGMaxInjectedTokens = 3
	require.False(t, ragNetBenefitPasses(cfg, "这是一段超过十个字的注入上下文", msgs))
	cfg.RAGMaxInjectedTokens = 0
	require.True(t, ragNetBenefitPasses(cfg, "这是一段超过十个字的注入上下文", msgs))
}

// ----- 4. 各钩子命中率指标（开了但没生效 应可被观测到） -----

func TestMetrics_HookHitCounters(t *testing.T) {
	ratio_setting.InitRatioSettings()
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.MetricsEnabled = true
		c.CascadeEnabled = true
		c.CascadeCheapModel = "gpt-4o-mini"
		c.CascadePremiumModel = "gpt-4o-32k"
		c.ComplexityRoutingEnabled = false
		c.RouterLMEnabled = false
		c.ValueTierMode = "off"
		c.ValueTierModels = nil
	})
	before := MetricsSnapshotNow()
	// 模型保真：Cascade 已停用，无论配置如何都不应发生模型改写与命中计数。
	req := &dto.GeneralOpenAIRequest{Model: "gpt-4o"}
	require.False(t, ApplyCascade(req, nil))
	require.Equal(t, "gpt-4o", req.Model, "客户选择的模型必须保持不变")
	after := MetricsSnapshotNow()
	require.Equal(t, before.CostOptRequests, after.CostOptRequests, "CostOptRequests 只在 relay 钩子段累加，ApplyCascade 直调不应增加分母")
	require.Equal(t, before.CascadeHits, after.CascadeHits, "未发生改写则 CascadeHits 不应增长")
}
