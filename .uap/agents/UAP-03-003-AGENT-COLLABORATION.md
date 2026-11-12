# UAP-03-003 — Agent 协作规范

**编号：** UAP-03-003
**标准编号：** UAP-03-003
**名称：** Agent 协作规范
**版本：** 1.0.0
**状态：** IMPLEMENTED_NOT_VERIFIED
**适用范围：** 适用于 UAP 多 Agent 并行场景：`uap-orchestrator` 统一分配、`.uap/runtime/resource-manager/index.mjs` 的文件冲突检测与锁、`.uap/runtime/state-machine/index.mjs` 的 DAG 顺序、`.uap/runtime/event-system/index.mjs` 的结构化消息，以及 `router/`、`model/`、`controller/`、`service/`、`relay/`、`web/src/` 等共享代码目录上的并发写保护。
**关键级别：** P1
**依赖标准：** [UAP-03-001, UAP-03-002]

## 规范目标
UAP 1.0 的 7 个工作流（`.uap/config/workflow-registry.yaml`）常需多个 Agent 协同，例如 `uap-quality-gate` 的 `lint`/`typecheck`/`unit_tests`/`security_scan`/`dependency_scan`/`code_review` 分派给不同 Agent。本规范要求所有协作通过 `task_id` 与 `UAP-EVT-*` 消息 ID 关联、按 DAG 顺序执行、写集合冲突由 `.uap/runtime/resource-manager/index.mjs` 的 `detectFileConflicts()` 与 `acquire()` 拦截、并发度受 `MAX_CONCURRENCY = 4` 约束，禁止通过非结构化文本或隐式全局状态传递关键状态。汇总结果由 `agents.collaboration_integrity` 做一致性检查后方可进入下一阶段。

## 强制性要求
1. 任务由 Orchestrator 统一分配。
2. 多 Agent 必须通过任务 ID 和消息 ID 关联。
3. 必须明确任务负责人。
4. 并行任务必须检查文件修改冲突。
5. 共享资源必须有锁或等效并发控制。
6. Agent 之间不得通过非结构化文本暗中传递关键状态。
7. 冲突必须交由协调器处理。
8. 依赖任务必须按 DAG 顺序执行。
9. 重复任务必须识别并去重。
10. 多 Agent 结果必须进行汇总和一致性检查。
11. 关键业务决策必须记录来源。
12. 协作失败必须支持重新分配或恢复。

## Uter 落地细则
- `.uap/runtime/resource-manager/index.mjs` 的 `MAX_CONCURRENCY = 4` 限制并行任务数；`detectFileConflicts(tasks)` 按每个任务的 `files` 写集合检测跨任务重叠，冲突时抛 `ResourceConflictError` 并携带 `conflicts: [{file, task_a, task_b}]`。
- 同文件 `acquire(taskId, {files, resource, ttlMs: 300000})` / `release(taskId)` 把锁持久化到 `.uap/state/locks.json`（`.uap/runtime/_lib/paths.mjs` 的 `FILES.taskLocks`），并依据 `expires_at` 清理中断进程遗留的过期锁，提供共享资源并发控制。
- `.uap/runtime/state-machine/index.mjs` 的 `TASK_TRANSITIONS` 定义 DAG 顺序（如 `QUEUED → RUNNING`、`RUNNING → SUCCEEDED`），`assertTransition()` 对非法迁移抛 `IllegalTransitionError`，`isTerminal()` 判定 `SUCCEEDED`/`FAILED`/`CANCELLED`/`BLOCKED` 为终态。
- `.uap/runtime/event-system/index.mjs` 的 `publish(type, payload, {trace_id, task_id, severity})` 生成含 `event_id`（`UAP-EVT-*`）、`task_id`、`trace_id`、`at` 的结构化事件并追加 `.uap/state/events.jsonl`；`query({task_id, type, trace_id, since})` 与 `replay(type, handler)` 支撑按任务/消息 ID 关联与结果汇总。
- `.uap/config/agent-registry.yaml` 的 `uap-orchestrator`（`role: task_orchestration`，`permissions: [project_read, task_create, task_dispatch, evidence_write]`，`tools: [task_engine, state_machine, evidence_engine]`）是唯一的任务分配者，其余 10 个 Agent 均无 `task_dispatch`。
- `.uap/config/workflow-registry.yaml` 以 `steps` 列表声明 7 个工作流（`uap-bootstrap`/`uap-full-audit`/`uap-implementation`/`uap-defect-repair`/`uap-quality-gate`/`uap-financial-verification`/`uap-final-verification`）的顺序依赖；`execution` 段声明 `persist_after_each_step: true`、`resume_on_interruption: true`、`require_evidence: true`。
- `.uap/config/execution-mapping.yaml` 的 `executor_entries` 显示 `agents.registry`/`agents.execution`/`agents.collaboration` 共用 `.uap/runtime/agent-runtime/index.mjs`，`agents.recovery` 指向 `.uap/runtime/recovery-engine/index.mjs`，协作状态不得存于模块级隐式全局对象。
- `.uap/runtime/_lib/paths.mjs` 的 `FILES` 集中定义共享状态文件：`tasks`（`.uap/state/tasks.json`）、`events`（`.uap/state/events.jsonl`）、`runs`（`.uap/state/workflow-runs.json`）、`audit`（`.uap/state/audit.json`）、`taskLocks`（`.uap/state/locks.json`）、`defects`（`.uap/reports/DEFECT-REGISTRY.json`）。
- `.uap/config/specification-registry.yaml` 每条规范的 `dependencies` 字段（例如 UAP-03-003 的 `[UAP-03-001, UAP-03-002]`）是依赖任务排序与重复任务去重的机器依据。
- `.uap/config/validator-registry.yaml` 中 `agents.collaboration_integrity` 的 `checks: [task_dependencies, conflict_detection, result_consistency]` 与 `validation_policy.fail_if_required_check_skipped: true` 为协作一致性检查入口。
- `.uap/config/workflow-registry.yaml` 的 `uap-defect-repair` 工作流含 `retry.max_attempts_per_root_cause: 3`、`stop_on_permission_denied: true`、`stop_on_unrecoverable: true`，为协作失败后重新分配与恢复的约束。
- `.github/workflows/ci.yml` 的 `ueqe-review`/`backend`/`race`/`coverage` 作业与 `./scripts/verify-all.sh` 为多 Agent 汇总结果的一致性复核入口；`Makefile` 的 `make verify` 收敛全部本地门禁。
- `.uap/runtime/_lib/contract.mjs` 的 `executorResult()` 中 `result_id`（`UAP-EXR-*`）与 `task_id` 构成重复任务判定键，配合 `.uap/state/tasks.json` 的持久化状态实现去重。

