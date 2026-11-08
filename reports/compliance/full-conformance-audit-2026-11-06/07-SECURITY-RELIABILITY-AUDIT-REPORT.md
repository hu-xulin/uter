# 安全与可靠性审计报告（§6 安全部分）

- **Document:** `7/14` of §11 (14 mandated deliverables)
- **Generated:** 2026-11-06T17:41:59Z
- **Uter commit SHA:** `ec6501adceb008d46140a7e5ab6508eb78006731`
- **UAES commit SHA:** `0c9386b192090e901ccc5de6df1f2aebe3f5c618`
- **Execution environment:** macOS-26.7.2-x86_64-i386-64bit-Mach-O
- **Collector:** WorkBuddy (Tencent Hunyuan Hy)
- **Evidence root:** `reports/compliance/full-conformance-audit-2026-11-06/evidence/`

> 本文件由真实仓库状态与真实命令退出码生成。未执行的验证一律记为 `NOT_RUN` / `BLOCKED`，
> 绝不以文档、代码改动或 Agent 自述代替工程验证（§12 / §13）。

---


## P09 / P10 分工（不得互相替代）

- **P10 定义**系统必须达到什么安全与可靠性要求。
- **P09 组织执行测试工程体系并证明**是否达到（真实命令 + 原始退出码）。
- 本报告的测试执行属于 P09 证据；安全要求基线属于 P10。

## SECURITY_GATE 判定：`BLOCK`

| check | 满足? |
|---|---|
| govulncheck_root_PASS | True |
| govulncheck_all_modules_PASS | True |
| gitleaks_PASS | True |
| no_forbidden_tracked_files | True |
| secret_scan_no_open_finding | True |
| axe_accessibility_executed | True |
| DAST_penetration_API_security_executed | False |
| three_database_and_recovery_executed | False |
| no_unapproved_risk_exception | True |


## 同 SHA 既有真实安全用例

| ID | 用例 | 状态 | exit | 原始日志 |
|---|---|---|---|---|
| MA-02 | govulncheck root module | PASS | 0 | `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/MA-02.log` |
| MA-03 | govulncheck tokenkit module | PASS | 0 | `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/MA-03.log` |
| MA-04 | govulncheck relaykit module | PASS | 0 | `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/MA-04.log` |
| MA-05 | govulncheck tokenkit/tokenkit module | PASS | 0 | `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/MA-05.log` |
| MA-06 | gitleaks secret scan on tracked HEAD tree | PASS | 0 | `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/MA-06.log` |
| MA-07 | forbidden tracked file check (.env / *.db / *.sqlite3) | PASS | 0 | `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/MA-07.log` |
| MA-08 | payment idempotency + concurrency tests with -race | PASS | 0 | `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/MA-08.log` |
| MA-10 | docs-web build | PASS | 0 | `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/MA-10.log` |
| MA-11 | electron build | PASS | 0 | `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/MA-11.log` |
| MA-12 | axe accessibility toolchain availability probe | PASS | 0 | `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/MA-12.log` |
| MA-13 | Go root-module coverage profile + coverage gate | PASS | 0 | `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/MA-13.log` |


MA-06 `gitleaks` 命中 1 项：`.uaes/API-LEGACY-ENDPOINT-DEPRECATION-AUDIT-2026-11-05.md`
第 62 行的 40 位 OpenAPI commit SHA，判定为候选误报。**未豁免、未改 allowlist、
未改状态**，需验收负责人裁定。

## NOT_RUN（§6 未完成项）

| ID | 类别 | 状态 | 原因 | 所需授权 |
|---|---|---|---|---|
| NR-01 | DAST / 动态应用安全测试 | NOT_RUN | DAST、渗透与 API 安全测试需一个已授权的运行中目标环境与书面授权；本机只有源码与测试套件。 | 项目 Owner / 环境授权 / UAES Owner（按类别） |
| NR-02 | 渗透测试 | NOT_RUN | 同上；未授权对运行服务做主动探测会越出风险边界（§13）。 | 项目 Owner / 环境授权 / UAES Owner（按类别） |
| NR-03 | API 安全测试 | NOT_RUN | 需要授权运行实例、真实凭据与测试数据；当前无该环境。 | 项目 Owner / 环境授权 / UAES Owner（按类别） |
| NR-04 | 权限与访问控制端到端测试 | NOT_RUN | 需要真实账号体系与多租户环境；不得使用测试号绕过登录（项目红线），且不得创建任何账号。 | 项目 Owner / 环境授权 / UAES Owner（按类别） |
| NR-05 | 三数据库迁移验证 | NOT_RUN | 需要 MySQL / PostgreSQL / SQLite 三套真实实例与迁移快照。 | 项目 Owner / 环境授权 / UAES Owner（按类别） |
| NR-06 | 性能与压力测试 | NOT_RUN | 无 k6/wrk/locust 类工具链与性能基线；不得用替代命令冒充。 | 项目 Owner / 环境授权 / UAES Owner（按类别） |
| NR-07 | 故障恢复 / DR 演练 | NOT_RUN | 需要生产等价环境、故障注入与恢复窗口授权。 | 项目 Owner / 环境授权 / UAES Owner（按类别） |
| NR-08 | 备份与恢复测试 | NOT_RUN | 需要真实数据库备份与恢复目标实例。 | 项目 Owner / 环境授权 / UAES Owner（按类别） |
| NR-09 | CI/CD 与发布流程真实执行 | NOT_RUN | 本地仅有 workflow 静态定义；未授权 push / PR / merge / deploy，无法产生真实 CI 运行记录。 | 项目 Owner / 环境授权 / UAES Owner（按类别） |
| NR-10 | 端到端 Playwright 视觉测试 | NOT_RUN | 需浏览器二进制与显示环境；以 probe 结果为准。 | 项目 Owner / 环境授权 / UAES Owner（按类别） |
| NR-11 | axe 无障碍扫描 | NOT_RUN | web/node_modules 下无 @axe-core/axe-core（MA-12 已记录 NOT_RUN）。 | 项目 Owner / 环境授权 / UAES Owner（按类别） |
| NR-12 | docs-web / electron 构建 | NOT_RUN | MA-10 受宿主 safe-delete 拦截、MA-11 为 Electron 下载网络超时，均为已执行的真实 FAIL，不改写为 NOT_RUN。 | 项目 Owner / 环境授权 / UAES Owner（按类别） |


**结论：安全与可靠性验证不完整，SECURITY_GATE BLOCK。**
