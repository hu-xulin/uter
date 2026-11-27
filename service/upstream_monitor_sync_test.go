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
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/relaykit/dto"
	"gorm.io/gorm"
)

func setupSyncTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.UpstreamMonitorTask{}, &model.UpstreamMonitorReport{}))
	previous := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previous })
	return db
}

func newSyncChannel(id int, name, group, baseURL, models, setting string) *model.Channel {
	return &model.Channel{
		Id: id, Name: name, Group: group, Type: constant.ChannelTypeOpenAI,
		Key: "sk-test-key", BaseURL: &baseURL, Models: models, OtherSettings: setting,
	}
}

func TestShouldAutoMonitorChannel(t *testing.T) {
	regular := newSyncChannel(1, "Claude", "default", "https://api.example.com", "claude-3,claude-3", "")
	assert.True(t, ShouldAutoMonitorChannel(regular))

	internal := newSyncChannel(2, "内部渠道", "internal", "https://internal.example.com", "m1", "")
	assert.False(t, ShouldAutoMonitorChannel(internal), "internal group must be excluded")

	commaInternal := newSyncChannel(3, "mixed", "default,internal", "https://x.example.com", "m1", "")
	assert.False(t, ShouldAutoMonitorChannel(commaInternal), "internal token in a group list must be excluded")

	draftSetting, err := common.Marshal(dto.ChannelOtherSettings{Draft: true})
	require.NoError(t, err)
	draft := newSyncChannel(4, "draft", "default", "https://d.example.com", "m1", string(draftSetting))
	draft.Status = 0
	assert.False(t, ShouldAutoMonitorChannel(draft), "unpublished draft must be excluded")

	// A published channel (status=1) whose older publish path left settings.draft
	// behind is live and must still be enrolled. This was the case for the
	// Bailian channel: enabled and serving traffic, yet missing from monitoring
	// because the stale draft flag was read as "unpublished".
	staleDraft := newSyncChannel(7, "published-with-stale-draft", "default", "https://d.example.com", "m1", string(draftSetting))
	staleDraft.Status = 1
	assert.True(t, ShouldAutoMonitorChannel(staleDraft), "enabled channel with stale draft flag must be monitored")

	noModels := newSyncChannel(5, "empty", "default", "https://e.example.com", "", "")
	assert.False(t, ShouldAutoMonitorChannel(noModels))

	noKey := newSyncChannel(6, "nokey", "default", "https://e.example.com", "m1", "")
	noKey.Key = ""
	assert.False(t, ShouldAutoMonitorChannel(noKey))
}

func TestSyncChannelMonitorCreateAndUpdate(t *testing.T) {
	db := setupSyncTestDB(t)
	channel := newSyncChannel(10, "Claude", "default", "https://api.example.com/v1/", "claude-3, claude-3, sonnet", "")

	action, err := SyncChannelMonitor(channel)
	require.NoError(t, err)
	assert.Equal(t, "created", action)

	task, err := model.GetUpstreamMonitorTaskByChannelID(10)
	require.NoError(t, err)
	require.NotNil(t, task)
	assert.Equal(t, "Claude", task.Name)
	assert.Equal(t, "https://api.example.com/v1", task.BaseURL, "trailing slash must be trimmed like a manual task")
	assert.Equal(t, []string{"claude-3", "sonnet"}, task.MonitorModels(), "models mirrored from channel, de-duplicated")
	assert.Equal(t, "claude-3", task.Model)
	assert.Equal(t, UpstreamProtocolOpenAI, task.Protocol)
	assert.NotEmpty(t, task.APIKeyEncrypted)
	assert.NotContains(t, task.APIKeyEncrypted, "sk-test-key")
	assert.Equal(t, 12, len(task.APIKeyFingerprint))

	// Operator tunes monitor-specific settings; a channel edit must preserve them.
	require.NoError(t, model.UpdateUpstreamMonitorTask(task, map[string]any{
		"check_interval_minute": 120, "probe_depth": UpstreamDepthFull, "enabled": false,
	}))

	channel.Name = "Claude Renamed"
	channel.Group = "premium"
	channel.Models = "sonnet,opus"
	channel.Type = constant.ChannelTypeAnthropic
	action, err = SyncChannelMonitor(channel)
	require.NoError(t, err)
	assert.Equal(t, "updated", action)

	updated, err := model.GetUpstreamMonitorTaskByChannelID(10)
	require.NoError(t, err)
	require.NotNil(t, updated)
	assert.Equal(t, "Claude Renamed", updated.Name)
	assert.Equal(t, "premium", updated.ChannelGroup)
	assert.Equal(t, []string{"sonnet", "opus"}, updated.MonitorModels())
	assert.Equal(t, UpstreamProtocolAnthropic, updated.Protocol)
	assert.Equal(t, 120, updated.CheckIntervalMinute, "operator setting preserved")
	assert.Equal(t, UpstreamDepthFull, updated.ProbeDepth, "operator setting preserved")
	assert.False(t, updated.Enabled, "operator setting preserved")

	// No duplicate task was created on update.
	var count int64
	require.NoError(t, db.Model(&model.UpstreamMonitorTask{}).Where("channel_id = 10").Count(&count).Error)
	assert.Equal(t, int64(1), count)
}

