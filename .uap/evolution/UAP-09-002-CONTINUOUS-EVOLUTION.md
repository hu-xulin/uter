# UAP-09-002 — 持续进化规范
> **UDS 7.0 状态边界：** 当前文档/Token SSOT 为 UDS 7.0（`ACCEPTANCE_READY`、`accepted: false`）。指定运行时标量 Token 与图表色已切换到 7.0 值；UDS 3.0 兼容层仍须保留，未迁移页面不得假定已完成全站切换。页面级状态以 `COMPAT-MAP.json` 和 `FINAL-ACCEPTANCE-REPORT.md` 的本次证据为准，不得将局部 Token 迁移等同于整体验收。


**编号：** UAP-09-002
**标准编号：** UAP-09-002
**名称：** 持续进化规范
**版本：** 1.0.0
**状态：** ACTIVE
**适用范围：** 约束 UAP 1.0 治理体系自身的定期检查、改进提案、影响分析、回归验证与配置回滚，覆盖 `.uap/config/specification-registry.yaml`（32 条规范 DAG）、`execution-mapping.yaml`（`executor_entries`）、`validator-registry.yaml`、`workflow-registry.yaml`（7 个工作流，含 `uap-full-audit` / `uap-final-verification` / `uap-defect-repair` / `uap-implementation`）、`.uap/state/BASELINE.json`、`.github/workflows/nightly-full-audit.yml` 与 `weekly-security-audit.yml`，以及 `.uap/runtime/recovery-engine/index.mjs` 与 `.uap/evidence/`。进化全程受 `permission-policy.yaml` 的 `default_effect: deny` 与 `quality_gate_disable: deny` 约束，UAP 不得自行授予自己更高权限。
**关键级别：** P2
**依赖标准：** UAP-09-001、UAP-05-004

## 规范目标
本规范要求 UAP 定期检查规范、配置、执行器与验证器的一致性，基于真实运行失败与质量数据识别重复缺陷和系统性根因，提出可验证的改进方案并做影响分析、回归验证与配置回滚。目标是使「自动进化」不能成为降低安全/质量标准、绕过权限策略或循环放宽标准的理由，任何进化都必须留下前后指标与证据，且失败时能恢复原配置。

## 强制性要求
1. UAP 必须定期检查规范、配置、执行器和验证器的一致性。
2. 必须收集真实运行失败和质量数据。
3. 必须识别重复缺陷和系统性根因。
4. 必须提出可验证的改进方案。
5. 改进必须经过影响分析。
6. 不得自行降低安全和质量标准。
7. 不得以自动进化为理由绕过权限策略。
8. 规范升级必须维护版本和兼容性。
9. 旧规范废弃必须记录替代关系。
10. 每次进化必须运行相关回归测试。
11. 进化失败必须能够恢复原配置。
12. 必须记录进化前后指标和证据。
13. 必须防止自动修改规范导致循环放宽标准。
14. UAP 不得自行授予自己更高权限。

