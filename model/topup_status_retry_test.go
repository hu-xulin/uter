package model

import (
	"errors"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/uter-ai/uter/common"
	"gorm.io/gorm"
)

func setupTopUpStatusRetryTestDB(t *testing.T, migrate bool) {
	t.Helper()
	oldDB := DB
	oldType := common.MainDatabaseType()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}
	DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	if migrate {
		if err := db.AutoMigrate(&TopUp{}); err != nil {
			t.Fatalf("migrate test database: %v", err)
		}
	}
	t.Cleanup(func() {
		DB = oldDB
		common.SetMainDatabaseType(oldType)
	})
}

func TestUpdatePendingTopUpStatusDistinguishesMissingOrderFromDatabaseFailure(t *testing.T) {
	t.Run("missing order is classified as not found", func(t *testing.T) {
		setupTopUpStatusRetryTestDB(t, true)
		err := UpdatePendingTopUpStatus("missing-trade", PaymentProviderStripe, common.TopUpStatusFailed)
		if !errors.Is(err, ErrTopUpNotFound) {
			t.Fatalf("error = %v, want ErrTopUpNotFound", err)
		}
	})

	t.Run("database failure remains retryable", func(t *testing.T) {
		// Deliberately omit the TopUp table to simulate a storage/query failure.
		setupTopUpStatusRetryTestDB(t, false)
		err := UpdatePendingTopUpStatus("trade", PaymentProviderStripe, common.TopUpStatusFailed)
		if err == nil {
			t.Fatal("expected database error")
		}
		if errors.Is(err, ErrTopUpNotFound) {
			t.Fatalf("database failure was incorrectly classified as missing order: %v", err)
		}
	})
}

func TestRechargeTopUpDistinguishesMissingOrderFromDatabaseFailure(t *testing.T) {
	recharges := []struct {
		name string
		run  func() error
	}{
		{
			name: "epay",
			run: func() error {
				_, err := RechargeEpay("trade", "", "")
				return err
			},
		},
		{
			name: "official payment",
			run: func() error {
				_, err := rechargeOfficial("trade", PaymentProviderAlipay, "", "")
				return err
			},
		},
	}

	for _, recharge := range recharges {
		t.Run(recharge.name, func(t *testing.T) {
			t.Run("missing order is classified as not found", func(t *testing.T) {
				setupTopUpStatusRetryTestDB(t, true)
				err := recharge.run()
				if !errors.Is(err, ErrTopUpNotFound) {
					t.Fatalf("error = %v, want ErrTopUpNotFound", err)
				}
			})

			t.Run("database failure remains retryable", func(t *testing.T) {
				// Deliberately omit the TopUp table to simulate a storage/query failure.
				setupTopUpStatusRetryTestDB(t, false)
				err := recharge.run()
				if err == nil {
					t.Fatal("expected database error")
				}
				if errors.Is(err, ErrTopUpNotFound) {
					t.Fatalf("database failure was incorrectly classified as missing order: %v", err)
				}
			})
		})
	}
}

// TestUpdatePendingTopUpStatusUsesConditionalUpdate locks in F-13: the
// pending -> failed/expired transition must be decided by a conditional UPDATE
// that touches only the status column. A whole-struct Save from an in-memory
// copy would overwrite sibling columns written by a concurrent callback, and
// on SQLite (where lockForUpdate degrades to a plain SELECT) could let a loser
// resurrect or downgrade an order the winner already completed.
func TestUpdatePendingTopUpStatusUsesConditionalUpdate(t *testing.T) {
	setupTopUpStatusRetryTestDB(t, true)

	order := TopUp{
		UserId:          901,
		Amount:          2,
		Money:           10.0,
		TradeNo:         "cas-pending-order",
		PaymentMethod:   "alipay",
		PaymentProvider: PaymentProviderStripe,
		CreateTime:      common.GetTimestamp(),
		Status:          common.TopUpStatusPending,
	}
	if err := DB.Create(&order).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}

	if err := UpdatePendingTopUpStatus(order.TradeNo, PaymentProviderStripe, common.TopUpStatusExpired); err != nil {
		t.Fatalf("first transition failed: %v", err)
	}

	// A repeat callback (or a racer that read pending before the winner wrote)
	// must not be able to move the row a second time.
	err := UpdatePendingTopUpStatus(order.TradeNo, PaymentProviderStripe, common.TopUpStatusFailed)
	if !errors.Is(err, ErrTopUpStatusInvalid) {
		t.Fatalf("repeat transition error = %v, want ErrTopUpStatusInvalid", err)
	}

	var stored TopUp
	if err := DB.Where("trade_no = ?", order.TradeNo).First(&stored).Error; err != nil {
		t.Fatalf("reload order: %v", err)
	}
	if stored.Status != common.TopUpStatusExpired {
		t.Fatalf("status = %q, want %q", stored.Status, common.TopUpStatusExpired)
	}
	if stored.PaymentMethod != "alipay" || stored.Amount != 2 || stored.Money != 10.0 ||
		stored.PaymentProvider != PaymentProviderStripe {
		t.Fatalf("sibling columns were overwritten by a whole-struct save: %+v", stored)
	}
}

// TestUpdatePendingTopUpStatusKeepsProviderGuard verifies the conditional
// update did not bypass the payment-provider guard that precedes it.
func TestUpdatePendingTopUpStatusKeepsProviderGuard(t *testing.T) {
	setupTopUpStatusRetryTestDB(t, true)

	order := TopUp{
		UserId:          902,
		Amount:          1,
		Money:           5.0,
		TradeNo:         "cas-provider-guard",
		PaymentMethod:   "alipay",
		PaymentProvider: PaymentProviderCreem,
		CreateTime:      common.GetTimestamp(),
		Status:          common.TopUpStatusPending,
	}
	if err := DB.Create(&order).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}

	if err := UpdatePendingTopUpStatus(order.TradeNo, PaymentProviderStripe, common.TopUpStatusFailed); !errors.Is(err, ErrPaymentMethodMismatch) {
		t.Fatalf("error = %v, want ErrPaymentMethodMismatch", err)
	}
	var stored TopUp
	if err := DB.Where("trade_no = ?", order.TradeNo).First(&stored).Error; err != nil {
		t.Fatalf("reload order: %v", err)
	}
	if stored.Status != common.TopUpStatusPending {
		t.Fatalf("rejected transition changed status to %q", stored.Status)
	}
}
