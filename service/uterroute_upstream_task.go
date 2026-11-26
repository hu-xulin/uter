package service

import (
	"context"
	"fmt"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

// UterRouteUpstreamSyncStatusKey stores the last isolated-catalog run.
const UterRouteUpstreamSyncStatusKey = "UterRouteUpstreamSyncStatus"

// UterRouteUpstreamSyncStatus is operator-visible sync telemetry.
type UterRouteUpstreamSyncStatus struct {
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
	// Repriced counts models whose sale price was recalculated from the
	// channel's configured pricing rule after an official/channel price change.
	Repriced int      `json:"repriced"`
	Errors   []string `json:"errors,omitempty"`
}

var uterRouteUpstreamSyncMu sync.Mutex

// UterRouteUpstreamSyncTask runs the isolated catalog sync every five
// minutes. It never writes global ModelRatio / ModelPrice / billing_expr.
func UterRouteUpstreamSyncTask() {
	for range time.NewTicker(1 * time.Minute).C {
		if _, err := runUterRouteUpstreamSync(context.Background(), false); err != nil {
			common.SysError(common.LogText("uterroute upstream sync failed: %s", err.Error()))
		}
	}
}

// RunUterRouteUpstreamSync forces a full isolated sync. The scheduled task
// uses runUterRouteUpstreamSync(ctx, false) and respects the per-channel
// model/official/channel cadences.
func RunUterRouteUpstreamSync(ctx context.Context) (*UterRouteUpstreamSyncStatus, error) {
	return runUterRouteUpstreamSync(ctx, true)
}

type uterRouteChannelSyncState struct {
	OfficialSyncAt int64 `json:"official_sync_at"`
	ChannelSyncAt  int64 `json:"channel_sync_at"`
	Failures       int   `json:"failures,omitempty"`
	NextAttemptAt  int64 `json:"next_attempt_at,omitempty"`
}

type uterRouteChannelSyncStateSetting struct {
	Channels map[string]uterRouteChannelSyncState `json:"channels"`
}

const uterRouteChannelSyncStateKey = "UterRouteChannelSyncState"

type uterRouteDueChannel struct {
	channel     *model.Channel
	schedule    ChannelPricingSchedule
	officialDue bool
	channelDue  bool
}

func (d uterRouteDueChannel) anyDue() bool {
	return d.officialDue || d.channelDue
}

func loadUterRouteChannelSyncState() uterRouteChannelSyncStateSetting {
	setting := uterRouteChannelSyncStateSetting{Channels: map[string]uterRouteChannelSyncState{}}
	raw := strings.TrimSpace(common.GetOption(uterRouteChannelSyncStateKey))
	if raw != "" {
		_ = common.UnmarshalJsonStr(raw, &setting)
	}
	if setting.Channels == nil {
		setting.Channels = map[string]uterRouteChannelSyncState{}
	}
	return setting
}

func saveUterRouteChannelSyncState(setting uterRouteChannelSyncStateSetting) {
	raw, err := common.Marshal(setting)
	if err != nil {
		return
	}
	if err := model.UpdateOption(uterRouteChannelSyncStateKey, string(raw)); err != nil {
		common.SysError(common.LogText("persist uterroute channel sync state failed: %v", err))
	}
}

func runUterRouteUpstreamSync(ctx context.Context, force bool) (*UterRouteUpstreamSyncStatus, error) {
	if !uterRouteUpstreamSyncMu.TryLock() {
		return nil, fmt.Errorf("uterroute upstream sync is already running")
	}
	defer uterRouteUpstreamSyncMu.Unlock()

	releaseLock, acquired, err := acquireUpstreamSyncLock(ctx, "uterroute-upstream")
	if err != nil {
		return nil, err
	}
	if !acquired {
		return nil, fmt.Errorf("uterroute upstream sync is running on another instance")
	}
	defer releaseLock()

	status := &UterRouteUpstreamSyncStatus{StartedAt: time.Now().UTC()}
	channels, err := uterRouteUpstreamChannels()
	if err != nil {
		status.FinishedAt = time.Now().UTC()
		status.Errors = append(status.Errors, err.Error())
		saveUterRouteUpstreamSyncStatus(status)
		return status, err
	}
	status.Channels = len(channels)
	if len(channels) == 0 {
		status.Success = true
		status.FinishedAt = time.Now().UTC()
		saveUterRouteUpstreamSyncStatus(status)
		return status, nil
	}

	now := time.Now().UTC()
	states := loadUterRouteChannelSyncState()
	dueChannels := make([]uterRouteDueChannel, 0, len(channels))
	for _, channel := range channels {
		schedule, explicit := GetChannelPricingSchedule(channel.Id)
		if !explicit {
			schedule.Enabled = true
		}
		_, officialInterval, channelInterval := schedule.EffectiveIntervals()
		state := states.Channels[fmt.Sprintf("%d", channel.Id)]
		if !force && state.NextAttemptAt > now.Unix() {
			continue
		}
		due := uterRouteDueChannel{channel: channel, schedule: schedule}
		if force {
			due.officialDue, due.channelDue = true, true
		} else {
			due.officialDue = now.Unix()-state.OfficialSyncAt >= int64(officialInterval)*60
			due.channelDue = now.Unix()-state.ChannelSyncAt >= int64(channelInterval)*60
		}
		if due.anyDue() {
			dueChannels = append(dueChannels, due)
		}
	}
	status.DueChannels = len(dueChannels)
	if len(dueChannels) == 0 {
		status.Success = true
		status.FinishedAt = time.Now().UTC()
		saveUterRouteUpstreamSyncStatus(status)
		return status, nil
	}

	snapshot, err := FetchUterRouteUpstream(ctx, "")
	if err != nil {
		status.FinishedAt = time.Now().UTC()
		status.Errors = append(status.Errors, err.Error())
		saveUterRouteUpstreamSyncStatus(status)
		return status, err
	}
	status.Models = len(snapshot.Models)

	var changes []UpstreamPriceChange
	previous := LoadUterRouteUpstreamSnapshot()
	if previous != nil {
		changes = DiffUterRouteUpstream(previous, snapshot)
		status.Changes = len(changes)
		if err := AppendUterRouteUpstreamHistory(snapshot.ProviderID, changes); err != nil {
			status.Errors = append(status.Errors, err.Error())
		}
	}
	if err := SaveUterRouteUpstreamSnapshot(snapshot); err != nil {
		status.FinishedAt = time.Now().UTC()
		status.Errors = append(status.Errors, err.Error())
		saveUterRouteUpstreamSyncStatus(status)
		return status, err
	}

	written := 0
	for _, due := range dueChannels {
		channel := due.channel
		pruneHiddenUterRouteModels(channel, snapshot.ExcludedModels)
		state := states.Channels[fmt.Sprintf("%d", channel.Id)]
		if due.officialDue || due.channelDue {
			// Batch redirects replace the channel's model list with request
			// aliases. Price rows must be keyed by those aliases or the pricing
			// panel reports every redirected model as unavailable.
			records, recordErr := UterRouteChannelPricingRecordsWithMapping(
				snapshot, channel.Id, channel.GetModels(), GetUterRouteDiscountGroup(channel.Id),
				channel.GetModelMapping(),
			)
			if recordErr != nil {
				status.Errors = append(status.Errors, fmt.Sprintf("channel %d: %v", channel.Id, recordErr))
				RecordChannelSyncOutcome(channel.Id, "uterroute", now.Unix(), 0, 0, 0, 0, "", recordErr, model.ChannelSyncTypePrices)
				continue
			}
			before := channelOfficialPriceSnapshot(channel.Id)
			count, upsertErr := model.UpsertChannelOfficialPricing(records)
			if upsertErr != nil {
				status.Errors = append(status.Errors, fmt.Sprintf("channel %d: %v", channel.Id, upsertErr))
				RecordChannelSyncOutcome(channel.Id, "uterroute", now.Unix(), len(records), 0, 0, 0, "", upsertErr, model.ChannelSyncTypePrices)
				continue
			}
			written += count
			// An official or channel price change must flow through to the sale
			// price using the rule configured in the pricing step. Only the
			// models whose reference price actually moved are repriced, and the
			// rule never overwrites a hand-edited price.
			after := channelOfficialPriceSnapshot(channel.Id)
			changed := channelOfficialPriceChanged(before, after, channel.GetModels())
			repriced := repriceChangedChannel(channel.Id, changed, due.schedule)
			status.Repriced += repriced
			RecordChannelSyncOutcome(channel.Id, "uterroute", now.Unix(), len(records), count, repriced, 0, "", nil, model.ChannelSyncTypePrices)
			AutoVerifyChannelPricing(channel.Id)
			if due.officialDue {
				state.OfficialSyncAt = now.Unix()
			}
			if due.channelDue {
				state.ChannelSyncAt = now.Unix()
			}
		}
		states.Channels[fmt.Sprintf("%d", channel.Id)] = state
	}
	saveUterRouteChannelSyncState(states)
	status.Written = written
	status.Success = len(status.Errors) == 0
	status.FinishedAt = time.Now().UTC()
	saveUterRouteUpstreamSyncStatus(status)
	return status, nil
}

func uterRouteUpstreamChannels() ([]*model.Channel, error) {
	channels, err := model.GetAllChannels(0, 1000, true, true)
	if err != nil {
		return nil, err
	}
	out := make([]*model.Channel, 0)
	for _, channel := range channels {
		if channel == nil || channel.Status != 1 {
			continue
		}
		if IsUterRouteHost(channel.GetBaseURL()) {
			out = append(out, channel)
		}
	}
	return out, nil
}

func saveUterRouteUpstreamSyncStatus(status *UterRouteUpstreamSyncStatus) {
	raw, err := common.Marshal(status)
	if err != nil {
		common.SysError(common.LogText("marshal uterroute upstream sync status failed: %v", err))
		return
	}
	if err := model.UpdateOption(UterRouteUpstreamSyncStatusKey, string(raw)); err != nil {
		common.SysError(common.LogText("persist uterroute upstream sync status failed: %v", err))
	}
}

// LoadUterRouteUpstreamSyncStatus returns the last isolated sync status.
func LoadUterRouteUpstreamSyncStatus() *UterRouteUpstreamSyncStatus {
	raw := strings.TrimSpace(common.GetOption(UterRouteUpstreamSyncStatusKey))
	if raw == "" {
		return nil
	}
	var status UterRouteUpstreamSyncStatus
	if err := common.Unmarshal([]byte(raw), &status); err != nil {
		return nil
	}
	return &status
}

// channelOfficialPricePoint is the per-model reference used to decide whether
// an upstream sync actually changed a price. Both the undiscounted official
// tier and the discounted channel tier are captured, so a change in either the
// official price or the channel quote triggers a sale-price recalculation.
type channelOfficialPricePoint struct {
	official float64
	channel  float64
}

// officialTierPrimaryUSD extracts the primary USD amount of one official tier.
func officialTierPrimaryUSD(tier *model.ChannelPricingTier) float64 {
	if tier == nil {
		return 0
	}
	if tier.InputPerMillionUSD != nil && tier.InputPerMillionUSD.Float64() > 0 {
		return tier.InputPerMillionUSD.Float64()
	}
	if tier.PerUnitUSD != nil && tier.PerUnitUSD.Float64() > 0 {
		return tier.PerUnitUSD.Float64()
	}
	return 0
}

// channelOfficialPriceSnapshot reads the current official + channel prices for
// every model of one channel. It is the "before" half of change detection.
func channelOfficialPriceSnapshot(channelID int) map[string]channelOfficialPricePoint {
	rows, err := model.ListChannelModelPricing(channelID)
	if err != nil {
		return nil
	}
	out := make(map[string]channelOfficialPricePoint, len(rows))
	for _, row := range rows {
		var view model.ChannelOfficialPricing
		if common.UnmarshalJsonStr(row.NormalizedPricing, &view) != nil || len(view.Tiers) == 0 {
			continue
		}
		out[row.ModelName] = channelOfficialPricePoint{
			official: officialTierPrimaryUSD(&view.Tiers[0]),
			channel:  officialTierPrimaryUSD(view.ChannelPrice),
		}
	}
	return out
}

// channelOfficialPriceChanged reports whether the official or channel price of
// any tracked model moved. A new model is a change too: it needs an initial
// sale price from the configured rule. Only models the channel actually serves
// are compared, so removing a price row from the upstream does not reprice an
// unrelated model.
func channelOfficialPriceChanged(
	before, after map[string]channelOfficialPricePoint,
	served []string,
) []string {
	changed := make([]string, 0)
	seen := make(map[string]bool, len(after))
	for _, name := range served {
		name = strings.TrimSpace(name)
		if name == "" || seen[name] {
			continue
		}
		seen[name] = true
		now, exists := after[name]
		if !exists {
			continue
		}
		was, existed := before[name]
		if !existed || math.Abs(now.official-was.official) > 1e-12 ||
			math.Abs(now.channel-was.channel) > 1e-12 {
			changed = append(changed, name)
		}
	}
	return changed
}

// repriceChangedChannel applies the channel's configured batch pricing rule to
// the models whose official/channel price changed. It never overwrites a
// hand-edited price (OverwriteManual stays false) and is a no-op when no rule
// is configured or ApplyOnSync is off. Returns the number of rows repriced.
func repriceChangedChannel(channelID int, changed []string, schedule ChannelPricingSchedule) int {
	if len(changed) == 0 || !schedule.ApplyOnSync {
		return 0
	}
	mode := strings.TrimSpace(schedule.Mode)
	if mode == "" || mode == BatchPricingModeNone {
		return 0
	}
	result, err := ApplyChannelBatchPricingWithOptions(channelID, BatchPricingOptions{
		Models: changed,
		Basis:  schedule.Basis,
		Mode:   mode,
		Value:  schedule.Value,
	})
	if err != nil {
		common.SysError(common.LogText("apply scheduled pricing after upstream sync failed: channel_id=%d error=%v", channelID, err))
		return 0
	}
	return result.Updated
}

// mergeChannelModelNames returns upstream models the channel does not list
// yet, preserving the configured order and never dropping a model.
func mergeChannelModelNames(existing, upstream []string) []string {
	seen := make(map[string]bool, len(existing))
	for _, name := range existing {
		name = strings.TrimSpace(name)
		if name != "" {
			seen[name] = true
		}
	}
	added := make([]string, 0)
	for _, name := range upstream {
		name = strings.TrimSpace(name)
		if name == "" || seen[name] {
			continue
		}
		seen[name] = true
		added = append(added, name)
	}
	return added
}
