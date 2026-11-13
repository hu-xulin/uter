// Copyright (C) 2023-2026 Uter.ai
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

package model

import (
	"errors"
	"fmt"
	"path/filepath"
	"sync"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Dedicated isolated-database integration suite. Unlike the package-level
// unit tests using ":memory:", every case here owns a real file-backed SQLite
// database inside t.TempDir(), so closing and reopening it is a genuine
// crash-recovery check. The DSN mirrors the production SQLite DSN in
// common/database.go (WAL + busy_timeout + BEGIN IMMEDIATE), which is what
// serialises writers on the balance/order path. No production database is
// ever opened, and no real payment or refund is performed.

const isolatedDBPragma = "?_pragma=busy_timeout(30000)&_pragma=journal_mode(WAL)&_txlock=immediate"

func openIsolatedSQLite(t *testing.T, path string) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(path+isolatedDBPragma), &gorm.Config{
		// Expected unique-constraint failures are asserted below; printing every
		// rejected INSERT as a GORM error log would bury the real result.
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	return db
}

// newIsolatedUser gives every row a distinct aff_code. That column carries a
// unique index in the real schema, so leaving it empty would trip a different
// constraint than the one each case is meant to exercise.
func newIsolatedUser(username string, quota int) User {
	return User{
		Username: username,
		Password: "test-only",
		Quota:    quota,
		AffCode:  "AFF-" + username,
	}
}

func closeIsolatedSQLite(t *testing.T, db *gorm.DB) {
	t.Helper()
	sqlDB, err := db.DB()
	require.NoError(t, err)
	require.NoError(t, sqlDB.Close())
}

// isolatedBusinessDB creates a fresh, migrated database containing the real
// User (quota) and TopUp (order) schemas.
func isolatedBusinessDB(t *testing.T) (*gorm.DB, string) {
	t.Helper()
	path := filepath.Join(t.TempDir(), "isolated-integration.db")
	db := openIsolatedSQLite(t, path)
	require.NoError(t, db.AutoMigrate(&User{}, &TopUp{}))
	return db, path
}

func countUsers(t *testing.T, db *gorm.DB, username string) int64 {
	t.Helper()
	var n int64
	require.NoError(t, db.Model(&User{}).Where("username = ?", username).Count(&n).Error)
	return n
}

func TestIsolatedDBMigrationIsIdempotentAcrossRestart(t *testing.T) {
	db, path := isolatedBusinessDB(t)
	sentinel := newIsolatedUser("upgrade-sentinel", 123)
	require.NoError(t, db.Create(&sentinel).Error)

	// Re-running migration must preserve both schema and existing data.
	require.NoError(t, db.AutoMigrate(&User{}, &TopUp{}))
	require.True(t, db.Migrator().HasTable(&User{}))
	require.True(t, db.Migrator().HasColumn(&User{}, "quota"))
	require.True(t, db.Migrator().HasColumn(&TopUp{}, "trade_no"))

	var quota int
	require.NoError(t, db.Model(&User{}).Where("username = ?", "upgrade-sentinel").Select("quota").Scan(&quota).Error)
	require.Equal(t, 123, quota, "re-migration must not drop existing balance data")

	// Startup #2 against the same file: migration again, data still present.
	closeIsolatedSQLite(t, db)
	reopened := openIsolatedSQLite(t, path)
	require.NoError(t, reopened.AutoMigrate(&User{}, &TopUp{}))
	require.Equal(t, int64(1), countUsers(t, reopened, "upgrade-sentinel"))
	closeIsolatedSQLite(t, reopened)
}

func TestIsolatedDBTransactionRollbackSurvivesCrashRecovery(t *testing.T) {
	db, path := isolatedBusinessDB(t)

	committed := newIsolatedUser("committed-user", 500)
	require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
		return tx.Create(&committed).Error
	}))

	rolledBack := newIsolatedUser("rolled-back-user", 999)
	injected := errors.New("injected settlement failure")
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&rolledBack).Error; err != nil {
			return err
		}
		return injected
	})
	require.ErrorIs(t, err, injected)
	require.Equal(t, int64(1), countUsers(t, db, "committed-user"))
	require.Equal(t, int64(0), countUsers(t, db, "rolled-back-user"))

	// Simulate a process crash after the failed transaction, then reopen.
	closeIsolatedSQLite(t, db)
	reopened := openIsolatedSQLite(t, path)
	require.Equal(t, int64(1), countUsers(t, reopened, "committed-user"))
	require.Equal(t, int64(0), countUsers(t, reopened, "rolled-back-user"),
		"a rolled-back order/balance row must never reappear after recovery")
	closeIsolatedSQLite(t, reopened)
}

