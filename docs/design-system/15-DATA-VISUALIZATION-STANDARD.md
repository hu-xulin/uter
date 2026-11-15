# UTER DESIGN SYSTEM 7.0 · 15 Data Visualization Standard

> **规范编号** `UDS7-S15` · **唯一文件** `15-DATA-VISUALIZATION-STANDARD.md` · **版本** `7.0.0` · **状态** `ACCEPTANCE_READY`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Data Integrity / Clarity / Accessibility
> **视觉审核入口** [`SHOWCASE-7.0.html`](./SHOWCASE-7.0.html#mod-15)

---

## 1. Overview

Chart Palette、折线 / 柱 / 面积 / 饼 / 环图、Tooltip、Legend、Axis、Grid、Empty / Loading / Error，图表色不得当作语法色。

本模块属于 7.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。7.0 为完整重建，5.0 及更早版本只用于识别历史文件、识别现有代码依赖与迁移风险分析，**不作为本模块的视觉设计依据**。当前运行时强制标准仍为 3.0；7.0 视觉基线已于 2026-11-15 经用户授权冻结（`VISUAL-BASELINE.json`），全站迁移按 Phase 6 分期执行。

| 属性 | 值 |
|---|---|
| 状态 | `ACCEPTANCE_READY`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. 5 色图表调色板：Light #2563EB / #0891B2 / #7C3AED / #EA580C / #059669；Dark #60A5FA / #22D3EE / #A78BFA / #FB923C / #34D399
2. 相邻系列必须同时有色相差与明度差；红绿色盲模拟下 chart-1 与 chart-5 可区分
3. 图表背景固定 `--ds-color-surface-base`；网格线 1px `--ds-color-border-divider`；坐标轴文字 12px/18px `--ds-color-text-secondary`
4. 折线宽 2px、数据点半径 4px；柱状图柱间距 8px、圆角 `--ds-radius-sm` 3px
5. 面积图填充为该系列色的 12% 透明度（由 `--ds-color-chart-*-soft` 派生，不写死 rgba）
6. 饼 / 环图：环宽 24px、起始角 -90°，扇区间隙 2px；中心显示总量，16px/24px semibold + tabular-nums
7. Tooltip：surface-raised + 1px 边框 + elevation-3，文字 12px/18px，数值 tabular-nums 右对齐
8. Legend：12px/18px，色块 8×8px 圆角 2px；点击可切换系列可见性
9. Empty / Loading / Error 三态复用 32 号规范；Error 必须提供「重试」按钮
10. 图表数值标签 ≥3:1，数据点 ≥3:1；不得只靠颜色区分系列
11. 禁止用 `--ds-color-chart-*` 作为 `--ds-syntax-*` 或 Terminal 色

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-7.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-color-chart-1` | #0088FF | #11A0FF | color | 系列 1 蓝 |
| `--ds-color-chart-2` | #7F13F8 | #7965E6 | color | 系列 2 紫 |
| `--ds-color-chart-3` | #009F80 | #00A37B | color | 系列 3 青 |
| `--ds-color-chart-4` | #EA315B | #FF4178 | color | 系列 4 红 |
| `--ds-color-chart-5` | #29844A | #32D15C | color | 系列 5 绿 |
| `--ds-color-surface-base` | #FFFFFF | #111827 | color | 卡片 / 面板基础表面 |
| `--ds-color-border-divider` | #E2E8F0 | #1F2A3D | color | 分隔线 |
| `--ds-text-2xs` | 12px | —（同值） | px | 最小可见文字（全站下限） |
| `--ds-elevation-3` | 0 8px 24px rgba(15, 23, 42, 0.12) | —（同值） | css | 下拉 / Popover |
| `--ds-radius-sm` | 3px | —（同值） | px | 小控件 |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-15` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `loading` / `error` / `empty` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
const series = [1,2,3,4,5].map(i => `var(--ds-color-chart-${i})`)
```

## 7. Do

- 系列色用 chart Token
- Error 态给重试按钮

## 8. Don't

- 用 chart-1..5 给 JSON 编辑器上色
- 用颜色单独区分系列

## 9. Accessibility

- 数据点 / 标签 ≥3:1
- 色觉缺陷模拟下可区分

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- <768px 图表高度由 320px 降为 240px，Legend 移至图表下方

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 5 色 Light / Dark 齐全
2. chart 与 syntax 无交叉引用
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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS7-S15` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `14 Content and Writing Standard` |
| 下一模块 | `16 Density and Information Hierarchy Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
