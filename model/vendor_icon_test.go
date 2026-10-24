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
package model

import (
	"strings"
	"testing"
)

// Vendor icons default to the monochrome (non ".Color") variant so they follow
// currentColor and stay legible on both themes.
func TestNormalizeIconKeyStripsColorVariant(t *testing.T) {
	cases := map[string]string{
		"Claude.Color":                    "Claude",
		"Gemini.Color":                    "Gemini",
		"  Qwen.Color ":                   "Qwen",
		"OpenAI":                          "OpenAI",
		"":                                "",
		"   ":                             "",
		"Claude.Avatar.type={'platform'}": "Claude.Avatar.type={'platform'}",
		"Claude.Color.Avatar":             "Claude.Color.Avatar",
	}
	for in, want := range cases {
		if got := NormalizeIconKey(in); got != want {
			t.Errorf("NormalizeIconKey(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestDefaultVendorIconsAreColor(t *testing.T) {
	for name, icon := range defaultVendorIcons {
		if icon == "" {
			t.Errorf("vendor %q has an empty default icon", name)
			continue
		}
		// map 存裸品牌名，彩色升级由 getDefaultVendorIcon 统一完成；
		// 这里断言默认产出确实是彩色键（.Color 或 .Avatar）。
		got := getDefaultVendorIcon(name)
		if !strings.Contains(got, ".Color") && !strings.Contains(got, ".Avatar") {
			t.Errorf("vendor %q default icon %q is not a color variant (got %q)", name, icon, got)
		}
		if want := NormalizeColorIconKey(icon); got != want {
			t.Errorf("vendor %q default icon %q normalizes to %q, want %q", name, icon, got, want)
		}
	}
	if got := getDefaultVendorIcon("ByteDance"); got != "Doubao.Color" {
		t.Errorf(`getDefaultVendorIcon("ByteDance") = %q, want "Doubao.Color"`, got)
	}
}

// 同步链路（上游元数据、默认品牌、存量迁移）必须把图标收敛到彩色变体：
// 有 .Color 的品牌优先，只有 .Avatar 的品牌回落，无变体品牌原样。
func TestNormalizeColorIconKeyUpgradesToColorVariant(t *testing.T) {
	cases := map[string]string{
		"":                                "",
		"   ":                             "",
		"Claude":                          "Claude.Color",
		"  Claude  ":                      "Claude.Color",
		"Qwen":                            "Qwen.Color",
		"DeepSeek":                        "DeepSeek.Color",
		"Anthropic":                       "Anthropic.Avatar",
		"OpenAI":                          "OpenAI.Avatar",
		"ZAI":                             "ZAI.Avatar",
		"Ollama":                          "Ollama.Avatar",
		"Claude.Color":                    "Claude.Color",
		"OpenAI.Avatar":                   "OpenAI.Avatar",
		"Claude.Avatar.type={'platform'}": "Claude.Avatar.type={'platform'}",
		"Claude.Color.Avatar":             "Claude.Color.Avatar",
	}
	for in, want := range cases {
		if got := NormalizeColorIconKey(in); got != want {
			t.Errorf("NormalizeColorIconKey(%q) = %q, want %q", in, got, want)
		}
	}
}

// 未登记品牌（lobe 变体表中不存在）必须原样返回，绝不臆造后缀。
func TestNormalizeColorIconKeyKeepsUnknownBrands(t *testing.T) {
	for _, in := range []string{"DefinitelyNotABrand", "UterInternalOnly", "Xy9Zz"} {
		if got := NormalizeColorIconKey(in); got != in {
			t.Errorf("NormalizeColorIconKey(%q) = %q, want unchanged", in, got)
		}
	}
}

// 彩色归一化必须单调：对已彩色的键再次归一化结果不变（迁移可重复执行）。
func TestNormalizeColorIconKeyIdempotent(t *testing.T) {
	for _, in := range []string{"Claude", "OpenAI", "Anthropic", "Qwen", "ZAI", "Ollama"} {
		once := NormalizeColorIconKey(in)
		if twice := NormalizeColorIconKey(once); twice != once {
			t.Errorf("NormalizeColorIconKey(%q) not idempotent: %q -> %q", in, once, twice)
		}
	}
}
