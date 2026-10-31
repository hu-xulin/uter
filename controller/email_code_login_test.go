package controller

import (
	"bufio"
	"bytes"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strconv"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"gorm.io/gorm"
)

// setupEmailCodeLoginDB 为邮箱验证码登录测试准备内存 SQLite 与基础环境。
// 仅迁移登录/注册/会话链路所需模型，避免牵连无关表。
func setupEmailCodeLoginDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousMain, previousLog := common.MainDatabaseType(), common.LogDatabaseType()
	previousRedis := common.RedisEnabled
	previousEnabled := common.EmailCodeLoginEnabled
	previousServer, previousPort := common.SMTPServer, common.SMTPPort
	previousAccount, previousToken := common.SMTPAccount, common.SMTPToken
	previousSSL := common.SMTPSSLEnabled

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.User{}, &model.UserSession{}, &model.Token{}, &model.AuditLog{}, &model.Log{},
		&model.TwoFA{}, &model.TwoFABackupCode{}, &model.PasskeyCredential{},
		&model.AuthFlow{}, &model.Option{}, &model.UserOAuthBinding{},
	))
	model.DB, model.LOG_DB = db, db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.EmailCodeLoginEnabled = true
	common.SMTPServer, common.SMTPPort, common.SMTPAccount, common.SMTPToken = "", 0, "", ""
	common.SMTPSSLEnabled = false

	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.SetDatabaseTypes(previousMain, previousLog)
		common.RedisEnabled = previousRedis
		common.EmailCodeLoginEnabled = previousEnabled
		common.SMTPServer, common.SMTPPort = previousServer, previousPort
		common.SMTPAccount, common.SMTPToken = previousAccount, previousToken
		common.SMTPSSLEnabled = previousSSL
	})
	return db
}

// emailCodeLoginCtx 构造一个 POST /api/user/login/email-code 的 gin 上下文。
func emailCodeLoginCtx(t *testing.T, email, code string) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	body, err := json.Marshal(EmailCodeLoginRequest{Email: email, Code: code})
	require.NoError(t, err)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/user/login/email-code", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c, w
}

func emailCodeSendCtx(t *testing.T, email string) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/user/login/email-code?email="+email, nil)
	return c, w
}

type emailCodeResp struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// BE-SES-021：开关关闭时登录与发码均拒绝。
func TestEmailCodeLogin_DisabledRejects(t *testing.T) {
	setupEmailCodeLoginDB(t)
	common.EmailCodeLoginEnabled = false

	c, w := emailCodeLoginCtx(t, "disabled@uter.ai", "123456")
	LoginByEmailCode(c)
	var resp emailCodeResp
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.False(t, resp.Success)
	assert.Contains(t, resp.Message, "disabled")

	sc, sw := emailCodeSendCtx(t, "disabled@uter.ai")
	SendLoginEmailCode(sc)
	require.NoError(t, json.Unmarshal(sw.Body.Bytes(), &resp))
	assert.False(t, resp.Success)
	assert.Contains(t, resp.Message, "disabled")
}

// BE-SES-023：验证码错误（含 5 次失败作废前的任意错误码）直接拒绝。
func TestEmailCodeLogin_WrongCodeRejected(t *testing.T) {
	db := setupEmailCodeLoginDB(t)
	email := "wrong@uter.ai"
	// 注册一个正确码，但提交错误码。
	common.RegisterVerificationCodeWithKey(email, "111111", common.LoginEmailCodePurpose)
	_ = db

	c, w := emailCodeLoginCtx(t, email, "000000")
	LoginByEmailCode(c)
	var resp emailCodeResp
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.False(t, resp.Success)
	assert.Contains(t, resp.Message, "incorrect or has expired")
}

// BE-SES-022：被封禁账号静默拒绝，不泄露账号是否存在。
func TestEmailCodeLogin_SuspendedAccountSilent(t *testing.T) {
	setupEmailCodeLoginDB(t)
	email := "suspended@uter.ai"
	user := &model.User{
		Username: "suspended-acc", Email: email, Role: common.RoleCommonUser,
		Status: common.UserStatusDisabled, Group: "default", AuthVersion: 1,
	}
	require.NoError(t, model.DB.Create(user).Error)
	common.RegisterVerificationCodeWithKey(email, "222222", common.LoginEmailCodePurpose)

	c, w := emailCodeLoginCtx(t, email, "222222")
	LoginByEmailCode(c)
	var resp emailCodeResp
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.False(t, resp.Success)
	assert.Contains(t, resp.Message, "banned")
}

// BE-SES-020（已注册分支）：已启用且无 2FA/Passkey 的账号用正确码登录，直接签发会话。
func TestEmailCodeLogin_ExistingUserSuccess(t *testing.T) {
	setupEmailCodeLoginDB(t)
	email := "existing@uter.ai"
	user := &model.User{
		Username: "existing-acc", Email: email, Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1,
	}
	require.NoError(t, model.DB.Create(user).Error)
	common.RegisterVerificationCodeWithKey(email, "333333", common.LoginEmailCodePurpose)

	c, w := emailCodeLoginCtx(t, email, "333333")
	LoginByEmailCode(c)
	var resp emailCodeResp
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.True(t, resp.Success, "已注册账号应直接登录并签发会话；body=%s", w.Body.String())
	// 至少写入一条会话 Cookie。
	assert.NotEmpty(t, w.Result().Cookies())
}

