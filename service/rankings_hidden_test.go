package service

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/model"
)

// TestRankingHiddenModelFiltering pins the invariants that keep a model hidden
// from the pricing square out of every rankings surface:
//  1. names are collected once across current totals, previous totals and
//     buckets, so a model that only shows up in one of the three is still
//     resolved against the catalog policy;
//  2. once hidden, the model disappears from totals and from every bucket, so
//     its traffic cannot resurface through the "Others" aggregate.
func TestRankingHiddenModelFiltering(t *testing.T) {
	hidden := map[string]struct{}{"secret-model": {}}

	t.Run("collects names from every source", func(t *testing.T) {
		names := rankingModelNames(
			[]model.RankingQuotaTotal{{ModelName: "current-model"}, {ModelName: "shared-model"}},
			[]model.RankingQuotaTotal{{ModelName: "previous-model"}, {ModelName: "shared-model"}},
			[]model.RankingQuotaBucket{{ModelName: "bucket-model"}},
		)
		require.ElementsMatch(t, []string{
			"current-model",
			"shared-model",
			"previous-model",
			"bucket-model",
		}, names)
	})

	t.Run("drops hidden models from totals", func(t *testing.T) {
		rows := []model.RankingQuotaTotal{
			{ModelName: "open-model", TotalTokens: 100},
			{ModelName: "secret-model", TotalTokens: 900},
		}
		require.Equal(t, []model.RankingQuotaTotal{
			{ModelName: "open-model", TotalTokens: 100},
		}, filterRankingTotals(rows, hidden))
		require.Equal(t, rows, filterRankingTotals(rows, nil))
	})

	t.Run("drops hidden models from buckets", func(t *testing.T) {
		rows := []model.RankingQuotaBucket{
			{ModelName: "open-model", Bucket: 1, Tokens: 10},
			{ModelName: "secret-model", Bucket: 1, Tokens: 90},
			{ModelName: "secret-model", Bucket: 2, Tokens: 80},
		}
		require.Equal(t, []model.RankingQuotaBucket{
			{ModelName: "open-model", Bucket: 1, Tokens: 10},
		}, filterRankingBuckets(rows, hidden))
		require.Equal(t, rows, filterRankingBuckets(rows, nil))
	})
}
