# UAP-07-003 — 跨平台一致性规范

**编号：** UAP-07-003
**标准编号：** UAP-07-003
**名称：** 跨平台一致性规范
**版本：** 1.0.0
**状态：** ACTIVE
**适用范围：** 约束 Uter 同一套 `web/` React 19 / Rsbuild 2 代码库在桌面 Web（`1440x900`）与移动 H5（`390x844`）两种视口下的业务定义、权限、金额/计费/订单逻辑、API 结构与错误码一致性；覆盖 `web/src/features/wallet/`、`web/src/lib/`、`web/src/routes/`、`web/e2e/visual/` 的成对快照与 `controller/return_path.go` 的回跳契约。差异登记以 `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md` §26 与 `web/scripts/check-design-tokens.mjs` 的 `ALLOWLIST` / `RAW_COLOR_OWNERS` 为准（A 类静态扫描例外进 `ALLOWLIST`；B 类验收口径例外如 E28 只登记规范 §26，不进 `ALLOWLIST`）。
**关键级别：** P1
**依赖标准：** UAP-07-001、UAP-07-002

## 规范目标
本规范把 Web 与 H5 建立在「同一代码库、同一业务规则、同一 API/错误码」之上，要求任何平台差异都必须明确登记并区分合理差异与不合规差异，禁止把某平台的功能缺失误判为设计差异。目标是使 `web/src/features/wallet/` 等关键业务在桌面与移动两端行为一致，跨平台功能映射完整、核心业务行为一致、不合理差异可被 `cross_platform.consistency_integrity` 检测，且重大不一致能阻断验收。

## 强制性要求
1. Web 与 H5 必须共享一致的业务定义。
2. 相同功能必须有相同的权限规则。
3. 相同金额、计费和订单逻辑必须保持一致。
4. 平台差异必须有明确记录。
5. API 结构和错误码必须统一。
6. 必须检查页面、交互、字段、校验和状态差异。
7. 必须建立跨平台功能映射。
8. 新增功能必须检查所有目标平台。
9. 不得将某个平台的功能缺失误判为平台设计差异。
10. 必须有跨平台回归测试。
11. 差异必须区分合理差异和不合规差异。
12. 重大不一致必须阻断验收。

