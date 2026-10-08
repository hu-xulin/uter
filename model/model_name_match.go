package model

import (
	"strings"
)

// modelNameMatchSeparator is the normalized boundary character used for tolerant
// comparison. Real model names use '-', '_', '.', '/', '|' and spaces as
// separators; collapsing them all to one token lets a single boundary check
// catch every variant (e.g. "gpt-4o" vs "gpt_4o" vs "gpt.4o").
const modelNameMatchSeparator = ":"

// normalizeModelMatchName lowercases and collapses every separator into the
// single normalized boundary character so comparisons ignore separator style.
func normalizeModelMatchName(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	if s == "" {
		return ""
	}
	var b strings.Builder
	b.Grow(len(s))
	prevSep := false
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch c {
		case '-', '_', '.', '/', '|', ' ', '\\':
			if !prevSep {
				b.WriteByte(modelNameMatchSeparator[0])
				prevSep = true
			}
		default:
			b.WriteByte(c)
			prevSep = false
		}
	}
	return strings.Trim(b.String(), modelNameMatchSeparator)
}

// matchCatalogKey indexes a set of catalog model names so MatchCatalogModelName
// can be reused across many queries without re-normalizing every time.
type matchCatalogKey struct {
	original   string
	normalized string
}

// NewModelNameMatchCatalog builds a reusable matcher over a set of known catalog
// model names. Channel names are matched against this catalog to recover the
// canonical model name when the channel attaches irregular suffixes
// (e.g. "gpt-4o-2024-05-13" -> "gpt-4o").
func NewModelNameMatchCatalog(catalogKeys []string) *ModelNameMatchCatalog {
	entries := make([]matchCatalogKey, 0, len(catalogKeys))
	for _, key := range catalogKeys {
		normalized := normalizeModelMatchName(key)
		if normalized == "" {
			continue
		}
		entries = append(entries, matchCatalogKey{original: key, normalized: normalized})
	}
	return &ModelNameMatchCatalog{entries: entries}
}

// ModelNameMatchCatalog is a reusable index of catalog model names.
type ModelNameMatchCatalog struct {
	entries []matchCatalogKey
}

// Match resolves a (possibly suffixed) channel model name to a catalog key.
//
// The matching is deliberately robust against the way upstream channels name
// models: the base model name sits at the front and is followed by irregular
// suffixes (dates, versions, regions, provider prefixes). Resolution order:
//
//  1. Exact (case/separator-insensitive) match — always preferred.
//  2. Prefix match: the catalog key is a full-token prefix of the query
//     (e.g. "gpt-4o" matches "gpt-4o-2024-05-13"). Longest key wins so
//     "gpt-4o-mini" beats "gpt-4o" for "gpt-4o-mini-2024".
//  3. Reverse prefix: the query is a full-token prefix of the catalog key
//     (e.g. channel sends the clean "gpt-4o" while the catalog keeps the
//     versioned "gpt-4o-2024-05-13"). Longest key still wins.
//  4. Bounded containment: the catalog key appears as a whole token inside the
//     query (covers provider-prefixed names like "azure-gpt-4o").
//
// Boundary checks (a separator or the string end must follow the matched key)
// prevent collisions such as "gpt-4" matching "gpt-40", so the matcher stays
// safe to apply broadly.
func (c *ModelNameMatchCatalog) Match(query string) (string, bool) {
	norm := normalizeModelMatchName(query)
	if norm == "" {
		return "", false
	}
	var exact string
	var best string
	bestLen := -1
	for _, entry := range c.entries {
		if entry.normalized == norm {
			exact = entry.original
			continue
		}
		// Full-token prefix in either direction: key+sep or query+sep.
		if strings.HasPrefix(norm, entry.normalized+modelNameMatchSeparator) ||
			strings.HasPrefix(entry.normalized, norm+modelNameMatchSeparator) {
			if len(entry.normalized) > bestLen {
				best = entry.original
				bestLen = len(entry.normalized)
			}
			continue
		}
		// Bounded token containment: ":key:" inside ":query:".
		if strings.Contains(modelNameMatchSeparator+norm+modelNameMatchSeparator,
			modelNameMatchSeparator+entry.normalized+modelNameMatchSeparator) {
			if len(entry.normalized) > bestLen {
				best = entry.original
				bestLen = len(entry.normalized)
			}
		}
	}
	if exact != "" {
		return exact, true
	}
	if best != "" {
		return best, true
	}
	return "", false
}

// MatchCatalogModelName is a convenience wrapper that builds a one-off catalog
// from the supplied keys and resolves a single query. Prefer
// NewModelNameMatchCatalog when the same catalog is matched against many names.
func MatchCatalogModelName(query string, catalogKeys []string) (string, bool) {
	return NewModelNameMatchCatalog(catalogKeys).Match(query)
}
