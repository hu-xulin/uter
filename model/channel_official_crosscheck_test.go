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

func TestSynchronizedBaselineDropsAmbiguousNormalizedNames(t *testing.T) {
	entry := func(name string, ratio float64) ModelPricingEntry {
		return ModelPricingEntry{
			ModelName: name,
			ModelPricingDescription: ModelPricingDescription{
				Effective: PricingValues{"ModelRatio": ratio},
			},
		}
	}
	baseline, conflicts := buildSynchronizedOfficialBaseline([]ModelPricingEntry{
		entry("DeepSeek-V4-1-Flash-fast", 0.125),
		entry("DeepSeek-V4-1-Flash-Fast", 0.3),
		entry("stable-model", 1),
		// 同一价格的不同写法不是冲突，仍可安全比较。
		entry("alias-one", 2),
		entry("alias-one-variant", 2),
	})
	require.Len(t, conflicts, 1, "the conflicting alias pair must be reported once")

	_, ambiguous := baseline[normalizeModelMatchName("DeepSeek-V4-1-Flash-fast")]
	require.False(t, ambiguous, "conflicting normalized names must not resolve to an arbitrary first row")
	stable, ok := baseline[normalizeModelMatchName("stable-model")]
	require.True(t, ok)
	require.InDelta(t, 2.0, stable.Input, 1e-9)
	alias, ok := baseline[normalizeModelMatchName("alias-one")]
	require.True(t, ok, "identical duplicate prices are not ambiguous")
	require.InDelta(t, 4.0, alias.Input, 1e-9)
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

func TestCrossCheckOfficialPriceRateSnapshotDriftIsNotDisagreement(t *testing.T) {
	previousRate := operation_setting.USDExchangeRate
	operation_setting.USDExchangeRate = 6.67
	t.Cleanup(func() { operation_setting.USDExchangeRate = previousRate })

	// 同步定价系数是旧汇率(约 6.975)冻结的 USD 值：54 CNY / 6.975 = 7.742 USD。
	// 百炼官网价以当前汇率 6.67 折算：54 CNY / 6.67 = 8.096 USD。两者同源，
	// 仅汇率快照不同，不应判为价格分歧。
	baseline := map[string]synchronizedOfficialPrice{
		"qwen:deep:research": {Input: 7.742, Output: 23.367},
	}
	officialList := ChannelOfficialPricing{
		Unit: "per_1m_token", SourceCurrency: "CNY", NormalizedCurrency: "USD", FXRateToUSD: 6.67,
		PriceKind: "OFFICIAL_LIST", Source: "https://help.aliyun.com/zh/model-studio/model-pricing",
		Tiers: []ChannelPricingTier{{
			InputPerMillionUSD: moneyFromFloat(54 / 6.67), OutputPerMillionUSD: moneyFromFloat(163 / 6.67),
			RawComponents: []ChannelPricingRawComponent{{
				Type: "input_token", RawAmount: *moneyFromFloat(54), RawCurrency: "CNY",
				SourceCurrency: "CNY", NormalizedUSD: *moneyFromFloat(54 / 6.67), FXRate: 6.67,
			}},
		}},
	}
	reason, ok := crossCheckOfficialPrice(officialList, "qwen-deep-research", baseline)
	require.True(t, ok, "authoritative official list price must not be flagged; got %q", reason)
	require.Empty(t, reason)

	// 缺少官方来源 URL 的派生价仍必须严格比对、fail-closed。
	noURL := officialList
	noURL.Source = "bailian-channel"
	reason, ok = crossCheckOfficialPrice(noURL, "qwen-deep-research", baseline)
	require.False(t, ok, "derived price without official URL keeps strict comparison")
	require.Contains(t, reason, "input price")

	// UterRoute 参考价（BILLING_EXPRESSION）即使数值相同也不得借豁免绕过门禁。
	billingExpr := officialList
	billingExpr.PriceKind = "BILLING_EXPRESSION"
	reason, ok = crossCheckOfficialPrice(billingExpr, "qwen-deep-research", baseline)
	require.False(t, ok, "billing-expression price keeps strict comparison")
}

func TestCrossCheckOfficialPriceUterRoutePriceIsDifferentMeasure(t *testing.T) {
	// UterRoute 的官方价来自上游原价/表达式系数/比值重建，而 baseline 是
	// 管理员「同步定价」的 Uter 售卖价。二者允许有意加价或汇率快照不同，
	// 不能因为数值不等就判成价格分歧。
	baseline := map[string]synchronizedOfficialPrice{
		"deepseek:v4:flash:0731": {Input: 0.44},
	}
	cases := []struct {
		name      string
		priceKind string
		source    string
	}{
		{"expression", "BILLING_EXPRESSION", "uterroute-expression"},
		{"ratio reference", "RATIO_ONLY", "uterroute-ratio-reference"},
		{"historical snapshot", "HISTORICAL_SNAPSHOT", "uterroute-historical-snapshot"},
		{"official api", "OFFICIAL_ABSOLUTE", "uterroute-official-api"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			view := ChannelOfficialPricing{
				PriceKind: tc.priceKind,
				Source:    tc.source,
				Tiers: []ChannelPricingTier{{
					Unit:               "per_1m_token",
					InputPerMillionUSD: moneyFromFloat(0.445),
				}},
			}
			reason, ok := crossCheckOfficialPrice(view, "deepseek-v4-flash-0731", baseline)
			require.True(t, ok, "UterRoute %s is a different measure; got %q", tc.priceKind, reason)
			require.Empty(t, reason)
		})
	}

	// 非 UterRoute 的派生价没有官方来源证明，仍必须与同步定价严格比对。
	derived := ChannelOfficialPricing{
		PriceKind: "BILLING_EXPRESSION",
		Source:    "generic-channel",
		Tiers: []ChannelPricingTier{{
			Unit:               "per_1m_token",
			InputPerMillionUSD: moneyFromFloat(0.445),
		}},
	}
	reason, ok := crossCheckOfficialPrice(derived, "deepseek-v4-flash-0731", baseline)
	require.False(t, ok, "derived non-UterRoute price keeps strict comparison")
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
