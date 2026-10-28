# Components

## 实现位置

- **`src/components/ui/`** —— 组件正式实现位置。Button / Input / Badge / Dialog /
  Table / Select / Tabs / Sidebar 等都在这里。
- **`src/design-system/components/`** —— 只放 `ui/` 没有的排版语义组件
  （`Text` / `Heading`）。
- **`src/design-system/patterns/`** —— 组合模式（`PageHeader`）。

不允许在两处各实现一遍同一个组件。

## 排版语义组件

### Text

```tsx
<Text variant='body' color='secondary' as='p' clamp={2}>
  描述文字
</Text>
```

| Prop       | 取值                                                                           | 说明               |
| ---------- | ------------------------------------------------------------------------------ | ------------------ |
| `variant`  | `body` / `body-long` / `body-sm` / `label` / `caption` / `code` / `code-dense` | 字号档位，不可覆盖 |
| `color`    | `primary` / `secondary` / `danger` / `success` / `inherit`                     | 语义色             |
| `weight`   | `400` / `500` / `600` / `700`                                                  | 覆盖字重           |
| `truncate` | boolean                                                                        | 单行截断           |
| `clamp`    | `1` / `2` / `3`                                                                | 多行截断           |
| `as`       | 任意标签                                                                       | 默认 `span`        |

`body-long` 是 16/26 的长文本档，只用于连续阅读内容（帮助中心、协议、文章、
AI 对话气泡）。判据见 `typography.md`「body 与 body-long」。

### Heading

```tsx
<Heading variant="page-title">模型广场</Heading>
<Heading variant="section-title" level={2}>用量趋势</Heading>
```

| variant         | 视觉      | 默认标签 |
| --------------- | --------- | -------- |
| `display`       | 36/700/40 | `h1`     |
| `page-title`    | 30/600/36 | `h1`     |
| `section-title` | 24/600/32 | `h2`     |
| `card-title`    | 18/600/28 | `h3`     |
| `dialog-title`  | 18/600/28 | `h3`     |
| `group-title`   | 16/600/24 | `h4`     |
| `mono-title`    | 16/600/22 | `h3`     |

`group-title` 是页面层级的第 4 层（卡片内部再分组），`mono-title` 是
`card-title` 的同层级等宽字形，两者都定义在 `typography.md`，这里只是
组件签名的一部分 —— 漏掉它们会让调用方以为只有五档可用。

输出真实 `h1`–`h6`。视觉与语义分离：需要「看起来是 h3、结构上是 h2」时传
`level={2}`。

`multiline` 把行高换成 1.5 比例（见 `typography.md`「多行主标题的行高」），
只用于折 3 行以上的营销主标题：

```tsx
<Heading variant='display' level={1} multiline>
  ...
</Heading>
```

### PageHeader

```tsx
<PageHeader
  title='模型广场'
  description='共 128 个模型可用'
  actions={<Button>刷新</Button>}
/>
```

把「标题 + 描述 + 操作」的排版收敛到一处，页面不再各自决定标题字号与间距。

## 既有组件与 Token 的对应

| 组件             | 字号                        | 字重      | 行高 | 圆角               |
| ---------------- | --------------------------- | --------- | ---- | ------------------ |
| Button           | 14px（`label`）             | 500       | 20px | `--radius-md` 8px  |
| Input / Textarea | 14px（`body-sm`）           | 400       | 20px | `--radius-md` 8px  |
| Label            | 14px（`label`）             | 500       | 20px | —                  |
| Badge            | 12px（`caption`）           | 400       | 16px | `--radius-full`    |
| StatusBadge      | 14px（`body-sm`）           | 400       | 20px | `--radius-full`    |
| Card 标题        | 18px（`h3`）                | 600       | 28px | `--radius-lg` 10px |
| Card 描述        | 14px（`body-sm`）           | 400       | 20px | —                  |
| Dialog 标题      | 18px（`h3`）                | 600       | 28px | `--radius-lg` 10px |
| Dialog 描述      | 14px（`body-sm`）           | 400       | 20px | —                  |
| Table 表头       | 14px（`label`）             | 500       | 20px | —                  |
| Table 单元格     | 14px（`body-sm`）           | 400       | 20px | —                  |
| Table 次要说明   | 12px（`caption`）           | 400       | 16px | —                  |
| Alert 标题       | 14px（`label`）             | 500       | 20px | —                  |
| Alert 描述       | 14px（`body-sm`）           | 400       | 20px | —                  |
| Toast 标题/描述  | 14px（`label` / `body-sm`） | 500 / 400 | 20px | `--radius-lg`      |
| Markdown 正文    | 16px（`body-long`）         | 400       | 26px | —                  |
| Markdown 表格    | 14px（`body-sm`）           | 400       | 20px | —                  |
| Sidebar 菜单项   | 14px（`label`）             | 500       | 20px | `--radius-md`      |
| Sidebar 分组标题 | 12px（`caption`）           | 600       | 16px | —                  |
| Empty 标题       | 18px（`h3`）                | 600       | 28px | —                  |
| Empty 说明       | 14px（`body-sm`）           | 400       | 20px | —                  |

