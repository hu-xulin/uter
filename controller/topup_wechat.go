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
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/uter-ai/uter/i18n"
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

// cnPayHTTPClient 带超时的共享 HTTP 客户端，避免向下游支付网关请求时因连接挂起而耗尽 goroutine。
var cnPayHTTPClient = &http.Client{Timeout: 30 * time.Second}

func isWechatPayTopUpEnabled() bool {
	return isPaymentComplianceConfirmed() && operation_setting.IsWechatPayEnabled()
}

func wechatAmountForStorage(amount float64) float64 {
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount := decimal.NewFromFloat(amount)
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		return dAmount.Div(dQuotaPerUnit).InexactFloat64()
	}
	return amount
}

// buildWechatH5SceneInfo 构造 H5 支付的 scene_info（APIv3 口径）。
//
// 字段名必须是 type / app_name / app_url：APIv3 的 h5_info 没有 APIv2 统一
// 订单里的 wap_url / wap_name，按旧名字传等于既缺 app_name/app_url、又塞了
// 两个未定义字段。payer_client_ip 必填，微信用它做风控与归属判断。
func buildWechatH5SceneInfo(clientIP, appURL string) map[string]any {
	return map[string]any{
		"payer_client_ip": clientIP,
		"h5_info": map[string]any{
			"type":     "Wap",
			"app_name": "Uter",
			"app_url":  appURL,
		},
	}
}

