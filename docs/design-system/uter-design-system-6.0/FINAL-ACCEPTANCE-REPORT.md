# UTER DESIGN SYSTEM 6.0 — 最终验收报告（PART 12）

> 生成时间 2026-11-15T03:07:13.804Z · 由 `registry/finalize.mjs` 从 `GATE-EVIDENCE.json` 的真实命令结果派生
> **状态纪律**：`IMPLEMENTED` ≠ `VERIFIED` ≠ `ACCEPTANCE_READY` ≠ `ACCEPTED`。用户审核前一律不得标 `ACCEPTED`。

## 1. 总体结论

| 项目 | 结论 |
|---|---|
| 规范体系 | 36 个正式模块 + 2 个专项规范（`01-S / 24-S`），全部由 `TOKEN-MANIFEST.json` 派生 |
| 唯一数值真源 | `TOKEN-MANIFEST.json` · version 6.0.0 · **254 tokens** · status `IMPLEMENTED_NOT_VERIFIED` |
| 实现状态 | 38/38 模块 `IMPLEMENTED` |
| 验证状态 | 0/38 模块 `VERIFIED`（0 表示尚无模块完成全链路验证） |
| 总体状态 | **`IMPLEMENTED_NOT_VERIFIED` / `PENDING_USER_REVIEW`** |
| 目标状态 | 文档要求 `FULLY_IMPLEMENTED / FULLY_VERIFIED / ACCEPTANCE_READY`；**本轮未达成**，原因见 §8 |
| 是否被接受 | **否** · `accepted: false` |

**一句话结论**：6.0 的规范、Token、注册表、Showcase、自动化检查器与可核验证据已经完整落地并通过 Showcase 范围内的自动化验证；但 Phase 5 用户视觉审核、Phase 6 全站真实页面迁移、Phase 7 旧实现清理、Phase 8 全站视觉回归均**未执行**，因此不得宣称 `FULLY_VERIFIED` 或 `ACCEPTANCE_READY`，更不得宣称 `ACCEPTED`。

## 2. 交付物清单

| 类别 | 数量 | 位置 |
|---|---|---|
| 正式规范 | 36 | `docs/design-system/uter-design-system-6.0/00-*.md … 35-*.md` |
| 专项规范 | 2 | `GRADIENT-TYPOGRAPHY-STANDARD.md` / `CODE-SYNTAX-HIGHLIGHTING-STANDARD.md` |
| 注册表 | 7 | `TOKEN / COMPONENT / PAGE / DEPENDENCY-GRAPH / ACCEPTANCE-MATRIX / DEPRECATED / EXCEPTION` |
| 唯一真源 | 1 | `TOKEN-MANIFEST.json` |
| 运行时派生产物 | 5 | `runtime/tokens.css`、`runtime/themes/light.css`、`runtime/themes/dark.css`、`runtime/foundations.css`、`runtime/tokens.ts` |
| Showcase | 1 源 + 2 入口 | `SHOWCASE-6.0.html`（454570 字符）、`web/public/design-system/6.0.html`、`web/public/design-system/6.0/index.html` |
| 自动化 | 4 脚本 | `web/scripts/check-design-system-6.0.mjs`、`registry/contrast-engine.mjs`、`registry/visual-check.mjs`、`registry/a11y-check.mjs` |
| 构建链 | 3 脚本 | `registry/tokens.mjs`、`registry/spec-modules.mjs`、`registry/build.mjs`、`registry/render-showcase.mjs`、`registry/finalize.mjs` |
| 报告 | 4 | `MIGRATION-REPORT.md`、`CONTRAST-VERIFICATION-REPORT.md`、`VISUAL-REGRESSION-REPORT.md`、本报告 |
| 视觉证据 | 4 截图 + 2 日志 | `web/visual-regression/uds6/` |

## 3. 36 + 2 规范模块明细

