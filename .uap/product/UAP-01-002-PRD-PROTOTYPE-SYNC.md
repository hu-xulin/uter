# UAP-01-002 — PRD 与原型双向同步规范
> **UDS 8.0.0 状态边界：** 当前唯一设计系统 SSOT 为 `TOKEN-MANIFEST.json`（version `8.0.0`、`ACCEPTANCE_READY`、`accepted: false`）。运行时颜色语义由 manifest 派生的 `--ds-*` bridge 提供；3.0 颜色兼容层已退役，B1–B6 迁移批次须以 `COMPAT-MAP.json` 的实时状态为准。设计系统达到 `ACCEPTANCE_READY` 不等于用户已最终接受；不得将设计系统状态等同于 Uter 全站业务合规。


**编号：** UAP-01-002
**标准编号：** UAP-01-002
**名称：** PRD 与原型双向同步规范
**版本：** 1.0.0
**状态：** IMPLEMENTED_NOT_VERIFIED
**适用范围：** 约束 Uter 产品 PRD 与原型的双向映射、影响清单与差异记录，覆盖 `docs/product/prd/<domain>/UTER-XXX-NNN.md`、`docs/product/prototypes/<domain>/UTER-XXX-NNN.md` 与 `.html` 交互式原型、`docs/product/registry/product-model.json`（SSOT）、`prototype-registry.yaml`、`feature-mapping.yaml`、`change-registry.yaml`，以及 `docs/product/reports/BIDIRECTIONAL-SYNC-REPORT.md` 与 `PRD-PROTOTYPE-CONSISTENCY-REPORT.md`。适用于产品规格中心「左侧原型、右侧 PRD」展示与自动同步。
**关键级别：** P1
**依赖标准：** UAP-01-001

## 规范目标
本规范以稳定 Feature ID（`UTER-<DOMAIN>-<NNN>`）建立 PRD 与原型双向映射，禁止仅依赖文件名或页面标题；任何一侧修改必须生成对侧影响清单并保留变更历史，不一致必须产生差异记录且未解决差异不得标记同步完成。目标是让 `docs/product/registry/product-model.json` 的事务化双写自动重渲染 PRD 与原型投影，`docs/product/history/v1.json` 的变更历史可追溯，且自动同步不擅自改变已批准的业务规则。

## 强制性要求
1. 每个功能必须有唯一 Feature ID。
2. PRD 与原型必须使用相同 Feature ID 和页面/组件标识。
3. 产品展示界面采用左侧原型、右侧 PRD 的对应关系。
4. PRD 修改后必须生成原型影响清单。
5. 原型修改后必须生成 PRD 影响清单。
6. 双向同步必须保留变更历史。
7. 必须支持页面、组件、交互、状态、字段、校验和异常流程的对应。
8. 同步不能仅依赖文件名或页面标题，必须使用稳定 ID。
9. 不一致时必须产生差异记录。
10. 未解决的差异不得标记为同步完成。
11. 自动同步不得擅自改变已批准的业务规则。
12. 必须支持人工确认有歧义的需求，但不应要求人工重复确认确定性机械变更。

