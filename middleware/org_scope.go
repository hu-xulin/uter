package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/i18n"
	"github.com/uter-ai/uter/model"
)

// OrgDataScope 描述一次「组织范围查询」的可见边界，是组织内数据隔离的唯一表达。
//
//   - OrgID == 0            ：调用者是超管或平台管理员，不做组织过滤（可见全量）。
//   - OrgID > 0             ：调用者属于某组织，只可见该组织的成员数据。
//   - Department != ""      ：进一步只可见该部门的成员数据（部门管理员）。
//   - NoDepartment == true  ：调用者是部门管理员但没有被分配部门。此时**没有任何可见数据**，
//     必须 fail-closed —— 退化成「看整个组织」等于让部门管理员越权看到全公司数据。
//
// 部门判定一律使用部门**名称**：users.department_id 列已废弃且从不写入，
// 曾经按 department_id 过滤的实现会让部门管理员实际看到整个组织。
type OrgDataScope struct {
	OrgID        int
	Department   string
	NoDepartment bool
}

// IsPlatformScope 表示调用者不受组织边界约束（超管/平台管理员）。
func (s OrgDataScope) IsPlatformScope() bool { return s.OrgID == 0 }

// DepartmentFilter 返回用于部门过滤的取值。NoDepartment 时返回不可能匹配的哨兵，
// 保证「未分配部门的部门管理员」看到的是空集，而不是整个组织。
func (s OrgDataScope) DepartmentFilter() string {
	if s.NoDepartment {
		return model.NoDepartmentFilter
	}
	return s.Department
}

// RequestOrgScope 解析当前请求的组织/部门数据范围。
func RequestOrgScope(c *gin.Context) OrgDataScope {
	if c.GetInt("role") >= common.RoleRootUser {
		return OrgDataScope{}
	}
	orgId := c.GetInt("organization_id")
	if orgId == 0 {
		return OrgDataScope{}
	}
	if c.GetString("org_role") != model.OrgRoleDepartmentAdmin {
		return OrgDataScope{OrgID: orgId}
	}
	department := c.GetString("department_name")
	if department == "" {
		// 未分配部门的部门管理员：无可见数据（fail-closed）。
		return OrgDataScope{OrgID: orgId, NoDepartment: true}
	}
	return OrgDataScope{OrgID: orgId, Department: department}
}

// Usernames 返回该范围内可见成员的用户名，供日志/统计查询做过滤。
//
//	平台视角       -> nil（调用方据此不施加过滤）
//	组织/部门范围  -> 范围内的用户名列表
//
// 范围为空时返回 model.NoOrgMemberUsername 哨兵：这些查询把「空列表」解释为
// 「不施加过滤」，直接传空列表会让范围查询退化成看全站。
func (s OrgDataScope) Usernames() ([]string, error) {
	if s.OrgID == 0 {
		return nil, nil
	}
	// NoDepartment（部门管理员未分配部门）没有任何可见数据，必须直接返回空集哨兵。
	// 若落到下面的 `s.Department == ""` 分支会退化成「整个组织」——正是 NoDepartment
	// 要防的越权，与 DepartmentFilter() 的 fail-closed 语义保持一致。
	if s.NoDepartment {
		return []string{model.NoOrgMemberUsername}, nil
	}
	var (
		names []string
		err   error
	)
	if s.Department == "" {
		names, err = model.GetOrgMemberUsernames(s.OrgID)
	} else {
		names, err = model.GetOrgMemberUsernamesInDepartment(s.OrgID, s.Department)
	}
	if err != nil {
		return nil, err
	}
	if len(names) == 0 {
		return []string{model.NoOrgMemberUsername}, nil
	}
	return names, nil
}

// UserIDs 返回该范围内可见成员的 user id，供以 user_id 为过滤维度的查询
// （任务日志等）使用。语义与 Usernames 完全一致：平台视角返回 nil，范围为空时
// 返回 model.NoOrgMemberId 哨兵以避免「空列表 = 不过滤」的静默越权。
func (s OrgDataScope) UserIDs() ([]int, error) {
	if s.OrgID == 0 {
		return nil, nil
	}
	// 同 Usernames：NoDepartment 必须 fail-closed 返回哨兵，不得退化成整个组织。
	if s.NoDepartment {
		return []int{model.NoOrgMemberId}, nil
	}
	var (
		ids []int
		err error
	)
	if s.Department == "" {
		ids, err = model.GetOrgMemberIds(s.OrgID)
	} else {
		ids, err = model.GetOrgMemberIdsInDepartment(s.OrgID, s.Department)
	}
	if err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return []int{model.NoOrgMemberId}, nil
	}
	return ids, nil
}

// OrgAdminAuth 组织范围管理员鉴权。
//
// 设计要点（安全性）：组织归属与系统角色（common.Role*）正交。公司负责人/组织管理员
// 只是「属于某组织且 org_role 为 owner/admin/department_admin」的普通用户（role 仍为
// common.RoleCommonUser），【不会】被晋升为全局 Admin。这样他们只能访问组织范围接口，
// 无法触及平台级 Admin 接口（如删除任意用户、渠道管理）。
//
// 放行条件：
//   - 超级管理员（role >= RoleRootUser）：可视化所有组织；
//   - 否则必须 organization_id > 0 且 org_role ∈ {owner, admin, department_admin}。
//
// 平台级管理员（organization_id == 0）不属于任何组织，会被拒绝——他们应使用全局
// Admin 接口而非组织接口。
func OrgAdminAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		if _, started := c.Get(accessTokenAuditContextKey); !started {
			defer finishAccessTokenAudit(c)
		}
		user, identity, useAccessToken, err := authenticateDashboardRequest(c)
		if err != nil {
			writeDashboardAuthError(c, err)
			return
		}
		if user.Status != common.UserStatusEnabled {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"success": false, "code": "AUTH_USER_DISABLED", "message": common.TranslateMessage(c, i18n.MsgAuthUserBanned)})
			return
		}
		if !validUserInfo(user.Username, user.Role) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"success": false, "code": "AUTH_USER_INVALID", "message": common.TranslateMessage(c, i18n.MsgAuthUserInfoInvalid)})
			return
		}
		// 超管放行（可视化所有组织）。
		if user.Role >= common.RoleRootUser {
			setDashboardAuthContext(c, user, identity, useAccessToken)
			auditWriter := beginAdminAudit(c)
			c.Next()
			finishAdminAudit(c, auditWriter)
			return
		}
		// 非超管：必须是某组织的 owner/admin/department_admin。
		if user.OrganizationId == 0 {
			abortOrgForbidden(c)
			return
		}
		switch user.OrgRole {
		case model.OrgRoleOwner, model.OrgRoleAdmin, model.OrgRoleDepartmentAdmin:
			setDashboardAuthContext(c, user, identity, useAccessToken)
			// 组织写操作审计兜底：组织 owner / org admin / 部门管理员的
			// 纳新、改角色、改子额度、踢人、改组织信息等敏感写操作此前完全无审计
			// 留痕，这里与 AdminAuth/RootAuth 一致地包裹写方法（对应审计项 P2-1）。
			auditWriter := beginAdminAudit(c)
			c.Next()
			finishAdminAudit(c, auditWriter)
			return
		default:
			abortOrgForbidden(c)
			return
		}
	}
}

func abortOrgForbidden(c *gin.Context) {
	c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
		"success": false,
		"code":    "AUTH_ORG_FORBIDDEN",
		"message": common.TranslateMessage(c, i18n.MsgUserNoPermissionHigherLevel),
	})
}