func TestSyncChannelMonitorRemovesWhenChannelBecomesInternal(t *testing.T) {
	setupSyncTestDB(t)
	channel := newSyncChannel(11, "Claude", "default", "https://api.example.com", "m1", "")
	action, err := SyncChannelMonitor(channel)
	require.NoError(t, err)
	require.Equal(t, "created", action)

	channel.Group = "internal"
	action, err = SyncChannelMonitor(channel)
	require.NoError(t, err)
	assert.Equal(t, "removed", action)

	task, err := model.GetUpstreamMonitorTaskByChannelID(11)
	require.NoError(t, err)
	assert.Nil(t, task)
}

func TestRemoveChannelMonitorsKeepsManualTasks(t *testing.T) {
	db := setupSyncTestDB(t)
	channelTask := newSyncChannel(12, "GPT", "default", "https://gpt.example.com", "gpt-5", "")
	_, err := SyncChannelMonitor(channelTask)
	require.NoError(t, err)
	manual := &model.UpstreamMonitorTask{
		Name: "manual", ChannelId: 0, BaseURL: "https://manual.example.com",
		Model: "custom", Protocol: UpstreamProtocolOpenAI, Enabled: true,
	}
	require.NoError(t, model.CreateUpstreamMonitorTask(manual))

	require.NoError(t, RemoveChannelMonitors([]int{12}))

	task, err := model.GetUpstreamMonitorTaskByChannelID(12)
	require.NoError(t, err)
	assert.Nil(t, task)
	var count int64
	require.NoError(t, db.Model(&model.UpstreamMonitorTask{}).Count(&count).Error)
	assert.Equal(t, int64(1), count, "manual task must survive channel removal")
}

func TestUpstreamProtocolForChannel(t *testing.T) {
	assert.Equal(t, UpstreamProtocolAnthropic, UpstreamProtocolForChannel(constant.ChannelTypeAnthropic))
	assert.Equal(t, UpstreamProtocolOpenAI, UpstreamProtocolForChannel(constant.ChannelTypeOpenAI))
	assert.Equal(t, UpstreamProtocolOpenAI, UpstreamProtocolForChannel(constant.ChannelTypeUterRoute))
}