## Uter 落地细则
- PRD 与原型共享同一 Feature ID 与稳定关联 ID：`docs/product/prd/auth/UTER-AUTH-001.md` ↔ `docs/product/prototypes/auth/UTER-AUTH-001.md` 与 `docs/product/prototypes/auth/UTER-AUTH-001.html`；PRD 头部记录 `原型 ID: PROTO-AUTH-001`、`原型文档`、`交互式原型（HTML）`、`同步状态: SYNCED`、`最近同步`、`最近变更来源`、`关联 Change ID`。
- 唯一权威数据源 `docs/product/registry/product-model.json`；PRD 头部明确「投影文档 · 禁止直接手工编辑」，有效变更经产品规格中心（`http://127.0.0.1:7788/`）PRD / Prototype 视图编辑，统一模型事务化双写并自动重渲染 PRD 与原型投影。
- 稳定 ID 体系（`docs/product/PRODUCT-FEATURE-ID-STANDARD.md` §1 格式 / §2 规则）：`UTER-` Feature ID、`PP-` 原型页面 ID、`CMP-` 组件 ID、`INT-` 交互 ID、`REQ-` 需求 ID、`AC-` 验收 ID、`CHG-` 变更 ID；`feature-registry.yaml` 的 `prototype_page_ids: [PP-AUTH-001-01, PP-AUTH-001-02]` 与 PRD/原型同名对应。
- 映射登记为 `docs/product/registry/feature-mapping.yaml` 与 `prototype-registry.yaml`；`requirement-registry.yaml` 的 `prototype_page_ids` / `component_ids` / `interaction_ids` 覆盖页面、组件、交互、状态、字段、校验和异常流程的对应。
- 变更历史与差异：`docs/product/registry/change-registry.yaml`（`snapshots`、`conflicts: []`、`changes`，`change_id: CHG-INIT-0001`、`source_view`、`source_type`、`changed_fields: [features, mappings]`、`sync_event_count`）、`docs/product/history/v1.json`、`docs/product/reports/BIDIRECTIONAL-SYNC-REPORT.md`、`PRD-PROTOTYPE-CONSISTENCY-REPORT.md`。
- 同步规则文档：`docs/product/PRODUCT-SYNC-STANDARD.md`、`PRODUCT-PROTOTYPE-STANDARD.md`、`PRODUCT-TRACEABILITY-STANDARD.md`、`PRODUCT-FEATURE-ID-STANDARD.md`、`PRODUCT-QUALITY-GATE-STANDARD.md`。
- PRD 投影实例按域分布：`docs/product/prd/auth/UTER-AUTH-001.md` ~ `-006.md`、`org/UTER-ORG-001.md`、`plan/UTER-PLAN-001.md` ~ `-003.md`、`misc/UTER-MISC-001.md` ~ `-010.md`；原型投影同构分布于 `docs/product/prototypes/{auth,org,plan,misc}/` 下的 `.md` 与 `.html`。
- 设计基线一致性：PRD 头部标注 `设计基线 UTER Design System 8.0.0`，UI 约束以 `docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md` 与 `docs/design-system/SHOWCASE-8.0.0.html` 为准；前端实现复用 `web/src/components/ui/` 与 `web/src/features/`。
- 自动同步不得改变已批准业务规则：`business_rule_ids`（如 `BR-AUTH-001-01-01`）在 `requirement-registry.yaml` 登记，规则实现落在 `common/quota_math.go`、`service/authz/permission.go`、`model/quota_reserve.go`；`AGENTS.md` 的 Billing safety invariants 与 Authentication Security 为不可自动改写的边界。
- 自动同步测试与验证命令：`cd web && bun run test`（Vitest）、`bun run lint:design:strict`、`bun run typecheck`、`bun run build:check`；后端 `./scripts/verify-all.sh [--quick]`、`make test`；CI 见 `.github/workflows/ci.yml`、`release-gate.yml`。
- 「未解决差异不得标记同步完成」的判定依据：`feature-registry.yaml` 的 `sync_status: SYNCED` 与 `change-registry.yaml` 的 `conflicts` 列表；`PRD-PROTOTYPE-CONSISTENCY-REPORT.md` 记录差异，`docs/product/history/v1.json` 保留历史快照，禁止静默覆盖。

