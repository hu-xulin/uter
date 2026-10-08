package controller

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/i18n"

	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"

	"github.com/gin-gonic/gin"
)

// auditContentTemplates 将稳定的操作标识 action 映射为英文兜底模板，渲染后写入
// Log.Content（供导出等非本地化消费者使用）。占位符为 ${name}，由该
// action 的 params 填充。本地化展示文案在前端 i18n 模板中维护，本表是语言中立的
// 英文基线——调用方因此无需在每个埋点处手写句子（避免与 params 重复书写同一份值）。
var auditContentTemplates = map[string]string{
	"user.create":               "Created user ${username} (role ${role})",
	"user.update":               "Updated user ${username} (ID: ${id})",
	"user.delete":               "Deleted user ${username} (ID: ${id})",
	"user.account_delete":       "Account deletion",
	"user.manage":               "Performed ${action} on user ${username} (ID: ${id})",
	"user.quota_add":            "Increased user quota by ${quota}",
	"user.quota_subtract":       "Decreased user quota by ${quota}",
	"user.quota_override":       "Overrode user quota from ${from} to ${to}",
	"user.binding_clear":        "Cleared ${bindingType} binding for user ${username}",
	"user.2fa_disable":          "Force-disabled two-factor authentication for the user",
	"user.passkey_register":     "Registered a passkey",
	"access_token.generate":     "Generated a system access token",
	"access_token.revoke":       "Revoked the system access token",
	"user.2fa_setup":            "Started two-factor authentication setup",
	"user.2fa_enable":           "Enabled two-factor authentication",
	"user.2fa_disable_self":     "Disabled two-factor authentication",
	"user.2fa_backup_codes":     "Regenerated two-factor backup codes",
	"user.security_verify":      "Completed security verification",
	"user.password_change":      "Account password change",
	"user.binding_start":        "Account binding request",
	"user.binding_bind":         "Account binding",
	"user.binding_unbind":       "Account unlinking",
	"user.email_binding_resend": "Email confirmation code resend",
	"user.passkey_delete":       "Deleted a passkey",
	"user.reset_passkey":        "Reset the user passkey",
	"option.update":             "Updated system setting ${key}",

	"option.passkey_domains":           "Updated Passkey domains: removed ${domains}; affected ${known}; unknown ${unknown}",
	"option.passkey_domains_confirmed": "Confirmed removal of Passkey domains: ${domains}; affected ${known}; unknown ${unknown}",
	"option.passkey_domains_blocked":   "Passkey domain change blocked: ${domains}; affected ${known}; unknown ${unknown}",
	"option.passkey_domains_failed":    "Passkey domain update failed",

	"channel.create":             "Created channel ${name} (type ${type}, count ${count})",
	"channel.update":             "Updated channel ${name} (ID: ${id})",
	"channel.delete":             "Deleted channel ${name} (ID: ${id})",
	"channel.delete_batch":       "Batch deleted ${count} channels",
	"channel.delete_disabled":    "Deleted all disabled channels (${count})",
	"channel.key_view":           "Viewed channel key ${name} (ID: ${id})",
	"channel.tag_disable":        "Disabled channels with tag ${tag}",
	"channel.tag_enable":         "Enabled channels with tag ${tag}",
	"channel.tag_edit":           "Edited channels with tag ${tag}",
	"channel.tag_batch_set":      "Batch set tag for ${count} channels",
	"channel.copy":               "Copied channel (source ID: ${sourceId}) to ${name} (new ID: ${id})",
	"channel.multi_key_manage":   "Multi-key management ${action} on channel (ID: ${id})",
	"channel.upstream_apply":     "Applied upstream model changes to channel (ID: ${id})",
	"channel.upstream_apply_all": "Applied upstream model changes to ${count} channels",

	"redemption.create":       "Created ${count} redemption codes named ${name} (${quota} each)",
	"redemption.delete_batch": "Batch deleted ${count} redemption codes",

	"subscription.plan_reset":      "Reset active subscriptions for plan ${plan_id}",
	"subscription.user_plan_reset": "Reset active plan ${plan_id} subscriptions for user ${target_user_id}",
}

