# UAP-05-002 — 自动化测试规范

**编号：** UAP-05-002
**标准编号：** UAP-05-002
**名称：** 自动化测试规范
**版本：** 1.0.0
**状态：** ACTIVE
**适用范围：** 约束 Uter 后端四个独立 Go 模块（`.` / `relaykit` / `tokenkit` / `tokenkit/tokenkit`）的 `*_test.go`、前端 `web/src/**/__tests__/*.test.ts`、`e2e/` 全链路用例与 `electron/` 的 `node --test` 用例；覆盖 `controller/`、`service/`、`model/`、`common/`、`relay/`、`middleware/` 的单元/集成/回归测试与 `web/src/features/wallet/` 的支付回跳测试。执行器为 `quality.testing`，验证器为 `quality.test_integrity`。
**关键级别：** P0
**依赖标准：** UAP-05-001

## 规范目标
本规范把 Uter 已存在的真实测试资产（`common/quota_math_test.go`、资金回调契约测试、`web/src/features/wallet/lib/__tests__/alipay-return.test.ts`、`e2e/` 计费全链路）纳入单元 / 集成 / 端到端 / 回归四层可执行体系，要求每条测试结果携带真实命令、退出码与证据。测试必须覆盖正常、异常、边界、权限、并发与幂等场景，使用 `httptest` 模拟网关与隔离内存数据库，禁止依赖真实资金交易，禁止静默忽略失败，覆盖率按 `coverage.out` 实际结果报告而非用数字替代测试有效性。

## 强制性要求
1. 测试必须与实际功能对应。
2. 单元测试验证独立逻辑。
3. 集成测试验证模块和外部接口边界。
4. 端到端测试验证完整用户流程。
5. 回归测试验证既有功能不被破坏。
6. 必须覆盖正常、异常、边界和权限场景。
7. 必须覆盖关键并发和幂等场景。
8. 测试必须可重复执行。
9. 测试数据必须隔离。
10. 测试不得依赖真实资金交易。
11. 测试失败不得被静默忽略。
12. 测试结果必须记录命令、退出码和证据。
13. 覆盖率必须按实际结果报告，不得伪造。
14. 不能只用覆盖率数字代替测试有效性。

