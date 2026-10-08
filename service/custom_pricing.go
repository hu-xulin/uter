package service

import (
	"github.com/uter-ai/uter/model"

	"github.com/uter-ai/uter/setting/custom_pricing"
)

// monthToDateUSD resolves a user's month-to-date spend for 用户定价. The log
// query only runs while that feature is enabled, so disabled deployments never
// pay for it.
func monthToDateUSD(userId int) float64 {
	if !custom_pricing.UserPricingEnabled() || userId <= 0 {
		return 0
	}
	return model.GetUserMonthConsumedUSD(userId)
}

// customPricingMultiplier folds 渠道定价 and 用户定价 into one multiplier so
// secondary billing paths (realtime consumption, async task re-billing) charge
// exactly what the primary pre-consume path charged.
func customPricingMultiplier(charge custom_pricing.ChargeContext) float64 {
	multiplier, applied := custom_pricing.EffectiveMultiplier(charge)
	if !applied {
		return 1
	}
	return multiplier
}
