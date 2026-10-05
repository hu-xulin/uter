package router

import "testing"

// Docs hosting model (see SetWebRouter's doc comment for the full picture):
//
//   - The SPA owns the clean, encoding-free host routes `/docs` and
//     `/docs/<lang>/<page>` and frames the statically exported docs site.
//   - The exported content lives under the Next.js `basePath`
//     `/docs-content` and is mounted at that prefix by this router.
//
// There are no longer any `/docs/*` classifier helpers to unit test in
// Go — the SPA route tree resolves those internally — so this file pins
// the one invariant the Go side must keep in lockstep with the SPA and
// the docs-web build: the mount prefix.

func TestDocsContentMount(t *testing.T) {
	// Must stay in sync with `docs-web/next.config.mjs#basePath`,
	// `docs-web/scripts/copy-to-web.mjs`, and
	// `web/src/lib/docs-link.ts#DOCS_CONTENT_PREFIX`.
	if docsContentMount != "/docs-content" {
		t.Fatalf("docsContentMount = %q, want %q", docsContentMount, "/docs-content")
	}
}
