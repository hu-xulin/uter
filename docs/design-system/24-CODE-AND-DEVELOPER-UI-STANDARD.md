# UTER DESIGN SYSTEM 8.0.0 · 24 Code and Developer UI Standard

> **规范编号** `UDS8-S24` · **唯一文件** `24-CODE-AND-DEVELOPER-UI-STANDARD.md` · **版本** `8.0.0` · **状态** `ACCEPTANCE_READY`
> **上级归属** 36 个正式规范模块之一
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Developer Experience / Data Integrity / Accessibility
> **视觉审核入口** [`SHOWCASE-8.0.0.html`](./SHOWCASE-8.0.0.html#mod-24)

---

## 1. Overview

7.0 重点模块：覆盖 CodeBlock / CodeBlockEditor / JsonCodeEditor / JsonEditor / Markdown Code Block / Inline Code / API Request / API Response / cURL / 日志 / 错误栈 / 终端预览。专项规范 24-S 登记于此。

本模块属于 UDS 8.0.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。7.0 为其直接前版（2026-11-16 经用户授权升版），5.0 及更早版本只用于识别历史文件、识别现有代码依赖与迁移风险分析，**不作为本模块的视觉设计依据**。当前运行时唯一权威为 UDS 8.0.0（3.0 兼容层已退役）；8.0.0 视觉基线随升版重冻结（`VISUAL-BASELINE.json`）。

| 属性 | 值 |
|---|---|
| 状态 | `ACCEPTANCE_READY`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. 实际扫描结果：引擎为 CodeMirror 6 + Lezer + Yace 1.1.0 + Marked 18 + Shiki 4.3.0；组件位于 `web/src/components/ai-elements/code-block.tsx`、`web/src/components/json-code-editor.tsx`、`web/src/components/json-editor.tsx`、`web/src/components/ui/markdown.tsx`
2. 代码字体强制 `var(--ds-font-mono)`（保留 Uter 现有栈），默认 13px/20px
3. 代码背景 `--ds-color-code-background` #F6F8FA / #0E1524；默认前景 4.5:1 起
4. 20 个 Syntax Token 全部有 Light / Dark 明确 HEX，在真实代码背景上实测：Light 最低 5.15:1、Dark 最低 7.11:1；行号 `--ds-color-code-gutter` #5B6779 / #94A3B8 同样实测 ≥4.5:1（axe color-contrast 通过）
5. 统一语义映射：`--ds-syntax-*` → Highlighter Adapter → Renderer；不同引擎不得为同一语义使用不同颜色
6. JSON 编辑器（Yace）禁止再用 chart-1..5 代替 Syntax Token；必须映射到 `--ds-syntax-property` / `-string` / `-number` / `-boolean` / `-null` / `-punctuation`
7. 13 个组件状态：Default / Hover / Focus / Selected / Read-only / Editable / Disabled / Loading / Error / Copy Success / Copy Failure / Collapsed / Expanded
8. 代码组件元素：背景、行号、当前行、选区、光标、折叠、滚动条、复制 / 下载按钮、语言标签、文件名全部有 Token
9. 语言覆盖 26 种（JS/TS/JSX/TSX/JSON/JSONC/HTML/CSS/SCSS/Bash/Shell/cURL/Python/Go/Java/Rust/SQL/YAML/TOML/Markdown/MDX/XML/GraphQL/Dockerfile/Diff/Plain Text）；不支持语言降级为 Plain Text 并显示语言标签
10. 普通代码文字目标 4.5:1；新增 / 删除 / 错误状态除颜色外必须有 `+` / `-` / 警告图标或行背景
11. Showcase 必须提供 Light / Dark、全部语法色板、≥10 种语言真实代码示例、JSON 编辑器、只读 / 编辑 / 选区 / 光标 / 行号 / 错误状态、对比度结果与 Token Inspector

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-8.0.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-font-mono` | ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace, 'Source Han Sans SC', 'Source Han Sans CN', '思源黑体', 'Noto Sans SC Variable', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif | —（同值） | stack | 等宽字体栈（CJK 回退置于 monospace 之后，保持拉丁等宽） |
| `--ds-text-xs` | 13px | —（同值） | px | 密集表格 / 代码 / 标签 |
| `--ds-leading-code` | 20px | —（同值） | px | 13px 代码 / 20px 控件 |
| `--ds-color-code-background` | #F6F8FA | #0E1524 | color | 编辑器背景 |
| `--ds-color-code-foreground` | #0F172A | #E2E8F0 | color | 编辑器默认前景 |
| `--ds-color-code-gutter` | #5B6779 | #94A3B8 | color | 行号（真实代码背景实测 ≥4.5:1，axe color-contrast 通过） |
| `--ds-color-code-current-line` | #EAF0FF | #16203A | color | 当前行高亮 |
| `--ds-color-code-selection` | #C7D2FE | #33417A | color | 编辑器选区 |
| `--ds-color-code-cursor` | #5B5EE6 | #A1A3F7 | color | 光标 |
| `--ds-syntax-keyword` | #0000FF | #569CD6 | color | 语法高亮 keyword（官方 #0000FF / #569CD6） |
| `--ds-syntax-string` | #A31515 | #CE9178 | color | 语法高亮 string（官方 #A31515 / #CE9178） |
| `--ds-syntax-number` | #098255 | #B5CEA8 | color | 语法高亮 number（官方 #098658 / #B5CEA8） |
| `--ds-syntax-property` | #001080 | #9CDCFE | color | 语法高亮 property（官方 #001080 / #9CDCFE） |
| `--ds-syntax-comment` | #008000 | #6A9955 | color | 语法高亮 comment（官方 #008000 / #6A9955） |
| `--ds-syntax-inserted` | #098255 | #B5CEA8 | color | 语法高亮 inserted（官方 #098658 / #B5CEA8） |
| `--ds-syntax-deleted` | #A31515 | #CE9178 | color | 语法高亮 deleted（官方 #A31515 / #CE9178） |
| `--ds-syntax-invalid` | #CD3131 | #F44747 | color | 语法高亮 invalid（官方 #CD3131 / #F44747） |
| `--ds-radius-code` | var(--ds-radius-lg) | —（同值） | token-ref | Code Block = 8px |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-24` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `hover` / `focus` / `selected` / `read-only` / `editable` / `disabled` / `loading` / `error` / `copy-success` / `copy-failure` / `collapsed` / `expanded` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
/* 统一语义映射（禁止各引擎自定义颜色） */
const style = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--ds-syntax-keyword)" },
  { tag: tags.string,  color: "var(--ds-syntax-string)"  },
])
```

## 7. Do

- 所有引擎映射到同一 `--ds-syntax-*`
- JSON 编辑器用 syntax Token

## 8. Don't

- 用 chart-1..5 给 JSON 上色
- 不同引擎为 keyword 用不同颜色
- 用静态伪造示例代替真实运行组件

## 9. Accessibility

- 代码文字 ≥4.5:1
- 新增/删除/错误另有非颜色标识

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- <768px 代码块横向滚动、行号槽固定、复制按钮常驻

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 20 Syntax Token Light/Dark 齐全且实测达标
2. 5 个高亮引擎均登记 Adapter
3. 26 语言覆盖表齐全
4. 本模块引用的每个 Token 必须能在 TOKEN-MANIFEST.json 中解析，且 CSS / TS / Showcase 三处数值一致
5. check-design-system-8.0.0.mjs 对应检查项 EXIT=0
6. Light / Dark 两套映射完整，无缺失键、无主题特例裸色值
7. Do / Don’t 中的反例在全库静态扫描中命中数为 0（或已登记进 EXCEPTION-REGISTRY.json）

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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS8-S24` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `23 Data Display Standard` |
| 下一模块 | `24-S Code Syntax Highlighting Standard (专项)` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
