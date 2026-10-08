package controller

import (
	"github.com/uter-ai/uter/service"
)

// paymentReturnPath 拼接支付完成后的站内回跳地址。
//
// 站点根由 service.PaymentSiteBaseURL 决定：优先取「支付站点地址」PaymentSiteAddress，
// 留空才回退系统 Server Address。保留这一层包装是因为 controller 包内有大量调用点，
// 统一语义，避免各处自行拼 ServerAddress 而绕过支付站点配置。
func paymentReturnPath(suffix string) string {
	return service.PaymentReturnURL(suffix)
}
