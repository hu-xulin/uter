/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/

package controller

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/model"
)

// channelWithMapping builds an in-memory channel carrying an operator-declared
// model_mapping (local -> upstream) and the set of locally exposed model names.
// No database is involved: the resolver only reads these two fields.
func channelWithMapping(mapping string, exposed ...string) *model.Channel {
	channel := &model.Channel{Id: 1, Models: strings.Join(exposed, ",")}
	if mapping != "" {
		channel.ModelMapping = &mapping
	}
	return channel
}

// DreamRouter's ByteDance slice of /api/pricing: the four Seedance 2.x video
// models are filed under short aliases while the doubao task plugin declares
// them by their full Ark model IDs. The three Seedream image models already
// match and must be left alone.
const dreamRouterPayload = `{"success":true,"data":[
	{"model_name":"seedance-2.0","vendor_id":8,"quota_type":0,"model_ratio":3.45,"completion_ratio":1},
	{"model_name":"seedance-2.0-fast","vendor_id":8,"quota_type":0,"model_ratio":2.775,"completion_ratio":1},
	{"model_name":"seedance-2.0-mini","vendor_id":8,"quota_type":0,"model_ratio":1.725,"completion_ratio":1},
	{"model_name":"seedance-2.5","vendor_id":8,"quota_type":0,"model_ratio":5.25,"completion_ratio":1},
	{"model_name":"doubao-seedream-4-0-250828","vendor_id":8,"quota_type":1,"model_price":0.029},
	{"model_name":"doubao-seedream-4-5-251128","vendor_id":8,"quota_type":1,"model_price":0.036},
	{"model_name":"doubao-seedream-5-0-260128","vendor_id":8,"quota_type":1,"model_price":0.032}
]}`

// The operator-declared mapping on the Doubao channel: every declared Ark ID
// paired with the short alias DreamRouter serves it under.
const doubaoAliasMapping = `{
	"doubao-seedance-2-0-260128":"seedance-2.0",
	"doubao-seedance-2-0-fast-260128":"seedance-2.0-fast",
	"doubao-seedance-2-0-mini-260615":"seedance-2.0-mini",
	"doubao-seedance-2-5-260628":"seedance-2.5"
}`

// TestPriceSyncAliasResolvesDeclaredModelNames is the acceptance test for the
// "4 个大模型无法同步" gap: upstream prices filed under an alias must land on
// the model the local catalogue actually declares, so the sync can import them.
func TestPriceSyncAliasResolvesDeclaredModelNames(t *testing.T) {
	parsed, err := parseUpstreamPricingPayload([]byte(dreamRouterPayload))
	require.NoError(t, err)

	resolver := buildPriceSyncAliasResolver(channelWithMapping(
		doubaoAliasMapping,
		"doubao-seedance-2-0-260128",
		"doubao-seedance-2-0-fast-260128",
		"doubao-seedance-2-0-mini-260615",
		"doubao-seedance-2-5-260628",
		"doubao-seedream-4-0-250828",
	))

	converted, renamed := resolver.apply(parsed)

	for _, pair := range []struct{ declared, alias string }{
		{"doubao-seedance-2-0-260128", "seedance-2.0"},
		{"doubao-seedance-2-0-fast-260128", "seedance-2.0-fast"},
		{"doubao-seedance-2-0-mini-260615", "seedance-2.0-mini"},
		{"doubao-seedance-2-5-260628", "seedance-2.5"},
	} {
		ratios := valueMap(converted["model_ratio"])
		assert.Contains(t, ratios, pair.declared, "declared model %q must receive the aliased price", pair.declared)
		assert.NotContains(t, ratios, pair.alias, "alias %q must not remain as a separate catalogue entry", pair.alias)
		assert.Contains(t, renamed, pair.alias+"→"+pair.declared)
	}

	// The ratio values themselves are untouched — only the key changes.
	assert.InDelta(t, 3.45, valueMap(converted["model_ratio"])["doubao-seedance-2-0-260128"], 1e-9)
	assert.InDelta(t, 5.25, valueMap(converted["model_ratio"])["doubao-seedance-2-5-260628"], 1e-9)

	// Names that already match keep working, in every pricing field.
	assert.InDelta(t, 0.029, valueMap(converted["model_price"])["doubao-seedream-4-0-250828"], 1e-9)
	assert.InDelta(t, 1.0, valueMap(converted["completion_ratio"])["doubao-seedance-2-0-260128"], 1e-9)
}

