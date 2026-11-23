# UTER Pricing Engine Standard

## Resolution order

1. Channel-scoped `internal_pricing` for the exact request identity.
2. If the channel has scoped rows but this model is missing: **reject**.
3. If the channel has no scoped rows: legacy global/upstream path.

Official-only or needs-review rows are never billable.

## Sale price shapes

- `per_1m_token`: input/output/cache/cache-write, optional multi-modality.
- `per_call`: fixed request price.
- `per_second` / `per_minute`: task billing.
- `tiered_table`: context bands.
- `tiered_expr`: expression engine.

Tiered expressions are preserved verbatim; unparsable expressions remain
review-only.

## Task billing

Task expressions return USD. Pre-consume and settlement use the same expression
and the same usage facts. Missing required usage facts fail the charge instead
of guessing a value.

## Default sale price

When no operator/batch rule exists, an automatically derived Uter sale price is
the upstream channel quote × **1.10**. The markup is applied to flat monetary
dimensions and to executable expressions (fixed charges are scaled in place so
task billing still accepts them). Operator, batch and approved prices are never
scaled or overwritten. If the provider supplies only a ratio-derived or
historical reference but also a concrete amount, that amount may seed this
default sale price; the price-kind marker remains `RATIO_ONLY` or
`HISTORICAL_SNAPSHOT` so the derivation stays visible.

## Group and customer pricing

The customer/group ratio is applied after the channel sale contract. It does
not modify the stored channel price and is applied consistently to both
pre-consume and settlement.

## Purchase vs sale

- Sale price: `internal_pricing`.
- Purchase cost: `purchase_pricing` contract, full dimensions.
- Public quote fallback: estimate only, always `verified=false`.
- Supplier invoice reconciliation compares actual cost, not the public quote.

## Auto-pricing

- Upstream sync may write automatic sale prices only when the row has no
  operator price or the previous price was itself auto-derived.
- Source prefixes recognized as automatic: `uterroute-`, `bailian-`,
  `newapi-`, `newapi:`, `generic-`, `generic:`, `Uter.api-`, `apiko-`.
- Operator, batch and approved prices are never overwritten.

## Failure behavior

- Identity ambiguity or missing scoped price: HTTP 400 with a price error.
- Invalid/unsupported expression: review-only, not billable.
- Quota saturation: logged and audited via `quota_saturation`; never silently
  wraps negative.