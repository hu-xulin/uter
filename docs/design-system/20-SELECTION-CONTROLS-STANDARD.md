# UTER DESIGN SYSTEM 8.0.0 · 20 Selection Controls Standard

> **规范编号** `UDS8-S20` · **唯一文件** `20-SELECTION-CONTROLS-STANDARD.md` · **版本** `8.0.0` · **状态** `ACCEPTANCE_READY`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Predictability / Accessibility
> **视觉审核入口** [`SHOWCASE-8.0.0.html`](./SHOWCASE-8.0.0.html#mod-20)

---

## 1. Overview

Checkbox / Radio / Switch / Select / Combobox / Multi-select / Slider / Date Picker 的交互状态与无障碍规则。

本模块属于 UDS 8.0.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。7.0 为其直接前版（2026-11-16 经用户授权升版），5.0 及更早版本只用于识别历史文件、识别现有代码依赖与迁移风险分析，**不作为本模块的视觉设计依据**。当前运行时唯一权威为 UDS 8.0.0（3.0 兼容层已退役）；8.0.0 视觉基线随升版重冻结（`VISUAL-BASELINE.json`）。

| 属性 | 值 |
|---|---|
| 状态 | `ACCEPTANCE_READY`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. Checkbox 20×20px、圆角 sm 4px、边框 1px；选中态 brand-1 底 + 白色勾；Indeterminate 用横杠
2. Radio 20×20px、full 圆；选中态 brand-1 环 + 内点 8px
3. Switch 轨道 36×20px、圆角 full；滑块 16px；开 = brand-1，关 = neutral-300；切换 150ms standard
4. Select 高度同 Input 4 档；下拉面板 surface-raised + elevation-3 + 1px 边框，最大高 320px
5. Combobox 支持输入过滤，空结果展示 Empty 状态；选项高 36px，Hover surface-sunken
6. Multi-select 已选项为 full 圆角 Tag，可单独移除；Tag 高 24px、字号 12px
7. Slider 轨道 4px、滑块 16px；键盘方向键步进 1、PageUp/PageDown 步进 10；aria-valuenow/min/max 必填
8. Date Picker 面板宽 320px，日期格 36×36px；今天 1px brand-1 边框，选中 brand-1 实底
9. 所有控件 8 状态齐全；Disabled 不参与 Tab；Focus 2px 焦点环

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-8.0.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-radius-sm` | 4px | —（同值） | px | 小控件 |
| `--ds-radius-full` | 9999px | —（同值） | px | 圆形 / 胶囊 |
| `--ds-color-brand-1` | #5B5EE6 | #8B8DF5 | color | 品牌主色 / Dark 浅化档 |
| `--ds-color-border-input` | #CBD5E1 | #3B4A63 | color | 输入框边框 |
| `--ds-color-surface-raised` | #FFFFFF | #1B2436 | color | 浮起表面（弹层 / 下拉） |
| `--ds-elevation-3` | 0 8px 24px rgba(15, 23, 42, 0.12) | —（同值） | css | 下拉 / Popover |
| `--ds-control-md` | 36px | —（同值） | px | Medium 按钮 / 输入 |
| `--ds-motion-normal` | 150ms | —（同值） | ms | Active / 微交互 |
| `--ds-focus-ring-width` | 2px | —（同值） | px | 焦点环宽度 |
| `--ds-text-2xs` | 12px | —（同值） | px | 最小可见文字（全站下限） |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-20` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `hover` / `focus` / `active` / `disabled` / `loading` / `error` / `success` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
<input type="checkbox" aria-checked="mixed" />
<div role="slider" aria-valuemin="0" aria-valuemax="100" aria-valuenow="40" tabindex="0">
```

## 7. Do

- Slider 提供 aria-value* 三件套
- 多选 Tag 可单独移除

## 8. Don't

- Disabled 控件保留 Tab 焦点
- 只用颜色表达选中

## 9. Accessibility

- 角色与状态属性完整
- 键盘可操作全部控件

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- <768px 控件触控目标 ≥44px，Date Picker 铺满宽度

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 8 类控件 × 8 状态矩阵齐全
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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS8-S20` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `19 Form and Input Standard` |
| 下一模块 | `21 Feedback and Status Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
