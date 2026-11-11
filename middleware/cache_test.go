package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

// TestCachePolicyForNativeDocsAssets locks in the cache semantics that moved
// with the docs convergence.
//
// The retired `/docs-content/` tree was revalidated as a whole. Its files now
// ship from the SPA root (`/docs-search/`, `/user-guide/`, `/apps-assets/`,
// …), where a stable URL would otherwise fall through to the week-long
// `max-age` default: a rebuilt search index or screenshot would stay stale in
// the browser for seven days.
func TestCachePolicyForNativeDocsAssets(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(Cache())
	r.GET("/*any", func(c *gin.Context) { c.Status(http.StatusOK) })

	revalidated := []string{
		"/docs-search/en.json",
		"/docs-search/zh-TW.json",
		"/user-guide/zh/auth/light/01-login.webp",
		"/user-guide/en/auth/dark/01-login.webp",
		"/apps-assets/aionui/aionui-logo.webp",
		"/about-assets/founder.webp",
		"/img/partners/glm.svg",
		"/plugins/demo.js",
		"/logo.png",
	}
	for _, path := range revalidated {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
		assert.Equal(t, "no-cache", w.Header().Get("Cache-Control"), "path %s", path)
	}

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/static/js/index.deadbeef.js", nil))
	assert.Equal(t, "public, max-age=604800, immutable", w.Header().Get("Cache-Control"))
}

// TestRetiredDocsPathsAreNotSpecialCased keeps the Next.js-era branches from
// creeping back into the classifier.
func TestRetiredDocsPathsAreNotSpecialCased(t *testing.T) {
	assert.False(t, isFingerprintedAsset("/_next/static/chunks/main.js"),
		"Next.js hashed bundles belong to the retired static export")
	assert.False(t, isRevalidatedAsset("/docs-content/docs/zh/index.html"),
		"the /docs-content mount no longer exists; it must not be revalidated specially")
}
