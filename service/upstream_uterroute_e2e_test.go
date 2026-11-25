package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

// This suite runs the WHOLE UterRoute pricing pipeline against a captured real
// response from https://dreamrouter.ai/api/pricing. It is the regression net
// for "accurately and completely obtain model info, official prices and
// channel prices": fetch -> parse -> group chain -> official view -> billable
// record. Each step has its own test so a failure names the broken stage.

// loadLivePricingFixture returns the captured upstream response byte-for-byte.
func loadLivePricingFixture(t *testing.T) []byte {
	t.Helper()
	raw, err := os.ReadFile("testdata/uterroute-pricing-live.json")
	require.NoError(t, err, "captured live pricing fixture must exist")
	var probe struct {
		Success bool `json:"success"`
		Data    []struct {
			ModelName string `json:"model_name"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(raw, &probe))
	require.True(t, probe.Success)
	require.NotEmpty(t, probe.Data)
	return raw
}

// fetchLiveSnapshot serves the captured response through the real HTTP fetch
// path, so parsing, filtering and normalization are all exercised.
func fetchLiveSnapshot(t *testing.T) *UpstreamSnapshot {
	t.Helper()
	raw := loadLivePricingFixture(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(raw)
	}))
	t.Cleanup(server.Close)
	snapshot, err := FetchUterRouteUpstream(context.Background(), server.URL)
	require.NoError(t, err)
	return snapshot
}

// Step 1 — completeness of model information.
func TestUterRouteLiveCatalogCompleteness(t *testing.T) {
	snapshot := fetchLiveSnapshot(t)

	// The live response has 85 models; none may be silently dropped.
	require.Len(t, snapshot.Models, 85, "all published models must be captured")
	require.Empty(t, snapshot.ExcludedModels, "no model in the live response is explicitly hidden")

	byName := make(map[string]UpstreamModelRecord, len(snapshot.Models))
	for _, m := range snapshot.Models {
		byName[m.ModelName] = m
	}

	// Regression: these three have no vendor_id key. The old `vendor_id <= 0`
	// filter treated a missing key as hidden and deleted them on every sync.
	for _, name := range []string{"MiniMax-M2.5", "MiniMax-H3", "MiniMax-H3-Max"} {
		require.Contains(t, byName, name, "%s must be kept (vendor unlabelled, not hidden)", name)
		require.NotNil(t, byName[name].OfficialPrice, "%s must carry an official price reference", name)
	}

	// Auxiliary pricing dimensions published by the page must be preserved.
	// No billing decision is made from them here — only that nothing is lost.
	require.NotNil(t, byName["gemini-3.5-flash"].CacheStoragePriceUSD)
	require.Equal(t, 1.0, *byName["gemini-3.5-flash"].CacheStoragePriceUSD)
	require.NotNil(t, byName["gpt-image-2.6-flare"].ImageRatio)
	require.Equal(t, 1.6, *byName["gpt-image-2.6-flare"].ImageRatio)
	require.NotNil(t, byName["gemini-3.1-flash-lite"].AudioRatio)
	require.Equal(t, 2.0, *byName["gemini-3.1-flash-lite"].AudioRatio)
	require.Equal(t, "Meta", byName["muse-spark-1.2"].Icon)

	// Group metadata that drives the channel price must be fully captured.
	require.NotEmpty(t, snapshot.AutoGroups)
	require.NotEmpty(t, snapshot.GroupRatio)
	require.NotEmpty(t, snapshot.GroupGroupRatio)
	require.NotEmpty(t, snapshot.UsableGroups)
	require.NotEmpty(t, snapshot.PricingVersion)
}

// Step 2 — official price shape for every model.
func TestUterRouteLiveOfficialPricesAreComplete(t *testing.T) {
	snapshot := fetchLiveSnapshot(t)
	billingGroup := "default"
	for _, m := range snapshot.Models {
		view, _ := uterRouteChannelOfficialPricing(snapshot, m, snapshot.FetchedAt.Unix(), billingGroup)
		assert.NotEmpty(t, view.PriceKind, "%s: price kind must be classified", m.ModelName)
		assert.NotEmpty(t, view.Source, "%s: price source must be recorded", m.ModelName)
		assert.NotEmpty(t, view.Tiers, "%s: official tier must remain visible for operators", m.ModelName)
		// Expression models must keep an executable rule with a hash.
		if strings.TrimSpace(m.BillingExpr) != "" && m.PriceStatus != "HISTORICAL_SNAPSHOT" {
			assert.NotEmpty(t, view.BillingExpr, "%s: expression must be preserved", m.ModelName)
			assert.NotEmpty(t, view.ExpressionHash, "%s: expression hash must be recorded", m.ModelName)
		}
	}
}

// Step 3 — channel price chain on the real catalogue. Every model that the
// default group can settle under must resolve a group, a ratio and a
// discounted channel price. Fail-closed rows are allowed but must be explicit.
func TestUterRouteLiveChannelPricesResolveChain(t *testing.T) {
	snapshot := fetchLiveSnapshot(t)
	resolved, failClosed := 0, 0
	for _, m := range snapshot.Models {
		ratio, group, ok := UterRouteDiscountForModel(snapshot, m, "default")
		if !ok {
			failClosed++
			continue
		}
		resolved++
		assert.NotEmpty(t, group, "%s: chain must name the settlement group", m.ModelName)
		assert.True(t, ratio > 0, "%s: chain ratio must be positive, got %v", m.ModelName, ratio)
		view, _ := uterRouteChannelOfficialPricing(snapshot, m, snapshot.FetchedAt.Unix(), "default")
		if assert.NotNil(t, view.ChannelPrice, "%s: channel price must exist when chain resolves", m.ModelName) {
			// Token models use input_per_million_usd; media models use
			// per_unit_usd (per second/call). Either shape is a real price.
			hasPrice := view.ChannelPrice.InputPerMillionUSD != nil ||
				view.ChannelPrice.PerUnitUSD != nil ||
				view.ChannelPrice.OutputPerMillionUSD != nil
			assert.True(t, hasPrice, "%s: a concrete channel price must be present", m.ModelName)
		}
	}
	assert.Positive(t, resolved, "at least some models must resolve a channel price")
	t.Logf("live catalogue: %d models resolved a channel price, %d fail-closed", resolved, failClosed)
}

// Step 4 — end-to-end record generation with the real channel-1249 model list
// and alias mapping. Every selected alias must map back to a priced row.
func TestUterRouteLiveChannel1249RecordsComplete(t *testing.T) {
	withReferenceBillingAuthorization(t, "") // authorized default
	snapshot := fetchLiveSnapshot(t)

	channelModels := make([]string, 0, len(snapshot.Models))
	for _, m := range snapshot.Models {
		channelModels = append(channelModels, m.ModelName, m.ModelName+"-dr")
	}
	mapping := make(map[string]string, len(snapshot.Models))
	for _, m := range snapshot.Models {
		mapping[m.ModelName+"-dr"] = m.ModelName
	}
	mappingRaw, err := json.Marshal(mapping)
	require.NoError(t, err)

	records, err := UterRouteChannelPricingRecordsWithMapping(
		snapshot, 1249, channelModels, "default", string(mappingRaw),
	)
	require.NoError(t, err)
	// Raw + alias for every model: two rows per upstream model.
	require.Len(t, records, 2*len(snapshot.Models))
	for _, rec := range records {
		assert.NotEmpty(t, rec.OfficialPricing, "%s: raw official pricing must be stored", rec.ModelName)
		assert.NotEmpty(t, rec.NormalizedPricing, "%s: normalized view must be stored", rec.ModelName)
		assert.NotContains(t, rec.NormalizedPricing, `"needs_review":true`,
			"%s: authorized reference rows must be billable", rec.ModelName)
		assert.NotEmpty(t, rec.InternalPricing, "%s: a billable sale price must be generated", rec.ModelName)
	}

	// The three unlabelled-vendor models must now produce rows under both names.
	var miniMaxRows int
	for _, rec := range records {
		if strings.HasPrefix(rec.ModelName, "MiniMax-") {
			miniMaxRows++
		}
	}
	require.Equal(t, 6, miniMaxRows, "three MiniMax models x two aliases must be priced")
}

// Step 5 — the billing rule produced for every record must actually execute.
func TestUterRouteLiveBillingRulesExecute(t *testing.T) {
	withReferenceBillingAuthorization(t, "") // authorized default
	snapshot := fetchLiveSnapshot(t)
	channelModels := make([]string, 0, len(snapshot.Models))
	for _, m := range snapshot.Models {
		channelModels = append(channelModels, m.ModelName)
	}
	records, err := UterRouteChannelPricingRecords(snapshot, 1249, channelModels, "default")
	require.NoError(t, err)
	for _, rec := range records {
		require.NotEmpty(t, rec.InternalPricing, "%s: must carry a billing rule", rec.ModelName)
		var pricing model.ChannelInternalPricing
		require.NoError(t, common.UnmarshalJsonStr(rec.InternalPricing, &pricing),
			"%s: internal pricing must be valid JSON", rec.ModelName)
		if pricing.BillingExpr != "" {
			require.NotEmpty(t, pricing.Mode, "%s: expression pricing needs a mode", rec.ModelName)
		}
	}
}

// Step 6 — the authorization flag must be the ONLY thing that parks reference
// rows. With it disabled, the same live catalogue fails closed again.
func TestUterRouteLiveReferenceBillingFailClosedWhenDisabled(t *testing.T) {
	withReferenceBillingAuthorization(t, "false")
	snapshot := fetchLiveSnapshot(t)
	channelModels := make([]string, 0, len(snapshot.Models))
	for _, m := range snapshot.Models {
		channelModels = append(channelModels, m.ModelName)
	}
	records, err := UterRouteChannelPricingRecords(snapshot, 1249, channelModels, "default")
	require.NoError(t, err)
	var parked, billable int
	for _, rec := range records {
		if strings.Contains(rec.NormalizedPricing, `"needs_review":true`) {
			parked++
			assert.Empty(t, rec.InternalPricing, "%s: parked rows must not bill", rec.ModelName)
		} else {
			billable++
		}
	}
	assert.Positive(t, parked, "disabling the flag must park reference rows")
	assert.Positive(t, billable, "non-reference rows stay billable")
	t.Logf("authorization disabled: %d rows parked, %d rows billable", parked, billable)
}
