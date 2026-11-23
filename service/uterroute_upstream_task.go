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
	Errors      []string  `json:"errors,omitempty"`
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
		state := states.Channels[fmt.Sprintf("%d", channel.Id)]
		if due.officialDue || due.channelDue {
			records, recordErr := UterRouteChannelPricingRecords(
				snapshot, channel.Id, channel.GetModels(), GetUterRouteDiscountGroup(channel.Id),
			)
			if recordErr != nil {
				status.Errors = append(status.Errors, fmt.Sprintf("channel %d: %v", channel.Id, recordErr))
				RecordChannelSyncOutcome(channel.Id, "uterroute", now.Unix(), 0, 0, 0, 0, "", recordErr, model.ChannelSyncTypePrices)
				continue
			}
			count, upsertErr := model.UpsertChannelOfficialPricing(records)
			if upsertErr != nil {
				status.Errors = append(status.Errors, fmt.Sprintf("channel %d: %v", channel.Id, upsertErr))
				RecordChannelSyncOutcome(channel.Id, "uterroute", now.Unix(), len(records), 0, 0, 0, "", upsertErr, model.ChannelSyncTypePrices)
				continue
			}
			written += count
			RecordChannelSyncOutcome(channel.Id, "uterroute", now.Unix(), len(records), count, 0, 0, "", nil, model.ChannelSyncTypePrices)
			AutoVerifyChannelPricing(channel.Id)
			if due.officialDue {
				state.OfficialSyncAt = now.Unix()
			}
			if due.channelDue {
				state.ChannelSyncAt = now.Unix()
			}
		}
		// Automatic updates only refresh upstream catalog/price data. Sale
		// prices are configured explicitly in the pricing step and must never
		// be re-derived or overwritten by the scheduler.
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
