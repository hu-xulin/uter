package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// models.dev ids are "provider/basename" while the site stores channel-shaped
// names ("doubao-seedream-4-0-250828"). Every tier below exists because a real
// site name failed to resolve without it, so a regression in any tier silently
// blanks the pricing page's spec cards.
func TestModelsDevCatalogIndexLookupTiers(t *testing.T) {
	index := NewModelsDevCatalogIndex(map[string]modelsDevProvider{
		"openai": {Models: map[string]modelsDevModel{
			"gpt-4o": {
				Limit:      modelsDevLimit{Context: 128000, Output: 16384},
				Modalities: modelsDevModalities{Input: []string{"text", "image"}, Output: []string{"text"}},
				Knowledge:  "2024-06-01",
			},
		}},
		"bytedance": {Models: map[string]modelsDevModel{
			// The site calls this doubao-seedream-4-0-250828: separator style
			// differs (4.0 vs 4-0), the channel brand prefixes it, and the
			// snapshot date is appended.
			"seedream-4.0": {ReleaseDate: "2025-08-28", Limit: modelsDevLimit{Context: 4000}},
		}},
		"alibaba": {Models: map[string]modelsDevModel{
			"qwen3-vl-plus": {
				Limit:      modelsDevLimit{Context: 262144, Output: 32768},
				Modalities: modelsDevModalities{Input: []string{"pdf", "text", "image"}, Output: []string{"text"}},
			},
		}},
		// Video models publish no context/output at all; indexing them would
		// report a match while filling every card with nothing.
		"someprovider": {Models: map[string]modelsDevModel{
			"wan-v3.0-video": {},
		}},
	})

	for _, tc := range []struct {
		name     string
		siteName string
		wantCtx  int
		wantOut  int
	}{
		{name: "exact", siteName: "gpt-4o", wantCtx: 128000, wantOut: 16384},
		{name: "channel brand prefix stripped", siteName: "doubao-seedream-4-0", wantCtx: 4000},
		{name: "basename skips provider directory", siteName: "qwen3-vl-plus", wantCtx: 262144, wantOut: 32768},
		{name: "snapshot suffix tolerated", siteName: "doubao-seedream-4-0-250828", wantCtx: 4000},
	} {
		t.Run(tc.name, func(t *testing.T) {
			values, ok := index.Lookup(tc.siteName)
			require.True(t, ok, "expected %s to resolve", tc.siteName)
			require.Equal(t, tc.wantCtx, values.ContextLength)
			require.Equal(t, tc.wantOut, values.MaxOutputTokens)
		})
	}

	_, ok := index.Lookup("wan3.0-video")
	require.False(t, ok, "an all-empty upstream record must not count as a match")
}

func TestModelsDevCatalogIndexPrefersFilledDuplicate(t *testing.T) {
	// The same model is republished by many providers and most of them omit
	// limits. Whichever record happens to be traversed last used to win, which
	// made the outcome of a sync depend on map iteration order.
	index := NewModelsDevCatalogIndex(map[string]modelsDevProvider{
		"sparse": {Models: map[string]modelsDevModel{
			"claude-sonnet-4-5": {ReleaseDate: "2025-09-29"},
		}},
		"complete": {Models: map[string]modelsDevModel{
			"claude-sonnet-4-5": {
				ReleaseDate: "2025-09-29",
				Limit:       modelsDevLimit{Context: 200000, Output: 64000},
				Knowledge:   "2025-03-01",
			},
		}},
	})
	values, ok := index.Lookup("claude-sonnet-4-5")
	require.True(t, ok)
	require.Equal(t, 200000, values.ContextLength)
	require.Equal(t, 64000, values.MaxOutputTokens)
	require.Equal(t, "2025-03", values.KnowledgeCutoff)
}

func TestJoinModalitiesNormalizesAliasesAndOrder(t *testing.T) {
	// models.dev reports "pdf" where the pricing card only has a "file" bucket,
	// and the array order differs per provider. Both must be flattened or the
	// diff reports a change on every sync.
	require.Equal(t, "text,image,file", joinModalities([]string{"pdf", "Image", "text"}))
	require.Equal(t, "text,image", joinModalities([]string{"image", "text"}))
	require.Equal(t, "", joinModalities(nil))
}

func TestNormalizeCatalogDateTruncatesToYearMonth(t *testing.T) {
	require.Equal(t, "2024-06", normalizeCatalogDate("2024-06-01"))
	require.Equal(t, "2024-06", normalizeCatalogDate(" 2024-06 "))
	require.Equal(t, "2024", normalizeCatalogDate("2024"))
	require.Equal(t, "", normalizeCatalogDate("   "))
	// Unknown formats pass through so an operator can still read the value.
	require.Equal(t, "Q3 2024", normalizeCatalogDate("Q3 2024"))
}

func TestMergeCatalogMetadataKeepsCopyFieldsAndFillsSpecs(t *testing.T) {
	basellm := MetadataValues{
		Description: "curated copy", Icon: "OpenAI", Tags: "chat",
		Vendor: "OpenAI", NameRule: NameRuleExact, Status: 1,
	}
	specs := MetadataValues{
		ContextLength: 400000, MaxOutputTokens: 128000,
		KnowledgeCutoff: "2025-08", ReleaseDate: "2026-02",
		InputModalities: "text,image", OutputModalities: "text",
	}
	merged := MergeCatalogMetadata(basellm, specs)

	// Copy fields belong to basellm and must survive untouched; a spec source
	// that also carries descriptions may never overwrite curated copy.
	require.Equal(t, "curated copy", merged.Description)
	require.Equal(t, NameRuleExact, merged.NameRule)
	require.Equal(t, 1, merged.Status)
	require.Equal(t, 400000, merged.ContextLength)
	require.Equal(t, "2025-08", merged.KnowledgeCutoff)

	// A local value already present wins over the supplement.
	merged.ContextLength = 200000
	again := MergeCatalogMetadata(merged, specs)
	require.Equal(t, 200000, again.ContextLength)
}

func TestSplitCatalogModalitiesRoundTripsStoredForm(t *testing.T) {
	// The column stores a comma string because the diff compares field values
	// with ==; the response exposes an array for the pricing card.
	require.Equal(t, []string{"text", "image"}, splitCatalogModalities("text,image"))
	require.Nil(t, splitCatalogModalities(""))
	require.Nil(t, splitCatalogModalities(" , "))
}