// A resolved alias must reach the diff builder under the declared name, which
// is the only name the local catalogue knows. This is what makes the sync able
// to import the price at all.
func TestPriceSyncAliasSurvivesTheDiffPipeline(t *testing.T) {
	parsed, err := parseUpstreamPricingPayload([]byte(dreamRouterPayload))
	require.NoError(t, err)
	resolver := buildPriceSyncAliasResolver(channelWithMapping(
		doubaoAliasMapping,
		"doubao-seedance-2-0-260128",
		"doubao-seedance-2-0-fast-260128",
		"doubao-seedance-2-0-mini-260615",
		"doubao-seedance-2-5-260628",
	))
	converted, _ := resolver.apply(parsed)
	normalized, _ := effectivePricingSyncData(converted)

	local := map[string]any{"model_ratio": map[string]any{}}
	diff := buildDifferences(local, []struct {
		name string
		data map[string]any
	}{{"dreamrouter", normalized}})

	for _, declared := range []string{
		"doubao-seedance-2-0-260128",
		"doubao-seedance-2-0-fast-260128",
		"doubao-seedance-2-0-mini-260615",
		"doubao-seedance-2-5-260628",
	} {
		assert.Contains(t, diff, declared)
		assert.Contains(t, diff[declared], "model_ratio")
	}
}

// A channel with no model_mapping authorises nothing, so its upstream names
// must pass through untouched.
func TestPriceSyncAliasWithoutMappingIsNoop(t *testing.T) {
	resolver := buildPriceSyncAliasResolver(channelWithMapping("", "doubao-seedance-2-0-260128"))
	input := map[string]any{"model_ratio": map[string]any{"seedance-2.0": 3.45}}

	converted, renamed := resolver.apply(input)

	assert.Empty(t, renamed)
	assert.Equal(t, input, converted)
}

// A nil resolver (channel absent from the lookup) must be safe to call — the
// fetch goroutine calls apply unconditionally.
func TestPriceSyncAliasNilResolverIsNoop(t *testing.T) {
	var resolver *priceSyncAliasResolver
	input := map[string]any{"model_ratio": map[string]any{"seedance-2.0": 3.45}}

	converted, renamed := resolver.apply(input)

	assert.Empty(t, renamed)
	assert.Equal(t, input, converted)
}

// When the upstream advertises both the alias and the declared name, the
// declared entry wins and the alias is dropped, so one model never carries the
// same price under two keys.
func TestPriceSyncAliasDropsAliasWhenDeclaredNameIsDirect(t *testing.T) {
	resolver := buildPriceSyncAliasResolver(channelWithMapping(
		`{"doubao-seedance-2-0-260128":"seedance-2.0"}`,
		"doubao-seedance-2-0-260128",
	))
	input := map[string]any{"model_ratio": map[string]any{
		"seedance-2.0":               3.45,
		"doubao-seedance-2-0-260128": 3.45,
	}}

	converted, renamed := resolver.apply(input)

	ratios := valueMap(converted["model_ratio"])
	assert.Len(t, ratios, 1)
	assert.Contains(t, ratios, "doubao-seedance-2-0-260128")
	assert.Empty(t, renamed, "the alias is dropped rather than renamed onto the existing key")
}

// Two local names resolving to one upstream name is ambiguous: guessing would
// attach one price to the wrong model, so nothing is renamed.
func TestPriceSyncAliasRefusesAmbiguousUpstreamName(t *testing.T) {
	resolver := buildPriceSyncAliasResolver(channelWithMapping(
		`{"model-a":"shared-upstream","model-b":"shared-upstream"}`,
		"model-a", "model-b",
	))
	input := map[string]any{"model_ratio": map[string]any{"shared-upstream": 2.0}}

	converted, renamed := resolver.apply(input)

	assert.Empty(t, renamed)
	assert.Contains(t, valueMap(converted["model_ratio"]), "shared-upstream")
}

