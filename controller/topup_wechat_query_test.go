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

For commercial licensing, please contact support@uter.ai
*/

package controller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting/operation_setting"
)

// setupWechatQueryEnv 准备微信支付主动查单所需的运行环境：
// 内存库 + 已确认合规 + 已启用的微信支付直连 + 指向本地 mock 的网关。
//
// mock 网关按 out_trade_no 回一段交易详情 JSON（或 404 表示查无此交易），
// 让用例可以自由构造「已付款 / 未付款 / 金额不符 / 已关闭」等场景。
// 与支付宝不同，微信查单接口只做 TLS 传输层校验，响应不签名，
// 因此 mock 只需返回明文 JSON，无需对响应做 RSA 签名。
func setupWechatQueryEnv(t *testing.T, node func(outTradeNo string) (status int, body string)) *gorm.DB {
	t.Helper()
	db := setupCallbackSecurityDB(t)

	privatePEM, publicPEM := generateCallbackTestKeyPair(t)

	var gateway *httptest.Server
	gateway = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		outTradeNo := ""
		if idx := strings.LastIndex(r.URL.Path, "/"); idx >= 0 {
			outTradeNo = r.URL.Path[idx+1:]
		}
		status, body := node(outTradeNo)
		if status == http.StatusNotFound {
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(body))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(gateway.Close)

	prevGateway := operation_setting.WechatPayGateway
	prevMchId := operation_setting.WechatPayMchId
	prevAppId := operation_setting.WechatPayAppId
	prevApiV3Key := operation_setting.WechatPayApiV3Key
	prevSerial := operation_setting.WechatPaySerialNo
	prevPrivate := operation_setting.WechatPayPrivateKey
	prevPublic := operation_setting.WechatPayPublicKey
	prevEnabled := operation_setting.WechatPayEnabled
	compliance := operation_setting.GetPaymentSetting()
	prevConfirmed := compliance.ComplianceConfirmed
	prevTerms := compliance.ComplianceTermsVersion
	t.Cleanup(func() {
		operation_setting.WechatPayGateway = prevGateway
		operation_setting.WechatPayMchId = prevMchId
		operation_setting.WechatPayAppId = prevAppId
		operation_setting.WechatPayApiV3Key = prevApiV3Key
		operation_setting.WechatPaySerialNo = prevSerial
		operation_setting.WechatPayPrivateKey = prevPrivate
		operation_setting.WechatPayPublicKey = prevPublic
		operation_setting.WechatPayEnabled = prevEnabled
		compliance.ComplianceConfirmed = prevConfirmed
		compliance.ComplianceTermsVersion = prevTerms
	})

	operation_setting.WechatPayGateway = gateway.URL
	operation_setting.WechatPayMchId = "1752071965"
	operation_setting.WechatPayAppId = "wx0000000000000000"
	operation_setting.WechatPayApiV3Key = strings.Repeat("k", 32)
	operation_setting.WechatPaySerialNo = "SERIALNO"
	operation_setting.WechatPayPrivateKey = privatePEM
	operation_setting.WechatPayPublicKey = publicPEM
	operation_setting.WechatPayEnabled = true
	compliance.ComplianceConfirmed = true
	compliance.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	return db
}

// wechatQueryOrder 建一笔微信支付直连的待支付订单。
func wechatQueryOrder(t *testing.T, db *gorm.DB, userId int, tradeNo string, quotaAmount float64, money float64, providerAmount int64) *model.TopUp {
	t.Helper()
	order := &model.TopUp{
		UserId:           userId,
		Amount:           quotaAmount,
		Money:            money,
		TradeNo:          tradeNo,
		PaymentMethod:    model.PaymentMethodWechatPay,
		PaymentProvider:  model.PaymentProviderWechatPay,
		ProviderAmount:   providerAmount,
		ProviderCurrency: "CNY",
		CreateTime:       common.GetTimestamp(),
		Status:           common.TopUpStatusPending,
	}
	require.NoError(t, db.Create(order).Error)
	return order
}

// callQueryWechatOrder 以指定用户身份调用微信主动查单接口。
func callQueryWechatOrder(t *testing.T, userId int, body string) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodPost, "/api/user/wechat/query", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = "192.0.2.8:4567"
	c.Request = req
	c.Set("id", userId)
	QueryWechatOrder(c)

	var payload map[string]any
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &payload))
	return recorder.Code, payload
}

func wechatQueryData(t *testing.T, payload map[string]any) map[string]any {
	t.Helper()
	data, ok := payload["data"].(map[string]any)
	require.Truef(t, ok, "expected data object, got %#v", payload["data"])
	return data
}

func wechatSuccessNode(outTradeNo string) (int, string) {
	return http.StatusOK, fmt.Sprintf(
		`{"trade_state":"SUCCESS","out_trade_no":%q,"mchid":"1752071965","appid":"wx0000000000000000","amount":{"total":1000,"currency":"CNY"}}`, outTradeNo)
}

