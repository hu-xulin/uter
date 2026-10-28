# Spacing & Shape

## 间距

间距阶梯就是 Tailwind 的 4px 单位，因此**没有**另建一套 `--spacing-*`。
直接用 `gap-2`、`p-4`、`mt-6`。

| 场景           | 值      | Tailwind            |
| -------------- | ------- | ------------------- |
| 图标与文字     | 4–6px   | `gap-1` / `gap-1.5` |
| 控件之间       | 8px     | `gap-2`             |
| 表单标签与控件 | 8px     | `gap-2`             |
| 卡片内元素     | 16px    | `gap-4`             |
| 卡片之间       | 16px    | `gap-4`             |
| 区块之间       | 24–32px | `gap-6` / `gap-8`   |
| 页面左右留白   | 24–32px | `px-6` / `px-8`     |

## 内容宽度

内容区宽度只有三档，对应三种版面：

| 档位       | 值     | 写法                   | 用途                                 |
| ---------- | ------ | ---------------------- | ------------------------------------ |
| 营销内容列 | 1152px | `max-w-6xl`            | 官网首页各区块（首屏是「读」的版面） |
| 标准内容区 | 1280px | `max-w-container`      | 控制台、排行、法务、文档             |
| 密集比较页 | 1800px | `max-w-container-wide` | 模型广场（侧栏 + 价格矩阵）          |

后两档来自 Token：`--ds-content-max` / `--ds-content-max-wide`
（`styles/index.css` 的 `@utility`，内部读这两个 Token）。业务代码
**不要**再写 `max-w-[1800px]`、`max-w-[1280px]`。

营销内容列不设 Token：1152px 是 `max-w-6xl` 的原生档位，官网首页六个区块
共用一个值，改它等于改营销页版式，不属于「设计值需要集中管理」的范畴。

为什么宽表单独一档：模型广场是「模型 × 价格 × 供应商」的横向比较矩阵，
1280px 会把价格列挤成两行，比较立刻失效；1800px 是 280px 筛选侧栏 +
四到五列模型卡片仍然能并排的上限。它**不是**「更大的内容区」，只有这一
类页面可以用。

弹窗 / 抽屉的宽度**不属于内容区宽度**：它们各自按 `sm:max-w-[…]` 声明，
不读这两个 Token。

## 密度 Token

密度只允许改变「留白与控件高度」，不允许改变正文语义。见
`tokens/spacing.css`：

| Token                       | 默认 | `sm` | `xl` |
| --------------------------- | ---- | ---- | ---- |
| `--ds-table-row-padding-y`  | 12px | 8px  | 14px |
| `--ds-table-cell-padding-x` | 12px | 8px  | 14px |
| `--ds-control-height-md`    | 40px | 36px | 44px |
| `--ds-control-height-sm`    | 36px | 32px | 40px |
| `--ds-button-height-md`     | 36px | 32px | 40px |
| `--ds-button-height-sm`     | 32px | 28px | 36px |
| `--ds-button-height-lg`     | 40px | 36px | 44px |
| `--ds-nav-height-md`        | 32px | 28px | 36px |
| `--ds-nav-height-sm`        | 28px | 24px | 32px |
| `--ds-nav-height-lg`        | 48px | 40px | 52px |
| `--ds-form-field-gap`       | 8px  | 6px  | 10px |
| `--ds-card-padding`         | 24px | 16px | 28px |
| `--ds-page-gutter`          | 24px | 16px | 32px |

`--ds-nav-height-*` 驱动侧边栏菜单项与分组标题行高（原先是写死的
`h-8` / `h-7` / `h-12`，密度档对导航完全无效）。`sm` 档的
`--ds-nav-height-sm` 收到 24px 就是触控下限，不得再低。

### 内联胶囊高度（不随密度变化）

