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
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting/operation_setting"
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
	// The upstream quotes credit dollars (¥1 buys $1). Pin the market rate so
	// the converted channel price is deterministic; official tiers must stay
	// at the published dollar figures.
	const fxRate = 6.68
	previousFX := operation_setting.USDExchangeRate
	operation_setting.USDExchangeRate = fxRate
	t.Cleanup(func() { operation_setting.USDExchangeRate = previousFX })

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
	require.InDelta(t, 0.8/fxRate, token.ChannelPrice.InputPerMillionUSD.Float64(), 1e-12)
	require.InDelta(t, 4/fxRate, token.ChannelPrice.OutputPerMillionUSD.Float64(), 1e-12)
	require.InDelta(t, 0.04/fxRate, token.ChannelPrice.CachePerMillionUSD.Float64(), 1e-12)
	require.InDelta(t, 1/fxRate, token.ChannelPrice.CreateCachePerMillionUSD.Float64(), 1e-12)
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
	require.InDelta(t, 0.35/fxRate, image.ChannelPrice.PerUnitUSD.Float64(), 1e-12)
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

// 新建向导只有只读预览价格行。预览行必须带着与落库一致的 configured 状态，
// 否则计费就绪度会把 12 个本来可计费的模型全部算作 pending。
func TestPreviewRecordToPricingRowMarksReportedClaudeModelsBillable(t *testing.T) {
	_, payload := loadXXAPIPricingFixture(t)
	names := []string{
		"claude-haiku-4-5", "claude-haiku-4-5-20251001", "claude-haiku-5-5",
		"claude-opus-4-5", "claude-opus-4-6", "claude-opus-4-7", "claude-opus-4-8",
		"claude-opus-5", "claude-opus-5-5", "claude-sonnet-4-6",
		"claude-sonnet-5", "claude-sonnet-5-5",
	}
	records := GenericChannelPricingRecords(
		0, names, payload.Data, time.Unix(1_763_900_000, 0), "uterapi",
	)
	require.Len(t, records, len(names))
	for _, record := range records {
		row := PreviewRecordToPricingRow(record)
		assert.Equal(t, model.ChannelPricingStatusConfigured, row.PricingStatus, record.ModelName)
		assert.NotEmpty(t, row.InternalPricing, record.ModelName)
	}
}

