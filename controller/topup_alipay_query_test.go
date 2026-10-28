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

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/

package controller

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
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

// setupAlipayQueryEnv 准备支付宝主动查单所需的运行环境：
// 内存库 + 已确认合规 + 已启用的支付宝直连 + 指向本地 mock 的网关。
//
// mock 网关按 outTradeNo 回一段已签名的 alipay_trade_query_response，
// 让用例可以自由构造「已付款 / 未付款 / 金额不符」等场景。
func setupAlipayQueryEnv(t *testing.T, node func(outTradeNo string) string) *gorm.DB {
	t.Helper()
	db := setupCallbackSecurityDB(t)

	privatePEM, publicPEM := generateCallbackTestKeyPair(t)

	var gateway *httptest.Server
	gateway = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		outTradeNo := ""
		var biz struct {
			OutTradeNo string `json:"out_trade_no"`
		}
		if err := json.Unmarshal([]byte(r.PostForm.Get("biz_content")), &biz); err == nil {
			outTradeNo = biz.OutTradeNo
		}
		payload := node(outTradeNo)
		fmt.Fprintf(w, `{"alipay_trade_query_response":%s,"sign":%q}`, payload, alipayTestSign(payload, privatePEM))
	}))
	t.Cleanup(gateway.Close)

	prevGateway := operation_setting.AlipayGateway
	prevAppId := operation_setting.AlipayAppId
	prevPrivate := operation_setting.AlipayPrivateKey
	prevPublic := operation_setting.AlipayPublicKey
	prevEnabled := operation_setting.AlipayEnabled
	compliance := operation_setting.GetPaymentSetting()
	prevConfirmed := compliance.ComplianceConfirmed
	prevTerms := compliance.ComplianceTermsVersion
	t.Cleanup(func() {
		operation_setting.AlipayGateway = prevGateway
		operation_setting.AlipayAppId = prevAppId
		operation_setting.AlipayPrivateKey = prevPrivate
		operation_setting.AlipayPublicKey = prevPublic
		operation_setting.AlipayEnabled = prevEnabled
		compliance.ComplianceConfirmed = prevConfirmed
		compliance.ComplianceTermsVersion = prevTerms
	})

	operation_setting.AlipayGateway = gateway.URL
	operation_setting.AlipayAppId = "2021000000000000"
	operation_setting.AlipayPrivateKey = privatePEM
	operation_setting.AlipayPublicKey = publicPEM
	operation_setting.AlipayEnabled = true
	compliance.ComplianceConfirmed = true
	compliance.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	return db
}

// alipayTestSign 用 PKCS#8 私钥 PEM 对响应业务节点原文做 RSA2 签名。
// 支付宝签的是节点原文，服务端必须用同一段字节验签，故这里不做任何重排。
func alipayTestSign(content, privatePEM string) string {
	block, _ := pem.Decode([]byte(privatePEM))
	if block == nil {
		panic("alipayTestSign: invalid PEM")
	}
	parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		panic(err)
	}
	key, ok := parsed.(*rsa.PrivateKey)
	if !ok {
		panic("alipayTestSign: not an RSA key")
	}
	hashed := sha256.Sum256([]byte(content))
	sig, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, hashed[:])
	if err != nil {
		panic(err)
	}
	return base64.StdEncoding.EncodeToString(sig)
}

// alipayQueryOrder 建一笔支付宝直连的待支付订单。
func alipayQueryOrder(t *testing.T, db *gorm.DB, userId int, tradeNo string, quotaAmount float64, money float64, providerAmount int64) *model.TopUp {
	t.Helper()
	order := &model.TopUp{
		UserId:           userId,
		Amount:           quotaAmount,
		Money:            money,
		TradeNo:          tradeNo,
		PaymentMethod:    model.PaymentMethodAlipay,
		PaymentProvider:  model.PaymentProviderAlipay,
		ProviderAmount:   providerAmount,
		ProviderCurrency: "CNY",
		CreateTime:       common.GetTimestamp(),
		Status:           common.TopUpStatusPending,
	}
	require.NoError(t, db.Create(order).Error)
	return order
}

// callQueryAlipayOrder 以指定用户身份调用主动查单接口。
func callQueryAlipayOrder(t *testing.T, userId int, body string) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodPost, "/api/user/alipay/query", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = "192.0.2.8:4567"
	c.Request = req
	c.Set("id", userId)
	QueryAlipayOrder(c)

	var payload map[string]any
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &payload))
	return recorder.Code, payload
}

func alipayQueryData(t *testing.T, payload map[string]any) map[string]any {
	t.Helper()
	data, ok := payload["data"].(map[string]any)
	require.Truef(t, ok, "expected data object, got %#v", payload["data"])
	return data
}

