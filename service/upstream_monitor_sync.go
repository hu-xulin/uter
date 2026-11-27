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
package service

import (
	"fmt"
	"strings"
	"sync"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
)

const (
	// internalChannelGroup marks a channel as internal and excludes it from
	// automatic monitoring.
	internalChannelGroup = "internal"
	// defaultMonitorCheckInterval is the probe cadence for auto-created tasks.
	// It is a monitor setting (not a channel parameter) so it can be tuned by
	// the operator without changing the channel.
	defaultMonitorCheckInterval = 30
)

// channelMonitorSyncMu serialises check-then-act across concurrent channel
// CRUD hooks and the one-shot reconcile pass inside a single process.
var channelMonitorSyncMu sync.Mutex

// UpstreamProtocolForChannel infers the probe protocol from a channel type.
// Anthropic-native channels use the messages API; everything else is treated
// as OpenAI-compatible. Kept here so both manual monitor creation and channel
// auto-sync agree on the same mapping.
func UpstreamProtocolForChannel(channelType int) string {
	if channelType == constant.ChannelTypeAnthropic {
		return UpstreamProtocolAnthropic
	}
	return UpstreamProtocolOpenAI
}

// IsInternalChannel reports whether a channel belongs to the internal group.
// Channel groups are comma-separated; matching is case-insensitive.
func IsInternalChannel(channel *model.Channel) bool {
	if channel == nil {
		return true
	}
	for _, group := range channel.GetGroups() {
		if strings.EqualFold(strings.TrimSpace(group), internalChannelGroup) {
			return true
		}
	}
	return false
}

// ShouldAutoMonitorChannel reports whether a channel should get an automatic
// monitor task. Internal channels, unpublished drafts and channels without a
// usable base URL, key or model list cannot be probed and are skipped.
func ShouldAutoMonitorChannel(channel *model.Channel) bool {
	if channel == nil || channel.Id <= 0 {
		return false
	}
	if channel.GetOtherSettings().Draft {
		return false
	}
	if IsInternalChannel(channel) {
		return false
	}
	if strings.TrimSpace(channel.GetBaseURL()) == "" {
		return false
	}
	if len(channel.GetKeys()) == 0 {
		return false
	}
	if len(channel.GetModels()) == 0 {
		return false
	}
	return true
}

// normalizeChannelMonitorModels trims and de-duplicates a channel's model list
// while preserving its order, so the monitor snapshot mirrors the channel.
func normalizeChannelMonitorModels(raw []string) []string {
	result := make([]string, 0, len(raw))
	seen := make(map[string]struct{}, len(raw))
	for _, item := range raw {
		name := strings.TrimSpace(item)
		if name == "" {
			continue
		}
		if _, exists := seen[name]; exists {
			continue
		}
		seen[name] = struct{}{}
		result = append(result, name)
	}
	return result
}

// channelMonitorSnapshot builds a monitor task whose endpoint parameters are
// identical to the channel's. The key is encrypted at rest; the live channel
// is still read on every probe by resolveUpstreamEndpoint.
func channelMonitorSnapshot(channel *model.Channel) (*model.UpstreamMonitorTask, error) {
	if channel == nil {
		return nil, fmt.Errorf("nil channel")
	}
	keys := channel.GetKeys()
	if len(keys) == 0 {
		return nil, fmt.Errorf("channel %d has no key", channel.Id)
	}
	apiKey := strings.TrimSpace(selectUpstreamKey(keys, 0))
	if apiKey == "" {
		return nil, fmt.Errorf("channel %d has an empty key", channel.Id)
	}
	models := normalizeChannelMonitorModels(channel.GetModels())
	if len(models) == 0 {
		return nil, fmt.Errorf("channel %d has no models", channel.Id)
	}
	encrypted, err := EncryptUpstreamAPIKey(apiKey)
	if err != nil {
		return nil, err
	}
	modelsJSON, err := common.Marshal(models)
	if err != nil {
		return nil, err
	}
	return &model.UpstreamMonitorTask{
		Name:                channel.Name,
		ChannelId:           channel.Id,
		ChannelName:         channel.Name,
		ChannelGroup:        channel.Group,
		ChannelKeyIndex:     0,
		BaseURL:             strings.TrimRight(strings.TrimSpace(channel.GetBaseURL()), "/"),
		APIKeyEncrypted:     encrypted,
		APIKeyFingerprint:   UpstreamAPIKeyFingerprint(apiKey),
		Model:               models[0],
		Models:              string(modelsJSON),
		Protocol:            UpstreamProtocolForChannel(channel.Type),
		CheckIntervalMinute: defaultMonitorCheckInterval,
		ProbeDepth:          UpstreamDepthStandard,
		Enabled:             true,
		Status:              "unknown",
		LastVerdict:         "unknown",
	}, nil
}

