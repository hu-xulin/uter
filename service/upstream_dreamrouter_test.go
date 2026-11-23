package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

const dreamRouterPricingFixture = `{
  "success": true,
  "pricing_version": "fixture-v1",
  "data": [
    {
      "model_name": "gpt-a",
      "vendor_id": 1,
      "quota_type": 0,
      "model_ratio": 2.5,
      "model_price": 0,
      "completion_ratio": 5,
      "cache_ratio": 0.1,
      "create_cache_ratio": 1.25,
      "enable_groups": ["default", "vip"],
      "supported_endpoint_types": ["openai", "anthropic"],
      "pricing_version": "fixture-v1"
    },
    {
      "model_name": "image-a",
      "vendor_id": 2,
      "quota_type": 1,
      "model_ratio": 0,
      "model_price": 0.04,
      "completion_ratio": 1,
      "enable_groups": ["default"],
      "supported_endpoint_types": ["openai-image"]
    }
  ],
  "vendors": [
    {"id": 1, "name": "OpenAI"},
    {"id": 2, "name": "Image Vendor"}
  ],
  "group_ratio": {"default": 1, "vip": 0.8},
  "group_group_ratio": {"default": {"vip": 0.9}},
  "auto_groups": ["default"],
  "usable_group": {"default": "", "vip": "VIP"}
}`

func TestFetchDreamRouterUpstreamKeepsRatiosIsolated(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/api/pricing", r.URL.Path)
		require.Equal(t, "application/json", r.Header.Get("Accept"))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(dreamRouterPricingFixture))
	}))
	defer server.Close()

	snapshot, err := FetchDreamRouterUpstream(context.Background(), server.URL)
	require.NoError(t, err)
	require.Equal(t, "dreamrouter", snapshot.ProviderID)
	require.Equal(t, "fixture-v1", snapshot.PricingVersion)
	require.Equal(t, UpstreamPriceBasisRatioOnly, snapshot.PriceBasis)
	require.Len(t, snapshot.Models, 2)
	require.Equal(t, 1.0, snapshot.GroupRatio["default"])
	require.Equal(t, 0.8, snapshot.GroupRatio["vip"])
	require.Equal(t, 0.9, snapshot.GroupGroupRatio["default"]["vip"])

	byName := map[string]UpstreamModelRecord{}
	for _, item := range snapshot.Models {
		byName[item.ModelName] = item
	}
	gpt := byName["gpt-a"]
	require.Equal(t, "OpenAI", gpt.VendorName)
	require.NotNil(t, gpt.ModelRatio)
	require.Equal(t, 2.5, *gpt.ModelRatio)
	require.NotNil(t, gpt.CompletionRatio)
	require.Equal(t, 5.0, *gpt.CompletionRatio)
	require.Equal(t, UpstreamPriceBasisRatioOnly, gpt.PriceBasis)
	// Ratios are converted into the documented absolute space: model_ratio 2.5
	// means $5 / 1M input tokens, with output/cache derived from the ratios.
	require.NotNil(t, gpt.OfficialPrice)
	require.Equal(t, 5.0, *gpt.OfficialPrice.Input)
	require.Equal(t, 25.0, *gpt.OfficialPrice.Output)
	require.Equal(t, 0.5, *gpt.OfficialPrice.CacheRead)
	require.Equal(t, 6.25, *gpt.OfficialPrice.CacheWrite)
	require.Equal(t, "per_1m_token", gpt.OfficialPrice.Unit)
	require.Equal(t, "DERIVED_FROM_RATIOS", gpt.PriceStatus)

	image := byName["image-a"]
	require.Equal(t, 1, image.QuotaType)
	require.NotNil(t, image.ModelPrice)
	require.Equal(t, 0.04, *image.ModelPrice)
	require.NotNil(t, image.OfficialPrice)
	require.Equal(t, 0.04, *image.OfficialPrice.Input)
	require.Equal(t, "per_call", image.OfficialPrice.Unit)
}

func TestFetchDreamRouterUpstreamRejectsFailedPayload(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":false,"data":[]}`))
	}))
	defer server.Close()

	_, err := FetchDreamRouterUpstream(context.Background(), server.URL)
	require.ErrorContains(t, err, "success=false")
}