// RequestWechatPayWeb 创建微信支付网站支付订单。
//
// 收银台形态由 req.Client 决定（服务端收敛，未知值降级为 pc）：
//   - pc     → /v3/pay/transactions/native（Native 扫码），返回 code_url
//   - mobile → /v3/pay/transactions/h5（H5 支付），返回 h5_url，前端直接跳转
//
// 共用同一套异步回调与入账链路（/api/user/wechat/notify）。
// 开通前提：商户平台已开通 Native 支付与 H5 支付，且已在「开发配置」登记支付域名。
func RequestWechatPayWeb(c *gin.Context) {
	var req CnWebPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if !isWechatPayTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "当前未启用微信支付"})
		return
	}
	if req.PaymentMethod != model.PaymentMethodWechatPay {
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

	client := normalizePayClient(req.Client)
	apiPath := "/v3/pay/transactions/native"
	if client == "mobile" {
		apiPath = "/v3/pay/transactions/h5"
	}

	tradeNo := fmt.Sprintf("USR%dNO%s%s", id, common.GetRandomString(8), strconv.FormatInt(time.Now().Unix(), 10))
	notifyUrl := service.GetCallbackAddress() + "/api/user/wechat/notify"
	// 用 decimal 精确换算成分，避免 float64 * 100 的取整误差导致与微信侧金额偏差 1 分。
	totalCents := decimal.NewFromFloat(payMoney).Mul(decimal.NewFromInt(100)).Round(0).IntPart()

	bodyMap := map[string]any{
		"mchid":        operation_setting.WechatPayMchId,
		"appid":        operation_setting.WechatPayAppId,
		"description":  paymentOrderTitle(payMoney),
		"out_trade_no": tradeNo,
		"notify_url":   notifyUrl,
		"amount": map[string]any{
			"total":    totalCents,
			"currency": "CNY",
		},
	}
	if client == "mobile" {
		// H5 支付必填 scene_info（含 h5_info.type）；字段名见 buildWechatH5SceneInfo。
		bodyMap["scene_info"] = buildWechatH5SceneInfo(c.ClientIP(), paymentReturnPath("/wallet"))
	}
	bodyBytes, _ := json.Marshal(bodyMap)
	bodyStr := string(bodyBytes)

	// F-07: persist the local pending order BEFORE calling WeChat. WeChat's
	// /v3/pay/transactions/* really creates an order on the provider side, so
	// creating it after the local insert left a window where the user could pay
	// an order the callback had no local record for — money received but never
	// credited. The provider amount/currency snapshot is stored alongside so
	// the callback compares against exactly what was sent.
	topUp := &model.TopUp{
		UserId:           id,
		Amount:           wechatAmountForStorage(req.Amount),
		Money:            payMoney,
		TradeNo:          tradeNo,
		PaymentMethod:    model.PaymentMethodWechatPay,
		PaymentProvider:  model.PaymentProviderWechatPay,
		ProviderAmount:   totalCents,
		ProviderCurrency: "CNY",
		CreateTime:       time.Now().Unix(),
		Status:           common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付创建充值订单失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	auth, err := service.WechatPayBuildAuthHeader(
		"POST", apiPath, bodyStr,
		operation_setting.WechatPayMchId, operation_setting.WechatPaySerialNo, operation_setting.WechatPayPrivateKey,
	)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付签名失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		// Signing happens locally, WeChat never saw this order.
		markTopUpFailed(c, topUp, "wechat pay request signing failed: "+err.Error())
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	httpReq, err := http.NewRequest("POST", operation_setting.WechatPayGateway+apiPath, bytes.NewReader(bodyBytes))
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付请求构造失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		markTopUpFailed(c, topUp, "wechat pay request build failed: "+err.Error())
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}
	httpReq.Header.Set("Authorization", auth)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("User-Agent", "Uter/1.0")

	resp, err := cnPayHTTPClient.Do(httpReq)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付下单请求失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		// The provider state is unknown: the request may have reached WeChat and
		// created an order. Keep the local order pending so a later callback can
		// still credit it, and leave a trail for reconciliation.
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付下单结果不确定，保留 pending 待对账 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}
	defer resp.Body.Close()
	respBody, err := readPaymentProviderAPIResponseBody(resp.Body)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付响应读取失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付下单结果不确定，保留 pending 待对账 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	if resp.StatusCode != http.StatusOK {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付下单失败 user_id=%d trade_no=%s path=%s status=%d body_bytes=%d", id, tradeNo, apiPath, resp.StatusCode, len(respBody)))
		// WeChat answered with a rejection, so no order exists on the provider
		// side and the local order can be closed with the reason recorded.
		markTopUpFailed(c, topUp, fmt.Sprintf("wechat pay order rejected: http_status=%d", resp.StatusCode))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	var wxResp struct {
		CodeUrl string `json:"code_url"`
		H5Url   string `json:"h5_url"`
	}
	if err := json.Unmarshal(respBody, &wxResp); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付响应解析失败 user_id=%d trade_no=%s body_bytes=%d error=%q", id, tradeNo, len(respBody), err))
		// HTTP 200 means WeChat created the order; only the response body is
		// unusable. Keep the order pending so the callback can still credit it.
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付已创建订单但响应无法解析，保留 pending 待对账 user_id=%d trade_no=%s", id, tradeNo))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	var data map[string]string
	switch client {
	case "mobile":
		if wxResp.H5Url == "" {
			logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付未返回 h5_url user_id=%d trade_no=%s body_bytes=%d", id, tradeNo, len(respBody)))
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付已创建订单但缺少支付链接，保留 pending 待对账 user_id=%d trade_no=%s", id, tradeNo))
			c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
			return
		}
		// h5_url 是微信中间页链接，5 分钟有效；只允许在其后覆盖 redirect_url
		// （不得篡改其它参数），用于支付完成后跳回本站。
		payUrl := withH5RedirectUrl(wxResp.H5Url, paymentReturnPath("/wallet?pay=success"))
		data = map[string]string{"trade_no": tradeNo, "h5_url": payUrl}
	default:
		if wxResp.CodeUrl == "" {
			logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付未返回 code_url user_id=%d trade_no=%s body_bytes=%d", id, tradeNo, len(respBody)))
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付已创建订单但缺少支付链接，保留 pending 待对账 user_id=%d trade_no=%s", id, tradeNo))
			c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
			return
		}
		data = map[string]string{"trade_no": tradeNo, "code_url": wxResp.CodeUrl}
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信支付%s订单创建成功 user_id=%d trade_no=%s amount=%.2f money=%.2f", apiPath, id, tradeNo, req.Amount, payMoney))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data":    data,
		"url":     data["h5_url"] + data["code_url"],
	})
}

