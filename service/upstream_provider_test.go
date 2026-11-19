package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFetchUpstreamCatalogDispatchesAdapters(t *testing.T) {
	dreamRouterServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/api/pricing", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"data":[{"model_name":"gpt-a","model_ratio":2.5}]}`))
	}))
	defer dreamRouterServer.Close()

	payload, err := FetchUpstreamCatalog(context.Background(), "dreamrouter", UpstreamFetchConfig{BaseURL: dreamRouterServer.URL})
	require.NoError(t, err)
	snapshot, ok := payload.(*UpstreamSnapshot)
	require.True(t, ok)
	require.Len(t, snapshot.Models, 1)

	bailianServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/api/v1/models", r.URL.Path)
		require.Equal(t, "Bearer test-key", r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"output":{"total":1,"models":[{"model":"qwen-plus","prices":[{"range_name":"Default","prices":[{"type":"input_token","price":"1","price_unit":"每百万tokens"}]}]}]}}`))
	}))
	defer bailianServer.Close()

	payload, err = FetchUpstreamCatalog(context.Background(), "alibaba-bailian", UpstreamFetchConfig{
		BaseURL: bailianServer.URL, APIKey: "test-key",
	})
	require.NoError(t, err)
	catalog, ok := payload.(*BailianCatalog)
	require.True(t, ok)
	require.Len(t, catalog.Models, 1)
}

func TestFetchUpstreamCatalogRejectsUnknownProvider(t *testing.T) {
	_, err := FetchUpstreamCatalog(context.Background(), "unknown", UpstreamFetchConfig{})
	require.ErrorContains(t, err, "unknown upstream provider")
}

func TestUpstreamProviderForChannelMapsTypesAndFallback(t *testing.T) {
	bailian := UpstreamProviderForChannel(17, "https://ws.cn-beijing.maas.aliyuncs.com")
	require.Equal(t, "alibaba-bailian", bailian.ID)
	require.Equal(t, CapabilitySupported, bailian.Capabilities.OfficialPricing.Status)

	dreamRouter := UpstreamProviderForChannel(58, "https://dreamrouter.ai/v1")
	require.Equal(t, "dreamrouter", dreamRouter.ID)
	require.Equal(t, CapabilityPartial, dreamRouter.Capabilities.OfficialPricing.Status)

	generic := UpstreamProviderForChannel(1, "https://api.example.com")
	require.Equal(t, "newapi-compatible", generic.ID)
	require.Equal(t, CapabilityPartial, generic.Capabilities.OfficialPricing.Status)
	require.Equal(t, CapabilityNeedsConfiguration, generic.Capabilities.ScheduledSync.Status)
}

func TestUpstreamProvidersMarkUnsupportedPricingAsManual(t *testing.T) {
	providers := UpstreamProviders()
	byID := make(map[string]UpstreamProvider, len(providers))
	for _, provider := range providers {
		byID[provider.ID] = provider
	}
	for _, id := range []string{"openai", "anthropic", "google-gemini", "microsoft-azure", "aws-bedrock", "tencent-hunyuan", "volcengine"} {
		provider, ok := byID[id]
		if !ok {
			t.Fatalf("provider %s is not registered", id)
		}
		if provider.Capabilities.OfficialPricing.Status != CapabilityManualOnly {
			t.Fatalf("provider %s official pricing = %s, want MANUAL_ONLY", id, provider.Capabilities.OfficialPricing.Status)
		}
		if provider.Capabilities.ChannelPricing.Status != CapabilityManualOnly {
			t.Fatalf("provider %s channel pricing = %s, want MANUAL_ONLY", id, provider.Capabilities.ChannelPricing.Status)
		}
		if provider.Capabilities.ScheduledSync.Status != CapabilityUnsupported {
			t.Fatalf("provider %s scheduled sync = %s, want UNSUPPORTED", id, provider.Capabilities.ScheduledSync.Status)
		}
	}
}
