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
	"strconv"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
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
// channel ({"<channel id>": "<group>"}). The group only affects procurement
// cost, never the sale price.
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
// rows. Official and provider ratios are preserved; internal sale prices are
// never written here.
func GenericChannelPricingRecords(
	channelID int,
	channelModels []string,
	entries []GenericPricingEntry,
	now time.Time,
) []model.ChannelOfficialPricingRecord {
	return GenericChannelPricingRecordsWithQuota(channelID, channelModels, entries, now, 0)
}

// GenericChannelPricingRecordsWithQuota also applies a document-level
// quota_per_unit when an entry does not carry its own basis.
func GenericChannelPricingRecordsWithQuota(
	channelID int,
	channelModels []string,
	entries []GenericPricingEntry,
	now time.Time,
	quotaPerUnit float64,
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
func genericExpressionInternalPricing(entry GenericPricingEntry, updatedAt int64) string {
	expr := NormalizeUpstreamExpression(entry.BillingExpr)
	if !expr.Executable {
		return ""
	}
	encoded, err := common.Marshal(model.ChannelInternalPricing{
		Mode:        model.ChannelPricingModeTieredExpr,
		BillingExpr: expr.Raw,
		Source:      "newapi-expression",
		UpdatedAt:   updatedAt,
	})
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
	entries, err := FetchGenericUpstreamPricing(ctx, channel.GetBaseURL(), channel.GetKeys())
	if err != nil {
		return 0, nil, err
	}
	if len(entries.Data) == 0 {
		return 0, nil, errors.New("upstream returned no pricing entries")
	}
	models := GenericModelNames(entries.Data)
	if _, addErr := AppendChannelModelNames(channel, models); addErr != nil {
		common.SysError(common.LogText("generic auto model add failed: channel_id=%d, error=%v", channel.Id, addErr))
	}
	records := GenericChannelPricingRecordsWithQuota(
		channel.Id, channel.GetModels(), entries.Data, time.Now().UTC(),
		genericQuotaPerUnit(GenericPricingEntry{}, entries),
	)
	if len(records) == 0 {
		return 0, models, errors.New("no pricing entries matched the channel models")
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
// price cadence. DreamRouter and Bailian keep their provider-specific tasks.
func GenericUpstreamSyncTask() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		runGenericUpstreamSync(context.Background(), false)
	}
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
		if channel.Type == 17 || strings.Contains(strings.ToLower(channel.GetBaseURL()), "dreamrouter.ai") {
			continue
		}
		schedule, explicit := GetChannelPricingSchedule(channel.Id)
		if explicit && !schedule.Enabled {
			continue
		}
		if !explicit {
			schedule.Enabled = true
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
		written, syncErr := SyncGenericChannelPricing(ctx, channel)
		if syncErr != nil {
			common.SysError(common.LogText("generic upstream sync failed for channel %d: %s", channel.Id, syncErr.Error()))
			recordGenericSyncFailure(channel.Id, now)
			RecordChannelSyncOutcome(channel.Id, "newapi-compatible", startedAt, 0, 0, 0, 0, "", syncErr, model.ChannelSyncTypePrices)
			continue
		}
		clearGenericSyncFailure(channel.Id)
		RecordChannelSyncOutcome(channel.Id, "newapi-compatible", startedAt, 0, written, 0, 0, "", nil, model.ChannelSyncTypePrices)
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