// withH5RedirectUrl 在微信 H5 中间页链接上覆盖 redirect_url 参数。
// 微信规定该链接只能追加/替换 redirect_url，不得改动其它参数；
// 解析失败时原样返回，避免破坏链接导致支付无法拉起。
func withH5RedirectUrl(h5Url, redirectUrl string) string {
	parsed, err := url.Parse(h5Url)
	if err != nil {
		return h5Url
	}
	q := parsed.Query()
	q.Set("redirect_url", redirectUrl)
	parsed.RawQuery = q.Encode()
	return parsed.String()
}

// WechatPayNotify 微信支付 APIv3 异步回调：验签 → AES-GCM 解密 → 校验交易状态 → 充值入账。
func WechatPayNotify(c *gin.Context) {
	timestamp := c.GetHeader("Wechatpay-Timestamp")
	nonce := c.GetHeader("Wechatpay-Nonce")
	signature := c.GetHeader("Wechatpay-Signature")

	bodyBytes, err := readPaymentWebhookBody(c.Request.Body)
	if err != nil {
		if err == errPaymentWebhookBodyTooLarge {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"code": "FAIL", "message": "Request body too large"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": i18n.T(c, i18n.MsgTopup_wechatRead_failed)})
		return
	}
	bodyStr := string(bodyBytes)

	// 防重放：微信支付要求回调时间戳与服务器当前时间偏差不超过 5 分钟。
	if ts, perr := strconv.ParseInt(timestamp, 10, 64); perr != nil {
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": i18n.T(c, i18n.MsgTopup_wechatTimestamp_parse_failed)})
		return
	} else {
		now := time.Now().Unix()
		if now-ts > 300 || ts-now > 300 {
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付 webhook 时间戳异常 path=%q client_ip=%s timestamp=%s", c.Request.URL.Path, c.ClientIP(), timestamp))
			c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": i18n.T(c, i18n.MsgTopup_wechatTimestamp_abnormal)})
			return
		}
	}

	if !service.WechatPayVerifyNotify(timestamp, nonce, bodyStr, signature, operation_setting.WechatPayPublicKey) {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付 webhook 验签失败 path=%q client_ip=%s", c.Request.URL.Path, c.ClientIP()))
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": i18n.T(c, i18n.MsgTopup_wechatSign_verify_failed)})
		return
	}

	var notify struct {
		Resource struct {
			Ciphertext     string `json:"ciphertext"`
			Nonce          string `json:"nonce"`
			AssociatedData string `json:"associated_data"`
		} `json:"resource"`
	}
	if err := json.Unmarshal(bodyBytes, &notify); err != nil {
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": i18n.T(c, i18n.MsgTopup_wechatParse_failed)})
		return
	}

	plaintext, err := service.WechatPayDecryptResource(
		notify.Resource.Ciphertext, notify.Resource.Nonce, notify.Resource.AssociatedData,
		operation_setting.WechatPayApiV3Key,
	)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 webhook 解密失败 path=%q client_ip=%s error=%q", c.Request.URL.Path, c.ClientIP(), err.Error()))
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": i18n.T(c, i18n.MsgTopup_wechatDecrypt_failed)})
		return
	}

	var dec struct {
		OutTradeNo string `json:"out_trade_no"`
		TradeState string `json:"trade_state"`
		Mchid      string `json:"mchid"`
		Appid      string `json:"appid"`
		Amount     struct {
			Total    int64  `json:"total"`
			Currency string `json:"currency"`
		} `json:"amount"`
	}
	if err := json.Unmarshal([]byte(plaintext), &dec); err != nil {
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": i18n.T(c, i18n.MsgTopup_wechatDecrypt_parse_failed)})
		return
	}

	// 身份校验：确认回执属于本商户/本小程序。微信支付公钥由微信支付全局共用，
	// 若公钥配置错误或与他人共用，解密内容可能属于其它商户，
	// 必须校验 mchid / appid 后再入账，否则可能为无关订单入账。
	if dec.Mchid != operation_setting.WechatPayMchId {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付 webhook 商户号不匹配 trade_no=%s mchid=%s client_ip=%s", dec.OutTradeNo, dec.Mchid, c.ClientIP()))
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": i18n.T(c, i18n.MsgTopup_wechatMch_mismatch)})
		return
	}
	if dec.Appid != operation_setting.WechatPayAppId {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付 webhook appid 不匹配 trade_no=%s appid=%s client_ip=%s", dec.OutTradeNo, dec.Appid, c.ClientIP()))
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": i18n.T(c, i18n.MsgTopup_wechatAppid_mismatch)})
		return
	}

	if dec.TradeState != "SUCCESS" {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信支付 webhook 忽略事件 trade_no=%s trade_state=%s", dec.OutTradeNo, dec.TradeState))
		c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": i18n.T(c, i18n.MsgTopup_wechatSuccess)})
		return
	}

	// 金额校验：回调金额必须与本地订单应付金额一致。
	// 缺失此校验时，只要 trade_no 存在且验签通过即按本地订单金额入账，
	// 与支付网关实际扣款金额脱钩，存在少付多充的风险。
	topUp := model.GetTopUpByTradeNo(dec.OutTradeNo)
	if topUp == nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付回调订单不存在 trade_no=%s client_ip=%s", dec.OutTradeNo, c.ClientIP()))
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": i18n.T(c, i18n.MsgTopup_wechatProcess_failed)})
		return
	}
	// F-18: 回调只能与可信的本地快照比较。下单时已把实际发给微信的金额
	// （分）与币种落到 ProviderAmount / ProviderCurrency，这里优先使用该快照；
	// 存量订单（快照为空）才回退到由 Money 换算，避免用两套口径判等。
	expectedCents := providerExpectedMinorUnits(topUp.ProviderAmount, topUp.Money)
	expectedCurrency := topUp.ProviderCurrency
	if expectedCurrency == "" {
		expectedCurrency = "CNY"
	}
	// 微信支付下单时固定使用 CNY；回调币种必须一致，不能只凭相同的数值入账。
	if !providerCurrencyMatchesOrder(dec.Amount.Currency, expectedCurrency) {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付回调币种不匹配 trade_no=%s currency=%s expected=%s client_ip=%s", dec.OutTradeNo, dec.Amount.Currency, expectedCurrency, c.ClientIP()))
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": i18n.T(c, i18n.MsgTopup_wechatAmount_mismatch)})
		return
	}
	// 微信以分为单位下发 total，本地 Money 以元为单位。
	if dec.Amount.Total <= 0 || dec.Amount.Total != expectedCents {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付回调金额不匹配 trade_no=%s 回调金额(分)=%d 本地应付(分)=%d client_ip=%s", dec.OutTradeNo, dec.Amount.Total, expectedCents, c.ClientIP()))
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": i18n.T(c, i18n.MsgTopup_wechatAmount_mismatch)})
		return
	}

	LockOrder(dec.OutTradeNo)
	defer UnlockOrder(dec.OutTradeNo)
	// actualMethod 传空字符串：回调无法区分该订单是网站支付还是小程序支付，
	// 因此保留下单时写入的 payment_method，不用回调去覆盖。
	alreadyDone, err := model.RechargeWechatPay(dec.OutTradeNo, "", c.ClientIP())
	if err != nil {
		switch {
		case err == model.ErrTopUpNotFound:
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付回调订单不存在 trade_no=%s client_ip=%s", dec.OutTradeNo, c.ClientIP()))
		case err == model.ErrPaymentMethodMismatch:
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付订单支付网关不匹配 trade_no=%s client_ip=%s", dec.OutTradeNo, c.ClientIP()))
		case err == model.ErrTopUpStatusInvalid:
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付订单状态非法 trade_no=%s client_ip=%s", dec.OutTradeNo, c.ClientIP()))
		default:
			logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付充值处理失败 trade_no=%s client_ip=%s error=%q", dec.OutTradeNo, c.ClientIP(), err.Error()))
		}
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": i18n.T(c, i18n.MsgTopup_wechatProcess_failed)})
		return
	}
	if alreadyDone {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信支付重复回调幂等忽略 trade_no=%s client_ip=%s", dec.OutTradeNo, c.ClientIP()))
	} else {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信支付充值成功 trade_no=%s client_ip=%s", dec.OutTradeNo, c.ClientIP()))
	}
	c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": i18n.T(c, i18n.MsgTopup_wechatSuccess)})
}

