/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

package paymentsandbox

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"database/sql"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

const (
	testQuota    int64 = 1000
	testAmount   int64 = 1000
	testCurrency       = "CNY"
)

// ---------------------------------------------------------------------------
// Helpers — real runtime key generation, NO hardcoded keys
// ---------------------------------------------------------------------------

// genTestRSAKey generates a real RSA-2048 PKCS8 PEM private key at runtime.
// Used only to prove ValidateConfig REJECTS real key material. Same pattern as
// service/cn_pay_sign_test.go genTestRSAKey().
func genTestRSAKey(t *testing.T) string {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	der, err := x509.MarshalPKCS8PrivateKey(key)
	require.NoError(t, err)
	return string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der}))
}

func newMemoryFixture(t *testing.T) (*LocalSimulationGateway, *MemoryStore) {
	t.Helper()
	store := NewMemoryStore()
	gw, err := NewLocalSimulationGateway(WithStore(store))
	require.NoError(t, err)
	return gw, store
}

func mustCreate(t *testing.T, gw *LocalSimulationGateway, tradeNo string, providerAmount int64) {
	t.Helper()
	_, err := gw.CreateOrder(context.Background(), CreateOrderRequest{
		TradeNo:          tradeNo,
		Quota:            testQuota,
		ProviderAmount:   providerAmount,
		ProviderCurrency: testCurrency,
		Subject:          "EXAMPLE_SUBJECT",
	})
	require.NoError(t, err)
}

func mustNotify(t *testing.T, gw *LocalSimulationGateway, notifyID, tradeNo string, status TradeStatus, amount int64, currency string) []byte {
	t.Helper()
	p, err := gw.SerializeNotification(Notification{
		NotifyID:         notifyID,
		TradeNo:          tradeNo,
		TradeStatus:      status,
		ProviderAmount:   amount,
		ProviderCurrency: currency,
	})
	require.NoError(t, err)
	return p
}

func validLocalConfig() Config {
	return Config{
		Mode:               ModeLocalSimulation,
		GatewayURL:         "http://127.0.0.1:19999/pay",
		NotifyURL:          "http://127.0.0.1:19999/notify",
		AppID:              "EXAMPLE_APP_ID",
		PrivateKeyPEM:      "EXAMPLE_PRIVATE_KEY_NOT_REAL",
		PublicKeyPEM:       "EXAMPLE_PUBLIC_KEY_NOT_REAL",
		CredentialsPresent: false,
	}
}

// ---------------------------------------------------------------------------
// Real file-backed SQLite store (github.com/glebarez/sqlite) in t.TempDir().
// This is a REAL database, not a mock. It is ISOLATED: it lives in t.TempDir()
// and is NEVER the repo's one-api.db / uter.db / model.DB.
// ---------------------------------------------------------------------------

var _ Store = (*fileBackedStore)(nil)

type fileBackedStore struct {
	db *gorm.DB

	// Fault-injection hooks (test-only):
	// beforeCommit runs inside the transaction just before Commit; returning an
	// error forces a ROLLBACK (models "payment succeeded but DB commit failed").
	// afterCommit runs AFTER a successful Commit; returning an error models a
	// lost response (the credit is already durable).
	beforeCommit func(tx *gorm.DB) error
	afterCommit  func() error
}

func newFileBackedStore(t *testing.T) *fileBackedStore {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "sandbox.db")
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	// Serialize writes through one connection so concurrent fault-injection
	// goroutines exercise the CONDITIONAL UPDATE / unique-constraint CAS without
	// SQLITE_BUSY noise. The CAS logic is still genuinely tested.
	sqlDB.SetMaxOpenConns(1)

	schema := []string{
		`CREATE TABLE ps_orders (
			trade_no TEXT PRIMARY KEY,
			status TEXT NOT NULL,
			quota INTEGER NOT NULL,
			credited_quota INTEGER NOT NULL DEFAULT 0,
			provider_amount INTEGER NOT NULL,
			provider_currency TEXT NOT NULL
		)`,
		`CREATE TABLE ps_notifications (
			notify_id TEXT PRIMARY KEY,
			trade_no TEXT NOT NULL
		)`,
		`CREATE TABLE ps_ledger (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			trade_no TEXT NOT NULL UNIQUE,
			notify_id TEXT NOT NULL,
			quota INTEGER NOT NULL,
			provider_amount INTEGER NOT NULL,
			provider_currency TEXT NOT NULL
		)`,
	}
	for _, stmt := range schema {
		require.NoError(t, db.Exec(stmt).Error)
	}
	return &fileBackedStore{db: db}
}

