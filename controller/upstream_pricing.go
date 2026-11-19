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

// GetUpstreamProviders lists the upstream catalog sources and capabilities.
func GetUpstreamProviders(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "data": service.UpstreamProviders()})
}

// SyncDreamRouterUpstream fetches DreamRouter's public pricing document into
// an isolated snapshot. It never writes ModelRatio, ModelPrice,
// billing_expr, or another channel's configuration.
//
// POST /api/upstream/dreamrouter/sync
func SyncDreamRouterUpstream(c *gin.Context) {
	var req struct {
		BaseURL       string `json:"base_url"`
		ChannelID     int    `json:"channel_id"`
		DiscountGroup string `json:"discount_group"`
	}
	_ = c.ShouldBindJSON(&req)

	var channelModels []string
	discountGroup := service.DreamRouterDiscountGroupDefault
	if req.ChannelID > 0 {
		channel, err := model.GetChannelById(req.ChannelID, true)
		if err != nil || channel == nil {
			common.ApiErrorMsg(c, "Channel not found")
			return
		}
		if strings.TrimSpace(req.BaseURL) == "" {
			req.BaseURL = channel.GetBaseURL()
		}
		baseURLs := strings.ToLower(channel.GetBaseURL() + " " + req.BaseURL)
		if !strings.Contains(baseURLs, "dreamrouter.ai") {
			common.ApiErrorMsg(c, "The selected channel Base URL is not dreamrouter.ai")
			return
		}
		channelModels = channel.GetModels()
		discountGroup = service.GetDreamRouterDiscountGroup(req.ChannelID)
		if strings.TrimSpace(req.DiscountGroup) != "" {
			discountGroup = strings.TrimSpace(req.DiscountGroup)
			if err := service.SetDreamRouterDiscountGroup(req.ChannelID, discountGroup); err != nil {
				common.ApiErrorMsg(c, err.Error())
				return
			}
		}
	}

	previous := service.LoadDreamRouterUpstreamSnapshot()
	snapshot, err := service.FetchDreamRouterUpstream(c.Request.Context(), req.BaseURL)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	var changes []service.UpstreamPriceChange
	// The first pull establishes the baseline; reporting 86 "model_added"
	// entries for it would only be noise.
	if previous != nil {
		changes = service.DiffDreamRouterUpstream(previous, snapshot)
		if err := service.AppendDreamRouterUpstreamHistory(snapshot.ProviderID, changes); err != nil {
			common.ApiErrorMsg(c, err.Error())
			return
		}
	}
	if err := service.SaveDreamRouterUpstreamSnapshot(snapshot); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	channelPricingWritten := 0
	if req.ChannelID > 0 {
		records, err := service.DreamRouterChannelPricingRecords(snapshot, req.ChannelID, channelModels, discountGroup)
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
	data := dreamRouterUpstreamSummary(snapshot)
	data["channel_id"] = req.ChannelID
	data["channel_pricing_written"] = channelPricingWritten
	data["discount_group"] = discountGroup
	data["discount_groups"] = service.DreamRouterDiscountGroups(snapshot)
	data["changes"] = len(changes)
	data["changes_preview"] = previewChanges(changes)
	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}

// GetDreamRouterUpstreamSnapshot returns the last isolated DreamRouter
// snapshot and its per-model records.
//
// GET /api/upstream/dreamrouter/snapshot
func GetDreamRouterUpstreamSnapshot(c *gin.Context) {
	snapshot := service.LoadDreamRouterUpstreamSnapshot()
	if snapshot == nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"synced": false}})
		return
	}
	channelID, _ := strconv.Atoi(c.Query("channel_id"))
	discountGroup := service.GetDreamRouterDiscountGroup(channelID)
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"synced":          true,
		"summary":         dreamRouterUpstreamSummary(snapshot),
		"models":          snapshot.Models,
		"discount_group":  discountGroup,
		"discount_groups": service.DreamRouterDiscountGroups(snapshot),
	}})
}

// GetDreamRouterUpstreamHistory returns the bounded change log.
func GetDreamRouterUpstreamHistory(c *gin.Context) {
	history := service.LoadDreamRouterUpstreamHistory()
	if history == nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"entries": []any{}}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": history})
}

func dreamRouterUpstreamSummary(snapshot *service.UpstreamSnapshot) gin.H {
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