func TestIsolatedDBConcurrentWritersRespectUniqueConstraint(t *testing.T) {
	db, _ := isolatedBusinessDB(t)
	defer func() { closeIsolatedSQLite(t, db) }()

	const writers = 8
	var wg sync.WaitGroup
	errs := make([]error, writers)
	wg.Add(writers)
	for i := range writers {
		go func(i int) {
			defer wg.Done()
			// Same username (the constraint under test) but distinct aff codes.
			candidate := User{
				Username: "same-username",
				Password: "test-only",
				AffCode:  fmt.Sprintf("AFF-writer-%d", i),
			}
			errs[i] = db.Create(&candidate).Error
		}(i)
	}
	wg.Wait()

	succeeded := 0
	for _, err := range errs {
		if err == nil {
			succeeded++
			continue
		}
		require.NotContains(t, err.Error(), "database is locked",
			"WAL + busy_timeout + BEGIN IMMEDIATE must serialise writers, not drop them")
		require.Contains(t, err.Error(), "UNIQUE constraint failed: users.username")
	}
	require.Equal(t, 1, succeeded, "exactly one writer may win the unique username")
	require.Equal(t, int64(1), countUsers(t, db, "same-username"))
}

func TestIsolatedDBConcurrentQuotaUpdatesNeverLoseIncrements(t *testing.T) {
	db, _ := isolatedBusinessDB(t)
	defer func() { closeIsolatedSQLite(t, db) }()

	user := newIsolatedUser("quota-user", 0)
	require.NoError(t, db.Create(&user).Error)

	const writers = 8
	var wg sync.WaitGroup
	errs := make([]error, writers)
	wg.Add(writers)
	for i := range writers {
		go func(i int) {
			defer wg.Done()
			errs[i] = db.Transaction(func(tx *gorm.DB) error {
				return tx.Model(&User{}).
					Where("id = ?", user.Id).
					UpdateColumn("quota", gorm.Expr("quota + 1")).Error
			})
		}(i)
	}
	wg.Wait()
	for i, err := range errs {
		require.NoError(t, err, "writer %d failed: %v", i, err)
	}

	var quota int
	require.NoError(t, db.Model(&User{}).Where("id = ?", user.Id).Select("quota").Scan(&quota).Error)
	require.Equal(t, writers, quota, "every committed increment must survive; no lost updates")
}

func TestIsolatedDBDuplicateTradeNoIsRejected(t *testing.T) {
	db, _ := isolatedBusinessDB(t)
	defer func() { closeIsolatedSQLite(t, db) }()

	first := TopUp{TradeNo: "ISOLATED-ORDER-001", Money: 10, Amount: 10, PaymentMethod: "test"}
	require.NoError(t, db.Create(&first).Error)

	duplicate := TopUp{TradeNo: first.TradeNo, Money: 10, Amount: 10, PaymentMethod: "test"}
	err := db.Create(&duplicate).Error
	require.Error(t, err)
	require.Contains(t, err.Error(), "UNIQUE constraint failed")

	var count int64
	require.NoError(t, db.Model(&TopUp{}).Where("trade_no = ?", first.TradeNo).Count(&count).Error)
	require.Equal(t, int64(1), count, "a duplicate payment order must never be persisted")
}
