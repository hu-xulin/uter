# uter 设计规范可检清单（提炼自权威文档）

> 本文档是 `/Users/lincolnhu/uter/_reports/uter-design-system-latest.md` 的**可机检提炼**。审计时以权威文档为准；文档更新后优先重读原文，本文件仅作快速核对。
>
> 设计系统目标：Design Tokens（唯一设计值来源）→ 基础样式 → 基础组件 → 复合组件 → 业务组件 → 页面。自动化负责发现违规，不靠开发者自觉。

## 1. 字体（Typography）

字体家族固定两种：**Inter** 承担全部界面文字；**SF Mono** 仅用于代码与对齐数值。字距（letter-spacing）**一律 0**，默认移除 `tracking-*`。

### 1.1 界面标题四层（硬阶梯，不多不少）

| 层 | 档位 | 用途 | 组件 |
|---|---|---|---|
| 1 | `h1` 30/600/36 | 页面标题（每页一个） | `SectionPageLayout.Title` |
| 2 | `h2` 24/600/32 | 页面内语义区块（2–5 个） | `Heading variant="section-title"` |
| 3 | `h3` 18/600/28 | 卡片、面板、图表 | `CardTitle` / `Heading variant="card-title"` |
| 4 | `group-title` 16/600/24 | 卡片**内部**再分组（表单/列表/弹窗字段分组） | `Heading variant="group-title"` |

### 1.2 正文与文本档位

| Token | Font | Weight | Size | Line | 用途 |
|---|---|---|---|---|---|
| display | Inter | 700 | 36 | 40 | 页面主视觉标题（多行用 1.5 行高比例） |
| h1 / h2 / h3 | Inter | 600 | 30/24/18 | 36/32/28 | 标题四层 |
| group-title | Inter | 600 | 16 | 24 | 卡片内分组标题 |
| body | Inter | 400 | **14** | 20 | 常规正文、表单内容、普通说明（全站默认基准） |
| body-long | Inter | 400 | **16** | 26 | 长文本、文章、协议、帮助文档（连续阅读） |
| body-sm | Inter | 400 | 14 | 20 | 紧凑辅助正文、表格单元格、卡片/区块同行汇总值 |
| label | Inter | 500 | 14 | 20 | 按钮文字、表单标签、导航项 |
| caption | Inter | 400 | 12 | 16 | 说明、占位符、徽标、时间戳（仅非核心信息） |
| mono | SF Mono | 400 | 14 | 20 | 正文内等宽（模型 ID、密钥、金额、行内代码、表格单元格） |
| mono-code | SF Mono | 400 | 13 | 20 | 整块等宽代码展示区（首页代码卡、代码块） |
| mono-title | SF Mono | 600 | 16 | 22 | 等宽卡片标题（定价卡片模型名），与 card-title 同级 |

### 1.3 硬规则（违反即违规）

1. **16/600 只允许当 `group-title`**；不得拿它当页面/区块/卡片标题（那三层必须是 30/24/18）。
2. **不得用 `text-sm font-semibold` 做卡片/区块/分组标题**：14px 是 body-sm/label 档。
3. **表单标签恒为 `label`（14/500）**：`FormLabel`/`Label` 上加 `text-xs` 属违规（12px 是 caption 档）。
4. **12px 只给真 caption**：说明、占位符、徽标、表格列名（uppercase）、时间戳；承载信息的正文/标签/数值一律 14px 起。**卡片/区块标题同行的汇总值**（`总计：$0.03`、`共 181 条`）是信息不是脚注，恒为 `body-sm` 14/20，压到 12px 会变三档层级、读起来像漏一层。
5. **弹窗/抽屉标题 18px**：`text-xl`(20px) 不在阶梯内，不得用于放大弹窗标题。
6. **「名称 + 说明」行标题恒为 16/500**（`text-base font-medium`），600 只给 `group-title`；否则一屏出现两套「加粗 16px」，层级失效。
7. **body 固定 14px / long 固定 16px**，不要全站统一放大到 16，也不要把长文压到 14。
8. **等宽三档互斥**：正文内等宽一律 14px（`text-mono`）；仅整块代码展示区用 13px（`text-mono-code`）；等宽卡片标题 16px（`text-mono-title`）。`card-title` 上不要叠 `font-mono text-mono`（会把 18px 压成 14px）。
9. **密集等宽列表**（表格单元格/调用日志）行高用 22px（只配 `text-mono`），字号仍是 14。
10. **多行主标题行高**用无单位比例 1.5（随字号缩放），且规则放在 `@layer components` 之外，只覆盖行高以保留响应式字号。

