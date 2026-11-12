# UAP-06-001 — 应用安全规范

**编号：** UAP-06-001
**标准编号：** UAP-06-001
**名称：** 应用安全规范
**版本：** 1.0.0
**状态：** ACTIVE
**适用范围：** 约束 Uter 服务端鉴权与输入校验（`service/authz/` 的 Casbin、`middleware/`、`relay/helper/valid_request.go`）、认证会话与 Token 生命周期（`AGENTS.md` Authentication Security (OWASP Mandatory)）、密钥与依赖安全（`electron/desktop-secrets.test.js`、`.quality/gitleaks.toml`、`govulncheck`）、前端安全（`web/AGENTS.md` §3.9 / §3.13）以及支付回调验签（`service/alipay_query_test.go`、`controller/topup_gateway_contract_test.go`）；执行器 `security.application`，验证器 `security.application_integrity`。
**关键级别：** P0
**依赖标准：** UAP-00-003

## 规范目标
本规范把 Uter 的 OWASP ASVS 认证约束、服务端鉴权、密钥安全、依赖漏洞扫描与「外部数据一律不可信」原则固化为机器可执行的门禁，保证所有输入在服务端验证、所有权限在服务端鉴权、高危漏洞阻断质量门禁。安全扫描由 `.github/workflows/weekly-security-audit.yml` 与 `scripts/quality/uter-quality.sh security` 真实执行，安全测试由 P09 质量系统记录，且不得声称合规直到相关失败/过期/重放/绕过用例被回归验证。

## 强制性要求
1. 所有输入必须进行服务端验证。
2. 所有权限必须进行服务端鉴权。
3. 必须防护 SQL 注入、XSS、CSRF、SSRF、命令注入和路径穿越。
4. 必须防止越权访问和水平/垂直权限提升。
5. 密钥必须使用安全配置管理。
6. 必须对认证、会话和 Token 生命周期进行检查。
7. 必须实施合理限流和防滥用机制。
8. 文件上传必须验证类型、大小和存储位置。
9. 依赖和构建产物必须进行安全扫描。
10. 错误信息不得泄露敏感内部信息。
11. 高危漏洞必须阻断质量门禁。
12. 安全修复必须执行回归测试。
13. 外部模型、渠道和工具返回的数据必须视为不可信输入。