// WechatReconcileStatus 是「用一次查单结果推进本地订单」之后的结论。
//
// 它同时服务于两条入口：用户从收银台回跳后的主动查单接口，以及后台对账任务。
// 两者必须走完全相同的判定与入账路径——否则「接口能入账、任务不能」这类分叉
// 会让对账变成摆设。状态值与支付宝对齐，便于前端轮询 helper 复用。
type WechatReconcileStatus string

const (
	// WechatReconcileSuccess 已付款且金额一致，入账完成（或此前已入账）。
	WechatReconcileSuccess WechatReconcileStatus = "success"
	// WechatReconcilePending 微信侧交易存在但尚未付清（NOTPAY / USERPAYING），值得继续等。
	WechatReconcilePending WechatReconcileStatus = "pending"
	// WechatReconcileUnpaid 微信侧查无此交易，用户从未进入付款流程（终态）。
	WechatReconcileUnpaid WechatReconcileStatus = "unpaid"
	// WechatReconcileClosed 微信侧交易已关闭 / 撤销 / 支付失败（终态）。
	WechatReconcileClosed WechatReconcileStatus = "closed"
	// WechatReconcileAmountMismatch 网关金额/币种与下单快照不符，拒绝入账。
	WechatReconcileAmountMismatch WechatReconcileStatus = "amount_mismatch"
	// WechatReconcileCreditFailed 入账写库失败，订单保持 pending 待重试。
	WechatReconcileCreditFailed WechatReconcileStatus = "credit_failed"
)

