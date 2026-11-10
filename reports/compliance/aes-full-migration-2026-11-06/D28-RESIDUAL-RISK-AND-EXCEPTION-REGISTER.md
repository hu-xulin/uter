# D28 — Residual Risk and Exception Register

## Evidence record (§14.3)

| Field | Value |
|---|---|
| Evidence ID | `D28` |
| Related requirement | §13.4 / §16.4 / §18 |
| Related finding | D10 gap register / D28 residual risk register |
| Repository revision | Uter `424dfa2c55c534bf110fa5871420fe3fd679d307` / AES `4344979777433fbcdbe23ef2aa0111fe2e8a52e7` |
| Source system | `scripts/quality/aes-governance-reports.py` + on-disk gate evidence |
| Execution environment | local non-production; Python 3.13.12; Go go version go1.27.3 darwin/amd64; Node v22.22.2; Bun 1.4.2 |
| Collection time | 2026-11-08T18:42:15.299631+00:00 |
| Collector | WorkBuddy (Tencent Hunyuan Hy) |
| Integrity | SHA-256 of source evidence is recorded in D25 (Evidence Index) |
| Storage reference | `/Users/lincolnhu/uter/reports/compliance/aes-full-migration-2026-11-06/evidence` |
| Access restrictions | local repository evidence; no credentials or production data |
| Conformance status (§16.2) | **NOT ASSESSED** |

## Content

**No `APPROVED_EXCEPTION` records exist.** All unmet requirements remain open; no risk-owner acceptance has been granted.

| Item | Status | Detail |
|---|---|---|
| L4_GLOBAL_CONFORMANCE_GATE | BLOCKED | 4/16 conditions NOT_MET |
| Domain acceptance | BLOCKED | 0/14 PASS; 42 unverified items |
| Test matrix | PASS | 0 FAIL: none; 0 SKIP |
| Independent assessment | COMPLETED | conformance claim supported: False |
| Manual-acceptance evidence | DISCLOSED | collector PASS 14 / FAIL 0 / NOT_RUN 0; integrity `PASS`; decision `PENDING_ITEM_BY_ITEM_REVIEW`, signed items 0/42 |
| gitleaks finding | OPEN / NOT WAIVED | one `generic-api-key` hit on an OpenAPI commit SHA in an audit doc; candidate false positive, see `evidence/manual-acceptance/MA-06-finding.json` |
| Non-PASS local evidence | DISCLOSED / NOT WAIVED | none; details in `evidence/manual-acceptance/findings.json` |
| Accessibility toolchain | NOT_RUN / TOOL_UNAVAILABLE | axe absent from `web/node_modules`; keyboard/axe audits remain OPEN (MA-12: PASS (exit=0)) |
| Build environment guard (L2-07) | DISCLOSED / RESOLVED / FINAL MATRIX PASS | first final matrix L2-07 FAIL from host safe-delete overwrite guard (exit 1, 463s); unchanged command PASS (exit 0, 17s) on clean dist; runner adds a documented mid-matrix `mv web/dist` hygiene step; see `L2-07-environment-finding.json` |
| Docs static export preparation (L2-01) | DISCLOSED / RESOLVED / FINAL MATRIX PASS | third full matrix L2-01 FAIL (exit 1, 27s) because `web/dist` held only `index.html` + `docs-content/_next`, which compiles but fails `main_docs_test.go`; complete docs static export restored via the project's own postbuild script, forced uncached root Go test exit 0, post-L2-07 restoration added; third-run FAIL aggregate preserved; see `L2-01-environment-finding.json`, `matrix-third-run.tsv`, `test-matrix-third-run.json` |
| Acceptance authority | RECORDED / NOT ACCEPTED | Acceptance authority **胡旭林（项目所有者 / Acceptance Authority）** (`USER_EXPLICIT_DESIGNATION`, recorded 2026-11-07T01:33:20Z). Decision: `PENDING_ITEM_BY_ITEM_REVIEW`; sign-off granted: **false**. |
| Exceptions | NONE | §13.4 requires authority, justification, compensating controls, validity and reassessment conditions |
| CI policy gap | OPEN / DECIDED | 14-domain/L4 evaluator and D01-D28 generator are archived locally, not enforced as CI pass/fail steps (see decision below) |

### Non-PASS evidence root causes (§14.3 / §16.4)

| ID | Status | Diagnosis and disposition |
|---|---|---|
| — | — | no analyst finding record |

No allowlist was modified, no assertion relaxed, no status rewritten and no finding waived. `MA-11` is a real `FAIL` from an Electron runtime download timeout; it is neither relabelled `TIMEOUT` nor treated as a successful build. `MA-12` is `NOT_RUN` for a missing axe toolchain, never `PASS`.

Open L4 conditions:

- `L4-05` 14 L3_DOMAIN_ACCEPTANCE_GATE results all PASS (§8.2/§8.3) — 0/14 PASS; NOT_RUN never counted as PASS
- `L4-10` all applicable requirements evaluated (D05/D08/D09, §16.4) — material applicable requirements remain unassessed
- `L4-11` approved exclusions, open findings and residual risks reviewed (D10/D11/D28, §16.4) — no human risk-owner acceptance: owner decision O-11 = 补齐 (remediate), not 接受残留风险; approved_exceptions=0; open_findings=3
- `L4-13` evidence sufficiency confirmed (D25 / §14.1-14.4) — open evidence gaps: integrity=PASS, verified_items=0/42; MA-12 axe is now a real executed audit (not a toolchain probe); keyboard / three-database / human sign-off remain OPEN

### 14-domain manual-acceptance evidence (§14.3 / §16.3)

