# UTER Design System 3.0
## 官方设计系统 · 唯一设计实施标准

**文档级别：** Engineering Standard / Mandatory  
**适用项目：** Uter  
**适用范围：** PC Web、H5、响应式页面及全部业务组件  
**技术基准：** Tailwind CSS v4、CSS Variables、组件化前端架构  
**字体体系：** Inter + 思源黑体（Source Han Sans）  
**品牌主色：** #5558D8  
**中性色体系：** Slate  
**基础圆角：** 10px  
**最小字号：** 12px  
**PC Web 正文基准：** 14px  
**正式版本：** 3.0

---

# 0. 规范效力与执行原则

## 0.1 唯一标准

本文件是 Uter 前端设计系统的唯一正式实施标准。

所有页面、组件、交互、视觉状态、设计 Token、主题变量及新增 UI 功能，均必须遵守本规范。

本规范与旧版设计文档、临时设计稿、开发人员个人习惯或 AI 自行生成的样式发生冲突时：

1. 本规范优先于旧版设计文档。
2. 已批准的本规范 Token 优先于组件内自定义样式。
3. 语义 Token 优先于直接使用原始色值。
4. 统一组件优先于重复实现的局部组件。
5. 自动化验收规则优先于人工主观判断。
6. 本规范未明确允许的设计变更，不得由 AI 自行扩大解释。

不得通过删除规范、降低测试标准、关闭检查或绕过质量门禁来使代码通过验收。

## 0.2 核心设计原则

Uter 的设计风格定位：

- Professional：专业、可信。
- Minimal：简洁、克制。
- Consistent：统一、一致。
- Precise：信息准确、层次清晰。
- Accessible：满足无障碍要求。
- Functional：优先保障业务操作效率。

具体原则：

1. 页面层级优先通过背景表面差异和边框表达，不依赖大量投影。
2. 品牌色用于品牌识别、重要操作、链接和选中状态，不应滥用。
3. 中性色使用 Slate 色系，避免任意引入灰色。
4. 字号、行高、字重必须使用统一字体 Token。
5. 间距采用 4px 基础网格。
6. 圆角采用统一 Token，不得随意指定。
7. 所有交互组件必须具有完整状态。
8. Light 和 Dark 两套主题必须独立定义、独立验收。
9. 不得只依靠颜色表达成功、失败、警告或选中状态。
10. 组件的视觉尺寸与实际交互命中区域必须分别定义。
11. 动效必须有明确用途，并尊重系统减少动态效果设置。
12. 所有视觉展示必须来自真实 Token，不得使用单独维护的演示数据冒充实际实现。

## 0.3 执行权限与禁止事项

WorkBuddy 可以在授权代码范围内：

- 创建和修改设计 Token。
- 重构组件样式。
- 建立统一组件及变体。
- 迁移旧样式。
- 删除确认无引用的废弃 Token。
- 建立自动化检查和展示页面。
- 执行测试、修复问题并生成报告。

禁止：

- 未经批准新增品牌主色。
- 使用未登记的任意颜色作为正式 UI 颜色。
- 使用任意字号、间距、圆角代替 Token。
- 在 Dark 主题中直接复制 Light 主题的颜色。
- 通过降低对比度标准使检查通过。
- 删除焦点状态、禁用键盘操作或减少可访问性。
- 使用透明度叠加代替完整的语义状态色。
- 未经检查删除仍在使用的旧 Token。
- 通过全局 CSS 覆盖破坏组件状态。
- 以视觉效果为理由绕过自动化验收。

---

# 1. Typography 字体系统

## 1.1 字体家族

统一字体：

```css
--font-sans:
  "Inter",
  "Source Han Sans SC",
  "Noto Sans CJK SC",
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;

--font-mono:
  ui-monospace,
  SFMono-Regular,
  Menlo,
  Consolas,
  "Liberation Mono",
  monospace;
```

要求：

- 英文、数字优先使用 Inter。
- 中文优先使用思源黑体。
- 系统缺少指定字体时，使用后备字体。
- 禁止在不同页面使用不同的默认字体体系。
- 禁止在单个组件中擅自指定其他字体。
- Mono 字体仅用于代码、技术标识、日志、ID、Token 和需要等宽对齐的数字。

## 1.2 字号 Token

统一使用以下十档字号：

| Token | 字号 | 行高 | 字重 | 用途 |
|---|---:|---:|---:|---|
| `text-xs` | 12px | 18px | 400 | 辅助说明、最小标签 |
| `text-sm-dense` | 13px | 20px | 400 | 密集表格、日志 |
| `text-base` | 14px | 22px | 400 | 默认正文 |
| `text-md` | 15px | 24px | 400 | 次级正文 |
| `text-lg` | 16px | 26px | 400 | 长文本、说明文档 |
| `text-xl` | 18px | 26px | 500 | 卡片及次级标题 |
| `text-2xl` | 20px | 28px | 600 | 小型区块标题 |
| `text-3xl` | 24px | 32px | 600 | 区块标题 |
| `text-4xl` | 30px | 38px | 600 | 页面标题 |
| `text-5xl` | 36px | 44px | 600 | 营销展示、特殊大标题 |

禁止：

- 使用小于 12px 的常规 UI 文本。
- 随意使用 11px、13.5px、17px 等非标准字号。
- 使用浏览器默认字号作为组件最终标准。
- 将 13px 密集文本用于长篇正文。
- 通过缩小字号解决页面布局问题。

## 1.3 语义字号角色

页面标题：

```css
.page-title {
  font-size: 30px;
  line-height: 38px;
  font-weight: 600;
}
```

区块标题：

```css
.section-title {
  font-size: 24px;
  line-height: 32px;
  font-weight: 600;
}
```

卡片标题：

```css
.card-title {
  font-size: 18px;
  line-height: 26px;
  font-weight: 600;
}
```

分组标题：

```css
.group-title {
  font-size: 16px;
  line-height: 24px;
  font-weight: 600;
}
```

默认正文：

```css
.body {
  font-size: 14px;
  line-height: 22px;
  font-weight: 400;
}
```

长文本：

```css
.body-long {
  font-size: 16px;
  line-height: 26px;
  font-weight: 400;
}
```

辅助说明：

```css
.caption {
  font-size: 12px;
  line-height: 18px;
  font-weight: 400;
}
```

规则：

- `small` 和 `caption` 不得重复定义为两个不同字号体系。
- `body-sm` 不得成为新的独立字号角色。
- `body-medium` 可以作为同字号、不同字重的语义变体。
- 行高必须与字号角色配套。
- 特殊内容可以使用明确批准的 `leading-*` Token，但不得随意覆盖。
- 同一层级标题必须使用一致的字号和字重。

## 1.4 字重

