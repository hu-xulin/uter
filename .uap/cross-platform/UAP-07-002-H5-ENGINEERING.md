# UAP-07-002 — H5 工程规范
> **UDS 8.0.0 状态边界：** 当前唯一设计系统 SSOT 为 `TOKEN-MANIFEST.json`（version `8.0.0`、`ACCEPTANCE_READY`、`accepted: false`）。运行时颜色语义由 manifest 派生的 `--ds-*` bridge 提供；现有 UDS 3.0 runtime compatibility boundary 必须保留，直到项目所有者明确授权迁移并完成绑定当前 HEAD 的行为、视觉与兼容回归验证；不得因迁移/映射文件缺失或 UDS 8.0.0 达到 ACCEPTANCE_READY 就推断其已退役。设计系统达到 `ACCEPTANCE_READY` 不等于用户已最终接受；不得将设计系统状态等同于 Uter 全站业务合规。


**编号：** UAP-07-002
**标准编号：** UAP-07-002
**名称：** H5 工程规范
**版本：** 1.0.0
**状态：** ACTIVE
**适用范围：** 约束 Uter 同一套 React 19 / Rsbuild 2 前端在移动视口下的呈现与交互，覆盖 `web/index.html` 的视口声明、`web/src/features/wallet/` 的充值与支付回跳链路、`controller/return_path.go` 的站内回跳拼接、`web/e2e/visual/` 的 desktop/mobile 双轨快照以及 `web/src/i18n/locales/` 的 7 语言文案。H5 与 Web 共用 `web/src/` 代码与业务规则，规范基线同样为 `docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md`（`12-RESPONSIVE-DESIGN-STANDARD.md` 响应式禁止事项、`12-RESPONSIVE-DESIGN-STANDARD.md`）。
**关键级别：** P1
**依赖标准：** UAP-01-001

## 规范目标
本规范把 Uter 移动端 H5 的视口、触摸、软键盘、安全区、弱网与加载失败、防重复提交、支付回跳验证固化为可检查项，并要求所有 H5 验收必须基于移动端真实视口与真实路由而非桌面截图。目标是使 `web/` 的同一套业务规则在桌面与移动两种尺寸下行为一致，支付相关流程只用模拟交易验证跳转与返回状态，且 H5 的构建、测试与端到端验证都能产出带退出码的证据。

## 强制性要求
1. H5 必须适配移动端视口。
2. 必须检查触摸交互和点击区域。
3. 必须处理软键盘、滚动和安全区域。
4. 必须检查弱网和加载失败状态。
5. 必须检查移动端浏览器兼容性。
6. 关键业务操作必须避免重复提交。
7. 支付相关 H5 必须验证跳转和返回状态，但只能使用模拟交易。
8. 页面必须处理网络中断和接口异常。
9. 必须检查不同设备尺寸。
10. H5 必须与 Web 共享业务规则。
11. H5 必须执行构建、测试和必要的端到端验证。
12. 不得只根据桌面浏览器截图判断 H5 合格。

