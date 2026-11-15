# UTER DESIGN SYSTEM 7.0 · 32 Empty, Loading and Error Standard

> **规范编号** `UDS7-S32` · **唯一文件** `32-EMPTY-LOADING-AND-ERROR-STANDARD.md` · **版本** `7.0.0` · **状态** `ACCEPTANCE_READY`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Clarity / Reliability / Predictability
> **视觉审核入口** [`SHOWCASE-7.0.html`](./SHOWCASE-7.0.html#mod-32)

---

## 1. Overview

Empty / Skeleton / Spinner / Error / Retry / Offline / Permission Denied / Not Found 八态。

本模块属于 7.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。7.0 为完整重建，5.0 及更早版本只用于识别历史文件、识别现有代码依赖与迁移风险分析，**不作为本模块的视觉设计依据**。当前运行时强制标准仍为 3.0；7.0 视觉基线已于 2026-11-15 经用户授权冻结（`VISUAL-BASELINE.json`），全站迁移按 Phase 6 分期执行。

| 属性 | 值 |
|---|---|
| 状态 | `ACCEPTANCE_READY`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. Empty：插画区 ≤120px、标题 18px/26px、说明 14px/22px secondary、主操作 Primary 36px；容器最小高 240px 居中
2. Skeleton：surface-sunken 底、圆角随被替代组件、1000ms linear 循环；reduced-motion 下改静态占位
3. Spinner：16px 默认 / 24px 页面级，1000ms linear；超过 300ms 才显示避免闪烁
4. Error：标题 18px/26px + 原因 14px/22px + 错误码（`--ds-font-mono` 13px）+ Retry 按钮
5. Retry：Outline 按钮 36px；失败次数 ≥3 时追加「联系支持」Link
6. Offline：Banner 通栏 48px status-warning + 明确「网络不可用，数据可能不是最新」
7. Permission Denied：403 文案 + 返回上一页 / 首页两个操作，不显示技术细节
8. Not Found：404 + 搜索框 + 返回首页；不显示堆栈
9. 所有状态必须有 aria-live 或 role；Loading 用 aria-busy

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-7.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-text-lg` | 18px | —（同值） | px | h3 / 卡片标题 |
| `--ds-leading-h3` | 26px | —（同值） | px | 18px h3 |
| `--ds-text-sm` | 14px | —（同值） | px | 正文默认 |
| `--ds-leading-body` | 22px | —（同值） | px | 14px 正文 |
| `--ds-color-text-secondary` | #475569 | #CBD5E1 | color | 次级文本（与 muted / tertiary 明确区分） |
| `--ds-color-surface-sunken` | #F1F5F9 | #080D18 | color | 下沉表面（代码块 / 井） |
| `--ds-font-mono` | ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace, 'Source Han Sans SC', 'Source Han Sans CN', '思源黑体', 'Noto Sans SC Variable', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif | —（同值） | stack | 等宽字体栈（CJK 回退置于 monospace 之后，保持拉丁等宽） |
| `--ds-text-xs` | 13px | —（同值） | px | 密集表格 / 代码 / 标签 |
| `--ds-control-md` | 36px | —（同值） | px | Medium 按钮 / 输入 |
| `--ds-color-status-warning` | #A54600 | #FCD34D | color | 警告 |
| `--ds-motion-normal` | 150ms | —（同值） | ms | Active / 微交互 |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-32` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `loading` / `error` / `empty` / `offline` / `disabled` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
<Empty title="还没有 API Key" action="创建 API Key" />
```

## 7. Do

- Error 给原因 + 错误码 + Retry
- Loading 延迟 300ms 显示

## 8. Don't

- 空状态只留空白
- 错误页暴露堆栈

## 9. Accessibility

- role / aria-live / aria-busy
- Retry 可键盘触发

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- <480px Empty 插画区 ≤96px、按钮 Touch 44px

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 8 态齐全
2. 本模块引用的每个 Token 必须能在 TOKEN-MANIFEST.json 中解析，且 CSS / TS / Showcase 三处数值一致
3. check-design-system-7.0.mjs 对应检查项 EXIT=0
4. Light / Dark 两套映射完整，无缺失键、无主题特例裸色值
5. Do / Don’t 中的反例在全库静态扫描中命中数为 0（或已登记进 EXCEPTION-REGISTRY.json）

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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS7-S32` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `31 Page Templates Standard` |
| 下一模块 | `33 Localization Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
