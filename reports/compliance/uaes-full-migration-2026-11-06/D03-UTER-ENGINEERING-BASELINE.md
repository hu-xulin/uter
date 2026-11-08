# D03 — Uter Engineering Baseline

## Evidence record (§14.3)

| Field | Value |
|---|---|
| Evidence ID | `D03` |
| Related requirement | §18 step 3 / §6.3 |
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

| Field | Value |
|---|---|
| Branch | `governance/uaes-full-migration-2026-11-06` |
| HEAD | `ec6501adceb008d46140a7e5ab6508eb78006731` |
| Working-tree entries | 177 (140 modified, 26 untracked) |
| Staged files | 0 (delivery remains fail-closed) |
| Commits created by this execution | 0 |

Toolchain: `go=go version go1.27.3 darwin/amd64`, `node=v22.22.2`, `bun=1.4.2`, `ruby=ruby 4.0.6 (2026-07-14 revision 03b6d3f889) +PRISM [x86_64-darwin23]`, `python=3.13.12`

User pre-existing WIP (billing expression / DreamRouter pricing / tiered pricing) was preserved as a recorded baseline: no reset, clean, revert or staging. After the owner explicitly requested reconciliation of the four failing matrix rows, minimal semantic-preserving edits (including formatter normalisation) were applied to the exact paths enumerated in `evidence/agent-runtime-task.json`; before/after SHA-256 snapshots are in `evidence/wip-remediation/`. No WIP entry was reverted, overwritten wholesale or included in any commit. Baseline preservation evidence: `evidence/00-branch-switch-wip-preserved.txt`, `evidence/agent-runtime-workspace.json` (W1–W6).

Engineering structure: 4 Go modules (root, relaykit, tokenkit, tokenkit/tokenkit), React 19 + TanStack Router + rsbuild frontend in `web/`, Electron desktop, docs-web, and `scripts/quality/` executable gates.

---

This deliverable is derived from recorded evidence. A document's existence does not by itself prove control operation or control effectiveness (§16.1). Internal assessment is not external certification (§16.5).
