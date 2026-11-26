package service

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
)

// Alibaba Cloud Model Studio control-plane API. Unlike the workspace
// /api/v1/models endpoint (which needs a Bearer API Key), this API authenticates
// with RAM AccessKey ID/Secret and is the supported unattended way to list the
// models available in a region without replaying a console login.
const (
	bailianOpenAPIVersion      = "2026-02-10"
	bailianOpenAPIActionModels = "ListModels"
	bailianOpenAPIPathModels   = "/modelstudio/models"
	bailianOpenAPIPageSize     = 200
	bailianOpenAPIMaxPages     = 20
	bailianOpenAPIAlgorithm    = "ACS3-HMAC-SHA256"
)

var bailianOpenAPIEndpointByRegion = map[BailianRegion]string{
	BailianRegionBeijing:   "modelstudio.cn-beijing.aliyuncs.com",
	BailianRegionSingapore: "modelstudio.ap-southeast-1.aliyuncs.com",
	BailianRegionHongKong:  "modelstudio.cn-hongkong.aliyuncs.com",
	BailianRegionGermany:   "modelstudio.eu-central-1.aliyuncs.com",
	BailianRegionJapan:     "modelstudio.ap-northeast-1.aliyuncs.com",
	BailianRegionUS:        "modelstudio.us-east-1.aliyuncs.com",
}

var (
	// ErrBailianAccessKeyNotConfigured is fail-closed: no console password
	// fallback and no partial credential are ever used to call the API.
	ErrBailianAccessKeyNotConfigured = errors.New("Alibaba Bailian AccessKey ID and Secret are not configured")
	ErrBailianRegionUnknown          = errors.New("Alibaba Bailian region is unknown; set a workspace API address or a regional console URL")
)

// ValidateBailianAccessKey rejects empty, placeholder, short and low-entropy
// credentials before any request leaves the process. Error messages never
// include the supplied values.
func ValidateBailianAccessKey(accessKeyID, accessKeySecret string) error {
	id := strings.TrimSpace(accessKeyID)
	secret := strings.TrimSpace(accessKeySecret)
	if id == "" || secret == "" {
		return ErrBailianAccessKeyNotConfigured
	}
	lower := strings.ToLower(id + " " + secret)
	for _, marker := range []string{"your", "xxx", "placeholder", "changeme", "example", "demo", "test"} {
		if strings.Contains(lower, marker) {
			return errors.New("Alibaba Bailian AccessKey looks like a placeholder")
		}
	}
	if len(id) < 8 || len(secret) < 16 {
		return errors.New("Alibaba Bailian AccessKey ID or Secret is too short")
	}
	if singleRune(id) || singleRune(secret) {
		return errors.New("Alibaba Bailian AccessKey has no entropy")
	}
	return nil
}

func singleRune(value string) bool {
	if value == "" {
		return false
	}
	first := value[0]
	for index := 1; index < len(value); index++ {
		if value[index] != first {
			return false
		}
	}
	return true
}

// BailianRegionFromConsoleURL reads the region segment from an operator's
// console sign-in URL. The URL is only a region hint; it is never used as an
// API endpoint or as a model-discovery request target.
func BailianRegionFromConsoleURL(raw string) BailianRegion {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return BailianRegionUnspecified
	}
	if !strings.Contains(raw, "://") {
		raw = "https://" + raw
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return BailianRegionUnspecified
	}
	for _, segment := range strings.Split(strings.Trim(parsed.Path, "/"), "/") {
		candidate := BailianRegion(segment)
		if _, ok := bailianOpenAPIEndpointByRegion[candidate]; ok {
			return candidate
		}
	}
	return BailianRegionUnspecified
}

type bailianOpenAPIModelsResponse struct {
	RequestID    string           `json:"requestId"`
	Success      bool             `json:"success"`
	Code         string           `json:"code"`
	ErrorMessage string           `json:"errorMessage"`
	NextToken    string           `json:"nextToken"`
	TotalCount   int              `json:"totalCount"`
	Models       []map[string]any `json:"models"`
}

