# UTER DESIGN SYSTEM 6.0 · 09 Elevation and Shadow Standard

> **规范编号** `UDS6-S09` · **唯一文件** `09-ELEVATION-AND-SHADOW-STANDARD.md` · **版本** `6.0.0` · **状态** `IMPLEMENTED_NOT_VERIFIED`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Hierarchy / Clarity
> **视觉审核入口** [`SHOWCASE-6.0.html`](./SHOWCASE-6.0.html#mod-09)

---

## 1. Overview

阴影九档，全部给出确定 px + rgba 参数；普通卡片优先用背景与边框区分层级。

本模块属于 6.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。6.0 为完整重建，5.0 及更早版本只用于识别历史文件、识别现有代码依赖与迁移风险分析，**不作为本模块的视觉设计依据**。当前运行时强制标准仍为 3.0；6.0 数值冻结与全站迁移须在用户视觉审核通过后按 Phase 5 → Phase 6 顺序执行。

| 属性 | 值 |
|---|---|
| 状态 | `IMPLEMENTED_NOT_VERIFIED`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. elevation-0 = none；elevation-1 = `0 1px 2px rgba(15,23,42,.06)`；elevation-2 = `0 2px 8px rgba(15,23,42,.10)`
2. elevation-3 = `0 8px 24px rgba(15,23,42,.12)`；elevation-4 = `0 16px 48px rgba(15,23,42,.16)`
3. overlay-shadow = `0 12px 32px rgba(2,6,16,.28)`；dropdown = `0 8px 24px rgba(15,23,42,.14)`
4. dialog = `0 24px 64px rgba(2,6,16,.32)`；drawer = `-8px 0 32px rgba(2,6,16,.24)`
5. 普通卡片默认 elevation-0 + 1px 边框 + surface-base；仅浮起卡片用 elevation-1
6. Dropdown / Popover 用 elevation-3；Modal 用 elevation-4 或 dialog；Drawer 用 drawer
7. Dark 主题下阴影不额外叠加透明度，靠 surface-raised 与边框表达层级
8. 禁止组件写死 `box-shadow: ...` 字面量

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-6.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-elevation-0` | none | —（同值） | css | 无阴影 |
| `--ds-elevation-1` | 0 1px 2px rgba(15, 23, 42, 0.06) | —（同值） | css | 轻微抬升 |
| `--ds-elevation-2` | 0 2px 8px rgba(15, 23, 42, 0.10) | —（同值） | css | 卡片 |
| `--ds-elevation-3` | 0 8px 24px rgba(15, 23, 42, 0.12) | —（同值） | css | 下拉 / Popover |
| `--ds-elevation-4` | 0 16px 48px rgba(15, 23, 42, 0.16) | —（同值） | css | 模态 |
| `--ds-elevation-overlay` | 0 12px 32px rgba(2, 6, 16, 0.28) | —（同值） | css | 通用浮层 |
| `--ds-elevation-dropdown` | 0 8px 24px rgba(15, 23, 42, 0.14) | —（同值） | css | 下拉菜单 |
| `--ds-elevation-dialog` | 0 24px 64px rgba(2, 6, 16, 0.32) | —（同值） | css | 对话框 |
| `--ds-elevation-drawer` | -8px 0 32px rgba(2, 6, 16, 0.24) | —（同值） | css | 抽屉 |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-09` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `hover` / `focus` / `disabled` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
.popover { box-shadow: var(--ds-elevation-3); }
.card { box-shadow: var(--ds-elevation-0); border: 1px solid var(--ds-color-border-card); }
```

## 7. Do

- 卡片优先背景 + 边框
- 浮层按类型绑定固定阴影档

## 8. Don't

- 多层阴影叠加制造「浮起来」的效果
- 组件写死 rgba 参数

## 9. Accessibility

- 阴影不得作为唯一层级线索（必须配合边框或表面色）

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- 阴影参数不随断点变化

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 9 档齐全且参数确定
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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS6-S09` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `08 Border and Divider Standard` |
| 下一模块 | `10 Iconography Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
