# UTER DESIGN SYSTEM 6.0 · 12 Responsive Design Standard

> **规范编号** `UDS6-S12` · **唯一文件** `12-RESPONSIVE-DESIGN-STANDARD.md` · **版本** `6.0.0` · **状态** `IMPLEMENTED_NOT_VERIFIED`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Responsiveness / Efficiency
> **视觉审核入口** [`SHOWCASE-6.0.html`](./SHOWCASE-6.0.html#mod-12)

---

## 1. Overview

7 档断点，定义核心页面在各断点的结构、隐藏规则、堆叠方式、表格处理与导航变化。

本模块属于 6.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。6.0 为完整重建，5.0 及更早版本只用于识别历史文件、识别现有代码依赖与迁移风险分析，**不作为本模块的视觉设计依据**。当前运行时强制标准仍为 3.0；6.0 数值冻结与全站迁移须在用户视觉审核通过后按 Phase 5 → Phase 6 顺序执行。

| 属性 | 值 |
|---|---|
| 状态 | `IMPLEMENTED_NOT_VERIFIED`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. 断点：xs 360 / sm 480 / md 768 / lg 1024 / xl 1280 / 2xl 1440 / wide 1920 px
2. <768px：4 列栅格、Sidebar 改为抽屉、Header 高 56px（由 64px 下调）、页面外边距 12px
3. 768–1023px：8 列栅格、Sidebar 收起为 64px、隐藏 Documentation 右侧 TOC、页面外边距 16px
4. ≥1024px：12 列栅格、Sidebar 展开 240px、页面外边距 24px、内容最大宽度 1440px
5. 表格：<768px 转为卡片列表（每行一张卡），字段以 label/value 展示；≥768px 保留表格并允许横向滚动
6. 导航：<768px 用底部标签栏 + 汉堡抽屉；768–1023px 用收起 Sidebar；≥1024px 用展开 Sidebar + Breadcrumb
7. Modal：<480px 宽度 100% − 24px；≥480px 固定 560px；Drawer <768px 宽度 100%
8. 字号阶梯在所有断点共用；不因断点放大或缩小字号，仅切换标题所用档位
9. 核心页面（Dashboard / API Keys / Models / Channels / Documentation / Usage / Billing / Orders / Refunds / Account）逐页给出断点结构

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-6.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-bp-xs` | 360px | —（同值） | px | Compact Mobile |
| `--ds-bp-sm` | 480px | —（同值） | px | Mobile |
| `--ds-bp-md` | 768px | —（同值） | px | Tablet（8 列） |
| `--ds-bp-lg` | 1024px | —（同值） | px | Small Desktop（12 列） |
| `--ds-bp-xl` | 1280px | —（同值） | px | Desktop |
| `--ds-bp-2xl` | 1440px | —（同值） | px | 内容最大宽度 / Large Screen 起点 |
| `--ds-bp-wide` | 1920px | —（同值） | px | Wide Screen |
| `--ds-layout-columns-desktop` | 12 | —（同值） | count | 桌面 12 列 |
| `--ds-layout-columns-tablet` | 8 | —（同值） | count | 平板 8 列 |
| `--ds-layout-columns-mobile` | 4 | —（同值） | count | 移动 4 列 |
| `--ds-layout-gutter-desktop` | 24px | —（同值） | px | 桌面栅格间距 |
| `--ds-layout-gutter-tablet` | 16px | —（同值） | px | 平板栅格间距 |
| `--ds-layout-gutter-mobile` | 12px | —（同值） | px | 移动栅格间距 |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-12` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `loading` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
@media (max-width: 767px) { .sidebar { display: none; } .table { display: none; } .table-cards { display: block; } }
```

## 7. Do

- <768px 表格转卡片
- 所有断点共用同一字号阶梯

## 8. Don't

- 为移动端另设一套字号
- 隐藏关键业务数据

## 9. Accessibility

- 隐藏规则不得移除键盘可达路径
- 抽屉打开时焦点移入并可 Tab 循环

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- 7 档断点全部有明确结构规则

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 7 断点齐全
2. 15 类页面模板均有断点矩阵
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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS6-S12` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `11 Motion and Animation Standard` |
| 下一模块 | `13 Accessibility Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