```css
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

使用规则：

- 正文：400。
- 次级强调：500。
- 标题及重要信息：600。
- 700 仅用于需要明显强调的特殊场景。
- 不允许使用伪粗体作为默认设计策略。

## 1.5 Mono 字号

四档（2026-11-03 拍定：在 mono-xs/sm/base 三档基础上新增 `mono-title` 标题档）：

| Token | 字号 | 行高 | 字重 | 用途 |
|---|---:|---:|---|---|
| `mono-xs` | 12px | 18px | 400 | 小型 ID、标签 |
| `mono-sm` | 13px | 20px | 400 | 表格、日志 |
| `mono-base` | 14px | 22px | 400 | 代码、技术信息 |
| `mono-title` | **16px** | 22px | 600 | 用等宽字形的卡片标题（定价页卡片模型名） |

`mono-title` 与正文标题档的关系：等宽字形在同等视觉重量下比 Inter 小一档，
故卡片标题取 16px（而非 18px）+ 600 字重，行高随之收紧为 22px。定价页
模型卡片的模型名 Heading 必须使用 `mono-title`（16px）。
无障碍预设（simple-large）下 mono 系各档随预设整体放大，不视为违规。

API Key、请求 ID、模型名称、Token 数量和代码标识必须使用 Mono 字体体系。

## 1.6 数字排版

涉及余额、金额、Token 用量、请求次数、时间统计、计费数据和表格连续数值时使用等宽数字：

```css
font-variant-numeric: tabular-nums;
```

禁止同一列数字因为位数不同而发生不必要的视觉跳动。

## 1.7 H5 字体规则

- H5 常规正文继续使用 14px。
- 辅助文字不得小于 12px。
- 表单输入文本默认至少 16px。
- 表单输入字号 16px 是为了减少 iOS Safari 自动放大等兼容问题，不是 WCAG 的字号要求。
- 长文本、协议和帮助内容使用 16px / 26px。

---

# 2. Color 色彩系统

## 2.1 色彩使用原则

颜色必须通过语义 Token 使用。

禁止在业务组件中直接使用未经登记的 HEX、RGB、HSL 或 OKLCH 色值。

允许使用原始色值的地方：

- Token 源文件。
- 设计系统展示页面的原始值展示。
- 经批准的图表数据映射。
- 明确标记的第三方品牌资产。
- 经过批准的特殊视觉效果。

所有正式颜色必须具备：

- Light 主题值。
- Dark 主题值。
- 语义用途。
- 必要时的前景色。
- 必要时的背景色。
- 必要时的边框色。
- 对比度验收记录。

## 2.2 品牌色

Uter 品牌主色采用紫蓝色。

### Light 主题

| Token | 色值 | 用途 |
|---|---|---|
| `brand-primary` | `#5558D8` | 主按钮、品牌链接、重要强调 |
| `brand-hover` | `#4F52D1` | Hover |
| `brand-active` | `#4A4DC5` | Active |
| `brand-foreground` | `#FFFFFF` | 主色实心背景上的文字 |
| `brand-soft` | `#F0F0FF` | 柔和品牌背景 |
| `brand-soft-foreground` | `#5558D8` | 柔和品牌背景上的文字 |
| `brand-border` | `#D9DAFF` | 品牌边框 |
| `brand-subtle` | `#F7F7FF` | 极浅品牌背景 |

### Dark 主题

| Token | 色值 | 用途 |
|---|---|---|
| `brand-primary` | `#A1A3F7` | 主色强调 |
| `brand-hover` | `#B1B3FF` | Hover |
| `brand-active` | `#9294F7` | Active |
| `brand-foreground` | `#020617` | 主色背景上的文字 |
| `brand-soft` | `#25264A` | 柔和品牌背景 |
| `brand-soft-foreground` | `#B1B3FF` | 柔和品牌背景上的文字 |
| `brand-border` | `#45466F` | 品牌边框 |
| `brand-subtle` | `#1B1C38` | 极浅品牌背景 |

以上为设计系统候选色值。除已明确核算的组合外，其余组合必须经过真实背景下的自动对比度测试。

不得仅因为它们属于同一个品牌色阶，就认定全部通过 AA。

## 2.3 品牌色对比度基准

以下组合已核算：

| 前景 | 背景 | 对比度 | 结果 |
|---|---|---:|---|
| `#5558D8` | `#FFFFFF` | 约 5.56:1 | AA 通过 |
| `#5558D8` | `#F0F0FF` | 约 4.93:1 | AA 通过 |
| `#FFFFFF` | `#5558D8` | 约 5.56:1 | AA 通过 |

WorkBuddy 必须重新通过脚本验证最终代码中的实际值。

以下组合必须分别验收：

- Brand Default。
- Brand Hover。
- Brand Active。
- Brand Disabled。
- Brand Soft。
- Brand Soft Foreground。
- Light 主题。
- Dark 主题。
- 链接及其 Hover 状态。
- 导航选中态。
- 按钮文字及按钮背景。

不得使用 Default 状态的对比度结果替代 Hover 或 Active 的验收结果。

## 2.4 文字颜色

### Light

| Token | 色值 | 用途 |
|---|---|---|
| `foreground` | `#0F172A` | 主文字 |
| `foreground-secondary` | `#334155` | 次级文字 |
| `foreground-tertiary` | `#64748B` | 辅助文字 |
| `foreground-disabled` | `#94A3B8` | 禁用文字 |
| `foreground-inverse` | `#FFFFFF` | 反色文字 |
| `foreground-placeholder` | `#64748B` | 输入占位符 |
| `foreground-link` | `#5558D8` | 链接 |

### Dark

| Token | 色值 | 用途 |
|---|---|---|
| `foreground` | `#F8FAFC` | 主文字 |
| `foreground-secondary` | `#CBD5E1` | 次级文字 |
| `foreground-tertiary` | `#94A3B8` | 辅助文字 |
| `foreground-disabled` | `#64748B` | 禁用文字 |
| `foreground-inverse` | `#0F172A` | 反色文字 |
| `foreground-placeholder` | `#94A3B8` | 输入占位符 |
| `foreground-link` | `#A1A3F7` | 链接 |

所有文字颜色必须根据其实际背景验收。

## 2.5 页面表面颜色

### Light

| Token | 色值 | 用途 |
|---|---|---|
| `background` | `#FFFFFF` | 页面底色 |
| `card` | `#FFFFFF` | 卡片表面 |
| `popover` | `#FFFFFF` | 弹窗、下拉表面 |
| `muted` | `#F1F5F9` | 次级背景 |
| `secondary` | `#F8FAFC` | 次级表面 |
| `subtle` | `#FAFBFC` | 极浅表面 |

### Dark

| Token | 色值 | 用途 |
|---|---|---|
| `background` | `#020617` | 页面底色 |
| `card` | `#0F172A` | 卡片表面 |
| `popover` | `#0F172A` | 弹窗、下拉表面 |
| `muted` | `#1E293B` | 次级背景 |
| `secondary` | `#172033` | 次级表面 |
| `subtle` | `#111C30` | 极浅表面 |

层级优先通过表面颜色差异和边框表达。

不得为了制造层次而在所有卡片上添加投影。

## 2.6 边框颜色

### Light

```css
--border: #E2E8F0;
--border-strong: #CBD5E1;
--input-border: #D1D5E5;
```

### Dark

```css
--border: #334155;
--border-strong: #475569;
--input-border: #45465F;
```

边框必须区分：

- 普通分隔线。
- 卡片边界。
- 输入框边界。
- 强调边界。
- 错误边界。
- 选中边界。
- 焦点边界。

用于识别组件边界的必要视觉信息，应满足 WCAG 非文本对比度 3:1 要求。

纯装饰分隔线不应被误认为必须满足同样的组件识别要求，但不能因此降低实际控件边界的可识别性。

## 2.7 语义状态色

状态色必须采用完整语义组合，不能只定义一个颜色。

每种状态至少包含：

```text
{status}
{status}-foreground
{status}-soft
{status}-soft-foreground
{status}-border
```

适用状态：

- success
- warning
- destructive
- info