// 微信确认已付款且金额与下单快照一致时，必须完成入账：
// 这是「本地收不到异步回调」场景下订单不再停在待确认的唯一兜底。
func TestQueryWechatOrderCreditsPaidOrder(t *testing.T) {
	db := setupWechatQueryEnv(t, wechatSuccessNode)

	user := &model.User{Username: "wechat_query_paid", AffCode: "wqpaid", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(user).Error)
	order := wechatQueryOrder(t, db, user.Id, "WECHAT-QUERY-PAID", 2, 10, 1000)

	code, payload := callQueryWechatOrder(t, user.Id, `{"trade_no":"WECHAT-QUERY-PAID"}`)
	require.Equal(t, http.StatusOK, code)
	require.Equal(t, "success", payload["message"])
	assert.Equal(t, "success", wechatQueryData(t, payload)["status"])

	var stored model.TopUp
	require.NoError(t, db.Where("trade_no = ?", "WECHAT-QUERY-PAID").First(&stored).Error)
	assert.Equal(t, common.TopUpStatusSuccess, stored.Status)
	assert.NotZero(t, stored.CompleteTime)

	var reloaded model.User
	require.NoError(t, db.First(&reloaded, user.Id).Error)
	expectedQuota, err := common.WalletQuotaFromDecimalStrict(
		decimal.NewFromFloat(order.Amount).Mul(decimal.NewFromFloat(common.QuotaPerUnit)),
	)
	require.NoError(t, err)
	assert.Equal(t, expectedQuota, reloaded.Quota)
}

// 微信回报的实付金额与下单快照不符时必须拒绝入账，且订单保持 pending：
// 否则「付 0.01 充 10 元」的少付漏洞会从异步回调平移到主动查单。
func TestQueryWechatOrderRejectsAmountMismatch(t *testing.T) {
	db := setupWechatQueryEnv(t, func(outTradeNo string) (int, string) {
		return http.StatusOK, fmt.Sprintf(
			`{"trade_state":"SUCCESS","out_trade_no":%q,"mchid":"1752071965","appid":"wx0000000000000000","amount":{"total":1,"currency":"CNY"}}`, outTradeNo)
	})

	user := &model.User{Username: "wechat_query_mismatch", AffCode: "wqmis", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(user).Error)
	wechatQueryOrder(t, db, user.Id, "WECHAT-QUERY-MISMATCH", 2, 10, 1000)

	code, payload := callQueryWechatOrder(t, user.Id, `{"trade_no":"WECHAT-QUERY-MISMATCH"}`)
	require.Equal(t, http.StatusOK, code)
	assert.Equal(t, "error", payload["message"])
	assert.Equal(t, "amount_mismatch", wechatQueryData(t, payload)["status"])

	var stored model.TopUp
	require.NoError(t, db.Where("trade_no = ?", "WECHAT-QUERY-MISMATCH").First(&stored).Error)
	assert.Equal(t, common.TopUpStatusPending, stored.Status)

	var reloaded model.User
	require.NoError(t, db.First(&reloaded, user.Id).Error)
	assert.Zero(t, reloaded.Quota)
}

// 只能查自己的订单：拿别人的 trade_no 必须查不到，避免泄露订单状态。
func TestQueryWechatOrderRejectsForeignOrder(t *testing.T) {
	db := setupWechatQueryEnv(t, wechatSuccessNode)

	owner := &model.User{Username: "wechat_query_owner", AffCode: "wqown", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(owner).Error)
	intruder := &model.User{Username: "wechat_query_intruder", AffCode: "wqint", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(intruder).Error)
	wechatQueryOrder(t, db, owner.Id, "WECHAT-QUERY-FOREIGN", 2, 10, 1000)

	code, payload := callQueryWechatOrder(t, intruder.Id, `{"trade_no":"WECHAT-QUERY-FOREIGN"}`)
	require.Equal(t, http.StatusOK, code)
	assert.Equal(t, "error", payload["message"])
	assert.Equal(t, "订单不存在", payload["data"])

	var stored model.TopUp
	require.NoError(t, db.Where("trade_no = ?", "WECHAT-QUERY-FOREIGN").First(&stored).Error)
	assert.Equal(t, common.TopUpStatusPending, stored.Status)
}

