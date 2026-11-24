# UTER Pricing Execution Report

- Audit baseline: `3c09cd030d6eed331b191b23b35993f8f7d6e37b`
- Report date: 2026-11-23
- Overall status: **PARTIALLY_VERIFIED / NOT PRODUCTION READY**

## Commits in this remediation batch

| Commit | Change |
|---|---|
| `cb87d0d93` | Isolate channel price fallback; Uter.api auth; parity source split |
| `3b7015420` | Full upstream catalog parity and Uter.api live verification |
| `39fc636a9` | Live audit uses real usage keys |
| `5c59113c5` | Reject incomplete Bailian pagination |
| `40e6258d5` | Cross-instance channel price-sync lock |
| `f532239dd` | Uter Route manual sync reuses the channel lock |
| `032bcfa83` | Generic/Uter.api scheduled review and pricing rules |
| `16d20b426` | Review entries carry pricing version |
| `bb18b1501` | Post-sync catalog completeness verification |
| `8035ddf94` | Parity counts unverified purchase cost |
| `c827d5d71` | Generic upstream price history |
| `ef608ed81` | Orphan/Apiko historical data audit |

## Problems closed

1. Automatic source recognition divergence (`generic:`/`Uter.api-`/legacy `apiko-`).
2. Official vs channel vs estimate conflation in parity.
3. Uter.api price sync missing API key; Uter.api absent from adapter registry.
4. Silent global fallback for channels that already have scoped pricing.
5. Missing upstream models invisible to parity.
6. Generic/Uter.api scheduled sync ignored review/threshold/rules.
7. No cross-instance lock for generic/Uter.api/Uter Route manual sync.
8. Incomplete Bailian catalogs accepted.
9. Review approval could use a stale price state (version now checked).
10. Orphan and Apiko historical rows invisible.

## Verification evidence

| Command | Result |
|---|---|
| `go build ./...` | exit 0 |
| `make test` | exit 0 |
| `go test ./model ./service ./relay/helper ./relay -count=1` | passed |
| `PRICING_AUDIT=1 go test -tags pricing_audit_live ./service -run TestAuditUter.apiLive` | 51 models, 51 executable |
| `PRICING_AUDIT=1 go test -tags pricing_audit_live ./service -run TestAuditUterRouteLive` | 86 records, 54 executable, 32 review, 0 failures |
| `PRICING_AUDIT=1 go test -tags pricing_audit_live ./service -run TestAuditBailianLive` | 275 catalog, 134 records, 105 executable |
| `bun run typecheck` / `lint` / `format:check` | passed at last run |
| `./scripts/verify-all.sh --quick` | 9 PASS / 0 FAIL / 4 SKIP at last run |

## Model/price counts (live snapshot)

- Uter.api: 51 models, 51 records, 51 executable expressions.
- UterRoute: 86 records, 54 executable, 32 intentional review.
- Bailian: 275 catalog models, 134 records, 105 internal prices.

## Three-channel live validation (2026-11-23)

Definition used: official price = model vendor's published list price; channel
price = the selected upstream channel's published price after its group
discount; Uter price = channel price × 1.10 unless an operator price exists.

| Channel | Rows | Configured / review | Evidence |
|---|---:|---:|---|
| Uter Route `32` (优特渠道) | 86 | 86 / 0 | `claude-fable-5`: expression `p*10+c*50+cr*1+cc*12.5+cc1h*20`, group `default` 0.6 → channel `6 / 30`, cache `0.6`, cache write `7.5`; Uter `6.6 / 33`, cache `0.66`, cache write `8.25` |
| Alibaba Bailian `34` | 134 | 122 / 12 | 33 auto `bailian-channel` prices plus 89 operator `batch` prices; auto flat and tiered prices all include the 1.10 markup |
| Alibaba Bailian `62` (new draft channel) | 3 | 1 / 2 | `MiniMax-M2.5`: channel `0.31390134529147984 / 1.2556053811659194`, Uter `0.34529147982062786 / 1.3811659192825114` (exact ×1.10); `qwen-plus` / `qwen-flash` stay review-only because the catalogue publishes both implicit cache-hit and explicit cache-read prices |
| Uter.api `54`–`60` | 68 | 68 / 0 | All executable expressions refreshed to `(base × 1.10) × group`; `54` (`Claude-kiro` 0.9): channel `1.8 / 9`, Uter `(base × 1.10) × 0.9` = `1.98 / 9.9` |

