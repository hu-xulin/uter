package middleware

import (
	"errors"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"

	"github.com/uter-ai/uter/common"

	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/dto"
	"github.com/uter-ai/uter/i18n"
	"github.com/uter-ai/uter/logger"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/relaykit/types"
	"github.com/uter-ai/uter/service"
	"github.com/uter-ai/uter/service/authz"
	"github.com/uter-ai/uter/setting/ratio_setting"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const authIdentityContextKey = "auth_identity"

type dashboardCredentialKind int

const (
	dashboardCredentialUnmatched dashboardCredentialKind = iota
	dashboardCredentialInternal
	dashboardCredentialPAT
)

func validUserInfo(username string, role int) bool {
	// check username is empty
	if strings.TrimSpace(username) == "" {
		return false
	}
	if !common.IsValidateRole(role) {
		return false
	}
	return true
}

func authHelper(c *gin.Context, minRole int) {
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
	if user.Role < minRole {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"success": false, "code": "AUTH_INSUFFICIENT_PRIVILEGE", "message": common.TranslateMessage(c, i18n.MsgAuthInsufficientPrivilege)})
		return
	}
	if !validUserInfo(user.Username, user.Role) {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"success": false, "code": "AUTH_USER_INVALID", "message": common.TranslateMessage(c, i18n.MsgAuthUserInfoInvalid)})
		return
	}
	setDashboardAuthContext(c, user, identity, useAccessToken)

	// 管理/root 写操作审计兜底：内聚在鉴权链路里，保证任何经过 AdminAuth/RootAuth
	// 的写接口都会自动留痕（无需在路由上单独挂审计中间件，避免漏挂）。
	// handler 内手动埋点者会设置 ContextKeyAuditLogged，finishAdminAudit 据此跳过。
	var auditWriter *auditResponseWriter
	if minRole >= common.RoleAdminUser {
		auditWriter = beginAdminAudit(c)
	}

	c.Next()

	finishAdminAudit(c, auditWriter)
}

func TryUserAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		if _, started := c.Get(accessTokenAuditContextKey); !started {
			defer finishAccessTokenAudit(c)
		}
		user, identity, credentialKind, err := classifyDashboardCredential(c)
		if err != nil {
			writeDashboardAuthError(c, err)
			return
		}
		if credentialKind != dashboardCredentialUnmatched {
			setDashboardAuthContext(c, user, identity, credentialKind == dashboardCredentialPAT)
		}
		c.Next()
	}
}

func UserAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		authHelper(c, common.RoleCommonUser)
	}
}

func AdminAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		authHelper(c, common.RoleAdminUser)
	}
}

func RootAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		authHelper(c, common.RoleRootUser)
	}
}

// GetAuthIdentity returns a dashboard session identity. PAT-authenticated
// requests intentionally have no SessionID and cannot manage browser sessions.
func GetAuthIdentity(c *gin.Context) (service.AuthIdentity, bool) {
	value, ok := c.Get(authIdentityContextKey)
	if !ok {
		return service.AuthIdentity{}, false
	}
	identity, ok := value.(service.AuthIdentity)
	return identity, ok
}

// GetSessionAuthIdentity returns only identities backed by a live dashboard
// session. PAT-authenticated requests intentionally fail this check.
func GetSessionAuthIdentity(c *gin.Context) (service.AuthIdentity, bool) {
	identity, ok := GetAuthIdentity(c)
	if !ok {
		identity = service.AuthIdentity{
			UserID:          c.GetInt("id"),
			SessionID:       c.GetString("session_id"),
			UserAuthVersion: c.GetInt64("auth_version"),
			SessionVersion:  c.GetInt64("session_version"),
		}
	}
	if identity.UserID <= 0 || identity.SessionID == "" || identity.UserAuthVersion <= 0 || identity.SessionVersion <= 0 {
		return service.AuthIdentity{}, false
	}
	return identity, true
}

func authenticateDashboardRequest(c *gin.Context) (*model.UserBase, service.AuthIdentity, bool, error) {
	user, identity, credentialKind, err := classifyDashboardCredential(c)
	if err != nil {
		return nil, service.AuthIdentity{}, credentialKind == dashboardCredentialPAT, err
	}
	if credentialKind == dashboardCredentialUnmatched {
		return nil, service.AuthIdentity{}, false, service.ErrAuthTokenInvalid
	}
	return user, identity, credentialKind == dashboardCredentialPAT, nil
}