| Token              | 值   | 用途                                                  |
| ------------------ | ---- | ----------------------------------------------------- |
| `--ds-chip-height` | 21px | 多选的值胶囊、`+N more` / `Collapse` 徽标按钮、标签条 |

胶囊是**同一行并排**的，高度必须逐像素一致，否则换行时参差不齐。此前这个
值在 4 个文件里各写了一遍 `h-[calc(--spacing(5.25))]`，改一处就错位。

21px 不是 4px 栅格的整数倍 —— 它由 `text-xs`（12/16）+ 上下各 2.5px 光学
补正得出，属于胶囊专用档，**不要**并进 `--ds-control-height-*`（那是表单
控件的 24/32/44 三档），也**不跟密度档走**（字号不变，胶囊就不该变）。

> 紧凑模式可以把表格行的上下留白从 12px 收到 8px，但**不应该**动正文基准
> （14px）。密度只管留白与控件尺寸，字号不随密度变化 —— 需要放大文字走
> 「Simple Large-font」预设（见 [typography.md](./typography.md) 的「无障碍大字档」）。

## 圆角

基准 `--radius` = 8px（即默认控件圆角 r-md），其余档位按比例推导，因此
`data-theme-radius` 改基准就能整体缩放。

| Token           | 值     | 用途                                   |
| --------------- | ------ | -------------------------------------- |
| `--radius-xs`   | 4px    | 极小徽标、内嵌标记                     |
| `--radius-sm`   | 6px    | 关闭按钮、密集控件点击区               |
| `--radius-md`   | 8px    | **按钮、输入框、标签页触发器（默认）** |
| `--radius-lg`   | 10px   | **卡片、弹窗、标签页容器、图标按钮**   |
| `--radius-xl`   | 12px   | 强调容器、大圆角方形头像               |
| `--radius-2xl`  | 16px   | 展示型卡片                             |
| `--radius-full` | 9999px | 胶囊徽标、圆形头像、开关轨道           |

**任意圆角值只剩一类结构性用法**：`rounded-[inherit]`
（`ui/scroll-area.tsx`）。滚动视口继承父容器圆角，是 Tailwind 官方
escape hatch，7 档里没有任何一档能表达「和父级一样」——写死任何一档都会
在 `data-theme-radius` 缩放时与父容器错位。门禁 T10 直接把它识别为合法
写法，不需要 ALLOWLIST 条目。

## 描边

| Token                     | 值         | 用途                       |
| ------------------------- | ---------- | -------------------------- |
| `--ds-stroke-width`       | 1px        | 卡片、弹窗、表格分隔线     |
| `--ds-color-border`       | `--border` | 默认描边                   |
| `--ds-color-border-input` | `--input`  | 输入控件描边               |
| `--ds-focus-ring-width`   | 1px        | 焦点外扩环（原生元素兜底） |

层级靠「1px 描边 + 表面色差」表达，不靠投影。

**焦点环恒 1px**（规范 §1.4 `stroke-focus` Outside 1px / §1.7），包括「键盘
用户的第一个焦点」（`skip-to-main`）、拖拽手柄（`resizable`）、自研输入原语
（`tag-input` 的 `focus-within`）与按钮。原生元素走 `--ds-focus-ring-width`
的 `outline`，组件走 `focus-visible:ring-1` —— 两条路径同宽、同色（`--ring`）、
都贴边（`outline-offset: 0`），同一次 Tab 序列里环不会变粗细。

> 2026-10-29 变更：此前是「表单控件 1px、其余 2px」两档。两档并存的代价是
> 同一次 Tab 里环会跳（按钮 2px → 输入框 1px → 按钮 2px），而且 2px 环压在
> 卡片/输入框的 1px 描边上会被读成双线框。现在 `spec-guards` 只认 1px，2px /
> 3px / 4px 在任何位置都红；`ring-0` 仍允许（InputGroup 把环让给容器）。

**非 1px 描边只有两类，且都不是「容器的边框」：**

