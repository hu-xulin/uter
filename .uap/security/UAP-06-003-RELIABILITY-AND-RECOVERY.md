# UAP-06-003 — 可靠性与恢复规范

**编号：** UAP-06-003
**标准编号：** UAP-06-003
**名称：** 可靠性与恢复规范
**版本：** 1.0.0
**状态：** ACTIVE
**适用范围：** 约束 UAP 运行时的健康检查与恢复链路（`.uap/runtime/state-machine/index.mjs`、`.uap/runtime/recovery-engine/index.mjs`、`.uap/runtime/task-engine/index.mjs`、`.uap/runtime/scheduler/index.mjs`、`.uap/runtime/evidence-engine/index.mjs`、`.uap/runtime/event-system/index.mjs`、`.uap/tools/interrupt-probe.mjs`），以及 Uter 真实的降级与幂等行为（`web/src/features/wallet/lib/__tests__/alipay-return.test.ts`、`service/alipay_query_test.go`、`web/AGENTS.md` §3.9、`AGENTS.md` Database compatibility 与 `electron/desktop-secrets.test.js`）。执行器 `security.reliability`，验证器 `security.reliability_integrity`。
**关键级别：** P0
**依赖标准：** UAP-00-004

## 规范目标
本规范把 Uter / UAP 的恢复能力固化为可验证规则：Runtime 每个执行器必须有 `health(ctx)` 健康状态，任务状态必须逐步持久化且中断可恢复，重试有 3 次上限与指数退避，关键依赖故障与外部服务不可用必须可检测并降级，数据库迁移必须有恢复方案与幂等验证，进程重启后的任务状态必须可核对。**不得声称已经验证生产恢复，除非实际完成了授权的生产恢复演练**；本次 UAP 建设只能在本地或隔离测试环境验证，生产操作一律 BLOCKED。

## 强制性要求
1. 关键服务必须有健康检查。
2. 必须定义超时、重试、退避和熔断策略。
3. 必须识别关键依赖故障。
4. 关键任务必须能够恢复。
5. 必须防止重复执行造成数据损坏。
6. 必须记录错误、异常和恢复事件。
7. 数据库迁移必须有恢复方案。
8. 后台任务必须有失败队列或等效机制。
9. 必须验证进程重启后的任务状态。
10. 必须验证外部服务不可用时的降级行为。
11. 必须记录备份和恢复能力的验证状态。
12. 不得声称已经验证生产恢复，除非实际完成了授权的生产恢复演练。

