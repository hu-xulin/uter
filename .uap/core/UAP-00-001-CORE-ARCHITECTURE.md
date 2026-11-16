# UAP-00-001 — UAP 核心架构规范
> **UDS 7.0 状态边界：** 当前文档/Token SSOT 为 UDS 7.0（`ACCEPTANCE_READY`、`accepted: false`）。指定运行时标量 Token 与图表色已切换到 7.0 值；UDS 3.0 兼容层仍须保留，未迁移页面不得假定已完成全站切换。页面级状态以 `COMPAT-MAP.json` 和 `FINAL-ACCEPTANCE-REPORT.md` 的本次证据为准，不得将局部 Token 迁移等同于整体验收。


**编号：** UAP-00-001
**标准编号：** UAP-00-001
**名称：** UAP 核心架构规范
**版本：** 1.0.0
**状态：** ACTIVE
**适用范围：** 约束 Uter 仓库内 UAP 1.0 的分层、模块边界、接口与可追溯性，覆盖 `.uap/config/` 的六份注册中心、`.uap/runtime/_lib/` 共享契约、`.uap/runtime/orchestrator/` 调度入口以及 `.uap/validators/` 验证入口；与 `AGENTS.md`（343 行全仓强制约定）、`web/AGENTS.md`、`docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md` 共同构成治理基线。UAP 对 `router/`、`middleware/`、`model/`、`controller/`、`service/`、`relay/`、`web/src/` 等 Uter 真实工程模块行使治理，但不替代其业务实现。
**关键级别：** P0
**依赖标准：** 无

## 规范目标
本规范把 UAP 定义为 Uter 内部唯一的 AI 自主工程治理和执行平台，并以 `.uap/config/specification-registry.yaml` 登记的 32 条规范、`execution-mapping.yaml` 的 32 个 `executor_entries`、`validator-registry.yaml` 的验证器实现为可解析的机器对象。规范层、配置层、运行时层、执行引擎层、验证层、证据层六层必须通过 `.uap/runtime/_lib/contract.mjs` 的稳定接口通信，禁止隐式全局状态。目标是使任何一条规范都能映射到真实执行器与验证器，并由 `.uap/evidence/` 的证据闭环证明。

## 强制性要求
1. UAP 是 Uter 内部唯一的 AI 自主工程治理和执行平台。
2. UAP 由规范层、配置层、运行时层、执行引擎层、验证层、证据层组成。
3. 规范层定义工程规则；配置层将规则映射到机器执行对象；运行时层负责调度；执行引擎负责实际操作；验证层负责判定；证据层负责记录。
4. 任何规范不得只有文字要求而没有执行映射。
5. 任何强制性规范必须对应至少一个执行器和一个验证器。
6. 任何执行器必须声明输入、输出、权限、失败状态和可恢复策略。
7. 任何验证器必须返回机器可读结果。
8. 系统模块之间通过稳定接口通信，禁止通过隐式全局状态传递任务。
9. 所有任务必须有唯一 ID、执行状态、执行时间、责任 Agent 和证据引用。
10. 配置、规范、代码和验证结果必须可追溯。
11. UAP 必须支持独立运行，不得要求外部治理平台提供必要能力。
12. UAP 内部组件应遵循单一职责、可替换、可测试和可恢复原则。

