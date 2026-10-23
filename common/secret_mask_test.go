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
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/

package common

import "testing"

func TestMaskSecretValue(t *testing.T) {
	cases := []struct {
		name  string
		input string
		want  string
	}{
		{"empty stays empty", "", ""},
		{"len 1 fully masked", "a", "*"},
		{"len 4 fully masked", "abcd", "****"},
		{"len 8 keeps head only", "abcdefgh", "abcd****"},
		{"len 12 keeps head and tail", "abcdefghijkl", "abcd" + "****" + "ijkl"},
		{
			"long secret caps middle",
			"sk-0123456789abcdefghijklmnopqrstuvwxyz",
			"sk-0" + "************" + "wxyz",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := MaskSecretValue(tc.input)
			if got != tc.want {
				t.Fatalf("MaskSecretValue(%q) = %q, want %q", tc.input, got, tc.want)
			}
			// 不变量：掩码绝不等于原文（除空串外），否则等于没掩码。
			if tc.input != "" && got == tc.input {
				t.Fatalf("mask of %q returned the plaintext", tc.input)
			}
		})
	}
}

func TestIsMaskedSecret(t *testing.T) {
	if IsMaskedSecret("plain-value") {
		t.Fatal("plain value must not be treated as masked")
	}
	if !IsMaskedSecret("abcd****") {
		t.Fatal("value containing '*' must be treated as masked")
	}
}

func TestIsSecretOptionKey(t *testing.T) {
	// 明确登记为密钥的键。
	secretKeys := []string{
		"GitHubClientSecret",
		"TurnstileSecretKey",
		"costopt_setting.semantic_cache_embed_api_key",
		"costopt_setting.rag_api_key",
		"costopt_setting.batch_api_key",
		"costopt_setting.cdn_signing_secret",
		"costopt_setting.value_tier_vendor_api_key",

		// 支付 / 签名凭据：此前未登记，GET /api/option/ 会明文下发。
		"EpayKey",
		"AlipayPrivateKey",
		// 对端公钥 / 证书与私钥同等待遇（见 secret_option_keys.go 的说明）。
		"AlipayPublicKey",
		"WaffoPublicCert",
		"WaffoSandboxPublicCert",
		"StripeApiSecret",
		"StripeWebhookSecret",
		"CreemWebhookSecret",
		"WaffoPrivateKey",
		"WaffoPancakePrivateKey",
		"WaffoSandboxApiKey",
		"WaffoSandboxPrivateKey",
		"WorkerValidKey",

		// 兜底后缀规则：不在这三张表里也应判为密钥。
		"SomeFutureVendorSecret",
		"some_future_vendor_api_key",
		"someFutureVendorToken",
		"someFutureVendorPassword",
		"someFutureVendorPrivateKey",
	}
	for _, key := range secretKeys {
		if !IsSecretOptionKey(key) {
			t.Errorf("IsSecretOptionKey(%q) = false, want true", key)
		}
	}

	// 公开值必须按普通文本原样展示，否则管理员无法核对。
	publicKeys := []string{
		"TurnstileSiteKey", // Cloudflare设计上就是公开值
		"StripePublishableKey",
		"GitHubClientId",
		"GitHubOAuthEnabled",
		"costopt_setting.cdn_asset_base_url",
		"costopt_setting.cascade_premium_model",

		// 后缀规则只匹配结尾，不能因为包含 "key" 就误伤。
		"MonkeyMode",
		"keyword",
		"key_prefix",
	}
	for _, key := range publicKeys {
		if IsSecretOptionKey(key) {
			t.Errorf("IsSecretOptionKey(%q) = true, want false", key)
		}
	}
}

// TestSecretOptionKeySuffixFallbackIsExhaustive 守住兜底规则的覆盖面：
// 凡在 model.OptionMap 里出现、且键名以密钥类后缀结尾的键，
// 必须能被判为密钥，除非被 publicOptionKeys 显式豁免。
//
// 这条测试存在的意义是防回归：微信支付三个键、以及整批支付密钥，
// 都是因为「新增 OptionMap 键时忘了登记」而明文下发的。豁免表一旦
// 收紧或漏写，这里会立刻红。
func TestSecretOptionKeySuffixFallbackIsExhaustive(t *testing.T) {
	// OptionMap 的键在 model 包里逐 case 分发，common 包无法直接引用，
	// 故在此硬编码需要覆盖的敏感键作为等价断言源；两边漂移由
	// testSecretOptionKeySourceOfTruth 与 model 包的 option 键对照发现。
	for _, key := range []string{
		"EpayKey",
		"AlipayPrivateKey",
		"AlipayPublicKey",
		"WaffoPublicCert",
		"WaffoSandboxPublicCert",
		"StripeApiSecret",
		"StripeWebhookSecret",
		"StripeSecretKey",
		"StripePublishableKey", // 豁免
		"CreemApiKey",
		"CreemWebhookSecret",
		"WaffoApiKey",
		"WaffoPrivateKey",
		"WaffoPancakeApiKey",
		"WaffoPancakePrivateKey",
		"WaffoSandboxApiKey",
		"WaffoSandboxPrivateKey",
		"WorkerValidKey",
		"WechatPayApiV3Key",
		"WechatPayPrivateKey",
		"WechatPayPublicKey",
		"TurnstileSecretKey",
		"TurnstileSiteKey", // 豁免
	} {
		_, exempted := publicOptionKeys[key]
		got := IsSecretOptionKey(key)
		if exempted && got {
			t.Errorf("%q 在豁免表中，却仍被判为密钥", key)
		}
		if !exempted && !got {
			t.Errorf("%q 是敏感配置却未被掩码，会在 GET /api/option/ 明文下发", key)
		}
	}
}

func TestIsExcludedOptionKey(t *testing.T) {
	if !IsExcludedOptionKey("CustomerServiceLLMConfig") {
		t.Error("CustomerServiceLLMConfig must be excluded from the option list")
	}
	if IsExcludedOptionKey("GitHubClientSecret") {
		t.Error("single secret fields must be masked, not excluded")
	}
}
