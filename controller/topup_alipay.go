/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General License
along with this program. Not found? See <https://www.gnu.org/licenses/>.
*/

package controller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/logger"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
	"github.com/uter-ai/uter/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

// CnWebPaymentRequest 网站支付（Web 收银台）下单请求。
// client 决定收银台形态，由前端按视口/UA 传入；服务端只接受白名单值，
// 未知值一律降级为 pc，避免客户端下发任意字符串影响下单参数。
type CnWebPaymentRequest struct {
	Amount        float64 `json:"amount"`
	PaymentMethod string  `json:"payment_method"`
	// Client 取值："pc" 或 "mobile"。
	// 支付宝两者均为页面跳转类收银台（PC 收银台页 / 移动端 App 或 WAP），
	// 微信支付则为 Native 扫码（PC）与 H5 跳转（移动端）。
	Client string `json:"client"`
}

// 支付宝网站支付的下单方法与 product_code。
// ⚠️ 站点只签约了「电脑网站支付」与「手机网站支付」两类产品，
// 因此这里不存在当面付（precreate）扫码下单，也不存在小程序下单
// （alipay.trade.create）——任何新增形态都必须同步签约对应产品后才能落到这里。
const (
	alipayMethodPagePay     = "alipay.trade.page.pay"
	alipayMethodWapPay      = "alipay.trade.wap.pay"
	alipayProductCodePC     = "FAST_INSTANT_TRADE_PAY"
	alipayProductCodeMobile = "QUICK_WAP_WAY"
)

// normalizePayClient 收敛客户端类型，仅返回 "pc" 或 "mobile"。
func normalizePayClient(client string) string {
	switch strings.ToLower(strings.TrimSpace(client)) {
	case "mobile", "h5", "wap", "m":
		return "mobile"
	default:
		return "pc"
	}
}

// buildAlipayWebPayParams 构造支付宝网站支付的请求参数（不含 sign）。
//
// client 必须是 normalizePayClient 收敛后的结果：本函数再兜一层，
// 非 "mobile" 一律按 PC 处理，确保除「电脑/手机网站支付」外不会有第三种
// 下单形态从此处泄漏出去。返回值为待签名的公共请求参数集合。
//
// 金额口径：total_amount 与 subject 里的金额都是 payMoney（人民币实付），
// 不再使用站内额度单位——支付宝只收人民币，标题里的数字必须与实扣一致。
func buildAlipayWebPayParams(client, appId, timestamp, tradeNo string, payMoney float64, notifyUrl, returnUrl, quitUrl string) map[string]string {
	method := alipayMethodPagePay
	productCode := alipayProductCodePC
	bizContent := map[string]string{
		"out_trade_no": tradeNo,
		"total_amount": strconv.FormatFloat(payMoney, 'f', 2, 64),
		"subject":      paymentOrderTitle(payMoney),
		"product_code": productCode,
	}
	if client == "mobile" {
		method = alipayMethodWapPay
		bizContent["product_code"] = alipayProductCodeMobile
		// 用户中途退出支付时回到的页面。
		bizContent["quit_url"] = quitUrl
	}
	bizBytes, _ := json.Marshal(bizContent)
	return map[string]string{
		"app_id":      appId,
		"method":      method,
		"format":      "JSON",
		"charset":     "utf-8",
		"sign_type":   "RSA2",
		"timestamp":   timestamp,
		"version":     "1.0",
		"notify_url":  notifyUrl,
		"return_url":  returnUrl,
		"biz_content": string(bizBytes),
	}
}

// alipayWebProductName 返回与人话对应的产品名称，仅用于日志。
func alipayWebProductName(client string) string {
	if client == "mobile" {
		return "手机网站支付"
	}
	return "电脑网站支付"
}

func isAlipayTopUpEnabled() bool {
	return isPaymentComplianceConfirmed() && operation_setting.IsAlipayEnabled()
}

func alipayAmountForStorage(amount float64) float64 {
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount := decimal.NewFromFloat(amount)
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		return dAmount.Div(dQuotaPerUnit).InexactFloat64()
	}
	return amount
}