// SyncChannelMonitor reconciles the automatic monitor task for one channel.
// It returns "created", "updated", "removed" or "skipped". Operator-owned
// monitor settings (check interval, probe depth, enabled) are preserved on
// update; only channel-derived fields are refreshed.
func SyncChannelMonitor(channel *model.Channel) (string, error) {
	if channel == nil || channel.Id <= 0 {
		return "skipped", nil
	}
	channelMonitorSyncMu.Lock()
	defer channelMonitorSyncMu.Unlock()

	existing, err := model.GetUpstreamMonitorTaskByChannelID(channel.Id)
	if err != nil {
		return "", err
	}

	if !ShouldAutoMonitorChannel(channel) {
		if existing != nil {
			if err := model.DeleteUpstreamMonitorTask(existing.Id); err != nil {
				return "", err
			}
			return "removed", nil
		}
		return "skipped", nil
	}

	desired, err := channelMonitorSnapshot(channel)
	if err != nil {
		return "", err
	}

	if existing == nil {
		if err := model.CreateUpstreamMonitorTask(desired); err != nil {
			return "", err
		}
		return "created", nil
	}

	updates := map[string]any{
		"name":                desired.Name,
		"channel_name":        desired.ChannelName,
		"channel_group":       desired.ChannelGroup,
		"channel_key_index":   desired.ChannelKeyIndex,
		"base_url":            desired.BaseURL,
		"api_key_encrypted":   desired.APIKeyEncrypted,
		"api_key_fingerprint": desired.APIKeyFingerprint,
		"model":               desired.Model,
		"models":              desired.Models,
		"protocol":            desired.Protocol,
	}
	if err := model.UpdateUpstreamMonitorTask(existing, updates); err != nil {
		return "", err
	}
	return "updated", nil
}

// RemoveChannelMonitors deletes every channel-backed monitor task (and its
// reports) for the given channel ids. Manual tasks are never affected.
func RemoveChannelMonitors(channelIDs []int) error {
	channelMonitorSyncMu.Lock()
	defer channelMonitorSyncMu.Unlock()
	return model.DeleteUpstreamMonitorTasksByChannelIDs(channelIDs)
}

// ReconcileChannelMonitors aligns all channel-backed tasks with the current
// channel set. It is invoked once on the first monitor-list read so channels
// created before this feature are picked up, and so orphaned tasks whose
// channel vanished outside the CRUD hooks are purged.
func ReconcileChannelMonitors() error {
	channels, err := model.GetAllChannels(0, 0, true, true)
	if err != nil {
		return err
	}
	for _, channel := range channels {
		if _, err := SyncChannelMonitor(channel); err != nil {
			return err
		}
	}

	tasks, err := model.ListUpstreamMonitorTasks()
	if err != nil {
		return err
	}
	alive := make(map[int]struct{}, len(channels))
	for _, channel := range channels {
		alive[channel.Id] = struct{}{}
	}
	orphanChannels := make([]int, 0)
	seen := make(map[int]struct{})
	for _, task := range tasks {
		if task.ChannelId <= 0 {
			continue
		}
		if _, ok := alive[task.ChannelId]; ok {
			continue
		}
		if _, ok := seen[task.ChannelId]; ok {
			continue
		}
		seen[task.ChannelId] = struct{}{}
		orphanChannels = append(orphanChannels, task.ChannelId)
	}
	if len(orphanChannels) > 0 {
		return RemoveChannelMonitors(orphanChannels)
	}
	return nil
}
