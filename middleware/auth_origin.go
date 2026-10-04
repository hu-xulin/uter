package middleware

import (
	"crypto/subtle"
	"net/http"
	"net/url"
	"strings"

	"github.com/Uter-AI/Uter/common"

	"github.com/gin-gonic/gin"
)

// SessionCookieOriginGuard protects cookie-authenticated refresh/logout
// endpoints from CSRF by validating the request Origin against the server
// origin. It is always active (regardless of the Secure-cookie switch): a
// cross-site Origin header is a definitive CSRF signal and must be rejected.
//
// Requests that carry no Origin/Referer (programmatic/non-browser clients such
// as the mobile app or curl) are allowed through, preserving the legacy
// behavior for those clients while still blocking browser-based CSRF.
// It never adds CORS response headers and must not be installed on relay routes.
func SessionCookieOriginGuard() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin, ok := requestBrowserOrigin(c.Request)
		if !ok {
			// 无 Origin/Referer：非浏览器/程序化客户端，放行（不强制 CSRF 校验）
			c.Next()
			return
		}
		if !isAllowedSessionOrigin(c.Request, origin) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"code":    "AUTH_ORIGIN_FORBIDDEN",
				"message": "request origin is not allowed",
			})
			return
		}
		c.Next()
	}
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
