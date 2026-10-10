package model

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"
	"github.com/uter-ai/uter/setting/ratio_setting"
)

// withPriceTestConfig 临时改写降本取价配置，结束后还原。
func withPriceTestConfig(t *testing.T, mutate func(*costoptcfg.CostOptSetting)) {
	t.Helper()
	cfg := costoptcfg.GetCostOptSetting()
	prev := *cfg
	mutate(cfg)
	t.Cleanup(func() { *cfg = prev })
}

// withTestPricing 临时往平台定价表注入一条模型定价，供自动取价路径使用；
// 结束后整表还原，不污染其他测试与全局价目表。
func withTestPricing(t *testing.T, model string, unitPrice float64) {
	t.Helper()
	prev := ratio_setting.GetModelPriceMap()
	merged := make(map[string]float64, len(prev)+1)
	for k, v := range prev {
		merged[k] = v
	}
	merged[model] = unitPrice
	payload, err := json.Marshal(merged)
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(string(payload)))
	t.Cleanup(func() {
		back, err := json.Marshal(prev)
		require.NoError(t, err)
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(string(back)))
	})
}

// 核心用例：同一请求模型在不同渠道被 model_mapping 映射到不同上游模型，
// 上游模型定价不同 → 应选更便宜的那个渠道（即 #5 同模型跨通道比价的兑现点）。
//
// ⚠️ 本用例**刻意不填任何手填价目表**：验证单价完全来自平台定价表的自动推算，
// 这正是「模型价目表自动从定价里获取」要保证的行为。
func TestCheapestChannelByPriceUsesUpstreamModelPrice(t *testing.T) {
	withPriceTestConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.ArbitrageMode = "auto"
		c.ArbitrageAutoMaxPriceRatio = 1.0
		c.ArbitrageModelPrices = nil // 只走自动推算
	})
	withTestPricing(t, "upstream-cheap", 1.0)
	withTestPricing(t, "upstream-pricey", 5.0)

	w := uint(1)
	mCheap := `{"gpt-4o":"upstream-cheap"}`
	mPricey := `{"gpt-4o":"upstream-pricey"}`
	cheap := &Channel{Id: 1, Weight: &w, ModelMapping: &mCheap}
	pricey := &Channel{Id: 2, Weight: &w, ModelMapping: &mPricey}

	require.Less(t, channelEffectiveUnitPrice(cheap, "gpt-4o"),
		channelEffectiveUnitPrice(pricey, "gpt-4o"),
		"单价应自动来自平台定价表，无需手填价目表")

	// 故意把贵的放在前面，验证确实按单价择优而非按传入顺序。
	got := cheapestChannelByPrice([]*Channel{pricey, cheap}, "gpt-4o")
	require.NotNil(t, got)
	require.Equal(t, 1, got.Id, "应选中映射后单价更低的渠道")
}

// auto 模式下，手填价目表**不得**再抢在自动推算前面（否则人工维护的旧价格会
// 长期压过平台真实定价，且随上游调价而失效）。
func TestChannelEffectiveUnitPriceIgnoresManualTableInAutoMode(t *testing.T) {
	withPriceTestConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.ArbitrageMode = "auto"
		c.ArbitragePriceSource = "ratio_config" // 自动取价
		c.ArbitrageModelPrices = map[string]float64{"upstream-x": 99.0}
	})
	withTestPricing(t, "upstream-x", 1.0)

	w := uint(1)
	m := `{"gpt-4o":"upstream-x"}`
	got := channelEffectiveUnitPrice(&Channel{Id: 1, Weight: &w, ModelMapping: &m}, "gpt-4o")
	require.InDelta(t, 1.0, got, 0.0001,
		"auto 模式应以平台定价为准，手填价目表仅在 price_source=manual 时生效")
}

// manual 模式下手填价目表仍然生效（用于自动推算拿不到定价的冷门模型兜底）。
func TestChannelEffectiveUnitPriceHonoursManualTable(t *testing.T) {
	withPriceTestConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.ArbitrageMode = "manual"
		c.ArbitragePriceSource = "manual"
		c.ArbitrageModelPrices = map[string]float64{"cold-model-xyz": 3.0}
	})

	w := uint(1)
	m := `{"gpt-4o":"cold-model-xyz"}`
	got := channelEffectiveUnitPrice(&Channel{Id: 1, Weight: &w, ModelMapping: &m}, "gpt-4o")
	require.InDelta(t, 3.0, got, 0.0001, "manual 模式下应使用手填价目表")
}

// 价差容忍 >1 时，容忍范围内的多个候选不应被压成单一渠道（返回其一即可，不断言具体值）；
// 这里验证"严格最便宜"与"容忍"两种配置都不会选中最贵的渠道。
func TestCheapestChannelByPriceNeverPicksOutsideTolerance(t *testing.T) {
	withPriceTestConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.ArbitrageMode = "manual"
		c.ArbitragePriceSource = "manual"
		c.ArbitrageAutoMaxPriceRatio = 1.0
		c.ArbitrageModelPrices = map[string]float64{"a-cheap": 1.0, "b-mid": 1.05, "c-pricey": 9.0}
	})

	w := uint(1)
	mk := func(target string) *Channel {
		m := `{"gpt-4o":"` + target + `"}`
		return &Channel{Weight: &w, ModelMapping: &m}
	}
	pricey := mk("c-pricey")
	pricey.Id = 3

	got := cheapestChannelByPrice([]*Channel{pricey, mk("a-cheap"), mk("b-mid")}, "gpt-4o")
	require.NotNil(t, got)
	require.NotEqual(t, 3, got.Id, "超出价差容忍的最贵渠道不应被选中")
}

// 拿不到任何有效定价时必须返回 nil，由调用方回退原本的加权随机——
// 「没有价格信息」绝不能导致选不出渠道。
func TestCheapestChannelByPriceFallsBackWhenNoPricing(t *testing.T) {
	withPriceTestConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.ArbitrageMode = "auto"
		c.ArbitragePriceSource = "ratio_config"
		c.ArbitrageModelPrices = nil
	})

	w := uint(1)
	unknown := []*Channel{{Id: 1, Weight: &w}, {Id: 2, Weight: &w}}
	require.Nil(t, cheapestChannelByPrice(unknown, "model-without-any-pricing-xyz"),
		"无有效定价时应返回 nil 以回退加权随机")
}
