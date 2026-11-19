package controller

import (
	"context"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
)

type bailianCatalogSummary struct {
	Synced          bool     `json:"synced"`
	FetchedAt       string   `json:"fetched_at,omitempty"`
	BaseURL         string   `json:"base_url,omitempty"`
	Total           int      `json:"total"`
	ChannelID       int      `json:"channel_id,omitempty"`
	ChannelName     string   `json:"channel_name,omitempty"`
	ChannelModels   int      `json:"channel_models"`
	MatchedModels   int      `json:"matched_models"`
	UnmatchedModels []string `json:"unmatched_models"`
}

// RefreshBailianCatalog pulls all pages of GET /api/v1/models for one Bailian
// channel and stores the result as a reference snapshot. It deliberately does
// not write any model price; applying the catalog is a separate, explicit step.
func RefreshBailianCatalog(c *gin.Context) {
	var req struct {
		ChannelID int `json:"channel_id"`
	}
	_ = c.ShouldBindJSON(&req)
	channel, err := resolveBailianChannel(req.ChannelID)
	if err != nil || channel == nil {
		common.ApiErrorMsg(c, "Bailian channel not found")
		return
	}
	channelID := channel.Id
	key, _, apiErr := channel.GetNextEnabledKey()
	if apiErr != nil {
		common.ApiErrorMsg(c, "Bailian channel has no enabled API key")
		return
	}

	catalog, err := service.FetchBailianCatalog(c.Request.Context(), channel.GetBaseURL(), strings.TrimSpace(key))
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	catalog.ChannelID = channelID
	catalog.Region = service.BailianRegionOf(channel.GetBaseURL())
	catalog.ReferencePrice = service.NormalizeBailianPrices(catalog)
	if err := service.SaveBailianCatalogSnapshot(catalog); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": buildBailianCatalogSummary(catalog)})
}

// resolveBailianChannel returns the requested channel or the first enabled
// Alibaba channel. Channel IDs are not stable across rebuilds, so the default
// must not be hard-coded.
func resolveBailianChannel(channelID int) (*model.Channel, error) {
	if channelID > 0 {
		channel, err := model.GetChannelById(channelID, true)
		if err != nil || channel == nil {
			return nil, err
		}
		if channel.Type != constant.ChannelTypeAli {
			return nil, nil
		}
		return channel, nil
	}
	channels, err := model.GetAllChannels(0, 1000, true, true)
	if err != nil {
		return nil, err
	}
	var fallback *model.Channel
	for _, channel := range channels {
		if channel.Type != constant.ChannelTypeAli {
			continue
		}
		if channel.Status == 1 {
			return channel, nil
		}
		if fallback == nil {
			fallback = channel
		}
	}
	return fallback, nil
}

func buildBailianCatalogSummary(catalog *service.BailianCatalog) bailianCatalogSummary {
	summary := bailianCatalogSummary{
		Synced:          true,
		FetchedAt:       catalog.FetchedAt.Format("2006-01-02T15:04:05Z07:00"),
		BaseURL:         catalog.BaseURL,
		Total:           len(catalog.Models),
		ChannelID:       catalog.ChannelID,
		UnmatchedModels: []string{},
	}
	if catalog.ChannelID <= 0 {
		return summary
	}
	channel, err := model.GetChannelById(catalog.ChannelID, true)
	if err != nil || channel == nil {
		return summary
	}
	summary.ChannelName = channel.Name
	priced := make(map[string]struct{}, len(catalog.Models))
	for _, item := range catalog.Models {
		if len(item.Prices) > 0 {
			priced[item.Model] = struct{}{}
		}
	}
	channelModels := channel.GetModels()
	summary.ChannelModels = len(channelModels)
	for _, name := range channelModels {
		if _, ok := priced[name]; ok {
			summary.MatchedModels++
			continue
		}
		summary.UnmatchedModels = append(summary.UnmatchedModels, name)
	}
	sort.Strings(summary.UnmatchedModels)
	return summary
}

// ApplyBailianCatalog fills metadata for the channel's actual models from the
// saved official snapshot. It never adds catalog-only models to the channel
// and never writes billing prices.
func ApplyBailianCatalog(c *gin.Context) {
	var req struct {
		ChannelID int `json:"channel_id"`
	}
	_ = c.ShouldBindJSON(&req)
	channel, err := resolveBailianChannel(req.ChannelID)
	if err != nil || channel == nil {
		common.ApiErrorMsg(c, "Bailian channel not found")
		return
	}
	catalog := service.LoadBailianCatalogSnapshotForChannel(channel.Id)
	if catalog == nil {
		common.ApiErrorMsg(c, "Bailian catalog has not been synced yet")
		return
	}
	catalog.ChannelID = channel.Id
	result, err := service.ApplyBailianCatalog(catalog, channel.GetModels())
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	pricingRecords, pricingErr := applyBailianChannelPricing(catalog, channel.GetModels())
	if pricingErr != nil {
		common.SysError("persist bailian channel pricing: " + pricingErr.Error())
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"apply":           result,
		"pricing_records": pricingRecords,
		"pricing_error":   errorText(pricingErr),
	}})
}

