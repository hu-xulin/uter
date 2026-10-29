package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/thanhpk/randstr"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/logger"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
	"github.com/uter-ai/uter/setting"
	"github.com/uter-ai/uter/setting/operation_setting"
	waffo "github.com/waffo-com/waffo-go"
	"github.com/waffo-com/waffo-go/config"
	"github.com/waffo-com/waffo-go/core"
	"github.com/waffo-com/waffo-go/types/order"
)

func getWaffoSDK() (*waffo.Waffo, error) {
	env := config.Sandbox
	apiKey := setting.WaffoSandboxApiKey
	privateKey := setting.WaffoSandboxPrivateKey
	publicKey := setting.WaffoSandboxPublicCert
	if !setting.WaffoSandbox {
		env = config.Production
		apiKey = setting.WaffoApiKey
		privateKey = setting.WaffoPrivateKey
		publicKey = setting.WaffoPublicCert
	}
	// The SDK only speaks bare Base64 DER, while operators configure key
	// material as files. Normalizing here lets the settings accept a PEM file
	// (PKCS#8 / PKCS#1 / the certificate Waffo issues) and keeps existing
	// Base64-only configurations working unchanged.
	normalizedPrivateKey, err := service.NormalizeWaffoPrivateKey(privateKey)
	if err != nil {
		return nil, err
	}
	normalizedPublicKey, err := service.NormalizeWaffoPublicKey(publicKey)
	if err != nil {
		return nil, err
	}
	builder := config.NewConfigBuilder().
		APIKey(apiKey).
		PrivateKey(normalizedPrivateKey).
		WaffoPublicKey(normalizedPublicKey).
		Environment(env)
	if setting.WaffoMerchantId != "" {
		builder = builder.MerchantID(setting.WaffoMerchantId)
	}
	cfg, err := builder.Build()
	if err != nil {
		return nil, err
	}
	return waffo.New(cfg), nil
}

func getWaffoUserEmail(user *model.User) string {
	return fmt.Sprintf("%d@examples.com", user.Id)
}

func getWaffoCurrency() string {
	if currency := strings.ToUpper(strings.TrimSpace(setting.WaffoCurrency)); currency != "" {
		return currency
	}
	return "USD"
}

// waffoExpectedOrderCurrency prefers the immutable order snapshot, but falls back
// to the configured gateway currency for pending orders created before the
// ProviderCurrency column was introduced. The callback currency must still match
// this value, so a changed gateway currency fails closed rather than guessing.
func waffoExpectedOrderCurrency(snapshotCurrency, configuredCurrency string) string {
	if currency := strings.ToUpper(strings.TrimSpace(snapshotCurrency)); currency != "" {
		return currency
	}
	return strings.ToUpper(strings.TrimSpace(configuredCurrency))
}

func buildWaffoTopUpGoodsInfo(amount float64) *order.GoodsInfo {
	appName := strings.TrimSpace(common.SystemName)
	if appName == "" {
		appName = "New API"
	}
	return &order.GoodsInfo{
		GoodsName: fmt.Sprintf("Recharge %s credits", formatTopUpAmount(amount)),
		AppName:   appName,
	}
}

// zeroDecimalCurrencies 零小数位币种，金额不能带小数点
var zeroDecimalCurrencies = map[string]bool{
	"IDR": true, "JPY": true, "KRW": true, "VND": true,
}

func formatWaffoAmount(amount float64, currency string) string {
	if zeroDecimalCurrencies[currency] {
		return fmt.Sprintf("%.0f", amount)
	}
	return fmt.Sprintf("%.2f", amount)
}

// waffoPaidAmountMatchesOrder deliberately rejects missing or malformed amounts.
// A signed success callback is not sufficient proof that the expected amount was paid.
func waffoPaidAmountMatchesOrder(paidAmount, expectedAmount string) bool {
	paidAmount = strings.TrimSpace(paidAmount)
	if paidAmount == "" {
		return false
	}
	paid, paidErr := decimal.NewFromString(paidAmount)
	expected, expectedErr := decimal.NewFromString(expectedAmount)
	return paidErr == nil && expectedErr == nil && paid.Equal(expected)
}

