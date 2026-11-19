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

	"github.com/gin-gonic/gin"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
)

type channelModelPricingView struct {
	ChannelID      int                           `json:"channel_id"`
	ModelName      string                        `json:"model_name"`
	Provider       string                        `json:"provider"`
	Region         string                        `json:"region"`
	Currency       string                        `json:"currency"`
	PricingSource  string                        `json:"pricing_source"`
	PricingStatus  string                        `json:"pricing_status"`
	PricingVersion string                        `json:"pricing_version"`
	FetchedAt      int64                         `json:"fetched_at"`
	UpdatedAt      int64                         `json:"updated_at"`
	Official       *model.ChannelOfficialPricing `json:"official,omitempty"`
	Internal       *model.ChannelInternalPricing `json:"internal,omitempty"`
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
		}
	}
	if strings.TrimSpace(row.InternalPricing) != "" {
		var internal model.ChannelInternalPricing
		if err := common.UnmarshalJsonStr(row.InternalPricing, &internal); err == nil {
			view.Internal = &internal
		}
	}
	return view
}

// GetChannelModelPricing lists one channel's isolated price records.
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
		Models        []string `json:"models"`
		ModelPrefixes []string `json:"model_prefixes"`
		Basis         string   `json:"basis"`
		Mode          string   `json:"mode"`
		Value         float64  `json:"value"`
		Factor        float64  `json:"factor"`
		DryRun        bool     `json:"dry_run"`
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
		Basis: req.Basis, Mode: req.Mode, Value: req.Value, DryRun: req.DryRun,
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
