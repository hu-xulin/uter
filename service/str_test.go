package service

import (
	"reflect"
	"strings"
	"testing"
)

func TestSundaySearch(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		text    string
		pattern string
		want    bool
	}{
		{name: "match at start", text: "uter governance", pattern: "uter", want: true},
		{name: "match at end", text: "uter governance", pattern: "governance", want: true},
		{name: "no match", text: "uter governance", pattern: "missing", want: false},
		{name: "pattern longer than text", text: "uter", pattern: "governance", want: false},
		{name: "empty pattern", text: "uter", pattern: "", want: true},
		{name: "empty text and pattern", text: "", pattern: "", want: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := SundaySearch(tt.text, tt.pattern); got != tt.want {
				t.Fatalf("SundaySearch(%q, %q) = %v, want %v", tt.text, tt.pattern, got, tt.want)
			}
		})
	}
}

func TestACKeyNormalizesAndSortsDictionary(t *testing.T) {
	t.Parallel()

	if got := acKey(nil); got != "" {
		t.Fatalf("acKey(nil) = %q, want empty", got)
	}
	if got := acKey([]string{" ", "\t"}); got != "" {
		t.Fatalf("acKey(blank words) = %q, want empty", got)
	}

	got := acKey([]string{" B ", "a", "A"})
	want := acKey([]string{"b", "a"})
	if got == "" || got != want {
		t.Fatalf("normalized keys differ: got %q, want %q", got, want)
	}
}

func TestReadRunesTrimsAndLowercases(t *testing.T) {
	t.Parallel()

	got := readRunes([]string{" Uter ", "GOVERNANCE"})
	want := [][]rune{[]rune("uter"), []rune("governance")}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("readRunes() = %#v, want %#v", got, want)
	}
}

func TestInitAcAndAcSearch(t *testing.T) {
	t.Parallel()

	dict := []string{"apple", "banana"}
	if machine := InitAc(dict); machine == nil {
		t.Fatal("InitAc returned nil for a non-empty valid dictionary")
	}

	found, words := AcSearch("I like apple and banana", dict, false)
	if !found {
		t.Fatal("AcSearch did not find known dictionary words")
	}
	joined := strings.Join(words, ",")
	if !strings.Contains(joined, "apple") || !strings.Contains(joined, "banana") {
		t.Fatalf("AcSearch returned %v; expected both apple and banana", words)
	}

	found, words = AcSearch("I like apple and banana", dict, true)
	if !found || len(words) == 0 {
		t.Fatalf("stopImmediately search = (%v, %v), want a hit", found, words)
	}
}

func TestAcSearchEmptyAndUnmatchedInputs(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name string
		text string
		dict []string
	}{
		{name: "empty dictionary", text: "uter", dict: nil},
		{name: "empty text", text: "", dict: []string{"uter"}},
		{name: "blank dictionary", text: "uter", dict: []string{" ", "\t"}},
		{name: "unmatched text", text: "governance", dict: []string{"payment"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			found, words := AcSearch(tc.text, tc.dict, false)
			if found || len(words) != 0 {
				t.Fatalf("AcSearch(%q, %v) = (%v, %v), want no match", tc.text, tc.dict, found, words)
			}
		})
	}
}

func TestGetOrBuildACCachesNormalizedDictionary(t *testing.T) {
	t.Parallel()

	first := getOrBuildAC([]string{" UTER-COVERAGE-CACHE-A ", "UTER-COVERAGE-CACHE-B"})
	if first == nil {
		t.Fatal("getOrBuildAC returned nil for a valid dictionary")
	}
	second := getOrBuildAC([]string{"uter-coverage-cache-b", "uter-coverage-cache-a"})
	if first != second {
		t.Fatal("equivalent normalized dictionaries should reuse the cached machine")
	}
}
