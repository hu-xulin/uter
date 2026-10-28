# Exceptions

规范的价值取决于「例外是否被记录」。凡是无法接入 Token 的场景，都必须在这里
登记：理由、影响范围、退出条件。代码侧的对应登记在
`scripts/check-design-tokens.mjs` 的 `ALLOWLIST` —— 两处必须同步，只改一处
说明例外已经失控。

## 现状：**1 条例外**（2026-10-29）

`ALLOWLIST` 有一条登记（E25，首屏渐变标题的上游调色板直用色）。门禁
`node scripts/check-design-tokens.mjs --strict`
的通过口径：

| 计数项                     | 含义                                                 | 是否违规 |
| -------------------------- | ---------------------------------------------------- | -------- |
| 违规（violations）         | 落在业务代码里、没有 Token 表达的写法                | **是**   |
| 浮层投影（22 处）          | 弹窗 / 抽屉 / 下拉 / 悬浮输入舱的投影，§1.5 明确允许 | 否       |
| Token 定义处色值（150 处） | 调色板、品牌色、SVG 图形本身就该写色值               | 否       |
| 已登记例外                 | `ALLOWLIST` 里逐条写了理由的真例外                   | **0**    |

这一轮的关键转变：**上一版把 12 条「规范没覆盖到的空白」当成了例外**（E7 /
E8 / E13 / E14 / E15 / E16 / E17 / E18 / E19 / E20 / E22 / E23）。它们其实
不是「代码没接 Token」，而是**规范本身缺条款** —— 把空白登记成例外，等于
把规范的缺口永久固化成豁免。这一轮把每一条都**定档成规范条款**（给出取值、
判据、约束），然后改代码去满足它。

### 门禁覆盖范围（2026-10-28 补记）

`scripts/check-design-tokens.mjs` 只扫 `web/src`（1248 个文件）。**docs-web 是
独立的 Next.js + Tailwind 构建，不在这 1248 个文件里**，`bun run lint:design`
对它一个字都没看。它的口径写在 `docs-web/src/app/global.css` 的注释里（品牌色
`#5B5EE6`、r-lg 0.625rem、导航选中态 `#5558D8` / `#F0F0FF`、prose 阶梯
24/18/16/14、图标 16/18），改那边时只能靠这份注释和实机核对，别指望门禁兜底。

## 三类「看起来像例外、其实不是」

写新代码前先对照这三类，绝大多数「需要例外」的直觉都落在这里：

| 类别                | 例子                                                          | 为什么不算例外                              |
| ------------------- | ------------------------------------------------------------- | ------------------------------------------- |
| 规范条款            | 多行主标题 1.5 行高、Markdown prose 阶梯、营销动效 300/500ms  | 规范已给出取值，只是条款在别的文档里        |
| Token 的落点        | `tokens/*.css` 里的色值、`brand-colors.ts` 的商标色、SVG 图形 | 它们是**颜色的所有者**，本来就该写值        |
| 结构性 escape hatch | `rounded-[inherit]`、`leading-[var(--ds-line-mono-dense)]`    | 门禁直接识别为合法写法，不占 ALLOWLIST 条目 |

## 已升格为规范条款（编号已注销）

以下编号**不再有效**。表中「现在在哪」指向该规则的正式条款，写代码时按那里
执行，不要回头找例外编号。

| 编号 | 原主张                                  | 现在在哪                                                                               |
| ---- | --------------------------------------- | -------------------------------------------------------------------------------------- |
| E2   | 密集等宽的行高用 22px                   | `typography.md`「mono 密集行高」→ `--ds-line-mono-dense`                               |
| E3   | 行内代码随正文                          | `typography.md`「mono 三档」→ `text-mono` 14/20                                        |
| E4   | 图表 canvas 字号写数字                  | `components.md`「图表排版」→ `tokens/chart-typography.ts`                              |
| E5   | 客服挂件内联字号                        | `colors.md` → `var(--ds-text-*)` / `var(--ds-line-*)`                                  |
| E6   | 错误页 `text-[7rem]`                    | `typography.md` 阶梯最高档 `display` 36/700/40                                         |
| E7   | 多行主标题行高 1.5                      | `typography.md`「多行主标题的行高」→ `--ds-line-display-multiline`                     |
| E8   | 移动端全屏菜单 16/24                    | `typography.md`「移动端全屏菜单」→ `text-base font-medium`                             |
| E9   | 拖拽演示 `shadow-lg`                    | `spacing.md`「投影」→ `--ds-elevation-raised`                                          |
| E10  | hero 终端投影 + 状态点辉光              | `spacing.md`「投影」→ `--ds-elevation-marketing` + `--ds-glow-online`                  |
| E11  | 预设里的第二处字号阶梯                  | `typography.md`「无障碍大字档」→ `tokens/typography.css` 唯一来源                      |
| E12  | 首页代码卡片 13px                       | `typography.md`「mono 三档」→ `text-mono-code` 13/20                                   |
| E13  | 多行按钮 / 卡片式选项按钮不受高度档约束 | `components.md`「Button 的九个尺寸档」→ `wrap` 档 + `min-h` 三档                       |
| E14  | Markdown 标题自成一套                   | `typography.md`「内容排版（Markdown prose）」→ 24/18/16/14/14/12                       |
| E15  | 链接式文字按钮用 `h-auto`               | `components.md`「`inline`：链接式文字按钮」→ `size='inline'`                           |
| E16  | 残留原生 `<button>` / `<input>`         | `components.md`「原生 `<button>` / `<input>` 的边界」                                  |
| E17  | 营销页动效节奏 300–500ms                | `spacing.md`「动效」→ `--ds-motion-marketing-*`                                        |
| E18  | 非交互动效不受 100/200ms 约束           | `spacing.md`「动效」→ `--ds-motion-enter` / `--ds-motion-loop-*` / `--ds-motion-data*` |
| E19  | 营销页内容区宽度 1800px                 | `spacing.md`「内容宽度」→ `--ds-content-max-wide` + `max-w-container-wide`             |
| E20  | 装饰性描边不是 1px                      | `spacing.md`「描边」→ 镂空环 / 图形描边两类，禁止小数值                                |
| E21  | 结构性圆角的任意值                      | `spacing.md`「圆角」→ 只剩 `rounded-[inherit]`，门禁直接放行                           |
| E22  | 账户安全 / 偏好设置行标题 16/600        | `typography.md`「页面层级」→ 行标题恒 16/500，600 只给 `group-title`                   |
| E23  | 固定尺寸容器内的图标小于 16px           | `components.md`「容器约束：12 / 14px 字形的唯一合法来源」                              |
| E24  | 折扣/溢价角标实心填充，部分组合低于 AA  | `exceptions.md`「E24」→ 浅色折扣 5.02:1 ✅ / 浅色溢价 3.76:1、深色折扣 3.30:1 ❌       |