## Uter 落地细则
- 健康检查的机器契约：`.uap/config/execution-mapping.yaml` 注释明确「`registryIntegrity()` verifies every path exists, and the executor-coverage validator dynamically imports each module and calls its `health()` export」；每个 `executor_entries`（如 `.uap/runtime/evidence-engine/index.mjs`、`.uap/runtime/task-engine/index.mjs`、`.uap/engines/security/index.mjs`）必须导出 `health(ctx)`；`.uap/config/workflow-registry.yaml` 的 `uap-bootstrap` 步骤含 `validate_environment → initialize_runtime → run_runtime_tests`，`acceptance: runtime_health_check`。
- 健康状态与状态机：`.uap/runtime/_lib/contract.mjs` 的 `LIFECYCLE_STATUSES` / `TASK_STATES` / `TASK_TRANSITIONS` / `VALIDATOR_STATUSES` 定义状态与合法迁移；`.uap/config/specification-registry.yaml` 的 `status_values` 列出 `NOT_BUILT / PARTIALLY_BUILT / IMPLEMENTED_NOT_VERIFIED / PARTIALLY_VERIFIED / FULLY_VERIFIED / FULLY_OPERATIONAL / BLOCKED / FAILED` 八态，禁止把 `BLOCKED` 报成通过。
- 超时、重试、退避与熔断：`.uap/config/execution-mapping.yaml` 的 `execution.max_repair_attempts_per_root_cause: 3`、`failure_policy.retryable: bounded_retry`、`permission_denied: block`、`unrecoverable: fail`；`.uap/config/workflow-registry.yaml` 的 `uap-defect-repair` 带 `retry.max_attempts_per_root_cause: 3`、`stop_on_permission_denied: true`、`stop_on_unrecoverable: true`，以及 `execution.stop_on_critical_security_failure: true` / `stop_on_unrecoverable_data_integrity_failure: true` 作为熔断条件。
- 有上限重试的真实范例：`web/src/features/wallet/lib/__tests__/alipay-return.test.ts` 的 `pollAlipayOrder` 默认 4 次尝试、间隔 2000ms（`wait` 只调用 3 次，最后一次不空等）、`attempts` 可配置、`isCancelled` 卸载即停；`unpaid` / `closed` 为终态立即终止，避免把「查无此交易」误当可重试故障而无限轮询。
- 关键依赖故障识别：`./scripts/verify-all.sh` 的环境预检用 `command -v go` / `command -v bun` 收集 `MISSING`，退出码语义 `2 = 环境不满足（命令缺失）`；全量模式存在任一 `SKIP` 即 `exit 2`（`scripts/verify-all.sh:208-211`）；`AGENTS.md` Design System Enforcement 的视觉回归 track 1 / track 2 在浏览器或服务栈缺失时以 `BLOCKED` 非零退出（track 1 `exit 2`，track 2 经 `lib/service-gate.ts`），并明确「`BLOCKED` means *not executed* — never report it as a pass」。
- 关键任务恢复：`.uap/config/workflow-registry.yaml` 的 `execution.persist_after_each_step: true` / `resume_on_interruption: true`；`.uap/config/execution-mapping.yaml` 的 `evidence.persist_task_state: true`；`.uap/runtime/state-machine/index.mjs` 与 `.uap/runtime/recovery-engine/index.mjs` 承担恢复，`.uap/tools/interrupt-probe.mjs` 是仓库真实存在的中断探针，用于模拟进程中断并验证恢复证据。
- 防止重复执行造成数据损坏：`.uap/config/execution-mapping.yaml` 的 `execution_contract` 要求 `task_id` 唯一，恢复执行须校验幂等；`controller/topup_gateway_contract_test.go` 的 `LockOrder(` / `alreadyDone` 幂等特征与 `applyAlipayQueryResult` / `applyWechatQueryResult` 共用入账函数保证用户回跳、后台对账、读时对账不会重复入账；`controller/topup_alipay_query_test.go` 的 `TestQueryAlipayOrderIsIdempotentAfterCallback` 断言第二次查单不重复加额度。
- 记录错误、异常和恢复事件：`.uap/runtime/event-system/index.mjs` 提供事件系统；`common/quota_math.go` 的 `SysError` 记录饱和 clamp，`service/log_info_generate.go` 的 `attachQuotaSaturation` 把标记嵌到 `other.admin_info.quota_saturation` 并发出请求相关的 `logger.LogWarn`；`.uap/config/permission-policy.yaml` 的 `enforcement.log_denied_actions: true` / `log_sensitive_actions: true` 与 `validation_policy.fail_if_evidence_missing: true` 保证失败与恢复都有证据。
- 数据库迁移恢复方案：`AGENTS.md` Database compatibility 要求 schema/迁移变更在全新库与「由最新发布版本创建的代表性库升级」两种场景测试、启动迁移至少跑两次证明幂等、验证既有数据/索引/约束/唯一性保留，覆盖 SQLite / MySQL >= 5.7.8 / PostgreSQL >= 9.6 三方言与单独配置的日志库（含 ClickHouse）；SQLite 用 `ALTER TABLE ... ADD COLUMN` 而非 `ALTER COLUMN`（见 `model/main.go` 模式）；UAP-02-002 要求破坏性迁移有备份与回滚方案。
- 后台任务失败队列或等效机制：`AGENTS.md` Architecture 说明 `plugins/tasks/` 的 JavaScript task plugins 经 `pkg/jsplugin/`（Sobek）执行并与 host 任务轮询和结算集成；UAP 侧由 `.uap/runtime/task-engine/index.mjs`、`.uap/runtime/scheduler/index.mjs`、`.uap/runtime/resource-manager/index.mjs` 与 `uap-defect-repair` 的 `classify_defect` / `blocked_reasons` / `retry` 提供失败登记与重新排队（QUEUED）。
- 进程重启后的任务状态：`.uap/state/BASELINE.json`（`baseline_id: UAP-BASELINE-2026-11-12T10-19-06Z`）持久化工作区与工具链快照；`.uap/runtime/state-machine/index.mjs` 保证状态不只存在内存；`.github/workflows/ci.yml` 与 `release-gate.yml` 的 `desktop` job 用 `node --test electron/desktop-secrets.test.js` 验证 SESSION_SECRET / CRYPTO_SECRET 跨重启稳定（否则刷新令牌校验、加密数据与带签名任务资源链接失效），是「重启后状态」的真实可执行验证。
- 外部服务不可用时降级：`web/AGENTS.md` §3.9 规定 `handleServerError(error, fallbackMessage?)`、`requireServerSuccess`、`createServerError`、`AuthOperationError` 安全消息、路由级 `errorComponent` 友好错误页与 `meta.errorToast: false`；`web/src/features/wallet/lib/__tests__/alipay-return.test.ts` 的 `survives transient request errors and still confirms the order` 验证瞬时网络错误后仍确认订单；`service/alipay_query_test.go` 的 `TestAlipayQueryOrderSurfacesOtherBusinessFailures` 要求 `ACQ.INVALID_PARAMETER` 之类网关故障返回错误而非误判为未支付；主动查单（`QueryAlipayOrder` / `QueryWechatOrder`）是「本地收不到异步回调」场景下订单不停在待确认的兜底。
- 备份与恢复能力验证状态 + 禁止谎称生产恢复：`.uap/config/permission-policy.yaml` 的 `production_read: effect: deny`（`Not required for local UAP implementation`）、`production_write` / `production_deploy: effect: deny`（`Explicit production authorization required`），`.uap/config/execution-mapping.yaml` 的 `dry_run_for_production: true`；`AGENTS.md` 规定本次建设只能在本地或隔离测试环境验证；备份/恢复验证状态必须作为证据显式记录（含未验证项），**不得声称已验证生产恢复**。
- 最终恢复验收：`.uap/config/workflow-registry.yaml` 的 `uap-final-verification` 含 `verify_recovery` 步骤、`acceptance: full_operational_acceptance`，并在 `run_end_to_end_workflows` / `generate_final_report` 汇总；`security.reliability_integrity` 的检查项 `[health, timeout, retry, recovery]` 必须全部 `executed=true` 且 `exit_code=0` 才可通过。