### 1.4 Markdown 内容排版（自成一套，比界面低 1–2 档）

| Markdown | 字号/行高 | 字重 |
|---|---|---|
| h1 | 24/32 | 600 |
| h2 | 18/28 | 600 |
| h3 | 16/24 | 600 |
| h4 | 14/20 | 600 |
| h5 | 14/20 | 600（tertiary 色） |
| h6 | 12/16 | 600 + uppercase（tertiary 色） |

正文 `body-long` 16/26，行内/围栏代码 `mono` 14/20。**只对 Markdown 渲染内容生效**，`Heading`/`CardTitle`/`DialogTitle` 不得借用——界面层级永远是 30/24/18/16。

### 1.5 移动端全屏菜单

一级项用 16/24（`text-base font-medium`），比桌面一级导航 14/20 大一档。判据是**输入方式**（鼠标 14 / 手指 16），非屏幕宽度。

## 2. 颜色（Color）

品牌主色统一 **`#5B5EE6`**（紫蓝）。围绕它建立色阶，避免多处定义：

| 用途 | 浅色 | 深色 | 说明 |
|---|---|---|---|
| 品牌主色/链接/选中强调 | `#5B5EE6` | `#8B8DF5` | 全局统一 |
| 主按钮背景 / 文字 | `#5B5EE6` / `#FFFFFF` | `#8B8DF5` / `#111327` | 白字对比度约 4.7:1 |
| 主按钮悬停 / 按下 | `#494CC7` / `#3F42B0` | `#A1A3F7` / `#B7B8FA` | 同色相加深 |
| 焦点环 | `#5B5EE6` | `#A1A3F7` | 输入框/按钮/下拉焦点统一品牌化 |
| 品牌浅底/选中背景 | `#F0F0FF` | `#25264A` | 选中项、轻提示 |
| 品牌描边 | `#C7C8FF` | `#5558DC` | 选中控件边框 |

### 2.1 文字颜色语义 Token（禁止页面/组件硬写十六进制）

| 层级 | Token | 浅色 | 深色 | 使用范围 |
|---|---|---|---|---|
| 一级文字 | `text-primary` | `#0F172A` | `#F8FAFC` | 标题、正文、主要数据、输入值（默认 14px，长文 16px） |
| 二级文字 | `text-secondary` | `#334155` | `#CBD5E1` | 描述、辅助说明 |
| 三级文字 | `text-tertiary` | `#475569` | `#A8B3C5` | 时间戳、元信息、次要标签（小字号必查对比度） |
| 禁用文字 | `text-disabled` | `#64748B` | `#94A3B8` | 禁用控件 |
| 反色文字 | `text-inverse` | `#FFFFFF` | `#0F172A` | 深色/品牌实心背景 |
| 链接文字 | `text-link` | `#5B5EE6` | `#A1A3F7` | 文本链接（悬停/焦点须非颜色反馈） |
| 占位符 | `text-placeholder` | `#64748B` | `#94A3B8` | 输入框 placeholder |

### 2.2 颜色硬规则

