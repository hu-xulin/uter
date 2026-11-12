# UAP-00-003 — 自主工程安全边界规范

**编号：** UAP-00-003
**标准编号：** UAP-00-003
**名称：** 自主工程安全边界规范
**版本：** 1.0.0
**状态：** ACTIVE
**适用范围：** 约束 Uter 内所有 Agent 与执行器的最小权限、fail-closed 策略边界，覆盖 `.uap/runtime/policy-engine/index.mjs`、`.uap/config/permission-policy.yaml`、`.uap/config/agent-registry.yaml` 的 11 个已登记 Agent，以及 `service/authz/`、`middleware/access_token_routes.go`、`common/crypto.go`、`common/quota_math.go` 等真实鉴权与资金边界代码。适用于 UAP 对 `model/`、`relay/`、`web/src/` 的任何读写、命令、数据库与发布动作，并隔离模拟与生产环境。
**关键级别：** P0
**依赖标准：** UAP-00-001

## 规范目标
本规范为所有 Agent 与执行器定义最小权限、fail-closed 的策略边界：`.uap/config/permission-policy.yaml` 以 `default_effect: deny` + `enforcement.fail_closed: true` 作为唯一判据，`production_*` / `real_payment` / `real_refund` / `quality_gate_disable` 等高风险权限一律拒绝。目标是让越权操作被真实拒绝、密钥扫描能发现测试用秘密、敏感信息不进入普通日志，且模拟验证与生产配置明确隔离，与 `AGENTS.md` 的 Billing safety invariants / Authentication Security (OWASP Mandatory) 保持一致。

## 强制性要求
1. 所有 Agent 必须使用明确身份和权限。
2. 默认采用最小权限原则。
3. 读取、写入、执行命令、网络访问、数据库访问和发布权限必须分开定义。
4. 高风险操作必须在执行前进行策略判断。
5. 生产资金、生产数据库、生产密钥和不可逆生产发布默认禁止自动执行。
6. 模拟环境与生产环境必须明确隔离。
7. 禁止将密钥、Token、密码写入日志、报告或提交记录。
8. 外部输入、网页内容、仓库内容和 Agent 输出均视为不可信数据。
9. 不可信数据不得覆盖系统权限规则。
10. 所有敏感操作必须记录审计事件。
11. 权限不足时必须停止相关动作，而不是绕过检查。
12. 安全策略不得由普通任务自行修改。
13. 安全失败必须阻断相关任务。
14. 必须支持密钥脱敏和日志清理。

