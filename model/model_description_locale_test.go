package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestLocalizedDescriptionResolveFallbackChain 锁定按访客语言取描述的回退顺序。
//
// 这是定价页多语言的核心不变量：任何语种都不允许因为「没有精确命中」而
// 显示空白，必须沿回退链一路降级到英文。
func TestLocalizedDescriptionResolveFallbackChain(t *testing.T) {
	descriptions := LocalizedDescription{
		"en": "Fast reasoning model",
		"zh": "快速推理模型",
		"ja": "高速推論モデル",
	}
	cases := []struct {
		locale string
		want   string
	}{
		{"en", "Fast reasoning model"},
		{"zh", "快速推理模型"},
		{"ja", "高速推論モデル"},
		// 繁中缺失时回退到简中，而不是直接跳英文。
		{"zh-TW", "快速推理模型"},
		// 法/俄/越无译文时回退英文。
		{"fr", "Fast reasoning model"},
		{"ru", "Fast reasoning model"},
		{"vi", "Fast reasoning model"},
		// 未知语种同样降级英文，而不是返回空串。
		{"de", "Fast reasoning model"},
	}
	for _, tc := range cases {
		assert.Equal(t, tc.want, descriptions.Resolve(tc.locale), "locale=%s", tc.locale)
	}

	// 全空时返回空串，由调用方决定是否回落到单字段。
	assert.Empty(t, LocalizedDescription(nil).Resolve("zh"))
	assert.Empty(t, LocalizedDescription{}.Resolve("en"))
}

// TestLocalizedDescriptionResolveSkipsBlankEntries 锁定「空白条目视为缺失」。
//
// 只填了一半的语种如果被当成有效值，Resolve 会返回空串让卡片描述消失。
func TestLocalizedDescriptionResolveSkipsBlankEntries(t *testing.T) {
	descriptions := LocalizedDescription{"en": "English", "fr": "   "}
	assert.Equal(t, "English", descriptions.Resolve("fr"))
}

// TestSanitizeDescriptionNormalizesLocaleKeys 锁定语种标签归一。
//
// 上游目录与 LLM 都可能回传 zh_CN / zh-Hant 这类非规范 key，原样入库会让
// Resolve 的精确匹配失配，表现为「配了多语却仍显示英文」。
func TestSanitizeDescriptionNormalizesLocaleKeys(t *testing.T) {
	got := sanitizeDescription(map[string]string{
		"zh_CN":   "简体中文",
		"zh-Hant": "繁體中文",
		"zh_TW":   "另一份繁中",
		"fr":      "  Français  ",
		"de":      "Deutsch",
		"":        "空 key",
		"ja":      "   ",
	})
	assert.Equal(t, LocalizedDescription{
		"zh": "简体中文",
		// zh-Hant 与 zh_TW 归一到同一个语种，按 key 字典序保留 zh-Hant，
		// 结果不随 map 迭代顺序漂移。
		"zh-TW": "繁體中文",
		"fr":    "Français",
	}, got)

	// 同语种多条时的裁决只取决于 key 字典序，与插入顺序无关。
	assert.Equal(t, "應忽略", sanitizeDescription(map[string]string{
		"zh-Hant": "應忽略", "zh_TW": "另一份",
	})["zh-TW"])

	assert.Nil(t, sanitizeDescription(nil))
	assert.Nil(t, sanitizeDescription(map[string]string{"fr": "  "}))
}

// TestSanitizeDescriptionIsDeterministic 锁定归一化结果与 map 迭代顺序无关。
//
// Go 的 map 遍历顺序随机，若「同语种保留首条」依赖它，同一份输入每次同步
// 可能写入不同译文，表现为描述在多次同步之间莫名变化。
func TestSanitizeDescriptionIsDeterministic(t *testing.T) {
	input := map[string]string{
		"zh-TW": "A", "zh_Hant": "B", "zh_CN": "C", "zh-Hans": "D",
		"en": "E", "en_US": "F",
	}
	want := sanitizeDescription(input)
	for i := 0; i < 50; i++ {
		assert.Equal(t, want, sanitizeDescription(input))
	}
}

