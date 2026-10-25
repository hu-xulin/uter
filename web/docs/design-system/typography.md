# Typography

字号是设计系统里最容易被随手破坏的一层 —— 一个 `text-[15px]` 就够让页面看起来
「哪里不对」。因此这里只有九档，且由代码强制。

## 九档字号表

| Token | 语义 | 字号 | 字重 | 行高 | Tailwind | 组件 |
| --- | --- | --- | --- | --- | --- | --- |
| display | 页面主视觉 | 36px | 700 | 40px | `text-4xl` | `Heading variant="display"` |
| h1 | 页面标题 | 30px | 600 | 36px | `text-3xl` | `Heading variant="page-title"` |
| h2 | 区块标题 | 24px | 600 | 32px | `text-2xl` | `Heading variant="section-title"` |
| h3 | 卡片/弹窗标题 | 18px | 600 | 28px | `text-lg` | `Heading variant="card-title"` |
| body | 正文 | 16px | 400 | 24px | `text-base` | `Text variant="body"` |
| body-sm | 次要正文、表格单元格 | 14px | 400 | 20px | `text-sm` | `Text variant="body-sm"` |
| label | 按钮、表单标签、导航 | 14px | 500 | 20px | `text-sm font-medium` | `Text variant="label"` |
| caption | 说明、占位符、徽标 | 12px | 400 | 16px | `text-xs` | `Text variant="caption"` |
| mono | 代码、金额、等宽标识 | 16px | 400 | 24px | `font-mono text-base` | `Text variant="code"` |

补充档（不在九档内，仅用于兼容）：

| Token | 用途 | 约束 |
| --- | --- | --- |
| `text-xl`（20/28） | 既有 20px 标题 | 不得用于新增页面标题 |

阶梯到 `text-4xl`（36px）为止。**48px 以上不纳入系统**：营销页主视觉同样使用
`display` 档（36/700/40），需要更大字号时按 [exceptions.md](./exceptions.md)
的流程登记，而不是随手写 `text-[3rem]`。

## 字体家族

- 界面文字：Inter，中文回落思源黑体（`@fontsource-variable/noto-sans-sc`）。
  字体栈只声明一次，在 `styles/theme.css` 的 `--font-ui`。
- 等宽：`--font-mono`，用系统等宽字体（SF Mono / Menlo / Consolas）。
- **字距恒为 0**，不要用 `tracking-*`。

## 使用方法

```tsx
import { Heading, Text } from '@/design-system'

<Heading variant="page-title">模型广场</Heading>
<Text as="p" variant="body" color="secondary">
  共 {{ count }} 个模型可用
</Text>
<Text variant="code-dense" as="code">{model.model_name}</Text>
```

`Heading` 的 `variant` 决定**视觉**，`level` 决定**语义**（默认由 variant 推导）。
需要「视觉上小、语义上大」时显式传 `level`，不要用 `div` 假装标题。

## 禁止事项

- `text-[15px]`、`text-[0.9em]`、`text-[1.75rem]` —— 任意字号，被 T2 拦截。
- `leading-[26px]` —— 任意行高，被 T3 拦截。等宽密集场景用
  `leading-[var(--ds-line-mono-dense)]`。
- `style={{ fontSize: 13 }}` —— 内联字号，被 T4 拦截（图表 canvas 除外）。
- 页面里自己写 `<h1 className="text-3xl font-bold">` —— 用 `Heading`。

## 想加一档字号怎么办

1. 先确认现有九档真的覆盖不了（绝大多数情况是覆盖得了的）；
2. 在 `tokens/typography.css` 的 `@theme` 里加 `--text-*` 与 `--text-*--line-height`；
3. 在 `tokens/semantic.css` 里加对应的 `--ds-text-*` / `--ds-line-*`；
4. 在 `__tests__/tokens.test.ts` 的 `LADDER` 里登记期望值；
5. 更新本文件的表格。

只做第 2 步而不做 3–5 步，等于又开了一套平行标准。

## 密度与字号缩放

`[data-theme-scale='sm' | 'lg' | 'xl']` 会整体缩放 `--text-*` 阶梯
（见 `styles/theme-presets.css`）。这是**用户选择的无障碍档位**，不是设计值的
另一套定义 —— 默认档位永远是本文件的九档。

注意：预设只覆盖字号，不覆盖 `--text-*--line-height`，因此放大档位的行高仍按
基础阶梯计算。这是已知的待改进项。

## 多行主标题的行高（E7）

`display` 档的单行行高是 40px（36px × 1.11）。这个比例在单行时是对的，但中文
营销主标题常折成 3–4 行，1.11 会让行与行挤在一起。

因此给多行场景单独一档：

```css
--ds-line-display-multiline: 1.5; /* 无单位比例，随字号缩放 */
```

用 `Heading` 的 `multiline` 开启：

```tsx
<Heading variant='display' level={1} multiline>
  Uter.ai 优特智能，一个入口，直达全球大模型
</Heading>
```

两个刻意的设计：

1. **无单位比例而不是像素**。响应式下移动端 30px × 1.5 ≈ 40.5px、桌面
   36px × 1.5 ≈ 48.6px，行高跟着字号走，不会出现「字号变小、行高还是 48px」
   的倒挂。
2. **规则放在 `@layer components` 之外**。调用方要保留 Tailwind 的响应式字号
   （`text-3xl md:text-4xl`），只覆盖行高；放在 components 层会被 utilities 层
   的 `line-height` 覆盖，等于没写。这是全站唯一一处刻意的层外规则，仅此一例。
