package custom_pricing

import (
	"sort"
)

// UserPriceTier maps a monthly consumption range onto a billing multiplier.
// MaxAmount nil (or absent) means "unbounded above". Ranges are half-open:
// a request matches when MinAmount <= amount < MaxAmount.
type UserPriceTier struct {
	MinAmount float64  `json:"min_amount"`
	MaxAmount *float64 `json:"max_amount"`
	Ratio     float64  `json:"ratio"`
	Label     string   `json:"label,omitempty"`
}

// UserPriceSetting is the persisted shape of the UserPriceSetting option.
type UserPriceSetting struct {
	Enabled bool            `json:"enabled"`
	Tiers   []UserPriceTier `json:"tiers"`
}

var userPriceCache parsedSetting[UserPriceSetting]

// GetUserPriceSetting returns the decoded user pricing config, or nil when
// unset / invalid. Treat the result as read-only.
func GetUserPriceSetting() *UserPriceSetting {
	return userPriceCache.get(UserPriceOptionKey)
}

// UserPricingEnabled reports whether user-tier pricing affects billing.
func UserPricingEnabled() bool {
	setting := GetUserPriceSetting()
	return setting != nil && setting.Enabled && len(setting.Tiers) > 0
}

// UserTierRatio resolves the multiplier for a user's current monthly spend
// (expressed in quota units converted to USD). ok is false when user pricing is
// disabled or no tier covers the amount, meaning "no change".
func UserTierRatio(monthlyAmountUSD float64) (float64, bool) {
	setting := GetUserPriceSetting()
	if setting == nil || !setting.Enabled {
		return 1, false
	}
	tiers := make([]UserPriceTier, len(setting.Tiers))
	copy(tiers, setting.Tiers)
	sort.SliceStable(tiers, func(i, j int) bool {
		return tiers[i].MinAmount < tiers[j].MinAmount
	})
	for _, tier := range tiers {
		if monthlyAmountUSD < tier.MinAmount {
			continue
		}
		if tier.MaxAmount != nil && monthlyAmountUSD >= *tier.MaxAmount {
			continue
		}
		if tier.Ratio < 0 {
			continue
		}
		return tier.Ratio, true
	}
	return 1, false
}
