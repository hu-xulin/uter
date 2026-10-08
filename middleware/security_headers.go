package middleware

import (
	"github.com/gin-gonic/gin"
)

// SecurityHeaders 为所有响应补齐基线安全响应头（2026-10-07 上线前加固）。
//
// 取舍说明：
//   - 不设置 X-Powered-By：Go/Gin 默认本就不输出，显式声明避免上游网关补写。
//   - CSP 只约束 frame-ancestors / object-src / base-uri，**刻意不约束 script-src**：
//     web/index.html 与 docs-web 的 bootstrap 都有内联 <script>（主题防闪烁），
//     一旦上 script-src 'self' 会直接把首屏打白。真正的 script-src 需要先做
//     nonce/hash 改造，属独立工作项，不在本次上线加固范围内。
//   - frame-ancestors 'self' 不会误伤文档站：SPA 的 /docs、/about 是同源 iframe
//     （/docs-content/...），同源被允许；拦的是第三方站点点击劫持。
//   - 不设置 Cross-Origin-Opener-Policy，避免影响 OAuth / 支付等弹窗流程。
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.Writer.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "SAMEORIGIN")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		h.Set("Content-Security-Policy", "frame-ancestors 'self'; object-src 'none'; base-uri 'self'")
		h.Set("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
		h.Del("X-Powered-By")
		c.Next()
	}
}
