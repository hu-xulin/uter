package controller

import (
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/uter-ai/uter/service"
	"github.com/uter-ai/uter/setting/operation_setting"
)

// paymentReturnPath 拼接支付完成后的站内回跳地址。
//
// 站点根由 service.PaymentSiteBaseURL 决定：优先取「支付站点地址」PaymentSiteAddress，
// 留空才回退系统 Server Address。保留这一层包装是因为 controller 包内有大量调用点，
// 统一语义，避免各处自行拼 ServerAddress 而绕过支付站点配置。
func paymentReturnPath(suffix string) string {
	return service.PaymentReturnURL(suffix)
}

// requestOrigin 返回当前请求的站点根（scheme://host）。
//
// 境内支付的回跳（return_url）与异步回调（notify_url）默认跟随「用户实际访问的
// 站点」，而不是固定配置的支付站点：本地/测试环境从 localhost 进来就回 localhost，
// 生产从 uter.ai 进来就回 uter.ai，避免付款成功后把用户甩到另一个域名，也避免本地
// 订单因为回调打到别的实例而一直停在 pending。
//
// 反向代理场景优先 X-Forwarded-Proto / X-Forwarded-Host（多值时取第一段）。
func requestOrigin(c *gin.Context) string {
	if c == nil || c.Request == nil {
		return ""
	}
	scheme := "http"
	if c.Request.TLS != nil {
		scheme = "https"
	}
	if proto := firstHeaderValue(c.GetHeader("X-Forwarded-Proto")); proto != "" {
		scheme = proto
	}
	host := c.Request.Host
	if fwd := firstHeaderValue(c.GetHeader("X-Forwarded-Host")); fwd != "" {
		host = fwd
	}
	if host == "" {
		return ""
	}
	return scheme + "://" + host
}

// firstHeaderValue 取逗号分隔头部的第一段（反向代理会追加多级地址）。
func firstHeaderValue(v string) string {
	if i := strings.IndexByte(v, ','); i >= 0 {
		v = v[:i]
	}
	return strings.TrimSpace(v)
}

// paymentReturnURLFor 在请求站点根后拼接回跳路径；取不到站点根时回退配置地址。
func paymentReturnURLFor(origin, suffix string) string {
	if origin == "" {
		return paymentReturnPath(suffix)
	}
	return strings.TrimRight(origin, "/") + suffix
}

// paymentNotifyURLFor 返回异步回调地址的站点根：
// 运营显式配置 CustomCallbackAddress 时优先用它（例如必须走备案域名），
// 否则跟随当前请求站点。
func paymentNotifyURLFor(origin string) string {
	if custom := strings.TrimSpace(operation_setting.CustomCallbackAddress); custom != "" {
		return strings.TrimRight(custom, "/")
	}
	return strings.TrimRight(origin, "/")
}
