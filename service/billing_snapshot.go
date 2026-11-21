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
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	relaycommon "github.com/uter-ai/uter/relay/common"
)

// RecordBillingPriceSnapshot persists the immutable price contract for one
// request or task. It never blocks billing: a failure is logged, and the
// consume log still carries the same version fields.
func RecordBillingPriceSnapshot(info *relaycommon.RelayInfo) {
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
	groupRatio := info.PriceData.GroupRatioInfo.GroupRatio
	usage := ""
	if snapshot := info.TieredBillingSnapshot; snapshot != nil && len(snapshot.UsageFacts) > 0 {
		if encoded, err := common.Marshal(snapshot.UsageFacts); err == nil {
			usage = string(encoded)
		}
	}
	err := model.SaveBillingPriceSnapshot(model.BillingPriceSnapshot{
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
		GroupRatio:            groupRatio,
		UserPricingRatio:      info.UserPricingRatio,
		Currency:              info.ChannelPricingCurrency,
		FXRate:                info.ChannelPricingFXRate,
		UsageBreakdown:        usage,
	})
	if err != nil {
		common.SysError(common.LogText("save billing price snapshot failed: %s", err.Error()))
	}
}