## 执行流程
1. `uap-security-agent`（`.uap/engines/security/index.mjs`，权限 `project_read/local_command/evidence_write`）按 `.uap/config/workflow-registry.yaml` 的 `uap-bootstrap` 与 `uap-final-verification` 中 `verify_recovery` 发起，读取 `.uap/state/BASELINE.json`、`AGENTS.md` Database compatibility 与 `web/AGENTS.md` §3.9。
2. `validate_environment`：经 `.uap/runtime/_lib/yaml.mjs` 加载 `specification-registry.yaml`（确认 UAP-00-004 依赖）、`execution-mapping.yaml`、`validator-registry.yaml`，按 `./scripts/verify-all.sh` 的 `command -v go` / `command -v bun` 预检收集 `MISSING`，环境不满足即 `exit 2` / BLOCKED。
3. `initialize_runtime` + `run_runtime_tests`：对 `executor_entries` 逐条动态 `import()` 并调用 `health(ctx)`（`registryIntegrity()` 校验路径存在），收集健康状态；失败项写入 `blocked_reasons`。
4. 模拟进程中断：用 `.uap/tools/interrupt-probe.mjs` 触发中断，验证 `persist_after_each_step: true` / `resume_on_interruption: true` / `persist_task_state: true` 后任务可由 `.uap/runtime/state-machine/index.mjs` 与 `.uap/runtime/recovery-engine/index.mjs` 恢复，并校验 `task_id` 幂等、无重复入账等非幂等副作用。
5. 验证重启后状态与外部依赖降级：执行 `node --test electron/desktop-secrets.test.js`（密钥跨重启稳定）、`cd web && bun run test`（`pollAlipayOrder` 的 4 次上限 / 2000ms 间隔 / 瞬时错误重试 / `isCancelled`）、`service/alipay_query_test.go` 的网关故障用例；核对视觉回归缺失栈时以 `BLOCKED` 非零退出而非误报 PASS。
6. 验证数据库迁移恢复：按 `AGENTS.md` 三方言矩阵与「启动迁移至少两次证明幂等」执行，记录既有数据/索引/约束/唯一性保留情况与备份回滚方案，写入 `blocked_reasons` 或 `validation_results`。
7. 结果由 `.uap/runtime/_lib/contract.mjs` 的 `executorResult()` 归一化；生成 `UAP-EVD-...` 证据落盘 `.uap/evidence/`、索引追加 `.uap/reports/EVIDENCE-INDEX.md`，显式记录「备份和恢复能力的验证状态」与所有未验证项。
8. `security.reliability_integrity` 验证器（`.uap/validators/security/index.mjs`）执行 `health` / `timeout` / `retry` / `recovery`，返回 `validatorResult()`；仅当 `executed=true && exit_code=0` 且无 BLOCKER 时通过，否则 fail-closed 记 BLOCKED / FAILED 并保留失败证据。