## Uter 落地细则
- 定期检查一致性由 `workflow-registry.yaml` 的两个工作流落地：`uap-full-audit`（steps `inspect_project → scan_requirements → scan_architecture → scan_agents → scan_development → scan_quality → scan_security → scan_cross_platform → scan_delivery → scan_knowledge → build_defect_registry`，`acceptance: audit_evidence_complete`）与 `uap-final-verification`（`validate_all_specifications → validate_all_executors → validate_all_agents → validate_all_workflows → validate_all_validators → run_full_quality_gate → run_end_to_end_workflows → verify_recovery → generate_final_report`，`acceptance: full_operational_acceptance`）；周期触发由 `.github/workflows/nightly-full-audit.yml`（`on: schedule` + `workflow_dispatch`，jobs `quality-gate` / `coverage` / `secrets` / `report`）与 `.github/workflows/weekly-security-audit.yml`（`on: schedule` + `workflow_dispatch`，jobs `vulnerabilities` / `secrets` / `workflow-permissions` / `report`）提供。
- 一致性检查对象具体为：`.uap/config/specification-registry.yaml` 的 32 条 `id` / `file` / `executor` / `validator` / `dependencies`、`execution-mapping.yaml` 的 32 个 `executor_entries`（真实 ESM 模块路径）、`validator-registry.yaml` 的 `target` / `implementation` / `checks`、`agent-registry.yaml` 的 11 个 agent 与 `defaults.deny_unregistered_agents: true`、以及 `workflow-registry.yaml` 的 7 个工作流；`.uap/runtime/_lib/yaml.mjs` 的 `parseYAML()` 是统一解析入口，禁止运行时硬编码映射表。
- 收集真实运行失败与质量数据：`scripts/verify-all.sh` 输出「门禁汇总」表（检查项 / PASS|FAIL|SKIP / 耗时 / 退出码）与「失败项复现命令」，并定义退出码 `0/1/2`（全量模式存在任一 SKIP 即 `exit 2`，第 208–211 行）；`.uap/evidence/` 与 `.uap/reports/EVIDENCE-INDEX.md` 保存每次执行记录；`validator-registry.yaml` 的 `validation_policy`（`fail_if_validator_missing` / `fail_if_validator_not_executable` / `fail_if_evidence_missing` / `fail_if_required_check_skipped` / `allow_explicit_blocked_status`）是质量数据口径；禁止用「已检查 / tests passed / looks correct」代替真实数据（`AGENTS.md` Verification Evidence）。
- 识别重复缺陷与系统性根因：`uap-full-audit` 的 `build_defect_registry` 步骤汇总缺陷；`uap-defect-repair` 的 steps 为 `classify_defect → identify_root_cause → calculate_impact → generate_repair_plan → apply_authorized_repair → run_regression → independent_review → persist_evidence`，其 `retry.max_attempts_per_root_cause: 3`、`stop_on_permission_denied: true`、`stop_on_unrecoverable: true`、`acceptance: defect_verified_or_blocked`；`execution-mapping.yaml` 的 `max_repair_attempts_per_root_cause: 3` 与 `failure_policy` 五类失败（`permission_denied` / `missing_dependency` / `validation_failed` / `retryable` / `unrecoverable`）提供分类维度。
- 提出可验证的改进方案：`workflow-registry.yaml` 的 `uap-implementation`（steps `resolve_dependencies → create_execution_plan → implement_missing_capabilities → implement_missing_validators → integrate_runtime → execute_targeted_tests`，`acceptance: implementation_verified`）；每个改进方案必须绑定规范 ID、执行器 ID、验证器 ID、`checks` 与可复现命令，并写入 `.uap/evidence/`，否则视为不可验证。
- 改进必须经过影响分析：`specification-registry.yaml` 的 `dependencies` 构成 32 条规范的 DAG（例如 `UAP-09-002` 依赖 `UAP-09-001` 与 `UAP-05-004`、`UAP-08-002` 依赖 `UAP-08-001` 与 `UAP-06-003`）；`uap-defect-repair` 的 `calculate_impact` 与 `UAP-01-001` 的需求变更影响分析（覆盖 API、数据库、前端、后端、测试、文档）是模板；`execution-mapping.yaml` 的 `executor_entries` 与 `validator-registry.yaml` 的 `target` 用于判断改动波及的执行器/验证器集合。
- **不得自行降低安全和质量标准**：`permission-policy.yaml` 的 `quality_gate_disable: deny`、`test_deletion_to_force_pass: deny`、`production_read` / `production_write` / `production_deploy` 均为 `deny`；`validator-registry.yaml` 的 `fail_if_required_check_skipped: true` 与 `fail_if_validator_missing: true`；`AGENTS.md` Automated Quality Gates「Non-zero exit is a stop condition, not a warning」「never declare work done while an applicable gate is red」；`UAP-05-004` 规定豁免必须有范围、理由、期限和证据且不能由被审查任务自行创建。进化提案若涉及降低阈值/关闭门禁/删除测试，一律拒绝。
- **不得以自动进化为理由绕过权限策略**：`permission-policy.yaml` 的 `branch_creation: deny`、`branch_switch: deny`、`force_push: deny`、`destructive_git: deny`、`secret_export: deny`、`default_effect: deny`、`enforcement.fail_closed: true`；`execution-mapping.yaml` 的 `branch_policy: no_branch_creation`、`preserve_user_changes: true`、`dry_run_for_production: true`；`AGENTS.md` Project Governance 明确 Pull Requests 被禁用（Agents MUST NOT create, update, review or merge Pull Requests）；`AGENTS.md` Change Protection 要求先 `git status --short`、只 `git add <path>`、禁止 `rm -rf` / `git clean -fd`。
- 规范升级维护版本和兼容性：每份正式规范头部固定 `版本：1.0.0` 与 `状态：ACTIVE` / `IMPLEMENTED_NOT_VERIFIED` 二选一（状态字段绝不允许使用任何「已验证/已运营」类取值，验证完成态必须有完整证据后方可进入）；`specification-registry.yaml` 的 `schema_version: "1.0"`、`platform_version: "1.0.0"`、`status_values` 八态；`web/AGENTS.md` 的「更新日志」是逐条日期的版本化变更记录范例；`pkg/billingexpr/expr.md` 记录表达式版本化。升级必须核对 `dependencies` 兼容、`executor_entries` 路径可导入、`checks` 仍被验证器实现覆盖。
- 旧规范废弃必须记录替代关系：`AGENTS.md` Rule Auto-Loading 的「Task-based spec routing (mandatory)」声明旧的领域规范语料库已于 2026-11-12 退役、在新体系发布前约束来源为 `AGENTS.md`、`web/AGENTS.md` 与 `docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md`；`.uap/tools/spec-baseline.md` 自我标注「生成输入，不是交付规范」，正式交付为 `.uap/{domain}/UAP-xx-xxx-*.md`；`specification-registry.yaml` 的 `dependencies` 提供规范间替代/依赖链；废弃记录须写明替代文件与生效时间，不得静默删除。
- 每次进化必须运行相关回归测试：`uap-defect-repair` 的 `run_regression` + `independent_review`、`uap-implementation` 的 `execute_targeted_tests`、`uap-final-verification` 的 `run_full_quality_gate` / `run_end_to_end_workflows` / `verify_recovery`；真实命令集合 `./scripts/verify-all.sh`（全量有 SKIP 即 `exit 2`）、`gofmt -l .`、`GOWORK=off go vet ./...`、`make test`、`cd web && bun run typecheck|lint|test|lint:design:strict|copyright:check|format:check|build:check`；`.github/workflows/ci.yml` 的 `race`（`go test -race -count=1`）与 `coverage`（`./scripts/coverage-gate.sh ... controller=39 model=45 service=43 middleware=62`）为回归下限。
- 进化失败必须能恢复原配置：`workflow-registry.yaml` 的 `execution.persist_after_each_step: true`、`resume_on_interruption: true`、`require_evidence: true`；`.uap/runtime/recovery-engine/index.mjs` 与 `execution-mapping.yaml` 的 `preserve_user_changes: true`；恢复依据是持久化配置快照（`.uap/config/*.yaml` 与 `.uap/state/BASELINE.json`）而非 git 破坏性操作——`branch_switch: deny` / `destructive_git: deny` / `force_push: deny` 禁止 `git reset --hard` / `git checkout --`；`AGENTS.md` Change Protection 同步要求保护未提交改动。
- 记录进化前后指标和证据：`.uap/state/BASELINE.json` 的 `baseline_id: UAP-BASELINE-2026-11-12T10-19-06Z`、`captured_at`、`git.porcelain_entry_count: 0`、`toolchain`（Go `go1.27.4` / Node `v22.22.2` / Bun `1.4.2`）、9 个 `ci_workflows` 与 `real_gate_commands` 是前值基线；进化后须记录规范数量、执行器/验证器覆盖数、门禁 PASS/FAIL/SKIP 计数、退出码与证据 ID；前后写入 `.uap/evidence/` 并索引到 `.uap/reports/EVIDENCE-INDEX.md`。
- 防止自动修改规范导致循环放宽标准、UAP 不得自行授予自己更高权限：`specification-registry.yaml` 的 `defaults.required_executor: true` / `required_validator: true` / `evidence_required: true` 与 `status_values` 构成硬下限；`agent-registry.yaml` 的 `defaults.deny_unregistered_agents: true` / `deny_undeclared_tools: true` / `enforce_permission_policy: true` / `require_structured_output: true`；`permission-policy.yaml` 的 `default_effect: deny` 使任何未显式授权的动作被拒绝，`enforcement.log_denied_actions: true` / `log_sensitive_actions: true` 记录越权尝试；规范文件本身受 `AGENTS.md` Documentation files 约束，未经明确请求不得在 `docs/` 下新增文件。

