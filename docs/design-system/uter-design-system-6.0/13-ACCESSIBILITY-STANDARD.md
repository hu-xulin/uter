# UTER DESIGN SYSTEM 6.0 · 13 Accessibility Standard

> **规范编号** `UDS6-S13` · **唯一文件** `13-ACCESSIBILITY-STANDARD.md` · **版本** `6.0.0` · **状态** `IMPLEMENTED_NOT_VERIFIED`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Accessibility / Reliability
> **视觉审核入口** [`SHOWCASE-6.0.html`](./SHOWCASE-6.0.html#mod-13)

---

## 1. Overview

目标 WCAG 2.2 AA：对比度、键盘、Focus Visible / Not Obscured、Screen Reader、Reduced Motion、高对比度、色觉缺陷、触控目标、表单错误关联。

本模块属于 6.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。6.0 为完整重建，5.0 及更早版本只用于识别历史文件、识别现有代码依赖与迁移风险分析，**不作为本模块的视觉设计依据**。当前运行时强制标准仍为 3.0；6.0 视觉基线已于 2026-11-15 经用户授权冻结（`VISUAL-BASELINE.json`），全站迁移按 Phase 6 分期执行。

| 属性 | 值 |
|---|---|
| 状态 | `IMPLEMENTED_NOT_VERIFIED`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. 普通文字 ≥4.5:1，大号文字（≥24px 或 ≥18.66px bold）≥3:1，UI 组件边界与状态指示 ≥3:1
2. 键盘导航：所有交互元素可 Tab 到达；浮层打开焦点移入、关闭归还、Tab 循环不逃逸
3. Focus Visible：2px 焦点环 + 2px offset；Focus Not Obscured：Sticky Header 不得遮挡聚焦元素
4. Screen Reader：所有控件有 Accessible Name；图标按钮有 aria-label；状态变化用 aria-live
5. Reduced Motion：prefers-reduced-motion 下动画降至 0.01ms
6. 高对比度模式：forced-colors: active 下保留边框与焦点可见性，不依赖背景色
7. 色觉缺陷：success / danger / chart 系列不得仅靠色相区分，必须配合图标、文字或明度差
8. 触控目标 ≥44×44px，相邻目标间距 ≥8px
9. 表单错误：aria-invalid="true" + aria-describedby 指向错误文案；错误文案同时含图标与文字
10. 禁止通过登记例外掩盖普通正文对比度缺陷；例外仅允许 WCAG 明确豁免的 disabled 控件等

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-6.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-focus-ring-width` | 2px | —（同值） | px | 焦点环宽度 |
| `--ds-focus-ring-offset` | 2px | —（同值） | px | 焦点环偏移 |
| `--ds-color-focus-ring` | #5B5EE6 | #8B8DF5 | color | 焦点环颜色 |
| `--ds-control-touch` | 44px | —（同值） | px | Touch 最小触控目标 / H5 |
| `--ds-text-2xs` | 12px | —（同值） | px | 最小可见文字（全站下限） |
| `--ds-color-border-danger` | #B91C1C | #FCA5A5 | color | 错误态边框 |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-13` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `focus` / `disabled` / `error` / `loading` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
<input aria-invalid="true" aria-describedby="amount-error" />
<p id="amount-error" role="alert"><AlertIcon /> 金额必须大于 0</p>
```

## 7. Do

- 所有错误态同时给图标 + 文字
- 用 aria-describedby 关联错误

## 8. Don't

- 用 EXCEPTION-REGISTRY 掩盖正文低对比度
- 只用颜色区分图表系列

## 9. Accessibility

- WCAG 2.2 AA 全项
- axe-core / 对比度 / 键盘 / 焦点 / 屏幕阅读器 / reduced-motion 六类检查

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- <768px 触控目标仍 ≥44px

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. contrast-engine.mjs VERDICT=PASS
2. text / syntax / gradient / brand-solid 全部达标
3. 本模块引用的每个 Token 必须能在 TOKEN-MANIFEST.json 中解析，且 CSS / TS / Showcase 三处数值一致
4. check-design-system-6.0.mjs 对应检查项 EXIT=0
5. Light / Dark 两套映射完整，无缺失键、无主题特例裸色值
6. Do / Don’t 中的反例在全库静态扫描中命中数为 0（或已登记进 EXCEPTION-REGISTRY.json）

| 检查项 | 执行方式 | 当前结果 |
|---|---|---|
| Token 一致性 | `node web/scripts/check-design-system-6.0.mjs` | 见 FINAL-ACCEPTANCE-REPORT.md |
| 对比度 | `node registry/contrast-engine.mjs` | `PASS` |
| 数值冻结 | 1001 点渐变采样 + syntax / text / brand-solid 实算 | `PASS` |
| 视觉审核 | Showcase 人工审核 | `PENDING_USER_REVIEW` |
| 产品迁移 | Phase 6 | `NOT_STARTED`（须先视觉冻结） |

## 12. 注册记录与关联

| 项目 | 值 |
|---|---|
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS6-S13` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `12 Responsive Design Standard` |
| 下一模块 | `14 Content and Writing Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
