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
package controller

import (
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
)

// i18nLocaleFiles whitelists the locale JSON filenames this endpoint will serve.
//
// `:file` comes straight from the URL, so it must never be trusted as a path.
// Only these exact names are accepted — none of them contains a separator, so
// a request can neither traverse out of the configured directory nor reach any
// other file. `middleware.DiskETag` re-validates the resolved path as well.
var i18nLocaleFiles = map[string]bool{
	"en.json":    true,
	"zh.json":    true,
	"zh-TW.json": true,
	"fr.json":    true,
	"ru.json":    true,
	"ja.json":    true,
	"vi.json":    true,
}

// GetI18nBundle serves one interface locale for runtime hot-reload.
//
// The SPA bundles all locale JSONs at build time (`web/src/i18n/config.ts`
// imports them statically), so editing a translation normally requires a
// frontend rebuild plus a server restart. When `UTER_I18N_DIR` points at a
// directory holding the same locale files, this endpoint serves them at
// runtime and the frontend hot-swaps the bundle, so a corrected translation
// reaches users without touching the binary or restarting.
//
// Responses are revalidated on every load (`no-cache` + content ETag, see
// `middleware.DiskETag`), so the common case costs one conditional request and
// no body, while changed bytes are picked up immediately — including when the
// file was replaced with a preserved mtime (`rsync -a`).
//
// When the directory is unset or the file is missing the endpoint 404s and the
// frontend keeps its built-in copy, leaving the single-binary install
// completely unaffected.
func GetI18nBundle(c *gin.Context) {
	file := c.Param("file")
	if !i18nLocaleFiles[file] {
		c.JSON(http.StatusNotFound, gin.H{"error": "unsupported locale file"})
		return
	}

	dir := os.Getenv("UTER_I18N_DIR")
	if dir == "" {
		c.Status(http.StatusNotFound)
		return
	}

	// `file` is whitelisted above, so this join cannot escape `dir`.
	full := filepath.Join(dir, file)
	if info, err := os.Stat(full); err != nil || info.IsDir() {
		c.Status(http.StatusNotFound)
		return
	}

	c.File(full)
}
