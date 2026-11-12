# UAP-04-002 — 自动代码审查规范

**编号：** UAP-04-002
**标准编号：** UAP-04-002
**名称：** 自动代码审查规范
**版本：** 1.0.0
**状态：** IMPLEMENTED_NOT_VERIFIED
**适用范围：** 适用于 Uter 每次代码变更的自动审查：`uap-review-agent`（`.uap/engines/code-review/index.mjs`）、`scripts/quality/uter-quality.sh` 的 `review`/`security`/`coverage` 阶段、`.github/workflows/ci.yml` 的 `ueqe-review`/`race`/`coverage` 作业，覆盖 `router/api-router.go`、`middleware/access_token_routes.go`、`service/authz/`、`common/quota_math.go`、`service/log_info_generate.go`、`model/main.go`、`web/src/` 等关键风险面。
**关键级别：** P0
**依赖标准：** [UAP-04-001]

## 规范目标
UAP 1.0 的审查由独立 `uap-review-agent` 执行，其权限仅 `[project_read, evidence_write]`，与被审修改的写权限彻底分离。审查结果必须经 `.uap/runtime/_lib/contract.mjs` 的 `finding(severity, code, message, extra)` 结构化，BLOCKER 发现由 `validatorResult()` 强制把 PASS 降级为 FAIL，从而真实阻断质量门禁。Uter 既有 UEQE 审查链（`scripts/quality/uter-quality.sh`）、`govulncheck`/`gitleaks` 安全扫描与 `.github/workflows/ci.yml` 的竞态/覆盖率作业，为「正确性、安全性、性能、兼容性、业务逻辑」提供真实可执行的检查来源，禁止只做文本匹配或把风格偏好伪装为严重缺陷。

## 强制性要求
1. 每次代码变更必须自动审查。
2. 审查范围包含正确性、安全性、性能、可维护性、兼容性和业务逻辑。
3. 审查必须结合实际上下文，不得只做文本匹配。
4. 必须识别空指针、异常吞噬、权限绕过、注入、竞态和资源泄漏。
5. 必须识别金额计算、重复扣费、重复退款和状态不一致风险。
6. 必须检查 API 兼容性和数据库迁移风险。
7. 必须检查测试是否覆盖修改行为。
8. 每个发现必须包含严重程度、文件位置、问题描述、根因和建议。
9. 严重问题必须阻断质量门禁。
10. 不得把风格偏好伪装为严重缺陷。
11. 修复后必须重新审查。
12. 审查结果必须保存证据。

