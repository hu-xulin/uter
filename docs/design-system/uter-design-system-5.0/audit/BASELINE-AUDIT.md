# BASELINE-AUDIT — UTER Design System 5.0 基线审计

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-AUDIT-01` |
| 版本 | `5.0.0-draft` |
| 状态 | `IMPLEMENTED`（审计报告本身已完成；其结论中未验证项见 §14） |
| 审计日期 | 2026-11-14 (GMT+8) |
| 审计对象 | `/Users/lincolnhu/uter` |
| 分支 / HEAD | `main` / `d83e81f3e` |
| 审计方式 | 只读：文件读取、静态统计、只读模式门禁脚本；**未修改任何被审计的业务代码** |
| 上游依据 | `AGENTS.md`、`CLAUDE.md`、`web/AGENTS.md`、`.uap/README.md`、`.uap/config/*.yaml`、`docs/design-system/UTER-DESIGN-SYSTEM-3.0.md`、`.github/workflows/ci.yml` |

---

## 1. 变更保护与并发 WIP（前置事实）

审计开始时 `git status --short` 为 **42 项脏区**；审计过程中并发的 UAP 会话持续写入 `.uap/evidence/`，复查时增至 **211 项（51 `M` + 160 `??`）**，其中 **152 项未跟踪文件位于 `.uap/`**。

结论与处置：

1. 这些改动**全部属于其他会话的 WIP**，本次工作不读取其内容作为依据、不暂存、不提交、不覆盖。
2. 明确列出与本次工作直接冲突、因此**禁止改动**的已脏文件：
   - `web/src/styles/theme.css`
   - `web/src/components/layout/components/system-brand.tsx`
   - `web/src/components/quota-details-popover.tsx`
   - `web/src/components/search.tsx`
   - `web/src/features/keys/components/api-keys-cells.tsx`
   - `web/e2e/visual/*`（6 个文件）
   - `.uap/**`（全部）
3. 因存在并发 WIP，按项目约定（`MEMORY-detail.md`「本地构建」条）**不执行全量构建**（`./rebuild-all.sh`、`bun run build:check`、`./scripts/verify-all.sh`），改用只读门禁验证。此约束在最终报告中标为 `NOT_EXECUTED`，不得伪装为 PASS。
4. 本次工作不创建分支、不切换分支、不推送、不合并（`AGENTS.md` §2 / `.uap/config/permission-policy.yaml`：`branch_creation` / `branch_switch` / `force_push` / `destructive_git` 均为 `deny`）。

---

## 2. 项目实际结构（不得假设）

| 项 | 实际值 | 证据 |
|---|---|---|
| 前端包管理 | Bun（`bun.lock` 存在） | `web/package.json`、`web/bun.lock` |
| 框架 | React `^19.2.7` + TypeScript + Rsbuild `^2.1.4` | `web/package.json:83,111` |
| 路由 | `@tanstack/react-router ^1.170.17`，文件路由在 `web/src/routes/` | `web/AGENTS.md:145-147` |
| 状态 / 数据 | Zustand `^5`、TanStack Query `^5.101.2`、TanStack Table `^8.21.3`、axios | `web/package.json:61-63,104` |
| 样式 | **Tailwind CSS 4.3.3**（`package.json` 声明 `^4.3.2`，`bun.lock` 解析 4.3.3），Rsbuild Tailwind 插件 `^2.0.3` | `web/package.json:97,114` |
| UI 基础库 | `@base-ui/react ^1.6.0`；`class-variance-authority`、`clsx`、`tailwind-merge` | `web/package.json:50,68,70,96` |
| 图标 | `lucide-react ^1.23.0`、`react-icons ^5.7.0`、`@lobehub/icons ^5.10.1`；`web/AGENTS.md:20` 另提 Hugeicons（**package.json 中无该依赖，属过时描述**） | `web/package.json:78,88,60` |
| 字体 | `@fontsource-variable/inter ^5.3.0` + `@fontsource-variable/noto-sans-sc ^5.3.0` | `web/package.json:56-57` |
| 图表 | `@visactor/vchart ^2.1.2`、`@visactor/react-vchart ^2.1.2`、`recharts 3.9.1` | `web/package.json:64-65,91` |
| 表单 / 校验 | `react-hook-form ^7.91.0` + `zod 4.6.7` + `@hookform/resolvers` | `web/package.json:58,71,103` |
| 反馈 | `sonner ^2.0.7`；`cmdk ^1.1.1`；`vaul ^1.1.2`（Drawer） | `web/package.json:71,93,95` |
| i18n | i18next `^26.3.4`，7 份 locale，合计 **54,573 行** | `web/src/i18n/locales/{en,fr,ja,ru,vi,zh-TW,zh}.json` |
| 测试 | Vitest `^5.0.4`（jsdom）、Playwright `^1.64.1`、axe-core | `web/package.json:110,135,126` |
| Storybook | **不存在**：0 依赖、0 配置、0 `*.stories.*`、全仓 `storybook` 字面命中 0 | 全仓只读检索 |
| 组件展示 | `docs/design-system/showcase.html`（2,188 行 / 86,313 B），24 个区域，数据驱动自 §28 Manifest | `showcase.html:8-23,1342-1487,1718` |
| 后端 | Go 1.27.3 + Gin + GORM，SQLite / MySQL / PostgreSQL | `AGENTS.md:130-135` |
| 桌面端 | `electron/`（Electron `42.11.18`），加载同一 `web/dist` | `electron/package.json:2-29`、`electron/main.js:1` |

**字体基线核实结论**：用户指令中的「Inter + Source Han Sans」在代码中的落地是 `Inter Variable` + `Noto Sans SC Variable`。Noto Sans SC 与 Source Han Sans（思源黑体）为同一字体家族的 Adobe/Google 双发行版，字符覆盖一致；因此品牌基线**成立**，但规范文本必须写成实际包名，不得虚称引入了 `Source Han Sans` 字体文件。

---

## 3. UTER Design System 3.0 审计

| 项 | 值 |
|---|---|
| 唯一权威文件 | `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md`，**4,111 行 / 197,053 B**，2026-11-13 16:54 最后更新 |
| 章节 | §0 规范效力 → §28 Token Manifest，共 29 章；含 §19.5 T1–T17 静态扫描规则表、§26 例外台账、§28 机器可读声明 |
| Spec SSOT | §28.5 `TOKEN-MANIFEST`（`:3769-4094`，`version 3.0.1` / `updated 2026-11-13`） |
| Runtime SSOT | `web/src/design-system/tokens/` + `web/src/styles/theme.css` |
| 派生产物 | `docs/design-system/showcase.html` 内联快照 + `showcase.tokens.js`（1,241 行兼容回退） |
| 既有审计证据 | `docs/design-system/audit/evidence/` 共 16 个内容文件（2026-11-03 12:34–15:01），含逐路由 `05-pages.md`（194 行）与逐组件 `04-components.md`（141 行） |
| 证据时效 | ⚠️ 证据 mtime（11-03）早于 3.0 规范终版（11-13），**属基线快照，非 3.0 终版复核**，不得直接作为 5.0 验收依据 |

### 3.1 3.0 自身未闭合项（关键）

| 编号 | 位置 | 内容 | 5.0 处置 |
|---|---|---|---|
| §22 验收清单 | `:3179-3268` | **73 个 `- [ ]`，0 个 `- [x]`**，§22.1–22.5 全部未勾选 | 5.0 必须重新逐项给证据，不得继承「已完成」 |
| E24 残留缺陷 | `:3228`、`:3587` | 浅色溢价 **3.76:1**、深色折扣 **3.30:1** 低于 4.5:1；编号注销但缺陷须保持待修 | 列为 P1 无障碍缺陷，5.0 不得勾选通过 |
| E28 | `:3524-3532` | 首屏品牌渐变标题 2.54 / 2.72 / 3.96:1 为**有意例外**（B 类验收口径），不进 ALLOWLIST | 保留登记，5.0 明写例外边界 |
| P1 | `:4105`、`:4062` | Terminal ANSI 0–15 全色板未落地（早期 20 个 `...` 占位符） | 保留 Pending + 退出条件 |
| P2 | `:4106`、`:4063` | 图表 text/axis/label/grid 独立 Token 未定义 | 保留 Pending |
| P3 | `:4107`、`:4064` | 装饰层 `--ds-decor-*` 未纳入 `colors.decoration` | 保留 Pending |
| 字体轴 | `:2625-2628`、`:3340` | `data-theme-font`（system/sans/serif）未落地，代码锁 Inter + Noto Sans SC | 保留 Pending |
| PageHeader | `:3339` | §13.1 定义的 PageHeader **尚无独立组件**，页面按 §3+§6 组合 | 5.0 列为补齐候选 |
| 构建缺陷 | `web/src/design-system/foundations/typography.css:55-66` | 3 个纯别名 `--ds-color-text-primary` / `--ds-color-text-secondary` / `--ds-color-success-soft` 在生产构建压缩后消失；当前 `var(--x, fallback)` 兜底缓解，未根治 | 5.0 定位压缩器根因，不得永久保留双轨 |
| 组件证据 | `component-registry.json` | 65 个组件 `VERIFIED=0` / `PARTIAL=9` / `NOT_VERIFIED=56`；`--strict` **EXIT=1** | 5.0 最高优先缺口 |

**结论：3.0 是一份内容完整、门禁严格但「验收未闭合」的规范。** 因此 5.0 不能建立在「3.0 已 FULLY_VERIFIED」的假设上，必须把上述未闭合项显式继承为 5.0 的待办与风险。

---

## 4. Design Token 审计

### 4.1 数量与分层

| 文件 | 行数 | `--name:` 定义数 | 层 |
|---|---:|---:|---|
| `tokens/primitives.css` | 117 | 47 | L1 Primitive |
| `tokens/typography.css` | 196 | 76 | L1（`@theme` 字号阶梯，18 档 + 18 行高 + 4 字重） |
| `tokens/spacing.css` | 103 | 45 | L1（3 档密度覆盖） |
| `tokens/generated/brand.css` | 48 | 16 | L1（DTCG 生成，Light 8 + Dark 8） |
| `tokens/semantic.css` | 165 | 63 | L2 Semantic（`--ds-*`） |
| `tokens/colors.css` | 133 | 45 | L2 Semantic |
| `tokens/elevation.css` | 131 | 27 | L2 Semantic |
| `tokens/index.css` | 36 | 0 | 唯一入口（6 条 `@import`，顺序不可重排） |
| `foundations/*.css`（6 份） | 588 | 0 | L3 消费层（`@utility` / `@layer`） |
| **合计** | **1,518** | **319 处定义 / 245 个唯一变量名** | 三层单向：`组件 → --ds-* → --text-*` |

- Light/Dark：全局由 `web/src/styles/theme.css:19` 的 `@custom-variant dark (&:is(.dark *))` 与 `:590 .dark` 驱动；design-system 内部的 Dark 覆盖只有 `generated/brand.css`（8 色）与 `elevation.css`（2 档）。品牌渐变按 §17.5 深浅同值，禁止 `.dark` 覆盖。
- **Primitive / Semantic 已分离**（§19.5 T1 守唯一 `@theme` 来源，T8 守裸色值所有者），符合 5.0 PART 7 第 1–2 条，无需重建。
- `web/src/styles/theme.css` 与 `theme-presets.css` 之间有 **52 个同名变量**（基础 `:root` 声明 + 主题预设覆盖），属设计意图而非缺陷；但 `theme-presets.css` 对每套预设重抄整组，是 5.0 的合并候选。

### 4.2 `--text-*` 命名空间（与指令条款冲突，见 §9 D1）

`tokens/typography.css:68` 使用 `@theme { --text-sm: ...; --text-sm--line-height: ... }`。经 Tailwind CSS v4.3.3 与该文档 `:58-63` 的历史陷阱记录核实：**`--text-*` 是 v4 提供的自定义字号注册机制**（在 `@theme` 内声明即注册 `text-sm` 工具类并覆盖内置默认值），同时是运行时可读的 CSS 变量；写在 `:root` 才会导致工具类静默回退。

因此用户指令 `04. TYPOGRAPHY-STANDARD.md` 中「不得使用 Tailwind v4 保留的 `--text-*` 命名空间定义自有字体 Token」与项目实际机制、T1 门禁、`sync-design-showcase.mjs` 的 17 条校验、`tokens.test.ts` 的断言**相冲突**。5.0 的处置是 `Adapt`（详见 §9 D1），不是删除或照抄。

### 4.3 重复 / 未引用

- design-system 14 个 CSS **跨文件重复定义 = 0**；同一文件内多次定义 60 个（全部为分档覆盖：spacing 3 档、typography `simple-large`、brand Light/Dark、elevation Light/Dark）。
- 严格口径（`var()` / 字符串字面量 / Tailwind 任意值三者在 1,543 个 `.ts/.tsx/.css` 中均无命中）下约 **93 个变量零静态引用**，其中 `primitives.css:33-68` 的 `--primitive-font-size-*`(8) / `--primitive-line-*`(7) / `--primitive-space-*`(10) 共 25 个最明确；另含约 33 个 `--ds-color-*`、9 个 `--ds-radius-*`。
- ⚠️ 该数字是**候选清理上限，不是死代码结论**：`@theme` 变量由 `text-sm` 等工具类间接消费，语义色由 `bg-success-soft` 等 Tailwind 类消费，均不出现 `var()`。删除前必须按 §11 流程逐项验证构建产物。

### 4.4 Token 门禁实测（只读）

| 命令 | 结果 |
|---|---|
| `node web/scripts/check-design-tokens.mjs --strict` | 扫描 1,275 文件，违规 **0**，EXIT=0；浮层投影 20 处、Token 定义处色值 183 处（不计违规） |
| `node web/scripts/sync-design-showcase.mjs --check` | **17 PASS / 0 FAIL / 0 SKIP**，Manifest `3.0.1` 哈希自洽，EXIT=0 |
| `node web/scripts/verify-contrast.mjs` | **31 PASS / 0 FAIL**，EXIT=0（含 E28 渐变锚定与负例拒绝） |
| `node web/scripts/generate-design-tokens.mjs --check` | `Design token source and generated CSS are in sync.`，EXIT=0 |
| `web/design-tokens.baseline.json` | **0 条**，CI 用 `--strict`（§19.5「基线只减不增」） |

---

## 5. 组件体系审计

| 项 | 值 |
|---|---|
| `web/src/components/ui/*.tsx` | **66**（= 65 个实现 + 1 个 `dropdown-menu.test.tsx`） |
| `component-registry.json` | **65 条**，2,094 行，`registryVersion 1.0.0`，`designSystem "UTER Design System 3.0"` |
| 双向一致性 | `registered=65 / discovered=65 / errors=0`，**结构自洽** |
| 证据状态 | `VERIFIED 0` / `PARTIAL 9` / `NOT_VERIFIED 56` / `EXCEPTION 0`；`warnings=65`；`--strict` **EXIT=1** |
| 原生分类 | 11 类：`input 17 / overlay 9 / navigation 8 / layout 7 / data-display 7 / feedback 6 / form 5 / disclosure 2 / action 2 / utility 1 / content 1` |
| registry 字段 | 顶层仅 `id,name,file,category,status,contract`；`contract` 内 `states,accessibility,responsive,tokens,evidence` |
| **缺失字段**（相对 5.0 PART 3.4） | `layer / source / implementation_path / specification_path / test_path / story_path / variants / states(顶层) / accessibility(顶层) / deprecated / replacement` 全部缺失；`file` 承担实现路径，`evidence.tests[]` 承担测试路径 |
| 业务封装 | 7 个目录（`ai-elements / data-table / floating-window / json-code-editor / layout / model-group-selector / multi-select`）+ 7 个顶层 `.tsx`（`dialog / confirm-dialog / copy-button / empty-state / loading-state / error-state` + `data-table/`，后者 24 条公开导出） |
| README | 全仓仅 `web/src/components/data-table/README.md` 1 份 |
| **重复实现** | `EmptyState` 恰好同名 **3 处**：`components/empty-state.tsx:42`（正式）、`components/notification-popover.tsx:156`（局部）、`features/pricing/components/empty-state.tsx:29`（feature 内）；另有 4 个近似命名 `PlaygroundEmptyState` / `ConversationEmptyState` / `ChannelEditorLoadingState` / `CodeBlockCopyButton` |
| 65 vs 66 差异 | 唯一差异是平铺测试 `dropdown-menu.test.tsx`；schema `file` 正则不含点号、`check-component-registry.mjs:40` 显式排除测试文件 → **不是漏注册**，禁止补注册 |
| 已知缺陷 | `docs/design-system/audit/evidence/04-components.md:87-89` 记录 `ui/empty.tsx:95` 使用不存在的 `text-sm.5` 类 |

### 5.1 展示中心真实能力

`showcase.html` 是**浏览器真实 DOM 渲染**（0 个 `<img>`、0 处 `React`），数据全部来自 §28 Manifest 内联快照，具备 Light/Dark 与密度三档的**交互切换**、24 个区域渲染器。但：

- 尺寸（9 档）、Variant（6 档）、状态（7 态）均为**并排静态展示**，不可切换；
- `Props` 0 处、`UTER-CMP` 注册 ID 0 处、组件级无障碍要求 0 处、代码示例 0 处；
- **不是 `web/src/components/ui/*.tsx` 的 React 组件实例**（`web/src` 内无任何引用）；
- 无 React 路由级展示页（80 个路由文件中 0 个 showcase/design-system 路由）、无 Storybook；
- `add-showcase-anchors.mjs:49-218` 的 22 条锚点未覆盖区域 23 `breakpoints`、24 `token-layers`；
- `generate-design-showcase.mjs:25-29` 叙述的 `showcase-3.0.html` / `showcase-3.0.generated.html`：`showcase-3.0.html` 曾是真实像素基线文件，已于提交 `9a7234787` 删除、并由 `412f0a28b` 更名为 `showcase.html`（数据驱动展示页，禁止内联 `:root` Token 副本，见 3.0 §28.3）；其遗留引用在 `visual-regression.mjs` 与 `tokens.test.ts` 中，已于 5.0 收口阶段（2026-11-14）修正为 `showcase.html`。`showcase-3.0.generated.html` 由 `generate-design-showcase.mjs` 按需生成、不入库。故「两文件均不存在」应修正为「`showcase-3.0.html` 已退役更名、`showcase-3.0.generated.html` 按需生成」。

### 5.2 组件清单覆盖口径

用户指令 PART 3.3 的 A–N 清单共约 150 个名称。逐项核实后：

- Uter 的 `Button`（`ui/button.tsx:26-108` 的 `cva()`，6 variant × 9 size + 内置 `loading`）单一组件即覆盖 `PrimaryButton/SecondaryButton/OutlineButton/GhostButton/DestructiveButton/IconButton/LoadingButton` 等 ≥10 个名称；
- `Badge` 族、`Dialog` 族、`Sonner`、`Calendar+datetime-picker`、`Chart+recharts`、`Form/Field` 族、`data-table/` 24 导出均为同类聚合，**这些名称不需要独立实现**；
- `Typography`（`Heading`/`Text`）位于 `web/src/design-system/components/typography/`，不在 `ui/` 下；
- 真正建议补齐的约 8 项：`Transfer`、`ColorPicker`、`Timeline`、`Tree`、`VirtualTable`、`Image`、`Lightbox`、`Rate`；
- `ui/` 下 A Typography = 0、M Charts = 1、J DataTable = 1、K DateTime = 1、L Media = 2，且**无 Image/Video/Audio 组件**。

---

## 6. 页面与业务模块审计

| 项 | 值 |
|---|---|
| 路由源码 | **73 个**（`_authenticated 41` / `_public 13` / `(auth) 9` / `(errors) 5` / `__tests__ 2` / `oauth 1` / `setup 1` / `__root.tsx 1`） |
| feature 目录 | **30 个**（非 34）；最大 6 个：`system-settings 192`、`channels 117`、`usage-logs 80`、`pricing 69`、`playground 63`、`models 55` |
| 含 `__tests__` | 24 个；含 `components/` 21 个 |
| 单测 | `web/src` 下 `*.test.ts(x)` **288 个**，`__tests__` 目录 **75 个**，`vitest.config.ts:27-35` 自述历史基线 273 文件 / 2,927 用例 |
| E2E | `business` 1 spec / `visual` 3 spec + **44 张 PNG**（22 页 × 2 视口）/ `axe` 2 spec |
| 视觉基线覆盖 | 公开 13 页 + 鉴权 9 页；**未覆盖** `system-settings/*` 18 个路由、`*/$section` 动态段、`usage-logs/audit`、`oauth/$provider`、`setup`、`chat/$chatId` 等 |

### 6.1 业务模块 → 路由映射（PART 6 依据）

| 模块 | 路由 | 备注 |
|---|---|---|
| Dashboard / 统计 | `_authenticated/dashboard/{index,$section}.tsx` | `features/dashboard/lib/stats.ts`；`performance-metrics/` 无独立路由 |
| 用户管理 | `_authenticated/users/index.tsx` | `:45` `ROLE.ADMIN` |
| API Key | `_authenticated/keys/index.tsx` | `features/keys/` 33 文件 |
| 模型 / 渠道 | `_authenticated/models/{index,$section}.tsx`、`channels/index.tsx` | 管理员守卫 |
| 钱包 / 充值 / 支付 | `_authenticated/wallet/index.tsx`、`_public/recharge-agreement.tsx`、`system-settings/billing/*` | `features/wallet/` 40 文件 |
| **退款** | **无独立路由、无独立 refund 文件** | 全仓 17 处 `refund/退款` 均为消费日志/类型/设置字段 |
| **订单** | **无独立订单路由** | 账单历史为 `features/wallet/.../billing-history-dialog.tsx` 弹窗 |
| 消费记录 | `_authenticated/usage-logs/{index,$section,audit}.tsx` | `features/usage-logs/` 80 文件 |
| 价格 | `_public/pricing/{index,$modelId/index}.tsx` | `features/pricing` 69 + `model-pricing` 11 |
| 系统设置 | `_authenticated/system-settings/` **18 个文件**、9 个子域 | auth/billing/content/models/operations/request-policies/security/site |
| 权限 / 管理员 | 无独立路由，`ROLE.ADMIN` / `SUPER_ADMIN` 守卫散布在 11 个路由文件 | `features/users/components/__tests__/permissions.test.tsx` |

> **业务红线**：以上支付 / 充值 / 余额 / 退款 / 订单 / 认证 / 授权模块在 5.0 中**只允许改视觉与组件复用**，不得改 API 契约、资金逻辑、数据库结构或安全约束（用户 PART 0 原则 C、PART 15 第 10–13 条；`AGENTS.md` §4 / §5）。

---

## 7. 测试与 CI 审计

`.github/workflows/ci.yml` 的 `frontend` job（`:356-438`）已接入：

| 已接入 | 未接入 |
|---|---|
| `typecheck`(:387)、`test`(:390)、`lint`(:393)、`design:tokens:check`(:406)、`design:showcase:check`(:411)、`verify:contrast`(:414)、`lint:design:strict`(:417)、`test:visual`(:422)、`components:registry:check`(:427)、`copyright:check`(:434)、`build:check`(:438) | `test:axe`、`test:business:e2e`、`test:visual:e2e`、`components:registry:strict`、`format:check`（`:429-433` 明示刻意不设为必需，248 文件不合规）、`knip`、`i18n:sync` |

- `release-gate.yml:153-188` 仅 `typecheck/test/lint/lint:design:strict` 子集。
- `web/e2e/{axe,business,visual}/playwright.config.ts` 注释均明确「**刻意不接 CI**」（像素基线依赖本机字体渲染与 GPU 合成；需完整服务栈），故这三条轨只能开发机手动执行，不构成 CI 强制门禁。

---

## 8. 平台支持核实（决定最终状态的关键事实）

| 平台 | 真实实现 | 证据 |
|---|:--:|---|
| PC Web | ✅ | `web/` 完整工程，CI frontend job，desktop 1440×900 × 22 张基线 |
| H5 | ✅（同一套代码的响应式分支，非独立工程） | 3.0 §16（`:2255-2323`）断点 `sm640/md768/lg1024/xl1280/2xl1536`，mobile 390×844 × 22 张基线，`detectPayClient()` UA 判定 |
| Android | ❌ | 无 `android/`、无 `*.kt/.java`、无 Capacitor/Flutter/RN/uni-app |
| iOS | ❌ | 无 `ios/`、无 `*.swift/.m/.mm` |
| HarmonyOS | ❌ | 无 `harmony/`；仅 `web/src/features/wallet/lib/payment.ts:224` 的 UA 正则字面量 |
| Electron 桌面 | ✅（补充，不属上述 5 平台） | 复用同一 `web/dist` |

全仓 `*.kt / *.swift / *.java / *.m / *.mm` 计数 **0**。用户指令 PART 12.6 明确要求「如果某个平台目前没有真实实现或可用测试环境，必须标记为 `NOT_VERIFIED`，不能伪造 PASS」；PART 13 又要求「所有适用平台完成验证」才可 `FULLY_IMPLEMENTED_AND_VERIFIED`。**这两条与仓库事实构成不可消除的逻辑冲突**，见 §9 D4 与 §14。

---

## 9. 指令条款与仓库事实的冲突清单及决策

| ID | 指令条款 | 仓库事实 | 决策 | 理由 |
|---|---|---|---|---|
| **D1** | `04 TYPOGRAPHY`「不得使用 Tailwind v4 保留的 `--text-*` 命名空间定义自有字体 Token」 | v4.3.3 中 `@theme --text-*` 是**自定义字号注册机制**；T1 门禁、17 条 showcase 校验、`tokens.test.ts` 均依赖它；18 个工具类由此生成 | **Adapt** | 保留运行时 `@theme --text-*`；5.0 在规范层另立 `--ds-font-*` 语义别名用于文档与跨端映射，禁止删除 `@theme`（删除会使全站字号静默回退并打破门禁）。在 04 文档中记录该审计结论 |
| **D2** | 在 `docs/` 新建整套 5.0 规范目录 | `AGENTS.md:359`「不得在 `docs/` 新增文件，除非用户明确要求」 | **Adopt（例外）** | 用户 PART 2 / PART 15 第 2 条明确要求创建 `docs/design-system/uter-design-system-5.0/`，构成明确授权 |
| **D3** | 「若已有组件展示系统，优先扩展，不重复建设」 | 已有 `showcase.html`（24 区、真实 DOM、数据驱动）但无 React 实例 / Props / 注册 ID | **Adapt** | 扩展既有 showcase，不引入 Storybook（0 依赖、引入成本高于收益）；新增「规范 ↔ 代码 ↔ 注册 ID」双向关联面板 |
| **D4** | PART 12.6 要求 5 平台分别验证；PART 13 要求全平台通过方可 `FULLY_IMPLEMENTED_AND_VERIFIED` | Android/iOS/HarmonyOS **无任何实现** | **Reject（不可达）→ 如实标记** | 三平台必须标 `NOT_VERIFIED`；因此最终状态**不可能**为 `FULLY_IMPLEMENTED_AND_VERIFIED`，须按 PART 13「只要有一项未通过就不能宣布」报告实际状态 |
| **D5** | 「研究 Clerk Elements 的组件定制理念」 | 官方页标题为 **"Clerk Elements, Deprecated"**，Core 3（2026-03-03）起推荐 redesigned hooks | **Adapt** | 只借鉴「分层定制」理念（Themes → variables → BYO CSS → 自建 UI），**不引入、不描述为现行 API**；在参考分析中显式记录弃用事实 |
| **D6** | PART 7 建议 `tokens/*.ts` 目录结构 | 现有真源为 CSS + `@theme` + §28 Manifest 三层，TS 侧仅有 2 个「无法语义化」的收口文件 | **Adapt** | 以实际工程架构为准（PART 7 明文允许），不新建第二套 TS 值 Token（否则产生无法解释的重复 Token，违反 PART 7 第 8 条）；改为补「Token 元数据注册表 + 校验器」 |
| **D7** | 「规范、代码、组件、页面、测试必须一致」「全部组件已注册、全部页面完成适配」 | 3.0 自身 73 项验收未勾选；65 组件证据 0 VERIFIED；73 路由中仅 22 页有视觉基线 | **Adapt + 分期** | 建立完整注册表与差距台账；代码实施按「每处改动先写回归测试」的项目约定分期推进，不一次性批量重写全站 UI（会破坏 T1–T17 严格门禁与并发 WIP） |
| **D8** | 「不改变认证/授权/资金逻辑」 | 用户指令同时要求研究 Clerk 的 Authentication / User / Organization UI | **Adopt（严格边界）** | 仅参考视觉与信息架构，绝不引入 Clerk SDK、不替换 Uter 自建认证/组织/权限体系（PART 5 明文禁止） |

---

## 10. 设计不一致、兼容性与升级风险

| 类别 | 具体项 | 风险等级 |
|---|---|---|
| 设计不一致 | 3 处同名 `EmptyState`；4 个近似命名状态组件；`ui/empty.tsx` 与业务 `EmptyState` 并存 | P1 |
| 无障碍 | E24 两处对比度不达标（3.76:1 / 3.30:1）；E28 有意例外需持续登记 | P1 |
| 构建 | 3 个纯别名 `--ds-color-*` 生产构建被压缩丢弃，靠 `var(--x, fallback)` 缓解 | P1 |
| Token | 约 93 个零静态引用变量；`theme-presets.css` 52 个同名重抄；`showcase.tokens.js` 与内联快照双产物 | P2 |
| 组件 | 65 个组件证据全未 VERIFIED；registry 缺 8 类字段；`dropdown-menu.test.tsx` 平铺违反 `web/AGENTS.md:185` | P1 |
| 展示 | 无 Props / 注册 ID / 组件级 a11y / 代码示例 / React 路由展示页；2 个锚点缺失；2 个过时「不存在文件」注释 | P2 |
| 页面 | 73 路由中仅 22 页有视觉基线；`system-settings/*` 18 个路由无 E2E 覆盖 | P2 |
| 兼容性 | 并发 WIP 211 项；全量构建与 `./uap *` 命令会写入 `.uap/state/`，可能污染他人工作 | **P0（流程）** |
| 规范 | 3.0 与 5.0 并存期若引用不统一，会出现 3.0/5.0 混用 | P1 |
| 平台 | 3 个平台无实现，无法验收 | **P0（结论）** |

---

## 11. 保留 / 合并 / 重构 / 废弃决定

### 11.1 保留（Keep，经代码核实有效）

1. 品牌色全套（Light `#5B5EE6` / `#494CC7` / `#3F42B0`；Dark `#8B8DF5` / `#A1A3F7` / `#B7B8FA`），DTCG 真源 `source/brand.tokens.json`。
2. Inter Variable + Noto Sans SC Variable；正文 14/22、caption 12/18、长文本 16/26、最小 12px、H5 输入 ≥16px。
3. 4pt 间距、1px 边框、圆角七档、1px 焦点环、表面色差优先于重阴影。（注：本条为审计时点的 3.0 基线记录；5.0 已裁决纠正——圆角为 8 个命名档、焦点环为 2px `ring-2`，详见 `UDS5-S06` §2.1 / `UDS5-S13` §7）
4. 三层 Token 架构 + §28 Spec SSOT / Runtime SSOT / 派生产物，以及 17 条 showcase 一致性校验。
5. T1–T17 门禁、`ALLOWLIST=[]`、基线只减不增、`--strict` 作为 CI 唯一阻断模式。
6. 65 个 `ui/` 组件的单一实现根、`data-table/` 唯一表格业务封装、`component-registry.json` 双向一致性检查。
7. `brand-colors.ts`（T8 唯一裸色值所有者）与 `chart-typography.ts`（T4 TS 镜像）两个收口文件。
8. 3.0 全文作为**历史版本完整保留**，不删除、不改写。

### 11.2 合并（Merge）

1. 3 处同名 `EmptyState` → 统一到 `components/empty-state.tsx`，记录 feature 侧能力缺口。
2. `theme.css` / `theme-presets.css` 的 52 个同名基础调色板 → 单一 `:root` 基础层 + 预设只列差异键。
3. `tokens/typography.css`（值）与 `foundations/typography.css`（工具类）→ 在 5.0 补「L1 声明 ↔ L3 消费」机器可校验映射表。
4. `showcase.tokens.js` 兼容回退与内联快照 → 统一为「主交付=内联快照，回退=可选产物」，同步修改 17 条校验契约后方可变更。
5. 组件注册表的「契约 + 证据」模型 与 5.0 要求的「路径/文档/展示」模型 → 由生成式 YAML 投影合并，JSON 仍为唯一真源。

### 11.3 重构（Refactor）

1. 定位并根治 3 个纯别名在构建产物中消失的问题，移除临时兜底双轨。
2. 把 `dropdown-menu.test.tsx` 移入 `__tests__/` 并同步 `evidence.tests` 路径。
3. `showcase.html` 增加 Props / 注册 ID / 组件级 a11y / 状态切换面板；补齐区域 23、24 锚点；清理 2 个不存在文件的过时注释。
4. `component-registry.json` 的 `designSystem` 由 `3.0` 升级为 `5.0` 并同步 `check-component-registry.mjs:45` 的硬编码校验（**必须在同一变更内完成，否则门禁失败**）。

### 11.4 废弃（Deprecate，须先补证据，本轮不执行删除）

1. 约 93 个零静态引用 Token 中的 `primitives.css` 字号/行高/间距三组（25 个）——列候选，不删除。
2. 3.0 §22 的 73 个未勾选状态不得被继承为「已通过」。
3. `generate-design-showcase.mjs` 中 `showcase-3.0.html` / `showcase-3.0.generated.html` 的过时叙述。
4. E24 / P1–P3 / 字体轴 / PageHeader 的「临时状态」——5.0 给出明确退出条件，未达成前保持 Pending。
5. `brand.tokens.json` 的 `status: DRAFT` 与 `decision: AUTO_BLOCKED` 只有在 `verify-contrast.mjs` + 视觉回归证据链齐备后才可变更。

---

## 12. 基线量化汇总

| 指标 | 数值 |
|---|---|
| 3.0 规范文档 | 1 份 / 4,111 行 / 197,053 B / 29 章 |
| 设计 Token | 319 处定义 / 245 个唯一变量名 / 14 个 CSS / 1,518 行 |
| 设计系统守卫测试 | 10 个（`web/src/design-system/__tests__/`） |
| 门禁脚本 | 5 个核心 + 3 个 showcase/锚点脚本，T1–T17 共 17 条规则 |
| `ui/` 组件 | 66 个 `.tsx`（65 实现 + 1 测试）/ 65 条注册 / 11 类 |
| 业务封装 | 7 目录 + 7 顶层 `.tsx`，`data-table/` 24 导出 |
| 页面 | 73 个路由源码 / 30 个 feature / 9 个系统设置子域 |
| 测试 | 288 个单测文件 / 75 个 `__tests__` / 6 个 E2E spec / 44 张视觉 PNG |
| i18n | 7 份 locale / 54,573 行 |
| 未闭合项 | 3.0 §22 73 项未勾选 + 65 组件证据未验证 + 10 类登记缺陷 |
| 平台 | 可验证 2（PC Web / H5）、不可验证 3（Android / iOS / HarmonyOS） |
| 并发 WIP | 211 项（51 `M` + 160 `??`），152 项在 `.uap/` |

---

## 13. 升级边界（本轮禁止事项）

1. 不修改 `web/src/styles/theme.css` 等 12 个已脏文件（§1）。
2. 不修改支付 / 充值 / 退款 / 余额 / 订单 / 认证 / 授权 / 数据库的任何业务代码与契约。
3. 不引入新依赖（尤其不引入 Clerk SDK、`@clerk/ui`、`@clerk/elements`、Storybook）。
4. 不删除任何组件、测试、Token 或业务代码；不降低门禁阈值、不扩 baseline、不动 ALLOWLIST。
5. 不执行全量构建、不执行 `./uap *` 写状态命令、不创建分支、不暂存、不提交、不推送。

---

## 14. 审计结论（证据支撑的状态）

**结论 A（正向）**：Uter 已具备一个内容完整、门禁严格、数据链自洽的设计系统（3.0），其 Token 分层、品牌资产、组件单一实现根、自动化门禁与 CI 接入均达到甚至超过 PART 7 / PART 9 的多数要求。5.0 的正确定位是「**继承 + 统一版本 + 补齐证据与治理结构**」，而非推倒重建。

**结论 B（约束）**：3.0 自身未闭合（73 项验收全未勾选、65 组件证据 0 VERIFIED、10 类登记缺陷），且存在 211 项并发 WIP，因此不允许批量重写全站 UI 或全量构建。

**结论 C（不可达项）**：Android / iOS / HarmonyOS 无任何真实实现，按用户 PART 12.6 必须标 `NOT_VERIFIED`；这与 PART 13 的 `FULLY_IMPLEMENTED_AND_VERIFIED` 条件互斥。**本轮最终状态必须低于 `FULLY_IMPLEMENTED_AND_VERIFIED`**，并在 `FINAL-ACCEPTANCE-REPORT.md` 中逐条列出未通过项。

**尚未执行（标 `NOT_EXECUTED`，非 PASS）**：全量构建、视觉回归双轨、`test:axe`、`test:business:e2e`、`./uap validate --all`、原生平台验收。原因见 §1 与 §13。
