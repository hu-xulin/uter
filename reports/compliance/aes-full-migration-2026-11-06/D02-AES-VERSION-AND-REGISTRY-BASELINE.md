# D02 — AES Version and Registry Baseline

## Evidence record (§14.3)

| Field | Value |
|---|---|
| Evidence ID | `D02` |
| Related requirement | §18 step 1 / §2.3 / §0.3 |
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

Re-verified directly from the AES repository, not from historical reports.

| Field | Value |
|---|---|
| AES repository | `/Users/lincolnhu/aes` |
| HEAD | `4344979777433fbcdbe23ef2aa0111fe2e8a52e7` |
| Pinned commit | `586f6227d1248e57173ac785e1b8537cb880362f` |
| Registry blob SHA | `a806eef48e6242d82dcb1d39d5c094e0d7d981a1` |
| Registry version / status | `1.12.1` / `ACTIVE` |
| Approval record | `AES-APPROVAL-2026-11-07-004` |
| Integration status | `MIGRATION_PENDING` |
| AES global gate execution | `NOT_RUN` |

**Critical distinction:** `registry.status = ACTIVE` (`1.12.1`, read live from the pin) establishes a normative baseline only. `APPROVAL-RECORD.md §4` explicitly did NOT approve executing/passing the 13 L3 domain gates, declaring Uter conformant, or waiving visual regression / axe / keyboard / three-database / security scanning / live Agent runtime evidence.

---

This deliverable is derived from recorded evidence. A document's existence does not by itself prove control operation or control effectiveness (§16.1). Internal assessment is not external certification (§16.5).
