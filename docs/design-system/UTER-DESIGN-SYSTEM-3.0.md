# UTER Design System 3.0

## 官方设计系统 · 唯一设计实施标准

**文档级别：** Engineering Standard / Mandatory  
**适用项目：** Uter  
**适用范围：** PC Web、H5、响应式页面及全部业务组件  
**技术基准：** Tailwind CSS v4、CSS Variables、组件化前端架构  
**字体体系：** Inter + 思源黑体（Source Han Sans）  
**品牌主色：** #5B5EE6  
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
7. **规范与实现取值不一致时，按 §17.6 的裁定规则处理**：本规范 §28 `TOKEN-MANIFEST`  
   是设计值的**声明真源**，`web/src/design-system/tokens/` 与 `web/src/styles/theme.css`  
   是**运行真源**，两者由 §28.3 的一致性校验强制同值；规则与边界以本规范为准。  
   不得静默选一边，必须按 §27.4 判断、按 §28.2 收敛。外围文档（`AGENTS.md` / `.uap/` / 代码注释）  
   与本规范冲突时一律以本规范为准。

质量门禁的不可放宽原则以 §19.4 为唯一条款，本节不另立口径。

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
12. 所有视觉展示必须来自 §28 `TOKEN-MANIFEST`，不得使用单独维护的演示数据冒充实际实现（§18.1）。

## 0.3 执行权限与禁止事项

AI 助手可以在授权代码范围内：

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