## Uter 落地细则
- 身份与权限的唯一登记处为 `.uap/config/agent-registry.yaml`（`registry_id: UAP-AGENT-REGISTRY`），含 11 个 Agent：`uap-orchestrator`、`uap-product-agent`、`uap-architecture-agent`、`uap-development-agent`、`uap-review-agent`、`uap-test-agent`、`uap-repair-agent`、`uap-security-agent`、`uap-cross-platform-agent`、`uap-delivery-agent`、`uap-knowledge-agent`；`defaults.deny_unregistered_agents: true` / `deny_undeclared_tools: true` / `enforce_permission_policy: true` / `require_structured_output: true`。
- 权限组在 `.uap/config/permission-policy.yaml` 中分开定义：`project_read`、`project_write`、`local_command`、`task_create`、`task_dispatch`、`product_write`、`architecture_write`、`knowledge_write`、`evidence_write`、`test_environment`（`isolated_environment_only: true`），与 `production_read` / `production_write` / `production_deploy` / `real_payment` / `real_refund` / `secret_export` / `force_push` / `branch_creation` / `branch_switch` / `destructive_git` / `quality_gate_disable` / `test_deletion_to_force_pass` 的 `effect: deny` 明确隔离。
- 策略执行器为 `.uap/runtime/policy-engine/index.mjs`（`security.policy`），配置 `implementation: .uap/runtime/policy-engine/index.mjs`、`default_effect: deny`；`enforcement` 六项均为 true：`check_before_action`、`log_denied_actions`、`log_sensitive_actions`、`redact_secrets`、`fail_closed`。
- 后端真实鉴权边界：`service/authz/permission.go`、`service/authz/role.go`、`service/authz/registry.go`、`service/authz/resources_channel.go`、`service/authz/resources_task_plugin.go`、`service/authz/resources_audit.go`，以及 `model/authz_role.go`、`model/casbin_rule.go`（Casbin 授权）。
- 认证与会话边界：`middleware/access_token_routes.go`、`middleware/auth_origin.go`、`middleware/auth_origin_csrf_test.go`、`middleware/session_rate_limit_test.go`、`common/session_cookie.go`、`common/password_crypto.go`、`common/crypto.go`；`AGENTS.md` 的 Authentication Security (OWASP Mandatory) 要求服务端强制校验、审计事件排除密码/验证码/Token。
- 密钥与敏感信息保护对齐 `AGENTS.md` 的 Change Protection：`.env`、`*.db`/`-shm`/`-wal`、`logs/`、构建产物不得进入提交、代码或文档；`.github/workflows/ci.yml` 的 `permissions: contents: read` 体现最小权限；`scripts/quality/gitleaks-allowlist.test.sh` 提供密钥扫描基线。
- 资金边界由 `AGENTS.md` 的 Billing safety invariants 与 `common/quota_math.go`（`QuotaFromFloat` / `QuotaRound` / `QuotaFromDecimal` / `*Checked` 变体 / `QuotaClamp`）落实，`common/quota_math_test.go`、`relay/helper/openai_image_request_test.go`、`relay/common/relay_utils_test.go` 为回归测试；`model/quota_reserve.go`、`model/task_billing_state.go`、`model/midjourney_refund_log_outbox.go` 为预扣/结算/退款流水代码。
- 模拟与生产隔离由 `.uap/config/workflow-registry.yaml` 的 `uap-financial-verification`（`environment: simulated_only`）与 `.uap/config/execution-mapping.yaml` 的 `execution.default_environment: local` / `dry_run_for_production: true` 固定；`test_environment` 权限组限定 `isolated_environment_only: true`。
- 外部不可信数据入口：`relay/channel/*/dto.go`（上游 provider 响应）、`plugins/tasks/*/plugin.js`（Sobek 执行）、`web/src/lib/http-status-code-rules.ts`、`controller/` 请求参数；`AGENTS.md` 要求所有输入服务端验证，前端校验不替代后端。
- 审计与可观测性证据由 `.uap/evidence/` 与 `.uap/reports/EVIDENCE-INDEX.md` 承载；`enforcement.log_denied_actions` / `log_sensitive_actions` / `redact_secrets` 由 `uap-delivery-agent` 的可观测性能力与 `.uap/config/workflow-registry.yaml` 的 `uap-final-verification` 汇总。
- 安全策略不可由普通任务修改：`.uap/config/permission-policy.yaml` 的 `quality_gate_disable: deny`、`.uap/config/agent-registry.yaml` 的 `enforce_permission_policy: true`，以及 `AGENTS.md` 禁止关闭 Lint 规则/`--no-verify`/跳过工作流步骤伪造通过。
- 全量安全验证命令：`./scripts/verify-all.sh [--quick]`、`GOWORK=off go vet ./...`、`make test`、`cd web && bun run lint`；`.github/workflows/weekly-security-audit.yml` 与 `nightly-full-audit.yml` 为周期性扫描。

