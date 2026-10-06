package controller

import (
	"math"
	"testing"
	"time"
)

func nearlyEqFloat(a, b float64) bool {
	return math.Abs(a-b) < 1e-9
}

func TestSiblingPresetID(t *testing.T) {
	if siblingPresetID(officialRatioPresetID) != modelsDevPresetID {
		t.Fatal("official preset should pair with the models.dev preset")
	}
	if siblingPresetID(modelsDevPresetID) != officialRatioPresetID {
		t.Fatal("models.dev preset should pair with the official preset")
	}
}

// TestGetPresetModelRatiosServesStaleWithoutBlocking locks the regression that
// made /api/pricing hang: a stale-but-present cache entry must be returned
// immediately (never blocking on the upstream fetch, which can take several
// seconds), and the returned map must be a clone so callers cannot mutate the
// shared cache.
func TestGetPresetModelRatiosServesStaleWithoutBlocking(t *testing.T) {
	const preset = modelsDevPresetID
	presetRatioCacheMu.Lock()
	presetRatioCache[preset] = &presetRatioCacheEntry{
		data:      map[string]map[string]float64{"stale-model": {"model_ratio": 1.23}},
		fetchedAt: time.Now().Add(-time.Hour), // well past the TTL
	}
	presetRatioCacheMu.Unlock()

	defer func() {
		presetRatioCacheMu.Lock()
		delete(presetRatioCache, preset)
		presetRatioCacheMu.Unlock()
	}()

	start := time.Now()
	got := GetPresetModelRatios(preset)
	elapsed := time.Since(start)

	if got["stale-model"]["model_ratio"] != 1.23 {
		t.Fatalf("stale cached value was not served immediately")
	}
	if elapsed > 2*time.Second {
		t.Fatalf("GetPresetModelRatios blocked on the external fetch (%s); SWR is broken", elapsed)
	}

	// The returned outer map must be a clone: adding a key to the result must
	// not mutate the shared cache entry.
	got["extra-model"] = map[string]float64{"model_ratio": 4.56}
	presetRatioCacheMu.Lock()
	_, leaked := presetRatioCache[preset].data["extra-model"]
	presetRatioCacheMu.Unlock()
	if leaked {
		t.Fatalf("GetPresetModelRatios leaked a mutable outer reference into the caller")
	}
}

// TestGetPresetModelRatiosNonBlockingNeverBlocks locks the guarantee for the
// /api/pricing hot path: with no cache entry it must return an empty map
// immediately (the plaza falls back to platform prices) instead of waiting on a
// slow upstream, and a warm entry must be served as-is.
func TestGetPresetModelRatiosNonBlockingNeverBlocks(t *testing.T) {
	const preset = officialRatioPresetID
	presetRatioCacheMu.Lock()
	delete(presetRatioCache, preset)
	presetRatioCacheMu.Unlock()
	defer func() {
		presetRatioCacheMu.Lock()
		delete(presetRatioCache, preset)
		presetRatioCacheMu.Unlock()
	}()

	start := time.Now()
	cold := getPresetModelRatiosNonBlocking(preset)
	elapsed := time.Since(start)
	if len(cold) != 0 {
		t.Fatalf("cold non-blocking fetch should return an empty map, got %d entries", len(cold))
	}
	if elapsed > time.Second {
		t.Fatalf("non-blocking cold path blocked for %s; it must return immediately", elapsed)
	}

	// A fresh entry must be served from cache without any fetch.
	presetRatioCacheMu.Lock()
	presetRatioCache[preset] = &presetRatioCacheEntry{
		data:      map[string]map[string]float64{"m": {"model_ratio": 2}},
		fetchedAt: time.Now(),
	}
	presetRatioCacheMu.Unlock()
	warm := getPresetModelRatiosNonBlocking(preset)
	if warm["m"]["model_ratio"] != 2 {
		t.Fatalf("warm non-blocking fetch did not serve the cached entry")
	}
}