## Uter 落地细则
- 单元测试真实入口：后端 `common/quota_math_test.go` 验证 `common/quota_math.go` 的 `QuotaFromFloat` / `QuotaRound`（half-away-from-zero）/ `QuotaFromDecimal` / `WalletQuotaFromDecimalStrict` 与 `*Checked` 变体的饱和行为；`relay/helper/openai_image_request_test.go`、`relay/common/relay_utils_test.go` 按 `AGENTS.md` Billing safety invariants 保护请求量纲边界；前端用 Vitest `*.test.ts` 测纯逻辑（见 `web/AGENTS.md` §3.14）。
- 集成测试真实例子：`controller/topup_gateway_contract_test.go` 用 `go/ast` + `go/parser` 静态解析 `controller/` 下 `model.Recharge*` 调用点，固化 9 个网关回调（EpayNotify / AlipayNotify / QueryAlipayOrder / QueryWechatOrder / WechatPayNotify / StripeWebhook / WaffoWebhook / WaffoPancakeWebhook / CreemWebhook）的「验签 → 幂等 → 实付金额比对 → 入账」三件套顺序，并以 `TestGatewayCallbackRegistryCoversAllRechargePaths` 防止新增网关漏登记。
- 端到端测试真实入口：`.github/workflows/ci.yml` 的 `race` job 执行 `go test -race -count=1 ./e2e/...`（组织计费全链路），`release-gate.yml` 同样把测试跑在即将发布的 commit 上；前端 E2E 由 `web/e2e/visual/` 的 Playwright 真实路由用例承担（`AGENTS.md` Design System Enforcement 的 track 2）。
- 回归测试真实入口：`go test -race -count=1 ./service/... ./relay/... ./middleware/... ./model/...` 覆盖并发敏感的计费/钱包/权限/中继包；`service/dreamrouter_snapshot_test.go`、`model/vendor_icon_test.go` 与 `controller/return_path.go` 对应的回跳路径用例保护既有契约不被破坏。
- 正常 / 异常 / 边界 / 权限四场景的真实断言在 `controller/topup_alipay_query_test.go`：`TRADE_SUCCESS` 入账、`total_amount "0.01"` 与下单快照 `"10.00"` 不符时拒绝入账且订单保持 `TopUpStatusPending`、`TRADE_CLOSED` 落 `TopUpStatusExpired`、拿他人 `trade_no` 返回「订单不存在」；边界由 `common/quota_math.go` 的 `MaxQuota = math.MaxInt32` 与 `MaxWalletQuota = 1<<53 - 1`（JavaScript 安全整数域）覆盖。
- 并发与幂等场景：`controller/topup_alipay_query_test.go` 的 `TestQueryAlipayOrderIsIdempotentAfterCallback` 连续两次主动查单断言额度不变；`service/alipay_query_test.go` 的 `TestAlipayQueryOrderRejectsBadSignature` 用另一把 RSA 私钥签名触发 `signature invalid`；`.github/workflows/ci.yml` 的 `-race` 对 `model.runCacheSync` / `perfmetrics.WaitRecordForTest()` 屏障后的用例做竞争检测。
- 测试可重复执行：`make test` 覆盖四个 Go 模块，`bun install --frozen-lockfile` 锁定前端依赖，`go test -race -count=1` 禁用缓存；`httptest.NewServer` / `httptest.NewRecorder` / `gin.CreateTestContext` 提供确定性替身，`t.Cleanup` 还原 `operation_setting.AlipayGateway` 等全局量（见 `controller/topup_alipay_query_test.go:76-101`）。
- 测试数据隔离：`topup_alipay_query_test.go` 的 `setupAlipayQueryEnv` / `setupCallbackSecurityDB` 使用内存库并指向本地 mock 网关，`t.Cleanup(gateway.Close)` 回收；`.uap/config/permission-policy.yaml` 的 `test_environment` 带 `isolated_environment_only: true`；`web/AGENTS.md` §3.14 要求用例内部独立初始化并清理全局状态、缓存、localStorage、mock 与定时器。
- 禁止真实资金交易：`.uap/config/permission-policy.yaml` 显式 `real_payment: effect: deny`（`All payment verification must use simulation`）与 `real_refund: effect: deny`；`service/alipay_query_test.go`、`controller/topup_alipay_query_test.go` 全部用 `httptest.NewServer` 模拟 `alipay.trade.query` 响应与 RSA2 签名，`.uap/config/workflow-registry.yaml` 的 `uap-financial-verification` 标注 `environment: simulated_only`。
- 测试失败不得静默忽略：`./scripts/verify-all.sh` 任一 FAIL 即 `exit 1`，全量模式存在 SKIP 即 `exit 2`（`scripts/verify-all.sh:200-211`），并回显失败项复现命令；`AGENTS.md` Automated Quality Gates 规定「Non-zero exit is a stop condition, not a warning」。
- 测试结果必须记录命令、退出码和证据：`AGENTS.md` Verification Evidence 要求报告写明可复制命令原文、退出码、pass/fail 计数与失败测试名；`.uap/config/execution-mapping.yaml` 的 `evidence.directory: .uap/evidence` 与 `required_output.evidence_refs` 把结果绑定到证据 ID。
- 覆盖率按实际结果报告：`.github/workflows/ci.yml` 的 `coverage` job 用 `go test -covermode=set -coverprofile=coverage.out` 产出 `coverage.out`（独立模块用 `-covermode=atomic`），`go tool cover -func=coverage.out | tail -1` 输出真实值，再由 `./scripts/coverage-gate.sh coverage.out "$(go list -m)" controller=39 model=45 service=43 middleware=62` 设下限，禁止伪造。
- 不能只用覆盖率数字代替测试有效性：`AGENTS.md` Backend test quality 禁止「只提升覆盖率数字、证明代码恰好运行、锁定实现细节」的测试，禁止 smoke / sleep / timing / 随机输入 / 日志断言，要求确定性 table tests 与显式精确期望；`web/AGENTS.md` §3.14 禁止为覆盖率添加 smoke 测试，核心功能目标 80% 以上但强调业务路径与关键分支。
- 后端测试约定：`AGENTS.md` 要求新增或大幅重写的 Go 测试使用 `github.com/stretchr/testify/require`（setup 与致命断言）与 `assert`（非致命值检查），显式初始化数据库 / 请求上下文 / 用户组 / 设置 / 缓存状态；前端 `web/AGENTS.md` §3.14 要求测试放在模块专属 `__tests__/`、Arrange-Act-Assert 结构、不 mock 被测模块本身、异步测试不用固定 `sleep`。

