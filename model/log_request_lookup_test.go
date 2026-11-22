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

func TestFindNearestConsumeRequestID(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Log{}))
	previous := DB
	DB = db
	t.Cleanup(func() { DB = previous })

	require.NoError(t, db.Create(&Log{Type: LogTypeConsume, ChannelId: 7, ModelName: "m", CreatedAt: 1000, RequestId: "near"}).Error)
	require.NoError(t, db.Create(&Log{Type: LogTypeConsume, ChannelId: 7, ModelName: "m", CreatedAt: 1100, RequestId: "far"}).Error)

	got, err := FindNearestConsumeRequestID(7, "m", 1005, 60)
	require.NoError(t, err)
	assert.Equal(t, "near", got)

	got, err = FindNearestConsumeRequestID(7, "m", 5000, 60)
	require.NoError(t, err)
	assert.Empty(t, got)
}