### 规范给出的组件尺寸（§2.1）

这些是规范的硬数值，与本项目 Token 一一对应。改尺寸先改 Token，不要在调用点写死：

| 组件               | 规范值                        | 本项目实现                                                                      |
| ------------------ | ----------------------------- | ------------------------------------------------------------------------------- |
| Button `md`        | 高 36px                       | `size="default"` → `--ds-button-height-md` 36px                                 |
| Button `sm`        | 高 32px                       | `size="sm"` → `--ds-button-height-sm` 32px                                      |
| Input `md`         | 高 40px                       | `--ds-control-height-md` 40px                                                   |
| Input 文字         | 全平台 14px                   | `body-sm`（**不设 H5 16px 例外**）                                              |
| Table 行高         | 48px                          | `TableRow` 的 `h-12`                                                            |
| Table 单元格内边距 | 水平 12 / 垂直 8px            | `TableCell` 的 `px-3 py-2`                                                      |
| Table 表头         | 高 40px、`px-3 py-2`          | `TableHead`                                                                     |
| Alert 内边距       | 16px                          | `Alert` 的 `p-4`，图标与文字间距 `gap-x-3`（12px）                              |
| Sidebar 宽         | 240–280px                     | `SIDEBAR_WIDTH` = 15rem（240px，区间下限）                                      |
| Toast 宽           | ≈356px                        | `sonner` 的默认宽度                                                             |
| 焦点环             | 默认 2px 品牌色；表单控件 1px | `--ds-focus-ring-width` 2px + `--ring`（Input / Textarea / Select 用 `ring-1`） |
| 圆角               | 控件 8px / 卡片弹窗 10px      | `--radius-md` / `--radius-lg`                                                   |

> 2026-10-27 调整记录：Table 行高 60px → 48px；单元格 `p-2` → `px-3 py-2`；
> Alert `px-2.5 py-2` → `p-4`；Sidebar 208px → 240px；Select 面板补
> `rounded-lg shadow-sm`、选项行 `py-1 pr-8 pl-1.5` → `px-2 py-2`；
> AlertDialog 标题 `text-base font-medium` → `text-lg font-semibold`。

### 卡片标题旁的汇总值：14px

卡片标题右侧那一小串「总计 / 合计 / 共 N 条」是**和标题同一层级的补充信息**，
不是说明文字，**一律 14px（`body-sm`，`text-sm`）**：

```tsx
<div className='text-lg font-semibold'>{t('Quota Distribution')}</div>
<span className='text-muted-foreground text-sm'>
  {t('Total:')} {chartData.totalQuotaDisplay}
</span>
```

| 写法                                               | 判定                            |
| -------------------------------------------------- | ------------------------------- |
| `<span className='text-muted-foreground text-sm'>` | ✅ 14px，正确                   |
| `<span className='text-muted-foreground text-xs'>` | ❌ 12px，把汇总值降成了说明文字 |
| 用 `<p>` 或独立一行渲染                            | ❌ 汇总值属于标题行，不另起一行 |

**为什么不能是 12px**：12px 是 caption 档，只给「不含数值的短说明」（占位符、
时间戳、徽标文字、表头列名）。汇总值里有金额和计数，是要被读的数字，12px 在
1440px 桌面上已经需要凑近看。这条与 `typography.md` 的字号用途表一致。

**为什么不能是 16px**：16px 是 `group-title` 与长文本的档位。汇总值跟标题
（18px `card-title`）同排，16px 会让「标题 → 汇总值」只差 2px，层级塌掉。

守卫：`control-typography.test.ts` 的 `keeps card header summaries at 14px`
扫描「同一行里既有 `Total:` / `总计` 又有 `text-xs`」的写法。

