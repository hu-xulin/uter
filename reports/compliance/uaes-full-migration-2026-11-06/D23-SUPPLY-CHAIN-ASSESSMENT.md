# D23 — Supply Chain Assessment

## Evidence record (§14.3)

| Field | Value |
|---|---|
| Evidence ID | `D23` |
| Related requirement | §10.2 / §3 P10.6 / §2.1 SLSA & OpenSSF |
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

Observed: `.github/workflows/ci.yml` pins actions to full commit SHAs; production Docker Compose service images are validated as immutable in CI; Go module checksums and frontend lockfiles exist in the repository.

Executed locally: `govulncheck` on all four Go modules (MA-02 PASS (exit=0), MA-03 PASS (exit=0), MA-04 PASS (exit=0), MA-05 PASS (exit=0)) and a tracked-tree secret scan (MA-06 PASS (exit=0)).

Not verified: SLSA build level attestation, provenance verification, signed artifacts, SBOM generation, frontend dependency vulnerability scanning, and OpenSSF Scorecard. Executed scans are evidence, not an acceptance decision. **NOT ASSESSED** — no certification or supply-chain conformity claim is made.

---

This deliverable is derived from recorded evidence. A document's existence does not by itself prove control operation or control effectiveness (§16.1). Internal assessment is not external certification (§16.5).
