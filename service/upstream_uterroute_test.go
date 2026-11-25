package service

import (
	"context"
	"math"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/pkg/billingexpr"
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

func TestUterRouteMultipleEnableGroupsAmbiguous(t *testing.T) {
	// Two enabled groups resolve to different settlement ratios for this
	// channel. The catalog gives no evidence which one is the real settlement
	// group, so the discount must NOT be guessed (e.g. by taking the lowest):
	// doing so would misstate purchase cost and margin. Order must not matter.
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
		_, _, ok := UterRouteDiscountForModel(snapshot, UpstreamModelRecord{EnableGroups: groups}, "default")
		require.False(t, ok, "ambiguous settlement group must require review, not be guessed")
	}

	// A flat fallback table with one clean ratio must not rescue an ambiguous
	// group-group result: the authoritative table is unusable, so the real
	// settlement group remains unproven.
	snapshot.GroupRatio = map[string]float64{"claude": 0.6, "claude-aws": 0.6}
	_, _, ok := UterRouteDiscountForModel(snapshot, UpstreamModelRecord{EnableGroups: []string{"claude", "claude-aws"}}, "default")
	require.False(t, ok, "flat fallback must not override an ambiguous group-group table")
}

func TestUterRouteAutoGroupChainIsAuthoritative(t *testing.T) {
	// The pricing card resolves a model through the auto-group chain in a
	// fixed order. Even when the model enables several groups with different
	// ratios, the first chain hit wins regardless of upstream enable_groups
	// order; this is the Uter default-group settlement identity.
	snapshot := &UpstreamSnapshot{
		AutoGroups: []string{"openai-image", "openai"},
		GroupRatio: map[string]float64{},
		GroupGroupRatio: map[string]map[string]float64{
			"default": {"openai-image": 0.75, "openai": 0.6},
		},
	}
	for _, groups := range [][]string{
		{"openai", "openai-image"},
		{"openai-image", "openai"},
	} {
		discount, modelGroup, ok := UterRouteDiscountForModel(snapshot, UpstreamModelRecord{EnableGroups: groups}, "default")
		require.True(t, ok, "auto-group chain must resolve the discount deterministically")
		require.Equal(t, 0.75, discount, "first auto-group hit wins, not the cheapest enabled group")
		require.Equal(t, "openai-image", modelGroup)
	}
}

func TestUterRouteAutoGroupChainFailsClosedOnUnusableFirstHit(t *testing.T) {
	snapshot := &UpstreamSnapshot{
		AutoGroups:      []string{"bad", "fallback"},
		GroupRatio:      map[string]float64{"fallback": 0.6},
		GroupGroupRatio: map[string]map[string]float64{"default": {"bad": 0}},
	}
	_, _, ok := UterRouteDiscountForModel(
		snapshot, UpstreamModelRecord{EnableGroups: []string{"fallback", "bad"}}, "default",
	)
	require.False(t, ok, "an unusable first chain hit must not fall through to a cheaper group")
}

func TestUterRouteSyncUsesAutoGroupChainAfterDataLayerFixIsOverwritten(t *testing.T) {
	// A data-layer-only fix collapses enable_groups to one group, but the next
	// upstream sync restores the upstream's multi-group list. Production sync
	// must still resolve through the auto-group chain, so a repeated sync can
	// never reintroduce the ambiguous/cheaper-group price. This is the exact
	// regression behind channel 1247 → 1248.
	ratio := func(v float64) *float64 { return &v }
	snapshot := &UpstreamSnapshot{
		ProviderID: "uterroute",
		PriceBasis: UpstreamPriceBasisRatioOnly,
		AutoGroups: []string{"openai-image", "openai"},
		GroupRatio: map[string]float64{"default": 1},
		GroupGroupRatio: map[string]map[string]float64{
			"default": {"openai-image": 0.75, "openai": 0.6},
		},
		Models: []UpstreamModelRecord{
			{
				ModelName:    "gpt-image-2.5-flare",
				ModelRatio:   ratio(1),
				EnableGroups: []string{"openai", "openai-image"},
				PriceStatus:  "OFFICIAL_API",
				OfficialPrice: &UpstreamPriceLine{
					Input: ratio(5), Output: ratio(25), Currency: "USD", Unit: "per_1m_token",
				},
			},
		},
	}
	records, err := UterRouteChannelPricingRecords(
		snapshot, 1248, []string{"gpt-image-2.5-flare"}, "default",
	)
	require.NoError(t, err)
	require.Len(t, records, 1)
	record := records[0]
	require.NotContains(t, record.NormalizedPricing, `"needs_review":true`)
	require.Contains(t, record.NormalizedPricing, `"discount_ratio":0.75`)
	require.Contains(t, record.NormalizedPricing, `"discount_model_group":"openai-image"`)
	require.Contains(t, record.NormalizedPricing, `"input_per_million_usd":3.75`)
}

