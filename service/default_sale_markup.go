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
	"regexp"
	"strconv"
	"strings"

	"github.com/shopspring/decimal"

	"github.com/uter-ai/uter/model"
)

// DefaultUterSaleMarkup is the default Uter sale price relative to the
// upstream channel quote when the operator has not configured a rule.
const DefaultUterSaleMarkup = 1.10

// defaultUterSaleMarkupDecimal is the exact decimal form of the markup. Using
// a string literal (not decimal.NewFromFloat) preserves the intended 1.10 and
// avoids float64 round-trips when scaling Money amounts.
var defaultUterSaleMarkupDecimal = decimal.RequireFromString("1.10")

// The coefficient regexes below intentionally accept only plain decimals.
// Reject exponent notation before they can match the mantissa (e.g. the "1"
// in "1e-5") and leave a partially scaled expression behind.
var uterRouteScientificNotation = regexp.MustCompile(`[0-9]+(?:\.[0-9]+)?[eE][+-]?[0-9]+`)

// Task-usage billing expressions for Bailian video models put the per-second
// USD price inside a ternary chain that is the right operand of `u("seconds") *`:
//
//	u("seconds") * (u("resolution") == "1080P" ? 0.165026 : u("resolution") == "720P" ? 0.123769 : 0.0618845)
//
// The literals following ?/:/ are real prices here, unlike the bare discount
// multipliers deliberately left alone by the unit-coefficient pass. This
// regex is anchored to the `u("seconds") * (` prefix so no other ternary
// constant in the expression can be touched.
var usageSecondsMultiplyPrefix = regexp.MustCompile(`u\(\s*"seconds"\s*\)\s*\*\s*\(`)
var usageTernaryPriceLiteral = regexp.MustCompile(`([?:]\s*)([0-9]+(?:\.[0-9]+)?)`)

// scaleUsageSecondsPriceBranches scales only the ternary price literals under
// a `u("seconds") * (...)` operand. It returns false when either the operand
// is absent or its parentheses are unbalanced, so callers fail closed instead
// of rewriting a partially parsed expression.
func scaleUsageSecondsPriceBranches(expr string, factor float64) (string, bool) {
	locations := usageSecondsMultiplyPrefix.FindAllStringIndex(expr, -1)
	if len(locations) == 0 {
		return expr, false
	}
	var builder strings.Builder
	last := 0
	scaledAny := false
	for _, location := range locations {
		depth := 1
		end := location[1]
		for end < len(expr) && depth > 0 {
			switch expr[end] {
			case '(':
				depth++
			case ')':
				depth--
			}
			end++
		}
		if depth != 0 {
			return expr, false
		}
		inner := expr[location[1] : end-1]
		newInner := usageTernaryPriceLiteral.ReplaceAllStringFunc(inner, func(term string) string {
			match := usageTernaryPriceLiteral.FindStringSubmatch(term)
			value, err := strconv.ParseFloat(match[2], 64)
			if err != nil {
				return term
			}
			scaledAny = true
			return match[1] + strconv.FormatFloat(roundRatioValue(value*factor), 'f', -1, 64)
		})
		builder.WriteString(expr[last:location[1]])
		builder.WriteString(newInner)
		builder.WriteString(")")
		last = end
	}
	builder.WriteString(expr[last:])
	return builder.String(), scaledAny
}

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
	if uterRouteScientificNotation.MatchString(raw) {
		return "", false
	}
	scaled := raw
	scaledAny := false
	if len(uterRouteFixedPriceDiscount.FindAllString(raw, -1)) > 0 {
		scaled = uterRouteFixedPriceDiscount.ReplaceAllStringFunc(scaled, func(term string) string {
			match := uterRouteFixedPriceDiscount.FindStringSubmatch(term)
			value, err := strconv.ParseFloat(match[1], 64)
			if err != nil {
				return term
			}
			scaledAny = true
			return "fixed(" + strconv.FormatFloat(roundRatioValue(value*factor), 'f', -1, 64) + ")"
		})
	}
	// Duration prices are written as `(…duration…) * <usd_per_second>` or
	// bare `duration * <usd_per_second>`. They have no identifier directly in
	// front of `*`, so the unit-term regex below cannot see them. Scaling this
	// branch first also prevents the unit pass from scaling bare `duration`
	// twice; a plain `(expr) * factor` wrap is still forbidden because the
	// billing engine rejects ordinary multipliers around fixed() charges.
	scaled = uterRouteExprDurationTerm.ReplaceAllStringFunc(scaled, func(term string) string {
		match := uterRouteExprDurationTerm.FindStringSubmatch(term)
		value, err := strconv.ParseFloat(match[2], 64)
		if err != nil {
			return term
		}
		scaledAny = true
		scaledValue := strconv.FormatFloat(roundRatioValue(value*factor), 'f', -1, 64)
		if match[1] == "" {
			return "duration * " + scaledValue
		}
		return "(" + match[1] + ") * " + scaledValue
	})
	// Task-usage prices (`u("seconds") * (ternary resolution prices)`) have no
	// identifier or fixed() coefficient for the passes above. Scale only the
	// price literals inside that operand; conditions and thresholds stay put.
	scaled, usageScaled := scaleUsageSecondsPriceBranches(scaled, factor)
	scaledAny = scaledAny || usageScaled
	// Scale per-unit token coefficients in place. A bare request quantity such
	// as `tier(...) * image_count` has no numeric coefficient and is left
	// untouched; `image_count * 5` is a per-image price and must be scaled.
	scaled = uterRouteExprUnitTermScaled.ReplaceAllStringFunc(scaled, func(term string) string {
		match := uterRouteExprUnitTermScaled.FindStringSubmatch(term)
		if match[1] == "duration" {
			return term
		}
		value, err := strconv.ParseFloat(match[2], 64)
		if err != nil {
			return term
		}
		scaledAny = true
		return match[1] + " * " + strconv.FormatFloat(roundRatioValue(value*factor), 'f', -1, 64)
	})
	if !scaledAny {
		return "", false
	}
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
			next := (**value).MulDecimal(defaultUterSaleMarkupDecimal)
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
				next := (**value).MulDecimal(defaultUterSaleMarkupDecimal)
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
