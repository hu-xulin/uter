# UTER DESIGN SYSTEM 6.0 · 10 Iconography Standard

> **规范编号** `UDS6-S10` · **唯一文件** `10-ICONOGRAPHY-STANDARD.md` · **版本** `6.0.0` · **状态** `IMPLEMENTED_NOT_VERIFIED`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Consistency / Clarity / Efficiency
> **视觉审核入口** [`SHOWCASE-6.0.html`](./SHOWCASE-6.0.html#mod-10)

---

## 1. Overview

统一 Lucide 风格图标，5 档尺寸与 2 档 stroke；统一图标注册表，禁止业务混用不同风格。

本模块属于 6.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。6.0 为完整重建，5.0 及更早版本只用于识别历史文件、识别现有代码依赖与迁移风险分析，**不作为本模块的视觉设计依据**。当前运行时强制标准仍为 3.0；6.0 视觉基线已于 2026-11-15 经用户授权冻结（`VISUAL-BASELINE.json`），全站迁移按 Phase 6 分期执行。

| 属性 | 值 |
|---|---|
| 状态 | `IMPLEMENTED_NOT_VERIFIED`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. 图标尺寸：12 / 16 / 20 / 24 / 32 px，对应 `--ds-icon-2xs` … `--ds-icon-lg`；默认 16px
2. 默认 stroke-width 2px（`--ds-icon-stroke`）；≤16px 小尺寸使用 1.75px（`--ds-icon-stroke-small`）
3. 图标颜色继承 `currentColor`，不得单独写死色值；状态图标颜色取对应 status Token
4. 图标必须来自统一注册表；禁止同一语义混用不同风格（如线性 + 填充）图标
5. 纯图标按钮必须提供 `aria-label`；触控目标 ≥44×44px，图标本身可为 20px
6. 图标与文字间距 8px；图标在按钮内位于文字前（RTL 时镜像）
7. 新增/删除/错误状态不得只靠颜色，必须同时有独立图标形状

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-6.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-icon-2xs` | 12px | —（同值） | px | 图标 12 |
| `--ds-icon-xs` | 16px | —（同值） | px | 图标 16（默认） |
| `--ds-icon-sm` | 20px | —（同值） | px | 图标 20 |
| `--ds-icon-md` | 24px | —（同值） | px | 图标 24 |
| `--ds-icon-lg` | 32px | —（同值） | px | 图标 32 |
| `--ds-icon-stroke` | 2px | —（同值） | px | 默认 stroke-width |
| `--ds-icon-stroke-small` | 1.75px | —（同值） | px | ≤16px 图标 stroke-width |
| `--ds-control-touch` | 44px | —（同值） | px | Touch 最小触控目标 / H5 |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-10` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `hover` / `focus` / `disabled` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
<button aria-label="复制 API Key"><CopyIcon size={16} strokeWidth={1.75} /></button>
```

## 7. Do

- 使用统一图标注册表
- 纯图标按钮给 aria-label

## 8. Don't

- 混用不同风格图标
- 用颜色单独表达成功/失败

## 9. Accessibility

- 纯图标按钮必须有可访问名称
- 状态图标配合文字

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- ≤480px 图标默认仍为 16px，不缩小；触控目标保持 44px

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 5 尺寸 + 2 stroke 齐全
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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS6-S10` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `09 Elevation and Shadow Standard` |
| 下一模块 | `11 Motion and Animation Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
