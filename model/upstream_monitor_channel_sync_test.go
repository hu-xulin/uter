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
package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// setupMonitorChannelSyncTest builds an isolated in-memory DB with monitor
// tasks and reports. Channel-backed and manual tasks are seeded so deletion
// tests can prove manual tasks survive channel removal.
func setupMonitorChannelSyncTest(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&UpstreamMonitorTask{}, &UpstreamMonitorReport{}))

	previousDB := DB
	DB = db
	t.Cleanup(func() {
		DB = previousDB
	})

	require.NoError(t, db.Create(&UpstreamMonitorTask{
		Name: "channel 41", ChannelId: 41, ChannelName: "Claude",
		BaseURL: "https://claude.example.com", Model: "sonnet",
		Protocol: "openai", Enabled: true,
	}).Error)
	require.NoError(t, db.Create(&UpstreamMonitorTask{
		Name: "channel 42", ChannelId: 42, ChannelName: "GPT",
		BaseURL: "https://gpt.example.com", Model: "gpt-5",
		Protocol: "openai", Enabled: true,
	}).Error)
	require.NoError(t, db.Create(&UpstreamMonitorTask{
		Name: "manual", ChannelId: 0,
		BaseURL: "https://manual.example.com", Model: "custom",
		Protocol: "openai", Enabled: true,
	}).Error)
	return db
}

func TestGetUpstreamMonitorTaskByChannelID(t *testing.T) {
	db := setupMonitorChannelSyncTest(t)

	task, err := GetUpstreamMonitorTaskByChannelID(41)
	require.NoError(t, err)
	require.NotNil(t, task)
	assert.Equal(t, "channel 41", task.Name)
	assert.Equal(t, 41, task.ChannelId)

	missing, err := GetUpstreamMonitorTaskByChannelID(9999)
	require.NoError(t, err)
	assert.Nil(t, missing)

	manual, err := GetUpstreamMonitorTaskByChannelID(0)
	require.NoError(t, err)
	assert.Nil(t, manual, "manual tasks must not be resolved as channel-backed")

	// Confirm a report row can be seeded for cascade assertions below.
	var manualTask UpstreamMonitorTask
	require.NoError(t, db.Where("channel_id = 0").First(&manualTask).Error)
	require.NoError(t, db.Create(&UpstreamMonitorReport{
		TaskId: manualTask.Id, RunId: "manual-run", Score: 90, Verdict: "pass",
	}).Error)
}

func TestDeleteUpstreamMonitorTasksByChannelIDs(t *testing.T) {
	db := setupMonitorChannelSyncTest(t)

	require.NoError(t, db.Create(&UpstreamMonitorReport{
		TaskId: 1, RunId: "ch41-run", Score: 80, Verdict: "pass",
	}).Error)

	require.NoError(t, DeleteUpstreamMonitorTasksByChannelIDs([]int{41, 42, 0, -1}))

	var remaining []UpstreamMonitorTask
	require.NoError(t, db.Order("id asc").Find(&remaining).Error)
	require.Len(t, remaining, 1, "only the manual task should remain")
	assert.Equal(t, "manual", remaining[0].Name)
	assert.Equal(t, 0, remaining[0].ChannelId)

	var reports []UpstreamMonitorReport
	require.NoError(t, db.Find(&reports).Error)
	assert.Empty(t, reports, "channel-backed reports must be purged with their tasks")
}

func TestDeleteUpstreamMonitorTasksByChannelIDsEmpty(t *testing.T) {
	db := setupMonitorChannelSyncTest(t)
	require.NoError(t, DeleteUpstreamMonitorTasksByChannelIDs(nil))
	var count int64
	require.NoError(t, db.Model(&UpstreamMonitorTask{}).Count(&count).Error)
	assert.Equal(t, int64(3), count, "empty input must be a no-op")
}
