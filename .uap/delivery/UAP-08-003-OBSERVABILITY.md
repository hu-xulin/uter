# UAP-08-003 — 可观测性规范

**编号：** UAP-08-003
**标准编号：** UAP-08-003
**名称：** 可观测性规范
**版本：** 1.0.0
**状态：** ACTIVE
**适用范围：** 约束 Uter 后端与 UAP 运行时的日志、追踪、错误分类、审计与运行证据，覆盖 `logger/logger.go`、`common/sys_log.go`、`middleware/request-id.go`、`middleware/logger.go`、`middleware/audit.go`、`router/api-router.go` 的 `GET /status`、`controller/misc.go` 的 `GetStatus()`、`web/src/features/usage-logs/`，以及 `.uap/runtime/_lib/util.mjs` 的 `redact()` / `appendJSONL()` 与 `.uap/evidence/`、`.uap/reports/EVIDENCE-INDEX.md`。`docker-compose.yml` 通过 `ERROR_LOG_ENABLED=true` 与 `./logs:/app/logs` 挂载承载运行日志。
**关键级别：** P1
**依赖标准：** UAP-00-004

## 规范目标
本规范要求 Uter 的关键服务提供健康状态、日志结构化、关键任务带 Trace ID 或等效关联 ID、错误有分类与严重程度、关键业务事件可按任务 ID 查询，并对任务失败/超时/重试与关键业务链路异常进行监控，同时保证日志不含明文密钥且运行证据留存。目标是使「日志系统存在」不被误判为完整可观测性，任何可观测性结论都必须来自真实查询、真实关联与真实脱敏验证的证据。

## 强制性要求
1. 关键服务必须提供健康状态。
2. 日志必须结构化。
3. 关键任务必须有 Trace ID 或等效关联 ID。
4. 错误必须有分类和严重程度。
5. 关键业务事件必须可查询。
6. 必须监控任务失败、超时和重试。
7. 必须监控关键业务链路异常。
8. 日志不得包含明文密钥和敏感信息。
9. 必须区分业务错误、系统错误和外部依赖错误。
10. 必须支持按任务 ID 查询执行记录。
11. 必须保存关键运行证据。
12. 不得将日志系统存在误判为完整可观测性。

