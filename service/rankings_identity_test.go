package service

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/model"
)

func TestResolveRankingModelIdentity(t *testing.T) {
	tests := []struct {
		name       string
		modelName  string
		wantVendor string
		wantIcon   string
	}{
		{
			name:       "gpt keyword maps to OpenAI product logo",
			modelName:  "groq-gpt-oss-120b",
			wantVendor: "OpenAI",
			wantIcon:   "OpenAI.Mono",
		},
		{
			name:       "qwen keyword maps to Qwen product logo",
			modelName:  "sf-qwen3-8b",
			wantVendor: "Qwen",
			wantIcon:   "Qwen.Color",
		},
		{
			name:       "un recognised model falls back to Uter",
			modelName:  "internal-router-model",
			wantVendor: "Uter",
			wantIcon:   "Uter.Color",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			vendor, icon := resolveRankingModelIdentity(test.modelName)
			require.Equal(t, test.wantVendor, vendor)
			require.Equal(t, test.wantIcon, icon)
		})
	}
}

func TestModelMetaFallsBackToKeywordIdentity(t *testing.T) {
	meta := modelMeta("sf-qwen3-8b", nil)

	require.Equal(t, "Qwen", meta.vendor)
	require.Equal(t, "Qwen.Color", meta.modelIcon)
}

func TestBuildRankedModelsCarriesModelProductIcon(t *testing.T) {
	meta := map[string]rankingModelMeta{
		"groq-gpt-oss-120b": {
			vendor:     "OpenAI",
			vendorIcon: "OpenAI",
			modelIcon:  "OpenAI.Mono",
		},
	}

	rows := buildRankedModels(
		[]model.RankingQuotaTotal{{ModelName: "groq-gpt-oss-120b", TotalTokens: 100}},
		100,
		nil,
		nil,
		meta,
		false,
	)

	require.Len(t, rows, 1)
	require.Equal(t, "OpenAI", rows[0].Vendor)
	require.Equal(t, "OpenAI.Mono", rows[0].ModelIcon)
	require.Equal(t, "OpenAI", rows[0].VendorIcon)
}

func TestBuildRankedVendorsSplitsDerivedVendorsAndUsesUterFallback(t *testing.T) {
	totals := []model.RankingQuotaTotal{
		{ModelName: "groq-gpt-oss-120b", TotalTokens: 50},
		{ModelName: "sf-qwen3-8b", TotalTokens: 30},
		{ModelName: "internal-router-model", TotalTokens: 20},
	}

	rows := buildRankedVendors(totals, nil, 100, nil, false)
	names := make([]string, 0, len(rows))
	for _, row := range rows {
		names = append(names, row.Vendor)
	}

	require.ElementsMatch(t, []string{"OpenAI", "Qwen", "Uter"}, names)
	require.NotContains(t, names, rankingUnknownVendor)
}
