# UTER DESIGN SYSTEM 8.0.0 · 03 Color System Standard

> **规范编号** `UDS8-S03` · **唯一文件** `03-COLOR-STANDARD.md` · **版本** `8.0.0` · **状态** `ACCEPTANCE_READY`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Clarity / Consistency / Accessibility / Data Integrity
> **视觉审核入口** [`SHOWCASE-8.0.0.html`](./SHOWCASE-8.0.0.html#mod-03)

---

## 1. Overview

14 类语义独立的颜色体系，各自有独立 Token 组，不得混用。所有色值经 contrast-engine 在真实背景上实算。

本模块属于 UDS 8.0.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。UDS 8.0.0 是本仓库唯一现行设计系统与唯一执行依据；颜色语义层 --ds-* bridge 为新 UI 的唯一运行时权威；现有 UDS 3.0 runtime compatibility boundary 按 ADR-0002 保留，直到项目所有者明确授权迁移并完成当前 HEAD 绑定的行为、视觉与兼容回归验证；该边界不构成并行设计系统或第二套 Token。视觉基线见 `VISUAL-BASELINE.json`。

| 属性 | 值 |
|---|---|
| 状态 | `ACCEPTANCE_READY`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. 必须独立建立的 14 类：Brand / Neutral / Text / Surface / Border / Status / Chart / Syntax / Gradient / Overlay / Focus / Selection / Code Editor / Terminal
2. 品牌色初始基线 `#5B5EE6` / `#494CC7` / `#3F42B0`（Light），`#8B8DF5` / `#A1A3F7` / `#B7B8FA`（Dark），经对比度验证后冻结
3. 中性原色板 50–900 为 Primitive，不随主题变化；Light / Dark 映射只在 Semantic 层发生
4. Surface：canvas #F8FAFC/#0B1120、base #FFFFFF/#111827、raised #FFFFFF/#1B2436、sunken #F1F5F9/#080D18、code #F6F8FA/#0E1524
5. Text：primary #0F172A/#F1F5F9、secondary 与 muted #5B6779/#94A3B8，两者在 canvas 与 surface 均 ≥4.5:1
6. Status：success #15803D/#6EE7B7、warning #A54600/#FCD34D、danger #B91C1C/#FCA5A5、info #1D4ED8/#93C5FD，并各有 soft / border / on 配套值
7. Chart 5 色：Light #2563EB / #0891B2 / #7C3AED / #EA580C / #059669；Dark #60A5FA / #22D3EE / #A78BFA / #FB923C / #34D399
8. Chart 要求：相邻系列同时具备色相差与明度差，红绿色盲模拟下可区分；图表背景用 surface-base，数据点与标签 ≥3:1
9. Syntax 20 色不得与 chart-1..5 互引；Code Editor 系列不得与 Terminal 系列互引
10. Focus 环 `#5B5EE6` / `#8B8DF5`，宽度 2px、偏移 2px，非文本对比度 ≥3:1
11. 业务页面禁止直接引用 `--ds-color-brand-*` 等 Primitive 色值，必须经 Semantic Token

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-8.0.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-color-surface-canvas` | #F8FAFC | #0B1120 | color | 页面画布 |
| `--ds-color-surface-base` | #FFFFFF | #111827 | color | 卡片 / 面板基础表面 |
| `--ds-color-text-primary` | #0F172A | #F1F5F9 | color | 主文本 |
| `--ds-color-text-secondary` | #475569 | #CBD5E1 | color | 次级文本（与 muted / tertiary 明确区分） |
| `--ds-color-border-default` | #E2E8F0 | #263349 | color | 默认边框 |
| `--ds-color-status-success` | #15803D | #6EE7B7 | color | 成功 |
| `--ds-color-status-danger` | #B91C1C | #FCA5A5 | color | 危险 |
| `--ds-color-chart-1` | #0088FF | #11A0FF | color | 系列 1 蓝 |
| `--ds-color-chart-5` | #29844A | #32D15C | color | 系列 5 绿 |
| `--ds-color-focus-ring` | #5B5EE6 | #8B8DF5 | color | 焦点环颜色 |
| `--ds-color-selection-background` | #C7D2FE | #3730A3 | color | 选区背景 |
| `--ds-color-code-background` | #F6F8FA | #0E1524 | color | 编辑器背景 |
| `--ds-color-terminal-background` | #F1F5F9 | #0A101E | color | 终端背景（Light / Dark 独立） |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-03` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `hover` / `focus` / `active` / `disabled` / `error` / `success` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
.alert--success {
  color: var(--ds-color-status-success-on);
  background: var(--ds-color-status-success-soft);
  border: var(--ds-border-width-default) solid var(--ds-color-status-success-border);
}
```

## 7. Do

- 状态与图表各用各自 Token 组
- 所有新色值先跑 contrast-engine.mjs

## 8. Don't

- 用 chart-3 紫表示语法 keyword
- 把品牌紫当作 success
- 在 Light / Dark 使用不同 Token 名表达同一语义

## 9. Accessibility

- 普通文本 ≥4.5:1、大号 ≥3:1、非文本 ≥3:1
- 色觉缺陷不得是唯一区分手段（新增/删除/错误必须另有图标或文字）

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- 颜色不随断点变化；断点只影响结构与尺寸

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 14 类颜色组全部存在且互不引用
2. text / syntax / status / brand-solid 全部实测达标
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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS8-S03` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `02 Design Principles Standard` |
| 下一模块 | `04 Typography Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
