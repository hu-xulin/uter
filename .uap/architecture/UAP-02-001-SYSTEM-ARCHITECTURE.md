# UAP-02-001 — 系统架构规范

**编号：** UAP-02-001
**标准编号：** UAP-02-001
**名称：** 系统架构规范
**版本：** 1.0.0
**状态：** IMPLEMENTED_NOT_VERIFIED
**适用范围：** 约束 Uter 系统边界、模块依赖与关键链路的识别及 ADR 记录，覆盖 `router/`、`middleware/`、`controller/`、`service/`、`model/`、`relay/`、`common/`、`setting/`、`pkg/`、`plugins/tasks/`、`web/src/`、`electron/` 等真实工程模块，以及独立 Go 模块 `relaykit/`、`tokenkit/tokenkit/`。架构决策登记于 `docs/adr/README.md` 与 `docs/adr/0001-uter-design-system-single-source-of-truth.md`，设计基线为 `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md`。
**关键级别：** P1
**依赖标准：** UAP-00-001

## 规范目标
本规范识别 Uter 系统边界、模块依赖与关键链路，并以 ADR 记录架构变更：以 `go.mod`（`module github.com/uter-ai/uter`）的主模块、`relaykit/go.mod` 的独立模块、React 19/Rsbuild 的 `web/` 前端与 `electron/` 桌面包装为边界。目标是让 `router/main.go` / `router/api-router.go` 的架构图与实际代码一致，模块依赖可分析，关键业务链路（管理 API、上游 relay、计费、后台任务）可追溯，且架构变更必须记录 ADR 并执行依赖影响验证。

## 强制性要求
1. 必须识别系统边界、模块边界和外部依赖。
2. 必须维护系统架构图和模块依赖图。
3. 模块必须遵循明确的职责划分。
4. 禁止未经论证的跨模块直接耦合。
5. 模块间通信必须使用明确接口。
6. 架构变更必须记录 ADR。
7. 架构分析必须包含可扩展性、可靠性、安全性和维护成本。
8. 关键业务链路必须有端到端架构说明。
9. 必须识别单点故障和关键依赖。
10. 不得为了形式化而无理由引入微服务或复杂基础设施。
11. 架构图必须与实际代码保持一致。
12. 架构变更必须执行依赖影响验证。

## Uter 落地细则
- 系统边界由 `AGENTS.md` 的 Overview / Architecture 定义：Go AI API gateway 聚合 40+ 上游 provider（OpenAI、Claude、Gemini、Azure、AWS Bedrock 等），处理管理 API、上游 relay、计费与后台任务，分层于 `router/`、`middleware/`、`controller/`、`service/`、`model/`、`relay/`；前端 `web/`（React 19 / Rsbuild 2），桌面包装 `electron/`。
- 模块边界的权威声明：`go.mod`（`module github.com/uter-ai/uter`，Go 1.27.3）、`relaykit/go.mod`（`module github.com/uter-ai/uter/relaykit`，独立 Go 模块，仅承载协议 DTO 与转换，禁止 import 根模块）、`tokenkit/tokenkit/`（独立声明模块，有自身 `go.mod`/`go.sum`）。
- 路由层真实文件：`router/main.go`、`router/api-router.go`、`router/relay-router.go`、`router/channel-router.go`、`router/authz-router.go`、`router/task-router.go`、`router/task-plugin-protocol-router.go`、`router/plugin-router.go`、`router/video-router.go`、`router/web-router.go`、`router/dashboard.go`；配套 `router/route_dump_test.go`、`router/relay_router_test.go`、`router/channel_router_test.go` 为接口一致性测试。
- 明确接口与职责划分：`middleware/access_token_routes.go`、`middleware/auth_origin.go`、`middleware/request-id.go`、`middleware/request_body_limit.go`（横切）；`controller/`（请求编排）；`service/authz/permission.go` / `role.go` / `registry.go`（Casbin 授权）；`model/main.go`（GORM 模型与方言 helper）；`common/json.go`（`common.Marshal` / `common.Unmarshal` 统一 JSON 封装）、`common/database.go`、`common/quota_math.go`。
- 外部依赖识别：`relay/channel/` 下 40+ provider 目录（如 `relay/channel/openai/`、`claude/`、`gemini/`、`aws/`、`vertex/`）为上游依赖；`plugins/tasks/*/plugin.js`（`plugins/tasks/kling/plugin.js` 等）经 `pkg/jsplugin/` 由 Sobek 执行；Redis（go-redis）+ 内存缓存；SQLite/MySQL/PostgreSQL 主库与 ClickHouse 日志库。
- ADR 正式注册入口：`docs/adr/README.md`（状态定义 Proposed / Accepted / Rejected / Deprecated / Superseded，维护规则 6 条：新 ADR 先核对现有决策、仅明确批准才 Accepted、必须记录来源/适用范围/实施状态/可核验证据、偏离 Accepted ADR 须修复或新 ADR 替代、状态变化不得删除历史、历史决策须逐项盘点）；现有 `docs/adr/0001-uter-design-system-single-source-of-truth.md`（Accepted，2026-11-03，UTER Design System 3.0 作为设计规范唯一事实来源）。
- 设计系统唯一标准 `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md`（已核验章节：`# 0. 规范效力与执行原则`、`# 1. Typography 字体系统`、`# 2. Color 色彩系统`、`# 3. Page Hierarchy`、`# 4. Surface 与 Border`、`# 5. Radius`、`# 6. Spacing`、`# 7. Density`、`# 8. Shadow 与 Elevation`）与视觉样本 `docs/design-system/showcase-3.0.html`；前端实现 `web/src/design-system/`、`web/src/components/ui/`。
- 架构与代码一致性的验证命令：`./scripts/verify-all.sh [--quick]`、`gofmt -l .`、`GOWORK=off go vet ./...`、`make test`（`Makefile` 的 `test` 目标覆盖 root / relaykit / tokenkit / tokenkit/tokenkit 四模块）、`cd relaykit && GOWORK=off go build ./...`、`cd web && bun run typecheck|lint|test|build:check`。
- 关键业务链路端到端说明的落点：管理 API（`router/api-router.go` → `controller/` → `service/` → `model/`）、上游 relay（`router/relay-router.go` → `relay/channel/*/` → `common/quota_math.go` 计费）、认证（`middleware/access_token_routes.go` + `service/authz/`）、任务插件（`router/task-router.go` → `pkg/jsplugin/` → `plugins/tasks/`）、前端（`web/src/routes/` → `web/src/features/` → `web/src/lib/`）。
- 单点故障与关键依赖：主库/日志库（`common/database.go` 的 `UsingMainDatabase` / `UsingLogDatabase`）、Redis 缓存、`model/migration_dialector.go` 的迁移入口；`AGENTS.md` 的 Database compatibility 要求三方言真实实例验证与迁移幂等（启动/迁移至少两次）。
- CI 与部署环境：9 个 workflow 登记于 `.uap/state/BASELINE.json` 的 `ci_workflows`（`ci.yml`、`release-gate.yml`、`nightly-full-audit.yml`、`weekly-security-audit.yml` 等）；`AGENTS.md` 禁止无理由引入微服务或复杂基础设施，PR 已被 main-only 治理策略禁用。

