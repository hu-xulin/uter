package common

import (
	"io"
	"log"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// strongSecret 是一个长度与熵都合格的示例密钥（48 位十六进制）。
const strongSecret = "9f2c7b1e4a6d8f0b3c5e7a9d1f2b4c6e8a0d2f4b6c8e0a2d4f6b8c0e2a4d6f8b1c3e5a"

// strongSecretBase64 是另一条等强度的 base64 形式密钥，用于确认不会误伤
// 非十六进制但足够随机的取值。
const strongSecretBase64 = "Kq7Vt2Xb9Nm4Rp6Ws1Yd3Fh8Jl0Cg5Ez7Ua2Bd4Nf6Hg9"

// isolateSecretGlobals 保存并还原进程级密钥与日志输出，避免测试相互污染。
func isolateSecretGlobals(t *testing.T) {
	t.Helper()
	originalSession, originalCrypto := SessionSecret, CryptoSecret
	t.Cleanup(func() {
		SessionSecret, CryptoSecret = originalSession, originalCrypto
	})

	originalOutput := log.Writer()
	log.SetOutput(io.Discard)
	t.Cleanup(func() { log.SetOutput(originalOutput) })
}

func TestInspectSecretRejectsPlaceholdersAndWeakValues(t *testing.T) {
	cases := []struct {
		name     string
		value    string
		rejected bool
		reason   string
	}{
		// 清单第九章问题 1：.env.example 里的实际占位值此前会被照单全收。
		{name: "env example placeholder", value: "__CHANGE_ME_SESSION_SECRET__", rejected: true, reason: "部署模板中的占位值"},
		{name: "env example crypto placeholder", value: "__CHANGE_ME_CRYPTO_SECRET__", rejected: true, reason: "部署模板中的占位值"},
		{name: "legacy default value", value: "random_string", rejected: true, reason: "部署模板中的占位值"},
		{name: "deployment manual instruction", value: "<粘贴生成的48字节随机串>", rejected: true, reason: "模板中的说明文字"},
		{name: "change me marker", value: "CHANGE_ME_before_deploy", rejected: true, reason: "未替换的模板标记"},
		{name: "lowercase changeme", value: "changeme", rejected: true, reason: "部署模板中的占位值"},
		{name: "empty", value: "", rejected: true, reason: "密钥为空"},
		{name: "whitespace only", value: "     ", rejected: true, reason: "密钥为空"},
		{name: "too short", value: "abc12345", rejected: true, reason: "密钥长度"},
		{name: "repeated single character", value: strings.Repeat("a", 48), rejected: true, reason: "熵过低"},
		{name: "only two distinct characters", value: strings.Repeat("a1", 24), rejected: true, reason: "熵过低"},
		{name: "bare word secret", value: "secret", rejected: true, reason: "部署模板中的占位值"},
		{name: "bare word password", value: "password", rejected: true, reason: "部署模板中的占位值"},
		{name: "strong hex", value: strongSecret, rejected: false},
		{name: "strong base64", value: strongSecretBase64, rejected: false},
		{name: "strong with dashes", value: "9f2c-7b1e-4a6d-8f0b-3c5e-7a9d-1f2b-4c6e-8a0d-2f4b-6c8e-0a2d", rejected: false},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			inspection := InspectSecret(testCase.value)
			if testCase.rejected {
				require.False(t, inspection.OK(), "应当拒绝该取值")
				assert.Contains(t, inspection.Problem, testCase.reason)
				return
			}
			require.True(t, inspection.OK(), "不应当拒绝该取值：%s", inspection.Problem)
			assert.Equal(t, "ok", inspection.String())
		})
	}
}

// TestInspectSecretNeverEchoesSecretValue 覆盖验收标准「日志、崩溃信息和诊断
// 输出中不包含完整密钥」：结论只能包含长度与问题类别。
func TestInspectSecretNeverEchoesSecretValue(t *testing.T) {
	const uniqueMarker = "UNIQUE-MARKER-7f3a9c"
	value := "prefix" + uniqueMarker + "CHANGE_ME"

	inspection := InspectSecret(value)
	require.False(t, inspection.OK())

	for _, rendered := range []string{inspection.Problem, inspection.String()} {
		assert.NotContains(t, rendered, uniqueMarker, "诊断输出不得回显密钥内容")
		assert.NotContains(t, rendered, "prefix", "诊断输出不得回显密钥的任何片段")
	}
}

func TestInitSecretKeysRejectsMissingSecretInServerMode(t *testing.T) {
	isolateSecretGlobals(t)

	t.Setenv(SessionSecretEnv, "")
	t.Setenv(CryptoSecretEnv, "")
	SessionSecret = "sentinel-before-init"

	err := InitSecretKeys()

	require.Error(t, err, "服务端模式下未配置 SESSION_SECRET 必须让启动失败")
	assert.Contains(t, err.Error(), SessionSecretEnv)
	// 启动失败不得把全局密钥改成空值或未校验值。
	assert.Equal(t, "sentinel-before-init", SessionSecret, "初始化失败不得改动已有密钥")
}

