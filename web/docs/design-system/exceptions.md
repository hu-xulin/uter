# Exceptions

规范的价值取决于「例外是否被记录」。凡是无法接入 Token 的场景，都必须在这里
登记：理由、影响范围、退出条件。

代码侧的对应登记在 `scripts/check-design-tokens.mjs` 的 `ALLOWLIST`。
两处必须同步 —— 只改一处说明例外已经失控。

## 已登记例外

### E2 · 密集等宽的行高用 22px（已随 mono 定档降级）

- **状态**：**字号部分已失效**。mono 阶梯从 16/24 定为 **13/20** 后，
  「16px 等宽塞不进表格列」这个前提消失，13px 直接可用，不再需要把字号
  降到 14px。字号侧现在走标准 `text-mono`，不算例外。
- **仍然保留的部分**：表格单元格、日志列里的等宽内容（API Key / 模型 ID /
  请求 ID / 计费表达式）**行高**用 22px（`leading-[var(--ds-line-mono-dense)]`），
  比 mono 标准的 20px 松一点，避免密集表格里上下两行贴在一起。
- **位置**：表格单元格、日志列、定价卡片、详情页内嵌代码块。
- **退出条件**：表格行高改为由 `--ds-row-height-*` 统一驱动时，撤销本条。

### E3 · 行内代码随正文（已随 mono 定档失效）

- **状态**：**已失效，不再是例外**。mono 定为 13/20 后，Markdown 行内 `<code>`
  直接用 `text-mono` 即可；它嵌在 14px 正文里只小 1px，不会再造成原有的
  「16px 行内代码撑高整行」问题。实现见 `components/ui/markdown.tsx` 的
  `[&_code]:text-mono`。
- **保留本条的用途**：记录「行内代码不应跟随正文放大」这一结论，避免以后有人
  为了「看起来齐」把行内代码改回 `text-sm`。

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

### E10 · hero 终端的卡片投影与 live 状态点辉光

- **位置**：`features/home/components/hero-terminal-demo.tsx`
  - 卡片主体：`shadow-[0_20px_50px_-25px_rgba(15,23,42,0.18)]`（light）/
    `dark:shadow-[0_20px_60px_-25px_rgba(0,0,0,0.7)]`（dark）；
  - live 状态点：`shadow-[0_0_8px_rgba(16,185,129,0.45)]`。
- **与文档差异**：规范要求除弹窗与浮层外不投影（`spacing.md`「投影」节）。
- **理由**：
  1. **卡片主体投影是产品决策**：首页 hero 终端是一张"悬浮在页面上的演示窗口"，
     需要在明亮的 hero 背景上明确脱离页面平面。与大面积的柔和下沉投影相比，
     1px 描边在营销页的视觉权重不足，撑不住这张卡片的展示核心地位。
  2. **live 状态点辉光是语义指示**：这是「200 ok」在线指示灯，辉光是状态语义
     （在线 = 发光），不是层级投影。
  这两处都属于**首页营销展示组件的刻意例外**，应用内常规卡片仍然不投影，
  层级靠 1px 描边 + 表面色差表达（`spacing.md` 不变）。
- **退出条件**：首页 hero 改为全出血/无背景布局（不再需要脱离页面平面），
  或设计规范为营销展示卡片单独定义 `elevation-marketing` 语义 Token 时，
  改为引用该 Token 并撤销本条例外。

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

### E12 · 首页代码卡片 13px（已升格为标准，例外撤销）

- **状态**：**已撤销**。本条的 13px 主张已被采纳为 **mono 阶梯的正式值**
  （`--text-mono: 13px / 20px`），首页代码卡片现在直接用 `text-mono`，
  与其他等宽文本同档，不再需要任何例外。
- **保留本条的用途**：记录「为什么 mono 是 13px 而不是 14px」的原始证据 ——
  首页代码卡片请求区固定 235px、整体固定 400px 且不滚动，最长的 JSON 行
  （claude/gemini 嵌套响应、多行 curl 头）在 14px 下会贴近乃至溢出容器右缘。
  这一观察后来推广到全站等宽文本，成为 mono 定档的依据。
