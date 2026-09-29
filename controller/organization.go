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
func CreateOrganization(c *gin.Context) {
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
	// owner 视角
	if org, err := model.GetOrganizationByOwner(uid); err == nil {
		common.ApiSuccess(c, gin.H{"organization": org, "role": model.OrgRoleOwner})
		return
	}
	// 普通成员视角：读自己的 organization_id
	me, err := model.GetUserById(uid, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if me.OrganizationId == 0 {
		common.ApiSuccess(c, gin.H{"organization": nil})
		return
	}
	org, err := model.GetOrganizationById(me.OrganizationId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"organization": org, "role": me.OrgRole})
}

// GetOrganizationMembers 分页列出组织成员（组织管理员/老板可见）。
func GetOrganizationMembers(c *gin.Context) {
	orgId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if !canViewOrganization(c, orgId) {
		common.ApiErrorI18n(c, i18n.MsgUserNoPermissionHigherLevel)
		return
	}
	deptId, _ := strconv.Atoi(c.Query("department_id"))
	keyword := c.Query("keyword")
	page := common.GetPageQuery(c)
	members, total, err := model.GetOrgMembers(orgId, deptId, keyword, page.GetStartIdx(), page.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	page.SetTotal(int(total))
	page.SetItems(members)
	common.ApiSuccess(c, page)
}

// AddOrganizationMembers 把用户加入组织（老板/组织管理员）。
func AddOrganizationMembers(c *gin.Context) {
	orgId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	org, ok := loadEditableOrg(c, orgId)
	if !ok {
		return
	}
	var req struct {
		UserIds        []int `json:"user_ids"`
		DepartmentId   int   `json:"department_id"`
		SubQuotaLimit  int64 `json:"sub_quota_limit"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil || len(req.UserIds) == 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if err := org.AddMember(req.UserIds, req.DepartmentId, req.SubQuotaLimit); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"success": true})
}

// UpdateOrganizationMember 设置成员的子额度上限 / 部门 / 角色。
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
	org, ok := loadEditableOrg(c, orgId)
	if !ok {
		return
	}
	var req struct {
		SubQuotaLimit int64  `json:"sub_quota_limit"`
		DepartmentId  int    `json:"department_id"`
		OrgRole       string `json:"org_role"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if req.SubQuotaLimit >= 0 {
		if err := org.SetMemberSubQuotaLimit(uid, req.SubQuotaLimit); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	updates := map[string]any{}
	if req.DepartmentId >= 0 {
		updates["department_id"] = req.DepartmentId
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
	common.ApiSuccess(c, gin.H{"success": true})
}

// RemoveOrganizationMember 将成员移出组织（变回平台直管普通用户）。
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
	org, ok := loadEditableOrg(c, orgId)
	if !ok {
		return
	}
	if err := org.RemoveMember(uid); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"success": true})
}

// UpdateOrganization 更新组织元数据与预算（仅 owner）。
func UpdateOrganization(c *gin.Context) {
	orgId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	org, err := model.GetOrganizationById(orgId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if org.OwnerUserId != c.GetInt("id") {
		common.ApiErrorI18n(c, i18n.MsgUserNoPermissionHigherLevel)
		return
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
	if err := model.UpdateOrganization(orgId, req.Name, req.Quota, req.MemberLimit, req.Status); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"success": true})
}

// GetOrganizationStats 返回组织钱包与成员消耗概览（老板/组织管理员）。
func GetOrganizationStats(c *gin.Context) {
	orgId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if !canViewOrganization(c, orgId) {
		common.ApiErrorI18n(c, i18n.MsgUserNoPermissionHigherLevel)
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

// GetOrganization 返回指定组织（owner / 组织管理员 / 部门管理员 / 超管可见）。
func GetOrganization(c *gin.Context) {
	orgId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if !canViewOrganization(c, orgId) {
		common.ApiErrorI18n(c, i18n.MsgUserNoPermissionHigherLevel)
		return
	}
	org, err := model.GetOrganizationById(orgId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, org)
}

// GetOrganizationLogs 返回组织内成员的日志（组织管理员可见，仅含本组织成员）。
func GetOrganizationLogs(c *gin.Context) {
	orgId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if !canViewOrganization(c, orgId) {
		common.ApiErrorI18n(c, i18n.MsgUserNoPermissionHigherLevel)
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
	orgUsernames, _ := model.GetOrgMemberUsernames(orgId)
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

// GetOrganizationLogsStat 返回组织内成员的消耗汇总（组织管理员可见）。
func GetOrganizationLogsStat(c *gin.Context) {
	orgId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if !canViewOrganization(c, orgId) {
		common.ApiErrorI18n(c, i18n.MsgUserNoPermissionHigherLevel)
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
	orgUsernames, _ := model.GetOrgMemberUsernames(orgId)
	stat, err := model.SumUsedQuota(logType, startTimestamp, endTimestamp, modelName, username, tokenName, channel, group, orgUsernames...)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, stat)
}

// GetOrganizationQuotaDates 返回组织成员按时间聚合的额度消耗（组织管理员可见）。
func GetOrganizationQuotaDates(c *gin.Context) {
	orgId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if !canViewOrganization(c, orgId) {
		common.ApiErrorI18n(c, i18n.MsgUserNoPermissionHigherLevel)
		return
	}
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	username := c.Query("username")
	orgUsernames, _ := model.GetOrgMemberUsernames(orgId)
	dates, err := model.GetAllQuotaDates(startTimestamp, endTimestamp, username, orgUsernames...)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": dates})
}

// GetOrganizationQuotaDatesByUser 返回组织成员按用户聚合的额度消耗（组织管理员可见）。
func GetOrganizationQuotaDatesByUser(c *gin.Context) {
	orgId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if !canViewOrganization(c, orgId) {
		common.ApiErrorI18n(c, i18n.MsgUserNoPermissionHigherLevel)
		return
	}
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	orgUsernames, _ := model.GetOrgMemberUsernames(orgId)
	dates, err := model.GetQuotaDataGroupByUser(startTimestamp, endTimestamp, orgUsernames...)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": dates})
}

// GetOrganizationFlow 返回组织成员流量（按模型/日期）汇总（组织管理员可见）。
func GetOrganizationFlow(c *gin.Context) {
	orgId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if !canViewOrganization(c, orgId) {
		common.ApiErrorI18n(c, i18n.MsgUserNoPermissionHigherLevel)
		return
	}
	startTimestamp, endTimestamp, ok := parseFlowQuotaTimeRange(c)
	if !ok {
		return
	}
	username := c.Query("username")
	orgUsernames, _ := model.GetOrgMemberUsernames(orgId)
	dates, err := model.GetFlowQuotaData(startTimestamp, endTimestamp, username, 0, c.GetInt("role"), orgUsernames...)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": dates})
}

// canViewOrganization 仅允许组织 owner / 组织管理员 / 部门管理员查看本组织。
func canViewOrganization(c *gin.Context, orgId int) bool {
	if c.GetInt("role") >= common.RoleRootUser {
		return true
	}
	if c.GetInt("organization_id") == orgId {
		return true
	}
	return false
}

// loadEditableOrg 校验调用者是否可管理该组织（owner 或组织管理员），返回组织对象。
func loadEditableOrg(c *gin.Context, orgId int) (*model.Organization, bool) {
	org, err := model.GetOrganizationById(orgId)
	if err != nil {
		common.ApiError(c, err)
		return nil, false
	}
	role := c.GetInt("role")
	if role >= common.RoleRootUser {
		return org, true
	}
	if org.OwnerUserId == c.GetInt("id") {
		return org, true
	}
	if c.GetInt("organization_id") == orgId && c.GetString("org_role") != model.OrgRoleMember {
		return org, true
	}
	common.ApiErrorI18n(c, i18n.MsgUserNoPermissionHigherLevel)
	return nil, false
}
