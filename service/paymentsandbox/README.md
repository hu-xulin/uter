# paymentsandbox — in-process payment gateway for settlement testing

A Go package used to exercise payment/settlement logic with **real code and real
tests**, without ever touching a real payment provider, real money, real refunds,
production databases, or production credentials.

This package is deliberately distinct from `.uap/tools/financial-simulation.mjs`:
that tool is a **static source scan + in-memory simulation** (`simulated_only =
true`). Here, behaviours are proven by executing real Go: real RSA-2048
sign/verify (keys generated at runtime), a real transactional order state
machine, real notification (de)serialization, and — in the fault-injection
tests — a **real file-backed SQLite database** (`github.com/glebarez/sqlite`) in
`t.TempDir()` with real SQL transactions and conditional updates.

## The two modes — never conflate them

| Mode | String | Status here |
|------|--------|-------------|
| `ModeLocalSimulation` | `LOCAL_SIMULATION` | **Implemented.** All tests in this package are labelled this. |
| `ModeProviderSandbox` | `PAYMENT_SANDBOX_VERIFIED` | **BLOCKED_EXTERNAL_DEPENDENCY.** Not implemented, never used as a label. |

Local simulated gateway tests **MUST** be labelled `LOCAL_SIMULATION`. They are
**NEVER** labelled `PAYMENT_SANDBOX_VERIFIED`. That second status is reserved
for actual interaction with a real payment provider's sandbox — which requires
provider credentials this repository does **not** have. `ValidateConfig` fails
closed on `ModeProviderSandbox` and returns `ErrProviderSandboxBlocked`.

`Report()` lets a caller prove the separation: `mode = LOCAL_SIMULATION`, and
`network_calls_to_real_provider`, `real_payments`, `real_refunds`,
`database_writes` are all zero for a local simulation. `checks` lists the
invariants (all PASS) and discloses the isolated sandbox store.

`database_writes` counts writes to **production** databases (`model.DB`,
`one-api.db`, `uter.db`) only. The gateway has no reference to any of them. The
in-process `MemoryStore` and the test-only `t.TempDir()` SQLite store are
sandbox-local and are disclosed in `checks["sandbox_store_isolated"]`; they are
never production writes. These tests do **not** use the global `model.DB` and do
**not** touch the repo's databases.

## What is genuinely verified

- Real RSA-2048 signing and verification; tampered/missing signatures rejected.
- Real notification serialization/parsing.
- Real order state machine `created -> paid -> closed`, with honest local-only
  `TRADE_NOT_EXIST` / `WAIT_BUYER_PAY` / `TRADE_SUCCESS` / `TRADE_CLOSED` labels.
- Idempotent notification handling (same notify id -> one credit).
- Amount/currency snapshot guard (mirrors `model.TopUp.ProviderAmount` /
  `ProviderCurrency`): a validly signed but amount-mismatched notification is
  rejected to prevent over-credit.
- Idempotent refund status.
- Fault injections against a real file-backed SQLite DB: commit failure -> no
  credit (real rollback); commit success but lost response -> no double credit;
  concurrency -> exactly one credit; retries -> no duplicate ledger entry.
- `ValidateConfig` rejects production hosts, non-HTTPS non-loopback URLs, real
  key material / merchant ids, and provider-sandbox mode without credentials.

## What remains BLOCKED_EXTERNAL_DEPENDENCY

Interaction with a **real** Alipay / WeChat Pay / Creem / Stripe sandbox —
creating a real order, receiving a real provider-signed notification, performing
a real refund — is **not** verified here. There are no provider sandbox
credentials, and the adapter is forbidden from reaching any real provider host
(see the deny-list in `adapter.go`). No network call to a real provider is made.

## Configuring when real sandbox credentials are eventually provided

1. Add a real `Gateway` implementation that talks to the provider's **sandbox**
   endpoint (never `openapi.alipay.com`, `api.mch.weixin.qq.com`, `api.creem.io`,
   etc. — those are the production defaults in
   `setting/operation_setting/payment_gateway_cn.go`).
2. Supply genuine sandbox credentials via a secret manager — never hardcode them
   and never point `Config` at production keys. Set `CredentialsPresent = true`
   only for that real path, and use `Mode = ModeProviderSandbox`.
3. Remove the fail-closed block in `ValidateConfig` for `ModeProviderSandbox`
   only after the sandbox endpoint and credentials are genuinely available and
   reviewed. Until then, that mode stays `BLOCKED_EXTERNAL_DEPENDENCY`.
4. Keep local simulation tests labelled `LOCAL_SIMULATION`; label only verified
   real-sandbox runs `PAYMENT_SANDBOX_VERIFIED`.

## Production keys are never read

`LocalSimulationGateway` generates its RSA-2048 keypair with `rsa.GenerateKey` at
runtime. No key is loaded from disk, config, or environment. `ValidateConfig`
rejects any config field that contains real PEM key material, a real merchant-id
shape, or any non-`EXAMPLE` secret. Only explicit `EXAMPLE` placeholder literals
are permitted in a local-simulation config. The package does not import
`model` or `setting/operation_setting`, and does not read production config.
