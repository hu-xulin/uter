# UAP-01-003 — 业务规则工程规范

**编号：** UAP-01-003
**标准编号：** UAP-01-003
**名称：** 业务规则工程规范
**版本：** 1.0.0
**状态：** ACTIVE
**适用范围：** 约束 Uter 计费、额度、订单、退款、权限等关键业务规则的集中登记与代码/测试绑定，覆盖 `docs/product/registry/requirement-registry.yaml` 的 `business_rule_ids`（`BR-*`）、`common/quota_math.go`、`model/quota_reserve.go`、`model/subscription.go`、`model/task_billing_state.go`、`model/midjourney_refund_log_outbox.go`、`setting/billing_setting/builtin_billing.go`、`service/authz/permission.go`、`relay/channel/*/`。适用于 UAP 对资金与状态机规则的冲突检测、影响分析与正向/反向/边界/并发验证。
**关键级别：** P0
**依赖标准：** UAP-01-001

## 规范目标
本规范把计费、额度、订单、退款等 Uter 关键业务规则集中登记并绑定到代码与测试：以 `docs/product/registry/requirement-registry.yaml` 的 `BR-*` Rule ID 为索引，以 `AGENTS.md` 的 Billing safety invariants 与 Database compatibility 为强制边界。目标是关键资金规则采用精确金额类型与明确舍入策略（`common/quota_math.go`），状态转换禁止非法回退/跳转，后端执行关键业务约束，且正向/反向/边界/并发测试均有可验证证据，冲突规则可被发现。

## 强制性要求
1. 业务规则必须集中登记。
2. 每条规则必须有唯一 Rule ID。
3. 规则必须包含条件、行为、结果、异常、优先级和适用范围。
4. 业务规则必须与代码实现、API、数据库和测试关联。
5. 相互冲突的规则必须被检测。
6. 规则修改必须执行影响分析。
7. 关键资金规则必须采用精确金额类型和明确舍入策略。
8. 权限、额度、计费、退款和订单状态必须具有明确状态转换。
9. 状态转换必须禁止非法回退和非法跳转。
10. 业务规则不得只存在于前端。
11. 后端必须执行关键业务约束。
12. 关键规则必须有正向、反向、边界和并发测试。

## Uter 落地细则
- 规则集中登记于 `docs/product/registry/requirement-registry.yaml`（`total: 124`），每条需求带 `business_rule_ids`（如 `BR-AUTH-001-01-01`、`BR-AUTH-001-01-02`、`BR-AUTH-001-01-03`）并关联 `prototype_page_ids`、`component_ids`、`acceptance_ids`、`test_case_ids`，实现规则→代码→API→数据库→测试绑定。
- 唯一权威数据模型 `docs/product/registry/product-model.json`；`feature-registry.yaml`（56 个 Feature）、`feature-mapping.yaml`、`change-registry.yaml`（`conflicts: []`、`changes`）为规则变更与冲突检测的数据入口；`docs/product/PRODUCT-FEATURE-ID-STANDARD.md` 定义 `BR-` 前缀。
- 精确金额与舍入策略唯一实现为 `common/quota_math.go`：`common.QuotaFromFloat`（截断）、`common.QuotaRound`（half-away-from-zero）、`common.QuotaFromDecimal`、`common.WalletQuotaFromDecimalStrict`、`common.MaxWalletQuota`；`*Checked` 变体（如 `QuotaFromFloatChecked` / `QuotaRoundChecked` / `QuotaFromDecimalChecked`）返回 `*common.QuotaClamp` 捕获饱和，经 `attachQuotaSaturation`（`service/log_info_generate.go`）写入 `other.admin_info.quota_saturation`。`AGENTS.md` 禁止裸 `int(...)` 转换与本地重复 helper。
- 计费表达式系统文档 `pkg/billingexpr/expr.md`（设计哲学、表达式语言、token 归一化、额度转换、版本化）；内置模型价格在 `setting/billing_setting/builtin_billing.go` 以真实 USD/百万 token 的自包含计费表达式定义；`setting/billing_setting/tiered_billing.go` 处理阶梯计费。
- 状态机与资金流水代码：`model/quota_reserve.go`（预扣）、`model/task_billing_state.go`（结算/差额）、`model/subscription.go`（订阅订单）、`model/midjourney_refund_log_outbox.go`（退款 outbox）、`model/subscription_order_status_test.go`、`model/subscription_refund_transaction_test.go`、`model/billing_integrity_test.go`、`model/task_cas_test.go`（并发 CAS）。
- 幂等/并发/重复回调的回归测试：`common/quota_math_test.go`、`relay/helper/openai_image_request_test.go`、`relay/common/relay_utils_test.go`、`model/quota_reserve_test.go`、`model/subscription_overflow_settlement_test.go`；`AGENTS.md` 要求 user-controlled 乘数（`dto.MaxImageN`、`relaycommon.MaxTaskDurationSeconds`、`maxTokensLimit`）在请求校验层以 400 拒绝越界。
- 权限规则后端实现：`service/authz/permission.go`、`service/authz/role.go`、`service/authz/registry.go`、`model/authz_role.go`、`model/casbin_rule.go`（Casbin）、`router/authz-router.go`、`middleware/access_token_routes.go`；前端 `web/src/features/` 不承载最终业务约束（「业务规则不得只存在于前端」）。
- 三方言数据库兼容（`AGENTS.md` 的 Database compatibility）：`model/main.go`（`commonGroupCol`/`commonKeyCol`/`commonTrueVal`/`commonFalseVal`/`lockForUpdate(tx)`）、`model/migration_dialector.go`、`common/database.go`（`common.UsingMainDatabase` / `common.UsingLogDatabase`）；迁移须在 SQLite/MySQL/PostgreSQL 真实实例与隔离测试库验证，禁止静默删除生产数据。
- API 契约与输入验证：`router/api-router.go`、`controller/`、`relay/helper/valid_request.go`、`common/validate.go`；`AGENTS.md` 的 Authentication Security (OWASP Mandatory) 要求服务端强制鉴权与校验。
- 任务插件计费规则：`plugins/tasks/*/plugin.js`（`plugins/tasks/kling/plugin.js` 等）经 `pkg/jsplugin/` 由 Sobek 执行，`usageSchema` / `usageProfiles[].schema` 的数值字段 `description` 必须标注「计费主体 + 单价」，约束见 `docs-dev/plugin-api/v1.md` 与 `v1.schema.json` / `v1.d.ts`。
- 规则影响分析与验证命令：`./scripts/verify-all.sh [--quick]`、`gofmt -l .`、`GOWORK=off go vet ./...`、`make test`；`cd web && bun run typecheck|lint|test|lint:design:strict|format:check|build:check`；CI 见 `.github/workflows/ci.yml` 与 `release-gate.yml`；模拟支付验证由 `.uap/config/workflow-registry.yaml` 的 `uap-financial-verification`（`environment: simulated_only`）承载，`real_payment` / `real_refund` 权限为 deny。

