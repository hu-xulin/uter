package service

import (
	"context"
	"errors"
	"sort"
)

// UpstreamFetchConfig carries the credentials a provider adapter may need.
// DreamRouter's public pricing needs none; Bailian uses the channel key.
type UpstreamFetchConfig struct {
	BaseURL   string
	APIKey    string
	ChannelID int
}

// UpstreamProviderAdapter is the common contract for upstream catalogs.
// Fetch returns the provider-specific payload (*UpstreamSnapshot for
// DreamRouter, *BailianCatalog for Bailian) so adapters never force different
// price models into one lossy structure.
type UpstreamProviderAdapter interface {
	Descriptor() UpstreamProvider
	Fetch(ctx context.Context, cfg UpstreamFetchConfig) (any, error)
}

var upstreamAdapters = map[string]UpstreamProviderAdapter{}

func registerUpstreamAdapter(adapter UpstreamProviderAdapter) {
	if adapter == nil {
		return
	}
	upstreamAdapters[adapter.Descriptor().ID] = adapter
}

func init() {
	registerUpstreamAdapter(dreamRouterAdapter{})
	registerUpstreamAdapter(bailianAdapter{})
}

// UpstreamProviders lists registered adapters with their real capabilities.
func UpstreamProviders() []UpstreamProvider {
	providers := make([]UpstreamProvider, 0, len(upstreamAdapters))
	for _, adapter := range upstreamAdapters {
		providers = append(providers, adapter.Descriptor())
	}
	sort.Slice(providers, func(i, j int) bool { return providers[i].ID < providers[j].ID })
	return providers
}

// FetchUpstreamCatalog dispatches to the registered provider adapter.
func FetchUpstreamCatalog(ctx context.Context, providerID string, cfg UpstreamFetchConfig) (any, error) {
	adapter, ok := upstreamAdapters[providerID]
	if !ok {
		return nil, errors.New("unknown upstream provider")
	}
	return adapter.Fetch(ctx, cfg)
}

type dreamRouterAdapter struct{}

func (dreamRouterAdapter) Descriptor() UpstreamProvider {
	return UpstreamProvider{
		ID: "dreamrouter", Name: "DreamRouter",
		PricingURL: "https://dreamrouter.ai/api/pricing",
		ModelsURL:  "https://dreamrouter.ai/v1/models",
		AuthType:   "pricing_public_models_api_key",
		Capabilities: UpstreamProviderCapabilities{
			Models: true, ProviderPricing: true, Status: "PARTIAL_RATIO_ONLY",
		},
	}
}

func (dreamRouterAdapter) Fetch(ctx context.Context, cfg UpstreamFetchConfig) (any, error) {
	return FetchDreamRouterUpstream(ctx, cfg.BaseURL)
}

type bailianAdapter struct{}

func (bailianAdapter) Descriptor() UpstreamProvider {
	return UpstreamProvider{
		ID: "alibaba-bailian", Name: "阿里云百炼",
		PricingURL: "/api/v1/models", ModelsURL: "/api/v1/models",
		AuthType: "api_key",
		Capabilities: UpstreamProviderCapabilities{
			Models: true, ModelDetails: true, OfficialPricing: true,
			ProviderPricing: true, Status: "SUPPORTED",
		},
	}
}

func (bailianAdapter) Fetch(ctx context.Context, cfg UpstreamFetchConfig) (any, error) {
	return FetchBailianCatalog(ctx, cfg.BaseURL, cfg.APIKey)
}
