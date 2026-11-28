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

// BaselineAliasWhitelistOptionKey maps normalized baseline keys to one exact
// model name, e.g. {"deepseek:v4:1:flash:fast": "DeepSeek-V4-1-Flash-Fast"}.
// It is deliberately outside modelPricingOptionKeys so editing the whitelist
// does not dirty the operator's synchronized-pricing snapshot.
const BaselineAliasWhitelistOptionKey = "SynchronizedPricingBaselineAliasWhitelist"

// BaselineAliasConflictsOptionKey is the exportable, JSON snapshot of every
// normalized-alias group that disagrees on price. Operators read this option
// (Root → System Settings → Options export) to decide whitelist entries.
const BaselineAliasConflictsOptionKey = "SynchronizedPricingBaselineAliasConflicts"

func loadBaselineAliasWhitelist() map[string]string {
	whitelist := make(map[string]string)
	raw := strings.TrimSpace(common.GetOption(BaselineAliasWhitelistOptionKey))
	if raw == "" {
		return whitelist
	}
	if err := common.UnmarshalJsonStr(raw, &whitelist); err != nil {
		common.SysError(common.LogText("invalid %s option: %v", BaselineAliasWhitelistOptionKey, err))
		return map[string]string{}
	}
	return whitelist
}

// publishBaselineAliasConflicts writes the auditable conflict list. A failed
// write never blocks the cross-check: the baseline itself is already resolved.
func publishBaselineAliasConflicts(conflicts []BaselineAliasConflict) {
	raw, err := common.Marshal(conflicts)
	if err != nil {
		return
	}
	// This function runs on every cross-check; avoid a write on each sync when
	// the operator's synchronized-pricing snapshot did not change.
	if strings.TrimSpace(common.GetOption(BaselineAliasConflictsOptionKey)) == string(raw) {
		return
	}
	_ = UpdateOption(BaselineAliasConflictsOptionKey, string(raw))
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
	baseline, conflicts, restorations := BuildBaselineWithAliasResolution(
		snapshot.Entries, loadBaselineAliasWhitelist(),
	)
	publishBaselineAliasConflicts(conflicts)
	if len(conflicts) > 0 {
		shown := conflicts
		if len(shown) > 10 {
			shown = shown[:10]
		}
		names := make([]string, 0, len(shown))
		for _, conflict := range shown {
			names = append(names, conflict.NormalizedName)
		}
		common.SysLog(common.LogText(
			"%d synchronized pricing baseline alias groups disagree (%d restored, %d skipped): %s",
			len(conflicts), countBaselineRestorations(restorations, "exact_id")+countBaselineRestorations(restorations, "whitelist"),
			countBaselineRestorations(restorations, "skipped"), strings.Join(names, ", "),
		))
	}
	return baseline
}

func countBaselineRestorations(restorations []BaselineAliasRestoration, resolution string) int {
	count := 0
	for _, item := range restorations {
		if item.Resolution == resolution {
			count++
		}
	}
	return count
}

// buildSynchronizedOfficialBaseline is the DB-free baseline builder. Names that
// normalize to the same key but carry different prices are dropped entirely:
// silently taking the first row made the cross-check depend on option ordering
// and could compare a channel price against an obsolete alias. Identical
// duplicates are harmless and keep the baseline entry.
func buildSynchronizedOfficialBaseline(entries []ModelPricingEntry) (map[string]synchronizedOfficialPrice, []string) {
	baseline := make(map[string]synchronizedOfficialPrice, len(entries))
	ambiguous := make(map[string]bool)
	conflicts := make([]string, 0)
	for _, entry := range entries {
		key := normalizeModelMatchName(entry.ModelName)
		if key == "" || ambiguous[key] {
			continue
		}
		price := officialFromSynchronizedEffective(entry.Effective)
		if price.Input <= 0 && price.PerCall <= 0 {
			continue
		}
		if existing, exists := baseline[key]; exists {
			if synchronizedOfficialPricesEqual(existing, price) {
				continue
			}
			delete(baseline, key)
			ambiguous[key] = true
			conflicts = append(conflicts, entry.ModelName)
			continue
		}
		baseline[key] = price
	}
	return baseline, conflicts
}

