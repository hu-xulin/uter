# UTER DESIGN SYSTEM 6.0 · 24-S Code Syntax Highlighting Standard (专项)

> **规范编号** `UDS6-S24-S` · **唯一文件** `CODE-SYNTAX-HIGHLIGHTING-STANDARD.md` · **版本** `6.0.0` · **状态** `IMPLEMENTED_NOT_VERIFIED`
> **上级归属** 专项规范，登记于 24 号模块之下，不构成第二套设计系统
> **唯一数值来源** [`TOKEN-MANIFEST.json`](./TOKEN-MANIFEST.json) · **生成器** [`registry/build.mjs`](./registry/build.mjs)
> **对应设计原则** Developer Experience / Accessibility / Consistency
> **视觉审核入口** [`SHOWCASE-6.0.html`](./SHOWCASE-6.0.html#mod-24-S)

---

## 1. Overview

24 号规范的专项补充：20 个语法语义 Token 的 Light / Dark 明确色值、5 个引擎 Adapter、26 语言降级、对比度实测。作为 24-S 登记在 36 模块体系内，不构成第二套设计系统。

本模块属于 6.0 五层架构 `Primitive → Semantic → Component → UI Component → Product Page`。6.0 为完整重建，5.0 及更早版本只用于识别历史文件、识别现有代码依赖与迁移风险分析，**不作为本模块的视觉设计依据**。当前运行时强制标准仍为 3.0；6.0 数值冻结与全站迁移须在用户视觉审核通过后按 Phase 5 → Phase 6 顺序执行。

| 属性 | 值 |
|---|---|
| 状态 | `IMPLEMENTED_NOT_VERIFIED`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | `PENDING_USER_REVIEW` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

1. 20 个语义 Token：keyword / string / number / function / property / variable / type / operator / punctuation / comment / constant / boolean / null / tag / attribute / regexp / builtin / inserted / deleted / invalid
2. Light（代码背景 #F6F8FA）：keyword #7C3AED、string #047857、number #A54600、function #1D4ED8、property #0369A1、variable #0F172A、type #0369A1、operator #475569、punctuation #475569、comment #5B6779、constant #A54600、boolean #7C3AED、null #7C3AED、tag #1D4ED8、attribute #047857、regexp #A54600、builtin #1D4ED8、inserted #047857、deleted #B91C1C、invalid #B91C1C
3. Dark（代码背景 #0E1524）：keyword #C4B5FD、string #6EE7B7、number #FCD34D、function #93C5FD、property #7DD3FC、variable #E2E8F0、type #7DD3FC、operator #CBD5E1、punctuation #CBD5E1、comment #94A3B8、constant #FCD34D、boolean #C4B5FD、null #C4B5FD、tag #93C5FD、attribute #6EE7B7、regexp #FCD34D、builtin #93C5FD、inserted #6EE7B7、deleted #FCA5A5、invalid #FCA5A5
4. 旧 5 个 oklch Token 仅作迁移参考，不自动继承为 6.0 值；6.0 全部改用 HEX 并经实算
5. 实测：Light 最低 5.15:1、Dark 最低 7.11:1，全部 ≥4.5:1（contrast-engine.mjs）
6. 引擎 Adapter：CodeMirror 6 `HighlightStyle` / Lezer `tags` / Yace token class / Marked code fence / Shiki 仅语言类型，颜色一律回落到 `--ds-syntax-*`
7. JSON / JSONC 映射：property → `--ds-syntax-property`、string → `-string`、number → `-number`、true/false → `-boolean`、null → `-null`、括号逗号 → `-punctuation`
8. inserted / deleted / invalid 必须同时有行背景 `--ds-color-code-line-added/deleted/error` 与 `+` / `-` / 警告图标
9. 语法类别不得只靠颜色区别：keyword 用 600 字重、comment 用 italic，作为第二视觉通道
10. 不支持语言降级为 Plain Text，并在语言标签明确标注 `text`

## 3. Tokens

本表由 `TOKEN-MANIFEST.json` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 `check-design-system-6.0.mjs` 校验；`—（同值）` 表示该 Token 主题无关。

| Token | Light | Dark | 单位 | 说明 |
|---|---|---|---|---|
| `--ds-syntax-keyword` | #0000FF | #569CD6 | color | 语法高亮 keyword（官方 #0000FF / #569CD6） |
| `--ds-syntax-string` | #A31515 | #CE9178 | color | 语法高亮 string（官方 #A31515 / #CE9178） |
| `--ds-syntax-number` | #098255 | #B5CEA8 | color | 语法高亮 number（官方 #098658 / #B5CEA8） |
| `--ds-syntax-function` | #795E26 | #DCDCAA | color | 语法高亮 function（官方 #795E26 / #DCDCAA） |
| `--ds-syntax-property` | #001080 | #9CDCFE | color | 语法高亮 property（官方 #001080 / #9CDCFE） |
| `--ds-syntax-variable` | #001080 | #9CDCFE | color | 语法高亮 variable（官方 #001080 / #9CDCFE） |
| `--ds-syntax-type` | #257B94 | #4EC9B0 | color | 语法高亮 type（官方 #267F99 / #4EC9B0） |
| `--ds-syntax-operator` | #000000 | #D4D4D4 | color | 语法高亮 operator（官方 #000000 / #D4D4D4） |
| `--ds-syntax-punctuation` | #000000 | #D4D4D4 | color | 语法高亮 punctuation（官方 #000000 / #D4D4D4） |
| `--ds-syntax-comment` | #008000 | #6A9955 | color | 语法高亮 comment（官方 #008000 / #6A9955） |
| `--ds-syntax-constant` | #0070C1 | #4FC1FF | color | 语法高亮 constant（官方 #0070C1 / #4FC1FF） |
| `--ds-syntax-boolean` | #0000FF | #569CD6 | color | 语法高亮 boolean（官方 #0000FF / #569CD6） |
| `--ds-syntax-null` | #0000FF | #569CD6 | color | 语法高亮 null（官方 #0000FF / #569CD6） |
| `--ds-syntax-tag` | #800000 | #569CD6 | color | 语法高亮 tag（官方 #800000 / #569CD6） |
| `--ds-syntax-attribute` | #E50000 | #9CDCFE | color | 语法高亮 attribute（官方 #E50000 / #9CDCFE） |
| `--ds-syntax-regexp` | #811F3F | #D16969 | color | 语法高亮 regexp（官方 #811F3F / #D16969） |
| `--ds-syntax-builtin` | #257B94 | #4EC9B0 | color | 语法高亮 builtin（官方 #267F99 / #4EC9B0） |
| `--ds-syntax-inserted` | #098255 | #B5CEA8 | color | 语法高亮 inserted（官方 #098658 / #B5CEA8） |
| `--ds-syntax-deleted` | #A31515 | #CE9178 | color | 语法高亮 deleted（官方 #A31515 / #CE9178） |
| `--ds-syntax-invalid` | #CD3131 | #F44747 | color | 语法高亮 invalid（官方 #CD3131 / #F44747） |

> 引用纪律：业务页面不得直接引用 `primitive` 层色值；必须经 `semantic` / `component` 层。新增数值必须先进入 `TOKEN-MANIFEST.json`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 `#mod-24-S` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | `default` / `selected` / `read-only` / `editable` / `error` / `copy-success` / `copy-failure` |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [`COMPONENT-REGISTRY.json`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（default / hover / focus / active / disabled / loading / error / success）在所有组件中命名与视觉一致 |

## 6. Usage

```tsx
{ "model": "gpt-4o", "max_tokens": 1024, "stream": true, "stop": null }
```

## 7. Do

- 所有引擎映射到同一 Token 集
- keyword 加 600 字重、comment 用 italic

## 8. Don't

- 用 chart-1..5 代替 syntax
- 只靠颜色区分语法类别

## 9. Accessibility

- 全部 ≥4.5:1
- 新增/删除/错误有非颜色标识

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

- 代码背景色不随断点变化

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

1. 20 Token × 2 主题 = 40 个色值全部实测达标
2. 5 引擎 Adapter 登记
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
| 规范注册 | [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json) → `UDS6-S24-S` |
| Token 注册 | [`TOKEN-REGISTRY.json`](./TOKEN-REGISTRY.json) |
| 依赖 | [`DEPENDENCY-GRAPH.json`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [`DEPRECATED-REGISTRY.json`](./DEPRECATED-REGISTRY.json) |
| 例外 | [`EXCEPTION-REGISTRY.json`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | `24 Code and Developer UI Standard` |
| 下一模块 | `25 Authentication Standard` |

---

*本文件由 `registry/build.mjs` 从 `TOKEN-MANIFEST.json` 生成，禁止手工编辑数值。*