// getWaffoPayMoney converts the user-facing amount to USD for Waffo payment.
// Waffo only accepts USD, so this function handles the conversion from different
// display types (USD/CNY/TOKENS) to the actual USD amount to charge.
func getWaffoPayMoney(amount float64, group string) float64 {
	originalAmount := amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = amount / common.QuotaPerUnit
	}
	topupGroupRatio := common.GetTopupGroupRatio(group)
	if topupGroupRatio == 0 {
		topupGroupRatio = 1
	}
	discount := 1.0
	if ds, ok := operation_setting.GetPaymentSetting().AmountDiscount[int(originalAmount)]; ok {
		if ds > 0 {
			discount = ds
		}
	}
	return amount * setting.WaffoUnitPrice * topupGroupRatio * discount
}

type WaffoPayRequest struct {
	Amount         float64 `json:"amount"`
	PayMethodIndex *int    `json:"pay_method_index"` // 服务端支付方式列表的索引，nil 表示由 Waffo 自动选择
	PayMethodType  string  `json:"pay_method_type"`  // Deprecated: 兼容旧前端，优先使用 pay_method_index
	PayMethodName  string  `json:"pay_method_name"`  // Deprecated: 兼容旧前端，优先使用 pay_method_index
}

func RequestWaffoAmount(c *gin.Context) {
	var req WaffoPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		paymentError(c, common.NewMessage("Invalid parameters"))
		return
	}

	waffoMinTopup := setting.WaffoMinTopUp
	if req.Amount < waffoMinTopup {
		paymentError(c, common.NewMessage("Top-up amount cannot be less than {{min}}", map[string]any{"min": waffoMinTopup}))
		return
	}
	id := c.GetInt("id")
	if rejectInvalidTopUpQuota(c, id, req.Amount) {
		return
	}

	group, err := model.GetUserGroup(id, true)
	if err != nil {
		paymentError(c, common.NewMessage("Failed to get the user group"))
		return
	}

	payMoney := getWaffoPayMoney(req.Amount, group)
	if payMoney <= 0.01 {
		paymentError(c, common.NewMessage("Payment amount is too low"))
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "success", "data": strconv.FormatFloat(payMoney, 'f', 2, 64)})
}

// persistTopUpFailedStatus records a top-up order as failed. F-08: the previous
// code discarded the persistence error with `_ = topUp.Update()`. A lost write
// here leaves a permanently pending order that the user can never recover from,
// so we surface any persistence failure instead of ignoring it.
func persistTopUpFailedStatus(c *gin.Context, topUp *model.TopUp) {
	if err := topUp.Update(); err != nil {
		logger.LogError(c.Request.Context(), common.LogText("failed to persist top-up failed status trade_no=%s error=%q", topUp.TradeNo, err.Error()))
	}
}

