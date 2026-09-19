package common

import (
	"embed"
	"errors"
	"io/fs"
	"net/http"
	"os"
	"path"
	"strings"

	"github.com/gin-contrib/static"
)

// Credit: https://github.com/gin-contrib/static/issues/19
//
// Adapts an embed.FS sub-tree to the ServeFileSystem interface used by
// `gin-contrib/static`. Two details matter for directory-backed routes:
//
//   - `Exists` must return `true` for regular files *and* for directories
//     that hold an `index.html`, because `http.FileServer` resolves the
//     index page on its own afterwards. Reporting files only makes every
//     directory request (e.g. `/dashboard/`) fall through to NoRoute
//     with a 404.
//   - Request paths must be normalized before they reach the embed FS.
//     `fs.ValidPath` rejects a trailing slash (`dashboard/`) and empty
//     segments (`dashboard//index.html`), and both shapes occur in
//     practice: directory requests carry a trailing slash, and naive
//     concatenation of a directory with `/index.html` yields a doubled
//     separator.

type embedFileSystem struct {
	http.FileSystem
}

// fsPath turns a request path into a name the embedded `fs.FS` accepts:
// leading separators are dropped and `.` / `//` segments are collapsed.
// It returns "" for the FS root, or for a path that escapes the root.
func fsPath(name string) string {
	name = strings.TrimLeft(name, "/")
	if name == "" {
		return ""
	}
	name = path.Clean(name)
	if name == "." || name == ".." || strings.HasPrefix(name, "../") {
		return ""
	}
	return name
}

func (e *embedFileSystem) Exists(prefix string, requestPath string) bool {
	// Mirrors `localFileSystem`: a request outside the mount prefix is
	// not ours to serve.
	if !strings.HasPrefix(requestPath, prefix) {
		return false
	}
	name := fsPath(strings.TrimPrefix(requestPath, prefix))
	if name == "" {
		return false
	}
	f, err := e.FileSystem.Open(name)
	if err != nil {
		return false
	}
	// Make sure we close the descriptor so `fs.FileServer` can re-open
	// cleanly — `Open` returns an `fs.File`, but for our purposes we
	// only need existence + type info.
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return false
	}
	if info.IsDir() {
		// Directory is reachable iff it contains an index.html (matches
		// the behaviour of `localFileSystem` with `indexes: false`).
		index, err := e.FileSystem.Open(path.Join(name, "index.html"))
		if err != nil {
			return false
		}
		index.Close()
		return true
	}
	return true
}

func (e *embedFileSystem) Open(name string) (http.File, error) {
	name = fsPath(name)
	if name == "" {
		// Returning os.ErrNotExist here defers root requests to the
		// router's NoRoute handler so it can swap in our analytics-
		// injected SPA index page.
		return nil, os.ErrNotExist
	}
	f, err := e.FileSystem.Open(name)
	if err != nil {
		// `static.Serve` retries with `index.html` appended for directory
		// requests; convert directory-only errors into os.ErrNotExist so
		// the http.FileServer fallback can take over.
		if errors.Is(err, fs.ErrNotExist) {
			return nil, os.ErrNotExist
		}
		return nil, err
	}
	return f, nil
}

func EmbedFolder(fsEmbed embed.FS, targetPath string) static.ServeFileSystem {
	efs, err := fs.Sub(fsEmbed, targetPath)
	if err != nil {
		panic(err)
	}
	return &embedFileSystem{
		FileSystem: http.FS(efs),
	}
}
