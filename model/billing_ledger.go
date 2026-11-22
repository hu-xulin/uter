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

// 财务账本条目类型。Quota 是平台额度，不等于货币金额：销售收入、退款、
// 采购成本分别以 USD 记账，额度变化作为独立字段随条目保留。
const (
	BillingLedgerEntrySale            = "sale"
	BillingLedgerEntryRefund          = "refund"
	BillingLedgerEntryPurchaseCost    = "purchase_cost"
	BillingLedgerEntrySupplierInvoice = "supplier_invoice"
)

const (
	// BillingLedgerStatusVerified 采购成本来自已验证合同。
	BillingLedgerStatusVerified = "verified"
	// BillingLedgerStatusPendingPurchase 采购成本缺失或未验证，毛利待核对。
	BillingLedgerStatusPendingPurchase = "pending_purchase"
	// BillingLedgerStatusRecorded 金额已按明确口径入账。
	BillingLedgerStatusRecorded = "recorded"
)

// BillingCostBreakdown is one metered dimension of the purchase cost behind a
// single request. A request with input, output and cache usage produces three
// rows, so the supplier bill can be reconciled per dimension instead of a
// single blended PurchaseUSD.
type BillingCostBreakdown struct {
	Id        int64  `gorm:"primaryKey;autoIncrement"`
	RequestId string `gorm:"size:64;uniqueIndex:idx_billing_cost_identity,priority:1"`
	TaskId    string `gorm:"size:64;uniqueIndex:idx_billing_cost_identity,priority:2"`
	ModelName string `gorm:"size:255;uniqueIndex:idx_billing_cost_identity,priority:3"`
	Dimension string `gorm:"size:64;uniqueIndex:idx_billing_cost_identity,priority:4"`
	Tier      string `gorm:"size:64;uniqueIndex:idx_billing_cost_identity,priority:5"`
	ChannelId int    `gorm:"index"`

	Quantity     float64
	Unit         string `gorm:"size:32"`
	UnitPriceUSD float64
	AmountUSD    float64
	Currency     string `gorm:"size:16"`
	FXRate       float64

	Source   string `gorm:"size:128"`
	Verified bool
	// Issue explains why a row could not be priced (for example
	// purchase_missing). An empty issue means the row is a usable cost.
	Issue     string `gorm:"size:64"`
	CreatedAt int64  `gorm:"index"`
}

func (BillingCostBreakdown) TableName() string { return "billing_cost_breakdowns" }

// BillingFinancialLedger is the money ledger. It deliberately separates sale
// revenue, user refunds, upstream purchase cost and supplier invoice amounts
// from the platform quota movement so profit is never inferred from quota.
type BillingFinancialLedger struct {
	Id int64 `gorm:"primaryKey;autoIncrement"`
	// EntryKey makes every event idempotent: a retried callback cannot book the
	// same sale or cost twice.
	EntryKey  string `gorm:"size:191;uniqueIndex"`
	EntryType string `gorm:"size:32;index"`

	RequestId string `gorm:"size:64;index"`
	TaskId    string `gorm:"size:64;index"`
	ModelName string `gorm:"size:255"`
	ChannelId int    `gorm:"index"`
	UserId    int    `gorm:"index"`

	// Quota records the platform quota movement behind this entry (sale and
	// refund only). It is an audit trail, not the money amount.
	Quota     int64
	AmountUSD float64
	// OriginalAmount/Currency/FXRate keep the supplier's own currency so a
	// non-USD invoice is never silently treated as USD.
	OriginalAmount float64
	Currency       string `gorm:"size:16"`
	FXRate         float64
	Status         string `gorm:"size:32"`
	Source         string `gorm:"size:128"`
	Reference      string `gorm:"size:128"`
	CreatedAt      int64  `gorm:"index"`
}

func (BillingFinancialLedger) TableName() string { return "billing_financial_ledgers" }

// SaveBillingCostBreakdowns inserts cost rows for one request. Duplicate rows
// (a retried settlement) are ignored so the first record stays authoritative.
func SaveBillingCostBreakdowns(rows []BillingCostBreakdown) error {
	if DB == nil || len(rows) == 0 {
		return nil
	}
	now := time.Now().Unix()
	for i := range rows {
		if rows[i].CreatedAt == 0 {
			rows[i].CreatedAt = now
		}
	}
	return DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&rows).Error
}

// SaveBillingLedgerEntry books one ledger entry. Duplicate entry keys are
// ignored; callers must build the key from the event identity.
func SaveBillingLedgerEntry(entry BillingFinancialLedger) error {
	if DB == nil || entry.EntryKey == "" {
		return nil
	}
	if entry.CreatedAt == 0 {
		entry.CreatedAt = time.Now().Unix()
	}
	return DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&entry).Error
}

func ListBillingCostBreakdowns(requestId, taskId, modelName string) ([]BillingCostBreakdown, error) {
	var rows []BillingCostBreakdown
	err := DB.Where("request_id = ? AND task_id = ? AND model_name = ?", requestId, taskId, modelName).
		Order("id asc").Find(&rows).Error
	return rows, err
}

func ListBillingLedgerEntries(requestId, taskId, modelName string) ([]BillingFinancialLedger, error) {
	var rows []BillingFinancialLedger
	err := DB.Where("request_id = ? AND task_id = ? AND model_name = ?", requestId, taskId, modelName).
		Order("id asc").Find(&rows).Error
	return rows, err
}

// BillingFinancialSummary is the profit view of one request or task. Quota is
// not money, so sale revenue and cost are expressed in USD; the cost may still
// be unverified, in which case the profit is reported as pending.
type BillingFinancialSummary struct {
	SaleUSD          float64
	RefundUSD        float64
	CostUSD          float64
	GrossProfitUSD   float64
	CostVerified     bool
	GrossProfitState string
}

// SummarizeBillingFinancials derives profit from ledger entries. It never
// treats an unverified purchase cost as known profit.
func SummarizeBillingFinancials(requestId, taskId, modelName string) (BillingFinancialSummary, error) {
	var summary BillingFinancialSummary
	entries, err := ListBillingLedgerEntries(requestId, taskId, modelName)
	if err != nil {
		return summary, err
	}
	costEntries := 0
	verifiedCosts := 0
	for _, entry := range entries {
		switch entry.EntryType {
		case BillingLedgerEntrySale:
			summary.SaleUSD += entry.AmountUSD
		case BillingLedgerEntryRefund:
			summary.RefundUSD += -entry.AmountUSD
		case BillingLedgerEntryPurchaseCost:
			costEntries++
			summary.CostUSD += entry.AmountUSD
			if entry.Status == BillingLedgerStatusVerified {
				verifiedCosts++
			}
		}
	}
	summary.GrossProfitUSD = summary.SaleUSD - summary.RefundUSD - summary.CostUSD
	summary.CostVerified = costEntries > 0 && verifiedCosts == costEntries
	if summary.CostVerified {
		summary.GrossProfitState = BillingLedgerStatusVerified
	} else {
		summary.GrossProfitState = BillingLedgerStatusPendingPurchase
	}
	return summary, nil
}

// ListBillingCostBreakdownsByRequest returns the cost rows of one request
// regardless of task id, for supplier invoice line matching.
func ListBillingCostBreakdownsByRequest(requestId, modelName string) ([]BillingCostBreakdown, error) {
	var rows []BillingCostBreakdown
	query := DB.Where("request_id = ?", requestId)
	if modelName != "" {
		query = query.Where("model_name = ?", modelName)
	}
	err := query.Order("id asc").Find(&rows).Error
	return rows, err
}
