# UTER DESIGN SYSTEM 7.0 · 31 Page Templates Standard

> **规范编号** `UDS7-S31` · **唯一文件** `31-PAGE-TEMPLATES-STANDARD.md` · **版本** `7.0.0` · **状态** `ACCEPTANCE_READY`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Consistency / Responsiveness
> **视觉审核入口** [`SHOWCASE-7.0.html`](./SHOWCASE-7.0.html#mod-31)

---

## 1. Overview

15 类页面模板 + 真实路由扫描补齐。扫描结果：`web/src/routes/` 共 72 个 `.tsx` 路由文件（目录内共 74 个文件），PAGE-REGISTRY.json 按真实路由登记，不制作虚构页面。

本模块属于 7.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。7.0 为完整重建，5.0 及更早版本只用于识别历史文件、识别现有代码依赖与迁移风险分析，**不作为本模块的视觉设计依据**。当前运行时强制标准仍为 3.0；7.0 视觉基线已于 2026-11-15 经用户授权冻结（`VISUAL-BASELINE.json`），全站迁移按 Phase 6 分期执行。

| 属性 | 值 |
|---|---|
| 状态 | `ACCEPTANCE_READY`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. 文档要求 15 类：Dashboard / API Key List / API Key Detail / Model List / Model Detail / Channel List / Channel Detail / API Documentation / Usage Analytics / Billing / Recharge / Orders / Refunds / Account Settings / Authentication
2. 真实路由扫描：72 个 `.tsx` 路由文件，分 `_public` / `_authenticated` / `(auth)` / `(errors)` / `oauth` / `setup` 六组
3. 真实存在的对应路由：`dashboard/index.tsx`、`keys/index.tsx`、`models/index.tsx`、`models/$section.tsx`、`channels/index.tsx`、`docs.tsx`、`usage-logs/index.tsx`、`wallet/index.tsx`、`subscriptions/index.tsx`、`profile/index.tsx`、`security/index.tsx`、`(auth)/sign-in.tsx` 等
4. 文档列出但仓库无独立路由的模板（API Key Detail / Model Detail / Channel Detail / Recharge / Orders / Refunds）登记为 `ROUTE_NOT_FOUND`，由现有页面内的 Drawer / Dialog / Tab 承载，禁止伪造页面
5. 每个模板必须声明：布局、栅格、组件清单、数据状态（default / loading / empty / error）、断点矩阵、验收项
6. 页面模板不得直接引用 Primitive 色值；全部经 Semantic / Component Token
7. 真实产品页面预览在 Showcase 中优先复用真实组件，不以静态设计稿替代

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-7.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-layout-max-width` | 1440px | —（同值） | px | 桌面内容最大宽度 |
| `--ds-layout-columns-desktop` | 12 | —（同值） | count | 桌面 12 列 |
| `--ds-layout-header-height` | 64px | —（同值） | px | Header 高度 |
| `--ds-layout-sidebar-width` | 240px | —（同值） | px | Sidebar 展开宽度 |
| `--ds-space-6` | 24px | —（同值） | px | 24 |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-31` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `loading` / `error` / `empty` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
{ "template": "API Key List", "route": "/_authenticated/keys/index.tsx", "status": "ROUTE_EXISTS" }
```

## 7. Do

- 按真实路由登记模板
- 缺失路由标 ROUTE_NOT_FOUND

## 8. Don't

- 伪造页面或功能
- 把 Dialog 承载的功能写成独立路由

## 9. Accessibility

- 每模板声明键盘路径
- 空 / 错误态有可访问名称

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- 每模板给出 7 档断点矩阵

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 15 模板全部登记
2. PAGE-REGISTRY.json 与真实路由文件逐项比对一致
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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS7-S31` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `30 Dashboard Standard` |
| 下一模块 | `32 Empty, Loading and Error Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
