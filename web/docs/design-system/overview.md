# UTER Design System · 总览

本目录是设计系统的**正式说明**。设计值的权威来源是代码（`src/design-system/tokens/`），
本文档描述规则、边界与落地方式。两者不一致时以代码为准，并应由
`src/design-system/__tests__/tokens.test.ts` 把差异暴露出来。

> **规范基线**：`_reports/uter-design-system-updated.md`（2026-10-27 版）。
> 本目录全部条文以该版为准。旧版「常规正文 16px」基准已作废，正文基准现为
> **14px**，16px 改为长文本专用档 `body-long`（16/26）。

## 1. 分层

```
tokens/        设计值：字号、字重、行高、颜色、圆角、投影、动效
foundations/   全局基础样式：排版工具类、无障碍、动效
components/    语义基元：Text / Heading
patterns/      交互模式：PageHeader
─────────────────────────────────────────────
components/ui/ 组件库正式实现位置：Button / Input / Badge / Dialog / Table …
features/      业务组件与页面：只做组合，不重新定义视觉规则
```

三层 Token：

| 层        | 位置                                          | 谁可以引用       |
| --------- | --------------------------------------------- | ---------------- |
| Primitive | `tokens/primitives.css`                       | 只有 semantic 层 |
| Semantic  | `tokens/semantic.css`、`src/styles/theme.css` | 组件、页面       |
| Component | `tokens/spacing.css` 的密度档、`cva` 变体     | 组件             |

**组件不允许直接引用 primitive 值。** 否则「把全站正文行高从 20px 改成 21px」
就得逐个翻组件，设计系统也就白建了。

## 2. 七条硬规则

1. **正文基准 14px**。`body` 与 `body-sm` 同为 14/20；16px 只给 `group-title`、
   设置页字段档、指标数值与长文本（`body-long` 16/26）。详见 `typography.md`。
2. **品牌色只有一个来源**。`--primary`（`#5B5EE6` / 深色 `#8B8DF5`）是唯一入口，
   `primary-strong` / `primary-hover` / `primary-active` / `primary-subtle` /
   `primary-border` 全部由它派生。组件里出现品牌色字面值 = 改品牌色不生效。
3. **文字层级用语义 Token，不用透明度**。`text-foreground` / `text-fg-secondary` /
   `text-fg-tertiary` / `text-fg-disabled` / `text-fg-placeholder`，禁止
   `text-foreground/60` 这类写法冒充层级。
4. **图标只允许 Lucide**。24px 画框、**描边统一 2**（`stroke-width` 的单位是
   画框单位，16px 渲染 ≈1.33px、18px = 1.5px、48px ≈4px，由 `IconProvider`
   统一注入 `size={18}`）。尺寸**逐场景固定**（2026-10-28 13:24 版）：
   按钮内 / 工具栏与卡片操作 / **侧边栏** / 主导航与 Tabs / 提示与状态
   **18px**（`size-4.5`，默认档）；紧凑型辅助 **16px**（`size-4`）；强调型
   入口 **24px**（`size-6`）；空状态 **32px**（`size-8`）；整页级空状态
   **48px**（`size-12`）。档位外的值一律违规。
5. **投影只有四档 + 一档状态辉光**。`popover`（气泡、下拉面板）、
   `overlay`（弹窗、抽屉）、`raised`（拖拽中的元素）、`marketing`（营销展示
   卡片），外加 `glow-online`（在线状态点）。卡片、表格、侧边栏一律不投影，
   层级靠 1px 描边与表面色差。判据是「这块面还有没有自己的平面位置」。
6. **焦点环默认 2px 品牌色，表单控件 1px**。`outline: none` 必须配替代焦点提示，
   否则键盘用户丢失位置。`Input` / `Textarea` / `Select` 自带 1px 边框，外扩
   2px 会读成双线框，因此收到 1px —— 这是唯一例外，其余场景仍是 2px。
7. **圆角只有七档**。`xs 4 / sm 6 / md 8 / lg 10 / xl 12 / 2xl 16 / full 9999`，
   控件默认 8px、卡片与弹窗 10px，禁止 `rounded-[7px]`。

## 3. 关键决策

### 3.1 组件实现位置只有一处

`components/ui/` 是组件的**正式实现位置**。`design-system/` 只补充 `ui/` 里没有的
东西（Token、基础样式、`Text` / `Heading`、`PageHeader`）。

不允许在 `design-system/` 里再实现一遍 `Button`。历史上出现过的「两套按钮」是
最难清理的技术债，从一开始就不要开这个口子。

### 3.2 字号阶梯必须声明在 `@theme`

Tailwind v4 只从 `@theme` 读取主题值。写在 `:root` 的 `--text-*` 不会进入
`text-*` 工具类，工具类会静默退回内置默认值。

