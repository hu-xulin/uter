package controller

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/logger"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting"
	"github.com/uter-ai/uter/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/checkout/session"
	stripeprice "github.com/stripe/stripe-go/v81/price"
	"github.com/stripe/stripe-go/v81/webhook"
	"github.com/thanhpk/randstr"
	"gorm.io/gorm"
)

var stripeAdaptor = &StripeAdaptor{}

var errStripeWebhookRejected = errors.New("stripe webhook event rejected")

func stripeWebhookNeedsRetry(err error) bool {
	return err != nil && !errors.Is(err, errStripeWebhookRejected)
}

// StripePayRequest represents a payment request for Stripe checkout.
type StripePayRequest struct {
	// Amount is the quantity of units to purchase.
	Amount float64 `json:"amount"`
	// PaymentMethod specifies the payment method (e.g., "stripe").
	PaymentMethod string `json:"payment_method"`
	// SuccessURL is the optional custom URL to redirect after successful payment.
	// If empty, defaults to the server's console log page.
	SuccessURL string `json:"success_url,omitempty"`
	// CancelURL is the optional custom URL to redirect when payment is canceled.
	// If empty, defaults to the server's console topup page.
	CancelURL string `json:"cancel_url,omitempty"`
}

type StripeAdaptor struct {
}