func recordPasskeyDomainAudit(c *gin.Context, change *model.PasskeyDomainChange, confirmed bool, err error) {
	confirmed = confirmed && err == nil && change != nil && len(change.RemovedRPIDs) > 0
	params := map[string]any{"success": err == nil, "confirmed": confirmed}
	if change != nil {
		params["domains"] = strings.Join(change.RemovedRPIDs, ", ")
		params["removed_rp_ids"] = change.RemovedRPIDs
		params["known"] = change.AffectedCredentials
		params["unknown"] = change.UnknownCredentials
		params["previous_rp_id"] = change.PreviousRPID
		params["effective_rp_id"] = change.EffectiveRPID
	}
	action := "option.passkey_domains"
	if errors.Is(err, model.ErrPasskeyDomainRemovalConfirmation) {
		action = "option.passkey_domains_blocked"
	} else if err != nil {
		action = "option.passkey_domains_failed"
	} else if confirmed && change != nil && len(change.RemovedRPIDs) > 0 {
		action = "option.passkey_domains_confirmed"
	}
	auditInfo := &model.AuditRequestInfo{
		Method: c.Request.Method, Route: c.FullPath(), Path: c.FullPath(),
		Status: c.Writer.Status(), Success: err == nil,
	}
	model.RecordOperationAuditLog(c.GetInt("id"), c.GetInt("role"), auditContentEN(action, params), c.ClientIP(), action, params, auditOperatorInfo(c), auditInfo, c)
	markAuditLogged(c)
}

// userDisplayIdBase 与前端 @/lib/format 的 USER_ID_DISPLAY_BASE 保持一致：
// 数据库自增 user id=1 在后台审计日志中展示为对外编号 uter100000001。
const userDisplayIdBase = 100_000_000

// userIDAuditActions 是会在审计文案中嵌入「用户 ID」的 action 集合；这些 action
// 的 ${id} 占位符渲染为对外编号 uter…，渠道类 action 的 ${id} 仍是渠道 ID，必须原样保留。
var userIDAuditActions = map[string]struct{}{
	"user.update": {},
	"user.delete": {},
	"user.manage": {},
}

// formatUserDisplayId 把数据库自增 user id 转成对外编号（仅展示，params 中的
// 原始数字 id 不变，供结构化审计字段使用）。
func formatUserDisplayId(id int) string {
	if id <= 0 {
		return fmt.Sprintf("%d", id)
	}
	return fmt.Sprintf("uter%d", userDisplayIdBase+id)
}

// anyToInt 把 params 中可能以 int/int64/float64 形态出现的数值统一转成 int。
func anyToInt(v any) (int, bool) {
	switch n := v.(type) {
	case int:
		return n, true
	case int64:
		return int(n), true
	case float64:
		return int(n), true
	default:
		return 0, false
	}
}

// auditContentEN 按 action 模板渲染英文兜底文本；未登记的 action 退回 action 本身。
func auditContentEN(action string, params map[string]any) string {
	tmpl, ok := auditContentTemplates[action]
	if !ok {
		return action
	}
	_, isUserID := userIDAuditActions[action]
	return os.Expand(tmpl, func(key string) string {
		v, ok := params[key]
		if !ok {
			return ""
		}
		// 用户类操作的 ${id} 与订阅重置的 ${target_user_id} 是用户 ID，渲染为对外编号。
		if (isUserID && key == "id") || (action == "subscription.user_plan_reset" && key == "target_user_id") {
			if id, ok := anyToInt(v); ok {
				return formatUserDisplayId(id)
			}
		}
		return fmt.Sprintf("%v", v)
	})
}