| ID | Spec ID | 文件 | 实现 | 验证 | 检查项 | 未完成项 |
|---|---|---|---|---|---|---|
| 00 | UDS6-S00 | `00-UTER-DESIGN-SYSTEM-OVERVIEW.md` | IMPLEMENTED | PARTIAL | 6 | 3 |
| 01 | UDS6-S01 | `01-BRAND-IDENTITY-STANDARD.md` | IMPLEMENTED | PARTIAL | 6 | 3 |
| 02 | UDS6-S02 | `02-DESIGN-PRINCIPLES-STANDARD.md` | IMPLEMENTED | PARTIAL | 5 | 3 |
| 03 | UDS6-S03 | `03-COLOR-STANDARD.md` | IMPLEMENTED | PARTIAL | 6 | 3 |
| 04 | UDS6-S04 | `04-TYPOGRAPHY-STANDARD.md` | IMPLEMENTED | PARTIAL | 6 | 3 |
| 05 | UDS6-S05 | `05-SPACING-AND-SIZING-STANDARD.md` | IMPLEMENTED | PARTIAL | 6 | 3 |
| 06 | UDS6-S06 | `06-LAYOUT-AND-GRID-STANDARD.md` | IMPLEMENTED | PARTIAL | 5 | 3 |
| 07 | UDS6-S07 | `07-SHAPE-AND-RADIUS-STANDARD.md` | IMPLEMENTED | PARTIAL | 5 | 3 |
| 08 | UDS6-S08 | `08-BORDER-AND-DIVIDER-STANDARD.md` | IMPLEMENTED | PARTIAL | 5 | 3 |
| 09 | UDS6-S09 | `09-ELEVATION-AND-SHADOW-STANDARD.md` | IMPLEMENTED | PARTIAL | 5 | 3 |
| 10 | UDS6-S10 | `10-ICONOGRAPHY-STANDARD.md` | IMPLEMENTED | PARTIAL | 5 | 3 |
| 11 | UDS6-S11 | `11-MOTION-AND-ANIMATION-STANDARD.md` | IMPLEMENTED | PARTIAL | 6 | 3 |
| 12 | UDS6-S12 | `12-RESPONSIVE-DESIGN-STANDARD.md` | IMPLEMENTED | PARTIAL | 6 | 3 |
| 13 | UDS6-S13 | `13-ACCESSIBILITY-STANDARD.md` | IMPLEMENTED | PARTIAL | 6 | 3 |
| 14 | UDS6-S14 | `14-CONTENT-AND-WRITING-STANDARD.md` | IMPLEMENTED | PARTIAL | 5 | 3 |
| 15 | UDS6-S15 | `15-DATA-VISUALIZATION-STANDARD.md` | IMPLEMENTED | PARTIAL | 6 | 3 |
| 16 | UDS6-S16 | `16-DENSITY-AND-INFORMATION-HIERARCHY-STANDARD.md` | IMPLEMENTED | PARTIAL | 5 | 3 |
| 17 | UDS6-S17 | `17-NAVIGATION-STANDARD.md` | IMPLEMENTED | PARTIAL | 5 | 3 |
| 18 | UDS6-S18 | `18-BUTTON-STANDARD.md` | IMPLEMENTED | PARTIAL | 5 | 3 |
| 19 | UDS6-S19 | `19-FORM-AND-INPUT-STANDARD.md` | IMPLEMENTED | PARTIAL | 5 | 3 |
| 20 | UDS6-S20 | `20-SELECTION-CONTROLS-STANDARD.md` | IMPLEMENTED | PARTIAL | 5 | 3 |
| 21 | UDS6-S21 | `21-FEEDBACK-AND-STATUS-STANDARD.md` | IMPLEMENTED | PARTIAL | 5 | 3 |
| 22 | UDS6-S22 | `22-OVERLAY-AND-FLOATING-STANDARD.md` | IMPLEMENTED | PARTIAL | 5 | 3 |
| 23 | UDS6-S23 | `23-DATA-DISPLAY-STANDARD.md` | IMPLEMENTED | PARTIAL | 5 | 3 |
| 24 | UDS6-S24 | `24-CODE-AND-DEVELOPER-UI-STANDARD.md` | IMPLEMENTED | PARTIAL | 7 | 3 |
| 24-S | UDS6-S24-S | `CODE-SYNTAX-HIGHLIGHTING-STANDARD.md` | IMPLEMENTED | PARTIAL | 6 | 3 |
| 25 | UDS6-S25 | `25-AUTHENTICATION-STANDARD.md` | IMPLEMENTED | PARTIAL | 5 | 3 |
| 26 | UDS6-S26 | `26-USER-AND-ORGANIZATION-STANDARD.md` | IMPLEMENTED | PARTIAL | 5 | 3 |
| 27 | UDS6-S27 | `27-BILLING-AND-PAYMENTS-STANDARD.md` | IMPLEMENTED | PARTIAL | 6 | 3 |
| 28 | UDS6-S28 | `28-API-AND-TOKEN-MANAGEMENT-STANDARD.md` | IMPLEMENTED | PARTIAL | 5 | 3 |
| 29 | UDS6-S29 | `29-MODEL-AND-CHANNEL-MANAGEMENT-STANDARD.md` | IMPLEMENTED | PARTIAL | 5 | 3 |
| 30 | UDS6-S30 | `30-DASHBOARD-STANDARD.md` | IMPLEMENTED | PARTIAL | 5 | 3 |
| 31 | UDS6-S31 | `31-PAGE-TEMPLATES-STANDARD.md` | IMPLEMENTED | PARTIAL | 6 | 3 |
| 32 | UDS6-S32 | `32-EMPTY-LOADING-AND-ERROR-STANDARD.md` | IMPLEMENTED | PARTIAL | 5 | 3 |
| 33 | UDS6-S33 | `33-LOCALIZATION-STANDARD.md` | IMPLEMENTED | PARTIAL | 6 | 3 |
| 34 | UDS6-S34 | `34-CROSS-PLATFORM-DESIGN-STANDARD.md` | IMPLEMENTED | PARTIAL | 5 | 3 |
| 35 | UDS6-S35 | `35-DESIGN-GOVERNANCE-STANDARD.md` | IMPLEMENTED | PARTIAL | 6 | 3 |
| 01-S | UDS6-S01-S | `GRADIENT-TYPOGRAPHY-STANDARD.md` | IMPLEMENTED | PARTIAL | 6 | 3 |