Token 结构：

```css
--success: ...;
--success-foreground: ...;
--success-soft: ...;
--success-soft-foreground: ...;
--success-border: ...;

--warning: ...;
--warning-foreground: ...;
--warning-soft: ...;
--warning-soft-foreground: ...;
--warning-border: ...;

--destructive: ...;
--destructive-foreground: ...;
--destructive-soft: ...;
--destructive-soft-foreground: ...;
--destructive-border: ...;

--info: ...;
--info-foreground: ...;
--info-soft: ...;
--info-soft-foreground: ...;
--info-border: ...;
```

WorkBuddy 必须根据项目现有状态色核实具体色值。

若没有可靠的现有值，先建立候选色并完成 Light / Dark 对比度验收，不得自行把未经测试的色值标记为正式通过。

状态使用规则：

| 状态 | 使用场景 |
|---|---|
| Success | 操作成功、余额到账、任务完成 |
| Warning | 风险提示、即将过期、需要关注 |
| Destructive | 错误、失败、删除、危险操作 |
| Info | 中性通知、帮助信息、一般说明 |

要求：

1. 状态不能只靠颜色表达。
2. 必须结合图标、文字或标签。
3. 实心背景必须配置适合的前景色。
4. Soft 背景必须配置适合的 Soft Foreground。
5. 边框必须使用对应语义边框 Token。
6. Light 和 Dark 分别验收。
7. 不得通过统一设置 opacity 替代状态色配对。

## 2.8 图表颜色

图表颜色与状态色完全分离。

建立独立的图表色板：

```css
--chart-1: ...;
--chart-2: ...;
--chart-3: ...;
--chart-4: ...;
--chart-5: ...;
--chart-6: ...;
```

要求：

- 图表色不得直接复用 success、warning、destructive 作为常规系列色。
- 多系列必须有足够的视觉区分。
- Light 和 Dark 必须分别测试。
- 不得只通过颜色区分关键数据系列。
- 必须配合图例、标签、线型、点形或其他视觉编码。
- 对色觉障碍用户进行基本可辨识性检查。
- 图表文字、坐标轴、标签、网格线分别定义 Token。
- 图表颜色不能未经验证直接用于普通文本。

## 2.9 Syntax 高亮色

语法高亮必须使用独立 Token：

```css
--syntax-comment: ...;
--syntax-keyword: ...;
--syntax-string: ...;
--syntax-number: ...;
--syntax-function: ...;
--syntax-variable: ...;
--syntax-operator: ...;
--syntax-property: ...;
--syntax-type: ...;
--syntax-punctuation: ...;
```

Light 和 Dark 必须分别维护。

要求：

- 注释、关键字、字符串、数字、函数等语义角色保持一致。
- 不得直接将品牌色用于全部语法角色。
- 必须在真实代码背景上检查可读性。
- 高亮颜色不能仅凭色相差异区分，必要时结合字重等表现。

## 2.10 Terminal 色彩

终端主题独立定义，不与普通 UI 语义色混用。

至少包括：

- Terminal Background。
- Terminal Foreground。
- Terminal Cursor。
- Terminal Selection。
- ANSI 0–7。
- ANSI Bright 8–15。
- Terminal Dim。
- Terminal Error。
- Terminal Warning。
- Terminal Success。

Token 示例：

```css
--term-background: ...;
--term-foreground: ...;
--term-cursor: ...;
--term-selection: ...;
--term-black: ...;
--term-red: ...;
--term-green: ...;
--term-yellow: ...;
--term-blue: ...;
--term-magenta: ...;
--term-cyan: ...;
--term-white: ...;
--term-bright-black: ...;
--term-bright-red: ...;
--term-bright-green: ...;
--term-bright-yellow: ...;
--term-bright-blue: ...;
--term-bright-magenta: ...;
--term-bright-cyan: ...;
--term-bright-white: ...;
```

必须在真实终端背景上测试。

Dim 色不能未经计算直接降低 opacity，也不能任意调整至某个固定透明度。

---

# 3. Page Hierarchy 页面层级

页面必须形成清晰的四级标题层次：

| 层级 | Token | 字号 | 字重 |
|---|---|---:|---:|
| L1 | `page-title` | 30/38 | 600 |
| L2 | `section-title` | 24/32 | 600 |
| L3 | `card-title` | 18/26 | 600 |
| L4 | `group-title` | 16/24 | 600 |

规则：

- 同一级标题在不同页面保持一致。
- 不得跳过层级制造错误的视觉关系。
- 页面标题不得与普通卡片标题使用同样的视觉权重。
- 标题层级不能只依靠颜色区分。
- 内容过多时优先调整信息结构，不得不断缩小字号。

---

# 4. Surface 与 Border 表面和边框

## 4.1 层级原则

页面层级主要通过以下顺序建立：

1. 页面背景。
2. 卡片表面。
3. 次级表面。
4. 1px 边框。
5. 必要时使用投影。

默认不依赖投影表达普通卡片层级。

## 4.2 边框规则

- 普通边框：1px。
- 强调边框：1px。
- 焦点边框：由 Focus Ring Token 控制。
- 交互组件必须有清晰的边界。
- 不得把 Focus Ring 与普通 Border 混为一谈。

## 4.3 边界验收

需要识别的组件边界必须满足 3:1 非文本对比度要求。

验收时比较实际相邻颜色：

- 输入框边界与周围背景。
- 选中控件边界与表面。
- 重要图形与相邻背景。
- 图标状态与相邻背景。

不得只比较 Token 色值而忽略透明度、叠加背景及实际渲染结果。

---

# 5. Radius 圆角系统

基础圆角为 10px。

| Token | 数值 | 用途 |
|---|---:|---|
| `radius-xs` | 6px | 小型标签、微型元素 |
| `radius-sm` | 8px | 小型按钮、紧凑控件 |
| `radius-md` | 10px | 默认按钮、输入框 |
| `radius-lg` | 12px | 卡片、Dialog |
| `radius-xl` | 14px | 图标按钮及特殊控件 |
| `radius-2xl` | 16px | 大型容器 |
| `radius-full` | 9999px | 圆形、胶囊 |

映射：

- Button：默认 10px。
- Input：默认 10px。
- Card：12px。
- Dialog：12px。
- Icon Button：14px。
- Chip：8px 或 Full。
- Avatar：Full。

禁止：

- 随意指定 9px、11px、13px 等新圆角。
- 同一组件不同页面出现不同圆角。
- 通过叠加多个圆角 Token 生成不可控样式。

Tailwind v4 映射必须避免循环引用：

```css
:root {
  --ds-radius-md: 10px;
}

@theme inline {
  --radius-md: var(--ds-radius-md);
}
```

不得写成：

```css
--radius-md: var(--radius-md);
```

---

# 6. Spacing 间距系统

## 6.1 基础网格

基础间距为 4px。