func classifyDashboardCredential(c *gin.Context) (*model.UserBase, service.AuthIdentity, dashboardCredentialKind, error) {
	raw, ok := authorizationToken(c.GetHeader("Authorization"))
	if !ok {
		return nil, service.AuthIdentity{}, dashboardCredentialUnmatched, nil
	}
	identity, internal, err := service.ParseDashboardAccessToken(raw)
	if internal {
		if err != nil {
			return nil, service.AuthIdentity{}, dashboardCredentialInternal, err
		}
		_, user, err := service.ValidateLoginSession(identity)
		if err != nil {
			return nil, service.AuthIdentity{}, dashboardCredentialInternal, err
		}
		return user, identity, dashboardCredentialInternal, nil
	}
	patUser, err := model.ValidateAccessToken(raw)
	if err != nil {
		return nil, service.AuthIdentity{}, dashboardCredentialPAT, err
	}
	if patUser == nil || patUser.Id <= 0 {
		return nil, service.AuthIdentity{}, dashboardCredentialUnmatched, nil
	}
	beginAccessTokenAudit(c, patUser, raw)
	user, err := model.GetUserCache(patUser.Id)
	if err != nil {
		return nil, service.AuthIdentity{}, dashboardCredentialPAT, err
	}
	return user, service.AuthIdentity{UserID: user.Id, UserAuthVersion: user.AuthVersion}, dashboardCredentialPAT, nil
}

func authorizationToken(header string) (string, bool) {
	header = strings.TrimSpace(header)
	if header == "" {
		return "", false
	}
	parts := strings.Fields(header)
	if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
		header = parts[1]
	} else if len(parts) != 1 {
		return "", false
	}
	return header, header != ""
}

func setDashboardAuthContext(c *gin.Context, user *model.UserBase, identity service.AuthIdentity, useAccessToken bool) {
	c.Header("Auth-Version", "864b7076dbcd0a3c01b5520316720ebf")
	c.Set("username", user.Username)
	c.Set("role", user.Role)
	c.Set("id", user.Id)
	c.Set("group", user.Group)
	c.Set("user_group", user.Group)
	c.Set("use_access_token", useAccessToken)
	c.Set("session_id", identity.SessionID)
	c.Set("auth_version", identity.UserAuthVersion)
	c.Set("session_version", identity.SessionVersion)
	c.Set(authIdentityContextKey, identity)
	user.WriteContext(c)
}

func writeDashboardAuthError(c *gin.Context, err error) {
	if errors.Is(err, service.ErrAuthTokenExpired) {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"success": false, "code": "AUTH_TOKEN_EXPIRED", "message": common.TranslateMessage(c, i18n.MsgAuthNotLoggedIn)})
		return
	}
	if errors.Is(err, service.ErrLoginSessionRevoked) || errors.Is(err, gorm.ErrRecordNotFound) {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"success": false, "code": "AUTH_SESSION_REVOKED", "message": common.TranslateMessage(c, i18n.MsgAuthNotLoggedIn)})
		return
	}
	if errors.Is(err, service.ErrAuthTokenInvalid) {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"success": false, "code": "AUTH_UNAUTHORIZED", "message": common.TranslateMessage(c, i18n.MsgAuthAccessTokenInvalid)})
		return
	}
	common.SysLog("dashboard authentication error: " + err.Error())
	c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"success": false, "code": "AUTH_INTERNAL_ERROR", "message": common.TranslateMessage(c, i18n.MsgDatabaseError)})
}

func RequirePermission(permission authz.Permission) func(c *gin.Context) {
	return func(c *gin.Context) {
		role := c.GetInt("role")
		userID := c.GetInt("id")
		if authz.Can(userID, role, permission) {
			c.Next()
			return
		}
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": common.TranslateMessage(c, i18n.MsgAuthInsufficientPrivilege),
		})
		c.Abort()
	}
}

func WssAuth(c *gin.Context) {

}

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

// TokenOrUserAuth allows either session-based user auth or API token auth.
// Used for endpoints that need to be accessible from both the dashboard and API clients.
func TokenOrUserAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		raw, ok := authorizationToken(c.GetHeader("Authorization"))
		if ok {
			identity, internal, err := service.ParseDashboardAccessToken(raw)
			if !internal {
				TokenAuth()(c)
				return
			}
			if err != nil {
				writeDashboardAuthError(c, err)
				return
			}
			_, user, err := service.ValidateLoginSession(identity)
			if err != nil {
				writeDashboardAuthError(c, err)
				return
			}
			setDashboardAuthContext(c, user, identity, false)
			c.Next()
			return
		}
		// Opaque credentials are relay API keys here, never dashboard PATs.
		TokenAuth()(c)
	}
}

