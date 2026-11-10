# D18 — Agent Runtime Assessment

## Evidence record (§14.3)

| Field | Value |
|---|---|
| Evidence ID | `D18` |
| Related requirement | §3 P08 / §6.7 / §18 step 14 |
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

Live WorkBuddy runtime evidence, not static configuration:

| Harness command | Overall | Detail |
|---|---|---|
| preflight | `PASS` | 10 mandatory pre-task checks against live repo state |
| selftest | `PASS` | 20/20 cases |
| verify | `PASS` | real commands, raw stdout/stderr/exit codes |
| workspace | `PASS` | W1–W6 anti-circumvention checks |

Selftest status counts: {'PASS': 20}. Recorded decisions: {'ALLOW': 3, 'DENY': 16, 'overall=FAILED,': 1}. The harness validates the enforcement surface WorkBuddy must obey; it does not claim to sandbox a third-party Agent binary. P08 domain acceptance is still **BLOCKED** because three manual acceptance items remain unverified.

---

This deliverable is derived from recorded evidence. A document's existence does not by itself prove control operation or control effectiveness (§16.1). Internal assessment is not external certification (§16.5).
