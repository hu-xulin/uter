package service

import (
	"strings"

	"github.com/uter-ai/uter/pkg/billingexpr"
)

const (
	UpstreamExpressionExecutable  = "EXECUTABLE"
	UpstreamExpressionUnsupported = "UNSUPPORTED"
	UpstreamExpressionMissing     = "MISSING"
)

// UpstreamExpression is the normalized result of an upstream billing rule.
// Raw is always retained; Executable means Uter's own engine compiled it and
// can execute it without rewriting its semantics.
type UpstreamExpression struct {
	Raw        string `json:"raw"`
	Hash       string `json:"hash,omitempty"`
	Status     string `json:"status"`
	Error      string `json:"error,omitempty"`
	Executable bool   `json:"executable"`
}

// NormalizeUpstreamExpression validates a New API-style billing
// expression with Uter's billing engine. Unsupported syntax is never reduced
// to a flat token price.
func NormalizeUpstreamExpression(raw string) UpstreamExpression {
	expr := strings.TrimSpace(raw)
	if expr == "" {
		return UpstreamExpression{Status: UpstreamExpressionMissing}
	}
	hash := billingexpr.ExprHashString(expr)
	if _, err := billingexpr.CompileFromCacheByHash(expr, hash); err != nil {
		return UpstreamExpression{Raw: expr, Hash: hash, Status: UpstreamExpressionUnsupported, Error: err.Error()}
	}
	return UpstreamExpression{Raw: expr, Hash: hash, Status: UpstreamExpressionExecutable, Executable: true}
}