- **字体颜色按语义 Token 使用，禁止随意写十六进制**；品牌色用于可交互元素与品牌强调，不替代正文中性色；状态色只表达对应语义。
- 普通文本对比度 ≥ **4.5:1**；大文本（≥24px 常规 / ≥18.66px 粗体）≥ **3:1**；控件边界/图标/非文本 ≥ **3:1**。
- **禁止**：把 `#5B5EE6` 当所有正文统一色；用 `opacity` 作唯一层级手段；把错误/成功/警告统一染成品牌色。
- **链接**：建议默认带下划线；若不带，悬停/焦点必须有非颜色反馈（不能只靠色差）。
- **焦点环**：保留 `:focus-visible` 键盘焦点提示，不得 `outline: none` 无替代移除。
- 每次改 Token/主题背景/透明度后重算前景-背景对比度。

### 2.3 左侧导航选中态（§2.3 专用 Token）

选中项：背景 `bg-primary-subtle`(`#F0F0FF`)，**文字/图标用专用 `text-sidebar-active-foreground`**，不要用 `text-primary`。

| 主题 | 组合 | 比值 | 结论 |
|---|---|---|---|
| 浅色（旧） | `#5B5EE6` on `#F0F0FF` | 4.44:1 | 未达 4.5:1 |
| 浅色（推荐） | `#5558D8` on `#F0F0FF` | 4.93:1 | 达 AA |
| 深色选中底 | `#8B8DF5` on `#25264A` | 4.97:1 | 达 AA |

硬规则：① 图标不单独定色（`stroke="currentColor"` 跟随行文字）；② 选中态文字用专用 Token 而非 `primary`；③ 未选中行保持 `text-sidebar-foreground`、整列字重统一 500，选中只变前景+背景，不加粗/边框/竖条。自动化应断言选中态用 `text-sidebar-active-foreground`。

## 3. 形状 / 间距 / 描边（Shape / Spacing / Stroke）

- 圆角：r-xs 4 / r-sm 6 / **r-md 8（按钮、输入框、标签页默认）** / **r-lg 10（卡片、弹窗、图标按钮）** / r-xl 12 / r-2xl 16 / r-full 9999px（胶囊、圆形头像、开关轨道）。
- 间距：sp-0-5 4 / sp-1 6 / sp-1-5 8 / sp-2 10 / sp-2-5 12 / sp-3 14 / sp-4 16 / sp-5 20 / sp-6 24 / sp-8 32。
- 描边：**1px 实心**为主（卡片、弹窗、输入框、分隔线、侧栏分界、危险描边 `border-destructive-subtle`）。
- 非 1px 描边只有两类，且都不是容器边框：① 镂空环 2px（用背景色挖间隙，如叠层头像/步骤徽章）；② 图形描边 1px 或 2px（spinner 32px 用 2px、图表指示线），写在图形组件内部。
- 硬约束：描边宽度**不出现小数**（1.5px 在 1x 屏渲染不确定）；图形描边不得出现在容器上。

## 4. 投影 / 辉光（Effect）

五档，判据是「这块面还有没有一个自己的平面位置」：

| Token | 值 | 用途 |
|---|---|---|
| elevation-none | none | 静止页面内元素（默认） |
| elevation-popover | `0 1px 2px 0 rgba(0,0,0,.06)` | 下拉、气泡、悬浮提示 |
| elevation-overlay | `0 4px 6px -4px …,.10, 0 10px 15px -3px …,.10` | 弹窗、抽屉、浮层 |
| elevation-raised | `0 12px 24px -12px …,.18, 0 2px 6px -2px …,.10` | 拖拽中元素（瞬时） |
| elevation-marketing | `0 20px 50px -25px rgba(15,23,42,.18)` | 营销展示卡片（脱离平面） |
| glow-online | `0 0 8px rgba(16,185,129,.45)` | 在线状态点（状态语义，**不是层级**） |

除这五档，界面一律不投影——卡片、表格、侧栏、页面容器、按钮、徽标都不加阴影，层级靠 1px 描边 + 表面色差表达。`glow-online` 只用于状态点，不能给卡片提亮。

## 5. 动效（Motion）