| Token | 数值 |
|---|---:|
| `space-0` | 0px |
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-5` | 20px |
| `space-6` | 24px |
| `space-8` | 32px |
| `space-10` | 40px |
| `space-12` | 48px |
| `space-16` | 64px |
| `space-20` | 80px |

## 6.2 语义间距

必须提供：

```css
--form-field-gap: ...;
--form-section-gap: ...;
--card-padding: ...;
--card-gap: ...;
--page-gutter: ...;
--section-gap: ...;
--table-cell-padding-x: ...;
--table-cell-padding-y: ...;
--dialog-padding: ...;
--navigation-item-gap: ...;
```

组件优先使用语义间距，不得在不同业务页面反复指定任意 padding。

## 6.3 使用规则

- 表单标签与输入框：使用统一表单间距。
- 卡片内部：使用统一卡片 Padding。
- 页面左右留白：使用 Page Gutter。
- 表格单元格：使用 Table Cell Padding。
- 同一层级组件的间距必须一致。
- 不得使用负间距修复本应通过布局结构解决的问题，特殊布局须经批准。

---

# 7. Density 密度系统

提供三种密度：

- Compact：紧凑。
- Default：默认。
- Spacious：宽松。

禁止使用 `xl` 表示密度，因为它容易与响应式断点混淆。

## 7.1 密度参数

下列数值按 Compact / Default / Spacious 顺序：

| 项目 | Compact | Default | Spacious |
|---|---:|---:|---:|
| Table Row 垂直内边距 | 8px | 12px | 14px |
| Table Cell 水平内边距 | 8px | 12px | 14px |
| Control MD | 36px | 40px | 44px |
| Control SM | 32px | 36px | 40px |
| Button MD | 32px | 36px | 40px |
| Button SM | 28px | 32px | 36px |
| Button LG | 36px | 40px | 44px |
| Navigation MD | 28px | 32px | 36px |
| Navigation SM | 24px | 28px | 32px |
| Navigation LG | 40px | 48px | 52px |
| Form Field Gap | 6px | 8px | 10px |
| Card Padding | 16px | 24px | 28px |
| Page Gutter | 16px | 24px | 32px |

## 7.2 密度切换规则

密度只能改变：

- 内外间距。
- 控件高度。
- 表格行间距。
- 导航项目高度。
- 卡片留白。

密度不能改变：

- 字号。
- 字体家族。
- 图标尺寸。
- 圆角。
- 颜色对比度。
- 焦点环。
- 最小触控目标。
- 动效规则。

表格行必须使用 min-height，而不是强制固定高度，避免多行文本被裁切。

---

# 8. Shadow 与 Elevation 投影系统

普通页面层级优先使用表面差异和边框。

投影仅用于需要明确浮起关系的场景，例如：

- Popover。
- Dropdown。
- Dialog。
- 拖动中的元素。
- 特殊悬浮面板。
- 经批准的品牌展示场景。

## 8.1 Light Shadow

```css
--shadow-xs:
  0 1px 2px rgb(15 23 42 / 0.04);

--shadow-sm:
  0 1px 3px rgb(15 23 42 / 0.08),
  0 1px 2px rgb(15 23 42 / 0.04);

--shadow-md:
  0 4px 8px rgb(15 23 42 / 0.08),
  0 2px 4px rgb(15 23 42 / 0.04);

--shadow-lg:
  0 10px 24px rgb(15 23 42 / 0.12);

--shadow-xl:
  0 20px 40px rgb(15 23 42 / 0.16);

--shadow-brand-glow:
  0 0 24px rgb(85 88 216 / 0.18);
