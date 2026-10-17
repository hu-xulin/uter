package controller

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"gorm.io/gorm"
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
			name:       "stale owner role does not override the owner pointer",
			callerRole: common.RoleCommonUser, callerUserId: 101, callerOrgId: 7, callerOrgRole: model.OrgRoleOwner,
			org: org, want: orgAuthorityNone,
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


func TestCanViewOrganizationBudget(t *testing.T) {
	org := &model.Organization{Id: 7, OwnerUserId: 100}
	tests := []struct {
		name          string
		systemRole    int
		userID        int
		orgID         int
		orgRole       string
		wantAuthority orgAuthority
		want          bool
	}{
		{name: "current owner can view", systemRole: common.RoleCommonUser, userID: 100, orgID: 7, orgRole: model.OrgRoleOwner, wantAuthority: orgAuthorityOrgManager, want: true},
		{name: "organization admin can view", systemRole: common.RoleCommonUser, userID: 101, orgID: 7, orgRole: model.OrgRoleAdmin, wantAuthority: orgAuthorityOrgAdmin, want: true},
		{name: "department admin cannot view aggregate budget", systemRole: common.RoleCommonUser, userID: 102, orgID: 7, orgRole: model.OrgRoleDepartmentAdmin, wantAuthority: orgAuthorityDepartmentAdmin, want: false},
		{name: "member cannot view aggregate budget", systemRole: common.RoleCommonUser, userID: 103, orgID: 7, orgRole: model.OrgRoleMember, wantAuthority: orgAuthorityNone, want: false},
		{name: "stale owner role cannot view after transfer", systemRole: common.RoleCommonUser, userID: 101, orgID: 7, orgRole: model.OrgRoleOwner, wantAuthority: orgAuthorityNone, want: false},
		{name: "platform root can view", systemRole: common.RoleRootUser, userID: 1, orgID: 0, orgRole: model.OrgRoleMember, wantAuthority: orgAuthorityOrgManager, want: true},
		{name: "platform admin without org authority cannot view", systemRole: common.RoleAdminUser, userID: 300, orgID: 0, orgRole: model.OrgRoleMember, wantAuthority: orgAuthorityNone, want: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			authority := orgAuthorityOf(tc.systemRole, tc.userID, tc.orgID, tc.orgRole, org)
			if authority != tc.wantAuthority {
				t.Fatalf("orgAuthorityOf(...) = %v, want %v", authority, tc.wantAuthority)
			}
			if got := canViewOrganizationBudget(authority); got != tc.want {
				t.Fatalf("canViewOrganizationBudget(%v) = %t, want %t", authority, got, tc.want)
			}
		})
	}
}

