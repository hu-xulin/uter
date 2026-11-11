package router

import (
	"os"
	"strings"
	"testing"
)

// TestWebRouterNoLongerServesTheStaticDocsExport pins the retirement of the
// Next.js docs site.
//
// The native docs are SPA routes whose assets live in the same `web/dist`
// tree as the dashboard. Re-introducing a `/docs-content` mount, a
// `UTER_DOCS_DIR` disk override or an iframe content prefix would split the
// docs back into a second site and silently diverge from the MDX corpus,
// so this source-level contract fails loudly if any of them comes back.
func TestWebRouterNoLongerServesTheStaticDocsExport(t *testing.T) {
	source, err := os.ReadFile("web-router.go")
	if err != nil {
		t.Fatalf("reading web-router.go: %v", err)
	}
	// Scan the code, not the prose: a comment may legitimately name the
	// retired mount to explain why it is gone, but no statement may use it.
	code := codeLines(string(source))
	for _, retired := range []string{
		"/docs-content",
		"UTER_DOCS_DIR",
		"docsContentMount",
		"DiskETag(",
	} {
		if strings.Contains(code, retired) {
			t.Errorf("web-router.go still references the retired docs export (%q)", retired)
		}
	}

	// The SPA's own embedded tree must still be the single source of assets.
	if !strings.Contains(string(source), `common.EmbedFolder(assets.BuildFS, "web/dist")`) {
		t.Error("web-router.go no longer serves the SPA from the embedded web/dist tree")
	}
}

// codeLines drops whole-line comments so the retirement guard above reads
// statements only. Trailing comments are kept: they cannot hide a retired
// identifier that a statement still uses.
func codeLines(source string) string {
	var kept []string
	for _, line := range strings.Split(source, "\n") {
		if strings.HasPrefix(strings.TrimSpace(line), "//") {
			continue
		}
		kept = append(kept, line)
	}
	return strings.Join(kept, "\n")
}
