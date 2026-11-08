# D22 — Security Gate Assessment

## Evidence record (§14.3)

| Field | Value |
|---|---|
| Evidence ID | `D22` |
| Related requirement | §8.4 / §10 / §16.1 |
| Related finding | D10 gap register / D28 residual risk register |
| Repository revision | Uter `424dfa2c55c534bf110fa5871420fe3fd679d307` / UAES `4344979777433fbcdbe23ef2aa0111fe2e8a52e7` |
| Source system | `scripts/quality/uaes-governance-reports.py` + on-disk gate evidence |
| Execution environment | local non-production; Python 3.13.12; Go go version go1.27.3 darwin/amd64; Node v22.22.2; Bun 1.4.2 |
| Collection time | 2026-11-08T18:42:15.299631+00:00 |
| Collector | WorkBuddy (Tencent Hunyuan Hy) |
| Integrity | SHA-256 of source evidence is recorded in D25 (Evidence Index) |
| Storage reference | `/Users/lincolnhu/uter/reports/compliance/uaes-full-migration-2026-11-06/evidence` |
| Access restrictions | local repository evidence; no credentials or production data |
| Conformance status (§16.2) | **NOT ASSESSED** |

## Content

§8.4 requires risk-based evaluation using exploitability, exposure, impact, affected assets, existing mitigations and residual risk, with disclosure of unresolved findings and risk-owner authorisation for acceptance.

| Criterion | Observation |
|---|---|
| Dependency vulnerability scan (govulncheck, 4 Go modules) | MA-02..MA-05: PASS (exit=0), PASS (exit=0), PASS (exit=0), PASS (exit=0) |
| Secret scan (gitleaks, tracked HEAD tree) | MA-06: PASS (exit=0) |
| Forbidden tracked-file scan | MA-07: PASS (exit=0) |
| SAST / DAST / OWASP ASVS-aligned manual review | NOT EXECUTED; explicitly not waived by UAES approval §4 |
| Threat model / reliability objectives | NOT ASSESSED |
| Backup / DR / incident drill | NOT EXECUTED |
| Supply chain / dependency verification | partial (pinned CI action SHAs); full assessment NOT ASSESSED |
| Runtime fail-closed denials | `PASS` (20/20) |

**All security findings remain open and disclosed.** No risk acceptance has been granted. A clean scanner report alone would not establish security conformity (§3 P10.7).

---

This deliverable is derived from recorded evidence. A document's existence does not by itself prove control operation or control effectiveness (§16.1). Internal assessment is not external certification (§16.5).
