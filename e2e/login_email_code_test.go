package e2e

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/controller"
	"github.com/uter-ai/uter/model"
	"gorm.io/gorm"
)

// setupLoginEmailCodeTestDB 建一个隔离的内存 SQLite，迁移邮箱验证码登录
// 全链路（验证码校验 → setupLogin → 会话/审计）所需的表。
func setupLoginEmailCodeTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	gin.SetMode(gin.TestMode)
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.AuthFlow{}, &model.User{}, &model.UserSession{}, &model.AuditLog{}, &model.TwoFA{}, &model.PasskeyCredential{}, &model.Token{}))
	model.DB = db
	model.LOG_DB = db

	t.Cleanup(func() {
		if sqlDB, e := db.DB(); e == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func loginEmailCodeRouter() *gin.Engine {
	r := gin.New()
	r.GET("/api/user/login/email-code", controller.SendLoginEmailCode)
	r.POST("/api/user/login/email-code", controller.LoginByEmailCode)
	return r
}

func seedEmailCodeUser(t *testing.T, db *gorm.DB, email string, status int) *model.User {
	t.Helper()
	u := model.User{
		Username: strings.ReplaceAll(email, "@", "_at_"),
		Email:    email,
		Password: "test-password-123",
		Role:     common.RoleCommonUser,
		Status:   status,
	}
	require.NoError(t, db.Create(&u).Error)
	return &u
}

// registerLoginCode 直接注册一枚登录验证码，绕过真实 SMTP（发送端点的
// 发信失败不影响响应，也不方便断言；这里模拟发送成功后的状态）。
func registerLoginCode(t *testing.T, email string) string {
	t.Helper()
	code, err := common.GenerateNumericCode(6)
	require.NoError(t, err)
	common.RegisterVerificationCodeWithKey(email, code, common.LoginEmailCodePurpose)
	return code
}

func enableEmailCodeLogin(t *testing.T) {
	t.Helper()
	previous := common.EmailCodeLoginEnabled
	common.EmailCodeLoginEnabled = true
	t.Cleanup(func() { common.EmailCodeLoginEnabled = previous })
}

func TestSendLoginEmailCodeDisabledWithoutOption(t *testing.T) {
	setupLoginEmailCodeTestDB(t)
	previous := common.EmailCodeLoginEnabled
	common.EmailCodeLoginEnabled = false
	t.Cleanup(func() { common.EmailCodeLoginEnabled = previous })

	r := loginEmailCodeRouter()
	req := httptest.NewRequest(http.MethodGet, "/api/user/login/email-code?email=any@example.com", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	var body map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.Equal(t, false, body["success"])
}

// 「验证码登录即注册」：任意合法邮箱都能请求验证码（响应均为 success），
// 未注册邮箱拿到码后即可自动建号。滥用面由 IP 限流 + Turnstile +
// 验证码生命周期控制，这里断言发送端对已注册 / 未注册邮箱行为一致。
func TestSendLoginEmailCodeServesAnyEmail(t *testing.T) {
	db := setupLoginEmailCodeTestDB(t)
	enableEmailCodeLogin(t)
	seedEmailCodeUser(t, db, "registered@example.com", common.UserStatusEnabled)

	r := loginEmailCodeRouter()
	for _, email := range []string{"registered@example.com", "nobody@example.com"} {
		req := httptest.NewRequest(http.MethodGet, "/api/user/login/email-code?email="+email, nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		assert.Equal(t, http.StatusOK, rec.Code, email)
		var body map[string]any
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
		assert.Equal(t, true, body["success"], email)
	}
}

func TestLoginByEmailCodeHappyPathAndSingleUse(t *testing.T) {
	db := setupLoginEmailCodeTestDB(t)
	enableEmailCodeLogin(t)
	seedEmailCodeUser(t, db, "happy@example.com", common.UserStatusEnabled)

	r := loginEmailCodeRouter()
	code := registerLoginCode(t, "happy@example.com")

	doLogin := func(code string) *httptest.ResponseRecorder {
		payload := `{"email":"happy@example.com","code":"` + code + `"}`
		req := httptest.NewRequest(http.MethodPost, "/api/user/login/email-code", strings.NewReader(payload))
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		return rec
	}

	rec := doLogin(code)
	assert.Equal(t, http.StatusOK, rec.Code)
	var body map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.Equal(t, true, body["success"])

	// 单次使用：同一枚码重放必须失败。
	rec = doLogin(code)
	require.Equal(t, http.StatusOK, rec.Code)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.Equal(t, false, body["success"])
}

func TestLoginByEmailCodeRejectsWrongCode(t *testing.T) {
	db := setupLoginEmailCodeTestDB(t)
	enableEmailCodeLogin(t)
	seedEmailCodeUser(t, db, "wrong@example.com", common.UserStatusEnabled)

	r := loginEmailCodeRouter()
	_ = registerLoginCode(t, "wrong@example.com")

	req := httptest.NewRequest(http.MethodPost, "/api/user/login/email-code",
		strings.NewReader(`{"email":"wrong@example.com","code":"000000"}`))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	var body map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.Equal(t, false, body["success"])
}

// 登录即注册：未注册邮箱持正确验证码登录 → 自动创建账号并登录成功；
// 用户名取邮箱本地部分；同一枚码重放仍失败（单次使用）。
func TestLoginByEmailCodeAutoRegistersUnknownEmail(t *testing.T) {
	setupLoginEmailCodeTestDB(t)
	enableEmailCodeLogin(t)

	r := loginEmailCodeRouter()
	code := registerLoginCode(t, "newcomer@example.com")

	payload := `{"email":"newcomer@example.com","code":"` + code + `"}`
	req := httptest.NewRequest(http.MethodPost, "/api/user/login/email-code", strings.NewReader(payload))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	var body map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.Equal(t, true, body["success"])

	// 账号已创建：本地部分用户名 + 邮箱落库 + 普通用户角色 + 启用状态。
	created, err := model.GetUniqueUserByEmail("newcomer@example.com")
	require.NoError(t, err)
	assert.Equal(t, "newcomer", created.Username)
	assert.Equal(t, common.RoleCommonUser, created.Role)
	assert.Equal(t, common.UserStatusEnabled, created.Status)

	// 重放同一枚码：验证码已消费，必须失败。
	req = httptest.NewRequest(http.MethodPost, "/api/user/login/email-code", strings.NewReader(payload))
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.Equal(t, false, body["success"])
}

// 用户名冲突回退：邮箱本地部分已被占用时，依次回退到完整邮箱等候选，
// 注册依然成功且不覆盖既有账号。
func TestLoginByEmailCodeUsernameConflictFallsBack(t *testing.T) {
	db := setupLoginEmailCodeTestDB(t)
	enableEmailCodeLogin(t)
	// 显式占住用户名 "taken"（与登录邮箱不同账号）。
	occupant := model.User{
		Username: "taken",
		Email:    "occupant@example.com",
		Password: "test-password-123",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, db.Create(&occupant).Error)

	r := loginEmailCodeRouter()
	code := registerLoginCode(t, "taken@other.com")

	req := httptest.NewRequest(http.MethodPost, "/api/user/login/email-code",
		strings.NewReader(`{"email":"taken@other.com","code":"`+code+`"}`))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	var body map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.Equal(t, true, body["success"])

	created, err := model.GetUniqueUserByEmail("taken@other.com")
	require.NoError(t, err)
	assert.NotEqual(t, "taken", created.Username) // 不与既有用户名相同
	assert.Equal(t, "taken@other.com", created.Email)
}

func TestLoginByEmailCodeRejectsBannedUser(t *testing.T) {
	db := setupLoginEmailCodeTestDB(t)
	enableEmailCodeLogin(t)
	seedEmailCodeUser(t, db, "banned@example.com", common.UserStatusDisabled)

	r := loginEmailCodeRouter()
	code := registerLoginCode(t, "banned@example.com")

	req := httptest.NewRequest(http.MethodPost, "/api/user/login/email-code",
		strings.NewReader(`{"email":"banned@example.com","code":"`+code+`"}`))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	var body map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.Equal(t, false, body["success"])
}
