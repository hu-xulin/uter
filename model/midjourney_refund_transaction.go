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

// RefundMidjourneyTaskBilling atomically reverses a verifiably applied
// Midjourney charge in the primary database. Legacy or ambiguous billing
// snapshots are recorded for reconciliation and are never auto-refunded.
func RefundMidjourneyTaskBilling(taskID int, reason string) error {
	if taskID <= 0 {
		return errors.New("Midjourney task ID must be positive")
	}

	var (
		userID       int
		tokenID      int
		channelID    int
		tokenKey     string
		quota        int
		applied      bool
		reconciliation bool
	)

	err := DB.Transaction(func(tx *gorm.DB) error {
		var task Midjourney
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&task, taskID).Error; err != nil {
			return err
		}
		if task.Quota <= 0 {
			return nil
		}

		var existing MidjourneyRefundOperation
		err := tx.Where("midjourney_task_id = ? AND operation_type = ?", task.Id, MidjourneyRefundOperationTypeFull).
			First(&existing).Error
		if err == nil {
			if existing.Status == MidjourneyRefundCompleted {
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
			"billing_version": task.BillingVersion,
			"billing_status": task.BillingStatus,
			"wallet_applied": task.BillingWalletApplied,
			"token_applied": task.BillingTokenApplied,
			"task_quota": task.Quota,
			"token_id": task.TokenId,
			"billing_channel_id": task.GetBillingChannelId(),
		}

		// Do not infer applied legs for pre-snapshot tasks or an interrupted
		// charging attempt. Persist a durable reconciliation marker instead.
		if task.BillingVersion != 1 ||
			(task.BillingStatus != "applied" && task.BillingStatus != "partial") ||
			!task.BillingWalletApplied ||
			(task.BillingTokenApplied && task.TokenId <= 0) ||
			(!task.BillingTokenApplied && task.TokenId > 0) {
			snapshot["reconciliation_reason"] = "billing snapshot is absent, incomplete, or inconsistent"
			snapshotJSON, marshalErr := json.Marshal(snapshot)
			if marshalErr != nil {
				return marshalErr
			}
			op := &MidjourneyRefundOperation{
				MidjourneyTaskID: task.Id,
				OperationType: MidjourneyRefundOperationTypeFull,
				ReasonCode: "midjourney_billing_snapshot_ambiguous",
				ReasonDetail: reasonDetail,
				BillingVersion: 1,
				BillingSnapshotJSON: string(snapshotJSON),
				FundingSource: MidjourneyRefundFundingUnknownLegacy,
				FundingUserID: task.UserId,
				TokenID: task.TokenId,
				ChannelID: task.GetBillingChannelId(),
				Status: MidjourneyRefundReconciliationRequired,
			}
			eventPayload, marshalErr := json.Marshal(map[string]any{
				"task_id": task.Id,
				"mj_id": task.MjId,
				"reason": reasonDetail,
				"status": MidjourneyRefundReconciliationRequired,
			})
			if marshalErr != nil {
				return marshalErr
			}
			event := &MidjourneyRefundOutbox{
				EventKey: fmt.Sprintf("midjourney:%d:refund-reconciliation", task.Id),
				EventType: "midjourney.refund.reconciliation_required",
				PayloadVersion: 1,
				PayloadJSON: string(eventPayload),
			}
			if err := CreateMidjourneyRefundOperationWithOutboxTx(tx, op, event); err != nil {
				return err
			}
			reconciliation = true
			return nil
		}

		userID = task.UserId
		tokenID = task.TokenId
		channelID = task.GetBillingChannelId()
		quota = task.Quota
		if userID <= 0 || channelID <= 0 {
			return fmt.Errorf("%w: missing user or billing channel identity", ErrMidjourneyRefundReconciliationRequired)
		}

		if task.BillingTokenApplied {
			var token Token
			if err := tx.Select("id", "key").First(&token, tokenID).Error; err != nil {
				return fmt.Errorf("%w: token %d cannot be loaded: %v", ErrMidjourneyRefundReconciliationRequired, tokenID, err)
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
			MidjourneyTaskID: task.Id,
			OperationType: MidjourneyRefundOperationTypeFull,
			ReasonCode: "midjourney_task_failure",
			ReasonDetail: reasonDetail,
			BillingVersion: 1,
			BillingSnapshotJSON: string(snapshotJSON),
			FundingSource: MidjourneyRefundFundingPersonalWallet,
			FundingUserID: userID,
			TokenID: tokenID,
			ChannelID: channelID,
			WalletAppliedQuota: quota,
			UserUsageApplied: quota,
			ChannelUsageApplied: quota,
			Status: MidjourneyRefundPending,
		}
		if task.BillingTokenApplied {
			op.TokenAppliedQuota = quota
		}
		eventPayload, marshalErr := json.Marshal(map[string]any{
			"task_id": task.Id,
			"mj_id": task.MjId,
			"user_id": userID,
			"token_id": tokenID,
			"channel_id": channelID,
			"quota": quota,
			"reason": reasonDetail,
			"result": "refunded",
		})
		if marshalErr != nil {
			return marshalErr
		}
		event := &MidjourneyRefundOutbox{
			EventKey: fmt.Sprintf("midjourney:%d:refund-log", task.Id),
			EventType: "midjourney.refund.completed",
			PayloadVersion: 1,
			PayloadJSON: string(eventPayload),
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
		if err := tx.Model(&MidjourneyRefundOperation{}).Where("id = ?", op.ID).Updates(map[string]any{
			"status": MidjourneyRefundCompleted,
			"completed_at": now,
			"updated_at": now,
		}).Error; err != nil {
			return err
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
