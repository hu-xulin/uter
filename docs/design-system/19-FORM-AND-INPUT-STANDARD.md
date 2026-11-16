# UTER DESIGN SYSTEM 8.0.0 · 19 Form and Input Standard

> **规范编号** `UDS8-S19` · **唯一文件** `19-FORM-AND-INPUT-STANDARD.md` · **版本** `8.0.0` · **状态** `ACCEPTANCE_READY`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Clarity / Accessibility / Reliability
> **视觉审核入口** [`SHOWCASE-8.0.0.html`](./SHOWCASE-8.0.0.html#mod-19)

---

## 1. Overview

Text / Password / Number / Search / Textarea 及 Label / Helper / Error / Prefix / Suffix / Clear / Copy / Password Visibility 的完整尺寸与状态。

本模块属于 UDS 8.0.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。7.0 为其直接前版（2026-11-16 经用户授权升版），5.0 及更早版本只用于识别历史文件、识别现有代码依赖与迁移风险分析，**不作为本模块的视觉设计依据**。当前运行时唯一权威为 UDS 8.0.0（3.0 兼容层已退役）；8.0.0 视觉基线随升版重冻结（`VISUAL-BASELINE.json`）。

| 属性 | 值 |
|---|---|
| 状态 | `ACCEPTANCE_READY`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. 控件高度 Small 32 / Medium 36 / Large 40 / Touch 44 px；圆角 lg 10px；边框 1px border-input
2. 输入文字 14px/22px；H5 输入强制 ≥16px（`--ds-control-h5-input-font-size`）防 iOS 自动放大
3. Label 12px/18px medium text-primary，与控件间距 8px；必填标记用 `*` + aria-required
4. Helper Text 12px/18px text-secondary，距控件 4px；Error Text 12px/18px status-danger + 图标 + aria-describedby
5. Prefix / Suffix 置于控件内，宽 32px，颜色 text-secondary；Clear / Copy / Password Visibility 为 16px 图标按钮，触控目标 44px
6. Hover：border-strong；Focus：2px 焦点环 + 2px offset；Error：border-danger + Error Text；Disabled：surface-sunken + text-disabled
7. Textarea 最小高 80px、可纵向缩放；Number 输入右对齐 + tabular-nums
8. Password Visibility 切换必须有 aria-label 与 aria-pressed 状态
9. 表单错误在提交时聚焦第一个错误控件；不得只靠红色边框表达错误

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-8.0.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-control-sm` | 32px | —（同值） | px | Small 按钮 / 输入 |
| `--ds-control-md` | 36px | —（同值） | px | Medium 按钮 / 输入 |
| `--ds-control-lg` | 40px | —（同值） | px | Large 按钮 / 输入 |
| `--ds-control-touch` | 44px | —（同值） | px | Touch 最小触控目标 / H5 |
| `--ds-control-h5-input-font-size` | 16px | —（同值） | px | H5 输入字号（iOS 防自动放大） |
| `--ds-radius-input` | var(--ds-radius-lg) | —（同值） | token-ref | Input = 10px |
| `--ds-border-width-input` | 1px | —（同值） | px | 输入框 |
| `--ds-color-border-input` | #CBD5E1 | #3B4A63 | color | 输入框边框 |
| `--ds-color-border-danger` | #B91C1C | #FCA5A5 | color | 错误态边框 |
| `--ds-color-text-disabled` | #94A3B8 | #64748B | color | 禁用文本（WCAG 1.4.3 禁用控件例外，已登记） |
| `--ds-text-sm` | 14px | —（同值） | px | 正文默认 |
| `--ds-text-2xs` | 12px | —（同值） | px | 最小可见文字（全站下限） |
| `--ds-focus-ring-width` | 2px | —（同值） | px | 焦点环宽度 |
| `--ds-focus-ring-offset` | 2px | —（同值） | px | 焦点环偏移 |
| `--ds-numeric-tabular` | tabular-nums | —（同值） | keyword | 金额 / 余额 / Token 数 / 价格 / 用量 / 订单号 / 指标 |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-19` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `hover` / `focus` / `disabled` / `error` / `success` / `loading` / `read-only` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
<label for="key">API Key 名称</label>
<input id="key" aria-required="true" aria-invalid="true" aria-describedby="key-err" />
<p id="key-err" role="alert"><AlertIcon/> 名称不能为空</p>
```

## 7. Do

- H5 输入 ≥16px
- 错误同时给图标 + 文字 + aria 关联

## 8. Don't

- 只用红边框表示错误
- Placeholder 代替 Label

## 9. Accessibility

- aria-invalid / aria-describedby / aria-required 齐全
- 提交时聚焦第一个错误控件

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- <768px 表单单列、控件高度 Touch 44px

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 8 状态 × 控件类型矩阵齐全
2. 本模块引用的每个 Token 必须能在 TOKEN-MANIFEST.json 中解析，且 CSS / TS / Showcase 三处数值一致
3. check-design-system-8.0.0.mjs 对应检查项 EXIT=0
4. Light / Dark 两套映射完整，无缺失键、无主题特例裸色值
5. Do / Don’t 中的反例在全库静态扫描中命中数为 0（或已登记进 EXCEPTION-REGISTRY.json）

| 检查项 | 执行方式 | 当前结果 |
|---|---|---|
| Token 一致性 | `node web/scripts/check-design-system-8.0.0.mjs` | 见 FINAL-ACCEPTANCE-REPORT.md |
| 对比度 | `node registry/contrast-engine.mjs` | `PASS` |
| 数值冻结 | 1001 点渐变采样 + syntax / text / brand-solid 实算 | `PASS` |
| 视觉审核 | Showcase 人工审核 | `PENDING_USER_REVIEW` |
| 产品迁移 | Phase 6 | `NOT_STARTED`（须先视觉冻结） |

## 12. 注册记录与关联

| 项目 | 值 |
|---|---|
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS8-S19` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `18 Button Standard` |
| 下一模块 | `20 Selection Controls Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
