# UAP-01-001 — 产品需求工程规范

**编号：** UAP-01-001
**标准编号：** UAP-01-001
**名称：** 产品需求工程规范
**版本：** 1.0.0
**状态：** IMPLEMENTED_NOT_VERIFIED
**适用范围：** 约束 Uter 产品需求的唯一 Feature ID 与「需求→代码→测试→发布」可追溯链，覆盖 `docs/product/registry/product-model.json`（唯一权威数据源）、`feature-registry.yaml`、`requirement-registry.yaml`、`feature-mapping.yaml`、`change-registry.yaml`，以及 `docs/product/prd/<domain>/UTER-XXX-NNN.md` PRD 投影、真实代码模块 `web/src/features/`、`router/`、`model/`、`service/`。适用于 UAP 对 Uter 56 个已登记 Feature 的需求盘点、影响分析与验收判定。
**关键级别：** P1
**依赖标准：** UAP-00-001

## 规范目标
本规范为 Uter 每个业务功能建立唯一 Feature ID（格式 `UTER-<DOMAIN>-<NNN>`，如 `UTER-AUTH-001`）与需求→代码→测试→发布的可追溯链，并以 `docs/product/registry/product-model.json` 为 Single Source of Truth，禁止手工编辑 PRD 投影。目标是让 `docs/product/registry/feature-registry.yaml` 的 56 个 Feature、`requirement-registry.yaml` 的 124 条需求均可关联到 `web/src/features/`、`router/`、`model/` 的真实实现与测试，且需求变更必产生覆盖 API/数据库/前端/后端/测试/文档的影响分析记录。

## 强制性要求
1. 每个产品功能必须有唯一 Feature ID。
2. 每个功能必须包含目标用户、使用场景、业务价值和验收标准。
3. 功能需求必须区分用户需求、系统需求和技术约束。
4. 必须识别功能前置条件、异常流程和边界条件。
5. 必须维护 Feature Registry。
6. 每个 Feature 必须关联 PRD、原型、代码模块、测试和发布记录。
7. 不允许出现没有需求来源的重大业务功能。
8. 需求变更必须触发影响分析。
9. 影响分析必须覆盖 API、数据库、前端、后端、测试和文档。
10. 需求状态必须包括 Draft、Approved、In Progress、Verified、Released、Deprecated。
11. 不得将未经确认的业务假设标记为已批准需求。
12. 需求验收必须有测试或其他可验证证据。