// auditOperatorInfo 从上下文构建操作者身份信息（管理员 id/用户名/角色）。
func auditOperatorInfo(c *gin.Context) *model.AuditAdminInfo {
	return &model.AuditAdminInfo{
		AdminID:       c.GetInt("id"),
		AdminUsername: c.GetString("username"),
		AdminRole:     c.GetInt("role"),
		AuthMethod:    auditAuthMethod(c),
	}
}

func auditAuthMethod(c *gin.Context) string {
	if c.GetBool("use_access_token") {
		return "access_token"
	}
	return "session"
}

// markAuditLogged 标记当前请求已在 handler 内手动记录审计日志，
// 使鉴权链路中的审计兜底（finishAdminAudit）跳过兜底记录，避免重复。
func markAuditLogged(c *gin.Context) {
	common.SetContextKey(c, constant.ContextKeyAuditLogged, true)
}

// recordManageAudit 记录一条由操作者本人归属的管理/高危审计日志（资源类操作：
// 渠道 / 系统设置 / 兑换码等）。content 由 action+params 自动渲染。
func recordManageAudit(c *gin.Context, action string, params map[string]any) {
	recordManageAuditFor(c, c.GetInt("id"), action, params)
}

// recordManageAuditFor 记录一条管理审计日志，日志归属于操作者；targetUserId
// 只表示被操作用户，用于在结构化参数中保留目标上下文。
func recordManageAuditFor(c *gin.Context, targetUserId int, action string, params map[string]any) {
	if params == nil {
		params = map[string]any{}
	}
	operatorUserId := c.GetInt("id")
	if _, ok := params["target_user_id"]; !ok && targetUserId > 0 && targetUserId != operatorUserId {
		params["target_user_id"] = targetUserId
	}
	model.RecordOperationAuditLog(operatorUserId, c.GetInt("role"), auditContentEN(action, params), c.ClientIP(), action, params, auditOperatorInfo(c), nil, c)
	markAuditLogged(c)
}

// recordUserSecurityAudit 记录普通用户自己的安全敏感操作（如 passkey 绑定/解绑）。
// 这类日志没有管理员操作者，不写 admin_info；同时不依赖 AdminAuth/RootAuth 的兜底。
func recordUserSecurityAudit(c *gin.Context, userId int, action string, params map[string]any) {
	if code := c.GetString("security_error_code"); code != "" {
		if params == nil {
			params = map[string]any{}
		}
		params["code"] = code
	}
	var auditInfo *model.AuditRequestInfo
	if success, ok := params["success"].(bool); ok {
		auditInfo = &model.AuditRequestInfo{
			Method: c.Request.Method, Route: c.FullPath(), Path: c.FullPath(),
			Status: c.Writer.Status(), Success: success,
		}
	}
	model.RecordOperationAuditLog(userId, c.GetInt("role"), auditContentEN(action, params), c.ClientIP(), action, params, nil, auditInfo, c)
}

func tokenAuditParams(c *gin.Context) model.AuditFields {
	params, ok := common.GetContextKeyType[model.AuditFields](c, constant.ContextKeyTokenAuditParams)
	if !ok {
		params = model.AuditFields{}
		common.SetContextKey(c, constant.ContextKeyTokenAuditParams, params)
	}
	return params
}

func tokenBatchAuditParams(c *gin.Context, ids []int) model.AuditFields {
	params := tokenAuditParams(c)
	params["total"] = len(ids)
	// Bound audit payloads without changing the batch operation's limits.
	params["requested_ids"] = append([]int{}, ids[:min(len(ids), 100)]...)
	if len(ids) > 100 {
		params["requested_ids_truncated"] = true
	}
	return params
}

