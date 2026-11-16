# UTER DESIGN SYSTEM 8.0.0 · 02 Design Principles Standard

> **规范编号** `UDS8-S02` · **唯一文件** `02-DESIGN-PRINCIPLES-STANDARD.md` · **版本** `8.0.0` · **状态** `ACCEPTANCE_READY`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Clarity / Consistency / Hierarchy / Accessibility / Efficiency / Predictability / Responsiveness / Reliability / Developer Experience / Data Integrity
> **视觉审核入口** [`SHOWCASE-8.0.0.html`](./SHOWCASE-8.0.0.html#mod-02)

---

## 1. Overview

十项设计原则是全部 38 份规范的裁决依据；每条规范、每个组件、每次变更都必须能对应至少一项原则。

本模块属于 UDS 8.0.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。7.0 为其直接前版（2026-11-16 经用户授权升版），5.0 及更早版本只用于识别历史文件、识别现有代码依赖与迁移风险分析，**不作为本模块的视觉设计依据**。当前运行时唯一权威为 UDS 8.0.0（3.0 兼容层已退役）；8.0.0 视觉基线随升版重冻结（`VISUAL-BASELINE.json`）。

| 属性 | 值 |
|---|---|
| 状态 | `ACCEPTANCE_READY`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. Clarity 清晰：正文默认 14px/22px，普通可见文字不得低于 12px；信息不得靠装饰传达
2. Consistency 一致：同一语义只有一个 Token 与一个组件出口，Light / Dark 共用同名 Token
3. Hierarchy 层级：标题 18/26 → 30/38 → 36/44 → 48/56，配合 surface-base / raised 与 elevation-1..3
4. Accessibility 可访问：WCAG 2.2 AA，普通文本 ≥4.5:1、大号 ≥3:1、非文本 ≥3:1
5. Efficiency 高效：控件最小 32px，触控 44px；常用操作不超过 2 次点击
6. Predictability 可预测：8 个基础状态在所有组件命名与视觉一致
7. Responsiveness 响应式：7 档断点，桌面 12 / 平板 8 / 移动 4 列
8. Reliability 可靠：金额、余额、支付状态、错误信息不得使用渐变或弱化色
9. Developer Experience 开发者体验：代码 13px/20px、等宽字体、可复制、可下载、行号可见
10. Data Integrity 数据表达准确：金额 / Token / 用量 / 订单号强制 `tabular-nums` 并右对齐
11. 原则冲突裁决顺序：Accessibility > Reliability > Data Integrity > Clarity > 其余原则

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-8.0.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-text-sm` | 14px | —（同值） | px | 正文默认 |
| `--ds-leading-body` | 22px | —（同值） | px | 14px 正文 |
| `--ds-text-2xs` | 12px | —（同值） | px | 最小可见文字（全站下限） |
| `--ds-control-touch` | 44px | —（同值） | px | Touch 最小触控目标 / H5 |
| `--ds-numeric-tabular` | tabular-nums | —（同值） | keyword | 金额 / 余额 / Token 数 / 价格 / 用量 / 订单号 / 指标 |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-02` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `hover` / `focus` / `active` / `disabled` / `loading` / `error` / `success` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
/* 原则冲突示例：品牌渐变 vs 4.5:1 → Accessibility 优先 */
.hero-title { background-image: var(--ds-gradient-6); } /* 已实测 Light 5.99:1 / Dark 8.37:1 */
```

## 7. Do

- 在规范与 PR 中标注对应原则
- 按裁决顺序解决冲突

## 8. Don't

- 以「品牌观感」为由保留低对比度正文
- 为视觉一致牺牲资金数据可读性

## 9. Accessibility

- Accessibility 为最高裁决原则
- 禁止用 EXCEPTION-REGISTRY 掩盖普通正文对比度缺陷

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- 所有原则在 7 档断点下均不得失效

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 38 份规范每份 principle 字段非空且属于 10 项之一
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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS8-S02` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `01 Brand Identity Standard` |
| 下一模块 | `03 Color System Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