// TokenAuthReadOnly 宽松版本的令牌认证中间件，用于只读查询接口。
// 只验证令牌 key 是否存在，不检查令牌状态、过期时间和额度。
// 即使令牌已过期、已耗尽或已禁用，也允许访问。
// 仍然检查用户是否被封禁。
func TokenAuthReadOnly() func(c *gin.Context) {
	return func(c *gin.Context) {
		key := c.Request.Header.Get("Authorization")
		if key == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": common.TranslateMessage(c, i18n.MsgTokenNotProvided),
			})
			c.Abort()
			return
		}
		if strings.HasPrefix(key, "Bearer ") || strings.HasPrefix(key, "bearer ") {
			key = strings.TrimSpace(key[7:])
		}
		key = strings.TrimPrefix(key, "sk-")
		key, _, _ = strings.Cut(key, "-")

		token, err := model.GetTokenByKey(key, false)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusUnauthorized, gin.H{
					"success": false,
					"message": common.TranslateMessage(c, i18n.MsgTokenInvalid),
				})
			} else {
				common.SysLog("TokenAuthReadOnly GetTokenByKey database error: " + err.Error())
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"message": common.TranslateMessage(c, i18n.MsgDatabaseError),
				})
			}
			c.Abort()
			return
		}

		// TokenAuthReadOnly must keep allowing other token states to query read-only
		// data, such as token usage logs; only explicitly disabled tokens are denied.
		if token.Status == common.TokenStatusDisabled {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": common.TranslateMessage(c, i18n.MsgTokenStatusUnavailable),
			})
			c.Abort()
			return
		}

		userCache, err := model.GetUserCache(token.UserId)
		if err != nil {
			common.SysLog(fmt.Sprintf("TokenAuthReadOnly GetUserCache error for user %d: %v", token.UserId, err))
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": common.TranslateMessage(c, i18n.MsgDatabaseError),
			})
			c.Abort()
			return
		}
		if userCache.Status != common.UserStatusEnabled {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"message": common.TranslateMessage(c, i18n.MsgAuthUserBanned),
			})
			c.Abort()
			return
		}

		c.Set("id", token.UserId)
		c.Set("token_id", token.Id)
		c.Set("token_key", token.Key)
		c.Next()
	}
}

func TokenAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		// 先检测是否为ws
		if c.Request.Header.Get("Sec-WebSocket-Protocol") != "" {
			// Sec-WebSocket-Protocol: realtime, openai-insecure-api-key.sk-xxx, openai-beta.realtime-v1
			// read sk from Sec-WebSocket-Protocol
			key := c.Request.Header.Get("Sec-WebSocket-Protocol")
			parts := strings.SplitSeq(key, ",")
			for part := range parts {
				part = strings.TrimSpace(part)
				if strings.HasPrefix(part, "openai-insecure-api-key") {
					key = strings.TrimPrefix(part, "openai-insecure-api-key.")
					break
				}
			}
			c.Request.Header.Set("Authorization", "Bearer "+key)
		}
		// 检查path包含/v1/messages 或 /v1/models
		if strings.Contains(c.Request.URL.Path, "/v1/messages") || strings.Contains(c.Request.URL.Path, "/v1/models") {
			anthropicKey := c.Request.Header.Get("x-api-key")
			if anthropicKey != "" {
				c.Request.Header.Set("Authorization", "Bearer "+anthropicKey)
			}
		}
		// gemini api 从query中获取key
		if c.Request.URL.Path == "/v1/models" ||
			strings.HasPrefix(c.Request.URL.Path, "/v1beta/models") ||
			strings.HasPrefix(c.Request.URL.Path, "/v1beta/openai/models") ||
			strings.HasPrefix(c.Request.URL.Path, "/v1/models/") {
			skKey := c.Query("key")
			if skKey != "" {
				c.Request.Header.Set("Authorization", "Bearer "+skKey)
			}
			// 从x-goog-api-key header中获取key
			xGoogKey := c.Request.Header.Get("x-goog-api-key")
			if xGoogKey != "" {
				c.Request.Header.Set("Authorization", "Bearer "+xGoogKey)
			}
		}
		key := c.Request.Header.Get("Authorization")
		parts := make([]string, 0)
		if strings.HasPrefix(key, "Bearer ") || strings.HasPrefix(key, "bearer ") {
			key = strings.TrimSpace(key[7:])
		}
		if key == "" || key == "midjourney-proxy" {
			key = c.Request.Header.Get("mj-api-secret")
			if strings.HasPrefix(key, "Bearer ") || strings.HasPrefix(key, "bearer ") {
				key = strings.TrimSpace(key[7:])
			}
			key = strings.TrimPrefix(key, "sk-")
			parts = strings.Split(key, "-")
			key = parts[0]
		} else {
			key = strings.TrimPrefix(key, "sk-")
			parts = strings.Split(key, "-")
			key = parts[0]
		}
		token, err := model.ValidateUserToken(key)
		if token != nil {
			id := c.GetInt("id")
			if id == 0 {
				c.Set("id", token.UserId)
			}
		}
		if err != nil {
			if errors.Is(err, model.ErrDatabase) {
				common.SysLog("TokenAuth ValidateUserToken database error: " + err.Error())
				abortWithOpenAiMessage(c, http.StatusInternalServerError,
					common.TranslateMessage(c, i18n.MsgDatabaseError))
			} else {
				abortWithOpenAiMessage(c, http.StatusUnauthorized,
					common.TranslateMessage(c, i18n.MsgTokenInvalid))
			}
			return
		}

		allowIps := token.GetIpLimits()
		if len(allowIps) > 0 {
			clientIp := c.ClientIP()
			logger.LogDebug(c, "Token has IP restrictions, checking client IP %s", clientIp)
			ip := net.ParseIP(clientIp)
			if ip == nil {
				abortWithOpenAiMessage(c, http.StatusForbidden, "无法解析客户端 IP 地址")
				return
			}
			if common.IsIpInCIDRList(ip, allowIps) == false {
				abortWithOpenAiMessage(c, http.StatusForbidden, "您的 IP 不在令牌允许访问的列表中", types.ErrorCodeAccessDenied)
				return
			}
			logger.LogDebug(c, "Client IP %s passed the token IP restrictions check", clientIp)
		}

		userCache, err := model.GetUserCache(token.UserId)
		if err != nil {
			common.SysLog(fmt.Sprintf("TokenAuth GetUserCache error for user %d: %v", token.UserId, err))
			abortWithOpenAiMessage(c, http.StatusInternalServerError,
				common.TranslateMessage(c, i18n.MsgDatabaseError))
			return
		}
		userEnabled := userCache.Status == common.UserStatusEnabled
		if !userEnabled {
			abortWithOpenAiMessage(c, http.StatusForbidden, common.TranslateMessage(c, i18n.MsgAuthUserBanned))
			return
		}

		userCache.WriteContext(c)

		userGroup := userCache.Group
		tokenGroup := token.Group
		if tokenGroup != "" {
			// check common.UserUsableGroups[userGroup]
			if _, ok := service.GetUserUsableGroups(userGroup)[tokenGroup]; !ok {
				abortWithOpenAiMessage(c, http.StatusForbidden, fmt.Sprintf("无权访问 %s 分组", tokenGroup))
				return
			}
			// check group in common.GroupRatio
			if !ratio_setting.ContainsGroupRatio(tokenGroup) {
				if tokenGroup != "auto" {
					abortWithOpenAiMessage(c, http.StatusForbidden, fmt.Sprintf("分组 %s 已被弃用", tokenGroup))
					return
				}
			}
			userGroup = tokenGroup
		}
		common.SetContextKey(c, constant.ContextKeyUsingGroup, userGroup)

		err = SetupContextForToken(c, token, parts...)
		if err != nil {
			return
		}
		c.Next()
	}
}