## 执行流程
1. `uap-test-agent`（`.uap/engines/testing/index.mjs`，权限 `project_read/local_command/test_environment/evidence_write`）按 `.uap/config/workflow-registry.yaml` 的 `uap-quality-gate` 中 `unit_tests / integration_tests / end_to_end_tests` 步骤发起，读取 `AGENTS.md`、`web/AGENTS.md` 与本次 `changed_files` 计算测试范围。
2. 经 `.uap/runtime/_lib/yaml.mjs` 加载 `.uap/config/specification-registry.yaml`（确认 UAP-05-001 依赖已满足）、`execution-mapping.yaml`、`validator-registry.yaml`，生成 `scope` 与 `acceptance_criteria`。
3. 后端执行 `make test`（四模块）与 `go test -race -count=1 ./service/... ./relay/... ./middleware/... ./model/...`、`go test -race -count=1 ./e2e/...`；前端执行 `cd web && bun run test` 与 `bunx vitest run src/design-system/__tests__`。
4. 逐条采集命令原文、`exit_code`、耗时、stdout/stderr、失败测试名与 `coverage.out` 覆盖率数值；任一非零退出立即写入 `blocked_reasons`，不得静默忽略或降级为 PASS。
5. 结果由 `.uap/runtime/_lib/contract.mjs` 的 `executorResult()` 归一化，`validation_results` 留给独立验证器回填；`failure_propagation` 检查项确认失败确实向上传播。
6. 生成证据 `UAP-EVD-...` 落盘 `.uap/evidence/`，记录命令、退出码、时间、环境、输入、输出与日志引用，索引追加 `.uap/reports/EVIDENCE-INDEX.md`。
7. `quality.test_integrity` 验证器（`.uap/validators/quality/index.mjs`）执行 `test_execution` / `failure_propagation` / `evidence`，返回 `validatorResult()`。
8. 仅当 `executed=true && exit_code=0` 且无 `severity=BLOCKER` findings 时判定测试通过；否则 fail-closed 记 BLOCKED / FAILED，交由 `uap-defect-repair` 复验，并保留失败证据。

## 对应执行器
- 执行器 ID：`quality.testing`
- 实现路径：`.uap/engines/testing/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：按 `.uap/config/agent-registry.yaml` 的 `uap-test-agent` 与 `.uap/config/permission-policy.yaml`，需 `project_read`（读取测试文件与配置）、`local_command`（执行 `make test`、`go test -race`、`bun run test` 等已批准命令，受 `require_command_logging: true` 约束）、`test_environment`（`isolated_environment_only: true`，隔离内存库与 mock 网关）、`evidence_write`；受 `enforcement.check_before_action: true`、`fail_closed: true`、`default_effect: deny` 约束，`real_payment` / `real_refund` / `test_deletion_to_force_pass` 一律 deny。

## 对应验证器
- 验证器 ID：`quality.test_integrity`
- 实现路径：`.uap/validators/quality/index.mjs`
- 检查项：`[test_execution, failure_propagation, evidence]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `task_id` | 任务唯一 ID，来自 `.uap/config/execution-mapping.yaml` 的 `execution_contract.required_input` |
| 输入 | `specification_ids` | 关联规范 ID（UAP-05-001、UAP-05-002） |
| 输入 | `scope` / `changed_files` | 影响范围与变更文件，用于选择单元/集成/E2E/回归测试集合 |
| 输入 | `test_targets` | 具体包或测试文件路径（如 `./service/...`、`web/src/features/wallet/lib/__tests__/`） |
| 输入 | `constraints` | 权限组、隔离环境、超时、fail-closed、禁止真实资金 |
| 输入 | `ctx` | Runtime 上下文，含 `.uap/state/BASELINE.json` 的 toolchain 快照 |
| 输出 | `executorResult` | 由 `.uap/runtime/_lib/contract.mjs` 的 `executorResult()` 归一化的结构化结果 |
| 输出 | `command_log` | 每条测试的命令原文、`exit_code`、耗时与输出摘要 |
| 输出 | `coverage_report` | `coverage.out` 与 `go tool cover -func` 的真实覆盖率数值 |
| 输出 | `evidence_refs` | 指向 `.uap/evidence/` 的证据 ID 列表 |
| 输出 | `blocked_reasons` | 失败测试名、失败分类与阻断原因 |
| 输出 | `test_result` | `uap-test-agent` 的 `output_schema: test-result` 结构化结果 |

