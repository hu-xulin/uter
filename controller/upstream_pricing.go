package controller

import (
	"fmt"
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

	// Even a one-off sync without a channel must target the deployment's
	// configured Uter Route endpoint. Otherwise a caller can point the parser
	// at an arbitrary host (including loopback) with no channel-level check.
	if strings.TrimSpace(req.BaseURL) != "" && !service.IsUterRouteEndpoint(req.BaseURL) {
		common.ApiErrorMsg(c, "The selected Base URL is not the configured Uter Route endpoint")
		return
	}
	releaseProcessLock, acquiredProcessLock := service.AcquireUterRouteUpstreamSyncProcessLock()
	if !acquiredProcessLock {
		common.ApiErrorMsg(c, service.ErrPricingSyncInProgress.Error())
		return
	}
	defer releaseProcessLock()

	// The process mutex alone cannot guard two gateway instances. The audit
	// history is a read-modify-write option, so a concurrent manual sync on
	// another instance would silently drop the other instance's change records.
	releaseInstanceLock, acquiredInstanceLock, lockErr := service.AcquireUterRouteUpstreamSyncLock(c.Request.Context())
	if lockErr != nil {
		common.ApiError(c, lockErr)
		return
	}
	if !acquiredInstanceLock {
		common.ApiErrorMsg(c, "Uter Route upstream sync is running on another instance")
		return
	}
	defer releaseInstanceLock()

	var channelModels []string
	var modelMapping string
	var targetChannel *model.Channel
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
			if service.IsUterRouteEndpoint(candidate) {
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
		targetChannel = channel
		channelModels = channel.GetModels()
		modelMapping = channel.GetModelMapping()
		discountGroup = service.GetUterRouteDiscountGroup(req.ChannelID)
	}

	previous := service.LoadUterRouteUpstreamSnapshot()
	snapshot, err := service.FetchUterRouteUpstream(c.Request.Context(), req.BaseURL)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	// Validate the requested discount group against the live snapshot before it
	// is persisted or used. A typo must not disable billing on every model and
	// then stick in the channel configuration.
	if requested := strings.TrimSpace(req.DiscountGroup); requested != "" {
		if !service.IsUterRouteDiscountGroup(snapshot, requested) {
			common.ApiErrorMsg(c, fmt.Sprintf("unknown Uter Route discount group %q", requested))
			return
		}
		discountGroup = requested
		if req.ChannelID > 0 {
			if err := service.SetUterRouteDiscountGroup(req.ChannelID, discountGroup); err != nil {
				common.ApiErrorMsg(c, err.Error())
				return
			}
		}
	}
	var changes []service.UpstreamPriceChange
	// The first pull establishes the baseline; reporting 86 "model_added"
	// entries for it would only be noise.
	if previous != nil {
		changes = service.DiffUterRouteUpstream(previous, snapshot)
	}
	channelPricingWritten := 0
	channelPricingRepriced := 0
	driftReviewCount := 0
	if targetChannel != nil {
		// The scheduled sync prunes models the upstream hides from its price
		// page. The manual panel sync used to keep them enabled and could write
		// price rows for models Uter does not publish.
		service.PruneHiddenUterRouteModels(targetChannel, snapshot.ExcludedModels)
		channelModels = targetChannel.GetModels()
		modelMapping = targetChannel.GetModelMapping()
		records, recordErr := service.UterRouteChannelPricingRecordsWithMapping(
			snapshot, targetChannel.Id, channelModels, discountGroup, modelMapping,
		)
		if recordErr != nil {
			common.ApiErrorMsg(c, recordErr.Error())
			return
		}
		// Second line of defence: UterRoute official prices are exempt from the
		// strict cross-check, so drift above the threshold is escalated to a
		// human review before the manual path applies any sale-price rule.
		driftReviews, driftErr := service.RecordUterRouteDriftReviews(
			previous, snapshot, targetChannel.Id, channelModels, modelMapping, 0,
		)
		if driftErr != nil {
			common.SysError(common.LogText("uterroute drift review failed: channel_id=%d error=%v", targetChannel.Id, driftErr))
		}
		written, repriced, upsertErr := service.UpsertUterRouteChannelPricingAndReprice(
			targetChannel.Id, channelModels, records,
		)
		if upsertErr != nil {
			common.ApiErrorMsg(c, upsertErr.Error())
			return
		}
		channelPricingWritten = written
		channelPricingRepriced = repriced
		driftReviewCount = driftReviews
	}
	// One transaction for snapshot + history removes the old half-state window
	// where a failed history write left changes invisible against a new snapshot.
	// Commit it only after channel rows are written: a failed upsert must leave
	// this revision in the diff baseline so the next sync can retry it.
	if err := service.CommitUterRouteSnapshotAndHistory(snapshot, changes); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	data := uterRouteUpstreamSummary(snapshot)
	data["channel_id"] = req.ChannelID
	data["channel_pricing_written"] = channelPricingWritten
	data["channel_pricing_repriced"] = channelPricingRepriced
	data["drift_reviews"] = driftReviewCount
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