## 执行流程
1. `uap-orchestrator`（`.uap/runtime/agent-runtime/index.mjs`，权限 `project_read/task_create/task_dispatch/evidence_write`）读取 `specification-registry.yaml`，按 DAG 顺序确认 `UAP-09-002` 的两个依赖 `UAP-09-001` 与 `UAP-05-004` 均已满足，创建结构化任务（`task_id` / `specification_ids` / `scope` / `constraints` / `acceptance_criteria`）。
2. Orchestrator 经 `.uap/runtime/_lib/yaml.mjs` 加载 `execution-mapping.yaml`，解析 `evolution.continuous` → `.uap/engines/knowledge/index.mjs`，动态 `import()` 并调用 `health(ctx)`；同时由 `.uap/runtime/policy-engine/index.mjs` 校验 `quality_gate_disable` / `branch_creation` / `destructive_git` 等为 `deny`，确认 `default_effect: deny`。
3. 执行器按 `uap-full-audit` 的 `scan_*` 步骤收集一致性数据：用 `parseYAML()` 解析四份注册中心，逐条核对 32 条规范是否有 `file` / `executor` / `validator`、`executor_entries` 是否可导入、`validator-registry.yaml` 的 `target` / `checks` 是否与规范对应，识别「规范与执行偏差」。
4. 执行器收集真实失败与质量数据：读取 `.uap/evidence/`（经 `util.mjs` 的 `readJSONL()`）、`scripts/verify-all.sh` 的门禁汇总与失败项复现命令，按 `failure_policy` 五类聚合，识别重复缺陷与系统性根因，形成 `change_impact` 输入。
5. 执行器生成改进提案：绑定规范 ID / 执行器 ID / 验证器 ID / `checks` / 可复现命令，沿 `specification-registry.yaml` 的 `dependencies` 做影响分析（含 API、数据库、前端、后端、测试、文档维度）；提案若涉及降低门禁阈值、关闭检查、删除测试或提升自身权限，直接拒绝并记为 `severity=BLOCKER`。
6. 执行器执行 `regression`：运行 `./scripts/verify-all.sh`（全量）、`gofmt -l .`、`GOWORK=off go vet ./...`、`make test` 与 `web/package.json` 的 typecheck / lint / test / lint:design:strict / build:check，逐条记录命令与退出码；保存进化前配置快照到 `.uap/evidence/` 以便 `rollback`。
7. 执行器用 `contract.mjs` 的 `executorResult()` 归一化输出；证据写入 `.uap/evidence/`（`newId('UAP-EVD')`），记录进化前后指标（规范/执行器/验证器覆盖数、门禁 PASS/FAIL/SKIP、退出码）、命令、ISO 8601 时间、环境（`.uap/state/BASELINE.json`）、输入输出与日志引用，索引追加 `.uap/reports/EVIDENCE-INDEX.md`；若改进失败，按持久化快照恢复原配置（不执行 git 破坏性操作）。
8. `evolution.evolution_integrity` 验证器（`.uap/validators/evolution/index.mjs`）执行 `change_impact` / `regression` / `rollback` 并返回 `validatorResult()`；仅当 `executed=true && exit_code=0` 且 findings 无 `severity=BLOCKER` 时判 PASS；安全/质量门禁被弱化、权限越界、回归未跑或回滚不可用时 fail-closed 记为 BLOCKED/FAIL 并保留失败证据。

