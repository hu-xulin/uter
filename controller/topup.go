package controller

import (
	"errors"
	"fmt"
	"github.com/uter-ai/uter/i18n"
	"maps"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/uter-ai/uter/common"

	"github.com/uter-ai/uter/logger"
	"github.com/uter-ai/uter/middleware"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
	"github.com/uter-ai/uter/setting"
	"github.com/uter-ai/uter/setting/operation_setting"

	"github.com/Calcium-Ion/go-epay/epay"
	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
	"github.com/shopspring/decimal"
)

func GetTopUpInfo(c *gin.Context) {
	complianceConfirmed := operation_setting.IsPaymentComplianceConfirmed()

	// 获取支付方式
	payMethods := operation_setting.PayMethods
	if !complianceConfirmed {
		payMethods = []map[string]string{}
	}

	// 如果启用了 Stripe 支付，添加到支付方法列表
	if isStripeTopUpEnabled() {
		// 检查是否已经包含 Stripe
		hasStripe := false
		for _, method := range payMethods {
			if method["type"] == "stripe" {
				hasStripe = true
				break
			}
		}

		if !hasStripe {
			stripeMethod := map[string]string{
				"name":      "Stripe",
				"type":      "stripe",
				"color":     "#635BFF",
				"min_topup": formatTopUpAmount(setting.StripeMinTopUp),
			}
			payMethods = append(payMethods, stripeMethod)
		}
	}

	// Waffo Pancake is displayed above the standard Waffo gateway.
	enableWaffoPancake := isWaffoPancakeTopUpEnabled()
	if enableWaffoPancake {
		hasWaffoPancake := false
		for _, method := range payMethods {
			if method["type"] == model.PaymentMethodWaffoPancake {
				hasWaffoPancake = true
				break
			}
		}

		if !hasWaffoPancake {
			payMethods = append(payMethods, map[string]string{
				"name":      "Waffo Pancake",
				"type":      model.PaymentMethodWaffoPancake,
				"color":     "#F97316",
				"min_topup": formatTopUpAmount(setting.WaffoPancakeMinTopUp),
			})
		}
	}

	// 如果启用了 Waffo 支付，添加到支付方法列表
	enableWaffo := isWaffoTopUpEnabled()
	if enableWaffo {
		hasWaffo := false
		for _, method := range payMethods {
			if method["type"] == model.PaymentMethodWaffo {
				hasWaffo = true
				break
			}
		}

		if !hasWaffo {
			waffoMethod := map[string]string{
				"name":      "Waffo (Global Payment)",
				"type":      model.PaymentMethodWaffo,
				"color":     "#3B82F6",
				"min_topup": formatTopUpAmount(setting.WaffoMinTopUp),
			}
			payMethods = append(payMethods, waffoMethod)
		}
	}

	// 支付宝网站支付（电脑网站支付 alipay.trade.page.pay / 手机网站支付 alipay.trade.wap.pay）
	enableAlipay := isAlipayTopUpEnabled()
	if enableAlipay {
		hasAlipay := false
		for _, method := range payMethods {
			if method["type"] == model.PaymentMethodAlipay {
				hasAlipay = true
				break
			}
		}
		if !hasAlipay {
			payMethods = append(payMethods, map[string]string{
				"name":      "支付宝",
				"type":      model.PaymentMethodAlipay,
				"icon":      "SiAlipay",
				"color":     "#1677FF",
				"min_topup": formatTopUpAmount(operation_setting.MinTopUp),
			})
		}
	}

	// 微信支付网站支付（PC Native 扫码 / 手机 H5）
	enableWechatPay := isWechatPayTopUpEnabled()
	if enableWechatPay {
		hasWechatPay := false
		for _, method := range payMethods {
			if method["type"] == model.PaymentMethodWechatPay {
				hasWechatPay = true
				break
			}
		}
		if !hasWechatPay {
			payMethods = append(payMethods, map[string]string{
				"name":      "微信支付",
				"type":      model.PaymentMethodWechatPay,
				"icon":      "SiWechat",
				"color":     "#07C160",
				"min_topup": formatTopUpAmount(operation_setting.MinTopUp),
			})
		}
	}

	data := gin.H{
		"enable_online_topup":              isEpayTopUpEnabled(),
		"enable_stripe_topup":              isStripeTopUpEnabled(),
		"enable_creem_topup":               isCreemTopUpEnabled(),
		"enable_waffo_topup":               enableWaffo,
		"enable_waffo_pancake_topup":       enableWaffoPancake,
		"enable_alipay_topup":              enableAlipay,
		"enable_wechat_pay_topup":          enableWechatPay,
		"enable_redemption":                complianceConfirmed,
		"payment_compliance_confirmed":     complianceConfirmed,
		"payment_compliance_terms_version": operation_setting.CurrentComplianceTermsVersion,
		"waffo_pay_methods": func() any {
			if enableWaffo {
				return setting.GetWaffoPayMethods()
			}
			return nil
		}(),
		"creem_products":          setting.CreemProducts,
		"pay_methods":             payMethods,
		"min_topup":               operation_setting.MinTopUp,
		"stripe_min_topup":        setting.StripeMinTopUp,
		"waffo_min_topup":         setting.WaffoMinTopUp,
		"waffo_pancake_min_topup": setting.WaffoPancakeMinTopUp,
		"amount_options":          operation_setting.GetPaymentSetting().AmountOptions,
		"discount":                operation_setting.GetPaymentSetting().AmountDiscount,
		"topup_link":              common.TopUpLink,
	}
	common.ApiSuccess(c, data)
}

