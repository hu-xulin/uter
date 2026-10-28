package operation_setting

import (
	"strings"
	"unicode/utf8"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/setting/config"
)

type PaymentSetting struct {
	AmountOptions  []int           `json:"amount_options"`
	AmountDiscount map[int]float64 `json:"amount_discount"` // 充值金额对应的折扣，例如 100 元 0.9 表示 100 元充值享受 9 折优惠

	// OrderTitlePrefix 是境内网关（支付宝 / 微信支付）订单标题里的品牌前缀，
	// 标题最终形如「<前缀> 充值 68.80 元」——金额恒为人民币实付金额，不由运营填写。
	// 留空时回退 common.EmailBrandName，保证升级后行为与历史一致。
	OrderTitlePrefix string `json:"order_title_prefix"`

	ComplianceConfirmed    bool   `json:"compliance_confirmed"`
	ComplianceTermsVersion string `json:"compliance_terms_version"`
	ComplianceConfirmedAt  int64  `json:"compliance_confirmed_at"`
	ComplianceConfirmedBy  int    `json:"compliance_confirmed_by"`
	ComplianceConfirmedIP  string `json:"compliance_confirmed_ip"`
}

const CurrentComplianceTermsVersion = "v1"

// 订单标题（支付宝 subject / 微信支付 description）的长度与字符约束。
//
// 两个网关的上限不同，配置按交集收敛，保证同一份前缀在两条通道都不会被拒：
//   - 支付宝 alipay.trade.page.pay 的 subject：256 字符，且不可使用特殊字符（如 / = &）。
//   - 微信支付 APIv3 的 description：127 字符。
//
// 总标题 = 前缀 + 「 充值 <金额> 元」，后缀最长为 18 字符（金额最多 12 位），
// 因此前缀上限取 100 字符，留出余量。
const (
	// PaymentOrderTitlePrefixOptionKey 是「支付设置 → 订单标题前缀」的配置键。
	PaymentOrderTitlePrefixOptionKey = "payment_setting.order_title_prefix"
	// PaymentOrderTitleMaxLength 是网关允许的订单标题总长度（取两网关交集）。
	PaymentOrderTitleMaxLength = 127
	// PaymentOrderTitlePrefixMaxLength 是前缀允许的最大字符数。
	PaymentOrderTitlePrefixMaxLength = 100
)

// paymentOrderTitleForbiddenRunes 是会被网关拒绝、或会破坏表单编码的字符。
// 支付宝文档明确 subject「不可使用特殊字符，如 /,=,& 等」。
const paymentOrderTitleForbiddenRunes = `/=&?#%+<>"'|`

// 默认配置
var paymentSetting = PaymentSetting{
	AmountOptions:  []int{10, 20, 50, 100, 200, 500},
	AmountDiscount: map[int]float64{},
}

// PaymentOrderTitlePrefix 返回运营配置的订单标题前缀；未配置时回退品牌名。
func PaymentOrderTitlePrefix() string {
	if prefix := strings.TrimSpace(paymentSetting.OrderTitlePrefix); prefix != "" {
		return prefix
	}
	return common.EmailBrandName
}

// ValidatePaymentOrderTitlePrefix 校验订单标题前缀：长度上限 + 网关禁用字符。
//
// 空值合法（表示使用默认品牌名）；前后空格会被忽略，不做静默改写。
func ValidatePaymentOrderTitlePrefix(value string) error {
	prefix := strings.TrimSpace(value)
	if prefix == "" {
		return nil
	}
	if utf8.RuneCountInString(prefix) > PaymentOrderTitlePrefixMaxLength {
		return common.NewMessage("Order title prefix must be at most {{max}} characters", map[string]any{"max": PaymentOrderTitlePrefixMaxLength})
	}
	for _, r := range prefix {
		if r < 0x20 || r == 0x7f {
			return common.NewMessage("Order title prefix must not contain control characters")
		}
		if strings.ContainsRune(paymentOrderTitleForbiddenRunes, r) {
			return common.NewMessage("Order title prefix must not contain any of these characters: {{chars}}", map[string]any{"chars": paymentOrderTitleForbiddenRunes})
		}
	}
	return nil
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
