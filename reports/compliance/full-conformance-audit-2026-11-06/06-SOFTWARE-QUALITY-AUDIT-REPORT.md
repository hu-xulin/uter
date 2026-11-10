# 软件质量审计报告（§6 质量部分）

- **Document:** `6/14` of §11 (14 mandated deliverables)
- **Generated:** 2026-11-09T05:04:20Z
- **Uter commit SHA:** `ec6501adceb008d46140a7e5ab6508eb78006731`
- **AES commit SHA:** `0c9386b192090e901ccc5de6df1f2aebe3f5c618`
- **Execution environment:** macOS-26.7.2-x86_64-i386-64bit-Mach-O
- **Collector:** WorkBuddy (Tencent Hunyuan Hy)
- **Evidence root:** `reports/compliance/full-conformance-audit-2026-11-06/evidence/`

> 本文件由真实仓库状态与真实命令退出码生成。未执行的验证一律记为 `NOT_RUN` / `BLOCKED`，
> 绝不以文档、代码改动或 Agent 自述代替工程验证（§12 / §13）。

---


| 指标 | 值 |
|---|---|
| 本轮真实重跑命令 | 22 |
| PASS / FAIL / TIMEOUT | 17 / 5 / 0 |
| 非 PASS 编号 | `EV-04, EV-16, EV-17, EV-18, EV-24` |
| 同 SHA 既有真实用例 | 14 |
| 既有非 PASS | `` |
| NOT_RUN 项 | 9 |
| 已执行但非 PASS 项（EXECUTED_NOT_PASS） | 2 |
| 最终 29 条测试矩阵（同 SHA） | 28/29 PASS |

## 本轮重跑明细（真实退出码）

| ID | 类别 | 命令 | exit | 结果 | 耗时(s) | 原始日志 |
|---|---|---|---|---|---|---|
| EV-01 | compile/static | `bash scripts/quality/ai-specs-check.sh` | 0 | PASS | 1.837 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-01.log` |
| EV-02 | unit | `ruby scripts/quality/test-ai-governance-policy.rb` | 0 | PASS | 0.542 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-02.log` |
| EV-03 | config | `bash scripts/quality/aes-pin-check.sh` | 0 | PASS | 4.218 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-03.log` |
| EV-04 | unit | `ruby scripts/quality/test-aes-pin-check.rb` | 1 | FAIL | 31.945 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-04.log` |
| EV-05 | config | `bash scripts/quality/aes-integration-check.sh` | 0 | PASS | 1.159 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-05.log` |
| EV-06 | unit | `ruby scripts/quality/test-aes-integration-check.rb` | 0 | PASS | 20.217 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-06.log` |
| EV-09 | unit | `ruby scripts/quality/test-uter-governance-boundaries.rb` | 0 | PASS | 17.064 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-09.log` |
| EV-10 | unit | `ruby scripts/quality/test-aes-manual-acceptance-boundary.rb` | 0 | PASS | 6.246 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-10.log` |
| EV-11 | evidence | `python3 scripts/quality/aes-manual-acceptance.py --verify-only` | 0 | PASS | 0.257 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-11.log` |
| EV-12 | compile | `bun run typecheck` | 0 | PASS | 14.44 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-12.log` |
| EV-13 | static | `bun run lint` | 0 | PASS | 4.202 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-13.log` |
| EV-14 | static | `bun run format:check` | 0 | PASS | 7.771 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-14.log` |
| EV-15 | static | `bun run design:tokens:check` | 0 | PASS | 0.377 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-15.log` |
| EV-16 | unit | `bun run test` | 1 | FAIL | 687.706 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-16.log` |
| EV-17 | compile | `GOWORK=off go build ./...` | 1 | FAIL | 9.544 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-17.log` |
| EV-18 | integration | `GOWORK=off go test ./...` | 1 | FAIL | 21.359 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-18.log` |
| EV-19 | race | `GOWORK=off go test -race -count=1 ./model/ -run 'TestRechargeEpayConcurrentCallbacksCreditOnce\|TestRechargeOff` | 0 | PASS | 13.526 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-19.log` |
| EV-20 | dependency-vuln | `GOWORK=off govulncheck ./...` | 0 | PASS | 20.15 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-20.log` |
| EV-21 | secret | `tmp=$(mktemp -d /tmp/aes-gitleaks-XXXXXX) && git archive HEAD \| tar -x -C "$tmp" && (cd "$tmp" && gitleaks di` | 0 | PASS | 9.376 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-21.log` |
| EV-22 | static | `bun run knip` | 0 | PASS | 6.657 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-22.log` |
| EV-23 | visual | `bun run test:visual` | 0 | PASS | 8.159 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-23.log` |
| EV-24 | coverage | `GOWORK=off go test -count=1 -coverprofile='/Users/lincolnhu/uter/.quality/.state/fca-coverage.out' -timeout 60` | 1 | FAIL | 119.261 | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/EV-24.log` |


## 已执行但未通过的验证（EXECUTED_NOT_PASS，绝不计为 PASS）

这些项目**真实执行过**，工具链在位。此前被记为 `NOT_RUN` 并附「缺工具链」理由，
经 2026-11-07 实跑推翻，故改为如实记录执行结果。

| ID | 类别 | 真实执行结果与根因 | 要求 |
|---|---|---|---|
| EX-10 | 端到端 Playwright 视觉回归（真实执行） | 命令 `bun run test:visual:e2e` 真实执行：19 passed / 10 failed (3.0m)。Playwright 与 chromium-1248 均在本机可用，此前的 NOT_RUN 理由（缺浏览器二进制）已被推翻。10 个失败均为 `expect(page).toHaveScreenshot(expected)` 像素基线不匹配，属基线漂移，需按批准流程更新快照后复跑，不得直接 --update-snapshots 掩盖。 | AES P09 / §6 |
| EX-11 | axe 无障碍扫描（真实执行） | 命令 `bun run test:axe` 真实执行：8 passed / 5 failed / 1 skipped (1.8m)。此前的 NOT_RUN 理由（web/node_modules 下无 @axe-core）不成立：@axe-core/cli、@axe-core/playwright、@axe-core/webdriverjs 均已安装。5 个失败全部同源：/about、/docs、/privacy-policy、/user-agreement、/recharge-agreement 的文档站 iframe 内 `[data-docs-sidebar-search]` 触发 serious/label-content-name-mismatch。根因已定位：:3000 由 launchd 托管，运行中的 uter-bin 编译于 2026-11-04 09:21，go:embed 固化了当时的 web/dist，因此 2026-11-06 18:11 的源码修复（kbd 加 aria-hidden）未被伺服；产物 web/dist/docs-content 内代码本身是正确的。需重建二进制后复跑。 | AES P05/P09 / §6 |


## 质量结论

编译、类型检查、lint、格式、单元测试、Go 全量测试、竞态测试、覆盖率门禁的
真实结果以本表为准；任何 FAIL 都保留 OPEN，不改写为 PASS。
`knip` / `gitleaks` 属于安全与静态技术债，见 `07-SECURITY-RELIABILITY-AUDIT-REPORT.md`。
软件质量层面**不足以**支持 `CONFORMANT`：域级命令只是 INDIRECT 证据。