## 新增例外的流程

1. 先确认现有 Token 真的覆盖不了 —— 绝大多数「需要新字号 / 新时长」其实是
   **规范缺条款**，那就去补条款（在 `typography.md` / `spacing.md` /
   `components.md` 里定档），而不是在这里开例外；
2. 确实无法接入 Token 时，在本文档追加一节，写清位置、差异、理由、影响范围、
   退出条件；
3. 在 `scripts/check-design-tokens.mjs` 的 `ALLOWLIST` 加对应条目并写明理由；
4. 提交说明里引用例外编号。

没有退出条件的例外不接受。**「规范没写」不是理由，是待补的条款。**

## 已完成（原待办，已按规范落地）

以下四项**曾经**是未完成项，本轮已按文档执行完毕，不再视为例外。

### D1 · 控件高度已对齐 36 / 40（已完成）

按钮 36px、输入框 40px，改由密度 Token 驱动，不再写死：

- `button.tsx`：`default` → `h-(--ds-button-height-md)`（36）、
  `sm` → `h-(--ds-button-height-sm)`（32）、`icon` → 同 md；
- `input.tsx` / `textarea.tsx` / `select.tsx` 触发器 / `native-select.tsx` /
  `input-group.tsx` / `combobox.tsx` → `h-(--ds-control-height-md)`（40）；
- `tokens/spacing.css` 按 `data-theme-scale` 分档，切换密度即全站生效。

### D2 · 非浮层投影已清空（已完成）

`shadow-xs` / `shadow-sm` / `shadow-md` 已从卡片、面板、表格容器、按钮、
徽标、输入框、代码块、标签页上移除；数据表格固定列的分隔改回 1px 描边
（`column-pinning.ts`），供应商入口 chip 也已去掉投影。
现存投影只出现在 popover / dropdown / menubar / context-menu / select /
combobox / hover-card / navigation-menu / floating-window / 移动端底栏 /
fixed 浮动操作条，以及 `--ds-elevation-raised`（拖拽中的元素）与
`--ds-elevation-marketing`（首页 hero 展示终端这类营销展示卡片）。

配套的静态规则：`check-design-tokens.mjs` 的 **T6** 会扫出一切非浮层
`shadow-*`，弹窗与浮层走 `OVERLAY_ALLOWLIST`，`shadow-none` 不计违规。

### D3 · 业务组件已接入语义组件（已完成）

首页 hero / features / how-it-works / cta、定价页主标题、模型详情页主标题、
排行页主标题、Dashboard `PanelWrapper` 的标题与说明，均已改为组合
`Heading` / `Text`；`stat-card` 指标数值对齐「仪表盘指标 24–32/600」。

### D4 · 密度不再改字号（已完成）

规范第八节要求密度只管「表格行高、控件高度、组件内边距」，不得改动默认正文
语义。此前 `styles/theme-presets.css` 的 `[data-theme-scale]` 会整段缩放
`--text-*`（`sm` 把正文压到 13px、`xl` 顶到 19px），等于让「紧凑模式顺手
改正文」，已整段移除，只保留 `--spacing` 这一项间距缩放。

- 控件高度继续由 `design-system/tokens/spacing.css` 的 `--ds-*` 分档驱动，
  切密度即全站生效；
- `check-design-tokens.mjs` 的 **T1** 不再为 `theme-presets.css` 开缩放口子，
  字号阶梯只剩 `design-system/tokens/typography.css` 一处声明
  （`simple-large` 大字预设也在同一文件，见 `typography.md`「无障碍大字档」）。