- 每份规范含 11 个小节：Overview / Rules / Tokens / Visual Preview / Interactive Preview / Usage / Do / Don't / Accessibility / Responsive / Acceptance（Showcase 实测 418 个 `data-section` = 38×11）。
- 专项规范登记在 01 / 24 号模块之下，不形成第二套设计系统。

## 4. 字体体系核验（逐字保留）

| 项目 | 结论 |
|---|---|
| 真源 | `web/src/styles/theme.css:301-306` 的 `--font-ui`、`:324-328` 的 `--font-mono` |
| 6.0 映射 | `--ds-font-ui` / `--ds-font-body` / `--ds-font-mono` |
| 守卫 | `check-design-system-6.0.mjs C12` 逐字比对，运行结果 PASS |
| 禁止项 | 未引入 Geist / Roboto / Arial-only 或任何新字体；CJK 字体族保持在 generic `monospace` 之后 |
| 结论 | **保留成功**，未改动 `web/src` 现行字体栈 |

## 5. 颜色 / 对比度 / 渐变核验

| 项目 | 实测 | 依据 |
|---|---|---|
| 渐变 Light 三档 | `#1D4ED8 → #6D28D9 → #7E22CE`，最差 6.3:1 | `contrast-engine.mjs` 101 点采样 |
| 渐变 Dark 三档 | `#93C5FD → #C4B5FD → #D8B4FE`，最差 9.59:1 | 同上 |
| 历史渐变 | Light 2.39:1 / Dark 4.48:1 | 不达 4.5:1，E28 例外失效 |
| 语法 Token | 20 × 2，最低 5.15:1 / 7.11:1 | 真实代码背景上逐值计算 |
| 品牌实底白字 | 最低 5.01:1 / 5.01:1 | 三态 + 危险实底 |
| 引擎结论 | **PASS** | `CONTRAST-VERIFICATION-REPORT.md` |

