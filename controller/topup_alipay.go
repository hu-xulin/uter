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
	"context"
	"encoding/json"
	"errors"
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
		// 必须与入账口径（getTopUpQuota 的 IntPart 取整）对齐：订单金额存
		// 精确商（600000 tokens → 1.2）而入账只给整单元（1.0），回调比对
		// 与对账都会认为「1.2 已入账」，用户付 1.2 只拿到 1.0 的额度。
		return float64(dAmount.Div(dQuotaPerUnit).IntPart())
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
	// 回跳与回调默认跟随当前请求站点：本地测试从 localhost 进来就回 localhost，
	// 生产从 uter.ai 进来就回 uter.ai，不再固定用配置的支付站点域名（uter.cc）。
	// 运营显式配置 CustomCallbackAddress 时，异步回调仍以它为准（见 paymentNotifyURLFor）。
	origin := requestOrigin(c)
	notifyUrl := paymentNotifyURLFor(origin) + "/api/user/alipay/notify"
	client := normalizePayClient(req.Client)

	// 网关口径金额快照：支付宝只收人民币、以「元」传参，这里换算成「分」落库，
	// 回调按同一个整数比对（与微信支付的 ProviderAmount 口径一致）。
	// payMoney 已在 getPayMoney 出口收敛到分，×100 是精确整数，不会出现
	// 「请求体写 6.88、快照算 689」这类偏差。
	totalCents := decimal.NewFromFloat(payMoney).Mul(decimal.NewFromInt(100)).Round(0).IntPart()

	// 公共请求参数（两个接口共用）。
	appId := operation_setting.AlipayAppId
	timestamp := time.Now().Format("2006-01-02 15:04:05")

	// return_url 带上 trade_no：前端回到钱包页后可主动查单确认，作为「本地收不到
	// 异步回调」时的兜底（见 controller.QueryAlipayOrder）。
	returnUrl := paymentReturnURLFor(origin, "/wallet?pay=success&trade_no="+tradeNo)
	quitUrl := paymentReturnURLFor(origin, "/wallet")
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

// AlipayQueryRequest 主动查单请求。
type AlipayQueryRequest struct {
	TradeNo string `json:"trade_no"`
}

// QueryAlipayOrder 主动查询支付宝订单并确认入账。
//
// 异步回调（notify_url）在本地 / 内网环境不可达时会缺失，订单会一直停在 pending。
// 用户从收银台回到站内（return_url 带 trade_no）后由前端调用本接口：服务端向支付宝
// 查询真实状态，成功则走与异步回调完全相同的金额校验 + 幂等入账链路
// （RechargeAlipay 的 CAS 保证只入账一次），因此可以安全地与回调并存。
//
// 返回的 data.status 有四种取值，前端据此决定是继续轮询还是直接告知用户：
//   - success  已付款且金额一致，入账完成（或此前已入账）
//   - pending  支付宝侧交易存在但尚未付清（WAIT_BUYER_PAY），值得继续等
//   - unpaid   支付宝侧查无此交易，用户从未进入付款流程，再等也不会变
//   - closed   支付宝侧交易已关闭（终态），本地订单同时置为过期
func QueryAlipayOrder(c *gin.Context) {
	var req AlipayQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.TradeNo) == "" {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if !isAlipayTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "当前未启用支付宝支付"})
		return
	}
	id := c.GetInt("id")
	topUp := model.GetTopUpByTradeNo(strings.TrimSpace(req.TradeNo))
	// 归属校验：只能查询自己的支付宝订单，且 provider 必须是支付宝。
	if topUp == nil || topUp.UserId != id || topUp.PaymentProvider != model.PaymentProviderAlipay {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "订单不存在"})
		return
	}
	if topUp.Status == common.TopUpStatusSuccess {
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"status": "success"}})
		return
	}

	result, err := service.AlipayQueryOrder(c.Request.Context(), topUp.TradeNo)
	if err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝主动查单失败 trade_no=%s user_id=%d error=%q", topUp.TradeNo, id, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "查询订单失败"})
		return
	}
	// 未付清时按真实原因区分返回，不再一律回 pending。
	//
	// 这里曾经把「支付宝侧查无此交易」(TRADE_NOT_EXIST) 也归进 pending，结果是：
	// 用户下单后没有真正付款，钱包里那条记录会一直停在「待确认」，既不变成功也
	// 不变失败。查单拿到 TRADE_NOT_EXIST 意味着支付宝侧根本没有这笔交易，再轮询
	// 一万次也不会有变化，必须如实告诉前端「未支付」而不是「确认中」。
	status := applyAlipayQueryResult(c.Request.Context(), topUp, result, c.ClientIP())
	switch status {
	case AlipayReconcileSuccess:
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"status": "success"}})
	case AlipayReconcileAmountMismatch:
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "订单金额不匹配"})
	case AlipayReconcileCreditFailed:
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值处理失败"})
	default:
		// pending / unpaid / closed 都是「查询成功，结论是还没付清」，
		// 用 message=success 下发，让前端按 data.status 决定是继续等还是提示用户。
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"status": string(status)}})
	}
}

// AlipayReconcileStatus 是「用一次查单结果推进本地订单」之后的结论。
//
// 它同时服务于两条入口：用户从收银台回跳后的主动查单接口，以及后台对账任务。
// 两者必须走完全相同的判定与入账路径——否则「接口能入账、任务不能」这类分叉
// 会让对账变成摆设。
type AlipayReconcileStatus string

