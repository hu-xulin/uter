# UAP-07-001 — Web 工程规范

**编号：** UAP-07-001
**标准编号：** UAP-07-001
**名称：** Web 工程规范
**版本：** 1.0.0
**状态：** ACTIVE
**适用范围：** 约束 Uter `web/` React 19 / TypeScript / Rsbuild 2 前端的全部页面、路由、表单、状态管理与 UI 组件；覆盖 `web/src/routes/`、`web/src/features/wallet/`、`web/src/components/ui/`、`web/src/design-system/tokens/`、`web/src/i18n/locales/` 与 `web/e2e/visual/`。设计一致性的唯一基线是 `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md`，前端工程约定以 `web/AGENTS.md` 与 `AGENTS.md` 的 Automated Quality Gates / Verification Evidence / Design System Enforcement 章节为准。
**关键级别：** P1
**依赖标准：** UAP-01-001

## 规范目标
本规范把 Uter Web 功能绑定到产品需求（UAP-01-001 的 Feature ID 追溯链），要求每个页面实现加载、成功、空、失败、权限不足五类状态，并把类型检查、Lint、测试、构建、设计令牌与视觉回归固化为机器可执行的门禁。目标是使 `web/` 的任何修改都能由真实命令产出带退出码的证据，并证明 UI 遵循 UTER Design System 3.0、且不因视觉样式改动破坏既有业务交互。

## 强制性要求
1. Web 功能必须与产品需求对应。
2. 页面必须覆盖加载、成功、空状态、失败和权限不足状态。
3. 表单必须有字段校验和错误提示。
4. 交互必须具有明确反馈。
5. 页面必须满足可访问性基本要求。
6. 必须检查路由、状态管理和接口错误处理。
7. 必须检查性能和资源加载。
8. 关键业务流程必须有自动化测试。
9. Web 修改必须执行类型检查、Lint、测试和构建。
10. UI 必须遵循 Uter 当前有效设计系统；当前设计基线为 UTER Design System 3.0，除非仓库中存在更高版本且已明确生效的正式基线。
11. 不得以视觉样式修改破坏业务交互。
12. 必须检查不同屏幕尺寸。

