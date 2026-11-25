package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
)

func pricingCandidates(names ...string) map[string]struct{} {
	out := make(map[string]struct{}, len(names))
	for _, name := range names {
		out[name] = struct{}{}
	}
	return out
}

func TestResolveRedirectAliasView(t *testing.T) {
	t.Run("no mapping leaves the catalog untouched", func(t *testing.T) {
		view := resolveRedirectAliasView(
			[]redirectChannelSource{{Models: "gpt-4o", ModelMapping: ""}},
			pricingCandidates("gpt-4o"),
		)
		assert.Empty(t, view.hiddenTargets)
		assert.Empty(t, view.targetByAlias)
	})

	t.Run("alias the channel does not serve cannot hide the upstream name", func(t *testing.T) {
		view := resolveRedirectAliasView(
			[]redirectChannelSource{{Models: "gpt-4o", ModelMapping: `{"my-gpt":"gpt-4o"}`}},
			pricingCandidates("my-gpt", "gpt-4o"),
		)
		assert.Empty(t, view.hiddenTargets)
		assert.Empty(t, view.targetByAlias)
	})

	t.Run("alias outside the pricing candidate set cannot hide the upstream name", func(t *testing.T) {
		view := resolveRedirectAliasView(
			[]redirectChannelSource{{Models: "my-gpt,gpt-4o", ModelMapping: `{"my-gpt":"gpt-4o"}`}},
			pricingCandidates("gpt-4o"),
		)
		assert.Empty(t, view.hiddenTargets)
		assert.Empty(t, view.targetByAlias)
	})

	t.Run("channel deliberately keeping both names keeps both on the plaza", func(t *testing.T) {
		view := resolveRedirectAliasView(
			[]redirectChannelSource{{Models: "my-gpt,gpt-4o", ModelMapping: `{"my-gpt":"gpt-4o"}`}},
			pricingCandidates("my-gpt", "gpt-4o"),
		)
		assert.Empty(t, view.hiddenTargets)
		assert.Empty(t, view.targetByAlias)
	})

	t.Run("published alias hides the raw upstream name", func(t *testing.T) {
		view := resolveRedirectAliasView(
			[]redirectChannelSource{{Models: "my-gpt", ModelMapping: `{"my-gpt":"gpt-4o"}`}},
			pricingCandidates("my-gpt", "gpt-4o"),
		)
		assert.Equal(t, pricingCandidates("gpt-4o"), view.hiddenTargets)
		assert.Equal(t, map[string]string{"my-gpt": "gpt-4o"}, view.targetByAlias)
		assert.True(t, view.hides("gpt-4o"))
		assert.False(t, view.hides("my-gpt"))
	})

	t.Run("chain follows the relay rewrite to its tail", func(t *testing.T) {
		view := resolveRedirectAliasView(
			[]redirectChannelSource{{
				Models:       "my-gpt",
				ModelMapping: `{"my-gpt":"hop","hop":"gpt-4o"}`,
			}},
			pricingCandidates("my-gpt", "hop", "gpt-4o"),
		)
		assert.Equal(t, pricingCandidates("gpt-4o"), view.hiddenTargets)
		assert.Equal(t, map[string]string{"my-gpt": "gpt-4o"}, view.targetByAlias)
	})

	t.Run("cycle and self mapping are ignored", func(t *testing.T) {
		view := resolveRedirectAliasView(
			[]redirectChannelSource{{
				Models:       "a,b,self",
				ModelMapping: `{"a":"b","b":"a","self":"self"}`,
			}},
			pricingCandidates("a", "b", "self"),
		)
		assert.Empty(t, view.hiddenTargets)
		assert.Empty(t, view.targetByAlias)
	})

	t.Run("ambiguous alias is ignored instead of guessing a target", func(t *testing.T) {
		view := resolveRedirectAliasView(
			[]redirectChannelSource{
				{Models: "my-gpt", ModelMapping: `{"my-gpt":"gpt-4o"}`},
				{Models: "my-gpt", ModelMapping: `{"my-gpt":"claude-sonnet-4"}`},
			},
			pricingCandidates("my-gpt", "gpt-4o", "claude-sonnet-4"),
		)
		assert.Empty(t, view.hiddenTargets)
		assert.Empty(t, view.targetByAlias)
	})

	t.Run("a tail that is itself a published alias stays visible", func(t *testing.T) {
		view := resolveRedirectAliasView(
			[]redirectChannelSource{
				{Models: "alias-a", ModelMapping: `{"alias-a":"model-x"}`},
				{Models: "model-x", ModelMapping: `{"model-x":"model-y"}`},
			},
			pricingCandidates("alias-a", "model-x", "model-y"),
		)
		assert.Equal(t, pricingCandidates("model-y"), view.hiddenTargets)
		assert.Equal(t, map[string]string{
			"alias-a": "model-x",
			"model-x": "model-y",
		}, view.targetByAlias)
	})

	t.Run("whitespace in models and mapping is normalized", func(t *testing.T) {
		view := resolveRedirectAliasView(
			[]redirectChannelSource{{
				Models:       " my-gpt , other ",
				ModelMapping: `{"my-gpt": " gpt-4o "}`,
			}},
			pricingCandidates("my-gpt", "gpt-4o"),
		)
		assert.Equal(t, pricingCandidates("gpt-4o"), view.hiddenTargets)
		assert.Equal(t, "gpt-4o", view.targetByAlias["my-gpt"])
	})

	t.Run("malformed mapping fails soft", func(t *testing.T) {
		view := resolveRedirectAliasView(
			[]redirectChannelSource{{Models: "my-gpt", ModelMapping: "{bad json"}},
			pricingCandidates("my-gpt", "gpt-4o"),
		)
		assert.Empty(t, view.hiddenTargets)
		assert.Empty(t, view.targetByAlias)
	})
}