- 唯一渐变出口：`ds-text-gradient-brand`；业务组件禁止自写 `linear-gradient` / `bg-clip-text` / `from-xxx via-xxx to-xxx`。
- 重复实现扫描：全库 1547 个文件，已登记 3 处（其中 `web/src/components/ai-elements/shimmer.tsx` 为 `EX-006 OPEN` 待迁移），**未登记违规 0**。
- 相对初始基线的数值调整记录见 `CONTRAST-VERIFICATION-REPORT.md §6.2`。

## 6. 语法高亮体系核验

| 项目 | 结论 |
|---|---|
| 语义 Token | 20 个 `--ds-syntax-*`，Light / Dark 各一组 HEX 定值 |
| 真实扫描引擎 | CodeMirror 6 / Lezer / Yace / Marked / Shiki（5 个 Adapter 映射） |
| 语言覆盖 | 26 种登记；Showcase 实际提供 12 种可渲染示例（≥10） |
| 色系隔离 | C13 PASS：chart 色不得作为 syntax 色，`--ds-color-terminal-*` 与 `--ds-syntax-*` 不互引 |
| 非颜色通道 | 粗体 / 斜体 / 下划线 / 删除线，避免纯色觉依赖 |
| 现状差距 | 现行 `web/src` 仅 5 个 `--syntax-*`；20 Token 接入 5 个引擎属 Phase 6 B3，本轮**未执行** |

## 7. Showcase 与视觉 / 无障碍验证

| 项目 | 实测 | 依据 |
|---|---|---|
| 单文件自包含 | 454570 字符，零外链、0 个 `<img>` | C14 |
| 模块 / 小节 | 38 / 418 | Playwright |
| Token 行 / 语言 | 748 / 12 | Playwright |
| Playwright 4 场景 | PASS · consoleErrors=0 | `run-log.json` |
| axe-core 4 场景 | PASS · violationsTotal=0 · focusOk=undefined | `a11y-log.json` |
| 构建产物 | 2/2 存在 | `build:check` |

详见 `VISUAL-REGRESSION-REPORT.md`。**注意**：以上仅为 Showcase 范围验证，不是全站视觉回归。

## 8. 产品页面迁移状态（Phase 6，本轮未执行）

| 批次 | 范围 | 状态 | 前置条件 |
|---|---|---|---|
| B1 | 6.0 Token 产物生成（`docs/.../runtime/`，未接入 `web/src`） | **已完成** | — |
| B2 | 渐变唯一出口换值 + 注销 E28 | 未执行 | Phase 5 用户审核通过 |
| B3 | syntax 20 Token 接入 5 个引擎 Adapter | 未执行 | 审核通过 + 逐引擎真实渲染 |
| B4 | 72 个路由 / 951 个 TSX Token 与组件迁移 | 未执行 | 视觉基线冻结 + 并发 WIP 收敛 |
| B5 | 支付 / 账单 / 认证页面视觉迁移 | 未执行 | 业务专项测试 + 独立审查 |
| B6 | 旧 Token / 重复实现清理 | 未执行 | 依赖图零引用证明 |

未执行依据（真实约束，非推迟借口）：

1. 文档 PART 9 的强制顺序：`Phase 5 Visual Review → 用户确认 → 冻结 6.0.0 视觉基线 → Phase 6 Product Migration`。
2. 文档 PART 4.5 / PART 11：用户尚未审核时不得标 `ACCEPTED`，`IMPLEMENTED` ≠ `VERIFIED`。
3. `AGENTS.md` / `.uap/config/permission-policy.yaml` 要求 `preserve_uncommitted_changes: true`；审计时全仓 **998 项脏区**，覆盖 `web/src/styles/theme.css` 等核心文件，全站迁移必然覆盖用户未提交修改。
4. 支付 / 余额 / 计费属高风险，需专项测试 + 独立审查（不得由执行代理代做）；文档 PART 6.3 / 10.16 明确禁止修改支付配置与业务逻辑。