func (s *fileBackedStore) Label() string {
	return "file-backed SQLite (github.com/glebarez/sqlite) in t.TempDir(); isolated, never production"
}

func (s *fileBackedStore) CreateOrder(ctx context.Context, o StoredOrder) error {
	return s.db.WithContext(ctx).Exec(
		`INSERT INTO ps_orders(trade_no,status,quota,credited_quota,provider_amount,provider_currency) VALUES(?,?,?,?,?,?)`,
		o.TradeNo, "created", o.Quota, 0, o.ProviderAmount, o.ProviderCurrency,
	).Error
}

func (s *fileBackedStore) GetOrder(ctx context.Context, tradeNo string) (StoredOrder, error) {
	var o StoredOrder
	row := s.db.WithContext(ctx).Raw(
		`SELECT trade_no, status, quota, credited_quota, provider_amount, provider_currency FROM ps_orders WHERE trade_no = ?`,
		tradeNo,
	).Row()
	err := row.Scan(&o.TradeNo, &o.Status, &o.Quota, &o.CreditedQuota, &o.ProviderAmount, &o.ProviderCurrency)
	if errors.Is(err, sql.ErrNoRows) {
		return StoredOrder{}, ErrOrderNotFound
	}
	if err != nil {
		return StoredOrder{}, err
	}
	return o, nil
}

// Credit performs a single real SQL transaction with three idempotency guards:
//  1. unique notify_id (provider retry of an identical notification),
//  2. conditional order transition created -> paid (concurrent CAS),
//  3. unique trade_no in the ledger (one ledger entry per order).
func (s *fileBackedStore) Credit(ctx context.Context, n Notification, quota int64) (CreditResult, error) {
	tx := s.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return CreditResult{}, tx.Error
	}
	fail := func(err error) (CreditResult, error) { tx.Rollback(); return CreditResult{}, err }
	dup := func() (CreditResult, error) { tx.Rollback(); return CreditResult{Duplicate: true}, nil }

	var seen int64
	if err := tx.Raw(`SELECT COUNT(1) FROM ps_notifications WHERE notify_id = ?`, n.NotifyID).Row().Scan(&seen); err != nil {
		return fail(err)
	}
	if seen > 0 {
		return dup()
	}
	if err := tx.Exec(`INSERT INTO ps_notifications(notify_id, trade_no) VALUES(?,?)`, n.NotifyID, n.TradeNo).Error; err != nil {
		return fail(err)
	}

	res := tx.Exec(`UPDATE ps_orders SET status='paid', credited_quota=? WHERE trade_no=? AND status='created'`, quota, n.TradeNo)
	if res.Error != nil {
		return fail(res.Error)
	}
	if res.RowsAffected == 0 {
		return dup()
	}

	if err := tx.Exec(
		`INSERT INTO ps_ledger(trade_no, notify_id, quota, provider_amount, provider_currency) VALUES(?,?,?,?,?)`,
		n.TradeNo, n.NotifyID, quota, n.ProviderAmount, n.ProviderCurrency,
	).Error; err != nil {
		return fail(err)
	}

	if s.beforeCommit != nil {
		if err := s.beforeCommit(tx); err != nil {
			return fail(err)
		}
	}
	if err := tx.Commit().Error; err != nil {
		return CreditResult{}, err
	}
	result := CreditResult{Credited: true, Quota: quota}
	if s.afterCommit != nil {
		if err := s.afterCommit(); err != nil {
			return result, err
		}
	}
	return result, nil
}

