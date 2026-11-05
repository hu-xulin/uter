package model

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/uter-ai/uter/common"
	"gorm.io/gorm"
)

const (
	MidjourneyRefundOutboxPending = "pending"
	MidjourneyRefundOutboxDelivering = "delivering"
	MidjourneyRefundOutboxDelivered = "delivered"
	MidjourneyRefundOutboxDeadLetter = "dead_letter"
)

type MidjourneyRefundOutbox struct {
	ID int `json:"id" gorm:"primaryKey"`
	EventKey string `json:"event_key" gorm:"type:varchar(128);not null;uniqueIndex"`
	RefundOperationID int `json:"refund_operation_id" gorm:"not null;index"`
	EventType string `json:"event_type" gorm:"type:varchar(64);not null"`
	PayloadVersion int `json:"payload_version" gorm:"not null;default:1"`
	PayloadJSON string `json:"payload_json" gorm:"type:text;not null"`
	Status string `json:"status" gorm:"type:varchar(24);not null;default:pending;index"`
	AttemptCount int `json:"attempt_count" gorm:"not null;default:0"`
	NextAttemptAt int64 `json:"next_attempt_at" gorm:"bigint;not null;default:0;index"`
	LeaseOwner string `json:"lease_owner" gorm:"type:varchar(128)"`
	LeaseUntil int64 `json:"lease_until" gorm:"bigint;not null;default:0;index"`
	LastError string `json:"last_error" gorm:"type:varchar(512)"`
	CreatedAt int64 `json:"created_at" gorm:"bigint;not null;index"`
	UpdatedAt int64 `json:"updated_at" gorm:"bigint;not null;index"`
	DeliveredAt int64 `json:"delivered_at" gorm:"bigint;not null;default:0"`
}

func (MidjourneyRefundOutbox) TableName() string { return "midjourney_refund_outbox" }

func (event *MidjourneyRefundOutbox) BeforeCreate(tx *gorm.DB) error {
	if event == nil { return errors.New("Midjourney refund outbox event is nil") }
	if event.RefundOperationID <= 0 { return errors.New("outbox event requires a refund operation ID") }
	if event.EventKey == "" || event.EventType == "" || !json.Valid([]byte(event.PayloadJSON)) {
		return errors.New("outbox event requires event key, event type, and valid payload JSON")
	}
	// GORM applies SQL defaults after hooks; initialize zero-value structs here.
	if event.PayloadVersion == 0 {
		event.PayloadVersion = 1
	}
	if event.PayloadVersion < 0 {
		return errors.New("outbox payload version must be positive")
	}
	if event.Status == "" { event.Status = MidjourneyRefundOutboxPending }
	if event.Status != MidjourneyRefundOutboxPending {
		return fmt.Errorf("invalid initial Midjourney refund outbox status %q", event.Status)
	}
	now := common.GetTimestamp()
	if event.CreatedAt == 0 { event.CreatedAt = now }
	if event.UpdatedAt == 0 { event.UpdatedAt = now }
	return nil
}

func CreateMidjourneyRefundOutboxTx(tx *gorm.DB, event *MidjourneyRefundOutbox) error {
	if tx == nil { return errors.New("Midjourney refund outbox transaction is nil") }
	if event == nil { return errors.New("Midjourney refund outbox event is nil") }
	return tx.Create(event).Error
}