## Uter 落地细则
- 服务端验证的真实锚点：`AGENTS.md` Authentication Security (OWASP Mandatory) 要求「Enforce security controls on the server」「Frontend checks MUST NOT substitute for server-side enforcement」；`relay/helper/valid_request.go` 的 `maxTokensLimit` 对 `max_tokens` 系列字段按 relay 格式（OpenAI / Claude / Gemini / Responses）做边界校验，越界按 `AGENTS.md` Billing safety invariants 拒绝为 400。
- 服务端鉴权的真实实现：`service/authz/` 的 Casbin 授权（`permission.go`、`enforcer.go`、`adapter.go`、`resolver.go`、`role.go`、`assignment.go`、`override.go`、`registry.go`、`seed.go`、`resources_channel.go`、`resources_task_plugin.go`、`resources_audit.go`、`authz_test.go`）；`AGENTS.md` 明确 Auth 为 Browser sessions / API tokens / personal access tokens / JWT / WebAuthn/Passkeys / TOTP / OAuth/OIDC 与 `service/authz/` 的 Casbin。
- 输入校验绕过面的真实清单来自 `AGENTS.md` Billing safety invariants：passthrough 字段 `Extra["parameters"]`、任务 `metadata` maps、multipart 表单字段可绕过标准 DTO 校验，适配层必须就地施加同等上限；`*uint` 字段接受超大正数 JSON（如 `18446744073686646784`）时 `>= 0` 不足，必须有上界；`common/json.go` 规定业务代码 JSON 编解码一律走 `common.Marshal/Unmarshal/UnmarshalJsonStr/DecodeJson/GetJsonType`，禁止直接调用 `encoding/json`。
- 防注入与越权：`model/main.go` 的 `lockForUpdate(tx)` 是 GORM v2 下唯一有效的 `SELECT ... FOR UPDATE` 行锁写法（禁用 v1 的 `Set("gorm:query_option", "FOR UPDATE")`——GORM v2 静默忽略会不加锁）；`commonGroupCol` / `commonKeyCol` 处理 `group` / `key` 保留字，`commonTrueVal` / `commonFalseVal` 与 `common.UsingMainDatabase(...)` / `common.UsingLogDatabase(...)` 处理方言差异，避免拼接原始 SQL。
- 前端 XSS / CSRF 的真实约束：`web/AGENTS.md` §3.13 要求依赖 React 默认转义、慎用 `dangerouslySetInnerHTML`、跨域与 Cookie 用 `withCredentials` 并按后端要求处理 CSRF；`web/src/features/wallet/lib/payment.ts` 的 `submitPaymentForm` 先经 `resolvePaymentRedirectUrl(url)` 做协议白名单，拒绝未校验的 `javascript:` action 成为脚本执行。
- 认证、会话与 Token 生命周期：`AGENTS.md` 要求注册/登录登出/密码变更与找回/邮箱验证/MFA/WebAuthn/Passkeys/OAuth/OIDC/账户关联/会话/JWT/API 凭据/敏感操作重认证全部符合最新稳定 OWASP ASVS 与 Cheat Sheet Series（Authentication / Session Management / Password Storage / Forgot Password / MFA / OAuth / CSRF），并记录 ASVS 版本与需求 ID；会话轮换与失效、challenge 过期与单次使用、replay 防护必须在服务端执行，恢复/替代登录路径不得绕过认证保证。
- 密钥安全配置：`.github/workflows/weekly-security-audit.yml` 的 `secrets` job 用 gitleaks@v8.30.1 执行 `gitleaks dir . --no-banner --config .quality/gitleaks.toml`；`workflow-permissions` job 扫描明文 PAT（`ghp_`/`github_pat_`）、要求显式声明 `permissions`、第三方 action 固定到完整 Commit SHA；`AGENTS.md` Change Protection 禁止把 `.env`、`*.db`、`logs/`、构建产物写入提交；`.uap/config/permission-policy.yaml` 的 `secret_export: effect: deny` 与 `enforcement.redact_secrets: true`。
- 限流与防滥用：`AGENTS.md` Tech Stack 列 Redis（go-redis）+ 内存缓存用于 rate limiting，`middleware/` 承载网关鉴权与限流（`.github/workflows/ci.yml` 的 `race` job 把 `./middleware/...` 纳入竞争检测）；`AGENTS.md` Authentication Security 要求抵抗账户枚举与暴力破解。
- 文件上传验证：`plugins/tasks/` 的 JavaScript task plugins 经 `pkg/jsplugin/`（Sobek）执行，`AGENTS.md` 要求改动插件或 host API 前读 `docs-dev/plugin-api/v1.md`、`v1.schema.json`、`v1.d.ts`；外部脚本与 DTO 的字段一律按不可信输入校验类型、大小与来源。
- 依赖与构建产物安全扫描：`.github/workflows/ci.yml` 的 `vulnscan` 与 `.github/workflows/release-gate.yml` 的 `vulnscan` 对 `.` / `relaykit` / `tokenkit` / `tokenkit/tokenkit` 四模块跑固定版本 `govulncheck@v1.9.0`（`govulncheck ./...`），`weekly-security-audit.yml` 的 `vulnerabilities` job 同 pin 版本并把结果写入 `weekly-security-report` artifact（retention 90 天）；`./scripts/verify-all.sh` 全量模式调用 `scripts/quality/uter-quality.sh security`。
- 错误信息不得泄露敏感内部信息：`web/AGENTS.md` §3.9 规定统一用 `handleServerError(error, fallbackMessage?)`，相同失败沿 `cause` 只提示一次，禁止把完整 Axios 错误对象（可能含凭据）直接写入管理，`AuthOperationError` 的安全消息不得解开来展示被屏蔽细节；`common/quota_math.go` 的 `QuotaClamp.AuditMap()` 把饱和标记嵌在 `admin_info.quota_saturation` 下，非管理员日志视图会剥离 `admin_info`，使异常对普通用户不可见。
- 高危漏洞必须阻断门禁：`.uap/config/validator-registry.yaml` 的 `validation_policy.fail_if_validator_not_executable: true` 与 `security.application_integrity` 的检查项 `vulnerability_scan / authz / secret_scan`；`.github/workflows/ci.yml` 的 `permissions: contents: read` / `pull-requests: read` 体现最小权限，`weekly-security-audit.yml` 的 `report` job 在任一 job 失败时创建/更新 `quality-alert` issue。
- 外部数据一律不可信：`service/alipay_query_test.go` 的 `TestAlipayQueryOrderRejectsBadSignature`（另一把 RSA 私钥签名 → `signature invalid`）、`TestAlipayQueryOrderRejectsMismatchedTradeNumber`（`out_trade_no mismatch`）、`TestAlipayQueryOrderSurfacesOtherBusinessFailures`（`ACQ.INVALID_PARAMETER`）证明网关响应必须验签并核对订单号；`controller/topup_gateway_contract_test.go` 要求 9 个网关「验签在入账之前」；`controller/return_path.go` 的 `requestOrigin` 仅取 `X-Forwarded-Proto` / `X-Forwarded-Host` 第一段（`firstHeaderValue`）构造回跳站点根。
- 安全修复必须执行回归测试：`AGENTS.md` Authentication Security 要求「Verify affected security controls with focused regression tests, including applicable failure, expiry, replay, and bypass cases」，并在变更摘要记录 OWASP 引用、验证内容与未解决差距，未满足或不可验证时不得声称合规；`web/AGENTS.md` §3.14 要求 Bug 修复先写能稳定复现的失败用例再修复并确认转绿。
- P09 / P10 边界与桌面密钥：`AGENTS.md` Change Protection 规定 P10 定义安全要求、P09 执行并记录安全测试，二者互不替代；`.github/workflows/ci.yml` 与 `release-gate.yml` 的 `desktop` job 用 `node --test electron/desktop-secrets.test.js` 验证 SESSION_SECRET / CRYPTO_SECRET 跨重启稳定，`electron/main.js` 先过 `node --check`。
- 环境基线：`.uap/state/BASELINE.json` 记录 9 个 CI workflow 与工具链（Go `go1.27.4` / Node `v22.22.2` / Bun `1.4.2`）；`docs/ai-specs/` 与 `uaes/standards/` 已于 2026-11-12 退役，不作为安全规范来源，绑定来源为 `AGENTS.md`、`web/AGENTS.md`、`docs/design-system/UTER-DESIGN-SYSTEM-3.0.md`。