func TestEffectiveMyOrganizationRole(t *testing.T) {
	tests := []struct {
		name        string
		systemRole  int
		userID      int
		ownerUserID int
		orgRole     string
		want        string
	}{
		{name: "current owner is preserved", systemRole: common.RoleCommonUser, userID: 100, ownerUserID: 100, orgRole: model.OrgRoleOwner, want: model.OrgRoleOwner},
		{name: "stale owner is downgraded for presentation", systemRole: common.RoleCommonUser, userID: 101, ownerUserID: 100, orgRole: model.OrgRoleOwner, want: model.OrgRoleMember},
		{name: "legacy empty role follows authoritative owner pointer", systemRole: common.RoleCommonUser, userID: 100, ownerUserID: 100, orgRole: "", want: model.OrgRoleOwner},
		{name: "explicit member role is not overridden by pointer", systemRole: common.RoleCommonUser, userID: 100, ownerUserID: 100, orgRole: model.OrgRoleMember, want: model.OrgRoleMember},
		{name: "department role is preserved", systemRole: common.RoleCommonUser, userID: 102, ownerUserID: 100, orgRole: model.OrgRoleDepartmentAdmin, want: model.OrgRoleDepartmentAdmin},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := effectiveMyOrganizationRole(tc.systemRole, tc.userID, tc.ownerUserID, tc.orgRole); got != tc.want {
				t.Fatalf("effectiveMyOrganizationRole(...) = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestRedactOrganizationBudget(t *testing.T) {
	org := &model.Organization{Quota: 100000, UsedQuota: 25000}
	redactOrganizationBudget(org)
	if org.Quota != 0 || org.UsedQuota != 0 {
		t.Fatalf("budget must be redacted, got quota=%d used_quota=%d", org.Quota, org.UsedQuota)
	}
}


func TestOrgAdminMayAssignRole(t *testing.T) {
	tests := []struct {
		role string
		want bool
	}{
		{role: "", want: true},
		{role: model.OrgRoleMember, want: true},
		{role: model.OrgRoleDepartmentAdmin, want: true},
		{role: model.OrgRoleAdmin, want: false},
		{role: model.OrgRoleOwner, want: false},
	}
	for _, tc := range tests {
		t.Run(tc.role, func(t *testing.T) {
			if got := orgAdminMayAssignRole(tc.role); got != tc.want {
				t.Fatalf("orgAdminMayAssignRole(%q) = %t, want %t", tc.role, got, tc.want)
			}
		})
	}
}


func TestOrganizationMemberWriteQueryRejectsFormerOwner(t *testing.T) {
	previousDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&model.Organization{}, &model.User{}))
	model.DB = db
	t.Cleanup(func() {
		model.DB = previousDB
		_ = sqlDB.Close()
	})

	org := model.Organization{Id: 7, Name: "org", OwnerUserId: 100, Status: model.OrgStatusEnabled}
	require.NoError(t, db.Create(&org).Error)
	owner := model.User{
		Id: 100, Username: "owner", Password: "test-password",
		Role: common.RoleCommonUser, Status: common.UserStatusEnabled,
		OrganizationId: 7, OrgRole: model.OrgRoleOwner, AffCode: "orgown",
	}
	require.NoError(t, db.Create(&owner).Error)
	target := model.User{
		Id: 101, Username: "target", Password: "test-password",
		Role: common.RoleCommonUser, Status: common.UserStatusEnabled,
		OrganizationId: 7, OrgRole: model.OrgRoleMember,
	}
	require.NoError(t, db.Create(&target).Error)

	previousGinMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(previousGinMode) })
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("id", 100)

	rowsAffected, err := updateOrganizationMemberFields(ctx, 7, 101, orgAuthorityOrgManager, map[string]any{"sub_quota_limit": int64(10)}, false)
	require.NoError(t, err)
	require.Equal(t, int64(1), rowsAffected)

	// Ownership transfers after the request's authorization preflight. The old
	// owner must not be able to finish a stale management write.
	require.NoError(t, db.Model(&model.Organization{}).Where("id = ?", 7).
		Update("owner_user_id", 101).Error)
	rowsAffected, err = updateOrganizationMemberFields(ctx, 7, 101, orgAuthorityOrgManager, map[string]any{"sub_quota_limit": int64(20)}, false)
	require.ErrorIs(t, err, model.ErrOrgOwnerChanged)
	require.Zero(t, rowsAffected)

	// The pointer may still match after a direct role demotion; the owner role
	// must also be revalidated by the SQL write guard.
	require.NoError(t, db.Model(&model.Organization{}).Where("id = ?", 7).
		Update("owner_user_id", 100).Error)
	require.NoError(t, db.Model(&model.User{}).Where("id = ?", 100).
		Update("org_role", model.OrgRoleAdmin).Error)
	rowsAffected, err = updateOrganizationMemberFields(ctx, 7, 101, orgAuthorityOrgManager, map[string]any{"sub_quota_limit": int64(30)}, false)
	require.ErrorIs(t, err, model.ErrOrgOwnerChanged)
	require.Zero(t, rowsAffected)

	// Platform root bypasses organization-specific owner checks by design.
	ctx.Set("role", common.RoleRootUser)
	rowsAffected, err = updateOrganizationMemberFields(ctx, 7, 101, orgAuthorityOrgManager, map[string]any{"sub_quota_limit": int64(40)}, false)
	require.NoError(t, err)
	require.Equal(t, int64(1), rowsAffected)

	var saved model.User
	require.NoError(t, db.Where("id = ?", 101).First(&saved).Error)
	require.Equal(t, int64(40), saved.SubQuotaLimit)
}


func TestPrepareOrganizationMemberBatch(t *testing.T) {
	items := []model.OrgMemberAdd{
		{UserId: 0},
		{UserId: 12, DepartmentName: "R&D"},
		{UserId: 12, DepartmentName: "Sales"},
		{UserId: 13},
	}
	candidates, indexes, results := prepareOrganizationMemberBatch(items)
	require.Equal(t, []model.OrgMemberAdd{items[1], items[3]}, candidates)
	require.Equal(t, []int{1, 3}, indexes)
	require.Equal(t, "invalid_user_id", results[0].Reason)
	require.Equal(t, "duplicate_user_id", results[2].Reason)
	require.False(t, results[0].Success)
	require.False(t, results[2].Success)
}
