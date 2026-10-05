package controller

import (
	"github.com/Uter-AI/Uter/i18n"
	"maps"

	"github.com/Uter-AI/Uter/common"

	"github.com/Uter-AI/Uter/model"
	"github.com/Uter-AI/Uter/service"
	"github.com/Uter-AI/Uter/setting/ratio_setting"

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
// The selected source picks the primary preset; the remaining gaps are filled
// from the other preset because their model coverage is complementary (e.g. the
// official preset lacks many Alibaba/Qwen entries that models.dev has). Without
// that fill a model with a known upstream list price would have no reference at
// all and the plaza would fall back to the platform's own — possibly discounted
// — price and present it as the "official" one.
//
// GetPresetModelRatios hands out a private copy of the cached preset, so the
// gap fill below mutates only that copy. Mutating the shared cache would
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
	merged := GetPresetModelRatios(referencePresetID)
	for modelName, ratios := range GetPresetModelRatios(fallbackPresetID) {
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
