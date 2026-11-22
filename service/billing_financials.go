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
	"encoding/json"
	"strconv"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/pkg/billingexpr"
)

// 采购成本维度单位。token 类维度按百万 token 计价，其余按单个计量单位计价。
const (
	purchaseUnitMillionTokens = "1m_tokens"
	purchaseUnitImage         = "image"
	purchaseUnitCall          = "call"
	purchaseUnitSecond        = "second"
	purchaseUnitMinute        = "minute"
)

// purchasePriceBook is the purchase contract reduced to one price per metered
// dimension: either the selected tier or the contract's scalar values.
type purchasePriceBook struct {
	tier                         string
	input, output                *float64
	cacheRead, cacheWrite        *float64
	audioInput, audioOutput      *float64
	imageInput, thinkingIn       *float64
	thinkingOut                  *float64
	perImage, perSecond, perCall *float64
	perMinute                    *float64
}

type purchaseCostDimension struct {
	name     string
	quantity float64
	unit     string
	price    *float64
}

// usageQuantity reads the first matching key as a finite non-negative number.
// Billing usage arrives as JSON in production and as typed maps in tests, so
// both shapes are accepted.
func usageQuantity(usage map[string]any, keys ...string) float64 {
	for _, key := range keys {
		value, ok := usage[key]
		if !ok {
			continue
		}
		switch typed := value.(type) {
		case float64:
			return nonNegativeFinite(typed)
		case float32:
			return nonNegativeFinite(float64(typed))
		case int:
			return nonNegativeFinite(float64(typed))
		case int64:
			return nonNegativeFinite(float64(typed))
		case json.Number:
			parsed, err := typed.Float64()
			if err == nil {
				return nonNegativeFinite(parsed)
			}
		case string:
			if parsed, err := strconv.ParseFloat(strings.TrimSpace(typed), 64); err == nil {
				return nonNegativeFinite(parsed)
			}
		}
	}
	return 0
}

func nonNegativeFinite(value float64) float64 {
	if value < 0 || value != value || value > 1e18 {
		return 0
	}
	return value
}

// selectPurchaseTier picks the cost tier that covers the request's input
// volume. Tiered contracts bill the whole request at the matched range.
func selectPurchaseTier(pricing model.ChannelInternalPricing, inputTokens float64) (model.ChannelInternalPricingTier, bool) {
	if len(pricing.Tiers) == 0 {
		return model.ChannelInternalPricingTier{}, false
	}
	for _, tier := range pricing.Tiers {
		if tier.MinInputTokens > 0 && inputTokens < float64(tier.MinInputTokens) {
			continue
		}
		if tier.MaxInputTokens > 0 && inputTokens > float64(tier.MaxInputTokens) {
			continue
		}
		return tier, true
	}
	return pricing.Tiers[0], true
}

func purchasePriceBookFor(pricing model.ChannelInternalPricing, inputTokens float64) purchasePriceBook {
	book := purchasePriceBook{
		input: pricing.InputUSDPerMillion, output: pricing.OutputUSDPerMillion,
		cacheRead: pricing.CacheUSDPerMillion, cacheWrite: pricing.CreateCacheUSDPerMillion,
		audioInput: pricing.AudioInputUSDPerMillion, audioOutput: pricing.AudioOutputUSDPerMillion,
		imageInput: pricing.ImageInputUSDPerMillion,
		thinkingIn: pricing.ThinkingInputUSDPerMillion, thinkingOut: pricing.ThinkingOutputUSDPerMillion,
		perSecond: pricing.PerSecondUSD, perCall: pricing.PerCallUSD, perMinute: pricing.PerMinuteUSD,
	}
	tier, ok := selectPurchaseTier(pricing, inputTokens)
	if !ok {
		return book
	}
	book.tier = tier.RangeName
	if tier.InputUSDPerMillion != nil {
		book.input = tier.InputUSDPerMillion
	}
	if tier.OutputUSDPerMillion != nil {
		book.output = tier.OutputUSDPerMillion
	}
	if tier.CacheUSDPerMillion != nil {
		book.cacheRead = tier.CacheUSDPerMillion
	}
	if tier.CreateCacheUSDPerMillion != nil {
		book.cacheWrite = tier.CreateCacheUSDPerMillion
	}
	if tier.AudioInputUSDPerMillion != nil {
		book.audioInput = tier.AudioInputUSDPerMillion
	}
	if tier.AudioOutputUSDPerMillion != nil {
		book.audioOutput = tier.AudioOutputUSDPerMillion
	}
	if tier.ImageInputUSDPerMillion != nil {
		book.imageInput = tier.ImageInputUSDPerMillion
	}
	if tier.ThinkingInputUSDPerMillion != nil {
		book.thinkingIn = tier.ThinkingInputUSDPerMillion
	}
	if tier.ThinkingOutputUSDPerMillion != nil {
		book.thinkingOut = tier.ThinkingOutputUSDPerMillion
	}
	book.perImage = tier.PerUnitUSD
	return book
}