func TestDeriveExprPriceRatios(t *testing.T) {
	tests := []struct {
		name string
		expr string
		want map[string]float64
	}{
		{
			name: "simple per-token expression",
			expr: `tier("base", p * 0.57 + c * 2.29)`,
			want: map[string]float64{
				"model_ratio":      0.285,
				"completion_ratio": 2.29 / 0.57,
			},
		},
		{
			name: "multi-tier takes the first branch",
			expr: `len <= 200000 ? tier("standard", p * 3 + c * 15 + cr * 0.3 + cc * 3.75 + cc1h * 6) : tier("long_context", p * 6 + c * 22.5)`,
			want: map[string]float64{
				"model_ratio":        1.5,
				"completion_ratio":   5,
				"cache_ratio":        0.1,
				"create_cache_ratio": 1.25,
			},
		},
		{
			name: "multimodal with audio",
			expr: `tier("base", p * 0.43 + c * 3.06 + img * 0.78 + ai * 3.81 + ao * 15.11)`,
			want: map[string]float64{
				"model_ratio":            0.215,
				"completion_ratio":       3.06 / 0.43,
				"image_ratio":            0.78 / 0.43,
				"audio_ratio":            3.81 / 0.43,
				"audio_completion_ratio": 15.11 / 3.81,
			},
		},
		{
			name: "fixed per-request price",
			expr: `tier("base", fixed(0.01))`,
			want: map[string]float64{"model_price": 0.01},
		},
		{
			name: "number-first term order",
			expr: `tier("base", 2 * p + 4 * c)`,
			want: map[string]float64{
				"model_ratio":      1,
				"completion_ratio": 2,
			},
		},
		{
			name: "input-only expression",
			expr: `tier("base", p * 1.2)`,
			want: map[string]float64{"model_ratio": 0.6},
		},
		{
			name: "no input coefficient yields nothing",
			expr: `tier("base", c * 15)`,
			want: nil,
		},
		{
			name: "non-expression input yields nothing",
			expr: `not a billing expression`,
			want: nil,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := deriveExprPriceRatios(tt.expr)
			if tt.want == nil {
				if len(got) != 0 {
					t.Fatalf("deriveExprPriceRatios(%q) = %v, want empty", tt.expr, got)
				}
				return
			}
			if len(got) != len(tt.want) {
				t.Fatalf("deriveExprPriceRatios(%q) = %v, want %v", tt.expr, got, tt.want)
			}
			for field, want := range tt.want {
				if got[field] == 0 || !nearlyEqFloat(got[field], want) {
					t.Errorf("field %s = %v, want %v", field, got[field], want)
				}
			}
		})
	}
}

func TestMergeExprDerivedRatios(t *testing.T) {
	raw := map[string]any{
		"billing_expr": map[string]any{
			"expr-model":  `tier("base", p * 2 + c * 8)`,
			"fixed-model": `tier("base", fixed(0.5))`,
			"junk-model":  123,
		},
	}
	result := map[string]map[string]float64{
		// Numeric preset fields must always win over the expression.
		"numeric-model": {"model_ratio": 0.5, "completion_ratio": 3},
	}
	raw["billing_expr"].(map[string]any)["numeric-model"] = `tier("base", p * 9)`

	mergeExprDerivedRatios(raw, result)

	entry := result["expr-model"]
	if entry == nil {
		t.Fatal("expr-model entry missing")
	}
	if !nearlyEqFloat(entry["model_ratio"], 1) {
		t.Errorf("expr-model model_ratio = %v, want 1", entry["model_ratio"])
	}
	if !nearlyEqFloat(entry["completion_ratio"], 4) {
		t.Errorf("expr-model completion_ratio = %v, want 4", entry["completion_ratio"])
	}

	entry = result["fixed-model"]
	if entry == nil {
		t.Fatal("fixed-model entry missing")
	}
	if !nearlyEqFloat(entry["model_price"], 0.5) {
		t.Errorf("fixed-model model_price = %v, want 0.5", entry["model_price"])
	}

	entry = result["numeric-model"]
	if !nearlyEqFloat(entry["model_ratio"], 0.5) {
		t.Errorf("numeric-model model_ratio = %v, want untouched 0.5", entry["model_ratio"])
	}
	if _, exists := entry["completion_ratio"]; !exists {
		t.Error("numeric-model completion_ratio should be preserved")
	}

	if _, exists := result["junk-model"]; exists {
		t.Error("junk-model should not gain an entry")
	}
}
