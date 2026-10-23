package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The API key disclosure endpoints must require a step-up proof. Without the
// middleware a logged-in user could dump every key in clear, which is exactly
// the regression DEF-5 recorded.
func TestTokenKeySecureVerificationRequiredRejectsMissingProof(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/api/token/:id/key", withSessionIdentity, TokenKeySecureVerificationRequired(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	request := httptest.NewRequest(http.MethodPost, "/api/token/7/key", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusForbidden, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "SECURITY_PROOF_REQUIRED")
}

func TestTokenKeySecureVerificationRequiredRejectsInvalidProof(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/api/token/batch/keys", withSessionIdentity, TokenKeySecureVerificationRequired(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	request := httptest.NewRequest(http.MethodPost, "/api/token/batch/keys", nil)
	request.Header.Set("X-Security-Proof", "not-a-proof")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusForbidden, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "SECURITY_PROOF_INVALID")
}

// withSessionIdentity stands in for UserAuth so the step-up middleware sees an
// authenticated dashboard session.
func withSessionIdentity(c *gin.Context) {
	c.Set("id", 1)
	c.Set("session_id", "test-session")
	c.Set("auth_version", int64(1))
	c.Set("session_version", int64(1))
	c.Next()
}
