# Spacing & Shape

## 间距

间距阶梯就是 Tailwind 的 4px 单位，因此**没有**另建一套 `--spacing-*`。
直接用 `gap-2`、`p-4`、`mt-6`。

| 场景 | 值 | Tailwind |
| --- | --- | --- |
| 图标与文字 | 4–6px | `gap-1` / `gap-1.5` |
| 控件之间 | 8px | `gap-2` |
| 表单标签与控件 | 8px | `gap-2` |
| 卡片内元素 | 16px | `gap-4` |
| 卡片之间 | 16px | `gap-4` |
| 区块之间 | 24–32px | `gap-6` / `gap-8` |
| 页面左右留白 | 24–32px | `px-6` / `px-8` |

## 密度 Token

密度只允许改变「留白与控件高度」，不允许改变正文语义。见
`tokens/spacing.css`：

| Token | 默认 | `sm` | `xl` |
| --- | --- | --- | --- |
| `--ds-table-row-padding-y` | 12px | 8px | 14px |
| `--ds-table-cell-padding-x` | 12px | 8px | 14px |
| `--ds-control-height-md` | 40px | 36px | 44px |
| `--ds-button-height-md` | 36px | 32px | 40px |
| `--ds-form-field-gap` | 8px | 6px | 10px |
| `--ds-card-padding` | 24px | 16px | 28px |
| `--ds-page-gutter` | 24px | 16px | 32px |

> 紧凑模式可以把表格行的上下留白从 12px 收到 8px，但**不应该**把 16px 正文
> 改成 12px。字号缩放是 `data-theme-scale` 的无障碍职责，密度只管留白。

## 圆角

基准 `--radius` = 8px（即默认控件圆角 r-md），其余档位按比例推导，因此
`data-theme-radius` 改基准就能整体缩放。

| Token | 值 | 用途 |
| --- | --- | --- |
| `--radius-xs` | 4px | 极小徽标、内嵌标记 |
| `--radius-sm` | 6px | 关闭按钮、密集控件点击区 |
| `--radius-md` | 8px | **按钮、输入框、标签页触发器（默认）** |
| `--radius-lg` | 10px | **卡片、弹窗、标签页容器、图标按钮** |
| `--radius-xl` | 12px | 强调容器、大圆角方形头像 |
| `--radius-2xl` | 16px | 展示型卡片 |
| `--radius-full` | 9999px | 胶囊徽标、圆形头像、开关轨道 |

## 描边

| Token | 值 | 用途 |
| --- | --- | --- |
| `--ds-stroke-width` | 1px | 卡片、弹窗、表格分隔线 |
| `--ds-color-border` | `--border` | 默认描边 |
| `--ds-color-border-input` | `--input` | 输入控件描边 |
| `--ds-focus-ring-width` | 2px | 焦点外扩环 |

层级靠「1px 描边 + 表面色差」表达，不靠投影。

## 投影

| Token | 用途 |
| --- | --- |
| `--ds-elevation-overlay` | 弹窗、抽屉、浮层 |
| `--ds-elevation-popover` | 下拉面板、气泡、悬浮提示 |

**除这两类之外一律不投影。** 卡片、表格、侧边栏、页面容器都不加阴影。

历史代码里仍散落着 `shadow-xs` / `shadow-sm`，属于待清理项（见
[exceptions.md](./exceptions.md)）；新增代码不要再写。
