package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// This file implements the SECONDARY upstream discovery path: logging into an
// upstream gateway's web console with a username/password to cross-check the
// model list and price table that the PRIMARY API Key + base_url path returns.
//
// Security invariants (do not relax):
//   - The login URL is validated against the SSRF policy before every request,
//     including redirects (GetSSRFProtectedHTTPClient installs the redirect
//     guard). Private/loopback/link-local targets are rejected by default.
//   - Every request has a hard timeout and a bounded response body.
//   - The password is never written to logs, error strings, or responses.

const (
	upstreamConsoleTimeout      = 12 * time.Second
	upstreamConsoleMaxBodyBytes = 8 << 20 // 8 MiB
)

var (
	ErrUpstreamConsoleURL   = errors.New("invalid upstream console URL")
	ErrUpstreamConsoleLogin = errors.New("upstream console login failed")
)

// Console status values. The login path is ALWAYS secondary to the primary
// API Key + base_url discovery. When credentials are absent or login fails,
// status tells the caller to fall back to the primary path unchanged.
const (
	ConsoleStatusSuccess       = "success"
	ConsoleStatusNotConfigured = "not_configured"
	ConsoleStatusLoginFailed   = "login_failed"
)

// UpstreamConsoleCatalog is the result of a secondary login-based fetch. It is
// intentionally read-only: it never mutates channel pricing. Operators compare
// it with the primary path and apply changes explicitly.
type UpstreamConsoleCatalog struct {
	Status          string                 `json:"status"`
	LoginSucceeded  bool                   `json:"login_succeeded"`
	FallbackPrimary bool                   `json:"fallback_primary"`
	Models          []string               `json:"models"`
	Prices          []UpstreamConsolePrice `json:"prices"`
	Warnings        []string               `json:"warnings,omitempty"`
}

// UpstreamConsolePrice is one price row discovered from the console. Fields are
// kept generic because upstream gateways expose price tables in several shapes.
type UpstreamConsolePrice struct {
	Model       string  `json:"model"`
	InputPrice  float64 `json:"input_price,omitempty"`
	OutputPrice float64 `json:"output_price,omitempty"`
	Currency    string  `json:"currency,omitempty"`
	Raw         any     `json:"raw,omitempty"`
}

type upstreamLoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// FetchUpstreamConsoleCatalog logs into loginURL (new-api compatible console)
// with the supplied credentials and reads the model + price catalogue.
// password is plaintext in memory only (decrypted by the caller).
func FetchUpstreamConsoleCatalog(ctx context.Context, loginURL, username, password string) (UpstreamConsoleCatalog, error) {
	result := UpstreamConsoleCatalog{
		Status: ConsoleStatusNotConfigured,
		Models: []string{}, Prices: []UpstreamConsolePrice{},
	}

	// No credentials configured: this is not an error. The caller keeps the
	// primary API Key + base_url result as the single source of truth.
	if strings.TrimSpace(loginURL) == "" || strings.TrimSpace(username) == "" || password == "" {
		return result, nil
	}

	base, err := normalizeUpstreamConsoleBaseURL(loginURL)
	if err != nil {
		return result, fmt.Errorf("%w: %v", ErrUpstreamConsoleURL, err)
	}
	// Fail closed: apply the same SSRF policy used for arbitrary user URLs.
	if err := ValidateSSRFProtectedFetchURL(base.String()); err != nil {
		result.Status = ConsoleStatusLoginFailed
		return result, fmt.Errorf("%w: blocked by SSRF policy", ErrUpstreamConsoleURL)
	}

	client := GetSSRFProtectedHTTPClient()
	requestCtx, cancel := context.WithTimeout(ctx, upstreamConsoleTimeout)
	defer cancel()

	cookies, token, err := loginUpstreamConsole(requestCtx, client, base, username, password)
	if err != nil {
		result.Status = ConsoleStatusLoginFailed
		return result, err
	}
	result.LoginSucceeded = true
	result.Status = ConsoleStatusSuccess

	// Models from the console. Authorization header is added when a token is
	// available; session cookies always travel with the request.
	models, warn := fetchConsoleModels(requestCtx, client, base, cookies, token)
	result.Models = models
	if warn != "" {
		result.Warnings = append(result.Warnings, warn)
	}

	prices, warn := fetchConsolePrices(requestCtx, client, base, cookies, token)
	result.Prices = prices
	if warn != "" {
		result.Warnings = append(result.Warnings, warn)
	}

	return result, nil
}

// normalizeUpstreamConsoleBaseURL accepts only absolute http(s) URLs and drops
// any path/query/fragment so endpoints are appended from a clean origin.
func normalizeUpstreamConsoleBaseURL(raw string) (*url.URL, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, errors.New("empty URL")
	}
	parsed, err := url.Parse(trimmed)
	if err != nil {
		return nil, errors.New("malformed URL")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return nil, errors.New("unsupported scheme")
	}
	if parsed.Host == "" {
		return nil, errors.New("missing host")
	}
	// Reject embedded credentials to avoid accidental credential leakage in URLs.
	if parsed.User != nil {
		return nil, errors.New("embedded credentials are not allowed")
	}
	clean := &url.URL{Scheme: parsed.Scheme, Host: parsed.Host}
	return clean, nil
}

