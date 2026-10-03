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
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/Uter-AI/Uter/common"
	"github.com/Uter-AI/Uter/logger"
	"github.com/Uter-AI/Uter/model"
	"github.com/Uter-AI/Uter/service"
	"github.com/Uter-AI/Uter/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

// alipayBuyerIdRe 校验小程序支付所需的 buyer_id（支付宝用户 user_id，纯数字）。
var alipayBuyerIdRe = regexp.MustCompile(`^[0-9]{16,32}$`)

// CnMiniProgramRequest 小程序支付下单请求。
// openid / buyer_id 由小程序客户端在登录后获取并传入，仅用于构造对应支付方订单，
// 充值入账始终绑定到当前登录用户（c.GetInt("id")）。
type CnMiniProgramRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`
	// WeChat 小程序：微信用户 openid（同一 appid 下）。
	Openid string `json:"openid"`
	// 支付宝小程序：支付宝用户 user_id（buyer_id）。
	BuyerId string `json:"buyer_id"`
}

// CnWebPaymentRequest 网站支付（Web 收银台）下单请求。
// client 决定收银台形态，由前端按视口/UA 传入；服务端只接受白名单值，
// 未知值一律降级为 pc，避免客户端下发任意字符串影响下单参数。
type CnWebPaymentRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`
	// Client 取值："pc"（扫码）或 "mobile"（跳转 App / H5 收银台）。
	Client string `json:"client"`
}

// normalizePayClient 收敛客户端类型，仅返回 "pc" 或 "mobile"。
func normalizePayClient(client string) string {
	switch strings.ToLower(strings.TrimSpace(client)) {
	case "mobile", "h5", "wap", "m":
		return "mobile"
	default:
		return "pc"
	}
}

func isAlipayTopUpEnabled() bool {
	return operation_setting.IsAlipayEnabled()
}

func alipayAmountForStorage(amount int64) int64 {
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount := decimal.NewFromInt(amount)
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		return dAmount.Div(dQuotaPerUnit).IntPart()
	}
	return amount
}

// RequestAlipayMiniProgram 创建支付宝小程序支付（alipay.trade.create）预下单。
// 需要小程序端传入 buyer_id（支付宝用户 user_id），返回 tradeNO 供 my.tradePay 调起。
func RequestAlipayMiniProgram(c *gin.Context) {
	var req CnMiniProgramRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if !isAlipayTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "当前未启用支付宝支付"})
		return
	}
	if req.PaymentMethod != model.PaymentMethodAlipayMiniProgram {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "支付方式不存在"})
		return
	}
	if req.BuyerId == "" || !alipayBuyerIdRe.MatchString(req.BuyerId) {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "缺少有效的支付宝用户标识（buyer_id）"})
		return
	}
	if req.Amount < getMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", getMinTopup())})
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

	bizContent := map[string]string{
		"out_trade_no": tradeNo,
		"total_amount": strconv.FormatFloat(payMoney, 'f', 2, 64),
		"subject":      fmt.Sprintf("Uter 充值 %d", req.Amount),
		"buyer_id":     req.BuyerId,
	}
	bizBytes, _ := json.Marshal(bizContent)
	params := map[string]string{
		"app_id":     operation_setting.AlipayAppId,
		"method":     "alipay.trade.create",
		"format":     "JSON",
		"charset":    "utf-8",
		"sign_type":  "RSA2",
		"timestamp":  time.Now().Format("2006-01-02 15:04:05"),
		"version":    "1.0",
		"notify_url": notifyUrl,
		"biz_content": string(bizBytes),
	}
	sign, err := service.AlipayBuildSign(params, operation_setting.AlipayPrivateKey)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝签名失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}
	params["sign"] = sign

	resp, err := cnPayHTTPClient.PostForm(operation_setting.AlipayGateway, toUrlValues(params))
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝下单请求失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var alipayResp struct {
		AlipayTradeCreateResponse struct {
			Code    string `json:"code"`
			Msg     string `json:"msg"`
			SubMsg  string `json:"sub_msg"`
			TradeNo string `json:"trade_no"`
		} `json:"alipay_trade_create_response"`
	}
	if err := json.Unmarshal(body, &alipayResp); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝响应解析失败 user_id=%d trade_no=%s body=%q error=%q", id, tradeNo, string(body), err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}
	r := alipayResp.AlipayTradeCreateResponse
	if r.Code != "10000" || r.TradeNo == "" {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝下单失败 user_id=%d trade_no=%s code=%s msg=%s sub=%s", id, tradeNo, r.Code, r.Msg, r.SubMsg))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败：" + r.Msg})
		return
	}

	topUp := &model.TopUp{
		UserId:          id,
		Amount:          alipayAmountForStorage(req.Amount),
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodAlipayMiniProgram,
		PaymentProvider: model.PaymentProviderAlipay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝创建充值订单失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("支付宝小程序充值订单创建成功 user_id=%d trade_no=%s amount=%d money=%.2f", id, tradeNo, req.Amount, payMoney))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data":    map[string]string{"trade_no": r.TradeNo},
		"url":     r.TradeNo,
	})
}