### E13 · 多行文字按钮与卡片式选项按钮不受高度档约束

- **位置**（12 处，全部带 `h-auto` 或 `flex-col` 卡片结构）：
  - 多行文字按钮（`h-auto` + `whitespace-normal` + `min-h-*`）：
    `features/models/components/dialogs/sync-wizard-dialog.tsx`、
    `features/channels/components/dialogs/upstream-update-dialog.tsx`、
    `features/usage-logs/components/common-log-mobile-card.tsx`、
    `features/usage-logs/components/model-badge.tsx`、
    `features/dashboard/components/overview/overview-dashboard.tsx`、
    `features/playground/components/chat/playground-empty-state.tsx`；
  - 卡片式选项 / 触发器（多行内容，高度随内容）：
    `features/wallet/components/recharge-form-card.tsx`（金额档位、支付方式）、
    `features/keys/components/api-key-group-combobox.tsx`（分组选择卡片）。
- **与文档差异**：Button 的高度只来自 `size` 档（md 36 / sm 32 / icon 四档）。
  上述按钮用 `h-auto` + `min-h-*` 让高度随内容增长，超出阶梯。
- **理由**：这些不是「单行按钮」，而是**可点击的容器**：
  1. 长中文标签会折成 2–3 行，固定 36px 会把文字裁掉；
  2. 金额档位/支付方式是「卡片里塞三行信息」（金额、单价、折扣），本质是
     卡片而非按钮，规范的高度阶梯没有覆盖这种形态。
     固定高度在这里只会造成裁切或信息不可读，故保留 `h-auto`，`min-h` 只作
     触控地板（≥28px）。
- **约束**：
  1. 必须显式写 `h-auto`（或 `flex-col` 卡片结构），不允许出现
     「固定 `h-N` + `min-h-N`」的叠加写法；
  2. 单行按钮仍严格走 `size` 档，不得借本条逃避阶梯。
- **退出条件**：设计规范为「选项卡片 / 多行按钮」定义独立组件（含自己的
  高度与内边距 Token）后，改用该组件并撤销本条。

### E14 · Markdown 正文标题自成一套（24 / 18 / 16 / 14 / 14 / 12）

- **位置**：`components/ai-elements/response-renderer-blocks.tsx` 的
  `headingClasses`（AI 回答、模型输出等 Markdown 渲染），以及
  `components/ui/markdown.tsx` 的 `[&_h1]`…`[&_h4]` 后代选择器（`RichContent`
  的 markdown 分支、协议正文）。后者 2026-10-28 才从界面阶梯改过来 ——
  此前是 30 / 24 / 18 / 16，`h1` 与页面标题同号，正是本条要防的那种塌陷。
- **与文档差异**：UI 标题四层是 30 / 24 / 18 / 16；Markdown 的 `h1` 用 24px
  （等于 UI 的 h2），`h2` 用 18px（等于 UI 的 h3）。
- **2026-10-27 调整**：`h1` 原为 20px —— 20px 不在九档阶梯里，属于自造档位，
  已升到 `text-2xl`（24/600）。这样整套 prose 标题重新落回阶梯
  （24 / 18 / 16 / 14 / 14 / 12），例外范围只剩「prose 的 h1 不跟 UI h1 用 30px」。
- **理由**：Markdown 是**内容排版（prose）**，不是界面层级。把 `h1` 抬到 UI 的
  30px 会让回答里的标题比所在页面的卡片标题（18px）还大，破坏页面层级。
  docs-web 的文档正文同理。
- **约束**：只对 Markdown 渲染的内容生效；`Heading` / `CardTitle` /
  `DialogTitle` 等界面标题不得借用本条。
- **退出条件**：设计规范为「内容排版」单独定义 prose 阶梯（含正文基准字号）
  后，改引该阶梯并撤销本条。

### E15 · 链接式文字按钮用 `h-auto` 取消高度档

- **位置**（14 个文件，全部是 `variant='link'` + `size='sm'` + `h-auto px-0`）：
  `components/json-editor.tsx`、
  `features/models/components/{models-columns,vendors-table,description-cell,vendor-linked-models}.tsx`、
  `features/channels/components/{model-mapping-editor.tsx,drawers/channel-mutate-drawer.tsx}`、
  `features/task-plugins/components/plugin-website-link.tsx`、
  `features/auth/passkey/components/passkey-domain-selector.tsx`、
  `features/system-settings/auth/passkey-section.tsx`、
  `features/system-settings/models/task-plugin-pricing-editor.tsx`、
  `features/wallet/components/recharge-form-card.tsx`（「重试」）、
  `features/usage-logs/components/task-artifacts.tsx`（「点击预览视频」）、
  `features/usage-logs/components/columns/task-logs-columns.tsx`（「查看详情」）。
- **与文档差异**：Button 高度只来自 `size` 档（md 36 / sm 32）。链接式按钮显式
  写 `h-auto`，高度退回文本行盒（20px 左右）。
- **理由**：`variant='link'` 无填充、无描边、无内边距，视觉上就是一段带色的文字。
  给它套 32px 的盒子会在行内排版里制造 12px 的空白，且与相邻的 `<a>` 文字对不齐。
  高度在这里不是「按钮尺寸」，而是「文字行高」。
