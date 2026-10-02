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
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"time"

	"github.com/Uter-AI/Uter/common"
	"github.com/Uter-AI/Uter/logger"
	"github.com/Uter-AI/Uter/model"
	"github.com/Uter-AI/Uter/service"
	"github.com/Uter-AI/Uter/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

// cnPayHTTPClient 带超时的共享 HTTP 客户端，避免向下游支付网关请求时因连接挂起而耗尽 goroutine。
var cnPayHTTPClient = &http.Client{Timeout: 30 * time.Second}

// wechatOpenidRe 校验小程序支付所需的 openid（微信用户标识）。
var wechatOpenidRe = regexp.MustCompile(`^[A-Za-z0-9_\-]{1,128}$`)

func isWechatPayTopUpEnabled() bool {
	return operation_setting.IsWechatPayEnabled()
}

func wechatAmountForStorage(amount int64) int64 {
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount := decimal.NewFromInt(amount)
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		return dAmount.Div(dQuotaPerUnit).IntPart()
	}
	return amount
}

// RequestWechatPayMiniProgram 创建微信支付小程序支付（JSAPI）预下单。
// 需要小程序端传入 openid，返回 wx.requestPayment 所需的全部参数。
func RequestWechatPayMiniProgram(c *gin.Context) {
	var req CnMiniProgramRequest
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
	if req.Openid == "" || !wechatOpenidRe.MatchString(req.Openid) {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "缺少有效的微信用户标识（openid）"})
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
	notifyUrl := callBackAddress + "/api/user/wechat/notify"
	// 用 decimal 精确换算成分，避免 float64 * 100 的取整误差导致与微信侧金额偏差 1 分。
	totalCents := decimal.NewFromFloat(payMoney).Mul(decimal.NewFromInt(100)).Round(0).IntPart()

	bodyMap := map[string]any{
		"mchid":        operation_setting.WechatPayMchId,
		"appid":        operation_setting.WechatPayAppId,
		"description":  fmt.Sprintf("Uter 充值 %d", req.Amount),
		"out_trade_no": tradeNo,
		"notify_url":   notifyUrl,
		"amount": map[string]any{
			"total":    totalCents,
			"currency": "CNY",
		},
		"payer": map[string]any{
			"openid": req.Openid,
		},
	}
	bodyBytes, _ := json.Marshal(bodyMap)
	bodyStr := string(bodyBytes)

	auth, err := service.WechatPayBuildAuthHeader(
		"POST", "/v3/pay/transactions/jsapi", bodyStr,
		operation_setting.WechatPayMchId, operation_setting.WechatPaySerialNo, operation_setting.WechatPayPrivateKey,
	)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付签名失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	fullURL := operation_setting.WechatPayGateway + "/v3/pay/transactions/jsapi"
	httpReq, err := http.NewRequest("POST", fullURL, bytes.NewReader(bodyBytes))
	if err != nil {
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
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付下单失败 user_id=%d trade_no=%s status=%d body=%q", id, tradeNo, resp.StatusCode, string(respBody)))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	var wxResp struct {
		PrepayId string `json:"prepay_id"`
	}
	if err := json.Unmarshal(respBody, &wxResp); err != nil || wxResp.PrepayId == "" {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付响应解析失败 user_id=%d trade_no=%s body=%q error=%q", id, tradeNo, string(respBody), err))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	topUp := &model.TopUp{
		UserId:          id,
		Amount:          wechatAmountForStorage(req.Amount),
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodWechatPay,
		PaymentProvider: model.PaymentProviderWechatPay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付创建充值订单失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	// 构造小程序调起支付参数（wx.requestPayment）。
	timeStamp := strconv.FormatInt(time.Now().Unix(), 10)
	nonceStr := common.GetRandomString(32)
	paySign, err := service.WechatPayBuildJsapiPaySign(
		operation_setting.WechatPayAppId, timeStamp, nonceStr, wxResp.PrepayId,
		operation_setting.WechatPayPrivateKey,
	)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 paySign 生成失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信小程序充值订单创建成功 user_id=%d trade_no=%s amount=%d money=%.2f", id, tradeNo, req.Amount, payMoney))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": map[string]string{
			"appId":     operation_setting.WechatPayAppId,
			"timeStamp": timeStamp,
			"nonceStr":  nonceStr,
			"package":   "prepay_id=" + wxResp.PrepayId,
			"signType":  "RSA",
			"paySign":   paySign,
		},
	})
}

