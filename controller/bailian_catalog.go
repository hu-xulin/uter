package controller

import (
	"context"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
)

// bailianIncludeCatalogModelsKey controls whether the official model catalog
// is merged into a Bailian channel's selectable model list. It is on by default
// so every model the console market publishes (including happyhorse) appears
// in the channel; set it to "false" to keep the old workspace-only list.
const bailianIncludeCatalogModelsKey = "BailianIncludeCatalogModels"

// bailianCatalogModelsEnabled reports whether catalog-only models should be
// merged into the channel's model list. Default on; only an explicit "false"
// disables it.
func bailianCatalogModelsEnabled() bool {
	return bailianCatalogModelsEnabledFrom(common.GetOption(bailianIncludeCatalogModelsKey))
}

// bailianCatalogModelsEnabledFrom is the pure switch predicate, kept separate
// from option-store access so it can be unit-tested without a database.
func bailianCatalogModelsEnabledFrom(value string) bool {
	value = strings.TrimSpace(value)
	return value == "" || !strings.EqualFold(value, "false")
}

// bailianMergedModelNames computes the catalog-merged model list without any
// database access. It preserves every local (workspace) model, appends
// catalog-only names, dedups, and reports whether anything changed.
func bailianMergedModelNames(localModels []string, catalog *service.BailianCatalog) (merged []string, changed bool) {
	if catalog == nil {
		return localModels, false
	}
	catalogNames := make([]string, 0, len(catalog.Models))
	for _, item := range catalog.Models {
		name := strings.TrimSpace(item.Model)
		if name != "" {
			catalogNames = append(catalogNames, name)
		}
	}
	if len(catalogNames) == 0 {
		return localModels, false
	}
	merged = mergeModelNames(localModels, catalogNames)
	return merged, len(merged) != len(localModels)
}

// bailianModelsAfterDiscovery merges freshly discovered workspace models into
// the operator-specified model list. The post-create discovery pass must never
// replace channel.Models: operators add task-plugin models (happyhorse/wan) and
// third-party aliases that the workspace catalog does not return, and dropping
// them would make those models silently unrouteable. Pure helper so the merge
// contract is testable without a live workspace endpoint.
func bailianModelsAfterDiscovery(operatorModels, discovered []string) (merged []string, changed bool) {
	merged = mergeModelNames(operatorModels, discovered)
	return merged, len(merged) != len(operatorModels)
}

// mergeBailianCatalogModels merges the official catalog model names into the
// channel's model list so console-market models are selectable. It is
// idempotent (mergeModelNames dedups), never removes a workspace model, and
// reports whether the channel was changed. When the option is off it is a
// no-op.
func mergeBailianCatalogModels(channel *model.Channel, catalog *service.BailianCatalog) (bool, error) {
	if channel == nil || !bailianCatalogModelsEnabled() {
		return false, nil
	}
	local := channel.GetModels()
	merged, changed := bailianMergedModelNames(local, catalog)
	if !changed {
		return false, nil
	}
	channel.Models = strings.Join(merged, ",")
	if err := channel.Update(); err != nil {
		return false, err
	}
	model.InitChannelCache()
	return true, nil
}

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
	if err := service.ApplyBailianOfficialPricingPage(c.Request.Context(), catalog); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	catalog.ReferencePrice = service.NormalizeBailianPrices(catalog)
	if err := service.SaveBailianCatalogSnapshot(catalog); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	// Make every catalog model selectable on this channel. Idempotent; a no-op
	// when BailianIncludeCatalogModels is explicitly disabled.
	if _, mergeErr := mergeBailianCatalogModels(channel, catalog); mergeErr != nil {
		common.SysError("merge bailian catalog models: " + mergeErr.Error())
	}
	// Keep the status panel in sync with the manual refresh. The UI invalidates
	// `bailian-sync-status` after this action and reads its counts from there;
	// without this update the panel kept showing the stale post-create result.
	channelModels := channel.GetModels()
	// One matcher for every reported count. Exact-name loops here used to
	// disagree with the summary and apply steps for cmaas- prefixed, scoped
	// and dated model spellings.
	matched := service.BailianSeenChannelModels(catalog, channelModels)
	_ = service.UpdateBailianSyncStatus(channelID, func(status *service.BailianSyncStatus) {
		status.ActualModels = len(channelModels)
		status.CatalogModels = len(catalog.Models)
		status.MatchedModels = len(matched)
		status.ReferencePrices = len(catalog.ReferencePrice)
		status.Steps["fetch_catalog"] = service.BailianSyncStep{
			Status: "ok", Finished: time.Now().UTC(),
		}
	})
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
	channelModels := channel.GetModels()
	seen := make(map[string]struct{})
	for _, name := range service.BailianSeenChannelModels(catalog, channelModels) {
		seen[name] = struct{}{}
	}
	summary.ChannelModels = len(channelModels)
	for _, name := range channelModels {
		if _, ok := seen[name]; ok {
			summary.MatchedModels++
			continue
		}
		summary.UnmatchedModels = append(summary.UnmatchedModels, name)
	}
	sort.Strings(summary.UnmatchedModels)
	return summary
}

