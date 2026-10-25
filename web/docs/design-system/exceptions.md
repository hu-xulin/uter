# Exceptions

规范的价值取决于「例外是否被记录」。凡是无法接入 Token 的场景，都必须在这里
登记：理由、影响范围、退出条件。

代码侧的对应登记在 `scripts/check-design-tokens.mjs` 的 `ALLOWLIST`。
两处必须同步 —— 只改一处说明例外已经失控。

## 已登记例外

### E2 · 密集等宽文本用 14/22

- **位置**：表格单元格、日志列、定价卡片、详情页内嵌代码块中的 API Key /
  模型 ID / 请求 ID / 计费表达式。
- **与文档差异**：文档 `mono` 为 16/24，此处用 14/22
  （`leading-[var(--ds-line-mono-dense)]`）。
- **理由**：这些标识符出现在列宽受限的表格里。16px 等宽会让请求日志表的行高
  增加 20% 以上、列宽溢出，一屏能看到的行数显著减少。
- **退出条件**：表格改为卡片式布局，或列宽不再受限时。

### E3 · 行内代码用 14/20

- **位置**：Markdown 渲染的行内 `<code>`。
- **与文档差异**：文档 `mono` 为 16/24，此处与上下文正文（14px）对齐。
- **理由**：行内代码嵌在 14px 正文里，若单独用 16px 会造成行内字号跳变和行高
  抖动，可读性反而下降。
- **退出条件**：正文基准改为 16px 后，行内代码同步为 16px。

### E4 · 图表 canvas 字号为数值

- **位置**：`features/*/lib/charts.ts`、`features/*/lib/flow.ts`、VChart option 里的
  `fontSize`。
- **理由**：VChart 走 canvas 绘制，不读 CSS 变量，`fontSize` 必须是数字。
- **约束**：取值必须等于「图表轴标签 12px」，不得随意写 10 或 11。
- **退出条件**：无（canvas 渲染的固有限制）。

### E5 · 第三方客服挂件

- **位置**：`features/customer-service/CustomerServiceWidget.tsx`。
- **理由**：挂件样式由其自身注入，无法接入本项目 Token。
- **退出条件**：换成自研组件或挂件提供主题变量注入。

### E6 · 错误页巨型状态码

- **位置**：`features/errors/*.tsx` 的 `text-[7rem]`。
- **理由**：401/403/404/503 的数字是装饰性图形，不属于内容层级，不参与九档阶梯。
- **退出条件**：无。

### E7 · 多行主标题行高 1.5

- **位置**：`design-system/foundations/typography.css` 的
  `.ds-heading--display-multiline`；语义 Token `--ds-line-display-multiline`。
  当前使用处：首页 hero 主标题（`Heading variant='display' multiline`）。
- **与文档差异**：文档 display 为 36/700/40（单行）；多行主标题用 **无单位比例
  1.5**（36px = 54px，移动端 30px = 45px）。
- **历史值**：1.35（36px ≈ 48.6px）。首页实测 3–4 行主标题在 1.35 下行与行仍偏挤，
  按反馈上调到 1.5。
- **理由**：中文营销主标题常折成 3–4 行，40px 行高只有 1.11，行与行挤在一起；
  1.35 实测仍不足。
  用无单位比例是为了让行高随响应式字号同步缩放，不会出现「移动端字号变小、
  行高还是 48px」的倒挂。
- **约束**：只对 3 行以上的主标题开启；单行标题仍走 40px 紧行高。
- **退出条件**：主标题改为单行，或文案长度稳定在 2 行以内。

### E8 · 移动端全屏菜单用 16/24

- **位置**：`components/layout/components/public-header.tsx` 移动端全屏菜单项。
- **与文档差异**：文档一级导航为 14/500/20；移动端菜单项用 16/24。
- **理由**：全屏菜单是触屏列表，与桌面一级导航的使用场景不同。14px 在手机
  全屏列表里偏小，点按热区也偏窄。
- **退出条件**：无（桌面一级导航仍严格 14/500/20）。

### E9 · 渠道优先级拖拽演示的抬升投影

- **位置**：`features/channels/components/channel-priority-demo.tsx` 的
  `lifted && 'shadow-lg'`。
- **与文档差异**：文档要求除弹窗与浮层外不投影。
- **理由**：这是拖拽中的**瞬时浮起态**，卡片离开文档流、z-index 提升，性质
  等同浮层。去掉投影后「正在拖动」几乎看不出来。
- **退出条件**：拖拽交互改为非浮层式的视觉反馈（边框/位移）。

### E10 · hero 终端的 live 状态点辉光

- **位置**：`features/home/components/hero-terminal-demo.tsx` 的
  `shadow-[0_0_8px_rgba(16,185,129,0.45)]`。
- **与文档差异**：规范要求除弹窗与浮层外不投影。
- **理由**：这是「200 ok」live 指示点的**彩色辉光**，语义是「在线」，不是
  表达层级的投影。卡片本体已按规范移除投影，层级改由 1px 描边表达。
- **退出条件**：live 指示点改用 `animate-ping` 圆点或独立语义类表达在线状态。

### E11 · 「Simple Large-font」预设自带大字阶梯

- **位置**：`styles/theme-presets.css` 的 `[data-theme-preset='simple-large']`
  及其 `.dark` 变体里的 `--text-*`。
- **与文档差异**：字号阶梯的唯一来源是
  `design-system/tokens/typography.css` 的 `@theme`；这里出现了第二处声明。
- **理由**：该预设的**名称与产品语义就是大字模式**，用户在主题选择里主动开启，
  字号变化是它的显式契约，不是「颜色主题顺带改了字号」的维度串味。直接删掉
  会静默砍掉一个无障碍能力。
- **退出条件**：拆出独立的「文字大小」维度（`data-text-scale`）后，把大字阶梯
  搬进 `design-system/tokens/typography.css`，预设只负责切属性。

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
（`column-pinning.ts`），首页 hero 的展示终端与供应商入口 chip 也已去掉投影。
现存投影只出现在 popover / dropdown / menubar / context-menu / select /
combobox / hover-card / navigation-menu / floating-window / 移动端底栏 /
fixed 浮动操作条，以及登记为例外的 E9 / E10。

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
  （`simple-large` 大字预设按 E11 单独登记）。

## 新增例外的流程

1. 先确认现有 Token 真的覆盖不了 —— 绝大多数「需要新字号」其实是排版没用对；
2. 在本文档追加一节，写清位置、差异、理由、影响范围、退出条件；
3. 在 `scripts/check-design-tokens.mjs` 的 `ALLOWLIST` 加对应条目并写明理由；
4. 提交说明里引用例外编号。

没有退出条件的例外不接受。
