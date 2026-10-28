package service

import (
	"math"
	"testing"

	"github.com/uter-ai/uter/setting/operation_setting"
)

func TestParseERAPIUSDCNY(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		body := []byte(`{"result":"success","base_code":"USD","rates":{"USD":1,"CNY":6.684864}}`)
		rate, err := parseERAPIUSDCNY(body)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if math.Abs(rate-6.684864) > 1e-9 {
			t.Fatalf("rate = %v, want 6.684864", rate)
		}
	})

	t.Run("provider error result", func(t *testing.T) {
		body := []byte(`{"result":"error","rates":{"CNY":6.68}}`)
		if _, err := parseERAPIUSDCNY(body); err == nil {
			t.Fatal("expected error for non-success result")
		}
	})

	t.Run("missing CNY", func(t *testing.T) {
		body := []byte(`{"result":"success","rates":{"USD":1}}`)
		if _, err := parseERAPIUSDCNY(body); err == nil {
			t.Fatal("expected error when CNY rate is missing")
		}
	})

	t.Run("invalid json", func(t *testing.T) {
		if _, err := parseERAPIUSDCNY([]byte(`not-json`)); err == nil {
			t.Fatal("expected error for invalid json")
		}
	})
}

func TestParseFrankfurterUSDCNY(t *testing.T) {
	body := []byte(`{"amount":1.0,"base":"USD","date":"2026-10-23","rates":{"CNY":6.6702}}`)
	rate, err := parseFrankfurterUSDCNY(body)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if math.Abs(rate-6.6702) > 1e-9 {
		t.Fatalf("rate = %v, want 6.6702", rate)
	}

	if _, err := parseFrankfurterUSDCNY([]byte(`{"rates":{}}`)); err == nil {
		t.Fatal("expected error when CNY rate is missing")
	}
}

func TestDerivedPriceFromExchangeRate(t *testing.T) {
	// 定价是**行情汇率减 0.2**（PriceAdjustmentRate = −0.2），不是加价。
	// 断言里显式写出 − 0.2 的期望值，避免有人把符号改回去时测试跟着「自洽」通过。
	cases := []struct {
		name string
		in   float64
		want float64
	}{
		{name: "typical", in: 6.68, want: 6.48},
		{name: "rounds to cents", in: 6.6849, want: 6.48},
		{name: "carries over", in: 7.99, want: 7.79},
		{name: "invalid falls back to default", in: 0, want: 7.10},
		{name: "negative falls back to default", in: -1, want: 7.10},
		// 调整量为负时，极小的汇率会把定价推成 0 或负数；必须回退到汇率本身，
		// 否则会生成 0 元订单。
		{name: "tiny rate never goes non-positive", in: 0.1, want: 0.10},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := operation_setting.DerivedPriceFromExchangeRate(tc.in)
			if math.Abs(got-tc.want) > 1e-9 {
				t.Fatalf("DerivedPriceFromExchangeRate(%v) = %v, want %v", tc.in, got, tc.want)
			}
		})
	}
}

func TestEffectivePayPriceUsesPriceWhenPresent(t *testing.T) {
	originalPrice := operation_setting.Price
	originalRate := operation_setting.USDExchangeRate
	t.Cleanup(func() {
		operation_setting.Price = originalPrice
		operation_setting.USDExchangeRate = originalRate
	})

	operation_setting.USDExchangeRate = 6.68
	operation_setting.Price = 6.48
	if got := operation_setting.EffectivePayPrice(); got != 6.48 {
		t.Fatalf("EffectivePayPrice() = %v, want 6.48 (B)", got)
	}

	// Price 缺失时按 B = A − 0.2 现场推导，避免出现 0 元订单。
	operation_setting.Price = 0
	if got := operation_setting.EffectivePayPrice(); got != 6.48 {
		t.Fatalf("EffectivePayPrice() with empty Price = %v, want 6.48", got)
	}
}
