package controller

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
)

// SyncUterRouteUpstream fetches UterRoute's public pricing document into
// an isolated snapshot. It never writes ModelRatio, ModelPrice,
// billing_expr, or another channel's configuration.
//
// POST /api/upstream/uterroute/sync
func SyncUterRouteUpstream(c *gin.Context) {
	var req struct {
		BaseURL       string `json:"base_url"`
		ChannelID     int    `json:"channel_id"`
		DiscountGroup string `json:"discount_group"`
	}
	_ = c.ShouldBindJSON(&req)

	var channelModels []string
	var modelMapping string
	discountGroup := service.UterRouteDiscountGroupDefault
	if req.ChannelID > 0 {
		channel, err := model.GetChannelById(req.ChannelID, true)
		if err != nil || channel == nil {
			common.ApiErrorMsg(c, "Channel not found")
			return
		}
		if strings.TrimSpace(req.BaseURL) == "" {
			req.BaseURL = channel.GetBaseURL()
		}
		baseURLs := []string{channel.GetBaseURL()}
		if strings.TrimSpace(req.BaseURL) != "" {
			baseURLs = append(baseURLs, req.BaseURL)
		}
		matched := false
		for _, candidate := range baseURLs {
			if service.IsUterRouteHost(candidate) {
				matched = true
				break
			}
		}
		if !matched {
			common.ApiErrorMsg(c, "The selected channel Base URL is not the configured Uter Route endpoint")
			return
		}
		release, acquired, lockErr := service.AcquireChannelPricingSyncLock(req.ChannelID)
		if lockErr != nil {
			common.ApiError(c, lockErr)
			return
		}
		if !acquired {
			common.ApiErrorMsg(c, service.ErrPricingSyncInProgress.Error())
			return
		}
		defer release()
		channelModels = channel.GetModels()
		modelMapping = channel.GetModelMapping()
		discountGroup = service.GetUterRouteDiscountGroup(req.ChannelID)
		if strings.TrimSpace(req.DiscountGroup) != "" {
			discountGroup = strings.TrimSpace(req.DiscountGroup)
			if err := service.SetUterRouteDiscountGroup(req.ChannelID, discountGroup); err != nil {
				common.ApiErrorMsg(c, err.Error())
				return
			}
		}
	}

	previous := service.LoadUterRouteUpstreamSnapshot()
	snapshot, err := service.FetchUterRouteUpstream(c.Request.Context(), req.BaseURL)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	var changes []service.UpstreamPriceChange
	// The first pull establishes the baseline; reporting 86 "model_added"
	// entries for it would only be noise.
	if previous != nil {
		changes = service.DiffUterRouteUpstream(previous, snapshot)
		if err := service.AppendUterRouteUpstreamHistory(snapshot.ProviderID, changes); err != nil {
			common.ApiErrorMsg(c, err.Error())
			return
		}
	}
	if err := service.SaveUterRouteUpstreamSnapshot(snapshot); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	channelPricingWritten := 0
	if req.ChannelID > 0 {
		records, err := service.UterRouteChannelPricingRecordsWithMapping(
			snapshot, req.ChannelID, channelModels, discountGroup, modelMapping,
		)
		if err != nil {
			common.ApiErrorMsg(c, err.Error())
			return
		}
		written, err := model.UpsertChannelOfficialPricing(records)
		if err != nil {
			common.ApiErrorMsg(c, err.Error())
			return
		}
		channelPricingWritten = written
	}
	data := uterRouteUpstreamSummary(snapshot)
	data["channel_id"] = req.ChannelID
	data["channel_pricing_written"] = channelPricingWritten
	data["discount_group"] = discountGroup
	data["discount_groups"] = service.UterRouteDiscountGroups(snapshot)
	data["changes"] = len(changes)
	data["changes_preview"] = previewChanges(changes)
	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}

// GetUterRouteUpstreamSnapshot returns the last isolated UterRoute
// snapshot and its per-model records.
//
// GET /api/upstream/uterroute/snapshot
func GetUterRouteUpstreamSnapshot(c *gin.Context) {
	snapshot := service.LoadUterRouteUpstreamSnapshot()
	if snapshot == nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"synced": false}})
		return
	}
	channelID, _ := strconv.Atoi(c.Query("channel_id"))
	discountGroup := service.GetUterRouteDiscountGroup(channelID)
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"synced":          true,
		"summary":         uterRouteUpstreamSummary(snapshot),
		"models":          snapshot.Models,
		"discount_group":  discountGroup,
		"discount_groups": service.UterRouteDiscountGroups(snapshot),
	}})
}

func uterRouteUpstreamSummary(snapshot *service.UpstreamSnapshot) gin.H {
	return gin.H{
		"provider_id":       snapshot.ProviderID,
		"fetched_at":        snapshot.FetchedAt.Format(time.RFC3339),
		"pricing_version":   snapshot.PricingVersion,
		"source_endpoint":   snapshot.SourceEndpoint,
		"price_basis":       snapshot.PriceBasis,
		"models":            len(snapshot.Models),
		"groups":            len(snapshot.GroupRatio),
		"group_overrides":   len(snapshot.GroupGroupRatio),
		"auto_groups":       len(snapshot.AutoGroups),
		"official_prices":   "AVAILABLE_OR_DERIVED",
		"discounted_prices": "RATIO_DERIVED",
	}
}

func previewChanges(changes []service.UpstreamPriceChange) []service.UpstreamPriceChange {
	const limit = 20
	if len(changes) <= limit {
		return changes
	}
	return changes[:limit]
}

// GetUterRouteEndpoint returns the configured operational endpoint so the admin
// console can recognise Uter Route channels without hardcoding a supplier host.
func GetUterRouteEndpoint(c *gin.Context) {
	common.ApiSuccess(c, gin.H{
		"base_url": service.UterRouteUpstreamBaseURL(),
		"host":     service.UterRouteUpstreamHost(),
	})
}