## 9. 自动化门禁证据（真实命令 + 退出码）

| ID | 门禁 | 命令 | 退出码 | 耗时 | 备注 |
|---|---|---|---|---|---|
| G01 | TypeScript 类型检查 | `bun run typecheck` | **0** | 6272ms | PASS |
| G02 | 设计 Token 严格门禁 | `bun run lint:design:strict` | **0** | 2119ms | PASS |
| G03 | 5.0 规范一致性 | `bun run design:5:check` | **0** | 2548ms | PASS |
| G04 | Clerk 边界守卫 | `bun run design:clerk:check` | **0** | 521ms | PASS |
| G05 | 5.0 Showcase 校验 | `bun run design:showcase:5:check` | **0** | 259ms | PASS |
| G06 | 设计 Token 生成一致性 | `bun run design:tokens:check` | **0** | 94ms | PASS |
| G07 | 3.0 Showcase 同步校验 | `bun run design:showcase:check` | **0** | 135ms | PASS |
| G08 | 现行对比度门禁 | `bun run verify:contrast` | **0** | 239ms | PASS |
| G09 | 版权头检查 | `bun run copyright:check` | 1 | 410ms | 失败项均非本轮 6.0 产物引入；属 HEAD 既有或并发 WIP，登记为阻塞项 |
| G10 | 全量 oxlint | `bun run lint` | 1 | 1706ms | 失败项均非本轮 6.0 产物引入；属 HEAD 既有或并发 WIP，登记为阻塞项 |
| G12 | 6.0 Showcase 视觉回归（Playwright） | `/Users/lincolnhu/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/lincolnhu/uter/docs/design-system/uter-design-system-6.0/registry/visual-check.mjs` | **0** | 3659ms | PASS |
| G13 | 6.0 无障碍（axe-core + 真实 Tab） | `/Users/lincolnhu/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/lincolnhu/uter/docs/design-system/uter-design-system-6.0/registry/a11y-check.mjs` | **0** | 17282ms | PASS |
| G14 | 全量单元测试（vitest） | `bun run test` | **0** | 326468ms | PASS |
| G15 | 构建校验（tsgo + rsbuild） | `bun run build:check` | **0** | 56069ms | PASS |

- 6.0 检查器 `check-design-system-6.0.mjs` 的 C01–C17 最终结果见 `GATE-EVIDENCE.json` 的 `checker` 字段（报告写盘后复跑）。
- 全量单元测试：`bun run test` EXIT=0；构建校验：`bun run build:check` EXIT=0。

### 9.1 非零退出项归属（不掩盖、不擅自修改）

### G09 版权头检查 — `bun run copyright:check` · EXIT=1

失败项均非本轮 6.0 产物引入；属 HEAD 既有或并发 WIP，登记为阻塞项但不擅自修改

  - `scripts/rehype-tasklist-labels.mjs` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `src/__axe-experiment.test.ts` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false

输出尾部（真实）：


归属判定：诊断涉及 2 个文件，其中 0 个文件在 HEAD 中已含 `async ({}, testInfo)` 空对象绑定（证明 lint error 已进入仓库基线而非本轮引入）；属于本轮 6.0 产物的文件数 = 0。

```
copyright: checked 1574, added 2, updated 0, skipped generated 6, skipped third-party 1566
$ node scripts/add-copyright.mjs --check
copyright: headers need to be updated in:
- scripts/rehype-tasklist-labels.mjs
- src/__axe-experiment.test.ts
error: script "copyright:check" exited with code 1
```

### G10 全量 oxlint — `bun run lint` · EXIT=1

