package costopt

// 模型保真（model fidelity）不变量测试。
//
// 客户选择某个大模型，服务方就必须用那个模型服务。把 claude-sonnet 的请求悄悄
// 改写成 groq-gpt-oss，即便"更便宜"，也违反客户明确的要求——他们买的是特定模型
// 的能力与行为。降本只能来自**语义等价的效率优化**，绝不能来自替换模型。
//
// 本文件把这条不变量写成可执行断言，防止将来重构时被无意破坏。

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
	costoptcfg "github.com/uter-ai/uter/setting/costopt"
)

// withConfig 复用同包 costopt_extra_test.go 中的实现（返回指针原地修改 + 自动还原）。

// TestModelFidelity_PlanModelRewriteNeverChangesModel 是本文件最核心的断言：
// 即使把四个「换模型」开关全部打开，PlanModelRewrite 也必须返回原模型名。
//
// 只要这条测试是绿的，就证明 relay 主链路上不存在"客户选 A、服务端换 B"的路径。
func TestModelFidelity_PlanModelRewriteNeverChangesModel(t *testing.T) {
	models := []string{
		"claude-opus-4-5",
		"claude-sonnet-4-6",
		"claude-haiku-4-5-20251001",
		"gemini-3.5-flash",
		"gpt-4o",
	}

	for _, model := range models {
		t.Run(model, func(t *testing.T) {
			// 把所有可能改写模型的开关都打开——即使这样也不能改。
			withConfig(t, func(c *costoptcfg.CostOptSetting) {
				c.ValueTierMode = "on"
				c.ValueTierEnabled = true
				c.ValueTierModels = []string{"grok-gpt-oss-120b"}
				c.ValueTierModelEquivalents = map[string][]string{
					model: {"grok-gpt-oss-120b"},
				}
				c.ValueTierMinPromptChars = 1
				c.ComplexityRoutingEnabled = true
				c.ComplexityRoutingCheapModel = "sf-qwen3-8b"
				c.CascadeEnabled = true
				c.CascadePremiumModel = "sf-qwen3-32b"
				c.CascadeCheapModel = "sf-qwen3-8b"
				c.RouterLMEnabled = true
				c.RouterLMFromModels = []string{"claude-opus-4-5", "gpt-4o"}
				c.RouterLMAPIBaseURL = "https://example.invalid/v1"
				c.RouterLMAPIKey = "sk-test"
				c.RouterLMModel = "openai/gpt-oss-120b"
			})

			req := &dto.GeneralOpenAIRequest{
				Model: model,
				Messages: []dto.Message{
					{Role: "user", Content: "hi"},
				},
			}
			got := PlanModelRewrite(req)
			assert.Equal(t, model, got, "模型保真：绝不能把客户选择的 %q 换成其他模型", model)
			assert.Equal(t, model, req.Model, "请求体里的模型名也不得被改写")
		})
	}
}

// TestModelFidelity_RewriteCostoptModelForRoutingIsNoop 验证 middleware 入口同样不改写。
func TestModelFidelity_RewriteCostoptModelForRoutingIsNoop(t *testing.T) {
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.ValueTierMode = "on"
		c.ValueTierEnabled = true
		c.ValueTierModels = []string{"grok-gpt-oss-120b"}
		c.ValueTierModelEquivalents = map[string][]string{"claude-opus-4-5": {"grok-gpt-oss-120b"}}
		c.ValueTierMinPromptChars = 1
	})

	req := &dto.GeneralOpenAIRequest{
		Model:    "claude-opus-4-5",
		Messages: []dto.Message{{Role: "user", Content: "hi"}},
	}
	assert.Equal(t, "claude-opus-4-5", RewriteCostoptModelForRouting(req, "claude-opus-4-5"),
		"middleware选路入口也必须原样返回客户选的模型")
}

// TestModelFidelity_SemCacheKeyIsolatesModelAndTenant 锁定语义缓存的跨模型隔离。
//
// 这是修复前的真实漏洞：语义缓存曾用**单个全局 Redis key**，导致 A 模型的回答
// 会被返回给请求 B 模型的客户。修复后键必须按「模型 + 租户」分桶。
func TestModelFidelity_SemCacheKeyIsolatesModelAndTenant(t *testing.T) {
	claude := semVecKey("claude-opus-4-5", 100)
	gpt := semVecKey("gpt-4o", 100)
	otherUser := semVecKey("claude-opus-4-5", 200)

	assert.NotEqual(t, claude, gpt,
		"不同模型必须落在不同缓存桶，绝不能把claude 的回答返回给 gpt 客户")
	assert.NotEqual(t, claude, otherUser,
		"不同租户必须落在不同缓存桶（租户隔离红线）")

	// 同模型 + 同租户 → 同一个桶（否则缓存永不命中，降本失效）。
	assert.Equal(t, claude, semVecKey("claude-opus-4-5", 100),
		"同模型同租户必须复用同一桶")

	// 大小写/空白差异不应导致桶分裂（否则命中率被无谓削弱）。
	assert.Equal(t, claude, semVecKey("  CLAUDE-OPUS-4-5  ", 100),
		"模型名大小写与空白应被规整，避免同模型分裂成多个桶")

	// 模型缺失时归入独立桶，宁可不命中也不能到处复用。
	assert.Equal(t, semVecKey("", 100), semVecKey("", 100))
	assert.NotEqual(t, semVecKey("", 100), claude,
		"模型名缺失时必须落在独立桶，不能与具名模型混用")
}