## 执行流程
1. `uap-security-agent`（`.uap/engines/security/index.mjs`，权限 `[project_read, local_command, evidence_write]`）或任意执行器发起动作前，`security.policy` 加载 `.uap/config/permission-policy.yaml` 与 `agent-registry.yaml`，确认 Agent 身份已登记且工具已声明。
2. policy-engine 按 `default_effect: deny` 解析所需权限组，逐项检查 `project_read` / `project_write` / `local_command` / `test_environment` 等；对 `production_*`、`real_payment`、`real_refund`、`secret_export`、`destructive_git` 直接判定 deny。
3. 高风险动作（发布、资金、密钥、数据库写入）执行 `check_before_action` 策略判断，记录 `log_sensitive_actions` 审计事件；权限不足即 `log_denied_actions` 并拒绝，任务迁移 BLOCKED。
4. 通过校验后执行真实命令（如 `./scripts/verify-all.sh`、`GOWORK=off go vet ./...`、`cd web && bun run lint`），`local_command` 受 `require_command_logging: true` 与 `forbid_secret_exfiltration: true` 约束，输出经 `redact_secrets: true` 脱敏。
5. 对 `service/authz/`、`middleware/access_token_routes.go`、`common/quota_math.go` 等边界代码执行越权与密钥扫描测试，结果写入 `executorResult()` 的 `commands` 与 `changed_files`。
6. `security.permission_boundary` 验证器（`.uap/validators/security/index.mjs`）执行 `least_privilege` / `denied_operations` / `audit_logging`，返回 `validatorResult()`；越权用例被拒绝、测试用秘密被扫描发现。
7. 生成证据 `UAP-EVD-...` 写入 `.uap/evidence/`，记录策略判定、命令、退出码、时间、环境与脱敏后日志引用，索引追加到 `.uap/reports/EVIDENCE-INDEX.md`。
8. 仅当 `executed=true && exit_code=0` 且无 BLOCKER 时判定 PASS；任何安全失败按 `fail_closed: true` 阻断相关任务，绝不降级放行。

## 对应执行器
- 执行器 ID：`security.policy`
- 实现路径：`.uap/runtime/policy-engine/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：按 `.uap/config/permission-policy.yaml` 与 `uap-security-agent`，需 `project_read`（读取策略与代码）、`local_command`（执行扫描/测试命令，受 `require_command_logging` / `forbid_secret_exfiltration` 约束）、`evidence_write`；`test_environment` 仅在 `isolated_environment_only: true` 下可用。`production_read/write/deploy`、`real_payment`、`real_refund`、`secret_export`、`force_push`、`branch_creation/switch`、`destructive_git`、`quality_gate_disable`、`test_deletion_to_force_pass` 全部 `effect: deny`，执行器不得申请或绕过。

## 对应验证器
- 验证器 ID：`security.permission_boundary`
- 实现路径：`.uap/validators/security/index.mjs`
- 检查项：`[least_privilege, denied_operations, audit_logging]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `task_id` / `specification_ids` | 任务与关联规范 ID |
| 输入 | Agent 身份声明 | 来自 `.uap/config/agent-registry.yaml` 的 `id` / `permissions` / `tools` |
| 输入 | `scope` / `constraints` | 动作范围、所需权限组、高风险标记 |
| 输入 | `acceptance_criteria` | 越权被拒绝、密钥扫描命中、日志无敏感信息 |
| 输入 | 外部不可信数据 | 网页内容、仓库内容、上游 relay 响应、Agent 输出 |
| 输出 | 策略判定结果 | allow / deny 与命中的权限组、拒绝原因 |
| 输出 | `executorResult` | `status/summary/changed_files/commands/evidence_refs/blocked_reasons` |
| 输出 | 审计事件 | `log_denied_actions` / `log_sensitive_actions`（已 `redact_secrets`） |
| 输出 | `validation_results` / `validatorResult` | 独立验证器回填的安全边界结论 |
| 输出 | 脱敏运行证据 | `.uap/evidence/` 下 `UAP-EVD-...` 与索引条目 |

