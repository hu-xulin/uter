# UAP-03-001 — Agent 架构规范
> **UDS 8.0.0 状态边界：** 当前唯一设计系统 SSOT 为 `TOKEN-MANIFEST.json`（version `8.0.0`、`ACCEPTANCE_READY`、`accepted: false`）。运行时颜色语义由 manifest 派生的 `--ds8-*` bridge 提供；3.0 颜色兼容层已退役，B1–B6 迁移批次须以 `COMPAT-MAP.json` 的实时状态为准。设计系统达到 `ACCEPTANCE_READY` 不等于用户已最终接受；不得将设计系统状态等同于 Uter 全站业务合规。


**编号：** UAP-03-001
**标准编号：** UAP-03-001
**名称：** Agent 架构规范
**版本：** 1.0.0
**状态：** IMPLEMENTED_NOT_VERIFIED
**适用范围：** 适用于 UAP 运行时的全部 Agent 注册与接口定义，覆盖 `.uap/config/agent-registry.yaml` 登记的 11 个 Agent、`.uap/runtime/agent-runtime/index.mjs` 实现入口，以及 `router/`、`middleware/`、`model/`、`controller/`、`service/`、`relay/` 等被 Agent 读取的 Uter 业务代码。所有 Agent 的身份、权限与结构化输出均以本规范为准。
**关键级别：** P0
**依赖标准：** [UAP-00-001, UAP-00-003]

## 规范目标
UAP 1.0 在 Uter 仓库内以 `.uap/config/agent-registry.yaml` 登记 11 个 Agent，每个 Agent 通过 `executor_entries` 映射到可导入的 ESM 模块（如 `.uap/runtime/agent-runtime/index.mjs`、`.uap/engines/*/index.mjs`）。本规范要求这些 Agent 的身份、职责、输入输出、工具、权限、超时与可观测性全部机器可解析，禁止以文档描述代替注册表。由于 `.uap/config/validator-registry.yaml` 的 `agents.registry_integrity` 强制检查 `agent_ids / implementation_exists / permission_mapping`，Agent 架构必须能被 Runtime 加载、被验证器复验、被证据层追溯，且状态只能标注为 IMPLEMENTED_NOT_VERIFIED，不得因文件存在而宣称已验证。

## 强制性要求
1. 每个 Agent 必须有唯一 ID、名称、职责和版本。
2. 每个 Agent 必须声明输入、输出、工具、权限和依赖。
3. Agent 必须有明确的任务范围。
4. Agent 不得自行扩大权限。
5. Agent 必须支持结构化输入和输出。
6. Agent 必须具有超时和失败处理机制。
7. Agent 必须支持可观测性。
8. Agent 不得将未经验证的推断作为事实输出。
9. Agent 之间通过明确消息协议协作。
10. Agent 版本变更必须执行兼容性验证。

