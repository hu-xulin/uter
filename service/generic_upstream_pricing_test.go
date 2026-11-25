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
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
)

func TestFetchGenericUpstreamPricingFallsBackToNextKey(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "Bearer exhausted" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[{"model_name":"gpt-a","quota_type":0,"model_ratio":2.5}]}`))
	}))
	defer server.Close()

	payload, err := FetchGenericUpstreamPricing(context.Background(), server.URL, []string{"exhausted", "usable"})
	require.NoError(t, err)
	require.Len(t, payload.Data, 1)
	require.Equal(t, "gpt-a", payload.Data[0].ModelName)
}

func TestGenericChannelPricingRecordsPreserveShapes(t *testing.T) {
	entries := []GenericPricingEntry{
		{ModelName: "token-a", QuotaType: 0, ModelRatio: 2.5, CompletionRatio: 5, CacheRatio: 0.1},
		{ModelName: "call-a", QuotaType: 1, ModelPrice: 0.04},
		{ModelName: "tiered-a", QuotaType: 0, BillingMode: "tiered_expr", BillingExpr: "tier(...)"},
		{ModelName: "parsed-tiered", QuotaType: 0, BillingMode: "tiered_expr", BillingExpr: `tier("standard", p * 2 + c * 8)`},
	}
	records := GenericChannelPricingRecordsWithQuota(7, []string{"token-a", "call-a", "tiered-a", "parsed-tiered"}, entries, time.Unix(100, 0), 500000)
	require.Len(t, records, 4)

	byName := map[string]model.ChannelOfficialPricing{}
	for _, record := range records {
		var normalized model.ChannelOfficialPricing
		require.NoError(t, common.UnmarshalJsonStr(record.NormalizedPricing, &normalized))
		byName[record.ModelName] = normalized
	}

	token := byName["token-a"]
	require.Len(t, token.Tiers, 1)
	require.Equal(t, 5.0, token.Tiers[0].InputPerMillionUSD.Float64())
	require.Equal(t, 25.0, token.Tiers[0].OutputPerMillionUSD.Float64())
	require.Equal(t, 0.5, token.Tiers[0].CachePerMillionUSD.Float64())

	call := byName["call-a"]
	require.Equal(t, "per_call", call.Unit)
	require.Equal(t, 0.04, call.Tiers[0].PerUnitUSD.Float64())

	tiered := byName["tiered-a"]
	require.True(t, tiered.NeedsReview)
	require.Empty(t, tiered.Tiers)
	require.Equal(t, "expression", tiered.Unit)
	require.Equal(t, UpstreamExpressionUnsupported, tiered.ExpressionStatus)

	parsedTiered := byName["parsed-tiered"]
	require.False(t, parsedTiered.NeedsReview)
	require.Len(t, parsedTiered.Tiers, 1)
	require.Equal(t, "per_1m_token", parsedTiered.Tiers[0].Unit)
	require.Equal(t, 2.0, parsedTiered.Tiers[0].InputPerMillionUSD.Float64())
	require.NotNil(t, parsedTiered.ChannelPrice)
}

func TestGenericChannelPricingRecordsClassifyPriceSources(t *testing.T) {
	officialRatio := 1.5
	officialPrice := 0.08
	entries := []GenericPricingEntry{
		{ModelName: "ratio", QuotaType: 0, ModelRatio: 2.5, CompletionRatio: 4},
		{ModelName: "official-ratio", QuotaType: 0, ModelRatio: 2.5, OfficialRatio: &officialRatio, CompletionRatio: 2},
		{ModelName: "official-token-price", QuotaType: 0, OfficialPrice: &officialPrice},
		{ModelName: "official-call", QuotaType: 1, ModelPrice: 0.04, OfficialPrice: &officialPrice},
	}
	records := GenericChannelPricingRecordsWithQuota(9, []string{"ratio", "official-ratio", "official-token-price", "official-call"}, entries, time.Unix(100, 0), 500000)
	require.Len(t, records, 4)

	byName := map[string]model.ChannelOfficialPricing{}
	for _, record := range records {
		var normalized model.ChannelOfficialPricing
		require.NoError(t, common.UnmarshalJsonStr(record.NormalizedPricing, &normalized))
		byName[record.ModelName] = normalized
	}

	ratio := byName["ratio"]
	require.Equal(t, "CHANNEL_RATIO", ratio.PriceKind)
	require.NotNil(t, ratio.RatioBasis)
	require.Equal(t, 2.5, ratio.RatioBasis.RawRatio)
	require.Equal(t, 2.0, ratio.RatioBasis.BasisUSDPerMillion.Float64())
	require.Equal(t, 5.0, ratio.RatioBasis.ResultInputUSD.Float64())
	require.Equal(t, 20.0, ratio.RatioBasis.ResultOutputUSD.Float64())

	official := byName["official-ratio"]
	require.Equal(t, "OFFICIAL_RATIO", official.PriceKind)
	require.NotNil(t, official.RatioBasis)
	require.Equal(t, 3.0, official.RatioBasis.ResultInputUSD.Float64())

	unknown := byName["official-token-price"]
	require.Equal(t, "UNKNOWN", unknown.PriceKind)
	require.True(t, unknown.NeedsReview)
	require.Contains(t, unknown.ReviewReasons, "OFFICIAL_PRICE_UNIT_UNKNOWN")
	require.Empty(t, unknown.Tiers)

	call := byName["official-call"]
	require.Equal(t, "OFFICIAL_ABSOLUTE", call.PriceKind)
	require.Equal(t, 0.08, call.Tiers[0].PerUnitUSD.Float64())
}

// 批量重定向后，渠道模型列表是请求别名，上游目录仍是原名。同步必须用别名
// 查目录、用请求名落计费行；否则所有重定向模型都会得到零行并报不可计费。
func TestGenericChannelPricingRecordsWithMappingUsesRequestName(t *testing.T) {
	entries := []GenericPricingEntry{
		{ModelName: "claude-a", BillingMode: "tiered_expr", BillingExpr: `tier("base", p * 1 + c * 2)`},
		{ModelName: "gpt-b", BillingMode: "tiered_expr", BillingExpr: `tier("base", p * 3 + c * 6)`},
		{ModelName: "not-served", BillingMode: "tiered_expr", BillingExpr: `tier("base", p * 9 + c * 9)`},
	}
	mapping := `{"claude-a-dr":"claude-a","gpt-b-dr":"gpt-mid","gpt-mid":"gpt-b"}`
	records := GenericChannelPricingRecordsWithMapping(
		7, []string{"claude-a-dr", "gpt-b-dr"}, entries, time.Unix(100, 0),
		500000, true, "uterapi", mapping,
	)
	require.Len(t, records, 2)

	names := []string{records[0].ModelName, records[1].ModelName}
	assert.ElementsMatch(t, []string{"claude-a-dr", "gpt-b-dr"}, names)
	byName := map[string]model.ChannelOfficialPricing{}
	for _, record := range records {
		assert.Equal(t, "uterapi", record.Provider)
		assert.NotEmpty(t, record.InternalPricing)
		var official model.ChannelOfficialPricing
		require.NoError(t, common.UnmarshalJsonStr(record.NormalizedPricing, &official))
		byName[record.ModelName] = official
	}
	require.Len(t, byName["claude-a-dr"].Tiers, 1)
	assert.Equal(t, 1.0, byName["claude-a-dr"].Tiers[0].InputPerMillionUSD.Float64())
	require.Len(t, byName["gpt-b-dr"].Tiers, 1)
	assert.Equal(t, 3.0, byName["gpt-b-dr"].Tiers[0].InputPerMillionUSD.Float64())
}

func TestGenericChannelPricingRecordsWithMappingBadJSONFallsBackToDirectNames(t *testing.T) {
	entries := []GenericPricingEntry{
		{ModelName: "direct", BillingMode: "tiered_expr", BillingExpr: `tier("base", p * 2)`},
	}
	records := GenericChannelPricingRecordsWithMapping(
		8, []string{"direct"}, entries, time.Unix(100, 0),
		0, true, "uterapi", "{bad json",
	)
	require.Len(t, records, 1)
	assert.Equal(t, "direct", records[0].ModelName)
}

func TestGenericChannelPricingRecordsFilterChannelModels(t *testing.T) {
	entries := []GenericPricingEntry{
		{ModelName: "served", QuotaType: 0, ModelRatio: 1, CompletionRatio: 2},
		{ModelName: "not-served", QuotaType: 0, ModelRatio: 1, CompletionRatio: 2},
	}
	records := GenericChannelPricingRecordsWithQuota(7, []string{"served"}, entries, time.Unix(100, 0), 500000)
	require.Len(t, records, 1)
	require.Equal(t, "served", records[0].ModelName)
}

func TestGenericPricingPreservesExecutableUpstreamExpression(t *testing.T) {
	entry := GenericPricingEntry{
		ModelName: "tiered-model", BillingMode: "tiered_expr",
		BillingExpr: `len <= 131072 ? tier("short", p * 1 + c * 2) : tier("long", p * 2 + c * 4)`,
	}
	records := GenericChannelPricingRecords(81, []string{"tiered-model"}, []GenericPricingEntry{entry}, time.Unix(1000, 0))
	require.Len(t, records, 1)
	var view model.ChannelOfficialPricing
	require.NoError(t, common.UnmarshalJsonStr(records[0].NormalizedPricing, &view))
	require.Equal(t, UpstreamExpressionExecutable, view.ExpressionStatus)
	require.NotEmpty(t, view.ExpressionHash)
	require.Equal(t, entry.BillingExpr, view.BillingExpr)
	require.Len(t, view.Tiers, 1, "executable tiered expressions must expose an official tier")
	require.Equal(t, "per_1m_token", view.Tiers[0].Unit)
	require.Equal(t, 1.0, view.Tiers[0].InputPerMillionUSD.Float64())
	require.Equal(t, 2.0, view.Tiers[0].OutputPerMillionUSD.Float64())
	require.NotNil(t, view.ChannelPrice)
	require.Contains(t, records[0].InternalPricing, `"mode":"tiered_expr"`)
	require.Contains(t, records[0].InternalPricing, `"source":"newapi-expression"`)
}

// 通用转换器不得固定写死供应商身份；专用适配器必须传入自己的 Provider ID。
func TestGenericPricingProviderIdentityComesFromCaller(t *testing.T) {
	entry := GenericPricingEntry{
		ModelName: "identity-model", BillingMode: "tiered_expr", BillingExpr: "p",
	}
	defaultRecords := GenericChannelPricingRecords(
		83, []string{"identity-model"}, []GenericPricingEntry{entry}, time.Unix(1000, 0),
	)
	require.Len(t, defaultRecords, 1)
	assert.Equal(t, "newapi-compatible", defaultRecords[0].Provider)

	uterapiRecords := GenericChannelPricingRecords(
		84, []string{"identity-model"}, []GenericPricingEntry{entry}, time.Unix(1000, 0), "uterapi",
	)
	require.Len(t, uterapiRecords, 1)
	assert.Equal(t, "uterapi", uterapiRecords[0].Provider)
}

func TestGenericPricingBlocksUnsupportedExpression(t *testing.T) {
	entry := GenericPricingEntry{
		ModelName: "bad-model", BillingExpr: `not a valid expression (`,
	}
	records := GenericChannelPricingRecords(82, []string{"bad-model"}, []GenericPricingEntry{entry}, time.Unix(1000, 0))
	require.Len(t, records, 1)
	var view model.ChannelOfficialPricing
	require.NoError(t, common.UnmarshalJsonStr(records[0].NormalizedPricing, &view))
	require.Equal(t, UpstreamExpressionUnsupported, view.ExpressionStatus)
	require.True(t, view.NeedsReview)
	require.Empty(t, records[0].InternalPricing)
}

// 选择上游分组后，同步必须把该分组倍率冻结进表达式采购合同；成本按真实用量
// 求值，未验证合同不进入已验证毛利。
func TestGenericSyncFreezesGroupPurchaseCost(t *testing.T) {
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
	common.OptionMap = map[string]string{}
	t.Cleanup(func() { common.OptionMap = previousOptions })

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"group_ratio":{"Claude-稳定":3.5},"data":[
			{"model_name":"m-a","billing_mode":"tiered_expr","billing_expr":"tier(\"base\", p * 2)"}
		]}`))
	}))
	t.Cleanup(server.Close)

	base := server.URL
	channel := &model.Channel{Type: constant.ChannelTypeOpenAI, Name: "uterapi", BaseURL: &base, Key: "sk-test", Models: "m-a", Group: "default", Status: 1}
	require.NoError(t, db.Create(channel).Error)
	common.OptionMap[GenericUpstreamBillingGroupKey] = fmt.Sprintf(`{"%d":"Claude-稳定"}`, channel.Id)

	written, models, err := SyncGenericChannelPricingWithModels(context.Background(), channel)
	require.NoError(t, err)
	require.Equal(t, 1, written)
	require.Equal(t, []string{"m-a"}, models)

	row, err := model.GetChannelModelPricingFor(model.ChannelPricingIdentity{ChannelId: channel.Id, ModelName: "m-a"})
	require.NoError(t, err)
	var internal model.ChannelInternalPricing
	require.NoError(t, common.UnmarshalJsonStr(row.InternalPricing, &internal))
	assert.Contains(t, internal.BillingExpr, "* 3.5", "periodic sync must keep the group multiplier on the sale price")
	cost := model.ParseChannelPurchaseCost(row.PurchasePricing)
	require.NotNil(t, cost, "group selection must freeze a purchase contract")
	assert.Contains(t, cost.Pricing.BillingExpr, "* 3.5")
	assert.False(t, cost.Verified)
	assert.Contains(t, cost.Source, "Claude-稳定")

	snapshot := &model.BillingPriceSnapshot{
		RequestId: "req-group-cost", ModelName: "m-a", PurchaseContract: row.PurchasePricing,
	}
	recordRequestFinancials(snapshot, `{"prompt_tokens":1000}`, 1_000, 0)
	costs, err := model.ListBillingCostBreakdowns("req-group-cost", "", "m-a")
	require.NoError(t, err)
	require.Len(t, costs, 1)
	// 1000 tokens * $2/1M * 3.5 = $0.007
	assert.InDelta(t, 0.007, costs[0].AmountUSD.Float64(), 1e-9)
	assert.Equal(t, "purchase_unverified", costs[0].Issue)
	summary, err := model.SummarizeBillingFinancials("req-group-cost", "", "m-a")
	require.NoError(t, err)
	assert.False(t, summary.CostVerified)
	assert.Equal(t, model.BillingLedgerStatusPendingPurchase, summary.GrossProfitState)
}

