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

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/pkg/testdb"
)

func TestGetAllEnableAbilityWithChannelsExcludesDeletedChannels(t *testing.T) {
	testdb.RequireDisposable(t, DB, LOG_DB)
	require.NoError(t, DB.Exec("DELETE FROM abilities").Error)
	require.NoError(t, DB.Exec("DELETE FROM channels").Error)

	active := &Channel{
		Type: constant.ChannelTypeOpenAI, Name: "active", Key: "sk-active",
		Status: common.ChannelStatusEnabled, Group: "default",
	}
	require.NoError(t, DB.Create(active).Error)
	require.NoError(t, DB.Create(&Ability{
		Group: "default", Model: "active-model", ChannelId: active.Id, Enabled: true,
	}).Error)

	deleted := &Channel{
		Type: constant.ChannelTypeOpenAI, Name: "deleted", Key: "sk-deleted",
		Status: common.ChannelStatusEnabled, Group: "default",
	}
	require.NoError(t, DB.Create(deleted).Error)
	require.NoError(t, DB.Create(&Ability{
		Group: "default", Model: "deleted-model", ChannelId: deleted.Id, Enabled: true,
	}).Error)
	require.NoError(t, DB.Delete(&Channel{}, deleted.Id).Error)

	abilities, err := GetAllEnableAbilityWithChannels()
	require.NoError(t, err)
	require.Len(t, abilities, 1)
	require.Equal(t, "active-model", abilities[0].Model)
	require.Equal(t, active.Id, abilities[0].ChannelId)
}

func TestAbilityDriftDetectionAndRebuild(t *testing.T) {
	testdb.RequireDisposable(t, DB, LOG_DB)
	require.NoError(t, DB.Exec("DELETE FROM abilities").Error)
	require.NoError(t, DB.Exec("DELETE FROM channels").Error)

	channel := &Channel{
		Type: constant.ChannelTypeUterRoute, Name: "drifted", Key: "sk-drift",
		Status: common.ChannelStatusEnabled, Group: "default", Models: "m-a,m-b",
	}
	require.NoError(t, DB.Create(channel).Error)
	require.NoError(t, DB.Create(&Ability{
		Group: "default", Model: "m-a", ChannelId: channel.Id, Enabled: false,
	}).Error)

	drift, err := HasAbilityStatusDrift()
	require.NoError(t, err)
	require.True(t, drift, "an enabled channel with disabled abilities must be detected")

	require.NoError(t, RebuildChannelAbilities(channel.Id))
	var rebuilt []Ability
	require.NoError(t, DB.Where("channel_id = ?", channel.Id).Find(&rebuilt).Error)
	require.Len(t, rebuilt, 2, "rebuild follows the channel's final model list")
	for _, ability := range rebuilt {
		assert.True(t, ability.Enabled)
		assert.Equal(t, "default", ability.Group)
	}

	drift, err = HasAbilityStatusDrift()
	require.NoError(t, err)
	require.False(t, drift, "a rebuilt channel must no longer be reported as drifted")
}
