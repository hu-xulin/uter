# D11 — Risk Register

## Evidence record (§14.3)

| Field | Value |
|---|---|
| Evidence ID | `D11` |
| Related requirement | §7.1 / §13.4 / §16.4 |
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

| Risk ID | Severity | Description | Scope | Required treatment | Status |
|---|---|---|---|---|---|
| RISK-01 | High | Unverified payment/billing exception handling could affect real funds | P13 | Targeted unit tests + independent domain acceptance + three-DB drill | OPEN |
| RISK-02 | High | Security controls (ASVS/SAST/DR) unverified; tracked-tree secret scan executed but FAILED | P10 | Execute P10-required security testing via P09 test system; resolve MA-06 (candidate false positive, NOT waived) | OPEN |
| RISK-03 | High | User WIP typecheck/format/gofmt/build failures | L1/L2 | Minimal semantic-preserving reconciliation with before/after SHA-256 evidence; verified by re-run matrix | OPEN — 3 matrix command(s) still FAIL |
| RISK-04 | Medium | Standards editions not verified against official publishers | §2.1 | Retrieve authoritative editions; complete D01 | OPEN |
| RISK-05 | Medium | Independent human acceptance authority recorded but no item signed (42 NOT_VERIFIED) | §16.4 | Owner must review and sign each item; L4-15 records the authority only | OPEN (RECORDED / NOT ACCEPTED) |
| RISK-06 | Low | UAES-P13-* historical report names are ambiguous | §4.3 | Separately approved UAES-repository rename | OPEN |

No risk acceptance has been granted. §13.4 requires a formal decision with business justification, residual risk, compensating controls, acceptance authority, validity period and reassessment conditions. WorkBuddy must not accept material business risks on behalf of the organization (§18).

---

This deliverable is derived from recorded evidence. A document's existence does not by itself prove control operation or control effectiveness (§16.1). Internal assessment is not external certification (§16.5).