// WechatPayNotify 微信支付 APIv3 异步回调：验签 → AES-GCM 解密 → 校验交易状态 → 充值入账。
func WechatPayNotify(c *gin.Context) {
	timestamp := c.GetHeader("Wechatpay-Timestamp")
	nonce := c.GetHeader("Wechatpay-Nonce")
	signature := c.GetHeader("Wechatpay-Signature")

	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "读取失败"})
		return
	}
	bodyStr := string(bodyBytes)

	// 防重放：微信支付要求回调时间戳与服务器当前时间偏差不超过 5 分钟。
	if ts, perr := strconv.ParseInt(timestamp, 10, 64); perr != nil {
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "时间戳解析失败"})
		return
	} else {
		now := time.Now().Unix()
		if now-ts > 300 || ts-now > 300 {
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付 webhook 时间戳异常 path=%q client_ip=%s timestamp=%s", c.Request.RequestURI, c.ClientIP(), timestamp))
			c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "时间戳异常"})
			return
		}
	}

	if !service.WechatPayVerifyNotify(timestamp, nonce, bodyStr, signature, operation_setting.WechatPayPlatformCert) {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付 webhook 验签失败 path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "签名验证失败"})
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
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "解析失败"})
		return
	}

	plaintext, err := service.WechatPayDecryptResource(
		notify.Resource.Ciphertext, notify.Resource.Nonce, notify.Resource.AssociatedData,
		operation_setting.WechatPayApiV3Key,
	)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 webhook 解密失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "解密失败"})
		return
	}

	var dec struct {
		OutTradeNo string `json:"out_trade_no"`
		TradeState string `json:"trade_state"`
		Mchid      string `json:"mchid"`
		Appid      string `json:"appid"`
		Amount     struct {
			Total int64 `json:"total"`
		} `json:"amount"`
	}
	if err := json.Unmarshal([]byte(plaintext), &dec); err != nil {
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "解密内容解析失败"})
		return
	}

	// 身份校验：确认回执属于本商户/本小程序。平台证书为微信支付全局共用，
	// 若平台证书配置错误或与他人共用，解密内容可能属于其它商户，
	// 必须校验 mchid / appid 后再入账，否则可能为无关订单入账。
	if dec.Mchid != operation_setting.WechatPayMchId {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付 webhook 商户号不匹配 trade_no=%s mchid=%s client_ip=%s", dec.OutTradeNo, dec.Mchid, c.ClientIP()))
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "商户号不匹配"})
		return
	}
	if dec.Appid != operation_setting.WechatPayAppId {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付 webhook appid 不匹配 trade_no=%s appid=%s client_ip=%s", dec.OutTradeNo, dec.Appid, c.ClientIP()))
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "appid 不匹配"})
		return
	}

	if dec.TradeState != "SUCCESS" {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信支付 webhook 忽略事件 trade_no=%s trade_state=%s", dec.OutTradeNo, dec.TradeState))
		c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": "成功"})
		return
	}

	// 金额校验：回调金额必须与本地订单应付金额一致。
	// 缺失此校验时，只要 trade_no 存在且验签通过即按本地订单金额入账，
	// 与支付网关实际扣款金额脱钩，存在少付多充的风险。
	topUp := model.GetTopUpByTradeNo(dec.OutTradeNo)
	if topUp == nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付回调订单不存在 trade_no=%s client_ip=%s", dec.OutTradeNo, c.ClientIP()))
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "处理失败"})
		return
	}
	// 微信以分为单位下发 total，本地 Money 以元为单位。
	expectedCents := decimal.NewFromFloat(topUp.Money).Mul(decimal.NewFromInt(100)).Round(0).IntPart()
	if dec.Amount.Total <= 0 || dec.Amount.Total != expectedCents {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付回调金额不匹配 trade_no=%s 回调金额(分)=%d 本地应付(分)=%d client_ip=%s", dec.OutTradeNo, dec.Amount.Total, expectedCents, c.ClientIP()))
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "金额不匹配"})
		return
	}

	LockOrder(dec.OutTradeNo)
	defer UnlockOrder(dec.OutTradeNo)
	alreadyDone, err := model.RechargeWechatPay(dec.OutTradeNo, model.PaymentMethodWechatPay, c.ClientIP())
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
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "处理失败"})
		return
	}
	if alreadyDone {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信支付重复回调幂等忽略 trade_no=%s client_ip=%s", dec.OutTradeNo, c.ClientIP()))
	} else {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信支付充值成功 trade_no=%s client_ip=%s", dec.OutTradeNo, c.ClientIP()))
	}
	c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": "成功"})
}
