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

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
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

// 同步创建/更新供应商时，已知品牌必须收敛到权威彩色映射，而不是盲从中游下发的图标。
// 这正是对用户反馈「claude-haiku-5-5 没改成彩色 / gemini 系列仍用 Google logo」的根因修复：
// Google 供应商绝不能落到 Google.Color，Anthropic 绝不能落到 Anthropic.Avatar。
func TestDefaultVendorIconForSyncUsesAuthoritativeMapping(t *testing.T) {
	cases := []struct {
		name     string
		upstream string
		want     string
	}{
		{"Google", "Google.Color", "Gemini.Color"},
		{"Google", "Google", "Gemini.Color"},
		{"Google", "Google.Avatar", "Gemini.Color"},
		{"Anthropic", "Anthropic.Avatar", "Claude.Color"},
		{"Anthropic", "Anthropic", "Claude.Color"},
		{"OpenAI", "OpenAI.Avatar", "OpenAI.Avatar"},
		{"ByteDance", "ByteDance", "Doubao.Color"},
	}
	for _, c := range cases {
		if got := defaultVendorIconForSync(c.name, c.upstream); got != c.want {
			t.Errorf("defaultVendorIconForSync(%q, %q) = %q, want %q", c.name, c.upstream, got, c.want)
		}
	}
}

// 未知品牌不在权威映射内，应信任上游下发的图标（经彩色归一化）。
func TestDefaultVendorIconForSyncFallsBackToUpstream(t *testing.T) {
	if got := defaultVendorIconForSync("BrandNotInDefaults", "Foo.Bar"); got != NormalizeColorIconKey("Foo.Bar") {
		t.Errorf("defaultVendorIconForSync unknown brand = %q, want %q", got, NormalizeColorIconKey("Foo.Bar"))
	}
	// 未知品牌上游为空时，不应臆造图标。
	if got := defaultVendorIconForSync("BrandNotInDefaults", ""); got != "" {
		t.Errorf("defaultVendorIconForSync unknown brand empty upstream = %q, want empty", got)
	}
}

// 对齐迁移必须把漂移过的已知品牌供应商图标订正到权威彩色键。
// 用内存库模拟 Google/Anthropic 漂移记录，断言迁移后变为 Gemini.Color / Claude.Color。
func TestAlignVendorIconsToDefaults(t *testing.T) {
	originalDB := DB
	t.Cleanup(func() { DB = originalDB })
	var err error
	DB, err = gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, DB.AutoMigrate(&Vendor{}))

	seed := []Vendor{
		{Name: "Google", Icon: "Google.Color", Status: 1},
		{Name: "Anthropic", Icon: "Anthropic.Avatar", Status: 1},
		{Name: "OpenAI", Icon: "OpenAI.Avatar", Status: 1},
		{Name: "Moonshot", Icon: "Moonshot.Color", Status: 1},
		{Name: "UnknownBrand", Icon: "Whatever", Status: 1},
	}
	for i := range seed {
		require.NoError(t, DB.Create(&seed[i]).Error)
	}
	if err := alignVendorIconsToDefaults(); err != nil {
		t.Fatalf("alignVendorIconsToDefaults: %v", err)
	}
	var got []Vendor
	require.NoError(t, DB.Order("id").Find(&got).Error)
	want := map[string]string{
		"Google":       "Gemini.Color",
		"Anthropic":    "Claude.Color",
		"OpenAI":       "OpenAI.Avatar",
		"Moonshot":     "Moonshot.Avatar",
		"UnknownBrand": "Whatever",
	}
	for _, v := range got {
		w, ok := want[v.Name]
		if !ok || v.Icon != w {
			t.Errorf("vendor %q icon = %q, want %q", v.Name, v.Icon, w)
		}
	}
	// 幂等：二次运行不应产生不同结果。
	if err := alignVendorIconsToDefaults(); err != nil {
		t.Fatalf("alignVendorIconsToDefaults second run: %v", err)
	}
	var got2 []Vendor
	require.NoError(t, DB.Order("id").Find(&got2).Error)
	for _, v := range got2 {
		w, ok := want[v.Name]
		if !ok || v.Icon != w {
			t.Errorf("vendor %q icon (2nd) = %q, want %q", v.Name, v.Icon, w)
		}
	}
}
