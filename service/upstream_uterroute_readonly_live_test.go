//go:build uterroute_live_readonly

package service

import (
	"context"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

// TestUterRouteUpstreamReadOnlyAcceptance is the read-only FETCH → PARSE →
// NORMALIZE → COMPARE → REPORT mode for a real Uter Route upstream.
//
// It never opens a database, writes an option, saves a snapshot or upserts a
// pricing row. It is deliberately not a production PASS: without a database
// comparison it can only prove that the live catalog normalizes under the
// current safety gates. The test stays BLOCKED unless an operator supplies
// explicit authorization and an upstream base URL.
//
//	UTER_ROUTE_LIVE_AUTHORIZED=1 UTER_ROUTE_LIVE_BASE_URL=https://... \
//	  go test -tags uterroute_live_readonly ./service -run TestUterRouteUpstreamReadOnlyAcceptance -v
func TestUterRouteUpstreamReadOnlyAcceptance(t *testing.T) {
	if os.Getenv("UTER_ROUTE_LIVE_AUTHORIZED") != "1" {
		t.Skip("BLOCKED: set UTER_ROUTE_LIVE_AUTHORIZED=1 only with operator authorization")
	}
	baseURL := strings.TrimSpace(os.Getenv("UTER_ROUTE_LIVE_BASE_URL"))
	if baseURL == "" {
		t.Skip("BLOCKED: set UTER_ROUTE_LIVE_BASE_URL to the authorized upstream")
	}
	group := strings.TrimSpace(os.Getenv("UTER_ROUTE_LIVE_GROUP"))
	if group == "" {
		group = UterRouteDiscountGroupDefault
	}

	// FETCH + PARSE + NORMALIZE.
	snapshot, err := FetchUterRouteUpstream(context.Background(), baseURL)
	require.NoError(t, err)
	require.NotEmpty(t, snapshot.Models)
	modelNames := make([]string, 0, len(snapshot.Models))
	for _, item := range snapshot.Models {
		modelNames = append(modelNames, item.ModelName)
	}
	records, err := UterRouteChannelPricingRecords(snapshot, 0, modelNames, group)
	require.NoError(t, err)
	require.Len(t, records, len(snapshot.Models))

	// COMPARE: no ratio-derived or historical reference may become billable,
	// and any channel price must carry a proven discount identity.
	reviewOnly, autoConfigured, ratioMislabeled := 0, 0, 0
	for _, record := range records {
		var view model.ChannelOfficialPricing
		require.NoError(t, common.UnmarshalJsonStr(record.NormalizedPricing, &view))
		reference := view.PriceKind == "RATIO_ONLY" ||
			view.PriceKind == "DERIVED_FROM_RATIOS" ||
			view.PriceKind == "HISTORICAL_SNAPSHOT"
		if view.NeedsReview {
			reviewOnly++
			require.Empty(t, record.InternalPricing,
				"review-only model %s must not carry an auto sale price", record.ModelName)
			continue
		}
		autoConfigured++
		if reference {
			ratioMislabeled++
		}
		require.NotEmpty(t, record.InternalPricing,
			"configured model %s must have a sale price", record.ModelName)
	}
	require.Zero(t, ratioMislabeled, "reference price must never be auto-configured")

	// REPORT: this is an observation, not a production acceptance verdict.
	t.Logf("FETCH endpoint=%s version=%s models=%d", snapshot.SourceEndpoint, snapshot.PricingVersion, len(snapshot.Models))
	t.Logf("NORMALIZE group=%s review_only=%d auto_configured=%d", group, reviewOnly, autoConfigured)
	t.Logf("REPORT status=OBSERVED_ONLY database_comparison=NOT_PERFORMED production_pass=FALSE")
}
