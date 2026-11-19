# UTER DESIGN SYSTEM 8.0.0 · 17 Navigation Standard

> **规范编号** `UDS8-S17` · **唯一文件** `17-NAVIGATION-STANDARD.md` · **版本** `8.0.0` · **状态** `ACCEPTANCE_READY`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Consistency / Efficiency / Predictability
> **视觉审核入口** [`SHOWCASE-8.0.0.html`](./SHOWCASE-8.0.0.html#mod-17)

---

## 1. Overview

Header / Sidebar / Collapsed Sidebar / Breadcrumb / Tabs / Navigation Item / Mobile Navigation 与 Active / Hover / Focus 状态。

本模块属于 UDS 8.0.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。UDS 8.0.0 是本仓库唯一现行设计系统与唯一执行依据；颜色语义层 --ds-* bridge 为新 UI 的唯一运行时权威；现有 UDS 3.0 runtime compatibility boundary 按 ADR-0002 保留，直到项目所有者明确授权迁移并完成当前 HEAD 绑定的行为、视觉与兼容回归验证；该边界不构成并行设计系统或第二套 Token。视觉基线见 `VISUAL-BASELINE.json`。

| 属性 | 值 |
|---|---|
| 状态 | `ACCEPTANCE_READY`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. Header 高 64px（<768px 56px），背景 surface-base，底边框 1px border-divider
2. Sidebar 展开 240px、收起 64px；导航项高 36px、圆角 md 6px、图标 16px、文字 14px/22px
3. Active 状态：surface-sunken 背景 + brand-1 左侧 2px 指示条 + 文字 text-primary semibold
4. Hover：surface-sunken 背景，100ms standard 过渡；Focus：2px 焦点环 + 2px offset
5. Breadcrumb：12px/18px text-secondary，分隔符 `/`，当前项 text-primary；≥1024px 显示
6. Tabs：高度 40px，项间距 24px，Active 底部 2px brand-1 指示条；键盘左右箭头可切换
7. Mobile Navigation：<768px 底部标签栏高 56px + 汉堡抽屉；抽屉宽 100%，焦点移入并循环
8. 收起 Sidebar 只显示图标，必须保留 aria-label / tooltip 文本

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-8.0.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-layout-header-height` | 64px | —（同值） | px | Header 高度 |
| `--ds-layout-sidebar-width` | 240px | —（同值） | px | Sidebar 展开宽度 |
| `--ds-layout-sidebar-collapsed` | 64px | —（同值） | px | Sidebar 收起宽度 |
| `--ds-control-md` | 36px | —（同值） | px | Medium 按钮 / 输入 |
| `--ds-radius-md` | 6px | —（同值） | px | 默认 / 菜单项 |
| `--ds-icon-xs` | 16px | —（同值） | px | 图标 16（默认） |
| `--ds-text-sm` | 14px | —（同值） | px | 正文默认 |
| `--ds-text-2xs` | 12px | —（同值） | px | 最小可见文字（全站下限） |
| `--ds-focus-ring-width` | 2px | —（同值） | px | 焦点环宽度 |
| `--ds-motion-fast` | 100ms | —（同值） | ms | Hover / Focus |
| `--ds-color-surface-sunken` | #F1F5F9 | #080D18 | color | 下沉表面（代码块 / 井） |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-17` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `hover` / `focus` / `active` / `disabled` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
<nav aria-label="主导航"><a aria-current="page">Dashboard</a></nav>
```

## 7. Do

- 当前项用 aria-current="page"
- 收起态保留可访问名称

## 8. Don't

- 只用颜色表达 Active
- 收起后移除键盘可达路径

## 9. Accessibility

- 导航项可 Tab 到达
- Active 有 aria-current

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- <768px 底部标签栏 + 抽屉
- 768–1023px 收起 Sidebar
- ≥1024px 展开 Sidebar

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 7 类导航组件状态齐全
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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS8-S17` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `16 Density and Information Hierarchy Standard` |
| 下一模块 | `18 Button Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