// Reconcile is the backfill path for channels created before the linkage
// existed. It must enrol regular channels, skip internal ones, and purge
// channel-backed tasks whose channel is gone — while leaving manual tasks.
func TestReconcileChannelMonitors(t *testing.T) {
	db := setupSyncTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Channel{}))

	require.NoError(t, db.Create(&model.Channel{
		Id: 50, Name: "Legacy Claude", Type: constant.ChannelTypeOpenAI, Group: "default",
		Key: "sk-legacy", BaseURL: ptr("https://legacy.example.com"), Models: "claude-3",
	}).Error)
	require.NoError(t, db.Create(&model.Channel{
		Id: 51, Name: "内部渠道", Type: constant.ChannelTypeOpenAI, Group: "internal",
		Key: "sk-internal", BaseURL: ptr("https://internal.example.com"), Models: "m1",
	}).Error)
	// Orphan task: references channel 99 which no longer exists.
	require.NoError(t, db.Create(&model.UpstreamMonitorTask{
		Name: "orphan", ChannelId: 99, ChannelName: "gone",
		BaseURL: "https://gone.example.com", Model: "m1", Protocol: UpstreamProtocolOpenAI, Enabled: true,
	}).Error)
	// Manual task must survive reconcile.
	require.NoError(t, db.Create(&model.UpstreamMonitorTask{
		Name: "manual", ChannelId: 0, BaseURL: "https://manual.example.com",
		Model: "custom", Protocol: UpstreamProtocolOpenAI, Enabled: true,
	}).Error)

	require.NoError(t, ReconcileChannelMonitors())

	task, err := model.GetUpstreamMonitorTaskByChannelID(50)
	require.NoError(t, err)
	require.NotNil(t, task, "legacy channel must be auto-enrolled")
	assert.Equal(t, "Legacy Claude", task.Name)

	internalTask, err := model.GetUpstreamMonitorTaskByChannelID(51)
	require.NoError(t, err)
	assert.Nil(t, internalTask, "internal channel must stay excluded")

	orphan, err := model.GetUpstreamMonitorTaskByChannelID(99)
	require.NoError(t, err)
	assert.Nil(t, orphan, "orphaned channel-backed task must be purged")

	var count int64
	require.NoError(t, db.Model(&model.UpstreamMonitorTask{}).Count(&count).Error)
	assert.Equal(t, int64(2), count, "enrolled channel + manual task")
}

func ptr(s string) *string { return &s }

// A channel-backed task probes with the channel's LIVE base URL and key, so an
// edit to the channel takes effect even before the snapshot is refreshed. When
// the channel is deleted, the encrypted snapshot keeps the monitor running.
func TestResolveUpstreamEndpoint_ChannelBacked(t *testing.T) {
	db := setupSyncTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Channel{}))

	liveURL := "https://live.example.com/v1"
	require.NoError(t, db.Create(&model.Channel{
		Id: 60, Name: "Claude", Type: constant.ChannelTypeOpenAI, Group: "default",
		Key: "sk-live-key", BaseURL: &liveURL, Models: "m1,m2",
	}).Error)

	snapshotKey, err := EncryptUpstreamAPIKey("sk-snapshot")
	require.NoError(t, err)
	task := &model.UpstreamMonitorTask{
		ChannelId: 60, ChannelKeyIndex: 0,
		BaseURL: "https://snapshot.example.com/v1", APIKeyEncrypted: snapshotKey,
		Models: `["old-model"]`,
	}

	endpoint, err := resolveUpstreamEndpoint(task)
	require.NoError(t, err)
	assert.True(t, endpoint.FromChannel)
	assert.Equal(t, liveURL, endpoint.BaseURL, "live channel base URL wins")
	assert.Equal(t, "sk-live-key", endpoint.APIKey, "live channel key wins")
	assert.Equal(t, []string{"old-model"}, endpoint.Models, "operator's saved model selection is kept")

	// After the channel is removed, the monitor falls back to its snapshot.
	require.NoError(t, db.Delete(&model.Channel{}, 60).Error)
	endpoint, err = resolveUpstreamEndpoint(task)
	require.NoError(t, err)
	assert.False(t, endpoint.FromChannel)
	assert.Equal(t, "https://snapshot.example.com/v1", endpoint.BaseURL)
	assert.Equal(t, "sk-snapshot", endpoint.APIKey)
}