// 分组绑定的渠道只服务一个模型家族：上游偶发返回整账号目录时按家族过滤。
func TestFilterModelNamesByUpstreamGroup(t *testing.T) {
	models := []string{"claude-sonnet-5", "gpt-6.2-sol", "gemini-4"}

	assert.Equal(t, []string{"claude-sonnet-5"}, FilterModelNamesByUpstreamGroup("Claude-max", models))
	assert.Equal(t, []string{"gpt-6.2-sol"}, FilterModelNamesByUpstreamGroup("Codex Pro", models))
	assert.Equal(t, models, FilterModelNamesByUpstreamGroup("", models))
	assert.Equal(t, models, FilterModelNamesByUpstreamGroup("default", models))
	assert.Equal(t, []string{"unknown-model"}, FilterModelNamesByUpstreamGroup("Claude-max", []string{"unknown-model"}))
}

// 价格文档是账号级目录，可能包含该密钥无法服务的模型：已有模型列表的渠道
// 不能被每次价格同步扩张，只有完全没有模型列表的渠道才从文档导入。
func TestGenericSyncDoesNotExpandExistingChannelModels(t *testing.T) {
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

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[
			{"model_name":"served","billing_mode":"tiered_expr","billing_expr":"tier(\"base\", p * 2)"},
			{"model_name":"not-served","billing_mode":"tiered_expr","billing_expr":"tier(\"base\", p * 3)"}
		]}`))
	}))
	t.Cleanup(server.Close)

	base := server.URL
	channel := &model.Channel{Type: constant.ChannelTypeOpenAI, Name: "group-channel", BaseURL: &base, Key: "sk-test", Models: "served", Group: "default", Status: 1}
	require.NoError(t, db.Create(channel).Error)

	written, models, err := SyncGenericChannelPricingWithModels(context.Background(), channel)
	require.NoError(t, err)
	require.Equal(t, 1, written)
	assert.ElementsMatch(t, []string{"served", "not-served"}, models)

	var stored model.Channel
	require.NoError(t, db.First(&stored, channel.Id).Error)
	assert.Equal(t, "served", stored.Models)
}

func TestGenericRatioWithoutQuotaStaysReviewOnly(t *testing.T) {
	records := GenericChannelPricingRecords(11, []string{"ratio"}, []GenericPricingEntry{
		{ModelName: "ratio", ModelRatio: 1, CompletionRatio: 2},
	}, time.Unix(100, 0))
	require.Len(t, records, 1)
	var view model.ChannelOfficialPricing
	require.NoError(t, common.UnmarshalJsonStr(records[0].NormalizedPricing, &view))
	require.True(t, view.NeedsReview)
	require.Equal(t, "RATIO_ONLY", view.PriceKind)
	require.Contains(t, view.ReviewReasons, "RATIO_BASIS_UNKNOWN")
	require.Empty(t, view.Tiers)
	require.NotNil(t, view.RatioBasis)
	require.Equal(t, 1.0, view.RatioBasis.RawRatio)
	require.Empty(t, records[0].InternalPricing)
}

func TestGenericRatioUsesUpstreamQuotaPerUnit(t *testing.T) {
	cases := []struct {
		quota float64
		want  float64
	}{{250000, 4}, {500000, 2}, {1000000, 1}}
	for _, tc := range cases {
		records := GenericChannelPricingRecordsWithQuota(12, []string{"m"}, []GenericPricingEntry{
			{ModelName: "m", ModelRatio: 1, CompletionRatio: 2},
		}, time.Unix(100, 0), tc.quota)
		require.Len(t, records, 1)
		var view model.ChannelOfficialPricing
		require.NoError(t, common.UnmarshalJsonStr(records[0].NormalizedPricing, &view))
		require.False(t, view.NeedsReview)
		require.Len(t, view.Tiers, 1)
		assert.InDelta(t, tc.want, view.Tiers[0].InputPerMillionUSD.Float64(), 1e-9)
		assert.InDelta(t, tc.quota, 1000000/view.RatioBasis.BasisUSDPerMillion.Float64(), 1e-6)
	}
}

func TestGenericPriceChangesDetectsOnlyRealMovements(t *testing.T) {
	now := time.Unix(1000, 0)
	changes := genericPriceChanges(7,
		map[string]genericPricePoint{
			"same": {price: 1, version: "v1"}, "moved": {price: 1, version: "v1"},
			"gone": {price: 1, version: "v1"},
		},
		map[string]genericPricePoint{
			"same": {price: 1, version: "v1"}, "moved": {price: 1.2, version: "v2"},
			"new": {price: 2, version: "v1"},
		}, now)
	require.Len(t, changes, 1)
	assert.Equal(t, "moved", changes[0].ModelID)
	assert.Equal(t, "price_changed", changes[0].Kind)
	require.NotNil(t, changes[0].Old)
	require.NotNil(t, changes[0].New)
	assert.InDelta(t, 1, *changes[0].Old, 1e-9)
	assert.InDelta(t, 1.2, *changes[0].New, 1e-9)
	assert.Equal(t, "v2", changes[0].PricingVersion)
}

func TestMergeUpstreamHistoryKeepsNewestEntries(t *testing.T) {
	old := &UpstreamPriceHistory{ProviderID: "newapi-compatible", Entries: []UpstreamPriceChange{
		{ModelID: "a"}, {ModelID: "b"},
	}}
	merged := mergeUpstreamHistory(old, "newapi-compatible", []UpstreamPriceChange{
		{ModelID: "c"}, {ModelID: "d"},
	}, 3)
	require.Len(t, merged.Entries, 3)
	assert.Equal(t, []string{"b", "c", "d"}, []string{
		merged.Entries[0].ModelID, merged.Entries[1].ModelID, merged.Entries[2].ModelID,
	})
}

// Uter Route 与页面口径一致：无厂商模型的定价行会被删除，并从渠道模型列表移除。
func TestGenericSyncPrunesUterRouteModelsWithoutVendor(t *testing.T) {
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
	common.OptionMap = map[string]string{}
	t.Cleanup(func() { common.OptionMap = previousOptions })

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,
			"group_ratio":{"claude":0.6},
			"group_group_ratio":{"default":{"claude":0.6}},
			"vendors":[{"id":3,"name":"Vendor"}],
			"data":[
			{"model_name":"visible-a","vendor_id":3,"quota_type":0,"model_ratio":1,"completion_ratio":2,"enable_groups":["claude"]},
			{"model_name":"hidden-a","vendor_id":0,"quota_type":0,"model_ratio":37.5,"completion_ratio":1}
		]}`))
	}))
	t.Cleanup(server.Close)
	common.OptionMap[UterRouteUpstreamURLOption] = server.URL

	base := server.URL
	channel := &model.Channel{
		Type: constant.ChannelTypeOpenAI, Name: "Uter Route", BaseURL: &base,
		Key: "sk-test", Models: "visible-a,hidden-a", Group: "default", Status: 1,
	}
	require.NoError(t, db.Create(channel).Error)
	require.NoError(t, db.Create(&model.ChannelModelPricing{
		ChannelId: channel.Id, ModelName: "hidden-a", Provider: "uterroute", PricingStatus: model.ChannelPricingStatusConfigured,
	}).Error)

	written, _, err := SyncGenericChannelPricingWithModels(context.Background(), channel)
	require.NoError(t, err)
	require.Equal(t, 1, written)

	var stored model.Channel
	require.NoError(t, db.First(&stored, channel.Id).Error)
	assert.Equal(t, "visible-a", stored.Models)

	var hiddenRows int64
	require.NoError(t, db.Model(&model.ChannelModelPricing{}).
		Where("channel_id = ? AND model_name = ?", channel.Id, "hidden-a").Count(&hiddenRows).Error)
	assert.Zero(t, hiddenRows)

	var visible model.ChannelModelPricing
	require.NoError(t, db.Where("channel_id = ? AND model_name = ?", channel.Id, "visible-a").First(&visible).Error)
	assert.Equal(t, "uterroute", visible.Provider)
	assert.Contains(t, visible.NormalizedPricing, `"discount_ratio":0.6`)
	assert.Contains(t, visible.NormalizedPricing, `"channel_price"`)
}

