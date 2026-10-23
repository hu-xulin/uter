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

You should have received a copy of the GNU Affero General Public License
along with this program. If not found? See <https://www.gnu.org/licenses/>.
*/

package operation_setting

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestWechatPayEnabledRequiresSerialNo 锁定启用判定：
// WechatPaySerialNo 是 v3 请求签名 Authorization 头的必填字段，
// 缺失时下单必然失败，因此必须视为"未启用"，不能对用户显示可支付。
func TestWechatPayEnabledRequiresSerialNo(t *testing.T) {
	origEnabled := WechatPayEnabled
	origMchId := WechatPayMchId
	origAppId := WechatPayAppId
	origApiV3Key := WechatPayApiV3Key
	origSerialNo := WechatPaySerialNo
	origPrivateKey := WechatPayPrivateKey
	origPublicKey := WechatPayPublicKey
	t.Cleanup(func() {
		WechatPayEnabled = origEnabled
		WechatPayMchId = origMchId
		WechatPayAppId = origAppId
		WechatPayApiV3Key = origApiV3Key
		WechatPaySerialNo = origSerialNo
		WechatPayPrivateKey = origPrivateKey
		WechatPayPublicKey = origPublicKey
	})

	WechatPayEnabled = true
	WechatPayMchId = "1900000000"
	WechatPayAppId = "wx1234567890abcdef"
	WechatPayApiV3Key = strings.Repeat("k", 32)
	WechatPaySerialNo = "SERIAL_NO_ABC"
	WechatPayPrivateKey = "private"
	WechatPayPublicKey = "public-key"

	assert.True(t, IsWechatPayEnabled())

	// 证书序列号缺失 -> 下单签名无法构造，必须判定为未启用。
	WechatPaySerialNo = ""
	assert.False(t, IsWechatPayEnabled())

	WechatPaySerialNo = "SERIAL_NO_ABC"

	// APIv3 密钥长度错误 -> 回调解密必然失败，必须判定为未启用。
	WechatPayApiV3Key = strings.Repeat("k", 16)
	assert.False(t, IsWechatPayEnabled())

	WechatPayApiV3Key = strings.Repeat("k", 32)
	assert.True(t, IsWechatPayEnabled())

	// 总开关关闭时始终未启用。
	WechatPayEnabled = false
	assert.False(t, IsWechatPayEnabled())
}

// TestAlipayEnabledRequiresAllCredentials 锁定支付宝启用判定需要
// app_id / 应用私钥 / 支付宝公钥 三者齐备（公钥用于回调验签，缺失则回调必然失败）。
func TestAlipayEnabledRequiresAllCredentials(t *testing.T) {
	origEnabled := AlipayEnabled
	origAppId := AlipayAppId
	origPrivateKey := AlipayPrivateKey
	origPublicKey := AlipayPublicKey
	t.Cleanup(func() {
		AlipayEnabled = origEnabled
		AlipayAppId = origAppId
		AlipayPrivateKey = origPrivateKey
		AlipayPublicKey = origPublicKey
	})

	AlipayEnabled = true
	AlipayAppId = "2021000000000000"
	AlipayPrivateKey = "private"
	AlipayPublicKey = "public"
	assert.True(t, IsAlipayEnabled())

	AlipayPublicKey = ""
	assert.False(t, IsAlipayEnabled())

	AlipayPublicKey = "public"
	AlipayPrivateKey = ""
	assert.False(t, IsAlipayEnabled())

	AlipayPrivateKey = "private"
	AlipayAppId = ""
	assert.False(t, IsAlipayEnabled())
}
