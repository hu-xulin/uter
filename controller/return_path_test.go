package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"

	"github.com/uter-ai/uter/setting/operation_setting"
	"github.com/uter-ai/uter/setting/system_setting"
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

func newOriginTestContext(t *testing.T, host string, headers map[string]string) *gin.Context {
	t.Helper()
	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "http://"+host+"/", nil)
	req.Host = host
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = req
	return ctx
}

// TestRequestOriginFollowsCurrentHost 覆盖「回跳跟随当前站点」的核心诉求：
// 本地从 localhost 进来就回 localhost，不再固定用支付站点域名（uter.cc）。
func TestRequestOriginFollowsCurrentHost(t *testing.T) {
	ctx := newOriginTestContext(t, "localhost:3000", nil)
	assert.Equal(t, "http://localhost:3000", requestOrigin(ctx))

	ctx = newOriginTestContext(t, "uter.ai", map[string]string{
		"X-Forwarded-Proto": "https",
		"X-Forwarded-Host":  "uter.ai, proxy.internal",
	})
	assert.Equal(t, "https://uter.ai", requestOrigin(ctx))
}

func TestPaymentReturnURLFor(t *testing.T) {
	assert.Equal(
		t,
		"http://localhost:3000/wallet?pay=success",
		paymentReturnURLFor("http://localhost:3000", "/wallet?pay=success"),
	)

	// 取不到请求站点根时回退到配置的支付站点地址。
	previousSite := operation_setting.PaymentSiteAddress
	operation_setting.PaymentSiteAddress = "https://uter.cc"
	t.Cleanup(func() { operation_setting.PaymentSiteAddress = previousSite })
	assert.Equal(t, "https://uter.cc/wallet", paymentReturnURLFor("", "/wallet"))
}

// TestPaymentNotifyURLFor 覆盖回调地址优先级：显式配置优先，否则跟随当前站点。
func TestPaymentNotifyURLFor(t *testing.T) {
	previousCustom := operation_setting.CustomCallbackAddress
	t.Cleanup(func() { operation_setting.CustomCallbackAddress = previousCustom })

	operation_setting.CustomCallbackAddress = ""
	assert.Equal(t, "http://localhost:3000", paymentNotifyURLFor("http://localhost:3000"))

	operation_setting.CustomCallbackAddress = "https://uter.cc/"
	assert.Equal(t, "https://uter.cc", paymentNotifyURLFor("http://localhost:3000"))
}