type EpayRequest struct {
	Amount        float64 `json:"amount"`
	PaymentMethod string  `json:"payment_method"`
}

type AmountRequest struct {
	Amount float64 `json:"amount"`
}

func GetEpayClient() *epay.Client {
	if operation_setting.PayAddress == "" || operation_setting.EpayId == "" || operation_setting.EpayKey == "" {
		return nil
	}
	withUrl, err := epay.NewClient(&epay.Config{
		PartnerID: operation_setting.EpayId,
		Key:       operation_setting.EpayKey,
	}, operation_setting.PayAddress)
	if err != nil {
		return nil
	}
	return withUrl
}

// presetDiscountFor 返回按充值金额命中的预设折扣。
//
// AmountDiscount 以整数金额为键（后台「金额档位折扣」），因此非整数金额不参与
// 预设折扣——否则 10.5 会错命中 10 这一档，按 $10 的折扣给 $10.50 的订单打折。
func presetDiscountFor(amount float64) float64 {
	if amount != math.Trunc(amount) {
		return 1.0
	}
	if discount, ok := operation_setting.GetPaymentSetting().AmountDiscount[int(amount)]; ok && discount > 0 {
		return discount
	}
	return 1.0
}

func getPayMoney(amount float64, group string) float64 {
	dAmount := decimal.NewFromFloat(amount)
	// 充值金额以“展示类型”为准：
	// - USD/CNY: 前端传 amount 为金额单位；TOKENS: 前端传 tokens，需要换成 USD 金额
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		// 与入账口径对齐：入账按 IntPart(amount/quotaPerUnit) 取整（见 getTopUpQuota
		// 与 alipayAmountForStorage）。计价若用精确商，用户会为「根本没到账的零头」
		// 付钱——例如 600000 tokens 按 1.2 美元收款、只入账 500000（1.0 美元）。
		dAmount = decimal.NewFromInt(dAmount.Div(dQuotaPerUnit).IntPart())
	}

	topupGroupRatio := common.GetTopupGroupRatio(group)
	if topupGroupRatio == 0 {
		topupGroupRatio = 1
	}

	dTopupGroupRatio := decimal.NewFromFloat(topupGroupRatio)
	// 计价统一走「汇率」：与 GetStatus 下发的 price、钱包页展示的应付金额保持一致，
	// 避免管理员只改「汇率」时出现展示与实扣错位（详见 operation_setting.EffectivePayPrice）。
	dPrice := decimal.NewFromFloat(operation_setting.EffectivePayPrice())
	// apply optional preset discount by the original request amount (if configured), default 1.0
	dDiscount := decimal.NewFromFloat(presetDiscountFor(amount))

	payMoney := dAmount.Mul(dPrice).Mul(dTopupGroupRatio).Mul(dDiscount)

	// 统一收敛到「分」，且只在这里收敛一次。
	//
	// 金额在下游有三个消费者，它们对「恰好半分」的取整规则并不一致：
	//   - 网关请求体：strconv.FormatFloat(v,'f',2,64) —— 四舍六入五取偶
	//   - 订单标题：paymentOrderTitle 用 decimal.Round(2) —— 四舍五入
	//   - 回调比对：paidAmountMatchesOrder 用 decimal.Round(2) —— 四舍五入
	// 于是 6.885 会被请求成 6.88、却按 6.89 比对：网关按 6.88 扣款，
	// 本地判定「金额不匹配」，回调永远失败——用户付了钱却拿不到额度。
	// 在这里收敛之后，三个消费者拿到的是同一个两位小数值，不再有分歧空间。
	return roundPayMoneyToCent(payMoney.InexactFloat64())
}

