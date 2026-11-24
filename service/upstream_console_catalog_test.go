package service

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNormalizeUpstreamConsoleBaseURL(t *testing.T) {
	tests := []struct {
		name    string
		raw     string
		want    string
		wantErr bool
	}{
		{"https origin with path", "https://console.example.com/admin/login", "https://console.example.com", false},
		{"http origin", "http://127.0.0.1:3000/", "http://127.0.0.1:3000", false},
		{"empty", "   ", "", true},
		{"relative", "/api/user/login", "", true},
		{"unsupported scheme", "ftp://example.com", "", true},
		{"embedded credentials", "https://user:pass@example.com", "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := normalizeUpstreamConsoleBaseURL(tt.raw)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.want, got.String())
		})
	}
}

func TestFetchUpstreamConsoleCatalogNotConfiguredFallsBack(t *testing.T) {
	// No credentials: must return a clean not_configured result with NO error,
	// so the caller keeps the primary API Key + base_url result.
	for _, creds := range []struct {
		url, user, pass string
	}{
		{"", "user", "pass"},
		{"https://console.example.com", "", "pass"},
		{"https://console.example.com", "user", ""},
	} {
		result, err := FetchUpstreamConsoleCatalog(context.Background(), creds.url, creds.user, creds.pass)
		require.NoError(t, err)
		require.Equal(t, ConsoleStatusNotConfigured, result.Status)
		require.False(t, result.LoginSucceeded)
		require.Empty(t, result.Models)
		require.Empty(t, result.Prices)
	}
}

func TestFetchUpstreamConsoleCatalogBlocksSSRF(t *testing.T) {
	// A private/loopback target must be rejected before any login request.
	result, err := FetchUpstreamConsoleCatalog(
		context.Background(), "http://127.0.0.1:8080", "user", "pass")
	require.Error(t, err)
	require.Equal(t, ConsoleStatusLoginFailed, result.Status)
}

func TestParseConsoleModels(t *testing.T) {
	body := []byte(`{"success":true,"data":[
		"gpt-4o",
		{"model":"claude-3"},
		{"id":"gemini-pro"},
		"gpt-4o",
		"",
		{"name":"llama-3"}
	]}`)
	models := parseConsoleModels(body)
	require.Equal(t, []string{"gpt-4o", "claude-3", "gemini-pro", "llama-3"}, models)
}

func TestParseConsoleModelsBareArrayAndInvalid(t *testing.T) {
	require.Equal(t, []string{"a", "b"}, parseConsoleModels([]byte(`["a","b"]`)))
	require.Empty(t, parseConsoleModels([]byte(`not json`)))
	require.Empty(t, parseConsoleModels([]byte(`{"data":{}}`)))
}

func TestParseConsolePrices(t *testing.T) {
	body := []byte(`{"data":[
		{"model":"gpt-4o","input_price":2.5,"output_price":10,"currency":"USD"},
		{"model_name":"claude-3","prompt_price":"3","completion_price":"15"}
	]}`)
	prices := parseConsolePrices(body)
	require.Len(t, prices, 2)
	require.Equal(t, "gpt-4o", prices[0].Model)
	require.InDelta(t, 2.5, prices[0].InputPrice, 0.0001)
	require.InDelta(t, 10, prices[0].OutputPrice, 0.0001)
	require.Equal(t, "USD", prices[0].Currency)
	require.Equal(t, "claude-3", prices[1].Model)
	require.InDelta(t, 3, prices[1].InputPrice, 0.0001)
}

func TestExtractToken(t *testing.T) {
	require.Equal(t, "abc", extractToken("abc"))
	require.Equal(t, "bearer", extractToken(map[string]any{"token": "bearer"}))
	require.Equal(t, "", extractToken(map[string]any{"other": 1}))
}
