package controller

import (
	"net/http"
	"strconv"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/logger"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

type PaymentComplianceRequest struct {
	Confirmed bool `json:"confirmed"`
}

func requirePaymentCompliance(c *gin.Context) bool {
	if !operation_setting.IsPaymentComplianceConfirmed() {
		common.ApiErrorT(c, "Payment, redemption, subscription, and invitation reward features are disabled. The administrator must confirm compliance terms before enabling them.")
		return false
	}
	return true
}

func ConfirmPaymentCompliance(c *gin.Context) {
	if c.GetBool("use_access_token") {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": "This operation requires dashboard session authentication. API access token is not allowed.",
		})
		return
	}

	var req PaymentComplianceRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	if !req.Confirmed {
		common.ApiErrorT(c, "Please confirm the compliance statement")
		return
	}

	now := time.Now().Unix()
	userId := c.GetInt("id")
	clientIP := c.ClientIP()

	updates := map[string]string{
		"payment_setting.compliance_confirmed":     "true",
		"payment_setting.compliance_terms_version": operation_setting.CurrentComplianceTermsVersion,
		"payment_setting.compliance_confirmed_at":  strconv.FormatInt(now, 10),
		"payment_setting.compliance_confirmed_by":  strconv.Itoa(userId),
		"payment_setting.compliance_confirmed_ip":  clientIP,
	}

	// PAY-001: write all five compliance fields atomically. The previous loop
	// called model.UpdateOption once per field, so a mid-loop failure left
	// compliance_confirmed=true with stale or missing terms version / timestamp
	// / operator / IP. UpdateOptionsBulk commits them in a single transaction,
	// so either all five land or none do.
	if err := model.UpdateOptionsBulk(updates); err != nil {
		common.ApiError(c, err)
		return
	}

	logger.LogInfo(c.Request.Context(), common.LogText(
		"payment compliance confirmed user_id=%d ip=%s terms_version=%s confirmed_at=%d",
		userId,
		clientIP,
		operation_setting.CurrentComplianceTermsVersion,
		now,
	))

	common.ApiSuccess(c, gin.H{
		"confirmed":     true,
		"terms_version": operation_setting.CurrentComplianceTermsVersion,
		"confirmed_at":  now,
		"confirmed_by":  userId,
	})
}