## 失败处理
按 `.uap/config/execution-mapping.yaml` 的 `execution.failure_policy` 与 `.uap/config/permission-policy.yaml` 的 `enforcement.fail_closed: true`（`default_effect: deny`）逐类处置：
1. **permission_denied**：`execute(task, ctx)` 前校验 `project_read/local_command/test_environment/evidence_write`，缺失即拒绝动作、记录 `log_denied_actions`，处置策略 `block`，任务由 RUNNING 迁移 BLOCKED，不重试、不绕过；请求真实支付/退款接口一律按 `real_payment` / `real_refund: deny` 阻断。
2. **missing_dependency**：`bun`/`go` 命令缺失、`httptest` 依赖或 `specification-registry.yaml` 中 UAP-05-001 依赖不可解析时，处置策略 `block`，任务迁移 BLOCKED 并写入 `blocked_reasons`；`./scripts/verify-all.sh` 环境缺失返回 `exit 2`，补齐后由 Orchestrator 重新排队（QUEUED）。
3. **validation_failed**：测试退出码非 0、关键业务测试失败或 `quality.test_integrity` 返回 FAIL / 含 `severity=BLOCKER` findings 时，处置策略 `repair_then_revalidate`，交由 `uap-defect-repair` 修复后复验；未复验通过不得标记 SUCCEEDED，禁止删除失败测试制造通过（`test_deletion_to_force_pass: deny`）。
4. **retryable**：处置策略 `bounded_retry`，重试上限 **3 次**（`max_repair_attempts_per_root_cause: 3`），退避采用指数退避（第 n 次等待 base × 2^(n-1)，base=1s，上限 8s，附随机抖动）；每次重试写入独立证据；恢复执行须校验 `task_id` 幂等，禁止重放非幂等副作用（如重复入账用例）。
5. **unrecoverable**：处置策略 `fail`，任务迁移 FAILED 并保留全部失败证据；按 `.uap/runtime/_lib/contract.mjs` 的 `TASK_TRANSITIONS`，FAILED 仅允许 → QUEUED / BLOCKED / CANCELLED，禁止重置状态隐藏失败。
全局 fail-closed：任何验证器缺失（`fail_if_validator_missing: true`）、`required_check_skipped: true`（`fail_if_required_check_skipped`）、证据缺失（`fail_if_evidence_missing: true`）或全量门禁存在 SKIP 时，结果一律按 BLOCKED / FAIL 处理，绝不降级为 PASS。

## 验收条件
> 基线原文：测试套件可执行；关键业务测试通过；测试失败能正确阻断；测试结果有证据。

1. 测试套件可执行
2. 关键业务测试通过
3. 测试失败能正确阻断
4. 测试结果有证据。

## 证据要求
- 证据统一落盘到 `.uap/evidence/`，索引写入 `.uap/reports/EVIDENCE-INDEX.md`；证据 ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EVD')` 生成稳定唯一 ID（格式 `UAP-EVD-<时间戳>-<随机>`），禁止与历史证据复用。
- 每条证据必须记录：执行命令原文（如 `make test`、`go test -race -count=1 ./service/... ./relay/... ./middleware/... ./model/...`、`go test -race -count=1 ./e2e/...`、`cd web && bun run test`、`go tool cover -func=coverage.out`）、`exit_code`、开始/结束时间（ISO 8601）、环境（取自 `.uap/state/BASELINE.json`：Go `go1.27.4` / Node `v22.22.2` / Bun `1.4.2`）、输入（`task_id` / `scope` / `test_targets` / `constraints`）、输出（pass/fail 计数、失败测试名、覆盖率数值、`executorResult` / `validatorResult` 全文）以及日志引用路径（`coverage.out`、`scripts/verify-all.sh` 汇总表）。
- 验证结果由 `.uap/runtime/_lib/contract.mjs` 的 `validatorResult()` 归一化为 `{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；`PASS` 仅在 `executed=true && exit_code=0` 且 `findings` 无 `severity=BLOCKER` 时成立。
- 报告必须能经 `evidence_refs` 反查到 `.uap/evidence/` 下的原始记录；`.uap/config/validator-registry.yaml` 的 `validation_policy.fail_if_evidence_missing: true` 强制证据存在；未运行或跳过的测试必须按 `AGENTS.md` Verification Evidence 明确标注 unverified，不得静默省略。
- **证据不可覆盖**：新结果写入新证据文件，禁止覆盖历史记录；`persist_task_state: true` 保证状态持久化。**失败证据不可删除**：BLOCKED / FAILED / NOT_EXECUTED 的证据必须保留，禁止以删除失败测试或失败证据制造通过结果；状态迁移受 `TASK_TRANSITIONS` 约束。

## 依赖标准
- **UAP-05-001（质量工程总规范，`.uap/quality/UAP-05-001-QUALITY-ENGINEERING.md`）**：提供「四项能力协同」「区分单元/集成/端到端/回归测试」「测试范围与修改风险匹配」「质量结果基于真实工具执行」「质量状态必须有证据」的总框架，并规定 `./scripts/verify-all.sh` 与 `.uap/config/workflow-registry.yaml` 的 `uap-quality-gate` 作为本规范测试步骤的调度来源；本规范的输出回填其 `test_engine` 检查项。
