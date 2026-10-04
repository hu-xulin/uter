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
	pricingSource := common.OptionMap["PricingSource"]
	if pricingSource != "official" && pricingSource != "models.dev" &&
		pricingSource != "channel" {
		pricingSource = "official"
	}
	referencePresetID := officialRatioPresetID
	if pricingSource == "models.dev" {
		referencePresetID = modelsDevPresetID
	}
	// When the source is a preset, that preset doubles as the official
	// reference for the discount comparison. When the source is the platform
	// channel, the canonical official preset (-100) is the reference.
	officialPrices := GetPresetModelRatios(referencePresetID)
	// The two built-in presets have complementary model coverage (e.g. the
	// basellm official preset lacks many Alibaba/Qwen entries that models.dev
	// has). Fill the gaps from the other preset so every model with a known
	// upstream list price keeps an official reference; otherwise the plaza
	// would fall back to the platform's own (possibly discounted) prices and
	// show the discount as the "official" price.
	fallbackPresetID := modelsDevPresetID
	if referencePresetID == modelsDevPresetID {
		fallbackPresetID = officialRatioPresetID
	}
	for modelName, ratios := range GetPresetModelRatios(fallbackPresetID) {
		if _, ok := officialPrices[modelName]; !ok {
			officialPrices[modelName] = ratios
		}
	}

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
