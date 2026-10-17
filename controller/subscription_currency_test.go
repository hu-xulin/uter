package controller

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/model"
)

func TestSubscriptionPlanCurrency(t *testing.T) {
	tests := []struct {
		name string
		plan *model.SubscriptionPlan
		want string
	}{
		{name: "nil plan defaults to USD", plan: nil, want: "USD"},
		{name: "legacy empty currency defaults to USD", plan: &model.SubscriptionPlan{}, want: "USD"},
		{name: "currency is normalized", plan: &model.SubscriptionPlan{Currency: " usd "}, want: "USD"},
		{name: "non-default legacy currency is preserved", plan: &model.SubscriptionPlan{Currency: "cny"}, want: "CNY"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, subscriptionPlanCurrency(tc.plan))
		})
	}
}
