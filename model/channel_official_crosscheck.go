package model

import (
	"encoding/json"
	"math"
	"regexp"
	"strconv"
	"strings"

	"github.com/uter-ai/uter/common"
)

// This file implements the channel-agnostic official-price cross-check. Every
// channel's official price — whether captured from the upstream catalogue or
// computed from ratios/expressions — must agree with Uter's built-in
// synchronized pricing (Admin → Models → "同步定价", persisted in the options
// table) before it is trusted for automatic billing. A disagreement marks the
// row for review and removes the auto-billing price.
//
// The baseline is deliberately NOT UterRouteSyncSnapshot: that snapshot feeds
// the pricing plaza's strike-through display, while the operator's synchronized
// pricing options are the configured official reference this check compares
// against.

// synchronizedOfficialPrice is one comparable price line reconstructed from
// the synchronized pricing options. Token amounts are USD per 1M tokens;
// PerCall/PerSecond are USD per request/second.
type synchronizedOfficialPrice struct {
	Input       float64 `json:"input"`
	Output      float64 `json:"output"`
	Cache       float64 `json:"cache"`
	CreateCache float64 `json:"create_cache"`
	PerCall     float64 `json:"per_call"`
	PerSecond   float64 `json:"per_second"`
}

var (
	// Built-in tiered expressions publish USD per 1M tokens directly as the
	// coefficient of p/c/cr/cc (see setting/billing_setting/builtin_billing.go).
	// The first occurrence is the standard tier; long-context variants follow.
	tieredTokenPricePattern  = regexp.MustCompile(`\b(p|c|cr|cc)\b\s*\*\s*([0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)`)
	fixedRequestPricePattern = regexp.MustCompile(`\bfixed\s*\(\s*([0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)\s*\)`)
)

// officialFromSynchronizedEffective converts one model's effective pricing
// configuration into the same USD-per-million universe the channel catalogue
// uses. Legacy ratios are converted with the gateway's own charging basis
// (USD/M = ratio * 1_000_000 / common.QuotaPerUnit, i.e. ratio * 2 at the
// default quota unit); tiered expressions already carry absolute USD amounts.
func officialFromSynchronizedEffective(effective PricingValues) synchronizedOfficialPrice {
	var price synchronizedOfficialPrice
	mode, _ := effective["billing_setting.billing_mode"].(string)
	if mode == "tiered_expr" {
		expr, _ := effective["billing_setting.billing_expr"].(string)
		for _, match := range tieredTokenPricePattern.FindAllStringSubmatch(expr, -1) {
			value, err := strconv.ParseFloat(match[2], 64)
			if err != nil || value <= 0 || math.IsInf(value, 0) || math.IsNaN(value) {
				continue
			}
			switch match[1] {
			case "p":
				if price.Input == 0 {
					price.Input = value
				}
			case "c":
				if price.Output == 0 {
					price.Output = value
				}
			case "cr":
				if price.Cache == 0 {
					price.Cache = value
				}
			case "cc":
				if price.CreateCache == 0 {
					price.CreateCache = value
				}
			}
		}
	} else if ratio, ok := effective["ModelRatio"].(float64); ok &&
		ratio > 0 && common.QuotaPerUnit > 0 {
		base := ratio * 1_000_000 / common.QuotaPerUnit
		price.Input = base
		if multiplier, ok := effective["CompletionRatio"].(float64); ok {
			price.Output = base * multiplier
		}
		if multiplier, ok := effective["CacheRatio"].(float64); ok {
			price.Cache = base * multiplier
		}
		if multiplier, ok := effective["CreateCacheRatio"].(float64); ok {
			price.CreateCache = base * multiplier
		}
	}
	if modelPrice, ok := effective["ModelPrice"].(float64); ok && modelPrice > 0 {
		price.PerCall = modelPrice
	}
	if match := fixedRequestPricePattern.FindStringSubmatch(
		strings.TrimSpace(stringValue(effective["billing_setting.billing_expr"])),
	); len(match) == 2 {
		if value, err := strconv.ParseFloat(match[1], 64); err == nil && value > 0 {
			price.PerCall = value
		}
	}
	return price
}

func stringValue(value any) string {
	if text, ok := value.(string); ok {
		return text
	}
	return ""
}

// synchronizedOfficialBaseline indexes the operator's synchronized pricing by
// normalized model name so a channel name using separators differently
// ("claude-fable-5.1" vs "claude-fable-5-1") still resolves to the same
// reference price. A nil baseline means there is no comparable synchronized
// price, which is not proof of a mismatch.
func synchronizedOfficialBaseline() map[string]synchronizedOfficialPrice {
	if DB == nil {
		return nil
	}
	snapshot, err := GetModelPricingSnapshot(nil)
	if err != nil || snapshot == nil {
		return nil
	}
	baseline := make(map[string]synchronizedOfficialPrice, len(snapshot.Entries))
	for _, entry := range snapshot.Entries {
		key := normalizeModelMatchName(entry.ModelName)
		if key == "" {
			continue
		}
		if _, exists := baseline[key]; exists {
			continue
		}
		price := officialFromSynchronizedEffective(entry.Effective)
		if price.Input <= 0 && price.PerCall <= 0 {
			continue
		}
		baseline[key] = price
	}
	return baseline
}