## Uter 落地细则
- 唯一权威数据源为 `docs/product/registry/product-model.json`（约 1.49 MB，模型版本 v1）；`docs/product/prd/auth/UTER-AUTH-001.md` 头部明确「投影文档 · 禁止直接手工编辑。唯一权威数据源为 docs/product/registry/product-model.json」，变更须经产品规格中心事务化双写并重渲染 PRD 与原型投影。
- Feature Registry 为 `docs/product/registry/feature-registry.yaml`（`total: 56`，`status_counts: IMPLEMENTED 46 / BACKEND_ONLY 8 / NOT_IMPLEMENTED 1 / PARTIALLY_IMPLEMENTED 1`），每条含 `feature_id`、`domain`、`module`、`status`、`priority`、`roles`、`prd_path`、`prototype_path`、`prototype_html_path`、`prd_version`、`sync_status`、`requirement_ids`、`prototype_page_ids`、`acceptance_ids`、`test_case_ids`。
- 需求登记为 `docs/product/registry/requirement-registry.yaml`（`total: 124`），每条 `requirement_id`（如 `REQ-AUTH-001-01`）带 `status`、`priority`、`business_rule_ids`、`prototype_page_ids`、`component_ids`、`interaction_ids`、`acceptance_ids`、`test_case_ids`，实现需求→组件→交互→验收→测试的全链绑定。
- Feature ID 与关联 ID 格式规范见 `docs/product/PRODUCT-FEATURE-ID-STANDARD.md`（§1 格式 / §2 规则 / §3 状态分类）；关联 ID 前缀：`REQ-`、`BR-`、`PP-`、`CMP-`、`INT-`、`AC-`、`TC-`、`CHG-`。
- 变更登记为 `docs/product/registry/change-registry.yaml`（`snapshots` / `conflicts: []` / `changes`，示例 `change_id: CHG-INIT-0001`、`base_version: 0 → target_version: 1`、`changed_fields: [features, mappings]`、`source_type: INITIAL_BASELINE`），变更历史快照在 `docs/product/history/v1.json`。
- 可追溯映射与报告：`docs/product/registry/feature-mapping.yaml`、`docs/product/mappings/FEATURE-TRACEABILITY-MATRIX.md`、`docs/product/reports/PRODUCT-COVERAGE-REPORT.md`、`docs/product/reports/UTER-PRODUCT-PRD-PROTOTYPE-SYSTEM-FINAL-REPORT.md`。
- 需求/同步/原型/质量/可追溯标准文档：`docs/product/PRODUCT-REQUIREMENTS-STANDARD.md`、`PRODUCT-SYNC-STANDARD.md`、`PRODUCT-PROTOTYPE-STANDARD.md`、`PRODUCT-QUALITY-GATE-STANDARD.md`、`PRODUCT-TRACEABILITY-STANDARD.md`、`PRODUCT-FEATURE-CATALOG.md`、`docs/product/README.md`。
- PRD 投影实例：`docs/product/prd/auth/UTER-AUTH-001.md` ~ `-006.md`、`docs/product/prd/org/UTER-ORG-001.md`、`docs/product/prd/plan/UTER-PLAN-001.md` ~ `-003.md`、`docs/product/prd/misc/UTER-MISC-001.md` ~ `-010.md`；PRD 头部含 Feature ID、PRD ID/版本、原型 ID（`PROTO-AUTH-001`）、原型文档路径、同步状态 `SYNCED`、关联 Change ID、设计基线 `UTER Design System 3.0`。
- 真实代码模块（Feature 关联目标）：`web/src/features/` 下 `auth`、`channels`、`chat`、`keys`、`users`、`wallet`、`redemption-codes`、`subscriptions`、`pricing`、`model-pricing`、`task-plugins`、`security`、`usage-logs` 等；后端 `router/api-router.go`、`router/authz-router.go`、`router/task-router.go`、`middleware/access_token_routes.go`、`model/`、`service/authz/permission.go`、`relay/channel/openai/`。
- 影响分析覆盖维度对应真实工程边界：API（`router/api-router.go`）、数据库（`model/main.go`、`model/migration_dialector.go`、`AGENTS.md` 的 SQLite/MySQL/PostgreSQL 三方言兼容）、前端（`web/src/features/`、`web/AGENTS.md`）、后端（`controller/`、`service/`）、测试（`common/quota_math_test.go`、`router/route_dump_test.go`、`cd web && bun run test`）、文档（`docs/product/`）。
- 验收可验证证据命令：`./scripts/verify-all.sh [--quick]`、`GOWORK=off go vet ./...`、`make test`、`cd web && bun run typecheck|lint|test|lint:design:strict|copyright:check|format:check|build:check`；CI 见 `.github/workflows/ci.yml` 与 `release-gate.yml`。
- 发布记录与环境基线来自 `.uap/state/BASELINE.json`（`ci_workflows` 9 个、`real_gate_commands`）与 `AGENTS.md` 的 Verification Evidence（报告须写明确切命令、退出码、变更文件、失败项）。

