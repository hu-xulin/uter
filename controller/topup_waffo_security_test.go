package controller

import (
	"errors"
	"testing"

	"github.com/uter-ai/uter/model"
)

func TestWaffoPaidAmountMatchesOrder(t *testing.T) {
	tests := []struct {
		name     string
		paid     string
		expected string
		want     bool
	}{
		{name: "exact amount", paid: "12.34", expected: "12.34", want: true},
		{name: "surrounding whitespace", paid: " 12.34 ", expected: "12.34", want: true},
		{name: "underpayment", paid: "12.33", expected: "12.34", want: false},
		{name: "missing amount", paid: "", expected: "12.34", want: false},
		{name: "invalid amount", paid: "not-a-number", expected: "12.34", want: false},
		{name: "invalid expected amount", paid: "12.34", expected: "bad", want: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := waffoPaidAmountMatchesOrder(tt.paid, tt.expected); got != tt.want {
				t.Fatalf("waffoPaidAmountMatchesOrder(%q, %q) = %t, want %t", tt.paid, tt.expected, got, tt.want)
			}
		})
	}
}


func TestWaffoOrderStatusIsTerminalFailure(t *testing.T) {
	tests := []struct {
		status string
		want   bool
	}{
		{status: "ORDER_CLOSE", want: true},
		{status: "PAY_IN_PROGRESS", want: false},
		{status: "AUTHORIZATION_REQUIRED", want: false},
		{status: "AUTHED_WAITING_CAPTURE", want: false},
		{status: "PAY_SUCCESS", want: false},
		{status: "UNKNOWN_FUTURE_STATUS", want: false},
	}
	for _, tc := range tests {
		t.Run(tc.status, func(t *testing.T) {
			if got := waffoOrderStatusIsTerminalFailure(tc.status); got != tc.want {
				t.Fatalf("waffoOrderStatusIsTerminalFailure(%q) = %t, want %t", tc.status, got, tc.want)
			}
		})
	}
}

func TestWaffoExpectedOrderCurrency(t *testing.T) {
	tests := []struct {
		name               string
		snapshotCurrency   string
		configuredCurrency string
		want               string
	}{
		{name: "snapshot wins over changed setting", snapshotCurrency: " eur ", configuredCurrency: "USD", want: "EUR"},
		{name: "legacy order uses configured currency", snapshotCurrency: "", configuredCurrency: " eur ", want: "EUR"},
		{name: "legacy order defaults through configured default", snapshotCurrency: "", configuredCurrency: "USD", want: "USD"},
		{name: "empty configuration fails closed", snapshotCurrency: "", configuredCurrency: "", want: ""},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := waffoExpectedOrderCurrency(tc.snapshotCurrency, tc.configuredCurrency); got != tc.want {
				t.Fatalf("waffoExpectedOrderCurrency(%q, %q) = %q, want %q", tc.snapshotCurrency, tc.configuredCurrency, got, tc.want)
			}
		})
	}
}

func TestWaffoTerminalFailureUpdateNeedsRetry(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{name: "nil error", err: nil, want: false},
		{name: "transient database failure", err: errors.New("database unavailable"), want: true},
		{name: "missing order is permanent", err: model.ErrTopUpNotFound, want: false},
		{name: "already transitioned order is permanent", err: model.ErrTopUpStatusInvalid, want: false},
		{name: "provider mismatch is permanent", err: model.ErrPaymentMethodMismatch, want: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := waffoTerminalFailureUpdateNeedsRetry(tc.err); got != tc.want {
				t.Fatalf("waffoTerminalFailureUpdateNeedsRetry(%v) = %t, want %t", tc.err, got, tc.want)
			}
		})
	}
}

