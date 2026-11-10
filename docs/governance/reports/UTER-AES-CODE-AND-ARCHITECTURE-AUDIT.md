# Uter 代码与架构审计报告（PROVISIONAL，按 AES P04/P05/P06/P07/P09/P10）

- 执行时间：2026-11-10 GMT+8 · `/Users/lincolnhu/uter` @ `main 775e9eb50` · 产品版本 `v1.5.16`
- 方法：真实代码盘点 + 真实 `go test` 执行；**不把历史对话或产品文档当作已实现功能**。
- 因 AES 基线未批准，本报告为预审，不构成正式合规结论。

## 1. 真实业务模块盘点（5.3）

| 目录 | Go 文件数 |
|---|---:|
| `controller/` | 206 |
| `model/` | 193 |
| `service/` | 145 |
| `common/` | 98 |
| `middleware/` | 57 |
| `relay/` | 35 |
| `constant/` | 15 |
| `dto/` | 8 |

实际发现的业务代码文件（非文档声明）：

| 业务域 | 真实文件证据 |
|---|---|
| 充值 / 支付 | `controller/topup.go`、`topup_alipay.go`、`topup_wechat.go`、`topup_creem.go`、`topup_waffo_pancake.go`、`topup_amount_match_test.go`、`topup_cn_amount_snapshot_test.go` |
| 支付回调 | `controller/payment_webhook_availability.go`、`topup_callback_security_matrix_test.go`、`topup_gateway_contract_test.go` |
| 退款 / 恢复 | `controller/refund_intent_recovery_task.go`、`midjourney_refund_recovery_task.go`、`midjourney_refund_outbox_task.go` |
| 账单 / Token 计费 | `controller/billing.go`、`channel-billing.go`、`token.go`、`token_limit_test.go`、`billing_test.go` |
| 订阅支付 | `subscription_payment_creem.go`、`subscription_payment_epay.go`、`subscription_payment_waffo_pancake.go` |
| 异步任务 / 插件 | `controller/task.go`、`task_plugin_*.go`、`system_task_handlers.go` |
| 认证 / 账户 | `controller/access_token.go`、`user.go`、`security_account_test.go`、`auth_flow_test.go`、`security_enrollment_test.go` |
| 模型 / 供应商 | `controller/model_*.go`、`channel_*.go`、`model_management_test.go` |

## 2. 架构审计（5.4，P04）

- 前后端：Go 后端（`main.go` + `go.mod`）+ React/Web（`web/`）+ Electron（`electron/`）+ 文档站（`docs-web/`）。
- 模块边界：controller / service / model / relay / middleware / dto 分层清晰（文件级证据）。
- 依赖：`go.mod`（7030 字节）、`go.sum`（310KB）；`web/` 独立 `package.json` 生态。
- 数据流 / 事务 / 并发：`grep` 到 `Begin()`、`sync.Mutex`、`optimistic`、`FOR UPDATE`、`outbox` 等关键字分布于 controller/model/common；`midjourney_refund_outbox_task.go` 为可靠事件机制的真实实现证据。
- 架构决策：`docs/adr/0001-uter-design-system-single-source-of-truth.md`。
- **未验证项**：数据库迁移矩阵、缓存、消息与异步任务的全链路故障恢复、并发竞态的专项压测、技术债清单 → `UNKNOWN`，不判 PASS。

## 3. 设计与跨平台（5.5，P05 / P07）

- 唯一真源文档：`docs/design-system/UTER-DESIGN-SYSTEM-3.0.md`、`showcase-3.0.html`、`UTER Design Compliance Audit.md`。
- **实际代码使用证据**：`web/src` 中 **86 个文件**使用 design token（`var(--…)` / `--uter-` / `design-token`）→ 不是仅有文档。
- 旧版设计规范覆盖现行规范：未发现明确证据，但 `docs/adr/0001-*` 处于用户未提交修改状态，本次未做视觉回归比对 → `UNKNOWN`。
- 平台：PC Web / H5 / Electron 有代码目录；Android / iOS / HarmonyOS 未在本仓库发现原生工程 → 按实际情况记 `NOT_APPLICABLE`（需项目所有者确认），不计入 COMPLIANT。

## 4. UEQE 与软件工程（5.6，P06 / P09）

