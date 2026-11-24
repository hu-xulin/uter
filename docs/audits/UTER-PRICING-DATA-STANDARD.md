# UTER Pricing Data Standard

## Identity

Every price row is scoped by:

`channel_id`, `provider`, `region`, `deployment_id`, `model_name`

The same model on two channels, regions, deployments, accounts or billing
groups is never one price.

## Stored layers

| Column | Meaning |
|---|---|
| `official_pricing` | Verbatim provider payload |
| `normalized_pricing` | Unified official/channel quote view |
| `purchase_pricing` | Operator-confirmed contract cost, full dimensions |
| `internal_pricing` | Uter sale price |
| `pricing_source` | Source that produced the row |
| `pricing_version` | Hash of the current price contract |
| `fetched_at` | Fetch time for staleness |
| `lifecycle_status` | ACTIVE/UPDATED/DEPRECATED/DISABLED/NOT_FOUND/SYNC_FAILED |

## Required preserved fields

`provider_id`, `channel_id`, `upstream_model_id`, `model_id`, `region`,
`deployment_id`, `billing_group`, `currency`, `unit`, `billing_mode`,
`pricing_dimensions`, `tier_rules`, `discount_rules`, `source_url`,
`raw_payload`, `fetched_at`, `effective_at`, `expires_at`, `pricing_version`,
`parser_version`, `formula_version`, `verification_status`.

## Rules

1. Official, channel quote, contract and sale price must never overwrite each
   other.
2. A ratio-derived estimate is not an absolute official price. It may seed a
   sale price only when the upstream also supplies the concrete reference
   amount, and the row must keep `RATIO_ONLY`/`HISTORICAL_SNAPSHOT` as its
   price-kind marker.
3. A public quote is not a verified purchase contract.
4. Missing dimensions are omitted, never defaulted to zero.
5. Currency conversion stores the original amount, currency, FX rate, FX source
   and FX timestamp.
6. Per-request billing snapshots are immutable; changing a model price must not
   rewrite history.
7. Orphan rows (channel deleted) are auditable but not billable and are not
   deleted automatically.

## Precision status

Quota conversion is centralized in `common/quota_math.go` with int32 saturation
and audited clamps. Billing ledger, cost-breakdown and snapshot purchase amount
fields now use `model.Money`, a decimal-backed type that stores as an exact
decimal string and serializes as a JSON number; monetary arithmetic uses
`shopspring/decimal` end to end in those paths. TopUp, Subscription, channel
pricing JSON amount fields and expression-engine inputs remain float64, so the
application-wide migration is still open.