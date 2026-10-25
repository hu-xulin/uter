# UTER Design System · 总览

本目录是设计系统的**正式说明**。设计值的权威来源是代码（`src/design-system/tokens/`），
本文档描述规则、边界与落地方式。两者不一致时以代码为准，并应由
`src/design-system/__tests__/tokens.test.ts` 把差异暴露出来。

## 1. 分层

```
tokens/        设计值：字号、字重、行高、间距、颜色、圆角、阴影
foundations/   全局基础样式：排版工具类、无障碍、动效
components/    语义组件：Text / Heading
patterns/      交互模式：PageHeader
─────────────────────────────────────────────
components/ui/ 既有组件库：Button / Input / Badge / Dialog / Table …
features/      业务组件与页面：只做组合，不重新定义视觉规则
```

三层 Token：

| 层 | 位置 | 谁可以引用 |
| --- | --- | --- |
| Primitive | `tokens/primitives.css` | 只有 semantic 层 |
| Semantic | `tokens/semantic.css` | 组件、页面 |
| Component | `tokens/spacing.css` 的密度档 | 组件 |

**组件不允许直接引用 primitive 值。** 否则「把全站正文行高从 24px 改成 25px」
就得逐个翻组件，设计系统也就白建了。

## 2. 关键决策

### 2.1 组件实现位置只有一处

`components/ui/` 是组件的**正式实现位置**。`design-system/` 只补充 `ui/` 里没有的
东西（Token、基础样式、`Text` / `Heading`、`PageHeader`）。

不允许在 `design-system/` 里再实现一遍 `Button`。历史上出现过的「两套按钮」是
最难清理的技术债，从一开始就不要开这个口子。

### 2.2 字号阶梯必须声明在 `@theme`

Tailwind v4 只从 `@theme` 读取主题值。写在 `:root` 的 `--text-*` 不会进入
`text-*` 工具类，工具类会静默退回内置默认值。

> 本项目真实踩过这个坑：`theme.css` 的 `:root` 里有一份字号表，改了 `--text-3xl`
> 却没有任何页面变化。现在阶梯唯一声明在 `design-system/tokens/typography.css`
> 的 `@theme` 里，`theme.css` 只留了一条指向它的注释。

### 2.3 主题维度互相独立

| 维度 | 属性 | 允许影响 | 不允许影响 |
| --- | --- | --- | --- |
| 颜色主题 | `data-theme-preset` | 背景、文本、边框、状态色 | 字号、间距 |
| 圆角 | `data-theme-radius` | 圆角基准 `--radius` | 字号、颜色 |
| 密度 | `data-theme-scale` | `--spacing` + `--ds-*` 控件/表格/卡片尺寸 | 字号阶梯、颜色 |
| 明暗 | `.dark` | 颜色 Token 取值 | 尺寸 |

`data-theme-scale` 只承担密度（间距与控件尺寸），**不再缩放字号阶梯** ——
规范第八节明确密度不得改动默认正文语义。它曾经也缩放 `--text-*`，等于让
「紧凑模式顺手把 16px 正文压到 13px」，已移除（见 `exceptions.md` D4）。
需要放大文字的用户走「Simple Large-font」预设（E11）。

> 唯一的颜色主题例外：`simple-large` 预设自带一套大字阶梯，因为「大字」就是
> 这个预设的产品语义，详见 `exceptions.md` E11。

## 3. 唯一入口

```
src/styles/index.css
├── @import 'tailwindcss'
├── @import './theme.css'           颜色、字体栈、圆角基准
├── @import './theme-presets.css'   颜色/圆角/字号预设
├── @import '../design-system/tokens/index.css'
└── @import '../design-system/foundations/index.css'
```

顺序有约束：`tokens/typography.css` 的 `@theme` 必须晚于 `@import 'tailwindcss'`，
否则覆盖不了内置阶梯。

## 4. 自动化约束

```bash
npm run lint:design          # 报告模式，不阻断
npm run lint:design:strict   # 有违规即退出码 1，用于 CI 收紧阶段
npm run test -- src/design-system   # Token 与文档一致性
```