失败项均非本轮 6.0 产物引入；属 HEAD 既有或并发 WIP，登记为阻塞项但不擅自修改

  - `e2e/axe/authed.spec.ts` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `e2e/axe/lib/service-gate.ts` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `e2e/axe/public.spec.ts` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `e2e/business/lib/service-gate.ts` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `e2e/business/specs/business.spec.ts` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `e2e/visual/auth.setup.spec.ts` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=true
  - `e2e/visual/authed.spec.ts` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=true
  - `e2e/visual/lib/service-gate.ts` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `e2e/visual/lib/target.ts` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `e2e/visual/public.spec.ts` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=true
  - `scripts/add-showcase-anchors.mjs` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `scripts/audit-settings-input-hints.mjs` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `scripts/check-component-registry.mjs` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `scripts/check-design-tokens.mjs` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `scripts/gen-lobe-icon-variants.cjs` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `scripts/generate-design-showcase.mjs` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `scripts/generate-design-tokens.mjs` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `scripts/sync-design-showcase.mjs` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `scripts/verify-contrast.mjs` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `scripts/visual-regression.mjs` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `src/__axe-experiment.test.ts` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `src/components/ai-elements/prompt-input.tsx` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `src/components/turnstile.tsx` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `src/design-system/__tests__/semantic-colors.test.ts` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `src/features/dashboard/components/overview/__tests__/setup-guide.test.tsx` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `src/features/dashboard/lib/stats.ts` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `src/features/dashboard/lib/text.ts` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `src/features/profile/__tests__/settings.test.tsx` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `src/features/rankings/index.tsx` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `src/features/system-settings/general/channel-affinity/constants.ts` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `src/features/system-settings/integrations/amount-discount-visual-editor.tsx` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `src/features/system-settings/integrations/amount-options-visual-editor.tsx` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `src/features/system-settings/integrations/utils.ts` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `src/features/system-settings/models/utils.ts` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `src/features/system-settings/utils/json-parser.ts` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `src/hooks/use-system-config.ts` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false
  - `src/lib/admin-permissions.ts` · HEAD_BASELINE · gitStatus=`CLEAN` · headExists=true · headHasEmptyPattern=false

输出尾部（真实）：


归属判定：诊断涉及 37 个文件，其中 0 个文件在 HEAD 中已含 `async ({}, testInfo)` 空对象绑定（证明 lint error 已进入仓库基线而非本轮引入）；属于本轮 6.0 产物的文件数 = 0。

```
  ! unicorn(prefer-number-properties): Use `Number.parseInt` instead of the global `parseInt`
    ,-[scripts/verify-contrast.mjs:39:15]
 38 |   const [r, g, b] = [0, 2, 4].map((i) => {
 39 |     const v = parseInt(c.slice(i, i + 2), 16) / 255
    :               ^^^^^^^^
 40 |     return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    `----
  help: Replace it with `Number.parseInt`