## Uter 落地细则
- 健康状态端点真实存在：`router/api-router.go:32` 注册 `apiRouter.GET("/status", controller.GetStatus)`，实现在 `controller/misc.go:41` 的 `GetStatus()`（有 `controller/theme_compat_test.go` 的 `TestGetStatusAdvertisesDefaultDashboard` 与 `controller/misc_oidc_test.go` 的 `GetStatus` 测试）；`controller/channel_inference.go:119` 对上游探测 `/health`、`/v1/models`、`/metrics`，`controller/uptime_kuma.go` 定义 `apiStatusPath` / `apiHeartbeatPath` 心跳；`rebuild-all.sh` 第 4/5 步的「端口 + HTTP 体检」与 `docker-compose.yml` 的 `ERROR_LOG_ENABLED=true` 共同构成部署后可观测基线。
- 结构化日志实现在 `logger/logger.go`：级别常量 `loggerINFO` / `loggerWarn` / `loggerError` / `loggerDebug`（`INFO` / `WARN` / `ERR` / `DEBUG`），导出 `LogInfo(ctx, msg)`、`LogWarn(ctx, msg, args...)`、`LogError(ctx, msg)`，由 `logHelper(ctx, level, msg)` 统一落盘，`SetupLogger()` 按 `common.LogDir` 管理日志文件（`maxLogCount`、gopool 并发、`GetCurrentLogPath()`）；系统级错误另有 `common/sys_log.go:50` 的 `SysError(s string)`；请求日志中间件在 `middleware/logger.go`。
- Trace ID / 等效关联 ID：`middleware/request-id.go` 的 `RequestId()` 用 `common.NewRequestId()` 生成 ID，写入 `c.Set(common.RequestIdKey, id)`、`context.WithValue` 与响应 header `c.Header(common.RequestIdKey, id)`，使同一请求跨中间件/服务日志可关联；UAP 侧任务唯一 `task_id` 来自 `execution-mapping.yaml` 的 `execution_contract.required_input`，证据 ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EVD')` 生成，二者共同承担关联 ID 职责。
- 错误分类与严重程度：`logger/logger.go` 提供 INFO / WARN / ERR / DEBUG 四级；UAP 侧 `execution-mapping.yaml` 的 `failure_policy` 把失败分为 `permission_denied` / `missing_dependency` / `validation_failed` / `retryable` / `unrecoverable` 五类，`contract.mjs` 的 `finding(severity, code, message, extra)` 与 `VALIDATOR_STATUSES = ['PASS','FAIL','BLOCKED','NOT_EXECUTED']` 提供机器可读严重程度；`validator-registry.yaml` 的 `allow_explicit_blocked_status: true` 要求 BLOCKED 显式声明而非隐式跳过。
- 区分业务错误、系统错误和外部依赖错误：前端按 `web/AGENTS.md` §3.9 用 `web/src/lib/handle-server-error.ts` 的 `handleServerError()` 统一处理服务端错误，`web/src/lib/server-error-message.ts` 的 `createServerError()` / `requireServerSuccess()` 保留原始 API 响应契约（业务失败），`web/src/lib/secure-verification.ts` 的 `AuthOperationError` 提供安全消息（认证/权限）；系统错误由 `logger.LogError()` / `common.SysError()` 记录；外部依赖错误对应 `failure_policy.missing_dependency` 与 `controller/channel_inference.go` 的上游 `/health` 探测失败，三者不得混为一类。
- 关键业务事件可查询：`middleware/audit.go` 把 `METHOD + 路由模板` 映射为语言无关 `action`（`auditRouteActions`，含 `POST /api/system-task/log-cleanup → log.cleanup_start` 等），通过 `beginAdminAudit()` / `finishAdminAudit()` / `auditResponseSuccess()` 捕获状态码与响应体，并调用 `model.RecordOperationAuditLog(...)` 写审计日志；`TokenOperationAudit()` / `AccessTokenAudit()` 覆盖令牌操作；前端查询界面在 `web/src/features/usage-logs/`（`data/schema.ts`、`api.ts`、`audit/api.ts`、`audit/components/audit-log-viewer.tsx`、`lib/export.ts` / `filter.ts` / `utils.ts`、`components/common-log-mobile-card.tsx`）。
- 监控任务失败/超时/重试：`.uap/config/workflow-registry.yaml` 的 `uap-defect-repair` 定义 `retry.max_attempts_per_root_cause: 3`、`stop_on_permission_denied: true`、`stop_on_unrecoverable: true`、`acceptance: defect_verified_or_blocked`；`execution` 段固定 `persist_after_each_step: true`、`resume_on_interruption: true`、`stop_on_critical_security_failure: true`、`require_evidence: true`；`UAP-06-003` 提供超时、重试、退避、熔断策略，任务失败/超时/重试事件必须写入 `.uap/evidence/` 并可按 `task_id` 检索。
- 监控关键业务链路异常：`AGENTS.md` Billing safety invariants 要求额度饱和事件可审计——`common/quota_math.go` 的 `*Checked` 变体（`common.QuotaFromFloatChecked` / `QuotaRoundChecked` / `QuotaFromDecimalChecked`）返回 `*common.QuotaClamp`，在写入 consume/task log 前由 `service/log_info_generate.go` 的 `attachQuotaSaturation` 嵌套到 `other.admin_info.quota_saturation` 并发出 request-correlated `logger.LogWarn`；`controller/channel_inference.go` 的上游健康探测、`middleware/distributor.go` 的渠道状态码映射构成链路异常监控点。
- 日志脱敏（强制性要求第 8 条）：`permission-policy.yaml` 的 `secret_export: deny`、`local_command.forbid_secret_exfiltration: true`、`enforcement.redact_secrets: true`，落盘用 `.uap/runtime/_lib/util.mjs` 的 `redact()`；`AGENTS.md` Authentication Security 要求认证审计事件排除密码、验证码、恢复码、私钥与可用会话/认证令牌；`AGENTS.md` Change Protection 要求 `.env`、`*.db` / `-shm` / `-wal`、`logs/`、构建产物不进提交/报告；`web/AGENTS.md` §3.9 禁止把完整 Axios 错误对象（可能含凭据）写入管理。CI 侧由 `.github/workflows/weekly-security-audit.yml` 与 `nightly-full-audit.yml` 的 `secrets` job（gitleaks）扫描泄漏。
- 按任务 ID 查询执行记录（强制性要求第 10 条）：`execution-mapping.yaml` 的 `evidence.directory: .uap/evidence`、`reports_directory: .uap/reports`、`persist_task_state: true`；`util.mjs` 的 `appendJSONL()` / `readJSONL()` / `writeEvidence()` / `readJSON()` 支持按 `task_id` 追加与检索；索引 `.uap/reports/EVIDENCE-INDEX.md` 记录 `evidence_refs`；`contract.mjs` 的 `executorResult()` / `validatorResult()` 均携带可追溯字段（`checked_at`、`evidence_refs`、`findings`、`summary`）。
- 保存关键运行证据（强制性要求第 11 条）：`.uap/state/BASELINE.json`（`baseline_id: UAP-BASELINE-2026-11-12T10-19-06Z`、`toolchain` Go `go1.27.4` / Node `v22.22.2` / Bun `1.4.2`、9 个 `ci_workflows`、`real_gate_commands`）；`scripts/verify-all.sh` 输出「门禁汇总」表（检查项 / PASS|FAIL|SKIP / 耗时 / 退出码）与失败项复现命令；每条门禁证据须记录命令、退出码、ISO 8601 时间、环境、输入、输出与日志引用。
- 不得将日志系统存在误判为完整可观测性（强制性要求第 12 条）：对应 `UAP-00-004` 的「文件存在不能证明功能实现」「命令存在不能证明命令可运行」「测试文件存在不能证明测试通过」。`logger/logger.go` / `middleware/audit.go` 存在只说明有日志组件；`delivery.observability_integrity` 必须实际执行 `structured_logs`（结构化字段可解析）、`traceability`（按 `task_id` / `RequestIdKey` 能反查完整执行记录）、`secret_redaction`（`redact()` 与 gitleaks 验证无明文密钥）三类检查并产出证据，才可声明可观测性达标。
- `AGENTS.md` Verification Evidence 与 Automated Quality Gates 是可观测性的报告口径：完成报告必须给出可复制命令、实际退出码与 pass/fail 计数、变更文件路径、已知失败或跳过项；`AGENTS.md` 明确拒绝「已检查 / tests passed / looks correct」，要求门禁真实运行、非零退出即停止条件。

