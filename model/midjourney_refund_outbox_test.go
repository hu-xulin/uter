package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMidjourneyRefundOutboxIdentityAndValidation(t *testing.T) {
	table := "midjourney_refund_outbox_contract_test"
	db := DB.Table(table)
	require.NoError(t, db.AutoMigrate(&MidjourneyRefundOutbox{}))
	t.Cleanup(func() { _ = DB.Migrator().DropTable(table) })

	event := MidjourneyRefundOutbox{
		EventKey: "mj-refund-op-1:task-billing-log",
		RefundOperationID: 1,
		EventType: "task_billing_log",
		PayloadJSON: `{"operation_id":1,"result":"refunded"}`,
	}
	require.NoError(t, db.Create(&event).Error)
	assert.Equal(t, MidjourneyRefundOutboxPending, event.Status)
	assert.NotZero(t, event.CreatedAt)

	duplicate := MidjourneyRefundOutbox{
		EventKey: event.EventKey,
		RefundOperationID: 2,
		EventType: "task_billing_log",
		PayloadJSON: `{"operation_id":2}`,
	}
	assert.Error(t, db.Create(&duplicate).Error)

	for _, invalid := range []*MidjourneyRefundOutbox{
		{EventKey: "missing-op", RefundOperationID: 0, EventType: "task_billing_log", PayloadJSON: `{}`},
		{RefundOperationID: 1, EventType: "task_billing_log", PayloadJSON: `{}`},
		{EventKey: "missing-type", RefundOperationID: 1, PayloadJSON: `{}`},
		{EventKey: "bad-json", RefundOperationID: 1, EventType: "task_billing_log", PayloadJSON: "{"},
		{EventKey: "bad-status", RefundOperationID: 1, EventType: "task_billing_log", PayloadJSON: `{}`, Status: MidjourneyRefundOutboxDelivered},
	} {
		assert.Error(t, db.Create(invalid).Error)
	}
}
