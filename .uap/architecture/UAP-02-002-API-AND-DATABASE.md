# UAP-02-002 — API 与数据库规范

**编号：** UAP-02-002
**标准编号：** UAP-02-002
**名称：** API 与数据库规范
**版本：** 1.0.0
**状态：** ACTIVE
**适用范围：** 约束 Uter 的 API 契约、数据库模型与三方言迁移安全，覆盖 `router/api-router.go`、`router/relay-router.go`、`middleware/access_token_routes.go`、`controller/`、`service/authz/`、`relay/helper/valid_request.go`、`model/main.go`、`model/migration_dialector.go`、`model/quota_reserve.go`、`common/quota_math.go`、`common/database.go`、`common/json.go`、`setting/billing_setting/builtin_billing.go`，以及 `docs-dev/plugin-api/v1.md` / `v1.schema.json` / `v1.d.ts` 插件契约。明确禁止在本次 UAP 建设中擅自连接生产数据库执行写入。
**关键级别：** P0
**依赖标准：** UAP-02-001

## 规范目标
本规范约束 Uter 的 API 契约（路径、方法、参数、响应、错误码、权限、输入验证、输出约束、兼容性、幂等性、限流）、数据库模型（字段类型、约束、索引、关联关系、精确金额类型）与三方言（SQLite / MySQL >= 5.7.8 / PostgreSQL >= 9.6）迁移安全。目标是 API 定义与实现一致、数据模型与迁移一致、迁移在隔离测试数据库验证通过、关键接口的幂等与并发测试有证据，且金额计算统一走 `common/quota_math.go` 精确转换，杜绝重复扣费与余额超扣。

## 强制性要求
1. API 必须定义路径、方法、参数、响应、错误码和权限。
2. API 必须进行输入验证和输出约束。
3. API 必须考虑兼容性、幂等性和限流。
4. 数据库表必须定义字段类型、约束、索引和关联关系。
5. 金额字段必须采用适合精确计算的类型。
6. 数据库迁移必须可追踪、可验证。
7. 迁移不得静默删除生产数据。
8. 破坏性迁移必须有备份和回滚方案。
9. 数据库访问必须遵循事务边界。
10. 关键业务操作必须检查并发竞争。
11. API 变更必须执行兼容性检查。
12. 数据库模型变更必须同步更新相关测试和文档。
13. 数据库迁移必须在隔离测试数据库中验证。
14. 禁止在本次 UAP 建设中擅自连接生产数据库执行写入。

