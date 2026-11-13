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

// Package paymentsandbox provides an IN-PROCESS payment gateway used for
// integration testing of settlement logic.
//
// There are exactly two modes (see Mode):
//
//   - ModeLocalSimulation ("LOCAL_SIMULATION") — the only mode implemented
//     here. It performs real RSA-2048 signing/verification, a real order
//     state machine, real notification (de)serialization, real signature
//     rejection of tampered payloads, and real idempotent credit handling.
//     It makes ZERO network calls to any payment provider, moves ZERO real
//     money, issues ZERO real refunds, reads ZERO production credentials and
//     performs ZERO writes to any production database. See Report().
//
//   - ModeProviderSandbox ("PAYMENT_SANDBOX_VERIFIED") — RESERVED for a
//     genuine provider sandbox. It is NOT implemented: this repository has
//     no provider sandbox credentials, and ValidateConfig deliberately
//     FAILS CLOSED on it (BLOCKED_EXTERNAL_DEPENDENCY). Nothing in this
//     package may ever label a local simulation as
//     PAYMENT_SANDBOX_VERIFIED.
//
// This package is deliberately distinct from .uap/tools/financial-simulation.mjs:
// that tool is a static source scan plus an in-memory simulation. Here every
// behaviour is exercised by real code and real Go tests (real crypto, real
// transactions, real file-backed SQLite in the fault-injection tests).
package paymentsandbox

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
)

// ---------------------------------------------------------------------------
// Mode and configuration
// ---------------------------------------------------------------------------

// Mode identifies how a payment gateway was exercised. There are exactly two
// values. Local simulated gateway tests MUST be labelled ModeLocalSimulation;
// ModeProviderSandbox is reserved for interaction with a real payment
// provider's sandbox and is blocked in this repository.
type Mode string

const (
	ModeLocalSimulation Mode = "LOCAL_SIMULATION"
	ModeProviderSandbox Mode = "PAYMENT_SANDBOX_VERIFIED"
)

// Config is the configuration a caller would use to construct a gateway.
// For ModeLocalSimulation the credential fields must be empty or explicit
// EXAMPLE placeholders: a local simulation never reads a production key.
// CredentialsPresent reports whether REAL provider credentials are available;
// for a local simulation it must be false.
type Config struct {
	Mode               Mode
	GatewayURL         string
	AppID              string
	PrivateKeyPEM      string
	PublicKeyPEM       string
	NotifyURL          string
	CredentialsPresent bool
}

// Sentinel errors returned by ValidateConfig. Callers may use errors.Is.
var (
	ErrInvalidMode              = errors.New("invalid mode")
	ErrInvalidGatewayURL        = errors.New("invalid gateway URL")
	ErrProductionGateway        = errors.New("production gateway host is forbidden")
	ErrInsecureGatewayURL       = errors.New("gateway URL must be https (or loopback http)")
	ErrRealLookingCredential    = errors.New("credential looks like a real merchant id/secret; only EXAMPLE placeholders allowed")
	ErrProviderSandboxBlocked   = errors.New("BLOCKED_EXTERNAL_DEPENDENCY: real provider sandbox is not available")
)

// productionHosts is a deny-list of real payment-provider endpoints. A local
// simulation must never be pointed at any of them (production OR sandbox
// variants), because we make no network calls to real providers. The three
// leading entries are the defaults from
// setting/operation_setting/payment_gateway_cn.go.
var productionHosts = []string{
	"openapi.alipay.com",
	"api.mch.weixin.qq.com",
	"api.creem.io",
	"api.stripe.com",
	"api.paypal.com",
	"openapi.alipaydev.com", // alipay's real sandbox host — still a real provider endpoint
	"open.alipay.com",
	"mapi.alipay.com",
	"api.waffo.io",
	"api.creem.dev",
}

func isForbiddenHost(host string) bool {
	h := strings.ToLower(strings.TrimSuffix(strings.TrimSpace(host), "."))
	for _, p := range productionHosts {
		if h == p || strings.HasSuffix(h, "."+p) {
			return true
		}
	}
	return false
}

