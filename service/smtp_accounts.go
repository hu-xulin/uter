package service

import (
	"fmt"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

// SelectSMTPSender 是 common.SMTPSenderProvider 的实现：按 SMTPAccounts
// 配置的顺序选取今天还有剩余配额的发信邮箱。
//
//   - 未配置多账号（列表为空）→ 返回空凭据，SendEmail 回退旧单账号配置；
//   - 某账号 daily_limit 未填（≤0）→ 按 common.DefaultSMTPDailySendLimit（400）执行；
//   - 所有账号当日配额用完 → 返回错误，发送中止（不静默超额）；
//   - 用量查询失败 → 记日志并回退第一个账号（配额是运营限制而非安全边界，
//     不因一次 DB 抖动阻断验证码等关键邮件）。
func SelectSMTPSender() (common.SMTPSenderCredentials, error) {
	accounts := common.ParseSMTPAccounts(common.OptionMap["SMTPAccounts"])
	if len(accounts) == 0 {
		return common.SMTPSenderCredentials{}, nil
	}

	date := model.EmailQuotaDate(time.Now())
	counts, err := model.GetEmailSentCounts(date)
	if err != nil {
		common.SysError(common.LogText("failed to load email quota usage, falling back to first SMTP account: %v", err))
		first := accounts[0]
		return common.SMTPSenderCredentials{Account: first.Account, From: first.From, Token: first.Token}, nil
	}

	for _, account := range accounts {
		limit := account.DailyLimit
		if limit <= 0 {
			limit = common.DefaultSMTPDailySendLimit
		}
		if counts[account.Account] < limit {
			return common.SMTPSenderCredentials{Account: account.Account, From: account.From, Token: account.Token}, nil
		}
	}
	return common.SMTPSenderCredentials{}, fmt.Errorf(
		"All SMTP sender accounts have reached their daily sending limit (%d emails each)",
		common.DefaultSMTPDailySendLimit,
	)
}

// RecordEmailSent 是 common.SMTPSentRecorder 的实现：一封邮件成功提交后
// 按账号累计当日用量。失败只记日志，不影响已成功的发送。
func RecordEmailSent(account string) {
	if account == "" {
		return
	}
	if err := model.IncrEmailSent(account, model.EmailQuotaDate(time.Now())); err != nil {
		common.SysError(common.LogText("failed to record email quota usage for %s: %v", account, err))
	}
}