// BE-SES-020（登录即注册分支）：未注册邮箱通过验证后自动建号并进入会话。
func TestEmailCodeLogin_NewEmailRegisters(t *testing.T) {
	setupEmailCodeLoginDB(t)
	email := "newuser@uter.ai"
	common.RegisterVerificationCodeWithKey(email, "444444", common.LoginEmailCodePurpose)

	before, err := model.GetUniqueUserByEmail(email)
	assert.Error(t, err, "登录前不应存在该账号")
	_ = before

	c, w := emailCodeLoginCtx(t, email, "444444")
	LoginByEmailCode(c)
	var resp emailCodeResp
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.True(t, resp.Success, "未注册邮箱应自动建号并登录；body=%s", w.Body.String())

	created, err := model.GetUniqueUserByEmail(email)
	require.NoError(t, err, "登录后应已创建账号")
	assert.Equal(t, common.RoleCommonUser, created.Role)
	assert.NotEmpty(t, w.Result().Cookies())
}

// BE-SES-026：登录码（purpose=l）与 step-up 码（purpose=s）按用途隔离，跨用途不可兑换。
func TestEmailCodeLogin_CodeNotReusableForStepUp(t *testing.T) {
	setupEmailCodeLoginDB(t)
	email := "purpose@uter.ai"
	code := "555555"
	common.RegisterVerificationCodeWithKey(email, code, common.LoginEmailCodePurpose)

	// 同一码按登录用途可验证。
	assert.True(t, common.VerifyCodeWithKey(email, code, common.LoginEmailCodePurpose))
	// 按 step-up 用途（s）不可兑换。
	assert.False(t, common.VerifyCodeWithKey(email, code, common.StepUpEmailCodePurpose))
}

// BE-SES-019：请求发送登录验证码成功，且服务端按登录用途注册了该码（可被登录兑换）。
func TestSendLoginEmailCode_SuccessRegistersCode(t *testing.T) {
	db := setupEmailCodeLoginDB(t)
	require.NoError(t, db.AutoMigrate(&model.User{}))
	email := "sendcode@uter.ai"

	// 指向最小 SMTP 接收端，捕获发出的邮件正文以提取验证码。
	captured := make(chan string, 1)
	addr := startCaptureSMTPServer(t, captured)
	host, portStr, err := net.SplitHostPort(addr)
	require.NoError(t, err)
	port, err := strconv.Atoi(portStr)
	require.NoError(t, err)
	common.SMTPServer = host
	common.SMTPPort = port
	common.SMTPAccount = "info@uter.ai"
	common.SMTPToken = "test-token"

	sc, sw := emailCodeSendCtx(t, email)
	SendLoginEmailCode(sc)
	var resp emailCodeResp
	require.NoError(t, json.Unmarshal(sw.Body.Bytes(), &resp))
	assert.True(t, resp.Success, "发码应成功；body=%s", sw.Body.String())

	select {
	case body := <-captured:
		code := extractSixDigitCode(t, body)
		// 服务端按登录用途注册了该码，可被登录路径兑换。
		assert.True(t, common.VerifyCodeWithKey(email, code, common.LoginEmailCodePurpose),
			"发出的码应按登录用途注册；body=%s", body)
	default:
		t.Fatal("未收到发出的邮件正文")
	}
}

// startCaptureSMTPServer 起一个最小 SMTP 接收端，把 DATA 正文回传 captured。
func startCaptureSMTPServer(t *testing.T, captured chan<- string) string {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	t.Cleanup(func() { _ = listener.Close() })
	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				return
			}
			go func(c net.Conn) {
				defer c.Close()
				reply := func(s string) { _, _ = c.Write([]byte(s + "\r\n")) }
				reply("220 test ESMTP")
				reader := bufio.NewReader(c)
				inData := false
				var data strings.Builder
				for {
					line, err := reader.ReadString('\n')
					if err != nil {
						return
					}
					command := strings.ToUpper(strings.TrimSpace(line))
					switch {
					case strings.HasPrefix(command, "EHLO"), strings.HasPrefix(command, "HELO"):
						reply("250-test")
						reply("250 OK")
					case strings.HasPrefix(command, "AUTH"):
						reply("235 OK")
					case strings.HasPrefix(command, "DATA"):
						reply("354 End data with <CR><LF>.<CR><LF>")
						inData = true
					case inData:
						if strings.TrimSpace(line) == "." {
							inData = false
							reply("250 OK")
							captured <- data.String()
						} else {
							data.WriteString(line)
						}
					case strings.HasPrefix(command, "QUIT"):
						reply("221 Bye")
						return
					default:
						reply("250 OK")
					}
				}
			}(conn)
		}
	}()
	return listener.Addr().String()
}

// extractSixDigitCode 从邮件正文中提取验证码。验证码由邮件模板以
// `<p style="...font-size:40px;...>CODE</p>` 居中渲染，用该模式精确提取，
// 避免误命中 Message-ID 等长数字串。
func extractSixDigitCode(t *testing.T, body string) string {
	t.Helper()
	re := regexp.MustCompile(`font-size:40px;line-height:1\.3;color:#202124;">(\d{6})</p>`)
	if m := re.FindStringSubmatch(body); m != nil {
		return m[1]
	}
	// 兜底：扫描首个连续 6 位数字串。
	for i := 0; i+6 <= len(body); i++ {
		chunk := body[i : i+6]
		if allDigits(chunk) {
			return chunk
		}
	}
	t.Fatalf("邮件正文中未找到 6 位验证码；body=%s", body)
	return ""
}

func allDigits(s string) bool {
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return len(s) > 0
}
