package billingexpr

import (
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/uter-ai/uter/relaykit/dto"

	"github.com/expr-lang/expr"
	"github.com/expr-lang/expr/vm"
	"github.com/tidwall/gjson"
)

// RunExpr compiles (with cache) and executes an expression string.
// The environment exposes:
//   - p, c             — prompt / completion tokens (auto-excluding separately-priced sub-categories)
//   - len              — total input context length for tier conditions (never reduced by sub-category exclusion)
//   - cr, cc, cc1h, cc12h — cache read / creation / creation-1h / creation-12h tokens
//   - tier(name, value) — trace callback that records which tier matched
//   - max, min, abs, ceil, floor — standard math helpers
//
// Returns the resulting float64 quota (before group ratio) and a TraceResult
// with side-channel info captured by tier() during execution.
func RunExpr(exprStr string, params TokenParams) (float64, TraceResult, error) {
	return RunExprWithRequest(exprStr, params, RequestInput{})
}

func RunExprWithRequest(exprStr string, params TokenParams, request RequestInput) (float64, TraceResult, error) {
	entry, err := compileEntryFromCacheByHash(exprStr, ExprHashString(exprStr))
	if err != nil {
		return 0, TraceResult{}, err
	}
	return runProgram(entry.prog, entry.requestRules, entry.usedVars, params, request)
}

// RunExprByHash is like RunExpr but accepts a pre-computed hash for the cache
// lookup, avoiding a redundant SHA-256 computation when the caller already
// holds BillingSnapshot.ExprHash.
func RunExprByHash(exprStr, hash string, params TokenParams) (float64, TraceResult, error) {
	return RunExprByHashWithRequest(exprStr, hash, params, RequestInput{})
}

func RunExprByHashWithRequest(exprStr, hash string, params TokenParams, request RequestInput) (float64, TraceResult, error) {
	entry, err := compileEntryFromCacheByHash(exprStr, hash)
	if err != nil {
		return 0, TraceResult{}, err
	}
	return runProgram(entry.prog, entry.requestRules, entry.usedVars, params, request)
}

