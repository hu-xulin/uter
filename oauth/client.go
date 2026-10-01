package oauth

import (
	"net/http"
	"time"
)

// newOAuthHTTPClient returns an HTTP client for outbound calls to external
// OAuth provider endpoints (token exchange, user info, JWKS, etc.).
//
// It deliberately disables proxy usage. The host process may inherit an
// ephemeral loopback proxy (for example an agent/sandbox HTTP_PROXY pointing at
// 127.0.0.1:<port>) that is already dead by the time a real request runs, which
// would otherwise surface as "failed to connect to <Provider>". OAuth providers
// are public internet endpoints reached directly from a self-hosted instance, so
// going proxy-free is both safe and robust against this recurring failure mode.
func newOAuthHTTPClient(timeout time.Duration) *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = nil
	return &http.Client{
		Transport: transport,
		Timeout:   timeout,
	}
}
