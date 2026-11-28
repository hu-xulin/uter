package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func baselineEntry(name string, ratio float64) ModelPricingEntry {
	return ModelPricingEntry{
		ModelName: name,
		ModelPricingDescription: ModelPricingDescription{
			Effective: PricingValues{"ModelRatio": ratio},
		},
	}
}

func TestBuildBaselineAliasConflictsExportsStructuredCandidates(t *testing.T) {
	conflicts := BuildBaselineAliasConflicts([]ModelPricingEntry{
		baselineEntry("DeepSeek-V4-1-Flash-fast", 0.125),
		baselineEntry("DeepSeek-V4-1-Flash-Fast", 0.3),
		baselineEntry("stable-model", 1),
	})
	require.Len(t, conflicts, 1, "only the disagreeing normalized alias group is a conflict")
	require.Equal(t, "deepseek:v4:1:flash:fast", conflicts[0].NormalizedName)
	require.Len(t, conflicts[0].Candidates, 2)
	names := map[string]float64{}
	for _, candidate := range conflicts[0].Candidates {
		names[candidate.ModelName] = candidate.Input
	}
	require.InDelta(t, 0.25, names["DeepSeek-V4-1-Flash-fast"], 1e-9)
	require.InDelta(t, 0.6, names["DeepSeek-V4-1-Flash-Fast"], 1e-9)
}

func TestBuildBaselineWithAliasResolutionPrefersExactThenWhitelist(t *testing.T) {
	entries := []ModelPricingEntry{
		baselineEntry("DeepSeek-V4-1-Flash-fast", 0.125),
		baselineEntry("DeepSeek-V4-1-Flash-Fast", 0.3),
	}

	// Without a resolution the conflicting group stays out of the baseline.
	baseline, conflicts, restored := BuildBaselineWithAliasResolution(entries, nil)
	require.Empty(t, baseline)
	require.Len(t, conflicts, 1)
	require.Len(t, restored, 1, "the skip itself must be auditable")
	require.Equal(t, "skipped", restored[0].Resolution)

	// A whitelist entry naming an exact model ID recovers the group.
	baseline, _, restored = BuildBaselineWithAliasResolution(entries, map[string]string{
		"deepseek:v4:1:flash:fast": "DeepSeek-V4-1-Flash-Fast",
	})
	require.Len(t, restored, 1)
	require.Equal(t, "whitelist", restored[0].Resolution)
	row, ok := baseline["deepseek:v4:1:flash:fast"]
	require.True(t, ok)
	require.InDelta(t, 0.6, row.Input, 1e-9)
}

func TestBuildBaselineWithAliasResolutionSkipsUnknownWhitelist(t *testing.T) {
	entries := []ModelPricingEntry{
		baselineEntry("Model-A", 1),
		baselineEntry("model-a", 2),
	}
	baseline, conflicts, restored := BuildBaselineWithAliasResolution(entries, map[string]string{
		"model:a": "not-a-real-entry",
	})
	require.Empty(t, baseline, "an unresolved whitelist entry must stay fail-closed")
	require.Len(t, conflicts, 1)
	require.Len(t, restored, 1)
	require.Equal(t, "skipped", restored[0].Resolution)
}
