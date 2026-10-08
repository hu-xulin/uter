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
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func newI18nTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/i18n/:file", GetI18nBundle)
	return r
}

// TestGetI18nBundle covers the runtime locale endpoint: 404 while unconfigured
// (so the SPA keeps its bundled JSON), serving the whitelisted file from disk
// when UTER_I18N_DIR is set, and rejection of anything not on the whitelist.
func TestGetI18nBundle(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "zh.json"), []byte(`{"translation":{"Save":"保存"}}`), 0o644); err != nil {
		t.Fatal(err)
	}

	// Unconfigured → 404 (frontend silently keeps bundled locale).
	t.Setenv("UTER_I18N_DIR", "")
	w := httptest.NewRecorder()
	newI18nTestRouter().ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/i18n/zh.json", nil))
	if w.Code != http.StatusNotFound {
		t.Fatalf("unconfigured: code=%d, want 404", w.Code)
	}

	// Configured → serves the file bytes.
	t.Setenv("UTER_I18N_DIR", dir)
	w = httptest.NewRecorder()
	newI18nTestRouter().ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/i18n/zh.json", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("configured: code=%d, want 200", w.Code)
	}
	if !strings.Contains(w.Body.String(), "保存") {
		t.Errorf("configured: body=%q, want it to contain the translation", w.Body.String())
	}

	// Missing file → 404.
	w = httptest.NewRecorder()
	newI18nTestRouter().ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/i18n/fr.json", nil))
	if w.Code != http.StatusNotFound {
		t.Errorf("missing file: code=%d, want 404", w.Code)
	}

	// Non-whitelisted / traversal attempts → 404, never file contents.
	for _, name := range []string{
		"secrets.json",
		"..%2Fmodel%2Foption.go",
		"....//model//option.go",
	} {
		w = httptest.NewRecorder()
		newI18nTestRouter().ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/i18n/"+name, nil))
		if w.Code != http.StatusNotFound {
			t.Errorf("traversal %q: code=%d, want 404", name, w.Code)
		}
		if strings.Contains(w.Body.String(), "package") {
			t.Errorf("traversal %q leaked file contents", name)
		}
	}
}
