package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

// UterRouteUpstreamSnapshotKey stores UterRoute's official catalog and
// billing ratios in an isolated snapshot. It is deliberately separate from
// ModelRatio/ModelPrice/billing_expr: reading or refreshing this snapshot never
// changes what Uter charges on any channel.
const UterRouteUpstreamSnapshotKey = "UterRouteUpstreamSnapshot"

// UterRouteUpstreamHistoryKey stores a bounded change log derived from
// consecutive isolated snapshots. It never stores secrets or absolute prices
// the provider did not publish.
const UterRouteUpstreamHistoryKey = "UterRouteUpstreamPriceHistory"

const upstreamHistoryLimit = 1000

// uterRoutePlaceholderModelRatio marks models whose public model_ratio is a
// placeholder because their real price lives in billing_expr (tiered/media).
const uterRoutePlaceholderModelRatio = 37.5

// Ratio-derived and historical catalog prices are display-only by default.
// Billing from either source requires a separate, explicitly audited product
// authorization; this production-readiness audit does not grant it. The reason
// code is persisted in normalized_pricing.review_reasons so the admin audit can
// prove why the row was parked instead of silently auto-configured.
const uterRouteReferenceBillingNotAuthorizedReason = "REFERENCE_PRICE_BILLING_NOT_AUTHORIZED"

var uterRouteFixedPriceDiscount = regexp.MustCompile(`fixed\(\s*([0-9]+(?:\.[0-9]+)?)\s*\)`)

type UpstreamCapabilityStatus string

const (
	CapabilitySupported          UpstreamCapabilityStatus = "SUPPORTED"
	CapabilityPartial            UpstreamCapabilityStatus = "PARTIAL"
	CapabilityUnsupported        UpstreamCapabilityStatus = "UNSUPPORTED"
	CapabilityManualOnly         UpstreamCapabilityStatus = "MANUAL_ONLY"
	CapabilityNeedsConfiguration UpstreamCapabilityStatus = "NEEDS_CONFIGURATION"
)

type UpstreamProviderCapability struct {
	Status UpstreamCapabilityStatus `json:"status"`
	Detail string                   `json:"detail,omitempty"`
}

type UpstreamProviderCapabilities struct {
	ModelDiscovery      UpstreamProviderCapability `json:"model_discovery"`
	ModelMetadata       UpstreamProviderCapability `json:"model_metadata"`
	OfficialPricing     UpstreamProviderCapability `json:"official_pricing"`
	ChannelPricing      UpstreamProviderCapability `json:"channel_pricing"`
	DiscountInformation UpstreamProviderCapability `json:"discount_information"`
	RegionPricing       UpstreamProviderCapability `json:"region_pricing"`
	TieredPricing       UpstreamProviderCapability `json:"tiered_pricing"`
	MediaPricing        UpstreamProviderCapability `json:"media_pricing"`
	ScheduledSync       UpstreamProviderCapability `json:"scheduled_sync"`

	// Per-dimension pricing coverage. A provider may publish token prices but
	// no per-second media price, so these stay separate from MediaPricing.
	TokenPricing      UpstreamProviderCapability `json:"token_pricing"`
	ImagePricing      UpstreamProviderCapability `json:"image_pricing"`
	VideoPricing      UpstreamProviderCapability `json:"video_pricing"`
	AudioPricing      UpstreamProviderCapability `json:"audio_pricing"`
	PerCallPricing    UpstreamProviderCapability `json:"per_call_pricing"`
	PerSecondPricing  UpstreamProviderCapability `json:"per_second_pricing"`
	PerMinutePricing  UpstreamProviderCapability `json:"per_minute_pricing"`
	DeploymentPricing UpstreamProviderCapability `json:"deployment_pricing"`
}

// floatMoneyPtr converts an upstream float64 price into the exact Money
// pointer used by stored pricing. Nil stays nil (meaning "no published price").
func floatMoneyPtr(value *float64) *model.Money {
	if value == nil {
		return nil
	}
	m := model.MoneyFromFloat(*value)
	return &m
}

func capability(status UpstreamCapabilityStatus, detail string) UpstreamProviderCapability {
	return UpstreamProviderCapability{Status: status, Detail: detail}
}

type UpstreamProvider struct {
	ID           string                       `json:"id"`
	Name         string                       `json:"name"`
	PricingURL   string                       `json:"pricing_url"`
	ModelsURL    string                       `json:"models_url"`
	AuthType     string                       `json:"auth_type"`
	Capabilities UpstreamProviderCapabilities `json:"capabilities"`
	// SourceDocumentation names the endpoint the prices actually come from.
	// Empty means the provider has no authorized price source.
	SourceDocumentation string `json:"source_documentation,omitempty"`
	// SyncFrequency summarizes the scheduler cadence, not a promise per model.
	SyncFrequency string `json:"sync_frequency,omitempty"`
	// LastVerifiedAt is a Unix timestamp set only by a real verification run.
	LastVerifiedAt int64 `json:"last_verified_at,omitempty"`
}

// UterRouteUpstreamURLOption stores the operational endpoint for Uter Route.
// It lives in deployment configuration, so the white-labelled codebase never
// names the supplier.
const UterRouteUpstreamURLOption = "UterRouteUpstreamBaseURL"

// UterRouteReferencePriceBillingOption records the operator's authorization to
// bill from reference prices: upstream rows that publish only billing ratios
// (`DERIVED_FROM_RATIOS`) or only a historical snapshot (`HISTORICAL_SNAPSHOT`).
// The provider's pricing page publishes no absolute price for those rows, but
// `model_ratio * 2` is the gateway's own charging basis
// (`common.QuotaPerUnit = 500000`, i.e. $2/1M at ratio 1), so the reconstructed
// price equals what the gateway actually charges, not a guess.
//
// Authorized by default (2026-11-25 operator decision); setting the option to
// the exact value "false" restores the fail-closed review gate. The flag only
// affects reference rows — it never rewrites an operator-entered price, an
// expression price, or any other option, and `NO_UPSTREAM_DISCOUNT` and other
// hard gates remain in force.
const UterRouteReferencePriceBillingOption = "UterRouteReferencePriceBillingAuthorized"

// uterRouteReferencePriceBillingAuthorized reports whether billing from
// ratio-derived / historical reference prices is authorized. Enabled unless
// the operator explicitly sets the option to "false".
func uterRouteReferencePriceBillingAuthorized() bool {
	value := strings.ToLower(strings.TrimSpace(common.GetOption(UterRouteReferencePriceBillingOption)))
	return value != "false" && value != "0"
}

// UterRouteUpstreamBaseURL returns the configured endpoint or "" when the
// administrator has not configured it yet.
func UterRouteUpstreamBaseURL() string {
	value := strings.TrimSpace(common.GetOption(UterRouteUpstreamURLOption))
	if value == "" {
		return ""
	}
	if !strings.Contains(value, "://") {
		value = "https://" + value
	}
	return strings.TrimRight(value, "/")
}

// UterRouteUpstreamHost exposes only the host for provider detection.
func UterRouteUpstreamHost() string {
	base := UterRouteUpstreamBaseURL()
	if base == "" {
		return ""
	}
	parsed, err := url.Parse(base)
	if err != nil {
		return ""
	}
	return parsed.Hostname()
}

func uterRoutePricingPageURL() string {
	base := UterRouteUpstreamBaseURL()
	if base == "" {
		return ""
	}
	return base + "/api/pricing"
}

func uterRouteModelsPageURL() string {
	base := UterRouteUpstreamBaseURL()
	if base == "" {
		return ""
	}
	return base + "/v1/models"
}

const (
	// UpstreamPriceBasisRatioOnly means the provider publishes billing ratios
	// (model_ratio / completion_ratio / group_ratio), not an absolute official
	// or discounted list price. No USD price may be inferred from them.
	UpstreamPriceBasisRatioOnly = "UPSTREAM_RATIO_ONLY"
)