时长按「表达什么」分五组（非按组件）：交互反馈 100/200/350ms；营销节奏 300/500ms；内容入场 600ms；循环 1.8/1.5/1/0.8/20/3.2s；数据过渡 250/500ms。缓动只三条且**与组绑定，不允许自由组合**：`motion-ease`(交互/数据)、`motion-ease-marketing`(营销/入场)、`motion-ease-snappy`(整块位移)。裸 `transition-*` 默认 150ms 不在档内，须把 `--default-transition-duration` 指到 `motion-fast`、且**必须写在 `@theme` 里**（写 `:root` 框架读不到）。`prefers-reduced-motion: reduce` 时全部动画压到 0.01ms。

## 6. 图标（Icons）

统一 **Lucide 线性图标**，标准描边 **2px**（禁止常规界面 1px）。默认 **18px** 图标配 24px 点击区；紧凑场景 16px；强调型功能入口 24px；空状态 32px；整页空状态 48px。导航/主要操作优先 18px。描边 Token：`--icon-stroke-width-sm`/`--icon-stroke-width`/`--icon-stroke-width-emphasis` 均为 2px。通过 `strokeWidth` 或 CSS Token 控粗细，不用 `font-weight`/缩放/叠画加粗。同一导航组/工具栏/操作列须一致尺寸与描边。

## 7. 无障碍（Accessibility）

- **焦点指示器全站只有一种**：1px 环、贴元素边框外沿（`outline-offset: 0`）。原生元素由基座 `:focus-visible` 兜底，组件用 `focus-visible:ring-1 ring-ring`；两者几何必须一致，不得引入第二套颜色或 offset。
- **触控目标**：可点击元素最小 24×24（WCAG 2.2 AA 2.5.8）。密集容器里视觉 16–20px 时用 `.ds-touch-target`（居中伪元素扩命中区到 24px，**不改盒子**）。
- **动效偏好**：`prefers-reduced-motion: reduce` 全部动画/过渡压到 0.01ms。

## 8. 组件排版速查（Typography per component）

| 组件 | 字号/字重 | 备注 |
|---|---|---|
| Button | label（14/500） | 尺寸 md 36 / sm 32 / lg 40；`inline` 退文本行盒、`wrap` 内容高度 |
| Input / Textarea | 内容 14（全平台统一，无 16 例外）；标签 label | placeholder 用 muted-foreground |
| Label | label（14/500） | 颜色 foreground；永不加 text-xs |
| Badge | caption（12/400） | 颜色取对应 -foreground |
| Card | 标题 h3；描述 body-sm | 圆角 r-lg、描边 1px、无投影 |
| Dialog | 标题 h3（18）；描述 body-sm | 宽度约 420px；投影 overlay |
| Tabs | label | 容器 r-lg、激活项底部 2px 品牌色（Line 型） |
| Table | 表头 label；单元格 body-sm | 行高约 48px；数值右对齐 |
| Sidebar | 菜单项 label；分组标题 caption | 选中 bg-primary-subtle + text-sidebar-active-foreground |
| Model Card（定价） | 标题 mono-title 16/600；描述 body-sm 14；报价 mono；标签 caption | 描述**不用 16px**（与标题抢层级） |
| Alert / Toast | 标题 label；描述 body-sm | 圆角 r-lg |

## 9. 单页布局（Composition）

- 标准内容区最大宽 **1280px**，超出居中；卡片网格按 348px 列宽自适应。**密集比较页（模型广场）用 1800px**（仅此类页面）。
- 页边距 24–32px；卡片内 24px；控件内 8–12px。区块间距 24–32px；卡片间距 16px；控件间距 8px。
- 表面语言：白底 + 1px 描边 + 8/10px 圆角；投影仅弹窗与浮层。左侧栏固定常驻，页头可吸顶。

## 10. 自动化检查建议（CI 渐进）

扫描：CSS/SCSS 的 `font-size`、React `style={{fontSize}}`、Tailwind 任意字号类 `text-[15px]`、行内颜色/圆角/间距、`:not` 重要的 `!important`、全局选择器覆盖、重复定义的组件样式、未使用/重复的 Token。先报告模式收集现状，再逐步提升为警告与阻断。Token 实际值以代码为准，文档字号表由 Token 生成或自动核对。
