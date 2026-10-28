package controller

import (
	"context"
	"fmt"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
)

// upstreamDescriptionLocales 是上游官方目录实际提供的语种。
//
// 上游 llm-metadata 只维护 zh/en/ja 三份 models.json，其余语种必须由站内
// LLM 补译（见 model_desc_translate.go）。这里按「上游有的优先拉」的原则
// 固定顺序，前端 7 语里剩下的 4 语再走翻译补齐。
var upstreamDescriptionLocales = []string{"en", "zh", "ja"}

// syncLocalizedDescriptions 在上游目录同步之后，把每个模型的多语描述补齐。
//
// 分三步：
//  0. 单语存量回填：把只有 description 的模型按检测出的语种写进对应语种位；
//  1. 按 upstreamDescriptionLocales 各拉一次目录，合并成 locale -> 描述；
//  2. 缺失的语种交给 LLM 从源语种补译（未启用翻译时自动跳过）。
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

	// 0) 单语存量回填。这一步不能省：渠道自建的模型（上游公开目录里没有）
	//    只有中文 description，没有任何多语副本。缺了它，补译写进去的只有
	//    en/fr/… 而没有 zh，中文界面按回退链拿到的是**英文译文**——表现为
	//    「中文界面下卡片描述变成英文」。
	if seeded, err := model.SeedLocalizedDescriptionsFromLegacy(); err != nil {
		common.SysLog(fmt.Sprintf("seed localized descriptions failed: %v", err))
	} else if len(seeded) > 0 {
		common.SysLog(fmt.Sprintf("localized descriptions seeded from single field: %d models", len(seeded)))
		model.RefreshPricing()
	}

	// 1) 上游公开目录（只覆盖公开模型）。拉取失败或没有命中都不能直接返回：
	//    没有命中的模型照样要补译，否则它们会永远停在单语状态——这正是
	//    「有些卡片里的描述没做多语言」的直接原因。
	merged, err := fetchUpstreamLocalizedDescriptions(ctx, names)
	if err != nil {
		common.SysLog(fmt.Sprintf("localized description sync failed: %v", err))
	} else if len(merged) > 0 {
		filled, err := model.FillLocalizedDescriptions(merged)
		if err != nil {
			common.SysLog(fmt.Sprintf("persist localized descriptions failed: %v", err))
		} else if len(filled) > 0 {
			common.SysLog(fmt.Sprintf("localized descriptions filled from upstream: %d models", len(filled)))
			// 上游写入改变了 models 表，定价缓存里的描述需要在同一轮同步里生效。
			model.RefreshPricing()
		}
	}

	// 2) 补译只针对「源语种已有、目标语种仍缺」的模型，避免为没有源文的
	//    模型凭空生成描述。
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

// loadMissingTranslations 找出「已有源语言原文、目标语种缺失」的模型，返回
// 待译模型名、源文，以及**每个模型真正缺的语种**。
//
// 逐模型给出缺失语种（而不是统一用全局列表）有两个原因：
//   - 上游目录已提供 zh/ja 的模型不需要再让 LLM 翻一遍；
//   - 单语存量回填后，某些模型可能已经有 zh 但缺 en，按全局列表会把 zh
//     重译一遍并覆盖掉原文（写库虽然只补空白，但白白消耗额度与时间）。
//
// 例外是 **en 位为空**：它不只是一个语种，还是前端回退链的兜底档与其它
// 语种的翻译源，缺它必须补（详见下方注释）。
func loadMissingTranslations(names []string, locales []string) (need []string, sources map[string]string, targets map[string][]string, err error) {
	if len(names) == 0 || len(locales) == 0 {
		return nil, nil, nil, nil
	}
	var records []model.Model
	if err := model.DB.
		Select("model_name", "description", "descriptions").
		Where("model_name IN ?", names).
		Find(&records).Error; err != nil {
		return nil, nil, nil, err
	}
	need = make([]string, 0, len(records))
	sources = make(map[string]string, len(records))
	targets = make(map[string][]string, len(records))
	for _, record := range records {
		// 源文优先取英文位；英文缺席时退回单字段（可能是中文等其它语种），
		// 由翻译模型自行识别源语言。
		source := strings.TrimSpace(record.Descriptions["en"])
		if source == "" {
			source = strings.TrimSpace(record.Description)
		}
		if source == "" {
			// 没有源文就没有可靠的翻译源，跳过而不是让模型自由发挥。
			continue
		}
		missing := missingLocales(record.Descriptions, locales)
		// 英文位缺席时，英文本身也是**待补语种**，必须一起补。
		//
		// descriptionTranslateLocales 不包含 en，前提是「源文即英文」；但渠道
		// 自建模型的源文常常只有中文（单语存量回填会把中文写进 descriptions["zh"]，
		// 而不是 en）。此时若只补 zh/zh-TW/fr/ja/ru/vi，en 位永远为空，前端回退链
		// （当前语种 → 基础语种 → en → 字典序第一个）在英文界面会落到 zh，
		// 表现为「英文界面显示中文描述」——正是「描述没多语言」的另一半根因。
		if strings.TrimSpace(record.Descriptions["en"]) == "" && !slices.Contains(missing, "en") {
			missing = append([]string{"en"}, missing...)
		}
		if len(missing) == 0 {
			continue
		}
		need = append(need, record.ModelName)
		sources[record.ModelName] = source
		targets[record.ModelName] = missing
	}
	return need, sources, targets, nil
}

// missingLocales 返回 locales 中该模型仍为空的语种，保持入参顺序。
func missingLocales(descriptions model.LocalizedDescription, locales []string) []string {
	missing := make([]string, 0, len(locales))
	for _, locale := range locales {
		if strings.TrimSpace(descriptions[locale]) == "" {
			missing = append(missing, locale)
		}
	}
	return missing
}

// init 注册「价格同步后置钩子」。
//
// service 层在价格落库后只负责「钱」，卡片上的元数据与多语描述属于 controller
// 层；为避免 service 反向依赖 controller，钩子在这里注册。此前这个钩子**从未
// 注册**，于是 runPricingPostSyncHook 每次都是空转——渠道同步后既不会补模型
// 元数据，也不会补描述多语言，卡片描述长期停留在单语。
func init() {
	service.SetPricingPostSyncHook(func(ctx context.Context, models []service.SyncedModelMeta) {
		names := make([]string, 0, len(models))
		vendorByModel := make(map[string]string, len(models))
		for _, item := range models {
			names = append(names, item.Name)
			if item.VendorName != "" {
				vendorByModel[item.Name] = item.VendorName
			}
		}
		if _, err := autoFillOfficialMetadata(ctx, names); err != nil {
			common.SysLog(fmt.Sprintf("post-sync metadata fill failed: %v", err))
		}
		// 官方目录不认识的模型（如渠道私有命名的 seedance-*）在上一步会被
		// 跳过，于是永远没有元数据行 → 定价页拿不到 vendor，按供应商筛选时
		// 整条模型「消失」。这里用上游 vendors[] 给出的供应商名补一行。
		if created, err := model.EnsureModelRows(vendorByModel); err != nil {
			common.SysLog(fmt.Sprintf("post-sync metadata row ensure failed: %v", err))
		} else if len(created) > 0 {
			common.SysLog(fmt.Sprintf("post-sync created %d metadata rows from upstream vendors: %v", len(created), created))
		}
		syncLocalizedDescriptions(ctx, names)
	})
}
