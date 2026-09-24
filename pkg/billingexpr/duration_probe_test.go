package billingexpr

import (
	"testing"
)

// TestDurationVariableSupported verifies that the `duration` variable is a
// first-class billing variable: it compiles, runs against a supplied duration,
// and falls back to zero when no duration is provided. This guards the fix for
// upstream-synced pricing expressions such as `tier("base", duration * 0.13)`
// that previously failed with "invalid operation: <nil> * float64".
func TestDurationVariableSupported(t *testing.T) {
	exprStr := `tier("base", duration * 0.13)`

	// 1) It must compile without an "unknown name" error.
	if _, err := CompileFromCache(exprStr); err != nil {
		t.Fatalf("compile failed: %v", err)
	}

	// 2) With an explicit duration it should evaluate and use the value.
	dur := 10.0
	out, _, err := RunExprWithRequest(exprStr, TokenParams{}, RequestInput{Duration: &dur})
	if err != nil {
		t.Fatalf("run with duration failed: %v", err)
	}
	want := 10.0 * 0.13
	if out != want {
		t.Fatalf("duration not applied: got %v want %v", out, want)
	}

	// 3) With nil duration it falls back to zero (no nil-pointer crash).
	out, _, err = RunExprWithRequest(exprStr, TokenParams{}, RequestInput{})
	if err != nil {
		t.Fatalf("run with nil duration failed: %v", err)
	}
	if out != 0 {
		t.Fatalf("expected 0 for nil duration, got %v", out)
	}
}
