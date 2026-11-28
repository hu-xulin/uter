package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func floatPtr(v float64) *float64 { return &v }

func TestUterRouteOfficialPriceDriftChangesDetectsAbsoluteInputDrift(t *testing.T) {
	prev := &UpstreamSnapshot{
		ProviderID: "uterroute",
		Models: []UpstreamModelRecord{{
			ModelName:     "model-a",
			OfficialPrice: &UpstreamPriceLine{Input: floatPtr(1), Currency: "USD", Unit: "per_1m_token"},
		}},
	}
	next := &UpstreamSnapshot{
		ProviderID:     "uterroute",
		PricingVersion: "v2",
		Models: []UpstreamModelRecord{{
			ModelName:     "model-a",
			OfficialPrice: &UpstreamPriceLine{Input: floatPtr(2), Currency: "USD", Unit: "per_1m_token"},
		}},
	}

	changes := UterRouteOfficialPriceDriftChanges(prev, next)
	require.Len(t, changes, 1, "a doubled absolute official price must surface as a drift change")
	require.Equal(t, "price_changed", changes[0].Kind)
	require.Equal(t, "official_input_usd", changes[0].Field)
	require.NotNil(t, changes[0].Old)
	require.NotNil(t, changes[0].New)
	require.Equal(t, float64(1), *changes[0].Old)
	require.Equal(t, float64(2), *changes[0].New)
	require.Equal(t, "v2", changes[0].PricingVersion, "review staleness check needs the new snapshot version")
}

func TestUterRouteOfficialPriceDriftChangesIgnoresUnchangedAndUnpricedModels(t *testing.T) {
	prev := &UpstreamSnapshot{
		ProviderID: "uterroute",
		Models: []UpstreamModelRecord{
			{ModelName: "same", OfficialPrice: &UpstreamPriceLine{Input: floatPtr(1)}},
			{ModelName: "unpriced-before"},
		},
	}
	next := &UpstreamSnapshot{
		ProviderID: "uterroute",
		Models: []UpstreamModelRecord{
			{ModelName: "same", OfficialPrice: &UpstreamPriceLine{Input: floatPtr(1)}},
			{ModelName: "unpriced-before", OfficialPrice: &UpstreamPriceLine{Input: floatPtr(3)}},
		},
	}

	require.Empty(t,
		UterRouteOfficialPriceDriftChanges(prev, next),
		"unchanged prices and newly priced models are not drifts (model_added covers the latter)",
	)
}

func TestUterRouteOfficialPriceDriftChangesHandlesMissingCurrentPrice(t *testing.T) {
	prev := &UpstreamSnapshot{
		ProviderID: "uterroute",
		Models: []UpstreamModelRecord{{
			ModelName:     "lost-price",
			OfficialPrice: &UpstreamPriceLine{Input: floatPtr(4)},
		}},
	}
	next := &UpstreamSnapshot{
		ProviderID: "uterroute",
		Models: []UpstreamModelRecord{{
			ModelName: "lost-price",
		}},
	}

	changes := UterRouteOfficialPriceDriftChanges(prev, next)
	require.Len(t, changes, 1, "losing a previously positive official price is a fail-closed drift")
	require.NotNil(t, changes[0].New)
	require.Equal(t, float64(0), *changes[0].New)
}

func TestUterRouteOfficialPriceDriftChangesComparesAllTokenTiers(t *testing.T) {
	prev := &UpstreamSnapshot{
		ProviderID: "uterroute",
		Models: []UpstreamModelRecord{{
			ModelName: "multi",
			OfficialPrice: &UpstreamPriceLine{
				Input: floatPtr(1), Output: floatPtr(2), CacheRead: floatPtr(3), CacheWrite: floatPtr(4),
			},
		}},
	}
	next := &UpstreamSnapshot{
		ProviderID: "uterroute",
		Models: []UpstreamModelRecord{{
			ModelName: "multi",
			OfficialPrice: &UpstreamPriceLine{
				Input: floatPtr(1), Output: floatPtr(2), CacheRead: floatPtr(9), CacheWrite: floatPtr(4),
			},
		}},
	}

	changes := UterRouteOfficialPriceDriftChanges(prev, next)
	require.Len(t, changes, 1, "a cache-read jump must be detected even when input/output are unchanged")
	require.Equal(t, "official_cache_read_usd", changes[0].Field)
}

func TestExpandUterRouteDriftToServedNamesHonorsBatchRedirect(t *testing.T) {
	changes := []UpstreamPriceChange{{
		Kind: "price_changed", ModelID: "upstream-alpha", Field: "official_input_usd",
		Old: floatPtr(1), New: floatPtr(3),
	}}
	// The channel exposes request aliases; the upstream name is mapped away.
	mapping := `{"alias-one":"upstream-alpha","alias-two":"upstream-alpha"}`
	expanded := expandUterRouteDriftToServedNames(changes, []string{"alias-one", "alias-two", "unrelated"}, mapping)
	require.Len(t, expanded, 2, "a redirect must produce one review per served alias")
	require.Equal(t, "alias-one", expanded[0].ModelID)
	require.Equal(t, "alias-two", expanded[1].ModelID)

	filtered := expandUterRouteDriftToServedNames(changes, []string{"unrelated"}, mapping)
	require.Empty(t, filtered, "a model the channel does not serve must not raise its review")
}

func TestExcludeModelsAwaitingReview(t *testing.T) {
	pending := []ChannelPricingReviewEntry{
		{ModelName: "large", Field: "official_input_usd"},
		{ModelName: "another", Field: "model_ratio"},
	}
	changed := []string{"small", "large", "another", "plain"}
	kept := excludeModelsAwaitingReview(changed, pending)
	require.Equal(t, []string{"small", "plain"}, kept,
		"a model with a pending price review must not be repriced until a human decides")
}

func TestBuildUterRouteDriftReviewsUsesPercentThreshold(t *testing.T) {
	changes := []UpstreamPriceChange{
		{Kind: "price_changed", ModelID: "small", Field: "official_input_usd", Old: floatPtr(1), New: floatPtr(1.2)},
		{Kind: "price_changed", ModelID: "large", Field: "official_input_usd", Old: floatPtr(1), New: floatPtr(2)},
	}
	reviews := BuildChannelPricingReviews(changes, 7, []string{"small", "large"}, DefaultUterRouteOfficialDriftPercent)
	require.Len(t, reviews, 1, "only drift above 50% reaches a human review")
	require.Equal(t, "large", reviews[0].ModelName)
	require.GreaterOrEqual(t, reviews[0].Percent, float64(DefaultUterRouteOfficialDriftPercent))
}
