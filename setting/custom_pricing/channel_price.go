package custom_pricing

import (
	"fmt"
	"math"
	"strconv"

	"github.com/uter-ai/uter/common"
)

// ChannelPriceMode describes how a per-model override is expressed.
//
// Effective price = channel quote (synced) × channel-wide ratio × model rule.
//
//   - "multiplier": multiply the price produced by the quote and channel ratio.
//     E.g. a quote of $6/1M with channel ratio 0.6 and model 0.5 bills $1.8/1M.
//   - "price": an absolute final price after every adjustment. For token models
//     it is USD per 1M tokens; for per-request models it is USD per request.
//   - "fixed_base": an absolute base price before the channel-wide ratio.
//     bills the model at 70% of the vendor list price.
const (
	ChannelPriceModeRatio      = "ratio"
	ChannelPriceModePrice      = "price"
	ChannelPriceModeMultiplier = "multiplier"
	ChannelPriceModeFixedBase  = "fixed_base"
	ChannelPriceModeFixedFinal = "fixed_final"
)

// ChannelModelRule is a per-model override inside a channel.
type ChannelModelRule struct {
	Mode  string  `json:"mode"`
	Value float64 `json:"value"`
}

// ChannelPriceConfig is the override attached to one channel. Ratio is a
// channel-wide multiplier used when the model has no own rule.
type ChannelPriceConfig struct {
	Enabled bool                        `json:"enabled"`
	Ratio   *float64                    `json:"ratio"`
	Models  map[string]ChannelModelRule `json:"models"`
}

// ChannelPriceSetting is the persisted shape of the ChannelPriceSetting option.
type ChannelPriceSetting struct {
	Enabled  bool                          `json:"enabled"`
	Channels map[string]ChannelPriceConfig `json:"channels"`
}

var channelPriceCache parsedSetting[ChannelPriceSetting]

// GetChannelPriceSetting returns the decoded channel pricing config, or nil
// when unset / invalid. Treat the result as read-only.
func GetChannelPriceSetting() *ChannelPriceSetting {
	return channelPriceCache.get(ChannelPriceOptionKey)
}

// ChannelPricingEnabled reports whether channel pricing affects billing.
func ChannelPricingEnabled() bool {
	setting := GetChannelPriceSetting()
	return setting != nil && setting.Enabled && len(setting.Channels) > 0
}

// GetChannelConfig returns one channel's override; ok is false when the channel
// has none (or is disabled).
func GetChannelConfig(channelId int) (ChannelPriceConfig, bool) {
	setting := GetChannelPriceSetting()
	if setting == nil || !setting.Enabled || channelId <= 0 {
		return ChannelPriceConfig{}, false
	}
	cfg, ok := setting.Channels[strconv.Itoa(channelId)]
	if !ok || !cfg.Enabled {
		return ChannelPriceConfig{}, false
	}
	return cfg, true
}

// ChargeContext describes one charge for multiplier resolution.
type ChargeContext struct {
	ChannelId  int
	UserId     int
	ModelName  string
	BaseRatio  float64 // pre-group model ratio, or per-request price when UsePrice
	UsePrice   bool
	MonthlyUSD float64 // user's consumed amount so far this month, platform USD
}

// EffectiveMultiplier folds channel pricing and user-tier pricing into a single
// multiplier for one charge, so every billing path can apply them consistently.
// Returns 1 and false when neither feature is configured for this charge.
func EffectiveMultiplier(charge ChargeContext) (float64, bool) {
	multiplier := 1.0
	applied := false
	if channelMultiplier, ok := ChannelModelMultiplier(
		charge.ChannelId, charge.ModelName, charge.BaseRatio, charge.UsePrice,
	); ok {
		multiplier *= channelMultiplier
		applied = true
	}
	if UserPricingEnabled() {
		if tierMultiplier, ok := UserTierRatio(charge.MonthlyUSD); ok {
			multiplier *= tierMultiplier
			applied = true
		}
	}
	return multiplier, applied
}

// ChannelModelMultiplier resolves the extra multiplier contributed by channel
// pricing for (channel, model). Callers fold it into the group ratio, so a
// returned value of 1 means "no change".
//
// baseRatio is the model's *pre-group* ratio (model_ratio for token models,
// model_price for per-request models). It is the platform base that a synced
// quote normalizes and an absolute price divides.
// usePrice tells us how to read prices: per-request values are already USD per
// request, while token models satisfy USD/1M = ratio * 2.
//
// ok is false when no override applies.
func ChannelModelMultiplier(
	channelId int,
	modelName string,
	baseRatio float64,
	usePrice bool,
) (float64, bool) {
	cfg, ok := GetChannelConfig(channelId)
	if !ok {
		return 1, false
	}
	baseAmount := baseRatio
	if !usePrice {
		baseAmount = baseRatio * 2
	}
	channelFactor := 1.0
	hasChannelFactor := cfg.Ratio != nil && *cfg.Ratio >= 0
	if hasChannelFactor {
		channelFactor = *cfg.Ratio
	}
	factor := channelFactor
	if rule, ok := cfg.Models[modelName]; ok {
		switch rule.Mode {
		case ChannelPriceModeMultiplier, ChannelPriceModeRatio:
			if rule.Value >= 0 {
				return validChannelFactor(factor*rule.Value, channelId, modelName)
			}
		case ChannelPriceModePrice, ChannelPriceModeFixedFinal:
			if rule.Value >= 0 && baseAmount > 0 {
				return validChannelFactor(rule.Value/baseAmount, channelId, modelName)
			}
		case ChannelPriceModeFixedBase:
			if rule.Value >= 0 && baseAmount > 0 {
				return validChannelFactor(rule.Value*channelFactor/baseAmount, channelId, modelName)
			}
		}
	}
	if !hasChannelFactor {
		return 1, false
	}
	return validChannelFactor(factor, channelId, modelName)
}

// validChannelFactor rejects factors that would turn a multiplier into a
// credit or an overflow. Returning "not applied" keeps the base price instead
// of silently giving the request away.
func validChannelFactor(value float64, channelId int, modelName string) (float64, bool) {
	if math.IsNaN(value) || math.IsInf(value, 0) || value < 0 {
		common.SysError(fmt.Sprintf(
			"channel pricing produced an invalid multiplier %.6g for channel %d model %q",
			value, channelId, modelName,
		))
		return 1, false
	}
	return value, true
}
