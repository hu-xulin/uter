# UAP-03-004 — Agent 恢复规范

**编号：** UAP-03-004
**标准编号：** UAP-03-004
**名称：** Agent 恢复规范
**版本：** 1.0.0
**状态：** IMPLEMENTED_NOT_VERIFIED
**适用范围：** 适用于 UAP 运行时中断后的任务恢复：`.uap/runtime/recovery-engine/index.mjs` 执行器、`.uap/runtime/state-machine/index.mjs` 的状态迁移、`.uap/state/tasks.json` 与 `.uap/state/workflow-runs.json` 的持久化状态、`.uap/runtime/resource-manager/index.mjs` 的过期锁清理，以及 `.uap/evidence/` 中不可覆盖的恢复证据。
**关键级别：** P0
**依赖标准：** [UAP-03-002]

## 规范目标
UAP 1.0 的任务状态由 `.uap/runtime/state-machine/index.mjs` 定义 9 个 `TASK_STATES`（含 `WAITING_RECOVERY`/`PAUSED`/`CANCELLED`）并强制持久化到 `.uap/state/tasks.json`。本规范要求 Runtime 中断后能从持久化状态恢复、恢复前检查副作用与上下文版本、非幂等操作不重放、超时任务进入明确恢复态，且不得通过重置状态隐藏失败历史。`.uap/runtime/evidence-engine/index.mjs` 的 append-only 证据与 `content_hash` 校验保证恢复证据完整可核验。

## 强制性要求
1. Agent 任务必须持久化状态。
2. Runtime 中断后必须能够恢复任务。
3. 恢复时必须检查任务是否已经产生副作用。
4. 非幂等操作不得直接重复执行。
5. 任务恢复必须校验上下文版本。
6. 失败任务必须记录失败原因。
7. 超时任务必须进入明确的恢复状态。
8. 不可恢复任务必须标记 BLOCKED 或 FAILED。
9. 必须支持任务取消。
10. 必须支持任务暂停和续跑。
11. 恢复后必须进行必要的状态一致性检查。
12. 不得通过重置状态隐藏失败历史。

## Uter 落地细则
- `.uap/runtime/state-machine/index.mjs` 的 `TASK_STATES` 含 `CREATED`/`QUEUED`/`RUNNING`/`PAUSED`/`WAITING_RECOVERY`/`BLOCKED`/`FAILED`/`SUCCEEDED`/`CANCELLED`；`TASK_TRANSITIONS` 允许 `RUNNING → WAITING_RECOVERY`、`WAITING_RECOVERY → QUEUED`、`QUEUED → PAUSED`、`RUNNING → CANCELLED`，`health()` 断言 `recovery_edge_accepted`。
- 同文件 `transition(task, to, reason)` 在 `task.history` 追加 `{from, to, reason, at}`；`assertTransition()` 对未知状态与非法边抛 `IllegalTransitionError`，实现「不得通过重置状态隐藏失败历史」。`isTerminal()` 把 `SUCCEEDED`/`FAILED`/`CANCELLED`/`BLOCKED` 判为终态。
- `.uap/runtime/_lib/paths.mjs` 的 `FILES` 定义持久化位置：`tasks`（`.uap/state/tasks.json`）、`runs`（`.uap/state/workflow-runs.json`）、`events`（`.uap/state/events.jsonl`）、`audit`（`.uap/state/audit.json`）、`baseline`（`.uap/state/BASELINE.json`）；`BASELINE.json` 可作为恢复时上下文版本校验基线。
- `.uap/config/execution-mapping.yaml` 的 `execution.persist_task_state: true`、`evidence.directory: .uap/evidence`、`evidence.reports_directory: .uap/reports` 要求状态与证据落盘，不得只存在于内存。
- `.uap/runtime/resource-manager/index.mjs` 的 `acquire()` 在加锁前依据 `expires_at < now` 清理中断进程遗留的过期锁，锁状态存于 `.uap/state/locks.json`（`FILES.taskLocks`），`ttlMs` 默认 300000，`release()`/`releaseAll()` 支持恢复前后的资源释放。
- `.uap/runtime/evidence-engine/index.mjs` 的 `record()` 以 `evidence_id` 命名文件，`writeEvidence()` 对同 ID 二次写入抛错（append-only），`verify()` 用 `content_hash`（sha256）校验未被篡改，`resolveAll()` 校验 `evidence_refs` 有效。
- 同文件 `health()` 的 `health_probe` 自检 `persisted`/`hash_verified`/`overwrite_rejected`/`original_untouched`/`environment_recorded`/`command_and_exit_recorded`/`secret_redaction`，是「失败证据不得删除」的机器自检。
- `.uap/config/workflow-registry.yaml` 的 `execution` 段声明 `persist_after_each_step: true`、`resume_on_interruption: true`、`stop_on_critical_security_failure: true`、`stop_on_unrecoverable_data_integrity_failure: true`、`require_evidence: true`。
- `.uap/config/execution-mapping.yaml` 的 `execution.preserve_user_changes: true`、`dry_run_for_production: true`、`max_repair_attempts_per_root_cause: 3`、`branch_policy: no_branch_creation` 约束恢复时不得重放非幂等副作用（如发布、真实支付、破坏性 git 操作）。
- `.uap/config/validator-registry.yaml` 中 `agents.recovery_integrity` 的 `checks: [state_persistence, interruption_recovery, idempotency]`，配合 `validation_policy.fail_if_evidence_missing: true` 与 `allow_explicit_blocked_status: true`。
- `.uap/runtime/_lib/contract.mjs` 的 `TASK_STATES`/`TASK_TRANSITIONS` 与 `LIFECYCLE_STATUSES`（含 `BLOCKED`/`FAILED`）为恢复状态迁移与不可恢复标记的唯一枚举来源；`validatorResult()` 规定 PASS 只在 `executed=true`、`exit_code=0`、无 BLOCKER 时成立。
- `.uap/runtime/event-system/index.mjs` 的 `query({task_id, since})` 与 `replay(type, handler)` 支持从 `.uap/state/events.jsonl` 重建中断前的执行上下文，`UAP-EVT-*` 事件含 `at`/`severity`/`trace_id`，用于恢复前副作用与上下文版本核对。
- `.uap/config/workflow-registry.yaml` 的 `uap-final-verification` 步骤含 `verify_recovery`，`uap-bootstrap` 步骤含 `run_runtime_tests` 与 `initialize_runtime`，为进程中断模拟与恢复能力的端到端验证入口。