```

这里包含五个 Elevation 阴影 Token 和一个独立品牌 Glow Token，不是六档普通阴影。

## 8.2 Dark Shadow

Dark 必须单独定义。

不得直接复制 Light 阴影值。

必须根据 Dark 背景、表面层级和实际显示效果进行测试。

Dark 主题中，投影可能需要结合：

- 表面颜色差异。
- 边框。
- 适当阴影。
- 必要时的局部高亮。

不能仅增加阴影透明度就认定层级正确。

## 8.3 使用限制

- 不得给所有 Card 自动添加 Shadow。
- 不得使用大范围 Glow 代替品牌色。
- 不得使用阴影代替必要边框。
- 不得创建未登记的任意阴影。
- 普通表单、普通表格和常规内容容器优先使用 Border。

---

# 9. Motion 动效系统

## 9.1 Duration Token

| Token | 时长 | 用途 |
|---|---:|---|
| `duration-fast` | 100ms | 轻微反馈 |
| `duration-base` | 200ms | 常规交互 |
| `duration-slow` | 350ms | 复杂过渡 |
| `duration-marketing-fast` | 300ms | 营销动效 |
| `duration-marketing-base` | 500ms | 营销展示 |
| `duration-enter` | 600ms | 特殊进入动画 |
| `duration-shimmer` | 1800ms | 骨架屏 |
| `duration-pulse` | 1500ms | 状态脉冲 |
| `duration-caret` | 1000ms | 光标 |
| `duration-spin` | 800ms | Loading |
| `duration-data-fast` | 250ms | 数据变化 |
| `duration-data-base` | 500ms | 数据过渡 |

## 9.2 Easing Token

```css
--ease-standard: cubic-bezier(0.2, 0, 0, 1);
--ease-enter: cubic-bezier(0, 0, 0.2, 1);
--ease-exit: cubic-bezier(0.4, 0, 1, 1);
```

## 9.3 动效使用规则

| 场景 | 推荐时长 |
|---|---|
| Hover | 100–150ms |
| Button Active | 100ms |
| Tooltip | 100–200ms |
| Dropdown | 150–200ms |
| Dialog | 200–350ms |
| 页面切换 | 200–350ms |
| 数据变化 | 250–500ms |
| 营销展示 | 300–500ms |

要求：

- 优先使用 transform 和 opacity。
- 避免不必要的布局动画。
- 不允许无意义的动画干扰操作。
- Loading 动效必须具有明确状态含义。
- 动画不得阻止用户操作。
- 禁止为普通业务组件添加过度装饰动画。

## 9.4 Reduced Motion

必须支持：

```css
@media (prefers-reduced-motion: reduce) {
  /* 按动画类别进行降级 */
}
```

具体规则：

1. 装饰性动画应停止或显著缩短。
2. 无限循环 Shimmer、Pulse、Caret 等非必要动画应停止或替换。
3. 页面进入和退出动画可以改为即时显示或简单透明度变化。
4. 必要的操作反馈必须保留，例如成功状态、焦点变化、Loading 状态。
5. 不得使用一条全局规则粗暴地关闭所有动画。
6. 不得因 Reduced Motion 导致组件状态无法辨认。

---

# 10. Button 按钮系统

## 10.1 Button Variant

统一六种按钮变体：

| Variant | 用途 |
|---|---|
| Primary | 页面主要操作 |
| Secondary | 次级操作 |
| Outline | 次要边界操作 |
| Destructive | 删除及危险操作 |
| Ghost | 低强调操作 |
| Link | 文本链接操作 |

Disabled 是状态，不是 Variant。

## 10.2 Button 尺寸

| Token | 高度 | 用途 |
|---|---:|---|
| `button-default` | 36px | 默认按钮 |
| `button-sm` | 32px | 紧凑按钮 |
| `button-lg` | 40px | 强调按钮 |
| `button-icon` | 36px | 默认图标按钮 |
| `button-icon-sm` | 32px | 小型图标按钮 |
| `button-icon-xs` | 24px | 极小图标按钮 |
| `button-icon-lg` | 40px | 大型图标按钮 |
| `button-inline` | 20px | 行内文字操作 |
| `button-wrap` | 32px | 包裹式小型操作 |

尺寸必须在组件库中明确实现，不得仅依赖不同页面的 Tailwind class 拼接。

## 10.3 Button 状态

所有适用按钮必须支持：

- Default。
- Hover。
- Active。
- Focus-visible。
- Disabled。
- Loading。
- Pressed / Selected（适用于具有持续选中状态的按钮）。

每个状态必须定义：

- Background。
- Foreground。
- Border。
- Icon。
- Cursor。
- Transition。
- Focus Ring（适用时）。

## 10.4 Primary Button

Light：

- 背景使用 `brand-primary`。
- 文字使用 `brand-foreground`。
- Hover 使用 `brand-hover`。
- Active 使用 `brand-active`。

Dark：

- 背景使用 Dark 品牌色。
- 文字使用 Dark 对应 `brand-foreground`。
- 不得默认使用白色文字。
- 必须逐个验收 Default、Hover、Active。

## 10.5 Disabled

- 禁止只依赖 opacity。
- 禁止出现无法辨认的文字。
- 必须保留明确的禁用状态。
- 禁止状态不能被误认为普通状态。
- 需要说明禁用原因时，应提供帮助文本。

## 10.6 Loading

- Loading 状态必须防止重复提交。
- 保留按钮原有布局，避免文字变化造成明显跳动。
- Loading 图标与文字间距统一。
- 必要时使用 `aria-busy`。
- 操作完成后恢复正确状态。

---

# 11. Control 表单及基础控件

## 11.1 Control 尺寸

| Token | 高度 |
|---|---:|
| `control-sm` | 36px |
| `control-md` | 40px |

Compact / Default / Spacious 模式下的实际高度由 Density Token 控制。

## 11.2 Input

必须具备：

- Default。
- Hover。
- Focus。
- Focus-visible。
- Filled。
- Disabled。
- Readonly。
- Error。
- Success（适用时）。

必须定义：

- 高度。
- Padding。
- 字号。
- 行高。
- Border。
- Background。
- Placeholder。
- Icon。
- Focus Ring。
- Error Message。
- Help Text。

Placeholder 不能代替 Label。

## 11.3 Select

必须具备：

- Default。
- Hover。
- Open。
- Focus-visible。
- Selected。
- Disabled。
- Error。

要求：

- 下拉菜单与触发控件的视觉体系一致。
- 当前选项必须清晰。
- 键盘操作必须完整。
- 弹出层不能被页面容器裁切。
- 选项数量过多时提供搜索或合理的滚动机制。

## 11.4 Textarea

要求：

- 支持多行文本。
- 默认高度根据实际行数确定。
- 可以设置合理的最小高度。
- 不得裁切用户输入。
- 自动扩展必须有上限和合理滚动策略。
- 错误及帮助信息必须可访问。

## 11.5 Checkbox / Radio / Switch

必须定义：

- Default。
- Hover。
- Focus-visible。
- Checked。
- Disabled。
- Error（适用时）。

选中状态不能只靠颜色区分。

必须保留明确的勾选标记、圆点、开关位置或其他视觉反馈。

## 11.6 Form

所有表单必须遵循：

1. Label 与输入控件关联。
2. 必填字段有明确说明。
3. 错误提示与对应字段关联。
4. 错误提示说明具体问题及修复方向。
5. 键盘可以完成操作。
6. Autofill 不得导致文字不可见。
7. Placeholder 不能代替 Label。
8. 输入错误不能只通过红色边框表达。
9. 表单提交状态必须明确。
10. 服务端验证错误必须映射到正确字段。

---

# 12. Icon 图标系统

统一使用 Lucide 图标体系。

## 12.1 尺寸

| Token | 尺寸 | 用途 |
|---|---:|---|
| `icon-xs` | 16px | 密集信息 |
| `icon-sm` | 18px | 次级操作 |
| `icon-md` | 24px | 常规控件 |
| `icon-lg` | 32px | 空状态及强调 |
| `icon-xl` | 48px | 大型空状态 |

默认 Stroke：

```css
stroke-width: 2px;
```

## 12.2 使用规则

- 同一页面统一图标风格。
- 不得混用明显不同风格的图标库。
- 24px 是主要控件图标尺寸。
- 16px 仅适用于密集信息。
- 32px、48px 主要用于空状态或大型提示。
- 图标不能代替文字表达复杂状态。
- 纯图标按钮必须有 Accessible Name。
- 不得将图标视觉尺寸直接视为触控命中区域。

---

# 13. Component 组件规范

所有基础组件必须建立统一实现。

最低组件范围：

- Button。
- IconButton。
- Input。
- Textarea。
- Select。
- Checkbox。
- Radio。
- Switch。
- Label。
- FormField。
- Badge。
- Chip。
- Tooltip。
- Popover。
- Dropdown。
- Dialog。
- AlertDialog。
- Card。
- Table。
- Tabs。
- Breadcrumb。
- Pagination。
- Navigation。
- Sidebar。
- Avatar。
- Skeleton。
- EmptyState。
- Alert。
- Toast。
- Progress。
- Spinner。
- Divider。

每个组件必须定义：

1. 组件用途。
2. 组件属性。
3. 尺寸。
4. 变体。
5. Light 样式。
6. Dark 样式。
7. 所有交互状态。
8. 键盘操作。
9. 无障碍属性。
10. 响应式行为。
11. 使用示例。
12. 对应 Token。

禁止同一个基础组件在不同业务模块重复实现一套不兼容样式。

业务组件可以组合基础组件，但不能绕开基础组件重新定义基础视觉规则。

---

# 14. Navigation 导航系统

## 14.1 导航层级

必须区分：

- Primary Navigation。
- Secondary Navigation。
- Sidebar Navigation。
- Tabs Navigation。
- Breadcrumb。
- Mobile Navigation。

## 14.2 导航高度

基础尺寸：

| Token | 高度 |
|---|---:|
| `nav-sm` | 28px |
| `nav-md` | 32px |
| `nav-lg` | 48px |

实际尺寸由 Density 模式控制。

## 14.3 选中状态

Light：

```css
background: #F0F0FF;
color: #5558D8;
```

该组合约 4.93:1，达到普通文字 AA 对比度要求。

Dark：

```css
background: #25264A;
color: #B1B3FF;
```

必须通过自动对比度测试后才能标记为通过。

## 14.4 状态区分

必须区分：

- Default。
- Hover。
- Active。
- Selected。
- Focus-visible。
- Disabled。

Selected 是持续选中状态，Active 是用户按下时的瞬时状态，两者不得混淆。

选中状态必须结合背景、文字、图标或其他可识别标记，不得只改变文字颜色。

---

# 15. Focus 与 Accessibility 无障碍规范

## 15.1 Focus Ring

默认：

```css
--focus-ring-width: 2px;
--focus-ring-offset: 2px;
```

必须：

- 使用 `:focus-visible`。
- 保证焦点状态清晰。
- 在 Light 和 Dark 中分别验收。
- 不得被父容器裁切。
- 不得被浮层覆盖。
- 不得在无替代方案的情况下删除默认焦点。

焦点指示器建议使用至少 2px 宽度和 2px Offset。

注意：WCAG 2.2 的 Focus Appearance（2.4.13）属于 AAA，不得将其误称为 AA 要求。本规范将其作为更高标准的设计建议。

## 15.2 对比度

按 WCAG 2.2 AA 执行：

| 内容 | 最低对比度 |
|---|---:|
| 普通文字 | 4.5:1 |
| 大号文字 | 3:1 |
| 必要 UI 组件边界 | 3:1 |
| 必要图形对象 | 3:1 |

大号文字指至少 24px 常规字重，或约 18.67px 粗体。

计算时必须考虑：

- 实际背景。
- Alpha 透明度。
- 颜色叠加。
- Hover。
- Active。
- Disabled。
- Light / Dark。
- 最终渲染颜色。

不能仅比较两个 Token 的 HEX 字符串就认定最终页面通过。

## 15.3 Touch Target

WCAG 2.2 AA 的 Target Size Minimum（2.5.8）通常要求目标至少 24 × 24 CSS px，但存在标准规定的例外情况。

Uter 推荐：

- 重要移动端操作：44 × 44px。
- 常规移动端操作：尽可能达到 44 × 44px。
- 小型图标可以保持 16px 或 24px 的视觉尺寸，但必须单独提供足够的交互命中区域。

44px 是 Uter 的设计推荐，不是 WCAG 2.2 AA 的统一最低要求。

## 15.4 其他要求

必须满足：

- 键盘可操作。
- 屏幕阅读器可识别。
- 表单错误可被识别。
- 非文本状态有文字或图标辅助。
- Focus Not Obscured（Minimum）要求。
- WCAG 2.2 AA 适用的拖动操作必须提供不依赖拖动的替代方式。
- 弹窗打开后正确管理焦点。
- 弹窗关闭后焦点返回合理位置。
- Tooltip 不得成为唯一的信息来源。
- 图标按钮必须具有可访问名称。

---

# 16. Responsive 响应式系统

## 16.1 Breakpoints

| Token | 宽度 |
|---|---:|
| `sm` | 640px |
| `md` | 768px |
| `lg` | 1024px |
| `xl` | 1280px |
| `2xl` | 1536px |

所有页面必须在不同宽度下正确工作。

## 16.2 PC Web

- 页面内容不得无限拉伸。
- 主要内容区域必须有合理最大宽度。
- Sidebar 与 Main Content 关系保持稳定。
- 表格必须具有合理的最小宽度或自适应策略。
- 弹窗不得超出可视区域。

## 16.3 H5

- 默认左右 Gutter：16px。
- 页面不能出现非预期横向溢出。
- 卡片必须自适应。
- 桌面 Sidebar 必须转换为适合移动端的导航方式。
- 表格可以横向滚动、转换卡片或隐藏非核心列。
- Dialog 必须适配移动端。
- 表单控件必须易于触控。
- 重要操作建议使用至少 44 × 44px 命中区域。
- 输入文本默认至少 16px。

## 16.4 响应式禁止事项

- 禁止使用固定桌面宽度导致 H5 横向溢出。
- 禁止在移动端简单缩小所有组件。
- 禁止隐藏重要操作而不提供替代入口。
- 禁止缩小字号低于规定值来解决布局问题。
- 禁止在小屏幕中出现无法操作的弹窗。

---

# 17. Token Architecture Token 架构

## 17.1 单一数据源

设计 Token 必须拥有唯一可信来源。

建议目录：

```text
src/
  design-system/
    tokens/
      colors.css
      typography.css
      spacing.css
      radius.css
      density.css
      shadows.css
      motion.css
      icons.css
      components.css
      index.css
    components/
      button/
      input/
      select/
      dialog/
      table/
      navigation/
      ...
    utilities/
    __tests__/
  styles/
    theme.css
