package controller

import (
	"net/http"
	"strconv"

	"github.com/Uter-AI/Uter/common"

	"github.com/Uter-AI/Uter/i18n"
	"github.com/Uter-AI/Uter/model"

	"github.com/gin-gonic/gin"
)

// CreateOrganization 创建组织，创建者成为 owner（公司负责人）。
//
// 仅限超级管理员：组织是受控租户，且组织预算=0 表示「不限量」，如果任何登录用户都能
// 自助创建组织，就等于开放了一条「自建无预算上限组织 → 消耗不计入个人钱包」的免费通道。
// 企业客户的开通与预算由平台侧完成。
func CreateOrganization(c *gin.Context) {
	if c.GetInt("role") < common.RoleRootUser {
		common.ApiErrorI18n(c, i18n.MsgUserNoPermissionHigherLevel)
		return
	}
	var req struct {
		Name        string `json:"name"`
		Quota       int64  `json:"quota"`
		MemberLimit int    `json:"member_limit"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if req.Name == "" {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	ownerId := c.GetInt("id")
	org, err := model.CreateOrganization(req.Name, ownerId, req.Quota)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if req.MemberLimit > 0 {
		_ = model.UpdateOrganization(org.Id, "", -1, req.MemberLimit, -1)
		org.MemberLimit = req.MemberLimit
	}
	common.ApiSuccess(c, org)
}

// GetMyOrganization 返回当前用户所属（作为 owner/admin/member）的组织。
func GetMyOrganization(c *gin.Context) {
	uid := c.GetInt("id")
	me, err := model.GetUserById(uid, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// 组织归属以 users.organization_id + org_role 为准；organizations.owner_user_id
	// 只是指针，两者可能漂移 —— 一律以用户行上的归属为唯一事实来源。
	if me.OrganizationId == 0 {
		common.ApiSuccess(c, gin.H{"organization": nil})
		return
	}
	org, err := model.GetOrganizationById(me.OrganizationId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// 普通成员不可见组织总预算：屏蔽 quota/used_quota，仅暴露自己被分配的额度。
	canViewBudget := me.OrgRole != model.OrgRoleMember
	if !canViewBudget {
		org.Quota = 0
		org.UsedQuota = 0
	}
	common.ApiSuccess(c, gin.H{
		"organization":       org,
		"role":               me.OrgRole,
		"can_view_budget":    canViewBudget,
		"my_sub_quota_limit": me.SubQuotaLimit,
		"my_used_quota":      me.UsedQuota,
	})
}

// GetOrganizationMembers 分页列出组织成员（组织管理者看全组织，部门管理员只看本部门）。
func GetOrganizationMembers(c *gin.Context) {
	orgId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	_, authority, ok := loadOrgForAuthority(c, orgId)
	if !ok {
		return
	}
	// 部门管理员只能看本部门，且不接受其自定义部门参数（否则可横向探测其它部门）。
	departmentName := c.Query("department")
	if authority == orgAuthorityDepartmentAdmin {
		departmentName = c.GetString("department_name")
		if departmentName == "" {
			respondEmptyPage(c)
			return
		}
	}
	keyword := c.Query("keyword")
	page := common.GetPageQuery(c)
	members, total, err := model.GetOrgMembers(orgId, departmentName, keyword, page.GetStartIdx(), page.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	page.SetTotal(int(total))
	page.SetItems(members)
	common.ApiSuccess(c, page)
}

// respondEmptyPage 返回空分页结果（用于 fail-closed 场景：范围内没有任何可见数据）。
func respondEmptyPage(c *gin.Context) {
	page := common.GetPageQuery(c)
	page.SetTotal(0)
	page.SetItems([]any{})
	common.ApiSuccess(c, page)
}

// AddOrganizationMembers 把用户加入组织（仅组织所有者/组织管理员；超管亦可）。
// 部门管理员不得增删成员，否则可以把任意用户拉进组织以共享组织预算。
func AddOrganizationMembers(c *gin.Context) {
	orgId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	org, authority, ok := loadOrgForAuthority(c, orgId)
	if !ok {
		return
	}
	if authority != orgAuthorityOrgManager {
		common.ApiErrorI18n(c, i18n.MsgUserNoPermissionHigherLevel)
		return
	}
	var req struct {
		UserIds        []int  `json:"user_ids"`
		DepartmentName string `json:"department_name"`
		SubQuotaLimit  int64  `json:"sub_quota_limit"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil || len(req.UserIds) == 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if err := org.AddMember(req.UserIds, req.DepartmentName, req.SubQuotaLimit); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"success": true})
}