## Uter 落地细则
- 规范层基线为 `.uap/tools/spec-baseline.md`，32 份正式规范落在 `.uap/{core,product,architecture,agents,development,quality,security,cross-platform,delivery,evolution}/`；机器索引为 `.uap/config/specification-registry.yaml`（`registry_id: UAP-SPECIFICATION-REGISTRY`），其中 `defaults.required_executor: true` / `required_validator: true` / `evidence_required: true` 强制每条规范都有执行与验证对象。
- 配置层六份注册中心：`.uap/config/specification-registry.yaml`、`.uap/config/execution-mapping.yaml`、`.uap/config/validator-registry.yaml`、`.uap/config/agent-registry.yaml`、`.uap/config/permission-policy.yaml`、`.uap/config/workflow-registry.yaml`，均由 `.uap/runtime/_lib/yaml.mjs` 解析，禁止在运行时硬编码映射表。
- 执行引擎层 `executor_entries` 给出 32 个可导入 ESM 模块，例如 `core.architecture: .uap/runtime/orchestrator/index.mjs`、`product.requirements: .uap/engines/product/index.mjs`、`architecture.analyzer: .uap/engines/architecture/index.mjs`；`.uap/runtime/_lib/paths.mjs` 统一解析这些相对路径。
- 运行时层共享契约在 `.uap/runtime/_lib/contract.mjs`：`executorResult()`、`validatorResult()`、`assertExecutorResult()`、`assertValidatorResult()`、`LIFECYCLE_STATUSES`、`TASK_STATES`、`TASK_TRANSITIONS`、`VALIDATOR_STATUSES`，所有模块只通过这些导出通信。
- 验证层实现按域分布：`.uap/validators/core/index.mjs`、`.uap/validators/security/index.mjs`、`.uap/validators/product/index.mjs`、`.uap/validators/architecture/index.mjs`；`validation_policy.fail_if_validator_missing: true` 与 `fail_if_validator_not_executable: true` 保证无验证器即失败。
- 证据层目录为 `.uap/evidence/`、报告目录 `.uap/reports/`，索引 `.uap/reports/EVIDENCE-INDEX.md`；由 `.uap/config/execution-mapping.yaml` 的 `evidence.directory` / `reports_directory` / `persist_task_state: true` 固定。
- 稳定接口的可追溯范例：Uter 后端按 `go.mod`（`module github.com/uter-ai/uter`）分层于 `router/api-router.go`、`router/relay-router.go`、`middleware/access_token_routes.go`、`model/main.go`、`controller/`、`service/authz/permission.go`、`relay/`；`relaykit/go.mod` 声明独立模块 `github.com/uter-ai/uter/relaykit`，体现模块边界单一职责。
- 健康启动契约由 `.uap/config/workflow-registry.yaml` 的 `uap-bootstrap` 定义，步骤 `inspect_repository → validate_environment → initialize_uap_structure → validate_specification_registry → initialize_runtime → run_runtime_tests`，`acceptance: runtime_health_check`。
- 关键接口自动化测试入口：Go 侧 `make test`（`Makefile` 的 `test` 目标，含 root / relaykit / tokenkit / tokenkit/tokenkit 四个模块）、`GOWORK=off go vet ./...`、`gofmt -l .`；前端 `cd web && bun run test`（`web/package.json` 的 `test: vitest run`）。
- 全仓强制约定以 `AGENTS.md` 为准（Rule Auto-Loading / Automated Quality Gates / Verification Evidence / Change Protection），前端以 `web/AGENTS.md` 为准，设计基线以 `docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md` 为准；`AGENTS.md` 记录的历史域规范语料已于 2026-11-12 退役，UAP 对其零运行时依赖，当前绑定来源仅上述三份文件。
- 基线环境快照在 `.uap/state/BASELINE.json`（`baseline_id: UAP-BASELINE-2026-11-12T10-19-06Z`，记录 Go `go1.27.4`、Node `v22.22.2`、Bun `1.4.2` 与 9 个 CI workflow），用于验证「UAP 独立运行」不依赖外部治理平台。
- 全量验证命令由 `.uap/state/BASELINE.json` 的 `real_gate_commands` 与 `scripts/verify-all.sh` 固定：`./scripts/verify-all.sh [--quick]`、`.github/workflows/ci.yml`、`.github/workflows/release-gate.yml`。

