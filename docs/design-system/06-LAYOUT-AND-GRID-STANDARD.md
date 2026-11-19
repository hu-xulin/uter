# UTER DESIGN SYSTEM 8.0.0 · 06 Layout and Grid Standard

> **规范编号** `UDS8-S06` · **唯一文件** `06-LAYOUT-AND-GRID-STANDARD.md` · **版本** `8.0.0` · **状态** `ACCEPTANCE_READY`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Hierarchy / Efficiency / Responsiveness
> **视觉审核入口** [`SHOWCASE-8.0.0.html`](./SHOWCASE-8.0.0.html#mod-06)

---

## 1. Overview

桌面内容最大宽度 1440px、12 列网格；定义 Header / Sidebar / Main / Container / Modal / Drawer / Card / Dashboard / Documentation 九类布局。

本模块属于 UDS 8.0.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。UDS 8.0.0 是本仓库唯一现行设计系统与唯一执行依据；颜色语义层 --ds-* bridge 为新 UI 的唯一运行时权威；现有 UDS 3.0 runtime compatibility boundary 按 ADR-0002 保留，直到项目所有者明确授权迁移并完成当前 HEAD 绑定的行为、视觉与兼容回归验证；该边界不构成并行设计系统或第二套 Token。视觉基线见 `VISUAL-BASELINE.json`。

| 属性 | 值 |
|---|---|
| 状态 | `ACCEPTANCE_READY`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. 桌面内容最大宽度 1440px；桌面 12 列、平板 8 列、移动 4 列
2. 栅格间距：桌面 24px、平板 16px、移动 12px
3. Header 高 64px，固定置顶；Sidebar 展开 240px、收起 64px
4. Main Content 最小宽度 0（允许内部滚动），Content Container 居中且左右外边距按断点取 24 / 16 / 12 px
5. Modal 默认宽 560px、圆角 12px、阴影 `--ds-elevation-dialog`；Drawer 默认宽 400px
6. Card 圆角 10px、边框 1px `--ds-color-border-card`、内边距 16px；优先用背景 + 边框区分层级
7. Dashboard 采用 12 列：Metric Cards 每卡 3 列（4 卡一行），主图表 8 列、侧列表 4 列
8. Documentation Layout：左侧目录 240px、正文最大 800px、右侧 TOC 200px；≤1024px 隐藏右侧 TOC
9. 所有布局容器不得使用绝对定位表达常规流式排布

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-8.0.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-layout-max-width` | 1440px | —（同值） | px | 桌面内容最大宽度 |
| `--ds-layout-columns-desktop` | 12 | —（同值） | count | 桌面 12 列 |
| `--ds-layout-columns-tablet` | 8 | —（同值） | count | 平板 8 列 |
| `--ds-layout-columns-mobile` | 4 | —（同值） | count | 移动 4 列 |
| `--ds-layout-gutter-desktop` | 24px | —（同值） | px | 桌面栅格间距 |
| `--ds-layout-gutter-tablet` | 16px | —（同值） | px | 平板栅格间距 |
| `--ds-layout-gutter-mobile` | 12px | —（同值） | px | 移动栅格间距 |
| `--ds-layout-header-height` | 64px | —（同值） | px | Header 高度 |
| `--ds-layout-sidebar-width` | 240px | —（同值） | px | Sidebar 展开宽度 |
| `--ds-layout-sidebar-collapsed` | 64px | —（同值） | px | Sidebar 收起宽度 |
| `--ds-layout-modal-width` | 560px | —（同值） | px | Modal 默认宽度 |
| `--ds-layout-drawer-width` | 400px | —（同值） | px | Drawer 默认宽度 |
| `--ds-radius-xl` | 10px | —（同值） | px | Card / Table / Code Block |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-06` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `loading` / `error` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
.page { max-width: var(--ds-layout-max-width); margin-inline: auto; padding-inline: var(--ds-space-6); }
.dashboard-grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: var(--ds-layout-gutter-desktop); }
```

## 7. Do

- 用 12 列网格组织 Dashboard
- Content Container 统一居中

## 8. Don't

- 用绝对定位模拟常规布局
- 超过 1440px 内容宽度

## 9. Accessibility

- DOM 顺序与视觉顺序一致
- Sidebar 收起后仍可键盘访问全部导航项

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- ≥1024px 12 列 / 768–1023px 8 列 / <768px 4 列
- ≤1024px 隐藏 Documentation 右侧 TOC

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 九类布局均有确定尺寸
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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS8-S06` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `05 Spacing and Sizing Standard` |
| 下一模块 | `07 Shape and Radius Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