func (s *fileBackedStore) Close(ctx context.Context, tradeNo string) error {
	res := s.db.WithContext(ctx).Exec(`UPDATE ps_orders SET status='closed' WHERE trade_no=? AND status='created'`, tradeNo)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrOrderNotPayable
	}
	return nil
}

func (s *fileBackedStore) LedgerCount(ctx context.Context, tradeNo string) (int64, error) {
	var cnt int64
	err := s.db.WithContext(ctx).Raw(`SELECT COUNT(1) FROM ps_ledger WHERE trade_no = ?`, tradeNo).Row().Scan(&cnt)
	return cnt, err
}

// ---------------------------------------------------------------------------
// Fixture for fault-injection tests
// ---------------------------------------------------------------------------

type sandboxFixture struct {
	gw      *LocalSimulationGateway
	store   *fileBackedStore
	order   CreateOrderRequest
	payload []byte
}

func newSQLiteFixture(t *testing.T, tradeNo, notifyID string) *sandboxFixture {
	t.Helper()
	store := newFileBackedStore(t)
	gw, err := NewLocalSimulationGateway(WithStore(store))
	require.NoError(t, err)
	order := CreateOrderRequest{
		TradeNo:          tradeNo,
		Quota:            testQuota,
		ProviderAmount:   testAmount,
		ProviderCurrency: testCurrency,
		Subject:          "EXAMPLE_SUBJECT",
	}
	_, err = gw.CreateOrder(context.Background(), order)
	require.NoError(t, err)
	payload := mustNotify(t, gw, notifyID, tradeNo, TradeStatusSuccess, testAmount, testCurrency)
	return &sandboxFixture{gw: gw, store: store, order: order, payload: payload}
}

// ---------------------------------------------------------------------------
// 1. Real RSA sign/verify: valid accepted
// ---------------------------------------------------------------------------

func TestSignatureVerificationAcceptsValid(t *testing.T) {
	gw, _ := newMemoryFixture(t)
	payload := mustNotify(t, gw, "NID-VALID", "T-VALID", TradeStatusSuccess, testAmount, testCurrency)

	n, err := gw.ParseAndVerifyNotification(payload)
	require.NoError(t, err)
	assert.Equal(t, "NID-VALID", n.NotifyID)
	assert.Equal(t, "T-VALID", n.TradeNo)
	assert.Equal(t, TradeStatusSuccess, n.TradeStatus)
	assert.Equal(t, testAmount, n.ProviderAmount)
	assert.Equal(t, testCurrency, n.ProviderCurrency)
	assert.NotEmpty(t, n.Sign)
}

// ---------------------------------------------------------------------------
// 2. Real RSA sign/verify: tampered payloads rejected
// ---------------------------------------------------------------------------

func TestSignatureVerificationRejectsTampered(t *testing.T) {
	gw, _ := newMemoryFixture(t)
	base := mustNotify(t, gw, "NID-TAMPER", "T-TAMPER", TradeStatusSuccess, testAmount, testCurrency)

	tamper := func(t *testing.T, mutate func(m map[string]string)) []byte {
		t.Helper()
		var m map[string]string
		require.NoError(t, json.Unmarshal(base, &m))
		mutate(m)
		p, err := json.Marshal(m)
		require.NoError(t, err)
		return p
	}

	t.Run("changed_provider_amount", func(t *testing.T) {
		p := tamper(t, func(m map[string]string) { m["provider_amount"] = "999999" })
		_, err := gw.ParseAndVerifyNotification(p)
		require.ErrorIs(t, err, ErrInvalidSignature)
	})

	t.Run("changed_trade_no", func(t *testing.T) {
		p := tamper(t, func(m map[string]string) { m["trade_no"] = "ATTACKER-ORDER" })
		_, err := gw.ParseAndVerifyNotification(p)
		require.ErrorIs(t, err, ErrInvalidSignature)
	})

	t.Run("missing_signature", func(t *testing.T) {
		p := tamper(t, func(m map[string]string) { delete(m, "sign") })
		_, err := gw.ParseAndVerifyNotification(p)
		require.ErrorIs(t, err, ErrInvalidSignature)
	})

	t.Run("garbage_signature", func(t *testing.T) {
		p := tamper(t, func(m map[string]string) { m["sign"] = "AAAA" })
		_, err := gw.ParseAndVerifyNotification(p)
		require.ErrorIs(t, err, ErrInvalidSignature)
	})
}

