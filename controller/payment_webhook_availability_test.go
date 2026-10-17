package controller

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/Calcium-Ion/go-epay/epay"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting"
	"github.com/uter-ai/uter/setting/operation_setting"
	"github.com/uter-ai/uter/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func confirmPaymentComplianceForTest(t *testing.T) {
	t.Helper()
	paymentSetting := operation_setting.GetPaymentSetting()
	originalConfirmed := paymentSetting.ComplianceConfirmed
	originalTermsVersion := paymentSetting.ComplianceTermsVersion
	t.Cleanup(func() {
		paymentSetting.ComplianceConfirmed = originalConfirmed
		paymentSetting.ComplianceTermsVersion = originalTermsVersion
	})
	paymentSetting.ComplianceConfirmed = true
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
}

func TestStripeTopUpEnabledRequiresTopUpAndWebhookConfig(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	originalAPISecret := setting.StripeApiSecret
	originalWebhookSecret := setting.StripeWebhookSecret
	originalPriceID := setting.StripePriceId
	t.Cleanup(func() {
		setting.StripeApiSecret = originalAPISecret
		setting.StripeWebhookSecret = originalWebhookSecret
		setting.StripePriceId = originalPriceID
	})

	setting.StripeWebhookSecret = ""
	setting.StripeApiSecret = "sk_test_123"
	setting.StripePriceId = "price_123"
	require.False(t, isStripeTopUpEnabled())

	setting.StripeWebhookSecret = "whsec_test"
	require.True(t, isStripeTopUpEnabled())

	setting.StripePriceId = ""
	require.False(t, isStripeTopUpEnabled())

	setting.StripePriceId = "price_123"
	operation_setting.GetPaymentSetting().ComplianceConfirmed = false
	require.False(t, isStripeTopUpEnabled())
}

func TestStripeWebhookEnabledDoesNotRequireWalletPrice(t *testing.T) {
	originalAPISecret := setting.StripeApiSecret
	originalWebhookSecret := setting.StripeWebhookSecret
	originalPriceID := setting.StripePriceId
	originalConfirmed := operation_setting.GetPaymentSetting().ComplianceConfirmed
	t.Cleanup(func() {
		setting.StripeApiSecret = originalAPISecret
		setting.StripeWebhookSecret = originalWebhookSecret
		setting.StripePriceId = originalPriceID
		operation_setting.GetPaymentSetting().ComplianceConfirmed = originalConfirmed
	})

	// Subscription plans carry their own Stripe Price IDs, so the shared webhook
	// must remain available without the wallet top-up Price ID or API key.
	setting.StripeApiSecret = ""
	setting.StripeWebhookSecret = "whsec_test"
	setting.StripePriceId = ""
	operation_setting.GetPaymentSetting().ComplianceConfirmed = false
	require.True(t, isStripeWebhookEnabled())

	setting.StripeWebhookSecret = ""
	require.False(t, isStripeWebhookEnabled())
}
func TestCreemWebhookEnabledRequiresOnlyWebhookSecret(t *testing.T) {
	originalAPIKey := setting.CreemApiKey
	originalProducts := setting.CreemProducts
	originalWebhookSecret := setting.CreemWebhookSecret
	originalConfirmed := operation_setting.GetPaymentSetting().ComplianceConfirmed
	t.Cleanup(func() {
		setting.CreemApiKey = originalAPIKey
		setting.CreemProducts = originalProducts
		setting.CreemWebhookSecret = originalWebhookSecret
		operation_setting.GetPaymentSetting().ComplianceConfirmed = originalConfirmed
	})

	// Existing orders must still settle if an operator removes the wallet catalog,
	// API key, or checkout-compliance flag. Signed webhook verification still fails
	// closed when its secret is missing.
	setting.CreemApiKey = ""
	setting.CreemProducts = "[]"
	setting.CreemWebhookSecret = ""
	require.False(t, isCreemWebhookEnabled())

	setting.CreemWebhookSecret = "creem_secret"
	operation_setting.GetPaymentSetting().ComplianceConfirmed = false
	require.True(t, isCreemWebhookEnabled())

	setting.CreemProducts = ""
	require.True(t, isCreemWebhookEnabled())
}