> 本项目真实踩过这个坑：`theme.css` 的 `:root` 里有一份字号表，改了 `--text-3xl`
> 却没有任何页面变化。现在阶梯唯一声明在 `design-system/tokens/typography.css`
> 的 `@theme` 里，`theme.css` 只留了一条指向它的注释。

**同理，文字颜色不能叫 `--text-*`。** `--text-*` 在 Tailwind v4 里是字号命名空间，
叫 `--text-primary` 会生成一个 `text-primary` 字号类与品牌色工具类撞车，也会被
`check-design-tokens.mjs` 的 T1 判成「字号阶梯重复声明」。因此文字色统一用
`--fg-*` 前缀，对应工具类 `text-fg-*`；一级文字沿用 `text-foreground`。

### 3.3 主题维度互相独立

| 维度     | 属性                | 允许影响                                  | 不允许影响     |
| -------- | ------------------- | ----------------------------------------- | -------------- |
| 颜色主题 | `data-theme-preset` | 背景、文本、边框、状态色、品牌色阶        | 字号、间距     |
| 圆角     | `data-theme-radius` | 圆角基准 `--radius`                       | 字号、颜色     |
| 密度     | `data-theme-scale`  | `--spacing` + `--ds-*` 控件/表格/卡片尺寸 | 字号阶梯、颜色 |
| 明暗     | `.dark`             | 颜色 Token 取值                           | 尺寸           |

`data-theme-scale` 只承担密度（间距与控件尺寸），**不再缩放字号阶梯** ——
规范第八节明确密度不得改动默认正文语义。它曾经也缩放 `--text-*`，等于让
「紧凑模式顺手把 16px 正文压到 13px」，已移除（见 `exceptions.md` D4）。
需要放大文字的用户走「Simple Large-font」预设（见 `typography.md`「无障碍大字档」）。

> 唯一的颜色主题例外：`simple-large` 预设自带一套大字阶梯，因为「大字」就是
> 这个预设的产品语义，详见 `exceptions.md` E11。

**主题预设的品牌色阶自动派生**：`theme-presets.css` 对非 `default` 预设用
`color-mix(in oklch, …)` 从该预设的 `--primary` 推出 `primary-hover` /
`primary-active` / `primary-subtle` / `primary-border` / `--ring`，
不需要每套预设手抄一份色阶。

## 4. 唯一入口

```
src/styles/index.css
├── @import 'tailwindcss'
├── @import './theme.css'           颜色、字体栈、圆角基准、品牌色阶
├── @import './theme-presets.css'   颜色/圆角/字号预设
├── @import '../design-system/tokens/index.css'
└── @import '../design-system/foundations/index.css'
```

顺序有约束：`tokens/typography.css` 的 `@theme` 必须晚于 `@import 'tailwindcss'`，
否则覆盖不了内置阶梯。

## 5. 自动化约束

```bash
node scripts/check-design-tokens.mjs          # 报告模式
node scripts/check-design-tokens.mjs --strict # 有违规即退出码 1（CI）
bunx vitest run src/design-system/__tests__   # Token / 守卫测试
```

`check-design-tokens.mjs` 的扫描规则：

| 规则 | 拦截内容                                                                                                                                                            |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1   | `--text-*` 出现在唯一来源之外（字号阶梯重复声明）                                                                                                                   |
| T2   | 任意字号工具类 `text-[15px]`                                                                                                                                        |
| T3   | 任意行高工具类 `leading-[26px]`                                                                                                                                     |
| T4   | 内联字号 `style={{ fontSize: 13 }}`                                                                                                                                 |
| T5   | CSS 硬编码 `font-size: 15px`                                                                                                                                        |
| T6   | 非浮层投影 `shadow-sm` / `shadow-[…]`；引用不存在的 elevation 档位（弹窗与浮层走 `OVERLAY_ALLOWLIST`，`shadow-none` 不计违规）                                      |
| T7   | 调色板直用 `bg-slate-100` 这类未走语义 Token 的类名                                                                                                                 |
| T8   | 裸色值 `#hex` / `rgba()`（Token 定义处与 SVG 图形除外）                                                                                                             |
| T9   | 行高覆盖 `leading-*`（行高由字号 Token 自带，`leading-[var(--…)]` 放行）                                                                                            |
| T10  | 任意圆角 `rounded-[3px]`（`rounded-[inherit]` / `rounded-[var(--…)]` 放行）                                                                                         |
| T11  | 未登记动效节奏 `duration-N` / `duration-[…]` / `ease-[cubic-bezier(…)]`（同一行出现 `animate-in` / `animate-out` 时放行 —— tw-animate 拿它当 `animation-duration`） |

`src/design-system/__tests__/spec-guards.test.ts` 补三条本版新增的硬规则：

| 守卫                 | 拦截内容                                                             |
| -------------------- | -------------------------------------------------------------------- |
| `body baseline`      | `<p>` / `Card` / `DialogContent` / `SheetContent` 上出现 `text-base` |
| `icon library`       | `@hugeicons/*`、`@heroicons/*`、`react-icons/*` 的 import            |
| `brand color source` | 组件里出现品牌色字面值（`#5B5EE6` 等 11 个档位）                     |

