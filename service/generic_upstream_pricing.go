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
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
)

type GenericPricingEntry struct {
	ModelName        string  `json:"model_name"`
	VendorID         int     `json:"vendor_id,omitempty"`
	QuotaType        int     `json:"quota_type"`
	ModelRatio       float64 `json:"model_ratio"`
	ModelPrice       float64 `json:"model_price"`
	CompletionRatio  float64 `json:"completion_ratio"`
	CacheRatio       float64 `json:"cache_ratio"`
	CreateCacheRatio float64 `json:"create_cache_ratio"`
	BillingMode      string  `json:"billing_mode"`
	BillingExpr      string  `json:"billing_expr"`
	// EnableGroups/SupportedEndpointTypes/PricingVersion are the model's
	// upstream identity: which billing groups may use it, which protocols it
	// serves, and the price document version. They are kept verbatim in the
	// official row for audit even though Uter does not bill by them directly.
	EnableGroups           []string `json:"enable_groups,omitempty"`
	SupportedEndpointTypes []string `json:"supported_endpoint_types,omitempty"`
	PricingVersion         string   `json:"pricing_version,omitempty"`
	OfficialPrice          *float64 `json:"official_price"`
	OfficialRatio          *float64 `json:"official_ratio"`
	// QuotaPerUnit is the instance's quota-to-dollar basis. A ratio can only
	// become USD when this is known; assuming 500000 silently misprices other
	// New API deployments.
	QuotaPerUnit *float64 `json:"quota_per_unit,omitempty"`
	Currency     string   `json:"currency,omitempty"`
}

// GenericModelNames returns the catalogue model ids in document order.
func GenericModelNames(entries []GenericPricingEntry) []string {
	out := make([]string, 0, len(entries))
	seen := make(map[string]bool, len(entries))
	for _, entry := range entries {
		name := strings.TrimSpace(entry.ModelName)
		if name == "" || seen[name] {
			continue
		}
		seen[name] = true
		out = append(out, name)
	}
	return out
}

type GenericPricingPayload struct {
	Data         []GenericPricingEntry `json:"data"`
	GroupRatio   map[string]float64    `json:"group_ratio,omitempty"`
	UsableGroup  map[string]string     `json:"usable_group,omitempty"`
	QuotaPerUnit *float64              `json:"quota_per_unit,omitempty"`
	// GroupDisplay maps the technical billing group to the operator-facing name
	// (for example Codex Pro -> "Codex · 标准（稳定）").
	GroupDisplay map[string]struct {
		Name string `json:"name"`
	} `json:"group_display,omitempty"`
}

// genericQuotaPerUnit resolves the ratio basis: the entry wins, then the
// document. Zero means unknown and forbids ratio-to-USD conversion.
func genericQuotaPerUnit(entry GenericPricingEntry, payload *GenericPricingPayload) float64 {
	if entry.QuotaPerUnit != nil && *entry.QuotaPerUnit > 0 {
		return *entry.QuotaPerUnit
	}
	if payload != nil && payload.QuotaPerUnit != nil && *payload.QuotaPerUnit > 0 {
		return *payload.QuotaPerUnit
	}
	return 0
}

// GenericUpstreamBillingGroupKey stores the selected upstream billing group per
// channel ({"<channel id>": "<group>"}). The group determines which upstream
// quote the key can call and therefore the channel price before Uter markup.
const GenericUpstreamBillingGroupKey = "GenericUpstreamBillingGroups"

// GetGenericUpstreamBillingGroup returns the selected upstream group, or "".
func GetGenericUpstreamBillingGroup(channelID int) string {
	if channelID <= 0 {
		return ""
	}
	raw := strings.TrimSpace(common.GetOption(GenericUpstreamBillingGroupKey))
	if raw == "" {
		return ""
	}
	groups := map[string]string{}
	if err := common.UnmarshalJsonStr(raw, &groups); err != nil {
		return ""
	}
	return strings.TrimSpace(groups[fmt.Sprintf("%d", channelID)])
}

// SetGenericUpstreamBillingGroup stores or clears the upstream group.
func SetGenericUpstreamBillingGroup(channelID int, group string) error {
	if channelID <= 0 {
		return errors.New("channel id is required")
	}
	groups := map[string]string{}
	raw := strings.TrimSpace(common.GetOption(GenericUpstreamBillingGroupKey))
	if raw != "" {
		_ = common.UnmarshalJsonStr(raw, &groups)
	}
	group = strings.TrimSpace(group)
	if group == "" {
		delete(groups, fmt.Sprintf("%d", channelID))
	} else {
		groups[fmt.Sprintf("%d", channelID)] = group
	}
	encoded, err := common.Marshal(groups)
	if err != nil {
		return err
	}
	return model.UpdateOption(GenericUpstreamBillingGroupKey, string(encoded))
}