// RequestAlipayWeb 创建支付宝网站支付订单。
//
// 收银台形态由 req.Client 决定（服务端收敛，未知值降级为 pc）：
//   - pc     → 电脑网站支付 alipay.trade.page.pay，服务端生成带签名的跳转 URL，
//     前端整体上 document.location 到支付宝 PC 收银台，用户付款后由
//     return_url 回到站内钱包页。
//   - mobile → 手机网站支付 alipay.trade.wap.pay，同样返回 pay_url 由前端跳转；
//     额外带 quit_url，用户中途退出时回到站内钱包页而不是落在空白页。
//
// 两者共用同一套异步回调与入账链路（/api/user/alipay/notify）。
// 开通前提：支付宝开放平台已签约「电脑网站支付」（page.pay）与「手机网站支付」（wap）。
func RequestAlipayWeb(c *gin.Context) {
	var req CnWebPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if !isAlipayTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "当前未启用支付宝支付"})
		return
	}
	if req.PaymentMethod != model.PaymentMethodAlipay {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "支付方式不存在"})
		return
	}
	if req.Amount < getMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %s", formatTopUpAmount(getMinTopup()))})
		return
	}
	id := c.GetInt("id")
	if rejectInvalidTopUpQuota(c, id, req.Amount) {
		return
	}
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}
	payMoney := getPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	tradeNo := fmt.Sprintf("USR%dNO%s%s", id, common.GetRandomString(8), strconv.FormatInt(time.Now().Unix(), 10))
	callBackAddress := service.GetCallbackAddress()
	notifyUrl := callBackAddress + "/api/user/alipay/notify"
	client := normalizePayClient(req.Client)

	// 网关口径金额快照：支付宝只收人民币、以「元」传参，这里换算成「分」落库，
	// 回调按同一个整数比对（与微信支付的 ProviderAmount 口径一致）。
	// payMoney 已在 getPayMoney 出口收敛到分，×100 是精确整数，不会出现
	// 「请求体写 6.88、快照算 689」这类偏差。
	totalCents := decimal.NewFromFloat(payMoney).Mul(decimal.NewFromInt(100)).Round(0).IntPart()

	// 公共请求参数（两个接口共用）。
	appId := operation_setting.AlipayAppId
	timestamp := time.Now().Format("2006-01-02 15:04:05")

	returnUrl := paymentReturnPath("/wallet?pay=success")
	quitUrl := paymentReturnPath("/wallet")
	params := buildAlipayWebPayParams(client, appId, timestamp, tradeNo, payMoney, notifyUrl, returnUrl, quitUrl)

	sign, err := service.AlipayBuildSign(params, operation_setting.AlipayPrivateKey)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝签名失败 user_id=%d trade_no=%s client=%s error=%q", id, tradeNo, client, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}
	params["sign"] = sign

	topUp := &model.TopUp{
		UserId:           id,
		Amount:           alipayAmountForStorage(req.Amount),
		Money:            payMoney,
		TradeNo:          tradeNo,
		PaymentMethod:    model.PaymentMethodAlipay,
		PaymentProvider:  model.PaymentProviderAlipay,
		ProviderAmount:   totalCents,
		ProviderCurrency: "CNY",
		CreateTime:       time.Now().Unix(),
		Status:           common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝创建充值订单失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}
	payUrl := operation_setting.AlipayGateway + "?" + toUrlValues(params).Encode()
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("支付宝%s订单创建成功 user_id=%d trade_no=%s amount=%.2f money=%.2f method=%s", alipayWebProductName(client), id, tradeNo, req.Amount, payMoney, params["method"]))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data":    map[string]string{"trade_no": tradeNo, "pay_url": payUrl},
		"url":     payUrl,
	})
}

// alipayPaidAmountMatchesOrder 校验支付宝回传的 total_amount（元）与本地订单一致。
//
// 基准是下单时落库的 ProviderAmount（分）快照；存量订单（快照为空）才回退到
// 由 Money（元）换算。两侧都折算成「分」这个整数口径再比，避免 6.88 与
// 6.880000000000001 之类的浮点差异把合法回调判成不匹配。
func alipayPaidAmountMatchesOrder(paid decimal.Decimal, providerAmount int64, money float64) bool {
	if paid.LessThanOrEqual(decimal.Zero) {
		return false
	}
	expectedCents := providerExpectedMinorUnits(providerAmount, money)
	if expectedCents <= 0 {
		return false
	}
	return paid.Mul(decimal.NewFromInt(100)).Round(0).Equal(decimal.NewFromInt(expectedCents))
}

