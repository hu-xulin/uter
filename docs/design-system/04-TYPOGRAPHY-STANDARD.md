# UTER DESIGN SYSTEM 8.0.0 · 04 Typography Standard

> **规范编号** `UDS8-S04` · **唯一文件** `04-TYPOGRAPHY-STANDARD.md` · **版本** `8.0.0` · **状态** `ACCEPTANCE_READY`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Clarity / Hierarchy / Accessibility / Developer Experience
> **视觉审核入口** [`SHOWCASE-8.0.0.html`](./SHOWCASE-8.0.0.html#mod-04)

---

## 1. Overview

完整保留 Uter 当前字体体系；10 档字号、11 个独立行高、4 档字重、等宽数字，全部以 px 给出确定值。

本模块属于 UDS 8.0.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。UDS 8.0.0 是本仓库唯一现行设计系统与唯一执行依据；颜色语义层 --ds-* bridge 为新 UI 的唯一运行时权威；现有 UDS 3.0 runtime compatibility boundary 按 ADR-0002 保留，直到项目所有者明确授权迁移并完成当前 HEAD 绑定的行为、视觉与兼容回归验证；该边界不构成并行设计系统或第二套 Token。视觉基线见 `VISUAL-BASELINE.json`。

| 属性 | 值 |
|---|---|
| 状态 | `ACCEPTANCE_READY`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. UI 字体栈以 `--font-ui` 为准；打包的 Noto Sans SC Variable（100–900）必须排在本地思源黑体之前，否则 300 字重会回落到 Medium；正文 = `var(--ds-font-body)` = `var(--ds-font-ui)`
2. 代码字体栈以 `--font-mono` 为准；CJK 回退置于 generic `monospace` 之后，且打包 Noto Sans SC 先于本地思源，保证拉丁数字等宽且中文字重一致
3. 禁止换成 Geist / Roboto / Arial-only / 任何新字体；允许优化字体加载与回退顺序，但必须保持中英文显示能力
4. 字号阶梯：12 / 13 / 14 / 16 / 18 / 20 / 24 / 30 / 36 / 48 px，对应 `--ds-text-2xs` … `--ds-text-5xl`
5. 正文默认 14px/22px；长文本 16px/26px；普通可见文字不得低于 12px
6. 独立行高 Token：caption 18、code 20、body 22、base 24、long 26、h3 26、h2 38、h1 44、display 56、table 20、button 20 px；组件不得写死行高
7. 字重：regular 400 / medium 500 / semibold 600 / bold 700；Inter 与思源黑体均以可变字体打包 100–900，中英文阶梯一致
8. 金额、余额、Token 数量、价格、用量、订单号、统计指标强制 `font-variant-numeric: tabular-nums`
9. 代码 / API Key / 模型标识 / Request ID 强制 `var(--ds-font-mono)`；代码默认 13px/20px
10. H5 输入框默认字号 ≥16px（`--ds-control-h5-input-font-size`），防止 iOS Safari 自动放大
11. 渐变文字只改变颜色，不得改变字体、字重、字号、行高

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-8.0.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-font-ui` | 'Inter Variable', 'Inter', 'Noto Sans SC Variable', 'Noto Sans SC', 'Noto Sans CJK SC', 'Source Han Sans SC', 'Source Han Sans CN', '思源黑体', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji' | —（同值） | stack | UI 字体栈（中英文 + Emoji 回退） |
| `--ds-font-body` | var(--ds-font-ui) | —（同值） | stack | 正文字体 = UI 字体别名 |
| `--ds-font-mono` | ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace, 'Noto Sans SC Variable', 'Noto Sans SC', 'Source Han Sans SC', 'Source Han Sans CN', '思源黑体', 'PingFang SC', 'Microsoft YaHei', sans-serif | —（同值） | stack | 等宽字体栈（CJK 回退置于 monospace 之后，保持拉丁等宽） |
| `--ds-text-2xs` | 12px | —（同值） | px | 最小可见文字（全站下限） |
| `--ds-text-xs` | 13px | —（同值） | px | 密集表格 / 代码 / 标签 |
| `--ds-text-sm` | 14px | —（同值） | px | 正文默认 |
| `--ds-text-base` | 16px | —（同值） | px | 长文本默认 / 指标数值 / H5 输入 |
| `--ds-text-lg` | 18px | —（同值） | px | h3 / 卡片标题 |
| `--ds-text-xl` | 20px | —（同值） | px | 次级标题 |
| `--ds-text-2xl` | 24px | —（同值） | px | 区块标题 |
| `--ds-text-3xl` | 30px | —（同值） | px | 分区标题 |
| `--ds-text-4xl` | 36px | —（同值） | px | 页面主标题 |
| `--ds-text-5xl` | 48px | —（同值） | px | 展示大标题（Hero 使用 4xl） |
| `--ds-text-mono-page-title` | 20px | —（同值） | px | 等宽页面标题（定价页模型详情标题），行高 26px |
| `--ds-text-mono-section-title` | 16px | —（同值） | px | 等宽区块标题（定价页卡片模型名），行高 22px |
| `--ds-leading-body` | 22px | —（同值） | px | 14px 正文 |
| `--ds-leading-long` | 26px | —（同值） | px | 16–18px 长文本 / h3 |
| `--ds-leading-code` | 20px | —（同值） | px | 13px 代码 / 20px 控件 |
| `--ds-weight-regular` | 400 | —（同值） | number | 正文 |
| `--ds-weight-medium` | 500 | —（同值） | number | 标签 / 按钮 |
| `--ds-weight-semibold` | 600 | —（同值） | number | 标题 |
| `--ds-weight-bold` | 700 | —（同值） | number | 强强调 |
| `--ds-numeric-tabular` | tabular-nums | —（同值） | keyword | 金额 / 余额 / Token 数 / 价格 / 用量 / 订单号 / 指标 |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-04` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `disabled` / `error` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
.amount {
  font-size: var(--ds-text-base);
  line-height: var(--ds-leading-base);
  font-variant-numeric: var(--ds-numeric-tabular);
  font-family: var(--ds-font-mono);
}
```

### 等宽标题层级（Heading 变体）

模型 ID 类标识符需等宽显示时，用 Heading 的等宽标题族，按语义层级选档，**不得手写 `font-mono` 或裸字号补偿**：

| Heading 变体 | Token | 字号 / 行高 / 字重 | 用途 | HTML 语义 |
|---|---|---|---|---|
| `mono-page-title` | `--ds-text-mono-page-title` / `--ds-line-mono-page-title` | 20 / 26 / 600 | 页面级，定价页**模型详情**标题 | `h1` |
| `mono-section-title` | `--ds-text-mono-section-title` / `--ds-line-mono-section-title` | 16 / 22 / 600 | 区块级，定价页**模型卡片**标题 | `h3` |

规则：

1. 两档与无衬线族的 `page-title`（36px）、`section-title`（30px）**不是同一层级映射**——等宽字形视觉更宽，详情页标题从 36px 降为 20px 等宽后视觉重量才与正文协调；不要把等宽档当作无衬线档的等宽替换。
2. 等宽由变体自带 `font-family: var(--font-mono)`，调用方不得再传 `className='font-mono'`。
3. 语义层级由 `level` 显式声明（详情页 `h1`、卡片 `h3`），视觉档位与 HTML 层级分离。
4. 字号与行高只能在 `tokens/typography.css` 的 `@theme` 声明（T1），经 `semantic.css` 派生 `--ds-*` 后由 `foundations/typography.css` 的 `.ds-heading--*` 消费；`tokens.test.ts` 的 LADDER / MAPPING / 行高兜底三方守卫必须同步更新。

## 7. Do

- 保留现有中英文回退链
- 长文本用 16px/26px
- 所有数字列右对齐 + tabular-nums
- 模型详情页标题用 `mono-page-title`（20px 等宽），模型卡片标题用 `mono-section-title`（16px 等宽）

## 8. Don't

- 引入新字体替换 UI 栈
- 在组件写死 `line-height: 20px`
- 把 12px 用于正文段落
- 在等宽标题上再手写 `className='font-mono'` 或裸字号，或使用已废弃的等宽标题档名
- 把无衬线页面标题（36px）当作等宽详情页标题的替换档

## 9. Accessibility

- 普通可见文字 ≥12px
- 正文对比度 ≥4.5:1
- 中英混排不得因 CJK 回退破坏等宽

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- ≤480px 与桌面共用同一套字号阶梯，不另设移动字号
- H5 输入框 ≥16px

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 字体栈与 theme.css:301-328 逐字比对一致
2. 10 档字号 / 11 档行高 / 4 档字重全部存在
3. 本模块引用的每个 Token 必须能在 TOKEN-MANIFEST.json 中解析，且 CSS / TS / Showcase 三处数值一致
4. check-design-system-8.0.0.mjs 对应检查项 EXIT=0
5. Light / Dark 两套映射完整，无缺失键、无主题特例裸色值
6. Do / Don’t 中的反例在全库静态扫描中命中数为 0（或已登记进 EXCEPTION-REGISTRY.json）

| 检查项 | 执行方式 | 当前结果 |
|---|---|---|
| Token 一致性 | `node web/scripts/check-design-system-8.0.0.mjs` | 见 UDS-8.0.0-FINAL-IMPLEMENTATION-AND-ACCEPTANCE-REPORT.md |
| 对比度 | `node registry/contrast-engine.mjs` | `PASS` |
| 数值冻结 | 1001 点渐变采样 + syntax / text / brand-solid 实算 | `PASS` |
| 视觉审核 | Showcase 人工审核 | `PENDING_USER_REVIEW` |
| 产品迁移 | Phase 6 | `NOT_STARTED`（须先视觉冻结） |

## 12. 注册记录与关联

| 项目 | 值 |
|---|---|
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS8-S04` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `03 Color System Standard` |
| 下一模块 | `05 Spacing and Sizing Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