## Uter 落地细则
- 移动端视口声明在 `web/index.html:45`：`<meta name="viewport" content="width=device-width, initial-scale=1.0" />`；响应式按 `web/AGENTS.md` §3.10 采用移动优先与 Tailwind `sm:` / `md:` / `lg:` 断点，`docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md` `12-RESPONSIVE-DESIGN-STANDARD.md` 明令禁止固定桌面宽度导致 H5 横向溢出、禁止移动端简单缩小组件、禁止缩小字号低于规定值解决布局。
- `AGENTS.md` Design System Enforcement 规定「desktop and mobile share one type scale; input text is 14px on every platform (no H5 16px exception)」；H5 不得引入 16px 输入框例外或独立字号体系，设计值取自 `web/src/design-system/tokens/typography.css` 与 `web/src/styles/theme.css`。
- 触摸交互与点击区域按设计系统 §0.2 第 10 条「组件的视觉尺寸与实际交互命中区域必须分别定义」检查；移动端专用组件真实存在于 `web/src/features/usage-logs/components/common-log-mobile-card.tsx`，键盘与可访问性按 `web/AGENTS.md` §3.12（焦点顺序、`aria-*`、装饰图标 `aria-hidden="true"`）验证。
- 设备尺寸矩阵由 `web/scripts/visual-regression.mjs` 固定：`VIEWPORTS = [{ id: 'desktop', width: 1440, height: 900 }, { id: 'mobile', width: 390, height: 844 }]`，且 `THEMES = ['light', 'dark']`；`bun run test:visual` 对 `docs/design-system/SHOWCASE-8.0.0.html` 同时截两个尺寸，禁止只跑 desktop 判定 H5 合格。
- 真实路由的双尺寸证据在 `web/e2e/visual/`：`public.spec.ts` / `authed.spec.ts` / `auth.setup.spec.ts` 及 `*.spec.ts-snapshots/` 下成对的 `*-desktop-chromium-darwin.png` 与 `*-mobile-chromium-darwin.png`（覆盖 home / pricing / sign-in / wallet / dashboard / channels / usage-logs 等页面）；`playwright.config.ts`、`lib/target.ts`、`lib/harness.ts`、`lib/pages.ts`、`lib/login.ts` 为执行入口。
- **H5 与视觉回归真实验证**：UAP CI 构建真实前端/后端产物，以一次性 SQLite、临时 Session Secret 启动本地 Uter 服务，再用 Chromium 执行 5 视口 × 5 路由矩阵；`bun run test:visual` 在 frontend CI 执行并安装 pinned Chromium。`bun run test:visual:e2e` 仍需独立 Phase 2 测试栈与授权测试账号，未提供时由 `service-gate.ts` 如实标记 `BLOCKED`，不得把 H5 矩阵 PASS 代替完整业务 E2E。
- 支付跳转/返回状态真实实现：`web/src/features/wallet/lib/payment-redirect.ts` 是支付跳转统一入口，只允许 http/https、拒绝 `javascript:` / `data:`、生产要求 HTTPS、按服务商主机名白名单校验、新窗口带 `noopener,noreferrer`、弹窗被拦截明确报错；`web/src/features/wallet/lib/alipay-return.ts` 用 `AlipayOrderStatus = 'success' | 'pending' | 'unpaid' | 'closed'` 与 `ALIPAY_RETURN_QUERY_ATTEMPTS` / `ALIPAY_RETURN_QUERY_INTERVAL_MS` 轮询查单并分流 `onSuccess` / `onPending`。
- 站内回跳由后端 `controller/return_path.go` 拼接：`paymentReturnPath()` 委托 `service.PaymentReturnURL()`（站点根优先取 `PaymentSiteAddress`，留空回退 Server Address），`requestOrigin()` 让 `return_url` / `notify_url` 跟随用户实际访问站点（本地回 localhost、生产回 uter.ai），并优先解析 `X-Forwarded-Proto` / `X-Forwarded-Host`；验证 H5 跳转必须同时覆盖这两个函数对应的状态。
- **只能使用模拟交易**：`.uap/config/permission-policy.yaml` 中 `real_payment: deny`、`real_refund: deny`；`.uap/config/workflow-registry.yaml` 的 `uap-financial-verification` 标注 `environment: simulated_only`、`acceptance: financial_integrity_verified`；`test_environment` 权限组带 `isolated_environment_only: true`。支付回跳验证必须走模拟支付渠道、模拟回调与隔离测试库。
- 支付相关验证证据已有测试：`web/src/features/wallet/lib/__tests__/alipay-return.test.ts`、`payment-redirect.test.ts`、`payment.test.ts`、`min-topup.test.ts`，`web/src/features/wallet/components/dialogs/__tests__/cn-pay-web-dialog.test.tsx`，以及 `web/src/features/wallet/components/__tests__/recharge-form-card.test.tsx`；`web/src/features/wallet/components/dialogs/cn-pay-web-dialog.tsx` 为境内支付 Web 弹窗实现。
- 防重复提交与接口异常：表单按 `web/AGENTS.md` §3.7 用 React Hook Form + Zod，提交态以 `isSubmitting` / `disabled` 表达（见 `web/src/features/models/components/dialogs/`、`web/src/features/subscriptions/components/subscriptions-mutate-drawer.tsx` 等真实实现）；数据请求按 §3.6 用 `useQuery` / `useMutation`，失败统一经 `web/src/lib/handle-server-error.ts` 的 `handleServerError()`，业务失败用 `web/src/lib/server-error-message.ts` 的 `createServerError()` / `requireServerSuccess()` 保留原始 API 响应契约；自动重试期间与主动取消不误报（`web/AGENTS.md` §3.9）。
- H5 与 Web 共享业务规则：充值/支付/额度逻辑集中在 `web/src/features/wallet/lib/payment.ts`、`billing.ts`、`format.ts`、`constants.ts` 与 `web/src/features/wallet/api.ts`、`types.ts`，H5 不得另写一套金额或订单状态；i18n 文案统一走 `web/src/i18n/locales/` 的 7 份 flat JSON（`en`、`zh`、`zh-TW`、`fr`、`ru`、`ja`、`vi`），用 `bun run i18n:sync` / `i18n:check` 校验，H5 不引入独立文案源。
- 构建、测试与端到端门禁：`cd web && bun run typecheck`、`bun run lint`、`bun run test`、`bun run build:check`、`bun run test:visual`、`bun run test:visual:e2e`、`bun run test:axe`；全仓入口 `./scripts/verify-all.sh [--quick]`，**全量模式存在任一 SKIP 即 `exit 2`**（`scripts/verify-all.sh` 第 208–211 行）；CI 侧 `.github/workflows/ci.yml` 的 `frontend` job 用 `bunx playwright install chromium` 后跑 `bun run test:visual`。
- 证据规范按 `AGENTS.md` Verification Evidence：报告须给出可复制命令、实际退出码与 pass/fail 计数、变更文件路径、已知失败或跳过项（尤其是视觉 track 的 `BLOCKED`）；`AGENTS.md` 明确拒绝「已检查 / looks correct」等断言，且 Design System Enforcement 要求「never report full compliance based solely on visual inspection or a successful compilation」。

