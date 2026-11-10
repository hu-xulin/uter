# D07 — Governance Ownership Matrix

## Evidence record (§14.3)

| Field | Value |
|---|---|
| Evidence ID | `D07` |
| Related requirement | §1.3 / §3 P09 / §3 P10 / §8.2 |
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

| Owner | Role | Responsibility |
|---|---|---|
| External standards | DEFINE | Recognised requirements and frameworks (§2.1) |
| AES (Layer A) | DEFINE | Universal engineering governance P00–P12 |
| Uter governance (Layer B) | APPLY | Project policies, inheritance config, UTER P13 |
| UTER P13 | DEFINE | Project-specific business domain controls |
| P09 Quality Engineering | **PROVE** | Prove whether engineering quality meets requirements |
| P10 Security & Reliability | **DEFINE** | Define security/reliability requirements the system must meet |
| WorkBuddy | EXECUTE | Authorized engineering tasks only |
| CI/CD | ENFORCE | Automated technical controls |
| Independent assurance | EVALUATE | Implementation, evidence, conformance claims |

P09/P10 boundary gate: **PASS** (11 checks, 0 failures). Security testing is REQUIRED by P10 and EXECUTED/RECORDED by the P09 test engineering system; neither may substitute for the other.

---

This deliverable is derived from recorded evidence. A document's existence does not by itself prove control operation or control effectiveness (§16.1). Internal assessment is not external certification (§16.5).
