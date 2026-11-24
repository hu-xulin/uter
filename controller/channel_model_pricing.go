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
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
)

type channelUpstreamQuoteTier struct {
	RangeName                             string   `json:"range_name"`
	TimeBand                              string   `json:"time_band,omitempty"`
	MinInputTokens                        int64    `json:"min_input_tokens,omitempty"`
	MaxInputTokens                        int64    `json:"max_input_tokens,omitempty"`
	Unit                                  string   `json:"unit"`
	InputPerMillionUSD                    *model.Money `json:"input_per_million_usd,omitempty"`
	OutputPerMillionUSD                   *model.Money `json:"output_per_million_usd,omitempty"`
	CachePerMillionUSD                    *model.Money `json:"cache_per_million_usd,omitempty"`
	CreateCachePerMillionUSD              *model.Money `json:"create_cache_per_million_usd,omitempty"`
	ImageInputPerMillionUSD               *model.Money `json:"image_input_per_million_usd,omitempty"`
	ThinkingInputPerMillionUSD            *model.Money `json:"thinking_input_per_million_usd,omitempty"`
	ThinkingOutputPerMillionUSD           *model.Money `json:"thinking_output_per_million_usd,omitempty"`
	ThinkingCachePerMillionUSD            *model.Money `json:"thinking_cache_per_million_usd,omitempty"`
	ThinkingCreateCachePerMillionUSD      *model.Money `json:"thinking_create_cache_per_million_usd,omitempty"`
	ThinkingImageInputPerMillionUSD       *model.Money `json:"thinking_image_input_per_million_usd,omitempty"`
	MultiInputOutputPerMillionUSD         *model.Money `json:"multi_input_output_per_million_usd,omitempty"`
	ThinkingMultiInputOutputPerMillionUSD *model.Money `json:"thinking_multi_input_output_per_million_usd,omitempty"`
	AudioInputPerMillionUSD               *model.Money `json:"audio_input_per_million_usd,omitempty"`
	AudioOutputPerMillionUSD              *model.Money `json:"audio_output_per_million_usd,omitempty"`
	// PerUnitUSD is the amount for the tier's own unit (call, second, minute,
	// image). It is the canonical value; PerCallUSD stays populated only for
	// older clients that read every per-unit price from that field.
	PerUnitUSD    *model.Money                           `json:"per_unit_usd,omitempty"`
	PerCallUSD    *model.Money                           `json:"per_call_usd,omitempty"`
	RawComponents []model.ChannelPricingRawComponent `json:"raw_components,omitempty"`
}

type channelUpstreamQuoteView struct {
	PriceBasis                            string                     `json:"price_basis"`
	Currency                              string                     `json:"currency"`
	Unit                                  string                     `json:"unit"`
	InputPerMillionUSD                    *model.Money                   `json:"input_per_million_usd,omitempty"`
	OutputPerMillionUSD                   *model.Money                   `json:"output_per_million_usd,omitempty"`
	CachePerMillionUSD                    *model.Money                   `json:"cache_per_million_usd,omitempty"`
	CreateCachePerMillionUSD              *model.Money                   `json:"create_cache_per_million_usd,omitempty"`
	ImageInputPerMillionUSD               *model.Money                   `json:"image_input_per_million_usd,omitempty"`
	ThinkingInputPerMillionUSD            *model.Money                   `json:"thinking_input_per_million_usd,omitempty"`
	ThinkingOutputPerMillionUSD           *model.Money                   `json:"thinking_output_per_million_usd,omitempty"`
	ThinkingCachePerMillionUSD            *model.Money                   `json:"thinking_cache_per_million_usd,omitempty"`
	ThinkingCreateCachePerMillionUSD      *model.Money                   `json:"thinking_create_cache_per_million_usd,omitempty"`
	ThinkingImageInputPerMillionUSD       *model.Money                   `json:"thinking_image_input_per_million_usd,omitempty"`
	MultiInputOutputPerMillionUSD         *model.Money                   `json:"multi_input_output_per_million_usd,omitempty"`
	ThinkingMultiInputOutputPerMillionUSD *model.Money                   `json:"thinking_multi_input_output_per_million_usd,omitempty"`
	AudioInputPerMillionUSD               *model.Money                   `json:"audio_input_per_million_usd,omitempty"`
	AudioOutputPerMillionUSD              *model.Money                   `json:"audio_output_per_million_usd,omitempty"`
	PerUnitUSD                            *model.Money                   `json:"per_unit_usd,omitempty"`
	PerCallUSD                            *model.Money                   `json:"per_call_usd,omitempty"`
	Source                                string                     `json:"source"`
	DiscountGroup                         string                     `json:"discount_group,omitempty"`
	DiscountRatio                         *float64                   `json:"discount_ratio,omitempty"`
	Tiers                                 []channelUpstreamQuoteTier `json:"tiers,omitempty"`
}