## 执行流程
1. `uap-orchestrator` 读取 `.uap/config/workflow-registry.yaml` 的 `steps` 与 `.uap/config/specification-registry.yaml` 的 `dependencies`，生成 DAG 并写入 `.uap/state/workflow-runs.json`、`.uap/state/tasks.json`。
2. 执行器 `agents.collaboration`（`.uap/runtime/agent-runtime/index.mjs`）调用 `.uap/runtime/resource-manager/index.mjs` 的 `detectFileConflicts(tasks)` 检查并行任务写集合，冲突交由协调器重新排序或串行化。
3. 每个可并行任务经 `acquire(taskId, {files, ttlMs: 300000})` 获取 `.uap/state/locks.json` 锁；`MAX_CONCURRENCY = 4` 与 `ResourceConflictError` 决定排队或阻断。
4. 依赖任务按 `.uap/runtime/state-machine/index.mjs` 的 `assertTransition()` 逐边推进；重复 `task_id` 经 `.uap/state/tasks.json` 识别并去重，不重复派发。
5. 每个 Agent 的结果以 `executorResult()` 结构化返回，消息经 `event-system.publish()` 以 `task_id`/`trace_id` 关联写入 `.uap/state/events.jsonl`；关键业务决策在 `payload` 中记录来源。
6. 协调器用 `event-system.query({trace_id})` 汇总多 Agent 结果，调用独立验证器 `agents.collaboration_integrity`（`.uap/validators/agents/index.mjs`）执行 `task_dependencies`/`conflict_detection`/`result_consistency`，返回 `validatorResult()`。
7. `evidence-engine.record()` 把 DAG 快照、冲突检测输出、锁记录与汇总结论写入 `.uap/evidence/UAP-EV-*.json`，索引追加到 `.uap/reports/EVIDENCE-INDEX.md`。
8. 一致性检查通过且无 BLOCKER 后才允许工作流进入下一步（`persist_after_each_step: true`）；协作失败按 `uap-defect-repair` 的 `stop_on_*` 规则重新分配或迁移为 `BLOCKED`。

## 对应执行器
- 执行器 ID：`agents.collaboration`
- 实现路径：`.uap/runtime/agent-runtime/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：协调需 `project_read`（读取 `workflow-registry.yaml`/`specification-registry.yaml`）、`task_create`、`task_dispatch`、`evidence_write`；参与 Agent 按 `.uap/config/agent-registry.yaml` 各自权限组，写共享文件需 `project_write`。按 `.uap/config/permission-policy.yaml` 的 `default_effect: deny`、`enforcement.check_before_action: true`、`fail_closed: true` 逐动作校验；`branch_creation`/`force_push`/`destructive_git`/`quality_gate_disable` 为 deny 组，禁止协作任务自建分支或关闭门禁。

## 对应验证器
- 验证器 ID：`agents.collaboration_integrity`
- 实现路径：`.uap/validators/agents/index.mjs`
- 检查项：`[task_dependencies, conflict_detection, result_consistency]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `.uap/config/workflow-registry.yaml` | 7 个工作流的 `steps` 顺序与 `execution` 持久化/恢复策略 |
| 输入 | `.uap/config/specification-registry.yaml` | 各规范 `dependencies`，用于 DAG 排序与去重 |
| 输入 | `.uap/state/tasks.json` / `.uap/state/locks.json` | 任务持久化状态与共享资源锁，判定重复任务与冲突 |
| 输入 | `.uap/state/events.jsonl` | `UAP-EVT-*` 结构化消息，按 `task_id`/`trace_id` 关联多 Agent |
| 输入 | `.uap/config/agent-registry.yaml` | 任务负责人（Agent ID）与权限组映射 |
| 输出 | DAG 执行计划与锁记录 | `.uap/state/workflow-runs.json` 与 `.uap/state/locks.json` 中的 `acquire`/`release` 记录 |
| 输出 | 冲突检测结果 | `detectFileConflicts()` 的 `conflicts` 列表或 `ResourceConflictError` |
| 输出 | 汇总一致性结论 | `agents.collaboration_integrity` 的 `validatorResult`（含 `checks_run`、`findings`） |
| 输出 | `.uap/evidence/UAP-EV-*.json` | DAG 快照、锁记录、汇总结论与 `content_hash` 证据 |

