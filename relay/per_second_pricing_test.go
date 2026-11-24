/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
package relay

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/pkg/billingexpr"
)

func TestPerSecondTaskCostUsesDurationFacts(t *testing.T) {
	cost, ok := perSecondTaskCost(map[string]any{"duration": float64(10)}, 0.08)
	if !ok {
		t.Fatal("expected duration-based cost")
	}
	if cost != 0.8 {
		t.Fatalf("cost = %v, want 0.8", cost)
	}

	if _, ok := perSecondTaskCost(map[string]any{"duration": float64(0)}, 0.08); ok {
		t.Fatal("zero duration must not produce a zero charge")
	}
	if _, ok := perSecondTaskCost(map[string]any{}, 0.08); ok {
		t.Fatal("missing duration must be rejected")
	}
	if _, ok := perSecondTaskCost(map[string]any{"duration": float64(10)}, 0); ok {
		t.Fatal("missing unit price must be rejected")
	}
}

func TestPerMinutePriceBillsByDurationSeconds(t *testing.T) {
	quoted := 1.2
	billing, err := model.NormalizeChannelInternalPricing(&model.ChannelInternalPricing{
		Mode: model.ChannelPricingModePerMinute, PerMinuteUSD: model.MoneyFromFloatPtr(&quoted),
	})
	require.NoError(t, err)
	require.True(t, billing.UsePerSecond)
	assert.InDelta(t, 0.02, billing.PerSecondPrice, 1e-12)

	cost, ok := perSecondTaskCost(map[string]any{"duration": float64(120)}, billing.PerSecondPrice)
	require.True(t, ok)
	assert.InDelta(t, 2.4, cost, 1e-12)
}

func TestPerSecondSettlementExpressionUsesSameDuration(t *testing.T) {
	facts := map[string]any{"duration": float64(10)}
	input := billingexpr.RequestInputForUsage(facts)
	cost, _, err := billingexpr.RunExprWithRequest("tier(\"base\", duration * 0.08)", billingexpr.TokenParams{}, input)
	if err != nil {
		t.Fatalf("expression failed: %v", err)
	}
	if cost != 0.8 {
		t.Fatalf("cost = %v, want 0.8", cost)
	}
}
