# UTER DESIGN SYSTEM 8.0.0 · 05 Spacing and Sizing Standard

> **规范编号** `UDS8-S05` · **唯一文件** `05-SPACING-AND-SIZING-STANDARD.md` · **版本** `8.0.0` · **状态** `ACCEPTANCE_READY`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Consistency / Efficiency / Hierarchy
> **视觉审核入口** [`SHOWCASE-8.0.0.html`](./SHOWCASE-8.0.0.html#mod-05)

---

## 1. Overview

4px 基础网格，13 档间距与完整控件尺寸；所有内边距、页面间距、表单间距、卡片间距、列表间距均有确定值。

本模块属于 UDS 8.0.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。7.0 为其直接前版（2026-11-16 经用户授权升版），5.0 及更早版本只用于识别历史文件、识别现有代码依赖与迁移风险分析，**不作为本模块的视觉设计依据**。当前运行时唯一权威为 UDS 8.0.0（3.0 兼容层已退役）；8.0.0 视觉基线随升版重冻结（`VISUAL-BASELINE.json`）。

| 属性 | 值 |
|---|---|
| 状态 | `ACCEPTANCE_READY`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. 基础单位 4px；间距阶梯 0 / 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80 / 96 px
2. 页面外边距：桌面 24px（`--ds-space-6`）、平板 16px、移动 12px
3. 卡片内边距 16px；紧凑卡片 12px；大型容器 24px
4. 表单 Label 与控件间距 8px；控件之间 16px；表单分组之间 24px；错误文案与控件 4px
5. 列表项纵向内边距 12px；表格单元格横向 12px、纵向按密度档 6 / 10 / 14 px
6. 控件高度：Small 32、Medium 36、Large 40、Touch 44 px；图标 12 / 16 / 20 / 24 / 32 px
7. 触摸目标最小 44×44px；相邻可点击目标间距 ≥8px
8. 所有间距必须引用 `--ds-space-*`；禁止出现 5px / 7px / 13px 等非网格字面量

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-8.0.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-space-0` | 0px | —（同值） | px | 无间距 |
| `--ds-space-1` | 4px | —（同值） | px | 4 |
| `--ds-space-2` | 8px | —（同值） | px | 8 |
| `--ds-space-3` | 12px | —（同值） | px | 12 |
| `--ds-space-4` | 16px | —（同值） | px | 16 |
| `--ds-space-5` | 20px | —（同值） | px | 20 |
| `--ds-space-6` | 24px | —（同值） | px | 24 |
| `--ds-space-8` | 32px | —（同值） | px | 32 |
| `--ds-space-10` | 40px | —（同值） | px | 40 |
| `--ds-space-12` | 48px | —（同值） | px | 48 |
| `--ds-space-16` | 64px | —（同值） | px | 64 |
| `--ds-space-20` | 80px | —（同值） | px | 80 |
| `--ds-space-24` | 96px | —（同值） | px | 96 |
| `--ds-control-sm` | 32px | —（同值） | px | Small 按钮 / 输入 |
| `--ds-control-md` | 36px | —（同值） | px | Medium 按钮 / 输入 |
| `--ds-control-lg` | 40px | —（同值） | px | Large 按钮 / 输入 |
| `--ds-control-touch` | 44px | —（同值） | px | Touch 最小触控目标 / H5 |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-05` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `disabled` / `loading` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
.card { padding: var(--ds-space-4); gap: var(--ds-space-3); }
.form-row { margin-bottom: var(--ds-space-4); }
```

## 7. Do

- 所有间距走 4px 网格
- 移动端页面外边距 12px

## 8. Don't

- 写死 `padding: 13px`
- 让密度档改变控件最小高度

## 9. Accessibility

- 触控目标 ≥44×44px
- 相邻目标间距 ≥8px

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- 桌面 24 / 平板 16 / 移动 12 px 页面外边距
- 栅格间距 24 / 16 / 12 px

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 13 档间距齐全
2. 全库非网格间距字面量命中数 = 0 或已登记例外
3. 本模块引用的每个 Token 必须能在 TOKEN-MANIFEST.json 中解析，且 CSS / TS / Showcase 三处数值一致
4. check-design-system-8.0.0.mjs 对应检查项 EXIT=0
5. Light / Dark 两套映射完整，无缺失键、无主题特例裸色值
6. Do / Don’t 中的反例在全库静态扫描中命中数为 0（或已登记进 EXCEPTION-REGISTRY.json）

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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS8-S05` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `04 Typography Standard` |
| 下一模块 | `06 Layout and Grid Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
