# Colors

颜色 Token 声明在 `src/styles/theme.css`（`:root` + `.dark`）与
`src/design-system/tokens/colors.css`（语义别名）。设计系统**不新建调色板**，
只增加一层语义映射，把「用途」指向既有 Token。

原因很直接：两套颜色体系意味着两套深色模式、两套对比度问题。

## 色板骨架（slate 中性色 + 品牌紫蓝）

2026-10-27 按新规范整体替换：中性色从 oklch 灰阶换成 **slate**，品牌色从
`#0F172A` 深墨色 / `#6467f0` 旧紫改为 **`#5B5EE6` 紫蓝**。

| 用途                        | 浅色（`:root`）             | 深色（`.dark`） |
| --------------------------- | --------------------------- | --------------- |
| `--background` 页面底色     | `#FFFFFF`                   | `#020617`       |
| `--foreground` 一级文字     | `#0F172A`                   | `#F8FAFC`       |
| `--card` / `--popover` 表面 | `#FFFFFF`                   | 深色表面        |
| `--muted` 次级表面          | `#F1F5F9`                   | `#1E293B`       |
| `--border` 描边             | `#E2E8F0`                   | `#334155`       |
| `--input` 输入框描边        | `#D1D5E5`                   | `#45465F`       |
| `--primary` 品牌主色        | `#5B5EE6`                   | `#8B8DF5`       |
| `--destructive` 危险        | `#DC2626`                   | `#7F1D1D`       |
| `--success` 成功            | `#16A34A`                   | `#16A34A`       |
| `--warning` 警告            | `oklch(0.681 0.162 75.834)` | 深色档          |

## 品牌色阶：6 条语义出口，一个来源

`--primary` 是**唯一入口**。其余五档全部由它派生，组件不得写品牌色字面值：

| Token                          | 用途                               | 浅色      | 深色                  |
| ------------------------------ | ---------------------------------- | --------- | --------------------- |
| `--primary` / `primary-strong` | 主按钮背景、链接、选中强调         | `#5B5EE6` | `#8B8DF5` / `#A1A3F7` |
| `--hover-primary`              | 主按钮悬停（同色相加深）           | `#494CC7` | `#A1A3F7`             |
| `--primary-active`             | 主按钮按下（再加深，与悬停可区分） | `#3F42B0` | `#B7B8FA`             |
| `--primary-subtle`             | 浅底：选中行、轻强调背景           | `#F0F0FF` | `#25264A`             |
| `--primary-subtle-hover`       | 浅底的悬停一档（`color-mix` 派生） | 16% 混合  | 同声明                |
| `--primary-border`             | 品牌描边：选中控件边框             | `#C7C8FF` | `#5558DC`             |

对应 Tailwind 工具类：`bg-primary` / `bg-primary-strong` / `hover:bg-primary-hover` /
`active:bg-primary-active` / `bg-primary-subtle` / `hover:bg-primary-subtle-hover` /
`border-primary-border` / `ring-ring`。

「选中强调」最主要的落点是**导航选中态**：左侧面板选中行的图标与文字用
**专用 Token `text-sidebar-active-foreground`**（浅色 `#5558D8` / 深色
`#8B8DF5`），底色用 `bg-primary-subtle`。

为什么不用 `text-primary`：`#5B5EE6` 落在 `#F0F0FF` 上只有 **4.44:1**，差 0.06
未达 AA 普通文本 4.5:1。专用 Token 把这一对提到 **4.93:1**，且**不动全局品牌
主色** —— 主按钮、链接、焦点环仍然是 `#5B5EE6`。它只与 `primary-subtle` 浅底
配对，不要当通用强调色用。实现位置、三条硬规则与完整对比度表见 components.md
「导航选中态（左侧面板）」。

**规范要求的按钮三态**：

```tsx
// 主按钮：默认 strong，悬停 hover，按下 active
'bg-primary-strong text-primary-foreground hover:bg-primary-hover active:bg-primary-active'
```

三条硬规则：

1. **不得用透明度凑悬停**。`hover:bg-primary/90` 在深色底上会发灰、在浅色底上
   会泛白，已全站替换为 `hover:bg-primary-hover`。同类：`hover:bg-destructive/90`
   → `hover:bg-destructive-hover`、`hover:bg-secondary/80` → `hover:bg-secondary-hover`。
2. **浅底加深一档用 Token，不用 `/15`**。`bg-primary/10 hover:bg-primary/15`
   改为 `bg-primary-subtle hover:bg-primary-subtle-hover`；危险色同理
   `bg-destructive-subtle hover:bg-destructive-subtle-hover`。
3. **`--color-primary` 必须指向 `var(--primary)`**。历史上它被写死成 `#6467f0`，
   与 `--primary` 完全脱钩 —— 改品牌色对任何 `bg-primary` 都无效。
   现在 `src/design-system/__tests__/spec-guards.test.ts` 的 `brand color source`
   守卫会拦下组件里的品牌色字面值。

