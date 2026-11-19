package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBuildChannelPricingReviewsUsesThresholdAndChannelModels(t *testing.T) {
	oldRatio := 2.0
	newRatio := 3.0
	smallOld, smallNew := 2.0, 2.1
	changes := []UpstreamPriceChange{
		{Kind: "price_changed", ModelID: "gpt-a", Field: "model_ratio", Old: &oldRatio, New: &newRatio},
		{Kind: "price_changed", ModelID: "gpt-a", Field: "completion_ratio", Old: &smallOld, New: &smallNew},
		{Kind: "price_changed", ModelID: "other-model", Field: "model_ratio", Old: &oldRatio, New: &newRatio},
		{Kind: "model_added", ModelID: "gpt-new"},
	}
	entries := BuildChannelPricingReviews(changes, 7, []string{"gpt-a"}, 20)
	require.Len(t, entries, 1)
	require.Equal(t, 7, entries[0].ChannelID)
	require.Equal(t, "gpt-a", entries[0].ModelName)
	require.Equal(t, "model_ratio", entries[0].Field)
	require.InDelta(t, 50, entries[0].Percent, 1e-9)
}

func TestBuildChannelPricingReviewsZeroThresholdIncludesAnyChange(t *testing.T) {
	oldRatio, newRatio := 2.0, 2.01
	changes := []UpstreamPriceChange{{
		Kind: "price_changed", ModelID: "gpt-a", Field: "model_ratio",
		Old: &oldRatio, New: &newRatio,
	}}
	require.Len(t, BuildChannelPricingReviews(changes, 7, []string{"gpt-a"}, 0), 1)
	require.Empty(t, BuildChannelPricingReviews(changes, 7, []string{"gpt-a"}, 20))
}
