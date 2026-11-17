# UAP-00-004 — 证据与状态管理规范
> **UDS 8.0.0 状态边界：** 当前唯一设计系统 SSOT 为 `TOKEN-MANIFEST.json`（version `8.0.0`、`ACCEPTANCE_READY`、`accepted: false`）。运行时颜色语义由 manifest 派生的 `--ds-*` bridge 提供；现有 UDS 3.0 runtime compatibility boundary 必须保留，直到项目所有者明确授权迁移并完成绑定当前 HEAD 的行为、视觉与兼容回归验证；不得因迁移/映射文件缺失或 UDS 8.0.0 达到 ACCEPTANCE_READY 就推断其已退役。设计系统达到 `ACCEPTANCE_READY` 不等于用户已最终接受；不得将设计系统状态等同于 Uter 全站业务合规。


**编号：** UAP-00-004
**标准编号：** UAP-00-004
**名称：** 证据与状态管理规范
**版本：** 1.0.0
**状态：** ACTIVE
**适用范围：** 约束 Uter 内 UAP 1.0 的执行状态与验证证据，覆盖 `.uap/runtime/evidence-engine/index.mjs`、`.uap/runtime/_lib/contract.mjs` 的 `LIFECYCLE_STATUSES` / `TASK_STATES` / `TASK_TRANSITIONS` / `validatorResult()`、`.uap/state/BASELINE.json`、`.uap/evidence/` 证据目录与 `.uap/reports/EVIDENCE-INDEX.md` 索引。适用于 `router/`、`model/`、`relay/`、`web/src/` 等真实模块上任何任务的记录、恢复与验收判定，杜绝「文件存在即通过」。
**关键级别：** P0
**依赖标准：** UAP-00-001

## 规范目标
本规范把状态与证据做成持久化、不可静默覆盖、可追溯的一等公民：所有状态值以 `.uap/runtime/_lib/contract.mjs` 的冻结枚举为准，所有验证结果以 `validatorResult()` 归一化，且 `PASS` 仅在 `executed=true && exit_code=0` 且无 BLOCKER 时成立。目标是让 `.uap/reports/` 的每份报告都能经 `evidence_refs` 定位到 `.uap/evidence/` 的原始命令、退出码、时间、环境与输入输出，任务中断后可恢复，历史与失败证据不可被删改。

## 强制性要求
1. 每次任务执行必须产生唯一执行记录。
2. 每条规范、每个执行器和每个验证器必须有状态。
3. 状态必须区分 NOT_BUILT / PARTIALLY_BUILT / IMPLEMENTED_NOT_VERIFIED / PARTIALLY_VERIFIED / FULLY_VERIFIED / FULLY_OPERATIONAL / BLOCKED / FAILED。
4. FULLY_VERIFIED 必须有完整的验证证据。
5. FULLY_OPERATIONAL 必须有实际启动、端到端任务、恢复和运行证据。
6. 文件存在不能证明功能实现。
7. 命令存在不能证明命令可运行。
8. 测试文件存在不能证明测试通过。
9. 验证结果必须记录命令、退出码、时间、环境、输入、输出和日志引用。
10. 报告必须能追溯到原始证据。
11. 证据必须有稳定 ID。
12. 执行状态必须可恢复，不能只存在于内存。
13. 历史证据不得被新结果静默覆盖。
14. 失败证据不得删除以制造通过结果。

