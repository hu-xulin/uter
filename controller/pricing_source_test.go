package controller

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// seedPresetRatioCache installs a deterministic preset cache entry, preserving
// any entries seeded by earlier calls so several presets can coexist. The
// returned function restores the previous cache state.
func seedPresetRatioCache(t *testing.T, presetID int, data map[string]map[string]float64) {
	t.Helper()
	presetRatioCacheMu.Lock()
	previous := presetRatioCache
	restored := make(map[int]*presetRatioCacheEntry, len(presetRatioCache)+1)
	for id, entry := range presetRatioCache {
		restored[id] = entry
	}
	restored[presetID] = &presetRatioCacheEntry{data: data, fetchedAt: time.Now()}
	presetRatioCache = restored
	presetRatioCacheMu.Unlock()
	t.Cleanup(func() {
		presetRatioCacheMu.Lock()
		presetRatioCache = previous
		presetRatioCacheMu.Unlock()
	})
}

// TestResolveOfficialPricesDoesNotMutatePresetCache locks the invariant that the
// plaza reference-price lookup never writes into the shared preset cache.
//
// GetPresetModelRatios hands out the cached map itself, so filling the gaps of
// the reference preset from the fallback preset in place would permanently
// graft the fallback's entries into the cached official preset. That corrupts
// the admin preset editor (which serves the same cache) and makes the two
// presets converge, silently defeating the pricing-source choice.
func TestResolveOfficialPricesDoesNotMutatePresetCache(t *testing.T) {
	official := map[string]map[string]float64{
		"shared-model": {"p": 1},
		"official-only": {
			"p": 2,
		},
	}
	modelsDev := map[string]map[string]float64{
		"shared-model":   {"p": 99},
		"modelsdev-only": {"p": 5},
	}

	seedPresetRatioCache(t, officialRatioPresetID, official)
	seedPresetRatioCache(t, modelsDevPresetID, modelsDev)

	merged := resolveOfficialPrices("official")

	// The reference preset wins for models it covers...
	require.Contains(t, merged, "shared-model")
	assert.Equal(t, float64(1), merged["shared-model"]["p"], "reference preset must win")
	// ...and the fallback only fills genuine gaps.
	require.Contains(t, merged, "modelsdev-only")
	assert.Equal(t, float64(5), merged["modelsdev-only"]["p"])

	// The shared cache must be untouched.
	assert.NotContains(t, official, "modelsdev-only",
		"GetPresetModelRatios returns the cached map; resolving must not graft fallback entries into it")
	assert.Len(t, official, 2, "official preset cache must keep exactly its own entries")
}

// TestResolveOfficialPricesIsRepeatable guards the follow-on symptom of a cache
// mutation: once polluted, two different pricing sources would return the very
// same reference prices, so the source choice would have no observable effect.
func TestResolveOfficialPricesIsRepeatable(t *testing.T) {
	official := map[string]map[string]float64{
		"shared-model": {"p": 1},
	}
	modelsDev := map[string]map[string]float64{
		"shared-model": {"p": 99},
	}
	seedPresetRatioCache(t, officialRatioPresetID, official)
	seedPresetRatioCache(t, modelsDevPresetID, modelsDev)

	fromOfficial := resolveOfficialPrices("official")
	fromModelsDev := resolveOfficialPrices("models.dev")

	assert.Equal(t, float64(1), fromOfficial["shared-model"]["p"])
	assert.Equal(t, float64(99), fromModelsDev["shared-model"]["p"],
		"switching the pricing source must actually change the reference price")
}

// TestResolveOfficialPricesChannelUsesPrimaryPreset pins the new priority: the
// platform ("channel") source compares against the models.dev primary preset,
// not the basellm one.
func TestResolveOfficialPricesChannelUsesPrimaryPreset(t *testing.T) {
	official := map[string]map[string]float64{"m": {"p": 1}}
	modelsDev := map[string]map[string]float64{"m": {"p": 99}}
	seedPresetRatioCache(t, officialRatioPresetID, official)
	seedPresetRatioCache(t, modelsDevPresetID, modelsDev)

	merged := resolveOfficialPrices("channel")
	assert.Equal(t, float64(99), merged["m"]["p"])
}

// TestResolveOfficialPricesUnknownSourceFallsBack makes sure a corrupt or
// missing option value degrades to the models.dev primary preset instead of
// yielding an empty reference map.
func TestResolveOfficialPricesUnknownSourceFallsBack(t *testing.T) {
	seedPresetRatioCache(t, officialRatioPresetID, map[string]map[string]float64{"m": {"p": 1}})
	seedPresetRatioCache(t, modelsDevPresetID, map[string]map[string]float64{"m": {"p": 99}})

	merged := resolveOfficialPrices("nonsense")
	assert.Equal(t, float64(99), merged["m"]["p"])
}

// TestNormalizePricingSourceDefaultsToModelsDev locks the primary-source
// migration: fresh installs and corrupt option values use models.dev, while
// every explicit operator selection remains selectable.
func TestNormalizePricingSourceDefaultsToModelsDev(t *testing.T) {
	for _, raw := range []string{"", "  ", "garbage", "MODELS.DEV"} {
		assert.Equal(t, "models.dev", normalizePricingSource(raw), "raw=%q", raw)
	}
	for _, explicit := range []string{"official", "models.dev", "channel"} {
		assert.Equal(t, explicit, normalizePricingSource(explicit))
	}
}

// TestMergeOfficialPriceSourcesCatalogueWins guards the reason the source
// setting exists at all: the chosen catalogue must win over the channel-sync
// reference, which may only fill names the catalogue does not carry.
func TestMergeOfficialPriceSourcesCatalogueWins(t *testing.T) {
	catalogue := map[string]map[string]float64{"shared": {"p": 99}}
	channel := map[string]map[string]float64{
		"shared":       {"p": 1},
		"channel-only": {"p": 3},
	}
	fallback := map[string]map[string]float64{
		"shared":        {"p": 2},
		"channel-only":  {"p": 4},
		"fallback-only": {"p": 5},
	}

	merged := mergeOfficialPriceSources(catalogue, channel, fallback)

	assert.Equal(t, float64(99), merged["shared"]["p"], "catalogue must win over the channel reference")
	assert.Equal(t, float64(3), merged["channel-only"]["p"], "channel reference fills genuine gaps")
	assert.Equal(t, float64(5), merged["fallback-only"]["p"])
	// Inputs are shared cached maps in production; merging must not write to them.
	assert.Len(t, catalogue, 1)
	assert.Len(t, channel, 2)
}

// TestResolveOfficialPricesConcurrentCalls runs the lookup concurrently to
// surface any write to the shared cache: under the race detector an in-place
// gap fill reports a data race between requests.
func TestResolveOfficialPricesConcurrentCalls(t *testing.T) {
	official := map[string]map[string]float64{"shared": {"p": 1}}
	modelsDev := map[string]map[string]float64{"extra": {"p": 5}}
	seedPresetRatioCache(t, officialRatioPresetID, official)
	seedPresetRatioCache(t, modelsDevPresetID, modelsDev)

	done := make(chan struct{})
	for i := 0; i < 8; i++ {
		go func() {
			defer func() { done <- struct{}{} }()
			resolveOfficialPrices("official")
		}()
	}
	for i := 0; i < 8; i++ {
		<-done
	}
	assert.NotContains(t, official, "extra")
}
