# UTER DESIGN SYSTEM 8.0.0 · 08 Border and Divider Standard

> **规范编号** `UDS8-S08` · **唯一文件** `08-BORDER-AND-DIVIDER-STANDARD.md` · **版本** `8.0.0` · **状态** `ACCEPTANCE_READY`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Clarity / Consistency / Accessibility
> **视觉审核入口** [`SHOWCASE-8.0.0.html`](./SHOWCASE-8.0.0.html#mod-08)

---

## 1. Overview

边框宽度与颜色分离：宽度 9 个 Token、颜色 10 个 Token，Light / Dark 各自明确。

本模块属于 UDS 8.0.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。UDS 8.0.0 是本仓库唯一现行设计系统与唯一执行依据；不存在并行版本、兼容层或第二套 Token。视觉基线见 `VISUAL-BASELINE.json`。

| 属性 | 值 |
|---|---|
| 状态 | `ACCEPTANCE_READY`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. Default / Strong / Divider / Input / Card / Table / Code / Dialog Border = 1px；Focus Border = 2px
2. Light 默认边框 #E2E8F0、强边框 #CBD5E1、输入 #CBD5E1、聚焦 #5B5EE6
3. Dark 默认边框 #263349、强边框 #3B4A63、输入 #3B4A63、聚焦 #8B8DF5
4. Divider 只在语义分隔处使用；卡片内部优先用间距与表面色区分，不叠加分隔线
5. 表格仅保留横向行分隔线 1px `--ds-color-border-table`，不画竖线
6. 代码块边框 1px，配合 `--ds-radius-xl` 10px 与 `--ds-color-code-background`
7. 危险态边框使用 `--ds-color-border-danger` #B91C1C / #FCA5A5，且必须同时有错误文字
8. 聚焦边框不得替代焦点环；焦点环为 2px `--ds-focus-ring-width` + 2px offset

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-8.0.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-border-width-default` | 1px | —（同值） | px | 默认边框 |
| `--ds-border-width-strong` | 1px | —（同值） | px | 强边框（颜色更重） |
| `--ds-border-width-focus` | 2px | —（同值） | px | 聚焦边框 / 焦点环 |
| `--ds-border-width-divider` | 1px | —（同值） | px | 分隔线 |
| `--ds-border-width-input` | 1px | —（同值） | px | 输入框 |
| `--ds-border-width-card` | 1px | —（同值） | px | 卡片 |
| `--ds-border-width-table` | 1px | —（同值） | px | 表格 |
| `--ds-border-width-code` | 1px | —（同值） | px | 代码块 |
| `--ds-border-width-dialog` | 1px | —（同值） | px | 对话框 |
| `--ds-color-border-default` | #E2E8F0 | #263349 | color | 默认边框 |
| `--ds-color-border-strong` | #CBD5E1 | #3B4A63 | color | 强边框 |
| `--ds-color-border-focus` | #5B5EE6 | #8B8DF5 | color | 聚焦边框 / 焦点环 |
| `--ds-color-border-input` | #CBD5E1 | #3B4A63 | color | 输入框边框 |
| `--ds-color-border-danger` | #B91C1C | #FCA5A5 | color | 错误态边框 |
| `--ds-focus-ring-width` | 2px | —（同值） | px | 焦点环宽度 |
| `--ds-focus-ring-offset` | 2px | —（同值） | px | 焦点环偏移 |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-08` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `hover` / `focus` / `error` / `disabled` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
.input { border: var(--ds-border-width-input) solid var(--ds-color-border-input); }
.input:focus-visible { outline: var(--ds-focus-ring-width) solid var(--ds-color-focus-ring); outline-offset: var(--ds-focus-ring-offset); }
```

## 7. Do

- 宽度与颜色分别引用 Token
- 错误态同时给文字说明

## 8. Don't

- 用 border 取代 focus ring
- 表格画竖线

## 9. Accessibility

- 输入边框非文本对比度 ≥3:1
- 焦点环 ≥3:1 且不被裁切

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- 边框宽度不随断点变化

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 9 宽度 + 10 颜色 Token 齐全
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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS8-S08` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `07 Shape and Radius Standard` |
| 下一模块 | `09 Elevation and Shadow Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