- **现状**：门禁 ALLOWLIST 中对应的 T2 条目已删除；`text-[13px]` 不再是
  合法写法，等宽字号一律写 `text-mono`。

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
fixed 浮动操作条，以及登记为例外的 E9 / E10（E10 含首页 hero 展示终端的
卡片投影——产品决策的刻意例外，不是遗漏）。

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

### D5 · 组件度量对齐规范 §2.1（已完成）

按规范 §2.1 组件表逐项校正共享组件，全部只改 `components/ui/` 一处：

| 组件 | 规范要求 | 原值 | 现值 |
| --- | --- | --- | --- |
| Badge | 高约 24px、内边距 10×2px、胶囊 r-full | h-5(20px)、px-2(8px)、rounded-4xl(24px) | h-6、px-2.5、rounded-full |
| Card | 头部/内容区内边距 24px | py-4/px-4(16px) | `--ds-card-padding`（comfortable 24px） |
| Tabs | 容器高约 40px、内边距 4px、触发器 12×6px | h-8(32px)、p-[3px]、px-1.5/py-0.5 | h-10、p-1、px-3/py-1.5 |
| Button md | 内边距 12×8px、图文间距 4px | px-2.5(10px)、gap-1.5(6px) | px-3、gap-1 |
| Button sm | 内边距 8×6px、图文间距 0 | px-2.5(10px)、gap-1(4px) | px-2、gap-0 |
| Dialog / Alert Dialog | 宽约 420px、头部 24px、内容左右 24px/上 8px/下 32px | sm:max-w-sm(384px)、p-4(16px) | sm:max-w-[26.25rem]、px-6/pt-6/pb-8 |

两处顺带修正：

1. **`--ds-card-padding` 是三档密度 Token 但从未被引用**——密度切换对卡片
   内边距完全无效。本次 Card 全族（Card / CardHeader / CardContent /
   CardFooter）改引该 Token，密度才真正贯通到卡片。`size=sm` 档按 0.75
   比例跟随，不另设死值。
2. **Tabs 容器底色**：提交 `875581015` 把 default 变体改成 `bg-background`，
   与规范 §2.1「容器 Surface/secondary、激活触发器 Surface/background」相反，
   本次改回 `bg-secondary`。

### D6 · 颜色规则 T7 与状态色迁移的对比度前置条件（进行中）

规范 §1.1 要求「所有颜色按语义变量使用，不直接写死色值」。新增静态规则
**T7**（`check-design-tokens.mjs`）扫描调色板直用类，报告模式运行。

当前实测：**622 处**调色板直用，其中 **242 处 / 16 文件**登记为例外
（分类色板、代码高亮、图表序列色、营销装饰色），**380 处 / 69 文件**为待迁移的
状态色。

**迁移前必须解决的对比度问题**（实测，oklch→sRGB→WCAG 比值）：

| 现有写法 | 对比度 | 直接换 Token 后 | 结论 |
| --- | --- | --- | --- |
| `text-emerald-600` | 3.67:1 | `text-success` 3.67:1 | 持平，可迁 |
| `text-red-600` | 4.76:1 | `text-destructive` 4.76:1 | 持平，可迁 |
| `text-rose-600` | 4.51:1 | `text-destructive` 4.76:1 | 更优，可迁 |
| `text-green-600` | 3.22:1 | `text-success` 3.67:1 | 更优，可迁 |
| `text-amber-600` | 3.19:1 | `text-warning` 2.93:1 | 略降，需评估 |
| `bg-amber-50` + `text-amber-900` | **8.77:1** | `bg-warning/10` + `text-warning` **≈2.7:1** | **不可迁** |

即：**纯文字与实心填充可以安全迁移；「浅色底 + 深色文字」的柔和态徽标不能**——
后者占待迁移项的相当比例，直接替换会把 AA 达标（8.77:1）打到 2.7:1，
是不折不扣的可访问性回归。

退出条件：为柔和态新增 `--{status}-soft` / `--{status}-soft-foreground`
语义 Token（浅色底取现状 `*-50`、深色文字取现状 `*-900`，暗色主题取
`*-950` / `*-100`，**取值等于当前渲染值，迁移零视觉变化**），补齐后再
执行剩余迁移，并把 T7 切到阻断模式。