## Uter 落地细则
- `.uap/config/agent-registry.yaml` 登记 11 个 Agent（`uap-orchestrator`、`uap-product-agent`、`uap-architecture-agent`、`uap-development-agent`、`uap-review-agent`、`uap-test-agent`、`uap-repair-agent`、`uap-security-agent`、`uap-cross-platform-agent`、`uap-delivery-agent`、`uap-knowledge-agent`），每条含 `id`/`name`/`role`/`implementation`/`permissions`/`tools`/`output_schema` 字段。
- `.uap/config/agent-registry.yaml` 的 `defaults` 段给出硬约束：`deny_unregistered_agents: true`、`deny_undeclared_tools: true`、`enforce_permission_policy: true`、`require_structured_output: true`；未登记 Agent 与未声明工具一律拒绝。
- `.uap/config/permission-policy.yaml` 定义权限组并设 `default_effect: deny`；`enforcement` 段声明 `check_before_action: true`、`log_denied_actions: true`、`redact_secrets: true`、`fail_closed: true`；`production_read`/`production_write`/`production_deploy`/`secret_export`/`force_push`/`branch_creation`/`quality_gate_disable` 等组为 `deny`。
- `.uap/config/specification-registry.yaml` 的 `status_values` 枚举 8 态（NOT_BUILT 至 FAILED），`defaults.status: IMPLEMENTED_NOT_VERIFIED`；Agent 注册表条目的存在不得被标注为任何已验证或已运行态，禁止把「登记完成」当作「验证通过」。
- `.uap/runtime/_lib/contract.mjs` 的 `executorResult()` / `validatorResult()` 定义结构化输出契约，`assertExecutorResult()` 强制 `validation_results` 为空数组，禁止执行器自行声明验证结论；`finding(severity, code, message, extra)` 定义发现结构。
- `.uap/runtime/_lib/util.mjs` 的 `newId(prefix)` 生成形如 `UAP-EXR-<14位时间戳>-<8位hex>` 的唯一 ID，`redact()` 脱敏 `AIza`/`whsec_`/`sk-`/`ghp_` 及密码赋值模式，保证 Agent 输出不泄露密钥。
- `.uap/runtime/event-system/index.mjs` 的 `publish(type, payload, {trace_id, task_id, severity})` 生成 `UAP-EVT-*` 结构化事件并追加到 `.uap/state/events.jsonl`；`query({task_id, type, trace_id, since})` 与 `replay()` 提供按任务 ID 的可观测性。
- `.uap/runtime/evidence-engine/index.mjs` 的 `health()` 以 `health_probe` 自检证据持久化、`content_hash` 哈希校验、同 ID 覆盖被拒、原始记录未被改动、密钥脱敏；`record()` 落盘到 `.uap/evidence/<evidence_id>.json`。
- `.uap/config/execution-mapping.yaml` 的 `execution_contract.required_input`（`task_id`/`specification_ids`/`scope`/`constraints`/`acceptance_criteria`）与 `required_output`（`status`/`summary`/`changed_files`/`validation_results`/`evidence_refs`/`blocked_reasons`）为每个 Agent 的输入输出基线。
- `.uap/config/execution-mapping.yaml` 的 `executor_entries` 把 `agents.registry`/`agents.execution`/`agents.collaboration` 共同映射到 `.uap/runtime/agent-runtime/index.mjs`，`agents.recovery` 映射到 `.uap/runtime/recovery-engine/index.mjs`；目录分组 `engines.agents` 只是逻辑归组。
- `.uap/config/validator-registry.yaml` 中 `agents.registry_integrity` 的 `checks: [agent_ids, implementation_exists, permission_mapping]` 与 `validation_policy.fail_if_validator_missing: true`、`fail_if_validator_not_executable: true` 为登记完整性的机器校验入口。
- `.uap/runtime/_lib/paths.mjs` 的 `FILES` 集中定义 `tasks`（`.uap/state/tasks.json`）、`events`（`.uap/state/events.jsonl`）、`audit`（`.uap/state/audit.json`）、`evidenceIndex`（`.uap/reports/EVIDENCE-INDEX.md`），Agent 不得在内存或隐式全局状态中传递任务。
- `AGENTS.md`「AI Agent Operating Discipline → Rule Auto-Loading」要求 Agent 行动前加载 `AGENTS.md`、`web/AGENTS.md`、`docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md`，作为任务上下文的强制输入来源。
- `.uap/config/workflow-registry.yaml` 的 `uap-final-verification` 工作流包含 `validate_all_agents` 步骤，`uap-bootstrap` 包含 `validate_specification_registry` 与 `run_runtime_tests`，为 Agent 版本变更后的兼容性验证入口。