// FilterModelNamesByUpstreamGroup keeps only the model family an upstream
// group can serve: Claude groups see Claude models, Codex/GPT groups see GPT
// models. Groups outside those families, and answers that match nothing, keep
// every name so an upstream rename cannot silently empty a channel.
func FilterModelNamesByUpstreamGroup(group string, models []string) []string {
	lower := strings.ToLower(strings.TrimSpace(group))
	var family string
	switch {
	case strings.HasPrefix(lower, "claude"):
		family = "claude"
	case strings.HasPrefix(lower, "codex"), strings.HasPrefix(lower, "gpt"):
		family = "gpt"
	default:
		return models
	}
	kept := make([]string, 0, len(models))
	for _, name := range models {
		if strings.Contains(strings.ToLower(name), family) {
			kept = append(kept, name)
		}
	}
	if len(kept) == 0 {
		return models
	}
	return kept
}

// FetchGenericUpstreamPricing reads a New API compatible /api/pricing document.
// It tries each channel key so one exhausted key does not block the sync.
func FetchGenericUpstreamPricing(ctx context.Context, baseURL string, keys []string) (*GenericPricingPayload, error) {
	endpoint, err := genericPricingEndpoint(baseURL)
	if err != nil {
		return nil, err
	}
	client := newUpstreamHTTPClient(20 * time.Second)
	var lastErr error
	for _, key := range keys {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		requestCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
		req, err := http.NewRequestWithContext(requestCtx, http.MethodGet, endpoint, nil)
		if err != nil {
			cancel()
			return nil, err
		}
		req.Header.Set("Authorization", "Bearer "+key)
		req.Header.Set("Accept", "application/json")
		res, err := client.Do(req)
		if err != nil {
			cancel()
			lastErr = err
			continue
		}
		status := res.StatusCode
		body, readErr := io.ReadAll(io.LimitReader(res.Body, 8<<20))
		res.Body.Close()
		cancel()
		if status < http.StatusOK || status >= http.StatusMultipleChoices {
			lastErr = fmt.Errorf("upstream returned status %d", status)
			continue
		}
		if readErr != nil {
			lastErr = readErr
			continue
		}
		var payload GenericPricingPayload
		if err := common.Unmarshal(body, &payload); err != nil {
			lastErr = errors.New("upstream pricing payload is not valid JSON")
			continue
		}
		return &payload, nil
	}
	if lastErr == nil {
		lastErr = errors.New("channel has no usable API key")
	}
	return nil, lastErr
}

func genericPricingEndpoint(baseURL string) (string, error) {
	base := strings.TrimSpace(baseURL)
	if base == "" {
		return "", errors.New("channel base URL is required")
	}
	base = strings.TrimRight(base, "/")
	base = strings.TrimSuffix(base, "/v1")
	if !strings.Contains(base, "://") {
		base = "https://" + base
	}
	parsed, err := url.Parse(base + "/api/pricing")
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return "", errors.New("invalid channel base URL")
	}
	if _, err := validateUpstreamEndpoint(parsed.String()); err != nil {
		return "", err
	}
	return parsed.String(), nil
}

// GenericChannelPricingRecords converts upstream entries into official-price
// rows for the channel-creation path. A first-time channel derives a default
// sale price from an executable upstream expression; every later sync must use
// GenericOfficialPricingRecords so it never rewrites a sale price.
func GenericChannelPricingRecords(
	channelID int,
	channelModels []string,
	entries []GenericPricingEntry,
	now time.Time,
) []model.ChannelOfficialPricingRecord {
	return genericChannelPricingRecords(channelID, channelModels, entries, now, 0, true)
}

// GenericOfficialPricingRecords builds sync rows: official data and the channel
// quote only. Automatic updates must never re-derive or overwrite a sale price.
func GenericOfficialPricingRecords(
	channelID int,
	channelModels []string,
	entries []GenericPricingEntry,
	now time.Time,
	quotaPerUnit float64,
) []model.ChannelOfficialPricingRecord {
	return genericChannelPricingRecords(channelID, channelModels, entries, now, quotaPerUnit, false)
}

// GenericChannelPricingRecordsWithQuota also applies a document-level
// quota_per_unit when an entry does not carry its own basis. It keeps the
// creation-time default sale price and must not be used by scheduled syncs.
func GenericChannelPricingRecordsWithQuota(
	channelID int,
	channelModels []string,
	entries []GenericPricingEntry,
	now time.Time,
	quotaPerUnit float64,
) []model.ChannelOfficialPricingRecord {
	return genericChannelPricingRecords(channelID, channelModels, entries, now, quotaPerUnit, true)
}