## Uter 落地细则
- 设计基线唯一来源为 `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md`（`AGENTS.md` Rule Auto-Loading 表格标注「2026-11-03 起唯一标准」）；视觉样本 `docs/design-system/showcase-3.0.html` 必须按 §11 colors / §12 typography / §14 components / §21 responsive / §26 exceptions 对照；文档与实现冲突时设计值取 `web/src/design-system/tokens/` 与 `web/src/styles/theme.css`，规则边界取规范。
- 品牌色与第三方商标色**只能声明在** `web/src/design-system/tokens/brand-colors.ts`；`web/scripts/check-design-tokens.mjs` 的 `RAW_COLOR_OWNERS` / T8 规则把该文件识别为唯一裸色值所有者，其他业务代码出现裸 hex 即违规；该文件注释明确「组件一律从这里 import，不得在业务代码里散写 hex」。
- 设计令牌实现落在 `web/src/design-system/tokens/`（`colors.css`、`typography.css`、`spacing.css`、`primitives.css`、`semantic.css`、`elevation.css`、`generated/brand.css`、`index.css`）与 `web/src/styles/theme.css`、`web/src/styles/theme-presets.css`；生成物 `generated/brand.css` 禁止手改，必须改 `web/src/design-system/source/*.tokens.json` 后由 `bun run design:tokens:generate` 重生成。
- UI 门禁脚本来自 `web/package.json`：`bun run typecheck`（`tsgo -b`）、`bun run lint`（`check-i18n-keys.mjs` + `oxlint`）、`bun run test`（`vitest run`）、`bun run lint:design:strict`（`node scripts/check-design-tokens.mjs --strict`，T1–T17 令牌门禁）、`bun run copyright:check`、`bun run format:check`、`bun run build:check`（`tsgo -b` + `rsbuild build`）、`bun run design:tokens:check`、`bun run verify:contrast`、`bun run components:registry:check`。
- 设计系统强制验证组合（`AGENTS.md` Design System Enforcement）：`cd web && bun run lint:design:strict`、`bunx vitest run src/design-system/__tests__`、`npx tsgo -b --force`；三者结果必须逐项在报告中给出命令与退出码，禁止以「已检查」「看起来一致」代替。
- **视觉回归两条 track 均为 local-only，都不进 CI**：track 1 `bun run test:visual` → `web/scripts/visual-regression.mjs`，对 `docs/design-system/showcase-3.0.html` 在 desktop 1440x900 与 mobile 390x844、light/dark 两套主题截图并与 `web/visual-regression/baseline.json` 哈希比对，报告写入 `VISUAL_AUDIT_REPORT`（默认 `/tmp/uter-visual-a11y-report.json`）；track 2 `bun run test:visual:e2e` → `web/e2e/visual/playwright.config.ts` + `web/e2e/visual/lib/service-gate.ts`，覆盖 `public.spec.ts` / `authed.spec.ts` 的真实路由 desktop/mobile 快照（`web/e2e/visual/*.spec.ts-snapshots/`）。
- **BLOCKED 不算通过**：`AGENTS.md` 明确两条 track 因本地字体渲染与 GPU 合成差异刻意不接入 CI；浏览器或 Go 后端 + `bun run dev` 服务栈缺失时，track 1 以 `exit 2` 报 `BLOCKED`、track 2 经 `web/e2e/visual/lib/service-gate.ts` 报整轮 `BLOCKED`（该文件中 `BLOCKED_BANNER` 写明「本轮判定为 BLOCKED，不当作通过」）。`BLOCKED` 意为 not executed，严禁改写为 PASS 或静默 SKIP。
- 页面状态与路由落在 `web/src/routes/`（`__root.tsx`、`_authenticated/`、`_public/`、`(auth)/`、`(errors)/`、`oauth/`、`setup/`）；错误处理按 `web/AGENTS.md` §3.9 走 `web/src/lib/handle-server-error.ts` 的 `handleServerError()` 与 `web/src/lib/server-error-message.ts` 的 `createServerError()` / `requireServerSuccess()`，Query 失败由 `createAppQueryClient` 统一提示，路由级错误由 `errorComponent` 承接。
- 表单校验按 `web/AGENTS.md` §3.7 用 React Hook Form + Zod（schema 置于 feature 的 `lib/`，`z.infer` 导出类型），服务端错误经 `form.setError` 映射到字段；可访问性按 §3.12 要求语义化 HTML、`label` 关联、键盘焦点与 WCAG 2.1 AA 正文对比度 ≥ 4.5:1，并有 `bun run test:axe`（`web/e2e/axe/playwright.config.ts`）与 `visual-regression.mjs` 内 `@axe-core/playwright` 检查。
- 关键业务自动化测试真实存在：`web/src/features/wallet/__tests__/copy.test.tsx`、`web/src/features/wallet/lib/__tests__/payment.test.ts`、`web/src/features/wallet/components/__tests__/recharge-form-card.test.tsx`、`web/src/design-system/__tests__/` 守卫测试、`web/e2e/visual/` 端到端快照；测试须放模块专属 `__tests__/`，禁止与正式代码平铺（`web/AGENTS.md` §3.14）。
- 组件复用（`web/AGENTS.md` §3.3）：新增 UI 前必须先检索 `web/src/components/ui/`、`web/src/components/data-table/` 与对应 `web/src/features/<feature>/` 已有实现；`AGENTS.md` §Design System Enforcement 要求复用已有组件、不得引入任意颜色/字号/间距/圆角/投影/动效、不得改变无关业务逻辑、桌面与移动共享同一 type scale 且输入文字全平台 14px。
- 全仓门禁入口 `./scripts/verify-all.sh [--quick]`：全量模式依次跑 Go 格式、`GOWORK=off go vet ./...`（含 relaykit / tokenkit / tokenkit/tokenkit）、`make test`、前端 typecheck / lint / lint:design:strict / copyright:check / format:check / test / build:check、`scripts/verify-docs-artifacts.sh` 与 `scripts/quality/uter-quality.sh security`；**全量模式下只要存在任一 SKIP 即 `exit 2`**（`scripts/verify-all.sh` 第 208–211 行），`--quick` 仅作非权威的开发便利，不得作为验收依据。
- CI 对应 `.github/workflows/ci.yml` 的 `frontend` job（`Frontend typecheck, tests, lint and production build`）：`bun install --frozen-lockfile` → `typecheck` → `test` → `lint` → `design:tokens:check` → `verify:contrast` → `lint:design:strict` → `bunx playwright install chromium` → `test:visual` → `components:registry:check` → `copyright:check` → `build:check`；`format:check` 因存量基线未纳入必需步骤，不得据此宣称格式已验收。
- 证据规范按 `AGENTS.md` Verification Evidence：任何完成报告必须写明可复制的命令原文、实际退出码与 pass/fail 计数、按路径列出的变更文件、以及明确列出的已知失败或跳过项；门禁未跑必须标注 unverified，`AGENTS.md` 明确拒绝「已检查 / tests passed / looks correct」这类断言。

