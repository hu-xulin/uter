# New API Design Spec · 上游 new-api 设计规范（合并版）

> **文档性质。** 本文件提取上游 new-api（QuantumNous/new-api，基线 commit `45746ee`，  
> 2026-11-02）的设计标准，按《UTER Design System》的章节格式整理，用于以 new-api  
> 的设计语言为基准的新项目 / 新界面。
>
> **合并裁决规则**（本文件所有取值的来源）：

|   |   |   |
| - | - | - |

> | 维度                                | 来源                                   |
> | --------------------------------- | ------------------------------------ |
> | 品牌主色                              | **`#6565E8`**（唯一改写项，浅色 / 深色同值）       |
> | 字号阶梯、行高、字重                        | **UTER Design System**（十档 v1.2）      |
> | 其余全部（颜色、间距、圆角、投影、动效、组件尺寸、断点、焦点环…） | **上游 new-api**                       |
> | 上游未定义的项                           | **回退 UTER Design System**（在正文标注「回退」） |
>
> **上游取值的权威来源是代码**：`web/src/styles/theme.css`、  
> `web/src/styles/theme-presets.css`、`web/src/styles/index.css`、  
> `web/src/components/ui/*`。本文件描述规则与取值，两者不一致时以代码为准。
>
> - **规范基线**：上游 new-api 2026-11-02 快照 + UTER 字号规范 v1.2 + 品牌色 `#6565E8`。
> - 事实锚点：`theme.css:97-250`（语义色）、`theme.css:88-98`（圆角）、  
>   `theme-presets.css:696-731`（密度档）、`index.css`（动效/骨架屏/工具类）。

---

## 目录

