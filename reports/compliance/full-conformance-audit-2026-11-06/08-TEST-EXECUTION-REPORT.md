# 测试执行报告

- **Document:** `8/14` of §11 (14 mandated deliverables)
- **Generated:** 2026-11-09T05:04:20Z
- **Uter commit SHA:** `ec6501adceb008d46140a7e5ab6508eb78006731`
- **UAES commit SHA:** `0c9386b192090e901ccc5de6df1f2aebe3f5c618`
- **Execution environment:** macOS-26.7.2-x86_64-i386-64bit-Mach-O
- **Collector:** WorkBuddy (Tencent Hunyuan Hy)
- **Evidence root:** `reports/compliance/full-conformance-audit-2026-11-06/evidence/`

> 本文件由真实仓库状态与真实命令退出码生成。未执行的验证一律记为 `NOT_RUN` / `BLOCKED`，
> 绝不以文档、代码改动或 Agent 自述代替工程验证（§12 / §13）。

---


本报告列出全部真实执行、同 SHA 既有执行以及未执行项，三者严格区分。

### 本轮真实重跑（22 条）

| ID | 命令 | cwd | exit | 状态 | 开始时间 | 日志 SHA-256(前16) |
|---|---|---|---|---|---|---|
| EV-01 | `bash scripts/quality/ai-specs-check.sh` | . | 0 | PASS | 2026-11-07T02:40:19Z | `ef600323cbfefd68` |
| EV-02 | `ruby scripts/quality/test-ai-governance-policy.rb` | . | 0 | PASS | 2026-11-07T02:40:21Z | `c00ad0d7e5ed7ee6` |
| EV-03 | `bash scripts/quality/uaes-pin-check.sh` | . | 0 | PASS | 2026-11-07T02:40:21Z | `6434610518e080a5` |
| EV-04 | `ruby scripts/quality/test-uaes-pin-check.rb` | . | 1 | FAIL | 2026-11-07T02:40:25Z | `fb9caa4d4c11d818` |
| EV-05 | `bash scripts/quality/uaes-integration-check.sh` | . | 0 | PASS | 2026-11-07T02:40:57Z | `9598eb44dfe6f434` |
| EV-06 | `ruby scripts/quality/test-uaes-integration-check.rb` | . | 0 | PASS | 2026-11-07T02:40:58Z | `6cbf2dabd1ea185a` |
| EV-09 | `ruby scripts/quality/test-uter-governance-boundaries.rb` | . | 0 | PASS | 2026-11-07T02:41:19Z | `7e22e647e192acb1` |
| EV-10 | `ruby scripts/quality/test-uaes-manual-acceptance-boundary.rb` | . | 0 | PASS | 2026-11-07T02:41:36Z | `4d5ef372460a8dfc` |
| EV-11 | `python3 scripts/quality/uaes-manual-acceptance.py --verify-only` | . | 0 | PASS | 2026-11-07T02:41:42Z | `5c84db0c5d3ca2d9` |
| EV-12 | `bun run typecheck` | web | 0 | PASS | 2026-11-07T02:41:42Z | `678325bab2f77421` |
| EV-13 | `bun run lint` | web | 0 | PASS | 2026-11-07T02:41:57Z | `f9b10bcd68ff07c8` |
| EV-14 | `bun run format:check` | web | 0 | PASS | 2026-11-07T02:42:01Z | `1c1c3ef2f4c803f3` |
| EV-15 | `bun run design:tokens:check` | web | 0 | PASS | 2026-11-07T02:42:09Z | `eda491cdb75240b0` |
| EV-16 | `bun run test` | web | 1 | FAIL | 2026-11-07T02:42:09Z | `09a459973edcf843` |
| EV-17 | `GOWORK=off go build ./...` | . | 1 | FAIL | 2026-11-07T02:53:37Z | `41685a35dd931574` |
| EV-18 | `GOWORK=off go test ./...` | . | 1 | FAIL | 2026-11-07T02:53:46Z | `22793525493dc472` |
| EV-19 | `GOWORK=off go test -race -count=1 ./model/ -run 'TestRechargeEpayConcurrentCallbacksCredit` | . | 0 | PASS | 2026-11-07T02:54:08Z | `d836a3e5ea4d131d` |
| EV-20 | `GOWORK=off govulncheck ./...` | . | 0 | PASS | 2026-11-07T02:54:21Z | `7b67ac8321683c41` |
| EV-21 | `tmp=$(mktemp -d /tmp/uaes-gitleaks-XXXXXX) && git archive HEAD \| tar -x -C "$tmp" && (cd "` | . | 0 | PASS | 2026-11-07T02:54:41Z | `e0d1b71bddf1e1da` |
| EV-22 | `bun run knip` | web | 0 | PASS | 2026-11-07T02:54:51Z | `a863fecfcf39641c` |
| EV-23 | `bun run test:visual` | web | 0 | PASS | 2026-11-07T02:54:57Z | `3347c03e123a3861` |
| EV-24 | `GOWORK=off go test -count=1 -coverprofile='/Users/lincolnhu/uter/.quality/.state/fca-cover` | . | 1 | FAIL | 2026-11-07T02:55:06Z | `1e2a5b609341f9c4` |


