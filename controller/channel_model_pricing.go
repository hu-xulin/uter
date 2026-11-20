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

type channelUpstreamQuoteView struct {
	PriceBasis          string   `json:"price_basis"`
	Currency            string   `json:"currency"`
	Unit                string   `json:"unit"`
	InputPerMillionUSD  *float64 `json:"input_per_million_usd,omitempty"`
	OutputPerMillionUSD *float64 `json:"output_per_million_usd,omitempty"`
	CachePerMillionUSD  *float64 `json:"cache_per_million_usd,omitempty"`
	PerCallUSD          *float64 `json:"per_call_usd,omitempty"`
	Source              string   `json:"source"`
	DiscountGroup       string   `json:"discount_group,omitempty"`
	DiscountRatio       *float64 `json:"discount_ratio,omitempty"`
}

type channelModelPricingView struct {
	ChannelID      int                           `json:"channel_id"`
	ModelName      string                        `json:"model_name"`
	Provider       string                        `json:"provider"`
	Region         string                        `json:"region"`
	Currency       string                        `json:"currency"`
	PricingSource  string                        `json:"pricing_source"`
	PricingStatus  string                        `json:"pricing_status"`
	PricingVersion string                        `json:"pricing_version"`
	PriceShape     string                        `json:"price_shape,omitempty"`
	PriceSupported bool                          `json:"price_supported"`
	FetchedAt      int64                         `json:"fetched_at"`
	UpdatedAt      int64                         `json:"updated_at"`
	Official       *model.ChannelOfficialPricing `json:"official,omitempty"`
	UpstreamQuote  *channelUpstreamQuoteView     `json:"upstream_quote,omitempty"`
	Internal       *model.ChannelInternalPricing `json:"internal,omitempty"`
}

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
		ChannelID:      row.ChannelId,
		ModelName:      row.ModelName,
		Provider:       row.Provider,
		Region:         row.Region,
		Currency:       row.Currency,
		PricingSource:  row.PricingSource,
		PricingStatus:  row.PricingStatus,
		PricingVersion: row.PricingVersion,
		FetchedAt:      row.FetchedAt,
		UpdatedAt:      row.UpdatedAt,
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
	return view
}

// channelUpstreamQuote exposes the provider's purchase quote separately from
// the official list price. DreamRouter publishes ratios, so its quote is
// converted with Uter's documented ratio convention; absolute providers reuse
// the first normalized tier.
func channelUpstreamQuote(row model.ChannelModelPricing, official *model.ChannelOfficialPricing) *channelUpstreamQuoteView {
	if official != nil && official.ChannelPrice != nil {
		tier := official.ChannelPrice
		quote := &channelUpstreamQuoteView{
			PriceBasis:    "CHANNEL_DISCOUNT",
			Currency:      official.Currency,
			Unit:          tier.Unit,
			Source:        "dreamrouter-discount",
			DiscountGroup: official.DiscountGroup,
			DiscountRatio: official.DiscountRatio,
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
				return quote
			}
		}
	}
	if official == nil || len(official.Tiers) == 0 {
		return nil
	}
	tier := official.Tiers[0]
	quote := &channelUpstreamQuoteView{
		PriceBasis: "OFFICIAL_REFERENCE", Currency: official.Currency,
		Unit: tier.Unit, Source: official.Source,
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
	ModelName string                       `json:"model_name"`
	Pricing   model.ChannelInternalPricing `json:"pricing"`
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
		var oldPricing *model.ChannelInternalPricing
		if previous, err := model.GetChannelModelPricing(channelID, name); err == nil && strings.TrimSpace(previous.InternalPricing) != "" {
			var parsed model.ChannelInternalPricing
			if err := common.UnmarshalJsonStr(previous.InternalPricing, &parsed); err == nil {
				oldPricing = &parsed
			}
		}
		if err := model.SetChannelInternalPricing(channelID, name, row.Pricing); err != nil {
			skipped = append(skipped, channelPricingImportSkipped{ModelName: name, Reason: err.Error()})
			continue
		}
		pricing := row.Pricing
		if err := service.AppendChannelPricingHistory(service.ChannelPricingHistoryEntry{
			ChannelID: channelID, ModelName: name, Source: "import",
			OldPricing: oldPricing, NewPricing: &pricing,
		}); err != nil {
			common.SysError("append imported pricing history failed: " + err.Error())
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
		ModelName string                       `json:"model_name"`
		Pricing   model.ChannelInternalPricing `json:"pricing"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	var oldPricing *model.ChannelInternalPricing
	if previous, err := model.GetChannelModelPricing(channelID, req.ModelName); err == nil && strings.TrimSpace(previous.InternalPricing) != "" {
		var parsed model.ChannelInternalPricing
		if err := common.UnmarshalJsonStr(previous.InternalPricing, &parsed); err == nil {
			oldPricing = &parsed
		}
	}
	if err := model.SetChannelInternalPricing(channelID, req.ModelName, req.Pricing); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	row, err := model.GetChannelModelPricing(channelID, req.ModelName)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := service.AppendChannelPricingHistory(service.ChannelPricingHistoryEntry{
		ChannelID: channelID, ModelName: req.ModelName, Source: "manual",
		OldPricing: oldPricing, NewPricing: &req.Pricing,
	}); err != nil {
		common.SysError("append channel pricing history failed: " + err.Error())
	}
	common.ApiSuccess(c, channelModelPricingToView(*row))
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
		Dimensions []string `json:"dimensions"`
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
		Basis:            req.Basis, Mode: req.Mode, Value: req.Value, DryRun: req.DryRun,
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

	var currentPricing *model.ChannelInternalPricing
	if current, err := model.GetChannelModelPricing(channelID, entry.ModelName); err == nil && strings.TrimSpace(current.InternalPricing) != "" {
		var parsed model.ChannelInternalPricing
		if err := common.UnmarshalJsonStr(current.InternalPricing, &parsed); err == nil {
			currentPricing = &parsed
		}
	}
	restored := *entry.OldPricing
	if err := model.SetChannelInternalPricing(channelID, entry.ModelName, restored); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	if err := service.AppendChannelPricingHistory(service.ChannelPricingHistoryEntry{
		ChannelID: channelID, ModelName: entry.ModelName, Source: "rollback",
		OldPricing: currentPricing, NewPricing: &restored,
	}); err != nil {
		common.SysError("append rollback history failed: " + err.Error())
	}
	row, err := model.GetChannelModelPricing(channelID, entry.ModelName)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, channelModelPricingToView(*row))
}
