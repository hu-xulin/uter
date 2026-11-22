package service

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

const (
	BailianUpstreamSyncStatusKey = "BailianUpstreamSyncStatus"
	bailianChannelSyncStateKey   = "BailianChannelSyncState"
)

type BailianUpstreamSyncStatus struct {
	StartedAt   time.Time `json:"started_at"`
	FinishedAt  time.Time `json:"finished_at"`
	Success     bool      `json:"success"`
	Models      int       `json:"models"`
	Channels    int       `json:"channels"`
	Written     int       `json:"written"`
	Scheduled   int       `json:"scheduled"`
	Reviews     int       `json:"reviews"`
	DueChannels int       `json:"due_channels"`
	Changes     int       `json:"changes"`
	Errors      []string  `json:"errors,omitempty"`
}

// BailianUpstreamSyncTask refreshes official model metadata and prices for
// Alibaba Model Studio channels. It never writes global model ratios.
func BailianUpstreamSyncTask() {
	for range time.NewTicker(time.Minute).C {
		AutoConfigureBailianPrices()
		if _, err := RunBailianUpstreamSync(context.Background(), false); err != nil {
			common.SysError(common.LogText("bailian upstream sync failed: %s", err.Error()))
		}
	}
}

// AutoConfigureBailianPrices adopts already-synced catalog prices as sale
// prices for every model that has none yet, so a synced channel never waits
// for an operator click. Operator, batch and scheduled prices are preserved;
// a model with no unambiguous catalog price keeps its review flag.
func AutoConfigureBailianPrices() {
	channels := bailianUpstreamChannels()
	// Rewrite stored prices from the saved snapshot once per process so a
	// catalog parser change (a newly supported unit, for example) reaches every
	// row without waiting for the next upstream pull.
	bailianSchemaReapply.Do(func() {
		for _, channel := range channels {
			reapplyBailianCatalogPricing(channel)
		}
	})
	for _, channel := range channels {
		// Pick up a pricing source change from the saved snapshot.
		reapplyBailianCatalogPricingIfStale(channel)
		if _, _, err := SeedBailianInternalPricing(channel.Id, channel.GetModels(), false); err != nil {
			common.SysError(common.LogText("bailian auto pricing failed for channel %d: %s", channel.Id, err.Error()))
		}
		if _, err := model.ClearAutoDerivedInternalExcept(channel.Id, "alibaba-bailian", channel.GetModels(), "bailian-"); err != nil {
			common.SysError(common.LogText("bailian stale auto price cleanup failed for channel %d: %s", channel.Id, err.Error()))
		}
	}
}

var bailianSchemaReapply sync.Once

// reapplyBailianCatalogPricing rewrites stored prices from the saved catalog
// snapshot. Operator prices survive because only catalog fields are written.
func reapplyBailianCatalogPricing(channel *model.Channel) {
	catalog := LoadBailianCatalogSnapshotForChannel(channel.Id)
	if catalog == nil {
		return
	}
	catalog.ChannelID = channel.Id
	augmentBailianCatalogWithStoredModels(catalog, channel.Id)
	if _, err := model.UpsertChannelOfficialPricing(BailianPricingRecords(catalog, channel.GetModels())); err != nil {
		common.SysError(common.LogText("bailian catalog reapply failed for channel %d: %s", channel.Id, err.Error()))
	}
}

// augmentBailianCatalogWithStoredModels keeps models the latest catalog no
// longer lists (but the channel still serves) priceable from their stored raw
// payload instead of leaving stale review reasons behind.
func augmentBailianCatalogWithStoredModels(catalog *BailianCatalog, channelID int) {
	known := make(map[string]bool, len(catalog.Models))
	for _, item := range catalog.Models {
		known[item.Model] = true
	}
	rows, err := model.ListChannelModelPricing(channelID)
	if err != nil {
		return
	}
	for _, row := range rows {
		if known[row.ModelName] || strings.TrimSpace(row.OfficialPricing) == "" {
			continue
		}
		var item BailianModel
		if err := common.UnmarshalJsonStr(row.OfficialPricing, &item); err != nil {
			continue
		}
		if strings.TrimSpace(item.Model) == "" {
			continue
		}
		catalog.Models = append(catalog.Models, item)
		known[item.Model] = true
		known[row.ModelName] = true
	}
}