// roundPayMoneyToCent 把应付金额收敛到分（四舍五入）。
func roundPayMoneyToCent(payMoney float64) float64 {
	return decimal.NewFromFloat(payMoney).Round(2).InexactFloat64()
}

// paymentOrderTitle 生成境内网关（支付宝 subject / 微信支付 description）的订单标题。
//
// 标题 =「<运营配置的前缀> 充值 <人民币实付金额> 元」：
//   - 金额必须与实扣一致。站内的额度单位（美元 / tokens）只用于站内展示，一旦写进
//     标题，用户在收银台会看到「充值 10」而实际扣款 ¥68.80，看起来像金额没换算。
//   - 前缀由运营在「支付设置」里配置（PaymentOrderTitlePrefix），留空回退品牌名。
//
// 总长度受微信 127 字符限制，前缀上限由 ValidatePaymentOrderTitlePrefix 把关。
func paymentOrderTitle(payMoney float64) string {
	amount := decimal.NewFromFloat(payMoney).Round(2).StringFixed(2)
	return fmt.Sprintf("%s 充值 %s 元", operation_setting.PaymentOrderTitlePrefix(), amount)
}

// formatTopUpAmount 把金额配置渲染成前端可直接 Number() 的字符串。
// 必须用 FormatFloat 而不是 Itoa：最低充值允许两位小数（如 0.01）。
func formatTopUpAmount(amount float64) string {
	return strconv.FormatFloat(amount, 'f', -1, 64)
}

// getMinTopup 返回最低充值金额，单位与请求里的 amount 一致：
// USD/CNY 展示类型下是金额，TOKENS 展示类型下是 token 数。
func getMinTopup() float64 {
	minTopup := operation_setting.MinTopUp
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dMinTopup := decimal.NewFromFloat(minTopup)
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		quota, err := common.WalletQuotaFromDecimalStrict(dMinTopup.Mul(dQuotaPerUnit))
		if err != nil {
			return float64(common.MaxWalletQuota)
		}
		minTopup = float64(quota)
	}
	return minTopup
}

func getTopUpQuota(amount float64) (int, error) {
	quota := decimal.NewFromFloat(amount)
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		quotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		quota = decimal.NewFromInt(quota.Div(quotaPerUnit).IntPart()).Mul(quotaPerUnit)
	} else {
		quota = quota.Mul(decimal.NewFromFloat(common.QuotaPerUnit))
	}
	return common.WalletQuotaFromDecimalStrict(quota)
}

func getMaxTopUpAmount() float64 {
	if common.QuotaPerUnit <= 0 {
		return 0
	}
	quotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
	maxStoredAmount := decimal.NewFromInt(common.MaxWalletQuota).
		Div(quotaPerUnit).
		Floor()
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		return maxStoredAmount.Add(decimal.NewFromInt(1)).
			Mul(quotaPerUnit).
			Ceil().
			Sub(decimal.NewFromInt(1)).
			InexactFloat64()
	}
	return maxStoredAmount.InexactFloat64()
}

func validateCreditedQuota(quota decimal.Decimal) (int, error) {
	value, err := common.WalletQuotaFromDecimalStrict(quota)
	if err != nil {
		return 0, common.NewMessage("Top-up quota exceeds the range the system can represent")
	}
	if value <= 0 {
		return 0, common.NewMessage("Top-up quota must be greater than 0")
	}
	return value, nil
}

func validateTopUpQuota(amount float64) (int, error) {
	quota, err := getTopUpQuota(amount)
	if err == nil && quota > 0 {
		return quota, nil
	}
	maxAmount := getMaxTopUpAmount()
	if maxAmount > 0 && amount > maxAmount {
		// 金额是 float64（支持 $0.01 起充），直接塞进模板会被 Go 用 `%v`
		// 渲染成 `1.8014398509e+10` —— 用户看到的是一串科学计数法。
		// 统一走 `formatTopUpAmount`（'f' 格式、去掉无意义尾零）。
		return 0, common.NewMessage("Top-up amount cannot exceed {{max}}", map[string]any{"max": formatTopUpAmount(maxAmount)})
	}
	return 0, common.NewMessage("Invalid top-up amount")
}

// paymentError answers payment endpoints in their {"message": "error",
// "data": text} shape. When err is or wraps a *common.Message, the response
// also carries message_key and message_params for the web console.
func paymentError(c *gin.Context, err error) {
	body := gin.H{"message": "error", "data": err.Error()}
	var message *common.Message
	if errors.As(err, &message) {
		maps.Copy(body, message.Fields())
	}
	c.JSON(http.StatusOK, body)
}

