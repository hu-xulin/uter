package controller

import (
	"testing"

	"github.com/uter-ai/uter/model"

	"github.com/stretchr/testify/assert"
)

// TestLocalizePricingDescriptions 锁定定价接口按访客语言解析描述。
//
// 不变量：Description 永远是「该访客该看到的语言」，且解析不到时保持原值
// （英文）而不是变空——卡片描述消失比显示英文糟糕得多。
func TestLocalizePricingDescriptions(t *testing.T) {
	pricing := []model.Pricing{
		{
			ModelName:   "gpt-4o",
			Description: "English fallback",
			Descriptions: map[string]string{
				"en": "English fallback", "zh": "中文描述", "fr": "Description française",
			},
		},
		{ModelName: "no-i18n", Description: "Plain English"},
		{ModelName: "empty-multi", Description: "Only single"},
		{ModelName: "en-only", Descriptions: map[string]string{"en": "English"}},
	}

	localized := localizePricingDescriptions(pricing, "zh")
	require := assert.New(t)
	require.Equal("中文描述", localized[0].Description, "zh visitor must see the Chinese copy")
	require.Equal("Plain English", localized[1].Description, "no-i18n entry is untouched")
	require.Equal("Only single", localized[2].Description, "entry without any copy keeps its value")
	require.Equal("English", localized[3].Description, "en-only entry keeps its English copy")

	localized = localizePricingDescriptions(pricing, "fr")
	assert.Equal(t, "Description française", localized[0].Description)

	// 繁中无译文时经 zh 回退，而不是直接跳英文。
	localized = localizePricingDescriptions(pricing, "zh-TW")
	assert.Equal(t, "中文描述", localized[0].Description)

	// ru/vi 无译文时回退英文。
	localized = localizePricingDescriptions(pricing, "ru")
	assert.Equal(t, "English fallback", localized[0].Description)

	// 空语言不改动任何条目。
	assert.Equal(t, pricing, localizePricingDescriptions(pricing, ""))
	assert.Empty(t, localizePricingDescriptions(nil, "zh"))
}

// TestLocalizePricingDescriptionsDoesNotMutateInput 锁定不就地改缓存。
//
// model.GetPricing() 返回的是包级缓存切片，就地改写会让「第一个访客的语言」
// 污染后续所有访客——这是多语言接口最典型的串味 bug。
func TestLocalizePricingDescriptionsDoesNotMutateInput(t *testing.T) {
	pricing := []model.Pricing{{
		ModelName:    "gpt-4o",
		Description:  "English",
		Descriptions: map[string]string{"en": "English", "zh": "中文"},
	}}
	localized := localizePricingDescriptions(pricing, "zh")
	assert.Equal(t, "中文", localized[0].Description)
	assert.Equal(t, "English", pricing[0].Description, "cached pricing must stay in its source language")
}

// TestParseTranslationPayload 锁定补译结果解析。
//
// LLM 返回的 JSON 形态不可控（代码围栏、zh_TW 变体、非字符串值），解析要
// 宽容；但只接受归一后与请求语种精确匹配的条目，避免把「法语译文」错写进
// 俄语槽位。
func TestParseTranslationPayload(t *testing.T) {
	locales := []string{"zh-TW", "fr", "ru", "vi"}

	got := parseTranslationPayload(
		`{"zh-TW":"繁體描述","fr":"Description française","ru":"описание","vi":"mô tả"}`,
		locales,
	)
	assert.Equal(t, map[string]string{
		"zh-TW": "繁體描述", "fr": "Description française",
		"ru": "описание", "vi": "mô tả",
	}, got)

	// 带代码围栏与前后废话。
	got = parseTranslationPayload("```json\n{\"fr\":\"bonjour\"}\n```", locales)
	assert.Equal(t, map[string]string{"fr": "bonjour"}, got)

	// 变体 key 被归一后仍能命中。
	got = parseTranslationPayload(`{"zh_TW":"繁體","zh-Hant":"應忽略"}`, locales)
	assert.Equal(t, map[string]string{"zh-TW": "繁體"}, got)

	// 非字符串值与未请求语种被丢弃。
	got = parseTranslationPayload(`{"fr":123,"de":"Deutsch","ru":"ок"}`, locales)
	assert.Equal(t, map[string]string{"ru": "ок"}, got)

	// 不可解析时返回 nil，由上层降级为单语种重试。
	assert.Nil(t, parseTranslationPayload("not json at all", locales))
	assert.Nil(t, parseTranslationPayload("", locales))
}

