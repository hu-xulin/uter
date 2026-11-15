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
	"fmt"
	"path/filepath"
	"sync"
	"testing"

	"github.com/uter-ai/uter/common"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Phase-2 business-function integration suite.
//
// phase2_db_integration_test.go deliberately reproduces four global-state
// functions with equivalent SQL on a private *gorm.DB. This suite closes that
// gap: it calls the REAL business functions instead:
//
//   - RecordTopupLog, logAlreadyPersisted   -> package-global LOG_DB
//   - CreateRefundIntent, ExecuteRefundIntent -> package-global DB
//
// Those functions hard-wire the package-global handles, so each subtest swaps
// DB / LOG_DB onto its OWN file-backed SQLite database created in t.TempDir()
// (never the production one-api.db) and restores them in t.Cleanup. Subtests
// are intentionally NOT parallel so the swap stays isolated. The DSN is built
// by common.SQLiteForeignKeysEnabledDSN (WAL + busy_timeout(30000) +
// BEGIN IMMEDIATE + foreign_keys(1)), so concurrent ExecuteRefundIntent calls
// serialise exactly like production. The same save/swap/cleanup pattern is used
// by refund_intent_test.go (TestSubscriptionRefundIntentRollsBackAllLegs).
//
// Every fixture row (user/token/order) is a synthetic, non-login record used
// only to satisfy real FK / ledger preconditions. No account or credential is
// created: the only Root account in this project is Uter.ai.
//
// Note on topup-log idempotency: RecordTopupLog itself mints a fresh request_id
// on every call (via createLog -> ensureLogRequestId) and has no dedupe of its
// own. The no-double-accounting guarantee is provided by the durable-write
// layer's idempotency gate logAlreadyPersisted (same request_id + type), which
// is exactly what is exercised below. This mirrors billing_integrity_test.go
// (TestLogWriteIdempotencyGuard) and log_writer.go's batch-write fallback.

func bfSetup(t *testing.T) *gorm.DB {
	t.Helper()
	path := filepath.Join(t.TempDir(), "phase2-business.db")
	db, err := gorm.Open(sqlite.Open(common.SQLiteForeignKeysEnabledDSN(path)), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)

	// Redirect the global handles used by the four business functions onto this
	// isolated file DB. Register cleanup BEFORE any further require so a later
	// failure still restores the globals and closes the pool.
	prevDB, prevLOGDB := DB, LOG_DB
	DB, LOG_DB = db, db
	t.Cleanup(func() {
		WaitCacheSyncForTest()
		DB, LOG_DB = prevDB, prevLOGDB
		_ = sqlDB.Close()
	})

	require.NoError(t, db.AutoMigrate(&User{}, &TopUp{}, &Log{}, &RefundIntent{}, &Token{}))
	// Mirror the real startup path: base tables above, then the versioned
	// framework installs the real top_ups.user_id -> users.id FK (V1) and the
	// user/status index (V2).
	require.NoError(t, MigrateSchemaUp(db))
	return db
}

// bfUser inserts a minimal, non-login fixture row (placeholder password only),
// required as a real parent for FK / balance / username lookups.
func bfUser(t *testing.T, db *gorm.DB, username string, quota int) User {
	t.Helper()
	u := User{
		Username: username,
		Password: "EXAMPLE-PLACEHOLDER-NOT-A-CREDENTIAL",
		Quota:    quota,
		AffCode:  "AFF-EXAMPLE-" + username,
	}
	require.NoError(t, db.Create(&u).Error)
	return u
}

func bfToken(t *testing.T, db *gorm.DB, userID int, remain, used int, key string) Token {
	t.Helper()
	tk := Token{
		UserId:      userID,
		Key:         key,
		Name:        "bf-example-token",
		Status:      1,
		RemainQuota: remain,
		UsedQuota:   used,
		CreatedTime: common.GetTimestamp(),
	}
	require.NoError(t, db.Create(&tk).Error)
	return tk
}

