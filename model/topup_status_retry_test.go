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

