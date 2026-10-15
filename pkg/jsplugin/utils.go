package jsplugin

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/Calcium-Ion/moejs"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
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

// injectGlobals installs utils and console. currentCall returns the hook call
// running on runtime, or nil outside one; utils.fetch reads its fetcher and
// budget there, so no request data lives in the runtime's globals.
// maxDurationSeconds 是 durationAuto 认可的最长时长（24 小时）。超出即视为不可信。
const maxDurationSeconds = 24 * 60 * 60

// durationSelectorKeys 是 durationAuto 读取的对象字段，按优先级排列。
// 只读这几个键、绝不整体导出对象，因此代价是O(1) 而不与对象大小相关。
var durationSelectorKeys = [...]string{"seconds", "duration", "duration_seconds", "durationSeconds"}

// durationSecondsOrNull 回显一个有限、可信的时长，其余一律折叠为 null。
//
// 负值是被刻意拒绝的：wan3.0 系插件用 "-1" 表示「智能时长」，回显它等于让调用方
// 把这个哨兵当成真实秒数提交。
func durationSecondsOrNull(r *moejs.Realm, seconds float64) moejs.Value {
	if seconds < 0 || seconds > maxDurationSeconds || math.IsNaN(seconds) || math.IsInf(seconds, 0) {
		return moejs.Null()
	}
	return moejs.Number(seconds)
}

