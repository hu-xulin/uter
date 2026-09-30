package controller

import (
	"testing"

	"github.com/Uter-AI/Uter/common"

	"github.com/Uter-AI/Uter/model"
)

// orgAuthorityOf 是组织接口的唯一授权判据。这些用例钉住需求里的七类角色边界，
// 尤其是两条曾经被突破的越权路径：
//
//  1. 部门管理员被当作「组织管理员」放行 → 可给自己/他人改 org_role=owner 自升权，
//     并可增删全组织成员；
//  2. 组织归属漂移（owner_user_id 与 org_role 不一致）时，靠指针就拿到全权。
func TestOrgAuthorityOf(t *testing.T) {
	org := &model.Organization{Id: 7, OwnerUserId: 100}

	cases := []struct {
		name          string
		callerRole    int
		callerUserId  int
		callerOrgId   int
		callerOrgRole string
		org           *model.Organization
		want          orgAuthority
	}{
		{
			name:       "root manages any organization",
			callerRole: common.RoleRootUser, callerUserId: 1, callerOrgId: 0,
			org: org, want: orgAuthorityOrgManager,
		},
		{
			name:       "organization owner manages own organization",
			callerRole: common.RoleCommonUser, callerUserId: 100, callerOrgId: 7, callerOrgRole: model.OrgRoleOwner,
			org: org, want: orgAuthorityOrgManager,
		},
		{
			name:       "organization admin manages own organization",
			callerRole: common.RoleCommonUser, callerUserId: 101, callerOrgId: 7, callerOrgRole: model.OrgRoleAdmin,
			org: org, want: orgAuthorityOrgAdmin,
		},
		{
			name:       "department admin is limited to own department",
			callerRole: common.RoleCommonUser, callerUserId: 102, callerOrgId: 7, callerOrgRole: model.OrgRoleDepartmentAdmin,
			org: org, want: orgAuthorityDepartmentAdmin,
		},
		{
			name:       "plain member has no authority",
			callerRole: common.RoleCommonUser, callerUserId: 103, callerOrgId: 7, callerOrgRole: model.OrgRoleMember,
			org: org, want: orgAuthorityNone,
		},
		{
			name:       "member of another organization is rejected",
			callerRole: common.RoleCommonUser, callerUserId: 200, callerOrgId: 9, callerOrgRole: model.OrgRoleOwner,
			org: org, want: orgAuthorityNone,
		},
		{
			name:       "platform admin without an organization is rejected",
			callerRole: common.RoleAdminUser, callerUserId: 300, callerOrgId: 0,
			org: org, want: orgAuthorityNone,
		},
		{
			name:       "owner pointer is honoured only when the role field is empty",
			callerRole: common.RoleCommonUser, callerUserId: 100, callerOrgId: 7, callerOrgRole: "",
			org: org, want: orgAuthorityOrgManager,
		},
		{
			name:       "owner pointer does not override an explicit member role",
			callerRole: common.RoleCommonUser, callerUserId: 100, callerOrgId: 7, callerOrgRole: model.OrgRoleMember,
			org: org, want: orgAuthorityNone,
		},
		{
			name:       "missing organization yields no authority",
			callerRole: common.RoleCommonUser, callerUserId: 100, callerOrgId: 7, callerOrgRole: model.OrgRoleOwner,
			org: nil, want: orgAuthorityNone,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := orgAuthorityOf(c.callerRole, c.callerUserId, c.callerOrgId, c.callerOrgRole, c.org)
			if got != c.want {
				t.Errorf("orgAuthorityOf = %v, want %v", got, c.want)
			}
		})
	}
}

// 只有「组织管理者」级别才允许增删成员 / 改角色；部门管理员必须被挡在这些操作之外。
func TestOrgAuthorityLevelOrdering(t *testing.T) {
	if !(orgAuthorityNone < orgAuthorityDepartmentAdmin &&
		orgAuthorityDepartmentAdmin < orgAuthorityOrgAdmin &&
		orgAuthorityOrgAdmin < orgAuthorityOrgManager) {
		t.Fatal("authority levels must be ordered so that stricter checks cannot be bypassed")
	}
}

