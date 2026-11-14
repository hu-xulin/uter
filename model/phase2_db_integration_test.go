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
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/uter-ai/uter/common"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Phase-2 database-integration suite. Every subtest owns a real file-backed
// SQLite database in t.TempDir() and uses ONLY its own *gorm.DB handle. The
// global model.DB / model.LOG_DB and any production database file are never
// opened or mutated. The DSN mirrors production (WAL + busy_timeout(30000) +
// BEGIN IMMEDIATE + foreign_keys(1) via common.SQLiteForeignKeysEnabledDSN),
// so closing and reopening a file is a genuine crash-recovery check rather
// than an in-memory shortcut, and FK enforcement is real on every connection.
//
// All helpers are private with a distinct "phase2" prefix so this file compiles
// standalone and never redeclares symbols from isolated_db_integration_test.go.
//
// Real business functions creditTopUpQuota / claimPendingTopUp are exercised
// directly: they take a *gorm.DB tx argument and touch no global state. The
// other four (RecordTopupLog, logAlreadyPersisted -> global LOG_DB;
// CreateRefundIntent, ExecuteRefundIntent -> global DB) are intentionally NOT
// called: they operate on the package-global handle, which would either hit
// the production DB or require mutating global state, both forbidden here.
// Their equivalents are built with real SQL on the isolated handle instead.

// phase2Open builds its DSN through the shared production helper, so every
// test exercises the exact real connection-init path (WAL, busy timeout, BEGIN
// IMMEDIATE and per-connection foreign_keys(1)) without duplicating any pragma
// literal. See common.SQLiteForeignKeysEnabledDSN.
func phase2Open(t *testing.T, path string) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(common.SQLiteForeignKeysEnabledDSN(path)), &gorm.Config{
		// Expected unique-constraint / closed-pool failures are asserted below;
		// logging every rejected statement would bury the real result.
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	return db
}

func phase2Close(t *testing.T, db *gorm.DB) {
	t.Helper()
	sqlDB, err := db.DB()
	require.NoError(t, err)
	require.NoError(t, sqlDB.Close())
}

// phase2NewDB creates a fresh migrated file DB with the real User, TopUp, Log
// and RefundIntent schemas, plus one deliberately plain helper table used to
// observe crash recovery of committed vs uncommitted writes with exact,
// self-controlled table/column names (no guessed GORM table names in raw SQL).
func phase2NewDB(t *testing.T) (*gorm.DB, string) {
	t.Helper()
	path := filepath.Join(t.TempDir(), "phase2-integration.db")
	db := phase2Open(t, path)
	require.NoError(t, db.AutoMigrate(&User{}, &TopUp{}, &Log{}, &RefundIntent{}))
	// Mirror the real startup path: AutoMigrate creates the base tables, then
	// the versioned migration framework adds the real FK constraints.
	require.NoError(t, MigrateSchemaUp(db))
	require.NoError(t, db.Exec(
		"CREATE TABLE IF NOT EXISTS phase2_crash_rows (id INTEGER PRIMARY KEY AUTOINCREMENT, note TEXT)").Error)
	return db, path
}

// phase2IndexExists reports whether an index is present in the SQLite schema.
func phase2IndexExists(t *testing.T, db *gorm.DB, name string) bool {
	t.Helper()
	var n int64
	require.NoError(t, db.Raw(
		"SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = ?", name).Scan(&n).Error)
	return n > 0
}

// phase2User builds an obviously-EXAMPLE synthetic row. It is a constraint /
// consistency fixture inside an isolated temp DB, never a real credential.
func phase2User(username string, quota int) User {
	return User{
		Username: username,
		Password: "EXAMPLE-PLACEHOLDER-NOT-A-CREDENTIAL",
		Quota:    quota,
		AffCode:  "AFF-EXAMPLE-" + username, // users.aff_code carries a unique index
	}
}

func phase2CountUsers(t *testing.T, db *gorm.DB, username string) int64 {
	t.Helper()
	var n int64
	require.NoError(t, db.Model(&User{}).Where("username = ?", username).Count(&n).Error)
	return n
}

func phase2QuotaOf(t *testing.T, db *gorm.DB, userID int) int {
	t.Helper()
	var q int
	require.NoError(t, db.Model(&User{}).Where("id = ?", userID).Select("quota").Scan(&q).Error)
	return q
}

func phase2CountLogsByRequest(t *testing.T, db *gorm.DB, requestID string) int64 {
	t.Helper()
	var n int64
	require.NoError(t, db.Model(&Log{}).Where("request_id = ?", requestID).Count(&n).Error)
	return n
}

func phase2CountOrdersByTrade(t *testing.T, db *gorm.DB, tradeNo string) int64 {
	t.Helper()
	var n int64
	require.NoError(t, db.Model(&TopUp{}).Where("trade_no = ?", tradeNo).Count(&n).Error)
	return n
}

