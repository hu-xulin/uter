package costopt

import (
	"bytes"
	"context"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"

	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
)

// 本文件用**真实降本代码**模拟一份工作负载，量化「降本优化开启 vs 关闭」在
// 上游（Uter 付给供应商）token 成本上的差异。
//
// 重要前提（来自 costopt_fidelity_test.go 的模型保真红线）：
//   开启降本**不会**把客户选的模型换成更便宜的模型。所有「换模型」类特性
//   （套利改写 / 级联 / 复杂度路由 / RouterLM / 价值层下沉）都是硬 no-op。
//   因此真实可量化的节省只来自无损特性：
//     - 精确缓存：相同请求命中后 0 次上游调用（缓存命中仍按量计费给终端用户，
//       但 Uter 的上游支出为 0）；
//     - 同模型跨渠道比价：同一个模型名走更便宜的渠道（模型名不变，仅换通道）。

const (
	reqPromptTokens     = 500
	reqCompletionTokens = 300
	reqTotalTokens      = reqPromptTokens + reqCompletionTokens // 单次请求"本应打上游"的 token 量
)

// simulateRequest 对一个请求跑一遍与 compatible_handler.go:252-274 一致的缓存逻辑。
// 返回本次请求"打到上游的 token 数"（缓存命中时为 0）。
func simulateRequest(ctx context.Context, req *dto.GeneralOpenAIRequest, info *relaycommon.RelayInfo, on bool) int {
	if !on || !CacheEnabled() {
		return reqTotalTokens // 关闭：每次都打上游
	}
	key := CacheKey(req, info)
	data, owner := ReserveOrGet(ctx, key)
	if !owner {
		_ = data
		IncCacheHit()
		return 0 // 缓存命中：上游 0 调用
	}
	// owner：打上游，成功后回写缓存（与 StoreIfCachable 的真实门控一致）。
	buf := bytes.NewBufferString(`{"id":"x","choices":[],"usage":{"prompt_tokens":500,"completion_tokens":300,"total_tokens":800}}`)
	StoreIfCachable(ctx, key, buf, reqCompletionTokens)
	ReleaseOwner(key)
	return reqTotalTokens
}

func cacheWorkload(ctx context.Context, userId int, numReqs, numDistinct int, on bool) int {
	var upstream int
	for i := 0; i < numReqs; i++ {
		// numDistinct 个不同 prompt 间循环：numDistinct==numReqs 即每个请求都唯一。
		prompt := "hot-prompt-" + strconv.Itoa(i%numDistinct)
		req := &dto.GeneralOpenAIRequest{
			Model:    "gpt-4o",
			Messages: []dto.Message{{Role: "user", Content: prompt}},
		}
		info := &relaycommon.RelayInfo{UserId: userId}
		upstream += simulateRequest(ctx, req, info, on)
	}
	return upstream
}

// TestCostOptOnOffDifference_Cache 用真实缓存代码测「重复 prompt 负载」的开/关差异。
func TestCostOptOnOffDifference_Cache(t *testing.T) {
	useCostOptMiniRedis(t)
	withCacheConfig(t, 300, 4096)
	withConfig(t, func(c *costoptcfg.CostOptSetting) { c.MetricsEnabled = true })
	resetMetrics(t)

	ctx := context.Background()
	const numReqs = 1000

	scenarios := []struct {
		label       string
		userId      int
		numDistinct int
	}{
		{"高重复（5 个不同 prompt 循环）", 1001, 5},
		{"中重复（50 个不同 prompt 循环）", 1002, 50},
		{"零重复（1000 个唯一 prompt）", 1003, 1000}, // numDistinct==numReqs -> 每个请求都不同
	}

	offBaseline := numReqs * reqTotalTokens // 关闭时每个请求都打上游

	t.Logf("=== 精确缓存：%d 次请求、单次 %d token 的上游成本对比 ===", numReqs, reqTotalTokens)
	for _, sc := range scenarios {
		onUpstream := cacheWorkload(ctx, sc.userId, numReqs, sc.numDistinct, true)
		saved := offBaseline - onUpstream
		pct := 0.0
		if offBaseline > 0 {
			pct = float64(saved) / float64(offBaseline) * 100
		}
		t.Logf("  [%s]", sc.label)
		t.Logf("    OFF 上游 token: %d", offBaseline)
		t.Logf("    ON  上游 token: %d（缓存命中 %d 次）", onUpstream, MetricsSnapshotNow().CacheHits)
		t.Logf("    节省: %d token (%.1f%%)", saved, pct)
		require.LessOrEqual(t, onUpstream, offBaseline, "开启缓存的上游成本不应超过关闭时")
		resetMetrics(t) // 清计数器，避免跨场景累加干扰日志
	}
}