## 执行流程
1. `uap-security-agent`（`.uap/engines/security/index.mjs`，权限 `project_read/local_command/evidence_write`）按 `.uap/config/workflow-registry.yaml` 的 `uap-full-audit` 中 `scan_security` 与 `uap-quality-gate` 中 `security_scan` 发起，读取 `AGENTS.md` Authentication Security、`web/AGENTS.md` §3.9 / §3.13、`.uap/config/permission-policy.yaml`。
2. 经 `.uap/runtime/_lib/yaml.mjs` 加载 `specification-registry.yaml`（确认 UAP-00-003 依赖）、`execution-mapping.yaml`、`validator-registry.yaml`，解析 `scope` 与 `acceptance_criteria`。
3. 执行依赖与密钥扫描：对四个 Go 模块 `govulncheck ./...`、`gitleaks dir . --no-banner --config .quality/gitleaks.toml`、`bash scripts/quality/uter-quality.sh security`，并核对 `weekly-security-audit.yml` 的 workflow-permissions 审计（显式 permissions、无明文 PAT、action 固定 SHA）。
4. 检查服务端校验与鉴权：`service/authz/` 的 Casbin enforcer/adapter/resolver、`relay/helper/valid_request.go` 的 `maxTokensLimit`、`common/json.go` 包装约束、`model/main.go` 的 `lockForUpdate(tx)`，以及前端 Zod 校验不得替代服务端。
5. 检查认证会话/限流/上传/错误信息：执行 `node --test electron/desktop-secrets.test.js`、`bun run test`（含认证相关回归用例），核对 `handleServerError` 不泄露凭据、`admin_info` 对非管理员剥离、`.env`/密钥不入库。
6. 核对外部数据不可信契约：`service/alipay_query_test.go` 的验签/订单号一致性用例、`controller/topup_gateway_contract_test.go` 的三件套顺序断言、`controller/return_path.go` 的回跳站点根构造，记录每项退出码。
7. 结果由 `.uap/runtime/_lib/contract.mjs` 的 `executorResult()` 归一化，生成 `UAP-EVD-...` 证据落盘 `.uap/evidence/`、索引追加 `.uap/reports/EVIDENCE-INDEX.md`；高危漏洞写入 `findings`（`severity=BLOCKER`）与 `blocked_reasons`。
8. `security.application_integrity` 验证器（`.uap/validators/security/index.mjs`）执行 `vulnerability_scan` / `authz` / `secret_scan`，返回 `validatorResult()`；仅当 `executed=true && exit_code=0` 且无 BLOCKER 时通过，否则 fail-closed 记 BLOCKED 并阻断质量门禁。

