package controller

import (
	"errors"
	"math"
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
func TestCreemOrderAmountsCoverOrder(t *testing.T) {
	tests := []struct {
		name          string
		subtotal      int64
		amountDue     int64
		amountPaid    int64
		expected      float64
		currency      string
		wantCovered   bool
		wantOverprice bool
	}{
		{name: "tax inclusive total accepted when subtotal matches", subtotal: 2900, amountDue: 3509, amountPaid: 3509, expected: 29, currency: "USD", wantCovered: true},
		{name: "catalog subtotal above local snapshot is allowed and flagged", subtotal: 3000, amountDue: 3609, amountPaid: 3609, expected: 29, currency: "USD", wantCovered: true, wantOverprice: true},
		{name: "subtotal underpaid is rejected even when tax offsets the gap", subtotal: 700, amountDue: 1000, amountPaid: 1000, expected: 10, currency: "USD", wantCovered: false},
		{name: "paid amount must cover amount due", subtotal: 1000, amountDue: 1200, amountPaid: 1199, expected: 10, currency: "USD", wantCovered: false},
		{name: "discounted amount due cannot underpay local snapshot", subtotal: 1000, amountDue: 500, amountPaid: 500, expected: 10, currency: "USD", wantCovered: false},
		{name: "catalog price increase cannot be discounted below local snapshot", subtotal: 1200, amountDue: 900, amountPaid: 900, expected: 10, currency: "USD", wantCovered: false},
		{name: "discount remains valid when actual paid amount covers local snapshot", subtotal: 1200, amountDue: 900, amountPaid: 1000, expected: 10, currency: "USD", wantCovered: true, wantOverprice: true},
		{name: "exact cent amount", subtotal: 999, amountDue: 1099, amountPaid: 1099, expected: 9.99, currency: "USD", wantCovered: true},
		{name: "JPY uses zero decimal minor units", subtotal: 1200, amountDue: 1200, amountPaid: 1200, expected: 1200, currency: "JPY", wantCovered: true},
		{name: "fractional JPY price is invalid", subtotal: 1200, amountDue: 1200, amountPaid: 1200, expected: 1200.5, currency: "JPY", wantCovered: false},
		{name: "BHD uses three decimal minor units", subtotal: 1250, amountDue: 1250, amountPaid: 1250, expected: 1.25, currency: "BHD", wantCovered: true},
		{name: "currency is required", subtotal: 1000, amountDue: 1000, amountPaid: 1000, expected: 10, currency: "", wantCovered: false},
		{name: "subtotal must be positive", subtotal: 0, amountDue: 1000, amountPaid: 1000, expected: 10, currency: "USD", wantCovered: false},
		{name: "amount due must be positive", subtotal: 1000, amountDue: 0, amountPaid: 1000, expected: 10, currency: "USD", wantCovered: false},
		{name: "paid amount must be positive and cover due", subtotal: 1000, amountDue: 1000, amountPaid: 0, expected: 10, currency: "USD", wantCovered: false},
		{name: "negative local price is invalid", subtotal: 1000, amountDue: 1000, amountPaid: 1000, expected: -10, currency: "USD", wantCovered: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			covered, overprice := creemOrderAmountsCoverOrder(tc.subtotal, tc.amountDue, tc.amountPaid, tc.expected, tc.currency)
			assert.Equal(t, tc.wantCovered, covered, "covered")
			assert.Equal(t, tc.wantOverprice, overprice, "subtotal over local snapshot")
		})
	}
}

func TestExpectedMinorUnits(t *testing.T) {
	tests := []struct {
		name     string
		amount   float64
		currency string
		expected int64
		wantOK   bool
	}{
		{name: "USD cents", amount: 29.99, currency: "USD", expected: 2999, wantOK: true},
		{name: "JPY integer units", amount: 1200, currency: "JPY", expected: 1200, wantOK: true},
		{name: "JPY rejects fractional amount", amount: 1200.5, currency: "JPY", wantOK: false},
		{name: "BHD thousandths", amount: 1.25, currency: "BHD", expected: 1250, wantOK: true},
		{name: "CLF ten thousandths", amount: 1.2345, currency: "CLF", expected: 12345, wantOK: true},
		{name: "unknown malformed currency", amount: 10, currency: "US1", wantOK: false},
		{name: "empty currency", amount: 10, currency: "", wantOK: false},
		{name: "non-positive amount", amount: 0, currency: "USD", wantOK: false},
		{name: "amount more precise than minor unit", amount: 1.001, currency: "USD", wantOK: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := expectedMinorUnits(tc.amount, tc.currency)
			assert.Equal(t, tc.wantOK, ok)
			if tc.wantOK {
				assert.Equal(t, tc.expected, got)
			}
		})
	}
}

