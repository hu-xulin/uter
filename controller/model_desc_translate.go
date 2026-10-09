package controller

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

// descriptionTranslateLocales 是上游目录不提供、需要由 LLM 补译的语种。
//
// 上游 llm-metadata 只有 zh/en/ja；前端有 7 份语言包，缺的这 4 语若不回退
// 到英文，繁中/法语/俄语/越南语访客看到的就是英文卡片。
var descriptionTranslateLocales = []string{"zh-TW", "fr", "ru", "vi"}

// translateConcurrency 限制同时在途的翻译请求数。
//
// 一次渠道同步可能引入几百个新模型，逐条串行会让同步迟迟不返回；完全并发
// 又容易触发上游限流。取一个小并发数在两者之间取平衡。
const translateConcurrency = 4

// translateBatchSize 单次请求里合并多少个「模型 -> 描述」条目。
//
// 一次请求翻译多个条目能把固定开销摊薄，但条目越多越容易超出 max_tokens
// 被截断，因此取一个偏保守的值，并在解析失败时降级为逐条翻译。
const translateBatchSize = 8

// translateMissingDescriptions 用站内配置的 OpenAI 兼容模型，把英文描述补译成
// 上游缺失的语种。
//
// 未启用或未配置翻译模型时返回 nil,nil（不是错误）——补译是增强项，缺失它
// 只意味着那几种语言回退显示英文，不该让整轮同步失败。
func translateMissingDescriptions(ctx context.Context, names []string) (map[string]map[string]string, error) {
	base, key, modelName, ok := translationEndpoint()
	if !ok {
		return nil, nil
	}
	locales := translationLocales()
	need, sources, err := loadMissingTranslations(names, locales)
	if err != nil {
		return nil, err
	}
	if len(need) == 0 {
		return nil, nil
	}

	timeout := time.Duration(common.GetEnvOrDefault(translationTimeoutOptionKey, 60)) * time.Second
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	// 每个元素是「单个模型 -> (locale -> 译文)」。用 nil 表示该模型失败，
	// 便于最后只合并成功的部分。
	results := make([]map[string]map[string]string, len(need))
	var wg sync.WaitGroup
	sem := make(chan struct{}, translateConcurrency)
	var failed atomicCount

	for i, name := range need {
		wg.Add(1)
		sem <- struct{}{}
		go func(idx int, modelKey string, source string) {
			defer wg.Done()
			defer func() { <-sem }()
			translated, err := translateOneModel(ctx, base, key, modelName, modelKey, source, locales)
			if err != nil {
				failed.add()
				common.SysLog(fmt.Sprintf("translate description for %s failed: %v", modelKey, err))
				return
			}
			if len(translated) > 0 {
				results[idx] = map[string]map[string]string{modelKey: translated}
			}
		}(i, name, sources[name])
	}
	wg.Wait()

	merged := make(map[string]map[string]string, len(results))
	for _, item := range results {
		if len(item) == 0 {
			continue
		}
		for modelKey, byLocale := range item {
			merged[modelKey] = byLocale
		}
	}
	if len(merged) == 0 && failed.get() > 0 {
		return nil, fmt.Errorf("all %d description translations failed", failed.get())
	}
	return merged, nil
}

// translateOneModel 翻译单个模型的描述。
//
// 先按批尝试（多个目标语种一次请求）；批处理结果不可用时降级为逐语种
// 单发，避免因为一次输出被截断就丢掉整个模型的翻译。
func translateOneModel(ctx context.Context, base, key, chatModel, modelKey, source string, locales []string) (map[string]string, error) {
	batched, err := translateBatch(ctx, base, key, chatModel, modelKey, source, locales)
	if err == nil && len(batched) == len(locales) {
		return batched, nil
	}
	if err != nil && len(batched) == 0 && len(locales) == 1 {
		return nil, err
	}

	single := make(map[string]string, len(locales))
	var firstErr error
	for _, locale := range locales {
		if text, ok := batched[locale]; ok && strings.TrimSpace(text) != "" {
			single[locale] = text
			continue
		}
		text, err := translateSingle(ctx, base, key, chatModel, modelKey, source, locale)
		if err != nil {
			if firstErr == nil {
				firstErr = err
			}
			continue
		}
		if text != "" {
			single[locale] = text
		}
	}
	if len(single) == 0 && firstErr != nil {
		return nil, firstErr
	}
	return single, nil
}