| 引擎 | 证据 | 结果 |
|---|---|---|
| Code Review | `uaes/standards/engineering-quality/CODE-REVIEW-STANDARD.md`、`golangci-lint`、`gofmt` 在 change-impact 的 19 条命令中列出 | 文件层存在 |
| Automated Testing | `AUTOMATED-TEST-STANDARD.md`；`go test`、`bun run test`、`e2e/` | 见下实跑 |
| Auto-Fix | `AUTO-FIX-STANDARD.md` | 文件层存在，未实测闭环 |
| Quality Gate | `QUALITY-GATE-STANDARD.md`、`scripts/coverage-gate.sh`、`scripts/verify-all.sh`、`release-gate.yml` | 文件层存在 |

**真实测试执行（本次实跑）**：

| 命令 | 结果 |
|---|---|
| `go test ./common/... -count=1` | `ok common 3.544s` / `ok common/limiter 1.212s` → **EXIT=0** ✅ |
| `go test ./controller/... -run 'TopUp\|Refund\|Callback\|Billing\|Security\|Outbox\|Idempot' -count=1` | `ok controller 26.320s` → **EXIT=0** ✅ |
| `node --test tools/aes/integration-adapter.test.mjs` | `23 tests / 17 pass / **6 fail**` → **EXIT=1** ❌ |
| `bash scripts/quality/aes-pin-check.sh` | `PASS scope=static-integrity` ✅ |
| `bash scripts/quality/aes-integration-check.sh` | PASS（自述 `static wiring only; makes no conformance claim`） |

> **未运行** `scripts/quality/full-conformance-audit.py all`：该脚本写入 `reports/compliance/full-conformance-audit-2026-11-06/`，而该目录内文件**全部处于用户未提交修改状态**；按 2.2 不得覆盖用户修改，故本次跳过，相关结论记 `UNKNOWN`。这是一条明确的安全阻断，不是遗漏。

覆盖率：`coverage.out`（3.2MB）存在，但本次未重跑全量覆盖率门禁 → `UNKNOWN`。

## 5. 安全与可靠性专项（5.7，P10）

| 关注点 | 真实代码/测试证据 | 判定 |
|---|---|---|
| 重复支付回调 / 回调安全矩阵 | `controller/topup_callback_security_matrix_test.go`、`payment_webhook_availability_test.go` | 文件存在，本次未逐用例重放 |
| 重复退款 / 退款恢复 | `refund_intent_recovery_task.go`、`midjourney_refund_recovery_task.go` | 文件存在 |
| Outbox 可靠事件 | `midjourney_refund_outbox_task.go` | 文件存在 |
| 幂等 / 并发 / 事务 | `topup_creem_security_test.go`、`grep` 到事务与锁关键字 | 文件存在 |
| 资金相关测试实跑 | `go test ./controller/... -run …` → `ok 26.320s` | ✅ 局部通过 |
| 密钥/敏感信息 | `.quality/gitleaks.toml`、secret-scan 命令列于 change-impact | 未实跑 |
| 数据对账 / 备份恢复 / 依赖漏洞 | 未在本次找到实跑证据 | `UNKNOWN` |

**未连接任何真实支付渠道、未操作真实用户余额或生产资金**（符合 5.7 约束）。

## 6. DevOps 与生命周期（5.8，P11 / P12）

| 触发器 | 文件 |
|---|---|
| push / PR | `ci.yml`、`release.yml`、`electron-build.yml`、`docker-build.yml` |
| 每日全量审计 | `nightly-full-audit.yml` → `cron '0 19 * * *'` |
| 每周安全审计 | `weekly-security-audit.yml` → `cron '0 19 * * 1'` |
| 发布门禁 | `release-gate.yml`（`workflow_dispatch`） |

- 配置齐备，但**本次未 push、未触发远程 CI**，不得声称定时任务已运行。
- 数据库迁移：`database-migration-matrix.yml` 在 AES 侧；Uter `deploy/` 目录存在，未实跑迁移。
- 废弃接口治理：`.aes/API-LEGACY-ENDPOINT-DEPRECATION-AUDIT-2026-11-05.md`（处于用户修改状态）。
- 是否存绕过质量门禁入口：`aes-integration-check.sh` 静态检查 PASS，但 14 域门禁未执行 → **无法证明运行时无绕过**，记 `UNKNOWN`。

## 7. 结论

- 真实代码与业务模块**确实存在**，关键资金流程有实现与测试文件，局部测试实跑通过。
- 但 UEQE 集成适配器 6 项测试失败（P1）、全量符合性审计因保护用户修改未执行、覆盖率/安全专项/跨端实机/定时任务均未验证。
- **不得因「文件存在 + 局部测试通过」判定 Uter 全面符合 AES。**

`CODE_ARCH_STATUS = PROVISIONAL / NOT_VERIFIED`，详见 `UTER-AES-FINAL-ACCEPTANCE-REPORT.md`。