## 执行流程
1. `uap-product-agent`（`.uap/engines/product/index.mjs`，权限 `[project_read, product_write, evidence_write]`）由 `uap-orchestrator` 分配，加载 `docs/product/registry/requirement-registry.yaml` 与 `product-model.json`，汇总全部 `BR-*` Rule ID。
2. 校验每条规则具备唯一 Rule ID 及条件、行为、结果、异常、优先级、适用范围，并关联代码实现（`common/quota_math.go` 等）、API（`router/api-router.go`）、数据库（`model/`）、测试（`*_test.go`）。
3. 执行冲突检测：比对 `change-registry.yaml` 的 `conflicts`、重复 `BR-*` 与相互矛盾的状态转换，产出冲突清单；规则修改时生成覆盖 API / 数据库 / 前端 / 后端 / 测试 / 文档的影响分析记录。
4. 校验关键资金规则使用精确金额类型与明确舍入策略（`QuotaFromFloat` / `QuotaRound` / `QuotaFromDecimal` / `*Checked`），检查状态转换禁止非法回退/跳转，确认后端（非仅前端）执行关键约束。
5. 执行正向/反向/边界/并发测试真实命令（`make test`、`GOWORK=off go vet ./...`、`cd web && bun run test`），把命令、退出码、`changed_files` 写入 `executorResult()`；模拟支付/退款用 `uap-financial-verification`（`simulated_only`），禁止真实资金。
6. `product.business_rule_integrity` 验证器（`.uap/validators/product/index.mjs`）执行 `rule_ids` / `conflict_detection` / `business_test_coverage`，返回 `validatorResult()` 并回填 `validation_results`。
7. 生成证据 `UAP-EVD-...` 写入 `.uap/evidence/`，索引追加到 `.uap/reports/EVIDENCE-INDEX.md`；状态按 `LIFECYCLE_STATUSES` 记录。
8. 仅当 `executed=true && exit_code=0` 且无 BLOCKER、无未检测冲突时判定通过；否则按失败分类处置并保留冲突与失败证据。

## 对应执行器
- 执行器 ID：`product.business_rules`
- 实现路径：`.uap/engines/product/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：按 `.uap/config/permission-policy.yaml` 与 `uap-product-agent`，需 `project_read`（读取规则登记与真实代码/测试）、`product_write`（写影响分析/冲突记录，受 `preserve_uncommitted_changes: true` 约束）、`evidence_write`；如需执行测试命令由 `uap-test-agent` 的 `local_command` / `test_environment`（`isolated_environment_only: true`）配合。`real_payment`、`real_refund`、`production_write`、`production_deploy`、`quality_gate_disable`、`test_deletion_to_force_pass` 一律 `deny`。

## 对应验证器
- 验证器 ID：`product.business_rule_integrity`
- 实现路径：`.uap/validators/product/index.mjs`
- 检查项：`[rule_ids, conflict_detection, business_test_coverage]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `task_id` / `specification_ids` | 任务与关联规范 ID |
| 输入 | `requirement-registry.yaml` | `BR-*` 规则登记与关联 ID |
| 输入 | `product-model.json` / `change-registry.yaml` | 冲突检测与规则变更来源 |
| 输入 | `scope` / `constraints` / `acceptance_criteria` | 规则范围、资金安全约束、验收标准 |
| 输入 | 真实代码与测试路径 | `common/quota_math.go`、`model/`、`*_test.go` |
| 输出 | 唯一 Rule ID 清单 | `BR-*` 及条件/行为/结果/异常/优先级/适用范围 |
| 输出 | 冲突检测与影响分析记录 | 冲突清单 + API/数据库/前端/后端/测试/文档影响 |
| 输出 | `executorResult` | `status/summary/changed_files/commands/evidence_refs/blocked_reasons` |
| 输出 | 四类测试证据 | 正向/反向/边界/并发真实命令退出码，`UAP-EVD-...` |
| 输出 | `validation_results` / `validatorResult` | 独立验证器回填的规则完整性结论 |
| 输出 | `.uap/reports/EVIDENCE-INDEX.md` | 证据引用索引条目 |