// translateBatch 一次请求翻译多个目标语种，要求模型返回 JSON 对象。
func translateBatch(ctx context.Context, base, key, chatModel, modelKey, source string, locales []string) (map[string]string, error) {
	localeList := strings.Join(locales, ", ")
	prompt := fmt.Sprintf(
		"Translate the following AI model description into each of these languages: %s.\n"+
			"Model name: %s\nDescription: %s\n\n"+
			"Return ONLY a JSON object mapping each language tag to its translation, "+
			"for example {\"%s\": \"...\"}. Keep model names, product names and numbers untranslated. "+
			"Return no prose and no code fence.",
		localeList, modelKey, source, locales[0],
	)
	raw, err := callOpenAIChat(ctx, base, key, chatModel, translationSystemPrompt, prompt, 2048)
	if err != nil {
		return nil, err
	}
	return parseTranslationPayload(raw, locales), nil
}

// translateSingle 单语种翻译，作为批处理的降级路径。
func translateSingle(ctx context.Context, base, key, chatModel, modelKey, source, locale string) (string, error) {
	prompt := fmt.Sprintf(
		"Translate the following AI model description into %s.\n"+
			"Model name: %s\nDescription: %s\n\n"+
			"Return ONLY the translated text, with no explanation and no quotes.",
		locale, modelKey, source,
	)
	raw, err := callOpenAIChat(ctx, base, key, chatModel, translationSystemPrompt, prompt, 1024)
	if err != nil {
		return "", err
	}
	return cleanTranslation(raw), nil
}

const translationSystemPrompt = "You are a professional technical translator for an AI model catalog. " +
	"You translate model descriptions faithfully and concisely, preserving technical terms, " +
	"model names and numbers. You reply with the requested format only."

// parseTranslationPayload 解析模型返回的翻译结果。
//
// 逐个语种做宽松匹配：模型可能回传 "zh-TW" 也可能回传 "zh_TW"/"繁體中文"，
// 认不出的条目直接跳过（由上层降级为单语种重试），绝不因为一个语种解析
// 失败就丢掉整批。
func parseTranslationPayload(raw string, locales []string) map[string]string {
	cleaned := cleanTranslation(raw)
	if cleaned == "" {
		return nil
	}
	// 容忍 ```json 包裹与前后废话：截取最外层的大括号内容。
	if start := strings.Index(cleaned, "{"); start >= 0 {
		if end := strings.LastIndex(cleaned, "}"); end > start {
			cleaned = cleaned[start : end+1]
		}
	}
	var payload map[string]any
	if err := common.Unmarshal([]byte(cleaned), &payload); err != nil {
		return nil
	}
	out := make(map[string]string, len(locales))
	for targetLocale, value := range payload {
		text, ok := value.(string)
		if !ok {
			continue
		}
		text = cleanTranslation(text)
		if text == "" {
			continue
		}
		normalized, ok := model.NormalizeModelDescriptionLocale(targetLocale)
		if !ok {
			continue
		}
		for _, locale := range locales {
			if locale == normalized {
				if _, exists := out[locale]; !exists {
					out[locale] = text
				}
			}
		}
	}
	return out
}

// cleanTranslation 去掉模型爱加的引号包裹与首尾空白。
//
// 必须按 rune 切片：中文全角引号 “ ” 是 3 字节 UTF-8，按字节切会把
// 多字节字符切成乱码（译文直接损坏）。
func cleanTranslation(raw string) string {
	text := strings.TrimSpace(raw)
	runes := []rune(text)
	if len(runes) >= 2 {
		first, last := runes[0], runes[len(runes)-1]
		if (first == '"' && last == '"') ||
			(first == '“' && last == '”') ||
			(first == '\'' && last == '\'') {
			text = strings.TrimSpace(string(runes[1 : len(runes)-1]))
		}
	}
	return text
}