> **👁 可视核查** → [核查页区域 1 · 字号 11 主档 + 7 配套档](showcase.html#typography)
>
> 每档都渲染了同一句中文「优特智能大模型服务平台」，可以直接看出：  
> ① 30px 与 24px 的层级差是否够明显；② 14px 正文（text-sm）在真实文案下  
> 是否偏小；③ text-base（16px）与正文的区分度 —— 它是行标题档，不是正文。

统一使用以下 **11 个主档**字号（「十档」是 `text-dense` 补入主表之前的过时口径）。**左列是 Tailwind 工具类名，与 §28 `TOKEN-MANIFEST` 声明及  
`typography.css` 的 `@theme` 运行真源逐值对应（§28.3 校验）**；语义角色名（body / caption / label…）  
与类名的对应关系见 §1.3：

| 工具类          |   字号 |   行高 |  字重 | 用途                                    |
| ------------ | ---: | ---: | --: | ------------------------------------- |
| `text-xs`    | 12px | 18px | 400 | caption / small / 辅助说明、最小标签           |
| `text-dense` | 13px | 20px | 400 | 密集表格、日志（与 mono 13 同值、不同字形族）           |
| `text-sm`    | 14px | 22px | 400 | 默认正文 body / body-sm / label           |
| `text-md`    | 15px | 24px | 400 | 次级正文                                  |
| `text-base`  | 16px | 24px | 400 | 行标题 / 设置字段 / 指标数值 —— **不是正文**         |
| `text-lg`    | 18px | 26px | 500 | h3 / 卡片及次级标题（标题场景 600；与 `text-xl` 同值） |
| `text-xl`    | 18px | 26px | 500 | 卡片及次级标题（与 `text-lg` 同值，语义侧重非标题强调）     |
| `text-2xl`   | 20px | 28px | 600 | 小型区块标题                                |
| `text-3xl`   | 24px | 32px | 600 | 区块标题                                  |
| `text-4xl`   | 30px | 38px | 600 | 页面标题                                  |
| `text-5xl`   | 36px | 44px | 600 | 营销展示、特殊大标题                            |

配套档（同在 `@theme` 内，与主档并列；本表与 §28 `TOKEN-MANIFEST` 是同一份值的两个视图，禁止单独改值）：

| 工具类               |   字号 |   行高 |  字重 | 用途                                |
| ----------------- | ---: | ---: | --: | --------------------------------- |
| `text-long`       | 16px | 26px | 400 | body-long 长文本（行高 26 = 1.625 阅读节奏） |
| `text-group`      | 16px | 24px | 600 | group-title 分组标题                  |
| `text-mono-xs`    | 12px | 18px | 400 | mono 小型 ID、标签                     |
| `text-mono`       | 13px | 20px | 400 | mono 正文等宽、表格、日志（规范名 mono-sm）      |
| `text-mono-code`  | 13px | 20px | 400 | 固定高度等宽代码容器                        |
| `text-mono-base`  | 14px | 22px | 400 | mono-base 代码、技术信息                 |
| `text-mono-title` | 16px | 22px | 600 | mono-title 等宽卡片标题（定价卡片模型名）        |

**命名陷阱（必须记住）**：Tailwind 类名 ≠ 语义字号。`text-sm` 是 14px 正文，  
`text-base` 是 16px 行标题、**不是**正文；写正文用 `text-sm`，写长文本用  
`text-long`（16/26），不要拿 `text-base` 当正文。`text-lg` 是 18px 的 h3 /  
卡片标题档，不是 16px。旧文档里「`text-base` = 14px 正文」的说法一律作废。

> **字重列读法**：表中「字重」是工具类的**默认字重**，语义角色可覆盖 —— `label`  
> 是 14/22/**500**，`card-title` 是 18/26/**600**。§1.8 Markdown 表列的是  
> 「默认字重 + `font-semibold` 标题覆盖」后的最终值，两处不矛盾。

禁止：

- 使用小于 12px 的常规 UI 文本。
- 随意使用 11px、13.5px、17px 等非标准字号。
- 使用浏览器默认字号作为组件最终标准。
- 将 13px 密集文本用于长篇正文。
- 通过缩小字号解决页面布局问题。

**兼容与上限（沿用 1.x 口径）**：阶梯到 `text-5xl`（36px）为止。**48px 以上不纳入  
系统** —— 营销页主视觉同样使用 `display` 档（36 / 600 / 44），需要更大字号时按  
§26.5 的例外流程登记，而不是随手写 `text-[3rem]`。字号值的**唯一声明源**是  
§28 `TOKEN-MANIFEST.typography`，`web/src/design-system/tokens/typography.css`  
是**运行真源**（§17.1 / §28.1，T1 + §28.3 双重守卫）。

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
- `body-sm` 不得成为新的独立字号角色：它与 `body` **同为 14/22/400**，只是语义不同。
- `label` = **14/22/500**（`text-sm` + `font-medium`），用于按钮文字、表单标签、导航项。
- `body-medium` 可以作为同字号、不同字重的语义变体。
- 行高必须与字号角色配套。
- 本规范**不设独立的 `leading-*` 档位**：行高随字号档位成对给出（见 §1.2 与 §28  
  `typography`）。特殊内容确需覆盖时按 §26.5 登记，不得随意写 `leading-*`。
- 同一层级标题必须使用一致的字号和字重。

**16/600（`text-base` + `font-semibold`）作为标题时只能当 `group-title`**，即卡片内部的分组标题。不得用它当页面标题、区块标题或卡片标题 —— 那三档分别是 30/600、24/600、18/600。

下列三类**不是标题**，不受本条约束，各自的档位另有规定：

| 场景                              | 规定                       | 出处                |
| ------------------------------- | ------------------------ | ----------------- |
| 设置页字段标签（`field` 档）              | 16/600                   | `form-label-tier` |
| 数值展示（价格、倍率、用量，配 `tabular-nums`） | 16/600 可用，须配等宽数字         | §1.6              |
| Markdown 正文标题                   | 自成一套，见 §1.8（原 E14，编号已注销） | §1.8              |

**列表行标题用 16/500**：名称与说明成对出现的列表行（账号绑定、登录设备、渠道列表），标题用 `text-base font-medium`，不用 600。600 与 500 在 16px 上视觉差异很小，但语义上 600 是「标题」，500 是「行内强调」，混用会让层级失效。

**语义标签与视觉档位必须同时正确**：分组标题除了字重字号对，还必须由 `<Heading variant='group-title'>` 输出，不得用 `<p>` / `<div>` / `<span>` 拼出同样的视觉。视觉对但语义错，会让读屏用户拿不到标题大纲。

**`caption`（12px）的适用边界**：

- 允许：单行、≤20 字、不承载数值的纯标签（时间戳、单位名、「可选」这类状态词）。
- 不允许：说明性句子、价格/配额/用量等数值、表单字段的帮助文字、弹窗内的解释段落。
- 上述不允许的场景一律用 `text-sm`（14px）。**判据是「这句话需不需要被读」** —— 需要被读就用 14px，只是标记就用 12px。

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
- 700 仅作为字重 Token 保留（§1.4）；**3.0 的 UI 不使用 700**，标题一律 600。确需 700 须按 §26.5 登记例外。
- 不允许使用伪粗体作为默认设计策略。

## 1.5 Mono 字号

> **👁 可视核查** → [核查页区域 2 · Mono 四档](showcase.html#mono)
>
> 重点确认 13px text-mono-code 与 14px text-mono-base 并排时是否显得  
> 「降级」—— 这是 13px 只给固定高度代码容器用的原因。

四档（2026-11-03 拍定：在 mono-xs/sm/base 三档基础上新增 `mono-title` 标题档）：

| Token        |       字号 |   行高 | 字重  | 用途                   |
| ------------ | -------: | ---: | --- | -------------------- |
| `mono-xs`    |     12px | 18px | 400 | 小型 ID、标签             |
| `mono-sm`    |     13px | 20px | 400 | 表格、日志                |
| `mono-base`  |     14px | 22px | 400 | 代码、技术信息              |
| `mono-title` | **16px** | 22px | 600 | 用等宽字形的卡片标题（定价页卡片模型名） |

`mono-title` 与正文标题档的关系：等宽字形在同等视觉重量下比 Inter 小一档，  
故卡片标题取 16px（而非 18px）+ 600 字重，行高随之收紧为 22px。定价页  
模型卡片的模型名 Heading 必须使用 `mono-title`（16px）。  
无障碍预设（simple-large）下 mono 系各档随预设整体放大，不视为违规。

API Key、请求 ID、模型名称、Token 数量和代码标识必须使用 Mono 字体体系。

类名对应：见 §28 `typography.mono[].class`（唯一声明），本表不再重复数值映射。  
`text-mono-code` 是固定高度等宽代码容器的派生档，取值见 §28 `typography.companions`。

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

## 1.8 内容排版（Markdown prose）

AI 回答、模型输出、文档正文是**内容排版**，不是界面层级。它们的标题自成一套，  
比界面标题低一到两档 —— 把 Markdown 的 `h1` 抬到界面的 30px，会让回答里的标题  
比它所在卡片的标题（18px）还大，页面层级当场塌掉。

| Markdown | 工具类（实现值）    | 字号 / 行高 | 字重                          |
| -------- | ----------- | ------: | --------------------------- |
| `h1`     | `text-2xl`  | 20 / 28 | 600                         |
| `h2`     | `text-lg`   | 18 / 26 | 600                         |
| `h3`     | `text-base` | 16 / 24 | 600                         |
| `h4`     | `text-sm`   | 14 / 22 | 600                         |
| `h5`     | `text-sm`   | 14 / 22 | 600（tertiary 色）             |
| `h6`     | `text-xs`   | 12 / 18 | 600 + uppercase（tertiary 色） |

> 上表「字重」列是**标题覆盖后的最终值**（工具类默认字重 + `font-semibold`），  
> 工具类默认字重见 §1.2 / §28，两列口径不同但不矛盾。

正文用 `body-long`（`text-long` 16/26），行内代码 `mono-sm`（`text-mono` 13/20），  
围栏代码块 `mono-sm`（13/20，随正文滚动）。实现位置两处：

- `web/src/components/ai-elements/response-renderer-blocks.tsx` 的 `headingClasses`  
  （AI 回答、模型输出）；
- `web/src/components/ui/markdown.tsx` 的 `[&_h1]`…`[&_h4]` 后代选择器  
  （`RichContent` 的 markdown 分支、协议正文）。

文档正文同一套，只是文档的一级标题按界面 `page-title`（30/38/600）渲染，正文从  
Markdown 的 `h2` 开始，所以页面上看到的是 **30 → 18 → 16**；卡片标题  
（`Uter-card` 里的 `h3`）不算正文，仍按界面 `card-title` 18/26。

**只对 Markdown 渲染的内容生效。** `Heading` / `CardTitle` / `DialogTitle` 等界面  
标题不得借用这条 —— 界面层级永远是 §1.3 定义的四层。本条是 E14 升格后的正式  
条款；E14 编号已按 §26.4 注销，引用时一律回指本节 §1.8。

## 1.9 无障碍大字档（Simple Large-font 预设）

`[data-theme-preset='simple-large']` 是用户主动开启的「超大字体简易」预设。它是  
**同一套阶梯的放大档**，不是第二套字号体系：档位名称、用途、相对顺序完全一致，  
只有取值按 ~1.35× 放大，行高同比放大以维持原阶梯的阅读节奏。

关键约束：**它声明在 `design-system/tokens/typography.css`，不是 `theme-presets.css`。**  
规范要求「字号、行高、字重、字体」由 Typography 统一管理，主题只管颜色、密度只管  
间距。把这段覆盖写进主题预设，等于让字号阶梯有了第二个来源 —— 改基准值对这个  
预设无效，改这个预设也不影响其他预设。两个来源合一后，T1（`--text-*` 只能出现在  
`typography.css`）不再需要例外。

声明在 `@theme` 之外：这些是**运行时按 data 属性切换**的覆盖值，不是主题变量注册；  
放在 `@theme` 里会被 Tailwind 当成默认值再生成一遍工具类。Mono 系各档随预设整体  
放大，不视为违规（§1.5）。需要放大文字的用户走这个预设，**不得**用密度档缩放  
`--text-*`（§7.2）。

## 1.10 多行主标题的行高

`display` 档（`text-5xl` 36/44）的单行行高是 44px。这个比例在单行时是对的，但中文  
营销主标题常折成 3–4 行，会显得行与行挤在一起。因此给多行场景单独一档：

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

1. **无单位比例而不是像素。** 响应式下移动端 30px × 1.5 = 45px、桌面  
   36px × 1.5 = 54px，行高跟着字号走，不会出现「字号变小、行高还是 44px」的倒挂。
2. **规则放在 `@layer components` 之外。** 调用方要保留 Tailwind 的响应式字号  
   （`text-3xl md:text-4xl`），只覆盖行高；放在 components 层会被 utilities 层的  
   `line-height` 覆盖，等于没写。这是全站唯一一处刻意的层外规则，仅此一例。


## 1.11 移动端全屏菜单

移动端全屏菜单（`web/src/components/layout/components/public-header.tsx` 的 overlay）  
的一级项是**触屏列表**，用 16/24（`text-base font-medium`），比桌面一级  
导航的 14/22（`text-sm`）大一档：触屏点按面积与可读性都要求更大。桌面导航仍是  
`label` 14/500。

判据是**输入方式**，不是屏幕宽度：鼠标点的用 14，手指点的用 16。本条是 E8 升格后的正式条款；E8 编号已按 §26.4 注销，引用时回指本节 §1.11。

## 1.12 长文本阅读宽度

`body-long`（16/26）用于连续阅读内容时，容器宽度要收在可读区间，否则 16px 长文在  
1280px 里一行 60+ 字，眼睛回行会错行：

| 内容             | 最大宽度                             |
| -------------- | -------------------------------- |
| 文章正文、服务协议、隐私政策 | `max-w-[72ch]`（约 720–760px）      |
| 帮助中心列表 + 正文    | 正文列 `max-w-[72ch]`，侧栏固定 240px    |
| AI 对话气泡        | `max-w-[84%]`，单气泡内仍用 `body-long` |

## 1.13 设置页「名称 + 说明」三层

系统设置页（`web/src/features/system-settings/**` 及同类列表型结构）是**列表型**  
页面：每一行都是「名称 + 说明」成对出现。这类结构里名称必须明显高于说明，否则整页  
读起来就是「一堆同号小字」。

| 层    | 档位                           | 字号 / 行高 / 字重  | 用途                                                                              |
| ---- | ---------------------------- | ------------- | ------------------------------------------------------------------------------- |
| 容器标题 | `container-title`（`text-lg`） | 18 / 26 / 600 | 带边框的分组容器（「聊天区域」「管理区域」），等同卡片标题；**不得叫 `group`**，以免与 L4 `group-title`（16/24/600）撞名 |
| 字段标签 | `field`                      | 16 / 24 / 600 | 字段标题、开关行标题（「Client Secret」「主域名」）                                                |
| 说明文字 | `body-sm`                    | 14 / 22 / 400 | `FormDescription`、手写 `<p>`、`AlertDescription`                                   |

机器可读的值（URL / 域名 / 端点 / 密钥 / 邮箱 / Client ID / Slug / 路径）用等宽  
`text-mono`（13 / 20）；人读的名称（站点名、发送者姓名）不用等宽。

实现方式是**上下文声明**，不是逐个调用点加类名：

```tsx
// 整页声明一次，全页 FormLabel 自动继承 field 档
<FormLabelTierProvider tier='field'>…</FormLabelTierProvider>
// 分组容器自己升一档，内部再由 SettingsControlChildren 降回 field
<SettingsControlGroup>…</SettingsControlGroup>
```

`SettingsPage` 已经声明了 `field` 档，新增设置字段不需要任何额外类名。违例：在  
`FormLabel` 上硬写 `text-sm font-normal` 会把标签压回 14px、与说明同号同重，这种覆盖  
必须删掉。`AlertTitle` 也跟随该上下文：设置页里的「设置引导」是 16/600，普通页面仍是  
原来的 14/500 加粗。

## 1.14 管理端控件与说明文字下限

「12px 只给真 caption」最容易破防的地方是**控件文字**与**说明性正文**：`text-xs` 是  
合法类名，T1–T7 都不会报它，于是密集的技术弹窗里按钮、下拉、输入框一个接一个退回  
12px，整页比个人资料页小一号。

因此管理端（`web/src/features/` 下的 channels / dashboard / keys / models /  
organization / redemption-codes / subscriptions / system-info / system-settings /  
task-plugins / usage-logs / users / wallet）执行两条下限：

| 位置                                                                                        | 下限                               | 依据               |
| ----------------------------------------------------------------------------------------- | -------------------------------- | ---------------- |
| 控件文字（`Button` / `SelectTrigger` / `Input` / `Textarea` / `ToggleGroupItem` / 小写 `button`） | 14px（`label` 14 / 500）           | 「按钮文字」就是 label 档 |
| 说明性正文（`<p>`）、`AlertDescription`、`FormDescription`、`dt`                                    | 14px（`body-sm` 14 / 400 / 22）    | 说明文字是正文，不是徽标     |
| 表格单元格与分页（`ui/table.tsx` / `data-table/core/pagination.tsx`）                               | 13px（`text-dense` 13 / 400 / 20） | 密集数据专用档，扫读优先     |
| 表格表头（`ui/table.tsx` 的 `th`）                                                               | 12px（500 / 18）                   | 列名是标识不是正文        |

配套细节：

- 紧凑按钮不再手写 `h-7 text-xs`，用 14px 文字时高度给到 `h-7`（28px）以上；  
  `h-6`（24px）装不下 14 / 22 的行高。**小按钮（`Button size="sm"`）v1.2 起为  
  12 / 500 / 18** —— 由 `button.tsx` 统一下发，调用处不得再覆盖。**这是「控件文字  
  14px 下限」的唯一实现侧例外**：下限约束调用处，不约束组件内部已定档的  
  `size="sm"`；守卫测试第 1 条按此白名单豁免 `button.tsx`。
- 等宽代码块用 `text-mono`（13 / 20）或 `text-mono-code`（13 / 20），不要写 `text-xs`。
- 以下场景**仍然是 12px**：Badge（计数、分类标签、折扣角标）/ `AvatarFallback`、  
  表格列名（uppercase）、时间戳、单元格次级信息、日历格子。
- **`StatusBadge` 是例外，固定 14px（`body-sm`）**：它承载运行时状态文字（渠道状态、  
  任务结果），要和同一行的表格正文同档阅读，12px 会显得像脚注。

守卫测试：`web/src/design-system/__tests__/control-typography.test.ts`，三条：

1. **控件下限**：扫描上述 13 个管理端目录，任何控件标签或 `<p>` 上出现 `text-xs`  
   直接判失败，并在失败信息里给出文件:行号。
2. **分组标题下限**：扫描 13 个管理端目录 + `security` + `profile`，`h3`/`h4`/`h5`  
   上出现 `text-sm` / `text-xs` 判失败。`uppercase` 的 eyebrow 与 `font-mono`  
   的标识符标题不计入。
3. **设置页标签档位**：扫描 `features/system-settings`，`FormLabel` / `Label` 上  
   硬写 `text-sm` / `text-xs` / `font-normal` 判失败。

前台页面（营销页、定价页）不在扫描范围内，需要时按同一标准单独处理。

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

> **👁 可视核查** → [核查页区域 6 · 品牌色阶](showcase.html#brand)
>
> 重点看 hover / active 两档是否**肉眼可区分**。若在 1440px 屏幕上分不出来，  
> 说明加深幅度需要调整。色值声明见 §28 `colors.brand`；  
> `brand.tokens.json` / 生成的 `brand.css` 是运行真源（§28.3 校验同值）。

Uter 品牌主色采用紫蓝色。

### Light 主题

| Token                   | 色值        | 用途                                                      |
| ----------------------- | --------- | ------------------------------------------------------- |
| `brand-primary`         | `#5B5EE6` | 主按钮、品牌链接、重要强调                                           |
| `brand-hover`           | `#4F52D1` | Hover                                                   |
| `brand-active`          | `#4A4DC5` | Active                                                  |
| `brand-foreground`      | `#FFFFFF` | 主色实心背景上的文字                                              |
| `brand-soft`            | `#F0F0FF` | 柔和品牌背景                                                  |
| `brand-soft-foreground` | `#5558D8` | 柔和品牌背景上的文字                                              |
| `brand-border`          | `#D9DAFF` | 品牌边框                                                    |
| `brand-subtle`          | `#FAFBFC` | 极浅品牌背景（与 `brand.tokens.json` / 生成 `brand.css` 一致，§17.6） |

### Dark 主题

| Token                   | 色值        | 用途                                                      |
| ----------------------- | --------- | ------------------------------------------------------- |
| `brand-primary`         | `#A1A3F7` | 主色强调                                                    |
| `brand-hover`           | `#B1B3FF` | Hover                                                   |
| `brand-active`          | `#9294F7` | Active                                                  |
| `brand-foreground`      | `#020617` | 主色背景上的文字                                                |
| `brand-soft`            | `#25264A` | 柔和品牌背景                                                  |
| `brand-soft-foreground` | `#B1B3FF` | 柔和品牌背景上的文字                                              |
| `brand-border`          | `#45466F` | 品牌边框                                                    |
| `brand-subtle`          | `#0F172A` | 极浅品牌背景（与 `brand.tokens.json` / 生成 `brand.css` 一致，§17.6） |

以上色值已登记在 `web/src/design-system/source/brand.tokens.json`（生成产物  
`tokens/generated/brand.css`）。除已明确核算的组合外，其余组合必须经过真实背景下的  
自动对比度测试。

不得仅因为它们属于同一个品牌色阶，就认定全部通过 AA。

## 2.3 品牌色对比度基准

以下组合已核算（实测口径见 §19.3；「约」表示按 sRGB 公式计算的四舍五入值）：

| 前景        | 背景        |      对比度 | 结果    |
| --------- | --------- | -------: | ----- |
| `#5B5EE6` | `#FFFFFF` | 约 5.01:1 | AA 通过 |
| `#5558D8` | `#F0F0FF` | 约 4.93:1 | AA 通过 |
| `#FFFFFF` | `#5B5EE6` | 约 5.01:1 | AA 通过 |

色值改动后必须按 §28.2 先改 `TOKEN-MANIFEST.colors.brand`、再同步运行真源，  
并重新通过脚本验证最终代码中的实际值（§28.3 / §19.3）。

以下组合必须分别验收：

- Brand Default。
- Brand Hover。
- Brand Active。
- Brand Disabled（不单独定义品牌色 Token；按 §2.4 `foreground-disabled` + 组件 `disabled:` 变体验收）。
- Brand Soft。
- Brand Soft Foreground。
- Light 主题。
- Dark 主题。
- 链接及其 Hover 状态。
- 导航选中态。
- 按钮文字及按钮背景。

不得使用 Default 状态的对比度结果替代 Hover 或 Active 的验收结果。  
链接及 Hover、导航选中态、按钮文字及按钮背景这三类组合的实测值由 §19.1 门禁按  
真实背景计算，展示在 §18.2 第 4 / 6 / 20 区，不在本表手写结果。

## 2.4 文字颜色

> **👁 可视核查** → [核查页区域 4 · 文字色七档](showcase.html#text-colors)
>
> 色卡里每档都渲染了真实文字（「优特 Ag」）。重点看 tertiary 与 disabled 两档在  
> 正文旁边的实际区分度 —— 这是最容易在实际页面里用错的两档。

### Light

| Token                    | 色值        | 用途    |
| ------------------------ | --------- | ----- |
| `foreground`             | `#0F172A` | 主文字   |
| `foreground-secondary`   | `#334155` | 次级文字  |
| `foreground-tertiary`    | `#64748B` | 辅助文字  |
| `foreground-disabled`    | `#94A3B8` | 禁用文字  |
| `foreground-inverse`     | `#FFFFFF` | 反色文字  |
| `foreground-placeholder` | `#64748B` | 输入占位符 |
| `foreground-link`        | `#5558D8` | 链接    |

### Dark

| Token                    | 色值        | 用途    |
| ------------------------ | --------- | ----- |
| `foreground`             | `#F8FAFC` | 主文字   |
| `foreground-secondary`   | `#CBD5E1` | 次级文字  |
| `foreground-tertiary`    | `#94A3B8` | 辅助文字  |
| `foreground-disabled`    | `#64748B` | 禁用文字  |
| `foreground-inverse`     | `#0F172A` | 反色文字  |
| `foreground-placeholder` | `#94A3B8` | 输入占位符 |
| `foreground-link`        | `#A1A3F7` | 链接    |

所有文字颜色必须根据其实际背景验收。

### 三级文字（`foreground-tertiary`）的允许清单

三级文字是**辅助层级**，不是「弱化一切」的万能工具。允许使用的场景只有：

| 场景          | 示例                                                 |
| ----------- | -------------------------------------------------- |
| 页脚法规行       | 备案号、许可证号                                           |
| 版权行         | `© 2026 Uter.ai`                                   |
| 搜索框图标与清除按钮  | 定价页搜索栏（已登记）                                        |
| 分页省略号       | `…` 分隔标记                                           |
| 营销首屏的补充微文案  | 首页首屏「支持的应用」下方那两行 ≤14px 说明（有意压到比副标题更浅一档，避免小字抢正文注意力） |
| 图表内的连接/装饰图标 | 流程图的 `ChevronRight` 连接符                            |

禁止：

- 用它做**禁用态**文字。禁用态走 `--ds-color-text-disabled`（`disabled:` 变体），那是「不可用」，三级色是「次要但可用」，两者语义不同，混用会让用户以为控件可点。
- 用它做**正文、说明、标签**。那些用 `--ds-color-text-secondary`（`text-muted-foreground`）。
- 因为它「看起来更淡」而用来降视觉重量 —— 需要降重量就改字号或字重。

> **命名映射**（§28 `colors.text.aliases`）：`--ds-color-text-primary` ≡ `foreground`；  
> `--ds-color-text-secondary` ≡ `foreground-secondary` / `--muted-foreground` /  
> `text-muted-foreground`；`--ds-color-text-disabled` ≡ `foreground-disabled`；  
> `--ds-color-text-on-emphasis` ≡ `text-primary-foreground` ≡ `brand-foreground`  
> (`#FFFFFF`)。文档用语义名、代码用 `--ds-color-*` / `--fg-*`，是同一组值的两个视图。

## 2.5 页面表面颜色

> **👁 可视核查** → [核查页区域 5 · 表面与描边](showcase.html#surfaces)
>
> 层级优先通过表面差异和 1px 边框表达；普通卡片默认不加投影（§4.1 / §8.3）。

### Light

| Token        | 色值        | 用途      |
| ------------ | --------- | ------- |
| `background` | `#FFFFFF` | 页面底色    |
| `card`       | `#FFFFFF` | 卡片表面    |
| `popover`    | `#FFFFFF` | 弹窗、下拉表面 |
| `muted`      | `#F1F5F9` | 次级背景    |
| `secondary`  | `#F1F5F9` | 次级表面    |
| `subtle`     | `#FAFBFC` | 极浅表面    |

### Dark

| Token        | 色值        | 用途      |
| ------------ | --------- | ------- |
| `background` | `#020617` | 页面底色    |
| `card`       | `#020617` | 卡片表面    |
| `popover`    | `#020617` | 弹窗、下拉表面 |
| `muted`      | `#1E293B` | 次级背景    |
| `secondary`  | `#1E293B` | 次级表面    |
| `subtle`     | `#111C30` | 极浅表面    |

层级优先通过表面颜色差异和边框表达。

> **沿革与同值校验（2026-11-13）**：旧文档把 Light `secondary` 写成 `#F8FAFC`、  
> Dark `card` / `popover` 写成 `#0F172A`、Dark `secondary` 写成 `#172033`，  
> 与运行真源不符，本轮收敛到上表（§28 `colors.surface` 同值）。  
> 本表是 §28 的**人类可读投影**，不得单独改值；若需要表面差异，须按 §28.2  
> 先改 `TOKEN-MANIFEST.colors.surface`，再同步 `theme.css` 与本表，  
> 并由 §28.3 校验两层真源逐值相等（§17.6）。  
> 注意 Dark 下 `card` / `popover` 与 `background` 同为 `#020617`，层级由 1px  
> 边框与 Dark 投影表达（§4 / §8.2）；这是实现现状，已如实登记。

不得为了制造层次而在所有卡片上添加投影。

### 特殊表面：遮罩层与纯白表面

有两个表面**不跟随主题**，因此各自单独定义 Token，而不是复用一个会变的语义色：

| Token                        | Light     | Dark      | 用途                          |
| ---------------------------- | --------- | --------- | --------------------------- |
| `--ds-color-surface-overlay` | `#000000` | `#000000` | 弹窗 / 抽屉 / 移动端全屏菜单背后的遮罩层     |
| `--ds-color-surface-pure`    | `#FFFFFF` | `#FFFFFF` | 二维码底、滑块手柄这类必须在两种主题下都保持纯白的表面 |

规则：

- 遮罩层恒为黑。遮罩的作用是「把后面压下去」，如果跟着主题变浅，深色模式下就等于没有遮罩。浓淡由调用方的透明度修饰表达（`bg-surface-overlay/10`、`/50`），不拆成两个 Token。
- 纯白表面恒为白。二维码是给摄像头读的，压成 `--card` 的暖白会掉对比度；滑块手柄靠白与轨道色区分，跟着主题变深就看不见了。
- 除这两类之外，**组件里不得再出现 `bg-white` / `bg-black` / `text-white` 的字面写法**。饱和填充上的白字用 `text-primary-foreground` 或 `--ds-color-text-on-emphasis`。
- SVG 内部的描边（如主题色选择器色块上的对勾 `stroke-white`）与营销终端的装饰色不受本条约束 —— 它们不是界面表面。

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

> **👁 可视核查** → [核查页区域 7 · 状态色](showcase.html#status)
>
> 成功 / 警告 / 危险 / 信息四族状态色在明暗两套主题下的实际观感与对比度。

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

Light（`:root`，完整声明见 §28 `colors.status.light`）：

```css
--success: #16a34a;              --success-foreground: #f8fafc;
--success-soft: oklch(0.979 0.021 166);
--success-soft-foreground: oklch(0.391 0.094 167);
--warning: oklch(0.681 0.162 75.834);   --warning-foreground: oklch(0.145 0 0);
--warning-soft: oklch(0.985 0.02 80);
--warning-soft-foreground: oklch(0.414 0.112 78);
--destructive: #dc2626;          --destructive-foreground: #f8fafc;
--destructive-soft: oklch(0.971 0.013 17);
--destructive-soft-foreground: oklch(0.441 0.119 27);
--info: oklch(0.588 0.158 241.966);     --info-foreground: oklch(0.985 0 0);
--info-soft: oklch(0.97 0.019 235);
--info-soft-foreground: oklch(0.379 0.146 265);
```


Dark（`.dark`）：四组主色及其 `foreground` / `soft` / `soft-foreground`  
共 16 个值**全部逐值声明在 §28 `colors.status.dark`**，本表不重复抄写；  
四组主色为 success `#22c55e`、warning `oklch(0.769 0.188 70.08)`、  
destructive `#7f1d1d`、info `oklch(0.613 0.14 239.919)`。

`-border` 三族由 `color-mix(in oklch, var(--status) 32~40%, var(--background))`  
派生；`--destructive-border` 由 `--border-destructive-subtle`（`#fecaca`）承担。  
**不得**把 Light 值直接复制到 Dark（§0.3）。

以上取值来自 `styles/theme.css` 的实际声明，由 §28.3 校验强制同值。候选色必须先完成  
Light / Dark 对比度验收，不得自行把未经测试的色值标记为正式通过。

状态使用规则：

| 状态          | 使用场景           |
| ----------- | -------------- |
| Success     | 操作成功、余额到账、任务完成 |
| Warning     | 风险提示、即将过期、需要关注 |
| Destructive | 错误、失败、删除、危险操作  |
| Info        | 中性通知、帮助信息、一般说明 |

要求：

1. 状态不能只靠颜色表达。
2. 必须结合图标、文字或标签。
3. 实心背景必须配置适合的前景色。
4. Soft 背景必须配置适合的 Soft Foreground。
5. 边框必须使用对应语义边框 Token。
6. Light 和 Dark 分别验收。
7. 不得通过统一设置 opacity 替代状态色配对。

## 2.8 图表颜色

> **👁 可视核查** → [核查页区域 8 · 图表分类色](showcase.html#chart)
>
> chart-1…6 六个分类色槽位在深浅主题下的可辨性；分类色不得带成败含义（§2.8）。

图表颜色与状态色完全分离。

建立独立的图表色板：

Light（`:root`）／Dark（`.dark`），完整声明见 §28 `colors.chart`：

```css
/* Light */                          /* Dark */
--chart-1: oklch(0.72 0.18 250);    --chart-1: oklch(0.76 0.14 250);
--chart-2: oklch(0.65 0.15 200);    --chart-2: oklch(0.76 0.13 200);
--chart-3: oklch(0.7 0.12 280);     --chart-3: oklch(0.76 0.13 285);
--chart-4: oklch(0.68 0.19 325);    --chart-4: oklch(0.75 0.16 325);
--chart-5: oklch(0.68 0.16 155);    --chart-5: oklch(0.76 0.14 155);
--chart-6: oklch(0.7 0.15 30);      --chart-6: oklch(0.75 0.13 30);
```

要求：

- 图表色不得直接复用 success、warning、destructive 作为常规系列色。
- 多系列必须有足够的视觉区分。
- Light 和 Dark 必须分别测试。
- 不得只通过颜色区分关键数据系列。
- 必须配合图例、标签、线型、点形或其他视觉编码。
- 对色觉障碍用户进行基本可辨识性检查。
- 图表文字、坐标轴、标签、网格线应分别定义 Token；当前实现只落地六个分类色，  
  这四类尚未定义，按 §28 `colors.chart.auxiliary` / §28.6 登记为 **Pending**  
  （退出条件 = 图表组件确实需要独立文字 / 轴 / 网格语义色）。落地前沿用 §2.4  
  文字色与 §2.6 边框色，不得编造色值。
- 图表颜色不能未经验证直接用于普通文本。

**`chart-N` 用于分类徽标与图标底色的边界**（本条曾与门禁注释互相矛盾，现统一）：

- **允许**：`bg-chart-1..6` 作为**分类**标识的底色 —— 状态徽标的分类态（如「试用」「已归档」「待复核」这类非成败语义）、图标徽标的 tone、`lib/colors.ts` 的分类色板。这些场景需要 5 种以上可区分的色相，而语义状态色只有 success / warning / destructive / info 四组，用语义色硬凑会造出「用成功色表示中性状态」的假语义。
- **不允许**：用 `chart-N` 表达成功 / 失败 / 警告 / 危险。那四类必须走 `--success` / `--destructive` / `--warning` / `--info` 及其 `-soft` 变体。
- **不允许**：把 `chart-N` 当页面表面、卡片底、区块分隔线这类大面积背景。
- 判据：**这个颜色在解释「数据系列」或「分类身份」，还是在解释「状态好坏」？** 前者用 `chart-N`，后者用语义状态色。

## 2.9 Syntax 高亮色

> **👁 可视核查** → [核查页区域 9 · 语法高亮色](showcase.html#syntax)
>
> 代码高亮色板在明暗两套主题下的实际渲染。

语法高亮必须使用独立 Token：

当前实现只定义 5 个语法角色（完整声明见 §28 `colors.syntax`）：

```css
/* Light */                              /* Dark */
--syntax-keyword: oklch(0.496 0.265 301.9);  --syntax-keyword: oklch(0.827 0.119 306.4);
--syntax-string:  oklch(0.448 0.119 151.3);  --syntax-string:  oklch(0.871 0.15 154.4);
--syntax-number:  oklch(0.47 0.157 37.3);    --syntax-number:  oklch(0.837 0.128 66.3);
--syntax-function:oklch(0.488 0.243 264.4);  --syntax-function:oklch(0.809 0.105 251.8);
--syntax-property:oklch(0.437 0.078 188.2);  --syntax-property:oklch(0.855 0.138 181.1);
```

`comment` / `variable` / `operator` / `type` / `punctuation` 五个语义角色由  
`foreground-*` 语义色承担，**不另立 Token** —— 早期版本把它们写成 `...` 占位符，  
既没有值也没有实现，本轮按实际代码补齐口径。

Light 和 Dark 必须分别维护。

要求：

- 注释、关键字、字符串、数字、函数等语义角色保持一致。
- 不得直接将品牌色用于全部语法角色。
- 必须在真实代码背景上检查可读性。
- 高亮颜色不能仅凭色相差异区分，必要时结合字重等表现。

## 2.10 Terminal 色彩

> **👁 可视核查** → [核查页区域 10 · Terminal 演示 Token](showcase.html#terminal)
>
> Terminal ANSI palette 与首屏演示卡的 term-* 语义 Token（§17.5）。

终端主题独立定义，不与普通 UI 语义色混用。

**已落地**（完整声明见 §28 `colors.terminal`）：

- Terminal Background / Command / Flag / Property / String / Number / Online。
- Terminal Dim（`--term-dim-1…4`，值见 §28 `colors.terminal.dimValues`）。
- Terminal Error / Warning / Success（由 `--term-accent-*` 四族 + §2.7 状态语义色承担）。

**Pending**（§26 台账 B 类 / §28.6，退出条件 = 终端组件确实需要完整 ANSI 色板）：

- Terminal Foreground / Cursor / Selection。
- ANSI 0–7 / ANSI Bright 8–15 全色板。

以上两组分别对应「目标清单」与「当前实现」，**不得把目标清单当成已实现清单**。

当前实现登记的是**首屏演示卡所需的 term-* 语义组**（完整声明见 §28 `colors.terminal`）：

```css
--term-background: #000000;   --term-command: #047857;  --term-flag: #2563eb;
--term-property: #0369a1;    --term-string: #b45309;   --term-number: #7c3aed;
--term-dim-1: color-mix(in srgb, var(--foreground) 75%, var(--card));
--term-dim-2…4: color-mix(in srgb, var(--foreground) 55%, var(--card));
--term-accent-{emerald,amber,blue,violet}: 四族强调色及 -line / -soft 派生档;
--term-online: #10b981;      --term-dot: color-mix(in srgb, var(--foreground) 15%, transparent);
```

Dark 六档另有独立取值（`--term-command: #34d399` 等），见 §28。  
**ANSI 0–7 / Bright 8–15 全色板尚未落地**，早期版本把它写成「至少包括」并列出  
20 个 `...` 占位符，属未兑现的承诺；本轮如实登记为 **Pending**（§26 台账：B 类，  
退出条件 = 终端组件确实需要完整 ANSI 色板），不得标记为已实现。

必须在真实终端背景上测试。

Dim 色不能未经计算直接降低 opacity，也不能任意调整至某个固定透明度。

## 2.11 图表排版

VChart 把文字画在 `<canvas>` 上，`fontSize` 必须是**数字**，既写不了 `text-xs` 也  
读不到 CSS 变量。于是字号在 TS 侧**镜像**一份，其**运行真源**是  
`web/src/design-system/tokens/chart-typography.ts`（值仍以 §28 `typography`  
为唯一声明，只允许出现阶梯内档位）：

| 常量                           |    值 | 用途          |
| ---------------------------- | ---: | ----------- |
| `CHART_FONT_SIZE`            | 12px | 轴标签、图例、数据标签 |
| `CHART_LABEL_FONT_SIZE`      | 12px | 柱顶数值、节点文字   |
| `CHART_AXIS_TITLE_FONT_SIZE` | 12px | 轴标题         |

三条约束：

1. 图表只能 import 这三个常量，**不得在 option 里写字面量** —— T4 拦 `fontSize: N`；
2. 这里只允许出现 §1.2 阶梯内的档位。要新档位按 §27.1 / §28.2  
   先改 §28 `typography.mainScale`，再同步 `typography.css` 与这里；
3. 图表的**颜色**同理：canvas 拿不到 `var(--primary)`，用  
   `color-mix(in oklch, …)` + `useThemeColors` 在运行时解析，不要写死色值。  
   `chart-N` 只用于**分类**标识，不得表达成功 / 失败（§2.8）。

本条是 E4 升格后的正式条款；E4 编号已按 §26.4 注销，引用时回指本节 §2.11。

---

# 3. Page Hierarchy 页面层级

> **👁 可视核查** → [核查页区域 3 · 页面层级四层](showcase.html#hierarchy)
>
> L1 页面标题 → L2 区块标题 → L3 卡片标题 → L4 分组标题，同级标题跨页面保持  
> 一致；层级不能只靠颜色区分，不得跳级制造错误的视觉关系。

页面必须形成清晰的四级标题层次：

| 层级 | Token           |    字号 |  字重 |
| -- | --------------- | ----: | --: |
| L1 | `page-title`    | 30/38 | 600 |
| L2 | `section-title` | 24/32 | 600 |
| L3 | `card-title`    | 18/26 | 600 |
| L4 | `group-title`   | 16/24 | 600 |

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

> **👁 可视核查** → [核查页区域 11 · 圆角九档](showcase.html#radius)
>
> 每个档位都画了实心方块，看实际弧度 —— 10px（控件）与 12px（卡片/弹窗）的  
> 差别在真实页面里是否需要同时存在。

基础圆角为 10px。

| Token         |     数值 | 用途                                       |
| ------------- | -----: | ---------------------------------------- |
| `radius-xs`   |    6px | 小型标签、微型元素                                |
| `radius-sm`   |    8px | 小型按钮、紧凑控件                                |
| `radius-md`   |   10px | 默认按钮、输入框                                 |
| `radius-lg`   |   12px | 卡片、Dialog                                |
| `radius-xl`   |   14px | 特殊控件（图标按钮按 §10.2 终版口径走 `radius-lg` 12px） |
| `radius-2xl`  |   16px | 大型容器                                     |
| `radius-3xl`  |   18px | 超大容器                                     |
| `radius-4xl`  |   20px | 全幅面板                                     |
| `radius-full` | 9999px | 圆形、胶囊                                    |

共 **9 档**（系数 xs×0.6 → 4xl×2，基准 10px；`radius-full` 为特殊档）。  
`primitives.css` 与 `semantic.css` 早已声明 18px / 20px 两档，旧文档只登记到  
16px 并自称「七档」，属文档滞后；本表与 §28 `radius.scale` 为同一份值。

映射：

- Button：默认 10px（`radius-md`）。
- Input：默认 10px（`radius-md`）。
- Card：12px（`radius-lg`）。
- Dialog：12px（`radius-lg`）。
- Icon Button：12px（`radius-lg`，与卡片同档 —— 2026-11-03 终版口径，§10.2）。
- Chip：8px 或 Full。
- Avatar：Full。

禁止：

- 随意指定 9px、11px、13px 等新圆角。
- 同一组件不同页面出现不同圆角。
- 通过叠加多个圆角 Token 生成不可控样式。
- **使用任意值语法 `rounded-[...]`**。需要圆角就从上面档位里挑最接近的：想写 `rounded-[0.6rem]`（9.6px）说明本来要的就是 10px，用 `radius-md` / `rounded-md`。

唯一例外：**tooltip 箭头的尖端微圆**（独立 Token `radius-tooltip-tip` = 4px）。箭头是一个旋转 45° 的小方块，用容器档位会露出直角或让箭身变胖，因此允许它单独取值，但必须在代码里写明理由。**不得复用 `rounded-xs`** —— 该档在 §5 表里是 6px，旧文档把 4px 例外挂在同名档上，造成同一档两个值。

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

> **👁 可视核查** → [核查页区域 12 · 间距](showcase.html#spacing)
>
> 4px 网格与语义间距档的实际留白观感。

## 6.1 基础网格

基础间距为 4px。

| Token       |   数值 |
| ----------- | ---: |
| `space-0`   |  0px |
| `space-0.5` |  2px |
| `space-1`   |  4px |
| `space-1.5` |  6px |
| `space-2`   |  8px |
| `space-2.5` | 10px |
| `space-3`   | 12px |
| `space-4`   | 16px |
| `space-5`   | 20px |
| `space-6`   | 24px |
| `space-8`   | 32px |
| `space-10`  | 40px |
| `space-12`  | 48px |
| `space-16`  | 64px |
| `space-20`  | 80px |

三个半档 `0.5`（2px）/ `1.5`（6px）/ `2.5`（10px）完整声明于 §28  
`spacing.scale`，已存在于 `tokens/primitives.css`；其用法见 §6.3  
（该节明列 0.5 / 1.5 两档的典型场景，2.5 档同属本表的标准档位）。

## 6.2 语义间距

语义间距**不另立第二套数值**：已落地的五项直接是 §7.1 / §28  
`density.params` 同名参数的语义别名，下表是只读投影（唯一声明见 §28  
`spacing.semantic`）：

| 语义名                      | 对应 `density.params` 键 | Default 值 |
| ------------------------ | --------------------- | --------: |
| `--form-field-gap`       | `formFieldGap`        |       8px |
| `--card-padding`         | `cardPadding`         |      24px |
| `--page-gutter`          | `pageGutter`          |      24px |
| `--table-cell-padding-x` | `tableCellPaddingX`   |      12px |
| `--table-cell-padding-y` | `tableRowPaddingY`    |      12px |

其余五个语义名（`--form-section-gap` / `--card-gap` / `--section-gap` /  
`--dialog-padding` / `--navigation-item-gap`）**当前未落地**，在 §28  
`spacing.semantic.pending` 如实登记：落地前不得给它们编造数值，也不得在组件里  
写死任意 padding —— 统一用 §6.1 的 4px 网格档（`space-*`）表达。

组件优先使用语义间距，不得在不同业务页面反复指定任意 padding。

## 6.3 使用规则

- 表单标签与输入框：使用统一表单间距。
- 卡片内部：使用统一卡片 Padding。
- 页面左右留白：使用 Page Gutter。
- 表格单元格：使用 Table Cell Padding。
- 同一层级组件的间距必须一致。
- 不得使用负间距修复本应通过布局结构解决的问题，特殊布局须经批准。
- **不得使用任意值语法 `p-[3px]` / `py-[2px]` / `gap-[2px]`**。间距阶梯就是 Tailwind 的 4px 单位，`p-[3px]` 与 `p-1`（4px）差 1px，肉眼不可见，但会让密度档切换失效、让全站间距失去可枚举性。需要 2px 用 `0.5` 档（`py-0.5`、`gap-0.5`），需要 6px 用 `1.5` 档，其余就近取整档。

---

# 7. Density 密度系统

> **👁 可视核查** → [核查页区域 13 · 密度 Token](showcase.html#density)
>
> 用核查页顶部的「密度 sm / xl」按钮切换，直接观察「密度只改留白、不改字号」  
> 是否成立（§7.2）。

提供三种密度：

- Compact：紧凑。
- Default：默认。
- Spacious：宽松。

对外一律使用 **Compact / Default / Spacious** 三个语义名。实现层沿用

|                                                            |      |                                    |
| ---------------------------------------------------------- | ---- | ---------------------------------- |
| \`[data-theme-scale='sm'                                   | 'lg' | 'xl']`（见 `tokens/spacing.css\`，映射见 |
| §28 `density.implAttrs`）：`sm/lg/xl` **只是属性取值**，不得在业务组件里用它们 |      |                                    |
| 指代密度语义，也不得把 `xl` 当成 §16.1 的 1280px 断点别名。§7.1 表头与           |      |                                    |
| 核查页按钮文案一律用语义名。                                             |      |                                    |

## 7.1 密度参数

下列数值按 Compact / Default / Spacious 顺序：

| 项目               | Compact | Default | Spacious |
| ---------------- | ------: | ------: | -------: |
| Table Row 垂直内边距  |     8px |    12px |     14px |
| Table Cell 水平内边距 |     8px |    12px |     14px |
| Control MD       |    36px |    40px |     44px |
| Control SM       |    32px |    36px |     40px |
| Button MD        |    32px |    36px |     40px |
| Button SM        |    28px |    32px |     36px |
| Button LG        |    36px |    40px |     44px |
| Navigation MD    |    28px |    32px |     36px |
| Navigation SM    |    24px |    28px |     32px |
| Navigation LG    |    40px |    48px |     52px |
| Form Field Gap   |     6px |     8px |     10px |
| Card Padding     |    16px |    24px |     28px |
| Page Gutter      |    16px |    24px |     32px |


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

> **👁 可视核查** → [核查页区域 14 · 五档 Elevation Shadow + Brand Glow](showcase.html#shadow)
>
> 五档投影只给浮层使用（§8.3）；普通卡片默认不加投影。

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

Dark 投影取值（`tokens/elevation.css` 的 `.dark` 覆盖，完整声明见 §28 `shadow.dark`）：

| Token                      | Dark 值                               | 用途             |
| -------------------------- | ------------------------------------ | -------------- |
| `--ds-elevation-popover`   | `0 1px 2px 0 rgb(0 0 0 / 0.6)`       | 下拉 / 气泡 / 悬浮提示 |
| `--ds-elevation-overlay`   | `0 8px 24px -8px rgb(0 0 0 / 0.8)`   | 弹窗 / 抽屉 / 浮层   |
| `--ds-elevation-raised`    | `0 12px 24px -12px rgb(0 0 0 / 0.8)` | 拖拽中的瞬时浮起       |
| `--ds-elevation-marketing` | `0 20px 60px -25px rgb(0 0 0 / 0.7)` | 营销展示卡片         |

三层共同生效：更深的阴影 + 表面色差异 + 边框。早前本节只写「必须单独定义」却没有  
给出任何值，导致 §17.4「不存在主题缺失」与 §19.1「Light / Dark 不对称」无值可查；  
本轮补齐，并由 §28.3 校验与代码同值。

## 8.3 使用限制

- 不得给所有 Card 自动添加 Shadow。
- 不得使用大范围 Glow 代替品牌色。
- 不得使用阴影代替必要边框。
- 不得创建未登记的任意阴影。
- 普通表单、普通表格和常规内容容器优先使用 Border。

---

# 9. Motion 动效系统

> **👁 可视核查** → [核查页区域 15 · 动效](showcase.html#motion)
>
> duration / easing Token 的实际节奏；裸 transition-* 默认值见 §9.5。

## 9.1 Duration Token

| Token                        |      时长 | 用途                        |
| ---------------------------- | ------: | ------------------------- |
| `--ds-motion-fast`           |   100ms | 轻微反馈                      |
| `--ds-motion-base`           |   200ms | 常规交互                      |
| `--ds-motion-slow`           |   350ms | 复杂过渡（Dialog / Sheet 整块进出） |
| `--ds-motion-marketing-fast` |   300ms | 营销动效                      |
| `--ds-motion-marketing-base` |   500ms | 营销展示                      |
| `--ds-motion-enter`          |   600ms | 特殊进入动画                    |
| `--ds-motion-loop-shimmer`   |  1800ms | 骨架屏                       |
| `--ds-motion-loop-pulse`     |  1500ms | 状态脉冲                      |
| `--ds-motion-loop-caret`     |  1000ms | 光标                        |
| `--ds-motion-loop-spin`      |   800ms | Loading                   |
| `--ds-motion-loop-marquee`   | 20000ms | 滚动字幕                      |
| `--ds-motion-loop-border`    |  3200ms | 流动边框                      |
| `--ds-motion-data-fast`      |   250ms | 数据变化                      |
| `--ds-motion-data`           |   500ms | 数据过渡                      |

## 9.2 Easing Token

```css
/* 后台交互的标准曲线：两端对称，不抢戏。全站默认。 */
--ds-motion-ease: cubic-bezier(0.4, 0, 0.2, 1);
/* 营销面的整块位移（巨型菜单、首屏进入）：略缓一档。 */
--ds-motion-ease-marketing: cubic-bezier(0.16, 1, 0.3, 1);
/* 小控件的快速响应（开关、标签增删）。 */
--ds-motion-ease-snappy: cubic-bezier(0.22, 1, 0.36, 1);
```

三档曲线的分工是**按场景**而不是按手感：后台交互一律 `--ds-motion-ease`，营销面整块位移用 `--ds-motion-ease-marketing`，小控件状态切换用 `--ds-motion-ease-snappy`。

禁止：

- 裸写 `ease-in` / `ease-out` / `ease-in-out` / `linear` 作为交互过渡的缓动（`linear` 只允许用于无限循环的位移，如 marquee）。
- 自定义第四档贝塞尔曲线。
- 在同一个组件里混用两档曲线。

## 9.3 动效使用规则

| 场景            | 推荐时长      |
| ------------- | --------- |
| Hover         | 100–150ms |
| Button Active | 100ms     |
| Tooltip       | 100–200ms |
| Dropdown      | 150–200ms |
| Dialog        | 200–350ms |
| 页面切换          | 200–350ms |
| 数据变化          | 250–500ms |
| 营销展示          | 300–500ms |

要求：

- 优先使用 transform 和 opacity。
- 避免不必要的布局动画。
- 不允许无意义的动画干扰操作。
- Loading 动效必须具有明确状态含义。
- 动画不得阻止用户操作。
- 禁止为普通业务组件添加过度装饰动画。
- **不得裸写 `duration-150` / `duration-300` / `duration-[0.35s]`**。后台交互只用 `ds-motion-fast`（100ms）/ `ds-motion-base`（200ms）两档；`ds-motion-slow`（350ms）只给 Dialog、Sheet 这类整块进出；营销面用 `ds-motion-marketing-fast` / `ds-motion-marketing-base`。
- **营销面动画是唯一允许用 300/500ms 的地方**，且必须显式引用 `ds-motion-marketing-*` Token，不得写成裸值 —— 这样营销例外就是可枚举的，而不是散落各处的魔法数字。

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

## 9.5 裸 `transition-*` 的默认值也是这个集合的一部分

`transition-colors` / `transition-transform` / `transition-all` **不写时长**时，  
Tailwind 读 `--default-transition-duration`（内置 **150ms**）与  
`--default-transition-timing-function`。150ms 不在 §9.1 的时长集合里 —— 也就是说  
全站裸 `transition-*` 一直在用集合外的时长，而门禁只检查**显式写出**的  
`duration-*`，看不见它们。

所以这两个默认值在 `design-system/tokens/elevation.css` 里被指到集合内：

```css
@theme {
  --default-transition-duration: var(--ds-motion-fast);
  --default-transition-timing-function: var(--ds-motion-ease);
}
```

含义：**裸 `transition-*` = 交互反馈最快一档**。要更慢就显式写 §9.1 登记的  
`ds-motion-*` Token。这条必须写在 `@theme` 里 —— 写进 `:root` 时 Tailwind 读不到，  
工具类仍旧是 150ms（与字号阶梯同一个坑）。

**唯一的例外是 `animate-in` / `animate-out` 上的 `duration-*`**：tw-animate 用它设的是  
`animation-duration`（进入 / 退出动画），和 `transition-duration` 是两个轴。这类写法  
必须和 `animate-in` / `animate-out` 出现在同一行，T11 按此放行。

---

# 10. Button 按钮系统

> **👁 可视核查** → [核查页区域 16 · Button 九档尺寸 + 六变体](showcase.html#button)
>
> 九档尺寸 + 六种变体并排展示，可直接判断高度差是否够用、圆角是否合理  
> （普通 10px / 图标 12px，§10.2）。切换密度按钮，观察高度是否跟随 Token 收缩。

## 10.1 Button Variant

统一六种按钮变体：

| Variant     | 用途      |
| ----------- | ------- |
| Primary     | 页面主要操作  |
| Secondary   | 次级操作    |
| Outline     | 次要边界操作  |
| Destructive | 删除及危险操作 |
| Ghost       | 低强调操作   |
| Link        | 文本链接操作  |

Disabled 是状态，不是 Variant。

## 10.2 Button 尺寸

本表是 §7.1「密度 Default 列」与 §28 `components.button.sizes` 的**投影**，  
禁止单独改值。

| Token            |                高度 | 圆角                 | 用途                           |
| ---------------- | ----------------: | ------------------ | ---------------------------- |
| `button-default` |              36px | `--radius-md` 10px | 常规操作（默认）                     |
| `button-sm`      |              32px | `--radius-md` 10px | 表格行内、密集工具栏                   |
| `button-lg`      |              40px | `--radius-md` 10px | 页面级主操作                       |
| `button-icon`    |              36px | `--radius-lg` 12px | 图标按钮（默认）                     |
| `button-icon-sm` |              32px | `--radius-lg` 12px | 工具栏图标按钮                      |
| `button-icon-xs` |              24px | `--radius-lg` 12px | 极紧凑位（头像触发器等），**等于触控下限，不得再小** |
| `button-icon-lg` |              40px | `--radius-lg` 12px | 强调型图标按钮                      |
| `button-inline`  |       文本行盒（≈20px） | `rounded-none`     | 嵌在文字流里的链接式入口（「查看详情」「重试」）     |
| `button-wrap`    | 内容高度，`min-h` 32px | `--radius-md` 10px | 标签会折行的按钮（长中文名、版本说明）          |

尺寸必须在组件库中明确实现，不得仅依赖不同页面的 Tailwind class 拼接。

**圆角口径（2026-11-03 终版）**：普通按钮 = 默认控件档 `--radius-md` **10px**，  
图标按钮 = 卡片档 `--radius-lg` **12px**，与 §5 圆角档位表一致，两处取值不得分叉。  
`icon-xs` 是唯一不受密度 Token 驱动的固定档：24px 已经是 WCAG 2.2 AA 的触控下限  
（§15.3），再跟随密度收缩就会破线。

### `inline`：链接式文字按钮

`variant='link'` + `size='inline'`。高度退回文本行盒、左右内边距归零。

为什么需要单独一档：`variant='link'` 无填充、无描边、无内边距，视觉上就是一段带色  
的文字。给它套 32px 的盒子会在行内排版里制造 12px 空白，还会与相邻的 `<a>` 文字  
对不齐 —— 高度在这里不是「按钮尺寸」，而是「文字行高」。

**只有 `variant='link'` 可以配这一档**：有填充或描边的按钮必须有高度。表格单元格里的  
零内边距触发（`px-0 py-0` 的 ghost 按钮）也可以用，但要显式加 `min-h-8` 兜住点按面积。

### `wrap`：内容型按钮

标签会折成 2–3 行时用。高度随内容、允许折行，`min-h` 兜住点按地板。

`min-h` **只有三档**，按场景选，不要在调用点自造第四档：

| min-h            | 场景                 |
| ---------------- | ------------------ |
| 24px（`min-h-6`）  | 表格单元格 / 徽标密度里的行内触发 |
| 32px（默认）         | 工具栏、弹窗、卡片内的可折行按钮   |
| 44px（`min-h-11`） | 触屏列表里的整行按钮         |

卡片式选项按钮（金额档位、支付方式、分组选择）是**卡片**而不是按钮：它塞了三行信息  
（名称、单价、折扣），高度随内容，用 `h-auto min-h-14 rounded-lg p-3` 的卡片结构，  
不要硬套 `size` 档。

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

### Loading 态必须用 `loading` 属性

```tsx
<Button loading>Saving…</Button>
```

`Button` 的 `loading` prop 承担四件事，调用方不得自己拼：

1. **保留原文字**。spinner 只作为前置图标**追加**，不替换 `children`，所以按钮宽度不塌缩。
2. 自动 `disabled`。
3. 自动 `aria-busy="true"`。
4. spinner 带 `aria-hidden`，保证按钮的可访问名称始终是「保存」而不是「Loading 保存」。

禁止：

- 用 `<Button disabled><Spinner /> 保存</Button>` 手拼加载态 —— 会漏掉 `aria-busy`，且不同人写的 spinner 尺寸不一致。
- 把文字换成 spinner（`{loading ? <Spinner /> : '保存'}`）—— 宽度跳变会让工具栏抖动。
- 用 `isLoading` / `pending` 之类的自定义 prop 再造一套。

存量手写 spinner 允许保留，但**新增与改动的代码必须走 `loading`**；迁移时优先处理「替换文字」写法，因为那是会改变布局的那一类。

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

> **👁 可视核查** → [核查页区域 17 · 控件尺寸](showcase.html#control)
>
> Input / Select / Switch 等控件的真实高度与状态。

## 11.1 Control 尺寸

本表是 §7.1「密度 Default 列」与 §28 `components.control.sizes` 的**投影**，  
禁止单独改值。

| Token        |   高度 |
| ------------ | ---: |
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

> **👁 可视核查** → [核查页区域 18 · 图标五档](showcase.html#icon)
>
> 五档图标按真实像素渲染，可确认 18px 默认档与 16px 紧凑档是否需要并存。

统一使用 Lucide 图标体系。

## 12.1 尺寸

| Token     |   尺寸 | 用途                                         |
| --------- | ---: | ------------------------------------------ |
| `icon-xs` | 16px | 紧凑型辅助图标（仅密集信息）                             |
| `icon-sm` | 18px | **全站默认档**：按钮 / 工具栏 / 侧边栏 / 主导航 / Tabs / 状态 |
| `icon-md` | 24px | 强调型功能入口                                    |
| `icon-lg` | 32px | 空状态                                        |
| `icon-xl` | 48px | 整页级空状态                                     |

默认 Stroke：

```css
stroke-width: 2px;
```

**18px 是当前默认档**（详见 §12.3）。这个值历史上被反复改过，每次都是整表重排  
而非局部修补；改之前先 `stat` 规范文件 mtime —— 照着旧口径改代码会白改一轮。  
§12.1 的标题句与尺寸表矛盾时**以表为准**。

## 12.2 使用规则

- 同一页面统一图标风格。
- 不得混用明显不同风格的图标库。
- **18px 是全站默认档**，由 `IconProvider` 注入；24px 只给强调型功能入口。
- 16px 仅适用于密集信息。
- 32px、48px 主要用于空状态或大型提示。
- 图标不能代替文字表达复杂状态。
- 纯图标按钮必须有 Accessible Name。
- 不得将图标视觉尺寸直接视为触控命中区域。


## 12.3 图标线宽、尺寸档与容器约束

**统一 Lucide 线性图标，描边统一 2**；尺寸按场景固定为 **16 / 18 / 24 / 32 / 48**  
五档，**默认档 18px**；**颜色跟随父级文字色**。

### 三个数值怎么落地

| 规范值               | 实现                                                      | 说明                                                           |
| ----------------- | ------------------------------------------------------- | ------------------------------------------------------------ |
| 24px 画框           | `viewBox="0 0 24 24"`                                   | Lucide 内置，不改                                                 |
| 描边 2              | `strokeWidth={2}`                                       | 单位是**画框单位**；16px ≈ 1.33px、18px = 1.5px、24px = 2px、48px = 4px |
| 尺寸 16/18/24/32/48 | `size-4` / `size-4.5` / `size-6` / `size-8` / `size-12` | 渲染尺寸就是字形尺寸（`size-4.5` = 18px）                                |

描边 Token 三档取值相同，都是 2：

| Token                             |   值 | 用途           |
| --------------------------------- | --: | ------------ |
| `--ds-icon-stroke-width-sm`       | `2` | 16px 的紧凑辅助图标 |
| `--ds-icon-stroke-width`          | `2` | 全站默认         |
| `--ds-icon-stroke-width-emphasis` | `2` | 32px 的强调型图标  |

保留三档是为了让「紧凑 / 默认 / 强调」的语义落点稳定 —— **不是**要造出三种粗细。

全站由 `web/src/context/icon-provider.tsx` 统一注入 `size={18} strokeWidth={2}`。  
**调用点不要写 `strokeWidth`**；写了也必须是 2。

> **线宽绝不写进 CSS。** CSS 声明会盖掉调用点通过 Lucide context 传下来的  
> `strokeWidth`，让「调用点可覆盖语义」失效。这是全站唯一的线宽来源约束，  
> 违反它会让图标几何守卫与真实渲染脱节。

**尺寸必须落在 16 / 18 / 24 / 32 / 48 这五档上**（容器约束型 12 / 14 除外）。  
档位外的值（20、22、28、36、40…）一律违规。

### 容器约束：12 / 14px 字形的唯一合法来源

尺寸表的最小档是 16px，但**容器放不下时以容器为准**。判据不是「想画小一点」，而是  
「16px 会不会顶破容器」：16px 方框里塞 16px 字形，对勾会压到边框上；24px 徽章里  
塞 16px，上下各剩 4px，视觉上反而更挤。

| 容器               |      字形 | 位置                                                       |
| ---------------- | ------: | -------------------------------------------------------- |
| 16px 复选框方框       |    12px | `ui/checkbox.tsx`                                        |
| 24px 徽章          |    12px | `ui/badge.tsx`                                           |
| 头像 24/32/40px 三档 | 12–16px | `ui/avatar.tsx`                                          |
| 20px 图标徽章        |    12px | `ui/icon-badge.tsx` 的 `xs` / `stat` 小屏档                  |
| 日历日期格            |    14px | `ui/calendar.tsx` 的月份导航箭头                                |
| 12px 文字档的侧栏分组    |    14px | `ui/sidebar.tsx`                                         |
| Badge 内的删除 `X`   |    12px | `tag-input.tsx`                                          |
| 16px 提示行         |    12px | `command-menu.tsx` 的装饰箭头                                 |
| 密集代码视口工具栏        |    14px | `json-code-editor.tsx`                                   |
| 24px 步进按钮        |    12px | `features/channels/components/numeric-spinner-input.tsx` |
| 签到格              |    12px | `features/profile/components/checkin-calendar-card.tsx`  |

三条硬约束：

1. 白名单**只按文件路径**生效，不做「小于 16px 一律放过」的模糊匹配；
2. 白名单里每一条都必须是「**图标元素自己写了小于 16px 的类名**」。靠祖先  
   `[&>svg]:size-*` 约束的不算；
3. 容器放大到能容纳 16px 时，**同步删掉**对应白名单条目。

守卫：白名单只在 `web/src/design-system/__tests__/spec-guards.test.ts` 的  
`SMALL_GLYPH_ALLOW` 一处维护，不存在第二份审计白名单；改动该文件即生效。  
本条是 E23 升格后的正式条款；E23 编号已按 §26.4 注销，引用时回指本节 §12.3。

### 三条硬规则

1. **不允许其他图标库。** `@hugeicons/*`、`@heroicons/*`、`react-icons/*` 一律迁到  
   `lucide-react`。唯一例外是 `components/react-icon-by-name.tsx`（运营在后台配置的  
   支付方式图标，名字运行时才确定）。
2. **尺寸与描边只能用规范值。** 12/14px 只允许出现在固定尺寸容器里；描边只有 2。
3. **颜色跟随父级文字色。** Lucide 内置 `stroke="currentColor"`，只要不写  
   `text-blue-400` 这类调色板色就自动成立；状态色用语义 Token。

---

# 13. Component 组件规范

> **👁 可视核查** → [核查页区域 19 · 组件示范](showcase.html#components)
>
> 组件示范区把 Button / Badge / Input / Card / Dialog / Table / Toast / Empty  
> 全部渲染成真实组件，可逐个核对字号、字重、圆角、内边距（§13.3 对应表）。

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

## 13.1 组件实现位置与语义组件

- **`web/src/components/ui/`** —— 组件正式实现位置。Button / Input / Badge /  
  Dialog / Table / Select / Tabs / Sidebar 等都在这里。
- **`web/src/design-system/components/typography/`** —— 只放 `ui/` 没有的排版  
  语义组件（`Text` / `Heading`）。
- 不允许在两处各实现一遍同一个组件。

### Text

```tsx
<Text variant='body' color='secondary' as='p' clamp={2}>
  描述文字
</Text>
```

| Prop       | 取值                                                                                                            | 说明        |
| ---------- | ------------------------------------------------------------------------------------------------------------- | --------- |
| `variant`  | `body` / `body-long` / `body-sm` / `body-medium` / `label` / `caption` / `code` / `code-block` / `code-dense` | 字号档位，不可覆盖 |
| `color`    | `primary` / `secondary` / `danger` / `success` / `inherit`                                                    | 语义色       |
| `weight`   | `400` / `500` / `600` / `700`                                                                                 | 覆盖字重      |
| `truncate` | boolean                                                                                                       | 单行截断      |
| `clamp`    | `1` / `2` / `3`                                                                                               | 多行截断      |
| `as`       | 任意标签                                                                                                          | 默认 `span` |

`body-long` 是 16/26 的长文本档，只用于连续阅读内容，宽度约束见 §1.12。

### Heading

```tsx
<Heading variant='page-title'>模型广场</Heading>
<Heading variant='section-title' level={2}>用量趋势</Heading>
```

| variant         | 默认标签 | 语义层级      |
| --------------- | ---- | --------- |
| `display`       | `h1` | 营销页主视觉    |
| `page-title`    | `h1` | 页面标题      |
| `section-title` | `h2` | 区块标题      |
| `card-title`    | `h3` | 卡片标题      |
| `dialog-title`  | `h3` | 弹窗标题      |
| `group-title`   | `h4` | 卡片内分组标题   |
| `mono-title`    | `h3` | 等宽字形的卡片标题 |

输出真实 `h1`–`h6`。**视觉与语义分离**：需要「看起来是 h3、结构上是 h2」时传  
`level={2}`。`multiline` 把行高换成 1.5 比例，只用于折 3 行以上的营销主标题  
（§1.10）。`mono-title` 与 `card-title` 是**同一语义层级的两种字形**，不是两个层级。

各 variant 的**具体字号 / 行高 / 字重以 §1.2 字号表、§1.3 语义角色与  
`__tests__/tokens.test.ts` 的 `LADDER` 为准**；组件文件头部注释可能滞后于本规范，  
不得拿注释里的旧刻度反向覆盖规范表格。

### PageHeader

「标题 + 描述 + 操作」的排版必须收敛到一处，页面不得各自决定标题字号与间距。  
当前仓库**尚未提供独立的 `PageHeader` 组件**：在它落地之前，页面按 §3 的页面层级  
与 §6 的语义间距组合 `Heading` + `Text` + 操作区，并把这一项登记在 §23 Phase 4 的  
未完成清单里。不得因此各页面自写 `<h1 className='text-4xl font-bold'>`。

### 调用处的边界

页面可以用 `className` 调整**布局**（宽度、间距、对齐），但不得覆盖组件已经定义的  
**视觉身份**：

| 允许                               | 不允许                  |
| -------------------------------- | -------------------- |
| `w-full`、`mt-4`、`justify-center` | `rounded-lg`（改按钮圆角）  |
| `max-w-md`                       | `text-base`（改按钮字号）   |
| `hidden sm:block`                | `font-bold`（改按钮字重）   |
| `aria-label`、`data-*`            | `bg-red-500`（绕开变体系统） |

新增代码请用 `variant` / `size` 表达差异。

### 状态与可访问性

所有交互组件必须覆盖 §28 `components.interactionStates` 声明的  
`default` / `hover` / `focus-visible` / `active` / `disabled` / `loading`  
六态；带选中 / 按压语义的组件另需 `selected` / `pressed`（§10.3 / §14.4）。  
本清单以 §28 为唯一声明，各章不再另立一套：

- 键盘可聚焦，焦点环满足 §15.1 / §28 `a11y.focusRing`，不允许 `outline: none` 抹掉
- 加载态不能改变按钮尺寸（§10.6）
- 图标按钮必须提供 `aria-label`

## 13.2 原生 `<button>` / `<input>` 的边界

原生元素**不是「还没迁移的欠债」**，但也**不是想留就能留** —— 每处必须落进下面  
六类之一，落不进就必须换成 `Button` / `Input`。判据是**这个元素的语义**，不是它  
长得像不像按钮：

| 类别       | 判据                                                          | 现有落点（抽样）                                                                       |
| -------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 整行 / 列表项 | 整块区域可点，内容是一组信息而不是一个标签；`aria-expanded` 之外的布局语义 `Button` 表达不了 | 表格内可点单元格、公告行、API Key 行、分组选项行、`multi-select` 的值胶囊                               |
| 手风琴触发器   | 带 `aria-expanded`，点击展开一块内容                                  | `codex-usage-dialog`、`channel-advanced-section`、`task-pricing-matrix`          |
| 标签页 / 分段 | 带 `role='tab'` 或一组互斥选项，选中态由外部状态驱动                           | `rankings-hero` 周期切换、图表类型切换、模型图 tab、首页终端 demo 的 tab                            |
| 复合控件根    | 自研输入原语的一部分：数字步进器、密码显隐、侧栏拖拽轨、日历格                             | `numeric-spinner-input`、`secret-input` / `secret-textarea` 的眼睛按钮、`sidebar` 拖拽轨 |
| 图标按钮     | 只有图标、`aria-label` 说明动作，尺寸取 16 / 18 / 24 三档（§12.3）           | 图例提示、筛选项移除、重试链入口                                                               |
| 表单隐藏字段   | `type='hidden'` / 文件选择器 / 只读指示符                             | react-hook-form 隐藏字段、`<input type='file'>`、Markdown 任务列表 checkbox              |

约束：

1. **样式必须复用控件 Token**：高度走 `--ds-control-height-*` 或  
   `--ds-button-height-*`，圆角走 `--radius-*`，颜色走语义色，过渡走  
   `ds-motion-*`（或裸 `transition-*`，默认值已被 §9.5 指到最快一档）。  
   **不得自造一套高度与描边** —— 胶囊高度统一读 `--ds-chip-height`。
2. **触控目标不小于 24×24**（§15.3）。密集容器里视觉尺寸只能取 16px（或 §12.3  
   白名单允许的 12 / 14px 容器档）时，加 `.ds-touch-target`。**不得**写成 16–20px  
   这类区间 —— 20px / 22px 不在 §12.3 五档内。
3. **键盘焦点由基座兜底，不需要每处手写**。  
   `design-system/foundations/accessibility.css` 对  
   `:where(a, button, [role='button'], [tabindex]):focus-visible` 画 2px 环；组件层  
   写的是 `focus-visible:ring-2 focus-visible:ring-ring`，两者几何必须一致。
4. 隐藏型（`hidden` / `sr-only` / `opacity-0` 覆盖层）不参与统计，也不受样式约束。

> 历史教训：这一节上一版写的是「只要它是用户会点、点了会触发操作的入口，就必须用  
> `Button`」，而同一页上面列的 39 处里有 34 处正是「会点」的 —— 条款与现状自相  
> 矛盾，等于没有条款。**能落进六类的是结构，落不进的是欠债。** 本条是 E16  
> 升格后的正式条款；E16 编号已按 §26.4 注销，引用时回指本节 §13.2。

## 13.3 组件排版对应表

这些是硬数值，与本项目 Token 一一对应。改尺寸先改 Token（§17.1），不要在调用点写死：

| 组件           | 规范值                       | 本项目实现                                                                      |
| ------------ | ------------------------- | -------------------------------------------------------------------------- |
| Button `md`  | 高 36px                    | `size="default"` → `--ds-button-height-md` 36px                            |
| Button `sm`  | 高 32px                    | `size="sm"` → `--ds-button-height-sm` 32px                                 |
| Input `md`   | 高 40px                    | `--ds-control-height-md` 40px                                              |
| Input 文字     | 桌面 14px；**H5 表单输入 ≥16px** | `body-sm` / §1.7 / §16.3（iOS Safari 防自动放大，是 3.0 的正式口径，不是兼容附注）              |
| Table 行高     | 48px                      | `TableRow` 的 `h-12`                                                        |
| Table 单元格内边距 | 水平 12 / 垂直 8px            | `TableCell` 的 `px-3 py-2`                                                  |
| Table 表头     | 高 40px、`px-3 py-2`        | `TableHead`                                                                |
| Alert 内边距    | 16px                      | `Alert` 的 `p-4`，图标与文字间距 `gap-x-3`（12px）                                    |
| Sidebar 宽    | 220px（`13.75rem`）         | `SIDEBAR_WIDTH` = 13.75rem                                                 |
| Toast 宽      | ≈356px                    | `sonner` 的默认宽度                                                             |
| 焦点环          | 2px 品牌色                   | `--ds-focus-ring-width` 2px + `--ring`（组件层一律 `focus-visible:ring-2`，§15.1） |
| 圆角           | 控件 10px / 卡片弹窗 12px       | `--radius-md` / `--radius-lg`（§5 九档）；图标按钮同卡片档 12px（§10.2）                  |

各组件的字号 / 字重 / 行高 / 圆角落点。**行高一律跟随 §1.2 档位**：  
14px → **22px**、12px → **18px**、16/26 → 26px、18px → 26px。旧表把 14px  
写成 20px、12px 写成 16px（沿用 2026-10-30 之前的旧行高），与 §1.2 / §1.3 /  
§1.14 / 代码 Token 全部冲突，本轮收敛。本表是 §28 `typography` 的投影。

| 组件               | 字号（档位）                    | 字重        | 行高       | 圆角                                                |
| ---------------- | ------------------------- | --------- | -------- | ------------------------------------------------- |
| Button           | 14px（`label`）             | 500       | **22px** | `--radius-md` 10px（图标按钮 `--radius-lg` 12px，§10.2） |
| Input / Textarea | 14px（`body-sm`）           | 400       | **22px** | `--radius-md` 10px                                |
| Label            | 14px（`label`）             | 500       | **22px** | —                                                 |
| Badge            | 12px（`caption`）           | 400       | **18px** | `--radius-full`                                   |
| StatusBadge      | 14px（`body-sm`）           | 400       | **22px** | `--radius-full`（§1.14 的固定 14px 例外）                |
| Card 标题          | 18px（`card-title`）        | 600       | 26px     | `--radius-lg` 12px                                |
| Card 描述          | 14px（`body-sm`）           | 400       | **22px** | —                                                 |
| Dialog 标题        | 18px（`dialog-title`）      | 600       | 26px     | `--radius-lg` 12px                                |
| Dialog 描述        | 14px（`body-sm`）           | 400       | **22px** | —                                                 |
| Table 表头         | 12px（`caption`，§1.14）     | 500       | **18px** | —                                                 |
| Table 单元格        | 13px（`text-dense`，§1.14）  | 400       | **20px** | —                                                 |
| Table 次要说明       | 12px（`caption`）           | 400       | **18px** | —                                                 |
| Alert 标题         | 14px（`label`）             | 500       | **22px** | —                                                 |
| Alert 描述         | 14px（`body-sm`）           | 400       | **22px** | —                                                 |
| Toast 标题/描述      | 14px（`label` / `body-sm`） | 500 / 400 | **22px** | `--radius-lg` 12px                                |
| Markdown 正文      | 16px（`body-long`）         | 400       | 26px     | —                                                 |
| Markdown 表格      | 14px（`body-sm`）           | 400       | **22px** | —                                                 |
| Sidebar 菜单项      | 14px（`label`）             | 500       | **22px** | `--radius-md` 10px                                |
| Sidebar 分组标题     | 12px（`caption`）           | 600       | **18px** | —                                                 |
| Empty 标题         | 18px（`card-title`）        | 600       | 26px     | —                                                 |
| Empty 说明         | 14px（`body-sm`）           | 400       | **22px** | —                                                 |

## 13.4 卡片标题旁的汇总值：14px

卡片标题右侧那一小串「总计 / 合计 / 共 N 条」是**和标题同一层级的补充信息**，  
不是说明文字，**一律 14px（`body-sm`，`text-sm`）**：

```tsx
<div className='text-lg font-semibold'>{t('Quota Distribution')}</div>
<span className='text-muted-foreground text-sm'>
  {t('Total:')} {chartData.totalQuotaDisplay}
</span>
```

| 写法                                                 | 判定                 |
| -------------------------------------------------- | ------------------ |
| `<span className='text-muted-foreground text-sm'>` | ✅ 14px，正确          |
| `<span className='text-muted-foreground text-xs'>` | ❌ 12px，把汇总值降成了说明文字 |
| 用 `<p>` 或独立一行渲染                                    | ❌ 汇总值属于标题行，不另起一行   |

**为什么不能是 16px**：16px 是 `group-title` 与长文本的档位。汇总值跟标题（18px  
`card-title`）同排，16px 会让「标题 → 汇总值」只差 2px，层级塌掉。


守卫：`web/src/design-system/__tests__/control-typography.test.ts` 的  
`keeps card header summaries at 14px`。

---

# 14. Navigation 导航系统

> **👁 可视核查** → [核查页区域 20 · 导航选中态](showcase.html#navigation)
>
> 选中态专用 Token 的实测对比度由展示页按真实背景计算（§18.2 第 20 区），  
> 不在文档里手写结果。「不得用 `--text-primary` 充当颜色 Token」的条款在  
> §17.3，不在 §14.3；切换深色模式可核对深色对比度。

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

本表是 §7.1「密度 Default 列」与 §28 `components.navigation.sizes` 的**投影**，  
禁止单独改值。

| Token    |   高度 |
| -------- | ---: |
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
**不得**改用 `--text-primary` 充当颜色 Token（§17.3）—— 它是字号命名空间，不是颜色。

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

> **👁 可视核查** → [核查页区域 21 · 焦点环与触控目标](showcase.html#focus)
>
> 焦点环恒 2px、贴边；右侧对比「视觉 16px + 命中区 24px」  
> 与「视觉 24px」两种触控做法。

默认：

```css
--ds-focus-ring-width: 2px;
--ds-focus-ring-color: var(--ring);
```

**全站恒为 2px，且贴边（无 offset —— 不存在 `--ds-focus-ring-offset` Token，  
`outline-offset` 恒为 0）。值以 §28 `TOKEN-MANIFEST` 的
`meta.focusRingWidth` / `a11y.focusRing.width` 为准，运行真源是
`web/src/design-system/tokens/semantic.css`。2026-11-13 用户裁决由 1px
改回 2px：1px 环在 36px 控件与 1px 描边的界面上对比不够显眼，2px 满色
品牌环更容易在 Light / Dark 两种底上被一眼看见；**宽度只有 2px 一档**，
不存在「表单 1px / 其余 2px」的两档并存。**

必须：

- 使用 `:focus-visible`。
- 保证焦点状态清晰。
- 在 Light 和 Dark 中分别验收。
- 不得被父容器裁切。
- 不得被浮层覆盖。
- 不得在无替代方案的情况下删除默认焦点。
- 组件层一律写 `focus-visible:ring-2`；原生兜底走同一 Token 的 `outline`（宽度同为 2px）。
- 输入舱这类「容器承担焦点环」的结构，基态必须是 `ring-2 ring-transparent` 占位，否则过渡时会跳；滑块的 hover / active 环同宽。
- `focus-visible:outline-1` 这类原生兜底不得再用 1px，宽度口径跟随 `ring-2`。
- 错误态 `aria-invalid:ring-2` 宽度与焦点环相同，但颜色是 `destructive`，靠颜色而非粗细区分。

不属于焦点指示器、**不受本条宽度约束**的三类环（判定看语义，不看 `ring-N` 数字）：

| 环                     | 宽度    | 说明            |
| --------------------- | ----- | ------------- |
| 装饰性 `ring-1` 描边（弹层 / 卡片 / 日历格） | 1px | 视觉分隔，不承载焦点语义，不写 `focus-visible:` 前缀 |
| avatar 镂空环            | 由尺寸决定 | 视觉分隔          |
| 选中态 `ring-offset-2`   | 2px   | 偏移量不是宽度       |

焦点环对比度按 WCAG 2.2 AA 的 1.4.11（非文本对比度 3:1）验收。

注意：WCAG 2.2 的 Focus Appearance（2.4.13）属于 AAA，不得将其误称为 AA 要求。2px 是本规范的**唯一**宽度，改值必须按 §27.3 / §28.2 先改 §28 Manifest，再同步 `semantic.css`、组件层、守卫、`showcase.html` 快照，**五者同提交**；只改其中一处会留下同屏粗细不一致的焦点环。

## 15.2 对比度

按 WCAG 2.2 AA 执行：

| 内容         | 最低对比度 |
| ---------- | ----: |
| 普通文字       | 4.5:1 |
| 大号文字       |   3:1 |
| 必要 UI 组件边界 |   3:1 |
| 必要图形对象     |   3:1 |

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

| Token |     宽度 |
| ----- | -----: |
| `sm`  |  640px |
| `md`  |  768px |
| `lg`  | 1024px |
| `xl`  | 1280px |
| `2xl` | 1536px |

所有页面必须在不同宽度下正确工作。

## 16.2 PC Web

- 页面内容不得无限拉伸。
- 主要内容区域必须有合理最大宽度。
- Sidebar 与 Main Content 关系保持稳定。
- 表格必须具有合理的最小宽度或自适应策略。
- 弹窗不得超出可视区域。

### 内容区最大宽度：后台 1280px，营销页不受限

「内容区 1280px」这条约束的对象是**后台内容区**（仪表盘、设置、日志、定价管理）：

```css
/* 后台内容区 */
max-width: 1280px;
margin-inline: auto;
```

营销页（首页、定价展示页、关于页）是**宽屏展示面**，允许突破 1280px —— 首屏主视觉与多列价格卡在 1440/1920 屏上被压进 1280px 会留下大片空白，反而更差。

**营销页宽屏上限登记**：`1800px`，由 `--ds-content-max-wide` /  
`max-w-container-wide` 表达。**唯一声明**在 §28 `meta.contentMaxWide`，  
本节只是说明与引用，代码只消费 Token（§28.1）。该值原为 §26.4 的 E19，  
编号已按 §26.4 注销、不再有效；旧版只说「按页面登记」却从未给出数值，  
导致 E19 指向一个空条款，本轮补齐声明并消除循环引用。

三栏文档 / 关于页的外壳宽度是另一回事：`max-w-[1440px]` 是「左导航 + 正文 + 右目录」的总宽，正文自身仍限制在 `max-w-3xl`。不要把它当成内容区破例。

判据：**这个页面是「用户在里面干活」还是「用户在里面被说服」？** 前者 1280px，后者按登记值。

### 指标数值的断点用 `md`，不用 `sm`

指标数值（仪表盘卡片上的大数字）统一 `text-2xl md:text-3xl`（24px → 30px，768px 起放大）。

不得写成 `text-2xl sm:text-3xl`：`sm`（640px）在 640–768px 区间会把数字放大到 30px，而那一档正文还是 14px，数字会压过标题；`md` 是「平板竖屏转横屏」的分界，也是侧边栏开始常驻的位置，数字在那之后放大才与整体层级同步。

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
      elevation.css
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

实际目录以上表为准：**投影与动效默认值同在 `tokens/elevation.css`**，  
颜色在 `tokens/colors.css`，圆角在 `tokens/primitives.css`（旧示例目录里的  
`shadows.css` / `radius.css` / `density.css` 在本仓库并不存在）。

必须先检查现有仓库目录结构。

如果项目已经有等价架构，应在现有结构上完善，不得为了照搬示例而无意义重建项目。

## 17.2 Token 分层

Token 分为三层：

**Primitive Tokens**

基础值层只登记 Token 名，**不在此重复声明数值**（实际色值见 §28  
`colors.text` / `colors.surface` / `colors.brand`）：

`--slate-50` / `--slate-100` / `--slate-200` / `--slate-300`（Slate 色阶）、  
4px 网格与 400–700 字重。本节是分层结构说明，不是取值真源。

**Semantic Tokens**

业务语义层同样只登记 Token 名，**实际值见 §28 `colors`**：

`--background` / `--foreground` / `--card` / `--popover` / `--primary` / `--border`  
及其 Light / Dark 两套取值。

**Component Tokens**

组件专属值（**结构示意，不是取值声明**；实际值见 §28 `components` 与 §7.1）：

```css
--ds-button-height-md: 36px;   /* §28 components.button.sizes */
--ds-control-height-md: 40px;  /* §28 components.control.sizes */
--radius-md: 10px;             /* §28 radius.usage.button */
--card-padding: 24px;          /* §28 density.params.cardPadding.default */
```

组件优先引用 Semantic Token，而不是直接引用 Primitive Token。

## 17.3 Tailwind CSS v4 映射

必须使用 Tailwind CSS v4 的正确命名空间。

| 类型   | 命名空间              |
| ---- | ----------------- |
| 颜色   | `--color-*`       |
| 字体大小 | `--text-*`        |
| 字体家族 | `--font-*`        |
| 字重   | `--font-weight-*` |
| 行高   | `--leading-*`     |
| 间距   | `--spacing-*`     |
| 圆角   | `--radius-*`      |
| 阴影   | `--shadow-*`      |
| 动效曲线 | `--ease-*`        |

业务语义源变量使用独立名称，例如：

```css
--brand-primary: #5B5EE6;
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

## 17.5 营销首屏的效果锚定（背景装饰层与品牌渐变）

> **👁 可视核查** → [核查页区域 22 · 品牌渐变与首屏演示](showcase.html#brand-gradient)
>
> ds-text-gradient-brand 单一出口、三档停靠站实测色值与对比度，以及  
> §26.2 E28 登记例外的说明。

> 本节为 2026-11-13 恢复的条款。原条目在 2.0 规范 §11.5「首屏演示的效果锚定  
> （`term-*` 与品牌渐变）」：2026-11-03 12:05 `28761e475` 合并为 3.0 单文件时  
> **漏搬**，同日 19:15 `5ef373b63`「废止删除旧设计文档」又把 2.0 / 1.x 文档整份  
> 删除，条款彻底消失。3.0 的 §11.5 现为「Checkbox / Radio / Switch」，但代码注释  
> 一直写「规范 §11.5」，属悬空引用，本次一并改为指向本节。

### 适用范围

首页 hero 主标题的渐变行、CTA 的渐变副标题，以及两者背后的光晕 / 网格。  
它们是**对外传播资产**，取值必须**渲染出与上游 new-api 一致的效果**。  
顺序永远是：先在本节定档 → 改代码实现 → 验证渲染一致（§24）。  
「要和上游长得一样」是要求；「要和上游逐类一致、所以只能照抄它的类名」不是 ——  
效果能由 Token 表达时，不得把规范缺口固化成永久豁免。

#### 背景装饰层

| 层   | 落位                                                        | 内容                                                           |
| --- | --------------------------------------------------------- | ------------------------------------------------------------ |
| 颜色  | `styles/theme.css` 的 `--ds-decor-glow-*`                  | hero 三个 + CTA 两个弱化档，浅色定义、不随主题变                               |
| 透明度 | `--ds-decor-mesh-opacity-{hero,cta}`                      | hero 0.25→0.12，CTA 0.2→0.08，`.dark` 覆盖                       |
| 形状  | `design-system/foundations/decoration.css` 的 `ds-decor-*` | `ds-decor-mesh-hero` / `ds-decor-mesh-cta` / `ds-decor-grid` |

组件里禁止内联 `radial-gradient(...oklch...)`，也禁止散装透明度  
（`opacity-25 dark:opacity-[0.12]`）—— 深浅取舍必须由 Token 表达。  
装饰层 `aria-hidden`、不承载文字，本身没有对比度义务；叠在它上面的前景内容仍各自达标。

#### 品牌渐变（本节核心）

三个停靠站：蓝 → 紫 → 洋红。**单一取值，不随主题深浅变化，也不接 `chart-*`** ——  
`chart-*` 会跟着主题预设漂移（绿色系预设下渐变会变绿），而这是对外传播资产。

| Token                            | 值         | 上游等价       |
| -------------------------------- | --------- | ---------- |
| `--ds-color-brand-gradient-from` | `#60a5fa` | blue-400   |
| `--ds-color-brand-gradient-via`  | `#a78bfa` | violet-400 |
| `--ds-color-brand-gradient-to`   | `#a855f7` | purple-500 |

消费方式有且只有一个：`@utility ds-text-gradient-brand`  
（`design-system/foundations/typography.css`）。它把「渐变 + `background-clip: text`

- `color: transparent`」收成一类，三件套必须同时存在，漏掉最后一条会渲染成看不见的字。  
  组件里手写 `from-… via-… to-…` 由 T7 拦下；hero 与 CTA 共用这一出口，不许各自漂移。

**硬规则**：

1. **上游没变就不要动这一组值。** 改值 = 改对外观感，须按 §28.2 先改  
   `TOKEN-MANIFEST.colors.gradient` 与 `meta`，再同步本节投影表、§19.1 的  
   锚定检查、下方实测表与 `verify-contrast.mjs`，最后改运行真源，不得  
   「先改实现、后补门禁」。
2. **禁止 `:root.dark` 覆盖**：深浅主题共用同一组停靠站。深色主题靠更暗的背景  
   自然获得更高对比度，不需要另配一套浅色值。
3. 改光晕颜色或形状 = 改对外观感：按 §28.2 先补 / 改 §28 声明（当前装饰层  
   值尚未纳入 Manifest，见 §28.6），同步本节表格，并复核 §18.2 第 22 区呈现。
4. 背景装饰层只经 `ds-decor-*`；颜色 / 透明度 / 形状三件事不许再缠回组件内联样式。

#### 对比度实测与已登记例外

按 §15.2，普通文字 4.5:1、大号文字 3:1。渐变标题只出现在 hero / CTA，  
字号 ≥24px 且为粗体，属**大号装饰性标题**。实测背景取 §28  
`colors.surface.light.background`（`#FFFFFF`）与  
`colors.surface.dark.background`（`#020617`）—— 与 §2.5、§28 及  
`verify-contrast.mjs` 同一口径；旧版误用 `#0F172A`（已撤销的 Dark 卡片旧值）  
作暗背景，本轮按运行真源重算：

| 停靠站            | 浅色 `#FFFFFF` | 深色 `#020617` | 判定       |
| -------------- | -----------: | -----------: | -------- |
| from `#60a5fa` |       2.54:1 |       7.93:1 | 浅色未达 3:1 |
| via `#a78bfa`  |       2.72:1 |       7.41:1 | 浅色未达 3:1 |
| to `#a855f7`   |       3.96:1 |       5.10:1 | 达标       |

> **决策记录（2026-10-30 拍板，2026-11-13 恢复并编号为 §26 E28）**：浅色  
> from / via 未达大文本 3:1，**维持品牌渐变恒定值优先**。理由：① 这是对外传播的  
> 品牌资产，与上游渲染一致是首要要求；② 它是装饰性 / 辅助性标题，不是表单标签、  
> 错误提示或正文；③ 深色主题三档全部达标。**不许拿「禁用态豁免」解释这些残留**  
> —— 它们不是禁用控件；也不许通过压深停靠站来「修」对比度，那会直接改变观感。
>
> 本例外已在 **§26.2 登记为 B 类 E28**（理由 / 影响范围 / 退出条件齐全），  
> 属于验收口径例外，**不进 `ALLOWLIST`**；A 类静态扫描例外仍为 0 条。
>
> 因此 `scripts/verify-contrast.mjs` 对本节的验收条件是「逐值锚定上游 +  
> 深浅同值 + 单一 owner + 实测值已在本节登记」，**不是**普通文本的 4.5:1。  
> 2026-11-10 13:20 `b3754e023` 把 4.5:1 套到这组 Token 上，是在本节条款已被  
> 误删之后自行加严、且无规范依据的口径错配；13:19 `56ef64657` 为过该断言把值  
> 改成 `#494cc7 / #5558d8 / #6b4fc8` 并加 `:root.dark` 覆盖，是「先改实现、  
> 后补门禁」的回归。本次一并撤销，并按锚定值恢复。

#### 沿革

| 日期               | 提交          | 变化                                                |
| ---------------- | ----------- | ------------------------------------------------- |
| 2026-10-30 04:06 | `39f269154` | 收成 `ds-text-gradient-brand`，值 = 上游原值；2.0 §11.5 落档 |
| 2026-11-03 12:05 | `28761e475` | 3.0 单文件纳入，漏搬 §11.5                                |
| 2026-11-03 19:15 | `5ef373b63` | 删除全部旧设计文档，条款消失                                    |
| 2026-11-10 13:19 | `56ef64657` | 值改深 + 加深色覆盖                                       |
| 2026-11-10 13:20 | `b3754e023` | 4.5:1 渐变断言入门禁                                     |
| 2026-11-13       | 本次          | 恢复本节 + 恢复上游值 + 门禁改按锚定验收                           |


## 17.6 唯一入口与导入顺序

```
web/src/styles/index.css
├── @import 'tailwindcss'
├── @import './theme.css'                    颜色、字体栈、圆角基准、品牌色阶
├── @import './theme-presets.css'            颜色 / 圆角 / 密度预设
├── @import '../design-system/tokens/index.css'
└── @import '../design-system/foundations/index.css'
```

**顺序有约束**：`tokens/typography.css` 的 `@theme` 必须晚于
`@import 'tailwindcss'`，否则覆盖不了内置阶梯。

全局正文规则集中管理，组件自己的 CSS 不重复重设 `body`、全局标题或全局字体：

```css
body {
  font-family: var(--font-ui);
  font-size: var(--ds-text-body);
  font-weight: var(--font-weight-normal);
  line-height: var(--ds-line-body);
  color: var(--foreground);
}
```

**取值优先级的裁定（与 `AGENTS.md` 对齐）**：设计**值**有两层同值真源 ——
§28 `TOKEN-MANIFEST` 是**声明真源**，
`web/src/design-system/tokens/` 与 `web/src/styles/theme.css` 的 CSS 是**运行真源**；
§28.3 的校验保证两者逐值相等。设计**规则与边界**（什么写法被禁止、什么场景用哪个
档）以 §1–§27 为准。三者冲突时**不得静默选一边**：先按 §27.4 判断是实现漂移还是
规范滞后，再按 §28.2 的流程「先改 Manifest → 同步运行真源与投影表 → 复核展示页」
收敛，并把结论写进 §26 或 §27 的变更记录。

## 17.7 主题维度独立性

共**五个主题维度**：

| 维度 | 属性 | 允许影响 | 不允许影响 |
|---|---|---|---|
| 颜色主题 | `data-theme-preset` | 背景、文本、边框、状态色、品牌色阶 | 字号、间距 |
| 圆角 | `data-theme-radius` | 圆角基准 `--radius` | 字号、颜色 |
| 密度 | `data-theme-scale` | `--spacing` + `--ds-*` 控件 / 表格 / 卡片尺寸 | 字号阶梯、颜色 |
| 明暗 | `.dark` | 颜色 Token 取值 | 尺寸 |
| 字体轴 | `data-theme-font` | `--font-body` 家族与 serif 细化规则 | 字号、间距 |

> **字体轴状态：Pending。** 当前代码库锁定 Inter + Noto Sans SC（§1.1），
> `data-theme-font` 的三档（`system` / `sans` / `serif`）**尚未落地**，需另行拍板并
> 迁移 `--font-*` Token。落地前不得在业务组件散写字体家族；本项按 §24 保持
> Pending，不得标记为通过。

三条硬约束：

1. **密度不得改动默认正文语义。** `[data-theme-scale]` 只缩放 `--spacing`，**不缩放
   `--text-*`**（§7.2）。这条曾经是反的 —— 密度档会一起压 `--text-*`，等于「用户切
   紧凑模式顺手把正文压小一档」，已移除。需要放大文字的用户走 §1.9 的
   Simple Large-font 预设。
2. **圆角主题不得影响字号与正文行高。** 改 `--radius` 基准即整体缩放。
3. **`.dark` 只替换 Token 取值，不新增 Token。** 任何新增颜色必须在 `:root` 和
   `.dark` 各给一次值，否则深色模式下会漏。唯一例外是
   `--primary-subtle-hover` / `--destructive-subtle` 这类
   `color-mix(… var(--background))` 派生值 —— 它们在 `:root` 声明一次，
   `--background` 翻转时自动跟随。

**主题预设的品牌色阶自动派生**：`theme-presets.css` 对非 `default` 预设用
`color-mix(in oklch, …)` 从该预设的 `--primary` 推出 `primary-hover` /
`primary-active` / `primary-subtle` / `primary-border` / `--ring`，不需要每套预设
手抄一份色阶。**品牌渐变是这条规则的例外**：它逐值锚定上游、深浅主题同值，
禁止 `:root.dark` 覆盖（§17.5）。

---

# 18. Design Showcase 设计系统展示页

必须建立真实的设计系统展示页面。展示页不是独立设计稿，而是对 §28 `TOKEN-MANIFEST`
与真实组件的可视化核查工具。

## 18.1 数据来源（唯一）

所有展示数据必须来自 **§28 `TOKEN-MANIFEST`**。`docs/design-system/showcase.html`
在运行时读取本规范中的 `TOKEN-MANIFEST` 代码块，把值注入 CSS 自定义属性并渲染全部
区域；它自身**不维护任何色值、字号、尺寸常量**。唯一例外是 `:root` 里一组
**刻意偏离全部设计刻度的降级可读性占位**（仅在 Manifest 加载失败时生效），
由 §28.3 ⑥ 逐值扫描强制拦截：一旦它与任何 Manifest 声明值相同即判 FAIL。

- **核查页必须单文件独立生效**：把 `showcase.html` 单独放到任意目录、用
  `file://` 双击打开即可完整渲染 24 个区域，**不需要**在本目录执行
  `python3 -m http.server`，也不依赖同目录任何伴生文件。
- 通过 `file://` 打开时：读取**页内内联快照**（`<script id="uter-manifest-snapshot">`，
  由 §28.4 同步脚本从同一个 `TOKEN-MANIFEST` 生成并写入），页头显示「离线快照」
  标记与生成时间。`file://` 下不发起 `fetch`（必然被 CORS 拒绝），也不显示
  任何「请启动本地 HTTP 服务」的提示。
- 通过 HTTP 打开时：改 §28 的值 → 刷新页面即生效，无需重新生成；实时解析失败时
  回退到同一份页内内联快照。
- `showcase.tokens.js` 是**旧版兼容回退**的派生产物，与页内快照由同一脚本同步生成；
  两者都由 `--check` 逐值比对 §28，任一漂移即判 FAIL。
- `docs/design-system/showcase-3.0.html` 是视觉回归 track 1 的**像素基线对象**，
  保留为既有资产，但不再是任何值的真源；它的硬编码 Token 块不得反向驱动规范。
  该文件与其生成器 `web/scripts/generate-design-showcase.mjs` 中的旧标题
  （「字号十档」「圆角七档」）、旧圆角基准 8px、旧焦点环 1px 均为**历史基线快照**，
  按像素基线「不改动」的要求保留，不得引用为 3.0 口径，也不得据此回改
  §1.2 / §5 / §15.1 / §28。**2026-11-13 焦点环由 1px 改为 2px 后，这一冻结基线
  里的 `--focus-ring-width: 1px` 与「§15.1 不存在 2px 档」文案同样不作同步**——
  它记录的是 2026-10-29 的像素状态，不是现行声明；现行值只看 §28 Manifest、
  `semantic.css` 与 `showcase.html` 内联快照。同理，
  `docs/design-system/audit/evidence/` 下的审计证据也是带日期的历史记录，不随
  后续裁决回改。新的目视核查一律以本文件规定的 `showcase.html` 为准。

**改了 §28 的值后，离线打开要生效只需一步**：在仓库根运行
`node web/scripts/sync-design-showcase.mjs`（该命令会重新生成页内快照并跑完
§28.3 全部校验）；`--check` 则只校验不写文件，适合接进 CI 门禁。

禁止：

- 手动复制一份颜色列表作为展示数据。
- 在展示页里内置 `:root` Token 副本并称之为「唯一数据真源」。
- 展示页颜色与实际页面使用颜色不一致。
- 仅通过静态截图冒充组件实现。
- 为了展示而创建不参与真实项目的假 Token。

§28.3 的一致性校验保证「声明真源 = 运行真源 = 展示页所见」，三者任一漂移即阻断。

## 18.2 展示页必须包含 24 个区域

区域清单以 §28 `sections` 为唯一声明（编号、id、标题、对应规范章节均在那里），
展示页按该数组生成导航与区块。当前 24 区：

1. 字号 11 主档 + 7 配套档。
2. Mono 四档。
3. 页面层级四层。
4. 文字色七档。
5. 表面与描边。
6. 品牌色阶。
7. 状态色。
8. 图表分类色（chart-1…6）。
9. 语法高亮色。
10. Terminal 演示 Token。
11. 圆角九档。
12. 间距。
13. 密度 Token。
14. 五档 Elevation Shadow + 一个 Brand Glow。
15. 动效。
16. Button 九档尺寸 + 六变体。
17. 控件尺寸。
18. 图标五档。
19. 组件示范。
20. 导航选中态。
21. 焦点环与触控目标。
22. 品牌渐变与首屏演示：`ds-text-gradient-brand` 的单一出口效果、三档停靠站
    的实测色值与对比度、背景装饰层（`ds-decor-mesh-*` / `--ds-decor-glow-*`），
    以及 §26.2 E28 登记例外的说明。见 §17.5。
23. **响应式断点**：§16.1 的 sm / md / lg / xl / 2xl 五档，以及 §16.2 后台
    1280px、营销页 1800px 两个登记值。
24. **Token 分层与单一数据链**：§17 三层 Token、§28 三层唯一与数据链示意，
    并显示本次 `TOKEN-MANIFEST` 的 `version` / `updated`、数据来源标记，
    以及离线快照生成时由 §28.4 同步脚本写入的 `--check` 校验摘要
    （`showcase.tokens.js` 的 `META.verification`）；实时解析模式下标注
    「以 `sync-design-showcase.mjs --check` 输出为准」，不自行判定 PASS。

23 / 24 两区补齐了旧版 22 区未覆盖的 §16 与 §17；旧版 §18.4 要求回答「当前项目
有哪些 Token」，却没有给 Token 架构留出展示区，属自相矛盾。

不得遗漏上述任何一个区域。新增区域必须同时登记进 §28 `sections`，展示页按数组
自动生成，不手写区块清单。

## 18.3 展示页功能

必须支持：

- Light / Dark 切换。
- 当前 Token 名称。
- 当前实际值（字号 / 行高 / 字重 / 色值 / 尺寸，全部来自 §28）。
- Token 复制。
- 色值复制。
- 对比度显示。
- AA Pass / Fail。
- Button 状态预览。
- Control 尺寸预览。
- Density 切换（Compact / Default / Spacious）。
- 圆角预览。
- Shadow 预览。
- 动效预览。
- 图标尺寸预览。
- 组件状态预览。
- **数据来源标记**：显示当前是「实时解析规范」还是「离线快照」，以及
  `TOKEN-MANIFEST` 的 version / updated。

对比度展示必须来自真实计算（WCAG 相对亮度，含 Alpha 合成），不能手工填写结果。
未通过的组合必须显示 Fail；未执行测试的组合必须显示 Pending，而不是默认显示 Pass。

## 18.4 展示页验收

展示页必须能够回答：

- 当前项目有哪些 Token？
- 每个 Token 的实际值是什么？
- 这些值来自哪里（§28 声明 / 运行真源 / 离线快照）？
- Light 和 Dark 是否完整？
- 哪些颜色通过 AA？哪些尚未通过？
- 每种按钮有哪些状态？每种控件有哪些尺寸？
- 当前 Density 对组件产生什么影响？
- 组件是否使用真实 Token？
- **改了 §28 的一个值，展示页是否同步变化？**（验收方式：改动一个字号值 →
  刷新 → 对应区域数值与渲染同时变化 → 恢复原值并跑 `--check`）

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
- 品牌渐变是否逐值锚定上游、深浅同值、单一 owner（§17.5）；这一项按 §26.2 的 B 类例外 E28 验收，不套普通文本 4.5:1。

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

在**仓库根**执行：

```bash
node web/scripts/check-design-tokens.mjs --strict
node web/scripts/sync-design-showcase.mjs --check
node web/scripts/sync-design-showcase.mjs
```

在 **`web/`** 下执行（vitest 配置在该目录）：

```bash
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

**唯一条款**：不得通过降低阈值、删除失败测试、忽略结果或把未执行的测试标记为
通过来使质量门禁通过。§0.1 / §21.4 / §24 只作引用，不另立口径。

## 19.5 静态扫描规则表（T1–T17）

本节 T1–T17 是**拦截规则的唯一权威**，§25 是其人类可读索引（口径见 §25 开头）。
A 类由 `web/scripts/check-design-tokens.mjs` 或
`web/src/design-system/__tests__/spec-guards.test.ts` 静态拦截；B 类语义判据
按 §22.5 人工验收。下表是脚本**当前实际实现**的 T1–T17 规则编号，规范与脚本必须
逐条对齐；新增 / 修改规则按 §27.2 同步清单同步本节与 §25。

```bash
node web/scripts/check-design-tokens.mjs           # 报告模式
node web/scripts/check-design-tokens.mjs --strict  # 有违规即退出码 1（CI）
bunx vitest run src/design-system/__tests__        # Token / 守卫测试
```

| 规则 | 拦截内容 | 依据 |
|---|---|---|
| T1 | `--text-*` 出现在唯一来源之外（字号阶梯重复声明） | §1.2 / §17.1 |
| T2 | 任意字号工具类 `text-[15px]` | §1.2 |
| T3 | 任意行高工具类 `leading-[26px]` | §1.2 |
| T4 | 内联字号 `style={{ fontSize: 13 }}`；图表 `fontSize: N` 裸数字 | §1.2 / §2.11 |
| T5 | CSS 硬编码 `font-size: 15px` | §1.2 |
| T6 | 非浮层投影 `shadow-sm` / `shadow-[…]`；引用不存在的 elevation 档位 | §8 |
| T7 | 调色板直用颜色 `bg-slate-100` 等未走语义 Token 的类名；§17.5 手写 `from-… via-… to-…` 渐变类由同一调色板直用检测覆盖，单一出口为 `ds-text-gradient-brand` | §2.1 / §17.5 |
| T8 | 裸色值 `#hex` / `rgba()`（Token 定义处与 SVG 图形除外） | §2.1 / §17.1 |
| T9 | 行高覆盖 `leading-*`（`leading-[var(--…)]` 放行） | §1.2 |
| T10 | 任意圆角 `rounded-[3px]`（`rounded-[inherit]` / `rounded-[var(--…)]` 放行） | §5 |
| T11 | 未登记动效节奏 `duration-N` / `duration-[…]` / `ease-[cubic-bezier(…)]`（同行出现 `animate-in` / `animate-out` 时放行，见 §9.5） | §9.1 / §9.5 |
| T12 | 字距类 `tracking-*`（`tracking-normal` 放行） | §1.2 |
| T13 | 透明度冒充文字层级 `text-foreground/NN` → `text-fg-secondary` / `text-fg-tertiary` | §2.4 |
| T14 | 透明度凑悬停 `hover:bg-{primary\|secondary\|destructive\|success}/NN` → `*-hover` | §2.2 |
| T15 | 透明度凑浅底 `bg-{success\|warning\|info}/NN` → `*-soft`；`bg-{primary\|destructive}/NN` → `*-subtle`；**只管 ≤20%** | §2.2 |
| T16 | 低于最小字号（全站可见文本下限 12px，布局不够用改布局不许缩字号） | §1.2 |
| T17 | 任意间距 `p-` / `m-` / `gap-[…]`（间距阶梯就是 4px 单位，就近取整档） | §6.1 |

> T13–T15 是 2026-10-29 补的拦截面。此前 §25 虽然把它们写进了禁止事项，
> `-soft` / `-subtle` Token 也早就有了，但**没有任何检查会拦** —— 于是全库攒了
> 92 处无人发现的违规。这正是「文档写了 ≠ 规则被执行」的代价。
> T15 刻意**只拦 ≤20%**：`/70`、`/90` 那类高透明度是有意的半透明实心填充，
> 换成 `-soft` 会直接改变观感，那是另一种写法，不是欠债。
>
> T16 的依据是 §1.2（旧 2.0 的第 12.15 节已废止，脚本注释已同步）。

### 守卫测试

`web/src/design-system/__tests__/spec-guards.test.ts` 补齐硬规则的静态守卫：

| 守卫 | 拦截内容 |
|---|---|
| `body baseline` | `<p>` / `Card` / `DialogContent` / `SheetContent` 上出现 `text-base` |
| `card summary value` | 卡片 / 区块标题同行的汇总值（`总计`、`共 N 条`）不得用 12px |
| `icon library` | `@hugeicons/*`、`@heroicons/*`、`react-icons/*` 的 import |
| `icon geometry` | 图标尺寸档位 16/18/24/32/48、描边恒 2、默认档 18px、禁用数值 `size={N}`、颜色跟随父级文字色 |
| `brand color source` | 组件里出现品牌色字面值 |
| `markdown prose ladder` | Markdown 标题须比界面低一到两档（h1=20 / h2=18 / h3=16 / h4=14，见 §1.8） |
| `focus indicator` | 焦点环满足 §15.1 / §28 `a11y.focusRing`（宽度 / offset / 满色 / 无 alpha） |

另有 `control-typography.test.ts`（控件与说明文字下限，§1.14）与
`sidebar-active-guard.test.ts`（导航选中态，§14.3）。

### 门禁边界与例外

`check-design-tokens.mjs` **只扫 `web/src`**；docs-web 与其它独立构建不在扫描范围内，
改那边时只能靠规范与实机核对，不得指望门禁兜底。

例外必须写进对应脚本的 `ALLOWLIST` 并给出理由，同时按 §26 登记编号；**B 类验收
口径例外（E28）不进 `ALLOWLIST`**。基线机制（`bun run lint:design:baseline`）只
拦新增违规，CI 跑的仍是 `--strict`；把 CI 切到 `--baseline` 属于放宽门禁，需要
项目负责人批准，不得自行切换。

> ⚠️ **静态检查只能确定「某个值是否来自批准的 Token」，不能确定「页面看起来对不对」。**
> 视觉差异不一定是缺陷，截图一致也不意味着交互与无障碍合格（§18.4 / §21.4）。

> **2.0 章节号映射已统一**（2026-11-13）：`web/scripts/check-design-tokens.mjs`
> 的注释已按 3.0 重写 —— `§1.5`（投影 / 辉光）→ §8，`§1.6`（动效时长）→ §9，
> `§11.3`（透明度冒充文字层级）→ §2.4，`§24`（基线机制 / 只减不增）→ §19.5。
> 规则判定本身从未依赖这些章节号；其它文件若再出现 2.0 的 `§1.5/§1.6/§24`
> 引用，一律按本表回指 3.0，不得另立口径。

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

本章节是 AI 助手的强制执行规则。

## 21.0 四层强制执行模型

规范要能被 AI 助手长期遵守，靠的不是把文档写得更长，也不是反复强调「必须遵守」，而是
**让违反规范的代码无法轻易通过检查**。四层缺一不可：

| 层 | 负责什么 | 本项目的落点 |
|---|---|---|
| **① 唯一规范源** | Token、组件规范、交互规则、响应式规则 | `web/src/design-system/tokens/`、`web/src/styles/theme.css`、本文件 §1–§27 |
| **② 代码层强制** | Token 三层、组件库、语义化 API、禁止硬编码 | `tokens/` 三层 Token、`components/ui/` 组件库、T1–T17 静态规则（§19.5） |
| **③ 自动化检查** | 静态检查、组件测试、视觉回归 | `check-design-tokens.mjs` + 守卫测试 + `bun run test:visual`（核查页双视口；真实业务页面未覆盖） |
| **④ AI 交付验收** | 生成 → 检查 → 截图 → 修复 → 交付 | `AGENTS.md` 协议 + §22 验收清单 + §21.5 修改报告 |

**核心原则：不要依赖 AI 自觉遵守规范，而要让违反规范的代码无法轻易通过检查。**

提示词负责指导，代码架构和测试才负责约束。`AGENTS.md` 里写一百遍「必须用 Token」，
不如一条 `check-design-tokens.mjs --strict` 在 CI 里阻断合并。

值的**声明**唯一来源是本规范 §28 `TOKEN-MANIFEST`，值的**运行**唯一来源是
`tokens/` 与 `styles/theme.css` 的 CSS，禁止写法的**可执行清单**唯一来源是
`check-design-tokens.mjs` 的 T1–T17 加守卫测试（§28.1 三层唯一）。规则与边界由
§1–§27 定义。声明改了而运行真源没改，页面不会变；运行真源改了而声明没改，
展示页会显示过期值 —— **两者必须同提交，并由 §28.3 校验强制同值**。

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
- 最小字号 / PC 正文基准 / H5 输入下限按 §1.2、§1.7 与 §28 `meta`（数值不在此复述）。
- 圆角遵循统一规范。
- 间距遵循 4px 网格。
- Density 仅影响允许的布局属性。
- 图标遵循统一尺寸。
- Focus Ring 须满足 §15.1 / §28 `a11y.focusRing`，不得删除。
- 状态不能只靠颜色表达。
- 不得新增未经批准的品牌色。
- 不得随意使用 Shadow。
- 必须支持 Reduced Motion。
- 必须通过自动化检查。

## 21.3 AI 禁止行为

AI 助手不得：

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

不得将未执行的测试标记为通过（§19.4）。

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
- [ ] 11 个字号主档 + 7 个配套档完整。
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
- [ ] 圆角九档完整（含 3xl 18px / 4xl 20px）。
- [ ] 间距体系完整。
- [ ] Density 三档完整。
- [ ] 五档 Shadow 完整。
- [ ] Brand Glow 独立。
- [ ] 动效 Token 完整。
- [ ] 图标五档完整。
- [ ] §28 `TOKEN-MANIFEST` 与代码 Token 逐值一致（`sync-design-showcase.mjs --check`）。

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

- [ ] 普通文字对比度符合 AA（§26.2 B 类 E28 的首屏渐变标题按 §17.5 锚定值验收，不套本项）。
- [ ] 大号文字对比度符合 AA（E28 同上，不套本项）。
- [ ] §26.4 E24 残留缺陷已复测：浅色折扣 5.02:1 达标；浅色溢价 3.76:1、深色折扣 3.30:1 仍低于 4.5:1，须保持「待修」状态，不得因编号注销而勾选通过。
- [ ] 必要组件边界对比度符合 AA。
- [ ] 焦点环满足 §15.1 / §28 `a11y.focusRing`，Light / Dark 均可见。
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
- [ ] 展示页读取 §28 `TOKEN-MANIFEST`，且无硬编码 Token 副本（强制点 = §28.3 校验）。
- [ ] 对比度计算真实有效。
- [ ] B 类语义判据人工核查：无 `chart-N` 表达成功 / 失败（§2.8）；密度档未缩放 `--text-*`（§7.2）。
- [ ] 自动化测试通过。
- [ ] 构建通过。
- [ ] 视觉回归完成。
- [ ] 变更报告完整。

---

# 23. Implementation Order 实施顺序与交付要求

AI 助手必须按以下顺序执行，不得只完成文档或展示页就宣称实施完成。

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

未完成清单（按 §24 保持 Pending，不得标记为通过）：

- `PageHeader`（§13.1）—— 尚无独立组件，页面暂按 §3 + §6 组合。
- 字体轴 `data-theme-font` 三档（§17.7）—— 尚未落地。
- Terminal ANSI 0–15 全色板（§2.10）—— 尚未落地。

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

完成 §18.2 登记的全部 **24 个展示区域**（22 个原有 + 断点 + Token 分层）。

所有展示内容必须读取 §28 `TOKEN-MANIFEST`，不得在展示页内保存 Token 副本；
`showcase.html` 由 §28.2 的数据链驱动。

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

9–11 项属**待交付物**：当前 `docs/design-system/` 下只有规范、展示页与 `audit/`，
`audit/evidence/` 引用的截图文件尚未生成。按 §24「未通过或未执行必须如实记录」，
这些项保持 **Pending**，不得因文件存在就声称已交付。

---

# 24. 最终执行指令

**AI 助手：从现在开始，将本文件《UTER Design System 3.0》作为 Uter 项目的唯一、完整、强制性设计实施标准。**

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
12. 不得降低标准或删除测试（唯一条款见 §19.4）。
13. 未通过或未执行的项目必须如实记录。
14. 最终提交文件变更清单、测试证据、视觉验收结果和剩余风险。

**验收标准：**

只有当设计 Token、组件、业务页面、Light / Dark、H5、无障碍、展示页和自动化质量门禁全部完成，并且所有必须通过的检查均有实际证据时，才能将 UTER Design System 3.0 标记为实施完成。

本规范中的候选色值必须经过实际对比度验证；未验证项目保持 Pending，不得虚报通过。

任何未来设计变更，都必须**先更新本规范 §28 `TOKEN-MANIFEST`（规则 / 边界变更则先改
§1–§27）**，再按 §28.2 同步运行真源、投影表与展示页，三者同提交。不得通过在业务
代码中私自增加样式绕开设计系统，也不得先改 CSS 再倒推文档（§27.3 / §28.2）。
静态扫描的基线机制与例外登记以 §19.5 为准，本条不另立口径。

§25（禁止事项总表）、§26（例外登记）、§27（想改某个值时）是本章执行指令的配套台账与变更流程，同属本规范的强制组成部分，不是附录或建议。

**本文件是 Uter 唯一设计实施标准。**

---

# 25. 禁止事项总表

本节是全站**禁止写法**的人类可读索引；**拦截规则的唯一权威是 §19.5 的 T1–T17
规则表**，改一处必须同步两表，不得各自扩写。规则正文仍在各章，取值见 §28。

强制点分两类：A 类写法由 `web/scripts/check-design-tokens.mjs` 或
`web/src/design-system/__tests__/spec-guards.test.ts` 静态拦截；B 类语义判据
（「用 `chart-N` 表达成功 / 失败」「密度档缩放 `--text-*`」）无法静态判定，
其强制点在 §22.5 的人工验收清单逐项核查，属**登记在案的 B 类**，不是无强制点条款。

| 类别 | 禁止 | 替代 | 依据 |
|---|---|---|---|
| 字号 | `text-[15px]`、`text-[0.9em]`、`text-[1.75rem]` | 换 §1.2 的 11 主档 / 7 配套档 | §1.2 |
| 字号下限 | 常规 UI 文本 < 12px（含 10–11px） | `text-xs` 12px 起；数值 14px 起 | §1.2 / §1.6 |
| 行高 | `leading-[26px]`、任何 `leading-*` 工具类 | 换档位；`leading-[var(--ds-line-mono-dense)]` 放行 | §1.2 / §1.5 |
| 内联字号 | `style={{ fontSize: 13 }}` | 语义组件 | §1.2 / §2.11 / T4 |
| 字体族 | 在 `font-mono` 旁再叠 `text-sm` / `text-xs` | Mono 四档 | §1.5 |
| 标题层级 | `Heading variant='card-title'` 叠 `font-mono text-mono` | `variant='mono-title'` | §1.5 / §13.1 |
| 页面标题 | 自写 `<h1 className='text-4xl font-bold'>` | `Heading variant='page-title'` | §13.1 |
| 正文 16px | 拿 `text-lg` 当默认正文 | `body`（14px）或 `body-long`（16/26） | §1.3 |
| 汇总值 12px | 卡片标题旁「总计 / 共 N 条」用 `text-xs` | 14px 档 | §13.4 |
| 控件 12px | 管理端控件 / `<p>` 上出现 `text-xs` | 14px 起 | §1.14 |
| 标题 14px | `text-sm font-semibold` 冒充卡片 / 区块 / 分组标题 | 30 / 24 / 18 / 16 四层 | §1.3 / §3 |
| 色值 | 组件里写死色值、`text-[#333]` | 语义 Token | §2.1 / §17.1 |
| 透明度凑层级 | `text-foreground/60`、`hover:bg-primary/90` | `text-fg-secondary` / `*-hover` Token | §2.4 |
| 投影 | `shadow-sm` / `shadow-lg` / `shadow-[…]` | `--ds-elevation-*` | §8 |
| 圆角 | `rounded-[3px]`（`rounded-[inherit]` 除外） | 圆角九档（§5 / §28） | §5 |
| 动效 | `duration-300`、`ease-out`、`1.8s` | `--ds-motion-*` | §9 / §9.5 |
| 图标库 | `@hugeicons/*`、`@heroicons/*`、`react-icons/*` | `lucide-react` | §12.3 |
| 图标描边 | 调用点写 `strokeWidth`，或取值不是 2 | 由 `IconProvider` 注入 | §12.3 |
| 图标尺寸 | 五档之外的 20 / 22 / 28 / 36 / 40 | 16 / 18 / 24 / 32 / 48 | §12.3 |
| 焦点环 | `outline: none` 无替代、焦点环宽度不是 2px（`ring-1` / `ring-3` 及以上）、带 alpha 的焦点色 | §28 `a11y.focusRing` | §15.1 |
| 触控目标 | 小于 24×24 且无 `.ds-touch-target` | `.ds-touch-target` | §15.3 |
| 颜色语义 | 用 `chart-N` 表达成功 / 失败 | `{status}` Token | §2.8 |
| 输入字号 | **H5 表单输入低于 16px** | 表单输入默认至少 16px（iOS 防放大），H5 常规正文仍 14px | §1.7 / §16.3 |
| 密度 | 密度档缩放 `--text-*` | 密度只改间距；放大文字走 Simple Large-font 预设 | §7.2 / §1.9 |
| 品牌渐变 | 组件手写 `from-… via-… to-…`、`:root.dark` 覆盖第二套值 | 单一出口 `ds-text-gradient-brand` | §17.5 / T7 |
| 字号重复声明 | `--text-*` 出现在 `tokens/typography.css` 之外 | 只在 `@theme` 声明一次 | §1.2 / T1 |
| CSS 硬编码字号 | `font-size: 15px` | 换 `--text-*` | §1.2 / T5 |
| 字距 | `tracking-*` | 删除，靠字号 / 字重建层级 | §1.2 / T12 |
| 浅底透明度 | `bg-{success\|warning\|info}/NN`（≤20%） | `*-soft` / `*-subtle` | §2.7 / T15 |
| 任意间距 | `p-[3px]` / `gap-[2px]` | 就近取整档 / 0.5 半档 | §6.1 / T17 |

> **输入字号的 3.0 口径**：旧 1.x / 2.0 写的是「全平台 14px」，3.0 §1.7 已改为
> **H5 表单输入默认至少 16px**，理由见 §1.7。任何外围文档若仍写「no H5 16px
> exception」，以本节与 §1.7 为准。

---

# 26. 例外登记

规范的价值取决于「例外是否被记录」。凡是无法接入 Token 的场景，都必须在这里登记
**理由、影响范围、退出条件**。代码侧的对应登记在
`web/scripts/check-design-tokens.mjs` 的 `ALLOWLIST` —— **两处必须同步，只改一处
说明例外已经失控。**

台账分两类，不要混为一谈：

| 类别 | 含义 | 登记位置 | 当前条数 |
|---|---|---|---|
| A 类 · 静态扫描例外 | 业务代码里确实无法用 Token 表达的写法 | 本文件编号 + 脚本 `ALLOWLIST` | **0** |
| B 类 · 验收口径例外 | 规则本身有明确的、经过测量的适用边界 | 本文件编号（不进 `ALLOWLIST`） | **1**（E28） |


## 26.1 判定原则：效果对齐 ≠ 逐类照抄

登记例外前，先回答这两个问题，顺序不能反：

| 问题 | 答「是」意味着什么 |
|---|---|
| ① 这个**效果**能不能被 Token 表达？ | 能 → **不许登记例外**。把它定档成 Token / 条款，改代码去满足它（例：§17.5） |
| ② 表达不了，是规范缺条款还是真做不到？ | 缺条款 → **补条款**，不是补例外；真做不到 → 才轮到 `ALLOWLIST` |

一句话：**「要和某某长得一样」永远不是登记例外的理由，「这个效果无法被 Token
表达」才是。** 前者是个目标，后者是个证明。把前者当理由，等于把规范的缺口固化成
永久豁免 —— 这正是 E25 / E26 / E27 曾经的样子。

## 26.2 台账现状与通过口径

**A 类：0 条例外（2026-10-30 清理后保持）。** 原先的 E25 / E26 / E27 三条
（首屏渐变 + hero 终端代码卡 + CTA 渐变）已于 2026-10-30 全部注销 —— 它们的理由
都是「须与上游 new-api 逐类一致，无法用 Token 表达」，而这个理由不成立：要求只是
**渲染效果与上游一致**，不是类名照抄。把效果落成 `term-*` 语义组与
`ds-text-gradient-brand` 之后，效果一分未变，三条豁免同时消失。

**B 类：E28 一条（2026-11-13 登记）。**

| 编号 | 内容 | 理由 | 影响范围 | 退出条件 |
|---|---|---|---|---|
| E28 | 首屏品牌渐变标题不套普通文本 4.5:1 / 大文本 3:1 | 装饰性大号标题，是对外传播的品牌资产；逐值锚定上游 new-api 蓝紫三档，改深即改变品牌观感 | hero / CTA 的 `.ds-text-gradient-brand`，浅色 from 2.54:1、via 2.72:1、to 3.96:1（§17.5 已登记实测值） | 上游 new-api 改了这三档值，或该渐变被移出装饰性标题场景；届时按 §17.5 重算并注销本条 |

E28 **不进 `ALLOWLIST`**：渐变色值本来就声明在 `tokens/colors.css`（颜色的所有者），
静态扫描对此合法；它豁免的是**对比度验收口径**，不是写法。因此
`node web/scripts/check-design-tokens.mjs --strict` 的 A 类计数仍应为 0。

门禁 `node web/scripts/check-design-tokens.mjs --strict`（仓库根执行）的通过口径：

| 计数项 | 含义 | 是否违规 |
|---|---|---|
| 违规（violations） | 落在业务代码里、没有 Token 表达的写法 | **是** |
| 浮层投影 | 弹窗 / 抽屉 / 下拉 / 悬浮输入舱的投影，明确允许 | 否 |
| Token 定义处色值 | 调色板、品牌色、SVG 图形本身就该写色值 | 否 |
| 已登记 A 类例外 | `ALLOWLIST` 里逐条写了理由的真例外 | **0** |

登录 / 注册页**不**是字号例外界面，须遵循全局 14px 正文刻度（§1.2 / §1.3）。
旧版此处写的「另见 D7」在 A / B 两类台账里均不存在，属悬空引用，本轮改为直接陈述；
该约束不是例外，因此**不占用任何 E 编号**。

## 26.3 四类「看起来像例外、其实不是」

写新代码前先对照这四类，绝大多数「需要例外」的直觉都落在这里：

| 类别 | 例子 | 为什么不算例外 |
|---|---|---|
| 规范条款 | 多行主标题 1.5 行高、Markdown prose 阶梯、营销动效 300/500ms | 规范已给出取值，只是条款在别的章节里（§1.10 / §1.8 / §9.3） |
| Token 的落点 | `tokens/*.css` 里的色值、`brand-colors.ts` 的商标色、SVG 图形 | 它们是**颜色的所有者**，本来就该写值 |
| 结构性 escape hatch | `rounded-[inherit]`、`leading-[var(--ds-line-mono-dense)]` | 门禁直接识别为合法写法，不占 `ALLOWLIST` 条目 |
| 效果锚定的 Token | `term-*` 语义组、`ds-text-gradient-brand` | 只对「效果」负责，效果达到就写 Token，不需要例外（§17.5） |

## 26.4 E 编号台账（已升格为规范条款，编号注销）

以下编号**不再有效**。表中「现在在哪」指向 3.0 的正式条款，写代码时按那里执行。
旧 2.0 的章节号已全部重映射为 3.0 编号。

| 编号 | 原例外 | 现在在哪（3.0） |
|---|---|---|
| E2 | 密集等宽的行高用 22px | §1.5「mono 密集行高」→ `--ds-line-mono-dense` |
| E3 | 行内代码随正文 | §1.5 / §28 → `text-mono`（mono-sm）13/20 |
| E4 | 图表 canvas 字号写数字 | §2.11 → `design-system/tokens/chart-typography.ts` |
| E5 | 客服挂件内联字号 | §1.2 → `var(--ds-text-*)` / `var(--ds-line-*)` |
| E6 | 错误页 `text-[7rem]` | §1.2 → 阶梯最高档 `text-5xl` 36/600/44 |
| E7 | 多行主标题行高 1.5 | §1.10 → `--ds-line-display-multiline` |
| E8 | 移动端全屏菜单 16/24 | §1.11 → `text-base font-medium` |
| E9 | 拖拽演示 `shadow-lg` | §8 → `--ds-elevation-raised` |
| E10 | hero 终端投影 + 状态点辉光 | §8 / §17.5 → `--ds-elevation-marketing` + `--ds-glow-online` |
| E11 | 预设里的第二处字号阶梯 | §1.9 → `tokens/typography.css` 唯一来源 |
| E12 | 首页代码卡片 13px | §1.5 → `mono-sm` 13/20 |
| E13 | 多行按钮 / 卡片式选项按钮不受高度档约束 | §10.2 → `button-wrap` 档 + `min-h` 三档 |
| E14 | Markdown 标题自成一套 | §1.8 / §28 → 20/18/16/14/14/12 |
| E15 | 链接式文字按钮用 `h-auto` | §10.2 → `button-inline` 档 |
| E16 | 残留原生 `<button>` / `<input>` | §13.2 → 六类边界 |
| E17 | 营销页动效节奏 300–500ms | §9.3 → `--ds-motion-marketing-*` |
| E18 | 非交互动效不受 100/200ms 约束 | §9.1 / §9.3 → `ds-motion-enter` / `ds-motion-loop-*` / `ds-motion-data*` |
| E19 | 营销页内容区宽度 1800px | §16.2 → `--ds-content-max-wide` + `max-w-container-wide` |
| E20 | 装饰性描边不是 1px | §4.2 → 镂空环 / 图形描边两类，禁止小数值 |
| E21 | 结构性圆角的任意值 | §5 → 只剩 `rounded-[inherit]`，门禁直接放行 |
| E22 | 账户安全 / 偏好设置行标题 16/600 | §1.3 → 行标题恒 16/500，600 只给 `group-title` |
| E23 | 固定尺寸容器内的图标小于 16px | §12.3 → `SMALL_GLYPH_ALLOW` 白名单 |
| E24 | 折扣 / 溢价角标实心填充，部分组合低于 AA | §2.7 / §15.2 → 条款已定档（浅色折扣 5.02:1 ✅）。**残留缺陷**：浅色溢价 3.76:1、深色折扣 3.30:1 仍低于 4.5:1，作为待修缺陷登记在 §22.3 无障碍验收清单（本轮已补勾选条目），不因编号注销而视为已解决 |
| E25 | 首屏渐变标题的上游调色板直用色 | §17.5 → `ds-text-gradient-brand` + `--ds-color-brand-gradient-{from,via,to}` |
| E26 | hero 终端代码卡多色配色 + 状态点辉光 + `text-foreground/NN` | §17.5 → `term-*` 语义组 / `term-dim-1…4` / `term-accent-*` / `--ds-glow-online` |
| E27 | CTA 副标题的上游渐变 | §17.5 → 与 E25 同一个 `ds-text-gradient-brand` |

> 这一轮的关键转变：**上一版把 12 条「规范没覆盖到的空白」当成了例外**。它们其实
> 不是「代码没接 Token」，而是**规范本身缺条款** —— 把空白登记成例外，等于把规范的
> 缺口永久固化成豁免。正确做法是把每一条都**定档成规范条款**（给出取值、判据、
> 约束），然后改代码去满足它。3.0 合并成单文件时漏搬了 §1.8–§1.12、§2.11、
> §9.5、§12.3、§13.1–§13.2、§17.6–§17.7，本轮已补齐，见各节。

## 26.5 新增例外的流程

1. **先过一遍 §26.1 的判定原则** —— 「要和上游 / 某某长得一样」不构成理由。
2. **确认没有现存 Token 能表达**，也不能新增 Token 表达。能新增就该新增，
   而不是登记例外。
3. 写清三件事：**理由**（为什么不能接入 Token）、**影响范围**（文件 / 组件）、
   **退出条件**（什么情况下可以取消这条例外）。
4. **两处同步**：本文件登记编号 + `web/scripts/check-design-tokens.mjs` 的
   `ALLOWLIST` 加条目并写明理由（B 类例外只登记本文件，不进 `ALLOWLIST`）。
5. 跑 `node web/scripts/check-design-tokens.mjs --strict` 确认计数符合预期。
6. 按 §24 / §28.2 的顺序执行：**规则 / 边界先改本文件；取值先改 §28 `TOKEN-MANIFEST`**，再同步运行真源与展示页，不得反过来。

---

# 27. 想改某个值时

## 27.1 想加一档字号

**顺序恒为「先改 §28 声明 → 跑同步脚本 → 按报告同步运行真源与投影表」**（§28.2），
不得先改 CSS 再倒推文档：

1. 先确认现有 11 主档 + 7 配套档真的覆盖不了（绝大多数情况是覆盖得了的）；
2. **只改** §28 `TOKEN-MANIFEST` 的 `typography.mainScale` / `companions`
   （唯一改值入口）；
3. 跑 `node web/scripts/sync-design-showcase.mjs`，按报告同步：
   `design-system/tokens/typography.css` 的 `@theme --text-*` 与
   `--text-*--line-height`、`design-system/tokens/semantic.css` 的
   `--ds-text-*` / `--ds-line-*`、`__tests__/tokens.test.ts` 的 `LADDER`；
4. 同步本文件 §1.2 投影表，再跑 `--check` 确认全绿，复核 `showcase.html`。

（`--text-*` 是字号命名空间，文字颜色请用 `--fg-*`。）
只做第 3 步的 CSS 部分而不做其余步骤，等于又开了一套平行标准。

## 27.2 改一个既有值时的同步清单

**本表不是「改哪里」，而是「改完 §28 之后还要同步哪些文件」**。唯一改值入口恒为
§28 `TOKEN-MANIFEST` 的对应字段（§27.3 / §28.2）；下表第一列给出该字段，
后两列是 `--check` 报告会列出的运行真源与投影表。所有路径相对 `web/src/`，
`web/scripts/…` 例外（相对仓库根）。

| 目标 | Manifest 字段（唯一改值入口） | 需要同步的运行真源 / 投影表 |
|---|---|---|
| 全站正文字号 / 行高 | `typography.mainScale` | `design-system/tokens/typography.css` 的 `@theme`；§1.2 表；`__tests__/tokens.test.ts` 的 `LADDER` |
| 品牌色 | `colors.brand` | `design-system/source/brand.tokens.json` + 生成 `brand.css`；§2.2 表；跑 `spec-guards` |
| 控件 / 按钮高度 | `density.params` | `design-system/tokens/spacing.css` 密度档；§7.1 / §10.2 / §11.1 表；检查 `button.tsx` / `input.tsx` 引用 Token |
| 圆角 | `radius.scale` + `meta.baseRadius` | `design-system/tokens/primitives.css`；`styles/theme.css` 的 `--radius`；§5 表 |
| 投影档位 | `shadow` | `design-system/tokens/elevation.css` + 门禁 `ELEVATION_TOKENS`；§8 表 |
| 动效时长 / 缓动 | `motion` | `design-system/tokens/elevation.css`；§9.1 / §9.2 / §9.5 表 |
| 文字色 | `colors.text` | `styles/theme.css` 的 `--fg-*`（`.dark` 也要给）；§2.4 表 |
| 首屏演示色 | `colors.terminal` | `styles/theme.css` 的 `--term-*`（`.dark` 也要给）；§2.10 表 + 重算对比度 |
| 首屏品牌渐变 | `colors.gradient` | `design-system/tokens/colors.css` 的 `--ds-color-brand-gradient-*`；§17.5 投影表 + `web/scripts/verify-contrast.mjs` 锚定值；深浅同值，禁止 `:root.dark` 覆盖 |
| 首屏装饰层 | `colors.decoration`（当前未纳入，见 §28.6） | `styles/theme.css` 的 `--ds-decor-glow-*` / `--ds-decor-mesh-opacity-*`、`design-system/foundations/decoration.css` 的 `ds-decor-*`；§17.5 表 |
| 静态扫描规则 | （规则，不属于值） | `web/scripts/check-design-tokens.mjs`；§19.5 的 T1–T17 表与 §25 |
| 例外 | （规则，不属于值） | 本文件 §26 + `web/scripts/check-design-tokens.mjs` 的 `ALLOWLIST`，两处同步 |

改完任一字段按 §27.3 的四步执行；**禁止**先改 CSS / 展示页再倒推文档。

## 27.3 改 §28 TOKEN-MANIFEST 中的值

1. 只改 `TOKEN-MANIFEST` 里对应字段，**不要**顺手改 §1–§17 的表格或 `showcase.html`。
2. 跑 `node web/scripts/sync-design-showcase.mjs`，它会：重新生成 `showcase.tokens.js`
   离线快照、校验运行真源与声明同值、列出需要同步的投影表与 CSS 文件。
3. 按报告同步运行真源（CSS Token）与投影表，再跑一次 `--check` 确认全绿。
4. 打开 `showcase.html` 复核受影响区域（HTTP 打开时刷新即生效）。

## 27.4 判断标准

最重要的判断标准是：**以后如果你要把 UTER 全站常规正文行高从 22px 改成 24px，
或者调整所有按钮的默认高度，应该主要修改一处设计 Token 或组件规则，而不是逐个
修改几十个页面。**

这才是设计规范从「文档」变成「代码架构」的关键。
---

# 28. Token Manifest 机器可读值声明（唯一声明源）

本章解决 3.0 早期版本的三个结构性问题：① 同一组数值在 §1/§3/§5/§7/§10/§11/§13/§14
被反复抄写，改一处漏一处；② 展示页自带一份硬编码 `:root`，形成第二真源；③ 规范文档
本身不是机器可读的，任何工具都无法从「值」派生视图。

## 28.1 效力

- **下方 `TOKEN-MANIFEST` 代码块是本文档内所有设计值的唯一声明源（Spec SSOT）。**
  §1–§17 的表格是它的**人类可读投影**，只允许引用，不允许单独改值；投影与声明不一致时
  以本代码块为准，并按 §28.3 修复投影。
- `web/src/design-system/tokens/` 与 `web/src/styles/theme.css` 是**运行真源**（Runtime
  SSOT），负责浏览器实际渲染。声明源与运行真源由 §28.3 的一致性校验强制同值。
- `docs/design-system/showcase.html` 是**纯消费者**：它不保存任何色值、字号、尺寸常量，
  运行时读取本代码块并据此渲染。改这里的值 → 展示页随之变化（§28.2）。
  `:root` 中仅允许一组刻意偏离所有刻度的降级可读性占位，由 §28.3 ⑥ 拦截同值副本。
- 规则、边界、禁止写法仍由 §1–§27 定义；本代码块只声明**值**，不定义规则。

三层唯一（与 §0.1、§17.6、§21.0、§24 一致，不得再出现第四种口径）：

| 层 | 唯一拥有 | 位置 |
|---|---|---|
| 值 · 声明 | 设计值的规范声明 | 本章 `TOKEN-MANIFEST` |
| 值 · 运行 | 浏览器实际生效值 | `web/src/design-system/tokens/`、`web/src/styles/theme.css` |
| 规则与边界 | 什么写法被允许 / 禁止 | §1–§27（可执行清单 = §19.5 T1–T17 + §25） |

`meta` 与 `a11y` 中的少量数值（如 `focusRingWidth` / `focusRing.width`、
`baseRadius` / `radius.base`、`minFontSize` / `mainScale[0].size`、
`touchTargetMin` / `a11y.touchTarget.minimum`、`contentMax` / `breakpoints.xl`）
是**同值派生索引**，不是第二份声明：它们必须与主字段相等，由 §28.3 的
「声明内部一致性」校验强制拦截漂移，禁止单独改其中一处。

## 28.2 数据链与「改一个值」

```
UTER-DESIGN-SYSTEM-3.0.md §28 TOKEN-MANIFEST   ← 唯一改值入口
   ├─→ showcase.html（HTTP 打开时运行时 fetch 本文件，刷新即生效）
   ├─→ showcase.html 页内内联快照（file:// 单文件独立生效，§28.4 同步脚本生成）
   ├─→ showcase.tokens.js（旧版兼容回退，同一脚本同步生成）
   ├─→ 投影一致性校验（§28.3，检查 §1–§17 表格与声明是否同值）
   └─→ 运行真源一致性校验（§28.3，检查 CSS Token 与声明是否同值）
```

改值流程：① 只改 §28 `TOKEN-MANIFEST` 中对应字段 → ② 运行
`node web/scripts/sync-design-showcase.mjs`（重新生成页内内联快照与兼容回退文件、
校验两层真源、报告需要同步的投影表与代码文件）→ ③ 按报告同步运行真源与投影表
→ ④ 复核 `showcase.html`（**离线打开同样生效，无需启动 HTTP 服务**）。
**禁止**先改 `showcase.html` 或先改 CSS 再倒推文档（§24 / §27.3）。

## 28.3 一致性校验

`node web/scripts/sync-design-showcase.mjs --check` 为只校验、不写文件模式。
**前置**：Manifest 可提取、为合法 JSON、含 `spec` / `version`；失败即 `BLOCKED`
（退出码 2），不进入下表。前置通过后脚本固定输出 **7 类共 17 条 `record()`**
（下表「点数」列合计必须为 17）；文档与脚本必须逐项对齐，新增检查点须同步改写本节。

| 类别 | 校验内容 | 点数 |
|---|---|---:|
| ① 字号 / 圆角运行真源 | 字号全档（11 主档 + 7 配套档 + Mono，按类名去重后 18 档）与 `typography.css` 的 `@theme --text-*` 逐值相等；圆角九档与 `primitives.css` 的 `--primitive-radius-*` 逐值相等 | 2 |
| ② 颜色运行真源 | 品牌色 Light + Dark × 8 与 `brand.tokens.json`；文字色 / 表面色 / 边框色与 `theme.css` 的 `:root` / `.dark`（`var()` 派生值跳过静态比对） | 2 |
| ③ 密度运行真源 | 13 项 × 3 档与 `spacing.css` 的三个 `[data-theme-scale]` 档逐值相等 | 1 |
| ④ 投影表 | §1.2 字号、§5 圆角、§7.1 密度，以及 §6.2 语义别名 / §10.2 按钮 / §11.1 控件 / §14.2 导航尺寸取值行与声明一致 | 4 |
| ⑤ 声明内部 | `meta` ↔ `a11y` ↔ `radius` ↔ `typography` 同值派生索引不漂移；`sections` 的 `no` / `id` / `spec` 合法且唯一；`pending` 字段完整且与 §28.6 表格逐项对应；`spacing.semantic.landed` 别名均指向真实 `density.params` 键 | 1 |
| ⑥ 展示页 | 运行时解析 Manifest；`:root` 不含任何 Manifest 声明值（HEX / `oklch` / 缓动 / 时长 / 尺寸数值）；24 区数量与渲染器一一对应；14 组主要声明字段均有展示 | 5 |
| ⑦ 内联 / 离线快照 | `showcase.html` 页内内联快照存在且 Manifest 与 §28 声明逐值相等、`manifestHash` 自洽（保证 `file://` 单文件生效）；`showcase.tokens.js` 兼容回退同值且哈希自洽；任一缺失或过期时退出码 1 | 2 |

任一项 `FAIL` 即视为「规范与实现漂移」，按 §28.2 收敛，不得静默放行。
退出码：`0 = 全部通过`、`1 = 存在漂移`、`2 = 输入缺失（BLOCKED）`。
生成模式（不带 `--check`）在前 15 项全绿时才写快照（页内内联快照 +
`showcase.tokens.js`），并把本次校验摘要写入回退文件的
`META.verification`，供 §18.2 第 24 区展示（§28.4）。

## 28.4 同步脚本

在**仓库根**执行（脚本按自身位置解析路径，任意 cwd 均可）：

```bash
node web/scripts/sync-design-showcase.mjs           # 生成页内内联快照 + showcase.tokens.js
node web/scripts/sync-design-showcase.mjs --check  # 只校验，不写文件（CI / 本地门禁）
```

脚本的值输入只读取本文档的 `TOKEN-MANIFEST` 块；投影表抽查按 **Markdown 表格
单元格**逐值比对（列对齐空格不影响结果），不解析散文措辞，因此改散文或重排
表格都不会破坏它 —— 2026-11-13 前用精确串匹配时，表格一被格式化就误报 4 项
「投影表缺行」，进而拒绝刷新离线快照，`file://` 只能看到旧值。

两份产物（`showcase.html` 的页内内联快照、`showcase.tokens.js` 兼容回退）都是
**派生产物**，不是真源，禁止手工编辑；`--check` 会逐值比对并校验
`manifestHash`，任一漂移即退出码 1。页内内联快照让核查页**单文件双击即生效**，
不需要在 `docs/design-system/` 下起 `python3 -m http.server`（§18.1）。

脚本在生成模式下会把本次校验的 PASS / FAIL 汇总写入回退文件的
`META.verification`，供 §18.2 第 24 区展示（§28.3）。


## 28.5 TOKEN-MANIFEST

<!-- TOKEN-MANIFEST:BEGIN -->
```json
{
  "$schema": "uter://design-system/token-manifest/1",
  "spec": "UTER-DESIGN-SYSTEM-3.0.md",
  "version": "3.0.1",
  "updated": "2026-11-13",
  "meta": {
    "brandPrimary": "#5B5EE6",
    "neutral": "Slate",
    "fontSans": "Inter, Source Han Sans SC, Noto Sans CJK SC",
    "fontMono": "ui-monospace, SFMono-Regular, Menlo, Consolas",
    "baseRadius": 10,
    "minFontSize": 12,
    "bodyBase": 14,
    "h5InputMin": 16,
    "contentMax": 1280,
    "contentMaxWide": 1800,
    "focusRingWidth": 2,
    "focusRingOffset": 0,
    "touchTargetMin": 24,
    "touchTargetRecommended": 44
  },
  "typography": {
    "mainScale": [
      {"class": "text-xs", "size": 12, "line": 18, "weight": 400, "role": "caption / small / 辅助说明、最小标签"},
      {"class": "text-dense", "size": 13, "line": 20, "weight": 400, "role": "密集表格、日志"},
      {"class": "text-sm", "size": 14, "line": 22, "weight": 400, "role": "默认正文 body / body-sm / label"},
      {"class": "text-md", "size": 15, "line": 24, "weight": 400, "role": "次级正文"},
      {"class": "text-base", "size": 16, "line": 24, "weight": 400, "role": "行标题 / 设置字段 / 指标数值（不是正文）"},
      {"class": "text-lg", "size": 18, "line": 26, "weight": 500, "role": "h3 / 卡片及次级标题（标题场景 600）"},
      {"class": "text-xl", "size": 18, "line": 26, "weight": 500, "role": "卡片及次级标题（与 text-lg 同值）"},
      {"class": "text-2xl", "size": 20, "line": 28, "weight": 600, "role": "小型区块标题"},
      {"class": "text-3xl", "size": 24, "line": 32, "weight": 600, "role": "区块标题"},
      {"class": "text-4xl", "size": 30, "line": 38, "weight": 600, "role": "页面标题"},
      {"class": "text-5xl", "size": 36, "line": 44, "weight": 600, "role": "营销展示、特殊大标题 / display"}
    ],
    "companions": [
      {"class": "text-long", "size": 16, "line": 26, "weight": 400, "role": "body-long 长文本"},
      {"class": "text-group", "size": 16, "line": 24, "weight": 600, "role": "group-title 分组标题"},
      {"class": "text-mono-xs", "size": 12, "line": 18, "weight": 400, "role": "mono 小型 ID、标签"},
      {"class": "text-mono", "size": 13, "line": 20, "weight": 400, "role": "mono 正文等宽、表格、日志（规范名 mono-sm）"},
      {"class": "text-mono-code", "size": 13, "line": 20, "weight": 400, "role": "固定高度等宽代码容器"},
      {"class": "text-mono-base", "size": 14, "line": 22, "weight": 400, "role": "mono-base 代码、技术信息"},
      {"class": "text-mono-title", "size": 16, "line": 22, "weight": 600, "role": "mono-title 等宽卡片标题"}
    ],
    "mono": [
      {"token": "mono-xs", "class": "text-mono-xs", "size": 12, "line": 18, "weight": 400, "role": "小型 ID、标签"},
      {"token": "mono-sm", "class": "text-mono", "size": 13, "line": 20, "weight": 400, "role": "表格、日志"},
      {"token": "mono-base", "class": "text-mono-base", "size": 14, "line": 22, "weight": 400, "role": "代码、技术信息"},
      {"token": "mono-title", "class": "text-mono-title", "size": 16, "line": 22, "weight": 600, "role": "等宽卡片标题"}
    ],
    "weights": {"normal": 400, "medium": 500, "semibold": 600, "bold": 700, "boldUsage": "保留但 3.0 UI 不使用；标题一律 600"},
    "hierarchy": [
      {"level": "L1", "role": "page-title", "size": 30, "line": 38, "weight": 600, "class": "text-4xl"},
      {"level": "L2", "role": "section-title", "size": 24, "line": 32, "weight": 600, "class": "text-3xl"},
      {"level": "L3", "role": "card-title", "size": 18, "line": 26, "weight": 600, "class": "text-lg"},
      {"level": "L4", "role": "group-title", "size": 16, "line": 24, "weight": 600, "class": "text-group"}
    ],
    "markdownProse": [
      {"tag": "h1", "class": "text-2xl", "size": 20, "line": 28, "weight": 600},
      {"tag": "h2", "class": "text-lg", "size": 18, "line": 26, "weight": 600},
      {"tag": "h3", "class": "text-base", "size": 16, "line": 24, "weight": 600},
      {"tag": "h4", "class": "text-sm", "size": 14, "line": 22, "weight": 600},
      {"tag": "h5", "class": "text-sm", "size": 14, "line": 22, "weight": 600},
      {"tag": "h6", "class": "text-xs", "size": 12, "line": 18, "weight": 600}
    ],
    "label": {"role": "label", "size": 14, "line": 22, "weight": 500, "class": "text-sm + font-medium"},
    "bodySmall": {"role": "body-sm", "size": 14, "line": 22, "weight": 400, "note": "与 body 同值同重，不是独立字号档"}
  },
  "colors": {
    "brand": {
      "light": {
        "primary": "#5B5EE6", "hover": "#4F52D1", "active": "#4A4DC5",
        "foreground": "#FFFFFF", "soft": "#F0F0FF", "softForeground": "#5558D8",
        "border": "#D9DAFF", "subtle": "#FAFBFC"
      },
      "dark": {
        "primary": "#A1A3F7", "hover": "#B1B3FF", "active": "#9294F7",
        "foreground": "#020617", "soft": "#25264A", "softForeground": "#B1B3FF",
        "border": "#45466F", "subtle": "#0F172A"
      },
      "disabled": "不单独定义品牌色 Token；走 §2.4 foreground-disabled + 组件 disabled: 变体"
    },
    "text": {
      "light": {
        "foreground": "#0F172A", "secondary": "#334155", "tertiary": "#64748B",
        "disabled": "#94A3B8", "inverse": "#FFFFFF", "placeholder": "#64748B", "link": "#5558D8"
      },
      "dark": {
        "foreground": "#F8FAFC", "secondary": "#CBD5E1", "tertiary": "#94A3B8",
        "disabled": "#64748B", "inverse": "#0F172A", "placeholder": "#94A3B8", "link": "#A1A3F7"
      },
      "aliases": {
        "--ds-color-text-primary": "foreground / --foreground",
        "--ds-color-text-secondary": "foreground-secondary / --muted-foreground / text-muted-foreground",
        "--ds-color-text-disabled": "foreground-disabled",
        "--ds-color-text-on-emphasis": "text-primary-foreground / brand-foreground (#FFFFFF)"
      }
    },
    "surface": {
      "light": {"background": "#FFFFFF", "card": "#FFFFFF", "popover": "#FFFFFF", "muted": "#F1F5F9", "secondary": "#F1F5F9", "subtle": "#FAFBFC"},
      "dark": {"background": "#020617", "card": "#020617", "popover": "#020617", "muted": "#1E293B", "secondary": "#1E293B", "subtle": "#111C30"},
      "fixed": {"overlay": "#000000", "pure": "#FFFFFF"}
    },
    "border": {
      "light": {"border": "#E2E8F0", "borderStrong": "#CBD5E1", "inputBorder": "#D1D5E5"},
      "dark": {"border": "#334155", "borderStrong": "#475569", "inputBorder": "#45465F"}
    },
    "status": {
      "light": {
        "success": "#16a34a", "successForeground": "#f8fafc", "successSoft": "oklch(0.979 0.021 166)", "successSoftForeground": "oklch(0.391 0.094 167)",
        "warning": "oklch(0.681 0.162 75.834)", "warningForeground": "oklch(0.145 0 0)", "warningSoft": "oklch(0.985 0.02 80)", "warningSoftForeground": "oklch(0.414 0.112 78)",
        "destructive": "#dc2626", "destructiveForeground": "#f8fafc", "destructiveSoft": "oklch(0.971 0.013 17)", "destructiveSoftForeground": "oklch(0.441 0.119 27)",
        "info": "oklch(0.588 0.158 241.966)", "infoForeground": "oklch(0.985 0 0)", "infoSoft": "oklch(0.97 0.019 235)", "infoSoftForeground": "oklch(0.379 0.146 265)"
      },
      "dark": {
        "success": "#22c55e", "successForeground": "#f8fafc", "successSoft": "oklch(0.23 0.06 166)", "successSoftForeground": "oklch(0.93 0.04 167)",
        "warning": "oklch(0.769 0.188 70.08)", "warningForeground": "oklch(0.145 0 0)", "warningSoft": "oklch(0.27 0.08 80)", "warningSoftForeground": "oklch(0.95 0.05 78)",
        "destructive": "#7f1d1d", "destructiveForeground": "#f8fafc", "destructiveSoft": "oklch(0.26 0.09 27)", "destructiveSoftForeground": "oklch(0.94 0.03 27)",
        "info": "oklch(0.613 0.14 239.919)", "infoForeground": "oklch(0.145 0 0)", "infoSoft": "oklch(0.25 0.07 235)", "infoSoftForeground": "oklch(0.93 0.05 265)"
      },
      "borderNote": "success/warning/info-border 由 color-mix(in oklch, var(--status) 32~40%, var(--background)) 派生；destructive-border 由 --border-destructive-subtle (#fecaca) 承担"
    },
    "chart": {
      "light": ["oklch(0.72 0.18 250)", "oklch(0.65 0.15 200)", "oklch(0.7 0.12 280)", "oklch(0.68 0.19 325)", "oklch(0.68 0.16 155)", "oklch(0.7 0.15 30)"],
      "dark": ["oklch(0.76 0.14 250)", "oklch(0.76 0.13 200)", "oklch(0.76 0.13 285)", "oklch(0.75 0.16 325)", "oklch(0.76 0.14 155)", "oklch(0.75 0.13 30)"],
      "auxiliary": {
        "text": null, "axis": null, "label": null, "grid": null,
        "status": "Pending（§2.8 / §28.6）：四类独立 Token 未定义；落地前沿用 §2.4 文字色与 §2.6 边框色",
        "exitCondition": "图表组件确实需要独立文字 / 轴 / 网格语义色"
      }
    },
    "syntax": {
      "light": {"keyword": "oklch(0.496 0.265 301.9)", "string": "oklch(0.448 0.119 151.3)", "number": "oklch(0.47 0.157 37.3)", "function": "oklch(0.488 0.243 264.4)", "property": "oklch(0.437 0.078 188.2)"},
      "dark": {"keyword": "oklch(0.827 0.119 306.4)", "string": "oklch(0.871 0.15 154.4)", "number": "oklch(0.837 0.128 66.3)", "function": "oklch(0.809 0.105 251.8)", "property": "oklch(0.855 0.138 181.1)"},
      "note": "代码只定义 5 个语法角色；comment/variable/operator/type/punctuation 由 foreground-* 语义色承担，不另立 Token"
    },
    "terminal": {
      "light": {"background": "#000000", "command": "#047857", "flag": "#2563eb", "property": "#0369a1", "string": "#b45309", "number": "#7c3aed", "online": "#10b981"},
      "dark": {"background": "#000000", "command": "#34d399", "flag": "#60a5fa", "property": "#7dd3fc", "string": "#fcd34d", "number": "#c4b5fd", "online": "#34d399"},
      "accent": ["emerald", "amber", "blue", "violet"],
      "dim": ["term-dim-1", "term-dim-2", "term-dim-3", "term-dim-4"],
      "dimValues": {
        "term-dim-1": "color-mix(in srgb, var(--foreground) 75%, var(--card))",
        "term-dim-2..4": "color-mix(in srgb, var(--foreground) 55%, var(--card))"
      },
      "accentValues": {
        "families": ["emerald", "amber", "blue", "violet"],
        "derived": "-line / -soft 派生档由各家族基色 Token 生成，不另立固定色值"
      },
      "status": "dim / error / warning / success 由 term-dim-* 与 term-accent-* + 状态语义色承担；ANSI 0–15 全色板尚未落地，保持 Pending（§26 / §28.6）"
    },
    "gradient": {"from": "#60a5fa", "via": "#a78bfa", "to": "#a855f7", "owner": "@utility ds-text-gradient-brand", "themeIndependent": true}
  },
  "radius": {
    "base": 10,
    "scale": [
      {"token": "radius-xs", "value": 6, "factor": 0.6, "usage": "小型标签、微型元素"},
      {"token": "radius-sm", "value": 8, "factor": 0.8, "usage": "小型按钮、紧凑控件"},
      {"token": "radius-md", "value": 10, "factor": 1.0, "usage": "默认按钮、输入框"},
      {"token": "radius-lg", "value": 12, "factor": 1.2, "usage": "卡片、Dialog、Icon Button"},
      {"token": "radius-xl", "value": 14, "factor": 1.4, "usage": "特殊控件"},
      {"token": "radius-2xl", "value": 16, "factor": 1.6, "usage": "大型容器"},
      {"token": "radius-3xl", "value": 18, "factor": 1.8, "usage": "超大容器"},
      {"token": "radius-4xl", "value": 20, "factor": 2.0, "usage": "全幅面板"},
      {"token": "radius-full", "value": 9999, "factor": null, "usage": "圆形、胶囊"}
    ],
    "usage": {"button": "radius-md", "input": "radius-md", "card": "radius-lg", "dialog": "radius-lg", "iconButton": "radius-lg", "chip": "radius-sm | radius-full", "avatar": "radius-full"},
    "exception": {"token": "radius-tooltip-tip", "value": 4, "scope": "tooltip 箭头尖端（旋转 45° 小方块），不得复用 rounded-xs"}
  },
  "spacing": {
    "grid": 4,
    "scale": [
      {"token": "space-0", "value": 0}, {"token": "space-0.5", "value": 2}, {"token": "space-1", "value": 4},
      {"token": "space-1.5", "value": 6}, {"token": "space-2", "value": 8}, {"token": "space-2.5", "value": 10},
      {"token": "space-3", "value": 12}, {"token": "space-4", "value": 16}, {"token": "space-5", "value": 20},
      {"token": "space-6", "value": 24}, {"token": "space-8", "value": 32}, {"token": "space-10", "value": 40},
      {"token": "space-12", "value": 48}, {"token": "space-16", "value": 64}, {"token": "space-20", "value": 80}
    ],
    "semantic": {
      "note": "语义间距不另立数值；已落地项直接别名到 density.params，唯一值声明仍在那里（§6.2 / §7.1）",
      "landed": {
        "--form-field-gap": "formFieldGap",
        "--card-padding": "cardPadding",
        "--page-gutter": "pageGutter",
        "--table-cell-padding-x": "tableCellPaddingX",
        "--table-cell-padding-y": "tableRowPaddingY"
      },
      "pending": ["--form-section-gap", "--card-gap", "--section-gap", "--dialog-padding", "--navigation-item-gap"]
    }
  },
  "density": {
    "modes": ["Compact", "Default", "Spacious"],
    "implAttrs": {"Compact": "sm", "Default": "lg", "Spacious": "xl"},
    "params": [
      {"key": "tableRowPaddingY", "label": "Table Row 垂直内边距", "compact": 8, "default": 12, "spacious": 14},
      {"key": "tableCellPaddingX", "label": "Table Cell 水平内边距", "compact": 8, "default": 12, "spacious": 14},
      {"key": "controlMd", "label": "Control MD", "compact": 36, "default": 40, "spacious": 44},
      {"key": "controlSm", "label": "Control SM", "compact": 32, "default": 36, "spacious": 40},
      {"key": "buttonMd", "label": "Button MD", "compact": 32, "default": 36, "spacious": 40},
      {"key": "buttonSm", "label": "Button SM", "compact": 28, "default": 32, "spacious": 36},
      {"key": "buttonLg", "label": "Button LG", "compact": 36, "default": 40, "spacious": 44},
      {"key": "navMd", "label": "Navigation MD", "compact": 28, "default": 32, "spacious": 36},
      {"key": "navSm", "label": "Navigation SM", "compact": 24, "default": 28, "spacious": 32},
      {"key": "navLg", "label": "Navigation LG", "compact": 40, "default": 48, "spacious": 52},
      {"key": "formFieldGap", "label": "Form Field Gap", "compact": 6, "default": 8, "spacious": 10},
      {"key": "cardPadding", "label": "Card Padding", "compact": 16, "default": 24, "spacious": 28},
      {"key": "pageGutter", "label": "Page Gutter", "compact": 16, "default": 24, "spacious": 32}
    ],
    "forbidden": ["字号", "字体家族", "图标尺寸", "圆角", "颜色对比度", "焦点环", "最小触控目标", "动效规则"]
  },
  "shadow": {
    "light": {
      "xs": "0 1px 2px rgb(15 23 42 / 0.04)",
      "sm": "0 1px 3px rgb(15 23 42 / 0.08), 0 1px 2px rgb(15 23 42 / 0.04)",
      "md": "0 4px 8px rgb(15 23 42 / 0.08), 0 2px 4px rgb(15 23 42 / 0.04)",
      "lg": "0 10px 24px rgb(15 23 42 / 0.12)",
      "xl": "0 20px 40px rgb(15 23 42 / 0.16)",
      "brandGlow": "0 0 24px rgb(85 88 216 / 0.18)"
    },
    "dark": {
      "popover": "0 1px 2px 0 rgb(0 0 0 / 0.6)",
      "overlay": "0 8px 24px -8px rgb(0 0 0 / 0.8)",
      "raised": "0 12px 24px -12px rgb(0 0 0 / 0.8)",
      "marketing": "0 20px 60px -25px rgb(0 0 0 / 0.7)",
      "note": "Dark 用更深的阴影 + 表面色差异 + 边框共同表达层级，不复制 Light 值（§8.2）"
    }
  },
  "motion": {
    "duration": [
      {"token": "--ds-motion-fast", "ms": 100, "usage": "轻微反馈"},
      {"token": "--ds-motion-base", "ms": 200, "usage": "常规交互"},
      {"token": "--ds-motion-slow", "ms": 350, "usage": "Dialog / Sheet 整块进出"},
      {"token": "--ds-motion-marketing-fast", "ms": 300, "usage": "营销动效"},
      {"token": "--ds-motion-marketing-base", "ms": 500, "usage": "营销展示"},
      {"token": "--ds-motion-enter", "ms": 600, "usage": "特殊进入动画"},
      {"token": "--ds-motion-loop-shimmer", "ms": 1800, "usage": "骨架屏"},
      {"token": "--ds-motion-loop-pulse", "ms": 1500, "usage": "状态脉冲"},
      {"token": "--ds-motion-loop-caret", "ms": 1000, "usage": "光标"},
      {"token": "--ds-motion-loop-spin", "ms": 800, "usage": "Loading"},
      {"token": "--ds-motion-loop-marquee", "ms": 20000, "usage": "滚动字幕"},
      {"token": "--ds-motion-loop-border", "ms": 3200, "usage": "流动边框"},
      {"token": "--ds-motion-data-fast", "ms": 250, "usage": "数据变化"},
      {"token": "--ds-motion-data", "ms": 500, "usage": "数据过渡"}
    ],
    "easing": {
      "--ds-motion-ease": "cubic-bezier(0.4, 0, 0.2, 1)",
      "--ds-motion-ease-marketing": "cubic-bezier(0.16, 1, 0.3, 1)",
      "--ds-motion-ease-snappy": "cubic-bezier(0.22, 1, 0.36, 1)"
    },
    "defaultTransitionDuration": 100
  },
  "components": {
    "button": {
      "variants": ["Primary", "Secondary", "Outline", "Destructive", "Ghost", "Link"],
      "sizes": [
        {"token": "button-default", "height": 36, "radius": "radius-md", "usage": "常规操作（默认）"},
        {"token": "button-sm", "height": 32, "radius": "radius-md", "usage": "表格行内、密集工具栏"},
        {"token": "button-lg", "height": 40, "radius": "radius-md", "usage": "页面级主操作"},
        {"token": "button-icon", "height": 36, "radius": "radius-lg", "usage": "图标按钮（默认）"},
        {"token": "button-icon-sm", "height": 32, "radius": "radius-lg", "usage": "工具栏图标按钮"},
        {"token": "button-icon-xs", "height": 24, "radius": "radius-lg", "usage": "极紧凑位，等于触控下限"},
        {"token": "button-icon-lg", "height": 40, "radius": "radius-lg", "usage": "强调型图标按钮"},
        {"token": "button-inline", "height": null, "radius": "rounded-none", "usage": "链接式文字按钮（≈20px 行盒）"},
        {"token": "button-wrap", "height": null, "minHeight": 32, "radius": "radius-md", "usage": "标签折行的内容型按钮"}
      ],
      "states": ["Default", "Hover", "Active", "Focus-visible", "Disabled", "Loading", "Pressed / Selected"],
      "smallSizeTypography": {"size": 12, "line": 18, "weight": 500, "scope": "仅 Button size=sm 内部实现，是 §1.14 控件 14px 下限的唯一实现侧例外"}
    },
    "control": {
      "sizes": [{"token": "control-sm", "height": 36}, {"token": "control-md", "height": 40}],
      "states": ["Default", "Hover", "Focus", "Focus-visible", "Filled", "Disabled", "Readonly", "Error", "Success"]
    },
    "icon": {
      "sizes": [16, 18, 24, 32, 48],
      "default": 18,
      "strokeWidth": 2,
      "containerConstrained": [12, 14]
    },
    "navigation": {
      "sizes": [{"token": "nav-sm", "height": 28}, {"token": "nav-md", "height": 32}, {"token": "nav-lg", "height": 48}],
      "selected": {"light": {"background": "#F0F0FF", "color": "#5558D8", "contrast": 4.93}, "dark": {"background": "#25264A", "color": "#B1B3FF"}}
    },
    "interactionStates": ["default", "hover", "focus-visible", "active", "disabled", "loading", "selected", "pressed"]
  },
  "breakpoints": {"sm": 640, "md": 768, "lg": 1024, "xl": 1280, "2xl": 1536},
  "a11y": {
    "contrast": {"normalText": 4.5, "largeText": 3, "uiComponent": 3},
    "focusRing": {"width": 2, "offset": 0, "style": "满色、贴边、:focus-visible"},
    "touchTarget": {"minimum": 24, "recommended": 44}
  },
  "pending": [
    {"id": "P1", "scope": "Terminal ANSI 0–7 / Bright 8–15 全色板、Foreground / Cursor / Selection", "reason": "终端组件尚未需要完整 ANSI 色板；早期版本的 20 个 ... 占位符属未兑现承诺", "exitCondition": "终端组件确实需要完整 ANSI 色板，届时补进 colors.terminal 并同步 §2.10 与展示页"},
    {"id": "P2", "scope": "图表文字 / 坐标轴 / 标签 / 网格线独立 Token", "reason": "当前实现只落地六个 chart-N 分类色", "exitCondition": "图表组件确实需要独立文字 / 轴 / 网格语义色，届时补 colors.chart.auxiliary"},
    {"id": "P3", "scope": "首屏装饰层光晕颜色 / 透明度 / 形状值", "reason": "值落在 theme.css 与 foundations/decoration.css，尚未纳入 colors.decoration", "exitCondition": "装饰层需要改值或展示页需要展示其实际值时，先补 §28 声明再同步实现"}
  ],
  "sections": [
    {"id": "typography", "no": 1, "title": "字号 11 主档 + 7 配套档", "spec": "§1.2"},
    {"id": "mono", "no": 2, "title": "Mono 四档", "spec": "§1.5"},
    {"id": "hierarchy", "no": 3, "title": "页面层级四层", "spec": "§3"},
    {"id": "text-colors", "no": 4, "title": "文字色七档", "spec": "§2.4"},
    {"id": "surfaces", "no": 5, "title": "表面与描边", "spec": "§2.5 / §2.6 / §4"},
    {"id": "brand", "no": 6, "title": "品牌色阶", "spec": "§2.2 / §2.3"},
    {"id": "status", "no": 7, "title": "状态色", "spec": "§2.7"},
    {"id": "chart", "no": 8, "title": "图表分类色", "spec": "§2.8"},
    {"id": "syntax", "no": 9, "title": "语法高亮色", "spec": "§2.9"},
    {"id": "terminal", "no": 10, "title": "Terminal 演示 Token", "spec": "§2.10"},
    {"id": "radius", "no": 11, "title": "圆角九档", "spec": "§5"},
    {"id": "spacing", "no": 12, "title": "间距", "spec": "§6"},
    {"id": "density", "no": 13, "title": "密度 Token", "spec": "§7"},
    {"id": "shadow", "no": 14, "title": "五档 Elevation Shadow + Brand Glow", "spec": "§8"},
    {"id": "motion", "no": 15, "title": "动效", "spec": "§9"},
    {"id": "button", "no": 16, "title": "Button 九档尺寸 + 六变体", "spec": "§10"},
    {"id": "control", "no": 17, "title": "控件尺寸", "spec": "§11"},
    {"id": "icon", "no": 18, "title": "图标五档", "spec": "§12"},
    {"id": "components", "no": 19, "title": "组件示范", "spec": "§13"},
    {"id": "navigation", "no": 20, "title": "导航选中态", "spec": "§14"},
    {"id": "focus", "no": 21, "title": "焦点环与触控目标", "spec": "§15"},
    {"id": "brand-gradient", "no": 22, "title": "品牌渐变与首屏演示", "spec": "§17.5 / §26.2"},
    {"id": "breakpoints", "no": 23, "title": "响应式断点", "spec": "§16.1 / §16.2"},
    {"id": "token-layers", "no": 24, "title": "Token 分层与单一数据链", "spec": "§17 / §28"}
  ]
}
```
<!-- TOKEN-MANIFEST:END -->

---

## 28.6 Pending 登记（未纳入声明的值）

`TOKEN-MANIFEST.pending` 是**唯一登记处**，与本节一一对应。以下三组值尚未纳入
机器可读声明，属「已发现、未落地」，不得标为已实现、也不得给它们编造数值：

| 编号 | 范围 | 原因 | 退出条件 |
|---|---|---|---|
| P1 | Terminal ANSI 0–7 / Bright 8–15 全色板、Foreground / Cursor / Selection | 终端组件尚未需要完整 ANSI 色板；早期版本的 20 个 `...` 占位符属未兑现承诺 | 终端组件确实需要完整 ANSI 色板，届时补进 `colors.terminal` 并同步 §2.10 与展示页 |
| P2 | 图表文字 / 坐标轴 / 标签 / 网格线独立 Token | 当前实现只落地六个 `chart-N` 分类色 | 图表组件确实需要独立语义色，届时补 `colors.chart.auxiliary` |
| P3 | 首屏装饰层光晕颜色 / 透明度 / 形状值 | 值落在 `theme.css` 与 `foundations/decoration.css`，尚未纳入 `colors.decoration` | 装饰层需要改值或展示页需展示其实际值时，先补 §28 声明再同步实现 |

§27.2 中标注「当前未纳入」的行一律回指本节。**Pending 项不进 ALLOWLIST、不计入
门禁通过数**；退出一条须同时从 `pending` 数组与本节删除，并补齐对应声明与投影表。
`sync-design-showcase.mjs --check` 会校验 `pending` 与本节表格逐项对应。