// RequestWaffoPay 创建 Waffo 支付订单
func RequestWaffoPay(c *gin.Context) {
	if !isWaffoTopUpEnabled() {
		paymentError(c, common.NewMessage("Waffo payment is not enabled or configured"))
		return
	}

	var req WaffoPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		paymentError(c, common.NewMessage("Invalid parameters"))
		return
	}
	waffoMinTopup := setting.WaffoMinTopUp
	if req.Amount < waffoMinTopup {
		paymentError(c, common.NewMessage("Top-up amount cannot be less than {{min}}", map[string]any{"min": waffoMinTopup}))
		return
	}
	id := c.GetInt("id")
	if rejectInvalidTopUpQuota(c, id, req.Amount) {
		return
	}

	user, err := model.GetUserById(id, false)
	if err != nil || user == nil {
		paymentError(c, common.NewMessage("User does not exist"))
		return
	}

	// 从服务端配置查找支付方式，客户端只传索引或旧字段
	var resolvedPayMethodType, resolvedPayMethodName string
	methods := setting.GetWaffoPayMethods()
	if req.PayMethodIndex != nil {
		// 新协议：按索引查找
		idx := *req.PayMethodIndex
		if idx < 0 || idx >= len(methods) {
			logger.LogWarn(c.Request.Context(), common.LogText("Waffo invalid payment method index user_id=%d pay_method_index=%d method_count=%d", id, idx, len(methods)))
			paymentError(c, common.NewMessage("Unsupported payment method"))
			return
		}
		resolvedPayMethodType = methods[idx].PayMethodType
		resolvedPayMethodName = methods[idx].PayMethodName
	} else if req.PayMethodType != "" {
		// 兼容旧前端：验证客户端传的值在服务端列表中
		valid := false
		for _, m := range methods {
			if m.PayMethodType == req.PayMethodType && m.PayMethodName == req.PayMethodName {
				valid = true
				resolvedPayMethodType = m.PayMethodType
				resolvedPayMethodName = m.PayMethodName
				break
			}
		}
		if !valid {
			logger.LogWarn(c.Request.Context(), common.LogText("Waffo invalid payment method user_id=%d pay_method_type=%s pay_method_name=%q", id, req.PayMethodType, req.PayMethodName))
			paymentError(c, common.NewMessage("Unsupported payment method"))
			return
		}
	}
	// resolvedPayMethodType/Name 为空时，Waffo 自动选择支付方式

	// F-09: do not fall back to a zero/undefined group on lookup failure. A
	// missing or erroring group must abort the request rather than charging the
	// wrong (default) price tier.
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		logger.LogError(c.Request.Context(), common.LogText("Waffo failed to get user group user_id=%d error=%q", id, err.Error()))
		paymentError(c, common.NewMessage("Failed to get the user group"))
		return
	}
	payMoney := getWaffoPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		paymentError(c, common.NewMessage("Payment amount is too low"))
		return
	}

	// 生成唯一订单号，paymentRequestId 与 merchantOrderId 保持一致，简化追踪
	merchantOrderId := fmt.Sprintf("WAFFO-%d-%d-%s", id, time.Now().UnixMilli(), randstr.String(6))
	paymentRequestId := merchantOrderId

	// Token 模式下归一化 Amount（存等价美元/CNY 数量，避免 RechargeWaffo 双重放大）
	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = max(req.Amount/common.QuotaPerUnit, 1)
	}

	// 创建本地订单
	topUp := &model.TopUp{
		UserId:           id,
		Amount:           amount,
		Money:            payMoney,
		TradeNo:          merchantOrderId,
		PaymentMethod:    model.PaymentMethodWaffo,
		PaymentProvider:  model.PaymentProviderWaffo,
		ProviderCurrency: strings.ToLower(getWaffoCurrency()),
		CreateTime:       time.Now().Unix(),
		Status:           common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), common.LogText("Waffo failed to create top-up order user_id=%d trade_no=%s amount=%.2f error=%q", id, merchantOrderId, req.Amount, err.Error()))
		paymentError(c, common.NewMessage("Failed to create order"))
		return
	}

	sdk, err := getWaffoSDK()
	if err != nil {
		logger.LogError(c.Request.Context(), common.LogText("Waffo SDK initialization failed user_id=%d trade_no=%s error=%q", id, merchantOrderId, err.Error()))
		topUp.Status = common.TopUpStatusFailed
		persistTopUpFailedStatus(c, topUp)
		paymentError(c, common.NewMessage("Payment configuration error"))
		return
	}

	callbackAddr := service.GetCallbackAddress()
	notifyUrl := callbackAddr + "/api/waffo/webhook"
	if setting.WaffoNotifyUrl != "" {
		notifyUrl = setting.WaffoNotifyUrl
	}
	returnUrl := paymentReturnPath("/wallet?show_history=true")
	if setting.WaffoReturnUrl != "" {
		returnUrl = setting.WaffoReturnUrl
	}

	currency := getWaffoCurrency()
	goodsInfo := buildWaffoTopUpGoodsInfo(req.Amount)
	createParams := &order.CreateOrderParams{
		PaymentRequestID: paymentRequestId,
		MerchantOrderID:  merchantOrderId,
		OrderAmount:      formatWaffoAmount(payMoney, currency),
		OrderCurrency:    currency,
		OrderDescription: goodsInfo.GoodsName,
		OrderRequestedAt: time.Now().UTC().Format("2006-01-02T15:04:05.000Z"),
		NotifyURL:        notifyUrl,
		MerchantInfo: &order.MerchantInfo{
			MerchantID: setting.WaffoMerchantId,
		},
		UserInfo: &order.UserInfo{
			UserID:       strconv.Itoa(user.Id),
			UserEmail:    getWaffoUserEmail(user),
			UserTerminal: "WEB",
		},
		PaymentInfo: &order.PaymentInfo{
			ProductName:   "ONE_TIME_PAYMENT",
			PayMethodType: resolvedPayMethodType,
			PayMethodName: resolvedPayMethodName,
		},
		GoodsInfo:          goodsInfo,
		SuccessRedirectURL: returnUrl,
		FailedRedirectURL:  returnUrl,
	}
	resp, err := sdk.Order().Create(c.Request.Context(), createParams, nil)
	if err != nil {
		logger.LogError(c.Request.Context(), common.LogText("Waffo failed to create order user_id=%d trade_no=%s error=%q", id, merchantOrderId, err.Error()))
		topUp.Status = common.TopUpStatusFailed
		persistTopUpFailedStatus(c, topUp)
		paymentError(c, common.NewMessage("Failed to start payment"))
		return
	}
	if !resp.IsSuccess() {
		logger.LogWarn(c.Request.Context(), common.LogText("Waffo order creation rejected user_id=%d trade_no=%s code=%s message_bytes=%d response_bytes=%d", id, merchantOrderId, resp.Code, len(resp.Message), len(common.GetJsonString(resp))))
		topUp.Status = common.TopUpStatusFailed
		persistTopUpFailedStatus(c, topUp)
		paymentError(c, common.NewMessage("Failed to start payment"))
		return
	}

	orderData := resp.GetData()
	logger.LogInfo(c.Request.Context(), common.LogText("Waffo top-up order created user_id=%d trade_no=%s amount=%.2f money=%.2f pay_method_type=%s pay_method_name=%q", id, merchantOrderId, req.Amount, payMoney, resolvedPayMethodType, resolvedPayMethodName))

	paymentUrl := orderData.FetchRedirectURL()
	if paymentUrl == "" {
		paymentUrl = orderData.OrderAction
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"payment_url": paymentUrl,
			"order_id":    merchantOrderId,
		},
	})
}

