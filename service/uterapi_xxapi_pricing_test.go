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
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

// 正式回归夹具：2026-11-25 从 xxapi.ai /api/pricing 抓取的完整文档。
// 测试不访问外网，使用与创建渠道、价格预览同一套解析和折扣代码。
func loadXXAPIPricingFixture(t *testing.T) ([]byte, *GenericPricingPayload) {
	t.Helper()
	raw, err := os.ReadFile("testdata/xxapi-pricing-snapshot-20261125.json")
	require.NoError(t, err)
	var payload GenericPricingPayload
	require.NoError(t, common.Unmarshal(raw, &payload))
	return raw, &payload
}

func decodeXXAPIOfficial(t *testing.T, record model.ChannelOfficialPricingRecord) model.ChannelOfficialPricing {
	t.Helper()
	var official model.ChannelOfficialPricing
	require.NoError(t, common.UnmarshalJsonStr(record.NormalizedPricing, &official))
	return official
}

func findXXAPIRecord(t *testing.T, records []model.ChannelOfficialPricingRecord, name string) model.ChannelOfficialPricingRecord {
	t.Helper()
	for _, record := range records {
		if record.ModelName == name {
			return record
		}
	}
	t.Fatalf("pricing record %q not found", name)
	return model.ChannelOfficialPricingRecord{}
}

// 49 个上游表达式必须全部可编译，且都能解析出官方 tier 与上游报价 tier。
// 官方 tier 是定价广场读取的契约；报价 tier 是渠道页上游报价的来源。
func TestXXAPISnapshotExpressionsProduceOfficialAndChannelTiers(t *testing.T) {
	_, payload := loadXXAPIPricingFixture(t)
	require.Len(t, payload.Data, 49)

	records := GenericChannelPricingRecords(
		0, GenericModelNames(payload.Data), payload.Data,
		time.Unix(1_763_900_000, 0), "uterapi",
	)
	require.Len(t, records, 49)

	tokenModels, imageModels := 0, 0
	for _, record := range records {
		official := decodeXXAPIOfficial(t, record)
		require.Equal(t, UpstreamExpressionExecutable, official.ExpressionStatus, record.ModelName)
		require.False(t, official.NeedsReview, record.ModelName)
		require.Len(t, official.Tiers, 1, "%s: official tier must be available", record.ModelName)
		require.NotNil(t, official.ChannelPrice, "%s: upstream quote must be available", record.ModelName)

		switch official.Tiers[0].Unit {
		case "per_1m_token":
			tokenModels++
			require.NotNil(t, official.Tiers[0].InputPerMillionUSD, record.ModelName)
			require.NotNil(t, official.ChannelPrice.InputPerMillionUSD, record.ModelName)
		case "per_image":
			imageModels++
			require.NotNil(t, official.Tiers[0].PerUnitUSD, record.ModelName)
			require.NotNil(t, official.ChannelPrice.PerUnitUSD, record.ModelName)
		default:
			t.Fatalf("%s: unexpected price unit %q", record.ModelName, official.Tiers[0].Unit)
		}
	}
	require.Equal(t, 34, tokenModels)
	require.Equal(t, 15, imageModels)
}

// 分组倍率只折后上游报价，不能改官方价；图片模型同口径按每张折算。
func TestXXAPIPricePreviewAppliesGroupRatioToOfficialAndImagePrices(t *testing.T) {
	raw, _ := loadXXAPIPricingFixture(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/pricing" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(raw)
	}))
	t.Cleanup(server.Close)

	previousOptions := common.OptionMap
	common.OptionMap = map[string]string{UterAPIUpstreamURLOption: server.URL}
	t.Cleanup(func() { common.OptionMap = previousOptions })

	ctx := context.Background()
	codex, err := PreviewUterAPIPriceCatalog(ctx, "Codex Pro")
	require.NoError(t, err)
	require.Len(t, codex.Records, 9)
	require.InDelta(t, 0.4, codex.Ratio, 1e-12)

	token := decodeXXAPIOfficial(t, findXXAPIRecord(t, codex.Records, "gpt-6.2-sol"))
	require.Len(t, token.Tiers, 1)
	require.Equal(t, "per_1m_token", token.Tiers[0].Unit)
	require.InDelta(t, 2, token.Tiers[0].InputPerMillionUSD.Float64(), 1e-12)
	require.InDelta(t, 10, token.Tiers[0].OutputPerMillionUSD.Float64(), 1e-12)
	require.InDelta(t, 0.1, token.Tiers[0].CachePerMillionUSD.Float64(), 1e-12)
	require.InDelta(t, 2.5, token.Tiers[0].CreateCachePerMillionUSD.Float64(), 1e-12)
	require.NotNil(t, token.ChannelPrice)
	require.InDelta(t, 0.8, token.ChannelPrice.InputPerMillionUSD.Float64(), 1e-12)
	require.InDelta(t, 4, token.ChannelPrice.OutputPerMillionUSD.Float64(), 1e-12)
	require.InDelta(t, 0.04, token.ChannelPrice.CachePerMillionUSD.Float64(), 1e-12)
	require.InDelta(t, 1, token.ChannelPrice.CreateCachePerMillionUSD.Float64(), 1e-12)
	require.Equal(t, "Codex Pro", token.DiscountGroup)
	require.NotNil(t, token.DiscountRatio)
	require.InDelta(t, 0.4, *token.DiscountRatio, 1e-12)

	images, err := PreviewUterAPIPriceCatalog(ctx, "image 4K 图像")
	require.NoError(t, err)
	require.Len(t, images.Records, 8)
	require.InDelta(t, 7, images.Ratio, 1e-12)

	image := decodeXXAPIOfficial(t, findXXAPIRecord(t, images.Records, "gpt-image-2.5-flare-1k"))
	require.Len(t, image.Tiers, 1)
	require.Equal(t, "per_image", image.Tiers[0].Unit)
	require.InDelta(t, 0.05, image.Tiers[0].PerUnitUSD.Float64(), 1e-12)
	require.NotNil(t, image.ChannelPrice)
	require.Equal(t, "per_image", image.ChannelPrice.Unit)
	require.InDelta(t, 0.35, image.ChannelPrice.PerUnitUSD.Float64(), 1e-12)
	require.Equal(t, "image 4K 图像", image.DiscountGroup)
	require.NotNil(t, image.DiscountRatio)
	require.InDelta(t, 7, *image.DiscountRatio, 1e-12)
}

// 无法确认的单价形态必须保持空价，不能把 unknown 变量当成可计价项。
func TestXXAPIUnknownPriceShapeStaysUnpriced(t *testing.T) {
	tier, ok := upstreamExpressionTier(`tier("base", mystery_price * 0.05) * image_count`, 1, "base")
	require.False(t, ok)
	require.Nil(t, tier.PerUnitUSD)
}