### 同 SHA 既有真实执行（14 条，PRIOR_REAL_RUN_AT_SAME_COMMIT）

| ID | 状态 | exit | 命令 | 日志 |
|---|---|---|---|---|
| MA-01 | PASS | 0 | `bun run test:visual` | `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/MA-01.log` |
| MA-02 | PASS | 0 | `GOWORK=off govulncheck ./...` | `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/MA-02.log` |
| MA-03 | PASS | 0 | `GOWORK=off govulncheck ./...` | `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/MA-03.log` |
| MA-04 | PASS | 0 | `GOWORK=off govulncheck ./...` | `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/MA-04.log` |
| MA-05 | PASS | 0 | `GOWORK=off govulncheck ./...` | `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/MA-05.log` |
| MA-06 | PASS | 0 | `tmp=$(mktemp -d /tmp/uaes-gitleaks-XXXXXX) && git archive HEAD \| tar -x -C "$tmp" && (cd "` | `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/MA-06.log` |
| MA-07 | PASS | 0 | `out=$(git ls-files '.env' '*.db' '*.sqlite3' \| head -3); if [ -n "$out" ]; then echo "$out` | `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/MA-07.log` |
| MA-08 | PASS | 0 | `GOWORK=off go test -race -count=1 ./model/ -run 'TestRechargeEpayConcurrentCallbacksCredit` | `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/MA-08.log` |
| MA-09 | PASS | 0 | `bun run knip` | `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/MA-09.log` |
| MA-10 | PASS | 0 | `if [ ! -d node_modules ]; then echo 'NOT_RUN: docs-web/node_modules missing'; exit 2; fi; ` | `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/MA-10.log` |
| MA-11 | PASS | 0 | `if [ ! -d node_modules ]; then echo 'NOT_RUN: electron/node_modules missing'; exit 2; fi; ` | `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/MA-11.log` |
| MA-12 | PASS | 0 | `if [ -d node_modules/@axe-core ] \|\| [ -d node_modules/axe-core ]; then echo 'axe toolchain` | `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/MA-12.log` |
| MA-13 | PASS | 0 | `GOWORK=off go test -count=1 -coverprofile='/Users/lincolnhu/uter/.quality/.state/manual-ac` | `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/MA-13.log` |
| MA-14 | PASS | 0 | `bash scripts/quality/ai-specs-check.sh` | `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/MA-14.log` |


### 未执行 / 不可用（9 项）

| ID | 类别 | 状态 | 原因 |
|---|---|---|---|
| NR-01 | DAST / 动态应用安全测试 | NOT_RUN | DAST、渗透与 API 安全测试需一个已授权的运行中目标环境与书面授权；本机只有源码与测试套件。 |
| NR-02 | 渗透测试 | NOT_RUN | 同上；未授权对运行服务做主动探测会越出风险边界（§13）。 |
| NR-03 | API 安全测试 | NOT_RUN | 需要授权运行实例、真实凭据与测试数据；当前无该环境。 |
| NR-04 | 权限与访问控制端到端测试 | NOT_RUN | 需要真实账号体系与多租户环境；不得使用测试号绕过登录（项目红线），且不得创建任何账号。 |
| NR-05 | 三数据库迁移验证 | NOT_RUN | 需要 MySQL / PostgreSQL / SQLite 三套真实实例与迁移快照。 |
| NR-06 | 性能与压力测试 | NOT_RUN | 无 k6/wrk/locust 类工具链与性能基线；不得用替代命令冒充。 |
| NR-07 | 故障恢复 / DR 演练 | NOT_RUN | 需要生产等价环境、故障注入与恢复窗口授权。 |
| NR-08 | 备份与恢复测试 | NOT_RUN | 需要真实数据库备份与恢复目标实例。 |
| NR-09 | CI/CD 与发布流程真实执行 | NOT_RUN | 本地仅有 workflow 静态定义；未授权 push / PR / merge / deploy，无法产生真实 CI 运行记录。 |


### 最终矩阵（同 Commit SHA）

`ec6501adceb008d46140a7e5ab6508eb78006731` 的 `29/29 PASS` 来自
`reports/compliance/uaes-full-migration-2026-11-06/evidence/test-matrix.json`，
逐条原始日志在同级 `matrix/L*.log`。该矩阵是**域级**证据，
不能替代本审计 §3 的 2884 条逐条验证。

**不得把 BLOCKED / NOT RUN / NOT ASSESSED 视为 PASS（§13）。**
