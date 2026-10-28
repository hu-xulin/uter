package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/setting/operation_setting"
	"gorm.io/gorm"
)

func setupCheckinTestDB(t *testing.T) {
	t.Helper()
	WaitCacheSyncForTest()
	oldDB := DB
	oldType := common.MainDatabaseType()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	require.NoError(t, db.AutoMigrate(&User{}, &Checkin{}))
	t.Cleanup(func() {
		WaitCacheSyncForTest()
		DB = oldDB
		common.SetMainDatabaseType(oldType)
	})
}

func newCheckinTestUser(t *testing.T, quota int) *User {
	t.Helper()
	user := &User{
		Id:       int(1000 + testIdSeq()),
		Username: "checkin-user",
		Quota:    quota,
		Status:   1,
		Group:    "default",
	}
	require.NoError(t, DB.Create(user).Error)
	return user
}

func withCheckinSetting(t *testing.T, enabled bool, minQuota, maxQuota int) {
	t.Helper()
	setting := operation_setting.GetCheckinSetting()
	old := *setting
	setting.Enabled = enabled
	setting.MinQuota = minQuota
	setting.MaxQuota = maxQuota
	t.Cleanup(func() { *setting = old })
}

// TestCheckinQuotaAwardStaysInsideConfiguredRange 锁住发放区间：
// 旧实现只能靠「真签一次看结果」验证，端点值永远测不到。
func TestCheckinQuotaAwardStaysInsideConfiguredRange(t *testing.T) {
	const minQuota, maxQuota = 50000, 250000
	for range 20000 {
		award := checkinQuotaAward(minQuota, maxQuota)
		require.GreaterOrEqual(t, award, minQuota)
		require.LessOrEqual(t, award, maxQuota)
	}
}

// TestCheckinQuotaAwardCoversBothEndpoints 在小闭区间上验证两端可达：
// 大区间下端点概率只有 1/span，用 2 万次采样断言「一定出现」本身就是错的前提。
func TestCheckinQuotaAwardCoversBothEndpoints(t *testing.T) {
	const minQuota, maxQuota = 7, 9
	seen := map[int]bool{}
	for range 500 {
		seen[checkinQuotaAward(minQuota, maxQuota)] = true
	}
	assert.True(t, seen[7] && seen[8] && seen[9], "all values in [7,9] must be reachable, got %v", seen)
	assert.Len(t, seen, 3, "no value outside [7,9] may be produced")
}

func TestCheckinQuotaAwardDegenerateRanges(t *testing.T) {
	assert.Equal(t, 1234, checkinQuotaAward(1234, 1234), "equal bounds award that bound")
	assert.Equal(t, 1234, checkinQuotaAward(1234, 1000), "inverted bounds must not panic")
}

// TestUserCheckinRejectsMisconfiguredRange 验证非法区间不会变成资损：
// 旧实现在 max < min 时静默按 min 发放，在 min < 0 时会扣用户余额。
func TestUserCheckinRejectsMisconfiguredRange(t *testing.T) {
	cases := []struct {
		name     string
		minQuota int
		maxQuota int
	}{
		{"max below min", 5000, 1000},
		{"both zero", 0, 0},
		{"negative min", -1000, 1000},
		{"negative max", 0, -1},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			setupCheckinTestDB(t)
			withCheckinSetting(t, true, tc.minQuota, tc.maxQuota)
			user := newCheckinTestUser(t, 0)

			_, err := UserCheckin(user.Id)
			require.Error(t, err)

			var count int64
			require.NoError(t, DB.Model(&Checkin{}).Where("user_id = ?", user.Id).Count(&count).Error)
			assert.Zero(t, count, "a rejected check-in must not leave a record behind")

			var after User
			require.NoError(t, DB.First(&after, user.Id).Error)
			assert.Zero(t, after.Quota, "a rejected check-in must not change the balance")
		})
	}
}

// TestUserCheckinCreditsExactlyOnce 验证额度确实加到余额上，且同一天不可重复签到。
func TestUserCheckinCreditsExactlyOnce(t *testing.T) {
	setupCheckinTestDB(t)
	withCheckinSetting(t, true, 1000, 2000)
	user := newCheckinTestUser(t, 500)

	record, err := UserCheckin(user.Id)
	require.NoError(t, err)
	require.NotNil(t, record)
	assert.Equal(t, record.CheckinDate, checkinToday())
	assert.GreaterOrEqual(t, record.QuotaAwarded, 1000)
	assert.LessOrEqual(t, record.QuotaAwarded, 2000)

	var after User
	require.NoError(t, DB.First(&after, user.Id).Error)
	assert.Equal(t, 500+record.QuotaAwarded, after.Quota, "balance must grow by exactly the awarded quota")

	_, err = UserCheckin(user.Id)
	require.Error(t, err)

	require.NoError(t, DB.First(&after, user.Id).Error)
	assert.Equal(t, 500+record.QuotaAwarded, after.Quota, "second check-in must not credit again")
}

