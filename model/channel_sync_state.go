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
	"time"

	"gorm.io/gorm/clause"
)

// 渠道同步类型。模型目录与价格分开记录，任一成功/失败都不会掩盖另一项。
const (
	ChannelSyncTypeModels = "models"
	ChannelSyncTypePrices = "prices"
)

// ChannelSyncState records the last attempt and last success of one sync type
// for one channel. Counts and the change summary make a failed or partial sync
// auditable without reading the system log.
type ChannelSyncState struct {
	Id        int64  `gorm:"primaryKey;autoIncrement"`
	ChannelId int    `gorm:"uniqueIndex:idx_channel_sync_state,priority:1;index"`
	SyncType  string `gorm:"size:32;uniqueIndex:idx_channel_sync_state,priority:2"`
	Provider  string `gorm:"size:64"`

	LastStartedAt int64
	LastSuccessAt int64
	LastError     string `gorm:"size:512"`

	Fetched int
	Written int
	Skipped int
	Removed int
	// ChangeSummary is a bounded JSON excerpt (added/removed models or price
	// movements) for operator review.
	ChangeSummary string `gorm:"type:text"`
	UpdatedAt     int64  `gorm:"index"`
}

func (ChannelSyncState) TableName() string { return "channel_sync_states" }

// SaveChannelSyncState upserts one channel/type row. A failed attempt keeps the
// previous LastSuccessAt so callers can tell "last good sync" from "last try".
func SaveChannelSyncState(state ChannelSyncState) error {
	if DB == nil || state.ChannelId <= 0 || state.SyncType == "" {
		return nil
	}
	if state.UpdatedAt == 0 {
		state.UpdatedAt = time.Now().Unix()
	}
	updates := map[string]any{
		"provider":        state.Provider,
		"last_started_at": state.LastStartedAt,
		"last_error":      state.LastError,
		"fetched":         state.Fetched,
		"written":         state.Written,
		"skipped":         state.Skipped,
		"removed":         state.Removed,
		"change_summary":  state.ChangeSummary,
		"updated_at":      state.UpdatedAt,
	}
	if state.LastSuccessAt > 0 {
		updates["last_success_at"] = state.LastSuccessAt
	}
	return DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "channel_id"}, {Name: "sync_type"}},
		DoUpdates: clause.Assignments(updates),
	}).Create(&state).Error
}

func ListChannelSyncStates(channelId int) ([]ChannelSyncState, error) {
	var rows []ChannelSyncState
	err := DB.Where("channel_id = ?", channelId).Order("sync_type").Find(&rows).Error
	return rows, err
}
