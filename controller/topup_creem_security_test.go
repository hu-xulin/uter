package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestVerifyCreemSignatureRequiresConfiguredSecret(t *testing.T) {
	if verifyCreemSignature(`{"eventType":"checkout.completed"}`, "anything", "") {
		t.Fatal("webhook without a configured secret must be rejected")
	}
}

func TestVerifyCreemSignatureValidatesHMAC(t *testing.T) {
	payload := `{"eventType":"checkout.completed"}`
	secret := "test-secret"
	signature := generateCreemSignature(payload, secret)

	if !verifyCreemSignature(payload, signature, secret) {
		t.Fatal("valid HMAC signature should be accepted")
	}
	if verifyCreemSignature(payload, signature+"00", secret) {
		t.Fatal("modified signature must be rejected")
	}
}

func TestCreemModeMatchesConfigured(t *testing.T) {
	tests := []struct {
		name     string
		mode     string
		testMode bool
		want     bool
	}{
		{name: "test event in test mode", mode: "test", testMode: true, want: true},
		{name: "production event in production mode", mode: "prod", testMode: false, want: true},
		{name: "case and whitespace normalized", mode: " PROD ", testMode: false, want: true},
		{name: "production event rejected in test mode", mode: "prod", testMode: true, want: false},
		{name: "test event rejected in production mode", mode: "test", testMode: false, want: false},
		{name: "sandbox mode rejected", mode: "sandbox", testMode: false, want: false},
		{name: "missing mode rejected", mode: "", testMode: true, want: false},
		{name: "unknown mode rejected", mode: "staging", testMode: false, want: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := creemModeMatchesConfigured(tc.mode, tc.testMode); got != tc.want {
				t.Fatalf("creemModeMatchesConfigured(%q, %t) = %t, want %t", tc.mode, tc.testMode, got, tc.want)
			}
		})
	}
}

func TestCreemAPIClientDoesNotFollowRedirects(t *testing.T) {
	var redirectedRequest bool
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		redirectedRequest = true
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	source := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, target.URL, http.StatusFound)
	}))
	defer source.Close()

	resp, err := newCreemAPIHTTPClient().Get(source.URL)
	if err != nil {
		t.Fatalf("GET source: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusFound {
		t.Fatalf("status = %d, want %d", resp.StatusCode, http.StatusFound)
	}
	if redirectedRequest {
		t.Fatal("client followed an API redirect; credential-bearing requests must not leave the fixed provider endpoint")
	}
}

func TestReadCreemAPIResponseBodyEnforcesSizeLimit(t *testing.T) {
	withinLimit := strings.Repeat("x", int(maxCreemAPIResponseBodyBytes))
	data, err := readCreemAPIResponseBody(strings.NewReader(withinLimit))
	if err != nil {
		t.Fatalf("response at limit must be accepted: %v", err)
	}
	if len(data) != len(withinLimit) {
		t.Fatalf("response length = %d, want %d", len(data), len(withinLimit))
	}

	data, err = readCreemAPIResponseBody(strings.NewReader(withinLimit + "x"))
	if err == nil {
		t.Fatal("oversized response must be rejected")
	}
	if data != nil {
		t.Fatalf("oversized response should return nil data, got %d bytes", len(data))
	}
}
