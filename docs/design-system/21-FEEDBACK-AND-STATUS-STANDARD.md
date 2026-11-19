# UTER DESIGN SYSTEM 8.0.0 · 21 Feedback and Status Standard

> **规范编号** `UDS8-S21` · **唯一文件** `21-FEEDBACK-AND-STATUS-STANDARD.md` · **版本** `8.0.0` · **状态** `ACCEPTANCE_READY`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Reliability / Clarity / Predictability
> **视觉审核入口** [`SHOWCASE-8.0.0.html`](./SHOWCASE-8.0.0.html#mod-21)

---

## 1. Overview

Toast / Alert / Badge / Banner / Tooltip / Inline Feedback / Loading / Success / Warning / Error，并统一 8 类业务状态映射。

本模块属于 UDS 8.0.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。UDS 8.0.0 是本仓库唯一现行设计系统与唯一执行依据；颜色语义层 --ds-* bridge 为新 UI 的唯一运行时权威；现有 UDS 3.0 runtime compatibility boundary 按 ADR-0002 保留，直到项目所有者明确授权迁移并完成当前 HEAD 绑定的行为、视觉与兼容回归验证；该边界不构成并行设计系统或第二套 Token。视觉基线见 `VISUAL-BASELINE.json`。

| 属性 | 值 |
|---|---|
| 状态 | `ACCEPTANCE_READY`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. Toast：宽 360px、圆角 10px、surface-raised + elevation-3；进入 200ms / 停留 5000ms / 退出 150ms；role="status"
2. Alert：4 种语义（success / warning / danger / info），soft 底 + 1px border + 16px 图标 + 标题 14px + 说明 12px
3. Badge：高 24px、full 圆角、12px/18px medium；状态色取对应 status-on + status-soft
4. 营销首屏胶囊（Hero Pill Badge）：仅用于首页首屏身份标识「AI Application Infrastructure Foundation」；高 32px / full 圆角 / 1px `--ds-color-status-info-border` 20% 描边 / `--ds-color-status-info-soft` 30% 浅底 / `--ds-color-status-info` 12px（18px 行高）medium 文字；左侧双色脉冲点 6px（ping 层 info 60% + 实心 info，脉冲沿用 `animate-ping`，不新增动效 Token）。该效果锚定上游 new-api `sections/hero.tsx` 的蓝色胶囊（`blue-500/20` 描边、`blue-500/5` 浅底、`blue-600` 文字、11px 字号）；按 §1.2 全站下限把 11px 提至 `--ds-text-2xs`（12px），蓝系裸色一律翻成 info 语义 Token，Light / Dark 由同名 Token 映射，禁止在业务组件写上游裸类
5. Banner：页面顶部通栏，高 48px，不可关闭的系统级提示必须说明持续时间
6. Tooltip：surface-tooltip 底 + 文字 12px/18px + elevation-2，延迟 200ms 显示，Esc 可关闭
7. Inline Feedback：表单控件下方 4px、12px/18px + 图标；成功 / 错误用对应 status Token
8. Loading：Spinner 16px / 1000ms linear；超过 300ms 才显示，避免闪烁；Skeleton 用 surface-sunken
9. 业务状态统一映射：API Key / Channel / Model / Payment / Refund / Order / Task / Account 各有 enabled|disabled|error|pending 四态，颜色与文案固定
10. 支付 / 退款 / 余额状态不得用渐变或弱化色；危险状态必须同时有图标与文字

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-8.0.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-color-status-success` | #15803D | #6EE7B7 | color | 成功 |
| `--ds-color-status-success-soft` | #DCFCE7 | #064E3B | color | 成功浅底 |
| `--ds-color-status-warning` | #A54600 | #FCD34D | color | 警告 |
| `--ds-color-status-danger` | #B91C1C | #FCA5A5 | color | 危险 |
| `--ds-color-status-info` | #1D4ED8 | #93C5FD | color | 信息 |
| `--ds-color-status-info-soft` | #DBEAFE | #172554 | color | 信息浅底 |
| `--ds-color-status-info-border` | #93C5FD | #1E40AF | color | 信息边框 |
| `--ds-radius-lg` | 8px | —（同值） | px | Button / Input / Select |
| `--ds-radius-full` | 9999px | —（同值） | px | 圆形 / 胶囊 |
| `--ds-elevation-3` | 0 8px 24px rgba(15, 23, 42, 0.12) | —（同值） | css | 下拉 / Popover |
| `--ds-text-sm` | 14px | —（同值） | px | 正文默认 |
| `--ds-text-2xs` | 12px | —（同值） | px | 最小可见文字（全站下限） |
| `--ds-motion-moderate` | 200ms | —（同值） | ms | Dropdown / Tooltip |
| `--ds-motion-normal` | 150ms | —（同值） | ms | Active / 微交互 |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-21` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `loading` / `success` / `warning` / `error` / `disabled` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
<div role="status" class="toast toast--success"><CheckIcon/> 充值成功 ¥ 100.00</div>
/* Hero Pill Badge：上游蓝色效果按 §21 映射为 info 语义 Token，字号取全站下限 12px */
<div class="landing-animate-fade-up border-info/20 bg-info-soft/30 text-info inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-2xs font-medium">
  <span class="relative flex size-1.5">
    <span class="bg-info/60 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
    <span class="bg-info relative inline-flex size-1.5 rounded-full" />
  </span>
  <span>{t("AI Application Infrastructure Foundation")}</span>
</div>
```

## 7. Do

- 8 类业务状态走统一映射表
- 危险状态给图标 + 文字
- 营销首屏胶囊按上游锚定效果取 info 语义 Token，11px 提至 12px

## 8. Don't

- 用品牌渐变做支付成功提示
- Toast 只显示颜色不显示文字
- 在 Hero 胶囊写 bg-blue-500/5 / text-blue-600 / text-[11px] 等上游裸类

## 9. Accessibility

- Toast role="status" / Alert role="alert"
- 状态不靠颜色单独表达

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- <480px Toast 宽度 = 100% − 24px，底部展示

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 8 类业务状态映射齐全
2. Hero Pill Badge 的描边 / 底 / 文字 / 字号 / 脉冲点逐项命中 §21 映射，且 lint:design:strict 与 design:8:check EXIT=0
3. 本模块引用的每个 Token 必须能在 TOKEN-MANIFEST.json 中解析，且 CSS / TS / Showcase 三处数值一致
4. check-design-system-8.0.0.mjs 对应检查项 EXIT=0
5. Light / Dark 两套映射完整，无缺失键、无主题特例裸色值
6. Do / Don’t 中的反例在全库静态扫描中命中数为 0（或已登记进 EXCEPTION-REGISTRY.json）

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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS8-S21` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `20 Selection Controls Standard` |
| 下一模块 | `22 Overlay and Floating Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
