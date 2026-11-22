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
)

func xxapiPricingServer(t *testing.T) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/pricing" {
			http.NotFound(writer, request)
			return
		}
		if request.Header.Get("Authorization") != "Bearer sk-xxapi-test" {
			writer.WriteHeader(http.StatusUnauthorized)
			return
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"success":true,"data":[
			{"model_name":"gpt-a","model_ratio":1,"completion_ratio":5,
			 "billing_mode":"tiered_expr","billing_expr":"tier(\"base\", p * 2 + c * 10)"}
		],"group_ratio":{"Codex":0.5}}`))
	}))
	t.Cleanup(server.Close)
	return server
}

func TestFetchXXAPIPricingPayloadSendsChannelKey(t *testing.T) {
	server := xxapiPricingServer(t)
	payload, err := fetchXXAPIPricingPayload(context.Background(), server.URL, "sk-xxapi-test")
	require.NoError(t, err)
	require.Len(t, payload.Data, 1)
	assert.Equal(t, "gpt-a", payload.Data[0].ModelName)
	assert.InDelta(t, 0.5, payload.GroupRatio["Codex"], 1e-9)
}

func TestXXAPIProviderAdapterIsRegistered(t *testing.T) {
	server := xxapiPricingServer(t)
	payload, err := FetchUpstreamCatalog(context.Background(), "xxapi", UpstreamFetchConfig{
		BaseURL: server.URL,
		APIKey:  "sk-xxapi-test",
	})
	require.NoError(t, err)
	result, ok := payload.(*GenericPricingPayload)
	require.True(t, ok)
	require.Len(t, result.Data, 1)
}

func TestXXAPIPricingEndpointAcceptsFullPriceURL(t *testing.T) {
	endpoint, err := xxapiPricingEndpointFor("https://xxapi.ai/api/pricing")
	require.NoError(t, err)
	assert.Equal(t, "https://xxapi.ai/api/pricing", endpoint)

	endpoint, err = xxapiPricingEndpointFor("https://xxapi.ai/v1")
	require.NoError(t, err)
	assert.Equal(t, "https://xxapi.ai/api/pricing", endpoint)
}