## 失败处理
按 `.uap/config/execution-mapping.yaml` 的 `execution.failure_policy` 与 `.uap/config/permission-policy.yaml` 的 `enforcement.fail_closed: true`（`default_effect: deny`）逐类处置：
1. **permission_denied**：`product_write` 缺失或申请 `real_payment` / `real_refund` / `production_write` 时拒绝动作、记录审计事件，处置策略 `block`，任务迁移 BLOCKED；资金验证一律改用 `simulated_only`。
2. **missing_dependency**：`requirement-registry.yaml`、`product-model.json`、`common/quota_math.go` 或关键测试文件不可解析时，处置策略 `block`，任务 BLOCKED 并写入 `blocked_reasons`，待依赖补齐重新排队。
3. **validation_failed**：检测到冲突规则、缺唯一 `BR-*`、非法状态回退/跳转、关键约束仅前端实现或四类测试未覆盖时，处置策略 `repair_then_revalidate`，转入 `uap-defect-repair` 修复并复验；资金差异相关验收一律阻断。
4. **retryable**：处置策略 `bounded_retry`，重试上限 **3 次**（`max_repair_attempts_per_root_cause: 3`），退避采用指数退避（base=1s，第 n 次 base × 2^(n-1)，上限 8s，附随机抖动）；每次重试写入独立证据，禁止重放非幂等的资金/状态机副作用。
5. **unrecoverable**：处置策略 `fail`，任务迁移 FAILED 并保留全部失败证据与冲突清单；按 `TASK_TRANSITIONS` 仅允许 FAILED → QUEUED / BLOCKED / CANCELLED。
全局 fail-closed：验证器缺失、证据缺失、必需检查被跳过、资金饱和未捕获或状态转换非法时，一律按 BLOCKED / FAIL 处理；不得通过 `quality_gate_disable`、删除失败测试或降低门禁制造通过，测试必须使用模拟支付渠道与隔离数据库。

## 验收条件
1. 核心业务规则有唯一 ID。
2. 代码与规则可追溯。
3. 关键规则具有自动化验证。
4. 冲突规则可以被发现。

## 证据要求
- 证据统一落盘到 `.uap/evidence/`，索引写入 `.uap/reports/EVIDENCE-INDEX.md`；证据 ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EVD')` 生成稳定唯一 ID，禁止复用。
- 每条证据必须记录：执行命令原文（如 `./scripts/verify-all.sh`、`GOWORK=off go vet ./...`、`make test`、`cd web && bun run test`）、`exit_code`、开始/结束时间（ISO 8601）、环境（`.uap/state/BASELINE.json` 的 `toolchain`）、输入（`BR-*` ID、`scope`/`constraints`）、输出（`executorResult` / `validatorResult` 全文、冲突清单、影响分析）以及日志引用路径。
- 验证结果由 `.uap/runtime/_lib/contract.mjs` 的 `validatorResult()` 归一化为 `{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；`PASS` 仅在 `executed=true && exit_code=0` 且 `findings` 无 `severity=BLOCKER` 时成立。
- 报告必须能经 `evidence_refs` 反查 `.uap/evidence/` 原始记录；`fail_if_evidence_missing: true` / `fail_if_required_check_skipped: true` 强制证据与检查完整；`docs/product/registry/change-registry.yaml` 的 `conflicts` 与 `docs/product/history/v1.json` 须可追溯。
- **证据不可覆盖**：新结果写入新证据文件，禁止覆盖历史规则版本记录。**失败证据不可删除**：冲突、资金差异、BLOCKED / FAILED / NOT_EXECUTED 证据必须保留，禁止以删除失败证据、重置状态或降低门禁制造通过结果；测试不得触碰真实资金。

## 依赖标准
- **UAP-01-001（产品需求工程规范）**：提供唯一 Feature ID、Feature Registry、`requirement-registry.yaml` 的需求登记与 `BR-*` 关联 ID 体系、影响分析与验收可追溯链，使业务规则能集中登记并绑定到代码、API、数据库与测试，且规则变更可触发可追溯的影响分析。
