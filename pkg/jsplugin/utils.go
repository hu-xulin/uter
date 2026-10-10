package jsplugin

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"math"
	"net/url"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/grafana/sobek"

	"github.com/uter-ai/uter/common"
)

type volcSignRequest struct {
	Method    string            `json:"method"`
	URL       string            `json:"url"`
	Headers   map[string]string `json:"headers"`
	Body      string            `json:"body"`
	AccessKey string            `json:"accessKey"`
	SecretKey string            `json:"secretKey"`
	Region    string            `json:"region"`
	Service   string            `json:"service"`
	Timestamp int64             `json:"timestamp"`
}

// maxDurationSeconds is the largest media duration durationAuto will echo.
// Anything beyond it is not a plausible generation length and collapses to
// the "let the plugin decide" null rather than travelling to an upstream.
const maxDurationSeconds = 24 * 60 * 60

// durationSelectorKeys are the object fields durationAuto reads, in priority
// order. It reads only these keys and never exports the whole object, so the
// cost is O(1) in the object's size.
var durationSelectorKeys = [...]string{"seconds", "duration", "duration_seconds", "durationSeconds"}

// extractDurationSeconds normalizes a sobek-exported number (sobek emits whole
// numbers as int64 and fractional ones as float64) to seconds. It returns false
// for non-numeric values and for NaN/Inf so callers never fabricate a duration.
func extractDurationSeconds(v any) (float64, bool) {
	switch n := v.(type) {
	case float64:
		if math.IsNaN(n) || math.IsInf(n, 0) {
			return 0, false
		}
		return n, true
	case int64:
		return float64(n), true
	case int:
		return float64(n), true
	case uint64:
		return float64(n), true
	case int32:
		return float64(n), true
	}
	return 0, false
}

// durationSecondsOrNull echoes a finite, plausible duration and collapses
// everything else to null. Negative values are rejected on purpose: wan3.0
// plugins pass "-1" as the "smart duration" sentinel, so echoing it would let
// a caller mistake the marker for a real length.
func durationSecondsOrNull(runtime *sobek.Runtime, seconds float64) sobek.Value {
	if seconds < 0 || seconds > maxDurationSeconds {
		return sobek.Null()
	}
	return runtime.ToValue(seconds)
}

