# D17 — AI Governance Assessment

## Evidence record (§14.3)

| Field | Value |
|---|---|
| Evidence ID | `D17` |
| Related requirement | §3 P01 / §6.6 / §11 |
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

P01 L3 status: **BLOCKED**.

Policy test `test-ai-governance-policy.rb` and `ai-specs-check.sh` run in the L1 matrix. Runtime harness selftest: `20/20` cases PASS, including over-privilege DENY assertions and the honesty assertion that a genuinely failing command cannot produce a PASS report.

Preflight: `PASS`; workspace: `PASS`; verify: `PASS`.

Remaining: independent Agent permission audit, cross-task-type behaviour consistency, live cross-runtime discovery and tool-adapter scope verification.

---

This deliverable is derived from recorded evidence. A document's existence does not by itself prove control operation or control effectiveness (§16.1). Internal assessment is not external certification (§16.5).
