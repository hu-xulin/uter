package service

import (
	"net/url"
	"testing"
)

func TestValidateWorkerRequestURLScheme(t *testing.T) {
	tests := []struct {
		name      string
		rawURL    string
		allowHTTP bool
		wantErr   bool
	}{
		{name: "https accepted", rawURL: "https://example.com/path", wantErr: false},
		{name: "http blocked by default", rawURL: "http://example.com/path", wantErr: true},
		{name: "http accepted when enabled", rawURL: "http://example.com/path", allowHTTP: true, wantErr: false},
		{name: "lookalike scheme blocked", rawURL: "https-malformed://example.com/path", allowHTTP: true, wantErr: true},
		{name: "ftp blocked", rawURL: "ftp://example.com/file", allowHTTP: true, wantErr: true},
		{name: "relative URL blocked", rawURL: "/internal", allowHTTP: true, wantErr: true},
		{name: "missing host blocked", rawURL: "https:///path", allowHTTP: true, wantErr: true},
		{name: "userinfo blocked", rawURL: "https://user:pass@example.com/path", allowHTTP: true, wantErr: true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := validateWorkerRequestURLScheme(tc.rawURL, tc.allowHTTP)
			if (err != nil) != tc.wantErr {
				t.Fatalf("validateWorkerRequestURLScheme(%q, %t) error = %v, wantErr %t", tc.rawURL, tc.allowHTTP, err, tc.wantErr)
			}
		})
	}
}


func TestValidateWorkerRequestTargetPreventsDNSRebinding(t *testing.T) {
	tests := []struct {
		name                 string
		rawURL               string
		enableSSRFProtection bool
		allowPrivateIp       bool
		applyIPFilter        bool
		wantErr              bool
	}{
		{name: "domain rejected when DNS IP filtering is enabled", rawURL: "https://example.com/file", enableSSRFProtection: true, allowPrivateIp: false, applyIPFilter: true, wantErr: true},
		{name: "IPv4 literal accepted after prior policy validation", rawURL: "https://93.184.216.34/file", enableSSRFProtection: true, allowPrivateIp: false, applyIPFilter: true, wantErr: false},
		{name: "IPv6 literal accepted after prior policy validation", rawURL: "https://[2001:4860:4860::8888]/file", enableSSRFProtection: true, allowPrivateIp: false, applyIPFilter: true, wantErr: false},
		{name: "domain rejected when private addresses are blocked but IP list filtering is disabled", rawURL: "https://example.com/file", enableSSRFProtection: true, allowPrivateIp: false, applyIPFilter: false, wantErr: true},
		{name: "domain allowed only when private IPs and domain IP filtering are explicitly allowed", rawURL: "https://example.com/file", enableSSRFProtection: true, allowPrivateIp: true, applyIPFilter: false, wantErr: false},
		{name: "protection disabled retains compatibility", rawURL: "https://example.com/file", enableSSRFProtection: false, allowPrivateIp: false, applyIPFilter: true, wantErr: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := validateWorkerRequestTarget(tc.rawURL, tc.enableSSRFProtection, tc.allowPrivateIp, tc.applyIPFilter)
			if (err != nil) != tc.wantErr {
				t.Fatalf("validateWorkerRequestTarget(%q, %t, %t, %t) error = %v, wantErr %t", tc.rawURL, tc.enableSSRFProtection, tc.allowPrivateIp, tc.applyIPFilter, err, tc.wantErr)
			}
		})
	}
}

func TestWorkerRedirectMatchesOnlyConfiguredOrigin(t *testing.T) {
	parse := func(raw string) *url.URL {
		t.Helper()
		u, err := url.Parse(raw)
		if err != nil {
			t.Fatalf("parse %q: %v", raw, err)
		}
		return u
	}
	worker := parse("https://worker.example/path")
	tests := []struct {
		name string
		url  string
		want bool
	}{
		{name: "same origin", url: "https://worker.example/redirected", want: true},
		{name: "default https port is equivalent", url: "https://worker.example:443/redirected", want: true},
		{name: "trailing DNS dot is equivalent", url: "https://worker.example./redirected", want: true},
		{name: "different host blocked", url: "https://attacker.example/redirected", want: false},
		{name: "different port blocked", url: "https://worker.example:8443/redirected", want: false},
		{name: "scheme downgrade blocked", url: "http://worker.example/redirected", want: false},
		{name: "userinfo blocked", url: "https://user@worker.example/redirected", want: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := workerRedirectMatchesOrigin(worker, parse(tc.url)); got != tc.want {
				t.Fatalf("workerRedirectMatchesOrigin(%q) = %t, want %t", tc.url, got, tc.want)
			}
		})
	}
}
