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

// docsLocale is the set of locale codes the docs site ships with.
// The SPA's docs-link helper (`web/src/lib/docs-link.ts`) keeps the
// SPA in sync; adding a locale here also requires the matching entry
// in `docs-web/src/lib/i18n.ts#SUPPORTED_DOCS_LOCALES` and content in
// `docs-web/src/lib/docs-content.ts`.
var docsLocale = map[string]struct{}{
	"zh": {},
	"en": {},
}

func isDocsLocale(code string) bool {
	_, ok := docsLocale[code]
	return ok
}

// isDocsPath reports whether a URL belongs to the docs section
// (`/docs/<lang>/...`). Used by NoRoute so unknown docs paths can be
// redirected to the docs landing instead of being served by the SPA
// shell (which has no docs route and would show a generic 404 UI).
func isDocsPath(p string) bool {
	if !strings.HasPrefix(p, "/") {
		return false
	}
	rest := strings.TrimPrefix(p, "/")
	// First segment must be "docs".
	docsPart, after, hasSep := strings.Cut(rest, "/")
	if !hasSep || docsPart != "docs" {
		return false
	}
	// Second segment is the locale.
	locale, _, hasSep2 := strings.Cut(after, "/")
	_ = hasSep2
	return isDocsLocale(locale)
}

// isBareDocsPath reports whether a URL is a legacy bare-docs entry that
// the SPA cannot reach through its own router.
//
// The exact `/docs` and `/docs/` paths are intentionally NOT matched
// here — they are owned by the SPA's `/docs` route, which reads the
// user's UI language and redirects to the locale-appropriate landing
// (`/docs/zh/` for Chinese, `/docs/en/` for everything else). Only paths
// strictly deeper than the bare entry — e.g. `/legacy/foo/` from
// stale admin `docs_link` values — are legacy redirects to the
// canonical landing.
//
// Note: with the `/docs/<lang>/` URL scheme, paths like `/docs/zh/quickstart/`
// are now valid docs paths handled by `isDocsPath` above, not bare-docs
// redirects. This function only catches paths under `/docs/` that don't
// have a valid locale as the second segment (e.g. `/docs/legacy/foo/`).
func isBareDocsPath(p string) bool {
	if !strings.HasPrefix(p, "/") {
		return false
	}
	rest := strings.TrimPrefix(p, "/")
	if rest == "docs" || rest == "docs/" {
		return false
	}
	if !strings.HasPrefix(rest, "docs/") {
		return false
	}
	// Check if the second segment is a valid docs locale. If it is,
	// this is a real docs path handled by isDocsPath, not a bare redirect.
	afterDocs := strings.TrimPrefix(rest, "docs/")
	locale, _, _ := strings.Cut(afterDocs, "/")
	if isDocsLocale(locale) {
		return false
	}
	return true
}

// docsLanding returns the canonical landing-page URL. Centralised so
// every docs-site redirect points at the same target. The canonical
// entry is the first locale in the ordered `docsLocales` slice, not
// the map — Go map iteration order is randomised, so the redirect
// target must be derived from the slice to stay deterministic.
//
// Note this is the *locale-resolved* landing. The admin-facing
// `docs_link` default in `setting/operation_setting/general_setting.go`
// is deliberately locale-free (`/docs`) and routes through the SPA's
// docs entry, which picks the locale before landing here.
func docsLanding() string {
	if len(docsLocales) == 0 {
		return "/"
	}
	return "/docs/" + docsLocales[0] + "/"
}

// docsLocales is the ordered, canonical list of docs locales. The
// SPA mirrors this ordering via `docs-link.ts#DOCS_LOCALE_PAIRS` so
// the canonical landing stays deterministic across server and client.
var docsLocales = []string{"zh", "en"}

func SetWebRouter(router *gin.Engine, assets WebAssets, pluginDispatcher gin.HandlerFunc) {
	frontendFS := common.EmbedFolder(assets.BuildFS, "web/dist")

	// The Next.js docs site builds a fully static export into
	// `web/dist/docs/` via `docs-web/scripts/copy-to-web.mjs`. The docs
	// routes live at `/docs/<lang>/...`, so we mount the embed at the
	// root and let `static.Serve` fall through to the SPA for any path
	// the embed doesn't have. `/docs/zh/...` resolves to the docs HTML;
	// `/dashboard` falls through to `web/dist/index.html`.
	docsFS := common.EmbedFolder(assets.BuildFS, "web/dist/docs")

	landing := docsLanding()

	router.Use(
		middleware.RouteTag("web"),
		gzip.Gzip(gzip.DefaultCompression),
		middleware.Cache(),
		// Legacy `/docs/<non-locale>` paths are stale and have no
		// content (the docs site is shipped under `/docs/<lang>/...`).
		// Send them to the canonical landing so stale `docs_link`
		// settings and bookmarks still resolve. The exact `/docs` and
		// `/docs/` paths are excluded so the SPA's `/docs` route can
		// read the user's UI language and redirect to the locale entry.
		func(c *gin.Context) {
			if isBareDocsPath(c.Request.URL.Path) {
				c.Redirect(http.StatusMovedPermanently, landing)
				c.Abort()
				return
			}
			c.Next()
		},
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
		static.Serve("/", docsFS),
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
		middleware.GlobalWebRateLimit(),
		middleware.Cache(),
		static.Serve("/", frontendFS),
		func(c *gin.Context) {
			// Unknown `/docs/<lang>/<x>` paths are part of the docs section
			// but the static export didn't emit them. Redirecting to
			// the landing keeps the experience intact instead of
			// showing a plain string or a SPA 404 page.
			if isDocsPath(c.Request.URL.Path) {
				c.Redirect(http.StatusMovedPermanently, landing)
				return
			}
			if strings.HasPrefix(c.Request.RequestURI, "/v1") || strings.HasPrefix(c.Request.RequestURI, "/api") || strings.HasPrefix(c.Request.RequestURI, "/assets") {
				controller.RelayNotFound(c)
				return
			}
			c.Header("Cache-Control", "no-cache")
			c.Data(http.StatusOK, "text/html; charset=utf-8", assets.IndexPage)
		},
	)
}
