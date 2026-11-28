package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

const (
	ChannelPricingAutoVerifyPrefix     = "ChannelPricingAutoVerify:"
	ChannelPricingCatalogVerifyPrefix  = "ChannelPricingCatalogVerify:"
	channelPricingCatalogVerifyTimeout = 20 * time.Second
)

// AutoVerifyChannelPricing runs the deterministic price-contract check after a
// sync and persists the report, so verification needs no operator click. A
// failed rule is surfaced as a system error; the review gate already prevents
// an automatic price from billing.
func AutoVerifyChannelPricing(channelID int) {
	AutoVerifyChannelPricingWithContext(context.Background(), channelID)
}

// AutoVerifyChannelPricingWithContext is the context-aware form used by
// Uter.api operations. An operation-scoped Uter.api cache in ctx is reused by
// catalog parity so the sync and its verification inspect one snapshot.
func AutoVerifyChannelPricingWithContext(ctx context.Context, channelID int) {
	if channelID <= 0 {
		return
	}
	if ctx == nil {
		ctx = context.Background()
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
	autoVerifyChannelCatalogWithContext(ctx, channelID)
}

// autoVerifyChannelCatalog compares the provider's complete catalog with Uter's
// rows after each successful sync and persists the result for audit. A provider
// without a catalog adapter records no completeness claim.
func autoVerifyChannelCatalog(channelID int) {
	autoVerifyChannelCatalogWithContext(context.Background(), channelID)
}

func autoVerifyChannelCatalogWithContext(ctx context.Context, channelID int) {
	if ctx == nil {
		ctx = context.Background()
	}
	channel, err := model.GetChannelById(channelID, true)
	if err != nil || channel == nil {
		return
	}
	baseURL := ""
	if channel.BaseURL != nil {
		baseURL = strings.TrimSpace(*channel.BaseURL)
	}
	provider := UpstreamProviderForChannel(channel.Type, baseURL)
	apiKey := ""
	if key, _, keyErr := channel.GetNextEnabledKey(); keyErr == nil {
		apiKey = strings.TrimSpace(key)
	}
	ctx, cancel := context.WithTimeout(ctx, channelPricingCatalogVerifyTimeout)
	defer cancel()
	models, catalogErr := FetchUpstreamModelNames(ctx, provider.ID, UpstreamFetchConfig{
		BaseURL: baseURL, APIKey: apiKey, ChannelID: channelID,
	})
	// Uter.api group keys see a subset of the account-wide pricing document.
	// Completeness must be measured against that authorized subset, otherwise
	// every other group's model is falsely reported as MODEL_MISSING.
	if provider.ID == "uterapi" {
		group := GetGenericUpstreamBillingGroup(channelID)
		if group == "" {
			return
		}
		models, catalogErr = DiscoverAuthorizedUterAPIModels(ctx, baseURL, group, enabledUterAPIKeys(channel))
	}
	if catalogErr != nil {
		return
	}
	rows, err := model.ListChannelModelPricing(channelID)
	if err != nil {
		return
	}
	// Uter.api redirected channels store price rows under request aliases while
	// the authorization catalogue uses upstream names. Compare both on the
	// upstream identity so aliases are not misread as missing models.
	if provider.ID == "uterapi" {
		var mapping map[string]string
		if raw := strings.TrimSpace(channel.GetModelMapping()); raw != "" {
			_ = common.UnmarshalJsonStr(raw, &mapping)
		}
		parityRows := make([]model.ChannelModelPricing, len(rows))
		copy(parityRows, rows)
		for i := range parityRows {
			if resolved, cyclic := followUterRouteModelMapping(mapping, parityRows[i].ModelName); !cyclic && resolved != "" {
				parityRows[i].ModelName = resolved
			}
		}
		rows = parityRows
	}
	parity := BuildUpstreamParityReportWithCatalog(channelID, channel.Name, rows, models, time.Now().UTC())
	encoded, err := common.Marshal(parity)
	if err != nil {
		return
	}
	key := ChannelPricingCatalogVerifyPrefix + fmt.Sprintf("%d", channelID)
	if err := model.UpdateOption(key, string(encoded)); err != nil {
		common.SysError(common.LogText("persist catalog verify channel %d failed: %s", channelID, err.Error()))
		return
	}
	if missing := parity.Summary[UpstreamParityModelMissing]; missing > 0 {
		common.SysError(common.LogText(
			"auto verify channel %d catalog has %d upstream model(s) without Uter pricing rows",
			channelID, missing,
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
