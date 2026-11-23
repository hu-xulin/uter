package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestChannelSyncStateKeepsLastSuccessOnFailure(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&ChannelSyncState{}))
	previous := DB
	DB = db
	t.Cleanup(func() { DB = previous })

	require.NoError(t, SaveChannelSyncState(ChannelSyncState{
		ChannelId: 9, SyncType: ChannelSyncTypePrices, Provider: "uterapi",
		LastStartedAt: 100, LastSuccessAt: 100, Fetched: 4, Written: 3, Skipped: 1,
		ChangeSummary: `[{"model":"gpt-a"}]`,
	}))
	require.NoError(t, SaveChannelSyncState(ChannelSyncState{
		ChannelId: 9, SyncType: ChannelSyncTypeModels, Provider: "uterapi",
		LastStartedAt: 100, LastSuccessAt: 100, Fetched: 4, Written: 4,
	}))

	// A later failed attempt must not erase the last good success.
	require.NoError(t, SaveChannelSyncState(ChannelSyncState{
		ChannelId: 9, SyncType: ChannelSyncTypePrices, Provider: "uterapi",
		LastStartedAt: 200, LastError: "upstream timeout",
	}))

	states, err := ListChannelSyncStates(9)
	require.NoError(t, err)
	require.Len(t, states, 2)
	byType := map[string]ChannelSyncState{}
	for _, state := range states {
		byType[state.SyncType] = state
	}
	assert.Equal(t, int64(100), byType[ChannelSyncTypePrices].LastSuccessAt)
	assert.Equal(t, int64(200), byType[ChannelSyncTypePrices].LastStartedAt)
	assert.Equal(t, "upstream timeout", byType[ChannelSyncTypePrices].LastError)
	assert.Empty(t, byType[ChannelSyncTypePrices].ChangeSummary)
	assert.Equal(t, int64(100), byType[ChannelSyncTypeModels].LastSuccessAt)
}