## 执行流程
1. `uap-orchestrator`（`.uap/runtime/agent-runtime/index.mjs`，角色 `task_orchestration`）发起 `agents.registry` 执行，读取 `.uap/config/agent-registry.yaml` 与 `.uap/config/permission-policy.yaml`。
2. 执行器按 `registry` 逐条解析 11 个 Agent 的 `id`/`implementation`/`permissions`/`tools`/`output_schema`，并比对 `.uap/config/execution-mapping.yaml` 的 `executor_entries` 路径是否存在。
3. 执行器通过 `.uap/runtime/policy-engine/index.mjs`（`security.policy`）对每个权限组做 `check_before_action` 校验；命中 `deny` 组即中止并写 `blocked_reasons`。
4. 执行器调用 `.uap/runtime/_lib/contract.mjs` 的 `executorResult()` 生成结构化结果，写入 `.uap/state/tasks.json`；同时用 `event-system.publish()` 追加 `UAP-EVT-*` 事件到 `.uap/state/events.jsonl`。
5. 独立验证器 `agents.registry_integrity`（`.uap/validators/agents/index.mjs`）执行 `agent_ids`、`implementation_exists`、`permission_mapping` 三项检查，返回 `validatorResult()`。
6. `.uap/runtime/evidence-engine/index.mjs` 的 `record()` 把注册快照、命令、退出码、`content_hash` 写入 `.uap/evidence/UAP-EV-*.json`，并在 `.uap/reports/EVIDENCE-INDEX.md` 追加索引行。
7. 版本变更时由 `uap-final-verification` 的 `validate_all_agents` 步骤重跑登记一致性检查，产生新的 `evidence_id`，旧证据保持不可覆盖。
8. 任何步骤未执行完成即保持 `IMPLEMENTED_NOT_VERIFIED` 状态，不得迁移到任何已验证态。

## 对应执行器
- 执行器 ID：`agents.registry`
- 实现路径：`.uap/runtime/agent-runtime/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：需 `project_read` 读取 `AGENTS.md` 与全部 YAML 配置、`evidence_write` 写入证据；按 `.uap/config/permission-policy.yaml` 的 `default_effect: deny` 与 `enforcement.check_before_action: true` 逐动作校验，`fail_closed: true`。写类扩展需 `project_write`（`preserve_uncommitted_changes: true`、`forbid_destructive_git_operations: true`）；`uap-orchestrator` 另需 `task_create` 与 `task_dispatch`。禁止 `production_write`、`production_deploy`、`branch_creation`、`quality_gate_disable` 等 deny 组。

## 对应验证器
- 验证器 ID：`agents.registry_integrity`
- 实现路径：`.uap/validators/agents/index.mjs`
- 检查项：`[agent_ids, implementation_exists, permission_mapping]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `.uap/config/agent-registry.yaml` | 11 个 Agent 的 `id`/`name`/`role`/`implementation`/`permissions`/`tools`/`output_schema` 与 `defaults` |
| 输入 | `.uap/config/permission-policy.yaml` | `permission_groups` 与 `enforcement`，用于解析每个 Agent 的权限组是否合法 |
| 输入 | `.uap/config/execution-mapping.yaml` | `executor_entries` 与 `execution_contract`，用于校验实现路径与输入输出契约 |
| 输入 | `AGENTS.md` / `web/AGENTS.md` | Agent 行动前必须加载的仓库级与前端级约定 |
| 输出 | `executorResult` 结构化结果 | 含 `result_id`/`task_id`/`executor_id`/`status`/`summary`/`changed_files`/`evidence_refs`/`blocked_reasons` |
| 输出 | `.uap/state/tasks.json` / `.uap/state/events.jsonl` | 注册任务的持久化状态与 `UAP-EVT-*` 事件记录 |
| 输出 | `.uap/evidence/UAP-EV-*.json` | 注册快照证据，含 `command`/`exit_code`/`recorded_at`/`environment`/`content_hash` |
| 输出 | `.uap/reports/EVIDENCE-INDEX.md` | 证据 ID 索引行，供报告追溯原始记录 |