func (*StripeAdaptor) RequestAmount(c *gin.Context, req *StripePayRequest) {
	if rejectInvalidTopUpAmount(c, req.Amount) {
		return
	}
	amount := stripeNormalizeAmount(req.Amount)
	if amount < getStripeMinTopup() {
		paymentError(c, common.NewMessage("Top-up amount cannot be less than {{min}}", map[string]any{"min": getStripeMinTopup()}))
		return
	}
	if amount > 10000 {
		paymentError(c, common.NewMessage("Top-up amount cannot exceed {{max}}", map[string]any{"max": 10000}))
		return
	}
	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		paymentError(c, common.NewMessage("Failed to get the user group"))
		return
	}
	if rejectInvalidCreditedQuota(c, id, getStripeCreditedQuota(amount, group)) {
		return
	}
	payMoney := getStripePayMoney(amount, group)
	if payMoney <= 0.01 {
		paymentError(c, common.NewMessage("Payment amount is too low"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": strconv.FormatFloat(payMoney, 'f', 2, 64)})
}

func (*StripeAdaptor) RequestPay(c *gin.Context, req *StripePayRequest) {
	if !isStripeTopUpEnabled() {
		paymentError(c, common.NewMessage("Stripe payment is not enabled or configured"))
		return
	}
	if req.PaymentMethod != model.PaymentMethodStripe {
		paymentError(c, common.NewMessage("Unsupported payment channel"))
		return
	}
	if rejectInvalidTopUpAmount(c, req.Amount) {
		return
	}
	amount := stripeNormalizeAmount(req.Amount)
	if amount < getStripeMinTopup() {
		common.ApiErrorStatus(c, http.StatusOK, common.NewMessage("Top-up amount cannot be less than {{min}}", map[string]any{"min": getStripeMinTopup()}), gin.H{"data": 10})
		return
	}
	if amount > 10000 {
		common.ApiErrorStatus(c, http.StatusOK, common.NewMessage("Top-up amount cannot exceed {{max}}", map[string]any{"max": 10000}), gin.H{"data": 10})
		return
	}

	if req.SuccessURL != "" && common.ValidateRedirectURL(req.SuccessURL) != nil {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Payment success redirect URL is not in the trusted domain list"), gin.H{"data": ""})
		return
	}

	if req.CancelURL != "" && common.ValidateRedirectURL(req.CancelURL) != nil {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Payment cancel redirect URL is not in the trusted domain list"), gin.H{"data": ""})
		return
	}

	id := c.GetInt("id")
	user, err := model.GetUserById(id, false)
	if err != nil || user == nil {
		paymentError(c, common.NewMessage("User does not exist"))
		return
	}
	chargedMoney := GetChargedAmount(amount, *user)
	if rejectInvalidCreditedQuota(c, id,
		decimal.NewFromFloat(chargedMoney).Mul(decimal.NewFromFloat(common.QuotaPerUnit)),
	) {
		return
	}
	// Use the same amount calculation for the displayed quote and the actual
	// Checkout line item. A static Stripe Price multiplied by raw token quantity
	// ignores unit-price conversion, group ratios, and local amount discounts.
	payMoney := getStripePayMoney(amount, user.Group)
	if payMoney <= 0.01 {
		paymentError(c, common.NewMessage("Payment amount is too low"))
		return
	}

	reference := fmt.Sprintf("new-api-ref-%d-%d-%s", user.Id, time.Now().UnixMilli(), randstr.String(4))
	referenceId := "ref_" + common.Sha1([]byte(reference))

	topUp := &model.TopUp{
		UserId:          id,
		Amount:          amount,
		Money:           chargedMoney,
		TradeNo:         referenceId,
		PaymentMethod:   model.PaymentMethodStripe,
		PaymentProvider: model.PaymentProviderStripe,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), common.LogText("Stripe failed to create top-up order user_id=%d trade_no=%s amount=%.2f error=%q", id, referenceId, req.Amount, err.Error()))
		paymentError(c, common.NewMessage("Failed to create order"))
		return
	}

	payLink, providerAmount, providerCurrency, err := genStripeLink(referenceId, user.StripeCustomer, user.Email, payMoney, req.SuccessURL, req.CancelURL)
	if err != nil {
		topUp.Status = common.TopUpStatusFailed
		if updateErr := topUp.Update(); updateErr != nil {
			logger.LogError(c.Request.Context(), common.LogText("Stripe failed to mark top-up order as failed trade_no=%s error=%q", referenceId, updateErr.Error()))
		}
		logger.LogError(c.Request.Context(), common.LogText("Stripe failed to create Checkout Session user_id=%d trade_no=%s amount=%.2f error=%q", id, referenceId, req.Amount, err.Error()))
		paymentError(c, common.NewMessage("Failed to start payment"))
		return
	}

	// Store the provider-side amount/currency snapshot before returning the URL.
	// Clients cannot pay this session until the URL is returned, so the webhook
	// can never observe an exposed checkout session without its local order snapshot.
	topUp.ProviderAmount = providerAmount
	topUp.ProviderCurrency = strings.ToLower(providerCurrency)
	if err := topUp.Update(); err != nil {
		topUp.Status = common.TopUpStatusFailed
		if updateErr := topUp.Update(); updateErr != nil {
			logger.LogError(c.Request.Context(), common.LogText("Stripe failed to persist checkout snapshot and mark order as failed trade_no=%s error=%q", referenceId, updateErr.Error()))
		}
		logger.LogError(c.Request.Context(), common.LogText("Stripe failed to persist checkout snapshot trade_no=%s error=%q", referenceId, err.Error()))
		paymentError(c, common.NewMessage("Failed to create order"))
		return
	}
	logger.LogInfo(c.Request.Context(), common.LogText("Stripe top-up order created user_id=%d trade_no=%s amount=%.2f money=%.2f", id, referenceId, req.Amount, chargedMoney))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"pay_link": payLink,
		},
	})
}

func RequestStripeAmount(c *gin.Context) {
	var req StripePayRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		paymentError(c, common.NewMessage("Invalid parameters"))
		return
	}
	stripeAdaptor.RequestAmount(c, &req)
}

func RequestStripePay(c *gin.Context) {
	var req StripePayRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		paymentError(c, common.NewMessage("Invalid parameters"))
		return
	}
	stripeAdaptor.RequestPay(c, &req)
}

