package controller

import (
	"net/http"
	"strconv"

	"github.com/uter-ai/uter/common"

	"github.com/gin-gonic/gin"
	"github.com/uter-ai/uter/i18n"
	"github.com/uter-ai/uter/middleware"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
)

func GetAccessTokenStatus(c *gin.Context) {
	status, err := model.GetUserAccessTokenStatus(c.GetInt("id"))
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	common.ApiSuccess(c, status)
}

func GenerateAccessToken(c *gin.Context) {
	if middleware.RequireSecurityProof(c, service.VerificationOperation{Scope: service.VerificationScopeAccessTokenGenerate}) == nil {
		return
	}
	id := c.GetInt("id")
	key, err := common.GenerateRandomKey(29 + common.GetRandomInt(4))
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	var existing int64
	if err := model.DB.Model(&model.User{}).Where("access_token = ?", key).Count(&existing).Error; err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	if existing != 0 {
		common.ApiErrorI18n(c, i18n.MsgUuidDuplicate)
		return
	}
	if err := model.UpdateUserAccessToken(id, key); err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	recordUserSecurityAudit(c, id, "access_token.generate", map[string]any{"token_ref": model.AccessTokenFingerprint(key)})
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": key})
}

func RevokeAccessToken(c *gin.Context) {
	if middleware.RequireSecurityProof(c, service.VerificationOperation{Scope: service.VerificationScopeAccessTokenRevoke}) == nil {
		return
	}
	ref, err := model.RevokeUserAccessToken(c.GetInt("id"))
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	if ref != "" {
		recordUserSecurityAudit(c, c.GetInt("id"), "access_token.revoke", map[string]any{"token_ref": ref})
	}
	common.ApiSuccess(c, nil)
}

func GetAuditLogs(c *gin.Context) {
	page := common.GetPageQuery(c)
	if page.Page < 1 || page.PageSize < 1 || page.Page > 100000000 {
		common.ApiErrorMsg(c, "Invalid audit pagination")
		return
	}
	filter := model.AuditLogFilter{Username: c.Query("username"), Category: c.Query("category"), TokenRef: c.Query("token_ref"), ExcludeTokenRef: c.Query("exclude_token_ref"), RequestId: c.Query("request_id")}
	if raw := c.Query("user_id"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 0 {
			common.ApiErrorMsg(c, "Invalid audit user id")
			return
		}
		filter.UserId = parsed
	}
	viewerRole := c.GetInt("role")
	if c.FullPath() == "/api/audit/self" {
		filter.UserId = c.GetInt("id")
		filter.Username = ""
		filter.SelfView = true
	} else if scope := middleware.RequestOrgScope(c); !scope.IsPlatformScope() {
		// 与「使用日志 / 数据看板」口径一致：非平台视角（属于某组织）的调用者
		// 只能看到本组织 / 本部门成员的审计记录。空范围由 Usernames() 换成哨兵，
		// 不会退化成「看全站」。
		names, err := scope.Usernames()
		if err != nil {
			common.ApiError(c, err)
			return
		}
		filter.Usernames = names
	}
	if !model.ValidAuditCategory(filter.Category) || !model.ValidTokenFingerprint(filter.TokenRef) || !model.ValidTokenFingerprint(filter.ExcludeTokenRef) {
		common.ApiErrorMsg(c, "Invalid audit filters")
		return
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
	if raw := c.Query("success"); raw != "" {
		if raw != "true" && raw != "false" {
			common.ApiErrorMsg(c, "Invalid audit result")
			return
		}
		success := raw == "true"
		filter.Success = &success
	}
	logs, total, err := model.GetAuditLogs(filter, page.GetStartIdx(), page.GetPageSize(), viewerRole)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	page.SetItems(logs)
	page.SetTotal(int(total))
	common.ApiSuccess(c, page)
}