## Uter 落地细则
- API 契约真实入口：`router/api-router.go`、`router/relay-router.go`、`router/channel-router.go`、`router/authz-router.go`、`router/task-router.go`、`router/task-plugin-protocol-router.go`、`router/web-router.go`、`router/main.go`；配套 `router/route_dump_test.go`、`router/relay_router_test.go`、`router/access_token_scope_test.go`、`router/cors_registration_test.go` 为契约与权限测试。
- 输入验证与限流：`middleware/access_token_routes.go`、`middleware/auth_origin.go`（CSRF）、`middleware/request_body_limit.go`、`middleware/session_rate_limit_test.go`、`common/validate.go`、`relay/helper/valid_request.go`（`maxTokensLimit` 对 max_tokens 系列字段限界）、`controller/`；`AGENTS.md` 的 Authentication Security (OWASP Mandatory) 要求服务端强制鉴权，`service/authz/permission.go` 为 Casbin 授权落地。
- 输出约束与 JSON 统一封装：`common/json.go` 的 `common.Marshal` / `common.Unmarshal` / `common.UnmarshalJsonStr` / `common.DecodeJson` / `common.GetJsonType`；`AGENTS.md` 禁止业务代码直接 `encoding/json` 调用；relay 可选标量字段须用 `*int`/`*uint`/`*float64`/`*bool` + `omitempty` 保留显式零值。
- 精确金额类型与舍入：`common/quota_math.go` 的 `QuotaFromFloat`（截断）、`QuotaRound`（half-away-from-zero）、`QuotaFromDecimal`、`WalletQuotaFromDecimalStrict`、`MaxWalletQuota`；`*Checked` 变体捕获 `common.QuotaClamp`，经 `service/log_info_generate.go` 的 `attachQuotaSaturation` 写入 `other.admin_info.quota_saturation`；`AGENTS.md` 禁止裸 `int(float64(quota) * ratio)` 等转换。`pkg/billingexpr/expr.md` 为表达式计费设计文档，内置价格在 `setting/billing_setting/builtin_billing.go`。
- 数据库模型与迁移真实文件：`model/main.go`（`commonGroupCol` / `commonKeyCol` / `commonTrueVal` / `commonFalseVal` / `lockForUpdate(tx)`）、`model/migration_dialector.go`、`model/missing_models.go`、`model/log_index_migration.go`、`model/authz_role.go`、`model/casbin_rule.go`、`model/quota_reserve.go`、`model/subscription.go`、`model/task_billing_state.go`、`common/database.go`（`common.UsingMainDatabase` / `common.UsingLogDatabase`）。
- 三方言兼容（SQLite / MySQL >= 5.7.8 / PostgreSQL >= 9.6）由 `AGENTS.md` 的 Database compatibility 强制：变更须在真实三库实例验证；GORM 方法优先于 raw SQL；主键由 GORM 生成，禁止 `AUTO_INCREMENT` / `SERIAL`；`SELECT ... FOR UPDATE` 必须用 `model/main.go` 的 `lockForUpdate(tx)`（GORM v2 忽略 `Set("gorm:query_option", ...)`）；PostgreSQL 用 `"column"`、MySQL/SQLite 用 `` `column` ``；SQLite 用 `ALTER TABLE ... ADD COLUMN` 而非 `ALTER COLUMN`；避免 `gorm:"default:true"` 引起 AutoMigrate 重复 ALTER。
- 迁移可追踪/可验证/幂等：`AGENTS.md` 要求迁移须在全新库与「由最新发布版本创建的代表性库」上都测试，启动/迁移至少两次证明幂等，验证既有数据/索引/约束/唯一性保留；覆盖单独配置的日志库（ClickHouse）共享路径；记录确切数据库版本、命令与结果。
- 并发竞争检查：`model/task_cas_test.go`、`model/quota_reserve_test.go`、`model/billing_integrity_test.go`、`model/subscription_refund_transaction_test.go`、`common/quota_math_test.go`、`relay/helper/openai_image_request_test.go`、`relay/common/relay_utils_test.go`；`AGENTS.md` 要求预扣/结算链（校验 → EstimateBilling/OtherRatios → 额度转换 → 预扣 → 结算/退款）每步保持 Billing safety invariants，饱和超额度须以余额不足失败预扣。
- 插件 API 契约：`docs-dev/plugin-api/v1.md`、`v1.schema.json`、`v1.d.ts`；`plugins/tasks/*/plugin.js` 的 `usageSchema` / `usageProfiles[].schema` 数值字段 `description` 须标注「计费主体 + 单价」，单位放 `unit`。
- 兼容性检查与验证命令：`./scripts/verify-all.sh [--quick]`、`gofmt -l .`、`GOWORK=off go vet ./...`、`make test`；`cd web && bun run typecheck|lint|test|copyright:check|format:check|build:check`；`cd tokenkit/tokenkit && GOWORK=off go vet ./... && GOWORK=off go test ./... && GOWORK=off go build ./...`；CI 见 `.github/workflows/ci.yml` / `release-gate.yml`。
- 生产隔离红线：`.uap/config/permission-policy.yaml` 的 `production_read: deny` / `production_write: deny` / `production_deploy: deny`，`test_environment` 权限组 `isolated_environment_only: true`，`execution.default_environment: local` / `dry_run_for_production: true`；`uap-financial-verification` 为 `environment: simulated_only`，`real_payment` / `real_refund` 为 deny。
- 文档同步：`AGENTS.md` 要求 API、数据库和业务规则变更必须同步更新文档；`docs/product/` 的 PRD/原型投影、`docs/adr/README.md` 的 ADR 与 `web/AGENTS.md` 的前端约定为受影响文档面。

