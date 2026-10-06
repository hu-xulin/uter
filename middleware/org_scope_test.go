package middleware

import (
	"testing"

	"github.com/Uter-AI/Uter/common"
	"github.com/Uter-AI/Uter/model"

	"github.com/gin-gonic/gin"
)

// OrgDataScope 是「组织范围管理员能看到谁的什么数据」的唯一表达。
// 这些用例钉住三类边界：
//  1. 超管 / 平台管理员（无组织）不受组织过滤；
//  2. 组织用户被限制在本组织内；
//  3. 部门管理员进一步限制在本部门，且**未分配部门时必须 fail-closed**
//     （退化成看整个组织等于越权看到全公司数据）。

func scopeContext(role, orgId int, orgRole, departmentName string) *gin.Context {
	c, _ := gin.CreateTestContext(nil)
	c.Set("role", role)
	c.Set("organization_id", orgId)
	c.Set("org_role", orgRole)
	c.Set("department_name", departmentName)
	return c
}

func TestOrgDataScope(t *testing.T) {
	cases := []struct {
		name       string
		role       int
		orgId      int
		orgRole    string
		department string
		want       OrgDataScope
	}{
		{
			name: "root sees everything (no filter)",
			role: common.RoleRootUser, orgId: 7, orgRole: model.OrgRoleOwner, department: "研发",
			want: OrgDataScope{},
		},
		{
			name: "platform admin without org sees everything",
			role: common.RoleAdminUser, orgId: 0,
			want: OrgDataScope{},
		},
		{
			name: "org owner confined to own org",
			role: common.RoleCommonUser, orgId: 7, orgRole: model.OrgRoleOwner,
			want: OrgDataScope{OrgID: 7},
		},
		{
			name: "org admin confined to own org regardless of department",
			role: common.RoleCommonUser, orgId: 7, orgRole: model.OrgRoleAdmin, department: "研发",
			want: OrgDataScope{OrgID: 7},
		},
		{
			name: "department admin further confined to own department",
			role: common.RoleCommonUser, orgId: 7, orgRole: model.OrgRoleDepartmentAdmin, department: "研发",
			want: OrgDataScope{OrgID: 7, Department: "研发"},
		},
		{
			name: "department admin without a department sees nothing",
			role: common.RoleCommonUser, orgId: 7, orgRole: model.OrgRoleDepartmentAdmin,
			want: OrgDataScope{OrgID: 7, NoDepartment: true},
		},
		{
			name: "plain member of an org is confined to own org data scope",
			role: common.RoleCommonUser, orgId: 9, orgRole: model.OrgRoleMember,
			want: OrgDataScope{OrgID: 9},
		},
		{
			name: "common user with no org has no scope",
			role: common.RoleCommonUser, orgId: 0,
			want: OrgDataScope{},
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			ctx := scopeContext(c.role, c.orgId, c.orgRole, c.department)
			if got := RequestOrgScope(ctx); got != c.want {
				t.Errorf("RequestOrgScope = %+v, want %+v", got, c.want)
			}
		})
	}
}

// 未分配部门的部门管理员必须落到「不可能匹配」的部门过滤值，
// 而不是空字符串 —— 空字符串在用户/日志查询里表示「不施加部门过滤」。
func TestOrgDataScopeDepartmentFilterFailsClosed(t *testing.T) {
	cases := []struct {
		name string
		in   OrgDataScope
		want string
	}{
		{"platform scope has no department filter", OrgDataScope{}, ""},
		{"org scope has no department filter", OrgDataScope{OrgID: 7}, ""},
		{"department admin filters by own department", OrgDataScope{OrgID: 7, Department: "研发"}, "研发"},
		{"department admin without department never matches", OrgDataScope{OrgID: 7, NoDepartment: true}, model.NoDepartmentFilter},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := c.in.DepartmentFilter(); got != c.want {
				t.Errorf("DepartmentFilter() = %q, want %q", got, c.want)
			}
		})
	}
	if model.NoDepartmentFilter == "" {
		t.Fatal("NoDepartmentFilter must not be empty: empty means no filter in list queries")
	}
}

// Usernames()/UserIDs() 必须与 DepartmentFilter() 同样 fail-closed。
//
// 这是一条被测试盲区放过的真实缺陷：原实现只按 `s.Department == ""` 分流，
// 未分配部门的部门管理员（NoDepartment=true 且 Department 亦为空）会落到
// 「按整个组织查成员」分支，把「什么都看不到」退化成「看到全组织」。
// 修复后 NoDepartment 在查询数据库之前就短路返回哨兵，因此本用例无需 DB。
func TestOrgDataScopeMemberListsFailClosedWithoutDepartment(t *testing.T) {
	scope := OrgDataScope{OrgID: 7, NoDepartment: true}

	names, err := scope.Usernames()
	if err != nil {
		t.Fatalf("Usernames() error = %v", err)
	}
	if len(names) != 1 || names[0] != model.NoOrgMemberUsername {
		t.Errorf("Usernames() = %v, want [%q]（未分配部门必须返回空集哨兵，而非整个组织）",
			names, model.NoOrgMemberUsername)
	}

	ids, err := scope.UserIDs()
	if err != nil {
		t.Fatalf("UserIDs() error = %v", err)
	}
	if len(ids) != 1 || ids[0] != model.NoOrgMemberId {
		t.Errorf("UserIDs() = %v, want [%d]（未分配部门必须返回空集哨兵，而非整个组织）",
			ids, model.NoOrgMemberId)
	}
}
