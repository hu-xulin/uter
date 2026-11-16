# UTER DESIGN SYSTEM 8.0.0 · 01-S Gradient Typography Standard (专项)

> **规范编号** `UDS8-S01-S` · **唯一文件** `GRADIENT-TYPOGRAPHY-STANDARD.md` · **版本** `8.0.0` · **状态** `ACCEPTANCE_READY`
> **上级归属** 专项规范，登记于 01 号模块之下，不构成第二套设计系统
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Clarity / Accessibility / Consistency
> **视觉审核入口** [`SHOWCASE-8.0.0.html`](./SHOWCASE-8.0.0.html#mod-01-S)

---

## 1. Overview

渐变文字专项：保留蓝紫方向但重新设计色值；Light / Dark 全区间 ≥4.5:1；全站唯一出口；作为 01-S 登记在 36 模块体系内。

本模块属于 UDS 8.0.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。UDS 8.0.0 是本仓库唯一现行设计系统与唯一执行依据；不存在并行版本、兼容层或第二套 Token。视觉基线见 `VISUAL-BASELINE.json`。

| 属性 | 值 |
|---|---|
| 状态 | `ACCEPTANCE_READY`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. 唯一出口：utility `ds-text-gradient-brand`；渐变 Token 必须通过全区间实算，禁止任何低对比度实现
2. Light：from #1D4ED8 / via #6D28D9 / to #7E22CE；Dark：from #93C5FD / via #C4B5FD / to #D8B4FE
3. 方向固定 `linear-gradient(90deg in srgb, from 0%, via 50%, to 100%)`（`--ds-gradient-direction: 90deg`、`--ds-gradient-interpolation: srgb`；CSS 与引擎插值空间必须一致）
4. 对比度实测：在 canvas / surface / raised / sunken / overlay / hero-glow / code-bg 共 7 种真实文字背景上按 0.1% 步长共 1001 点采样（含全部渐变 stop）；Light 最差 5.99:1（hero-glow @0%）、Dark 最差 8.37:1（raised @45.4%），全部 ≥4.5:1
5. 阈值：普通文字 ≥4.5:1、大号文字 ≥3:1；本方案按更严格的 4.5:1 冻结，因此无字号例外
6. 渐变所有停靠点与插值区间都必须测试；不得只测起点 / 中点 / 终点
7. 字体必须使用 `var(--ds-font-ui)`；渐变只改变文字颜色，不得改变字体 / 字重 / 字号 / 行高
8. 允许：Hero 主标题、CTA 标题、经批准的品牌展示标题；禁止：普通正文、表格文字、表单标签、错误 / 成功提示、支付状态、余额数字、API Key、代码示例、关键业务数据
9. 唯一出口 `ds-text-gradient-brand`，由 Token 自动切换 Light / Dark；业务页面不得自写 linear-gradient / bg-clip-text / background-clip:text / text-transparent / from-xxx via-xxx to-xxx
10. Showcase 必须展示新旧对比、Light / Dark、Hero / CTA、不同字号 / 字重、多行、中文 / 英文 / 混排、采样对比度结果与 Token Inspector
11. 用户审核前状态为 PENDING_USER_REVIEW，不得标记 ACCEPTED

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-8.0.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-color-gradient-light-from` | #1D4ED8 | —（同值） | color | Light 起点 0% |
| `--ds-color-gradient-light-via` | #6D28D9 | —（同值） | color | Light 中点 50% |
| `--ds-color-gradient-light-to` | #7E22CE | —（同值） | color | Light 终点 100% |
| `--ds-color-gradient-dark-from` | #93C5FD | —（同值） | color | Dark 起点 0% |
| `--ds-color-gradient-dark-via` | #C4B5FD | —（同值） | color | Dark 中点 50% |
| `--ds-color-gradient-dark-to` | #D8B4FE | —（同值） | color | Dark 终点 100% |
| `--ds-gradient-direction` | 90deg | —（同值） | css | linear-gradient(90deg in srgb, from 0%, via 50%, to 100%) |
| `--ds-gradient-utility` | ds-text-gradient-brand | —（同值） | identifier | 全站唯一渐变出口 |
| `--ds-font-ui` | 'Inter Variable', 'Inter', 'Source Han Sans SC', 'Source Han Sans CN', '思源黑体', 'Noto Sans SC Variable', 'Noto Sans SC', 'Noto Sans CJK SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji' | —（同值） | stack | UI 字体栈（中英文 + Emoji 回退） |
| `--ds-text-4xl` | 36px | —（同值） | px | 页面主标题 |
| `--ds-text-5xl` | 48px | —（同值） | px | 展示大标题（Hero 使用 4xl） |
| `--ds-leading-h1` | 44px | —（同值） | px | 36px 页面标题 |
| `--ds-leading-display` | 56px | —（同值） | px | 48px 展示标题 |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-01-S` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `hover` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
@utility ds-text-gradient-brand {
  background-image: linear-gradient(90deg in srgb, var(--ds-color-gradient-light-from) 0%, var(--ds-color-gradient-light-via) 50%, var(--ds-color-gradient-light-to) 100%);
  background-clip: text; color: transparent;
}
```

## 7. Do

- 只经 `ds-text-gradient-brand`
- 1001 点采样 × 7 背景后再冻结

## 8. Don't

- 保留 2.27:1 的历史渐变
- 在余额 / 错误 / 表单标签用渐变
- 业务组件手写 gradient / bg-clip-text

## 9. Accessibility

- 全区间 ≥4.5:1
- E28 例外注销
- 不满足阈值不得标 VERIFIED

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- Hero 统一 4xl 36px/44px，各断点不放大；渐变色值不变

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. contrast-engine.mjs 1001 点采样 × 7 背景 PASS
2. 全库手写渐变命中 = 0（唯一出口除外）
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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS8-S01-S` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `35 Design Governance Standard` |
| 下一模块 | — |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