## 执行流程
1. `uap-architecture-agent`（`.uap/engines/architecture/index.mjs`，权限 `[project_read, architecture_write, evidence_write]`）由 `uap-orchestrator` 分配，读取 `router/api-router.go`、`model/main.go`、`common/quota_math.go`、`AGENTS.md` 的 Database compatibility / Billing safety invariants。
2. 校验每个 API 定义路径/方法/参数/响应/错误码/权限，核对输入验证（`relay/helper/valid_request.go`、`common/validate.go`）、输出约束（`common/json.go`）、兼容性/幂等性/限流（`middleware/session_rate_limit_test.go`）。
3. 校验数据库表字段类型/约束/索引/关联关系，确认金额字段走 `common/quota_math.go` 精确类型与明确舍入，核对事务边界与并发竞争防护（`lockForUpdate(tx)`、`model/task_cas_test.go`）。
4. 在隔离测试数据库执行迁移验证（`test_environment` / `isolated_environment_only: true`），对全新库与升级库分别运行启动/迁移至少两次证明幂等，验证 SQLite/MySQL/PostgreSQL 三方言与 ClickHouse 日志库；破坏性迁移记录备份与回滚方案。
5. API 变更执行兼容性检查、数据库模型变更同步更新 `*_test.go` 与文档；运行真实命令（`make test`、`GOWORK=off go vet ./...`、`cd web && bun run test`）把命令与退出码写入 `executorResult()`。
6. `architecture.api_database_integrity` 验证器（`.uap/validators/architecture/index.mjs`）执行 `api_contracts` / `schema_integrity` / `migration_safety`，返回 `validatorResult()` 并回填 `validation_results`。
7. 生成证据 `UAP-EVD-...` 写入 `.uap/evidence/`，索引追加到 `.uap/reports/EVIDENCE-INDEX.md`；记录三方言版本、命令、退出码、幂等与并发测试结果。
8. 仅当 `executed=true && exit_code=0` 且无 BLOCKER 时判定通过；任何生产库写入尝试、`production_write` 申请或资金差异一律 fail-closed 阻断并保留证据。

## 对应执行器
- 执行器 ID：`architecture.api_database`
- 实现路径：`.uap/engines/architecture/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：按 `.uap/config/permission-policy.yaml` 与 `uap-architecture-agent`，需 `project_read`（读取 API/模型/迁移代码）、`architecture_write`（写契约与迁移分析，受 `preserve_uncommitted_changes: true` 约束）、`evidence_write`；数据库测试由 `uap-test-agent` 的 `test_environment`（`isolated_environment_only: true`）与 `local_command`（`require_command_logging: true`）配合。`production_read` / `production_write` / `production_deploy` / `real_payment` / `real_refund` / `secret_export` / `destructive_git` / `quality_gate_disable` 全部 `effect: deny`，禁止连接生产数据库执行写入。

## 对应验证器
- 验证器 ID：`architecture.api_database_integrity`
- 实现路径：`.uap/validators/architecture/index.mjs`
- 检查项：`[api_contracts, schema_integrity, migration_safety]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `task_id` / `specification_ids` | 任务与关联规范 ID |
| 输入 | API 契约定义 | `router/api-router.go` 等路由与 `controller/` 参数/响应 |
| 输入 | 数据库模型与迁移 | `model/main.go`、`model/migration_dialector.go`、`common/database.go` |
| 输入 | 隔离测试数据库 | SQLite / MySQL / PostgreSQL 三方言 + ClickHouse 日志库 |
| 输入 | `scope` / `constraints` / `acceptance_criteria` | 变更范围、生产隔离约束、验收标准 |
| 输出 | API 契约清单 | 路径/方法/参数/响应/错误码/权限/幂等/限流 |
| 输出 | 数据模型与迁移验证报告 | 字段/约束/索引/关联、幂等性、三方言与回滚方案 |
| 输出 | 幂等与并发测试证据 | 真实命令退出码、`UAP-EVD-...` |
| 输出 | `executorResult` | `status/summary/changed_files/commands/evidence_refs/blocked_reasons` |
| 输出 | `validation_results` / `validatorResult` | 独立验证器回填的 API/数据库完整性结论 |
| 输出 | `.uap/reports/EVIDENCE-INDEX.md` | 证据引用索引条目 |

