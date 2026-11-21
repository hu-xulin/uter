/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
package service

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	relaycommon "github.com/uter-ai/uter/relay/common"
)

// billingSnapshotWriteAttempts bounds the synchronous retries for the
// immutable billing voucher. A missing voucher is an accounting incident, not
// a warning, so a transient database error must not silently leave a charged
// request without its contract.
const billingSnapshotWriteAttempts = 3

// RecordBillingPriceSnapshot persists the immutable price contract and, when
// settlement already happened, the amounts actually charged and refunded.
//
// The contract columns are written once and never updated. Only the
// settlement half may be filled later (async tasks record their contract at
// creation and their usage at settlement). A write failure is retried and,
// if it still fails, surfaced in the consume log's admin scope plus the system
// log so reconciliation can find the request instead of trusting a bill that
// has no voucher behind it.
func RecordBillingPriceSnapshot(info *relaycommon.RelayInfo, other *model.LogOther) {
	if info == nil || model.DB == nil {
		return
	}
	exprString, exprHash, mode := "", "", info.ChannelPricingMode
	if snapshot := info.TieredBillingSnapshot; snapshot != nil {
		exprString = snapshot.ExprString
		exprHash = snapshot.ExprHash
		if mode == "" {
			mode = snapshot.BillingMode
		}
	}
	if !info.ChannelPricingApplied && exprString == "" {
		return
	}
	modelName := info.GetBillingModelName()
	if modelName == "" {
		modelName = info.OriginModelName
	}
	if modelName == "" {
		return
	}
	taskID := ""
	if info.TaskRelayInfo != nil {
		taskID = info.TaskRelayInfo.PublicTaskID
		if taskID == "" {
			taskID = info.TaskRelayInfo.OriginTaskID
		}
	}
	usage := billingSnapshotUsage(info)
	contract := strings.TrimSpace(info.ChannelPricingContractJSON)
	contractHash := ""
	priceSource := ""
	if contract != "" {
		sum := sha256.Sum256([]byte(contract))
		contractHash = hex.EncodeToString(sum[:])
		var parsed model.ChannelInternalPricing
		if common.UnmarshalJsonStr(contract, &parsed) == nil {
			priceSource = parsed.Source
		}
	}
	preConsumed := int64(info.FinalPreConsumedQuota)
	settled := int64(0)
	refund := int64(0)
	status := "pending"
	if info.SettlementRecorded {
		settled = info.SettledQuota
		if preConsumed > settled {
			refund = preConsumed - settled
		}
		status = "settled"
		if info.SettlementFailed {
			status = "settle_failed"
		}
	}
	row := model.BillingPriceSnapshot{
		RequestId:             info.RequestId,
		TaskId:                taskID,
		ModelName:             modelName,
		ChannelId:             info.GetChannelID(),
		Provider:              info.ChannelPricingProvider,
		Region:                info.ChannelPricingRegion,
		DeploymentId:          info.ChannelPricingDeployment,
		PricingVersion:        info.ChannelPricingVersion,
		PurchaseVersion:       info.ChannelPricingPurchaseVersion,
		BillingMode:           mode,
		BillingExpression:     exprString,
		BillingExpressionHash: exprHash,
		PriceContract:         contract,
		PriceContractHash:     contractHash,
		PriceSource:           priceSource,
		PurchaseUSD:           info.ChannelPricingPurchaseUSD,
		PurchaseVerified:      info.ChannelPricingPurchaseVerified,
		PurchaseSource:        info.ChannelPricingPurchaseSource,
		GroupRatio:            info.PriceData.GroupRatioInfo.GroupRatio,
		UserPricingRatio:      info.UserPricingRatio,
		Currency:              info.ChannelPricingCurrency,
		FXRate:                info.ChannelPricingFXRate,
		UsageBreakdown:        usage,
		PreConsumedQuota:      preConsumed,
		SettledQuota:          settled,
		RefundQuota:           refund,
		SettleStatus:          status,
	}
	if err := saveBillingPriceSnapshotWithRetry(row); err != nil {
		markBillingSnapshotError(other, info, err)
		return
	}
	if !info.SettlementRecorded {
		return
	}
	patch := model.SettlementPatch{
		UsageBreakdown: usage,
		PreConsumed:    preConsumed,
		Settled:        settled,
		Refund:         refund,
		Status:         status,
	}
	if err := model.UpdateBillingPriceSnapshotSettlement(info.RequestId, taskID, modelName, patch); err != nil {
		markBillingSnapshotError(other, info, err)
	}
}

// billingSnapshotUsage prefers the settled metered quantities (which cover
// token, cache, image, audio and thinking dimensions) over the pre-consume
// estimate stored on the tiered snapshot.
func billingSnapshotUsage(info *relaycommon.RelayInfo) string {
	if len(info.BillingUsageBreakdown) > 0 {
		if encoded, err := common.Marshal(info.BillingUsageBreakdown); err == nil {
			return string(encoded)
		}
	}
	if snapshot := info.TieredBillingSnapshot; snapshot != nil && len(snapshot.UsageFacts) > 0 {
		if encoded, err := common.Marshal(snapshot.UsageFacts); err == nil {
			return string(encoded)
		}
	}
	return ""
}

func saveBillingPriceSnapshotWithRetry(row model.BillingPriceSnapshot) error {
	var err error
	for attempt := range billingSnapshotWriteAttempts {
		if err = model.SaveBillingPriceSnapshot(row); err == nil {
			return nil
		}
		if attempt < billingSnapshotWriteAttempts-1 {
			time.Sleep(time.Duration(50<<attempt) * time.Millisecond)
		}
	}
	return err
}

// markBillingSnapshotError makes a missing voucher visible on the bill itself
// and in the system log. The request already moved money, so the marker tells
// reconciliation exactly which consume log has no supporting contract.
func markBillingSnapshotError(other *model.LogOther, info *relaycommon.RelayInfo, err error) {
	common.SysError(common.LogText(
		"billing price snapshot missing: request=%s task=%s channel=%d model=%s: %s",
		info.RequestId, taskIDForLog(info), info.GetChannelID(), info.GetBillingModelName(), err.Error()))
	if other != nil {
		other.SetAdmin("billing_snapshot_error", err.Error())
		other.SetAdmin("billing_snapshot_request_id", info.RequestId)
	}
}

func taskIDForLog(info *relaycommon.RelayInfo) string {
	if info.TaskRelayInfo == nil {
		return ""
	}
	if info.TaskRelayInfo.PublicTaskID != "" {
		return info.TaskRelayInfo.PublicTaskID
	}
	return info.TaskRelayInfo.OriginTaskID
}