func genericChannelPricingRecords(
	channelID int,
	channelModels []string,
	entries []GenericPricingEntry,
	now time.Time,
	quotaPerUnit float64,
	deriveSalePrice bool,
) []model.ChannelOfficialPricingRecord {
	wanted := make(map[string]bool, len(channelModels))
	for _, name := range channelModels {
		name = strings.TrimSpace(name)
		if name != "" {
			wanted[name] = true
		}
	}
	records := make([]model.ChannelOfficialPricingRecord, 0, len(entries))
	for _, entry := range entries {
		name := strings.TrimSpace(entry.ModelName)
		if name == "" || (len(wanted) > 0 && !wanted[name]) {
			continue
		}
		quota := quotaPerUnit
		if entry.QuotaPerUnit != nil && *entry.QuotaPerUnit > 0 {
			quota = *entry.QuotaPerUnit
		}
		official, needsReview, reasons := genericOfficialPricing(entry, now.Unix(), quota)
		raw, err := common.Marshal(entry)
		if err != nil {
			continue
		}
		normalized, err := common.Marshal(official)
		if err != nil {
			continue
		}
		_ = needsReview
		_ = reasons
		records = append(records, model.ChannelOfficialPricingRecord{
			ChannelId: channelID, Provider: "newapi-compatible",
			ModelName: name, Currency: official.Currency,
			OfficialPricing: string(raw), NormalizedPricing: string(normalized),
			InternalPricing: genericExpressionInternalPricing(entry, now.Unix()),
			Source:          "newapi:/api/pricing", FetchedAt: now.Unix(),
		})
	}
	return records
}

// genericExpressionInternalPricing mirrors an executable upstream expression
// as the channel's default sale price. Unsupported rules never become a flat
// approximation.
func setChannelPriceFromExpression(official *model.ChannelOfficialPricing, expr string, factor float64) {
	if official == nil || factor <= 0 {
		return
	}
	if units, ok := uterRouteOfficialUnitPrices(expr); ok {
		tier := model.ChannelPricingTier{RangeName: "channel", Unit: "per_1m_token"}
		input := units.Input * factor
		tier.InputPerMillionUSD = &input
		if units.OutputPresent {
			output := units.Output * factor
			tier.OutputPerMillionUSD = &output
		}
		if units.CachePresent {
			cache := units.Cache * factor
			tier.CachePerMillionUSD = &cache
		}
		if units.CreateCachePresent {
			createCache := units.CreateCache * factor
			tier.CreateCachePerMillionUSD = &createCache
		}
		official.ChannelPrice = &tier
		return
	}
	if units, ok := uterRouteDurationUnitPrices(expr); ok {
		perSecond := units.Input * factor
		official.ChannelPrice = &model.ChannelPricingTier{
			RangeName: "channel", Unit: "per_second", PerUnitUSD: &perSecond,
		}
	}
}

func genericExpressionInternalPricing(entry GenericPricingEntry, updatedAt int64) string {
	expr := NormalizeUpstreamExpression(entry.BillingExpr)
	if !expr.Executable {
		return ""
	}
	internal := model.ChannelInternalPricing{
		Mode:        model.ChannelPricingModeTieredExpr,
		BillingExpr: expr.Raw,
		Source:      "newapi-expression",
		UpdatedAt:   updatedAt,
	}
	if !applyDefaultSaleMarkup(&internal) {
		return ""
	}
	encoded, err := common.Marshal(internal)
	if err != nil {
		return ""
	}
	return string(encoded)
}