扫描规则：

| 规则 | 拦截内容 |
| --- | --- |
| T1 | `--text-*` 出现在唯一来源之外 |
| T2 | 任意字号工具类 `text-[15px]` |
| T3 | 任意行高工具类 `leading-[26px]` |
| T4 | 内联字号 `style={{ fontSize: 13 }}` |
| T5 | CSS 硬编码 `font-size: 15px` |
| T6 | 非浮层投影 `shadow-sm` / `shadow-[…]`（弹窗与浮层走 `OVERLAY_ALLOWLIST`，`shadow-none` 不计违规） |

例外必须写进 `scripts/check-design-tokens.mjs` 的 `ALLOWLIST` 并给出理由，
同时登记到 [exceptions.md](./exceptions.md)。

## 5. 当前落地状态

已完成：

- 字号阶梯进入 `@theme`，成为工具类的真实来源；
- 语义 Token 全量建立，行高兜底值与阶梯由测试锁死；
- 圆角基准 `--radius` = 8px，Tailwind 档位与 `--ds-radius-*` 一一对齐：
  `xs` 4 / `sm` 6 / `md` 8 / `lg` 10 / `xl` 12 / `2xl` 16 / `full` 9999。
  按钮与输入框 `rounded-md`（8px）、卡片与弹窗 `rounded-lg`（10px）、
  图标按钮 `rounded-lg`（10px）；
- 输入控件文字统一 14px（`body-sm`），移除移动端 16px 强制规则与例外 E1；
- `Text` / `Heading` / `PageHeader` 落地，标题输出真实 `h1`–`h6`；
- 徽标、表头、弹窗标题、卡片描述按文档对齐；
- 控件高度由密度 Token 驱动（按钮 36 / 输入框 40，`sm` 档 32 / 36）；
- 非浮层投影清零，并由扫描规则 T6 长期看守；
- 密度不再缩放字号阶梯（D4），`data-theme-scale` 只管间距与控件尺寸；
- 全站任意字号清零（`lint:design:strict` 通过）。
- 首页卡片正文统一 16/400/24：`how-it-works` 曾用 `body-sm`（14px），与
  `features` 的 16px 不一致，已按「卡片正文 16px」归一。

原「尚未完成」三项（控件高度 / 投影清理 / 业务组件改写）已按文档执行完毕，
记在 [exceptions.md](./exceptions.md) 的「已完成」一节；其中密度改字号这一项
是在复查时新发现并修掉的（D4）。

## 6. 运行时实测（1440×900）

> 下表由 Playwright 读 `getComputedStyle` 实测，不是从文档抄的。

| 元素 | 字号 | 字重 | 行高 | 圆角 | 高度 |
| --- | --- | --- | --- | --- | --- |
| 首页 hero `h1`（display, multiline） | 36px | 700 | 54px | — | — |
| 首页 hero 描述（body） | 16px | 400 | 24px | — | — |
| 一级导航项（label） | 14px | 500 | 20px | 8px | — |
| 登录输入框（body-sm） | 14px | 400 | 20px | 8px | 40px |
| 表单标签（label） | 14px | 500 | 20px | — | — |
| 登录按钮（label） | 14px | 500 | 20px | 8px | 36px |

移动端 390px：输入框 14px / 圆角 8px / 高 40px，按钮 14px / 圆角 8px / 高 36px。

Token 解析值：`--text-xs` 12/16 · `--text-sm` 14/20 · `--text-base` 16/24 ·
`--text-lg` 18/28 · `--text-2xl` 24/32 · `--text-3xl` 30/36 · `--text-4xl` 36/40 ·
`--radius-xs` 4px · `--radius-sm` 6px · `--radius-md` 8px · `--radius-lg` 10px ·
`--radius-xl` 12px · `--radius-2xl` 16px ·
`--ds-line-display-multiline` 1.5 · `--ds-button-height-md` 36px ·
`--ds-control-height-md` 40px。
