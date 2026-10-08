/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestFileETagContentBased(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "page.html")
	if err := os.WriteFile(p, []byte("<html>v1</html>"), 0o644); err != nil {
		t.Fatal(err)
	}
	e1, ok := fileETag(p)
	if !ok {
		t.Fatal("fileETag returned ok=false")
	}
	// Rewrite content but force the SAME mtime — the rsync -a scenario. A
	// content-based ETag must still change so the browser is not stuck stale.
	stamp := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	if err := os.WriteFile(p, []byte("<html>v2-longer</html>"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(p, stamp, stamp); err != nil {
		t.Fatal(err)
	}
	e2, ok := fileETag(p)
	if !ok {
		t.Fatal("fileETag returned ok=false after rewrite")
	}
	if e1 == e2 {
		t.Fatalf("ETag unchanged after content change with fixed mtime: %s", e1)
	}

	// Directory and missing files are not hashable.
	if _, ok := fileETag(dir); ok {
		t.Error("expected ok=false for a directory")
	}
	if _, ok := fileETag(filepath.Join(dir, "missing")); ok {
		t.Error("expected ok=false for a missing file")
	}
	// Over the size cap → skipped (immutable bundles handled via Last-Modified).
	big := filepath.Join(dir, "big.bin")
	if err := os.WriteFile(big, make([]byte, maxETagFileSize+1), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, ok := fileETag(big); ok {
		t.Error("expected ok=false for a file over the size cap")
	}
}

func TestResolveDiskFile(t *testing.T) {
	dir := t.TempDir()
	mk := func(rel string) {
		t.Helper()
		full := filepath.Join(dir, filepath.FromSlash(rel))
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	mk("docs/zh/index.html")
	mk("about/en/index.html")
	mk("robots.txt")

	got := func(urlPath string) string {
		t.Helper()
		return resolveDiskFile(dir, "/docs-content", urlPath)
	}
	rel := func(p string) string {
		if p == "" {
			return ""
		}
		r, err := filepath.Rel(dir, p)
		if err != nil {
			t.Fatal(err)
		}
		return filepath.ToSlash(r)
	}

	if r := rel(got("/docs-content/docs/zh/index.html")); r != "docs/zh/index.html" {
		t.Errorf("explicit file → %q", r)
	}
	if r := rel(got("/docs-content/docs/zh/")); r != "docs/zh/index.html" {
		t.Errorf("dir request → %q", r)
	}
	if r := rel(got("/docs-content/robots.txt")); r != "robots.txt" {
		t.Errorf("root file → %q", r)
	}
	if r := rel(got("/docs-content/docs/zh")); r != "docs/zh/index.html" {
		t.Errorf("dir without slash → %q", r)
	}
	// Outside the mount, missing file, and traversal attempts resolve to "".
	for _, u := range []string{
		"/other/docs/zh/index.html",
		"/docs-content/nope.html",
		"/docs-content/../../../etc/passwd",
		"/docs-content/docs/../../..",
	} {
		if p := got(u); p != "" {
			t.Errorf("resolveDiskFile(%q) = %q, want \"\"", u, rel(p))
		}
	}
}

func TestIfNoneMatch(t *testing.T) {
	const etag = `"abc123"`
	cases := []struct {
		header string
		want   bool
	}{
		{"", false},
		{`"abc123"`, true},
		{`"other", "abc123"`, true},
		{`W/"abc123"`, true},
		{`"nope"`, false},
		{"*", true},
	}
	for _, tc := range cases {
		if got := ifNoneMatch(tc.header, etag); got != tc.want {
			t.Errorf("ifNoneMatch(%q) = %v, want %v", tc.header, got, tc.want)
		}
	}
}

// TestDiskETagMiddleware drives the middleware end-to-end: a first request gets
// an ETag, a conditional request with that ETag gets 304 and is NOT passed
// downstream, and a non-matching validator falls through to the handler.
func TestDiskETagMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)
	dir := t.TempDir()
	page := filepath.Join(dir, "docs", "zh", "index.html")
	if err := os.MkdirAll(filepath.Dir(page), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(page, []byte("<html>hi</html>"), 0o644); err != nil {
		t.Fatal(err)
	}

	var reached int
	r := gin.New()
	r.Use(DiskETag("/docs-content", dir))
	r.GET("/docs-content/*any", func(c *gin.Context) { reached++; c.String(http.StatusOK, "served") })

	// 1) plain request → handler runs, ETag present.
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/docs-content/docs/zh/index.html", nil))
	if w.Code != http.StatusOK || reached != 1 {
		t.Fatalf("plain: code=%d reached=%d", w.Code, reached)
	}
	etag := w.Header().Get("ETag")
	if etag == "" {
		t.Fatal("plain: missing ETag header")
	}

	// 2) conditional request with matching ETag → 304, handler NOT reached.
	reached = 0
	w = httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/docs-content/docs/zh/index.html", nil)
	req.Header.Set("If-None-Match", etag)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusNotModified {
		t.Fatalf("conditional: code=%d, want 304", w.Code)
	}
	if reached != 0 {
		t.Errorf("conditional: handler reached=%d, want 0 (should short-circuit)", reached)
	}

	// 3) non-matching validator → falls through, fresh content served.
	reached = 0
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/docs-content/docs/zh/index.html", nil)
	req.Header.Set("If-None-Match", `"stale"`)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK || reached != 1 {
		t.Fatalf("stale validator: code=%d reached=%d", w.Code, reached)
	}
}

// TestDiskETagNoopWhenEmbedded documents that an empty dir (embedded docs)
// disables the middleware entirely.
func TestDiskETagNoopWhenEmbedded(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var reached int
	r := gin.New()
	r.Use(DiskETag("/docs-content", ""))
	r.GET("/docs-content/*any", func(c *gin.Context) { reached++; c.String(http.StatusOK, "served") })
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/docs-content/docs/zh/index.html", nil))
	if reached != 1 {
		t.Fatalf("noop: handler reached=%d, want 1", reached)
	}
	if got := w.Header().Get("ETag"); strings.TrimSpace(got) != "" {
		t.Errorf("noop: unexpected ETag %q", got)
	}
}
