# UTER Provider Adapter Standard

## Contract

```go
type UpstreamProviderAdapter interface {
    Descriptor() UpstreamProvider
    Fetch(ctx context.Context, cfg UpstreamFetchConfig) (any, error)
}
```

`Fetch` may return a provider-specific payload. Uniformity belongs to the
normalized audit/price layer, not to the raw payload.

## Requirements

1. Each provider implements its own authentication, pagination, parsing and
   error handling.
2. A provider without an authorized price source must be registered as manual
   and must never report a fake sync success.
3. Capabilities declare the real state: `SUPPORTED`, `PARTIAL`, `UNSUPPORTED`,
   `MANUAL_ONLY`, `NEEDS_CONFIGURATION`.
4. Model discovery, official pricing and channel pricing are separate claims.
5. Empty or incomplete catalogs must fail the sync.
6. API keys are passed explicitly through `UpstreamFetchConfig`; they never
   appear in logs, errors or persisted raw payloads.

## Registered providers

| ID | Auth | Catalog source | Normalized model IDs |
|---|---|---|---|
| `uterroute` | API key for models, public pricing | `/api/pricing`, `/v1/models` | yes |
| `alibaba-bailian` | API key | paginated `/api/v1/models` | yes |
| `Uter.api` | channel key | `/api/pricing` | yes |
| `openai`, `anthropic`, `google-gemini`, `microsoft-azure`, `aws-bedrock`, `tencent-hunyuan`, `volcengine` | manual | no authorized price API | manual |

Uter.api's pricing document is public, but the channel key identifies the billing
group and must still be forwarded. A channel without a usable key fails the
sync instead of silently reading an anonymous price.

## Catalog integrity

- Bailian: fetched model count below upstream `total` is an incomplete catalog.
- Generic/Uter.api: empty pricing data is rejected.
- A provider without a catalog adapter returns `catalog_error` in the parity
  report and makes no completeness claim.