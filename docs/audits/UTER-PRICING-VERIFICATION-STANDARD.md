# UTER Pricing Verification Standard

## Five layers

| Layer | Question | Evidence |
|---|---|---|
| A. Catalog | Does Uter have every upstream model? | `MODEL_MISSING`, `upstream_model_count` |
| B. Official price | Is the official amount, unit, currency, region, tier traceable? | `normalized_pricing`, `price_kind` |
| C. Purchase cost | Is the actual channel/contract cost confirmed? | `purchase_pricing`, `purchase_verified` |
| D. Sale price | Was Uter's rule applied? | `internal_pricing`, pricing version |
| E. Billing | Does the request charge match the frozen snapshot? | `billing_price_snapshots`, consume logs |

## Parity statuses

`FULLY_MATCHED`, `MODEL_MISMATCH`, `MODEL_MISSING`, `PRICE_MISMATCH`,
`RULE_MISMATCH`, `UNSUPPORTED`, `STALE`, `SYNC_FAILED`, `MANUAL_REVIEW`.

`has_official` means an absolute official price, not a channel quote.
`has_official_estimate` means ratio-derived and is never reported as fully
matched without a channel quote.

## Freshness

48 hours, shared by the audit and the channel pricing screen.

## Automatic checks

- After every successful sync: rule reconciliation + full catalog comparison.
- Persisted keys: `ChannelPricingAutoVerify:<id>`,
  `ChannelPricingCatalogVerify:<id>`.
- Review entries are version-checked before approval.

## Live audit commands

```bash
PRICING_AUDIT=1 go test -tags pricing_audit_live ./service -run TestAuditXXAPILive -v
PRICING_AUDIT=1 go test -tags pricing_audit_live ./service -run 'TestAuditDreamRouterLive|TestAuditBailianLive' -v
```

Live results are evidence for the specific snapshot, not a permanent guarantee.

## Orphan data

`GET /api/channel/pricing_audit` returns `orphans` grouped by deleted channel.
Orphans are not billable and are not deleted automatically.