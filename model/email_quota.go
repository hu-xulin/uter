package model

import (
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/uter-ai/uter/common"
)

// EmailQuotaUsage 按账号累计每个自然日的成功发信量，
// 供 SMTP 多账号轮换的配额判断使用（每个邮箱每天 400 封，满额切下一个）。
//
// 复合主键 (date, account)；date 使用服务器本地时区的 YYYY-MM-DD。
// 用 GORM upsert 写入，SQLite / MySQL / PostgreSQL 三种主库兼容。
type EmailQuotaUsage struct {
	Date    string `gorm:"primaryKey;type:varchar(10)" json:"date"`
	Account string `gorm:"primaryKey;type:varchar(255)" json:"account"`
	Count   int    `json:"count"`
}

func (EmailQuotaUsage) TableName() string {
	return "email_quota_usages"
}

// EmailQuotaDate 返回服务器本地时区当天日期串（与用量表的主键格式一致）。
func EmailQuotaDate(now time.Time) string {
	return now.Format("2006-01-02")
}

// GetEmailSentCounts 返回指定日期各账号的成功发信量。无记录的账号不在返回值中。
func GetEmailSentCounts(date string) (map[string]int, error) {
	if DB == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	var rows []EmailQuotaUsage
	if err := DB.Where("date = ?", date).Find(&rows).Error; err != nil {
		return nil, err
	}
	counts := make(map[string]int, len(rows))
	for _, row := range rows {
		counts[row.Account] = row.Count
	}
	return counts, nil
}

// IncrEmailSent 把某账号当日的成功发信量加一（原子 upsert，无记录则建为 1）。
func IncrEmailSent(account string, date string) error {
	if DB == nil {
		return fmt.Errorf("database is not initialized")
	}
	if account == "" {
		return fmt.Errorf("email account is empty")
	}
	usage := EmailQuotaUsage{Date: date, Account: account, Count: 1}
	result := DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "date"}, {Name: "account"}},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"count": gorm.Expr("email_quota_usages.count + 1"),
		}),
	}).Create(&usage)
	return result.Error
}

// GetSMTPAccountUsageView 返回 SMTPAccountsView 需要的当日用量映射；
// 查询失败时返回空映射并记日志——展示用途，不值得让设置页报错。
func GetSMTPAccountUsageView(now time.Time) map[string]int {
	counts, err := GetEmailSentCounts(EmailQuotaDate(now))
	if err != nil {
		common.SysError(common.LogText("failed to load email quota usage: %v", err))
		return map[string]int{}
	}
	return counts
}