// model_mapping may chain (local -> ... -> upstream); the resolver must follow
// it to the tail the way the relay does, because that tail is what the
// upstream actually advertises.
func TestPriceSyncAliasFollowsMappingChain(t *testing.T) {
	resolver := buildPriceSyncAliasResolver(channelWithMapping(
		`{"declared-model":"intermediate","intermediate":"upstream-tail"}`,
		"declared-model",
	))
	input := map[string]any{"model_ratio": map[string]any{"upstream-tail": 4.0}}

	converted, renamed := resolver.apply(input)

	assert.Contains(t, valueMap(converted["model_ratio"]), "declared-model")
	// The intermediate hop is a mapping detail, not a priced model.
	assert.NotContains(t, valueMap(converted["model_ratio"]), "intermediate")
	assert.Equal(t, []string{"upstream-tail→declared-model"}, renamed)
}

// A cyclic mapping must not hang or invent a name: it authorises nothing.
func TestPriceSyncAliasTerminatesOnCyclicMapping(t *testing.T) {
	resolver := buildPriceSyncAliasResolver(channelWithMapping(
		`{"model-a":"model-b","model-b":"model-a"}`,
		"model-a", "model-b",
	))
	input := map[string]any{"model_ratio": map[string]any{"model-a": 1.0, "model-b": 2.0}}

	converted, renamed := resolver.apply(input)

	assert.Empty(t, renamed)
	assert.Equal(t, input["model_ratio"], converted["model_ratio"])
}

// A self-referential entry resolves to itself, which is not an alias.
func TestPriceSyncAliasIgnoresSelfMapping(t *testing.T) {
	resolver := buildPriceSyncAliasResolver(channelWithMapping(
		`{"same-model":"same-model"}`,
		"same-model",
	))
	input := map[string]any{"model_ratio": map[string]any{"same-model": 1.5}}

	converted, renamed := resolver.apply(input)

	assert.Empty(t, renamed)
	assert.Contains(t, valueMap(converted["model_ratio"]), "same-model")
}

// Only names the channel exposes are candidates: a mapping entry for a model
// the channel no longer serves must not authorise a rename.
func TestPriceSyncAliasIgnoresUnexposedLocalName(t *testing.T) {
	resolver := buildPriceSyncAliasResolver(channelWithMapping(
		`{"retired-model":"seedance-2.0"}`,
		"doubao-seedance-2-0-260128",
	))
	input := map[string]any{"model_ratio": map[string]any{"seedance-2.0": 3.45}}

	converted, renamed := resolver.apply(input)

	assert.Empty(t, renamed)
	assert.Contains(t, valueMap(converted["model_ratio"]), "seedance-2.0")
}

// A malformed model_mapping must fail soft: warn and resolve nothing rather
// than aborting the price sync.
func TestPriceSyncAliasFailsSoftOnMalformedMapping(t *testing.T) {
	resolver := buildPriceSyncAliasResolver(channelWithMapping(
		`{not json`,
		"doubao-seedance-2-0-260128",
	))
	input := map[string]any{"model_ratio": map[string]any{"seedance-2.0": 3.45}}

	converted, renamed := resolver.apply(input)

	assert.Empty(t, renamed)
	assert.Equal(t, input, converted)
}

// Fields whose value is not a name-keyed map are copied through untouched.
func TestPriceSyncAliasPassesThroughNonMapFields(t *testing.T) {
	resolver := buildPriceSyncAliasResolver(channelWithMapping(
		`{"doubao-seedance-2-0-260128":"seedance-2.0"}`,
		"doubao-seedance-2-0-260128",
	))
	input := map[string]any{"unexpected_field": "scalar"}

	converted, renamed := resolver.apply(input)

	assert.Empty(t, renamed)
	assert.Equal(t, "scalar", converted["unexpected_field"])
}