- **约束**：
  1. 只有 `variant='link'` 可以借本条，且必须同时写 `size='sm'`（字号仍走档位）；
  2. 必须写 `px-0`（否则 32px 档的左右内边距会把文字推离基线）；
  3. 有填充或描边的按钮一律不得写 `h-auto`。
- **退出条件**：Button 增加 `inline` 档位（无填充、无内边距、高度随文本）后，
  改用 `size='inline'` 并撤销本条。

### E16 · 残留的原生 `<button>` / `<input>`：结构性交互容器

- **位置**（47 处，AST 扫描口径：`components/` 与 `features/` 下的原生
  `<button>` / `<input>` / `<textarea>` / `<select>`，已排除 `components/ui/`
  自身实现与 `hidden` / `sr-only` / `opacity-0` 的覆盖层；2026-10-27 复核：
  原记 41 处，补登下列「隐藏 file input」3 处并核对其余 44 处仍成立）：
  - **只读指示符（4）**：Markdown 任务列表的 checkbox（`response-renderer.tsx`）、
    设置页模型勾选列表的原生 checkbox（`channel-model-weight-section.tsx`、
    `channel-pricing-section.tsx`）、react-hook-form 的 `type='hidden'`
    （`channel-mutate-drawer.tsx`）。清单口径：「checkbox / radio 保留原生」。
  - **隐藏 file input（3）**：`components/ai-elements/prompt-input.tsx`（上传附件）、
    `features/task-plugins/components/plugin-source-picker.tsx`（选择 JS 文件）、
    `features/system-settings/integrations/waffo-settings-section.tsx`（上传支付方式
    图标）。三者都是 `type='file'` + `hidden` / `sr-only`，用户看到的触发按钮是
    `<Button>`，input 只是文件句柄；`<Input>` 是文本框组件，无法替代 file input。
    清单口径：「隐藏的 file input 保留原生」。
  - **自研输入原语（2）**：`tag-input.tsx` 的无边框内联输入、
    `numeric-spinner-input.tsx` 的步进输入 —— 它们要贴父容器的描边与焦点环，
    套 `Input` 会多出一层边框和 40px 高度。
  - **独立挂件（5）**：`features/customer-service/CustomerServiceWidget.tsx`
    整体用内联样式渲染悬浮气泡与面板，不参与站内主题（见 E5）。
  - **整行 / 整格 / 整卡可点容器（20）**：`<button>` 里装的是多行内容
    （标题 + 说明 + 徽标）或整格内容（头像 + 用户名 + 状态）。代表：
    `advanced-custom-editor-dialog.tsx`、`codex-usage-dialog.tsx`、
    `channel-advanced-section.tsx`（折叠头）、`announcements-panel.tsx`、
    `api-keys-mutate-drawer.tsx`、`checkin-calendar-card.tsx`、
    `cost-optimization-section.tsx`、`task-pricing-matrix.tsx`、
    `model-group-selector.tsx`（下拉触发器）、`usage-logs/components/columns/*`
    与 `task-artifacts.tsx` 的单元格。
  - **图例 / 自绘 tab / 浮层触发器（10）**：`flow-charts.tsx`、
    `flow-node-filter.tsx`、`model-charts.tsx`、
    `consumption-distribution-chart.tsx`（VChart 图例切换）、
    `hero-terminal-demo.tsx`、`rankings-hero.tsx`（首页/排行页自绘 tab 下划线）、
    `common-logs-columns.tsx`（`PopoverTrigger render` 槽）、
    `multi-select.tsx`（已选标签 chip）。
- **与文档差异**：规范 2.1 要求操作入口统一用 Button。上述元素是**语义容器**，
  不是「操作落点」：Button 的用途被定义为「触发操作，是界面上唯一的主操作落点」，
  整行可点区域装的是内容而不是操作标签。
- **理由**：
  1. 转成 Button 会引入 36/32px 的固定高度与左右内边距，把多行内容裁掉或挤变形
     （与 E13 同因）；
  2. `PopoverTrigger` / `TooltipTrigger` 的 `render` 槽要求传入单个可接收 ref 的
     原生元素，套 Button 会出现两层 base-ui 原语；
  3. VChart 图例是 canvas 之外的 DOM 覆盖层，点击区域按图表坐标系定位。
- **约束**：
  1. 必须显式声明 1px 焦点环（`focus-visible:ring-1 focus-visible:ring-ring`）
     或依赖 `design-system/foundations/accessibility.css` 的全局
     `:where(a, button, [role='button'], [tabindex]):focus-visible`；
     写了 `outline-none` 的必须自带环 —— 现存 3 处（`checkin-calendar-card.tsx`、
     `numeric-spinner-input.tsx`、`advanced-custom-editor-dialog.tsx`）已补；
  2. 不得在容器里写 `text-[Npx]` 或 `h-N` 覆盖：字号与高度仍受 T1~T7 与
     B-02/B-03 约束（扫描已归零）；
  3. 新增「单行、单一操作」的原生 `<button>` 不允许 —— 那必须用 Button。
- **退出条件**：设计规范为「可点卡片 / 可点行 / 分段控制器」定义独立组件
  （含高度、内边距、焦点态 Token）后，逐个替换并撤销本条。

