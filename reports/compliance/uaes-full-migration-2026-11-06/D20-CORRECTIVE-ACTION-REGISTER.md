# D20 — Corrective Action Register

## Evidence record (§14.3)

| Field | Value |
|---|---|
| Evidence ID | `D20` |
| Related requirement | §13.2 / §13.3 / §18 steps 9-11 |
| Related finding | D10 gap register / D28 residual risk register |
| Repository revision | Uter `424dfa2c55c534bf110fa5871420fe3fd679d307` / UAES `4344979777433fbcdbe23ef2aa0111fe2e8a52e7` |
| Source system | `scripts/quality/uaes-governance-reports.py` + on-disk gate evidence |
| Execution environment | local non-production; Python 3.13.12; Go go version go1.27.3 darwin/amd64; Node v22.22.2; Bun 1.4.2 |
| Collection time | 2026-11-08T18:42:15.299631+00:00 |
| Collector | WorkBuddy (Tencent Hunyuan Hy) |
| Integrity | SHA-256 of source evidence is recorded in D25 (Evidence Index) |
| Storage reference | `/Users/lincolnhu/uter/reports/compliance/uaes-full-migration-2026-11-06/evidence` |
| Access restrictions | local repository evidence; no credentials or production data |
| Conformance status (§16.2) | **PARTIALLY CONFORMANT** |

## Content

Each corrective action follows §13.3 fields. `IMPLEMENTED` is not `VERIFIED`, and a finding is not closed solely because a change exists.

**Vocabulary note:** superseded V2 terms appearing in CA-01 / CA-04 (`LOCAL MAIN ONLY`, `SINGLE_EXECUTION_BRANCH`, `D01-D24`, `FULLY_COMPLIANT`) are historical root-cause descriptions only. They are not active policy and not conformance conclusions; the current vocabulary is §8.2 / §8.3 / §16.2 / §16.3.

| ID | Root cause / issue | Affected component | Corrective action | Verification |
|---|---|---|---|---|
| `CA-01` | V2 LOCAL MAIN ONLY / SINGLE_EXECUTION_BRANCH permanent rules conflicted with UTER-UAES-GOV-001 | AGENTS.md, .uaes/agent-governance.yaml, ai-specs-check.sh, test-ai-governance-policy.rb | Migrate to governing spec, baseline preservation, 14 domains, L4_GLOBAL_CONFORMANCE_GATE | IMPLEMENTED / VERIFIED by 3 gates exit 0 |
| `CA-02` | UTER P13 missing; business rules were misplaced in UAES P10 of the local evaluator | .uaes/UTER-P13-*.md, .uaes/uter-governance-registry.yaml, uaes-governance-gates.rb | Register P13 in Uter only as 14th domain; correct P09/P10 labels | IMPLEMENTED / VERIFIED by separation + boundary gates |
| `CA-03` | No automated two-repository separation or P09/P10 boundary control | uter-governance-separation-check.rb, uter-p09-p10-boundary-check.rb | Implement real cross-repository / role gates and wire into CI + test matrix | IMPLEMENTED / VERIFIED |
| `CA-04` | V2 D01-D24 report generator used obsolete conclusion vocabulary | uaes-governance-reports.py | Rewrite to §15 D01-D28 with §14.3 fields and §16.2 statuses | IMPLEMENTED / VERIFIED by this deliverable set |
| `CA-05` | Independent assessment (Phase 7) had no implementation | uter-independent-assessment.rb, D26 | Independent re-derivation of pin/scope/exit codes/denials/gate honesty | IMPLEMENTED / VERIFIED |
| `CA-06` | Runtime harness read removed execution_policy.mode and hard-coded branch != main | uaes-agent-runtime-check.rb | Record traceable baseline; respect environment-authorized local main | IMPLEMENTED / VERIFIED by preflight/workspace/verify/selftest |
| `CA-07` | Dangling §27 / §22 references to a specification that ends at §19 | AGENTS.md, INTEGRATION.md, TRACEABILITY.md, AI-GOVERNANCE-ENTRY.md, P13 spec, registry, policy | Replace with §1.3 / §6.3 / §8 / §9 / §10 / §16.3 / §18 | IMPLEMENTED / VERIFIED |
| `CA-08` | 14 domain acceptances remain open; local evidence executed (PASS 14 / FAIL 0 / NOT_RUN 0); axe/keyboard/three-DB/DR still unavailable | manual-acceptance/*.json, D08/D09/D15/D16/D26/D28 | Owner-authorised item-by-item review and external-environment drills; not auto-closable | OPEN / NOT VERIFIED |
| `CA-09` | 0 test-matrix command(s) FAIL: none | D19 / D28 / evidence/wip-remediation | The four prior user-WIP failures (typecheck, format:check, gofmt, build:check) were reconciled by minimal semantic-preserving fixes; working-tree changes remain unstaged and no assertion was relaxed | IMPLEMENTED / VERIFIED by re-run matrix |
| `CA-10` | acceptance authority record: Acceptance authority **胡旭林（项目所有者 / Acceptance Authority）** (`USER_EXPLICIT_DESIGNATION`, recorded 2026-11-07T01:33:20Z). Decision: `PENDING_ITEM_BY_ITEM_REVIEW`; sign-off granted: **false**. | manual-acceptance/acceptance-authority.json, D27/D28 | Record the user-designated authority only; no sign-off, no auto-promotion of local evidence | IMPLEMENTED / VERIFIED (recorded, NOT accepted) |
| `CA-11` | Runtime W1 flagged newly visible web/ paths after the owner-authorised WIP reconciliation | evidence/agent-runtime-task.json, evidence/agent-runtime-workspace.json, D28 | Declare the exact 24 authorised paths individually with an explicit scope-extension declaration; re-run preflight/workspace; keep the W1 fail-closed rule unchanged | IMPLEMENTED / VERIFIED by workspace W1-W6 PASS |
| `CA-12` | First final matrix L2-07 build:check FAIL caused by host safe-delete overwrite guard | evidence/wip-remediation/L2-07-environment-finding.json, build-check-clean-dist.log, L2-07-matrix-fail.log, D19/D28 | Do NOT disable the shim or rewrite the exit code; verify the unchanged command PASS on a clean dist; add a documented mid-matrix `mv web/dist` build-hygiene step (after Go embed tests, before L2-07) and honestly re-run the entire matrix | IMPLEMENTED / VERIFIED by that row's exit 0 in the final matrix |
| `CA-13` | Third full matrix run L2-01 go test ./... FAIL from incomplete docs static export preparation | evidence/wip-remediation/L2-01-environment-finding.json, L2-01-matrix-fail.log, matrix-third-run.tsv, test-matrix-third-run.json, D19/D28 | Restore the COMPLETE docs-web static export with the project's own postbuild script and verify with scripts/verify-docs-artifacts.sh before the matrix; add a post-L2-07 restoration step (only when docs-content is missing); preserve the FAIL aggregate and honestly re-run the entire matrix | IMPLEMENTED / VERIFIED by that row's exit 0 in the final matrix |

---

This deliverable is derived from recorded evidence. A document's existence does not by itself prove control operation or control effectiveness (§16.1). Internal assessment is not external certification (§16.5).
