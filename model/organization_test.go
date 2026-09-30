package model

import (
	"fmt"
	"sync"
	"testing"

	"github.com/Uter-AI/Uter/common"

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

	err := orgA.AddMembers([]OrgMemberAdd{{UserId: 7, SubQuotaLimit: 0}}, "研发")
	require.ErrorIs(t, err, ErrOrgMemberForeign)

	var user User
	require.NoError(t, DB.Select("organization_id").Where("id = ?", 7).First(&user).Error)
	assert.Equal(t, 2, user.OrganizationId, "跨组织加入必须被拒绝且不改动归属")
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
