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

// TestResolveOfficialPricesChannelUsesOfficialPreset pins the documented
// fallback: the platform ("channel") source still compares against the
// canonical official preset.
func TestResolveOfficialPricesChannelUsesOfficialPreset(t *testing.T) {
	official := map[string]map[string]float64{"m": {"p": 1}}
	modelsDev := map[string]map[string]float64{"m": {"p": 99}}
	seedPresetRatioCache(t, officialRatioPresetID, official)
	seedPresetRatioCache(t, modelsDevPresetID, modelsDev)

	merged := resolveOfficialPrices("channel")
	assert.Equal(t, float64(1), merged["m"]["p"])
}

// TestResolveOfficialPricesUnknownSourceFallsBack makes sure a corrupt or
// missing option value degrades to the official preset instead of yielding an
// empty reference map.
func TestResolveOfficialPricesUnknownSourceFallsBack(t *testing.T) {
	seedPresetRatioCache(t, officialRatioPresetID, map[string]map[string]float64{"m": {"p": 1}})
	seedPresetRatioCache(t, modelsDevPresetID, map[string]map[string]float64{"m": {"p": 99}})

	merged := resolveOfficialPrices("nonsense")
	assert.Equal(t, float64(1), merged["m"]["p"])
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
