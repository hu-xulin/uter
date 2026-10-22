package controller

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/i18n"
	"github.com/uter-ai/uter/logger"
	"github.com/uter-ai/uter/middleware"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/relaykit/dto"
	"github.com/uter-ai/uter/service"
	"github.com/uter-ai/uter/service/authz"
	"github.com/uter-ai/uter/setting"
	"github.com/uter-ai/uter/setting/operation_setting"

	"github.com/uter-ai/uter/constant"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type LoginRequest struct {
	Username          string `json:"username"`
	Password          string `json:"password"`
	PasswordEncrypted string `json:"password_encrypted"`
	EncryptionKeyID   string `json:"encryption_key_id"`
}

func GetPasswordEncryptionKey(c *gin.Context) {
	if !common.PasswordLoginEncryptionEnabled {
		common.ApiSuccess(c, gin.H{"enabled": false})
		return
	}
	keyID, publicKey := common.PasswordEncryptionPublicKey()
	if keyID == "" || publicKey == "" {
		common.ApiErrorT(c, "Database error, please contact the administrator")
		return
	}
	common.ApiSuccess(c, gin.H{
		"enabled":    true,
		"kid":        keyID,
		"public_key": publicKey,
	})
}

func Login(c *gin.Context) {
	if !common.PasswordLoginEnabled {
		common.ApiErrorT(c, "Password login has been disabled by administrator")
		return
	}
	var loginRequest LoginRequest
	err := common.DecodeJson(c.Request.Body, &loginRequest)
	if err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	username := loginRequest.Username
	password := loginRequest.Password
	if common.PasswordLoginEncryptionEnabled {
		if loginRequest.PasswordEncrypted == "" || loginRequest.EncryptionKeyID == "" {
			common.ApiErrorT(c, "Invalid parameters")
			return
		}
		password, err = common.DecryptPassword(loginRequest.PasswordEncrypted, loginRequest.EncryptionKeyID)
		if err != nil {
			common.ApiErrorT(c, "Username or password is incorrect, or user has been banned")
			return
		}
	}
	if username == "" || password == "" {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	user := model.User{
		Username: username,
		Password: password,
	}
	err = user.ValidateAndFill()
	if err != nil {
		switch {
		case errors.Is(err, model.ErrDatabase):
			common.SysLog(common.LogText("Login database error for user %s: %v", username, err))
			common.ApiErrorT(c, "Database error, please contact the administrator")
		case errors.Is(err, model.ErrUserEmptyCredentials):
			common.ApiErrorT(c, "Invalid parameters")
		default:
			common.ApiErrorT(c, "Username or password is incorrect, or user has been banned")
		}
		return
	}

	setupLogin(&user, nil, c)
}

// loginMethodFromContext 根据请求路径推导登录方式，用于登录审计日志。
func loginMethodFromContext(c *gin.Context) string {
	if method := c.GetString("login_method"); method != "" {
		return method
	}
	switch c.FullPath() {
	case "/api/user/login":
		return "password"
	case "/api/user/login/2fa":
		return "2fa"
	case "/api/user/passkey/login/finish":
		return "passkey"
	case "/api/oauth/wechat":
		return "wechat"
	case "/api/oauth/telegram/login":
		return "telegram"
	case "/api/oauth/:provider":
		if provider := c.Param("provider"); provider != "" {
			return "oauth:" + provider
		}
		return "oauth"
	default:
		return "unknown"
	}
}

// recordLoginAudit 记录登录成功审计日志（对所有用户启用，仅记录成功，不记录失败）。
func recordLoginAudit(user *model.User, c *gin.Context) {
	method := loginMethodFromContext(c)
	ip := c.ClientIP()
	extra := model.AuditOther{
		LoginMethod: method,
		UserAgent:   c.Request.UserAgent(),
	}
	content := fmt.Sprintf("Logged in successfully via %s", method)
	params := map[string]any{
		"method": method,
	}
	if verifiedMethod := c.GetString("login_verification_method"); verifiedMethod != "" {
		params["verification_method"] = verifiedMethod
	}
	model.RecordLoginLog(user.Id, user.Role, user.Username, content, ip, "login", params, extra, c)
}

// setupLogin evaluates the shared login policy after primary authentication.
// Only a completed Passkey ceremony may go directly to session issuance. A
// pending legacy GitHub binding rewrite travels inside the challenge and is
// written only when the verification completes.
func setupLogin(user *model.User, migration *service.LegacyGitHubMigration, c *gin.Context) {
	challenge, err := service.StartLoginVerification(user, loginMethodFromContext(c), migration)
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	if challenge != nil {
		setAuthNoStore(c)
		common.ApiSuccess(c, challenge)
		return
	}
	setupLoginAtAuthVersion(user, user.AuthVersion, c)
}

func setupLoginAtAuthVersion(user *model.User, expectedAuthVersion int64, c *gin.Context) {
	if user == nil || user.Id <= 0 || user.Status != common.UserStatusEnabled {
		common.ApiErrorT(c, "User has been banned")
		return
	}
	currentUser, err := model.GetSelfUserById(user.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var bundle *service.AuthBundle
	if expectedAuthVersion > 0 {
		bundle, err = service.CreateLoginSessionAtAuthVersion(
			user.Id,
			expectedAuthVersion,
			loginMethodFromContext(c),
			c.ClientIP(),
			c.Request.UserAgent(),
		)
	} else {
		bundle, err = service.CreateLoginSession(
			user.Id,
			loginMethodFromContext(c),
			c.ClientIP(),
			c.Request.UserAgent(),
		)
	}
	if err != nil {
		writeAuthSessionError(c, err)
		return
	}
	writeLoginResponse(c, currentUser, bundle)
}

func writeLoginResponse(c *gin.Context, user *model.User, bundle *service.AuthBundle) {
	c.Set("login_method", bundle.Session.LoginMethod)
	model.UpdateUserLastLoginAt(user.Id)
	service.WriteRefreshCookie(c, bundle.RefreshToken)
	setAuthNoStore(c)
	recordLoginAudit(user, c)
	c.JSON(http.StatusOK, gin.H{
		"message": "",
		"success": true,
		"data": gin.H{
			"access_token":      bundle.AccessToken,
			"token_type":        bundle.TokenType,
			"access_expires_at": bundle.AccessExpiresAt,
			"session":           bundle.Session,
			"user":              buildSelfUserData(user),
		},
	})
}

func Register(c *gin.Context) {
	if !common.RegisterEnabled {
		common.ApiErrorT(c, "New user registration has been disabled by administrator")
		return
	}
	if !common.PasswordRegisterEnabled {
		common.ApiErrorT(c, "Password registration has been disabled by administrator, please use third-party account verification")
		return
	}
	var user model.User
	err := common.DecodeJson(c.Request.Body, &user)
	if err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	user.Username = strings.TrimSpace(user.Username)
	user.Email = model.NormalizeEmail(user.Email)
	if user.Username == "" {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	if err := common.Validate.Struct(&user); err != nil {
		common.ApiErrorT(c, "Invalid input {{error}}", map[string]any{"error": err.Error()})
		return
	}
	if common.EmailVerificationEnabled {
		if user.Email == "" || user.VerificationCode == "" {
			common.ApiErrorT(c, "Email verification is enabled, please enter email address and verification code")
			return
		}
		if !common.VerifyCodeWithKey(user.Email, user.VerificationCode, common.EmailVerificationPurpose) {
			common.ApiErrorT(c, "Verification code is incorrect or has expired")
			return
		}
		if err := model.EnsureEmailAvailable(user.Email, 0); err != nil {
			if errors.Is(err, model.ErrEmailAlreadyTaken) {
				common.ApiErrorT(c, "Email address is already in use")
				return
			}
			common.ApiErrorT(c, "Database error, please contact the administrator")
			return
		}
	}
	emailForExistCheck := ""
	if common.EmailVerificationEnabled {
		emailForExistCheck = user.Email
	}
	exist, err := model.CheckUserExistOrDeleted(user.Username, emailForExistCheck)
	if err != nil {
		common.ApiErrorT(c, "Database error, please contact the administrator")
		common.SysLog(common.LogText("CheckUserExistOrDeleted error: %v", err))
		return
	}
	if exist {
		common.ApiErrorT(c, "Username already exists or has been deleted")
		return
	}
	affCode := user.AffCode // this code is the inviter's code, not the user's own code
	inviterId, _ := model.GetUserIdByAffCode(affCode)
	cleanUser := model.User{
		Username:    user.Username,
		Password:    user.Password,
		DisplayName: user.Username,
		InviterId:   inviterId,
		Role:        common.RoleCommonUser, // 明确设置角色为普通用户
	}
	if common.EmailVerificationEnabled {
		cleanUser.Email = user.Email
	}
	if err := cleanUser.Insert(inviterId); err != nil {
		if errors.Is(err, model.ErrEmailAlreadyTaken) {
			common.ApiErrorT(c, "Email address is already in use")
			return
		}
		common.ApiError(c, err)
		return
	}

	// 获取插入后的用户ID
	var insertedUser model.User
	if err := model.DB.Where("username = ?", cleanUser.Username).First(&insertedUser).Error; err != nil {
		common.ApiErrorT(c, "User registration failed or user ID retrieval failed")
		return
	}
	// 生成默认令牌
	if constant.GenerateDefaultToken {
		key, err := common.GenerateKey()
		if err != nil {
			common.ApiErrorT(c, "Failed to generate default token")
			common.SysLog(common.LogText("failed to generate token key: %s", err.Error()))
			return
		}
		// 生成默认令牌
		token := model.Token{
			UserId:             insertedUser.Id, // 使用插入后的用户ID
			Name:               i18n.T(c, i18n.MsgUserDefaultTokenName, map[string]any{"Username": cleanUser.Username}),
			Key:                key,
			CreatedTime:        common.GetTimestamp(),
			AccessedTime:       common.GetTimestamp(),
			ExpiredTime:        -1,     // 永不过期
			RemainQuota:        500000, // 示例额度
			UnlimitedQuota:     true,
			ModelLimitsEnabled: false,
		}
		token.AllowUserQuotaQuery = true
		if setting.DefaultUseAutoGroup {
			token.Group = "auto"
		}
		if err := token.Insert(); err != nil {
			common.ApiErrorT(c, "Failed to create default token")
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func GetAllUsers(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	sortOptions := model.NewUserSortOptions(c.Query("sort_by"), c.Query("sort_order"))
	scope := middleware.RequestOrgScope(c)
	var excludeRoles []int
	if c.GetInt("role") < common.RoleRootUser {
		// 平台管理员看不到 Root 账号（保留 Root 的最高权限与不可见性）。
		excludeRoles = []int{common.RoleRootUser}
	}
	users, total, err := model.GetAllUsers(scope.OrgID, scope.DepartmentFilter(), excludeRoles, pageInfo, sortOptions)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(users)

	common.ApiSuccess(c, pageInfo)
	return
}

func SearchUsers(c *gin.Context) {
	keyword := c.Query("keyword")
	group := c.Query("group")
	var role *int
	if roleStr := c.Query("role"); roleStr != "" {
		if parsed, err := strconv.Atoi(roleStr); err == nil {
			role = &parsed
		}
	}
	var status *int
	if statusStr := c.Query("status"); statusStr != "" {
		if parsed, err := strconv.Atoi(statusStr); err == nil {
			status = &parsed
		}
	}
	pageInfo := common.GetPageQuery(c)
	sortOptions := model.NewUserSortOptions(c.Query("sort_by"), c.Query("sort_order"))
	scope := middleware.RequestOrgScope(c)
	var excludeRoles []int
	if c.GetInt("role") < common.RoleRootUser {
		excludeRoles = []int{common.RoleRootUser}
	}
	users, total, err := model.SearchUsersScoped(keyword, group, role, status, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), scope.OrgID, scope.DepartmentFilter(), excludeRoles, sortOptions)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(users)
	common.ApiSuccess(c, pageInfo)
	return
}

func canManageTargetRole(myRole int, targetRole int) bool {
	return myRole == common.RoleRootUser || myRole > targetRole
}

// targetWithinOrgScope 判定调用者能否触达目标用户的组织/部门范围（不含角色等级）。
//
// 平台管理员（organization_id==0）不受组织边界约束；组织范围管理员只能作用于本组织
// 成员，部门管理员再额外限制到本部门。所有「查看/改动他人」的接口都必须过这一关，
// 否则 role>=AdminUser 且 organization_id>0 的账号可以跨租户读、改、删其他组织的用户。
func targetWithinOrgScope(c *gin.Context, target *model.User) bool {
	myOrg := c.GetInt("organization_id")
	if myOrg == 0 {
		return true
	}
	if target.OrganizationId != myOrg {
		return false
	}
	if c.GetString("org_role") == model.OrgRoleDepartmentAdmin {
		myDept := c.GetString("department_name")
		if myDept == "" || target.DepartmentName != myDept {
			return false
		}
	}
	return true
}

// canManageTargetUser 判定调用者是否可以管理目标用户：角色等级 + 组织/部门范围。
//
// 任何「改动他人」的动作都必须先过这一关，包括额度调整。原实现中 add_quota 在加载
// 目标用户与这两项校验之前就 return，等于留了一条绕过「只能管理本组织成员」的通道。
func canManageTargetUser(c *gin.Context, target *model.User) bool {
	if !canManageTargetRole(c.GetInt("role"), target.Role) {
		return false
	}
	return targetWithinOrgScope(c, target)
}

func GetUser(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	user, err := model.GetUserById(id, false)
	if err != nil {
		// 不存在的 ID 必须返回 404 语义，而不是 200 + 裸「record not found」，
		// 否则调用方无法区分「查无此人」与「服务端错误」（BE-USR-016）。
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": common.TranslateMessage(c, i18n.MsgCommonUser_not_found),
			})
			return
		}
		common.ApiError(c, err)
		return
	}
	// 角色等级 + 组织/部门范围：组织范围管理员不得查看其他组织的用户。
	if !canManageTargetUser(c, user) {
		common.ApiErrorI18n(c, i18n.MsgUserNoPermissionSameLevel)
		return
	}
	user.AdminPermissions = authz.Capabilities(user.Id, user.Role)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    user,
	})
	return
}

