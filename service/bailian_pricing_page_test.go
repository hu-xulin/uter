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
package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting/operation_setting"
)

const bailianPricingPageMarkdownTestContent = `
<Tabs>
  <Tab title="华北2（北京）">
    <table style={{ display: "table" }}>
      <thead>
        <tr>
          <th>模型 ID（Model ID）</th>
          <th>单次请求的输入Token数</th>
          <th>输入单价（每百万Token）</th>
          <th>输出单价（每百万Token）</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>deepseek-v4.1-flash-1017 上下文缓存享有折扣</td>
          <td>不区分阶梯</td>
          <td>忙时 2元闲时 1元</td>
          <td>忙时 8元闲时 4元</td>
        </tr>
        <tr>
          <td>glm-5.3</td>
          <td>0\<Token≤1M</td>
          <td>8元</td>
          <td>28元</td>
        </tr>
        <tr>
          <td>qwen-plus-2026-01-01 上下文缓存享有折扣</td>
          <td>不区分阶梯</td>
          <td>2元</td>
          <td>8元</td>
        </tr>
      </tbody>
    </table>
    <table>
      <thead>
        <tr>
          <th>模型 ID（Model ID）</th>
          <th>输出视频分辨率</th>
          <th>输出单价</th>
          <th>免费额度</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td rowSpan={3}>happyhorse-1.1-t2v</td>
          <td>480P</td>
          <td>0.45元/秒</td>
          <td>10秒</td>
        </tr>
        <tr>
          <td>720P</td>
          <td>0.9元/秒</td>
        </tr>
        <tr>
          <td>1080P</td>
          <td>1.2元/秒</td>
        </tr>
      </tbody>
    </table>
  </Tab>
</Tabs>`

func withBailianPricingMarkdownServer(t *testing.T) {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
		_, _ = w.Write([]byte(bailianPricingPageMarkdownTestContent))
	}))
	previousMarkdown := bailianOfficialPricingMarkdownURLForTest
	previousMin := bailianMarkdownMinModelCount
	resetBailianOfficialPricingPageCache()
	bailianOfficialPricingMarkdownURLForTest = server.URL + "/pricing.md"
	bailianMarkdownMinModelCount = 1
	t.Cleanup(func() {
		bailianOfficialPricingMarkdownURLForTest = previousMarkdown
		bailianMarkdownMinModelCount = previousMin
		resetBailianOfficialPricingPageCache()
		server.Close()
	})
}

func TestNormalizeBailianPageModelFromMixedCell(t *testing.T) {
	assert.Equal(t, "qwen4-max", normalizeBailianPageModel("qwen4-max Batch调用半价 上下文缓存享有折扣"))
	assert.Equal(t, "pixverse/pixverse-v6-max-t2v", normalizeBailianPageModel("pixverse/pixverse-v6-max-t2v 原价0.27元/秒"))
	assert.Equal(t, "ZHIPU/GLM-5.3", normalizeBailianPageModel("ZHIPU/GLM-5.3"))
	assert.Empty(t, normalizeBailianPageModel("非思考和思考模式"))
}

func TestParseBailianPagePriceCellInlineTimeBands(t *testing.T) {
	values := parseBailianPagePriceCell("忙时 2元闲时 1元")
	assert.Equal(t, "2", values["peak"])
	assert.Equal(t, "1", values["offpeak"])
	assert.Empty(t, parseBailianPagePriceCell("限时免费"))
}

func TestFetchBailianOfficialPricingPageFromMarkdown(t *testing.T) {
	withBailianPricingMarkdownServer(t)

	page, err := FetchBailianOfficialPricingPage(context.Background())
	require.NoError(t, err)
	require.NotEmpty(t, page.prices[BailianRegionBeijing])
	assert.Equal(t, bailianOfficialPricingMarkdownURLForTest, page.sourceURL)
	assert.NotEmpty(t, page.contentHash)

	versioned := page.prices[BailianRegionBeijing]["qwen-plus-2026-01-01"]
	require.Len(t, versioned, 1)
	byType := make(map[string]string)
	for _, price := range versioned[0].Prices {
		byType[price.Type] = price.Price
		assert.Equal(t, bailianOfficialPricingPageURL, price.Source)
	}
	assert.Equal(t, "2", byType["input_token"])
	assert.Equal(t, "8", byType["output_token"])

	// A dated official row must also resolve the family alias used by the
	// workspace model list.
	assert.NotEmpty(t, page.prices[BailianRegionBeijing]["qwen-plus"])

	video := page.prices[BailianRegionBeijing]["happyhorse-1.1-t2v"]
	videoPrices := make(map[string]string)
	for _, priceRange := range video {
		for _, price := range priceRange.Prices {
			videoPrices[price.Type] = price.Price
			assert.Equal(t, "每秒", price.PriceUnit)
		}
	}
	assert.Equal(t, "0.45", videoPrices["video_ratio_480p"])
	assert.Equal(t, "0.9", videoPrices["video_ratio_720p"])
	assert.Equal(t, "1.2", videoPrices["video_ratio_1080p"])
}