// reapplyBailianCatalogPricingIfStale rewrites stored prices when they predate
// the current catalog source.
func reapplyBailianCatalogPricingIfStale(channel *model.Channel) {
	rows, err := model.ListChannelModelPricing(channel.Id)
	if err != nil {
		common.SysError(common.LogText("bailian auto pricing list failed for channel %d: %s", channel.Id, err.Error()))
		return
	}
	served := make(map[string]bool)
	for _, name := range channel.GetModels() {
		served[strings.TrimSpace(name)] = true
	}
	for _, row := range rows {
		// Orphan rows outside the channel's model list are never rewritten, so
		// they must not keep triggering a reapply on every tick.
		if !served[row.ModelName] {
			continue
		}
		if strings.TrimSpace(row.NormalizedPricing) != "" && row.PricingSource != bailianCatalogSource {
			reapplyBailianCatalogPricing(channel)
			return
		}
	}
}

// RunBailianUpstreamSync forces a full sync when force is true.
func RunBailianUpstreamSync(ctx context.Context, force bool) (*BailianUpstreamSyncStatus, error) {
	releaseLock, acquired, err := acquireUpstreamSyncLock(ctx, "bailian-upstream")
	if err != nil {
		return nil, err
	}
	if !acquired {
		return nil, fmt.Errorf("bailian upstream sync is running on another instance")
	}
	defer releaseLock()

	status := &BailianUpstreamSyncStatus{StartedAt: time.Now().UTC()}
	channels := bailianUpstreamChannels()
	status.Channels = len(channels)
	now := time.Now().UTC()
	states := loadBailianChannelSyncState()
	due := make([]dreamRouterDueChannel, 0, len(channels))
	for _, channel := range channels {
		schedule, _ := GetChannelPricingSchedule(channel.Id)
		modelInterval, officialInterval, channelInterval := schedule.EffectiveIntervals()
		state := states.Channels[fmt.Sprintf("%d", channel.Id)]
		if !force && state.NextAttemptAt > now.Unix() {
			continue
		}
		item := dreamRouterDueChannel{channel: channel, schedule: schedule}
		if force {
			item.modelDue, item.officialDue, item.channelDue = true, true, true
		} else {
			item.modelDue = now.Unix()-state.ModelSyncAt >= int64(modelInterval)*60
			item.officialDue = now.Unix()-state.OfficialSyncAt >= int64(officialInterval)*60
			item.channelDue = now.Unix()-state.ChannelSyncAt >= int64(channelInterval)*60
		}
		if item.anyDue() {
			due = append(due, item)
		}
	}
	status.DueChannels = len(due)
	if len(due) == 0 {
		status.Success = true
		status.FinishedAt = time.Now().UTC()
		saveBailianUpstreamSyncStatus(status)
		return status, nil
	}

	for _, item := range due {
		channel := item.channel
		state := states.Channels[fmt.Sprintf("%d", channel.Id)]
		fail := func(err error) {
			status.Errors = append(status.Errors, fmt.Sprintf("channel %d: %v", channel.Id, err))
			recordBailianSyncFailure(&state, now)
			RecordChannelSyncOutcome(channel.Id, "bailian", now.Unix(), 0, 0, 0, 0, "", err,
				model.ChannelSyncTypeModels, model.ChannelSyncTypePrices)
			states.Channels[fmt.Sprintf("%d", channel.Id)] = state
		}
		if item.modelDue || item.officialDue || item.channelDue {
			key, _, apiErr := channel.GetNextEnabledKey()
			if apiErr != nil {
				fail(fmt.Errorf("no enabled API key"))
				continue
			}
			catalog, fetchErr := FetchBailianCatalog(ctx, channel.GetBaseURL(), strings.TrimSpace(key))
			if fetchErr != nil {
				fail(fetchErr)
				continue
			}
			catalog.ChannelID = channel.Id
			catalog.Region = BailianRegionOf(channel.GetBaseURL())
			catalog.ReferencePrice = NormalizeBailianPrices(catalog)
			seenModels := BailianSeenChannelModels(catalog, channel.GetModels())
			previous := LoadBailianCatalogSnapshotForChannel(channel.Id)
			changes := bailianCatalogChanges(previous, catalog, channel.GetModels())
			status.Changes += len(changes)
			status.Models = len(catalog.Models)
			if saveErr := SaveBailianCatalogSnapshot(catalog); saveErr != nil {
				fail(saveErr)
				continue
			}
			if _, applyErr := ApplyBailianCatalog(catalog, channel.GetModels()); applyErr != nil {
				fail(applyErr)
				continue
			}
			written, recordErr := model.UpsertChannelOfficialPricing(BailianPricingRecords(catalog, channel.GetModels()))
			if recordErr != nil {
				fail(recordErr)
				continue
			}
			status.Written += written
			if len(seenModels) > 0 {
				if _, _, _, lifecycleErr := model.ApplyChannelLifecycleSnapshot(
					channel.Id, seenModels, now.Unix(), model.ChannelModelMissingDisableThreshold,
				); lifecycleErr != nil {
					fail(lifecycleErr)
					continue
				}
			}
			// Configure every model that has one unambiguous catalog price so a
			// scheduled sync never leaves the channel waiting for a manual click.
			// Operator prices keep their source and are skipped.
			if _, _, seedErr := SeedBailianInternalPricing(channel.Id, channel.GetModels(), false); seedErr != nil {
				fail(fmt.Errorf("auto configure prices: %w", seedErr))
				continue
			}
			if _, clearErr := model.ClearAutoDerivedInternalExcept(channel.Id, "alibaba-bailian", channel.GetModels(), "bailian-"); clearErr != nil {
				fail(fmt.Errorf("clear stale auto prices: %w", clearErr))
				continue
			}

			if item.schedule.Enabled && item.schedule.ApplyOnSync {
				item.schedule.Basis = BatchPricingBasisChannel
				applied, reviewCount := applyProviderSyncSchedule(channel.Id, item.schedule, changes)
				status.Scheduled += applied
				status.Reviews += reviewCount
			}
			summary, _ := common.Marshal(map[string]any{
				"models": len(catalog.Models), "written": written, "changes": len(changes),
			})
			RecordChannelSyncOutcome(channel.Id, "bailian", now.Unix(), len(catalog.Models), written, 0, 0,
				string(summary), nil, model.ChannelSyncTypeModels, model.ChannelSyncTypePrices)
			state.Failures = 0
			state.NextAttemptAt = 0
			if item.modelDue {
				state.ModelSyncAt = now.Unix()
			}
			if item.officialDue {
				state.OfficialSyncAt = now.Unix()
			}
			if item.channelDue {
				state.ChannelSyncAt = now.Unix()
			}
			states.Channels[fmt.Sprintf("%d", channel.Id)] = state
		}
	}
	saveBailianChannelSyncState(states)
	status.Success = len(status.Errors) == 0
	status.FinishedAt = time.Now().UTC()
	saveBailianUpstreamSyncStatus(status)
	if !status.Success {
		return status, fmt.Errorf("bailian upstream sync completed with %d error(s)", len(status.Errors))
	}
	return status, nil
}

