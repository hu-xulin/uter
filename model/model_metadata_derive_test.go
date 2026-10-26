package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func deriveCatalog() map[string]MetadataValues {
	return map[string]MetadataValues{
		"deepseek-v4-flash": {Description: "DeepSeek V4.1 Flash model for reasoning and agentic coding", Icon: "DeepSeek.Color", Tags: "Reasoning,Tools,1M", Vendor: "DeepSeek", NameRule: NameRuleExact, Status: 1},
		"deepseek-v4-pro":   {Description: "DeepSeek V4 Pro snapshot", Icon: "DeepSeek.Color", Tags: "Reasoning,Tools,1M", Vendor: "DeepSeek", NameRule: NameRuleExact, Status: 1},
		"claude-opus-4-7":   {Description: "Stronger Opus tier for advanced software work", Icon: "Claude.Color", Tags: "Reasoning,Tools,Files,Vision,1M", Vendor: "Anthropic", NameRule: NameRuleExact, Status: 1},
		"gpt-image-1":       {Description: "Image generation model", Icon: "OpenAI", Tags: "Files,Vision", Vendor: "OpenAI", NameRule: NameRuleExact, Status: 1},
		"kimi-k2.6":         {Description: "Multimodal Kimi workhorse", Icon: "Moonshot", Tags: "Reasoning,Tools", Vendor: "Moonshot AI", NameRule: NameRuleExact, Status: 1},
		"old-model":         {Description: "Retired model", Icon: "X", Tags: "Reasoning", Vendor: "OpenAI", NameRule: NameRuleExact, Status: 0},
	}
}

// A dated snapshot or qualifier variant of a catalogued model must inherit that
// model's metadata, with the description re-labelled so its provenance is
// visible in the admin table.
func TestDeriveMetadataValuesFromCatalog(t *testing.T) {
	cases := []struct {
		name         string
		model        string
		wantVendor   string
		wantIcon     string
		wantContains string
	}{
		{
			name: "dated snapshot of a known model", model: "deepseek-v4-flash-0731",
			wantVendor: "DeepSeek", wantIcon: "DeepSeek.Color", wantContains: "deepseek-v4-flash",
		},
		{
			name: "qualifier variant", model: "claude-opus-4-7-thinking",
			wantVendor: "Anthropic", wantIcon: "Claude.Color", wantContains: "claude-opus-4-7",
		},
		{
			name: "suffixed release candidate", model: "deepseek-v4-pro-0813",
			wantVendor: "DeepSeek", wantIcon: "DeepSeek.Color", wantContains: "deepseek-v4-pro",
		},
		{
			name: "unknown member of a known family", model: "kimi-k2.5",
			wantVendor: "Moonshot AI", wantIcon: "Moonshot", wantContains: "kimi-k2.6",
		},
		{
			name: "exact hit is returned untouched", model: "gpt-image-1",
			wantVendor: "OpenAI", wantIcon: "OpenAI", wantContains: "Image generation model",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			values, ok := DeriveMetadataValuesFromCatalog(tc.model, deriveCatalog())
			require.True(t, ok)
			require.Equal(t, tc.wantVendor, values.Vendor)
			require.Equal(t, tc.wantIcon, values.Icon)
			require.Contains(t, values.Description, tc.wantContains)
			// A derived record is always an exact, visible catalog entry.
			require.Equal(t, NameRuleExact, values.NameRule)
			require.Equal(t, 1, values.Status)
		})
	}
}

// The nearest release must win, not the longest name: `gpt-image-2.5` is a
// variant of the catalogued `gpt-image-2`, not of the older `gpt-image-1.5`.
func TestDeriveMetadataValuesPrefersNearestVersion(t *testing.T) {
	catalog := map[string]MetadataValues{
		"gpt-image-1.5": {Description: "older image model", Icon: "OpenAI", Vendor: "OpenAI", NameRule: NameRuleExact, Status: 1},
		"gpt-image-2":   {Description: "current image model", Icon: "OpenAI", Vendor: "OpenAI", NameRule: NameRuleExact, Status: 1},
	}
	values, ok := DeriveMetadataValuesFromCatalog("gpt-image-2.5-flare", catalog)
	require.True(t, ok)
	require.Contains(t, values.Description, "gpt-image-2:")
	require.NotContains(t, values.Description, "gpt-image-1.5")
}

// A model whose family the catalog does not know must be left blank: guessing
// would file a model under a vendor nobody asserted.
func TestDeriveMetadataValuesFromCatalogRejectsUnknownFamilies(t *testing.T) {
	for _, model := range []string{
		"totally-unrelated-thing",
		"acme-internal-9",
		"",
	} {
		_, ok := DeriveMetadataValuesFromCatalog(model, deriveCatalog())
		require.False(t, ok, "must not invent metadata for %q", model)
	}
}

