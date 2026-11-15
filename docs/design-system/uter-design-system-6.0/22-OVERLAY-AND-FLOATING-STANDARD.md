# UTER DESIGN SYSTEM 6.0 · 22 Overlay and Floating Standard

> **规范编号** `UDS6-S22` · **唯一文件** `22-OVERLAY-AND-FLOATING-STANDARD.md` · **版本** `6.0.0` · **状态** `IMPLEMENTED_NOT_VERIFIED`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Predictability / Accessibility
> **视觉审核入口** [`SHOWCASE-6.0.html`](./SHOWCASE-6.0.html#mod-22)

---

## 1. Overview

Popover / Tooltip / Dropdown / Dialog / Drawer / Context Menu / Command Menu 统一 z-index、焦点管理、滚动锁定与关闭行为。

本模块属于 6.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。6.0 为完整重建，5.0 及更早版本只用于识别历史文件、识别现有代码依赖与迁移风险分析，**不作为本模块的视觉设计依据**。当前运行时强制标准仍为 3.0；6.0 数值冻结与全站迁移须在用户视觉审核通过后按 Phase 5 → Phase 6 顺序执行。

| 属性 | 值 |
|---|---|
| 状态 | `IMPLEMENTED_NOT_VERIFIED`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. z-index：sticky 1100 / dropdown 1200 / overlay 1300 / modal 1400 / popover 1500 / toast 1600 / tooltip 1700
2. 遮罩 rgba(15,23,42,.50) Light / rgba(2,6,16,.72) Dark；Dialog 阴影 `--ds-elevation-dialog`
3. Dialog 宽 560px、圆角 12px；Drawer 宽 400px；<480px Dialog 宽 100%−24px，<768px Drawer 宽 100%
4. 焦点管理：打开时焦点移入第一个可聚焦元素，Tab 在浮层内循环，关闭时归还触发元素
5. 滚动锁定：模态打开时锁定 body 滚动；关闭时恢复原滚动位置
6. 关闭行为：Esc / 点击遮罩 / 显式关闭按钮；有未保存改动的 Dialog 点击遮罩不关闭并给出确认
7. Dropdown / Context Menu 项高 36px、圆角 5px、Hover surface-sunken、键盘上下箭头导航
8. Command Menu 宽 640px、输入框高 44px、结果项 40px、支持 ↑↓ / Enter / Esc
9. 所有浮层必须标注 role / aria-modal / aria-labelledby；Tooltip 不承载可交互内容

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-6.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-z-sticky` | 1100 | —（同值） | number | Sticky |
| `--ds-z-dropdown` | 1200 | —（同值） | number | Dropdown |
| `--ds-z-overlay` | 1300 | —（同值） | number | Overlay |
| `--ds-z-modal` | 1400 | —（同值） | number | Modal / Drawer |
| `--ds-z-popover` | 1500 | —（同值） | number | Popover |
| `--ds-z-toast` | 1600 | —（同值） | number | Toast |
| `--ds-z-tooltip` | 1700 | —（同值） | number | Tooltip |
| `--ds-color-overlay-scrim` | rgba(15, 23, 42, 0.50) | rgba(2, 6, 16, 0.72) | color | 模态遮罩 |
| `--ds-elevation-dialog` | 0 24px 64px rgba(2, 6, 16, 0.32) | —（同值） | css | 对话框 |
| `--ds-layout-modal-width` | 560px | —（同值） | px | Modal 默认宽度 |
| `--ds-layout-drawer-width` | 400px | —（同值） | px | Drawer 默认宽度 |
| `--ds-radius-dialog` | var(--ds-radius-xl) | —（同值） | token-ref | Dialog = 12px |
| `--ds-control-md` | 36px | —（同值） | px | Medium 按钮 / 输入 |
| `--ds-radius-md` | 5px | —（同值） | px | 默认 |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-22` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `focus` / `loading` / `disabled` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
<div role="dialog" aria-modal="true" aria-labelledby="title">…</div>
```

## 7. Do

- 浮层内 Tab 循环 + 关闭归还焦点
- 模态锁定 body 滚动

## 8. Don't

- Tooltip 内放可点击控件
- Esc 关闭时不恢复焦点

## 9. Accessibility

- aria-modal / aria-labelledby 齐全
- Focus Not Obscured

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- <480px Dialog 近全宽
- <768px Drawer 全宽且改为底部 Sheet

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 7 类浮层行为矩阵齐全
2. 本模块引用的每个 Token 必须能在 TOKEN-MANIFEST.json 中解析，且 CSS / TS / Showcase 三处数值一致
3. check-design-system-6.0.mjs 对应检查项 EXIT=0
4. Light / Dark 两套映射完整，无缺失键、无主题特例裸色值
5. Do / Don’t 中的反例在全库静态扫描中命中数为 0（或已登记进 EXCEPTION-REGISTRY.json）

| 检查项 | 执行方式 | 当前结果 |
|---|---|---|
| Token 一致性 | `node web/scripts/check-design-system-6.0.mjs` | 见 FINAL-ACCEPTANCE-REPORT.md |
| 对比度 | `node registry/contrast-engine.mjs` | `PASS` |
| 数值冻结 | 101 点渐变采样 + syntax / text / brand-solid 实算 | `PASS` |
| 视觉审核 | Showcase 人工审核 | `PENDING_USER_REVIEW` |
| 产品迁移 | Phase 6 | `NOT_STARTED`（须先视觉冻结） |

## 12. 注册记录与关联

| 项目 | 值 |
|---|---|
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS6-S22` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `21 Feedback and Status Standard` |
| 下一模块 | `23 Data Display Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
