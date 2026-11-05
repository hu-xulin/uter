package model

import (
	"errors"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupSubscriptionRefundTxTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&UserSubscription{}, &SubscriptionPreConsumeRecord{}))
	DB = db
	t.Cleanup(func() {
		DB = previousDB
		_ = sqlDB.Close()
	})
	return db
}

func TestRefundSubscriptionPreConsumeTxValidatesArgumentsAndIdentity(t *testing.T) {
	db := setupSubscriptionRefundTxTestDB(t)
	require.Error(t, refundSubscriptionPreConsumeTx(nil, "request"))
	require.Error(t, refundSubscriptionPreConsumeTx(db, "  "))
	require.Error(t, refundSubscriptionPreConsumeTx(db, "missing-request"))
}

func TestRefundSubscriptionPreConsumeTxAppliesExactRefundAndIsIdempotent(t *testing.T) {
	db := setupSubscriptionRefundTxTestDB(t)
	sub := UserSubscription{UserId: 1, PlanId: 1, AmountTotal: 100, AmountUsed: 50, Status: "active"}
	require.NoError(t, db.Create(&sub).Error)
	record := SubscriptionPreConsumeRecord{
		RequestId: "subscription-refund-once", UserId: 1, UserSubscriptionId: sub.Id,
		PreConsumed: 20, Status: "consumed",
	}
	require.NoError(t, db.Create(&record).Error)

	require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
		return refundSubscriptionPreConsumeTx(tx, record.RequestId)
	}))
	var savedSub UserSubscription
	require.NoError(t, db.First(&savedSub, sub.Id).Error)
	require.EqualValues(t, 30, savedSub.AmountUsed, "refund subtracts the exact pre-consumed amount")
	var savedRecord SubscriptionPreConsumeRecord
	require.NoError(t, db.First(&savedRecord, record.Id).Error)
	require.Equal(t, "refunded", savedRecord.Status, "receipt and ledger update commit together")

	require.NoError(t, RefundSubscriptionPreConsume(record.RequestId))
	require.NoError(t, db.First(&savedSub, sub.Id).Error)
	require.EqualValues(t, 30, savedSub.AmountUsed, "replay cannot refund twice")
}

func TestRefundSubscriptionPreConsumeTxCarriesRefundAcrossResetBoundary(t *testing.T) {
	db := setupSubscriptionRefundTxTestDB(t)
	sub := UserSubscription{UserId: 2, PlanId: 1, AmountTotal: 100, AmountUsed: 5, Status: "active"}
	require.NoError(t, db.Create(&sub).Error)
	record := SubscriptionPreConsumeRecord{
		RequestId: "subscription-refund-carry", UserId: 2, UserSubscriptionId: sub.Id,
		PreConsumed: 20, Status: "consumed",
	}
	require.NoError(t, db.Create(&record).Error)

	require.NoError(t, RefundSubscriptionPreConsume(record.RequestId))
	var saved UserSubscription
	require.NoError(t, db.First(&saved, sub.Id).Error)
	require.EqualValues(t, 0, saved.AmountUsed)
	require.EqualValues(t, 15, saved.RefundCarryOver, "refund beyond current-period usage is carried forward")
}

func TestRefundSubscriptionPreConsumeTxRespectsCallerRollback(t *testing.T) {
	db := setupSubscriptionRefundTxTestDB(t)
	sub := UserSubscription{UserId: 3, PlanId: 1, AmountTotal: 100, AmountUsed: 40, Status: "active"}
	require.NoError(t, db.Create(&sub).Error)
	record := SubscriptionPreConsumeRecord{
		RequestId: "subscription-refund-rollback", UserId: 3, UserSubscriptionId: sub.Id,
		PreConsumed: 10, Status: "consumed",
	}
	require.NoError(t, db.Create(&record).Error)
	rollbackErr := errors.New("force outer transaction rollback")
	require.ErrorIs(t, db.Transaction(func(tx *gorm.DB) error {
		if err := refundSubscriptionPreConsumeTx(tx, record.RequestId); err != nil {
			return err
		}
		return rollbackErr
	}), rollbackErr)

	var saved UserSubscription
	require.NoError(t, db.First(&saved, sub.Id).Error)
	require.EqualValues(t, 40, saved.AmountUsed, "caller rollback restores the subscription ledger")
	var savedRecord SubscriptionPreConsumeRecord
	require.NoError(t, db.First(&savedRecord, record.Id).Error)
	require.Equal(t, "consumed", savedRecord.Status, "caller rollback restores the idempotency receipt")
}

func TestRefundSubscriptionPreConsumeTxRejectsMissingSubscriptionWithoutChangingReceipt(t *testing.T) {
	db := setupSubscriptionRefundTxTestDB(t)
	record := SubscriptionPreConsumeRecord{
		RequestId: "subscription-refund-missing-sub", UserId: 4, UserSubscriptionId: 987654,
		PreConsumed: 10, Status: "consumed",
	}
	require.NoError(t, db.Create(&record).Error)
	require.Error(t, RefundSubscriptionPreConsume(record.RequestId))
	var saved SubscriptionPreConsumeRecord
	require.NoError(t, db.First(&saved, record.Id).Error)
	require.Equal(t, "consumed", saved.Status, "a missing ledger target must not consume the refund receipt")
}

