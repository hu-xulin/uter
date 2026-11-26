package model

import (
	"encoding/json"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/setting/operation_setting"
	"gorm.io/gorm"
)

func moneyFromFloat(v float64) *Money {
	encoded, _ := json.Marshal(v)
	var m Money
	_ = json.Unmarshal(encoded, &m)
	return &m
}

// withSynchronizedPricing installs an in-memory options table that mirrors the
// values written by Admin → Models → "同步定价". The baseline must come from
// these options, not from UterRouteSyncSnapshot.
func withSynchronizedPricing(t *testing.T, options map[string]map[string]any) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Option{}))
	InitColumnNames()
	previous := DB
	DB = db
	for key, values := range options {
		encoded, err := json.Marshal(values)
		require.NoError(t, err)
		require.NoError(t, db.Create(&Option{Key: key, Value: string(encoded)}).Error)
	}
	t.Cleanup(func() {
		DB = previous
	})
}

func TestCrossCheckOfficialPriceAgainstSynchronizedPricing(t *testing.T) {
	baseline := map[string]synchronizedOfficialPrice{
		"claude:fable:5:1": {Input: 10, Output: 50, Cache: 0.25, CreateCache: 12.5},
	}
	buildView := func(input, output float64) ChannelOfficialPricing {
		return ChannelOfficialPricing{Tiers: []ChannelPricingTier{{
			Unit:                "per_1m_token",
			InputPerMillionUSD:  moneyFromFloat(input),
			OutputPerMillionUSD: moneyFromFloat(output),
		}}}
	}

	// 名称分隔符不同（点 vs 横线）但价格一致 → 通过。
	reason, ok := crossCheckOfficialPrice(buildView(10, 50), "claude-fable-5.1", baseline)
	require.True(t, ok, "matching price with alternate separator must pass; got %q", reason)
	require.Empty(t, reason)

	// 上游/计算价与同步定价不一致 → 待核。
	reason, ok = crossCheckOfficialPrice(buildView(12, 50), "claude-fable-5-1", baseline)
	require.False(t, ok)
	require.Contains(t, reason, "input price")
	require.Contains(t, reason, "synchronized pricing")

	reason, ok = crossCheckOfficialPrice(buildView(10, 60), "claude-fable-5-1", baseline)
	require.False(t, ok)
	require.Contains(t, reason, "output price")

	// 同步定价没有该模型 → 不算不一致（避免大面积误标）。
	reason, ok = crossCheckOfficialPrice(buildView(10, 50), "unknown-model", baseline)
	require.True(t, ok)
	require.Empty(t, reason)
}

func TestSynchronizedPricingBaselineUsesRatioOptions(t *testing.T) {
	withSynchronizedPricing(t, map[string]map[string]any{
		"ModelRatio":       {"claude-fable-5-1": 5.0},
		"CompletionRatio":  {"claude-fable-5-1": 5.0},
		"CacheRatio":       {"claude-fable-5-1": 0.025},
		"CreateCacheRatio": {"claude-fable-5-1": 1.25},
	})

	baseline := synchronizedOfficialBaseline()
	row, ok := baseline["claude:fable:5:1"]
	require.True(t, ok, "synchronized options must build the baseline")
	require.InDelta(t, 10, row.Input, 1e-9)
	require.InDelta(t, 50, row.Output, 1e-9)
	require.InDelta(t, 0.25, row.Cache, 1e-9)
	require.InDelta(t, 12.5, row.CreateCache, 1e-9)
}

func TestApplyOfficialCrossCheckMarksReviewAndClearsAutoPrice(t *testing.T) {
	withSynchronizedPricing(t, map[string]map[string]any{
		"ModelRatio":      {"claude-fable-5-1": 5.0},
		"CompletionRatio": {"claude-fable-5-1": 5.0},
	})

	mismatch := ChannelOfficialPricing{Tiers: []ChannelPricingTier{{
		Unit: "per_1m_token", InputPerMillionUSD: moneyFromFloat(99), OutputPerMillionUSD: moneyFromFloat(50),
	}}}
	normalized, err := json.Marshal(mismatch)
	require.NoError(t, err)
	records := []ChannelOfficialPricingRecord{{
		ModelName:         "claude-fable-5-1",
		NormalizedPricing: string(normalized),
		InternalPricing:   `{"mode":4,"billing_expr":"x"}`,
	}}

	applyOfficialCrossCheck(records)

	require.Empty(t, records[0].InternalPricing, "disagreement must strip the auto-billing price")
	var final ChannelOfficialPricing
	require.NoError(t, json.Unmarshal([]byte(records[0].NormalizedPricing), &final))
	require.True(t, final.NeedsReview)
	require.Len(t, final.ReviewReasons, 1)
	require.Contains(t, final.ReviewReasons[0], "input price")
	require.Contains(t, final.ReviewReasons[0], "synchronized pricing")
}