## 执行流程
1. `uap-product-agent`（`.uap/engines/product/index.mjs`，权限 `[project_read, product_write, evidence_write]`）由 `uap-orchestrator` 分配，读取 `docs/product/registry/product-model.json` 与 `feature-registry.yaml`。
2. 校验每个 Feature 具备唯一 `feature_id`（`UTER-<DOMAIN>-<NNN>`）及目标用户、使用场景、业务价值、验收标准（`acceptance_ids`），并区分用户需求/系统需求/技术约束、识别前置条件/异常流程/边界条件。
3. 读取 `requirement-registry.yaml` 与 `feature-mapping.yaml`，核对每个 Feature 关联 PRD（`docs/product/prd/...`）、原型（`docs/product/prototypes/...`）、代码模块（`web/src/features/...`、`router/`）、测试（`TC-*`）与发布记录，产出无来源孤立实现清单。
4. 需求变更时由 `product.requirements` 生成影响分析，覆盖 API / 数据库 / 前端 / 后端 / 测试 / 文档六维，写入 `change-registry.yaml` 的 `changes` 与 `docs/product/reports/`，并保留 `docs/product/history/v1.json` 快照。
5. 执行真实测试命令（`make test`、`cd web && bun run test` 等），把命令、退出码、`changed_files` 写入 `executorResult()`，证据 ID `UAP-EVD-...` 落盘 `.uap/evidence/`。
6. `product.requirement_traceability` 验证器（`.uap/validators/product/index.mjs`）执行 `feature_ids` / `requirement_coverage` / `acceptance_criteria`，返回 `validatorResult()` 并回填 `validation_results`。
7. 更新 `.uap/reports/EVIDENCE-INDEX.md` 登记证据引用；状态按 `LIFECYCLE_STATUSES` 记录，未取得完整验证证据不得升级为 `FULLY_VERIFIED`。
8. 仅当 `executed=true && exit_code=0` 且无 BLOCKER 时判定需求验收通过；否则按失败分类处置并保留影响分析记录。

## 对应执行器
- 执行器 ID：`product.requirements`
- 实现路径：`.uap/engines/product/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：按 `.uap/config/permission-policy.yaml` 与 `.uap/config/agent-registry.yaml` 的 `uap-product-agent`，需 `project_read`（读取 registry / PRD / 代码 / 测试）、`product_write`（写 `docs/product/` 下投影与报告，受 `preserve_uncommitted_changes: true` 约束）、`evidence_write`；`project_write` 的 `forbid_destructive_git_operations: true`、`branch_creation: deny` 生效。`production_read/write/deploy`、`real_payment`、`real_refund`、`quality_gate_disable` 一律 `deny`。

## 对应验证器
- 验证器 ID：`product.requirement_traceability`
- 实现路径：`.uap/validators/product/index.mjs`
- 检查项：`[feature_ids, requirement_coverage, acceptance_criteria]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `task_id` / `specification_ids` | 任务与关联规范 ID |
| 输入 | `docs/product/registry/product-model.json` | 唯一权威数据模型（SSOT） |
| 输入 | `feature-registry.yaml` / `requirement-registry.yaml` | Feature 与需求登记（56 / 124 条） |
| 输入 | `scope` / `constraints` / `acceptance_criteria` | 变更范围、影响分析维度、验收标准 |
| 输入 | 真实代码与测试路径 | `web/src/features/`、`router/`、`model/`、`*_test.go` |
| 输出 | 唯一 Feature ID 清单 | `UTER-<DOMAIN>-<NNN>` 与关联 `REQ-/BR-/PP-/CMP-/INT-/AC-/TC-` ID |
| 输出 | 影响分析记录 | 覆盖 API/数据库/前端/后端/测试/文档，写入 `change-registry.yaml` |
| 输出 | `executorResult` | `status/summary/changed_files/commands/evidence_refs/blocked_reasons` |
| 输出 | 需求验收证据 | 真实命令退出码与 `TC-*` 测试结果，`UAP-EVD-...` |
| 输出 | `validation_results` / `validatorResult` | 独立验证器回填的可追溯性结论 |
| 输出 | `.uap/reports/EVIDENCE-INDEX.md` | 证据引用索引条目 |