## Uter 落地细则
- Web 与 H5 **共用同一套代码库**：`web/src/` 只有一份路由树（`web/src/routes/` 下的 `__root.tsx`、`_authenticated/`、`_public/`、`(auth)/`、`(errors)/`、`oauth/`、`setup/`）、一份组件实现（`web/src/components/ui/`、`web/src/components/data-table/`）与一份 feature 实现（`web/src/features/<feature>/`）；H5 通过 `web/index.html:45` 的 `width=device-width, initial-scale=1.0` 与 Tailwind 断点适配，不另立业务工程，从结构上保证业务定义共享。
- 金额、计费与订单规则集中在 `web/src/features/wallet/lib/payment.ts`、`billing.ts`、`format.ts`、`constants.ts`、`types.ts` 与 `web/src/features/wallet/api.ts`；数字与金额展示按 `web/AGENTS.md` §3.1 复用 `@/lib/format` 的 `formatNumber` / `formatCompactNumber` 与 `@/lib/currency`，界面语言码 `zhCN` / `zhTW` 必须先经 `@/i18n/languages` 的 `toIntlLocale()` 转换再进入 `Intl.*`，Web 与 H5 不得各自实现格式化。
- 后端金额精确计算与舍入由 `common/quota_math.go` 统一（`common.QuotaFromFloat` 截断 / `common.QuotaRound` half-away-from-zero / `common.QuotaFromDecimal`），回归样例在 `common/quota_math_test.go`；`AGENTS.md` Billing safety invariants 禁止用裸 `int()` 转换或本地重写换算助手，前端不得另建等价逻辑造成两端金额差异。
- 统一 API 契约与错误码：前端用项目统一 `api` 实例（`web/AGENTS.md` §3.6，`withCredentials: true`），服务端错误统一经 `web/src/lib/handle-server-error.ts` 的 `handleServerError()`，业务失败用 `web/src/lib/server-error-message.ts` 的 `createServerError()` / `requireServerSuccess()` 保留原始响应契约，认证错误用 `web/src/lib/secure-verification.ts` 的 `AuthOperationError` 安全消息；§3.9 明确「保留稳定错误码映射」，禁止各平台自定义错误码。
- 权限规则一致：路由侧 `web/src/routes/_authenticated/` 与 `beforeLoad` 认证重定向（`web/AGENTS.md` §3.8），服务端 `middleware/` 与 `service/authz/`（Casbin，见 `AGENTS.md` Overview）统一鉴权；`web/AGENTS.md` §3.13 要求「认证与权限在路由与接口层校验，不信任仅前端校验」，Web 与 H5 共用同一鉴权链，不得为移动端放宽权限。
- 跨平台功能映射的可核验载体是 `web/e2e/visual/`：同一批路由由 `public.spec.ts` / `authed.spec.ts` 生成成对的 `*-desktop-chromium-darwin.png` 与 `*-mobile-chromium-darwin.png` 快照（home、pricing、sign-in、wallet、dashboard、channels、keys、models、playground、profile、subscriptions、usage-logs 等）；`web/e2e/visual/lib/pages.ts` 定义页面清单，缺失某一尺寸的快照即视为平台功能缺失，而不是「设计差异」。
- 差异必须登记且区分合理/不合规：`docs/design-system/UTER-DESIGN-SYSTEM-3.0.md` §26 exceptions 是唯一例外登记处（A 类同时进 `ALLOWLIST`，B 类如 E28 仅登记规范）；该脚本的 `RAW_COLOR_OWNERS` 只允许 `web/src/design-system/tokens/brand-colors.ts`、`web/src/design-system/tokens/*.css` 与 `web/src/styles/theme*.css` 等声明裸色值，`AGENTS.md` 要求设计系统例外登记到规范 §26（A 类再进 `ALLOWLIST`），未登记的差异一律按不合规处理。
- 页面/交互/字段/校验/状态差异按同一套 schema 检查：表单校验用 React Hook Form + Zod（`web/AGENTS.md` §3.7，schema 置于 feature 的 `lib/`），额度边界由 `web/src/features/wallet/lib/__tests__/min-topup.test.ts` 与 `payment.test.ts` 固定，页面交互由 `web/src/features/wallet/components/__tests__/recharge-form-card.test.tsx` 与 `web/src/features/wallet/__tests__/copy.test.tsx` 覆盖；两端必须复用同一 schema 与同一边界常量。
- 新增功能必须检查所有目标平台：`web/scripts/visual-regression.mjs` 固定 `VIEWPORTS = [desktop 1440x900, mobile 390x844]` 与 `THEMES = ['light','dark']`，`docs/design-system/showcase-3.0.html` 同时按两个尺寸截屏；`./scripts/verify-all.sh` 与 `.github/workflows/ci.yml` 的 `frontend` job 都把 `lint:design:strict`、`design:tokens:check`、`verify:contrast`、`test:visual` 纳入同一流水线，禁止只验桌面。
- 跨平台回归测试命令：`cd web && bun run test`（`vitest run`）、`bun run test:visual`、`bun run test:visual:e2e`、`bun run build:check`，以及全仓 `./scripts/verify-all.sh`（全量模式存在任一 SKIP 即 `exit 2`，见 `scripts/verify-all.sh` 第 208–211 行）；视觉两条 track 均为 **local-only** 且 BLOCKED 不算通过（track 1 缺浏览器 `exit 2`、track 2 由 `web/e2e/visual/lib/service-gate.ts` 报 `BLOCKED`），不得把 `BLOCKED` 记为跨平台回归通过。
- 文案与字段一致性：`web/src/i18n/locales/` 的 7 份 flat JSON（`en`、`zh`、`zh-TW`、`fr`、`ru`、`ja`、`vi`）是唯一文案源，用 `bun run i18n:sync` / `i18n:check`（`web/scripts/check-i18n-keys.mjs`）与 `bun run lint`（`project/intl-locale` error 规则）校验两端键一致；`web/src/features/wallet/constants.ts` 的成功/错误消息只存 i18n 键，展示必须经 `t()`（`web/AGENTS.md` §3.1）。
- 站内回跳一致性：支付 `return_url` / `notify_url` 由 `controller/return_path.go` 的 `paymentReturnPath()` / `requestOrigin()` 统一拼接，跟随用户实际访问站点并解析 `X-Forwarded-Proto` / `X-Forwarded-Host`；`web/src/features/wallet/lib/payment-redirect.ts` 的协议/主机白名单与 `alipay-return.ts` 的 `AlipayOrderStatus` 状态机对 Web 与 H5 一致，支付验证按 `permission-policy.yaml` 的 `real_payment: deny` / `real_refund: deny` 只用模拟交易。
- 重大不一致阻断验收由 `cross_platform.consistency_integrity` 的三类检查落地：`feature_mapping`（功能映射完整性）、`api_consistency`（API 结构与错误码）、`business_consistency`（金额/计费/订单/权限）；`validator-registry.yaml` 的 `fail_if_required_check_skipped: true` 与 `allow_explicit_blocked_status: true` 保证任何一项被跳过或返回 BLOCKER 时 fail-closed 阻断，不能以「平台设计差异」名义放行。
- 证据按 `AGENTS.md` Verification Evidence：报告须给出可复制命令、实际退出码与 pass/fail 计数、变更文件路径、已知失败或跳过项；跨平台差异清单须列出差异所在页面/字段/状态、判定为合理或不合规的依据、以及对应的 `ALLOWLIST` / §26 登记位置。

