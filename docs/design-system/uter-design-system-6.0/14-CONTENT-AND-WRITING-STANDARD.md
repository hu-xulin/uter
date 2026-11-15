# UTER DESIGN SYSTEM 6.0 · 14 Content and Writing Standard

> **规范编号** `UDS6-S14` · **唯一文件** `14-CONTENT-AND-WRITING-STANDARD.md` · **版本** `6.0.0` · **状态** `IMPLEMENTED_NOT_VERIFIED`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Clarity / Data Integrity / Reliability
> **视觉审核入口** [`SHOWCASE-6.0.html`](./SHOWCASE-6.0.html#mod-14)

---

## 1. Overview

标题、正文、帮助、表单说明、错误 / 成功反馈、空状态、危险操作、API 文案、金额、Token 数量、时间日期单位与数字格式。

本模块属于 6.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。6.0 为完整重建，5.0 及更早版本只用于识别历史文件、识别现有代码依赖与迁移风险分析，**不作为本模块的视觉设计依据**。当前运行时强制标准仍为 3.0；6.0 数值冻结与全站迁移须在用户视觉审核通过后按 Phase 5 → Phase 6 顺序执行。

| 属性 | 值 |
|---|---|
| 状态 | `IMPLEMENTED_NOT_VERIFIED`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. 标题：页面主标题 36px/44px semibold；分区 30px/38px；卡片 18px/26px；不使用渐变于普通标题
2. 正文 14px/22px；长文本 16px/26px；帮助文字 12px/18px `--ds-color-text-secondary`
3. 表单说明紧贴控件下方 4px；错误文案 12px/18px `--ds-color-status-danger` + 图标；成功反馈同规格用 success
4. 空状态：标题 18px/26px + 说明 14px/22px + 主操作按钮；不得只显示空白
5. 危险操作：按钮文案用明确动词（「删除 API Key」），二次确认说明后果，不用「确定」
6. API 文案：HTTP 方法大写、路径用等宽字体、字段名为原文不翻译
7. 金额：`¥` + 千分位 + 2 位小数 + `tabular-nums`；余额不得用渐变或弱化色
8. Token 数量 / 用量：整数千分位，单位 `tokens` / `K tokens` / `M tokens`，等宽数字右对齐
9. 时间：24 小时制 `YYYY-MM-DD HH:mm:ss`；相对时间仅在日志列表使用并附绝对时间 title
10. 日期 / 数字 / 货币按 locale 格式化；代码内容、Request ID、API Key 不参与翻译
11. 单位：不省略（「10 RPM」不写「10」）；中英文之间不加多余空格由排版处理

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-6.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-text-sm` | 14px | —（同值） | px | 正文默认 |
| `--ds-text-base` | 16px | —（同值） | px | 长文本默认 / 指标数值 / H5 输入 |
| `--ds-text-2xs` | 12px | —（同值） | px | 最小可见文字（全站下限） |
| `--ds-leading-body` | 22px | —（同值） | px | 14px 正文 |
| `--ds-leading-long` | 26px | —（同值） | px | 16–18px 长文本 / h3 |
| `--ds-numeric-tabular` | tabular-nums | —（同值） | keyword | 金额 / 余额 / Token 数 / 价格 / 用量 / 订单号 / 指标 |
| `--ds-color-status-danger` | #B91C1C | #FCA5A5 | color | 危险 |
| `--ds-color-status-success` | #15803D | #6EE7B7 | color | 成功 |
| `--ds-font-mono` | ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace, 'Source Han Sans SC', 'Source Han Sans CN', '思源黑体', 'Noto Sans SC Variable', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif | —（同值） | stack | 等宽字体栈（CJK 回退置于 monospace 之后，保持拉丁等宽） |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-14` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `error` / `success` / `loading` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
<span class="amount">¥ 12,345.67</span>
<code>GPT-4o · 1,024 tokens · 10 RPM</code>
```

## 7. Do

- 危险操作写明后果
- 金额 / Token 用 tabular-nums

## 8. Don't

- 把 API Key 或余额做成渐变文字
- 错误提示只写「失败」不写原因

## 9. Accessibility

- 错误文案可读且被 aria-describedby 关联
- 帮助文字 ≥12px 且 ≥4.5:1

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- 长文本在移动端不截断关键数值

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 金额 / Token / 时间 / 单位格式均有确定模板
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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS6-S14` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `13 Accessibility Standard` |
| 下一模块 | `15 Data Visualization Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
