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
package service

import (
	"testing"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/pkg/billingexpr"
)

func TestDefaultSaleMarkupScalesFlatPrice(t *testing.T) {
	input := 2.0
	pricing := model.ChannelInternalPricing{
		Mode: model.ChannelPricingModePerMillionTokens, InputUSDPerMillion: model.MoneyFromFloatPtr(&input),
	}
	require.True(t, applyDefaultSaleMarkup(&pricing))
	require.NotNil(t, pricing.InputUSDPerMillion)
	assert.InDelta(t, 2.2, pricing.InputUSDPerMillion.Float64(), 1e-9)
}

func TestDefaultSaleMarkupScalesExpressionResult(t *testing.T) {
	pricing := model.ChannelInternalPricing{
		Mode: model.ChannelPricingModeTieredExpr, BillingExpr: `tier("base", p * 2)`,
	}
	base, _, err := billingexpr.RunExprWithRequest(`tier("base", p * 2)`,
		billingexpr.TokenParams{P: 1000}, billingexpr.RequestInput{})
	require.NoError(t, err)
	require.True(t, applyDefaultSaleMarkup(&pricing))
	cost, _, err := billingexpr.RunExprWithRequest(pricing.BillingExpr,
		billingexpr.TokenParams{P: 1000}, billingexpr.RequestInput{})
	require.NoError(t, err)
	assert.InDelta(t, base*DefaultUterSaleMarkup, cost, 1e-9)
}

func TestDefaultSaleMarkupScalesFixedAmountInPlace(t *testing.T) {
	pricing := model.ChannelInternalPricing{
		Mode: model.ChannelPricingModeTieredExpr, BillingExpr: `tier("image", fixed(0.05)) * image_count`,
	}
	require.True(t, applyDefaultSaleMarkup(&pricing))
	assert.Contains(t, pricing.BillingExpr, "fixed(0.055")
	assert.NotContains(t, pricing.BillingExpr, ") * 1.1")
}

// TestDefaultSaleMarkupExactDecimalPrecision verifies the automatic markup no
// longer round-trips Money through Float64. Every input is compared against an
// independent shopspring/decimal calculation at full precision, including the
// tiny values where float64 conversion would silently lose digits.
func TestDefaultSaleMarkupExactDecimalPrecision(t *testing.T) {
	inputs := []string{
		"0.00000001", "0.00000010", "0.00000100", "0.00012345",
		"0.12345678", "1.00000001", "10.00000001", "999999.99999999",
	}
	factor := decimal.RequireFromString("1.10")
	for _, raw := range inputs {
		t.Run(raw, func(t *testing.T) {
			original, err := model.MoneyFromString(raw)
			require.NoError(t, err)
			pricing := model.ChannelInternalPricing{
				Mode:               model.ChannelPricingModePerMillionTokens,
				InputUSDPerMillion: &original,
			}
			require.True(t, applyDefaultSaleMarkup(&pricing))
			require.NotNil(t, pricing.InputUSDPerMillion)
			want := original.Decimal().Mul(factor)
			assert.True(t, pricing.InputUSDPerMillion.Decimal().Equal(want),
				"got %s, want exact decimal %s", pricing.InputUSDPerMillion.String(), want.String())
			// The source amount must stay numerically unchanged (Decimal
			// normalizes trailing zeros, so compare values, not string form).
			sourceValue, err := decimal.NewFromString(raw)
			require.NoError(t, err)
			assert.True(t, original.Decimal().Equal(sourceValue),
				"source amount mutated: got %s, want %s", original.String(), raw)
		})
	}
}