func TestFetchBailianOfficialPricingPageTimeBandsAndRanges(t *testing.T) {
	withBailianPricingMarkdownServer(t)

	page, err := FetchBailianOfficialPricingPage(context.Background())
	require.NoError(t, err)
	ranges := page.prices[BailianRegionBeijing]["deepseek-v4.1-flash-1017"]
	require.Len(t, ranges, 1)
	assert.Equal(t, "Default", ranges[0].RangeName)

	byKey := make(map[string]string)
	for _, price := range ranges[0].Prices {
		byKey[price.Type+"\x00"+price.TimeBand] = price.Price
		assert.Equal(t, bailianOfficialPricingPageURL, price.Source)
	}
	assert.Equal(t, "2", byKey["input_token\x00peak"])
	assert.Equal(t, "8", byKey["output_token\x00peak"])
	assert.Equal(t, "1", byKey["input_token\x00offpeak"])
	assert.Equal(t, "4", byKey["output_token\x00offpeak"])

	tiered := page.prices[BailianRegionBeijing]["glm-5.3"]
	require.Len(t, tiered, 1)
	assert.Equal(t, "0<Token≤1M", tiered[0].RangeName)
	require.Len(t, tiered[0].Prices, 2)
}

func TestBailianPricingPagePricesFollowModelFamilySemantics(t *testing.T) {
	prices := []BailianPriceRange{{
		RangeName: "Default",
		Prices: []BailianPrice{
			{
				Type: "input_token", Price: "2", PriceUnit: "每百万tokens",
				PriceName: "model studio help-center price", TimeBand: "standard",
				Currency: "CNY", Source: bailianOfficialPricingPageURL,
			},
			{
				Type: "output_token", Price: "8", PriceUnit: "每百万tokens",
				PriceName: "model studio help-center price", TimeBand: "standard",
				Currency: "CNY", Source: bailianOfficialPricingPageURL,
			},
		},
	}}

	alibaba := bailianOfficialPricing(
		BailianModel{Model: "qwen-plus", Prices: prices}, BailianRegionBeijing, 7, 1,
	)
	assert.Equal(t, "OFFICIAL_LIST", alibaba.PriceKind)
	require.Len(t, alibaba.Tiers, 1)
	assert.Empty(t, alibaba.ChannelPriceTiers)

	thirdParty := bailianOfficialPricing(
		BailianModel{Model: "deepseek-v4-flash-0731", Prices: prices}, BailianRegionBeijing, 7, 1,
	)
	assert.Equal(t, "CHANNEL_QUOTE", thirdParty.PriceKind)
	require.Len(t, thirdParty.ChannelPriceTiers, 1)
	assert.Empty(t, thirdParty.Tiers)
}

func TestBailianPricingRecordsKeepOfficialPageSource(t *testing.T) {
	item := BailianModel{
		Model: "official-page-model",
		Prices: []BailianPriceRange{{
			RangeName: "Default",
			Prices: []BailianPrice{
				{Type: "input_token", Price: "2", PriceUnit: "每百万tokens", Source: bailianOfficialPricingPageURL},
				{Type: "output_token", Price: "8", PriceUnit: "每百万tokens", Source: bailianOfficialPricingPageURL},
			},
		}},
	}
	view := bailianOfficialPricing(item, BailianRegionBeijing, 7, 1)
	assert.Equal(t, bailianOfficialPricingPageURL, view.Source)
}

