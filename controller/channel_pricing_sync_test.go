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
package controller

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/setting/custom_pricing"
)

func TestFetchUpstreamPricingFallsBackToNextKey(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "Bearer exhausted" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[{"model_name":"gpt-4o","quota_type":0,"model_ratio":2.5,"completion_ratio":4}]}`))
	}))
	defer server.Close()

	payload, err := fetchUpstreamPricing(context.Background(), server.URL+"/api/pricing", []string{
		"exhausted", "usable",
	})
	require.NoError(t, err)
	require.Len(t, payload.Data, 1)
	assert.Equal(t, "gpt-4o", payload.Data[0].ModelName)
	assert.Equal(t, 2.5, payload.Data[0].ModelRatio)
}

func TestMergeChannelQuotesPreservesOperatorPolicy(t *testing.T) {
	ratio := 0.6
	previous := &custom_pricing.ChannelPriceSetting{
		Enabled: false,
		Channels: map[string]custom_pricing.ChannelPriceConfig{
			"7": {
				Enabled: true,
				Ratio:   &ratio,
				Models: map[string]custom_pricing.ChannelModelRule{
					"gpt-4o": {Mode: custom_pricing.ChannelPriceModeMultiplier, Value: 0.5},
				},
			},
			"8": {Enabled: true},
		},
	}
	official := 10.0
	next, imported := mergeChannelQuotes(previous, 7, []upstreamPricingEntry{
		{ModelName: "gpt-4o", QuotaType: 0, ModelRatio: 3, CompletionRatio: 4, OfficialPrice: &official},
		{ModelName: "mj", QuotaType: 1, ModelPrice: 0.05},
		{ModelName: "tiered", QuotaType: 0, ModelRatio: 37.5, BillingMode: "tiered_expr", BillingExpr: "tier(...)"},
		{ModelName: "  "},
	}, 1700000000)

	require.Equal(t, 3, imported)
	// Syncing quotes must not silently enable billing on its own.
	require.False(t, next.Enabled)
	require.Contains(t, next.Channels, "8")

	cfg := next.Channels["7"]
	require.True(t, cfg.Enabled)
	require.Equal(t, 0.6, *cfg.Ratio)
	require.Equal(t, 0.5, cfg.Models["gpt-4o"].Value)
	require.Equal(t, 6.0, *cfg.Quotes["gpt-4o"].ChannelPrice)
	require.Equal(t, official, *cfg.Quotes["gpt-4o"].OfficialPrice)
	require.Equal(t, "per_call", cfg.Quotes["mj"].Unit)
	require.Equal(t, 0.05, *cfg.Quotes["mj"].ChannelPrice)
	require.Equal(t, custom_pricing.ChannelQuoteStatusNeedsReview, cfg.Quotes["tiered"].Status)
	require.Equal(t, "tier(...)", cfg.Quotes["tiered"].BillingExpr)
	require.Equal(t, 4.0, *cfg.Quotes["gpt-4o"].CompletionRatio)
}

func TestFetchUpstreamPricingRejectsInvalidResponses(t *testing.T) {
	t.Run("all keys rejected", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusBadGateway)
		}))
		defer server.Close()

		_, err := fetchUpstreamPricing(context.Background(), server.URL, []string{"one", "two"})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "502")
	})

	t.Run("body is not JSON", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			_, _ = w.Write([]byte("<html>maintenance</html>"))
		}))
		defer server.Close()

		_, err := fetchUpstreamPricing(context.Background(), server.URL, []string{"key"})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "invalid JSON")
	})

	t.Run("no usable key", func(t *testing.T) {
		_, err := fetchUpstreamPricing(context.Background(), "http://127.0.0.1:1", []string{" ", ""})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "no usable channel key")
	})
}