### Button 的九个尺寸档

按钮高度**只来自 `size` 档**，全部由密度 Token 驱动（`data-theme-scale`
切换即跟随），不要在调用点写 `h-N`：

| size      | 高度                   | 圆角              | Token                   | 用途                                             |
| --------- | ---------------------- | ----------------- | ----------------------- | ------------------------------------------------ |
| `default` | 36px                   | `rounded-md` 8px  | `--ds-button-height-md` | 常规操作（默认）                                 |
| `sm`      | 32px                   | `rounded-md` 8px  | `--ds-button-height-sm` | 表格行内、密集工具栏                             |
| `lg`      | 40px                   | `rounded-md` 8px  | `--ds-button-height-lg` | 页面级主操作                                     |
| `icon`    | 36px                   | `rounded-lg` 10px | `--ds-button-height-md` | 图标按钮（默认）                                 |
| `icon-sm` | 32px                   | `rounded-lg` 10px | `--ds-button-height-sm` | 工具栏图标按钮                                   |
| `icon-xs` | 24px                   | `rounded-lg` 10px | 固定                    | 头像触发器等极紧凑位，**等于触控下限，不得再小** |
| `icon-lg` | 40px                   | `rounded-lg` 10px | `--ds-button-height-lg` | 强调型图标按钮                                   |
| `inline`  | 文本行盒（≈20px）      | `rounded-none`    | 无                      | 嵌在文字流里的链接式入口（「查看详情」「重试」） |
| `wrap`    | 内容高度，`min-h` 32px | `rounded-md` 8px  | `--ds-button-height-sm` | 标签会折行的按钮（长中文名、版本说明）           |

`icon-xs` 是唯一不受密度 Token 驱动的固定档：24px 已经是 WCAG 2.2 AA 的
触控下限（见 `responsive.md`），再跟随密度收缩就会破线。

#### `inline`：链接式文字按钮

`variant='link'` + `size='inline'`。高度退回文本行盒、左右内边距归零。

为什么需要单独一档：`variant='link'` 无填充、无描边、无内边距，视觉上就是
一段带色的文字。给它套 32px 的盒子会在行内排版里制造 12px 空白，还会与相邻
的 `<a>` 文字对不齐 —— 高度在这里不是「按钮尺寸」，而是「文字行高」。

**只有 `variant='link'` 可以配这一档**：有填充或描边的按钮必须有高度。
表格单元格里的零内边距触发（`px-0 py-0` 的 ghost 按钮）也可以用，但要显式
加 `min-h-8` 兜住点按面积。

#### `wrap`：内容型按钮

标签会折成 2–3 行时用。高度随内容、允许折行，`min-h` 兜住点按地板。

`min-h` **只有三档**，按场景选，不要在调用点自造第四档：

| min-h              | 场景                              |
| ------------------ | --------------------------------- |
| 24px（`min-h-6`）  | 表格单元格 / 徽标密度里的行内触发 |
| 32px（默认）       | 工具栏、弹窗、卡片内的可折行按钮  |
| 44px（`min-h-11`） | 触屏列表里的整行按钮              |

卡片式选项按钮（金额档位、支付方式、分组选择）是**卡片**而不是按钮：它塞了
三行信息（名称、单价、折扣），高度随内容，用 `h-auto min-h-14 rounded-lg p-3`
的卡片结构，不要硬套 `size` 档。

### 加载态用 `loading` 属性

```tsx
<Button loading={mutation.isPending}>保存</Button>
```

`loading` 做三件事，调用方不要再手写：

1. **文字保留在 DOM 里**，宽度不塌缩（手写 `{loading ? <Spinner/> : '保存'}`
   会把按钮缩成一个方块，整行布局跟着跳）；
2. spinner 作为**前置图标追加**，尺寸统一 18px（`size-4.5`，与按钮内图标同档），
   不随 `size` 档缩放；`icon-xs` 的 24px 容器例外（`size-3`）；
3. 自动 `disabled` + `aria-busy='true'` + `data-loading='true'`。

守卫：`components/ui/__tests__/button-loading.test.tsx`。

**存量迁移**：全站仍有约 100 处手写 `animate-spin`（`<Loader2>` /
`<Spinner>` 图标，或 `border-*` 圆环）。这些是按页面逐步迁移的存量，
新增与改动的代码**必须**用 `loading`，不允许再引入手写 spinner +
替换文字的新写法。判定标准是「文字是否被 spinner 替换掉」—— 只是给
一个独立图标加 `animate-spin`（例如刷新图标在请求中转一圈）不在约束内。