func injectGlobals(runtime *moejs.Runtime, identity func() string, now func() time.Time, logOutput func(string), currentCall func() *runtimeCall) error {
	utils := map[string]any{
		"fetch": runtime.Function("fetch", 1, func(r *moejs.Realm, _ moejs.Value, args []moejs.Value) (moejs.Value, error) {
			call := currentCall()
			if call == nil {
				return moejs.Undefined(), fmt.Errorf("utils.fetch is not available outside hooks")
			}
			return call.fetch(r, moejs.Arg(args, 0))
		}),
		"hasCapability": runtime.Function("hasCapability", 1, func(r *moejs.Realm, _ moejs.Value, args []moejs.Value) (moejs.Value, error) {
			name, err := stringValue(r, moejs.Arg(args, 0))
			if err != nil {
				return moejs.Undefined(), err
			}
			return moejs.Bool(HasCapability(name)), nil
		}),
		"json": map[string]any{
			"clone": runtime.Function("clone", 1, func(r *moejs.Realm, _ moejs.Value, args []moejs.Value) (moejs.Value, error) {
				if moejs.Arg(args, 0).IsUndefined() {
					return moejs.Undefined(), r.TypeError("json.clone requires a JSON value")
				}
				budget := &jsonStateBudget{ctx: context.Background(), bytes: MaxJSONToolBytes, nodes: maxJSONToolNodes, realm: r}
				value, err := newJSONStateNode(moejs.Arg(args, 0), 0, budget)
				if err != nil {
					var exception *moejs.Exception
					var interrupted *moejs.InterruptedError
					if errors.As(err, &exception) || errors.As(err, &interrupted) {
						return moejs.Undefined(), err
					}
					return moejs.Undefined(), r.TypeError("json.clone: %s", err)
				}
				return value.jsValue(r)
			}),
		},
		// durationAuto 把厂商五花八门的"时长"字段归一成「秒数或 null」：
		//   - "auto"/""/null/undefined -> null（与厂商无关的"自动"标记）
		//   - 数字字符串              -> 解析出的秒数
		//   - 对象                   -> 其中的 seconds/duration 字段，没有则 null
		//   - 负数或超过 24 小时      -> null（绝不回显哨兵或荒谬长度）
		"durationAuto": runtime.Function("durationAuto", 1, func(r *moejs.Realm, _ moejs.Value, args []moejs.Value) (moejs.Value, error) {
			argument := moejs.Arg(args, 0)
			if argument.IsNullish() {
				return moejs.Null(), nil
			}
			// 先按声明类型分派再读取任何值：对象逐键读取、绝不整体导出，
			// 插件因此无法把一次时长查询变成无界的深拷贝。
			// 数组也走末尾的数值分支（时长本身可能就是数组形态的秒数），
			// 因此这里只把「非数组对象」当作需逐键查找的候选。
			if argument.IsObject() {
				object := argument.AsObject()
				for _, key := range durationSelectorKeys {
					field, err := object.GetProp(r, r.KeyFromGoString(key))
					if err != nil {
						return moejs.Undefined(), err
					}
					if field.IsNullish() {
						continue
					}
					seconds, err := r.ToNumber(field)
					if err != nil {
						// 字段不是数字：继续试下一个候选键，而不是直接判死。
						continue
					}
					return durationSecondsOrNull(r, seconds), nil
				}
				return moejs.Null(), nil
			}
			if argument.IsString() {
				trimmed := strings.TrimSpace(argument.String())
				if trimmed == "" || trimmed == "auto" {
					return moejs.Null(), nil
				}
				parsed, err := strconv.ParseFloat(trimmed, 64)
				if err != nil {
					return moejs.Null(), nil
				}
				return durationSecondsOrNull(r, parsed), nil
			}
			seconds, err := r.ToNumber(argument)
			if err != nil {
				return moejs.Null(), nil
			}
			return durationSecondsOrNull(r, seconds), nil
		}),
		"unixNow": runtime.Function("unixNow", 0, func(*moejs.Realm, moejs.Value, []moejs.Value) (moejs.Value, error) {
			return moejs.Int(now().Unix()), nil
		}),
		"jwtSignHS256": runtime.Function("jwtSignHS256", 2, func(r *moejs.Realm, _ moejs.Value, args []moejs.Value) (moejs.Value, error) {
			var claims map[string]any
			if argument := moejs.Arg(args, 0); !argument.IsNullish() {
				exported, err := r.ToGoStrict(argument)
				if err != nil {
					return moejs.Undefined(), err
				}
				var ok bool
				if claims, ok = exported.(map[string]any); !ok {
					return moejs.Undefined(), r.TypeError("jwtSignHS256 claims must be an object")
				}
			}
			secret, err := stringValue(r, moejs.Arg(args, 1))
			if err != nil {
				return moejs.Undefined(), err
			}
			token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims(claims)).SignedString([]byte(secret))
			if err != nil {
				return moejs.Undefined(), err
			}
			return moejs.String(token), nil
		}),
		"hmacSHA256": runtime.Function("hmacSHA256", 2, func(r *moejs.Realm, _ moejs.Value, args []moejs.Value) (moejs.Value, error) {
			message, err := stringValue(r, moejs.Arg(args, 0))
			if err != nil {
				return moejs.Undefined(), err
			}
			secret, err := stringValue(r, moejs.Arg(args, 1))
			if err != nil {
				return moejs.Undefined(), err
			}
			mac := hmac.New(sha256.New, []byte(secret))
			_, _ = mac.Write([]byte(message))
			return moejs.String(hex.EncodeToString(mac.Sum(nil))), nil
		}),
		"base64": runtime.Function("base64", 1, func(r *moejs.Realm, _ moejs.Value, args []moejs.Value) (moejs.Value, error) {
			value, err := stringValue(r, moejs.Arg(args, 0))
			if err != nil {
				return moejs.Undefined(), err
			}
			return moejs.String(base64.StdEncoding.EncodeToString([]byte(value))), nil
		}),
		"base64URL": runtime.Function("base64URL", 1, func(r *moejs.Realm, _ moejs.Value, args []moejs.Value) (moejs.Value, error) {
			value, err := stringValue(r, moejs.Arg(args, 0))
			if err != nil {
				return moejs.Undefined(), err
			}
			return moejs.String(base64.RawURLEncoding.EncodeToString([]byte(value))), nil
		}),
		"base64URLDecode": runtime.Function("base64URLDecode", 1, func(r *moejs.Realm, _ moejs.Value, args []moejs.Value) (moejs.Value, error) {
			value, err := stringValue(r, moejs.Arg(args, 0))
			if err != nil {
				return moejs.Undefined(), err
			}
			decoded, err := base64.RawURLEncoding.DecodeString(value)
			if err != nil {
				return moejs.Undefined(), err
			}
			return moejs.String(string(decoded)), nil
		}),
		"uuid": runtime.Function("uuid", 0, func(*moejs.Realm, moejs.Value, []moejs.Value) (moejs.Value, error) {
			return moejs.String(uuid.NewString()), nil
		}),
		"volcSignV4": runtime.Function("volcSignV4", 1, func(r *moejs.Realm, _ moejs.Value, args []moejs.Value) (moejs.Value, error) {
			// Fields are read by their Go names, as plugins have always
			// passed them.
			var request volcSignRequest
			argument := moejs.Arg(args, 0)
			if !argument.IsNullish() && !argument.IsObject() {
				return moejs.Undefined(), r.TypeError("volcSignV4 request must be an object")
			}
			if argument.IsObject() {
				object := argument.AsObject()
				fields := []struct {
					name   string
					target *string
				}{
					{"Method", &request.Method}, {"URL", &request.URL}, {"Body", &request.Body},
					{"AccessKey", &request.AccessKey}, {"SecretKey", &request.SecretKey},
					{"Region", &request.Region}, {"Service", &request.Service},
				}
				for _, field := range fields {
					value, err := object.GetProp(r, r.KeyFromGoString(field.name))
					if err != nil {
						return moejs.Undefined(), err
					}
					if *field.target, err = stringValue(r, value); err != nil {
						return moejs.Undefined(), err
					}
				}
				headers, err := object.GetProp(r, r.KeyFromGoString("Headers"))
				if err != nil {
					return moejs.Undefined(), err
				}
				if headers.IsObject() {
					keys, err := r.EnumerableOwnKeys(headers.AsObject())
					if err != nil {
						return moejs.Undefined(), err
					}
					request.Headers = make(map[string]string, len(keys))
					for _, key := range keys {
						value, err := headers.AsObject().GetProp(r, key)
						if err != nil {
							return moejs.Undefined(), err
						}
						if request.Headers[key.GoString()], err = stringValue(r, value); err != nil {
							return moejs.Undefined(), err
						}
					}
				}
				timestamp, err := object.GetProp(r, r.KeyFromGoString("Timestamp"))
				if err != nil {
					return moejs.Undefined(), err
				}
				if !timestamp.IsNullish() {
					seconds, err := r.ToNumber(timestamp)
					if err != nil {
						return moejs.Undefined(), err
					}
					if !math.IsNaN(seconds) && !math.IsInf(seconds, 0) {
						request.Timestamp = int64(seconds)
					}
				}
			}
			signed, err := signVolcV4(request, now)
			if err != nil {
				return moejs.Undefined(), err
			}
			return r.FromGo(signed)
		}),
	}
	if err := runtime.SetGlobal("utils", utils); err != nil {
		return err
	}
	return runtime.SetGlobal("console", map[string]any{
		"log": runtime.Function("log", 0, func(r *moejs.Realm, _ moejs.Value, args []moejs.Value) (moejs.Value, error) {
			parts := make([]string, len(args))
			for i, argument := range args {
				if argument.IsSymbol() {
					parts[i] = argument.String()
					continue
				}
				text, err := r.ToString(argument)
				if err != nil {
					return moejs.Undefined(), err
				}
				parts[i] = text.GoString()
			}
			if logOutput != nil {
				logOutput(identity() + " " + strings.Join(parts, " "))
			}
			return moejs.Undefined(), nil
		}),
	})
}

// stringValue reads a host function's string parameter: undefined and null
// read as "", other values as JavaScript's String(value).
func stringValue(r *moejs.Realm, value moejs.Value) (string, error) {
	if value.IsNullish() {
		return "", nil
	}
	if value.IsString() {
		return value.AsString().GoString(), nil
	}
	text, err := r.ToString(value)
	if err != nil {
		return "", err
	}
	return text.GoString(), nil
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