## 对应执行器
- 执行器 ID：`evolution.continuous`
- 实现路径：`.uap/engines/knowledge/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：按 `.uap/config/agent-registry.yaml` 的 `uap-knowledge-agent`（`[project_read, knowledge_write, evidence_write]`，tools `knowledge_engine` / `traceability_engine`）与 `.uap/config/permission-policy.yaml` 执行：需要 `project_read`（读注册中心、规范、证据、基线）、`knowledge_write`（受 `AGENTS.md` Documentation files 约束）、`evidence_write`、以及回归验证所需的 `local_command`（`require_command_logging: true`、`forbid_secret_exfiltration: true`）与 `test_environment`（`isolated_environment_only: true`）。**`quality_gate_disable: deny`、`test_deletion_to_force_pass: deny`、`production_read` / `production_write` / `production_deploy: deny`、`branch_creation` / `branch_switch` / `force_push` / `destructive_git: deny`、`secret_export: deny` 是本执行器的硬边界**；`default_effect: deny` 与 `enforcement.fail_closed: true` 保证 UAP 不得自行授予自己更高权限；受 `check_before_action: true`、`log_denied_actions: true`、`log_sensitive_actions: true`、`redact_secrets: true` 约束。

## 对应验证器
- 验证器 ID：`evolution.evolution_integrity`
- 实现路径：`.uap/validators/evolution/index.mjs`
- 检查项：`[change_impact, regression, rollback]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `task_id` | 任务唯一 ID，来自 `execution-mapping.yaml` 的 `execution_contract.required_input` |
| 输入 | `specification_ids` | 关联规范 ID：`[UAP-09-002]` 及依赖 `UAP-09-001`、`UAP-05-004` |
| 输入 | `scope` | 范围：`.uap/config/*.yaml`、32 份正式规范、`workflow-registry.yaml` 7 个工作流、`.uap/evidence/`、`.uap/state/BASELINE.json` |
| 输入 | `baseline_metrics` | 进化前指标：取自 `.uap/state/BASELINE.json`（`baseline_id`、`toolchain`、9 个 `ci_workflows`、`real_gate_commands`）与历史门禁 PASS/FAIL/SKIP 计数 |
| 输入 | `constraints` | 约束：不得降低安全/质量门禁、不得绕过权限策略、不得自行提权、必须影响分析与回归、fail-closed |
| 输入 | `acceptance_criteria` | 验收标准：能够发现规范与执行偏差、能够提出改进方案、改进过程有验证和回滚、安全和质量门禁不可被自动弱化 |
| 输出 | `executorResult` | 由 `contract.mjs` 的 `executorResult()` 归一化的结构化执行结果 |
| 输出 | `status` / `summary` / `changed_files` | 执行状态、摘要、变更文件清单 |
| 输出 | `change_impact` | 影响分析：依赖 DAG 波及范围、改进提案与可复现命令、被拒绝的越权/降标提案 |
| 输出 | `validation_results` | 由 `evolution.evolution_integrity` 独立回填的三类检查结果 |
| 输出 | `regression` | 全量门禁与测试的命令/退出码/PASS/FAIL/SKIP 明细 |
| 输出 | `rollback` | 进化前配置快照引用与恢复验证结果 |
| 输出 | `evidence_refs` | 指向 `.uap/evidence/` 的证据 ID 列表（含前后指标） |
| 输出 | `blocked_reasons` | 阻断原因（含门禁被弱化、越权、回归失败、回滚不可用） |
| 输出 | `validatorResult` | `validatorResult()` 返回的机器可读判定 |

