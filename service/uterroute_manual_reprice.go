package service

import (
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

// UpsertUterRouteChannelPricingAndReprice persists one channel's isolated
// UterRoute pricing rows and immediately flows any official/channel price
// change through to the sale price using the channel's configured rule.
//
// The manual panel sync must use this instead of a bare
// model.UpsertChannelOfficialPricing: writing new prices without repricing
// leaves the sale price stale, and the next scheduled sync sees
// before == after so it can never detect the change that just happened.
// Hand-edited prices are never overwritten (repriceChangedChannel keeps
// OverwriteManual false), and the call is a no-op without a configured rule.
func UpsertUterRouteChannelPricingAndReprice(
	channelID int,
	servedModels []string,
	records []model.ChannelOfficialPricingRecord,
) (written int, repriced int, err error) {
	before := channelOfficialPriceSnapshot(channelID)
	written, err = model.UpsertChannelOfficialPricing(records)
	if err != nil {
		return written, 0, err
	}
	after := channelOfficialPriceSnapshot(channelID)
	changed := channelOfficialPriceChanged(before, after, servedModels)
	schedule, _ := GetChannelPricingSchedule(channelID)
	repriced = repriceChangedChannel(channelID, changed, schedule)
	AutoVerifyChannelPricing(channelID)
	RecordChannelSyncOutcome(channelID, "uterroute", common.GetTimestamp(), len(records), written, repriced, 0, "", nil, model.ChannelSyncTypePrices)
	return written, repriced, nil
}
