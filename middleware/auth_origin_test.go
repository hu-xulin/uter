package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/uter-ai/uter/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func runOriginGuardRequest(t *testing.T, origin, referer string) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/api/user/auth/refresh", SessionCookieOriginGuard(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodPost, "https://panel.example.com/api/user/auth/refresh", nil)
	request.Host = "panel.example.com"
	request.Header.Set("Origin", origin)
	if origin == "" {
		request.Header.Del("Origin")
	}
	if referer != "" {
		request.Header.Set("Referer", referer)
	}
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

func TestSessionCookieOriginGuard(t *testing.T) {
	previousSecure := common.SessionCookieSecure
	previousTrustedURLs := common.SessionCookieTrustedURLs
	common.SessionCookieSecure = true
	common.SessionCookieTrustedURLs = []string{"https://trusted.example.com"}
	t.Cleanup(func() {
		common.SessionCookieSecure = previousSecure
		common.SessionCookieTrustedURLs = previousTrustedURLs
	})

	tests := []struct {
		name     string
		origin   string
		referer  string
		expected int
	}{
		{name: "same origin", origin: "https://panel.example.com", expected: http.StatusNoContent},
		{name: "trusted exact origin", origin: "https://trusted.example.com", expected: http.StatusNoContent},
		{name: "referer fallback", referer: "https://panel.example.com/profile", expected: http.StatusNoContent},
		// No Origin and no Referer: allowed through for programmatic clients
		// (mobile app / curl). Browsers always attach Origin to a cross-origin
		// unsafe request, so its absence is not a CSRF signal — rejecting it
		// would break non-browser clients without adding protection.
		{name: "missing both", expected: http.StatusNoContent},
		// A malformed Origin IS a browser context we could not validate, and
		// must fail closed. "null" is what a sandboxed iframe / data: document
		// sends; previously it short-circuited the guard and was let through.
		{name: "null origin", origin: "null", expected: http.StatusForbidden},
		{name: "suffix attack", origin: "https://trusted.example.com.evil.test", expected: http.StatusForbidden},
		{name: "scheme mismatch", origin: "http://panel.example.com", expected: http.StatusForbidden},
		{name: "path in origin", origin: "https://panel.example.com/profile", expected: http.StatusForbidden},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			response := runOriginGuardRequest(t, test.origin, test.referer)
			assert.Equal(t, test.expected, response.Code)
			assert.Empty(t, response.Header().Get("Access-Control-Allow-Origin"))
		})
	}
}

// TestSessionCookieOriginGuardDevelopmentCompatibility pins the local
// development carve-out: a loopback-to-loopback dev proxy stays allowed in
// insecure mode, while the very same origin is rejected once secure cookie mode
// is on. SESSION_COOKIE_SECURE gates cookie attributes and the dev exemption —
// it is not a CSRF kill switch, so non-loopback cross-site requests are rejected
// either way (see auth_origin_csrf_test.go).
func TestSessionCookieOriginGuardDevelopmentCompatibility(t *testing.T) {
	previousSecure := common.SessionCookieSecure
	previousTrustedURLs := common.SessionCookieTrustedURLs
	t.Cleanup(func() {
		common.SessionCookieSecure = previousSecure
		common.SessionCookieTrustedURLs = previousTrustedURLs
	})
	common.SessionCookieTrustedURLs = nil

	tests := []struct {
		name     string
		secure   bool
		origin   string
		expected int
	}{
		{name: "insecure mode allows loopback dev proxy origins", origin: "http://localhost:3001", expected: http.StatusNoContent},
		{name: "insecure mode allows missing origin", expected: http.StatusNoContent},
		{name: "secure mode rejects loopback dev proxy origins", secure: true, origin: "http://localhost:3001", expected: http.StatusForbidden},
		{name: "secure mode allows missing origin for programmatic clients", secure: true, expected: http.StatusNoContent},
		// A cross-site origin is rejected regardless of the cookie-secure flag.
		{name: "insecure mode still rejects cross-site origin", origin: "https://evil.example.com", expected: http.StatusForbidden},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			common.SessionCookieSecure = test.secure

			gin.SetMode(gin.TestMode)
			router := gin.New()
			router.POST("/api/user/auth/refresh", SessionCookieOriginGuard(), func(c *gin.Context) {
				c.Status(http.StatusNoContent)
			})
			request := httptest.NewRequest(http.MethodPost, "http://localhost:3000/api/user/auth/refresh", nil)
			request.Host = "localhost:3000"
			if test.origin != "" {
				request.Header.Set("Origin", test.origin)
			}
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)

			assert.Equal(t, test.expected, response.Code)
			assert.Empty(t, response.Header().Get("Access-Control-Allow-Origin"))
		})
	}
}

func TestSessionCookieOriginGuardDoesNotTrustForwardedProtoFromClient(t *testing.T) {
	previousSecure := common.SessionCookieSecure
	previousTrustedURLs := common.SessionCookieTrustedURLs
	common.SessionCookieSecure = true
	common.SessionCookieTrustedURLs = nil
	t.Cleanup(func() {
		common.SessionCookieSecure = previousSecure
		common.SessionCookieTrustedURLs = previousTrustedURLs
	})

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/api/user/auth/refresh", SessionCookieOriginGuard(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodPost, "http://panel.example.com/api/user/auth/refresh", nil)
	request.Host = "panel.example.com"
	request.Header.Set("Origin", "https://panel.example.com")
	request.Header.Set("X-Forwarded-Proto", "https")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	assert.Equal(t, http.StatusForbidden, response.Code)
}
