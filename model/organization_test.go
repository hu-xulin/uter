package model

import (
	"fmt"
	"sync"
	"testing"

	"github.com/uter-ai/uter/common"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// PreConsumeOrgQuota — the shared-wallet budget gate (pure, no DB).
// ---------------------------------------------------------------------------

func TestPreConsumeOrgQuota(t *testing.T) {
	cases := []struct {
		name   string
		quota  int64
		used   int64
		amount int64
		wantOK bool
	}{
		{"zero budget always passes", 0, 0, 1000, true},
		{"within budget", 1000, 0, 500, true},
		{"exact remaining budget allowed", 1000, 0, 1000, true},
		{"one over budget rejected", 1000, 0, 1001, false},
		{"partially used within remaining", 1000, 500, 500, true},
		{"partially used over remaining", 1000, 500, 501, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			org := &Organization{Quota: c.quota, UsedQuota: c.used}
			if got := PreConsumeOrgQuota(org, c.amount); got != c.wantOK {
				t.Errorf("PreConsumeOrgQuota(quota=%d, used=%d, amount=%d) = %v, want %v",
					c.quota, c.used, c.amount, got, c.wantOK)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// OrgRole constants — guard against accidental renaming that would break the
// middleware/org gate string comparisons.
// ---------------------------------------------------------------------------

func TestOrgRoleConstants(t *testing.T) {
	if OrgRoleOwner != "owner" || OrgRoleAdmin != "admin" ||
		OrgRoleDepartmentAdmin != "department_admin" || OrgRoleMember != "member" {
		t.Errorf("org role constants drifted: %s/%s/%s/%s",
			OrgRoleOwner, OrgRoleAdmin, OrgRoleDepartmentAdmin, OrgRoleMember)
	}
}

// ---------------------------------------------------------------------------
// EnforceOrgQuota — exercised against a real DB in integration runs; here we
// assert the org-less fast path never blocks a platform user. This keeps the
// unit suite dependency-free (no sqlite driver in the module graph).
// ---------------------------------------------------------------------------

func TestEnforceOrgQuotaNonOrgUserPasses(t *testing.T) {
	// A user with no organization must never be blocked by the org gate,
	// regardless of amount. EnforceOrgQuota short-circuits on orgId==0.
	if err := EnforceOrgQuota(0, 999999); err != nil {
		t.Errorf("EnforceOrgQuota(0, ...) should pass, got %v", err)
	}
	_ = common.RoleRootUser // ensure common import is used
}

// ---------------------------------------------------------------------------
// 组织共享预算的原子预扣、子额度上限与租户边界
// ---------------------------------------------------------------------------

func insertOrgForTest(t *testing.T, id int, quota int64) *Organization {
	t.Helper()
	org := &Organization{Id: id, Name: "org-test", Quota: quota, Status: 1}
	require.NoError(t, DB.Create(org).Error)
	return org
}

func insertOrgUserForTest(t *testing.T, id, orgId int, orgRole string, usedQuota int, subQuotaLimit int64, department string) *User {
	t.Helper()
	user := &User{
		Id:             id,
		Username:       fmt.Sprintf("orguser%d", id),
		AffCode:        fmt.Sprintf("aff%d", id),
		Status:         common.UserStatusEnabled,
		OrganizationId: orgId,
		OrgRole:        orgRole,
		UsedQuota:      usedQuota,
		SubQuotaLimit:  subQuotaLimit,
		DepartmentName: department,
	}
	require.NoError(t, DB.Create(user).Error)
	return user
}

func orgUsedQuotaForTest(t *testing.T, id int) int64 {
	t.Helper()
	var org Organization
	require.NoError(t, DB.Select("used_quota").Where("id = ?", id).First(&org).Error)
	return org.UsedQuota
}

// 预扣必须在数据库里原子完成：预算刚好用尽后，下一笔立刻被拒，且账本不再变动。
func TestReserveOrgQuotaEnforcesBudgetAtomically(t *testing.T) {
	truncateTables(t)
	insertOrgForTest(t, 1, 1_000)
	insertOrgUserForTest(t, 1, 1, OrgRoleMember, 0, 0, "研发")

	require.NoError(t, ReserveOrgQuota(1, 1, 600))
	require.Equal(t, int64(600), orgUsedQuotaForTest(t, 1))

	err := ReserveOrgQuota(1, 1, 600)
	require.ErrorIs(t, err, ErrOrgBudgetExceeded, "超出预算的预扣必须失败")
	assert.Equal(t, int64(600), orgUsedQuotaForTest(t, 1), "失败的预扣不得改动账本")

	require.NoError(t, ReserveOrgQuota(1, 1, 400), "恰好用完剩余预算应放行")
	assert.Equal(t, int64(1_000), orgUsedQuotaForTest(t, 1))
}

// 并发预扣不得突破预算：单条带条件的 UPDATE 让「检查+扣减」原子化。
func TestReserveOrgQuotaIsAtomicUnderConcurrency(t *testing.T) {
	truncateTables(t)
	insertOrgForTest(t, 1, 1_000)
	insertOrgUserForTest(t, 1, 1, OrgRoleMember, 0, 0, "")

	const attempts = 30
	var (
		wg        sync.WaitGroup
		mu        sync.Mutex
		succeeded int
	)
	for range attempts {
		wg.Go(func() {
			err := ReserveOrgQuota(1, 1, 100)
			if err == nil {
				mu.Lock()
				succeeded++
				mu.Unlock()
			}
		})
	}
	wg.Wait()

	assert.Equal(t, 10, succeeded, "预算 1000 / 每笔 100：只应有 10 笔成功")
	assert.Equal(t, int64(1_000), orgUsedQuotaForTest(t, 1), "组织账本不得超过预算")
}

// 子额度上限按数据库权威值判定，且拒绝时不得扣减组织账本。
func TestReserveOrgQuotaEnforcesSubQuotaLimit(t *testing.T) {
	truncateTables(t)
	insertOrgForTest(t, 1, 1_000_000)
	insertOrgUserForTest(t, 1, 1, OrgRoleMember, 900, 1_000, "研发")

	err := ReserveOrgQuota(1, 1, 200)
	require.ErrorIs(t, err, ErrOrgSubQuotaExceeded, "已用 900 + 200 超过子额度 1000")
	assert.Equal(t, int64(0), orgUsedQuotaForTest(t, 1), "子额度拒绝不得扣减组织账本")

	require.NoError(t, ReserveOrgQuota(1, 1, 100), "恰好用完子额度应放行")
	assert.Equal(t, int64(100), orgUsedQuotaForTest(t, 1))
}

// 组织未设预算上限（quota<=0）时不限制额度，但仍受子额度约束。
func TestReserveOrgQuotaTreatsUnsetBudgetAsUnlimited(t *testing.T) {
	truncateTables(t)
	insertOrgForTest(t, 1, 0)
	insertOrgUserForTest(t, 1, 1, OrgRoleMember, 0, 0, "")

	require.NoError(t, ReserveOrgQuota(1, 1, 1_000_000))
	assert.Equal(t, int64(1_000_000), orgUsedQuotaForTest(t, 1))

	remaining, unlimited, err := OrgRemainingQuota(1)
	require.NoError(t, err)
	assert.True(t, unlimited)
	assert.Zero(t, remaining)
}

// 组织归属是租户边界：不能把已属于其它组织的账号「拉」进自己组织。
func TestAddMemberRejectsUserFromAnotherOrganization(t *testing.T) {
	truncateTables(t)
	orgA := insertOrgForTest(t, 1, 0)
	insertOrgForTest(t, 2, 0)
	insertOrgUserForTest(t, 7, 2, OrgRoleMember, 0, 0, "")

	err := orgA.AddMembers([]OrgMemberAdd{{UserId: 7, SubQuotaLimit: 0, DepartmentName: "研发"}})
	require.ErrorIs(t, err, ErrOrgMemberForeign)

	var user User
	require.NoError(t, DB.Select("organization_id").Where("id = ?", 7).First(&user).Error)
	assert.Equal(t, 2, user.OrganizationId, "跨组织加入必须被拒绝且不改动归属")
}

// 结算补扣（IncrOrgUsedQuota）必须如实记账，不做截断。
//
// 旧实现在这里用条件 UPDATE 把突破预算的补扣「整笔丢弃」。看上去守住了上限，实际
// 后果相反：请求已渲染、上游成本已发生，丢弃写入收不回钱；而账本停在预扣额附近，
// used_quota 永远追不上 quota，准入闸门永远放行 —— 组织预算形同虚设，成员可无限白嫖，
// 且消费日志与账本系统性脱节。
//
// 现在的契约：如实累加（允许 used_quota 越过 quota 以暴露超支），预算防线下沉到准入
// （ReserveOrgQuota / EnforceOrgQuota）—— 一旦账本越过预算，后续请求必然被拒。
func TestIncrOrgUsedQuotaRecordsActualConsumption(t *testing.T) {
	truncateTables(t)
	insertOrgForTest(t, 1, 1_000)
	insertOrgUserForTest(t, 1, 1, OrgRoleMember, 0, 0, "")

	require.NoError(t, IncrOrgUsedQuota(1, 600))
	assert.Equal(t, int64(600), orgUsedQuotaForTest(t, 1))

	// 再补 600 会突破 1000 预算：仍必须如实记账，账本与已发生的消耗对齐。
	require.NoError(t, IncrOrgUsedQuota(1, 600))
	assert.Equal(t, int64(1_200), orgUsedQuotaForTest(t, 1), "超支必须如实记账，不得截断")

	// 负 delta（退款回滚）照常回减。
	require.NoError(t, IncrOrgUsedQuota(1, -200))
	assert.Equal(t, int64(1_000), orgUsedQuotaForTest(t, 1))

	// 账本已顶到预算：准入闸门必须拒绝该成员的进一步消耗。
	require.ErrorIs(t, ReserveOrgQuota(1, 1, 500), ErrOrgBudgetExceeded)

	// 不限量组织（quota<=0）不受约束。
	truncateTables(t)
	insertOrgForTest(t, 2, 0)
	insertOrgUserForTest(t, 2, 2, OrgRoleMember, 0, 0, "")
	require.NoError(t, IncrOrgUsedQuota(2, 10_000_000))
	assert.Equal(t, int64(10_000_000), orgUsedQuotaForTest(t, 2))
}

// TestGetOrgMembersExcludesRoles 验证「组织管理员看不到所有者、部门管理员看不到所有者与管理员」
// 的可见性过滤。过滤发生在数据层（GetOrgMembers 的 org_role NOT IN 条件），后端控制器据此
// 把对应角色从成员列表与细分数据中剔除，前端列表自动不再渲染这些行。
func TestGetOrgMembersExcludesRoles(t *testing.T) {
	truncateTables(t)
	org := insertOrgForTest(t, 10, 0)
	insertOrgUserForTest(t, 101, org.Id, OrgRoleOwner, 0, 0, "")
	insertOrgUserForTest(t, 102, org.Id, OrgRoleAdmin, 0, 0, "")
	insertOrgUserForTest(t, 103, org.Id, OrgRoleDepartmentAdmin, 0, 0, "研发")
	insertOrgUserForTest(t, 104, org.Id, OrgRoleMember, 0, 0, "研发")
	insertOrgUserForTest(t, 105, org.Id, OrgRoleMember, 0, 0, "销售")

	// 组织管理员视角：排除所有者，但仍可见其他管理员与成员（含其他部门）。
	admMembers, total, err := GetOrgMembers(org.Id, "", "", 0, 100, OrgRoleOwner)
	require.NoError(t, err)
	assert.Equal(t, int64(4), total)
	admIDs := collectUserIDs(admMembers)
	assert.NotContains(t, admIDs, 101, "组织管理员不应看到所有者")
	assert.Contains(t, admIDs, 102, "组织管理员应看到其他管理员")
	assert.Contains(t, admIDs, 105, "组织管理员应看到其他部门成员")

	// 部门管理员视角（本部门=研发）：排除所有者与管理员，仅本部门成员可见。
	deptMembers, _, err := GetOrgMembers(org.Id, "研发", "", 0, 100, OrgRoleOwner, OrgRoleAdmin)
	require.NoError(t, err)
	deptIDs := collectUserIDs(deptMembers)
	assert.NotContains(t, deptIDs, 101, "部门管理员不应看到所有者")
	assert.NotContains(t, deptIDs, 102, "部门管理员不应看到组织管理员")
	assert.Contains(t, deptIDs, 104, "部门管理员应看到本部门成员")
	assert.NotContains(t, deptIDs, 105, "部门管理员不应看到其他部门成员")
}

// 移出成员只能作用于本组织：不能重置其它组织成员的归属。
func TestRemoveMemberOnlyAffectsOwnOrganization(t *testing.T) {
	truncateTables(t)
	orgA := insertOrgForTest(t, 1, 0)
	insertOrgForTest(t, 2, 0)
	insertOrgUserForTest(t, 8, 2, OrgRoleMember, 0, 0, "")

	require.Error(t, orgA.RemoveMember(8))

	var user User
	require.NoError(t, DB.Select("organization_id", "org_role").Where("id = ?", 8).First(&user).Error)
	assert.Equal(t, 2, user.OrganizationId)
	assert.Equal(t, OrgRoleMember, user.OrgRole)
}

// 部门范围的成员用户名按部门名称解析（department_id 已废弃）。
func TestGetOrgMemberUsernamesInDepartment(t *testing.T) {
	truncateTables(t)
	insertOrgForTest(t, 1, 0)
	insertOrgUserForTest(t, 11, 1, OrgRoleMember, 0, 0, "研发")
	insertOrgUserForTest(t, 12, 1, OrgRoleMember, 0, 0, "研发")
	insertOrgUserForTest(t, 13, 1, OrgRoleMember, 0, 0, "销售")

	names, err := GetOrgMemberUsernamesInDepartment(1, "研发")
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"orguser11", "orguser12"}, names)

	// 空部门名必须落到哨兵值（不匹配任何用户名），不能退化成「不过滤」。
	empty, err := GetOrgMemberUsernamesInDepartment(1, "")
	require.NoError(t, err)
	assert.Equal(t, []string{NoOrgMemberUsername}, empty)

	all, err := GetOrgMemberUsernames(1)
	require.NoError(t, err)
	assert.Len(t, all, 3)
}

// 成员子额度上限必须原子强制：即使并发预扣，账本也不得超过子额度上限。
//
// 这正是 F2 修复的 TOCTOU 竞态——修复前 ReserveOrgQuota 只用只读校验（GetOrgMemberSubQuotaState）
// 判定子额度，真正的 used_quota 自增发生在结算点；同成员的并发请求会全部通过只读校验，
// 结算时集体突破子额度上限，成员可白嫖远超其配额的共享钱包用量。修复后闸门与记账在同一条
// 条件 UPDATE 中完成，并发请求不可能同时通过检查后超扣。
func TestReserveOrgQuotaEnforcesSubQuotaAtomicallyUnderConcurrency(t *testing.T) {
	truncateTables(t)
	insertOrgForTest(t, 1, 0)                                  // 组织不限量，隔离出「仅成员子额度」这一维
	insertOrgUserForTest(t, 1, 1, OrgRoleMember, 0, 1_000, "") // 子额度上限 1000

	const perRequest = 100
	const attempts = 30
	var (
		wg        sync.WaitGroup
		mu        sync.Mutex
		succeeded int
	)
	for range attempts {
		wg.Go(func() {
			err := ReserveOrgQuota(1, 1, perRequest)
			if err == nil {
				mu.Lock()
				succeeded++
				mu.Unlock()
			}
		})
	}
	wg.Wait()

	assert.Equal(t, 10, succeeded, "子额度 1000 / 每笔 100：只应有 10 笔成功")
	var u User
	require.NoError(t, DB.Select("used_quota").Where("id = ?", 1).First(&u).Error)
	assert.Equal(t, int64(1_000), int64(u.UsedQuota), "成员 used_quota 不得超过子额度上限（原子强制）")
}

// 预扣成功、结算实际消耗小于预扣时，成员 used_quota 必须收敛到实际消耗而非叠加预扣额
// （net = 预扣额 + (实际 - 预扣) = 实际），且不得因结算再重复计账。
func TestReserveThenSettleReconcilesMemberUsage(t *testing.T) {
	truncateTables(t)
	insertOrgForTest(t, 1, 0)
	insertOrgUserForTest(t, 1, 1, OrgRoleMember, 0, 1_000_000, "")

	// 预扣 800，结算实际 500：差额 -300 并入后 used_quota 应为 500。
	require.NoError(t, ReserveOrgQuota(1, 1, 800))
	var u User
	require.NoError(t, DB.Select("used_quota").Where("id = ?", 1).First(&u).Error)
	assert.Equal(t, int64(800), int64(u.UsedQuota), "预扣阶段 used_quota 应原子记入")

	// 模拟 WalletFunding.Settle(delta) 的结算差额并入（delta = 实际 - 预扣）。
	require.NoError(t, IncrUserUsedQuotaClamped(1, 500-800))
	require.NoError(t, DB.Select("used_quota").Where("id = ?", 1).First(&u).Error)
	assert.Equal(t, int64(500), int64(u.UsedQuota), "结算后 used_quota 应等于实际消耗，不得叠加预扣额")
}

// 批量纳新遇到不存在的用户 ID 时必须显式失败，而不是让整批「静默成功」。
//
// 旧实现只对 organization_id / role 做三个 Count，不存在的 id 不匹配任何一行，
// 于是穿过准入检查后被 `UPDATE ... WHERE id IN ?` 悄悄跳过——接口返回成功，
// 而该用户根本没进组织，调用方无从察觉（对应 BE-ORG-006 / BE-ORG-007）。
func TestAddMembersRejectsUnknownUserId(t *testing.T) {
	truncateTables(t)
	org := insertOrgForTest(t, 1, 0)
	insertOrgUserForTest(t, 7, 0, "", 0, 0, "")

	err := org.AddMembers([]OrgMemberAdd{
		{UserId: 999999, SubQuotaLimit: 0, DepartmentName: "研发"},
	})
	require.ErrorIs(t, err, ErrOrgMemberUnknown, "不存在的用户 ID 必须被显式拒绝")

	// 已存在的用户不得被这次失败牵连（逐行语义在 controller 层验证）。
	require.NoError(t, org.AddMembers([]OrgMemberAdd{
		{UserId: 7, SubQuotaLimit: 0, DepartmentName: "研发"},
	}))
	var user User
	require.NoError(t, DB.Select("organization_id", "org_role", "department_name").Where("id = ?", 7).First(&user).Error)
	assert.Equal(t, 1, user.OrganizationId)
	assert.Equal(t, OrgRoleMember, user.OrgRole)
	assert.Equal(t, "研发", user.DepartmentName)
}

// 已软删除的账号等同于不存在：不得被纳新复活成组织成员。
func TestAddMembersRejectsSoftDeletedUser(t *testing.T) {
	truncateTables(t)
	org := insertOrgForTest(t, 1, 0)
	insertOrgUserForTest(t, 8, 0, "", 0, 0, "")
	require.NoError(t, DB.Delete(&User{}, 8).Error)

	err := org.AddMembers([]OrgMemberAdd{{UserId: 8, SubQuotaLimit: 0}})
	require.ErrorIs(t, err, ErrOrgMemberUnknown)
}