## 执行流程
1. `uap-orchestrator`（`.uap/runtime/agent-runtime/index.mjs`，权限 `project_read/task_create/task_dispatch/evidence_write`）按 `specification-registry.yaml` 解析 `UAP-07-001` 的依赖 `UAP-01-001`，校验依赖已满足后创建结构化任务（含 `task_id`、`specification_ids`、`scope`、`constraints`、`acceptance_criteria`）。
2. Orchestrator 经 `.uap/runtime/_lib/yaml.mjs` 加载 `.uap/config/execution-mapping.yaml`，解析 `cross_platform.web` → `.uap/engines/cross-platform/index.mjs`，动态 `import()` 后调用 `health(ctx)` 收集健康状态；失败写入 `blocked_reasons`。
3. 执行器读取 `web/package.json`、`web/src/routes/`、`web/src/features/wallet/`、`web/src/design-system/tokens/brand-colors.ts`、`docs/design-system/UTER-DESIGN-SYSTEM-3.0.md`，用 `.uap/runtime/_lib/util.mjs` 的 `readText()` / `listFiles()` 建立页面—需求—组件映射，识别本次变更影响的页面、断点与交互状态。
4. 执行器按 `local_command` 权限逐条运行 `cd web && bun run typecheck`、`bun run lint`、`bun run test`、`bun run lint:design:strict`、`bun run copyright:check`、`bun run format:check`、`bun run build:check`，以及 `bunx vitest run src/design-system/__tests__`；每条记录命令原文、退出码、耗时、stdout/stderr 摘要到内存结果集。
5. 视觉两条 track 以「local-only」口径执行：`bun run test:visual`、`bun run test:visual:e2e`；若浏览器或服务栈缺失，结果按 `BLOCKED` 记录（track 1 记为 `exit 2`、track 2 记 `BLOCKED`），**不标记为 PASS**，并在 `blocked_reasons` 写明原因。
6. 执行器用 `.uap/runtime/_lib/contract.mjs` 的 `executorResult()` 归一化输出（`status` / `summary` / `changed_files` / `validation_results` / `evidence_refs` / `blocked_reasons`），`validation_results` 由独立验证器回填，执行器不得自行声明（由 `assertExecutorResult()` 强制）。
7. 证据写入 `.uap/evidence/`：由 `util.mjs` 的 `newId('UAP-EVD')` 生成稳定 ID，记录命令、退出码、ISO 8601 时间、环境（取自 `.uap/state/BASELINE.json` 的 toolchain：Go `go1.27.4` / Node `v22.22.2` / Bun `1.4.2`）、输入输出与日志引用路径；索引追加到 `.uap/reports/EVIDENCE-INDEX.md`。
8. `cross_platform.web_integrity` 验证器（`.uap/validators/cross-platform/index.mjs`）执行 `web_build` / `web_tests` / `route_integrity` 检查并返回 `validatorResult()`；仅当 `executed=true && exit_code=0` 且 findings 无 `severity=BLOCKER` 时判 PASS，否则 fail-closed 记为 BLOCKED/FAIL 并保留失败证据。