// ---------------------------------------------------------------------------
// 3. Valid notification parsed -> order becomes paid
// ---------------------------------------------------------------------------

func TestNotificationHandling(t *testing.T) {
	gw, store := newMemoryFixture(t)
	ctx := context.Background()
	mustCreate(t, gw, "T-NH", testAmount)
	payload := mustNotify(t, gw, "NID-NH", "T-NH", TradeStatusSuccess, testAmount, testCurrency)

	res, err := gw.HandleNotification(ctx, payload)
	require.NoError(t, err)
	assert.True(t, res.Credited)
	assert.Equal(t, testQuota, res.Quota)

	q, err := gw.QueryOrder(ctx, "T-NH")
	require.NoError(t, err)
	assert.Equal(t, StatePaid, q.State)
	assert.Equal(t, TradeStatusSuccess, q.TradeStatus)

	cnt, err := store.LedgerCount(ctx, "T-NH")
	require.NoError(t, err)
	assert.Equal(t, int64(1), cnt)
}

// ---------------------------------------------------------------------------
// 4. Same notify id twice -> exactly one credit
// ---------------------------------------------------------------------------

func TestDuplicateNotificationIsIdempotent(t *testing.T) {
	gw, store := newMemoryFixture(t)
	ctx := context.Background()
	mustCreate(t, gw, "T-DUP", testAmount)
	payload := mustNotify(t, gw, "NID-DUP", "T-DUP", TradeStatusSuccess, testAmount, testCurrency)

	r1, err := gw.HandleNotification(ctx, payload)
	require.NoError(t, err)
	r2, err := gw.HandleNotification(ctx, payload)
	require.NoError(t, err)

	assert.True(t, r1.Credited)
	assert.False(t, r2.Credited)
	assert.True(t, r2.Duplicate)

	cnt, err := store.LedgerCount(ctx, "T-DUP")
	require.NoError(t, err)
	assert.Equal(t, int64(1), cnt, "exactly one ledger entry")
	o, err := store.GetOrder(ctx, "T-DUP")
	require.NoError(t, err)
	assert.Equal(t, testQuota, o.CreditedQuota, "credited exactly once")
}

// ---------------------------------------------------------------------------
// 5. Four query states, honestly labelled as LOCAL_SIMULATION
// ---------------------------------------------------------------------------