func TestInitSecretKeysRejectsPlaceholderSecret(t *testing.T) {
	isolateSecretGlobals(t)

	t.Setenv(SessionSecretEnv, "__CHANGE_ME_SESSION_SECRET__")
	t.Setenv(CryptoSecretEnv, "")
	SessionSecret = "sentinel-before-init"

	err := InitSecretKeys()

	require.Error(t, err, "占位值必须让启动失败")
	assert.Contains(t, err.Error(), "占位值")
	assert.Equal(t, "sentinel-before-init", SessionSecret, "初始化失败不得改动已有密钥")
}

func TestInitSecretKeysRejectsShortSecret(t *testing.T) {
	isolateSecretGlobals(t)

	t.Setenv(SessionSecretEnv, "too-short")
	t.Setenv(CryptoSecretEnv, "")
	SessionSecret = "sentinel-before-init"

	err := InitSecretKeys()

	require.Error(t, err, "过短密钥必须让启动失败")
	assert.Contains(t, err.Error(), "密钥长度")
	assert.Equal(t, "sentinel-before-init", SessionSecret)
}

func TestInitSecretKeysAcceptsStrongSecretAndKeepsCryptoCompatible(t *testing.T) {
	isolateSecretGlobals(t)

	t.Setenv(SessionSecretEnv, strongSecret)
	t.Setenv(CryptoSecretEnv, "")

	require.NoError(t, InitSecretKeys())
	assert.Equal(t, strongSecret, SessionSecret)
	// CRYPTO_SECRET 未设置时沿用会话密钥派生，保证既有加密数据与已签发的
	// 任务资源链接在重启后仍然可用。
	assert.Equal(t, SessionSecret, CryptoSecret)
}

func TestInitSecretKeysAcceptsDistinctCryptoSecret(t *testing.T) {
	isolateSecretGlobals(t)

	t.Setenv(SessionSecretEnv, strongSecret)
	t.Setenv(CryptoSecretEnv, strongSecretBase64)

	require.NoError(t, InitSecretKeys())
	assert.Equal(t, strongSecret, SessionSecret)
	assert.Equal(t, strongSecretBase64, CryptoSecret)
	assert.NotEqual(t, SessionSecret, CryptoSecret, "两个用途应当使用各自独立的密钥")
}

func TestInitSecretKeysRejectsCryptoSecretEqualToSessionSecret(t *testing.T) {
	isolateSecretGlobals(t)

	t.Setenv(SessionSecretEnv, strongSecret)
	t.Setenv(CryptoSecretEnv, strongSecret)

	err := InitSecretKeys()

	require.Error(t, err, "数据加密密钥与会话密钥相同等于没有分离，必须拒绝")
	assert.Contains(t, err.Error(), CryptoSecretEnv)
}

func TestInitSecretKeysRejectsPlaceholderCryptoSecret(t *testing.T) {
	isolateSecretGlobals(t)

	t.Setenv(SessionSecretEnv, strongSecret)
	t.Setenv(CryptoSecretEnv, "__CHANGE_ME_CRYPTO_SECRET__")

	err := InitSecretKeys()

	require.Error(t, err, "数据加密密钥同样不允许占位值")
	assert.Contains(t, err.Error(), "占位值")
}

// TestInitSecretKeysDesktopModeRequiresInjectedSecret 覆盖桌面形态：密钥由
// Electron 从用户数据目录注入，缺失必须明确报错，而不是静默退回随机值
// （那会让每次重启都丢掉登录会话与已签发的资源链接）。
func TestInitSecretKeysDesktopModeRequiresInjectedSecret(t *testing.T) {
	isolateSecretGlobals(t)

	t.Setenv(DesktopModeEnv, "1")
	t.Setenv(SessionSecretEnv, "")
	t.Setenv(CryptoSecretEnv, "")
	SessionSecret = "sentinel-before-init"

	err := InitSecretKeys()

	require.Error(t, err, "桌面模式下密钥缺失必须让启动失败")
	assert.Contains(t, err.Error(), SessionSecretEnv)
	assert.Equal(t, "sentinel-before-init", SessionSecret)
}

func TestInitSecretKeysDesktopModeAcceptsInjectedSecret(t *testing.T) {
	isolateSecretGlobals(t)

	t.Setenv(DesktopModeEnv, "1")
	t.Setenv(SessionSecretEnv, strongSecret)
	t.Setenv(CryptoSecretEnv, "")

	require.NoError(t, InitSecretKeys())
	assert.Equal(t, strongSecret, SessionSecret)
}

// TestInitSecretKeysTrimsSurroundingWhitespace 保证从密钥文件或环境变量读入时
// 意外带入的首尾空白不会让一个强密钥被判为不合格，也不会被原样用作密钥。
func TestInitSecretKeysTrimsSurroundingWhitespace(t *testing.T) {
	isolateSecretGlobals(t)

	t.Setenv(SessionSecretEnv, "  "+strongSecret+"\n")
	t.Setenv(CryptoSecretEnv, "")

	require.NoError(t, InitSecretKeys())
	assert.Equal(t, strongSecret, SessionSecret)
}
