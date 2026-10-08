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

package service

import (
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

// genTestAPIV3Resource 模拟微信支付 APIv3 回调：用 APIv3 密钥对明文资源做
// AES-256-GCM 加密（与微信一致的 nonce 长度与 AAD 传参方式），返回可直接
// 塞进 resource 字段的三元组。
// 注意：微信下发的 resource.nonce 是 12 字节原始值（其 JSON 形态为
// base64(标准 GCM nonce) 之外的约定），生产代码按原始字节直接使用，
// 因此这里用 12 字节可打印字符串模拟，与线上密文结构一致。
func genTestAPIV3Resource(t *testing.T, apiV3Key string, plaintext string) (ciphertext, nonce, associatedData string) {
	t.Helper()
	key := []byte(apiV3Key)
	require.Len(t, key, 32)

	block, err := aes.NewCipher(key)
	require.NoError(t, err)
	gcm, err := cipher.NewGCM(block)
	require.NoError(t, err)

	nonceBytes := []byte("ABCDEFGH1234")
	require.Len(t, nonceBytes, gcm.NonceSize())

	associatedData = "transaction"
	sealed := gcm.Seal(nil, nonceBytes, []byte(plaintext), []byte(associatedData))

	return base64.StdEncoding.EncodeToString(sealed), string(nonceBytes), associatedData
}

// TestWechatPayDecryptResourceRoundTrip 验证解密与微信支付一致：
// 同样的明文加密后必须能解回原文，且 AAD 或密钥错误时解密必须失败。
func TestWechatPayDecryptResourceRoundTrip(t *testing.T) {
	apiV3Key := "0123456789abcdef0123456789abcdef"
	plaintext := `{"out_trade_no":"USR1NOtest","trade_state":"SUCCESS","mchid":"1900000000","amount":{"total":1000}}`

	ciphertext, nonce, aad := genTestAPIV3Resource(t, apiV3Key, plaintext)

	decrypted, err := WechatPayDecryptResource(ciphertext, nonce, aad, apiV3Key)
	require.NoError(t, err)
	require.Equal(t, plaintext, decrypted)

	// AAD 不匹配必须解密失败（防止跨应用/跨订单搬移密文）。
	_, err = WechatPayDecryptResource(ciphertext, nonce, "other", apiV3Key)
	require.Error(t, err)

	// 密钥长度非法必须直接报错。
	_, err = WechatPayDecryptResource(ciphertext, nonce, aad, "too-short")
	require.Error(t, err)
}

// TestWechatPayDecryptResourceRejectsInvalidNonce 验证 nonce 长度异常时
// 解密失败而非 panic（回调入口面对不可信输入）。
func TestWechatPayDecryptResourceRejectsInvalidNonce(t *testing.T) {
	apiV3Key := "0123456789abcdef0123456789abcdef"
	ciphertext, _, aad := genTestAPIV3Resource(t, apiV3Key, `{"trade_state":"SUCCESS"}`)

	_, err := WechatPayDecryptResource(ciphertext, "short-nonce", aad, apiV3Key)
	require.Error(t, err)
}

// TestWechatPayNotifyDecodedAmountFields 锁定微信回执的金额字段解析结构：
// amount.total 以「分」为单位，必须被正确读出并与商户号/appid 一并校验。
func TestWechatPayNotifyDecodedAmountFields(t *testing.T) {
	apiV3Key := "0123456789abcdef0123456789abcdef"
	payload := map[string]any{
		"out_trade_no": "USR7NOabc123",
		"trade_state":  "SUCCESS",
		"mchid":        "1900000000",
		"appid":        "wx1234567890abcdef",
		"amount":       map[string]any{"total": 1234, "currency": "CNY"},
	}
	raw, err := json.Marshal(payload)
	require.NoError(t, err)

	ciphertext, nonce, aad := genTestAPIV3Resource(t, apiV3Key, string(raw))
	decrypted, err := WechatPayDecryptResource(ciphertext, nonce, aad, apiV3Key)
	require.NoError(t, err)

	var dec struct {
		OutTradeNo string `json:"out_trade_no"`
		TradeState string `json:"trade_state"`
		Mchid      string `json:"mchid"`
		Appid      string `json:"appid"`
		Amount     struct {
			Total int64 `json:"total"`
		} `json:"amount"`
	}
	require.NoError(t, json.Unmarshal([]byte(decrypted), &dec))

	require.Equal(t, "USR7NOabc123", dec.OutTradeNo)
	require.Equal(t, "SUCCESS", dec.TradeState)
	require.Equal(t, "1900000000", dec.Mchid)
	require.Equal(t, "wx1234567890abcdef", dec.Appid)
	require.Equal(t, int64(1234), dec.Amount.Total)
}

// TestAlipayVerifySignRejectsEmptyAndTampered 锁定支付宝验签的失败路径：
// 空签名与被篡改的参数都必须验签失败，回调入口不得因此误入账。
func TestAlipayVerifySignRejectsEmptyAndTampered(t *testing.T) {
	privPEM, pub := genTestRSAKey(t)
	pubPEM := mustPKCS1PubPEM(t, pub)

	params := map[string]string{
		"app_id":       "2021000000000000",
		"out_trade_no": "USR1NOtest",
		"total_amount": "10.00",
		"trade_status": "TRADE_SUCCESS",
	}

	// 空签名必须失败。
	require.False(t, AlipayVerifySign(params, pubPEM, ""))

	sign, err := AlipayBuildSign(params, privPEM)
	require.NoError(t, err)
	require.True(t, AlipayVerifySign(params, pubPEM, sign))

	// 篡改金额后原签名必须失效（这正是必须交叉校验金额的原因之一：
	// 签名只保证报文未被篡改，不保证金额与本地订单一致）。
	tampered := map[string]string{
		"app_id":       "2021000000000000",
		"out_trade_no": "USR1NOtest",
		"total_amount": "0.01",
		"trade_status": "TRADE_SUCCESS",
	}
	require.False(t, AlipayVerifySign(tampered, pubPEM, sign))

	// 非 base64 签名必须失败而非 panic。
	require.False(t, AlipayVerifySign(params, pubPEM, "!!!not-base64!!!"))

	// 非法公钥必须失败而非 panic。
	require.False(t, AlipayVerifySign(params, "not-a-key", sign))
}
