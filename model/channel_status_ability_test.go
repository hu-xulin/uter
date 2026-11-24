package model

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/pkg/testdb"
)

// A channel can end up with status=Enabled but stale abilities whose enabled
// flag is false (draft import, async model add, or an ID reused after a delete).
// The pricing page only reads abilities.enabled=1, so such a channel is
// invisible even though the admin sees it enabled. Re-applying "Enable" must
// heal the drift, not short-circuit because the status column already matches.
func TestUpdateChannelStatusRepairsDriftedAbilities(t *testing.T) {
	testdb.RequireDisposable(t, DB, LOG_DB)

	channel := &Channel{
		Type:   constant.ChannelTypeUterRoute,
		Name:   "drifted",
		Key:    "sk-drifted",
		Status: common.ChannelStatusEnabled,
		Group:  "default",
		Models: "m-a,m-b",
	}
	require.NoError(t, DB.Create(channel).Error)
	for _, name := range []string{"m-a", "m-b"} {
		require.NoError(t, DB.Create(&Ability{
			Group: "default", Model: name, ChannelId: channel.Id, Enabled: false,
		}).Error)
	}

	// Cache can also be stale at the target status; mirror the production case.
	if common.MemoryCacheEnabled {
		CacheUpdateChannel(channel)
	}

	changed := UpdateChannelStatus(channel.Id, "", common.ChannelStatusEnabled, "manual operation")
	// The status column did not change, so callers still get "no change".
	require.False(t, changed)

	var enabled, disabled int64
	require.NoError(t, DB.Model(&Ability{}).Where("channel_id = ? AND enabled = ?", channel.Id, true).Count(&enabled).Error)
	require.NoError(t, DB.Model(&Ability{}).Where("channel_id = ? AND enabled = ?", channel.Id, false).Count(&disabled).Error)
	require.EqualValues(t, 2, enabled, "re-applying Enable must heal drifted abilities")
	require.Zero(t, disabled)
}