func genericOfficialPricing(entry GenericPricingEntry, fetchedAt int64, quotaPerUnit float64) (model.ChannelOfficialPricing, bool, []string) {
	view := model.ChannelOfficialPricing{
		Currency: "USD", Source: "newapi:/api/pricing", FetchedAt: fetchedAt,
	}
	if entry.BillingMode != "" || strings.TrimSpace(entry.BillingExpr) != "" {
		expr := NormalizeUpstreamExpression(entry.BillingExpr)
		view.Unit = "expression"
		view.PriceKind = "BILLING_EXPRESSION"
		view.BillingMode = entry.BillingMode
		view.BillingExpr = expr.Raw
		view.ExpressionHash = expr.Hash
		view.ExpressionStatus = expr.Status
		view.ExpressionError = expr.Error
		if expr.Executable {
			setChannelPriceFromExpression(&view, expr.Raw, 1)
		}
		if !expr.Executable {
			view.NeedsReview = true
			view.ReviewReasons = []string{"UNSUPPORTED_UPSTREAM_EXPRESSION"}
			return view, true, view.ReviewReasons
		}
		return view, false, nil
	}
	if entry.QuotaType == 1 || entry.ModelPrice > 0 {
		price := entry.ModelPrice
		kind := "CHANNEL_QUOTE"
		if entry.OfficialPrice != nil && *entry.OfficialPrice > 0 {
			price = *entry.OfficialPrice
			kind = "OFFICIAL_ABSOLUTE"
		}
		view.PriceKind = kind
		view.Unit = "per_call"
		tier := model.ChannelPricingTier{RangeName: "base", Unit: "per_call"}
		if price > 0 {
			tier.PerUnitUSD = &price
		}
		view.Tiers = []model.ChannelPricingTier{tier}
		return view, price <= 0, nil
	}
	// A token model with only an absolute "official price" has no confirmed
	// unit (per token, per 1K or per 1M). Converting the number by assumption
	// would invent an official price, so it is reported for manual review.
	if entry.OfficialPrice != nil {
		if entry.ModelRatio > 0 || (entry.OfficialRatio != nil && *entry.OfficialRatio > 0) {
			view.Unit = "unknown"
			view.PriceKind = "UNKNOWN"
			view.NeedsReview = true
			view.ReviewReasons = []string{"OFFICIAL_PRICE_AND_RATIO_CONFLICT"}
			return view, true, view.ReviewReasons
		}
		view.Unit = "unknown"
		view.PriceKind = "UNKNOWN"
		view.NeedsReview = true
		view.ReviewReasons = []string{"OFFICIAL_PRICE_UNIT_UNKNOWN"}
		return view, true, view.ReviewReasons
	}
	ratio := entry.ModelRatio
	kind := "CHANNEL_RATIO"
	if entry.OfficialRatio != nil && *entry.OfficialRatio > 0 {
		ratio = *entry.OfficialRatio
		kind = "OFFICIAL_RATIO"
	}
	if ratio <= 0 {
		view.Unit = "unknown"
		view.PriceKind = "UNKNOWN"
		view.NeedsReview = true
		view.ReviewReasons = []string{"NO_USABLE_RATIO"}
		return view, true, view.ReviewReasons
	}
	if quotaPerUnit <= 0 {
		// Without the instance's quota basis a ratio is not a USD price. Keep
		// the ratio for audit and block automatic pricing.
		view.Unit = "ratio"
		view.PriceKind = "RATIO_ONLY"
		view.NeedsReview = true
		view.ReviewReasons = []string{"RATIO_BASIS_UNKNOWN"}
		view.RatioBasis = &model.ChannelRatioBasis{
			RawRatio:           ratio,
			RawCompletionRatio: entry.CompletionRatio,
			Formula:            "ratio only; quota_per_unit is required",
			FormulaVersion:     "newapi-quota-v1",
		}
		return view, true, view.ReviewReasons
	}
	// USD per 1M tokens = ratio * 1,000,000 / quota_per_unit.
	basisUSDPerMillion := 1_000_000 / quotaPerUnit
	input := ratio * basisUSDPerMillion
	tier := model.ChannelPricingTier{
		RangeName: "base", Unit: "per_1m_token", InputPerMillionUSD: &input,
	}
	basis := &model.ChannelRatioBasis{
		RawRatio:           ratio,
		RawCompletionRatio: entry.CompletionRatio,
		BasisUSDPerMillion: basisUSDPerMillion,
		Formula:            "usd_per_1m = ratio * 1000000 / quota_per_unit",
		FormulaVersion:     "newapi-quota-v1",
		ResultInputUSD:     input,
	}
	view.PriceKind = kind
	view.RatioBasis = basis
	if entry.CompletionRatio > 0 {
		output := input * entry.CompletionRatio
		tier.OutputPerMillionUSD = &output
		basis.ResultOutputUSD = output
	}
	if entry.CacheRatio > 0 {
		cache := input * entry.CacheRatio
		tier.CachePerMillionUSD = &cache
	}
	if entry.CreateCacheRatio > 0 {
		cacheWrite := input * entry.CreateCacheRatio
		tier.CreateCachePerMillionUSD = &cacheWrite
	}
	view.Unit = "per_1m_token"
	view.Tiers = []model.ChannelPricingTier{tier}
	if tier.OutputPerMillionUSD == nil {
		view.NeedsReview = true
		view.ReviewReasons = []string{"OUTPUT_PRICE_MISSING"}
	}
	return view, view.NeedsReview, view.ReviewReasons
}

