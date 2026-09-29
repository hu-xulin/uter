package middleware

import (
	"testing"

	"github.com/Uter-AI/Uter/common"
	"github.com/Uter-AI/Uter/model"

	"github.com/gin-gonic/gin"
)

// RequestOrgScope is the single choke point that confines an org-scoped admin
// to their own organization. These tests pin the "复用 Admin + 范围过滤" design:
// a company owner is a common user (role=1) belonging to an org, NOT a global
// admin, yet can still be scoped to their org by RequestOrgScope.

func scopeContext(role, orgId, deptId int, orgRole string) *gin.Context {
	c, _ := gin.CreateTestContext(nil)
	c.Set("role", role)
	c.Set("organization_id", orgId)
	c.Set("department_id", deptId)
	c.Set("org_role", orgRole)
	return c
}

func TestRequestOrgScope(t *testing.T) {
	cases := []struct {
		name     string
		role     int
		orgId    int
		deptId   int
		orgRole  string
		wantOrg  int
		wantDept int
	}{
		{"root sees everything (no filter)", common.RoleRootUser, 7, 3, model.OrgRoleOwner, 0, 0},
		{"platform admin (no org) sees everything", common.RoleAdminUser, 0, 0, "", 0, 0},
		{"org owner confined to own org", common.RoleCommonUser, 7, 0, model.OrgRoleOwner, 7, 0},
		{"org admin confined to own org", common.RoleAdminUser, 7, 0, model.OrgRoleAdmin, 7, 0},
		{"department admin further confined to dept", common.RoleCommonUser, 7, 3, model.OrgRoleDepartmentAdmin, 7, 3},
		{"plain member of an org gets own org scope", common.RoleCommonUser, 9, 0, model.OrgRoleMember, 9, 0},
		{"common user with no org has no scope", common.RoleCommonUser, 0, 0, "", 0, 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			ctx := scopeContext(c.role, c.orgId, c.deptId, c.orgRole)
			org, dept := RequestOrgScope(ctx)
			if org != c.wantOrg || dept != c.wantDept {
				t.Errorf("RequestOrgScope = (%d,%d), want (%d,%d)", org, dept, c.wantOrg, c.wantDept)
			}
		})
	}
}