func TestFetchDreamRouterUpstreamRejectsHTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "upstream unavailable", http.StatusBadGateway)
	}))
	defer server.Close()

	_, err := FetchDreamRouterUpstream(context.Background(), server.URL)
	require.ErrorContains(t, err, "HTTP 502")
}

func TestDiffDreamRouterUpstreamDetectsPriceAndModelChanges(t *testing.T) {
	ratio := func(v float64) *float64 { return &v }
	prev := &UpstreamSnapshot{
		ProviderID: "dreamrouter",
		Models: []UpstreamModelRecord{
			{ModelName: "gpt-a", ModelRatio: ratio(2.5), CompletionRatio: ratio(5)},
			{ModelName: "removed-a", ModelRatio: ratio(1)},
		},
	}
	next := &UpstreamSnapshot{
		ProviderID: "dreamrouter",
		Models: []UpstreamModelRecord{
			{ModelName: "gpt-a", ModelRatio: ratio(3), CompletionRatio: ratio(5)},
			{ModelName: "added-a", ModelPrice: ratio(0.04)},
		},
	}
	changes := DiffDreamRouterUpstream(prev, next)
	require.Len(t, changes, 3)
	byKey := map[string]UpstreamPriceChange{}
	for _, change := range changes {
		key := change.ModelID + ":" + change.Kind + ":" + change.Field
		byKey[key] = change
	}
	price := byKey["gpt-a:price_changed:model_ratio"]
	require.NotNil(t, price.Old)
	require.NotNil(t, price.New)
	require.Equal(t, 2.5, *price.Old)
	require.Equal(t, 3.0, *price.New)
	require.Contains(t, byKey, "added-a:model_added:")
	require.Contains(t, byKey, "removed-a:model_removed:")
}

func TestDiffDreamRouterUpstreamIgnoresEqualRatios(t *testing.T) {
	ratio := func(v float64) *float64 { return &v }
	prev := &UpstreamSnapshot{Models: []UpstreamModelRecord{{ModelName: "gpt-a", ModelRatio: ratio(2.5)}}}
	next := &UpstreamSnapshot{Models: []UpstreamModelRecord{{ModelName: "gpt-a", ModelRatio: ratio(2.5)}}}
	require.Empty(t, DiffDreamRouterUpstream(prev, next))
}

func TestDreamRouterChannelPricingRecordsDeriveChannelPriceFromDiscount(t *testing.T) {
	ratio := func(v float64) *float64 { return &v }
	snapshot := &UpstreamSnapshot{
		ProviderID: "dreamrouter",
		PriceBasis: UpstreamPriceBasisRatioOnly,
		GroupRatio: map[string]float64{"default": 1, "openai": 0.9},
		GroupGroupRatio: map[string]map[string]float64{
			"default": {"openai": 0.6},
			"svip":    {"openai": 0.5},
		},
		Models: []UpstreamModelRecord{
			{
				ModelName: "gpt-a", ModelRatio: ratio(2.5), EnableGroups: []string{"openai"},
				CompletionRatio: ratio(5), PriceStatus: "OFFICIAL_API",
				OfficialPrice: &UpstreamPriceLine{
					Input: ratio(5), Output: ratio(25), Currency: "USD",
					Unit: "per_1m_token",
				},
			},
			{
				ModelName: "no-group", ModelRatio: ratio(1), PriceStatus: "OFFICIAL_API",
				OfficialPrice: &UpstreamPriceLine{Input: ratio(2), Output: ratio(4), Currency: "USD", Unit: "per_1m_token"},
			},
			{ModelName: "not-served", ModelRatio: ratio(1), PriceStatus: "RATIO_ONLY_NO_ABSOLUTE_PRICE"},
		},
	}
	records, err := DreamRouterChannelPricingRecords(snapshot, 42, []string{"gpt-a", "no-group"}, "default")
	require.NoError(t, err)
	require.Len(t, records, 2)
	record := records[0]
	require.Equal(t, 42, record.ChannelId)
	require.Equal(t, "dreamrouter", record.Provider)
	require.Equal(t, "gpt-a", record.ModelName)
	require.Contains(t, record.NormalizedPricing, `"input_per_million_usd":5`)
	require.Contains(t, record.NormalizedPricing, `"output_per_million_usd":25`)
	require.Contains(t, record.NormalizedPricing, `"unit":"per_1m_token"`)
	require.NotContains(t, record.NormalizedPricing, `"OFFICIAL_API"`)

	// Channel price is the official price times the upstream group discount,
	// never the official price itself.
	require.Contains(t, record.NormalizedPricing, `"input_per_million_usd":3`)
	require.Contains(t, record.NormalizedPricing, `"output_per_million_usd":15`)
	require.Contains(t, record.NormalizedPricing, `"discount_ratio":0.6`)
	require.Contains(t, record.NormalizedPricing, `"discount_model_group":"openai"`)
	require.NotEmpty(t, record.InternalPricing)
	var internal model.ChannelInternalPricing
	require.NoError(t, common.UnmarshalJsonStr(record.InternalPricing, &internal))
	require.NotNil(t, internal.InputUSDPerMillion)
	require.NotNil(t, internal.OutputUSDPerMillion)
	assert.InDelta(t, 3*DefaultUterSaleMarkup, *internal.InputUSDPerMillion, 1e-9)
	assert.InDelta(t, 15*DefaultUterSaleMarkup, *internal.OutputUSDPerMillion, 1e-9)
	require.Contains(t, record.InternalPricing, `"source":"dreamrouter-discount"`)

	// A model without an upstream discount group never guesses a channel price.
	noGroup := records[1]
	require.Empty(t, noGroup.InternalPricing)
	require.Contains(t, noGroup.NormalizedPricing, `"NO_UPSTREAM_DISCOUNT"`)
}

