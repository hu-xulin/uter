package controller

import (
	"errors"
	"maps"
	"testing"

	"github.com/uter-ai/uter/common"

	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/service"
	"github.com/uter-ai/uter/setting"
	"github.com/uter-ai/uter/setting/operation_setting"
)

func TestWaffoPancakeOrderCurrencySupportsLegacyOrders(t *testing.T) {
	require.Equal(t, "usd", waffoPancakeOrderCurrency(""))
	require.Equal(t, "usd", waffoPancakeOrderCurrency(" USD "))
	require.Equal(t, "eur", waffoPancakeOrderCurrency("EUR"))
}

func TestFormatWaffoPancakeAmount_UsesDisplayPriceString(t *testing.T) {
	testCases := []struct {
		name     string
		amount   float64
		expected string
	}{
		{name: "whole amount", amount: 29, expected: "29.00"},
		{name: "decimal amount", amount: 29.9, expected: "29.90"},
		{name: "round half up to cents", amount: 29.999, expected: "30.00"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.expected, formatWaffoPancakeAmount(tc.amount))
		})
	}
}

func TestGetWaffoPancakePayMoney(t *testing.T) {
	originalUnitPrice := setting.WaffoPancakeUnitPrice
	originalQuotaDisplayType := operation_setting.GetGeneralSetting().QuotaDisplayType
	originalDiscounts := make(map[int]float64, len(operation_setting.GetPaymentSetting().AmountDiscount))
	maps.Copy(originalDiscounts, operation_setting.GetPaymentSetting().AmountDiscount)
	originalTopupGroupRatio := common.TopupGroupRatio2JSONString()

	t.Cleanup(func() {
		setting.WaffoPancakeUnitPrice = originalUnitPrice
		operation_setting.GetGeneralSetting().QuotaDisplayType = originalQuotaDisplayType
		operation_setting.GetPaymentSetting().AmountDiscount = originalDiscounts
		require.NoError(t, common.UpdateTopupGroupRatioByJSONString(originalTopupGroupRatio))
	})

	setting.WaffoPancakeUnitPrice = 2.5
	operation_setting.GetPaymentSetting().AmountDiscount = map[int]float64{
		10:                           0.8,
		int(common.QuotaPerUnit * 3): 0.5,
		20:                           0,
	}
	require.NoError(t, common.UpdateTopupGroupRatioByJSONString(`{"default":1,"vip":1.2}`))

	testCases := []struct {
		name string
		// 金额模型已从 int64 迁到 float64（支持 $0.01 起充）。
		amount           float64
		group            string
		quotaDisplayType string
		expected         float64
	}{
		{
			name:             "currency display applies unit price group ratio and discount",
			amount:           10,
			group:            "vip",
			quotaDisplayType: operation_setting.QuotaDisplayTypeUSD,
			expected:         24,
		},
		{
			name:             "tokens display converts quota to display units before pricing",
			amount:           float64(common.QuotaPerUnit * 3),
			group:            "vip",
			quotaDisplayType: operation_setting.QuotaDisplayTypeTokens,
			expected:         4.5,
		},
		{
			name:             "non-positive discount falls back to no discount",
			amount:           20,
			group:            "default",
			quotaDisplayType: operation_setting.QuotaDisplayTypeUSD,
			expected:         50,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			operation_setting.GetGeneralSetting().QuotaDisplayType = tc.quotaDisplayType
			actual := getWaffoPancakePayMoney(tc.amount, tc.group)
			require.InDelta(t, tc.expected, actual, 0.000001)
		})
	}
}