## 调用处的边界

页面可以用 `className` 调整**布局**（宽度、间距、对齐），但不得覆盖组件已经
定义的**视觉身份**：

| 允许                               | 不允许                       |
| ---------------------------------- | ---------------------------- |
| `w-full`、`mt-4`、`justify-center` | `rounded-lg`（改按钮圆角）   |
| `max-w-md`                         | `text-base`（改按钮字号）    |
| `hidden sm:block`                  | `font-bold`（改按钮字重）    |
| `aria-label`、`data-*`             | `bg-red-500`（绕开变体系统） |

历史代码里出现过 `className='... rounded-lg'` 覆盖按钮圆角的情况（登录页的
提交按钮），已经清理。新增代码请用 `variant` / `size` 表达差异。

## 状态与可访问性

所有交互组件必须覆盖：

- `default` / `hover` / `focus-visible` / `active` / `disabled` / `loading`
- 键盘可聚焦，焦点环 2px（`--ds-focus-ring-*`），不允许 `outline: none` 抹掉
- 加载态不能改变按钮尺寸（用 `loading` 属性，不要替换成 spinner 后丢掉文字宽度）
- 图标按钮必须提供 `aria-label`

## 导航选中态（左侧面板）

**管理界面左侧面板的选中项，图标与文字用专用的 `text-sidebar-active-foreground`，
底色是 `bg-primary-subtle`。** 选中只靠「专用前景色 + 品牌浅底」两件事表达，
**不加粗、不加边框、不加左侧竖条**。

唯一实现点在 `components/ui/sidebar.tsx`，业务代码不要再各写一份：

| 场景                   | 组件                                  | 生效类                                                                     |
| ---------------------- | ------------------------------------- | -------------------------------------------------------------------------- |
| 一级行（含可折叠父项） | `SidebarMenuButton`                   | `data-active:bg-primary-subtle data-active:text-sidebar-active-foreground` |
| 子项行 / 会话预设      | `SidebarMenuSubButton`                | 同上 + `data-active:[&>svg]:text-sidebar-active-foreground`                |
| 折叠态浮层里的子项     | `nav-group.tsx` 的 `DropdownMenuItem` | `bg-primary-subtle text-sidebar-active-foreground`                         |

### 为什么不直接用 `text-primary`

品牌主色 `#5B5EE6` 落在选中浅底 `#F0F0FF` 上只有 **4.44:1**，差 0.06 未达
WCAG AA 普通文本 4.5:1 —— 导航文字是 14px/500，不属大文本豁免。

规范因此引入**专用 Token** `--sidebar-active-foreground`，只与 `primary-subtle`
浅底配对，**不修改全局品牌主色**。主按钮、链接、焦点环仍然是 `#5B5EE6`。

| 主题 | Token 值  | 配对底色  | 对比度 |
| ---- | --------- | --------- | ------ |
| 浅色 | `#5558D8` | `#F0F0FF` | 4.93:1 |
| 深色 | `#8B8DF5` | `#25264A` | 4.97:1 |

Token 落在 `src/styles/theme.css`（浅/深两处）并映射成 Tailwind 语义色
`--color-sidebar-active-foreground`；预设主题在 `theme-presets.css` 里用
`color-mix(in oklab, var(--primary) 90%, #000)` 从各自品牌色推导，避免
「红主题里出现紫蓝选中字」。

三条硬规则：

1. **图标不单独定色**。Lucide 图标是 `stroke="currentColor"`，行文字换成
   `text-sidebar-active-foreground` 后图标自动跟随。只有子项行需要盖掉子元素
   自带的颜色，才写 `data-active:[&>svg]:text-sidebar-active-foreground`。
   **禁止**写不带状态前缀的 `[&>svg]:text-sidebar-active-foreground` —— 那会让
   未选中行的图标也变色，与「只有选中项用强调色」直接冲突。
2. **不用 `text-primary`，也不用 `text-sidebar-accent-foreground`**。前者对比度
   不达 AA；后者是近黑 `#0F172A`，选中行只剩一层浅底，和右侧内容区的强调色脱节。
3. **未选中行保持 `text-sidebar-foreground`，字重整列统一 500**。选中只换颜色，
   不改字重；整列纹理才均匀（首页顶栏的选中项会加粗，那是另一套导航逻辑）。