func TestApplyBailianOfficialPricingPageReplacesCatalogQuote(t *testing.T) {
	withBailianPricingMarkdownServer(t)
	catalog := &BailianCatalog{
		Region: BailianRegionBeijing,
		Models: []BailianModel{{
			Model: "deepseek-v4.1-flash-1017",
			Prices: []BailianPriceRange{{
				RangeName: "Default",
				Prices: []BailianPrice{{
					Type: "input_token", Price: "999", PriceUnit: "每百万tokens",
					Source: bailianCatalogSource,
				}},
			}},
		}},
	}

	require.NoError(t, ApplyBailianOfficialPricingPage(context.Background(), catalog))
	assert.Equal(t, bailianOfficialPricingPageURL, catalog.OfficialPricingSource)
	require.Len(t, catalog.Models[0].Prices, 1)
	for _, price := range catalog.Models[0].Prices[0].Prices {
		assert.Equal(t, bailianOfficialPricingPageURL, price.Source)
		assert.NotEqual(t, "999", price.Price)
	}
}

func TestApplyBailianOfficialPricingPageMatchesVersionAlias(t *testing.T) {
	withBailianPricingMarkdownServer(t)
	catalog := &BailianCatalog{
		Region: BailianRegionBeijing,
		Models: []BailianModel{{
			Model: "qwen-plus",
			Prices: []BailianPriceRange{{
				RangeName: "Default",
				Prices: []BailianPrice{{
					Type: "input_token", Price: "999", PriceUnit: "每百万tokens",
					Source: bailianCatalogSource,
				}},
			}},
		}},
	}

	require.NoError(t, ApplyBailianOfficialPricingPage(context.Background(), catalog))
	require.Len(t, catalog.Models[0].Prices, 1)
	byType := make(map[string]string)
	for _, price := range catalog.Models[0].Prices[0].Prices {
		byType[price.Type] = price.Price
		assert.Equal(t, bailianOfficialPricingPageURL, price.Source)
	}
	assert.Equal(t, "2", byType["input_token"])
	assert.Equal(t, "8", byType["output_token"])
}

func TestFetchBailianOfficialPricingPageUsesShortLivedCache(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requests++
		w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
		_, _ = w.Write([]byte(bailianPricingPageMarkdownTestContent))
	}))
	previousMarkdown := bailianOfficialPricingMarkdownURLForTest
	previousMin := bailianMarkdownMinModelCount
	resetBailianOfficialPricingPageCache()
	bailianOfficialPricingMarkdownURLForTest = server.URL + "/pricing.md"
	bailianMarkdownMinModelCount = 1
	t.Cleanup(func() {
		bailianOfficialPricingMarkdownURLForTest = previousMarkdown
		bailianMarkdownMinModelCount = previousMin
		resetBailianOfficialPricingPageCache()
		server.Close()
	})

	first, err := FetchBailianOfficialPricingPage(context.Background())
	require.NoError(t, err)
	second, err := FetchBailianOfficialPricingPage(context.Background())
	require.NoError(t, err)

	assert.Equal(t, 1, requests)
	assert.Equal(t, first.contentHash, second.contentHash)
}

func TestBailianOfficialPricingFamilyUsesCatalogProvider(t *testing.T) {
	prices := []BailianPriceRange{{RangeName: "Default", Prices: []BailianPrice{
		{Type: "input_token", Price: "1", PriceUnit: "每百万tokens", Currency: "CNY"},
		{Type: "output_token", Price: "2", PriceUnit: "每百万tokens", Currency: "CNY"},
	}}}

	happyhorse := bailianOfficialPricing(
		BailianModel{Model: "happyhorse-1.1-t2v", Provider: "happyhorse", Prices: prices},
		BailianRegionBeijing, 7, 1,
	)
	assert.Equal(t, "OFFICIAL_LIST", happyhorse.PriceKind)

	thirdParty := bailianOfficialPricing(
		BailianModel{Model: "qwen-lookalike", Provider: "deepseek", Prices: prices},
		BailianRegionBeijing, 7, 1,
	)
	assert.Equal(t, "CHANNEL_QUOTE", thirdParty.PriceKind)

	legacy := bailianOfficialPricing(
		BailianModel{Model: "qwen-plus", Prices: prices},
		BailianRegionBeijing, 7, 1,
	)
	assert.Equal(t, "OFFICIAL_LIST", legacy.PriceKind)
}

func TestParseBailianMarkdownDoesNotLeakRegionOrDuplicateRows(t *testing.T) {
	markdown := `
<Tabs>
  <Tab title="华北2（北京）">
    <table>
      <thead><tr><th>模型 ID（Model ID）</th><th>输入单价（每百万Token）</th></tr></thead>
      <tbody>
        <tr><td>dup-model</td><td>2元</td></tr>
        <tr><td>dup-model</td><td>2元</td></tr>
      </tbody>
    </table>
  </Tab>
</Tabs>
<table>
  <thead><tr><th>模型 ID（Model ID）</th><th>输入单价（每百万Token）</th></tr></thead>
  <tbody><tr><td>orphan-model</td><td>3元</td></tr></tbody>
</table>`

	prices, err := parseBailianPricingMarkdown(markdown)
	require.NoError(t, err)
	require.Len(t, prices[BailianRegionBeijing]["dup-model"], 1)
	assert.Empty(t, prices[BailianRegionUnspecified]["orphan-model"])
}

