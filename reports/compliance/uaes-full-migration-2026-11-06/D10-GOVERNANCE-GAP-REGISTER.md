# D10 — Governance Gap Register

## Evidence record (§14.3)

| Field | Value |
|---|---|
| Evidence ID | `D10` |
| Related requirement | §13.1-13.3 / §18 step 9 |
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

Severity model (§13.1): Critical / High / Medium / Low / Observation / Improvement Opportunity, considering impact, likelihood, exploitability, exposure and affected objectives. Lifecycle: IDENTIFIED → RECORDED → ASSESSED → ASSIGNED → CORRECTIVE ACTION → IMPLEMENTED → VERIFICATION → CLOSED (§13.2). A finding is **not** closed merely because a change exists.

| Finding ID | Severity | Title | Detail | Evidence | Lifecycle |
|---|---|---|---|---|---|
| GOV-GAP-001 | High | Standards applicability analysis incomplete | 25 §2.1 standards lack verified editions / applicability decisions | D01 | IDENTIFIED |
| GOV-GAP-002 | High | 14 domain acceptances not passed | 0/14 PASS; 42 unverified acceptance items | D08/D09 | IDENTIFIED |
| GOV-GAP-003 | High | Global conformance gate blocked | 7/16 L4 conditions NOT_MET | D21 | IDENTIFIED |
| GOV-GAP-004 | Medium | Test matrix failures | 3 commands FAIL: `L1-11`, `L1-16`, `L1-18` | D19 / evidence/wip-remediation | IDENTIFIED |
| FIND-IA-07 | High | 42 domain acceptance items remain unverified | 14 domains have unresolved manual acceptance evidence (§16.3) | D26 | IDENTIFIED |
| FIND-IA-08 | High | 7 L4 global conditions remain NOT_MET | Global acceptance cannot be granted (§16.4) | D26 | IDENTIFIED |
| FIND-IA-09 | Medium | 3 test-matrix commands FAIL | Each failure is recorded with its raw log and exit code; no failure is masked or reinterpreted as a skip | D26 | IDENTIFIED |
| FIND-IA-10 | Low | no APPROVED_EXCEPTION records granted | All unmet requirements remain open; no risk-owner acceptance exists (§13.4 / §16.4) | D26 | IDENTIFIED |

---

This deliverable is derived from recorded evidence. A document's existence does not by itself prove control operation or control effectiveness (§16.1). Internal assessment is not external certification (§16.5).