func TestCreemTopUpEnabledRequiresCheckoutConfiguration(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	originalAPIKey := setting.CreemApiKey
	originalProducts := setting.CreemProducts
	originalWebhookSecret := setting.CreemWebhookSecret
	t.Cleanup(func() {
		setting.CreemApiKey = originalAPIKey
		setting.CreemProducts = originalProducts
		setting.CreemWebhookSecret = originalWebhookSecret
	})

	setting.CreemApiKey = "creem_api_key"
	setting.CreemProducts = "[]"
	setting.CreemWebhookSecret = "creem_secret"
	require.False(t, isCreemTopUpEnabled())

	setting.CreemProducts = "[{}]"
	require.True(t, isCreemTopUpEnabled())

	operation_setting.GetPaymentSetting().ComplianceConfirmed = false
	require.False(t, isCreemTopUpEnabled())
}
func TestWaffoWebhookEnabledDoesNotDependOnCheckoutToggle(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	originalEnabled := setting.WaffoEnabled
	originalSandbox := setting.WaffoSandbox
	originalAPIKey := setting.WaffoApiKey
	originalPrivateKey := setting.WaffoPrivateKey
	originalPublicCert := setting.WaffoPublicCert
	originalSandboxAPIKey := setting.WaffoSandboxApiKey
	originalSandboxPrivateKey := setting.WaffoSandboxPrivateKey
	originalSandboxPublicCert := setting.WaffoSandboxPublicCert
	t.Cleanup(func() {
		setting.WaffoEnabled = originalEnabled
		setting.WaffoSandbox = originalSandbox
		setting.WaffoApiKey = originalAPIKey
		setting.WaffoPrivateKey = originalPrivateKey
		setting.WaffoPublicCert = originalPublicCert
		setting.WaffoSandboxApiKey = originalSandboxAPIKey
		setting.WaffoSandboxPrivateKey = originalSandboxPrivateKey
		setting.WaffoSandboxPublicCert = originalSandboxPublicCert
	})

	setting.WaffoSandbox = false
	setting.WaffoApiKey = ""
	setting.WaffoPrivateKey = "private"
	setting.WaffoPublicCert = "public"
	require.False(t, isWaffoWebhookEnabled())

	setting.WaffoApiKey = "api"
	setting.WaffoEnabled = true
	require.True(t, isWaffoWebhookEnabled())
	require.True(t, isWaffoTopUpEnabled())

	setting.WaffoEnabled = false
	require.True(t, isWaffoWebhookEnabled())
	require.False(t, isWaffoTopUpEnabled())

	operation_setting.GetPaymentSetting().ComplianceConfirmed = false
	require.True(t, isWaffoWebhookEnabled())
	require.False(t, isWaffoTopUpEnabled())

	setting.WaffoSandbox = true
	setting.WaffoSandboxApiKey = ""
	setting.WaffoSandboxPrivateKey = "sandbox_private"
	setting.WaffoSandboxPublicCert = "sandbox_public"
	require.False(t, isWaffoWebhookEnabled())

	setting.WaffoSandboxApiKey = "sandbox_api"
	require.True(t, isWaffoWebhookEnabled())
}
func TestWaffoPancakeWebhookEnabledDoesNotRequireWalletProduct(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	originalMerchantID := setting.WaffoPancakeMerchantID
	originalPrivateKey := setting.WaffoPancakePrivateKey
	originalProductID := setting.WaffoPancakeProductID
	originalStoreID := setting.WaffoPancakeStoreID
	t.Cleanup(func() {
		setting.WaffoPancakeMerchantID = originalMerchantID
		setting.WaffoPancakePrivateKey = originalPrivateKey
		setting.WaffoPancakeProductID = originalProductID
		setting.WaffoPancakeStoreID = originalStoreID
	})

	setting.WaffoPancakeStoreID = "store"
	setting.WaffoPancakeMerchantID = ""
	setting.WaffoPancakePrivateKey = "private"
	setting.WaffoPancakeProductID = "product"
	require.False(t, isWaffoPancakeWebhookEnabled())

	setting.WaffoPancakeMerchantID = "merchant"
	require.True(t, isWaffoPancakeWebhookEnabled())

	setting.WaffoPancakeProductID = ""
	require.True(t, isWaffoPancakeWebhookEnabled())
	require.False(t, isWaffoPancakeTopUpEnabled())

	setting.WaffoPancakeProductID = "product"
	setting.WaffoPancakePrivateKey = ""
	require.False(t, isWaffoPancakeWebhookEnabled())

	setting.WaffoPancakePrivateKey = "private"
	setting.WaffoPancakeStoreID = ""
	require.False(t, isWaffoPancakeWebhookEnabled())

	setting.WaffoPancakeStoreID = "store"
	operation_setting.GetPaymentSetting().ComplianceConfirmed = false
	require.True(t, isWaffoPancakeWebhookEnabled())
	require.False(t, isWaffoPancakeTopUpEnabled())
}
func TestEpayWebhookEnabledDoesNotDependOnPayMethods(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	originalPayAddress := operation_setting.PayAddress
	originalEpayID := operation_setting.EpayId
	originalEpayKey := operation_setting.EpayKey
	originalPayMethods := operation_setting.PayMethods
	t.Cleanup(func() {
		operation_setting.PayAddress = originalPayAddress
		operation_setting.EpayId = originalEpayID
		operation_setting.EpayKey = originalEpayKey
		operation_setting.PayMethods = originalPayMethods
	})

	operation_setting.PayAddress = "https://pay.example.com"
	operation_setting.EpayId = "epay_id"
	operation_setting.EpayKey = ""
	operation_setting.PayMethods = []map[string]string{{"type": "alipay"}}
	require.False(t, isEpayWebhookEnabled())

	operation_setting.EpayKey = "epay_key"
	require.True(t, isEpayWebhookEnabled())
	require.True(t, isEpayTopUpEnabled())

	operation_setting.PayMethods = nil
	require.True(t, isEpayWebhookEnabled())
	require.False(t, isEpayTopUpEnabled())

	operation_setting.PayMethods = []map[string]string{{"type": "alipay"}}
	operation_setting.GetPaymentSetting().ComplianceConfirmed = false
	require.True(t, isEpayWebhookEnabled())
	require.False(t, isEpayTopUpEnabled())
}
func TestEpayCallbacksVerifyBeforeSettlement(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	originalPayAddress := operation_setting.PayAddress
	originalEpayID := operation_setting.EpayId
	originalEpayKey := operation_setting.EpayKey
	originalPayMethods := operation_setting.PayMethods
	originalServerAddress := system_setting.ServerAddress
	originalDB := model.DB
	t.Cleanup(func() {
		operation_setting.PayAddress = originalPayAddress
		operation_setting.EpayId = originalEpayID
		operation_setting.EpayKey = originalEpayKey
		operation_setting.PayMethods = originalPayMethods
		system_setting.ServerAddress = originalServerAddress
		model.DB = originalDB
	})
	operation_setting.PayAddress = "https://pay.example.com"
	operation_setting.EpayId = "epay_id"
	operation_setting.EpayKey = "test-key"
	operation_setting.PayMethods = []map[string]string{{"type": "alipay"}}
	system_setting.ServerAddress = "https://dashboard.example.com"
	// Rejected callbacks and valid non-success events must never reach settlement.
	// A nil database makes an accidental attempt to settle fail the test.
	model.DB = nil
	require.True(t, isEpayWebhookEnabled())

	// Both ambiguous maps below had this same valid signing string in v0.0.4.
	// This must fail because of parameter ambiguity, not a mismatched signature.
	ambiguousSign := epay.MD5String("money=1.00&name=item&out_trade_no=other&out_trade_no=order&pid=epay_id&trade_status=TRADE_SUCCESS&type=alipay", "test-key")
	pendingSign := epay.MD5String("money=1.00&name=item%26other&out_trade_no=order&pid=epay_id&trade_status=WAIT_BUYER_PAY&type=alipay", "test-key")
	cases := []struct {
		name         string
		productName  string
		tradeNo      string
		status       string
		sign         string
		validPending bool
	}{
		{"separator in product name", "item&out_trade_no=other", "order", epay.StatusTradeSuccess, ambiguousSign, false},
		{"separator in order number", "item", "other&out_trade_no=order", epay.StatusTradeSuccess, ambiguousSign, false},
		{"invalid signature", "item", "order", epay.StatusTradeSuccess, "invalid", false},
		{"missing signature", "item", "order", epay.StatusTradeSuccess, "", false},
		{"valid pending with literal percent escape", "item%26other", "order", "WAIT_BUYER_PAY", pendingSign, true},
	}
	endpoints := []struct {
		name             string
		path             string
		handler          gin.HandlerFunc
		status           int
		rejectedBody     string
		pendingBody      string
		rejectedLocation string
		pendingLocation  string
	}{
		{
			name: "topup notify", path: "/api/user/epay/notify", handler: EpayNotify,
			status: http.StatusOK, rejectedBody: "fail", pendingBody: "success",
		},
		{
			name: "subscription notify", path: "/api/subscription/epay/notify", handler: SubscriptionEpayNotify,
			status: http.StatusOK, rejectedBody: "fail", pendingBody: "fail",
		},
		{
			name: "subscription return", path: "/api/subscription/epay/return", handler: SubscriptionEpayReturn,
			status:           http.StatusFound,
			rejectedLocation: "https://dashboard.example.com/wallet?pay=fail",
			pendingLocation:  "https://dashboard.example.com/wallet?pay=pending",
		},
	}
	router := gin.New()
	for _, endpoint := range endpoints {
		router.Any(endpoint.path, endpoint.handler)
	}
	for _, endpoint := range endpoints {
		for _, method := range []string{http.MethodGet, http.MethodPost} {
			for _, tc := range cases {
				t.Run(endpoint.name+"/"+method+"/"+tc.name, func(t *testing.T) {
					params := url.Values{
						"pid": {"epay_id"}, "type": {"alipay"}, "money": {"1.00"},
						"name": {tc.productName}, "out_trade_no": {tc.tradeNo},
						"trade_status": {tc.status}, "sign_type": {"MD5"},
					}
					if tc.sign != "" {
						params.Set("sign", tc.sign)
					}
					request := httptest.NewRequest(method, endpoint.path+"?"+params.Encode(), nil)
					if method == http.MethodPost {
						request = httptest.NewRequest(method, endpoint.path, strings.NewReader(params.Encode()))
						request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
					}
					recorder := httptest.NewRecorder()
					require.NotPanics(t, func() { router.ServeHTTP(recorder, request) })
					assert.Equal(t, endpoint.status, recorder.Code)
					wantBody, wantLocation := endpoint.rejectedBody, endpoint.rejectedLocation
					if tc.validPending {
						wantBody, wantLocation = endpoint.pendingBody, endpoint.pendingLocation
					}
					if wantBody != "" {
						assert.Equal(t, wantBody, recorder.Body.String())
					}
					assert.Equal(t, wantLocation, recorder.Header().Get("Location"))
				})
			}
		}
	}
}