type TransferAffQuotaRequest struct {
	Quota int `json:"quota" binding:"required"`
}

func TransferAffQuota(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}

	id := c.GetInt("id")
	user, err := model.GetUserById(id, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	tran := TransferAffQuotaRequest{}
	if err := c.ShouldBindJSON(&tran); err != nil {
		common.ApiError(c, err)
		return
	}
	err = user.TransferAffQuotaToQuota(tran.Quota)
	var message *common.Message
	if errors.As(err, &message) {
		common.ApiError(c, err)
		return
	}
	if err != nil {
		common.ApiErrorT(c, "Transfer failed {{error}}", map[string]any{"error": err.Error()})
		return
	}
	common.ApiSuccessT(c, "Transfer successful", nil)
}

func GetAffCode(c *gin.Context) {
	id := c.GetInt("id")
	user, err := model.GetUserById(id, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if user.AffCode == "" {
		user.AffCode = common.GetRandomString(4)
		if err := user.Update(false); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    user.AffCode,
	})
	return
}

func GetSelf(c *gin.Context) {
	id := c.GetInt("id")
	userRole := c.GetInt("role")
	user, err := model.GetSelfUserById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	responseData := buildSelfUserData(user)
	// The authenticated role is loaded from GetUserCache. It should equal the
	// row role, but use it for capabilities so GetSelf and login/refresh remain
	// consistent with the authorization decision made for this request.
	permissions := calculateUserPermissions(userRole)
	permissions["admin_permissions"] = authz.Capabilities(id, userRole)
	responseData["permissions"] = permissions

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    responseData,
	})
	return
}

