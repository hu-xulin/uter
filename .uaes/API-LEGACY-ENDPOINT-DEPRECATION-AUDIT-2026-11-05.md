# Legacy API Deprecation Consumer Audit

**Decision:** Option B selected by the API contract owner on 2026-11-05.  
**Repository:** `hu-xulin/uter`  
**Audited source baseline:** `0bb92103866189842abb6ce89a191ccc745b389c`  
**Target:** remove obsolete OpenAPI declarations for:
- `POST /api/oauth/wechat/bind`
- `GET /api/verify/status`

## 1. Decision and scope

The API owner has confirmed that both legacy operations are obsolete. This audit checks repository-local runtime registrations, frontend API consumers, API tests/documentation, and the available route inventory before removing their OpenAPI declarations.

This is not a claim that no third-party consumer has ever used these paths. The repository does not contain production API access telemetry or a complete external integration registry. The owner decision establishes that these paths are no longer supported contracts; because the current runtime does not register them, removing their stale documentation does not remove a currently implemented handler.

## 2. Consumer inventory

| Surface | Evidence at audited baseline | Finding |
|---|---|---|
| Gin route registration | `router/api-router.go` lines 60–73 and 90–96 | No `/oauth/wechat/bind` or `/verify/status` route. |
| OAuth frontend client | `web/src/features/auth/api.ts` lines 206–258, 260–309 | OAuth uses `POST /api/oauth/state` with an explicit intent; WeChat website-app login uses `/api/oauth/wechat-web/*`. No call to the legacy WeChat bind path. |
| WeChat website-app flow | `router/api-router.go` lines 65–68; `web/src/features/auth/api.ts` lines 260–309 | The dedicated WeChat website-app flow currently declares `intent: login`; it is not represented as an account-binding replacement. No replacement for the old direct WeChat bind operation is claimed. |
| Verification frontend client | `web/src/features/auth/secure-verification/api.ts` lines 52–85, 221–305, 337–380 | Uses `GET /api/verify/methods`, `POST /api/verify`, `POST /api/verify/email_code`, and `GET /api/status`; no call to `/api/verify/status`. |
| Verification runtime | `router/api-router.go` lines 90–96; `controller/secure_verification.go` | Registers methods, verification submission, and email-code operations; no status GET handler. |
| OpenAPI | `docs-dev/openapi/api.json` | Contains exactly the two unmatched legacy declarations; WeChat bind is POST with a JSON `code`, verification status is GET. |
| Published API-reference copies | `docs-web/content/api/{en,zh,fr,ja,ru,vi,zh-TW}/management-oauth.md` and `management-security-verification.md` | All seven locale copies advertise the obsolete operations. The WeChat bind method is inconsistently shown as GET in these pages while OpenAPI says POST. These docs are stale consumers, not runtime clients. |

## 3. Current contract behavior — do not overstate equivalence

- OAuth binding is flow-oriented for providers supported by the generic OAuth flow: create a state/authorization with `intent=bind`, then complete the provider callback. The dedicated WeChat website-app route currently accepts login intent only. The old direct WeChat bind operation has no equivalent current WeChat binding route and is removed as obsolete, not silently mapped to the login flow.
- Verification now uses operation-scoped requirements and proof issuance. `GET /api/verify/methods` returns available verification requirements; `POST /api/verify` performs verification; `GET /api/status` is used by the frontend to build OAuth authorization URLs. None is asserted to be a one-to-one semantic replacement for a historical verification-status resource.

## 4. Change and verification requirements

1. Remove only the two confirmed stale operations from the OpenAPI `paths` object.
2. Remove the obsolete entries from local API-reference pages in all seven published locales.
3. Prevent the docs synchronization generator from reintroducing the two operations from its upstream API-reference source.
4. Add/retain a negative assertion that the deprecated paths are absent from the current OpenAPI contract.
5. Run JSON parsing, OpenAPI structural/compatibility checks, route parity, frontend tests/build, and Uter CI.
6. Keep the route-parity gate blocking until the live run proves that all remaining documented operations map to runtime routes.