func TestChinaPaymentTopUpHelpersRequireComplianceConfirmation(t *testing.T) {
	paymentSetting := operation_setting.GetPaymentSetting()
	originalConfirmed := paymentSetting.ComplianceConfirmed
	originalTermsVersion := paymentSetting.ComplianceTermsVersion
	originalAlipayEnabled := operation_setting.AlipayEnabled
	originalAlipayAppID := operation_setting.AlipayAppId
	originalAlipayPrivateKey := operation_setting.AlipayPrivateKey
	originalAlipayPublicKey := operation_setting.AlipayPublicKey
	originalWechatEnabled := operation_setting.WechatPayEnabled
	originalWechatMchID := operation_setting.WechatPayMchId
	originalWechatAppID := operation_setting.WechatPayAppId
	originalWechatAPIv3Key := operation_setting.WechatPayApiV3Key
	originalWechatSerialNo := operation_setting.WechatPaySerialNo
	originalWechatPrivateKey := operation_setting.WechatPayPrivateKey
	originalWechatPlatformCert := operation_setting.WechatPayPlatformCert
	t.Cleanup(func() {
		paymentSetting.ComplianceConfirmed = originalConfirmed
		paymentSetting.ComplianceTermsVersion = originalTermsVersion
		operation_setting.AlipayEnabled = originalAlipayEnabled
		operation_setting.AlipayAppId = originalAlipayAppID
		operation_setting.AlipayPrivateKey = originalAlipayPrivateKey
		operation_setting.AlipayPublicKey = originalAlipayPublicKey
		operation_setting.WechatPayEnabled = originalWechatEnabled
		operation_setting.WechatPayMchId = originalWechatMchID
		operation_setting.WechatPayAppId = originalWechatAppID
		operation_setting.WechatPayApiV3Key = originalWechatAPIv3Key
		operation_setting.WechatPaySerialNo = originalWechatSerialNo
		operation_setting.WechatPayPrivateKey = originalWechatPrivateKey
		operation_setting.WechatPayPlatformCert = originalWechatPlatformCert
	})
	operation_setting.AlipayEnabled = true
	operation_setting.AlipayAppId = "app"
	operation_setting.AlipayPrivateKey = "private"
	operation_setting.AlipayPublicKey = "public"
	operation_setting.WechatPayEnabled = true
	operation_setting.WechatPayMchId = "merchant"
	operation_setting.WechatPayAppId = "app"
	operation_setting.WechatPayApiV3Key = strings.Repeat("k", 32)
	operation_setting.WechatPaySerialNo = "serial"
	operation_setting.WechatPayPrivateKey = "private"
	operation_setting.WechatPayPlatformCert = "cert"
	paymentSetting.ComplianceConfirmed = false
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion

	require.False(t, isAlipayTopUpEnabled())
	require.False(t, isWechatPayTopUpEnabled())

	paymentSetting.ComplianceConfirmed = true
	require.True(t, isAlipayTopUpEnabled())
	require.True(t, isWechatPayTopUpEnabled())
}


