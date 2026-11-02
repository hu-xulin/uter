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
	"os"
	"path/filepath"
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
	if got := getDefaultVendorIcon("ByteDance"); got != "ByteDance.Color" {
		t.Errorf(`getDefaultVendorIcon("ByteDance") = %q, want "ByteDance.Color"`, got)
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

// 同步创建供应商时，已知品牌取公司 logo 的品牌裸名，而不是盲从中游下发的图标。
// 上游下发的是产品 logo（Anthropic→Claude.Color、Google→Gemini.Color），
// 供应商要显示的是公司 logo；模型自己的产品 logo 由模型 icon 承载。
func TestDefaultVendorIconForSyncUsesAuthoritativeMapping(t *testing.T) {
	cases := []struct {
		name     string
		upstream string
		want     string
	}{
		{"Google", "Google.Color", "Google"},
		{"Google", "Google", "Google"},
		{"Google", "Gemini.Color", "Google"},
		{"Anthropic", "Anthropic.Avatar", "Anthropic"},
		{"Anthropic", "Claude.Color", "Anthropic"},
		{"OpenAI", "OpenAI.Avatar", "OpenAI"},
		{"ByteDance", "Doubao.Color", "ByteDance"},
		{"Alibaba", "Qwen.Color", "Alibaba"},
		{"Tencent", "Hunyuan.Color", "Tencent"},
		{"Baidu", "Wenxin.Color", "Baidu"},
		{"Meta", "Ollama.Avatar", "Meta"},
	}
	for _, c := range cases {
		if got := defaultVendorIconForSync(c.name, c.upstream); got != c.want {
			t.Errorf("defaultVendorIconForSync(%q, %q) = %q, want %q", c.name, c.upstream, got, c.want)
		}
	}
}

// 供应商图标必须是公司 logo，不能是别家的产品 logo。
// 上游元数据按厂商给的是产品 logo（Claude / Gemini / Doubao / Qwen / Hunyuan），
// 直接落库会让供应商列显示成大模型 logo。
func TestDefaultVendorIconsUseCompanyLogos(t *testing.T) {
	companyLogos := map[string]string{
		"Anthropic": "Anthropic",
		"Google":    "Google",
		"ByteDance": "ByteDance",
		"Alibaba":   "Alibaba",
		"Tencent":   "Tencent",
		"Baidu":     "Baidu",
		"Meta":      "Meta",
		"Azure":     "Microsoft",
	}
	for name, want := range companyLogos {
		if got := defaultVendorIcons[name]; got != want {
			t.Errorf("defaultVendorIcons[%q] = %q, want %q", name, got, want)
		}
	}
	// 产品 logo 不得出现在供应商映射里。
	// 注：01.AI 与 iFlytek 在 @lobehub/icons 里没有对应的公司品牌，保留其产品
	// logo（Yi / Spark）是唯一可渲染的选择，故不在此列。
	productLogos := map[string]bool{
		"Claude": true, "Gemini": true, "Doubao": true, "Qwen": true,
		"Hunyuan": true, "Wenxin": true, "Ollama": true, "AzureAI": true,
	}
	for name, icon := range defaultVendorIcons {
		if productLogos[icon] {
			t.Errorf("defaultVendorIcons[%q] = %q is a product logo, want a company logo", name, icon)
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

// 供应商图标是运营在「模型-供应商」里逐条设置的配置：归因到该供应商的模型
// **不得**把这个图标写进自己的 icon 字段。定价页模型卡片只渲染模型自己的
// 产品 logo（彩色），没有产品 logo 就显示首字母占位，绝不退化为公司 logo。
// 这条断言是防回归守卫：曾经的关键词归因把供应商图标灌进 models.icon，
// 导致定价页卡片大面积显示公司 logo（用户多次投诉的回归点）。
//
// 关键词归因现在会给模型补上它**自己的产品 logo**（Claude、Gemini、Qwen……），
// 但绝不携带供应商的公司 logo（Anthropic、Google、Alibaba……）。
func TestKeywordAttributionNeverCarriesVendorIcon(t *testing.T) {
	cases := []struct {
		model          string
		wantProduct    string
		wantNotCompany string
	}{
		{"claude-4-opus", "Claude", "Anthropic"},
		{"gemini-3-pro", "Gemini", "Google"},
		{"qwen-4-max", "Qwen", "Alibaba"},
		{"llama-3-1-70b", "Meta", ""},
	}
	for _, tc := range cases {
		values, ok := deriveMetadataValuesFromKeywords(tc.model)
		if !ok {
			t.Fatalf("keyword attribution must resolve %s to a brand", tc.model)
		}
		if values.Icon != tc.wantProduct {
			t.Errorf("deriveMetadataValuesFromKeywords(%q) icon = %q, want product logo %q", tc.model, values.Icon, tc.wantProduct)
		}
		if tc.wantNotCompany != "" && values.Icon == tc.wantNotCompany {
			t.Errorf("deriveMetadataValuesFromKeywords(%q) icon = %q, must not be the vendor company logo", tc.model, values.Icon)
		}
	}
	// 目录里没有该型号时走关键词归因：有供应商、有产品 logo，但绝不是公司 logo。
	values, ok := deriveMetadataValuesFromCatalog("claude-4-opus", map[string]MetadataValues{})
	if !ok {
		t.Fatal("empty catalog must still keyword-attribute claude-*")
	}
	if values.Icon != "Claude" {
		t.Errorf("keyword fallback icon = %q, want product logo %q", values.Icon, "Claude")
	}
}

// 官方目录里已有的型号沿用目录给的图标（模型自身的官方图标优先于供应商图标）。
func TestDerivedMetadataKeepsCatalogIconOverVendorIcon(t *testing.T) {
	catalog := map[string]MetadataValues{
		"kimi-k2.6": {Description: "Moonshot Kimi", Icon: "Moonshot", Vendor: "Moonshot AI", NameRule: NameRuleExact, Status: 1},
	}
	values, ok := deriveMetadataValuesFromCatalog("kimi-k2.6-flare", catalog)
	if !ok {
		t.Fatal("catalog relative must resolve")
	}
	if values.Icon != "Moonshot" {
		t.Errorf("icon = %q, want %q", values.Icon, "Moonshot")
	}
}

// 供应商图标是运营在「模型-供应商」里逐条设置的配置，不是可以由同步或迁移
// 批量推导出来的派生数据。
//
// 历史上出现过两次「存量订正」：一次是启动迁移 alignVendorIconsToDefaults，
// 一次是 bin/ 下的 SQL 脚本，都把运营设置的 Anthropic / Google / Meta 改写成
// Claude.Color / Gemini.Color / Ollama.Avatar——运营看到的是「我选的图标被换
// 成了别家的 logo」。启动迁移已删除，这条测试守住另一半：bin/ 下不得再出现
// 批量改写 vendors.icon 的脚本。图标只能由管理端保存单条记录时改变。
func TestNoBulkVendorIconRewriteScript(t *testing.T) {
	paths, err := filepath.Glob("../bin/*.sql")
	if err != nil {
		t.Fatalf("glob sql scripts: %v", err)
	}
	for _, path := range paths {
		body, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("read %s: %v", path, err)
		}
		sql := strings.ToUpper(string(body))
		if strings.Contains(sql, "UPDATE VENDORS") && strings.Contains(sql, "ICON") {
			t.Errorf("%s 批量改写 vendors.icon；供应商图标只能由运营在管理端逐条保存", path)
		}
	}
}

// 关键词归因的产品 logo 表必须完整覆盖渠道常见命名：seedance-*（字节视频
// 生成模型，归属豆包大模型家族）等品牌缺映射时，定价广场卡片回落首字母
// 占位（2026-11-02 用户反馈「缺失 icon」的根因）。
func TestDefaultProductIconForModelCoversVideoAndEmbeddingBrands(t *testing.T) {
	cases := []struct{ name, want string }{
		{"seedance-2.0", "Doubao"},
		{"seedance-2.0-ab", "Doubao"},
		{"seedance-2.0-fast", "Doubao"},
		{"seedance-2.5-ab", "Doubao"},
		// 首段精确命中优先：doubao- 前缀仍归 Doubao，不被子串规则改写。
		{"doubao-seedance-2-0-260128", "Doubao"},
		{"kling-v2-master", "Kling"},
		{"vidu-q2", "Vidu"},
		{"sora-2-pro", "Sora"},
		{"sf-bge-m3", "BAAI"},
		{"gpt-4o", "OpenAI"},
		// @lobehub/icons 无 Veo 品牌：宁可首字母占位，不写渲染不出的键。
		{"veo-3", ""},
	}
	for _, c := range cases {
		if got := defaultProductIconForModel(c.name); got != c.want {
			t.Errorf("defaultProductIconForModel(%q) = %q, want %q", c.name, got, c.want)
		}
	}
}

// defaultProductIcons 的每个值都必须在 lobeIconVariants 里可渲染；写进
// 不可渲染的键会让 defaultProductIconForModel 静默回落空串，映射形同虚设。
func TestDefaultProductIconsAreRenderable(t *testing.T) {
	for pattern, key := range defaultProductIcons {
		if _, ok := lobeIconVariants[key]; !ok {
			t.Errorf("defaultProductIcons[%q] = %q 不在 lobeIconVariants 中，不可渲染", pattern, key)
		}
	}
}
