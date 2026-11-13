package jsplugin

import (
	"slices"
	"strings"

	"github.com/uter-ai/uter/relaykit/dto"
)

// ProviderConverter is the converter of a route that the plugin itself
// serves: the host runs no other converter for it.
const ProviderConverter = "plugin"

// chainedConverterSuffix marks a converter that runs the plugin's convert
// hooks after the converter it names.
const chainedConverterSuffix = "+" + ProviderConverter

// SplitProviderConverter returns the converter the host runs for a route
// converter and whether the plugin's convert hooks run too: "plugin" is "none"
// with the hooks, "<converter>+plugin" that converter with the hooks, and any
// other value itself without them.
func SplitProviderConverter(converter string) (hostConverter string, hooks bool) {
	converter = strings.TrimSpace(converter)
	if converter == ProviderConverter {
		return "none", true
	}
	if base, chained := strings.CutSuffix(converter, chainedConverterSuffix); chained {
		return base, true
	}
	return converter, false
}

// cloneRelayRoutes copies the routes so a caller may change them without
// changing the ones the plugin declared.
func cloneRelayRoutes(routes []dto.AdvancedCustomRoute) []dto.AdvancedCustomRoute {
	if routes == nil {
		return nil
	}
	cloned := make([]dto.AdvancedCustomRoute, len(routes))
	for index, route := range routes {
		route.Models = slices.Clone(route.Models)
		if route.Auth != nil {
			auth := *route.Auth
			route.Auth = &auth
		}
		cloned[index] = route
	}
	return cloned
}

// RelayConfig returns the relay routes as the Advanced Custom configuration
// of one request. A plugin-converter route reaches the Advanced Custom code as
// a native route of its client protocol, and a chained one as a route of its
// registered converter; the provider adaptor converts around it.
func (m Meta) RelayConfig() *dto.AdvancedCustomConfig {
	if len(m.Relay) == 0 {
		return nil
	}
	routes := cloneRelayRoutes(m.Relay)
	for index := range routes {
		if converter, hooks := SplitProviderConverter(routes[index].Converter); hooks {
			routes[index].Converter = converter
		}
	}
	return &dto.AdvancedCustomConfig{Routes: routes}
}

// HasProviderPart reports whether the plugin declares relay routes.
func (m Meta) HasProviderPart() bool {
	return len(m.Relay) > 0
}
