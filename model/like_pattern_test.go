package model

import "testing"

// A keyword of "%" reaching a search that wraps it as "%"+keyword+"%" turns the
// query into a full-table scan; "_" silently widens every match. Both have to
// be escaped (or rejected) before the pattern is used.
func TestLikeContainsEscapesWildcards(t *testing.T) {
	got, err := likeContains("a_b")
	if err != nil {
		t.Fatalf("likeContains returned error: %v", err)
	}
	if got != "%a!_b%" {
		t.Fatalf("likeContains = %q, want %q", got, "%a!_b%")
	}
}

func TestLikeContainsEscapesEscapeCharacter(t *testing.T) {
	got, err := likeContains("a!b")
	if err != nil {
		t.Fatalf("likeContains returned error: %v", err)
	}
	if got != "%a!!b%" {
		t.Fatalf("likeContains = %q, want %q", got, "%a!!b%")
	}
}

func TestLikeContainsRejectsBareWildcardKeyword(t *testing.T) {
	if _, err := likeContains("%"); err == nil {
		t.Fatal("a keyword of % must be rejected instead of matching everything")
	}
}

func TestLikeContainsKeepsBoundedCallerWildcard(t *testing.T) {
	got, err := likeContains("ab%")
	if err != nil {
		t.Fatalf("likeContains returned error: %v", err)
	}
	if got != "%ab%%" {
		t.Fatalf("likeContains = %q, want %q", got, "%ab%%")
	}
}
