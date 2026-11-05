package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/uter-ai/uter/common"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func TestMidjourneyRefundLogOutboxDeliveryIsIdempotent(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{TablePrefix: "mj_refund_log_test_"},
	})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	previousDB, previousLogDB := DB, LOG_DB
	previousLogType := common.LogDatabaseType()
	DB, LOG_DB = db, db
	common.SetLogDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		DB, LOG_DB = previousDB, previousLogDB
		common.SetLogDatabaseType(previousLogType)
		require.NoError(t, sqlDB.Close())
	})
	require.NoError(t, db.AutoMigrate(&Log{}, &User{}, &MidjourneyRefundLogReceipt{}))

	event := MidjourneyRefundOutbox{
		EventKey: "midjourney:123:refund-log",
		EventType: "midjourney.refund.completed",
		PayloadJSON: `{"task_id":123,"mj_id":"mj-task-123","user_id":1,"token_id":2,"channel_id":3,"quota":40,"reason":"upstream failed","result":"refunded"}`,
	}
	require.NoError(t, deliverMidjourneyRefundLog(event))
	require.NoError(t, deliverMidjourneyRefundLog(event))

	mismatched := event
	mismatched.PayloadJSON = `{"task_id":123,"mj_id":"mj-task-123","user_id":1,"token_id":2,"channel_id":3,"quota":41,"reason":"changed payload","result":"refunded"}`
	require.Error(t, deliverMidjourneyRefundLog(mismatched))

	reconciliation := MidjourneyRefundOutbox{
		EventKey: "midjourney:124:refund-reconciliation",
		EventType: "midjourney.refund.reconciliation_required",
		PayloadJSON: `{"task_id":124,"mj_id":"mj-task-124","user_id":1,"reason_code":"missing_token","reason":"token missing","status":"reconciliation_required"}`,
	}
	require.NoError(t, deliverMidjourneyRefundLog(reconciliation))

	var receipts int64
	require.NoError(t, db.Model(&MidjourneyRefundLogReceipt{}).Where("event_key = ?", event.EventKey).Count(&receipts).Error)
	require.EqualValues(t, 2, receipts)
	var logs int64
	require.NoError(t, db.Model(&Log{}).Where("request_id = ?", event.EventKey).Count(&logs).Error)
	require.EqualValues(t, 1, logs)
	var reconciliationLogs int64
	require.NoError(t, db.Model(&Log{}).Where("request_id = ?", reconciliation.EventKey).Count(&reconciliationLogs).Error)
	require.EqualValues(t, 1, reconciliationLogs)
}

func TestMidjourneyRefundOutboxLeaseIsExclusive(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{TablePrefix: "mj_refund_lease_test_"},
	})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	previousDB := DB
	DB = db
	t.Cleanup(func() {
		DB = previousDB
		require.NoError(t, sqlDB.Close())
	})
	require.NoError(t, db.AutoMigrate(&MidjourneyRefundOutbox{}))
	event := MidjourneyRefundOutbox{
		EventKey: "midjourney:456:refund-log",
		RefundOperationID: 1,
		EventType: "midjourney.refund.completed",
		PayloadJSON: `{"task_id":456,"mj_id":"mj-task-456","user_id":1,"quota":10,"result":"refunded"}`,
	}
	require.NoError(t, db.Create(&event).Error)

	first, err := claimMidjourneyRefundOutboxEvent("runner-a", common.GetTimestamp())
	require.NoError(t, err)
	require.NotNil(t, first)
	second, err := claimMidjourneyRefundOutboxEvent("runner-b", common.GetTimestamp())
	require.NoError(t, err)
	require.Nil(t, second)
	require.NoError(t, finishMidjourneyRefundOutboxEvent(first, "runner-a", nil))
	var persisted MidjourneyRefundOutbox
	require.NoError(t, db.First(&persisted, first.ID).Error)
	require.Equal(t, MidjourneyRefundOutboxDelivered, persisted.Status)
}
