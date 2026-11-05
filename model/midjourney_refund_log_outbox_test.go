package model

import (
	"errors"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
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
		EventKey:    "midjourney:123:refund-log",
		EventType:      "midjourney.refund.completed",
		PayloadVersion: 1,
		PayloadJSON: `{"task_id":123,"mj_id":"mj-task-123","user_id":1,"token_id":2,"channel_id":3,"quota":40,"reason":"upstream failed","result":"refunded"}`,
	}
	require.NoError(t, deliverMidjourneyRefundLog(event))
	require.NoError(t, deliverMidjourneyRefundLog(event))

	mismatched := event
	mismatched.PayloadJSON = `{"task_id":123,"mj_id":"mj-task-123","user_id":1,"token_id":2,"channel_id":3,"quota":41,"reason":"changed payload","result":"refunded"}`
	require.Error(t, deliverMidjourneyRefundLog(mismatched))

	reconciliation := MidjourneyRefundOutbox{
		EventKey:    "midjourney:124:refund-reconciliation",
		EventType:      "midjourney.refund.reconciliation_required",
		PayloadVersion: 1,
		PayloadJSON: `{"task_id":124,"mj_id":"mj-task-124","user_id":1,"reason_code":"missing_token","reason":"token missing","status":"reconciliation_required"}`,
	}
	require.NoError(t, deliverMidjourneyRefundLog(reconciliation))

	// receipt 以 event_key 为主键，重复投递只校验 payload hash 后返回，
	// 因此幂等语义下每个事件恒为 1 条凭证（重复的是投递次数，不是凭证数）。
	var receipts int64
	require.NoError(t, db.Model(&MidjourneyRefundLogReceipt{}).Where("event_key = ?", event.EventKey).Count(&receipts).Error)
	require.EqualValues(t, 1, receipts)
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
		EventKey:          "midjourney:456:refund-log",
		RefundOperationID: 1,
		EventType:         "midjourney.refund.completed",
		PayloadVersion:    1,
		PayloadJSON:       `{"task_id":456,"mj_id":"mj-task-456","user_id":1,"quota":10,"result":"refunded"}`,
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

func TestMidjourneyRefundOutboxRetriesThenDeadLetters(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{TablePrefix: "mj_refund_retry_test_"},
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

	transient := MidjourneyRefundOutbox{
		EventKey:          "midjourney:789:refund-log",
		RefundOperationID: 1,
		EventType:         "midjourney.refund.completed",
		PayloadVersion:    1,
		PayloadJSON:       `{"task_id":789,"mj_id":"mj-task-789","user_id":1,"quota":10,"result":"refunded"}`,
	}
	require.NoError(t, db.Create(&transient).Error)
	transient.Status = MidjourneyRefundOutboxDelivering
	transient.LeaseOwner = "runner-a"
	transient.AttemptCount = 1
	require.NoError(t, db.Model(&MidjourneyRefundOutbox{}).Where("id = ?", transient.ID).Updates(map[string]any{
		"status": MidjourneyRefundOutboxDelivering, "lease_owner": "runner-a", "attempt_count": 1,
	}).Error)
	require.NoError(t, finishMidjourneyRefundOutboxEvent(&transient, "runner-a", errors.New("temporary LOG_DB outage")))
	var retry MidjourneyRefundOutbox
	require.NoError(t, db.First(&retry, transient.ID).Error)
	require.Equal(t, MidjourneyRefundOutboxPending, retry.Status)
	require.Greater(t, retry.NextAttemptAt, common.GetTimestamp())
	require.Empty(t, retry.LeaseOwner)

	dead := MidjourneyRefundOutbox{
		EventKey:          "midjourney:790:refund-log",
		RefundOperationID: 2,
		EventType:         "midjourney.refund.completed",
		PayloadVersion:    1,
		PayloadJSON:       `{"task_id":790,"mj_id":"mj-task-790","user_id":1,"quota":10,"result":"refunded"}`,
	}
	require.NoError(t, db.Create(&dead).Error)
	dead.Status = MidjourneyRefundOutboxDelivering
	dead.LeaseOwner = "runner-a"
	dead.AttemptCount = midjourneyRefundOutboxMaxAttempts
	require.NoError(t, db.Model(&MidjourneyRefundOutbox{}).Where("id = ?", dead.ID).Updates(map[string]any{
		"status": MidjourneyRefundOutboxDelivering, "lease_owner": "runner-a", "attempt_count": dead.AttemptCount,
	}).Error)
	require.NoError(t, finishMidjourneyRefundOutboxEvent(&dead, "runner-a", errors.New("permanent LOG_DB outage")))
	var persistedDead MidjourneyRefundOutbox
	require.NoError(t, db.First(&persistedDead, dead.ID).Error)
	require.Equal(t, MidjourneyRefundOutboxDeadLetter, persistedDead.Status)
	require.NotEmpty(t, persistedDead.LastError)
	require.Empty(t, persistedDead.LeaseOwner)
}


// TestMidjourneyRefundOutboxRejectsUnsupportedPayloadVersions ensures an
// unknown schema is retried/quarantined rather than decoded as version 1.
func TestMidjourneyRefundOutboxRejectsUnsupportedPayloadVersions(t *testing.T) {
	previousDB, previousLogDB := DB, LOG_DB
	previousLogType := common.LogDatabaseType()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	DB, LOG_DB = db, db
	common.SetLogDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		DB, LOG_DB = previousDB, previousLogDB
		common.SetLogDatabaseType(previousLogType)
		_ = sqlDB.Close()
	})
	require.NoError(t, db.AutoMigrate(&Log{}, &User{}, &MidjourneyRefundLogReceipt{}))

	event := MidjourneyRefundOutbox{
		EventKey: "midjourney:version-test", EventType: "midjourney.refund.completed",
		PayloadVersion: 2,
		PayloadJSON: `{"task_id":321,"mj_id":"mj-321","user_id":1,"quota":10,"result":"refunded"}`,
	}
	require.ErrorContains(t, deliverMidjourneyRefundLog(event), "unsupported Midjourney refund outbox payload version")
	event.PayloadVersion = 1
	event.EventKey = "   "
	require.ErrorContains(t, deliverMidjourneyRefundLog(event), "event key must be non-empty")
	event.EventKey = strings.Repeat("x", 129)
	require.ErrorContains(t, deliverMidjourneyRefundLog(event), "event key must be non-empty")
}
