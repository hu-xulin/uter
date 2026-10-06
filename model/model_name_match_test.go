package model

import (
	"testing"
)

// catalogClean mirrors the real autofill catalogs: the canonical (clean) model
// name is stored, and channel names arrive with irregular suffixes appended.
var catalogClean = []string{
	"gpt-4o",
	"gpt-4o-mini",
	"gpt-4",
	"claude-3-5-sonnet",
	"gemini-1.5-pro",
}

func TestModelNameMatchCatalog(t *testing.T) {
	tests := []struct {
		name   string
		query  string
		want   string
		wantOK bool
	}{
		// 1) exact, separator- and case-insensitive
		{"exact match", "gpt-4o", "gpt-4o", true},
		{"underscore separator", "gpt_4o", "gpt-4o", true},
		{"case insensitivity", "GPT-4O", "gpt-4o", true},
		{"dot separator", "gpt.4o", "gpt-4o", true},

		// 2) channel suffix after the base model name
		{"suffix date", "gpt-4o-2024-05-13", "gpt-4o", true},
		{"suffix region", "claude-3-5-sonnet-us-east", "claude-3-5-sonnet", true},

		// 3) longest key wins (gpt-4o-mini beats gpt-4o for a mini query)
		{"longest prefix wins", "gpt-4o-mini-2024-07-18", "gpt-4o-mini", true},

		// 4) bounded containment (provider-prefixed channel name)
		{"provider prefix", "azure-gpt-4o", "gpt-4o", true},
		{"provider prefix slash", "openai/gpt-4o", "gpt-4o", true},

		// 5) boundary safety: gpt-4 must NOT match gpt-40
		{"boundary safety gpt-4 vs gpt-40", "gpt-40", "", false},
		{"boundary safety exact gpt-4", "gpt-4", "gpt-4", true},

		// 6) unknown / empty
		{"unknown", "some-unknown-model", "", false},
		{"empty", "", "", false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := NewModelNameMatchCatalog(catalogClean).Match(tc.query)
			if ok != tc.wantOK {
				t.Fatalf("Match(%q) ok = %v, want %v", tc.query, ok, tc.wantOK)
			}
			if ok && got != tc.want {
				t.Fatalf("Match(%q) = %q, want %q", tc.query, got, tc.want)
			}
		})
	}
}

// TestModelNameMatchCatalogReversePrefix covers the case where the catalog keeps
// the versioned full name and the channel sends the clean base name.
func TestModelNameMatchCatalogReversePrefix(t *testing.T) {
	catalog := []string{"claude-3-5-sonnet-20241022"}
	got, ok := NewModelNameMatchCatalog(catalog).Match("claude-3-5-sonnet")
	if !ok || got != "claude-3-5-sonnet-20241022" {
		t.Fatalf("reverse prefix Match = (%q,%v), want (claude-3-5-sonnet-20241022,true)", got, ok)
	}
}

func TestMatchCatalogModelNameConvenience(t *testing.T) {
	got, ok := MatchCatalogModelName("gpt-4o-2024-05-13", []string{"gpt-4", "gpt-4o"})
	if !ok || got != "gpt-4o" {
		t.Fatalf("MatchCatalogModelName = (%q,%v), want (gpt-4o,true)", got, ok)
	}
}