func TestDreamRouterDiscountForModelFallsBackToGroupRatio(t *testing.T) {
	snapshot := &UpstreamSnapshot{
		GroupRatio:      map[string]float64{"claude": 0.75},
		GroupGroupRatio: map[string]map[string]float64{"default": {}},
	}
	discount, group, ok := DreamRouterDiscountForModel(snapshot, UpstreamModelRecord{EnableGroups: []string{"claude"}}, "default")
	require.True(t, ok)
	require.Equal(t, 0.75, discount)
	require.Equal(t, "claude", group)

	discount, _, ok = DreamRouterDiscountForModel(snapshot, UpstreamModelRecord{EnableGroups: []string{"claude"}}, "svip")
	require.True(t, ok)
	require.Equal(t, 0.75, discount)
}

func TestFetchDreamRouterUpstreamStripsCompatibleVersionPath(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/api/pricing", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(dreamRouterPricingFixture))
	}))
	defer server.Close()

	snapshot, err := FetchDreamRouterUpstream(context.Background(), server.URL+"/v1")
	require.NoError(t, err)
	require.Len(t, snapshot.Models, 2)
	require.Equal(t, server.URL+"/api/pricing", snapshot.SourceEndpoint)
}

func TestDreamRouterExprPriceLineDerivesStandardTier(t *testing.T) {
	line, status := dreamRouterExprPriceLine(
		`len <= 272000 ? tier("standard", p * 2 + c * 10 + cr * 0.1 + cc * 2.5) : tier("long_context", p * 4 + c * 15)`,
	)
	require.Equal(t, "DERIVED_FROM_EXPR", status)
	require.NotNil(t, line)
	require.NotNil(t, line.Input)
	require.InDelta(t, 2, *line.Input, 0.0001)
	require.InDelta(t, 10, *line.Output, 0.0001)
	require.InDelta(t, 0.1, *line.CacheRead, 0.0001)
	require.InDelta(t, 2.5, *line.CacheWrite, 0.0001)

	media, status := dreamRouterExprPriceLine(`(duration > 0 ? duration : 5) * 0.116417925`)
	require.Equal(t, "DERIVED_FROM_EXPR", status)
	require.NotNil(t, media)
	require.True(t, media.PerSecond)
	require.InDelta(t, 0.116417925, *media.Input, 0.0000001)
}

func TestDreamRouterOfficialLinePrefersExpressionThenPriceThenRatio(t *testing.T) {
	ratio := func(v float64) *float64 { return &v }
	item := UpstreamModelRecord{
		ModelName: "gpt-a", ModelRatio: ratio(2.5), ModelPrice: ratio(0.04), QuotaType: 0,
		BillingExpr: `tier("base", p * 3 + c * 6)`,
	}
	line, status := dreamRouterOfficialLine(item, nil)
	require.Equal(t, "DERIVED_FROM_EXPR", status)
	require.NotNil(t, line)
	require.Equal(t, 3.0, *line.Input)
	require.Equal(t, 6.0, *line.Output)

	item.BillingExpr = ""
	item.QuotaType = 1
	line, status = dreamRouterOfficialLine(item, nil)
	require.Equal(t, "OFFICIAL_API", status)
	require.Equal(t, "per_call", line.Unit)
	require.Equal(t, 0.04, *line.Input)
}