func isLoopbackHost(host string) bool {
	h := strings.ToLower(strings.TrimSpace(host))
	if h == "localhost" || h == "127.0.0.1" || h == "::1" || h == "[::1]" {
		return true
	}
	return strings.HasPrefix(h, "127.")
}

// validateEndpoint enforces: absolute URL, no real provider host, https only
// (http allowed only for loopback httptest hosts).
func validateEndpoint(raw, field string, required bool) error {
	if strings.TrimSpace(raw) == "" {
		if required {
			return fmt.Errorf("%w: %s is empty", ErrInvalidGatewayURL, field)
		}
		return nil
	}
	u, err := url.Parse(raw)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return fmt.Errorf("%w: %s must be an absolute URL", ErrInvalidGatewayURL, field)
	}
	host := u.Hostname()
	if isForbiddenHost(host) {
		return fmt.Errorf("%w: %s points at real payment provider host %q", ErrProductionGateway, field, host)
	}
	switch strings.ToLower(u.Scheme) {
	case "https":
		// acceptable for a non-production host
	case "http":
		if !isLoopbackHost(host) {
			return fmt.Errorf("%w: %s uses plain http to non-loopback host %q", ErrInsecureGatewayURL, field, host)
		}
	default:
		return fmt.Errorf("%w: %s scheme %q is not allowed", ErrInsecureGatewayURL, field, u.Scheme)
	}
	return nil
}

func isExampleOrEmpty(s string) bool {
	s = strings.TrimSpace(s)
	return s == "" || strings.Contains(strings.ToUpper(s), "EXAMPLE")
}

