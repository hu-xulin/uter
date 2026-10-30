package model

import (
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/uter-ai/uter/common"
)

func setupEmailQuotaTestDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&EmailQuotaUsage{}))
	originalDB := DB
	DB = db
	t.Cleanup(func() { DB = originalDB })
}

func TestIncrEmailSentAccumulatesPerAccountPerDay(t *testing.T) {
	setupEmailQuotaTestDB(t)
	now := time.Date(2026, 10, 30, 10, 0, 0, 0, time.Local)
	date := EmailQuotaDate(now)

	require.NoError(t, IncrEmailSent("info@uter.ai", date))
	require.NoError(t, IncrEmailSent("info@uter.ai", date))
	require.NoError(t, IncrEmailSent("info01@uter.ai", date))

	counts, err := GetEmailSentCounts(date)
	require.NoError(t, err)
	require.Equal(t, map[string]int{"info@uter.ai": 2, "info01@uter.ai": 1}, counts)

	// 跨日隔离：昨天的用量不进今天的统计。
	counts, err = GetEmailSentCounts(EmailQuotaDate(now.AddDate(0, 0, 1)))
	require.NoError(t, err)
	require.Empty(t, counts)
}

func TestIncrEmailSentRejectsEmptyAccount(t *testing.T) {
	setupEmailQuotaTestDB(t)
	require.Error(t, IncrEmailSent("", EmailQuotaDate(time.Now())))
}

func TestMergeSMTPAccountsValueMasksAndMerges(t *testing.T) {
	originalMap := common.OptionMap
	common.OptionMap = map[string]string{}
	t.Cleanup(func() { common.OptionMap = originalMap })

	// 已配置状态：info@uter.ai 有密码。
	common.OptionMap["SMTPAccounts"] = `[{"account":"info@uter.ai","from":"Uter <info@uter.ai>","daily_limit":400,"token":"real-secret"}]`

	// 保存：info@uter.ai 回传掩码串（沿用原密码）、info01 新密码、info02 留空。
	merged, err := MergeSMTPAccountsValue(`[
		{"account":"info@uter.ai","from":"Uter <info@uter.ai>","daily_limit":400,"token":"` + common.MaskSecretValue("real-secret") + `"},
		{"account":"info01@uter.ai","from":"","daily_limit":300,"token":"brand-new-secret"},
		{"account":"info02@uter.ai","from":"","daily_limit":0,"token":""}
	]`)
	require.NoError(t, err)

	accounts := common.ParseSMTPAccounts(merged)
	require.Len(t, accounts, 3)
	require.Equal(t, "real-secret", accounts[0].Token, "掩码串必须还原为库中原密码")
	require.Equal(t, "brand-new-secret", accounts[1].Token)
	require.Empty(t, accounts[2].Token, "新账号留空 Token 就是未配置密码")
	require.Equal(t, 400, accounts[0].DailyLimit)
	require.Equal(t, 300, accounts[1].DailyLimit)
	require.Equal(t, 0, accounts[2].DailyLimit)
}

func TestMergeSMTPAccountsValueValidation(t *testing.T) {
	originalMap := common.OptionMap
	common.OptionMap = map[string]string{}
	t.Cleanup(func() { common.OptionMap = originalMap })

	// 空串 = 清空多账号，放行。
	merged, err := MergeSMTPAccountsValue("")
	require.NoError(t, err)
	require.Empty(t, merged)

	// 空数组 = 清空多账号，归一为 []。
	merged, err = MergeSMTPAccountsValue("[]")
	require.NoError(t, err)
	require.Equal(t, "[]", merged)

	// 非法 JSON。
	_, err = MergeSMTPAccountsValue("{not-json")
	require.Error(t, err)

	// 非法邮箱。
	_, err = MergeSMTPAccountsValue(`[{"account":"not-an-email","daily_limit":400}]`)
	require.Error(t, err)

	// 重复账号。
	_, err = MergeSMTPAccountsValue(`[{"account":"info@uter.ai"},{"account":"info@uter.ai"}]`)
	require.Error(t, err)

	// 负数日限。
	_, err = MergeSMTPAccountsValue(`[{"account":"info@uter.ai","daily_limit":-1}]`)
	require.Error(t, err)

	// account 缺失的条目被丢弃后列表为空 → 归一为 []。
	merged, err = MergeSMTPAccountsValue(`[{"account":"","daily_limit":400}]`)
	require.NoError(t, err)
	require.Equal(t, "[]", merged)
}
