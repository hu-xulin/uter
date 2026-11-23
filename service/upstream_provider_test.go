package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
)

func TestFetchUpstreamCatalogDispatchesAdapters(t *testing.T) {
	uterRouteServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/api/pricing", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"data":[{"model_name":"gpt-a","model_ratio":2.5}]}`))
	}))
	defer uterRouteServer.Close()

	payload, err := FetchUpstreamCatalog(context.Background(), "uterroute", UpstreamFetchConfig{BaseURL: uterRouteServer.URL})
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

func TestManualProviderFetchNeverPretendsToSync(t *testing.T) {
	_, err := FetchUpstreamCatalog(context.Background(), "volcengine", UpstreamFetchConfig{})
	require.ErrorContains(t, err, "no authorized price API")
}

func TestUpstreamProviderForChannelMapsTypesAndFallback(t *testing.T) {
	previousOptions := common.OptionMap
	common.OptionMap = map[string]string{UterRouteUpstreamURLOption: "https://example-upstream.test"}
	t.Cleanup(func() { common.OptionMap = previousOptions })
	bailian := UpstreamProviderForChannel(17, "https://ws.cn-beijing.maas.aliyuncs.com")
	require.Equal(t, "alibaba-bailian", bailian.ID)
	require.Equal(t, CapabilitySupported, bailian.Capabilities.OfficialPricing.Status)
	require.Equal(t, CapabilitySupported, bailian.Capabilities.DeploymentPricing.Status)

	uterRoute := UpstreamProviderForChannel(58, "https://example-upstream.test/v1")
	require.Equal(t, "uterroute", uterRoute.ID)
	require.Equal(t, CapabilityPartial, uterRoute.Capabilities.OfficialPricing.Status)

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
		for dimension, capability := range map[string]UpstreamProviderCapability{
			"token": provider.Capabilities.TokenPricing, "image": provider.Capabilities.ImagePricing,
			"video": provider.Capabilities.VideoPricing, "audio": provider.Capabilities.AudioPricing,
			"per_call": provider.Capabilities.PerCallPricing, "per_second": provider.Capabilities.PerSecondPricing,
			"per_minute": provider.Capabilities.PerMinutePricing, "deployment": provider.Capabilities.DeploymentPricing,
		} {
			if capability.Status != CapabilityManualOnly {
				t.Fatalf("provider %s %s pricing = %s, want MANUAL_ONLY", id, dimension, capability.Status)
			}
		}
		if provider.SourceDocumentation != "" {
			t.Fatalf("provider %s must not claim a price source documentation", id)
		}
	}
}

func TestProviderDescriptorsDeclarePerDimensionCoverage(t *testing.T) {
	previousOptions := common.OptionMap
	common.OptionMap = map[string]string{UterRouteUpstreamURLOption: "https://example-upstream.test"}
	t.Cleanup(func() { common.OptionMap = previousOptions })
	bailian := UpstreamProviderForChannel(17, "")
	require.Equal(t, CapabilitySupported, bailian.Capabilities.TokenPricing.Status)
	require.Equal(t, CapabilitySupported, bailian.Capabilities.PerMinutePricing.Status)

	uterRoute := UpstreamProviderForChannel(58, "https://example-upstream.test/v1")
	require.Equal(t, CapabilityPartial, uterRoute.Capabilities.PerSecondPricing.Status)
	require.Equal(t, CapabilityUnsupported, uterRoute.Capabilities.DeploymentPricing.Status)
	require.NotEmpty(t, uterRoute.SourceDocumentation)
	require.NotEmpty(t, uterRoute.SyncFrequency)
}

func TestUterProviderSupportsEveryPriceDimension(t *testing.T) {
	for _, baseURL := range []string{"https://api.uter.ai", "https://api.example-upstream.test"} {
		provider := UpstreamProviderForChannel(60, baseURL)
		require.Equal(t, "uter", provider.ID, baseURL)
		require.Equal(t, CapabilitySupported, provider.Capabilities.OfficialPricing.Status, baseURL)
		require.Equal(t, CapabilitySupported, provider.Capabilities.ChannelPricing.Status, baseURL)
		for dimension, capability := range map[string]UpstreamProviderCapability{
			"token": provider.Capabilities.TokenPricing, "image": provider.Capabilities.ImagePricing,
			"video": provider.Capabilities.VideoPricing, "audio": provider.Capabilities.AudioPricing,
			"per_call": provider.Capabilities.PerCallPricing, "per_second": provider.Capabilities.PerSecondPricing,
			"per_minute": provider.Capabilities.PerMinutePricing, "deployment": provider.Capabilities.DeploymentPricing,
		} {
			if capability.Status != CapabilitySupported {
				t.Fatalf("Uter %s pricing = %s, want SUPPORTED (base %s)", dimension, capability.Status, baseURL)
			}
		}
	}
}

// A non-Uter relay whose base URL is Uter Route keeps UterRoute's pricing
// adapter so its official price document is read with the right semantics.
func TestUterRouteHostWinsOverNonUterRelayType(t *testing.T) {
	previousOptions := common.OptionMap
	common.OptionMap = map[string]string{UterRouteUpstreamURLOption: "https://example-upstream.test"}
	t.Cleanup(func() { common.OptionMap = previousOptions })
	provider := UpstreamProviderForChannel(58, "https://api.example-upstream.test")
	require.Equal(t, "uterroute", provider.ID)
	require.Equal(t, CapabilityPartial, provider.Capabilities.OfficialPricing.Status)
	require.Equal(t, CapabilityPartial, provider.Capabilities.PerSecondPricing.Status)
}

func TestChannelPricingIdentityCarriesDeployment(t *testing.T) {
	identity := ChannelPricingIdentityForRequest(60, "https://api.example.com", " deploy-42 ", "gpt-5")
	require.Equal(t, "uter", identity.Provider)
	require.Equal(t, "deploy-42", identity.DeploymentId)
	require.Equal(t, "gpt-5", identity.ModelName)
}
