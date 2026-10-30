package model

import (
	"fmt"
	"strings"

	"github.com/uter-ai/uter/common"
)

// MergeSMTPAccountsValue 处理 SMTPAccounts 选项的保存：
//
//  1. Token 为空或回传了掩码串（SecretInput 展示态原样提交）时，按 Account
//     匹配沿用库中原凭据——没有这一步，任何一次不带改动的保存都会把密码清空；
//  2. 校验结构：account 必填且唯一、必须是合法邮箱；daily_limit ≥ 0（0 表示
//     使用默认 400）；from 留空时发送侧回退为 account；
//  3. 返回规范化后的 JSON（去空白、补齐字段），供调用方落库。
//
// 输入为空串表示清空多账号配置（回退旧单账号模式），原样放行。
// 解析失败的非法 JSON 报错；解析成功但条目全部无效（如 account 为空）
// 则归一为空列表「[]」，同样表示回退旧单账号模式。
func MergeSMTPAccountsValue(value string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", nil
	}
	var incoming []common.SMTPAccountConfig
	if err := common.UnmarshalJsonStr(trimmed, &incoming); err != nil {
		return "", fmt.Errorf("SMTP accounts configuration is invalid: %w", err)
	}
	filtered := make([]common.SMTPAccountConfig, 0, len(incoming))
	for _, account := range incoming {
		account.Account = strings.TrimSpace(account.Account)
		if account.Account == "" {
			continue
		}
		account.From = strings.TrimSpace(account.From)
		filtered = append(filtered, account)
	}
	if len(filtered) == 0 {
		return "[]", nil
	}
	incoming = filtered

	previous := make(map[string]common.SMTPAccountConfig)
	for _, account := range common.ParseSMTPAccounts(common.OptionMap["SMTPAccounts"]) {
		previous[account.Account] = account
	}

	seen := make(map[string]struct{}, len(incoming))
	normalized := make([]common.SMTPAccountConfig, 0, len(incoming))
	for _, account := range incoming {
		if !isValidEmailAccount(account.Account) {
			return "", fmt.Errorf("SMTP account %q is not a valid email address", account.Account)
		}
		if _, duplicated := seen[account.Account]; duplicated {
			return "", fmt.Errorf("SMTP account %q is duplicated", account.Account)
		}
		seen[account.Account] = struct{}{}
		if account.DailyLimit < 0 {
			return "", fmt.Errorf("SMTP account %q daily limit must not be negative", account.Account)
		}
		// 掩码串是读取侧下发的展示值，不是新凭据；留空同理。
		if account.Token == "" || common.IsMaskedSecret(account.Token) {
			if old, ok := previous[account.Account]; ok {
				account.Token = old.Token
			} else {
				account.Token = ""
			}
		}
		normalized = append(normalized, account)
	}

	encoded, err := common.Marshal(normalized)
	if err != nil {
		return "", err
	}
	return string(encoded), nil
}

// isValidEmailAccount 用与邮箱验证码收件人一致的宽松校验：
// 本地部分@域名，整体不含空白。SMTP 服务器会做最终裁决。
func isValidEmailAccount(account string) bool {
	at := strings.IndexByte(account, '@')
	if at <= 0 || at == len(account)-1 {
		return false
	}
	return !strings.ContainsAny(account, " \t\r\n")
}