func rejectInvalidCreditedQuota(c *gin.Context, userId int, quota decimal.Decimal) bool {
	creditedQuota, err := validateCreditedQuota(quota)
	if err == nil {
		err = model.ValidateTopUpQuotaCapacity(userId, creditedQuota)
	}
	if err != nil {
		paymentError(c, err)
		return true
	}
	return false
}

// rejectInvalidTopUpAmount 拦截精度超标的充值金额（超过两位小数）。
//
// 本地按「分」计价、网关也收不了更小的金额，静默四舍五入会让「用户看到的金额」
// 与「实际扣款」对不上，因此直接拒绝而不是修正。
func rejectInvalidTopUpAmount(c *gin.Context, amount float64) bool {
	if _, err := common.NormalizeTopUpAmount(amount); err != nil {
		paymentError(c, err)
		return true
	}
	return false
}

func rejectInvalidTopUpQuota(c *gin.Context, userId int, amount float64) bool {
	if rejectInvalidTopUpAmount(c, amount) {
		return true
	}
	creditedQuota, err := validateTopUpQuota(amount)
	if err == nil {
		err = model.ValidateTopUpQuotaCapacity(userId, creditedQuota)
	}
	if err != nil {
		paymentError(c, err)
		return true
	}
	return false
}

// markTopUpFailed closes a locally created pending order as failed and stores
// the reason with it.
//
// F-07: use this only when the payment provider is known NOT to have created
// (or has definitively rejected) the order. When the provider state is unknown
// the order must stay pending — marking it failed would hide a possibly paid
// order from the callback that has to credit it.
func markTopUpFailed(c *gin.Context, topUp *model.TopUp, reason string) {
	if err := topUp.MarkFailed(reason); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("failed to persist top-up failure reason trade_no=%s reason=%q error=%q", topUp.TradeNo, reason, err.Error()))
	}
}

func RequestEpay(c *gin.Context) {
	if !isEpayTopUpEnabled() {
		paymentError(c, common.NewMessage("Epay payment is not enabled or configured"))
		return
	}
	var req EpayRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		paymentError(c, common.NewMessage("Invalid parameters"))
		return
	}
	if req.Amount < getMinTopup() {
		paymentError(c, common.NewMessage("Top-up amount cannot be less than {{min}}", map[string]any{"min": getMinTopup()}))
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
	payMoney := getPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		paymentError(c, common.NewMessage("Payment amount is too low"))
		return
	}

	if !operation_setting.ContainsPayMethod(req.PaymentMethod) {
		paymentError(c, common.NewMessage("Payment method does not exist"))
		return
	}

	callBackAddress := service.GetCallbackAddress()
	returnUrl, _ := url.Parse(paymentReturnPath("/usage-logs"))
	notifyUrl, _ := url.Parse(callBackAddress + "/api/user/epay/notify")
	tradeNo := fmt.Sprintf("%s%d", common.GetRandomString(6), time.Now().Unix())
	tradeNo = fmt.Sprintf("USR%dNO%s", id, tradeNo)
	client := GetEpayClient()
	if client == nil {
		paymentError(c, common.NewMessage("Payment information has not been configured by administrator"))
		return
	}
	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount := decimal.NewFromFloat(amount)
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		amount = dAmount.Div(dQuotaPerUnit).InexactFloat64()
	}
	topUp := &model.TopUp{
		UserId:          id,
		Amount:          amount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   req.PaymentMethod,
		PaymentProvider: model.PaymentProviderEpay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	// F-07: persist the local pending order BEFORE handing the user a payment
	// URL. The provider only learns about this order when the user pays at the
	// gateway, so a local insert that failed after the URL was issued left the
	// user paying for an order the callback could never find — money received
	// but never credited. Writing the order first closes that window.
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("易支付 创建充值订单失败 user_id=%d trade_no=%s payment_method=%s amount=%.2f error=%q", id, tradeNo, req.PaymentMethod, req.Amount, err.Error()))
		paymentError(c, common.NewMessage("Failed to create the order"))
		return
	}
	uri, params, err := client.Purchase(&epay.PurchaseArgs{
		Type:           req.PaymentMethod,
		ServiceTradeNo: tradeNo,
		Name:           "TUC" + formatTopUpAmount(req.Amount),
		Money:          strconv.FormatFloat(payMoney, 'f', 2, 64),
		Device:         epay.PC,
		NotifyUrl:      notifyUrl,
		ReturnUrl:      returnUrl,
	})
	if err != nil {
		// The provider was never contacted, so this order can be closed as
		// failed with a recorded reason instead of lingering as pending.
		logger.LogError(c.Request.Context(), fmt.Sprintf("易支付 拉起支付失败 user_id=%d trade_no=%s payment_method=%s amount=%.2f error=%q", id, tradeNo, req.PaymentMethod, req.Amount, err.Error()))
		markTopUpFailed(c, topUp, "epay checkout url build failed: "+err.Error())
		paymentError(c, common.NewMessage("Failed to start payment"))
		return
	}
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("易支付 充值订单创建成功 user_id=%d trade_no=%s payment_method=%s amount=%.2f money=%.2f uri_length=%d param_count=%d", id, tradeNo, req.PaymentMethod, req.Amount, payMoney, len(uri), len(params)))
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": params, "url": uri})
}

