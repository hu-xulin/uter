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
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// 快照结算状态。一旦进入 settled / refunded，快照即成为财务凭证，
// 任何自动路径都不得再改写金额或状态。
const (
	BillingSnapshotStatusPending      = "pending"
	BillingSnapshotStatusSettled      = "settled"
	BillingSnapshotStatusRefunded     = "refunded"
	BillingSnapshotStatusSettleFailed = "settle_failed"
)

// ErrBillingSnapshotSettlementConflict 表示本次更新与快照当前状态冲突。
// 调用方必须把它当作「这笔钱已经收口，不得再次改动」，而不是重试。
var ErrBillingSnapshotSettlementConflict = errors.New("billing price snapshot settlement state does not allow this transition")

// billingSnapshotSettlementSources 返回目标状态允许的来源状态。
// 空串代表历史写入或插入时未填写（等价于 pending）；NULL 由 SQL 条件单独覆盖。
func billingSnapshotSettlementSources(target string) ([]string, bool) {
	switch target {
	case BillingSnapshotStatusPending:
		return []string{"", BillingSnapshotStatusPending}, true
	case BillingSnapshotStatusSettled:
		return []string{"", BillingSnapshotStatusPending, BillingSnapshotStatusSettleFailed}, true
	case BillingSnapshotStatusRefunded:
		return []string{"", BillingSnapshotStatusPending, BillingSnapshotStatusSettleFailed}, true
	case BillingSnapshotStatusSettleFailed:
		return []string{"", BillingSnapshotStatusPending}, true
	default:
		return nil, false
	}
}

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
	UserId          int    `gorm:"index"`
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
	// PurchaseContract freezes the per-dimension contract cost next to the sale
	// contract, so the cost breakdown never depends on the current channel row.
	PurchaseContract     string `gorm:"type:text"`
	PurchaseContractHash string `gorm:"size:64"`
	PriceSource          string `gorm:"size:128"`
	PurchaseUSD          *float64
	PurchaseVerified     bool
	PurchaseSource       string `gorm:"size:128"`
	GroupRatio           float64
	UserPricingRatio     float64
	Currency             string `gorm:"size:16"`
	FXRate               float64
	// QuotaPerUnit freezes the quota-to-USD conversion used when the money
	// ledger is booked, so a later platform setting cannot re-value history.
	QuotaPerUnit     float64
	UsageBreakdown   string `gorm:"type:text"`
	PreConsumedQuota int64
	SettledQuota     int64
	RefundQuota      int64
	SettleStatus     string `gorm:"size:32"`
	CreatedAt        int64  `gorm:"index"`
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
// existing snapshot.
//
// 状态机与 CAS 同一条 SQL：只有来源状态在允许集合内的行才会被更新，因此并发
// 回调最多一个能成功；settled / refunded 是终态，refunded 之后迟到的成功回调
// 无法把凭证改回 settled。重复的同状态回调只在金额完全一致时视为幂等成功。
func UpdateBillingPriceSnapshotSettlement(requestId, taskId, modelName string, patch SettlementPatch) error {
	if DB == nil || modelName == "" {
		return nil
	}
	status := patch.Status
	if status == "" {
		status = BillingSnapshotStatusPending
	}
	allowedFrom, ok := billingSnapshotSettlementSources(status)
	if !ok {
		return fmt.Errorf("%w: unknown target status %q (request=%s task=%s model=%s)", ErrBillingSnapshotSettlementConflict, status, requestId, taskId, modelName)
	}

	updates := map[string]any{
		"pre_consumed_quota": patch.PreConsumed,
		"settled_quota":      patch.Settled,
		"refund_quota":       patch.Refund,
		"settle_status":      status,
	}
	// A task without metered facts must not blank the usage captured at
	// contract time.
	if patch.UsageBreakdown != "" {
		updates["usage_breakdown"] = patch.UsageBreakdown
	}

	result := DB.Model(&BillingPriceSnapshot{}).
		Where("request_id = ? AND task_id = ? AND model_name = ?", requestId, taskId, modelName).
		Where("(settle_status IS NULL OR settle_status IN ?)", allowedFrom).
		Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 1 {
		return nil
	}

	var current BillingPriceSnapshot
	err := DB.Where("request_id = ? AND task_id = ? AND model_name = ?", requestId, taskId, modelName).First(&current).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// 没有凭证可补全（历史请求或未落快照的数据），保持原有静默语义。
		return nil
	}
	if err != nil {
		return err
	}
	if current.SettleStatus == status &&
		current.PreConsumedQuota == patch.PreConsumed &&
		current.SettledQuota == patch.Settled &&
		current.RefundQuota == patch.Refund {
		return nil
	}
	return fmt.Errorf("%w: request=%s task=%s model=%s status=%q refuses to move to %q",
		ErrBillingSnapshotSettlementConflict, requestId, taskId, modelName, current.SettleStatus, status)
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

// GetBillingPriceSnapshotByRequest finds the latest voucher for one request id
// without requiring the task id, so a supplier invoice line can be matched to
// either a synchronous request or an async task.
func GetBillingPriceSnapshotByRequest(requestId, modelName string) (*BillingPriceSnapshot, error) {
	var snapshot BillingPriceSnapshot
	query := DB.Where("request_id = ?", requestId)
	if modelName != "" {
		query = query.Where("model_name = ?", modelName)
	}
	err := query.Order("id desc").First(&snapshot).Error
	if err != nil {
		return nil, err
	}
	return &snapshot, nil
}
