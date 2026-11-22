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
	recordBillingPriceSnapshot(info, taskIDForLog(info), other)
}

// RecordBillingPriceSnapshotForTask records a task contract with the durable
// task id after insertion. Task retries re-price on every attempt, so the
// snapshot must be written by the successful attempt only.
func RecordBillingPriceSnapshotForTask(info *relaycommon.RelayInfo, taskID string, other *model.LogOther) {
	recordBillingPriceSnapshot(info, taskID, other)
}

func recordBillingPriceSnapshot(info *relaycommon.RelayInfo, taskID string, other *model.LogOther) {
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
	modelName := info.GetBillingModelName()
	if modelName == "" {
		modelName = info.OriginModelName
	}
	if modelName == "" {
		return
	}
	// 纯倍率任务没有渠道合同或表达式，但仍需要一份可审计凭证：冻结当时
	// 的倍率组合，结算与退款才能对应到具体金额。同步请求保持原门槛；
	// 没有任何计价依据的任务（例如零价插件任务）不写无意义的凭证。
	if !info.ChannelPricingApplied && exprString == "" {
		if taskID == "" {
			return
		}
		if info.PriceData.ModelRatio <= 0 && info.PriceData.ModelPrice <= 0 && !info.PriceData.UsePrice {
			return
		}
	}
	usage := billingSnapshotUsage(info)
	contract := strings.TrimSpace(info.ChannelPricingContractJSON)
	if contract == "" && taskID != "" {
		mode = ratioBillingMode(info)
		if encoded, err := common.Marshal(ratioBillingContractFor(info)); err == nil {
			contract = string(encoded)
		}
	}
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
	status := model.BillingSnapshotStatusPending
	if info.SettlementRecorded {
		settled = info.SettledQuota
		if preConsumed > settled {
			refund = preConsumed - settled
		}
		status = model.BillingSnapshotStatusSettled
		if info.SettlementFailed {
			status = model.BillingSnapshotStatusSettleFailed
		}
	}
	purchaseContract := strings.TrimSpace(info.ChannelPricingPurchaseContract)
	purchaseContractHash := ""
	if purchaseContract != "" {
		sum := sha256.Sum256([]byte(purchaseContract))
		purchaseContractHash = hex.EncodeToString(sum[:])
	}
	row := model.BillingPriceSnapshot{
		RequestId:             info.RequestId,
		TaskId:                taskID,
		ModelName:             modelName,
		ChannelId:             info.GetChannelID(),
		UserId:                info.UserId,
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
		PurchaseContract:      purchaseContract,
		PurchaseContractHash:  purchaseContractHash,
		PriceSource:           priceSource,
		PurchaseUSD:           info.ChannelPricingPurchaseUSD,
		PurchaseVerified:      info.ChannelPricingPurchaseVerified,
		PurchaseSource:        info.ChannelPricingPurchaseSource,
		GroupRatio:            info.PriceData.GroupRatioInfo.GroupRatio,
		UserPricingRatio:      info.UserPricingRatio,
		Currency:              info.ChannelPricingCurrency,
		FXRate:                info.ChannelPricingFXRate,
		QuotaPerUnit:          common.QuotaPerUnit,
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
		return
	}
	recordRequestFinancials(&row, usage, settled, refund)
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
	if info == nil || info.TaskRelayInfo == nil {
		return ""
	}
	if info.TaskRelayInfo.PublicTaskID != "" {
		return info.TaskRelayInfo.PublicTaskID
	}
	return info.TaskRelayInfo.OriginTaskID
}

// ratioBillingMode names a task voucher that bills by global model ratios.
func ratioBillingMode(info *relaycommon.RelayInfo) string {
	if info != nil && info.PriceData.UsePrice {
		return "fixed_price"
	}
	return "ratio"
}

// ratioBillingContract freezes the multiplier set a ratio-mode task was priced
// with. Sold per-token prices are derivable from it; no purchase contract
// exists for global models, so the ledger marks their profit as pending.
func ratioBillingContractFor(info *relaycommon.RelayInfo) any {
	price := info.PriceData
	return struct {
		Mode                 string  `json:"mode"`
		ModelRatio           float64 `json:"model_ratio"`
		ModelPrice           float64 `json:"model_price,omitempty"`
		CompletionRatio      float64 `json:"completion_ratio"`
		CacheRatio           float64 `json:"cache_ratio"`
		CacheCreationRatio   float64 `json:"cache_creation_ratio"`
		ImageRatio           float64 `json:"image_ratio"`
		AudioRatio           float64 `json:"audio_ratio"`
		AudioCompletionRatio float64 `json:"audio_completion_ratio"`
		GroupRatio           float64 `json:"group_ratio"`
		UserPricingRatio     float64 `json:"user_pricing_ratio,omitempty"`
		UsePrice             bool    `json:"use_price,omitempty"`
	}{
		Mode:                 ratioBillingMode(info),
		ModelRatio:           price.ModelRatio,
		ModelPrice:           price.ModelPrice,
		CompletionRatio:      price.CompletionRatio,
		CacheRatio:           price.CacheRatio,
		CacheCreationRatio:   price.CacheCreationRatio,
		ImageRatio:           price.ImageRatio,
		AudioRatio:           price.AudioRatio,
		AudioCompletionRatio: price.AudioCompletionRatio,
		GroupRatio:           price.GroupRatioInfo.GroupRatio,
		UserPricingRatio:     info.UserPricingRatio,
		UsePrice:             price.UsePrice,
	}
}
