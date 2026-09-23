package billingexpr

import (
	"testing"

	"github.com/expr-lang/expr"
)

func TestProbeDurationIdentifier(t *testing.T) {
	exprStr := `tier("base", duration * 0.13)`
	// Mimic compile.go: compile with the v1 prototype env and AsFloat64.
	_, err := expr.Compile(exprStr, expr.Env(compileEnvPrototypeV1), expr.AsFloat64())
	t.Logf("compile error (nil means OK): %v", err)

	// Now try Run with a runtime env that has NO duration key.
	prog, cerr := expr.Compile(exprStr, expr.Env(compileEnvPrototypeV1), expr.AsFloat64())
	if cerr != nil {
		t.Logf("compile failed, cannot run: %v", cerr)
		return
	}
	// build a runtime env like runProgram but without "duration"
	env := map[string]any{
		"p":     float64(0),
		"c":     float64(0),
		"len":   float64(0),
		"tier":  func(string, float64) float64 { return 0 },
		"max":   func(a, b float64) float64 { if a > b { return a }; return b },
		"min":   func(a, b float64) float64 { if a < b { return a }; return b },
		"abs":   func(float64) float64 { return 0 },
		"ceil":  func(float64) float64 { return 0 },
		"floor": func(float64) float64 { return 0 },
	}
	_, rerr := expr.Run(prog, env)
	t.Logf("run error (nil means OK): %v", rerr)
}
