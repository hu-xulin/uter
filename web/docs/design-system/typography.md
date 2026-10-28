# Typography

字号是设计系统里最容易被随手破坏的一层 —— 一个 `text-[15px]` 就够让页面看起来
「哪里不对」。因此这里只有十档，且由代码强制。

## 十档字号表

| Token       | 语义                     | 字号 | 字重 | 行高 | Tailwind                  | 组件                              |
| ----------- | ------------------------ | ---- | ---- | ---- | ------------------------- | --------------------------------- |
| display     | 页面主视觉               | 36px | 700  | 40px | `text-4xl`                | `Heading variant="display"`       |
| h1          | 页面标题                 | 30px | 600  | 36px | `text-3xl`                | `Heading variant="page-title"`    |
| h2          | 区块标题                 | 24px | 600  | 32px | `text-2xl`                | `Heading variant="section-title"` |
| h3          | 卡片/弹窗标题            | 18px | 600  | 28px | `text-lg`                 | `Heading variant="card-title"`    |
| group-title | 卡片内分组标题           | 16px | 600  | 24px | `text-base font-semibold` | `Heading variant="group-title"`   |
| body        | **正文（全站基准）**     | 14px | 400  | 20px | `text-sm`                 | `Text variant="body"`             |
| body-long   | 长文本（文章/协议/对话） | 16px | 400  | 26px | `text-long`               | `Text variant="body-long"`        |
| body-sm     | 次要正文、表格单元格     | 14px | 400  | 20px | `text-sm`                 | `Text variant="body-sm"`          |
| label       | 按钮、表单标签、导航     | 14px | 500  | 20px | `text-sm font-medium`     | `Text variant="label"`            |
| caption     | 说明、占位符、徽标       | 12px | 400  | 16px | `text-xs`                 | `Text variant="caption"`          |
| mono        | 正文里的等宽文本         | 14px | 400  | 20px | `text-mono`               | `Text variant="code"`             |

**mono 是等宽专用档，按使用场景分三档**（不占十档位置，见下节）。

**汇总值不属于 `caption`。** 卡片标题旁的「总计 / 合计 / 共 N 条」与标题同层级，
用 `body-sm`（14px `text-sm`）；`caption` 只给**不含数值**的短说明。把金额、计数
压到 12px 等于让用户凑近看数字。判据与守卫见
`components.md`「卡片标题旁的汇总值：14px」。

### 行高属于字号，不属于页面

上表右数第二列的行高是**每一档字号自带的属性**，写在
`design-system/tokens/typography.css` 的 `@theme` 里（`--text-*--line-height`）。
所以：

- 写 `text-sm` 就同时拿到了 14px 和 20px，**不需要也不允许**再写 `leading-*`；
- `leading-tight` / `leading-snug` / `leading-relaxed` / `leading-none` /
  `leading-6` 这些工具类会把行高从阶梯上拽下来（`text-sm leading-relaxed`
  实际是 14/22.75，`text-xs leading-5` 是 12/20，都不在任何一档里），
  门禁 **T9** 一律拦截；
- 确实需要更松的行距 → 换档位（`text-long` = 16/26），而不是改行高；
- 唯一允许的写法是 `leading-[var(--ds-line-mono-dense)]` 这类**引用 Token**，
  用于等宽密集容器锁固定高度（22px 档，见下文「mono 密集行高」）。

「全站正文行高从 20px 调到 21px 只改一处」这件事，靠的就是这条规则 ——
一旦允许 `leading-*` 散落，行高就又有 N 个来源了。

## body 与 body-long：14px 是基准，16px 是阅读档

规范把「常规正文」定在 **14/20**，16px 只保留给**连续阅读**场景。这两档的
分界线不是「重要程度」，而是**阅读方式**：

| 档位        | 字号/行高 | 什么时候用                                                                  | 判据                                        |
| ----------- | --------- | --------------------------------------------------------------------------- | ------------------------------------------- |
| `body`      | 14/20     | 界面文案：卡片描述、表单说明、列表副标题、弹窗正文、表格单元格              | 一眼扫过去就能懂，不需要逐字读              |
| `body-long` | 16/26     | 需要连续阅读多段的内容：帮助中心、服务协议、隐私政策、文章正文、AI 对话气泡 | 会出现 3 行以上的段落，读者会从上往下顺序读 |

两条实现约定：

