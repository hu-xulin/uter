package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

// DreamRouterUpstreamSnapshotKey stores DreamRouter's official catalog and
// billing ratios in an isolated snapshot. It is deliberately separate from
// ModelRatio/ModelPrice/billing_expr: reading or refreshing this snapshot never
// changes what Uter charges on any channel.
const DreamRouterUpstreamSnapshotKey = "DreamRouterUpstreamSnapshot"

// DreamRouterUpstreamHistoryKey stores a bounded change log derived from
// consecutive isolated snapshots. It never stores secrets or absolute prices
// the provider did not publish.
const DreamRouterUpstreamHistoryKey = "DreamRouterUpstreamPriceHistory"

const upstreamHistoryLimit = 1000

// dreamRouterPlaceholderModelRatio marks models whose public model_ratio is a
// placeholder because their real price lives in billing_expr (tiered/media).
const dreamRouterPlaceholderModelRatio = 37.5

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
}

const (
	dreamRouterPricingPageURL = "https://dreamrouter.ai/api/pricing"
	dreamRouterModelsPageURL  = "https://dreamrouter.ai/v1/models"

	// UpstreamPriceBasisRatioOnly means the provider publishes billing ratios
	// (model_ratio / completion_ratio / group_ratio), not an absolute official
	// or discounted list price. No USD price may be inferred from them.
	UpstreamPriceBasisRatioOnly = "UPSTREAM_RATIO_ONLY"
)

