package model

import (
	"errors"
	"fmt"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
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

func TestUpsertSubscriptionTopUpRejectsConflictingPaymentIdentity(t *testing.T) {
	previousDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&SubscriptionOrder{}, &TopUp{}))
	DB = db
	t.Cleanup(func() {
		DB = previousDB
		_ = sqlDB.Close()
	})

	cases := []struct {
		name       string
		userID     int
		provider   string
		status          string
		providerAmount  int64
		providerCurrency string
		wantErr         error
	}{
		{name: "different owner", userID: 99, provider: PaymentProviderEpay, status: common.TopUpStatusPending, wantErr: ErrPaymentMethodMismatch},
		{name: "different provider", userID: 7, provider: PaymentProviderStripe, status: common.TopUpStatusPending, wantErr: ErrPaymentMethodMismatch},
		{name: "terminal top-up", userID: 7, provider: PaymentProviderEpay, status: common.TopUpStatusExpired, wantErr: ErrTopUpStatusInvalid},
		{name: "different provider amount", userID: 7, provider: PaymentProviderEpay, status: common.TopUpStatusPending, providerAmount: 999, providerCurrency: "CNY", wantErr: ErrPaymentMethodMismatch},
		{name: "different provider currency", userID: 7, provider: PaymentProviderEpay, status: common.TopUpStatusPending, providerAmount: 1000, providerCurrency: "USD", wantErr: ErrPaymentMethodMismatch},
	}
	for i, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			tradeNo := fmt.Sprintf("subscription-link-%d", i)
			order := &SubscriptionOrder{
				UserId: 7, PlanId: 1, Money: 10, TradeNo: tradeNo,
				PaymentProvider: PaymentProviderEpay, PaymentMethod: "alipay",
				ProviderAmount: 1000, ProviderCurrency: "CNY",
				Status: common.TopUpStatusPending,
			}
			topup := &TopUp{
				UserId: tc.userID, Money: 10, TradeNo: tradeNo,
				PaymentProvider: tc.provider, PaymentMethod: "alipay",
				ProviderAmount: tc.providerAmount, ProviderCurrency: tc.providerCurrency,
				Status: tc.status,
			}
			require.NoError(t, db.Create(order).Error)
			require.NoError(t, db.Create(topup).Error)

			err := upsertSubscriptionTopUpTx(db, order, "")
			require.ErrorIs(t, err, tc.wantErr)
			var stored TopUp
			require.NoError(t, db.Where("trade_no = ?", tradeNo).First(&stored).Error)
			require.Equal(t, tc.userID, stored.UserId)
			require.Equal(t, tc.provider, stored.PaymentProvider)
			require.Equal(t, tc.status, stored.Status)
		})
	}
}

func TestUpsertSubscriptionTopUpBackfillsLegacyProvider(t *testing.T) {
	previousDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&SubscriptionOrder{}, &TopUp{}))
	DB = db
	t.Cleanup(func() {
		DB = previousDB
		_ = sqlDB.Close()
	})

	order := &SubscriptionOrder{
		UserId: 7, PlanId: 1, Money: 10, TradeNo: "subscription-link-legacy",
		PaymentProvider: PaymentProviderEpay, PaymentMethod: "alipay",
		Status: common.TopUpStatusPending,
	}
	topup := &TopUp{
		UserId: 7, Money: 10, TradeNo: order.TradeNo,
		PaymentMethod: "alipay", Status: common.TopUpStatusPending,
	}
	require.NoError(t, db.Create(order).Error)
	require.NoError(t, db.Create(topup).Error)

	require.NoError(t, upsertSubscriptionTopUpTx(db, order))
	var stored TopUp
	require.NoError(t, db.Where("trade_no = ?", order.TradeNo).First(&stored).Error)
	require.Equal(t, PaymentProviderEpay, stored.PaymentProvider)
	require.Equal(t, common.TopUpStatusSuccess, stored.Status)
}

func TestUpsertSubscriptionTopUpPersistsActualPaymentMethod(t *testing.T) {
	previousDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&SubscriptionOrder{}, &TopUp{}))
	DB = db
	t.Cleanup(func() {
		DB = previousDB
		_ = sqlDB.Close()
	})

	order := &SubscriptionOrder{
		UserId: 7, PlanId: 1, Money: 10, TradeNo: "subscription-link-method",
		PaymentProvider: PaymentProviderEpay, PaymentMethod: "alipay",
		Status: common.TopUpStatusPending,
	}
	topup := &TopUp{
		UserId: 7, Money: 10, TradeNo: order.TradeNo,
		PaymentProvider: PaymentProviderEpay, PaymentMethod: "alipay",
		Status: common.TopUpStatusPending,
	}
	require.NoError(t, db.Create(order).Error)
	require.NoError(t, db.Create(topup).Error)

	require.NoError(t, upsertSubscriptionTopUpTx(db, order, "wxpay"))
	var stored TopUp
	require.NoError(t, db.Where("trade_no = ?", order.TradeNo).First(&stored).Error)
	require.Equal(t, "wxpay", stored.PaymentMethod)
}
