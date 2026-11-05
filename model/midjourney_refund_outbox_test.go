package model

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestMidjourneyRefundOutboxIdentityAndValidation(t *testing.T) {
	table: = "midjourney_refund_outbox_contract_test"
	db:    = DB.Table(table)
	require.NoError(t, db.AutoMigrate(&MidjourneyRefundOutbox{}))
	t.Cleanup(func() { _ = DB.Migrator().DropTable(table) })

	event := MidjourneyRefundOutbox{
		EventKey:          "mj-refund-op-1:task-billing-log",
		RefundOperationID: 1,
		EventType:         "task_billing_log",
		PayloadJSON:       `{"operation_id":1,"result":"refunded"}`,
	}
	require.NoError(t, db.Create(&event).Error)
	assert.Error(t, db.Model(&event).Update("payload_json", `{"result":"rewritten"}`).Error)
	assert.Equal(t, MidjourneyRefundOutboxPending, event.Status)
	assert.Equal(t, 1, event.PayloadVersion)
	assert.NotZero(t, event.CreatedAt)

	duplicate := MidjourneyRefundOutbox{
		EventKey:          event.EventKey,
		RefundOperationID: 2,
		EventType:         "task_billing_log",
		PayloadJSON:       `{"operation_id":2}`,
	}
	assert.Error(t, db.Create(&duplicate).Error)

	for _, invalid := range []*MidjourneyRefundOutbox{
		{EventKey: "missing-op", RefundOperationID: 0, EventType: "task_billing_log", PayloadJSON: `{}`},
		{RefundOperationID: 1, EventType: "task_billing_log", PayloadJSON: `{}`},
		{EventKey: "missing-type", RefundOperationID: 1, PayloadJSON: `{}`},
		{EventKey: "bad-json", RefundOperationID: 1, EventType: "task_billing_log", PayloadJSON: "{"},
		{EventKey: "bad-status", RefundOperationID: 1, EventType: "task_billing_log", PayloadJSON: `{}`, Status: MidjourneyRefundOutboxDelivered},
		{EventKey: "bad-version", RefundOperationID: 1, EventType: "task_billing_log", PayloadVersion: -1, PayloadJSON: `{}`},
	} {
		assert.Error(t, db.Create(invalid).Error)
	}
}

func TestCreateMidjourneyRefundOperationWithOutboxTxIsAtomic(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&MidjourneyRefundOperation{}, &MidjourneyRefundOutbox{}))
	suffix:   = fmt.Sprintf("%d", time.Now().UnixNano())
	taskID:   = int(time.Now().UnixNano() % 1000000000)
	opKey:    = "midjourney:atomic-test:" + suffix
	eventKey: = "mj-refund-atomic-test:" + suffix

	t.Cleanup(func() {
		_ = DB.Where("event_key = ?", eventKey).Delete(&MidjourneyRefundOutbox{}).Error
		_ = DB.Where("idempotency_key = ?", opKey).Delete(&MidjourneyRefundOperation{}).Error
	})

	op := &MidjourneyRefundOperation{
		MidjourneyTaskID:    taskID,
		IdempotencyKey:      opKey,
		ReasonCode:          "upstream_failed",
		FundingSource:       MidjourneyRefundFundingPersonalWallet,
		BillingSnapshotJSON: `{"version":1}`,
	}
	event := &MidjourneyRefundOutbox{
		EventKey:    eventKey,
		EventType:   "task_billing_log",
		PayloadJSON: `{"result":"refunded"}`,
	}
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return CreateMidjourneyRefundOperationWithOutboxTx(tx, op, event)
	}))
	assert.Positive(t, op.ID)
	assert.Equal(t, op.ID, event.RefundOperationID)

	// A duplicate outbox key must roll back the operation insert to the
	// nested savepoint, even when the outer transaction elects to continue.
	duplicateOpKey: = opKey + ":rollback"
	duplicateEvent: = &MidjourneyRefundOutbox{
		EventKey:    eventKey,
		EventType:   "task_billing_log",
		PayloadJSON: `{"result":"duplicate"}`,
	}
	rollbackOp := &MidjourneyRefundOperation{
		MidjourneyTaskID:    taskID + 1,
		IdempotencyKey:      duplicateOpKey,
		ReasonCode:          "upstream_failed",
		FundingSource:       MidjourneyRefundFundingPersonalWallet,
		BillingSnapshotJSON: `{"version":1}`,
	}
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		err := CreateMidjourneyRefundOperationWithOutboxTx(tx, rollbackOp, duplicateEvent)
		assert.Error(t, err)
		return nil
	}))
	var count int64
	require.NoError(t, DB.Model(&MidjourneyRefundOperation{}).Where("idempotency_key = ?", duplicateOpKey).Count(&count).Error)
	assert.Zero(t, count)
}