守卫：`src/design-system/__tests__/sidebar-active-guard.test.ts`（7 个用例）断言
专用 Token 的生效类、禁止回退 `text-primary` / accent 前景色、Token 双主题存在，
以及「全局品牌主色未被改动」。

## 图标（规范 §2.2，2026-10-28 13:24 版）

**统一 Lucide 线性图标**，**描边统一 2px**；尺寸按场景固定为
**16 / 18 / 24 / 32 / 48** 五档，**默认档 18px**；**颜色跟随父级文字色**。

> **18px 是 13:24 版定的默认档，同时侧边栏从 16px 提到 18px。** 这一版把
> 尺寸表重排成九行：按钮内前置后置、工具栏与卡片操作、**侧边栏**、主导航与
> Tabs、提示与状态五行都是 **18px**；**16px 只剩「紧凑型辅助图标」一行**
> （仅用于密集信息，不作为主要操作图标）。标题句同步改成「默认 18px 图标配
> 24px 点击区域；紧凑场景可使用 16px 图标，导航和主要操作优先使用 18px 图标」
> —— 与表一致，不再需要「以表为准」的仲裁。
>
> 这个值被改过四次，每次都是整表重排而非局部修补：
> **20**（10:00 版首定）→ **16**（10:58 版）→ **20**（11:41 版）→
> **18（13:24 版，当前）**。代码侧因此走过两轮反向迁移，第三轮（20 → 18）
> 见文末迁移记录。**改之前先 `stat` 规范文件 mtime** —— 该文件一天内被改过
> 四次，照着旧口径改代码会白改一轮。

### 三个数值怎么落地

| 规范值              | 实现                                                    | 说明                                                                        |
| ------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| 24px 画框           | `viewBox="0 0 24 24"`                                   | Lucide 内置，不改                                                           |
| 描边 2              | `strokeWidth={2}`                                       | 单位是**画框单位**；16px ≈ 1.33px、**18px = 1.5px**、24px = 2px、48px = 4px |
| 尺寸 16/18/24/32/48 | `size-4` / `size-4.5` / `size-6` / `size-8` / `size-12` | 渲染尺寸就是字形尺寸（`size-4.5` = 4.5 × 4px = 18px）                       |

描边 Token（`tokens/primitives.css` → 语义层 `--ds-*` → 规范原文
`--icon-stroke-width*` 同源别名）**三档取值相同，都是 2**：

| Token                             | 值  | 用途                |
| --------------------------------- | --- | ------------------- |
| `--ds-icon-stroke-width-sm`       | `2` | 16px 的紧凑辅助图标 |
| `--ds-icon-stroke-width`          | `2` | 全站默认            |
| `--ds-icon-stroke-width-emphasis` | `2` | 32px 的强调型图标   |

保留三档是为了让「紧凑 / 默认 / 强调」的语义落点稳定 —— **不是**要造出三种
粗细。规范这一版把尺寸表的 Stroke Width 列统一成 2px，标题句里的描边值也是
2px，两者一致。

全站由 `IconProvider`（`src/context/icon-provider.tsx`）统一注入
`size={18} strokeWidth={2}`。**调用点不要写 `strokeWidth`**；写了也必须是 2，
否则被守卫拦下（1 / 1.5 是更早「1px 视觉线宽」口径，2.25 / 2.5 是上一版三档）。

### 尺寸档

| 场景                                                                                  | 尺寸     | 类名                  |
| ------------------------------------------------------------------------------------- | -------- | --------------------- |
| 按钮内前置后置 / 工具栏与卡片操作 / **侧边栏** / 主导航与 Tabs / 提示与状态（默认档） | **18px** | `size-4.5`            |
| 紧凑型辅助图标（仅密集信息，不作为主要操作图标）                                      | **16px** | `size-4`              |
| 强调型功能入口                                                                        | **24px** | `size-6`              |
| 空状态                                                                                | **32px** | `size-8`              |
| **整页级空状态**                                                                      | **48px** | `size-12`             |
| 容器放不下 16px 的位置（复选框、徽章、日期格、`icon-xs` 按钮）                        | 12 / 14  | `size-3` / `size-3.5` |

**尺寸必须落在 16 / 18 / 24 / 32 / 48 这五档上**（容器约束型 12 / 14 除外）。
档位外的值（20、22、28、36、40…）一律违规。守卫
`icon geometry › only uses the spec size tiers` 会拦下。

