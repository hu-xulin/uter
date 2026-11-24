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

const uterRoutePricingFixture = `{
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

func TestFetchUterRouteUpstreamKeepsRatiosIsolated(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/api/pricing", r.URL.Path)
		require.Equal(t, "application/json", r.Header.Get("Accept"))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(uterRoutePricingFixture))
	}))
	defer server.Close()

	snapshot, err := FetchUterRouteUpstream(context.Background(), server.URL)
	require.NoError(t, err)
	require.Equal(t, "uterroute", snapshot.ProviderID)
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

func TestFetchUterRouteUpstreamRejectsFailedPayload(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":false,"data":[]}`))
	}))
	defer server.Close()

	_, err := FetchUterRouteUpstream(context.Background(), server.URL)
	require.ErrorContains(t, err, "success=false")
}

func TestFetchUterRouteUpstreamRejectsHTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "upstream unavailable", http.StatusBadGateway)
	}))
	defer server.Close()

	_, err := FetchUterRouteUpstream(context.Background(), server.URL)
	require.ErrorContains(t, err, "HTTP 502")
}

func TestDiffUterRouteUpstreamDetectsPriceAndModelChanges(t *testing.T) {
	ratio := func(v float64) *float64 { return &v }
	prev := &UpstreamSnapshot{
		ProviderID: "uterroute",
		Models: []UpstreamModelRecord{
			{ModelName: "gpt-a", ModelRatio: ratio(2.5), CompletionRatio: ratio(5)},
			{ModelName: "removed-a", ModelRatio: ratio(1)},
		},
	}
	next := &UpstreamSnapshot{
		ProviderID: "uterroute",
		Models: []UpstreamModelRecord{
			{ModelName: "gpt-a", ModelRatio: ratio(3), CompletionRatio: ratio(5)},
			{ModelName: "added-a", ModelPrice: ratio(0.04)},
		},
	}
	changes := DiffUterRouteUpstream(prev, next)
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

func TestDiffUterRouteUpstreamIgnoresEqualRatios(t *testing.T) {
	ratio := func(v float64) *float64 { return &v }
	prev := &UpstreamSnapshot{Models: []UpstreamModelRecord{{ModelName: "gpt-a", ModelRatio: ratio(2.5)}}}
	next := &UpstreamSnapshot{Models: []UpstreamModelRecord{{ModelName: "gpt-a", ModelRatio: ratio(2.5)}}}
	require.Empty(t, DiffUterRouteUpstream(prev, next))
}

func TestUterRouteChannelPricingRecordsDeriveChannelPriceFromDiscount(t *testing.T) {
	ratio := func(v float64) *float64 { return &v }
	snapshot := &UpstreamSnapshot{
		ProviderID: "uterroute",
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
	records, err := UterRouteChannelPricingRecords(snapshot, 42, []string{"gpt-a", "no-group"}, "default")
	require.NoError(t, err)
	require.Len(t, records, 2)
	record := records[0]
	require.Equal(t, 42, record.ChannelId)
	require.Equal(t, "uterroute", record.Provider)
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
	assert.InDelta(t, 3*DefaultUterSaleMarkup, internal.InputUSDPerMillion.Float64(), 1e-9)
	assert.InDelta(t, 15*DefaultUterSaleMarkup, internal.OutputUSDPerMillion.Float64(), 1e-9)
	require.Contains(t, record.InternalPricing, `"source":"uterroute-discount"`)

	// A model without an upstream discount group never guesses a channel price.
	noGroup := records[1]
	require.Empty(t, noGroup.InternalPricing)
	require.Contains(t, noGroup.NormalizedPricing, `"NO_UPSTREAM_DISCOUNT"`)
}

func TestUterRouteDiscountForModelFallsBackToGroupRatio(t *testing.T) {
	snapshot := &UpstreamSnapshot{
		GroupRatio:      map[string]float64{"claude": 0.75},
		GroupGroupRatio: map[string]map[string]float64{"default": {}},
	}
	discount, group, ok := UterRouteDiscountForModel(snapshot, UpstreamModelRecord{EnableGroups: []string{"claude"}}, "default")
	require.True(t, ok)
	require.Equal(t, 0.75, discount)
	require.Equal(t, "claude", group)

	discount, _, ok = UterRouteDiscountForModel(snapshot, UpstreamModelRecord{EnableGroups: []string{"claude"}}, "svip")
	require.True(t, ok)
	require.Equal(t, 0.75, discount)
}

func TestUterRouteDiscountSelectionIgnoresEnableGroupOrder(t *testing.T) {
	snapshot := &UpstreamSnapshot{
		GroupRatio: map[string]float64{},
		GroupGroupRatio: map[string]map[string]float64{
			"default": {"claude": 0.6, "claude-aws": 0.9},
		},
	}
	for _, groups := range [][]string{
		{"claude-aws", "claude"},
		{"claude", "claude-aws"},
	} {
		discount, modelGroup, ok := UterRouteDiscountForModel(snapshot, UpstreamModelRecord{EnableGroups: groups}, "default")
		require.True(t, ok)
		assert.Equal(t, 0.6, discount)
		assert.Equal(t, "claude", modelGroup)
	}
}

func TestFetchUterRouteUpstreamStripsCompatibleVersionPath(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/api/pricing", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(uterRoutePricingFixture))
	}))
	defer server.Close()

	snapshot, err := FetchUterRouteUpstream(context.Background(), server.URL+"/v1")
	require.NoError(t, err)
	require.Len(t, snapshot.Models, 2)
	require.Equal(t, server.URL+"/api/pricing", snapshot.SourceEndpoint)
}