// isUterAPIPricingChannel reports whether a channel uses the Uter.api contract,
// either by its dedicated type or (for legacy channels) by its host.
func isUterAPIPricingChannel(channel *model.Channel) bool {
	return channel.Type == constant.ChannelTypeUterAPI || IsUterAPIHost(channel.GetBaseURL())
}

// SyncGenericChannelPricing fetches and persists official rows for one channel.
func SyncGenericChannelPricing(ctx context.Context, channel *model.Channel) (int, error) {
	written, _, err := SyncGenericChannelPricingWithModels(ctx, channel)
	return written, err
}

// SyncGenericChannelPricingWithModels also returns the catalogue model ids, so
// a channel with no model list yet can import them from the same document.
func SyncGenericChannelPricingWithModels(ctx context.Context, channel *model.Channel) (int, []string, error) {
	if channel == nil {
		return 0, nil, errors.New("channel is required")
	}
	// Uter.api is an Uter-owned contract: its prices come only from the
	// authenticated per-key document with the key's billing group applied.
	// Dispatch to the dedicated sync before taking this function's lock
	// (SyncUterAPIChannelPricing takes the same lock itself). This prevents the
	// generic "newapi:/api/pricing" path from ever writing a second,
	// contradictory price row for an Uter.api channel.
	if isUterAPIPricingChannel(channel) {
		group := GetGenericUpstreamBillingGroup(channel.Id)
		if group == "" {
			return 0, nil, errors.New("Uter.api channel has no upstream billing group; refuse catalogue-price sync")
		}
		written, _, _, err := SyncUterAPIChannelPricing(ctx, channel, group)
		return written, nil, err
	}
	release, acquired, err := acquireChannelPricingSyncLock(channel.Id)
	if err != nil {
		return 0, nil, err
	}
	if !acquired {
		return 0, nil, ErrPricingSyncInProgress
	}
	defer release()
	// Every Uter-owned channel other than Uter.api (dispatched above) prices
	// through Uter Route's own catalogue: Uter.ai relays and white-labelled
	// Uter Route channels alike. The generic New API document has no
	// model-group discount context and would store the official base price as
	// the channel price, duplicating catalogue rows under a second provider
	// key. Using the unified ownership predicate here closes the gap where a
	// channel of a dedicated type pointed at a non-Uter host.
	if IsUterOwnedPricingChannel(channel.Type, channel.GetBaseURL()) {
		// UterRoute publishes per-model-group discounts. Generic New API
		// pricing has no model-group context, so syncing it here would store
		// the official base price as the channel price. Route the channel
		// through the provider parser instead.
		snapshot, err := FetchUterRouteUpstream(ctx, channel.GetBaseURL())
		if err != nil {
			return 0, nil, err
		}
		models := make([]string, 0, len(snapshot.Models))
		for _, item := range snapshot.Models {
			if name := strings.TrimSpace(item.ModelName); name != "" {
				models = append(models, name)
			}
		}
		if len(channel.GetModels()) == 0 {
			if _, addErr := AppendChannelModelNames(channel, models); addErr != nil {
				common.SysError(common.LogText("uterroute auto model add failed: channel_id=%d, error=%v", channel.Id, addErr))
			}
		}
		records, err := UterRouteChannelPricingRecords(
			snapshot, channel.Id, channel.GetModels(), GetUterRouteDiscountGroup(channel.Id),
		)
		if err != nil {
			return 0, models, err
		}
		written, err := model.UpsertChannelOfficialPricing(records)
		if err != nil {
			return written, models, err
		}
		pruneHiddenUterRouteModels(channel, snapshot.ExcludedModels)
		// Remove rows an earlier generic sync left behind for this channel:
		// they duplicate every model in the fetched-price table with the
		// undiscounted base price as the channel price. Operator and batch
		// rows under another provider are kept for manual review.
		if _, keptRows, delErr := model.DeleteAutoDerivedPricingForOtherProvider(channel.Id, "uterroute"); delErr != nil {
			common.SysError(common.LogText("prune generic uterroute pricing rows failed: channel_id=%d, error=%v", channel.Id, delErr))
		} else if keptRows > 0 {
			common.SysLog(common.LogText("kept %d manually priced rows under other providers for uterroute channel %d", keptRows, channel.Id))
		}
		return written, models, nil
	}
	entries, err := FetchGenericUpstreamPricing(ctx, channel.GetBaseURL(), channel.GetKeys())
	if err != nil {
		return 0, nil, err
	}
	if len(entries.Data) == 0 {
		return 0, nil, errors.New("upstream returned no pricing entries")
	}
	models := GenericModelNames(entries.Data)
	// The pricing document is account-wide, so it may list models the channel's
	// key cannot actually serve (uterapi group keys see a subset). Import the
	// catalogue only when the channel has no model list yet; an existing list
	// stays authoritative instead of being expanded by every price sync.
	if len(channel.GetModels()) == 0 {
		if _, addErr := AppendChannelModelNames(channel, models); addErr != nil {
			common.SysError(common.LogText("generic auto model add failed: channel_id=%d, error=%v", channel.Id, addErr))
		}
	}
	records := GenericChannelPricingRecordsWithQuota(
		channel.Id, channel.GetModels(), entries.Data, time.Now().UTC(),
		genericQuotaPerUnit(GenericPricingEntry{}, entries),
	)
	if len(records) == 0 {
		return 0, models, errors.New("no pricing entries matched the channel models")
	}
	// A channel bound to an upstream group is billed at the document price times
	// that group's published ratio, exactly as the create path does. Without
	// this, a periodic sync would silently revert group channels to catalogue
	// prices.
	if group := GetGenericUpstreamBillingGroup(channel.Id); group != "" {
		if ratio := entries.GroupRatio[group]; ratio > 0 && ratio != 1 {
			for i := range records {
				applyGroupRatioToRecord(&records[i], group, ratio)
			}
		}
	}
	written, err := model.UpsertChannelOfficialPricing(records)
	if err != nil {
		return written, models, err
	}
	applyGenericGroupPurchaseCost(channel.Id, entries, records)
	// Model existence and price availability are separate: a callable model
	// without a public price stays in the catalogue and must not be disabled
	// just because it produced no price record.
	if len(models) > 0 {
		if _, _, _, lifecycleErr := model.ApplyChannelLifecycleSnapshot(
			channel.Id, models, time.Now().Unix(), model.ChannelModelMissingDisableThreshold,
		); lifecycleErr != nil {
			common.SysError(common.LogText("generic channel lifecycle update failed: channel_id=%d, error=%v", channel.Id, lifecycleErr))
		}
	}
	return written, models, nil
}