例外必须写进对应脚本的 `ALLOWLIST` 并给出理由，同时登记到
[exceptions.md](./exceptions.md)。

全站静态审计另有一份按本规范写的脚本：
`_reports/2026-10-27-design-audit-new-spec.mjs`（20 条规则，输出「违规 / 已登记」
双计数，违规不为 0 时 `exitCode=1`）。

## 6. 当前落地状态（2026-10-27 按新版规范全量整改后）

- 字号阶梯进入 `@theme`，成为工具类的真实来源；正文基准由 16px 收敛到 **14px**，
  新增 `--text-long` 16/26 承接长文本（文章、协议、帮助中心、对话气泡）；
- 品牌色统一为 `#5B5EE6`（深色 `#8B8DF5`），拆成 6 条语义出口；
  `--color-primary` 从硬编码字面值改回 `var(--primary)`，品牌色只有一个来源；
- 色板整体换成 slate 中性色（background `#FFFFFF`/`#020617`、border
  `#E2E8F0`/`#334155`、input `#D1D5E5`/`#45465F`）；
- 文字色改用 `--fg-*` 命名空间（`text-fg-secondary` 等），一级文字沿用
  `text-foreground`；
- 图标库统一到 Lucide（34 个 Hugeicons 文件迁移完毕），业务代码图标统一
  `size-4`（16px）+ 全局 `strokeWidth 1.5`；`Spinner` 从 Hugeicons 的
  `Loading03Icon` 换成 Lucide `LoaderCircle`；
- 投影收敛到四档 + 一档辉光：`shadow-2xl` / `shadow-xl` / 任意值投影全部改走
  `--ds-elevation-{popover|overlay|raised|marketing}` 与 `--ds-glow-online`；
- 表格行高 60px → **48px**，单元格内边距 `p-2` → `px-3 py-2`，表头 `px-2` → `px-3 py-2`；
- `Alert` 内边距 `px-2.5 py-2` → **`p-4`**，图标与文字间距 8px → 12px；
- `Sidebar` 宽度 208px → **240px**（规范 240–280px 区间下限）；
- `Select` 面板补 `rounded-lg shadow-sm`，选项行 `py-1 pr-8 pl-1.5` → `px-2 py-2`；
- 悬停/按下态 Token 化：`hover:bg-primary/90` 这类透明度凑法改为
  `hover:bg-primary-hover` / `-active` / `-subtle-hover`；
- `AlertDialog` 标题 `text-base font-medium` → `text-lg font-semibold`；
- 圆角基准 `--radius` = 8px，档位与 `--ds-radius-*` 一一对齐：
  `xs` 4 / `sm` 6 / `md` 8 / `lg` 10 / `xl` 12 / `2xl` 16 / `full` 9999。

## 7. 运行时实测（1440×900，2026-10-25 旧基准）

> 下表由 Playwright 读 `getComputedStyle` 实测。**它是 16px 正文基准时代的记录**，
> 新版规范（正文 14px）整改后尚未重新实测 —— 除「首页 hero 描述」已随正文基准
> 降为 14px 外，其余行数值需重跑确认。

| 元素                                  | 字号 | 字重 | 行高 | 圆角 | 高度 |
| ------------------------------------- | ---- | ---- | ---- | ---- | ---- |
| 首页 hero `h1`（display, multiline）  | 36px | 700  | 54px | —    | —    |
| 首页 hero 描述（body，**现为 14px**） | 16px | 400  | 24px | —    | —    |
| 一级导航项（label）                   | 14px | 500  | 20px | 8px  | —    |
| 登录输入框（body-sm）                 | 14px | 400  | 20px | 8px  | 40px |
| 表单标签（label）                     | 14px | 500  | 20px | —    | —    |
| 登录按钮（label）                     | 14px | 500  | 20px | 8px  | 36px |

移动端 390px：输入框 14px / 圆角 8px / 高 40px，按钮 14px / 圆角 8px / 高 36px。
规范明确「输入框文字全平台 14px，不设 H5 16px 例外」，与此一致。

Token 解析值：`--text-xs` 12/16 · `--text-sm` 14/20 · `--text-long` 16/26 ·
`--text-mono` 14/20 · `--text-mono-code` 13/20 · `--text-base` 16/24 ·
`--text-lg` 18/28 · `--text-2xl` 24/32 · `--text-3xl` 30/36 · `--text-4xl` 36/40 ·
`--radius-xs` 4px · `--radius-sm` 6px · `--radius-md` 8px · `--radius-lg` 10px ·
`--radius-xl` 12px · `--radius-2xl` 16px ·
`--ds-line-display-multiline` 1.5 · `--ds-button-height-md` 36px ·
`--ds-control-height-md` 40px。
