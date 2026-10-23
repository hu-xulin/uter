package oauth

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/uter-ai/uter/setting/system_setting"
)

func configureOAuthFetchSettingForTest(t *testing.T, enabled bool) {
	t.Helper()
	fetch := system_setting.GetFetchSetting()
	original := *fetch
	t.Cleanup(func() { *fetch = original })
	fetch.EnableSSRFProtection = enabled
	fetch.AllowPrivateIp = false
	fetch.DomainFilterMode = false
	fetch.IpFilterMode = false
	fetch.DomainList = nil
	fetch.IpList = nil
	fetch.AllowedPorts = []string{"80", "443", "8080", "8443"}
	fetch.ApplyIPFilterForDomain = true
}

func TestOAuthHTTPClientDoesNotReplayCredentialsToRedirectTarget(t *testing.T) {
	configureOAuthFetchSettingForTest(t, false)
	var targetRequests atomic.Int32
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		targetRequests.Add(1)
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	source := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("source method = %s, want POST", r.Method)
		}
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("read source request body: %v", err)
		}
		if !strings.Contains(string(body), "client_secret=do-not-forward") {
			t.Errorf("source did not receive the test credential in the request body")
		}
		w.Header().Set("Location", target.URL+"/collect")
		w.WriteHeader(http.StatusTemporaryRedirect)
	}))
	defer source.Close()

	req, err := http.NewRequest(http.MethodPost, source.URL+"/token", strings.NewReader("client_id=client&client_secret=do-not-forward"))
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := newOAuthHTTPClient(time.Second)
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("Do() should return the redirect response without following it: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusTemporaryRedirect {
		t.Fatalf("status = %d, want %d", resp.StatusCode, http.StatusTemporaryRedirect)
	}
	if got := targetRequests.Load(); got != 0 {
		t.Fatalf("redirect target received %d requests, want 0", got)
	}
}

func TestOAuthHTTPClientAllowsSameOriginRedirect(t *testing.T) {
	configureOAuthFetchSettingForTest(t, false)
	var finalRequests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/token":
			w.Header().Set("Location", "/token/final")
			w.WriteHeader(http.StatusTemporaryRedirect)
		case "/token/final":
			finalRequests.Add(1)
			w.WriteHeader(http.StatusOK)
			_, _ = io.WriteString(w, "ok")
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	req, err := http.NewRequest(http.MethodPost, server.URL+"/token", strings.NewReader("client_secret=still-same-origin"))
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := newOAuthHTTPClient(time.Second).Do(req)
	if err != nil {
		t.Fatalf("same-origin redirect should be followed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", resp.StatusCode, http.StatusOK)
	}
	if got := finalRequests.Load(); got != 1 {
		t.Fatalf("final endpoint received %d requests, want 1", got)
	}
}

func TestReadOAuthResponseBodyRejectsOversizedResponse(t *testing.T) {
	body := strings.NewReader(strings.Repeat("x", int(maxOAuthResponseBodyBytes+1)))
	data, err := readOAuthResponseBody(body)
	if err == nil {
		t.Fatal("expected oversized OAuth response to be rejected")
	}
	if data != nil {
		t.Fatalf("data length = %d, want nil result on oversized body", len(data))
	}
}

func TestReadOAuthResponseBodyAcceptsResponseWithinLimit(t *testing.T) {
	want := []byte(`{"access_token":"token"}`)
	data, err := readOAuthResponseBody(strings.NewReader(string(want)))
	if err != nil {
		t.Fatalf("readOAuthResponseBody returned error: %v", err)
	}
	if string(data) != string(want) {
		t.Fatalf("body = %q, want %q", data, want)
	}
}

func TestDecodeOAuthJSONLimitRejectsOversizedResponse(t *testing.T) {
	body := strings.NewReader(`{"access_token":"valid"}` + strings.Repeat(" ", int((1<<20)+1)))
	var token map[string]any
	if err := decodeOAuthJSONLimit(body, &token, 1<<20); err == nil {
		t.Fatal("expected body larger than the configured limit to be rejected")
	}
}

func TestDecodeOAuthJSONLimitAcceptsValidResponse(t *testing.T) {
	body := strings.NewReader(`{"access_token":"valid"}`)
	var token map[string]any
	if err := decodeOAuthJSONLimit(body, &token, 1<<20); err != nil {
		t.Fatalf("decode valid response: %v", err)
	}
	if token["access_token"] != "valid" {
		t.Fatalf("access_token = %v, want valid", token["access_token"])
	}
}

func TestOAuthHTTPClientRejectsPrivateTargetsWhenSSRFProtectionEnabled(t *testing.T) {
	configureOAuthFetchSettingForTest(t, true)
	request, err := http.NewRequest(http.MethodGet, "http://127.0.0.1/metadata", nil)
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	response, err := newOAuthHTTPClient(time.Second).Do(request)
	if response != nil && response.Body != nil {
		_ = response.Body.Close()
	}
	if err == nil {
		t.Fatal("expected protected OAuth client to reject a loopback target")
	}
	if !strings.Contains(err.Error(), "private IP address not allowed") {
		t.Fatalf("error = %q, want private IP rejection", err)
	}
}

func TestOAuthHTTPClientRejectsUserinfoURLBeforeNetworkRequest(t *testing.T) {
	configureOAuthFetchSettingForTest(t, false)
	request, err := http.NewRequest(http.MethodGet, "http://user@127.0.0.1/resource", nil)
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	response, err := newOAuthHTTPClient(time.Second).Do(request)
	if response != nil && response.Body != nil {
		_ = response.Body.Close()
	}
	if err == nil || !strings.Contains(err.Error(), "invalid OAuth request URL") {
		t.Fatalf("error = %v, want invalid OAuth request URL", err)
	}
}
