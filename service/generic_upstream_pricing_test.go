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

func genericPrice(v float64) *float64 { return &v }

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
	require.Equal(t, "tiered_expr", tiered.Unit)
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