```

必须先检查现有仓库目录结构。

如果项目已经有等价架构，应在现有结构上完善，不得为了照搬示例而无意义重建项目。

## 17.2 Token 分层

Token 分为三层：

**Primitive Tokens**

基础值，例如：

```css
--slate-50: ...;
--slate-100: ...;
--slate-200: ...;
--slate-300: ...;
```

**Semantic Tokens**

业务语义：

```css
--background: ...;
--foreground: ...;
--card: ...;
--popover: ...;
--primary: ...;
--border: ...;
```

**Component Tokens**

组件专属值：

```css
--button-height-md: ...;
--button-radius: ...;
--input-height-md: ...;
--dialog-padding: ...;
```

组件优先引用 Semantic Token，而不是直接引用 Primitive Token。

## 17.3 Tailwind CSS v4 映射

必须使用 Tailwind CSS v4 的正确命名空间。

| 类型 | 命名空间 |
|---|---|
| 颜色 | `--color-*` |
| 字体大小 | `--text-*` |
| 字体家族 | `--font-*` |
| 字重 | `--font-weight-*` |
| 行高 | `--leading-*` |
| 间距 | `--spacing-*` |
| 圆角 | `--radius-*` |
| 阴影 | `--shadow-*` |
| 动效曲线 | `--ease-*` |

业务语义源变量使用独立名称，例如：

```css
--brand-primary: #5558D8;
```

再映射到 Tailwind：

```css
@theme inline {
  --color-primary: var(--brand-primary);
}
```

需要运行时主题解析的变量优先使用 `@theme inline`。

禁止：

- 错误使用 `--text-primary` 充当颜色 Token。
- 创建自引用变量。
- 同一个语义重复创建多个别名。
- 在组件中绕过 Token 写入业务颜色。
- 在多个文件重复维护同一组主题色。

## 17.4 主题实现

必须支持 Light 和 Dark。

建议：

```css
:root {
  color-scheme: light;
  /* Light semantic tokens */
}