## 执行流程
1. `uap-orchestrator`（`.uap/runtime/agent-runtime/index.mjs`，权限 `project_read/task_create/task_dispatch/evidence_write`）按 `uap-bootstrap` 发起，先 `inspect_repository` 读取 `AGENTS.md`、`go.mod`、`.uap/state/BASELINE.json`。
2. Orchestrator 经 `.uap/runtime/_lib/yaml.mjs` 加载 `.uap/config/specification-registry.yaml` 与 `execution-mapping.yaml`，用 `registryIntegrity()` 校验 32 条 `file` 路径存在、`executor_entries` 每条路径可导入。
3. 对每个 `executor_entries` 动态 `import()` 并调用其 `health(ctx)` 导出，收集健康状态；失败项写入 `blocked_reasons`。
4. 校验 `validator-registry.yaml` 中每条 `implementation` 的 `checks` 与 `target` 可解析，确认「规范—执行器—验证器」三方映射无孤儿、无循环依赖（`dependency_integrity`）。
5. 读取 `.uap/runtime/_lib/contract.mjs` 的 `LIFECYCLE_STATUSES` / `TASK_TRANSITIONS`，确认接口签名 `health(ctx)` / `execute(task, ctx)` 与 `executorResult()` 一致。
6. 生成执行证据 `UAP-EVD-...` 写入 `.uap/evidence/`，记录加载的配置文件、命令、退出码、时间与环境，索引追加到 `.uap/reports/EVIDENCE-INDEX.md`。
7. 由 `core.architecture_integrity` 验证器（`.uap/validators/core/index.mjs`）执行 `module_presence` / `dependency_integrity` / `interface_integrity`，返回 `validatorResult()`。
8. 仅当 `executed=true && exit_code=0` 且无 BLOCKER findings 时，Runtime 健康状态记为可用；否则 fail-closed 记为 BLOCKED 并保留失败证据。

## 对应执行器
- 执行器 ID：`core.architecture`
- 实现路径：`.uap/runtime/orchestrator/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：按 `.uap/config/permission-policy.yaml` 与 `.uap/config/agent-registry.yaml` 的 `uap-orchestrator`，需 `project_read`（读取规范/配置/代码）、`task_create`、`task_dispatch`、`evidence_write`；受 `enforcement.check_before_action: true`、`fail_closed: true`、`default_effect: deny` 约束。`project_write` 的 `forbid_destructive_git_operations: true` 与 `branch_creation: deny` / `force_push: deny` 对本执行器同样生效。

## 对应验证器
- 验证器 ID：`core.architecture_integrity`
- 实现路径：`.uap/validators/core/index.mjs`
- 检查项：`[module_presence, dependency_integrity, interface_integrity]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `task_id` | 任务唯一 ID，来自 `.uap/config/execution-mapping.yaml` 的 `execution_contract.required_input` |
| 输入 | `specification_ids` | 本次执行关联的规范 ID 列表 |
| 输入 | `scope` | 执行范围（六层组件与 Uter 真实模块边界） |
| 输入 | `constraints` | 约束：权限组、超时、禁改动清单、fail-closed |
| 输入 | `acceptance_criteria` | 验收标准（组件存在、依赖可解析、映射完整） |
| 输入 | `ctx` | Runtime 上下文，含 `.uap/state/BASELINE.json` 的 toolchain 快照 |
| 输出 | `executorResult` | 由 `.uap/runtime/_lib/contract.mjs` 的 `executorResult()` 归一化的结构化结果 |
| 输出 | `status` / `summary` / `changed_files` | 执行状态、摘要、变更文件清单 |
| 输出 | `validation_results` | 由独立验证器回填，执行器禁止自行声明（`assertExecutorResult()` 强制为空） |
| 输出 | `evidence_refs` | 指向 `.uap/evidence/` 的证据 ID 列表 |
| 输出 | `blocked_reasons` | 阻断原因列表 |
| 输出 | `validatorResult` | `validatorResult()` 返回的机器可读判定 |