## 对应执行器
- 执行器 ID：`security.application`
- 实现路径：`.uap/engines/security/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：按 `.uap/config/agent-registry.yaml` 的 `uap-security-agent`（`output_schema: security-result`）与 `.uap/config/permission-policy.yaml`，需 `project_read`（读取源码/配置/CI workflow）、`local_command`（执行 `govulncheck`、`gitleaks`、`scripts/quality/uter-quality.sh security` 等已批准命令，受 `require_command_logging: true` 与 `forbid_secret_exfiltration: true` 约束）、`evidence_write`；受 `enforcement.check_before_action: true`、`fail_closed: true`、`default_effect: deny` 约束，`secret_export` / `production_read` / `production_write` / `production_deploy` 一律 deny，扫描与日志按 `redact_secrets: true` 脱敏。

## 对应验证器
- 验证器 ID：`security.application_integrity`
- 实现路径：`.uap/validators/security/index.mjs`
- 检查项：`[vulnerability_scan, authz, secret_scan]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `task_id` | 任务唯一 ID，来自 `.uap/config/execution-mapping.yaml` 的 `execution_contract.required_input` |
| 输入 | `specification_ids` | 关联规范 ID（UAP-00-003、UAP-06-001） |
| 输入 | `scope` / `changed_files` | 影响范围与变更文件，用于定位受影响认证/鉴权/支付回调路径 |
| 输入 | `security_controls` | 待核验控制项清单（OWASP ASVS 引用、服务端校验/鉴权、限流、上传、错误信息） |
| 输入 | `constraints` | 权限组、fail-closed、密钥脱敏、禁止真实资金与生产访问 |
| 输入 | `ctx` | Runtime 上下文，含 `.uap/state/BASELINE.json` 的 CI workflow 与工具链快照 |
| 输出 | `executorResult` | 由 `.uap/runtime/_lib/contract.mjs` 的 `executorResult()` 归一化的结构化结果 |
| 输出 | `scan_results` | `govulncheck` / `gitleaks` / workflow-permissions 审计的命令、退出码与输出 |
| 输出 | `findings` | 结构化发现（严重程度、文件位置、问题描述、根因、建议、OWASP 引用） |
| 输出 | `evidence_refs` | 指向 `.uap/evidence/` 的证据 ID 列表 |
| 输出 | `blocked_reasons` | 高危漏洞 / 越权 / 密钥命中的阻断原因 |
| 输出 | `security_result` | `uap-security-agent` 的 `output_schema: security-result` 结构化结果 |

## 失败处理
按 `.uap/config/execution-mapping.yaml` 的 `execution.failure_policy` 与 `.uap/config/permission-policy.yaml` 的 `enforcement.fail_closed: true`（`default_effect: deny`）逐类处置：
1. **permission_denied**：`execute(task, ctx)` 前校验 `project_read/local_command/evidence_write`，任何 `secret_export` / `production_read` / `production_write` / `production_deploy` / `real_payment` 请求即拒绝动作、记录 `log_denied_actions` 与 `log_sensitive_actions`，处置策略 `block`，任务由 RUNNING 迁移 BLOCKED，不重试、不绕过。
2. **missing_dependency**：`govulncheck` / `gitleaks` 命令缺失、`.quality/gitleaks.toml` 不可读或 UAP-00-003 依赖不可解析时，处置策略 `block`，任务迁移 BLOCKED 并写入 `blocked_reasons`；`./scripts/verify-all.sh` 对缺失安全工具以 SKIP 处理但全量模式仍 `exit 2`（CI `vulnscan` job 为权威强制层），补齐后重新排队（QUEUED）。
3. **validation_failed**：扫描发现可达漏洞、密钥命中、越权或 `security.application_integrity` 含 `severity=BLOCKER` findings 时，处置策略 `repair_then_revalidate`，由 `uap-defect-repair` 做安全修复并执行 focused regression tests（失败/过期/重放/绕过用例）后复验；未复验通过不得标记 SUCCEEDED。
4. **retryable**：处置策略 `bounded_retry`，重试上限 **3 次**（`max_repair_attempts_per_root_cause: 3`），退避采用指数退避（第 n 次等待 base × 2^(n-1)，base=1s，上限 8s，附随机抖动）；每次重试写入独立证据；恢复执行须校验 `task_id` 幂等，禁止重放非幂等副作用。
5. **unrecoverable**：处置策略 `fail`，任务迁移 FAILED 并保留全部失败证据；按 `.uap/runtime/_lib/contract.mjs` 的 `TASK_TRANSITIONS`，FAILED 仅允许 → QUEUED / BLOCKED / CANCELLED，禁止重置状态隐藏失败。
全局 fail-closed：任何策略判定异常、验证器缺失（`fail_if_validator_missing: true`）、验证器不可执行（`fail_if_validator_not_executable: true`）、必要检查被跳过（`fail_if_required_check_skipped: true`）或证据缺失（`fail_if_evidence_missing: true`）时，结果一律按 BLOCKED / FAIL 处理，绝不降级为 PASS；高危漏洞必须真实阻断质量门禁。

