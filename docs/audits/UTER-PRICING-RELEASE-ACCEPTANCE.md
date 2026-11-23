# UTER Pricing Release Acceptance

Current decision: **NOT PRODUCTION READY**. Overall status:
**PARTIALLY_VERIFIED**.

## Gate checklist

| Gate | Result | Evidence / blocker |
|---|---|---|
| Provider capability declarations | PASS | `UpstreamProviders()` |
| Catalog completeness comparison | PASS (providers with adapters) | `MODEL_MISSING`, `catalog_error` |
| Official vs channel vs purchase vs sale separation | PASS | separate columns + parity flags |
| No unverified purchase cost treated as contract | PASS | `purchase_verified=false`, estimate path |
| No automatic overwrite of operator price | PASS | auto-source prefix protection |
| Purchase contract dimensions | PARTIAL | backend stores full tiers/dimensions; editor exposes flat input/output/call/second/minute |
| No cross-channel/region/deployment price reuse | PASS | channel id + model + region/deployment scoping; provider label is not the sole key |
| Provider label normalization | PARTIAL | legacy type-60 channels may report `uter` while the row provider is DreamRouter/New API |
| No unauthorized fallback | PASS for channels with scoped rows | channels without rows keep legacy path |
| Missing dimensions not defaulted to zero | PASS in price parsers | missing output stays review-only |
| Unreviewed price not auto-billed | PASS | review gate + threshold |
| Expressions executable | PASS for live XXAPI/Bailian/DreamRouter except intentional review rows | live audit |
| Request price version traceability | PASS | billing snapshot + `pricing_version` |
| Pre-consume/settle/refund same contract | PASS in code | billing tests |
| Auto sync/update/verify | PASS (code) | locks, backoff, catalog verify |
| Historical data audit/migration | PARTIAL | 413 orphan rows, 69 Apiko rows pending backup/preview |
| Apiko runtime cleanup | PASS | runtime code removed |
| Full test suite | PASS | `make test` exit 0 |
| Real supplier calls/billing samples | PARTIAL/BLOCKED | two real consume logs reconciled to their snapshots; supplier invoice export still missing |
| Database/bill/price audit consistency | PASS (pricing schema) | SQLite/MySQL 8.4.13/PostgreSQL 16.16 migration, identity and dialect tests PASS |
| Frontend gate | PARTIAL | typecheck/lint/unit/build PASS; authenticated browser visual BLOCKED by email-code login |

## Not allowed

Do not mark `FULLY_VERIFIED`, `FULLY_RECONCILED` or `PRODUCTION_READY` while any
gate above is PARTIAL/BLOCKED.

## Required before release

1. Authorized supplier invoice exports for every enabled provider.
2. Backup + preview + approval for orphan/Apiko historical data.
3. Decimal/FX migration plan or explicit accepted risk.
4. Runtime image-task usage-fact verification.
5. Full application startup matrix on the release candidate (the pricing schema matrix already passes on all three databases).
6. Real request closure for token, image, video task and B/C group pricing.
7. Provider-label normalization for legacy type-60 channels.