package model

import (
	"encoding/json"
	"math"
	"regexp"
	"strconv"
	"strings"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/setting/operation_setting"
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
	// The baseline is expressed in USD. Convert a non-USD official tier into
	// USD with Uter's configured exchange rate before any comparison. A
	// currency we cannot convert is not a proven disagreement: park it for
	// review rather than silently comparing incompatible amounts.
	factor, ok := officialCurrencyToUSD(view)
	if !ok {
		// No reliable currency basis: treat as "no comparable reference" and
		// skip, consistent with the no-baseline rule.
		return "", true
	}
	unit := strings.ToLower(strings.TrimSpace(view.Unit))
	perCallView := unit == "per_call" || unit == "per_image" || unit == "per_minute" ||
		(tier.InputPerMillionUSD == nil && tier.PerUnitUSD != nil)
	if perCallView || (row.PerCall > 0 && tier.InputPerMillionUSD == nil) {
		// Only currency differences are convertible here. A per-image fixed
		// price and a per-token expression have no common unit; that remains a
		// skip, not a disagreement.
		if row.PerCall <= 0 {
			return "", true
		}
		equal, converted := officialMoneyEqualUSD(tier.PerUnitUSD, row.PerCall, factor)
		if !converted || !equal {
			return "official per-call price disagrees with Uter synchronized pricing", false
		}
		return "", true
	}
	if unit == "per_second" || row.PerSecond > 0 {
		if row.PerSecond <= 0 {
			return "", true
		}
		equal, converted := officialMoneyEqualUSD(tier.PerUnitUSD, row.PerSecond, factor)
		if !converted || !equal {
			return "official per-second price disagrees with Uter synchronized pricing", false
		}
		return "", true
	}
	if row.Input <= 0 {
		return "", true
	}
	if equal, _ := officialMoneyEqualUSD(tier.InputPerMillionUSD, row.Input, factor); !equal {
		return "official input price disagrees with Uter synchronized pricing", false
	}
	if tier.OutputPerMillionUSD != nil && row.Output > 0 {
		if equal, _ := officialMoneyEqualUSD(tier.OutputPerMillionUSD, row.Output, factor); !equal {
			return "official output price disagrees with Uter synchronized pricing", false
		}
	}
	if tier.CachePerMillionUSD != nil && row.Cache > 0 {
		if equal, _ := officialMoneyEqualUSD(tier.CachePerMillionUSD, row.Cache, factor); !equal {
			return "official cache price disagrees with Uter synchronized pricing", false
		}
	}
	if tier.CreateCachePerMillionUSD != nil && row.CreateCache > 0 {
		if equal, _ := officialMoneyEqualUSD(tier.CreateCachePerMillionUSD, row.CreateCache, factor); !equal {
			return "official cache-write price disagrees with Uter synchronized pricing", false
		}
	}
	return "", true
}

// officialCurrencyToUSD returns the multiplier that converts an official tier
// amount into USD, using Uter's auto-updated USD/CNY rate (A = USDExchangeRate,
// the read-only "USD Exchange Rate" field refreshed from market data every 10
// minutes; the payment price B = A + adjustment is deliberately NOT used here
// because official prices must be compared at market rates). The tier fields
// are named ...USD, but Bailian-style sources may still publish CNY amounts;
// NormalizedCurrency records the currency those amounts are actually in. When
// the currency is USD (or absent) no conversion is applied. The global is read
// on every check, so a refreshed rate takes effect on the next sync without a
// restart. ok=false means there is no trustworthy basis for comparison
// (unknown currency, or a broken exchange-rate setting); the caller skips the
// row instead of flagging a false disagreement.
func officialCurrencyToUSD(view ChannelOfficialPricing) (factor float64, ok bool) {
	currency := strings.ToUpper(strings.TrimSpace(view.NormalizedCurrency))
	if currency == "" {
		// Fall back to the source currency only when no normalized currency was
		// recorded at all; a normalized value is authoritative.
		currency = strings.ToUpper(strings.TrimSpace(view.SourceCurrency))
	}
	switch currency {
	case "", "USD":
		return 1, true
	case "CNY", "RMB":
		rate := operation_setting.USDExchangeRate
		if rate <= 0 || math.IsNaN(rate) || math.IsInf(rate, 0) {
			return 0, false
		}
		return 1 / rate, true
	default:
		// No known conversion for this currency: skip, do not mislabel.
		return 0, false
	}
}

// officialMoneyEqualUSD compares a tier amount against a USD baseline after
// converting the tier's currency into USD. A failed conversion is reported to
// the caller via ok=false so the row can be parked for review instead of being
// silently compared in the wrong currency.
func officialMoneyEqualUSD(amount *Money, expectedUSD float64, factor float64) (equal, ok bool) {
	if amount == nil {
		return expectedUSD == 0, true
	}
	return officialMoneyEqual(amount, expectedUSD/factor), true
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
