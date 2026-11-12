# UAP-00-002 — 自主执行规范

**编号：** UAP-00-002
**标准编号：** UAP-00-002
**名称：** 自主执行规范
**版本：** 1.0.0
**状态：** ACTIVE
**适用范围：** 约束 Uter 内所有由用户自然语言任务到结构化任务图、调度、并行、恢复与验收的自主执行行为，覆盖 `.uap/runtime/task-engine/`、`.uap/runtime/orchestrator/`、`uap-orchestrator` Agent 与 `.uap/config/workflow-registry.yaml` 中的 `uap-bootstrap` / `uap-implementation` / `uap-defect-repair` / `uap-final-verification` 工作流。适用于 `router/`、`model/`、`web/src/` 等真实工程模块上的任务落地，禁止以计划或报告代替实际执行。
**关键级别：** P0
**依赖标准：** UAP-00-001

## 规范目标
本规范把用户任务变成可执行、可调度、可恢复的结构化任务图：由 `.uap/runtime/task-engine/index.mjs` 拆分可执行子任务，按 `.uap/runtime/_lib/contract.mjs` 的 `TASK_STATES` / `TASK_TRANSITIONS` 计算 DAG 顺序并持久化状态，受 `.uap/config/permission-policy.yaml` 的权限检查与资源/文件冲突约束。目标是任何明确要求的实现任务都必须产生真实 `changed_files`、真实命令执行与 `.uap/evidence/` 证据，未达验收标准绝不标记完成。

## 强制性要求
1. 用户任务必须转换为结构化任务。
2. 任务必须拆分为可执行子任务。
3. 每个子任务必须包含目标、输入、输出、依赖、权限、验收标准。
4. 系统必须自动计算可执行顺序。
5. 无依赖任务允许并行执行；有依赖任务必须等待前置任务完成。
6. 并行执行必须受资源限制和文件冲突检测约束。
7. 执行前必须进行权限检查。
8. 执行过程中必须持续记录状态和证据。
9. 任务失败必须分类为可重试、需修复、权限阻断或外部依赖阻断。
10. 可重试任务必须有最大重试次数和退避策略。
11. 同一任务恢复执行时不得重复产生非幂等副作用。
12. 任务完成后必须执行验收。
13. 未达到验收标准不得标记为完成。
14. 自动执行不得突破权限策略。
15. 用户明确要求的任务不得以生成计划或报告替代实际执行。

## Uter 落地细则
- 任务引擎实现为 `.uap/runtime/task-engine/index.mjs`（`execution-mapping.yaml` 的 `core.autonomous_execution`），由 `uap-orchestrator`（`.uap/runtime/agent-runtime/index.mjs`）统一分配，权限 `[project_read, task_create, task_dispatch, evidence_write]`。
- 任务结构契约来自 `.uap/config/execution-mapping.yaml` 的 `execution_contract.required_input`（`task_id, specification_ids, scope, constraints, acceptance_criteria`）与 `required_output`（`status, summary, changed_files, validation_results, evidence_refs, blocked_reasons`）。
- 任务状态机与合法迁移定义在 `.uap/runtime/_lib/contract.mjs`：`TASK_STATES`（CREATED/QUEUED/RUNNING/PAUSED/WAITING_RECOVERY/BLOCKED/FAILED/SUCCEEDED/CANCELLED）与 `TASK_TRANSITIONS`（如 `RUNNING → SUCCEEDED/FAILED/PAUSED/WAITING_RECOVERY/CANCELLED/BLOCKED`），非法迁移直接抛 `ContractError`（fail-closed）。
- DAG 顺序与依赖影响由 `.uap/config/specification-registry.yaml` 的 `dependencies` 与 `.uap/config/workflow-registry.yaml` 的 `uap-implementation` 步骤 `resolve_dependencies → create_execution_plan → implement_missing_capabilities → integrate_runtime → execute_targeted_tests` 实现。
- 并行与冲突约束在 `.uap/config/workflow-registry.yaml`：`execution.persist_after_each_step: true`、`resume_on_interruption: true`、`stop_on_critical_security_failure: true`、`stop_on_unrecoverable_data_integrity_failure: true`；共享资源由 `uap-defect-repair` 的 `persist_evidence` 与 `independent_review` 串行关口约束。
- 权限前置检查由 `.uap/config/permission-policy.yaml` 的 `enforcement.check_before_action: true` 与 `default_effect: deny` 强制；`project_write` 的 `preserve_uncommitted_changes: true` / `forbid_destructive_git_operations: true` 与 `branch_creation: deny`、`destructive_git: deny` 限定任务不得改用户未提交内容。
- 实际执行必须以真实命令产生可核验结果：`./scripts/verify-all.sh [--quick]`、`gofmt -l .`、`GOWORK=off go vet ./...`、`make test`；前端 `cd web && bun run typecheck|lint|test|lint:design:strict|copyright:check|format:check|build:check`。
- 明确任务落地的真实目标模块：`router/api-router.go`、`middleware/access_token_routes.go`、`model/quota_reserve.go`、`common/quota_math.go`、`service/authz/permission.go`、`relay/channel/openai/`、`web/src/features/`、`plugins/tasks/kling/plugin.js`。
- 失败分类与处置由 `.uap/config/execution-mapping.yaml` 的 `execution.failure_policy`（`retryable: bounded_retry` / `permission_denied: block` / `missing_dependency: block` / `validation_failed: repair_then_revalidate` / `unrecoverable: fail`）与 `max_repair_attempts_per_root_cause: 3` 固定。
- 验收门禁由 `uap-quality-gate`（`.uap/config/workflow-registry.yaml`）定义 `lint → typecheck → unit_tests → integration_tests → end_to_end_tests → security_scan → dependency_scan → build → code_review`，`acceptance: all_required_gates_pass`；对应 `.github/workflows/ci.yml` 与 `release-gate.yml`。
- 中断恢复证据由 `.uap/runtime/evidence-engine/index.mjs`（`core.evidence`）写入 `.uap/evidence/`，索引 `.uap/reports/EVIDENCE-INDEX.md`；`evidence.persist_task_state: true` 保证状态不只存在于内存。
- 幂等与恢复约束对齐 `AGENTS.md` 的 Change Protection（`git status --short` 先查脏文件、`git add <path>` 显式暂存、禁止 `rm -rf` / `git clean -fd`）与 Billing safety invariants（`common/quota_math.go` 的 `QuotaFromFloatChecked` 等 `*Checked` 变体捕获饱和）。
- 端到端实际执行验证由 `uap-final-verification`（`run_end_to_end_workflows` / `verify_recovery` / `generate_final_report`）与 `uap-financial-verification`（`environment: simulated_only`）承载，禁止以生成报告替代运行。