type channelModelPricingView struct {
	ChannelID      int    `json:"channel_id"`
	ModelName      string `json:"model_name"`
	Provider       string `json:"provider"`
	ModelProvider  string `json:"model_provider,omitempty"`
	Region         string `json:"region"`
	DeploymentID   string `json:"deployment_id"`
	Currency       string `json:"currency"`
	PricingSource  string `json:"pricing_source"`
	PricingStatus  string `json:"pricing_status"`
	PricingVersion string `json:"pricing_version"`
	PriceShape     string `json:"price_shape,omitempty"`
	PriceSupported bool   `json:"price_supported"`
	FetchedAt      int64  `json:"fetched_at"`
	UpdatedAt      int64  `json:"updated_at"`
	// Stale marks an upstream price older than the official sync cadence, so
	// an operator does not treat yesterday's quote as current.
	Stale            bool                          `json:"stale"`
	FetchedAgeHours  int64                         `json:"fetched_age_hours"`
	LifecycleStatus  string                        `json:"lifecycle_status,omitempty"`
	LifecycleReason  string                        `json:"lifecycle_reason,omitempty"`
	LastSeenAt       int64                         `json:"last_seen_at,omitempty"`
	MissingSyncCount int                           `json:"missing_sync_count,omitempty"`
	Official         *model.ChannelOfficialPricing `json:"official,omitempty"`
	UpstreamQuote    *channelUpstreamQuoteView     `json:"upstream_quote,omitempty"`
	Internal         *model.ChannelInternalPricing `json:"internal,omitempty"`
	Purchase         *model.ChannelPurchaseCost    `json:"purchase,omitempty"`
}

// channelPricingStaleAfter is twice the default official sync interval: a
// price that misses one scheduled refresh is flagged, not hidden.
const channelPricingStaleAfter = 48 * time.Hour

// classifyOfficialPricingShape tells the UI whether the official price can be
// executed by the current billing engine. Storable but unexecutable shapes
// (multi-tier, per-second, per-image) must stay visibly unsupported.

// floatMoneyPtr converts a float64 price from an upstream record into the
// exact Money pointer carried by the pricing JSON view. Nil stays nil.
func floatMoneyPtr(value *float64) *model.Money {
	if value == nil {
		return nil
	}
	m := model.MoneyFromFloat(*value)
	return &m
}


func classifyOfficialPricingShape(official *model.ChannelOfficialPricing) (string, bool) {
	if official == nil || len(official.Tiers) == 0 {
		return "", false
	}
	if len(official.Tiers) > 1 {
		return "multi_tier", false
	}
	tier := official.Tiers[0]
	switch tier.Unit {
	case "per_1m_token":
		return "per_1m_token", tier.InputPerMillionUSD != nil
	case "per_call":
		return "per_call", tier.PerUnitUSD != nil
	case "per_second":
		return "per_second", false
	case "per_image":
		// A per-image price is a fixed amount per request, which the per-call
		// billing mode can execute without flattening a duration-dependent price.
		return "per_image", tier.PerUnitUSD != nil
	default:
		if tier.InputPerMillionUSD != nil {
			return "per_1m_token", true
		}
		if tier.PerUnitUSD != nil {
			return "per_call", true
		}
		return tier.Unit, false
	}
}