## 执行流程
1. Runtime 启动或 `uap-bootstrap.initialize_runtime` 时，执行器 `agents.recovery`（`.uap/runtime/recovery-engine/index.mjs`）读取 `.uap/state/tasks.json` 与 `.uap/state/workflow-runs.json`，扫描 `RUNNING`/`PAUSED`/`WAITING_RECOVERY` 态任务。
2. 执行器调用 `.uap/runtime/event-system/index.mjs` 的 `query({task_id, since})` 与 `.uap/state/events.jsonl` 回放中断前事件，核对任务是否已产生副作用与上下文版本（对照 `.uap/state/BASELINE.json`）。
3. 对非幂等操作标记 `idempotency_recheck`，禁止直接重放；调用 `.uap/runtime/resource-manager/index.mjs` 的 `releaseAll()`/过期锁清理，恢复 `.uap/state/locks.json` 一致性。
4. 按 `.uap/runtime/state-machine/index.mjs` 的 `assertTransition()` 执行 `WAITING_RECOVERY → QUEUED → RUNNING` 或 `PAUSED → QUEUED`，每次迁移在 `task.history` 追加 `{from, to, reason, at}`，失败原因写入 `blocked_reasons`。
5. 超时任务迁移为 `WAITING_RECOVERY`；不可恢复任务迁移为 `BLOCKED` 或 `FAILED`；被取消任务迁移为 `CANCELLED`。`health()` 自检状态机 9 态与迁移表完整性。
6. 独立验证器 `agents.recovery_integrity`（`.uap/validators/agents/index.mjs`）执行 `state_persistence`、`interruption_recovery`、`idempotency` 检查，返回 `validatorResult()`，并做恢复后的状态一致性检查。
7. `evidence-engine.record()` 生成新的恢复证据 `.uap/evidence/UAP-EV-*.json`，记录中断点、副作用检查结论、上下文版本、命令与退出码，索引追加到 `.uap/reports/EVIDENCE-INDEX.md`；中断前证据保持不可覆盖。
8. 仅当 `executed=true`、`exit_code=0`、无 BLOCKER 时任务迁移 `RUNNING → SUCCEEDED`；否则保持 `BLOCKED`/`FAILED` 并保留全部失败证据。