func TestDreamRouterOfficialLineMarksHistoricalSnapshot(t *testing.T) {
	legacy := map[string]DreamRouterModelRow{
		"legacy-a": {UpstreamName: "legacy-a", Official: DreamRouterPriceLine{Input: 2, Output: 4}},
	}
	line, status := dreamRouterOfficialLine(UpstreamModelRecord{ModelName: "legacy-a"}, legacy)
	require.Equal(t, "HISTORICAL_SNAPSHOT", status)
	require.NotNil(t, line)
	require.Equal(t, 2.0, *line.Input)
}

func TestDreamRouterRatioDerivedPriceIsAutoConfigured(t *testing.T) {
	ratio := func(v float64) *float64 { return &v }
	snapshot := &UpstreamSnapshot{
		GroupRatio:      map[string]float64{"openai": 0.6},
		GroupGroupRatio: map[string]map[string]float64{},
	}
	item := UpstreamModelRecord{
		ModelName: "ratio-only", EnableGroups: []string{"openai"},
		PriceStatus: "DERIVED_FROM_RATIOS",
		OfficialPrice: &UpstreamPriceLine{
			Input: ratio(5), Output: ratio(25), Currency: "USD", Unit: "per_1m_token",
		},
	}
	view, internal := dreamRouterChannelOfficialPricing(snapshot, item, 100, "default")
	require.Len(t, view.Tiers, 1, "the upstream ratio reference must stay visible")
	require.Equal(t, 5.0, *view.Tiers[0].InputPerMillionUSD)
	require.Equal(t, "RATIO_ONLY", view.PriceKind)
	require.NotNil(t, view.ChannelPrice)
	require.Equal(t, 3.0, *view.ChannelPrice.InputPerMillionUSD)
	require.False(t, view.NeedsReview)
	require.Empty(t, view.ReviewReasons)
	require.Equal(t, "dreamrouter-ratio-reference", view.Source)
	require.NotEmpty(t, internal)
	require.Contains(t, internal, `"input_per_million_usd":3.3`)
}

func TestDiffDreamRouterUpstreamDetectsBillingExpressionChange(t *testing.T) {
	prev := &UpstreamSnapshot{Models: []UpstreamModelRecord{{
		ModelName: "gpt-a", BillingMode: "tiered_expr", BillingExpr: `tier("base", p * 1)`,
	}}}
	next := &UpstreamSnapshot{Models: []UpstreamModelRecord{{
		ModelName: "gpt-a", BillingMode: "tiered_expr", BillingExpr: `tier("base", p * 2)`,
	}}}
	changes := DiffDreamRouterUpstream(prev, next)
	require.Len(t, changes, 1)
	require.Equal(t, "rule_changed", changes[0].Kind)
	require.Equal(t, "billing_expr", changes[0].Field)
	require.Contains(t, changes[0].OldText, "p * 1")
	require.Contains(t, changes[0].NewText, "p * 2")
}

func TestDreamRouterHistoricalSnapshotIsAutoConfigured(t *testing.T) {
	ratio := func(v float64) *float64 { return &v }
	snapshot := &UpstreamSnapshot{
		GroupRatio:      map[string]float64{"default": 1},
		GroupGroupRatio: map[string]map[string]float64{"default": {"openai": 0.6}},
	}
	item := UpstreamModelRecord{
		ModelName: "seedance", EnableGroups: []string{"openai"},
		PriceStatus: "HISTORICAL_SNAPSHOT",
		OfficialPrice: &UpstreamPriceLine{
			Input: ratio(2), Output: ratio(4), Currency: "USD", Unit: "per_1m_token",
		},
	}
	view, internal := dreamRouterChannelOfficialPricing(snapshot, item, 100, "default")
	require.Len(t, view.Tiers, 1)
	require.Equal(t, 2.0, *view.Tiers[0].InputPerMillionUSD)
	require.Equal(t, 1.2, *view.ChannelPrice.InputPerMillionUSD)
	require.False(t, view.NeedsReview)
	require.Contains(t, view.Source, "historical")
	require.NotEmpty(t, internal)
}

