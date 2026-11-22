package service

import (
	"fmt"
	"strings"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

const ChannelPricingAutoVerifyPrefix = "ChannelPricingAutoVerify:"

// AutoVerifyChannelPricing runs the deterministic price-contract check after a
// sync and persists the report, so verification needs no operator click. A
// failed rule is surfaced as a system error; the review gate already prevents
// an automatic price from billing.
func AutoVerifyChannelPricing(channelID int) {
	if channelID <= 0 {
		return
	}
	report, err := ReconcileChannelUpstreamBilling(channelID)
	if err != nil {
		common.SysError(common.LogText("auto verify channel %d pricing failed: %s", channelID, err.Error()))
		return
	}
	encoded, err := common.Marshal(report)
	if err != nil {
		return
	}
	if err := model.UpdateOption(ChannelPricingAutoVerifyPrefix+fmt.Sprintf("%d", channelID), string(encoded)); err != nil {
		common.SysError(common.LogText("persist auto verify channel %d failed: %s", channelID, err.Error()))
	}
	if report.Status != UpstreamReconcileRulesPassed {
		common.SysError(common.LogText(
			"auto verify channel %d pricing status=%s failed_rules=%d",
			channelID, report.Status, report.Summary[UpstreamReconcileRuleFailed],
		))
	}
}

// AppendChannelModelNames adds newly discovered upstream models to a channel
// without dropping or reordering existing entries. Deletions stay lifecycle
// driven, so an upstream outage cannot remove a served model automatically.
func AppendChannelModelNames(channel *model.Channel, names []string) (int, error) {
	if channel == nil || len(names) == 0 {
		return 0, nil
	}
	added := mergeChannelModelNames(channel.GetModels(), names)
	if len(added) == 0 {
		return 0, nil
	}
	models := append(channel.GetModels(), added...)
	channel.Models = strings.Join(models, ",")
	if err := channel.Update(); err != nil {
		return 0, err
	}
	if err := channel.UpdateAbilities(nil); err != nil {
		common.SysError(common.LogText("update abilities after auto model add failed: channel_id=%d error=%v", channel.Id, err))
	}
	model.BumpSyncTopic(model.SyncTopicChannels)
	return len(added), nil
}
