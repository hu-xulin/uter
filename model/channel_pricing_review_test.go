package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestChannelPricingReviewRoundTrip(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&ChannelPricingReview{}))
	previous := DB
	DB = db
	t.Cleanup(func() { DB = previous })

	require.NoError(t, AppendChannelPricingReviews([]ChannelPricingReview{
		{ChannelID: 7, ModelName: "gpt-a", Field: "model_ratio", Old: 2, New: 3, Percent: 50, CreatedAt: 100},
		{ChannelID: 8, ModelName: "gpt-a", Field: "model_ratio", Old: 2, New: 3, Percent: 50, CreatedAt: 100},
	}))
	// Re-syncing the same channel/model/field replaces the pending entry.
	require.NoError(t, AppendChannelPricingReviews([]ChannelPricingReview{
		{ChannelID: 7, ModelName: "gpt-a", Field: "model_ratio", Old: 3, New: 4, Percent: 33, CreatedAt: 200},
	}))

	rows, err := ListChannelPricingReviews(7)
	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Equal(t, 4.0, rows[0].New)

	other, err := ListChannelPricingReviews(8)
	require.NoError(t, err)
	require.Len(t, other, 1)

	require.NoError(t, ClearChannelPricingReviews(7))
	rows, err = ListChannelPricingReviews(7)
	require.NoError(t, err)
	assert.Empty(t, rows)
}

func TestChannelPricingTablesMigrateTwiceWithoutDataLoss(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&ChannelModelPricing{}, &ChannelPricingHistory{}, &ChannelPricingReview{}))
	previous := DB
	DB = db
	t.Cleanup(func() { DB = previous })

	rows := []ChannelPricingReview{{
		ChannelID: 9, ModelName: "gpt-x", Field: "input", Old: 1, New: 2, Percent: 100,
	}}
	require.NoError(t, AppendChannelPricingReviews(rows))
	require.NoError(t, db.AutoMigrate(&ChannelModelPricing{}, &ChannelPricingHistory{}, &ChannelPricingReview{}))
	listed, err := ListChannelPricingReviews(9)
	require.NoError(t, err)
	require.Len(t, listed, 1)
	require.Equal(t, "gpt-x", listed[0].ModelName)
}

func TestChannelPricingReviewDecisionKeepsHistory(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&ChannelPricingReview{}))
	previous := DB
	DB = db
	t.Cleanup(func() { DB = previous })

	require.NoError(t, AppendChannelPricingReviews([]ChannelPricingReview{
		{ChannelID: 12, ModelName: "gpt-a", Field: "input", Old: 1, New: 5, Percent: 400},
		{ChannelID: 12, ModelName: "gpt-b", Field: "input", Old: 2, New: 8, Percent: 300},
	}))
	decided, err := DecideChannelPricingReviews(12, ChannelPricingReviewStatusApproved, 3, "root", "verified upstream list")
	require.NoError(t, err)
	assert.Equal(t, int64(2), decided)

	pending, err := ListChannelPricingReviews(12)
	require.NoError(t, err)
	assert.Empty(t, pending)

	approved, err := ListChannelPricingReviewsByStatus(12, ChannelPricingReviewStatusApproved)
	require.NoError(t, err)
	require.Len(t, approved, 2)
	assert.Equal(t, "root", approved[0].ReviewerName)
	assert.Equal(t, "verified upstream list", approved[0].Note)
	assert.NotZero(t, approved[0].DecidedAt)

	// A later sync creates a new pending entry while the decision stays.
	require.NoError(t, AppendChannelPricingReviews([]ChannelPricingReview{
		{ChannelID: 12, ModelName: "gpt-a", Field: "input", Old: 5, New: 6, Percent: 20},
	}))
	pending, err = ListChannelPricingReviews(12)
	require.NoError(t, err)
	require.Len(t, pending, 1)
	approved, err = ListChannelPricingReviewsByStatus(12, ChannelPricingReviewStatusApproved)
	require.NoError(t, err)
	assert.Len(t, approved, 2)

	_, err = DecideChannelPricingReviews(12, "bogus", 0, "", "")
	require.Error(t, err)
}
