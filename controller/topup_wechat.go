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
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

package controller

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
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

// RequestWechatPay 创建微信支付 Native 扫码订单，返回 code_url 供前端生成二维码。
func RequestWechatPay(c *gin.Context) {
	var req EpayRequest
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
	}
	bodyBytes, _ := json.Marshal(bodyMap)
	bodyStr := string(bodyBytes)

	auth, err := service.WechatPayBuildAuthHeader(
		"POST", "/v3/pay/transactions/native", bodyStr,
		operation_setting.WechatPayMchId, operation_setting.WechatPaySerialNo, operation_setting.WechatPayPrivateKey,
	)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付签名失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	fullURL := operation_setting.WechatPayGateway + "/v3/pay/transactions/native"
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
		CodeURL string `json:"code_url"`
	}
	if err := json.Unmarshal(respBody, &wxResp); err != nil || wxResp.CodeURL == "" {
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
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信支付充值订单创建成功 user_id=%d trade_no=%s amount=%d money=%.2f", id, tradeNo, req.Amount, payMoney))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data":    map[string]string{"code_url": wxResp.CodeURL},
		"url":     wxResp.CodeURL,
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
	}
	if err := json.Unmarshal([]byte(plaintext), &dec); err != nil {
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "解密内容解析失败"})
		return
	}

	if dec.TradeState != "SUCCESS" {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信支付 webhook 忽略事件 trade_no=%s trade_state=%s", dec.OutTradeNo, dec.TradeState))
		c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": "成功"})
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