func phase2CountCrashRows(t *testing.T, db *gorm.DB, note string) int64 {
	t.Helper()
	var n int64
	require.NoError(t, db.Table("phase2_crash_rows").Where("note = ?", note).Count(&n).Error)
	return n
}

// phase2CreateOrder persists a pending order with a provider pricing snapshot.
func phase2CreateOrder(t *testing.T, db *gorm.DB, tradeNo string, userID, quotaDelta int,
	providerAmount int64, providerCurrency string) TopUp {
	t.Helper()
	order := TopUp{
		TradeNo:          tradeNo,
		UserId:           userID,
		Money:            float64(quotaDelta),
		Amount:           float64(quotaDelta),
		PaymentMethod:    "EXAMPLE-METHOD",
		PaymentProvider:  "EXAMPLE-PROVIDER",
		Status:           common.TopUpStatusPending,
		ProviderAmount:   providerAmount,
		ProviderCurrency: providerCurrency,
		CreateTime:       common.GetTimestamp(),
	}
	require.NoError(t, db.Create(&order).Error)
	return order
}

// phase2CompleteOrder reproduces the real settlement path on the isolated tx:
// claimPendingTopUp is the database-side idempotency gate (conditional
// pending->success UPDATE); only the winner credits the wallet via
// creditTopUpQuota and writes one Log ledger row. A repeat/concurrent call
// sees the order already success -> (false, nil): no double credit.
func phase2CompleteOrder(db *gorm.DB, tradeNo string, userID, quotaDelta int, requestID string) (bool, error) {
	credited := false
	err := db.Transaction(func(tx *gorm.DB) error {
		claimed, err := claimPendingTopUp(tx, tradeNo, nil)
		if err != nil {
			return err
		}
		if !claimed {
			return nil // idempotent repeat: order already completed
		}
		if err := creditTopUpQuota(tx, userID, quotaDelta, nil); err != nil {
			return err
		}
		ledger := Log{
			UserId:    userID,
			Type:      LogTypeTopup,
			Quota:     quotaDelta,
			RequestId: requestID,
			CreatedAt: common.GetTimestamp(),
			Content:   "EXAMPLE-LEDGER-CREDIT",
			Username:  "example-user",
		}
		if err := tx.Create(&ledger).Error; err != nil {
			return err
		}
		credited = true
		return nil
	})
	return credited, err
}

// phase2CrashUncommitted starts a real SQLite transaction on a raw connection,
// writes N rows, and then "crashes" (closes the whole pool) WITHOUT ever
// issuing COMMIT. SQLite rolls back any still-open transaction when its
// physical connection is torn down - the same recovery a killed process
// triggers - so none of these rows may appear after reopening the file.
func phase2CrashUncommitted(t *testing.T, db *gorm.DB, notes ...string) {
	t.Helper()
	sqlDB, err := db.DB()
	require.NoError(t, err)
	ctx := context.Background()
	conn, err := sqlDB.Conn(ctx)
	require.NoError(t, err)
	_, err = conn.ExecContext(ctx, "BEGIN IMMEDIATE")
	require.NoError(t, err)
	for _, note := range notes {
		_, err = conn.ExecContext(ctx, "INSERT INTO phase2_crash_rows (note) VALUES (?)", note)
		require.NoError(t, err)
	}
	// Deliberately NO COMMIT. Return the connection to the pool while it is
	// still inside a driver-level transaction, then close the pool so the
	// physical connection is torn down and the open tx is rolled back.
	require.NoError(t, conn.Close())
	require.NoError(t, sqlDB.Close())
}

// phase2CrashCommitted writes a row in autocommit (no explicit BEGIN) on a raw
// connection and then crashes the pool. Autocommit is committed at the engine
// level, so the row MUST survive reopen - the control case for crash tests.
func phase2CrashCommitted(t *testing.T, db *gorm.DB, note string) {
	t.Helper()
	sqlDB, err := db.DB()
	require.NoError(t, err)
	ctx := context.Background()
	conn, err := sqlDB.Conn(ctx)
	require.NoError(t, err)
	_, err = conn.ExecContext(ctx, "INSERT INTO phase2_crash_rows (note) VALUES (?)", note)
	require.NoError(t, err)
	require.NoError(t, conn.Close())
	require.NoError(t, sqlDB.Close())
}

