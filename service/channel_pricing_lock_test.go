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
	"gorm.io/gorm"

	"github.com/uter-ai/uter/model"
)

func TestChannelPricingSyncLockIsExclusiveAndReleasable(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.SystemTaskLock{}))
	previous := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previous })

	release, acquired, err := acquireChannelPricingSyncLock(42)
	require.NoError(t, err)
	require.True(t, acquired)

	_, second, err := acquireChannelPricingSyncLock(42)
	require.NoError(t, err)
	assert.False(t, second, "a second process must not enter the same channel sync")

	release()

	releaseAgain, third, err := acquireChannelPricingSyncLock(42)
	require.NoError(t, err)
	assert.True(t, third, "releasing the lock must let the next run proceed")
	if releaseAgain != nil {
		releaseAgain()
	}
}