// buildSelfUserData is the single safe dashboard-user DTO used by GetSelf,
// login and refresh. It intentionally excludes password, management PAT and
// administrator-only remarks.
func buildSelfUserData(user *model.User) map[string]any {
	userSetting := user.GetSetting()
	permissions := calculateUserPermissions(user.Role)
	permissions["admin_permissions"] = authz.Capabilities(user.Id, user.Role)
	// 组织名随 self/login/refresh 一并返回，供个人资料页在「当前余额」前展示
	// 成员的组织额度卡片使用；组织不存在（已被删）时回退空串，不阻断主流程。
	orgName := ""
	if user.OrganizationId > 0 {
		if org, oerr := model.GetOrganizationById(user.OrganizationId); oerr == nil {
			orgName = org.Name
		}
	}
	// 当月已用额度：按自然月（当月 1 日 00:00 起）从日志累计，已扣减退款。
	// 与 sub_quota_limit / used_quota 的累计口径不同——那两者是组织子额度账本，
	// 除非订阅计划按月重置否则不会清零，故不能当作「当月」展示。
	monthConsumed := model.GetUserMonthConsumedQuota(user.Id)
	return map[string]any{
		"id":                user.Id,
		"username":          user.Username,
		"display_name":      user.DisplayName,
		"has_password":      user.HasPassword,
		"role":              user.Role,
		"status":            user.Status,
		"email":             user.Email,
		"github_id":         user.GitHubId,
		"discord_id":        user.DiscordId,
		"oidc_id":           user.OidcId,
		"wechat_id":         user.WeChatId,
		"telegram_id":       user.TelegramId,
		"group":             user.Group,
		"quota":             user.Quota,
		"used_quota":        user.UsedQuota,
		"request_count":     user.RequestCount,
		"aff_code":          user.AffCode,
		"aff_count":         user.AffCount,
		"aff_quota":         user.AffQuota,
		"aff_history_quota": user.AffHistoryQuota,
		"inviter_id":        user.InviterId,
		"linux_do_id":       user.LinuxDOId,
		"setting":           user.Setting,
		"stripe_customer":   user.StripeCustomer,
		"sidebar_modules":   userSetting.SidebarModules, // 正确提取sidebar_modules字段
		"organization_id":   user.OrganizationId,
		"org_role":          user.OrgRole,
		"department_id":     user.DepartmentId,
		"sub_quota_limit":   user.SubQuotaLimit,
		"month_consumed":    monthConsumed,
		"department_name":   user.DepartmentName,
		"organization_name": orgName,
		"permissions":       permissions,
	}
}