**主题预设自动派生**：`theme-presets.css` 对非 `default` 预设用
`color-mix(in oklch, …)` 从该预设的 `--primary` 推出 hover / active / subtle /
border / `--ring`，不需要每套预设手抄一份色阶。

## 文字层级：`--fg-*` 七档

规范 §1.1.2 要求文字颜色按语义 Token 使用，禁止随意写十六进制。本项目对应实现
用 `--fg-*` 命名空间（**不能叫 `--text-*`**，见下方「命名冲突」）：

| 层级     | Token                           | Tailwind 类           | 浅色      | 深色      | 使用范围                         |
| -------- | ------------------------------- | --------------------- | --------- | --------- | -------------------------------- |
| 一级文字 | `--fg-primary` / `--foreground` | `text-foreground`     | `#0F172A` | `#F8FAFC` | 页面标题、正文、主要数据、输入值 |
| 二级文字 | `--fg-secondary`                | `text-fg-secondary`   | `#334155` | `#CBD5E1` | 描述、辅助说明、次级信息         |
| 三级文字 | `--fg-tertiary`                 | `text-fg-tertiary`    | `#475569` | `#A8B3C5` | 时间戳、元信息、次要标签         |
| 禁用文字 | `--fg-disabled`                 | `text-fg-disabled`    | `#64748B` | `#94A3B8` | 禁用按钮、禁用字段               |
| 反色文字 | `--fg-inverse`                  | `text-fg-inverse`     | `#FFFFFF` | `#0F172A` | 深色表面或品牌实心背景           |
| 链接文字 | `--fg-link`                     | `text-fg-link`        | `#5B5EE6` | `#A1A3F7` | 文本链接、可导航文字             |
| 占位符   | `--fg-placeholder`              | `text-fg-placeholder` | `#64748B` | `#94A3B8` | 输入框 placeholder               |

### 命名冲突：为什么不是 `--text-primary`

规范原文用的名字是 `--text-primary`，但**在本项目里不能用**，两个原因：

1. **Tailwind v4 的 `--text-*` 是字号命名空间**。声明 `--text-primary` 会生成一个
   `text-primary` 字号工具类，与品牌色工具类 `text-primary` 撞车。
2. **`check-design-tokens.mjs` 的 T1 规则**把 `--text-*` 视为「字号阶梯声明」，
   只允许出现在 `typography.css`，其他位置出现即判违规。

因此文字色统一走 `--fg-*`，工具类前缀同为 `fg-`；一级文字沿用既有的
`text-foreground`（它本来就等于规范里的 `text-primary` 语义）。

### 用法边界

- **正文与标题默认一级文字**。不要仅为突出标题而改用品牌色。
- **三级色只给非阅读主体的辅助小字**（页脚法规行、版权行、时间戳、元信息）。
  正文、表单标签、列表说明一律二级色；把它当「更浅的次要文字」用在内容区，
  等于主动放弃可读性。
- **禁用态用 `text-fg-disabled`**，不要借 `text-fg-tertiary` —— 后者是「辅助小字」
  档位，允许清单里没有禁用态。
- **不得用 `opacity` / 透明度后缀模拟层级**。`text-foreground/60` 冒充次要文字
  会被审计规则 C3 判违规，改用 `text-fg-secondary`。

`--tertiary-foreground` 不是写死的灰值，而是
`color-mix(in oklch, var(--muted-foreground) 88%, var(--background))`：主题预设
各自覆盖 `--muted-foreground`（含暖灰），派生值自动跟随，不会在暖灰主题里冒出
冷灰。实测对比度 **4.6:1**（浅色 `#747474`）/ **6.6:1**（深色 `#a2a2a2`）。

允许出现 `text-tertiary-foreground` 的位置（其余一律用 `text-muted-foreground`）：

| 位置                     | 文件                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| 页脚法规行、版权行       | `components/layout/components/footer.tsx`                                                 |
| 首页营销终端、营销页装饰 | `features/home/components/hero-terminal-demo.tsx`、`sections/hero.tsx`                    |
| 图表覆盖层坐标标签       | `features/dashboard/components/flow/flow-charts.tsx`                                      |
| 分页信息、搜索占位符     | `components/data-table/core/pagination.tsx`、`features/pricing/components/search-bar.tsx` |

> 2026-10-27 收口：价格表、缓存价格单元格、用量日志表格、指标卡说明、
> 未激活 Tab 文字等 **69 处**内容区用法已全部改回 `text-muted-foreground`。
> 表格单元格下限同时提到 14px（`body-sm`）。

