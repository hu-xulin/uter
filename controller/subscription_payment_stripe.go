package controller

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/logger"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting"
	"github.com/gin-gonic/gin"
	"github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/checkout/session"
	"github.com/thanhpk/randstr"
)

type SubscriptionStripePayRequest struct {
	PlanId int `json:"plan_id"`
}

func SubscriptionRequestStripePay(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}

	var req SubscriptionStripePayRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
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
	if plan.StripePriceId == "" {
		common.ApiErrorT(c, "StripePriceId is not configured for this plan")
		return
	}
	if plan.PriceAmount <= 0 {
		common.ApiErrorT(c, "Plan amount is too low")
		return
	}
	if !strings.HasPrefix(setting.StripeApiSecret, "sk_") && !strings.HasPrefix(setting.StripeApiSecret, "rk_") {
		common.ApiErrorT(c, "Stripe is not configured or key is invalid")
		return
	}
	if setting.StripeWebhookSecret == "" {
		common.ApiErrorT(c, "Stripe webhook is not configured")
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

	reference := fmt.Sprintf("sub-stripe-ref-%d-%d-%s", user.Id, time.Now().UnixMilli(), randstr.String(4))
	referenceId := "sub_ref_" + common.Sha1([]byte(reference))

	order := &model.SubscriptionOrder{
		UserId:          userId,
		PlanId:          plan.Id,
		Money:           plan.PriceAmount,
		TradeNo:         referenceId,
		PaymentMethod:   model.PaymentMethodStripe,
		PaymentProvider: model.PaymentProviderStripe,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := order.Insert(); err != nil {
		paymentError(c, common.NewMessage("Failed to create order"))
		return
	}

	payLink, providerAmount, providerCurrency, err := genStripeSubscriptionLink(referenceId, user.StripeCustomer, user.Email, plan.StripePriceId)
	if err != nil {
		order.Status = common.TopUpStatusFailed
		if updateErr := order.Update(); updateErr != nil {
			logger.LogError(c.Request.Context(), common.LogText("Stripe failed to mark subscription order as failed trade_no=%s error=%q", referenceId, updateErr.Error()))
		}
		logger.LogError(c.Request.Context(), common.LogText("Stripe failed to create subscription payment link trade_no=%s plan_id=%d error=%q", referenceId, plan.Id, err.Error()))
		paymentError(c, common.NewMessage("Failed to start payment"))
		return
	}

	expectedCurrency := subscriptionPlanCurrency(plan)
	if !stripeSubscriptionPriceMatchesLocalOrder(providerAmount, providerCurrency, plan.PriceAmount, expectedCurrency) {
		order.Status = common.TopUpStatusFailed
		if updateErr := order.Update(); updateErr != nil {
			logger.LogError(c.Request.Context(), common.LogText("Stripe failed to mark mismatched subscription order as failed trade_no=%s error=%q", referenceId, updateErr.Error()))
		}
		logger.LogWarn(c.Request.Context(), common.LogText("Stripe subscription price mismatch trade_no=%s plan_id=%d provider_amount=%d provider_currency=%s expected_currency=%s", referenceId, plan.Id, providerAmount, providerCurrency, expectedCurrency))
		paymentError(c, common.NewMessage("Stripe price does not match the configured subscription plan price"))
		return
	}

	order.ProviderAmount = providerAmount
	order.ProviderCurrency = strings.ToLower(providerCurrency)
	if err := order.Update(); err != nil {
		order.Status = common.TopUpStatusFailed
		if updateErr := order.Update(); updateErr != nil {
			logger.LogError(c.Request.Context(), common.LogText("Stripe failed to persist subscription checkout snapshot and mark order as failed trade_no=%s error=%q", referenceId, updateErr.Error()))
		}
		logger.LogError(c.Request.Context(), common.LogText("Stripe failed to persist subscription checkout snapshot trade_no=%s error=%q", referenceId, err.Error()))
		paymentError(c, common.NewMessage("Failed to create order"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"pay_link": payLink,
		},
	})
}

// stripeSubscriptionPriceMatchesLocalOrder prevents a misconfigured Stripe Price ID
// from silently charging a different amount or currency than the plan shown to users.
func stripeSubscriptionPriceMatchesLocalOrder(providerAmount int64, providerCurrency string, expectedMoney float64, expectedCurrency string) bool {
	providerCurrency = strings.TrimSpace(providerCurrency)
	expectedCurrency = strings.TrimSpace(expectedCurrency)
	if providerCurrency == "" || expectedCurrency == "" ||
		!strings.EqualFold(providerCurrency, expectedCurrency) {
		return false
	}
	// Stripe reports amounts in the currency's smallest unit, whose scale
	// depends on the ISO 4217 exponent (e.g. JPY has none, KWD has three).
	// Converting with a hard-coded factor of 100 would reject every plan in
	// a non-two-decimal currency.
	expectedAmount, ok := expectedMinorUnits(expectedMoney, expectedCurrency)
	if !ok || providerAmount != expectedAmount {
		return false
	}
	return true
}

func genStripeSubscriptionLink(referenceId string, customerId string, email string, priceId string) (string, int64, string, error) {
	stripe.Key = setting.StripeApiSecret

	params := &stripe.CheckoutSessionParams{
		ClientReferenceID: stripe.String(referenceId),
		SuccessURL:        stripe.String(paymentReturnPath("/wallet")),
		CancelURL:         stripe.String(paymentReturnPath("/wallet")),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Price:    stripe.String(priceId),
				Quantity: stripe.Int64(1),
			},
		},
		Mode: stripe.String(string(stripe.CheckoutSessionModeSubscription)),
	}

	if "" == customerId {
		if "" != email {
			params.CustomerEmail = stripe.String(email)
		}
		params.CustomerCreation = stripe.String(string(stripe.CheckoutSessionCustomerCreationAlways))
	} else {
		params.Customer = stripe.String(customerId)
	}

	result, err := session.New(params)
	if err != nil {
		return "", 0, "", err
	}
	if result.AmountSubtotal <= 0 || strings.TrimSpace(string(result.Currency)) == "" {
		return "", 0, "", fmt.Errorf("Stripe Checkout did not return a valid price snapshot")
	}
	return result.URL, result.AmountSubtotal, string(result.Currency), nil
}