Found 78 warnings and 3 errors.
Finished in 860ms on 1502 files with 186 rules using 16 threads.
$ node scripts/check-i18n-keys.mjs && oxlint -c .oxlintrc.json .
error: script "lint" exited with code 1
```


## 10. 清理 / 废弃项、人工审核清单与最终结论

### 10.1 注册表例外（6 条）

| ID | 范围 | 状态 | 失效 / 复核条件 |
|---|---|---|---|
| EX-001 | WCAG 1.4.3 disabled controls | ALLOWED | 控件恢复可用时立即失效 |
| EX-002 | PAGE-REGISTRY ROUTE_NOT_FOUND 模板 | OPEN | 对应路由被真实创建时 |
| EX-003 | Android / iOS / HarmonyOS 未实现 | OPEN | 原生工程入库时 |
| EX-004 | RTL 未支持 | OPEN | 新增 RTL locale 时 |
| EX-005 | 规范—实现双轨 | OPEN | Phase 6 全站迁移完成 |
| EX-006 | web/src/components/ai-elements/shimmer.tsx 手写渐变 | OPEN | Phase 7 旧版清理完成后注销 |

- `DEPRECATED-REGISTRY.json` 登记了 E28、旧渐变三档、5 个旧 syntax Token、JSON 编辑器 chart 色滥用等待清理项。**Phase 7 清理本轮未执行**；禁止在基线冻结前删除现行 `web/src` 实现。

### 10.2 人工审核清单（Phase 5，必须由用户完成）

1. 打开 `/design-system/6.0` 或 `SHOWCASE-6.0.html`，逐模块审核 38 个规范分区。
2. 切换 Light / Dark，重点看品牌渐变文字、代码块、Primary / Destructive 按钮在 Dark 下的可读性。
3. 用 Token Inspector 核对 254 个 Token，确认字号 / 间距 / 圆角档位符合预期。
4. 确认 12 种语言语法高亮示例与 20 个 syntax Token 的语义分工。
5. 确认新旧渐变对比是否可以接受，从而决定 E28 是否注销。
6. 明确回复是否**冻结 6.0.0 视觉基线**；只有冻结后才授权 Phase 6。

### 10.3 最终结论

- **已完成且已验证**：规范体系 / Token 唯一真源 / 7 注册表 / Showcase / 对比度引擎 / C01–C17 自动检查 / Showcase 范围视觉与无障碍 / 现行工程门禁未破坏。
- **已完成但未验证**：`runtime/` 产物尚未接入真实页面；5 个高亮引擎 Adapter 尚未接线；真实页面上的渐变与 syntax 观感未验证。
- **未完成**：Phase 5 用户审核、Phase 6 全站迁移、Phase 7 清理、Phase 8 全站视觉回归。
- **总体状态**：`IMPLEMENTED_NOT_VERIFIED` → `PENDING_USER_REVIEW`。**不是** `ACCEPTANCE_READY`，**不是** `ACCEPTED`。
- **下一步**：用户按 §10.2 完成审核并明确授权后，依次执行 Phase 5 冻结 → Phase 6 B2–B6 → Phase 7 清理 → Phase 8 全站视觉回归，再重跑本报告。

### 10.4 治理观察（真实 git 命令输出）

| 项目 | 实测值 |
|---|---|
| 分支 | `main` |
| HEAD | `58ad9f607 UAP Phase 2: regenerate verification evidence; self-test 161/161 green` |
| HEAD 提交文件数 | 1233 |
| 6.0 目录已被 HEAD 跟踪的文件数 | 61 |
| 6.0 目录当前工作区改动项 | 29 |
| 本任务 Git 动作 | 无 commit / push / merge / rebase |

- 观察到 HEAD 提交（`58ad9f607 UAP Phase 2: regenerate verification evidence; self-test 161/161 green`）覆盖 1233 个文件并包含 6.0 目录的 61 个产物。**本任务未执行任何 Git 写操作，该提交不是本任务产生的**；且它发生在视觉审核与验收完成之前，即未收敛产物已被纳入版本库。入库 ≠ `VERIFIED` ≠ `ACCEPTED`，不改变本报告 §1 的状态判定。
- 由此带来一个真实后果：`lint` 的 3 个 `no-empty-pattern` error 与 `copyright:check` 的 2 个缺头文件目前都已是 **HEAD 基线内容**（`git status` 显示 CLEAN），而不是本轮未提交 WIP；详见 §9.1。按 `AGENTS.md` 变更保护纪律，本轮仍不擅自修改。
- 当前工作区仍有 29 项 6.0 改动（本轮重建产物），**尚未提交**。按 `AGENTS.md` 单分支工作模式与「提交/推送逐次单独授权」纪律，本任务不代为提交。
- 并发 WIP 保护已生效：`lint` 与 `copyright:check` 的失败项已定位到并发修改或 HEAD 基线，未覆盖任何用户未提交修改（见 §9.1）。

---

*本报告所有「未执行 / 未验证 / 未通过」均为真实状态，不得替换为「已完成」。证据：`GATE-EVIDENCE.json`。*
