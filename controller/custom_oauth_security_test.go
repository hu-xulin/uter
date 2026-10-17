package controller

import (
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func parseDiscoveryURL(t *testing.T, raw string) *url.URL {
	t.Helper()
	parsed, err := url.Parse(raw)
	require.NoError(t, err)
	return parsed
}

func TestSameCustomOAuthDiscoveryOrigin(t *testing.T) {
	tests := []struct {
		name string
		from string
		to   string
		want bool
	}{
		{name: "same origin different path", from: "https://idp.example.com/.well-known/openid-configuration", to: "https://idp.example.com/oauth/token", want: true},
		{name: "default port normalized", from: "https://idp.example.com:443/a", to: "https://idp.example.com/b", want: true},
		{name: "different host rejected", from: "https://idp.example.com/a", to: "https://evil.example.net/b", want: false},
		{name: "different scheme rejected", from: "https://idp.example.com/a", to: "http://idp.example.com/b", want: false},
		{name: "different port rejected", from: "https://idp.example.com:8443/a", to: "https://idp.example.com/b", want: false},
		{name: "redirect userinfo rejected", from: "https://idp.example.com/a", to: "https://user@idp.example.com/b", want: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, sameCustomOAuthDiscoveryOrigin(parseDiscoveryURL(t, tc.from), parseDiscoveryURL(t, tc.to)))
		})
	}
}

func TestDecodeCustomOAuthDiscoveryLimitsResponseSize(t *testing.T) {
	doc, err := decodeCustomOAuthDiscovery(strings.NewReader(`{"issuer":"https://idp.example.com"}`))
	require.NoError(t, err)
	require.Equal(t, "https://idp.example.com", doc["issuer"])

	oversized := strings.NewReader(strings.Repeat(" ", int(maxCustomOAuthDiscoveryBytes)+1))
	_, err = decodeCustomOAuthDiscovery(oversized)
	require.Error(t, err)
	require.Contains(t, err.Error(), "exceeds")
}