func channelModelPricingToView(row model.ChannelModelPricing) channelModelPricingView {
	view := channelModelPricingView{
		ChannelID:        row.ChannelId,
		ModelName:        row.ModelName,
		Provider:         row.Provider,
		Region:           row.Region,
		DeploymentID:     row.DeploymentId,
		Currency:         row.Currency,
		PricingSource:    row.PricingSource,
		PricingStatus:    row.PricingStatus,
		PricingVersion:   row.PricingVersion,
		FetchedAt:        row.FetchedAt,
		UpdatedAt:        row.UpdatedAt,
		LifecycleStatus:  row.LifecycleStatus,
		LifecycleReason:  row.LifecycleReason,
		LastSeenAt:       row.LastSeenAt,
		MissingSyncCount: row.MissingSyncCount,
	}
	if row.FetchedAt > 0 {
		age := time.Since(time.Unix(row.FetchedAt, 0))
		view.FetchedAgeHours = int64(age / time.Hour)
		view.Stale = age > channelPricingStaleAfter
	}
	if strings.TrimSpace(row.NormalizedPricing) != "" {
		var official model.ChannelOfficialPricing
		if err := common.UnmarshalJsonStr(row.NormalizedPricing, &official); err == nil {
			view.Official = &official
			view.PriceShape, view.PriceSupported = classifyOfficialPricingShape(&official)
		}
	}
	view.UpstreamQuote = channelUpstreamQuote(row, view.Official)
	if strings.TrimSpace(row.InternalPricing) != "" {
		var internal model.ChannelInternalPricing
		if err := common.UnmarshalJsonStr(row.InternalPricing, &internal); err == nil {
			view.Internal = &internal
		}
	}
	view.Purchase = model.ParseChannelPurchaseCost(row.PurchasePricing)
	return view
}

// channelUpstreamQuote 把上游采购报价与官方标价分开暴露。
// 已解析出的权威官方 tier（来自 normalized_pricing）始终优先；
// 只有不存在该 tier 时，才按 Uter 既有约定用 ratio 推导 Uter Route 报价，
// 或复用绝对供应商的第一个 tier。
func channelUpstreamQuote(row model.ChannelModelPricing, official *model.ChannelOfficialPricing) *channelUpstreamQuoteView {
	if official != nil {
		switch {
		case len(official.ChannelPriceTiers) > 0:
			quote := quoteFromTier(official.ChannelPriceTiers[0], "CHANNEL_CATALOG", official.Source, nil)
			quote.Tiers = make([]channelUpstreamQuoteTier, 0, len(official.ChannelPriceTiers))
			for _, tier := range official.ChannelPriceTiers {
				quote.Tiers = append(quote.Tiers, quoteTierFromTier(tier))
			}
			return quote
		case official.ChannelPrice != nil:
			quote := &channelUpstreamQuoteView{
				PriceBasis:    "CHANNEL_DISCOUNT",
				Currency:      official.Currency,
				Unit:          official.ChannelPrice.Unit,
				Source:        "uterroute-discount",
				DiscountGroup: official.DiscountGroup,
				DiscountRatio: official.DiscountRatio,
			}
			tier := *official.ChannelPrice
			switch tier.Unit {
			case "per_call", "per_second", "per_image", "per_minute":
				quote.PerCallUSD = tier.PerUnitUSD
			default:
				quote.InputPerMillionUSD = tier.InputPerMillionUSD
				quote.OutputPerMillionUSD = tier.OutputPerMillionUSD
				quote.CachePerMillionUSD = tier.CachePerMillionUSD
			}
			return quote
		}
	}
	// 仅当没有权威的已解析官方 tier 时才从 ratio 推导。
	// needs_review 的 Uter Route 行可能同时带有过时的 model_ratio 与
	// billing_expr 解析价，此时 ratio 不得遮蔽解析价。
	if (official == nil || len(official.Tiers) == 0) &&
		row.Provider == "uterroute" && strings.TrimSpace(row.OfficialPricing) != "" {
		var record service.UpstreamModelRecord
		if err := common.UnmarshalJsonStr(row.OfficialPricing, &record); err == nil {
			quote := &channelUpstreamQuoteView{
				PriceBasis: "DERIVED_FROM_RATIOS", Currency: "USD",
				Source: "uterroute-official",
			}
			if record.QuotaType == 1 && record.ModelPrice != nil && *record.ModelPrice > 0 {
				quote.Unit = "per_call"
				quote.PerCallUSD = floatMoneyPtr(record.ModelPrice)
				quote.Tiers = []channelUpstreamQuoteTier{{Unit: "per_call", PerCallUSD: floatMoneyPtr(record.ModelPrice)}}
				return quote
			}
			if record.ModelRatio != nil && *record.ModelRatio > 0 {
				input := *record.ModelRatio * 2
				quote.Unit = "per_1m_token"
				quote.InputPerMillionUSD = floatMoneyPtr(&input)
				if record.CompletionRatio != nil && *record.CompletionRatio > 0 {
					output := input * *record.CompletionRatio
					quote.OutputPerMillionUSD = floatMoneyPtr(&output)
				}
				if record.CacheRatio != nil && *record.CacheRatio > 0 {
					cache := input * *record.CacheRatio
					quote.CachePerMillionUSD = floatMoneyPtr(&cache)
				}
				quote.Tiers = []channelUpstreamQuoteTier{quoteTierFromTier(model.ChannelPricingTier{
					Unit: "per_1m_token", InputPerMillionUSD: quote.InputPerMillionUSD,
					OutputPerMillionUSD: quote.OutputPerMillionUSD, CachePerMillionUSD: quote.CachePerMillionUSD,
				})}
				return quote
			}
		}
	}
	if official == nil || len(official.Tiers) == 0 {
		return nil
	}
	return quoteFromTier(official.Tiers[0], "OFFICIAL_REFERENCE", official.Source, nil)
}