func TestOrderQueryFourState(t *testing.T) {
	gw, _ := newMemoryFixture(t)
	ctx := context.Background()

	// (a) TRADE_NOT_EXIST — the trade never entered the payment flow.
	q, err := gw.QueryOrder(ctx, "NEVER-CREATED")
	require.NoError(t, err)
	assert.False(t, q.Found)
	assert.Equal(t, StateNotFound, q.State)
	assert.Equal(t, TradeStatusNotExist, q.TradeStatus)

	// (b) created / WAIT_BUYER_PAY — created but not yet paid.
	mustCreate(t, gw, "T-CREATED", testAmount)
	q, err = gw.QueryOrder(ctx, "T-CREATED")
	require.NoError(t, err)
	assert.Equal(t, StateCreated, q.State)
	assert.Equal(t, TradeStatusWaitPay, q.TradeStatus)

	// (c) paid / TRADE_SUCCESS.
	_, err = gw.HandleNotification(ctx, mustNotify(t, gw, "NID-PAID", "T-CREATED", TradeStatusSuccess, testAmount, testCurrency))
	require.NoError(t, err)
	q, err = gw.QueryOrder(ctx, "T-CREATED")
	require.NoError(t, err)
	assert.Equal(t, StatePaid, q.State)
	assert.Equal(t, TradeStatusSuccess, q.TradeStatus)

	// (d) closed / TRADE_CLOSED — terminal, unpaid trade closed.
	mustCreate(t, gw, "T-CLOSED", testAmount)
	require.NoError(t, gw.CloseOrder(ctx, "T-CLOSED"))
	q, err = gw.QueryOrder(ctx, "T-CLOSED")
	require.NoError(t, err)
	assert.Equal(t, StateClosed, q.State)
	assert.Equal(t, TradeStatusClosed, q.TradeStatus)

	// Honesty: every status is a LOCAL_SIMULATION label, never a claim of real
	// gateway interaction, and NEVER PAYMENT_SANDBOX_VERIFIED.
	all := []QueryOrderResponse{}
	for _, no := range []string{"NEVER-CREATED", "T-CREATED", "T-CLOSED"} {
		qq, e := gw.QueryOrder(ctx, no)
		require.NoError(t, e)
		all = append(all, qq)
	}
	for _, qq := range all {
		assert.Equal(t, ModeLocalSimulation, qq.Mode)
		assert.Equal(t, "LOCAL_SIMULATION", string(qq.Mode))
		assert.NotEqual(t, "PAYMENT_SANDBOX_VERIFIED", string(qq.Mode))
		assert.True(t, qq.Simulated)
		assert.Contains(t, qq.Note, "no real gateway")
	}
}

// ---------------------------------------------------------------------------
// 6. Repeated refund request -> one effect
// ---------------------------------------------------------------------------

func TestRefundStatusIdempotent(t *testing.T) {
	gw, _ := newMemoryFixture(t)
	ctx := context.Background()
	req := RefundRequest{RefundID: "RID-1", TradeNo: "T-1", Amount: 500}

	r1, err := gw.RefundStatus(ctx, req)
	require.NoError(t, err)
	r2, err := gw.RefundStatus(ctx, req)
	require.NoError(t, err)

	assert.Equal(t, r1, r2, "identical response on repeat")
	assert.Equal(t, int64(1), gw.RefundEffectCount(), "exactly one refund effect")
	assert.True(t, r1.Simulated)
	assert.Equal(t, ModeLocalSimulation, r1.Mode)
	assert.Equal(t, "REFUND_SUCCESS", r1.Status)

	// A different refund id is a genuinely new effect.
	_, err = gw.RefundStatus(ctx, RefundRequest{RefundID: "RID-2", TradeNo: "T-1", Amount: 500})
	require.NoError(t, err)
	assert.Equal(t, int64(2), gw.RefundEffectCount())
}

// ---------------------------------------------------------------------------
// 7. Amount snapshot mismatch -> reject credit (valid signature, wrong amount)
// ---------------------------------------------------------------------------

func TestAmountSnapshotMismatchRejected(t *testing.T) {
	gw, store := newMemoryFixture(t)
	ctx := context.Background()
	mustCreate(t, gw, "T-SNAP", 1000) // snapshot = 1000 CNY

	// A VALIDLY SIGNED notification whose amount differs from the snapshot.
	wrong := mustNotify(t, gw, "NID-SNAP", "T-SNAP", TradeStatusSuccess, 999, testCurrency)
	_, err := gw.ParseAndVerifyNotification(wrong)
	require.NoError(t, err, "signature must be valid; rejection is specifically the snapshot guard")

	res, err := gw.HandleNotification(ctx, wrong)
	require.ErrorIs(t, err, ErrAmountMismatch)
	assert.False(t, res.Credited)
	assert.True(t, res.Rejected)

	cnt, err := store.LedgerCount(ctx, "T-SNAP")
	require.NoError(t, err)
	assert.Equal(t, int64(0), cnt, "no credit on mismatch")
	o, err := store.GetOrder(ctx, "T-SNAP")
	require.NoError(t, err)
	assert.Equal(t, "created", o.Status)
	assert.Zero(t, o.CreditedQuota)

	// Currency mismatch is also rejected even when the amount matches.
	wrongCurrency := mustNotify(t, gw, "NID-SNAP2", "T-SNAP", TradeStatusSuccess, 1000, "USD")
	_, err = gw.HandleNotification(ctx, wrongCurrency)
	require.ErrorIs(t, err, ErrAmountMismatch)
}

