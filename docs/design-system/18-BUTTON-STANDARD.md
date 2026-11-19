# UTER DESIGN SYSTEM 8.0.0 · 18 Button Standard

> **规范编号** `UDS8-S18` · **唯一文件** `18-BUTTON-STANDARD.md` · **版本** `8.0.0` · **状态** `ACCEPTANCE_READY`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Consistency / Predictability / Efficiency
> **视觉审核入口** [`SHOWCASE-8.0.0.html`](./SHOWCASE-8.0.0.html#mod-18)

---

## 1. Overview

7 变体 × 4 尺寸，8 个交互状态全部给出确定值；品牌实底按钮白字实测 5.01:1。

本模块属于 UDS 8.0.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。UDS 8.0.0 是本仓库唯一现行设计系统与唯一执行依据；颜色语义层 --ds-* bridge 为新 UI 的唯一运行时权威；现有 UDS 3.0 runtime compatibility boundary 按 ADR-0002 保留，直到项目所有者明确授权迁移并完成当前 HEAD 绑定的行为、视觉与兼容回归验证；该边界不构成并行设计系统或第二套 Token。视觉基线见 `VISUAL-BASELINE.json`。

| 属性 | 值 |
|---|---|
| 状态 | `ACCEPTANCE_READY`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. 变体：Primary / Secondary / Outline / Ghost / Destructive / Link / Icon
2. 尺寸：Small 32px、Medium 36px、Large 40px、Touch 44px；圆角统一 lg 8px
3. Primary 默认底 `--ds-color-brand-solid` #5B5EE6 + 白字（5.01:1）；Hover `--ds-color-brand-solid-hover` #494CC7（6.68:1）；Active `--ds-color-brand-solid-active` #3F42B0（8.02:1）；三态 Light / Dark 同值
4. Secondary：surface-sunken 底 + text-primary；Outline：1px border-input + transparent 底
5. Ghost：透明底 + text-secondary，Hover surface-sunken；Destructive：#B91C1C 底 + 白字
6. Link：text-link 色 + 下划线仅 Hover 出现；Icon：正方形，尺寸同 4 档，图标 16px
7. Focus：2px 焦点环 + 2px offset；Disabled：opacity 0.5 + cursor not-allowed + 不可聚焦业务动作
8. Loading：文字保留 + 前置 16px Spinner（1000ms linear），按钮宽度不变，aria-busy="true"
9. 内边距：Small 12px、Medium 16px、Large 20px、Touch 24px 横向；图标与文字间距 8px
10. 文字：Small 12px/18px、Medium/Large/Touch 14px/20px medium；不得因尺寸改变字重

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-8.0.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-control-sm` | 32px | —（同值） | px | Small 按钮 / 输入 |
| `--ds-control-md` | 36px | —（同值） | px | Medium 按钮 / 输入 |
| `--ds-control-lg` | 40px | —（同值） | px | Large 按钮 / 输入 |
| `--ds-control-touch` | 44px | —（同值） | px | Touch 最小触控目标 / H5 |
| `--ds-radius-lg` | 8px | —（同值） | px | Button / Input / Select |
| `--ds-color-brand-solid` | #5B5EE6 | —（同值） | color | 品牌实底（Light/Dark 同值，白字实测 5.01:1；Dark 不得使用浅化档做按钮底） |
| `--ds-color-brand-solid-hover` | #494CC7 | —（同值） | color | 品牌实底 Hover（白字 6.68:1） |
| `--ds-color-brand-solid-active` | #3F42B0 | —（同值） | color | 品牌实底 Active（白字 8.02:1） |
| `--ds-color-text-on-brand` | #FFFFFF | #FFFFFF | color | 品牌实底按钮前景（实测 5.01:1） |
| `--ds-color-status-danger-solid` | #B91C1C | —（同值） | color | 危险实底（Light/Dark 同值，白字 ≥4.5:1） |
| `--ds-focus-ring-width` | 2px | —（同值） | px | 焦点环宽度 |
| `--ds-motion-fast` | 100ms | —（同值） | ms | Hover / Focus |
| `--ds-text-2xs` | 12px | —（同值） | px | 最小可见文字（全站下限） |
| `--ds-text-sm` | 14px | —（同值） | px | 正文默认 |
| `--ds-leading-button` | 20px | —（同值） | px | 按钮文字 |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-18` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `hover` / `focus` / `active` / `disabled` / `loading` / `error` / `success` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
<button class="btn btn--primary" aria-busy="false">创建 API Key</button>
```

## 7. Do

- Loading 保持按钮宽度
- Primary 三态用冻结品牌实底

## 8. Don't

- 用渐变做 Primary 按钮背景
- Disabled 按钮仍触发业务动作

## 9. Accessibility

- 白字在 default/hover/active 三态 ≥4.5:1
- Icon 按钮有 aria-label
- Focus 可见且不被裁切

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- H5 默认 Touch 44px
- <480px 按钮组纵向堆叠、间距 8px

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 7 变体 × 4 尺寸 × 8 状态矩阵齐全
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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS8-S18` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `17 Navigation Standard` |
| 下一模块 | `19 Form and Input Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
