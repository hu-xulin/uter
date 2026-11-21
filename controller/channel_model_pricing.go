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
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
)

type channelUpstreamQuoteTier struct {
	RangeName           string                             `json:"range_name"`
	TimeBand            string                             `json:"time_band,omitempty"`
	MinInputTokens      int64                              `json:"min_input_tokens,omitempty"`
	MaxInputTokens      int64                              `json:"max_input_tokens,omitempty"`
	Unit                string                             `json:"unit"`
	InputPerMillionUSD  *float64                           `json:"input_per_million_usd,omitempty"`
	OutputPerMillionUSD *float64                           `json:"output_per_million_usd,omitempty"`
	CachePerMillionUSD  *float64                           `json:"cache_per_million_usd,omitempty"`
	PerCallUSD          *float64                           `json:"per_call_usd,omitempty"`
	RawComponents       []model.ChannelPricingRawComponent `json:"raw_components,omitempty"`
}

type channelUpstreamQuoteView struct {
	PriceBasis          string                     `json:"price_basis"`
	Currency            string                     `json:"currency"`
	Unit                string                     `json:"unit"`
	InputPerMillionUSD  *float64                   `json:"input_per_million_usd,omitempty"`
	OutputPerMillionUSD *float64                   `json:"output_per_million_usd,omitempty"`
	CachePerMillionUSD  *float64                   `json:"cache_per_million_usd,omitempty"`
	PerCallUSD          *float64                   `json:"per_call_usd,omitempty"`
	Source              string                     `json:"source"`
	DiscountGroup       string                     `json:"discount_group,omitempty"`
	DiscountRatio       *float64                   `json:"discount_ratio,omitempty"`
	Tiers               []channelUpstreamQuoteTier `json:"tiers,omitempty"`
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

// channelUpstreamQuote exposes the provider's purchase quote separately from
// the official list price. DreamRouter publishes ratios, so its quote is
// converted with Uter's documented ratio convention; absolute providers reuse
// the first normalized tier.
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
				Source:        "dreamrouter-discount",
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
	if row.Provider == "dreamrouter" && strings.TrimSpace(row.OfficialPricing) != "" {
		var record service.UpstreamModelRecord
		if err := common.UnmarshalJsonStr(row.OfficialPricing, &record); err == nil {
			quote := &channelUpstreamQuoteView{
				PriceBasis: "DERIVED_FROM_RATIOS", Currency: "USD",
				Source: "dreamrouter-official",
			}
			if record.QuotaType == 1 && record.ModelPrice != nil && *record.ModelPrice > 0 {
				quote.Unit = "per_call"
				quote.PerCallUSD = record.ModelPrice
				quote.Tiers = []channelUpstreamQuoteTier{{Unit: "per_call", PerCallUSD: record.ModelPrice}}
				return quote
			}
			if record.ModelRatio != nil && *record.ModelRatio > 0 {
				input := *record.ModelRatio * 2
				quote.Unit = "per_1m_token"
				quote.InputPerMillionUSD = &input
				if record.CompletionRatio != nil && *record.CompletionRatio > 0 {
					output := input * *record.CompletionRatio
					quote.OutputPerMillionUSD = &output
				}
				if record.CacheRatio != nil && *record.CacheRatio > 0 {
					cache := input * *record.CacheRatio
					quote.CachePerMillionUSD = &cache
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
		item.PerCallUSD = tier.PerUnitUSD
	default:
		item.InputPerMillionUSD = tier.InputPerMillionUSD
		item.OutputPerMillionUSD = tier.OutputPerMillionUSD
		item.CachePerMillionUSD = tier.CachePerMillionUSD
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
		quote.PerCallUSD = tier.PerUnitUSD
	default:
		quote.InputPerMillionUSD = tier.InputPerMillionUSD
		quote.OutputPerMillionUSD = tier.OutputPerMillionUSD
		quote.CachePerMillionUSD = tier.CachePerMillionUSD
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
		Basis           string   `json:"basis"`
		Mode            string   `json:"mode"`
		Value           float64  `json:"value"`
		Factor          float64  `json:"factor"`
		DryRun          bool     `json:"dry_run"`
		OverwriteManual bool     `json:"overwrite_manual"`
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

// GetChannelPricingReviews lists pending manual-review entries.
func GetChannelPricingReviews(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelID <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	common.ApiSuccess(c, gin.H{
		"channel_id": channelID,
		"items":      service.ListChannelPricingReviews(channelID),
	})
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
	result, err := service.ApplyChannelBatchPricing(channelID, nil, schedule.Basis, schedule.Mode, schedule.Value, false)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	if err := service.ClearChannelPricingReviews(channelID); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"channel_id": channelID, "updated": result.Updated})
}

// RejectChannelPricingReviews clears pending entries without changing prices.
func RejectChannelPricingReviews(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelID <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	if err := service.ClearChannelPricingReviews(channelID); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"channel_id": channelID})
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