func TestResolvePricingIcon(t *testing.T) {
	aliasView := redirectAliasView{
		hiddenTargets: pricingCandidates("gpt-4o"),
		targetByAlias: map[string]string{"my-gpt": "gpt-4o"},
	}

	t.Run("the alias keeps its own product logo when it has one", func(t *testing.T) {
		icon := resolvePricingIcon(
			"my-gpt",
			&Model{Icon: "alias-own-icon"},
			map[string]*Model{"gpt-4o": {Icon: "upstream-icon"}},
			aliasView,
		)
		assert.Equal(t, "alias-own-icon", icon)
	})

	t.Run("alias inherits the upstream catalogue product logo", func(t *testing.T) {
		icon := resolvePricingIcon(
			"my-gpt",
			nil,
			map[string]*Model{"gpt-4o": {Icon: "upstream-icon"}},
			aliasView,
		)
		assert.Equal(t, "upstream-icon", icon)
	})

	t.Run("alias inherits the upstream name-based product logo without metadata", func(t *testing.T) {
		want := defaultProductIconForModel("gpt-4o")
		require.NotEmpty(t, want)
		icon := resolvePricingIcon("my-gpt", nil, nil, aliasView)
		assert.Equal(t, want, icon)
	})

	t.Run("a non redirected model still uses its own name attribution", func(t *testing.T) {
		want := defaultProductIconForModel("gpt-4o")
		require.NotEmpty(t, want)
		icon := resolvePricingIcon("gpt-4o", nil, nil, redirectAliasView{})
		assert.Equal(t, want, icon)
	})

	t.Run("unknown model without a logo returns empty", func(t *testing.T) {
		icon := resolvePricingIcon("zzz-unknown-model-xyz", nil, nil, redirectAliasView{})
		assert.Empty(t, icon)
	})
}

func TestUpdatePricingHidesRedirectedUpstreamAndInheritsLogo(t *testing.T) {
	resetPricingEndpointTestTables(t)

	channelID := 7318
	mapping := `{"my-gpt":"gpt-4o"}`
	require.NoError(t, DB.Create(&Channel{
		Id:           channelID,
		Type:         constant.ChannelTypeOpenAI,
		Key:          "key-7318",
		Status:       common.ChannelStatusEnabled,
		Name:         "redirected-channel",
		Models:       "my-gpt",
		ModelMapping: &mapping,
	}).Error)
	// The raw name can still linger in abilities from another channel or a
	// previous save; that is exactly what must no longer reach the plaza.
	insertPricingEndpointAbility(t, channelID, "my-gpt")
	insertPricingEndpointAbility(t, channelID, "gpt-4o")
	require.NoError(t, DB.Create(&Model{
		ModelName: "gpt-4o",
		NameRule:  NameRuleExact,
		Status:    1,
		Icon:      "upstream-product-icon",
	}).Error)

	updatePricing()

	aliasFound := false
	for _, item := range pricingMap {
		assert.NotEqual(t, "gpt-4o", item.ModelName, "raw upstream name must be hidden")
		if item.ModelName == "my-gpt" {
			aliasFound = true
			assert.Equal(t, "upstream-product-icon", item.Icon)
		}
	}
	assert.True(t, aliasFound, "the published alias must stay on the pricing plaza")
}