func quoteTierFromTier(tier model.ChannelPricingTier) channelUpstreamQuoteTier {
	item := channelUpstreamQuoteTier{
		RangeName: tier.RangeName, TimeBand: tier.TimeBand,
		MinInputTokens: tier.MinInputTokens, MaxInputTokens: tier.MaxInputTokens,
		Unit: tier.Unit, RawComponents: tier.RawComponents,
	}
	switch tier.Unit {
	case "per_call", "per_second", "per_image", "per_minute":
		item.PerUnitUSD = tier.PerUnitUSD
		item.PerCallUSD = tier.PerUnitUSD
	default:
		item.InputPerMillionUSD = tier.InputPerMillionUSD
		item.OutputPerMillionUSD = tier.OutputPerMillionUSD
		item.CachePerMillionUSD = tier.CachePerMillionUSD
		item.CreateCachePerMillionUSD = tier.CreateCachePerMillionUSD
		item.ImageInputPerMillionUSD = tier.ImageInputPerMillionUSD
		item.ThinkingInputPerMillionUSD = tier.ThinkingInputPerMillionUSD
		item.ThinkingOutputPerMillionUSD = tier.ThinkingOutputPerMillionUSD
		item.ThinkingCachePerMillionUSD = tier.ThinkingCachePerMillionUSD
		item.ThinkingCreateCachePerMillionUSD = tier.ThinkingCreateCachePerMillionUSD
		item.ThinkingImageInputPerMillionUSD = tier.ThinkingImageInputPerMillionUSD
		item.MultiInputOutputPerMillionUSD = tier.MultiInputOutputPerMillionUSD
		item.ThinkingMultiInputOutputPerMillionUSD = tier.ThinkingMultiInputOutputPerMillionUSD
		item.AudioInputPerMillionUSD = tier.AudioInputPerMillionUSD
		item.AudioOutputPerMillionUSD = tier.AudioOutputPerMillionUSD
	}
	return item
}

func quoteFromTier(tier model.ChannelPricingTier, basis, source string, discount *float64) *channelUpstreamQuoteView {
	quote := &channelUpstreamQuoteView{
		PriceBasis: basis, Currency: "USD",
		Unit: tier.Unit, Source: source, DiscountRatio: discount,
		Tiers: []channelUpstreamQuoteTier{quoteTierFromTier(tier)},
	}
	switch tier.Unit {
	case "per_call", "per_second", "per_image", "per_minute":
		quote.PerUnitUSD = tier.PerUnitUSD
		quote.PerCallUSD = tier.PerUnitUSD
	default:
		quote.InputPerMillionUSD = tier.InputPerMillionUSD
		quote.OutputPerMillionUSD = tier.OutputPerMillionUSD
		quote.CachePerMillionUSD = tier.CachePerMillionUSD
		quote.CreateCachePerMillionUSD = tier.CreateCachePerMillionUSD
		quote.ImageInputPerMillionUSD = tier.ImageInputPerMillionUSD
		quote.ThinkingInputPerMillionUSD = tier.ThinkingInputPerMillionUSD
		quote.ThinkingOutputPerMillionUSD = tier.ThinkingOutputPerMillionUSD
		quote.ThinkingCachePerMillionUSD = tier.ThinkingCachePerMillionUSD
		quote.ThinkingCreateCachePerMillionUSD = tier.ThinkingCreateCachePerMillionUSD
		quote.ThinkingImageInputPerMillionUSD = tier.ThinkingImageInputPerMillionUSD
		quote.MultiInputOutputPerMillionUSD = tier.MultiInputOutputPerMillionUSD
		quote.ThinkingMultiInputOutputPerMillionUSD = tier.ThinkingMultiInputOutputPerMillionUSD
		quote.AudioInputPerMillionUSD = tier.AudioInputPerMillionUSD
		quote.AudioOutputPerMillionUSD = tier.AudioOutputPerMillionUSD
	}
	return quote
}

