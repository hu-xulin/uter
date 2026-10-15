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

// revalidatedExtensions are the file types served from a stable, un-hashed URL
// where a replaced file would keep its old name. They get `no-cache` so the
// browser reuses the bytes only after revalidating.
var revalidatedExtensions = map[string]bool{
	"png": true, "jpg": true, "jpeg": true, "gif": true, "webp": true,
	"ico": true, "svg": true,
	"woff": true, "woff2": true, "ttf": true, "otf": true,
}

// isRevalidatedAsset reports whether the request targets a file whose URL
// carries no content hash, so a new build cannot rename it:
//
//   - `/docs-content/...`  the exported docs site (hot-updated via rsync)
//   - `/plugins/...`       plugin bundles re-issued at runtime
//   - top-level files such as `/logo.png`, `/favicon-legacy.ico` and
//     `/uter-bimi.svg`, which are fetched **by name** (favicon probes, BIMI,
//     feed readers) and therefore cannot be cache-busted with a `?v=` suffix.
//
// Paths deeper than one segment are excluded: `/static/...` assets are hashed
// and are already handled by isFingerprintedAsset.
func isRevalidatedAsset(path string) bool {
	if strings.HasPrefix(path, "/docs-content/") || strings.HasPrefix(path, "/plugins/") {
		return true
	}
	// Top-level file only: `/logo.png` qualifies, `/static/logo.png` does not.
	if !strings.HasPrefix(path, "/") || strings.Count(path, "/") != 1 {
		return false
	}
	dot := strings.LastIndexByte(path, '.')
	if dot < 0 {
		return false
	}
	return revalidatedExtensions[strings.ToLower(path[dot+1:])]
}

func Cache() func(c *gin.Context) {
	return func(c *gin.Context) {
		c.Header("Cache-Version", cacheVersion)
		switch path := c.Request.URL.Path; {
		case isFingerprintedAsset(path):
			c.Header("Cache-Control", "public, max-age=604800, immutable")
		case isRevalidatedAsset(path):
			// See the isFingerprintedAsset comment: a replaced file keeps its
			// URL, so the browser must revalidate instead of reusing it.
			c.Header("Cache-Control", "no-cache")
		default:
			c.Header("Cache-Control", "max-age=604800")
		}
		c.Next()
	}
}