// GenericUpstreamSyncTask refreshes generic New API channels on their official
// price cadence. Uter Route and Bailian keep their provider-specific tasks.
func GenericUpstreamSyncTask() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		runGenericUpstreamSync(context.Background(), false)
	}
}

func genericPrimaryPriceUSD(view model.ChannelOfficialPricing) (float64, bool) {
	if len(view.ChannelPriceTiers) > 0 {
		tier := view.ChannelPriceTiers[0]
		if tier.InputPerMillionUSD != nil {
			return *tier.InputPerMillionUSD, true
		}
		if tier.PerUnitUSD != nil {
			return *tier.PerUnitUSD, true
		}
	}
	if view.ChannelPrice != nil {
		if view.ChannelPrice.InputPerMillionUSD != nil {
			return *view.ChannelPrice.InputPerMillionUSD, true
		}
		if view.ChannelPrice.PerUnitUSD != nil {
			return *view.ChannelPrice.PerUnitUSD, true
		}
	}
	if len(view.Tiers) > 0 {
		if view.Tiers[0].InputPerMillionUSD != nil {
			return *view.Tiers[0].InputPerMillionUSD, true
		}
		if view.Tiers[0].PerUnitUSD != nil {
			return *view.Tiers[0].PerUnitUSD, true
		}
	}
	return 0, false
}

type genericPricePoint struct {
	price   float64
	version string
}

func genericChannelPriceSnapshot(channelID int) map[string]genericPricePoint {
	rows, err := model.ListChannelModelPricing(channelID)
	if err != nil {
		return nil
	}
	out := make(map[string]genericPricePoint, len(rows))
	for _, row := range rows {
		var view model.ChannelOfficialPricing
		if common.UnmarshalJsonStr(row.NormalizedPricing, &view) != nil {
			continue
		}
		if price, ok := genericPrimaryPriceUSD(view); ok && price > 0 {
			out[row.ModelName] = genericPricePoint{price: price, version: row.PricingVersion}
		}
	}
	return out
}

func genericPriceChanges(channelID int, before, after map[string]genericPricePoint, now time.Time) []UpstreamPriceChange {
	changes := make([]UpstreamPriceChange, 0)
	for name, newPoint := range after {
		oldPoint, ok := before[name]
		if !ok || oldPoint.price <= 0 || math.Abs(newPoint.price-oldPoint.price) < 1e-12 {
			continue
		}
		oldValue, newValue := oldPoint.price, newPoint.price
		changes = append(changes, UpstreamPriceChange{
			ProviderID: "newapi-compatible", ModelID: name,
			Kind: "price_changed", Field: "input_per_million_usd",
			Old: &oldValue, New: &newValue,
			OldText: oldPoint.version, NewText: newPoint.version,
			PricingVersion: newPoint.version, DetectedAt: now,
		})
	}
	sort.Slice(changes, func(i, j int) bool { return changes[i].ModelID < changes[j].ModelID })
	return changes
}

