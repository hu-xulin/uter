# D15 — Security Assessment

## Evidence record (§14.3)

| Field | Value |
|---|---|
| Evidence ID | `D15` |
| Related requirement | §3 P10 / §10 / §8.4 |
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

**P10 DEFINES** the security and reliability requirements the system must meet: threat modeling, identity/access, application/API security, data protection, supply chain, security testing, reliability, backup/DR and incident management. Execution/recording of security tests belongs to the P09 test system.

P10 L3 status: **BLOCKED**.

Security-test evidence recorded in the P09 test system (§3 P09/P10 division): `govulncheck` on 4 Go modules (MA-02 PASS (exit=0), MA-03 PASS (exit=0), MA-04 PASS (exit=0), MA-05 PASS (exit=0)), tracked-tree secret scan (MA-06 PASS (exit=0)), forbidden tracked-file scan (MA-07 PASS (exit=0)). Those are execution records, not a P10 acceptance of the requirement baseline.

Still missing (§8.4 risk-based criteria): SAST/DAST, ASVS-aligned manual review, penetration test, threat model sign-off, reliability/DR drills. UAES `APPROVAL-RECORD.md §4` explicitly did not waive security scanning. All such findings remain **unresolved and disclosed**, not suppressed. MA-06 detail (`evidence/manual-acceptance/MA-06-finding.json`): one `generic-api-key` hit on a 40-hex OpenAPI commit SHA quoted in `.uaes/API-LEGACY-ENDPOINT-DEPRECATION-AUDIT-2026-11-05.md`. It is registered as a **candidate false positive only** — the gitleaks allowlist was NOT changed, MA-06 stays FAIL, and classifying/accepting it requires the acceptance authority.

---

This deliverable is derived from recorded evidence. A document's existence does not by itself prove control operation or control effectiveness (§16.1). Internal assessment is not external certification (§16.5).
