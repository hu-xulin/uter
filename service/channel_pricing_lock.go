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
	"errors"
	"fmt"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

// ErrPricingSyncInProgress means another process already holds the channel's
// sync lock. Callers must skip this run rather than write a competing catalog.
var ErrPricingSyncInProgress = errors.New("channel pricing sync is already running")

const channelPricingSyncLockTTL = 10 * time.Minute

// AcquireChannelPricingSyncLock is the exported form used by controller-level
// manual syncs. Release must be called when acquired is true.
func AcquireChannelPricingSyncLock(channelID int) (func(), bool, error) {
	return acquireChannelPricingSyncLock(channelID)
}

// acquireChannelPricingSyncLock claims the cross-instance lock for one channel.
// The returned release function is safe to call only when acquired is true.
func acquireChannelPricingSyncLock(channelID int) (func(), bool, error) {
	if channelID <= 0 || model.DB == nil || !model.DB.Migrator().HasTable(&model.SystemTaskLock{}) {
		return func() {}, true, nil
	}
	owner, err := common.GenerateRandomCharsKey(16)
	if err != nil {
		return nil, false, err
	}
	lockName := fmt.Sprintf("channel_price_sync:%d", channelID)
	acquired, err := model.TryAcquireSystemTaskLock(
		lockName, lockName, owner,
		time.Now().Add(channelPricingSyncLockTTL).Unix(),
	)
	if err != nil || !acquired {
		return nil, acquired, err
	}
	release := func() {
		if err := model.ReleaseSystemTaskLock(lockName, owner); err != nil {
			common.SysError(common.LogText("release channel pricing lock failed: channel_id=%d, error=%v", channelID, err))
		}
	}
	return release, true, nil
}
