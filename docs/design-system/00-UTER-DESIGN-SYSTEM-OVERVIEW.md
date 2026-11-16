# UTER DESIGN SYSTEM 8.0.0 · 00 Design System Overview

> **规范编号** `UDS8-S00` · **唯一文件** `00-UTER-DESIGN-SYSTEM-OVERVIEW.md` · **版本** `8.0.0` · **状态** `ACCEPTANCE_READY`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Consistency / Predictability / Accessibility
> **视觉审核入口** [`SHOWCASE-8.0.0.html`](./SHOWCASE-8.0.0.html#mod-00)

---

## 1. Overview

8.0.0 总纲：目标、原则、版本、Token 架构、文件结构、命名、组件 / 页面注册、主题、响应式、无障碍、自动化、变更、例外与废弃流程。UDS 8.0.0 是唯一现行设计系统与唯一执行依据。

本模块属于 UDS 8.0.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。UDS 8.0.0 是本仓库唯一现行设计系统与唯一执行依据；不存在并行版本、兼容层或第二套 Token。视觉基线见 `VISUAL-BASELINE.json`。

| 属性 | 值 |
|---|---|
| 状态 | `ACCEPTANCE_READY`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. 五层架构固定为 Primitive Tokens → Semantic Tokens → Component Tokens → Component Specifications → Page Templates；业务页面不得直接引用未经登记的 Primitive 色值
2. 唯一数据源为 TOKEN-MANIFEST.json；CSS、TypeScript、Showcase、规范文档、自动化检查全部从它派生，禁止多处重复定义同一 Token
3. 统一单位：字体 / 行高 / 间距 / 圆角 / 边框 / 图标 / 控件高度 / 断点 = px，动效 = ms，阴影 = px + rgba，颜色 = HEX / OKLCH；基础间距 4px
4. Token 命名统一 `--ds-*`；语义 Token 必须可读可追踪；同名 Token 全系统只允许定义一次
5. 36 个正式模块各自拥有唯一编号、唯一文件名、唯一注册记录；两个专项规范登记为 24-S / 01-S，不形成第二套设计系统
6. 版本管理：语义化版本 `8.0.0`；数值冻结需通过对比度引擎与 Showcase 视觉审核；变更必须写入 DESIGN-SYSTEM-CHANGELOG 并同步注册表
7. 例外管理：所有例外必须登记 EXCEPTION-REGISTRY.json，含理由、范围、失效条件；禁止用例外掩盖普通正文对比度缺陷
8. 废弃流程：旧 Token 先标记 DEPRECATED-REGISTRY.json → 依赖图确认零引用 → 从 CSS / TS / Showcase 同时移除 → 门禁复验
9. 状态定义严格区分 IMPLEMENTED / VERIFIED / ACCEPTANCE_READY / ACCEPTED；用户明确审核前不得标记 ACCEPTED
10. 当前生效状态：UDS 8.0.0 是唯一现行设计系统与唯一执行依据（ACCEPTANCE_READY，accepted 仍为 false）；运行时标量（字号/行高/圆角/间距）与图表色直接使用 TOKEN-MANIFEST 值（tokens.test.ts 三方守卫钉死）；颜色语义层 --ds-* bridge 为唯一运行时权威；视觉基线见 VISUAL-BASELINE.json

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-8.0.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-space-1` | 4px | —（同值） | px | 4 |
| `--ds-layout-max-width` | 1440px | —（同值） | px | 桌面内容最大宽度 |
| `--ds-focus-ring-width` | 2px | —（同值） | px | 焦点环宽度 |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-00` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `hover` / `focus` / `active` / `disabled` / `loading` / `error` / `success` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
/* 业务页面只允许引用 Semantic / Component Token */
.invoice-total {
  color: var(--ds-color-text-primary);
  font-size: var(--ds-text-base);
  font-variant-numeric: var(--ds-numeric-tabular);
  padding: var(--ds-space-4);
  border-radius: var(--ds-radius-xl);
}
```

## 7. Do

- 从 TOKEN-MANIFEST.json 派生所有数值
- 新增组件先查 COMPONENT-REGISTRY.json 再实现
- 把每个例外写进 EXCEPTION-REGISTRY.json

## 8. Don't

- 在业务组件写死 `#HEX` 或 px 字面量
- 让 Showcase 自己维护另一套色值
- 把 IMPLEMENTED 当作 VERIFIED 或 ACCEPTED

## 9. Accessibility

- WCAG 2.2 AA 为全系统硬门槛
- 普通文本 ≥4.5:1、大号文本 ≥3:1、非文本 ≥3:1

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- 7 档断点 360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px
- 桌面 12 列、平板 8 列、移动 4 列，内容最大宽度 1440px

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 36 + 2 份规范文件全部存在且编号唯一
2. TOKEN-MANIFEST.json 与 CSS / TS / Showcase 一致性检查 EXIT=0
3. 本模块引用的每个 Token 必须能在 TOKEN-MANIFEST.json 中解析，且 CSS / TS / Showcase 三处数值一致
4. check-design-system-8.0.0.mjs 对应检查项 EXIT=0
5. Light / Dark 两套映射完整，无缺失键、无主题特例裸色值
6. Do / Don’t 中的反例在全库静态扫描中命中数为 0（或已登记进 EXCEPTION-REGISTRY.json）

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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS8-S00` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | —（总纲） |
| 下一模块 | `01 Brand Identity Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