// 验签公钥随 SDK 内置且为全局共享（所有商户同一把），因此「验签通过」无法分辨
// 事件归属；StoreID 是唯一能把「本店真实事件」与「攻击者用自己商户伪造的事件」
// 分开的绑定。未绑定 StoreID 时必须拒绝启用该充值通道（否则可被伪造事件免费充值）。
func TestWaffoPancakeTopUpRequiresStoreID(t *testing.T) {
	origMerchant, origKey := setting.WaffoPancakeMerchantID, setting.WaffoPancakePrivateKey
	origStore, origProduct := setting.WaffoPancakeStoreID, setting.WaffoPancakeProductID
	ps := operation_setting.GetPaymentSetting()
	origConfirmed, origVersion := ps.ComplianceConfirmed, ps.ComplianceTermsVersion
	t.Cleanup(func() {
		setting.WaffoPancakeMerchantID, setting.WaffoPancakePrivateKey = origMerchant, origKey
		setting.WaffoPancakeStoreID, setting.WaffoPancakeProductID = origStore, origProduct
		ps.ComplianceConfirmed, ps.ComplianceTermsVersion = origConfirmed, origVersion
	})

	setting.WaffoPancakeMerchantID = "merchant-1"
	setting.WaffoPancakePrivateKey = "pk"
	setting.WaffoPancakeProductID = "prod-1"
	ps.ComplianceConfirmed = true
	ps.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion

	setting.WaffoPancakeStoreID = ""
	require.False(t, isWaffoPancakeTopUpEnabled(),
		"未绑定店铺 ID 时不得启用：全局公钥验签无法分辨事件归属")

	setting.WaffoPancakeStoreID = "store-1"
	require.True(t, isWaffoPancakeTopUpEnabled(), "绑定店铺 ID 后应可启用")
}

// WaffoPancakeEnabled 是运营侧开关：关闭后钱包不得再露出该充值入口，凭据齐全也
// 不得绕过开关。同时 webhook 必须保持启用，否则已支付订单无法结算。
func TestWaffoPancakeTopUpRespectsEnabledToggle(t *testing.T) {
	origMerchant, origKey := setting.WaffoPancakeMerchantID, setting.WaffoPancakePrivateKey
	origStore, origProduct := setting.WaffoPancakeStoreID, setting.WaffoPancakeProductID
	origEnabled := setting.WaffoPancakeEnabled
	ps := operation_setting.GetPaymentSetting()
	origConfirmed, origVersion := ps.ComplianceConfirmed, ps.ComplianceTermsVersion
	t.Cleanup(func() {
		setting.WaffoPancakeMerchantID, setting.WaffoPancakePrivateKey = origMerchant, origKey
		setting.WaffoPancakeStoreID, setting.WaffoPancakeProductID = origStore, origProduct
		setting.WaffoPancakeEnabled = origEnabled
		ps.ComplianceConfirmed, ps.ComplianceTermsVersion = origConfirmed, origVersion
	})

	setting.WaffoPancakeMerchantID = "merchant-1"
	setting.WaffoPancakePrivateKey = "pk"
	setting.WaffoPancakeStoreID = "store-1"
	setting.WaffoPancakeProductID = "prod-1"
	ps.ComplianceConfirmed = true
	ps.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion

	setting.WaffoPancakeEnabled = true
	require.True(t, isWaffoPancakeTopUpEnabled(), "开关打开且凭据齐全时应启用")

	setting.WaffoPancakeEnabled = false
	require.False(t, isWaffoPancakeTopUpEnabled(),
		"开关关闭时即使凭据齐全也不得在钱包露出入口")

	// 关闭入口不影响 webhook：已支付订单仍须能结算。
	require.True(t, isWaffoPancakeWebhookEnabled(),
		"关闭 checkout 开关后 webhook 仍须启用，否则已支付订单无法结算")
}

func TestWaffoPancakeResolutionShouldRetryOnlyTransientErrors(t *testing.T) {
	require.False(t, service.WaffoPancakeResolutionShouldRetry(nil))
	require.False(t, service.WaffoPancakeResolutionShouldRetry(service.ErrWaffoPancakeOrderNotFound))
	require.False(t, service.WaffoPancakeResolutionShouldRetry(service.ErrWaffoPancakeIdentityMismatch))
	require.False(t, service.WaffoPancakeResolutionShouldRetry(service.ErrWaffoPancakeInvalidWebhook))
	require.True(t, service.WaffoPancakeResolutionShouldRetry(errors.New("database connection refused")))
}
