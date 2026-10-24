/**
此文件为旧版支付设置文件，如需增加新的参数、变量等，请在 payment_setting.go 中添加
This file is the old version of the payment settings file. If you need to add new parameters, variables, etc., please add them in payment_setting.go
*/

package operation_setting

import (
	"math"

	"github.com/uter-ai/uter/common"
)

// 计价体系由三个值串成一条链，全部由 service.StartExchangeRateSync 定时维护：
//
//	A = USDExchangeRate  「货币展示」里的美元汇率，取外部行情（USD→CNY），每 10 分钟刷新。
//	B = Price            「支付网关」里的定价（本地货币 / 美元），恒等于 A + PriceMarkupRate，
//	                     每 10 分钟随 A 重算。所有按人民币结算的支付方式（支付宝 / 微信 /
//	                     Epay）下单金额都按 B 计算。
//	C                    钱包页展示与结算用的汇率，直接取 B（/api/status 的 price 字段），
//	                     因此钱包「$10 → 应付 ¥X」与后端实扣金额天然一致。
//
// 历史包袱：A 与 B 曾经是两个互不相干的手工配置项，管理员只改其中一个就会造成
// 「钱包显示按 A、实扣按 B」的错位。现在 B 不再是独立配置，而是 A 的派生值。
const (
	// DefaultUSDExchangeRate 是行情拿不到时的兜底汇率。
	DefaultUSDExchangeRate = 7.3
	// PriceMarkupRate 是 B 相对 A 的加价，用于覆盖支付通道手续费与行情波动。
	PriceMarkupRate = 0.2
)

var PayAddress = ""
var CustomCallbackAddress = ""
var EpayId = ""
var EpayKey = ""
var MinTopUp = 1

// USDExchangeRate 即 A：面向用户展示的美元汇率（外部行情）。
var USDExchangeRate = DefaultUSDExchangeRate

// Price 即 B：实际计价单价（本地货币 / 美元），恒为 A + PriceMarkupRate。
var Price = DerivedPriceFromExchangeRate(DefaultUSDExchangeRate)

// USDExchangeRateUpdatedAt 是 A 最近一次成功同步的时间（Unix 秒，0 表示从未同步）。
var USDExchangeRateUpdatedAt int64

// DerivedPriceFromExchangeRate 由 A 推导 B：B = A + PriceMarkupRate，保留 2 位小数。
func DerivedPriceFromExchangeRate(exchangeRate float64) float64 {
	if exchangeRate <= 0 {
		exchangeRate = DefaultUSDExchangeRate
	}
	return math.Round((exchangeRate+PriceMarkupRate)*100) / 100
}

// EffectivePayPrice 返回充值时实际使用的计价单价，即 B。
//
// 正常情况下 Price 由同步任务写入；若库里从未写过（或写入了非法值），
// 这里按 B = A + PriceMarkupRate 现场推导，避免出现 0 元订单。
func EffectivePayPrice() float64 {
	if Price > 0 {
		return Price
	}
	return DerivedPriceFromExchangeRate(USDExchangeRate)
}

// PayMethods 是「钱包 → 充值」页下发的支付方式列表，后台「支付设置」的
// 可视化编辑器可改；库里无此键时（新部署 / 未配置过）用下面的默认值。
//
// 默认值只保留官方直连的网站支付：
//   - alipay_web  ：支付宝「电脑网站支付」（PC 收银台）+「手机网站支付」（移动端跳转）
//   - wechat_web  ：微信支付 Native（PC 扫码）+ H5（移动端跳转）
//
// controller/topup.go 会在对应密钥就绪时按 type 去重追加，钱包前端据此
// 打开各自的收银台弹窗，而不是提交 Epay 表单。
//
// ⚠️ 不要把历史上的 "alipay" / "wxpay" / "custom1" 加回默认值：它们属于
//
//	易支付（Epay）通道，需要 PayAddress / EpayId / EpayKey 三件套齐备，
//	未配置时用户点了必然下单失败。纯 Epay 部署请在后台显式配置。
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
