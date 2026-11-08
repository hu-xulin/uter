# D28 — Residual Risk and Exception Register

## Evidence record (§14.3)

| Field | Value |
|---|---|
| Evidence ID | `D28` |
| Related requirement | §13.4 / §16.4 / §18 |
| Related finding | D10 gap register / D28 residual risk register |
| Repository revision | Uter `ec6501adceb008d46140a7e5ab6508eb78006731` / UAES `ff7cf878d43061f263e301cad09ff19d03e906c4` |
| Source system | `scripts/quality/uaes-governance-reports.py` + on-disk gate evidence |
| Execution environment | local non-production; Python 3.13.12; Go go version go1.27.3 darwin/amd64; Node v22.22.2; Bun 1.4.2 |
| Collection time | 2026-11-06T11:04:20.850321+00:00 |
| Collector | WorkBuddy (Tencent Hunyuan Hy) |
| Integrity | SHA-256 of source evidence is recorded in D25 (Evidence Index) |
| Storage reference | `/Users/lincolnhu/uter/reports/compliance/uaes-full-migration-2026-11-06/evidence` |
| Access restrictions | local repository evidence; no credentials or production data |
| Conformance status (§16.2) | **NOT ASSESSED** |

## Content

**No `APPROVED_EXCEPTION` records exist.** All unmet requirements remain open; no risk-owner acceptance has been granted.

| Item | Status | Detail |
|---|---|---|
| L4_GLOBAL_CONFORMANCE_GATE | BLOCKED | 7/16 conditions NOT_MET |
| Domain acceptance | BLOCKED | 0/14 PASS; 42 unverified items |
| Test matrix | FAIL | 3 FAIL: `L1-11`, `L1-16`, `L1-18`; 0 SKIP |
| Independent assessment | COMPLETED | conformance claim supported: False |
| Manual-acceptance evidence | DISCLOSED | collector PASS 14 / FAIL 0 / NOT_RUN 0; integrity `PASS`; decision `PENDING_ITEM_BY_ITEM_REVIEW`, signed items 0/42 |
| gitleaks finding | OPEN / NOT WAIVED | one `generic-api-key` hit on an OpenAPI commit SHA in an audit doc; candidate false positive, see `evidence/manual-acceptance/MA-06-finding.json` |
| Non-PASS local evidence | DISCLOSED / NOT WAIVED | none; details in `evidence/manual-acceptance/findings.json` |
| Accessibility toolchain | NOT_RUN / TOOL_UNAVAILABLE | axe absent from `web/node_modules`; keyboard/axe audits remain OPEN (MA-12: PASS (exit=0)) |
| Build environment guard (L2-07) | DISCLOSED / RESOLVED / FINAL MATRIX PASS | first final matrix L2-07 FAIL from host safe-delete overwrite guard (exit 1, 463s); unchanged command PASS (exit 0, 17s) on clean dist; runner adds a documented mid-matrix `mv web/dist` hygiene step; see `L2-07-environment-finding.json` |
| Docs static export preparation (L2-01) | DISCLOSED / RESOLVED / FINAL MATRIX PASS | third full matrix L2-01 FAIL (exit 1, 27s) because `web/dist` held only `index.html` + `docs-content/_next`, which compiles but fails `main_docs_test.go`; complete docs static export restored via the project's own postbuild script, forced uncached root Go test exit 0, post-L2-07 restoration added; third-run FAIL aggregate preserved; see `L2-01-environment-finding.json`, `matrix-third-run.tsv`, `test-matrix-third-run.json` |
| Acceptance authority | RECORDED / NOT ACCEPTED | Acceptance authority **项目 Owner / Acceptance Authority（用户本人）** (`USER_EXPLICIT_DESIGNATION`, recorded 2026-11-06T06:43:53Z). Decision: `PENDING_ITEM_BY_ITEM_REVIEW`; sign-off granted: **false**. |
| Exceptions | NONE | §13.4 requires authority, justification, compensating controls, validity and reassessment conditions |
| CI policy gap | OPEN / DECIDED | 14-domain/L4 evaluator and D01-D28 generator are archived locally, not enforced as CI pass/fail steps (see decision below) |

### Non-PASS evidence root causes (§14.3 / §16.4)

| ID | Status | Diagnosis and disposition |
|---|---|---|
| — | — | no analyst finding record |

No allowlist was modified, no assertion relaxed, no status rewritten and no finding waived. `MA-11` is a real `FAIL` from an Electron runtime download timeout; it is neither relabelled `TIMEOUT` nor treated as a successful build. `MA-12` is `NOT_RUN` for a missing axe toolchain, never `PASS`.

Open L4 conditions:

- `L4-05` 14 L3_DOMAIN_ACCEPTANCE_GATE results all PASS (§8.2/§8.3) — 0/14 PASS; NOT_RUN never counted as PASS
- `L4-06` L1_CHANGE_GATE PASS — 3 L1 failure(s)
- `L4-09` WorkBuddy runtime behaviour validated incl. over-privilege denial (§18 step 14) — preflight/selftest/verify/workspace all required
- `L4-10` all applicable requirements evaluated (D05/D08/D09, §16.4) — material applicable requirements remain unassessed
- `L4-11` approved exclusions, open findings and residual risks reviewed (D10/D11/D28, §16.4) — no human risk-owner acceptance; exceptions require APPROVED_EXCEPTION with authority and review date (§13.4)
- `L4-12` control effectiveness verified (§16.1 dimension 4) — control operation vs effectiveness not independently evaluated
- `L4-13` evidence sufficiency confirmed (D25 / §14.1-14.4) — open evidence gaps: integrity=PASS, verified_items=0/42; axe / keyboard / three-database / human sign-off remain OPEN

