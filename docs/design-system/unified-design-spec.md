# Unified Design Spec · 合并设计规范（UTER × new-api）

> **文档性质。** 本文件由《UTER Design System》（`design-system.md`）与  
> 《上游 new-api 设计规范》（`newapi-design-spec.md`）合并而成，是合并体系的  
> **单一权威文件**。用于以 new-api 的设计语言为骨架、以 UTER 的工程纪律为约束的  
> 新项目 / 新界面。
>
> - **合并基线**：UTER Design System（字号 v1.2，2026-11-03）+ 上游 new-api  
>   （QuantumNous，基线 commit `45746ee`，2026-11-02）+ 品牌色 `#6565E8`。
> - **差异裁决**：两份源文件的冲突点按下表定案执行，不再保留双方取值。
> - **上游取值的权威来源是代码**：`web/src/styles/theme.css`、  
>   `theme-presets.css`、`index.css`、`components/ui/*`；UTER 取值的权威来源是  
>   `web/src/design-system/tokens/*`。两者不一致时以本文件为准。

## 差异裁决总表（定案）

| 维度           | 定案                                          | 取自        |
| ------------ | ------------------------------------------- | --------- |
| 品牌色         | **`#6565E8`** 六档派生色阶（动作梯同色相加深 + 浅底 / 描边派生，见 §3.2） | UTER §11.2（色值按 #6565E8 重算） |
| 圆角基准         | **1rem 基准：控件 16px、卡片 22.4px**               | 上游 new-api |
| 分层手段         | **ring-1 描边 + 悬停投影（成文值）**                   | 上游 new-api |
| 焦点环          | **2px 满色**                                  | UTER（本规范改 2px） |
| 密度           | **只缩放间距，不动字号**                              | UTER      |
| 主题维度         | **5 个（多字体轴 system/sans/serif）**             | 上游 new-api |
| 表格行高         | **行内边距推导**                                  | UTER      |
| 侧边栏          | **220px**                                   | UTER（本规范改 220px） |
| 控件高度         | **Token 化（`--ds-*`）**                       | UTER      |
| 字号 / 行高 / 字重 | **十档 v1.2**                                 | 双方一致      |

**未裁决冲突的裁定**（沿用「Token 化优先」原则）：

| 项         | 裁定                                        | 取自        |
| --------- | ----------------------------------------- | --------- |
| 字体家族      | 字体轴机制 system / sans / serif（属主题维度裁决的一部分）  | 上游 new-api |
| 文字层级      | `--fg-*` 语义七档（一级/二级复用上游 Token 派生）         | UTER      |
| 图标        | lucide 统一 + 五档 16/18/24/32/48 + 描边 2      | UTER      |
| 动效        | `--ds-motion-*` Token 体系                   | UTER      |
| 内容宽度      | 三档 Token 化（1152 / 1280 / 1800）             | UTER      |
| 主题预设      | 9 套预设 + surface bridge 派生                  | 上游 new-api |
| 触控目标      | 24×24 + 命中区扩大层                            | UTER      |
| 最小字号      | 12px 强制（T16）                               | UTER      |
| 侧边栏常驻断点   | ≥1024px（lg）常驻，以下抽屉                         | UTER      |
| 输入控件字号    | 全平台 14px，不设移动端 16px 例外（接受 iOS 聚焦放大）        | UTER      |

---

## 目录