| 类别     | 取值       | 判据                                         | 现有位置                                                        |
| -------- | ---------- | -------------------------------------------- | --------------------------------------------------------------- |
| 镂空环   | 2px        | 用背景色画描边，把叠在一起的元素「挖」出间隙 | `home/sections/features.tsx` 的 API/SDK/CLI 圆形叠层            |
| 图形描边 | 1px 或 2px | 图形本身是画出来的形状，线宽随图形尺寸       | 加载 spinner（32px 圆环用 2px）、图表 series 指示线（1px 虚线） |

两条硬约束：① 描边宽度**不出现小数**（`border-[1.5px]` 在 1x 屏会渲染成
1px 或 2px 的不确定结果，同一元素在 1x / 2x 屏上粗细不一致）；② 图形描边
写在图形组件内部，不得出现在容器上。

## 投影

**四档投影 + 一档状态辉光**，判据是「这块面还有没有一个自己的平面位置」：

| Token                      | 值                                        | 用途                             |
| -------------------------- | ----------------------------------------- | -------------------------------- |
| `--ds-elevation-none`      | `none`                                    | 静止的页面内元素（默认）         |
| `--ds-elevation-popover`   | `0 1px 2px 0`                             | 下拉面板、气泡、悬浮提示         |
| `--ds-elevation-overlay`   | `0 4px 6px -4px, 0 10px 15px -3px`        | 弹窗、抽屉、浮层                 |
| `--ds-elevation-raised`    | `0 12px 24px -12px, 0 2px 6px -2px`       | 拖拽中的元素（瞬时离开文档流）   |
| `--ds-elevation-marketing` | `0 20px 50px -25px`（dark 另给 60px/0.7） | 营销展示卡片（脱离页面平面）     |
| `--ds-glow-online`         | `0 0 8px`                                 | 在线状态点（状态语义，不是层级） |

**除这五档之外一律不投影。** 卡片、表格、侧边栏、页面容器、按钮、徽标都
不加阴影 —— 它们靠 1px 描边与表面色差分层。

为什么「拖拽」与「营销卡片」各占一档而不复用 `overlay`：

1. 拖拽是**瞬时**状态：影子要够重才能让用户确认「它被我拿起来了」，但只
   持续几百毫秒，不会长期占据视觉重量；
2. 营销展示卡片是**静态**的展示物，影子必须大而柔（50px 模糊、-25px 收缩），
   `overlay` 的 15px 撑不住 2xl 圆角的展示卡片；
3. 复用 `overlay` 会让「弹窗」与「首页演示窗口」在视觉上无法区分层级。

`--ds-glow-online` 不是投影档，是**状态语义**：亮着 = 在线。它不表达层级，
所以只在状态点出现，不能拿来给卡片「提亮」。

写法只有 `shadow-(--ds-elevation-{none|popover|overlay|raised|marketing})`
与 `shadow-(--ds-glow-online)`。`shadow-sm` / `shadow-lg` / `shadow-[…]`
全部被门禁 T6 拦下；自造档位（例如 `--ds-elevation-card`）同样被拦 ——
门禁只认 `check-design-tokens.mjs` 里 `ELEVATION_TOKENS` 列出的六个值。
新增档位必须先改 `tokens/elevation.css` 与本文件，再往集合里加。

## 动效

时长按「这段动效在表达什么」分五组，而不是按组件分。全部落在
`tokens/elevation.css` 的 `--ds-motion-*`：