1. **`body` 与 `body-sm` 现在同为 14/20**，视觉上等价。保留两个名字是为了语义
   分工（`body` 是默认正文，`body-sm` 是「比正文次要一档」的显式声明），
   不要在代码里把它们当成两个不同字号。
2. **`text-base`（16px）不再等于正文**。它现在的合法用途只有四类：
   `group-title`（16/600/24）、设置页字段档（16/600）、指标/价格数值
   （16/600 + `tabular-nums`）、`body-long` 的原始值（16/26）。
   在 `<p>`、`Card`、`DialogContent`、`SheetContent` 上写 `text-base` 会被
   `spec-guards.test.ts` 判失败。

`Text variant="body-long"` 输出的类名是 `ds-text--body-long`，对应
`--ds-text-long`（`--text-long`）与 `--ds-line-long`（26px）。

所有等宽文本必须落到这三档之一，不要在 `font-mono` 上再叠 `text-sm` / `text-xs`
—— 那会让同一处的 mono 与语义档位脱钩。

## mono 三档

等宽字形比 Inter 同字号更宽，用一个字号覆盖所有场景必然有一头不对。

| Token        | 用途                                                          | 字号 | 字重 | 行高 | Tailwind          | 组件                           |
| ------------ | ------------------------------------------------------------- | ---- | ---- | ---- | ----------------- | ------------------------------ |
| `mono`       | 正文里的等宽文本（模型 ID、密钥、金额、行内代码、表格单元格） | 14px | 400  | 20px | `text-mono`       | `Text variant="code"`          |
| `mono-code`  | 固定高度的等宽代码容器（首页代码卡片、代码编辑器视口）        | 13px | 400  | 20px | `text-mono-code`  | `Text variant="code-block"`    |
| `mono-title` | 用等宽字形的卡片标题（定价卡片模型名）                        | 16px | 600  | 22px | `text-mono-title` | `Heading variant="mono-title"` |

三条判定规则：

1. **正文里的等宽文本一律 14px**，与 `body-sm` 同档。13px 等宽嵌在 14px 正文里
   会明显偏小，看起来像降级而不是「等宽」。
2. **只有固定高度的等宽代码容器才用 13px**。这类容器高度固定、不滚动，14px 会撑出
   行数溢出 —— 首页代码卡片请求区固定 235px、整体固定 400px，最长的 JSON 行
   （claude/gemini 嵌套响应、多行 curl 头）在 14px 下会贴近乃至溢出容器右缘。
   Markdown 的围栏代码块属于**正文**（随正文滚动、高度不固定），用 `text-mono`（14/20）。
3. **等宽卡片标题用 16px**。等宽字形在同等视觉重量下比 Inter 18px 小一档，
   16px 是补偿值；它是 `card-title` 的**同层级等宽字形**，不是新开一档标题。

`Heading variant="mono-title"` 与 `card-title` 属于同一语义层级（都是卡片标题）。
不要在 `card-title` 上叠 `font-mono text-mono` —— 那会把 18px 标题压成 14px，
标题层级直接塌掉（定价卡片曾长期如此）。

## mono 密集行高（22px）

等宽文本在**表格单元格 / 调用日志 / 代码行**这类密集行里，20px 行高会把
行与行挤在一起（等宽字形的 x-height 比 Inter 小，20px 显得空，但一屏 40 行
时又不够喘气）。这类场景单独一档：

```css
--ds-line-mono-dense: 22px; /* 只配 text-mono 使用 */
```

写法固定为 `text-mono leading-[var(--ds-line-mono-dense)]`（门禁 T9 放行
`leading-[var(--…)` 这种**引用 Token** 的形式，它拦的是字面像素值）。

它**不是**第四档 mono 字号 —— 字号仍是 14px，只有行高变成 22px。判定：
「这段等宽文本是不是一屏几十行的密集列表」。是 → 22px；单行 ID / 密钥 /
金额 → 默认 20px。

## 内容排版（Markdown prose）

AI 回答、模型输出、docs-web 的文档正文是**内容排版**，不是界面层级。它们的
标题自成一套，比界面标题低一到两档 —— 把 Markdown 的 `h1` 抬到界面的 30px，
会让回答里的标题比它所在卡片的标题（18px）还大，页面层级当场塌掉。

