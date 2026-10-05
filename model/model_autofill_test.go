package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// The automatic fill is the unattended counterpart of the sync wizard, so its
// safety rules matter more than its coverage: it must never overwrite curated
// data and must honour the sync_official opt-out.
func TestPlanOfficialMetadataFillCreatesMissingRowsOnly(t *testing.T) {
	locals := map[string]*Model{
		"existing": {ModelName: "existing", Description: "kept", Icon: "Kept", VendorID: 7, SyncOfficial: 1},
	}
	vendors := map[string]*Vendor{
		"Acme": {Id: 7, Name: "Acme"},
	}
	upstream := map[string]MetadataValues{
		"existing":  {Description: "upstream description", Icon: "Upstream", Tags: "vision", Vendor: "Acme", NameRule: NameRuleExact, Status: 1},
		"brand-new": {Description: "upstream description", Icon: "New", Tags: "chat", Vendor: "Acme", NameRule: NameRuleExact, Status: 1},
	}
	upstreamVendors := map[string]Vendor{"Acme": {Name: "Acme", Icon: "Acme"}}

	result, updates := PlanOfficialMetadataFill(
		[]string{"existing", "brand-new", "unknown-to-upstream"},
		locals, vendors, upstream, upstreamVendors,
	)

	require.Equal(t, []string{"brand-new"}, result.CreatedModels)
	require.Equal(t, 1, result.SkippedUpstream)
	require.Len(t, updates, 2)

	// The existing row keeps its curated description and icon, so only the
	// blank tags field is scheduled. Its vendor is already set and must not
	// move, and visibility is an administrator's decision.
	existingUpdate := findUpdate(t, updates, "existing")
	require.False(t, existingUpdate.Create)
	require.Equal(t, []string{"tags"}, existingUpdate.Fields)
	require.Equal(t, []string{"existing"}, result.UpdatedModels)

	newUpdate := findUpdate(t, updates, "brand-new")
	require.True(t, newUpdate.Create)
	require.ElementsMatch(t, MetadataSyncFields, newUpdate.Fields,
		"a created row takes the full official field set")
	require.NotEmpty(t, newUpdate.RecordVersion, "apply still verifies the observed record version")
}

func TestPlanOfficialMetadataFillFillsOnlyBlankFields(t *testing.T) {
	locals := map[string]*Model{
		"partial": {
			ModelName:    "partial",
			Description:  "curated description",
			Icon:         "Curated",
			Tags:         "chat",
			VendorID:     7,
			Endpoints:    `["openai"]`,
			Status:       0,
			NameRule:     NameRuleExact,
			SyncOfficial: 1,
		},
	}
	vendors := map[string]*Vendor{"Acme": {Id: 7, Name: "Acme"}}
	upstream := map[string]MetadataValues{
		"partial": {Description: "upstream", Icon: "Upstream", Tags: "vision", Vendor: "Other", Endpoints: `["anthropic"]`, NameRule: NameRulePrefix, Status: 1},
	}
	upstreamVendors := map[string]Vendor{"Acme": {Name: "Acme"}, "Other": {Name: "Other"}}

	result, updates := PlanOfficialMetadataFill([]string{"partial"}, locals, vendors, upstream, upstreamVendors)

	// Everything on this row is already set, so there is nothing safe to fill.
	require.Empty(t, result.UpdatedModels)
	require.Empty(t, updates)
}

func TestPlanOfficialMetadataFillRespectsSyncOfficialOptOut(t *testing.T) {
	locals := map[string]*Model{
		"opted-out": {ModelName: "opted-out", SyncOfficial: 0},
		"opted-out-blank": {
			ModelName: "opted-out-blank", SyncOfficial: 0,
		},
	}
	upstream := map[string]MetadataValues{
		"opted-out":       {Description: "upstream", Icon: "Up"},
		"opted-out-blank": {Description: "upstream", Icon: "Up"},
	}
	upstreamVendors := map[string]Vendor{}

	result, updates := PlanOfficialMetadataFill(
		[]string{"opted-out", "opted-out-blank"}, locals, map[string]*Vendor{}, upstream, upstreamVendors,
	)

	require.Equal(t, 2, result.SkippedOptOut)
	require.Empty(t, result.CreatedModels)
	require.Empty(t, result.UpdatedModels)
	require.Empty(t, updates, "an opted-out model is never scheduled for a write")
}