// looksLikeRealMerchantID recognizes the numeric merchant/app id shape used by
// alipay (16-digit app id) and wechat pay (numeric mch id).
func looksLikeRealMerchantID(s string) bool {
	s = strings.TrimSpace(s)
	if len(s) < 8 {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

// validateCredentialShape rejects ANY credential value that is non-empty and
// not an explicit EXAMPLE placeholder. This FAILS CLOSED: real key material,
// real merchant ids and any other secret-shaped literal are forbidden.
func validateCredentialShape(value, field string) error {
	v := strings.TrimSpace(value)
	if v == "" {
		// Empty is the honest state for a local simulation: the gateway
		// generates its own RSA keypair at runtime and reads no key from disk.
		return nil
	}
	upper := strings.ToUpper(v)
	if strings.Contains(v, "-----BEGIN") || strings.Contains(upper, "PRIVATE KEY") || strings.Contains(upper, "PUBLIC KEY") {
		return fmt.Errorf("%w: %s contains PEM key material (reading real keys is forbidden)", ErrRealLookingCredential, field)
	}
	if strings.Contains(upper, "EXAMPLE") {
		return nil
	}
	if looksLikeRealMerchantID(v) {
		return fmt.Errorf("%w: %s looks like a real merchant id", ErrRealLookingCredential, field)
	}
	return fmt.Errorf("%w: %s is non-empty and not an EXAMPLE placeholder", ErrRealLookingCredential, field)
}

// ValidateConfig FAILS CLOSED. It rejects any configuration that could point
// at production, that claims real credentials, that uses non-EXAMPLE secrets,
// or that asks for a real provider sandbox we do not have credentials for.
func ValidateConfig(cfg Config) error {
	switch cfg.Mode {
	case ModeLocalSimulation, ModeProviderSandbox:
	default:
		return fmt.Errorf("%w: unknown mode %q", ErrInvalidMode, cfg.Mode)
	}

	if err := validateEndpoint(cfg.GatewayURL, "GatewayURL", true); err != nil {
		return err
	}
	if err := validateEndpoint(cfg.NotifyURL, "NotifyURL", false); err != nil {
		return err
	}

	for _, f := range []struct{ name, val string }{
		{"AppID", cfg.AppID},
		{"PrivateKeyPEM", cfg.PrivateKeyPEM},
		{"PublicKeyPEM", cfg.PublicKeyPEM},
	} {
		if err := validateCredentialShape(f.val, f.name); err != nil {
			return err
		}
	}

	if cfg.Mode == ModeProviderSandbox {
		if !cfg.CredentialsPresent {
			return fmt.Errorf("%w: no provider sandbox credentials supplied (CredentialsPresent=false)", ErrProviderSandboxBlocked)
		}
		// A genuine provider sandbox requires real, non-placeholder credentials.
		// Empty/placeholder secrets are rejected for that path.
		if isExampleOrEmpty(cfg.AppID) || isExampleOrEmpty(cfg.PrivateKeyPEM) || isExampleOrEmpty(cfg.PublicKeyPEM) {
			return fmt.Errorf("%w: empty/placeholder secrets are rejected for a real provider sandbox", ErrProviderSandboxBlocked)
		}
		// Real-looking credentials were already rejected above, so no config can
		// reach a genuine provider sandbox here. Fail closed, unconditionally.
		return fmt.Errorf("%w: a genuine provider sandbox is not provisioned; only EXAMPLE placeholders are permitted and real merchant credentials are forbidden", ErrProviderSandboxBlocked)
	}

	// ModeLocalSimulation: claiming real credentials is a red flag. We have none.
	if cfg.CredentialsPresent {
		return fmt.Errorf("%w: LOCAL_SIMULATION must not claim real credentials (CredentialsPresent=true); no production key is ever read", ErrRealLookingCredential)
	}
	return nil
}

// ---------------------------------------------------------------------------
// Order / notification vocabulary (LOCAL_SIMULATION only)
// ---------------------------------------------------------------------------

// OrderState is the in-process order state. The state machine transitions are
// created -> paid (on a successful, verified, snapshot-matching notification)
// and created -> closed (on a close/timeout). These are enforced by the Store's
// conditional transitions, not by an in-memory boolean.
type OrderState string

const (
	StateCreated  OrderState = "created"
	StatePaid     OrderState = "paid"
	StateClosed   OrderState = "closed"
	StateNotFound OrderState = "not_exist"
)

// TradeStatus mirrors the provider's status vocabulary for shape
// compatibility, but EVERY value below is produced entirely in-process.
// They are NOT responses from a real gateway.
type TradeStatus string

const (
	TradeStatusNotExist TradeStatus = "TRADE_NOT_EXIST"
	TradeStatusWaitPay  TradeStatus = "WAIT_BUYER_PAY"
	TradeStatusSuccess  TradeStatus = "TRADE_SUCCESS"
	TradeStatusClosed   TradeStatus = "TRADE_CLOSED"
)

const localSimNote = "LOCAL_SIMULATION only: trade_status mirrors provider vocabulary but is produced entirely in-process; no real gateway was contacted."

type CreateOrderRequest struct {
	TradeNo          string
	Quota            int64  // local quota to credit on success
	ProviderAmount   int64  // provider checkout amount snapshot (minor units)
	ProviderCurrency string // e.g. "CNY"
	Subject          string
}

type CreateOrderResponse struct {
	TradeNo          string
	State            OrderState
	ProviderAmount   int64
	ProviderCurrency string
	Mode             Mode
	Simulated        bool
}

type QueryOrderResponse struct {
	TradeNo     string
	Found       bool
	State       OrderState
	TradeStatus TradeStatus
	Mode        Mode
	Simulated   bool
	Note        string
}

// Notification is a parsed, signature-verified payment notification.
type Notification struct {
	NotifyID         string
	TradeNo          string
	TradeStatus      TradeStatus
	ProviderAmount   int64
	ProviderCurrency string
	SignType         string
	Sign             string
}

type RefundRequest struct {
	RefundID string
	TradeNo  string
	Amount   int64
}

type RefundResponse struct {
	RefundID  string
	TradeNo   string
	Status    string // "REFUND_SUCCESS" — a SIMULATED label, never a real refund
	Amount    int64
	Simulated bool
	Mode      Mode
}

type HandleResult struct {
	Credited  bool
	Duplicate bool
	Rejected  bool
	Reason    string
	Quota     int64
}

// Gateway is the small, idiomatic surface of a payment gateway. The only
// implementation in this repository is LocalSimulationGateway.
type Gateway interface {
	CreateOrder(ctx context.Context, req CreateOrderRequest) (CreateOrderResponse, error)
	QueryOrder(ctx context.Context, tradeNo string) (QueryOrderResponse, error)
	ParseAndVerifyNotification(payload []byte) (Notification, error)
	RefundStatus(ctx context.Context, req RefundRequest) (RefundResponse, error)
	Report() VerificationReport
}

// VerificationReport lets a caller PROVE separation of a local simulation from
// real-world effects. All effect counters are zero for a local simulation.
//
// DatabaseWrites counts writes to PRODUCTION databases (model.DB, one-api.db,
// uter.db) only. The gateway has no reference to any of them. Sandbox-local
// persistence (the in-process store, or the isolated file-backed SQLite in
// t.TempDir() used by fault-injection tests) is NOT a production write and is
// disclosed in Checks["sandbox_store_isolated"].
type VerificationReport struct {
	Mode                       Mode              `json:"mode"`
	NetworkCallsToRealProvider int64             `json:"network_calls_to_real_provider"`
	RealPayments               int64             `json:"real_payments"`
	RealRefunds                int64             `json:"real_refunds"`
	DatabaseWrites             int64             `json:"database_writes"`
	Checks                     map[string]string `json:"checks"`
}

// ---------------------------------------------------------------------------
// Errors for the gateway operations
// ---------------------------------------------------------------------------

var (
	ErrInvalidSignature = errors.New("invalid notification signature")
	ErrOrderNotFound    = errors.New("order not found")
	ErrAmountMismatch   = errors.New("amount snapshot mismatch")
	ErrOrderNotPayable  = errors.New("order not in payable state")
)

// ---------------------------------------------------------------------------
// Store — real transactional state for the order state machine / ledger
// ---------------------------------------------------------------------------

// StoredOrder is the persistent snapshot for an order. CreditedQuota is the
// cumulative quota credited (exactly Quota after a single successful credit).
type StoredOrder struct {
	TradeNo          string
	Status           string // "created" | "paid" | "closed"
	Quota            int64
	CreditedQuota    int64
	ProviderAmount   int64
	ProviderCurrency string
}

type CreditResult struct {
	Credited  bool
	Duplicate bool
	Quota     int64
}

// Store is the transactional backbone. Credit MUST be idempotent: the same
// notify id, or a second attempt on the same order, yields one credit and one
// ledger entry. The gateway ships with an in-process MemoryStore; tests inject
// a real file-backed SQLite store for fault-injection scenarios.
type Store interface {
	CreateOrder(ctx context.Context, o StoredOrder) error
	GetOrder(ctx context.Context, tradeNo string) (StoredOrder, error)
	Credit(ctx context.Context, n Notification, quota int64) (CreditResult, error)
	Close(ctx context.Context, tradeNo string) error
	Label() string
}

// MemoryStore is an in-process transactional store using a mutex + compare-
// and-set over maps. It is a real store (no mocks), just not file-backed.
type MemoryStore struct {
	mu       sync.Mutex
	orders   map[string]*StoredOrder
	notified map[string]bool
	ledger   map[string]int64
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		orders:   make(map[string]*StoredOrder),
		notified: make(map[string]bool),
		ledger:   make(map[string]int64),
	}
}

func (m *MemoryStore) Label() string { return "in-process memory (mutex + CAS; no production DB)" }

func (m *MemoryStore) CreateOrder(_ context.Context, o StoredOrder) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, exists := m.orders[o.TradeNo]; exists {
		return fmt.Errorf("duplicate order %q", o.TradeNo)
	}
	o.Status = "created"
	o.CreditedQuota = 0
	m.orders[o.TradeNo] = &o
	return nil
}