func injectGlobals(runtime *sobek.Runtime, identity func() string, now func() time.Time, logOutput func(string)) error {
	utils := map[string]any{
		"hasCapability": HasCapability,
		"json": map[string]any{
			"clone": func(call sobek.FunctionCall) sobek.Value {
				if sobek.IsUndefined(call.Argument(0)) {
					panic(runtime.NewTypeError("json.clone requires a JSON value"))
				}
				budget := &jsonStateBudget{ctx: context.Background(), bytes: MaxJSONToolBytes, nodes: maxJSONToolNodes}
				value, err := newJSONStateNode(call.Argument(0), 0, budget)
				if err != nil {
					panic(runtime.NewTypeError("json.clone: %s", err))
				}
				cloned, err := value.jsValue(runtime)
				if err != nil {
					panic(runtime.NewGoError(err))
				}
				return cloned
			},
			// order re-emits a JSON value as a fresh object/array whose object keys
			// are sorted by the optional priority map. Keys absent from the map keep
			// their original insertion order and are emitted after the mapped ones.
			// It is the host-side backing for the json-order@1 capability.
			"order": func(call sobek.FunctionCall) sobek.Value {
				if sobek.IsUndefined(call.Argument(0)) {
					panic(runtime.NewTypeError("json.order requires a JSON value"))
				}
				orderMap := map[string]int{}
				if !sobek.IsUndefined(call.Argument(1)) {
					arg := call.Argument(1)
					object, ok := arg.(*sobek.Object)
					if !ok || object.ClassName() != "Object" {
						panic(runtime.NewTypeError("json.order order map must be a plain object"))
					}
					for _, key := range object.Keys() {
						switch number := object.Get(key).Export().(type) {
						case float64:
							orderMap[key] = int(number)
						case int64:
							orderMap[key] = int(number)
						case int:
							orderMap[key] = number
						}
					}
				}
				budget := &jsonStateBudget{ctx: context.Background(), bytes: MaxJSONToolBytes, nodes: maxJSONToolNodes}
				result, err := orderJSONTree(runtime, call.Argument(0), orderMap, 0, budget)
				if err != nil {
					panic(runtime.NewTypeError("json.order: %s", err))
				}
				return result
			},
		},
		"unixNow": func() int64 { return now().Unix() },
		"jwtSignHS256": func(claims map[string]any, secret string) (string, error) {
			return jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims(claims)).SignedString([]byte(secret))
		},
		"hmacSHA256": func(message, secret string) string {
			mac := hmac.New(sha256.New, []byte(secret))
			_, _ = mac.Write([]byte(message))
			return hex.EncodeToString(mac.Sum(nil))
		},
		"base64": func(value string) string { return base64.StdEncoding.EncodeToString([]byte(value)) },
		"base64URL": func(value string) string {
			return base64.RawURLEncoding.EncodeToString([]byte(value))
		},
		"base64URLDecode": func(value string) (string, error) {
			decoded, err := base64.RawURLEncoding.DecodeString(value)
			return string(decoded), err
		},
		"uuid": func() string { return uuid.NewString() },
		"volcSignV4": func(request volcSignRequest) (map[string]string, error) {
			return signVolcV4(request, now)
		},
		// durationAuto is the host-side backing for the duration-auto@1
		// capability. It normalizes a duration selector the plugin already knows
		// about; it never fabricates a duration, so a misconfigured caller can
		// only ever observe a null (treated as "let the plugin decide") or an
		// explicit value it already supplied. Contracts:
		//   - finite number  -> echoed as the same seconds value
		//   - "auto"/""/null/undefined -> null (host-neutral "auto" marker)
		//   - numeric string  -> parsed seconds
		//   - object-> the seconds/duration field if present, else null
		//   - negative or > 24h -> null (never a sentinel or an absurd length)
		// Cost is O(1) in the argument's size: objects are read key by key
		// instead of being exported wholesale, so a plugin cannot turn a
		// duration lookup into an unbounded deep copy.
		"durationAuto": func(call sobek.FunctionCall) sobek.Value {
			arg := call.Argument(0)
			if sobek.IsUndefined(arg) || sobek.IsNull(arg) {
				return sobek.Null()
			}
			// Dispatch on the declared type before exporting anything. Objects
			// are read key by key and never exported wholesale, so a plugin
			// cannot turn a duration lookup into an unbounded deep copy.
			switch arg.ExportType() {
			case reflect.TypeFor[map[string]any]():
				object, ok := arg.(*sobek.Object)
				if !ok {
					return sobek.Null()
				}
				for _, key := range durationSelectorKeys {
					field := object.Get(key)
					if field == nil || sobek.IsUndefined(field) || sobek.IsNull(field) {
						continue
					}
					if n, ok := extractDurationSeconds(field.Export()); ok {
						return durationSecondsOrNull(runtime, n)
					}
				}
				return sobek.Null()
			case reflect.TypeFor[string]():
				trimmed := strings.TrimSpace(arg.Export().(string))
				if trimmed == "" || trimmed == "auto" {
					return sobek.Null()
				}
				if n, err := strconv.ParseFloat(trimmed, 64); err == nil {
					return durationSecondsOrNull(runtime, n)
				}
				return sobek.Null()
			}
			if n, ok := extractDurationSeconds(arg.Export()); ok {
				return durationSecondsOrNull(runtime, n)
			}
			return sobek.Null()
		},
	}
	if err := runtime.Set("utils", utils); err != nil {
		return err
	}
	console := runtime.NewObject()
	if err := console.Set("log", func(call sobek.FunctionCall) sobek.Value {
		parts := make([]string, len(call.Arguments))
		for i, argument := range call.Arguments {
			parts[i] = argument.String()
		}
		if logOutput != nil {
			logOutput(identity() + " " + strings.Join(parts, " "))
		}
		return sobek.Undefined()
	}); err != nil {
		return err
	}
	return runtime.Set("console", console)
}