func runProgram(prog *vm.Program, requestRules []RequestRuleTrace, usedVars map[string]bool, params TokenParams, request RequestInput) (float64, TraceResult, error) {
	trace := TraceResult{
		BillingUnit:  BillingUnitToken,
		RequestRules: append([]RequestRuleTrace(nil), requestRules...),
	}
	headers := normalizeHeaders(request.Headers)
	imageCount := 1
	if usedVars["image_count"] {
		if request.ImageCount != nil {
			imageCount = *request.ImageCount
		}
		if imageCount < 1 || imageCount > dto.MaxImageN {
			return 0, trace, fmt.Errorf("image_count must be between 1 and %d", dto.MaxImageN)
		}
		trace.ImageCount = &imageCount
	}

	env := map[string]any{
		"image_count": float64(imageCount),
		"p":           params.P,
		"c":           params.C,
		"len":         params.Len,
		"duration":    derefFloat(request.Duration),
		"cr":          params.CR,
		"cc":          params.CC,
		"cc1h":        params.CC1h,
		"cc12h":       params.CC12h,
		"img":         params.Img,
		"img_cr":      params.ImgCR,
		"img_o":       params.ImgO,
		"ai":          params.AI,
		"rt":          params.RT,
		"ao":          params.AO,
		"tier": func(name string, value float64) float64 {
			trace.MatchedTier = name
			trace.Cost = value
			return value
		},
		"fixed": func(amount float64) float64 {
			trace.BillingUnit = BillingUnitRequest
			trace.FixedPrice = &amount
			return amount * 1_000_000
		},
		requestRuleTraceFunction: func(ruleIndex int, matched bool, multiplier float64) float64 {
			if matched && ruleIndex >= 0 && ruleIndex < len(trace.RequestRules) {
				trace.RequestRules[ruleIndex].Matched = true
			}
			if matched {
				return multiplier
			}
			return 1
		},
		requestRuleTraceIntFunction: func(ruleIndex int, matched bool, multiplier int) int {
			if matched && ruleIndex >= 0 && ruleIndex < len(trace.RequestRules) {
				trace.RequestRules[ruleIndex].Matched = true
			}
			if matched {
				return multiplier
			}
			return 1
		},
		"header": func(key string) string {
			return headers[strings.ToLower(strings.TrimSpace(key))]
		},
		"param": func(path string) any {
			path = strings.TrimSpace(path)
			if path == "" {
				return nil
			}
			if len(request.Body) > 0 {
				result := gjson.GetBytes(request.Body, path)
				if result.Exists() {
					return result.Value()
				}
			}
			// Task plugins report resolution/size in usage facts, not in the
			// chat body. Fall back to those facts so a resolution-tiered task
			// expression does not silently charge the default tier.
			if value, ok := usageParamValue(request.Usage, path); ok {
				return value
			}
			return nil
		},
		"u": func(name string) any {
			if request.Usage == nil {
				return nil
			}
			return request.Usage[strings.TrimSpace(name)]
		},
		"has": func(source any, substr string) bool {
			if source == nil || substr == "" {
				return false
			}
			return strings.Contains(fmt.Sprint(source), substr)
		},
		// lower/upper override the expr builtins (env members take precedence)
		// so expressions fed straight from upstream sync — e.g.
		// `lower(param("size"))` on a wan3.0-video billing expression — treat a
		// missing param()/u() value as "" instead of crashing with
		// "interface conversion: interface {} is nil, not string".
		"lower": func(v any) string {
			if v == nil {
				return ""
			}
			return strings.ToLower(fmt.Sprint(v))
		},
		"upper": func(v any) string {
			if v == nil {
				return ""
			}
			return strings.ToUpper(fmt.Sprint(v))
		},
		"hour":    func(tz string) int { return timeInZone(tz).Hour() },
		"minute":  func(tz string) int { return timeInZone(tz).Minute() },
		"weekday": func(tz string) int { return int(timeInZone(tz).Weekday()) },
		"month":   func(tz string) int { return int(timeInZone(tz).Month()) },
		"day":     func(tz string) int { return timeInZone(tz).Day() },
		"max":     math.Max,
		"min":     math.Min,
		"abs":     math.Abs,
		"ceil":    math.Ceil,
		"floor":   math.Floor,
	}

	out, err := expr.Run(prog, env)
	if err != nil {
		return 0, trace, fmt.Errorf("expr run error: %w", err)
	}
	f, ok := out.(float64)
	if !ok {
		return 0, trace, fmt.Errorf("expr result is %T, want float64", out)
	}
	return f, trace, nil
}

// derefFloat returns the value pointed to by v, or 0 when v is nil. Used to bind
// optional expression variables (e.g. `duration`) so a missing value falls back to
// zero instead of a nil that would crash arithmetic in the expression evaluator.
func derefFloat(v *float64) float64 {
	if v == nil {
		return 0
	}
	return *v
}

func timeInZone(tz string) time.Time {
	tz = strings.TrimSpace(tz)
	if tz == "" {
		return time.Now().UTC()
	}
	loc, err := time.LoadLocation(tz)
	if err != nil {
		return time.Now().UTC()
	}
	return time.Now().In(loc)
}

func normalizeHeaders(headers map[string]string) map[string]string {
	if len(headers) == 0 {
		return map[string]string{}
	}
	normalized := make(map[string]string, len(headers))
	for key, value := range headers {
		k := strings.ToLower(strings.TrimSpace(key))
		v := strings.TrimSpace(value)
		if k == "" || v == "" {
			continue
		}
		normalized[k] = v
	}
	return normalized
}

// usageParamValue resolves param("a.b") from task usage facts. It checks the
// exact key, a nested map path, then the last path segment case-insensitively
// (plugins commonly report "resolution" or "size" at the top level).
func usageParamValue(usage map[string]any, path string) (any, bool) {
	if len(usage) == 0 || path == "" {
		return nil, false
	}
	if value, ok := usage[path]; ok {
		return value, true
	}
	var current any = usage
	for _, segment := range strings.Split(path, ".") {
		object, ok := current.(map[string]any)
		if !ok {
			current = nil
			break
		}
		current, ok = object[segment]
		if !ok {
			current = nil
			break
		}
	}
	if current != nil {
		return current, true
	}
	last := path
	if index := strings.LastIndex(path, "."); index >= 0 {
		last = path[index+1:]
	}
	for key, value := range usage {
		if strings.EqualFold(key, last) {
			return value, true
		}
	}
	return nil, false
}
