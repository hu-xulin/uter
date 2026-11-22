# UTER Pricing Execution Report

- Audit baseline: `3c09cd030d6eed331b191b23b35993f8f7d6e37b`
- Report date: 2026-11-23
- Overall status: **PARTIALLY_VERIFIED / NOT PRODUCTION READY**

## Commits in this remediation batch

| Commit | Change |
|---|---|
| `cb87d0d93` | Isolate channel price fallback; XXAPI auth; parity source split |
| `3b7015420` | Full upstream catalog parity and XXAPI live verification |
| `39fc636a9` | Live audit uses real usage keys |
| `5c59113c5` | Reject incomplete Bailian pagination |
| `40e6258d5` | Cross-instance channel price-sync lock |
| `f532239dd` | DreamRouter manual sync reuses the channel lock |
| `032bcfa83` | Generic/XXAPI scheduled review and pricing rules |
| `16d20b426` | Review entries carry pricing version |
| `bb18b1501` | Post-sync catalog completeness verification |
| `8035ddf94` | Parity counts unverified purchase cost |
| `c827d5d71` | Generic upstream price history |
| `ef608ed81` | Orphan/Apiko historical data audit |

## Problems closed

1. Automatic source recognition divergence (`generic:`/`xxapi-`/legacy `apiko-`).
2. Official vs channel vs estimate conflation in parity.
3. XXAPI price sync missing API key; XXAPI absent from adapter registry.
4. Silent global fallback for channels that already have scoped pricing.
5. Missing upstream models invisible to parity.
6. Generic/XXAPI scheduled sync ignored review/threshold/rules.
7. No cross-instance lock for generic/XXAPI/DreamRouter manual sync.
8. Incomplete Bailian catalogs accepted.
9. Review approval could use a stale price state (version now checked).
10. Orphan and Apiko historical rows invisible.

## Verification evidence

| Command | Result |
|---|---|
| `go build ./...` | exit 0 |
| `make test` | exit 0 |
| `go test ./model ./service ./relay/helper ./relay -count=1` | passed |
| `PRICING_AUDIT=1 go test -tags pricing_audit_live ./service -run TestAuditXXAPILive` | 51 models, 51 executable |
| `PRICING_AUDIT=1 go test -tags pricing_audit_live ./service -run TestAuditDreamRouterLive` | 86 records, 54 executable, 32 review, 0 failures |
| `PRICING_AUDIT=1 go test -tags pricing_audit_live ./service -run TestAuditBailianLive` | 275 catalog, 134 records, 105 executable |
| `bun run typecheck` / `lint` / `format:check` | passed at last run |
| `./scripts/verify-all.sh --quick` | 9 PASS / 0 FAIL / 4 SKIP at last run |

## Model/price counts (live snapshot)

- XXAPI: 51 models, 51 records, 51 executable expressions.
- DreamRouter: 86 records, 54 executable, 32 intentional review.
- Bailian: 275 catalog models, 134 records, 105 internal prices.

## Three-channel live validation (2026-11-23)

Definition used: official price = model vendor's published list price; channel
price = the selected upstream channel's published price after its group
discount; Uter price = channel price × 1.10 unless an operator price exists.

| Channel | Rows | Configured / review | Evidence |
|---|---:|---:|---|
| DreamRouter `32` (优特渠道) | 86 | 86 / 0 | `claude-fable-5`: expression `p*10+c*50+cr*1+cc*12.5+cc1h*20`, group `default` 0.6 → channel `6 / 30`, cache `0.6`, cache write `7.5`; Uter `6.6 / 33`, cache `0.66`, cache write `8.25` |
| Alibaba Bailian `34` | 134 | 122 / 12 | 33 auto `bailian-channel` prices plus 89 operator `batch` prices; auto flat and tiered prices all include the 1.10 markup |
| Alibaba Bailian `62` (new draft channel) | 3 | 1 / 2 | `MiniMax-M2.5`: channel `0.31390134529147984 / 1.2556053811659194`, Uter `0.34529147982062786 / 1.3811659192825114` (exact ×1.10); `qwen-plus` / `qwen-flash` stay review-only because the catalogue publishes both implicit cache-hit and explicit cache-read prices |
| XXAPI `54`–`60` | 68 | 68 / 0 | All executable expressions refreshed to `(base × 1.10) × group`; `54` (`Claude-kiro` 0.9): channel `1.8 / 9`, Uter `(base × 1.10) × 0.9` = `1.98 / 9.9` |

Commands used:

```bash
go run /tmp/uter_xxapi_refresh.go      # refresh XXAPI with the application sync path
go run /tmp/uter_dreamrouter_refresh.go # refresh DreamRouter channel 32
bunx vitest run src/features/channels/components/__tests__/channel-pricing-panel.test.tsx
make test
./scripts/verify-all.sh --quick
```

Results: `make test` exit 0; quick gates 9 PASS / 0 FAIL / 4 SKIP; the frontend
pricing panel test 5/5 passed. A workspace-enabled `go test ./controller`
selection still fails `TestManageUserQuotaMiddlewareKeepsOneOperationPerRequest`
because a legacy token is rejected; the same package passes under the project
gate (`GOWORK=off`, as used by `make test`). It is unrelated to pricing.

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
5. Full SQLite/MySQL/PostgreSQL release-candidate matrix.
6. Real token/image/video/B-C group request closure.

## Final status

The code defects in this batch are implemented and covered by tests. The full
release gate is not met. Use `PARTIALLY_VERIFIED`, not `FULLY_OPERATIONAL`.