func synchronizedOfficialPricesEqual(a, b synchronizedOfficialPrice) bool {
	return synchronizedOfficialPriceEqual(a.Input, b.Input) &&
		synchronizedOfficialPriceEqual(a.Output, b.Output) &&
		synchronizedOfficialPriceEqual(a.Cache, b.Cache) &&
		synchronizedOfficialPriceEqual(a.CreateCache, b.CreateCache) &&
		synchronizedOfficialPriceEqual(a.PerCall, b.PerCall) &&
		synchronizedOfficialPriceEqual(a.PerSecond, b.PerSecond)
}

func synchronizedOfficialPriceEqual(a, b float64) bool {
	if a == b {
		return true
	}
	scale := math.Max(math.Abs(a), math.Abs(b))
	return scale > 0 && math.Abs(a-b) <= 1e-9*scale
}

// authoritativeOfficialList reports whether this row is an authoritative
// vendor list price rather than a derived/quote figure. Only the Bailian
// help-center importer emits PriceKind=OFFICIAL_LIST with an http(s) source and
// auditable RawComponents; UterRoute ratio/snapshot rows use other kinds. Such
// a row is the provider's published price at its own rate snapshot, while the
// synchronized billing expression is Uter's sale-price contract (which may
// carry an intentional markup). They are different measures and must not be
// compared for numeric equality — doing so marked every such model
// needs_review after any exchange-rate or markup change.
//
// This is deliberately narrow: derived/quote rows (empty PriceKind, RATIO_ONLY,
// BILLING_EXPRESSION, HISTORICAL_SNAPSHOT, OFFICIAL_ABSOLUTE without a URL)
// keep the strict cross-check and remain fail-closed.
func authoritativeOfficialList(view ChannelOfficialPricing) bool {
	if !strings.EqualFold(strings.TrimSpace(view.PriceKind), "OFFICIAL_LIST") {
		return false
	}
	source := strings.ToLower(strings.TrimSpace(view.Source))
	if !strings.HasPrefix(source, "https://") && !strings.HasPrefix(source, "http://") {
		return false
	}
	if len(view.Tiers) == 0 {
		return false
	}
	for _, component := range view.Tiers[0].RawComponents {
		if strings.TrimSpace(component.RawCurrency) != "" &&
			component.RawAmount.Float64() > 0 {
			return true
		}
	}
	return false
}

// IsAuthoritativeOfficialList exposes the narrow list-price classification to
// controlled data-remediation tools. It is not a general-purpose pricing
// shortcut: callers must still prove the row carries only the known erroneous
// cross-check reason before rebuilding an internal sale price.
func IsAuthoritativeOfficialList(view ChannelOfficialPricing) bool {
	return authoritativeOfficialList(view)
}

// differentMeasureUpstreamOfficialPrice identifies UterRoute rows whose
// "official" tier is not the same measure as the synchronized Uter sale price.
// The upstream publishes vendor list prices, executable expression
// coefficients, ratio-derived references or historical snapshots; the baseline
// is the operator's configured Uter sale price and may intentionally differ by
// markup or exchange-rate snapshot. Comparing those numbers for equality
// produced mass needs_review flags on channel 1262.
//
// The exemption is keyed on the importer's source prefix so generic channels,
// operator-entered rows and derived quotes keep the strict numeric check. The
// upstream's own gates ( executable expression, discount group, reference-price
// authorization ) still decide whether automatic billing is allowed.
func differentMeasureUpstreamOfficialPrice(view ChannelOfficialPricing) bool {
	source := strings.ToLower(strings.TrimSpace(view.Source))
	return strings.HasPrefix(source, "uterroute-")
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
	// An authoritative vendor list price (official URL + auditable raw amount)
	// or a UterRoute upstream reference is a different measure from Uter's
	// sale-price billing expression. Never mark it needs_review merely because
	// the two snapshots disagree numerically.
	if authoritativeOfficialList(view) || differentMeasureUpstreamOfficialPrice(view) {
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
