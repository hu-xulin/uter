package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/uter-ai/uter/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

// newOriginGuardRouter builds a router with the guard installed on the
// cookie-authenticated refresh endpoint.
func newOriginGuardRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/api/user/auth/refresh", SessionCookieOriginGuard(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	return router
}

// TestSessionCookieOriginGuardRejectsCrossSiteByDefault is the regression guard
// for CSRF protection on the cookie-authenticated refresh/logout endpoints.
//
// SESSION_COOKIE_SECURE defaults to false, so an installation that never sets
// it runs in "insecure" mode. That flag governs the Secure attribute on the
// cookie — it must NOT be allowed to disable Origin validation as well, or every
// default deployment silently loses CSRF protection on /auth/refresh and
// /auth/logout. Only a loopback dev proxy is exempt.
func TestSessionCookieOriginGuardRejectsCrossSiteByDefault(t *testing.T) {
	previousSecure := common.SessionCookieSecure
	previousTrustedURLs := common.SessionCookieTrustedURLs
	t.Cleanup(func() {
		common.SessionCookieSecure = previousSecure
		common.SessionCookieTrustedURLs = previousTrustedURLs
	})
	// Default posture: SESSION_COOKIE_SECURE unset.
	common.SessionCookieSecure = false
	common.SessionCookieTrustedURLs = nil

	tests := []struct {
		name     string
		origin   string
		expected int
	}{
		{name: "cross-site origin", origin: "https://evil.example.com", expected: http.StatusForbidden},
		{name: "suffix attack", origin: "https://panel.example.com.evil.test", expected: http.StatusForbidden},
		{name: "null origin", origin: "null", expected: http.StatusForbidden},
		{name: "same origin still allowed", origin: "https://panel.example.com", expected: http.StatusNoContent},
		// A non-loopback deployment behind an HTTP reverse proxy: Origin and Host
		// differ because of the proxy, but it is not a local dev setup, so the
		// cross-site request must still be blocked.
		{name: "non-loopback proxy mismatch", origin: "https://frontend.example.com", expected: http.StatusForbidden},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			router := newOriginGuardRouter()
			request := httptest.NewRequest(http.MethodPost, "https://panel.example.com/api/user/auth/refresh", nil)
			request.Host = "panel.example.com"
			request.Header.Set("Origin", test.origin)
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)

			assert.Equal(t, test.expected, response.Code)
			assert.Empty(t, response.Header().Get("Access-Control-Allow-Origin"))
		})
	}
}

// TestSessionCookieOriginGuardAllowsLoopbackDevProxy keeps the local development
// workflow working: the Rsbuild/Vite dev server proxies from one loopback port
// to the panel on another, so Origin and Host legitimately differ.
func TestSessionCookieOriginGuardAllowsLoopbackDevProxy(t *testing.T) {
	previousSecure := common.SessionCookieSecure
	previousTrustedURLs := common.SessionCookieTrustedURLs
	t.Cleanup(func() {
		common.SessionCookieSecure = previousSecure
		common.SessionCookieTrustedURLs = previousTrustedURLs
	})
	common.SessionCookieSecure = false
	common.SessionCookieTrustedURLs = nil

	tests := []struct {
		name     string
		host     string
		origin   string
		expected int
	}{
		{name: "localhost dev proxy", host: "localhost:3000", origin: "http://localhost:3001", expected: http.StatusNoContent},
		{name: "loopback ip dev proxy", host: "127.0.0.1:3000", origin: "http://127.0.0.1:5173", expected: http.StatusNoContent},
		{name: "ipv6 loopback dev proxy", host: "[::1]:3000", origin: "http://[::1]:5173", expected: http.StatusNoContent},
		// Loopback allowance must not extend to a public host claiming a
		// loopback-looking name, nor to a cross-site origin.
		{name: "public host with localhost origin", host: "panel.example.com", origin: "http://localhost:3001", expected: http.StatusForbidden},
		{name: "cross-site on loopback host", host: "localhost:3000", origin: "https://evil.example.com", expected: http.StatusForbidden},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			router := newOriginGuardRouter()
			request := httptest.NewRequest(http.MethodPost, "http://"+test.host+"/api/user/auth/refresh", nil)
			request.Host = test.host
			request.Header.Set("Origin", test.origin)
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)

			assert.Equal(t, test.expected, response.Code)
		})
	}
}

// TestSessionCookieOriginGuardAllowsProgrammaticClients preserves support for
// non-browser clients (mobile app, curl) that send no Origin/Referer at all.
func TestSessionCookieOriginGuardAllowsProgrammaticClients(t *testing.T) {
	previousSecure := common.SessionCookieSecure
	t.Cleanup(func() { common.SessionCookieSecure = previousSecure })

	for _, secure := range []bool{false, true} {
		common.SessionCookieSecure = secure
		router := newOriginGuardRouter()
		request := httptest.NewRequest(http.MethodPost, "https://panel.example.com/api/user/auth/refresh", nil)
		request.Host = "panel.example.com"
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)

		assert.Equal(t, http.StatusNoContent, response.Code,
			"a request without Origin/Referer is a programmatic client, not CSRF")
	}
}