// GetChannelModelPricing lists one channel's isolated price records.
type channelPricingImportRow struct {
	ModelName    string                       `json:"model_name"`
	Provider     string                       `json:"provider"`
	Region       string                       `json:"region"`
	DeploymentID string                       `json:"deployment_id"`
	Pricing      model.ChannelInternalPricing `json:"pricing"`
}

type channelPricingImportSkipped struct {
	ModelName string `json:"model_name"`
	Reason    string `json:"reason"`
}

// ImportChannelModelPricing imports operator-provided sale prices. The dry-run
// mode validates every row without writing so a CSV/JSON import can be checked
// before it changes billing.
// POST /api/channel/:id/model_pricing/import
func ImportChannelModelPricing(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelID <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	var req struct {
		DryRun bool                      `json:"dry_run"`
		Rows   []channelPricingImportRow `json:"rows"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	imported := make([]string, 0, len(req.Rows))
	skipped := make([]channelPricingImportSkipped, 0)
	for _, row := range req.Rows {
		name := strings.TrimSpace(row.ModelName)
		if name == "" {
			skipped = append(skipped, channelPricingImportSkipped{Reason: "model name is required"})
			continue
		}
		row.Pricing.UpdatedAt = time.Now().Unix()
		if _, err := model.NormalizeChannelInternalPricing(&row.Pricing); err != nil {
			skipped = append(skipped, channelPricingImportSkipped{ModelName: name, Reason: err.Error()})
			continue
		}
		if req.DryRun {
			imported = append(imported, name)
			continue
		}
		identity := model.ChannelPricingIdentity{
			ChannelId: channelID, Provider: row.Provider, Region: row.Region,
			DeploymentId: row.DeploymentID, ModelName: name,
		}
		var oldPricing *model.ChannelInternalPricing
		if previous, err := model.GetChannelModelPricingFor(identity); err == nil && strings.TrimSpace(previous.InternalPricing) != "" {
			var parsed model.ChannelInternalPricing
			if err := common.UnmarshalJsonStr(previous.InternalPricing, &parsed); err == nil {
				oldPricing = &parsed
			}
		}
		if err := service.SetChannelPricingWithHistory(identity, row.Pricing, "import", "", oldPricing); err != nil {
			skipped = append(skipped, channelPricingImportSkipped{ModelName: name, Reason: err.Error()})
			continue
		}
		imported = append(imported, name)
	}
	common.ApiSuccess(c, gin.H{
		"channel_id": channelID,
		"dry_run":    req.DryRun,
		"imported":   imported,
		"skipped":    skipped,
	})
}

func GetChannelModelPricing(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelID <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	rows, err := model.ListChannelModelPricing(channelID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	views := make([]channelModelPricingView, 0, len(rows))
	for _, row := range rows {
		views = append(views, channelModelPricingToView(row))
	}
	common.ApiSuccess(c, gin.H{"channel_id": channelID, "items": views})
}

// SetChannelModelPricing saves the operator's internal sale price for one
// channel model. Official data is never modified by this endpoint.
func SetChannelModelPricing(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelID <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	var req struct {
		ModelName    string                       `json:"model_name"`
		Provider     string                       `json:"provider"`
		Region       string                       `json:"region"`
		DeploymentID string                       `json:"deployment_id"`
		Pricing      model.ChannelInternalPricing `json:"pricing"`
		// Purchase replaces the stored contract cost when present. It is kept
		// apart from the sale price and never derived from the public quote.
		Purchase *model.ChannelPurchaseCost `json:"purchase,omitempty"`
		// ClearPurchase removes a stored contract cost when the operator
		// explicitly deletes it.
		ClearPurchase bool `json:"purchase_clear,omitempty"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	identity := model.ChannelPricingIdentity{
		ChannelId: channelID, Provider: req.Provider, Region: req.Region,
		DeploymentId: req.DeploymentID, ModelName: req.ModelName,
	}
	var oldPricing *model.ChannelInternalPricing
	if previous, err := model.GetChannelModelPricingFor(identity); err == nil && strings.TrimSpace(previous.InternalPricing) != "" {
		var parsed model.ChannelInternalPricing
		if err := common.UnmarshalJsonStr(previous.InternalPricing, &parsed); err == nil {
			oldPricing = &parsed
		}
	}
	if err := service.SetChannelPricingWithHistory(identity, req.Pricing, "manual", "", oldPricing); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	if req.Purchase != nil {
		if err := model.SetChannelPurchaseCostFor(identity, *req.Purchase); err != nil {
			common.ApiErrorMsg(c, err.Error())
			return
		}
	} else if req.ClearPurchase {
		if err := model.ClearChannelPurchaseCostFor(identity); err != nil {
			common.ApiErrorMsg(c, err.Error())
			return
		}
	}
	row, err := model.GetChannelModelPricingFor(identity)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, channelModelPricingToView(*row))
}

