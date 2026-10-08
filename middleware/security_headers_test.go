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
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSecurityHeadersSetsBaselineHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(SecurityHeaders())
	router.GET("/probe", func(c *gin.Context) { c.String(http.StatusOK, "ok") })

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/probe", nil))
	require.Equal(t, http.StatusOK, recorder.Code)

	header := recorder.Header()
	assert.Equal(t, "nosniff", header.Get("X-Content-Type-Options"))
	assert.Equal(t, "SAMEORIGIN", header.Get("X-Frame-Options"))
	assert.Equal(t, "strict-origin-when-cross-origin", header.Get("Referrer-Policy"))
	assert.Equal(t, "frame-ancestors 'self'; object-src 'none'; base-uri 'self'", header.Get("Content-Security-Policy"))
	assert.NotEmpty(t, header.Get("Permissions-Policy"))
	assert.Empty(t, header.Get("X-Powered-By"), "must not advertise the stack")
}

// TestSecurityHeadersKeepSameOriginFramingAllowed locks in that the docs site —
// which the SPA embeds in a same-origin iframe — is still framable by us.
func TestSecurityHeadersKeepSameOriginFramingAllowed(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(SecurityHeaders())
	router.GET("/docs-content/docs/zh", func(c *gin.Context) { c.String(http.StatusOK, "docs") })

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/docs-content/docs/zh", nil))
	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Header().Get("Content-Security-Policy"), "frame-ancestors 'self'")
	// script-src must stay unset: the SPA/docs bootstrap use inline theme scripts.
	assert.NotContains(t, recorder.Header().Get("Content-Security-Policy"), "script-src")
}
