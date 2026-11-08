# D12 — Architecture Assessment

## Evidence record (§14.3)

| Field | Value |
|---|---|
| Evidence ID | `D12` |
| Related requirement | §3 P04 / §16.1 |
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

Repository inventory: Uter `ec6501adceb008d46140a7e5ab6508eb78006731` on `governance/uaes-full-migration-2026-11-06`, UAES `ff7cf878d43061f263e301cad09ff19d03e906c4`. Backend is Go + Gin serving the SPA on port 3000; frontend is React 19 + TanStack Router in `web/`; four Go modules; Electron desktop and docs-web.

P04 L3 status: **BLOCKED**. Open items: `M04-01` OpenAPI -> router -> handler -> service -> repository consistency, `M04-02` architecture / ADR / running behaviour consistency

No live OpenAPI→router→handler→service→repository consistency verification or ADR/runtime-behaviour audit was executed; therefore architecture control effectiveness is NOT ASSESSED.

---

This deliverable is derived from recorded evidence. A document's existence does not by itself prove control operation or control effectiveness (§16.1). Internal assessment is not external certification (§16.5).
