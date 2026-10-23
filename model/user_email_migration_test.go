package model

import (
	"testing"

	"github.com/uter-ai/uter/common"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// resetEmailLookupNormalized 保存并在用例结束时恢复查询口径开关，
// 避免用例之间互相影响（该开关是进程级 atomic）。
func resetEmailLookupNormalized(t *testing.T) {
	t.Helper()
	previous := emailLookupNormalized.Load()
	t.Cleanup(func() { emailLookupNormalized.Store(previous) })
}

func TestMigrateUserEmailNormalizationBackfillsAndSwitchesLookup(t *testing.T) {
	setupUserUpdateTestState(t)
	resetEmailLookupNormalized(t)
	emailLookupNormalized.Store(false)

	require.NoError(t, DB.Create(&User{
		Username: "legacy-upper-email", Email: "Legacy@Example.COM", AffCode: "aff-legacy-upper",
		Role: common.RoleCommonUser, Status: common.UserStatusEnabled,
	}).Error)
	require.NoError(t, DB.Create(&User{
		Username: "plain-email", Email: "plain@example.com", AffCode: "aff-plain",
		Role: common.RoleCommonUser, Status: common.UserStatusEnabled,
	}).Error)

	require.NoError(t, migrateUserEmailNormalization(DB))
	assert.True(t, emailLookupNormalized.Load(), "无重复邮箱时应完成回填并切换到等值查询")

	var stored string
	require.NoError(t, DB.Model(&User{}).Where("username = ?", "legacy-upper-email").Pluck("email", &stored).Error)
	assert.Equal(t, "legacy@example.com", stored, "存量行必须被回填成小写")

	found, err := GetUniqueUserByEmail("LEGACY@example.com")
	require.NoError(t, err)
	assert.Equal(t, "legacy-upper-email", found.Username, "等值查询仍要能命中大小写不同的输入")
}

func TestMigrateUserEmailNormalizationSkipsCaseDuplicateAccounts(t *testing.T) {
	setupUserUpdateTestState(t)
	resetEmailLookupNormalized(t)
	emailLookupNormalized.Store(true)

	require.NoError(t, DB.Create(&User{
		Username: "duplicate-a", Email: "Dup@Example.com", AffCode: "aff-dup-a",
		Role: common.RoleCommonUser, Status: common.UserStatusEnabled,
	}).Error)
	require.NoError(t, DB.Create(&User{
		Username: "duplicate-b", Email: "dup@example.com", AffCode: "aff-dup-b",
		Role: common.RoleCommonUser, Status: common.UserStatusEnabled,
	}).Error)

	require.NoError(t, migrateUserEmailNormalization(DB))
	assert.False(t, emailLookupNormalized.Load(), "存在大小写重复账号时必须保留 LOWER() 兜底")

	var stored string
	require.NoError(t, DB.Model(&User{}).Where("username = ?", "duplicate-a").Pluck("email", &stored).Error)
	assert.Equal(t, "Dup@Example.com", stored, "跳过时不得改动存量数据")

	// 兜底查询仍要同时看到两行，返回歧义而不是随便挑一个。
	_, err := GetUniqueUserByEmail("dup@example.com")
	require.ErrorIs(t, err, ErrEmailAmbiguous)
}

// TestEmailLookupConditionFollowsNormalizationState 用 DryRun 断言实际生成的 SQL：
// 回填完成后查询必须是等值比较（才能命中 idx_users_email），未完成时保留 LOWER() 兜底。
func TestEmailLookupConditionFollowsNormalizationState(t *testing.T) {
	resetEmailLookupNormalized(t)

	build := func() string {
		t.Helper()
		var users []User
		stmt := emailQuery(DB.Session(&gorm.Session{DryRun: true}), "User@Example.com").Find(&users).Statement
		return stmt.SQL.String()
	}

	emailLookupNormalized.Store(true)
	normalized := build()
	assert.Contains(t, normalized, "email = ?")
	assert.NotContains(t, normalized, "LOWER(")

	emailLookupNormalized.Store(false)
	fallback := build()
	assert.Contains(t, fallback, "LOWER(email) = ?")
}
