package model

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/uter-ai/uter/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrMidjourneyRefundReconciliationRequired = errors.New("Midjourney refund requires billing reconciliation")

func markMidjourneyRefundReconciliationTx(tx *gorm.DB, task *Midjourney, reasonCode, reasonDetail string, snapshot map[string]any) error {
	snapshot["reconciliation_reason"] = reasonDetail
	snapshotJSON, err := json.Marshal(snapshot)
	if err != nil {
		return err
	}
	op := &MidjourneyRefundOperation{
		MidjourneyTaskID:    task.Id,
		OperationType:       MidjourneyRefundOperationTypeFull,
		ReasonCode:          reasonCode,
		ReasonDetail:        reasonDetail,
		BillingVersion:      1,
		BillingSnapshotJSON: string(snapshotJSON),
		FundingSource:       MidjourneyRefundFundingUnknownLegacy,
		FundingUserID:       task.UserId,
		TokenID:             task.TokenId,
		ChannelID:           task.GetBillingChannelId(),
		Status:              MidjourneyRefundReconciliationRequired,
	}
	payload, err := json.Marshal(map[string]any{
		"task_id":     task.Id,
		"mj_id":       task.MjId,
		"reason_code": reasonCode,
		"reason":      reasonDetail,
		"status":      MidjourneyRefundReconciliationRequired,
	})
	if err != nil {
		return err
	}
	event := &MidjourneyRefundOutbox{
		EventKey:       fmt.Sprintf("midjourney:%d:refund-reconciliation", task.Id),
		EventType:      "midjourney.refund.reconciliation_required",
		PayloadVersion: 1,
		PayloadJSON:    string(payload),
	}
	if err := CreateMidjourneyRefundOperationWithOutboxTx(tx, op, event); err != nil {
		return err
	}
	return tx.Model(&Midjourney{}).Where("id = ?", task.Id).
		Update("billing_status", "reconciliation_required").Error
}

