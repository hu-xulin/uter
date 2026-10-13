package controller

import (
	"testing"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
)

// TestPaidAmountMatchesOrder 锁死「实付金额必须与本地订单应付金额一致」这一
// 支付回调不变量：少付、多付、零、负、空值、非数字一律拒绝。
// 覆盖易支付回调的金额校验（EpayNotify → paidAmountMatchesOrder）。
func TestPaidAmountMatchesOrder(t *testing.T) {
	testCases := []struct {
		name     string
		paid     string
		expected float64
		want     bool
	}{
		{name: "exact match", paid: "10.00", expected: 10, want: true},
		{name: "trailing zero tolerated", paid: "10.0", expected: 10, want: true},
		{name: "two decimals", paid: "9.99", expected: 9.99, want: true},
		{name: "one cent underpaid rejected", paid: "9.99", expected: 10, want: false},
		{name: "classic one cent exploit rejected", paid: "0.01", expected: 10, want: false},
		{name: "overpaid rejected", paid: "100", expected: 10, want: false},
		{name: "zero rejected", paid: "0", expected: 10, want: false},
		{name: "negative rejected", paid: "-10", expected: 10, want: false},
		{name: "empty rejected", paid: "", expected: 10, want: false},
		{name: "garbage rejected", paid: "not-a-number", expected: 10, want: false},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			paid, err := decimal.NewFromString(testCase.paid)
			got := err == nil && paidAmountMatchesOrder(paid, testCase.expected)
			assert.Equal(t, testCase.want, got)
		})
	}
}

// TestCreemPaidCoversOrder 锁死 Creem 的非对称金额规则：
// 实付少于应付一律拒绝（欺诈），实付不少于应付一律放行（配置漂移不误伤正常支付），
// 实付多于应付时返回 overpaid 以触发告警。
// 单位为「分」，期望值为「元」。
func TestCreemPaidCoversOrder(t *testing.T) {
	testCases := []struct {
		name         string
		paidMinor    int64
		expected     float64
		wantCovered  bool
		wantOverpaid bool
	}{
		{name: "exact", paidMinor: 1000, expected: 10, wantCovered: true, wantOverpaid: false},
		{name: "sub-cent rounding", paidMinor: 999, expected: 9.99, wantCovered: true, wantOverpaid: false},
		{name: "one cent underpaid blocked", paidMinor: 999, expected: 10, wantCovered: false, wantOverpaid: false},
		{name: "classic one cent exploit blocked", paidMinor: 1, expected: 10, wantCovered: false, wantOverpaid: false},
		{name: "overpaid allowed and flagged", paidMinor: 2000, expected: 10, wantCovered: true, wantOverpaid: true},
		{name: "zero blocked", paidMinor: 0, expected: 10, wantCovered: false, wantOverpaid: false},
		{name: "negative blocked", paidMinor: -1000, expected: 10, wantCovered: false, wantOverpaid: false},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			covered, overpaid := creemPaidCoversOrder(testCase.paidMinor, testCase.expected)
			assert.Equal(t, testCase.wantCovered, covered, "covered")
			assert.Equal(t, testCase.wantOverpaid, overpaid, "overpaid")
		})
	}
}
