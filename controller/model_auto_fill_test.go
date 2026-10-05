package controller

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// seedPresetRatioCacheForAutoFill installs a deterministic preset cache entry,
// preserving entries seeded by earlier calls so both presets can coexist.
func seedPresetRatioCacheForAutoFill(t *testing.T, presetID int, data map[string]map[string]float64) {
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

// collectAutoFillPresetPrices reproduces the preset lookup that
// autoFillOfficialPricing performs, without touching the pricing options
// database: it resolves the configured preset and fills gaps from the other.
//
// The auto-fill path is the second consumer of GetPresetModelRatios, so it needs
// the same copy-on-write discipline as resolveOfficialPrices. It previously
// grafted the fallback preset's entries straight into the shared cache, which
// corrupted the admin preset editor and made the two presets converge.
func collectAutoFillPresetPrices() map[string]map[string]float64 {
	primary, fallback := officialPricingPresetIDs()
	prices := GetPresetModelRatios(primary)
	for name, ratios := range GetPresetModelRatios(fallback) {
		if _, ok := prices[name]; !ok {
			prices[name] = ratios
		}
	}
	return prices
}

// TestAutoFillPresetLookupDoesNotMutatePresetCache is the regression guard for
// the auto-fill path's use of the process-wide preset cache.
func TestAutoFillPresetLookupDoesNotMutatePresetCache(t *testing.T) {
	official := map[string]map[string]float64{
		"official-only": {"model_ratio": 1},
	}
	modelsDev := map[string]map[string]float64{
		"shared":         {"model_ratio": 99},
		"modelsdev-only": {"model_ratio": 5},
	}
	seedPresetRatioCacheForAutoFill(t, officialRatioPresetID, official)
	seedPresetRatioCacheForAutoFill(t, modelsDevPresetID, modelsDev)

	merged := collectAutoFillPresetPrices()

	// Both presets must be represented in the merged view...
	require.Contains(t, merged, "official-only")
	require.Contains(t, merged, "modelsdev-only")
	assert.Equal(t, float64(99), merged["shared"]["model_ratio"],
		"the models.dev entry should win when models.dev is the configured source")

	// ...but the shared cache must not have been written to.
	assert.NotContains(t, official, "modelsdev-only",
		"the auto-fill lookup must not graft fallback entries into the cached official preset")
	assert.Len(t, official, 1, "official preset cache must keep exactly its own entries")
}

// TestAutoFillPresetLookupConcurrent guards the same invariant under concurrency:
// with an in-place merge, two auto-fill passes race on the shared map and the
// race detector reports a write there.
func TestAutoFillPresetLookupConcurrent(t *testing.T) {
	official := map[string]map[string]float64{"shared": {"model_ratio": 1}}
	modelsDev := map[string]map[string]float64{"extra": {"model_ratio": 5}}
	seedPresetRatioCacheForAutoFill(t, officialRatioPresetID, official)
	seedPresetRatioCacheForAutoFill(t, modelsDevPresetID, modelsDev)

	done := make(chan struct{}, 8)
	for i := 0; i < 8; i++ {
		go func() {
			defer func() { done <- struct{}{} }()
			collectAutoFillPresetPrices()
		}()
	}
	for i := 0; i < 8; i++ {
		<-done
	}
	assert.NotContains(t, official, "extra",
		"a concurrent auto-fill pass must not write into the shared preset cache")
}