// RefundMidjourneyTaskBilling atomically reverses a verifiably applied
// Midjourney charge in the primary database. Legacy or ambiguous billing
// snapshots are recorded for reconciliation and are never auto-refunded.
func RefundMidjourneyTaskBilling(taskID int, reason string) error {
	if taskID <= 0 {
		return errors.New("Midjourney task ID must be positive")
	}

	var (
		userID         int
		tokenID        int
		channelID      int
		tokenKey       string
		quota          int
		applied        bool
		reconciliation bool
	)

	err := DB.Transaction(func(tx *gorm.DB) error {
		var task Midjourney
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&task, taskID).Error; err != nil {
			return err
		}
		if task.Quota < 0 {
			return errors.New("Midjourney task quota cannot be negative")
		}
		if task.Quota == 0 {
			if task.BillingStatus == "refunded" || !task.BillingWalletApplied {
				return nil
			}
			snapshot := map[string]any{
				"billing_version":    task.BillingVersion,
				"billing_status":     task.BillingStatus,
				"wallet_applied":     task.BillingWalletApplied,
				"token_applied":      task.BillingTokenApplied,
				"task_quota":         task.Quota,
				"token_id":           task.TokenId,
				"billing_channel_id": task.GetBillingChannelId(),
			}
			if err := markMidjourneyRefundReconciliationTx(tx, &task, "midjourney_refund_zero_quota_conflict", "task quota is zero while billing snapshot still records an applied wallet charge", snapshot); err != nil {
				return err
			}
			reconciliation = true
			return nil
		}

		var existing MidjourneyRefundOperation
		err := tx.Where("midjourney_task_id = ? AND operation_type = ?", task.Id, MidjourneyRefundOperationTypeFull).
			First(&existing).Error
		if err == nil {
			if existing.Status == MidjourneyRefundCompleted {
				if err := tx.Model(&Midjourney{}).Where("id = ?", task.Id).
					Update("billing_status", "reconciliation_required").Error; err != nil {
					return err
				}
				reconciliation = true
				return nil
			}
			if existing.Status == MidjourneyRefundReconciliationRequired {
				reconciliation = true
				return nil
			}
			return fmt.Errorf("Midjourney refund operation %d is already %s", existing.ID, existing.Status)
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		reasonDetail := reason
		if len(reasonDetail) > 512 {
			reasonDetail = reasonDetail[:512]
		}
		snapshot := map[string]any{
			"billing_version":    task.BillingVersion,
			"billing_status":     task.BillingStatus,
			"wallet_applied":     task.BillingWalletApplied,
			"token_applied":      task.BillingTokenApplied,
			"task_quota":         task.Quota,
			"token_id":           task.TokenId,
			"billing_channel_id": task.GetBillingChannelId(),
		}

		// Do not infer applied legs for pre-snapshot tasks or an interrupted
		// charging attempt. Persist a durable reconciliation marker instead.
		if task.BillingVersion != 1 ||
			(task.BillingStatus != "applied" && task.BillingStatus != "partial") ||
			!task.BillingWalletApplied ||
			task.UserId <= 0 || task.GetBillingChannelId() <= 0 ||
			(task.BillingTokenApplied && task.TokenId <= 0) ||
			(!task.BillingTokenApplied && task.TokenId > 0) {
			if err := markMidjourneyRefundReconciliationTx(tx, &task, "midjourney_billing_snapshot_ambiguous", "billing snapshot is absent, incomplete, or inconsistent", snapshot); err != nil {
				return err
			}
			reconciliation = true
			return nil
		}

		userID = task.UserId
		tokenID = task.TokenId
		channelID = task.GetBillingChannelId()
		quota = task.Quota
		var user User
		if err := tx.Select("id", "used_quota").First(&user, userID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				if markErr := markMidjourneyRefundReconciliationTx(tx, &task, "midjourney_refund_user_missing", "funding user no longer exists", snapshot); markErr != nil {
					return markErr
				}
				reconciliation = true
				return nil
			}
			return err
		}
		var channel Channel
		if err := tx.Select("id", "used_quota").First(&channel, channelID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				if markErr := markMidjourneyRefundReconciliationTx(tx, &task, "midjourney_refund_channel_missing", "billing channel no longer exists", snapshot); markErr != nil {
					return markErr
				}
				reconciliation = true
				return nil
			}
			return err
		}
		if user.UsedQuota < quota || channel.UsedQuota < int64(quota) {
			if err := markMidjourneyRefundReconciliationTx(tx, &task, "midjourney_refund_usage_mismatch", "recorded usage is smaller than the refund reversal", snapshot); err != nil {
				return err
			}
			reconciliation = true
			return nil
		}
		if task.BillingTokenApplied {
			var token Token
			if err := tx.Select("id", "key").First(&token, tokenID).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					if markErr := markMidjourneyRefundReconciliationTx(tx, &task, "midjourney_refund_token_missing", "charged Token no longer exists", snapshot); markErr != nil {
						return markErr
					}
					reconciliation = true
					return nil
				}
				return err
			}
			tokenKey = token.Key
		}

		snapshot["funding_source"] = MidjourneyRefundFundingPersonalWallet
		snapshot["funding_user_id"] = userID
		snapshot["token_applied_quota"] = 0
		if task.BillingTokenApplied {
			snapshot["token_applied_quota"] = quota
		}
		snapshot["user_usage_applied"] = quota
		snapshot["channel_usage_applied"] = quota
		snapshotJSON, marshalErr := json.Marshal(snapshot)
		if marshalErr != nil {
			return marshalErr
		}

		op := &MidjourneyRefundOperation{
			MidjourneyTaskID:    task.Id,
			OperationType:       MidjourneyRefundOperationTypeFull,
			ReasonCode:          "midjourney_task_failure",
			ReasonDetail:        reasonDetail,
			BillingVersion:      1,
			BillingSnapshotJSON: string(snapshotJSON),
			FundingSource:       MidjourneyRefundFundingPersonalWallet,
			FundingUserID:       userID,
			TokenID:             tokenID,
			ChannelID:           channelID,
			WalletAppliedQuota:  quota,
			UserUsageApplied:    quota,
			ChannelUsageApplied: quota,
			Status:              MidjourneyRefundPending,
		}
		if task.BillingTokenApplied {
			op.TokenAppliedQuota = quota
		}
		eventPayload, marshalErr := json.Marshal(map[string]any{
			"task_id":    task.Id,
			"mj_id":      task.MjId,
			"user_id":    userID,
			"token_id":   tokenID,
			"channel_id": channelID,
			"quota":      quota,
			"reason":     reasonDetail,
			"result":     "refunded",
		})
		if marshalErr != nil {
			return marshalErr
		}
		event := &MidjourneyRefundOutbox{
			EventKey:       fmt.Sprintf("midjourney:%d:refund-log", task.Id),
			EventType:      "midjourney.refund.completed",
			PayloadVersion: 1,
			PayloadJSON:    string(eventPayload),
		}

		if err := increaseUserQuotaTx(tx, userID, quota); err != nil {
			return err
		}
		if task.BillingTokenApplied {
			if err := increaseTokenQuotaTx(tx, tokenID, quota); err != nil {
				return err
			}
		}
		if err := adjustUserUsedQuotaTx(tx, userID, -quota); err != nil {
			return err
		}
		if err := adjustChannelUsedQuotaTx(tx, channelID, -quota); err != nil {
			return err
		}

		result := tx.Model(&Midjourney{}).
			Where("id = ? AND quota = ? AND billing_version = ? AND billing_status IN ?", task.Id, quota, 1, []string{"applied", "partial"}).
			Updates(map[string]any{"quota": 0, "billing_status": "refunded"})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return errors.New("Midjourney refund task state changed concurrently")
		}

		if err := CreateMidjourneyRefundOperationWithOutboxTx(tx, op, event); err != nil {
			return err
		}
		now := common.GetTimestamp()
		operationResult := tx.Model(&MidjourneyRefundOperation{}).Where("id = ?", op.ID).Updates(map[string]any{
			"status":       MidjourneyRefundCompleted,
			"completed_at": now,
			"updated_at":   now,
		})
		if operationResult.Error != nil {
			return operationResult.Error
		}
		if operationResult.RowsAffected != 1 {
			return errors.New("Midjourney refund operation completion state was not persisted")
		}
		applied = true
		return nil
	})
	if err != nil {
		return err
	}
	if reconciliation {
		return ErrMidjourneyRefundReconciliationRequired
	}
	if !applied {
		return nil
	}

	// Cache updates are deliberately post-commit. A cache failure cannot undo
	// or duplicate the primary-DB refund; the next read must hydrate from DB.
	runCacheSync(func() {
		if err := cacheIncrUserQuota(userID, int64(quota)); err != nil {
			common.SysLog(common.LogText("failed to refresh user quota after Midjourney refund: %s", err.Error()))
		}
	})
	if tokenID > 0 && tokenKey != "" {
		runCacheSync(func() {
			if _, err := cacheApplyTokenQuotaDelta(tokenID, tokenKey, int64(quota)); err != nil {
				common.SysLog(common.LogText("failed to refresh token quota after Midjourney refund: %s", err.Error()))
			}
		})
	}
	return nil
}

// FindPendingMidjourneyRefundTaskIDs returns terminal failed tasks whose
// durable billing quota has not yet been cleared. Reconciliation-required
// tasks are excluded because they need operator review, not automatic retries.
func FindPendingMidjourneyRefundTaskIDs(limit int) ([]int, error) {
	if limit <= 0 {
		limit = 100
	}
	var taskIDs []int
	err := DB.Model(&Midjourney{}).
		Where("quota > 0 AND status = ?", "FAILURE").
		Where("COALESCE(billing_status, '') <> ?", "reconciliation_required").
		Order("id ASC").
		Limit(limit).
		Pluck("id", &taskIDs).Error
	return taskIDs, err
}
