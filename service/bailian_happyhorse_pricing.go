package service

import (
	"strings"
)

// happyhorseOfficialRateSource is the Alibaba Cloud Model Studio model-info
// page that publishes HappyHorse 1.1 per-second list prices. These rates are
// published per model-family entry (t2v/i2v/r2v share one rate); the page is
// the operator-authorized price source, mirrored here because the aggregate
// model-pricing page does not carry per-second video prices.
const happyhorseOfficialRateSource = "https://www.alibabacloud.com/help/zh/doc-detail/3044679.html"

// happyhorseVideoUSDPerSecond holds verified HappyHorse 1.1 rates for the
// Beijing region, in USD per generated second, keyed by resolution. Only
// models whose official rate URL was verified are injected; other HappyHorse
// variants stay review-only rather than guessing a price.
var happyhorseVideoUSDPerSecond = map[BailianRegion]map[string]string{
	BailianRegionBeijing: {
		"480P":  "0.0618845",
		"720P":  "0.123769",
		"1080P": "0.165026",
	},
	// International/global regions publish the same USD rates for Germany,
	// US and Japan, and a distinct set for Singapore.
	BailianRegionGermany:   {"480P": "0.0618845", "720P": "0.123769", "1080P": "0.165026"},
	BailianRegionUS:        {"480P": "0.0618845", "720P": "0.123769", "1080P": "0.165026"},
	BailianRegionJapan:     {"480P": "0.0618845", "720P": "0.123769", "1080P": "0.165026"},
	BailianRegionSingapore: {"480P": "0.07", "720P": "0.14", "1080P": "0.18"},
}

// happyhorsePricedModels are the HappyHorse variants whose official per-second
// rate is verified. 1.0 variants and video-edit are intentionally excluded:
// their rates are not published on the verified page, so they stay review-only.
var happyhorsePricedModels = map[string]bool{
	"happyhorse-1.1-t2v": true,
	"happyhorse-1.1-i2v": true,
	"happyhorse-1.1-r2v": true,
}

// applyHappyhorseOfficialPricing injects verified per-second rates for
// HappyHorse models that the aggregate pricing page omits. It only fills
// models with no published price; it never overwrites a catalog quote or a
// manually configured price. Prices carry an explicit USD currency and a
// traceable Source so the normal pricing pipeline treats them as official
// list prices without currency inference.
func applyHappyhorseOfficialPricing(catalog *BailianCatalog) {
	if catalog == nil {
		return
	}
	rates, ok := happyhorseVideoUSDPerSecond[catalog.Region]
	if !ok || len(rates) == 0 {
		return
	}
	for index := range catalog.Models {
		item := &catalog.Models[index]
		if !happyhorsePricedModels[strings.ToLower(strings.TrimSpace(item.Model))] {
			continue
		}
		if len(item.Prices) > 0 {
			// Never overwrite a price already published by the catalog or the
			// aggregate official page.
			continue
		}
		prices := make([]BailianPrice, 0, 3)
		for _, tier := range []struct {
			resolution string
			priceType  string
		}{
			{"480P", "video_ratio_480p"},
			{"720P", "video_ratio_720p"},
			{"1080P", "video_ratio_1080p"},
		} {
			rate, ok := rates[tier.resolution]
			if !ok {
				continue
			}
			prices = append(prices, BailianPrice{
				Type:      tier.priceType,
				Price:     rate,
				PriceUnit: "每秒",
				PriceName: "video generation " + tier.resolution,
				Currency:  "USD",
				Source:    happyhorseOfficialRateSource,
			})
		}
		if len(prices) > 0 {
			item.Prices = []BailianPriceRange{{RangeName: "Default", Prices: prices}}
		}
	}
}