// GetChannelBillingSnapshots lists the immutable price contracts recent
// requests and tasks were billed with, for reconciliation and support.
func GetChannelBillingSnapshots(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelID <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	rows, err := model.ListBillingPriceSnapshots(channelID, limit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"channel_id": channelID, "items": rows})
}

// GetChannelPricingHistory lists recent internal price changes for one channel.
func GetChannelPricingHistory(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelID <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	common.ApiSuccess(c, gin.H{"channel_id": channelID, "items": service.ListChannelPricingHistory(channelID)})
}

// BatchChannelModelPricing previews or applies one multiplier to a channel's
// model prices. Official and channel bases stay separate; ratio-only upstreams
// are not presented as official USD prices.
func BatchChannelModelPricing(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelID <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	var req struct {
		Models          []string `json:"models"`
		ModelPrefixes   []string `json:"model_prefixes"`
		ModelCategories []string `json:"model_categories"`
		Providers       []string `json:"providers"`
		Regions         []string `json:"regions"`
		Deployments     []string `json:"deployments"`
		PricingSources  []string `json:"pricing_sources"`
		Modes           []string `json:"modes"`
		TierRules       []struct {
			RangeName string  `json:"range_name"`
			TimeBand  string  `json:"time_band"`
			Mode      string  `json:"mode"`
			Value     float64 `json:"value"`
		} `json:"tier_rules"`
		Basis           string  `json:"basis"`
		Mode            string  `json:"mode"`
		Value           float64 `json:"value"`
		Factor          float64 `json:"factor"`
		DryRun          bool    `json:"dry_run"`
		OverwriteManual bool    `json:"overwrite_manual"`
		// Versions carries the per-model PricingVersion returned by a preview
		// so an apply cannot mix in rows that changed since then.
		Versions map[string]string `json:"versions"`
		// Dimensions restricts the rule to specific price dimensions.
		Dimensions     []string `json:"dimensions"`
		MinMarginRate  *float64 `json:"min_margin_rate"`
		ProtectionMode string   `json:"protection_mode"`
		ApprovalNote   string   `json:"approval_note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Mode == "" && req.Factor > 0 {
		req.Mode = service.BatchPricingModeMultiply
		req.Value = req.Factor
	}
	result, err := service.ApplyChannelBatchPricingWithOptions(channelID, service.BatchPricingOptions{
		Models: req.Models, ModelPrefixes: req.ModelPrefixes,
		ModelCategories: req.ModelCategories, OverwriteManual: req.OverwriteManual,
		Providers: req.Providers, Regions: req.Regions, Deployments: req.Deployments,
		PricingSources: req.PricingSources, Modes: req.Modes,
		TierRules:        batchTierRulesFromRequest(req.TierRules),
		ExpectedVersions: req.Versions,
		Dimensions:       req.Dimensions,
		MinMarginRate:    req.MinMarginRate, ProtectionMode: req.ProtectionMode,
		ApprovalNote: req.ApprovalNote,
		Basis:        req.Basis, Mode: req.Mode, Value: req.Value, DryRun: req.DryRun,
	})
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, result)
}

// batchTierRulesFromRequest converts the wire shape into the service rule type.
func batchTierRulesFromRequest(rules []struct {
	RangeName string  `json:"range_name"`
	TimeBand  string  `json:"time_band"`
	Mode      string  `json:"mode"`
	Value     float64 `json:"value"`
}) []service.BatchTierRule {
	if len(rules) == 0 {
		return nil
	}
	out := make([]service.BatchTierRule, 0, len(rules))
	for _, rule := range rules {
		out = append(out, service.BatchTierRule{
			RangeName: rule.RangeName, TimeBand: rule.TimeBand, Mode: rule.Mode, Value: rule.Value,
		})
	}
	return out
}

// GetChannelPricingSchedule returns a channel's post-sync pricing rule.
func GetChannelPricingSchedule(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelID <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	schedule, ok := service.GetChannelPricingSchedule(channelID)
	common.ApiSuccess(c, gin.H{"channel_id": channelID, "enabled": ok, "schedule": schedule})
}

// SetChannelPricingSchedule stores a channel's post-sync pricing rule.
func SetChannelPricingSchedule(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelID <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	var schedule service.ChannelPricingSchedule
	if err := c.ShouldBindJSON(&schedule); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := service.SetChannelPricingSchedule(channelID, schedule); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, gin.H{"channel_id": channelID, "schedule": schedule})
}

// GetChannelSyncStates reports the last model and price sync for one channel,
// so a catalogue success with a price failure is visible separately.
func GetChannelSyncStates(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelID <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	states, err := model.ListChannelSyncStates(channelID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"channel_id": channelID, "items": states})
}

// GetChannelPricingReviews lists pending manual-review entries.
func GetChannelPricingReviews(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelID <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	status := strings.TrimSpace(c.Query("status"))
	common.ApiSuccess(c, gin.H{
		"channel_id": channelID,
		"status":     status,
		"items":      service.ListChannelPricingReviewsByStatus(channelID, status),
	})
}

// SyncGenericChannelPricing pulls a New API compatible /api/pricing document
// on demand. Without this, a custom channel could only be refreshed by enabling
// a background schedule.
func SyncGenericChannelPricing(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelID <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	channel, err := model.GetChannelById(channelID, true)
	if err != nil || channel == nil {
		common.ApiErrorT(c, "Channel not found")
		return
	}
	if strings.TrimSpace(channel.GetBaseURL()) == "" {
		common.ApiErrorMsg(c, "Channel base URL is required")
		return
	}
	var req struct {
		// ApplyModels imports the catalogue model ids into the channel. It is
		// opt-in so a price refresh never silently enables new models.
		ApplyModels bool `json:"apply_models"`
	}
	_ = c.ShouldBindJSON(&req)

	startedAt := time.Now().Unix()
	written, discovered, syncErr := service.SyncGenericChannelPricingWithModels(c.Request.Context(), channel)
	provider := service.UpstreamProviderForChannel(channel.Type, channel.GetBaseURL()).ID
	summary := ""
	if syncErr == nil {
		summary = fmt.Sprintf(`{"written":%d,"models":%d}`, written, len(discovered))
	}
	service.RecordChannelSyncOutcome(channel.Id, provider, startedAt, len(discovered), written, 0, 0, summary, syncErr, model.ChannelSyncTypePrices)
	if syncErr != nil {
		common.ApiErrorMsg(c, syncErr.Error())
		return
	}

	applied := 0
	if req.ApplyModels && len(discovered) > 0 {
		added, addErr := service.AppendChannelModelNames(channel, discovered)
		if addErr != nil {
			common.ApiError(c, addErr)
			return
		}
		applied = added
	}
	common.ApiSuccess(c, gin.H{
		"channel_id": channelID, "written": written,
		"models": discovered, "models_added": applied,
	})
}

// GetGenericUpstreamBillingGroup reports the upstream group used for
// procurement cost. An empty group means cost is not derived.
func GetGenericUpstreamBillingGroup(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelID <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	common.ApiSuccess(c, gin.H{"channel_id": channelID, "group": service.GetGenericUpstreamBillingGroup(channelID)})
}

// SetGenericUpstreamBillingGroup selects (or clears) the upstream group whose
// published ratio becomes the channel's expression purchase cost.
func SetGenericUpstreamBillingGroup(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelID <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	var req struct {
		Group string `json:"group"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := service.SetGenericUpstreamBillingGroup(channelID, req.Group); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"channel_id": channelID, "group": service.GetGenericUpstreamBillingGroup(channelID)})
}

