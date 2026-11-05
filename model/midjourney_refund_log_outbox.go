package model

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	midjourneyRefundOutboxMaxAttempts = 10
	midjourneyRefundOutboxLease       = 2 * time.Minute
)

type MidjourneyRefundLogReceipt struct {
	EventKey    string `json:"event_key" gorm:"type:varchar(128);primaryKey"`
	PayloadHash string `json:"payload_hash" gorm:"type:varchar(64);not null"`
	CreatedAt   int64  `json:"created_at" gorm:"bigint;not null"`
}

func (MidjourneyRefundLogReceipt) TableName() string {
	return "midjourney_refund_log_receipts"
}

type midjourneyRefundLogPayload struct {
	TaskID    int    `json:"task_id"`
	MjID      string `json:"mj_id"`
	UserID    int    `json:"user_id"`
	TokenID   int    `json:"token_id"`
	ChannelID int    `json:"channel_id"`
	Quota     int    `json:"quota"`
	Reason    string `json:"reason"`
	Result     string `json:"result"`
	Status     string `json:"status"`
	ReasonCode string `json:"reason_code"`
}

type MidjourneyRefundOutboxBatchResult struct {
	Claimed   int `json:"claimed"`
	Delivered int `json:"delivered"`
	Retried   int `json:"retried"`
	Dead      int `json:"dead_letter"`
}

// deliverMidjourneyRefundLog writes the log row and its receipt in one LOG_DB
// transaction. A receipt conflict means the earlier attempt committed both
// records, so a retry is safe even if the main-DB acknowledgement was lost.
func deliverMidjourneyRefundLog(event MidjourneyRefundOutbox) error {
	if LOG_DB == nil {
		return errors.New("LOG_DB is not initialized")
	}
	// ClickHouse does not provide the transactional unique receipt semantics
	// required to make a crash between log insertion and outbox acknowledgement
	// exactly-once. Do not silently downgrade to a racy check-then-insert.
	if common.UsingLogDatabase(common.DatabaseTypeClickHouse) {
		return errors.New("Midjourney refund outbox delivery requires a transactional SQL LOG_DB; ClickHouse adapter is not implemented")
	}
	if event.EventKey == "" {
		return errors.New("Midjourney refund outbox event key is required")
	}
	var payload midjourneyRefundLogPayload
	if err := json.Unmarshal([]byte(event.PayloadJSON), &payload); err != nil {
		return fmt.Errorf("decode Midjourney refund event %s: %w", event.EventKey, err)
	}
	logType := LogTypeRefund
	content := fmt.Sprintf("Midjourney task %s refund completed: %s", payload.MjID, payload.Reason)
	switch event.EventType {
	case "midjourney.refund.completed":
		if payload.TaskID <= 0 || payload.UserID <= 0 || payload.Quota <= 0 || payload.Result != "refunded" {
			return fmt.Errorf("invalid Midjourney refund completion payload for %s", event.EventKey)
		}
	case "midjourney.refund.reconciliation_required":
		if payload.TaskID <= 0 || payload.Status != MidjourneyRefundReconciliationRequired || payload.ReasonCode == "" {
			return fmt.Errorf("invalid Midjourney refund reconciliation payload for %s", event.EventKey)
		}
		logType = LogTypeError
		content = fmt.Sprintf("Midjourney task %s requires refund reconciliation (%s): %s", payload.MjID, payload.ReasonCode, payload.Reason)
	default:
		return fmt.Errorf("unsupported Midjourney refund outbox event %q", event.EventType)
	}
	username := ""
	if payload.UserID > 0 {
		username, _ = GetUsernameById(payload.UserID, false)
	}
	payloadDigest := sha256.Sum256([]byte(event.PayloadJSON))
	payloadHash := hex.EncodeToString(payloadDigest[:])
	return LOG_DB.Transaction(func(tx *gorm.DB) error {
		receipt := MidjourneyRefundLogReceipt{
			EventKey: event.EventKey, PayloadHash: payloadHash, CreatedAt: common.GetTimestamp(),
		}
		result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&receipt)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			var existing MidjourneyRefundLogReceipt
			if err := tx.First(&existing, "event_key = ?", event.EventKey).Error; err != nil {
				return err
			}
			if existing.PayloadHash != payloadHash {
				return fmt.Errorf("refund outbox receipt payload mismatch for event %s", event.EventKey)
			}
			return nil
		}
		log := &Log{
			UserId:    payload.UserID,
			Username:  username,
			CreatedAt: common.GetTimestamp(),
			Type:      logType,
			Content:   content,
			Quota:     payload.Quota,
			ChannelId: payload.ChannelID,
			TokenId:   payload.TokenID,
			RequestId: event.EventKey,
			Other:     event.PayloadJSON,
		}
		return tx.Create(log).Error
	})
}