### 14-domain manual-acceptance evidence (§14.3 / §16.3)

Acceptance authority **项目 Owner / Acceptance Authority（用户本人）** (`USER_EXPLICIT_DESIGNATION`, recorded 2026-11-06T06:43:53Z). Decision: `PENDING_ITEM_BY_ITEM_REVIEW`; sign-off granted: **false**. decision `PENDING_ITEM_BY_ITEM_REVIEW`, signed items 0/42.

Collector run `RUN-20261106T105821Z` (state `COMPLETED`, integrity `PASS`, trusted=True). Executed 14 local checks: PASS 14, FAIL 0, NOT_RUN 0, TIMEOUT 0.

| ID | Check | Status | Exit | Duration | Log SHA-256 (prefix) |
|---|---|---|---|---|---|
| `MA-01` | visual regression baseline (local headless Chrome) | PASS | 0 | 8.974s | `732167023122c6b4…` |
| `MA-02` | govulncheck root module | PASS | 0 | 27.43s | `b5ae54ddcfa4cb39…` |
| `MA-03` | govulncheck tokenkit module | PASS | 0 | 12.212s | `3016e51e4eac0d42…` |
| `MA-04` | govulncheck relaykit module | PASS | 0 | 10.107s | `3016e51e4eac0d42…` |
| `MA-05` | govulncheck tokenkit/tokenkit module | PASS | 0 | 11.404s | `3016e51e4eac0d42…` |
| `MA-06` | gitleaks secret scan on tracked HEAD tree | PASS | 0 | 13.597s | `4d2211236776e428…` |
| `MA-07` | forbidden tracked file check (.env / *.db / *.sqlite3) | PASS | 0 | 0.046s | `f0a74123d3251e18…` |
| `MA-08` | payment idempotency + concurrency tests with -race | PASS | 0 | 15.808s | `2f86471de1521588…` |
| `MA-09` | unused-code / duplication signal (knip) | PASS | 0 | 7.966s | `daa78c62defd32cf…` |
| `MA-10` | docs-web build | PASS | 0 | 49.095s | `4cc65b3f0cf46447…` |
| `MA-11` | electron build | PASS | 0 | 24.539s | `3a21eb1e5aeb7717…` |
| `MA-12` | axe accessibility toolchain availability probe | PASS | 0 | 0.015s | `127f24bd7fc76aab…` |
| `MA-13` | Go root-module coverage profile + coverage gate | PASS | 0 | 122.073s | `1736a555392427a7…` |
| `MA-14` | AI spec / documentation reference integrity | PASS | 0 | 0.7s | `7edaad7a486df586…` |

Local execution evidence is **not** human acceptance. All 42 `M*` items remain `NOT_VERIFIED` until the recorded authority signs them individually. `NOT_RUN` / `TIMEOUT` / `FAIL` are never reported as `PASS`.

### Baseline preservation and WIP reconciliation (§6.3)

The four prior failing matrix rows came from pre-existing user WIP / format debt (billing-expression `duration` field, gofmt, `format:check`, `build:check`). After the owner asked to reconcile them, they were fixed with minimal, semantic-preserving edits; before/after SHA-256 snapshots, formatter logs and the `build:check` exit code are archived under `evidence/wip-remediation/`. Nothing was waived, no assertion was relaxed, and no user change was reverted. Working-tree changes remain unstaged and unmixed with this governance execution.

The runtime W1 anti-circumvention check initially returned FAIL after that reconciliation: formatter-normalised `web/` files became newly visible in `git status` but were not in the task's declared scope. The scope was corrected by enumerating the **exact 24 authorised paths individually** (no blanket `web/` prefix) together with an explicit `_WIP_REMEDIATION_SCOPE_EXTENSION` declaration citing the owner's instruction; `preflight` and `workspace` were then re-executed and W1–W6 all PASS. The W1 rule itself was not changed or weakened — an undeclared path still fails closed.

### Acceptance authority (§16.4 / §18)

Acceptance authority **项目 Owner / Acceptance Authority（用户本人）** (`USER_EXPLICIT_DESIGNATION`, recorded 2026-11-06T06:43:53Z). Decision: `PENDING_ITEM_BY_ITEM_REVIEW`; sign-off granted: **false**. decision `PENDING_ITEM_BY_ITEM_REVIEW`, signed items 0/42. The authority was explicitly designated by the user in-session; the user chose "等我逐项复核后决定", so **no item was signed**. L4-15 records only that the authority exists — it is not an acceptance decision and does not unblock L4.

### CI wiring decision (§8.2 / §8.3 / §16.4)

CI enforces the deterministic fail-closed gates: UAES pin, integration contract, two-repository separation, P09/P10 boundary, their positive/negative fixtures, and P08 over-privilege runtime denials. The 14-domain/L4 evaluator and the D01-D28 generator are intentionally **not** wired as required green CI steps: in this baseline `L4_GLOBAL_CONFORMANCE_GATE` is honestly `BLOCKED`, so wiring it as a mandatory passing step would either keep CI permanently red or require suppressing a non-zero exit, which §8.3 forbids. The new `L1-18` manual-acceptance negative-fixture test is likewise local: it mirrors the archived evidence tree into a temp directory, which a clean CI checkout does not have. Its outputs are archived as local evidence; changing CI policy requires an authorised acceptance decision after the open conditions are closed.

Full risk list: D11. Findings: D10 / D26. Recovery conditions: complete the named verification activities, obtain independent review, have the recorded acceptance authority review and sign the 42 items individually, then re-run all gates. Until then delivery actions (commit / push / PR), deployment and production changes remain blocked.

---

This deliverable is derived from recorded evidence. A document's existence does not by itself prove control operation or control effectiveness (§16.1). Internal assessment is not external certification (§16.5).