// 计算用户权限的辅助函数
func calculateUserPermissions(userRole int) map[string]any {
	permissions := map[string]any{}

	// 根据用户角色计算权限
	if userRole == common.RoleRootUser {
		// 超级管理员不需要边栏设置功能
		permissions["sidebar_settings"] = false
		permissions["sidebar_modules"] = map[string]any{}
	} else if userRole == common.RoleAdminUser {
		// 管理员可以设置边栏，但不包含系统设置功能
		permissions["sidebar_settings"] = true
		permissions["sidebar_modules"] = map[string]any{
			"admin": map[string]any{
				"setting": false, // 管理员不能访问系统设置
			},
		}
	} else {
		// 普通用户只能设置个人功能，不包含管理员区域
		permissions["sidebar_settings"] = true
		permissions["sidebar_modules"] = map[string]any{
			"admin": false, // 普通用户不能访问管理员区域
		}
	}

	return permissions
}

// 根据用户角色生成默认的边栏配置
func generateDefaultSidebarConfig(userRole int) string {
	defaultConfig := map[string]any{}

	// 聊天区域 - 所有用户都可以访问
	defaultConfig["chat"] = map[string]any{
		"enabled":    true,
		"playground": true,
		"chat":       true,
	}

	// 控制台区域 - 所有用户都可以访问
	defaultConfig["console"] = map[string]any{
		"enabled":    true,
		"detail":     true,
		"token":      true,
		"log":        true,
		"midjourney": true,
		"task":       true,
	}

	// 个人中心区域 - 所有用户都可以访问
	defaultConfig["personal"] = map[string]any{
		"enabled":  true,
		"topup":    true,
		"personal": true,
	}

	// 管理员区域 - 根据角色决定
	if userRole == common.RoleAdminUser {
		// 管理员可以访问管理员区域，但不能访问系统设置
		defaultConfig["admin"] = map[string]any{
			"enabled":    true,
			"channel":    true,
			"models":     true,
			"redemption": true,
			"user":       true,
			"setting":    false, // 管理员不能访问系统设置
		}
	} else if userRole == common.RoleRootUser {
		// 超级管理员可以访问所有功能
		defaultConfig["admin"] = map[string]any{
			"enabled":    true,
			"channel":    true,
			"models":     true,
			"redemption": true,
			"user":       true,
			"setting":    true,
		}
	}
	// 普通用户不包含admin区域

	// 转换为JSON字符串
	configBytes, err := common.Marshal(defaultConfig)
	if err != nil {
		common.SysLog(common.LogText("failed to generate the default sidebar config: %s", err.Error()))
		return ""
	}

	return string(configBytes)
}

func GetUserModels(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		id = c.GetInt("id")
	}
	user, err := model.GetUserCache(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	groups := service.GetUserUsableGroups(user.Group)
	group := c.Query("group")
	var groupsToQuery []string
	switch {
	case group == "":
		for g := range groups {
			groupsToQuery = append(groupsToQuery, g)
		}
	case group == "auto":
		if _, ok := groups[group]; ok {
			groupsToQuery = service.GetUserAutoGroup(user.Group)
		}
	default:
		if _, ok := groups[group]; ok {
			groupsToQuery = []string{group}
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    service.GetGroupsEnabledModels(groupsToQuery),
	})
}