// TestNormalizeModelDescriptionLocale 覆盖上游与 i18n 生态的常见写法。
func TestNormalizeModelDescriptionLocale(t *testing.T) {
	cases := map[string]string{
		"zh":       "zh",
		"zh-CN":    "zh",
		"zh_CN":    "zh",
		"zh-Hans":  "zh",
		"zh-TW":    "zh-TW",
		"zh_tw":    "zh-TW",
		"zh-Hant":  "zh-TW",
		"zh-HK":    "zh-TW",
		"EN":       "en",
		" fr ":     "fr",
		"RU":       "ru",
		"ja":       "ja",
		"vi":       "vi",
		"de":       "",
		"":         "",
		"klingon":  "",
		"zh-Hans2": "",
	}
	for input, want := range cases {
		got, ok := NormalizeModelDescriptionLocale(input)
		if want == "" {
			assert.False(t, ok, "input=%q should be unsupported", input)
			continue
		}
		require.True(t, ok, "input=%q should be supported", input)
		assert.Equal(t, want, got, "input=%q", input)
	}
}

// TestLocalizedDescriptionScan 锁定反序列化容错。
//
// models.descriptions 是 text 列，历史数据与人工填写可能留下裸字符串而非
// JSON 对象；一条脏数据不该让整行读取失败。
func TestLocalizedDescriptionScan(t *testing.T) {
	var target LocalizedDescription

	require.NoError(t, target.Scan([]byte(`{"en":"English","fr":"Francais"}`)))
	assert.Equal(t, LocalizedDescription{"en": "English", "fr": "Francais"}, target)

	// 裸字符串按英文单语解析。
	target = nil
	require.NoError(t, target.Scan([]byte("Bare English")))
	assert.Equal(t, LocalizedDescription{"en": "Bare English"}, target)

	// 空串 / null / nil 都解析为 nil 而非报错。
	for _, raw := range []any{nil, "", "   ", "null", []byte("")} {
		target = LocalizedDescription{"en": "stale"}
		require.NoError(t, target.Scan(raw), "raw=%v", raw)
		assert.Nil(t, target, "raw=%v should clear", raw)
	}

	// 非法 JSON 不能 panic，也不该返回错误打断整次读取。
	target = nil
	require.NoError(t, target.Scan([]byte(`{"en": broken`)))
	assert.Nil(t, target)
}

// TestLocalizedDescriptionValue 锁定入库序列化，空值写空串而非 "null"。
//
// 返回值必须是 string：UpdateColumn 等不经过 Serializer 的写入路径会把
// []byte 交给驱动并被静默跳过（无报错、无写入）。
func TestLocalizedDescriptionValue(t *testing.T) {
	value, err := LocalizedDescription{"en": "English"}.Value()
	require.NoError(t, err)
	text, ok := value.(string)
	require.True(t, ok, "Value 必须返回 string，实际是 %T", value)
	assert.JSONEq(t, `{"en":"English"}`, text)

	value, err = LocalizedDescription(nil).Value()
	require.NoError(t, err)
	assert.Equal(t, "", value)
}

// TestNormalizeModelDescriptionsKeepsSingleFieldInSync 锁定单字段与多语的互填。
//
// 只填了单字段的历史数据应立刻能多语渲染；反之多语里的英文应回写单字段，
// 让不认识 Descriptions 的旧调用方继续可用。
func TestNormalizeModelDescriptionsKeepsSingleFieldInSync(t *testing.T) {
	description, descriptions := normalizeModelDescriptions("Legacy English", nil)
	assert.Equal(t, "Legacy English", description)
	assert.Equal(t, LocalizedDescription{"en": "Legacy English"}, descriptions)

	description, descriptions = normalizeModelDescriptions("", LocalizedDescription{"en": "English", "ja": "日本語"})
	assert.Equal(t, "English", description, "single field must be backfilled from the English locale")
	assert.Len(t, descriptions, 2)

	// 已有英文时不覆盖：管理员手工润色的译文优先于单字段。
	description, descriptions = normalizeModelDescriptions("Stale English", LocalizedDescription{"en": "Curated English"})
	assert.Equal(t, "Stale English", description, "single field is the caller's value; it is not rewritten")
	assert.Equal(t, "Curated English", descriptions["en"])

	// 非英文语种永不被单字段覆盖。
	_, descriptions = normalizeModelDescriptions("English", LocalizedDescription{"fr": "Français"})
	assert.Equal(t, "Français", descriptions["fr"])
	assert.Equal(t, "English", descriptions["en"])

	description, descriptions = normalizeModelDescriptions("   ", nil)
	assert.Empty(t, description)
	assert.Nil(t, descriptions)
}

// TestLocalizedDescriptionSortedLocales 锁定已覆盖语种的稳定顺序，便于日志断言。
func TestLocalizedDescriptionSortedLocales(t *testing.T) {
	descriptions := LocalizedDescription{"vi": "VI", "en": "EN", "fr": "FR", "ja": "JA"}
	assert.Equal(t, []string{"en", "fr", "ja", "vi"}, descriptions.SortedLocales())
	assert.Nil(t, LocalizedDescription(nil).SortedLocales())
}