// A second price feed must never top up the authoritative help-center page.
// If a HappyHorse rate is not published there, the row stays review-only.
func TestApplyBailianOfficialPricingPageDoesNotInjectUnpublishedHappyhorseRates(t *testing.T) {
	const markdown = `
<Tabs>
  <Tab title="华北2（北京）">
    <table>
      <thead><tr><th>模型 ID（Model ID）</th><th>输入单价（每百万Token）</th><th>输出单价（每百万Token）</th></tr></thead>
      <tbody><tr><td>qwen-plus</td><td>2元</td><td>8元</td></tr></tbody>
    </table>
  </Tab>
</Tabs>`
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
		_, _ = w.Write([]byte(markdown))
	}))
	previousURL := bailianOfficialPricingMarkdownURLForTest
	previousMin := bailianMarkdownMinModelCount
	resetBailianOfficialPricingPageCache()
	bailianOfficialPricingMarkdownURLForTest = server.URL + "/pricing.md"
	bailianMarkdownMinModelCount = 1
	t.Cleanup(func() {
		bailianOfficialPricingMarkdownURLForTest = previousURL
		bailianMarkdownMinModelCount = previousMin
		resetBailianOfficialPricingPageCache()
		server.Close()
	})

	catalog := &BailianCatalog{
		Region: BailianRegionBeijing,
		Models: []BailianModel{
			{Model: "qwen-plus"},
			{Model: "happyhorse-1.1-t2v"},
			{Model: "happyhorse-1.0-t2v"},
		},
	}
	require.NoError(t, ApplyBailianOfficialPricingPage(context.Background(), catalog))

	byName := make(map[string]BailianModel, len(catalog.Models))
	for _, item := range catalog.Models {
		byName[item.Model] = item
	}
	assert.Empty(t, byName["happyhorse-1.1-t2v"].Prices, "unpublished HappyHorse rates must stay review-only")
	assert.Empty(t, byName["happyhorse-1.0-t2v"].Prices, "unpublished HappyHorse variants stay review-only")
	require.NotEmpty(t, byName["qwen-plus"].Prices)
	assert.Equal(t, bailianOfficialPricingPageURL, byName["qwen-plus"].Prices[0].Prices[0].Source)
}

// End-to-end pricing chain shared by channel create and edit: the official
// page publishes HappyHorse per-second rates, ApplyBailianOfficialPricingPage
// must attach them to the catalog, normalization must keep them billable, and
// BailianPricingRecords must emit a non-review row with a sale expression.
// Production DB rows previously went review-only under the old parser; this
// test locks in that a fresh sync produces a chargeable price.
func TestBailianOfficialPageToBillablePriceEndToEnd(t *testing.T) {
	withBailianPricingMarkdownServer(t)
	previous := operation_setting.USDExchangeRate
	operation_setting.USDExchangeRate = 7
	t.Cleanup(func() { operation_setting.USDExchangeRate = previous })

	catalog := &BailianCatalog{
		ChannelID: 42,
		Region:    BailianRegionBeijing,
		Models:    []BailianModel{{Model: "happyhorse-1.1-t2v"}},
	}
	require.NoError(t, ApplyBailianOfficialPricingPage(context.Background(), catalog))
	require.NotEmpty(t, catalog.Models[0].Prices, "official page must publish HappyHorse rates")

	refs := NormalizeBailianPrices(catalog)
	require.NotEmpty(t, refs)

	records := BailianPricingRecords(catalog, []string{"happyhorse-1.1-t2v"})
	require.Len(t, records, 1)
	var view model.ChannelOfficialPricing
	require.NoError(t, common.UnmarshalJsonStr(records[0].NormalizedPricing, &view))
	assert.False(t, view.NeedsReview, "fresh sync must clear review: %s", sortedStrings(view.ReviewReasons))

	encoded := bailianInternalPricing(view)
	require.NotEmpty(t, encoded, "fresh sync must produce a sale price")
	var internal model.ChannelInternalPricing
	require.NoError(t, common.UnmarshalJsonStr(encoded, &internal))
	require.NotEmpty(t, internal.BillingExpr)
}