- [1. 合并裁决与对比度](#1-合并裁决与对比度)
- [2. 视觉基调](#2-视觉基调)
- [3. 颜色](#3-颜色)
  - [3.1 语义色板（浅色 / 深色）](#31-语义色板浅色--深色)
  - [3.2 品牌主色与派生](#32-品牌主色与派生)
  - [3.3 文字层级](#33-文字层级)
  - [3.4 图表色与仪表盘强调色](#34-图表色与仪表盘强调色)
  - [3.5 主题预设](#35-主题预设)
- [4. 字号与排版](#4-字号与排版)
  - [4.1 十档字号表（UTER v1.2）](#41-十档字号表uter-v12)
  - [4.2 行高、字重与字距](#42-行高字重与字距)
  - [4.3 字体家族与字体轴](#43-字体家族与字体轴)
- [5. 间距与布局](#5-间距与布局)
- [6. 圆角](#6-圆角)
- [7. 描边与投影](#7-描边与投影)
- [8. 动效](#8-动效)
- [9. 组件规范](#9-组件规范)
- [10. 图标](#10-图标)
- [11. 断点与响应式](#11-断点与响应式)
- [12. 焦点环、触控目标与可访问性](#12-焦点环触控目标与可访问性)
- [13. 主题维度独立性](#13-主题维度独立性)
- [14. 特性工具类清单](#14-特性工具类清单)
- [15. 禁止事项总表](#15-禁止事项总表)

---

## 1. 合并裁决与对比度

写代码前先明确本规范三件事的归属：

| 事项           | 裁决                   | 说明                                                       |
| ------------ | -------------------- | -------------------------------------------------------- |
| 品牌主色         | `--primary: #6565E8` | 全局唯一品牌入口；浅色 / 深色同值                                       |
| 字号 / 行高 / 字重 | UTER 十档 v1.2         | 上游无全局 `--text-*` 阶梯（用 Tailwind 默认值且被密度档缩放），统一替换为 UTER 十档 |
| 其余设计值        | 上游 new-api           | 包括圆角基准 1rem、描边为主无投影、ring-3 焦点环、密度缩放字号等                   |
| 上游未定义        | UTER 回退              | 文中标注「回退」：触控目标 24×24、文字细档（placeholder / disabled / link）等 |

**对比度实测（品牌色替换后必须复核的组合）**：

| 组合                                                      | 对比度      | 判定                                                                                                                                                                                |
| ------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#6565E8` 配白字（主按钮 / 主色前景）                               | ≈ 4.59:1 | ✅ AA 普通文本（≥ 4.5:1）。按钮文字 14/500 属普通文本档，达标；大文本（≥18.66px 粗体 / ≥24px）按 3:1 同样达标。余量仅 0.09，后续调色必须重算 |
| `#6565E8` 配 `oklch(0.145 0 0)` 近黑背景（深色底上的品牌色文字）          | ≈ 4.32:1 | ⚠️ 普通文本不达 AA 4.5:1；大文本按 3:1 达标。深色底上品牌色仅作点缀/大文本使用，正文文字走 `--foreground` |
| 上游 `--muted-foreground`（oklch(0.49 0 0) ≈ `#757575`）配白底 | ≈ 4.6:1  | ✅ AA 普通文本                                                                                                                                                                         |

> `#6565E8` 选型依据：品牌初拟 `#6568E8` 配白字 ≈ 4.47:1 不达 AA，绿色通道 `0x68→0x65` 降亮度后达标（4.59:1），色相差可忽略。
> 每次**替换品牌色或调整背景 Token** 后，必须重算上表，不能沿用旧结论。

## 2. 视觉基调

- **OpenAI 风格的中性画布 + 品牌点缀**：近黑前景、细描边、**以描边分层而不是投影**、大圆角。
- 圆角基准 **1rem（16px）**，明显比传统 SaaS 更圆润；Badge 全胶囊、Card / Dialog 22.4px。
- 深色模式是「炭灰画布」（background oklch(0.235 0 0) ≈ `#2A2A2A` 区间），不是纯黑蓝。
- 半透明修饰符（`X/NN`）是上游的常规表达（hover、glass、边框），不是违规写法。
- 原生控件跟随主题：`.dark` 下声明 `color-scheme: dark`，Dark Reader 据此识别内建暗色。

## 3. 颜色

### 3.1 语义色板（浅色 / 深色）

颜色是**语义变量**，组件不写死色值。上游全表如下（`theme.css:97-250`），  
仅 `--primary` 按本规范替换为 `#6565E8`：

| Token                                      | 浅色（`:root`）                                         | 深色（`.dark`）                                         |
| ------------------------------------------ | --------------------------------------------------- | --------------------------------------------------- |
| `--background` / `--foreground`            | `oklch(1 0 0)` / `oklch(0.145 0 0)`                 | `oklch(0.235 0 0)` / `oklch(0.965 0 0)`             |
| `--card` / `--card-foreground`             | `oklch(1 0 0)` / `oklch(0.145 0 0)`                 | `oklch(0.285 0 0)` / `oklch(0.965 0 0)`             |
| `--popover` / `--popover-foreground`       | `oklch(1 0 0)` / `oklch(0.145 0 0)`                 | `oklch(0.305 0 0)` / `oklch(0.965 0 0)`             |
| `--primary` / `--primary-foreground`       | **`#6565E8`** / 白                                   | **`#6565E8`** / 白                                   |
| `--secondary` / `--secondary-foreground`   | `oklch(0.95 0 0)` / `oklch(0.42 0.16 250)`          | `oklch(0.335 0 0)` / `oklch(0.9 0.05 250)`          |
| `--muted` / `--muted-foreground`           | `oklch(0.97 0 0)` / `oklch(0.49 0 0)`               | `oklch(0.305 0 0)` / `oklch(0.78 0 0)`              |
| `--accent` / `--accent-foreground`         | `color-mix(in oklch, primary 12%, background)` / 近黑 | `color-mix(in oklch, primary 20%, background)` / 近白 |
| `--destructive` / 前景                       | `oklch(0.577 0.245 27.325)` / `oklch(0.985 0 0)`    | `oklch(0.704 0.191 22.216)` / `oklch(0.985 0 0)`    |
| `--success` / 前景                           | `oklch(0.596 0.145 163.225)` / `oklch(0.985 0 0)`   | `oklch(0.696 0.17 162.48)` / 近黑                     |
| `--warning` / 前景                           | `oklch(0.681 0.162 75.834)` / 近黑                    | `oklch(0.769 0.188 70.08)` / 近黑                     |
| `--info` / 前景                              | `oklch(0.588 0.158 241.966)` / `oklch(0.985 0 0)`   | `oklch(0.613 0.14 239.919)` / 近黑                    |
| `--neutral` / 前景                           | `oklch(0.708 0 0)` / 近黑                             | `oklch(0.76 0 0)` / 近黑                              |
| `--border` / `--input`                     | `oklch(0.93 0 0)`（两者同值）                             | `oklch(1 0 0 / 10%)` / `oklch(1 0 0 / 17%)`         |
| `--ring`                                   | `oklch(0.708 0.16 249.003)`（上游固定蓝，与品牌色脱钩）           | `oklch(0.554 0.148 250.726)`                        |
| `--skeleton-base` / `--skeleton-highlight` | `oklch(0.97 0 0)` / `oklch(0.985 0 0)`              | `oklch(0.335 0 0)` / `oklch(0.44 0 0)`              |

**表格专用 Token**（上游独有，浅色均为 foreground 混入 background）：

| Token                                     | 浅色                             | 深色                             |
| ----------------------------------------- | ------------------------------ | ------------------------------ |
| `--table-row`                             | `var(--background)`            | 同左                             |
| `--table-header` / `--table-header-hover` | foreground 1.5% / 3% mix       | foreground 6% / 9% mix         |
| `--table-disabled` / `-hover` / `-border` | foreground 3% / 4.5% / 16% mix | foreground 7% / 9.5% / 24% mix |

**侧边栏专用 Token**：

| Token                                 | 浅色                                                 | 深色                                           |
| ------------------------------------- | -------------------------------------------------- | -------------------------------------------- |
| `--sidebar`                           | `color-mix(in oklch, foreground 0.5%, background)` | `oklch(0.225 0 0)`                           |
| `--sidebar-foreground`                | `oklch(0.145 0 0)`                                 | `oklch(0.95 0 0)`                            |
| `--sidebar-primary` / 前景              | `oklch(0.64 0.197 253.892)` / 白                    | `oklch(0.588 0.123 246.488)` / 白             |
| `--sidebar-accent` / 前景               | primary 12% mix / `oklch(0.579 0.196 255.909)`     | primary 20% mix / `oklch(0.9 0.05 250)`      |
| `--sidebar-border` / `--sidebar-ring` | `oklch(0.93 0 0)` / `oklch(0.58 0.2 250)`          | `oklch(1 0 0 / 11%)` / `oklch(0.7 0.17 250)` |

### 3.2 品牌主色与派生

`--primary` 是唯一品牌入口，**上游没有独立 hover / active 色阶 Token**，状态变化  
按上游惯例用三类写法：

1. **透明度修饰符**：`hover:bg-primary/90`、`bg-primary/80`、`ring-ring/50`；
2. **`color-mix` 浅底**：`--accent` / `--sidebar-accent` = primary 12%（深色 20%）混入 background；
3. **描边跟随**：`focus-visible:border-ring`。

**上游未定义**品牌色阶的 hover / active / subtle / border 派生档（回退 UTER）：  
需要「浅底加深一档」「悬停加深一档」且透明度写法观感不符时，参照 UTER §11.2 的  
`primary-hover` / `primary-active` / `primary-subtle` 模式为 `#6565E8` 派生同色相  
加深 12% / 24% 的档位，并同步登记到本节——不要散写新的近似色值。

**硬规则**：

1. 组件不得写品牌色字面值，一律 `bg-primary` / `text-primary` / `border-ring`；
2. 品牌色改值只改 `theme.css` 的 `:root` 与 `.dark` 两处 `--primary`；
3. `--ring` 是上游的独立蓝色焦点环取值，**不随品牌色自动变化**——若希望焦点环  
   跟品牌，须显式改 `--ring`（两处主题各一次），不允许组件里写 `ring-[#6565E8]`。

### 3.3 文字层级

上游**未定义** `--fg-*` 七档语义层，文字层级由三个既有 Token 表达：

| 层级   | Token                                                              | 典型用法                                                     |
| ---- | ------------------------------------------------------------------ | -------------------------------------------------------- |
| 一级   | `--foreground`                                                     | 标题、正文、输入值、表格内容                                           |
| 二级   | `--muted-foreground`                                               | 描述、辅助说明、placeholder（`placeholder:text-muted-foreground`） |
| 语义   | `text-destructive` / `text-success` / `text-warning` / `text-info` | 状态文字                                                     |
| 品牌强调 | `text-primary`                                                     | 链接与可交互强调                                                 |

**回退规则**：需要「三级弱信息（时间戳 / 元信息）」「禁用文字」「链接色」这类  
比上游三档更细的层级时，采用 UTER 的 `--fg-tertiary` / `--fg-disabled` /  
`--fg-link` 语义（在 `theme.css` 补声明，浅深各一次），不得用 `opacity` 或  
`text-foreground/NN` 临时凑层级——上游允许 `X/NN` 表达状态（hover / glass），  
但**文字层级**统一走语义 Token。

### 3.4 图表色与仪表盘强调色

- `--chart-1` … `--chart-5` 是**分类色**（浅色 5 档 oklch 见 §3.1，深色统一提亮到  
  L≈0.76），用于区分类别，不表达成败；状态语义走 `success / warning / info / destructive`。
- `--overview-accent-1/2/3`（同 chart-1/2/3）用于仪表盘强调。
- 上游未定义「分类色不做强调边框」等附加守卫——回退 UTER §11.4 的三条分类色  
  硬规则（不拿 chart-N 表达成功失败、不追求语义正确只追求可辨、边框表达层级）。

### 3.5 主题预设

`data-theme-preset` 切换，共 9 套（`theme-presets.css`）。每套可整体改写  
`--primary` 与表面桥（surface bridge）：

| 预设             | `--primary`（浅色 / 深色）                                          | 默认圆角基准   |
| -------------- | ------------------------------------------------------------- | -------- |
| underground    | `oklch(0.5315 0.0694 156.19)` / `oklch(0.6147 0.0867 154.73)` | 0.5rem   |
| rose-garden    | `oklch(0.5827 0.2418 12.23)` / `oklch(0.6476 0.2348 10.36)`   | 1rem     |
| lake-view      | `oklch(0.765 0.177 163.22)` / 同浅色                             | 0.75rem  |
| sunset-glow    | `oklch(0.5591 0.1882 25.33)` / `oklch(0.6387 0.1822 23.51)`   | 1rem     |
| forest-whisper | `oklch(0.5276 0.1072 182.22)` / `oklch(0.5991 0.1318 180.39)` | 0.5rem   |
| ocean-breeze   | `oklch(0.5461 0.2152 262.88)` / `oklch(0.623 0.188 259.81)`   | 0.3rem   |
| lavender-dream | `oklch(0.5709 0.1808 306.89)` / `oklch(0.6359 0.1699 307.95)` | 1rem     |
| simple-large   | `oklch(0.22 0 0)` / `oklch(0.94 0 0)`（整套餐重定义）                 | 0.5rem   |
| anthropic      | `oklch(0.685 0.142 38)`（≈ 陶土色） / `oklch(0.72 0.135 40)`       | 0.625rem |

要点：

- **surface bridge**：非 default / anthropic / simple-large 预设下，  
  card / popover / muted / accent / border / input / sidebar 全部用 primary 的  
  3%–28% `color-mix` 派生——换预设即整站色温跟随品牌色变化，无需逐 Token 手抄。
- **anthropic 预设**：暖奶油画布 `oklch(0.984 0.004 95)` ≈ `#faf9f5`，墨色前景，  
  chart 换 olive / sky / fig / cactus，默认 serif 字体轴。
- **simple-large 预设**：无障碍大字档（见 §4.1），同时是唯一重定义整套语义色的  
  黑白预设。

## 4. 字号与排版

字号整体采用 **UTER 十档 v1.2**。上游的字号事实（Tailwind 默认阶梯 + 密度档  
缩放 + 组件散写 `text-[0.8rem]`）**不再使用**；上游组件里的字号类名按下表  
重新映射（`text-sm` → 14px、`text-xs` → 12px、`text-base` → 16px 恰好同值，  
无需改类名；`text-[0.8rem]` 之类任意值必须替换为最近档位）。

### 4.1 十档字号表（UTER v1.2）

| Token           | 语义                   | 字号   | 字重  | 行高   | Tailwind              |
| --------------- | -------------------- | ---- | --- | ---- | --------------------- |
| display         | 页面主视觉                | 36px | 600 | 44px | `text-4xl`            |
| h1              | 页面标题（每页一个）           | 28px | 600 | 36px | `text-3xl`            |
| h2              | 区块标题                 | 22px | 600 | 30px | `text-2xl`            |
| h3              | 卡片 / 弹窗标题            | 18px | 600 | 26px | `text-lg`             |
| group-title     | 卡片内分组标题              | 15px | 600 | 22px | `--text-group` 专用档    |
| body            | 正文（全站基准）             | 14px | 400 | 22px | `text-sm`             |
| body-long       | 长文本（文章 / 协议 / 对话）    | 16px | 400 | 26px | `text-long`           |
| body-medium     | 强调正文、导航项             | 14px | 500 | 22px | `text-sm font-medium` |
| small / caption | 说明、占位符、徽标            | 12px | 400 | 18px | `text-xs`             |
| dense           | 密集数据（表格 / 二级导航 / 分页） | 13px | 400 | 20px | `text-dense`          |
| mono            | 正文里的等宽文本             | 13px | 400 | 20px | `text-mono`           |

补充约定（均自 UTER 回退）：

- **`text-base`（16px）不是标题**：只给「名称 + 说明」行标题（16/500）、设置页  
  字段档（16/600）、指标 / 价格数值（16/600 + `tabular-nums`）。
- **页面层级四层**：28 / 22 / 18 / 15，不多不少；`text-sm font-semibold` 不得  
  当卡片 / 区块标题。
- **最小字号 12px**（T16 规则）：任何可见文本不得低于 12px；不得用缩小字号解决  
  布局空间不足。
- **mono 三档**：正文等宽 `text-mono` 13/20；固定高度代码容器 `text-mono-code`  
  13/20；等宽卡片标题 `text-mono-title` 16/600/22。密集等宽行高另设  
  `--ds-line-mono-dense: 22px`（回退 UTER，上游未定义）。

### 4.2 行高、字重与字距

- **行高属于字号**：每档的行高写在 `--text-*--line-height`，写 `text-sm` 即得  
  14/22；**禁止** `leading-*` 字面值（`leading-snug` / `leading-6` 等）——上游  
  组件里的 `leading-snug` / `leading-none` / `leading-[1.15]` 须替换为最近档位  
  或 `leading-[var(--…)]` Token 引用。
- **字重四档**：400 正文 / 500 标签导航 / 600 全部标题 / 700 保留档。上游  
  `font-semibold`（600）用于 CardTitle、DialogTitle 的写法与「h3 = 18/600」  
  合并后统一为 `text-lg`（18px）；`font-bold` 不用于普通管理界面。
- **字距恒为 0**：上游按需使用 `tracking-tight` / `tracking-wide` /  
  `-0.012em`（serif 轴）的写法**不采纳**，全站移除 `tracking-*`（serif 轴的  
  `-0.012em` 标题微调是唯一保留项，随字体轴走，不散写到组件）。
- **数字排版**：金额 / Token / 余额 / 表格数字一律 `tabular-nums`（上游已全局  
  应用到 `[data-slot=table] td` 与 `.tabular-nums`，保留）。


### 4.3 字体家族与字体轴

字体家族全部采用上游（`theme.css:21-42`、`theme-presets.css:615-631`）：

| 轴            | 值                                                                                    | 说明                            |
| ------------ | ------------------------------------------------------------------------------------ | ----------------------------- |
| `system`（默认） | `--font-ui-sans: sans-serif`                                                         | 浏览器默认 sans，JS 启动前也成立          |
| `sans`       | Public Sans Variable                                                                 | 显式无衬线档                        |
| `serif`      | Lora Variable + Source Serif + **Noto/思源宋体（SC/TC/JP/KR）** + 宋体 / 仿宋 / 楷体 + Georgia 等 | 编辑型衬线档；Lora 只有拉丁字形，CJK 靠宋体系兜底 |

|   |   |   |
| - | - | - |

- 由 `body[data-theme-font='system|sans|serif']` 切换，用户选择覆盖预设默认  
  （anthropic 预设默认 serif）。
- **serif 轴细化**（上游硬规则，保留）：全局启用 `kern` / `liga` / `calt` /  
  `tnum`；h1–h6 与标题槽 `font-weight: 500` + `letter-spacing: -0.012em`  
  （≥3xl 为 `-0.02em`）；`code` / `kbd` / `pre` / `samp` / `.font-mono` /  
  `.tabular-nums` 自动豁免。
- **等宽字体**：上游 `--font-mono` 未定义，用 Tailwind 默认 `ui-monospace` 栈  
  （SF Mono / Menlo / Consolas 系）。**保持上游现状**（回退 UTER 的 Inter +  
  Noto Sans SC 组合**不采用**——那是 UTER 的标准，不是本规范的）。
- **移动端防缩放**（上游硬规则，保留）：`<767px` 时 `input / select / textarea`  
  强制 `font-size: 16px !important`，防 iOS 聚焦放大页面。
- Input 的字号：`text-base md:text-sm`（上游原样保留；16px 只发生在移动端输入  
  框，与十档表的 `text-base` 用途不同，属上游刻意的 iOS 对策，登记为例外语义）。

## 5. 间距与布局

全部采用上游：

- **间距阶梯就是 Tailwind 默认 4px 单位**，未自定义 `--spacing`（默认 0.25rem）。  
  直接用 `gap-2` / `p-4` / `px-2.5`。
- **密度档会同时缩放间距与字号**（与 UTER「密度不缩放字号」相反，按裁决采用  
  上游）：`data-theme-scale` 三档——  
  `sm`：`--spacing: 0.225rem`（且 `--text-sm: 0.78rem` 等整体缩小）；  
  `lg`：`0.28rem`；`xl`：`0.3rem`（字号同步放大）。默认档保持 Tailwind 默认。
- **控件高度无 Token**（上游未定义 `--ds-*`）：高度直接写在组件类里  
  （Button `h-8`、Input `h-8`、表头 `h-10`、表行 `h-15`），见 §9。
- **头部高度**：`--app-header-height: 3rem`。
- **内容宽度**：`max-w-container` = 1280px、`max-w-container-lg` = 1536px；  
  `centered` 布局模式在 ≥1280px 时把 `SidebarInset` 直接子元素钳制到  
  `--max-content-width`（默认 1280px）并居中。
- **侧边栏宽度**：`SIDEBAR_WIDTH` = 13rem（208px），移动端抽屉 17rem，  
  图标态 2.75rem。
- **弹窗**：默认 `sm:max-w-sm`、`max-w-[calc(100%-2rem)]`，业务层按需覆盖；  
  移动端定位走 `--dialog-available-height`（100dvh − 安全区 inset）机制。
- **容器**：`margin-inline: auto` + `padding-inline: 2rem`。

## 6. 圆角

全部采用上游。基准 `--radius` = **1rem（16px）**，各档按比例推导  
（`theme.css:88-94`）：

| 档             | 系数   | 实际值（基准 1rem） | 上游组件用法                   |
| ------------- | ---- | ------------ | ------------------------ |
| `rounded-sm`  | ×0.6 | 9.6px        | —                        |
| `rounded-md`  | ×0.8 | 12.8px       | Button xs/sm、sidebar 菜单项 |
| `rounded-lg`  | ×1   | 16px         | **Button、Input（默认控件档）**  |
| `rounded-xl`  | ×1.4 | 22.4px       | **Card、Dialog**          |
| `rounded-2xl` | ×1.8 | 28.8px       | 大展示卡                     |
| `rounded-3xl` | ×2.2 | 35.2px       | —                        |
| `rounded-4xl` | ×2.6 | 41.6px       | **Badge（全胶囊）**           |

- 用户可用 `data-theme-radius`（none = 0 / sm = 0.3rem / md = 0.5rem /  
  lg = 0.75rem / xl = 1rem）整体覆盖基准，各档按 calc 自动缩放。
- **禁止任意圆角值**（回退 UTER T10）：`rounded-[3px]` 等字面值一律不用；  
  `rounded-[inherit]` 是唯一合法的结构性任意值。

## 7. 描边与投影

全部采用上游：

- **分层靠描边 + 表面色差，不靠投影**。Card 与 Dialog 常态**无投影**，用  
  `ring-1 ring-foreground/10` 描边。
- **自定义 `--shadow-*` 未定义**，用 Tailwind 内置 shadow-sm / md / lg / xl，  
  允许直接使用（不设 UTER 的六档 elevation 约束）。
- **卡片悬停投影**（唯一成文的投影值，仅 ≥641px 生效）：  
  浅色 `0 4px 12px rgb(0 0 0 / 0.06)`，深色 `0 4px 12px rgb(0 0 0 / 0.3)`，  
  配 `translateY(-1px)`，过渡 150ms。
- sidebar 浮层用 `shadow-[0_0_0_1px_var(--sidebar-border)]` 做描边式投影。
- ui 组件内 shadow 使用统计：shadow-none ×9、shadow-md ×9、shadow-sm ×3、  
  shadow-lg ×3、shadow-xl ×1——**投影是例外表达，不是层级体系**；新增投影前  
  先确认描边 + 表面色差不够用。
- 玻璃拟态走 `glass-1…5` 工具类（card 渐变 + 分层透明描边），不手写。

## 8. 动效

全部采用上游（`index.css`）：

- **默认过渡**：Tailwind 默认 150ms / ease（未重定义  
  `--default-transition-duration`）。
- **典型时长**：Dialog 100ms；卡片 hover 150ms；表格行 120ms；sidebar 200ms  
  linear；折叠 300ms ease-out；营销页入场 0.6s `cubic-bezier(0.16,1,0.3,1)`；  
  流光边框 3.2s linear。
- **按压反馈**：按钮 `active:scale(0.98)` / `active:translate-y-px`。
- **keyframes 清单**：skeleton-shimmer（1.8s）、slideDown / slideUp（300ms）、  
  appear / appear-zoom（0.6s）、scroll-up（20s）、stream-fade-in（250ms）、  
  landing-fade-up / in / scale-in / fade-left / right（0.6s）、  
  tableRowEnter（0.2s，第 2–10 行级联 delay 25–225ms，≥11 行 250ms）、  
  terminal-demo-blink / spin / pulse、auto-group-flow-border-travel（3.2s）。
- **`prefers-reduced-motion: reduce` 下几乎所有动画关闭**——新增动画必须配  
  对应的 reduce 媒体查询。
- 上游未定义 `--ds-motion-*` Token 体系（回退 UTER 不采用——上游以  
  keyframes + 字面时长为约定，新动画跟随既有清单的节奏档位即可）。

## 9. 组件规范

组件实现位置 `components/ui/*`（shadcn 风格 + `data-slot` 标记）。  
**尺寸全部采用上游；组件内字号映射到 UTER 十档**（同名档位恰好同值，  
`text-[0.8rem]` → `text-xs`）。

### Button（`button.tsx`）

| size    | 高度                     | 字号（映射后）                              | 圆角             | 图标       |
| ------- | ---------------------- | ------------------------------------ | -------------- | -------- |
| xs      | h-6（24px）              | 12px（`text-xs`）                      | rounded-md     | size-3   |
| sm      | h-7（28px）              | 12px（原 `text-[0.8rem]` 12.8px → 档位化） | rounded-md     | size-3.5 |
| default | h-8（32px）              | 14px（`text-sm`）                      | rounded-lg     | size-4   |
| lg      | h-9（36px）              | 14px                                 | rounded-lg     | size-4   |
| icon 系  | size-6 / 7 / 8 / 8 / 9 | —                                    | xs/sm=md，其余=lg | —        |

基础类：`text-sm font-medium` + `focus-visible:ring-3 ring-ring/50` +  
`active:translate-y-px`；destructive 变体用 `bg-destructive/10 text-destructive
hover:bg-destructive/20` 的透明度浅底写法。

### Input（`input.tsx`）

`h-8`（32px）、`rounded-lg`、`px-2.5`、`text-base md:text-sm`（移动端 16px 防  
iOS 缩放）、`file:h-6 file:text-sm`、`focus-visible:ring-3 ring-inset`。

### Badge（`badge.tsx`）

`h-5`（20px）、`px-2 py-0.5`、`rounded-4xl`（全胶囊）、`text-xs font-medium`、  
内嵌 svg 强制 size-3、focus 时 `ring-[3px] ring-ring/50`。

### Card（`card.tsx`）

`rounded-xl`（22.4px）、`py-4 gap-4`、`text-sm`、`ring-1 ring-foreground/10`  
（无投影）；CardTitle `text-base font-medium`（sm 卡 `text-sm`）——映射到 UTER  
层级后，卡片标题应为 **h3 = 18/600（`text-lg`）**，`text-base` 仅当该卡是  
「行标题」语义时使用；sm 档 `py-3 px-3`。悬停投影见 §7。

### Dialog（`dialog.tsx`）

`rounded-xl`、`p-4 gap-4`、`text-sm`、`ring-1 ring-foreground/10`；标题  
`text-base font-medium leading-none` → 映射为 **18/600（h3 档）**；Footer  
`bg-muted/50 border-t p-4`；入场 100ms。

### Table（`table.tsx`）

| 项    | 值                                                   |
| ---- | --------------------------------------------------- |
| 字号   | th / td 统一 `text-sm`（映射后 14px）；次级说明 `text-xs`（12px） |
| 表头行  | `h-10`、`px-2`、`font-medium`                         |
| 数据行  | **固定 `h-15`（60px）**、`p-2`、`font-medium`             |
| 数字   | 全局 `tabular-nums`                                   |
| 行入场  | tableRowEnter 0.2s 级联动画；hover 背景 muted 50% mix      |
| 密集场景 | 需要更密时用 UTER `text-dense` 13/20 档（回退补充，上游未定义密集档）     |

### Sidebar（`sidebar.tsx`）

宽 13rem（icon 态 2.75rem，移动端抽屉 17rem）；`md:`（≥768px）常驻，以下走  
Sheet；菜单按钮 default `h-8 text-sm` / sm `h-7 text-xs` / lg `h-12 text-sm`；  
分组标签 `h-8 text-xs`；子项 `h-7 text-xs md:text-sm`；菜单项圆角 `rounded-md`；  
选中态 `--sidebar-accent`（primary 12% mix）+ `--sidebar-accent-foreground`。

### 原生元素边界

上游未成文（回退 UTER §20）：原生 `<button>` / `<input>` 必须落进「整行列表项 /  
手风琴触发器 / 标签页分段 / 复合控件根 / 图标按钮 / 隐藏字段」六类之一，否则  
换标准组件；样式复用既有 Token（高度 / 圆角 / 语义色 / 既有动效时长）。

## 10. 图标

采用上游：

- **库**：lucide-react 与 @hugeicons/react 混用（ui 基础件多用 Hugeicons，  
  业务层大量 lucide）；strokeWidth 统一 **2**。
- **尺寸约束方式**：无全局 size Token，靠父级 `[&_svg:not([class*='size-'])]:size-4`  
  约束（Button 内 16px，xs/sm 档 12/14px）；Badge svg 强制 size-3；sidebar 菜单  
  size-4。
- **颜色跟随父级文字色**（`currentColor`）。
- 上游未定义 UTER 式「16/18/24/32/48 五档 + 容器约束白名单」——**回退 UTER 五档  
  作为新增图标的选档依据**（存量按上游现状），新图标尺寸优先落在  
  12 / 14 / 16 / 18 / 24px 的既有使用值上，不发明新值。

## 11. 断点与响应式

全部采用上游：

- **断点不自定义**：Tailwind 默认 sm 640 / md 768 / lg 1024 / xl 1280。
- **侧边栏**：`md:`（≥768px）常驻，以下收起为 Sheet 抽屉（17rem）。
- **centered 内容钳制**：≥1280px 生效（见 §5）。
- **输入控件**：移动端 `text-base`（16px）、≥md 降 `text-sm`；另有 <767px 的  
  `16px !important` 双保险。
- **卡片 hover 投影**：仅 ≥641px 启用（触屏不悬停）。
- 上游未定义「移动端字号反向调整禁止」等策略条款——回退 UTER §21：桌面与移动  
  共用同一套阶梯，小屏只允许放大不允许缩小。

## 12. 焦点环、触控目标与可访问性

- **焦点环（上游标准，与 UTER 不同）**：`focus-visible:ring-3 ring-ring/50` +  
  `focus-visible:border-ring`——**3px 半透明品牌环**；全局兜底  
  `* { outline-color: ring/50 }`；sidebar 内 ring-2（无透明）。aria-invalid 时  
  `ring-3 ring-destructive/20`（深色 /40）。**不采用** UTER 的 1px 焦点环。
- **触控目标**：上游未定义——**回退 UTER**：可点击元素最小命中区 24×24  
  （WCAG 2.2 AA 2.5.8）；密集容器里视觉尺寸小于 24px 时加居中扩大的命中层  
  （UTER `.ds-touch-target` 模式），不得用 min-w/min-h 撑盒子。
- **对比度**：普通文本 4.5:1、大文本 3:1、非文本 3:1（WCAG 2.2）。品牌色替换后  
  的必测组合见 §1 表格；每次调色后重算。
- **reduced-motion**：所有新增动画配 reduce 关闭（上游既有纪律）。
- **深色独立验证**：`.dark` 有独立的全套 Token，对比度结论不得从浅色推断。

## 13. 主题维度独立性

上游共**五个主题维度**（比 UTER 多一个字体轴）：

| 维度   | 属性                                   | 允许影响                                      | 不允许影响 |
| ---- | ------------------------------------ | ----------------------------------------- | ----- |
| 颜色预设 | `data-theme-preset`（9 套）             | 全部语义色（含 surface bridge 派生）                | —     |
| 圆角   | `data-theme-radius`（5 档）             | `--radius` 基准（各档 calc 跟随）                 | 字号、颜色 |
| 密度   | `data-theme-scale`（sm/lg/xl）         | `--spacing` **与 `--text-*`**（上游特性：密度缩放字号） | 颜色    |
| 字体轴  | `data-theme-font`（system/sans/serif） | `--font-body` 及 serif 细化规则                | 字号、颜色 |
| 明暗   | `.dark`                              | 全部颜色 Token 取值 + `color-scheme`            | 尺寸    |

> 注意：上游密度档**同时缩放字号与间距**（sm 档正文 0.78rem ≈ 12.5px），这与  
> 「字号阶梯是 UTER 十档」存在张力。执行口径：密度档按上游机制运行，但其  
> 字号缩放比例应以 UTER 十档为基准等比缩放（如 sm 档 body ≈ 14 × 0.78/0.875），  
> 且最小字号仍不得低于 12px；simple-large 无障碍预设优先满足大字需求。

## 14. 特性工具类清单

上游 `index.css` 提供的全局特性（保留，新增同类先查这里）：

| 工具类 / 机制                                                | 作用                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------- |
| `glass-1` … `glass-5`                                   | 玻璃拟态：card 渐变底 + 分层透明描边                                              |
| `.auto-group-flow-border`                               | 品牌色流光边框（conic-gradient + mask XOR，3.2s）                             |
| skeleton（shimmer）                                       | Vercel 风格骨架屏，由 `--skeleton-base/highlight` 驱动，1.8s                  |
| 滚动条                                                     | 全局 thin + border 色；`no-scrollbar` / `hover-scrollbar`（8px、hover 显现） |
| `.content-auto`                                         | 长列表优化：`content-visibility: auto` + 80px 占位                          |
| `body[data-scroll-locked]`                              | 弹窗开启时 `overflow: unset !important`，保 sticky 头部                      |
| `--dialog-inset-top/bottom`、`--dialog-available-height` | 移动端弹窗 dvh + 安全区定位                                                   |
| Shiki 双主题                                               | `.shiki span` 浅深两套 token 色强制覆盖                                      |
| `[data-slot=table] td`                                  | 全局 `tabular-nums`                                                   |

## 15. 禁止事项总表

| 类别      | 禁止                                    | 替代                                                |
| ------- | ------------------------------------- | ------------------------------------------------- |
| 品牌色     | 组件里写 `#6565E8` 等字面值                   | `bg-primary` / `text-primary`；改色只改 `theme.css` 两处 |
| 字号      | `text-[0.8rem]` 等任意值                  | UTER 十档最近档                                        |
| 字号下限    | <12px 的可见文本                           | caption 12px 起                                    |
| 行高      | `leading-snug` / `leading-[1.15]` 字面值 | 档位自带行高 / `leading-[var(--…)]`                     |
| 标题层级    | `text-base font-medium` 当卡片标题         | h3 = 18/600（`text-lg`）                            |
| 标题 14px | `text-sm font-semibold` 当区块 / 卡片标题    | 28 / 22 / 18 / 15 四层                              |
| 文字层级    | `text-foreground/NN` 冒充层级             | `--muted-foreground`；细档回退 UTER `--fg-*`           |
| 圆角      | `rounded-[3px]` 任意值                   | 七档 calc 档位                                        |
| 投影      | 给卡片 / 弹窗常态加投影                         | `ring-1 ring-foreground/10` 描边分层                  |
| 焦点环     | `outline: none` 无替代；自造第二套环色           | `ring-3 ring-ring/50`                             |
| 触控目标    | 视觉 <24px 且无扩大命中层                      | 命中区扩大层（回退 UTER）                                   |
| 动效      | 无 reduce 关闭的新动画                       | 配 `prefers-reduced-motion`                        |
| 分类色     | `chart-N` 表达成功 / 失败                   | `success` / `warning` / `info` / `destructive`    |
| 密度      | 新增第四档密度                               | 维持 sm / 默认 / lg / xl                              |

---

## 附：与 UTER Design System 的关键差异速查

| 维度           | UTER Design System                   | 本规范（上游 new-api 基准）                   |
| ------------ | ------------------------------------ | ------------------------------------ |
| 品牌色          | `#5B5EE6` + 6 档派生色阶                  | **`#6565E8`**，无派生色阶（透明度 + color-mix） |
| 圆角基准         | **1rem（16px）基准**，控件 16px、卡片 22.4px   | **1rem（16px）基准**，控件 16px、卡片 22.4px   |
| 分层手段         | ring-1 描边 + 悬停投影（成文值）                | ring-1 描边 + 悬停投影（成文值）                |
| 焦点环          | 1px 满色                               | **3px 半透明（ring-3 ring-ring/50）**     |
| 密度           | 只缩放间距，不动字号                           | **同时缩放间距与字号**                        |
| 主题维度         | 4 个（颜色 / 圆角 / 密度 / 明暗）               | 5 个（多字体轴 system/sans/serif）          |
| 表格行高         | 由行内边距推导                              | 固定 `h-15`（60px）                      |
| 侧边栏          | 240px                                | **208px（13rem）**                     |
| 控件高度         | Token 化（`--ds-*`）                    | 组件内直接 h-N                            |
| 字号 / 行高 / 字重 | 十档 v1.2                              | **同左（本规范唯一承袭项）**                     |
