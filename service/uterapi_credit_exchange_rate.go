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
	"math"
	"strings"

	"github.com/shopspring/decimal"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting/operation_setting"
)

// applyUterAPICreditExchangeRate converts Uter.api / xxapi.ai channel-side
// amounts from "credit dollars" into real USD.
//
// The upstream sells ¥1 of credit as $1 of balance, so the dollar figures in
// its catalogue are really CNY amounts. Dividing by the market USD→CNY rate
// yields the actual dollar cost of that credit. Only channel prices are
// converted: the official reference tiers stay exactly as published, so the
// plaza still compares against the public list price.
//
// The conversion runs on freshly generated records on every sync and preview,
// so repeating a sync never compounds it. An invalid rate fails closed —
// keeping the previous rows is safer than publishing prices divided by zero
// or a stale placeholder.
func applyUterAPICreditExchangeRate(records []model.ChannelOfficialPricingRecord) error {
	rate := operation_setting.USDExchangeRate
	if math.IsNaN(rate) || math.IsInf(rate, 0) || rate <= 0 {
		return fmt.Errorf("invalid USD exchange rate %v; refuse to convert Uter.api channel prices", rate)
	}
	factor := decimal.NewFromInt(1).Div(decimal.NewFromFloat(rate))
	for i := range records {
		if err := applyUterAPICreditFXToRecord(&records[i], factor); err != nil {
			return err
		}
	}
	return nil
}

func applyUterAPICreditFXToRecord(
	record *model.ChannelOfficialPricingRecord,
	factor decimal.Decimal,
) error {
	if record == nil {
		return nil
	}
	if raw := strings.TrimSpace(record.InternalPricing); raw != "" {
		var internal model.ChannelInternalPricing
		if err := common.UnmarshalJsonStr(raw, &internal); err != nil {
			return fmt.Errorf("%s: decode internal pricing: %w", record.ModelName, err)
		}
		if expr := strings.TrimSpace(internal.BillingExpr); expr != "" {
			// Scale each coefficient in place. A "(expr) * factor" wrap is not
			// valid for fixed() charges and would leave mixed branches
			// unconverted; the shared helper handles both token and fixed
			// leaves and verifies the result is executable.
			exprFactor, _ := factor.Float64()
			converted, ok := scaleBillingExprByFactor(expr, exprFactor)
			if !ok {
				return fmt.Errorf("%s: FX-converted billing expression is not executable", record.ModelName)
			}
			internal.BillingExpr = converted
		}
		scaleChannelInternalPricing(&internal, factor)
		encoded, err := common.Marshal(internal)
		if err != nil {
			return fmt.Errorf("%s: encode internal pricing: %w", record.ModelName, err)
		}
		record.InternalPricing = string(encoded)
	}

	if raw := strings.TrimSpace(record.NormalizedPricing); raw != "" {
		var official model.ChannelOfficialPricing
		if err := common.UnmarshalJsonStr(raw, &official); err != nil {
			return fmt.Errorf("%s: decode normalized pricing: %w", record.ModelName, err)
		}
		// official.Tiers is the public reference price and must stay untouched.
		// ChannelPrice is the upstream quote under the selected group — that is
		// the one written in credit dollars, so it needs the same conversion.
		scaleChannelPricingTier(official.ChannelPrice, factor)
		for i := range official.ChannelPriceTiers {
			scaleChannelPricingTier(&official.ChannelPriceTiers[i], factor)
		}
		encoded, err := common.Marshal(official)
		if err != nil {
			return fmt.Errorf("%s: encode normalized pricing: %w", record.ModelName, err)
		}
		record.NormalizedPricing = string(encoded)
	}
	return nil
}