**侧边栏与主导航 / Tabs 同档（18px）**，13:24 版把侧边栏从 16 提到 18 ——
16px 现在只剩「紧凑型辅助图标」一个落点。这条最容易被「统一改成 20」的批量
操作带偏，所以 `icon geometry` 里单独有一条用例双向锁住 `sidebar.tsx`：
既不得出现 `[&_svg]:size-5`（升到 20），也不得退回 `[&_svg]:size-4`（16）。

组件级兜底（`[&_svg:not([class*='size-'])]:size-*`）也必须写对：调用点大多不写
尺寸，落到组件兜底上，写错就等于全站默认档写错。守卫
`icon geometry › declares the 18px default on the components that own it` 锁住
`button.tsx` / `tabs.tsx` / `alert.tsx` / `sidebar.tsx` 四处（全部 `size-4.5`）。

不写尺寸也可以——`icons.css` 的 `@layer base` 给无尺寸的 `svg.lucide` 兜底
`--ds-icon-size`（18px），`IconProvider` 的 `size={18}` 是第二层兜底。
但**能写就写**，`size-4.5` / `size-4` 是自解释的。

### 三条硬规则

1. **不允许其他图标库**。`@hugeicons/*`、`@heroicons/*`、`react-icons/*` 一律
   迁到 `lucide-react`；`spec-guards.test.ts` 的 `icon library` 守卫会拦下 import。
   唯一例外是 `components/react-icon-by-name.tsx`（运营在后台配置的支付方式图标，
   名字运行时才确定，无法预先枚举）。
2. **尺寸与描边只能用规范值**。12/14px 只允许出现在固定尺寸容器里
   （见下文「容器约束」）；描边只有 2。
   守卫：`icon geometry › only uses the spec size tiers`、
   `› declares the 18px default on the components that own it` 与
   `› uses the single stroke-width value the spec now prescribes`。
3. **颜色跟随父级文字色**。Lucide 内置 `stroke="currentColor"`，只要不写
   `text-blue-400` 这类调色板色就自动成立；状态色用语义 Token
   （`text-muted-foreground` / `text-success` / `text-warning` /
   `text-destructive` / `text-primary`）。守卫：`icon geometry › lets the icon
   color follow the parent text color`。

### 容器约束：12 / 14px 字形的唯一合法来源

尺寸表的最小档是 16px，但**容器放不下时以容器为准**。判据不是「想画小一点」，
而是「16px 会不会顶破容器」：16px 方框里塞 16px 字形，对勾会压到边框上；
24px 徽章里塞 16px，上下各剩 4px，视觉上反而更挤。

> **2026-10-28 10:58 版把规范里的「容器约束」表删掉了**，只留尺寸表。
> 这不是「12px 现在合法」，而是「规范不再逐条列举」—— 容器物理约束没有消失，
> 16px 方框里的对勾仍然是 12px。本节因此继续生效，并在
> `docs/design-system/exceptions.md` 的 **E23** 登记。

| 容器                  | 字形    | 位置                                                     |
| --------------------- | ------- | -------------------------------------------------------- |
| 16px 复选框方框       | 12px    | `ui/checkbox.tsx`                                        |
| 24px 徽章             | 12px    | `ui/badge.tsx`                                           |
| 头像 24/32/40px 三档  | 12–16px | `ui/avatar.tsx`                                          |
| 20px 图标徽章         | 12px    | `ui/icon-badge.tsx` 的 `xs` / `stat` 小屏档              |
| 日历日期格            | 14px    | `ui/calendar.tsx` 的月份导航箭头                         |
| 12px 文字档的侧栏分组 | 14px    | `ui/sidebar.tsx`                                         |
| Badge 内的删除 `X`    | 12px    | `tag-input.tsx`                                          |
| 16px 提示行           | 12px    | `command-menu.tsx` 的装饰箭头                            |
| 密集代码视口工具栏    | 14px    | `json-code-editor.tsx`（见「mono 密集行高」）            |
| 24px 步进按钮         | 12px    | `features/channels/components/numeric-spinner-input.tsx` |
| 签到格                | 12px    | `features/profile/components/checkin-calendar-card.tsx`  |

三条硬约束：

1. 白名单**只按文件路径**生效，不做「小于 16px 一律放过」的模糊匹配 —— 新文件
   写小图标照样被守卫拦下；