func TestProviderPaidAmountMatchesOrder(t *testing.T) {
	tests := []struct {
		name     string
		paid     string
		expected float64
		want     bool
	}{
		{name: "exact amount", paid: "12.34", expected: 12.34, want: true},
		{name: "whitespace", paid: " 12.34 ", expected: 12.34, want: true},
		{name: "underpayment", paid: "12.33", expected: 12.34, want: false},
		{name: "missing", paid: "", expected: 12.34, want: false},
		{name: "invalid", paid: "NaN", expected: 12.34, want: false},
		{name: "zero", paid: "0", expected: 12.34, want: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, providerPaidAmountMatchesOrder(tc.paid, tc.expected))
		})
	}
}

func TestStripeCheckoutSubtotalMatchesOrder(t *testing.T) {
	tests := []struct {
		name             string
		subtotal         string
		currency         string
		expectedAmount   int64
		expectedCurrency string
		want             bool
	}{
		{name: "actual Stripe Price subtotal", subtotal: "8000", currency: "usd", expectedAmount: 8000, expectedCurrency: "USD", want: true},
		{name: "currency case ignored", subtotal: "8000", currency: "USD", expectedAmount: 8000, expectedCurrency: "usd", want: true},
		{name: "subtotal mismatch", subtotal: "7999", currency: "usd", expectedAmount: 8000, expectedCurrency: "usd", want: false},
		{name: "wrong currency", subtotal: "8000", currency: "eur", expectedAmount: 8000, expectedCurrency: "usd", want: false},
		{name: "missing subtotal", subtotal: "", currency: "usd", expectedAmount: 8000, expectedCurrency: "usd", want: false},
		{name: "malformed subtotal", subtotal: "8e3", currency: "usd", expectedAmount: 8000, expectedCurrency: "usd", want: false},
		{name: "missing snapshot rejected", subtotal: "8000", currency: "usd", expectedAmount: 0, expectedCurrency: "", want: false},
		{name: "zero subtotal rejected", subtotal: "0", currency: "usd", expectedAmount: 8000, expectedCurrency: "usd", want: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, stripeCheckoutSubtotalMatchesOrder(tc.subtotal, tc.currency, tc.expectedAmount, tc.expectedCurrency))
		})
	}
}

func TestCreemCurrencyMatchesOrder(t *testing.T) {
	tests := []struct {
		name             string
		callbackCurrency string
		expectedCurrency string
		want             bool
	}{
		{name: "same currency", callbackCurrency: "USD", expectedCurrency: "usd", want: true},
		{name: "trimmed currency", callbackCurrency: " USD ", expectedCurrency: "usd", want: true},
		{name: "different currency", callbackCurrency: "EUR", expectedCurrency: "USD", want: false},
		{name: "missing callback currency", callbackCurrency: "", expectedCurrency: "USD", want: false},
		{name: "missing expected currency", callbackCurrency: "USD", expectedCurrency: "", want: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, creemCurrencyMatchesOrder(tc.callbackCurrency, tc.expectedCurrency))
		})
	}
}



func TestProviderCurrencyMatchesOrder(t *testing.T) {
	tests := []struct {
		name     string
		paid     string
		expected string
		want     bool
	}{
		{name: "exact currency", paid: "USD", expected: "USD", want: true},
		{name: "case insensitive", paid: "usd", expected: "USD", want: true},
		{name: "mismatched currency", paid: "EUR", expected: "USD", want: false},
		{name: "missing provider currency", paid: "", expected: "USD", want: false},
		{name: "missing order snapshot", paid: "USD", expected: "", want: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, providerCurrencyMatchesOrder(tc.paid, tc.expected))
		})
	}
}


func TestStripeWebhookNeedsRetry(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{name: "no error", err: nil, want: false},
		{name: "permanent rejection", err: errStripeWebhookRejected, want: false},
		{name: "temporary database failure", err: errors.New("database unavailable"), want: true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, stripeWebhookNeedsRetry(tc.err))
		})
	}
}


