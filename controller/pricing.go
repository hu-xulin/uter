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
// known value, degrading to the official preset for an empty or corrupt setting
// so the plaza always renders a usable reference price.
func normalizePricingSource(raw string) string {
	switch raw {
	case "official", "models.dev", "channel":
		return raw
	default:
		return "official"
	}
}

// resolveOfficialPrices builds the per-model reference price map the plaza uses
// for the strike-through official price and the discount badge.
//
// Priority:
//  1. The upstream reference captured by the last channel sync (创梦 /
//     DreamRouter). It is the channel's own catalogue price, so it covers every
//     model the channel sells — including private and newly released names that
//     no public preset knows. Without it those cards render no strike-through
//     price and no discount badge at all ("some discounts never show up").
//  2. The selected preset, which is the reference for models the channel does
//     not carry.
//  3. The sibling preset, because their model coverage is complementary (e.g.
//     the official preset lacks many Alibaba/Qwen entries that models.dev has).
//
// getPresetModelRatiosNonBlocking hands out a private copy of the cached preset,
// so the gap fill below mutates only that copy. Mutating the shared cache would
// permanently graft the fallback preset's entries into the cached primary
// preset, corrupt the admin preset editor (which serves the same cache) and make
// the two presets converge, silently rendering the pricing-source choice inert.
func resolveOfficialPrices(pricingSource string) map[string]map[string]float64 {
	referencePresetID := officialRatioPresetID
	if pricingSource == "models.dev" {
		referencePresetID = modelsDevPresetID
	}
	// When the source is the platform channel, the canonical official preset
	// (-100) is the reference for the discount comparison.
	fallbackPresetID := modelsDevPresetID
	if referencePresetID == modelsDevPresetID {
		fallbackPresetID = officialRatioPresetID
	}
	merged := map[string]map[string]float64{}
	for modelName, ratios := range service.LoadDreamRouterOfficialReference() {
		merged[modelName] = ratios
	}
	for modelName, ratios := range getPresetModelRatiosNonBlocking(referencePresetID) {
		if _, ok := merged[modelName]; !ok {
			merged[modelName] = ratios
		}
	}
	for modelName, ratios := range getPresetModelRatiosNonBlocking(fallbackPresetID) {
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