.dark {
  color-scheme: dark;
  /* Dark semantic tokens */
}
```

具体主题切换机制应与现有项目架构一致。

必须保证：

- 所有必要 Token 都有 Light 值。
- 所有必要 Token 都有 Dark 值。
- 不存在主题缺失。
- 不存在未经批准的跨主题硬编码。
- 页面切换主题后组件状态仍然正确。
- 第三方组件使用统一的主题映射。

---

# 18. Design Showcase 设计系统展示页

必须建立真实的设计系统展示页面。

展示页面不是独立设计稿，而是对真实 Token 和真实组件的可视化核查工具。

## 18.1 数据来源

所有展示数据必须来自实际 Token 源文件或实际组件。

禁止：

- 手动复制一份颜色列表作为展示数据。
- 展示页颜色与实际页面使用颜色不一致。
- 仅通过静态截图冒充组件实现。
- 为了展示而创建不参与真实项目的假 Token。

## 18.2 展示页必须包含 21 个区域

1. 字号十档。
2. Mono 四档。
3. 页面层级四层。
4. 文字色七档。
5. 表面与描边。
6. 品牌色阶。
7. 状态色。
8. 图表分类色。
9. 语法高亮色。
10. Terminal 演示 Token。
11. 圆角七档。
12. 间距。
13. 密度 Token。
14. 五档 Elevation Shadow + 一个 Brand Glow。
15. 动效。
16. Button 九档尺寸。
17. 控件尺寸。
18. 图标五档。
19. 组件示范。
20. 导航选中态。
21. 焦点环与触控目标。

不得遗漏上述任何一个区域。

## 18.3 展示页功能

必须支持：

- Light / Dark 切换。
- 当前 Token 名称。
- 当前实际色值。
- Token 复制。
- 色值复制。
- 对比度显示。
- AA Pass / Fail。
- Button 状态预览。
- Control 尺寸预览。
- Density 切换。
- 圆角预览。
- Shadow 预览。
- 动效预览。
- 图标尺寸预览。
- 组件状态预览。

对比度展示必须来自真实计算，不能手工填写结果。

未通过的组合必须显示 Fail。

未执行测试的组合必须显示 Pending，而不是默认显示 Pass。

## 18.4 展示页验收

展示页必须能够回答：

- 当前项目有哪些 Token？
- 每个 Token 的实际值是什么？
- Light 和 Dark 是否完整？
- 哪些颜色通过 AA？
- 哪些颜色尚未通过？
- 每种按钮有哪些状态？
- 每种控件有哪些尺寸？
- 当前 Density 对组件产生什么影响？
- 组件是否使用真实 Token？

---

# 19. Automated Quality Gate 自动化质量门禁

设计系统必须具备自动化验收能力。

## 19.1 检查项目

### Token 完整性

- 缺失 Token。
- 重复 Token。
- 无引用 Token。
- 循环引用。
- 无效变量。
- Light / Dark 不对称。
- 错误命名。
- 非法别名。

### 颜色

- 未登记颜色。
- 未授权 HEX。
- 未授权 RGB / HSL / OKLCH。
- 文字对比度。
- UI 边界对比度。
- Hover 对比度。
- Active 对比度。
- Disabled 状态。
- Soft 状态。
- Light / Dark 配对。
- 状态色完整性。
- 图表色区分度。
- Syntax 高亮检查。
- Terminal 背景对比度。

### Typography

- 小于 12px 的常规文字。
- 未登记字号。
- 未登记字重。
- 不合理行高。
- 未使用字体 Token。
- Mono 使用错误。
- 关键数字缺少等宽数字设置。

### Layout

- 非标准间距。
- 非标准圆角。
- 非标准阴影。
- 未登记尺寸。
- 密度模式不一致。
- 响应式溢出。

### Components

- Button 状态缺失。
- Input 状态缺失。
- Select 状态缺失。
- Focus Ring 缺失。
- Disabled 状态错误。
- Loading 状态错误。
- 键盘操作缺失。
- Accessible Name 缺失。

### Motion

- Reduced Motion 不符合规范。
- 非必要无限循环动画。
- 过度使用布局动画。
- 不合理的动画时长。

### Showcase

- 展示页数据与真实 Token 不一致。
- Token 缺少展示。
- Light / Dark 演示异常。
- 对比度结果错误。
- 组件展示状态不完整。

## 19.2 推荐脚本

在检查项目现有工具链后，建立或完善：

```bash
node scripts/check-design-tokens.mjs --strict
node scripts/generate-design-showcase.mjs
bunx vitest run src/design-system/__tests__
```

如果项目不是 Bun 环境，应使用项目现有包管理器，不得为了执行这三个示例命令擅自更换项目工具链。

必须提供项目实际可执行的命令。

## 19.3 对比度计算

采用 WCAG 相对亮度计算方式。

每个颜色组合必须记录：

- Foreground。
- Background。
- Contrast Ratio。
- 适用标准。
- Pass / Fail。
- Theme。
- State。

必须计算 Alpha 合成后的最终显示颜色。

不能用未经合成的半透明色直接判断对比度。

## 19.4 质量门禁

以下情况必须阻止设计系统验收：

- 必要 Token 缺失。
- Light / Dark 不完整。
- 普通文字 AA 失败。
- 必要 UI 边界 3:1 失败。
- 按钮状态缺失。
- 焦点状态不可见。
- 关键控件无法键盘操作。
- Reduced Motion 明显失效。
- 重要触控目标不符合标准且没有适用例外。
- 未授权硬编码颜色。
- 设计系统测试失败。
- 展示页与实际 Token 不一致。

不得通过降低阈值、删除失败测试或忽略结果来使质量门禁通过。

---

# 20. Legacy Migration 旧规范迁移

迁移前必须先检查：

- 当前设计 Token。
- Tailwind 配置。
- CSS Variables。
- 全部基础组件。
- 业务页面中的硬编码样式。
- Light / Dark 实现。
- 第三方 UI 组件。
- 现有测试。
- 当前设计系统展示页。

## 20.1 迁移顺序

1. 建立现有样式清单。
2. 标记重复 Token。
3. 标记未使用 Token。
4. 建立统一 Token 源。
5. 建立 Light / Dark 映射。
6. 迁移字体。
7. 迁移文字颜色。
8. 迁移品牌色。
9. 迁移页面背景与边框。
10. 迁移按钮。
11. 迁移输入控件。
12. 迁移导航。
13. 迁移表格。
14. 迁移卡片与 Dialog。
15. 迁移图表、状态色、Syntax 和 Terminal。
16. 删除已确认无引用的旧 Token。
17. 更新展示页。
18. 执行自动化测试。
19. 执行视觉回归。
20. 生成迁移报告。

## 20.2 迁移原则

- 不得一次性删除未核实的旧 Token。
- 不得破坏现有业务逻辑。
- 不得只迁移展示页而不迁移真实业务组件。
- 不得只修改 Light 而遗漏 Dark。
- 不得使用全局覆盖掩盖组件级问题。
- 每个迁移阶段都必须有验证结果。

---

# 21. AI Execution Standard AI 执行标准

本章节是 WorkBuddy 的强制执行规则。

## 21.1 执行前检查

开始修改前必须：

1. 检查仓库目录。
2. 确认前端技术栈。
3. 确认 Tailwind CSS 版本。
4. 找出现有 Token 源文件。
5. 找出全局主题文件。
6. 找出基础组件目录。
7. 找出业务组件。
8. 找出设计系统展示页。
9. 检查现有测试命令。
10. 记录当前代码状态。

不得假设项目结构与本规范中的示例完全相同。

## 21.2 实施要求

必须遵循：

- 所有新增 UI 使用统一 Token。
- 所有基础组件使用统一实现。
- Light / Dark 同步实现。
- 组件状态完整。
- 字体使用统一体系。
- 最小字号 12px。
- PC 正文基准 14px。
- H5 输入文字至少 16px。
- 圆角遵循统一规范。
- 间距遵循 4px 网格。
- Density 仅影响允许的布局属性。
- 图标遵循统一尺寸。
- Focus Ring 不得删除。
- 状态不能只靠颜色表达。
- 不得新增未经批准的品牌色。
- 不得随意使用 Shadow。
- 必须支持 Reduced Motion。
- 必须通过自动化检查。

## 21.3 AI 禁止行为

WorkBuddy 不得：

1. 为了美观自行新增颜色。
2. 为了布局压缩字号。
3. 为了减少代码随意删除 Token。
4. 将未经测试的颜色标记为 AA 通过。
5. 将 Light Token 直接复制到 Dark。
6. 使用透明度替代 Soft 状态 Token。
7. 删除 Hover、Active、Focus 或 Disabled 状态。
8. 用 placeholder 代替 Label。
9. 将图标尺寸当作触控命中区域。
10. 将 44px 错误描述为 WCAG AA 最低标准。
11. 将 Focus Appearance AAA 错误描述为 AA。
12. 将设计展示页与真实 Token 分开维护。
13. 使用硬编码颜色绕开 Token。
14. 修改业务逻辑来规避视觉测试。
15. 在没有证据时声称测试全部通过。

## 21.4 每次修改后的验证

修改完成后必须执行：

- Token 检查。
- 主题完整性检查。
- 颜色对比度检查。
- 组件测试。
- 类型检查。
- Lint。
- 构建。
- 相关页面视觉检查。
- Light / Dark 对照。
- H5 响应式检查。
- Reduced Motion 检查。

某个测试由于环境或依赖原因无法执行时，必须明确标记为 Blocked 或 Not Run，并说明原因。

不得将未执行的测试标记为通过。

## 21.5 修改报告

每次实施完成必须输出：

| 项目 | 内容 |
|---|---|
| 修改文件 | 完整文件路径 |
| 修改内容 | 具体修改内容 |
| 修改原因 | 对应规范章节 |
| Token 变化 | 新增、修改、废弃 |
| 组件影响 | 受影响组件 |
| 测试结果 | 命令及实际结果 |
| 对比度 | 实际测试组合及结果 |
| 视觉检查 | Light / Dark / H5 |
| 未解决问题 | 具体风险 |
| 后续工作 | 剩余事项 |

---

# 22. Final Acceptance Checklist 最终验收清单

以下项目全部必须检查。

## 22.1 基础设计系统

- [ ] 字体体系统一。
- [ ] 十档字号完整。
- [ ] Mono 四档完整（含 `mono-title` 16px，定价卡片模型名必须使用）。
- [ ] 四级标题体系完整。
- [ ] 文字颜色完整。
- [ ] 页面表面 Token 完整。
- [ ] 品牌色阶完整。
- [ ] 状态色配对完整。
- [ ] 图表色独立。
- [ ] Syntax 色独立。
- [ ] Terminal 色独立。
- [ ] 边框 Token 完整。
- [ ] 圆角七档完整。
- [ ] 间距体系完整。
- [ ] Density 三档完整。
- [ ] 五档 Shadow 完整。
- [ ] Brand Glow 独立。
- [ ] 动效 Token 完整。
- [ ] 图标五档完整。

## 22.2 组件

- [ ] Button 六种 Variant。
- [ ] Button 九种尺寸。
- [ ] Button 状态完整。
- [ ] Input 状态完整。
- [ ] Select 状态完整。
- [ ] Textarea 状态完整。
- [ ] Checkbox 状态完整。
- [ ] Radio 状态完整。
- [ ] Switch 状态完整。
- [ ] Dialog 状态完整。
- [ ] Popover 状态完整。
- [ ] Table 密度完整。
- [ ] Navigation 状态完整。
- [ ] Toast 和 Alert 状态完整。
- [ ] Empty State 完整。

## 22.3 无障碍

- [ ] 普通文字对比度符合 AA。
- [ ] 大号文字对比度符合 AA。
- [ ] 必要组件边界对比度符合 AA。
- [ ] 焦点状态清晰。
- [ ] 键盘操作完整。
- [ ] 表单标签关联正确。
- [ ] 错误提示可访问。
- [ ] 图标按钮具有 Accessible Name。
- [ ] 触控目标符合标准或有适用例外。
- [ ] Focus Not Obscured。
- [ ] 拖动操作有替代方式。
- [ ] Reduced Motion 正常。

## 22.4 主题及响应式

- [ ] Light 完整。
- [ ] Dark 完整。
- [ ] 主题切换正常。
- [ ] PC Web 正常。
- [ ] H5 正常。
- [ ] 无意外横向溢出。
- [ ] 表格在小屏幕可用。
- [ ] Dialog 在小屏幕可用。
- [ ] 表单在小屏幕可用。
- [ ] 重要移动端操作易于触控。

## 22.5 工程质量

- [ ] Token 单一数据源。
- [ ] 无重复 Token。
- [ ] 无循环引用。
- [ ] 无未授权硬编码颜色。
- [ ] 无非法字号。
- [ ] 无非法圆角。
- [ ] 无非法间距。
- [ ] 无非法阴影。
- [ ] 展示页读取真实 Token。
- [ ] 对比度计算真实有效。
- [ ] 自动化测试通过。
- [ ] 构建通过。
- [ ] 视觉回归完成。
- [ ] 变更报告完整。

---

# 23. Implementation Order 实施顺序与交付要求

WorkBuddy 必须按以下顺序执行，不得只完成文档或展示页就宣称实施完成。

## Phase 1：现状审计

输出：

- 当前设计系统架构。
- Token 文件清单。
- 组件清单。
- 主题实现情况。
- 硬编码样式清单。
- 当前测试命令。
- 现存问题清单。

## Phase 2：Token 基础设施

完成：

- Primitive Tokens。
- Semantic Tokens。
- Component Tokens。
- Light / Dark。
- Tailwind v4 映射。
- Token 命名规范。
- 自动化 Token 检查。

## Phase 3：基础视觉体系

依次完成：

- Typography。
- Colors。
- Surface。
- Border。
- Radius。
- Spacing。
- Density。
- Shadow。
- Motion。
- Icon。

## Phase 4：基础组件

依次完成：

- Button。
- Input。
- Select。
- Textarea。
- Checkbox。
- Radio。
- Switch。
- Form。
- Badge。
- Card。
- Dialog。
- Popover。
- Table。
- Navigation。
- Toast。
- Empty State。

## Phase 5：业务页面迁移

对所有实际业务页面逐一检查：

- 是否使用统一字体。
- 是否使用统一颜色。
- 是否使用统一间距。
- 是否使用统一圆角。
- 是否使用统一按钮。
- 是否使用统一控件。
- 是否支持 Light / Dark。
- 是否支持 H5。
- 是否存在硬编码样式。
- 是否存在交互状态遗漏。

## Phase 6：展示页

完成全部 21 个展示区域。

所有展示内容必须读取真实 Token 和真实组件。

## Phase 7：自动化验收

执行：

- Token 检查。
- 对比度检查。
- 组件测试。
- 无障碍检查。
- 响应式检查。
- 视觉回归。
- 构建检查。

## Phase 8：最终交付

必须交付：

1. 完整设计 Token 源文件。
2. Light / Dark 主题实现。
3. Tailwind CSS v4 映射。
4. 基础组件实现。
5. 业务页面迁移结果。
6. 设计系统展示页。
7. 自动化检查脚本。
8. 自动化测试。
9. 迁移记录。
10. 最终验收报告。
11. 未完成事项及风险清单。

---

# 24. 最终执行指令

**WorkBuddy：从现在开始，将本文件《UTER Design System 3.0》作为 Uter 项目的唯一、完整、强制性设计实施标准。**

你需要实际检查和修改仓库代码，而不是只提供建议、伪代码或理论方案。

执行时遵守以下要求：

1. 先审计现有代码，不要盲目重建。
2. 保留现有业务功能和数据逻辑。
3. 按本规范建立统一 Token 源。
4. 按本规范迁移所有基础组件。
5. 按本规范迁移所有业务页面。
6. 完整实现 Light / Dark。
7. 完整实现所有交互状态。
8. 建立真实数据驱动的 Design Showcase。
9. 建立自动化检查和质量门禁。
10. 执行全部可运行测试。
11. 修复发现的问题并重新执行相关回归测试。
12. 不得通过降低标准或删除测试使验收通过。
13. 未通过或未执行的项目必须如实记录。
14. 最终提交文件变更清单、测试证据、视觉验收结果和剩余风险。

**验收标准：**

只有当设计 Token、组件、业务页面、Light / Dark、H5、无障碍、展示页和自动化质量门禁全部完成，并且所有必须通过的检查均有实际证据时，才能将 UTER Design System 3.0 标记为实施完成。

本规范中的候选色值必须经过实际对比度验证；未验证项目保持 Pending，不得虚报通过。

任何未来设计变更，都必须先更新本规范或其正式版本，再修改实现。不得通过在业务代码中私自增加样式绕开设计系统。

**本文件是 Uter 唯一设计实施标准。**