func TestStripeCheckoutTotalIsPayable(t *testing.T) {
	tests := []struct {
		name             string
		total            string
		currency         string
		expectedAmount   int64
		expectedCurrency string
		want             bool
	}{
		{name: "exact total", total: "1000", currency: "usd", expectedAmount: 1000, expectedCurrency: "USD", want: true},
		{name: "tax increases total", total: "1080", currency: "USD", expectedAmount: 1000, expectedCurrency: "USD", want: true},
		{name: "promotion discount below subtotal", total: "900", currency: "USD", expectedAmount: 1000, expectedCurrency: "USD", want: true},
		{name: "free checkout", total: "0", currency: "USD", expectedAmount: 1000, expectedCurrency: "USD", want: false},
		{name: "wrong currency", total: "1000", currency: "EUR", expectedAmount: 1000, expectedCurrency: "USD", want: false},
		{name: "missing total", total: "", currency: "USD", expectedAmount: 1000, expectedCurrency: "USD", want: false},
		{name: "malformed total", total: "10.00", currency: "USD", expectedAmount: 1000, expectedCurrency: "USD", want: false},
		{name: "invalid expected amount", total: "1000", currency: "USD", expectedAmount: 0, expectedCurrency: "USD", want: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, stripeCheckoutTotalIsPayable(tc.total, tc.currency, tc.expectedAmount, tc.expectedCurrency))
		})
	}
}


func TestStripeMoneyToMinorUnits(t *testing.T) {
	tests := []struct {
		name    string
		amount  float64
		want    int64
		wantErr bool
	}{
		{name: "whole currency amount", amount: 8, want: 800},
		{name: "two decimal amount", amount: 1.25, want: 125},
		{name: "rounds to displayed cents", amount: 1.239, want: 124},
		{name: "zero rejected", amount: 0, wantErr: true},
		{name: "negative rejected", amount: -1, wantErr: true},
		{name: "nan rejected", amount: math.NaN(), wantErr: true},
		{name: "infinity rejected", amount: math.Inf(1), wantErr: true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := stripeMoneyToMinorUnits(tc.amount)
			assert.Equal(t, tc.wantErr, err != nil)
			if err == nil {
				assert.Equal(t, tc.want, got)
			}
		})
	}
}

func TestStripeSubscriptionPriceMatchesLocalOrder(t *testing.T) {
	tests := []struct {
		name             string
		providerAmount   int64
		providerCurrency string
		expectedMoney    float64
		expectedCurrency string
		want             bool
	}{
		{name: "exact USD amount", providerAmount: 2999, providerCurrency: "usd", expectedMoney: 29.99, expectedCurrency: "USD", want: true},
		{name: "exact CNY amount", providerAmount: 1200, providerCurrency: "CNY", expectedMoney: 12, expectedCurrency: "cny", want: true},
		{name: "exact JPY amount in zero-decimal currency", providerAmount: 1200, providerCurrency: "jpy", expectedMoney: 1200, expectedCurrency: "JPY", want: true},
		{name: "exact BHD amount in three-decimal currency", providerAmount: 1250, providerCurrency: "bhd", expectedMoney: 1.25, expectedCurrency: "BHD", want: true},
		{name: "JPY fractional amount rejected", providerAmount: 1200, providerCurrency: "jpy", expectedMoney: 1200.5, expectedCurrency: "JPY", want: false},
		{name: "underpriced Stripe Price rejected", providerAmount: 100, providerCurrency: "usd", expectedMoney: 29.99, expectedCurrency: "USD", want: false},
		{name: "overpriced Stripe Price rejected", providerAmount: 3000, providerCurrency: "usd", expectedMoney: 29.99, expectedCurrency: "USD", want: false},
		{name: "wrong currency rejected", providerAmount: 2999, providerCurrency: "eur", expectedMoney: 29.99, expectedCurrency: "USD", want: false},
		{name: "missing currency rejected", providerAmount: 2999, providerCurrency: "", expectedMoney: 29.99, expectedCurrency: "USD", want: false},
		{name: "invalid local precision rejected", providerAmount: 100, providerCurrency: "usd", expectedMoney: 1.001, expectedCurrency: "USD", want: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, stripeSubscriptionPriceMatchesLocalOrder(tc.providerAmount, tc.providerCurrency, tc.expectedMoney, tc.expectedCurrency))
		})
	}
}