// crossCheckOfficialPrice compares one normalized official view against the
// synchronized pricing baseline. It returns (reason, false) on a disagreement
// and ("", true) when the sources agree or no comparable reference exists.
func crossCheckOfficialPrice(
	view ChannelOfficialPricing,
	modelName string,
	baseline map[string]synchronizedOfficialPrice,
) (string, bool) {
	if len(view.Tiers) == 0 || len(baseline) == 0 {
		return "", true
	}
	row, ok := baseline[normalizeModelMatchName(modelName)]
	if !ok {
		return "", true
	}
	tier := view.Tiers[0]
	unit := strings.ToLower(strings.TrimSpace(view.Unit))
	perCallView := unit == "per_call" || unit == "per_image" || unit == "per_minute" ||
		(tier.InputPerMillionUSD == nil && tier.PerUnitUSD != nil)
	if perCallView || (row.PerCall > 0 && tier.InputPerMillionUSD == nil) {
		// The two sources are only comparable in the same unit. A model whose
		// synchronized pricing is token-based (e.g. gpt-image-2 publishes a
		// token expression) and whose upstream catalogue publishes a per-image
		// fixed price has no common basis here; that is not a disagreement.
		if row.PerCall <= 0 {
			return "", true
		}
		if tier.PerUnitUSD == nil || !officialMoneyEqual(tier.PerUnitUSD, row.PerCall) {
			return "official per-call price disagrees with Uter synchronized pricing", false
		}
		return "", true
	}
	if unit == "per_second" || row.PerSecond > 0 {
		if row.PerSecond <= 0 {
			return "", true
		}
		if tier.PerUnitUSD == nil || !officialMoneyEqual(tier.PerUnitUSD, row.PerSecond) {
			return "official per-second price disagrees with Uter synchronized pricing", false
		}
		return "", true
	}
	if row.Input <= 0 {
		return "", true
	}
	if !officialMoneyEqual(tier.InputPerMillionUSD, row.Input) {
		return "official input price disagrees with Uter synchronized pricing", false
	}
	if tier.OutputPerMillionUSD != nil && row.Output > 0 &&
		!officialMoneyEqual(tier.OutputPerMillionUSD, row.Output) {
		return "official output price disagrees with Uter synchronized pricing", false
	}
	if tier.CachePerMillionUSD != nil && row.Cache > 0 &&
		!officialMoneyEqual(tier.CachePerMillionUSD, row.Cache) {
		return "official cache price disagrees with Uter synchronized pricing", false
	}
	if tier.CreateCachePerMillionUSD != nil && row.CreateCache > 0 &&
		!officialMoneyEqual(tier.CreateCachePerMillionUSD, row.CreateCache) {
		return "official cache-write price disagrees with Uter synchronized pricing", false
	}
	return "", true
}

// officialMoneyEqual compares an optional money amount with a plain float
// within a small relative tolerance (rounding only).
func officialMoneyEqual(amount *Money, expected float64) bool {
	if amount == nil || expected == 0 {
		return amount == nil && expected == 0
	}
	actual := amount.Float64()
	diff := math.Abs(actual - expected)
	scale := math.Max(math.Abs(actual), math.Abs(expected))
	return diff <= 1e-6*scale
}

// applyOfficialCrossCheck marks every record whose official price disagrees
// with Uter's synchronized pricing for review and removes its auto-billing
// price. It is applied at the single persistence entry point so it covers
// every channel type (UterRoute, Uter.api, Bailian and generic
// OpenAI-compatible channels) without each sync path having to remember it.
func applyOfficialCrossCheck(records []ChannelOfficialPricingRecord) {
	baseline := synchronizedOfficialBaseline()
	if len(baseline) == 0 {
		return
	}
	for i := range records {
		record := &records[i]
		if strings.TrimSpace(record.NormalizedPricing) == "" {
			continue
		}
		var view ChannelOfficialPricing
		if err := json.Unmarshal([]byte(record.NormalizedPricing), &view); err != nil {
			continue
		}
		reason, ok := crossCheckOfficialPrice(view, record.ModelName, baseline)
		if ok {
			continue
		}
		view.NeedsReview = true
		view.ReviewReasons = append(view.ReviewReasons, reason)
		encoded, err := json.Marshal(view)
		if err != nil {
			continue
		}
		record.NormalizedPricing = string(encoded)
		// A disagreement must never feed an automatic billing price.
		record.InternalPricing = ""
	}
}