// tradeNo lock
var orderLocks sync.Map
var createLock sync.Mutex

// refCountedMutex 带引用计数的互斥锁，确保最后一个使用者才从 map 中删除
type refCountedMutex struct {
	mu       sync.Mutex
	refCount int
}

// LockOrder 尝试对给定订单号加锁
func LockOrder(tradeNo string) {
	createLock.Lock()
	var rcm *refCountedMutex
	if v, ok := orderLocks.Load(tradeNo); ok {
		rcm = v.(*refCountedMutex)
	} else {
		rcm = &refCountedMutex{}
		orderLocks.Store(tradeNo, rcm)
	}
	rcm.refCount++
	createLock.Unlock()
	rcm.mu.Lock()
}

// UnlockOrder 释放给定订单号的锁
func UnlockOrder(tradeNo string) {
	v, ok := orderLocks.Load(tradeNo)
	if !ok {
		return
	}
	rcm := v.(*refCountedMutex)
	rcm.mu.Unlock()

	createLock.Lock()
	rcm.refCount--
	if rcm.refCount == 0 {
		orderLocks.Delete(tradeNo)
	}
	createLock.Unlock()
}

// paidAmountMatchesOrder 校验网关回传的实付金额与本地订单应付金额是否一致。
//
// 为什么必须有：验签只能证明「这条回调确实是网关发的」，不能证明「用户按订单
// 金额付了钱」。缺失该校验时，只要 trade_no 存在且验签通过，系统就按本地订单
// 金额入账，与实际扣款金额脱钩——充值方或恶意网关运营方可用一个 0.01 元的
// 成功回调换走整单额度（少付多充）。支付宝 / 微信 / Stripe / Waffo /
// Waffo Pancake 的回调均已比对实付金额，本函数把同一标准收口到易支付。
//
// 单位：paid 与 expectedMoney 都以「元」为单位；期望值先 round 到分位，
// 容忍网关侧字符串格式（"10.00" vs "10.0"）差异。
func paidAmountMatchesOrder(paid decimal.Decimal, expectedMoney float64) bool {
	if paid.LessThanOrEqual(decimal.Zero) {
		return false
	}
	return paid.Equal(decimal.NewFromFloat(expectedMoney).Round(2))
}

// providerExpectedMinorUnits 解析回调必须匹配的「网关口径金额快照」。
//
// 下单时把真正发给网关的金额（分）落到 ProviderAmount，回调只与这个快照比对；
// 只有存量订单（快照为空）才回退到由 Money（元）换算。两条链路（支付宝 /
// 微信支付）共用同一解析，避免一边用快照、一边用 Money 二次换算而在
// getPayMoney 的取整规则变化时分叉。
func providerExpectedMinorUnits(providerAmount int64, money float64) int64 {
	if providerAmount > 0 {
		return providerAmount
	}
	return decimal.NewFromFloat(money).Mul(decimal.NewFromInt(100)).Round(0).IntPart()
}

// providerPaidAmountMatchesOrder validates a gateway amount expressed in major currency units.
func providerPaidAmountMatchesOrder(paid string, expectedMoney float64) bool {
	amount, err := decimal.NewFromString(strings.TrimSpace(paid))
	return err == nil && paidAmountMatchesOrder(amount, expectedMoney)
}

// providerCurrencyMatchesOrder fails closed when either side of a provider
// currency comparison is absent.
func providerCurrencyMatchesOrder(paidCurrency, expectedCurrency string) bool {
	paidCurrency = strings.TrimSpace(paidCurrency)
	expectedCurrency = strings.TrimSpace(expectedCurrency)
	return paidCurrency != "" && expectedCurrency != "" && strings.EqualFold(paidCurrency, expectedCurrency)
}