## 执行流程
1. `uap-orchestrator`（`.uap/runtime/agent-runtime/index.mjs`，权限 `project_read/task_create/task_dispatch/evidence_write`）读取 `specification-registry.yaml`，确认 `UAP-08-003` 的依赖 `UAP-00-004` 已满足，创建结构化任务（`task_id` / `specification_ids` / `scope` / `constraints` / `acceptance_criteria`）。
2. Orchestrator 经 `.uap/runtime/_lib/yaml.mjs` 加载 `execution-mapping.yaml`，解析 `delivery.observability` → `.uap/engines/delivery/index.mjs`，动态 `import()` 并调用 `health(ctx)`；不可导入或 `health()` 缺失写入 `blocked_reasons`。
3. 执行器用 `util.mjs` 的 `readText()` / `listFiles()` 扫描 `logger/logger.go`、`common/sys_log.go`、`middleware/request-id.go`、`middleware/logger.go`、`middleware/audit.go`、`router/api-router.go`、`controller/misc.go`、`web/src/features/usage-logs/`，建立「健康端点 → 结构化日志 → 关联 ID → 错误分类 → 审计事件 → 证据索引」的可观测性清单。
4. 执行器验证 `structured_logs`：核对 `loggerINFO` / `loggerWarn` / `loggerError` / `loggerDebug` 四级与 `LogInfo` / `LogWarn` / `LogError` / `logHelper` 导出，确认 `SetupLogger()` 按 `common.LogDir` 落盘；核对 `auditRouteActions` 的 action 映射与 `model.RecordOperationAuditLog` 调用链，记录健康检查 `GET /api/status` 的真实状态码与退出码。
5. 执行器验证 `traceability`：用 `RequestId()` 的 `common.RequestIdKey` 与 UAP `task_id` 作为关联键，通过 `util.mjs` 的 `readJSONL()` 从 `.uap/evidence/` 反查同一任务的执行记录与 `evidence_refs`，确认报告可定位到原始验证记录；核对 `failure_policy` 五类失败与 `VALIDATOR_STATUSES` 四级严重程度均有对应记录。
6. 执行器验证 `secret_redaction`：对采集到的日志样本调用 `util.mjs` 的 `redact()`，并按 `AGENTS.md` 认证审计排除清单检查密码/验证码/令牌/私钥未出现；核对 `permission-policy.yaml` 的 `secret_export: deny`、`redact_secrets: true`；记录 `weekly-security-audit.yml` / `nightly-full-audit.yml` 的 `secrets`（gitleaks）扫描结论。
7. 执行器用 `contract.mjs` 的 `executorResult()` 归一化输出；证据写入 `.uap/evidence/`（`newId('UAP-EVD')`），记录命令、退出码、ISO 8601 时间、环境（`.uap/state/BASELINE.json` toolchain）、输入输出与日志引用路径（含 `.uap/reports/EVIDENCE-INDEX.md`、`logger` 日志路径、`web/src/features/usage-logs/` 查询入口），索引追加证据索引。
8. `delivery.observability_integrity` 验证器（`.uap/validators/delivery/index.mjs`）执行 `structured_logs` / `traceability` / `secret_redaction` 并返回 `validatorResult()`；仅当 `executed=true && exit_code=0` 且 findings 无 `severity=BLOCKER` 时判 PASS；仅存在日志组件但无法按 ID 反查、无法证明脱敏或健康检查未执行时 fail-closed 记为 BLOCKED/FAIL 并保留失败证据。

