# D04 — Governance Architecture

## Evidence record (§14.3)

| Field | Value |
|---|---|
| Evidence ID | `D04` |
| Related requirement | §1.1 / §1.3 / §1.4 / §4.3 |
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

| Layer | Repository | Responsibility |
|---|---|---|
| A — AES universal | `aes` | P00–P12 only; MUST NOT contain UTER P13 or Uter business rules |
| B — Uter project | `uter` | governance entrypoints, AES inheritance config, UTER P13 |
| C — Execution & assurance | both | WorkBuddy, CI/CD, automated gates, independent assessment |

Two-repository separation gate: **PASS** (13 checks, 0 failures).

- `S00` PASS — AES repository reachable
- `S01` PASS — Uter Layer B governance assets present
- `S02` PASS — project registry declares separate repository scopes
- `S03` PASS — UTER P13 registered ONLY in Uter project governance registry
- `S04` PASS — registry explicitly forbids AES registration locations
- `S05` PASS — AES registry contains exactly P00-P12 (no UTER P13 phase)
- `S06` PASS — AES domain gates are exactly 13 with no P13 gate
- `S07` PASS — AES standards/ has 13 universal domain directories only
- `S08` PASS — no Uter business rules or UTER P13 inside AES normative standards
- `S09` PASS — no UTER-P13 artifact exists anywhere in the AES repository
- `S10` PASS — Uter holds no competing copy of AES normative standards
- `S11` PASS — Uter governance entry remains a thin pointer
- `S12` PASS — historical AES-P13-* files are confined to derived reports/

UTER P13 is registered **only** in `.aes/uter-governance-registry.yaml`; the AES registry `phases` contains exactly P00–P12 and AES `standards/` contains 13 domain directories. Historical `AES-P13-*` files under the AES `reports/` directory are derived Repository-Integration evidence, not standards; their ambiguous name is registered as a Low finding in D10.

---

This deliverable is derived from recorded evidence. A document's existence does not by itself prove control operation or control effectiveness (§16.1). Internal assessment is not external certification (§16.5).
