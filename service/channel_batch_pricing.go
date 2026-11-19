package service

import (
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

const (
	BatchPricingBasisOfficial = "official"
	BatchPricingBasisChannel  = "channel"

	BatchPricingModeDiscount = "discount" // value 0.6 -> base * 0.6
	BatchPricingModeMarkup   = "markup"   // value 0.1 -> base * (1 + 0.1)
	BatchPricingModeMultiply = "multiply" // value 0.8 -> base * 0.8
	BatchPricingModeAdd      = "add"      // value 0.5 -> base + 0.5
	BatchPricingModeFixed    = "fixed"    // value 2.5 -> 2.5
	BatchPricingModeNone     = "none"     // keep the base price
)

// BatchPricingItem is one previewed/written internal price.
type BatchPricingItem struct {
	ModelName  string   `json:"model_name"`
	Mode       string   `json:"mode"`
	InputUSD   *float64 `json:"input_per_million_usd,omitempty"`
	OutputUSD  *float64 `json:"output_per_million_usd,omitempty"`
	PerCallUSD *float64 `json:"per_call_usd,omitempty"`
}

// BatchPricingSkipped explains why a model was not priced.
type BatchPricingSkipped struct {
	ModelName string `json:"model_name"`
	Reason    string `json:"reason"`
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
}

type batchBasePrice struct {
	mode       string
	inputUSD   *float64
	outputUSD  *float64
	perCallUSD *float64
}

// ApplyChannelBatchPricing applies one multiplier to a channel's model prices.
// The official basis uses absolute official prices only. The channel basis may
// use DreamRouter's ratio-only quote, converted with Uter's ratio convention
// (ratio 1 = 2 USD / 1M tokens); it is never labelled as an official price.
// BatchPricingOptions selects the models and rule for one batch operation.
// ModelPrefixes supports series-level rules such as "gpt-" or "claude-".
type BatchPricingOptions struct {
	Models          []string
	ModelPrefixes   []string
	ModelCategories []string
	Basis           string
	Mode            string
	Value           float64
	DryRun          bool
	// OverwriteManual lets a batch rule replace a hand-edited model price.
	// The default keeps the single-model rule as the highest priority.
	OverwriteManual bool
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
	if basis != BatchPricingBasisOfficial && basis != BatchPricingBasisChannel {
		return nil, errors.New("basis must be official or channel")
	}
	switch mode {
	case BatchPricingModeDiscount, BatchPricingModeMultiply:
		if math.IsNaN(value) || math.IsInf(value, 0) || value < 0 {
			return nil, errors.New("value must be a finite non-negative number")
		}
	case BatchPricingModeMarkup, BatchPricingModeAdd:
		if math.IsNaN(value) || math.IsInf(value, 0) {
			return nil, errors.New("value must be a finite number")
		}
	case BatchPricingModeFixed:
		if math.IsNaN(value) || math.IsInf(value, 0) || value < 0 {
			return nil, errors.New("fixed price must be a finite non-negative number")
		}
	case BatchPricingModeNone:
	default:
		return nil, errors.New("mode must be discount, markup, multiply, add, fixed or none")
	}
	rows, err := model.ListChannelModelPricing(channelID)
	if err != nil {
		return nil, err
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
	}
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
		item := BatchPricingItem{ModelName: row.ModelName, Mode: base.mode}
		internal := model.ChannelInternalPricing{
			Mode:      base.mode,
			Note:      fmt.Sprintf("batch: %s %s %.4f", basis, mode, value),
			UpdatedAt: 0,
		}
		apply := func(raw *float64) (*float64, bool) {
			if raw == nil {
				return nil, true
			}
			out, ok := applyBatchRule(*raw, mode, value)
			if !ok {
				return nil, false
			}
			rounded := roundPrice(out)
			return &rounded, true
		}
		if next, ok := apply(base.inputUSD); ok && next != nil {
			item.InputUSD = next
			internal.InputUSDPerMillion = next
		} else if !ok {
			result.Skipped = append(result.Skipped, BatchPricingSkipped{ModelName: row.ModelName, Reason: "rule produced a negative price"})
			continue
		}
		if next, ok := apply(base.outputUSD); ok && next != nil {
			item.OutputUSD = next
			internal.OutputUSDPerMillion = next
		} else if !ok {
			result.Skipped = append(result.Skipped, BatchPricingSkipped{ModelName: row.ModelName, Reason: "rule produced a negative price"})
			continue
		}
		if next, ok := apply(base.perCallUSD); ok && next != nil {
			item.PerCallUSD = next
			internal.PerCallUSD = next
		} else if !ok {
			result.Skipped = append(result.Skipped, BatchPricingSkipped{ModelName: row.ModelName, Reason: "rule produced a negative price"})
			continue
		}
		if !dryRun {
			var oldPricing *model.ChannelInternalPricing
			if strings.TrimSpace(row.InternalPricing) != "" {
				var parsed model.ChannelInternalPricing
				if err := common.UnmarshalJsonStr(row.InternalPricing, &parsed); err == nil {
					oldPricing = &parsed
				}
			}
			if err := model.SetChannelInternalPricing(channelID, row.ModelName, internal); err != nil {
				result.Skipped = append(result.Skipped, BatchPricingSkipped{ModelName: row.ModelName, Reason: err.Error()})
				continue
			}
			if err := AppendChannelPricingHistory(ChannelPricingHistoryEntry{
				ChannelID: channelID, ModelName: row.ModelName, Source: "batch",
				OldPricing: oldPricing, NewPricing: &internal,
			}); err != nil {
				common.SysError("append batch pricing history failed: " + err.Error())
			}
		}
		result.Items = append(result.Items, item)
	}
	result.Updated = len(result.Items)
	return result, nil
}

