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

	t.Run("upstream lingering in the model list is still hidden", func(t *testing.T) {
		// The real batch-redirect shape: a later "select all upstream models"
		// pass re-added the raw name next to its alias.
		view := resolveRedirectAliasView(
			[]redirectChannelSource{{Models: "my-gpt,gpt-4o", ModelMapping: `{"my-gpt":"gpt-4o"}`}},
			pricingCandidates("my-gpt", "gpt-4o"),
		)
		assert.Equal(t, pricingCandidates("gpt-4o"), view.hiddenTargets)
		assert.Equal(t, map[string]string{"my-gpt": "gpt-4o"}, view.targetByAlias)
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

	t.Run("any channel mapping works regardless of alias naming", func(t *testing.T) {
		// No -dr suffix, no special channel id: the rule is data-driven from
		// every enabled channel's model_mapping.
		view := resolveRedirectAliasView(
			[]redirectChannelSource{
				{
					Models:       "sf-qwen3-8b,Qwen/Qwen3-8B",
					ModelMapping: `{"sf-qwen3-8b":"Qwen/Qwen3-8B"}`,
				},
				{
					Models:       "groq-gpt-oss-120b",
					ModelMapping: `{"groq-gpt-oss-120b":"openai/gpt-oss-120b"}`,
				},
			},
			pricingCandidates("sf-qwen3-8b", "Qwen/Qwen3-8B", "groq-gpt-oss-120b"),
		)
		assert.Equal(t, pricingCandidates("Qwen/Qwen3-8B", "openai/gpt-oss-120b"), view.hiddenTargets)
		assert.Equal(t, map[string]string{
			"sf-qwen3-8b":       "Qwen/Qwen3-8B",
			"groq-gpt-oss-120b": "openai/gpt-oss-120b",
		}, view.targetByAlias)
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

	t.Run("GLM models always expose the product logo regardless of stored icon", func(t *testing.T) {
		// Upstream persists ZAI.Avatar on glm-5.x and a stray Hunyuan.Color on
		// cmaas-glm-5.3. A stored icon is never authoritative for GLM models.
		for name, stored := range map[string]string{
			"glm-5.3":       "ZAI.Avatar",
			"glm-5.1":       "ZAI.Avatar",
			"cmaas-glm-5.3": "Hunyuan.Color",
			"ZHIPU/GLM-5.3": "ZAI.Avatar",
			"glm-5.3-prime": "ChatGLM.Color",
		} {
			assert.Equal(t, "ChatGLM", resolvePricingIcon(
				name, &Model{Icon: stored}, nil, redirectAliasView{},
			), "model %s", name)
		}
	})

	t.Run("a non-GLM model keeps its own stored product icon", func(t *testing.T) {
		assert.Equal(t, "Hunyuan.Color", resolvePricingIcon(
			"hunyuan-turbo", &Model{Icon: "Hunyuan.Color"}, nil, redirectAliasView{},
		))
	})
}

func TestUpdatePricingFlagsRedirectedUpstreamAndInheritsLogo(t *testing.T) {
	resetPricingEndpointTestTables(t)

	channelID := 7318
	mapping := `{"my-gpt":"gpt-4o"}`
	require.NoError(t, DB.Create(&Channel{
		Id:           channelID,
		Type:         constant.ChannelTypeOpenAI,
		Key:          "key-7318",
		Status:       common.ChannelStatusEnabled,
		Name:         "redirected-channel",
		Models:       "gpt-4o,my-gpt",
		ModelMapping: &mapping,
	}).Error)
	// The raw name lingers both in the channel model list and in abilities —
	// the real batch-redirect shape after an "add upstream models" pass.
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
	upstreamFound := false
	for _, item := range pricingMap {
		switch item.ModelName {
		case "my-gpt":
			aliasFound = true
			assert.Equal(t, "upstream-product-icon", item.Icon)
			assert.False(t, item.HiddenByRedirect, "the published alias must stay visible")
		case "gpt-4o":
			upstreamFound = true
			assert.True(t, item.HiddenByRedirect, "raw upstream name must be flagged for the plaza")
		}
	}
	assert.True(t, aliasFound, "the published alias must stay on the pricing plaza")
	assert.True(t, upstreamFound, "billing/schema consumers keep the upstream row")
}

func TestUpdatePricingFlagsRedirectsAcrossChannels(t *testing.T) {
	resetPricingEndpointTestTables(t)

	// Different channels, different alias naming, no -dr anywhere. The view is
	// derived from each enabled channel's model_mapping, not from a fixed rule.
	internalMapping := `{"sf-qwen3-8b":"Qwen/Qwen3-8B"}`
	require.NoError(t, DB.Create(&Channel{
		Id:           22,
		Type:         constant.ChannelTypeOpenAI,
		Key:          "key-22",
		Status:       common.ChannelStatusEnabled,
		Name:         "internal",
		Models:       "sf-qwen3-8b,Qwen/Qwen3-8B",
		ModelMapping: &internalMapping,
	}).Error)
	groqMapping := `{"groq-gpt-oss-120b":"openai/gpt-oss-120b"}`
	require.NoError(t, DB.Create(&Channel{
		Id:           23,
		Type:         constant.ChannelTypeOpenAI,
		Key:          "key-23",
		Status:       common.ChannelStatusEnabled,
		Name:         "groq",
		Models:       "groq-gpt-oss-120b",
		ModelMapping: &groqMapping,
	}).Error)

	insertPricingEndpointAbility(t, 22, "sf-qwen3-8b")
	insertPricingEndpointAbility(t, 22, "Qwen/Qwen3-8B")
	insertPricingEndpointAbility(t, 23, "groq-gpt-oss-120b")
	require.NoError(t, DB.Create(&Model{
		ModelName: "Qwen/Qwen3-8B",
		NameRule:  NameRuleExact,
		Status:    1,
		Icon:      "qwen-product-logo",
	}).Error)

	updatePricing()

	byName := pricingByModel(pricingMap)
	require.Contains(t, byName, "Qwen/Qwen3-8B", "billing keeps the upstream row")
	assert.True(t, byName["Qwen/Qwen3-8B"].HiddenByRedirect)
	require.Contains(t, byName, "sf-qwen3-8b")
	assert.False(t, byName["sf-qwen3-8b"].HiddenByRedirect)
	assert.Equal(t, "qwen-product-logo", byName["sf-qwen3-8b"].Icon)
	require.Contains(t, byName, "groq-gpt-oss-120b")
	assert.False(t, byName["groq-gpt-oss-120b"].HiddenByRedirect)
}
