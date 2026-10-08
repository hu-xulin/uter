package costopt

import (
	"strings"

	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"
)

// GzipMiddleware 按配置与客户端 Accept-Encoding 自动压缩响应。
// 仅当 GzipEnabled 开启且客户端声明支持 gzip 时压缩；常见 OpenAI 客户端对 SSE 不发送 gzip，
// 故不会干扰流式。压缩由 gin-contrib/gzip 处理，支持分块刷新。
func GzipMiddleware() gin.HandlerFunc {
	gz := gzip.Gzip(gzip.DefaultCompression)
	return func(c *gin.Context) {
		if costoptcfg.GetCostOptSetting().GzipEnabled &&
			strings.Contains(c.GetHeader("Accept-Encoding"), "gzip") {
			gz(c)
			return
		}
		c.Next()
	}
}