// currencyMinorUnitExponent returns the ISO 4217 minor-unit exponent for
// currencies supported by provider order amounts. Unusual zero/three/four-decimal
// currencies are listed explicitly; the standard exponent for other three-letter
// currencies is two.
func currencyMinorUnitExponent(currency string) (int, bool) {
	currency = strings.ToUpper(strings.TrimSpace(currency))
	if len(currency) != 3 {
		return 0, false
	}
	for _, r := range currency {
		if r < 'A' || r > 'Z' {
			return 0, false
		}
	}
	switch currency {
	case "BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF":
		return 0, true
	case "BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND":
		return 3, true
	case "CLF", "UYW":
		return 4, true
	default:
		return 2, true
	}
}

// expectedMinorUnits converts a local major-unit order amount into the
// provider's minor units without silently rounding an unsupported precision.
func expectedMinorUnits(expectedMoney float64, currency string) (int64, bool) {
	if expectedMoney <= 0 || math.IsNaN(expectedMoney) || math.IsInf(expectedMoney, 0) {
		return 0, false
	}
	exponent, ok := currencyMinorUnitExponent(currency)
	if !ok {
		return 0, false
	}
	scale := int64(1)
	for range exponent {
		scale *= 10
	}
	expected := decimal.NewFromFloat(expectedMoney).Mul(decimal.NewFromInt(scale))
	if !expected.Equal(expected.Truncate(0)) {
		return 0, false
	}
	bigAmount := expected.BigInt()
	if !bigAmount.IsInt64() {
		return 0, false
	}
	return bigAmount.Int64(), true
}

// creemOrderAmountsCoverOrder validates the provider's pre-tax subtotal against
// the local price and separately ensures that the paid amount covers the final
// due amount (which may include tax). A higher subtotal is allowed because
// Creem's merchant-catalog price may be newer than the local price snapshot;
// a lower subtotal is never allowed, since tax-inclusive amount_paid could
// otherwise mask a product-price shortfall.
func creemOrderAmountsCoverOrder(subtotalMinorUnits, amountDueMinorUnits, amountPaidMinorUnits int64, expectedMoney float64, currency string) (covered bool, subtotalOverpaid bool) {
	expectedAmount, ok := expectedMinorUnits(expectedMoney, currency)
	if !ok || subtotalMinorUnits <= 0 || amountDueMinorUnits <= 0 ||
		amountPaidMinorUnits < amountDueMinorUnits || amountPaidMinorUnits < expectedAmount {
		return false, false
	}
	if subtotalMinorUnits < expectedAmount {
		return false, false
	}
	return true, subtotalMinorUnits > expectedAmount
}