## 失败处理
按 `.uap/config/execution-mapping.yaml` 的 `execution.failure_policy` 与 `.uap/config/permission-policy.yaml` 的 `enforcement.fail_closed: true`（`default_effect: deny`）逐类处置：
1. **permission_denied**：策略判定为 deny 即停止相关动作、写 `log_denied_actions`，处置策略 `block`，任务迁移 BLOCKED；`enforcement.check_before_action: true` 保证在动作前拦截，绝不绕过检查。
2. **missing_dependency**：`agent-registry.yaml` 未登记身份、`tools` 未声明或 policy-engine / 验证器不可用时，处置策略 `block`，任务 BLOCKED 并写入 `blocked_reasons`，`deny_unregistered_agents: true` / `deny_undeclared_tools: true` 直接拒绝。
3. **validation_failed**：越权测试未被拒绝、密钥扫描未命中测试用秘密或日志出现敏感信息时，处置策略 `repair_then_revalidate`，转入 `uap-defect-repair` 修复并复验；安全失败按「安全失败必须阻断相关任务」优先于其他处置。
4. **retryable**：处置策略 `bounded_retry`，重试上限 **3 次**（`max_repair_attempts_per_root_cause: 3`），退避采用指数退避（base=1s，第 n 次 base × 2^(n-1)，上限 8s，附随机抖动）；`uap-defect-repair.retry.stop_on_permission_denied: true` / `stop_on_unrecoverable: true`；重试期间不得临时放宽权限策略。
5. **unrecoverable**：处置策略 `fail`，任务迁移 FAILED，保留全部失败与拒绝证据；禁止删除拒绝记录制造通过。
全局 fail-closed：策略加载失败、审计日志写入失败、`redact_secrets` 异常或验证器/证据缺失时，结果一律按 BLOCKED / FAIL 处理；`production_*` / `real_payment` / `real_refund` 与 `quality_gate_disable` 在任何失败路径下仍为 deny，安全策略不得由普通任务自行修改。

## 验收条件
1. 权限策略能够被 Runtime 加载。
2. 越权操作测试被拒绝。
3. 密钥扫描能够发现测试用秘密。
4. 敏感信息不会出现在普通日志。
5. 模拟与生产配置隔离。

## 证据要求
- 证据统一落盘到 `.uap/evidence/`，索引写入 `.uap/reports/EVIDENCE-INDEX.md`；证据 ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EVD')` 生成稳定唯一 ID，禁止复用。
- 每条证据必须记录：执行命令原文（如 `./scripts/verify-all.sh`、`GOWORK=off go vet ./...`、`cd web && bun run lint`、`scripts/quality/gitleaks-allowlist.test.sh`）、`exit_code`、开始/结束时间（ISO 8601）、环境（`.uap/state/BASELINE.json` 的 `toolchain`）、输入（Agent 身份、申请权限组、`scope`/`constraints`）、输出（策略判定、`executorResult` / `validatorResult` 全文）以及脱敏后的日志引用路径。
- 验证结果由 `.uap/runtime/_lib/contract.mjs` 的 `validatorResult()` 归一化为 `{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；`PASS` 仅在 `executed=true && exit_code=0` 且 `findings` 无 `severity=BLOCKER` 时成立。
- 写入证据前必须执行 `redact_secrets: true`；禁止将密钥、Token、密码写入日志、报告或提交记录（`AGENTS.md` 要求认证审计事件排除密码/验证码/Token）。报告必须能经 `evidence_refs` 反查原始记录，`fail_if_evidence_missing: true` 强制证据存在。
- **证据不可覆盖**：新结果写入新证据文件，禁止覆盖历史（含拒绝）记录。**失败证据不可删除**：越权拒绝、密钥扫描命中、BLOCKED / FAILED / NOT_EXECUTED 的证据必须保留，禁止以删除失败证据或关闭审计制造通过结果；支持密钥脱敏与日志清理，但清理不得删除审计结论本身。

## 依赖标准
- **UAP-00-001（UAP 核心架构规范）**：提供六层架构与稳定接口契约，使 policy-engine 作为独立执行引擎层组件可被 Runtime 加载、可被 `security.permission_boundary` 独立验证，并保证权限策略、审计事件与证据可追溯。