### E17 · 营销页与公共站点的动效节奏（300–500ms）

- **位置**：
  - `components/layout/components/public-header.tsx`（8 处 `duration-300` /
    `duration-500`、`ease-[cubic-bezier(0.16,1,0.3,1)]`）；
  - `components/ui/navigation-menu.tsx`（6 处 `duration-300` / `duration-[0.35s]`、
    `ease-[cubic-bezier(0.22,1,0.36,1)]`）；
  - `features/home/components/sections/{hero,features}.tsx`（3 处 `duration-300`）。
- **与文档差异**：`spacing.md`「动效」规定交互反馈只走 100 / 200ms 两档、
  缓动只用 `--ds-motion-ease`；上述位置是 300 / 350 / 500ms 与自定义
  cubic-bezier。
- **理由**：这是**营销页**的观感节奏，不是后台的响应速度。公共站点头部的
  展开、滚动吸附、大区块位移都发生在「用户正在看内容」的场景里，200ms 会
  显得急促；自定义缓动（`cubic-bezier(0.16,1,0.3,1)` 一类）正是营销页常用
  的「先快后缓」曲线。把它们压到 200ms 会让首页显得廉价 —— 这是视觉决策，
  不是可访问性收益。
- **约束**：
  1. 只对 `components/layout/components/public-header.tsx`、`navigation-menu.tsx`
     与 `features/home/**` 生效；
  2. **后台（`features/` 下 13 个管理端目录 + `components/data-table/**`）不得
     借用本条** —— 那里的交互动效一律 `ds-motion-fast` / `ds-motion-base`；
  3. 新增营销动效优先复用已有节奏（300 / 500），不要再引入第四个时长。
- **退出条件**：规范为营销页单独定义 `--ds-motion-marketing-*` 三档 Token 后，
  改引该 Token 并撤销本条。

### E18 · 非交互动效不受 100 / 200ms 约束

- **位置**：
  - 入场：`styles/index.css` 的 `.animate-appear` / `.animate-appear-zoom` /
    `.landing-animate-*`（0.6s）；
  - 循环：`skeleton-shimmer`（1.8s）、`terminal-demo-pulse`（1.5s）、
    `animate-caret-blink`（`ui/input-otp.tsx` 的 `duration-1000`）；
  - 数据可视化：`features/system-info/components/system-instances-panel.tsx`
    的 `transition-[stroke-dashoffset] duration-500`（进度环填充）、
    `[data-stream-fade]` 的 250ms 流式淡入。
- **与文档差异**：这些位置的时长不在 100 / 200 两档内。
- **理由**：`spacing.md`「动效」的约束对象是 **`transition` 驱动的交互反馈**
  —— 删掉它用户会以为「没点上」。上述三类都不属于这个范畴：
  入场动画的 0.6s 是观看节奏（压到 200ms 会变成闪一下）；循环动画的周期由
  内容决定（骨架屏 1.8s 是「还在加载」的语义，不是响应速度）；进度环填充与
  流式淡入表达的是「值在变化」，不是「操作被响应」。
  光标闪烁尤其明显：1s 是文本光标的固有节奏，改成 200ms 会让插入符闪到无法阅读。
- **约束**：
  1. 只适用于 `@keyframes` 动画与非交互的数据过渡；
  2. 不得用本条为「按钮 hover 300ms」「面板展开 500ms」这类交互反馈开脱 ——
     判定口诀见 `spacing.md`「动效」；
  3. 新增循环动画必须在 `prefers-reduced-motion` 下可关闭。
- **退出条件**：规范为「内容节奏」单独定义时长档（入场 / 循环 / 数据过渡）
  后，改引该档并撤销本条。

### E19 · 营销页内容区宽度 1800px

- **位置**：`features/pricing/index.tsx`（2 处 `max-w-[1800px]`）。
- **与文档差异**：`responsive.md`「布局」规定内容区最大宽度 1280px。
- **理由**：定价页是一张**宽表**（模型 × 输入/输出/缓存价格 × 多供应商），
  1280px 会把价格列挤成两行换行，横向比较立刻失效。它是营销页而不是后台
  内容区，没有「阅读行长」的问题。
- **约束**：
  1. 只对 `features/pricing/index.tsx` 生效；
  2. **弹窗不得借用本条** —— 弹窗上限仍是 1280px
     （`system-settings/models/channel-selector-dialog.tsx` 已从 1400 收到 1280）；
  3. 后台内容区（`features/` 下 13 个管理端目录）一律 1280px。
- **退出条件**：定价页改为「卡片式价格列表」（不再需要横向比较）后撤销本条。

### E20 · 装饰性描边不是 1px

- **位置**：
  - `features/home/components/sections/features.tsx` 的 `border-2`（营销装饰卡片）；
  - `components/ui/chart.tsx` 的 `border-[1.5px]`（图表内元素）。
- **与文档差异**：`spacing.md`「描边」规定界面描边 1px。
- **理由**：这两处都不是「界面分隔线」：营销装饰卡片的 2px 边框是视觉重量
  （在浅色营销背景上 1px 几乎看不见），图表内元素的 1.5px 是 canvas 缩放后的
  视觉补偿。应用内的卡片、弹窗、表格仍严格 1px。