## 对应执行器
- 执行器 ID：`delivery.observability`
- 实现路径：`.uap/engines/delivery/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：按 `.uap/config/agent-registry.yaml` 的 `uap-delivery-agent`（`[project_read, local_command, test_environment, evidence_write]`，tools `delivery_engine` / `build_adapter`）与 `.uap/config/permission-policy.yaml` 执行：需要 `project_read`（读日志/审计/健康端点代码与证据）、`local_command`（`require_command_logging: true`、`forbid_secret_exfiltration: true`）、`test_environment`（`isolated_environment_only: true`）、`evidence_write`。`secret_export: deny` 对本执行器是硬约束——采集日志只可经 `redact()` 后的脱敏样本进入证据；`production_read` / `production_write` / `production_deploy` / `real_payment` / `real_refund` / `quality_gate_disable` / `test_deletion_to_force_pass` / `branch_creation` / `force_push` / `destructive_git` 一律 `deny`；受 `enforcement.check_before_action: true`、`log_denied_actions: true`、`log_sensitive_actions: true`、`redact_secrets: true`、`fail_closed: true`、`default_effect: deny` 约束。

## 对应验证器
- 验证器 ID：`delivery.observability_integrity`
- 实现路径：`.uap/validators/delivery/index.mjs`
- 检查项：`[structured_logs, traceability, secret_redaction]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `task_id` | 任务唯一 ID，来自 `execution-mapping.yaml` 的 `execution_contract.required_input`，同时作为检索键 |
| 输入 | `specification_ids` | 关联规范 ID：`[UAP-08-003]` 及依赖 `UAP-00-004` |
| 输入 | `scope` | 范围：`logger/`、`middleware/`、`router/`、`controller/`、`web/src/features/usage-logs/`、`.uap/evidence/` |
| 输入 | `correlation_keys` | 关联键：`common.RequestIdKey`（`middleware/request-id.go`）与 UAP `task_id` / `UAP-EVD-*` 证据 ID |
| 输入 | `constraints` | 约束：日志脱敏、不输出密钥、仅隔离环境、错误须分类、fail-closed |
| 输入 | `acceptance_criteria` | 验收标准：关键事件可追踪、任务日志可关联、敏感信息脱敏、故障可定位 |
| 输出 | `executorResult` | 由 `contract.mjs` 的 `executorResult()` 归一化的结构化执行结果 |
| 输出 | `status` / `summary` / `changed_files` | 执行状态、摘要、变更文件清单 |
| 输出 | `structured_logs` | 日志级别/导出函数核对、健康检查真实状态码、审计 action 映射清单 |
| 输出 | `validation_results` | 由 `delivery.observability_integrity` 独立回填的三类检查结果 |
| 输出 | `traceability` | 按 `task_id` / `RequestIdKey` 反查到的执行记录与 `evidence_refs` 链路 |
| 输出 | `secret_redaction` | `redact()` 与 gitleaks 扫描的脱敏验证结论 |
| 输出 | `evidence_refs` | 指向 `.uap/evidence/` 的证据 ID 列表 |
| 输出 | `blocked_reasons` | 阻断原因（含无法按 ID 反查、脱敏未验证、健康检查未执行） |
| 输出 | `validatorResult` | `validatorResult()` 返回的机器可读判定 |

