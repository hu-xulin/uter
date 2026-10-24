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

// 同步创建供应商时，已知品牌取品牌映射里的品牌裸名，而不是盲从中游下发的图标。
// 这正是对用户反馈「claude-haiku-5-5 没改成彩色 / gemini 系列仍用 Google logo」的根因修复：
// Google 供应商绝不能落到 Google.Color，Meta 供应商绝不能落到 Ollama。
//
// 存的是裸名而不是彩色键：供应商图标是运营在「模型-供应商」里设置的配置，
// 存储值必须与运营选择一致，彩色化由渲染层负责。
func TestDefaultVendorIconForSyncUsesAuthoritativeMapping(t *testing.T) {
	cases := []struct {
		name     string
		upstream string
		want     string
	}{
		{"Google", "Google.Color", "Gemini"},
		{"Google", "Google", "Gemini"},
		{"Google", "Google.Avatar", "Gemini"},
		{"Anthropic", "Anthropic.Avatar", "Claude"},
		{"Anthropic", "Anthropic", "Claude"},
		{"OpenAI", "OpenAI.Avatar", "OpenAI"},
		{"ByteDance", "ByteDance", "Doubao"},
		{"Meta", "Ollama.Avatar", "Meta"},
	}
	for _, c := range cases {
		if got := defaultVendorIconForSync(c.name, c.upstream); got != c.want {
			t.Errorf("defaultVendorIconForSync(%q, %q) = %q, want %q", c.name, c.upstream, got, c.want)
		}
	}
}

// 未知品牌不在权威映射内，取上游下发的图标并收敛为品牌裸名。
func TestDefaultVendorIconForSyncFallsBackToUpstream(t *testing.T) {
	if got := defaultVendorIconForSync("BrandNotInDefaults", "Foo.Bar"); got != "Foo.Bar" {
		t.Errorf("defaultVendorIconForSync unknown brand = %q, want %q", got, "Foo.Bar")
	}
	if got := defaultVendorIconForSync("BrandNotInDefaults", "Foo.Color"); got != "Foo" {
		t.Errorf("defaultVendorIconForSync unknown brand color key = %q, want %q", got, "Foo")
	}
	// 未知品牌上游为空时，不应臆造图标。
	if got := defaultVendorIconForSync("BrandNotInDefaults", ""); got != "" {
		t.Errorf("defaultVendorIconForSync unknown brand empty upstream = %q, want empty", got)
	}
}

// 供应商图标存品牌裸名：彩色与头像变体后缀都要剥掉，链式高级写法保持原样。
func TestNormalizeVendorIconKeyStripsColorVariants(t *testing.T) {
	cases := map[string]string{
		"Claude":                          "Claude",
		"Claude.Color":                    "Claude",
		"  Claude.Avatar ":                "Claude",
		"OpenAI.Avatar":                   "OpenAI",
		"Claude.Avatar.type={'platform'}": "Claude.Avatar.type={'platform'}",
		"Foo.Bar":                         "Foo.Bar",
		"":                                "",
	}
	for in, want := range cases {
		if got := NormalizeVendorIconKey(in); got != want {
			t.Errorf("NormalizeVendorIconKey(%q) = %q, want %q", in, got, want)
		}
	}
}

// 供应商图标以运营在「模型-供应商」里设置的值为准：归因到该供应商的模型必须
// 携带同一个图标键，定价页（model.icon || vendor_icon）才会与设置一致。
// 品牌默认只在供应商没有设置图标时兜底。
func TestVendorIconForAttributionPrefersConfiguredVendorIcon(t *testing.T) {
	vendors := map[string]*Vendor{
		"Meta":      {Name: "Meta", Icon: "Meta.Color"},
		"Anthropic": {Name: "Anthropic", Icon: "Claude.Color"},
		"ByteDance": {Name: "ByteDance", Icon: ""},
	}
	if got := vendorIconForAttribution(vendors, "Meta"); got != "Meta.Color" {
		t.Errorf("vendorIconForAttribution(Meta) = %q, want %q", got, "Meta.Color")
	}
	// 供应商名大小写不敏感。
	if got := vendorIconForAttribution(vendors, "anthropic"); got != "Claude.Color" {
		t.Errorf("vendorIconForAttribution(anthropic) = %q, want %q", got, "Claude.Color")
	}
	// 供应商没有设置图标时回退到品牌默认。
	if got := vendorIconForAttribution(vendors, "ByteDance"); got != "Doubao.Color" {
		t.Errorf("vendorIconForAttribution(ByteDance) = %q, want %q", got, "Doubao.Color")
	}
	// 未登记品牌没有默认图标，也不臆造。
	if got := vendorIconForAttribution(vendors, "BrandNotKnown"); got != "" {
		t.Errorf("vendorIconForAttribution(unknown) = %q, want empty", got)
	}
}

// 关键词归因（官方目录没有该模型）写出的模型图标必须是供应商设置的那个。
func TestDerivedMetadataUsesVendorConfiguredIcon(t *testing.T) {
	vendors := map[string]*Vendor{
		"Meta": {Name: "Meta", Icon: "Meta.Color"},
	}
	values, ok := deriveMetadataValuesFromKeywords("llama-3-1-70b", vendors)
	if !ok {
		t.Fatal("keyword attribution must resolve llama-* to a brand")
	}
	if values.Vendor != "Meta" {
		t.Fatalf("vendor = %q, want %q", values.Vendor, "Meta")
	}
	if values.Icon != "Meta.Color" {
		t.Errorf("icon = %q, want %q", values.Icon, "Meta.Color")
	}
}

// 官方目录里已有的型号沿用目录给的图标（模型自身的官方图标优先于供应商图标）。
func TestDerivedMetadataKeepsCatalogIconOverVendorIcon(t *testing.T) {
	catalog := map[string]MetadataValues{
		"kimi-k2.6": {Description: "Moonshot Kimi", Icon: "Moonshot", Vendor: "Moonshot AI", NameRule: NameRuleExact, Status: 1},
	}
	vendors := map[string]*Vendor{
		"Moonshot AI": {Name: "Moonshot AI", Icon: "Moonshot.Color"},
	}
	values, ok := deriveMetadataValuesFromCatalog("kimi-k2.6-flare", catalog, vendors)
	if !ok {
		t.Fatal("catalog relative must resolve")
	}
	if values.Icon != "Moonshot" {
		t.Errorf("icon = %q, want %q", values.Icon, "Moonshot")
	}
}