// A product line the catalog has never published still has to be attributable,
// otherwise every newly launched family stays blank in the admin table. The
// vendor comes from the name rules the pricing plaza already uses, and the
// description says it was attributed by name rather than copied.
//
// 关键词归因的行携带模型**自己的产品 logo**（如 Doubao、DeepSeek），但绝不携带
// 供应商的公司 logo（如 ByteDance）：定价页卡片只渲染模型自己的彩色 logo。
func TestDeriveMetadataValuesFallsBackToKeywords(t *testing.T) {
	cases := []struct {
		model          string
		wantVendor     string
		wantIcon       string
		wantNotCompany string
		wantTags       string
		wantCaption    string
	}{
		{
			model: "doubao-seedream-5-0-260128", wantVendor: "ByteDance",
			wantIcon: "Doubao", wantNotCompany: "ByteDance",
			wantTags: "Files,Vision", wantCaption: "image generation",
		},
		{
			model: "doubao-seedance-2-0-mini-260615", wantVendor: "ByteDance",
			wantIcon: "Doubao", wantNotCompany: "ByteDance",
			wantTags: "Vision", wantCaption: "video generation",
		},
		{
			model: "deepseek-v9-turbo-29991231", wantVendor: "DeepSeek",
			wantIcon: "DeepSeek", wantNotCompany: "",
			wantTags: "", wantCaption: "",
		},
	}
	for _, tc := range cases {
		t.Run(tc.model, func(t *testing.T) {
			// An empty catalog forces the keyword path.
			values, ok := DeriveMetadataValuesFromCatalog(tc.model, map[string]MetadataValues{})
			require.True(t, ok)
			require.Equal(t, tc.wantVendor, values.Vendor)
			require.Equal(t, tc.wantIcon, values.Icon, "keyword-derived row must carry the model's own product logo")
			if tc.wantNotCompany != "" {
				require.NotEqual(t, tc.wantNotCompany, values.Icon, "must never carry the vendor company logo")
			}
			require.Equal(t, tc.wantTags, values.Tags)
			require.Contains(t, values.Description, "attributed by model name")
			if tc.wantCaption != "" {
				require.Contains(t, values.Description, tc.wantCaption)
			}
			require.Equal(t, NameRuleExact, values.NameRule)
			require.Equal(t, 1, values.Status)
		})
	}
}

// Muse 是 Meta 的产品，@lobehub/icons 没有独立的 Muse 图标，因此回落到 Meta 公司
// 图标（与 llama 系列同处理）——一个可渲染的图标，而不是渲染不出来的坏键。
func TestKeywordAttributionMuseUsesMetaLogo(t *testing.T) {
	values, ok := deriveMetadataValuesFromKeywords("muse-spark-1.1")
	require.True(t, ok)
	require.Equal(t, "Meta", values.Vendor)
	require.Equal(t, "Meta", values.Icon, "Muse has no dedicated logo; falls back to Meta, never a broken key")
}

// A name that matches no brand rule must stay blank even when the catalog is
// empty: attributing it to a vendor the name does not imply would be a guess.
func TestDeriveMetadataValuesFromKeywordsRejectsUnbrandedNames(t *testing.T) {
	for _, model := range []string{
		"happyhorse-1.0-video-edit",
		"acme-internal-9",
		"totally-unrelated-thing",
	} {
		_, ok := DeriveMetadataValuesFromKeywords(model)
		require.False(t, ok, "must not attribute %q to a brand its name does not imply", model)
	}
}

// A relative that is not visible must not promote a derived model into the
// catalog, so a deprecated base cannot resurrect its variants.
func TestDeriveMetadataValuesFromCatalogKeepsHiddenRelativeHidden(t *testing.T) {
	values, ok := DeriveMetadataValuesFromCatalog("old-model-2", deriveCatalog())
	require.True(t, ok)
	require.Equal(t, 0, values.Status)
}

// Product-line words are boundaries, not variants: a name must not inherit from
// a shorter name that stops right before one of them.
func TestDeriveMetadataValuesFromCatalogRespectsProductLineBoundaries(t *testing.T) {
	catalog := map[string]MetadataValues{
		// "qwen" alone is a text family; "qwen-image" is a different product.
		"qwen": {Description: "Qwen text model", Icon: "Qwen", Tags: "Reasoning", Vendor: "Alibaba", NameRule: NameRuleExact, Status: 1},
	}
	_, ok := DeriveMetadataValuesFromCatalog("qwen-image-2.5-preview", catalog)
	require.False(t, ok, "must not treat an image model as a variant of the text family")

	// The nearest relative on the same product line is still fine.
	values, ok := DeriveMetadataValuesFromCatalog("qwen-omni-7b", catalog)
	require.True(t, ok)
	require.Equal(t, "Alibaba", values.Vendor)
}

func TestDerivedMetadataTagsAddsCapabilityTags(t *testing.T) {
	cases := []struct {
		model string
		tags  string
		want  string
	}{
		{model: "gpt-image-2.5-flare", tags: "", want: "Files,Vision"},
		{model: "doubao-seedream-5-0-260128", tags: "", want: "Files,Vision"},
		{model: "doubao-seedance-2-0-260128", tags: "", want: "Vision"},
		{model: "happyhorse-1.0-video-edit", tags: "Files", want: "Files,Vision"},
		// An existing tag is never duplicated.
		{model: "gpt-image-2.5-flare", tags: "Files,Vision", want: "Files,Vision"},
		// A text model gains nothing.
		{model: "deepseek-v4-pro-0813", tags: "Reasoning,Tools", want: "Reasoning,Tools"},
	}
	for _, tc := range cases {
		t.Run(tc.model+"/"+tc.tags, func(t *testing.T) {
			require.Equal(t, tc.want, DerivedMetadataTags(tc.model, tc.tags))
		})
	}
}
