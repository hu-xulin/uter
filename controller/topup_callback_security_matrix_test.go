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
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/i18n"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting"
	"github.com/uter-ai/uter/setting/operation_setting"
)

/*
 * F-16 / F-20：支付回调的**运行期**安全矩阵。
 *
 * 已有的 topup_gateway_contract_test.go 是源码结构检查——它能证明「验签调用写在
 * 入账之前」，却证明不了「伪造回调真的被挡住」。这里对每个渠道各跑一次真实请求：
 *
 *   1. 配好该渠道的验签凭据（真实 RSA 密钥，不是空串），
 *   2. 发一个签名被篡改的回调，
 *   3. 断言 HTTP 响应是「拒绝」，且本地订单仍是 pending、用户额度分毫未动。
 *
 * 每个渠道必须独立通过。某个渠道安全不代表另一个渠道安全——这正是报告要求
 * 「不要以某个渠道通过测试推断其他渠道安全」的原因。
 */

// callbackCase 描述一个渠道的「伪造回调」用例。
type callbackCase struct {
	name    string
	path    string
	handler gin.HandlerFunc
	// route 是注册到 gin 的路由模式；留空表示与 path 相同。
	// Waffo Pancake 的 env 是路径参数（`:env`），用静态 path 注册会让
	// c.Param("env") 取到空串、直接 404，测不到验签分支。
	route string
	// setup 配置该渠道的验签凭据；缺了它 handler 会走「未配置」分支，
	// 测到的就不是验签逻辑了。
	setup func(t *testing.T)
	// request 构造一个签名被篡改的回调请求。
	request func(t *testing.T, path string) *http.Request
	// wantStatus 是拒绝时返回的 HTTP 状态码。各供应商契约不同，不能统一。
	wantStatus int
	// wantBodyContains 是响应体里必须出现的拒绝标记（为空表示不校验）。
	wantBodyContains string
}

func setupCallbackSecurityDB(t *testing.T) *gorm.DB {
	t.Helper()
	gin.SetMode(gin.TestMode)
	prevDB, prevLog := model.DB, model.LOG_DB
	prevMain, prevLogType := common.MainDatabaseType(), common.LogDatabaseType()
	prevRedis := common.RedisEnabled
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, i18n.Init())
	require.NoError(t, db.AutoMigrate(
		&model.User{}, &model.TopUp{}, &model.Log{}, &model.Option{},
	))
	model.DB, model.LOG_DB = db, db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	model.InitColumnNames()
	t.Cleanup(func() {
		model.DB, model.LOG_DB = prevDB, prevLog
		common.SetDatabaseTypes(prevMain, prevLogType)
		common.RedisEnabled = prevRedis
	})
	return db
}

// generateCallbackTestKeyPair 生成一对真实 RSA 密钥，分别返回 PKCS#8 私钥 PEM
// 与 SPKI 公钥 PEM。用真密钥而不是空串，才能确认 handler 真的走到了验签分支。
func generateCallbackTestKeyPair(t *testing.T) (privatePEM string, publicPEM string) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	pkcs8, err := x509.MarshalPKCS8PrivateKey(key)
	require.NoError(t, err)
	privatePEM = string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: pkcs8}))

	spki, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	require.NoError(t, err)
	publicPEM = string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: spki}))
	return privatePEM, publicPEM
}

func callbackTestUserAndOrder(t *testing.T, db *gorm.DB, tradeNo string, provider string) *model.User {
	t.Helper()
	suffix := strings.ToLower(strings.TrimPrefix(tradeNo, "CALLBACK-SECURITY-"))
	user := &model.User{
		// Username 与 AffCode 都带唯一索引：每个用例各建一个用户，
		// 否则第二个用例会撞 `UNIQUE constraint failed: users.aff_code`。
		Username: "callback_security_" + suffix,
		AffCode:  "cbsec" + suffix,
		Status:   common.UserStatusEnabled,
		Quota:    0,
	}
	require.NoError(t, db.Create(user).Error)
	order := &model.TopUp{
		UserId:          user.Id,
		Amount:          2,
		Money:           10,
		TradeNo:         tradeNo,
		PaymentMethod:   "test",
		PaymentProvider: provider,
		CreateTime:      common.GetTimestamp(),
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, db.Create(order).Error)
	return user
}

