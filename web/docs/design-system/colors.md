# Colors

颜色 Token 已经存在于 `src/styles/theme.css`（`:root` + `.dark`）。设计系统**不新建
调色板**，只增加一层语义别名，把「用途」映射到既有 Token 上。

原因很直接：两套颜色体系意味着两套深色模式、两套对比度问题。文档也明确要求
复用既有 Token。

## 语义别名（`tokens/colors.css`）

| 语义 Token | 指向 | 用途 |
| --- | --- | --- |
| `--ds-color-text-primary` | `--foreground` | 正文与标题 |
| `--ds-color-text-secondary` | `--muted-foreground` | 说明文字、占位符 |
| `--ds-color-text-disabled` | `muted-foreground` 55% | 禁用态文字 |
| `--ds-color-text-danger` | `--destructive` | 错误提示 |
| `--ds-color-text-success` | `--success` | 成功提示 |
| `--ds-color-surface-page` | `--background` | 页面底色 |
| `--ds-color-surface-card` | `--card` | 卡片表面 |
| `--ds-color-surface-popover` | `--popover` | 浮层表面 |
| `--ds-color-surface-muted` | `--muted` | 骨架屏、标签容器 |
| `--ds-color-action-primary` | `--primary` | 主按钮 |
| `--ds-color-border` | `--border` | 卡片、分隔线 |
| `--ds-color-border-input` | `--input` | 输入框描边 |
| `--ds-color-focus-ring` | `--ring` | 焦点环 |

组件里应当优先使用 Tailwind 的语义类（`bg-card`、`text-muted-foreground`、
`border-border`），它们已经指向同一批 Token。`--ds-color-*` 主要用于 CSS 文件
和需要 `var()` 的场景。

## 明暗主题

`.dark` 只替换 Token 取值，**不新增 Token**。因此任何新增颜色都必须在 `:root`
和 `.dark` 各给一次值，否则深色模式下会漏。

## 与设计文档的已知差异

| 项 | 文档 1.1 | 项目实际 | 处理 |
| --- | --- | --- | --- |
| Brand primary | `#0F172A` 深墨色 | `#6467f0` 品牌紫 | **保留项目品牌色**。文档自己要求复用已验证的 Token；换主色属于品牌决策，不在设计系统重构范围内。 |
| Neutral 色阶 | slate（`#E2E8F0` 等） | oklch 灰阶 | 保留。视觉等价，且已适配深浅色。 |

如果将来要切到文档的 slate 骨架，只需改 `theme.css` 的 `:root` / `.dark`，
所有组件会自动跟随 —— 这正是把颜色收敛到 Token 的意义。

## 禁止事项

- 组件里写死色值：`#0F172A`、`rgb(0 0 0 / .5)`、`text-[#333]`。
- 绕过语义层直接引用 `--chart-1` 之类的图表色去当背景。
- 用 `opacity` 代替正确的 Token（例如 `text-foreground/60` 冒充次要文字）；
  次要文字用 `text-muted-foreground`。

## 对比度要求

正文与背景对比度 ≥ 4.5:1，大字号（≥18px 或 ≥14px 粗体）≥ 3:1。
`--ds-color-text-disabled` 不适用于需要阅读的内容，只用于禁用态。