## Uter 落地细则
- `.uap/config/agent-registry.yaml` 的 `uap-review-agent`（`role: independent_code_review`，`output_schema: review-result`，`tools: [review_engine, security_scanner]`，`permissions: [project_read, evidence_write]`）为独立审查 Agent，不持有 `project_write`/`local_command`。
- `.uap/config/execution-mapping.yaml` 的 `executor_entries` 把 `development.code_review` 映射到 `.uap/engines/code-review/index.mjs`；`.uap/config/validator-registry.yaml` 把 `development.review_integrity` 映射到 `.uap/validators/development/index.mjs`，`checks: [review_execution, finding_schema, blocking_rules]`。
- `.uap/runtime/_lib/contract.mjs` 的 `finding(severity, code, message, extra)` 定义发现结构；`validatorResult()` 在 `findings` 含 `severity: 'BLOCKER'` 时把 PASS 降级为 FAIL，`assertValidatorResult()` 强制 PASS 需 `executed=true` 且 `exit_code=0`。
- 同文件 `assertExecutorResult()` 禁止执行器自填 `validation_results`（必须为空数组），审查结论只能由独立验证器产生；`executorResult()` 的 `commands`/`evidence_refs` 承载工具真实输出。
- `scripts/quality/uter-quality.sh` 的 `review` 阶段执行 `gofmt`/`go vet` × 4 模块 + 前端 `lint`/`i18n`/`lint:design:strict`/`copyright`；`security` 阶段执行 `govulncheck`/`gitleaks` 与敏感文件入库抽查，缺工具记为 `NOT_RUN`/`BLOCKED`，绝不伪通过。
- 同脚本 header 声明 stage 集合 `inventory|review|test|security|coverage|regression|report|status|full` 与状态语义 `PASSED`/`PARTIAL`/`BLOCKED`/`NOT_RUN`/`FAILED`；`run_check()` 把每条检查日志与 `.status` 写入 `UEQE_STATE_DIR`，报告落在 `_reports/quality/`。
- `.quality/gitleaks.toml` 与 `scripts/quality/gitleaks-allowlist.test.sh` 为密钥扫描基线与允许清单测试；`.uap/runtime/_lib/util.mjs` 的 `redact()` 覆盖 `AIza`/`whsec_`/`sk-`/`ghp_` 与密码赋值模式，保证审查输出不泄露密钥。
- `.github/workflows/ci.yml` 的 `ueqe-review` 作业（"UEQE review engine (all modules)"，执行 `bash scripts/quality/uter-quality.sh review`）、`race` 作业（Backend race detector，含 `Race test concurrency-sensitive packages` 与 `Race test end-to-end billing flows`）、`coverage` 作业（含 `Enforce critical-path coverage thresholds`）为竞态与业务风险审查入口。
- `.github/workflows/ci.yml` 的 `backend` 作业以 `golangci-lint (root module, new issues only)` 只拦新增问题；`AGENTS.md` 说明存量基线 121 项分批清理，本地可用 `golangci-lint run`（v2.15.0），禁止用 v1.64.8。
- `AGENTS.md`「Billing safety invariants」列出必须识别的资金风险：负扣费/算术溢出、`int(float64(quota) * ratio)` 裸转换、重复扣费/重复退款/状态不一致、未约束的 `*uint` 输入；相关实现位于 `common/quota_math.go`、`common/json.go`、`service/log_info_generate.go`（`attachQuotaSaturation`）、`relay/helper/valid_request.go`（`maxTokensLimit`）。
- `AGENTS.md`「Authentication Security (OWASP Mandatory)」要求认证相关变更遵循 OWASP ASVS 与 Cheat Sheet、服务端强制鉴权、审计事件排除密码/验证码/Token；审查范围为 `service/authz/`（`enforcer.go`/`resolver.go`/`permission.go`/`adapter.go`）、`middleware/access_token_routes.go`、`router/api-router.go`。
- `AGENTS.md`「Database compatibility」要求 SQLite/MySQL >= 5.7.8/PostgreSQL >= 9.6 三库真实实例验证、迁移至少启动两次证明幂等、GORM core 与 dialect/driver 作为兼容版本集；审查以 `model/main.go` 的 `lockForUpdate(tx)`、`common.UsingMainDatabase(...)`、`commonGroupCol`/`commonKeyCol` 为准。
- `web/AGENTS.md` §3.14 要求修改行为必须有对应测试与回归用例、§3.9 要求 `handleServerError` 统一错误处理、§3.13 要求 Zod 前后端双重校验与 `dangerouslySetInnerHTML` 慎用，为「测试是否覆盖修改行为」与注入/XSS 审查依据。
- `.uap/runtime/_lib/paths.mjs` 的 `FILES.defects`（`.uap/reports/DEFECT-REGISTRY.json`）与 `FILES.evidenceIndex`（`.uap/reports/EVIDENCE-INDEX.md`）为审查发现与证据的落盘位置；`scripts/verify-all.sh` 的 `step()` 记录每条检查的命令、退出码、耗时，`Makefile` 的 `verify`/`verify-quick` 为统一入口。