// ApproveChannelPricingReviews clears pending entries and applies the saved
// schedule rule to the channel's models.
func ApproveChannelPricingReviews(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelID <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	schedule, ok := service.GetChannelPricingSchedule(channelID)
	if !ok || !schedule.Enabled {
		common.ApiErrorMsg(c, "No enabled pricing schedule for this channel")
		return
	}
	var req struct {
		Note string `json:"note"`
	}
	_ = c.ShouldBindJSON(&req)
	if err := service.ValidateChannelPricingReviewsCurrent(channelID); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	result, err := service.ApplyChannelBatchPricing(channelID, nil, schedule.Basis, schedule.Mode, schedule.Value, false)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	decided, err := service.DecideChannelPricingReviews(
		channelID, model.ChannelPricingReviewStatusApproved,
		c.GetInt("id"), c.GetString("username"), strings.TrimSpace(req.Note),
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"channel_id": channelID, "updated": result.Updated, "reviewed": decided})
}

// RejectChannelPricingReviews clears pending entries without changing prices.
func RejectChannelPricingReviews(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelID <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	var req struct {
		Note string `json:"note"`
	}
	_ = c.ShouldBindJSON(&req)
	decided, err := service.DecideChannelPricingReviews(
		channelID, model.ChannelPricingReviewStatusRejected,
		c.GetInt("id"), c.GetString("username"), strings.TrimSpace(req.Note),
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"channel_id": channelID, "reviewed": decided})
}