## 失败处理
按 `.uap/config/execution-mapping.yaml` 的 `execution.failure_policy` 与 `.uap/config/permission-policy.yaml` 的 `enforcement.fail_closed: true`（`default_effect: deny`）逐类处置：
1. **permission_denied**：`product_write` / `project_read` 缺失即拒绝写 PRD 投影或报告、记录审计事件，处置策略 `block`，任务迁移 BLOCKED，不绕过检查。
2. **missing_dependency**：`product-model.json`、`feature-registry.yaml`、`requirement-registry.yaml` 或关联 PRD/原型/测试路径缺失时，处置策略 `block`，任务 BLOCKED 并写入 `blocked_reasons`，待依赖补齐后重新排队（QUEUED）。
3. **validation_failed**：出现重复/缺失 Feature ID、无来源孤立实现、需求未经确认被标记批准或验收缺可验证证据时，处置策略 `repair_then_revalidate`，转入 `uap-defect-repair` 修复并复验；未复验通过不得 SUCCEEDED。
4. **retryable**：处置策略 `bounded_retry`，重试上限 **3 次**（`max_repair_attempts_per_root_cause: 3`），退避采用指数退避（base=1s，第 n 次 base × 2^(n-1)，上限 8s，附随机抖动）；每次重试写入独立证据，禁止重放非幂等的 registry 双写副作用。
5. **unrecoverable**：处置策略 `fail`，任务迁移 FAILED 并保留全部失败证据与影响分析记录；按 `TASK_TRANSITIONS` 仅允许 FAILED → QUEUED / BLOCKED / CANCELLED。
全局 fail-closed：验证器缺失、证据缺失、必需检查被跳过或状态迁移非法时，一律按 BLOCKED / FAIL 处理；不得将未经确认的业务假设标记为已批准需求，也不得以生成报告替代真实测试证据。

## 验收条件
1. 已有功能可以追溯到需求。
2. 关键功能不存在无来源、无验收标准的孤立实现。
3. 需求变更能够产生影响分析记录。

## 证据要求
- 证据统一落盘到 `.uap/evidence/`，索引写入 `.uap/reports/EVIDENCE-INDEX.md`；证据 ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EVD')` 生成稳定唯一 ID，禁止复用。
- 每条证据必须记录：执行命令原文（如 `./scripts/verify-all.sh`、`make test`、`cd web && bun run test`）、`exit_code`、开始/结束时间（ISO 8601）、环境（`.uap/state/BASELINE.json` 的 `toolchain`）、输入（`feature_id`、`requirement_ids`、`scope`/`constraints`）、输出（`executorResult` / `validatorResult` 全文、影响分析记录）以及日志引用路径。
- 验证结果由 `.uap/runtime/_lib/contract.mjs` 的 `validatorResult()` 归一化为 `{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；`PASS` 仅在 `executed=true && exit_code=0` 且 `findings` 无 `severity=BLOCKER` 时成立。
- 报告必须能经 `evidence_refs` 反查 `.uap/evidence/` 原始记录；`validation_policy.fail_if_evidence_missing: true` 强制证据存在；`docs/product/reports/` 与 `docs/product/history/v1.json` 的变更历史须可追溯。
- **证据不可覆盖**：新结果写入新证据文件，禁止覆盖历史（含 `CHG-*` 变更）记录。**失败证据不可删除**：BLOCKED / FAILED / NOT_EXECUTED 与需求验收失败证据必须保留，禁止以删除失败证据或降低门禁制造通过结果；状态转换受 `TASK_TRANSITIONS` 与 `LIFECYCLE_STATUSES` 约束。

## 依赖标准
- **UAP-00-001（UAP 核心架构规范）**：提供六层架构、稳定接口契约、结构化 `executorResult()` / `validatorResult()` 与可追溯基线，使 Feature ID 登记、需求映射、影响分析与验收证据具备机器可解析的执行与验证对象。
