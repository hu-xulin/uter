# UTER Pricing Architecture

Status: implemented, partially verified. Baseline code audit: `3c09cd030`.

## Layers

1. **Official price** — vendor list price from the provider catalog.
2. **Channel quote** — the price this specific upstream account/group pays.
3. **Purchase contract** — operator-confirmed per-dimension cost.
4. **Uter sale price** — operator/automatic selling price, never overwritten by
   upstream sync.
5. **Runtime billing** — one frozen price contract per request.

The layers are stored independently in `channel_model_pricing`:

- `official_pricing` / `normalized_pricing`: provider raw + normalized quote.
- `purchase_pricing`: contract cost, full dimensions.
- `internal_pricing`: Uter sale price.
- `pricing_version`: hash of the row contract.
- `billing_price_snapshots`: immutable per-request snapshot.

## Components

| Component | Responsibility |
|---|---|
| `service/upstream_provider.go` | Provider adapter registry and normalized model IDs |
| `model/channel_model_pricing.go` | Identity, resolution, purchase cost, source protection |
| `controller/channel_model_pricing.go` | Quote view, manual/batch/import pricing |
| `relay/helper/price.go` | Token and per-call billing |
| `relay/relay_task.go` | Task/per-second billing and usage facts |
| `service/channel_pricing_audit.go` | Five-layer parity and catalog comparison |
| `service/channel_pricing_autoverify.go` | Post-sync verification and catalog check |
| `service/channel_pricing_review.go` | Price-change review queue |
| `service/channel_pricing_lock.go` | Cross-instance sync lock |

## Identity

A price is identified by:

`channel_id + provider + region + deployment_id + model_name`

A request that cannot be matched to a unique row must fail. A channel that
already has scoped pricing must not fall back to global pricing for a missing
model.

## Runtime rule

Billing resolves the channel-scoped contract once, freezes it into
`RelayInfo`/`BillingPriceSnapshot`, and uses that same contract for pre-consume,
settlement and refund. Group ratio is applied after the channel price and never
rewrites the stored channel contract.

## Known boundaries

- Decimal migration is not complete; quota conversion uses bounded float math.
- Real supplier invoice reconciliation is blocked without authorized exports.
- Providers without an authorized price API remain manual-only.