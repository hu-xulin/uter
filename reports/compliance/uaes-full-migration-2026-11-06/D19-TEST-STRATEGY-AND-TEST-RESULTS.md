# D19 — Test Strategy and Test Results

## Evidence record (§14.3)

| Field | Value |
|---|---|
| Evidence ID | `D19` |
| Related requirement | §9 / §15 D19 |
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

Test strategy (§9.1): L1_CHANGE_GATE covers formatting, compilation, type checking, static analysis, governance gates and secret-like file detection; L2_INTEGRATION_GATE covers four Go module test suites, `go vet`, full vitest, build check and UTER P13 targeted business suites; UAES registry validation is read-only.

Result: total **29**, PASS **26**, FAIL **3**, SKIP **0**, overall `FAIL`.

| ID | Layer | Status | Exit | Duration (s) | Command |
|---|---|---|---|---|---|
| `L1-01` | L1 | PASS | 0 | 1 | `bash scripts/quality/ai-specs-check.sh` |
| `L1-02` | L1 | PASS | 0 | 0 | `ruby scripts/quality/test-ai-governance-policy.rb` |
| `L1-03` | L1 | PASS | 0 | 1 | `ruby scripts/quality/uaes-agent-runtime-check.rb selftest` |
| `L1-04` | L1 | PASS | 0 | 2 | `bash scripts/quality/uaes-pin-check.sh` |
| `L1-05` | L1 | PASS | 0 | 1 | `bash scripts/quality/uaes-integration-check.sh` |
| `L1-06` | L1 | PASS | 0 | 33 | `ruby scripts/quality/test-uaes-pin-check.rb` |
| `L1-07` | L1 | PASS | 0 | 12 | `ruby scripts/quality/test-uaes-integration-check.rb` |
| `L1-08` | L1 | PASS | 0 | 8 | `bun run typecheck` |
| `L1-09` | L1 | PASS | 0 | 2 | `bun run lint` |
| `L1-10` | L1 | PASS | 0 | 3 | `bun run format:check` |
| `L1-11` | L1 | FAIL | 1 | 1 | `bun run copyright:check` |
| `L1-12` | L1 | PASS | 0 | 0 | `bun run design:tokens:check` |
| `L1-13` | L1 | PASS | 0 | 20 | `gofmt -l $(find . -name '*.go' -not -path './.git/*' -not -path './node_modules/*' -not -path './.qu` |
| `L1-14` | L1 | PASS | 0 | 1 | `ruby scripts/quality/uter-governance-separation-check.rb` |
| `L1-15` | L1 | PASS | 0 | 1 | `ruby scripts/quality/uter-p09-p10-boundary-check.rb` |
| `L1-16` | L1 | FAIL | 1 | 2 | `ruby scripts/quality/uaes-agent-runtime-check.rb preflight --task reports/compliance/uaes-full-migra` |
| `L1-17` | L1 | PASS | 0 | 10 | `ruby scripts/quality/test-uter-governance-boundaries.rb` |
| `L1-18` | L1 | FAIL | 1 | 3 | `ruby scripts/quality/test-uaes-manual-acceptance-boundary.rb` |
| `L2-01` | L2 | PASS | 0 | 60 | `GOWORK=off go test ./...` |
| `L2-02` | L2 | PASS | 0 | 0 | `GOWORK=off go test ./...` |
| `L2-03` | L2 | PASS | 0 | 1 | `GOWORK=off go test ./...` |
| `L2-04` | L2 | PASS | 0 | 0 | `GOWORK=off go test ./...` |
| `L2-05` | L2 | PASS | 0 | 7 | `GOWORK=off go vet ./...` |
| `L2-06` | L2 | PASS | 0 | 318 | `bun run test` |
| `L2-07` | L2 | PASS | 0 | 26 | `bun run build:check` |
| `L2-08` | L2 | PASS | 0 | 13 | `GOWORK=off go test ./controller/... ./service/... ./model/... -run 'Alipay/TopUp/Recharge/Billing/Ga` |
| `L2-09` | L2 | PASS | 0 | 28 | `bun run test -- src/features/wallet src/features/pricing` |
| `U-01` | UAES | PASS | 0 | 2 | `node quality/scripts/uaes/validate-registry.mjs` |
| `U-02` | UAES | PASS | 0 | 2 | `node quality/scripts/uaes/quality-gate-runner.mjs` |

Raw logs: `evidence/matrix/<ID>.log` (stdout, stderr, exit code, duration, toolchain versions). Skips are explicit and never counted as PASS (§8.3). Failures are listed in D10 / D28, not waived.

**Build-environment disclosure (§8.3):** an earlier full matrix run recorded `L2-07 build:check` as FAIL (exit 1, 463s) because the WorkBuddy host-side safe-delete shim blocked ~50 `fs.cp` overwrite deletes while copying `web/public` over a stale `web/dist`. It was NOT a compile error. A clean-dist standalone re-execution of the **unchanged** command returned exit 0 in 17s. Two intermediate preparation attempts were abandoned (one lacked `web/dist/index.html` required by `//go:embed`, one retained stale `static/` output that made rsbuild's trash-based deletion path extremely slow); neither result is presented as a final matrix. The runner adds only documented **build-hygiene steps**: after `L2-01..L2-05` (which require a valid `web/dist` for `go:embed`) it moves `web/dist` aside with `mv` — the project's existing `rebuild-all.sh` convention — so `L2-07` builds into an empty directory; and after `L2-07` it restores the **complete** docs static export with the project's own `node docs-web/scripts/copy-to-web.mjs` plus `scripts/verify-docs-artifacts.sh`, but only when `docs-content/` is absent, so no deletion is issued and the host safe-delete guard is never engaged. The `L2-07` command, its exit code and every assertion are unchanged.

A third full matrix run confirmed `L2-07` PASS (exit 0, 19s) but exposed a **separate** `L2-01` FAIL (exit 1, 27s): the pre-run `web/dist` had been prepared with only `index.html` and `docs-content/_next`, which satisfies `//go:embed` compilation but not `main_docs_test.go`'s requirement for the full Next.js export (all language landing pages, about pages, `_next` assets and a >1KB landing page). This was an incomplete docs-artifact preparation, NOT a Go test regression. The third-run FAIL aggregate is preserved unchanged in `evidence/wip-remediation/L2-01-matrix-fail.log`, `matrix-third-run.tsv` and `test-matrix-third-run.json`; it is superseded only by an honest complete re-run. `GOWORK=off go test -count=1 .` (forced, uncached) returned exit 0 after the full export was restored. See `L2-01-environment-finding.json`, `L2-01-after-docs-restore.log`, `L2-01-root-forced.log`, `docs-artifacts-after-restore.txt`.

See also `evidence/wip-remediation/L2-07-environment-finding.json`, `build-check-clean-dist.log` and the preserved first-run FAIL artifacts `L2-07-matrix-fail.log`, `matrix-first-final-run.tsv`, `test-matrix-first-final-run.json`.

---

This deliverable is derived from recorded evidence. A document's existence does not by itself prove control operation or control effectiveness (§16.1). Internal assessment is not external certification (§16.5).
