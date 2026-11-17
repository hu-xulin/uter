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

// HasTaskPart reports whether the plugin is a task driver: it exports
// buildSubmitRequest.
func (m Meta) HasTaskPart() bool {
	return !m.noTaskPart
}

// HasProviderPart reports whether the plugin declares relay routes.
func (m Meta) HasProviderPart() bool {
	return len(m.Relay) > 0
}

// ChannelRelayConfig is RelayConfig for a channel: an upstream_path that
// starts with {config.<name>} starts with that address of the channel's plugin
// config instead, or is relative to the channel base URL when the address is
// empty. config is the config as ChannelConfigFor returns it.
func (m Meta) ChannelRelayConfig(config []byte) *dto.AdvancedCustomConfig {
	relay := m.RelayConfig()
	if relay == nil {
		return nil
	}
	for index, route := range relay.Routes {
		name, rest, ok := configAddressPath(route.UpstreamPath)
		if !ok {
			continue
		}
		address := ChannelConfigURL(config, name)
		if address == "" && rest == "" {
			rest = "/"
		}
		relay.Routes[index].UpstreamPath = address + rest
	}
	return relay
}

// configAddressPath splits an upstream_path of the form {config.<name>}<rest>.
func configAddressPath(upstreamPath string) (name, rest string, ok bool) {
	trimmed := strings.TrimSpace(upstreamPath)
	if !strings.HasPrefix(trimmed, configAddressPrefix) {
		return "", "", false
	}
	name, rest, ok = strings.Cut(trimmed[len(configAddressPrefix):], "}")
	return name, rest, ok
}

const configAddressPrefix = "{config."

// RelayRoute returns the relay route serving requestPath for model, with the
// converter as the manifest declares it.
func (m Meta) RelayRoute(requestPath, model string) (dto.AdvancedCustomRoute, bool) {
	config := dto.AdvancedCustomConfig{Routes: m.Relay}
	return config.MatchPathForModel(requestPath, model)
}

// RelaysModel reports whether a relay route accepts model for client
// requests: the plugin serves the model on chat paths, not only as a task. The
// model list and balance routes accept every model and serve none.
func (m Meta) RelaysModel(model string) bool {
	return slices.ContainsFunc(m.Relay, func(route dto.AdvancedCustomRoute) bool {
		path := strings.TrimSpace(route.IncomingPath)
		return path != dto.AdvancedCustomModelListPath && path != dto.AdvancedCustomBalancePath && route.AcceptsModel(model)
	})
}

// ServesResponsesWebSocket reports whether a Responses WebSocket session for
// model may run on the relay routes: the /v1/responses route serving it has no
// converter, so the session forwards native events as Advanced Custom does.
// An empty model asks whether any route of that path qualifies.
func (m Meta) ServesResponsesWebSocket(model string) bool {
	if model == "" {
		return slices.ContainsFunc(m.Relay, func(route dto.AdvancedCustomRoute) bool {
			config := dto.AdvancedCustomConfig{Routes: []dto.AdvancedCustomRoute{route}}
			_, ok := config.MatchPath(responsesPath)
			return ok && route.IsNative()
		})
	}
	route, ok := m.RelayRoute(responsesPath, model)
	return ok && route.IsNative()
}

const responsesPath = "/v1/responses"

// ModelListRoute returns the /v1/models relay route, with the converter as the
// manifest declares it.
func (m Meta) ModelListRoute() (dto.AdvancedCustomRoute, bool) {
	config := dto.AdvancedCustomConfig{Routes: m.Relay}
	return config.ModelListRoute()
}
