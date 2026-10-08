package controller

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

// upstreamDescriptionLocales 是上游官方目录实际提供的语种。
//
// 上游 llm-metadata 只维护 zh/en/ja 三份 models.json，其余语种必须由站内
// LLM 补译（见 model_desc_translate.go）。这里按「上游有的优先拉」的原则
// 固定顺序，前端 7 语里剩下的 4 语再走翻译补齐。
var upstreamDescriptionLocales = []string{"en", "zh", "ja"}

// syncLocalizedDescriptions 在上游目录同步之后，把每个模型的多语描述补齐。
//
// 分两步：
//  1. 按 upstreamDescriptionLocales 各拉一次目录，合并成 locale -> 描述；
//  2. 缺失的语种交给 LLM 从英文补译（未启用翻译时自动跳过）。
//
// 全程 fail-soft：上游目录只提供三语、拉取本身可能部分失败、补译可能没有
// 配置翻译模型——任何一环都不该让已经成功的渠道同步变成失败，因此这里的
// 错误只记录日志，实际写库由各自通道的「只补空白」语义保证收敛与幂等。
func syncLocalizedDescriptions(ctx context.Context, names []string) {
	if len(names) == 0 {
		return
	}
	if !descriptionSyncEnabled() {
		return
	}

	merged, err := fetchUpstreamLocalizedDescriptions(ctx, names)
	if err != nil {
		common.SysLog(fmt.Sprintf("localized description sync failed: %v", err))
		return
	}
	if len(merged) == 0 {
		return
	}

	filled, err := model.FillLocalizedDescriptions(merged)
	if err != nil {
		common.SysLog(fmt.Sprintf("persist localized descriptions failed: %v", err))
		return
	}
	if len(filled) > 0 {
		common.SysLog(fmt.Sprintf("localized descriptions filled from upstream: %d models", len(filled)))
		// 上游写入改变了 models 表，定价缓存里的描述需要在同一轮同步里生效。
		model.RefreshPricing()
	}

	// 补译只针对「英文已有、目标语种仍缺」的模型，避免为没有英文原文的
	// 模型凭空生成描述。
	translated, err := translateMissingDescriptions(ctx, names)
	if err != nil {
		common.SysLog(fmt.Sprintf("translate model descriptions failed: %v", err))
		return
	}
	if len(translated) == 0 {
		return
	}
	translatedFilled, err := model.MergeTranslatedDescriptions(translated)
	if err != nil {
		common.SysLog(fmt.Sprintf("persist translated descriptions failed: %v", err))
		return
	}
	if len(translatedFilled) > 0 {
		common.SysLog(fmt.Sprintf("localized descriptions translated: %d models", len(translatedFilled)))
		model.RefreshPricing()
	}
}

// fetchUpstreamLocalizedDescriptions 并发拉取上游各语种目录，按模型名合并
// 成 locale -> 描述。
//
// 单个语种失败不影响其它语种：上游三语目录是三个独立文件，偶发只有一个
// 挂掉时，仍应把拿到的那几语写进去，剩下的交给下一轮同步或补译。
func fetchUpstreamLocalizedDescriptions(ctx context.Context, names []string) (map[string]map[string]string, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	// 与 fetchMetadataCatalogContext 同量级的超时预算，覆盖并发三语拉取。
	ctx, cancel := context.WithTimeout(ctx, time.Duration(common.GetEnvOrDefault("SYNC_HTTP_TIMEOUT_SECONDS", 15))*time.Second)
	defer cancel()

	var (
		mu     sync.Mutex
		merged = make(map[string]map[string]string, len(names))
		errs   []string
		wg     sync.WaitGroup
	)

	for _, locale := range upstreamDescriptionLocales {
		wg.Add(1)
		go func(locale string) {
			defer wg.Done()
			_, catalog, _, err := fetchMetadataCatalogContext(ctx, locale)
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				errs = append(errs, fmt.Sprintf("%s: %v", locale, err))
				return
			}
			for name, values := range catalog {
				text := strings.TrimSpace(values.Description)
				if text == "" {
					continue
				}
				if _, ok := merged[name]; !ok {
					merged[name] = make(map[string]string, len(upstreamDescriptionLocales))
				}
				// 同名模型在三语目录里各出现一次；已占位的语种不覆盖，
				// 保证结果只取决于 upstreamDescriptionLocales 的顺序。
				if _, exists := merged[name][locale]; !exists {
					merged[name][locale] = text
				}
			}
		}(locale)
	}
	wg.Wait()

	// 只保留本轮真正关心的模型名，避免把整份上游目录写进内存再逐条查库。
	for name := range merged {
		if !containsModelName(names, name) {
			delete(merged, name)
		}
	}

	if len(merged) == 0 && len(errs) > 0 {
		return nil, fmt.Errorf("all upstream locales failed: %s", strings.Join(errs, "; "))
	}
	if len(errs) > 0 {
		common.SysLog(fmt.Sprintf("localized description partial fetch: %s", strings.Join(errs, "; ")))
	}
	return merged, nil
}

func containsModelName(names []string, target string) bool {
	for _, name := range names {
		if name == target {
			return true
		}
	}
	return false
}

// descriptionSyncEnabled 读取「上游同步后自动多语化描述」开关。
//
// 默认关闭：开启后每次渠道同步都会额外拉三份上游目录并（若配置了翻译
// 模型）调用 LLM 补译，这会产生真实的外部请求与额度消耗，必须由管理员
// 显式确认后才生效。
func descriptionSyncEnabled() bool {
	return strings.EqualFold(strings.TrimSpace(common.OptionMap[descriptionSyncOptionKey]), "true")
}

const (
	descriptionSyncOptionKey    = "ModelDescriptionSyncEnabled"
	translationEnabledOptionKey = "ModelDescriptionTranslateEnabled"
	translationBaseURLOptionKey = "ModelDescriptionTranslateBaseURL"
	translationAPIKeyOptionKey  = "ModelDescriptionTranslateApiKey"
	translationModelOptionKey   = "ModelDescriptionTranslateModel"
	translationLocalesOptionKey = "ModelDescriptionTranslateLocales"
	translationTimeoutOptionKey = "ModelDescriptionTranslateTimeoutSeconds"
)

// loadMissingTranslations 找出「英文已有、目标语种缺失」的模型及其英文原文，
// 供补译通道使用。
func loadMissingTranslations(names []string, locales []string) ([]string, map[string]string, error) {
	if len(names) == 0 || len(locales) == 0 {
		return nil, nil, nil
	}
	var records []model.Model
	if err := model.DB.
		Select("model_name", "description", "descriptions").
		Where("model_name IN ?", names).
		Find(&records).Error; err != nil {
		return nil, nil, err
	}
	need := make([]string, 0, len(records))
	sources := make(map[string]string, len(records))
	for _, record := range records {
		english := strings.TrimSpace(record.Descriptions["en"])
		if english == "" {
			english = strings.TrimSpace(record.Description)
		}
		if english == "" {
			// 没有英文原文就没有可靠的翻译源，跳过而不是让模型自由发挥。
			continue
		}
		if !hasMissingLocale(record.Descriptions, locales) {
			continue
		}
		need = append(need, record.ModelName)
		sources[record.ModelName] = english
	}
	return need, sources, nil
}

func hasMissingLocale(descriptions model.LocalizedDescription, locales []string) bool {
	for _, locale := range locales {
		if strings.TrimSpace(descriptions[locale]) == "" {
			return true
		}
	}
	return false
}