// ---------------------------------------------------------------------------
// 8. NEGATIVE: production gateway URL must be rejected
// ---------------------------------------------------------------------------

func TestConfigRejectsProductionGateway(t *testing.T) {
	base := validLocalConfig()

	for _, u := range []string{
		"https://openapi.alipay.com/gateway.do",
		"https://api.mch.weixin.qq.com/v3/pay/transactions/native",
		"https://api.creem.io",
		"https://api.stripe.com/v1/payment_intents",
		"http://openapi.alipay.com/gateway.do", // production host even over http
		"https://sub.openapi.alipay.com/gateway.do",
	} {
		cfg := base
		cfg.GatewayURL = u
		err := ValidateConfig(cfg)
		require.Error(t, err, "production URL %q must be rejected", u)
		assert.ErrorIs(t, err, ErrProductionGateway, "URL %q", u)
	}

	// Production host in NotifyURL is also rejected.
	cfg := base
	cfg.NotifyURL = "https://openapi.alipay.com/gateway.do"
	require.ErrorIs(t, ValidateConfig(cfg), ErrProductionGateway)

	// Non-loopback plain http is rejected (insecure).
	cfg = base
	cfg.GatewayURL = "http://example.com/notify"
	require.ErrorIs(t, ValidateConfig(cfg), ErrInsecureGatewayURL)

	// A genuine loopback httptest host is accepted, and ValidateConfig makes
	// NO network call to it.
	var hits atomic.Int64
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
	}))
	defer ts.Close()
	cfg = base
	cfg.GatewayURL = ts.URL
	cfg.NotifyURL = ts.URL + "/notify"
	require.NoError(t, ValidateConfig(cfg))
	assert.Zero(t, hits.Load(), "ValidateConfig must make no network call")
}

// ---------------------------------------------------------------------------
// 9. NEGATIVE: provider sandbox without credentials must be rejected
// ---------------------------------------------------------------------------

func TestConfigRejectsProviderSandboxWithoutCredentials(t *testing.T) {
	cfg := validLocalConfig()
	cfg.Mode = ModeProviderSandbox
	cfg.CredentialsPresent = false

	err := ValidateConfig(cfg)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrProviderSandboxBlocked)

	// Even claiming credentials are present is blocked: a genuine provider
	// sandbox is not provisioned, and real-looking creds are forbidden above.
	cfg.CredentialsPresent = true
	err = ValidateConfig(cfg)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrProviderSandboxBlocked)
}

// ---------------------------------------------------------------------------
// 10. Report declares LOCAL_SIMULATION with all real-effect counters zero
// ---------------------------------------------------------------------------