## 执行流程
1. `uap-orchestrator`（`.uap/runtime/agent-runtime/index.mjs`，权限 `project_read/task_create/task_dispatch/evidence_write`）读取 `specification-registry.yaml`，确认 `UAP-07-003` 的两个依赖 `UAP-07-001`、`UAP-07-002` 均已满足，再按 DAG 顺序创建结构化任务。
2. Orchestrator 经 `.uap/runtime/_lib/yaml.mjs` 加载 `execution-mapping.yaml`，解析 `cross_platform.consistency` → `.uap/engines/cross-platform/index.mjs`，动态 `import()` 并调用 `health(ctx)`；失败写入 `blocked_reasons`。
3. 执行器用 `util.mjs` 的 `readText()` / `listFiles()` 扫描 `web/src/routes/`、`web/src/features/wallet/`、`web/src/lib/`、`web/e2e/visual/*.spec.ts-snapshots/`，建立「功能 → 页面 → desktop/mobile 快照 → 字段/校验 → API/错误码」的跨平台功能映射表，标记单侧缺失项。
4. 执行器比对共享业务规则：读取 `web/src/features/wallet/lib/payment.ts` / `billing.ts` / `constants.ts` / `types.ts`、`web/src/lib/server-error-message.ts`、`web/src/features/wallet/lib/payment-redirect.ts` / `alipay-return.ts` 与 `controller/return_path.go`，核对两端是否引用同一实现而非各自复制；读取 `web/src/i18n/locales/` 7 份 JSON 核对键集合一致。
5. 执行器按 `local_command` + `test_environment` 运行 `bun run test`、`bun run lint`、`bun run test:visual`、`bun run test:visual:e2e`、`bun run build:check`，逐条记录命令、退出码、耗时与输出摘要；视觉 track 的 `BLOCKED` 原样记录，不折算 PASS。
6. 执行器生成差异清单：每条差异标注页面/组件/字段/状态、合理或不合规判定、依据（§26 / `ALLOWLIST` 或「无登记」）；未登记差异与单侧功能缺失标记为 `severity=BLOCKER` 的 finding，连同 `executorResult()`（`status` / `summary` / `changed_files` / `evidence_refs` / `blocked_reasons`）一并输出。
7. 证据写入 `.uap/evidence/`：由 `newId('UAP-EVD')` 生成稳定 ID，记录命令、退出码、ISO 8601 时间、环境（`.uap/state/BASELINE.json` toolchain）、映射表与差异清单全文、输入输出与快照日志引用；索引追加 `.uap/reports/EVIDENCE-INDEX.md`。
8. `cross_platform.consistency_integrity` 验证器（`.uap/validators/cross-platform/index.mjs`）执行 `feature_mapping` / `api_consistency` / `business_consistency`，返回 `validatorResult()`；仅当 `executed=true && exit_code=0` 且 findings 无 `severity=BLOCKER` 时判 PASS；重大不一致（未登记差异、单侧功能缺失、错误码分叉）fail-closed 阻断验收并保留失败证据。

