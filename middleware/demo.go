package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/i18n"
	"github.com/uter-ai/uter/setting/operation_setting"
)

// DemoSiteReadOnly enforces the demo-site read-only mode. When
// operation_setting.DemoSiteEnabled is true, every mutating request
// (POST/PUT/PATCH/DELETE) on the admin/console API is rejected with a clear
// message, except a small allow-list of writes that must keep working for the
// site to function: authentication, account recovery, OAuth flows, and payment
// webhooks. Read operations (GET/HEAD/OPTIONS) are always allowed.
//
// The relay API (/v1, /v1beta, /mj, /pg) is registered by SetRelayRouter as a
// separate engine-level group and is never touched by this middleware, so demo
// visitors can still consume the product (chat completions, etc.).
func DemoSiteReadOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !operation_setting.DemoSiteEnabled {
			c.Next()
			return
		}
		switch c.Request.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			c.Next()
			return
		}
		if isDemoAllowedWrite(c.Request.URL.Path) {
			c.Next()
			return
		}
		// 演示站只读模式：拒绝一切敏感写操作。
		common.ApiErrorI18n(c, i18n.MsgDemoSiteReadOnly)
		c.Abort()
	}
}

// demoAllowedWritePrefixes lists the mutating endpoints that remain available in
// demo-site read-only mode. These are operational (auth, account recovery,
// OAuth) or server-to-server (payment webhooks) and are not the "sensitive
// admin writes" the read-only mode is meant to block.
var demoAllowedWritePrefixes = []string{
	"/api/user/login",         // login + /login/2fa /login/verify /login/passkey/*
	"/api/user/register",      // self-service signup
	"/api/user/reset",         // password reset (POST)
	"/api/user/passkey/login", // passkey login begin/finish
	"/api/user/auth/refresh",  // session refresh
	"/api/user/auth/logout",   // session logout
	"/api/verify",             // universal security verification
	"/api/oauth/",             // OAuth authorization/binding flows
	"/api/ratio_config",       // public ratio config (GET)
	"/api/setup",              // initial setup (only reachable pre-init)
	"/api/stripe/webhook",     // payment webhooks (server-to-server)
	"/api/creem/webhook",
	"/api/waffo/webhook",
	"/api/waffo-pancake/webhook",
	"/api/user/epay/notify",
	"/api/user/alipay/notify",
	"/api/user/wechat/notify",
}

// isDemoAllowedWrite reports whether a mutating request to path is on the
// allow-list of writes that must remain available in demo read-only mode.
func isDemoAllowedWrite(path string) bool {
	for _, p := range demoAllowedWritePrefixes {
		if strings.HasPrefix(path, p) {
			return true
		}
	}
	return false
}
