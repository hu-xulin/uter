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
	"math"
	"strconv"
	"strings"

	"github.com/uter-ai/uter/model"
)

// DefaultUterSaleMarkup is the default Uter sale price relative to the
// upstream channel quote when the operator has not configured a rule.
const DefaultUterSaleMarkup = 1.10

// scaleBillingExprByFactor multiplies every price coefficient in an upstream
// billing expression by factor, preserving the complete tier structure.
//
// It must not be replaced by a string-level "(expr) * factor" wrap: the
// billing engine rejects an ordinary multiplier outside fixed() charges, and
// such a wrap would silently leave a fixed() branch unscaled in mixed
// expressions (e.g. `len <= K ? tier("short", p * 1) : tier("long", fixed(0.05))`).
// Instead each coefficient is scaled in place:
//   - fixed(amount) charges: the numeric literal inside fixed();
//   - token/duration unit coefficients: the numeric literal in `<var> * n`.
//
// A failed normalization means the result is not executable, so callers must
// fail closed and leave the price unconfigured rather than charge an
// unscaled branch.
func scaleBillingExprByFactor(expr string, factor float64) (string, bool) {
	raw := strings.TrimSpace(expr)
	if raw == "" || factor <= 0 || math.IsNaN(factor) || math.IsInf(factor, 0) {
		return "", false
	}
	scaled := raw
	if len(uterRouteFixedPriceDiscount.FindAllString(raw, -1)) > 0 {
		scaled = uterRouteFixedPriceDiscount.ReplaceAllStringFunc(scaled, func(term string) string {
			match := uterRouteFixedPriceDiscount.FindStringSubmatch(term)
			value, err := strconv.ParseFloat(match[1], 64)
			if err != nil {
				return term
			}
			return "fixed(" + strconv.FormatFloat(roundRatioValue(value*factor), 'f', -1, 64) + ")"
		})
	}
	// Scale per-unit token/duration coefficients in place. image_count is a
	// request quantity, not a price coefficient, so it is never scaled.
	scaled = uterRouteExprUnitTermScaled.ReplaceAllStringFunc(scaled, func(term string) string {
		match := uterRouteExprUnitTermScaled.FindStringSubmatch(term)
		if match[1] == "image_count" {
			return term
		}
		value, err := strconv.ParseFloat(match[2], 64)
		if err != nil {
			return term
		}
		return match[1] + " * " + strconv.FormatFloat(roundRatioValue(value*factor), 'f', -1, 64)
	})
	normalized := NormalizeUpstreamExpression(scaled)
	if !normalized.Executable {
		return "", false
	}
	return scaled, true
}

// applyDefaultSaleMarkup scales an automatically derived sale price by the
// default markup. Operator, batch and approved prices never pass through this
// function. It returns false when the expression cannot be made executable.
func applyDefaultSaleMarkup(pricing *model.ChannelInternalPricing) bool {
	if pricing == nil {
		return false
	}
	for _, value := range []**model.Money{
		&pricing.InputUSDPerMillion, &pricing.OutputUSDPerMillion,
		&pricing.CacheUSDPerMillion, &pricing.CreateCacheUSDPerMillion,
		&pricing.AudioInputUSDPerMillion, &pricing.AudioOutputUSDPerMillion,
		&pricing.ImageInputUSDPerMillion, &pricing.ThinkingInputUSDPerMillion,
		&pricing.ThinkingOutputUSDPerMillion, &pricing.ThinkingCacheUSDPerMillion,
		&pricing.ThinkingCreateCacheUSDPerMillion, &pricing.ThinkingImageInputUSDPerMillion,
		&pricing.MultiInputOutputUSDPerMillion, &pricing.ThinkingMultiInputOutputUSDPerMillion,
		&pricing.PerCallUSD, &pricing.PerSecondUSD, &pricing.PerMinuteUSD,
	} {
		if *value != nil {
			scaled := **value
			next := model.MoneyFromFloat(scaled.Float64() * DefaultUterSaleMarkup)
			*value = &next
		}
	}
	for i := range pricing.Tiers {
		tier := &pricing.Tiers[i]
		for _, value := range []**model.Money{
			&tier.InputUSDPerMillion, &tier.OutputUSDPerMillion,
			&tier.CacheUSDPerMillion, &tier.CreateCacheUSDPerMillion,
			&tier.AudioInputUSDPerMillion, &tier.AudioOutputUSDPerMillion,
			&tier.ImageInputUSDPerMillion, &tier.ThinkingInputUSDPerMillion,
			&tier.ThinkingOutputUSDPerMillion, &tier.ThinkingCacheUSDPerMillion,
			&tier.ThinkingCreateCacheUSDPerMillion, &tier.ThinkingImageInputUSDPerMillion,
			&tier.MultiInputOutputUSDPerMillion, &tier.ThinkingMultiInputOutputUSDPerMillion,
		} {
			if *value != nil {
				next := model.MoneyFromFloat((**value).Float64() * DefaultUterSaleMarkup)
				*value = &next
			}
		}
	}
	if pricing.BillingExpr != "" {
		expr, ok := scaleBillingExprByFactor(pricing.BillingExpr, DefaultUterSaleMarkup)
		if !ok {
			return false
		}
		pricing.BillingExpr = expr
	}
	return true
}
