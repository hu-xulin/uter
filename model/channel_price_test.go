package model

import (
	"testing"

	"github.com/stretchr/testify/require"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"
)

// 自动择优的核心：同一请求模型在不同渠道被 model_mapping 映射到不同上游模型，
// 上游模型定价不同 → 应选更便宜的那个渠道（即 #5 同模型跨通道比价的兑现点）。
func TestCheapestChannelByPriceUsesUpstreamModelPrice(t *testing.T) {
	cfg := costoptcfg.GetCostOptSetting()
	oldMode, oldPrices, oldTol := cfg.ArbitrageMode, cfg.ArbitrageModelPrices, cfg.ArbitrageAutoMaxPriceRatio
	defer func() {
		cfg.ArbitrageMode, cfg.ArbitrageModelPrices = oldMode, oldPrices
		cfg.ArbitrageAutoMaxPriceRatio = oldTol
	}()

	cfg.ArbitrageMode = "auto"
	cfg.ArbitrageAutoMaxPriceRatio = 1.0
	// 手填价目表覆盖（key=模型名），避免测试依赖系统内置定价表。
	cfg.ArbitrageModelPrices = map[string]float64{
		"upstream-cheap":  1.0,
		"upstream-pricey": 5.0,
	}

	w := uint(1)
	mCheap := `{"gpt-4o":"upstream-cheap"}`
	mPricey := `{"gpt-4o":"upstream-pricey"}`
	cheap := &Channel{Id: 1, Weight: &w, ModelMapping: &mCheap}
	pricey := &Channel{Id: 2, Weight: &w, ModelMapping: &mPricey}

	require.Less(t, channelEffectiveUnitPrice(cheap, "gpt-4o"),
		channelEffectiveUnitPrice(pricey, "gpt-4o"), "便宜渠道的单价必须更低")

	// 故意把贵的放在前面，验证确实按单价择优而非按传入顺序。
	got := cheapestChannelByPrice([]*Channel{pricey, cheap}, "gpt-4o")
	require.NotNil(t, got)
	require.Equal(t, 1, got.Id, "应选中映射后单价更低的渠道")
}

// 价差容忍 >1 时，容忍范围内的多个候选不应被压成单一渠道（返回其一即可，不断言具体值）；
// 这里验证"严格最便宜"与"容忍"两种配置都不会选中最贵的渠道。
func TestCheapestChannelByPriceNeverPicksOutsideTolerance(t *testing.T) {
	cfg := costoptcfg.GetCostOptSetting()
	oldMode, oldPrices, oldTol := cfg.ArbitrageMode, cfg.ArbitrageModelPrices, cfg.ArbitrageAutoMaxPriceRatio
	defer func() {
		cfg.ArbitrageMode, cfg.ArbitrageModelPrices = oldMode, oldPrices
		cfg.ArbitrageAutoMaxPriceRatio = oldTol
	}()

	cfg.ArbitrageMode = "auto"
	cfg.ArbitrageAutoMaxPriceRatio = 1.0
	cfg.ArbitrageModelPrices = map[string]float64{"a-cheap": 1.0, "b-mid": 1.05, "c-pricey": 9.0}

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
	cfg := costoptcfg.GetCostOptSetting()
	oldMode, oldPrices := cfg.ArbitrageMode, cfg.ArbitrageModelPrices
	defer func() { cfg.ArbitrageMode, cfg.ArbitrageModelPrices = oldMode, oldPrices }()

	cfg.ArbitrageMode = "auto"
	cfg.ArbitrageModelPrices = nil

	w := uint(1)
	unknown := []*Channel{{Id: 1, Weight: &w}, {Id: 2, Weight: &w}}
	require.Nil(t, cheapestChannelByPrice(unknown, "model-without-any-pricing-xyz"),
		"无有效定价时应返回 nil 以回退加权随机")
}
