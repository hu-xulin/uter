package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/setting/operation_setting"
)

// newDemoTestRouter wires DemoSiteReadOnly around a few representative routes so
// we can assert whether a request reaches the handler (allowed) or is aborted
// (rejected).
func newDemoTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(DemoSiteReadOnly())
	r.GET("/api/channel", func(c *gin.Context) { c.JSON(200, gin.H{"success": true}) })
	r.POST("/api/channel", func(c *gin.Context) { c.JSON(200, gin.H{"success": true}) })
	r.POST("/api/user/login", func(c *gin.Context) { c.JSON(200, gin.H{"success": true}) })
	r.POST("/api/user", func(c *gin.Context) { c.JSON(200, gin.H{"success": true}) })
	r.POST("/api/stripe/webhook", func(c *gin.Context) { c.JSON(200, gin.H{"success": true}) })
	return r
}

func doDemoReq(r *gin.Engine, method, path string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec
}

func demoBody(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var body map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	return body
}

func TestDemoSiteReadOnlyDisabledAllowsWrites(t *testing.T) {
	operation_setting.DemoSiteEnabled = false
	defer func() { operation_setting.DemoSiteEnabled = false }()

	r := newDemoTestRouter()
	rec := doDemoReq(r, http.MethodPost, "/api/channel")
	assert.Equal(t, 200, rec.Code)
	assert.Equal(t, true, demoBody(t, rec)["success"])
}

func TestDemoSiteReadOnlyEnabledBlocksSensitiveWrites(t *testing.T) {
	operation_setting.DemoSiteEnabled = true
	defer func() { operation_setting.DemoSiteEnabled = false }()

	r := newDemoTestRouter()
	for _, path := range []string{"/api/channel", "/api/user"} {
		rec := doDemoReq(r, http.MethodPost, path)
		assert.Equal(t, 200, rec.Code, "rejection still returns 200 envelope for %s", path)
		assert.Equal(t, false, demoBody(t, rec)["success"], "write %s must be rejected", path)
	}
}

func TestDemoSiteReadOnlyEnabledAllowsReads(t *testing.T) {
	operation_setting.DemoSiteEnabled = true
	defer func() { operation_setting.DemoSiteEnabled = false }()

	r := newDemoTestRouter()
	rec := doDemoReq(r, http.MethodGet, "/api/channel")
	assert.Equal(t, 200, rec.Code)
	assert.Equal(t, true, demoBody(t, rec)["success"])
}

func TestDemoSiteReadOnlyAllowsAuthAndWebhooks(t *testing.T) {
	operation_setting.DemoSiteEnabled = true
	defer func() { operation_setting.DemoSiteEnabled = false }()

	r := newDemoTestRouter()
	for _, path := range []string{"/api/user/login", "/api/stripe/webhook"} {
		rec := doDemoReq(r, http.MethodPost, path)
		assert.Equal(t, 200, rec.Code, "allow-listed write %s must proceed", path)
		assert.Equal(t, true, demoBody(t, rec)["success"], "allow-listed write %s must proceed", path)
	}
}

func TestIsDemoAllowedWrite(t *testing.T) {
	allowed := []string{
		"/api/user/login",
		"/api/user/login/2fa",
		"/api/user/login/verify",
		"/api/user/login/passkey/begin",
		"/api/user/register",
		"/api/user/reset",
		"/api/user/passkey/login/begin",
		"/api/user/auth/refresh",
		"/api/user/auth/logout",
		"/api/verify",
		"/api/oauth/github",
		"/api/ratio_config",
		"/api/setup",
		"/api/stripe/webhook",
		"/api/creem/webhook",
		"/api/waffo/webhook",
		"/api/waffo-pancake/webhook/prod",
		"/api/user/epay/notify",
		"/api/user/alipay/notify",
		"/api/user/wechat/notify",
	}
	for _, p := range allowed {
		assert.True(t, isDemoAllowedWrite(p), "expected allow-listed: %s", p)
	}

	blocked := []string{
		"/api/channel",
		"/api/user",
		"/api/user/self",
		"/api/token",
		"/api/setting",
		"/api/models",
		"/api/organization",
	}
	for _, p := range blocked {
		assert.False(t, isDemoAllowedWrite(p), "expected blocked: %s", p)
	}
}