## 失败处理
按 `.uap/config/execution-mapping.yaml` 的 `execution.failure_policy` 与 `.uap/config/permission-policy.yaml` 的 `enforcement.fail_closed: true`（`default_effect: deny`）逐类处置：
1. **permission_denied**：执行前由 `.uap/runtime/policy-engine/index.mjs` 校验权限组；若任务试图导出未脱敏日志（`secret_export: deny`）、读取生产日志（`production_read: deny`）或绕过 `redact()`，立即拒绝并记录 `log_denied_actions` / `log_sensitive_actions`，处置策略 `block`，任务由 RUNNING 迁移为 BLOCKED，不重试、不绕过。
2. **missing_dependency**：`.uap/engines/delivery/index.mjs` 无法导入、`health()` 缺失、依赖 `UAP-00-004` 未满足、`logger/logger.go` / `middleware/request-id.go` / `middleware/audit.go` 不可读、`.uap/evidence/` 不可写或健康检查端点不可达时，处置策略 `block`，任务迁移 BLOCKED 并写入 `blocked_reasons`，补齐后由 Orchestrator 重新排队（QUEUED）。
3. **validation_failed**：`structured_logs` / `traceability` / `secret_redaction` 任一检查失败（如日志非结构化、按 `task_id` 无法反查完整记录、脱敏后仍检出明文密钥、findings 含 `severity=BLOCKER`）时，处置策略 `repair_then_revalidate`，交 `uap-defect-repair` 修复后复验；未复验通过不得标记 SUCCEEDED，且不得把「日志组件存在」当作验证通过。
4. **retryable**：处置策略 `bounded_retry`，重试上限 **3 次**（`execution.max_repair_attempts_per_root_cause: 3`），退避采用指数退避（第 n 次等待 `base × 2^(n-1)`，base=1s，上限 8s，附随机抖动）；每次重试写入独立证据；恢复执行须校验 `task_id` / `result_id` 幂等，禁止重放非幂等副作用，禁止重复追加同一条审计/证据记录破坏关联唯一性。
5. **unrecoverable**：处置策略 `fail`，任务迁移 FAILED 并保留全部失败证据（含脱敏后的日志样本）；按 `contract.mjs` 的 `TASK_TRANSITIONS`，FAILED 仅允许 → QUEUED / BLOCKED / CANCELLED，禁止重置状态隐藏失败，禁止删除失败证据制造通过。
全局 fail-closed：验证器缺失（`fail_if_validator_missing: true`）、验证器不可执行（`fail_if_validator_not_executable: true`）、证据缺失（`fail_if_evidence_missing: true`）或必需检查被跳过（`fail_if_required_check_skipped: true`）时，结果一律按 BLOCKED / FAIL 处理，绝不降级为 PASS；`allow_explicit_blocked_status: true` 只允许显式声明 BLOCKED，不允许隐式跳过。