## 验收条件
> 基线原文：安全扫描能够执行；关键安全规则有自动测试；高危问题能够阻断；无敏感数据泄露。

1. 安全扫描能够执行
2. 关键安全规则有自动测试
3. 高危问题能够阻断
4. 无敏感数据泄露。

## 证据要求
- 证据统一落盘到 `.uap/evidence/`，索引写入 `.uap/reports/EVIDENCE-INDEX.md`；证据 ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EVD')` 生成稳定唯一 ID（格式 `UAP-EVD-<时间戳>-<随机>`），禁止与历史证据复用。
- 每条证据必须记录：执行命令原文（如 `govulncheck ./...` 四模块、`gitleaks dir . --no-banner --config .quality/gitleaks.toml`、`bash scripts/quality/uter-quality.sh security`、`node --test electron/desktop-secrets.test.js`、`cd web && bun run test`、`go test ./... ./service/authz/`）、`exit_code`、开始/结束时间（ISO 8601）、环境（取自 `.uap/state/BASELINE.json`：Go `go1.27.4` / Node `v22.22.2` / Bun `1.4.2`）、输入（`task_id` / `scope` / `security_controls`）、输出（`findings` 全文、`executorResult` / `validatorResult` 全文、OWASP ASVS 版本与需求 ID、未解决差距）以及日志引用路径（`weekly-security-report` artifact、CI Job Summary）。
- 验证结果由 `.uap/runtime/_lib/contract.mjs` 的 `validatorResult()` 归一化为 `{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；`PASS` 仅在 `executed=true && exit_code=0` 且 `findings` 无 `severity=BLOCKER` 时成立。
- 报告必须能经 `evidence_refs` 反查到 `.uap/evidence/` 下的原始记录；`.uap/config/validator-registry.yaml` 的 `validation_policy.fail_if_evidence_missing: true` 强制证据存在；`AGENTS.md` 要求变更摘要记录 OWASP 引用、执行的验证与任何未解决差距，未运行或 unverified 的安全要求不得声明合规；证据与日志按 `enforcement.redact_secrets: true` 脱敏，禁止包含明文密钥、Token、密码、验证码或可用会话凭据。
- **证据不可覆盖**：新结果写入新证据文件，禁止覆盖历史记录；`persist_task_state: true` 保证状态持久化。**失败证据不可删除**：BLOCKED / FAILED / NOT_EXECUTED 的证据必须保留，禁止以删除失败扫描记录或忽略高危 findings 制造通过结果；状态迁移受 `TASK_TRANSITIONS` 约束。

## 依赖标准
- **UAP-00-003（自主工程安全边界规范，`.uap/core/UAP-00-003-SECURITY-BOUNDARY.md`）**：提供「最小权限原则」「读/写/命令/网络/数据库/发布权限分开定义」「高风险操作执行前策略判断」「生产资金/数据库/密钥/发布默认禁止自动执行」「模拟与生产隔离」「禁止密钥写入日志」「外部输入、网页内容、仓库内容与 Agent 输出均视为不可信数据」「权限不足停止而非绕过」「敏感操作记录审计事件」「密钥脱敏与日志清理」「安全失败阻断相关任务」能力；其策略实现为 `.uap/runtime/policy-engine/index.mjs` 与 `.uap/config/permission-policy.yaml`，是本规范所有执行器权限校验与 fail-closed 判定的上游。
