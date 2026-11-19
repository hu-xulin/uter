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

// DreamRouterUpstreamSyncStatusKey stores the last isolated-catalog run.
const DreamRouterUpstreamSyncStatusKey = "DreamRouterUpstreamSyncStatus"

// DreamRouterUpstreamSyncStatus is operator-visible sync telemetry.
type DreamRouterUpstreamSyncStatus struct {
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

var dreamRouterUpstreamSyncMu sync.Mutex

// DreamRouterUpstreamSyncTask runs the isolated catalog sync every five
// minutes. It never calls SyncDreamRouterPricing and never writes global
// ModelRatio / ModelPrice / billing_expr.
func DreamRouterUpstreamSyncTask() {
	for range time.NewTicker(1 * time.Minute).C {
		if _, err := runDreamRouterUpstreamSync(context.Background(), false); err != nil {
			common.SysError(common.LogText("dreamrouter upstream sync failed: %s", err.Error()))
		}
	}
}

// RunDreamRouterUpstreamSync forces a full isolated sync. The scheduled task
// uses runDreamRouterUpstreamSync(ctx, false) and respects the per-channel
// model/official/channel cadences.
func RunDreamRouterUpstreamSync(ctx context.Context) (*DreamRouterUpstreamSyncStatus, error) {
	return runDreamRouterUpstreamSync(ctx, true)
}

type dreamRouterChannelSyncState struct {
	ModelSyncAt    int64 `json:"model_sync_at"`
	OfficialSyncAt int64 `json:"official_sync_at"`
	ChannelSyncAt  int64 `json:"channel_sync_at"`
}

type dreamRouterChannelSyncStateSetting struct {
	Channels map[string]dreamRouterChannelSyncState `json:"channels"`
}

const dreamRouterChannelSyncStateKey = "DreamRouterChannelSyncState"

type dreamRouterDueChannel struct {
	channel     *model.Channel
	schedule    ChannelPricingSchedule
	modelDue    bool
	officialDue bool
	channelDue  bool
}

func (d dreamRouterDueChannel) anyDue() bool {
	return d.modelDue || d.officialDue || d.channelDue
}

func loadDreamRouterChannelSyncState() dreamRouterChannelSyncStateSetting {
	setting := dreamRouterChannelSyncStateSetting{Channels: map[string]dreamRouterChannelSyncState{}}
	raw := strings.TrimSpace(common.OptionMap[dreamRouterChannelSyncStateKey])
	if raw != "" {
		_ = common.UnmarshalJsonStr(raw, &setting)
	}
	if setting.Channels == nil {
		setting.Channels = map[string]dreamRouterChannelSyncState{}
	}
	return setting
}

func saveDreamRouterChannelSyncState(setting dreamRouterChannelSyncStateSetting) {
	raw, err := common.Marshal(setting)
	if err != nil {
		return
	}
	if err := model.UpdateOption(dreamRouterChannelSyncStateKey, string(raw)); err != nil {
		common.SysError(common.LogText("persist dreamrouter channel sync state failed: %v", err))
	}
}

func runDreamRouterUpstreamSync(ctx context.Context, force bool) (*DreamRouterUpstreamSyncStatus, error) {
	if !dreamRouterUpstreamSyncMu.TryLock() {
		return nil, fmt.Errorf("dreamrouter upstream sync is already running")
	}
	defer dreamRouterUpstreamSyncMu.Unlock()

	status := &DreamRouterUpstreamSyncStatus{StartedAt: time.Now().UTC()}
	channels, err := dreamRouterUpstreamChannels()
	if err != nil {
		status.FinishedAt = time.Now().UTC()
		status.Errors = append(status.Errors, err.Error())
		saveDreamRouterUpstreamSyncStatus(status)
		return status, err
	}
	status.Channels = len(channels)
	if len(channels) == 0 {
		status.Success = true
		status.FinishedAt = time.Now().UTC()
		saveDreamRouterUpstreamSyncStatus(status)
		return status, nil
	}

	now := time.Now().UTC()
	states := loadDreamRouterChannelSyncState()
	dueChannels := make([]dreamRouterDueChannel, 0, len(channels))
	for _, channel := range channels {
		schedule, _ := GetChannelPricingSchedule(channel.Id)
		modelInterval, officialInterval, channelInterval := schedule.EffectiveIntervals()
		state := states.Channels[fmt.Sprintf("%d", channel.Id)]
		due := dreamRouterDueChannel{channel: channel, schedule: schedule}
		if force {
			due.modelDue, due.officialDue, due.channelDue = true, true, true
		} else {
			due.modelDue = now.Unix()-state.ModelSyncAt >= int64(modelInterval)*60
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
		saveDreamRouterUpstreamSyncStatus(status)
		return status, nil
	}

	snapshot, err := FetchDreamRouterUpstream(ctx, "")
	if err != nil {
		status.FinishedAt = time.Now().UTC()
		status.Errors = append(status.Errors, err.Error())
		saveDreamRouterUpstreamSyncStatus(status)
		return status, err
	}
	status.Models = len(snapshot.Models)

	var changes []UpstreamPriceChange
	previous := LoadDreamRouterUpstreamSnapshot()
	if previous != nil {
		changes = DiffDreamRouterUpstream(previous, snapshot)
		status.Changes = len(changes)
		if err := AppendDreamRouterUpstreamHistory(snapshot.ProviderID, changes); err != nil {
			status.Errors = append(status.Errors, err.Error())
		}
	}
	if err := SaveDreamRouterUpstreamSnapshot(snapshot); err != nil {
		status.FinishedAt = time.Now().UTC()
		status.Errors = append(status.Errors, err.Error())
		saveDreamRouterUpstreamSyncStatus(status)
		return status, err
	}

	written := 0
	for _, due := range dueChannels {
		channel := due.channel
		state := states.Channels[fmt.Sprintf("%d", channel.Id)]
		if due.modelDue {
			state.ModelSyncAt = now.Unix()
		}
		if due.officialDue || due.channelDue {
			records, recordErr := DreamRouterChannelPricingRecords(snapshot, channel.Id, channel.GetModels())
			if recordErr != nil {
				status.Errors = append(status.Errors, fmt.Sprintf("channel %d: %v", channel.Id, recordErr))
				continue
			}
			count, upsertErr := model.UpsertChannelOfficialPricing(records)
			if upsertErr != nil {
				status.Errors = append(status.Errors, fmt.Sprintf("channel %d: %v", channel.Id, upsertErr))
				continue
			}
			written += count
			if due.officialDue {
				state.OfficialSyncAt = now.Unix()
			}
			if due.channelDue {
				state.ChannelSyncAt = now.Unix()
			}
		}
		if due.schedule.Enabled && due.schedule.ApplyOnSync && (due.officialDue || due.channelDue) {
			if due.schedule.ReviewMode == "manual" {
				reviews := BuildChannelPricingReviews(changes, channel.Id, channel.GetModels(), due.schedule.ThresholdPercent)
				if len(reviews) > 0 {
					if reviewErr := AppendChannelPricingReviews(reviews); reviewErr != nil {
						status.Errors = append(status.Errors, fmt.Sprintf("channel %d reviews: %v", channel.Id, reviewErr))
					} else {
						status.Reviews += len(reviews)
					}
					states.Channels[fmt.Sprintf("%d", channel.Id)] = state
					continue
				}
			}
			if _, applyErr := ApplyChannelBatchPricing(channel.Id, nil, due.schedule.Basis, due.schedule.Mode, due.schedule.Value, false); applyErr != nil {
				status.Errors = append(status.Errors, fmt.Sprintf("channel %d schedule: %v", channel.Id, applyErr))
			} else {
				status.Scheduled++
			}
		}
		states.Channels[fmt.Sprintf("%d", channel.Id)] = state
	}
	saveDreamRouterChannelSyncState(states)
	status.Written = written
	status.Success = len(status.Errors) == 0
	status.FinishedAt = time.Now().UTC()
	saveDreamRouterUpstreamSyncStatus(status)
	return status, nil
}

func dreamRouterUpstreamChannels() ([]*model.Channel, error) {
	channels, err := model.GetAllChannels(0, 1000, true, true)
	if err != nil {
		return nil, err
	}
	out := make([]*model.Channel, 0)
	for _, channel := range channels {
		if channel == nil || channel.Status != 1 {
			continue
		}
		if strings.Contains(strings.ToLower(channel.GetBaseURL()), "dreamrouter.ai") {
			out = append(out, channel)
		}
	}
	return out, nil
}

func saveDreamRouterUpstreamSyncStatus(status *DreamRouterUpstreamSyncStatus) {
	raw, err := common.Marshal(status)
	if err != nil {
		common.SysError(common.LogText("marshal dreamrouter upstream sync status failed: %v", err))
		return
	}
	if err := model.UpdateOption(DreamRouterUpstreamSyncStatusKey, string(raw)); err != nil {
		common.SysError(common.LogText("persist dreamrouter upstream sync status failed: %v", err))
	}
}

// LoadDreamRouterUpstreamSyncStatus returns the last isolated sync status.
func LoadDreamRouterUpstreamSyncStatus() *DreamRouterUpstreamSyncStatus {
	raw := strings.TrimSpace(common.OptionMap[DreamRouterUpstreamSyncStatusKey])
	if raw == "" {
		return nil
	}
	var status DreamRouterUpstreamSyncStatus
	if err := common.Unmarshal([]byte(raw), &status); err != nil {
		return nil
	}
	return &status
}
