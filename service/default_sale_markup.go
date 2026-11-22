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
	"fmt"
	"strconv"
	"strings"

	"github.com/uter-ai/uter/model"
)

// DefaultUterSaleMarkup is the default Uter sale price relative to the
// upstream channel quote when the operator has not configured a rule.
const DefaultUterSaleMarkup = 1.10

// applyDefaultSaleMarkup scales an automatically derived sale price by the
// default markup. Operator, batch and approved prices never pass through this
// function. It returns false when the expression cannot be made executable.
func applyDefaultSaleMarkup(pricing *model.ChannelInternalPricing) bool {
	if pricing == nil {
		return false
	}
	for _, value := range []**float64{
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
			scaled := **value * DefaultUterSaleMarkup
			*value = &scaled
		}
	}
	for i := range pricing.Tiers {
		tier := &pricing.Tiers[i]
		for _, value := range []**float64{
			&tier.InputUSDPerMillion, &tier.OutputUSDPerMillion,
			&tier.CacheUSDPerMillion, &tier.CreateCacheUSDPerMillion,
			&tier.AudioInputUSDPerMillion, &tier.AudioOutputUSDPerMillion,
			&tier.ImageInputUSDPerMillion, &tier.ThinkingInputUSDPerMillion,
			&tier.ThinkingOutputUSDPerMillion, &tier.ThinkingCacheUSDPerMillion,
			&tier.ThinkingCreateCacheUSDPerMillion, &tier.ThinkingImageInputUSDPerMillion,
			&tier.MultiInputOutputUSDPerMillion, &tier.ThinkingMultiInputOutputUSDPerMillion,
		} {
			if *value != nil {
				scaled := **value * DefaultUterSaleMarkup
				*value = &scaled
			}
		}
	}
	if pricing.BillingExpr != "" {
		expr := pricing.BillingExpr
		if strings.Contains(expr, "fixed(") {
			// Task expressions reject a multiplier outside fixed(), so scale the
			// fixed amount in place.
			expr = dreamRouterFixedPriceDiscount.ReplaceAllStringFunc(expr, func(term string) string {
				match := dreamRouterFixedPriceDiscount.FindStringSubmatch(term)
				value, err := strconv.ParseFloat(match[1], 64)
				if err != nil {
					return term
				}
				return "fixed(" + strconv.FormatFloat(value*DefaultUterSaleMarkup, 'f', -1, 64) + ")"
			})
		} else {
			expr = fmt.Sprintf("(%s) * %s", expr,
				strconv.FormatFloat(DefaultUterSaleMarkup, 'f', -1, 64))
		}
		if !NormalizeUpstreamExpression(expr).Executable {
			return false
		}
		pricing.BillingExpr = expr
	}
	return true
}
