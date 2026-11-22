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

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/pkg/billingexpr"
)

func TestDefaultSaleMarkupScalesFlatPrice(t *testing.T) {
	input := 2.0
	pricing := model.ChannelInternalPricing{
		Mode: model.ChannelPricingModePerMillionTokens, InputUSDPerMillion: &input,
	}
	require.True(t, applyDefaultSaleMarkup(&pricing))
	require.NotNil(t, pricing.InputUSDPerMillion)
	assert.InDelta(t, 2.2, *pricing.InputUSDPerMillion, 1e-9)
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