func TestPlanOfficialMetadataFillSkipsPatternCoveredNames(t *testing.T) {
	locals := map[string]*Model{
		"gpt-": {ModelName: "gpt-", NameRule: NameRulePrefix, SyncOfficial: 1},
	}
	upstream := map[string]MetadataValues{
		"gpt-4o": {Description: "upstream", Icon: "OpenAI", NameRule: NameRuleExact, Status: 1},
	}
	upstreamVendors := map[string]Vendor{}

	result, updates := PlanOfficialMetadataFill([]string{"gpt-4o"}, locals, map[string]*Vendor{}, upstream, upstreamVendors)

	// An explicit row would shadow the administrator's prefix rule and change
	// attribution for every model it matches.
	require.Empty(t, result.CreatedModels)
	require.Empty(t, updates)
	require.Zero(t, result.SkippedUpstream, "the model is known upstream; it is deliberately not created")
}

func TestPlanOfficialMetadataFillAssignsVendorOnlyWhenUnset(t *testing.T) {
	locals := map[string]*Model{
		"no-vendor":  {ModelName: "no-vendor", VendorID: 0, SyncOfficial: 1},
		"has-vendor": {ModelName: "has-vendor", VendorID: 7, SyncOfficial: 1},
	}
	vendors := map[string]*Vendor{"Acme": {Id: 7, Name: "Acme"}}
	upstream := map[string]MetadataValues{
		"no-vendor":  {Description: "upstream", Vendor: "Acme", NameRule: NameRuleExact},
		"has-vendor": {Description: "upstream", Vendor: "Acme", NameRule: NameRuleExact},
	}
	upstreamVendors := map[string]Vendor{"Acme": {Name: "Acme"}}

	_, updates := PlanOfficialMetadataFill([]string{"no-vendor", "has-vendor"}, locals, vendors, upstream, upstreamVendors)

	// The unassigned vendor is filled; the description is blank on both rows.
	require.Equal(t, []string{"description", "vendor"}, findUpdate(t, updates, "no-vendor").Fields)
	// A row that already has a vendor keeps it: the fill never re-assigns.
	require.Equal(t, []string{"description"}, findUpdate(t, updates, "has-vendor").Fields)
}

func TestPlanOfficialMetadataFillIgnoresVendorMissingUpstream(t *testing.T) {
	// A model whose official vendor is unknown to the vendor catalog cannot be
	// created, because ApplyMetadataSync would reject the missing vendor.
	locals := map[string]*Model{"orphan": {ModelName: "orphan", SyncOfficial: 1}}
	upstream := map[string]MetadataValues{
		"orphan": {Description: "upstream", Vendor: "Ghost", NameRule: NameRuleExact},
	}

	_, updates := PlanOfficialMetadataFill([]string{"orphan"}, locals, map[string]*Vendor{}, upstream, map[string]Vendor{})

	// The description is still safe to fill, but the vendor must be left alone:
	// ApplyMetadataSync would reject a vendor absent from the vendor catalog.
	require.Equal(t, []string{"description"}, findUpdate(t, updates, "orphan").Fields)
}

// A draft must be keyed by the option names the pricing engine persists, and a
// per-call price must win outright so a preset quoting both cannot leave a
// contradictory ratio behind.
func TestPricingValuesFromPresetMapsFieldsToOptionKeys(t *testing.T) {
	t.Run("ratio dimensions", func(t *testing.T) {
		draft := pricingValuesFromPreset(map[string]float64{
			"model_ratio":            2,
			"completion_ratio":       3,
			"cache_ratio":            0.5,
			"create_cache_ratio":     1.25,
			"image_ratio":            4,
			"audio_ratio":            5,
			"audio_completion_ratio": 6,
		})
		require.Equal(t, PricingValues{
			"ModelRatio":           float64(2),
			"CompletionRatio":      float64(3),
			"CacheRatio":           0.5,
			"CreateCacheRatio":     1.25,
			"ImageRatio":           float64(4),
			"AudioRatio":           float64(5),
			"AudioCompletionRatio": float64(6),
		}, draft)
	})

	t.Run("per call price wins", func(t *testing.T) {
		draft := pricingValuesFromPreset(map[string]float64{
			"model_price": 0.02,
			"model_ratio": 2,
		})
		require.Equal(t, PricingValues{"ModelPrice": 0.02}, draft)
	})

	t.Run("expression fields are not importable", func(t *testing.T) {
		require.Nil(t, pricingValuesFromPreset(map[string]float64{
			"billing_setting.billing_mode": 1,
			"billing_setting.billing_expr": 1,
		}))
	})

	t.Run("negative ratios are dropped", func(t *testing.T) {
		require.Nil(t, pricingValuesFromPreset(map[string]float64{"model_ratio": -1}))
		require.Nil(t, pricingValuesFromPreset(map[string]float64{}))
	})
}