// bfWalletIntent is a personal-wallet refund snapshot (OrgId==0). When
// tokenConsumed>0 the implementation also rolls back the token quota leg.
func bfWalletIntent(userID, tokenID, walletAmount, tokenConsumed int, key string) RefundIntent {
	return RefundIntent{
		UserId:         userID,
		IdempotencyKey: key,
		FundingSource:  RefundSourceWallet,
		OrgResolved:    true,
		OrgId:          0,
		WalletAmount:   walletAmount,
		TokenId:        tokenID,
		TokenConsumed:  tokenConsumed,
	}
}

func bfQuotaOf(t *testing.T, db *gorm.DB, userID int) int {
	t.Helper()
	var q int
	require.NoError(t, db.Model(&User{}).Where("id = ?", userID).Select("quota").Scan(&q).Error)
	return q
}

func bfReloadIntent(t *testing.T, db *gorm.DB, id int) RefundIntent {
	t.Helper()
	var ri RefundIntent
	require.NoError(t, db.Where("id = ?", id).First(&ri).Error)
	return ri
}

func bfReloadToken(t *testing.T, db *gorm.DB, id int) Token {
	t.Helper()
	var tk Token
	require.NoError(t, db.Where("id = ?", id).First(&tk).Error)
	return tk
}

func bfCountTopupLogs(t *testing.T, db *gorm.DB) int64 {
	t.Helper()
	var n int64
	require.NoError(t, db.Model(&Log{}).Where("type = ?", LogTypeTopup).Count(&n).Error)
	return n
}