- **约束**：只限上述两处；加载 spinner 的 `border-4` 圆环是**图形**而不是界面
  描边，本来就不受本条约束，不登记。
- **退出条件**：营销装饰改为背景色块 / 图表改用 SVG stroke-width Token 后撤销。

### E21 · 结构性圆角的任意值（仅剩 `rounded-[inherit]`）

- **状态**：**部分撤销**。tooltip 箭头的 `rounded-[2px]` 已改为阶梯最小档
  `rounded-xs`（4px）—— 4px 落在 10px 旋转方块上正好是一圈柔和过渡，
  「给 4px 会秃」这个判断在实测中不成立。规范里没有 2px，就不该有 2px。
- **仍然保留**：`components/ui/scroll-area.tsx` 的 `rounded-[inherit]`。
  它让滚动视口继承父容器圆角，是 Tailwind 的官方 escape hatch —— 阶梯里
  没有任何一档能表达「和父级一样」，写死任何一档都会在 `data-theme-radius`
  缩放时与父容器错位。
- **与门禁的关系**：T10 拦所有 `rounded-[…]`，只放行 `rounded-[inherit]` 与
  `rounded-[var(--radius-…)]`。所以这一条**不需要** ALLOWLIST 条目，
  门禁直接把它识别为合法写法。
- **退出条件**：Tailwind 提供「继承父级圆角」的原生工具类时撤销。

### E22 · 账户安全 / 偏好设置卡片的行标题用 16/600

- **位置**：
  - `features/security/components/account-action-card.tsx` 的
    `action.title`（「删除账户」「更改密码」两行）；
  - `features/profile/components/language-preferences-card.tsx` 的
    「界面语言」行标题。
- **与文档差异**：`typography.md` 的硬规则是「16/600 只允许当 `group-title`」，
  「名称 + 说明」成对出现的列表行默认 **16/500**（`text-base font-medium`）。
  这三处用了 16/600（`text-base font-semibold`）。
- **理由**：2026-10-27 按用户截图批注「16px，加粗」明确指定这三处上调一档。
  这不是「忘了改」——同一页其余列表行（`account-bindings.tsx` 的账户绑定条目、
  `login-session-item.tsx` 的登录设备行）仍是 16/500，改动是有边界的。
- **约束**：
  1. **只限上述三处**，不得推广成「所有行标题都 16/600」；
  2. 不得改回 `font-medium` —— `features/security/__tests__/page.test.tsx` 的
     `renders card row titles at 16/600 above their 14px descriptions` 守着这条；
  3. 新增卡片若要用 16/600 行标题，必须先在这里登记，不能顺手抄。
- **退出条件**：用户收回该批注，或 16/600 行标题与同卡片 `group-title` 的层级
  冲突被重新定档（届时全站行标题统一回 16/500，删本条）。

### E23 · 固定尺寸容器内的图标小于 16px

- **位置**（12 个文件，共 13 个图标；`spec-guards.test.ts` 的
  `SMALL_GLYPH_ALLOW` 与审计脚本 `SMALL_ALLOW` 同源）：
  | 文件                                                     | 图标         | 尺寸                      | 容器                              |
  | -------------------------------------------------------- | ------------ | ------------------------- | --------------------------------- |
  | `components/ui/checkbox.tsx`                             | 对勾         | 12px                      | 16px 方框                         |
  | `components/ui/badge.tsx`                                | 任意         | 12px（`[&>svg]:size-3!`） | 24px 徽章                         |
  | `components/ui/avatar.tsx`                               | 任意         | 12–16px                   | 头像 24/32/40px 三档              |
  | `components/ui/icon-badge.tsx`                           | 任意         | 12px                      | 20px 徽章（`xs` / `stat` 小屏档） |
  | `components/ui/calendar.tsx`                             | 月份导航箭头 | 14px                      | 日期格                            |
  | `components/ui/sidebar.tsx`                              | 分组标题图标 | 14px                      | 12px 文字档                       |
  | `components/tag-input.tsx`                               | 删除 `X`     | 12px                      | Badge 内                          |
  | `components/command-menu.tsx`                            | 装饰箭头     | 12px                      | 16px 提示行                       |
  | `components/json-code-editor.tsx`                        | 工具栏 5 个  | 14px                      | 密集代码视口（E2）                |
  | `features/channels/components/numeric-spinner-input.tsx` | `+` / `−`    | 12px                      | 24px 步进按钮                     |
  | `features/profile/components/checkin-calendar-card.tsx`  | 星标 12px    | 12px                      | 签到格                            |
  | `features/channels/components/channel-priority-demo.tsx` | —            | —                         | 演示组件                          |
- **与文档差异**：规范 §2.2 的尺寸表最小档是 16px（侧边栏 / 导航 / 状态 / 紧凑
  辅助）。上述位置放 16px 会溢出容器或压掉相邻文字，因此降到 12 / 14px ——
  这是**容器物理约束**，不是审美偏好，规范表覆盖不到这类固定尺寸容器。
- **理由**：全部是**容器约束**，不是审美偏好。16px 方框里塞 16px 字形，边框会被
  图标顶破；24px 徽章里塞 16px，上下各剩 4px，视觉上反而更挤。