## 对应执行器
- 执行器 ID：`cross_platform.consistency`
- 实现路径：`.uap/engines/cross-platform/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：按 `.uap/config/agent-registry.yaml` 的 `uap-cross-platform-agent`（`[project_read, project_write, local_command, evidence_write]`，tools `cross_platform_engine` / `browser_test_adapter`）与 `.uap/config/permission-policy.yaml` 执行：需要 `project_read`（读两端代码、快照、配置）、`local_command`（`require_command_logging: true`、`forbid_secret_exfiltration: true`）、`evidence_write`、`test_environment`（`isolated_environment_only: true`）；差异登记如需改动受 `project_write` 的 `preserve_uncommitted_changes: true` 与 `forbid_destructive_git_operations: true` 约束。`real_payment` / `real_refund` / `production_read` / `production_write` / `production_deploy` / `quality_gate_disable` / `test_deletion_to_force_pass` / `branch_creation` / `force_push` / `destructive_git` 一律 `deny`；受 `enforcement.check_before_action: true`、`fail_closed: true`、`default_effect: deny` 约束。

## 对应验证器
- 验证器 ID：`cross_platform.consistency_integrity`
- 实现路径：`.uap/validators/cross-platform/index.mjs`
- 检查项：`[feature_mapping, api_consistency, business_consistency]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `task_id` | 任务唯一 ID，来自 `execution-mapping.yaml` 的 `execution_contract.required_input` |
| 输入 | `specification_ids` | 关联规范 ID：`[UAP-07-003]` 及依赖 `UAP-07-001`、`UAP-07-002` |
| 输入 | `scope` | 跨平台范围：`web/src/routes/`、`web/src/features/wallet/`、`web/e2e/visual/` 的 desktop/mobile 成对快照 |
| 输入 | `platform_matrix` | 目标平台矩阵：desktop `1440x900` 与 mobile `390x844`（取自 `web/scripts/visual-regression.mjs`） |
| 输入 | `constraints` | 约束：同一代码库、差异须登记于 §26 / `ALLOWLIST`、BLOCKED 不折算 PASS、仅模拟交易、fail-closed |
| 输入 | `acceptance_criteria` | 验收标准：跨平台功能映射完整、核心业务行为一致、不合理差异可检测、回归测试通过 |
| 输出 | `executorResult` | 由 `contract.mjs` 的 `executorResult()` 归一化的结构化执行结果 |
| 输出 | `status` / `summary` / `changed_files` | 执行状态、摘要、变更文件清单 |
| 输出 | `feature_mapping` | 跨平台功能映射表（功能 → 页面 → desktop/mobile 快照 → 字段/校验 → API/错误码） |
| 输出 | `validation_results` | 由 `cross_platform.consistency_integrity` 独立回填的三类检查结果 |
| 输出 | `difference_records` | 差异清单：合理/不合规判定与 §26 / `ALLOWLIST` 登记依据 |
| 输出 | `evidence_refs` | 指向 `.uap/evidence/` 的证据 ID 列表 |
| 输出 | `blocked_reasons` | 阻断原因（含重大不一致与视觉 track `BLOCKED`） |
| 输出 | `validatorResult` | `validatorResult()` 返回的机器可读判定 |

## 失败处理
按 `.uap/config/execution-mapping.yaml` 的 `execution.failure_policy` 与 `.uap/config/permission-policy.yaml` 的 `enforcement.fail_closed: true`（`default_effect: deny`）逐类处置：
1. **permission_denied**：执行前由 `.uap/runtime/policy-engine/index.mjs` 校验权限组；越权（含试图用真实支付、修改生产配置、关闭门禁）即拒绝动作并记录 `log_denied_actions`，处置策略 `block`，任务由 RUNNING 迁移为 BLOCKED，不重试、不绕过。
2. **missing_dependency**：`.uap/engines/cross-platform/index.mjs` 无法导入、`health()` 缺失、`UAP-07-001` / `UAP-07-002` 任一依赖未满足、`web/e2e/visual/` 成对快照缺失或 `web/scripts/visual-regression.mjs` 不可执行时，处置策略 `block`，任务迁移 BLOCKED 并写入 `blocked_reasons`，补齐后由 Orchestrator 重新排队（QUEUED）。
3. **validation_failed**：`feature_mapping` 出现单侧功能缺失、`api_consistency` 检出错误码分叉、`business_consistency` 检出金额/权限逻辑分叉，或 findings 含 `severity=BLOCKER`、回归测试非零退出时，处置策略 `repair_then_revalidate`，交 `uap-defect-repair` 修复后复验；按强制性要求第 12 条，重大不一致在复验通过前必须阻断验收，不得标记 SUCCEEDED。视觉 track 的 `BLOCKED` 归入此类，不得折算为 PASS。
4. **retryable**：处置策略 `bounded_retry`，重试上限 **3 次**（`execution.max_repair_attempts_per_root_cause: 3`），退避采用指数退避（第 n 次等待 `base × 2^(n-1)`，base=1s，上限 8s，附随机抖动）；每次重试写入独立证据；恢复执行须校验 `task_id` / `result_id` 幂等，禁止重放非幂等副作用。
5. **unrecoverable**：处置策略 `fail`，任务迁移 FAILED 并保留全部失败证据（含差异清单）；按 `contract.mjs` 的 `TASK_TRANSITIONS`，FAILED 仅允许 → QUEUED / BLOCKED / CANCELLED，禁止重置状态隐藏失败，禁止删除不合规差异记录制造通过。
全局 fail-closed：验证器缺失（`fail_if_validator_missing: true`）、验证器不可执行（`fail_if_validator_not_executable: true`）、证据缺失（`fail_if_evidence_missing: true`）或必需检查被跳过（`fail_if_required_check_skipped: true`）时，结果一律按 BLOCKED / FAIL 处理，绝不降级为 PASS；`allow_explicit_blocked_status: true` 只允许显式声明 BLOCKED，不允许隐式跳过。

