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
| P0-1 | P0 | Price-source recognition diverged: `autoDerivedInternalSource` accepted `generic-` but `internalPricingReplaceable` did not, so generic/xxapi sync prices could not be updated reliably. | Fixed |
| P0-2 | P0 | Parity audit folded official and channel quotes into one `HasOfficial` flag, hiding ratio-only estimates. | Fixed |
| P0-3 | P0 | XXAPI channel price sync called `/api/pricing` without the channel API key and XXAPI was absent from the provider adapter registry. | Fixed |
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
`dreamrouter-`, `bailian-`, `newapi-`, `newapi:`, `generic-`, `generic:`,
`xxapi-`, `apiko-` (legacy cleanup). Operator, batch and approved prices remain
protected.

### 3.2 Separate official price, estimate and channel quote

`service/channel_pricing_audit.go` now reports:

- `has_official`: absolute official tiers only.
- `has_official_estimate`: ratio-derived estimate only.
- `has_channel_price`: upstream channel quote.
- `price_kind`: original source classification.

Ratio-only rows without a channel quote are reported as `PRICE_MISMATCH`
instead of `FULLY_MATCHED`. Freshness is 48 hours, matching the channel pricing
screen.

### 3.3 XXAPI authentication and provider registration

- `SyncXXAPIChannelPricing` resolves the channel key with
  `GetNextEnabledKey()` and forwards it as `Authorization: Bearer`.
- A missing key fails the sync instead of claiming success.
- `xxapiAdapter` is registered in `UpstreamProviderAdapter` with its real
  capability boundaries (gateway quote, not vendor official price).

### 3.4 No silent cross-channel fallback

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
| `go test ./service -run 'TestFetchXXAPIPricingPayloadSendsChannelKey|TestXXAPIProviderAdapterIsRegistered'` | passed |
| `go test ./relay/helper -run 'TestScopedChannelMissingModelDoesNotFallBackToGlobalPrice'` | passed |

## 4.1 Live catalog verification (2026-11-22)

Commands:

```bash
PRICING_AUDIT=1 go test -tags pricing_audit_live ./service -run TestAuditXXAPILive -v
PRICING_AUDIT=1 go test -tags pricing_audit_live ./service -run 'TestAuditDreamRouterLive|TestAuditBailianLive' -v
```

| Provider | Result |
|---|---|
| XXAPI | 51 models, 51 pricing records, 51 executable expressions, 14 groups, 0 failures |
| DreamRouter | 86 records, 54 executable, 32 intentional review rows (24 ratio-only + 8 historical), 0 execution failures |
| Bailian | 275 catalog models, 134 records, 105 internal prices, 102 executable; 3 image expressions fail on missing usage facts |

Bailian failures requiring follow-up:

- `qwen-image-3.0-pro` and `qwen-image-3.0`: `u("image_count")` is nil in the
  settlement sample.
- `z-image-turbo`: `u("prompt_extend")` is nil and cast to bool.

These are usage-fact completeness issues, not price-format issues. Until the
runtime guarantees those facts (or the expression gets a safe default), these
three models must not be treated as fully verified.

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
4. XXAPI public catalog was verified live (51/51 executable). Real-key group
   sync still requires an authorized key; the pricing document itself is public.
5. Real upstream invoice reconciliation is blocked without authorized billing
   exports.
6. Bailian has three image expressions that fail when optional usage facts are
   absent (see 4.1); they remain NEEDS_REVIEW until the runtime fact contract is
   fixed.
6. Decimal/currency conversion migration away from float64 is not complete.
7. Apiko runtime removal is complete; historical data migration must be handled
   separately before any production cleanup.

## 6. Acceptance status

The four P0 code defects above are implemented and covered by automated tests.
This does **not** satisfy the full release gate: catalog completeness,
provider-level real-data verification, real invoice reconciliation, and
historical data migration remain open. The correct status is
**PARTIALLY_VERIFIED / NOT PRODUCTION READY**.