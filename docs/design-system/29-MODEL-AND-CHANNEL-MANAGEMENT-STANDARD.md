# UTER DESIGN SYSTEM 8.0.0 · 29 Model and Channel Management Standard

> **规范编号** `UDS8-S29` · **唯一文件** `29-MODEL-AND-CHANNEL-MANAGEMENT-STANDARD.md` · **版本** `8.0.0` · **状态** `ACCEPTANCE_READY`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Data Integrity / Clarity
> **视觉审核入口** [`SHOWCASE-8.0.0.html`](./SHOWCASE-8.0.0.html#mod-29)

---

## 1. Overview

Model Card / Channel Card / Model Pricing / Channel Health / Routing / Availability / Provider / Status。

本模块属于 UDS 8.0.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。7.0 为其直接前版（2026-11-16 经用户授权升版），5.0 及更早版本只用于识别历史文件、识别现有代码依赖与迁移风险分析，**不作为本模块的视觉设计依据**。当前运行时唯一权威为 UDS 8.0.0（3.0 兼容层已退役）；8.0.0 视觉基线随升版重冻结（`VISUAL-BASELINE.json`）。

| 属性 | 值 |
|---|---|
| 状态 | `ACCEPTANCE_READY`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. Model Card：圆角 8px、内边距 16px、模型名 16px/24px semibold 等宽、Provider Badge 24px
2. Channel Card：显示健康度（Progress 4px）、延迟（ms，tabular-nums）、状态 Badge
3. Model Pricing：Table 价格列右对齐等宽，单位 `¥/1K tokens` 固定显示
4. Channel Health：healthy / degraded / down 三态，取 success / warning / danger，且附文字与图标
5. Routing：优先级用 Drag handle + 序号（tabular-nums），权重百分比右对齐等宽
6. Availability：可用 / 不可用 Switch 控制，状态变化 150ms
7. Provider：图标 20px + 名称 14px/22px；不得使用未经授权的品牌视觉资产
8. Status 统一映射与 21 号规范一致；不得另造状态颜色

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-8.0.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-radius-card` | var(--ds-radius-lg) | —（同值） | token-ref | Card = 8px |
| `--ds-space-4` | 16px | —（同值） | px | 16 |
| `--ds-text-base` | 16px | —（同值） | px | 长文本默认 / 指标数值 / H5 输入 |
| `--ds-leading-base` | 24px | —（同值） | px | 16px 长文本 / 控件 |
| `--ds-font-mono` | ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace, 'Source Han Sans SC', 'Source Han Sans CN', '思源黑体', 'Noto Sans SC Variable', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif | —（同值） | stack | 等宽字体栈（CJK 回退置于 monospace 之后，保持拉丁等宽） |
| `--ds-radius-full` | 9999px | —（同值） | px | 圆形 / 胶囊 |
| `--ds-numeric-tabular` | tabular-nums | —（同值） | keyword | 金额 / 余额 / Token 数 / 价格 / 用量 / 订单号 / 指标 |
| `--ds-color-status-success` | #15803D | #6EE7B7 | color | 成功 |
| `--ds-color-status-warning` | #A54600 | #FCD34D | color | 警告 |
| `--ds-color-status-danger` | #B91C1C | #FCA5A5 | color | 危险 |
| `--ds-motion-normal` | 150ms | —（同值） | ms | Active / 微交互 |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-29` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `hover` / `loading` / `error` / `disabled` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
<ModelCard name="gpt-4o" provider="OpenAI" price="¥ 0.0300 / 1K tokens" />
```

## 7. Do

- 模型名 / 价格用等宽
- 健康度三态附文字

## 8. Don't

- 为渠道健康度另造颜色
- 复制第三方品牌资产

## 9. Accessibility

- 状态有文字与图标
- 拖拽排序提供键盘替代

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- <768px Model Card 单列、价格表转卡片

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 8 类组件规格齐全
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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS8-S29` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `28 API and Token Management Standard` |
| 下一模块 | `30 Dashboard Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
