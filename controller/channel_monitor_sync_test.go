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
package controller

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
	"gorm.io/gorm"
)

// setupChannelMonitorSyncTestDB builds an isolated DB holding a real channel
// row plus the monitor tables, so the controller helper hooks can be exercised
// end to end without an operator database.
func setupChannelMonitorSyncTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.UpstreamMonitorTask{}, &model.UpstreamMonitorReport{}))
	previous := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previous })
	return db
}

func insertSyncChannel(t *testing.T, id int, name, group string) {
	t.Helper()
	baseURL := "https://api.example.com/v1"
	require.NoError(t, model.DB.Create(&model.Channel{
		Id: id, Name: name, Type: constant.ChannelTypeOpenAI, Group: group,
		Key: "sk-controller-key", BaseURL: &baseURL, Models: "m1,m2",
	}).Error)
}

// The create hook (syncUpstreamMonitorForChannels) must enrol a regular
// channel and skip an internal one, with parameters identical to the channel.
func TestSyncUpstreamMonitorForChannelsCreateHook(t *testing.T) {
	db := setupChannelMonitorSyncTestDB(t)
	insertSyncChannel(t, 41, "Claude", "default")
	insertSyncChannel(t, 42, "内部渠道", "internal")

	syncUpstreamMonitorForChannels([]int{41, 42})

	task, err := model.GetUpstreamMonitorTaskByChannelID(41)
	require.NoError(t, err)
	require.NotNil(t, task)
	assert.Equal(t, "Claude", task.Name)
	assert.Equal(t, "https://api.example.com/v1", task.BaseURL)
	assert.Equal(t, []string{"m1", "m2"}, task.MonitorModels())

	internalTask, err := model.GetUpstreamMonitorTaskByChannelID(42)
	require.NoError(t, err)
	assert.Nil(t, internalTask, "internal channels must not be auto-enrolled")

	var count int64
	require.NoError(t, db.Model(&model.UpstreamMonitorTask{}).Count(&count).Error)
	assert.Equal(t, int64(1), count)
}

// The edit hook mirrors channel changes into the monitor while preserving a
// manual monitor that has no channel reference.
func TestSyncUpstreamMonitorForChannelsEditHook(t *testing.T) {
	db := setupChannelMonitorSyncTestDB(t)
	insertSyncChannel(t, 43, "Claude", "default")
	syncUpstreamMonitorForChannels([]int{43})

	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = 43").Updates(map[string]any{
		"name": "Claude Renamed", "group": "premium", "models": "m3",
	}).Error)
	syncUpstreamMonitorForChannels([]int{43})

	task, err := model.GetUpstreamMonitorTaskByChannelID(43)
	require.NoError(t, err)
	require.NotNil(t, task)
	assert.Equal(t, "Claude Renamed", task.Name)
	assert.Equal(t, "premium", task.ChannelGroup)
	assert.Equal(t, []string{"m3"}, task.MonitorModels())

	var count int64
	require.NoError(t, db.Model(&model.UpstreamMonitorTask{}).Where("channel_id = 43").Count(&count).Error)
	assert.Equal(t, int64(1), count, "an edit must not create a second task")
}

// The delete hook removes channel-backed monitors but keeps manual tasks.
func TestRemoveUpstreamMonitorForChannelsDeleteHook(t *testing.T) {
	db := setupChannelMonitorSyncTestDB(t)
	insertSyncChannel(t, 44, "GPT", "default")
	syncUpstreamMonitorForChannels([]int{44})
	require.NoError(t, db.Create(&model.UpstreamMonitorTask{
		Name: "manual", ChannelId: 0, BaseURL: "https://manual.example.com",
		Model: "custom", Protocol: "openai", Enabled: true,
	}).Error)

	removeUpstreamMonitorForChannels([]int{44})

	task, err := model.GetUpstreamMonitorTaskByChannelID(44)
	require.NoError(t, err)
	assert.Nil(t, task)
	var count int64
	require.NoError(t, db.Model(&model.UpstreamMonitorTask{}).Count(&count).Error)
	assert.Equal(t, int64(1), count, "manual task must survive channel deletion")
}
