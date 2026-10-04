package e2e

import (
	"net/http"
	"strconv"
	"testing"

	"github.com/Uter-AI/Uter/model"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// 权限：组织读取
// ---------------------------------------------------------------------------

// TestOrgReadPermissionMatrix 组织详情接口只允许超管与本组织的管理者访问。
func TestOrgReadPermissionMatrix(t *testing.T) {
	env := newOrgPlatformEnv(t)
	env.seedOrganization(t)

	cases := []struct {
		actor string
		want  int
	}{
		{"root", http.StatusOK},
		{"owner", http.StatusOK},
		{"admin", http.StatusOK},
		{"deptadmin", http.StatusOK},
		{"m1", http.StatusForbidden},
		{"outsider", http.StatusForbidden},
	}
	for _, test := range cases {
		t.Run(test.actor, func(t *testing.T) {
			recorder := env.call(t, http.MethodGet, "/api/organization/"+strconv.Itoa(env.orgId()), test.actor, "")
			assert.Equal(t, test.want, recorder.Code, recorder.Body.String())
		})
	}

	// 匿名一律拒绝
	recorder := env.call(t, http.MethodGet, "/api/organization/"+strconv.Itoa(env.orgId()), "", "")
	assert.Equal(t, http.StatusUnauthorized, recorder.Code)
}

// TestOrgCrossTenantIsolation 一家公司的管理者不得读取另一家组织。
func TestOrgCrossTenantIsolation(t *testing.T) {
	env := newOrgPlatformEnv(t)
	env.seedOrganization(t)

	for _, actor := range []string{"owner", "admin", "deptadmin", "m1"} {
		t.Run(actor, func(t *testing.T) {
			recorder := env.call(t, http.MethodGet, "/api/organization/"+strconv.Itoa(env.orgB.Id), actor, "")
			requireDenied(t, recorder)
		})
	}
	// 超管可以跨组织
	recorder := env.call(t, http.MethodGet, "/api/organization/"+strconv.Itoa(env.orgB.Id), "root", "")
	requireOK(t, recorder)
}

// TestOrgCreateAndListAreRootOnly 开通租户与列全量组织仅超管可用。
// 若普通用户可自助建组织（quota=0 即不限量），等于开放一条绕过个人钱包的免费通道。
func TestOrgCreateAndListAreRootOnly(t *testing.T) {
	env := newOrgPlatformEnv(t)
	env.seedOrganization(t)

	for _, actor := range []string{"owner", "admin", "deptadmin", "m1", "outsider"} {
		recorder := env.call(t, http.MethodPost, "/api/organizations", actor, `{"name":"自助组织","quota":0}`)
		assert.Equal(t, http.StatusForbidden, recorder.Code, actor+" "+recorder.Body.String())
		recorder = env.call(t, http.MethodGet, "/api/organizations", actor, "")
		assert.Equal(t, http.StatusForbidden, recorder.Code, actor+" "+recorder.Body.String())
	}
	recorder := env.call(t, http.MethodGet, "/api/organizations", "root", "")
	requireOK(t, recorder)
}

// ---------------------------------------------------------------------------
// 权限：成员可见性
// ---------------------------------------------------------------------------

// TestOrgMemberVisibilityByRole 组织管理员看不到所有者；部门管理员只看本部门，
// 且看不到组织所有者与组织管理员。
func TestOrgMemberVisibilityByRole(t *testing.T) {
	env := newOrgPlatformEnv(t)
	env.seedOrganization(t)

	membersOf := func(actor string) []string {
		t.Helper()
		recorder := env.call(t, http.MethodGet,
			"/api/organization/"+strconv.Itoa(env.orgId())+"/members?page=1&page_size=100", actor, "")
		requireOK(t, recorder)
		var page struct {
			Data struct {
				Items []struct {
					Username string `json:"username"`
					OrgRole  string `json:"org_role"`
				} `json:"items"`
			} `json:"data"`
		}
		require.NoError(t, decodeJSON(recorder.Body.Bytes(), &page))
		names := make([]string, 0, len(page.Data.Items))
		for _, item := range page.Data.Items {
			names = append(names, item.Username)
		}
		return names
	}

	ownerView := membersOf("owner")
	assert.Contains(t, ownerView, "admin")
	assert.Contains(t, ownerView, "m1")
	assert.Contains(t, ownerView, "m2")

	adminView := membersOf("admin")
	assert.NotContains(t, adminView, "owner", "组织管理员不得看到组织所有者")
	assert.Contains(t, adminView, "deptadmin")
	assert.Contains(t, adminView, "m1")

	deptView := membersOf("deptadmin")
	assert.NotContains(t, deptView, "owner")
	assert.NotContains(t, deptView, "admin")
	assert.Contains(t, deptView, "m1", "同部门成员应可见")
	assert.NotContains(t, deptView, "m2", "部门管理员不得跨部门查看")

	// 部门管理员自定义 department 参数不得生效（否则可横向探测其他部门）
	recorder := env.call(t, http.MethodGet,
		"/api/organization/"+strconv.Itoa(env.orgId())+"/members?department=研发部", "deptadmin", "")
	requireOK(t, recorder)
	assert.NotContains(t, recorder.Body.String(), "m2", "部门管理员不得通过查询参数跨部门")
}

// ---------------------------------------------------------------------------
// 权限：成员变更
// ---------------------------------------------------------------------------

// TestOrgMemberMutationAuthority 钉住「改角色」这条最容易自升权的路径。
func TestOrgMemberMutationAuthority(t *testing.T) {
	env := newOrgPlatformEnv(t)
	env.seedOrganization(t)

	orgPath := "/api/organization/" + strconv.Itoa(env.orgId())
	memberPath := func(uid int) string { return orgPath + "/members/" + strconv.Itoa(uid) }

	t.Run("组织管理员不得把自己提为 owner", func(t *testing.T) {
		recorder := env.call(t, http.MethodPut, memberPath(env.uid("admin")), "admin", `{"org_role":"owner"}`)
		requireDenied(t, recorder)
		assert.Equal(t, model.OrgRoleAdmin, env.reloadUser(t, "admin").OrgRole)
	})
	t.Run("组织管理员不得改动所有者", func(t *testing.T) {
		recorder := env.call(t, http.MethodPut, memberPath(env.uid("owner")), "admin", `{"org_role":"member"}`)
		requireDenied(t, recorder)
		assert.Equal(t, model.OrgRoleOwner, env.reloadUser(t, "owner").OrgRole)
	})
	t.Run("组织管理员不得改动同级管理员", func(t *testing.T) {
		extra := env.createUser(t, "admin2", 1)
		recorder := env.call(t, http.MethodPost, orgPath+"/members", "root",
			`{"members":[{"user_id":`+strconv.Itoa(extra.Id)+`,"department_name":"总办"}]}`)
		requireOK(t, recorder)
		recorder = env.call(t, http.MethodPut, memberPath(extra.Id), "root", `{"org_role":"admin"}`)
		requireOK(t, recorder)

		recorder = env.call(t, http.MethodPut, memberPath(extra.Id), "admin", `{"org_role":"member"}`)
		requireDenied(t, recorder)
		assert.Equal(t, model.OrgRoleAdmin, env.reloadUser(t, "admin2").OrgRole)
	})
	t.Run("部门管理员不得改自己的角色", func(t *testing.T) {
		recorder := env.call(t, http.MethodPut, memberPath(env.uid("deptadmin")), "deptadmin", `{"org_role":"admin"}`)
		requireDenied(t, recorder)
		assert.Equal(t, model.OrgRoleDepartmentAdmin, env.reloadUser(t, "deptadmin").OrgRole)
	})
	t.Run("部门管理员可在本部门内授予 department_admin", func(t *testing.T) {
		recorder := env.call(t, http.MethodPut, memberPath(env.uid("m1")), "deptadmin", `{"org_role":"department_admin"}`)
		requireOK(t, recorder)
		assert.Equal(t, model.OrgRoleDepartmentAdmin, env.reloadUser(t, "m1").OrgRole)
		// 还原，避免影响后续子用例
		recorder = env.call(t, http.MethodPut, memberPath(env.uid("m1")), "owner", `{"org_role":"member"}`)
		requireOK(t, recorder)
	})
	t.Run("部门管理员不得跨部门改角色", func(t *testing.T) {
		recorder := env.call(t, http.MethodPut, memberPath(env.uid("m2")), "deptadmin", `{"org_role":"department_admin"}`)
		requireDenied(t, recorder)
		assert.Equal(t, model.OrgRoleMember, env.reloadUser(t, "m2").OrgRole)
	})
	t.Run("部门管理员不得授予组织级角色", func(t *testing.T) {
		recorder := env.call(t, http.MethodPut, memberPath(env.uid("m1")), "deptadmin", `{"org_role":"admin"}`)
		requireDenied(t, recorder)
	})
	t.Run("普通成员不得改任何人", func(t *testing.T) {
		recorder := env.call(t, http.MethodPut, memberPath(env.uid("m2")), "m1", `{"org_role":"owner"}`)
		requireDenied(t, recorder)
	})
	t.Run("组织所有者可调整管理员角色", func(t *testing.T) {
		recorder := env.call(t, http.MethodPut, memberPath(env.uid("admin")), "owner", `{"org_role":"member"}`)
		requireOK(t, recorder)
		assert.Equal(t, model.OrgRoleMember, env.reloadUser(t, "admin").OrgRole)
		recorder = env.call(t, http.MethodPut, memberPath(env.uid("admin")), "owner", `{"org_role":"admin"}`)
		requireOK(t, recorder)
	})
}

// TestOrgRemoveMemberAuthority 移出成员：部门管理员无权增删；组织管理员不得移除所有者/同级。
func TestOrgRemoveMemberAuthority(t *testing.T) {
	env := newOrgPlatformEnv(t)
	env.seedOrganization(t)
	orgPath := "/api/organization/" + strconv.Itoa(env.orgId())

	recorder := env.call(t, http.MethodDelete, orgPath+"/members/"+strconv.Itoa(env.uid("m1")), "deptadmin", "")
	requireDenied(t, recorder)
	assert.Equal(t, env.orgId(), env.reloadUser(t, "m1").OrganizationId)

	recorder = env.call(t, http.MethodDelete, orgPath+"/members/"+strconv.Itoa(env.uid("owner")), "admin", "")
	requireDenied(t, recorder)
	assert.Equal(t, env.orgId(), env.reloadUser(t, "owner").OrganizationId)

	recorder = env.call(t, http.MethodDelete, orgPath+"/members/"+strconv.Itoa(env.uid("m1")), "m1", "")
	assert.Equal(t, http.StatusForbidden, recorder.Code)

	recorder = env.call(t, http.MethodDelete, orgPath+"/members/"+strconv.Itoa(env.uid("m1")), "owner", "")
	requireOK(t, recorder)
	assert.Equal(t, 0, env.reloadUser(t, "m1").OrganizationId)
	assert.Equal(t, "", env.reloadUser(t, "m1").OrgRole)
}

// TestOrgAddMemberRejectsForeignAndPrivileged 纳新不得跨租户搬迁账号，
// 也不得把平台直管的管理员账号拉进组织。
func TestOrgAddMemberRejectsForeignAndPrivileged(t *testing.T) {
	env := newOrgPlatformEnv(t)
	env.seedOrganization(t)
	orgPath := "/api/organization/" + strconv.Itoa(env.orgId())

	// 已归属本组织的成员：重复加入必须被拒绝，否则会覆写既有角色/额度上限
	recorder := env.call(t, http.MethodPost, orgPath+"/members", "owner",
		`{"members":[{"user_id":`+strconv.Itoa(env.uid("m2"))+`,"department_name":"研发部"}]}`)
	requireDenied(t, recorder)
	assert.Equal(t, model.OrgRoleMember, env.reloadUser(t, "m2").OrgRole)

	// 平台超管账号不得被拉进组织
	recorder = env.call(t, http.MethodPost, orgPath+"/members", "owner",
		`{"members":[{"user_id":`+strconv.Itoa(env.uid("root"))+`}]}`)
	requireDenied(t, recorder)
	assert.Equal(t, 0, env.reloadUser(t, "root").OrganizationId)
}

// ---------------------------------------------------------------------------
// 权限：组织元数据与预算
// ---------------------------------------------------------------------------

// TestOrgUpdateAuthority 预算与状态是平台售出的额度，仅超管可改；
// 公司负责人可改名称与成员上限。
func TestOrgUpdateAuthority(t *testing.T) {
	env := newOrgPlatformEnv(t)
	env.seedOrganization(t)
	orgPath := "/api/organization/" + strconv.Itoa(env.orgId())

	t.Run("公司负责人可改名称", func(t *testing.T) {
		recorder := env.call(t, http.MethodPut, orgPath, "owner", `{"name":"Acme 科技（改名）"}`)
		requireOK(t, recorder)
		assert.Equal(t, "Acme 科技（改名）", env.reloadOrg(t, env.orgId()).Name)
	})
	t.Run("公司负责人不得上调预算", func(t *testing.T) {
		before := env.reloadOrg(t, env.orgId()).Quota
		recorder := env.call(t, http.MethodPut, orgPath, "owner", `{"quota":999999999}`)
		requireDenied(t, recorder)
		assert.Equal(t, before, env.reloadOrg(t, env.orgId()).Quota)
	})
	t.Run("公司负责人不得改状态", func(t *testing.T) {
		recorder := env.call(t, http.MethodPut, orgPath, "owner", `{"status":2}`)
		requireDenied(t, recorder)
		assert.Equal(t, model.OrgStatusEnabled, env.reloadOrg(t, env.orgId()).Status)
	})
	t.Run("非法状态值一律拒绝", func(t *testing.T) {
		recorder := env.call(t, http.MethodPut, orgPath, "root", `{"status":0}`)
		requireDenied(t, recorder)
		assert.Equal(t, model.OrgStatusEnabled, env.reloadOrg(t, env.orgId()).Status)
	})
	t.Run("组织管理员不得改组织", func(t *testing.T) {
		before := env.reloadOrg(t, env.orgId()).Name
		recorder := env.call(t, http.MethodPut, orgPath, "admin", `{"name":"越权改名"}`)
		requireDenied(t, recorder)
		assert.Equal(t, before, env.reloadOrg(t, env.orgId()).Name)
	})
	t.Run("超管可改预算", func(t *testing.T) {
		recorder := env.call(t, http.MethodPut, orgPath, "root", `{"quota":123456}`)
		requireOK(t, recorder)
		assert.Equal(t, int64(123456), env.reloadOrg(t, env.orgId()).Quota)
	})
}

// ---------------------------------------------------------------------------
// 权限：组织身份不得带来平台级权限
// ---------------------------------------------------------------------------

// TestOrgManagerNeverGainsPlatformAdmin 公司负责人/组织管理员只是普通用户，
// 不得触及平台级管理接口。
func TestOrgManagerNeverGainsPlatformAdmin(t *testing.T) {
	env := newOrgPlatformEnv(t)
	env.seedOrganization(t)

	adminEndpoints := []struct{ method, path string }{
		{http.MethodGet, "/api/user/?page=1&page_size=10"},
		{http.MethodGet, "/api/channel/?page=1&page_size=10"},
		{http.MethodGet, "/api/redemption/?page=1&page_size=10"},
		{http.MethodGet, "/api/log/?page=1&page_size=10"},
		{http.MethodGet, "/api/data/?page=1&page_size=10"},
		{http.MethodGet, "/api/task?page=1&page_size=10"},
		{http.MethodGet, "/api/mj/?page=1&page_size=10"},
	}
	for _, endpoint := range adminEndpoints {
		for _, actor := range []string{"owner", "admin", "deptadmin", "m1", "outsider"} {
			recorder := env.call(t, endpoint.method, endpoint.path, actor, "")
			assert.Equal(t, http.StatusForbidden, recorder.Code,
				actor+" "+endpoint.path+" -> "+recorder.Body.String())
		}
	}

	recorder := env.call(t, http.MethodGet, "/api/option/", "owner", "")
	assert.Equal(t, http.StatusForbidden, recorder.Code)
	recorder = env.call(t, http.MethodGet, "/api/organizations", "owner", "")
	assert.Equal(t, http.StatusForbidden, recorder.Code)
}

// TestOrgSelfEndpoint 普通成员看不到组织总预算，只能看到自己被分配的额度。
func TestOrgSelfEndpoint(t *testing.T) {
	env := newOrgPlatformEnv(t)
	env.seedOrganization(t)

	recorder := env.call(t, http.MethodGet, "/api/organization/self", "m1", "")
	requireOK(t, recorder)
	var self struct {
		Data struct {
			Organization *struct {
				Id        int   `json:"id"`
				Quota     int64 `json:"quota"`
				UsedQuota int64 `json:"used_quota"`
			} `json:"organization"`
			Role          string `json:"role"`
			CanViewBudget bool   `json:"can_view_budget"`
		} `json:"data"`
	}
	require.NoError(t, decodeJSON(recorder.Body.Bytes(), &self))
	require.NotNil(t, self.Data.Organization)
	assert.Equal(t, env.orgId(), self.Data.Organization.Id)
	assert.False(t, self.Data.CanViewBudget)
	assert.Zero(t, self.Data.Organization.Quota, "普通成员不得看到组织总预算")
	assert.Zero(t, self.Data.Organization.UsedQuota)

	// 管理者可见预算
	recorder = env.call(t, http.MethodGet, "/api/organization/self", "owner", "")
	requireOK(t, recorder)
	require.NoError(t, decodeJSON(recorder.Body.Bytes(), &self))
	assert.True(t, self.Data.CanViewBudget)

	// 平台直管用户没有组织
	recorder = env.call(t, http.MethodGet, "/api/organization/self", "outsider", "")
	requireOK(t, recorder)
	require.NoError(t, decodeJSON(recorder.Body.Bytes(), &self))
	assert.Nil(t, self.Data.Organization)
}

// ---------------------------------------------------------------------------
// 权限：令牌隔离
// ---------------------------------------------------------------------------

// TestOrgTokenIsolation 组织成员之间不得互相读写对方的 API 令牌；
// 组织管理员也不得通过令牌接口看到成员的令牌。
func TestOrgTokenIsolation(t *testing.T) {
	env := newOrgPlatformEnv(t)
	env.seedOrganization(t)

	env.createToken(t, "m1", "m1-token")

	recorder := env.call(t, http.MethodGet, "/api/token/?page=1&page_size=10", "m1", "")
	requireOK(t, recorder)
	var list struct {
		Data struct {
			Items []struct {
				Id   int    `json:"id"`
				Name string  `json:"name"`
				Key  *string `json:"key"`
			} `json:"items"`
		} `json:"data"`
	}
	require.NoError(t, decodeJSON(recorder.Body.Bytes(), &list))
	require.NotEmpty(t, list.Data.Items)
	tokenId := list.Data.Items[0].Id

	for _, actor := range []string{"m2", "admin", "deptadmin", "owner", "outsider"} {
		t.Run(actor+"不得读取成员令牌", func(t *testing.T) {
			recorder := env.call(t, http.MethodGet, "/api/token/"+strconv.Itoa(tokenId), actor, "")
			requireDenied(t, recorder)
		})
		t.Run(actor+"不得删除成员令牌", func(t *testing.T) {
			recorder := env.call(t, http.MethodDelete, "/api/token/"+strconv.Itoa(tokenId), actor, "")
			requireDenied(t, recorder)
		})
	}
	// 令牌仍然存在
	recorder = env.call(t, http.MethodGet, "/api/token/"+strconv.Itoa(tokenId), "m1", "")
	requireOK(t, recorder)
}
