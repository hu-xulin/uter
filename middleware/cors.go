package middleware

import (
	"os"
	"strings"

	"github.com/uter-ai/uter/common"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// CORS restricts credentialed cross-origin requests to exact origins configured
// in CORS_ALLOWED_ORIGINS. An empty setting disables cross-origin access; normal
// same-origin requests are unaffected. Do not use wildcard origins with cookies.
func CORS() gin.HandlerFunc {
	allowedOrigins := make(map[string]struct{})
	for _, raw := range strings.Split(os.Getenv("CORS_ALLOWED_ORIGINS"), ",") {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		origin, err := common.NormalizeOrigin(raw)
		if err != nil {
			common.SysError("ignoring invalid CORS_ALLOWED_ORIGINS entry")
			continue
		}
		allowedOrigins[origin] = struct{}{}
	}

	config := cors.DefaultConfig()
	config.AllowAllOrigins = false
	config.AllowCredentials = true
	config.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	// Keep the credentialed preflight allowlist explicit. A literal "*" is not
	// a wildcard for Authorization (and is not generally a wildcard for requests
	// using credentials), so reflecting it breaks authenticated cross-origin calls.
	config.AllowHeaders = []string{
		"Accept",
		"Authorization",
		"Anthropic-Beta",
		"Anthropic-Version",
		"Cache-Control",
		"Content-Type",
		"If-None-Match",
		"OpenAI-Beta",
		"OpenAI-Organization",
		"OpenAI-Project",
		"Range",
		"X-Api-Key",
		"X-Client-Request-Id",
		"X-Goog-Api-Key",
		"X-Requested-With",
		"X-Security-Proof",
		"X-Title",
	}
	config.AllowOriginFunc = func(origin string) bool {
		normalized, err := common.NormalizeOrigin(origin)
		if err != nil {
			return false
		}
		_, ok := allowedOrigins[normalized]
		return ok
	}
	return cors.New(config)
}

func Version() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Uter-Version", common.Version)
		c.Next()
	}
}