- [1. 对比度](#1-对比度)
- [2. 视觉基调](#2-视觉基调)
- [3. 颜色](#3-颜色)
- [4. 字号与排版](#4-字号与排版)
- [5. 间距与布局](#5-间距与布局)
- [6. 圆角](#6-圆角)
- [7. 描边与投影](#7-描边与投影)
- [8. 动效](#8-动效)
- [9. 组件规范](#9-组件规范)
- [10. 图标](#10-图标)
- [11. 断点与响应式](#11-断点与响应式)
- [12. 焦点环、触控目标与可访问性](#12-焦点环触控目标与可访问性)
- [13. 主题维度独立性](#13-主题维度独立性)
- [14. 禁止事项总表](#14-禁止事项总表)

---

## 1. 对比度

正文文字以 **WCAG AA 4.5:1** 为目标；大文本（≥24px 常规 / ≥18.66px 粗体）3:1；  
非文本（控件边界、图标、焦点指示器）3:1。**每次调色后重算，不能沿用旧结论。**

**品牌色必测组合（实测，sRGB → 线性 → WCAG 相对亮度）**：

| 组合                                        | 对比度      | 判定                                        |
| ----------------------------------------- | -------- | ----------------------------------------- |
| `#6565E8` 配白字（主按钮 / 主色前景）                  | **4.59:1** | ✅ AA 普通文本（余量仅 0.09，调色必须重算）                |
| `#5050CA` 配白字（hover-primary）               | **6.29:1** | ✅ AA（动作梯悬停档）                              |
| `#4141B7` 配白字（primary-active）              | **7.88:1** | ✅ AAA（动作梯按下档）                             |
| `#6565E8` 配 `oklch(0.145 0 0)` 近黑背景        | **4.32:1** | ⚠️ 普通文本不达 AA；大文本达标。深底品牌色仅作点缀 / 大文本        |
| `#5959CC` 配选中浅底 `#F3F3FD`（subtle 8% mix）   | **5.11:1** | ✅ AA（浅色选中态文字专用前景）                         |
| `#A2A2F8` 配深色浅底（accent 20% mix ≈ `#373751`） | **4.96:1** | ✅ AA（深色选中态文字 / subtle-foreground）          |
| `#BABAF9` 配深色主底 `oklch(0.235)`             | **7.74:1** | ✅ AAA（深色链接 `--fg-link`）                   |
| `#7171EA` 配深色主底（primary-border 深）          | **3.54:1** | ✅ 3:1 非文本线（选中控件描边）                        |
| `--muted-foreground`（oklch(0.49) ≈ `#757575`）配白底 | ≈ 4.6:1 | ✅ AA 普通文本                              |

> `#6565E8` 选型依据：品牌初拟 `#6568E8` 配白字 ≈ 4.47:1 不达 AA，绿色通道  
> `0x68→0x65` 降亮度后达标（4.59:1），色相差可忽略。

---

## 2. 视觉基调

- **中性画布 + 品牌点缀**：近黑前景、细描边、**以描边分层而不是常态投影**、大圆角。
- 圆角基准 **1rem（16px）**：控件 16px、卡片 / 弹窗 22.4px、Badge 全胶囊。
- 深色模式是「炭灰画布」（background `oklch(0.235 0 0)` ≈ `#2B2B2B` 区间），不是纯黑蓝。
- 半透明修饰符（`X/NN`）是常规表达（状态色 hover、glass、边框），不是违规写法；  
  但**品牌主色**与**文字层级**是两个例外：品牌 hover / 浅底走六档色阶 Token  
  （§3.2），文字层级禁止用透明度冒充（走 `--fg-*`，见 §3.3）。
- 原生控件跟随主题：`.dark` 下声明 `color-scheme: dark`。

---

## 3. 颜色

颜色是**语义变量**，组件不写死色值。语义色板取上游（`theme.css:97-250`），  
品牌色替换为 `#6565E8` 并按 UTER §11.2 模式建立**六档派生色阶**（见 §3.2）。

### 3.1 语义色板（浅色 / 深色）

| Token | 浅色（`:root`） | 深色（`.dark`） |
| --- | --- | --- |
| `--background` / `--foreground` | `oklch(1 0 0)` / `oklch(0.145 0 0)` | `oklch(0.235 0 0)` / `oklch(0.965 0 0)` |
| `--card` / `--card-foreground` | `oklch(1 0 0)` / `oklch(0.145 0 0)` | `oklch(0.285 0 0)` / `oklch(0.965 0 0)` |
| `--popover` / `--popover-foreground` | `oklch(1 0 0)` / `oklch(0.145 0 0)` | `oklch(0.305 0 0)` / `oklch(0.965 0 0)` |
| `--primary` / `--primary-foreground` | **`#6565E8`** / 白 | **`#6565E8`** / 白 |
| `--secondary` / `--secondary-foreground` | `oklch(0.95 0 0)` / `oklch(0.42 0.16 250)` | `oklch(0.335 0 0)` / `oklch(0.9 0.05 250)` |
| `--muted` / `--muted-foreground` | `oklch(0.97 0 0)` / `oklch(0.49 0 0)` | `oklch(0.305 0 0)` / `oklch(0.78 0 0)` |
| `--accent` / `--accent-foreground` | `color-mix(in oklch, primary 12%, background)`（≈ `#EDEDFC`）/ 近黑 | `color-mix(in oklch, primary 20%, background)`（≈ `#373751`）/ 近白 |
| `--destructive` / 前景 | `oklch(0.577 0.245 27.325)` / `oklch(0.985 0 0)` | `oklch(0.704 0.191 22.216)` / `oklch(0.985 0 0)` |
| `--success` / 前景 | `oklch(0.596 0.145 163.225)` / `oklch(0.985 0 0)` | `oklch(0.696 0.17 162.48)` / 近黑 |
| `--warning` / 前景 | `oklch(0.681 0.162 75.834)` / 近黑 | `oklch(0.769 0.188 70.08)` / 近黑 |
| `--info` / 前景 | `oklch(0.588 0.158 241.966)` / `oklch(0.985 0 0)` | `oklch(0.613 0.14 239.919)` / 近黑 |
| `--border` / `--input` | `oklch(0.93 0 0)`（同值） | `oklch(1 0 0 / 10%)` / `oklch(1 0 0 / 17%)` |
| `--ring` | **品牌同值 `#6565E8`**（焦点环跟品牌，见 §12） | 同浅色 |
| `--skeleton-base` / `--skeleton-highlight` | `oklch(0.97 0 0)` / `oklch(0.985 0 0)` | `oklch(0.335 0 0)` / `oklch(0.44 0 0)` |

**表格专用 Token**：`--table-row` = background；header 1.5% / 3% mix（深色 6% / 9%）；  
disabled / hover / border 3% / 4.5% / 16% mix（深色 7% / 9.5% / 24%）。

**侧边栏专用 Token**：`--sidebar` 浅色 = foreground 0.5% mix（深色 `oklch(0.225 0 0)`）；  
`--sidebar-accent` = primary 12%（深色 20%）mix；选中态前景见 §9。

### 3.2 品牌色阶：六条语义出口，一个来源（UTER §11.2 模式）

`--primary: #6565E8` 是唯一品牌入口，其余五档全部由它派生，组件不得写品牌色  
字面值。**动作三档（hover / active）同色相加深，浅深两主题共用同一套实色**；  
浅底与描边两主题各给一档：

| Token | 用途 | 浅色 | 深色 |
| --- | --- | --- | --- |
| `--primary` / `--primary-strong` | 主按钮背景、选中控件填充 | `#6565E8` | 同浅色 |
| `--hover-primary` | 主按钮悬停（同色相加深） | `#5050CA` | 同浅色 |
| `--primary-active` | 主按钮按下（再加深，与悬停可区分） | `#4141B7` | 同浅色 |
| `--primary-subtle` | 浅底：选中行、轻强调背景 | `#F3F3FD` | `color-mix(primary 20%, bg)` ≈ `#373751` |
| `--primary-subtle-hover` | 浅底的悬停一档（12% mix 派生） | ≈ `#EDEDFC` | 同声明 |
| `--primary-border` | 品牌描边：选中控件边框 | `#C4C4F6` | `#7171EA`（3.54:1 ✅） |

**文字出口不跟动作梯走**（动作梯加深适配白字，文字出口按各自底色保 AA）：

- 链接 / 强调文字 → `--fg-link`：浅 `#6565E8`（4.59:1 ✅）/ 深 `#BABAF9`（7.74:1 ✅）；
- 品牌浅底上的选中文字 → `--primary-subtle-foreground`：浅 `#5959CC`（on `#F3F3FD`  
  5.11:1 ✅）/ 深 `#A2A2F8`（on `#373751` 4.96:1 ✅），详见 §9；
- 图标（非文字图形，3:1 即可）可继续用 `text-primary`；≥18px/600 的大字号同理。

**规范要求的按钮三态**（白字三档 4.59 / 6.29 / 7.88 全部达标）：

```tsx
// 主按钮：默认 strong，悬停 hover，按下 active
'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active'
```

派生规律（换品牌色时按此重算，不许手抄旧值）：动作梯同色相（H 不变），hover 档  
HSL 亮度 ×0.847、饱和度 ×0.72；active 档亮度 ×0.745、饱和度 ×0.64；subtle 浅档 =  
primary 8% 混白、hover 档 12% 混白；border 浅档 38% 混白、深档 = primary 提亮 8%。

三条硬规则：

1. **不得用透明度凑悬停**：`hover:bg-primary/90` 深色底发灰、浅色底泛白，一律  
   `hover:bg-primary-hover`；
2. **浅底加深一档用 Token**：`bg-primary/10 hover:bg-primary/15` 一律  
   `bg-primary-subtle hover:bg-primary-subtle-hover`；
3. **组件不写品牌色字面值**：一律 `bg-primary` / `text-primary` /  
   `border-primary-border`；改色只改 `theme.css` 的 `:root` 与 `.dark`，六档按  
   上方派生规律重算并重跑 §1 对比度表；`--ring` 与品牌同值（见 §12）。

### 3.3 文字层级：`--fg-*` 语义七档

文字层级走语义 Token，**禁止** `text-foreground/NN` 冒充层级（文字层级的透明度  
不可测、随底色漂移；`X/NN` 只允许用于 hover / glass / 边框等状态表达）：

| 层级 | Token | 取值（浅 / 深） | 用途 |
| --- | --- | --- | --- |
| 一级 | `--fg-primary` | `var(--foreground)` | 标题、正文、输入值、表格内容 |
| 二级 | `--fg-secondary` | `var(--muted-foreground)` | 描述、辅助说明 |
| 三级 | `--fg-tertiary` | `color-mix(in oklch, var(--muted-foreground) 88%, var(--background))` | 时间戳、元信息、次要标签 |
| 占位 | `--fg-placeholder` | 同 tertiary 色值（语义不混用：placeholder 只给输入框） | 输入框占位符 |
| 禁用 | `--fg-disabled` | `color-mix(in oklch, var(--foreground) 45%, var(--background))` | 禁用控件（WCAG 1.4.3 豁免档，不得承载需阅读信息） |
| 链接 | `--fg-link` | 浅 `var(--primary)`（4.59:1 ✅）/ 深 `#BABAF9`（7.74:1 ✅） | 文本链接、可导航文字 |
| 反色 | `--fg-inverse` | `var(--background)` | 品牌实心背景上的文字 |

### 3.4 图表色与状态色

- `--chart-1` … `--chart-5` 是**分类色**：只追求可区分，不表达成败；浅色 5 档 oklch，  
  深色统一提亮到 L≈0.76。仪表盘强调 `--overview-accent-1/2/3`（同 chart-1/2/3）。
- 成功 / 警告 / 危险 / 信息一律走 `--success` / `--warning` / `--destructive` / `--info`，  
  **禁止**拿 `chart-N` 表达成功失败；**禁止**分类色做强调边框。

### 3.5 主题预设

`data-theme-preset` 切换，共 9 套（沿上游 `theme-presets.css`）：underground /  
rose-garden / lake-view / sunset-glow / forest-whisper / ocean-breeze /  
lavender-dream / simple-large / anthropic。default 预设即本规范色板。

- **surface bridge**：非 default / anthropic / simple-large 预设下，card / popover /  
  muted / accent / border / input / sidebar 全部由该预设 `--primary` 的 3%–28%  
  `color-mix` 派生——换预设即整站色温跟随。
- **anthropic**：暖奶油画布 + 墨色前景 + serif 默认轴。
- **simple-large**：无障碍大字档（字号整体 ~1.35×，见 §4），唯一重定义整套语义色的黑白预设。

---

## 4. 字号与排版

字号整体采用**十档 v1.2**（双方一致承袭）。上游的 Tailwind 默认阶梯 + 密度缩放 +  
`text-[0.8rem]` 散写**不再使用**；`text-sm`→14px、`text-xs`→12px、`text-base`→16px  
同名同值无需改类名，`text-[0.8rem]` 等任意值必须替换为最近档位。

### 4.1 十档字号表

| Token | 语义 | 字号 | 字重 | 行高 | Tailwind |
| --- | --- | --- | --- | --- | --- |
| display | 页面主视觉 | 36px | 600 | 44px | `text-4xl` |
| h1 | 页面标题（每页一个） | 28px | 600 | 36px | `text-3xl` |
| h2 | 区块标题 | 22px | 600 | 30px | `text-2xl` |
| h3 | 卡片 / 弹窗标题 | 18px | 600 | 26px | `text-lg` |
| group-title | 卡片内分组标题 | 15px | 600 | 22px | `--text-group` 专用档 |
| body | 正文（全站基准） | 14px | 400 | 22px | `text-sm` |
| body-long | 长文本（文章 / 协议 / 对话） | 16px | 400 | 26px | `text-long` |
| body-medium | 强调正文、导航项 | 14px | 500 | 22px | `text-sm font-medium` |
| small / caption | 说明、占位符、徽标 | 12px | 400 | 18px | `text-xs` |
| dense | 密集数据（表格 / 二级导航 / 分页） | 13px | 400 | 20px | `text-dense` |
| mono | 正文里的等宽文本 | 13px | 400 | 20px | `text-mono` |

**使用边界**：

- 页面层级**四层不多不少**：28 / 22 / 18 / 15；`text-sm font-semibold` 不得当卡片 / 区块标题。
- **`text-base`（16px）不是标题**：只给「名称 + 说明」行标题（16/500）、设置页字段档  
  （16/600）、指标 / 价格数值（16/600 + `tabular-nums`）。
- **mono 三档**：正文等宽 `text-mono` 13/20；固定高度代码容器 `text-mono-code` 13/20；  
  等宽卡片标题 `text-mono-title` 16/600/22。密集等宽行高 `--ds-line-mono-dense: 22px`。
- **最小字号 12px 强制（T16）**：任何可见文本不得低于 12px；不得用缩小字号解决布局  
  空间不足。13px 的 dense 是密集数据专用档，不是常规缩字号方案。
- 12px 只给真 caption：单行 ≤20 字、不承载数值、不是阅读主体，三条同时满足。
- 卡片标题同行的汇总值（总计 / 共 N 条）恒为 14px（`body-sm`），不得 12px。

### 4.2 行高、字重与字距

- **行高属于字号**：每档行高写在 `--text-*--line-height`，写 `text-sm` 即得 14/22；  
  **禁止** `leading-*` 字面值（`leading-snug` / `leading-6` 等），唯一放行形式是  
  `leading-[var(--…)]` Token 引用。
- **字重四档**：400 正文 / 500 标签导航按钮 / 600 全部标题 / 700 保留档（普通管理  
  界面不用）。
- **字距恒为 0**：全站移除 `tracking-*`；serif 字体轴的标题 `-0.012em` 微调（≥3xl  
  为 `-0.02em`）是唯一保留项，随字体轴走，不散写到组件。
- **数字排版**：金额 / Token / 余额 / 表格数字一律 `tabular-nums`。

### 4.3 字体家族与字体轴

| 轴 | 值 | 说明 |
| --- | --- | --- |
| `system`（默认） | `sans-serif` | 浏览器默认 sans，JS 启动前也成立 |
| `sans` | Public Sans Variable | 显式无衬线档 |
| `serif` | Lora Variable + 思源宋体系 + Georgia 等 | 编辑型衬线档；CJK 靠宋体系兜底 |

- `body[data-theme-font='system|sans|serif']` 切换，用户选择覆盖预设默认（anthropic  
  预设默认 serif）。
- **serif 轴细化**：全局启用 `kern` / `liga` / `calt` / `tnum`；h1–h6 `font-weight: 500`  
  + `letter-spacing: -0.012em`（≥3xl 为 `-0.02em`）；`code` / `kbd` / `pre` / `samp` /  
  `.font-mono` / `.tabular-nums` 自动豁免。
- **等宽字体**：Tailwind 默认 `ui-monospace` 栈（SF Mono / Menlo / Consolas 系）。
- **内容排版（Markdown prose）**自成一套，比界面低一到两档：h1 24/32、h2 18/28、  
  h3 16/24、h4 14/22、h5 14/22（tertiary）、h6 12/18 uppercase；正文 `body-long` 16/26；  
  围栏代码块 `text-mono` 13/20。

---

## 5. 间距与布局

- **间距阶梯就是 Tailwind 默认 4px 单位**，不自定义 `--spacing`。图标与文字  
  `gap-1`~`gap-1.5`、控件间 `gap-2`、卡片内元素 / 卡片间 `gap-4`、区块间 `gap-6`/`gap-8`。
- **段落间距**：普通正文 8px、长文本 12–16px、帮助文档 16px、列表项 6–8px、  
  标题与正文 8–12px、卡片标题与内容 12–16px。不要用加行高代替段落间距。
- **密度档只缩放间距与控件高度，不缩放字号**（`data-theme-scale`，见 §13）。

### 5.1 控件高度 Token（`--ds-*`）

高度全部 Token 化，组件不直接写 `h-N`：

| Token | 默认 | `sm` 密度 | `xl` 密度 |
| --- | --- | --- | --- |
| `--ds-control-height-md` | 40px | 36px | 44px |
| `--ds-control-height-sm` | 36px | 32px | 40px |
| `--ds-button-height-md` | 36px | 32px | 40px |
| `--ds-button-height-sm` | 32px | 28px | 36px |
| `--ds-button-height-lg` | 40px | 36px | 44px |
| `--ds-nav-height-md` / `sm` / `lg` | 32 / 28 / 48px | 28 / 24 / 40px | 36 / 32 / 52px |
| `--ds-table-row-padding-y` | 12px | 8px | 14px |
| `--ds-table-cell-padding-x` | 12px | 8px | 14px |
| `--ds-form-field-gap` | 8px | 6px | 10px |
| `--ds-card-padding` | 24px | 16px | 28px |
| `--ds-page-gutter` | 24px | 16px | 32px |
| `--ds-chip-height` | 21px（不随密度） | — | — |

### 5.2 内容宽度与侧边栏

- **内容宽度三档 Token 化**：营销内容列 1152px（`max-w-6xl`）、标准内容区 1280px  
  （`--ds-content-max` / `max-w-container`）、密集比较页 1800px（`--ds-content-max-wide`）。  
  业务代码不写 `max-w-[1800px]` 这类任意值。
- **侧边栏 220px（`13.75rem`）**：≥1024px（lg）常驻，以下收起为抽屉；头部高度  
  `--app-header-height: 3rem`。
- **弹窗**：默认 `sm:max-w-sm` + `max-w-[calc(100%-2rem)]`，业务层按需覆盖；移动端  
  定位走 `--dialog-available-height`（100dvh − 安全区 inset）机制。

---

## 6. 圆角

全部采用上游。基准 `--radius` = **1rem（16px）**，各档按比例推导：

| 档 | 系数 | 实际值 | 用法 |
| --- | --- | --- | --- |
| `rounded-sm` | ×0.6 | 9.6px | 极小元素 |
| `rounded-md` | ×0.8 | 12.8px | Button xs/sm、sidebar 菜单项 |
| `rounded-lg` | ×1 | **16px** | **Button、Input（默认控件档）** |
| `rounded-xl` | ×1.4 | **22.4px** | **Card、Dialog** |
| `rounded-2xl` | ×1.8 | 28.8px | 大展示卡 |
| `rounded-3xl` | ×2.2 | 35.2px | — |
| `rounded-4xl` | ×2.6 | 41.6px | Badge（全胶囊） |

- 用户可用 `data-theme-radius`（none 0 / sm 0.3rem / md 0.5rem / lg 0.75rem / xl 1rem）  
  整体覆盖基准，各档 calc 自动缩放。
- **禁止任意圆角值**：`rounded-[3px]` 等字面值一律不用；`rounded-[inherit]` 是唯一  
  合法的结构性任意值。

---

## 7. 描边与投影

全部采用上游：

- **分层靠描边 + 表面色差，不靠常态投影**。Card 与 Dialog 常态**无投影**，用  
  `ring-1 ring-foreground/10` 描边。
- **卡片悬停投影（唯一成文投影值，仅 ≥641px 生效）**：浅色  
  `0 4px 12px rgb(0 0 0 / 0.06)`、深色 `0 4px 12px rgb(0 0 0 / 0.3)`，配  
  `translateY(-1px)`，过渡 150ms。
- 浮层（下拉 / 弹窗 / 抽屉）允许 Tailwind 内置 shadow-sm~xl；`--shadow-*` 自定义档  
  不定义。sidebar 浮层用 `shadow-[0_0_0_1px_var(--sidebar-border)]` 描边式投影。
- **投影是例外表达，不是层级体系**：新增投影前先确认描边 + 表面色差不够用。
- 玻璃拟态走 `glass-1…5` 工具类（card 渐变底 + 分层透明描边），不手写。

---

## 8. 动效

采用 UTER `--ds-motion-*` Token 体系（时长与缓动捆绑定档，不允许自由组合）：

| 组 | Token | 值 | 用途 |
| --- | --- | --- | --- |
| 交互反馈 | `--ds-motion-fast` / `base` / `slow` | 100 / 200 / 350ms | 颜色描边透明度 / 形变 / 整块位移 |
| 营销节奏 | `--ds-motion-marketing-fast` / `-base` | 300 / 500ms | 营销悬停、容器级展开 |
| 内容入场 | `--ds-motion-enter` | 600ms | 首屏观看节奏 |
| 循环动画 | `--ds-motion-loop-*` | shimmer 1.8s / pulse 1.5s / caret 1s / spin 0.8s / marquee 20s | 周期由内容决定 |
| 数据过渡 | `--ds-motion-data-fast` / `--ds-motion-data` | 250 / 500ms | 值在变化 |

缓动三条与组绑定：`--ds-motion-ease`（cubic-bezier(0.4,0,0.2,1)，交互 / 数据）、  
`--ds-motion-ease-marketing`（(0.16,1,0.3,1)，营销 / 入场）、`--ds-motion-ease-snappy`  
（(0.22,1,0.36,1)，整块位移）。

- 裸 `transition-*` 的默认时长被指到 `--ds-motion-fast`（100ms）；要 200 / 350 显式写  
  `ds-motion-base` / `ds-motion-slow`。禁止 `duration-300` / `ease-out` 等字面值  
  （`animate-in/out` 行内的 `duration-*` 设的是 animation-duration，放行）。
- 按压反馈：按钮 `active:translate-y-px`。
- **`prefers-reduced-motion: reduce` 下非必要动画全部关闭**——新增动画必须配 reduce 媒体查询。
- 循环动画沿用上游 keyframes 清单：skeleton-shimmer 1.8s、slide 300ms、appear 0.6s、  
  scroll-up 20s、stream-fade-in 250ms、tableRowEnter 0.2s（第 2–10 行级联 25–225ms）、  
  流光边框 3.2s。

---

## 9. 组件规范

组件实现位置 `components/ui/*`（shadcn 风格 + `data-slot` 标记）。**尺寸由 `--ds-*`  
Token 驱动；字号映射到十档。**

### Button

高度来自 `size` 档（密度 Token 驱动），字号来自十档：

| size | 高度 | 字号 | 圆角 | 用途 |
| --- | --- | --- | --- | --- |
| `sm` | 32px（`--ds-button-height-sm`） | 12/500/18（`text-xs`） | `rounded-lg` 16px | 表格行内、密集工具栏 |
| `default` | 36px（`--ds-button-height-md`） | 14/500/22（`text-sm font-medium`） | `rounded-lg` | 常规操作 |
| `lg` | 40px（`--ds-button-height-lg`） | 14/500/22 | `rounded-lg` | 页面级主操作 |
| `icon` 系 | 36 / 32 / 24 / 40px | — | `rounded-lg` | 图标按钮（24px 为触控下限） |

- 变体六种：default / secondary / outline / ghost / destructive / link；destructive  
  浅底用 `bg-destructive/10 hover:bg-destructive/20`（透明度写法）。
- 状态三件套：`hover:bg-primary-hover active:bg-primary-active active:translate-y-px` +  
  **`focus-visible:ring-2 ring-ring`**（2px 满色，见 §12）。
- 加载态用 `loading` 属性：文字保留在 DOM、spinner 前置 18px、自动 `disabled` + `aria-busy`。

### Input

高度 `--ds-control-height-md` 40px（sm 36px）、`rounded-lg` 16px、`px-2.5`、  
**全平台 14px**（不设移动端 16px 例外，接受 iOS 聚焦放大页面）、  
`focus-visible:ring-2 ring-ring ring-inset`。

### Badge

高 20px（`h-5`）、`px-2 py-0.5`、全胶囊（`rounded-4xl`）、`text-xs font-medium`（12px）、  
内嵌 svg 强制 12px。

### Card / Dialog

`rounded-xl` 22.4px、常态无投影 + `ring-1 ring-foreground/10`；Card 内边距  
`--ds-card-padding` 24px、`gap-4`；**标题 18/600（`text-lg`，h3 档）**，描述 14px  
（`body-sm`）；Dialog Footer `bg-muted/50 border-t`；入场 100ms。卡片悬停投影见 §7。

### Table

**行高由内边距推导**（不设固定行高）：

| 项 | 值 |
| --- | --- |
| 表头 | `h-10`（40px）、`px-3`、12px/500（caption 档，列名是标识） |
| 单元格 | `text-dense` 13/400/20、`px-3`、垂直内边距 `--ds-table-row-padding-y` 12px（默认行 ≈48px） |
| 数字 | 全局 `tabular-nums` |
| 次级说明 | `text-xs` 12px |
| 行入场 | tableRowEnter 0.2s 级联（25ms 步进） |
| 密集场景 | 收紧 `--ds-table-row-padding-y` 至 8px（sm 密度），字号不动 |

### Sidebar

宽 **220px（13.75rem）**；≥1024px 常驻，以下抽屉。菜单项高度 `--ds-nav-height-md`  
32px、14/500（`label` 档）、圆角 `rounded-md` 12.8px；分组标签 12px/600、高 28px；  
子项 13px（dense 档）。

**选中态**：底色 `--sidebar-accent` / `--primary-subtle`（primary 8% mix ≈  
`#F3F3FD`，悬停 12% mix ≈ `#EDEDFC`），文字与图标用 **专用前景 Token**  
`--primary-subtle-foreground`（选中只靠「专用前景色 + 品牌浅底」表达，不加粗、  
不加边框、不加竖条）：

| 主题 | Token 值 | 配对底色 | 对比度 |
| --- | --- | --- | --- |
| 浅色 | `#5959CC` | `#F3F3FD`（悬停 `#EDEDFC`） | **5.11:1 ✅**（悬停档 4.86:1 ✅） |
| 深色 | `#A2A2F8` | ≈ `#373751` | **4.96:1 ✅** |

> 品牌原色 `#6565E8` 落在选中浅底上只有约 4.16:1（导航文字 14px/500 不属大文本  
> 豁免），因此必须用专用加深前景；该 Token 只与选中浅底配对，不改变全局品牌主色。  
> 未选中行保持 `--sidebar-foreground`，字重整列统一 500。

### 原生元素边界

原生 `<button>` / `<input>` 必须落进六类之一：整行列表项 / 手风琴触发器 / 标签页  
分段 / 复合控件根 / 图标按钮 / 隐藏字段；否则换标准组件。样式复用 `--ds-*` 高度、  
`--radius-*` 圆角、语义色与 `--ds-motion-*` 时长；触控目标 ≥24×24。

---

## 10. 图标

采用 UTER 体系：

- **库**：统一 lucide-react 线性图标（引入 `@hugeicons/*` / `@heroicons/*` /  
  `react-icons/*` 即违规；运行时图标名例外允许 `react-icon-by-name` 类组件）。
- **尺寸五档**：16 / 18 / 24 / 32 / 48px，**默认档 18px**；容器放不下时允许 12 / 14px  
  （复选框、徽章、日历格等固定尺寸容器，白名单按文件路径登记）。
- **描边统一 2**（画框单位；18px 实际 1.5px）。由 IconProvider 全局注入  
  `size={18} strokeWidth={2}`，调用点不写 `strokeWidth`。
- **颜色跟随父级文字色**（`currentColor`）；状态色用语义 Token，不写调色板类名。

---

## 11. 断点与响应式

沿用 Tailwind 默认断点：sm 640 / md 768 / lg 1024 / xl 1280。

- **侧边栏** ≥1024px 常驻，以下抽屉（见 §5.2）。
- **桌面与移动共用同一套十档阶梯**，不为移动端单独定义字号；只允许两种断点调整：  
  营销主视觉 `text-3xl md:text-4xl`（28→36px）、指标数值 `text-2xl md:text-3xl`  
  （22→28px，放大点是 md）。禁止「移动端更小」的反向调整。
- **输入控件**：全平台 14px，不设移动端 16px 例外（iOS 聚焦放大是已知取舍）。
- **卡片 hover 投影**仅 ≥641px 启用（触屏不悬停）。
- 表格窄屏允许横向滚动，不允许把列压到文字换行三行。
- 长文本阅读宽度：文章 / 协议正文列 `max-w-[72ch]`（约 720–760px）；AI 对话气泡  
  `max-w-[84%]`。

---

## 12. 焦点环、触控目标与可访问性

- **焦点环（UTER 标准，本规范定 2px）**：全站只有一种焦点指示器——**2px 满色环**，  
  贴元素边框外沿（`outline-offset: 0`）：组件 `focus-visible:ring-2 ring-ring`；  
  原生元素由基座 `:focus-visible` 兜底（`--ds-focus-ring-width: 2px`），两者几何必须一致。  
  `ring-3` / `ring-4` 在任何位置都违规；`ring-0` 允许（环让给容器）；  
  禁止 `outline: none` 无替代移除焦点提示。
- **触控目标**：可点击元素最小命中区 **24×24**（WCAG 2.2 AA 2.5.8）。密集容器里  
  视觉尺寸只有 16–18px 时，加居中扩大的命中层（`::after` 扩到 24px，不改盒子、  
  不撑行高），不得用 `min-w-6 min-h-6`。
- **对比度**：必测组合与实测值见 §1；深色模式独立验证，不得从浅色推断。
- **reduced-motion**：所有新增动画配 reduce 关闭。

---

## 13. 主题维度独立性

共**五个主题维度**（字体轴是相对 UTER 四维的新增项）：

| 维度 | 属性 | 允许影响 | 不允许影响 |
| --- | --- | --- | --- |
| 颜色预设 | `data-theme-preset`（9 套） | 全部语义色（含 surface bridge 派生） | 字号、间距 |
| 圆角 | `data-theme-radius`（5 档） | `--radius` 基准（各档 calc 跟随） | 字号、颜色 |
| 密度 | `data-theme-scale`（sm / 默认 / lg / xl） | `--spacing` + `--ds-*` 控件 / 表格 / 卡片尺寸 | **字号阶梯**、颜色 |
| 字体轴 | `data-theme-font`（system / sans / serif） | `--font-body` 及 serif 细化规则 | 字号、颜色 |
| 明暗 | `.dark` | 全部颜色 Token 取值 + `color-scheme` | 尺寸 |

三条硬约束：

1. **密度不得改动字号语义**：需要更大文字的用户走 simple-large 预设（字号整体  
   ~1.35× 放大、行高同比），密度档与字号彻底解耦。
2. **圆角主题不得影响字号与行高**。
3. **`.dark` 只替换 Token 取值，不新增 Token**：任何新增颜色必须在 `:root` 和  
   `.dark` 各给一次值；`color-mix(… var(--background))` 派生值在 `:root` 声明一次  
   即可自动跟随明暗。

---

## 14. 禁止事项总表

| 类别 | 禁止 | 替代 |
| --- | --- | --- |
| 品牌色 | 组件里写 `#6565E8` 等字面值 | `bg-primary` / `text-primary`；改色改 `theme.css` 两处并按 §3.2 派生规律重算六档 |
| 品牌派生 | 六档之外的透明度凑法（`hover:bg-primary/90` 等） | `hover:bg-primary-hover` / `bg-primary-subtle` 等六档出口（§3.2） |
| 字号 | `text-[0.8rem]` 等任意值 | 十档最近档 |
| 字号下限 | <12px 的可见文本 | caption 12px 起；数值一律 14px 起 |
| 行高 | `leading-snug` / `leading-[1.15]` 字面值 | 档位自带行高 / `leading-[var(--…)]` |
| 标题层级 | `text-base font-medium` 当卡片标题 | h3 = 18/600（`text-lg`） |
| 标题 14px | `text-sm font-semibold` 当区块 / 卡片标题 | 28 / 22 / 18 / 15 四层 |
| 文字层级 | `text-foreground/NN` 冒充层级 | `--fg-*` 七档 |
| 圆角 | `rounded-[3px]` 任意值 | 七档 calc 档位（`rounded-[inherit]` 除外） |
| 投影 | 给卡片 / 弹窗常态加投影 | `ring-1 ring-foreground/10` 描边分层 |
| 焦点环 | `outline: none` 无替代；`ring-3` / `ring-4` | 2px 满色 `ring-2 ring-ring` |
| 控件高度 | 组件里直接写 `h-8` / `h-9` | `--ds-button-height-*` / `--ds-control-height-*` |
| 密度 | 密度档缩放 `--text-*`；新增第四档密度 | 大字需求走 simple-large 预设 |
| 表格 | 固定行高写死 `h-15` | 行高由 `--ds-table-row-padding-y` 推导 |
| 侧边栏 | 自定义侧栏宽度（208px / 13rem 等） | 220px（13.75rem） |
| 触控目标 | 视觉 <24px 且无扩大命中层 | 命中区扩大层（`::after` 居中 24px） |
| 动效 | `duration-300` / `ease-out` 字面值；无 reduce 关闭的新动画 | `--ds-motion-*`；配 `prefers-reduced-motion` |
| 图标 | `@hugeicons/*` 等其他图标库；`strokeWidth` 非 2 | lucide-react；IconProvider 注入 |
| 分类色 | `chart-N` 表达成功 / 失败 | `success` / `warning` / `info` / `destructive` |
| 输入字号 | 移动端单独给 16px 覆盖 | 全平台 14px |
| 内容宽度 | `max-w-[1800px]` 任意值 | `max-w-container` / `max-w-container-wide` |

---

## 附：三份文件的关系

| 文件 | 角色 |
| --- | --- |
| `design-system.md` | UTER 现行规范（品牌 `#5B5EE6`、8px 圆角基准、焦点环 UTER 原生 1px——本规范定 2px） |
| `newapi-design-spec.md` | 上游 new-api 取值全量提取（品牌 `#6565E8`、ring-3 焦点环、密度缩放字号） |
| **本文件** | **合并定案**：差异按裁决总表执行；UTER 的工程纪律（Token 化、门禁思想、守卫测试模式）与上游的视觉语言（1rem 圆角、描边分层、字体轴、surface bridge）合一 |