// GetOrganizationAuditLogs 返回组织内成员的审计日志（组织所有者 / 组织管理员 / 部门管理员）。
//
// 与 /api/audit（平台视角）不同：
//   - 调用者必须属于目标组织（loadOrgForAuthority 校验）；
//   - 范围被收窄到该组织（或在部门管理员视角下：本部门）—— 这是硬约束，
//     通过 AuditLogFilter.Usernames 下推到 SQL，而不是事后过滤；
//   - 仅 RoleCommonUser / RoleAdminUser 角色的记录可被看到，避免泄漏超管的内部操作；
//   - user_id 过滤与范围取交集：越权的用户 id 只会得到空集。
func GetOrganizationAuditLogs(c *gin.Context) {
	orgId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	org, _, ok := loadOrgForAuthority(c, orgId)
	if !ok {
		return
	}
	page := common.GetPageQuery(c)
	if page.Page < 1 || page.PageSize < 1 || page.Page > 100000000 {
		common.ApiErrorMsg(c, "Invalid audit pagination")
		return
	}
	userIds, ok := QueryUserIds(c)
	if !ok {
		return
	}
	filter := model.AuditLogFilter{Username: c.Query("username"), Category: c.Query("category"), TokenRef: c.Query("token_ref"), ExcludeTokenRef: c.Query("exclude_token_ref"), RequestId: c.Query("request_id")}
	if len(userIds) > 0 {
		filter.UserId = userIds[0]
	}
	if raw := c.Query("success"); raw != "" {
		if raw != "true" && raw != "false" {
			common.ApiErrorMsg(c, "Invalid audit result")
			return
		}
		success := raw == "true"
		filter.Success = &success
	}
	for name, target := range map[string]*int64{"start_timestamp": &filter.StartTimestamp, "end_timestamp": &filter.EndTimestamp} {
		if raw := c.Query(name); raw != "" {
			parsed, err := strconv.ParseInt(raw, 10, 64)
			if err != nil || parsed < 0 {
				common.ApiErrorMsg(c, "Invalid audit time range")
				return
			}
			*target = parsed
		}
	}
	if filter.EndTimestamp > 0 && filter.EndTimestamp < filter.StartTimestamp {
		common.ApiErrorMsg(c, "Invalid audit time range")
		return
	}
	if !model.ValidAuditCategory(filter.Category) || !model.ValidTokenFingerprint(filter.TokenRef) || !model.ValidTokenFingerprint(filter.ExcludeTokenRef) {
		common.ApiErrorMsg(c, "Invalid audit filters")
		return
	}
	usernames, err := orgAuditUsernames(c, org)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// 空范围必须换成「不可能匹配」的哨兵：model.GetAuditLogs 把空切片解释为
	// 「不施加过滤」，直接传空切片会让「本组织没有成员」退化成「看全站审计日志」。
	if len(usernames) == 0 {
		usernames = []string{model.NoOrgMemberUsername}
	}
	filter.Usernames = usernames
	// 非超管只能看到普通用户 / 平台管理员的操作日志：viewerRole 传 RoleAdminUser，
	// model.GetAuditLogs 据此把超管自身的记录滤掉，此处只控制行级可见性。
	logs, total, err := model.GetAuditLogs(filter, page.GetStartIdx(), page.GetPageSize(), common.RoleAdminUser)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	page.SetItems(logs)
	page.SetTotal(int(total))
	common.ApiSuccess(c, page)
}

// orgAuditUsernames 返回组织/部门范围内可见成员的 username，用于审计日志过滤。
// 部门管理员只看本部门；未分配部门时返回哨兵（空集）。组织管理员/部门管理员视角会
// 隐去其无权查看的角色（所有者 / 管理员），与成员列表、日志、额度统计的可见性口径一致。
func orgAuditUsernames(c *gin.Context, org *model.Organization) ([]string, error) {
	authority := orgAuthorityOf(c.GetInt("role"), c.GetInt("id"), c.GetInt("organization_id"), c.GetString("org_role"), org)
	excludeRoles := orgVisibilityExcludeRoles(authority)
	if authority == orgAuthorityDepartmentAdmin {
		return model.GetOrgMemberUsernamesInDepartment(org.Id, c.GetString("department_name"), excludeRoles...)
	}
	return model.GetOrgMemberUsernames(org.Id, excludeRoles...)
}
