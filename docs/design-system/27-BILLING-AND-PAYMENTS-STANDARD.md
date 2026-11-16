# UTER DESIGN SYSTEM 8.0.0 · 27 Billing and Payments Standard

> **规范编号** `UDS8-S27` · **唯一文件** `27-BILLING-AND-PAYMENTS-STANDARD.md` · **版本** `8.0.0` · **状态** `ACCEPTANCE_READY`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Reliability / Data Integrity / Accessibility
> **视觉审核入口** [`SHOWCASE-8.0.0.html`](./SHOWCASE-8.0.0.html#mod-27)

---

## 1. Overview

Balance / Recharge / Payment / Order / Refund / Invoice / Transaction / Payment Method。硬性红线：设计迁移不得修改真实支付业务逻辑或支付配置。

本模块属于 UDS 8.0.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。7.0 为其直接前版（2026-11-16 经用户授权升版），5.0 及更早版本只用于识别历史文件、识别现有代码依赖与迁移风险分析，**不作为本模块的视觉设计依据**。当前运行时唯一权威为 UDS 8.0.0（3.0 兼容层已退役）；8.0.0 视觉基线随升版重冻结（`VISUAL-BASELINE.json`）。

| 属性 | 值 |
|---|---|
| 状态 | `ACCEPTANCE_READY`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. 金额显示强制 `¥` + 千分位 + 2 位小数 + `tabular-nums` + `--ds-font-mono` + 右对齐；字号 16px/24px semibold
2. Balance 卡片：数值 36px/44px semibold tabular-nums，标签 12px/18px secondary；禁止渐变
3. Recharge：金额选项为 Card 网格（3 列桌面 / 2 列平板 / 1 列移动），选中态 2px brand-1 边框
4. Payment：支付方式列表项高 56px，图标 24px；选中 radio；确认按钮 Primary 40px
5. Order / Refund / Transaction 状态：paid / pending / failed / refunded / partial，颜色严格取 status Token 且附文字
6. Invoice：Description List 布局，金额列右对齐；下载按钮 Outline + 16px 图标
7. 危险操作（退款 / 撤销）用 Destructive + 二次确认，确认文案写明金额与不可逆后果
8. 成功 / 失败反馈：Toast + 明确金额与订单号（等宽）；失败必须给出可操作的下一步
9. 本规范只描述视觉与交互；不得改变支付状态机、回调、金额计算、支付配置或生产数据

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-8.0.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-text-base` | 16px | —（同值） | px | 长文本默认 / 指标数值 / H5 输入 |
| `--ds-text-4xl` | 36px | —（同值） | px | 页面主标题 |
| `--ds-leading-base` | 24px | —（同值） | px | 16px 长文本 / 控件 |
| `--ds-leading-h1` | 44px | —（同值） | px | 36px 页面标题 |
| `--ds-numeric-tabular` | tabular-nums | —（同值） | keyword | 金额 / 余额 / Token 数 / 价格 / 用量 / 订单号 / 指标 |
| `--ds-font-mono` | ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace, 'Source Han Sans SC', 'Source Han Sans CN', '思源黑体', 'Noto Sans SC Variable', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif | —（同值） | stack | 等宽字体栈（CJK 回退置于 monospace 之后，保持拉丁等宽） |
| `--ds-color-status-success` | #15803D | #6EE7B7 | color | 成功 |
| `--ds-color-status-danger` | #B91C1C | #FCA5A5 | color | 危险 |
| `--ds-color-status-warning` | #A54600 | #FCD34D | color | 警告 |
| `--ds-radius-card` | var(--ds-radius-lg) | —（同值） | token-ref | Card = 10px |
| `--ds-border-width-focus` | 2px | —（同值） | px | 聚焦边框 / 焦点环 |
| `--ds-color-border-focus` | #5B5EE6 | #8B8DF5 | color | 聚焦边框 / 焦点环 |
| `--ds-control-lg` | 40px | —（同值） | px | Large 按钮 / 输入 |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-27` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `loading` / `success` / `error` / `disabled` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
<span class="amount">¥ 12,345.67</span>
<button class="btn btn--destructive">申请退款 ¥ 100.00</button>
```

## 7. Do

- 金额始终等宽右对齐
- 危险操作写明不可逆后果

## 8. Don't

- 余额或支付状态用渐变文字
- 修改支付业务逻辑或配置
- 失败提示不给出下一步

## 9. Accessibility

- 金额 ≥4.5:1
- 状态有文字与图标

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- <768px 金额选项单列、账单表转卡片

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 8 类账单场景规格齐全
2. 支付业务代码零改动由门禁证明
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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS8-S27` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `26 User and Organization Standard` |
| 下一模块 | `28 API and Token Management Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
