# UTER DESIGN SYSTEM 7.0 · 16 Density and Information Hierarchy Standard

> **规范编号** `UDS7-S16` · **唯一文件** `16-DENSITY-AND-INFORMATION-HIERARCHY-STANDARD.md` · **版本** `7.0.0` · **状态** `ACCEPTANCE_READY`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Efficiency / Hierarchy / Accessibility
> **视觉审核入口** [`SHOWCASE-7.0.html`](./SHOWCASE-7.0.html#mod-16)

---

## 1. Overview

Compact / Default / Comfortable 三档密度，表格行高 36 / 44 / 52 px；密度调整不得破坏最小字号。

本模块属于 7.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。7.0 为完整重建，5.0 及更早版本只用于识别历史文件、识别现有代码依赖与迁移风险分析，**不作为本模块的视觉设计依据**。当前运行时强制标准仍为 3.0；7.0 视觉基线已于 2026-11-15 经用户授权冻结（`VISUAL-BASELINE.json`），全站迁移按 Phase 6 分期执行。

| 属性 | 值 |
|---|---|
| 状态 | `ACCEPTANCE_READY`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. Compact 行高 36px、单元格纵向内边距 6px；Default 44px / 10px；Comfortable 52px / 14px
2. 三档密度共用同一字号阶梯：表格单元格固定 13px/20px，表头 12px/18px medium，不得因 Compact 降到 12px 以下
3. 密度只改变纵向间距与行高，不改变横向间距（固定 12px）、边框、圆角、字重
4. 信息层级：页面主标题 → 分区标题 → 卡片标题 → 正文 → 帮助文字，共 5 级，每级字号 / 字重 / 颜色确定
5. Default 为全站默认；用户可在表格工具栏切换，选择持久化到用户偏好
6. Compact 下触控目标仍需 ≥32px（PC Web）；H5 强制 Touch 44px 且锁为 Default

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-7.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-density-compact-row` | 36px | —（同值） | px | Compact 表格行高 |
| `--ds-density-default-row` | 44px | —（同值） | px | Default 表格行高 |
| `--ds-density-comfortable-row` | 52px | —（同值） | px | Comfortable 表格行高 |
| `--ds-density-compact-cell-y` | 6px | —（同值） | px | Compact 单元格纵向内边距 |
| `--ds-density-default-cell-y` | 10px | —（同值） | px | Default 单元格纵向内边距 |
| `--ds-density-comfortable-cell-y` | 14px | —（同值） | px | Comfortable 单元格纵向内边距 |
| `--ds-text-xs` | 13px | —（同值） | px | 密集表格 / 代码 / 标签 |
| `--ds-text-2xs` | 12px | —（同值） | px | 最小可见文字（全站下限） |
| `--ds-leading-table` | 20px | —（同值） | px | 表格单元格 |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-16` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `hover` / `selected` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
.table[data-density="compact"] { --row: var(--ds-density-compact-row); --pad-y: var(--ds-density-compact-cell-y); }
```

## 7. Do

- 密度只改纵向间距
- H5 锁定 Default

## 8. Don't

- Compact 把字号降到 12px 以下
- 密度切换改变边框或圆角

## 9. Accessibility

- 最小字号 12px 全档保持
- H5 触控目标 ≥44px

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- <768px 强制 Default 密度

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 3 档行高 / 内边距齐全
2. 本模块引用的每个 Token 必须能在 TOKEN-MANIFEST.json 中解析，且 CSS / TS / Showcase 三处数值一致
3. check-design-system-7.0.mjs 对应检查项 EXIT=0
4. Light / Dark 两套映射完整，无缺失键、无主题特例裸色值
5. Do / Don’t 中的反例在全库静态扫描中命中数为 0（或已登记进 EXCEPTION-REGISTRY.json）

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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS7-S16` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `15 Data Visualization Standard` |
| 下一模块 | `17 Navigation Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
