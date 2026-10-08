package controller

import (
	"testing"

	"github.com/uter-ai/uter/setting/operation_setting"
	"github.com/uter-ai/uter/setting/system_setting"

	"github.com/stretchr/testify/assert"
)

func TestPaymentReturnPathUsesDefaultDashboardRoutes(t *testing.T) {
	previousAddress := system_setting.ServerAddress
	system_setting.ServerAddress = "https://dashboard.example.com/"
	t.Cleanup(func() { system_setting.ServerAddress = previousAddress })

	assert.Equal(
		t,
		"https://dashboard.example.com/wallet?pay=success",
		paymentReturnPath("/wallet?pay=success"),
	)
	assert.Equal(
		t,
		"https://dashboard.example.com/usage-logs",
		paymentReturnPath("/usage-logs"),
	)
}

// TestPaymentReturnPathPrefersPaymentSiteAddress 保证 controller 侧的下单回跳
// （支付宝 return_url / 微信 H5 wap_url 等）走「支付站点地址」而不是主站域名。
func TestPaymentReturnPathPrefersPaymentSiteAddress(t *testing.T) {
	previousAddress := system_setting.ServerAddress
	previousSite := operation_setting.PaymentSiteAddress
	t.Cleanup(func() {
		system_setting.ServerAddress = previousAddress
		operation_setting.PaymentSiteAddress = previousSite
	})

	system_setting.ServerAddress = "https://uter.ai"
	operation_setting.PaymentSiteAddress = "https://uter.cc"

	assert.Equal(
		t,
		"https://uter.cc/wallet?pay=success",
		paymentReturnPath("/wallet?pay=success"),
	)
	assert.Equal(t, "https://uter.cc/usage-logs", paymentReturnPath("/usage-logs"))
}
