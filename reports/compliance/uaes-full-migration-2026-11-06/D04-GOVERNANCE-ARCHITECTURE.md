# D04 — Governance Architecture

## Evidence record (§14.3)

| Field | Value |
|---|---|
| Evidence ID | `D04` |
| Related requirement | §1.1 / §1.3 / §1.4 / §4.3 |
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

| Layer | Repository | Responsibility |
|---|---|---|
| A — UAES universal | `uaes` | P00–P12 only; MUST NOT contain UTER P13 or Uter business rules |
| B — Uter project | `uter` | governance entrypoints, UAES inheritance config, UTER P13 |
| C — Execution & assurance | both | WorkBuddy, CI/CD, automated gates, independent assessment |

Two-repository separation gate: **PASS** (13 checks, 0 failures).

- `S00` PASS — UAES repository reachable
- `S01` PASS — Uter Layer B governance assets present
- `S02` PASS — project registry declares separate repository scopes
- `S03` PASS — UTER P13 registered ONLY in Uter project governance registry
- `S04` PASS — registry explicitly forbids UAES registration locations
- `S05` PASS — UAES registry contains exactly P00-P12 (no UTER P13 phase)
- `S06` PASS — UAES domain gates are exactly 13 with no P13 gate
- `S07` PASS — UAES standards/ has 13 universal domain directories only
- `S08` PASS — no Uter business rules or UTER P13 inside UAES normative standards
- `S09` PASS — no UTER-P13 artifact exists anywhere in the UAES repository
- `S10` PASS — Uter holds no competing copy of UAES normative standards
- `S11` PASS — Uter governance entry remains a thin pointer
- `S12` PASS — historical UAES-P13-* files are confined to derived reports/

UTER P13 is registered **only** in `.uaes/uter-governance-registry.yaml`; the UAES registry `phases` contains exactly P00–P12 and UAES `standards/` contains 13 domain directories. Historical `UAES-P13-*` files under the UAES `reports/` directory are derived Repository-Integration evidence, not standards; their ambiguous name is registered as a Low finding in D10.

---

This deliverable is derived from recorded evidence. A document's existence does not by itself prove control operation or control effectiveness (§16.1). Internal assessment is not external certification (§16.5).
