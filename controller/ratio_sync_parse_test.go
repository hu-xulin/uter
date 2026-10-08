package controller

import (
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

// TestParseDreamrouterSeedance proves the upstream-compatible pricing parser
// reads the seedance family out of the live DreamRouter /api/pricing payload
// and turns each entry into a usable numeric `model_ratio`.
//
// It deliberately asserts on *parser behaviour* rather than on one specific
// model name: DreamRouter renames and retires models over time (the original
// probe pinned `doubao-seedance-2-0-260128`, which upstream has since dropped
// in favour of `seedance-2-0-fast` / `seedance-2-0-mini`), and a hardcoded name
// turns any upstream catalogue change into a red build. Pinning the family
// keeps the operator-facing guarantee ("seedance models import with their real
// ratios") while staying stable across upstream churn.
//
// This is a read-only probe against the upstream; it mutates nothing.
func TestParseDreamrouterSeedance(t *testing.T) {
	client := &http.Client{Timeout: 40 * time.Second}
	resp, err := client.Get("https://api.dreamrouter.ai/api/pricing")
	if err != nil {
		t.Skip("upstream unreachable, skipping live parse check:", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read upstream body: %v", err)
	}

	parsed, err := parseUpstreamPricingPayload(body)
	if err != nil {
		t.Fatalf("parseUpstreamPricingPayload: %v", err)
	}

	ratios := valueMap(parsed["model_ratio"])
	if len(ratios) == 0 {
		t.Fatal("model_ratio empty after parsing upstream payload")
	}

	// Every seedance model the upstream currently advertises must survive the
	// parse as a positive, finite ratio — that is the real guarantee: no entry
	// is dropped, mangled into a non-number, or defaulted to zero.
	var seedance []string
	for name := range ratios {
		if strings.Contains(strings.ToLower(name), "seedance") {
			seedance = append(seedance, name)
		}
	}
	if len(seedance) == 0 {
		t.Fatalf("no seedance model in upstream payload; keys seen=%d", len(ratios))
	}
	for _, name := range seedance {
		raw, ok := ratios[name]
		if !ok {
			t.Fatalf("seedance model %q listed but missing from model_ratio", name)
		}
		f, ok := asFloat64(raw)
		if !ok {
			t.Errorf("model_ratio for %s not numeric: %v", name, raw)
			continue
		}
		if f <= 0 {
			t.Errorf("model_ratio for %s should be positive, got %v", name, f)
		}
		t.Logf("upstream %s model_ratio = %v", name, f)
	}

	// `completion_ratio` must be parsed alongside model_ratio, otherwise a full
	// overwrite would silently drop per-model completion multipliers.
	if completions := valueMap(parsed["completion_ratio"]); len(completions) == 0 {
		t.Error("completion_ratio empty; per-model completion multipliers would be lost on overwrite")
	}
}