func runGenericUpstreamSync(ctx context.Context, force bool) {
	releaseLock, acquired, err := acquireUpstreamSyncLock(ctx, "generic-upstream")
	if err != nil || !acquired {
		return
	}
	defer releaseLock()
	channels, err := model.GetAllChannels(0, -1, true, true)
	if err != nil {
		return
	}
	now := time.Now().UTC()
	for _, channel := range channels {
		// Uter.ai / Uter.api / Uter Route are priced by their own catalog
		// sync tasks. Running the generic New API document sync over them
		// would write "newapi:/api/pricing" rows and leave two contradictory
		// price paths on the same channel. Bailian (type 17) has its own
		// deployment-pricing sync and is likewise excluded.
		if channel.Type == 17 || IsUterOwnedPricingChannel(channel.Type, channel.GetBaseURL()) {
			continue
		}
		schedule, explicit := GetChannelPricingSchedule(channel.Id)
		if explicit && !schedule.Enabled {
			continue
		}
		if !explicit {
			schedule.Enabled = true
			schedule.ApplyOnSync = true
		}
		_, officialInterval, _ := schedule.EffectiveIntervals()
		state := genericSyncStateFor(channel.Id)
		if !force && genericBackoffActive(channel.Id, now) {
			continue
		}
		if !force && now.Unix()-state < int64(officialInterval)*60 {
			continue
		}
		startedAt := now.Unix()
		before := genericChannelPriceSnapshot(channel.Id)
		written, syncErr := SyncGenericChannelPricing(ctx, channel)
		if syncErr != nil {
			common.SysError(common.LogText("generic upstream sync failed for channel %d: %s", channel.Id, syncErr.Error()))
			recordGenericSyncFailure(channel.Id, now)
			RecordChannelSyncOutcome(channel.Id, "newapi-compatible", startedAt, 0, 0, 0, 0, "", syncErr, model.ChannelSyncTypePrices)
			continue
		}
		changes := genericPriceChanges(channel.Id, before, genericChannelPriceSnapshot(channel.Id), now)
		if err := AppendGenericUpstreamHistory(changes); err != nil {
			common.SysError(common.LogText("append generic upstream history failed: channel_id=%d, error=%v", channel.Id, err))
		}
		var reviews []ChannelPricingReviewEntry
		if schedule.ReviewMode == "manual" || schedule.ThresholdPercent > 0 {
			reviews = BuildChannelPricingReviews(changes, channel.Id, channel.GetModels(), schedule.ThresholdPercent)
		}
		if len(reviews) > 0 {
			if reviewErr := AppendChannelPricingReviews(reviews); reviewErr != nil {
				common.SysError(common.LogText("append generic pricing reviews failed: channel_id=%d, error=%v", channel.Id, reviewErr))
			}
			// A change above the threshold must not be applied in the same run.
			RecordChannelSyncOutcome(channel.Id, "newapi-compatible", startedAt, 0, written, 0, len(reviews), "", nil, model.ChannelSyncTypePrices)
			setGenericSyncState(channel.Id, now.Unix())
			AutoVerifyChannelPricing(channel.Id)
			continue
		}
		applied := 0
		if schedule.ApplyOnSync && schedule.Mode != "" && schedule.Mode != BatchPricingModeNone {
			result, applyErr := ApplyChannelBatchPricingWithOptions(channel.Id, BatchPricingOptions{
				Basis: schedule.Basis, Mode: schedule.Mode, Value: schedule.Value,
			})
			if applyErr != nil {
				common.SysError(common.LogText("apply generic pricing schedule failed: channel_id=%d, error=%v", channel.Id, applyErr))
			} else {
				applied = result.Updated
			}
		}
		clearGenericSyncFailure(channel.Id)
		RecordChannelSyncOutcome(channel.Id, "newapi-compatible", startedAt, 0, written, applied, 0, "", nil, model.ChannelSyncTypePrices)
		setGenericSyncState(channel.Id, now.Unix())
		AutoVerifyChannelPricing(channel.Id)
	}
}

const genericUpstreamSyncStateKey = "GenericUpstreamSyncState"

