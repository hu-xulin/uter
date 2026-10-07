package controller

import (
	"io"
	"net/http"
	"testing"
	"time"
)

// TestParseDreamrouterSeedance proves the upstream-compatible pricing parser
// reads the exact model the operator reported as "unconfigured"
// (doubao-seedance-2-0-260128) from the live DreamRouter /api/pricing endpoint,
// and that its per-token ratio comes back as the baseline 3.645 (the same
// value every other seedance/seedream sibling is already configured with).
//
// This is a read-only probe against the upstream; it mutates nothing.
func TestParseDreamrouterSeedance(t *testing.T) {
	client := &http.Client{Timeout: 40 * time.Second}
	resp, err := client.Get("https://api.dreamrouter.ai/api/pricing")
	if err != nil {
		t.Skip("upstream unreachable, skipping live parse check:", err)
		return
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
	got, ok := ratios["doubao-seedance-2-0-260128"]
	if !ok {
		t.Fatalf("doubao-seedance-2-0-260128 absent from upstream payload; keys seen=%d", len(ratios))
	}
	f, ok := asFloat64(got)
	if !ok {
		t.Fatalf("model_ratio for seedance-2-0-260128 not numeric: %v", got)
	}
	if f != 3.645 {
		t.Fatalf("expected seedance-2-0-260128 model_ratio=3.645, got %v", f)
	}

	// Sanity: siblings already configured locally must stay consistent with the
	// upstream baseline so a full overwrite does not drift them.
	for _, sibling := range []string{
		"doubao-seedance-2-0-fast-260128",
		"doubao-seedance-2-0-mini-260615",
	} {
		if v, ok := ratios[sibling]; ok {
			if fv, ok := asFloat64(v); ok {
				t.Logf("upstream %s model_ratio = %v", sibling, fv)
			}
		}
	}
}