## 执行流程
1. `uap-orchestrator`（`.uap/runtime/agent-runtime/index.mjs`，权限 `project_read/task_create/task_dispatch/evidence_write`）解析 `specification-registry.yaml` 中 `UAP-07-002` 的依赖 `UAP-01-001`，确认满足后创建结构化任务（`task_id` / `specification_ids` / `scope` / `constraints` / `acceptance_criteria`）。
2. Orchestrator 经 `.uap/runtime/_lib/yaml.mjs` 加载 `execution-mapping.yaml`，解析 `cross_platform.h5` → `.uap/engines/cross-platform/index.mjs`，动态 `import()` 并调用 `health(ctx)`；不可导入或 `health()` 缺失写入 `blocked_reasons`。
3. 执行器读取 `web/index.html`（viewport meta）、`web/src/features/wallet/lib/payment-redirect.ts` 与 `alipay-return.ts`、`controller/return_path.go`、`web/e2e/visual/playwright.config.ts`、`docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md` `12-RESPONSIVE-DESIGN-STANDARD.md`/§16，建立移动端视口—支付回跳—路由快照映射。
4. 执行器按 `local_command` + `test_environment`（`isolated_environment_only: true`）运行 `bun run typecheck`、`bun run lint`、`bun run test`、`bun run build:check`；逐条记录命令、退出码、耗时与 stdout/stderr 摘要。
5. 执行器触发移动端验证：`bun run test:visual`（必须包含 mobile 390x844）与 `bun run test:visual:e2e`（必须包含 `*-mobile-*.png` 快照）；模拟支付回跳用例只走模拟渠道，校验 `return_url` 落地状态与 `AlipayOrderStatus` 四种状态分流。服务栈或浏览器缺失时按 `BLOCKED` 记录（track 1 `exit 2`、track 2 `BLOCKED`），**不折算为 PASS**。
6. 执行器用 `contract.mjs` 的 `executorResult()` 归一化输出；`validation_results` 留待独立验证器回填（`assertExecutorResult()` 强制），并把 `blocked_reasons` 写明。
7. 证据写入 `.uap/evidence/`：由 `util.mjs` 的 `newId('UAP-EVD')` 生成稳定 ID，记录命令、退出码、ISO 8601 时间、环境（`.uap/state/BASELINE.json` toolchain：Go `go1.27.4` / Node `v22.22.2` / Bun `1.4.2`）、输入输出、移动端视口尺寸与日志/快照引用路径；索引追加 `.uap/reports/EVIDENCE-INDEX.md`。
8. `cross_platform.h5_integrity` 验证器（`.uap/validators/cross-platform/index.mjs`）执行 `h5_build` / `viewport` / `touch` / `mobile_tests` 并返回 `validatorResult()`；仅当 `executed=true && exit_code=0` 且 findings 无 `severity=BLOCKER` 时判 PASS，否则 fail-closed 记为 BLOCKED/FAIL 并保留失败证据。