// ListBailianOpenAPIModels lists the models published for one region through
// the RAM-authenticated Model Studio API. It never falls back to Uter's
// built-in catalogue: a failed control-plane call must stay visible instead
// of producing the misleading 294-model list.
func ListBailianOpenAPIModels(
	ctx context.Context,
	region BailianRegion,
	accessKeyID, accessKeySecret string,
) ([]string, error) {
	if err := ValidateBailianAccessKey(accessKeyID, accessKeySecret); err != nil {
		return nil, err
	}
	host, ok := bailianOpenAPIEndpointByRegion[region]
	if !ok {
		return nil, ErrBailianRegionUnknown
	}
	client := &http.Client{Timeout: 20 * time.Second}
	names := make([]string, 0)
	seen := make(map[string]struct{})
	nextToken := ""

	for page := 0; page < bailianOpenAPIMaxPages; page++ {
		query := url.Values{}
		query.Set("language", "zh-CN")
		query.Set("maxResults", fmt.Sprintf("%d", bailianOpenAPIPageSize))
		if nextToken != "" {
			query.Set("nextToken", nextToken)
		}
		requestURL, headers, err := buildBailianROARequest(
			http.MethodGet, host, bailianOpenAPIPathModels, query,
			bailianOpenAPIActionModels, accessKeyID, accessKeySecret,
		)
		if err != nil {
			return nil, err
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
		if err != nil {
			return nil, err
		}
		req.Host = host
		for key, value := range headers {
			if key == "host" {
				continue
			}
			req.Header.Set(key, value)
		}
		resp, err := client.Do(req)
		if err != nil {
			return nil, fmt.Errorf("list Bailian models through OpenAPI: %w", err)
		}
		body, readErr := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
		resp.Body.Close()
		if readErr != nil {
			return nil, readErr
		}
		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf(
				"Bailian OpenAPI returned HTTP %d: %s",
				resp.StatusCode, sanitizeBailianOpenAPIError(body, accessKeyID, accessKeySecret),
			)
		}
		var payload bailianOpenAPIModelsResponse
		if err := common.Unmarshal(body, &payload); err != nil {
			return nil, fmt.Errorf("decode Bailian OpenAPI model list: %w", err)
		}
		if !payload.Success {
			message := strings.TrimSpace(payload.ErrorMessage)
			if message == "" {
				message = "Bailian OpenAPI returned success=false"
			}
			return nil, errors.New(sanitizeBailianOpenAPIError(
				[]byte(message), accessKeyID, accessKeySecret,
			))
		}
		for _, item := range payload.Models {
			name := bailianOpenAPIModelName(item)
			if name == "" {
				continue
			}
			if _, exists := seen[name]; exists {
				continue
			}
			seen[name] = struct{}{}
			names = append(names, name)
		}
		nextToken = strings.TrimSpace(payload.NextToken)
		if nextToken == "" ||
			(payload.TotalCount > 0 && len(names) >= payload.TotalCount) ||
			len(payload.Models) == 0 {
			break
		}
	}
	if len(names) == 0 {
		return nil, errors.New("Bailian OpenAPI returned no models")
	}
	return NormalizeCatalogModelNames(names), nil
}

func bailianOpenAPIModelName(item map[string]any) string {
	for _, key := range []string{"model", "modelName", "modelId", "name", "id", "model_code"} {
		if value, ok := item[key].(string); ok {
			if name := strings.TrimSpace(value); name != "" {
				return name
			}
		}
	}
	for _, container := range []string{"modelInfo", "model_info"} {
		nested, ok := item[container].(map[string]any)
		if !ok {
			continue
		}
		for _, key := range []string{"model", "modelName", "modelId", "name", "id"} {
			if value, ok := nested[key].(string); ok {
				if name := strings.TrimSpace(value); name != "" {
					return name
				}
			}
		}
	}
	return ""
}

