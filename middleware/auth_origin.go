package middleware

import (
	"crypto/subtle"
	"net"
	"net/http"
	"net/url"
	"strings"

	"github.com/Uter-AI/Uter/common"

	"github.com/gin-gonic/gin"
)

// SessionCookieOriginGuard protects cookie-authenticated refresh/logout
// endpoints from CSRF by validating the request Origin against the server
// origin. A cross-site Origin header is a definitive CSRF signal and must be
// rejected.
//
// Three request shapes are tolerated:
//
//   - No Origin/Referer at all — a programmatic client (mobile app, curl, CLI).
//     These cannot be driven by a victim's browser, so requiring an Origin
//     header would break them without adding protection.
//   - Same origin, or an explicitly trusted origin (SESSION_COOKIE_TRUSTED_URL).
//   - A loopback-to-loopback request, i.e. the local dev proxy: Rsbuild/Vite
//     serves the panel on one loopback port and proxies to another, so Origin
//     and Host legitimately differ. This exemption is deliberately narrow — it
//     requires the *request host* to be loopback too, so a public host cannot
//     borrow it, and it never applies once SESSION_COOKIE_SECURE is on.
//
// common.SessionCookieSecure governs the Secure attribute of the session cookie,
// not whether CSRF protection is active. Treating it as a kill switch silently
// disabled CSRF protection on every default deployment (the flag defaults to
// false), so the guard stays enabled regardless of it.
//
// Validation is fail-closed: a malformed Origin (e.g. the literal "null" emitted
// by sandboxed iframes and data:/blob: documents) or a duplicated
// Origin/Referer header is a definitive CSRF signal, not a marker of a
// programmatic client, so it must be rejected rather than allowed through.
// It never adds CORS response headers and must not be installed on relay routes.
func SessionCookieOriginGuard() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin, ok := requestBrowserOrigin(c.Request)
		if !ok {
			if !hasBrowserOriginHeader(c.Request) {
				// No Origin and no Referer: a programmatic client, not CSRF.
				c.Next()
				return
			}
			// A malformed or duplicated Origin/Referer is present: fail closed.
			abortForbiddenOrigin(c)
			return
		}
		if !isAllowedSessionOrigin(c.Request, origin) &&
			!isLoopbackDevRequest(c.Request, origin) {
			abortForbiddenOrigin(c)
			return
		}
		c.Next()
	}
}

func abortForbiddenOrigin(c *gin.Context) {
	c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
		"success": false,
		"code":    "AUTH_ORIGIN_FORBIDDEN",
		"message": "request origin is not allowed",
	})
}

// hasBrowserOriginHeader reports whether the request carries any Origin or
// Referer header, malformed or not. It distinguishes "no browser context" from
// "a browser context we failed to validate".
func hasBrowserOriginHeader(request *http.Request) bool {
	return len(request.Header.Values("Origin")) > 0 ||
		len(request.Header.Values("Referer")) > 0
}

// isLoopbackDevRequest allows the local development proxy, where a loopback
// origin hits a loopback request host on a different port. Both sides must be
// loopback: requiring the request host to be loopback as well stops a public
// deployment from inheriting the exemption through a spoofable Host header, and
// requiring the origin to be loopback stops a dev machine from being driven by a
// page on a real site.
func isLoopbackDevRequest(request *http.Request, origin string) bool {
	if common.SessionCookieSecure {
		return false
	}
	if !isLoopbackHost(request.Host) {
		return false
	}
	parsed, err := url.Parse(origin)
	if err != nil {
		return false
	}
	return isLoopbackHost(parsed.Host)
}

// isLoopbackHost reports whether host:port refers to the loopback interface.
// Hostnames are only accepted when they are literally "localhost" — a public
// DNS name that merely starts with "localhost" must not qualify.
func isLoopbackHost(host string) bool {
	if host == "" {
		return false
	}
	if hostname, _, err := net.SplitHostPort(host); err == nil {
		host = hostname
	}
	host = strings.Trim(host, "[]")
	if strings.EqualFold(host, "localhost") {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func requestBrowserOrigin(request *http.Request) (string, bool) {
	originValues := request.Header.Values("Origin")
	if len(originValues) > 1 {
		return "", false
	}
	if len(originValues) == 1 {
		if strings.Contains(originValues[0], ",") {
			return "", false
		}
		origin, err := common.NormalizeOrigin(originValues[0])
		return origin, err == nil
	}
	refererValues := request.Header.Values("Referer")
	if len(refererValues) != 1 {
		return "", false
	}
	referer, err := url.Parse(strings.TrimSpace(refererValues[0]))
	if err != nil || referer.Scheme == "" || referer.Host == "" || referer.User != nil {
		return "", false
	}
	origin, err := common.NormalizeOrigin(referer.Scheme + "://" + referer.Host)
	return origin, err == nil
}

func isAllowedSessionOrigin(request *http.Request, origin string) bool {
	requestScheme := "http"
	if request.TLS != nil {
		requestScheme = "https"
	}
	requestOrigin, err := common.NormalizeOrigin(requestScheme + "://" + request.Host)
	if err == nil && subtle.ConstantTimeCompare([]byte(origin), []byte(requestOrigin)) == 1 {
		return true
	}
	for _, trustedOrigin := range common.SessionCookieTrustedURLs {
		if subtle.ConstantTimeCompare([]byte(origin), []byte(trustedOrigin)) == 1 {
			return true
		}
	}
	return false
}
