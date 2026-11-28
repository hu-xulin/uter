package service

import "strings"

// bailianTaskPluginModels mirrors plugins/tasks/alibaba/plugin.js meta.models.
// The plugin declares protocol capabilities, not prices, but Uter must know
// which catalog rows are task-billable so the aggregate pricing page does not
// silently erase their per-second/per-image catalog quotes.
//
// Keep this list in sync with the plugin. A repository test compares both
// lists so a plugin model addition cannot silently lose its price path.
var bailianTaskPluginModels = map[string]bool{
	"wan3.0-video":                    true,
	"wan3.0-video-prime":              true,
	"wan2.7-t2v":                      true,
	"wan2.7-t2v-2026-04-25":           true,
	"wan2.7-t2v-2026-06-12":           true,
	"wan2.7-i2v":                      true,
	"wan2.7-i2v-2026-04-25":           true,
	"wan2.6-t2v":                      true,
	"wan2.6-t2v-us":                   true,
	"wan2.6-i2v":                      true,
	"wan2.6-i2v-flash":                true,
	"wan2.6-i2v-us":                   true,
	"wan2.5-t2v-preview":              true,
	"wan2.5-i2v-preview":              true,
	"wan2.2-t2v-plus":                 true,
	"wan2.2-i2v-flash":                true,
	"wan2.2-i2v-plus":                 true,
	"wan2.2-kf2v-flash":               true,
	"wan2.2-s2v":                      true,
	"wanx2.1-t2v-plus":                true,
	"wanx2.1-t2v-turbo":               true,
	"wanx2.1-i2v-plus":                true,
	"wanx2.1-i2v-turbo":               true,
	"happyhorse-1.0-t2v":              true,
	"happyhorse-1.0-i2v":              true,
	"happyhorse-1.0-r2v":              true,
	"happyhorse-1.0-video-edit":       true,
	"happyhorse-1.1-t2v":              true,
	"happyhorse-1.1-i2v":              true,
	"happyhorse-1.1-r2v":              true,
	"wan2.7-image-pro":                true,
	"wan2.7-image":                    true,
	"wan2.6-image":                    true,
	"wan2.6-t2i":                      true,
	"wan2.5-t2i-preview":              true,
	"wan2.2-t2i-flash":                true,
	"wan2.2-t2i-plus":                 true,
	"wanx2.1-t2i-turbo":               true,
	"wanx2.1-t2i-plus":                true,
	"wanx2.0-t2i-turbo":               true,
	"wan2.5-i2i-preview":              true,
	"wanx2.1-imageedit":               true,
	"qwen-image":                      true,
	"qwen-image-plus":                 true,
	"qwen-image-max":                  true,
	"qwen-image-2.0":                  true,
	"qwen-image-2.0-pro":              true,
	"qwen-image-3.0":                  true,
	"qwen-image-3.0-pro":              true,
	"qwen-image-edit":                 true,
	"qwen-image-edit-plus":            true,
	"qwen-image-edit-max":             true,
	"z-image-turbo":                   true,
	"qwen-image-plus-2026-01-09":      true,
	"qwen-image-max-2025-12-30":       true,
	"qwen-image-2.0-2026-03-03":       true,
	"qwen-image-2.0-pro-2026-03-03":   true,
	"qwen-image-2.0-pro-2026-04-22":   true,
	"qwen-image-2.0-pro-2026-06-22":   true,
	"qwen-image-edit-plus-2025-10-30": true,
	"qwen-image-edit-plus-2025-12-15": true,
	"qwen-image-edit-max-2026-01-16":  true,
}

// bailianTaskPriceAliases maps a plugin model that the catalog does not list
// to the same-price catalog entry it is documented as a variant of. Only
// already-verified variant relationships are listed; an unknown model stays
// review-only instead of inheriting an unrelated price.
var bailianTaskPriceAliases = map[string]string{
	"wan2.7-t2v-2026-04-25":           "wan2.7-t2v",
	"wan2.7-t2v-2026-06-12":           "wan2.7-t2v",
	"wan2.7-i2v-2026-04-25":           "wan2.7-i2v",
	"wan2.6-t2v-us":                   "wan2.6-t2v",
	"wan2.6-i2v-us":                   "wan2.6-i2v",
	"qwen-image-plus-2026-01-09":      "qwen-image-plus",
	"qwen-image-max-2025-12-30":       "qwen-image-max",
	"qwen-image-2.0-2026-03-03":       "qwen-image-2.0",
	"qwen-image-2.0-pro-2026-03-03":   "qwen-image-2.0-pro",
	"qwen-image-2.0-pro-2026-04-22":   "qwen-image-2.0-pro",
	"qwen-image-2.0-pro-2026-06-22":   "qwen-image-2.0-pro",
	"qwen-image-edit-plus-2025-10-30": "qwen-image-edit-plus",
	"qwen-image-edit-plus-2025-12-15": "qwen-image-edit-plus",
	"qwen-image-edit-max-2026-01-16":  "qwen-image-edit-max",
}

func isBailianTaskPluginModel(name string) bool {
	return bailianTaskPluginModels[strings.ToLower(strings.TrimSpace(name))]
}

// augmentBailianCatalogWithTaskPluginModels adds price-bearing catalog entries
// for plugin models that are selectable but absent from the catalog response.
// It never invents a price and never replaces an existing catalog entry.
func augmentBailianCatalogWithTaskPluginModels(catalog *BailianCatalog) {
	if catalog == nil {
		return
	}
	byName := make(map[string]BailianModel, len(catalog.Models))
	for _, item := range catalog.Models {
		name := strings.TrimSpace(item.Model)
		if name != "" {
			byName[name] = item
		}
	}
	for model, sourceName := range bailianTaskPriceAliases {
		if _, exists := byName[model]; exists {
			continue
		}
		source, ok := byName[sourceName]
		if !ok || len(source.Prices) == 0 {
			continue
		}
		item := source
		item.Model = model
		item.ModelAlias = sourceName
		catalog.Models = append(catalog.Models, item)
		byName[model] = item
	}
}