Commands used:

```bash
go run /tmp/uter_Uter.api_refresh.go      # refresh Uter.api with the application sync path
go run /tmp/uter_uterroute_refresh.go # refresh Uter Route channel 32
bunx vitest run src/features/channels/components/__tests__/channel-pricing-panel.test.tsx
make test
./scripts/verify-all.sh --quick
```

Results: `make test` exit 0; quick gates 9 PASS / 0 FAIL / 4 SKIP; the frontend
pricing panel test 5/5 passed. A workspace-enabled `go test ./controller`
selection still fails `TestManageUserQuotaMiddlewareKeepsOneOperationPerRequest`
because a legacy token is rejected; the same package passes under the project
gate (`GOWORK=off`, as used by `make test`). It is unrelated to pricing.

## Runtime rebuild and Apiko documentation cleanup (2026-11-23)

- `web/` production build: exit 0; the served `index.html` references the newly
  generated asset hashes, so port 3000 now uses the current UI bundle.
- Root Go build with `GOWORK=off`: exit 0; local `uter-bin` rebuilt and
  restarted after backing up the previous binary to `/tmp/uter-bin.prev`.
- Browser verification of `/pricing` is **BLOCKED**: the unauthenticated
  isolated session redirects to email-code sign-in, and no authorized session
  credential is available. Data and unit-level rendering remain verified;
  this is not reported as a visual pass.
- Repository-wide runtime grep for `Apiko`/`apiko` finds no provider, route,
  task, controller or model code. Only the `apiko-` prefix in the automatic
  source classifier remains, intentionally, for historical-row audit.
- `docs-dev/pricing-remediation/PHASE-03-PROVIDER-SYNC.md` and
  `PHASE-06-PRICE-GOVERNANCE.md` now describe Uter.api in place of the removed
  Apiko runtime and state the historical-prefix boundary.

## Uter Route official-price display fix (2026-11-23)

Root cause: Uter Route expression models only wrote a discounted
`channel_price`; the expression coefficients were never copied into `tiers`, so
the page's "Upstream official price" stayed empty. Ratio-only rows also had the
upstream-provided `official_price` deliberately discarded.

The parser now:

- writes the undiscounted expression coefficients as the official tier while
  keeping the group-discounted tier as `channel_price`;
- exposes the upstream `official_price` as a reference tier for ratio-only and
  historical rows, while keeping `PriceKind`, `NeedsReview` and the review
  reason unchanged so neither can auto-enable billing;
- leaves `HasOfficial`/`HasOfficialEstimate` semantics unchanged.

Live channel `61` now has 84/84 Uter Route rows with both official and channel
prices. A second set of 84 duplicate `newapi-compatible` rows with the same
model identities had no official price and made the page look inconsistent;
they were removed after the database backup, leaving only the Uter Route rows.
Examples:

| Model | Official | Channel | Uter | State |
|---|---|---|---|---|
| `claude-fable-5` | `$10 / $50`, cache `$1`, cache write `$12.5` | `$6 / $30` | `$6.6 / $33` | configured |
| `MiniMax-M2.5` | `$0.3 / $1.2` | `$0.285 / $1.14` | `$0.3135 / $1.254` | configured (`RATIO_ONLY` source preserved) |

