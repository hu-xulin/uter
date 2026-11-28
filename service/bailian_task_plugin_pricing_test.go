package service

import (
	"context"
	"os"
	"regexp"
	"sort"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting/operation_setting"
)

func TestBailianTaskPluginModelListMatchesPluginDeclaration(t *testing.T) {
	raw, err := os.ReadFile("../plugins/tasks/alibaba/plugin.js")
	require.NoError(t, err)

	literalBlock := regexp.MustCompile(`(?s)export const meta = \{.*?models:\s*\[(.*?)\]`).FindSubmatch(raw)
	require.NotNil(t, literalBlock, "plugin meta.models block is missing")
	snapshotBlock := regexp.MustCompile(`(?s)const IMAGE_MODEL_SNAPSHOTS = \[(.*?)\]`).FindSubmatch(raw)
	require.NotNil(t, snapshotBlock, "IMAGE_MODEL_SNAPSHOTS block is missing")

	namePattern := regexp.MustCompile(`"([^"]+)"`)
	want := make(map[string]bool)
	for _, match := range append(namePattern.FindAllSubmatch(literalBlock[1], -1), namePattern.FindAllSubmatch(snapshotBlock[1], -1)...) {
		want[string(match[1])] = true
	}
	require.Len(t, want, 62)

	got := make(map[string]bool, len(bailianTaskPluginModels))
	for name := range bailianTaskPluginModels {
		got[name] = true
	}
	assert.Equal(t, want, got, "service price allowlist drifted from the Alibaba task plugin")
}

func TestAugmentBailianCatalogWithTaskPluginModels(t *testing.T) {
	catalog := &BailianCatalog{
		Models: []BailianModel{
			{Model: "wan2.6-t2v", Prices: []BailianPriceRange{{
				RangeName: "Default",
				Prices:    []BailianPrice{{Type: "720P_batch", Price: "0.6", PriceUnit: "每秒"}},
			}}},
		},
	}
	augmentBailianCatalogWithTaskPluginModels(catalog)

	byName := make(map[string]BailianModel)
	for _, item := range catalog.Models {
		byName[item.Model] = item
	}
	require.Contains(t, byName, "wan2.6-t2v-us")
	assert.Equal(t, "wan2.6-t2v", byName["wan2.6-t2v-us"].ModelAlias)
	require.Len(t, byName["wan2.6-t2v-us"].Prices, 1)
	assert.NotContains(t, byName, "qwen-image-plus-2026-01-09", "unknown price source must not be invented")
}

func TestApplyBailianOfficialPricingPageClearsUnpublishedTaskPluginCatalogPrices(t *testing.T) {
	withBailianPricingMarkdownServer(t)
	catalog := &BailianCatalog{
		Region: BailianRegionBeijing,
		Models: []BailianModel{
			{Model: "deepseek-v4.1-flash-1017", Prices: []BailianPriceRange{{
				RangeName: "Default",
				Prices:    []BailianPrice{{Type: "input_token", Price: "999", PriceUnit: "每百万tokens"}},
			}}},
			{Model: "wan2.6-t2v", Prices: []BailianPriceRange{{
				RangeName: "Default",
				Prices: []BailianPrice{{
					Type: "720P_batch", Price: "0.6", PriceUnit: "每秒", PriceName: "视频生成（720P Batch Chat）",
				}},
			}}},
			{Model: "happyhorse-1.1-t2v", Prices: []BailianPriceRange{{
				RangeName: "Default",
				Prices:    []BailianPrice{{Type: "720P", Price: "99", PriceUnit: "每秒"}},
			}}},
		},
	}

	require.NoError(t, ApplyBailianOfficialPricingPage(context.Background(), catalog))

	byName := make(map[string]BailianModel)
	for _, item := range catalog.Models {
		byName[item.Model] = item
	}
	require.Contains(t, byName, "deepseek-v4.1-flash-1017")
	assert.Equal(t, bailianOfficialPricingPageURL, byName["deepseek-v4.1-flash-1017"].Prices[0].Prices[0].Source)

	require.Contains(t, byName, "wan2.6-t2v")
	assert.Empty(t, byName["wan2.6-t2v"].Prices, "unpublished task-plugin quotes must not become a second price source")

	require.Contains(t, byName, "happyhorse-1.1-t2v")
	require.NotEmpty(t, byName["happyhorse-1.1-t2v"].Prices, "published task-plugin prices must come from the official page")
	assert.Equal(t, bailianOfficialPricingPageURL, byName["happyhorse-1.1-t2v"].Prices[0].Prices[0].Source)
	assert.Equal(t, "0.45", byName["happyhorse-1.1-t2v"].Prices[0].Prices[0].Price)
}

func TestBailianPricingRecordsFlagMissingTaskPluginModels(t *testing.T) {
	catalog := &BailianCatalog{ChannelID: 1, Region: BailianRegionBeijing}
	records := BailianPricingRecords(catalog, []string{"qwen-image"})
	require.Len(t, records, 1, "callable plugin models must not disappear silently")

	var view model.ChannelOfficialPricing
	require.NoError(t, common.UnmarshalJsonStr(records[0].NormalizedPricing, &view))
	assert.True(t, view.NeedsReview)
	assert.Contains(t, view.ReviewReasons, "catalog lists no price")
	assert.Empty(t, bailianInternalPricing(view), "no authoritative source must not create a sale price")
}

func TestBailianTaskPluginBatchTiersAreExecutable(t *testing.T) {
	previous := operation_setting.USDExchangeRate
	operation_setting.USDExchangeRate = 7
	t.Cleanup(func() { operation_setting.USDExchangeRate = previous })

	catalog := &BailianCatalog{
		ChannelID: 1,
		Region:    BailianRegionBeijing,
		Models: []BailianModel{{
			Model: "wan2.6-t2v",
			Prices: []BailianPriceRange{{
				RangeName: "Default",
				Prices: []BailianPrice{
					{Type: "720P_batch", Price: "0.6", PriceUnit: "每秒", PriceName: "视频生成（720P Batch Chat）"},
					{Type: "1080P_batch", Price: "1", PriceUnit: "每秒", PriceName: "视频生成（1080P Batch Chat）"},
				},
			}},
		}},
	}

	records := BailianPricingRecords(catalog, []string{"wan2.6-t2v"})
	require.Len(t, records, 1)
	var view model.ChannelOfficialPricing
	require.NoError(t, common.UnmarshalJsonStr(records[0].NormalizedPricing, &view))
	assert.False(t, view.NeedsReview, "executable task tiers must not stay in review: %s", sortedStrings(view.ReviewReasons))

	encoded := bailianInternalPricing(view)
	require.NotEmpty(t, encoded, "executable task tiers must produce a sale price")
	var internal model.ChannelInternalPricing
	require.NoError(t, common.UnmarshalJsonStr(encoded, &internal))
	assert.Contains(t, internal.BillingExpr, `u("resolution")`)
	assert.Contains(t, internal.BillingExpr, `u("seconds")`)
}

func sortedStrings(values []string) string {
	copied := append([]string(nil), values...)
	sort.Strings(copied)
	return strings.Join(copied, ", ")
}
