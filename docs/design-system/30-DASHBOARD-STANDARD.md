# UTER DESIGN SYSTEM 8.0.0 · 30 Dashboard Standard

> **规范编号** `UDS8-S30` · **唯一文件** `30-DASHBOARD-STANDARD.md` · **版本** `8.0.0` · **状态** `ACCEPTANCE_READY`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Hierarchy / Data Integrity / Efficiency
> **视觉审核入口** [`SHOWCASE-8.0.0.html`](./SHOWCASE-8.0.0.html#mod-30)

---

## 1. Overview

Metric Cards / Balance / Token Usage / Request Count / Error Rate / Model Usage / Channel Health / Revenue / Charts / Tables；明确指标优先级、时间范围、空 / 异常状态。

本模块属于 UDS 8.0.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。UDS 8.0.0 是本仓库唯一现行设计系统与唯一执行依据；颜色语义层 --ds-* bridge 为新 UI 的唯一运行时权威；现有 UDS 3.0 runtime compatibility boundary 按 ADR-0002 保留，直到项目所有者明确授权迁移并完成当前 HEAD 绑定的行为、视觉与兼容回归验证；该边界不构成并行设计系统或第二套 Token。视觉基线见 `VISUAL-BASELINE.json`。

| 属性 | 值 |
|---|---|
| 状态 | `ACCEPTANCE_READY`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. 指标优先级：1 余额 / 2 今日 Token 用量 / 3 请求数 / 4 错误率 / 5 收入；前 4 项为首屏 4 张 Metric Card
2. Metric Card：3 列（12 栅格中每卡 3 列）、圆角 10px、内边距 16px、数值 30px/38px semibold tabular-nums、标签 12px/18px
3. 时间范围：今天 / 7 天 / 30 天 / 自定义，默认 7 天；切换用 Tabs 且保持图表状态
4. 主图表 8 列（Token 用量折线）、侧列表 4 列（Model Usage Top 5）；图表高 320px
5. 错误率 > 1% 用 status-danger 且附警示图标；不得只变颜色
6. Channel Health 列表：每行显示名称 + 状态 Badge + 延迟（ms，等宽右对齐）
7. Revenue / Balance 数值不得用渐变；金额格式遵循 27 号规范
8. 空状态：无数据时展示 Empty 组件 + 「创建第一个 API Key」主操作；Loading 用 Skeleton；Error 用 Retry

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-8.0.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-layout-columns-desktop` | 12 | —（同值） | count | 桌面 12 列 |
| `--ds-layout-gutter-desktop` | 24px | —（同值） | px | 桌面栅格间距 |
| `--ds-radius-xl` | 10px | —（同值） | px | Card / Table / Code Block |
| `--ds-space-4` | 16px | —（同值） | px | 16 |
| `--ds-text-3xl` | 30px | —（同值） | px | 分区标题 |
| `--ds-leading-h2` | 38px | —（同值） | px | 30px 分区标题 |
| `--ds-text-2xs` | 12px | —（同值） | px | 最小可见文字（全站下限） |
| `--ds-numeric-tabular` | tabular-nums | —（同值） | keyword | 金额 / 余额 / Token 数 / 价格 / 用量 / 订单号 / 指标 |
| `--ds-color-status-danger` | #B91C1C | #FCA5A5 | color | 危险 |
| `--ds-color-chart-1` | #0088FF | #11A0FF | color | 系列 1 蓝 |
| `--ds-density-default-row` | 44px | —（同值） | px | Default 表格行高 |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-30` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `loading` / `error` / `empty` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
<MetricCard label="今日 Token 用量" value="1,284,930" unit="tokens" />
```

## 7. Do

- 按优先级排布 4 张 Metric Card
- 空 / 加载 / 错误态齐全

## 8. Don't

- 余额用渐变
- 错误率只变颜色

## 9. Accessibility

- 图表有文字摘要与数据表替代
- 指标有 aria-label

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- <768px Metric Card 单列、图表高 240px、侧列表移至下方

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 10 类元素规格齐全
2. 本模块引用的每个 Token 必须能在 TOKEN-MANIFEST.json 中解析，且 CSS / TS / Showcase 三处数值一致
3. check-design-system-8.0.0.mjs 对应检查项 EXIT=0
4. Light / Dark 两套映射完整，无缺失键、无主题特例裸色值
5. Do / Don’t 中的反例在全库静态扫描中命中数为 0（或已登记进 EXCEPTION-REGISTRY.json）

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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS8-S30` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `29 Model and Channel Management Standard` |
| 下一模块 | `31 Page Templates Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