func TestReportDeclaresLocalSimulation(t *testing.T) {
	gw, _ := newMemoryFixture(t)
	ctx := context.Background()

	// Exercise real work so the report is not vacuously zero.
	mustCreate(t, gw, "T-REPORT", testAmount)
	_, err := gw.HandleNotification(ctx, mustNotify(t, gw, "NID-REPORT", "T-REPORT", TradeStatusSuccess, testAmount, testCurrency))
	require.NoError(t, err)
	_, err = gw.QueryOrder(ctx, "T-REPORT")
	require.NoError(t, err)
	_, err = gw.RefundStatus(ctx, RefundRequest{RefundID: "RID-REPORT", TradeNo: "T-REPORT", Amount: 1})
	require.NoError(t, err)

	rep := gw.Report()
	assert.Equal(t, ModeLocalSimulation, rep.Mode)
	assert.Equal(t, "LOCAL_SIMULATION", string(rep.Mode))
	assert.NotEqual(t, "PAYMENT_SANDBOX_VERIFIED", string(rep.Mode))
	assert.Zero(t, rep.NetworkCallsToRealProvider)
	assert.Zero(t, rep.RealPayments)
	assert.Zero(t, rep.RealRefunds)
	assert.Zero(t, rep.DatabaseWrites)

	for _, k := range []string{
		"mode_local_simulation",
		"no_network_calls_to_real_provider",
		"no_real_payments",
		"no_real_refunds",
		"no_production_database_writes",
		"no_production_keys_read",
		"rsa_keys_generated_at_runtime",
	} {
		assert.Equal(t, "PASS", rep.Checks[k], "check %s", k)
	}
	assert.Contains(t, rep.Checks["sandbox_store_isolated"], "PASS")

	t.Run("file_backed_store_disclosed_still_no_production_writes", func(t *testing.T) {
		f := newSQLiteFixture(t, "T-REPORT-DB", "NID-REPORT-DB")
		_, err := f.gw.HandleNotification(ctx, f.payload)
		require.NoError(t, err)
		rep := f.gw.Report()
		assert.Zero(t, rep.DatabaseWrites, "sandbox-local SQLite writes are NOT production DB writes")
		assert.Zero(t, rep.NetworkCallsToRealProvider)
		assert.Contains(t, rep.Checks["sandbox_store_isolated"], "SQLite")
	})
}

// ---------------------------------------------------------------------------
// 11. Fault injections (real file-backed SQLite + real SQL transactions)
// ---------------------------------------------------------------------------

func TestFaultInjections(t *testing.T) {
	ctx := context.Background()

	// (a) Payment succeeds but the local DB commit fails -> NO credit.
	t.Run("a_payment_success_but_db_commit_fails_no_credit", func(t *testing.T) {
		f := newSQLiteFixture(t, "T-FAULT-A", "NID-FAULT-A")
		f.store.beforeCommit = func(tx *gorm.DB) error {
			return errors.New("simulated DB commit failure")
		}

		_, err := f.gw.HandleNotification(ctx, f.payload)
		require.Error(t, err, "commit failure surfaces as an error")

		o, err := f.store.GetOrder(ctx, "T-FAULT-A")
		require.NoError(t, err)
		assert.Equal(t, "created", o.Status, "order stays pending after rollback")
		assert.Zero(t, o.CreditedQuota)
		cnt, err := f.store.LedgerCount(ctx, "T-FAULT-A")
		require.NoError(t, err)
		assert.Equal(t, int64(0), cnt, "no ledger entry after rollback")
	})

	// (b) DB commit succeeds but the response is lost -> retry does NOT double credit.
	t.Run("b_db_commit_ok_but_response_lost_retry_no_double_credit", func(t *testing.T) {
		f := newSQLiteFixture(t, "T-FAULT-B", "NID-FAULT-B")
		f.store.afterCommit = func() error {
			return errors.New("simulated lost response")
		}

		_, err := f.gw.HandleNotification(ctx, f.payload)
		require.Error(t, err, "lost response surfaces as an error to the caller")

		// The credit is nevertheless durable — exactly once.
		o, err := f.store.GetOrder(ctx, "T-FAULT-B")
		require.NoError(t, err)
		assert.Equal(t, "paid", o.Status)
		assert.Equal(t, testQuota, o.CreditedQuota)
		cnt, err := f.store.LedgerCount(ctx, "T-FAULT-B")
		require.NoError(t, err)
		assert.Equal(t, int64(1), cnt)

		// Retry with the SAME notify id.
		r, err := f.gw.HandleNotification(ctx, f.payload)
		require.NoError(t, err)
		assert.True(t, r.Duplicate)
		assert.False(t, r.Credited)

		o, err = f.store.GetOrder(ctx, "T-FAULT-B")
		require.NoError(t, err)
		assert.Equal(t, testQuota, o.CreditedQuota, "no double credit on retry")
		cnt, err = f.store.LedgerCount(ctx, "T-FAULT-B")
		require.NoError(t, err)
		assert.Equal(t, int64(1), cnt, "no duplicate ledger entry on retry")
	})

	// (c) Concurrent same-order processing -> exactly one credit.
	t.Run("c_concurrent_same_order_exactly_one_credit", func(t *testing.T) {
		f := newSQLiteFixture(t, "T-FAULT-C", "NID-FAULT-C-BASE")
		const workers = 16
		payloads := make([][]byte, workers)
		for i := range payloads {
			// Distinct notify ids on the SAME order forces the order-level CAS
			// (conditional UPDATE) to be the deciding guard.
			payloads[i] = mustNotify(t, f.gw, fmt.Sprintf("NID-FAULT-C-%d", i), "T-FAULT-C", TradeStatusSuccess, testAmount, testCurrency)
		}

		var wg sync.WaitGroup
		results := make([]HandleResult, workers)
		errs := make([]error, workers)
		for i := 0; i < workers; i++ {
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				results[i], errs[i] = f.gw.HandleNotification(ctx, payloads[i])
			}(i)
		}
		wg.Wait()

		credited := 0
		for i := range results {
			require.NoError(t, errs[i])
			if results[i].Credited {
				credited++
			}
		}
		assert.Equal(t, 1, credited, "exactly one worker credited")

		o, err := f.store.GetOrder(ctx, "T-FAULT-C")
		require.NoError(t, err)
		assert.Equal(t, "paid", o.Status)
		assert.Equal(t, testQuota, o.CreditedQuota)
		cnt, err := f.store.LedgerCount(ctx, "T-FAULT-C")
		require.NoError(t, err)
		assert.Equal(t, int64(1), cnt, "exactly one ledger entry under concurrency")
	})

	// (d) Retry causes no duplicate ledger entry.
	t.Run("d_retry_causes_no_duplicate_ledger_entry", func(t *testing.T) {
		f := newSQLiteFixture(t, "T-FAULT-D", "NID-FAULT-D")

		r, err := f.gw.HandleNotification(ctx, f.payload)
		require.NoError(t, err)
		assert.True(t, r.Credited)

		for i := 0; i < 3; i++ {
			r, err = f.gw.HandleNotification(ctx, f.payload)
			require.NoError(t, err)
			assert.True(t, r.Duplicate)
			assert.False(t, r.Credited)
		}

		cnt, err := f.store.LedgerCount(ctx, "T-FAULT-D")
		require.NoError(t, err)
		assert.Equal(t, int64(1), cnt, "one ledger entry despite 4 notifications")
		o, err := f.store.GetOrder(ctx, "T-FAULT-D")
		require.NoError(t, err)
		assert.Equal(t, testQuota, o.CreditedQuota)
	})
}

