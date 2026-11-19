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

// DraftChannelCleanupTask removes drafts abandoned for more than 24 hours.
// Only channels that are disabled and still marked as drafts are deleted.
func DraftChannelCleanupTask() {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	cleanupDraftChannels()
	for range ticker.C {
		cleanupDraftChannels()
	}
}

func cleanupDraftChannels() {
	deleted, err := model.DeleteExpiredDraftChannels(time.Now())
	if err != nil {
		common.SysError(common.LogText("draft channel cleanup failed: %s", err.Error()))
		return
	}
	if deleted > 0 {
		common.SysLog(common.LogText("removed %d expired draft channel(s)", deleted))
	}
}
