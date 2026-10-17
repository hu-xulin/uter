package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestCORSAllowsOnlyConfiguredExactOrigins(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://panel.example.com, https://admin.example.com")

	router := gin.New()
	router.Use(CORS())
	router.POST("/api/test", func(c *gin.Context) { c.Status(http.StatusNoContent) })

	allowed := httptest.NewRequest(http.MethodOptions, "/api/test", nil)
	allowed.Header.Set("Origin", "https://panel.example.com")
	allowed.Header.Set("Access-Control-Request-Method", "POST")
	allowed.Header.Set("Access-Control-Request-Headers", "authorization,content-type,cache-control,x-security-proof,x-api-key,x-goog-api-key,anthropic-version,anthropic-beta,openai-beta,openai-organization")
	allowedResponse := httptest.NewRecorder()
	router.ServeHTTP(allowedResponse, allowed)

	require.Equal(t, http.StatusNoContent, allowedResponse.Code)
	require.Equal(t, "https://panel.example.com", allowedResponse.Header().Get("Access-Control-Allow-Origin"))
	require.Equal(t, "true", allowedResponse.Header().Get("Access-Control-Allow-Credentials"))
	allowedHeaders := strings.ToLower(allowedResponse.Header().Get("Access-Control-Allow-Headers"))
	require.Contains(t, allowedHeaders, "authorization")
	require.Contains(t, allowedHeaders, "content-type")
	require.Contains(t, allowedHeaders, "cache-control")
	require.Contains(t, allowedHeaders, "x-security-proof")
	require.Contains(t, allowedHeaders, "x-api-key")
	require.Contains(t, allowedHeaders, "x-goog-api-key")
	require.Contains(t, allowedHeaders, "anthropic-version")
	require.Contains(t, allowedHeaders, "anthropic-beta")
	require.Contains(t, allowedHeaders, "openai-beta")
	require.Contains(t, allowedHeaders, "openai-organization")
	require.NotContains(t, allowedHeaders, "*")

	rejected := httptest.NewRequest(http.MethodOptions, "/api/test", nil)
	rejected.Header.Set("Origin", "https://panel.example.com.evil.test")
	rejected.Header.Set("Access-Control-Request-Method", "POST")
	rejectedResponse := httptest.NewRecorder()
	router.ServeHTTP(rejectedResponse, rejected)

	require.NotEqual(t, http.StatusNoContent, rejectedResponse.Code)
	require.Empty(t, rejectedResponse.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORSDisablesCrossOriginWhenNoAllowlistConfigured(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("CORS_ALLOWED_ORIGINS", "")

	router := gin.New()
	router.Use(CORS())
	router.POST("/api/test", func(c *gin.Context) { c.Status(http.StatusNoContent) })

	request := httptest.NewRequest(http.MethodOptions, "/api/test", nil)
	request.Header.Set("Origin", "https://unconfigured.example.com")
	request.Header.Set("Access-Control-Request-Method", "POST")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	require.NotEqual(t, http.StatusNoContent, response.Code)
	require.Empty(t, response.Header().Get("Access-Control-Allow-Origin"))
}
