# D21 — Quality Gate Assessment

## Evidence record (§14.3)

| Field | Value |
|---|---|
| Evidence ID | `D21` |
| Related requirement | §8.2 / §8.3 / §16.3 |
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

Gate result vocabulary (§8.3): PASS / FAIL / BLOCKED / NOT_RUN / NOT_APPLICABLE / APPROVED_EXCEPTION. **NOT_RUN is never reported as PASS.**

| Gate | Status | Detail |
|---|---|---|
| L1_CHANGE_GATE | FAIL | 18 checks, 3 failed |
| L2_INTEGRATION_GATE | PASS | 9 checks, 0 failed |
| L3_DOMAIN_ACCEPTANCE_GATE | BLOCKED | 0/14 domains PASS |
| L4_GLOBAL_CONFORMANCE_GATE | BLOCKED | 9/16 §16.4 conditions MET |

| Domain | Classification | Status | UAES gate execution |
|---|---|---|---|
| P00 | UAES_UNIVERSAL_DOMAIN | BLOCKED | NOT_RUN |
| P01 | UAES_UNIVERSAL_DOMAIN | BLOCKED | NOT_RUN |
| P02 | UAES_UNIVERSAL_DOMAIN | BLOCKED | NOT_RUN |
| P03 | UAES_UNIVERSAL_DOMAIN | BLOCKED | NOT_RUN |
| P04 | UAES_UNIVERSAL_DOMAIN | BLOCKED | NOT_RUN |
| P05 | UAES_UNIVERSAL_DOMAIN | BLOCKED | NOT_RUN |
| P06 | UAES_UNIVERSAL_DOMAIN | BLOCKED | NOT_RUN |
| P07 | UAES_UNIVERSAL_DOMAIN | BLOCKED | NOT_RUN |
| P08 | UAES_UNIVERSAL_DOMAIN | BLOCKED | NOT_RUN |
| P09 | UAES_UNIVERSAL_DOMAIN | BLOCKED | NOT_RUN |
| P10 | UAES_UNIVERSAL_DOMAIN | BLOCKED | NOT_RUN |
| UTER-P13 | UTER_PROJECT_SPECIFIC_EXTENSION | BLOCKED | NOT_APPLICABLE |
| P11 | UAES_UNIVERSAL_DOMAIN | BLOCKED | NOT_RUN |
| P12 | UAES_UNIVERSAL_DOMAIN | BLOCKED | NOT_RUN |

---

This deliverable is derived from recorded evidence. A document's existence does not by itself prove control operation or control effectiveness (§16.1). Internal assessment is not external certification (§16.5).