## 5. External consumer limitation

No production usage telemetry or complete external-client inventory is available in this repository snapshot. The owner has explicitly confirmed these paths are obsolete. If a separately operated external integration is later found to call either path, it must migrate to the current supported flow; no compatibility handler is being introduced.

## 6. Status

- Owner decision: **OPTION B APPROVED**
- Repository-local runtime consumers: **NONE FOUND**
- Repository-local frontend consumers: **NONE FOUND**
- Published documentation references: **FOUND; cleanup required**
- External consumer telemetry: **NOT AVAILABLE**
- OpenAPI removal: **IN PROGRESS**
- Route parity acceptance: **PENDING CI**
- No runtime handler, authentication behavior, database, production environment, or deployment was changed.


## 7. Implemented repository changes

The owner-approved Option B changes are now committed on the Uter integration PR branch:

- OpenAPI path inventory reduced from 136 paths / 161 operations to **134 paths / 159 operations**. Only the two audited legacy paths were removed. OpenAPI commit: `4aa9c0849049a640aaa27fae11870adc92367b62`.
- Documentation synchronization now filters both removed paths so a future upstream docs sync cannot reintroduce them. Generator commit: `8c1781bccd1e499e5332d8bf4dc956dc0b20f729`.
- Both obsolete sections were removed from the OAuth and security-verification API-reference pages in all seven shipped locales (`en`, `zh`, `fr`, `ja`, `ru`, `vi`, `zh-TW`). The latest docs commit at the time of this audit update is `55b5d29df2f07b9fc49479d99c586a3f173b388c`.
- No runtime Go handler or frontend call site was changed.

The final Uter PR head and CI run must be rechecked after the audit and traceability updates. Do not mark route parity PASS until the Architecture Source Checks workflow runs against the exact final Uter commit and confirms all remaining OpenAPI operations map to runtime routes.


## 8. Documentation-generator regression gate

A regression helper `should_skip_api_path` now owns the retired-path filter. Added `docs-web/scripts/test_sync_upstream_docs.py` with positive assertions for both retired paths and negative assertions for current OAuth/verification paths. Uter CI's frontend job now runs both Python syntax validation and this regression test before frontend checks. The workflow change is part of the current PR branch; its exact-head CI result is pending.


## 9. Final verification — 2026-11-05

- UAES Architecture Source Checks [run 41971060421](https://github.com/hu-xulin/uaes/actions/runs/41971060421): **PASS** at UAES PR #1 head `88b96136d48cad65056918cac72a1ac6017fe139`, with Uter source pinned to `422caafffb7a64370700ddd4859a057911f5f9e0`.
- API compatibility and approval fixtures: **PASS**. Exactly the two approved legacy removals are accepted; unapproved removal and stale approval negative controls remain blocking.
- Live router/OpenAPI parity: **PASS** — 197 documented operations covered by 484 static Gin and built-in plugin routes (450 static Gin + 34 dynamic plugin routes).
- UAES Database Migration Dialect Matrix [run 41971060428](https://github.com/hu-xulin/uaes/actions/runs/41971060428): **PASS** (selected tests only; not full migration recovery certification).
- Uter CI [run 41970513914](https://github.com/hu-xulin/uter/actions/runs/41970513914): **PASS**, all 8 jobs, at Uter source commit `422caafffb7a64370700ddd4859a057911f5f9e0`. This includes the new docs-generator regression step, frontend typecheck/tests/lint/build, backend tests, coverage, dependency scan, race detector, Electron secret persistence, UAES integration, and UEQE review.

These results resolve the two legacy route-parity discrepancies and validate the approved contract cleanup. They do not certify absence of third-party historical consumers, full database rollback/recovery, all UAES standards, or production behavior.
