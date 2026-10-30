package service

import (
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

func setupSMTPAccountsTest(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.EmailQuotaUsage{}))
	originalDB := model.DB
	model.DB = db
	originalMap := common.OptionMap
	common.OptionMap = map[string]string{}
	t.Cleanup(func() {
		model.DB = originalDB
		common.OptionMap = originalMap
	})
}

func setSMTPAccounts(t *testing.T, accounts []common.SMTPAccountConfig) {
	t.Helper()
	encoded, err := common.Marshal(accounts)
	require.NoError(t, err)
	common.OptionMap["SMTPAccounts"] = string(encoded)
}

func TestSelectSMTPSenderRotatesThroughAccounts(t *testing.T) {
	setupSMTPAccountsTest(t)
	setSMTPAccounts(t, []common.SMTPAccountConfig{
		{Account: "info@uter.ai", DailyLimit: 2},
		{Account: "info01@uter.ai", DailyLimit: 2, Token: "secret-01"},
		{Account: "info02@uter.ai", DailyLimit: 0}, // 0 = 默认 400
	})

	// info@uter.ai 未用 → 第一顺位。
	creds, err := SelectSMTPSender()
	require.NoError(t, err)
	require.Equal(t, "info@uter.ai", creds.Account)

	// info@uter.ai 用满 2 封 → 切到 info01。
	require.NoError(t, model.IncrEmailSent("info@uter.ai", model.EmailQuotaDate(time.Now())))
	require.NoError(t, model.IncrEmailSent("info@uter.ai", model.EmailQuotaDate(time.Now())))
	creds, err = SelectSMTPSender()
	require.NoError(t, err)
	require.Equal(t, "info01@uter.ai", creds.Account)
	require.Equal(t, "secret-01", creds.Token)

	// info01 也用满 → 切到 info02（默认 400，未达限额）。
	require.NoError(t, model.IncrEmailSent("info01@uter.ai", model.EmailQuotaDate(time.Now())))
	require.NoError(t, model.IncrEmailSent("info01@uter.ai", model.EmailQuotaDate(time.Now())))
	creds, err = SelectSMTPSender()
	require.NoError(t, err)
	require.Equal(t, "info02@uter.ai", creds.Account)
}

func TestSelectSMTPSenderExhaustedReturnsError(t *testing.T) {
	setupSMTPAccountsTest(t)
	setSMTPAccounts(t, []common.SMTPAccountConfig{
		{Account: "info@uter.ai", DailyLimit: 1},
		{Account: "info01@uter.ai", DailyLimit: 1},
	})
	require.NoError(t, model.IncrEmailSent("info@uter.ai", model.EmailQuotaDate(time.Now())))
	require.NoError(t, model.IncrEmailSent("info01@uter.ai", model.EmailQuotaDate(time.Now())))

	_, err := SelectSMTPSender()
	require.Error(t, err)
	require.Contains(t, err.Error(), "daily sending limit")
}

func TestSelectSMTPSenderEmptyListFallsBackToLegacy(t *testing.T) {
	setupSMTPAccountsTest(t)
	common.OptionMap["SMTPAccounts"] = ""

	creds, err := SelectSMTPSender()
	require.NoError(t, err)
	require.Empty(t, creds.Account, "空列表返回空凭据，SendEmail 回退旧单账号配置")
}

func TestRecordEmailSentAccumulates(t *testing.T) {
	setupSMTPAccountsTest(t)

	RecordEmailSent("info@uter.ai")
	RecordEmailSent("info@uter.ai")
	RecordEmailSent("") // 空账号静默忽略

	counts, err := model.GetEmailSentCounts(model.EmailQuotaDate(time.Now()))
	require.NoError(t, err)
	require.Equal(t, map[string]int{"info@uter.ai": 2}, counts)
}