func scaleChannelInternalPricing(internal *model.ChannelInternalPricing, factor decimal.Decimal) {
	if internal == nil {
		return
	}
	scaleMoney(&internal.InputUSDPerMillion, factor)
	scaleMoney(&internal.OutputUSDPerMillion, factor)
	scaleMoney(&internal.CacheUSDPerMillion, factor)
	scaleMoney(&internal.CreateCacheUSDPerMillion, factor)
	scaleMoney(&internal.AudioInputUSDPerMillion, factor)
	scaleMoney(&internal.AudioOutputUSDPerMillion, factor)
	scaleMoney(&internal.ImageInputUSDPerMillion, factor)
	scaleMoney(&internal.ThinkingInputUSDPerMillion, factor)
	scaleMoney(&internal.ThinkingOutputUSDPerMillion, factor)
	scaleMoney(&internal.ThinkingCacheUSDPerMillion, factor)
	scaleMoney(&internal.ThinkingCreateCacheUSDPerMillion, factor)
	scaleMoney(&internal.ThinkingImageInputUSDPerMillion, factor)
	scaleMoney(&internal.MultiInputOutputUSDPerMillion, factor)
	scaleMoney(&internal.ThinkingMultiInputOutputUSDPerMillion, factor)
	scaleMoney(&internal.PerCallUSD, factor)
	scaleMoney(&internal.PerSecondUSD, factor)
	scaleMoney(&internal.PerMinuteUSD, factor)
	for i := range internal.Tiers {
		scaleChannelInternalTier(&internal.Tiers[i], factor)
	}
}

func scaleChannelInternalTier(tier *model.ChannelInternalPricingTier, factor decimal.Decimal) {
	if tier == nil {
		return
	}
	scaleMoney(&tier.InputUSDPerMillion, factor)
	scaleMoney(&tier.OutputUSDPerMillion, factor)
	scaleMoney(&tier.CacheUSDPerMillion, factor)
	scaleMoney(&tier.CreateCacheUSDPerMillion, factor)
	scaleMoney(&tier.AudioInputUSDPerMillion, factor)
	scaleMoney(&tier.AudioOutputUSDPerMillion, factor)
	scaleMoney(&tier.ImageInputUSDPerMillion, factor)
	scaleMoney(&tier.ThinkingInputUSDPerMillion, factor)
	scaleMoney(&tier.ThinkingOutputUSDPerMillion, factor)
	scaleMoney(&tier.ThinkingCacheUSDPerMillion, factor)
	scaleMoney(&tier.ThinkingCreateCacheUSDPerMillion, factor)
	scaleMoney(&tier.ThinkingImageInputUSDPerMillion, factor)
	scaleMoney(&tier.MultiInputOutputUSDPerMillion, factor)
	scaleMoney(&tier.ThinkingMultiInputOutputUSDPerMillion, factor)
	scaleMoney(&tier.PerUnitUSD, factor)
}

func scaleChannelPricingTier(tier *model.ChannelPricingTier, factor decimal.Decimal) {
	if tier == nil {
		return
	}
	scaleMoney(&tier.InputPerMillionUSD, factor)
	scaleMoney(&tier.OutputPerMillionUSD, factor)
	scaleMoney(&tier.CachePerMillionUSD, factor)
	scaleMoney(&tier.CreateCachePerMillionUSD, factor)
	scaleMoney(&tier.ImageInputPerMillionUSD, factor)
	scaleMoney(&tier.ThinkingInputPerMillionUSD, factor)
	scaleMoney(&tier.ThinkingOutputPerMillionUSD, factor)
	scaleMoney(&tier.ThinkingCachePerMillionUSD, factor)
	scaleMoney(&tier.ThinkingCreateCachePerMillionUSD, factor)
	scaleMoney(&tier.ThinkingImageInputPerMillionUSD, factor)
	scaleMoney(&tier.MultiInputOutputPerMillionUSD, factor)
	scaleMoney(&tier.ThinkingMultiInputOutputPerMillionUSD, factor)
	scaleMoney(&tier.AudioInputPerMillionUSD, factor)
	scaleMoney(&tier.AudioOutputPerMillionUSD, factor)
	scaleMoney(&tier.PerUnitUSD, factor)
}

func scaleMoney(target **model.Money, factor decimal.Decimal) {
	if target == nil || *target == nil {
		return
	}
	scaled := (*target).MulDecimal(factor)
	*target = &scaled
}