## 对应执行器
- 执行器 ID：`security.reliability`
- 实现路径：`.uap/engines/security/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：按 `.uap/config/agent-registry.yaml` 的 `uap-security-agent`（`output_schema: security-result`）与 `.uap/config/permission-policy.yaml`，需 `project_read`（读取运行时状态、配置与测试）、`local_command`（执行 `node --test`、`go test -race`、`bun run test` 等已批准命令，受 `require_command_logging: true` 约束）、`test_environment`（`isolated_environment_only: true`）、`evidence_write`；受 `enforcement.check_before_action: true`、`fail_closed: true`、`default_effect: deny` 约束，`production_read` / `production_write` / `production_deploy` / `real_payment` / `real_refund` 一律 deny，生产恢复演练未经明确授权一律 BLOCKED。

## 对应验证器
- 验证器 ID：`security.reliability_integrity`
- 实现路径：`.uap/validators/security/index.mjs`
- 检查项：`[health, timeout, retry, recovery]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `task_id` | 任务唯一 ID，来自 `.uap/config/execution-mapping.yaml` 的 `execution_contract.required_input` |
| 输入 | `specification_ids` | 关联规范 ID（UAP-00-004、UAP-06-003） |
| 输入 | `scope` / `constraints` | 影响范围、超时预算、权限组、fail-closed、隔离环境 |
| 输入 | `interrupt_probe` | `.uap/tools/interrupt-probe.mjs` 的中断注入参数与预期恢复点 |
| 输入 | `acceptance_criteria` | 健康检查通过、重试有上限、中断可恢复、降级行为正确 |
| 输入 | `ctx` | Runtime 上下文，含 `.uap/state/BASELINE.json` 与 `TASK_TRANSITIONS` |
| 输出 | `executorResult` | 由 `.uap/runtime/_lib/contract.mjs` 的 `executorResult()` 归一化的结构化结果 |
| 输出 | `health_report` | 各 `executor_entries` 的 `health(ctx)` 返回与 `registryIntegrity()` 结果 |
| 输出 | `recovery_report` | 中断前/后状态、恢复点、`task_id` 幂等校验与重复副作用检查 |
| 输出 | `degradation_results` | 外部服务不可用时的降级用例命令、退出码与 `BLOCKED` 判定 |
| 输出 | `evidence_refs` | 指向 `.uap/evidence/` 的证据 ID 列表 |
| 输出 | `verification_status` | 备份与恢复能力的验证状态（含未验证项），禁止谎称生产恢复 |

## 失败处理
按 `.uap/config/execution-mapping.yaml` 的 `execution.failure_policy`、`.uap/config/workflow-registry.yaml` 的 `execution` 约束与 `.uap/config/permission-policy.yaml` 的 `enforcement.fail_closed: true`（`default_effect: deny`）逐类处置：
1. **permission_denied**：`execute(task, ctx)` 前校验 `project_read/local_command/test_environment/evidence_write`，任何 `production_read` / `production_write` / `production_deploy` / `real_payment` / `real_refund` 请求即拒绝动作、记录 `log_denied_actions`，处置策略 `block`，任务由 RUNNING 迁移 BLOCKED，不重试、不绕过；**生产恢复演练未经明确授权一律 BLOCKED**。
2. **missing_dependency**：`health()` 导出缺失、`executor_entries` 路径不可导入、`.uap/tools/interrupt-probe.mjs` 不可用、`go` / `bun` / `node` 命令缺失或 UAP-00-004 依赖不可解析时，处置策略 `block`，任务迁移 BLOCKED 并写入 `blocked_reasons`；`./scripts/verify-all.sh` 环境缺失返回 `exit 2`，补齐后由 Orchestrator 重新排队（QUEUED）。
3. **validation_failed**：中断后状态不一致、重试超过上限、降级用例失败、`BLOCKED` 被误报为 PASS 或 `security.reliability_integrity` 含 `severity=BLOCKER` findings 时，处置策略 `repair_then_revalidate`，交由 `uap-defect-repair` 修复后复验；未复验通过不得标记 SUCCEEDED。
4. **retryable**：处置策略 `bounded_retry`，重试上限 **3 次**（`max_repair_attempts_per_root_cause: 3`；`pollAlipayOrder` 的前端查单另按契约 4 次尝试 / 2000ms 间隔并受 `isCancelled` 终止），退避采用指数退避（第 n 次等待 base × 2^(n-1)，base=1s，上限 8s，附随机抖动）；每次重试写入独立证据；恢复执行须校验 `task_id` 幂等，禁止重放非幂等副作用。
5. **unrecoverable**：处置策略 `fail` 且 `stop_on_unrecoverable: true` / `stop_on_unrecoverable_data_integrity_failure: true`，任务迁移 FAILED / BLOCKED 并保留全部失败证据；按 `.uap/runtime/_lib/contract.mjs` 的 `TASK_TRANSITIONS`，FAILED 仅允许 → QUEUED / BLOCKED / CANCELLED，禁止重置状态隐藏失败（`AGENTS.md` 对应 UAP-00-004 第 12 条）。
全局 fail-closed：任何策略判定异常、验证器缺失（`fail_if_validator_missing: true`）、验证器不可执行（`fail_if_validator_not_executable: true`）、必要检查被跳过（`fail_if_required_check_skipped: true`）或证据缺失（`fail_if_evidence_missing: true`）时，结果一律按 BLOCKED / FAIL 处理，绝不降级为 PASS；`BLOCKED` 表示未执行，禁止报成通过。

