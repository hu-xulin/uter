# UTER DESIGN SYSTEM 8.0.0 · 34 Cross-Platform Design Standard

> **规范编号** `UDS8-S34` · **唯一文件** `34-CROSS-PLATFORM-DESIGN-STANDARD.md` · **版本** `8.0.0` · **状态** `ACCEPTANCE_READY`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Responsiveness / Reliability
> **视觉审核入口** [`SHOWCASE-8.0.0.html`](./SHOWCASE-8.0.0.html#mod-34)

---

## 1. Overview

设计目标 PC Web / H5 / Android / iOS / HarmonyOS；必须区分设计规范支持与实际产品实现状态，不得把未实现的原生应用标记为已交付。

本模块属于 UDS 8.0.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。UDS 8.0.0 是本仓库唯一现行设计系统与唯一执行依据；颜色语义层 --ds-* bridge 为新 UI 的唯一运行时权威；现有 UDS 3.0 runtime compatibility boundary 按 ADR-0002 保留，直到项目所有者明确授权迁移并完成当前 HEAD 绑定的行为、视觉与兼容回归验证；该边界不构成并行设计系统或第二套 Token。视觉基线见 `VISUAL-BASELINE.json`。

| 属性 | 值 |
|---|---|
| 状态 | `ACCEPTANCE_READY`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. PC Web：设计规范已定义、运行时由现有 React 应用承载；状态 `DESIGNED` + 迁移待执行
2. H5：设计规范已定义（7 档断点、Touch 44px、输入 ≥16px）；状态 `DESIGNED`，实际由同一 Web 应用响应式实现
3. Android / iOS / HarmonyOS：仓库内无原生工程、无跨平台框架源码；状态 `NOT_IMPLEMENTED`，仅登记设计适配原则
4. 原生适配原则（设计层）：安全区由平台处理、触控目标 ≥44px、字号沿用同一阶梯、Dark 主题映射沿用 UDS 8.0.0 Semantic Token
5. 禁止把 DESIGN SUPPORT 写成 PRODUCT DELIVERED；每项必须同时给出 designStatus 与 implementationStatus
6. 跨平台差异写入 EXCEPTION-REGISTRY.json，注明复检条件

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-8.0.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-control-touch` | 44px | —（同值） | px | Touch 最小触控目标 / H5 |
| `--ds-control-h5-input-font-size` | 16px | —（同值） | px | H5 输入字号（iOS 防自动放大） |
| `--ds-bp-sm` | 480px | —（同值） | px | Mobile |
| `--ds-bp-md` | 768px | —（同值） | px | Tablet（8 列） |
| `--ds-text-sm` | 14px | —（同值） | px | 正文默认 |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-34` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
{ "platform": "iOS", "designStatus": "DESIGNED", "implementationStatus": "NOT_IMPLEMENTED" }
```

## 7. Do

- 明确区分设计支持与实现状态

## 8. Don't

- 把未实现的原生应用标为已交付

## 9. Accessibility

- 原生平台触控目标 ≥44px

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- H5 覆盖 xs 360 / sm 480 / md 768 三档

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 5 平台状态登记齐全
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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS8-S34` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `33 Localization Standard` |
| 下一模块 | `35 Design Governance Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