func QueryWechatOrder(c *gin.Context) {
	var req WechatQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.TradeNo) == "" {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if !isWechatPayTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "当前未启用微信支付"})
		return
	}
	id := c.GetInt("id")
	topUp := model.GetTopUpByTradeNo(strings.TrimSpace(req.TradeNo))
	// 归属校验：只能查询自己的微信订单，且 provider 必须是微信支付。
	if topUp == nil || topUp.UserId != id || topUp.PaymentProvider != model.PaymentProviderWechatPay {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "订单不存在"})
		return
	}
	if topUp.Status == common.TopUpStatusSuccess {
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"status": "success"}})
		return
	}

	result, err := service.WechatQueryOrder(c.Request.Context(), topUp.TradeNo)
	if err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信主动查单失败 trade_no=%s user_id=%d error=%q", topUp.TradeNo, id, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "查询订单失败"})
		return
	}
	status := applyWechatQueryResult(c.Request.Context(), topUp, result, c.ClientIP())
	switch status {
	case WechatReconcileSuccess:
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"status": "success"}})
	case WechatReconcileAmountMismatch:
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": gin.H{"status": "amount_mismatch"}})
	case WechatReconcileCreditFailed:
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": gin.H{"status": "credit_failed"}})
	default:
		// pending / unpaid / closed 都是「查询成功，结论是还没付清或已终态」，
		// 用 message=success 下发，让前端按 data.status 决定是继续等还是提示用户。
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"status": string(status)}})
	}
}

