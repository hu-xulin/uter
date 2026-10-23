package model

import (
	"testing"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/setting/operation_setting"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestCnPayOptionsBindToRuntimeState 锁定支付宝/微信支付（官方直连）的后台配置
// 能真正落到运行时变量上。
//
// 背景：对齐上游（f0f0e4011）时删掉了 InitOptionMap 的键登记与 updateOptionMap
// 的赋值分支，导致后台保存只写进 options 表，operation_setting.AlipayAppId 等
// 运行时变量永远是空字符串，IsAlipayEnabled() 恒为 false——参数全填对、开关也
// 打开了，钱包里就是不出现支付宝。这个测试把「键已登记 + 保存即生效」钉死，
// 避免下一次对齐再次静默丢失。
func TestCnPayOptionsBindToRuntimeState(t *testing.T) {
	previousMap := common.OptionMap
	t.Cleanup(func() { common.OptionMap = previousMap })
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	InitOptionMap()

	// 每个键都必须出现在 OptionMap 里，否则 loadOptionsFromDatabase 遍历时
	// 根本没有机会把库里的值分发给 updateOptionMap。
	for _, key := range []string{
		"PaymentSiteAddress",
		"AlipayEnabled",
		"AlipayAppId",
		"AlipayPrivateKey",
		"AlipayPublicKey",
		"WechatPayEnabled",
		"WechatPayMchId",
		"WechatPayAppId",
		"WechatPayApiV3Key",
		"WechatPaySerialNo",
		"WechatPayPrivateKey",
		"WechatPayPublicKey",
	} {
		_, ok := common.OptionMap[key]
		assert.True(t, ok, "InitOptionMap 未登记 %s，后台保存后不会生效", key)
	}

	// 逐个写入，断言运行时变量被真正赋值。
	originalAlipay := struct {
		enabled    bool
		appId      string
		privateKey string
		publicKey  string
	}{
		operation_setting.AlipayEnabled,
		operation_setting.AlipayAppId,
		operation_setting.AlipayPrivateKey,
		operation_setting.AlipayPublicKey,
	}
	originalSite := operation_setting.PaymentSiteAddress
	t.Cleanup(func() {
		operation_setting.AlipayEnabled = originalAlipay.enabled
		operation_setting.AlipayAppId = originalAlipay.appId
		operation_setting.AlipayPrivateKey = originalAlipay.privateKey
		operation_setting.AlipayPublicKey = originalAlipay.publicKey
		operation_setting.PaymentSiteAddress = originalSite
	})

	require.NoError(t, updateOptionMap("PaymentSiteAddress", "  https://pay.example.com  "))
	assert.Equal(t, "https://pay.example.com", operation_setting.PaymentSiteAddress,
		"支付站点地址应去掉首尾空白，避免拼出带空格的回调 URL")

	require.NoError(t, updateOptionMap("AlipayAppId", "  2021000000000001  "))
	assert.Equal(t, "2021000000000001", operation_setting.AlipayAppId)

	require.NoError(t, updateOptionMap("AlipayPrivateKey", "private-key"))
	require.NoError(t, updateOptionMap("AlipayPublicKey", "public-key"))
	assert.Equal(t, "private-key", operation_setting.AlipayPrivateKey)
	assert.Equal(t, "public-key", operation_setting.AlipayPublicKey)

	// 凭据齐备后 IsAlipayEnabled 才会放行；开关本身也要被赋值。
	assert.False(t, operation_setting.IsAlipayEnabled(), "开关未打开时不应判定为可用")
	require.NoError(t, updateOptionMap("AlipayEnabled", "true"))
	assert.True(t, operation_setting.IsAlipayEnabled())
}
