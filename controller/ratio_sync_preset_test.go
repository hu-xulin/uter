package controller

import (
	"math"
	"testing"
)

func nearlyEqFloat(a, b float64) bool {
	return math.Abs(a-b) < 1e-9
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