func StripeWebhook(c *gin.Context) {
	ctx := c.Request.Context()
	if !isStripeWebhookEnabled() {
		logger.LogWarn(ctx, common.LogText("Stripe webhook rejected reason=webhook_disabled path=%q client_ip=%s", c.Request.URL.Path, c.ClientIP()))
		c.AbortWithStatus(http.StatusForbidden)
		return
	}

	payload, err := readPaymentWebhookBody(c.Request.Body)
	if err != nil {
		if errors.Is(err, errPaymentWebhookBodyTooLarge) {
			c.AbortWithStatus(http.StatusRequestEntityTooLarge)
			return
		}
		logger.LogError(ctx, common.LogText("Stripe webhook failed to read request body path=%q client_ip=%s error=%q", c.Request.URL.Path, c.ClientIP(), err.Error()))
		c.AbortWithStatus(http.StatusServiceUnavailable)
		return
	}

	signature := c.GetHeader("Stripe-Signature")
	logger.LogInfo(ctx, common.LogText("Stripe webhook received request path=%q client_ip=%s body_bytes=%d", c.Request.URL.Path, c.ClientIP(), len(payload)))
	event, err := webhook.ConstructEventWithOptions(payload, signature, setting.StripeWebhookSecret, webhook.ConstructEventOptions{
		IgnoreAPIVersionMismatch: true,
	})
	if err != nil {
		logger.LogWarn(ctx, common.LogText("Stripe webhook signature verification failed path=%q client_ip=%s error=%q", c.Request.URL.Path, c.ClientIP(), err.Error()))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	callerIp := c.ClientIP()
	logger.LogInfo(ctx, common.LogText("Stripe webhook signature verified event_type=%s client_ip=%s path=%q", string(event.Type), callerIp, c.Request.URL.Path))
	var processingErr error
	switch event.Type {
	case stripe.EventTypeCheckoutSessionCompleted:
		processingErr = sessionCompleted(ctx, event, callerIp)
	case stripe.EventTypeCheckoutSessionExpired:
		processingErr = sessionExpired(ctx, event)
	case stripe.EventTypeCheckoutSessionAsyncPaymentSucceeded:
		processingErr = sessionAsyncPaymentSucceeded(ctx, event, callerIp)
	case stripe.EventTypeCheckoutSessionAsyncPaymentFailed:
		processingErr = sessionAsyncPaymentFailed(ctx, event, callerIp)
	default:
		logger.LogInfo(ctx, common.LogText("Stripe webhook ignored event event_type=%s client_ip=%s", string(event.Type), callerIp))
	}

	if processingErr != nil {
		if stripeWebhookNeedsRetry(processingErr) {
			logger.LogError(ctx, common.LogText("Stripe webhook processing failed and will be retried event_type=%s client_ip=%s error=%q", string(event.Type), callerIp, processingErr.Error()))
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		logger.LogWarn(ctx, common.LogText("Stripe webhook event was rejected permanently event_type=%s client_ip=%s error=%q", string(event.Type), callerIp, processingErr.Error()))
	}
	// A 2xx is returned only after successful/idempotent processing, ignored events,
	// or explicit permanent rejection. Transient storage/credit failures must yield 5xx.
	c.Status(http.StatusOK)
}

func sessionCompleted(ctx context.Context, event stripe.Event, callerIp string) error {
	customerId := event.GetObjectValue("customer")
	referenceId := event.GetObjectValue("client_reference_id")
	status := event.GetObjectValue("status")
	if status != "complete" {
		logger.LogWarn(ctx, common.LogText("Stripe checkout.completed has unexpected status, ignored trade_no=%s status=%s client_ip=%s", referenceId, status, callerIp))
		return nil
	}

	paymentStatus := event.GetObjectValue("payment_status")
	if paymentStatus != "paid" {
		logger.LogInfo(ctx, common.LogText("Stripe Checkout payment not completed, waiting for async result trade_no=%s payment_status=%s client_ip=%s", referenceId, paymentStatus, callerIp))
		return nil
	}
	return fulfillOrder(ctx, event, referenceId, customerId, callerIp)
}

// sessionAsyncPaymentSucceeded handles delayed payment methods (bank transfer, SEPA, etc.)
// that confirm payment after the checkout session completes.
func sessionAsyncPaymentSucceeded(ctx context.Context, event stripe.Event, callerIp string) error {
	customerId := event.GetObjectValue("customer")
	referenceId := event.GetObjectValue("client_reference_id")
	logger.LogInfo(ctx, common.LogText("Stripe async payment succeeded trade_no=%s client_ip=%s", referenceId, callerIp))
	return fulfillOrder(ctx, event, referenceId, customerId, callerIp)
}

// sessionAsyncPaymentFailed marks orders as failed when delayed payment methods
// ultimately fail (e.g. bank transfer not received, SEPA rejected).
func sessionAsyncPaymentFailed(ctx context.Context, event stripe.Event, callerIp string) error {
	referenceId := event.GetObjectValue("client_reference_id")
	logger.LogWarn(ctx, common.LogText("Stripe async payment failed trade_no=%s client_ip=%s", referenceId, callerIp))
	if referenceId == "" {
		logger.LogWarn(ctx, common.LogText("Stripe async payment failed event missing order number client_ip=%s", callerIp))
		return errStripeWebhookRejected
	}

	LockOrder(referenceId)
	defer UnlockOrder(referenceId)

	// Checkout can be used for delayed payment methods for both one-time top-ups
	// and subscription checkout sessions. Resolve subscriptions first so an
	// async_payment_failed event cannot leave a subscription order pending forever.
	subscriptionErr := model.FailPendingSubscriptionOrder(referenceId, model.PaymentProviderStripe)
	switch {
	case subscriptionErr == nil:
		logger.LogInfo(ctx, common.LogText("Stripe subscription order marked as failed trade_no=%s client_ip=%s", referenceId, callerIp))
		return nil
	case errors.Is(subscriptionErr, model.ErrSubscriptionOrderNotFound):
		// Not a subscription order; continue with wallet top-up settlement below.
	case errors.Is(subscriptionErr, model.ErrPaymentMethodMismatch):
		logger.LogWarn(ctx, common.LogText("Stripe async payment failed but subscription gateway mismatched trade_no=%s client_ip=%s", referenceId, callerIp))
		return errStripeWebhookRejected
	default:
		logger.LogError(ctx, common.LogText("Stripe failed to mark subscription order as failed trade_no=%s client_ip=%s error=%q", referenceId, callerIp, subscriptionErr.Error()))
		return subscriptionErr
	}

	err := model.UpdatePendingTopUpStatus(referenceId, model.PaymentProviderStripe, common.TopUpStatusFailed)
	switch {
	case errors.Is(err, model.ErrTopUpNotFound):
		logger.LogWarn(ctx, common.LogText("Stripe async payment failed but local order not found trade_no=%s client_ip=%s", referenceId, callerIp))
		return errStripeWebhookRejected
	case errors.Is(err, model.ErrPaymentMethodMismatch):
		logger.LogWarn(ctx, common.LogText("Stripe async payment failed but order payment gateway mismatch trade_no=%s client_ip=%s", referenceId, callerIp))
		return errStripeWebhookRejected
	case errors.Is(err, model.ErrTopUpStatusInvalid):
		logger.LogInfo(ctx, common.LogText("Stripe async payment failed but order state already changed, ignored trade_no=%s client_ip=%s", referenceId, callerIp))
		return nil
	case err != nil:
		logger.LogError(ctx, common.LogText("Stripe failed to mark top-up order as failed trade_no=%s client_ip=%s error=%q", referenceId, callerIp, err.Error()))
		return err
	}
	logger.LogInfo(ctx, common.LogText("Stripe top-up order marked as failed trade_no=%s client_ip=%s", referenceId, callerIp))
	return nil
}

// fulfillOrder is the shared logic for crediting quota after payment is confirmed.
// stripeCheckoutSubtotalMatchesOrder compares the signed webhook's pre-discount checkout
// subtotal and currency with the snapshot returned when our Checkout Session was created.
// Local Money fields are quota/accounting values, not Stripe cash amounts.
func stripeCheckoutSubtotalMatchesOrder(subtotal, currency string, expectedAmount int64, expectedCurrency string) bool {
	if expectedAmount <= 0 || strings.TrimSpace(expectedCurrency) == "" {
		return false
	}
	actual, err := strconv.ParseInt(strings.TrimSpace(subtotal), 10, 64)
	if err != nil || actual <= 0 {
		return false
	}
	return actual == expectedAmount &&
		strings.EqualFold(strings.TrimSpace(currency), strings.TrimSpace(expectedCurrency))
}

// stripeCheckoutTotalIsPayable rejects missing or zero-value Checkout Sessions while
// preserving the explicitly configured promotion-code feature. The subtotal snapshot
// and currency are checked separately; a discount may reduce total below subtotal, but
// a zero-cost session must never grant quota or a subscription.
func stripeCheckoutTotalIsPayable(total, currency string, expectedAmount int64, expectedCurrency string) bool {
	if expectedAmount <= 0 || strings.TrimSpace(expectedCurrency) == "" ||
		!strings.EqualFold(strings.TrimSpace(currency), strings.TrimSpace(expectedCurrency)) {
		return false
	}
	actual, err := strconv.ParseInt(strings.TrimSpace(total), 10, 64)
	return err == nil && actual > 0
}

func fulfillOrder(ctx context.Context, event stripe.Event, referenceId string, customerId string, callerIp string) error {
	if referenceId == "" {
		logger.LogWarn(ctx, common.LogText("Stripe order completion missing order number client_ip=%s", callerIp))
		return errStripeWebhookRejected
	}

	LockOrder(referenceId)
	defer UnlockOrder(referenceId)
	amountSubtotal := event.GetObjectValue("amount_subtotal")
	amountTotal := event.GetObjectValue("amount_total")
	currency := strings.ToLower(strings.TrimSpace(event.GetObjectValue("currency")))
	payload := map[string]any{
		"customer":        customerId,
		"amount_subtotal": amountSubtotal,
		"amount_total":    amountTotal,
		"currency":        currency,
		"event_type":      string(event.Type),
	}

	// Get errors instead of using nil-returning convenience lookups, which collapse
	// database outages and genuinely missing orders into the same result.
	var subscriptionOrder model.SubscriptionOrder
	subErr := model.DB.Where("trade_no = ?", referenceId).First(&subscriptionOrder).Error
	if subErr == nil {
		if subscriptionOrder.PaymentProvider != model.PaymentProviderStripe ||
			!stripeCheckoutSubtotalMatchesOrder(amountSubtotal, currency, subscriptionOrder.ProviderAmount, subscriptionOrder.ProviderCurrency) ||
			!stripeCheckoutTotalIsPayable(amountTotal, currency, subscriptionOrder.ProviderAmount, subscriptionOrder.ProviderCurrency) {
			logger.LogError(ctx, common.LogText("Stripe subscription callback checkout snapshot/order mismatch trade_no=%s currency=%s", referenceId, currency))
			return errStripeWebhookRejected
		}
		if err := model.CompleteSubscriptionOrder(referenceId, common.GetJsonString(payload), model.PaymentProviderStripe, ""); err != nil {
			if errors.Is(err, model.ErrSubscriptionOrderNotFound) ||
				errors.Is(err, model.ErrSubscriptionOrderStatusInvalid) ||
				errors.Is(err, model.ErrPaymentMethodMismatch) {
				logger.LogError(ctx, common.LogText("Stripe subscription order is not completable trade_no=%s error=%q", referenceId, err.Error()))
				return errStripeWebhookRejected
			}
			logger.LogError(ctx, common.LogText("Stripe subscription order processing failed trade_no=%s event_type=%s client_ip=%s error=%q", referenceId, string(event.Type), callerIp, err.Error()))
			return err
		}
		logger.LogInfo(ctx, common.LogText("Stripe subscription order processed trade_no=%s event_type=%s client_ip=%s", referenceId, string(event.Type), callerIp))
		return nil
	}
	if !errors.Is(subErr, gorm.ErrRecordNotFound) {
		return subErr
	}

	var topUp model.TopUp
	topUpErr := model.DB.Where("trade_no = ?", referenceId).First(&topUp).Error
	if errors.Is(topUpErr, gorm.ErrRecordNotFound) {
		logger.LogWarn(ctx, common.LogText("Stripe checkout callback has no matching local order trade_no=%s", referenceId))
		return errStripeWebhookRejected
	}
	if topUpErr != nil {
		return topUpErr
	}
	if topUp.PaymentProvider != model.PaymentProviderStripe ||
		!stripeCheckoutSubtotalMatchesOrder(amountSubtotal, currency, topUp.ProviderAmount, topUp.ProviderCurrency) ||
		!stripeCheckoutTotalIsPayable(amountTotal, currency, topUp.ProviderAmount, topUp.ProviderCurrency) {
		logger.LogError(ctx, common.LogText("Stripe top-up callback checkout snapshot/order mismatch trade_no=%s currency=%s", referenceId, currency))
		return errStripeWebhookRejected
	}
	if topUp.Status != common.TopUpStatusPending && topUp.Status != common.TopUpStatusSuccess {
		logger.LogError(ctx, common.LogText("Stripe top-up order is not payable trade_no=%s status=%s", referenceId, topUp.Status))
		return errStripeWebhookRejected
	}

	err := model.Recharge(referenceId, customerId, callerIp)
	if err != nil {
		logger.LogError(ctx, common.LogText("Stripe top-up processing failed trade_no=%s event_type=%s client_ip=%s error=%q", referenceId, string(event.Type), callerIp, err.Error()))
		return err
	}

	logger.LogInfo(ctx, common.LogText("Stripe top-up succeeded trade_no=%s currency=%s event_type=%s client_ip=%s", referenceId, currency, string(event.Type), callerIp))
	return nil
}

func sessionExpired(ctx context.Context, event stripe.Event) error {
	referenceId := event.GetObjectValue("client_reference_id")
	status := event.GetObjectValue("status")
	if status != "expired" {
		logger.LogWarn(ctx, common.LogText("Stripe checkout.expired has unexpected status, ignored trade_no=%s status=%s", referenceId, status))
		return nil
	}
	if referenceId == "" {
		logger.LogWarn(ctx, common.LogText("Stripe checkout.expired missing order number"))
		return errStripeWebhookRejected
	}

	LockOrder(referenceId)
	defer UnlockOrder(referenceId)
	if err := model.ExpireSubscriptionOrder(referenceId, model.PaymentProviderStripe); err == nil {
		logger.LogInfo(ctx, common.LogText("Stripe subscription order expired trade_no=%s", referenceId))
		return nil
	} else if !errors.Is(err, model.ErrSubscriptionOrderNotFound) {
		if errors.Is(err, model.ErrPaymentMethodMismatch) {
			logger.LogWarn(ctx, common.LogText("Stripe subscription expiry provider mismatch trade_no=%s", referenceId))
			return errStripeWebhookRejected
		}
		logger.LogError(ctx, common.LogText("Stripe subscription order expiry processing failed trade_no=%s error=%q", referenceId, err.Error()))
		return err
	}

	err := model.UpdatePendingTopUpStatus(referenceId, model.PaymentProviderStripe, common.TopUpStatusExpired)
	switch {
	case errors.Is(err, model.ErrTopUpNotFound):
		logger.LogWarn(ctx, common.LogText("Stripe top-up order not found, cannot mark as expired trade_no=%s", referenceId))
		return errStripeWebhookRejected
	case errors.Is(err, model.ErrPaymentMethodMismatch):
		logger.LogWarn(ctx, common.LogText("Stripe top-up expiry provider mismatch trade_no=%s", referenceId))
		return errStripeWebhookRejected
	case errors.Is(err, model.ErrTopUpStatusInvalid):
		logger.LogInfo(ctx, common.LogText("Stripe top-up order expiry ignored because status already changed trade_no=%s", referenceId))
		return nil
	case err != nil:
		logger.LogError(ctx, common.LogText("Stripe top-up order expiry processing failed trade_no=%s error=%q", referenceId, err.Error()))
		return err
	}
	logger.LogInfo(ctx, common.LogText("Stripe top-up order expired trade_no=%s", referenceId))
	return nil
}

// genStripeLink generates a Stripe Checkout session URL for payment.
// It creates a new checkout session with the specified parameters and returns the payment URL.
//
// Parameters:
//   - referenceId: unique reference identifier for the transaction
//   - customerId: existing Stripe customer ID (empty string if new customer)
//   - email: customer email address for new customer creation
//   - amount: quantity of units to purchase
//   - successURL: custom URL to redirect after successful payment (empty for default)
//   - cancelURL: custom URL to redirect when payment is canceled (empty for default)
//
// Returns the checkout session URL or an error if the session creation fails.
// stripeCheckoutCurrency is the currency used by the console's payment quote.
func stripeCheckoutCurrency() string {
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeCNY {
		return "cny"
	}
	return "usd"
}

// stripeMoneyToMinorUnits converts the quoted major-unit amount into the
// smallest currency unit Stripe expects.
//
// F-18: this used to hardcode ×100, which is only correct for two-decimal
// currencies. Stripe's contract is "smallest currency unit", and that unit is
// not always 1/100 — JPY/KRW have no minor unit, KWD/BHD use 1/1000. Today
// stripeCheckoutCurrency only returns usd/cny, so nothing is wrong yet, but the
// coupling was invisible: adding a zero-decimal currency there would have
// silently charged 100×. Deriving the scale from the currency keeps the two in
// sync by construction.
func stripeMoneyToMinorUnits(amount float64, currency string) (int64, error) {
	if amount <= 0 || math.IsNaN(amount) || math.IsInf(amount, 0) {
		return 0, errors.New("invalid Stripe checkout amount")
	}
	exponent, ok := currencyMinorUnitExponent(currency)
	if !ok {
		return 0, errors.New("invalid Stripe checkout currency")
	}
	// The console quotes every price with two decimals, so round there first —
	// but never coarser than the currency's own unit, or a three-decimal
	// currency would lose its last digit (1.234 KWD -> 1.23 -> 1230).
	// Rounding before scaling also keeps float noise (9.999999999) from being
	// rejected as "too precise"; amounts genuinely finer than the currency's
	// unit still fail the integrality check below.
	decimals := max(2, exponent)
	formatted := strconv.FormatFloat(amount, 'f', decimals, 64)
	rounded, err := decimal.NewFromString(formatted)
	if err != nil {
		return 0, fmt.Errorf("invalid Stripe checkout amount: %w", err)
	}
	scale := decimal.NewFromInt(1)
	for range exponent {
		scale = scale.Mul(decimal.NewFromInt(10))
	}
	minor := rounded.Mul(scale)
	if !minor.Equal(minor.Truncate(0)) || !minor.BigInt().IsInt64() || minor.Sign() <= 0 {
		return 0, errors.New("Stripe checkout amount is outside the supported range")
	}
	return minor.IntPart(), nil
}

func genStripeLink(referenceId string, customerId string, email string, payMoney float64, successURL string, cancelURL string) (string, int64, string, error) {
	if !strings.HasPrefix(setting.StripeApiSecret, "sk_") && !strings.HasPrefix(setting.StripeApiSecret, "rk_") {
		return "", 0, "", errors.New("invalid Stripe API key")
	}
	if strings.TrimSpace(setting.StripePriceId) == "" {
		return "", 0, "", errors.New("Stripe product price is not configured")
	}
	// 币种必须先确定：Stripe 的 amount 是最小货币单位，而最小单位随币种变化
	// （见 stripeMoneyToMinorUnits 的 F-18 说明）。
	currency := stripeCheckoutCurrency()
	unitAmount, err := stripeMoneyToMinorUnits(payMoney, currency)
	if err != nil {
		return "", 0, "", err
	}

	stripe.Key = setting.StripeApiSecret
	// StripePriceId identifies the configured Stripe product. Its fixed unit
	// amount cannot be reused directly because the user's display currency,
	// token-unit conversion, group ratio, and local discount all affect the
	// quoted amount. PriceData carries the exact amount computed above.
	configuredPrice, err := stripeprice.Get(setting.StripePriceId, nil)
	if err != nil {
		return "", 0, "", fmt.Errorf("failed to load configured Stripe price: %w", err)
	}
	if configuredPrice == nil || !configuredPrice.Active || configuredPrice.Product == nil ||
		strings.TrimSpace(configuredPrice.Product.ID) == "" || configuredPrice.Recurring != nil {
		return "", 0, "", errors.New("StripePriceId must reference an active one-time price with a valid product")
	}

	// Use custom URLs if provided, otherwise use defaults
	if successURL == "" {
		successURL = paymentReturnPath("/usage-logs")
	}
	if cancelURL == "" {
		cancelURL = paymentReturnPath("/wallet")
	}

	params := &stripe.CheckoutSessionParams{
		ClientReferenceID: stripe.String(referenceId),
		SuccessURL:        stripe.String(successURL),
		CancelURL:         stripe.String(cancelURL),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				PriceData: &stripe.CheckoutSessionLineItemPriceDataParams{
					Currency:   stripe.String(currency),
					Product:    stripe.String(configuredPrice.Product.ID),
					UnitAmount: stripe.Int64(unitAmount),
				},
				Quantity: stripe.Int64(1),
			},
		},
		Mode:                stripe.String(string(stripe.CheckoutSessionModePayment)),
		AllowPromotionCodes: stripe.Bool(setting.StripePromotionCodesEnabled),
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
		return "", 0, "", errors.New("Stripe Checkout did not return a valid price snapshot")
	}
	if result.AmountSubtotal != unitAmount || !strings.EqualFold(string(result.Currency), currency) {
		return "", 0, "", errors.New("Stripe Checkout amount/currency differs from the quoted amount")
	}
	return result.URL, result.AmountSubtotal, string(result.Currency), nil
}