// uterRouteLegacyReference indexes the full sync snapshot (when present).
// That snapshot already reconstructs absolute USD prices from billing_expr and
// per-call records, so it is preferred over ratio-derived estimates.
func uterRouteLegacyReference() map[string]UterRouteModelRow {
	snapshot := LoadUterRouteSnapshot()
	if snapshot == nil || len(snapshot.Models) == 0 {
		return nil
	}
	reference := make(map[string]UterRouteModelRow, len(snapshot.Models)*2)
	for _, row := range snapshot.Models {
		if row.Official.Input <= 0 {
			continue
		}
		reference[row.UpstreamName] = row
		if row.LocalName != "" && row.LocalName != row.UpstreamName {
			reference[row.LocalName] = row
		}
	}
	return reference
}

// uterRouteExprPriceLine derives the list price from the provider's tiered
// billing expression. It reuses the same coefficient parser as the full sync:
// coefficients are USD per million tokens (or per second for duration terms),
// not quota-space numbers, so they are taken as-is.
func uterRouteExprPriceLine(expr string) (*UpstreamPriceLine, string) {
	expr = strings.TrimSpace(expr)
	if expr == "" {
		return nil, ""
	}
	if prices, ok := uterRouteDurationUnitPrices(expr); ok {
		value := prices.Input
		return &UpstreamPriceLine{
			Input: &value, Currency: "USD", Unit: "per_second", PerSecond: true,
		}, "DERIVED_FROM_EXPR"
	}
	prices, ok := uterRouteOfficialUnitPrices(expr)
	if !ok {
		return nil, ""
	}
	line := &UpstreamPriceLine{
		Input:    &prices.Input,
		Currency: "USD",
		Unit:     "per_1m_token",
	}
	if prices.Output > 0 {
		output := prices.Output
		line.Output = &output
	}
	if prices.Cache > 0 {
		cache := prices.Cache
		line.CacheRead = &cache
	}
	if prices.CreateCache > 0 {
		createCache := prices.CreateCache
		line.CacheWrite = &createCache
	}
	return line, "DERIVED_FROM_EXPR"
}

// uterRouteOfficialLine returns the absolute official price line for a model.
// It prefers the full sync snapshot and only falls back to the documented
// ratio space (model_ratio 1 = $2 / 1M tokens, model_price = USD / call).
func uterRouteOfficialLine(
	item UpstreamModelRecord,
	legacy map[string]UterRouteModelRow,
) (*UpstreamPriceLine, string) {
	// The complete billing expression is the richest live source: it carries
	// context tiers, media duration terms and cache rules that a single ratio
	// cannot represent. It must win before any flat price field.
	if line, status := uterRouteExprPriceLine(item.BillingExpr); line != nil {
		return line, status
	}
	// An explicitly published per-call price is an absolute live price.
	if item.ModelPrice != nil && *item.ModelPrice > 0 {
		value := *item.ModelPrice
		return &UpstreamPriceLine{Input: &value, Currency: "USD", Unit: "per_call", PerCall: true}, "OFFICIAL_API"
	}
	// A ratio is a live multiplier, not an absolute purchase price. Convert it
	// into a clearly-labelled reference so it never masquerades as official or
	// contract cost. This is preferred over a historical snapshot because it is
	// live: media-endpoint models are included too — the upstream's ratio space
	// is $2/1M at ratio 1 for every model, and their historical snapshots are
	// exactly model_ratio * 2. Skipping them used to leave video models with
	// no official price whenever the snapshot was unavailable.
	if item.ModelRatio != nil && *item.ModelRatio > 0 &&
		*item.ModelRatio != uterRoutePlaceholderModelRatio {
		input := *item.ModelRatio * 2
		line := &UpstreamPriceLine{Input: &input, Currency: "USD", Unit: "per_1m_token"}
		if item.CompletionRatio != nil && *item.CompletionRatio > 0 {
			output := input * *item.CompletionRatio
			line.Output = &output
		}
		if item.CacheRatio != nil && *item.CacheRatio > 0 {
			cache := input * *item.CacheRatio
			line.CacheRead = &cache
		}
		if item.CreateCacheRatio != nil && *item.CreateCacheRatio > 0 {
			createCache := input * *item.CreateCacheRatio
			line.CacheWrite = &createCache
		}
		return line, "DERIVED_FROM_RATIOS"
	}
	// A historical snapshot is used only when no live source exists, and it is
	// explicitly labelled so callers can require review or treat it as stale.
	if row, ok := legacy[item.ModelName]; ok && row.Official.Input > 0 {
		value := row.Official.Input
		switch {
		case row.PerSecond:
			return &UpstreamPriceLine{Input: &value, Currency: "USD", Unit: "per_second", PerSecond: true}, "HISTORICAL_SNAPSHOT"
		case row.QuotaType == 1 || row.BillingClass == "per_call":
			return &UpstreamPriceLine{Input: &value, Currency: "USD", Unit: "per_call", PerCall: true}, "HISTORICAL_SNAPSHOT"
		default:
			output := row.Official.Output
			cache := row.Official.Cache
			createCache := row.Official.CreateCache
			return &UpstreamPriceLine{
				Input: &value, Output: &output, CacheRead: &cache, CacheWrite: &createCache,
				Currency: "USD", Unit: "per_1m_token",
			}, "HISTORICAL_SNAPSHOT"
		}
	}
	if strings.TrimSpace(item.BillingExpr) != "" {
		return nil, "UNSUPPORTED_BILLING_EXPR"
	}
	return nil, "RATIO_ONLY_NO_ABSOLUTE_PRICE"
}

// UpstreamPriceLine is an absolute price line. Providers that only publish
// ratios leave this nil instead of guessing a currency or unit.
type UpstreamPriceLine struct {
	Input      *float64 `json:"input,omitempty"`
	Output     *float64 `json:"output,omitempty"`
	CacheRead  *float64 `json:"cache_read,omitempty"`
	CacheWrite *float64 `json:"cache_write,omitempty"`
	Currency   string   `json:"currency,omitempty"`
	Unit       string   `json:"unit,omitempty"`
	PerSecond  bool     `json:"per_second,omitempty"`
	PerImage   bool     `json:"per_image,omitempty"`
	PerCall    bool     `json:"per_call,omitempty"`
}

// LoadUterRouteUpstreamOfficialReference exposes the current isolated
// snapshot's list prices in the ratio-shaped map the plaza consumes. It is the
// authoritative reference for strike-through prices and discount badges.
func LoadUterRouteUpstreamOfficialReference() map[string]map[string]float64 {
	snapshot := LoadUterRouteUpstreamSnapshot()
	if snapshot == nil || len(snapshot.Models) == 0 {
		return nil
	}
	reference := make(map[string]map[string]float64, len(snapshot.Models))
	for _, item := range snapshot.Models {
		line := item.OfficialPrice
		if line == nil || line.Input == nil || *line.Input <= 0 {
			continue
		}
		name := strings.TrimSpace(item.ModelName)
		if name == "" {
			continue
		}
		if line.PerSecond {
			reference[name] = map[string]float64{officialPerSecondField: *line.Input}
			continue
		}
		if line.PerCall {
			reference[name] = map[string]float64{"model_price": *line.Input}
			continue
		}
		entry := map[string]float64{"model_ratio": *line.Input / 2}
		if line.Output != nil && *line.Output > 0 {
			entry["completion_ratio"] = *line.Output / *line.Input
		}
		if line.CacheRead != nil {
			entry["cache_ratio"] = *line.CacheRead / *line.Input
		}
		if line.CacheWrite != nil {
			entry["create_cache_ratio"] = *line.CacheWrite / *line.Input
		}
		reference[name] = entry
	}
	return reference
}

// UterRouteDiscountGroupDefault is the public billing group used when a
// channel has not selected its Uter Route account group.
const UterRouteDiscountGroupDefault = "default"

// UterRouteDiscountGroupOptionKey 保存每个渠道选定的上游计费组
// （{"<渠道 id>": "<组>"}），只影响该渠道。
// 字面值归 model 所有，便于渠道级联删除原子清理已删渠道的键；
// 此处以别名引用，保证单一定义来源。
const UterRouteDiscountGroupOptionKey = model.UterRouteDiscountGroupOptionKey

// UterRouteDiscountGroups lists the billing groups the provider publishes.
func UterRouteDiscountGroups(snapshot *UpstreamSnapshot) []string {
	if snapshot == nil {
		return nil
	}
	groups := make([]string, 0, len(snapshot.GroupGroupRatio))
	for group := range snapshot.GroupGroupRatio {
		groups = append(groups, group)
	}
	sort.Strings(groups)
	return groups
}

