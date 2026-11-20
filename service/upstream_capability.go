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
)

// UpstreamProviderForChannel resolves a channel to a provider capability
// descriptor. Unknown channels still receive an explicit capability matrix
// instead of a blanket "supported" flag.
func UpstreamProviderForChannel(channelType int, baseURL string) UpstreamProvider {
	id := ""
	switch {
	case channelType == 17:
		id = "alibaba-bailian"
	case strings.Contains(strings.ToLower(baseURL), "dreamrouter.ai"):
		id = "dreamrouter"
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