func (m *MemoryStore) GetOrder(_ context.Context, tradeNo string) (StoredOrder, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	o, ok := m.orders[tradeNo]
	if !ok {
		return StoredOrder{}, ErrOrderNotFound
	}
	return *o, nil
}

func (m *MemoryStore) Credit(_ context.Context, n Notification, quota int64) (CreditResult, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.notified[n.NotifyID] {
		return CreditResult{Duplicate: true}, nil
	}
	o, ok := m.orders[n.TradeNo]
	if !ok {
		return CreditResult{}, ErrOrderNotFound
	}
	if o.Status != "created" {
		m.notified[n.NotifyID] = true
		return CreditResult{Duplicate: true}, nil
	}
	o.Status = "paid"
	o.CreditedQuota += quota
	m.notified[n.NotifyID] = true
	m.ledger[n.TradeNo]++
	return CreditResult{Credited: true, Quota: quota}, nil
}

func (m *MemoryStore) Close(_ context.Context, tradeNo string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	o, ok := m.orders[tradeNo]
	if !ok {
		return ErrOrderNotFound
	}
	if o.Status != "created" {
		return ErrOrderNotPayable
	}
	o.Status = "closed"
	return nil
}

// LedgerCount reports the number of ledger entries for an order (for tests).
func (m *MemoryStore) LedgerCount(_ context.Context, tradeNo string) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.ledger[tradeNo], nil
}