// AlipayNotify 支付宝异步回调：验签 → 校验交易状态 → 充值入账。
func AlipayNotify(c *gin.Context) {
	var params map[string]string
	if c.Request.Method == "POST" {
		limitPaymentWebhookFormBody(c.Writer, c.Request)
		if err := c.Request.ParseForm(); err != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝 webhook POST 表单解析失败 path=%q client_ip=%s error=%q", c.Request.URL.Path, c.ClientIP(), err.Error()))
			c.String(http.StatusOK, "failure")
			return
		}
		params = loReduceForm(c.Request.PostForm)
	} else {
		params = loReduceForm(c.Request.URL.Query())
	}
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("支付宝 webhook 收到请求 path=%q client_ip=%s method=%s param_count=%d", c.Request.URL.Path, c.ClientIP(), c.Request.Method, len(params)))

	sign := params["sign"]
	if !service.AlipayVerifySign(params, operation_setting.AlipayPublicKey, sign) {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝 webhook 验签失败 path=%q client_ip=%s", c.Request.URL.Path, c.ClientIP()))
		c.String(http.StatusOK, "failure")
		return
	}

	// 归属校验：app_id 必须存在且与本应用一致。
	// 支付宝公钥为应用级，若公钥配置错乱，可能收到其它应用或无归属的回执，
	// 因此 app_id 缺失或不一致都必须拒绝，不得"空值即放行"。
	appID := params["app_id"]
	if appID == "" {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝 webhook 缺少 app_id path=%q client_ip=%s", c.Request.URL.Path, c.ClientIP()))
		c.String(http.StatusOK, "failure")
		return
	}
	if appID != operation_setting.AlipayAppId {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝 webhook app_id 不匹配 path=%q client_ip=%s app_id=%s", c.Request.URL.Path, c.ClientIP(), appID))
		c.String(http.StatusOK, "failure")
		return
	}

	// 金额校验：total_amount 必须与下单时发给支付宝的金额一致。
	// 缺失此校验时，只要 out_trade_no 存在且验签通过即按本地订单金额入账，
	// 与支付宝实际扣款金额脱钩，存在少付多充的风险。
	//
	// 比对基准是下单时落库的 ProviderAmount（分），而不是用 Money（元）现场
	// 再换算一次：两套口径一旦分叉（取整规则变化、历史订单 Money 精度不同），
	// 就会出现「网关按 X 扣款、本地判 Y 不匹配」的永久失败回调。
	totalAmount := params["total_amount"]
	paidAmount, parseErr := decimal.NewFromString(totalAmount)
	if parseErr != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝 webhook total_amount 非法 trade_no=%s total_amount=%q client_ip=%s", params["out_trade_no"], totalAmount, c.ClientIP()))
		c.String(http.StatusOK, "failure")
		return
	}

	tradeNo := params["out_trade_no"]
	tradeStatus := params["trade_status"]
	if tradeStatus != "TRADE_SUCCESS" && tradeStatus != "TRADE_FINISHED" {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("支付宝 webhook 忽略事件 trade_no=%s trade_status=%s", tradeNo, tradeStatus))
		c.String(http.StatusOK, "success")
		return
	}

	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝回调订单不存在 trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
		c.String(http.StatusOK, "failure")
		return
	}
	expectedCents := providerExpectedMinorUnits(topUp.ProviderAmount, topUp.Money)
	if !alipayPaidAmountMatchesOrder(paidAmount, topUp.ProviderAmount, topUp.Money) {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝回调金额不匹配 trade_no=%s 回调金额=%s 本地应付(分)=%d client_ip=%s", tradeNo, totalAmount, expectedCents, c.ClientIP()))
		c.String(http.StatusOK, "failure")
		return
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)
	// actualMethod 传空字符串：回调无法区分该订单是网站支付还是小程序支付，
	// 因此保留下单时写入的 payment_method，不用回调去覆盖。
	alreadyDone, err := model.RechargeAlipay(tradeNo, "", c.ClientIP())
	if err != nil {
		switch {
		case err == model.ErrTopUpNotFound:
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝回调订单不存在 trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
		case err == model.ErrPaymentMethodMismatch:
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝订单支付网关不匹配 trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
		case err == model.ErrTopUpStatusInvalid:
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝订单状态非法 trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
		default:
			logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝充值处理失败 trade_no=%s client_ip=%s error=%q", tradeNo, c.ClientIP(), err.Error()))
		}
		c.String(http.StatusOK, "failure")
		return
	}
	if alreadyDone {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("支付宝重复回调幂等忽略 trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
	} else {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("支付宝充值成功 trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
	}
	c.String(http.StatusOK, "success")
}

func toUrlValues(params map[string]string) url.Values {
	v := url.Values{}
	for k, val := range params {
		v.Set(k, val)
	}
	return v
}

func loReduceForm(form url.Values) map[string]string {
	out := make(map[string]string, len(form))
	for k := range form {
		out[k] = form.Get(k)
	}
	return out
}