func UpdateUser(c *gin.Context) {
	var updatedUser model.User
	err := common.DecodeJson(c.Request.Body, &updatedUser)
	if err != nil || updatedUser.Id == 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	updatedUser.Username = strings.TrimSpace(updatedUser.Username)
	if updatedUser.Username == "" {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	if err := common.Validate.StructExcept(&updatedUser, "Password"); err != nil {
		common.ApiErrorT(c, "Invalid input {{error}}", map[string]any{"error": err.Error()})
		return
	}
	originUser, err := model.GetUserById(updatedUser.Id, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if updatedUser.Role != common.RoleGuestUser && updatedUser.Role != originUser.Role {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	updatedUser.Role = originUser.Role
	if !canManageTargetUser(c, originUser) {
		common.ApiErrorT(c, "No permission to update users of same or higher permission level")
		return
	}
	updatePassword := updatedUser.Password != ""
	auditParams := map[string]any{
		"username": originUser.Username,
		"id":       updatedUser.Id,
	}
	// Resetting a password or rewriting the admin permission matrix changes what
	// the managed account can do or who can sign in to it.
	if updatePassword || updatedUser.AdminPermissions != nil {
		authorization := requireAdminUserProof(c, service.VerificationScopeAdminUserUpdate, service.AdminUserContext{UserID: updatedUser.Id})
		if authorization == nil {
			return
		}
		auditParams["verification_method"] = authorization.Method
		auditParams["password_reset"] = updatePassword
		auditParams["admin_permissions_updated"] = updatedUser.AdminPermissions != nil
	}
	authzTouched := false
	if err := model.DB.Transaction(func(tx *gorm.DB) error {
		if err := updatedUser.EditWithTx(tx, updatePassword); err != nil {
			return err
		}
		touched, err := updateAdminPermissionsForUserInTx(c, tx, updatedUser.Id, originUser.Role, updatedUser.AdminPermissions)
		authzTouched = touched
		return err
	}); err != nil {
		common.ApiError(c, err)
		return
	}
	if authzTouched {
		if err := authz.ReloadPolicy(); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	if updatedUser.AuthVersion > originUser.AuthVersion {
		if _, err := model.RevokeAllUserSessions(updatedUser.Id, "admin_user_update"); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	if err := model.PublishUserAuthCache(updatedUser.Id); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAuditFor(c, updatedUser.Id, "user.update", auditParams)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func AdminClearUserBinding(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}

	bindingType := strings.ToLower(strings.TrimSpace(c.Param("binding_type")))
	if bindingType == "" {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}

	user, err := model.GetUserById(id, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if !canManageTargetUser(c, user) {
		common.ApiErrorT(c, "No permission to access users of same or higher level")
		return
	}
	authorization := requireAdminUserProof(c, service.VerificationScopeAdminUserBindingClear, service.AdminUserBindingContext{UserID: user.Id, BindingType: bindingType})
	if authorization == nil {
		return
	}

	if err := user.ClearBinding(bindingType); err != nil {
		common.ApiError(c, err)
		return
	}

	recordManageAuditFor(c, user.Id, "user.binding_clear", map[string]any{
		"bindingType":         bindingType,
		"username":            user.Username,
		"verification_method": authorization.Method,
	})

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "success",
	})
}

func UpdateSelf(c *gin.Context) {
	var requestData map[string]any
	if err := common.DecodeJson(c.Request.Body, &requestData); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}

	passwordRequested := false
	if value, exists := requestData["password"]; exists && value != nil {
		password, isString := value.(string)
		passwordRequested = !isString || password != ""
	}
	succeeded, notificationFailed := false, false
	if passwordRequested {
		defer func() {
			recordUserSecurityAudit(c, c.GetInt("id"), "user.password_change", map[string]any{"success": succeeded, "notification_failed": notificationFailed})
		}()
	}
	// 检查是否是用户设置更新请求 (sidebar_modules 或 language)
	if sidebarModules, sidebarExists := requestData["sidebar_modules"]; sidebarExists && !passwordRequested {
		userId := c.GetInt("id")
		user, err := model.GetUserById(userId, false)
		if err != nil {
			common.ApiError(c, err)
			return
		}

		// 获取当前用户设置
		currentSetting := user.GetSetting()

		// 更新sidebar_modules字段
		if sidebarModulesStr, ok := sidebarModules.(string); ok {
			currentSetting.SidebarModules = sidebarModulesStr
		}

		if err := model.UpdateUserSetting(user.Id, currentSetting); err != nil {
			common.ApiErrorT(c, "Update failed")
			return
		}

		common.ApiSuccessT(c, "Update successful", nil)
		return
	}

	// 检查是否是语言偏好更新请求
	if language, langExists := requestData["language"]; langExists && !passwordRequested {
		userId := c.GetInt("id")
		user, err := model.GetUserById(userId, false)
		if err != nil {
			common.ApiError(c, err)
			return
		}

		// 获取当前用户设置
		currentSetting := user.GetSetting()

		// 更新language字段
		if langStr, ok := language.(string); ok {
			currentSetting.Language = langStr
		}

		if err := model.UpdateUserSetting(user.Id, currentSetting); err != nil {
			common.ApiErrorT(c, "Update failed")
			return
		}

		common.ApiSuccessT(c, "Update successful", nil)
		return
	}

	// 原有的用户信息更新逻辑
	var user model.User
	requestDataBytes, err := common.Marshal(requestData)
	if err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	if err = common.Unmarshal(requestDataBytes, &user); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}

	if err := common.Validate.StructExcept(&user, "Password"); err != nil {
		common.ApiErrorT(c, "Invalid input")
		return
	}

	cleanUser := model.User{
		Id:          c.GetInt("id"),
		Username:    user.Username,
		Password:    user.Password,
		DisplayName: user.DisplayName,
	}
	if user.Password != "" {
		identity, ok := middleware.GetStepUpIdentity(c)
		if !ok {
			writeSecurityOperationError(c, service.ErrAuthTokenInvalid)
			return
		}
		current, err := model.GetUserById(identity.UserID, true)
		if err != nil {
			writeSecurityOperationError(c, err)
			return
		}
		firstPassword := current.Password == ""
		scope := service.VerificationScopePasswordChange
		if firstPassword {
			scope = service.VerificationScopePasswordSet
		}
		if middleware.RequireSecurityProof(c, service.VerificationOperation{Scope: scope}) == nil {
			return
		}
		cleanUser.OriginalPassword = user.OriginalPassword
		if err := model.ChangeUserPassword(identity, &cleanUser, firstPassword); err != nil {
			writeSecurityOperationError(c, err)
			return
		}
		succeeded = true
		notificationFailed = service.NotifyAccountSecurityChange(service.AccountMailLanguage(c, current.Id), current.Email, i18n.MsgSecurityEventPasswordUpdated) != nil
		if err := model.PublishUserAuthCache(cleanUser.Id); err != nil {
			writeSecurityOperationError(c, err)
			return
		}
		bundle, err := service.AdvanceCurrentSessionToUserVersion(identity, "password_changed")
		if err != nil {
			writeSecurityOperationError(c, err)
			return
		}
		data := authRotationData(bundle)
		data["has_password"] = true
		data["notification_warning"] = notificationFailed
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data":    data,
		})
		return
	}
	if err := cleanUser.Update(false); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
	return
}

