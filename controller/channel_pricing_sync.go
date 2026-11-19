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
package controller

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting/custom_pricing"
)

type upstreamPricingEntry struct {
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

type upstreamPricingResponse struct {
	Data []upstreamPricingEntry `json:"data"`
}

// SyncChannelPricing imports the model price sheet a new-api compatible
// upstream exposes at /api/pricing. It writes channel quotes only; channel and
// model discounts remain operator policy.
func SyncChannelPricing(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	channel, err := model.GetChannelById(id, true)
	if err != nil || channel == nil {
		common.ApiErrorT(c, "Channel not found")
		return
	}
	baseURL := ""
	if channel.BaseURL != nil {
		baseURL = strings.TrimSpace(*channel.BaseURL)
	}
	if baseURL == "" {
		common.ApiErrorT(c, "Channel base URL is required for pricing sync")
		return
	}
	baseURL = strings.TrimRight(baseURL, "/")
	baseURL = strings.TrimSuffix(baseURL, "/v1")
	if !strings.Contains(baseURL, "://") {
		baseURL = "https://" + baseURL
	}
	endpoint := baseURL + "/api/pricing"
	parsedURL, err := url.Parse(endpoint)
	if err != nil || parsedURL.Host == "" || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") {
		common.ApiErrorT(c, "Invalid channel base URL")
		return
	}
	keys := channel.GetKeys()
	if len(keys) == 0 {
		common.ApiErrorT(c, "Channel key is required for pricing sync")
		return
	}

	payload, err := fetchUpstreamPricing(c.Request.Context(), endpoint, keys)
	if err != nil {
		common.ApiErrorT(c, "Upstream pricing request failed: {{error}}", map[string]any{"error": err.Error()})
		return
	}
	if len(payload.Data) == 0 {
		common.ApiErrorT(c, "Upstream returned no pricing entries")
		return
	}

	next, imported := mergeChannelQuotes(
		custom_pricing.GetChannelPriceSetting(), id, payload.Data, time.Now().Unix(),
	)
	encoded, err := common.Marshal(next)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.UpdateOption(custom_pricing.ChannelPriceOptionKey, string(encoded)); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"channel_id": id,
		"imported":   imported,
		"quotes":     next.Channels[strconv.Itoa(id)].Quotes,
		"enabled":    next.Enabled,
	})
}

// mergeChannelQuotes replaces one channel's quote sheet while preserving the
// global switch and every other channel's policy, including this channel's
// operator-set ratio and per-model rules.
func mergeChannelQuotes(
	previous *custom_pricing.ChannelPriceSetting,
	id int,
	entries []upstreamPricingEntry,
	now int64,
) (custom_pricing.ChannelPriceSetting, int) {
	next := custom_pricing.ChannelPriceSetting{Channels: map[string]custom_pricing.ChannelPriceConfig{}}
	if previous != nil {
		next.Enabled = previous.Enabled
		for key, cfg := range previous.Channels {
			next.Channels[key] = cfg
		}
	}
	key := strconv.Itoa(id)
	config := next.Channels[key]
	config.Enabled = true
	if config.Quotes == nil {
		config.Quotes = map[string]custom_pricing.ChannelQuote{}
	}
	imported := 0
	for _, item := range entries {
		name := strings.TrimSpace(item.ModelName)
		if name == "" {
			continue
		}
		quote := custom_pricing.ChannelQuote{
			Unit:             "per_1m_token",
			CompletionRatio:  floatPtr(item.CompletionRatio),
			CacheRatio:       floatPtr(item.CacheRatio),
			CreateCacheRatio: floatPtr(item.CreateCacheRatio),
			BillingMode:      item.BillingMode,
			BillingExpr:      item.BillingExpr,
			Raw:              fmt.Sprintf("quota_type=%d model_ratio=%.8g model_price=%.8g", item.QuotaType, item.ModelRatio, item.ModelPrice),
			Source:           "newapi:/api/pricing",
			UpdatedAt:        now,
		}
		if item.QuotaType == 1 {
			quote.Unit = "per_call"
			quote.ChannelPrice = floatPtr(item.ModelPrice)
		} else {
			quote.ChannelPrice = floatPtr(item.ModelRatio * 2)
		}
		if item.BillingMode != "" || item.BillingExpr != "" {
			// A tiered/expression price cannot be represented as one amount.
			// Keep it visible for review but never let it drive billing.
			quote.Status = custom_pricing.ChannelQuoteStatusNeedsReview
		}
		if item.OfficialPrice != nil {
			quote.OfficialPrice = item.OfficialPrice
		} else if item.OfficialRatio != nil {
			quote.OfficialPrice = floatPtr(*item.OfficialRatio * 2)
		}
		config.Quotes[name] = quote
		imported++
	}
	next.Channels[key] = config
	return next, imported
}

// fetchUpstreamPricing tries channel keys in order so one exhausted key does
// not block the sync. Only the first successful JSON response is used.
func fetchUpstreamPricing(ctx context.Context, endpoint string, keys []string) (*upstreamPricingResponse, error) {
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
		res, err := newPricingSyncHTTPClient().Do(req)
		if err != nil {
			cancel()
			lastErr = err
			continue
		}
		status := res.StatusCode
		if status < http.StatusOK || status >= http.StatusMultipleChoices {
			res.Body.Close()
			cancel()
			lastErr = fmt.Errorf("status %d", status)
			continue
		}
		body, err := io.ReadAll(io.LimitReader(res.Body, 8<<20))
		res.Body.Close()
		cancel()
		if err != nil {
			lastErr = err
			continue
		}
		var payload upstreamPricingResponse
		if err := common.Unmarshal(body, &payload); err != nil {
			lastErr = fmt.Errorf("invalid JSON response")
			continue
		}
		return &payload, nil
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("no usable channel key")
	}
	return nil, lastErr
}

func floatPtr(value float64) *float64 {
	return &value
}

func newPricingSyncHTTPClient() *http.Client {
	return &http.Client{
		Timeout: 20 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
}
