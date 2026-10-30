package service

import (
	"bufio"
	"net"
	"strconv"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"gorm.io/gorm"
)

func setupStepUpEmailCodeTest(t *testing.T, email string) (*model.User, AuthIdentity) {
	t.Helper()
	previousDB, previousRedis := model.DB, common.RedisEnabled
	previousSecret := common.SessionSecret
	if common.OptionMap == nil {
		common.OptionMap = map[string]string{}
	}
	previousAccounts, hadAccounts := common.OptionMap["SMTPAccounts"]
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.UserSession{}, &model.TwoFA{}, &model.TwoFABackupCode{}, &model.PasskeyCredential{}, &model.AuthFlow{}))
	model.DB = db
	common.RedisEnabled = false
	common.SessionSecret = "step-up-email-code-test-secret"
	// 配置一个多账号发信列表（仅作可用性判断，不真正发信）。
	common.OptionMap["SMTPAccounts"] = `[{"account":"info@uter.ai","token":"test-token"}]`
	t.Cleanup(func() {
		model.DB = previousDB
		common.RedisEnabled = previousRedis
		common.SessionSecret = previousSecret
		if hadAccounts {
			common.OptionMap["SMTPAccounts"] = previousAccounts
		} else {
			delete(common.OptionMap, "SMTPAccounts")
		}
		_ = sqlDB.Close()
	})
	user := &model.User{
		Username:    "step-up-user",
		Email:       email,
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AuthVersion: 1,
	}
	require.NoError(t, db.Create(user).Error)
	bundle, err := CreateLoginSession(user.Id, "password", "127.0.0.1", "step-up-email-code-test")
	require.NoError(t, err)
	identity, err := ParseAccessToken(bundle.AccessToken)
	require.NoError(t, err)
	return user, identity
}

// 未启用 2FA/Passkey 时，邮箱验证码必须出现在 step-up 回退里且排在密码/OAuth
// 之前——否则密码登录被禁用的部署（仅验证码/OAuth 登录）没有任何可用的
// 再验证方式。已启用 2FA 的账号维持原策略，邮箱验证码不越位。
func TestStepUpPolicyIncludesEmailCodeFallback(t *testing.T) {
	withPassword := model.UserVerificationState{HasPassword: true, AuthVersion: 1, Status: common.UserStatusEnabled, Role: common.RoleCommonUser}
	methods, err := securityVerificationPolicy(VerificationScopeAccountBind, withPassword)
	require.NoError(t, err)
	require.Len(t, methods, 2)
	assert.Equal(t, VerificationMethodEmailCode, methods[0].Method)
	assert.Equal(t, VerificationMethodPassword, methods[1].Method)

	withoutPassword := model.UserVerificationState{AuthVersion: 1, Status: common.UserStatusEnabled, Role: common.RoleCommonUser}
	methods, err = securityVerificationPolicy(VerificationScopeAccountBind, withoutPassword)
	require.NoError(t, err)
	require.Len(t, methods, 2)
	assert.Equal(t, VerificationMethodEmailCode, methods[0].Method)
	assert.Equal(t, VerificationMethodOAuth, methods[1].Method)

	withTwoFA := model.UserVerificationState{HasTwoFA: true, AuthVersion: 1, Status: common.UserStatusEnabled, Role: common.RoleCommonUser}
	methods, err = securityVerificationPolicy(VerificationScopeAccountBind, withTwoFA)
	require.NoError(t, err)
	require.Len(t, methods, 1)
	assert.Equal(t, VerificationMethodTwoFA, methods[0].Method)
}

func stepUpBindOperation() VerificationOperation {
	return VerificationOperation{
		Scope:   VerificationScopeAccountBind,
		Context: []byte(`{"provider":"email","email":"new-owner@uter.ai"}`),
	}
}