func GetChargedAmount(count float64, user model.User) float64 {
	topUpGroupRatio := common.GetTopupGroupRatio(user.Group)
	if topUpGroupRatio == 0 {
		topUpGroupRatio = 1
	}

	return count * topUpGroupRatio
}

func getStripeCreditedQuota(amount float64, group string) decimal.Decimal {
	topUpGroupRatio := common.GetTopupGroupRatio(group)
	if topUpGroupRatio == 0 {
		topUpGroupRatio = 1
	}
	return decimal.NewFromFloat(amount).
		Mul(decimal.NewFromFloat(topUpGroupRatio)).
		Mul(decimal.NewFromFloat(common.QuotaPerUnit))
}

// stripeNormalizeAmount 把展示金额归一化成「美元单元」：
// TOKENS 展示模式下前端传 token 数，须按 IntPart(amount/QuotaPerUnit) 取整——
// 与入账口径（getTopUpQuota / Recharge 的 Money×QuotaPerUnit）对齐。历史上
// 这里用精确商或干脆不换算，导致 Stripe 在 TOKENS 模式下 min/max 语义崩坏
// （min=5,000,000 tokens > max=10,000 永远拒绝）且条件性巨额超充
// （Money=token 数被当成美元数再乘 QuotaPerUnit）。
func stripeNormalizeAmount(amount float64) float64 {
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		return float64(decimal.NewFromFloat(amount).
			Div(decimal.NewFromFloat(common.QuotaPerUnit)).IntPart())
	}
	return amount
}

func getStripePayMoney(amount float64, group string) float64 {
	// 入参必须是 stripeNormalizeAmount 归一化后的美元单元；此处不再自行
	// 做 TOKENS 换算，避免二次除法把 1.0 单元又除成 0.000002。
	originalAmount := amount
	topupGroupRatio := common.GetTopupGroupRatio(group)
	if topupGroupRatio == 0 {
		topupGroupRatio = 1
	}
	// apply optional preset discount by the original request amount (if configured), default 1.0
	discount := 1.0
	if ds, ok := operation_setting.GetPaymentSetting().AmountDiscount[int(originalAmount)]; ok {
		if ds > 0 {
			discount = ds
		}
	}
	payMoney := amount * setting.StripeUnitPrice * topupGroupRatio * discount
	return payMoney
}

func getStripeMinTopup() float64 {
	// 调用方传入的金额已归一化为美元单元，min 直接用美元域配置值；
	// 不得再乘 QuotaPerUnit（那是为旧的「拿原始 token 数比较」准备的补偿，
	// 会让 min 恒大于 max，Stripe 在 TOKENS 模式下整体不可用）。
	return setting.StripeMinTopUp
}