## 失败处理
按 `.uap/config/execution-mapping.yaml` 的 `execution.failure_policy` 与 `.uap/config/permission-policy.yaml` 的 `enforcement.fail_closed: true`（`default_effect: deny`）逐类处置：
1. **permission_denied**：执行前由 `.uap/runtime/policy-engine/index.mjs` 校验权限组；任何试图关闭门禁（`quality_gate_disable: deny`）、删除测试制造通过（`test_deletion_to_force_pass: deny`）、创建/切换分支（`branch_creation` / `branch_switch: deny`）、破坏性 git（`destructive_git: deny`）或自行提升权限的请求，立即拒绝并记录 `log_denied_actions` / `log_sensitive_actions`，处置策略 `block`，任务由 RUNNING 迁移为 BLOCKED，不重试、不绕过、不自授权。
2. **missing_dependency**：`.uap/engines/knowledge/index.mjs` 无法导入、`health()` 缺失、`UAP-09-001` / `UAP-05-004` 任一依赖未满足、四份注册中心不可解析、`.uap/state/BASELINE.json` 缺失或 `parseYAML()` 失败时，处置策略 `block`，任务迁移 BLOCKED 并写入 `blocked_reasons`，补齐后由 Orchestrator 重新排队（QUEUED）。
3. **validation_failed**：`change_impact` 未覆盖受影响规范/执行器/验证器、`regression` 任一门禁非零退出或出现 SKIP（全量 `exit 2`）、`rollback` 无法恢复原配置，或 findings 含 `severity=BLOCKER`（安全/质量门禁被弱化）时，处置策略 `repair_then_revalidate`，交 `uap-defect-repair` 修复后复验；未复验通过不得标记 SUCCEEDED，且必须先按持久化快照恢复原配置再重试。
4. **retryable**：处置策略 `bounded_retry`，重试上限 **3 次**（`execution.max_repair_attempts_per_root_cause: 3` 与 `uap-defect-repair.retry.max_attempts_per_root_cause: 3`），退避采用指数退避（第 n 次等待 `base × 2^(n-1)`，base=1s，上限 8s，附随机抖动）；每次重试写入独立证据；恢复执行须校验 `task_id` / `result_id` 幂等，禁止重放非幂等副作用，禁止通过重复放宽阈值制造通过。
5. **unrecoverable**：处置策略 `fail`，任务迁移 FAILED 并保留全部失败证据与进化前配置快照；按 `contract.mjs` 的 `TASK_TRANSITIONS`，FAILED 仅允许 → QUEUED / BLOCKED / CANCELLED，禁止重置状态隐藏失败，禁止删除失败证据或降标记录制造通过。
全局 fail-closed：验证器缺失（`fail_if_validator_missing: true`）、验证器不可执行（`fail_if_validator_not_executable: true`）、证据缺失（`fail_if_evidence_missing: true`）或必需检查被跳过（`fail_if_required_check_skipped: true`）时，结果一律按 BLOCKED / FAIL 处理，绝不降级为 PASS；`allow_explicit_blocked_status: true` 只允许显式声明 BLOCKED，不允许隐式跳过；`stop_on_critical_security_failure: true` 与 `stop_on_unrecoverable_data_integrity_failure: true` 使安全/数据完整性失败直接终止工作流。