| Markdown | 档位      | 字号/行高 | 字重                           |
| -------- | --------- | --------- | ------------------------------ |
| `h1`     | `h2`      | 24/32     | 600                            |
| `h2`     | `h3`      | 18/28     | 600                            |
| `h3`     | 16/24     | 16/24     | 600                            |
| `h4`     | `body`    | 14/20     | 600                            |
| `h5`     | `body`    | 14/20     | 600（tertiary 色）             |
| `h6`     | `caption` | 12/16     | 600 + uppercase（tertiary 色） |

正文用 `body-long`（16/26），行内代码 `mono`（14/20），围栏代码块
`mono`（14/20，随正文滚动）。实现位置两处，都按这张表：

- `components/ai-elements/response-renderer-blocks.tsx` 的 `headingClasses`（AI 回答、模型输出）；
- `components/ui/markdown.tsx` 的 `[&_h1]`…`[&_h4]` 一串后代选择器（`RichContent`
  的 markdown 分支、协议正文）。2026-10-28 之前这里还是界面阶梯
  （30 / 24 / 18 / 16），`h1` 与页面标题同号，本次按本表改为 24 / 18 / 16 / 14。

docs-web 的文档正文同一套，只是文档的一级标题由 `DocsTitle` 按界面 `h1`（30）
渲染，正文从 Markdown 的 `h2` 开始，所以页面上看到的是 **30 → 18 → 16**：

| 页面位置                | 取值                               |
| ----------------------- | ---------------------------------- |
| 文档标题（`DocsTitle`） | 30/36 600 —— 界面 `h1`             |
| 正文一节（Markdown h2） | 18/28 600（`--text-doc-prose-h2`） |
| 正文子节（Markdown h3） | 16/24 600（`--text-doc-prose-h3`） |
| 正文段落 / 列表         | 16/26 400（`body-long`）           |
| 表格单元格              | 14/20（`body-sm`）                 |

卡片标题（`Uter-card` 里的 `h3`）不算正文，仍按界面 `h3` 的 18/28；docs-web 用
`.prose :is(h3):not(.Uter-card h3)` 把两者分开。

**只对 Markdown 渲染的内容生效。** `Heading` / `CardTitle` / `DialogTitle`
等界面标题不得借用这条 —— 界面层级永远是 30 / 24 / 18 / 16 四层。

## 移动端全屏菜单

移动端全屏菜单（`public-header.tsx` 的 overlay）的一级项是**触屏列表**，
用 16/24（`text-base font-medium`），比桌面一级导航的 14/20 大一档：触屏
点按面积与可读性都要求更大。桌面导航仍是 `label` 14/500。

判据是**输入方式**，不是屏幕宽度：鼠标点的用 14，手指点的用 16。

## 无障碍大字档（Simple Large-font 预设）

`[data-theme-scale='simple-large']` 是用户在主题里主动开启的「超大字体简易」
预设。它是**同一套阶梯的放大档**，不是第二套字号体系：档位名称、用途、相对
顺序完全一致，只有取值按 ~1.35× 放大，行高同比放大以维持阅读节奏。

关键约束：**它声明在 `tokens/typography.css`，不是 `theme-presets.css`。**
规范要求「字号、行高、字重、字体」由 Typography 统一管理，主题只管颜色、
密度只管间距。此前这段覆盖写在主题预设里，等于让字号阶梯有了第二个来源 ——
改基准值对这个预设无效，改这个预设也不影响其他预设。现在两个来源合一，
门禁 T1（`--text-*` 只能出现在 `typography.css`）也就不再需要例外。

## 定价卡片

| 元素                                                             | 档位                                             |
| ---------------------------------------------------------------- | ------------------------------------------------ |
| 模型名（标题）                                                   | `Heading variant="mono-title"`（等宽 16/600/22） |
| 供应商                                                           | `caption`                                        |
| 描述（如「面向创意写作、分析与可控智能体工作流的 Claude 模型」） | `body-sm`（14/20）                               |
| 报价数值                                                         | `mono`                                           |
| 报价标签                                                         | `caption`                                        |

描述用 14px 而不是 16px：它是辅助信息，与 16px 等宽标题同档会互相抢层级，
且两行 16px 会把卡片撑高、把报价区挤出首屏。

## 补充档（不在十档内，仅用于兼容）

