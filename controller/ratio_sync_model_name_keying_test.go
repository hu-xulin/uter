package controller

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestPricingSyncIsStrictlyModelNameKeyed documents why a gateway that renames
// upstream models cannot hand its prices to the local model catalogue.
//
// The Doubao task plugin (plugins/tasks/doubao/plugin.js) declares the
// Volcengine Ark models by their full model IDs — `doubao-seedance-2-0-260128`,
// `doubao-seedance-2-0-fast-260128`, `doubao-seedance-2-0-mini-260615`,
// `doubao-seedance-2-5-260628`. DreamRouter's /api/pricing advertises the very
// same four models under short aliases — `seedance-2.0`, `seedance-2.0-fast`,
// `seedance-2.0-mini`, `seedance-2.5` — dropping the `doubao-` prefix, dotting
// the version and dropping the date suffix.
//
// parseUpstreamPricingPayload, effectivePricingSyncData and buildDifferences all
// key purely on the model name string, so a price filed under `seedance-2.0`
// can never attach to `doubao-seedance-2-0-260128`. The sync therefore imports
// the alias as a brand-new, unpriced catalogue entry and leaves the declared
// model without a price.
//
// If alias support is ever added to the sync, this test is the checklist of
// names that must start resolving.
func TestPricingSyncIsStrictlyModelNameKeyed(t *testing.T) {
	// DreamRouter's ByteDance (vendor_id 8) slice of /api/pricing, verbatim
	// shape: the four current Seedance 2.x video models plus the three
	// Seedream image models that DO match the plugin's declared IDs.
	payload := []byte(`{"success":true,"data":[
		{"model_name":"seedance-2.0","vendor_id":8,"quota_type":0,"model_ratio":3.45,"completion_ratio":1},
		{"model_name":"seedance-2.0-fast","vendor_id":8,"quota_type":0,"model_ratio":2.775,"completion_ratio":1},
		{"model_name":"seedance-2.0-mini","vendor_id":8,"quota_type":0,"model_ratio":1.725,"completion_ratio":1},
		{"model_name":"seedance-2.5","vendor_id":8,"quota_type":0,"model_ratio":5.25,"completion_ratio":1},
		{"model_name":"doubao-seedream-4-0-250828","vendor_id":8,"quota_type":1,"model_price":0.029},
		{"model_name":"doubao-seedream-4-5-251128","vendor_id":8,"quota_type":1,"model_price":0.036},
		{"model_name":"doubao-seedream-5-0-260128","vendor_id":8,"quota_type":1,"model_price":0.032}
	]}`)

	parsed, err := parseUpstreamPricingPayload(payload)
	require.NoError(t, err)

	// The local catalogue as it looks on a Doubao-plugin channel: the plugin's
	// declared Ark model IDs, none of them priced yet.
	local := map[string]any{"model_ratio": map[string]any{}}
	normalized, _ := effectivePricingSyncData(parsed)

	diff := buildDifferences(local, []struct {
		name string
		data map[string]any
	}{{"dreamrouter", normalized}})

	// Every entry the upstream advertises survives the pipeline — nothing is
	// dropped for being mis-shaped. The gap is purely the name.
	for _, name := range []string{
		"seedance-2.0", "seedance-2.0-fast", "seedance-2.0-mini", "seedance-2.5",
		"doubao-seedream-4-0-250828", "doubao-seedream-4-5-251128",
		"doubao-seedream-5-0-260128",
	} {
		assert.Contains(t, diff, name, "upstream entry %q must survive the sync pipeline", name)
	}

	// The plugin's declared video models get nothing: no upstream price is
	// filed under those names, so no difference is reported and no price can
	// be imported. This is the "4 个大模型无法同步" gap.
	for _, name := range []string{
		"doubao-seedance-2-0-260128",
		"doubao-seedance-2-0-fast-260128",
		"doubao-seedance-2-0-mini-260615",
		"doubao-seedance-2-5-260628",
	} {
		assert.NotContains(t, diff, name,
			"declared model %q receives no upstream price because the gateway files it under an alias", name)
	}

	// The Seedream image models already line up, which is why only the video
	// family goes missing.
	for _, name := range []string{
		"doubao-seedream-4-0-250828",
		"doubao-seedream-4-5-251128",
		"doubao-seedream-5-0-260128",
	} {
		assert.Contains(t, diff, name)
		assert.Contains(t, diff[name], "model_price")
	}
}