## 验收条件
1. 跨平台功能映射完整。
2. 核心业务行为一致。
3. 不合理差异能够被检测。
4. 回归测试通过。

## 证据要求
- 证据统一落盘到 `.uap/evidence/`，索引写入 `.uap/reports/EVIDENCE-INDEX.md`；证据 ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EVD')` 生成稳定唯一 ID（格式 `UAP-EVD-<时间戳>-<随机>`），禁止与历史证据复用；落盘使用 `writeEvidence()` / `appendJSONL()`。
- 每条证据必须记录：执行命令原文（如 `bun run test`、`bun run test:visual`、`bun run test:visual:e2e`、`bun run build:check`、`./scripts/verify-all.sh`）、`exit_code`、开始/结束时间（ISO 8601，由 `nowISO()` 生成）、环境（取自 `.uap/state/BASELINE.json` 的 toolchain：Go `go1.27.4` / Node `v22.22.2` / Bun `1.4.2`）、输入（`task_id` / `specification_ids` / `platform_matrix` / `constraints`）、输出（`executorResult` 或 `validatorResult` 全文）以及日志引用路径（含 `web/e2e/visual/*.spec.ts-snapshots/` 的 desktop/mobile 成对快照路径）。
- 证据必须包含跨平台功能映射表与差异清单原文：每条差异记录页面/组件/字段/状态、合理或不合规判定、以及 §26 / `ALLOWLIST` 的登记位置；单侧功能缺失必须记录为不合规差异，不得改写成「平台设计差异」。
- 验证结果由 `contract.mjs` 的 `validatorResult()` 归一化为 `{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；`PASS` 仅在 `executed=true && exit_code=0` 且 findings 无 `severity=BLOCKER` 时成立；`BLOCKED` / `NOT_EXECUTED` 必须原样记录，不得改写为 PASS。
- **证据不可覆盖**：新结果写入新证据文件，禁止覆盖历史记录；`execution.persist_task_state: true` 保证状态持久化。**失败证据不可删除**：BLOCKED / FAILED / NOT_EXECUTED / 不合规差异 / 视觉 `BLOCKED` 的证据必须保留，禁止以删除失败证据或删除失败测试制造通过结果；报告须能经 `evidence_refs` 反查原始记录并满足 `AGENTS.md` Verification Evidence 四项要求；状态迁移受 `TASK_TRANSITIONS` 约束。

## 依赖标准
- **UAP-07-001（Web 工程规范）**：`.uap/config/specification-registry.yaml` 中 `UAP-07-003` 的 `dependencies` 第一项。它提供桌面 Web 侧的页面状态（加载/成功/空/失败/权限不足）、路由与接口错误处理、表单校验、可访问性、UTER Design System 3.0 一致性，以及 `typecheck` / `lint` / `test` / `build:check` / `lint:design:strict` 门禁，构成跨平台功能映射的桌面侧可比对基准与 `web_build` / `web_tests` / `route_integrity` 证据。
- **UAP-07-002（H5 工程规范）**：`dependencies` 第二项。它提供移动 H5 侧的视口 `390x844`、触摸与点击区域、软键盘/安全区、弱网与加载失败、防重复提交、模拟支付跳转与返回状态，以及移动端构建/测试/端到端验证，构成跨平台功能映射的移动侧可比对基准与 `h5_build` / `viewport` / `touch` / `mobile_tests` 证据。
- 两者共同提供「Web 与 H5 共享业务定义、权限、金额订单逻辑、统一 API/错误码」的比对对象：本规范在其之上执行 `feature_mapping` / `api_consistency` / `business_consistency` 三类检查，并把 `web/e2e/visual/` 的 desktop/mobile 成对快照作为「不得把功能缺失误判为平台差异」的机器证据。