// ApplyBailianCatalog fills metadata for the channel's actual models from the
// saved official snapshot and configures their prices automatically. It never
// adds catalog-only models to the channel and never overwrites operator prices.
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
	go syncLocalizedDescriptions(context.Background(), channel.GetModels())
	_ = service.UpdateBailianSyncStatus(channel.Id, func(status *service.BailianSyncStatus) {
		status.MatchedModels = result.MatchedModels
		status.UnmatchedModels = result.UnmatchedModels
		status.PricingRecords = pricingRecords
		if result.Metadata != nil {
			status.MetadataCreated = len(result.Metadata.CreatedModels)
			status.MetadataUpdated = len(result.Metadata.UpdatedModels)
		}
		status.Steps["apply_metadata"] = service.BailianSyncStep{
			Status: "ok", Finished: time.Now().UTC(),
		}
		status.Steps["apply_prices"] = service.BailianSyncStep{
			Status:   successOrFailedText(pricingErr),
			Message:  errorText(pricingErr),
			Finished: time.Now().UTC(),
		}
	})
	response := gin.H{
		"success": pricingErr == nil,
		"data": gin.H{
			"apply":           result,
			"pricing_records": pricingRecords,
			"pricing_error":   errorText(pricingErr),
		},
	}
	if pricingErr != nil {
		// Metadata was applied but the channel has no verified sale price.
		// The UI must not report "Synced" and leave the operator assuming the
		// channel can bill requests.
		response["message"] = common.LogText("Bailian pricing was not persisted: %v", pricingErr)
	}
	c.JSON(http.StatusOK, response)
}