func claimMidjourneyRefundOutboxEvent(owner string, now int64) (*MidjourneyRefundOutbox, error) {
	if DB == nil {
		return nil, errors.New("primary database is not initialized")
	}
	var candidates []MidjourneyRefundOutbox
	if err := DB.Where(
		"(status = ? AND next_attempt_at <= ?) OR (status = ? AND lease_until <= ? AND next_attempt_at <= ?)",
		MidjourneyRefundOutboxPending, now,
		MidjourneyRefundOutboxDelivering, now, now,
	).Order("id ASC").Limit(1).Find(&candidates).Error; err != nil {
		return nil, err
	}
	if len(candidates) == 0 {
		return nil, nil
	}
	candidate := candidates[0]
	result := DB.Model(&MidjourneyRefundOutbox{}).
		Where("id = ? AND ((status = ? AND next_attempt_at <= ?) OR (status = ? AND lease_until <= ? AND next_attempt_at <= ?))",
			candidate.ID, MidjourneyRefundOutboxPending, now,
			MidjourneyRefundOutboxDelivering, now, now).
		Updates(map[string]any{
			"status":        MidjourneyRefundOutboxDelivering,
			"lease_owner":   owner,
			"lease_until":   now + int64(midjourneyRefundOutboxLease.Seconds()),
			"attempt_count": gorm.Expr("attempt_count + 1"),
			"updated_at":    now,
		})
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected != 1 {
		return nil, nil
	}
	var claimed MidjourneyRefundOutbox
	if err := DB.First(&claimed, candidate.ID).Error; err != nil {
		return nil, err
	}
	return &claimed, nil
}

func finishMidjourneyRefundOutboxEvent(event *MidjourneyRefundOutbox, owner string, deliveryErr error) error {
	if event == nil {
		return errors.New("outbox event is nil")
	}
	now := common.GetTimestamp()
	updates := map[string]any{
		"lease_owner": "",
		"lease_until": 0,
		"updated_at":  now,
	}
	if deliveryErr == nil {
		updates["status"] = MidjourneyRefundOutboxDelivered
		updates["delivered_at"] = now
		updates["last_error"] = ""
	} else {
		message := strings.TrimSpace(deliveryErr.Error())
		if len(message) > 512 {
			message = message[:512]
		}
		updates["last_error"] = message
		if event.AttemptCount >= midjourneyRefundOutboxMaxAttempts {
			updates["status"] = MidjourneyRefundOutboxDeadLetter
		} else {
			backoff := time.Duration(1<<min(event.AttemptCount-1, 10)) * time.Minute
			if backoff > time.Hour {
				backoff = time.Hour
			}
			updates["status"] = MidjourneyRefundOutboxPending
			updates["next_attempt_at"] = now + int64(backoff.Seconds())
		}
	}
	result := DB.Model(&MidjourneyRefundOutbox{}).
		Where("id = ? AND status = ? AND lease_owner = ?", event.ID, MidjourneyRefundOutboxDelivering, owner).
		Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return errors.New("Midjourney refund outbox lease was lost before acknowledgement")
	}
	return nil
}

// ProcessMidjourneyRefundOutboxOnce claims and delivers a bounded number of
// events. Delivery is idempotent for SQL LOG_DBs through the receipt table.
func ProcessMidjourneyRefundOutboxOnce(ctx context.Context, owner string, limit int) (MidjourneyRefundOutboxBatchResult, error) {
	result := MidjourneyRefundOutboxBatchResult{}
	if strings.TrimSpace(owner) == "" {
		return result, errors.New("outbox worker owner is required")
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	var firstErr error
	for result.Claimed < limit {
		if err := ctx.Err(); err != nil {
			firstErr = errors.Join(firstErr, err)
			break
		}
		event, err := claimMidjourneyRefundOutboxEvent(owner, common.GetTimestamp())
		if err != nil {
			firstErr = errors.Join(firstErr, err)
			break
		}
		if event == nil {
			break
		}
		result.Claimed++
		deliveryErr := deliverMidjourneyRefundLog(*event)
		if err := finishMidjourneyRefundOutboxEvent(event, owner, deliveryErr); err != nil {
			firstErr = errors.Join(firstErr, err)
			continue
		}
		if deliveryErr == nil {
			result.Delivered++
		} else if event.AttemptCount >= midjourneyRefundOutboxMaxAttempts {
			result.Dead++
			firstErr = errors.Join(firstErr, deliveryErr)
		} else {
			result.Retried++
			firstErr = errors.Join(firstErr, deliveryErr)
		}
	}
	return result, firstErr
}