// RollbackChannelPricingHistory restores the previous internal sale price
// recorded by one history entry. The rollback itself creates a new history row
// instead of rewriting the past.
func RollbackChannelPricingHistory(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelID <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	historyID, err := service.ParseHistoryID(c.Param("history_id"))
	if err != nil || historyID <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	entry, err := service.GetChannelPricingHistoryEntry(historyID)
	if err != nil || entry == nil || entry.ChannelID != channelID {
		common.ApiErrorMsg(c, "History entry not found for this channel")
		return
	}
	if entry.OldPricing == nil {
		common.ApiErrorMsg(c, "History entry has no previous price to restore")
		return
	}

	identity := model.ChannelPricingIdentity{
		ChannelId: channelID, Provider: entry.Provider, Region: entry.Region,
		DeploymentId: entry.DeploymentId, ModelName: entry.ModelName,
	}
	var currentPricing *model.ChannelInternalPricing
	expectedVersion := ""
	if current, err := model.GetChannelModelPricingFor(identity); err == nil {
		expectedVersion = current.PricingVersion
		if strings.TrimSpace(current.InternalPricing) != "" {
			var parsed model.ChannelInternalPricing
			if err := common.UnmarshalJsonStr(current.InternalPricing, &parsed); err == nil {
				currentPricing = &parsed
			}
		}
	}
	restored := *entry.OldPricing
	if err := service.SetChannelPricingWithHistory(identity, restored, "rollback", expectedVersion, currentPricing); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	row, err := model.GetChannelModelPricingFor(identity)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, channelModelPricingToView(*row))
}

// SeedChannelModelPricing adopts synced official prices as internal sale prices.
// This is explicit: catalog sync itself never creates a billable price.
func SeedChannelModelPricing(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelID <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	var req struct {
		Models    []string `json:"models"`
		Overwrite bool     `json:"overwrite"`
	}
	_ = c.ShouldBindJSON(&req)
	seeded, skipped, err := service.SeedBailianInternalPricing(channelID, req.Models, req.Overwrite)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, gin.H{
		"channel_id": channelID,
		"seeded":     seeded,
		"skipped":    skipped,
	})
}
