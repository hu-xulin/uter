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
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

// RecordChannelSyncOutcome stores one attempt for each affected sync type.
// A combined sync (catalogue + price in one pass) records both rows with the
// same outcome; a failure before either half runs marks both as failed.
func RecordChannelSyncOutcome(channelID int, provider string, startedAt int64, fetched, written, skipped, removed int, summary string, syncErr error, syncTypes ...string) {
	if channelID <= 0 {
		return
	}
	successAt := int64(0)
	lastError := ""
	if syncErr == nil {
		successAt = time.Now().Unix()
	} else {
		lastError = syncErr.Error()
	}
	for _, syncType := range syncTypes {
		state := model.ChannelSyncState{
			ChannelId: channelID, Provider: provider, SyncType: syncType,
			LastStartedAt: startedAt, LastSuccessAt: successAt, LastError: lastError,
			Fetched: fetched, Written: written, Skipped: skipped, Removed: removed,
			ChangeSummary: summary,
		}
		if err := model.SaveChannelSyncState(state); err != nil {
			common.SysError(common.LogText("save channel sync state failed: channel_id=%d type=%s, error=%v", channelID, syncType, err))
		}
	}
}