func TestPaymentCallbacksRejectForgedSignatures(t *testing.T) {
	db := setupCallbackSecurityDB(t)

	prevStripeSecret := setting.StripeWebhookSecret
	prevCreemSecret := setting.CreemWebhookSecret
	prevWaffoApiKey := setting.WaffoApiKey
	prevWaffoPrivateKey := setting.WaffoPrivateKey
	prevWaffoPublicCert := setting.WaffoPublicCert
	prevWaffoSandbox := setting.WaffoSandbox
	prevPancakeMerchant := setting.WaffoPancakeMerchantID
	prevPancakePrivateKey := setting.WaffoPancakePrivateKey
	prevPancakeStoreID := setting.WaffoPancakeStoreID
	prevAlipayAppId := operation_setting.AlipayAppId
	prevAlipayPublicKey := operation_setting.AlipayPublicKey
	t.Cleanup(func() {
		setting.StripeWebhookSecret = prevStripeSecret
		setting.CreemWebhookSecret = prevCreemSecret
		setting.WaffoApiKey = prevWaffoApiKey
		setting.WaffoPrivateKey = prevWaffoPrivateKey
		setting.WaffoPublicCert = prevWaffoPublicCert
		setting.WaffoSandbox = prevWaffoSandbox
		setting.WaffoPancakeMerchantID = prevPancakeMerchant
		setting.WaffoPancakePrivateKey = prevPancakePrivateKey
		setting.WaffoPancakeStoreID = prevPancakeStoreID
		operation_setting.AlipayAppId = prevAlipayAppId
		operation_setting.AlipayPublicKey = prevAlipayPublicKey
	})

	waffoPrivateKey, waffoPublicKey := generateCallbackTestKeyPair(t)

	cases := []callbackCase{
		{
			// 支付宝：验签失败必须回 "failure"，让网关重试；绝不能回 "success"。
			name:    "alipay",
			path:    "/api/user/alipay/notify",
			handler: AlipayNotify,
			setup: func(t *testing.T) {
				operation_setting.AlipayAppId = "2021000000000000"
				operation_setting.AlipayPublicKey = waffoPublicKey
			},
			request: func(t *testing.T, path string) *http.Request {
				form := url.Values{
					"app_id":       {"2021000000000000"},
					"out_trade_no": {"CALLBACK-SECURITY-ALIPAY"},
					"trade_status": {"TRADE_SUCCESS"},
					"total_amount": {"10.00"},
					// 随机 base64：既非正确签名，也不是非法 base64——确保走的是
					// 真正的 RSA 校验而不是解析提前失败。
					"sign":      {strings.Repeat("A", 344)},
					"sign_type": {"RSA2"},
				}
				req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(form.Encode()))
				req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
				return req
			},
			wantStatus:       http.StatusOK,
			wantBodyContains: "failure",
		},
		{
			// 微信支付：签名错误必须回 code=FAIL（微信据此重试），且 HTTP 200。
			name:    "wechat",
			path:    "/api/user/wechat/notify",
			handler: WechatPayNotify,
			setup: func(t *testing.T) {
				_, publicPEM := generateCallbackTestKeyPair(t)
				operation_setting.WechatPayPublicKey = publicPEM
			},
			request: func(t *testing.T, path string) *http.Request {
				body := `{"id":"evt-1","event_type":"TRANSACTION.SUCCESS","resource":{"ciphertext":"x","nonce":"y","associated_data":"z"}}`
				req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
				req.Header.Set("Content-Type", "application/json")
				req.Header.Set("Wechatpay-Timestamp", "1700000000")
				req.Header.Set("Wechatpay-Nonce", "nonce")
				req.Header.Set("Wechatpay-Signature", "forged-signature")
				req.Header.Set("Wechatpay-Serial", "serial")
				return req
			},
			wantStatus:       http.StatusOK,
			wantBodyContains: "FAIL",
		},
		{
			// Stripe：SDK 验签失败返回 400，Stripe 会重试。
			name:    "stripe",
			path:    "/api/stripe/webhook",
			handler: StripeWebhook,
			setup: func(t *testing.T) {
				setting.StripeWebhookSecret = "whsec_test_secret"
			},
			request: func(t *testing.T, path string) *http.Request {
				req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(`{"id":"evt_1","type":"checkout.session.completed"}`))
				req.Header.Set("Content-Type", "application/json")
				req.Header.Set("Stripe-Signature", "t=1700000000,v1=deadbeef")
				return req
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			// Creem：签名不匹配返回 401。
			name:    "creem",
			path:    "/api/creem/webhook",
			handler: CreemWebhook,
			setup: func(t *testing.T) {
				setting.CreemWebhookSecret = "creem_test_secret"
			},
			request: func(t *testing.T, path string) *http.Request {
				req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(`{"eventType":"checkout.completed","object":{"order":{"id":"ORD-1"}}}`))
				req.Header.Set("Content-Type", "application/json")
				req.Header.Set(CreemSignatureHeader, "forged-signature")
				return req
			},
			wantStatus: http.StatusUnauthorized,
		},
		{
			// Waffo：SDK 用配置的公钥验签，篡改签名返回 400。
			name:    "waffo",
			path:    "/api/waffo/webhook",
			handler: WaffoWebhook,
			setup: func(t *testing.T) {
				setting.WaffoSandbox = false
				setting.WaffoApiKey = "waffo_api_key"
				setting.WaffoPrivateKey = waffoPrivateKey
				setting.WaffoPublicCert = waffoPublicKey
			},
			request: func(t *testing.T, path string) *http.Request {
				req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(`{"event_type":"payment","data":{}}`))
				req.Header.Set("Content-Type", "application/json")
				req.Header.Set("X-SIGNATURE", "forged-signature")
				return req
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			// Waffo Pancake：验签失败返回 401，且不得回 OK（否则网关停止重试）。
			name:    "waffo-pancake",
			path:    "/api/waffo-pancake/webhook/prod",
			route:   "/api/waffo-pancake/webhook/:env",
			handler: WaffoPancakeWebhook,
			setup: func(t *testing.T) {
				setting.WaffoPancakeMerchantID = "MER_test"
				setting.WaffoPancakePrivateKey = waffoPrivateKey
				setting.WaffoPancakeStoreID = "STR_test"
			},
			request: func(t *testing.T, path string) *http.Request {
				req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(`{"id":"evt-1","type":"order.completed","mode":"prod","data":{"order_id":"ORD-1"}}`))
				req.Header.Set("Content-Type", "application/json")
				req.Header.Set("X-Waffo-Signature", "forged-signature")
				return req
			},
			wantStatus: http.StatusUnauthorized,
		},
	}

	providers := map[string]string{
		"alipay":        model.PaymentProviderAlipay,
		"wechat":        model.PaymentProviderWechatPay,
		"stripe":        model.PaymentProviderStripe,
		"creem":         model.PaymentProviderCreem,
		"waffo":         model.PaymentProviderWaffo,
		"waffo-pancake": model.PaymentProviderWaffoPancake,
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			tradeNo := "CALLBACK-SECURITY-" + strings.ToUpper(tc.name)
			user := callbackTestUserAndOrder(t, db, tradeNo, providers[tc.name])

			tc.setup(t)

			router := gin.New()
			route := tc.route
			if route == "" {
				route = tc.path
			}
			router.Any(route, tc.handler)

			recorder := httptest.NewRecorder()
			require.NotPanics(t, func() { router.ServeHTTP(recorder, tc.request(t, tc.path)) })

			assert.Equal(t, tc.wantStatus, recorder.Code, "拒绝回调的 HTTP 状态码必须符合该渠道契约：%s", recorder.Body.String())
			if tc.wantBodyContains != "" {
				assert.Contains(t, recorder.Body.String(), tc.wantBodyContains, "响应体必须带拒绝标记")
			}

			// 资金安全的核心断言：伪造回调绝不能入账，也不能改动订单状态。
			reloaded := model.GetTopUpByTradeNo(tradeNo)
			require.NotNil(t, reloaded)
			assert.Equal(t, common.TopUpStatusPending, reloaded.Status, "伪造回调不得推进订单状态")

			var refreshed model.User
			require.NoError(t, db.Select("quota").Where("id = ?", user.Id).First(&refreshed).Error)
			assert.Equal(t, 0, refreshed.Quota, "伪造回调不得给用户加额度")
		})
	}
}