// ---------------------------------------------------------------------------
// 12. Extra negative: real-looking credentials are rejected (fail closed)
// ---------------------------------------------------------------------------

func TestConfigRejectsRealLookingCredentials(t *testing.T) {
	// A REAL RSA private key generated at runtime must be rejected: no
	// production key is ever read into a local-simulation config.
	privPEM := genTestRSAKey(t)
	cfg := validLocalConfig()
	cfg.PrivateKeyPEM = privPEM
	require.ErrorIs(t, ValidateConfig(cfg), ErrRealLookingCredential)

	// A numeric merchant-id shape is rejected.
	cfg = validLocalConfig()
	cfg.AppID = "0000000000000000"
	require.ErrorIs(t, ValidateConfig(cfg), ErrRealLookingCredential)

	// Claiming real credentials on a local simulation is rejected.
	cfg = validLocalConfig()
	cfg.CredentialsPresent = true
	require.Error(t, ValidateConfig(cfg))

	// Unknown / empty mode fails closed.
	cfg = validLocalConfig()
	cfg.Mode = Mode("SOMETHING_ELSE")
	require.ErrorIs(t, ValidateConfig(cfg), ErrInvalidMode)
	cfg = validLocalConfig()
	cfg.Mode = Mode("")
	require.ErrorIs(t, ValidateConfig(cfg), ErrInvalidMode)

	// The baseline EXAMPLE-only local config is accepted.
	require.NoError(t, ValidateConfig(validLocalConfig()))
}