## Uter 落地细则
- 状态枚举的唯一实现为 `.uap/runtime/_lib/contract.mjs`：`LIFECYCLE_STATUSES`（8 个值，与 `.uap/config/specification-registry.yaml` 的 `status_values` 一致）、`TASK_STATES`（9 个值）、`TASK_TRANSITIONS`（合法迁移表，非法迁移抛 `ContractError`）、`VALIDATOR_STATUSES`（`PASS/FAIL/BLOCKED/NOT_EXECUTED`）。
- 规范默认状态由 `.uap/config/specification-registry.yaml` 的 `defaults.status: IMPLEMENTED_NOT_VERIFIED` 与 `defaults.evidence_required: true` 固定；本批正式规范状态只允许 `ACTIVE` / `IMPLEMENTED_NOT_VERIFIED`，禁止 `FULLY_VERIFIED` / `FULLY_OPERATIONAL`。
- 证据引擎为 `.uap/runtime/evidence-engine/index.mjs`（`core.evidence`）；`.uap/config/execution-mapping.yaml` 的 `evidence.directory: .uap/evidence`、`reports_directory: .uap/reports`、`persist_task_state: true` 固定落盘位置。
- 基线快照 `.uap/state/BASELINE.json`（`baseline_id: UAP-BASELINE-2026-11-12T10-19-06Z`、`captured_at: 2026-11-12T10:19:06Z`）记录环境证据：`toolchain`（Go `go1.27.4`、Node `v22.22.2`、Bun `1.4.2`、Python `3.13.12`）、`real_gate_commands`、CI workflows 清单。
- 验证结果由 `validatorResult()` 归一化并强制 `PASS` 条件：若 `executed !== true` 或 `exit_code !== 0` 或存在 `severity=BLOCKER` 的 finding，则 `status` 从 PASS 降级为 FAIL；`assertValidatorResult()` 再次校验 `PASS` 必须 `executed=true && exit_code=0`。
- 执行结果由 `executorResult()` 归一化，含 `result_id`（`newId('UAP-EXR')`）、`task_id`、`executor_id`、`status`、`summary`、`changed_files`、`commands`、`evidence_refs`、`blocked_reasons`、`outputs`、`completed_at`；`validation_results` 强制为空并由独立验证器回填，`assertExecutorResult()` 校验必填字段。
- 稳定 ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId()` / `nowISO()` 生成：证据 `UAP-EVD-...`、执行结果 `UAP-EXR-...`；`.uap/config/validator-registry.yaml` 的 `validation_policy.fail_if_evidence_missing: true` / `fail_if_required_check_skipped: true` 强制证据与检查完整。
- 状态可恢复由 `.uap/config/workflow-registry.yaml` 的 `execution.persist_after_each_step: true` / `resume_on_interruption: true` / `require_evidence: true` 与 `uap-defect-repair` 的 `persist_evidence`、`uap-final-verification` 的 `verify_recovery` 落实。
- 真实验证命令（证据中必须记录退出码）：`./scripts/verify-all.sh [--quick]`、`gofmt -l .`、`GOWORK=off go vet ./...`、`make test`、`cd web && bun run typecheck|lint|test|lint:design:strict|copyright:check|format:check|build:check`；CI 侧 `.github/workflows/ci.yml` / `release-gate.yml`。
- 真实测试文件（存在不等于通过，须记录运行结果）：`common/quota_math_test.go`、`model/billing_integrity_test.go`、`relay/helper/openai_image_request_test.go`、`router/api-router.go` 配套的 `router/route_dump_test.go`、`web/src/design-system/__tests__`。
- 「文件存在不能证明功能实现」的对照：`AGENTS.md` 的 Verification Evidence 要求报告写明确切命令、退出码、失败测试名与变更文件；`docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md` 的 `showcase-3.0.html` 与 `web/e2e/visual/` 两条本地截图轨 `BLOCKED` 表示「未执行」，不得报为 pass。
- 报告索引 `.uap/reports/EVIDENCE-INDEX.md` 以 `evidence_refs` 关联 `.uap/evidence/`；`docs/product/reports/`（如 `BIDIRECTIONAL-SYNC-REPORT.md`）与 `docs/product/history/v1.json` 为 Uter 既有的可追溯报告范例。

## 执行流程
1. 任意任务由 `uap-orchestrator` 分配后，`core.evidence`（`.uap/runtime/evidence-engine/index.mjs`）先创建唯一执行记录，写入 `result_id` / `task_id` / 初始 `TASK_STATES`。
2. 读取 `.uap/runtime/_lib/contract.mjs` 的 `LIFECYCLE_STATUSES` 与 `.uap/config/specification-registry.yaml` 的 `status_values`，为每条规范、每个执行器、每个验证器登记状态（默认 `IMPLEMENTED_NOT_VERIFIED`）。
3. 执行器产生 `executorResult()`，evidence-engine 把命令原文、退出码、时间、环境（`.uap/state/BASELINE.json`）、输入、输出、日志引用写入 `.uap/evidence/UAP-EVD-...`。
4. 独立验证器产生 `validatorResult()`，evidence-engine 校验 `PASS` 条件（`executed=true && exit_code=0` 且无 BLOCKER），将 `checks_run` / `findings` 一并落盘为独立证据，禁止覆盖既有证据。
5. 每完成一个工作流步骤按 `persist_after_each_step: true` 持久化状态；中断后按 `resume_on_interruption: true` 从 `.uap/evidence/` 与状态记录恢复，校验 `TASK_TRANSITIONS` 的 `WAITING_RECOVERY`。
6. `core.evidence_integrity` 验证器（`.uap/validators/core/index.mjs`）执行 `evidence_exists` / `state_validity` / `traceability`，核对报告 `evidence_refs` 可反查原始记录、状态迁移合法。
7. 生成/更新 `.uap/reports/EVIDENCE-INDEX.md`，登记证据 ID、命令、退出码、时间与环境摘要；报告必须能定位原始验证记录。
8. 仅当状态迁移合法、证据完整且 `executed=true && exit_code=0`、无 BLOCKER 时允许推进；`FULLY_VERIFIED` / `FULLY_OPERATIONAL` 必须分别具备完整验证证据与实际启动/端到端/恢复/运行证据，否则保持 `IMPLEMENTED_NOT_VERIFIED` 或 BLOCKED。

## 对应执行器
- 执行器 ID：`core.evidence`
- 实现路径：`.uap/runtime/evidence-engine/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：按 `.uap/config/permission-policy.yaml` 与 `uap-orchestrator`，需 `project_read`（读取状态/配置/报告）、`evidence_write`（写 `.uap/evidence/` 与 `.uap/reports/EVIDENCE-INDEX.md`）、`task_create` / `task_dispatch`；`project_write` 受 `preserve_uncommitted_changes: true` 约束。`test_deletion_to_force_pass: deny`、`quality_gate_disable: deny`、`destructive_git: deny` 保证不能通过删除失败证据或降低门禁制造通过。