## 对应执行器
- 执行器 ID：`cross_platform.h5`
- 实现路径：`.uap/engines/cross-platform/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：按 `.uap/config/agent-registry.yaml` 的 `uap-cross-platform-agent`（`[project_read, project_write, local_command, evidence_write]`，tools `cross_platform_engine` / `browser_test_adapter`）与 `.uap/config/permission-policy.yaml` 执行：需要 `project_read`（读 `web/index.html`、支付回跳代码、`controller/return_path.go`）、`local_command`（`require_command_logging: true`、`forbid_secret_exfiltration: true`）、`evidence_write`、`test_environment`（`isolated_environment_only: true`）。`real_payment: deny` 与 `real_refund: deny` 强制支付验证只用模拟交易；`production_read` / `production_write` / `production_deploy` / `secret_export` / `quality_gate_disable` / `test_deletion_to_force_pass` / `branch_creation` / `force_push` / `destructive_git` 一律 `deny`；受 `enforcement.check_before_action: true`、`fail_closed: true`、`default_effect: deny` 约束。

## 对应验证器
- 验证器 ID：`cross_platform.h5_integrity`
- 实现路径：`.uap/validators/cross-platform/index.mjs`
- 检查项：`[h5_build, viewport, touch, mobile_tests]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `task_id` | 任务唯一 ID，来自 `execution-mapping.yaml` 的 `execution_contract.required_input` |
| 输入 | `specification_ids` | 关联规范 ID：`[UAP-07-002]` 及依赖 `UAP-01-001` |
| 输入 | `scope` | 移动端影响范围：`web/index.html` 视口、`web/src/features/wallet/` 支付链路、`web/e2e/visual/` 移动快照 |
| 输入 | `viewport_matrix` | 尺寸矩阵：desktop `1440x900` 与 mobile `390x844`（取自 `web/scripts/visual-regression.mjs`） |
| 输入 | `constraints` | 约束：仅模拟交易、BLOCKED 不折算 PASS、全平台输入 14px、权限组与 fail-closed |
| 输入 | `acceptance_criteria` | 验收标准：H5 构建通过、移动端关键流程通过、弱网与异常状态得到验证、触摸和布局行为正确 |
| 输出 | `executorResult` | 由 `contract.mjs` 的 `executorResult()` 归一化的结构化执行结果 |
| 输出 | `status` / `summary` / `changed_files` | 执行状态、摘要、变更文件清单 |
| 输出 | `validation_results` | 由 `cross_platform.h5_integrity` 独立回填 |
| 输出 | `h5_build` / `viewport` / `touch` / `mobile_tests` | 四类检查逐项结果（命令、退出码、视口尺寸、日志引用） |
| 输出 | `evidence_refs` | 指向 `.uap/evidence/` 的证据 ID 列表 |
| 输出 | `blocked_reasons` | 阻断原因（含视觉 track `BLOCKED` 与模拟交易约束） |
| 输出 | `validatorResult` | `validatorResult()` 返回的机器可读判定 |

