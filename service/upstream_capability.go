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
	"strings"

	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
)

// UpstreamProviderForChannel resolves a channel to a provider capability
// descriptor. Unknown channels still receive an explicit capability matrix
// instead of a blanket "supported" flag.
func UpstreamProviderForChannel(channelType int, baseURL string) UpstreamProvider {
	id := ""
	switch {
	// A Uter channel is Uter's own upstream contract even when its Base URL
	// points at a DreamRouter-compatible relay. Its price dimensions are fully
	// supported by Uter's own pricing engine.
	case channelType == constant.ChannelTypeUter:
		return uterProviderDescriptor()
	case IsDreamRouterHost(baseURL):
		id = "dreamrouter"
	case channelType == constant.ChannelTypeAli:
		id = "alibaba-bailian"
	case MatchesUpstreamHost(baseURL, "apiko.app"):
		return apikoUpstreamDescriptor()
	default:
		id = manualUpstreamProviderForHost(baseURL)
	}
	if id != "" {
		for _, provider := range UpstreamProviders() {
			if provider.ID == id {
				return provider
			}
		}
	}
	return UpstreamProvider{
		ID:       "newapi-compatible",
		Name:     "New API compatible",
		AuthType: "api_key",
		Capabilities: UpstreamProviderCapabilities{
			ModelDiscovery:      capability(CapabilitySupported, "GET /v1/models"),
			ModelMetadata:       capability(CapabilityPartial, "model IDs; metadata comes from the shared catalog"),
			OfficialPricing:     capability(CapabilityPartial, "only if /api/pricing exposes official_price or official_ratio"),
			ChannelPricing:      capability(CapabilityPartial, "only if /api/pricing exposes ratios or model_price"),
			DiscountInformation: capability(CapabilityPartial, "group ratios when published"),
			RegionPricing:       capability(CapabilityUnsupported, "no region dimension"),
			TieredPricing:       capability(CapabilityPartial, "billing_expr is preserved; unparsable tiers need review"),
			MediaPricing:        capability(CapabilityPartial, "per-call prices when published"),
			ScheduledSync:       capability(CapabilityNeedsConfiguration, "configure the channel sync schedule"),
			TokenPricing:        capability(CapabilityPartial, "ratios or absolute prices when published"),
			ImagePricing:        capability(CapabilityPartial, "per-call prices when published"),
			VideoPricing:        capability(CapabilityPartial, "only when the pricing document publishes it"),
			AudioPricing:        capability(CapabilityPartial, "only when the pricing document publishes it"),
			PerCallPricing:      capability(CapabilityPartial, "model_price"),
			PerSecondPricing:    capability(CapabilityPartial, "only through billing_expr"),
			PerMinutePricing:    capability(CapabilityUnsupported, "no per-minute unit"),
			DeploymentPricing:   capability(CapabilityUnsupported, "no deployment dimension"),
		},
	}
}

// uterProviderDescriptor describes Uter's own upstream. Unlike third-party
// gateways, every supported billing dimension has a native Uter price column,
// so the capability matrix must not fall back to the conservative New API
// "partial" wording.
func uterProviderDescriptor() UpstreamProvider {
	return UpstreamProvider{
		ID: "uter", Name: "Uter.ai", AuthType: "api_key",
		PricingURL: "/api/pricing", ModelsURL: "/v1/models",
		SourceDocumentation: "/api/pricing",
		SyncFrequency:       "scheduler 1m; channel cadence model 6h / official 24h / channel 1h",
		Capabilities: UpstreamProviderCapabilities{
			ModelDiscovery:      capability(CapabilitySupported, "GET /v1/models"),
			ModelMetadata:       capability(CapabilitySupported, "model catalog and capabilities"),
			OfficialPricing:     capability(CapabilitySupported, "Uter /api/pricing official prices"),
			ChannelPricing:      capability(CapabilitySupported, "per-channel quote or manual price"),
			DiscountInformation: capability(CapabilitySupported, "group and model discounts"),
			RegionPricing:       capability(CapabilitySupported, "regional channel endpoints"),
			TieredPricing:       capability(CapabilitySupported, "tiered price ranges are preserved"),
			MediaPricing:        capability(CapabilitySupported, "token, call, second and minute media prices"),
			ScheduledSync:       capability(CapabilitySupported, "background catalog sync"),
			TokenPricing:        capability(CapabilitySupported, "per-1M token input, output and cache prices"),
			ImagePricing:        capability(CapabilitySupported, "per-image or per-call image prices"),
			VideoPricing:        capability(CapabilitySupported, "per-second or per-call video prices"),
			AudioPricing:        capability(CapabilitySupported, "token, per-call or duration audio prices"),
			PerCallPricing:      capability(CapabilitySupported, "fixed price per request"),
			PerSecondPricing:    capability(CapabilitySupported, "duration-based task billing"),
			PerMinutePricing:    capability(CapabilitySupported, "stored per minute and normalized to seconds"),
			DeploymentPricing:   capability(CapabilitySupported, "deployment price estimation via /api/deployments/price-estimation"),
		},
	}
}

// ChannelPricingIdentityForRequest builds the full identity a request is billed
// under. The provider comes from the channel capability (host-aware), and the
// region from the Bailian workspace endpoint; the caller passes the deployment
// selected by routing (or an explicit empty value when the channel has none).
func ChannelPricingIdentityForRequest(channelType int, baseURL, deploymentID, modelName string) model.ChannelPricingIdentity {
	provider := UpstreamProviderForChannel(channelType, baseURL).ID
	region := ""
	if provider == "alibaba-bailian" {
		// Only a recognised workspace/intl/generic Beijing host yields a
		// region; an unknown DashScope host must not default to Beijing and
		// silently select that region's price.
		if _, parsed, ok := ParseBailianWorkspace(baseURL); ok {
			region = string(parsed)
		}
	}
	return model.ChannelPricingIdentity{
		ChannelId:    0,
		Provider:     provider,
		Region:       region,
		DeploymentId: strings.TrimSpace(deploymentID),
		ModelName:    strings.TrimSpace(modelName),
	}
}