func genericSyncStateFor(channelID int) int64 {
	raw := strings.TrimSpace(common.GetOption(genericUpstreamSyncStateKey))
	if raw == "" {
		return 0
	}
	var state map[string]int64
	if err := common.UnmarshalJsonStr(raw, &state); err != nil {
		return 0
	}
	return state[fmt.Sprintf("%d", channelID)]
}

func setGenericSyncState(channelID int, at int64) {
	state := map[string]int64{}
	if raw := strings.TrimSpace(common.GetOption(genericUpstreamSyncStateKey)); raw != "" {
		_ = common.UnmarshalJsonStr(raw, &state)
	}
	state[fmt.Sprintf("%d", channelID)] = at
	raw, err := common.Marshal(state)
	if err == nil {
		_ = model.UpdateOption(genericUpstreamSyncStateKey, string(raw))
	}
}

// applyGenericGroupPurchaseCost freezes the provider's group multiplier into a
// per-model expression purchase contract. It is opt-in: without a selected
// group the channel keeps no procurement cost and profit stays pending.
func applyGenericGroupPurchaseCost(channelID int, payload *GenericPricingPayload, records []model.ChannelOfficialPricingRecord) {
	group := GetGenericUpstreamBillingGroup(channelID)
	if group == "" || payload == nil {
		return
	}
	ratio := payload.GroupRatio[group]
	if math.IsNaN(ratio) || math.IsInf(ratio, 0) || ratio <= 0 {
		return
	}
	byName := make(map[string]GenericPricingEntry, len(payload.Data))
	for _, entry := range payload.Data {
		byName[strings.TrimSpace(entry.ModelName)] = entry
	}
	source := fmt.Sprintf("newapi:/api/pricing#group=%s", group)
	updatedAt := time.Now().Unix()
	for _, record := range records {
		entry, ok := byName[record.ModelName]
		if !ok || strings.TrimSpace(entry.BillingExpr) == "" {
			continue
		}
		if !NormalizeUpstreamExpression(entry.BillingExpr).Executable {
			continue
		}
		cost := model.ChannelPurchaseCost{
			Pricing: model.ChannelInternalPricing{
				Mode:        model.ChannelPricingModeTieredExpr,
				BillingExpr: fmt.Sprintf("(%s) * %s", strings.TrimSpace(entry.BillingExpr), strconv.FormatFloat(ratio, 'f', -1, 64)),
				Source:      source,
				UpdatedAt:   updatedAt,
			},
			Verified:  false,
			Source:    source,
			UpdatedAt: updatedAt,
		}
		identity := model.ChannelPricingIdentity{
			ChannelId: channelID, Provider: record.Provider, Region: record.Region,
			DeploymentId: record.DeploymentId, ModelName: record.ModelName,
		}
		if err := model.SetChannelPurchaseCostFor(identity, cost); err != nil {
			common.SysError(common.LogText("generic group purchase cost failed: channel_id=%d model=%s, error=%v", channelID, record.ModelName, err))
		}
	}
}

const genericUpstreamBackoffKey = "GenericUpstreamSyncBackoff"

type genericSyncBackoff struct {
	Failures    int   `json:"failures"`
	NextAttempt int64 `json:"next_attempt_at"`
}

func genericBackoffState() map[string]genericSyncBackoff {
	state := map[string]genericSyncBackoff{}
	if raw := strings.TrimSpace(common.GetOption(genericUpstreamBackoffKey)); raw != "" {
		_ = common.UnmarshalJsonStr(raw, &state)
	}
	return state
}

func genericBackoffActive(channelID int, now time.Time) bool {
	return genericBackoffState()[fmt.Sprintf("%d", channelID)].NextAttempt > now.Unix()
}

func recordGenericSyncFailure(channelID int, now time.Time) {
	state := genericBackoffState()
	entry := state[fmt.Sprintf("%d", channelID)]
	entry.Failures++
	backoff := time.Minute << min(entry.Failures-1, 6)
	if backoff > time.Hour {
		backoff = time.Hour
	}
	entry.NextAttempt = now.Add(backoff).Unix()
	state[fmt.Sprintf("%d", channelID)] = entry
	if raw, err := common.Marshal(state); err == nil {
		_ = model.UpdateOption(genericUpstreamBackoffKey, string(raw))
	}
}

func clearGenericSyncFailure(channelID int) {
	state := genericBackoffState()
	key := fmt.Sprintf("%d", channelID)
	if _, ok := state[key]; !ok {
		return
	}
	delete(state, key)
	if raw, err := common.Marshal(state); err == nil {
		_ = model.UpdateOption(genericUpstreamBackoffKey, string(raw))
	}
}