| Token              | 用途           | 约束                 |
| ------------------ | -------------- | -------------------- |
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
<Text variant="code" as="code">{model.model_name}</Text>
```

`Heading` 的 `variant` 决定**视觉**，`level` 决定**语义**（默认由 variant 推导）。
需要「视觉上小、语义上大」时显式传 `level`，不要用 `div` 假装标题。

## 禁止事项

- `text-[15px]`、`text-[0.9em]`、`text-[1.75rem]` —— 任意字号，被 T2 拦截。
- `leading-[26px]` —— 任意行高，被 T3 拦截。等宽密集场景用
  `leading-[var(--ds-line-mono-dense)]`。
- 任何 `leading-*` 工具类（含 `leading-tight` / `leading-none` / `leading-6`）——
  被 T9 拦截。行高由字号 Token 自带，见上文「行高属于字号，不属于页面」。
- 在 `font-mono` 旁边再写 `text-sm` / `text-xs` —— mono 的字号只有三个来源
  （`text-mono` = 14/20、`text-mono-code` = 13/20、`text-mono-title` = 16/22），
  叠加语义档位会让等宽文本脱离 mono 档。
- 在 `Heading variant="card-title"` 上叠 `font-mono text-mono` —— 会把 18px
  卡片标题压成 14px；要等宽标题就用 `variant="mono-title"`。
- `style={{ fontSize: 13 }}` —— 内联字号，被 T4 拦截（图表 canvas 除外）。
- 页面里自己写 `<h1 className="text-3xl font-bold">` —— 用 `Heading`。

## 页面层级：四层，不多不少

一个后台页面只有四层可见标题，缺一层或跳一层都会「看起来哪里不对」：

| 层  | 档位                                  | 用途                                                 | 组件                                         |
| --- | ------------------------------------- | ---------------------------------------------------- | -------------------------------------------- |
| 1   | `page-title` 30/600/36                | 页面标题，**每页一个**                               | `SectionPageLayout.Title`                    |
| 2   | `section-title` 24/600/32             | 页面内的语义区块（一个页面通常 2–5 个）              | `Heading variant="section-title"`            |
| 3   | `card-title` / `mono-title` 18/600/28 | 卡片、面板、图表                                     | `CardTitle` / `Heading variant="card-title"` |
| 4   | `group-title` 16/600/24               | 卡片**内部**再分组：表单分组、列表分组、弹窗字段分组 | `Heading variant="group-title"`              |

配套的硬规则：

- **16/600 只允许当 `group-title`（卡片内分组标题）**，不得拿来当页面标题、
  区块标题或卡片标题 —— 那三层必须是 30 / 24 / 18，否则 30px 页标题之下
  的层级会塌成一片。
- **唯一例外：指标 / 价格「数值」可以用 16/600。** 这类元素是**数据**，
  不是标题：它没有层级语义、不参与页面大纲，用 `tabular-nums` 等宽数字
  对齐（`dashboard/models/log-stat-cards` 的统计值、`pricing/model-details`
  的报价数值）。判据只有两条同时成立才算：
  1. 文本是纯数值或「数值 + 单位」（`$0.15 / 1M tokens`、`12,480`），
     不含自然语言标题；
  2. 带 `tabular-nums`。
     反例：把「模型名称」「分组名称」写成 16/600 不算数值，仍属违规。
     大号指标数值走响应式档 `text-2xl md:text-3xl`（见 `responsive.md`），
     本条只覆盖紧凑卡片里放不下 24px 的那一档。
- **「名称 + 说明」行标题恒为 16/500**（`text-base font-medium`），600 只给
  `group-title`。账户安全卡的「删除账户 / 更改密码」、偏好设置卡的「界面语言」
  都按这一档执行（`page.test.tsx` 有断言守着）。600 会让行标题与分组标题同重，
  一屏里出现两套「加粗的 16px」，层级立刻失效。
- **分组标题不得退回 14px。** 14px 是 `body-sm` / `label` 的档位，压到分组
  标题上会让整块内容比正文还小 —— 个人资料页的「通知方式」「偏好设置」
  曾经就是这样（14/500），和「安全与访问」页的 16px 行标题对不上，
  这也是「管理页看着字小」的另一半成因。
- **不允许 `text-sm font-semibold` 当卡片/区块标题。** 14px 是 `body-sm` / `label`
  的档位，压到标题上会把整块内容一起「显得小」。
- **表单标签恒为 `label`（14/500）**——这是**默认**档位，不是所有页面都如此。
  `FormLabel` / `Label` 上加 `text-xs` 是违规 —— 12px 是 caption（说明、占位符、
  徽标）的档位，标签不是说明。**设置类页面例外**，见下一节：
  设置页的字段标签是 16/600，不是 14/500。
- **12px 只给真 caption**：占位符、徽标、表格列名（uppercase）、时间戳。
  caption 的边界写死成三条，全部满足才允许 12px：
  1. **单行 ≤20 字**（含标点；中文按字计，英文按单词边界计）。超过就是一段
     说明文字，属于正文，用 `body-sm` 14/400；
  2. **不承载数值**。价格、额度、倍率、百分比、计数、时间长度一律 14px 起 ——
     12px 的数字在密集表格里读错一位的代价远大于省下的两行高度；
  3. **不是阅读主体**。段落 `<p>`、`FormDescription`、`AlertDescription`
     承载的是「用户需要读懂才能正确操作」的信息，不属于 caption。

  换句话说：**`<p>` 上的 `text-xs` 基本等于违规**，除非它是一行徽标式的
  状态标签。守卫测试 `control-typography.test.ts` 会把管理端的 `<p text-xs>`
  直接判失败（见下文「控件与说明文字的下限」）。

- **卡片 / 区块标题同行的汇总值恒为 14px**。这是上面第 2 条（不承载数值）最常
  破防的位置：标题右侧那个 `总计：$0.03`、`共 181 条`、`Total: 181`。

  ```tsx
  {/* ✅ 18px 标题 + 14px 汇总值，两档 */}
  <div className='text-lg font-semibold'>{t('Quota Distribution')}</div>
  <span className='text-muted-foreground text-sm'>
    {t('Total:')} {chartData.totalQuotaDisplay}
  </span>

  {/* ❌ 12px 会把「总量口径」读成标题的脚注 */}
  <span className='text-muted-foreground text-xs'>…</span>
  ```

  为什么不是 12px：这张卡片唯一的总量口径就是它，用户要先读到它；18/600 与
  14/400 之间只隔一档，正好构成「标题 → 总量」两级，压到 12px 会变成三档、
  中间那档空掉。守卫：`spec-guards.test.ts` 的
  `keeps card summary values at 14px`。

- **弹窗/抽屉标题 18px。** `text-xl`（20px）不在阶梯内，不要用来放大弹窗标题。

## 设置页的「名称 + 说明」三层

系统设置页（`features/system-settings/**`）是**列表型**结构：每一行都是
「名称 + 说明」成对出现。这类结构里名称必须明显高于说明，否则整页读起来
就是「一堆同号小字」—— 历史问题正是三层全挤在 14px（标签 14/500、
说明 14/400、容器标题 14/500），只靠字重区分。

| 层       | 档位                | 用途                                                       |
| -------- | ------------------- | ---------------------------------------------------------- |
| 容器标题 | `group` 18/600/28   | 带边框的分组容器（「聊天区域」「管理区域」），等同卡片标题 |
| 字段标签 | `field` 16/600/24   | 字段标题、开关行标题（「Client Secret」「主域名」）        |
| 说明文字 | `body-sm` 14/400/20 | `FormDescription`、手写 `<p>`、`AlertDescription`          |

机器可读的值（URL / 域名 / 端点 / 密钥 / 邮箱 / Client ID / Slug / 路径）用
等宽 14/20（`text-mono`）；人读的名称（站点名、发送者姓名）不用等宽。

实现方式是**上下文声明**，不是逐个调用点加类名：

```tsx
// 整页声明一次，全页 280 个 FormLabel 自动继承
<FormLabelTierProvider tier='field'>…</FormLabelTierProvider>

// 分组容器自己升一档，内部再由 SettingsControlChildren 降回 field
<SettingsControlGroup>…</SettingsControlGroup>
```

`SettingsPage` 已经声明了 `field` 档，新增设置字段不需要任何额外类名。
违反了会怎样：`FormLabel` 上硬写 `text-sm font-normal` 会把标签压回 14px、
与说明同号同重（`customer-service-section.tsx` 曾有三处），这种覆盖必须删掉。

`AlertTitle` 也跟随该上下文：设置页里的「设置引导」是 16/600，普通页面
仍是原来的 14/500 加粗。

## 控件与说明文字的下限（管理端）

上一条「12px 只给真 caption」最容易破防的地方是**控件文字**与**说明性正文**：
`text-xs` 是合法类名，T1–T7 都不会报它，于是密集的技术弹窗里按钮、下拉、输入框
一个接一个退回 12px，整页比个人资料页小一号 —— 这正是「管理页面字号不统一」的
真实成因，而不是某处写了个怪字号。

因此管理端（`features/` 下 channels / dashboard / keys / models / organization /
redemption-codes / subscriptions / system-info / system-settings / task-plugins /
usage-logs / users / wallet）执行两条下限：

| 位置                                                                                              | 下限                     | 依据                      |
| ------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------- |
| 控件文字（`Button` / `SelectTrigger` / `Input` / `Textarea` / `ToggleGroupItem` / 小写 `button`） | 14px（`label` 14/500）   | 「按钮文字」就是 label 档 |
| 说明性正文（`<p>`）、`AlertDescription`、`FormDescription`、`dt`、`TableCell`                     | 14px（`body-sm` 14/400） | 说明文字是正文，不是徽标  |

配套细节：

- 紧凑按钮不再手写 `h-7 text-xs`，用 14px 文字时高度给到 `h-7`（28px）以上；
  `h-6`（24px）装不下 14/20 的行高。
- 等宽代码块用 `text-mono`（14/20）或 `text-mono-code`（13/20），不要写 `text-xs`。
- 以下场景**仍然是 12px**，不要跟着放大：`Badge`（计数、分类标签、折扣角标）/
  `AvatarFallback`、表格列名（uppercase）、时间戳、单元格次级信息、日历格子。
- **`StatusBadge` 是例外，固定 14px（`body-sm`）**：它承载运行时状态文字（渠道状态、
  任务结果），要和同一行的表格正文同档阅读，12px 会显得像脚注。规范
  `_reports/Uter设计规范.md` §2.1 的「状态徽标」条目已写明这是唯一允许徽标用 14px 的场景。

守卫测试：`src/design-system/__tests__/control-typography.test.ts`，三条：

1. **控件下限**：扫描上面 13 个管理端目录，任何控件标签或 `<p>` 上出现 `text-xs`
   直接判失败，并在失败信息里给出文件:行号。
2. **分组标题下限**：扫描 13 个管理端目录 + `security` + `profile`，`h3`/`h4`/`h5`
   上出现 `text-sm` / `text-xs` 判失败 —— 分组标题是 `group-title`（16/600/24），
   退回 14px 会让它比正文还小。`uppercase` 的 eyebrow 与 `font-mono` 的标识符
   标题不计入（它们分别是 caption 与 mono 档）。
3. **设置页标签档位**：扫描 `features/system-settings`，`FormLabel` / `Label` 上
   硬写 `text-sm` / `text-xs` / `font-normal` 判失败 —— 设置页字段标签的 16/600
   由 `FormLabelTierProvider` 在页面层下发，调用点覆盖会把标签压回 14/400。

前台页面（营销页、定价页）不在扫描范围内，需要时按同一标准单独处理。

## 想加一档字号怎么办

1. 先确认现有十档真的覆盖不了（绝大多数情况是覆盖得了的）；
2. 在 `tokens/typography.css` 的 `@theme` 里加 `--text-*` 与 `--text-*--line-height`；
   （`--text-*` 是字号命名空间，文字颜色请用 `--fg-*`，见 `colors.md`）
3. 在 `tokens/semantic.css` 里加对应的 `--ds-text-*` / `--ds-line-*`；
4. 在 `__tests__/tokens.test.ts` 的 `LADDER` 里登记期望值；
5. 更新本文件的表格。

只做第 2 步而不做 3–5 步，等于又开了一套平行标准。

## 密度与字号缩放

`[data-theme-scale='sm' | 'lg' | 'xl']` **只缩放间距**（`--spacing`），
**不缩放字号阶梯**：

```css
[data-theme-scale='sm'] {
  --spacing: 0.225rem;
} /* 仅间距，typography untouched */
```

这条曾经是反的 —— 密度档会一起压 `--text-*`，等于「用户切紧凑模式顺手把正文
压小一档」，与规范「密度不得改动默认正文语义」冲突，已移除（见
`exceptions.md` D4）。需要放大文字的用户走「Simple Large-font」预设
（见上文「无障碍大字档」），那是显式的无障碍契约，不是密度的副作用。

## 多行主标题的行高

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