// TestRefundSubscriptionPreConsumeTxRequiresMatchingOwner ensures a receipt
// cannot reverse quota from a subscription owned by a different user.
func TestRefundSubscriptionPreConsumeTxRequiresMatchingOwner(t *testing.T) {
	db := setupSubscriptionRefundTxTestDB(t)
	require.NoError(t, db.AutoMigrate(&RefundIntent{}))

	sub := UserSubscription{UserId: 7, PlanId: 1, AmountTotal: 100, AmountUsed: 40, Status: "active"}
	require.NoError(t, db.Create(&sub).Error)
	record := SubscriptionPreConsumeRecord{
		RequestId: "subscription-owner-check", UserId: 7, UserSubscriptionId: sub.Id,
		PreConsumed: 20, Status: "consumed",
	}
	require.NoError(t, db.Create(&record).Error)
	intent := RefundIntent{
		UserId: 8, IdempotencyKey: "subscription-owner-check-intent",
		FundingSource: RefundSourceSubscription, SubRequestId: record.RequestId, SubId: sub.Id,
	}
	require.NoError(t, CreateRefundIntent(&intent))

	require.ErrorContains(t, ExecuteRefundIntent(intent.Id), "belongs to user 7, not user 8")
	var savedSub UserSubscription
	require.NoError(t, db.First(&savedSub, sub.Id).Error)
	require.EqualValues(t, 40, savedSub.AmountUsed)
	var savedRecord SubscriptionPreConsumeRecord
	require.NoError(t, db.First(&savedRecord, record.Id).Error)
	require.Equal(t, "consumed", savedRecord.Status)
	var savedIntent RefundIntent
	require.NoError(t, db.First(&savedIntent, intent.Id).Error)
	require.Equal(t, RefundIntentPending, savedIntent.Status)
}

// TestRefundSubscriptionPreConsumeTxRejectsReceiptSubscriptionMismatch ensures
// the receipt owner must match the persisted subscription owner.
func TestRefundSubscriptionPreConsumeTxRejectsReceiptSubscriptionMismatch(t *testing.T) {
	db := setupSubscriptionRefundTxTestDB(t)
	sub := UserSubscription{UserId: 9, PlanId: 1, AmountTotal: 100, AmountUsed: 40, Status: "active"}
	require.NoError(t, db.Create(&sub).Error)
	record := SubscriptionPreConsumeRecord{
		RequestId: "subscription-record-owner-check", UserId: 8, UserSubscriptionId: sub.Id,
		PreConsumed: 10, Status: "consumed",
	}
	require.NoError(t, db.Create(&record).Error)

	require.ErrorContains(t, RefundSubscriptionPreConsume(record.RequestId), "owner mismatch")
	var savedSub UserSubscription
	require.NoError(t, db.First(&savedSub, sub.Id).Error)
	require.EqualValues(t, 40, savedSub.AmountUsed)
	var savedRecord SubscriptionPreConsumeRecord
	require.NoError(t, db.First(&savedRecord, record.Id).Error)
	require.Equal(t, "consumed", savedRecord.Status)
}

// TestRefundSubscriptionIntentRequiresMatchingSubscriptionSnapshot ensures
// the persisted intent subscription ID matches the subscription receipt.
func TestRefundSubscriptionIntentRequiresMatchingSubscriptionSnapshot(t *testing.T) {
	db := setupSubscriptionRefundTxTestDB(t)
	require.NoError(t, db.AutoMigrate(&RefundIntent{}))

	sub := UserSubscription{UserId: 10, PlanId: 1, AmountTotal: 100, AmountUsed: 40, Status: "active"}
	otherSub := UserSubscription{UserId: 10, PlanId: 2, AmountTotal: 100, AmountUsed: 30, Status: "active"}
	require.NoError(t, db.Create(&sub).Error)
	require.NoError(t, db.Create(&otherSub).Error)
	record := SubscriptionPreConsumeRecord{
		RequestId: "subscription-snapshot-check", UserId: 10, UserSubscriptionId: sub.Id,
		PreConsumed: 20, Status: "consumed",
	}
	require.NoError(t, db.Create(&record).Error)
	intent := RefundIntent{
		UserId: 10, IdempotencyKey: "subscription-snapshot-check-intent",
		FundingSource: RefundSourceSubscription, SubRequestId: record.RequestId, SubId: otherSub.Id,
	}
	require.NoError(t, CreateRefundIntent(&intent))

	require.ErrorContains(t, ExecuteRefundIntent(intent.Id), "not expected subscription")
	var savedSub UserSubscription
	require.NoError(t, db.First(&savedSub, sub.Id).Error)
	require.EqualValues(t, 40, savedSub.AmountUsed)
	require.NoError(t, db.First(&savedSub, otherSub.Id).Error)
	require.EqualValues(t, 30, savedSub.AmountUsed)
}