## 验收条件
1. 关键事件可追踪。
2. 任务日志可关联。
3. 敏感信息脱敏。
4. 故障可定位。

## 证据要求
- 证据统一落盘到 `.uap/evidence/`，索引写入 `.uap/reports/EVIDENCE-INDEX.md`；证据 ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EVD')` 生成稳定唯一 ID（格式 `UAP-EVD-<时间戳>-<随机>`），禁止与历史证据复用；落盘使用 `writeEvidence()` / `appendJSONL()`，日志样本必须先经 `redact()` 脱敏。
- 每条证据必须记录：执行命令原文（如 `GET /api/status` 健康检查、`./scripts/verify-all.sh`、`cd web && bun run test`、gitleaks 扫描命令）、`exit_code`、开始/结束时间（ISO 8601，由 `nowISO()` 生成）、环境（取自 `.uap/state/BASELINE.json` 的 toolchain：Go `go1.27.4` / Node `v22.22.2` / Bun `1.4.2`）、输入（`task_id` / `specification_ids` / `correlation_keys` / `constraints`）、输出（`executorResult` 或 `validatorResult` 全文）以及日志引用路径（`common.LogDir` 日志、`middleware/audit.go` 审计记录、`web/src/features/usage-logs/` 查询入口、`.uap/reports/EVIDENCE-INDEX.md`）。
- 证据必须包含 `structured_logs` / `traceability` / `secret_redaction` 三份检查结果原文：关联 ID 反查链路必须能定位到唯一执行记录；错误分类须区分业务错误、系统错误与外部依赖错误；脱敏证据须证明密码/验证码/恢复码/私钥/令牌与 `.env` 等敏感信息未以明文出现在日志或报告。
- 验证结果由 `contract.mjs` 的 `validatorResult()` 归一化为 `{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；`PASS` 仅在 `executed=true && exit_code=0` 且 findings 无 `severity=BLOCKER` 时成立；健康检查 SKIP / 无法按 ID 反查 / 脱敏未验证必须原样记录为 BLOCKED / NOT_EXECUTED，不得改写为 PASS。
- **证据不可覆盖**：新结果写入新证据文件，禁止覆盖历史记录；`execution.persist_task_state: true` 保证状态持久化。**失败证据不可删除**：BLOCKED / FAILED / NOT_EXECUTED / 脱敏失败 / 关联失败的证据必须保留，禁止以删除失败证据制造通过结果；报告须能经 `evidence_refs` 反查原始记录并满足 `AGENTS.md` Verification Evidence 四项要求；状态迁移受 `TASK_TRANSITIONS` 约束。

## 依赖标准
- **UAP-00-004（证据与状态管理规范）**：`.uap/config/specification-registry.yaml` 中 `UAP-08-003` 的 `dependencies: [UAP-00-004]`。它定义 `.uap/config/specification-registry.yaml` 的 `status_values` 八态状态机（含 `NOT_BUILT` / `IMPLEMENTED_NOT_VERIFIED` / `BLOCKED` / `FAILED` 等，验证完成态须有完整证据后方可进入）、要求每次执行产生唯一执行记录、验证结果必须记录命令/退出码/时间/环境/输入/输出/日志引用、报告可追溯到原始证据、证据有稳定 ID、执行状态持久化可恢复、历史证据不得静默覆盖、失败证据不得删除，并确立「文件存在不能证明功能实现」的原则。本规范据此把 `.uap/evidence/` + `.uap/reports/EVIDENCE-INDEX.md` 作为按 `task_id` 查询执行记录的载体，并以 `structured_logs` / `traceability` / `secret_redaction` 三类检查证明可观测性不是「日志系统存在」即可成立。