// orderJSONTree re-emits a JS JSON value as a new sobek value whose object keys
// are reordered by orderMap at every level (unlisted keys keep insertion order
// and follow listed ones). It reuses the bounded accounting used by json.clone
// so a malicious plugin cannot allocate unbounded memory.
func orderJSONTree(runtime *sobek.Runtime, value sobek.Value, orderMap map[string]int, depth int, budget *jsonStateBudget) (sobek.Value, error) {
	if depth > maxJSONToolDepth {
		return nil, fmt.Errorf("JSON state exceeds depth limit")
	}
	if sobek.IsUndefined(value) {
		return nil, fmt.Errorf("undefined is not a JSON value")
	}
	if sobek.IsNull(value) {
		return runtime.ToValue(nil), nil
	}
	if object, ok := value.(*sobek.Object); ok {
		switch object.ClassName() {
		case "Object":
			keys := object.Keys()
			if len(keys) > budget.nodes {
				return nil, fmt.Errorf("JSON object exceeds node limit")
			}
			if err := budget.spend(2, 0); err != nil {
				return nil, err
			}
			sorted := make([]string, len(keys))
			copy(sorted, keys)
			sort.SliceStable(sorted, func(i, j int) bool {
				pi, oki := orderMap[sorted[i]]
				pj, okj := orderMap[sorted[j]]
				if oki && okj {
					return pi < pj
				}
				if oki != okj {
					return oki
				}
				return false
			})
			result := runtime.NewObject()
			for _, key := range sorted {
				child, err := orderJSONTree(runtime, object.Get(key), orderMap, depth+1, budget)
				if err != nil {
					return nil, err
				}
				if err = result.DefineDataProperty(key, child, sobek.FLAG_TRUE, sobek.FLAG_TRUE, sobek.FLAG_TRUE); err != nil {
					return nil, err
				}
			}
			return result, nil
		case "Array":
			length := object.Get("length").ToInteger()
			if length < 0 || length > int64(budget.nodes) {
				return nil, fmt.Errorf("JSON array exceeds node limit")
			}
			if err := budget.spend(2+max(0, int(length)-1), 0); err != nil {
				return nil, err
			}
			items := make([]any, length)
			for index := range items {
				raw := object.Get(strconv.Itoa(index))
				if raw == nil {
					return nil, fmt.Errorf("sparse arrays are not JSON values")
				}
				elem, err := orderJSONTree(runtime, raw, orderMap, depth+1, budget)
				if err != nil {
					return nil, err
				}
				items[index] = elem
			}
			return runtime.NewArray(items...), nil
		default:
			return nil, fmt.Errorf("json.order accepts only plain objects, arrays and JSON scalars")
		}
	}
	exported := value.Export()
	switch typed := exported.(type) {
	case int:
		exported = float64(typed)
	case int64:
		exported = float64(typed)
	}
	switch scalar := exported.(type) {
	case float64:
		if math.IsNaN(scalar) || math.IsInf(scalar, 0) {
			return nil, fmt.Errorf("JSON numbers must be finite")
		}
	case nil, bool, string:
	default:
		return nil, fmt.Errorf("value must contain only JSON objects, arrays and scalars")
	}
	encoded, err := common.Marshal(exported)
	if err != nil {
		return nil, err
	}
	if err = budget.spend(len(encoded), 0); err != nil {
		return nil, err
	}
	return runtime.ToValue(exported), nil
}

func signVolcV4(request volcSignRequest, now func() time.Time) (map[string]string, error) {
	parsedURL, err := url.Parse(request.URL)
	if err != nil || parsedURL.Host == "" {
		return nil, fmt.Errorf("invalid Volcengine signing URL")
	}
	region := request.Region
	if region == "" {
		region = "cn-north-1"
	}
	service := request.Service
	if service == "" {
		service = "cv"
	}
	timestamp := now().UTC()
	if request.Timestamp != 0 {
		timestamp = time.Unix(request.Timestamp, 0).UTC()
	}
	xDate := timestamp.Format("20060102T150405Z")
	shortDate := timestamp.Format("20060102")
	bodyHash := sha256.Sum256([]byte(request.Body))
	requestPath := parsedURL.EscapedPath()
	if requestPath == "" {
		requestPath = "/"
	}

	headers := make(map[string]string, len(request.Headers)+3)
	for name, value := range request.Headers {
		headers[strings.ToLower(name)] = strings.TrimSpace(value)
	}
	headers["host"] = parsedURL.Host
	headers["x-date"] = xDate
	headers["x-content-sha256"] = hex.EncodeToString(bodyHash[:])
	keys := make([]string, 0, len(headers))
	for name := range headers {
		keys = append(keys, name)
	}
	sort.Strings(keys)
	var canonicalHeaders strings.Builder
	for _, name := range keys {
		canonicalHeaders.WriteString(name)
		canonicalHeaders.WriteByte(':')
		canonicalHeaders.WriteString(headers[name])
		canonicalHeaders.WriteByte('\n')
	}
	signedHeaders := strings.Join(keys, ";")
	canonicalRequest := strings.Join([]string{
		strings.ToUpper(request.Method), requestPath, parsedURL.Query().Encode(),
		canonicalHeaders.String(), signedHeaders, hex.EncodeToString(bodyHash[:]),
	}, "\n")
	canonicalHash := sha256.Sum256([]byte(canonicalRequest))
	scope := fmt.Sprintf("%s/%s/%s/request", shortDate, region, service)
	stringToSign := fmt.Sprintf("HMAC-SHA256\n%s\n%s\n%s", xDate, scope, hex.EncodeToString(canonicalHash[:]))
	sign := func(key []byte, value string) []byte {
		mac := hmac.New(sha256.New, key)
		_, _ = mac.Write([]byte(value))
		return mac.Sum(nil)
	}
	signingKey := sign(sign(sign([]byte(request.SecretKey), shortDate), region), service)
	signingKey = sign(signingKey, "request")
	signature := hex.EncodeToString(sign(signingKey, stringToSign))
	return map[string]string{
		"Authorization":    fmt.Sprintf("HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s", request.AccessKey, scope, signedHeaders, signature),
		"X-Date":           xDate,
		"X-Content-Sha256": hex.EncodeToString(bodyHash[:]),
	}, nil
}
