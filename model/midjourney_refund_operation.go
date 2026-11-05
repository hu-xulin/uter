package model

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/uter-ai/uter/common"
	"gorm.io/gorm"
)

const (
	MidjourneyRefundOperationTypeFull      = "full"
	MidjourneyRefundPending                = "pending"
	MidjourneyRefundCompleted              = "completed"
	MidjourneyRefundReconciliationRequired = "reconciliation_required"

	MidjourneyRefundFundingPersonalWallet     = "personal_wallet"
	MidjourneyRefundFundingOrganizationWallet = "organization_wallet"
	MidjourneyRefundFundingSubscription       = "subscription"
	MidjourneyRefundFundingUnknownLegacy      = "unknown_legacy"
)

// MidjourneyRefundOperation stores the immutable applied-leg snapshot and
// idempotency record for one local Midjourney task refund.
type MidjourneyRefundOperation struct {
	ID                  int    `json:"id" gorm:"primaryKey"`
	MidjourneyTaskID    int    `json:"midjourney_task_id" gorm:"not null;uniqueIndex:idx_mj_refund_task_operation,priority:1;index"`
	OperationType       string `json:"operation_type" gorm:"type:varchar(16);not null;default:full;uniqueIndex:idx_mj_refund_task_operation,priority:2"`
	IdempotencyKey      string `json:"idempotency_key" gorm:"type:varchar(96);not null;uniqueIndex"`
	ReasonCode          string `json:"reason_code" gorm:"type:varchar(64);not null"`
	ReasonDetail        string `json:"reason_detail" gorm:"type:varchar(512)"`
	BillingVersion      int    `json:"billing_version" gorm:"not null;default:1"`
	BillingSnapshotJSON string `json:"billing_snapshot_json" gorm:"type:text;not null"`
	FundingSource       string `json:"funding_source" gorm:"type:varchar(32);not null"`
	FundingUserID       int    `json:"funding_user_id" gorm:"not null;default:0"`
	FundingOrgID        int    `json:"funding_org_id" gorm:"not null;default:0"`
	TokenID             int    `json:"token_id" gorm:"not null;default:0"`
	ChannelID           int    `json:"channel_id" gorm:"not null;default:0"`
	WalletAppliedQuota  int    `json:"wallet_applied_quota" gorm:"not null;default:0"`
	TokenAppliedQuota   int    `json:"token_applied_quota" gorm:"not null;default:0"`
	UserUsageApplied    int    `json:"user_usage_applied" gorm:"not null;default:0"`
	ChannelUsageApplied int    `json:"channel_usage_applied" gorm:"not null;default:0"`
	Status              string `json:"status" gorm:"type:varchar(32);not null;default:pending;index"`
	AttemptCount        int    `json:"attempt_count" gorm:"not null;default:0"`
	LastErrorCode       string `json:"last_error_code" gorm:"type:varchar(64)"`
	LastErrorDetail     string `json:"last_error_detail" gorm:"type:varchar(512)"`
	CreatedAt           int64  `json:"created_at" gorm:"bigint;not null;index"`
	UpdatedAt           int64  `json:"updated_at" gorm:"bigint;not null;index"`
	CompletedAt         int64  `json:"completed_at" gorm:"bigint;not null;default:0"`
}

func (MidjourneyRefundOperation) TableName() string {
	return "midjourney_refund_operations"
}

func (op *MidjourneyRefundOperation) BeforeCreate(tx *gorm.DB) error {
	if op == nil {
		return errors.New("midjourney refund operation is nil")
	}
	if op.MidjourneyTaskID <= 0 {
		return errors.New("midjourney refund operation requires a local task ID")
	}
	if op.OperationType == "" {
		op.OperationType = MidjourneyRefundOperationTypeFull
	}
	if op.OperationType != MidjourneyRefundOperationTypeFull {
		return fmt.Errorf("unsupported Midjourney refund operation type %q", op.OperationType)
	}
	if op.IdempotencyKey == "" {
		op.IdempotencyKey = fmt.Sprintf("midjourney:%d:%s", op.MidjourneyTaskID, op.OperationType)
	}
	if op.ReasonCode == "" || op.FundingSource == "" || !json.Valid([]byte(op.BillingSnapshotJSON)) {
		return errors.New("midjourney refund operation requires reason, funding source, and valid billing snapshot JSON")
	}
	switch op.FundingSource {
	case MidjourneyRefundFundingPersonalWallet, MidjourneyRefundFundingOrganizationWallet,
		MidjourneyRefundFundingSubscription, MidjourneyRefundFundingUnknownLegacy:
	default:
		return fmt.Errorf("unsupported Midjourney refund funding source %q", op.FundingSource)
	}
	// GORM applies SQL column defaults after BeforeCreate; initialize here so
	// validation and the persisted snapshot use the same explicit version.
	if op.BillingVersion == 0 {
		op.BillingVersion = 1
	}
	if op.BillingVersion < 0 {
		return errors.New("billing snapshot version must be positive")
	}
	if op.FundingUserID < 0 || op.FundingOrgID < 0 || op.TokenID < 0 || op.ChannelID < 0 {
		return errors.New("Midjourney refund snapshot IDs cannot be negative")
	}
	if op.WalletAppliedQuota < 0 || op.TokenAppliedQuota < 0 || op.UserUsageApplied < 0 || op.ChannelUsageApplied < 0 {
		return errors.New("Midjourney refund applied quota amounts cannot be negative")
	}
	if op.Status == "" {
		op.Status = MidjourneyRefundPending
	}
	if op.Status != MidjourneyRefundPending && op.Status != MidjourneyRefundReconciliationRequired {
		return fmt.Errorf("invalid initial Midjourney refund operation status %q", op.Status)
	}
	now := common.GetTimestamp()
	if op.CreatedAt == 0 {
		op.CreatedAt = now
	}
	if op.UpdatedAt == 0 {
		op.UpdatedAt = now
	}
	return nil
}

// BeforeUpdate prevents rewriting the original billing evidence. Only
// lifecycle/recovery fields may change after the operation is created.
func (op *MidjourneyRefundOperation) BeforeUpdate(tx *gorm.DB) error {
	if tx.Statement.Changed(
		"MidjourneyTaskID", "OperationType", "IdempotencyKey", "ReasonCode",
		"ReasonDetail", "BillingVersion", "BillingSnapshotJSON", "FundingSource",
		"FundingUserID", "FundingOrgID", "TokenID", "ChannelID",
		"WalletAppliedQuota", "TokenAppliedQuota", "UserUsageApplied",
		"ChannelUsageApplied", "CreatedAt",
	) {
		return errors.New("Midjourney refund billing snapshot is immutable")
	}
	return nil
}

func CreateMidjourneyRefundOperationTx(tx *gorm.DB, op *MidjourneyRefundOperation) error {
	if tx == nil {
		return errors.New("midjourney refund operation transaction is nil")
	}
	if op == nil {
		return errors.New("midjourney refund operation is nil")
	}
	return tx.Create(op).Error
}