// orgMemberUpdateRequest 是设置组织成员属性的请求体。
//
// SubQuotaLimit 用指针而非值：本接口是**部分更新**，前端改角色时只发 org_role。
// 若用 int64，反序列化后必为 0，`>= 0` 的判据会把成员的子额度静默清成「不限」。
type orgMemberUpdateRequest struct {
	SubQuotaLimit  *int64 `json:"sub_quota_limit"`
	DepartmentName string `json:"department_name"`
	OrgRole        string `json:"org_role"`
}

// deptAdminMayUpdateMember 判定部门管理员对某成员的写操作是否落在授权范围内。
//
// 需求要求部门管理员能「设置自己部门不同用户的权限和额度」，因此不能像早期实现
// 那样一律拒绝角色改动；但组织级角色（owner/admin）绝不可由部门管理员授予，
// 否则等同于把「改角色」变成自升权通道。收窄后允许的改动为：
//   - 作用对象必须是本部门成员，且未分配部门的部门管理员一律不可写；
//   - 不得作用于组织所有者/组织管理员：否则部门管理员可把上级降权（权限倒挂）；
//   - 角色只能在 member ⇄ department_admin 之间切换；
//   - 不得改动自己的角色；
//   - 不得把成员迁出自己部门。
func deptAdminMayUpdateMember(callerUserId int, callerDepartment string, target *model.User, req orgMemberUpdateRequest) bool {
	if callerDepartment == "" || target.DepartmentName != callerDepartment {
		return false
	}
	if target.OrgRole == model.OrgRoleOwner || target.OrgRole == model.OrgRoleAdmin {
		return false
	}
	if callerUserId == target.Id {
		return false
	}
	if req.DepartmentName != "" && req.DepartmentName != target.DepartmentName {
		return false
	}
	if req.OrgRole != "" && req.OrgRole != model.OrgRoleMember && req.OrgRole != model.OrgRoleDepartmentAdmin {
		return false
	}
	return true
}