// loginUpstreamConsole performs a new-api style JSON login and collects both
// session cookies and a bearer token. It returns no password-derived error text.
func loginUpstreamConsole(ctx context.Context, client *http.Client, base *url.URL, username, password string) ([]*http.Cookie, string, error) {
	endpoint := base.ResolveReference(&url.URL{Path: "/api/user/login"}).String()
	payload, err := json.Marshal(upstreamLoginRequest{Username: username, Password: password})
	if err != nil {
		return nil, "", fmt.Errorf("%w: request encode error", ErrUpstreamConsoleLogin)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, "", fmt.Errorf("%w: request build error", ErrUpstreamConsoleLogin)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		// Do not include the URL (it may carry a host) or any credential.
		return nil, "", fmt.Errorf("%w: upstream unreachable", ErrUpstreamConsoleLogin)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, upstreamConsoleMaxBodyBytes))
	if err != nil {
		return nil, "", fmt.Errorf("%w: response read error", ErrUpstreamConsoleLogin)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, "", fmt.Errorf("%w: upstream returned status %d", ErrUpstreamConsoleLogin, resp.StatusCode)
	}

	var parsed struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
		Data    any    `json:"data"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, "", fmt.Errorf("%w: invalid login response", ErrUpstreamConsoleLogin)
	}
	if !parsed.Success {
		return nil, "", fmt.Errorf("%w: credentials rejected", ErrUpstreamConsoleLogin)
	}
	token := extractToken(parsed.Data)
	return resp.Cookies(), token, nil
}

// extractToken accepts the common new-api login shapes: a bare string token or
// an object with a token field.
func extractToken(data any) string {
	switch value := data.(type) {
	case string:
		return strings.TrimSpace(value)
	case map[string]any:
		for _, key := range []string{"token", "access_token", "session", "jwt"} {
			if raw, ok := value[key].(string); ok {
				return strings.TrimSpace(raw)
			}
		}
	}
	return ""
}

func fetchConsoleModels(ctx context.Context, client *http.Client, base *url.URL, cookies []*http.Cookie, token string) ([]string, string) {
	endpoint := base.ResolveReference(&url.URL{Path: "/api/models"}).String()
	body, err := consoleGET(ctx, client, endpoint, cookies, token)
	if err != nil {
		return []string{}, "model list unavailable from console"
	}
	models := parseConsoleModels(body)
	if len(models) == 0 {
		return []string{}, "console returned no models"
	}
	return models, ""
}

func fetchConsolePrices(ctx context.Context, client *http.Client, base *url.URL, cookies []*http.Cookie, token string) ([]UpstreamConsolePrice, string) {
	endpoint := base.ResolveReference(&url.URL{Path: "/api/pricing"}).String()
	body, err := consoleGET(ctx, client, endpoint, cookies, token)
	if err != nil {
		return []UpstreamConsolePrice{}, "price table unavailable from console"
	}
	prices := parseConsolePrices(body)
	if len(prices) == 0 {
		return []UpstreamConsolePrice{}, "console returned no prices"
	}
	return prices, ""
}

func consoleGET(ctx context.Context, client *http.Client, endpoint string, cookies []*http.Cookie, token string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	for _, cookie := range cookies {
		req.AddCookie(cookie)
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("status %d", resp.StatusCode)
	}
	return io.ReadAll(io.LimitReader(resp.Body, upstreamConsoleMaxBodyBytes))
}

// parseConsoleModels accepts either {"data":[...]} or a bare array, where
// entries are strings or objects carrying a model/id/name field.
func parseConsoleModels(body []byte) []string {
	var payload any
	if err := json.Unmarshal(body, &payload); err != nil {
		return []string{}
	}
	root := payload
	if obj, ok := payload.(map[string]any); ok {
		if data, exists := obj["data"]; exists {
			root = data
		}
	}
	items, ok := root.([]any)
	if !ok {
		return []string{}
	}
	seen := map[string]bool{}
	out := make([]string, 0, len(items))
	for _, item := range items {
		var name string
		switch value := item.(type) {
		case string:
			name = value
		case map[string]any:
			for _, key := range []string{"model", "model_name", "id", "name"} {
				if raw, ok := value[key].(string); ok {
					name = raw
					break
				}
			}
		}
		name = strings.TrimSpace(name)
		if name != "" && !seen[name] {
			seen[name] = true
			out = append(out, name)
		}
	}
	return out
}

// parseConsolePrices accepts {"data":[...]} or a bare array of price rows with
// a model identifier and optional numeric input/output price fields.
func parseConsolePrices(body []byte) []UpstreamConsolePrice {
	var payload any
	if err := json.Unmarshal(body, &payload); err != nil {
		return []UpstreamConsolePrice{}
	}
	root := payload
	if obj, ok := payload.(map[string]any); ok {
		if data, exists := obj["data"]; exists {
			root = data
		}
	}
	items, ok := root.([]any)
	if !ok {
		return []UpstreamConsolePrice{}
	}
	out := make([]UpstreamConsolePrice, 0, len(items))
	for _, item := range items {
		row, ok := item.(map[string]any)
		if !ok {
			continue
		}
		var model string
		for _, key := range []string{"model", "model_name", "name", "id"} {
			if raw, ok := row[key].(string); ok {
				model = strings.TrimSpace(raw)
				if model != "" {
					break
				}
			}
		}
		if model == "" {
			continue
		}
		out = append(out, UpstreamConsolePrice{
			Model:       model,
			InputPrice:  numberField(row, "input_price", "prompt_price", "model_price"),
			OutputPrice: numberField(row, "output_price", "completion_price"),
			Currency:    stringField(row, "currency"),
			Raw:         row,
		})
	}
	return out
}

func numberField(row map[string]any, keys ...string) float64 {
	for _, key := range keys {
		switch value := row[key].(type) {
		case float64:
			return value
		case json.Number:
			if parsed, err := value.Float64(); err == nil {
				return parsed
			}
		case string:
			var parsed float64
			if _, err := fmt.Sscanf(value, "%f", &parsed); err == nil {
				return parsed
			}
		}
	}
	return 0
}

func stringField(row map[string]any, key string) string {
	if value, ok := row[key].(string); ok {
		return strings.TrimSpace(value)
	}
	return ""
}