// dreamRouterLegacyReference indexes the full sync snapshot (when present).
// That snapshot already reconstructs absolute USD prices from billing_expr and
// per-call records, so it is preferred over ratio-derived estimates.
func dreamRouterLegacyReference() map[string]DreamRouterModelRow {
	snapshot := LoadDreamRouterSnapshot()
	if snapshot == nil || len(snapshot.Models) == 0 {
		return nil
	}
	reference := make(map[string]DreamRouterModelRow, len(snapshot.Models)*2)
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

// dreamRouterOfficialLine returns the absolute official price line for a model.
// It prefers the full sync snapshot and only falls back to the documented
// ratio space (model_ratio 1 = $2 / 1M tokens, model_price = USD / call).
func dreamRouterOfficialLine(
	item UpstreamModelRecord,
	legacy map[string]DreamRouterModelRow,
) (*UpstreamPriceLine, string) {
	if item.QuotaType == 1 && item.ModelPrice != nil && *item.ModelPrice > 0 {
		value := *item.ModelPrice
		return &UpstreamPriceLine{Input: &value, Currency: "USD", Unit: "per_call", PerCall: true}, "OFFICIAL_API"
	}
	// The live public pricing document is the provider's current list price.
	// The full-sync snapshot is a fallback: it is rebuilt from billing
	// expressions and can lag behind a price change, and it must be the only
	// source for media/tiered models whose model_ratio is a placeholder.
	if item.ModelRatio != nil && *item.ModelRatio > 0 &&
		*item.ModelRatio != dreamRouterPlaceholderModelRatio &&
		!dreamRouterRecordUsesMediaEndpoint(item) {
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
		return line, "OFFICIAL_API"
	}
	if row, ok := legacy[item.ModelName]; ok && row.Official.Input > 0 {
		value := row.Official.Input
		switch {
		case row.PerSecond:
			return &UpstreamPriceLine{Input: &value, Currency: "USD", Unit: "per_second", PerSecond: true}, "OFFICIAL_REFERENCE"
		case row.QuotaType == 1 || row.BillingClass == "per_call":
			return &UpstreamPriceLine{Input: &value, Currency: "USD", Unit: "per_call", PerCall: true}, "OFFICIAL_REFERENCE"
		default:
			output := row.Official.Output
			cache := row.Official.Cache
			createCache := row.Official.CreateCache
			return &UpstreamPriceLine{
				Input: &value, Output: &output, CacheRead: &cache, CacheWrite: &createCache,
				Currency: "USD", Unit: "per_1m_token",
			}, "OFFICIAL_REFERENCE"
		}
	}
	return nil, "RATIO_ONLY_NO_ABSOLUTE_PRICE"
}

// dreamRouterRecordUsesMediaEndpoint marks video/audio/image endpoints whose
// model_ratio is not a token multiplier, so it must never be converted to a
// per-million-token price.
func dreamRouterRecordUsesMediaEndpoint(item UpstreamModelRecord) bool {
	for _, endpoint := range item.SupportedEndpoints {
		lower := strings.ToLower(endpoint)
		if strings.Contains(lower, "video") ||
			strings.Contains(lower, "audio") ||
			strings.Contains(lower, "image") {
			return true
		}
	}
	return false
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

// DreamRouterDiscountGroupDefault is the public billing group used when a
// channel has not selected its DreamRouter account group.
const DreamRouterDiscountGroupDefault = "default"

// DreamRouterDiscountGroupOptionKey stores the selected upstream billing group
// per channel ({"<channel id>": "<group>"}). It only affects that channel.
const DreamRouterDiscountGroupOptionKey = "DreamRouterChannelDiscountGroups"

// DreamRouterDiscountGroups lists the billing groups the provider publishes.
func DreamRouterDiscountGroups(snapshot *UpstreamSnapshot) []string {
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

// GetDreamRouterDiscountGroup returns the selected upstream billing group for
// one channel.
func GetDreamRouterDiscountGroup(channelID int) string {
	if channelID <= 0 {
		return DreamRouterDiscountGroupDefault
	}
	raw := strings.TrimSpace(common.OptionMap[DreamRouterDiscountGroupOptionKey])
	if raw == "" {
		return DreamRouterDiscountGroupDefault
	}
	groups := map[string]string{}
	if err := common.UnmarshalJsonStr(raw, &groups); err != nil {
		return DreamRouterDiscountGroupDefault
	}
	group := strings.TrimSpace(groups[fmt.Sprintf("%d", channelID)])
	if group == "" {
		return DreamRouterDiscountGroupDefault
	}
	return group
}

// SetDreamRouterDiscountGroup stores the upstream billing group for one
// channel.
func SetDreamRouterDiscountGroup(channelID int, group string) error {
	if channelID <= 0 {
		return errors.New("channel id is required")
	}
	group = strings.TrimSpace(group)
	if group == "" {
		return errors.New("discount group is required")
	}
	groups := map[string]string{}
	raw := strings.TrimSpace(common.OptionMap[DreamRouterDiscountGroupOptionKey])
	if raw != "" {
		_ = common.UnmarshalJsonStr(raw, &groups)
	}
	groups[fmt.Sprintf("%d", channelID)] = group
	encoded, err := common.Marshal(groups)
	if err != nil {
		return err
	}
	return model.UpdateOption(DreamRouterDiscountGroupOptionKey, string(encoded))
}

// DreamRouterDiscountForModel resolves the upstream discount multiplier for a
// model under the selected billing group. It prefers the provider's
// group-group table and falls back to the flat model-group table.
func DreamRouterDiscountForModel(
	snapshot *UpstreamSnapshot,
	item UpstreamModelRecord,
	group string,
) (float64, string, bool) {
	if snapshot == nil {
		return 0, "", false
	}
	group = strings.TrimSpace(group)
	if group == "" {
		group = DreamRouterDiscountGroupDefault
	}
	overrides := snapshot.GroupGroupRatio[group]
	for _, modelGroup := range item.EnableGroups {
		if ratio, ok := overrides[modelGroup]; ok && ratio > 0 {
			return ratio, modelGroup, true
		}
	}
	for _, modelGroup := range item.EnableGroups {
		if ratio, ok := snapshot.GroupRatio[modelGroup]; ok && ratio > 0 {
			return ratio, modelGroup, true
		}
	}
	return 0, "", false
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

// dreamRouterChannelInternalPricing turns a discounted absolute line into the
// channel's default sale price. Tiered or per-second prices cannot be expressed
// in the flat internal form and stay official-only for manual review.
func dreamRouterChannelInternalPricing(
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
		Source:             "dreamrouter-discount",
		DiscountGroup:      group,
		DiscountModelGroup: modelGroup,
		DiscountRatio:      factor,
		UpdatedAt:          now,
	}
	switch {
	case line.PerSecond:
		pricing.Mode = model.ChannelPricingModePerSecond
		pricing.PerSecondUSD = line.Input
	case line.PerCall:
		pricing.Mode = model.ChannelPricingModePerCall
		pricing.PerCallUSD = line.Input
	case line.PerImage:
		pricing.Mode = model.ChannelPricingModePerCall
		pricing.PerCallUSD = line.Input
	default:
		pricing.Mode = model.ChannelPricingModePerMillionTokens
		pricing.InputUSDPerMillion = line.Input
		pricing.OutputUSDPerMillion = line.Output
		pricing.CacheUSDPerMillion = line.CacheRead
		pricing.CreateCacheUSDPerMillion = line.CacheWrite
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
	CompletionRatio  *float64 `json:"completion_ratio,omitempty"`
	CacheRatio       *float64 `json:"cache_ratio,omitempty"`
	CreateCacheRatio *float64 `json:"create_cache_ratio,omitempty"`

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
}

type dreamRouterPublicModel struct {
	ModelName              string   `json:"model_name"`
	VendorID               int      `json:"vendor_id"`
	QuotaType              int      `json:"quota_type"`
	ModelRatio             *float64 `json:"model_ratio"`
	ModelPrice             *float64 `json:"model_price"`
	CompletionRatio        *float64 `json:"completion_ratio"`
	CacheRatio             *float64 `json:"cache_ratio"`
	CreateCacheRatio       *float64 `json:"create_cache_ratio"`
	EnableGroups           []string `json:"enable_groups"`
	SupportedEndpointTypes []string `json:"supported_endpoint_types"`
	PricingVersion         string   `json:"pricing_version"`
}

type dreamRouterPublicPricing struct {
	Success        bool                     `json:"success"`
	PricingVersion string                   `json:"pricing_version"`
	Data           []dreamRouterPublicModel `json:"data"`
	Vendors        []struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"vendors"`
	GroupRatio      map[string]float64            `json:"group_ratio"`
	GroupGroupRatio map[string]map[string]float64 `json:"group_group_ratio"`
	AutoGroups      []string                      `json:"auto_groups"`
	UsableGroup     map[string]string             `json:"usable_group"`
}

// FetchDreamRouterUpstream fetches the public pricing document and normalizes
// it without writing any Uter model price. baseURL is injectable for tests;
// production callers pass the empty string.
func FetchDreamRouterUpstream(ctx context.Context, baseURL string) (*UpstreamSnapshot, error) {
	baseURL = dreamRouterPricingOrigin(baseURL)
	endpoint := baseURL + "/api/pricing"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch dreamrouter pricing: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("dreamrouter pricing returned HTTP %d: %s", resp.StatusCode, truncateBailianBody(body))
	}

	var payload dreamRouterPublicPricing
	if err := common.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("decode dreamrouter pricing: %w", err)
	}
	if !payload.Success {
		return nil, errors.New("dreamrouter pricing returned success=false")
	}
	if len(payload.Data) == 0 {
		return nil, errors.New("dreamrouter pricing returned no models")
	}

	vendorNames := make(map[int]string, len(payload.Vendors))
	for _, vendor := range payload.Vendors {
		vendorNames[vendor.ID] = vendor.Name
	}

	now := time.Now().UTC()
	legacy := dreamRouterLegacyReference()
	snapshot := &UpstreamSnapshot{
		ProviderID:      "dreamrouter",
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
		record := UpstreamModelRecord{
			ProviderID:         snapshot.ProviderID,
			UpstreamModelID:    name,
			ModelName:          name,
			VendorID:           item.VendorID,
			VendorName:         vendorNames[item.VendorID],
			QuotaType:          item.QuotaType,
			EnableGroups:       item.EnableGroups,
			SupportedEndpoints: item.SupportedEndpointTypes,
			ModelRatio:         item.ModelRatio,
			ModelPrice:         item.ModelPrice,
			CompletionRatio:    item.CompletionRatio,
			CacheRatio:         item.CacheRatio,
			CreateCacheRatio:   item.CreateCacheRatio,
			PriceBasis:         UpstreamPriceBasisRatioOnly,
			Source:             "official_api",
			SourceEndpoint:     endpoint,
			PricingVersion:     item.PricingVersion,
			VerifiedAt:         now,
		}
		record.OfficialPrice, record.PriceStatus = dreamRouterOfficialLine(record, legacy)
		snapshot.Models = append(snapshot.Models, record)
	}
	if len(snapshot.Models) == 0 {
		return nil, errors.New("dreamrouter pricing contained no usable model names")
	}
	sort.Slice(snapshot.Models, func(i, j int) bool {
		return snapshot.Models[i].UpstreamModelID < snapshot.Models[j].UpstreamModelID
	})
	return snapshot, nil
}

// dreamRouterPricingOrigin strips the OpenAI-compatible path operators often
// paste into Base URL (for example https://dreamrouter.ai/v1) so the public
// pricing endpoint is always requested at the site root.
func dreamRouterPricingOrigin(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "https://dreamrouter.ai"
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return strings.TrimRight(raw, "/")
	}
	return parsed.Scheme + "://" + parsed.Host
}

// SaveDreamRouterUpstreamSnapshot persists the isolated snapshot.
func SaveDreamRouterUpstreamSnapshot(snapshot *UpstreamSnapshot) error {
	if snapshot == nil {
		return errors.New("dreamrouter upstream snapshot is nil")
	}
	raw, err := common.Marshal(snapshot)
	if err != nil {
		return err
	}
	return model.UpdateOption(DreamRouterUpstreamSnapshotKey, string(raw))
}

// LoadDreamRouterUpstreamSnapshot returns the last isolated snapshot.
func LoadDreamRouterUpstreamSnapshot() *UpstreamSnapshot {
	raw := strings.TrimSpace(common.OptionMap[DreamRouterUpstreamSnapshotKey])
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
	ProviderID     string    `json:"provider_id"`
	ModelID        string    `json:"model_id"`
	Kind           string    `json:"kind"`
	Field          string    `json:"field,omitempty"`
	Old            *float64  `json:"old,omitempty"`
	New            *float64  `json:"new,omitempty"`
	DetectedAt     time.Time `json:"detected_at"`
	PricingVersion string    `json:"pricing_version,omitempty"`
}

// UpstreamPriceHistory is the persisted, bounded change log.
type UpstreamPriceHistory struct {
	ProviderID string                `json:"provider_id"`
	Entries    []UpstreamPriceChange `json:"entries"`
}

// DiffDreamRouterUpstream compares two isolated snapshots. Only raw upstream
// ratio fields are compared; an absolute price is never derived or stored.
func DiffDreamRouterUpstream(prev, next *UpstreamSnapshot) []UpstreamPriceChange {
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

// AppendDreamRouterUpstreamHistory merges new changes into the bounded log.
func AppendDreamRouterUpstreamHistory(providerID string, changes []UpstreamPriceChange) error {
	history := LoadDreamRouterUpstreamHistory()
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
	return model.UpdateOption(DreamRouterUpstreamHistoryKey, string(raw))
}

// LoadDreamRouterUpstreamHistory returns the persisted change log.
func LoadDreamRouterUpstreamHistory() *UpstreamPriceHistory {
	raw := strings.TrimSpace(common.OptionMap[DreamRouterUpstreamHistoryKey])
	if raw == "" {
		return nil
	}
	var history UpstreamPriceHistory
	if err := common.Unmarshal([]byte(raw), &history); err != nil {
		return nil
	}
	return &history
}

// DreamRouterNormalizedPricing is stored in the per-channel pricing row.
// It intentionally has no absolute price: the provider publishes ratios only.
type DreamRouterNormalizedPricing struct {
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

// DreamRouterChannelPricingRecords builds channel-scoped official records.
// Only models the channel actually serves are written, and the provider's
// ratios are preserved as ratios rather than converted into a fake USD price.
func DreamRouterChannelPricingRecords(
	snapshot *UpstreamSnapshot,
	channelID int,
	channelModels []string,
	billingGroup string,
) ([]model.ChannelOfficialPricingRecord, error) {
	if snapshot == nil || channelID <= 0 {
		return nil, errors.New("dreamrouter snapshot and channel id are required")
	}
	wanted := make(map[string]bool, len(channelModels))
	for _, name := range channelModels {
		name = strings.TrimSpace(name)
		if name != "" {
			wanted[name] = true
		}
	}
	records := make([]model.ChannelOfficialPricingRecord, 0, len(snapshot.Models))
	for _, item := range snapshot.Models {
		if len(wanted) > 0 && !wanted[item.ModelName] {
			continue
		}
		officialView, internalPricing := dreamRouterChannelOfficialPricing(
			snapshot, item, snapshot.FetchedAt.Unix(), billingGroup,
		)
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
			Provider:          "dreamrouter",
			ModelName:         item.ModelName,
			Currency:          "USD",
			OfficialPricing:   string(officialRaw),
			NormalizedPricing: string(normalizedRaw),
			InternalPricing:   internalPricing,
			Source:            "dreamrouter-official",
			FetchedAt:         snapshot.FetchedAt.Unix(),
		})
	}
	return records, nil
}

// dreamRouterPricingTier converts one absolute price line into the stored tier
// shape shared by official and channel prices.
func dreamRouterPricingTier(line *UpstreamPriceLine) model.ChannelPricingTier {
	tier := model.ChannelPricingTier{RangeName: "base", Unit: line.Unit}
	switch line.Unit {
	case "per_second":
		tier.PerUnitUSD = line.Input
		tier.Unit = "per_second"
	case "per_call":
		tier.PerUnitUSD = line.Input
		tier.Unit = "per_call"
	default:
		tier.InputPerMillionUSD = line.Input
		tier.OutputPerMillionUSD = line.Output
		tier.CachePerMillionUSD = line.CacheRead
		tier.Unit = "per_1m_token"
	}
	return tier
}

// dreamRouterChannelOfficialPricing converts the upstream price line into the
// channel pricing table's normalized view. Derived prices stay reviewable so an
// operator can audit the ratio-to-price conversion before billing.
func dreamRouterChannelOfficialPricing(
	snapshot *UpstreamSnapshot,
	item UpstreamModelRecord,
	fetchedAt int64,
	billingGroup string,
) (model.ChannelOfficialPricing, string) {
	view := model.ChannelOfficialPricing{
		Currency:  "USD",
		Unit:      "unknown",
		Source:    "dreamrouter-official",
		FetchedAt: fetchedAt,
	}
	line := item.OfficialPrice
	if line == nil || line.Input == nil {
		view.NeedsReview = true
		view.ReviewReasons = []string{"ABSENT_ABSOLUTE_PRICE"}
		return view, ""
	}
	view.Unit = line.Unit
	view.Tiers = []model.ChannelPricingTier{dreamRouterPricingTier(line)}
	if item.PriceStatus == "DERIVED_FROM_RATIOS" {
		view.NeedsReview = true
		view.ReviewReasons = []string{"DERIVED_FROM_RATIOS"}
	}
	group := strings.TrimSpace(billingGroup)
	if group == "" {
		group = DreamRouterDiscountGroupDefault
	}
	discount, modelGroup, ok := DreamRouterDiscountForModel(snapshot, item, group)
	if !ok {
		view.NeedsReview = true
		view.ReviewReasons = append(view.ReviewReasons, "NO_UPSTREAM_DISCOUNT")
		return view, ""
	}
	channelLine := scaleUpstreamPriceLine(line, discount)
	internalPricing, priced := dreamRouterChannelInternalPricing(channelLine, group, modelGroup, discount)
	if !priced {
		view.NeedsReview = true
		view.ReviewReasons = append(view.ReviewReasons, "UNSUPPORTED_CHANNEL_PRICE_SHAPE")
	}
	channelTier := dreamRouterPricingTier(channelLine)
	view.ChannelPrice = &channelTier
	view.DiscountGroup = group
	view.DiscountModelGroup = modelGroup
	view.DiscountRatio = &discount
	return view, internalPricing
}