func SetupContextForToken(c *gin.Context, token *model.Token, parts ...string) error {
	if token == nil {
		return fmt.Errorf("token is nil")
	}
	c.Set("id", token.UserId)
	c.Set("token_id", token.Id)
	c.Set("token_key", token.Key)
	c.Set("token_name", token.Name)
	c.Set("token_unlimited_quota", token.UnlimitedQuota)
	if !token.UnlimitedQuota {
		c.Set("token_quota", token.RemainQuota)
	}
	if token.ModelLimitsEnabled {
		c.Set("token_model_limit_enabled", true)
		c.Set("token_model_limit", token.GetModelLimitsMap())
	} else {
		c.Set("token_model_limit_enabled", false)
	}
	common.SetContextKey(c, constant.ContextKeyTokenGroup, token.Group)
	common.SetContextKey(c, constant.ContextKeyTokenCrossGroupRetry, token.CrossGroupRetry)
	if token.AutoGroups != "" {
		autoGroups, err := token.GetAutoGroups()
		if err != nil {
			common.SysError(fmt.Sprintf("failed to parse auto groups for token %d: %v", token.Id, err))
			autoGroups = []string{}
			common.SetContextKey(c, constant.ContextKeyTokenAutoGroups, autoGroups)
		} else if len(autoGroups) > 0 {
			common.SetContextKey(c, constant.ContextKeyTokenAutoGroups, autoGroups)
		}
	}
	if len(parts) > 1 {
		if model.IsAdmin(token.UserId) {
			id, err := strconv.Atoi(parts[1])
			if err != nil {
				abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgDistributorInvalidChannelId))
				return fmt.Errorf("invalid specific channel id")
			}
			service.GetChannelConstraints(c).AddPin(dto.ChannelPin{
				ChannelId: id,
				Source:    dto.PinSourceToken,
				Rank:      dto.PinRankToken,
				RetryMode: dto.PinRetrySingleAttempt,
			})
		} else {
			c.Header("specific_channel_version", "701e3ae1dc3f7975556d354e0675168d004891c8")
			abortWithOpenAiMessage(c, http.StatusForbidden, "普通用户不支持指定渠道")
			return fmt.Errorf("普通用户不支持指定渠道")
		}
	}
	return nil
}