| 组       | Token                                                                | 值                                   | 用途                         |
| -------- | -------------------------------------------------------------------- | ------------------------------------ | ---------------------------- |
| 交互反馈 | `--ds-motion-fast`                                                   | 100ms                                | 颜色、描边、透明度的状态变化 |
|          | `--ds-motion-base`                                                   | 200ms                                | 展开收起、宽度位移这类形变   |
|          | `--ds-motion-slow`                                                   | 350ms                                | 浮层视口 / 背板级整块位移    |
| 营销节奏 | `--ds-motion-marketing-fast`                                         | 300ms                                | 营销面的悬停、下划线生长     |
|          | `--ds-motion-marketing-base`                                         | 500ms                                | 营销面的容器级展开、全屏菜单 |
| 内容入场 | `--ds-motion-enter`                                                  | 600ms                                | 首屏元素的观看节奏           |
| 循环动画 | `--ds-motion-loop-shimmer / pulse / caret / spin / marquee / border` | 1.8s / 1.5s / 1s / 0.8s / 20s / 3.2s | 周期由内容决定               |
| 数据过渡 | `--ds-motion-data-fast` / `--ds-motion-data`                         | 250ms / 500ms                        | 值在变化，不是操作被响应     |

缓动只有三条，与组绑定，不允许自由组合：

| Token                        | 值                            | 绑定                       |
| ---------------------------- | ----------------------------- | -------------------------- |
| `--ds-motion-ease`           | `cubic-bezier(0.4,0,0.2,1)`   | 交互反馈、数据过渡         |
| `--ds-motion-ease-marketing` | `cubic-bezier(0.16,1,0.3,1)`  | 营销节奏、内容入场         |
| `--ds-motion-ease-snappy`    | `cubic-bezier(0.22,1,0.36,1)` | 整块位移（浮层视口、背板） |

写法：交互反馈与营销节奏用工具类（时长与缓动一起下发）——
`ds-motion-fast` / `ds-motion-base` / `ds-motion-slow` /
`ds-motion-marketing-fast` / `ds-motion-marketing` / `ds-motion-data`。
入场、循环两类必须与 `@keyframes` 写在一起（`styles/index.css`），直接引
`var(--ds-motion-enter)` / `var(--ds-motion-loop-*)`。

**不要**再写 `duration-300`、`duration-[0.35s]`、`ease-out`、
`ease-[cubic-bezier(...)]`、`1.8s`、`0.6s` 这类字面值。

### 裸 `transition-*` 的默认值也是这个集合的一部分

`transition-colors` / `transition-transform` / `transition-all` **不写时长**
时，Tailwind 读 `--default-transition-duration`（内置 **150ms**）与
`--default-transition-timing-function`。150ms 不在 fast/base/slow 三档里 ——
也就是说全站 103 处裸 `transition-*` 一直在用集合外的时长，而门禁只检查
**显式写出**的 `duration-*`，看不见它们。

所以这两个默认值在 `tokens/elevation.css` 里被指到了集合内：

```css
@theme {
  --default-transition-duration: var(--ds-motion-fast);
  --default-transition-timing-function: var(--ds-motion-ease);
}
```

含义：**裸 `transition-*` = 交互反馈最快一档（100ms）**。要 200 / 350 就
显式写 `ds-motion-base` / `ds-motion-slow`。这条必须写在 `@theme` 里 ——
写进 `:root` 时 Tailwind 读不到，工具类仍旧是 150ms（与字号阶梯同一个坑）。

**唯一的例外是 `animate-in` / `animate-out` 上的 `duration-*`**：tw-animate
用它设的是 `animation-duration`（进入/退出动画），和 `transition-duration`
是两个轴。这类写法必须和 `animate-in` / `animate-out` 出现在同一行，门禁 T11
按此放行；不要把它挪到别的元素上冒充交互反馈。

为什么时长和缓动捆在一起：缓动是**节奏的一部分**，不是独立维度。500ms 配
`ease-in-out` 会拖沓，100ms 配 `ease-out-expo` 会抽搐 —— 允许自由组合就等于
允许组合出错的节奏。

判定口诀：**如果删掉这个动画，用户会以为「没点上」，那它就是交互反馈**；
如果删掉只是少了点氛围，它属于营销节奏或内容入场；如果它要一直动，那它是
循环动画，周期由内容走完一圈的时间决定，与「快慢」无关。