func TestApplyOfficialCrossCheckKeepsMatchingPrice(t *testing.T) {
	withSynchronizedPricing(t, map[string]map[string]any{
		"ModelRatio":      {"claude-fable-5-1": 5.0},
		"CompletionRatio": {"claude-fable-5-1": 5.0},
	})

	matching := ChannelOfficialPricing{Tiers: []ChannelPricingTier{{
		Unit: "per_1m_token", InputPerMillionUSD: moneyFromFloat(10), OutputPerMillionUSD: moneyFromFloat(50),
	}}}
	normalized, err := json.Marshal(matching)
	require.NoError(t, err)
	internal := `{"mode":4,"billing_expr":"x"}`
	records := []ChannelOfficialPricingRecord{{
		ModelName: "claude-fable-5-1", NormalizedPricing: string(normalized), InternalPricing: internal,
	}}

	applyOfficialCrossCheck(records)

	require.Equal(t, internal, records[0].InternalPricing, "matching price must keep its auto-billing price")
	var final ChannelOfficialPricing
	require.NoError(t, json.Unmarshal([]byte(records[0].NormalizedPricing), &final))
	require.False(t, final.NeedsReview)
}

func TestApplyOfficialCrossCheckWithTieredExpr(t *testing.T) {
	withSynchronizedPricing(t, map[string]map[string]any{
		"billing_setting.billing_mode": {"gpt-6-astra": "tiered_expr"},
		"billing_setting.billing_expr": {
			"gpt-6-astra": `len <= 272000 ? tier("standard", p * 10 + c * 50 + cr * 1 + cc * 12.5 + cc12h * 25) : tier("long_context", p * 20 + c * 75 + cr * 2 + cc * 25 + cc12h * 50)`,
		},
	})

	baseline := synchronizedOfficialBaseline()
	row, ok := baseline[normalizeModelMatchName("gpt-6-astra")]
	require.True(t, ok)
	require.InDelta(t, 10, row.Input, 1e-9)
	require.InDelta(t, 50, row.Output, 1e-9)
	require.InDelta(t, 1, row.Cache, 1e-9)
	require.InDelta(t, 12.5, row.CreateCache, 1e-9)

	matching := ChannelOfficialPricing{Tiers: []ChannelPricingTier{{
		Unit:                     "per_1m_token",
		InputPerMillionUSD:       moneyFromFloat(10),
		OutputPerMillionUSD:      moneyFromFloat(50),
		CachePerMillionUSD:       moneyFromFloat(1),
		CreateCachePerMillionUSD: moneyFromFloat(12.5),
	}}}
	encoded, err := json.Marshal(matching)
	require.NoError(t, err)
	records := []ChannelOfficialPricingRecord{{
		ModelName: "gpt-6-astra", NormalizedPricing: string(encoded), InternalPricing: "keep-me",
	}}
	applyOfficialCrossCheck(records)
	require.Equal(t, "keep-me", records[0].InternalPricing)

	mismatch := ChannelOfficialPricing{Tiers: []ChannelPricingTier{{
		Unit:                "per_1m_token",
		InputPerMillionUSD:  moneyFromFloat(12),
		OutputPerMillionUSD: moneyFromFloat(50),
	}}}
	encoded, err = json.Marshal(mismatch)
	require.NoError(t, err)
	records = []ChannelOfficialPricingRecord{{
		ModelName: "gpt-6-astra", NormalizedPricing: string(encoded), InternalPricing: "drop-me",
	}}
	applyOfficialCrossCheck(records)
	require.Empty(t, records[0].InternalPricing)
	var final ChannelOfficialPricing
	require.NoError(t, json.Unmarshal([]byte(records[0].NormalizedPricing), &final))
	require.True(t, final.NeedsReview)
}

func TestApplyOfficialCrossCheckWithFixedRequestPrice(t *testing.T) {
	withSynchronizedPricing(t, map[string]map[string]any{
		"billing_setting.billing_mode": {"deepseek-search": "tiered_expr"},
		"billing_setting.billing_expr": {
			"deepseek-search": `tier("request", fixed(0.00075))`,
		},
	})

	baseline := synchronizedOfficialBaseline()
	row, ok := baseline[normalizeModelMatchName("deepseek-search")]
	require.True(t, ok)
	require.InDelta(t, 0.00075, row.PerCall, 1e-12)

	matching := ChannelOfficialPricing{Tiers: []ChannelPricingTier{{
		Unit: "per_call", PerUnitUSD: moneyFromFloat(0.00075),
	}}}
	encoded, err := json.Marshal(matching)
	require.NoError(t, err)
	records := []ChannelOfficialPricingRecord{{
		ModelName: "deepseek-search", NormalizedPricing: string(encoded), InternalPricing: "keep-me",
	}}
	applyOfficialCrossCheck(records)
	require.Equal(t, "keep-me", records[0].InternalPricing)
}