func TestPhase2DBIntegration(t *testing.T) {
	// ------------------------------------------------------------------
	// 1) Connection, schema, migration
	// ------------------------------------------------------------------
	t.Run("db_01_connection", func(t *testing.T) {
		db, _ := phase2NewDB(t)
		defer phase2Close(t, db)
		sqlDB, err := db.DB()
		require.NoError(t, err)
		require.NoError(t, sqlDB.Ping(), "real file DB must answer ping")
		var journal string
		require.NoError(t, sqlDB.QueryRow("PRAGMA journal_mode").Scan(&journal))
		t.Logf("observed PRAGMA journal_mode=%q", journal)
		require.Equal(t, "wal", strings.ToLower(journal), "production DSN must enable WAL")
	})

	t.Run("db_02_schema_init", func(t *testing.T) {
		db, _ := phase2NewDB(t)
		defer phase2Close(t, db)
		require.True(t, db.Migrator().HasTable(&User{}))
		require.True(t, db.Migrator().HasTable(&TopUp{}))
		require.True(t, db.Migrator().HasTable(&Log{}))
		require.True(t, db.Migrator().HasTable(&RefundIntent{}))
		require.True(t, db.Migrator().HasColumn(&User{}, "quota"))
		require.True(t, db.Migrator().HasColumn(&TopUp{}, "trade_no"))
		require.True(t, db.Migrator().HasColumn(&Log{}, "request_id"))
		require.True(t, db.Migrator().HasColumn(&RefundIntent{}, "idempotency_key"))
	})

	t.Run("db_03_migration", func(t *testing.T) {
		db, path := phase2NewDB(t)
		sentinel := phase2User("upgrade-sentinel", 321)
		require.NoError(t, db.Create(&sentinel).Error)
		// Re-running migration must be idempotent and preserve data.
		require.NoError(t, db.AutoMigrate(&User{}, &TopUp{}, &Log{}, &RefundIntent{}))
		require.Equal(t, int64(1), phase2CountUsers(t, db, "upgrade-sentinel"))
		require.Equal(t, 321, phase2QuotaOf(t, db, sentinel.Id))
		phase2Close(t, db)
		reopened := phase2Open(t, path)
		require.NoError(t, reopened.AutoMigrate(&User{}, &TopUp{}, &Log{}, &RefundIntent{}))
		require.Equal(t, int64(1), phase2CountUsers(t, reopened, "upgrade-sentinel"),
			"startup #2 migration must leave existing balance rows intact")
		phase2Close(t, reopened)
	})

	t.Run("db_04_migration_rollback", func(t *testing.T) {
		db, _ := phase2NewDB(t)
		defer phase2Close(t, db)
		// Business data must survive an upgrade + rollback untouched.
		sentinel := phase2User("rollback-sentinel", 321)
		require.NoError(t, db.Create(&sentinel).Error)

		// A real versioned framework exists now: startup applied V1 (FK) + V2
		// (reversible index) and recorded both in schema_migrations.
		version, err := SchemaVersion(db)
		require.NoError(t, err)
		require.Equal(t, LatestSchemaVersion(), version)
		require.True(t, phase2IndexExists(t, db, V2TopUpUserStatusIndex))
		require.NoError(t, VerifySchemaVersionConsistency(db))

		// Real down migration: roll V2 back to V1. V2.Down drops the index and
		// the framework removes the V2 version record, both in one transaction.
		require.NoError(t, MigrateSchemaDown(db, 1))
		require.False(t, phase2IndexExists(t, db, V2TopUpUserStatusIndex),
			"V2 Down must actually drop the index")
		version, err = SchemaVersion(db)
		require.NoError(t, err)
		require.Equal(t, 1, version, "V2 version record must be removed")
		require.Equal(t, int64(1), phase2CountUsers(t, db, "rollback-sentinel"),
			"business rows must survive the down migration")
		require.NoError(t, VerifySchemaVersionConsistency(db),
			"schema/ledger stay consistent after a real down migration")

		// V1 is irreversible: rolling back past it must fail closed and leave
		// the schema exactly as it was (the pre-check forbids a partial rollback).
		err = MigrateSchemaDown(db, 0)
		require.Error(t, err)
		require.Contains(t, err.Error(), "irreversible")
		version, err = SchemaVersion(db)
		require.NoError(t, err)
		require.Equal(t, 1, version, "irreversible refusal must not change the version")
		require.False(t, phase2IndexExists(t, db, V2TopUpUserStatusIndex),
			"no partial rollback: V2 stays rolled back")
		require.Equal(t, int64(1), phase2CountUsers(t, db, "rollback-sentinel"))
		t.Logf("real down migration exercised: V2 rolled back, V1 rollback refused (irreversible)")
	})

	// ------------------------------------------------------------------
	// 2) Transaction commit / rollback across a real crash recovery
	// ------------------------------------------------------------------
	t.Run("db_05_transaction_commit", func(t *testing.T) {
		db, path := phase2NewDB(t)
		committed := phase2User("committed-user", 500)
		require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
			return tx.Create(&committed).Error
		}))
		phase2Close(t, db) // crash after commit
		reopened := phase2Open(t, path)
		defer phase2Close(t, reopened)
		require.Equal(t, int64(1), phase2CountUsers(t, reopened, "committed-user"),
			"committed rows must survive close+reopen (WAL recovery)")
		require.Equal(t, 500, phase2QuotaOf(t, reopened, committed.Id))
	})

	t.Run("db_06_transaction_rollback", func(t *testing.T) {
		db, path := phase2NewDB(t)
		rolledBack := phase2User("rolled-back-user", 999)
		injected := errors.New("injected settlement failure")
		err := db.Transaction(func(tx *gorm.DB) error {
			if e := tx.Create(&rolledBack).Error; e != nil {
				return e
			}
			return injected
		})
		require.ErrorIs(t, err, injected)
		require.Equal(t, int64(0), phase2CountUsers(t, db, "rolled-back-user"))
		phase2Close(t, db) // crash after the failed transaction
		reopened := phase2Open(t, path)
		defer phase2Close(t, reopened)
		require.Equal(t, int64(0), phase2CountUsers(t, reopened, "rolled-back-user"),
			"a rolled-back row must never reappear after recovery")
	})

	// ------------------------------------------------------------------
	// 3) Constraints under concurrency
	// ------------------------------------------------------------------
	t.Run("db_07_concurrent_writes", func(t *testing.T) {
		db, _ := phase2NewDB(t)
		defer phase2Close(t, db)
		const writers = 8
		var wg sync.WaitGroup
		errs := make([]error, writers)
		wg.Add(writers)
		for i := 0; i < writers; i++ {
			go func(i int) {
				defer wg.Done()
				candidate := User{
					Username: "same-username",
					Password: "EXAMPLE-PLACEHOLDER-NOT-A-CREDENTIAL",
					AffCode:  fmt.Sprintf("AFF-writer-%d", i),
				}
				errs[i] = db.Create(&candidate).Error
			}(i)
		}
		wg.Wait()
		succeeded := 0
		for i, err := range errs {
			if err == nil {
				succeeded++
				continue
			}
			require.NotContains(t, err.Error(), "database is locked",
				"writer %d: WAL+busy_timeout must serialise, not drop", i)
			require.Contains(t, err.Error(), "UNIQUE constraint failed")
		}
		require.Equal(t, 1, succeeded, "exactly one writer wins the unique username")
		require.Equal(t, int64(1), phase2CountUsers(t, db, "same-username"))
	})

	t.Run("db_08_unique_constraint", func(t *testing.T) {
		db, _ := phase2NewDB(t)
		defer phase2Close(t, db)
		// V1 added a real FK top_ups.user_id -> users.id, so a legal parent user
		// is required. Creating one is correct business behaviour, not a
		// weakened assertion. The unique trade_no index is recreated by V1's
		// table rebuild, which this subtest verifies is still enforced.
		user := phase2User("unique-user", 0)
		require.NoError(t, db.Create(&user).Error)
		first := phase2CreateOrder(t, db, "EXAMPLE-TRADE-NO-0001", user.Id, 10, 0, "")
		duplicate := TopUp{TradeNo: first.TradeNo, UserId: user.Id, Money: 10, Amount: 10, PaymentMethod: "EXAMPLE-METHOD"}
		err := db.Create(&duplicate).Error
		require.Error(t, err)
		require.Contains(t, err.Error(), "UNIQUE constraint failed")
		require.Equal(t, int64(1), phase2CountOrdersByTrade(t, db, "EXAMPLE-TRADE-NO-0001"),
			"duplicate trade_no must never be persisted")
	})

	t.Run("db_09_foreign_key", func(t *testing.T) {
		db, _ := phase2NewDB(t)
		defer phase2Close(t, db)
		sqlDB, err := db.DB()
		require.NoError(t, err)
		var fkOn int
		require.NoError(t, sqlDB.QueryRow("PRAGMA foreign_keys").Scan(&fkOn))
		fkRelations := 0
		if rows, qerr := sqlDB.Query("PRAGMA foreign_key_list(top_ups)"); qerr == nil {
			for rows.Next() {
				fkRelations++
			}
			_ = rows.Close()
		}
		t.Logf("observed PRAGMA foreign_keys=%d, top_ups FK relations=%d", fkOn, fkRelations)

		// FAIL CLOSED. The previous suite treated "FK off / no relations /
		// orphan accepted" as a PASS (require.NoError) — a FALSE PASS masking a
		// real data-integrity defect. Any of those conditions now fails hard.
		if fkOn != 1 {
			t.Fatalf("PRAGMA foreign_keys must be 1 on every connection, got %d", fkOn)
		}
		if fkRelations == 0 {
			t.Fatalf("top_ups must declare at least one FK relation (V1 migration missing)")
		}

		// A legal parent + order is accepted.
		user := phase2User("fk-legal-user", 0)
		require.NoError(t, db.Create(&user).Error)
		require.NoError(t, phase2CreateOrderOrError(t, db, "EXAMPLE-LEGAL-ORDER", user.Id, 10),
			"a legal order referencing an existing user must succeed")
		require.Equal(t, int64(1), phase2CountOrdersByTrade(t, db, "EXAMPLE-LEGAL-ORDER"))

		// An orphan order MUST be rejected and NOT persisted.
		orphan := phase2CreateOrderOrError(t, db, "EXAMPLE-ORPHAN-ORDER", 99999999, 10)
		if orphan == nil {
			t.Fatalf("orphan order referencing a non-existent user was ACCEPTED (FK not enforced)")
		}
		require.Equal(t, int64(0), phase2CountOrdersByTrade(t, db, "EXAMPLE-ORPHAN-ORDER"),
			"orphan order must NOT be persisted")
		t.Logf("FK enforced (foreign_keys=%d, relations=%d): legal order accepted, orphan rejected", fkOn, fkRelations)
	})

	// ------------------------------------------------------------------
	// 4) Ledger / balance consistency, idempotency
	// ------------------------------------------------------------------
	t.Run("db_10_data_consistency", func(t *testing.T) {
		db, _ := phase2NewDB(t)
		defer phase2Close(t, db)
		user := phase2User("ledger-user", 0)
		require.NoError(t, db.Create(&user).Error)
		deltas := []int{100, 250, 75, 400, 25}
		for i, d := range deltas {
			tradeNo := fmt.Sprintf("EXAMPLE-TRADE-NO-10-%02d", i)
			reqID := fmt.Sprintf("EXAMPLE-REQ-10-%02d", i)
			phase2CreateOrder(t, db, tradeNo, user.Id, d, 0, "")
			credited, err := phase2CompleteOrder(db, tradeNo, user.Id, d, reqID)
			require.NoError(t, err)
			require.True(t, credited)
		}
		balance := phase2QuotaOf(t, db, user.Id)
		var ledgerSum int
		require.NoError(t, db.Model(&Log{}).Where("user_id = ?", user.Id).
			Select("COALESCE(SUM(quota),0)").Scan(&ledgerSum).Error)
		expected := 0
		for _, d := range deltas {
			expected += d
		}
		require.Equal(t, expected, ledgerSum, "ledger deltas must sum to the credited amount")
		require.Equal(t, ledgerSum, balance, "balance must equal the sum of ledger deltas")
		t.Logf("balance=%d ledgerSum=%d expected=%d", balance, ledgerSum, expected)
	})

	t.Run("db_11_idempotency", func(t *testing.T) {
		db, _ := phase2NewDB(t)
		defer phase2Close(t, db)
		user := phase2User("idem-user", 0)
		require.NoError(t, db.Create(&user).Error)
		const tradeNo = "EXAMPLE-TRADE-NO-0011"
		const reqID = "EXAMPLE-REQUEST-ID-0011"
		phase2CreateOrder(t, db, tradeNo, user.Id, 300, 0, "")

		first, err := phase2CompleteOrder(db, tradeNo, user.Id, 300, reqID)
		require.NoError(t, err)
		require.True(t, first)
		// Same request id processed a second time: idempotent repeat.
		second, err := phase2CompleteOrder(db, tradeNo, user.Id, 300, reqID)
		require.NoError(t, err)
		require.False(t, second, "second delivery must NOT credit again")

		require.Equal(t, 300, phase2QuotaOf(t, db, user.Id), "exactly one credit")
		require.Equal(t, int64(1), phase2CountLogsByRequest(t, db, reqID), "exactly one ledger row")
	})

	t.Run("db_12_duplicate_request", func(t *testing.T) {
		db, _ := phase2NewDB(t)
		defer phase2Close(t, db)
		user := phase2User("dup-user", 0)
		require.NoError(t, db.Create(&user).Error)
		const tradeNo = "EXAMPLE-TRADE-NO-0012"
		const reqID = "EXAMPLE-REQUEST-ID-0012"
		phase2CreateOrder(t, db, tradeNo, user.Id, 500, 0, "")

		const writers = 8
		type result struct {
			credited bool
			err      error
		}
		results := make([]result, writers)
		var wg sync.WaitGroup
		wg.Add(writers)
		for i := 0; i < writers; i++ {
			go func(i int) {
				defer wg.Done()
				c, e := phase2CompleteOrder(db, tradeNo, user.Id, 500, reqID)
				results[i] = result{c, e}
			}(i)
		}
		wg.Wait()
		winners := 0
		for i, r := range results {
			require.NoError(t, r.err, "writer %d must not hit a lock error", i)
			if r.credited {
				winners++
			}
		}
		require.Equal(t, 1, winners, "exactly one concurrent delivery wins")
		require.Equal(t, int64(1), phase2CountOrdersByTrade(t, db, tradeNo))
		require.Equal(t, 500, phase2QuotaOf(t, db, user.Id), "no double credit")
		require.Equal(t, int64(1), phase2CountLogsByRequest(t, db, reqID), "one ledger row")
	})

	// ------------------------------------------------------------------
	// 5) Locking, timeouts, pool, integrity
	// ------------------------------------------------------------------
	t.Run("db_13_lock_contention", func(t *testing.T) {
		db, _ := phase2NewDB(t)
		defer phase2Close(t, db)
		user := phase2User("contention-user", 0)
		require.NoError(t, db.Create(&user).Error)
		const writers = 8
		var wg sync.WaitGroup
		errs := make([]error, writers)
		wg.Add(writers)
		for i := 0; i < writers; i++ {
			go func(i int) {
				defer wg.Done()
				errs[i] = db.Transaction(func(tx *gorm.DB) error {
					return tx.Model(&User{}).Where("id = ?", user.Id).
						UpdateColumn("quota", gorm.Expr("quota + 1")).Error
				})
			}(i)
		}
		wg.Wait()
		for i, err := range errs {
			require.NoError(t, err, "writer %d: atomic increment must serialise", i)
		}
		require.Equal(t, writers, phase2QuotaOf(t, db, user.Id),
			"every committed increment survives; no lost updates")
	})

	t.Run("db_14_lock_timeout", func(t *testing.T) {
		db, _ := phase2NewDB(t)
		defer phase2Close(t, db)
		sqlDB, err := db.DB()
		require.NoError(t, err)
		var busyTimeout int
		require.NoError(t, sqlDB.QueryRow("PRAGMA busy_timeout").Scan(&busyTimeout))
		t.Logf("observed PRAGMA busy_timeout=%d", busyTimeout)
		require.Equal(t, 30000, busyTimeout, "DSN busy_timeout(30000) must be effective")
	})

	t.Run("db_15_connection_interrupt", func(t *testing.T) {
		db, _ := phase2NewDB(t)
		sqlDB, err := db.DB()
		require.NoError(t, err)
		require.NoError(t, sqlDB.Ping())
		require.NoError(t, sqlDB.Close()) // interrupt the underlying pool

		// Operations after the pool is closed must FAIL CLOSED, never silently
		// succeed against a stale/imaginary connection.
		var one int
		qerr := sqlDB.QueryRow("SELECT 1").Scan(&one)
		require.Error(t, qerr, "raw query on a closed pool must fail closed")
		gerr := db.Exec("SELECT 1").Error
		require.Error(t, gerr, "gorm query on a closed pool must fail closed")
		t.Logf("post-close errors: raw=%v gorm=%v", qerr, gerr)
	})

	t.Run("db_18_connection_pool", func(t *testing.T) {
		db, _ := phase2NewDB(t)
		defer phase2Close(t, db)
		sqlDB, err := db.DB()
		require.NoError(t, err)
		sqlDB.SetMaxOpenConns(4)
		sqlDB.SetMaxIdleConns(2)
		// Drive some real concurrent reads so the pool opens >1 connection.
		var wg sync.WaitGroup
		for i := 0; i < 8; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				var n int64
				_ = db.Model(&User{}).Count(&n).Error
			}()
		}
		wg.Wait()
		stats := sqlDB.Stats()
		t.Logf("pool stats: maxOpen=%d open=%d inUse=%d idle=%d waitCount=%d",
			stats.MaxOpenConnections, stats.OpenConnections, stats.InUse, stats.Idle, stats.WaitCount)
		require.Equal(t, 4, stats.MaxOpenConnections, "SetMaxOpenConns(4) must be reflected in Stats()")
		require.LessOrEqual(t, stats.OpenConnections, 4, "open connections never exceed the cap")
		require.GreaterOrEqual(t, stats.OpenConnections, 1, "at least one connection was really opened")
		require.GreaterOrEqual(t, stats.Idle, 0)
	})

	t.Run("db_19_integrity_check", func(t *testing.T) {
		db, _ := phase2NewDB(t)
		defer phase2Close(t, db)
		// Write some real rows first so integrity_check has content to scan.
		u := phase2User("integrity-user", 42)
		require.NoError(t, db.Create(&u).Error)
		phase2CreateOrder(t, db, "EXAMPLE-TRADE-NO-0019", u.Id, 42, 0, "")
		sqlDB, err := db.DB()
		require.NoError(t, err)
		var result string
		require.NoError(t, sqlDB.QueryRow("PRAGMA integrity_check").Scan(&result))
		t.Logf("observed PRAGMA integrity_check=%q", result)
		require.Equal(t, "ok", result)
	})

	// ------------------------------------------------------------------
	// 6) Full order -> credit -> ledger consistency
	// ------------------------------------------------------------------
	t.Run("db_20_order_balance_ledger_consistency", func(t *testing.T) {
		db, _ := phase2NewDB(t)
		defer phase2Close(t, db)
		user := phase2User("order-user", 0)
		require.NoError(t, db.Create(&user).Error)
		const tradeNo = "EXAMPLE-TRADE-NO-0020"
		const reqID = "EXAMPLE-REQUEST-ID-0020"
		const delta = 640
		const providerAmount int64 = 999
		const providerCurrency = "USD"
		phase2CreateOrder(t, db, tradeNo, user.Id, delta, providerAmount, providerCurrency)

		// Sequence #1: order -> credit -> ledger.
		first, err := phase2CompleteOrder(db, tradeNo, user.Id, delta, reqID)
		require.NoError(t, err)
		require.True(t, first)

		var order TopUp
		require.NoError(t, db.Where("trade_no = ?", tradeNo).First(&order).Error)
		require.Equal(t, common.TopUpStatusSuccess, order.Status)
		require.Equal(t, providerAmount, order.ProviderAmount, "amount snapshot must be preserved")
		require.Equal(t, providerCurrency, order.ProviderCurrency, "currency snapshot must be preserved")
		require.Equal(t, delta, phase2QuotaOf(t, db, user.Id), "final balance equals the single credit")
		require.Equal(t, int64(1), phase2CountOrdersByTrade(t, db, tradeNo), "one order row")
		require.Equal(t, int64(1), phase2CountLogsByRequest(t, db, reqID), "one ledger row")

		// Sequence #2: replay the exact same settlement (e.g. duplicate webhook
		// / lost ack). The trade_no unique constraint keeps the single order row
		// and claimPendingTopUp's gate prevents a second credit.
		second, err := phase2CompleteOrder(db, tradeNo, user.Id, delta, reqID)
		require.NoError(t, err)
		require.False(t, second, "replay must not credit again")
		require.Equal(t, delta, phase2QuotaOf(t, db, user.Id), "no double credit after replay")
		require.Equal(t, int64(1), phase2CountOrdersByTrade(t, db, tradeNo))
		require.Equal(t, int64(1), phase2CountLogsByRequest(t, db, reqID), "still exactly one ledger row")
	})

	// ------------------------------------------------------------------
	// 7) Process-crash / transaction-recovery
	// ------------------------------------------------------------------
	t.Run("db_16_process_crash", func(t *testing.T) {
		db, path := phase2NewDB(t)
		// Autocommit write (no explicit tx), then crash the pool.
		phase2CrashCommitted(t, db, "db16-committed-before-crash")
		reopened := phase2Open(t, path)
		defer phase2Close(t, reopened)
		require.Equal(t, int64(1), phase2CountCrashRows(t, reopened, "db16-committed-before-crash"),
			"a row written (autocommit) before the crash must persist after reopen")
	})

	t.Run("db_17_transaction_recovery", func(t *testing.T) {
		db, path := phase2NewDB(t)
		// A committed sentinel proves recovery keeps durable data...
		require.NoError(t, db.Exec(
			"INSERT INTO phase2_crash_rows (note) VALUES (?)", "db17-committed-sentinel").Error)
		// ...while a pending, UNCOMMITTED business write leaves no partial state.
		phase2CrashUncommitted(t, db, "db17-pending-write")
		reopened := phase2Open(t, path)
		defer phase2Close(t, reopened)
		require.Equal(t, int64(1), phase2CountCrashRows(t, reopened, "db17-committed-sentinel"),
			"committed data survives recovery")
		require.Equal(t, int64(0), phase2CountCrashRows(t, reopened, "db17-pending-write"),
			"pending-but-uncommitted write leaves NO partial state after reopen")
	})

	// ------------------------------------------------------------------
	// 8) Explicit fault injection
	// ------------------------------------------------------------------
	t.Run("fault_01_crash_before_commit", func(t *testing.T) {
		db, path := phase2NewDB(t)
		require.NoError(t, db.Exec(
			"INSERT INTO phase2_crash_rows (note) VALUES (?)", "fault01-sentinel").Error)
		phase2CrashUncommitted(t, db, "fault01-uncommitted") // open tx, insert, NO commit, crash
		reopened := phase2Open(t, path)
		defer phase2Close(t, reopened)
		require.Equal(t, int64(1), phase2CountCrashRows(t, reopened, "fault01-sentinel"),
			"previously committed sentinel survives the crash")
		require.Equal(t, int64(0), phase2CountCrashRows(t, reopened, "fault01-uncommitted"),
			"insert in an uncommitted tx must be absent after crash recovery")
	})

	t.Run("fault_02_commit_then_response_lost", func(t *testing.T) {
		db, _ := phase2NewDB(t)
		defer phase2Close(t, db)
		user := phase2User("fault02-user", 0)
		require.NoError(t, db.Create(&user).Error)
		const tradeNo = "EXAMPLE-TRADE-NO-FAULT-02"
		const reqID = "EXAMPLE-REQUEST-ID-FAULT-02"
		phase2CreateOrder(t, db, tradeNo, user.Id, 700, 0, "")

		// Commit succeeds but the acknowledgement is "lost" to the caller;
		// the client retries the same idempotency key.
		committed, err := phase2CompleteOrder(db, tradeNo, user.Id, 700, reqID)
		require.NoError(t, err)
		require.True(t, committed, "first call commits the credit")
		require.Equal(t, 700, phase2QuotaOf(t, db, user.Id))

		retried, err := phase2CompleteOrder(db, tradeNo, user.Id, 700, reqID)
		require.NoError(t, err)
		require.False(t, retried, "retry after lost ack must NOT double credit")
		require.Equal(t, 700, phase2QuotaOf(t, db, user.Id), "balance unchanged after replay")
		require.Equal(t, int64(1), phase2CountLogsByRequest(t, db, reqID), "still one ledger row")
	})

	t.Run("fault_03_same_request_concurrently", func(t *testing.T) {
		db, _ := phase2NewDB(t)
		defer phase2Close(t, db)
		user := phase2User("fault03-user", 0)
		require.NoError(t, db.Create(&user).Error)
		const tradeNo = "EXAMPLE-TRADE-NO-FAULT-03"
		const reqID = "EXAMPLE-REQUEST-ID-FAULT-03"
		phase2CreateOrder(t, db, tradeNo, user.Id, 880, 0, "")

		const writers = 8
		type result struct {
			credited bool
			err      error
		}
		results := make([]result, writers)
		var wg sync.WaitGroup
		wg.Add(writers)
		for i := 0; i < writers; i++ {
			go func(i int) {
				defer wg.Done()
				c, e := phase2CompleteOrder(db, tradeNo, user.Id, 880, reqID)
				results[i] = result{c, e}
			}(i)
		}
		wg.Wait()
		winners := 0
		for i, r := range results {
			require.NoError(t, r.err, "writer %d must not fail on lock contention", i)
			if r.credited {
				winners++
			}
		}
		require.Equal(t, 1, winners, "8 concurrent deliveries of one request -> exactly one credit")
		require.Equal(t, 880, phase2QuotaOf(t, db, user.Id))
		require.Equal(t, int64(1), phase2CountLogsByRequest(t, db, reqID))
	})

	t.Run("fault_04_partial_success_then_crash", func(t *testing.T) {
		db, path := phase2NewDB(t)
		// 3 writes in ONE transaction; the 3rd is forced to fail (primary-key
		// collision), so GORM rolls the whole tx back. No partial state may
		// survive the subsequent crash recovery.
		err := db.Transaction(func(tx *gorm.DB) error {
			stmts := []string{
				"INSERT INTO phase2_crash_rows (id, note) VALUES (101, 'fault04-w1')",
				"INSERT INTO phase2_crash_rows (id, note) VALUES (102, 'fault04-w2')",
				"INSERT INTO phase2_crash_rows (id, note) VALUES (101, 'fault04-w3')", // PK 101 collision
			}
			for _, s := range stmts {
				if e := tx.Exec(s).Error; e != nil {
					return e
				}
			}
			return nil
		})
		require.Error(t, err, "the 3rd write must fail on a primary-key collision")
		t.Logf("injected 3rd-write failure: %v", err)
		phase2Close(t, db) // crash after the rolled-back tx
		reopened := phase2Open(t, path)
		defer phase2Close(t, reopened)
		require.Equal(t, int64(0), phase2CountCrashRows(t, reopened, "fault04-w1"),
			"first write must be rolled back with the failed tx")
		require.Equal(t, int64(0), phase2CountCrashRows(t, reopened, "fault04-w2"),
			"second write must be rolled back with the failed tx")
		require.Equal(t, int64(0), phase2CountCrashRows(t, reopened, "fault04-w3"))
	})
}

// phase2CreateOrderOrError is like phase2CreateOrder but returns the create
// error instead of requiring success - used by the foreign-key honesty check,
// where the whole point is to observe whether the engine accepts the row.
func phase2CreateOrderOrError(t *testing.T, db *gorm.DB, tradeNo string, userID, quotaDelta int) error {
	t.Helper()
	order := TopUp{
		TradeNo:         tradeNo,
		UserId:          userID,
		Money:           float64(quotaDelta),
		Amount:          float64(quotaDelta),
		PaymentMethod:   "EXAMPLE-METHOD",
		PaymentProvider: "EXAMPLE-PROVIDER",
		Status:          common.TopUpStatusPending,
		CreateTime:      common.GetTimestamp(),
	}
	return db.Create(&order).Error
}