// GetUterRouteDiscountGroup returns the selected upstream billing group for
// one channel.
func GetUterRouteDiscountGroup(channelID int) string {
	if channelID <= 0 {
		return UterRouteDiscountGroupDefault
	}
	raw := strings.TrimSpace(common.GetOption(UterRouteDiscountGroupOptionKey))
	if raw == "" {
		return UterRouteDiscountGroupDefault
	}
	groups := map[string]string{}
	if err := common.UnmarshalJsonStr(raw, &groups); err != nil {
		return UterRouteDiscountGroupDefault
	}
	group := strings.TrimSpace(groups[fmt.Sprintf("%d", channelID)])
	if group == "" {
		return UterRouteDiscountGroupDefault
	}
	return group
}

// SetUterRouteDiscountGroup stores the upstream billing group for one
// channel.
func SetUterRouteDiscountGroup(channelID int, group string) error {
	if channelID <= 0 {
		return errors.New("channel id is required")
	}
	group = strings.TrimSpace(group)
	if group == "" {
		return errors.New("discount group is required")
	}
	groups := map[string]string{}
	raw := strings.TrimSpace(common.GetOption(UterRouteDiscountGroupOptionKey))
	if raw != "" {
		_ = common.UnmarshalJsonStr(raw, &groups)
	}
	groups[fmt.Sprintf("%d", channelID)] = group
	encoded, err := common.Marshal(groups)
	if err != nil {
		return err
	}
	return model.UpdateOption(UterRouteDiscountGroupOptionKey, string(encoded))
}

// UterRouteDiscountForModel resolves the upstream discount multiplier for a
// model under the selected billing group. The authoritative rule is the
// pricing card's automatic group chain: the first group in AutoGroups that the
// model enables, with that group's ratio from the group-group table (or the
// flat table as an explicit fallback). A chain hit with an unusable ratio
// fails closed instead of falling through to a lower-priority group.
//
// When the provider publishes no AutoGroups, legacy deterministic resolution
// still applies: equal ratios are unambiguous, differing ratios require
// review. This keeps older snapshots and isolated tests fail-closed.
func UterRouteDiscountForModel(
	snapshot *UpstreamSnapshot,
	item UpstreamModelRecord,
	group string,
) (float64, string, bool) {
	if snapshot == nil {
		return 0, "", false
	}
	group = strings.TrimSpace(group)
	if group == "" {
		group = UterRouteDiscountGroupDefault
	}
	if autoGroup, ratio, ok := resolveUterRouteAutoGroupChain(snapshot, item, group); ok {
		return ratio, autoGroup, true
	}
	// Collect every positive, finite ratio among the model's enable_groups
	// for this channel's group. Upstream serializes enable_groups in unstable
	// order, so ordering can never decide the billing identity.
	//
	// Business rule (production safety): the selected modelGroup must be the
	// one this channel actually settles under. If two enabled groups carry
	// DIFFERENT ratios there is no evidence in the catalog about which one is
	// the real settlement group — picking the lowest would silently misstate
	// both purchase cost and margin. Return false so the caller parks the row
	// in NEEDS_REVIEW instead of guessing. Equal ratios are unambiguous: every
	// candidate resolves to the same price.
	groupResolution := resolveUterRouteGroupRatio(item.EnableGroups, snapshot.GroupGroupRatio[group])
	if groupResolution.ok {
		return groupResolution.ratio, groupResolution.group, true
	}
	if groupResolution.ambiguous {
		// The authoritative group-group table contains candidates for this
		// model but cannot prove which one settles. A clean flat fallback is a
		// different table and must not be used to launder that ambiguity.
		return 0, "", false
	}
	if resolve := resolveUterRouteGroupRatio(item.EnableGroups, snapshot.GroupRatio); resolve.ok {
		return resolve.ratio, resolve.group, true
	}
	return 0, "", false
}

// resolveUterRouteAutoGroupChain implements the pricing card's "automatic
// group chain" contract. Uter settles under the default user group, and the
// card shows the first AutoGroups entry that the model enables. That entry's
// published ratio is the channel discount; no cheaper enabled group may be
// substituted. An enabled first hit with a missing/invalid ratio is a broken
// authoritative chain and must fail closed.
func resolveUterRouteAutoGroupChain(
	snapshot *UpstreamSnapshot,
	item UpstreamModelRecord,
	group string,
) (string, float64, bool) {
	if snapshot == nil || len(snapshot.AutoGroups) == 0 || len(item.EnableGroups) == 0 {
		return "", 0, false
	}
	enabled := make(map[string]bool, len(item.EnableGroups))
	for _, modelGroup := range item.EnableGroups {
		modelGroup = strings.TrimSpace(modelGroup)
		if modelGroup != "" {
			enabled[modelGroup] = true
		}
	}
	groupTable := snapshot.GroupGroupRatio[group]
	for _, autoGroup := range snapshot.AutoGroups {
		autoGroup = strings.TrimSpace(autoGroup)
		if autoGroup == "" || !enabled[autoGroup] {
			continue
		}
		if ratio, exists := groupTable[autoGroup]; exists {
			if !validUpstreamRatio(ratio) {
				return "", 0, false
			}
			return autoGroup, ratio, true
		}
		if ratio, exists := snapshot.GroupRatio[autoGroup]; exists {
			if !validUpstreamRatio(ratio) {
				return "", 0, false
			}
			return autoGroup, ratio, true
		}
		// The first chain hit exists but publishes no usable ratio. Do not
		// silently skip it for a later, cheaper group.
		return "", 0, false
	}
	return "", 0, false
}

type uterRouteGroupResolution struct {
	ratio     float64
	group     string
	ok        bool
	ambiguous bool
}

// resolveUterRouteGroupRatio resolves one ratio table deterministically.
// It returns ok=false when two enabled groups produce different ratios (the
// real settlement group cannot be proven) or when no valid ratio exists.
// When equal ratios make the price unambiguous, the group name is still
// chosen deterministically (lexicographic minimum) so the recorded billing
// identity is independent of the upstream's unstable array order.
func resolveUterRouteGroupRatio(enableGroups []string, table map[string]float64) uterRouteGroupResolution {
	var ratio float64
	groups := make([]string, 0, len(enableGroups))
	seen := make(map[string]bool, len(enableGroups))
	for _, modelGroup := range enableGroups {
		value, exists := table[modelGroup]
		if !exists || seen[modelGroup] {
			continue
		}
		seen[modelGroup] = true
		if !validUpstreamRatio(value) {
			// An enabled group present in the authoritative table with an
			// unusable ratio makes the settlement identity unprovable.
			return uterRouteGroupResolution{ambiguous: true}
		}
		if ratio == 0 {
			ratio = value
		} else if !ratiosEqual(value, ratio) {
			// Different settlement ratios cannot be resolved from the catalog.
			return uterRouteGroupResolution{ambiguous: true}
		}
		groups = append(groups, modelGroup)
	}
	if ratio == 0 || len(groups) == 0 {
		return uterRouteGroupResolution{}
	}
	sort.Strings(groups)
	return uterRouteGroupResolution{ratio: ratio, group: groups[0], ok: true}
}

// validUpstreamRatio rejects zero, negative, NaN and infinite group ratios so
// a malformed upstream document cannot enter the pricing path.
func validUpstreamRatio(ratio float64) bool {
	return ratio > 0 && !math.IsNaN(ratio) && !math.IsInf(ratio, 0)
}

func ratiosEqual(a, b float64) bool {
	return math.Abs(a-b) <= 1e-12*math.Max(1, math.Max(math.Abs(a), math.Abs(b)))
}

// scaleUpstreamPriceLine applies an upstream discount to an absolute price.
func scaleUpstreamPriceLine(line *UpstreamPriceLine, factor float64) *UpstreamPriceLine {
	if line == nil || factor <= 0 {
		return nil
	}
	scale := func(value *float64) *float64 {
		if value == nil {
			return nil
		}
		scaled := *value * factor
		return &scaled
	}
	return &UpstreamPriceLine{
		Input:      scale(line.Input),
		Output:     scale(line.Output),
		CacheRead:  scale(line.CacheRead),
		CacheWrite: scale(line.CacheWrite),
		Currency:   line.Currency,
		Unit:       line.Unit,
		PerSecond:  line.PerSecond,
		PerImage:   line.PerImage,
		PerCall:    line.PerCall,
	}
}

