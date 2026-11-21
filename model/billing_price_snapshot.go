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
package model

import (
	"time"

	"gorm.io/gorm/clause"
)

// BillingPriceSnapshot is the immutable price contract one request or task was
// billed with. It is written once per identity and never updated, so a later
// price change cannot rewrite history. RequestId and TaskId are separate
// scopes: a synchronous request has only a request id, an async task has both
// and keeps the creation-time price for its final settlement.
type BillingPriceSnapshot struct {
	Id        int64  `gorm:"primaryKey;autoIncrement"`
	RequestId string `gorm:"size:64;uniqueIndex:idx_billing_snapshot_identity,priority:1"`
	TaskId    string `gorm:"size:64;uniqueIndex:idx_billing_snapshot_identity,priority:2;index:idx_billing_snapshot_task"`
	ModelName string `gorm:"size:255;uniqueIndex:idx_billing_snapshot_identity,priority:3"`

	ChannelId       int    `gorm:"index"`
	Provider        string `gorm:"size:64"`
	Region          string `gorm:"size:64"`
	DeploymentId    string `gorm:"size:128"`
	PricingVersion  string `gorm:"size:64"`
	PurchaseVersion string `gorm:"size:64"`

	BillingMode           string `gorm:"size:32"`
	BillingExpression     string `gorm:"type:text"`
	BillingExpressionHash string `gorm:"size:64"`
	// PriceContract is the resolved sale contract (every dimension, tier,
	// discount and source) captured at billing time. Sold unit prices are
	// derivable from it; BillingExpression is the executable normal form.
	PriceContract     string `gorm:"type:text"`
	PriceContractHash string `gorm:"size:64"`
	PriceSource       string `gorm:"size:128"`
	PurchaseUSD       *float64
	PurchaseVerified  bool
	PurchaseSource    string `gorm:"size:128"`
	GroupRatio        float64
	UserPricingRatio  float64
	Currency          string `gorm:"size:16"`
	FXRate            float64
	UsageBreakdown    string `gorm:"type:text"`
	PreConsumedQuota  int64
	SettledQuota      int64
	RefundQuota       int64
	SettleStatus      string `gorm:"size:32"`
	CreatedAt         int64  `gorm:"index"`
}

func (BillingPriceSnapshot) TableName() string { return "billing_price_snapshots" }

// SaveBillingPriceSnapshot inserts one snapshot. A duplicate identity (retry,
// duplicate callback) is ignored so the first record stays authoritative.
func SaveBillingPriceSnapshot(snapshot BillingPriceSnapshot) error {
	if DB == nil || snapshot.ModelName == "" {
		return nil
	}
	if snapshot.CreatedAt == 0 {
		snapshot.CreatedAt = time.Now().Unix()
	}
	return DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&snapshot).Error
}

// SettlementPatch carries the values that only become known when the request
// settles. It never touches the contract columns, so the sold price stays
// immutable while the voucher still records what actually hit the wallet.
type SettlementPatch struct {
	UsageBreakdown string
	PreConsumed    int64
	Settled        int64
	Refund         int64
	Status         string
}

// UpdateBillingPriceSnapshotSettlement fills in the settlement half of an
// existing snapshot. It is idempotent and refuses to overwrite a settled row.
func UpdateBillingPriceSnapshotSettlement(requestId, taskId, modelName string, patch SettlementPatch) error {
	if DB == nil || modelName == "" {
		return nil
	}
	updates := map[string]any{
		"pre_consumed_quota": patch.PreConsumed,
		"settled_quota":      patch.Settled,
		"refund_quota":       patch.Refund,
		"settle_status":      patch.Status,
	}
	// A task without metered facts must not blank the usage captured at
	// contract time.
	if patch.UsageBreakdown != "" {
		updates["usage_breakdown"] = patch.UsageBreakdown
	}
	return DB.Model(&BillingPriceSnapshot{}).
		Where("request_id = ? AND task_id = ? AND model_name = ? AND (settle_status IS NULL OR settle_status <> ?)", requestId, taskId, modelName, "settled").
		Updates(updates).Error
}

// GetBillingPriceSnapshot looks up the snapshot for one request or task.
func GetBillingPriceSnapshot(requestId, taskId, modelName string) (*BillingPriceSnapshot, error) {
	var snapshot BillingPriceSnapshot
	err := DB.Where("request_id = ? AND task_id = ? AND model_name = ?", requestId, taskId, modelName).
		First(&snapshot).Error
	if err != nil {
		return nil, err
	}
	return &snapshot, nil
}

// ListBillingPriceSnapshots returns recent snapshots for one channel, for
// admin reconciliation and support.
func ListBillingPriceSnapshots(channelId, limit int) ([]BillingPriceSnapshot, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	var rows []BillingPriceSnapshot
	err := DB.Where("channel_id = ?", channelId).Order("id desc").Limit(limit).Find(&rows).Error
	return rows, err
}