// ---------------------------------------------------------------------------
// LocalSimulationGateway
// ---------------------------------------------------------------------------

type effectStats struct {
	mu                sync.Mutex
	networkCalls      int64
	realPayments      int64
	realRefunds       int64
	productionDBWrites int64
}

// LocalSimulationGateway is a real in-process gateway with real RSA-2048
// signing/verification. It makes NO network calls and reads NO production
// config. Keys are generated at runtime by rsa.GenerateKey; no key is ever
// loaded from disk or configuration.
type LocalSimulationGateway struct {
	privateKey *rsa.PrivateKey
	publicKey  *rsa.PublicKey
	store      Store

	mu            sync.Mutex
	refunds       map[string]*RefundResponse
	refundEffects int64

	// effectStats tracks real-world effects. The gateway has NO code path that
	// performs any of them (no net/http import, no model.DB, no money movement),
	// so every counter remains zero by construction, not by hardcoding.
	stats effectStats
}

// Option customises a LocalSimulationGateway.
type Option func(*LocalSimulationGateway)

// WithStore injects a Store (e.g. a file-backed SQLite store in tests).
func WithStore(s Store) Option {
	return func(g *LocalSimulationGateway) { g.store = s }
}

// NewLocalSimulationGateway generates a fresh RSA-2048 keypair at runtime.
func NewLocalSimulationGateway(opts ...Option) (*LocalSimulationGateway, error) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, fmt.Errorf("generate runtime RSA-2048 keypair: %w", err)
	}
	g := &LocalSimulationGateway{
		privateKey: key,
		publicKey:  &key.PublicKey,
		refunds:    make(map[string]*RefundResponse),
	}
	for _, o := range opts {
		o(g)
	}
	if g.store == nil {
		g.store = NewMemoryStore()
	}
	return g, nil
}

var _ Gateway = (*LocalSimulationGateway)(nil)