func successOrFailedText(err error) string {
	if err != nil {
		return "failed"
	}
	return "ok"
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
		// Merge, never replace: the create request may already carry task-plugin
		// models (happyhorse/wan) or third-party aliases the workspace catalog
		// cannot return. Overwriting would silently drop them from routing.
		merged, changed := bailianModelsAfterDiscovery(channel.GetModels(), discovered)
		status.ActualModels = len(merged)
		if changed {
			channel.Models = strings.Join(merged, ",")
			if err := channel.Update(); err != nil {
				mark("discover_models", "failed", err.Error())
			} else {
				model.InitChannelCache()
				mark("discover_models", "ok", "")
			}
		} else {
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
	if err := service.ApplyBailianOfficialPricingPage(ctx, catalog); err != nil {
		mark("fetch_catalog", "failed", err.Error())
		return
	}
	catalog.ReferencePrice = service.NormalizeBailianPrices(catalog)
	if err := service.SaveBailianCatalogSnapshot(catalog); err != nil {
		mark("fetch_catalog", "failed", err.Error())
		return
	}
	// Merge official catalog models (happyhorse, wan video, TTS/ASR, etc.) into
	// the channel so every console-market model is selectable. The workspace
	// discovery list is preserved; only new names are appended.
	if merged, mergeErr := mergeBailianCatalogModels(channel, catalog); mergeErr != nil {
		common.SysError("merge bailian catalog models: " + mergeErr.Error())
		mark("merge_catalog_models", "failed", mergeErr.Error())
	} else {
		mark("merge_catalog_models", "ok", "")
		if merged {
			// ActualModels reflects what the channel now serves, not just the
			// workspace discovery subset.
			status.ActualModels = len(channel.GetModels())
		}
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
	go syncLocalizedDescriptions(context.Background(), channel.GetModels())
	status.MatchedModels = result.MatchedModels
	status.UnmatchedModels = result.UnmatchedModels
	if result.Metadata != nil {
		status.MetadataCreated = len(result.Metadata.CreatedModels)
		status.MetadataUpdated = len(result.Metadata.UpdatedModels)
	}
	mark("apply_metadata", "ok", "")
}

// syncBailianPricingAfterUpdate refreshes prices for the model list that was
// just saved. Unlike syncBailianAfterCreate it never discovers or rewrites
// channel.Models: an operator may have just added task-plugin models that the
// workspace list does not return, and removing them would be worse than a
// stale price. Failures are logged only; the channel edit itself has already
// succeeded and the scheduled upstream task will retry.
func syncBailianPricingAfterUpdate(channelID int) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	channel, err := model.GetChannelById(channelID, true)
	if err != nil || channel == nil || channel.Type != constant.ChannelTypeAli {
		return
	}
	mark := func(state, message string) {
		_ = service.UpdateBailianSyncStatus(channelID, func(status *service.BailianSyncStatus) {
			status.Steps["pricing_refresh"] = service.BailianSyncStep{
				Status: state, Message: message, Finished: time.Now().UTC(),
			}
		})
	}
	// The drawer invalidates `bailian-sync-status` after a save. Without a
	// step update here the panel kept showing the post-create result even
	// though this edit refreshed a different model set.
	mark("running", "")
	key, _, err := channel.GetNextEnabledKey()
	if err != nil {
		message := strings.TrimSpace(err.Error())
		if message == "" {
			message = "no enabled API key"
		}
		common.SysError(common.LogText("bailian update pricing skipped for channel %d: %s", channelID, message))
		mark("failed", message)
		return
	}
	catalog, err := service.FetchBailianCatalog(ctx, channel.GetBaseURL(), strings.TrimSpace(key))
	if err != nil {
		common.SysError(common.LogText("bailian update catalog failed for channel %d: %s", channelID, err.Error()))
		mark("failed", err.Error())
		return
	}
	catalog.ChannelID = channelID
	catalog.Region = service.BailianRegionOf(channel.GetBaseURL())
	if err := service.ApplyBailianOfficialPricingPage(ctx, catalog); err != nil {
		common.SysError(common.LogText("bailian update pricing page failed for channel %d: %s", channelID, err.Error()))
		mark("failed", err.Error())
		return
	}
	catalog.ReferencePrice = service.NormalizeBailianPrices(catalog)
	if err := service.SaveBailianCatalogSnapshot(catalog); err != nil {
		common.SysError(common.LogText("bailian update snapshot failed for channel %d: %s", channelID, err.Error()))
		mark("failed", err.Error())
		return
	}
	applyResult, metadataErr := service.ApplyBailianCatalog(catalog, channel.GetModels())
	if metadataErr != nil {
		common.SysError(common.LogText("bailian update metadata failed for channel %d: %s", channelID, metadataErr.Error()))
	}
	pricingRecords, pricingErr := applyBailianChannelPricing(catalog, channel.GetModels())
	if pricingErr != nil {
		common.SysError(common.LogText("bailian update prices failed for channel %d: %s", channelID, pricingErr.Error()))
		mark("failed", pricingErr.Error())
		return
	}
	matched := service.BailianSeenChannelModels(catalog, channel.GetModels())
	_ = service.UpdateBailianSyncStatus(channelID, func(status *service.BailianSyncStatus) {
		status.ActualModels = len(channel.GetModels())
		status.CatalogModels = len(catalog.Models)
		status.MatchedModels = len(matched)
		status.ReferencePrices = len(catalog.ReferencePrice)
		status.PricingRecords = pricingRecords
		if applyResult.Metadata != nil {
			status.MetadataCreated = len(applyResult.Metadata.CreatedModels)
			status.MetadataUpdated = len(applyResult.Metadata.UpdatedModels)
		}
		status.Steps["fetch_catalog"] = service.BailianSyncStep{
			Status: "ok", Finished: time.Now().UTC(),
		}
		status.Steps["apply_metadata"] = service.BailianSyncStep{
			Status: successOrFailedText(metadataErr), Message: errorText(metadataErr), Finished: time.Now().UTC(),
		}
		status.Steps["pricing_refresh"] = service.BailianSyncStep{
			Status: "ok", Finished: time.Now().UTC(),
		}
	})
	service.AutoVerifyChannelPricing(channelID)
}

func errorText(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

// applyBailianChannelPricing persists the Bailian official catalog price into
// the channel-isolated pricing table and then automatically configures every
// model that has one unambiguous price, so no operator click is required.
// Operator, batch and scheduled prices are never overwritten.
func applyBailianChannelPricing(catalog *service.BailianCatalog, channelModels []string) (int, error) {
	records := service.BailianPricingRecords(catalog, channelModels)
	written, err := model.UpsertChannelOfficialPricing(records)
	if err != nil {
		return 0, err
	}
	if _, _, err := service.SeedBailianInternalPricing(catalog.ChannelID, channelModels, false); err != nil {
		return written, err
	}
	// Clear only auto-derived prices for models the channel no longer serves.
	// Doing this after a successful upsert/seed keeps a failed sync from wiping
	// every billable Bailian price, and never touches operator/batch prices.
	if _, err := model.ClearAutoDerivedInternalExcept(
		catalog.ChannelID, "alibaba-bailian", channelModels, "bailian-",
	); err != nil {
		return written, err
	}
	return written, nil
}

// RefreshBailianCatalog pulls all pages of GET /api/v1/models for one Bailian
// channel and stores the result as a reference snapshot. It deliberately does
// not write any model price; applying the catalog is a separate, explicit step.

// GetBailianCatalogCoverage reports the channel's served models against the
// latest public catalog snapshot, including unmatched-model review actions.
// GET /api/channel/:id/bailian/coverage
func GetBailianCatalogCoverage(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelID <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	report, err := service.BuildBailianCatalogCoverage(channelID)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, report)
}
