# D13 — Software Engineering Assessment

## Evidence record (§14.3)

| Field | Value |
|---|---|
| Evidence ID | `D13` |
| Related requirement | §3 P06 / §8.2 |
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

P06 L3 status: **BLOCKED**.

Real command results: 31/31 PASS, 0 FAIL, 0 SKIP.

| Check | Layer | Exit | Command |
|---|---|---|---|
| `L1-01` | L1 | 0 | `bash scripts/quality/ai-specs-check.sh` |
| `L1-02` | L1 | 0 | `ruby scripts/quality/test-ai-governance-policy.rb` |
| `L1-03` | L1 | 0 | `ruby scripts/quality/aes-agent-runtime-check.rb selftest` |
| `L1-04` | L1 | 0 | `bash scripts/quality/aes-pin-check.sh` |
| `L1-05` | L1 | 0 | `bash scripts/quality/aes-integration-check.sh` |
| `L1-06` | L1 | 0 | `ruby scripts/quality/test-aes-pin-check.rb` |
| `L1-07` | L1 | 0 | `ruby scripts/quality/test-aes-integration-check.rb` |
| `L1-08` | L1 | 0 | `bun run typecheck` |
| `L1-09` | L1 | 0 | `bun run lint` |
| `L1-10` | L1 | 0 | `bun run format:check` |
| `L1-11` | L1 | 0 | `bun run copyright:check` |
| `L1-12` | L1 | 0 | `bun run design:tokens:check` |
| `L1-13` | L1 | 0 | `gofmt -l $(find . -name '*.go' -not -path './.git/*' -not -path './node_modules/*' -not -path './.quality/*' /` |
| `L1-14` | L1 | 0 | `ruby scripts/quality/uter-governance-separation-check.rb` |
| `L1-15` | L1 | 0 | `ruby scripts/quality/uter-p09-p10-boundary-check.rb` |
| `L1-16` | L1 | 0 | `ruby scripts/quality/aes-agent-runtime-check.rb preflight --task reports/compliance/aes-full-migration-2026-` |
| `L1-17` | L1 | 0 | `ruby scripts/quality/test-uter-governance-boundaries.rb` |
| `L1-18` | L1 | 0 | `ruby scripts/quality/test-aes-manual-acceptance-boundary.rb` |
| `L1-19` | L1 | 0 | `ruby scripts/quality/test-registry-draft-state.rb` |
| `L1-20` | L1 | 0 | `bash scripts/quality/gitleaks-allowlist.test.sh` |
| `L2-01` | L2 | 0 | `GOWORK=off go test ./...` |
| `L2-02` | L2 | 0 | `GOWORK=off go test ./...` |
| `L2-03` | L2 | 0 | `GOWORK=off go test ./...` |
| `L2-04` | L2 | 0 | `GOWORK=off go test ./...` |
| `L2-05` | L2 | 0 | `GOWORK=off go vet ./...` |
| `L2-06` | L2 | 0 | `bun run test` |
| `L2-07` | L2 | 0 | `bun run build:check` |
| `L2-08` | L2 | 0 | `GOWORK=off go test ./controller/... ./service/... ./model/... -run 'Alipay/TopUp/Recharge/Billing/Gateway/Drea` |
| `L2-09` | L2 | 0 | `bun run test -- src/features/wallet src/features/pricing` |
| `U-01` | AES | 0 | `node quality/scripts/aes/validate-registry.mjs` |
| `U-02` | AES | 0 | `node quality/scripts/aes/quality-gate-runner.mjs` |

Go four-module tests and `go vet` ran on the verification run. The four historical failures (typecheck, format check, gofmt, build:check) were attributed to pre-existing user WIP (`duration` field propagation) and format debt; the owner then explicitly asked to reconcile them, and the fixes were minimal and semantic-preserving with before/after SHA-256 snapshots in `evidence/wip-remediation/`. Current re-run matrix: **0 FAIL** — all executed matrix commands returned exit 0. No assertion was relaxed and no user change was reverted.

---

This deliverable is derived from recorded evidence. A document's existence does not by itself prove control operation or control effectiveness (§16.1). Internal assessment is not external certification (§16.5).
