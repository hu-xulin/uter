package model

import (
	"errors"
	"testing"

	"github.com/uter-ai/uter/common"
	"github.com/stretchr/testify/require"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestFailPendingSubscriptionOrder(t *testing.T) {
	previousDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&SubscriptionOrder{}))
	DB = db
	t.Cleanup(func() {
		DB = previousDB
		_ = sqlDB.Close()
	})

	pending := SubscriptionOrder{
		UserId: 1, PlanId: 1, Money: 10, TradeNo: "pending-stripe",
		PaymentProvider: PaymentProviderStripe, Status: common.TopUpStatusPending,
	}
	success := SubscriptionOrder{
		UserId: 2, PlanId: 1, Money: 10, TradeNo: "success-stripe",
		PaymentProvider: PaymentProviderStripe, Status: common.TopUpStatusSuccess,
	}
	otherProvider := SubscriptionOrder{
		UserId: 3, PlanId: 1, Money: 10, TradeNo: "pending-other",
		PaymentProvider: PaymentProviderCreem, Status: common.TopUpStatusPending,
	}
	require.NoError(t, db.Create(&pending).Error)
	require.NoError(t, db.Create(&success).Error)
	require.NoError(t, db.Create(&otherProvider).Error)

	require.NoError(t, FailPendingSubscriptionOrder(pending.TradeNo, PaymentProviderStripe))
	var saved SubscriptionOrder
	require.NoError(t, db.Where("trade_no = ?", pending.TradeNo).First(&saved).Error)
	require.Equal(t, common.TopUpStatusFailed, saved.Status)
	require.Positive(t, saved.CompleteTime)

	// Repeated events are idempotent.
	require.NoError(t, FailPendingSubscriptionOrder(pending.TradeNo, PaymentProviderStripe))
	require.NoError(t, db.Where("trade_no = ?", pending.TradeNo).First(&saved).Error)
	require.Equal(t, common.TopUpStatusFailed, saved.Status)

	// A late failed event must never downgrade a successfully completed order.
	require.NoError(t, FailPendingSubscriptionOrder(success.TradeNo, PaymentProviderStripe))
	// GORM adds the model's existing primary key to First's predicate; reset the
	// previously loaded pending order before looking up a different trade number.
	saved = SubscriptionOrder{}
	require.NoError(t, db.Where("trade_no = ?", success.TradeNo).First(&saved).Error)
	require.Equal(t, common.TopUpStatusSuccess, saved.Status)

	require.ErrorIs(t, FailPendingSubscriptionOrder(otherProvider.TradeNo, PaymentProviderStripe), ErrPaymentMethodMismatch)
	require.True(t, errors.Is(FailPendingSubscriptionOrder("missing", PaymentProviderStripe), ErrSubscriptionOrderNotFound))
}