// applyWechatQueryResult 用一次查单结果推进本地订单。
//
// 幂等由 model.RechargeWechatPay 的状态 CAS 保证：重复调用只会命中「已入账」，
// 不会重复加额度。因此主动查单、后台对账、异步回调三者可以安全并存。
// 金额/币种校验口径与异步回调 WechatPayNotify 完全一致，避免两条路径判等分歧。
func applyWechatQueryResult(ctx context.Context, topUp *model.TopUp, result *service.WechatQueryResult, callerIp string) WechatReconcileStatus {
	if topUp == nil || result == nil {
		return WechatReconcileCreditFailed
	}

	// 终态 / 未付款先分流，避免落到下方的金额校验。
	switch result.TradeState {
	case service.WechatTradeStateSuccess:
		// 继续走下方金额 + 币种校验与入账。
	case service.WechatTradeStateClosed, "REVOKED", "PAYERROR":
		// 这些状态不会再变为 SUCCESS，把本地订单落过期，让列表不再显示「待确认」。
		if err := model.UpdatePendingTopUpStatus(topUp.TradeNo, model.PaymentProviderWechatPay, common.TopUpStatusExpired); err != nil &&
			!errors.Is(err, model.ErrTopUpStatusInvalid) {
			logger.LogWarn(ctx, fmt.Sprintf("微信对账标记订单过期失败 trade_no=%s user_id=%d error=%q", topUp.TradeNo, topUp.UserId, err.Error()))
		}
		return WechatReconcileClosed
	case service.WechatTradeStateNotExist:
		// 微信侧查无此交易：用户可能尚未付款或订单已失效，保留 pending 等待后续付款或回跳。
		return WechatReconcileUnpaid
	case "NOTPAY", "USERPAYING":
		return WechatReconcilePending
	default:
		return WechatReconcilePending
	}

	// SUCCESS：币种 + 金额比对（与异步回调同一口径）。
	expectedCurrency := topUp.ProviderCurrency
	if expectedCurrency == "" {
		expectedCurrency = "CNY"
	}
	if !providerCurrencyMatchesOrder(result.Currency, expectedCurrency) {
		logger.LogWarn(ctx, fmt.Sprintf("微信查单币种不匹配 trade_no=%s currency=%s expected=%s", topUp.TradeNo, result.Currency, expectedCurrency))
		return WechatReconcileAmountMismatch
	}
	expectedCents := providerExpectedMinorUnits(topUp.ProviderAmount, topUp.Money)
	if expectedCents <= 0 || result.Total != expectedCents {
		logger.LogWarn(ctx, fmt.Sprintf("微信查单金额不匹配 trade_no=%s 查单金额(分)=%d 本地应付(分)=%d", topUp.TradeNo, result.Total, expectedCents))
		return WechatReconcileAmountMismatch
	}

	LockOrder(topUp.TradeNo)
	defer UnlockOrder(topUp.TradeNo)
	alreadyDone, err := model.RechargeWechatPay(topUp.TradeNo, "", callerIp)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("微信查单入账失败 trade_no=%s user_id=%d error=%q", topUp.TradeNo, topUp.UserId, err.Error()))
		return WechatReconcileCreditFailed
	}
	if alreadyDone {
		logger.LogInfo(ctx, fmt.Sprintf("微信查单幂等忽略 trade_no=%s user_id=%d source=%s", topUp.TradeNo, topUp.UserId, callerIp))
	} else {
		logger.LogInfo(ctx, fmt.Sprintf("微信查单确认入账 trade_no=%s user_id=%d source=%s", topUp.TradeNo, topUp.UserId, callerIp))
	}
	return WechatReconcileSuccess
}

// WechatQueryRequest 主动查单请求。
type WechatQueryRequest struct {
	TradeNo string `json:"trade_no"`
}

// QueryWechatOrder 主动查询微信支付订单并确认入账。
//
// 异步回调（notify_url）在本地 / 内网环境不可达时会缺失，订单会一直停在 pending。
// 用户从收银台回到站内（或在钱包页打开充值记录）后由前端调用本接口：服务端向微信
// 查询真实状态，成功则走与异步回调完全相同的金额校验 + 幂等入账链路
// （RechargeWechatPay 的 CAS 保证只入账一次），因此可以安全地与回调并存。
//
// 返回 data.status 的取值与支付宝对齐：
//   - success 已付款且金额一致，入账完成（或此前已入账）
//   - pending 微信侧交易存在但尚未付清（NOTPAY / USERPAYING），值得继续等
//   - unpaid  微信侧查无此交易，用户从未进入付款流程（终态）
//   - closed  微信侧交易已关闭（终态），本地订单同时置为过期