func TestUterRouteExprPriceLineDerivesStandardTier(t *testing.T) {
	line, status := uterRouteExprPriceLine(
		`len <= 272000 ? tier("standard", p * 2 + c * 10 + cr * 0.1 + cc * 2.5) : tier("long_context", p * 4 + c * 15)`,
	)
	require.Equal(t, "DERIVED_FROM_EXPR", status)
	require.NotNil(t, line)
	require.NotNil(t, line.Input)
	require.InDelta(t, 2, *line.Input, 0.0001)
	require.InDelta(t, 10, *line.Output, 0.0001)
	require.InDelta(t, 0.1, *line.CacheRead, 0.0001)
	require.InDelta(t, 2.5, *line.CacheWrite, 0.0001)

	media, status := uterRouteExprPriceLine(`(duration > 0 ? duration : 5) * 0.116417925`)
	require.Equal(t, "DERIVED_FROM_EXPR", status)
	require.NotNil(t, media)
	require.True(t, media.PerSecond)
	require.InDelta(t, 0.116417925, *media.Input, 0.0000001)
}

func TestUterRouteOfficialLinePrefersExpressionThenPriceThenRatio(t *testing.T) {
	ratio := func(v float64) *float64 { return &v }
	item := UpstreamModelRecord{
		ModelName: "gpt-a", ModelRatio: ratio(2.5), ModelPrice: ratio(0.04), QuotaType: 0,
		BillingExpr: `tier("base", p * 3 + c * 6)`,
	}
	line, status := uterRouteOfficialLine(item, nil)
	require.Equal(t, "DERIVED_FROM_EXPR", status)
	require.NotNil(t, line)
	require.Equal(t, 3.0, *line.Input)
	require.Equal(t, 6.0, *line.Output)

	item.BillingExpr = ""
	item.QuotaType = 1
	line, status = uterRouteOfficialLine(item, nil)
	require.Equal(t, "OFFICIAL_API", status)
	require.Equal(t, "per_call", line.Unit)
	require.Equal(t, 0.04, *line.Input)
}

func TestUterRouteOfficialLineMarksHistoricalSnapshot(t *testing.T) {
	legacy := map[string]UterRouteModelRow{
		"legacy-a": {UpstreamName: "legacy-a", Official: UterRoutePriceLine{Input: 2, Output: 4}},
	}
	line, status := uterRouteOfficialLine(UpstreamModelRecord{ModelName: "legacy-a"}, legacy)
	require.Equal(t, "HISTORICAL_SNAPSHOT", status)
	require.NotNil(t, line)
	require.Equal(t, 2.0, *line.Input)
}

func TestUterRouteRatioDerivedPriceIsAutoConfigured(t *testing.T) {
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
	view, internal := uterRouteChannelOfficialPricing(snapshot, item, 100, "default")
	require.Len(t, view.Tiers, 1, "the upstream ratio reference must stay visible")
	require.Equal(t, 5.0, view.Tiers[0].InputPerMillionUSD.Float64())
	require.Equal(t, "RATIO_ONLY", view.PriceKind)
	require.NotNil(t, view.ChannelPrice)
	require.Equal(t, 3.0, view.ChannelPrice.InputPerMillionUSD.Float64())
	require.False(t, view.NeedsReview)
	require.Empty(t, view.ReviewReasons)
	require.Equal(t, "uterroute-ratio-reference", view.Source)
	require.NotEmpty(t, internal)
	require.Contains(t, internal, `"input_per_million_usd":3.3`)
}