// RequestAlipayWeb 创建支付宝网站支付订单。
//
// 收银台形态由 req.Client 决定（服务端收敛，未知值降级为 pc）：
//   - pc     → alipay.trade.precreate（当面付扫码），返回 qr_code 供前端渲染二维码
//   - mobile → alipay.trade.wap.pay（手机网站支付），返回 pay_url 供前端直接跳转
//
// 两者共用同一套异步回调与入账链路（/api/user/alipay/notify）。
// 开通前提：支付宝开放平台已签约「当面付」（precreate）与「手机网站支付」（wap）。
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
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", getMinTopup())})
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

	// 公共请求参数（两个接口共用）。
	appId := operation_setting.AlipayAppId
	timestamp := time.Now().Format("2006-01-02 15:04:05")

	if client == "mobile" {
		// 手机网站支付：alipay.trade.wap.pay 是页面跳转类接口，服务端只负责
		// 生成带签名的完整跳转 URL，由前端 window.location 跳转。
		bizContent := map[string]string{
			"out_trade_no": tradeNo,
			"total_amount": strconv.FormatFloat(payMoney, 'f', 2, 64),
			"subject":      fmt.Sprintf("Uter 充值 %d", req.Amount),
			"product_code": "QUICK_WAP_WAY",
			// 用户中途退出支付时回到的页面。
			"quit_url": paymentReturnPath("/wallet"),
		}
		bizBytes, _ := json.Marshal(bizContent)
		params := map[string]string{
			"app_id":      appId,
			"method":      "alipay.trade.wap.pay",
			"format":      "JSON",
			"charset":     "utf-8",
			"sign_type":   "RSA2",
			"timestamp":   timestamp,
			"version":     "1.0",
			"notify_url":  notifyUrl,
			"return_url":  paymentReturnPath("/wallet?pay=success"),
			"biz_content": string(bizBytes),
		}
		sign, err := service.AlipayBuildSign(params, operation_setting.AlipayPrivateKey)
		if err != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝签名失败 user_id=%d trade_no=%s client=mobile error=%q", id, tradeNo, err.Error()))
			c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
			return
		}
		params["sign"] = sign

		topUp := &model.TopUp{
			UserId:          id,
			Amount:          alipayAmountForStorage(req.Amount),
			Money:           payMoney,
			TradeNo:         tradeNo,
			PaymentMethod:   model.PaymentMethodAlipay,
			PaymentProvider: model.PaymentProviderAlipay,
			CreateTime:      time.Now().Unix(),
			Status:          common.TopUpStatusPending,
		}
		if err := topUp.Insert(); err != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝创建充值订单失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
			c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
			return
		}
		payUrl := operation_setting.AlipayGateway + "?" + toUrlValues(params).Encode()
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("支付宝手机网站支付订单创建成功 user_id=%d trade_no=%s amount=%d money=%.2f", id, tradeNo, req.Amount, payMoney))
		c.JSON(http.StatusOK, gin.H{
			"message": "success",
			"data":    map[string]string{"trade_no": tradeNo, "pay_url": payUrl},
			"url":     payUrl,
		})
		return
	}

	// PC：当面付扫码支付 alipay.trade.precreate，返回 qr_code。
	bizContent := map[string]string{
		"out_trade_no": tradeNo,
		"total_amount": strconv.FormatFloat(payMoney, 'f', 2, 64),
		"subject":      fmt.Sprintf("Uter 充值 %d", req.Amount),
	}
	bizBytes, _ := json.Marshal(bizContent)
	params := map[string]string{
		"app_id":      appId,
		"method":      "alipay.trade.precreate",
		"format":      "JSON",
		"charset":     "utf-8",
		"sign_type":   "RSA2",
		"timestamp":   timestamp,
		"version":     "1.0",
		"notify_url":  notifyUrl,
		"biz_content": string(bizBytes),
	}
	sign, err := service.AlipayBuildSign(params, operation_setting.AlipayPrivateKey)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝签名失败 user_id=%d trade_no=%s client=pc error=%q", id, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}
	params["sign"] = sign

	resp, err := cnPayHTTPClient.PostForm(operation_setting.AlipayGateway, toUrlValues(params))
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝下单请求失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var alipayResp struct {
		AlipayTradePrecreateResponse struct {
			Code    string `json:"code"`
			Msg     string `json:"msg"`
			SubMsg  string `json:"sub_msg"`
			QrCode  string `json:"qr_code"`
			TradeNo string `json:"out_trade_no"`
		} `json:"alipay_trade_precreate_response"`
	}
	if err := json.Unmarshal(body, &alipayResp); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝响应解析失败 user_id=%d trade_no=%s body=%q error=%q", id, tradeNo, string(body), err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}
	r := alipayResp.AlipayTradePrecreateResponse
	if r.Code != "10000" || r.QrCode == "" {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝下单失败 user_id=%d trade_no=%s code=%s msg=%s sub=%s", id, tradeNo, r.Code, r.Msg, r.SubMsg))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败：" + r.Msg})
		return
	}

	topUp := &model.TopUp{
		UserId:          id,
		Amount:          alipayAmountForStorage(req.Amount),
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodAlipay,
		PaymentProvider: model.PaymentProviderAlipay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝创建充值订单失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("支付宝扫码支付订单创建成功 user_id=%d trade_no=%s amount=%d money=%.2f", id, tradeNo, req.Amount, payMoney))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data":    map[string]string{"trade_no": tradeNo, "qr_code": r.QrCode},
		"url":     r.QrCode,
	})
}