// uterRouteChannelInternalPricing turns a discounted absolute line into the
// channel's default sale price. Tiered or per-second prices cannot be expressed
// in the flat internal form and stay official-only for manual review.
func uterRouteChannelInternalPricing(
	line *UpstreamPriceLine,
	group string,
	modelGroup string,
	factor float64,
) (string, bool) {
	if line == nil || line.Input == nil || *line.Input <= 0 {
		return "", false
	}
	now := time.Now().Unix()
	pricing := model.ChannelInternalPricing{
		Source:             "uterroute-discount",
		DiscountGroup:      group,
		DiscountModelGroup: modelGroup,
		DiscountRatio:      factor,
		UpdatedAt:          now,
	}
	switch {
	case line.PerSecond:
		pricing.Mode = model.ChannelPricingModePerSecond
		pricing.PerSecondUSD = floatMoneyPtr(line.Input)
	case line.PerCall:
		pricing.Mode = model.ChannelPricingModePerCall
		pricing.PerCallUSD = floatMoneyPtr(line.Input)
	case line.PerImage:
		pricing.Mode = model.ChannelPricingModePerCall
		pricing.PerCallUSD = floatMoneyPtr(line.Input)
	default:
		pricing.Mode = model.ChannelPricingModePerMillionTokens
		pricing.InputUSDPerMillion = floatMoneyPtr(line.Input)
		pricing.OutputUSDPerMillion = floatMoneyPtr(line.Output)
		pricing.CacheUSDPerMillion = floatMoneyPtr(line.CacheRead)
		pricing.CreateCacheUSDPerMillion = floatMoneyPtr(line.CacheWrite)
	}
	if !applyDefaultSaleMarkup(&pricing) {
		return "", false
	}
	encoded, err := common.Marshal(pricing)
	if err != nil {
		return "", false
	}
	return string(encoded), true
}

func uterRouteRatioValue(value *float64) float64 {
	if value == nil {
		return 0
	}
	return *value
}

// uterRouteChannelExpressionPricing applies the channel discount to the
// complete upstream rule by wrapping it, so every tier and condition keeps its
// own coefficients. Flattening the expression to the first tier would charge
// long-context requests at the short-context price.
func uterRouteChannelExpressionPricing(
	expr string,
	group string,
	modelGroup string,
	factor float64,
) (string, bool) {
	raw := strings.TrimSpace(expr)
	if raw == "" || factor <= 0 {
		return "", false
	}
	// Scale every price coefficient in place so all tiers/branches receive the
	// discount. A string-level "(expr) * factor" wrap leaves fixed() branches
	// unscaled and is rejected by the billing engine for fixed expressions.
	scaled, ok := scaleBillingExprByFactor(raw, factor)
	if !ok {
		return "", false
	}
	pricing := model.ChannelInternalPricing{
		Mode:               model.ChannelPricingModeTieredExpr,
		BillingExpr:        scaled,
		Source:             "uterroute-discount",
		DiscountGroup:      group,
		DiscountModelGroup: modelGroup,
		DiscountRatio:      factor,
		UpdatedAt:          time.Now().Unix(),
	}
	if !applyDefaultSaleMarkup(&pricing) {
		return "", false
	}
	encoded, err := common.Marshal(pricing)
	if err != nil {
		return "", false
	}
	return string(encoded), true
}

// UpstreamModelRecord is one normalized model in the isolated catalog.
type UpstreamModelRecord struct {
	ProviderID         string   `json:"provider_id"`
	UpstreamModelID    string   `json:"upstream_model_id"`
	ModelName          string   `json:"model_name"`
	VendorID           int      `json:"vendor_id,omitempty"`
	VendorName         string   `json:"vendor_name,omitempty"`
	QuotaType          int      `json:"quota_type"`
	EnableGroups       []string `json:"enable_groups,omitempty"`
	SupportedEndpoints []string `json:"supported_endpoints,omitempty"`

	// Raw upstream billing inputs. These are ratios, not USD prices.
	ModelRatio       *float64 `json:"model_ratio,omitempty"`
	ModelPrice       *float64 `json:"model_price,omitempty"`
	BillingMode      string   `json:"billing_mode,omitempty"`
	BillingExpr      string   `json:"billing_expr,omitempty"`
	CompletionRatio  *float64 `json:"completion_ratio,omitempty"`
	CacheRatio       *float64 `json:"cache_ratio,omitempty"`
	CreateCacheRatio *float64 `json:"create_cache_ratio,omitempty"`
	// Auxiliary modality/cache dimensions published by the upstream pricing
	// page. Kept verbatim so the catalog is complete and auditable even when
	// the primary billing expression already prices those dimensions.
	// CacheStoragePriceUSD is an absolute USD amount (not a ratio).
	CacheStoragePriceUSD *float64 `json:"cache_storage_price_usd,omitempty"`
	ImageRatio           *float64 `json:"image_ratio,omitempty"`
	AudioRatio           *float64 `json:"audio_ratio,omitempty"`
	Icon                 string   `json:"icon,omitempty"`

	PriceBasis      string             `json:"price_basis"`
	OfficialPrice   *UpstreamPriceLine `json:"official_price"`
	DiscountedPrice *UpstreamPriceLine `json:"discounted_price"`
	Source          string             `json:"source"`
	SourceEndpoint  string             `json:"source_endpoint"`
	PricingVersion  string             `json:"pricing_version,omitempty"`
	PriceStatus     string             `json:"price_status"`
	VerifiedAt      time.Time          `json:"verified_at"`
}

// UpstreamSnapshot is the isolated, versioned view of one provider.
type UpstreamSnapshot struct {
	ProviderID      string                        `json:"provider_id"`
	FetchedAt       time.Time                     `json:"fetched_at"`
	PricingVersion  string                        `json:"pricing_version,omitempty"`
	SourceEndpoint  string                        `json:"source_endpoint"`
	PriceBasis      string                        `json:"price_basis"`
	GroupRatio      map[string]float64            `json:"group_ratio,omitempty"`
	GroupGroupRatio map[string]map[string]float64 `json:"group_group_ratio,omitempty"`
	AutoGroups      []string                      `json:"auto_groups,omitempty"`
	UsableGroups    map[string]string             `json:"usable_group,omitempty"`
	Models          []UpstreamModelRecord         `json:"models"`
	// ExcludedModels lists upstream entries hidden from its own pricing page
	// (no vendor). They are pruned from channels so both counts agree.
	ExcludedModels []string `json:"excluded_models,omitempty"`
}

type uterRoutePublicModel struct {
	ModelName string `json:"model_name"`
	// VendorID is a pointer on purpose: the upstream omits the key entirely
	// for models whose vendor is not in its vendors catalogue (e.g. MiniMax).
	// A missing key means "vendor unlabelled" — a fully priced, servable model
	// — and must NOT be confused with an explicit vendor_id: 0, which the
	// upstream uses to mark models hidden from its own pricing page.
	VendorID               *int     `json:"vendor_id"`
	QuotaType              int      `json:"quota_type"`
	ModelRatio             *float64 `json:"model_ratio"`
	ModelPrice             *float64 `json:"model_price"`
	BillingMode            string   `json:"billing_mode"`
	BillingExpr            string   `json:"billing_expr"`
	CompletionRatio        *float64 `json:"completion_ratio"`
	CacheRatio             *float64 `json:"cache_ratio"`
	CreateCacheRatio       *float64 `json:"create_cache_ratio"`
	CacheStoragePrice      *float64 `json:"cache_storage_price"`
	ImageRatio             *float64 `json:"image_ratio"`
	AudioRatio             *float64 `json:"audio_ratio"`
	Icon                   string   `json:"icon"`
	EnableGroups           []string `json:"enable_groups"`
	SupportedEndpointTypes []string `json:"supported_endpoint_types"`
	PricingVersion         string   `json:"pricing_version"`
}