## 失败处理
按 `.uap/config/execution-mapping.yaml` 的 `execution.failure_policy` 与 `.uap/config/permission-policy.yaml` 的 `enforcement.fail_closed: true`（`default_effect: deny`）逐类处置：
1. **permission_denied**：执行前由 `.uap/runtime/policy-engine/index.mjs` 校验权限组；若任务试图调用真实支付/退款（`real_payment` / `real_refund` 为 `deny`）或访问生产资源，立即拒绝动作并记录 `log_denied_actions`，处置策略 `block`，任务由 RUNNING 迁移为 BLOCKED，不重试、不绕过。
2. **missing_dependency**：`.uap/engines/cross-platform/index.mjs` 无法导入、`health()` 缺失、`web/index.html` 视口声明缺失、依赖 `UAP-01-001` 未满足或移动端浏览器/服务栈不可用时，处置策略 `block`，任务迁移 BLOCKED 并写入 `blocked_reasons`，补齐后由 Orchestrator 重新排队（QUEUED）。
3. **validation_failed**：`typecheck` / `lint` / `test` / `build:check` 任一非零退出，或 `viewport` / `touch` / `mobile_tests` 检查失败（如只跑了 desktop 快照、支付回跳未覆盖返回状态、findings 含 `severity=BLOCKER`）时，处置策略 `repair_then_revalidate`，交 `uap-defect-repair` 修复后复验；视觉 `BLOCKED` 归入此类，不得折算为 PASS。
4. **retryable**：处置策略 `bounded_retry`，重试上限 **3 次**（`execution.max_repair_attempts_per_root_cause: 3`），退避采用指数退避（第 n 次等待 `base × 2^(n-1)`，base=1s，上限 8s，附随机抖动）；每次重试写入独立证据；恢复执行须校验 `task_id` / `result_id` 幂等，禁止重放非幂等副作用（尤其禁止重复触发模拟支付回调造成重复入账假象）。
5. **unrecoverable**：处置策略 `fail`，任务迁移 FAILED 并保留全部失败证据；按 `contract.mjs` 的 `TASK_TRANSITIONS`，FAILED 仅允许 → QUEUED / BLOCKED / CANCELLED，禁止重置状态隐藏失败。
全局 fail-closed：验证器缺失（`fail_if_validator_missing: true`）、验证器不可执行（`fail_if_validator_not_executable: true`）、证据缺失（`fail_if_evidence_missing: true`）或必需检查被跳过（`fail_if_required_check_skipped: true`）时，结果一律按 BLOCKED / FAIL 处理，绝不降级为 PASS；`allow_explicit_blocked_status: true` 只允许显式声明 BLOCKED，不允许隐式跳过。

## 验收条件
1. H5 构建通过。
2. 移动端关键流程通过。
3. 弱网和异常状态得到验证。
4. 触摸和布局行为正确。

## 证据要求
- 证据统一落盘到 `.uap/evidence/`，索引写入 `.uap/reports/EVIDENCE-INDEX.md`；证据 ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EVD')` 生成稳定唯一 ID（格式 `UAP-EVD-<时间戳>-<随机>`），禁止与历史证据复用；落盘使用 `writeEvidence()` / `appendJSONL()`。
- 每条证据必须记录：执行命令原文（如 `bun run test:visual`、`bun run test:visual:e2e`、`bun run build:check`、`bun run test`、`./scripts/verify-all.sh`）、`exit_code`、开始/结束时间（ISO 8601，由 `nowISO()` 生成）、环境（取自 `.uap/state/BASELINE.json` 的 toolchain：Go `go1.27.4` / Node `v22.22.2` / Bun `1.4.2`）、输入（`task_id` / `specification_ids` / `viewport_matrix` / `constraints`）、输出（`executorResult` 或 `validatorResult` 全文）以及日志引用路径（含 `web/e2e/visual/*.spec.ts-snapshots/` 的 mobile 快照路径、`VISUAL_AUDIT_REPORT`）。
- 证据必须显式记录移动端视口 `390x844` 与桌面 `1440x900` 两个尺寸的结果，证明「不得只根据桌面浏览器截图判断」；支付回跳证据必须注明使用模拟交易与隔离环境，`real_payment` / `real_refund` 未被触及。
- 验证结果由 `contract.mjs` 的 `validatorResult()` 归一化为 `{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；`PASS` 仅在 `executed=true && exit_code=0` 且 findings 无 `severity=BLOCKER` 时成立；`BLOCKED` / `NOT_EXECUTED`（浏览器或服务栈缺失）必须原样记录，不得改写为 PASS。
- **证据不可覆盖**：新结果写入新证据文件，禁止覆盖历史记录；`execution.persist_task_state: true` 保证状态持久化。**失败证据不可删除**：BLOCKED / FAILED / NOT_EXECUTED / 视觉 `BLOCKED` 的证据必须保留，禁止以删除失败证据或删除失败测试制造通过结果；报告须能经 `evidence_refs` 反查原始记录并满足 `AGENTS.md` Verification Evidence 四项要求；状态迁移受 `TASK_TRANSITIONS` 约束。

## 依赖标准
- **UAP-01-001（产品需求工程规范）**：`.uap/config/specification-registry.yaml` 中 `UAP-07-002` 的 `dependencies: [UAP-01-001]`。它为每个产品功能提供唯一 Feature ID、目标用户/使用场景/业务价值/验收标准，并要求识别功能前置条件、异常流程与边界条件，使 H5 的充值、支付跳转与返回状态等移动端关键流程有明确的需求来源与可验证边界（弱网、网络中断、重复提交、异常回调），并支撑「移动端关键流程通过」与「弱网和异常状态得到验证」的验收判定。