func recordBailianSyncFailure(state *dreamRouterChannelSyncState, now time.Time) {
	state.Failures++
	backoff := time.Minute << min(state.Failures-1, 6)
	if backoff > time.Hour {
		backoff = time.Hour
	}
	state.NextAttemptAt = now.Add(backoff).Unix()
}

func applyProviderSyncSchedule(channelID int, schedule ChannelPricingSchedule, changes []UpstreamPriceChange) (int, int) {
	if schedule.ReviewMode == "manual" {
		reviews := BuildChannelPricingReviews(changes, channelID, nil, schedule.ThresholdPercent)
		if len(reviews) > 0 {
			if err := AppendChannelPricingReviews(reviews); err != nil {
				common.SysError("append bailian pricing reviews failed: " + err.Error())
			}
			return 0, len(reviews)
		}
	}
	basis := schedule.Basis
	if basis == "" {
		basis = BatchPricingBasisOfficial
	}
	result, err := ApplyChannelBatchPricingWithOptions(channelID, BatchPricingOptions{
		Basis: basis, Mode: schedule.Mode, Value: schedule.Value,
	})
	if err != nil {
		common.SysError("apply bailian scheduled pricing failed: " + err.Error())
		return 0, 0
	}
	return result.Updated, 0
}

func bailianUpstreamChannels() []*model.Channel {
	channels, err := model.GetAllChannels(0, 1000, true, true)
	if err != nil {
		return nil
	}
	out := make([]*model.Channel, 0)
	for _, channel := range channels {
		if channel == nil || channel.Status != 1 {
			continue
		}
		if _, _, ok := ParseBailianWorkspace(channel.GetBaseURL()); ok {
			out = append(out, channel)
		}
	}
	return out
}