2. 白名单里每一条都必须是「**图标元素自己写了小于 16px 的类名**」。靠祖先
   `[&>svg]:size-*` 约束的不算（`features/dashboard/` 曾因此被误加进白名单，
   已移除）；
3. 容器放大到能容纳 16px 时，**同步删掉**对应白名单条目。

守卫：`spec-guards.test.ts` 的 `SMALL_GLYPH_ALLOW` 与审计脚本的 `SMALL_ALLOW`
同源，两边必须一起改。

另外两条同样由守卫兜住：**`strokeWidth` 只能取 `2`**（三档 Token 同值，禁止 2.25 / 1.75 / 2.5 回潮）、
**不引入非 Lucide 的图标组件**。

历史迁移记录：33 个文件的 Hugeicons 图标已按映射表迁到 Lucide
（`Add01Icon→Plus`、`Cancel01Icon→X`、`SearchIcon→Search`、`Tick02Icon→Check`、
`Loading03Icon→LoaderCircle`、`MoreHorizontalCircle01Icon→CircleEllipsis` 等），
`Spinner` 组件也换成了 Lucide `LoaderCircle`。

2026-10-27：302 处 14px 图标升到 16px（123 个文件），79 处显式 `strokeWidth`
删除（34 个文件），全站图标尺寸与线宽由此收敛到单一来源。

2026-10-28（规范从「细线型」改为「中等偏粗」）：全站描边 1.5 → **2.25**、
默认尺寸 16 → **20px**；`size-2` / `h-2.5` 等低于档位下限的图标抬到 12px；
空状态 40/48px 图标收到 32px；侧边栏与 Tabs 图标 16 → 20px。

2026-10-28 10:00（§2.2 整表重写）：描边三档统一为 **2**（2.25 / 1.75 / 2.5 作废）；
尺寸改为**逐场景固定** 16 / 20 / 32 / 48 —— 侧边栏与 Tabs 回落到 **16px**，
新增「整页级空状态 48px」档（7 处整页错误/空状态恢复 48px），
24 / 28px 的 20 处图标按场景归入 16 或 32 档。

2026-10-28 11:41（§2.2 再次重排，20px 回归默认档）：`--primitive-icon-glyph`
16 → **20**，`IconProvider` 注入 `size={20}`；`button.tsx` / `tabs.tsx` /
`alert.tsx` 的组件兜底 `size-4` → `size-5`（`icon-xs` 24px 容器仍留 16）；
320 处调用点显式 `size-4` / `h-4 w-4` 升到 `size-5` / `h-5 w-5`
（142 个文件，脚本按 AST 判定祖先组件，`render={<Button/>}` 的 Trigger 一并
算作按钮上下文）；侧边栏保持 16px 不动。空状态「有底框」变体从 16 收到 20
（32px 方框内上下各 6px）。

2026-10-28 13:24（§2.2 第三次重排，**20 → 18 反向迁移**）：`--primitive-icon-glyph`
20 → **18**，`IconProvider` 注入 `size={18}`；**侧边栏从 16 提到 18**，与主导航 /
Tabs 同档，16 只剩「紧凑型辅助图标」一个落点。`button.tsx` / `tabs.tsx` /
`alert.tsx` / `sidebar.tsx` 的组件兜底 `size-5`（侧边栏 `size-4`）统一成
**`size-4.5`**；**320 处调用点 / 129 个文件**由 AST codemod 从 `size-5` →
`size-4.5`、`h-5 w-5` → `h-4.5 w-4.5`（幂等复跑 0 处）。`icon-xs` 的 24px
容器仍留 `size-4`，`Empty` 的 `icon` 变体 32px 方框内放 18px。docs-web 同步：
页头主题 / 语言按钮、侧边栏行、上一页下一页箭头、搜索触发都从 16/20 收到 18，
只有面包屑分隔符保留 16（紧凑型辅助档），Fumadocs 槽位图标由 `global.css`
显式钉住 `1.125rem`。

> 教训：**规范里的图标数字一天改了四次**（20 → 16 → 20 → 18）。每次动手前先
> `stat _reports/uter-design-system-latest.md` 看 mtime，再读 §2.2 的表格本身，
> 不要读上一轮留在代码注释里的数字 —— 注释比规范旧是常态。

## 图表排版（canvas）

VChart 把文字画在 `<canvas>` 上，`fontSize` 必须是**数字**，既写不了
`text-xs` 也读不到 CSS 变量。于是字号在 TS 侧**镜像**一份，唯一来源是
`design-system/tokens/chart-typography.ts`：

