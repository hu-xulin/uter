# UTER DESIGN SYSTEM 7.0 · 35 Design Governance Standard

> **规范编号** `UDS7-S35` · **唯一文件** `35-DESIGN-GOVERNANCE-STANDARD.md` · **版本** `7.0.0` · **状态** `ACCEPTANCE_READY`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Consistency / Reliability / Predictability
> **视觉审核入口** [`SHOWCASE-7.0.html`](./SHOWCASE-7.0.html#mod-35)

---

## 1. Overview

Token / Component / Page / Dependency Graph / Acceptance Matrix / Deprecated / Exception Registry、Automated Checks、Visual Regression、CI Gate；所有规范必须能被自动检查。

本模块属于 7.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。7.0 为完整重建，5.0 及更早版本只用于识别历史文件、识别现有代码依赖与迁移风险分析，**不作为本模块的视觉设计依据**。当前运行时强制标准仍为 3.0；7.0 视觉基线已于 2026-11-15 经用户授权冻结（`VISUAL-BASELINE.json`），全站迁移按 Phase 6 分期执行。

| 属性 | 值 |
|---|---|
| 状态 | `ACCEPTANCE_READY`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. 八份注册表：TOKEN-REGISTRY.json / COMPONENT-REGISTRY.json / PAGE-REGISTRY.json / DEPENDENCY-GRAPH.json / ACCEPTANCE-MATRIX.json / DEPRECATED-REGISTRY.json / EXCEPTION-REGISTRY.json + TOKEN-MANIFEST.json
2. 所有注册表由 build.mjs 从 TOKEN-MANIFEST.json + 真实仓库扫描生成；禁止手工维护第二份数值
3. Automated Checks：`check-design-system-7.0.mjs` 覆盖 Token 唯一性 / 完整性 / Light-Dark 完整性 / 未登记色值 / 未登记字号 / 未登记间距 / 未登记圆角 / 未登记阴影 / 未登记动效 / 依赖一致性 / Registry 一致性 / 渐变采样 / syntax 完整性 / 单一渐变出口
4. 组件检查：8 个基础状态 + Responsive 必须逐一登记到 ACCEPTANCE-MATRIX.json
5. 无障碍检查：axe-core / WCAG Contrast / Keyboard / Focus Visibility / Screen Reader / Reduced Motion 六类
6. Visual Regression：至少覆盖 15 类页面 / 组件 × Light / Dark × Mobile / Desktop，保留截图、差异报告、运行日志
7. CI Gate：本机门禁为 `bun run typecheck` / `lint` / `test` / `lint:design:strict` / `copyright:check` / `build:check`；7.0 检查器以独立脚本接入，未通过禁止冻结数值
8. 不得通过跳过测试、降低阈值、删除断言或扩大例外获得 PASS
9. 状态判定：IMPLEMENTED / VERIFIED / ACCEPTANCE_READY / ACCEPTED 四级严格区分；ACCEPTED 只能由用户明确给出

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-7.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-focus-ring-width` | 2px | —（同值） | px | 焦点环宽度 |
| `--ds-text-2xs` | 12px | —（同值） | px | 最小可见文字（全站下限） |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-35` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `error` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
node web/scripts/check-design-system-7.0.mjs --json
```

## 7. Do

- 所有规范挂到可自动检查项
- 门禁失败即停止

## 8. Don't

- 删断言 / 降阈值 / 扩例外换 PASS
- 手工维护第二份数值

## 9. Accessibility

- a11y 六类检查登记进 Acceptance Matrix

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- Responsive 列为每个组件的必检项

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 8 份注册表齐全
2. 检查器全部项目 EXIT=0
3. 本模块引用的每个 Token 必须能在 TOKEN-MANIFEST.json 中解析，且 CSS / TS / Showcase 三处数值一致
4. check-design-system-7.0.mjs 对应检查项 EXIT=0
5. Light / Dark 两套映射完整，无缺失键、无主题特例裸色值
6. Do / Don’t 中的反例在全库静态扫描中命中数为 0（或已登记进 EXCEPTION-REGISTRY.json）

| 检查项 | 执行方式 | 当前结果 |
|---|---|---|
| Token 一致性 | `node web/scripts/check-design-system-7.0.mjs` | 见 FINAL-ACCEPTANCE-REPORT.md |
| 对比度 | `node registry/contrast-engine.mjs` | `PASS` |
| 数值冻结 | 1001 点渐变采样 + syntax / text / brand-solid 实算 | `PASS` |
| 视觉审核 | Showcase 人工审核 | `PENDING_USER_REVIEW` |
| 产品迁移 | Phase 6 | `NOT_STARTED`（须先视觉冻结） |

## 12. 注册记录与关联

| 项目 | 值 |
|---|---|
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS7-S35` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `34 Cross-Platform Design Standard` |
| 下一模块 | `01-S Gradient Typography Standard (专项)` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