func TestCrossCheckOfficialPriceConvertsCNYWithExchangeRate(t *testing.T) {
	previousRate := operation_setting.USDExchangeRate
	operation_setting.USDExchangeRate = 7.25
	t.Cleanup(func() { operation_setting.USDExchangeRate = previousRate })

	baseline := map[string]synchronizedOfficialPrice{
		"cny:model": {Input: 10, Output: 50},
	}
	// 上游以人民币发布：72.5 CNY/M = 10 USD/M @ 7.25。
	view := ChannelOfficialPricing{
		Unit:               "per_1m_token",
		SourceCurrency:     "CNY",
		NormalizedCurrency: "CNY",
		Tiers: []ChannelPricingTier{{
			InputPerMillionUSD:  moneyFromFloat(72.5),
			OutputPerMillionUSD: moneyFromFloat(362.5),
		}},
	}
	reason, ok := crossCheckOfficialPrice(view, "cny-model", baseline)
	require.True(t, ok, "CNY price equal after conversion must pass; got %q", reason)

	// 自动汇率刷新后，下一次交叉核验必须立即使用新汇率，不读启动缓存。
	operation_setting.USDExchangeRate = 8
	reason, ok = crossCheckOfficialPrice(view, "cny-model", baseline)
	require.False(t, ok, "freshly synced rate must be used on the next check")
	require.Contains(t, reason, "input price")
	operation_setting.USDExchangeRate = 7.25

	// 换算后仍不一致 → 待核。
	view.Tiers[0].InputPerMillionUSD = moneyFromFloat(80)
	reason, ok = crossCheckOfficialPrice(view, "cny-model", baseline)
	require.False(t, ok)
	require.Contains(t, reason, "input price")
}

func TestCrossCheckOfficialPriceSkipsUnknownCurrency(t *testing.T) {
	baseline := map[string]synchronizedOfficialPrice{
		"weird:model": {Input: 10},
	}
	view := ChannelOfficialPricing{
		Unit:               "per_1m_token",
		NormalizedCurrency: "JPY",
		Tiers: []ChannelPricingTier{{
			InputPerMillionUSD: moneyFromFloat(1500),
		}},
	}
	reason, ok := crossCheckOfficialPrice(view, "weird-model", baseline)
	require.True(t, ok, "unconvertible currency must skip, not flag; got %q", reason)
	require.Empty(t, reason)
}

func TestCrossCheckOfficialPricePartialDimensionsPassWhenSharedPricesMatch(t *testing.T) {
	baseline := map[string]synchronizedOfficialPrice{
		"partial:dims": {Input: 10, Output: 50, Cache: 2.5, CreateCache: 12.5},
	}
	// 一个来源有 input/output/cache/cache-write，另一个只有 input/output：
	// 只要 input/output 相同即算通过，缺失的维度不参与比对。
	view := ChannelOfficialPricing{Unit: "per_1m_token", Tiers: []ChannelPricingTier{{
		InputPerMillionUSD:  moneyFromFloat(10),
		OutputPerMillionUSD: moneyFromFloat(50),
	}}}
	reason, ok := crossCheckOfficialPrice(view, "partial-dims", baseline)
	require.True(t, ok, "shared input/output match must pass when one side lacks cache; got %q", reason)
	require.Empty(t, reason)

	// 反向：基准侧缺缓存，渠道侧有缓存，同样只比 input/output。
	baselineSlim := map[string]synchronizedOfficialPrice{
		"partial:dims": {Input: 10, Output: 50},
	}
	fullView := ChannelOfficialPricing{Unit: "per_1m_token", Tiers: []ChannelPricingTier{{
		InputPerMillionUSD:       moneyFromFloat(10),
		OutputPerMillionUSD:      moneyFromFloat(50),
		CachePerMillionUSD:       moneyFromFloat(2.5),
		CreateCachePerMillionUSD: moneyFromFloat(12.5),
	}}}
	reason, ok = crossCheckOfficialPrice(fullView, "partial-dims", baselineSlim)
	require.True(t, ok, "shared input/output match must pass when baseline lacks cache; got %q", reason)
	require.Empty(t, reason)

	// 共享维度不一致仍然必须拦截。
	fullView.Tiers[0].OutputPerMillionUSD = moneyFromFloat(60)
	reason, ok = crossCheckOfficialPrice(fullView, "partial-dims", baselineSlim)
	require.False(t, ok, "mismatched shared output must fail")
	require.Contains(t, reason, "output price")
}
