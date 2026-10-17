package router

import (
	"embed"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

//go:embed web/dist
var corsRegistrationTestAssets embed.FS

func TestSetRouterInstallsCORSBeforeAPIRegistration(t *testing.T) {
	previousMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(previousMode) })
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://console.example.test")
	t.Setenv("FRONTEND_BASE_URL", "")
	t.Setenv("UTER_DOCS_DIR", "")

	engine := gin.New()
	SetRouter(engine, WebAssets{
		BuildFS:   corsRegistrationTestAssets,
		IndexPage: []byte("<html></html>"),
	})

	request := httptest.NewRequest(http.MethodGet, "/api/status", nil)
	request.Header.Set("Origin", "https://console.example.test")
	response := httptest.NewRecorder()
	engine.ServeHTTP(response, request)

	require.Equal(t, "https://console.example.test", response.Header().Get("Access-Control-Allow-Origin"))
}
