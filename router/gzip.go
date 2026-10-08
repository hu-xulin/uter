package router

import (
	"regexp"
	"strings"

	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"
)

// relayPathPrefixes / relayPathRe 用于识别 relay 路由（与旧 web-router 排除项保持一致）。
// relay 路径的 gzip 由 costopt.GzipEnabled 单独控制；web 路径始终压缩。
var (
	relayPathPrefixes = []string{"/v1", "/pg", "/mj", "/api/costopt"}
	relayPathRe       = regexp.MustCompile(`^/[^/]+/mj`)
)

func isRelayPath(path string) bool {
	for _, p := range relayPathPrefixes {
		if strings.HasPrefix(path, p) {
			return true
		}
	}
	return relayPathRe.MatchString(path)
}

// GzipMiddleware 单一 gzip 中间件（引擎级注册一次，所有路由共享）。
//
// 设计动机：此前曾有两层 gin-contrib gzip——web 全局 gzip（引擎级）+ costopt 的
// gzip（引擎级或 relay 分组级）。二者叠加会在 relay/Web 响应上压缩两次，浏览器解一层
// 后把剩余 gzip 流当文本渲染（整页乱码）；而把 costopt gzip 仅放到 relay 分组级时，
// 因 gin 的引擎/分组中间件顺序（relay 分组先于 web 的 router.Use 创建，分组的 gzip
// 实际不生效），relay 在 GzipEnabled=true 时仍不被压缩——开关形同虚设。
//
// 故改为单一中间件：每个请求只调用一次 gin-contrib gzip，按路径分流：
//   - web / api / dashboard 等：客户端声明支持 gzip 即压缩（与旧行为一致）；
//   - relay 路径：仅当 costopt.GzipEnabled() 为真时才压缩。
//
// 这样既保留「可按配置开关 relay gzip」的能力，又保证每个响应恰好压缩一次。
func GzipMiddleware() gin.HandlerFunc {
	gz := gzip.Gzip(gzip.DefaultCompression)
	return func(c *gin.Context) {
		// 客户端未声明支持 gzip 时不压缩（gin-contrib 内部也会再校验一次，这里提前短路）。
		if !strings.Contains(c.GetHeader("Accept-Encoding"), "gzip") {
			c.Next()
			return
		}
		if isRelayPath(c.Request.URL.Path) && !costoptcfg.GetCostOptSetting().GzipEnabled {
			c.Next()
			return
		}
		gz(c)
	}
}