type uterRoutePublicPricing struct {
	Success        bool                   `json:"success"`
	PricingVersion string                 `json:"pricing_version"`
	Data           []uterRoutePublicModel `json:"data"`
	Vendors        []struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"vendors"`
	GroupRatio      map[string]float64            `json:"group_ratio"`
	GroupGroupRatio map[string]map[string]float64 `json:"group_group_ratio"`
	AutoGroups      []string                      `json:"auto_groups"`
	UsableGroup     map[string]string             `json:"usable_group"`
}

// pruneHiddenUterRouteModels drops models the upstream hides from its pricing
// page (no vendor) from one channel and removes their pricing rows, so Uter's
// count matches the upstream page instead of the raw API payload.
func PruneHiddenUterRouteModels(channel *model.Channel, hidden []string) {
	pruneHiddenUterRouteModels(channel, hidden)
}

func pruneHiddenUterRouteModels(channel *model.Channel, hidden []string) {
	if channel == nil || len(hidden) == 0 {
		return
	}
	hiddenSet := make(map[string]struct{}, len(hidden))
	for _, name := range hidden {
		hiddenSet[name] = struct{}{}
	}
	current := channel.GetModels()
	kept := make([]string, 0, len(current))
	for _, name := range current {
		if _, drop := hiddenSet[name]; !drop {
			kept = append(kept, name)
		}
	}
	if len(kept) != len(current) {
		channel.Models = strings.Join(kept, ",")
		if err := channel.Update(); err != nil {
			common.SysError(common.LogText("prune hidden uterroute models failed: channel_id=%d, error=%v", channel.Id, err))
		} else if err := channel.UpdateAbilities(nil); err != nil {
			common.SysError(common.LogText("update abilities after pruning hidden models failed: channel_id=%d, error=%v", channel.Id, err))
		} else {
			model.BumpSyncTopic(model.SyncTopicChannels)
		}
	}
	if err := model.DeleteChannelModelPricingForModels(channel.Id, hidden); err != nil {
		common.SysError(common.LogText("delete hidden uterroute pricing failed: channel_id=%d, error=%v", channel.Id, err))
	}
}

// FetchUterRouteUpstream fetches the public pricing document and normalizes
// it without writing any Uter model price. baseURL is injectable for tests;
// production callers pass the empty string.
func FetchUterRouteUpstream(ctx context.Context, baseURL string) (*UpstreamSnapshot, error) {
	baseURL = uterRoutePricingOrigin(baseURL)
	endpoint := baseURL + "/api/pricing"
	if _, err := validateUpstreamEndpoint(endpoint); err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")

	client := newUpstreamHTTPClient(30 * time.Second)
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch uterroute pricing: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("uterroute pricing returned HTTP %d: %s", resp.StatusCode, truncateBailianBody(body))
	}

	var payload uterRoutePublicPricing
	if err := common.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("decode uterroute pricing: %w", err)
	}
	if !payload.Success {
		return nil, errors.New("uterroute pricing returned success=false")
	}
	if len(payload.Data) == 0 {
		return nil, errors.New("uterroute pricing returned no models")
	}

	vendorNames := make(map[int]string, len(payload.Vendors))
	for _, vendor := range payload.Vendors {
		vendorNames[vendor.ID] = vendor.Name
	}

	now := time.Now().UTC()
	legacy := uterRouteLegacyReference()
	snapshot := &UpstreamSnapshot{
		ProviderID:      "uterroute",
		FetchedAt:       now,
		PricingVersion:  payload.PricingVersion,
		SourceEndpoint:  endpoint,
		PriceBasis:      UpstreamPriceBasisRatioOnly,
		GroupRatio:      payload.GroupRatio,
		GroupGroupRatio: payload.GroupGroupRatio,
		AutoGroups:      payload.AutoGroups,
		UsableGroups:    payload.UsableGroup,
		Models:          make([]UpstreamModelRecord, 0, len(payload.Data)),
	}
	for _, item := range payload.Data {
		name := strings.TrimSpace(item.ModelName)
		if name == "" {
			continue
		}
		// Only an EXPLICIT vendor_id <= 0 marks a model hidden from the
		// upstream pricing page. A missing key (nil) means the vendor is simply
		// not in the upstream's vendors catalogue — those models still carry
		// complete pricing and must be kept. Treating nil as hidden used to
		// drop MiniMax models and delete their channel rows on sync.
		if item.VendorID != nil && *item.VendorID <= 0 {
			snapshot.ExcludedModels = append(snapshot.ExcludedModels, name)
			continue
		}
		vendorID := 0
		if item.VendorID != nil {
			vendorID = *item.VendorID
		}
		record := UpstreamModelRecord{
			ProviderID:           snapshot.ProviderID,
			UpstreamModelID:      name,
			ModelName:            name,
			VendorID:             vendorID,
			VendorName:           vendorNames[vendorID],
			QuotaType:            item.QuotaType,
			EnableGroups:         item.EnableGroups,
			SupportedEndpoints:   item.SupportedEndpointTypes,
			ModelRatio:           item.ModelRatio,
			ModelPrice:           item.ModelPrice,
			BillingMode:          item.BillingMode,
			BillingExpr:          item.BillingExpr,
			CompletionRatio:      item.CompletionRatio,
			CacheRatio:           item.CacheRatio,
			CreateCacheRatio:     item.CreateCacheRatio,
			CacheStoragePriceUSD: item.CacheStoragePrice,
			ImageRatio:           item.ImageRatio,
			AudioRatio:           item.AudioRatio,
			Icon:                 item.Icon,
			PriceBasis:           UpstreamPriceBasisRatioOnly,
			Source:               "official_api",
			SourceEndpoint:       endpoint,
			PricingVersion:       item.PricingVersion,
			VerifiedAt:           now,
		}
		record.OfficialPrice, record.PriceStatus = uterRouteOfficialLine(record, legacy)
		snapshot.Models = append(snapshot.Models, record)
	}
	if len(snapshot.Models) == 0 {
		return nil, errors.New("uterroute pricing contained no usable model names")
	}
	sort.Slice(snapshot.Models, func(i, j int) bool {
		return snapshot.Models[i].UpstreamModelID < snapshot.Models[j].UpstreamModelID
	})
	return snapshot, nil
}

// uterRoutePricingOrigin strips the OpenAI-compatible path operators often
// paste into Base URL (for example a pasted /v1 address) so the public
// pricing endpoint is always requested at the site root.
func uterRoutePricingOrigin(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return UterRouteUpstreamBaseURL()
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return strings.TrimRight(raw, "/")
	}
	return parsed.Scheme + "://" + parsed.Host
}

// SaveUterRouteUpstreamSnapshot persists the isolated snapshot.
func SaveUterRouteUpstreamSnapshot(snapshot *UpstreamSnapshot) error {
	if snapshot == nil {
		return errors.New("uterroute upstream snapshot is nil")
	}
	raw, err := common.Marshal(snapshot)
	if err != nil {
		return err
	}
	return model.UpdateOption(UterRouteUpstreamSnapshotKey, string(raw))
}

// LoadUterRouteUpstreamSnapshot returns the last isolated snapshot.
func LoadUterRouteUpstreamSnapshot() *UpstreamSnapshot {
	raw := strings.TrimSpace(common.GetOption(UterRouteUpstreamSnapshotKey))
	if raw == "" {
		return nil
	}
	var snapshot UpstreamSnapshot
	if err := common.Unmarshal([]byte(raw), &snapshot); err != nil {
		return nil
	}
	return &snapshot
}

// UpstreamPriceChange records one detected change between two snapshots.
// Kind is price_changed, model_added, or model_removed.
type UpstreamPriceChange struct {
	ProviderID string `json:"provider_id"`
	ModelID    string `json:"model_id"`
	// Region/DeploymentId identify the exact pricing row when a model is
	// published under several identities.
	Region         string    `json:"region,omitempty"`
	DeploymentId   string    `json:"deployment_id,omitempty"`
	Kind           string    `json:"kind"`
	Field          string    `json:"field,omitempty"`
	Old            *float64  `json:"old,omitempty"`
	New            *float64  `json:"new,omitempty"`
	OldText        string    `json:"old_text,omitempty"`
	NewText        string    `json:"new_text,omitempty"`
	DetectedAt     time.Time `json:"detected_at"`
	PricingVersion string    `json:"pricing_version,omitempty"`
}

// UpstreamPriceHistory is the persisted, bounded change log.
type UpstreamPriceHistory struct {
	ProviderID string                `json:"provider_id"`
	Entries    []UpstreamPriceChange `json:"entries"`
}

// DiffUterRouteUpstream compares two isolated snapshots. Only raw upstream
// ratio fields are compared; an absolute price is never derived or stored.
func DiffUterRouteUpstream(prev, next *UpstreamSnapshot) []UpstreamPriceChange {
	if next == nil {
		return nil
	}
	now := time.Now().UTC()
	changes := make([]UpstreamPriceChange, 0)
	prevByName := make(map[string]UpstreamModelRecord)
	if prev != nil {
		for _, item := range prev.Models {
			prevByName[item.ModelName] = item
		}
	}
	nextNames := make(map[string]struct{}, len(next.Models))
	for _, item := range next.Models {
		nextNames[item.ModelName] = struct{}{}
		before, existed := prevByName[item.ModelName]
		if !existed {
			changes = append(changes, UpstreamPriceChange{
				ProviderID: next.ProviderID, ModelID: item.ModelName,
				Kind: "model_added", DetectedAt: now, PricingVersion: next.PricingVersion,
			})
			continue
		}
		if strings.TrimSpace(before.BillingExpr) != strings.TrimSpace(item.BillingExpr) ||
			strings.TrimSpace(before.BillingMode) != strings.TrimSpace(item.BillingMode) {
			changes = append(changes, UpstreamPriceChange{
				ProviderID: next.ProviderID, ModelID: item.ModelName,
				Kind: "rule_changed", Field: "billing_expr",
				OldText: before.BillingExpr, NewText: item.BillingExpr,
				DetectedAt: now, PricingVersion: next.PricingVersion,
			})
		}
		for _, field := range []struct {
			name string
			old  *float64
			new  *float64
		}{
			{"model_ratio", before.ModelRatio, item.ModelRatio},
			{"model_price", before.ModelPrice, item.ModelPrice},
			{"completion_ratio", before.CompletionRatio, item.CompletionRatio},
			{"cache_ratio", before.CacheRatio, item.CacheRatio},
			{"create_cache_ratio", before.CreateCacheRatio, item.CreateCacheRatio},
		} {
			if upstreamRatioEqual(field.old, field.new) {
				continue
			}
			changes = append(changes, UpstreamPriceChange{
				ProviderID: next.ProviderID, ModelID: item.ModelName,
				Kind: "price_changed", Field: field.name,
				Old: field.old, New: field.new,
				DetectedAt: now, PricingVersion: next.PricingVersion,
			})
		}
	}
	for _, item := range prevByName {
		if _, exists := nextNames[item.ModelName]; exists {
			continue
		}
		changes = append(changes, UpstreamPriceChange{
			ProviderID: next.ProviderID, ModelID: item.ModelName,
			Kind: "model_removed", DetectedAt: now, PricingVersion: next.PricingVersion,
		})
	}
	sort.Slice(changes, func(i, j int) bool {
		if changes[i].ModelID != changes[j].ModelID {
			return changes[i].ModelID < changes[j].ModelID
		}
		if changes[i].Kind != changes[j].Kind {
			return changes[i].Kind < changes[j].Kind
		}
		return changes[i].Field < changes[j].Field
	})
	return changes
}

func upstreamRatioEqual(a, b *float64) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return math.Abs(*a-*b) < 1e-12
}

// AppendUterRouteUpstreamHistory merges new changes into the bounded log.
func AppendUterRouteUpstreamHistory(providerID string, changes []UpstreamPriceChange) error {
	history := LoadUterRouteUpstreamHistory()
	if history == nil {
		history = &UpstreamPriceHistory{ProviderID: providerID}
	}
	history.Entries = append(history.Entries, changes...)
	if len(history.Entries) > upstreamHistoryLimit {
		history.Entries = history.Entries[len(history.Entries)-upstreamHistoryLimit:]
	}
	raw, err := common.Marshal(history)
	if err != nil {
		return err
	}
	return model.UpdateOption(UterRouteUpstreamHistoryKey, string(raw))
}

// LoadUterRouteUpstreamHistory returns the persisted change log.
func LoadUterRouteUpstreamHistory() *UpstreamPriceHistory {
	raw := strings.TrimSpace(common.GetOption(UterRouteUpstreamHistoryKey))
	if raw == "" {
		return nil
	}
	var history UpstreamPriceHistory
	if err := common.Unmarshal([]byte(raw), &history); err != nil {
		return nil
	}
	return &history
}

// UterRouteNormalizedPricing is stored in the per-channel pricing row.
// It intentionally has no absolute price: the provider publishes ratios only.
type UterRouteNormalizedPricing struct {
	PriceBasis         string                        `json:"price_basis"`
	Currency           string                        `json:"currency"`
	Unit               string                        `json:"unit"`
	QuotaType          int                           `json:"quota_type"`
	ModelRatio         *float64                      `json:"model_ratio,omitempty"`
	ModelPrice         *float64                      `json:"model_price,omitempty"`
	CompletionRatio    *float64                      `json:"completion_ratio,omitempty"`
	CacheRatio         *float64                      `json:"cache_ratio,omitempty"`
	CreateCacheRatio   *float64                      `json:"create_cache_ratio,omitempty"`
	EnableGroups       []string                      `json:"enable_groups,omitempty"`
	GroupRatio         map[string]float64            `json:"group_ratio,omitempty"`
	GroupGroupRatio    map[string]map[string]float64 `json:"group_group_ratio,omitempty"`
	OfficialPrice      *UpstreamPriceLine            `json:"official_price"`
	DiscountedPrice    *UpstreamPriceLine            `json:"discounted_price"`
	ChannelPrice       *UpstreamPriceLine            `json:"channel_price"`
	DiscountGroup      string                        `json:"discount_group,omitempty"`
	DiscountModelGroup string                        `json:"discount_model_group,omitempty"`
	DiscountRatio      *float64                      `json:"discount_ratio,omitempty"`
	PriceStatus        string                        `json:"price_status"`
	NeedsReview        bool                          `json:"needs_review"`
	ReviewReasons      []string                      `json:"review_reasons,omitempty"`
}

// UterRouteChannelPricingRecords builds channel-scoped official records.
// Only models the channel actually serves are written, and the provider's
// ratios are preserved as ratios rather than converted into a fake USD price.
func UterRouteChannelPricingRecords(
	snapshot *UpstreamSnapshot,
	channelID int,
	channelModels []string,
	billingGroup string,
) ([]model.ChannelOfficialPricingRecord, error) {
	return UterRouteChannelPricingRecordsWithMapping(
		snapshot, channelID, channelModels, billingGroup, "",
	)
}

// UterRouteChannelPricingRecordsWithMapping is the mapping-aware form. After a
// (batch) redirect the channel's model list holds request names while the
// upstream catalogue holds raw model names. Matching the two directly drops
// every redirected model from the pricing table, so the billing readiness panel
// reports them as "(missing)" even though the upstream publishes a price.
//
// Resolve each requested name through model_mapping first, look the catalogue
// up by the resolved upstream name, and key the stored row by the request name
// the channel actually serves — that is the name callers bill against.
func UterRouteChannelPricingRecordsWithMapping(
	snapshot *UpstreamSnapshot,
	channelID int,
	channelModels []string,
	billingGroup string,
	modelMapping string,
) ([]model.ChannelOfficialPricingRecord, error) {
	if snapshot == nil || channelID <= 0 {
		return nil, errors.New("uterroute snapshot and channel id are required")
	}

	var mapping map[string]string
	if strings.TrimSpace(modelMapping) != "" {
		if err := common.UnmarshalJsonStr(modelMapping, &mapping); err != nil {
			// A malformed mapping must not suppress prices for the rest of the
			// channel; fall back to direct name matching, as the relay does.
			mapping = nil
		}
	}

	// raw upstream name -> request names this channel exposes for it.
	requestNamesByUpstream := make(map[string][]string, len(channelModels))
	seenRequest := make(map[string]bool, len(channelModels))
	for _, name := range channelModels {
		name = strings.TrimSpace(name)
		if name == "" || seenRequest[name] {
			continue
		}
		seenRequest[name] = true
		upstream, cyclic := followUterRouteModelMapping(mapping, name)
		if cyclic || upstream == "" {
			upstream = name
		}
		requestNamesByUpstream[upstream] = append(requestNamesByUpstream[upstream], name)
	}

	records := make([]model.ChannelOfficialPricingRecord, 0, len(snapshot.Models))
	for _, item := range snapshot.Models {
		servedNames := requestNamesByUpstream[item.ModelName]
		if len(channelModels) > 0 && len(servedNames) == 0 {
			continue
		}
		if len(servedNames) == 0 {
			servedNames = []string{item.ModelName}
		}
		for _, servedName := range servedNames {
			officialView, internalPricing := uterRouteChannelOfficialPricing(
				snapshot, item, snapshot.FetchedAt.Unix(), billingGroup,
			)
			if officialView.NeedsReview {
				internalPricing = ""
			}
			officialRaw, err := common.Marshal(item)
			if err != nil {
				return nil, err
			}
			normalizedRaw, err := common.Marshal(officialView)
			if err != nil {
				return nil, err
			}
			records = append(records, model.ChannelOfficialPricingRecord{
				ChannelId:         channelID,
				Provider:          "uterroute",
				ModelName:         servedName,
				Currency:          "USD",
				OfficialPricing:   string(officialRaw),
				NormalizedPricing: string(normalizedRaw),
				InternalPricing:   internalPricing,
				Source:            "uterroute-official",
				FetchedAt:         snapshot.FetchedAt.Unix(),
			})
		}
	}
	return records, nil
}

// followUterRouteModelMapping mirrors the relay's model_mapping walk: visited
// set cycle detection, self-map stops at the current hop, a non-self cycle is
// reported so the caller can fall back to the request name.
func followUterRouteModelMapping(mapping map[string]string, start string) (string, bool) {
	current := start
	visited := map[string]bool{current: true}
	for {
		mapped, exists := mapping[current]
		if !exists || mapped == "" {
			return current, false
		}
		if visited[mapped] {
			if mapped == current {
				return current, false
			}
			return "", true
		}
		visited[mapped] = true
		current = mapped
	}
}

// uterRoutePricingTier converts one absolute price line into the stored tier
// shape shared by official and channel prices.
func uterRoutePricingTier(line *UpstreamPriceLine) model.ChannelPricingTier {
	tier := model.ChannelPricingTier{RangeName: "base", Unit: line.Unit}
	switch line.Unit {
	case "per_second":
		tier.PerUnitUSD = floatMoneyPtr(line.Input)
		tier.Unit = "per_second"
	case "per_call":
		tier.PerUnitUSD = floatMoneyPtr(line.Input)
		tier.Unit = "per_call"
	default:
		tier.InputPerMillionUSD = floatMoneyPtr(line.Input)
		tier.OutputPerMillionUSD = floatMoneyPtr(line.Output)
		tier.CachePerMillionUSD = floatMoneyPtr(line.CacheRead)
		tier.CreateCachePerMillionUSD = floatMoneyPtr(line.CacheWrite)
		tier.Unit = "per_1m_token"
	}
	return tier
}

// uterRouteOfficialTierFromUnits builds the undiscounted official reference
// tier from unit prices resolved out of an upstream expression. This is the
// single construction point shared by the normal path and the review-only
// fallback, so the two can never drift into different official prices again.
// Per-second models keep the dedicated per_second field (raw USD/second) and
// never write a token ratio.
func uterRouteOfficialTierFromUnits(units uterRouteUnitPrices, perSecond bool) model.ChannelPricingTier {
	if perSecond {
		return model.ChannelPricingTier{
			RangeName: "base", Unit: "per_second", PerUnitUSD: floatMoneyPtr(&units.Input),
		}
	}
	tier := model.ChannelPricingTier{RangeName: "base", Unit: "per_1m_token"}
	tier.InputPerMillionUSD = floatMoneyPtr(&units.Input)
	if units.OutputPresent {
		tier.OutputPerMillionUSD = floatMoneyPtr(&units.Output)
	}
	if units.CachePresent {
		tier.CachePerMillionUSD = floatMoneyPtr(&units.Cache)
	}
	if units.CreateCachePresent {
		tier.CreateCachePerMillionUSD = floatMoneyPtr(&units.CreateCache)
	}
	return tier
}

// ensureUterRouteOfficialTiers restores the official reference tier on any
// review-only early-return path. The official price is the upstream-published
// absolute catalogue price: it is independent of whether this channel's
// discount group can be resolved, and independent of whether automatic billing
// is authorised. Parking a row in NEEDS_REVIEW must stop automatic charging,
// NOT hide the official price from operators — otherwise the channel wizard's
// "Official price" column wrongly reads "Not available" even though the
// snapshot carries a complete official price. This defer covers every return
// path, including branches added in the future.
func ensureUterRouteOfficialTiers(view *model.ChannelOfficialPricing, item UpstreamModelRecord) {
	if len(view.Tiers) > 0 {
		return
	}
	if raw := strings.TrimSpace(item.BillingExpr); raw != "" && item.PriceStatus != "HISTORICAL_SNAPSHOT" {
		normalized := NormalizeUpstreamExpression(raw)
		if units, ok := uterRouteOfficialUnitPrices(normalized.Raw); ok {
			view.Tiers = []model.ChannelPricingTier{uterRouteOfficialTierFromUnits(units, false)}
			view.Unit = "per_1m_token"
			return
		}
		if units, ok := uterRouteDurationUnitPrices(normalized.Raw); ok {
			view.Tiers = []model.ChannelPricingTier{uterRouteOfficialTierFromUnits(units, true)}
			view.Unit = "per_second"
			return
		}
	}
	if line := item.OfficialPrice; line != nil && line.Input != nil {
		view.Tiers = []model.ChannelPricingTier{uterRoutePricingTier(line)}
		view.Unit = line.Unit
	}
}

// uterRouteChannelOfficialPricing converts the upstream price line into the
// channel pricing table's normalized view. Derived prices stay reviewable so an
// operator can audit the ratio-to-price conversion before billing.
func uterRouteChannelOfficialPricing(
	snapshot *UpstreamSnapshot,
	item UpstreamModelRecord,
	fetchedAt int64,
	billingGroup string,
) (view model.ChannelOfficialPricing, result string) {
	view = model.ChannelOfficialPricing{
		Currency:  "USD",
		Unit:      "unknown",
		Source:    uterRoutePriceSource(item.PriceStatus),
		FetchedAt: fetchedAt,
	}
	// Never let a review-only return hide a published official price.
	defer ensureUterRouteOfficialTiers(&view, item)
	switch item.PriceStatus {
	case "BILLING_EXPR", "DERIVED_FROM_EXPR":
		view.PriceKind = "BILLING_EXPRESSION"
	case "DERIVED_FROM_RATIOS":
		view.PriceKind = "RATIO_ONLY"
		if item.ModelRatio != nil && *item.ModelRatio > 0 {
			view.RatioBasis = &model.ChannelRatioBasis{
				RawRatio:           *item.ModelRatio,
				RawCompletionRatio: uterRouteRatioValue(item.CompletionRatio),
				BasisUSDPerMillion: model.MoneyFromFloat(2),
				Formula:            "reference_only: usd_per_1m = model_ratio * 2",
				FormulaVersion:     "uterroute-ratio-v1",
			}
		}
	case "HISTORICAL_SNAPSHOT":
		view.PriceKind = "HISTORICAL_SNAPSHOT"
	default:
		view.PriceKind = "OFFICIAL_ABSOLUTE"
	}
	line := item.OfficialPrice
	expressionRule := strings.TrimSpace(item.BillingExpr) != "" &&
		item.PriceStatus != "HISTORICAL_SNAPSHOT"
	if expressionRule {
		// The complete executable rule is the price contract even when the
		// provider publishes no flattened absolute line for it.
		normalized := NormalizeUpstreamExpression(item.BillingExpr)
		view.Unit = "expression"
		view.BillingMode = "tiered_expr"
		view.BillingExpr = normalized.Raw
		view.ExpressionHash = normalized.Hash
		view.ExpressionStatus = normalized.Status
		view.ExpressionError = normalized.Error
		if !normalized.Executable {
			view.NeedsReview = true
			view.ReviewReasons = []string{"UNSUPPORTED_UPSTREAM_EXPRESSION"}
			return view, ""
		}
		group := strings.TrimSpace(billingGroup)
		if group == "" {
			group = UterRouteDiscountGroupDefault
		}
		discount, modelGroup, ok := UterRouteDiscountForModel(snapshot, item, group)
		if !ok {
			view.NeedsReview = true
			view.ReviewReasons = append(view.ReviewReasons, "NO_UPSTREAM_DISCOUNT")
			return view, ""
		}
		view.DiscountGroup = group
		view.DiscountModelGroup = modelGroup
		view.DiscountRatio = &discount
		// The expression carries official unit coefficients. Expose the
		// discounted absolute reference so the pricing page can show the
		// channel price separately from the official expression.
		if units, ok := uterRouteOfficialUnitPrices(normalized.Raw); ok {
			// The expression coefficients are the upstream official unit
			// prices. Keep the undiscounted tier as the official reference and
			// store the group-discounted tier separately as the channel price.
			view.Tiers = []model.ChannelPricingTier{uterRouteOfficialTierFromUnits(units, false)}

			tier := model.ChannelPricingTier{RangeName: "channel", Unit: "per_1m_token"}
			input := units.Input * discount
			tier.InputPerMillionUSD = floatMoneyPtr(&input)
			if units.OutputPresent {
				output := units.Output * discount
				tier.OutputPerMillionUSD = floatMoneyPtr(&output)
			}
			if units.CachePresent {
				cache := units.Cache * discount
				tier.CachePerMillionUSD = floatMoneyPtr(&cache)
			}
			if units.CreateCachePresent {
				createCache := units.CreateCache * discount
				tier.CreateCachePerMillionUSD = floatMoneyPtr(&createCache)
			}
			view.ChannelPrice = &tier
		} else if units, ok := uterRouteDurationUnitPrices(normalized.Raw); ok {
			view.Tiers = []model.ChannelPricingTier{uterRouteOfficialTierFromUnits(units, true)}
			perSecond := units.Input * discount
			view.ChannelPrice = &model.ChannelPricingTier{
				RangeName: "channel", Unit: "per_second", PerUnitUSD: floatMoneyPtr(&perSecond),
			}
		}
		internalPricing, priced := uterRouteChannelExpressionPricing(
			item.BillingExpr, group, modelGroup, discount,
		)
		if !priced {
			view.NeedsReview = true
			view.ReviewReasons = append(view.ReviewReasons, "EXPRESSION_DISCOUNT_UNVERIFIED")
			return view, ""
		}
		if isUterRouteReferencePriceStatus(item.PriceStatus) {
			markUterRouteReferencePriceReview(&view, item.PriceStatus)
			if view.NeedsReview {
				return view, ""
			}
		}
		return view, internalPricing
	}
	if line == nil || line.Input == nil {
		view.NeedsReview = true
		reason := "ABSENT_ABSOLUTE_PRICE"
		if item.PriceStatus == "UNSUPPORTED_BILLING_EXPR" {
			reason = "UNSUPPORTED_BILLING_EXPR"
		}
		view.ReviewReasons = []string{reason}
		return view, ""
	}
	view.Unit = line.Unit
	expressionRule = false
	switch item.PriceStatus {
	case "BILLING_EXPR", "DERIVED_FROM_EXPR":
		// Keep the complete rule. A flattened coefficient view is a reference
		// only and must never become the billing price.
		normalized := NormalizeUpstreamExpression(item.BillingExpr)
		view.Unit = "expression"
		view.BillingMode = "tiered_expr"
		view.BillingExpr = normalized.Raw
		view.ExpressionHash = normalized.Hash
		view.ExpressionStatus = normalized.Status
		view.ExpressionError = normalized.Error
		if !normalized.Executable {
			view.NeedsReview = true
			view.ReviewReasons = []string{"UNSUPPORTED_UPSTREAM_EXPRESSION"}
			return view, ""
		}
		expressionRule = true
	case "DERIVED_FROM_RATIOS":
		// The upstream supplies an official_price derived from its ratios.
		// Expose it as a reference tier so the page is not blank; whether it
		// may auto-enable billing follows the operator's authorization (see
		// markUterRouteReferencePriceReview below).
		view.ReviewReasons = []string{"DERIVED_FROM_RATIOS"}
		if line != nil && line.Input != nil {
			view.Tiers = []model.ChannelPricingTier{uterRoutePricingTier(line)}
		}
	case "HISTORICAL_SNAPSHOT":
		view.ReviewReasons = []string{"HISTORICAL_SNAPSHOT"}
		if line != nil && line.Input != nil {
			view.Tiers = []model.ChannelPricingTier{uterRoutePricingTier(line)}
		}
	default:
		view.Tiers = []model.ChannelPricingTier{uterRoutePricingTier(line)}
	}
	group := strings.TrimSpace(billingGroup)
	if group == "" {
		group = UterRouteDiscountGroupDefault
	}
	discount, modelGroup, ok := UterRouteDiscountForModel(snapshot, item, group)
	if !ok {
		view.NeedsReview = true
		view.ReviewReasons = append(view.ReviewReasons, "NO_UPSTREAM_DISCOUNT")
		return view, ""
	}
	channelLine := scaleUpstreamPriceLine(line, discount)
	var internalPricing string
	priced := false
	if expressionRule {
		internalPricing, priced = uterRouteChannelExpressionPricing(
			item.BillingExpr, group, modelGroup, discount,
		)
		if priced && !isUterRouteReferencePriceStatus(item.PriceStatus) {
			// The complete, executable rule carries every tier, so the
			// expression itself is the validated price contract.
			view.NeedsReview = false
			view.ReviewReasons = nil
		} else if !priced {
			view.NeedsReview = true
			view.ReviewReasons = append(view.ReviewReasons, "EXPRESSION_DISCOUNT_UNVERIFIED")
		}
		if isUterRouteReferencePriceStatus(item.PriceStatus) {
			markUterRouteReferencePriceReview(&view, item.PriceStatus)
		}
	} else {
		internalPricing, priced = uterRouteChannelInternalPricing(channelLine, group, modelGroup, discount)
		if !priced {
			view.NeedsReview = true
			view.ReviewReasons = append(view.ReviewReasons, "UNSUPPORTED_CHANNEL_PRICE_SHAPE")
		}
		if isUterRouteReferencePriceStatus(item.PriceStatus) {
			// The upstream reference is useful for display and for an explicit
			// operator pricing decision, but it is not a verified purchase cost
			// and must never enable automatic billing by itself.
			markUterRouteReferencePriceReview(&view, item.PriceStatus)
		}
	}
	if view.NeedsReview {
		// Hard gate: a review-only record may never auto-enable billing.
		internalPricing = ""
	}
	channelTier := uterRoutePricingTier(channelLine)
	view.ChannelPrice = &channelTier
	view.DiscountGroup = group
	view.DiscountModelGroup = modelGroup
	view.DiscountRatio = &discount
	return view, internalPricing
}

// isUterRouteReferencePriceStatus identifies upstream rows whose absolute
// amount is reconstructed from ratios or copied from a historical snapshot.
// Both are references for humans, not verified purchase costs.
func isUterRouteReferencePriceStatus(status string) bool {
	return status == "DERIVED_FROM_RATIOS" || status == "HISTORICAL_SNAPSHOT"
}

func markUterRouteReferencePriceReview(view *model.ChannelOfficialPricing, status string) {
	// The provenance is always recorded so the pricing page can show that the
	// number was reconstructed, not published. Only the billing gate follows
	// the operator's authorization flag.
	view.ReviewReasons = appendUterRouteReviewReason(view.ReviewReasons, status)
	if !uterRouteReferencePriceBillingAuthorized() {
		view.NeedsReview = true
		view.ReviewReasons = appendUterRouteReviewReason(
			view.ReviewReasons, uterRouteReferenceBillingNotAuthorizedReason,
		)
	}
}

func appendUterRouteReviewReason(reasons []string, reason string) []string {
	for _, existing := range reasons {
		if existing == reason {
			return reasons
		}
	}
	return append(reasons, reason)
}

func uterRoutePriceSource(status string) string {
	switch status {
	case "BILLING_EXPR", "DERIVED_FROM_EXPR":
		return "uterroute-expression"
	case "OFFICIAL_API":
		return "uterroute-official-api"
	case "HISTORICAL_SNAPSHOT":
		return "uterroute-historical-snapshot"
	case "DERIVED_FROM_RATIOS":
		return "uterroute-ratio-reference"
	default:
		return "uterroute-ratio-only"
	}
}