## 验收条件
1. 关键任务能够恢复。
2. 服务异常能够被检测。
3. 重试策略有上限。
4. 失败恢复有测试证据。

## 证据要求
- 证据统一落盘到 `.uap/evidence/`，索引写入 `.uap/reports/EVIDENCE-INDEX.md`；证据 ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EVD')` 生成稳定唯一 ID（格式 `UAP-EVD-<时间戳>-<随机>`），禁止与历史证据复用。
- 每条证据必须记录：执行命令原文（如 `./scripts/verify-all.sh`、`node --test electron/desktop-secrets.test.js`、`cd web && bun run test`、`go test -race -count=1 ./service/... ./relay/... ./middleware/... ./model/...`、`.uap/tools/interrupt-probe.mjs` 中断注入）、`exit_code`、开始/结束时间（ISO 8601）、环境（取自 `.uap/state/BASELINE.json`：Go `go1.27.4` / Node `v22.22.2` / Bun `1.4.2`）、输入（`task_id` / `interrupt_probe` / `scope`）、输出（中断前/后状态、`health` 返回、恢复点、`executorResult` / `validatorResult` 全文、`BLOCKED` 判定）以及日志引用路径（`.uap/runtime/event-system/index.mjs` 事件、`service/log_info_generate.go` 的 `logger.LogWarn`、`admin_info.quota_saturation`）。
- 验证结果由 `.uap/runtime/_lib/contract.mjs` 的 `validatorResult()` 归一化为 `{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；`PASS` 仅在 `executed=true && exit_code=0` 且 `findings` 无 `severity=BLOCKER` 时成立。
- 证据必须显式记录「**备份和恢复能力的验证状态**」：已验证项、未验证项、隔离环境范围与任何 SKIP / BLOCKED 原因；`.uap/config/validator-registry.yaml` 的 `validation_policy.fail_if_evidence_missing: true` 强制证据存在；`AGENTS.md` Verification Evidence 要求报告写明精确命令、退出码、pass/fail 计数、失败测试名、改动文件与已知失败/跳过项。**不得声称已经验证生产恢复**，除非实际完成了授权的生产恢复演练并在证据中留存授权与演练记录。
- **证据不可覆盖**：新结果写入新证据文件，禁止覆盖历史记录；`persist_task_state: true` 与 `persist_after_each_step: true` 保证状态持久化。**失败证据不可删除**：BLOCKED / FAILED / NOT_EXECUTED 的证据必须保留，禁止以删除失败证据、重置状态或把 `BLOCKED` 报成 PASS 制造通过结果；状态迁移受 `TASK_TRANSITIONS` 约束。

## 依赖标准
- **UAP-00-004（证据与状态管理规范，`.uap/core/UAP-00-004-EVIDENCE-AND-STATE.md`）**：提供「每次任务执行必须产生唯一执行记录」「每条规范/执行器/验证器必须有状态」「状态必须区分 NOT_BUILT / PARTIALLY_BUILT / IMPLEMENTED_NOT_VERIFIED / PARTIALLY_VERIFIED / FULLY_VERIFIED / FULLY_OPERATIONAL / BLOCKED / FAILED」「验证结果必须记录命令、退出码、时间、环境、输入、输出和日志引用」「执行状态必须可恢复，不能只存在于内存」「历史证据不得被新结果静默覆盖」「失败证据不得删除以制造通过结果」能力；其实现为 `.uap/runtime/state-machine/index.mjs` 与 `.uap/runtime/evidence-engine/index.mjs`，是本规范状态持久化、恢复证据与不可覆盖约束的根基。
