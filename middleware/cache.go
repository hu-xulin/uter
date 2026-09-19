package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
)

// cacheVersion is emitted as `Cache-Version` for diagnostics only. It is a
// response header, so browsers never use it to decide freshness — it cannot
// invalidate an entry they already hold.
const cacheVersion = "b688f2fb5be447c25e5aa3bd063087a83db32a288bf6a4f35f2d8db310e40b14"

// isFingerprintedAsset reports whether the request targets a build artifact
// whose filename embeds a content hash, and which is therefore immutable:
//
//   - `/static/...`        the SPA's Rsbuild bundles (`index.<hash>.js`)
//   - `/_next/static/...`  the docs site's Next.js bundles
//
// A changed file always produces a new filename, so these can be cached for a
// long time without any risk of serving stale bytes.
//
// Every other path keeps a stable URL across releases: the SPA shell, the
// docs HTML, `/logo.png` and the bundled fonts. Caching those with a long
// `max-age` and no revalidation means a replaced file stays invisible in the
// browser for the whole window — replacing `web/public/logo.png` under
// `max-age=604800` left the old logo on screen for up to a week. They get
// `no-cache` instead, which lets the browser keep the bytes but requires it
// to revalidate before reusing them.
//
// Note that `no-cache` still cannot evict an entry the browser already
// stored under a longer lifetime, which is why the logo and every icon
// declaration carry a `?v=` suffix: changing the URL is the only way to
// reach a copy the browser captured before the policy was fixed.
func isFingerprintedAsset(path string) bool {
	return strings.HasPrefix(path, "/static/") ||
		strings.HasPrefix(path, "/_next/static/")
}

func Cache() func(c *gin.Context) {
	return func(c *gin.Context) {
		c.Header("Cache-Version", cacheVersion)
		if isFingerprintedAsset(c.Request.URL.Path) {
			c.Header("Cache-Control", "public, max-age=604800, immutable")
		} else {
			c.Header("Cache-Control", "no-cache")
		}
		c.Next()
	}
}
