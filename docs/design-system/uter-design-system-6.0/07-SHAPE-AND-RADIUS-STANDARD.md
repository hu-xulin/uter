# UTER DESIGN SYSTEM 6.0 · 07 Shape and Radius Standard

> **规范编号** `UDS6-S07` · **唯一文件** `07-SHAPE-AND-RADIUS-STANDARD.md` · **版本** `6.0.0` · **状态** `IMPLEMENTED_NOT_VERIFIED`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Consistency / Predictability
> **视觉审核入口** [`SHOWCASE-6.0.html`](./SHOWCASE-6.0.html#mod-07)

---

## 1. Overview

圆角八档，每个组件明确绑定其中一档，不允许组件自选数值。

本模块属于 6.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。6.0 为完整重建，5.0 及更早版本只用于识别历史文件、识别现有代码依赖与迁移风险分析，**不作为本模块的视觉设计依据**。当前运行时强制标准仍为 3.0；6.0 数值冻结与全站迁移须在用户视觉审核通过后按 Phase 5 → Phase 6 顺序执行。

| 属性 | 值 |
|---|---|
| 状态 | `IMPLEMENTED_NOT_VERIFIED`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. 圆角档位：none 0 / sm 3 / md 5 / lg 8 / xl 12 / 2xl 16 / 3xl 20 / full 9999 px
2. Button / Input / Select = md 5px；Checkbox = sm 3px；Switch / Badge / Avatar / Pill = full
3. Card / Table / Code Block = lg 8px；Dialog / Popover / Drawer 面板 = xl 12px
4. 大型容器 = 2xl 16px；营销展示容器 = 3xl 20px
5. 嵌套圆角规则：内层圆角 = 外层圆角 − 外层内边距，最小不低于 sm 3px
6. 组件必须通过 `--ds-radius-*` 或 `--ds-radius-button/input/card/...` 引用，禁止写死 `border-radius: 6px`

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-6.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-radius-none` | 0px | —（同值） | px | 无圆角 |
| `--ds-radius-sm` | 3px | —（同值） | px | 小控件 |
| `--ds-radius-md` | 5px | —（同值） | px | 默认 |
| `--ds-radius-lg` | 8px | —（同值） | px | 卡片 |
| `--ds-radius-xl` | 12px | —（同值） | px | 弹层 |
| `--ds-radius-2xl` | 16px | —（同值） | px | 大卡片 |
| `--ds-radius-3xl` | 20px | —（同值） | px | 大型容器 |
| `--ds-radius-full` | 9999px | —（同值） | px | 圆形 / 胶囊 |
| `--ds-radius-button` | var(--ds-radius-md) | —（同值） | token-ref | Button = 5px |
| `--ds-radius-input` | var(--ds-radius-md) | —（同值） | token-ref | Input = 5px |
| `--ds-radius-card` | var(--ds-radius-lg) | —（同值） | token-ref | Card = 8px |
| `--ds-radius-dialog` | var(--ds-radius-xl) | —（同值） | token-ref | Dialog = 12px |
| `--ds-radius-badge` | var(--ds-radius-full) | —（同值） | token-ref | Badge = 9999px |
| `--ds-radius-code` | var(--ds-radius-lg) | —（同值） | token-ref | Code Block = 8px |
| `--ds-radius-table` | var(--ds-radius-lg) | —（同值） | token-ref | Table = 8px |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-07` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `focus` / `disabled` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
.button { border-radius: var(--ds-radius-button); }
.dialog { border-radius: var(--ds-radius-dialog); }
```

## 7. Do

- 按组件类型绑定固定档位
- 嵌套容器按内边距收敛圆角

## 8. Don't

- 组件写死圆角字面量
- 同一组件在 Light / Dark 使用不同圆角

## 9. Accessibility

- 圆角不得裁切焦点环（焦点环偏移 2px）

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- 圆角不随断点变化

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 8 档齐全、7 个组件绑定齐全
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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS6-S07` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `06 Layout and Grid Standard` |
| 下一模块 | `08 Border and Divider Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
