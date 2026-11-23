package service

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func bailianCatalogWithPrices(input, output string) *BailianCatalog {
	return &BailianCatalog{
		Region: BailianRegionSingapore,
		Models: []BailianModel{{
			Model: "qwen-max",
			Prices: []BailianPriceRange{{
				RangeName: "Default",
				Prices: []BailianPrice{
					{Type: "input_token", Price: input, PriceUnit: "per 1m tokens"},
					{Type: "output_token", Price: output, PriceUnit: "per 1m tokens"},
				},
			}},
		}},
	}
}

func TestBailianCatalogChangesReportsOnlyRealPriceMoves(t *testing.T) {
	changes := bailianCatalogChanges(
		bailianCatalogWithPrices("2", "4"),
		bailianCatalogWithPrices("3", "4"),
		[]string{"qwen-max"},
	)
	require.Len(t, changes, 1)
	require.Equal(t, "qwen-max", changes[0].ModelID)
	require.Equal(t, "input", changes[0].Field)
	require.Equal(t, 2.0, *changes[0].Old)
	require.Equal(t, 3.0, *changes[0].New)
}

func TestBailianCatalogChangesIgnoresMissingSnapshotsAndModels(t *testing.T) {
	require.Empty(t, bailianCatalogChanges(nil, bailianCatalogWithPrices("2", "4"), nil))
	require.Empty(t, bailianCatalogChanges(
		bailianCatalogWithPrices("2", "4"),
		bailianCatalogWithPrices("9", "9"),
		[]string{"another-model"},
	))
}

func TestRecordBailianSyncFailureBacksOffAndCaps(t *testing.T) {
	now := time.Unix(1000, 0)
	state := uterRouteChannelSyncState{}
	recordBailianSyncFailure(&state, now)
	require.Equal(t, 1, state.Failures)
	require.Equal(t, now.Add(time.Minute).Unix(), state.NextAttemptAt)

	for range 10 {
		recordBailianSyncFailure(&state, now)
	}
	require.Equal(t, 11, state.Failures)
	require.Equal(t, now.Add(time.Hour).Unix(), state.NextAttemptAt)
}