## 对应执行器
- 执行器 ID：`agents.recovery`
- 实现路径：`.uap/runtime/recovery-engine/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：需 `project_read` 读取 `.uap/state/*` 与配置、`evidence_write` 写入恢复证据、`task_dispatch` 重新排队，必要时 `project_write`（`preserve_uncommitted_changes: true`）回写状态文件。按 `.uap/config/permission-policy.yaml` 的 `default_effect: deny`、`enforcement.check_before_action: true`、`fail_closed: true` 逐动作校验；`production_write`/`production_deploy`/`real_payment`/`real_refund`/`destructive_git`/`force_push` 为 deny 组，恢复过程禁止重放生产副作用。

## 对应验证器
- 验证器 ID：`agents.recovery_integrity`
- 实现路径：`.uap/validators/agents/index.mjs`
- 检查项：`[state_persistence, interruption_recovery, idempotency]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `.uap/state/tasks.json` / `.uap/state/workflow-runs.json` | 中断前的持久化任务状态与工作流运行记录 |
| 输入 | `.uap/state/events.jsonl` | `UAP-EVT-*` 事件链，用于重建上下文、核对副作用与版本 |
| 输入 | `.uap/state/BASELINE.json` / `.uap/state/locks.json` | 上下文版本基线与被中断进程遗留的锁状态 |
| 输入 | `.uap/config/workflow-registry.yaml` | `resume_on_interruption` / `persist_after_each_step` 恢复策略 |
| 输出 | 状态迁移记录 | `task.history` 中的 `{from, to, reason, at}` 与 `WAITING_RECOVERY`/`PAUSED`/`CANCELLED` 迁移结果 |
| 输出 | 副作用与幂等检查结论 | `idempotency_recheck` 结论、`blocked_reasons` 与失败原因 |
| 输出 | `validatorResult` | `state_persistence`/`interruption_recovery`/`idempotency` 三项 `checks_run` 与 `findings` |
| 输出 | `.uap/evidence/UAP-EV-*.json` | 恢复证据（中断点、命令、退出码、`content_hash`、`trace_id`） |

## 失败处理
- `permission_denied`：恢复所需权限（如 `task_dispatch`、`project_write`）被 deny 时停止重放，任务保持 `WAITING_RECOVERY` 并迁移 `BLOCKED`，处置为 `block`，写 `blocked_reasons` 与审计事件，禁止绕过检查。
- `missing_dependency`：`.uap/state/tasks.json`、`.uap/state/events.jsonl` 或 UAP-03-002 依赖不可解析、上下文版本不匹配时迁移为 `BLOCKED`，处置为 `block`；`fail_if_evidence_missing: true` 使关键证据缺失同样阻断恢复，不猜测副作用状态。
- `validation_failed`：`state_persistence`/`interruption_recovery`/`idempotency` 任一 FAIL 时迁移为 `FAILED`，处置为 `repair_then_revalidate`，修复后必须由同一验证器重跑并生成新 `evidence_id`，禁止直接改判 PASS。
- `retryable`：瞬时状态读写失败按 `bounded_retry` 处理，重试上限 3 次，退避采用指数退避（1s → 2s → 4s），每次重试写独立证据；`WAITING_RECOVERY → QUEUED → RUNNING` 为唯一合法续跑链，超限迁移 `FAILED`；非幂等操作在退避期内不重放。
- `unrecoverable`：副作用已产生且无法判定幂等性、上下文版本不兼容时迁移 `BLOCKED` 或 `FAILED`（`allow_explicit_blocked_status: true`），处置为 `fail`，完整保留失败证据；`assertTransition()` 对非法边抛 `IllegalTransitionError`，`fail_closed: true` 禁止通过重置状态隐藏失败历史。

## 验收条件
> 基线原文：能够模拟进程中断；能够恢复任务；重复副作用得到防护；恢复证据完整。

1. 能够模拟进程中断
2. 能够恢复任务
3. 重复副作用得到防护
4. 恢复证据完整。

## 证据要求
- 证据目录 `.uap/evidence/`，索引 `.uap/reports/EVIDENCE-INDEX.md`；文件命名 `.uap/evidence/<evidence_id>.json`，ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EV')` 生成，格式 `UAP-EV-<14位UTC时间戳>-<8位hex>`。
- 每条证据必须记录 `command`（状态读取/迁移/一致性检查命令）、`exit_code`、`duration_ms`、`recorded_at`、`environment`（platform/node/cwd/uap_root）、`inputs`、`stdout`、`stderr`、`artifacts`、`findings`、`summary`、`content_hash`、`task_id`、`trace_id`、`specification_ids`（含 UAP-03-004）。
- 恢复专属证据内容：中断点状态、副作用检查结论、上下文版本校验结果、`task.history` 迁移链、`idempotency_recheck` 结论、`.uap/state/locks.json` 过期锁清理记录、`agents.recovery_integrity` 的 `checks_run`。
- 证据 append-only：`writeEvidence()` 对同 ID 二次写入抛错，`verify()` 用 `content_hash` 校验，`resolveAll()` 校验 `evidence_refs` 有效；中断前证据与失败证据不得删除、不得被恢复后的新结果静默覆盖，`health()` 的 `overwrite_rejected`/`original_untouched` 必须为真。
- 报告必须能经 `.uap/reports/EVIDENCE-INDEX.md` 定位到中断前证据与恢复证据两条原始记录；未产生恢复证据不得标注为已恢复，状态保持 IMPLEMENTED_NOT_VERIFIED。
- 敏感值经 `redact()` 脱敏；`stop_on_critical_security_failure: true` 与 `stop_on_unrecoverable_data_integrity_failure: true` 触发的阻断事件必须落审计（`.uap/state/audit.json`）并附证据引用。

## 依赖标准
- `UAP-03-002`（Agent 执行规范）：提供单次任务的结构化 `executorResult` 输出、命令/退出码证据、权限校验与标准失败分类（permission_denied / missing_dependency / validation_failed / retryable / unrecoverable），使恢复流程能判定中断前副作用、重建上下文版本，并对失败任务给出可追溯的失败原因与状态迁移依据。
