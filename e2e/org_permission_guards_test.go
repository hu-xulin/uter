package e2e

import (
	"encoding/json"
	"net/http"
	"strconv"
	"testing"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 本文件补齐 org_permissions_e2e_test.go 未覆盖的三条高危权限路径：
//  1. 组织审计日志端点的角色权限矩阵 + 组织/部门范围收敛 + 超管记录过滤；
//  2. owner 正向转移：负责人指针同步、旧 owner 降级、新 owner 会话吊销；
//  3. 组织日志/统计端点对普通成员与跨租户的拒绝。
//
// 所有用例复用 orgPlatformEnv 真实网关夹具，断言同时覆盖中间件层拒绝
// （401/403）与业务层拒绝（200 + success:false）。

// seedOrgAuditLogs 直接写入审计日志行，避免依赖具体业务操作产生日志。
// request_id 作为每条记录的唯一句柄，便于按单条记录精确断言可见性。
func seedOrgAuditLogs(t *testing.T, env *orgPlatformEnv) map[string]string {
	t.Helper()
	entries := []struct {
		handle    string
		username  string
		userId    int
		actorRole int
	}{
		{"req-owner", "owner", env.uid("owner"), common.RoleCommonUser},
		{"req-admin", "admin", env.uid("admin"), common.RoleCommonUser},
		{"req-deptadmin", "deptadmin", env.uid("deptadmin"), common.RoleCommonUser},
		{"req-m1", "m1", env.uid("m1"), common.RoleCommonUser},
		{"req-m2", "m2", env.uid("m2"), common.RoleCommonUser},
		// 超管代 m2 操作：username 在可见集合内，但 actor_role=root，
		// 必须被 GetAuditLogs 的 viewerRole 闸门过滤掉。
		{"req-m2-root", "m2", env.uid("m2"), common.RoleRootUser},
		// 平台直管用户：不属于本组织，任何组织角色都不得看到。
		{"req-outsider", "outsider", env.uid("outsider"), common.RoleCommonUser},
	}
	for i, entry := range entries {
		record := model.AuditLog{
			EventId:   "org-audit-guard-" + strconv.Itoa(i),
			UserId:    entry.userId,
			Username:  entry.username,
			ActorRole: entry.actorRole,
			Category:  model.AuditCategoryOperation,
			Action:    "test-guard-action",
			RequestId: entry.handle,
			CreatedAt: int64(1700000000 + i),
			Success:   true,
		}
		require.NoError(t, model.LOG_DB.Create(&record).Error)
	}
	return map[string]string{
		"owner": "req-owner", "admin": "req-admin", "deptadmin": "req-deptadmin",
		"m1": "req-m1", "m2": "req-m2", "m2_root": "req-m2-root", "outsider": "req-outsider",
	}
}

// auditTotal 以 request_id 精确查询一条审计日志，返回命中数量。
func auditTotal(t *testing.T, env *orgPlatformEnv, actor, requestId string) int {
	t.Helper()
	path := "/api/organization/" + strconv.Itoa(env.orgId()) + "/audit?page=1&page_size=100&request_id=" + requestId
	recorder := env.call(t, http.MethodGet, path, actor, "")
	requireOK(t, recorder)
	var payload struct {
		Data struct {
			Total int `json:"total"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &payload), recorder.Body.String())
	return payload.Data.Total
}

// TestOrgAuditLogPermissionMatrix 组织审计日志端点的角色权限矩阵。
func TestOrgAuditLogPermissionMatrix(t *testing.T) {
	env := newOrgPlatformEnv(t)
	env.seedOrganization(t)
	seedOrgAuditLogs(t, env)

	auditPath := "/api/organization/" + strconv.Itoa(env.orgId()) + "/audit?page=1&page_size=10"
	for _, actor := range []string{"root", "owner", "admin", "deptadmin"} {
		t.Run(actor+"可审计", func(t *testing.T) {
			requireOK(t, env.call(t, http.MethodGet, auditPath, actor, ""))
		})
	}
	for _, actor := range []string{"m1", "m2", "outsider"} {
		t.Run(actor+"不得审计本组织", func(t *testing.T) {
			requireDenied(t, env.call(t, http.MethodGet, auditPath, actor, ""))
		})
	}
	t.Run("匿名不得审计", func(t *testing.T) {
		assert.Equal(t, http.StatusUnauthorized,
			env.call(t, http.MethodGet, auditPath, "", "").Code)
	})
	t.Run("跨租户不得审计", func(t *testing.T) {
		for _, actor := range []string{"owner", "admin", "deptadmin"} {
			path := "/api/organization/" + strconv.Itoa(env.orgB.Id) + "/audit?page=1&page_size=10"
			requireDenied(t, env.call(t, http.MethodGet, path, actor, ""), actor)
		}
		requireOK(t, env.call(t, http.MethodGet,
			"/api/organization/"+strconv.Itoa(env.orgB.Id)+"/audit?page=1&page_size=10", "root", ""))
	})
}

// TestOrgAuditLogScopeIsolation 审计日志按组织/部门可见性收敛：
// 组织管理员看不到所有者，部门管理员只看本部门且看不到组织级角色，
// 超管 actor 的记录与组织外用户的记录对任何组织角色都不可见。
func TestOrgAuditLogScopeIsolation(t *testing.T) {
	env := newOrgPlatformEnv(t)
	env.seedOrganization(t)
	h := seedOrgAuditLogs(t, env)

	t.Run("owner看到组织全部成员但看不到超管操作与组织外用户", func(t *testing.T) {
		for _, key := range []string{"owner", "admin", "deptadmin", "m1", "m2"} {
			assert.Equal(t, 1, auditTotal(t, env, "owner", h[key]), key)
		}
		assert.Zero(t, auditTotal(t, env, "owner", h["m2_root"]), "超管代操作记录不得对组织角色可见")
		assert.Zero(t, auditTotal(t, env, "owner", h["outsider"]), "组织外用户记录不得可见")
	})
	t.Run("组织管理员看不到所有者", func(t *testing.T) {
		assert.Zero(t, auditTotal(t, env, "admin", h["owner"]))
		assert.Equal(t, 1, auditTotal(t, env, "admin", h["m1"]))
		assert.Equal(t, 1, auditTotal(t, env, "admin", h["m2"]))
	})
	t.Run("部门管理员只看本部门且看不到组织级角色", func(t *testing.T) {
		// deptadmin 与 m1 同属销售部；owner/admin 属组织级角色，m2 在研发部。
		assert.Equal(t, 1, auditTotal(t, env, "deptadmin", h["deptadmin"]))
		assert.Equal(t, 1, auditTotal(t, env, "deptadmin", h["m1"]))
		assert.Zero(t, auditTotal(t, env, "deptadmin", h["owner"]))
		assert.Zero(t, auditTotal(t, env, "deptadmin", h["admin"]))
		assert.Zero(t, auditTotal(t, env, "deptadmin", h["m2"]))
	})
	t.Run("user_id过滤与可见范围取交集", func(t *testing.T) {
		// 越权 user_id 只能得到空集，不得把过滤条件替换掉组织范围。
		path := "/api/organization/" + strconv.Itoa(env.orgId()) +
			"/audit?page=1&page_size=10&user_id=" + strconv.Itoa(env.uid("outsider")) +
			"&request_id=" + h["outsider"]
		requireOK(t, env.call(t, http.MethodGet, path, "owner", ""))
		recorder := env.call(t, http.MethodGet, path, "owner", "")
		var payload struct {
			Data struct {
				Total int `json:"total"`
			} `json:"data"`
		}
		require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &payload))
		assert.Zero(t, payload.Data.Total)
	})
}

// TestOrgOwnerTransferSyncsPointerAndRevokesSession 钉住 owner 正向转移：
// 只写 users.org_role 会留下悬空指针，必须同步 organizations.owner_user_id，
// 旧 owner 降级为 admin，新 owner 的全部客户端会话被吊销。
func TestOrgOwnerTransferSyncsPointerAndRevokesSession(t *testing.T) {
	env := newOrgPlatformEnv(t)
	env.seedOrganization(t)
	orgPath := "/api/organization/" + strconv.Itoa(env.orgId())
	memberPath := orgPath + "/members/" + strconv.Itoa(env.uid("admin"))

	// owner 把 admin 提升为 owner（当前 owner 的合法操作）。
	requireOK(t, env.call(t, http.MethodPut, memberPath, "owner", `{"org_role":"owner"}`))

	require.Equal(t, env.uid("admin"), env.reloadOrg(t, env.orgId()).OwnerUserId,
		"负责人指针必须同步到新 owner")
	require.Equal(t, model.OrgRoleOwner, env.reloadUser(t, "admin").OrgRole)
	require.Equal(t, model.OrgRoleAdmin, env.reloadUser(t, "owner").OrgRole,
		"旧 owner 必须降级，避免组织内出现双 owner")

	// 新 owner 的旧会话必须已被吊销。
	recorder := env.call(t, http.MethodGet, orgPath+"/self", "admin", "")
	assert.NotEqual(t, http.StatusOK, recorder.Code,
		"新 owner 的旧会话必须失效，需重新登录")

	// 重新登录后新 owner 可正常管理组织。
	env.login(t, "admin")
	requireOK(t, env.call(t, http.MethodPut, orgPath, "admin", `{"name":"新负责人改名"}`))
	assert.Equal(t, "新负责人改名", env.reloadOrg(t, env.orgId()).Name)

	// 旧 owner（现为 admin）不得再改组织元数据。
	env.login(t, "owner")
	before := env.reloadOrg(t, env.orgId()).Name
	requireDenied(t, env.call(t, http.MethodPut, orgPath, "owner", `{"name":"旧负责人越权改名"}`))
	assert.Equal(t, before, env.reloadOrg(t, env.orgId()).Name)
}

// TestOrgLogEndpointsRejectNonManagers 组织日志/统计端点只允许组织管理者与超管，
// 普通成员与跨租户访问必须被拒绝。
func TestOrgLogEndpointsRejectNonManagers(t *testing.T) {
	env := newOrgPlatformEnv(t)
	env.seedOrganization(t)

	endpoints := []string{
		"/logs", "/logs/stat", "/quota-dates", "/quota-dates/users",
		"/flow", "/tasks", "/drawings", "/audit",
	}
	for _, suffix := range endpoints {
		path := "/api/organization/" + strconv.Itoa(env.orgId()) + suffix + "?page=1&page_size=10"
		for _, actor := range []string{"m1", "m2", "outsider"} {
			t.Run(actor+suffix+"被拒", func(t *testing.T) {
				requireDenied(t, env.call(t, http.MethodGet, path, actor, ""))
			})
		}
	}
}
