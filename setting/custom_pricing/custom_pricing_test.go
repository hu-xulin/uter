package custom_pricing

import (
	"math"
	"testing"

	"github.com/uter-ai/uter/common"
)

// Multipliers are produced by division, so compare with an epsilon.
func almostEqual(got, want float64) bool {
	return math.Abs(got-want) < 1e-9
}

func TestChannelModelMultiplier(t *testing.T) {
	common.OptionMap = map[string]string{
		ChannelPriceOptionKey: `{
			"enabled": true,
			"channels": {
				"7": {"enabled": true, "ratio": 0.9, "models": {
					"gpt-4o":       {"mode": "multiplier", "value": 0.5},
					"gpt-priced":   {"mode": "price", "value": 3},
					"gpt-fixed":    {"mode": "fixed_base", "value": 4},
					"mj-relax":     {"mode": "price", "value": 0.04}
				}},
				"8": {"enabled": false, "ratio": 0.1}
			}
		}`,
	}
	if !ChannelPricingEnabled() {
		t.Fatal("channel pricing should be enabled")
	}

	// Token charges expose USD/1M as baseRatio*2; finalPrice multiplies that
	// base by the returned factor, which is what the billing path charges.
	finalPrice := func(channelId int, model string, baseRatio float64, usePrice bool) (float64, bool) {
		factor, ok := ChannelModelMultiplier(channelId, model, baseRatio, usePrice)
		if !ok {
			return 0, false
		}
		base := baseRatio
		if !usePrice {
			base *= 2
		}
		return base * factor, true
	}

	t.Run("channel default applies to unlisted models", func(t *testing.T) {
		got, ok := finalPrice(7, "gpt-unlisted", 2.5, false)
		if !ok || !almostEqual(got, 4.5) {
			t.Fatalf("got (%v, %v), want (4.5, true)", got, ok)
		}
	})

	t.Run("per-model multiplier multiplies the channel ratio", func(t *testing.T) {
		// 5 * 0.9 * 0.5 = 2.25
		got, ok := finalPrice(7, "gpt-4o", 2.5, false)
		if !ok || !almostEqual(got, 2.25) {
			t.Fatalf("got (%v, %v), want (2.25, true)", got, ok)
		}
	})

	t.Run("absolute token price stays absolute under a channel ratio", func(t *testing.T) {
		got, ok := finalPrice(7, "gpt-priced", 6, false)
		if !ok || !almostEqual(got, 3) {
			t.Fatalf("got (%v, %v), want (3, true)", got, ok)
		}
	})

	t.Run("absolute per-request price stays absolute", func(t *testing.T) {
		got, ok := finalPrice(7, "mj-relax", 0.05, true)
		if !ok || !almostEqual(got, 0.04) {
			t.Fatalf("got (%v, %v), want (0.04, true)", got, ok)
		}
	})

	t.Run("fixed base applies before the channel ratio", func(t *testing.T) {
		// base 4 * channel 0.9 = 3.6
		got, ok := finalPrice(7, "gpt-fixed", 6, false)
		if !ok || !almostEqual(got, 3.6) {
			t.Fatalf("got (%v, %v), want (3.6, true)", got, ok)
		}
	})

	t.Run("disabled channel is ignored", func(t *testing.T) {
		if _, ok := ChannelModelMultiplier(8, "gpt-4o", 2.5, false); ok {
			t.Fatal("disabled channel must not contribute a multiplier")
		}
	})

	t.Run("unknown channel is ignored", func(t *testing.T) {
		if _, ok := ChannelModelMultiplier(99, "gpt-4o", 2.5, false); ok {
			t.Fatal("unknown channel must not contribute a multiplier")
		}
	})
}

func TestUserTierRatio(t *testing.T) {
	// Deliberately out of order: resolution must sort by lower bound.
	common.OptionMap = map[string]string{
		UserPriceOptionKey: `{
			"enabled": true,
			"tiers": [
				{"min_amount": 1000, "max_amount": null, "ratio": 0.8},
				{"min_amount": 0, "max_amount": 100, "ratio": 1},
				{"min_amount": 100, "max_amount": 1000, "ratio": 0.9}
			]
		}`,
	}

	for _, tc := range []struct {
		amount float64
		ratio  float64
	}{
		{0, 1},
		{99.99, 1},
		{100, 0.9},
		{999.99, 0.9},
		{1000, 0.8},
		{5000, 0.8},
	} {
		got, ok := UserTierRatio(tc.amount)
		if !ok {
			t.Fatalf("amount %v matched no tier", tc.amount)
		}
		if got != tc.ratio {
			t.Fatalf("amount %v: got %v, want %v", tc.amount, got, tc.ratio)
		}
	}
}

func TestEffectiveMultiplier(t *testing.T) {
	common.OptionMap = map[string]string{
		ChannelPriceOptionKey: `{"enabled": true, "channels": {"3": {"enabled": true, "ratio": 0.5}}}`,
		UserPriceOptionKey:    `{"enabled": true, "tiers": [{"min_amount": 0, "ratio": 0.8}]}`,
	}

	got, applied := EffectiveMultiplier(ChargeContext{
		ChannelId:  3,
		UserId:     11,
		ModelName:  "gpt-4o",
		BaseRatio:  2.5,
		MonthlyUSD: 42,
	})
	if !applied || !almostEqual(got, 0.4) {
		t.Fatalf("got (%v, %v), want (0.4, true)", got, applied)
	}

	// No rules for this channel and no matching tier => untouched.
	common.OptionMap[UserPriceOptionKey] = `{"enabled": true, "tiers": [{"min_amount": 100, "ratio": 0.8}]}`
	got, applied = EffectiveMultiplier(ChargeContext{ChannelId: 4, UserId: 11, MonthlyUSD: 0})
	if applied || !almostEqual(got, 1) {
		t.Fatalf("got (%v, %v), want (1, false)", got, applied)
	}
}

func TestPricingDisabledByDefault(t *testing.T) {
	common.OptionMap = map[string]string{}
	if ChannelPricingEnabled() {
		t.Fatal("channel pricing should stay off without a setting")
	}
	if UserPricingEnabled() {
		t.Fatal("user pricing should stay off without a setting")
	}
	if _, ok := UserTierRatio(1e9); ok {
		t.Fatal("user pricing must be a no-op when disabled")
	}
	if _, ok := ChannelModelMultiplier(1, "gpt-4o", 1, false); ok {
		t.Fatal("channel pricing must be a no-op when disabled")
	}
}
