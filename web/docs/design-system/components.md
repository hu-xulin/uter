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
<Text variant="body" color="secondary" as="p" clamp={2}>
  描述文字
</Text>
```

| Prop | 取值 | 说明 |
| --- | --- | --- |
| `variant` | `body` / `body-sm` / `label` / `caption` / `code` / `code-dense` | 字号档位，不可覆盖 |
| `color` | `primary` / `secondary` / `danger` / `success` / `inherit` | 语义色 |
| `weight` | `400` / `500` / `600` / `700` | 覆盖字重 |
| `truncate` | boolean | 单行截断 |
| `clamp` | `1` / `2` / `3` | 多行截断 |
| `as` | 任意标签 | 默认 `span` |

### Heading

```tsx
<Heading variant="page-title">模型广场</Heading>
<Heading variant="section-title" level={2}>用量趋势</Heading>
```

| variant | 视觉 | 默认标签 |
| --- | --- | --- |
| `display` | 36/700/40 | `h1` |
| `page-title` | 30/600/36 | `h1` |
| `section-title` | 24/600/32 | `h2` |
| `card-title` | 18/600/28 | `h3` |
| `dialog-title` | 18/600/28 | `h3` |

输出真实 `h1`–`h6`。视觉与语义分离：需要「看起来是 h3、结构上是 h2」时传
`level={2}`。

### PageHeader

```tsx
<PageHeader
  title="模型广场"
  description="共 128 个模型可用"
  actions={<Button>刷新</Button>}
/>
```

把「标题 + 描述 + 操作」的排版收敛到一处，页面不再各自决定标题字号与间距。

## 既有组件与 Token 的对应

| 组件 | 字号 | 字重 | 行高 | 圆角 |
| --- | --- | --- | --- | --- |
| Button | 14px（`label`） | 500 | 20px | `--radius-md` 6px |
| Input / Textarea | 16px（例外 E1） | 400 | 24px | `--radius-md` 6px |
| Label | 14px（`label`） | 500 | 20px | — |
| Badge | 12px（`caption`） | 400 | 16px | `--radius-full` |
| Card 标题 | 18px（`h3`） | 600 | 28px | `--radius-lg` 8px |
| Card 描述 | 14px（`body-sm`） | 400 | 20px | — |
| Dialog 标题 | 18px（`h3`） | 600 | 28px | `--radius-lg` 8px |
| Dialog 描述 | 14px（`body-sm`） | 400 | 20px | — |
| Table 表头 | 14px（`label`） | 500 | 20px | — |
| Table 单元格 | 14px（`body-sm`） | 400 | 20px | — |
| Table 次要说明 | 12px（`caption`） | 400 | 16px | — |
| Sidebar 菜单项 | 14px（`label`） | 500 | 20px | `--radius-md` |
| Sidebar 分组标题 | 12px（`caption`） | 600 | 16px | — |
| Empty 标题 | 18px（`h3`） | 600 | 28px | — |
| Empty 说明 | 14px（`body-sm`） | 400 | 20px | — |

## 调用处的边界

页面可以用 `className` 调整**布局**（宽度、间距、对齐），但不得覆盖组件已经
定义的**视觉身份**：

| 允许 | 不允许 |
| --- | --- |
| `w-full`、`mt-4`、`justify-center` | `rounded-lg`（改按钮圆角） |
| `max-w-md` | `text-base`（改按钮字号） |
| `hidden sm:block` | `font-bold`（改按钮字重） |
| `aria-label`、`data-*` | `bg-red-500`（绕开变体系统） |

历史代码里出现过 `className='... rounded-lg'` 覆盖按钮圆角的情况（登录页的
提交按钮），已经清理。新增代码请用 `variant` / `size` 表达差异。

## 状态与可访问性

所有交互组件必须覆盖：

- `default` / `hover` / `focus-visible` / `active` / `disabled` / `loading`
- 键盘可聚焦，焦点环 2px（`--ds-focus-ring-*`），不允许 `outline: none` 抹掉
- 加载态不能改变按钮尺寸（用 `loading` 属性，不要替换成 spinner 后丢掉文字宽度）
- 图标按钮必须提供 `aria-label`

## 图标

统一 Lucide 线性图标，跟随父级文字色。按钮内图标用 `size-4`（16px 画框内
14px 字形），密集工具栏用 `size-3.5`。不要用彩色图标做状态表达，状态用 `Badge`
的语义色。