func resolveBatchBasePrice(row model.ChannelModelPricing, basis string) (batchBasePrice, string) {
	var official model.ChannelOfficialPricing
	if strings.TrimSpace(row.NormalizedPricing) != "" {
		if err := common.UnmarshalJsonStr(row.NormalizedPricing, &official); err == nil && len(official.Tiers) > 0 {
			if len(official.Tiers) > 1 {
				return batchBasePrice{}, "multiple official price tiers require review"
			}
			for _, tier := range official.Tiers {
				if tier.Unit == "per_second" {
					return batchBasePrice{}, "official media price shape is not supported by batch pricing"
				}
				if tier.InputPerMillionUSD != nil && tier.PerUnitUSD != nil {
					return batchBasePrice{}, "ambiguous official price shape requires review"
				}
				if tier.InputPerMillionUSD != nil && *tier.InputPerMillionUSD > 0 {
					base := batchBasePrice{mode: model.ChannelPricingModePerMillionTokens, inputUSD: tier.InputPerMillionUSD}
					if tier.OutputPerMillionUSD != nil {
						base.outputUSD = tier.OutputPerMillionUSD
					}
					return base, ""
				}
				if tier.PerUnitUSD != nil && *tier.PerUnitUSD > 0 {
					return batchBasePrice{mode: model.ChannelPricingModePerCall, perCallUSD: tier.PerUnitUSD}, ""
				}
			}
		}
	}

	var dreamRouter DreamRouterNormalizedPricing
	if strings.TrimSpace(row.NormalizedPricing) != "" {
		if err := common.UnmarshalJsonStr(row.NormalizedPricing, &dreamRouter); err == nil {
			if basis == BatchPricingBasisOfficial {
				return batchBasePrice{}, "absolute official price unavailable (ratio-only upstream)"
			}
			if dreamRouter.ModelRatio != nil && *dreamRouter.ModelRatio > 0 {
				input := *dreamRouter.ModelRatio * 2
				base := batchBasePrice{mode: model.ChannelPricingModePerMillionTokens, inputUSD: &input}
				if dreamRouter.CompletionRatio != nil && *dreamRouter.CompletionRatio > 0 {
					output := input * *dreamRouter.CompletionRatio
					base.outputUSD = &output
				}
				return base, ""
			}
			if dreamRouter.ModelPrice != nil && *dreamRouter.ModelPrice > 0 {
				return batchBasePrice{mode: model.ChannelPricingModePerCall, perCallUSD: dreamRouter.ModelPrice}, ""
			}
		}
	}
	return batchBasePrice{}, "no absolute official price and no usable upstream ratio"
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
	return !strings.HasPrefix(strings.TrimSpace(internal.Note), "batch:")
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

	// Independent sync cadences in minutes. Zero uses the defaults below.
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
func GetChannelPricingSchedule(channelID int) (ChannelPricingSchedule, bool) {
	raw := strings.TrimSpace(common.OptionMap[ChannelPricingScheduleKey])
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
	if schedule.Enabled {
		if schedule.Basis != BatchPricingBasisOfficial && schedule.Basis != BatchPricingBasisChannel {
			return errors.New("basis must be official or channel")
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
	if raw := strings.TrimSpace(common.OptionMap[ChannelPricingScheduleKey]); raw != "" {
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