// TestParseTranslationPayloadIsDeterministic 锁定择优结果与 map 迭代顺序无关。
//
// zh_TW / zh-Hant / zh-HK / zh-MO 全部归一到 "zh-TW"。实现若沿用「先到先得」，
// Go map 的随机迭代顺序会让同一份 LLM 输出时而取 zh_TW 的译文、时而取
// zh-Hant 的译文。这里连跑多轮锁定：原样指名的 zh_TW 始终胜出。
func TestParseTranslationPayloadIsDeterministic(t *testing.T) {
	locales := []string{"zh-TW"}
	payload := `{"zh_TW":"繁體描述","zh-Hant":"應忽略","zh-HK":"也應忽略","zh-MO":"同樣忽略"}`

	for i := 0; i < 200; i++ {
		got := parseTranslationPayload(payload, locales)
		assert.Equal(t, map[string]string{"zh-TW": "繁體描述"}, got,
			"iteration %d: an exactly-named locale key must always win over alias keys", i)
	}

	// 全部都是别名时，结果也应稳定：按 key 的字节序取第一个。
	// 注意 Go 字符串比较按字节，"zh-HK" < "zh-Hant"（'K'=0x4B < 'a'=0x61）
	// < "zh-MO"，所以最小的是 zh-HK。
	for i := 0; i < 200; i++ {
		got := parseTranslationPayload(`{"zh-MO":"甲","zh-Hant":"乙","zh-HK":"丙"}`, locales)
		assert.Equal(t, map[string]string{"zh-TW": "丙"}, got,
			"iteration %d: with only alias keys the byte order must decide", i)
	}
}

// TestCleanTranslation 锁定去掉模型爱加的引号包裹。
func TestCleanTranslation(t *testing.T) {
	assert.Equal(t, "描述", cleanTranslation(`"描述"`))
	assert.Equal(t, "描述", cleanTranslation("“描述”"))
	assert.Equal(t, "描述", cleanTranslation("'描述'"))
	assert.Equal(t, "描述", cleanTranslation("  描述  "))
	assert.Equal(t, "", cleanTranslation("   "))
	// 不该把内部引号剥掉。
	assert.Equal(t, `say "hi"`, cleanTranslation(`"say "hi""`))
}

// TestNormalizeOpenAIBaseURL 锁定 base 归一化，避免拼出 /v1/v1/...
func TestNormalizeOpenAIBaseURL(t *testing.T) {
	cases := map[string]string{
		"https://api.example.com":        "https://api.example.com",
		"https://api.example.com/":       "https://api.example.com",
		"https://api.example.com/v1":     "https://api.example.com",
		"https://api.example.com/v1/":    "https://api.example.com",
		"https://api.example.com/V1":     "https://api.example.com",
		"  https://api.example.com/v1  ": "https://api.example.com",
		// 真实业务路径不能被剥掉。
		"https://api.groq.com/openai/v1beta": "https://api.groq.com/openai/v1beta",
	}
	for input, want := range cases {
		assert.Equal(t, want, normalizeOpenAIBaseURL(input), "input=%q", input)
	}
}

// TestTranslationLocalesDefault 锁定补译语种的默认与覆盖行为。
func TestTranslationLocalesDefault(t *testing.T) {
	// 未配置时用除英语外的全部 6 语：上游只发 zh/en/ja 且覆盖不全，
	// 故 zh/ja 一并纳入兜底（只补空白，不覆盖已有描述）。
	assert.ElementsMatch(t, []string{"zh", "zh-TW", "fr", "ja", "ru", "vi"}, translationLocales())
}

// TestHasMissingLocale 锁定「哪些模型需要补译」的判定。
func TestHasMissingLocale(t *testing.T) {
	descriptions := model.LocalizedDescription{"en": "English"}
	assert.True(t, hasMissingLocale(descriptions, []string{"zh-TW", "fr"}))
	assert.False(t, hasMissingLocale(descriptions, []string{"en"}))
	// 空白值等同于缺失。
	assert.True(t, hasMissingLocale(model.LocalizedDescription{"en": "e", "fr": "  "}, []string{"fr"}))
	assert.False(t, hasMissingLocale(nil, nil))
}
