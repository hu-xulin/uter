package controller

import (
	"testing"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// orgVisibilityExcludeRoles 是「成员列表 / 日志 / 审计 / 任务」共享的可见性口径。
// 这些用例钉住：组织管理员隐去所有者，部门管理员隐去所有者与组织管理员，
// 所有者与超管不隐去任何角色。
func TestOrgVisibilityExcludeRoles(t *testing.T) {
	cases := []struct {
		name      string
		authority orgAuthority
		want      []string
	}{
		{"none hides nobody", orgAuthorityNone, nil},
		{"department admin hides owner and org admin", orgAuthorityDepartmentAdmin,
			[]string{model.OrgRoleOwner, model.OrgRoleAdmin}},
		{"org admin hides owner only", orgAuthorityOrgAdmin, []string{model.OrgRoleOwner}},
		{"org manager hides nobody", orgAuthorityOrgManager, nil},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			assert.Equal(t, c.want, orgVisibilityExcludeRoles(c.authority))
		})
	}
}

// orgLogUsernames / orgMemberIds 是日志与任务日志范围过滤的两个维度。
// 它们必须在「可见成员为空」时返回不可能匹配的哨兵，否则下游会把空列表
// 解释成「不施加过滤」，静默退化为看全平台数据。
func TestOrgScopeFiltersFailClosed(t *testing.T) {
	previousDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Organization{}))
	model.DB = db
	t.Cleanup(func() {
		model.DB = previousDB
		_ = sqlDB.Close()
	})

	require.NoError(t, db.Create(&model.Organization{Id: 7, Name: "org", OwnerUserId: 100, Status: model.OrgStatusEnabled}).Error)
	users := []model.User{
		{Id: 100, Username: "owner", Password: "x", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, OrganizationId: 7, OrgRole: model.OrgRoleOwner, AffCode: "v-owner"},
		{Id: 101, Username: "admin", Password: "x", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, OrganizationId: 7, OrgRole: model.OrgRoleAdmin, DepartmentName: "总办", AffCode: "v-admin"},
		{Id: 102, Username: "deptadmin", Password: "x", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, OrganizationId: 7, OrgRole: model.OrgRoleDepartmentAdmin, DepartmentName: "销售部", AffCode: "v-deptadmin"},
		{Id: 103, Username: "m1", Password: "x", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, OrganizationId: 7, OrgRole: model.OrgRoleMember, DepartmentName: "销售部", AffCode: "v-m1"},
		{Id: 104, Username: "m2", Password: "x", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, OrganizationId: 7, OrgRole: model.OrgRoleMember, DepartmentName: "研发部", AffCode: "v-m2"},
		{Id: 200, Username: "outsider", Password: "x", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, OrganizationId: 0, AffCode: "v-outsider"},
	}
	require.NoError(t, db.Create(&users).Error)

	ctxOf := func(dept string) *gin.Context {
		c, _ := gin.CreateTestContext(nil)
		c.Set("department_name", dept)
		return c
	}

	t.Run("department admin is confined to own department", func(t *testing.T) {
		names, err := orgLogUsernames(ctxOf("销售部"), 7, orgAuthorityDepartmentAdmin)
		require.NoError(t, err)
		assert.ElementsMatch(t, []string{"deptadmin", "m1"}, names)
		ids, err := orgMemberIds(ctxOf("销售部"), 7, orgAuthorityDepartmentAdmin)
		require.NoError(t, err)
		assert.ElementsMatch(t, []int{102, 103}, ids)
	})

	t.Run("org admin hides owner but sees whole org", func(t *testing.T) {
		names, err := orgLogUsernames(ctxOf(""), 7, orgAuthorityOrgAdmin)
		require.NoError(t, err)
		assert.ElementsMatch(t, []string{"admin", "deptadmin", "m1", "m2"}, names)
		assert.NotContains(t, names, "owner")
		assert.NotContains(t, names, "outsider")
	})

	t.Run("owner sees whole org", func(t *testing.T) {
		ids, err := orgMemberIds(ctxOf(""), 7, orgAuthorityOrgManager)
		require.NoError(t, err)
		assert.ElementsMatch(t, []int{100, 101, 102, 103, 104}, ids)
		assert.NotContains(t, ids, 200)
	})

	t.Run("unassigned department admin fails closed", func(t *testing.T) {
		names, err := orgLogUsernames(ctxOf(""), 7, orgAuthorityDepartmentAdmin)
		require.NoError(t, err)
		assert.Equal(t, []string{model.NoOrgMemberUsername}, names)
		ids, err := orgMemberIds(ctxOf(""), 7, orgAuthorityDepartmentAdmin)
		require.NoError(t, err)
		assert.Equal(t, []int{model.NoOrgMemberId}, ids)
	})
}