// buildPurchaseCostRows prices every metered dimension of one request from the
// contract frozen at submit time. A dimension the contract does not price is
// reported as purchase_missing with a zero amount instead of being silently
// billed at the sale price.
func buildPurchaseCostRows(contract string, usage map[string]any) ([]model.BillingCostBreakdown, bool) {
	cost := model.ParseChannelPurchaseCost(contract)
	if cost == nil {
		return nil, false
	}
	if strings.TrimSpace(cost.Pricing.BillingExpr) != "" || cost.Pricing.Mode == model.ChannelPricingModeTieredExpr {
		row := expressionPurchaseCostRow(cost, usage)
		return []model.BillingCostBreakdown{row}, cost.Verified && row.Issue == ""
	}
	inputTokens := usageQuantity(usage, "prompt_tokens", "input_tokens")
	prices := purchasePriceBookFor(cost.Pricing, inputTokens)

	cacheRead := usageQuantity(usage, "cache_read_tokens", "cached_tokens")
	cacheWrite := usageQuantity(usage, "cache_creation_tokens", "cache_write_tokens")
	rawInput := inputTokens
	if rawInput >= cacheRead+cacheWrite {
		rawInput -= cacheRead + cacheWrite
	}

	dimensions := []purchaseCostDimension{
		{"input", rawInput, purchaseUnitMillionTokens, prices.input},
		{"output", usageQuantity(usage, "completion_tokens", "output_tokens"), purchaseUnitMillionTokens, prices.output},
		{"cache_read", cacheRead, purchaseUnitMillionTokens, prices.cacheRead},
		{"cache_write", cacheWrite, purchaseUnitMillionTokens, prices.cacheWrite},
		{"audio_input", usageQuantity(usage, "audio_input_tokens"), purchaseUnitMillionTokens, prices.audioInput},
		{"audio_output", usageQuantity(usage, "audio_output_tokens"), purchaseUnitMillionTokens, prices.audioOutput},
		{"thinking_input", usageQuantity(usage, "thinking_input_tokens"), purchaseUnitMillionTokens, prices.thinkingIn},
		{"thinking_output", usageQuantity(usage, "thinking_output_tokens"), purchaseUnitMillionTokens, prices.thinkingOut},
	}
	if images := usageQuantity(usage, "image_count"); images > 0 {
		dimensions = append(dimensions, purchaseCostDimension{"image", images, purchaseUnitImage, prices.perImage})
	} else {
		dimensions = append(dimensions, purchaseCostDimension{"image_tokens", usageQuantity(usage, "image_tokens"), purchaseUnitMillionTokens, prices.imageInput})
	}
	if seconds := usageQuantity(usage, "seconds", "duration_seconds", "duration"); seconds > 0 {
		dimensions = append(dimensions, purchaseCostDimension{"duration", seconds, purchaseUnitSecond, prices.perSecond})
	}
	if minutes := usageQuantity(usage, "duration_minutes"); minutes > 0 {
		dimensions = append(dimensions, purchaseCostDimension{"duration_minutes", minutes, purchaseUnitMinute, prices.perMinute})
	}
	if cost.Pricing.Mode == model.ChannelPricingModePerCall {
		dimensions = append(dimensions, purchaseCostDimension{"call", 1, purchaseUnitCall, prices.perCall})
	}

	rows := make([]model.BillingCostBreakdown, 0, len(dimensions))
	verified := cost.Verified
	for _, dimension := range dimensions {
		if dimension.quantity <= 0 {
			continue
		}
		row := model.BillingCostBreakdown{
			Dimension: dimension.name,
			Tier:      prices.tier,
			Quantity:  dimension.quantity,
			Unit:      dimension.unit,
			Currency:  "USD",
			FXRate:    1,
			Source:    cost.Source,
			Verified:  cost.Verified,
		}
		switch {
		case dimension.price == nil || *dimension.price <= 0:
			row.Issue = "purchase_missing"
			verified = false
		default:
			row.UnitPriceUSD = *dimension.price
			if dimension.unit == purchaseUnitMillionTokens {
				row.AmountUSD = dimension.quantity / 1_000_000 * *dimension.price
			} else {
				row.AmountUSD = dimension.quantity * *dimension.price
			}
		}
		if !cost.Verified && row.Issue == "" {
			row.Issue = "purchase_unverified"
		}
		row.Verified = cost.Verified && row.Issue == ""
		rows = append(rows, row)
	}
	return rows, verified && len(rows) > 0
}