## 失败处理
按 `.uap/config/execution-mapping.yaml` 的 `execution.failure_policy` 与 `.uap/config/permission-policy.yaml` 的 `enforcement.fail_closed: true`（`default_effect: deny`）逐类处置：
1. **permission_denied**：`execute(task, ctx)` 前由 policy-engine 校验 `project_read/task_create/task_dispatch/evidence_write`，缺失即拒绝动作、记录 `log_denied_actions` 审计事件，处置策略 `block`，任务由 RUNNING 迁移为 BLOCKED，不重试、不绕过。
2. **missing_dependency**：`executor_entries` 路径不存在、模块无法 `import()`、`health()` 缺失或 `specification-registry.yaml` 依赖不可解析时，处置策略 `block`，任务迁移 BLOCKED 并写入 `blocked_reasons`，待补齐后由 Orchestrator 重新排队（QUEUED）。
3. **validation_failed**：独立验证器返回 FAIL / NOT_EXECUTED 或含 `severity=BLOCKER` findings 时，处置策略 `repair_then_revalidate`，交由 `uap-defect-repair` 工作流修复后复验；未复验通过不得标记 SUCCEEDED。
4. **retryable**：处置策略 `bounded_retry`，重试上限 **3 次**（`max_repair_attempts_per_root_cause: 3`），退避采用指数退避（第 n 次等待 base × 2^(n-1)，base=1s，上限 8s，附随机抖动）；每次重试写入独立证据；恢复执行须校验 `result_id`/`task_id` 幂等，禁止重放非幂等副作用。
5. **unrecoverable**：处置策略 `fail`，任务迁移 FAILED 并保留全部失败证据；按 `.uap/runtime/_lib/contract.mjs` 的 `TASK_TRANSITIONS`，FAILED 仅允许 → QUEUED / BLOCKED / CANCELLED，禁止重置状态隐藏失败。
全局 fail-closed：任何策略判定异常、验证器缺失（`fail_if_validator_missing: true`）或证据缺失（`fail_if_evidence_missing: true`）时，结果一律按 BLOCKED / FAIL 处理，绝不降级为 PASS。

## 验收条件
1. 核心组件真实存在。
2. 模块依赖关系可解析。
3. 规范、执行器、验证器能够映射。
4. Runtime 能启动并返回健康状态。
5. 不存在无法解释的循环依赖。
6. 所有关键接口均有自动化测试。

## 证据要求
- 证据统一落盘到 `.uap/evidence/`，索引写入 `.uap/reports/EVIDENCE-INDEX.md`；证据 ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EVD')` 生成稳定唯一 ID（格式 `UAP-EVD-<时间戳>-<随机>`），禁止与历史证据复用。
- 每条证据必须记录：执行命令原文（如 `./scripts/verify-all.sh`、`GOWORK=off go vet ./...`、`make test`）、`exit_code`、开始/结束时间（ISO 8601）、环境（取自 `.uap/state/BASELINE.json` 的 `toolchain`：Go `go1.27.4` / Node `v22.22.2` / Bun `1.4.2`）、输入（`task_id` / `specification_ids` / `scope` / `constraints`）、输出（`executorResult` 或 `validatorResult` 全文）以及日志引用路径。
- 验证结果由 `.uap/runtime/_lib/contract.mjs` 的 `validatorResult()` 归一化为 `{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；`PASS` 仅在 `executed=true && exit_code=0` 且 `findings` 无 `severity=BLOCKER` 时成立。
- 报告必须能经 `evidence_refs` 反查到 `.uap/evidence/` 下的原始记录；`.uap/config/validator-registry.yaml` 的 `validation_policy.fail_if_evidence_missing: true` 强制证据存在。
- **证据不可覆盖**：新结果写入新证据文件，禁止覆盖历史记录；`persist_task_state: true` 保证状态持久化。**失败证据不可删除**：BLOCKED / FAILED / NOT_EXECUTED 的证据必须保留，禁止以删除失败证据制造通过结果；状态迁移受 `TASK_TRANSITIONS` 约束。

## 依赖标准
无（根规范）。本规范是 `.uap/config/specification-registry.yaml` 中 `dependencies: []` 的唯一根规范，为 UAP-00-002 / UAP-00-003 / UAP-00-004 / UAP-01-001 / UAP-02-001 等提供六层架构、稳定接口契约与可追溯基线；UAP 独立运行，不依赖任何外部治理平台。