组件里优先使用 Tailwind 语义类（`bg-card`、`text-muted-foreground`、
`border-border`），它们指向同一批 Token。`--ds-color-*` 主要用于 CSS 文件与
需要 `var()` 的场景。

## 明暗主题

`.dark` 只替换 Token 取值，**不新增 Token**。因此任何新增颜色都必须在 `:root`
和 `.dark` 各给一次值，否则深色模式下会漏。唯一的例外是
`--primary-subtle-hover` / `--destructive-subtle` / `--destructive-subtle-hover`
这类 `color-mix(… var(--background))` 派生值 —— 它们在 `:root` 声明一次，
`--background` 翻转时自动跟随。

## 图表色（`chart-1` … `chart-5`）的正确用法

`chart-N` 是**分类色**，不是状态色。二者分工写死如下，不允许互换：

| 用途                                                   | 用什么                                         | 例子                                                                             |
| ------------------------------------------------------ | ---------------------------------------------- | -------------------------------------------------------------------------------- |
| 表达成功 / 警告 / 危险 / 信息                          | `success` / `warning` / `destructive` / `info` | 渠道状态、任务结果、配额告警                                                     |
| 浅底深字的语义徽标                                     | `{status}-soft` + `{status}-soft-foreground`   | 「已启用」绿底徽标（见 `exceptions.md` D6）                                      |
| **区分彼此、不带成败含义**的分类（标签、类别、图标底） | `chart-1` … `chart-5`                          | `status-badge` 的 `purple/blue/cyan/lime/pink/teal/violet`、`icon-badge` 的 tone |

三条硬规则：

1. **不得用 `chart-N` 表达成功/失败**。`dotColorMap` / `textColorMap` 里
   `success`、`warning`、`danger`、`info` 四个键**必须**指向语义 Token，
   指向 `chart-*` 即违规（`design-system/__tests__/semantic-colors.test.ts` 守卫）。
2. **分类色不追求语义正确，只追求可区分**。需要第 6 种分类色时先问「这 6 个
   类别真的都必须在同一屏区分吗」，确实需要再申请新增 `--chart-6`，
   而不是随手拿一个调色板类名。
3. **分类色只做底色/前景色，不做强调边框**。边框要表达层级用 `border`，
   要表达状态用 `{status}`。

为什么不在 `chart-N` 之外再造一套 `category-N`：状态语义只有 4 组，而徽标需要
5+ 种可区分色，`chart-N` 本来就是为此存在的（图表与徽标共用同一批「只是为了
区分」的颜色），再造一套等于两套分类色并存。

## 语法高亮色（`syntax-*`）

代码块、JSON 查看器、diff 视图里的 token 着色，走 5 个专用 Token：

| Token             | 用途                         | 浅色取色   | 深色取色   |
| ----------------- | ---------------------------- | ---------- | ---------- |
| `syntax-keyword`  | 关键字（`const` / `import`） | purple-700 | purple-300 |
| `syntax-string`   | 字符串字面量                 | green-800  | green-300  |
| `syntax-number`   | 数字 / 布尔                  | orange-800 | orange-300 |
| `syntax-function` | 函数名、命令                 | blue-700   | blue-300   |
| `syntax-property` | 属性名、flag                 | teal-800   | teal-300   |

用法是 `text-syntax-keyword` 这样的工具类，定义在 `styles/theme.css` 的
`:root` / `.dark` 与 `@theme` 映射里。注释色不单列 Token，用
`text-muted-foreground` + `italic`。

**为什么单列一套**：这些颜色既不表达状态（不是 `success`/`destructive`），
也不是「只是为了区分彼此」的分类色（`chart-N` 不保证可读性）—— 它们要在
深色代码底上满足对比度，又要彼此可辨。此前是散在组件里的 One Dark 硬编码
hex，换个主题就变成一块冷色补丁。

## 第三方品牌色与多序列分类色（`brand-colors.ts`）

有两类颜色**本质上无法语义化**，集中声明在
`design-system/tokens/brand-colors.ts`，组件一律从那里 import：

| 常量                                           | 内容                                                  | 为什么不能语义化                                                |
| ---------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------- |
| `VENDOR_BRAND_COLORS`                          | OpenAI / Anthropic / Google / DeepSeek 等 16 个厂商色 | 别人的商标配色，改成 `--primary` 等于改人家 logo                |
| `PAYMENT_BRAND_COLORS`                         | 支付宝蓝、微信绿、Stripe 紫等 8 个支付渠道色          | 同上；图标形状已是品牌，颜色必须一致，否则用户认不出来          |
| `CATEGORICAL_CHART_PALETTE`                    | 23 色多序列调色板                                     | 一屏要区分十几个模型 / 用户，`chart-1…5` 五个槽位不够           |
| `VENDOR_FALLBACK_PALETTE`                      | 未知厂商兜底序列                                      | 与品牌色重复度最低的一段                                        |
| `CHART_OTHER_SERIES_COLOR`                     | 「其他」聚合桶                                        | 数据里的真实序列，需要在堆叠柱里被看见                          |
| `CHART_FALLBACK_SERIES_COLOR`                  | 无调色板时的首条序列色                                | 兜底路径                                                        |
| `CHART_NO_THEME_TEXT_COLOR` / `…_STROKE_COLOR` | canvas 在主题解析完成前的兜底色                       | SSR / 首帧 / 单测拿不到 CSS 变量，canvas 必须要有真实颜色字符串 |

