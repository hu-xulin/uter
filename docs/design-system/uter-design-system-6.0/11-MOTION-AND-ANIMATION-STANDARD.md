# UTER DESIGN SYSTEM 6.0 · 11 Motion and Animation Standard

> **规范编号** `UDS6-S11` · **唯一文件** `11-MOTION-AND-ANIMATION-STANDARD.md` · **版本** `6.0.0` · **状态** `IMPLEMENTED_NOT_VERIFIED`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Predictability / Efficiency / Accessibility
> **视觉审核入口** [`SHOWCASE-6.0.html`](./SHOWCASE-6.0.html#mod-11)

---

## 1. Overview

6 档动效时间 + 4 条缓动；覆盖 Hover / Focus / Active / Dialog / Drawer / Dropdown / Toast / Collapse / Loading / Skeleton / Page Transition，强制支持 reduced-motion。

本模块属于 6.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。6.0 为完整重建，5.0 及更早版本只用于识别历史文件、识别现有代码依赖与迁移风险分析，**不作为本模块的视觉设计依据**。当前运行时强制标准仍为 3.0；6.0 数值冻结与全站迁移须在用户视觉审核通过后按 Phase 5 → Phase 6 顺序执行。

| 属性 | 值 |
|---|---|
| 状态 | `IMPLEMENTED_NOT_VERIFIED`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. 时间档：instant 0 / fast 100 / normal 150 / moderate 200 / slow 250 / slower 300 ms
2. 缓动：standard cubic-bezier(0.2,0,0,1)、enter cubic-bezier(0,0,0.2,1)、exit cubic-bezier(0.4,0,1,1)、linear
3. Hover / Focus = fast 100ms + standard；Active = normal 150ms + standard
4. Dropdown / Tooltip = moderate 200ms（进入 enter / 退出 exit）；Dialog / Drawer = slow 250ms
5. Toast 进入 200ms / 停留 5000ms / 退出 150ms；Collapse 200ms
6. Loading / Skeleton 使用 1000ms linear 无限循环；Page Transition = slower 300ms
7. prefers-reduced-motion: reduce 时所有过渡与动画降至 0.01ms，Skeleton 改为静态占位
8. 禁止动效改变布局尺寸导致 CLS；只允许 transform / opacity 做动画

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-6.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-motion-instant` | 0ms | —（同值） | ms | 立即 |
| `--ds-motion-fast` | 100ms | —（同值） | ms | Hover / Focus |
| `--ds-motion-normal` | 150ms | —（同值） | ms | Active / 微交互 |
| `--ds-motion-moderate` | 200ms | —（同值） | ms | Dropdown / Tooltip |
| `--ds-motion-slow` | 250ms | —（同值） | ms | Dialog / Drawer |
| `--ds-motion-slower` | 300ms | —（同值） | ms | Page Transition |
| `--ds-easing-standard` | cubic-bezier(0.2, 0, 0, 1) | —（同值） | css | 标准 |
| `--ds-easing-enter` | cubic-bezier(0, 0, 0.2, 1) | —（同值） | css | 进入 |
| `--ds-easing-exit` | cubic-bezier(0.4, 0, 1, 1) | —（同值） | css | 退出 |
| `--ds-easing-linear` | linear | —（同值） | css | 加载 / 进度 |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-11` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `hover` / `focus` / `active` / `loading` / `disabled` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

## 7. Do

- 只用 transform / opacity
- 每个动画声明 reduced-motion 分支

## 8. Don't

- 动画 width / height / top / left
- 忽略 reduced-motion

## 9. Accessibility

- prefers-reduced-motion 必须生效
- 闪烁频率 ≤3Hz

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- ≤480px Dialog 改为底部 Sheet，动画时长不变

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 6 时间 + 4 缓动齐全
2. reduced-motion 规则在生成 CSS 中存在
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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS6-S11` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `10 Iconography Standard` |
| 下一模块 | `12 Responsive Design Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