func TestDreamRouterExpressionKeepsAllTiersAndAutoConfiguresRatio(t *testing.T) {
	ratio := func(v float64) *float64 { return &v }
	expr := `len <= 200000 ? tier("standard", p * 1.25 + c * 10 + cr * 0.13) : tier("long", p * 2.5 + c * 15 + cr * 0.25)`
	snapshot := &UpstreamSnapshot{
		ProviderID: "dreamrouter", PriceBasis: UpstreamPriceBasisRatioOnly,
		GroupRatio:      map[string]float64{"default": 1},
		GroupGroupRatio: map[string]map[string]float64{"default": {"openai": 0.6}},
		Models: []UpstreamModelRecord{
			{
				ModelName: "tiered", EnableGroups: []string{"openai"}, PriceStatus: "BILLING_EXPR",
				BillingExpr: expr,
				OfficialPrice: &UpstreamPriceLine{
					Input: ratio(1.25), Output: ratio(10), CacheRead: ratio(0.13),
					Currency: "USD", Unit: "per_1m_token",
				},
			},
			{
				ModelName: "ratio-only", EnableGroups: []string{"openai"}, PriceStatus: "DERIVED_FROM_RATIOS",
				ModelRatio: ratio(2), OfficialPrice: &UpstreamPriceLine{Input: ratio(4), Output: ratio(8), Currency: "USD", Unit: "per_1m_token"},
			},
		},
	}
	records, err := DreamRouterChannelPricingRecords(snapshot, 7, []string{"tiered", "ratio-only"}, "default")
	require.NoError(t, err)
	require.Len(t, records, 2)

	require.Contains(t, records[0].InternalPricing, `"mode":"tiered_expr"`)
	require.Contains(t, records[0].InternalPricing, `tier(\"standard\"`)
	require.Contains(t, records[0].InternalPricing, `tier(\"long\"`)
	require.Contains(t, records[0].InternalPricing, `) * 0.6`)
	require.NotContains(t, records[0].NormalizedPricing, `"needs_review":true`)
	require.Contains(t, records[0].NormalizedPricing, `"tiers":[`)
	require.Contains(t, records[0].NormalizedPricing, `"input_per_million_usd":1.25`)

	require.NotEmpty(t, records[1].InternalPricing, "ratio-derived rows still need a default sale price")
	require.NotContains(t, records[1].NormalizedPricing, `"needs_review":true`)
	require.Contains(t, records[1].NormalizedPricing, `"price_kind":"RATIO_ONLY"`)
	require.Contains(t, records[1].NormalizedPricing, `"tiers":[`)
}

func TestDreamRouterExpressionWithoutAbsoluteLineShowsDiscountedChannelPrice(t *testing.T) {
	ratio := func(v float64) *float64 { return &v }
	snapshot := &UpstreamSnapshot{
		ProviderID: "dreamrouter", PriceBasis: UpstreamPriceBasisRatioOnly,
		GroupRatio:      map[string]float64{"default": 1},
		GroupGroupRatio: map[string]map[string]float64{"default": {"openai": 0.6}},
		Models: []UpstreamModelRecord{{
			ModelName: "expr-only", EnableGroups: []string{"openai"}, PriceStatus: "BILLING_EXPR",
			BillingExpr: `tier("base", p * 10 + c * 50 + cr * 1)`,
			ModelRatio:  ratio(5),
		}},
	}
	records, err := DreamRouterChannelPricingRecords(snapshot, 7, []string{"expr-only"}, "default")
	require.NoError(t, err)
	require.Len(t, records, 1)
	var view model.ChannelOfficialPricing
	require.NoError(t, common.UnmarshalJsonStr(records[0].NormalizedPricing, &view))
	require.NotNil(t, view.ChannelPrice)
	assert.InDelta(t, 6, *view.ChannelPrice.InputPerMillionUSD, 1e-9)
	assert.InDelta(t, 30, *view.ChannelPrice.OutputPerMillionUSD, 1e-9)
	require.Contains(t, records[0].InternalPricing, ") * 1.1")
}
