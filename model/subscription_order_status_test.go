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
	require.NoError(t, db.AutoMigrate(&SubscriptionOrder{}, &TopUp{}))
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
	pendingTopUp := TopUp{UserId: pending.UserId, TradeNo: pending.TradeNo, PaymentProvider: PaymentProviderStripe, Status: common.TopUpStatusPending}
	successTopUp := TopUp{UserId: success.UserId, TradeNo: success.TradeNo, PaymentProvider: PaymentProviderStripe, Status: common.TopUpStatusSuccess}
	require.NoError(t, db.Create(&pendingTopUp).Error)
	require.NoError(t, db.Create(&successTopUp).Error)

	require.NoError(t, FailPendingSubscriptionOrder(pending.TradeNo, PaymentProviderStripe))
	var saved SubscriptionOrder
	require.NoError(t, db.Where("trade_no = ?", pending.TradeNo).First(&saved).Error)
	require.Equal(t, common.TopUpStatusFailed, saved.Status)
	require.Positive(t, saved.CompleteTime)
	var linkedTopUp TopUp
	require.NoError(t, db.Where("trade_no = ?", pending.TradeNo).First(&linkedTopUp).Error)
	require.Equal(t, common.TopUpStatusFailed, linkedTopUp.Status, "linked top-up must follow subscription failure")

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
	require.NoError(t, db.Where("trade_no = ?", success.TradeNo).First(&linkedTopUp).Error)
	require.Equal(t, common.TopUpStatusSuccess, linkedTopUp.Status, "late failure must not downgrade successful top-up")

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
		name             string
		userID           int
		provider         string
		status           string
		money            float64
		providerAmount  int64
		providerCurrency string
		wantErr          error
	}{
		{name: "different owner", userID: 99, provider: PaymentProviderEpay, status: common.TopUpStatusPending, wantErr: ErrPaymentMethodMismatch},
		{name: "different provider", userID: 7, provider: PaymentProviderStripe, status: common.TopUpStatusPending, wantErr: ErrPaymentMethodMismatch},
		{name: "terminal top-up", userID: 7, provider: PaymentProviderEpay, status: common.TopUpStatusExpired, wantErr: ErrTopUpStatusInvalid},
		{name: "different provider amount", userID: 7, provider: PaymentProviderEpay, status: common.TopUpStatusPending, providerAmount: 999, providerCurrency: "CNY", wantErr: ErrPaymentMethodMismatch},
		{name: "different provider currency", userID: 7, provider: PaymentProviderEpay, status: common.TopUpStatusPending, providerAmount: 1000, providerCurrency: "USD", wantErr: ErrPaymentMethodMismatch},
		{name: "different local amount", userID: 7, provider: PaymentProviderEpay, status: common.TopUpStatusPending, money: 11, providerAmount: 1000, providerCurrency: "CNY", wantErr: ErrPaymentMethodMismatch},
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
			money := tc.money
			if money == 0 {
				money = 10
			}
			topup := &TopUp{
				UserId: tc.userID, Money: money, TradeNo: tradeNo,
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

	require.NoError(t, upsertSubscriptionTopUpTx(db, order, ""))
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

func TestExpireSubscriptionOrderTransitionsLinkedTopUp(t *testing.T) {
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

	order := SubscriptionOrder{UserId: 44, PlanId: 1, Money: 10, TradeNo: "expire-linked-topup", PaymentProvider: PaymentProviderAlipay, Status: common.TopUpStatusPending}
	topup := TopUp{UserId: 44, TradeNo: order.TradeNo, Money: 10, PaymentProvider: PaymentProviderAlipay, Status: common.TopUpStatusPending}
	require.NoError(t, db.Create(&order).Error)
	require.NoError(t, db.Create(&topup).Error)

	require.NoError(t, ExpireSubscriptionOrder(order.TradeNo, PaymentProviderAlipay))
	var storedOrder SubscriptionOrder
	var storedTopUp TopUp
	require.NoError(t, db.Where("trade_no = ?", order.TradeNo).First(&storedOrder).Error)
	require.NoError(t, db.Where("trade_no = ?", order.TradeNo).First(&storedTopUp).Error)
	require.Equal(t, common.TopUpStatusExpired, storedOrder.Status)
	require.Equal(t, common.TopUpStatusExpired, storedTopUp.Status)
}

func TestSubscriptionFailurePreservesInconsistentSuccessfulTopUp(t *testing.T) {
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

	order := SubscriptionOrder{UserId: 45, PlanId: 1, Money: 10, TradeNo: "failed-linked-success-topup", PaymentProvider: PaymentProviderEpay, Status: common.TopUpStatusPending}
	topup := TopUp{UserId: 45, TradeNo: order.TradeNo, Money: 10, PaymentProvider: PaymentProviderEpay, Status: common.TopUpStatusSuccess}
	require.NoError(t, db.Create(&order).Error)
	require.NoError(t, db.Create(&topup).Error)

	require.ErrorIs(t, FailPendingSubscriptionOrder(order.TradeNo, PaymentProviderEpay), ErrTopUpStatusInvalid)
	var storedOrder SubscriptionOrder
	var storedTopUp TopUp
	require.NoError(t, db.Where("trade_no = ?", order.TradeNo).First(&storedOrder).Error)
	require.NoError(t, db.Where("trade_no = ?", order.TradeNo).First(&storedTopUp).Error)
	require.Equal(t, common.TopUpStatusPending, storedOrder.Status, "the inconsistent pair must be reconciled, not terminalized")
	require.Equal(t, common.TopUpStatusSuccess, storedTopUp.Status)
}

func TestCompleteSubscriptionOrderReplayRepairsMissingTopUp(t *testing.T) {
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

	order := SubscriptionOrder{
		UserId: 71, PlanId: 1, Money: 12.5, TradeNo: "subscription-replay-repair",
		PaymentProvider: PaymentProviderAlipay, PaymentMethod: "alipay",
		ProviderAmount: 1250, ProviderCurrency: "CNY",
		Status: common.TopUpStatusSuccess, CompleteTime: common.GetTimestamp(),
	}
	require.NoError(t, db.Create(&order).Error)

	require.NoError(t, CompleteSubscriptionOrder(order.TradeNo, "", PaymentProviderAlipay, ""))
	var topup TopUp
	require.NoError(t, db.Where("trade_no = ?", order.TradeNo).First(&topup).Error)
	require.Equal(t, order.UserId, topup.UserId)
	require.Equal(t, order.PaymentProvider, topup.PaymentProvider)
	require.Equal(t, order.Money, topup.Money)
	require.Equal(t, common.TopUpStatusSuccess, topup.Status)
}

func TestCompleteSubscriptionOrderReplayRejectsConflictingTopUp(t *testing.T) {
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

	order := SubscriptionOrder{
		UserId: 71, PlanId: 1, Money: 12.5, TradeNo: "subscription-replay-conflict",
		PaymentProvider: PaymentProviderAlipay, PaymentMethod: "alipay",
		Status: common.TopUpStatusSuccess, CompleteTime: common.GetTimestamp(),
	}
	topup := TopUp{
		UserId: 72, Money: 12.5, TradeNo: order.TradeNo,
		PaymentProvider: PaymentProviderAlipay, Status: common.TopUpStatusPending,
	}
	require.NoError(t, db.Create(&order).Error)
	require.NoError(t, db.Create(&topup).Error)

	require.ErrorIs(t, CompleteSubscriptionOrder(order.TradeNo, "", PaymentProviderAlipay, ""), ErrPaymentMethodMismatch)
	var stored TopUp
	require.NoError(t, db.Where("trade_no = ?", order.TradeNo).First(&stored).Error)
	require.Equal(t, 72, stored.UserId)
	require.Equal(t, common.TopUpStatusPending, stored.Status)
}

func TestSubscriptionTerminalTransitionRejectsConflictingLinkedTopUp(t *testing.T) {
	cases := []struct {
		name      string
		topupUser int
		provider  string
	}{
		{name: "different owner", topupUser: 92, provider: PaymentProviderEpay},
		{name: "different provider", topupUser: 91, provider: PaymentProviderStripe},
	}
	for i, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
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

			tradeNo := fmt.Sprintf("subscription-terminal-identity-%d", i)
			order := SubscriptionOrder{UserId: 91, PlanId: 1, Money: 10, TradeNo: tradeNo, PaymentProvider: PaymentProviderEpay, Status: common.TopUpStatusPending}
			topup := TopUp{UserId: tc.topupUser, TradeNo: tradeNo, PaymentProvider: tc.provider, Status: common.TopUpStatusPending}
			require.NoError(t, db.Create(&order).Error)
			require.NoError(t, db.Create(&topup).Error)

			require.ErrorIs(t, FailPendingSubscriptionOrder(tradeNo, PaymentProviderEpay), ErrPaymentMethodMismatch)
			var storedOrder SubscriptionOrder
			var storedTopUp TopUp
			require.NoError(t, db.Where("trade_no = ?", tradeNo).First(&storedOrder).Error)
			require.NoError(t, db.Where("trade_no = ?", tradeNo).First(&storedTopUp).Error)
			require.Equal(t, common.TopUpStatusPending, storedOrder.Status, "subscription transition must roll back")
			require.Equal(t, common.TopUpStatusPending, storedTopUp.Status, "conflicting linked top-up must remain untouched")
		})
	}
}