// TestUserCheckinRespectsWalletCeiling 验证余额触顶时整笔签到回滚：
// 记录不能留下，否则用户当天既拿不到额度、也无法再签。
func TestUserCheckinRespectsWalletCeiling(t *testing.T) {
	setupCheckinTestDB(t)
	withCheckinSetting(t, true, 1000, 2000)
	user := newCheckinTestUser(t, common.MaxWalletQuota-1)

	_, err := UserCheckin(user.Id)
	require.Error(t, err)

	var count int64
	require.NoError(t, DB.Model(&Checkin{}).Where("user_id = ?", user.Id).Count(&count).Error)
	assert.Zero(t, count, "check-in must roll back when the wallet is full")

	var after User
	require.NoError(t, DB.First(&after, user.Id).Error)
	assert.Equal(t, common.MaxWalletQuota-1, after.Quota)
}

// TestCheckinMonthRangeUsesRealMonthEnd 验证月末边界：
// 旧实现固定用 "-31" 当上界，2 月与 30 天月份都依赖字符串字典序碰巧成立。
func TestCheckinMonthRangeUsesRealMonthEnd(t *testing.T) {
	cases := []struct {
		month    string
		start    string
		end      string
		wantFail bool
	}{
		{month: "2026-02", start: "2026-02-01", end: "2026-02-28"},
		{month: "2028-02", start: "2028-02-01", end: "2028-02-29"},
		{month: "2026-04", start: "2026-04-01", end: "2026-04-30"},
		{month: "2026-12", start: "2026-12-01", end: "2026-12-31"},
		{month: "2026-13", wantFail: true},
		{month: "", wantFail: true},
		{month: "2026-1", wantFail: true},
		{month: "2026-1a", wantFail: true},
	}
	for _, tc := range cases {
		start, end, err := checkinMonthRange(tc.month)
		if tc.wantFail {
			assert.Error(t, err, "month %q should be rejected", tc.month)
			continue
		}
		require.NoError(t, err, "month %q", tc.month)
		assert.Equal(t, tc.start, start, "month %q start", tc.month)
		assert.Equal(t, tc.end, end, "month %q end", tc.month)
	}
}

// TestGetUserCheckinStatsIsolatesMonths 验证统计口径：
// 本月记录、累计次数、累计额度三者互不串月。
func TestGetUserCheckinStatsIsolatesMonths(t *testing.T) {
	setupCheckinTestDB(t)
	withCheckinSetting(t, true, 1000, 2000)
	user := newCheckinTestUser(t, 0)

	require.NoError(t, DB.Create(&Checkin{UserId: user.Id, CheckinDate: "2026-09-05", QuotaAwarded: 111}).Error)
	require.NoError(t, DB.Create(&Checkin{UserId: user.Id, CheckinDate: "2026-10-02", QuotaAwarded: 222}).Error)
	require.NoError(t, DB.Create(&Checkin{UserId: user.Id, CheckinDate: "2026-10-31", QuotaAwarded: 333}).Error)

	october, err := GetUserCheckinStats(user.Id, "2026-10")
	require.NoError(t, err)
	assert.Equal(t, int64(3), october["total_checkins"])
	assert.Equal(t, int64(666), october["total_quota"])
	assert.Equal(t, 2, october["checkin_count"])
	assert.Len(t, october["records"], 2)
	assert.Equal(t, checkinToday(), october["today"])

	september, err := GetUserCheckinStats(user.Id, "2026-09")
	require.NoError(t, err)
	assert.Equal(t, 1, september["checkin_count"], "September must not see October rows")
	assert.Equal(t, int64(666), september["total_quota"], "all-time total is month independent")

	_, err = GetUserCheckinStats(user.Id, "2026-13")
	assert.Error(t, err)
}

// testIdSeq 给内存 SQLite 分配互不冲突的主键，避开 sqlite_sequence 冲突。
var testIdSeqCounter int

func testIdSeq() int {
	testIdSeqCounter++
	return testIdSeqCounter
}