Tests: `TestUterRouteRatioDerivedPriceStaysReviewOnly`,
`TestUterRouteExpressionKeepsAllTiersAndReviewGate`, and the UterRoute
pricing suite pass. The database was backed up to
`/tmp/one-api.before-uterroute-official.db` before the refresh.

## Post-rebuild live verification (2026-11-23)

| Check | Result |
|---|---|
| `PRICING_AUDIT=1 ... TestAuditUterRouteLive` | 86 records, 54 executable, 32 review, 0 failures |
| `PRICING_AUDIT=1 ... TestAuditBailianLive` | 275 catalog, 134 records, 105 executable, 29 review, 0 stale |
| `PRICING_AUDIT=1 ... TestAuditUter.apiLive` | 51 models, 14 groups, 51 executable, 0 failures |
| `GOWORK=off go test -race ./service -run 'Uter.api\|Bailian\|Pricing\|Markup\|Upstream'` | PASS |
| `GOWORK=off go test -race ./model -run 'ChannelPricing\|ScopedPricing\|Purchase\|BillingSnapshot'` | PASS |
| `TestChannelPricing*AcrossDatabases` | SQLite PASS; MySQL/PostgreSQL skipped without DSN |

The live audits fetch the current upstream documents; they do not write database
rows. Uter Route ratio-only and historical rows now use the upstream
`official_price` reference to generate a configured sale price
(`channel price × 1.10`) while retaining `RATIO_ONLY` / `HISTORICAL_SNAPSHOT` as
the price-kind marker. Unsupported or missing shapes still stop at review.

Current channel `61` parity: `FULLY_MATCHED: 84`, `MANUAL_REVIEW: 0`,
`PRICE_MISMATCH: 0`. The 44 expression, 24 ratio-only, 8 historical and 8
absolute records are all `configured`.

A new guard rejects scheduled generic sync for an Uter.api channel that has
no stored billing group, instead of silently syncing the undiscounted catalogue
price (`TestUterAPIGenericSyncRequiresBillingGroup`).

## Request-level billing reconciliation samples (2026-11-23)

Two real consume logs were matched to their written price contracts by channel,
model and identical `created_at` (the supplier-side request ids are not the
same, so the nearest-time mapping is used).

| Log | Model / channel | Snapshot contract | Recalculation | Logged quota |
|---|---|---|---|---:|
| `8732` | `claude-fable-5` / `32` | `per_1m_token`, ratio `3.3`, completion `5` | `8×3.3 + 14×3.3×5 = 257.4` | `257` |
| `8733` | `qwen3-coder-flash-2025-07-28` / `34` | tiered expression, first tier `p×0.149476831 + c×0.597907324`, then `×1.1` | `(9×0.149476831 + 9×0.597907324)×1.1 / 1e6 × 500000 ≈ 3.70` | `4` |

Both snapshots carry the purchase price separately from the sale contract and
mark `PurchaseVerified=false`, so the public quote is not presented as a
verified contract. These samples close the flat-ratio and tiered-expression
request-level checks; supplier invoice reconciliation still needs the vendor
export and a supplier→Uter request-id mapping.

## Active local DB drift (2026-11-23 10:17)

The shared local `one-api.db` changed outside this task after the pricing
validation. Channels `32`, `34` and `54`–`60` disappeared from the active
channel table and a draft channel `61` appeared; pricing rows for the removed
channels still exist and are now orphaned. This task did not delete any channel
or run a database reset. The pre-change database backup is
`/tmp/one-api.before-Uter.api-refresh.db`; it was not restored because restoring
could overwrite concurrent user work. The counts and channel evidence above
describe the validated snapshot, not the current drifted database. Re-sync and
re-validate the active channels before release.

## Three-database matrix (2026-11-23)

MySQL 8.4.13 and PostgreSQL 16.16 were installed locally and started as
temporary instances; SQLite runs in memory.

