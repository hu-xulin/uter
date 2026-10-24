package common

import (
	"fmt"
	"log"
	"os"
	"strings"
)

// 密钥相关的环境变量名。
const (
	SessionSecretEnv = "SESSION_SECRET"
	CryptoSecretEnv  = "CRYPTO_SECRET"
)

// MinSecretLength 是会话/加密密钥的最小长度。
//
// 32 是下限而非推荐值：这些密钥是 HMAC-SHA256 的输入，长度直接决定暴力
// 枚举成本，而 32 字符的随机串已远超普通部署的实际需要。真正的推荐值是
// `openssl rand -hex 48`（96 字符）。
const MinSecretLength = 32

// knownSecretPlaceholders 是各部署模板里字面量出现的占位值。
//
// 只拦 "random_string" 是不够的：.env.example 里的实际占位值是
// `__CHANGE_ME_SESSION_SECRET__`，照着模板部署会得到一个固定且可预测的
// 密钥——任何人读过 .git 里的模板都能伪造会话。凡是在这里出现的值都不
// 可能是随机密钥，必须拒绝。
var knownSecretPlaceholders = []string{
	"random_string",
	"__CHANGE_ME_SESSION_SECRET__",
	"__CHANGE_ME_CRYPTO_SECRET__",
	"change_me",
	"changeme",
	"change-me",
	"please_change_me",
	"pleasechangeme",
	"replace_me",
	"your_secret_here",
	"your-secret-here",
	"yoursecrethere",
	"your_session_secret",
	"your_crypto_secret",
	"secret",
	"secret_key",
	"session_secret",
	"crypto_secret",
	"password",
	"test",
	"example",
	"placeholder",
	"todo",
	"xxx",
	"foo",
	"bar",
	"uter",
	"one-api",
	"oneapi",
}

// placeholderSecretMarkers 是"未替换的模板片段"特征子串。占位值经常被改写，
// 但 `CHANGE_ME` / `<...>` 这类标记会留下；命中即视为占位值。
var placeholderSecretMarkers = []string{
	"change_me",
	"changeme",
	"replace_me",
	"replaceme",
	"your_",
	"your-",
	"placeholder",
	"todo",
	"example",
	"insert_",
	"fill_in",
	"fill-me",
	"xxxx",
	"****",
}

// SecretInspection 描述一次密钥校验的结果。
type SecretInspection struct {
	// Problem 为空字符串表示密钥合格。
	Problem string
}

// OK 表示密钥通过了全部检查。
func (i SecretInspection) OK() bool { return i.Problem == "" }

// String 返回人类可读的结论。绝不包含密钥本身，只包含长度与问题类别，
// 这样日志可以安全落盘。
func (i SecretInspection) String() string {
	if i.OK() {
		return "ok"
	}
	return i.Problem
}

// InspectSecret 判断一个密钥值是否可安全用作 HMAC/加密输入。
//
// 判定为不合格的情形：空、命中已知占位值或模板标记、长度不足、
// 有效字符种类过少（形如 "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"）。
// 返回值只描述问题类别，不回显密钥内容。
func InspectSecret(value string) SecretInspection {
	if strings.TrimSpace(value) == "" {
		return SecretInspection{Problem: "密钥为空"}
	}

	trimmed := strings.TrimSpace(value)
	lowered := strings.ToLower(trimmed)

	for _, placeholder := range knownSecretPlaceholders {
		if lowered == strings.ToLower(strings.TrimSpace(placeholder)) {
			return SecretInspection{Problem: "密钥是部署模板中的占位值"}
		}
	}
	for _, marker := range placeholderSecretMarkers {
		if strings.Contains(lowered, marker) {
			return SecretInspection{Problem: "密钥包含未替换的模板标记 " + strings.ToUpper(marker)}
		}
	}
	// 尖括号包裹的说明文字，如 `<粘贴生成的48字节随机串>`。
	if strings.HasPrefix(trimmed, "<") || strings.HasSuffix(trimmed, ">") {
		return SecretInspection{Problem: "密钥是模板中的说明文字而非随机值"}
	}

	if len(trimmed) < MinSecretLength {
		return SecretInspection{Problem: fmt.Sprintf("密钥长度 %d 小于最小要求 %d", len(trimmed), MinSecretLength)}
	}

	distinct := make(map[rune]struct{}, len(trimmed))
	for _, r := range trimmed {
		if r == ' ' || r == '-' || r == '_' {
			continue
		}
		distinct[r] = struct{}{}
	}
	if len(distinct) < 8 {
		return SecretInspection{Problem: fmt.Sprintf("密钥有效字符种类仅 %d 种，熵过低", len(distinct))}
	}

	return SecretInspection{}
}