// recordRequestFinancials books the money side of one settled or refunded
// voucher: sale revenue, any refund, the per-dimension purchase cost and the
// derived profit state. All entries are idempotent by identity, so retries and
// duplicate callbacks cannot book twice.
func recordRequestFinancials(snapshot *model.BillingPriceSnapshot, usageJSON string, saleQuota, refundQuota int64) {
	if snapshot == nil || model.DB == nil {
		return
	}
	usage := map[string]any{}
	if strings.TrimSpace(usageJSON) != "" {
		if err := common.UnmarshalJsonStr(usageJSON, &usage); err != nil {
			common.SysError(common.LogText(
				"billing financials: invalid usage breakdown (request=%s task=%s): %s",
				snapshot.RequestId, snapshot.TaskId, err.Error()))
			usage = map[string]any{}
		}
	}

	keyPrefix := snapshot.RequestId + "|" + snapshot.TaskId + "|" + snapshot.ModelName
	now := time.Now().Unix()
	quotaPerUnit := snapshot.QuotaPerUnit
	if quotaPerUnit <= 0 {
		quotaPerUnit = common.QuotaPerUnit
	}
	quotaToUSD := func(quota int64) float64 {
		if quota <= 0 || quotaPerUnit <= 0 {
			return 0
		}
		return float64(quota) / quotaPerUnit
	}
	baseEntry := func(entryType string) model.BillingFinancialLedger {
		return model.BillingFinancialLedger{
			EntryKey:  entryType + "|" + keyPrefix,
			EntryType: entryType,
			RequestId: snapshot.RequestId, TaskId: snapshot.TaskId,
			ModelName: snapshot.ModelName, ChannelId: snapshot.ChannelId, UserId: snapshot.UserId,
			Currency: "USD", FXRate: 1, Source: snapshot.PriceSource, CreatedAt: now,
		}
	}

	if saleQuota > 0 {
		entry := baseEntry(model.BillingLedgerEntrySale)
		entry.Quota = saleQuota
		entry.AmountUSD = quotaToUSD(saleQuota)
		entry.Status = model.BillingLedgerStatusRecorded
		if err := model.SaveBillingLedgerEntry(entry); err != nil {
			common.SysError(common.LogText("billing financials: sale entry failed (request=%s task=%s): %s", snapshot.RequestId, snapshot.TaskId, err.Error()))
		}
	}
	if refundQuota > 0 {
		entry := baseEntry(model.BillingLedgerEntryRefund)
		entry.Quota = refundQuota
		entry.AmountUSD = -quotaToUSD(refundQuota)
		entry.Status = model.BillingLedgerStatusRecorded
		if err := model.SaveBillingLedgerEntry(entry); err != nil {
			common.SysError(common.LogText("billing financials: refund entry failed (request=%s task=%s): %s", snapshot.RequestId, snapshot.TaskId, err.Error()))
		}
	}

	rows, verified := buildPurchaseCostRows(snapshot.PurchaseContract, usage)
	if len(rows) == 0 && snapshot.PurchaseUSD != nil && *snapshot.PurchaseUSD > 0 {
		// 没有合同成本时只能按上游公布的主维度报价估算，且永远不算已验证。
		if inputTokens := usageQuantity(usage, "prompt_tokens", "input_tokens"); inputTokens > 0 {
			rows = append(rows, model.BillingCostBreakdown{
				Dimension: "input", Quantity: inputTokens, Unit: purchaseUnitMillionTokens,
				UnitPriceUSD: *snapshot.PurchaseUSD,
				AmountUSD:    inputTokens / 1_000_000 * *snapshot.PurchaseUSD,
				Currency:     "USD", FXRate: 1,
				Source: snapshot.PurchaseSource, Verified: false, Issue: "purchase_unverified",
			})
			verified = false
		}
	}
	if len(rows) == 0 {
		return
	}
	for i := range rows {
		rows[i].RequestId = snapshot.RequestId
		rows[i].TaskId = snapshot.TaskId
		rows[i].ModelName = snapshot.ModelName
		rows[i].ChannelId = snapshot.ChannelId
	}
	if err := model.SaveBillingCostBreakdowns(rows); err != nil {
		common.SysError(common.LogText("billing financials: cost breakdown failed (request=%s task=%s): %s", snapshot.RequestId, snapshot.TaskId, err.Error()))
		return
	}
	totalCost := 0.0
	for _, row := range rows {
		totalCost += row.AmountUSD
	}
	entry := baseEntry(model.BillingLedgerEntryPurchaseCost)
	entry.AmountUSD = totalCost
	entry.Status = model.BillingLedgerStatusPendingPurchase
	if verified {
		entry.Status = model.BillingLedgerStatusVerified
	}
	if err := model.SaveBillingLedgerEntry(entry); err != nil {
		common.SysError(common.LogText("billing financials: purchase cost entry failed (request=%s task=%s): %s", snapshot.RequestId, snapshot.TaskId, err.Error()))
	}
}