## 对应执行器
- 执行器 ID：`cross_platform.web`
- 实现路径：`.uap/engines/cross-platform/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：按 `.uap/config/agent-registry.yaml` 的 `uap-cross-platform-agent`（`[project_read, project_write, local_command, evidence_write]`，tools `cross_platform_engine` / `browser_test_adapter`）与 `.uap/config/permission-policy.yaml` 执行：需要 `project_read`（读规范/配置/`web/` 源码）、`project_write`（受 `preserve_uncommitted_changes: true`、`forbid_destructive_git_operations: true` 约束）、`local_command`（`require_command_logging: true`、`forbid_secret_exfiltration: true`）、`evidence_write`；视觉与测试环节另需 `test_environment`（`isolated_environment_only: true`）。`production_read` / `production_write` / `production_deploy` / `real_payment` / `real_refund` / `quality_gate_disable` / `test_deletion_to_force_pass` / `branch_creation` / `force_push` / `destructive_git` 一律 `deny`；受 `enforcement.check_before_action: true`、`fail_closed: true`、`default_effect: deny` 约束。

## 对应验证器
- 验证器 ID：`cross_platform.web_integrity`
- 实现路径：`.uap/validators/cross-platform/index.mjs`
- 检查项：`[web_build, web_tests, route_integrity]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `task_id` | 任务唯一 ID，来自 `execution-mapping.yaml` 的 `execution_contract.required_input` |
| 输入 | `specification_ids` | 关联规范 ID：`[UAP-07-001]` 及依赖 `UAP-01-001` |
| 输入 | `scope` | 变更范围：`web/src/routes/`、`web/src/features/`、`web/src/design-system/tokens/` 中受影响的页面与组件 |
| 输入 | `constraints` | 约束：UTER Design System 3.0 唯一基线、品牌色仅 `brand-colors.ts`、BLOCKED 不折算 PASS、权限组与 fail-closed |
| 输入 | `acceptance_criteria` | 验收标准：构建通过、关键路由与流程测试通过、页面状态完整、设计规范一致性有验证结果 |
| 输入 | `ctx` | Runtime 上下文，含 `.uap/state/BASELINE.json` 的 toolchain 与 `real_gate_commands` |
| 输出 | `executorResult` | 由 `contract.mjs` 的 `executorResult()` 归一化的结构化执行结果 |
| 输出 | `status` / `summary` / `changed_files` | 执行状态、摘要、变更文件清单 |
| 输出 | `validation_results` | 由 `cross_platform.web_integrity` 独立回填，`assertExecutorResult()` 强制执行器不得自填 |
| 输出 | `web_build` / `web_tests` / `route_integrity` | 三类检查的逐项结果（命令、退出码、日志引用） |
| 输出 | `evidence_refs` | 指向 `.uap/evidence/` 的证据 ID 列表 |
| 输出 | `blocked_reasons` | 阻断原因（含两条视觉 track 的 `BLOCKED` 原因） |
| 输出 | `validatorResult` | `validatorResult()` 返回的机器可读判定 |

## 失败处理
按 `.uap/config/execution-mapping.yaml` 的 `execution.failure_policy` 与 `.uap/config/permission-policy.yaml` 的 `enforcement.fail_closed: true`（`default_effect: deny`）逐类处置：
1. **permission_denied**：`execute(task, ctx)` 前由 `.uap/runtime/policy-engine/index.mjs` 校验权限组，缺失或越权即拒绝动作、记录 `log_denied_actions` 审计事件，处置策略 `block`，任务由 RUNNING 迁移为 BLOCKED，不重试、不绕过；尝试 `production_*` 或 `real_payment` 时同样直接阻断。
2. **missing_dependency**：`.uap/engines/cross-platform/index.mjs` 无法 `import()`、`health()` 缺失、`web/package.json` 脚本缺失、依赖 `UAP-01-001` 未满足或 `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md` 不可读时，处置策略 `block`，任务迁移 BLOCKED 并写入 `blocked_reasons`，补齐后由 Orchestrator 重新排队（QUEUED）。
3. **validation_failed**：`typecheck` / `lint` / `lint:design:strict` / `test` / `build:check` 任一非零退出，或验证器返回 FAIL / NOT_EXECUTED、findings 含 `severity=BLOCKER`（如裸色值散落业务代码、页面状态缺失、`route_integrity` 失败）时，处置策略 `repair_then_revalidate`，交 `uap-defect-repair` 工作流修复后复验；未复验通过不得标记 SUCCEEDED。视觉 track 的 `BLOCKED` 归入此类，不得折算为 PASS。
4. **retryable**：处置策略 `bounded_retry`，重试上限 **3 次**（`execution.max_repair_attempts_per_root_cause: 3`），退避采用指数退避（第 n 次等待 `base × 2^(n-1)`，base=1s，上限 8s，附随机抖动）；每次重试写入独立证据；恢复执行须校验 `task_id` / `result_id` 幂等，禁止重放非幂等副作用，禁止重跑已产生副作用的 `build:check`。
5. **unrecoverable**：处置策略 `fail`，任务迁移 FAILED 并保留全部失败证据；按 `contract.mjs` 的 `TASK_TRANSITIONS`，FAILED 仅允许 → QUEUED / BLOCKED / CANCELLED，禁止重置状态隐藏失败。
全局 fail-closed：验证器缺失（`fail_if_validator_missing: true`）、验证器不可执行（`fail_if_validator_not_executable: true`）、证据缺失（`fail_if_evidence_missing: true`）或必需检查被跳过（`fail_if_required_check_skipped: true`）时，结果一律按 BLOCKED / FAIL 处理，绝不降级为 PASS；`allow_explicit_blocked_status: true` 只允许显式声明 BLOCKED，不允许隐式跳过。

