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
	"fmt"
	"hash/fnv"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

// maxETagFileSize bounds the per-request content hashing done by DiskETag.
//
// The files that actually change when the docs are updated — HTML pages, CSS,
// JSON, small assets — sit far below this cap, so we can afford a content hash
// for byte-correct revalidation. The large bundles under
// `/docs-content/_next/static/...` are content-hashed by Next.js and therefore
// immutable for a given URL; we skip hashing them and let the file server's
// `Last-Modified` handle their (cheap, always-304) revalidation instead.
const maxETagFileSize = 1 << 20 // 1 MiB

// DiskETag makes a hot-updatable docs tree revalidate correctly.
//
// The docs subtree is served `no-cache` (see Cache), so the browser revalidates
// on each load. Revalidation normally rides on `Last-Modified`, but that is
// mtime-based and ops update docs with `rsync -a`, which *preserves* mtimes —
// a replaced page could keep an unchanged `Last-Modified` and browsers would
// keep showing the stale copy for the whole revalidation window. So for each
// small regular file we attach a **content-based** ETag (FNV-1a over the bytes)
// that changes whenever the content changes, no matter how the file landed on
// disk, and we answer a matching `If-None-Match` with `304 Not Modified` so the
// per-load revalidation stays cheap.
//
// When `dir` is empty the docs are served from the embedded copy in the binary:
// the bytes are frozen for the lifetime of the process, so there is nothing to
// hot-update and the middleware is a no-op.
func DiskETag(mount, dir string) func(c *gin.Context) {
	if dir == "" {
		return func(c *gin.Context) { c.Next() }
	}
	return func(c *gin.Context) {
		if p := resolveDiskFile(dir, mount, c.Request.URL.Path); p != "" {
			if etag, ok := fileETag(p); ok {
				c.Header("ETag", etag)
				if ifNoneMatch(c.GetHeader("If-None-Match"), etag) {
					c.Status(http.StatusNotModified)
					c.Abort()
					return
				}
			}
		}
		c.Next()
	}
}

// resolveDiskFile maps a request URL to the concrete file on disk that will be
// served for it, mirroring how the static file server resolves the mount:
// the mount prefix is stripped, the path is cleaned (collapsing `..`/`.`),
// a directory resolves to its `index.html`, and the result must stay inside
// `dir`. Returns "" when the request does not map to a regular file.
func resolveDiskFile(dir, mount, requestPath string) string {
	if !strings.HasPrefix(requestPath, mount) {
		return ""
	}
	rel := strings.TrimPrefix(requestPath, mount)
	if decoded, err := url.PathUnescape(rel); err == nil {
		rel = decoded
	}
	// Clean as an absolute path so `..` segments and doubled separators are
	// removed before we ever touch the filesystem.
	fsRel := strings.TrimPrefix(path.Clean("/"+strings.TrimLeft(rel, "/")), "/")
	if fsRel == "" {
		fsRel = "index.html"
	}
	full := filepath.Join(dir, filepath.FromSlash(fsRel))

	// A directory request serves its index.html.
	if info, err := os.Stat(full); err == nil && info.IsDir() {
		full = filepath.Join(full, "index.html")
	}

	absDir, err1 := filepath.Abs(dir)
	absFull, err2 := filepath.Abs(full)
	if err1 != nil || err2 != nil {
		return ""
	}
	// Defence in depth: even after path.Clean, refuse anything that escapes dir.
	if absFull != absDir && !strings.HasPrefix(absFull, absDir+string(filepath.Separator)) {
		return ""
	}
	if info, err := os.Stat(absFull); err != nil || info.IsDir() || !info.Mode().IsRegular() {
		return ""
	}
	return absFull
}

// fileETag returns a strong content ETag for path, or ok=false when the file
// should not be hashed (missing, not a regular file, or larger than the cap).
func fileETag(path string) (etag string, ok bool) {
	info, err := os.Stat(path)
	if err != nil || !info.Mode().IsRegular() || info.Size() > maxETagFileSize {
		return "", false
	}
	f, err := os.Open(path)
	if err != nil {
		return "", false
	}
	defer f.Close()
	h := fnv.New64a()
	if _, err := io.Copy(h, f); err != nil {
		return "", false
	}
	return fmt.Sprintf("%q", fmt.Sprintf("%x", h.Sum64())), true
}

// ifNoneMatch reports whether an If-None-Match header matches etag, handling the
// `*` wildcard, comma-separated lists, and weak (`W/`) comparison per RFC 9110.
func ifNoneMatch(header, etag string) bool {
	if header == "" {
		return false
	}
	for _, cand := range strings.Split(header, ",") {
		cand = strings.TrimSpace(cand)
		if cand == "" {
			continue
		}
		if cand == "*" {
			return true
		}
		if strings.TrimPrefix(cand, "W/") == strings.TrimPrefix(etag, "W/") {
			return true
		}
	}
	return false
}