## 执行流程
1. `uap-architecture-agent`（`.uap/engines/architecture/index.mjs`，权限 `[project_read, architecture_write, evidence_write]`）由 `uap-orchestrator` 分配，读取 `AGENTS.md`、`go.mod`、`relaykit/go.mod`、`.uap/state/BASELINE.json`。
2. 扫描 `router/`、`middleware/`、`controller/`、`service/`、`model/`、`relay/`、`web/src/`、`electron/`、`plugins/tasks/` 真实目录，识别系统边界、模块边界、外部依赖，产出模块依赖图。
3. 核对明确接口（`common/json.go`、`service/authz/`、`model/main.go`）与职责划分，检测未经论证的跨模块直接耦合（如 `relaykit/` 反向 import 根模块）并记录为发现。
4. 对关键业务链路（管理 API / 上游 relay / 计费 / 认证 / 任务插件 / 前端）生成端到端架构说明，标注单点故障与关键依赖；分析可扩展性、可靠性、安全性与维护成本。
5. 架构变更时写入 `docs/adr/` 新记录（遵循 `docs/adr/README.md` 的编号与状态规则），并执行依赖影响验证：运行 `make test`、`GOWORK=off go vet ./...`、`cd relaykit && GOWORK=off go build ./...`、`cd web && bun run build:check`，把命令与退出码写入 `executorResult()`。
6. `architecture.consistency` 验证器（`.uap/validators/architecture/index.mjs`）执行 `module_boundaries` / `dependency_graph` / `architecture_evidence`，核对架构图与实际代码一致、依赖可分析、ADR 存在。
7. 生成证据 `UAP-EVD-...` 写入 `.uap/evidence/`，索引追加到 `.uap/reports/EVIDENCE-INDEX.md`；状态按 `LIFECYCLE_STATUSES` 记录。
8. 仅当 `executed=true && exit_code=0` 且无 BLOCKER 时判定通过；架构变更无 ADR 或依赖影响验证失败即 BLOCKED / FAILED 并保留证据。

