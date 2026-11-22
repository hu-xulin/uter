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
	}
	records := GenericChannelPricingRecordsWithQuota(7, []string{"token-a", "call-a", "tiered-a"}, entries, time.Unix(100, 0), 500000)
	require.Len(t, records, 3)

	byName := map[string]model.ChannelOfficialPricing{}
	for _, record := range records {
		var normalized model.ChannelOfficialPricing
		require.NoError(t, common.UnmarshalJsonStr(record.NormalizedPricing, &normalized))
		byName[record.ModelName] = normalized
	}

	token := byName["token-a"]
	require.Len(t, token.Tiers, 1)
	require.Equal(t, 5.0, *token.Tiers[0].InputPerMillionUSD)
	require.Equal(t, 25.0, *token.Tiers[0].OutputPerMillionUSD)
	require.Equal(t, 0.5, *token.Tiers[0].CachePerMillionUSD)

	call := byName["call-a"]
	require.Equal(t, "per_call", call.Unit)
	require.Equal(t, 0.04, *call.Tiers[0].PerUnitUSD)

	tiered := byName["tiered-a"]
	require.True(t, tiered.NeedsReview)
	require.Empty(t, tiered.Tiers)
	require.Equal(t, "expression", tiered.Unit)
	require.Equal(t, UpstreamExpressionUnsupported, tiered.ExpressionStatus)
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
	require.Equal(t, 2.0, ratio.RatioBasis.BasisUSDPerMillion)
	require.Equal(t, 5.0, ratio.RatioBasis.ResultInputUSD)
	require.Equal(t, 20.0, ratio.RatioBasis.ResultOutputUSD)

	official := byName["official-ratio"]
	require.Equal(t, "OFFICIAL_RATIO", official.PriceKind)
	require.NotNil(t, official.RatioBasis)
	require.Equal(t, 3.0, official.RatioBasis.ResultInputUSD)

	unknown := byName["official-token-price"]
	require.Equal(t, "UNKNOWN", unknown.PriceKind)
	require.True(t, unknown.NeedsReview)
	require.Contains(t, unknown.ReviewReasons, "OFFICIAL_PRICE_UNIT_UNKNOWN")
	require.Empty(t, unknown.Tiers)

	call := byName["official-call"]
	require.Equal(t, "OFFICIAL_ABSOLUTE", call.PriceKind)
	require.Equal(t, 0.08, *call.Tiers[0].PerUnitUSD)
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
	require.Empty(t, view.Tiers)
	require.Contains(t, records[0].InternalPricing, `"mode":"tiered_expr"`)
	require.Contains(t, records[0].InternalPricing, `"source":"newapi-expression"`)
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
	channel := &model.Channel{Type: constant.ChannelTypeCustom, Name: "xxapi", BaseURL: &base, Key: "sk-test", Models: "m-a", Group: "default", Status: 1}
	require.NoError(t, db.Create(channel).Error)
	common.OptionMap[GenericUpstreamBillingGroupKey] = fmt.Sprintf(`{"%d":"Claude-稳定"}`, channel.Id)

	written, models, err := SyncGenericChannelPricingWithModels(context.Background(), channel)
	require.NoError(t, err)
	require.Equal(t, 1, written)
	require.Equal(t, []string{"m-a"}, models)

	row, err := model.GetChannelModelPricingFor(model.ChannelPricingIdentity{ChannelId: channel.Id, ModelName: "m-a"})
	require.NoError(t, err)
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
	assert.InDelta(t, 0.007, costs[0].AmountUSD, 1e-9)
	assert.Equal(t, "purchase_unverified", costs[0].Issue)
	summary, err := model.SummarizeBillingFinancials("req-group-cost", "", "m-a")
	require.NoError(t, err)
	assert.False(t, summary.CostVerified)
	assert.Equal(t, model.BillingLedgerStatusPendingPurchase, summary.GrossProfitState)
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
		assert.InDelta(t, tc.want, *view.Tiers[0].InputPerMillionUSD, 1e-9)
		assert.InDelta(t, tc.quota, 1000000/view.RatioBasis.BasisUSDPerMillion, 1e-6)
	}
}
