/**
此文件为旧版支付设置文件，如需增加新的参数、变量等，请在 payment_setting.go 中添加
This file is the old version of the payment settings file. If you need to add new parameters, variables, etc., please add them in payment_setting.go
*/

package operation_setting

import (
	"github.com/uter-ai/uter/common"
)

var PayAddress = ""
var CustomCallbackAddress = ""
var EpayId = ""
var EpayKey = ""
var Price = 7.3
var MinTopUp = 1
var USDExchangeRate = 7.3

// PayMethods 是「钱包 → 充值」页下发的支付方式列表，后台「支付设置」的
// 可视化编辑器可改；库里无此键时（新部署 / 未配置过）用下面的默认值。
//
// 默认值只保留官方直连的网站支付：
//   - alipay_web  ：支付宝「电脑网站支付」（PC 收银台）+「手机网站支付」（移动端跳转）
//   - wechat_web  ：微信支付 Native（PC 扫码）+ H5（移动端跳转）
// controller/topup.go 会在对应密钥就绪时按 type 去重追加，钱包前端据此
// 打开各自的收银台弹窗，而不是提交 Epay 表单。
//
// ⚠️ 不要把历史上的 "alipay" / "wxpay" / "custom1" 加回默认值：它们属于
//    易支付（Epay）通道，需要 PayAddress / EpayId / EpayKey 三件套齐备，
//    未配置时用户点了必然下单失败。纯 Epay 部署请在后台显式配置。
var PayMethods = []map[string]string{
	{
		"name": "支付宝",
		"icon": "SiAlipay",
		"type": "alipay_web",
	},
	{
		"name": "微信支付",
		"icon": "SiWechat",
		"type": "wechat_web",
	},
}

func UpdatePayMethodsByJsonString(jsonString string) error {
	PayMethods = make([]map[string]string, 0)
	return common.Unmarshal([]byte(jsonString), &PayMethods)
}

func PayMethods2JsonString() string {
	jsonBytes, err := common.Marshal(PayMethods)
	if err != nil {
		return "[]"
	}
	return string(jsonBytes)
}

func ContainsPayMethod(method string) bool {
	for _, payMethod := range PayMethods {
		if payMethod["type"] == method {
			return true
		}
	}
	return false
}