type bailianChannelSyncStateSetting struct {
	Channels map[string]dreamRouterChannelSyncState `json:"channels"`
}

func loadBailianChannelSyncState() bailianChannelSyncStateSetting {
	setting := bailianChannelSyncStateSetting{Channels: map[string]dreamRouterChannelSyncState{}}
	raw := strings.TrimSpace(common.GetOption(bailianChannelSyncStateKey))
	if raw != "" {
		_ = common.UnmarshalJsonStr(raw, &setting)
	}
	if setting.Channels == nil {
		setting.Channels = map[string]dreamRouterChannelSyncState{}
	}
	return setting
}

func saveBailianChannelSyncState(setting bailianChannelSyncStateSetting) {
	raw, err := common.Marshal(setting)
	if err != nil {
		return
	}
	if err := model.UpdateOption(bailianChannelSyncStateKey, string(raw)); err != nil {
		common.SysError(common.LogText("persist bailian channel sync state failed: %v", err))
	}
}

func saveBailianUpstreamSyncStatus(status *BailianUpstreamSyncStatus) {
	raw, err := common.Marshal(status)
	if err != nil {
		return
	}
	if err := model.UpdateOption(BailianUpstreamSyncStatusKey, string(raw)); err != nil {
		common.SysError(common.LogText("persist bailian sync status failed: %v", err))
	}
}

// LoadBailianUpstreamSyncStatus returns the last scheduled/manual sync outcome.
func LoadBailianUpstreamSyncStatus() *BailianUpstreamSyncStatus {
	raw := strings.TrimSpace(common.GetOption(BailianUpstreamSyncStatusKey))
	if raw == "" {
		return nil
	}
	var status BailianUpstreamSyncStatus
	if err := common.Unmarshal([]byte(raw), &status); err != nil {
		return nil
	}
	return &status
}

// bailianCatalogChanges compares the normalized first tier of every model the
// channel serves. Missing absolute prices never become a numeric change.
func bailianCatalogChanges(previous, next *BailianCatalog, channelModels []string) []UpstreamPriceChange {
	if previous == nil || next == nil {
		return nil
	}
	oldPrices := bailianNormalizedPrices(previous, channelModels)
	newPrices := bailianNormalizedPrices(next, channelModels)
	now := time.Now().UTC()
	changes := make([]UpstreamPriceChange, 0)
	for name, current := range newPrices {
		before, ok := oldPrices[name]
		if !ok {
			continue
		}
		for _, field := range []string{"input", "output", "per_call"} {
			oldValue, newValue := before[field], current[field]
			if oldValue == nil || newValue == nil || *oldValue == *newValue {
				continue
			}
			oldCopy, newCopy := *oldValue, *newValue
			changes = append(changes, UpstreamPriceChange{
				ProviderID: "bailian", ModelID: name, Kind: "price_changed",
				Field: field, Old: &oldCopy, New: &newCopy, DetectedAt: now,
			})
		}
	}
	return changes
}

func bailianNormalizedPrices(catalog *BailianCatalog, channelModels []string) map[string]map[string]*float64 {
	out := make(map[string]map[string]*float64)
	for _, record := range BailianPricingRecords(catalog, channelModels) {
		var normalized model.ChannelOfficialPricing
		if err := common.UnmarshalJsonStr(record.NormalizedPricing, &normalized); err != nil {
			continue
		}
		tiers := normalized.ChannelPriceTiers
		if len(tiers) == 0 && normalized.ChannelPrice != nil {
			tiers = []model.ChannelPricingTier{*normalized.ChannelPrice}
		}
		if len(tiers) == 0 {
			tiers = normalized.Tiers
		}
		if len(tiers) == 0 {
			continue
		}
		tier := tiers[0]
		out[record.ModelName] = map[string]*float64{
			"input": tier.InputPerMillionUSD, "output": tier.OutputPerMillionUSD, "per_call": tier.PerUnitUSD,
		}
	}
	return out
}