// TestModelFidelity_SemCacheKeyPrefix 确认键仍以原namespace 开头，便于运维清理/监控。
func TestModelFidelity_SemCacheKeyPrefix(t *testing.T) {
	key := semVecKey("gpt-4o", 7)
	assert.True(t, strings.HasPrefix(key, semVecListKey),
		"语义缓存键应保留原namespace 前缀 %q，实际=%q", semVecListKey, key)
}

// TestModelFidelity_ResponseCacheKeyIncludesModel 确认精确缓存一直把模型纳入键。
// 精确缓存实现上原本就是正确的，这里作为对照，防止将来被改成不含模型。
func TestModelFidelity_ResponseCacheKeyIncludesModel(t *testing.T) {
	info := &relaycommon.RelayInfo{UserId: 42}
	mk := func(model string) string {
		return CacheKey(&dto.GeneralOpenAIRequest{
			Model:    model,
			Messages: []dto.Message{{Role: "user", Content: "hi"}},
		}, info)
	}
	require.NotEqual(t, mk("claude-opus-4-5"), mk("gpt-4o"),
		"精确缓存键必须区分模型")
}

// TestModelFidelity_LockConstant 记录模型保真锁是常态而非可切换项。
func TestModelFidelity_LockConstant(t *testing.T) {
	assert.True(t, ModelFidelityLocked, "模型保真锁必须恒为开启")
	assert.Contains(t, ModelRewriteDisabledReason, "模型保真",
		"停用原因应明确指向模型保真原则，便于后台向运营解释")
}

// TestModelFidelity_ArbitrageNeverSubstitutesModel 覆盖套利路径。
//
// 这是保真重构**之后才发现**的真实漏洞：ArbitrageCandidates 原本受
// ArbitragePreferSameModelOnly 控制，置 false 时退化为「去供应商前缀的基准名匹配」，
// 于是价目表里一个 {"gpt-4o": 1.5} 就能把 claude-sonnet 的请求改写成 gpt-4o。
// ApplyArbitrage 里还有一条更直接的兜底分支：价目表未命中就用
// ArbitrageFallbackModel 换模型。两条都必须在任意配置下失效。
func TestModelFidelity_ArbitrageNeverSubstitutesModel(t *testing.T) {
	// 构造一个足以让旧逻辑换掉模型的价目表：基准名不同、且配了兜底模型。
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.ArbitrageMode = "manual"
		c.ArbitragePreferSameModelOnly = false // 旧逻辑据此放开跨模型替换
		c.ArbitrageModelPrices = map[string]float64{
			"gpt-4o":      1.5,
			"groq/gpt-4o": 0.2,
		}
		c.ArbitrageFallbackModel = "gpt-4o-mini"
	})

	req := &dto.GeneralOpenAIRequest{
		Model:    "claude-opus-4-5",
		Messages: []dto.Message{{Role: "user", Content: "hi"}},
	}
	assert.False(t, ApplyArbitrage(req), "ApplyArbitrage 不得再有任何改写行为")
	assert.Equal(t, "claude-opus-4-5", req.Model,
		"模型保真：套利不得把客户选择的 claude-opus-4-5 换成 gpt-4o / gpt-4o-mini")
}

// TestModelFidelity_ArbitrageCandidatesAreSameModelName 锁定候选集只能含同一模型名。
//
// 覆盖两种配置：同模型限定开/关，都必须只认完整模型名精确匹配。
func TestModelFidelity_ArbitrageCandidatesAreSameModelName(t *testing.T) {
	for _, sameOnly := range []bool{true, false} {
		withConfig(t, func(c *costoptcfg.CostOptSetting) {
			c.ArbitrageMode = "manual"
			c.ArbitragePreferSameModelOnly = sameOnly
			c.ArbitrageModelPrices = map[string]float64{
				"gpt-4o":      1.5,
				"groq/gpt-4o": 0.2, // 去掉前缀后基准名相同 → 旧逻辑会当成同模型候选
				"gpt-4o-mini": 0.1, // 明显不同模型 → 任何逻辑都不该放行
			}
		})

		cands := ArbitrageCandidates("gpt-4o")
		require.Len(t, cands, 1, "同模型限定=%v 时，gpt-4o 的候选只能是它自己", sameOnly)
		assert.Equal(t, "gpt-4o", cands[0].Name,
			"候选集不得包含 groq/gpt-4o（带供应商前缀即不同名）或 gpt-4o-mini（不同模型）")

		assert.Empty(t, ArbitrageCandidates("claude-opus-4-5"),
			"价目表里没有任何 claude-opus-4-5 条目，不应产生候选")
	}
}

// TestModelFidelity_SameModelArbitrageStillPicksCheapest 确认保真收紧后
// 「同一模型跨渠道比价」这个真实降本能力没有被误伤。
func TestModelFidelity_SameModelArbitrageStillPicksCheapest(t *testing.T) {
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.ArbitrageMode = "manual"
		c.ArbitragePriceSource = "manual"
		c.ArbitrageModelPrices = map[string]float64{
			"gpt-4o":      1.5,
			"gpt-4o-mini": 0.1,
		}
	})

	cands := ArbitrageCandidates("gpt-4o")
	require.Len(t, cands, 1)
	assert.Equal(t, "gpt-4o", cands[0].Name)
	// 价目表里 gpt-4o 只有一个报价，比价结果自然就是它本身——模型不变。
	assert.Equal(t, float64(1.5), cands[0].Price)
}
