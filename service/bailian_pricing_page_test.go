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
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const bailianPricingPageTestContent = `
<div>
  <h4>华北 2（北京）</h4>
  <table>
    <thead>
      <tr>
        <th>模型 ID（Model ID）</th>
        <th>模式</th>
        <th>单次请求的输入Token数</th>
        <th>输入单价（每百万Token）</th>
        <th>输出单价（每百万Token）</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><p>deepseek-v4.1-flash-1017</p><blockquote><p>上下文缓存享有折扣</p></blockquote></td>
        <td>非思考和思考模式</td>
        <td>不区分阶梯</td>
        <td><p>忙时 2元</p><p>闲时 1元</p></td>
        <td><p>忙时 8元</p><p>闲时 4元</p></td>
      </tr>
      <tr>
        <td><p>glm-5.3</p></td>
        <td>非思考和思考模式</td>
        <td>0&lt;Token≤1M</td>
        <td><p>8元</p></td>
        <td><p>28元</p></td>
      </tr>
    </tbody>
  </table>
</div>`

func withBailianPricingPageServer(t *testing.T) {
	t.Helper()
	content, err := json.Marshal(map[string]any{
		"docDetailData": map[string]any{
			"storeData": map[string]any{
				"data": map[string]any{"content": bailianPricingPageTestContent},
			},
		},
	})
	require.NoError(t, err)
	body := `<html><script>window.__ICE_PAGE_PROPS__=` + string(content) + `;</script></html>`
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(body))
	}))
	previous := bailianOfficialPricingPageURLForTest
	bailianOfficialPricingPageURLForTest = server.URL
	t.Cleanup(func() {
		bailianOfficialPricingPageURLForTest = previous
		server.Close()
	})
}

func TestFetchBailianOfficialPricingPageFromHelpPage(t *testing.T) {
	withBailianPricingPageServer(t)

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
	withBailianPricingPageServer(t)
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