## 对应验证器
- 验证器 ID：`core.evidence_integrity`
- 实现路径：`.uap/validators/core/index.mjs`
- 检查项：`[evidence_exists, state_validity, traceability]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `task_id` / `specification_ids` | 任务与关联规范 ID |
| 输入 | `executorResult` | 执行器产生的结构化结果（`commands`/`changed_files`） |
| 输入 | `validatorResult` | 独立验证器产生的机器可读结果 |
| 输入 | `scope` / `constraints` / `acceptance_criteria` | 范围、状态迁移约束、验收标准 |
| 输入 | 环境快照 | `.uap/state/BASELINE.json` 的 `toolchain` / `real_gate_commands` |
| 输出 | 唯一执行记录 | `result_id`（`UAP-EXR-...`）与 `TASK_STATES` 迁移记录 |
| 输出 | 证据文件 | `.uap/evidence/UAP-EVD-...`，含命令/退出码/时间/环境/输入/输出/日志引用 |
| 输出 | 状态记录 | 每条规范/执行器/验证器的 `LIFECYCLE_STATUSES` 状态 |
| 输出 | `.uap/reports/EVIDENCE-INDEX.md` | 报告索引与 `evidence_refs` 反查关系 |
| 输出 | 恢复状态 | 中断后可恢复的持久化状态与 `WAITING_RECOVERY` 校验 |
| 输出 | 判定结论 | PASS / FAIL / BLOCKED / NOT_EXECUTED（经 `validatorResult()` 归一化） |

## 失败处理
按 `.uap/config/execution-mapping.yaml` 的 `execution.failure_policy` 与 `.uap/config/permission-policy.yaml` 的 `enforcement.fail_closed: true`（`default_effect: deny`）逐类处置：
1. **permission_denied**：`evidence_write` / `project_read` 缺失即拒绝写入、记录审计事件，处置策略 `block`，任务迁移 BLOCKED；禁止绕过检查直接写证据或报告。
2. **missing_dependency**：`.uap/evidence/` 目录、`.uap/reports/EVIDENCE-INDEX.md`、状态记录或 `validatorResult()` 不可用时，处置策略 `block`，任务 BLOCKED 并写入 `blocked_reasons`；`fail_if_validator_missing: true` / `fail_if_evidence_missing: true` 同步阻断。
3. **validation_failed**：`executed=false`、`exit_code≠0`、含 BLOCKER findings、`state_validity` 不合法或 `traceability` 断链时，处置策略 `repair_then_revalidate`，转入 `uap-defect-repair` 修复后复验；原 `status='PASS'` 由 `validatorResult()` 强制降级为 FAIL。
4. **retryable**：处置策略 `bounded_retry`，重试上限 **3 次**（`max_repair_attempts_per_root_cause: 3`），退避采用指数退避（base=1s，第 n 次 base × 2^(n-1)，上限 8s，附随机抖动）；每次重试写入新的独立证据，禁止覆盖历史结果，并校验幂等防非幂等副作用重放。
5. **unrecoverable**：处置策略 `fail`，任务迁移 FAILED 并保留全部失败证据；`FAILED → QUEUED/BLOCKED/CANCELLED` 之外的迁移抛 `ContractError`；禁止通过重置状态隐藏失败历史。
全局 fail-closed：证据缺失、必需检查被跳过、状态迁移非法或 `fail_if_evidence_missing: true` 触发时，一律按 BLOCKED / FAIL 处理；绝不以「文件存在 / 命令存在 / 测试文件存在」推断功能实现或测试通过。

## 验收条件
1. 状态持久化真实可用。
2. 任务中断后能够恢复。
3. 证据引用有效。
4. 报告能够定位原始验证记录。
5. 状态转换受到规则约束。

## 证据要求
- 证据统一落盘到 `.uap/evidence/`，索引写入 `.uap/reports/EVIDENCE-INDEX.md`；证据 ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EVD')` 生成稳定唯一 ID，每次执行/复验/重试产生独立证据，禁止复用或静默覆盖。
- 每条证据必须记录七要素：执行命令原文（如 `./scripts/verify-all.sh`、`GOWORK=off go vet ./...`、`make test`、`cd web && bun run test`）、`exit_code`、时间（`nowISO()` ISO 8601）、环境（`.uap/state/BASELINE.json` 的 `toolchain`）、输入（`task_id`/`specification_ids`/`scope`/`constraints`）、输出（`executorResult` / `validatorResult` 全文）、日志引用路径。
- 验证结果由 `.uap/runtime/_lib/contract.mjs` 的 `validatorResult()` 归一化为 `{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；`PASS` 仅在 `executed=true && exit_code=0` 且 `findings` 无 `severity=BLOCKER` 时成立。
- 报告必须能经 `evidence_refs` 反查 `.uap/evidence/` 原始记录；`.uap/config/validator-registry.yaml` 的 `validation_policy.fail_if_evidence_missing: true` / `fail_if_required_check_skipped: true` 强制证据与检查完整。
- **证据不可覆盖**：新结果写入新证据文件，历史证据不得被静默覆盖；`persist_task_state: true` 保证执行状态不只存在于内存。**失败证据不可删除**：FAILED / BLOCKED / NOT_EXECUTED 与重试失败证据必须保留，禁止删除失败证据、重置 `TASK_STATES` 或降低门禁制造通过结果；`FULLY_VERIFIED` / `FULLY_OPERATIONAL` 分别需完整验证证据与实际启动/端到端/恢复/运行证据。

## 依赖标准
- **UAP-00-001（UAP 核心架构规范）**：提供六层架构中的「证据层」定位、稳定接口契约与 `executorResult()` / `validatorResult()` 机器可读结果，使状态枚举、证据 ID 与报告追溯具备统一可解析基础。