Acceptance authority **胡旭林（项目所有者 / Acceptance Authority）** (`USER_EXPLICIT_DESIGNATION`, recorded 2026-11-07T01:33:20Z). Decision: `PENDING_ITEM_BY_ITEM_REVIEW`; sign-off granted: **false**. decision `PENDING_ITEM_BY_ITEM_REVIEW`, signed items 0/42.

Collector run `RUN-20261108T182747Z` (state `COMPLETED`, integrity `PASS`, trusted=True). Executed 14 local checks: PASS 14, FAIL 0, NOT_RUN 0, TIMEOUT 0.

| ID | Check | Status | Exit | Duration | Log SHA-256 (prefix) |
|---|---|---|---|---|---|
| `MA-01` | visual regression baseline (local headless Chrome) | PASS | 0 | 5.452s | `732167023122c6b4…` |
| `MA-02` | govulncheck root module | PASS | 0 | 21.444s | `b5ae54ddcfa4cb39…` |
| `MA-03` | govulncheck tokenkit module | PASS | 0 | 9.129s | `3016e51e4eac0d42…` |
| `MA-04` | govulncheck relaykit module | PASS | 0 | 8.703s | `3016e51e4eac0d42…` |
| `MA-05` | govulncheck tokenkit/tokenkit module | PASS | 0 | 9.12s | `3016e51e4eac0d42…` |
| `MA-06` | gitleaks secret scan on tracked HEAD tree | PASS | 0 | 13.756s | `044edcc1aa657cb6…` |
| `MA-07` | forbidden tracked file check (.env / *.db / *.sqlite3) | PASS | 0 | 0.047s | `f0a74123d3251e18…` |
| `MA-08` | payment idempotency + concurrency tests with -race | PASS | 0 | 11.203s | `5968d50bc2f2c980…` |
| `MA-09` | unused-code / duplication signal (knip) | PASS | 0 | 4.645s | `daa78c62defd32cf…` |
| `MA-10` | docs-web build | PASS | 0 | 27.641s | `ae623332a54cbe99…` |
| `MA-11` | electron build | PASS | 0 | 27.297s | `2af02d02e5953434…` |
| `MA-12` | axe accessibility audit (WCAG 2.2 / WAI-ARIA, real public-page suite) | PASS | 0 | 96.104s | `48127aa60eac8069…` |
| `MA-13` | Go root-module coverage profile + coverage gate | PASS | 0 | 104.017s | `85c197d00eb7fce3…` |
| `MA-14` | AI spec / documentation reference integrity | PASS | 0 | 0.759s | `7edaad7a486df586…` |

Local execution evidence is **not** human acceptance. All 42 `M*` items remain `NOT_VERIFIED` until the recorded authority signs them individually. `NOT_RUN` / `TIMEOUT` / `FAIL` are never reported as `PASS`.

### Baseline preservation and WIP reconciliation (§6.3)

The four prior failing matrix rows came from pre-existing user WIP / format debt (billing-expression `duration` field, gofmt, `format:check`, `build:check`). After the owner asked to reconcile them, they were fixed with minimal, semantic-preserving edits; before/after SHA-256 snapshots, formatter logs and the `build:check` exit code are archived under `evidence/wip-remediation/`. Nothing was waived, no assertion was relaxed, and no user change was reverted. Working-tree changes remain unstaged and unmixed with this governance execution.

The runtime W1 anti-circumvention check initially returned FAIL after that reconciliation: formatter-normalised `web/` files became newly visible in `git status` but were not in the task's declared scope. The scope was corrected by enumerating the **exact 24 authorised paths individually** (no blanket `web/` prefix) together with an explicit `_WIP_REMEDIATION_SCOPE_EXTENSION` declaration citing the owner's instruction; `preflight` and `workspace` were then re-executed and W1–W6 all PASS. The W1 rule itself was not changed or weakened — an undeclared path still fails closed.

### Acceptance authority (§16.4 / §18)

Acceptance authority **胡旭林（项目所有者 / Acceptance Authority）** (`USER_EXPLICIT_DESIGNATION`, recorded 2026-11-07T01:33:20Z). Decision: `PENDING_ITEM_BY_ITEM_REVIEW`; sign-off granted: **false**. decision `PENDING_ITEM_BY_ITEM_REVIEW`, signed items 0/42. The authority was explicitly designated by the user in-session; the user chose "等我逐项复核后决定", so **no item was signed**. L4-15 records only that the authority exists — it is not an acceptance decision and does not unblock L4.

### CI wiring decision (§8.2 / §8.3 / §16.4)

CI enforces the deterministic fail-closed gates: AES pin, integration contract, two-repository separation, P09/P10 boundary, their positive/negative fixtures, and P08 over-privilege runtime denials. The 14-domain/L4 evaluator and the D01-D28 generator are intentionally **not** wired as required green CI steps: in this baseline `L4_GLOBAL_CONFORMANCE_GATE` is honestly `BLOCKED`, so wiring it as a mandatory passing step would either keep CI permanently red or require suppressing a non-zero exit, which §8.3 forbids. The new `L1-18` manual-acceptance negative-fixture test is likewise local: it mirrors the archived evidence tree into a temp directory, which a clean CI checkout does not have. Its outputs are archived as local evidence; changing CI policy requires an authorised acceptance decision after the open conditions are closed.

Full risk list: D11. Findings: D10 / D26. Recovery conditions: complete the named verification activities, obtain independent review, have the recorded acceptance authority review and sign the 42 items individually, then re-run all gates. Until then delivery actions (commit / push / PR), deployment and production changes remain blocked.

---

This deliverable is derived from recorded evidence. A document's existence does not by itself prove control operation or control effectiveness (§16.1). Internal assessment is not external certification (§16.5).
