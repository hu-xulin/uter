# UTER Pricing Full Audit

- Audit baseline: `3c09cd030d6eed331b191b23b35993f8f7d6e37b`
- Audit date: 2026-11-22
- Status: **PARTIALLY_VERIFIED**
- Production readiness: **NOT PRODUCTION READY**

> This report records only code and tests that were actually executed. No
> upstream invoice, production database write, or real supplier account was
> treated as verified in this pass.

## 1. Scope

Audited the pricing call chain:

upstream catalog → official price → channel quote → purchase cost → Uter sale
price → runtime identity → pre-consume → settlement → reconciliation.

Packages reviewed: `model/`, `service/`, `controller/`, `relay/`,
`relay/helper/`, `setting/`, and channel pricing UI contracts.

## 2. Confirmed findings

| ID | Priority | Finding | Status |
|---|---|---|---|
| P0-1 | P0 | Price-source recognition diverged: `autoDerivedInternalSource` accepted `generic-` but `internalPricingReplaceable` did not, so generic/Uter.api sync prices could not be updated reliably. | Fixed |
| P0-2 | P0 | Parity audit folded official and channel quotes into one `HasOfficial` flag, hiding ratio-only estimates. | Fixed |
| P0-3 | P0 | Uter.api channel price sync called `/api/pricing` without the channel API key and Uter.api was absent from the provider adapter registry. | Fixed |
| P0-4 | P0 | A channel that already had channel-scoped prices fell back to global pricing when one model row was missing. | Fixed |
| P1-1 | P1 | Audit freshness used 7 days while the pricing screen used 48 hours. | Fixed |
| P1-2 | P1 | Full upstream catalog parity (upstream models absent from DB) is still not computed in the audit report. | Fixed: API now fetches the provider catalog and reports `MODEL_MISSING` |
| P1-3 | P1 | Purchase cost display still exposes a primary dimension; the full contract is stored and billed, but unmapped dimensions rely on the contract parser. | Partially addressed |
| P1-4 | P1 | Manual providers (OpenAI, Anthropic, Gemini, Azure, Bedrock, Tencent, Volcengine) still have no authorized automatic price API. | Open / blocked on data source |
| P1-5 | P1 | Real upstream invoice reconciliation remains blocked pending authorized exports. | Blocked |

## 3. Fixes applied

### 3.1 Unified automatic price-source recognition

`model/channel_model_pricing.go` now uses one prefix set for both
`autoDerivedInternalSource` and `internalPricingReplaceable`:
`uterroute-`, `bailian-`, `newapi-`, `newapi:`, `generic-`, `generic:`,
`Uter.api-`, `apiko-` (legacy cleanup). Operator, batch and approved prices remain
protected.

### 3.2 Separate official price, estimate and channel quote

`service/channel_pricing_audit.go` now reports:

- `has_official`: absolute official tiers only.
- `has_official_estimate`: ratio-derived estimate only.
- `has_channel_price`: upstream channel quote.
- `price_kind`: original source classification.
- `has_purchase_cost` / `purchase_verified`: whether the full contract cost is
  present and operator-confirmed.
- `purchase_unverified`: count of configured models whose sale price has no
  verified purchase contract.

Ratio-only rows without a channel quote are reported as `PRICE_MISMATCH`
instead of `FULLY_MATCHED`. Freshness is 48 hours, matching the channel pricing
screen.

### 3.3 Uter.api authentication and provider registration

- `SyncUter.apiChannelPricing` resolves the channel key with
  `GetNextEnabledKey()` and forwards it as `Authorization: Bearer`.
- A missing key fails the sync instead of claiming success.
- `Uter.apiAdapter` is registered in `UpstreamProviderAdapter` with its real
  capability boundaries (gateway quote, not vendor official price).

### 3.4 Incomplete provider catalogs are rejected

Bailian pagination now fails the sync when the fetched model count is smaller
than the upstream's reported total. A partial page set can no longer be
published as a complete catalog and trigger mass model removal.

### 3.4 Generic/Uter.api scheduled rules and change review

Generic/New API and Uter.api scheduled syncs now:

- snapshot prices before writing;
- detect real price movements;
- create review entries when `review_mode=manual` or a threshold is set;
- skip applying the scheduled rule for changes above the threshold;
- apply the configured basis/mode/value on sync when enabled;
- append every detected change to a bounded
  `GenericUpstreamPriceHistory` log (latest 1000 entries).

### 3.4.1 Catalog verification after every sync

Successful channel syncs now persist a `ChannelPricingCatalogVerify:<id>`
report built from the provider's complete catalog. Missing upstream models are
counted and logged; providers without a catalog adapter make no completeness
claim.

### 3.5 Cross-instance price-sync lock

Generic/New API and Uter.api channel price syncs now claim a database-backed
`channel_price_sync:<id>` lock before fetching or writing. A second instance
returns `ErrPricingSyncInProgress` instead of writing a competing snapshot; the
lock is released when the sync finishes.

### 3.6 No silent cross-channel fallback

`model.ChannelUsesScopedPricing(channelID)` marks channels that already have
`channel_model_pricing` rows. For those channels, a missing model row now
returns `channelPriceNotConfiguredError` in token, per-call and task billing
instead of using global pricing. Channels with no scoped rows keep the legacy
global path.

## 4. Verification executed