// 支付宝确认已付款且金额与下单快照一致时，必须完成入账：
// 这是「本地收不到异步回调」场景下订单不再停在待确认的唯一兜底。
func TestQueryAlipayOrderCreditsPaidOrder(t *testing.T) {
	db := setupAlipayQueryEnv(t, func(outTradeNo string) string {
		return fmt.Sprintf(`{"code":"10000","msg":"Success","trade_status":"TRADE_SUCCESS","total_amount":"10.00","out_trade_no":%q}`, outTradeNo)
	})

	user := &model.User{Username: "alipay_query_paid", AffCode: "aqpaid", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(user).Error)
	order := alipayQueryOrder(t, db, user.Id, "ALIPAY-QUERY-PAID", 2, 10, 1000)

	code, payload := callQueryAlipayOrder(t, user.Id, `{"trade_no":"ALIPAY-QUERY-PAID"}`)
	require.Equal(t, http.StatusOK, code)
	require.Equal(t, "success", payload["message"])
	assert.Equal(t, "success", alipayQueryData(t, payload)["status"])

	var stored model.TopUp
	require.NoError(t, db.Where("trade_no = ?", "ALIPAY-QUERY-PAID").First(&stored).Error)
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

// 支付宝回报的实付金额与下单快照不符时必须拒绝入账，且订单保持 pending：
// 否则「付 0.01 充 10 元」的少付漏洞会从异步回调平移到主动查单。
func TestQueryAlipayOrderRejectsAmountMismatch(t *testing.T) {
	db := setupAlipayQueryEnv(t, func(outTradeNo string) string {
		return fmt.Sprintf(`{"code":"10000","msg":"Success","trade_status":"TRADE_SUCCESS","total_amount":"0.01","out_trade_no":%q}`, outTradeNo)
	})

	user := &model.User{Username: "alipay_query_mismatch", AffCode: "aqmis", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(user).Error)
	alipayQueryOrder(t, db, user.Id, "ALIPAY-QUERY-MISMATCH", 2, 10, 1000)

	code, payload := callQueryAlipayOrder(t, user.Id, `{"trade_no":"ALIPAY-QUERY-MISMATCH"}`)
	require.Equal(t, http.StatusOK, code)
	assert.Equal(t, "error", payload["message"])
	assert.Equal(t, "订单金额不匹配", payload["data"])

	var stored model.TopUp
	require.NoError(t, db.Where("trade_no = ?", "ALIPAY-QUERY-MISMATCH").First(&stored).Error)
	assert.Equal(t, common.TopUpStatusPending, stored.Status)

	var reloaded model.User
	require.NoError(t, db.First(&reloaded, user.Id).Error)
	assert.Zero(t, reloaded.Quota)
}

// 只能查自己的订单：拿别人的 trade_no 必须查不到，避免泄露订单状态。
func TestQueryAlipayOrderRejectsForeignOrder(t *testing.T) {
	db := setupAlipayQueryEnv(t, func(outTradeNo string) string {
		return fmt.Sprintf(`{"code":"10000","msg":"Success","trade_status":"TRADE_SUCCESS","total_amount":"10.00","out_trade_no":%q}`, outTradeNo)
	})

	owner := &model.User{Username: "alipay_query_owner", AffCode: "aqown", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(owner).Error)
	intruder := &model.User{Username: "alipay_query_intruder", AffCode: "aqint", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(intruder).Error)
	alipayQueryOrder(t, db, owner.Id, "ALIPAY-QUERY-FOREIGN", 2, 10, 1000)

	code, payload := callQueryAlipayOrder(t, intruder.Id, `{"trade_no":"ALIPAY-QUERY-FOREIGN"}`)
	require.Equal(t, http.StatusOK, code)
	assert.Equal(t, "error", payload["message"])
	assert.Equal(t, "订单不存在", payload["data"])

	var stored model.TopUp
	require.NoError(t, db.Where("trade_no = ?", "ALIPAY-QUERY-FOREIGN").First(&stored).Error)
	assert.Equal(t, common.TopUpStatusPending, stored.Status)
}

// 异步回调已经入账时，主动查单必须幂等：返回 success 但不重复加额度。
func TestQueryAlipayOrderIsIdempotentAfterCallback(t *testing.T) {
	db := setupAlipayQueryEnv(t, func(outTradeNo string) string {
		return fmt.Sprintf(`{"code":"10000","msg":"Success","trade_status":"TRADE_SUCCESS","total_amount":"10.00","out_trade_no":%q}`, outTradeNo)
	})

	user := &model.User{Username: "alipay_query_idem", AffCode: "aqidem", Status: common.UserStatusEnabled, Quota: 5000}
	require.NoError(t, db.Create(user).Error)
	alipayQueryOrder(t, db, user.Id, "ALIPAY-QUERY-IDEM", 2, 10, 1000)

	// 第一次查单入账。
	_, payload := callQueryAlipayOrder(t, user.Id, `{"trade_no":"ALIPAY-QUERY-IDEM"}`)
	assert.Equal(t, "success", alipayQueryData(t, payload)["status"])
	var afterFirst model.User
	require.NoError(t, db.First(&afterFirst, user.Id).Error)

	// 第二次查单：订单已 success，走早返回，额度不变。
	_, payload = callQueryAlipayOrder(t, user.Id, `{"trade_no":"ALIPAY-QUERY-IDEM"}`)
	assert.Equal(t, "success", alipayQueryData(t, payload)["status"])
	var afterSecond model.User
	require.NoError(t, db.First(&afterSecond, user.Id).Error)
	assert.Equal(t, afterFirst.Quota, afterSecond.Quota)
}

// 支付宝侧查无此交易时必须回 unpaid 而不是 pending：
// 用户下单后从未进入付款流程，再轮询也不会有任何变化。若回 pending，前端会
// 一直提示「支付确认中」，订单永远停在「待确认」——这正是线上两笔 ¥0.06
// 订单显示待确认的原因。
func TestQueryAlipayOrderReportsUnpaidWhenTradeNotExist(t *testing.T) {
	db := setupAlipayQueryEnv(t, func(outTradeNo string) string {
		return `{"code":"40004","msg":"Business Failed","sub_code":"ACQ.TRADE_NOT_EXIST","sub_msg":"交易不存在"}`
	})

	user := &model.User{Username: "alipay_query_unpaid", AffCode: "aqunp", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(user).Error)
	alipayQueryOrder(t, db, user.Id, "ALIPAY-QUERY-UNPAID", 2, 10, 1000)

	code, payload := callQueryAlipayOrder(t, user.Id, `{"trade_no":"ALIPAY-QUERY-UNPAID"}`)
	require.Equal(t, http.StatusOK, code)
	// 仍返回 message=success：这是「查询成功，结论是未支付」，不是查询故障。
	require.Equal(t, "success", payload["message"])
	assert.Equal(t, "unpaid", alipayQueryData(t, payload)["status"])

	// 本地订单保持 pending：用户仍可能用原 pay_url 完成付款，提前置过期会让
	// 他付了钱却入不了账。
	var stored model.TopUp
	require.NoError(t, db.Where("trade_no = ?", "ALIPAY-QUERY-UNPAID").First(&stored).Error)
	assert.Equal(t, common.TopUpStatusPending, stored.Status)

	var reloaded model.User
	require.NoError(t, db.First(&reloaded, user.Id).Error)
	assert.Zero(t, reloaded.Quota)
}

// 交易存在但买家还没付（WAIT_BUYER_PAY）时回 pending，前端应当继续等：
// 与「查无此交易」不同，这类订单几秒后就会变成 TRADE_SUCCESS。
func TestQueryAlipayOrderReportsPendingWhenWaitBuyerPay(t *testing.T) {
	db := setupAlipayQueryEnv(t, func(outTradeNo string) string {
		return fmt.Sprintf(`{"code":"10000","msg":"Success","trade_status":"WAIT_BUYER_PAY","out_trade_no":%q}`, outTradeNo)
	})

	user := &model.User{Username: "alipay_query_waitpay", AffCode: "aqwait", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(user).Error)
	alipayQueryOrder(t, db, user.Id, "ALIPAY-QUERY-WAITPAY", 2, 10, 1000)

	code, payload := callQueryAlipayOrder(t, user.Id, `{"trade_no":"ALIPAY-QUERY-WAITPAY"}`)
	require.Equal(t, http.StatusOK, code)
	require.Equal(t, "success", payload["message"])
	assert.Equal(t, "pending", alipayQueryData(t, payload)["status"])

	var stored model.TopUp
	require.NoError(t, db.Where("trade_no = ?", "ALIPAY-QUERY-WAITPAY").First(&stored).Error)
	assert.Equal(t, common.TopUpStatusPending, stored.Status)
}

// 支付宝侧交易已关闭（TRADE_CLOSED）是终态，本地订单必须落到过期，
// 否则列表会永远显示「待确认」；同时额度不能增加。
func TestQueryAlipayOrderExpiresClosedTrade(t *testing.T) {
	db := setupAlipayQueryEnv(t, func(outTradeNo string) string {
		return fmt.Sprintf(`{"code":"10000","msg":"Success","trade_status":"TRADE_CLOSED","out_trade_no":%q}`, outTradeNo)
	})

	user := &model.User{Username: "alipay_query_closed", AffCode: "aqcls", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(user).Error)
	alipayQueryOrder(t, db, user.Id, "ALIPAY-QUERY-CLOSED", 2, 10, 1000)

	code, payload := callQueryAlipayOrder(t, user.Id, `{"trade_no":"ALIPAY-QUERY-CLOSED"}`)
	require.Equal(t, http.StatusOK, code)
	require.Equal(t, "success", payload["message"])
	assert.Equal(t, "closed", alipayQueryData(t, payload)["status"])

	var stored model.TopUp
	require.NoError(t, db.Where("trade_no = ?", "ALIPAY-QUERY-CLOSED").First(&stored).Error)
	assert.Equal(t, common.TopUpStatusExpired, stored.Status)

	var reloaded model.User
	require.NoError(t, db.First(&reloaded, user.Id).Error)
	assert.Zero(t, reloaded.Quota)
}