func TestUterRouteDiscountSelectionIgnoresEnableGroupOrder(t *testing.T) {
	// Equal ratios across enabled groups are unambiguous: every candidate
	// resolves to the same price, so ordering still cannot change the result.
	snapshot := &UpstreamSnapshot{
		GroupRatio: map[string]float64{},
		GroupGroupRatio: map[string]map[string]float64{
			"default": {"claude": 0.6, "claude-aws": 0.6},
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

// TestUterRouteDiscountGroupChangeIsChannelIsolated verifies that changing
// one channel's upstream billing group never changes another channel's
// discount. Discounts are stored as a per-channel map; a shared/global value
// would leak one channel's purchase cost into every other channel.
func TestUterRouteDiscountGroupChangeIsChannelIsolated(t *testing.T) {
	previous := common.OptionMap
	common.OptionMap = map[string]string{}
	t.Cleanup(func() { common.OptionMap = previous })

	common.OptionMap[UterRouteDiscountGroupOptionKey] = `{"7":"vip","8":"default"}`
	require.Equal(t, "vip", GetUterRouteDiscountGroup(7))
	require.Equal(t, "default", GetUterRouteDiscountGroup(8))

	// Simulate an operator changing only channel 7.
	var groups map[string]string
	require.NoError(t, common.UnmarshalJsonStr(common.OptionMap[UterRouteDiscountGroupOptionKey], &groups))
	groups["7"] = "svip"
	encoded, err := common.Marshal(groups)
	require.NoError(t, err)
	common.OptionMap[UterRouteDiscountGroupOptionKey] = string(encoded)

	require.Equal(t, "svip", GetUterRouteDiscountGroup(7))
	require.Equal(t, "default", GetUterRouteDiscountGroup(8), "channel 8 must be unaffected")
	require.Equal(t, UterRouteDiscountGroupDefault, GetUterRouteDiscountGroup(99), "unset channel keeps the default")
}

func TestUterRouteDiscountRejectsInvalidRatios(t *testing.T) {
	snapshot := &UpstreamSnapshot{
		GroupRatio:      map[string]float64{},
		GroupGroupRatio: map[string]map[string]float64{"default": {"bad": 0}},
	}
	_, _, ok := UterRouteDiscountForModel(snapshot, UpstreamModelRecord{EnableGroups: []string{"bad"}}, "default")
	require.False(t, ok, "zero ratio must not enter the pricing path")
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

// withReferenceBillingAuthorization pins the global option for a single test
// and restores the whole map afterwards. It clones under the same mutex the
// production reader uses, so it is safe even when OptionMap starts nil.
// Tests using it must not call t.Parallel.
// value == "" removes the key (the default-authorized state).
func withReferenceBillingAuthorization(t *testing.T, value string) {
	t.Helper()
	key := UterRouteReferencePriceBillingOption
	common.OptionMapRWMutex.Lock()
	previous := common.OptionMap
	clone := make(map[string]string, len(previous)+1)
	for k, v := range previous {
		clone[k] = v
	}
	if value == "" {
		delete(clone, key)
	} else {
		clone[key] = value
	}
	common.OptionMap = clone
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previous
		common.OptionMapRWMutex.Unlock()
	})
}

func TestUterRouteRatioDerivedPriceStaysReviewOnly(t *testing.T) {
	withReferenceBillingAuthorization(t, "false")
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
	require.True(t, view.NeedsReview, "ratio-derived prices must not auto-enable billing")
	require.Contains(t, view.ReviewReasons, "DERIVED_FROM_RATIOS")
	require.Contains(t, view.ReviewReasons, "REFERENCE_PRICE_BILLING_NOT_AUTHORIZED")
	require.Equal(t, "uterroute-ratio-reference", view.Source)
	require.Empty(t, internal, "review-only rows must never carry an auto sale price")
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

func TestUterRouteHistoricalSnapshotStaysReviewOnly(t *testing.T) {
	withReferenceBillingAuthorization(t, "false")
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
	require.True(t, view.NeedsReview, "historical prices must not auto-enable billing")
	require.Contains(t, view.ReviewReasons, "HISTORICAL_SNAPSHOT")
	require.Contains(t, view.ReviewReasons, "REFERENCE_PRICE_BILLING_NOT_AUTHORIZED")
	require.Contains(t, view.Source, "historical")
	require.Empty(t, internal)
}

// The 2026-11-25 operator decision authorizes billing from ratio-derived and
// historical reference prices (ratio * $2/1M is the gateway's own charging
// basis). Both the default state and an explicit "true" must make those rows
// billable, while the provenance reason stays for audit.
func TestUterRouteReferencePricesBillWhenAuthorized(t *testing.T) {
	for _, optionValue := range []string{"", "true"} {
		t.Run("option="+optionValue, func(t *testing.T) {
			withReferenceBillingAuthorization(t, optionValue)

			ratio := func(v float64) *float64 { return &v }
			snapshot := &UpstreamSnapshot{
				GroupRatio:      map[string]float64{"default": 1},
				GroupGroupRatio: map[string]map[string]float64{"default": {"gemini": 0.6}},
			}
			for _, status := range []string{"DERIVED_FROM_RATIOS", "HISTORICAL_SNAPSHOT"} {
				item := UpstreamModelRecord{
					ModelName: "ref-" + status, EnableGroups: []string{"gemini"},
					PriceStatus: status,
					OfficialPrice: &UpstreamPriceLine{
						Input: ratio(5), Output: ratio(25), Currency: "USD", Unit: "per_1m_token",
					},
				}
				view, internal := uterRouteChannelOfficialPricing(snapshot, item, 100, "default")
				require.False(t, view.NeedsReview, "%s must be billable once authorized", status)
				require.NotEmpty(t, internal, "%s must carry an auto sale price once authorized", status)
				require.NotContains(t, view.ReviewReasons, "REFERENCE_PRICE_BILLING_NOT_AUTHORIZED")
				require.Contains(t, view.ReviewReasons, status, "provenance must stay visible for audit")
				require.Equal(t, 3.0, view.ChannelPrice.InputPerMillionUSD.Float64())
			}
		})
	}
}

// The end-to-end path must produce configured records for reference rows once
// authorized — this is what turns the 31 pending channel-1249 models billable
// on the next upstream sync.
func TestUterRouteSyncAuthorizesReferencePricesByDefault(t *testing.T) {
	withReferenceBillingAuthorization(t, "")

	ratio := func(v float64) *float64 { return &v }
	snapshot := &UpstreamSnapshot{
		ProviderID: "uterroute", PriceBasis: UpstreamPriceBasisRatioOnly,
		GroupRatio:      map[string]float64{"default": 1},
		GroupGroupRatio: map[string]map[string]float64{"default": {"gemini": 0.6}},
		Models: []UpstreamModelRecord{
			{
				ModelName: "gemini-3.5-flash", EnableGroups: []string{"gemini"},
				PriceStatus: "DERIVED_FROM_RATIOS", ModelRatio: ratio(0.75),
				OfficialPrice: &UpstreamPriceLine{Input: ratio(1.5), Output: ratio(9), Currency: "USD", Unit: "per_1m_token"},
			},
			{
				ModelName: "seedance-2.0", EnableGroups: []string{"gemini"},
				PriceStatus: "HISTORICAL_SNAPSHOT",
				OfficialPrice: &UpstreamPriceLine{Input: ratio(6.9), Output: ratio(6.9), Currency: "USD", Unit: "per_1m_token"},
			},
		},
	}
	records, err := UterRouteChannelPricingRecords(snapshot, 1249, []string{"gemini-3.5-flash", "seedance-2.0"}, "default")
	require.NoError(t, err)
	require.Len(t, records, 2)
	for _, rec := range records {
		require.NotEmpty(t, rec.InternalPricing, "%s must carry a billable price", rec.ModelName)
		require.NotContains(t, rec.NormalizedPricing, `"needs_review":true`)
		require.NotContains(t, rec.NormalizedPricing, "REFERENCE_PRICE_BILLING_NOT_AUTHORIZED")
	}
}

func TestUterRouteExpressionKeepsAllTiersAndParksRatioReference(t *testing.T) {
	withReferenceBillingAuthorization(t, "false")
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
	// The discount must scale every coefficient in every tier, not wrap the
	// whole expression in a multiplier (which would be non-executable for
	// fixed-charge rules and could leave a branch unscaled). Verify the real
	// computed result instead of asserting an implementation-specific string.
	var internal model.ChannelInternalPricing
	require.NoError(t, common.UnmarshalJsonStr(records[0].InternalPricing, &internal))
	assertExprScaledBy(t, expr, internal.BillingExpr, 0.6*DefaultUterSaleMarkup,
		billingexpr.TokenParams{P: 1000, C: 500, Len: 1000},
		billingexpr.TokenParams{P: 1000, C: 500, Len: 300000})
	require.NotContains(t, records[0].NormalizedPricing, `"needs_review":true`)
	require.Contains(t, records[0].NormalizedPricing, `"tiers":[`)
	require.Contains(t, records[0].NormalizedPricing, `"input_per_million_usd":1.25`)

	require.Empty(t, records[1].InternalPricing, "ratio-derived rows must stay review-only")
	require.Contains(t, records[1].NormalizedPricing, `"needs_review":true`)
	require.Contains(t, records[1].NormalizedPricing, `"REFERENCE_PRICE_BILLING_NOT_AUTHORIZED"`)
	require.Contains(t, records[1].NormalizedPricing, `"price_kind":"RATIO_ONLY"`)
	require.Contains(t, records[1].NormalizedPricing, `"tiers":[`)
}

// assertExprScaledBy proves that `scaled` computes `base * factor` for every
// supplied usage probe. This is a semantic assertion: it catches a discount
// applied to only one tier/branch, which a string-contains check cannot.
func assertExprScaledBy(t *testing.T, baseExpr, scaledExpr string, factor float64, probes ...billingexpr.TokenParams) {
	t.Helper()
	require.NotEmpty(t, scaledExpr)
	require.True(t, NormalizeUpstreamExpression(scaledExpr).Executable,
		"scaled expression must be executable: %s", NormalizeUpstreamExpression(scaledExpr).Error)
	for _, params := range probes {
		base, _, baseErr := billingexpr.RunExprWithRequest(baseExpr, params, billingexpr.RequestInput{})
		got, _, gotErr := billingexpr.RunExprWithRequest(scaledExpr, params, billingexpr.RequestInput{})
		require.NoError(t, baseErr)
		require.NoError(t, gotErr)
		require.InDelta(t, base*factor, got, math.Max(1e-6, math.Abs(base*factor)*1e-9),
			"usage %+v: base=%v scaled=%v factor=%v", params, base, got, factor)
	}
}

// TestUterRouteMixedFixedExpressionDiscountPreservesAllTerms is a regression
// test for a production defect: a billing rule that mixes a token tier with a
// fixed-charge tier had its discount applied only inside fixed(), leaving the
// token tier unscaled (overcharging short-context requests). A plain
// "(expr) * factor" wrap is not a fix — the billing engine rejects an ordinary
// multiplier on fixed expressions. Every coefficient must be scaled in place.
func TestUterRouteMixedFixedExpressionDiscountPreservesAllTerms(t *testing.T) {
	const raw = `len <= 100 ? tier("short", p * 1) : tier("long", fixed(0.05))`
	scaled, ok := scaleBillingExprByFactor(raw, 0.6)
	require.True(t, ok)
	assertExprScaledBy(t, raw, scaled, 0.6,
		billingexpr.TokenParams{P: 50, Len: 50},
		billingexpr.TokenParams{P: 300, Len: 300},
	)
	// A fixed-charge task rule multiplied by image_count must scale only the
	// fixed amount, never the request quantity.
	const taskRaw = `tier("image", fixed(0.04)) * image_count`
	taskScaled, ok := scaleBillingExprByFactor(taskRaw, 0.5)
	require.True(t, ok)
	require.Contains(t, taskScaled, "fixed(0.02)")
	require.Contains(t, taskScaled, "* image_count")
	imageCount := 2
	base, _, baseErr := billingexpr.RunExprWithRequest(taskRaw, billingexpr.TokenParams{},
		billingexpr.RequestInput{ImageCount: &imageCount})
	got, _, gotErr := billingexpr.RunExprWithRequest(taskScaled, billingexpr.TokenParams{},
		billingexpr.RequestInput{ImageCount: &imageCount})
	require.NoError(t, baseErr)
	require.NoError(t, gotErr)
	require.InDelta(t, base*0.5, got, 1e-6)
}

// TestScaleBillingExprByFactorCoverageMatrix proves every coefficient shape
// Uter Route can publish is scaled by the same factor, while thresholds and
// request quantities are left alone. It is a semantic check: each scaled rule
// must evaluate to base × factor for real request probes.
func TestScaleBillingExprByFactorCoverageMatrix(t *testing.T) {
	imageCount := 2
	duration := 8.0
	cases := []struct {
		name   string
		expr   string
		factor float64
		params billingexpr.TokenParams
		input  billingexpr.RequestInput
	}{
		{
			name: "fixed only", expr: `tier("image", fixed(0.04))`, factor: 0.5,
			input: billingexpr.RequestInput{ImageCount: &imageCount},
		},
		{
			name: "token coefficient with digit in identifier",
			expr: `cc1h * 0.2 + p * 1.25`, factor: 0.6,
			params: billingexpr.TokenParams{P: 1000, CC1h: 500},
		},
		{
			name: "bare duration coefficient", expr: `duration * 0.0746268657`, factor: 1.1,
			input: billingexpr.RequestInput{Duration: &duration},
		},
		{
			name: "parenthesized duration coefficient",
			expr: `tier("720p", (duration > 0 ? duration : 5) * 0.0895522)`, factor: 1.1,
			input: billingexpr.RequestInput{Duration: &duration},
		},
		{
			name: "per image price coefficient",
			expr: `tier("image", image_count * 3)`, factor: 0.5,
			input: billingexpr.RequestInput{ImageCount: &imageCount},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			scaled, ok := scaleBillingExprByFactor(tc.expr, tc.factor)
			require.True(t, ok)
			base, _, baseErr := billingexpr.RunExprWithRequest(tc.expr, tc.params, tc.input)
			got, _, gotErr := billingexpr.RunExprWithRequest(scaled, tc.params, tc.input)
			require.NoError(t, baseErr)
			require.NoError(t, gotErr)
			require.InDelta(t, base*tc.factor, got, 1e-8, "scaled=%s", scaled)
		})
	}

	thresholdExpr := `len <= 100 ? tier("short", p * 1) : tier("long", fixed(0.05))`
	thresholdScaled, ok := scaleBillingExprByFactor(thresholdExpr, 0.6)
	require.True(t, ok)
	require.Contains(t, thresholdScaled, "len <= 100", "thresholds are not price coefficients")

	_, ok = scaleBillingExprByFactor(`len > 100 ? 1 : 0`, 0.6)
	require.False(t, ok, "an expression with no price coefficient must fail closed")
	_, ok = scaleBillingExprByFactor(`p * 1e-5`, 0.6)
	require.False(t, ok, "unsupported exponent notation must fail closed")
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
	var internal model.ChannelInternalPricing
	require.NoError(t, common.UnmarshalJsonStr(records[0].InternalPricing, &internal))
	assertExprScaledBy(t, `tier("base", p * 10 + c * 50 + cr * 1)`, internal.BillingExpr,
		0.6*DefaultUterSaleMarkup,
		billingexpr.TokenParams{P: 1000, C: 500, Len: 1000},
		billingexpr.TokenParams{P: 2000, C: 100, Len: 2000, CR: 50})
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

// Regression: an upstream tiered model whose enable_groups are absent from the
// channel's discount tables resolves to NO_UPSTREAM_DISCOUNT. The row must stay
// review-only (no auto-billing) BUT the upstream-published official price MUST
// remain visible in normalized_pricing.tiers — otherwise the channel wizard's
// "Official price" column wrongly shows "Not available" even though the
// snapshot carries a complete official_price. This repeatedly regressed because
// the NO_UPSTREAM_DISCOUNT early return skipped tier construction entirely.
func TestUterRouteNoDiscountStillKeepsOfficialTierVisible(t *testing.T) {
	ratio := func(v float64) *float64 { return &v }
	// Exact shape from the reported claude-fable-5 catalogue row: a tiered
	// expression with real official coefficients and enable_groups that the
	// selected billing group's table does not contain.
	expr := `tier("base", p * 10 + c * 50 + cr * 1 + cc * 12.5)`
	snapshot := &UpstreamSnapshot{
		ProviderID: "uterroute", PriceBasis: UpstreamPriceBasisRatioOnly,
		// "vip" group table exists but does not contain the claude groups.
		GroupGroupRatio: map[string]map[string]float64{"vip": {"openai": 0.6}},
		GroupRatio:      map[string]float64{"openai": 0.9},
		Models: []UpstreamModelRecord{
			{
				ModelName: "claude-fable-5",
				// Groups absent from every discount table -> NO_UPSTREAM_DISCOUNT.
				EnableGroups: []string{"claude", "claude-aws", "claude_or"},
				PriceStatus:  "DERIVED_FROM_EXPR",
				BillingExpr:  expr,
				OfficialPrice: &UpstreamPriceLine{
					Input: ratio(10), Output: ratio(50), CacheRead: ratio(1),
					CacheWrite: ratio(12.5), Currency: "USD", Unit: "per_1m_token",
				},
			},
		},
	}

	records, err := UterRouteChannelPricingRecords(snapshot, 1240, []string{"claude-fable-5"}, "vip")
	require.NoError(t, err)
	require.Len(t, records, 1)
	rec := records[0]

	// fail-closed still holds: no discount group -> no auto-billing price.
	require.Empty(t, rec.InternalPricing, "NO_UPSTREAM_DISCOUNT must never auto-enable billing")
	require.Contains(t, rec.NormalizedPricing, `"NO_UPSTREAM_DISCOUNT"`)
	require.Contains(t, rec.NormalizedPricing, `"needs_review":true`)

	// The published official price must stay visible for operators.
	var view model.ChannelOfficialPricing
	require.NoError(t, common.UnmarshalJsonStr(rec.NormalizedPricing, &view))
	require.Len(t, view.Tiers, 1, "official tier must survive the NO_UPSTREAM_DISCOUNT return")
	require.NotNil(t, view.Tiers[0].InputPerMillionUSD)
	require.InDelta(t, 10, view.Tiers[0].InputPerMillionUSD.Float64(), 1e-9)
	require.NotNil(t, view.Tiers[0].OutputPerMillionUSD)
	require.InDelta(t, 50, view.Tiers[0].OutputPerMillionUSD.Float64(), 1e-9)
	require.Equal(t, "per_1m_token", view.Tiers[0].Unit)
	// Tier prices are the UNDISCOUNTED official catalogue prices, never scaled.
	require.Nil(t, view.ChannelPrice, "no discount group means no channel price to show")

	// Byte-identical construction with the normal path: the shared helper must
	// yield the same tier a resolvable-discount model would get for its official
	// reference (only the channel price differs).
	resolvable := snapshot
	resolvable.GroupGroupRatio = map[string]map[string]float64{"vip": {"claude": 0.5}}
	normal, err := UterRouteChannelPricingRecords(resolvable, 1240, []string{"claude-fable-5"}, "vip")
	require.NoError(t, err)
	require.Len(t, normal, 1)
	var normalView model.ChannelOfficialPricing
	require.NoError(t, common.UnmarshalJsonStr(normal[0].NormalizedPricing, &normalView))
	require.Len(t, normalView.Tiers, 1)
	require.Equal(t, normalView.Tiers[0], view.Tiers[0],
		"official tier must be identical whether or not a discount resolves")
	require.NotNil(t, normalView.ChannelPrice, "resolvable group still produces a channel price")
}