// The admin table reports a model as unpriced based on what was actually saved,
// so the fill must use the same definition rather than treating an engine
// default as a price.
func TestModelPricingConfiguredMirrorsAdminClassification(t *testing.T) {
	tiers := PricingValues{
		pricingBillingModeKey: "tiered_expr",
		pricingBillingExprKey: "tier(\"0:1M\", 1, 2)",
	}
	cases := []struct {
		name       string
		configured PricingValues
		effective  PricingValues
		want       bool
	}{
		{name: "nothing saved", configured: PricingValues{}, effective: PricingValues{"CompletionRatio": 1.0}, want: false},
		{name: "saved ratio", configured: PricingValues{"ModelRatio": 2.0}, effective: PricingValues{}, want: true},
		{name: "saved per call price", configured: PricingValues{"ModelPrice": 0.5}, effective: PricingValues{}, want: true},
		{name: "tiered expression", configured: PricingValues{}, effective: tiers, want: true},
		{
			name:       "plugin expression",
			configured: PricingValues{},
			effective:  PricingValues{"billing_setting.plugin_billing_expr": map[string]any{"midjourney": "fixed(1)"}},
			want:       true,
		},
		{
			name:       "engine default per call price still counts as priced",
			configured: PricingValues{},
			effective:  PricingValues{"ModelPrice": 1.0},
			want:       true,
		},
		{
			name:       "tiered mode without expression is unpriced",
			configured: PricingValues{},
			effective:  PricingValues{pricingBillingModeKey: "tiered_expr", pricingBillingExprKey: "  "},
			want:       false,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, modelPricingConfigured(tc.configured, tc.effective))
		})
	}
}

func findUpdate(t *testing.T, updates []MetadataSyncUpdate, name string) MetadataSyncUpdate {
	t.Helper()
	for _, update := range updates {
		if update.ModelName == name {
			return update
		}
	}
	return MetadataSyncUpdate{}
}

// A model the catalog has never heard of must still be filled by keyword, so a
// newly launched product line stops reporting as missing metadata.
func TestPlanOfficialMetadataFillDerivesUnknownModels(t *testing.T) {
	locals := map[string]*Model{}
	vendors := map[string]*Vendor{
		// The site manages the brand locally even though the official vendor
		// catalog files the same company under its product name.
		"ByteDance": {Id: 15, Name: "ByteDance"},
	}
	upstream := map[string]MetadataValues{
		// A catalogued relative for the same brand.
		"doubao-seed-2-0-pro-260215": {Description: "Doubao Seed", Icon: "Doubao", Vendor: "Volcengine Ark", NameRule: NameRuleExact, Status: 1},
	}

	result, updates := PlanOfficialMetadataFill(
		[]string{"doubao-seedance-2-0-260128", "doubao-seedream-5-0-260128"},
		locals, vendors, upstream, map[string]Vendor{},
	)

	require.Equal(t, []string{"doubao-seedance-2-0-260128", "doubao-seedream-5-0-260128"}, result.CreatedModels)
	require.Zero(t, result.SkippedUpstream)
	require.Len(t, updates, 2)
	for _, update := range updates {
		require.True(t, update.Create)
		require.Equal(t, "ByteDance", update.Values.Vendor,
			"a derived model must attach to the vendor the site already manages")
	}
}

// A derived brand the site does not manage and the official catalog does not
// know must be skipped rather than guessed at or allowed to fail the batch.
func TestPlanOfficialMetadataFillSkipsUnresolvableDerivedVendor(t *testing.T) {
	locals := map[string]*Model{}
	// The site has no "Nowhere" vendor and the catalog has never heard of it.
	result, updates := PlanOfficialMetadataFill(
		[]string{"nowhere-model-1"},
		locals, map[string]*Vendor{}, map[string]MetadataValues{}, map[string]Vendor{},
	)

	require.Empty(t, result.CreatedModels)
	require.Equal(t, 1, result.SkippedUpstream)
	require.Empty(t, updates)
}
