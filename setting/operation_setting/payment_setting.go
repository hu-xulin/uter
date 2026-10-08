package operation_setting

import "github.com/uter-ai/uter/setting/config"

type PaymentSetting struct {
	AmountOptions  []int           `json:"amount_options"`
	AmountDiscount map[int]float64 `json:"amount_discount"` // 充值金额对应的折扣，例如 100 元 0.9 表示 100 元充值享受 9 折优惠

	ComplianceConfirmed    bool   `json:"compliance_confirmed"`
	ComplianceTermsVersion string `json:"compliance_terms_version"`
	ComplianceConfirmedAt  int64  `json:"compliance_confirmed_at"`
	ComplianceConfirmedBy  int    `json:"compliance_confirmed_by"`
	ComplianceConfirmedIP  string `json:"compliance_confirmed_ip"`
}

const CurrentComplianceTermsVersion = "v1"

// 默认配置
var paymentSetting = PaymentSetting{
	AmountOptions:  []int{10, 20, 50, 100, 200, 500},
	AmountDiscount: map[int]float64{},
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("payment_setting", &paymentSetting)
}

func GetPaymentSetting() *PaymentSetting {
	return &paymentSetting
}

// PaymentSiteAddress 支付站点地址（站点根，形如 https://uter.cc，不带路径）。
//
// 用途：拼接各支付渠道的「同步回跳地址」——支付宝手机网站支付的 return_url / quit_url、
// 微信 H5 支付的 wap_url / redirect_url、Stripe 的 success_url / cancel_url、
// 以及额度告警通知里给用户的充值链接。
//
// 为什么需要单独配置：境内支付（支付宝手机网站支付、微信 H5 支付）要求发起支付的域名
// 已完成 ICP 备案且备案主体与商户主体一致，而主站域名（如 .ai 后缀）不在工信部批复名单
// 内、永远备不了案。此时主站继续用 Server Address，另用一个已备案域名承载支付即可，
// 不必把整个 Server Address 改掉（那会连带影响 API 基址、OAuth 回调、Passkey 等）。
//
// 留空时回退到系统 Server Address，保持既有行为。
//
// ⚠️ 异步回调地址（notify_url）不走这里，由 CustomCallbackAddress 控制。
var PaymentSiteAddress = ""

func IsPaymentComplianceConfirmed() bool {
	return paymentSetting.ComplianceConfirmed &&
		paymentSetting.ComplianceTermsVersion == CurrentComplianceTermsVersion
}