- **约束**：
  1. 白名单**只按文件路径**生效，不做「小于 16px 一律放过」的模糊匹配——
     新文件写小图标照样会被守卫拦下；
  2. `features/dashboard/` 曾一度加进白名单，实际它的小图标都靠祖先
     `[&>svg]:size-*` 约束、图标元素本身没写尺寸，**已移除**。白名单里每一条
     都必须是「图标元素自己写了小于 16px 的类名」；
  3. 容器放大到能容纳 16px 时，同步删掉对应白名单条目。
     已按这条清过一轮（2026-10-28）：`icon-badge` 的 `sm` / `stat` 桌面档从
     28px 容器配 14px 字形改成 **16px 字形**（28 − 2×6 = 16，放得下），
     只有 20px 的 `xs` / `stat` 小屏档仍留 12px。I2 的已登记例外因此少了 16 条。
- **退出条件**：容器尺寸调整到 ≥ 24px（16px 字形 + 上下各 4px 内边距）时撤销。
  注：2026-10-28 规范四次调整尺寸表（先「默认 20px / 导航 20–24」，后改为
  「逐场景固定 16/20/32/48」，10:58 又改为「16/24/32/48」并取消 20px，
  11:41 恢复 20px 为默认档、侧边栏与紧凑辅助保留 16px，13:24 再改为
  **默认 18px 并把侧边栏提到 18**），本节的判据始终不变 —— 白名单只覆盖
  「容器放不下 16px」的位置，**不随尺寸表变化新增或删除条目**。
  唯一受影响的条目是 `ui/empty.tsx` 的「有底框」变体：它原来写 16px
  只是因为「16px 是默认档」，并不是容器放不下 —— 32px 方框里放 18px 上下
  各剩 7px，放得下。所以那一处一路跟着默认档走（16 → 20 → 现在
  **`size-4.5`**），不是新增例外。
  同一原因：10:58 版把规范里那张「容器约束（12 / 14px 字形的唯一合法来源）」
  表整段删掉了，但容器物理约束没有消失 —— 16px 方框里的对勾仍然是 12px。
  规范不再列举不等于放开，本节继续作为这些位置的口径。

### E24 · 折扣 / 溢价角标用实心状态色 + 白字（部分主题组合低于 AA）

- **位置**：`features/pricing/components/discount-tag.tsx` —— 定价卡模型名后的价格角标
  （`x0.6` 折扣 / `x1.05` 溢价）。
- **差异**：规范 §1.1 要求 12px 文字达 WCAG AA 4.5:1。角标只有两种状态，都走
  实心底 + `text-on-emphasis`（`#FFFFFF`）：

  | 主题 | 折扣（倍率 < 1）`bg-success-hover` | 溢价（倍率 ≥ 1）`bg-destructive-hover` |
  | ---- | ---------------------------------- | -------------------------------------- |
  | 浅色 | `#15803D` = **5.02:1** ✅          | `#EF4444` = **3.76:1** ❌              |
  | 深色 | `#16A34A` = **3.30:1** ❌          | `#991B1B` = **8.31:1** ✅              |

  此前用的是 `bg-success-soft` + `text-success-soft-foreground`（≈6.6:1，两主题都达标）。

- **理由**：产品侧要求角标「便宜=绿、变贵=红」两种实心状态，柔和态浅底在同一张卡片上
  分不出强弱。底色借用已有的 `--hover-success` / `--hover-destructive`，**没有为角标
  新增 Token**（新增要同时维护 `:root` / `.dark` 两份取值）。
- **影响范围**：只此一处，定价卡的价格角标。
- **已做的补偿**：文字 12px/600（非细体）；角标是附加信息而非正文，折后/溢价后的实际
  价格在卡片正文里以正常前景色呈现；`title` 属性给出 `-10%` / `+5%` 原文，供读屏确认。
- **退出条件**：浅色溢价改用 `bg-destructive`（`#DC2626`，**4.83:1**）即达 AA；深色折扣
  需要新增一档「深色底上压得住白字」的深绿 Token 并同时声明两主题。守卫
  `design-system/__tests__/status-badge-contrast.test.ts` 与底色一起断言，改色会立刻红。

### E25 · 首屏渐变标题走上游调色板直用色（T7）

- **位置**：`features/home/components/sections/hero.tsx` —— 首屏主标题
  「直达全球大模型」（Vast Range of AI Models）的渐变行。
- **差异**：T7 禁止调色板直用色（`from-blue-400 …`），颜色应走 `chart-*` 等
  语义 Token。此处按用户要求与上游 new-api 保持**逐类一致**：
  `bg-gradient-to-r from-blue-400 via-violet-400 to-purple-500 bg-clip-text
  text-transparent`（蓝 → 紫 → 洋红）。
- **理由**：上游同位置就是这组类名，须逐类复刻；此前改用的 `chart-1/3/4`
  会随主题预设漂移（绿色系预设下渐变变绿），无法保证跨主题恒定，也与上游
  渲染不一致。这是品牌首屏的固定视觉资产，不是随主题流动的语义色。