## 执行流程
1. `uap-development-agent` 提交变更后，`uap-orchestrator` 把审查任务派发给 `uap-review-agent`；执行器 `development.code_review`（`.uap/engines/code-review/index.mjs`）读取 `changed_files` 与 `AGENTS.md`/`web/AGENTS.md` 上下文。
2. 执行器经 `.uap/runtime/policy-engine/index.mjs` 校验 `project_read`/`evidence_write`，确认无写权限后调用 `scripts/quality/uter-quality.sh review`、`security`、`coverage` 阶段及 `./scripts/verify-all.sh`，采集真实命令与退出码。
3. 审查结合上下文检查：空指针/异常吞噬/权限绕过（`service/authz/`）、注入/竞态（`race` 作业）、金额与重复扣费（`common/quota_math.go`/`service/log_info_generate.go`）、API 兼容性与三方言迁移（`model/main.go`）、测试覆盖（`web/AGENTS.md` §3.14）。
4. 每个发现用 `finding(severity, code, message, {file, line, root_cause, suggestion})` 结构化，写入 `.uap/reports/DEFECT-REGISTRY.json`；BLOCKER 级发现记录为阻断候选。
5. 执行器用 `executorResult()` 归一化输出，`validation_results` 保持空；`event-system.publish()` 追加 `UAP-EVT-*` 审查事件到 `.uap/state/events.jsonl`。
6. 独立验证器 `development.review_integrity`（`.uap/validators/development/index.mjs`）执行 `review_execution`/`finding_schema`/`blocking_rules`，返回 `validatorResult()`；`validatorResult()` 在存在 BLOCKER 时强制 FAIL，阻断任务通过。
7. 修复后由同一验证器重新审查（`repair_then_revalidate`），`evidence-engine.record()` 把审查命令、退出码、发现清单、`content_hash` 写入 `.uap/evidence/UAP-EV-*.json`，索引追加到 `.uap/reports/EVIDENCE-INDEX.md`。
8. 仅当 `executed=true`、`exit_code=0`、无 BLOCKER 且审查结果已存证时任务迁移 `RUNNING → SUCCEEDED`；否则保持 `FAILED`/`BLOCKED` 并保留失败证据。

## 对应执行器
- 执行器 ID：`development.code_review`
- 实现路径：`.uap/engines/code-review/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：仅 `project_read`（读取源码、`AGENTS.md`、配置）与 `evidence_write`（写审查证据）；调用静态扫描需 `local_command`（`require_command_logging: true`、`forbid_secret_exfiltration: true`）。按 `.uap/config/permission-policy.yaml` 的 `default_effect: deny`、`enforcement.check_before_action: true`、`fail_closed: true` 逐动作校验；`uap-review-agent` 不持有 `project_write`，且 `quality_gate_disable`/`test_deletion_to_force_pass`/`production_write`/`real_payment` 为 deny 组，禁止审查任务自行关闭门禁或触碰真实资金。

## 对应验证器
- 验证器 ID：`development.review_integrity`
- 实现路径：`.uap/validators/development/index.mjs`
- 检查项：`[review_execution, finding_schema, blocking_rules]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `changed_files` 与 diff 上下文 | 本次变更涉及的 Go 包、`web/src/` 路径与调用链上下文 |
| 输入 | `AGENTS.md` / `web/AGENTS.md` | 认证安全、数据库兼容、计费不变量与前端测试约定 |
| 输入 | `scripts/quality/uter-quality.sh` / `.github/workflows/ci.yml` | `review`/`security`/`coverage` 阶段与 `ueqe-review`/`race`/`coverage` 作业的真实检查结果 |
| 输入 | `.uap/config/permission-policy.yaml` | 审查 Agent 权限组与 deny 规则（独立复验前提） |
| 输出 | 结构化发现清单 | `finding(severity, code, message, extra)` 数组，含文件位置、根因、建议 |
| 输出 | `.uap/reports/DEFECT-REGISTRY.json` | 缺陷登记，供 `uap-defect-repair` 工作流消费 |
| 输出 | `validatorResult` | `review_execution`/`finding_schema`/`blocking_rules` 的 `checks_run`、`findings`、阻断判定 |
| 输出 | `.uap/evidence/UAP-EV-*.json` | 审查命令、退出码、发现清单、`content_hash` 证据及索引行 |