```bash
export UTER_TEST_MYSQL_DSN='uter:uter@tcp(127.0.0.1:3306)/uter?parseTime=true&charset=utf8mb4'
export UTER_TEST_POSTGRES_DSN='postgres://uter:uter@127.0.0.1:5432/uter?sslmode=disable'
GOWORK=off go test -count=1 ./model \
  -run 'TestChannelPricing.*AcrossDatabases|TestMultiDBDialectCompat' -v
```

| Test | SQLite | MySQL 8.4.13 | PostgreSQL 16.16 |
|---|---|---|---|
| `TestChannelPricingTablesAcrossDatabases` | PASS | PASS | PASS |
| `TestChannelPricingIdentityMigrationAcrossDatabases` | PASS | PASS | PASS |
| `TestMultiDBDialectCompat` | PASS | PASS | PASS |

The pricing tests migrate every pricing/snapshot/invoice table twice to prove
idempotency, assert the full identity unique constraint, assert a second region
is a separate identity, and reproduce a pre-migration duplicate identity to
prove the merge and index swap. The expected `Duplicate entry` log lines are
negative assertions. ClickHouse is a log-database dialect and is not used by
these primary-database pricing tables, so its subtest remains skipped.

A full application startup matrix was then run against fresh databases:

| Engine | First start | Second start | Marker rows |
|---|---|---|---|
| MySQL 8.4.13 | `/api/status` 200 | `/api/status` 200 | 1 |
| PostgreSQL 16.16 | `/api/status` 200 | `/api/status` 200 | 1 |

This exposed a real MySQL-only defect: the log-cache backfill marker used the
reserved word `key` unquoted in raw SQL, so every MySQL start logged
`Error 1064`. `model/main.go` now builds the statement with `commonKeyCol`; the
second MySQL start wrote exactly one marker row and logged no SQL error. Both
temporary database servers were stopped after the matrix.

## DreamRouter/UterRoute channel-price correction (2026-11-23 21:13)

Channels 63–66 had been populated by the generic New API sync with provider
`newapi-compatible`. That path has no model-group discount context, so the
undiscounted expression price was written into `channel_price`: the official
price was presented as the channel price and the real discounted channel price
was missing.

The fix:

- Generic sync now routes every UterRoute host channel to
  `UterRouteChannelPricingRecords`; it no longer writes generic New API price
  rows for those channels.
- Discount selection ignores unstable `enable_groups` order and deterministically
  chooses the lowest positive published model-group ratio.
- 332 erroneous `newapi-compatible` rows were deleted after backing up the
  database to `/tmp/one-api.before-uterroute-fix.db`.
- Channels 61, 63, 64, 65 and 66 were re-synced. Each now has 83 UterRoute rows
  with both official and channel prices.
- `claude-fable-5` is consistent across all five channels: official `$10/$50`,
  channel `$6/$30`, Uter sale `$6.6/$33`.

Tests:

- `TestGenericSyncPrunesUterRouteModelsWithoutVendor` now asserts the provider
  route and `discount_model_group=claude`.
- `TestUterRouteDiscountSelectionIgnoresEnableGroupOrder` proves both group
  orderings select `claude` at 0.6.
- `GOWORK=off go test -count=1 ./service` and `make test`: exit 0.

## Historical data snapshot

- 711 channel pricing rows total.
- 413 rows belong to deleted channels (IDs 26, 31, 33, 35, 36).
- 69 rows are Apiko residue.

No production data was deleted or rewritten.

## Outstanding blockers

1. Authorized supplier invoice exports.
2. Backup/preview/approval for orphan and Apiko rows.
3. Decimal/FX migration.
4. Runtime image-task usage facts.
5. Production release-candidate smoke on the real deployment topology (local full startup matrix now passes on SQLite/MySQL/PostgreSQL).
6. Real token/image/video/B-C group request closure.

## Final status

The code defects in this batch are implemented and covered by tests. The full
release gate is not met. Use `PARTIALLY_VERIFIED`, not `FULLY_OPERATIONAL`.