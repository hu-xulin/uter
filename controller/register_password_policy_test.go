package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"gorm.io/gorm"
)

// openRegisterTestDB wires an in-memory database with just the tables the
// registration path touches: the users table.
func openRegisterTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db := openTokenControllerTestDB(t)
	if err := db.AutoMigrate(&model.User{}); err != nil {
		t.Fatalf("failed to migrate users table: %v", err)
	}

	return db
}

// DEF-4: the server only checked password length, so "password" and "abcdefgh"
// registered successfully. The policy must be enforced where the credential is
// accepted, not only in the browser.
func TestRegisterRejectsPasswordsFailingPolicy(t *testing.T) {
	for _, test := range []struct {
		name     string
		password string
	}{
		{"common password", "password"},
		{"single character class", "abcdefgh"},
		{"digits only", "12345678"},
		{"contains username", "QaUser12345!"},
	} {
		t.Run(test.name, func(t *testing.T) {
			openRegisterTestDB(t)
			previousRegister := common.RegisterEnabled
			previousPasswordRegister := common.PasswordRegisterEnabled
			common.RegisterEnabled = true
			common.PasswordRegisterEnabled = true
			t.Cleanup(func() {
				common.RegisterEnabled = previousRegister
				common.PasswordRegisterEnabled = previousPasswordRegister
			})

			engine := gin.New()
			engine.POST("/api/user/register", Register)
			body := `{"username":"newuser","password":"` + test.password + `","email":"newuser@example.com"}`
			request := httptest.NewRequest(http.MethodPost, "/api/user/register", strings.NewReader(body))
			request.Header.Set("Content-Type", "application/json")
			recorder := httptest.NewRecorder()
			engine.ServeHTTP(recorder, request)

			var response struct {
				Success bool   `json:"success"`
				Message string `json:"message"`
			}
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
			assert.False(t, response.Success, "weak password must be rejected: %s", recorder.Body.String())
			assert.NotEmpty(t, response.Message)
			assert.Equal(t, int64(0), model.DB.Where("username = ?", "newuser").Find(&[]model.User{}).RowsAffected,
				"no account may be created for a rejected password")
		})
	}
}

func TestRegisterAcceptsStrongPassword(t *testing.T) {
	openRegisterTestDB(t)
	previousRegister := common.RegisterEnabled
	previousPasswordRegister := common.PasswordRegisterEnabled
	common.RegisterEnabled = true
	common.PasswordRegisterEnabled = true
	t.Cleanup(func() {
		common.RegisterEnabled = previousRegister
		common.PasswordRegisterEnabled = previousPasswordRegister
	})

	engine := gin.New()
	engine.POST("/api/user/register", Register)
	body := `{"username":"stronguser","password":"Str0ng-Pass!42","email":"stronguser@example.com"}`
	request := httptest.NewRequest(http.MethodPost, "/api/user/register", strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, request)

	var response struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success, "a policy-compliant password must register: %s", recorder.Body.String())
	assert.Equal(t, int64(1), model.DB.Where("username = ?", "stronguser").Find(&[]model.User{}).RowsAffected)
}