func DeleteUser(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	originUser, err := model.GetUserById(id, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	myRole := c.GetInt("role")
	if myRole <= originUser.Role {
		common.ApiErrorT(c, "No permission to update users of same or higher permission level")
		return
	}
	authorization := requireAdminUserProof(c, service.VerificationScopeAdminUserDelete, service.AdminUserContext{UserID: originUser.Id})
	if authorization == nil {
		return
	}
	revokedAccessTokens, err := model.HardDeleteUserById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAuditFor(c, originUser.Id, "user.delete", map[string]any{
		"username":              originUser.Username,
		"id":                    originUser.Id,
		"verification_method":   authorization.Method,
		"revoked_access_tokens": revokedAccessTokens,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func DeleteSelf(c *gin.Context) {
	setAuthNoStore(c)
	succeeded := false
	var revokedAccessTokens int64
	defer func() {
		params := map[string]any{"success": succeeded}
		if succeeded {
			params["revoked_access_tokens"] = revokedAccessTokens
		}
		recordUserSecurityAudit(c, c.GetInt("id"), "user.account_delete", params)
	}()
	if middleware.RequireSecurityProof(c, service.VerificationOperation{Scope: service.VerificationScopeAccountDelete}) == nil {
		return
	}
	identity, _ := middleware.GetStepUpIdentity(c)
	var err error
	if revokedAccessTokens, err = model.DeleteUserForSession(identity); err != nil {
		if errors.Is(err, model.ErrCannotDeleteRootUser) {
			common.ApiErrorT(c, "Cannot delete super administrator account")
			return
		}
		writeSecurityOperationError(c, err)
		return
	}
	succeeded = true
	service.ClearRefreshCookie(c)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    gin.H{},
	})
}

func CreateUser(c *gin.Context) {
	var user model.User
	err := common.DecodeJson(c.Request.Body, &user)
	user.Username = strings.TrimSpace(user.Username)
	if err != nil || user.Username == "" || user.Password == "" {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	if err := common.Validate.Struct(&user); err != nil {
		common.ApiErrorT(c, "Invalid input {{error}}", map[string]any{"error": err.Error()})
		return
	}
	if !common.IsValidateRole(user.Role) {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	if user.DisplayName == "" {
		user.DisplayName = user.Username
	}
	myRole := c.GetInt("role")
	if user.Role >= myRole {
		common.ApiErrorT(c, "Cannot create users with permission level equal to or higher than yourself")
		return
	}
	auditParams := map[string]any{"role": user.Role}
	// Creating an administrator grants privilege just like promoting one.
	if user.Role >= common.RoleAdminUser {
		authorization := requireAdminUserProof(c, service.VerificationScopeAdminUserCreate, service.AdminUserCreateContext{Role: user.Role})
		if authorization == nil {
			return
		}
		auditParams["verification_method"] = authorization.Method
	}
	// Even for admin users, we cannot fully trust them!
	cleanUser := model.User{
		Username:    user.Username,
		Password:    user.Password,
		DisplayName: user.DisplayName,
		Role:        user.Role, // 保持管理员设置的角色
	}
	authzTouched := false
	if err := model.DB.Transaction(func(tx *gorm.DB) error {
		if err := cleanUser.InsertWithTx(tx, 0); err != nil {
			return err
		}
		touched, err := updateAdminPermissionsForUserInTx(c, tx, cleanUser.Id, cleanUser.Role, user.AdminPermissions)
		authzTouched = touched
		return err
	}); err != nil {
		common.ApiError(c, err)
		return
	}
	if authzTouched {
		if err := authz.ReloadPolicy(); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	cleanUser.FinishInsert(0)

	auditParams["username"] = cleanUser.Username
	recordManageAuditFor(c, cleanUser.Id, "user.create", auditParams)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func updateAdminPermissionsForUserInTx(c *gin.Context, tx *gorm.DB, userID int, userRole int, permissions map[string]map[string]bool) (bool, error) {
	if permissions == nil {
		if userRole < common.RoleAdminUser && c.GetInt("role") == common.RoleRootUser {
			return true, authz.ClearUserAuthorizationInTx(tx, userID)
		}
		return false, nil
	}
	if c.GetInt("role") != common.RoleRootUser {
		return false, fmt.Errorf("only root can update admin permissions")
	}
	if userRole < common.RoleAdminUser {
		return true, authz.ClearUserAuthorizationInTx(tx, userID)
	}
	return true, authz.SetUserPermissionsInTx(tx, userID, permissions)
}

type ManageRequest struct {
	Id     int    `json:"id"`
	Action string `json:"action"`
	Value  int    `json:"value"`
	Mode   string `json:"mode"`
}

// ManageUser Only admin user can do this
func ManageUser(c *gin.Context) {
	var req ManageRequest
	err := common.DecodeJson(c.Request.Body, &req)

	if err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	if req.Action == "add_quota" {
		manageUserQuota(c, req)
		return
	}
	user := model.User{
		Id: req.Id,
	}
	// Fill attributes
	model.DB.Unscoped().Where(&user).First(&user)
	if user.Id == 0 {
		common.ApiErrorT(c, "User does not exist")
		return
	}
	if !canManageTargetUser(c, &user) {
		common.ApiErrorT(c, "No permission to update users of same or higher permission level")
		return
	}
	myRole := c.GetInt("role")
	switch req.Action {
	case "disable":
		user.Status = common.UserStatusDisabled
		if user.Role == common.RoleRootUser {
			common.ApiErrorT(c, "Cannot disable super administrator user")
			return
		}
	case "enable":
		user.Status = common.UserStatusEnabled
	case "delete":
		if user.Role == common.RoleRootUser {
			common.ApiErrorT(c, "Cannot delete super administrator account")
			return
		}
		authorization := requireAdminUserProof(c, service.VerificationScopeAdminUserDelete, service.AdminUserContext{UserID: user.Id})
		if authorization == nil {
			return
		}
		revokedAccessTokens, err := user.Delete()
		if err != nil {
			common.ApiError(c, err)
			return
		}
		// 删除用户后，强制清理 Redis 中所有该用户令牌的缓存，
		// 避免已缓存的令牌在 TTL 过期前仍能通过 TokenAuth 校验。
		if err := model.InvalidateUserTokensCache(user.Id); err != nil {
			common.SysLog(common.LogText("failed to invalidate tokens cache for user %d: %s", user.Id, err.Error()))
		}
		recordManageAuditFor(c, user.Id, "user.manage", map[string]any{
			"action":                req.Action,
			"username":              user.Username,
			"id":                    user.Id,
			"verification_method":   authorization.Method,
			"revoked_access_tokens": revokedAccessTokens,
		})
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
		})
		return
	case "promote":
		if myRole != common.RoleRootUser {
			common.ApiErrorT(c, "Regular administrators cannot promote other users to administrator")
			return
		}
		if user.Role >= common.RoleAdminUser {
			common.ApiErrorT(c, "This user is already an administrator")
			return
		}
		user.Role = common.RoleAdminUser
	case "demote":
		if user.Role == common.RoleRootUser {
			common.ApiErrorT(c, "Cannot demote super administrator user")
			return
		}
		if user.Role == common.RoleCommonUser {
			common.ApiErrorT(c, "This user is already a common user")
			return
		}
		user.Role = common.RoleCommonUser
	default:
		common.ApiErrorT(c, "Invalid parameters")
		return
	}

	authorization := requireAdminUserProof(c, service.VerificationScopeAdminUserManage, service.AdminUserManageContext{UserID: user.Id, Action: req.Action})
	if authorization == nil {
		return
	}
	if req.Action == "demote" {
		if err := model.DB.Transaction(func(tx *gorm.DB) error {
			if err := user.UpdateWithTx(tx, false); err != nil {
				return err
			}
			return authz.ClearUserAuthorizationInTx(tx, user.Id)
		}); err != nil {
			common.ApiError(c, err)
			return
		}
		if err := authz.ReloadPolicy(); err != nil {
			common.ApiError(c, err)
			return
		}
		if err := model.PublishUserAuthCache(user.Id); err != nil {
			common.ApiError(c, err)
			return
		}
		if _, err := model.RevokeAllUserSessions(user.Id, "admin_demote"); err != nil {
			common.ApiError(c, err)
			return
		}
	} else {
		if err := user.Update(false); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	// Update/UpdateWithTx has already published the new user hash and revoked
	// browser sessions exactly once. Only PAT/relay token caches still need an
	// explicit invalidation; deleting the user hash here would discard the
	// freshly published auth-version floor.
	if err := model.InvalidateUserTokensCache(user.Id); err != nil {
		common.SysLog(common.LogText("failed to invalidate tokens cache for user %d: %s", user.Id, err.Error()))
	}
	recordManageAuditFor(c, user.Id, "user.manage", map[string]any{
		"action":              req.Action,
		"username":            user.Username,
		"id":                  user.Id,
		"verification_method": authorization.Method,
	})
	clearUser := model.User{
		Role:   user.Role,
		Status: user.Status,
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    clearUser,
	})
	return
}

type topUpRequest struct {
	Key string `json:"key"`
}

var topUpLocks sync.Map
var topUpCreateLock sync.Mutex

type topUpTryLock struct {
	ch chan struct{}
}

func newTopUpTryLock() *topUpTryLock {
	return &topUpTryLock{ch: make(chan struct{}, 1)}
}

func (l *topUpTryLock) TryLock() bool {
	select {
	case l.ch <- struct{}{}:
		return true
	default:
		return false
	}
}

func (l *topUpTryLock) Unlock() {
	select {
	case <-l.ch:
	default:
	}
}

func getTopUpLock(userID int) *topUpTryLock {
	if v, ok := topUpLocks.Load(userID); ok {
		return v.(*topUpTryLock)
	}
	topUpCreateLock.Lock()
	defer topUpCreateLock.Unlock()
	if v, ok := topUpLocks.Load(userID); ok {
		return v.(*topUpTryLock)
	}
	l := newTopUpTryLock()
	topUpLocks.Store(userID, l)
	return l
}

func TopUp(c *gin.Context) {
	if !operation_setting.IsPaymentComplianceConfirmed() {
		common.ApiErrorT(c, "Payment, redemption, subscription, and invitation reward features are disabled. The administrator must confirm compliance terms before enabling them.")
		return
	}

	id := c.GetInt("id")
	lock := getTopUpLock(id)
	if !lock.TryLock() {
		common.ApiErrorT(c, "Top-up is processing, please try again later")
		return
	}
	defer lock.Unlock()
	req := topUpRequest{}
	err := c.ShouldBindJSON(&req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	quota, err := model.Redeem(req.Key, id)
	if err != nil {
		// 不向用户暴露兑换失败的细分原因，避免攻击者根据错误类型判断兑换码状态。
		common.ApiErrorT(c, "Redemption failed, please try again later")
		logger.LogError(c, common.LogText("failed to redeem key %s for user %d: %s", req.Key, id, err.Error()))
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    quota,
	})
}

type UpdateUserSettingRequest struct {
	QuotaWarningType                 string  `json:"notify_type"`
	QuotaWarningThreshold            float64 `json:"quota_warning_threshold"`
	QuotaWarningEnabled              *bool   `json:"quota_warning_enabled,omitempty"`
	WebhookUrl                       string  `json:"webhook_url,omitempty"`
	WebhookSecret                    string  `json:"webhook_secret,omitempty"`
	NotificationEmail                string  `json:"notification_email,omitempty"`
	BarkUrl                          string  `json:"bark_url,omitempty"`
	GotifyUrl                        string  `json:"gotify_url,omitempty"`
	GotifyToken                      string  `json:"gotify_token,omitempty"`
	GotifyPriority                   int     `json:"gotify_priority,omitempty"`
	UpstreamModelUpdateNotifyEnabled *bool   `json:"upstream_model_update_notify_enabled,omitempty"`
	ChannelNotifyEnabled             *bool   `json:"channel_notify_enabled,omitempty"`
	AcceptUnsetModelRatioModel       bool    `json:"accept_unset_model_ratio_model"`
	RecordIpLog                      bool    `json:"record_ip_log"`
}

func UpdateUserSetting(c *gin.Context) {
	var req UpdateUserSettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}

	// 验证预警类型
	if req.QuotaWarningType != dto.NotifyTypeEmail && req.QuotaWarningType != dto.NotifyTypeWebhook && req.QuotaWarningType != dto.NotifyTypeBark && req.QuotaWarningType != dto.NotifyTypeGotify {
		common.ApiErrorT(c, "Invalid warning type")
		return
	}

	// 验证预警阈值，0 表示使用系统默认阈值
	if req.QuotaWarningThreshold < 0 {
		common.ApiErrorT(c, "Reminder threshold cannot be negative")
		return
	}

	// 如果是webhook类型,验证webhook地址
	if req.QuotaWarningType == dto.NotifyTypeWebhook {
		if req.WebhookUrl == "" {
			common.ApiErrorT(c, "Webhook URL cannot be empty")
			return
		}
		// 验证URL格式
		if _, err := url.ParseRequestURI(req.WebhookUrl); err != nil {
			common.ApiErrorT(c, "Invalid Webhook URL")
			return
		}
	}

	// 如果是邮件类型，验证邮箱地址
	if req.QuotaWarningType == dto.NotifyTypeEmail && req.NotificationEmail != "" {
		// 验证邮箱格式
		if !strings.Contains(req.NotificationEmail, "@") {
			common.ApiErrorT(c, "Invalid email address")
			return
		}
	}

	// 如果是Bark类型，验证Bark URL
	if req.QuotaWarningType == dto.NotifyTypeBark {
		if req.BarkUrl == "" {
			common.ApiErrorT(c, "Bark push URL cannot be empty")
			return
		}
		// 验证URL格式
		if _, err := url.ParseRequestURI(req.BarkUrl); err != nil {
			common.ApiErrorT(c, "Invalid Bark push URL")
			return
		}
		// 检查是否是HTTP或HTTPS
		if !strings.HasPrefix(req.BarkUrl, "https://") && !strings.HasPrefix(req.BarkUrl, "http://") {
			common.ApiErrorT(c, "URL must start with http:// or https://")
			return
		}
	}

	// 如果是Gotify类型，验证Gotify URL和Token
	if req.QuotaWarningType == dto.NotifyTypeGotify {
		if req.GotifyUrl == "" {
			common.ApiErrorT(c, "Gotify server URL cannot be empty")
			return
		}
		if req.GotifyToken == "" {
			common.ApiErrorT(c, "Gotify token cannot be empty")
			return
		}
		// 验证URL格式
		if _, err := url.ParseRequestURI(req.GotifyUrl); err != nil {
			common.ApiErrorT(c, "Invalid Gotify server URL")
			return
		}
		// 检查是否是HTTP或HTTPS
		if !strings.HasPrefix(req.GotifyUrl, "https://") && !strings.HasPrefix(req.GotifyUrl, "http://") {
			common.ApiErrorT(c, "URL must start with http:// or https://")
			return
		}
	}

	userId := c.GetInt("id")
	user, err := model.GetUserById(userId, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// 从已保存的设置出发，语言、侧边栏、扣费策略等不由此表单管理的字段保持不变；
	// 请求未携带的开关也保持原值
	settings := user.GetSetting()
	settings.NotifyType = req.QuotaWarningType
	settings.QuotaWarningThreshold = req.QuotaWarningThreshold
	settings.AcceptUnsetRatioModel = req.AcceptUnsetModelRatioModel
	settings.RecordIpLog = req.RecordIpLog
	if req.QuotaWarningEnabled != nil {
		settings.QuotaWarningEnabled = req.QuotaWarningEnabled
	}
	if user.Role >= common.RoleAdminUser {
		if req.UpstreamModelUpdateNotifyEnabled != nil {
			settings.UpstreamModelUpdateNotifyEnabled = *req.UpstreamModelUpdateNotifyEnabled
		}
		if req.ChannelNotifyEnabled != nil {
			settings.ChannelNotifyEnabled = req.ChannelNotifyEnabled
		}
	}

	// 只保留所选通知方式的配置，其他方式的配置清空
	settings.WebhookUrl, settings.WebhookSecret = "", ""
	settings.NotificationEmail = ""
	settings.BarkUrl = ""
	settings.GotifyUrl, settings.GotifyToken, settings.GotifyPriority = "", "", 0
	switch req.QuotaWarningType {
	case dto.NotifyTypeWebhook:
		settings.WebhookUrl = req.WebhookUrl
		settings.WebhookSecret = req.WebhookSecret
	case dto.NotifyTypeEmail:
		settings.NotificationEmail = req.NotificationEmail
	case dto.NotifyTypeBark:
		settings.BarkUrl = req.BarkUrl
	case dto.NotifyTypeGotify:
		settings.GotifyUrl = req.GotifyUrl
		settings.GotifyToken = req.GotifyToken
		// Gotify优先级范围0-10，超出范围则使用默认值5
		if req.GotifyPriority < 0 || req.GotifyPriority > 10 {
			settings.GotifyPriority = 5
		} else {
			settings.GotifyPriority = req.GotifyPriority
		}
	}

	// 更新用户设置
	if err := model.UpdateUserSetting(user.Id, settings); err != nil {
		common.ApiErrorT(c, "Update failed")
		return
	}

	common.ApiSuccessT(c, "Settings updated", nil)
}