// 部门管理员的写权限边界。需求要求部门管理员能设置「本部门」用户的权限与额度，
// 但这不能成为自升权通道：org_role 只允许在 member ⇄ department_admin 之间切换。
func TestDeptAdminMayUpdateMember(t *testing.T) {
	sub := int64(5000)
	cases := []struct {
		name             string
		callerUserId     int
		callerDepartment string
		target           *model.User
		req              orgMemberUpdateRequest
		want             bool
	}{
		{
			name:         "grant department admin inside own department",
			callerUserId: 10, callerDepartment: "R&D",
			target: &model.User{Id: 11, DepartmentName: "R&D"},
			req:    orgMemberUpdateRequest{OrgRole: model.OrgRoleDepartmentAdmin},
			want:   true,
		},
		{
			name:         "revoke department admin inside own department",
			callerUserId: 10, callerDepartment: "R&D",
			target: &model.User{Id: 11, DepartmentName: "R&D", OrgRole: model.OrgRoleDepartmentAdmin},
			req:    orgMemberUpdateRequest{OrgRole: model.OrgRoleMember},
			want:   true,
		},
		{
			name:         "adjust sub-quota only is allowed",
			callerUserId: 10, callerDepartment: "R&D",
			target: &model.User{Id: 11, DepartmentName: "R&D"},
			req:    orgMemberUpdateRequest{SubQuotaLimit: &sub},
			want:   true,
		},
		{
			name:         "cannot grant organization admin",
			callerUserId: 10, callerDepartment: "R&D",
			target: &model.User{Id: 11, DepartmentName: "R&D"},
			req:    orgMemberUpdateRequest{OrgRole: model.OrgRoleAdmin},
			want:   false,
		},
		{
			name:         "cannot grant owner (self-escalation path)",
			callerUserId: 10, callerDepartment: "R&D",
			target: &model.User{Id: 11, DepartmentName: "R&D"},
			req:    orgMemberUpdateRequest{OrgRole: model.OrgRoleOwner},
			want:   false,
		},
		{
			name:         "cannot touch a member of another department",
			callerUserId: 10, callerDepartment: "R&D",
			target: &model.User{Id: 12, DepartmentName: "Sales"},
			req:    orgMemberUpdateRequest{OrgRole: model.OrgRoleMember},
			want:   false,
		},
		{
			name:         "cannot demote the organization owner even inside own department",
			callerUserId: 10, callerDepartment: "R&D",
			target: &model.User{Id: 13, DepartmentName: "R&D", OrgRole: model.OrgRoleOwner},
			req:    orgMemberUpdateRequest{OrgRole: model.OrgRoleMember},
			want:   false,
		},
		{
			name:         "cannot demote an organization admin inside own department",
			callerUserId: 10, callerDepartment: "R&D",
			target: &model.User{Id: 14, DepartmentName: "R&D", OrgRole: model.OrgRoleAdmin},
			req:    orgMemberUpdateRequest{SubQuotaLimit: &sub},
			want:   false,
		},
		{
			name:         "unassigned department admin writes nothing",
			callerUserId: 10, callerDepartment: "",
			target: &model.User{Id: 11, DepartmentName: "R&D"},
			req:    orgMemberUpdateRequest{OrgRole: model.OrgRoleMember},
			want:   false,
		},
		{
			name:         "cannot change own role",
			callerUserId: 10, callerDepartment: "R&D",
			target: &model.User{Id: 10, DepartmentName: "R&D"},
			req:    orgMemberUpdateRequest{OrgRole: model.OrgRoleMember},
			want:   false,
		},
		{
			name:         "cannot move a member out of the department",
			callerUserId: 10, callerDepartment: "R&D",
			target: &model.User{Id: 11, DepartmentName: "R&D"},
			req:    orgMemberUpdateRequest{DepartmentName: "Sales"},
			want:   false,
		},
		{
			name:         "no-op department echo is tolerated",
			callerUserId: 10, callerDepartment: "R&D",
			target: &model.User{Id: 11, DepartmentName: "R&D"},
			req:    orgMemberUpdateRequest{DepartmentName: "R&D"},
			want:   true,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := deptAdminMayUpdateMember(c.callerUserId, c.callerDepartment, c.target, c.req); got != c.want {
				t.Errorf("deptAdminMayUpdateMember = %v, want %v", got, c.want)
			}
		})
	}
}

// 部分更新语义：改角色不应顺带清零子额度。这钉住 SubQuotaLimit 必须是指针的契约 ——
// 若退回 int64 值类型，反序列化后必为 0，`>= 0` 判据会静默把成员额度改成「不限」。
func TestOrgMemberUpdateRequestPartialSemantics(t *testing.T) {
	roleOnly := []byte(`{"org_role":"admin"}`)
	var req orgMemberUpdateRequest
	if err := common.Unmarshal(roleOnly, &req); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if req.SubQuotaLimit != nil {
		t.Fatalf("omitted sub_quota_limit must stay nil, got %v", *req.SubQuotaLimit)
	}
	if req.OrgRole != model.OrgRoleAdmin {
		t.Fatalf("org_role = %q, want %q", req.OrgRole, model.OrgRoleAdmin)
	}

	explicitZero := []byte(`{"sub_quota_limit":0}`)
	if err := common.Unmarshal(explicitZero, &req); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if req.SubQuotaLimit == nil || *req.SubQuotaLimit != 0 {
		t.Fatal("an explicit 0 must be carried through so it can mean unlimited")
	}
}