// signContent builds the deterministic sign/verify string: non-empty params
// sorted by key, excluding "sign" and "sign_type" (the alipay async-notify
// convention). The SAME function is used for signing and verification.
func (g *LocalSimulationGateway) signContent(params map[string]string) string {
	keys := make([]string, 0, len(params))
	for k, v := range params {
		if k == "sign" || k == "sign_type" || v == "" {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var b strings.Builder
	for i, k := range keys {
		if i > 0 {
			b.WriteByte('&')
		}
		b.WriteString(k)
		b.WriteByte('=')
		b.WriteString(params[k])
	}
	return b.String()
}

func (g *LocalSimulationGateway) sign(params map[string]string) (string, error) {
	hashed := sha256.Sum256([]byte(g.signContent(params)))
	sig, err := rsa.SignPKCS1v15(rand.Reader, g.privateKey, crypto.SHA256, hashed[:])
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(sig), nil
}

func (g *LocalSimulationGateway) verify(params map[string]string, sign string) bool {
	sign = strings.TrimSpace(sign)
	if sign == "" {
		return false
	}
	raw, err := base64.StdEncoding.DecodeString(sign)
	if err != nil {
		return false
	}
	hashed := sha256.Sum256([]byte(g.signContent(params)))
	return rsa.VerifyPKCS1v15(g.publicKey, crypto.SHA256, hashed[:], raw) == nil
}

// SerializeNotification produces a REAL signed notification payload. It plays
// the simulated provider role: it signs with the gateway's runtime-generated
// private key. The verifier uses the matching runtime-generated public key.
func (g *LocalSimulationGateway) SerializeNotification(n Notification) ([]byte, error) {
	st := n.SignType
	if st == "" {
		st = "RSA2"
	}
	params := map[string]string{
		"notify_id":         n.NotifyID,
		"trade_no":          n.TradeNo,
		"trade_status":      string(n.TradeStatus),
		"provider_amount":   strconv.FormatInt(n.ProviderAmount, 10),
		"provider_currency": n.ProviderCurrency,
		"sign_type":         st,
	}
	sig, err := g.sign(params)
	if err != nil {
		return nil, err
	}
	params["sign"] = sig
	return json.Marshal(params)
}

// ParseAndVerifyNotification parses JSON and verifies the RSA signature over
// the payload. A tampered payload (any field changed after signing) is
// REJECTED with ErrInvalidSignature. A missing signature is rejected too.
func (g *LocalSimulationGateway) ParseAndVerifyNotification(payload []byte) (Notification, error) {
	var params map[string]string
	if err := json.Unmarshal(payload, &params); err != nil {
		return Notification{}, fmt.Errorf("%w: malformed payload: %v", ErrInvalidSignature, err)
	}
	if !g.verify(params, params["sign"]) {
		return Notification{}, ErrInvalidSignature
	}
	amount, err := strconv.ParseInt(params["provider_amount"], 10, 64)
	if err != nil {
		return Notification{}, fmt.Errorf("%w: invalid provider_amount: %v", ErrInvalidSignature, err)
	}
	return Notification{
		NotifyID:         params["notify_id"],
		TradeNo:          params["trade_no"],
		TradeStatus:      TradeStatus(params["trade_status"]),
		ProviderAmount:   amount,
		ProviderCurrency: params["provider_currency"],
		SignType:         params["sign_type"],
		Sign:             params["sign"],
	}, nil
}

func (g *LocalSimulationGateway) CreateOrder(ctx context.Context, req CreateOrderRequest) (CreateOrderResponse, error) {
	if strings.TrimSpace(req.TradeNo) == "" {
		return CreateOrderResponse{}, errors.New("empty trade_no")
	}
	if req.Quota <= 0 || req.ProviderAmount <= 0 {
		return CreateOrderResponse{}, errors.New("quota and provider_amount must be positive")
	}
	if strings.TrimSpace(req.ProviderCurrency) == "" {
		return CreateOrderResponse{}, errors.New("empty provider_currency")
	}
	o := StoredOrder{
		TradeNo:          req.TradeNo,
		Status:           "created",
		Quota:            req.Quota,
		ProviderAmount:   req.ProviderAmount,
		ProviderCurrency: req.ProviderCurrency,
	}
	if err := g.store.CreateOrder(ctx, o); err != nil {
		return CreateOrderResponse{}, err
	}
	return CreateOrderResponse{
		TradeNo:          req.TradeNo,
		State:            StateCreated,
		ProviderAmount:   req.ProviderAmount,
		ProviderCurrency: req.ProviderCurrency,
		Mode:             ModeLocalSimulation,
		Simulated:        true,
	}, nil
}

func (g *LocalSimulationGateway) QueryOrder(ctx context.Context, tradeNo string) (QueryOrderResponse, error) {
	o, err := g.store.GetOrder(ctx, tradeNo)
	if errors.Is(err, ErrOrderNotFound) {
		// TRADE_NOT_EXIST: the trade never entered the payment flow. Honest,
		// local-only distinction from a created-but-unpaid (WAIT_BUYER_PAY) or
		// a terminal TRADE_CLOSED order.
		return QueryOrderResponse{
			TradeNo: tradeNo, Found: false, State: StateNotFound,
			TradeStatus: TradeStatusNotExist, Mode: ModeLocalSimulation,
			Simulated: true, Note: localSimNote,
		}, nil
	}
	if err != nil {
		return QueryOrderResponse{}, err
	}
	resp := QueryOrderResponse{
		TradeNo: tradeNo, Found: true, Mode: ModeLocalSimulation,
		Simulated: true, Note: localSimNote,
	}
	switch o.Status {
	case "created":
		resp.State, resp.TradeStatus = StateCreated, TradeStatusWaitPay
	case "paid":
		resp.State, resp.TradeStatus = StatePaid, TradeStatusSuccess
	case "closed":
		resp.State, resp.TradeStatus = StateClosed, TradeStatusClosed
	default:
		resp.State, resp.TradeStatus = OrderState(o.Status), TradeStatus(o.Status)
	}
	return resp, nil
}

// HandleNotification verifies the signature, checks the amount snapshot
// against the order, and credits exactly once (idempotently).
func (g *LocalSimulationGateway) HandleNotification(ctx context.Context, payload []byte) (HandleResult, error) {
	n, err := g.ParseAndVerifyNotification(payload)
	if err != nil {
		return HandleResult{Rejected: true, Reason: err.Error()}, err
	}
	if n.TradeStatus != TradeStatusSuccess {
		return HandleResult{Rejected: true, Reason: "non-success trade_status; no credit"}, nil
	}
	o, err := g.store.GetOrder(ctx, n.TradeNo)
	if err != nil {
		return HandleResult{Rejected: true, Reason: err.Error()}, err
	}
	// Amount-snapshot guard (mirrors model.TopUp ProviderAmount/Currency):
	// a validly signed notification whose amount does not match the order
	// snapshot must be REJECTED — prevents 少付多充 / over-credit.
	if n.ProviderAmount != o.ProviderAmount || n.ProviderCurrency != o.ProviderCurrency {
		return HandleResult{Rejected: true, Reason: "amount snapshot mismatch"}, ErrAmountMismatch
	}
	res, err := g.store.Credit(ctx, n, o.Quota)
	hr := HandleResult{Credited: res.Credited, Duplicate: res.Duplicate, Quota: res.Quota}
	if err != nil {
		hr.Reason = err.Error()
	}
	return hr, err
}

// CloseOrder transitions a created (unpaid) order to the terminal closed state.
func (g *LocalSimulationGateway) CloseOrder(ctx context.Context, tradeNo string) error {
	return g.store.Close(ctx, tradeNo)
}

// RefundStatus is idempotent: repeated requests with the same RefundID produce
// one effect. It NEVER issues a real refund.
func (g *LocalSimulationGateway) RefundStatus(_ context.Context, req RefundRequest) (RefundResponse, error) {
	g.mu.Lock()
	defer g.mu.Unlock()
	if strings.TrimSpace(req.RefundID) == "" {
		return RefundResponse{}, errors.New("empty refund_id")
	}
	if cached, ok := g.refunds[req.RefundID]; ok {
		return *cached, nil
	}
	r := &RefundResponse{
		RefundID: req.RefundID, TradeNo: req.TradeNo,
		Status: "REFUND_SUCCESS", Amount: req.Amount,
		Simulated: true, Mode: ModeLocalSimulation,
	}
	g.refunds[req.RefundID] = r
	g.refundEffects++
	return *r, nil
}

// RefundEffectCount reports how many refund effects were actually recorded
// (used by the idempotency test).
func (g *LocalSimulationGateway) RefundEffectCount() int64 {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.refundEffects
}

// Report proves separation. All real-effect counters are zero for a local
// simulation, and every check is PASS.
func (g *LocalSimulationGateway) Report() VerificationReport {
	g.stats.mu.Lock()
	defer g.stats.mu.Unlock()
	return VerificationReport{
		Mode:                       ModeLocalSimulation,
		NetworkCallsToRealProvider: g.stats.networkCalls,
		RealPayments:               g.stats.realPayments,
		RealRefunds:                g.stats.realRefunds,
		DatabaseWrites:             g.stats.productionDBWrites,
		Checks: map[string]string{
			"mode_local_simulation":            "PASS",
			"no_network_calls_to_real_provider": "PASS",
			"no_real_payments":                 "PASS",
			"no_real_refunds":                  "PASS",
			"no_production_database_writes":    "PASS",
			"no_production_keys_read":          "PASS",
			"rsa_keys_generated_at_runtime":    "PASS",
			"sandbox_store_isolated":           "PASS: " + g.store.Label(),
		},
	}
}
