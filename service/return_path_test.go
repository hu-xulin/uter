package service

import (
	"testing"

	"github.com/Uter-AI/Uter/setting/operation_setting"
	"github.com/Uter-AI/Uter/setting/system_setting"

	"github.com/stretchr/testify/assert"
)

func TestPaymentReturnURLUsesSuppliedDefaultDashboardPath(t *testing.T) {
	previousAddress := system_setting.ServerAddress
	system_setting.ServerAddress = "https://dashboard.example.com/"
	t.Cleanup(func() { system_setting.ServerAddress = previousAddress })

	assert.Equal(t, "https://dashboard.example.com/wallet", PaymentReturnURL("/wallet"))
}

// TestPaymentSiteAddressOverridesServerAddress 覆盖「支付站点地址」的优先级：
// 境内支付要求发起支付的域名已备案，主站域名备不了案时只需改这一项，
// 不能因此把 Server Address 改掉（会牵连 API 基址 / OAuth 回调 / Passkey 等）。
func TestPaymentSiteAddressOverridesServerAddress(t *testing.T) {
	previousAddress := system_setting.ServerAddress
	previousSite := operation_setting.PaymentSiteAddress
	t.Cleanup(func() {
		system_setting.ServerAddress = previousAddress
		operation_setting.PaymentSiteAddress = previousSite
	})

	system_setting.ServerAddress = "https://uter.ai"

	// 留空：回退 Server Address，保持既有行为。
	operation_setting.PaymentSiteAddress = ""
	assert.Equal(t, "https://uter.ai/wallet", PaymentReturnURL("/wallet"))

	// 只有空白字符同样视为未配置。
	operation_setting.PaymentSiteAddress = "   "
	assert.Equal(t, "https://uter.ai/wallet", PaymentReturnURL("/wallet"))

	// 配置后：支付回跳走已备案域名，Server Address 不受影响。
	operation_setting.PaymentSiteAddress = "https://uter.cc"
	assert.Equal(t, "https://uter.cc/wallet", PaymentReturnURL("/wallet"))
	assert.Equal(
		t,
		"https://uter.cc/wallet?pay=success",
		PaymentReturnURL("/wallet?pay=success"),
	)
	assert.Equal(t, "https://uter.ai", system_setting.ServerAddress)

	// 末尾多余的斜杠不得产生 "//"。
	operation_setting.PaymentSiteAddress = "https://uter.cc/"
	assert.Equal(t, "https://uter.cc/wallet", PaymentReturnURL("/wallet"))
}
