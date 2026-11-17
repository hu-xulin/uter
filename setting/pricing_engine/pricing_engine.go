package pricing_engine

import "strings"

// The two pricing stacks Uter ships. Uter's own stack keeps its expression,
// plugin and cost-optimization behavior; the upstream stack applies the newer
// upstream rules while reading the same option values.
const (
	EngineUter     = "uter"
	EngineUpstream = "upstream"
)

var globalEngine = EngineUter

// SetGlobal records the instance default; unknown values keep Uter's stack.
func SetGlobal(engine string) {
	switch Normalize(engine) {
	case EngineUpstream:
		globalEngine = EngineUpstream
	default:
		globalEngine = EngineUter
	}
}

// Global is the instance default engine.
func Global() string {
	return globalEngine
}

// Normalize maps a stored value to a known engine, empty when it names none.
func Normalize(engine string) string {
	switch strings.ToLower(strings.TrimSpace(engine)) {
	case EngineUter:
		return EngineUter
	case EngineUpstream:
		return EngineUpstream
	default:
		return ""
	}
}

// Resolve returns the engine a channel uses: its own override, else the
// instance default.
func Resolve(channelOverride string) string {
	if engine := Normalize(channelOverride); engine != "" {
		return engine
	}
	return globalEngine
}

// UsesUpstream reports whether a channel bills with the upstream stack.
func UsesUpstream(channelOverride string) bool {
	return Resolve(channelOverride) == EngineUpstream
}