// InitSecretKeys 初始化会话签名密钥与数据加密密钥。
//
// 两种部署形态的密钥来源不同，但校验规则一致严格：
//
//   - 服务端部署：密钥必须显式来自环境变量。缺失、占位值、过短都会让启动
//     失败。此前的行为是"未设置就退回进程内随机 UUID"，那会让多实例部署
//     的会话互不认可、单实例重启后刷新令牌全部失效，而且没有任何提示。
//   - 桌面部署：密钥由 Electron 从用户数据目录的密钥文件注入，同样缺失或
//     不合格即启动失败，避免桌面端静默退化到随机密钥。
//
// 错误信息只包含长度与问题类别，不包含密钥本身。
func InitSecretKeys() error {
	desktop := IsDesktopMode()

	sessionSecret, err := resolveSecret(SessionSecretEnv, desktop)
	if err != nil {
		return err
	}
	SessionSecret = sessionSecret

	cryptoSecret, explicit, err := resolveCryptoSecret(desktop)
	if err != nil {
		return err
	}
	if cryptoSecret == "" {
		// CRYPTO_SECRET 未设置：沿用会话密钥派生，保证已用旧密钥加密的数据
		// （如两步验证密钥）和已签发的任务资源链接在重启后仍然可用。
		// 这是兼容既有数据的必要行为，不是推荐配置——日志会明确提示分离。
		CryptoSecret = SessionSecret
		if !explicit {
			logSecretAdvice("%s 未设置，数据加密与资源访问签名暂时复用 %s 派生的密钥。"+
				"这保证既有加密数据与已签发链接在重启后仍然可用，但两个用途没有真正分离；"+
				"建议用 `openssl rand -hex 48` 另生成一个不同的值并设置 %s。",
				CryptoSecretEnv, SessionSecretEnv, CryptoSecretEnv)
		}
		return nil
	}

	CryptoSecret = cryptoSecret
	return nil
}

// resolveSecret 读取并校验一个密钥环境变量。
//
// 该函数不做任何"退回随机值"的处理：缺密钥就是配置错误，必须让进程起不来。
func resolveSecret(envName string, desktop bool) (string, error) {
	raw, set := os.LookupEnv(envName)
	if !set || strings.TrimSpace(raw) == "" {
		if desktop {
			return "", fmt.Errorf("%s 未设置：桌面模式应由 Electron 从用户数据目录的密钥文件注入持久化密钥，"+
				"缺失说明注入失败；请删除 %s 后重新启动桌面端以重新生成", envName, desktopSecretHintFileName)
		}
		return "", fmt.Errorf("%s 未设置：请用 `openssl rand -hex 48` 生成一个随机值后配置，"+
			"不要使用部署模板中的占位值", envName)
	}

	inspection := InspectSecret(raw)
	if !inspection.OK() {
		return "", fmt.Errorf("%s 不合格（长度 %d）：%s；请用 `openssl rand -hex 48` 重新生成",
			envName, len(strings.TrimSpace(raw)), inspection)
	}
	return strings.TrimSpace(raw), nil
}

// resolveCryptoSecret 处理数据加密密钥。第二个返回值表示是否显式设置了该变量。
//
// 显式设置时必须与 SESSION_SECRET 不同：写同一个值等于没有分离，只是个别名，
// 却会让人误以为两个用途已经隔离。
func resolveCryptoSecret(desktop bool) (string, bool, error) {
	raw, set := os.LookupEnv(CryptoSecretEnv)
	if !set || strings.TrimSpace(raw) == "" {
		return "", false, nil
	}

	secret, err := resolveSecret(CryptoSecretEnv, desktop)
	if err != nil {
		return "", true, err
	}
	if secret == SessionSecret {
		return "", true, fmt.Errorf("%s 与 %s 取值相同：两个用途必须使用各自独立的随机密钥，"+
			"请用 `openssl rand -hex 48` 分别生成", CryptoSecretEnv, SessionSecretEnv)
	}
	return secret, true, nil
}

// desktopSecretHintFileName 是 Electron 持久化密钥的文件名，仅用于错误提示。
const desktopSecretHintFileName = "secrets.json"

// logSecretAdvice 打印密钥配置建议。只包含变量名与生成命令，绝不包含密钥值。
func logSecretAdvice(format string, args ...any) {
	log.Printf("SECRET ADVICE: "+format, args...)
}
