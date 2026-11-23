package service

import (
	"errors"
	"fmt"
	"math"
	"slices"
	"strings"
	"sync"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

const (
	BatchPricingBasisOfficial = "official"
	BatchPricingBasisChannel  = "channel"
	// BatchPricingBasisCurrent rebases on the channel's current sale price
	// (InternalPricing), not on any upstream quote.
	BatchPricingBasisCurrent = "current"

	BatchPricingModeDiscount = "discount" // value 0.6 -> base * 0.6
	BatchPricingModeMarkup   = "markup"   // value 0.1 -> base * (1 + 0.1)
	BatchPricingModeMultiply = "multiply" // value 0.8 -> base * 0.8
	BatchPricingModeAdd      = "add"      // value 0.5 -> base + 0.5
	BatchPricingModeFixed    = "fixed"    // value 2.5 -> 2.5
	BatchPricingModeNone     = "none"     // keep the base price

	BatchProtectionModeStrict   = "strict"   // any violation blocks the whole batch
	BatchProtectionModePartial  = "partial"  // skip the violating model, apply the rest
	BatchProtectionModeApproval = "approval" // apply with a recorded approval note
)

// BatchPricingItem is one previewed/written internal price.
type BatchPricingItem struct {
	ModelName                   string   `json:"model_name"`
	Provider                    string   `json:"provider,omitempty"`
	Region                      string   `json:"region,omitempty"`
	DeploymentId                string   `json:"deployment_id,omitempty"`
	Mode                        string   `json:"mode"`
	InputUSD                    *float64 `json:"input_per_million_usd,omitempty"`
	OutputUSD                   *float64 `json:"output_per_million_usd,omitempty"`
	AudioInputUSD               *float64 `json:"audio_input_per_million_usd,omitempty"`
	AudioOutputUSD              *float64 `json:"audio_output_per_million_usd,omitempty"`
	CacheUSD                    *float64 `json:"cache_per_million_usd,omitempty"`
	CacheWriteUSD               *float64 `json:"create_cache_per_million_usd,omitempty"`
	ImageInputUSD               *float64 `json:"image_input_per_million_usd,omitempty"`
	ThinkingInputUSD            *float64 `json:"thinking_input_per_million_usd,omitempty"`
	ThinkingOutputUSD           *float64 `json:"thinking_output_per_million_usd,omitempty"`
	ThinkingCacheUSD            *float64 `json:"thinking_cache_per_million_usd,omitempty"`
	ThinkingCreateCacheUSD      *float64 `json:"thinking_create_cache_per_million_usd,omitempty"`
	ThinkingImageInputUSD       *float64 `json:"thinking_image_input_per_million_usd,omitempty"`
	MultiInputOutputUSD         *float64 `json:"multi_input_output_per_million_usd,omitempty"`
	ThinkingMultiInputOutputUSD *float64 `json:"thinking_multi_input_output_per_million_usd,omitempty"`
	PerCallUSD                  *float64 `json:"per_call_usd,omitempty"`
	PerSecondUSD                *float64 `json:"per_second_usd,omitempty"`
	PerMinuteUSD                *float64 `json:"per_minute_usd,omitempty"`
	// Version is the price row version the preview calculated from. Send it
	// back with the apply request so a changed row cannot be mixed into the
	// confirmed result.
	Version string `json:"version,omitempty"`

	// Margin fields compare the new sale price with the upstream purchase
	// price and with the sale price before this rule. They use the model's
	// primary unit: input per 1M tokens, per call, or per second. Nil means
	// the comparison input is unavailable (for example no purchase price on a
	// provider that only publishes list prices).
	PurchaseUSD   *float64 `json:"purchase_usd,omitempty"`
	PreviousUSD   *float64 `json:"previous_usd,omitempty"`
	ChangePercent *float64 `json:"change_percent,omitempty"`
	MarginUSD     *float64 `json:"margin_usd,omitempty"`
	MarginRate    *float64 `json:"margin_rate,omitempty"`
	// DimensionMargins checks every priced dimension, not just the primary
	// one, so an input margin cannot hide a cache loss.
	DimensionMargins []BatchDimensionMargin `json:"dimension_margins,omitempty"`
	// MarginVerified is false when a sold dimension has no purchase price to
	// compare against; the UI must not present that as verified.
	MarginVerified bool `json:"margin_verified"`
	// CostVerified is true only when the comparison used an operator-confirmed
	// contract cost. A public upstream quote is an estimate and leaves it false.
	CostVerified    bool   `json:"cost_verified"`
	CostSource      string `json:"cost_source,omitempty"`
	ProtectionState string `json:"protection_state,omitempty"`
	// Tiers echoes the tiered sale prices this rule produced.
	Tiers []BatchPricingTier `json:"tiers,omitempty"`
}

// BatchPricingTier is one tiered sale-price preview row.
type BatchPricingTier struct {
	RangeName                   string   `json:"range_name"`
	TimeBand                    string   `json:"time_band,omitempty"`
	MinInputTokens              int64    `json:"min_input_tokens,omitempty"`
	MaxInputTokens              int64    `json:"max_input_tokens,omitempty"`
	InputUSD                    *float64 `json:"input_per_million_usd,omitempty"`
	OutputUSD                   *float64 `json:"output_per_million_usd,omitempty"`
	CacheUSD                    *float64 `json:"cache_per_million_usd,omitempty"`
	CacheWriteUSD               *float64 `json:"create_cache_per_million_usd,omitempty"`
	AudioInputUSD               *float64 `json:"audio_input_per_million_usd,omitempty"`
	AudioOutputUSD              *float64 `json:"audio_output_per_million_usd,omitempty"`
	ImageInputUSD               *float64 `json:"image_input_per_million_usd,omitempty"`
	ThinkingInputUSD            *float64 `json:"thinking_input_per_million_usd,omitempty"`
	ThinkingOutputUSD           *float64 `json:"thinking_output_per_million_usd,omitempty"`
	ThinkingCacheUSD            *float64 `json:"thinking_cache_per_million_usd,omitempty"`
	ThinkingCreateCacheUSD      *float64 `json:"thinking_create_cache_per_million_usd,omitempty"`
	ThinkingImageInputUSD       *float64 `json:"thinking_image_input_per_million_usd,omitempty"`
	MultiInputOutputUSD         *float64 `json:"multi_input_output_per_million_usd,omitempty"`
	ThinkingMultiInputOutputUSD *float64 `json:"thinking_multi_input_output_per_million_usd,omitempty"`
	Unit                        string   `json:"unit"`
}

// BatchDimensionMargin is the cost check for one billable dimension.
type BatchDimensionMargin struct {
	Dimension   string   `json:"dimension"`
	PurchaseUSD *float64 `json:"purchase_usd,omitempty"`
	SaleUSD     *float64 `json:"sale_usd,omitempty"`
	MarginUSD   *float64 `json:"margin_usd,omitempty"`
	MarginRate  *float64 `json:"margin_rate,omitempty"`
	Issue       string   `json:"issue,omitempty"`
}

// BatchPricingSkipped explains why a model was not priced.
type BatchPricingSkipped struct {
	ModelName string `json:"model_name"`
	// Identity is the full model|provider|region|deployment key when the skip
	// is about one specific identity, so a multi-identity model stays traceable.
	Identity string `json:"identity,omitempty"`
	Reason   string `json:"reason"`
}

// BatchPricingResult is the preview/apply outcome.
type BatchPricingResult struct {
	Basis   string                `json:"basis"`
	Mode    string                `json:"mode"`
	Value   float64               `json:"value"`
	DryRun  bool                  `json:"dry_run"`
	Updated int                   `json:"updated"`
	Items   []BatchPricingItem    `json:"items"`
	Skipped []BatchPricingSkipped `json:"skipped"`
	// Conflicts lists models whose row changed between preview and apply.
	Conflicts []string `json:"conflicts,omitempty"`
	// Dimensions echoes the rule's targeted dimensions; empty means all.
	Dimensions []string `json:"dimensions,omitempty"`
	// Blocked counts models held back by the margin protection.
	Blocked int `json:"blocked"`
	// Protection echoes strict/partial/approval.
	Protection string `json:"protection,omitempty"`
}

type batchPendingWrite struct {
	row             model.ChannelModelPricing
	identity        model.ChannelPricingIdentity
	internal        model.ChannelInternalPricing
	oldPricing      *model.ChannelInternalPricing
	expectedVersion string
	item            BatchPricingItem
	approved        bool
}

type batchBaseTier struct {
	name                        string
	timeBand                    string
	minInput                    int64
	maxInput                    int64
	inputUSD                    *float64
	outputUSD                   *float64
	cacheUSD                    *float64
	cacheWriteUSD               *float64
	audioInputUSD               *float64
	audioOutputUSD              *float64
	imageInputUSD               *float64
	thinkingInputUSD            *float64
	thinkingOutputUSD           *float64
	thinkingCacheUSD            *float64
	thinkingCreateCacheUSD      *float64
	thinkingImageInputUSD       *float64
	multiInputOutputUSD         *float64
	thinkingMultiInputOutputUSD *float64
	unit                        string
}

type batchBasePrice struct {
	mode                        string
	tiers                       []batchBaseTier
	inputUSD                    *float64
	outputUSD                   *float64
	cacheUSD                    *float64
	cacheWriteUSD               *float64
	audioInputUSD               *float64
	audioOutputUSD              *float64
	imageInputUSD               *float64
	thinkingInputUSD            *float64
	thinkingOutputUSD           *float64
	thinkingCacheUSD            *float64
	thinkingCreateCacheUSD      *float64
	thinkingImageInputUSD       *float64
	multiInputOutputUSD         *float64
	thinkingMultiInputOutputUSD *float64
	perCallUSD                  *float64
	perSecondUSD                *float64
	perMinuteUSD                *float64
}

// ApplyChannelBatchPricing applies one multiplier to a channel's model prices.
// The official basis uses absolute official prices only. The channel basis may
// use UterRoute's ratio-only quote, converted with Uter's ratio convention
// (ratio 1 = 2 USD / 1M tokens); it is never labelled as an official price.
// BatchTierRule overrides the batch rule for a matching price tier. An empty
// RangeName and TimeBand match every tier; the first matching rule wins.
type BatchTierRule struct {
	RangeName string  `json:"range_name,omitempty"`
	TimeBand  string  `json:"time_band,omitempty"`
	Mode      string  `json:"mode"`
	Value     float64 `json:"value"`
}

// BatchPricingOptions selects the models and rule for one batch operation.
// ModelPrefixes supports series-level rules such as "gpt-" or "claude-".
type BatchPricingOptions struct {
	Models          []string
	ModelPrefixes   []string
	ModelCategories []string
	// Identity filters narrow the batch to exact price records. A model can
	// have several rows in one channel (region / deployment), so a name alone
	// cannot express "only cn-beijing / deploy-1"; these filters can.
	Providers      []string
	Regions        []string
	Deployments    []string
	PricingSources []string
	Modes          []string
	Basis          string
	Mode           string
	Value          float64
	DryRun         bool
	// OverwriteManual lets a batch rule replace a hand-edited model price.
	// The default keeps the single-model rule as the highest priority.
	OverwriteManual bool
	// ExpectedVersions maps model name to the PricingVersion returned by the
	// preview. An apply whose row version differs is reported as a conflict
	// instead of writing a price computed from stale inputs.
	ExpectedVersions map[string]string
	// Dimensions limits the rule to the named price dimensions: input, output,
	// cache_read, cache_write, per_call, per_second, per_minute. Empty means
	// every dimension the model actually has.
	Dimensions []string
	// MinMarginRate is the lowest allowed (sale - purchase) / sale per
	// dimension. Nil disables the check.
	MinMarginRate *float64
	// TierRules override the batch rule for individual price tiers, matched by
	// range name and/or time band. A long-context band can therefore receive a
	// different multiplier from the base band in the same batch.
	TierRules []BatchTierRule
	// ProtectionMode selects strict (no writes), partial (skip the model) or
	// approval (write with ApprovalNote). Empty means partial.
	ProtectionMode string
	// ApprovalNote is required when ProtectionMode is approval and a rule
	// violates the margin floor.
	ApprovalNote string
}

// BatchPricingDimensions lists the dimensions a rule may target.
var BatchPricingDimensions = []string{
	"input", "output", "cache_read", "cache_write", "audio_input", "audio_output",
	"image_input", "thinking_input", "thinking_output", "thinking_cache",
	"thinking_create_cache", "thinking_image_input", "multi_input_output",
	"thinking_multi_input_output",
	"per_call", "per_second", "per_minute",
}

func ApplyChannelBatchPricing(
	channelID int,
	modelNames []string,
	basis string,
	mode string,
	value float64,
	dryRun bool,
) (*BatchPricingResult, error) {
	return ApplyChannelBatchPricingWithOptions(channelID, BatchPricingOptions{
		Models: modelNames, Basis: basis, Mode: mode, Value: value, DryRun: dryRun,
	})
}

func ApplyChannelBatchPricingWithOptions(
	channelID int,
	options BatchPricingOptions,
) (*BatchPricingResult, error) {
	basis := options.Basis
	mode := options.Mode
	value := options.Value
	dryRun := options.DryRun
	modelNames := options.Models
	if channelID <= 0 {
		return nil, errors.New("channel id is required")
	}
	basis = strings.TrimSpace(basis)
	if basis != BatchPricingBasisOfficial && basis != BatchPricingBasisChannel && basis != BatchPricingBasisCurrent {
		return nil, errors.New("basis must be official, channel or current")
	}
	if err := validateBatchRule(mode, value); err != nil {
		return nil, err
	}
	for _, rule := range options.TierRules {
		if err := validateBatchRule(rule.Mode, rule.Value); err != nil {
			return nil, fmt.Errorf("tier rule %s/%s: %w", rule.RangeName, rule.TimeBand, err)
		}
	}
	dimensions := make(map[string]bool, len(options.Dimensions))
	for _, dimension := range options.Dimensions {
		dimension = strings.TrimSpace(dimension)
		if dimension == "" {
			continue
		}
		if !slices.Contains(BatchPricingDimensions, dimension) {
			return nil, fmt.Errorf("unknown price dimension %q", dimension)
		}
		dimensions[dimension] = true
	}
	dimensionSelected := func(dimension string) bool {
		return len(dimensions) == 0 || dimensions[dimension]
	}
	protection := strings.TrimSpace(options.ProtectionMode)
	if protection == "" {
		protection = BatchProtectionModePartial
	}
	switch protection {
	case BatchProtectionModeStrict, BatchProtectionModePartial, BatchProtectionModeApproval:
	default:
		return nil, errors.New("protection mode must be strict, partial or approval")
	}
	if options.MinMarginRate != nil && (math.IsNaN(*options.MinMarginRate) || math.IsInf(*options.MinMarginRate, 0) || *options.MinMarginRate < 0) {
		return nil, errors.New("minimum margin rate must be a finite non-negative number")
	}

	rows, err := model.ListChannelModelPricing(channelID)
	if err != nil {
		return nil, err
	}
	// A model may exist under several provider/region/deployment identities.
	// The legacy model-name version key is only safe when the name is unique.
	identitiesByModel := make(map[string]map[string]struct{}, len(rows))
	for _, row := range rows {
		if row.ModelName == "" {
			continue
		}
		if identitiesByModel[row.ModelName] == nil {
			identitiesByModel[row.ModelName] = make(map[string]struct{})
		}
		identitiesByModel[row.ModelName][batchPricingIdentityKey(row)] = struct{}{}
	}
	selected := make(map[string]bool, len(modelNames))
	for _, name := range modelNames {
		name = strings.TrimSpace(name)
		if name != "" {
			selected[name] = true
		}
	}
	categories := make(map[string]bool, len(options.ModelCategories))
	for _, category := range options.ModelCategories {
		category = strings.ToLower(strings.TrimSpace(category))
		if category != "" {
			categories[category] = true
		}
	}
	prefixes := make([]string, 0, len(options.ModelPrefixes))
	for _, prefix := range options.ModelPrefixes {
		prefix = strings.ToLower(strings.TrimSpace(prefix))
		if prefix != "" {
			prefixes = append(prefixes, prefix)
		}
	}
	result := &BatchPricingResult{
		Basis: basis, Mode: mode, Value: value, DryRun: dryRun,
		Items: []BatchPricingItem{}, Skipped: []BatchPricingSkipped{},
		Dimensions: options.Dimensions, Protection: protection,
	}
	pending := make([]batchPendingWrite, 0, len(rows))
	strictBlocked := false
	strictBlockedModels := []string{}
	for _, row := range rows {
		if len(selected) > 0 && !selected[row.ModelName] {
			continue
		}
		if len(prefixes) > 0 && !matchesModelPrefixes(row.ModelName, prefixes) {
			continue
		}
		if len(categories) > 0 && !categories[ClassifyModelCategory(row.ModelName)] {
			continue
		}
		if !matchesAnyFilter(row.Provider, options.Providers) {
			continue
		}
		if !matchesAnyFilter(row.Region, options.Regions) {
			continue
		}
		if !matchesAnyFilter(row.DeploymentId, options.Deployments) {
			continue
		}
		if !matchesAnyFilter(row.PricingSource, options.PricingSources) {
			continue
		}
		if !matchesAnyFilter(internalPricingMode(row.InternalPricing), options.Modes) {
			continue
		}
		if !options.OverwriteManual && manualModelPrice(row) {
			result.Skipped = append(result.Skipped, BatchPricingSkipped{
				ModelName: row.ModelName, Reason: "manual model price preserved",
			})
			continue
		}
		base, reason := resolveBatchBasePrice(row, basis)
		if reason != "" {
			result.Skipped = append(result.Skipped, BatchPricingSkipped{ModelName: row.ModelName, Reason: reason})
			continue
		}
		item := BatchPricingItem{
			ModelName:    row.ModelName,
			Provider:     row.Provider,
			Region:       row.Region,
			DeploymentId: row.DeploymentId,
			Mode:         base.mode,
			Version:      row.PricingVersion,
			PurchaseUSD:  resolvePurchasePrimaryPrice(row),
			PreviousUSD:  resolveCurrentPrimaryPrice(row),
		}
		internal := model.ChannelInternalPricing{
			Mode:      base.mode,
			Note:      fmt.Sprintf("batch: %s %s %.4f", basis, mode, value),
			Source:    "batch",
			UpdatedAt: 0,
		}
		apply := func(raw *float64, dimension string) (*float64, bool) {
			if raw == nil {
				return nil, true
			}
			if !dimensionSelected(dimension) {
				// Excluded dimensions keep their base amount. The stored price
				// is a complete record, so it must still carry every field the
				// model is priced on.
				unchanged := *raw
				return &unchanged, true
			}
			out, ok := applyBatchRule(*raw, mode, value)
			if !ok {
				return nil, false
			}
			rounded := roundPrice(out)
			return &rounded, true
		}
		if next, ok := apply(base.inputUSD, "input"); ok && next != nil {
			item.InputUSD = next
			internal.InputUSDPerMillion = next
		} else if !ok {
			result.Skipped = append(result.Skipped, BatchPricingSkipped{ModelName: row.ModelName, Reason: "rule produced a negative price"})
			continue
		}
		if next, ok := apply(base.outputUSD, "output"); ok && next != nil {
			item.OutputUSD = next
			internal.OutputUSDPerMillion = next
		} else if !ok {
			result.Skipped = append(result.Skipped, BatchPricingSkipped{ModelName: row.ModelName, Reason: "rule produced a negative price"})
			continue
		}
		if next, ok := apply(base.cacheUSD, "cache_read"); ok && next != nil {
			item.CacheUSD = next
			internal.CacheUSDPerMillion = next
		} else if !ok {
			result.Skipped = append(result.Skipped, BatchPricingSkipped{ModelName: row.ModelName, Reason: "rule produced a negative price"})
			continue
		}
		if next, ok := apply(base.cacheWriteUSD, "cache_write"); ok && next != nil {
			item.CacheWriteUSD = next
			internal.CreateCacheUSDPerMillion = next
		} else if !ok {
			result.Skipped = append(result.Skipped, BatchPricingSkipped{ModelName: row.ModelName, Reason: "rule produced a negative price"})
			continue
		}
		if next, ok := apply(base.audioInputUSD, "audio_input"); ok && next != nil {
			item.AudioInputUSD = next
			internal.AudioInputUSDPerMillion = next
			internal.AudioRatio = nil
		} else if !ok {
			result.Skipped = append(result.Skipped, BatchPricingSkipped{ModelName: row.ModelName, Reason: "rule produced a negative price"})
			continue
		}
		if next, ok := apply(base.audioOutputUSD, "audio_output"); ok && next != nil {
			item.AudioOutputUSD = next
			internal.AudioOutputUSDPerMillion = next
			internal.AudioCompletionRatio = nil
		} else if !ok {
			result.Skipped = append(result.Skipped, BatchPricingSkipped{ModelName: row.ModelName, Reason: "rule produced a negative price"})
			continue
		}
		applyDimension := func(raw *float64, dimension string, internalTarget, itemTarget **float64) bool {
			next, ok := apply(raw, dimension)
			if !ok {
				result.Skipped = append(result.Skipped, BatchPricingSkipped{ModelName: row.ModelName, Reason: "rule produced a negative price"})
				return false
			}
			*internalTarget = next
			*itemTarget = next
			return true
		}
		if !applyDimension(base.imageInputUSD, "image_input", &internal.ImageInputUSDPerMillion, &item.ImageInputUSD) ||
			!applyDimension(base.thinkingInputUSD, "thinking_input", &internal.ThinkingInputUSDPerMillion, &item.ThinkingInputUSD) ||
			!applyDimension(base.thinkingOutputUSD, "thinking_output", &internal.ThinkingOutputUSDPerMillion, &item.ThinkingOutputUSD) ||
			!applyDimension(base.thinkingCacheUSD, "thinking_cache", &internal.ThinkingCacheUSDPerMillion, &item.ThinkingCacheUSD) ||
			!applyDimension(base.thinkingCreateCacheUSD, "thinking_create_cache", &internal.ThinkingCreateCacheUSDPerMillion, &item.ThinkingCreateCacheUSD) ||
			!applyDimension(base.thinkingImageInputUSD, "thinking_image_input", &internal.ThinkingImageInputUSDPerMillion, &item.ThinkingImageInputUSD) ||
			!applyDimension(base.multiInputOutputUSD, "multi_input_output", &internal.MultiInputOutputUSDPerMillion, &item.MultiInputOutputUSD) ||
			!applyDimension(base.thinkingMultiInputOutputUSD, "thinking_multi_input_output", &internal.ThinkingMultiInputOutputUSDPerMillion, &item.ThinkingMultiInputOutputUSD) {
			continue
		}
		if next, ok := apply(base.perCallUSD, "per_call"); ok && next != nil {
			item.PerCallUSD = next
			internal.PerCallUSD = next
		} else if !ok {
			result.Skipped = append(result.Skipped, BatchPricingSkipped{ModelName: row.ModelName, Reason: "rule produced a negative price"})
			continue
		}
		if next, ok := apply(base.perSecondUSD, "per_second"); ok && next != nil {
			item.PerSecondUSD = next
			internal.PerSecondUSD = next
		} else if !ok {
			result.Skipped = append(result.Skipped, BatchPricingSkipped{ModelName: row.ModelName, Reason: "rule produced a negative price"})
			continue
		}
		if next, ok := apply(base.perMinuteUSD, "per_minute"); ok && next != nil {
			item.PerMinuteUSD = next
			internal.PerMinuteUSD = next
		} else if !ok {
			result.Skipped = append(result.Skipped, BatchPricingSkipped{ModelName: row.ModelName, Reason: "rule produced a negative price"})
			continue
		}
		if len(base.tiers) > 0 {
			saleTiers := make([]model.ChannelInternalPricingTier, 0, len(base.tiers))
			previewTiers := make([]BatchPricingTier, 0, len(base.tiers))
			failed := false
			for _, tier := range base.tiers {
				nextTier := model.ChannelInternalPricingTier{
					RangeName: tier.name, TimeBand: tier.timeBand,
					MinInputTokens: tier.minInput, MaxInputTokens: tier.maxInput,
					Unit: model.ChannelPricingModePerMillionTokens,
				}
				tierMode, tierValue := mode, value
				for _, rule := range options.TierRules {
					if rule.RangeName != "" && !strings.EqualFold(rule.RangeName, tier.name) {
						continue
					}
					if rule.TimeBand != "" && !strings.EqualFold(rule.TimeBand, tier.timeBand) {
						continue
					}
					tierMode, tierValue = rule.Mode, rule.Value
					break
				}
				applyTier := func(raw *float64, dimension string) (*float64, bool) {
					if raw == nil {
						return nil, true
					}
					if !dimensionSelected(dimension) {
						unchanged := *raw
						return &unchanged, true
					}
					out, ok := applyBatchRule(*raw, tierMode, tierValue)
					if !ok {
						return nil, false
					}
					rounded := roundPrice(out)
					return &rounded, true
				}
				input, ok := applyTier(tier.inputUSD, "input")
				if !ok || input == nil {
					failed = true
					break
				}
				nextTier.InputUSDPerMillion = input
				output, ok := applyTier(tier.outputUSD, "output")
				if !ok {
					failed = true
					break
				}
				nextTier.OutputUSDPerMillion = output
				cache, ok := applyTier(tier.cacheUSD, "cache_read")
				if !ok {
					failed = true
					break
				}
				nextTier.CacheUSDPerMillion = cache
				cacheWrite, ok := applyTier(tier.cacheWriteUSD, "cache_write")
				if !ok {
					failed = true
					break
				}
				nextTier.CreateCacheUSDPerMillion = cacheWrite
				audioInput, ok := applyTier(tier.audioInputUSD, "audio_input")
				if !ok {
					failed = true
					break
				}
				nextTier.AudioInputUSDPerMillion = audioInput
				audioOutput, ok := applyTier(tier.audioOutputUSD, "audio_output")
				if !ok {
					failed = true
					break
				}
				nextTier.AudioOutputUSDPerMillion = audioOutput
				var okDim bool
				if nextTier.ImageInputUSDPerMillion, okDim = applyTier(tier.imageInputUSD, "image_input"); !okDim {
					failed = true
					break
				}
				if nextTier.ThinkingInputUSDPerMillion, okDim = applyTier(tier.thinkingInputUSD, "thinking_input"); !okDim {
					failed = true
					break
				}
				if nextTier.ThinkingOutputUSDPerMillion, okDim = applyTier(tier.thinkingOutputUSD, "thinking_output"); !okDim {
					failed = true
					break
				}
				if nextTier.ThinkingCacheUSDPerMillion, okDim = applyTier(tier.thinkingCacheUSD, "thinking_cache"); !okDim {
					failed = true
					break
				}
				if nextTier.ThinkingCreateCacheUSDPerMillion, okDim = applyTier(tier.thinkingCreateCacheUSD, "thinking_create_cache"); !okDim {
					failed = true
					break
				}
				if nextTier.ThinkingImageInputUSDPerMillion, okDim = applyTier(tier.thinkingImageInputUSD, "thinking_image_input"); !okDim {
					failed = true
					break
				}
				if nextTier.MultiInputOutputUSDPerMillion, okDim = applyTier(tier.multiInputOutputUSD, "multi_input_output"); !okDim {
					failed = true
					break
				}
				if nextTier.ThinkingMultiInputOutputUSDPerMillion, okDim = applyTier(tier.thinkingMultiInputOutputUSD, "thinking_multi_input_output"); !okDim {
					failed = true
					break
				}
				saleTiers = append(saleTiers, nextTier)
				previewTiers = append(previewTiers, BatchPricingTier{
					RangeName: nextTier.RangeName, TimeBand: nextTier.TimeBand,
					MinInputTokens: nextTier.MinInputTokens, MaxInputTokens: nextTier.MaxInputTokens,
					InputUSD: nextTier.InputUSDPerMillion, OutputUSD: nextTier.OutputUSDPerMillion,
					AudioInputUSD: nextTier.AudioInputUSDPerMillion, AudioOutputUSD: nextTier.AudioOutputUSDPerMillion,
					CacheUSD: nextTier.CacheUSDPerMillion, CacheWriteUSD: nextTier.CreateCacheUSDPerMillion,
					ImageInputUSD:               nextTier.ImageInputUSDPerMillion,
					ThinkingInputUSD:            nextTier.ThinkingInputUSDPerMillion,
					ThinkingOutputUSD:           nextTier.ThinkingOutputUSDPerMillion,
					ThinkingCacheUSD:            nextTier.ThinkingCacheUSDPerMillion,
					ThinkingCreateCacheUSD:      nextTier.ThinkingCreateCacheUSDPerMillion,
					ThinkingImageInputUSD:       nextTier.ThinkingImageInputUSDPerMillion,
					MultiInputOutputUSD:         nextTier.MultiInputOutputUSDPerMillion,
					ThinkingMultiInputOutputUSD: nextTier.ThinkingMultiInputOutputUSDPerMillion,
					Unit:                        "per_1m_token",
				})
			}
			if failed {
				result.Skipped = append(result.Skipped, BatchPricingSkipped{ModelName: row.ModelName, Reason: "rule produced a negative price"})
				continue
			}
			internal.Mode = model.ChannelPricingModeTieredTable
			internal.Tiers = saleTiers
			internal.Note = fmt.Sprintf("batch: %s %s %.4f (%d tiers)", basis, mode, value, len(saleTiers))
			internal.InputUSDPerMillion = nil
			internal.OutputUSDPerMillion = nil
			internal.CacheUSDPerMillion = nil
			internal.CreateCacheUSDPerMillion = nil
			item.Tiers = previewTiers
		}
		annotateBatchMargin(&item)
		// Record the amount the rule was actually applied to. A channel basis
		// follows the selected discount group, so "base -> sale" is the only
		// way to tell later why a sale price differs from the current quote.
		if baseAmount := primaryBatchPrice(base.mode, base.inputUSD, base.perCallUSD, base.perSecondUSD, base.perMinuteUSD); baseAmount != nil {
			if saleAmount := primaryBatchPrice(item.Mode, item.InputUSD, item.PerCallUSD, item.PerSecondUSD, item.PerMinuteUSD); saleAmount != nil {
				internal.Note = fmt.Sprintf(
					"batch: %s %s %.4f (base %.4f -> %.4f)", basis, mode, value, *baseAmount, *saleAmount,
				)
			}
		}
		purchaseDimensions := resolveBatchPurchaseDimensions(row)
		margins, verified, violated := evaluateBatchMarginDimensions(purchaseDimensions, item, options.MinMarginRate)
		item.DimensionMargins = margins
		item.MarginVerified = verified
		if cost := model.ParseChannelPurchaseCost(row.PurchasePricing); cost != nil {
			item.CostSource = cost.Source
			item.CostVerified = cost.Verified && verified
			if !cost.Verified {
				item.MarginVerified = false
			}
		}
		if len(item.Tiers) > 0 {
			annotateBatchTierMargin(&item)
		}
		approved := false
		if violated {
			item.ProtectionState = "blocked"
			switch protection {
			case BatchProtectionModeStrict:
				strictBlocked = true
				strictBlockedModels = append(strictBlockedModels, row.ModelName)
				result.Blocked++
			case BatchProtectionModeApproval:
				if strings.TrimSpace(options.ApprovalNote) == "" {
					result.Blocked++
					result.Skipped = append(result.Skipped, BatchPricingSkipped{
						ModelName: row.ModelName, Reason: "minimum margin violated; an approval note is required",
					})
				} else {
					approved = true
					item.ProtectionState = "approved"
					internal.Note += " | approved: " + strings.TrimSpace(options.ApprovalNote)
				}
			default:
				result.Blocked++
				result.Skipped = append(result.Skipped, BatchPricingSkipped{
					ModelName: row.ModelName, Reason: marginViolationReason(margins),
				})
			}
		}
		identityKey := batchPricingIdentityKey(row)
		expectedVersion := options.ExpectedVersions[identityKey]
		versionAmbiguous := false
		if expectedVersion == "" {
			if nameVersion, hasNameVersion := options.ExpectedVersions[row.ModelName]; hasNameVersion {
				// 只有调用方确实提交了模型名版本时才回退；同名模型存在多个
				// 身份时模型名无法唯一定位，宁可拒绝也不能校验到错误身份。
				if len(identitiesByModel[row.ModelName]) > 1 {
					versionAmbiguous = true
					result.Skipped = append(result.Skipped, BatchPricingSkipped{
						ModelName: row.ModelName, Identity: identityKey,
						Reason: "model has multiple channel identities; provide the full identity version key",
					})
				} else {
					expectedVersion = nameVersion
				}
			}
		}
		if !versionAmbiguous && !dryRun && (!violated || approved) {
			var oldPricing *model.ChannelInternalPricing
			if strings.TrimSpace(row.InternalPricing) != "" {
				var parsed model.ChannelInternalPricing
				if err := common.UnmarshalJsonStr(row.InternalPricing, &parsed); err == nil {
					oldPricing = &parsed
				}
			}
			pending = append(pending, batchPendingWrite{
				row: row,
				identity: model.ChannelPricingIdentity{
					ChannelId: channelID, Provider: row.Provider, Region: row.Region,
					DeploymentId: row.DeploymentId, ModelName: row.ModelName,
				},
				internal: internal, oldPricing: oldPricing,
				expectedVersion: expectedVersion, item: item, approved: approved,
			})
		}
		result.Items = append(result.Items, item)
	}
	written := 0
	if !dryRun && (len(pending) > 0 || strictBlocked) {
		if strictBlocked {
			blockedNames := make(map[string]bool, len(strictBlockedModels))
			for _, name := range strictBlockedModels {
				blockedNames[name] = true
			}
			for _, write := range pending {
				blockedNames[write.row.ModelName] = true
			}
			for name := range blockedNames {
				result.Skipped = append(result.Skipped, BatchPricingSkipped{
					ModelName: name,
					Reason:    "strict margin protection blocked the batch; no price was written",
				})
			}
		} else {
			for _, write := range pending {
				source := "batch"
				if write.approved {
					source = "batch-approved"
				}
				err := SetChannelPricingWithHistory(write.identity, write.internal, source, write.expectedVersion, write.oldPricing)
				if errors.Is(err, model.ErrChannelPricingVersionConflict) {
					identityKey := batchPricingIdentityKey(write.row)
					result.Conflicts = append(result.Conflicts, identityKey)
					result.Skipped = append(result.Skipped, BatchPricingSkipped{
						ModelName: write.row.ModelName, Identity: identityKey,
						Reason: "price changed after preview; re-run the preview",
					})
					continue
				}
				if err != nil {
					result.Skipped = append(result.Skipped, BatchPricingSkipped{ModelName: write.row.ModelName, Reason: err.Error()})
					continue
				}
				written++
			}
		}
	}
	if dryRun {
		result.Updated = len(result.Items)
	} else {
		result.Updated = written
	}
	return result, nil
}

// batchPricingIdentityKey is the stable version-key for one pricing identity.
func batchPricingIdentityKey(row model.ChannelModelPricing) string {
	return row.ModelName + "|" + row.Provider + "|" + row.Region + "|" + row.DeploymentId
}

// batchBaseFromContractCost converts the operator's contract cost into the
// same dimension set used for margins. It is deliberately independent of the
// upstream quote so the two never get mixed.
func batchBaseFromContractCost(pricing model.ChannelInternalPricing) (batchBasePrice, string) {
	if len(pricing.Tiers) > 0 {
		tiers := make([]batchBaseTier, 0, len(pricing.Tiers))
		for _, tier := range pricing.Tiers {
			tiers = append(tiers, batchBaseTier{
				name: tier.RangeName, timeBand: tier.TimeBand,
				minInput: tier.MinInputTokens, maxInput: tier.MaxInputTokens,
				inputUSD: tier.InputUSDPerMillion, outputUSD: tier.OutputUSDPerMillion,
				cacheUSD: tier.CacheUSDPerMillion, cacheWriteUSD: tier.CreateCacheUSDPerMillion,
				audioInputUSD: tier.AudioInputUSDPerMillion, audioOutputUSD: tier.AudioOutputUSDPerMillion,
				imageInputUSD:               tier.ImageInputUSDPerMillion,
				thinkingInputUSD:            tier.ThinkingInputUSDPerMillion,
				thinkingOutputUSD:           tier.ThinkingOutputUSDPerMillion,
				thinkingCacheUSD:            tier.ThinkingCacheUSDPerMillion,
				thinkingCreateCacheUSD:      tier.ThinkingCreateCacheUSDPerMillion,
				thinkingImageInputUSD:       tier.ThinkingImageInputUSDPerMillion,
				multiInputOutputUSD:         tier.MultiInputOutputUSDPerMillion,
				thinkingMultiInputOutputUSD: tier.ThinkingMultiInputOutputUSDPerMillion,
				unit:                        tier.Unit,
			})
		}
		return batchBasePrice{mode: model.ChannelPricingModeTieredTable, tiers: tiers}, ""
	}
	switch pricing.Mode {
	case model.ChannelPricingModePerMillionTokens:
		if pricing.InputUSDPerMillion == nil || *pricing.InputUSDPerMillion <= 0 {
			return batchBasePrice{}, "contract cost has no token input price"
		}
		return batchBasePrice{
			mode:     model.ChannelPricingModePerMillionTokens,
			inputUSD: pricing.InputUSDPerMillion, outputUSD: pricing.OutputUSDPerMillion,
			cacheUSD: pricing.CacheUSDPerMillion, cacheWriteUSD: pricing.CreateCacheUSDPerMillion,
			audioInputUSD: pricing.AudioInputUSDPerMillion, audioOutputUSD: pricing.AudioOutputUSDPerMillion,
			imageInputUSD:               pricing.ImageInputUSDPerMillion,
			thinkingInputUSD:            pricing.ThinkingInputUSDPerMillion,
			thinkingOutputUSD:           pricing.ThinkingOutputUSDPerMillion,
			thinkingCacheUSD:            pricing.ThinkingCacheUSDPerMillion,
			thinkingCreateCacheUSD:      pricing.ThinkingCreateCacheUSDPerMillion,
			thinkingImageInputUSD:       pricing.ThinkingImageInputUSDPerMillion,
			multiInputOutputUSD:         pricing.MultiInputOutputUSDPerMillion,
			thinkingMultiInputOutputUSD: pricing.ThinkingMultiInputOutputUSDPerMillion,
		}, ""
	case model.ChannelPricingModePerCall:
		return batchBasePrice{mode: model.ChannelPricingModePerCall, perCallUSD: pricing.PerCallUSD}, ""
	case model.ChannelPricingModePerSecond:
		return batchBasePrice{mode: model.ChannelPricingModePerSecond, perSecondUSD: pricing.PerSecondUSD}, ""
	case model.ChannelPricingModePerMinute:
		return batchBasePrice{mode: model.ChannelPricingModePerMinute, perMinuteUSD: pricing.PerMinuteUSD}, ""
	}
	return batchBasePrice{}, "unsupported contract cost mode"
}

// resolveBatchPurchaseDimensions reads the channel quote separately from the
// batch basis. When the basis is "current", the base amount is the sale price
// and must never be used as the purchase cost.
func resolveBatchPurchaseDimensions(row model.ChannelModelPricing) batchBasePrice {
	if cost := model.ParseChannelPurchaseCost(row.PurchasePricing); cost != nil {
		if base, reason := batchBaseFromContractCost(cost.Pricing); reason == "" {
			return base
		}
	}
	if strings.TrimSpace(row.NormalizedPricing) == "" {
		return batchBasePrice{}
	}
	var official model.ChannelOfficialPricing
	if err := common.UnmarshalJsonStr(row.NormalizedPricing, &official); err != nil {
		return batchBasePrice{}
	}
	if len(official.ChannelPriceTiers) > 1 {
		tiers := make([]batchBaseTier, 0, len(official.ChannelPriceTiers))
		for _, item := range official.ChannelPriceTiers {
			tiers = append(tiers, batchBaseTier{
				name: item.RangeName, timeBand: item.TimeBand,
				minInput: item.MinInputTokens, maxInput: item.MaxInputTokens,
				inputUSD: item.InputPerMillionUSD, outputUSD: item.OutputPerMillionUSD,
				cacheUSD: item.CachePerMillionUSD, cacheWriteUSD: item.CreateCachePerMillionUSD,
				audioInputUSD: item.AudioInputPerMillionUSD, audioOutputUSD: item.AudioOutputPerMillionUSD,
				imageInputUSD:               item.ImageInputPerMillionUSD,
				thinkingInputUSD:            item.ThinkingInputPerMillionUSD,
				thinkingOutputUSD:           item.ThinkingOutputPerMillionUSD,
				thinkingCacheUSD:            item.ThinkingCachePerMillionUSD,
				thinkingCreateCacheUSD:      item.ThinkingCreateCachePerMillionUSD,
				thinkingImageInputUSD:       item.ThinkingImageInputPerMillionUSD,
				multiInputOutputUSD:         item.MultiInputOutputPerMillionUSD,
				thinkingMultiInputOutputUSD: item.ThinkingMultiInputOutputPerMillionUSD,
				unit:                        item.Unit,
			})
		}
		return batchBasePrice{mode: model.ChannelPricingModePerMillionTokens, tiers: tiers}
	}
	var tier *model.ChannelPricingTier
	if len(official.ChannelPriceTiers) == 1 {
		tier = &official.ChannelPriceTiers[0]
	} else if official.ChannelPrice != nil {
		tier = official.ChannelPrice
	}
	if tier == nil {
		return batchBasePrice{}
	}
	base, reason := batchBaseFromTier(*tier)
	if reason != "" {
		return batchBasePrice{}
	}
	return base
}

type batchMarginDimension struct {
	dimension string
	purchase  *float64
	sale      *float64
}

// evaluateBatchMarginDimensions checks every dimension the rule priced. It
// returns the per-dimension comparison, whether every sold dimension had a
// purchase price (verified), and whether any dimension violates the floor.
func evaluateBatchMarginDimensions(base batchBasePrice, item BatchPricingItem, min *float64) ([]BatchDimensionMargin, bool, bool) {
	pairs := []batchMarginDimension{
		{"input", base.inputUSD, item.InputUSD},
		{"output", base.outputUSD, item.OutputUSD},
		{"cache_read", base.cacheUSD, item.CacheUSD},
		{"cache_write", base.cacheWriteUSD, item.CacheWriteUSD},
		{"audio_input", base.audioInputUSD, item.AudioInputUSD},
		{"audio_output", base.audioOutputUSD, item.AudioOutputUSD},
		{"image_input", base.imageInputUSD, item.ImageInputUSD},
		{"thinking_input", base.thinkingInputUSD, item.ThinkingInputUSD},
		{"thinking_output", base.thinkingOutputUSD, item.ThinkingOutputUSD},
		{"thinking_cache", base.thinkingCacheUSD, item.ThinkingCacheUSD},
		{"thinking_create_cache", base.thinkingCreateCacheUSD, item.ThinkingCreateCacheUSD},
		{"thinking_image_input", base.thinkingImageInputUSD, item.ThinkingImageInputUSD},
		{"multi_input_output", base.multiInputOutputUSD, item.MultiInputOutputUSD},
		{"thinking_multi_input_output", base.thinkingMultiInputOutputUSD, item.ThinkingMultiInputOutputUSD},
		{"per_call", base.perCallUSD, item.PerCallUSD},
		{"per_second", base.perSecondUSD, item.PerSecondUSD},
		{"per_minute", base.perMinuteUSD, item.PerMinuteUSD},
	}
	for i, sale := range item.Tiers {
		var purchase *batchBaseTier
		for j := range base.tiers {
			if base.tiers[j].name == sale.RangeName && base.tiers[j].timeBand == sale.TimeBand {
				purchase = &base.tiers[j]
				break
			}
		}
		if purchase == nil && i < len(base.tiers) {
			purchase = &base.tiers[i]
		}
		name := sale.RangeName
		if strings.TrimSpace(name) == "" {
			name = fmt.Sprintf("tier-%d", i+1)
		}
		var inputPurchase, outputPurchase, cachePurchase, cacheWritePurchase *float64
		var audioInputPurchase, audioOutputPurchase *float64
		var imagePurchase, thinkingInputPurchase, thinkingOutputPurchase *float64
		var thinkingCachePurchase, thinkingCreateCachePurchase, thinkingImagePurchase *float64
		var multiOutputPurchase, thinkingMultiOutputPurchase *float64
		if purchase != nil {
			inputPurchase = purchase.inputUSD
			outputPurchase = purchase.outputUSD
			cachePurchase = purchase.cacheUSD
			cacheWritePurchase = purchase.cacheWriteUSD
			audioInputPurchase = purchase.audioInputUSD
			audioOutputPurchase = purchase.audioOutputUSD
			imagePurchase = purchase.imageInputUSD
			thinkingInputPurchase = purchase.thinkingInputUSD
			thinkingOutputPurchase = purchase.thinkingOutputUSD
			thinkingCachePurchase = purchase.thinkingCacheUSD
			thinkingCreateCachePurchase = purchase.thinkingCreateCacheUSD
			thinkingImagePurchase = purchase.thinkingImageInputUSD
			multiOutputPurchase = purchase.multiInputOutputUSD
			thinkingMultiOutputPurchase = purchase.thinkingMultiInputOutputUSD
		}
		pairs = append(pairs,
			batchMarginDimension{name + "/input", inputPurchase, sale.InputUSD},
			batchMarginDimension{name + "/output", outputPurchase, sale.OutputUSD},
			batchMarginDimension{name + "/cache_read", cachePurchase, sale.CacheUSD},
			batchMarginDimension{name + "/cache_write", cacheWritePurchase, sale.CacheWriteUSD},
			batchMarginDimension{name + "/audio_input", audioInputPurchase, sale.AudioInputUSD},
			batchMarginDimension{name + "/audio_output", audioOutputPurchase, sale.AudioOutputUSD},
			batchMarginDimension{name + "/image_input", imagePurchase, sale.ImageInputUSD},
			batchMarginDimension{name + "/thinking_input", thinkingInputPurchase, sale.ThinkingInputUSD},
			batchMarginDimension{name + "/thinking_output", thinkingOutputPurchase, sale.ThinkingOutputUSD},
			batchMarginDimension{name + "/thinking_cache", thinkingCachePurchase, sale.ThinkingCacheUSD},
			batchMarginDimension{name + "/thinking_create_cache", thinkingCreateCachePurchase, sale.ThinkingCreateCacheUSD},
			batchMarginDimension{name + "/thinking_image_input", thinkingImagePurchase, sale.ThinkingImageInputUSD},
			batchMarginDimension{name + "/multi_input_output", multiOutputPurchase, sale.MultiInputOutputUSD},
			batchMarginDimension{name + "/thinking_multi_input_output", thinkingMultiOutputPurchase, sale.ThinkingMultiInputOutputUSD},
		)
	}
	margins := make([]BatchDimensionMargin, 0, len(pairs))
	verified := true
	violated := false
	for _, pair := range pairs {
		if pair.sale == nil {
			continue
		}
		margin := BatchDimensionMargin{Dimension: pair.dimension, SaleUSD: pair.sale, PurchaseUSD: pair.purchase}
		if pair.purchase == nil || *pair.purchase <= 0 {
			verified = false
			margin.Issue = "purchase_missing"
			margins = append(margins, margin)
			continue
		}
		amount := *pair.sale - *pair.purchase
		rate := 0.0
		if *pair.sale != 0 {
			rate = amount / *pair.sale
		}
		margin.MarginUSD = &amount
		margin.MarginRate = &rate
		switch {
		case *pair.sale <= 0:
			margin.Issue = "zero_sale_price"
			violated = true
		case min != nil && rate < *min:
			margin.Issue = "below_min_margin"
			violated = true
		}
		margins = append(margins, margin)
	}
	return margins, verified, violated
}

// annotateBatchTierMargin reports the weakest tier dimension as the item's
// primary margin, so the summary row is not silent for tiered models.
func annotateBatchTierMargin(item *BatchPricingItem) {
	var worst *BatchDimensionMargin
	for i := range item.DimensionMargins {
		margin := &item.DimensionMargins[i]
		if margin.MarginRate == nil {
			continue
		}
		if worst == nil || *margin.MarginRate < *worst.MarginRate {
			worst = margin
		}
	}
	if worst == nil {
		return
	}
	item.MarginUSD = worst.MarginUSD
	item.MarginRate = worst.MarginRate
}

func marginViolationReason(margins []BatchDimensionMargin) string {
	lowest := ""
	lowestRate := 0.0
	for _, margin := range margins {
		if margin.Issue != "below_min_margin" && margin.Issue != "zero_sale_price" {
			continue
		}
		if lowest == "" || margin.MarginRate == nil || (lowestRate != 0 && *margin.MarginRate < lowestRate) {
			lowest = margin.Dimension
			if margin.MarginRate != nil {
				lowestRate = *margin.MarginRate
			}
		}
	}
	if lowest == "" {
		return "minimum margin violated"
	}
	return "minimum margin violated on " + lowest
}

func resolveBatchBasePrice(row model.ChannelModelPricing, basis string) (batchBasePrice, string) {
	if basis == BatchPricingBasisCurrent {
		return resolveCurrentBatchBasePrice(row)
	}
	var official model.ChannelOfficialPricing
	parsedOfficial := false
	if strings.TrimSpace(row.NormalizedPricing) != "" {
		parsedOfficial = common.UnmarshalJsonStr(row.NormalizedPricing, &official) == nil
	}
	if basis == BatchPricingBasisChannel {
		// The purchase price is deliberately separate from the list price. A
		// row without one must not silently fall back to the official price.
		if parsedOfficial {
			switch {
			case len(official.ChannelPriceTiers) > 1:
				return batchBasePrice{}, "multiple channel price tiers require review"
			case len(official.ChannelPriceTiers) == 1:
				return batchBaseFromTier(official.ChannelPriceTiers[0])
			case official.ChannelPrice != nil:
				return batchBaseFromTier(*official.ChannelPrice)
			}
		}
	} else if parsedOfficial && len(official.Tiers) > 0 {
		switch official.PriceKind {
		case "", "OFFICIAL_ABSOLUTE", "OFFICIAL_RATIO":
		default:
			// A provider ratio, discount or estimate is not the official list
			// price; pricing against it would silently publish a guessed price.
			return batchBasePrice{}, "official basis unavailable: " + strings.ToLower(strings.ReplaceAll(official.PriceKind, "_", " "))
		}
		if len(official.Tiers) > 1 {
			return batchBasePrice{}, "multiple official price tiers require review"
		}
		return batchBaseFromTier(official.Tiers[0])
	}

	var uterRoute UterRouteNormalizedPricing
	if strings.TrimSpace(row.NormalizedPricing) != "" {
		if err := common.UnmarshalJsonStr(row.NormalizedPricing, &uterRoute); err == nil {
			if uterRoute.Unit == "per_second" && uterRoute.ModelPrice != nil && *uterRoute.ModelPrice > 0 {
				return batchBasePrice{mode: model.ChannelPricingModePerSecond, perSecondUSD: uterRoute.ModelPrice}, ""
			}
			if uterRoute.Unit == "per_minute" && uterRoute.ModelPrice != nil && *uterRoute.ModelPrice > 0 {
				return batchBasePrice{mode: model.ChannelPricingModePerMinute, perMinuteUSD: uterRoute.ModelPrice}, ""
			}
			if basis == BatchPricingBasisOfficial {
				return batchBasePrice{}, "absolute official price unavailable (ratio-only upstream)"
			}
			if uterRoute.ModelRatio != nil && *uterRoute.ModelRatio > 0 {
				input := *uterRoute.ModelRatio * 2
				base := batchBasePrice{mode: model.ChannelPricingModePerMillionTokens, inputUSD: &input}
				if uterRoute.CompletionRatio != nil && *uterRoute.CompletionRatio > 0 {
					output := input * *uterRoute.CompletionRatio
					base.outputUSD = &output
				}
				if uterRoute.CacheRatio != nil && *uterRoute.CacheRatio > 0 {
					cache := input * *uterRoute.CacheRatio
					base.cacheUSD = &cache
				}
				if uterRoute.CreateCacheRatio != nil && *uterRoute.CreateCacheRatio > 0 {
					cacheWrite := input * *uterRoute.CreateCacheRatio
					base.cacheWriteUSD = &cacheWrite
				}
				return base, ""
			}
			if uterRoute.ModelPrice != nil && *uterRoute.ModelPrice > 0 {
				return batchBasePrice{mode: model.ChannelPricingModePerCall, perCallUSD: uterRoute.ModelPrice}, ""
			}
		}
	}
	if basis == BatchPricingBasisChannel {
		return batchBasePrice{}, "no upstream purchase price for this model"
	}
	return batchBasePrice{}, "no absolute official price and no usable upstream ratio"
}

// batchBaseFromTier converts one normalized price tier without flattening or
// guessing: a shape it cannot express exactly is reported for review.
func batchBaseFromTier(tier model.ChannelPricingTier) (batchBasePrice, string) {
	switch tier.Unit {
	case "per_second":
		if tier.PerUnitUSD != nil && *tier.PerUnitUSD > 0 {
			return batchBasePrice{mode: model.ChannelPricingModePerSecond, perSecondUSD: tier.PerUnitUSD}, ""
		}
		return batchBasePrice{}, "per-second price is missing"
	case "per_minute":
		if tier.PerUnitUSD != nil && *tier.PerUnitUSD > 0 {
			return batchBasePrice{mode: model.ChannelPricingModePerMinute, perMinuteUSD: tier.PerUnitUSD}, ""
		}
		return batchBasePrice{}, "per-minute price is missing"
	}
	if tier.InputPerMillionUSD != nil && tier.PerUnitUSD != nil {
		return batchBasePrice{}, "ambiguous price shape requires review"
	}
	if tier.InputPerMillionUSD != nil && *tier.InputPerMillionUSD > 0 {
		base := batchBasePrice{mode: model.ChannelPricingModePerMillionTokens, inputUSD: tier.InputPerMillionUSD}
		base.outputUSD = tier.OutputPerMillionUSD
		base.cacheUSD = tier.CachePerMillionUSD
		base.cacheWriteUSD = tier.CreateCachePerMillionUSD
		base.audioInputUSD = tier.AudioInputPerMillionUSD
		base.audioOutputUSD = tier.AudioOutputPerMillionUSD
		base.imageInputUSD = tier.ImageInputPerMillionUSD
		base.thinkingInputUSD = tier.ThinkingInputPerMillionUSD
		base.thinkingOutputUSD = tier.ThinkingOutputPerMillionUSD
		base.thinkingCacheUSD = tier.ThinkingCachePerMillionUSD
		base.thinkingCreateCacheUSD = tier.ThinkingCreateCachePerMillionUSD
		base.thinkingImageInputUSD = tier.ThinkingImageInputPerMillionUSD
		base.multiInputOutputUSD = tier.MultiInputOutputPerMillionUSD
		base.thinkingMultiInputOutputUSD = tier.ThinkingMultiInputOutputPerMillionUSD
		return base, ""
	}
	if tier.PerUnitUSD != nil && *tier.PerUnitUSD > 0 {
		return batchBasePrice{mode: model.ChannelPricingModePerCall, perCallUSD: tier.PerUnitUSD}, ""
	}
	return batchBasePrice{}, "price tier has no usable amount"
}

// resolveCurrentBatchBasePrice rebases on the channel's current sale price, so
// an operator can adjust what customers pay today without touching upstream
// quotes.
func resolveCurrentBatchBasePrice(row model.ChannelModelPricing) (batchBasePrice, string) {
	if strings.TrimSpace(row.InternalPricing) == "" {
		return batchBasePrice{}, "no current channel price"
	}
	var internal model.ChannelInternalPricing
	if err := common.UnmarshalJsonStr(row.InternalPricing, &internal); err != nil {
		return batchBasePrice{}, "current channel price cannot be parsed"
	}
	if len(internal.Tiers) > 0 {
		tiers := make([]batchBaseTier, 0, len(internal.Tiers))
		for _, tier := range internal.Tiers {
			tiers = append(tiers, batchBaseTier{
				name: tier.RangeName, timeBand: tier.TimeBand,
				minInput: tier.MinInputTokens, maxInput: tier.MaxInputTokens,
				inputUSD: tier.InputUSDPerMillion, outputUSD: tier.OutputUSDPerMillion,
				cacheUSD: tier.CacheUSDPerMillion, cacheWriteUSD: tier.CreateCacheUSDPerMillion,
				audioInputUSD: tier.AudioInputUSDPerMillion, audioOutputUSD: tier.AudioOutputUSDPerMillion,
				imageInputUSD:               tier.ImageInputUSDPerMillion,
				thinkingInputUSD:            tier.ThinkingInputUSDPerMillion,
				thinkingOutputUSD:           tier.ThinkingOutputUSDPerMillion,
				thinkingCacheUSD:            tier.ThinkingCacheUSDPerMillion,
				thinkingCreateCacheUSD:      tier.ThinkingCreateCacheUSDPerMillion,
				thinkingImageInputUSD:       tier.ThinkingImageInputUSDPerMillion,
				multiInputOutputUSD:         tier.MultiInputOutputUSDPerMillion,
				thinkingMultiInputOutputUSD: tier.ThinkingMultiInputOutputUSDPerMillion,
				unit:                        tier.Unit,
			})
		}
		return batchBasePrice{mode: model.ChannelPricingModeTieredTable, tiers: tiers}, ""
	}
	switch internal.Mode {
	case model.ChannelPricingModePerMillionTokens:
		if internal.InputUSDPerMillion == nil || *internal.InputUSDPerMillion <= 0 {
			return batchBasePrice{}, "current channel price has no token input price"
		}
		audioInput := internal.AudioInputUSDPerMillion
		if audioInput == nil && internal.AudioRatio != nil && *internal.AudioRatio > 0 &&
			internal.InputUSDPerMillion != nil {
			derived := *internal.AudioRatio * *internal.InputUSDPerMillion
			audioInput = &derived
		}
		audioOutput := internal.AudioOutputUSDPerMillion
		if audioOutput == nil && internal.AudioCompletionRatio != nil && *internal.AudioCompletionRatio > 0 &&
			internal.OutputUSDPerMillion != nil {
			derived := *internal.AudioCompletionRatio * *internal.OutputUSDPerMillion
			audioOutput = &derived
		}
		return batchBasePrice{
			mode:          model.ChannelPricingModePerMillionTokens,
			inputUSD:      internal.InputUSDPerMillion,
			outputUSD:     internal.OutputUSDPerMillion,
			cacheUSD:      internal.CacheUSDPerMillion,
			cacheWriteUSD: internal.CreateCacheUSDPerMillion,
			audioInputUSD: audioInput, audioOutputUSD: audioOutput,
			imageInputUSD:               internal.ImageInputUSDPerMillion,
			thinkingInputUSD:            internal.ThinkingInputUSDPerMillion,
			thinkingOutputUSD:           internal.ThinkingOutputUSDPerMillion,
			thinkingCacheUSD:            internal.ThinkingCacheUSDPerMillion,
			thinkingCreateCacheUSD:      internal.ThinkingCreateCacheUSDPerMillion,
			thinkingImageInputUSD:       internal.ThinkingImageInputUSDPerMillion,
			multiInputOutputUSD:         internal.MultiInputOutputUSDPerMillion,
			thinkingMultiInputOutputUSD: internal.ThinkingMultiInputOutputUSDPerMillion,
		}, ""
	case model.ChannelPricingModePerCall:
		if internal.PerCallUSD == nil {
			return batchBasePrice{}, "current channel price has no per-call price"
		}
		return batchBasePrice{mode: model.ChannelPricingModePerCall, perCallUSD: internal.PerCallUSD}, ""
	case model.ChannelPricingModePerSecond:
		if internal.PerSecondUSD == nil {
			return batchBasePrice{}, "current channel price has no per-second price"
		}
		return batchBasePrice{mode: model.ChannelPricingModePerSecond, perSecondUSD: internal.PerSecondUSD}, ""
	case model.ChannelPricingModePerMinute:
		if internal.PerMinuteUSD == nil {
			return batchBasePrice{}, "current channel price has no per-minute price"
		}
		return batchBasePrice{mode: model.ChannelPricingModePerMinute, perMinuteUSD: internal.PerMinuteUSD}, ""
	default:
		return batchBasePrice{}, "current channel price has an unsupported mode"
	}
}

// primaryBatchPrice is the single amount used for margin and change
// comparisons: token input per 1M, per call, or per second.
func primaryBatchPrice(mode string, input, perCall, perSecond, perMinute *float64) *float64 {
	switch mode {
	case model.ChannelPricingModePerMillionTokens:
		return input
	case model.ChannelPricingModePerCall:
		return perCall
	case model.ChannelPricingModePerSecond:
		return perSecond
	case model.ChannelPricingModePerMinute:
		return perMinute
	}
	return nil
}

func pricingModeForUnit(unit string) string {
	switch unit {
	case "per_second":
		return model.ChannelPricingModePerSecond
	case "per_minute":
		return model.ChannelPricingModePerMinute
	case "", "per_1m_token":
		return model.ChannelPricingModePerMillionTokens
	default:
		return model.ChannelPricingModePerCall
	}
}

// resolvePurchasePrimaryPrice reads the upstream purchase price kept beside
// the official tiers. It never substitutes the list price for a missing
// purchase price.
func resolvePurchasePrimaryPrice(row model.ChannelModelPricing) *float64 {
	if primary := model.PurchaseCostPrimaryUSD(row.PurchasePricing); primary != nil {
		return primary
	}
	raw := strings.TrimSpace(row.NormalizedPricing)
	if raw == "" {
		return nil
	}
	var official model.ChannelOfficialPricing
	if err := common.UnmarshalJsonStr(raw, &official); err == nil && official.ChannelPrice != nil {
		tier := *official.ChannelPrice
		mode := pricingModeForUnit(tier.Unit)
		if mode == model.ChannelPricingModePerMillionTokens {
			return primaryBatchPrice(mode, tier.InputPerMillionUSD, nil, nil, nil)
		}
		if mode == model.ChannelPricingModePerSecond {
			return primaryBatchPrice(mode, nil, nil, tier.PerUnitUSD, nil)
		}
		if mode == model.ChannelPricingModePerMinute {
			return primaryBatchPrice(mode, nil, nil, nil, tier.PerUnitUSD)
		}
		return primaryBatchPrice(mode, nil, tier.PerUnitUSD, nil, nil)
	}
	var uterRoute UterRouteNormalizedPricing
	if err := common.UnmarshalJsonStr(raw, &uterRoute); err != nil {
		return nil
	}
	if uterRoute.Unit == "per_second" || uterRoute.Unit == "per_minute" {
		return uterRoute.ModelPrice
	}
	if uterRoute.ModelRatio != nil && *uterRoute.ModelRatio > 0 {
		input := *uterRoute.ModelRatio * 2
		return &input
	}
	return uterRoute.ModelPrice
}

func resolveCurrentPrimaryPrice(row model.ChannelModelPricing) *float64 {
	raw := strings.TrimSpace(row.InternalPricing)
	if raw == "" {
		return nil
	}
	var internal model.ChannelInternalPricing
	if err := common.UnmarshalJsonStr(raw, &internal); err != nil {
		return nil
	}
	return primaryBatchPrice(internal.Mode, internal.InputUSDPerMillion, internal.PerCallUSD, internal.PerSecondUSD, internal.PerMinuteUSD)
}

func annotateBatchMargin(item *BatchPricingItem) {
	sale := primaryBatchPrice(item.Mode, item.InputUSD, item.PerCallUSD, item.PerSecondUSD, item.PerMinuteUSD)
	if sale == nil {
		return
	}
	if item.PreviousUSD != nil && *item.PreviousUSD > 0 {
		change := (*sale - *item.PreviousUSD) / *item.PreviousUSD * 100
		item.ChangePercent = &change
	}
	if item.PurchaseUSD != nil && *sale > 0 {
		margin := *sale - *item.PurchaseUSD
		rate := margin / *sale
		item.MarginUSD = &margin
		item.MarginRate = &rate
	}
}

func applyBatchRule(base float64, mode string, value float64) (float64, bool) {
	var out float64
	switch mode {
	case BatchPricingModeDiscount, BatchPricingModeMultiply:
		out = base * value
	case BatchPricingModeMarkup:
		out = base * (1 + value)
	case BatchPricingModeAdd:
		out = base + value
	case BatchPricingModeFixed:
		out = value
	case BatchPricingModeNone:
		out = base
	default:
		return 0, false
	}
	if math.IsNaN(out) || math.IsInf(out, 0) || out < 0 {
		return 0, false
	}
	return out, true
}

// validateBatchRule enforces the finite/non-negative contract shared by the
// base batch rule and per-tier overrides.
func validateBatchRule(mode string, value float64) error {
	switch mode {
	case BatchPricingModeDiscount, BatchPricingModeMultiply:
		if math.IsNaN(value) || math.IsInf(value, 0) || value < 0 {
			return errors.New("value must be a finite non-negative number")
		}
	case BatchPricingModeMarkup, BatchPricingModeAdd:
		if math.IsNaN(value) || math.IsInf(value, 0) {
			return errors.New("value must be a finite number")
		}
	case BatchPricingModeFixed:
		if math.IsNaN(value) || math.IsInf(value, 0) || value < 0 {
			return errors.New("fixed price must be a finite non-negative number")
		}
	case BatchPricingModeNone:
	default:
		return errors.New("mode must be discount, markup, multiply, add, fixed or none")
	}
	return nil
}

// ClassifyModelCategory is a name-based fallback for model-type scopes. It is
// deliberately labelled heuristic: the authoritative type still comes from
// model metadata and the task plugin schema.
func ClassifyModelCategory(name string) string {
	lower := strings.ToLower(name)
	switch {
	case strings.Contains(lower, "embedding"), strings.Contains(lower, "embed"):
		return "embedding"
	case strings.Contains(lower, "tts"), strings.Contains(lower, "asr"),
		strings.Contains(lower, "whisper"), strings.Contains(lower, "speech"),
		strings.Contains(lower, "cosyvoice"), strings.Contains(lower, "sensevoice"),
		strings.Contains(lower, "paraformer"), strings.Contains(lower, "audio"):
		return "audio"
	case strings.Contains(lower, "video"), strings.Contains(lower, "t2v"),
		strings.Contains(lower, "i2v"), strings.Contains(lower, "kf2v"),
		strings.Contains(lower, "s2v"), strings.Contains(lower, "sora"),
		strings.Contains(lower, "veo"), strings.Contains(lower, "kling"):
		return "video"
	case strings.Contains(lower, "image"), strings.Contains(lower, "dall-e"),
		strings.Contains(lower, "flux"), strings.Contains(lower, "seedream"),
		strings.Contains(lower, "wanx"), strings.Contains(lower, "z-image"):
		return "image"
	default:
		return "text"
	}
}

func manualModelPrice(row model.ChannelModelPricing) bool {
	if row.PricingStatus != model.ChannelPricingStatusConfigured || strings.TrimSpace(row.InternalPricing) == "" {
		return false
	}
	var internal model.ChannelInternalPricing
	if err := common.UnmarshalJsonStr(row.InternalPricing, &internal); err != nil {
		return true
	}
	if strings.HasPrefix(strings.TrimSpace(internal.Note), "batch:") {
		return false
	}
	switch {
	case internal.Source == "batch":
		return false
	case strings.HasPrefix(internal.Source, "uterroute-"),
		strings.HasPrefix(internal.Source, "bailian-"),
		strings.HasPrefix(internal.Source, "generic"):
		return false
	}
	return true
}

// matchesAnyFilter treats an empty filter list as "no restriction" and
// compares case-insensitively, because providers and regions are typed by hand
// in the UI while the database stores the normalized value.
func matchesAnyFilter(value string, allowed []string) bool {
	if len(allowed) == 0 {
		return true
	}
	for _, candidate := range allowed {
		if strings.EqualFold(strings.TrimSpace(candidate), strings.TrimSpace(value)) {
			return true
		}
	}
	return false
}

func internalPricingMode(raw string) string {
	if strings.TrimSpace(raw) == "" {
		return ""
	}
	var pricing model.ChannelInternalPricing
	if err := common.UnmarshalJsonStr(raw, &pricing); err != nil {
		return ""
	}
	return pricing.Mode
}

func matchesModelPrefixes(name string, prefixes []string) bool {
	lowerName := strings.ToLower(name)
	for _, prefix := range prefixes {
		if strings.HasPrefix(lowerName, prefix) {
			return true
		}
	}
	return false
}

func roundPrice(value float64) float64 {
	return math.Round(value*1e10) / 1e10
}

// ChannelPricingSchedule is the per-channel "apply this rule after each
// official catalog sync" setting.
type ChannelPricingSchedule struct {
	Enabled          bool    `json:"enabled"`
	Basis            string  `json:"basis"`
	Mode             string  `json:"mode"`
	Value            float64 `json:"value"`
	ApplyOnSync      bool    `json:"apply_on_sync"`
	IntervalMinutes  int     `json:"interval_minutes"`
	ReviewMode       string  `json:"review_mode"`       // auto | manual
	ThresholdPercent float64 `json:"threshold_percent"` // manual review above this absolute change

	// Independent price sync cadences in minutes. Zero uses the defaults below.
	// ModelSyncIntervalMinutes is accepted for backward compatibility but no
	// longer schedules model additions: the upstream model detection task is
	// the single owner of the channel model list.
	ModelSyncIntervalMinutes    int `json:"model_sync_interval_minutes"`
	OfficialSyncIntervalMinutes int `json:"official_sync_interval_minutes"`
	ChannelSyncIntervalMinutes  int `json:"channel_sync_interval_minutes"`
}

const (
	DefaultModelSyncIntervalMinutes    = 360  // 6 hours
	DefaultOfficialSyncIntervalMinutes = 1440 // 24 hours
	DefaultChannelSyncIntervalMinutes  = 60   // 1 hour
)

// EffectiveIntervals fills zero values with the documented defaults.
func (s ChannelPricingSchedule) EffectiveIntervals() (model, official, channel int) {
	model, official, channel = s.ModelSyncIntervalMinutes, s.OfficialSyncIntervalMinutes, s.ChannelSyncIntervalMinutes
	if model <= 0 {
		model = DefaultModelSyncIntervalMinutes
	}
	if official <= 0 {
		official = DefaultOfficialSyncIntervalMinutes
	}
	if channel <= 0 {
		channel = DefaultChannelSyncIntervalMinutes
	}
	return model, official, channel
}

// ChannelPricingScheduleSetting persists schedules by channel ID.
type ChannelPricingScheduleSetting struct {
	Channels map[string]ChannelPricingSchedule `json:"channels"`
}

const ChannelPricingScheduleKey = "ChannelPricingSchedule"

// GetChannelPricingSchedule returns one channel's schedule.
// channelPricingScheduleMutex serializes the read-modify-write of the shared
// schedule option so concurrent API writes cannot drop each other's entries.
var channelPricingScheduleMutex sync.Mutex

func GetChannelPricingSchedule(channelID int) (ChannelPricingSchedule, bool) {
	channelPricingScheduleMutex.Lock()
	defer channelPricingScheduleMutex.Unlock()
	raw := strings.TrimSpace(common.GetOption(ChannelPricingScheduleKey))
	if raw == "" || channelID <= 0 {
		return ChannelPricingSchedule{}, false
	}
	var setting ChannelPricingScheduleSetting
	if err := common.UnmarshalJsonStr(raw, &setting); err != nil {
		return ChannelPricingSchedule{}, false
	}
	schedule, ok := setting.Channels[fmt.Sprintf("%d", channelID)]
	return schedule, ok
}

// SetChannelPricingSchedule validates and persists one channel's schedule.
func SetChannelPricingSchedule(channelID int, schedule ChannelPricingSchedule) error {
	if channelID <= 0 {
		return errors.New("channel id is required")
	}
	channelPricingScheduleMutex.Lock()
	defer channelPricingScheduleMutex.Unlock()
	if schedule.Enabled {
		if schedule.Basis != BatchPricingBasisOfficial && schedule.Basis != BatchPricingBasisChannel && schedule.Basis != BatchPricingBasisCurrent {
			return errors.New("basis must be official, channel or current")
		}
		switch schedule.Mode {
		case BatchPricingModeDiscount, BatchPricingModeMultiply, BatchPricingModeFixed:
			if math.IsNaN(schedule.Value) || math.IsInf(schedule.Value, 0) || schedule.Value < 0 {
				return errors.New("value must be a finite non-negative number")
			}
		case BatchPricingModeMarkup, BatchPricingModeAdd:
			if math.IsNaN(schedule.Value) || math.IsInf(schedule.Value, 0) {
				return errors.New("value must be a finite number")
			}
		case BatchPricingModeNone:
		default:
			return errors.New("unsupported pricing mode")
		}
		if schedule.IntervalMinutes < 0 {
			return errors.New("interval must not be negative")
		}
		if schedule.ReviewMode == "" {
			schedule.ReviewMode = "auto"
		}
		if schedule.ReviewMode != "auto" && schedule.ReviewMode != "manual" {
			return errors.New("review mode must be auto or manual")
		}
		if math.IsNaN(schedule.ThresholdPercent) || math.IsInf(schedule.ThresholdPercent, 0) || schedule.ThresholdPercent < 0 {
			return errors.New("threshold percent must be finite and non-negative")
		}
		if schedule.ModelSyncIntervalMinutes < 0 || schedule.OfficialSyncIntervalMinutes < 0 || schedule.ChannelSyncIntervalMinutes < 0 {
			return errors.New("sync intervals must not be negative")
		}
	}
	setting := ChannelPricingScheduleSetting{Channels: map[string]ChannelPricingSchedule{}}
	if raw := strings.TrimSpace(common.GetOption(ChannelPricingScheduleKey)); raw != "" {
		_ = common.UnmarshalJsonStr(raw, &setting)
		if setting.Channels == nil {
			setting.Channels = map[string]ChannelPricingSchedule{}
		}
	}
	setting.Channels[fmt.Sprintf("%d", channelID)] = schedule
	raw, err := common.Marshal(setting)
	if err != nil {
		return err
	}
	return model.UpdateOption(ChannelPricingScheduleKey, string(raw))
}
