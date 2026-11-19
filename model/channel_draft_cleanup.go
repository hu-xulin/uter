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

import "time"

// DraftChannelMaxAge is how long an abandoned create-wizard draft survives.
const DraftChannelMaxAge = 24 * time.Hour

// IsExpiredDraftChannel reports whether a channel is a draft older than the
// cutoff. Disabled ordinary channels are never selected.
func IsExpiredDraftChannel(channel Channel, cutoff int64) bool {
	if channel.Status != 0 || channel.CreatedTime <= 0 || channel.CreatedTime >= cutoff {
		return false
	}
	return channel.GetOtherSettings().Draft
}

// DeleteExpiredDraftChannels removes abandoned drafts. It only deletes channels
// that are disabled and still carry the draft flag, so a manually disabled
// production channel is never removed.
func DeleteExpiredDraftChannels(now time.Time) (int64, error) {
	cutoff := now.Add(-DraftChannelMaxAge).Unix()
	var channels []Channel
	if err := DB.Where("status = ?", 0).Find(&channels).Error; err != nil {
		return 0, err
	}
	ids := make([]int, 0)
	for _, channel := range channels {
		if IsExpiredDraftChannel(channel, cutoff) {
			ids = append(ids, channel.Id)
		}
	}
	if len(ids) == 0 {
		return 0, nil
	}
	return BatchDeleteChannels(ids)
}