## 失败处理
- `permission_denied`：任务所需权限组（如 `task_dispatch`）未在 Agent 声明或命中 deny 组时，迁移 `QUEUED → BLOCKED`，处置为 `block`，`stop_on_permission_denied: true` 立即停止重新分配，写 `blocked_reasons` 与审计事件。
- `missing_dependency`：DAG 前置任务或 UAP-03-001/UAP-03-002 依赖未完成、执行器模块不存在时，迁移 `QUEUED → BLOCKED`，处置为 `block`；`fail_if_required_check_skipped: true` 禁止跳过依赖边。
- `validation_failed`：`task_dependencies`/`conflict_detection`/`result_consistency` 任一 FAIL（含多 Agent 结果不一致）时迁移 `RUNNING → FAILED`，处置为 `repair_then_revalidate`，由独立验证器重跑后方可恢复 `QUEUED`。
- `retryable`：`ResourceConflictError`、锁超时等瞬时冲突按 `bounded_retry` 处理，重试上限 3 次，退避采用指数退避（1s → 2s → 4s）并在退避期内释放 `acquire()` 锁；超限迁移 `WAITING_RECOVERY → FAILED`，协作失败支持重新分配（`uap-defect-repair` 的 `max_attempts_per_root_cause: 3`）。
- `unrecoverable`：上下文版本不兼容、汇总结果不可调和时迁移为 `BLOCKED` 或 `FAILED`，处置为 `fail`，`stop_on_unrecoverable: true`；`assertTransition()` 对非法迁移抛 `IllegalTransitionError`，`fail_closed: true` 禁止重置状态隐藏失败历史。

## 验收条件
> 基线原文：任务 DAG 可执行；冲突能够检测；重复任务能够识别；协作结果可追溯。

1. 任务 DAG 可执行
2. 冲突能够检测
3. 重复任务能够识别
4. 协作结果可追溯。

## 证据要求
- 证据目录 `.uap/evidence/`，索引 `.uap/reports/EVIDENCE-INDEX.md`；文件命名 `.uap/evidence/<evidence_id>.json`，ID 格式 `UAP-EV-<14位UTC时间戳>-<8位hex>`，由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EV')` 生成。
- 证据必须记录 `command`（DAG 构建/冲突检测/一致性检查命令）、`exit_code`、`duration_ms`、`recorded_at`、`environment`、`inputs`、`stdout`、`stderr`、`artifacts`、`findings`、`summary`、`content_hash`、`task_id`、`trace_id`、`specification_ids`（含 UAP-03-003）。
- 协作可追溯性证据包括：`detectFileConflicts()` 的 `conflicts` 输出、`.uap/state/locks.json` 的 `acquire`/`release`/`expires_at` 记录、`.uap/state/events.jsonl` 的 `UAP-EVT-*` 消息链（`event_id`/`task_id`/`trace_id`/`at`）、以及关键业务决策的 `payload` 来源。
- 证据 append-only：`writeEvidence()` 对同 ID 二次写入抛错，`verify()` 用 `content_hash` 校验，`resolveAll()` 校验 `evidence_refs` 有效；失败证据（冲突、不一致、BLOCKED）不得删除或被新结果静默覆盖。
- 多 Agent 汇总结果必须附 `checks_run` 与各 Agent 的 `result_id`，`.uap/reports/EVIDENCE-INDEX.md` 必须能定位到每个原始证据；`redact()` 保证日志与报告不含明文密钥。
- 工作流按 `persist_after_each_step: true` 与 `resume_on_interruption: true` 逐步落盘，中断恢复后须保留中断前证据并新增恢复证据，不得重置状态制造「一次通过」。

## 依赖标准
- `UAP-03-001`（Agent 架构规范）：提供 11 个 Agent 的唯一 ID、职责、权限组与 `output_schema` 注册基线，使协调器能明确任务负责人、判定重复任务并解析各 Agent 的权限边界。
- `UAP-03-002`（Agent 执行规范）：提供单次任务的结构化 `executorResult` 输出、独立验证与失败分类，使多 Agent 结果汇总有统一可解析格式，并为协作失败后的重新分配提供 `blocked_reasons` 与状态迁移依据。