## 失败处理
按 `.uap/config/execution-mapping.yaml` 的 `execution.failure_policy` 与 `.uap/config/permission-policy.yaml` 的 `enforcement.fail_closed: true`（`default_effect: deny`）逐类处置：
1. **permission_denied**：任何 `production_write` / `production_read` / `real_payment` / `real_refund` 申请即拒绝、记录 `log_denied_actions`，处置策略 `block`，任务迁移 BLOCKED；`production_*` 为 deny，绝不绕过去连生产库。
2. **missing_dependency**：隔离测试数据库不可用、三方言实例缺失、迁移文件或 `validatorResult()` 不可解析时，处置策略 `block`，任务 BLOCKED 并写入 `blocked_reasons`；`test_environment` 仅限 `isolated_environment_only: true`。
3. **validation_failed**：API 契约与实现不一致、迁移测试失败、幂等/并发测试未覆盖、`schema_integrity` 不合法或资金差异时，处置策略 `repair_then_revalidate`，转入 `uap-defect-repair` 修复并复验；资金差异一律阻断相关验收。
4. **retryable**：处置策略 `bounded_retry`，重试上限 **3 次**（`max_repair_attempts_per_root_cause: 3`），退避采用指数退避（base=1s，第 n 次 base × 2^(n-1)，上限 8s，附随机抖动）；每次重试写入独立证据，禁止重放非幂等的迁移/扣费副作用。
5. **unrecoverable**：处置策略 `fail`，任务迁移 FAILED 并保留全部失败证据；按 `TASK_TRANSITIONS` 仅允许 FAILED → QUEUED / BLOCKED / CANCELLED；破坏性迁移须保留备份与回滚方案记录。
全局 fail-closed：验证器缺失、证据缺失、必需检查被跳过、迁移静默删除数据或状态迁移非法时，一律按 BLOCKED / FAIL 处理；禁止在本次 UAP 建设中擅自连接生产数据库执行写入，测试必须使用隔离测试数据库与模拟支付渠道。

## 验收条件
1. API 定义与实现一致。
2. 数据模型与迁移一致。
3. 迁移测试通过。
4. 幂等和并发测试覆盖关键接口。

## 证据要求
- 证据统一落盘到 `.uap/evidence/`，索引写入 `.uap/reports/EVIDENCE-INDEX.md`；证据 ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EVD')` 生成稳定唯一 ID，禁止复用。
- 每条证据必须记录：执行命令原文（如 `./scripts/verify-all.sh`、`make test`、`GOWORK=off go vet ./...`、`cd web && bun run test`、`cd tokenkit/tokenkit && GOWORK=off go test ./...`）、`exit_code`、开始/结束时间（ISO 8601）、环境（`.uap/state/BASELINE.json` 的 `toolchain` 与确切 SQLite/MySQL/PostgreSQL 版本）、输入（API 路径、迁移版本、`scope`/`constraints`）、输出（`executorResult` / `validatorResult` 全文、迁移幂等结果、并发/幂等测试结论）以及日志引用路径。
- 验证结果由 `.uap/runtime/_lib/contract.mjs` 的 `validatorResult()` 归一化为 `{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；`PASS` 仅在 `executed=true && exit_code=0` 且 `findings` 无 `severity=BLOCKER` 时成立。
- 报告必须能经 `evidence_refs` 反查 `.uap/evidence/` 原始记录；`validation_policy.fail_if_evidence_missing: true` / `fail_if_required_check_skipped: true` 强制证据与检查完整；迁移须记录三方言版本、命令、结果与回滚方案。
- **证据不可覆盖**：新结果写入新证据文件，历史迁移与测试记录不得被静默覆盖。**失败证据不可删除**：迁移失败、幂等/并发测试失败、生产写入拒绝、BLOCKED / FAILED / NOT_EXECUTED 证据必须保留，禁止以删除失败证据或降低门禁制造通过结果。

## 依赖标准
- **UAP-02-001（系统架构规范）**：提供系统边界、模块边界、明确接口、模块依赖图与 ADR 记录基线，使 API 契约、数据库模型、迁移与关键链路的端到端架构说明可追溯，且架构变更须执行依赖影响验证后才进入 API/数据库变更流程。
