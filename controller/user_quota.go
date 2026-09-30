package controller

import (
	"errors"
	"net/http"

	"github.com/Uter-AI/Uter/common"

	"github.com/Uter-AI/Uter/i18n"
	"github.com/Uter-AI/Uter/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func manageUserQuota(c *gin.Context, req ManageRequest) {
	action := "generic"
	params := model.AuditFields{
		"target_user_id":  req.Id,
		"mode":            req.Mode,
		"requested_quota": req.Value,
	}
	switch req.Mode {
	case "add":
		action = "user.quota_add"
	case "subtract":
		action = "user.quota_subtract"
	case "override":
		action = "user.quota_override"
	default:
		params["action"] = "add_quota"
		params["method"] = c.Request.Method
		params["route"] = c.FullPath()
	}
	success := false
	defer func() {
		content := auditContentEN(action, params)
		if !success {
			// Failed requests have no committed balance changes to render.
			content = "Failed user quota adjustment"
		}
		model.RecordOperationAuditLog(c.GetInt("id"), c.GetInt("role"), content, c.ClientIP(), action, params,
			auditOperatorInfo(c), &model.AuditRequestInfo{
				Method: c.Request.Method, Route: c.FullPath(), Status: c.Writer.Status(), Success: success,
			}, c)
		markAuditLogged(c)
	}()

	// 权限与组织范围门禁。
	//
	// 为什么放在这里而不是 ManageUser 里：add_quota 是 ManageUser 中最早分派的分支
	// （早于目标用户加载与 canManageTargetUser 校验），若门禁只写在 ManageUser 的
	// 后半段，额度调整就成了一条绕过「只能管理本组织成员」约束的通道。
	//
	// model.AdjustUserQuota 只比较 role 大小，不看 organization_id / department，
	// 因此组织边界必须由本函数显式施加。
	if req.Id > 0 {
		var target model.User
		if err := model.DB.Unscoped().
			Select("id", "role", "organization_id", "department_id").
			Where("id = ?", req.Id).First(&target).Error; err == nil {
			if !canManageTargetUser(c, &target) {
				params["failure_reason"] = "permission_denied"
				common.ApiErrorI18n(c, i18n.MsgUserNoPermissionHigherLevel)
				return
			}
		}
		// 读取失败时**不**在这里返回：交给下面的 AdjustUserQuota —— 它在事务内重新
		// 读取，能给出准确的失败原因（database_error / target_not_found），
		// 从而保住「一次请求一条审计且失败原因正确」的约定。
	}

	adjustment, err := model.AdjustUserQuota(req.Id, c.GetInt("role"), req.Mode, req.Value)
	if err != nil {
		switch {
		case errors.Is(err, model.ErrInvalidUserQuotaAdjustment):
			params["failure_reason"] = "invalid_parameters"
			if (req.Mode == "add" || req.Mode == "subtract") && req.Value <= 0 {
				common.ApiErrorI18n(c, i18n.MsgUserQuotaChangeZero)
			} else {
				common.ApiErrorI18n(c, i18n.MsgInvalidParams)
			}
		case errors.Is(err, model.ErrUserQuotaPermission):
			params["failure_reason"] = "permission_denied"
			common.ApiErrorI18n(c, i18n.MsgUserNoPermissionHigherLevel)
		case errors.Is(err, gorm.ErrRecordNotFound):
			params["failure_reason"] = "target_not_found"
			common.ApiErrorI18n(c, i18n.MsgUserNotExists)
		case errors.Is(err, model.ErrWalletQuotaLimitExceeded):
			params["failure_reason"] = "quota_limit_exceeded"
			common.ApiError(c, err)
		default:
			params["failure_reason"] = "database_error"
			common.ApiError(c, err)
		}
		return
	}

	params["target_username"] = adjustment.Username
	params["from"] = adjustment.Before
	params["to"] = adjustment.After
	if req.Mode != "override" {
		params["quota"] = req.Value
	}
	success = true
	operation := model.AuditOperation{Action: action, Params: params}
	model.RecordLogWithAdminInfo(adjustment.UserID, model.LogTypeTopup,
		auditContentEN(action, params), auditOperatorInfo(c), &operation, c)
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}