// webhookPayloadWithSubInfo 扩展 PAYMENT_NOTIFICATION，包含 SDK 未定义的 subscriptionInfo 字段
type webhookPayloadWithSubInfo struct {
	EventType string `json:"eventType"`
	Result    struct {
		core.PaymentNotificationResult
		SubscriptionInfo *webhookSubscriptionInfo `json:"subscriptionInfo,omitempty"`
	} `json:"result"`
}

type webhookSubscriptionInfo struct {
	Period              string `json:"period,omitempty"`
	MerchantRequest     string `json:"merchantRequest,omitempty"`
	SubscriptionID      string `json:"subscriptionId,omitempty"`
	SubscriptionRequest string `json:"subscriptionRequest,omitempty"`
}

// WaffoWebhook 处理 Waffo 回调通知（支付/退款/订阅）
func WaffoWebhook(c *gin.Context) {
	if !isWaffoWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), common.LogText("Waffo webhook rejected reason=webhook_disabled path=%q client_ip=%s", c.Request.URL.Path, c.ClientIP()))
		c.AbortWithStatus(http.StatusForbidden)
		return
	}

	bodyBytes, err := readPaymentWebhookBody(c.Request.Body)
	if err != nil {
		if errors.Is(err, errPaymentWebhookBodyTooLarge) {
			c.AbortWithStatus(http.StatusRequestEntityTooLarge)
			return
		}
		logger.LogError(c.Request.Context(), common.LogText("Waffo webhook failed to read request body path=%q client_ip=%s error=%q", c.Request.URL.Path, c.ClientIP(), err.Error()))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	sdk, err := getWaffoSDK()
	if err != nil {
		logger.LogError(c.Request.Context(), common.LogText("Waffo webhook SDK initialization failed path=%q client_ip=%s error=%q", c.Request.URL.Path, c.ClientIP(), err.Error()))
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	wh := sdk.Webhook()
	bodyStr := string(bodyBytes)
	signature := c.GetHeader("X-SIGNATURE")
	logger.LogInfo(c.Request.Context(), common.LogText("Waffo webhook received request path=%q client_ip=%s body_bytes=%d", c.Request.URL.Path, c.ClientIP(), len(bodyBytes)))

	// 验证请求签名
	if !wh.VerifySignature(bodyStr, signature) {
		logger.LogWarn(c.Request.Context(), common.LogText("Waffo webhook signature verification failed path=%q client_ip=%s", c.Request.URL.Path, c.ClientIP()))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	var event core.WebhookEvent
	if err := common.Unmarshal(bodyBytes, &event); err != nil {
		logger.LogError(c.Request.Context(), common.LogText("Waffo webhook failed to parse path=%q client_ip=%s error=%q", c.Request.URL.Path, c.ClientIP(), err.Error()))
		sendWaffoWebhookResponse(c, wh, false, "invalid payload")
		return
	}

	switch event.EventType {
	case core.EventPayment:
		// 解析为扩展类型，区分普通支付和订阅支付
		var payload webhookPayloadWithSubInfo
		if err := common.Unmarshal(bodyBytes, &payload); err != nil {
			logger.LogError(c.Request.Context(), common.LogText("Waffo failed to parse payment callback payload event_type=%s client_ip=%s error=%q", event.EventType, c.ClientIP(), err.Error()))
			sendWaffoWebhookResponse(c, wh, false, "invalid payment payload")
			return
		}
		logger.LogInfo(c.Request.Context(), common.LogText("Waffo webhook verified and parsed event_type=%s merchant_order_id=%s order_status=%s client_ip=%s", event.EventType, payload.Result.MerchantOrderID, payload.Result.OrderStatus, c.ClientIP()))
		handleWaffoPayment(c, wh, &payload.Result.PaymentNotificationResult)
	default:
		logger.LogInfo(c.Request.Context(), common.LogText("Waffo webhook ignored event event_type=%s client_ip=%s", event.EventType, c.ClientIP()))
		sendWaffoWebhookResponse(c, wh, true, "")
	}
}

// waffoOrderStatusIsTerminalFailure identifies the only documented terminal
// non-success status. Payment-in-progress and authorization-required events must
// not expire a local order: Waffo can send those before the final result.
func waffoOrderStatusIsTerminalFailure(status string) bool {
	return strings.TrimSpace(status) == "ORDER_CLOSE"
}

// waffoTerminalFailureUpdateNeedsRetry keeps transient database/storage errors
// retryable, while acknowledging permanent order/provider/state mismatches.
func waffoTerminalFailureUpdateNeedsRetry(err error) bool {
	return err != nil &&
		!errors.Is(err, model.ErrTopUpNotFound) &&
		!errors.Is(err, model.ErrTopUpStatusInvalid) &&
		!errors.Is(err, model.ErrPaymentMethodMismatch)
}

// handleWaffoPayment 处理支付完成通知
func handleWaffoPayment(c *gin.Context, wh *core.WebhookHandler, result *core.PaymentNotificationResult) {
	if result.OrderStatus != "PAY_SUCCESS" {
		logger.LogInfo(c.Request.Context(), common.LogText("Waffo order not successful, top-up skipped trade_no=%s order_status=%s client_ip=%s", result.MerchantOrderID, result.OrderStatus, c.ClientIP()))
		if waffoOrderStatusIsTerminalFailure(result.OrderStatus) && result.MerchantOrderID != "" {
			if err := model.UpdatePendingTopUpStatus(result.MerchantOrderID, model.PaymentProviderWaffo, common.TopUpStatusFailed); err != nil {
				if waffoTerminalFailureUpdateNeedsRetry(err) {
					logger.LogError(c.Request.Context(), common.LogText("Waffo failed to mark order as failed; provider retry requested trade_no=%s error=%q", result.MerchantOrderID, err.Error()))
					sendWaffoWebhookResponse(c, wh, false, "failed to update local order state")
					return
				}
				logger.LogWarn(c.Request.Context(), common.LogText("Waffo terminal failure event not applicable to local order trade_no=%s error=%q", result.MerchantOrderID, err.Error()))
			}
		}
		sendWaffoWebhookResponse(c, wh, true, "")
		return
	}

	merchantOrderId := result.MerchantOrderID

	// 金额校验：Waffo 回调的 orderAmount 必须与本地订单应付金额一致。
	// 缺失此校验时，只要验签通过且状态为 PAY_SUCCESS 即按本地订单金额入账，
	// 与实际扣款金额脱钩，存在少付多充的风险。下单时 OrderAmount 由
	// formatWaffoAmount(topUp.Money, currency) 生成，这里必须 fail closed。
	paidAmount := strings.TrimSpace(result.OrderAmount)
	if paidAmount == "" {
		logger.LogWarn(c.Request.Context(), common.LogText("Waffo callback missing paid amount trade_no=%s client_ip=%s", merchantOrderId, c.ClientIP()))
		sendWaffoWebhookResponse(c, wh, false, "缺少支付金额")
		return
	}
	topUp := model.GetTopUpByTradeNo(merchantOrderId)
	if topUp == nil {
		logger.LogWarn(c.Request.Context(), common.LogText("Waffo callback order not found trade_no=%s client_ip=%s", merchantOrderId, c.ClientIP()))
		sendWaffoWebhookResponse(c, wh, false, "订单不存在")
		return
	}
	expectedCurrency := waffoExpectedOrderCurrency(topUp.ProviderCurrency, getWaffoCurrency())
	if expectedCurrency == "" {
		logger.LogWarn(c.Request.Context(), common.LogText("Waffo callback order has no usable currency trade_no=%s client_ip=%s", merchantOrderId, c.ClientIP()))
		sendWaffoWebhookResponse(c, wh, false, "订单缺少币种配置")
		return
	}
	if !strings.EqualFold(strings.TrimSpace(result.OrderCurrency), expectedCurrency) {
		logger.LogWarn(c.Request.Context(), common.LogText("Waffo callback currency mismatch trade_no=%s callback_currency=%s expected_currency=%s client_ip=%s", merchantOrderId, result.OrderCurrency, expectedCurrency, c.ClientIP()))
		sendWaffoWebhookResponse(c, wh, false, "币种不匹配")
		return
	}
	expected := formatWaffoAmount(topUp.Money, expectedCurrency)
	if !waffoPaidAmountMatchesOrder(paidAmount, expected) {
		logger.LogWarn(c.Request.Context(), common.LogText("Waffo callback amount mismatch trade_no=%s client_ip=%s",
			merchantOrderId, c.ClientIP()))
		sendWaffoWebhookResponse(c, wh, false, "金额不匹配")
		return
	}

	LockOrder(merchantOrderId)
	defer UnlockOrder(merchantOrderId)

	if err := model.RechargeWaffo(merchantOrderId, c.ClientIP()); err != nil {
		logger.LogError(c.Request.Context(), common.LogText("Waffo top-up processing failed trade_no=%s client_ip=%s error=%q", merchantOrderId, c.ClientIP(), err.Error()))
		sendWaffoWebhookResponse(c, wh, false, err.Error())
		return
	}

	logger.LogInfo(c.Request.Context(), common.LogText("Waffo top-up succeeded trade_no=%s client_ip=%s", merchantOrderId, c.ClientIP()))
	sendWaffoWebhookResponse(c, wh, true, "")
}

// sendWaffoWebhookResponse 发送签名响应
func sendWaffoWebhookResponse(c *gin.Context, wh *core.WebhookHandler, success bool, msg string) {
	var body, sig string
	if success {
		body, sig = wh.BuildSuccessResponse()
	} else {
		body, sig = wh.BuildFailedResponse(msg)
	}
	c.Header("X-SIGNATURE", sig)
	c.Data(http.StatusOK, "application/json", []byte(body))
}