- **影响范围**：只此一处，首屏渐变标题一行。
- **已做的补偿**：代码内注释写明来源与不变量；`ALLOWLIST` 同步登记本条。
- **退出条件**：若上游将渐变改为语义 Token 或产品放弃与上游对齐首屏视觉，
  即改回 Token 写法并删除本条。

## 新增例外的流程

1. 先确认现有 Token 真的覆盖不了 —— 绝大多数「需要新字号」其实是排版没用对；
2. 在本文档追加一节，写清位置、差异、理由、影响范围、退出条件；
3. 在 `scripts/check-design-tokens.mjs` 的 `ALLOWLIST` 加对应条目并写明理由；
4. 提交说明里引用例外编号。

没有退出条件的例外不接受。

### D5 · 组件度量对齐规范 §2.1（已完成）

按规范 §2.1 组件表逐项校正共享组件，全部只改 `components/ui/` 一处：

| 组件                  | 规范要求                                            | 原值                                    | 现值                                    |
| --------------------- | --------------------------------------------------- | --------------------------------------- | --------------------------------------- |
| Badge                 | 高约 24px、内边距 12×4px、胶囊 r-full               | h-5(20px)、px-2(8px)、rounded-4xl(24px) | h-6、px-3/py-1、rounded-full            |
| Card                  | 头部/内容区内边距 24px                              | py-4/px-4(16px)                         | `--ds-card-padding`（comfortable 24px） |
| Tabs                  | 容器高约 40px、内边距 4px、触发器 12×6px            | h-8(32px)、p-[3px]、px-1.5/py-0.5       | h-10、p-1、px-3/py-1.5                  |
| Button md             | 内边距 12×8px、图文间距 4px                         | px-2.5(10px)、gap-1.5(6px)              | px-3、gap-1                             |
| Button sm             | 内边距 8×6px、图文间距 0                            | px-2.5(10px)、gap-1(4px)                | px-2、gap-0                             |
| Dialog / Alert Dialog | 宽约 420px、头部 24px、内容左右 24px/上 8px/下 32px | sm:max-w-sm(384px)、p-4(16px)           | sm:max-w-[26.25rem]、px-6/pt-6/pb-8     |

两处顺带修正：

1. **`--ds-card-padding` 是三档密度 Token 但从未被引用**——密度切换对卡片
   内边距完全无效。本次 Card 全族（Card / CardHeader / CardContent /
   CardFooter）改引该 Token，密度才真正贯通到卡片。`size=sm` 档按 0.75
   比例跟随，不另设死值。
2. **Tabs 容器底色**：提交 `875581015` 把 default 变体改成 `bg-background`，
   与规范 §2.1「容器 Surface/secondary、激活触发器 Surface/background」相反，
   本次改回 `bg-secondary`。

### D6 · 颜色规则 T7 与状态色迁移的对比度前置条件（已完成）

规范 §1.1 要求「所有颜色按语义变量使用，不直接写死色值」。静态规则
**T7**（`check-design-tokens.mjs`）扫描调色板直用类。

**现状（2026-10-27 复核）**：T7 原始清单 **238 处 / 16 文件**，全部落在
ALLOWLIST 内（分类色板、代码高亮、图表序列色、营销装饰色），**待迁移项 0**。
此前记录的「380 处 / 69 文件待迁移」已在补齐 `--{status}-soft` /
`--{status}-soft-foreground` 语义 Token 后清零 —— 柔和态徽标改走
`bg-{status}-soft` + `text-{status}-soft-foreground`，取值等于原渲染值，
迁移零视觉变化，对比度没有回归。

下面的对比度表格保留为**原始证据**，说明为什么当初必须先补柔和态 Token
而不能直接替换：

**迁移前必须解决的对比度问题**（实测，oklch→sRGB→WCAG 比值）：

| 现有写法                         | 对比度     | 直接换 Token 后                             | 结论         |
| -------------------------------- | ---------- | ------------------------------------------- | ------------ |
| `text-emerald-600`               | 3.67:1     | `text-success` 3.67:1                       | 持平，可迁   |
| `text-red-600`                   | 4.76:1     | `text-destructive` 4.76:1                   | 持平，可迁   |
| `text-rose-600`                  | 4.51:1     | `text-destructive` 4.76:1                   | 更优，可迁   |
| `text-green-600`                 | 3.22:1     | `text-success` 3.67:1                       | 更优，可迁   |
| `text-amber-600`                 | 3.19:1     | `text-warning` 2.93:1                       | 略降，需评估 |
| `bg-amber-50` + `text-amber-900` | **8.77:1** | `bg-warning/10` + `text-warning` **≈2.7:1** | **不可迁**   |

即：**纯文字与实心填充可以安全迁移；「浅色底 + 深色文字」的柔和态徽标不能**——
后者占待迁移项的相当比例，直接替换会把 AA 达标（8.77:1）打到 2.7:1，
是不折不扣的可访问性回归。

退出条件（**已满足**）：柔和态 `--{status}-soft` / `--{status}-soft-foreground`
语义 Token 已补齐（浅色底取原 `*-50`、深色文字取原 `*-900`，暗色主题取
`*-950` / `*-100`，**取值等于原渲染值**），剩余迁移已执行完毕，
T7 随 `lint:design:strict` 一起进入阻断。
