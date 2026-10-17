package controller

import (
	"net/http"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/logger"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting"
	"github.com/gin-gonic/gin"
	"github.com/thanhpk/randstr"
)

type SubscriptionCreemPayRequest struct {
	PlanId int `json:"plan_id"`
}

func SubscriptionRequestCreemPay(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}

	var req SubscriptionCreemPayRequest

	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		paymentError(c, common.NewMessage("Invalid parameters"))
		return
	}

	plan, err := model.GetSubscriptionPlanById(req.PlanId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !plan.Enabled {
		common.ApiErrorT(c, "Subscription plan is not enabled")
		return
	}
	if plan.CreemProductId == "" {
		common.ApiErrorT(c, "CreemProductId is not configured for this plan")
		return
	}
	if plan.PriceAmount <= 0 {
		common.ApiErrorT(c, "Plan amount is too low")
		return
	}
	if setting.CreemWebhookSecret == "" {
		common.ApiErrorT(c, "Creem webhook is not configured")
		return
	}

	userId := c.GetInt("id")
	user, err := model.GetUserById(userId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if user == nil {
		common.ApiErrorT(c, "User does not exist")
		return
	}

	if plan.MaxPurchasePerUser > 0 {
		count, err := model.CountUserSubscriptionsByPlan(userId, plan.Id)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if count >= int64(plan.MaxPurchasePerUser) {
			common.ApiErrorT(c, "Purchase limit for this plan has been reached")
			return
		}
	}

	reference := "sub-creem-ref-" + randstr.String(6)
	referenceId := "sub_ref_" + common.Sha1([]byte(reference+time.Now().String()+user.Username))

	currency := subscriptionPlanCurrency(plan)
	if _, ok := expectedMinorUnits(plan.PriceAmount, currency); !ok {
		common.ApiErrorT(c, "Plan price/currency precision is invalid")
		return
	}

	// create pending order first
	order := &model.SubscriptionOrder{
		UserId:          userId,
		PlanId:          plan.Id,
		Money:           plan.PriceAmount,
		TradeNo:         referenceId,
		PaymentMethod:   model.PaymentMethodCreem,
		PaymentProvider:  model.PaymentProviderCreem,
		ProviderCurrency: strings.ToLower(currency),
		CreateTime:       time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := order.Insert(); err != nil {
		paymentError(c, common.NewMessage("Failed to create order"))
		return
	}

	// Reuse Creem checkout generator by building a lightweight product reference.
	product := &CreemProduct{
		ProductId: plan.CreemProductId,
		Name:      plan.Title,
		Price:     plan.PriceAmount,
		Currency:  currency,
		Quota:     0,
	}

	checkoutUrl, err := genCreemLink(c.Request.Context(), referenceId, product, user.Email, user.Username)
	if err != nil {
		logger.LogError(c.Request.Context(), common.LogText("Creem failed to create subscription payment link trade_no=%s product_id=%s error=%q", referenceId, product.ProductId, err.Error()))
		order.Status = common.TopUpStatusFailed
		_ = order.Update()
		paymentError(c, common.NewMessage("Failed to start payment"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"checkout_url": checkoutUrl,
			"order_id":     referenceId,
		},
	})
}