## 失败处理
- `permission_denied`：命中 `.uap/config/permission-policy.yaml` 的 `deny` 组或 `default_effect: deny` 时，执行器立即停止动作，任务状态迁移 `RUNNING → BLOCKED`，写 `blocked_reasons`，记录审计事件；处置为 `block`，不得绕过检查，且 `stop_on_permission_denied: true`。
- `missing_dependency`：`agent-registry.yaml` 引用的实现路径、工具或 `UAP-00-001`/`UAP-00-003` 依赖不可解析时，迁移 `QUEUED → BLOCKED`，处置为 `block`，`fail_if_validator_missing: true` 使验证器缺失同样阻断。
- `validation_failed`：`agent_ids`/`implementation_exists`/`permission_mapping` 任一检查 FAIL 时，迁移为 `FAILED` 并进入 `repair_then_revalidate`，修复后必须由同一验证器重新执行，不得直接改判 PASS。
- `retryable`：工具瞬时不可用时按 `bounded_retry` 处理，重试上限 3 次（`execution.max_repair_attempts_per_root_cause: 3`），退避采用指数退避（初始 1s、倍率 2、上限 4s），每次重试产生独立证据 ID；超限迁移 `WAITING_RECOVERY → FAILED`。
- `unrecoverable`：注册表结构损坏或版本不兼容且无法安全修复时，迁移为 `FAILED` 或 `BLOCKED`，处置为 `fail`，保留全部失败证据；状态机 `assertTransition()` 对非法迁移抛 `IllegalTransitionError`，`fail_closed: true` 保证不静默改状态。

## 验收条件
> 基线原文：所有 Agent 已登记；所有 Agent 权限可解析；Agent 能通过 Runtime 被调用；Agent 接口有测试。

1. 所有 Agent 已登记
2. 所有 Agent 权限可解析
3. Agent 能通过 Runtime 被调用
4. Agent 接口有测试。

## 证据要求
- 证据目录为 `.uap/evidence/`，索引为 `.uap/reports/EVIDENCE-INDEX.md`（`.uap/runtime/_lib/paths.mjs` 的 `EVIDENCE`/`FILES.evidenceIndex`）；每个证据文件命名 `.uap/evidence/<evidence_id>.json`。
- 证据 ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EV')` 生成，格式 `UAP-EV-<14位UTC时间戳>-<8位hex>`，全局唯一且稳定。
- 每条证据必须记录：`command`（实际执行的解析/校验命令）、`exit_code`、`duration_ms`、`recorded_at`（ISO 8601）、`environment`（platform/node/cwd/uap_root）、`inputs`、`stdout`、`stderr`、`artifacts`、`findings`、`summary`、`content_hash`（sha256）、`task_id`、`trace_id`、`specification_ids`（含 UAP-03-001）。
- 证据采用 append-only：`.uap/runtime/_lib/util.mjs` 的 `writeEvidence()` 对同 ID 二次写入抛错；`.uap/runtime/evidence-engine/index.mjs` 的 `verify()` 用 `content_hash` 校验未被篡改，`resolveAll()` 校验 `evidence_refs` 有效。
- 失败证据不得删除或覆盖以制造通过结果；`health()` 的 `overwrite_rejected`/`original_untouched` 两项自检必须为真。日志与报告中的敏感值经 `redact()` 脱敏，禁止写入密钥、Token、密码。
- 报告必须能经 `.uap/reports/EVIDENCE-INDEX.md` 定位到原始证据记录；未产生证据的执行不得标注为已验证，状态保持 IMPLEMENTED_NOT_VERIFIED。

## 依赖标准
- `UAP-00-001`（UAP 核心架构规范）：提供分层架构、模块边界、稳定接口与可追溯性基线，定义执行器/验证器/证据层的映射规则，使 Agent 注册表与 `executor_entries` 可解析。
- `UAP-00-003`（自主工程安全边界规范）：提供最小权限、fail-closed、模拟/生产隔离与密钥脱敏策略，`.uap/config/permission-policy.yaml` 的权限组与 deny 规则即其落地，约束 Agent 不得自行扩大权限。
