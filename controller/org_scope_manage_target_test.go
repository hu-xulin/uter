/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
package controller

import (
	"testing"

	"github.com/uter-ai/uter/model"

	"github.com/gin-gonic/gin"
)

// targetWithinOrgScope 是「平台管理员 vs 组织范围管理员」的组织/部门边界判定，
// 已被 GetUser / DeleteUser / UpdateUser / AdminClearUserBinding / AdminDisable2FA /
// AdminResetPasskey / *OAuthByAdmin 全部收口使用。
//
// 回归动机：这些接口原先只比角色等级、没有组织边界，导致 role>=AdminUser 且
// organization_id>0 的账号可以跨租户读取、修改、删除其他组织的用户。
func TestTargetWithinOrgScope(t *testing.T) {
	ctx := func(role, orgId int, orgRole, dept string) *gin.Context {
		c, _ := gin.CreateTestContext(nil)
		c.Set("role", role)
		c.Set("organization_id", orgId)
		c.Set("org_role", orgRole)
		c.Set("department_name", dept)
		return c
	}
	target := func(orgId int, dept string) *model.User {
		return &model.User{Id: 99, OrganizationId: orgId, DepartmentName: dept}
	}

	cases := []struct {
		name   string
		caller *gin.Context
		target *model.User
		want   bool
	}{
		{
			name:   "platform admin (no org) reaches any target",
			caller: ctx(10, 0, "", ""),
			target: target(6, "别的部门"),
			want:   true,
		},
		{
			name:   "org admin reaches same-org target",
			caller: ctx(10, 5, model.OrgRoleAdmin, "研发"),
			target: target(5, "销售"),
			want:   true,
		},
		{
			name:   "org admin must not reach another org",
			caller: ctx(10, 5, model.OrgRoleAdmin, "研发"),
			target: target(6, "研发"),
			want:   false,
		},
		{
			name:   "department admin reaches own-department target",
			caller: ctx(10, 5, model.OrgRoleDepartmentAdmin, "研发"),
			target: target(5, "研发"),
			want:   true,
		},
		{
			name:   "department admin must not reach sibling department",
			caller: ctx(10, 5, model.OrgRoleDepartmentAdmin, "研发"),
			target: target(5, "销售"),
			want:   false,
		},
		{
			name:   "department admin without a department fails closed",
			caller: ctx(10, 5, model.OrgRoleDepartmentAdmin, ""),
			target: target(5, "研发"),
			want:   false,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := targetWithinOrgScope(c.caller, c.target); got != c.want {
				t.Errorf("targetWithinOrgScope() = %v, want %v", got, c.want)
			}
		})
	}
}
