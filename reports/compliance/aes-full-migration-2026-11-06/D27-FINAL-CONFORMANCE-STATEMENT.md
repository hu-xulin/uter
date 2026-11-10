# D27 — Final Conformance Statement

## Evidence record (§14.3)

| Field | Value |
|---|---|
| Evidence ID | `D27` |
| Related requirement | §16.2 / §16.4 / §18 step 20 / §19 |
| Related finding | D10 gap register / D28 residual risk register |
| Repository revision | Uter `424dfa2c55c534bf110fa5871420fe3fd679d307` / AES `4344979777433fbcdbe23ef2aa0111fe2e8a52e7` |
| Source system | `scripts/quality/aes-governance-reports.py` + on-disk gate evidence |
| Execution environment | local non-production; Python 3.13.12; Go go version go1.27.3 darwin/amd64; Node v22.22.2; Bun 1.4.2 |
| Collection time | 2026-11-08T18:42:15.299631+00:00 |
| Collector | WorkBuddy (Tencent Hunyuan Hy) |
| Integrity | SHA-256 of source evidence is recorded in D25 (Evidence Index) |
| Storage reference | `/Users/lincolnhu/uter/reports/compliance/aes-full-migration-2026-11-06/evidence` |
| Access restrictions | local repository evidence; no credentials or production data |
| Conformance status (§16.2) | **PARTIALLY CONFORMANT** |

## Content

## Final conformity status: **PARTIALLY CONFORMANT** (§16.2)

L4_GLOBAL_CONFORMANCE_GATE: **BLOCKED** (12/16 mandatory conditions MET).

### Assessed scope

- System boundary: Uter repository (Layer B) at `424dfa2c55c534bf110fa5871420fe3fd679d307` on `main`, pinned AES baseline (Layer A) at `4344979777433fbcdbe23ef2aa0111fe2e8a52e7`, and WorkBuddy/CI assurance (Layer C).
- Standards baseline: `UTER-AES-GOV-001` (Proposed Execution Baseline — Pending Repository and Standards Validation), AES `1.12.1` / `ACTIVE`, and the §2.1 catalogue of 25 external standards/frameworks.
- Applicable requirements: 14 independent domains (AES P00–P12 + UTER P13).

### Results by category (§18 final-report requirement)

| Category | Result |
|---|---|
| Implemented | three-layer/two-repository architecture, UTER P13 registration, separation + P09/P10 gates, 14-domain evaluator, D01–D28 generator, independent assessment |
| Verified | separation gate `PASS`, P09/P10 gate `PASS`, runtime selftest `20/20`, 31/31 matrix commands |
| Accepted | none — Acceptance authority **胡旭林（项目所有者 / Acceptance Authority）** (`USER_EXPLICIT_DESIGNATION`, recorded 2026-11-07T01:33:20Z). Decision: `PENDING_ITEM_BY_ITEM_REVIEW`; sign-off granted: **false**. No item-level acceptance decision has been granted. |
| Not applicable | AES domain gates for UTER-P13 (it is a Uter Layer B extension) |
| Blocked | 4 L4 conditions, 42 domain acceptance items, 0 matrix commands |

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

### Exclusions, evidence limitations and unresolved risks

- No approved exclusions or `APPROVED_EXCEPTION` records were granted.
- Official editions of §2.1 external standards were not verified against publishers.
- axe/keyboard accessibility PASS (exit=0), three-database migration/recovery, DR/incident drills, multi-instance recovery and independent human acceptance remain OPEN.
- Local evidence that FAILED or could not run is disclosed, not waived (derived from `execution.json`): none.
- Root causes and non-waiver decisions are recorded in `evidence/manual-acceptance/findings.json`; the collector's own integrity record is `PASS` (trusted=True).
- The four prior user-WIP matrix failures (typecheck / format:check / gofmt / build:check) were reconciled; working-tree changes remain unstaged and no assertion was relaxed.

### Open L4 conditions

- `L4-05` 14 L3_DOMAIN_ACCEPTANCE_GATE results all PASS (§8.2/§8.3) — 0/14 PASS; NOT_RUN never counted as PASS
- `L4-10` all applicable requirements evaluated (D05/D08/D09, §16.4) — material applicable requirements remain unassessed
- `L4-11` approved exclusions, open findings and residual risks reviewed (D10/D11/D28, §16.4) — no human risk-owner acceptance: owner decision O-11 = 补齐 (remediate), not 接受残留风险; approved_exceptions=0; open_findings=3
- `L4-13` evidence sufficiency confirmed (D25 / §14.1-14.4) — open evidence gaps: integrity=PASS, verified_items=0/42; MA-12 axe is now a real executed audit (not a toolchain probe); keyboard / three-database / human sign-off remain OPEN

### Rationale

Some applicable requirements are implemented and supported by verification evidence, but one or more applicable requirements remain unmet or insufficiently verified. Therefore §16.2 yields **PARTIALLY CONFORMANT**, not `CONFORMANT`. A global conformity claim is prohibited while material applicable requirements remain unassessed or unsupported by evidence (§16.4).

### Certification distinction (§16.5)

This is an internal assessment against `UTER-AES-GOV-001`. It does **not** constitute certification against ISO, IEC, IEEE, NIST, OWASP, SLSA or any other external standard, and no such claim is made.

---

This deliverable is derived from recorded evidence. A document's existence does not by itself prove control operation or control effectiveness (§16.1). Internal assessment is not external certification (§16.5).