## 执行流程
1. `uap-product-agent`（`.uap/engines/product/index.mjs`，权限 `[project_read, product_write, evidence_write]`）由 `uap-orchestrator` 分配，读取 `docs/product/registry/product-model.json`、`feature-registry.yaml`、`prototype-registry.yaml`、`feature-mapping.yaml`。
2. 按稳定 `feature_id` 与 `PP-/CMP-/INT-` ID 建立 PRD ↔ 原型双向映射，核对「左侧原型、右侧 PRD」展示关系，禁止用文件名或页面标题匹配。
3. 检测 PRD 侧变更（如 `docs/product/prd/auth/UTER-AUTH-001.md` 的 `prd_version` / `acceptance_ids` 变化）时，生成原型影响清单（受影响 `PP-*`/`CMP-*`/`INT-*` 与 `.html` 投影）写入 `change-registry.yaml` 的 `changes`。
4. 检测原型侧变更（如 `docs/product/prototypes/auth/UTER-AUTH-001.html` 的页面/组件/交互变化）时，生成 PRD 影响清单（受影响 `REQ-*` / `AC-*` 与 `.md` PRD 投影）。
5. 经统一模型事务化双写自动重渲染受影响投影，保留 `docs/product/history/v1.json` 快照；确定性机械变更自动同步，有歧义需求标记待人工确认，但不重复确认机械变更；已批准 `business_rule_ids` 不得被自动改写。
6. 对比 `sync_status` 与 `conflicts`，不一致时产生差异记录写入 `docs/product/reports/PRD-PROTOTYPE-CONSISTENCY-REPORT.md` 与 `BIDIRECTIONAL-SYNC-REPORT.md`；未解决差异保持非 `SYNCED`，触发失败分类。
7. `product.prototype_consistency` 验证器（`.uap/validators/product/index.mjs`）执行 `prd_mapping` / `prototype_mapping` / `change_detection`，返回 `validatorResult()`；执行真实测试命令并记录退出码到 `.uap/evidence/UAP-EVD-...`。
8. 更新 `.uap/reports/EVIDENCE-INDEX.md`；仅当 `executed=true && exit_code=0` 且无 BLOCKER、无未解决差异时允许标记同步完成，否则 BLOCKED / FAILED 并保留差异与失败证据。

## 对应执行器
- 执行器 ID：`product.prototype_sync`
- 实现路径：`.uap/engines/product/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：按 `.uap/config/permission-policy.yaml` 与 `uap-product-agent`，需 `project_read`（读取 PRD/原型/registry）、`product_write`（事务化双写重渲染 `docs/product/` 投影与报告，受 `preserve_uncommitted_changes: true` 约束）、`evidence_write`；`project_write` 的 `forbid_destructive_git_operations: true`、`branch_creation: deny`、`destructive_git: deny` 生效。`quality_gate_disable: deny`、`test_deletion_to_force_pass: deny` 禁止绕过自动同步测试门禁。

## 对应验证器
- 验证器 ID：`product.prototype_consistency`
- 实现路径：`.uap/validators/product/index.mjs`
- 检查项：`[prd_mapping, prototype_mapping, change_detection]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `task_id` / `specification_ids` | 任务与关联规范 ID |
| 输入 | `docs/product/registry/product-model.json` | 唯一权威数据模型（SSOT） |
| 输入 | PRD 投影变更 | `docs/product/prd/<domain>/UTER-XXX-NNN.md` 的字段/版本变化 |
| 输入 | 原型投影变更 | `docs/product/prototypes/<domain>/UTER-XXX-NNN.md|.html` 的页面/组件/交互变化 |
| 输入 | `scope` / `constraints` / `acceptance_criteria` | 同步范围、稳定 ID 约束、差异判定标准 |
| 输出 | 双向映射表 | Feature ID + `PP-/CMP-/INT-/REQ-/AC-` 稳定 ID 对应 |
| 输出 | 原型影响清单 / PRD 影响清单 | 分别列出两侧受影响投影与关联 ID |
| 输出 | 变更历史与差异记录 | `change-registry.yaml` / `history/v1.json` / `*-SYNC-REPORT.md` |
| 输出 | `executorResult` | `status/summary/changed_files/commands/evidence_refs/blocked_reasons` |
| 输出 | `validation_results` / `validatorResult` | 独立验证器回填的双向一致性结论 |
| 输出 | 同步证据 | `.uap/evidence/UAP-EVD-...` 与索引条目 |

