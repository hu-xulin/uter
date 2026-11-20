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
	for _, provider := range manualPricingProviders {
		registerUpstreamAdapter(manualProviderAdapter{provider: provider})
	}
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
		PricingURL:          "https://dreamrouter.ai/api/pricing",
		ModelsURL:           "https://dreamrouter.ai/v1/models",
		AuthType:            "pricing_public_models_api_key",
		SourceDocumentation: "https://dreamrouter.ai/api/pricing",
		SyncFrequency:       "scheduler 1m; channel cadence model 6h / official 24h / channel 1h",
		Capabilities: UpstreamProviderCapabilities{
			ModelDiscovery:      capability(CapabilitySupported, "GET /v1/models with the channel key"),
			ModelMetadata:       capability(CapabilityPartial, "model IDs and endpoint types; specs come from the metadata catalog"),
			OfficialPricing:     capability(CapabilityPartial, "public ratios, or absolute prices from the full sync snapshot"),
			ChannelPricing:      capability(CapabilityPartial, "group ratios and discounts; per-model ratios are reviewable"),
			DiscountInformation: capability(CapabilitySupported, "group_ratio and group_group_ratio"),
			RegionPricing:       capability(CapabilityUnsupported, "no region-scoped pricing"),
			TieredPricing:       capability(CapabilityPartial, "billing_expr parsed; unparsable tiers stay needs_review"),
			MediaPricing:        capability(CapabilityPartial, "per-call media prices when model_price is published"),
			ScheduledSync:       capability(CapabilitySupported, "background catalog sync"),
			TokenPricing:        capability(CapabilityPartial, "ratios by default; absolute USD only when the snapshot carries it"),
			ImagePricing:        capability(CapabilityPartial, "per-call model_price"),
			VideoPricing:        capability(CapabilityPartial, "per-second billing expressions"),
			AudioPricing:        capability(CapabilityPartial, "audio prices only when the pricing document publishes them"),
			PerCallPricing:      capability(CapabilityPartial, "model_price"),
			PerSecondPricing:    capability(CapabilityPartial, "duration billing expressions"),
			PerMinutePricing:    capability(CapabilityUnsupported, "no per-minute unit"),
			DeploymentPricing:   capability(CapabilityUnsupported, "no deployment dimension"),
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
		AuthType:            "api_key",
		SourceDocumentation: "/api/v1/models",
		SyncFrequency:       "scheduler 1m; channel cadence model 6h / official 24h / channel 1h",
		Capabilities: UpstreamProviderCapabilities{
			ModelDiscovery:      capability(CapabilitySupported, "paginated /api/v1/models"),
			ModelMetadata:       capability(CapabilitySupported, "catalog metadata and capabilities"),
			OfficialPricing:     capability(CapabilitySupported, "official catalog prices with regions and units"),
			ChannelPricing:      capability(CapabilityNeedsConfiguration, "depends on the contracted workspace and region"),
			DiscountInformation: capability(CapabilityUnsupported, "no supplier discount feed"),
			RegionPricing:       capability(CapabilitySupported, "region comes from the workspace endpoint"),
			TieredPricing:       capability(CapabilityPartial, "price ranges are preserved and flagged for review"),
			MediaPricing:        capability(CapabilityPartial, "image/video/audio price items when present"),
			ScheduledSync:       capability(CapabilitySupported, "background catalog sync"),
			TokenPricing:        capability(CapabilitySupported, "official catalog token prices"),
			ImagePricing:        capability(CapabilityPartial, "per-image catalog items"),
			VideoPricing:        capability(CapabilityPartial, "catalog items; per-second only when published"),
			AudioPricing:        capability(CapabilityPartial, "audio catalog items when present"),
			PerCallPricing:      capability(CapabilityPartial, "per-call catalog items"),
			PerSecondPricing:    capability(CapabilityPartial, "only when the catalog publishes a per-second item"),
			PerMinutePricing:    capability(CapabilityUnsupported, "no per-minute unit"),
			DeploymentPricing:   capability(CapabilityNeedsConfiguration, "deployment prices require the contracted workspace"),
		},
	}
}

func (bailianAdapter) Fetch(ctx context.Context, cfg UpstreamFetchConfig) (any, error) {
	return FetchBailianCatalog(ctx, cfg.BaseURL, cfg.APIKey)
}

// manualPricingProviders have no supplier-level price API that Uter may call
// with a channel credential. They stay registered so the UI can state that
// pricing is manual instead of presenting a fake sync success.
var manualPricingProviders = []UpstreamProvider{
	{ID: "openai", Name: "OpenAI", AuthType: "api_key", Capabilities: manualCapabilities("OpenAI")},
	{ID: "anthropic", Name: "Anthropic", AuthType: "api_key", Capabilities: manualCapabilities("Anthropic")},
	{ID: "google-gemini", Name: "Google Gemini", AuthType: "api_key", Capabilities: manualCapabilities("Google Gemini")},
	{ID: "microsoft-azure", Name: "Microsoft Azure", AuthType: "api_key", Capabilities: manualCapabilities("Azure OpenAI")},
	{ID: "aws-bedrock", Name: "AWS Bedrock", AuthType: "aws_sigv4", Capabilities: manualCapabilities("AWS Bedrock")},
	{ID: "tencent-hunyuan", Name: "腾讯云", AuthType: "api_key", Capabilities: manualCapabilities("腾讯云")},
	{ID: "volcengine", Name: "火山引擎", AuthType: "api_key", Capabilities: manualCapabilities("火山引擎")},
	{ID: "apiko", Name: "Apiko", AuthType: "api_key", Capabilities: manualCapabilities("Apiko")},
}

func manualCapabilities(name string) UpstreamProviderCapabilities {
	return UpstreamProviderCapabilities{
		ModelDiscovery:      capability(CapabilitySupported, name+" model list comes from the channel adapter"),
		ModelMetadata:       capability(CapabilityPartial, "official metadata may need manual import"),
		OfficialPricing:     capability(CapabilityManualOnly, "no authorized supplier price API"),
		ChannelPricing:      capability(CapabilityManualOnly, "enter the contracted quote manually"),
		DiscountInformation: capability(CapabilityManualOnly, "contract discount must be entered manually"),
		RegionPricing:       capability(CapabilityNeedsConfiguration, "region-specific price requires manual input"),
		TieredPricing:       capability(CapabilityManualOnly, "tiered prices must be entered as an operator rule"),
		MediaPricing:        capability(CapabilityManualOnly, "media prices must be entered manually"),
		ScheduledSync:       capability(CapabilityUnsupported, "no price source to schedule"),
		TokenPricing:        capability(CapabilityManualOnly, "enter token prices manually"),
		ImagePricing:        capability(CapabilityManualOnly, "enter image prices manually"),
		VideoPricing:        capability(CapabilityManualOnly, "enter video prices manually"),
		AudioPricing:        capability(CapabilityManualOnly, "enter audio prices manually"),
		PerCallPricing:      capability(CapabilityManualOnly, "enter per-call prices manually"),
		PerSecondPricing:    capability(CapabilityManualOnly, "enter per-second prices manually"),
		PerMinutePricing:    capability(CapabilityManualOnly, "enter per-minute prices manually"),
		DeploymentPricing:   capability(CapabilityManualOnly, "enter deployment prices manually"),
	}
}

type manualProviderAdapter struct {
	provider UpstreamProvider
}

func (m manualProviderAdapter) Descriptor() UpstreamProvider { return m.provider }

func (m manualProviderAdapter) Fetch(context.Context, UpstreamFetchConfig) (any, error) {
	return nil, errors.New("this provider has no authorized price API; enter its prices manually")
}