// callOpenAIChat 调用 OpenAI 兼容的 /v1/chat/completions 并取首个 choice 文本。
//
// 与 relay/costopt 的 openAIChat 同构：管理员通常按上游文档直接填带版本段的
// base（如 https://api.example.com/v1），因此这里同样先归一化再拼接路径。
func callOpenAIChat(ctx context.Context, base, key, chatModel, system, user string, maxTokens int) (string, error) {
	messages := make([]map[string]any, 0, 2)
	if system != "" {
		messages = append(messages, map[string]any{"role": "system", "content": system})
	}
	messages = append(messages, map[string]any{"role": "user", "content": user})

	payload, err := common.Marshal(map[string]any{
		"model":       chatModel,
		"messages":    messages,
		"temperature": 0,
		"max_tokens":  maxTokens,
	})
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		normalizeOpenAIBaseURL(base)+"/v1/chat/completions", bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("translation endpoint returned %d: %s", resp.StatusCode, truncateForLog(string(body)))
	}
	var out struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := common.Unmarshal(body, &out); err != nil {
		return "", err
	}
	if len(out.Choices) == 0 {
		return "", fmt.Errorf("translation endpoint returned no choices")
	}
	return out.Choices[0].Message.Content, nil
}

// normalizeOpenAIBaseURL 去掉结尾斜杠与结尾的版本段，避免拼出 /v1/v1/...
func normalizeOpenAIBaseURL(base string) string {
	b := strings.TrimRight(strings.TrimSpace(base), "/")
	for i := 0; i < 4; i++ {
		slash := strings.LastIndexByte(b, '/')
		if slash < 0 {
			break
		}
		last := b[slash+1:]
		if len(last) != 2 || (last[0] != 'v' && last[0] != 'V') || last[1] < '0' || last[1] > '9' {
			break
		}
		b = strings.TrimRight(b[:slash], "/")
	}
	return b
}

// translationEndpoint 读取补译用的 OpenAI 兼容端点。
//
// 三项（base / key / model）缺一不可：与 costopt 的既有约定一致，半配置的
// 端点静默回退为「不补译」，而不是拿错误的凭据去打上游。
func translationEndpoint() (base, key, chatModel string, ok bool) {
	if !strings.EqualFold(strings.TrimSpace(common.OptionMap[translationEnabledOptionKey]), "true") {
		return "", "", "", false
	}
	base = strings.TrimSpace(common.OptionMap[translationBaseURLOptionKey])
	key = strings.TrimSpace(common.OptionMap[translationAPIKeyOptionKey])
	chatModel = strings.TrimSpace(common.OptionMap[translationModelOptionKey])
	if base == "" || key == "" || chatModel == "" {
		return "", "", "", false
	}
	return base, key, chatModel, true
}

// translationLocales 返回需要补译的语种，允许管理员用选项裁剪。
//
// 解析后仍走 NormalizeModelDescriptionLocale 归一，避免管理员填
// "zh_TW, fr" 这类写法被静默忽略。
func translationLocales() []string {
	raw := strings.TrimSpace(common.OptionMap[translationLocalesOptionKey])
	if raw == "" {
		return append([]string(nil), descriptionTranslateLocales...)
	}
	seen := make(map[string]struct{}, len(descriptionTranslateLocales))
	locales := make([]string, 0, len(descriptionTranslateLocales))
	for part := range strings.SplitSeq(raw, ",") {
		normalized, ok := model.NormalizeModelDescriptionLocale(part)
		if !ok {
			continue
		}
		if _, dup := seen[normalized]; dup {
			continue
		}
		seen[normalized] = struct{}{}
		locales = append(locales, normalized)
	}
	if len(locales) == 0 {
		return append([]string(nil), descriptionTranslateLocales...)
	}
	return locales
}

func truncateForLog(text string) string {
	text = strings.TrimSpace(text)
	if len(text) <= 200 {
		return text
	}
	return text[:200] + "..."
}

// atomicCount 是补译失败计数的并发安全小工具。
type atomicCount struct {
	mu sync.Mutex
	n  int
}

func (a *atomicCount) add() {
	a.mu.Lock()
	a.n++
	a.mu.Unlock()
}

func (a *atomicCount) get() int {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.n
}
