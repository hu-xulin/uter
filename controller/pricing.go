package controller

import (
	"github.com/uter-ai/uter/i18n"
	"maps"

	"github.com/uter-ai/uter/common"

	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
	"github.com/uter-ai/uter/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

func filterPricingByUsableGroups(pricing []model.Pricing, usableGroup map[string]string) []model.Pricing {
	if len(pricing) == 0 {
		return pricing
	}
	if len(usableGroup) == 0 {
		return []model.Pricing{}
	}

	filtered := make([]model.Pricing, 0, len(pricing))
	for _, item := range pricing {
		if common.StringsContains(item.EnableGroup, "all") {
			filtered = append(filtered, item)
			continue
		}
		for _, group := range item.EnableGroup {
			if _, ok := usableGroup[group]; ok {
				filtered = append(filtered, item)
				break
			}
		}
	}
	return filtered
}

func GetPricing(c *gin.Context) {
	pricing := model.GetPricing()
	userId, exists := c.Get("id")
	usableGroup := map[string]string{}
	groupRatio := map[string]float64{}
	maps.Copy(groupRatio, ratio_setting.GetGroupRatioCopy())
	var group string
	if exists {
		user, err := model.GetUserCache(userId.(int))
		if err == nil {
			group = user.Group
			for g := range groupRatio {
				ratio, ok := ratio_setting.GetGroupGroupRatio(group, g)
				if ok {
					groupRatio[g] = ratio
				}
			}
		}
	}

	usableGroup = service.GetUserUsableGroups(group)
	pricing = filterPricingByUsableGroups(pricing, usableGroup)
	// 按访客语言解析多语描述。放在过滤之后，只对真正要返回的条目做解析。
	pricing = localizePricingDescriptions(pricing, i18n.StatedLang(c))
	// check groupRatio contains usableGroup
	for group := range ratio_setting.GetGroupRatioCopy() {
		if _, ok := usableGroup[group]; !ok {
			delete(groupRatio, group)
		}
	}

	// Plaza pricing source: which reference price the model plaza shows.
	// "official" / "models.dev" -> the preset's reference price (官方价格);
	// "channel" -> the platform's own price (平台价格 / 价格).
	pricingSource := normalizePricingSource(common.OptionMap["PricingSource"])
	officialPrices := resolveOfficialPrices(pricingSource)

	c.JSON(200, gin.H{
		"success":            true,
		"data":               pricing,
		"vendors":            model.GetVendors(),
		"group_ratio":        groupRatio,
		"usable_group":       usableGroup,
		"supported_endpoint": model.GetSupportedEndpointMap(),
		"auto_groups":        service.GetUserAutoGroup(group),
		"pricing_source":     pricingSource,
		"official_prices":    officialPrices,
		"pricing_version":    "a42d372ccf0b5dd13ecf71203521f9d2",
	})
}

// localizePricingDescriptions 按访客语言把模型描述解析成单值。
//
// 前端拿到的是「已解析好的 Description」+「全语种副本」：只关心一种语言的
// 调用方继续读 Description 即可，切换语言时前端可用副本在本地重绘，不必
// 为每种语言重新请求定价接口。
//
// 解析不到目标语种时保持 model 层填好的单值描述（通常就是英文），而不是
// 置空——回退到英文远好过卡片描述突然变空。
func localizePricingDescriptions(pricing []model.Pricing, lang string) []model.Pricing {
	if len(pricing) == 0 || lang == "" {
		return pricing
	}
	hasMultiLang := false
	for i := range pricing {
		if len(pricing[i].Descriptions) > 0 {
			hasMultiLang = true
			break
		}
	}
	if !hasMultiLang {
		return pricing
	}
	localized := make([]model.Pricing, len(pricing))
	copy(localized, pricing)
	for i := range localized {
		// 用 model 层的解析函数：多语副本按访客语言取，取不到时回落到单字段
		// description，保证「只有旧数据、没有多语副本」的模型不会显示空白。
		if text := model.ResolveModelDescription(
			model.LocalizedDescription(localized[i].Descriptions), localized[i].Description, lang,
		); text != "" {
			localized[i].Description = text
		}
	}
	return localized
}

// normalizePricingSource constrains the persisted `PricingSource` option to a
// known value. models.dev is the primary reference source: an empty, missing or
// corrupt setting degrades to it so the plaza always renders a usable price.
//
// "official" (the basellm preset) and "channel" remain valid *explicit*
// selections. An operator who deliberately picked them keeps that choice; the
// migration only changes what a fresh or unset installation defaults to.
func normalizePricingSource(raw string) string {
	switch raw {
	case "official", "models.dev", "channel":
		return raw
	default:
		return "models.dev"
	}
}

// resolveOfficialPrices builds the per-model reference price map the plaza uses
// for the strike-through official price and the discount badge.
//
// Priority (models.dev is the primary reference source):
//  1. The selected preset. models.dev is authoritative unless an operator
//     explicitly selects the basellm "official" preset. Making the catalogue
//     source win matters: the channel-sync reference used to be applied first
//     and silently overrode the chosen source for every model the channel
//     carries, which made the pricing-source setting inert in practice.
//  2. The upstream reference captured by the last channel sync (创梦 /
//     DreamRouter). It now only fills genuine gaps — private or newly released
//     names no public catalogue knows — so those cards still get a
//     strike-through price and a discount badge.
//  3. The sibling preset, because their model coverage is complementary (e.g.
//     the official preset lacks many Alibaba/Qwen entries that models.dev has).
//
// getPresetModelRatiosNonBlocking hands out a private copy of the cached preset,
// so the gap fill below mutates only that copy. Mutating the shared cache would
// permanently graft the fallback preset's entries into the cached primary
// preset, corrupt the admin preset editor (which serves the same cache) and make
// the two presets converge, silently rendering the pricing-source choice inert.
func resolveOfficialPrices(pricingSource string) map[string]map[string]float64 {
	pricingSource = normalizePricingSource(pricingSource)
	referencePresetID := modelsDevPresetID
	fallbackPresetID := officialRatioPresetID
	if pricingSource == "official" {
		referencePresetID, fallbackPresetID = officialRatioPresetID, modelsDevPresetID
	}
	return mergeOfficialPriceSources(
		getPresetModelRatiosNonBlocking(referencePresetID),
		service.LoadDreamRouterOfficialReference(),
		getPresetModelRatiosNonBlocking(fallbackPresetID),
	)
}

// mergeOfficialPriceSources applies the primary/fallback priority without
// mutating any input map. It is kept separate from resolveOfficialPrices so the
// "catalogue wins over channel" rule can be tested without a live snapshot.
func mergeOfficialPriceSources(catalogue, channel, fallback map[string]map[string]float64) map[string]map[string]float64 {
	merged := make(map[string]map[string]float64, len(catalogue)+len(channel)+len(fallback))
	for modelName, ratios := range catalogue {
		merged[modelName] = ratios
	}
	for modelName, ratios := range channel {
		if _, ok := merged[modelName]; !ok {
			merged[modelName] = ratios
		}
	}
	for modelName, ratios := range fallback {
		if _, ok := merged[modelName]; !ok {
			merged[modelName] = ratios
		}
	}
	return merged
}

func ResetModelRatio(c *gin.Context) {
	defaultStr := ratio_setting.DefaultModelRatio2JSONString()
	err := model.UpdateOption("ModelRatio", defaultStr)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	err = ratio_setting.UpdateModelRatioByJSONString(defaultStr)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(200, gin.H{
		"success": true,
		"message": i18n.T(c, i18n.MsgPricingReset_ratio_success),
	})
}
