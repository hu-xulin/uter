# UTER Pricing Sync Standard

## Lifecycle

1. Fetch the complete upstream catalog.
2. Validate completeness (empty list, pagination shortfall, malformed payload).
3. Discover added/removed/renamed models.
4. Fetch official price, channel quote, group/discount rules.
5. Compute automatic sale price.
6. Compare with the previous price and version.
7. Create a review entry above the configured threshold.
8. Apply the scheduled rule only when allowed.
9. Write atomically, invalidate caches, record history/status.
10. Auto-verify rules and catalog completeness.

## Safety requirements

- Cross-instance database lock `channel_price_sync:<id>`.
- Idempotent upsert keyed by the full pricing identity.
- One transaction for a record set.
- Exponential backoff on failure.
- Keep the last good snapshot on failure.
- Do not publish an empty/partial catalog.
- Remove models only through lifecycle thresholds, never because one fetch
  failed.
- Cache invalidation after writes.
- Audit log and bounded history (`GenericUpstreamPriceHistory`,
  UterRoute/Bailian provider logs).
- Review entries capture the price version; approval revalidates it.

## Schedule rules

- `basis`: official / channel / current.
- `mode`: discount / markup / multiply / add / fixed / none.
- `review_mode`: auto / manual.
- `threshold_percent`: abnormal-change isolation.
- `apply_on_sync`: whether to apply the rule after a clean sync.

Changes above the threshold are never applied in the same run.

## Model lifecycle

`ACTIVE` → `UPDATED`/`DEPRECATED`; missing catalog entries increment
`missing_sync_count`, then `NOT_FOUND`/`DISABLED`. Operator-priced models are
retained as ACTIVE even when absent from the public catalog.

## Historical data

Orphan pricing rows and retired-provider rows are audit-visible. Cleanup
requires a backup, preview and operator approval; it is not automatic.