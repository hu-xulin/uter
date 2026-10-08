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
	}
	for _, key := range secretKeys {
		if !IsSecretOptionKey(key) {
			t.Errorf("IsSecretOptionKey(%q) = false, want true", key)
		}
	}

	// 公开值必须按普通文本原样展示，否则管理员无法核对。
	publicKeys := []string{
		"TurnstileSiteKey",  // Cloudflare设计 上就是公开值
		"GitHubClientId",
		"GitHubOAuthEnabled",
		"costopt_setting.cdn_asset_base_url",
		"costopt_setting.cascade_premium_model",
	}
	for _, key := range publicKeys {
		if IsSecretOptionKey(key) {
			t.Errorf("IsSecretOptionKey(%q) = true, want false", key)
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