| Command | Result |
|---|---|
| `go build ./...` | exit 0 |
| `go test ./model ./service ./relay/helper ./relay -count=1` | all passed |
| `go test ./model -run 'TestAutoDerivedSourcesAgreeAcrossFunctions|TestChannelUsesScopedPricing'` | passed |
| `go test ./service -run 'TestBuildUpstreamParityReport'` | passed |
| `go test ./service -run 'TestFetchUter.apiPricingPayloadSendsChannelKey|TestUter.apiProviderAdapterIsRegistered'` | passed |
| `go test ./relay/helper -run 'TestScopedChannelMissingModelDoesNotFallBackToGlobalPrice'` | passed |

## 4.1 Live catalog verification (2026-11-22)

Commands:

```bash
PRICING_AUDIT=1 go test -tags pricing_audit_live ./service -run TestAuditUter.apiLive -v
PRICING_AUDIT=1 go test -tags pricing_audit_live ./service -run 'TestAuditUterRouteLive|TestAuditBailianLive' -v
```

| Provider | Result |
|---|---|
| Uter.api | 51 models, 51 pricing records, 51 executable expressions, 14 groups, 0 failures |
| Uter Route | 86 records; after the 2026-11-23 ratio/historical auto-pricing policy, all stored rows are configured and executable; 0 execution failures |
| Bailian | 275 catalog models, 134 records, 105 internal prices, 105 executable with canonical facts for all referenced usage keys |

The earlier three image-expression failures were audit-fixture gaps: the
expressions reference `image_count`, `input_image_count`, `prompt_extend` and
`output_image_type`, which a generic sample did not provide. The live audit now
supplies a canonical value for every key returned by
`billingexpr.UsedUsageKeys`, and all 105 internal prices execute.

Runtime still must provide those facts from the actual image task. If a
settlement path omits them, the expression fails safely instead of charging a
wrong amount; that path remains covered by the task-billing tests, not by this
catalog audit.

## 5. Not verified / remaining work

1. Full catalog comparison is implemented through the provider adapters and is
   reported by `GET /api/channel/:id/upstream_parity`. A provider without a
   registered catalog adapter or without a usable key reports `catalog_error`
   instead of claiming completeness.
2. Purchase cost is stored as a full per-dimension contract and billed through
   `buildPurchaseCostRows`; the single primary value remains a display/estimate
   field and must never be treated as full contract cost.
3. Manual providers still require operator-confirmed prices or official
   documents; no automatic fetch was invented for them.
4. Uter.api public catalog was verified live (51/51 executable). Real-key group
   sync still requires an authorized key; the pricing document itself is public.
5. Real upstream invoice reconciliation is blocked without authorized billing
   exports.
6. Bailian image expressions depend on task usage facts (`image_count`,
   `input_image_count`, `prompt_extend`, `output_image_type`). Their settlement
   path must keep reporting those facts; the catalog audit alone cannot prove it.
6. Decimal/currency conversion migration away from float64 is not complete.
7. Apiko runtime removal is complete; historical data migration must be handled
   separately before any production cleanup.

## 4.2 Three-layer price verification (2026-11-23)

| Channel | Official | Channel quote | Uter default |
|---|---|---|---|
| Uter Route new channel, `claude-fable-5` | expression `p*10+c*50+cr*1+cc*12.5+cc1h*20` | 6 / 30 USD per 1M (0.6 group) | expression × 0.6 × **1.1** → 6.6 / 33 |
| Bailian, `MiniMax/MiniMax-M3` | channel catalog quote | 0.6278026906 / 2.5112107623 | 0.6905829596 / 2.7623318386 (×1.1) |
| Uter.api, expression example | gateway expression (no vendor list price) | expression × group ratio (unit test: 5 / 25) | expression × group × **1.1** |

Bailian seed now refreshes previous automatic prices (source `bailian-*`) while
protecting operator/batch prices. Uter.api live groups: 14; creation without a key
is rejected.

## 5.0 Sample reconciliation attempt (2026-11-23)

Uter Route usage page: 9 rows today (00:27–03:30), 7 matched to Uter consume
logs by timestamp, 2 unmatched (retry/timeout candidates).

Supplier lines can now carry `occurred_at`; Uter resolves the nearest consume
log for the same channel/model within 60 seconds. The retry returned
`NO_REQUEST: 9` because this snapshot is internal **Model test** traffic: its
consume-log request ids come from the log path, while the billing snapshots
carry ids generated on the relay attempt, and those snapshots have no purchase
cost breakdown. Request-level reconciliation is therefore **BLOCKED** for this
traffic until either:

- the request-id path for internal test traffic is unified, and
- purchase contracts are recorded and frozen into billing snapshots.

This is a data-contract blocker, not a pricing-rule failure.

## 5.1 Historical data residue (production DB snapshot)

Read-only audit of the local production database on 2026-11-23:

| Item | Count |
|---|---:|
| Total channel pricing rows | 711 |
| Rows whose channel no longer exists | 413 |
| Apiko-provider rows (orphaned) | 69 |

Orphan channel IDs in this snapshot: 26, 31, 33, 35, 36. These rows are not
billable but remain in the table. They are exposed by `GET /api/channel/pricing_audit` under `orphans`, and a
read-only backup/preview payload is available at
`GET /api/channel/pricing_audit/orphans`.

Cleanup is intentionally **not** automatic. It requires a database backup,
per-channel preview, and explicit operator approval. Apiko rows are historical
residue from the removed provider and must be migrated or archived separately
from runtime code deletion.

## 6. Acceptance status

The four P0 code defects above are implemented and covered by automated tests.
This does **not** satisfy the full release gate: catalog completeness,
provider-level real-data verification, real invoice reconciliation, and
historical data migration remain open. The correct status is
**PARTIALLY_VERIFIED / NOT PRODUCTION READY**.