// Claude Code · 高级（稳定快速）(Claude-稳定) 与报错里的 12 个 Claude 模型走同一条
// Uter.api 同步链路。批量重定向后模型列表是别名，目录仍是原名；同步、分组倍率、
// 汇率换算和采购成本都必须在别名身份上闭环，否则会报零行可计费或成本失真。
func TestSyncUterAPIChannelPricingHighClaudeGroupResolvesRedirectAliases(t *testing.T) {
	raw, payload := loadXXAPIPricingFixture(t)
	const group = "Claude-稳定"
	const groupName = "Claude Code · 高级（稳定快速）"

	upstream := make([]string, 0)
	entriesByName := map[string]GenericPricingEntry{}
	for _, entry := range payload.Data {
		name := strings.TrimSpace(entry.ModelName)
		for _, enabled := range entry.EnableGroups {
			if strings.EqualFold(strings.TrimSpace(enabled), group) {
				upstream = append(upstream, name)
				entriesByName[name] = entry
				break
			}
		}
	}
	sort.Strings(upstream)
	require.NotEmpty(t, upstream)

	mapping := make(map[string]string, len(upstream))
	aliases := make([]string, 0, len(upstream))
	for _, name := range upstream {
		alias := name + "-dr"
		aliases = append(aliases, alias)
		mapping[alias] = name
	}
	encodedMapping, err := common.Marshal(mapping)
	require.NoError(t, err)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/api/pricing", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(raw)
	}))
	t.Cleanup(server.Close)

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.Channel{}, &model.ChannelModelPricing{}, &model.ChannelPricingHistory{}, &model.ChannelSyncState{},
		&model.Option{}, &model.BillingPriceSnapshot{}, &model.BillingCostBreakdown{}, &model.BillingFinancialLedger{},
		&model.SystemTask{}, &model.SystemTaskLock{},
	))
	previousDB := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previousDB })
	previousOptions := common.OptionMap
	common.OptionMap = map[string]string{UterAPIUpstreamURLOption: server.URL}
	t.Cleanup(func() { common.OptionMap = previousOptions })
	const fxRate = 6.68
	previousFX := operation_setting.USDExchangeRate
	operation_setting.USDExchangeRate = fxRate
	t.Cleanup(func() { operation_setting.USDExchangeRate = previousFX })

	baseURL, mappingRaw := server.URL, string(encodedMapping)
	channel := &model.Channel{
		Type:         constant.ChannelTypeUterAPI,
		Name:         "Uter.api-claude-高级",
		BaseURL:      &baseURL,
		Key:          "sk-high",
		Models:       strings.Join(aliases, ","),
		ModelMapping: &mappingRaw,
		Group:        "default",
		Status:       1,
	}
	require.NoError(t, db.Create(channel).Error)

	written, groupRatio, resolvedGroupName, err := SyncUterAPIChannelPricing(context.Background(), channel, group)
	require.NoError(t, err)
	require.Equal(t, len(aliases), written)
	require.InDelta(t, 3.5, groupRatio, 1e-12)
	require.Equal(t, groupName, resolvedGroupName)

	rows, err := model.ListChannelModelPricing(channel.Id)
	require.NoError(t, err)
	require.Len(t, rows, len(aliases))
	seen := map[string]model.ChannelModelPricing{}
	for _, row := range rows {
		seen[row.ModelName] = row
	}
	for _, alias := range aliases {
		row, ok := seen[alias]
		require.True(t, ok, "alias %s must get its own billable row", alias)
		assert.Equal(t, "uterapi", row.Provider)
		assert.Equal(t, model.ChannelPricingStatusConfigured, row.PricingStatus)
		assert.NotEmpty(t, row.InternalPricing)
	}

	entry := entriesByName[upstream[0]]
	baseTier, ok := upstreamExpressionTier(entry.BillingExpr, 1, "base")
	require.True(t, ok)
	first := seen[aliases[0]]
	var official model.ChannelOfficialPricing
	require.NoError(t, common.UnmarshalJsonStr(first.NormalizedPricing, &official))
	require.Len(t, official.Tiers, 1)
	assert.InDelta(t, baseTier.InputPerMillionUSD.Float64(), official.Tiers[0].InputPerMillionUSD.Float64(), 1e-12)
	require.NotNil(t, official.ChannelPrice)
	assert.InDelta(t, baseTier.InputPerMillionUSD.Float64()*groupRatio/fxRate,
		official.ChannelPrice.InputPerMillionUSD.Float64(), 1e-12)

	// 重定向后仍必须能按别名冻结采购合同，且成本与换算后的渠道价同口径。
	cost := model.ParseChannelPurchaseCost(first.PurchasePricing)
	require.NotNil(t, cost, "redirected alias must keep a group purchase contract")
	assert.Contains(t, cost.Pricing.BillingExpr, "* 3.5")
	requestID := "req-uterapi-high-claude"
	recordRequestFinancials(&model.BillingPriceSnapshot{
		RequestId: requestID, ModelName: aliases[0], PurchaseContract: first.PurchasePricing,
	}, `{"prompt_tokens":1000}`, 1000, 0)
	costs, err := model.ListBillingCostBreakdowns(requestID, "", aliases[0])
	require.NoError(t, err)
	require.Len(t, costs, 1)
	expectedCost := baseTier.InputPerMillionUSD.Float64() * groupRatio / fxRate * 1000 / 1_000_000
	assert.InDelta(t, expectedCost, costs[0].AmountUSD.Float64(), 1e-9)
}