// buildBailianROARequest implements the ACS3-HMAC-SHA256 ROA signature used by
// Model Studio 2026-02-10. The secret is used directly as the HMAC key; there
// is deliberately no AWS-style kDate/kRegion derivation.
func buildBailianROARequest(
	method, host, path string,
	query url.Values,
	action, accessKeyID, accessKeySecret string,
) (string, map[string]string, error) {
	if strings.TrimSpace(host) == "" || strings.TrimSpace(path) == "" {
		return "", nil, errors.New("invalid Bailian OpenAPI request target")
	}
	date := time.Now().UTC().Format("2006-01-02T15:04:05Z")
	nonceBytes := make([]byte, 16)
	if _, err := rand.Read(nonceBytes); err != nil {
		return "", nil, err
	}
	payloadHash := sha256Hex("")
	headers := map[string]string{
		"host":                  host,
		"x-acs-action":          action,
		"x-acs-version":         bailianOpenAPIVersion,
		"x-acs-date":            date,
		"x-acs-signature-nonce": hex.EncodeToString(nonceBytes),
		"x-acs-content-sha256":  payloadHash,
	}
	canonicalQuery := canonicalBailianQuery(query)
	canonicalHeaders, signedHeaders := canonicalBailianHeaders(headers)
	canonicalRequest := strings.Join([]string{
		strings.ToUpper(method), path, canonicalQuery, canonicalHeaders,
		signedHeaders, payloadHash,
	}, "\n")
	stringToSign := bailianOpenAPIAlgorithm + "\n" + sha256Hex(canonicalRequest)
	signature := hmacSHA256Hex(accessKeySecret, stringToSign)
	headers["Authorization"] = fmt.Sprintf(
		"%s Credential=%s,SignedHeaders=%s,Signature=%s",
		bailianOpenAPIAlgorithm, accessKeyID, signedHeaders, signature,
	)
	requestURL := "https://" + host + path
	if canonicalQuery != "" {
		requestURL += "?" + canonicalQuery
	}
	return requestURL, headers, nil
}

func canonicalBailianQuery(query url.Values) string {
	type pair struct{ key, value string }
	pairs := make([]pair, 0)
	for key, values := range query {
		for _, value := range values {
			pairs = append(pairs, pair{rfc3986Encode(key), rfc3986Encode(value)})
		}
	}
	sort.Slice(pairs, func(i, j int) bool {
		if pairs[i].key == pairs[j].key {
			return pairs[i].value < pairs[j].value
		}
		return pairs[i].key < pairs[j].key
	})
	parts := make([]string, 0, len(pairs))
	for _, item := range pairs {
		parts = append(parts, item.key+"="+item.value)
	}
	return strings.Join(parts, "&")
}

func canonicalBailianHeaders(headers map[string]string) (string, string) {
	names := make([]string, 0, len(headers))
	for name := range headers {
		lower := strings.ToLower(name)
		if lower == "authorization" {
			continue
		}
		if lower != "host" && lower != "content-type" && !strings.HasPrefix(lower, "x-acs-") {
			continue
		}
		names = append(names, lower)
	}
	sort.Strings(names)
	lines := make([]string, 0, len(names))
	for _, name := range names {
		lines = append(lines, name+":"+strings.TrimSpace(headers[name])+"\n")
	}
	return strings.Join(lines, ""), strings.Join(names, ";")
}

func rfc3986Encode(value string) string {
	var builder strings.Builder
	for index := 0; index < len(value); index++ {
		char := value[index]
		switch {
		case char >= 'A' && char <= 'Z',
			char >= 'a' && char <= 'z',
			char >= '0' && char <= '9',
			char == '-', char == '_', char == '.', char == '~':
			builder.WriteByte(char)
		default:
			fmt.Fprintf(&builder, "%%%02X", char)
		}
	}
	return builder.String()
}

func sha256Hex(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func hmacSHA256Hex(key, value string) string {
	mac := hmac.New(sha256.New, []byte(key))
	_, _ = mac.Write([]byte(value))
	return hex.EncodeToString(mac.Sum(nil))
}

func sanitizeBailianOpenAPIError(body []byte, accessKeyID, accessKeySecret string) string {
	text := strings.TrimSpace(string(body))
	for _, secret := range []string{accessKeyID, accessKeySecret} {
		if strings.TrimSpace(secret) != "" {
			text = strings.ReplaceAll(text, secret, "***")
		}
	}
	if len(text) > 300 {
		text = text[:300]
	}
	return text
}