// TestCostOptOnOffDifference_Arbitrage 用真实 ArbitrageCandidates 测「同模型跨渠道比价」的开/关差异。
func TestCostOptOnOffDifference_Arbitrage(t *testing.T) {
	useCostOptMiniRedis(t)
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.MetricsEnabled = true
		c.ArbitrageMode = "manual"
		// 运营在价目表里登记了同一模型「gpt-4o」的更便宜渠道报价。
		c.ArbitrageModelPrices = map[string]float64{"gpt-4o": 0.5}
	})
	resetMetrics(t)

	const refPrice = 2.0 // OFF：未开套利，走默认渠道单价（示例 $2.0 / 1M token）
	model := "gpt-4o"
	const tokens = 1_000_000 // 100 万 token 负载
	offCost := float64(tokens) / 1e6 * refPrice

	// ON：用真实 ArbitrageCandidates 取同模型最便宜渠道价（模型名不变）。
	onPrice := refPrice
	if cands := ArbitrageCandidates(model); len(cands) > 0 {
		onPrice = cands[0].Price
	}
	onCost := float64(tokens) / 1e6 * onPrice
	saved := offCost - onCost
	pct := saved / offCost * 100

	t.Logf("=== 同模型跨渠道比价（价格路由）：100 万 token 成本对比 ===")
	t.Logf("  OFF（默认渠道）: $%.2f @ $%.2f/1M", offCost, refPrice)
	t.Logf("  ON （同模型最便宜渠道）: $%.2f @ $%.2f/1M", onCost, onPrice)
	t.Logf("  节省: $%.2f (%.1f%%)", saved, pct)
	require.Less(t, onCost, offCost, "开启比价后成本应更低")
}

// TestCostOptOnOff_ModelFidelityNoSaving 锁定：开启降本**不会**换模型，
// 因此「换模型降本」这一最大理论杠杆实际为 0——真实差异只来自无损特性。
func TestCostOptOnOff_ModelFidelityNoSaving(t *testing.T) {
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.ValueTierMode = "on"
		c.ValueTierEnabled = true
		c.ValueTierModels = []string{"grok-gpt-oss-120b"}
		c.ValueTierModelEquivalents = map[string][]string{"claude-opus-4-5": {"grok-gpt-oss-120b"}}
		c.ComplexityRoutingEnabled = true
		c.ComplexityRoutingCheapModel = "sf-qwen3-8b"
		c.CascadeEnabled = true
		c.CascadeCheapModel = "sf-qwen3-8b"
		c.RouterLMEnabled = true
		c.RouterLMModel = "openai/gpt-oss-120b"
		c.ArbitrageMode = "manual"
		c.ArbitragePreferSameModelOnly = false
		c.ArbitrageModelPrices = map[string]float64{"gpt-4o": 1.5, "groq/gpt-4o": 0.2}
	})

	models := []string{"claude-opus-4-5", "gpt-4o", "gemini-3.5-flash"}
	for _, m := range models {
		req := &dto.GeneralOpenAIRequest{Model: m, Messages: []dto.Message{{Role: "user", Content: "hi"}}}
		got := PlanModelRewrite(req)
		// 即便降本全开，模型名也必须原样返回 —— 换模型类特性是 no-op。
		assert.Equal(t, m, got, "开启降本不得改写客户选择的模型 %q", m)
	}
	t.Log("模型保真锁生效：开启降本不会替换模型，故「换模型降本」实际节省 = 0；真实差异只来自缓存/比价/批处理/RAG 等无损特性。")
}