func EpayNotify(c *gin.Context) {
	if !isEpayWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("易支付 webhook 被拒绝 reason=webhook_disabled path=%q client_ip=%s", c.Request.URL.Path, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	var params map[string]string

	if c.Request.Method == "POST" {
		// POST 请求：从 POST body 解析参数
		limitPaymentWebhookFormBody(c.Writer, c.Request)
		if err := c.Request.ParseForm(); err != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("易支付 webhook POST 表单解析失败 path=%q client_ip=%s error=%q", c.Request.URL.Path, c.ClientIP(), err.Error()))
			_, _ = c.Writer.Write([]byte("fail"))
			return
		}
		params = lo.Reduce(lo.Keys(c.Request.PostForm), func(r map[string]string, t string, i int) map[string]string {
			r[t] = c.Request.PostForm.Get(t)
			return r
		}, map[string]string{})
	} else {
		// GET 请求：从 URL Query 解析参数
		params = lo.Reduce(lo.Keys(c.Request.URL.Query()), func(r map[string]string, t string, i int) map[string]string {
			r[t] = c.Request.URL.Query().Get(t)
			return r
		}, map[string]string{})
	}
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("易支付 webhook 收到请求 path=%q client_ip=%s method=%s param_count=%d", c.Request.URL.Path, c.ClientIP(), c.Request.Method, len(params)))

	if len(params) == 0 {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("易支付 webhook 参数为空 path=%q client_ip=%s", c.Request.URL.Path, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	client := GetEpayClient()
	if client == nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("易支付 client 未初始化 path=%q client_ip=%s", c.Request.URL.Path, c.ClientIP()))
		_, err := c.Writer.Write([]byte("fail"))
		if err != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("易支付 webhook 响应写入失败 path=%q client_ip=%s error=%q", c.Request.URL.Path, c.ClientIP(), err.Error()))
		}
		return
	}
	verifyInfo, err := client.Verify(params)
	if err != nil || !verifyInfo.VerifyStatus {
		if _, writeErr := c.Writer.Write([]byte("fail")); writeErr != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("易支付 webhook 响应写入失败 path=%q client_ip=%s error=%q", c.Request.URL.Path, c.ClientIP(), writeErr.Error()))
		}
		if err != nil {
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("易支付 webhook 验签失败 path=%q client_ip=%s verify_error=%q", c.Request.URL.Path, c.ClientIP(), err.Error()))
		} else {
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("易支付 webhook 验签失败 path=%q client_ip=%s verify_status=false", c.Request.URL.Path, c.ClientIP()))
		}
		return
	}
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("易支付 webhook 验签成功 trade_no=%s callback_type=%s trade_status=%s client_ip=%s", verifyInfo.ServiceTradeNo, verifyInfo.Type, verifyInfo.TradeStatus, c.ClientIP()))

	if verifyInfo.TradeStatus == epay.StatusTradeSuccess {
		// 金额校验：易支付回传的实付金额必须与本地订单应付金额一致。
		// 缺失此校验时，只要验签通过即按本地订单金额入账，与实际扣款金额脱钩，
		// 存在少付多充的风险。验签只证明回调来自网关，不证明用户按订单金额付款。
		topUp := model.GetTopUpByTradeNo(verifyInfo.ServiceTradeNo)
		if topUp == nil {
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("易支付回调订单不存在 trade_no=%s client_ip=%s", verifyInfo.ServiceTradeNo, c.ClientIP()))
			_, _ = c.Writer.Write([]byte("fail"))
			return
		}
		paidMoney, moneyErr := decimal.NewFromString(strings.TrimSpace(verifyInfo.Money))
		if moneyErr != nil || !paidAmountMatchesOrder(paidMoney, topUp.Money) {
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("易支付回调金额不匹配 trade_no=%s client_ip=%s", verifyInfo.ServiceTradeNo, c.ClientIP()))
			_, _ = c.Writer.Write([]byte("fail"))
			return
		}
		// 进程内锁只是优化；重复/并发回调的正确性由 RechargeEpay 的
		// 数据库行锁 + 事务内状态校验保证（多实例部署下同样安全）。
		LockOrder(verifyInfo.ServiceTradeNo)
		defer UnlockOrder(verifyInfo.ServiceTradeNo)
		alreadyDone, err := model.RechargeEpay(verifyInfo.ServiceTradeNo, verifyInfo.Type, c.ClientIP())
		if err != nil {
			switch {
			case errors.Is(err, model.ErrTopUpNotFound):
				logger.LogWarn(c.Request.Context(), fmt.Sprintf("易支付 回调订单不存在 trade_no=%s callback_type=%s client_ip=%s", verifyInfo.ServiceTradeNo, verifyInfo.Type, c.ClientIP()))
			case errors.Is(err, model.ErrPaymentMethodMismatch):
				logger.LogWarn(c.Request.Context(), fmt.Sprintf("易支付 订单支付网关不匹配 trade_no=%s callback_type=%s client_ip=%s", verifyInfo.ServiceTradeNo, verifyInfo.Type, c.ClientIP()))
			case errors.Is(err, model.ErrTopUpStatusInvalid):
				logger.LogWarn(c.Request.Context(), fmt.Sprintf("易支付 订单状态非法 trade_no=%s callback_type=%s client_ip=%s", verifyInfo.ServiceTradeNo, verifyInfo.Type, c.ClientIP()))
			default:
				logger.LogError(c.Request.Context(), fmt.Sprintf("易支付 充值处理失败 trade_no=%s client_ip=%s error=%q", verifyInfo.ServiceTradeNo, c.ClientIP(), err.Error()))
			}
			if _, writeErr := c.Writer.Write([]byte("fail")); writeErr != nil {
				logger.LogError(c.Request.Context(), fmt.Sprintf("易支付 webhook 响应写入失败 trade_no=%s client_ip=%s error=%q", verifyInfo.ServiceTradeNo, c.ClientIP(), writeErr.Error()))
			}
			return
		}
		if alreadyDone {
			logger.LogInfo(c.Request.Context(), fmt.Sprintf("易支付 重复回调幂等忽略 trade_no=%s callback_type=%s client_ip=%s", verifyInfo.ServiceTradeNo, verifyInfo.Type, c.ClientIP()))
		} else {
			logger.LogInfo(c.Request.Context(), fmt.Sprintf("易支付 充值成功 trade_no=%s callback_type=%s client_ip=%s", verifyInfo.ServiceTradeNo, verifyInfo.Type, c.ClientIP()))
		}
	} else {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("易支付 webhook 忽略事件 trade_no=%s callback_type=%s trade_status=%s client_ip=%s", verifyInfo.ServiceTradeNo, verifyInfo.Type, verifyInfo.TradeStatus, c.ClientIP()))
	}
	if _, writeErr := c.Writer.Write([]byte("success")); writeErr != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("易支付 webhook 响应写入失败 trade_no=%s client_ip=%s error=%q", verifyInfo.ServiceTradeNo, c.ClientIP(), writeErr.Error()))
	}
}

