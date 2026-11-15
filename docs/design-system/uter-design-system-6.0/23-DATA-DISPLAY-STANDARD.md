# UTER DESIGN SYSTEM 6.0 · 23 Data Display Standard

> **规范编号** `UDS6-S23` · **唯一文件** `23-DATA-DISPLAY-STANDARD.md` · **版本** `6.0.0` · **状态** `IMPLEMENTED_NOT_VERIFIED`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Data Integrity / Clarity
> **视觉审核入口** [`SHOWCASE-6.0.html`](./SHOWCASE-6.0.html#mod-23)

---

## 1. Overview

Card / Table / Pagination / Description List / Statistics / Avatar / Tag / Progress / Timeline；金额与 Token 数据强制对齐并等宽。

本模块属于 6.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。6.0 为完整重建，5.0 及更早版本只用于识别历史文件、识别现有代码依赖与迁移风险分析，**不作为本模块的视觉设计依据**。当前运行时强制标准仍为 3.0；6.0 视觉基线已于 2026-11-15 经用户授权冻结（`VISUAL-BASELINE.json`），全站迁移按 Phase 6 分期执行。

| 属性 | 值 |
|---|---|
| 状态 | `IMPLEMENTED_NOT_VERIFIED`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. Card：圆角 8px、1px border-card、内边距 16px、标题 18px/26px semibold
2. Table：表头 12px/18px medium surface-sunken、单元格 13px/20px、行高按密度档、仅横向 1px 分隔线
3. 金额 / Token / 用量列右对齐 + `tabular-nums` + `--ds-font-mono`；文本列左对齐
4. Pagination：按钮 32px、当前页 brand-1 实底 + 白字、页间显示省略号、提供 aria-label
5. Description List：label 12px/18px text-secondary 宽 120px，value 14px/22px text-primary
6. Statistics：数值 16px/24px semibold tabular-nums，标签 12px/18px text-secondary，环比用 status 色 + 箭头图标
7. Avatar：24 / 32 / 40 px 三档，full 圆角；无图时用姓名首字母 + surface-sunken
8. Tag：高 24px、full 圆角、12px/18px；Progress：轨道 4px、圆角 full、填充 brand-1
9. Timeline：节点 8px 圆点、连接线 1px border-divider、时间 12px/18px 等宽

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-6.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-radius-card` | var(--ds-radius-lg) | —（同值） | token-ref | Card = 8px |
| `--ds-radius-table` | var(--ds-radius-lg) | —（同值） | token-ref | Table = 8px |
| `--ds-border-width-table` | 1px | —（同值） | px | 表格 |
| `--ds-color-border-table` | #E2E8F0 | #263349 | color | 表格边框 |
| `--ds-color-surface-sunken` | #F1F5F9 | #080D18 | color | 下沉表面（代码块 / 井） |
| `--ds-text-2xs` | 12px | —（同值） | px | 最小可见文字（全站下限） |
| `--ds-text-xs` | 13px | —（同值） | px | 密集表格 / 代码 / 标签 |
| `--ds-text-base` | 16px | —（同值） | px | 长文本默认 / 指标数值 / H5 输入 |
| `--ds-leading-table` | 20px | —（同值） | px | 表格单元格 |
| `--ds-numeric-tabular` | tabular-nums | —（同值） | keyword | 金额 / 余额 / Token 数 / 价格 / 用量 / 订单号 / 指标 |
| `--ds-font-mono` | ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace, 'Source Han Sans SC', 'Source Han Sans CN', '思源黑体', 'Noto Sans SC Variable', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif | —（同值） | stack | 等宽字体栈（CJK 回退置于 monospace 之后，保持拉丁等宽） |
| `--ds-density-default-row` | 44px | —（同值） | px | Default 表格行高 |
| `--ds-radius-full` | 9999px | —（同值） | px | 圆形 / 胶囊 |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-23` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `hover` / `selected` / `loading` / `empty` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
<td class="num">¥ 12,345.67</td>
.num { text-align:right; font-variant-numeric: var(--ds-numeric-tabular); font-family: var(--ds-font-mono); }
```

## 7. Do

- 数值列右对齐 + 等宽数字
- 表头固定 12px/18px

## 8. Don't

- 金额列居中
- 用渐变显示余额

## 9. Accessibility

- 表格有 caption / scope
- Pagination 有 aria-label

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- <768px 表格转卡片列表，label/value 成对展示

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 9 类组件规格齐全
2. 本模块引用的每个 Token 必须能在 TOKEN-MANIFEST.json 中解析，且 CSS / TS / Showcase 三处数值一致
3. check-design-system-6.0.mjs 对应检查项 EXIT=0
4. Light / Dark 两套映射完整，无缺失键、无主题特例裸色值
5. Do / Don’t 中的反例在全库静态扫描中命中数为 0（或已登记进 EXCEPTION-REGISTRY.json）

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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS6-S23` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `22 Overlay and Floating Standard` |
| 下一模块 | `24 Code and Developer UI Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
