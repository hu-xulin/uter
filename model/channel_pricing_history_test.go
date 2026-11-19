package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestChannelPricingHistoryRoundTrip(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&ChannelPricingHistory{}))
	previous := DB
	DB = db
	t.Cleanup(func() { DB = previous })

	require.NoError(t, AppendChannelPricingHistory(ChannelPricingHistory{
		ChannelID: 7, ModelName: "gpt-a", Source: "manual",
		OldPricing: `{"mode":"per_1m_token"}`, NewPricing: `{"mode":"per_1m_token"}`,
		ChangedAt: 100,
	}))
	require.NoError(t, AppendChannelPricingHistory(ChannelPricingHistory{
		ChannelID: 7, ModelName: "gpt-a", Source: "batch",
		OldPricing: `{"mode":"per_1m_token"}`, NewPricing: `{"mode":"per_1m_token"}`,
		ChangedAt: 200,
	}))

	rows, err := ListChannelPricingHistory(7, 10)
	require.NoError(t, err)
	require.Len(t, rows, 2)
	assert.Equal(t, "batch", rows[0].Source, "newest first")
	assert.Greater(t, rows[0].ID, int64(0))

	byID, err := GetChannelPricingHistoryByID(rows[1].ID)
	require.NoError(t, err)
	assert.Equal(t, "manual", byID.Source)
}
