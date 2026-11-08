# 软件质量审计报告（§6 质量部分）

- **Document:** `6/14` of §11 (14 mandated deliverables)
- **Generated:** 2026-11-06T17:41:59Z
- **Uter commit SHA:** `ec6501adceb008d46140a7e5ab6508eb78006731`
- **UAES commit SHA:** `0c9386b192090e901ccc5de6df1f2aebe3f5c618`
- **Execution environment:** macOS-26.7.2-x86_64-i386-64bit-Mach-O
- **Collector:** WorkBuddy (Tencent Hunyuan Hy)
- **Evidence root:** `reports/compliance/full-conformance-audit-2026-11-06/evidence/`

> 本文件由真实仓库状态与真实命令退出码生成。未执行的验证一律记为 `NOT_RUN` / `BLOCKED`，
> 绝不以文档、代码改动或 Agent 自述代替工程验证（§12 / §13）。

---


| 指标 | 值 |
|---|---|
| 本轮真实重跑命令 | 22 |
| PASS / FAIL / TIMEOUT | 22 / 0 / 0 |
| 非 PASS 编号 | `` |
| 同 SHA 既有真实用例 | 14 |
| 既有非 PASS | `` |
| NOT_RUN 项 | 12 |
| 最终 29 条测试矩阵（同 SHA） | 28/29 PASS |

## 本轮重跑明细（真实退出码）

| ID | 类别 | 命令 | exit | 结果 | 耗时(s) | 原始日志 |
|---|---|---|---|---|---|---|
| EV-01 | compile/static | `bash scripts/quality/ai-specs-check.sh` | 0 | PASS | 0.702 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-01.log` |
| EV-02 | unit | `ruby scripts/quality/test-ai-governance-policy.rb` | 0 | PASS | 0.201 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-02.log` |
| EV-03 | config | `bash scripts/quality/uaes-pin-check.sh` | 0 | PASS | 1.662 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-03.log` |
| EV-04 | unit | `ruby scripts/quality/test-uaes-pin-check.rb` | 0 | PASS | 19.531 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-04.log` |
| EV-05 | config | `bash scripts/quality/uaes-integration-check.sh` | 0 | PASS | 0.836 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-05.log` |
| EV-06 | unit | `ruby scripts/quality/test-uaes-integration-check.rb` | 0 | PASS | 9.596 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-06.log` |
| EV-09 | unit | `ruby scripts/quality/test-uter-governance-boundaries.rb` | 0 | PASS | 5.609 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-09.log` |
| EV-10 | unit | `ruby scripts/quality/test-uaes-manual-acceptance-boundary.rb` | 0 | PASS | 3.041 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-10.log` |
| EV-11 | evidence | `python3 scripts/quality/uaes-manual-acceptance.py --verify-only` | 0 | PASS | 0.12 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-11.log` |
| EV-12 | compile | `bun run typecheck` | 0 | PASS | 5.963 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-12.log` |
| EV-13 | static | `bun run lint` | 0 | PASS | 1.988 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-13.log` |
| EV-14 | static | `bun run format:check` | 0 | PASS | 2.782 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-14.log` |
| EV-15 | static | `bun run design:tokens:check` | 0 | PASS | 0.194 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-15.log` |
| EV-16 | unit | `bun run test` | 0 | PASS | 270.384 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-16.log` |
| EV-17 | compile | `GOWORK=off go build ./...` | 0 | PASS | 25.399 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-17.log` |
| EV-18 | integration | `GOWORK=off go test ./...` | 0 | PASS | 17.774 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-18.log` |
| EV-19 | race | `GOWORK=off go test -race -count=1 ./model/ -run 'TestRechargeEpayConcurrentCallbacksCreditOnce\|TestRechargeOff` | 0 | PASS | 9.532 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-19.log` |
| EV-20 | dependency-vuln | `GOWORK=off govulncheck ./...` | 0 | PASS | 26.254 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-20.log` |
| EV-21 | secret | `tmp=$(mktemp -d /tmp/uaes-gitleaks-XXXXXX) && git archive HEAD \| tar -x -C "$tmp" && (cd "$tmp" && gitleaks di` | 0 | PASS | 5.741 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-21.log` |
| EV-22 | static | `bun run knip` | 0 | PASS | 4.811 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-22.log` |
| EV-23 | visual | `bun run test:visual` | 0 | PASS | 8.626 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-23.log` |
| EV-24 | coverage | `GOWORK=off go test -count=1 -coverprofile='/Users/lincolnhu/uter/.quality/.state/fca-coverage.out' -timeout 60` | 0 | PASS | 107.399 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-24.log` |


## 质量结论

编译、类型检查、lint、格式、单元测试、Go 全量测试、竞态测试、覆盖率门禁的
真实结果以本表为准；任何 FAIL 都保留 OPEN，不改写为 PASS。
`knip` / `gitleaks` 属于安全与静态技术债，见 `07-SECURITY-RELIABILITY-AUDIT-REPORT.md`。
软件质量层面**不足以**支持 `CONFORMANT`：域级命令只是 INDIRECT 证据。
