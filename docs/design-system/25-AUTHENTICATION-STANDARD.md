# UTER DESIGN SYSTEM 8.0.0 · 25 Authentication Standard

> **规范编号** `UDS8-S25` · **唯一文件** `25-AUTHENTICATION-STANDARD.md` · **版本** `8.0.0` · **状态** `ACCEPTANCE_READY`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Reliability / Accessibility / Consistency
> **视觉审核入口** [`SHOWCASE-8.0.0.html`](./SHOWCASE-8.0.0.html#mod-25)

---

## 1. Overview

Sign In / Sign Up / Email OTP / SMS OTP / OAuth / Verification / Error / Loading / Success，认证界面与全局设计系统一致。

本模块属于 UDS 8.0.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。7.0 为其直接前版（2026-11-16 经用户授权升版），5.0 及更早版本只用于识别历史文件、识别现有代码依赖与迁移风险分析，**不作为本模块的视觉设计依据**。当前运行时唯一权威为 UDS 8.0.0（3.0 兼容层已退役）；8.0.0 视觉基线随升版重冻结（`VISUAL-BASELINE.json`）。

| 属性 | 值 |
|---|---|
| 状态 | `ACCEPTANCE_READY`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. 认证卡片宽 400px、圆角 12px、内边距 32px、surface-base + 1px 边框；<480px 宽 100%−24px
2. 标题 30px/38px semibold，副标题 14px/22px text-secondary
3. 输入框高度 40px（H5 44px）、字号 ≥16px（H5 防放大）；Label 12px/18px
4. OTP 输入：6 格，每格 44×48px、圆角 5px、字号 20px/26px、等宽数字；支持粘贴自动分发
5. OAuth 按钮：高 40px、Outline 变体、厂商图标 20px；不得显示第三方品牌标语
6. Primary 提交按钮高 40px（H5 44px）、宽 100%；Loading 保留文案 + Spinner + aria-busy
7. 错误：Alert danger 组件 + 具体原因 + aria-live；成功：Toast success 后跳转
8. Verification 状态有明确进度指示（3 步：发送 → 验证 → 完成）
9. 不得修改真实认证业务逻辑、密码策略或支付配置；本规范只约束视觉与交互

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-8.0.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-radius-dialog` | var(--ds-radius-xl) | —（同值） | token-ref | Dialog = 12px |
| `--ds-space-8` | 32px | —（同值） | px | 32 |
| `--ds-text-3xl` | 30px | —（同值） | px | 分区标题 |
| `--ds-leading-h2` | 38px | —（同值） | px | 30px 分区标题 |
| `--ds-text-sm` | 14px | —（同值） | px | 正文默认 |
| `--ds-control-lg` | 40px | —（同值） | px | Large 按钮 / 输入 |
| `--ds-control-touch` | 44px | —（同值） | px | Touch 最小触控目标 / H5 |
| `--ds-control-h5-input-font-size` | 16px | —（同值） | px | H5 输入字号（iOS 防自动放大） |
| `--ds-radius-md` | 5px | —（同值） | px | 默认 |
| `--ds-color-status-danger` | #B91C1C | #FCA5A5 | color | 危险 |
| `--ds-color-status-success` | #15803D | #6EE7B7 | color | 成功 |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-25` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `loading` / `error` / `success` / `disabled` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
<form aria-labelledby="signin-title">…</form>
```

## 7. Do

- 错误给出具体原因
- H5 输入 ≥16px

## 8. Don't

- 改变认证业务状态机
- 显示第三方品牌标语

## 9. Accessibility

- OTP 有 aria-label 与自动焦点推进
- 错误 aria-live

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- <480px 卡片近全宽、按钮 44px

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 9 类认证场景规格齐全
2. 本模块引用的每个 Token 必须能在 TOKEN-MANIFEST.json 中解析，且 CSS / TS / Showcase 三处数值一致
3. check-design-system-8.0.0.mjs 对应检查项 EXIT=0
4. Light / Dark 两套映射完整，无缺失键、无主题特例裸色值
5. Do / Don’t 中的反例在全库静态扫描中命中数为 0（或已登记进 EXCEPTION-REGISTRY.json）

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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS8-S25` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `24-S Code Syntax Highlighting Standard (专项)` |
| 下一模块 | `26 User and Organization Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