// expressionPurchaseCostRow prices one request with a tiered expression
// contract. The expression runs on the same usage facts the request was billed
// with, so add-ons such as per-image pricing stay consistent with the sale side.
func expressionPurchaseCostRow(cost *model.ChannelPurchaseCost, usage map[string]any) model.BillingCostBreakdown {
	row := model.BillingCostBreakdown{
		Dimension: "expression", Unit: "expression", Quantity: 1,
		Currency: "USD", FXRate: 1, Source: cost.Source, Verified: cost.Verified,
	}
	used := billingexpr.UsedVars(cost.Pricing.BillingExpr)
	input := billingexpr.RequestInputForUsage(usage)
	if images := usageQuantity(usage, "image_count"); images > 0 {
		count := int(images)
		input.ImageCount = &count
	}
	raw, trace, err := billingexpr.RunExprWithRequest(cost.Pricing.BillingExpr, tokenParamsFromUsageFacts(usage, used), input)
	if err != nil {
		row.Issue = "purchase_expression_failed"
		return row
	}
	row.AmountUSD = raw / 1_000_000
	row.Tier = trace.MatchedTier
	if !cost.Verified {
		row.Issue = "purchase_unverified"
		row.Verified = false
	}
	return row
}

// tokenParamsFromUsageFacts mirrors BuildTieredTokenParams for stored usage
// maps: a priced sub-category is removed from the base text token count.
func tokenParamsFromUsageFacts(usage map[string]any, used map[string]bool) billingexpr.TokenParams {
	p := usageQuantity(usage, "prompt_tokens", "input_tokens")
	c := usageQuantity(usage, "completion_tokens", "output_tokens")
	cr := usageQuantity(usage, "cache_read_tokens", "cached_tokens")
	cc := usageQuantity(usage, "cache_creation_tokens", "cache_write_tokens")
	cc1h := usageQuantity(usage, "cache_creation_1h_tokens")
	img := usageQuantity(usage, "image_tokens")
	imgO := usageQuantity(usage, "image_output_tokens")
	ai := usageQuantity(usage, "audio_input_tokens")
	ao := usageQuantity(usage, "audio_output_tokens")
	rt := usageQuantity(usage, "thinking_output_tokens")

	inputLen := p
	if used["cr"] {
		p -= cr
	}
	if used["cc"] {
		p -= cc
	}
	if used["cc1h"] {
		p -= cc1h
	}
	if used["img"] {
		p -= img
	}
	if used["ai"] {
		p -= ai
	}
	if used["img_o"] {
		c -= imgO
	}
	if used["ao"] {
		c -= ao
	}
	if p < 0 {
		p = 0
	}
	if c < 0 {
		c = 0
	}
	return billingexpr.TokenParams{
		P: p, C: c, Len: inputLen, CR: cr, CC: cc, CC1h: cc1h,
		Img: img, ImgO: imgO, AI: ai, AO: ao, RT: rt,
	}
}