func TestDiffUterRouteUpstreamDetectsBillingExpressionChange(t *testing.T) {
	prev := &UpstreamSnapshot{Models: []UpstreamModelRecord{{
		ModelName: "gpt-a", BillingMode: "tiered_expr", BillingExpr: `tier("base", p * 1)`,
	}}}
	next := &UpstreamSnapshot{Models: []UpstreamModelRecord{{
		ModelName: "gpt-a", BillingMode: "tiered_expr", BillingExpr: `tier("base", p * 2)`,
	}}}
	changes := DiffUterRouteUpstream(prev, next)
	require.Len(t, changes, 1)
	require.Equal(t, "rule_changed", changes[0].Kind)
	require.Equal(t, "billing_expr", changes[0].Field)
	require.Contains(t, changes[0].OldText, "p * 1")
	require.Contains(t, changes[0].NewText, "p * 2")
}

func TestUterRouteHistoricalSnapshotIsAutoConfigured(t *testing.T) {
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
	view, internal := uterRouteChannelOfficialPricing(snapshot, item, 100, "default")
	require.Len(t, view.Tiers, 1)
	require.Equal(t, 2.0, view.Tiers[0].InputPerMillionUSD.Float64())
	require.Equal(t, 1.2, view.ChannelPrice.InputPerMillionUSD.Float64())
	require.False(t, view.NeedsReview)
	require.Contains(t, view.Source, "historical")
	require.NotEmpty(t, internal)
}

func TestUterRouteExpressionKeepsAllTiersAndAutoConfiguresRatio(t *testing.T) {
	ratio := func(v float64) *float64 { return &v }
	expr := `len <= 200000 ? tier("standard", p * 1.25 + c * 10 + cr * 0.13) : tier("long", p * 2.5 + c * 15 + cr * 0.25)`
	snapshot := &UpstreamSnapshot{
		ProviderID: "uterroute", PriceBasis: UpstreamPriceBasisRatioOnly,
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
	records, err := UterRouteChannelPricingRecords(snapshot, 7, []string{"tiered", "ratio-only"}, "default")
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

func TestUterRouteExpressionWithoutAbsoluteLineShowsDiscountedChannelPrice(t *testing.T) {
	ratio := func(v float64) *float64 { return &v }
	snapshot := &UpstreamSnapshot{
		ProviderID: "uterroute", PriceBasis: UpstreamPriceBasisRatioOnly,
		GroupRatio:      map[string]float64{"default": 1},
		GroupGroupRatio: map[string]map[string]float64{"default": {"openai": 0.6}},
		Models: []UpstreamModelRecord{{
			ModelName: "expr-only", EnableGroups: []string{"openai"}, PriceStatus: "BILLING_EXPR",
			BillingExpr: `tier("base", p * 10 + c * 50 + cr * 1)`,
			ModelRatio:  ratio(5),
		}},
	}
	records, err := UterRouteChannelPricingRecords(snapshot, 7, []string{"expr-only"}, "default")
	require.NoError(t, err)
	require.Len(t, records, 1)
	var view model.ChannelOfficialPricing
	require.NoError(t, common.UnmarshalJsonStr(records[0].NormalizedPricing, &view))
	require.NotNil(t, view.ChannelPrice)
	assert.InDelta(t, 6, view.ChannelPrice.InputPerMillionUSD.Float64(), 1e-9)
	assert.InDelta(t, 30, view.ChannelPrice.OutputPerMillionUSD.Float64(), 1e-9)
	require.Contains(t, records[0].InternalPricing, ") * 1.1")
}

// 上游定价页不展示没有厂商信息的模型；快照与渠道都必须与页面口径一致。
func TestFetchUterRouteUpstreamExcludesModelsWithoutVendor(t *testing.T) {
	payload := `{
	  "success": true,
	  "pricing_version": "fixture-v2",
	  "data": [
	    {"model_name": "visible-a", "vendor_id": 7, "quota_type": 0, "model_ratio": 1, "model_price": 0, "completion_ratio": 2},
	    {"model_name": "hidden-a", "vendor_id": 0, "quota_type": 0, "model_ratio": 37.5, "model_price": 0, "completion_ratio": 1}
	  ],
	  "vendors": [{"id": 7, "name": "Vendor"}],
	  "group_ratio": {"default": 1},
	  "group_group_ratio": {},
	  "auto_groups": ["default"],
	  "usable_group": {"default": ""}
	}`
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(payload))
	}))
	defer server.Close()

	snapshot, err := FetchUterRouteUpstream(context.Background(), server.URL)
	require.NoError(t, err)
	require.Len(t, snapshot.Models, 1)
	require.Equal(t, "visible-a", snapshot.Models[0].ModelName)
	require.Equal(t, []string{"hidden-a"}, snapshot.ExcludedModels)
}