// UpdateOrganizationMember 设置成员的子额度上限 / 部门 / 角色。
//
// 分级授权：
//   - 组织所有者/组织管理员：可修改本组织成员的三项属性；但「授予 owner」只有
//     超管或当前所有者可以执行，避免组织管理员把任何人（含自己）提为所有者。
//   - 部门管理员：仅可作用于**本部门**成员，且角色改动只允许在 member 与
//     department_admin 之间（见 deptAdminMayUpdateMember）；不得改部门、不得改自己。
func UpdateOrganizationMember(c *gin.Context) {
	orgId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	uid, err := strconv.Atoi(c.Param("uid"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	org, authority, ok := loadOrgForAuthority(c, orgId)
	if !ok {
		return
	}
	var req orgMemberUpdateRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	var target model.User
	if err := model.DB.Where("id = ? AND organization_id = ?", uid, orgId).First(&target).Error; err != nil {
		common.ApiErrorI18n(c, i18n.MsgUserNotExists)
		return
	}
	if authority == orgAuthorityDepartmentAdmin {
		if !deptAdminMayUpdateMember(c.GetInt("id"), c.GetString("department_name"), &target, req) {
			common.ApiErrorI18n(c, i18n.MsgUserNoPermissionHigherLevel)
			return
		}
	}
	if req.OrgRole != "" {
		if !model.IsValidOrgRole(req.OrgRole) {
			common.ApiErrorI18n(c, i18n.MsgInvalidParams)
			return
		}
		if req.OrgRole == model.OrgRoleOwner {
			// 授予所有者：仅超管或当前所有者。否则组织管理员可自升为 owner。
			if c.GetInt("role") < common.RoleRootUser && org.OwnerUserId != c.GetInt("id") {
				common.ApiErrorI18n(c, i18n.MsgUserNoPermissionHigherLevel)
				return
			}
		}
		// 非超管不得改动组织所有者的角色（防止把老板降权/踢出管理）。
		if c.GetInt("role") < common.RoleRootUser && target.Id == org.OwnerUserId && req.OrgRole != model.OrgRoleOwner {
			common.ApiErrorI18n(c, i18n.MsgUserNoPermissionHigherLevel)
			return
		}
	}
	// 仅当请求显式携带 sub_quota_limit 时才改写；否则改角色/改部门会顺带清零额度。
	if req.SubQuotaLimit != nil {
		if err := org.SetMemberSubQuotaLimit(uid, *req.SubQuotaLimit); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	updates := map[string]any{}
	if req.DepartmentName != "" {
		updates["department_name"] = req.DepartmentName
	}
	if req.OrgRole != "" {
		updates["org_role"] = req.OrgRole
	}
	if len(updates) > 0 {
		if err := model.DB.Model(&model.User{}).Where("id = ? AND organization_id = ?", uid, orgId).Updates(updates).Error; err != nil {
			common.ApiError(c, err)
			return
		}
	}
	// 角色/部门变更后刷新认证缓存，侧栏与后端鉴权立即生效（见 model.CreateOrganization 注释）。
	_, _ = model.BumpUserAuthVersion(uid)
	// 被设为组织所有者：强制吊销其全部客户端会话（含当前），要求重新登录——高危权限变更的安全卫生。
	if req.OrgRole == model.OrgRoleOwner {
		if _, rerr := model.RevokeAllUserSessions(uid, "organization owner role granted"); rerr != nil {
			common.SysLog("failed to revoke sessions for new org owner " + strconv.Itoa(uid) + ": " + rerr.Error())
		}
	}
	common.ApiSuccess(c, gin.H{"success": true})
}

// RemoveOrganizationMember 将成员移出组织（仅组织所有者/组织管理员；超管亦可）。
func RemoveOrganizationMember(c *gin.Context) {
	orgId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	uid, err := strconv.Atoi(c.Param("uid"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	org, authority, ok := loadOrgForAuthority(c, orgId)
	if !ok {
		return
	}
	if authority != orgAuthorityOrgManager {
		common.ApiErrorI18n(c, i18n.MsgUserNoPermissionHigherLevel)
		return
	}
	if c.GetInt("role") < common.RoleRootUser && uid == org.OwnerUserId {
		common.ApiErrorI18n(c, i18n.MsgUserNoPermissionHigherLevel)
		return
	}
	if err := org.RemoveMember(uid); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"success": true})
}

// UpdateOrganization 更新组织元数据与预算。
//
// 预算（quota）与状态变更仅限超管：预算是平台售出的额度，若组织所有者能自行上调，
// 「组织预算」就不再是任何有约束力的东西（设为 0 即为不限量）。组织所有者/组织管理员
// 只能修改名称与成员上限。
func UpdateOrganization(c *gin.Context) {
	orgId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	org, authority, ok := loadOrgForAuthority(c, orgId)
	if !ok {
		return
	}
	isRoot := c.GetInt("role") >= common.RoleRootUser
	if !isRoot {
		if org.OwnerUserId != c.GetInt("id") {
			common.ApiErrorI18n(c, i18n.MsgUserNoPermissionHigherLevel)
			return
		}
		if authority != orgAuthorityOrgManager {
			common.ApiErrorI18n(c, i18n.MsgUserNoPermissionHigherLevel)
			return
		}
	}
	var req struct {
		Name        string `json:"name"`
		Quota       int64  `json:"quota"`
		MemberLimit int    `json:"member_limit"`
		Status      int    `json:"status"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if !isRoot && (req.Quota >= 0 || req.Status >= 0) {
		common.ApiErrorI18n(c, i18n.MsgUserNoPermissionHigherLevel)
		return
	}
	if err := model.UpdateOrganization(orgId, req.Name, req.Quota, req.MemberLimit, req.Status); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"success": true})
}

// GetOrganizationStats 返回组织钱包与成员消耗概览（组织管理者 / 部门管理员）。
func GetOrganizationStats(c *gin.Context) {
	orgId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if _, _, ok := loadOrgForAuthority(c, orgId); !ok {
		return
	}
	org, err := model.GetOrganizationById(orgId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"organization": org,
		"used_quota":   org.UsedQuota,
		"remaining":    org.Quota - org.UsedQuota,
	})
}

// GetOrganization 返回指定组织（组织管理者 / 部门管理员 / 超管可见）。
func GetOrganization(c *gin.Context) {
	orgId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if _, _, ok := loadOrgForAuthority(c, orgId); !ok {
		return
	}
	org, err := model.GetOrganizationById(orgId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, org)
}

// GetOrganizationLogs 返回组织内成员的日志（组织管理者看全组织，部门管理员只看本部门）。
func GetOrganizationLogs(c *gin.Context) {
	orgId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	_, authority, ok := loadOrgForAuthority(c, orgId)
	if !ok {
		return
	}
	pageInfo := common.GetPageQuery(c)
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	username := c.Query("username")
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	channel, _ := strconv.Atoi(c.Query("channel"))
	group := c.Query("group")
	requestId := c.Query("request_id")
	upstreamRequestId := c.Query("upstream_request_id")
	orgUsernames, err := orgLogUsernames(c, orgId, authority)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	logs, total, err := model.GetAllLogs(logType, startTimestamp, endTimestamp, modelName, username, tokenName, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), channel, group, requestId, upstreamRequestId, orgUsernames...)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.FormatAdminLogs(logs)
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	common.ApiSuccess(c, pageInfo)
}

// GetOrganizationLogsStat 返回组织内成员的消耗汇总（组织管理者 / 部门管理员）。
func GetOrganizationLogsStat(c *gin.Context) {
	orgId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	_, authority, ok := loadOrgForAuthority(c, orgId)
	if !ok {
		return
	}
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	username := c.Query("username")
	modelName := c.Query("model_name")
	channel, _ := strconv.Atoi(c.Query("channel"))
	group := c.Query("group")
	orgUsernames, err := orgLogUsernames(c, orgId, authority)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	stat, err := model.SumUsedQuota(logType, startTimestamp, endTimestamp, modelName, username, tokenName, channel, group, orgUsernames...)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, stat)
}

// GetOrganizationQuotaDates 返回组织成员按时间聚合的额度消耗（组织管理者 / 部门管理员）。
func GetOrganizationQuotaDates(c *gin.Context) {
	orgId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	_, authority, ok := loadOrgForAuthority(c, orgId)
	if !ok {
		return
	}
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	username := c.Query("username")
	orgUsernames, err := orgLogUsernames(c, orgId, authority)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	dates, err := model.GetAllQuotaDates(startTimestamp, endTimestamp, username, orgUsernames...)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": dates})
}

// GetOrganizationQuotaDatesByUser 返回组织成员按用户聚合的额度消耗（组织管理者 / 部门管理员）。
func GetOrganizationQuotaDatesByUser(c *gin.Context) {
	orgId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	_, authority, ok := loadOrgForAuthority(c, orgId)
	if !ok {
		return
	}
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	orgUsernames, err := orgLogUsernames(c, orgId, authority)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	dates, err := model.GetQuotaDataGroupByUser(startTimestamp, endTimestamp, orgUsernames...)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": dates})
}

// GetOrganizationFlow 返回组织成员流量（按模型/日期）汇总（组织管理者 / 部门管理员）。
func GetOrganizationFlow(c *gin.Context) {
	orgId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	_, authority, ok := loadOrgForAuthority(c, orgId)
	if !ok {
		return
	}
	startTimestamp, endTimestamp, ok := parseFlowQuotaTimeRange(c)
	if !ok {
		return
	}
	username := c.Query("username")
	orgUsernames, err := orgLogUsernames(c, orgId, authority)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	dates, err := model.GetFlowQuotaData(startTimestamp, endTimestamp, username, 0, c.GetInt("role"), orgUsernames...)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": dates})
}

// orgAuthority 描述调用者对某个组织的管理权限级别，是组织接口唯一的授权判据。
type orgAuthority int

const (
	// orgAuthorityNone 无管理权限：普通成员、其他组织的人、平台管理员（不属任何组织）。
	orgAuthorityNone orgAuthority = iota
	// orgAuthorityDepartmentAdmin 部门管理员：仅可读本部门数据、调整本部门成员的子额度。
	orgAuthorityDepartmentAdmin
	// orgAuthorityOrgManager 组织所有者/组织管理员：可管理本组织全部成员与部门。
	orgAuthorityOrgManager
)

// orgAuthorityOf 计算调用者对目标组织的管理权限级别。
//
// 与需求逐条对应的边界：
//   - 超级管理员：全部组织、全权；
//   - 组织所有者 / 组织管理员：本组织全权；
//   - 部门管理员：本组织内**仅本部门**，且只能调整成员子额度 ——
//     不得改角色、不得改部门、不得增删成员（否则可以把本部门成员提为 owner 自升权）；
//   - 普通成员 / 其他组织成员 / 平台管理员（organization_id==0）：无权限。
//
// 权限完全由调用者的实际归属与 org_role 推导，方法名与角色字符串解耦，
// 便于直接对边界做单元测试。
func orgAuthorityOf(callerRole, callerUserId, callerOrgId int, callerOrgRole string, org *model.Organization) orgAuthority {
	if org == nil {
		return orgAuthorityNone
	}
	if callerRole >= common.RoleRootUser {
		return orgAuthorityOrgManager
	}
	if callerOrgId == 0 || callerOrgId != org.Id {
		return orgAuthorityNone
	}
	switch callerOrgRole {
	case model.OrgRoleOwner, model.OrgRoleAdmin:
		return orgAuthorityOrgManager
	case model.OrgRoleDepartmentAdmin:
		return orgAuthorityDepartmentAdmin
	}
	// owner_user_id 是指针，可能与 org_role 漂移（见 model.CreateOrganization 注释）；
	// 仅在角色字段确实为空时回退到它，避免普通成员靠脏数据获得全权。
	if callerOrgRole == "" && org.OwnerUserId == callerUserId {
		return orgAuthorityOrgManager
	}
	return orgAuthorityNone
}

// loadOrgForAuthority 读取组织并校验调用者权限；无权限时已写回响应。
func loadOrgForAuthority(c *gin.Context, orgId int) (*model.Organization, orgAuthority, bool) {
	org, err := model.GetOrganizationById(orgId)
	if err != nil {
		common.ApiError(c, err)
		return nil, orgAuthorityNone, false
	}
	authority := orgAuthorityOf(c.GetInt("role"), c.GetInt("id"), c.GetInt("organization_id"), c.GetString("org_role"), org)
	if authority == orgAuthorityNone {
		common.ApiErrorI18n(c, i18n.MsgUserNoPermissionHigherLevel)
		return nil, orgAuthorityNone, false
	}
	return org, authority, true
}

// orgLogUsernames 返回该组织范围内可见成员的用户名，用于日志/统计过滤。
// 部门管理员只看本部门；未分配部门时返回哨兵值（空集，而不是全组织）。
func orgLogUsernames(c *gin.Context, orgId int, authority orgAuthority) ([]string, error) {
	if authority == orgAuthorityDepartmentAdmin {
		return model.GetOrgMemberUsernamesInDepartment(orgId, c.GetString("department_name"))
	}
	return model.GetOrgMemberUsernames(orgId)
}

// ListOrganizations 列出全部组织（仅超管）。供后台「添加用户」按组织归属账号时，
// 在角色下拉选择「组织」后填充组织选择器使用。
func ListOrganizations(c *gin.Context) {
	var orgs []model.Organization
	if err := model.DB.Order("id asc").Find(&orgs).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, orgs)
}