// 异步回调已经入账时，主动查单必须幂等：返回 success 但不重复加额度。
func TestQueryWechatOrderIsIdempotentAfterCallback(t *testing.T) {
	db := setupWechatQueryEnv(t, wechatSuccessNode)

	user := &model.User{Username: "wechat_query_idem", AffCode: "wqidem", Status: common.UserStatusEnabled, Quota: 5000}
	require.NoError(t, db.Create(user).Error)
	wechatQueryOrder(t, db, user.Id, "WECHAT-QUERY-IDEM", 2, 10, 1000)

	_, payload := callQueryWechatOrder(t, user.Id, `{"trade_no":"WECHAT-QUERY-IDEM"}`)
	assert.Equal(t, "success", wechatQueryData(t, payload)["status"])
	var afterFirst model.User
	require.NoError(t, db.First(&afterFirst, user.Id).Error)

	_, payload = callQueryWechatOrder(t, user.Id, `{"trade_no":"WECHAT-QUERY-IDEM"}`)
	assert.Equal(t, "success", wechatQueryData(t, payload)["status"])
	var afterSecond model.User
	require.NoError(t, db.First(&afterSecond, user.Id).Error)
	assert.Equal(t, afterFirst.Quota, afterSecond.Quota)
}

// 微信侧查无此交易（404）时必须回 unpaid 而不是 pending：用户下单后从未进入付款
// 流程，再轮询也不会有任何变化。若回 pending，前端会一直提示「支付确认中」。
func TestQueryWechatOrderReportsUnpaidWhenTradeNotExist(t *testing.T) {
	db := setupWechatQueryEnv(t, func(outTradeNo string) (int, string) {
		return http.StatusNotFound, `{"code":"ORDER_NOT_EXIST","message":"订单不存在"}`
	})

	user := &model.User{Username: "wechat_query_unpaid", AffCode: "wqunp", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(user).Error)
	wechatQueryOrder(t, db, user.Id, "WECHAT-QUERY-UNPAID", 2, 10, 1000)

	code, payload := callQueryWechatOrder(t, user.Id, `{"trade_no":"WECHAT-QUERY-UNPAID"}`)
	require.Equal(t, http.StatusOK, code)
	require.Equal(t, "success", payload["message"])
	assert.Equal(t, "unpaid", wechatQueryData(t, payload)["status"])

	var stored model.TopUp
	require.NoError(t, db.Where("trade_no = ?", "WECHAT-QUERY-UNPAID").First(&stored).Error)
	assert.Equal(t, common.TopUpStatusPending, stored.Status)

	var reloaded model.User
	require.NoError(t, db.First(&reloaded, user.Id).Error)
	assert.Zero(t, reloaded.Quota)
}

// 交易存在但用户还没付（NOTPAY）时回 pending，前端应当继续等。
func TestQueryWechatOrderReportsPendingWhenNotPay(t *testing.T) {
	db := setupWechatQueryEnv(t, func(outTradeNo string) (int, string) {
		return http.StatusOK, fmt.Sprintf(
			`{"trade_state":"NOTPAY","out_trade_no":%q,"mchid":"1752071965","appid":"wx0000000000000000","amount":{"total":1000,"currency":"CNY"}}`, outTradeNo)
	})

	user := &model.User{Username: "wechat_query_notpay", AffCode: "wqntp", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(user).Error)
	wechatQueryOrder(t, db, user.Id, "WECHAT-QUERY-NOTPAY", 2, 10, 1000)

	code, payload := callQueryWechatOrder(t, user.Id, `{"trade_no":"WECHAT-QUERY-NOTPAY"}`)
	require.Equal(t, http.StatusOK, code)
	require.Equal(t, "success", payload["message"])
	assert.Equal(t, "pending", wechatQueryData(t, payload)["status"])

	var stored model.TopUp
	require.NoError(t, db.Where("trade_no = ?", "WECHAT-QUERY-NOTPAY").First(&stored).Error)
	assert.Equal(t, common.TopUpStatusPending, stored.Status)
}

// 微信侧交易已关闭（CLOSED）是终态，本地订单必须落到过期，
// 否则列表会永远显示「待确认」；同时额度不能增加。
func TestQueryWechatOrderExpiresClosedTrade(t *testing.T) {
	db := setupWechatQueryEnv(t, func(outTradeNo string) (int, string) {
		return http.StatusOK, fmt.Sprintf(
			`{"trade_state":"CLOSED","out_trade_no":%q,"mchid":"1752071965","appid":"wx0000000000000000","amount":{"total":1000,"currency":"CNY"}}`, outTradeNo)
	})

	user := &model.User{Username: "wechat_query_closed", AffCode: "wqcls", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(user).Error)
	wechatQueryOrder(t, db, user.Id, "WECHAT-QUERY-CLOSED", 2, 10, 1000)

	code, payload := callQueryWechatOrder(t, user.Id, `{"trade_no":"WECHAT-QUERY-CLOSED"}`)
	require.Equal(t, http.StatusOK, code)
	require.Equal(t, "success", payload["message"])
	assert.Equal(t, "closed", wechatQueryData(t, payload)["status"])

	var stored model.TopUp
	require.NoError(t, db.Where("trade_no = ?", "WECHAT-QUERY-CLOSED").First(&stored).Error)
	assert.Equal(t, common.TopUpStatusExpired, stored.Status)

	var reloaded model.User
	require.NoError(t, db.First(&reloaded, user.Id).Error)
	assert.Zero(t, reloaded.Quota)
}