## 失败处理
- `permission_denied`：审查 Agent 越权或命中 deny 组时停止动作，任务迁移 `RUNNING → BLOCKED`，处置为 `block`，写 `blocked_reasons` 与审计事件；`stop_on_permission_denied: true`，禁止绕过检查。
- `missing_dependency`：`govulncheck`/`gitleaks`/`golangci-lint` 等工具缺失、验证器不可执行或 UAP-04-001 未就绪时迁移 `QUEUED → BLOCKED`，处置为 `block`；`fail_if_validator_not_executable: true`、`fail_if_required_check_skipped: true`，缺工具只能记 `NOT_RUN`/`BLOCKED`，绝不伪通过。
- `validation_failed`：`review_execution`/`finding_schema`/`blocking_rules` 任一 FAIL 或存在 BLOCKER 发现时迁移为 `FAILED`，处置为 `repair_then_revalidate`，修复后必须重新审查并由同一验证器复验，禁止直接改判 PASS。
- `retryable`：扫描工具瞬时失败按 `bounded_retry` 处理，重试上限 3 次（`execution.max_repair_attempts_per_root_cause: 3`、`uap-defect-repair` 的 `max_attempts_per_root_cause: 3`），退避采用指数退避（1s → 2s → 4s），每次重试写独立 `evidence_id`；超限迁移 `FAILED`。
- `unrecoverable`：发现无法安全自动修复的高危漏洞或数据一致性风险时迁移 `BLOCKED` 或 `FAILED`，处置为 `fail`，完整保留失败证据；`assertTransition()` 对非法迁移抛 `IllegalTransitionError`，`fail_closed: true`，禁止通过降低门禁或删除发现制造通过。

## 验收条件
> 基线原文：自动审查引擎可执行；审查结果结构化；关键风险规则有测试；阻断问题能够阻止任务通过。

1. 自动审查引擎可执行
2. 审查结果结构化
3. 关键风险规则有测试
4. 阻断问题能够阻止任务通过。

## 证据要求
- 证据目录 `.uap/evidence/`，索引 `.uap/reports/EVIDENCE-INDEX.md`；文件命名 `.uap/evidence/<evidence_id>.json`，ID 格式 `UAP-EV-<14位UTC时间戳>-<8位hex>`，由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EV')` 生成。
- 证据必须记录 `command`（如 `bash scripts/quality/uter-quality.sh review`、`govulncheck`、`gitleaks`、`./scripts/verify-all.sh`）、`exit_code`、`duration_ms`、`recorded_at`、`environment`（platform/node/cwd/uap_root）、`inputs`、`stdout`、`stderr`、`artifacts`、`findings`、`summary`、`content_hash`、`task_id`、`trace_id`、`specification_ids`（含 UAP-04-002）。
- 每个发现必须落盘 `severity`/`code`/`message`/文件位置/根因/建议；`review_execution`/`finding_schema`/`blocking_rules` 的 `checks_run` 与阻断判定必须写入证据，`scripts/quality/uter-quality.sh` 的 `.status` 与日志作为原始引用。
- 证据 append-only：`writeEvidence()` 对同 ID 二次写入抛错，`verify()` 用 `content_hash` 校验，`resolveAll()` 校验 `evidence_refs` 有效；失败证据（BLOCKER 发现、扫描失败、NOT_RUN）不得删除或被修复后的新结果静默覆盖。
- 修复后重新审查必须生成新的 `evidence_id` 并保留修复前证据，`.uap/reports/EVIDENCE-INDEX.md` 必须能定位审查前后两条原始记录；`redact()` 保证审查输出与日志不含明文密钥、Token、密码。
- 未真实执行的审查（工具缺失）必须标注 `BLOCKED`/`NOT_RUN` 并附原因，状态保持 IMPLEMENTED_NOT_VERIFIED，不得凭报告声明「审查通过」。

## 依赖标准
- `UAP-04-001`（编码规范）：提供 Go/TypeScript 编码约定、格式化/静态检查/类型检查/关键逻辑测试的自动执行基线（`./scripts/verify-all.sh`、`make test`、`bun run typecheck|lint|test`），使自动代码审查能复用既有门禁结果、判定「测试是否覆盖修改行为」，并保证审查发现不被风格偏好或忽略类型错误的方式消解。