## 验收条件
1. Web 构建通过。
2. 关键路由和流程测试通过。
3. 页面状态完整。
4. 设计规范一致性有验证结果。

## 证据要求
- 证据统一落盘到 `.uap/evidence/`，索引写入 `.uap/reports/EVIDENCE-INDEX.md`；证据 ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EVD')` 生成稳定唯一 ID（格式 `UAP-EVD-<时间戳>-<随机>`），禁止与历史证据复用；落盘使用 `writeEvidence()` / `appendJSONL()`。
- 每条证据必须记录：执行命令原文（如 `cd web && bun run typecheck`、`bun run lint:design:strict`、`bun run test:visual`、`bun run build:check`、`./scripts/verify-all.sh`）、`exit_code`、开始/结束时间（ISO 8601，由 `nowISO()` 生成）、环境（取自 `.uap/state/BASELINE.json` 的 `toolchain`：Go `go1.27.4` / Node `v22.22.2` / Bun `1.4.2`）、输入（`task_id` / `specification_ids` / `scope` / `constraints`）、输出（`executorResult` 或 `validatorResult` 全文）以及日志引用路径（如 `VISUAL_AUDIT_REPORT`、`web/e2e/visual/` 快照路径）。
- 验证结果由 `contract.mjs` 的 `validatorResult()` 归一化为 `{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；`PASS` 仅在 `executed=true && exit_code=0` 且 findings 无 `severity=BLOCKER` 时成立；视觉 track 的 `BLOCKED` / `NOT_EXECUTED` 必须原样记录，不得改写为 PASS。
- 报告必须能经 `evidence_refs` 反查到 `.uap/evidence/` 下的原始记录，并满足 `AGENTS.md` Verification Evidence 的四项要求（命令可复制、退出码与 pass/fail 计数、变更文件按路径、已知失败或跳过不省略）；`validator-registry.yaml` 的 `fail_if_evidence_missing: true` 强制证据存在。
- **证据不可覆盖**：新结果写入新证据文件，禁止覆盖历史记录；`execution.persist_task_state: true` 保证状态持久化。**失败证据不可删除**：BLOCKED / FAILED / NOT_EXECUTED / 视觉 `BLOCKED` 的证据必须保留，禁止以删除失败证据或删除失败测试制造通过结果；状态迁移受 `TASK_TRANSITIONS` 约束。

## 依赖标准
- **UAP-01-001（产品需求工程规范）**：`.uap/config/specification-registry.yaml` 中 `UAP-07-001` 的 `dependencies: [UAP-01-001]`。它为每个产品功能提供唯一 Feature ID、目标用户/场景/业务价值/验收标准与 Feature Registry，使 Web 功能与页面可追溯到需求来源，并支撑「Web 功能必须与产品需求对应」与「关键业务流程必须有自动化测试」的验收判定；无该依赖则本规范的需求对应与验收标准无法机器化。
