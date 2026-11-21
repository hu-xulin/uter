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
	"time"

	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
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
	records := GenericChannelPricingRecords(7, []string{"token-a", "call-a", "tiered-a"}, entries, time.Unix(100, 0))
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
	records := GenericChannelPricingRecords(9, []string{"ratio", "official-ratio", "official-token-price", "official-call"}, entries, time.Unix(100, 0))
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
	records := GenericChannelPricingRecords(7, []string{"served"}, entries, time.Unix(100, 0))
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
