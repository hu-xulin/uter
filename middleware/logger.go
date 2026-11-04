package middleware

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/uter-ai/uter/common"

	"github.com/gin-gonic/gin"
)

const RouteTagKey = "route_tag"

func RouteTag(tag string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set(RouteTagKey, tag)
		c.Next()
	}
}

func redactSensitiveAccessLogQuery(path string) string {
	routePath, rawQuery, hasQuery := strings.Cut(path, "?")
	if !hasQuery {
		return path
	}
	// OAuth callbacks and payment webhooks commonly carry one-time codes,
	// signatures, or provider parameters. Do not log any of their query strings.
	if strings.HasPrefix(routePath, "/api/oauth/") ||
		strings.HasPrefix(routePath, "/oauth/") ||
		strings.Contains(routePath, "/webhook") ||
		(strings.HasPrefix(routePath, "/api/user/") && strings.HasSuffix(routePath, "/notify")) ||
		routePath == "/api/subscription/epay/notify" ||
		routePath == "/api/subscription/epay/return" {
		return routePath
	}

	query, err := url.ParseQuery(rawQuery)
	if err != nil {
		// Malformed query strings are not worth logging verbatim: they may contain
		// an unparseable credential value or a malformed key that bypasses matching.
		return routePath
	}
	changed := false
	for key := range query {
		if !isSensitiveAccessLogQueryKey(key) {
			continue
		}
		query[key] = []string{"[REDACTED]"}
		changed = true
	}
	if !changed {
		return path
	}
	return routePath + "?" + query.Encode()
}

func isSensitiveAccessLogQueryKey(key string) bool {
	// Normalize separators and case so api-key, API_KEY, and similar aliases
	// share the same rule.
	key = strings.ToLower(strings.TrimSpace(key))
	key = strings.ReplaceAll(key, "-", "_")
	switch key {
	case "key", "api_key", "apikey", "x_api_key", "x_goog_api_key",
		"access_token", "token", "refresh_token", "id_token",
		"authorization", "auth", "signature", "sig", "sign",
		"secret", "client_secret", "password", "passwd",
		"credential", "credentials", "session", "session_id", "sid":
		return true
	default:
		return false
	}
}

func SetUpLogger(server *gin.Engine) {
	server.Use(redactTaskArtifactAccessQuery())
	server.Use(gin.LoggerWithConfig(gin.LoggerConfig{
		// 用间接 writer：日志轮转会替换 gin.DefaultWriter，
		// 这里若直接传 gin.DefaultWriter，轮转后的访问日志会写进已关闭的文件。
		Output: common.LogWriter,
		Formatter: func(param gin.LogFormatterParams) string {
			var requestID string
			if param.Keys != nil {
				requestID, _ = param.Keys[common.RequestIdKey].(string)
			}
			tag, _ := param.Keys[RouteTagKey].(string)
			if tag == "" {
				tag = "web"
			}
			path := redactSensitiveAccessLogQuery(param.Path)
			return fmt.Sprintf("[GIN] %s | %s | %s | %3d | %13v | %15s | %7s %s\n",
				param.TimeStamp.Format("2006/01/02 - 15:04:05"),
				tag,
				requestID,
				param.StatusCode,
				param.Latency,
				param.ClientIP,
				param.Method,
				path,
			)
		},
	}))
}