// AlipayNotify 支付宝异步回调：验签 → 校验交易状态 → 充值入账。
func AlipayNotify(c *gin.Context) {
	var params map[string]string
	if c.Request.Method == "POST" {
		if err := c.Request.ParseForm(); err != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝 webhook POST 表单解析失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
			c.String(http.StatusOK, "failure")
			return
		}
		params = loReduceForm(c.Request.PostForm)
	} else {
		params = loReduceForm(c.Request.URL.Query())
	}
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("支付宝 webhook 收到请求 path=%q client_ip=%s method=%s params=%q", c.Request.RequestURI, c.ClientIP(), c.Request.Method, common.GetJsonString(params)))

	sign := params["sign"]
	if !service.AlipayVerifySign(params, operation_setting.AlipayPublicKey, sign) {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝 webhook 验签失败 path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.String(http.StatusOK, "failure")
		return
	}

	// 归属校验：app_id 必须存在且与本应用一致。
	// 支付宝公钥为应用级，若公钥配置错乱，可能收到其它应用或无归属的回执，
	// 因此 app_id 缺失或不一致都必须拒绝，不得"空值即放行"。
	appID := params["app_id"]
	if appID == "" {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝 webhook 缺少 app_id path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.String(http.StatusOK, "failure")
		return
	}
	if appID != operation_setting.AlipayAppId {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝 webhook app_id 不匹配 path=%q client_ip=%s app_id=%s", c.Request.RequestURI, c.ClientIP(), appID))
		c.String(http.StatusOK, "failure")
		return
	}

	// 金额校验：total_amount 必须与本地订单应付金额一致。
	// 缺失此校验时，只要 out_trade_no 存在且验签通过即按本地订单金额入账，
	// 与支付宝实际扣款金额脱钩，存在少付多充的风险。
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
	if paidAmount.LessThanOrEqual(decimal.Zero) || !paidAmount.Equal(decimal.NewFromFloat(topUp.Money).Round(2)) {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝回调金额不匹配 trade_no=%s 回调金额=%s 本地应付=%.2f client_ip=%s", tradeNo, totalAmount, topUp.Money, c.ClientIP()))
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
