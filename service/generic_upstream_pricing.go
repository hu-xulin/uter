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
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
)

type GenericPricingEntry struct {
	ModelName        string   `json:"model_name"`
	QuotaType        int      `json:"quota_type"`
	ModelRatio       float64  `json:"model_ratio"`
	ModelPrice       float64  `json:"model_price"`
	CompletionRatio  float64  `json:"completion_ratio"`
	CacheRatio       float64  `json:"cache_ratio"`
	CreateCacheRatio float64  `json:"create_cache_ratio"`
	BillingMode      string   `json:"billing_mode"`
	BillingExpr      string   `json:"billing_expr"`
	OfficialPrice    *float64 `json:"official_price"`
	OfficialRatio    *float64 `json:"official_ratio"`
}

type GenericPricingPayload struct {
	Data []GenericPricingEntry `json:"data"`
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
		official, needsReview, reasons := genericOfficialPricing(entry, now.Unix())
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

func genericOfficialPricing(entry GenericPricingEntry, fetchedAt int64) (model.ChannelOfficialPricing, bool, []string) {
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
	// New API compatible pricing documents ratios against the standard
	// 500,000-quota-per-dollar unit, so one ratio unit is 2 USD per 1M tokens.
	const basisUSDPerMillion = 2.0
	input := ratio * basisUSDPerMillion
	tier := model.ChannelPricingTier{
		RangeName: "base", Unit: "per_1m_token", InputPerMillionUSD: &input,
	}
	basis := &model.ChannelRatioBasis{
		RawRatio:           ratio,
		RawCompletionRatio: entry.CompletionRatio,
		BasisUSDPerMillion: basisUSDPerMillion,
		Formula:            "usd_per_1m = ratio * basis_usd_per_million",
		FormulaVersion:     "newapi-ratio-v1",
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
	if channel == nil {
		return 0, errors.New("channel is required")
	}
	entries, err := FetchGenericUpstreamPricing(ctx, channel.GetBaseURL(), channel.GetKeys())
	if err != nil {
		return 0, err
	}
	if len(entries.Data) == 0 {
		return 0, errors.New("upstream returned no pricing entries")
	}
	records := GenericChannelPricingRecords(channel.Id, channel.GetModels(), entries.Data, time.Now().UTC())
	if len(records) == 0 {
		return 0, errors.New("no pricing entries matched the channel models")
	}
	written, err := model.UpsertChannelOfficialPricing(records)
	if err != nil {
		return written, err
	}
	seen := make([]string, 0, len(records))
	for _, record := range records {
		seen = append(seen, record.ModelName)
	}
	if len(seen) > 0 {
		if _, _, _, lifecycleErr := model.ApplyChannelLifecycleSnapshot(
			channel.Id, seen, time.Now().Unix(), model.ChannelModelMissingDisableThreshold,
		); lifecycleErr != nil {
			common.SysError(common.LogText("generic channel lifecycle update failed: channel_id=%d, error=%v", channel.Id, lifecycleErr))
		}
	}
	return written, nil
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
		if channel.Type == 17 || channel.Type == constant.ChannelTypeApiko || strings.Contains(strings.ToLower(channel.GetBaseURL()), "dreamrouter.ai") {
			continue
		}
		schedule, _ := GetChannelPricingSchedule(channel.Id)
		if !schedule.Enabled {
			continue
		}
		_, officialInterval, _ := schedule.EffectiveIntervals()
		state := genericSyncStateFor(channel.Id)
		if !force && now.Unix()-state < int64(officialInterval)*60 {
			continue
		}
		if _, err := SyncGenericChannelPricing(ctx, channel); err != nil {
			common.SysError(common.LogText("generic upstream sync failed for channel %d: %s", channel.Id, err.Error()))
			continue
		}
		setGenericSyncState(channel.Id, now.Unix())
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