const (
	// AlipayReconcileSuccess 已付款且金额一致，入账完成（或此前已入账）。
	AlipayReconcileSuccess AlipayReconcileStatus = "success"
	// AlipayReconcilePending 支付宝侧交易存在但尚未付清（WAIT_BUYER_PAY）。
	AlipayReconcilePending AlipayReconcileStatus = "pending"
	// AlipayReconcileUnpaid 支付宝侧查无此交易，用户从未进入付款流程。
	AlipayReconcileUnpaid AlipayReconcileStatus = "unpaid"
	// AlipayReconcileClosed 支付宝侧交易已关闭（终态），本地订单已置为过期。
	AlipayReconcileClosed AlipayReconcileStatus = "closed"
	// AlipayReconcileAmountMismatch 网关金额与下单快照不符，拒绝入账。
	AlipayReconcileAmountMismatch AlipayReconcileStatus = "amount_mismatch"
	// AlipayReconcileCreditFailed 入账写库失败，订单保持 pending 待重试。
	AlipayReconcileCreditFailed AlipayReconcileStatus = "credit_failed"
)

// applyAlipayQueryResult 用一次查单结果推进本地订单。
//
// 幂等由 model.RechargeAlipay 的状态 CAS 保证：重复调用只会命中「已入账」，
// 不会重复加额度。因此主动查单、后台对账、异步回调三者可以安全并存。
func applyAlipayQueryResult(ctx context.Context, topUp *model.TopUp, result *service.AlipayQueryResult, callerIp string) AlipayReconcileStatus {
	if topUp == nil || result == nil {
		return AlipayReconcileCreditFailed
	}
	if strings.TrimSpace(result.OutTradeNo) == "" || strings.TrimSpace(result.OutTradeNo) != strings.TrimSpace(topUp.TradeNo) {
		logger.LogWarn(ctx, fmt.Sprintf("支付宝查单订单号不匹配 local=%s provider=%s", topUp.TradeNo, result.OutTradeNo))
		return AlipayReconcileAmountMismatch
	}
	if currency := strings.TrimSpace(topUp.ProviderCurrency); currency != "" && !strings.EqualFold(currency, "CNY") {
		logger.LogWarn(ctx, fmt.Sprintf("支付宝订单币种不受支持 trade_no=%s currency=%s", topUp.TradeNo, currency))
		return AlipayReconcileAmountMismatch
	}
	if result.TradeStatus != "TRADE_SUCCESS" && result.TradeStatus != "TRADE_FINISHED" {
		if result.TradeStatus == service.AlipayTradeStatusClosed {
			// TRADE_CLOSED 是终态（超时未付款或用户主动关闭），不可能再付款成功，
			// 因此可以安全地把本地订单落到过期，让列表不再显示「待确认」。
			if err := model.UpdatePendingTopUpStatus(topUp.TradeNo, model.PaymentProviderAlipay, common.TopUpStatusExpired); err != nil &&
				!errors.Is(err, model.ErrTopUpStatusInvalid) {
				logger.LogWarn(ctx, fmt.Sprintf("支付宝主动查单标记订单过期失败 trade_no=%s user_id=%d error=%q", topUp.TradeNo, topUp.UserId, err.Error()))
			}
			return AlipayReconcileClosed
		}
		if result.TradeStatus == service.AlipayTradeStatusNotExist {
			// 不改本地订单状态：用户仍可能重新打开下单时拿到的 pay_url 完成付款，
			// 届时支付宝会用同一个 out_trade_no 建单并回调成功；提前把订单置成
			// 过期会让他付了钱却入不了账。
			return AlipayReconcileUnpaid
		}
		return AlipayReconcilePending
	}

	paidAmount, parseErr := decimal.NewFromString(strings.TrimSpace(result.TotalAmount))
	if parseErr != nil || !alipayPaidAmountMatchesOrder(paidAmount, topUp.ProviderAmount, topUp.Money) {
		logger.LogWarn(ctx, fmt.Sprintf("支付宝主动查单金额不匹配 trade_no=%s 查单金额=%q", topUp.TradeNo, result.TotalAmount))
		return AlipayReconcileAmountMismatch
	}

	LockOrder(topUp.TradeNo)
	defer UnlockOrder(topUp.TradeNo)
	alreadyDone, err := model.RechargeAlipay(topUp.TradeNo, "", callerIp)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("支付宝主动查单入账失败 trade_no=%s user_id=%d error=%q", topUp.TradeNo, topUp.UserId, err.Error()))
		return AlipayReconcileCreditFailed
	}
	if alreadyDone {
		logger.LogInfo(ctx, fmt.Sprintf("支付宝查单幂等忽略 trade_no=%s user_id=%d source=%s", topUp.TradeNo, topUp.UserId, callerIp))
	} else {
		logger.LogInfo(ctx, fmt.Sprintf("支付宝查单确认入账 trade_no=%s user_id=%d source=%s", topUp.TradeNo, topUp.UserId, callerIp))
	}
	return AlipayReconcileSuccess
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
	if currency := strings.TrimSpace(topUp.ProviderCurrency); currency != "" && !strings.EqualFold(currency, "CNY") {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝回调订单币种不受支持 trade_no=%s currency=%s", tradeNo, currency))
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