// TestDefaultSaleMarkupAppliedOnceInProductionPaths documents the compounding
// contract: applyDefaultSaleMarkup is intentionally non-idempotent (calling it
// twice on the same object yields 1.21x). Production safety therefore relies on
// each call site building a fresh internal price and calling exactly once.
// This test verifies that contract on the real builders rather than asserting
// an idempotence the function never promised.
func TestDefaultSaleMarkupAppliedOnceInProductionPaths(t *testing.T) {
	// Generic (New API / Uter.api) builder: source quote 10 USD/1M -> 11.
	encoded := genericExpressionInternalPricing(GenericPricingEntry{
		ModelName: "m", BillingMode: "tiered_expr", BillingExpr: `tier("base", p * 10)`,
	}, 100)
	require.NotEmpty(t, encoded)
	var internal model.ChannelInternalPricing
	require.NoError(t, common.UnmarshalJsonStr(encoded, &internal))
	base, _, err := billingexpr.RunExprWithRequest(`tier("base", p * 10)`, billingexpr.TokenParams{P: 1}, billingexpr.RequestInput{})
	require.NoError(t, err)
	got, _, err := billingexpr.RunExprWithRequest(internal.BillingExpr, billingexpr.TokenParams{P: 1}, billingexpr.RequestInput{})
	require.NoError(t, err)
	assert.InDelta(t, base*DefaultUterSaleMarkup, got, 1e-9, "exactly one markup, not 1.21x")

	// Flat-price builder from the Uter Route internal pricing path: 2 -> 2.2.
	input := model.MustMoney("2")
	pricing := model.ChannelInternalPricing{
		Mode: model.ChannelPricingModePerMillionTokens, InputUSDPerMillion: &input,
	}
	require.True(t, applyDefaultSaleMarkup(&pricing))
	assert.Equal(t, "2.2", pricing.InputUSDPerMillion.String())
}

// Bailian video models (e.g. HappyHorse) express per-second prices as
// `u("seconds") * (u("resolution") == ... ? 0.16 : ...)`. The price literals
// sit in ternary branches, not behind an identifier `*`, so the token/duration
// coefficient regexes do not see them. Without scaling them the default markup
// fails closed and the model is left with no internal price (bills zero).
func TestScaleBillingExprByFactorSecondsResolutionBranches(t *testing.T) {
	const expr = `tier("bailian-video", u("seconds") * (u("resolution") == "1080P" ? 0.165026 : u("resolution") == "720P" ? 0.123769 : 0.0618845))`
	scaled, ok := scaleBillingExprByFactor(expr, 1.1)
	require.True(t, ok, "seconds-resolution price expression must be scalable")
	require.NotEqual(t, expr, scaled)

	in1080 := billingexpr.RequestInput{Usage: map[string]any{"seconds": 3.0, "resolution": "1080P"}}
	in720 := billingexpr.RequestInput{Usage: map[string]any{"seconds": 3.0, "resolution": "720P"}}
	for _, in := range []billingexpr.RequestInput{in1080, in720} {
		base, _, baseErr := billingexpr.RunExprWithRequest(expr, billingexpr.TokenParams{}, in)
		got, _, gotErr := billingexpr.RunExprWithRequest(scaled, billingexpr.TokenParams{}, in)
		require.NoError(t, baseErr)
		require.NoError(t, gotErr)
		assert.InDelta(t, base*1.1, got, 1e-6, "scaled=%s", scaled)
	}
}

// TestBailianVideoSaleMarkupEndToEnd covers the full chain that previously
// billed zero: official per-second rates -> normalized view -> internal expr
// -> default markup. The markup must scale the enabled internal pricing so
// SeedBailianInternalPricing writes a billable price instead of failing closed.
func TestBailianVideoSaleMarkupEndToEnd(t *testing.T) {
	catalog := &BailianCatalog{
		Region: BailianRegionBeijing,
		Models: []BailianModel{{Model: "happyhorse-1.1-t2v"}},
	}
	applyHappyhorseOfficialPricing(catalog)
	view := bailianOfficialPricing(catalog.Models[0], BailianRegionBeijing, 7.2, 1700000000)
	encoded := bailianInternalPricing(view)
	require.NotEmpty(t, encoded, "injected rates must produce internal pricing")

	var pricing model.ChannelInternalPricing
	require.NoError(t, common.UnmarshalJsonStr(encoded, &pricing))
	require.NotEmpty(t, pricing.BillingExpr, "per-second tier expression expected")

	in720 := billingexpr.RequestInput{Usage: map[string]any{"seconds": 3.0, "resolution": "720P"}}
	base, _, err := billingexpr.RunExprWithRequest(pricing.BillingExpr, billingexpr.TokenParams{}, in720)
	require.NoError(t, err)
	require.Greater(t, base, 0.0)
	require.True(t, applyDefaultSaleMarkup(&pricing), "default markup must accept the per-second expression")
	got, _, err := billingexpr.RunExprWithRequest(pricing.BillingExpr, billingexpr.TokenParams{}, in720)
	require.NoError(t, err)
	assert.InDelta(t, base*DefaultUterSaleMarkup, got, 1e-6, "scaled=%s", pricing.BillingExpr)
}
