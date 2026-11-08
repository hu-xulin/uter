# D02 — UAES Version and Registry Baseline

## Evidence record (§14.3)

| Field | Value |
|---|---|
| Evidence ID | `D02` |
| Related requirement | §18 step 1 / §2.3 / §0.3 |
| Related finding | D10 gap register / D28 residual risk register |
| Repository revision | Uter `ec6501adceb008d46140a7e5ab6508eb78006731` / UAES `ff7cf878d43061f263e301cad09ff19d03e906c4` |
| Source system | `scripts/quality/uaes-governance-reports.py` + on-disk gate evidence |
| Execution environment | local non-production; Python 3.13.12; Go go version go1.27.3 darwin/amd64; Node v22.22.2; Bun 1.4.2 |
| Collection time | 2026-11-06T11:04:20.850321+00:00 |
| Collector | WorkBuddy (Tencent Hunyuan Hy) |
| Integrity | SHA-256 of source evidence is recorded in D25 (Evidence Index) |
| Storage reference | `/Users/lincolnhu/uter/reports/compliance/uaes-full-migration-2026-11-06/evidence` |
| Access restrictions | local repository evidence; no credentials or production data |
| Conformance status (§16.2) | **PARTIALLY CONFORMANT** |

## Content

Re-verified directly from the UAES repository, not from historical reports.

| Field | Value |
|---|---|
| UAES repository | `/Users/lincolnhu/uaes` |
| HEAD | `ff7cf878d43061f263e301cad09ff19d03e906c4` |
| Pinned commit | `ff7cf878d43061f263e301cad09ff19d03e906c4` |
| Registry blob SHA | `5090c84f6b71d520ca0181f9da4e77be69ebcbf5` |
| Registry version / status | `1.9.0` / `APPROVED` |
| Approval record | `UAES-APPROVAL-2026-11-06-001` |
| Integration status | `MIGRATION_PENDING` |
| UAES global gate execution | `NOT_RUN` |

**Critical distinction:** `registry.status = APPROVED` establishes a normative baseline only. `APPROVAL-RECORD.md §4` explicitly did NOT approve executing/passing the 13 L3 domain gates, declaring Uter conformant, or waiving visual regression / axe / keyboard / three-database / security scanning / live Agent runtime evidence.

---

This deliverable is derived from recorded evidence. A document's existence does not by itself prove control operation or control effectiveness (§16.1). Internal assessment is not external certification (§16.5).