## 执行流程
1. `uap-orchestrator` 接收自然语言任务，调用 `.uap/runtime/task-engine/index.mjs` 将任务转为结构化任务，生成唯一 `task_id`（`.uap/runtime/_lib/util.mjs` 的 `newId`）。
2. 任务引擎按 `execution_contract.required_input` 拆分子任务，为每个子任务写入目标、输入、输出、依赖、权限、验收标准，状态置 CREATED → QUEUED。
3. 读取 `.uap/config/specification-registry.yaml` 的 `dependencies` 与 `TASK_TRANSITIONS`，自动计算 DAG 可执行顺序；无依赖子任务标记可并行，有依赖子任务绑定前置完成条件。
4. 每个子任务 `execute(task, ctx)` 前由 `.uap/runtime/policy-engine/index.mjs` 执行权限校验与资源/文件冲突检测；`project_write` 先按 `AGENTS.md` 执行 `git status --short` 记录脏文件。
5. 执行真实命令（如 `GOWORK=off go vet ./...`、`make test`、`cd web && bun run test`），把命令、退出码、`changed_files` 写入 `executorResult()`，并持续追加状态与证据到 `.uap/evidence/`。
6. 中断时按 `resume_on_interruption: true` 与 `persist_after_each_step: true` 从持久化状态恢复；恢复前校验 `result_id`/`task_id` 与 `WAITING_RECOVERY`，禁止重放非幂等副作用。
7. 全部子任务完成后触发 `uap-quality-gate` 与对应验证器（如 `core.execution_integrity`）复验，生成 `validatorResult()` 并回填 `validation_results`。
8. 仅当验收条件全部满足且 `executed=true && exit_code=0`、无 BLOCKER 时，任务由 RUNNING → SUCCEEDED，生成任务完成证据并登记 `.uap/reports/EVIDENCE-INDEX.md`；否则 BLOCKED / FAILED 并保留失败证据。

## 对应执行器
- 执行器 ID：`core.autonomous_execution`
- 实现路径：`.uap/runtime/task-engine/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：按 `.uap/config/permission-policy.yaml` 与 `uap-orchestrator` 映射，需 `project_read`、`task_create`、`task_dispatch`、`evidence_write`；实际落盘动作若需 `project_write` / `local_command` 必须单独申请并受 `require_command_logging: true`、`forbid_secret_exfiltration: true` 约束。`production_read/write/deploy`、`real_payment`、`real_refund`、`quality_gate_disable`、`test_deletion_to_force_pass` 一律 `deny`，自动执行不得突破。

## 对应验证器
- 验证器 ID：`core.execution_integrity`
- 实现路径：`.uap/validators/core/index.mjs`
- 检查项：`[task_execution, dependency_order, bounded_retry]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | 用户自然语言任务 | 待转换的原始需求，禁止仅据此生成计划即声称完成 |
| 输入 | `task_id` | 结构化任务唯一 ID |
| 输入 | `specification_ids` | 关联规范 ID 与 `dependencies` DAG |
| 输入 | `scope` / `constraints` / `acceptance_criteria` | 范围、权限/资源约束、验收标准 |
| 输入 | `ctx` | Runtime 上下文与持久化任务状态 |
| 输出 | 结构化任务图 | 含子任务的目标、输入、输出、依赖、权限、验收标准 |
| 输出 | `TASK_STATES` 迁移记录 | CREATED → QUEUED → RUNNING → SUCCEEDED/BLOCKED/FAILED |
| 输出 | `executorResult` | `status/summary/changed_files/commands/evidence_refs/blocked_reasons` |
| 输出 | 真实命令结果 | 命令原文、退出码、日志引用 |
| 输出 | `validation_results` / `validatorResult` | 独立验证器回填的复验结论 |
| 输出 | 任务完成证据 | `.uap/evidence/` 下的 `UAP-EVD-...` 与索引条目 |