// GetBailianSyncStatus returns the last automatic post-create sync result.
func GetBailianSyncStatus(c *gin.Context) {
	status := service.LoadBailianSyncStatus()
	scheduled := service.LoadBailianUpstreamSyncStatus()
	if status == nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
			"synced": false, "scheduled": scheduled,
		}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"post_create": status, "scheduled": scheduled,
	}})
}

// syncBailianAfterCreate runs after an Alibaba channel is created. Every step
// is independent and fail-soft: a catalog outage must not fail the channel that
// has already been persisted, and a later manual retry converges.
func syncBailianAfterCreate(channelID int) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	status := &service.BailianSyncStatus{
		ChannelID: channelID,
		StartedAt: time.Now().UTC(),
		Steps:     map[string]service.BailianSyncStep{},
	}
	mark := func(name, state, message string) {
		status.Steps[name] = service.BailianSyncStep{Status: state, Message: message, Finished: time.Now().UTC()}
	}
	defer func() {
		status.FinishedAt = time.Now().UTC()
		if err := service.SaveBailianSyncStatus(status); err != nil {
			common.SysError("save bailian sync status: " + err.Error())
		}
	}()

	channel, err := model.GetChannelById(channelID, true)
	if err != nil || channel == nil {
		mark("channel", "failed", "channel not found")
		return
	}

	if discovered, err := fetchChannelUpstreamModelIDs(channel); err != nil {
		mark("discover_models", "failed", err.Error())
	} else if len(discovered) > 0 {
		channel.Models = strings.Join(discovered, ",")
		if err := channel.Update(); err != nil {
			mark("discover_models", "failed", err.Error())
		} else {
			model.InitChannelCache()
			status.ActualModels = len(discovered)
			mark("discover_models", "ok", "")
		}
	} else {
		mark("discover_models", "ok", "no models returned")
	}

	key, _, apiErr := channel.GetNextEnabledKey()
	if apiErr != nil {
		mark("fetch_catalog", "failed", "no enabled API key")
		return
	}
	catalog, err := service.FetchBailianCatalog(ctx, channel.GetBaseURL(), strings.TrimSpace(key))
	if err != nil {
		mark("fetch_catalog", "failed", err.Error())
		return
	}
	catalog.ChannelID = channelID
	catalog.Region = service.BailianRegionOf(channel.GetBaseURL())
	catalog.ReferencePrice = service.NormalizeBailianPrices(catalog)
	if err := service.SaveBailianCatalogSnapshot(catalog); err != nil {
		mark("fetch_catalog", "failed", err.Error())
		return
	}
	status.CatalogModels = len(catalog.Models)
	status.ReferencePrices = len(catalog.ReferencePrice)
	mark("fetch_catalog", "ok", "")

	result, err := service.ApplyBailianCatalog(catalog, channel.GetModels())
	if err != nil {
		mark("apply_metadata", "failed", err.Error())
		return
	}
	if records, pricingErr := applyBailianChannelPricing(catalog, channel.GetModels()); pricingErr != nil {
		mark("apply_prices", "failed", pricingErr.Error())
	} else {
		status.PricingRecords = records
		mark("apply_prices", "ok", "")
	}
	status.MatchedModels = result.MatchedModels
	status.UnmatchedModels = result.UnmatchedModels
	if result.Metadata != nil {
		status.MetadataCreated = len(result.Metadata.CreatedModels)
		status.MetadataUpdated = len(result.Metadata.UpdatedModels)
	}
	mark("apply_metadata", "ok", "")
}

func errorText(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

// applyBailianChannelPricing persists official data into the channel-isolated
// pricing table. It never writes the operator's internal sale price.
func applyBailianChannelPricing(catalog *service.BailianCatalog, channelModels []string) (int, error) {
	records := service.BailianPricingRecords(catalog, channelModels)
	return model.UpsertChannelOfficialPricing(records)
}

// GetBailianCatalog returns the last saved official catalog snapshot.
func GetBailianCatalog(c *gin.Context) {
	catalog := service.LoadBailianCatalogSnapshot()
	if catalog == nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"synced": false}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"summary": buildBailianCatalogSummary(catalog),
		"models":  catalog.Models,
	}})
}
