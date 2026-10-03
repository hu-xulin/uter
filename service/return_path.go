package service

import (
	"strings"

	"github.com/Uter-AI/Uter/setting/operation_setting"
	"github.com/Uter-AI/Uter/setting/system_setting"
)

// PaymentSiteBaseURL 返回支付站点根地址（末尾不带斜杠）。
//
// 优先取 PaymentSiteAddress，留空才回退系统 Server Address：境内支付（支付宝手机网站
// 支付、微信 H5 支付）要求发起支付的域名已完成 ICP 备案且备案主体与商户主体一致，而
// 主站域名可能备不了案（如 .ai 后缀），此时只需把「支付站点」指到已备案域名，
// 不必改动 Server Address（改它会连带影响 API 基址、OAuth 回调、Passkey、邮件链接等）。
func PaymentSiteBaseURL() string {
	if base := strings.TrimSpace(operation_setting.PaymentSiteAddress); base != "" {
		return strings.TrimRight(base, "/")
	}
	return strings.TrimRight(system_setting.ServerAddress, "/")
}

// PaymentReturnURL 在支付站点根地址后拼接站内路径，得到支付完成后的回跳地址。
func PaymentReturnURL(suffix string) string {
	return PaymentSiteBaseURL() + suffix
}
