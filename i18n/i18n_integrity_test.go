package i18n

import (
	"bytes"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestAllKeysResolveInAllLanguages(t *testing.T) {
	if err := Init(); err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	// Read the en.yaml source from the embedded FS to get the canonical key set.
	data, err := localeFS.ReadFile("locales/en.yaml")
	if err != nil {
		t.Fatalf("cannot read embedded en.yaml: %v", err)
	}
	var doc map[string]any
	if err := yaml.Unmarshal(data, &doc); err != nil {
		t.Fatalf("cannot parse embedded en.yaml: %v", err)
	}
	allKeys := make([]string, 0, len(doc))
	for k := range doc {
		allKeys = append(allKeys, k)
	}
	if len(allKeys) == 0 {
		t.Fatal("no keys collected")
	}

	langs := SupportedLanguages()
	totalProblems := 0
	for _, lang := range langs {
		for _, k := range allKeys {
			msg := Translate(lang, k)
			if msg == k {
				t.Errorf("[%s] key %s returned raw key (missing translation)", lang, k)
				totalProblems++
			}
			if strings.Contains(msg, "{{") {
				t.Errorf("[%s] key %s unresolved placeholder: %s", lang, k, msg)
				totalProblems++
			}
		}
	}
	t.Logf("checked %d keys x %d langs = %d lookups, problems=%d", len(allKeys), len(langs), len(allKeys)*len(langs), totalProblems)
	if totalProblems > 0 {
		t.Fatalf("integrity problems found: %d", totalProblems)
	}
}

// ensure bytes import used
var _ = bytes.MinRead