## 失败处理
按 `.uap/config/execution-mapping.yaml` 的 `execution.failure_policy` 与 `.uap/config/permission-policy.yaml` 的 `enforcement.fail_closed: true`（`default_effect: deny`）逐类处置：
1. **permission_denied**：`product_write` 缺失即拒绝事务化双写与重渲染、记录审计事件，处置策略 `block`，任务迁移 BLOCKED，不绕过检查。
2. **missing_dependency**：`product-model.json`、`prototype-registry.yaml`、`feature-mapping.yaml` 或任一对侧投影文件缺失时，处置策略 `block`，任务 BLOCKED 并写入 `blocked_reasons`，待依赖补齐后重新排队。
3. **validation_failed**：`prd_mapping` / `prototype_mapping` 断链、`change_detection` 未捕获变更、存在未解决差异或自动同步测试失败时，处置策略 `repair_then_revalidate`，转入 `uap-defect-repair` 修复并复验；未解决差异不得标记 `sync_status: SYNCED` 或 SUCCEEDED。
4. **retryable**：处置策略 `bounded_retry`，重试上限 **3 次**（`max_repair_attempts_per_root_cause: 3`），退避采用指数退避（base=1s，第 n 次 base × 2^(n-1)，上限 8s，附随机抖动）；每次重试写入独立证据，禁止重放非幂等的事务化双写副作用。
5. **unrecoverable**：处置策略 `fail`，任务迁移 FAILED，保留差异记录与失败证据；按 `TASK_TRANSITIONS` 仅允许 FAILED → QUEUED / BLOCKED / CANCELLED。
全局 fail-closed：验证器缺失、证据缺失、必需检查被跳过或状态迁移非法时，一律按 BLOCKED / FAIL 处理；自动同步不得擅自改变已批准业务规则，不得以删除差异记录或降低门禁制造同步完成。

## 验收条件
1. 每个页面能够定位对应 PRD。
2. PRD 和原型能够双向发现变化。
3. 差异有记录。
4. 自动同步有测试。
5. 变更历史可追溯。

## 证据要求
- 证据统一落盘到 `.uap/evidence/`，索引写入 `.uap/reports/EVIDENCE-INDEX.md`；证据 ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EVD')` 生成稳定唯一 ID，每次同步/复验/重试产生独立证据，禁止复用。
- 每条证据必须记录：执行命令原文（如 `cd web && bun run test`、`bun run lint:design:strict`、`./scripts/verify-all.sh`）、`exit_code`、开始/结束时间（ISO 8601）、环境（`.uap/state/BASELINE.json` 的 `toolchain`）、输入（`feature_id`、PRD/原型变更字段、`scope`/`constraints`）、输出（影响清单、差异记录、`executorResult` / `validatorResult` 全文）以及日志引用路径。
- 验证结果由 `.uap/runtime/_lib/contract.mjs` 的 `validatorResult()` 归一化为 `{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；`PASS` 仅在 `executed=true && exit_code=0` 且 `findings` 无 `severity=BLOCKER` 时成立。
- 报告必须能经 `evidence_refs` 反查 `.uap/evidence/` 原始记录；`docs/product/history/v1.json`、`change-registry.yaml` 与 `BIDIRECTIONAL-SYNC-REPORT.md` 的变更历史须可追溯；`fail_if_evidence_missing: true` 强制证据存在。
- **证据不可覆盖**：新结果写入新证据文件，历史快照与差异记录不得被静默覆盖。**失败证据不可删除**：未解决差异、BLOCKED / FAILED / NOT_EXECUTED 证据必须保留，禁止以删除差异记录或重置 `sync_status` 制造同步完成。

## 依赖标准
- **UAP-01-001（产品需求工程规范）**：提供唯一 Feature ID、Feature Registry（`feature-registry.yaml`）、需求登记（`requirement-registry.yaml`）与需求→代码→测试→发布可追溯链，使 PRD 与原型的双向映射、影响清单和差异记录都锚定在稳定 ID 与统一数据模型之上。
