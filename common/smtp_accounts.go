package common

import (
	"encoding/json"
	"strings"
)

// DefaultSMTPDailySendLimit 是发信邮箱每日配额的默认值（封/天）。
// SMTPAccounts 里某账号 daily_limit 未填（≤0）时按此值执行。
const DefaultSMTPDailySendLimit = 400

// SMTPSenderCredentials 是一次发信所用的完整凭据。
// Account 同时用作 SMTP 认证用户名与默认发件地址；From 为空时回退 Account。
type SMTPSenderCredentials struct {
	Account string
	From    string
	Token   string
}

// SMTPSenderProvider 由上层（service）在启动时注入：每次发信前调用，
// 返回本次使用的发信邮箱。返回 Account 为空表示「未启用多账号」，
// SendEmail 应回退到旧的单账号 SMTPAccount/SMTPToken 配置。
// 返回 error 时发送中止（例如所有邮箱当日配额已用完）。
var SMTPSenderProvider func() (SMTPSenderCredentials, error)

// SMTPSentRecorder 由上层注入：一封邮件成功提交（DATA 阶段完成）后调用，
// 用于按账号累计当日用量。注册器自身负责容错，不得让发送流程失败。
var SMTPSentRecorder func(account string)

// SMTPAccountConfig 是 SMTPAccounts 选项里单个发信邮箱的配置。
//
// SMTPAccounts 是 JSON 数组整体存储（option key：SMTPAccounts）：
//   - 顺序即轮换顺序：从第一个账号开始，当日成功发信数达到
//     daily_limit（默认 400）后切换到下一个；
//   - Token 是各账号在 SMTP 服务器上的认证密码，读取接口
//     （GET /api/option/）整条剔除该选项，只在派生的 SMTPAccountsView
//     里以掩码形态展示；
//   - 保存时 Token 留空或回传掩码串表示「沿用库中原凭据」（按 Account 匹配）。
type SMTPAccountConfig struct {
	Account    string `json:"account"`
	From       string `json:"from"`
	DailyLimit int    `json:"daily_limit"`
	Token      string `json:"token"`
}

// ParseSMTPAccounts 宽松解析 SMTPAccounts JSON。
// 空串 / 非法 JSON / 结构不对都返回 nil——上层据此回退旧单账号配置。
// 单条 account 为空的条目被丢弃（脏数据容忍，不让整个列表失效）。
func ParseSMTPAccounts(value string) []SMTPAccountConfig {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	var accounts []SMTPAccountConfig
	if err := json.Unmarshal([]byte(trimmed), &accounts); err != nil {
		return nil
	}
	result := make([]SMTPAccountConfig, 0, len(accounts))
	for _, account := range accounts {
		account.Account = strings.TrimSpace(account.Account)
		if account.Account == "" {
			continue
		}
		account.From = strings.TrimSpace(account.From)
		result = append(result, account)
	}
	return result
}
