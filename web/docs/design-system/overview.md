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
| 字号/密度 | `data-theme-scale` | 字号阶梯 + 密度 Token | 颜色、圆角 |
| 明暗 | `.dark` | 颜色 Token 取值 | 尺寸 |

`data-theme-scale` 同时承担字号缩放与密度，这是**有意**的：它既是无障碍的
「放大文字」入口，也是紧凑/宽松模式的入口。再另造一个 `data-density` 属性只会
和它打架。

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

例外必须写进 `scripts/check-design-tokens.mjs` 的 `ALLOWLIST` 并给出理由，
同时登记到 [exceptions.md](./exceptions.md)。

## 5. 当前落地状态

已完成：

- 字号阶梯进入 `@theme`，成为工具类的真实来源；
- 语义 Token 全量建立，行高兜底值与阶梯由测试锁死；
- 圆角基准改为 8px（2/4/6/8/12/16 六档），按钮与输入框默认 6px；
- `Text` / `Heading` / `PageHeader` 落地，标题输出真实 `h1`–`h6`；
- 徽标、表头、弹窗标题、卡片描述按文档对齐；
- 全站任意字号清零（`lint:design:strict` 通过）。

尚未完成（见 [exceptions.md](./exceptions.md) 的「待办」）：

- 控件高度（按钮 36px / 输入框 40px）尚未整体抬升；
- 「除弹窗与浮层外不投影」尚未完成全站清理；
- 业务组件尚未逐个改写为组合基础组件。

## 6. 运行时实测（1440×900）

| 元素 | 字号 | 字重 | 行高 | 圆角 |
| --- | --- | --- | --- | --- |
| 首页 hero `h1`（display） | 36px | 700 | 40px | — |
| 首页 hero 描述（body） | 16px | 400 | 24px | — |
| 一级导航项（label） | 14px | 500 | 20px | 8px |
| 登录输入框（E1） | 16px | 400 | 24px | 6px |
| 表单标签（label） | 14px | 500 | 20px | — |
| 登录按钮（label） | 14px | 500 | 20px | 6px |

移动端 390px：输入框 16px / 圆角 6px，按钮 14px / 圆角 6px。

Token 解析值：`--text-xs` 12/16 · `--text-sm` 14/20 · `--text-base` 16/24 ·
`--text-lg` 18/28 · `--text-2xl` 24/32 · `--text-3xl` 30/36 · `--text-4xl` 36/40 ·
`--radius-sm` 4px · `--radius-md` 6px · `--radius-lg` 8px。
