package model

import (
	"fmt"
	"sort"
	"strings"

	"github.com/Uter-AI/Uter/common"
	"github.com/Uter-AI/Uter/setting/billing_setting"
	"gorm.io/gorm"
)

// AutoFillPricingResult reports what an automatic official-price fill changed.
type AutoFillPricingResult struct {
	// Considered is the number of channel models examined.
	Considered int `json:"considered"`
	// FilledModels are the models that had no saved price and now have the
	// official reference price.
	FilledModels []string `json:"filled_models"`
	// SkippedOptOut counts models excluded via `sync_official = 0`.
	SkippedOptOut int `json:"skipped_opt_out"`
	// SkippedPriced counts models that already had a saved price.
	SkippedPriced int `json:"skipped_priced"`
	// SkippedUpstream counts models the official preset does not price.
	SkippedUpstream int `json:"skipped_upstream"`
}

// presetFieldToOptionKey maps the official preset's ratio field names onto the
// option keys the pricing engine persists. Presets speak the relay's snake_case
// vocabulary; storage uses the option names. Fields absent here (billing mode
// and expressions) are deliberately not importable: an expression must arrive
// with its mode, and the presets already encode expression pricing into ratio
// space via mergeExprDerivedRatios.
var presetFieldToOptionKey = map[string]string{
	"model_ratio":            "ModelRatio",
	"completion_ratio":       "CompletionRatio",
	"cache_ratio":            "CacheRatio",
	"create_cache_ratio":     "CreateCacheRatio",
	"image_ratio":            "ImageRatio",
	"audio_ratio":            "AudioRatio",
	"audio_completion_ratio": "AudioCompletionRatio",
	"model_price":            "ModelPrice",
}

// Pricing option keys for the billing mode and expression. The billing_setting
// package's own BillingModeField/BillingExprField constants are the bare field
// names used inside ratio maps; the pricing engine persists the fully
// qualified DB keys, which are what a PricingValues draft is keyed by.
const (
	pricingBillingModeKey = "billing_setting.billing_mode"
	pricingBillingExprKey = "billing_setting.billing_expr"
)

// modelPricingConfigured reports whether a model already carries a price an
// administrator saved, mirroring the admin table's classifyModelPricing: a
// per-call ModelPrice, a ModelRatio, a tiered expression, or a plugin
// expression all count as priced. A model that merely inherits an engine
// default is still unpriced, because that is the state an operator needs to see
// and fix.
func modelPricingConfigured(configured, effective PricingValues) bool {
	if mode, _ := effective[pricingBillingModeKey].(string); mode == billing_setting.BillingModeTieredExpr {
		if expression, ok := effective[pricingBillingExprKey].(string); ok && strings.TrimSpace(expression) != "" {
			return true
		}
	}
	if variants, ok := effective[billing_setting.PluginBillingExprOption].(map[string]any); ok {
		for _, expression := range variants {
			if text, isString := expression.(string); isString && strings.TrimSpace(text) != "" {
				return true
			}
		}
	}
	if _, ok := configured["ModelPrice"]; ok {
		return true
	}
	if _, ok := configured["ModelRatio"]; ok {
		return true
	}
	// A model the engine would still bill per call without a saved ratio is
	// genuinely expression-priced.
	if _, ok := effective["ModelPrice"]; ok {
		return true
	}
	return false
}

// pricingValuesFromPreset converts one model's official preset ratios into a
// storable pricing draft. A per-call price wins outright, matching the relay's
// own precedence, so a preset that quotes both does not leave a contradictory
// ratio behind. Returns nil when the preset carries no usable number.
func pricingValuesFromPreset(ratios map[string]float64) PricingValues {
	if _, isPerCall := ratios["model_price"]; isPerCall {
		return PricingValues{"ModelPrice": ratios["model_price"]}
	}
	draft := make(PricingValues, len(presetFieldToOptionKey))
	for field, value := range ratios {
		key, importable := presetFieldToOptionKey[field]
		if !importable {
			continue
		}
		if value < 0 {
			// A negative ratio is not a price; treat the field as absent.
			continue
		}
		draft[key] = value
	}
	if len(draft) == 0 {
		return nil
	}
	return draft
}

// AutoFillOfficialPricing gives every considered model that has no saved price
// the official reference price for that model.
//
// The fill runs inside a single mutateModelPricingOptions transaction, the same
// serialized path the admin editor uses, so the option maps are read, changed
// and published once and a concurrent administrator save cannot interleave
// between the decision and the write.
//
// Models are skipped when they already have a saved price, when the preset does
// not price them, or when `sync_official = 0` marks them as excluded from
// official data.
func AutoFillOfficialPricing(
	names []string,
	preset map[string]map[string]float64,
) (*AutoFillPricingResult, error) {
	result := &AutoFillPricingResult{Considered: len(names), FilledModels: []string{}}
	if len(names) == 0 || len(preset) == 0 {
		return result, nil
	}
	optOut, err := pricingOptOutModelNames(DB)
	if err != nil {
		return nil, err
	}
	// Deterministic order keeps the transaction and the log stable.
	ordered := make([]string, 0, len(names))
	seen := make(map[string]bool, len(names))
	for _, name := range names {
		name = strings.TrimSpace(name)
		if name == "" || seen[name] {
			continue
		}
		seen[name] = true
		ordered = append(ordered, name)
	}
	sort.Strings(ordered)

	writeErr := mutateModelPricingOptions(func(_ *gorm.DB, values map[string]map[string]any) error {
		for _, name := range ordered {
			if optOut[name] {
				result.SkippedOptOut++
				continue
			}
			configured := modelPricingValues(values, name)
			if modelPricingConfigured(configured, effectiveModelPricing(values, name)) {
				result.SkippedPriced++
				continue
			}
			ratios, known := preset[name]
			if !known {
				result.SkippedUpstream++
				continue
			}
			draft := pricingValuesFromPreset(ratios)
			if draft == nil {
				result.SkippedUpstream++
				continue
			}
			if err := validateModelPricing(name, draft, configured); err != nil {
				// One malformed upstream entry must not stop the rest of the
				// fill; the model simply stays unpriced and is reported.
				common.SysLog(fmt.Sprintf("auto fill pricing skipped model=%s err=%v", name, err))
				result.SkippedUpstream++
				continue
			}
			replaceModelPricing(values, name, draft)
			result.FilledModels = append(result.FilledModels, name)
		}
		return nil
	})
	if writeErr != nil {
		return result, writeErr
	}
	return result, nil
}

// pricingOptOutModelNames returns the models an administrator has excluded from
// official data. A model without a metadata row is not opted out: the fill is
// allowed to price a model whose metadata is still missing.
func pricingOptOutModelNames(db *gorm.DB) (map[string]bool, error) {
	var rows []struct {
		ModelName    string
		SyncOfficial int
	}
	if err := db.Model(&Model{}).
		Select("model_name", "sync_official").
		Where("sync_official = ?", 0).
		Find(&rows).Error; err != nil {
		return nil, err
	}
	result := make(map[string]bool, len(rows))
	for _, row := range rows {
		result[row.ModelName] = true
	}
	return result, nil
}