**硬规则**：

1. 业务代码里**不得**出现裸 `#hex` / `rgba()`。门禁 T8 会拦，只有
   `brand-colors.ts`、`src/assets/**`（SVG 图形本身）、Token 定义 CSS
   与 `*.test.ts(x)`（断言夹具）例外。
2. 新增品牌色只加「确实有官方视觉规范」的那个，并注明取值来源。
3. 分类色不追求语义正确，只追求可区分 —— 与 `chart-N` 的分工一致。

## 允许 `white` / `black` 的场景

`text-white` / `bg-white` / `bg-black` 不是「写死色值」的同义词 —— 它们是无彩色
极值，在下面这些场景里**没有**对应 Token 可替代，且必须保持极值：

| 场景                                       | 写法                                       | 位置                                                                   |
| ------------------------------------------ | ------------------------------------------ | ---------------------------------------------------------------------- |
| 弹窗 / 抽屉 / 移动端全屏菜单的遮罩         | `bg-surface-overlay/{10,50}`（已走 Token） | `ui/{dialog,alert-dialog,sheet,drawer}.tsx`、`layout/constants.ts`     |
| 二维码白底、滑块手柄                       | `bg-surface-pure`（已走 Token）            | `two-fa-setup-dialog.tsx`、`cn-pay-web-dialog.tsx`、`ui/slider.tsx`    |
| 媒体预览的纯黑背板（不透明，压住图片边缘） | `bg-black`                                 | `usage-logs/components/task-artifacts.tsx`                             |
| SVG 描边（色块上的对勾）                   | `stroke-white`                             | `config-drawer.tsx` 的主题色选择器                                     |
| 营销页终端演示（已改 Token）               | `bg-card/95` + `border-border`             | `home/components/hero-terminal-demo.tsx`（`--ds-elevation-marketing`） |

除上表之外新增 `white` / `black` 用法，先判断是不是「遮罩 / 纯白表面 / 媒体背板 /
SVG 描边」四类之一；都不是就说明应该用语义 Token。

> **`<meta name="theme-color">` 已改为从 Token 解析**：`components/theme-switch.tsx`
> 通过 `useThemeColor('--background')` 取值，浅色/深色与主题预设都会同步，
> 不再写死 `#020817` / `#fff`。`index.html` 里的静态值只是首屏前的占位，
> 与深色背景 Token 保持一致。

## 禁止事项

- 组件里写死色值：`#5B5EE6`、`rgb(0 0 0 / .5)`、`text-[#333]`
  （`spec-guards.test.ts` 的 `brand color source` 守卫覆盖品牌色 11 个档位；
  `check-design-tokens.mjs` 的 T8 规则扫全量裸色值）。
- 用 `chart-N` 表达成功 / 失败语义（分类用途见上节）。
- 用 `opacity` 代替正确的 Token（例如 `text-foreground/60` 冒充次要文字）；
  次要文字用 `text-fg-secondary` 或 `text-muted-foreground`。
- 用透明度凑悬停/按下态（`hover:bg-primary/90`），改用 `-hover` / `-active` Token。

## 对比度要求（规范 §1.1.2「文本对比度验收」）

- 普通文本（含 14px 常规正文与 16px 长文本）：**≥ 4.5:1**。
- 大文本（≥24px 常规字重，或 ≥18.66px 粗体）：**≥ 3:1**。
- 控件边界、图标及必要的非文本视觉信息：**≥ 3:1**，并同时检查焦点可见性。
- `#5B5EE6` 与白字对比度约 **4.7:1**，满足 AA 普通字号目标。
- **每次调整 Token、主题背景或透明度后都要重算前景/背景组合**，不能只看单个
  色值判断合规。深色主题必须独立验证，不能依据浅色结果推断。
- `text-fg-tertiary` / `text-fg-disabled` / placeholder 若在实际背景上未达目标，
  应提升为更深/更亮的颜色，不得为了视觉轻盈牺牲可读性。
- `--ds-color-text-disabled` 不适用于需要阅读的内容，只用于禁用态。

> **未执行**：本版整改未做逐组合的对比度实测（无自动化对比度工具接入）。
> 上表数值来自规范原文与历史实测记录，新增/修改的颜色组合需要补测。