## 失败处理
按 `.uap/config/execution-mapping.yaml` 的 `execution.failure_policy` 与 `.uap/config/permission-policy.yaml` 的 `enforcement.fail_closed: true`（`default_effect: deny`）逐类处置：
1. **permission_denied**（对应「权限阻断」）：`execute(task, ctx)` 前权限校验失败即拒绝动作、记录 `log_denied_actions`，处置策略 `block`，任务迁移 BLOCKED，不重试、不绕过。
2. **missing_dependency**（对应「外部依赖阻断」）：前置子任务未完成、依赖规范/执行器缺失或 DAG 不可解析时，处置策略 `block`，任务保持 QUEUED/BLOCKED 并写入 `blocked_reasons`，待依赖就绪重新排队。
3. **validation_failed**（对应「需修复」）：验收未通过或验证器返回 FAIL / NOT_EXECUTED / BLOCKER 时，处置策略 `repair_then_revalidate`，转入 `uap-defect-repair`（`classify_defect → identify_root_cause → generate_repair_plan → apply_authorized_repair → run_regression → independent_review`），复验通过前不得 SUCCEEDED。
4. **retryable**（对应「可重试」）：处置策略 `bounded_retry`，重试上限 **3 次**（`max_repair_attempts_per_root_cause: 3`、`uap-defect-repair.retry.max_attempts_per_root_cause: 3`），退避采用指数退避（base=1s，第 n 次 base × 2^(n-1)，上限 8s，附随机抖动）；`stop_on_permission_denied: true` / `stop_on_unrecoverable: true`；恢复时校验 `TASK_TRANSITIONS` 的 `WAITING_RECOVERY` 并防非幂等重放。
5. **unrecoverable**：处置策略 `fail`，任务迁移 FAILED，保留全部失败证据；`FAILED → QUEUED/BLOCKED/CANCELLED` 之外迁移一律抛 `ContractError`。
全局 fail-closed：验证器缺失、证据缺失、必需检查被跳过（`fail_if_required_check_skipped: true`）时结果按 BLOCKED / FAIL 处理；用户明确要求的任务不得以计划/报告替代实际执行，且不得通过 `quality_gate_disable` 或 `test_deletion_to_force_pass` 制造通过。

## 验收条件
1. 能够从自然语言生成任务。
2. 能够执行任务依赖图。
3. 能够中断并恢复。
4. 能够识别权限阻断。
5. 能够生成任务完成证据。

## 证据要求
- 证据统一落盘到 `.uap/evidence/`，索引写入 `.uap/reports/EVIDENCE-INDEX.md`；证据 ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EVD')` 生成稳定唯一 ID，每次子任务执行产生独立证据，禁止复用。
- 每条证据必须记录：执行命令原文（如 `./scripts/verify-all.sh`、`make test`、`cd web && bun run test`）、`exit_code`、开始/结束时间（ISO 8601）、环境（`.uap/state/BASELINE.json` 的 `toolchain`：Go `go1.27.4` / Node `v22.22.2` / Bun `1.4.2`）、输入（`task_id`、子任务 DAG、`scope`/`constraints`）、输出（`executorResult` 的 `changed_files`/`commands`、`validatorResult` 全文）以及日志引用路径。
- 验证结果由 `.uap/runtime/_lib/contract.mjs` 的 `validatorResult()` 归一化为 `{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；`PASS` 仅在 `executed=true && exit_code=0` 且 `findings` 无 `severity=BLOCKER` 时成立；`executorResult()` 的 `validation_results` 必须为空，由独立验证器回填。
- 报告必须能经 `evidence_refs` 反查到 `.uap/evidence/` 下的原始记录；`validation_policy.fail_if_evidence_missing: true` 强制证据存在。
- **证据不可覆盖**：新的重试/复验写入新证据文件，禁止覆盖历史记录；`persist_task_state: true` 与 `persist_after_each_step: true` 保证中断可恢复。**失败证据不可删除**：BLOCKED / FAILED / NOT_EXECUTED 与重试失败证据必须保留，禁止以删除失败证据或重置 `TASK_STATES` 制造通过结果。

## 依赖标准
- **UAP-00-001（UAP 核心架构规范）**：提供六层架构、稳定接口契约、`executorResult()` / `validatorResult()` 结构化结果与可追溯基线，使任务图、调度、证据层均有机器可解析的执行与验证映射。
