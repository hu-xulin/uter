/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

package operation_setting

// 支付宝（官方直连）配置。
// 启用前提：已在支付宝开放平台开通「当面付」（PC 扫码，alipay.trade.precreate）
// 与「手机网站支付」（移动端，alipay.trade.wap.pay），并取得以下参数。
// ⚠️ 签约时支付宝要求支付域名已完成 ICP 备案且备案主体与商户主体一致。
var (
	AlipayEnabled    = false
	AlipayAppId      = ""
	AlipayPrivateKey = "" // 应用私钥（PKCS8/PKCS1 PEM 或单行 base64 均可）
	AlipayPublicKey  = "" // 支付宝公钥（用于异步回调验签，PKCS1 RSA 公钥 PEM）
	AlipayGateway    = "https://openapi.alipay.com/gateway.do"
)

// 微信支付（官方直连，APIv3）配置。
// 启用前提：已申请微信支付商户号并开通「Native 支付」（PC 扫码）与「H5 支付」（移动端），
// 在商户平台「开发配置」登记已备案的支付域名，并配置 APIv3 密钥与平台证书。
// ⚠️ 经营性网站还需 ICP 许可证；备案主体须与商户号主体一致。
var (
	WechatPayEnabled      = false
	WechatPayMchId        = ""
	WechatPayAppId        = ""
	WechatPayApiV3Key     = "" // 32 字节 APIv3 密钥
	WechatPaySerialNo     = "" // 商户 API 证书序列号
	WechatPayPrivateKey   = "" // 商户私钥（PKCS8 PEM）
	WechatPayPlatformCert = "" // 微信支付平台证书（PEM，用于回调验签）
	WechatPayGateway      = "https://api.mch.weixin.qq.com"
)

// IsAlipayEnabled 支付宝小程序支付是否可对外提供。
func IsAlipayEnabled() bool {
	return AlipayEnabled && AlipayAppId != "" && AlipayPrivateKey != "" && AlipayPublicKey != ""
}

// IsWechatPayEnabled 微信支付是否可对外提供。
// WechatPaySerialNo（商户 API 证书序列号）是 v3 请求签名 Authorization 头的必填字段，
// 缺失时下单必然被微信支付拒绝，因此纳入启用判定，避免"界面显示已启用但下单 100% 失败"。
func IsWechatPayEnabled() bool {
	return WechatPayEnabled &&
		WechatPayMchId != "" &&
		WechatPayAppId != "" &&
		WechatPayApiV3Key != "" &&
		len(WechatPayApiV3Key) == 32 &&
		WechatPaySerialNo != "" &&
		WechatPayPrivateKey != "" &&
		WechatPayPlatformCert != ""
}