// Uter Route 渠道（type 65）即使 Base URL 指向白标中继主机，也必须走专用目录
// 同步；此前的按主机判断让通用同步双写 provider=newapi-compatible 行，导致
// 编辑渠道「已获取价格」每个模型出现两行（第二行官方价不可用）。
func TestUterRouteChannelTypeReroutesGenericSyncToCatalog(t *testing.T) {
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
	common.OptionMap = map[string]string{}
	t.Cleanup(func() { common.OptionMap = previousOptions })

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/api/pricing", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"pricing_version":"t1","data":[
			{"model_name":"m-a","vendor_id":1,"quota_type":0,"model_ratio":2.5,"completion_ratio":5}
		],"vendors":[{"id":1,"name":"V"}],"group_ratio":{"VIP0":1},"usable_group":{"VIP0":""}}`))
	}))
	t.Cleanup(server.Close)

	base := server.URL
	channel := &model.Channel{Type: constant.ChannelTypeUterRoute, Name: "route", BaseURL: &base, Key: "sk-route", Models: "m-a", Group: "VIP0", Status: 1}
	require.NoError(t, db.Create(channel).Error)
	// A stale row left behind by the old host-blind generic sync.
	require.NoError(t, db.Create(&model.ChannelModelPricing{
		ChannelId: channel.Id, Provider: "newapi-compatible", ModelName: "m-a", Currency: "USD",
		OfficialPricing: `{"model_name":"m-a"}`, PricingSource: "newapi:/api/pricing", PricingStatus: "configured",
	}).Error)

	written, models, err := SyncGenericChannelPricingWithModels(context.Background(), channel)
	require.NoError(t, err)
	require.Equal(t, []string{"m-a"}, models)
	require.GreaterOrEqual(t, written, 1)

	var rows []model.ChannelModelPricing
	require.NoError(t, db.Where("channel_id = ?", channel.Id).Find(&rows).Error)
	require.NotEmpty(t, rows)
	for _, row := range rows {
		assert.Equal(t, "uterroute", row.Provider, "generic duplicate rows must be pruned for Uter Route channels")
	}
}

// 收口：三类 Uter 自有渠道必须由同一判定识别，禁止 newapi 通用文档同步落行。
func TestIsUterOwnedPricingChannelCoversAllDedicatedTypes(t *testing.T) {
	previousOptions := common.OptionMap
	common.OptionMap = map[string]string{
		UterRouteUpstreamURLOption: "https://dreamrouter.test",
		UterAPIUpstreamURLOption:   "https://api.uterapi.test",
	}
	t.Cleanup(func() { common.OptionMap = previousOptions })

	// Dedicated types are authoritative regardless of host.
	for _, channelType := range []int{
		constant.ChannelTypeUter,
		constant.ChannelTypeUterAPI,
		constant.ChannelTypeUterRoute,
	} {
		assert.True(t, IsUterOwnedPricingChannel(channelType, "https://unrelated.example"),
			"channel type %d must always be Uter-owned", channelType)
	}
	// Legacy channels are still caught by host.
	assert.True(t, IsUterOwnedPricingChannel(constant.ChannelTypeOpenAI, "https://api.dreamrouter.test"))
	assert.True(t, IsUterOwnedPricingChannel(constant.ChannelTypeNewAPI, "https://x.api.uterapi.test"))
	// A genuine third-party channel stays on the generic sync.
	assert.False(t, IsUterOwnedPricingChannel(constant.ChannelTypeOpenAI, "https://api.openai.com"))
}

// 收口：Uter.ai(type 60) 即使指向非 UterRoute 主机，通用同步也必须改道到
// UterRoute catalog，绝不能写出 provider=newapi-compatible / source=newapi 的行。
func TestUterAITypeNeverWritesGenericPricingRows(t *testing.T) {
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
	common.OptionMap = map[string]string{}
	t.Cleanup(func() { common.OptionMap = previousOptions })

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"pricing_version":"uter-1",
			"group_ratio":{"default":1},"group_group_ratio":{"default":{"claude":0.6}},
			"vendors":[{"id":3,"name":"Vendor"}],
			"data":[{"model_name":"m-a","vendor_id":3,"quota_type":0,"model_ratio":1,"completion_ratio":2,"enable_groups":["claude"]}]}`))
	}))
	t.Cleanup(server.Close)
	common.OptionMap[UterRouteUpstreamURLOption] = server.URL

	base := server.URL
	channel := &model.Channel{
		Type: constant.ChannelTypeUter, Name: "uter-ai", BaseURL: &base,
		Key: "sk-test", Models: "m-a", Group: "default", Status: 1,
	}
	require.NoError(t, db.Create(channel).Error)
	// A stale generic row from before the ownership gate must be pruned.
	require.NoError(t, db.Create(&model.ChannelModelPricing{
		ChannelId: channel.Id, Provider: "newapi-compatible", ModelName: "m-a", Currency: "USD",
		OfficialPricing: `{"model_name":"m-a"}`, PricingSource: "newapi:/api/pricing", PricingStatus: "configured",
	}).Error)

	written, models, err := SyncGenericChannelPricingWithModels(context.Background(), channel)
	require.NoError(t, err)
	require.Equal(t, []string{"m-a"}, models)
	require.GreaterOrEqual(t, written, 1)

	var rows []model.ChannelModelPricing
	require.NoError(t, db.Where("channel_id = ?", channel.Id).Find(&rows).Error)
	require.NotEmpty(t, rows)
	for _, row := range rows {
		assert.Equal(t, "uterroute", row.Provider, "Uter-owned channels must never keep newapi-compatible rows")
		assert.NotEqual(t, "newapi:/api/pricing", row.PricingSource)
	}
}