func TestReadPaymentWebhookBodyEnforcesSizeLimit(t *testing.T) {
	withinLimit := strings.Repeat("x", int(maxPaymentWebhookBodyBytes))
	got, err := readPaymentWebhookBody(strings.NewReader(withinLimit))
	require.NoError(t, err)
	require.Equal(t, withinLimit, string(got))

	got, err = readPaymentWebhookBody(strings.NewReader(withinLimit + "x"))
	require.Nil(t, got)
	require.ErrorIs(t, err, errPaymentWebhookBodyTooLarge)
}


func TestLimitPaymentWebhookFormBody(t *testing.T) {
	writer := httptest.NewRecorder()
	body := strings.Repeat("x", int(maxPaymentWebhookBodyBytes+1))
	request := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	limitPaymentWebhookFormBody(writer, request)
	err := request.ParseForm()
	require.Error(t, err, "form payload larger than the payment callback limit must be rejected")
}


func TestReadPaymentProviderAPIResponseBodyEnforcesSizeLimit(t *testing.T) {
	withinLimit := strings.Repeat("x", int(maxPaymentProviderAPIResponseBodyBytes))
	data, err := readPaymentProviderAPIResponseBody(strings.NewReader(withinLimit))
	require.NoError(t, err)
	require.Len(t, data, len(withinLimit))

	data, err = readPaymentProviderAPIResponseBody(strings.NewReader(withinLimit + "x"))
	require.Error(t, err)
	require.Nil(t, data)
}