func TestPhase2BusinessFunctions(t *testing.T) {
	// ------------------------------------------------------------------
	// 1) RecordTopupLog + logAlreadyPersisted (real LOG_DB business functions)
	// ------------------------------------------------------------------
	t.Run("record_topup_log_writes_row", func(t *testing.T) {
		db := bfSetup(t)
		user := bfUser(t, db, "bf-topup-user", 100)
		const callerIP = "203.0.113.9"
		const method = "ALIPAY"
		const callbackMethod = "EPAY"

		RecordTopupLog(user.Id,
			common.NewMessage("Online top-up succeeded, quota={{quota}}", map[string]any{"quota": 200}),
			callerIP, method, callbackMethod)

		var rows []Log
		require.NoError(t, db.Where("type = ?", LogTypeTopup).Find(&rows).Error)
		require.Len(t, rows, 1, "exactly one LogTypeTopup ledger row")
		row := rows[0]
		require.Equal(t, user.Id, row.UserId)
		require.Equal(t, LogTypeTopup, row.Type)
		require.Equal(t, callerIP, row.Ip)
		require.NotEmpty(t, row.RequestId, "createLog must mint a request id")
		require.Greater(t, row.CreatedAt, int64(0))
		require.Contains(t, row.Content, "Online top-up succeeded")
		require.Contains(t, row.Content, "200", "message params must be rendered into content")
		// The admin snapshot written by RecordTopupLog must carry payment metadata.
		require.Contains(t, row.Other, "payment_method")
		require.Contains(t, row.Other, method)
		require.Contains(t, row.Other, "callback_payment_method")
		require.Contains(t, row.Other, callbackMethod)
		require.Contains(t, row.Other, callerIP)
		t.Logf("RecordTopupLog persisted one topup ledger row: id=%d request_id=%s", row.Id, row.RequestId)
	})

	t.Run("log_already_persisted_matches_committed_only", func(t *testing.T) {
		db := bfSetup(t)
		user := bfUser(t, db, "bf-guard-user", 0)

		require.False(t, logAlreadyPersisted(&Log{RequestId: "bf-not-yet", Type: LogTypeTopup}),
			"nothing stored yet")

		RecordTopupLog(user.Id, common.NewMessage("topup", nil), "198.51.100.7", "WECHAT", "WECHAT")
		var row Log
		require.NoError(t, db.Where("type = ?", LogTypeTopup).First(&row).Error)
		require.NotEmpty(t, row.RequestId)

		require.True(t, logAlreadyPersisted(&Log{RequestId: row.RequestId, Type: LogTypeTopup}),
			"committed (request_id, type) must be detected")
		require.False(t, logAlreadyPersisted(&Log{RequestId: "bf-other-request", Type: LogTypeTopup}),
			"a different request id must not be a duplicate")
		require.False(t, logAlreadyPersisted(&Log{RequestId: row.RequestId, Type: LogTypeError}),
			"same request id but a different type is a different record")
		require.False(t, logAlreadyPersisted(&Log{RequestId: "", Type: LogTypeTopup}),
			"an empty request id can never be deduplicated")
	})

	t.Run("record_topup_log_duplicate_delivery_gated", func(t *testing.T) {
		db := bfSetup(t)
		user := bfUser(t, db, "bf-dedupe-user", 0)

		// First delivery: the real business function writes the topup ledger row.
		RecordTopupLog(user.Id, common.NewMessage("topup", nil), "198.51.100.8", "WECHAT", "WECHAT")
		var first Log
		require.NoError(t, db.Where("type = ?", LogTypeTopup).First(&first).Error)
		require.EqualValues(t, 1, bfCountTopupLogs(t, db))

		// A retried delivery of the SAME logical request is rejected by the
		// durable-write layer's idempotency gate before any second write. (A
		// naive second RecordTopupLog would mint a NEW request_id, which is
		// precisely why logAlreadyPersisted exists as the (request_id,type) gate.)
		// This tells "write committed but ack lost" apart from "never written",
		// so the ledger that is summed for reports never doubles.
		retry := &Log{RequestId: first.RequestId, Type: LogTypeTopup}
		require.True(t, logAlreadyPersisted(retry), "guard must recognise the committed row")
		// Because the guard reports the row as already persisted, the duplicate
		// is NOT written again -> no duplicated ledger / no double accounting.
		require.EqualValues(t, 1, bfCountTopupLogs(t, db), "duplicate delivery must not add a ledger row")
		var byRequest int64
		require.NoError(t, db.Model(&Log{}).
			Where("request_id = ? AND type = ?", first.RequestId, LogTypeTopup).Count(&byRequest).Error)
		require.EqualValues(t, 1, byRequest, "no double accounting for one request id")

		// A genuinely new request id is not a duplicate and would be allowed through.
		require.False(t, logAlreadyPersisted(&Log{RequestId: "bf-new-request", Type: LogTypeTopup}))
	})

	// ------------------------------------------------------------------
	// 2) CreateRefundIntent (real DB business function)
	// ------------------------------------------------------------------
	t.Run("create_refund_intent_persists_pending", func(t *testing.T) {
		db := bfSetup(t)
		user := bfUser(t, db, "bf-intent-user", 100)
		token := bfToken(t, db, user.Id, 50, 20, "bf-key-pending")

		intent := bfWalletIntent(user.Id, token.Id, 30, 20, "bf-idem-pending")
		require.NoError(t, CreateRefundIntent(&intent))
		require.Greater(t, intent.Id, 0)

		stored := bfReloadIntent(t, db, intent.Id)
		require.Equal(t, RefundIntentPending, stored.Status)
		require.Equal(t, user.Id, stored.UserId)
		require.Equal(t, RefundSourceWallet, stored.FundingSource)
		require.True(t, stored.OrgResolved)
		require.Equal(t, 0, stored.OrgId)
		require.Equal(t, 30, stored.WalletAmount)
		require.Equal(t, token.Id, stored.TokenId)
		require.Equal(t, 20, stored.TokenConsumed)
		require.Greater(t, stored.CreateTime, int64(0))
		require.Greater(t, stored.UpdateTime, int64(0))
		var n int64
		require.NoError(t, db.Model(&RefundIntent{}).Where("idempotency_key = ?", "bf-idem-pending").Count(&n).Error)
		require.EqualValues(t, 1, n, "exactly one pending credential")
	})

	t.Run("create_refund_intent_idempotent_snapshot", func(t *testing.T) {
		db := bfSetup(t)
		user := bfUser(t, db, "bf-idem-user", 100)
		token := bfToken(t, db, user.Id, 50, 20, "bf-key-idem")

		original := bfWalletIntent(user.Id, token.Id, 30, 20, "bf-idem-same")
		require.NoError(t, CreateRefundIntent(&original))

		// Same immutable snapshot + same key -> idempotent reuse of the existing row.
		replay := original
		replay.Id = 0
		replay.Status = ""
		replay.CreateTime = 0
		replay.UpdateTime = 0
		require.NoError(t, CreateRefundIntent(&replay))
		require.Equal(t, original.Id, replay.Id, "same logical refund must reuse its durable intent")

		// Different snapshot under the same key -> rejected (fail closed).
		collision := original
		collision.Id = 0
		collision.Status = ""
		collision.CreateTime = 0
		collision.UpdateTime = 0
		collision.WalletAmount = 31
		err := CreateRefundIntent(&collision)
		require.Error(t, err)
		require.Contains(t, err.Error(), "collides")

		var n int64
		require.NoError(t, db.Model(&RefundIntent{}).Where("idempotency_key = ?", "bf-idem-same").Count(&n).Error)
		require.EqualValues(t, 1, n, "identical + conflicting replays never create a 2nd credential")
	})

	// ------------------------------------------------------------------
	// 3) ExecuteRefundIntent (real DB business function)
	// ------------------------------------------------------------------
	t.Run("execute_refund_intent_applies_once", func(t *testing.T) {
		db := bfSetup(t)
		user := bfUser(t, db, "bf-exec-user", 100)
		token := bfToken(t, db, user.Id, 50, 20, "bf-key-exec")

		intent := bfWalletIntent(user.Id, token.Id, 30, 20, "bf-idem-exec")
		require.NoError(t, CreateRefundIntent(&intent))
		require.Equal(t, RefundIntentPending, bfReloadIntent(t, db, intent.Id).Status)

		require.NoError(t, ExecuteRefundIntent(intent.Id))

		done := bfReloadIntent(t, db, intent.Id)
		require.Equal(t, RefundIntentDone, done.Status, "pending -> done")
		require.Equal(t, 30, done.WalletAmount, "snapshot preserved")
		require.Equal(t, 20, done.TokenConsumed)

		// Personal wallet (OrgId==0) credits user quota; token leg moves
		// used_quota back to remain_quota. Both exactly once.
		require.Equal(t, 130, bfQuotaOf(t, db, user.Id), "wallet refund credits quota once")
		tk := bfReloadToken(t, db, token.Id)
		require.Equal(t, 70, tk.RemainQuota, "token quota refunded once")
		require.Equal(t, 0, tk.UsedQuota, "token used_quota cleared once")
		t.Logf("ExecuteRefundIntent: quota 100->130, token remain 50->70 used 20->0, status done")
	})

	t.Run("execute_refund_intent_replay_is_noop", func(t *testing.T) {
		db := bfSetup(t)
		user := bfUser(t, db, "bf-replay-user", 100)
		token := bfToken(t, db, user.Id, 50, 20, "bf-key-replay")
		intent := bfWalletIntent(user.Id, token.Id, 30, 20, "bf-idem-replay")
		require.NoError(t, CreateRefundIntent(&intent))

		require.NoError(t, ExecuteRefundIntent(intent.Id))
		quotaAfterFirst := bfQuotaOf(t, db, user.Id)

		// Replay / executing a done intent returns nil with no side effects.
		require.NoError(t, ExecuteRefundIntent(intent.Id), "done intent must be a no-op")
		require.Equal(t, RefundIntentDone, bfReloadIntent(t, db, intent.Id).Status)
		require.Equal(t, quotaAfterFirst, bfQuotaOf(t, db, user.Id), "replay must not change balance")
		tk := bfReloadToken(t, db, token.Id)
		require.Equal(t, 70, tk.RemainQuota)
		require.Equal(t, 0, tk.UsedQuota)
		var n int64
		require.NoError(t, db.Model(&RefundIntent{}).Count(&n).Error)
		require.EqualValues(t, 1, n, "no extra credential from replay")
	})

	t.Run("execute_refund_intent_transaction_rollback", func(t *testing.T) {
		db := bfSetup(t)
		user := bfUser(t, db, "bf-rollback-user", 100)
		// Deliberately insufficient used_quota: the token leg fails AFTER the
		// wallet leg credited quota inside the SAME transaction.
		token := bfToken(t, db, user.Id, 50, 5, "bf-key-rollback")
		intent := bfWalletIntent(user.Id, token.Id, 30, 20, "bf-idem-rollback")
		require.NoError(t, CreateRefundIntent(&intent))

		err := ExecuteRefundIntent(intent.Id)
		require.Error(t, err, "a failed ledger leg must fail the whole refund")
		require.Contains(t, err.Error(), "token")

		// Both the wallet increment and any token change must be rolled back.
		require.Equal(t, 100, bfQuotaOf(t, db, user.Id), "wallet credit rolled back with the failed tx")
		tk := bfReloadToken(t, db, token.Id)
		require.Equal(t, 50, tk.RemainQuota, "token untouched after rollback")
		require.Equal(t, 5, tk.UsedQuota)
		require.Equal(t, RefundIntentPending, bfReloadIntent(t, db, intent.Id).Status,
			"intent stays pending and retryable after a rolled-back execution")
	})

	t.Run("execute_refund_intent_concurrent_once", func(t *testing.T) {
		db := bfSetup(t)
		user := bfUser(t, db, "bf-concurrent-user", 100)
		token := bfToken(t, db, user.Id, 50, 20, "bf-key-concurrent")
		intent := bfWalletIntent(user.Id, token.Id, 30, 20, "bf-idem-concurrent")
		require.NoError(t, CreateRefundIntent(&intent))

		const workers = 8
		errs := make([]error, workers)
		var wg sync.WaitGroup
		wg.Add(workers)
		for i := 0; i < workers; i++ {
			go func(i int) {
				defer wg.Done()
				errs[i] = ExecuteRefundIntent(intent.Id)
			}(i)
		}
		wg.Wait()
		for i, err := range errs {
			require.NoError(t, err, "worker %d: concurrent execution must serialise, not error", i)
		}
		require.Equal(t, 130, bfQuotaOf(t, db, user.Id), "exactly one wallet credit under 8 concurrent executions")
		tk := bfReloadToken(t, db, token.Id)
		require.Equal(t, 70, tk.RemainQuota, "exactly one token refund")
		require.Equal(t, 0, tk.UsedQuota)
		require.Equal(t, RefundIntentDone, bfReloadIntent(t, db, intent.Id).Status)
		var n int64
		require.NoError(t, db.Model(&RefundIntent{}).Count(&n).Error)
		require.EqualValues(t, 1, n)
		t.Logf("8 concurrent ExecuteRefundIntent calls -> one effective refund")
	})

	t.Run("execute_refund_intent_concurrent_once_stress", func(t *testing.T) {
		// Regression guard for the real concurrency defect found on 2026-11-15:
		// the idempotency CAS used to sit at the END of the transaction, so two
		// concurrent executors both replayed the token-refund leg against a
		// stale used_quota snapshot and one failed with
		// "token used quota is insufficient for refund". 20 isolated rounds x
		// 12 executors make that race deterministic to detect, not a flake.
		for round := 0; round < 20; round++ {
			t.Run(fmt.Sprintf("round_%02d", round), func(t *testing.T) {
				db := bfSetup(t)
				user := bfUser(t, db, "bf-stress-user", 100)
				token := bfToken(t, db, user.Id, 50, 20, "bf-key-stress")
				intent := bfWalletIntent(user.Id, token.Id, 30, 20, "bf-idem-stress")
				require.NoError(t, CreateRefundIntent(&intent))

				const workers = 12
				errs := make([]error, workers)
				var wg sync.WaitGroup
				wg.Add(workers)
				for i := 0; i < workers; i++ {
					go func(i int) {
						defer wg.Done()
						errs[i] = ExecuteRefundIntent(intent.Id)
					}(i)
				}
				wg.Wait()
				for i, err := range errs {
					require.NoError(t, err, "worker %d: duplicate execution must be an idempotent no-op", i)
				}
				require.Equal(t, 130, bfQuotaOf(t, db, user.Id), "exactly one wallet credit")
				tk := bfReloadToken(t, db, token.Id)
				require.Equal(t, 70, tk.RemainQuota, "exactly one token refund")
				require.Equal(t, 0, tk.UsedQuota)
				require.Equal(t, RefundIntentDone, bfReloadIntent(t, db, intent.Id).Status)
			})
		}
	})

	// ------------------------------------------------------------------
	// 4) Cross-cutting: FK enforcement, balance/ledger consistency
	// ------------------------------------------------------------------
	t.Run("foreign_key_enforced", func(t *testing.T) {
		db := bfSetup(t)
		sqlDB, err := db.DB()
		require.NoError(t, err)
		var fkOn int
		require.NoError(t, sqlDB.QueryRow("PRAGMA foreign_keys").Scan(&fkOn))
		require.Equal(t, 1, fkOn, "FK enforcement must be ON on the isolated connection")

		// The versioned migration installed a real top_ups.user_id -> users.id FK.
		var fkRelations int
		rows, err := sqlDB.Query("PRAGMA foreign_key_list(top_ups)")
		require.NoError(t, err)
		for rows.Next() {
			fkRelations++
		}
		require.NoError(t, rows.Close())
		require.Greater(t, fkRelations, 0, "top_ups must declare a real FK")

		user := bfUser(t, db, "bf-fk-user", 100)
		legal := TopUp{TradeNo: "BF-LEGAL-ORDER", UserId: user.Id, Amount: 10, Money: 10,
			PaymentMethod: "EXAMPLE", Status: common.TopUpStatusPending, CreateTime: common.GetTimestamp()}
		require.NoError(t, db.Create(&legal).Error)
		orphan := TopUp{TradeNo: "BF-ORPHAN-ORDER", UserId: 99999999, Amount: 10, Money: 10,
			PaymentMethod: "EXAMPLE", Status: common.TopUpStatusPending, CreateTime: common.GetTimestamp()}
		require.Error(t, db.Create(&orphan).Error, "orphan child must be rejected by the FK")
		var orphanCount int64
		require.NoError(t, db.Model(&TopUp{}).Where("trade_no = ?", "BF-ORPHAN-ORDER").Count(&orphanCount).Error)
		require.EqualValues(t, 0, orphanCount, "orphan order must NOT be persisted")

		// Business functions operate correctly in this FK-enforced DB: the
		// refund credential references the real parent user and stays consistent.
		intent := bfWalletIntent(user.Id, 0, 25, 0, "bf-idem-fk")
		require.NoError(t, CreateRefundIntent(&intent))
		require.NoError(t, ExecuteRefundIntent(intent.Id))
		require.Equal(t, 125, bfQuotaOf(t, db, user.Id))
		require.Equal(t, RefundIntentDone, bfReloadIntent(t, db, intent.Id).Status)
		t.Logf("FK enforced (foreign_keys=%d, top_ups FK relations=%d): orphan rejected, business refund consistent", fkOn, fkRelations)
	})

	t.Run("balance_and_ledger_consistency", func(t *testing.T) {
		db := bfSetup(t)
		user := bfUser(t, db, "bf-consistency-user", 100)

		// A completed topup produces one durable ledger (流水) row via the real
		// business function; order settlement credits the balance (fixture).
		RecordTopupLog(user.Id, common.NewMessage("topup credited", map[string]any{"quota": 200}),
			"203.0.113.10", "ALIPAY", "EPAY")
		require.NoError(t, db.Model(&User{}).Where("id = ?", user.Id).Update("quota", 300).Error)
		require.EqualValues(t, 1, bfCountTopupLogs(t, db))

		// A refund of 50 is persisted as one pending credential, then executed.
		intent := bfWalletIntent(user.Id, 0, 50, 0, "bf-idem-consistency")
		require.NoError(t, CreateRefundIntent(&intent))
		require.NoError(t, ExecuteRefundIntent(intent.Id))

		// Balance moved by exactly the credential snapshot, no drift.
		require.Equal(t, 350, bfQuotaOf(t, db, user.Id), "balance = settled 300 + single 50 refund")
		done := bfReloadIntent(t, db, intent.Id)
		require.Equal(t, RefundIntentDone, done.Status)
		require.Equal(t, 50, done.WalletAmount, "credential keeps the exact refund amount")
		require.EqualValues(t, 1, bfCountTopupLogs(t, db), "topup ledger row preserved, not duplicated")

		// Replay adds nothing: balance and ledger stay consistent.
		require.NoError(t, ExecuteRefundIntent(intent.Id))
		require.Equal(t, 350, bfQuotaOf(t, db, user.Id))
		require.EqualValues(t, 1, bfCountTopupLogs(t, db))
		var intents int64
		require.NoError(t, db.Model(&RefundIntent{}).Count(&intents).Error)
		require.EqualValues(t, 1, intents, "one durable credential for one logical refund")
		t.Logf("balance=350 equals settled balance + one credential(50); topup ledger intact")
	})
}