func RequestAmount(c *gin.Context) {
	var req AmountRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		paymentError(c, common.NewMessage("Invalid parameters"))
		return
	}

	if req.Amount < getMinTopup() {
		paymentError(c, common.NewMessage("Top-up amount cannot be less than {{min}}", map[string]any{"min": getMinTopup()}))
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
	payMoney := getPayMoney(req.Amount, group)
	if payMoney <= 0.01 {
		paymentError(c, common.NewMessage("Payment amount is too low"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": strconv.FormatFloat(payMoney, 'f', 2, 64)})
}

func GetUserTopUps(c *gin.Context) {
	userId := c.GetInt("id")
	// 读时对账：先把该用户近期仍待确认的支付宝订单向网关核一遍，再读列表。
	// 这样「已付款但因回调打不到/用户没回跳而停在待确认」的记录，用户一打开
	// 充值记录就能看到真实状态，不必等后台对账任务的下一轮。
	// 无待确认订单时不产生任何网关请求。
	reconcileUserPendingAlipayOrders(c.Request.Context(), userId)
	pageInfo := common.GetPageQuery(c)
	keyword := c.Query("keyword")

	var (
		topups []*model.TopUp
		total  int64
		err    error
	)
	if keyword != "" {
		topups, total, err = model.SearchUserTopUps(userId, keyword, pageInfo)
	} else {
		topups, total, err = model.GetUserTopUps(userId, pageInfo)
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(topups)
	common.ApiSuccess(c, pageInfo)
}

// GetAllTopUps 管理员获取全平台充值记录
func GetAllTopUps(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	keyword := c.Query("keyword")

	// 组织范围收敛（对应审计项 P2-3）：组织 / 部门管理员只看到本租户成员的订单，
	// 平台管理员 scope.OrgID==0 时 UserIDs() 返回 nil 表示不过滤。
	scope := middleware.RequestOrgScope(c)
	userIds, err := scope.UserIDs()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	var (
		topups []*model.TopUp
		total  int64
	)
	if keyword != "" {
		topups, total, err = model.SearchAllTopUps(keyword, pageInfo, userIds)
	} else {
		topups, total, err = model.GetAllTopUps(pageInfo, userIds)
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(topups)
	common.ApiSuccess(c, pageInfo)
}

type AdminCompleteTopupRequest struct {
	TradeNo string `json:"trade_no"`
}

// AdminCompleteTopUp 管理员补单接口
func AdminCompleteTopUp(c *gin.Context) {
	var req AdminCompleteTopupRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.TradeNo == "" {
		common.ApiErrorI18n(c, i18n.MsgCommonInvalid_param)
		return
	}

	// 订单级互斥，防止并发补单
	LockOrder(req.TradeNo)
	defer UnlockOrder(req.TradeNo)

	// 组织范围门禁（对应审计项 P2-3）：组织 / 部门管理员只能补本租户成员的订单，
	// 平台管理员（scope.OrgID==0）跳过此校验。
	scope := middleware.RequestOrgScope(c)
	if scope.OrgID != 0 {
		ownerId, oerr := model.GetTopUpUserIDByTradeNo(req.TradeNo)
		if oerr != nil {
			common.ApiError(c, oerr)
			return
		}
		ids, ierr := scope.UserIDs()
		if ierr != nil {
			common.ApiError(c, ierr)
			return
		}
		inScope := false
		for _, id := range ids {
			if id == ownerId {
				inScope = true
				break
			}
		}
		if !inScope {
			common.ApiErrorI18n(c, i18n.MsgUserNoPermissionHigherLevel)
			return
		}
	}

	outcome, err := model.ManualCompleteTopUp(req.TradeNo, c.ClientIP())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// F-19: tell the operator which of the two outcomes happened. `completed`
	// means this call credited the account; `already_completed` means the order
	// had been settled earlier and nothing was credited again.
	common.ApiSuccess(c, gin.H{
		"completed":         outcome.Completed,
		"already_completed": !outcome.Completed,
	})
}