// Regression: after a batch redirect the channel model list holds request
// names, while the upstream catalogue holds raw names. Pricing rows must be
// keyed by the request name the channel actually serves, otherwise the billing
// readiness panel reports every redirected model as "(missing)".
func TestUterRouteChannelPricingRecordsAppliesModelMapping(t *testing.T) {
	ratio := func(v float64) *float64 { return &v }
	snapshot := &UpstreamSnapshot{
		ProviderID: "uterroute",
		PriceBasis: UpstreamPriceBasisRatioOnly,
		GroupRatio: map[string]float64{"default": 1},
		Models: []UpstreamModelRecord{
			{
				ModelName: "gpt-upstream", ModelRatio: ratio(2.5), PriceStatus: "OFFICIAL_API",
				OfficialPrice: &UpstreamPriceLine{
					Input: ratio(5), Output: ratio(25), Currency: "USD", Unit: "per_1m_token",
				},
			},
			{
				ModelName: "plain-model", ModelRatio: ratio(1), PriceStatus: "OFFICIAL_API",
				OfficialPrice: &UpstreamPriceLine{Input: ratio(2), Output: ratio(4), Currency: "USD", Unit: "per_1m_token"},
			},
		},
	}
	mapping := `{"gpt-alias": "gpt-upstream"}`

	records, err := UterRouteChannelPricingRecordsWithMapping(
		snapshot, 42, []string{"gpt-alias", "plain-model"}, "default", mapping,
	)
	require.NoError(t, err)
	require.Len(t, records, 2, "每个渠道请求名都必须有价格行，否则计费就绪度会误报 (missing)")

	byName := map[string]model.ChannelOfficialPricingRecord{}
	for _, record := range records {
		byName[record.ModelName] = record
	}
	alias, ok := byName["gpt-alias"]
	require.True(t, ok, "重定向后的请求名应当拿到上游模型的价格行")
	require.Equal(t, 42, alias.ChannelId)
	require.Contains(t, alias.NormalizedPricing, `"input_per_million_usd":5`)
	require.Contains(t, alias.NormalizedPricing, `"output_per_million_usd":25`)
	require.NotContains(t, byName, "gpt-upstream", "原始上游名不应再作为独立价格行暴露给渠道")

	plain, ok := byName["plain-model"]
	require.True(t, ok, "没有映射的模型必须保持原名匹配")
	require.Contains(t, plain.NormalizedPricing, `"input_per_million_usd":2`)
}

func TestUterRouteChannelPricingRecordsMappingChainAndCycle(t *testing.T) {
	ratio := func(v float64) *float64 { return &v }
	snapshot := &UpstreamSnapshot{
		ProviderID: "uterroute",
		PriceBasis: UpstreamPriceBasisRatioOnly,
		GroupRatio: map[string]float64{"default": 1},
		Models: []UpstreamModelRecord{
			{
				ModelName: "final-upstream", ModelRatio: ratio(1), PriceStatus: "OFFICIAL_API",
				OfficialPrice: &UpstreamPriceLine{Input: ratio(7), Output: ratio(9), Currency: "USD", Unit: "per_1m_token"},
			},
		},
	}
	// A -> B -> final follows the same chain as the relay's mapping walk.
	// A cycle must not mint a bogus price row.
	mapping := `{"alias-a": "alias-b", "alias-b": "final-upstream", "loop-a": "loop-b", "loop-b": "loop-a"}`

	records, err := UterRouteChannelPricingRecordsWithMapping(
		snapshot, 7, []string{"alias-a", "loop-a"}, "default", mapping,
	)
	require.NoError(t, err)
	require.Len(t, records, 1)
	require.Equal(t, "alias-a", records[0].ModelName)
	require.Contains(t, records[0].NormalizedPricing, `"input_per_million_usd":7`)
}