## 对应执行器
- 执行器 ID：`architecture.analyzer`
- 实现路径：`.uap/engines/architecture/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：按 `.uap/config/permission-policy.yaml` 与 `.uap/config/agent-registry.yaml` 的 `uap-architecture-agent`，需 `project_read`（读取架构文档与真实代码）、`architecture_write`（写 `docs/adr/` 与架构分析，受 `preserve_uncommitted_changes: true` 约束）、`evidence_write`；如需执行验证命令由 `local_command`（`require_command_logging: true`）配合。`production_read/write/deploy`、`force_push`、`branch_creation`、`destructive_git`、`quality_gate_disable` 一律 `deny`。

## 对应验证器
- 验证器 ID：`architecture.consistency`
- 实现路径：`.uap/validators/architecture/index.mjs`
- 检查项：`[module_boundaries, dependency_graph, architecture_evidence]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `task_id` / `specification_ids` | 任务与关联规范 ID |
| 输入 | `AGENTS.md` / `go.mod` / `relaykit/go.mod` | 系统边界与模块边界权威声明 |
| 输入 | 真实模块目录 | `router/`、`model/`、`relay/`、`web/src/`、`plugins/tasks/` |
| 输入 | `docs/adr/README.md` / `docs/adr/0001-*.md` | 现有 ADR 与状态定义 |
| 输入 | `scope` / `constraints` / `acceptance_criteria` | 架构分析范围、依赖约束、验收标准 |
| 输出 | 系统架构图 / 模块依赖图 | 与真实代码一致的边界与依赖关系 |
| 输出 | 关键链路端到端说明 | 管理 API / relay / 计费 / 认证 / 插件 / 前端 |
| 输出 | 单点故障与依赖清单 | 主库/日志库/缓存/迁移入口 |
| 输出 | ADR 记录 | `docs/adr/` 下的决策记录与依赖影响验证结果 |
| 输出 | `executorResult` / `validatorResult` | 结构化执行结果与独立验证结论 |
| 输出 | 架构证据 | `.uap/evidence/UAP-EVD-...` 与索引条目 |

## 失败处理
按 `.uap/config/execution-mapping.yaml` 的 `execution.failure_policy` 与 `.uap/config/permission-policy.yaml` 的 `enforcement.fail_closed: true`（`default_effect: deny`）逐类处置：
1. **permission_denied**：`architecture_write` / `project_read` 缺失即拒绝写 ADR 或架构分析、记录审计事件，处置策略 `block`，任务迁移 BLOCKED，不绕过检查。
2. **missing_dependency**：`relaykit/go.mod`、`tokenkit/tokenkit/`、`web/` 或 ADR 索引缺失、模块依赖不可解析时，处置策略 `block`，任务 BLOCKED 并写入 `blocked_reasons`，待依赖补齐重新排队。
3. **validation_failed**：架构图与代码不一致、跨模块耦合未经论证、缺 ADR 或依赖影响验证失败时，处置策略 `repair_then_revalidate`，转入 `uap-defect-repair` 修复并复验；未复验通过不得 SUCCEEDED。
4. **retryable**：处置策略 `bounded_retry`，重试上限 **3 次**（`max_repair_attempts_per_root_cause: 3`），退避采用指数退避（base=1s，第 n 次 base × 2^(n-1)，上限 8s，附随机抖动）；每次重试写入独立证据，禁止重放非幂等的 ADR 编号分配副作用。
5. **unrecoverable**：处置策略 `fail`，任务迁移 FAILED 并保留全部失败证据；按 `TASK_TRANSITIONS` 仅允许 FAILED → QUEUED / BLOCKED / CANCELLED。
全局 fail-closed：验证器缺失、证据缺失、必需检查被跳过或状态迁移非法时，一律按 BLOCKED / FAIL 处理；不得为形式化无理由引入微服务或复杂基础设施，也不得以「文档存在」替代架构图与代码一致性验证。

## 验收条件
1. 架构图与代码结构一致。
2. 模块依赖可分析。
3. 关键业务链路可追溯。
4. 架构变更有 ADR。

## 证据要求
- 证据统一落盘到 `.uap/evidence/`，索引写入 `.uap/reports/EVIDENCE-INDEX.md`；证据 ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EVD')` 生成稳定唯一 ID，禁止复用。
- 每条证据必须记录：执行命令原文（如 `./scripts/verify-all.sh`、`make test`、`GOWORK=off go vet ./...`、`cd relaykit && GOWORK=off go build ./...`、`cd web && bun run build:check`）、`exit_code`、开始/结束时间（ISO 8601）、环境（`.uap/state/BASELINE.json` 的 `toolchain`）、输入（`task_id`、模块清单、`scope`/`constraints`）、输出（架构图、依赖图、ADR 编号、`executorResult` / `validatorResult` 全文）以及日志引用路径。
- 验证结果由 `.uap/runtime/_lib/contract.mjs` 的 `validatorResult()` 归一化为 `{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；`PASS` 仅在 `executed=true && exit_code=0` 且 `findings` 无 `severity=BLOCKER` 时成立。
- 报告必须能经 `evidence_refs` 反查 `.uap/evidence/` 原始记录；`docs/adr/README.md` 要求 ADR 记录来源、适用范围、实施状态与可核验代码/文档证据，状态变化不得删除历史；`fail_if_evidence_missing: true` 强制证据存在。
- **证据不可覆盖**：新结果写入新证据文件，历史架构基线与 ADR 记录不得被静默覆盖。**失败证据不可删除**：BLOCKED / FAILED / NOT_EXECUTED 与依赖影响验证失败证据必须保留，禁止以删除失败证据或降低门禁制造通过结果。

## 依赖标准
- **UAP-00-001（UAP 核心架构规范）**：提供六层架构、稳定接口契约、结构化 `executorResult()` / `validatorResult()` 与可追溯基线，使系统边界识别、模块依赖分析、ADR 记录与架构证据具备机器可解析的执行与验证映射。