// 邮箱验证码按操作上下文哈希存储：正确的码兑换成功且一次性；错误、跨操作
// 复用（为另一操作寄出的码）都拒绝。
func TestVerifySecurityInputEmailCode(t *testing.T) {
	_, identity := setupStepUpEmailCodeTest(t, "owner@uter.ai")
	operation := stepUpBindOperation()
	binding, err := BindVerificationOperation(operation)
	require.NoError(t, err)

	// 错误的码。
	common.RegisterVerificationCodeWithKey(binding.ContextHash, "123456", common.StepUpEmailCodePurpose)
	_, err = VerifySecurityInput(identity, VerificationInput{
		Method: VerificationMethodEmailCode, Scope: operation.Scope, Context: operation.Context, Code: "000000",
	})
	assert.ErrorIs(t, err, ErrVerificationFailed)

	// 正确的码（重新注册：上面的失败未达作废阈值，但覆盖一次更清晰）。
	common.RegisterVerificationCodeWithKey(binding.ContextHash, "654321", common.StepUpEmailCodePurpose)
	proof, err := VerifySecurityInput(identity, VerificationInput{
		Method: VerificationMethodEmailCode, Scope: operation.Scope, Context: operation.Context, Code: "654321",
	})
	require.NoError(t, err)
	assert.Equal(t, VerificationMethodEmailCode, proof.Method)
	assert.Equal(t, VerificationScopeAccountBind, proof.Scope)

	// 单次使用：同一个码第二次兑换必须失败。
	_, err = VerifySecurityInput(identity, VerificationInput{
		Method: VerificationMethodEmailCode, Scope: operation.Scope, Context: operation.Context, Code: "654321",
	})
	assert.ErrorIs(t, err, ErrVerificationFailed)

	// 跨操作复用：为另一个上下文寄出的码不能兑换本操作。
	otherOperation := VerificationOperation{
		Scope:   VerificationScopeAccountBind,
		Context: []byte(`{"provider":"email","email":"other@uter.ai"}`),
	}
	otherBinding, err := BindVerificationOperation(otherOperation)
	require.NoError(t, err)
	common.RegisterVerificationCodeWithKey(otherBinding.ContextHash, "999999", common.StepUpEmailCodePurpose)
	_, err = VerifySecurityInput(identity, VerificationInput{
		Method: VerificationMethodEmailCode, Scope: operation.Scope, Context: operation.Context, Code: "999999",
	})
	assert.ErrorIs(t, err, ErrVerificationFailed)
}

// startFakeSMTPServer 起一个最小 SMTP 会话（不协商 STARTTLS/AUTH，客户端
// 无凭据时不会尝试认证），供发送路径全链路测试。
func startFakeSMTPServer(t *testing.T) string {
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
						for {
							dataLine, err := reader.ReadString('\n')
							if err != nil {
								return
							}
							if strings.TrimSpace(dataLine) == "." {
								break
							}
						}
						reply("250 OK")
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

// SendStepUpEmailCode 的可用性护栏：无邮箱账号拒绝；发信链路成功时返回
// 掩码地址且码已按操作上下文注册。
func TestSendStepUpEmailCode(t *testing.T) {
	user, identity := setupStepUpEmailCodeTest(t, "")
	operation := stepUpBindOperation()

	// 无邮箱：方法可用但无收件地址。
	_, err := SendStepUpEmailCode(identity, operation, "en")
	assert.ErrorIs(t, err, ErrVerificationUnavailable)

	// 补上邮箱并指向假 SMTP 服务器，发送成功且返回掩码地址。
	previousServer, previousPort := common.SMTPServer, common.SMTPPort
	previousAccount, previousToken := common.SMTPAccount, common.SMTPToken
	// 测试进程未注册 SMTPSenderProvider 钩子，SendEmail 走旧单账号回退。
	common.SMTPAccount = "info@uter.ai"
	common.SMTPToken = "test-token"
	addr := startFakeSMTPServer(t)
	host, portStr, _ := net.SplitHostPort(addr)
	common.SMTPServer = host
	port, err := strconv.Atoi(portStr)
	require.NoError(t, err)
	common.SMTPPort = port
	require.NoError(t, model.DB.Model(user).Update("email", "owner@uter.ai").Error)
	t.Cleanup(func() {
		common.SMTPServer, common.SMTPPort = previousServer, previousPort
		common.SMTPAccount, common.SMTPToken = previousAccount, previousToken
	})

	masked, err := SendStepUpEmailCode(identity, operation, "en")
	require.NoError(t, err)
	assert.Equal(t, common.MaskEmail("owner@uter.ai"), masked)

	// 发出的码值在服务端注册，无法在测试中复原；「注册后可兑换、验证后
	// 失效」的语义已在 TestVerifySecurityInputEmailCode 覆盖。这里只确认
	// 掩码不泄露完整地址。
	assert.NotContains(t, masked, "owner@uter.ai")
}