## 验收条件
1. 能够发现规范与执行偏差。
2. 能够提出改进方案。
3. 改进过程有验证和回滚。
4. 安全和质量门禁不可被自动弱化。

## 证据要求
- 证据统一落盘到 `.uap/evidence/`，索引写入 `.uap/reports/EVIDENCE-INDEX.md`；证据 ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EVD')` 生成稳定唯一 ID（格式 `UAP-EVD-<时间戳>-<随机>`），禁止与历史证据复用；落盘使用 `writeEvidence()` / `appendJSONL()`，报告文本经 `redact()` 脱敏。
- 每条证据必须记录：执行命令原文（如 `./scripts/verify-all.sh`、`gofmt -l .`、`GOWORK=off go vet ./...`、`make test`、`cd web && bun run typecheck|lint|test|lint:design:strict|copyright:check|format:check|build:check`）、`exit_code`、开始/结束时间（ISO 8601，由 `nowISO()` 生成）、环境（取自 `.uap/state/BASELINE.json` 的 toolchain：Go `go1.27.4` / Node `v22.22.2` / Bun `1.4.2` 与 `baseline_id`）、输入（`task_id` / `specification_ids` / `baseline_metrics` / `constraints`）、输出（`executorResult` 或 `validatorResult` 全文）以及日志引用路径（`.uap/reports/EVIDENCE-INDEX.md`、`scripts/verify-all.sh` 门禁汇总、`.github/workflows/nightly-full-audit.yml` / `weekly-security-audit.yml` 的 `report` job、`uap-defect-repair` 的 `persist_evidence` 步骤）。
- 证据必须成对记录**进化前后指标**：规范/执行器/验证器覆盖数量、门禁 PASS/FAIL/SKIP 计数、退出码、`baseline_id` 与进化后 `captured_at` 时间点；必须包含 `change_impact` 影响分析全文、改进提案的可复现命令、被拒绝的越权/降标提案，以及 `rollback` 使用的进化前配置快照引用与恢复验证结论。
- 验证结果由 `contract.mjs` 的 `validatorResult()` 归一化为 `{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；`PASS` 仅在 `executed=true && exit_code=0` 且 findings 无 `severity=BLOCKER` 时成立；任何门禁弱化、越权尝试、回归 SKIP 或回滚不可用必须原样记录为 BLOCKED / NOT_EXECUTED，不得改写为 PASS；`AGENTS.md` Verification Evidence 要求已知失败或跳过项不得省略。
- **证据不可覆盖**：新结果写入新证据文件，禁止覆盖历史记录与进化前配置快照；`execution.persist_task_state: true` 保证状态持久化。**失败证据不可删除**：BLOCKED / FAILED / NOT_EXECUTED / 门禁 `exit 2` / 被拒绝的降标提案记录必须保留，禁止以删除失败证据、删除失败测试或降低门禁制造通过结果；报告须能经 `evidence_refs` 反查原始记录；状态迁移受 `TASK_TRANSITIONS` 约束。

## 依赖标准
- **UAP-09-001（知识管理规范）**：`.uap/config/specification-registry.yaml` 中 `UAP-09-002` 的 `dependencies` 第一项。它要求项目知识有明确来源、适用范围、更新时间，可检索，能识别过时/冲突/重复知识，知识与实际代码不一致必须产生差异记录，Agent 使用知识可追溯来源，推测不得存为已确认事实，重要决策必须有证据。本规范据此用 `uap-full-audit` 的 `scan_knowledge` / `build_defect_registry` 与四份注册中心的一致性比对「发现规范与执行偏差」，并把差异记录作为可验证改进方案的来源。
- **UAP-05-004（质量门禁规范）**：`dependencies` 第二项。它要求全部门禁机器可执行、版本控制、真实阻断，定义输入/执行器/阈值/失败条件/证据，支持单项与全量执行，豁免须有范围/理由/期限/证据且不得由被审查任务自行创建，禁止未经审计临时关闭门禁。本规范据此把 `./scripts/verify-all.sh` 全量（有 SKIP 即 `exit 2`）与 `.github/workflows/ci.yml` 的 `race` / `coverage` 作为每次进化必跑的 `regression`，并以 `quality_gate_disable: deny`、`test_deletion_to_force_pass: deny`、`fail_if_required_check_skipped: true` 保证「安全和质量门禁不可被自动弱化」。
