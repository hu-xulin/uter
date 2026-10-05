package router

import (
	"embed"
	"net/http"
	"strings"

	"github.com/Uter-AI/Uter/common"

	"github.com/Uter-AI/Uter/controller"
	"github.com/Uter-AI/Uter/middleware"
	"github.com/gin-contrib/gzip"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
)

// WebAssets holds the embedded dashboard frontend assets.
type WebAssets struct {
	BuildFS   embed.FS
	IndexPage []byte
}

// Docs hosting model
//
// The SPA owns the clean, encoding-free host routes `/docs` and
// `/docs/<lang>/<page>` (see `web/src/routes/docs.tsx` and
// `web/src/routes/docs/$.tsx`), which render the app shell and frame the
// statically exported docs site. The exported content itself lives under
// the Next.js `basePath` `/docs-content` (set in
// `docs-web/next.config.mjs`) and is copied to `web/dist/docs-content`
// by `docs-web/scripts/copy-to-web.mjs`; this router mounts that
// directory at `/docs-content`, serving the real pages from
// `/docs-content/docs/<lang>/<page>` and `/docs-content/about/<lang>/...`.
//
// Because the SPA claims every `/docs/*` path, this file no longer needs
// the legacy `/docs/*` redirect helpers that used to funnel unknown docs
// paths back to a landing — the SPA route tree handles those.

// docsContentMount is the URL prefix the statically exported docs + About
// site is served from. It must match the Next.js `basePath` in
// `docs-web/next.config.mjs` and the copy target in
// `docs-web/scripts/copy-to-web.mjs`, and the SPA's
// `web/src/lib/docs-link.ts#DOCS_CONTENT_PREFIX`, so the framed content and
// the clean `/docs/<lang>/<page>` host routes stay in lockstep.
const docsContentMount = "/docs-content"

func SetWebRouter(router *gin.Engine, assets WebAssets, pluginDispatcher gin.HandlerFunc) {
	frontendFS := common.EmbedFolder(assets.BuildFS, "web/dist")

	// The Next.js docs + About site builds a fully static export into
	// `web/dist/docs-content/` (under the `/docs-content` basePath set in
	// `docs-web/next.config.mjs`). Mount it at `/docs-content` so the real
	// pages are served from `/docs-content/docs/<lang>/...` and
	// `/docs-content/about/<lang>/...`. The SPA keeps the clean `/docs/...`
	// host routes (which frame this content), so `/docs-content/...` never
	// collides with them. `/dashboard` and the rest of the SPA still fall
	// through to `web/dist/index.html` via the NoRoute handler below.
	docsFS := common.EmbedFolder(assets.BuildFS, "web/dist/docs-content")

	router.Use(
		middleware.RouteTag("web"),
		gzip.Gzip(gzip.DefaultCompression),
		middleware.Cache(),
		// The SPA owns every `/docs/*` path now (clean host routes that
		// frame the exported content), so there is no legacy `/docs/*`
		// redirect to perform here — the SPA route tree resolves or 404s
		// those internally. The exported content is served from
		// `/docs-content/...` by the `static.Serve("/docs-content", ...)`
		// mount at the end of this `Use` chain, which does not intercept
		// `/docs/*`.
		// The shipped icon file is `web/public/favicon-legacy.ico`, not
		// `favicon.ico`: Rsbuild auto-detects `public/favicon.{ico,png,svg}`
		// and injects an un-versioned `<link rel="icon" href="/favicon.ico">`
		// ahead of the template's versioned `/logo.png?v=N` declaration. A URL
		// addressed by filename cannot be cache-busted, so swapping the logo
		// left the stale bitmap in the browser tab.
		//
		// Clients that probe the conventional `/favicon.ico` without reading
		// the document — bookmark bars, chat unfurlers, feed readers — would
		// otherwise match nothing and fall through to the SPA shell, receiving
		// HTML where an image is expected. Point them at the un-versioned
		// `/logo.png` instead: it is served `no-cache`, so every use
		// revalidates against the current file and no version constant has to
		// be duplicated from `web/src/lib/constants.ts` into the Go side.
		func(c *gin.Context) {
			if c.Request.URL.Path == "/favicon.ico" {
				c.Redirect(http.StatusFound, "/logo.png")
				c.Abort()
				return
			}
			c.Next()
		},
		static.Serve(docsContentMount, docsFS),
	)

	router.NoRoute(
		pluginDispatcher,
		middleware.RouteTag("web"),
		// NOTE: deliberately no `gzip.Gzip` here. `router.Use` above already
		// registers it, and Gin prepends the engine's global handlers to the
		// NoRoute chain (`Use` calls `rebuild404Handlers`), so the response
		// would be compressed twice while only one `Content-Encoding: gzip`
		// header is emitted. Browsers decode one layer and then render the
		// remaining gzip stream as text — the whole SPA shell comes out as
		// mojibake. Keep gzip registered exactly once, in `router.Use`.
		middleware.AccessTokenAudit(),
		// 发件人头像（BIMI）SVG 需以 `Access-Control-Allow-Origin: *` 对外提供，
		// 供 Gmail/Apple Mail 等服务商远程拉取并展示品牌头像。
		func(c *gin.Context) {
			if c.Request.URL.Path == "/uter-bimi.svg" {
				c.Header("Access-Control-Allow-Origin", "*")
			}
			c.Next()
		},
		// 先把请求交给静态文件系统，命中真实文件即返回，**不经过**下面的
		// GlobalWebRateLimit。
		//
		// 顺序很重要：默认的 120 次 / 180 秒配额是按客户端 IP 计的，而一次冷启动
		// （首次打开、硬刷新、新标签页）会拉取 index.html + 主包 + 若干异步分片 +
		// 字体，轻易就是几十个请求。若把这些带内容哈希、可长期缓存的静态资源一并计入，
		// 两三次冷启动就触顶，之后连 index.html 本身都返回 429 —— 用户看到的是空白页
		// 或加载失败，而服务端其实毫无压力。
		//
		// 静态资源的缓存策略已由全局的 middleware.Cache 处理（不可变资源长缓存、
		// /logo.png 等 no-cache 校验），把它们排除在限流之外不会引入新的放大面；
		// 真正需要兜住的是**未命中文件、回落到 SPA 外壳**的导航请求，那才是每次都会
		// 渲染整个应用的开销所在。
		static.Serve("/", frontendFS),
		middleware.GlobalWebRateLimit(),
		middleware.Cache(),
		func(c *gin.Context) {
			if strings.HasPrefix(c.Request.RequestURI, "/v1") || strings.HasPrefix(c.Request.RequestURI, "/api") || strings.HasPrefix(c.Request.RequestURI, "/assets") {
				controller.RelayNotFound(c)
				return
			}
			c.Header("Cache-Control", "no-cache")
			c.Data(http.StatusOK, "text/html; charset=utf-8", assets.IndexPage)
		},
	)
}