| 常量                         | 值   | 用途                   |
| ---------------------------- | ---- | ---------------------- |
| `CHART_FONT_SIZE`            | 12px | 轴标签、图例、数据标签 |
| `CHART_LABEL_FONT_SIZE`      | 12px | 柱顶数值、节点文字     |
| `CHART_AXIS_TITLE_FONT_SIZE` | 12px | 轴标题                 |

三条约束：

1. 图表只能 import 这三个常量，**不得在 option 里写字面量** —— 门禁 T4 拦
   `fontSize: N`；
2. 这里只允许出现阶梯内的档位（12/14/16/18/24/30/36）。要新档位先改
   `tokens/typography.css`，再同步到这里；
3. 图表的**颜色**同理：canvas 拿不到 `var(--primary)`，用
   `color-mix(in oklch, …)` + `useThemeColors` 在运行时解析，不要写死色值
   （门禁 T8）。

## 原生 `<button>` / `<input>` 的边界

全站有 39 处原生 `<button>`（`components/` 与 `features/` 下，已排除
`components/ui/` 自身实现）与 21 处原生 `<input>`。它们**不是「还没迁移的
欠债」**，但也**不是想留就能留** —— 每处必须落进下面六类之一，落不进就必须
换成 `Button` / `Input`。

判据是**这个元素的语义**，不是它长得像不像按钮：

| 类别          | 判据                                                                                         | 现有落点（抽样）                                                                         |
| ------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 整行 / 列表项 | 整块区域可点，内容是一组信息而不是一个标签；`aria-expanded` 之外的布局语义 `Button` 表达不了 | 表格内可点单元格、公告行、API Key 行、分组选项行、`multi-select` 的值胶囊                |
| 手风琴触发器  | 带 `aria-expanded`，点击展开一块内容                                                         | `codex-usage-dialog`、`channel-advanced-section`、`task-pricing-matrix`                  |
| 标签页 / 分段 | 带 `role='tab'` 或一组互斥选项，选中态由外部状态驱动                                         | `rankings-hero` 周期切换、图表类型切换、模型图 tab、首页终端 demo 的 tab                 |
| 复合控件根    | 自研输入原语的一部分：数字步进器、密码显隐、侧栏拖拽轨、日历格                               | `numeric-spinner-input`、`secret-input` / `secret-textarea` 的眼睛按钮、`sidebar` 拖拽轨 |
| 图标按钮      | 只有图标、`aria-label` 说明动作，尺寸 16–24px                                                | 图例提示、筛选项移除、重试链入口                                                         |
| 表单隐藏字段  | `type='hidden'` / 文件选择器 / 只读指示符                                                    | react-hook-form 隐藏字段、`<input type='file'>`、Markdown 任务列表 checkbox              |

约束：

1. **样式必须复用控件 Token**：高度走 `--ds-control-height-*` 或
   `--ds-button-height-*`，圆角走 `--radius-*`，颜色走语义色，过渡走
   `ds-motion-*`（或裸 `transition-*`，默认值已被指到 `--ds-motion-fast`）。
   **不得自造一套高度与描边** —— 胶囊高度统一读 `--ds-chip-height`。
2. **触控目标不小于 24×24**（WCAG 2.2 AA · 2.5.8）。密集容器里视觉尺寸只能
   16–20px 时，加 `.ds-touch-target`：它用居中伪元素把**命中区**扩到 24px，
   视觉与布局都不变。给 `min-width` 会撑起行高、顶开徽标，不要这么做。
3. **键盘焦点由基座兜底，不需要每处手写**。`foundations/accessibility.css`
   对 `:where(a, button, [role='button'], [tabindex]):focus-visible` 画
   2px 环；组件层写的是 `focus-visible:ring-2 focus-visible:ring-ring`，
   两者几何必须一致（都是**贴边**，`outline-offset: 0`）。**只有一种焦点
   指示器**，不要引入非 0 的 `outline-offset` 或第二套颜色。
4. 隐藏型（`hidden` / `sr-only` / `opacity-0` 覆盖层）不参与统计，也不受
   样式约束。

> 历史教训：这一节上一版写的是「只要它是用户会点、点了会触发操作的入口，
> 就必须用 `Button`」，而同一页上面列的 39 处里有 34 处正是「会点」的
> —— 条款与现状自相矛盾，等于没有条款。**能落进六类的是结构，落不进的是欠债。**
