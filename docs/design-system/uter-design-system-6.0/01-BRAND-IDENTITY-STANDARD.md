# UTER DESIGN SYSTEM 6.0 · 01 Brand Identity Standard

> **规范编号** `UDS6-S01` · **唯一文件** `01-BRAND-IDENTITY-STANDARD.md` · **版本** `6.0.0` · **状态** `IMPLEMENTED_NOT_VERIFIED`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Clarity / Consistency / Hierarchy
> **视觉审核入口** [`SHOWCASE-6.0.html`](./SHOWCASE-6.0.html#mod-01)

---

## 1. Overview

Uter 是面向开发者、企业与 API 使用者的 AI Token 中转站。品牌表达服务专业性与可信度，不覆盖状态色、图表色与语法色。渐变文字专项规范登记为 01-S。

本模块属于 6.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。6.0 为完整重建，5.0 及更早版本只用于识别历史文件、识别现有代码依赖与迁移风险分析，**不作为本模块的视觉设计依据**。当前运行时强制标准仍为 3.0；6.0 数值冻结与全站迁移须在用户视觉审核通过后按 Phase 5 → Phase 6 顺序执行。

| 属性 | 值 |
|---|---|
| 状态 | `IMPLEMENTED_NOT_VERIFIED`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. 品牌定位：AI Token 中转站 / 开发者基础设施；视觉气质 = 专业、可信、克制、现代
2. Logo 最小尺寸：完整字标宽度 ≥96px、高度 ≥24px；独立图形标 24×24px；小于该尺寸只允许使用图形标
3. Logo 安全空间：四周各 ≥ `--ds-space-3` (12px)，且不小于 Logo 高度的 25%
4. Light 版本：字标 `--ds-color-text-primary` #0F172A，图形标 `--ds-color-brand-1` #5B5EE6
5. Dark 版本：字标 `--ds-color-text-primary` #F1F5F9，图形标 `--ds-color-brand-1` #8B8DF5
6. 品牌主色 `#5B5EE6`（Light）/ `#8B8DF5`（Dark）；品牌实底按钮使用 `--ds-color-brand-solid`（Light / Dark 同值 `#5B5EE6`，**不得用 Dark 浅化档做按钮底**），前景 `#FFFFFF` 实测 5.01:1；Hover / Active 走 `--ds-color-brand-solid-hover/active`
7. 辅助品牌色 `#494CC7` / `#3F42B0`（Light 深档），`#A1A3F7` / `#B7B8FA`（Dark 浅档）
8. 品牌渐变：仅允许 `--ds-gradient-utility` = `ds-text-gradient-brand` 单一出口；Light `#1D4ED8 → #6D28D9 → #7E22CE`，Dark `#93C5FD → #C4B5FD → #D8B4FE`，方向 90deg in srgb（CSS 插值空间与对比度引擎一致）
9. 品牌字体：只允许 `var(--ds-font-ui)`；禁止引入 Geist / Roboto / 其它新字体
10. 使用边界：品牌色不得代替 success / warning / danger / info 状态色，不得代替 chart-1..5，不得代替 syntax-*；不得在金额、余额、API Key、错误信息上使用渐变
11. 禁止引入第三方品牌标识、「Secured by Clerk」类文案或未经授权视觉资产

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-6.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-color-brand-1` | #5B5EE6 | #8B8DF5 | color | 品牌主色 / Dark 浅化档 |
| `--ds-color-brand-2` | #494CC7 | #A1A3F7 | color | 品牌深一档 / Dark 浅化档 |
| `--ds-color-brand-3` | #3F42B0 | #B7B8FA | color | 品牌深二档 / Dark 浅化档 |
| `--ds-color-brand-solid` | #5B5EE6 | —（同值） | color | 品牌实底（Light/Dark 同值，白字实测 5.01:1；Dark 不得使用浅化档做按钮底） |
| `--ds-color-brand-solid-hover` | #494CC7 | —（同值） | color | 品牌实底 Hover（白字 6.68:1） |
| `--ds-color-brand-solid-active` | #3F42B0 | —（同值） | color | 品牌实底 Active（白字 8.02:1） |
| `--ds-color-gradient-light-from` | #1D4ED8 | —（同值） | color | Light 起点 0% |
| `--ds-color-gradient-light-via` | #6D28D9 | —（同值） | color | Light 中点 50% |
| `--ds-color-gradient-light-to` | #7E22CE | —（同值） | color | Light 终点 100% |
| `--ds-color-gradient-dark-from` | #93C5FD | —（同值） | color | Dark 起点 0% |
| `--ds-color-gradient-dark-via` | #C4B5FD | —（同值） | color | Dark 中点 50% |
| `--ds-color-gradient-dark-to` | #D8B4FE | —（同值） | color | Dark 终点 100% |
| `--ds-gradient-direction` | 90deg | —（同值） | css | linear-gradient(90deg in srgb, from 0%, via 50%, to 100%) |
| `--ds-gradient-utility` | ds-text-gradient-brand | —（同值） | identifier | 全站唯一渐变出口 |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-01` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `hover` / `active` / `disabled` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
<!-- 唯一渐变出口 -->
<h1 class="ds-text-gradient-brand">Uter · AI Token 中转站</h1>
<!-- 禁止：业务组件手写渐变 -->
<!-- <h1 style="background:linear-gradient(...);background-clip:text">…</h1> -->
```

## 7. Do

- Hero / CTA / 经批准的品牌展示标题使用 `ds-text-gradient-brand`
- Logo 保持 12px 安全空间
- 品牌实底按钮始终用 #5B5EE6 + 白字

## 8. Don't

- 用品牌紫表示支付成功
- 把 chart-3 紫色当作品牌色
- 手写 `linear-gradient` / `bg-clip-text` / `text-transparent`

## 9. Accessibility

- 渐变文字全区间 ≥4.5:1（1001 点采样 × 7 背景：Light 5.99:1 / Dark 8.37:1）
- 历史渐变 Light 2.27:1 / Dark 3.92:1 不达标，E28 例外在 6.0 注销

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- ≤480px：Hero 使用 `--ds-text-4xl` 36px/44px，字标宽度不小于 96px
- ≥1440px：Hero 使用 `--ds-text-5xl` 48px/56px

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 全库 `linear-gradient` + `background-clip:text` 手写组合命中数 = 0（唯一出口除外）
2. 品牌实底三态白字对比度 5.01 / 6.68 / 8.02:1 全部 ≥4.5:1
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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS6-S01` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `00 Design System Overview` |
| 下一模块 | `02 Design Principles Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
