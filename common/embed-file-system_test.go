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
package common

import (
	"io"
	"os"
	"path/filepath"
	"testing"
)

// TestDiskFolder covers the disk-backed ServeFileSystem used for hot-swapping
// the docs export (UTER_DOCS_DIR) without rebuilding/restarting. The contract
// mirrors embedFileSystem so `static.Serve` behaves identically: a request is
// servable when it names a regular file or a directory that holds an
// index.html; the mount root defers to the SPA shell.
func TestDiskFolder(t *testing.T) {
	dir := t.TempDir()

	// Directory holding an index.html → servable.
	writeTestFile(t, filepath.Join(dir, "docs", "zh", "index.html"), "<html>docs-zh</html>")
	// Plain file → servable.
	writeTestFile(t, filepath.Join(dir, "robots.txt"), "User-agent: *")
	// Directory without an index.html → NOT servable (falls through).
	if err := os.MkdirAll(filepath.Join(dir, "noindex"), 0o755); err != nil {
		t.Fatalf("mkdir noindex: %v", err)
	}

	fsys := DiskFolder(dir)
	const prefix = "/docs-content"

	cases := []struct {
		path string
		want bool
	}{
		{"/docs-content/docs/zh/index.html", true},
		{"/docs-content/docs/zh/", true}, // dir with index.html resolves
		{"/docs-content/robots.txt", true},
		{"/docs-content/noindex/", false}, // dir without index.html
		{"/docs-content/missing.html", false},
		{"/docs-content/", false}, // root defers to the SPA shell
		{"/elsewhere/docs/zh/index.html", false},
	}
	for _, tc := range cases {
		if got := fsys.Exists(prefix, tc.path); got != tc.want {
			t.Errorf("Exists(%q) = %v, want %v", tc.path, got, tc.want)
		}
	}

	// Open must return the real file bytes (not an index rewrite), which is
	// what the docs pages actually depend on.
	f, err := fsys.Open("/docs/zh/index.html")
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer f.Close()
	b, _ := io.ReadAll(f)
	if string(b) != "<html>docs-zh</html>" {
		t.Errorf("Open content = %q, want %q", string(b), "<html>docs-zh</html>")
	}
}

func writeTestFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", filepath.Dir(path), err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}
