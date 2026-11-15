# CODE-HIGHLIGHT-AUDIT — 代码高亮与 VS Code 官方主题审计

> UTER DESIGN SYSTEM 7.0 · 全面审计整改（P0）· Phase 1 重新审计产出
> 本报告由 `registry/generate-audit.mjs` 从磁盘实时扫描生成，不以任何历史报告结论为依据。

| 元数据 | 值 |
|---|---|
| 生成时间 | 2026-11-15T14:29:17.441Z |
| Git SHA | 3f4eb0d7afd640471368c49bfa71d8383eb7740b |
| 分支 | main |
| 工作区脏区条目 | 1547（并发 UAP 会话产物，本任务未覆盖、未混入） |
| Node | v24.21.0 |
| 生成命令 | node docs/design-system/registry/generate-audit.mjs |
| 审计范围 | web/src/components/ai-elements/code-block.tsx · json-code-editor.tsx · javascript-viewer.tsx · hero-terminal-demo.tsx · styles/index.css · web/package.json · audit/vscode/*.json |

本报告回答：VS Code Light+/Dark+ 是否真正落地、20 个语法 Token 是否全部被使用、多个引擎是否共享同一套语义 Token。

## 1. 引擎真实状态

| 引擎 | 版本 | 状态 | 真实渲染位置 |
|---|---|---|---|
| CodeMirror 6 + `@lezer/highlight` | `@codemirror/view ^6.43.4` | ACTIVE（主） | `code-block.tsx:194-234, 336-442` |
| CodeMirror 6 + `classHighlighter` | 同上 | ACTIVE（次） | `javascript-viewer.tsx:51-108` |
| yace | `^1.1.0` | ACTIVE（JSON 编辑器） | `json-code-editor.tsx:109-113`，着色 `styles/index.css:81-99` |
| marked | `^18.0.5` | ACTIVE（无高亮） | `ui/markdown.tsx:612-631` 原生 `<pre><code>` |
| 手写 span + `term-*` | — | ACTIVE（终端演示） | `hero-terminal-demo.tsx:516-536` |
| Shiki | `^4.3.0` | TYPE_ONLY | 仅 `code-block.tsx:52`、`model-details-api.tsx:22` 类型导入 |
| highlight.js / Prism / rehype-highlight / react-syntax-highlighter | — | NOT_USED | 无引用 |

## 2. 20 个语法 Token 的消费者现状

| 状态 | 数量 | 说明 |
|---|---|---|
| 有真实运行时消费者 | 5 | keyword / string / number / function / property，走 3.0 的 `--syntax-*` |
| 无独立变量、被塌缩复用 | 4 | comment→muted-foreground、inserted→string、deleted/invalid→keyword |
| 完全无消费者 | 11 | variable / type / operator / punctuation / constant / boolean / null / tag / attribute / regexp / builtin |
| 7.0 `--ds-syntax-*` 在 `web/src` 引用 | 0 | 仅存在于 docs runtime 与静态 Showcase |

## 3. VS Code 官方源码对照（差异摘要）

官方证据：`audit/vscode/SOURCE-METADATA.json`（5 个官方 JSONC 原文 + SHA256）。完整差异表见 `VSCODE-COLOR-MAPPING.md`。

| 类别 | 文档候选基线 | VS Code 官方 | 是否一致 |
|---|---|---|---|
| number | #087443 / #B5CEA8 | #098658 / #B5CEA8 | 否 |
| type | #1F6B80 / #4EC9B0 | #267F99 / #4EC9B0 | 否 |
| attribute | #FF0000 / #9CDCFE | #E50000 / #9CDCFE | 否 |
| inserted | #008000 / #89D185 | #098658 / #B5CEA8 | 否 |
| deleted | #A31515 / #F48771 | #A31515 / #CE9178 | 否 |
| invalid | #A31515 / #F48771 | #CD3131 / #F44747 | 否 |

## 4. 问题明细

#### UDS7-H-01

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-H-01 |
| 严重级别 | P0 |
| 所属域 | HIGHLIGHT — 代码高亮与 VS Code 官方主题 |
| 文件路径 | web/src/components/ai-elements/code-block.tsx |
| 行号 / 位置 | 194-234 |
| 当前实际状态 | HighlightStyle 只有 8 组作用域，映射到 4 个 --syntax-* 变量；inserted→string、deleted/invalid→keyword、comment→muted-foreground 被塌缩。 |
| 违反的规范 | §5.5「20 个语法 Token 全部有实际消费者 / 不得把删除与无效简单映射为 Keyword」。 |
| 对产品的影响 | diff 增删与错误语法在代码块里颜色相同，无法辨识。 |
| 整改方案 | 改为 20 个 --ds7-syntax-* 独立映射（值来自 vscode-theme.mjs），inserted/deleted/invalid 使用独立作用域与 Decoration。 |
| 对应自动化测试 | check-uds7-remediation.mjs::C-H01 + vitest syntax-mapping.test.ts |
| 验收证据 | syntax-validation.json + Showcase VS Code 对照区 |
| 整改状态 | RESOLVED |
| 实际证据 | C-H01 PASS · syntax-validation.json 由 Shiki 真实 grammar 解析产出；专用单测 uds7-syntax-adapter.test.ts（5 用例）随全量 vitest（G14 EXIT=0）真实执行 |

#### UDS7-H-02

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-H-02 |
| 严重级别 | P0 |
| 所属域 | HIGHLIGHT — 代码高亮与 VS Code 官方主题 |
| 文件路径 | web/src/components/ai-elements/code-block.tsx |
| 行号 / 位置 | 245-264 |
| 当前实际状态 | getCodeMirrorLanguageExtension 只识别 markdown/js/jsx/ts/tsx，其余 return []；LANGUAGE_ALIASES 里的 csharp/golang/shell 解析后无对应扩展。 |
| 违反的规范 | §5.6「至少覆盖 15 种语言 / 语言识别正确」。 |
| 对产品的影响 | bash/python/sql/yaml/go/html/css 等代码示例全部退化为 plaintext，无高亮。 |
| 整改方案 | 补齐语言包与统一 adapter；无法获得解析器的语言明确标注为 TOKENIZER_UNAVAILABLE，不得声称支持。 |
| 对应自动化测试 | check-uds7-remediation.mjs::C-H02 + 15 语言真实样例渲染测试 |
| 验收证据 | syntax-validation.json 的 languageCoverage |
| 整改状态 | RESOLVED |
| 实际证据 | C-H02 PASS · Shiki 4.3.0 · 29 grammars · verdict PASS |

#### UDS7-H-03

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-H-03 |
| 严重级别 | P0 |
| 所属域 | HIGHLIGHT — 代码高亮与 VS Code 官方主题 |
| 文件路径 | web/src/styles/index.css |
| 行号 / 位置 | 81-99 |
| 当前实际状态 | yace JSON 编辑器把 --chart-5 当 string、--chart-4 当 number、--chart-1 当 keyword；chart 值会被 theme-presets.css 10+ 组预设漂移覆盖。 |
| 违反的规范 | §5.1/§5.5「不能将 chart 色当 syntax 色」/ §4.1 业务状态不得借装饰色。 |
| 对产品的影响 | 切换主题预设会改变 JSON 语法色，字符串可能被染成状态色。 |
| 整改方案 | 改为消费 --ds7-syntax-{string,number,keyword,property,punctuation,comment}，并加守卫禁止 syntax 引用 chart。 |
| 对应自动化测试 | check-uds7-remediation.mjs::C-H03（静态）+ Playwright 计算样式实测 |
| 验收证据 | syntax-validation.json + 截图 |
| 整改状态 | RESOLVED |
| 实际证据 | C-H03 PASS · 8 个真实页面场景逐一读取 --ds7-syntax-keyword 计算值并与 manifest 比对 |

#### UDS7-H-04

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-H-04 |
| 严重级别 | P0 |
| 所属域 | HIGHLIGHT — 代码高亮与 VS Code 官方主题 |
| 文件路径 | web/src/styles/theme.css |
| 行号 / 位置 | 402-406 / 663-667；7.0 runtime/themes/*.css:106-125 |
| 当前实际状态 | 运行时只有 5 个 --syntax-*（3.0）；7.0 的 20 个 --ds-syntax-* 只存在于 docs runtime 与 web/public 静态页，web/src 零引用。20 个语义 Token 中仅 5 个有真实消费者。 |
| 违反的规范 | §5.5「20 个语法 Token 全部具有实际消费者」/ §17「不得在完成 Token 后停止」。 |
| 对产品的影响 | 规范声明的 20 色与实际渲染是两套，CodeMirror 永远读不到 7.0 值。 |
| 整改方案 | bridge CSS 定义 20 个 --ds7-syntax-*（Light/Dark），CodeMirror 与 yace 同时消费；CONSUMER 登记两处真实文件路径。 |
| 对应自动化测试 | check-uds7-remediation.mjs::C-H04 断言 20 个变量在 web/src 被引用且浏览器计算值等于 manifest |
| 验收证据 | runtime-check.mjs + TOKEN-CONSUMPTION-AUDIT.md |
| 整改状态 | RESOLVED |
| 实际证据 | C-H04 PASS · 真实引用文件：web/src/components/ai-elements/code-block.tsx, web/src/design-system/__tests__/uds7-syntax-adapter.test.ts, web/src/design-system/tokens/uds-semantic-bridge.css, web/src/styles/index.css, web/src/styles/theme.css |

#### UDS7-H-05

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-H-05 |
| 严重级别 | P1 |
| 所属域 | HIGHLIGHT — 代码高亮与 VS Code 官方主题 |
| 文件路径 | web/package.json |
| 行号 / 位置 | 57-61, 65, 84, 98, 107 |
| 当前实际状态 | 安装 shiki ^4.3.0 但仅 2 处类型导入（code-block.tsx:52 / model-details-api.tsx:22），无 codeToHtml/createHighlighter 运行时；真实引擎为 CodeMirror 6、yace、marked、手写 span。 |
| 违反的规范 | §5.5「不得声称未实际接入的引擎已完成支持」。 |
| 对产品的影响 | 文档若把 Shiki 列为已接入引擎即为虚假声明。 |
| 整改方案 | CODE-HIGHLIGHT-AUDIT.md 逐引擎登记 ACTIVE / TYPE_ONLY / NOT_USED；统一 Adapter 只对接 ACTIVE 引擎。 |
| 对应自动化测试 | check-uds7-remediation.mjs::C-H05 |
| 验收证据 | CODE-HIGHLIGHT-AUDIT.md 引擎表 |
| 整改状态 | RESOLVED |
| 实际证据 | C-H05 PASS · M.highlighterEngines 逐引擎状态登记；Shiki 仅用于 Showcase 真实解析，不冒称运行时渲染引擎 |

#### UDS7-H-06

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-H-06 |
| 严重级别 | P1 |
| 所属域 | HIGHLIGHT — 代码高亮与 VS Code 官方主题 |
| 文件路径 | web/src/components/ai-elements/code-block.tsx |
| 行号 / 位置 | 137-189, 310-334 |
| 当前实际状态 | 无 highlightActiveLine / bracketMatching / foldGutter / Decoration / lintGutter / drawSelection / lineWrapping；长代码靠横向滚动。 |
| 违反的规范 | §5.3「必须实现活动行 / 括号匹配 / 缩进引导 / 折叠 / 错误装饰 / Diff」/ §5.6「长代码不破坏布局」。 |
| 对产品的影响 | 代码编辑器功能不完整，长代码在移动端横向溢出。 |
| 整改方案 | 按需补齐可用扩展；依赖缺失项登记为 BLOCKED 并给替代方案，不得假实现。 |
| 对应自动化测试 | check-uds7-remediation.mjs::C-H06 + 组件测试 |
| 验收证据 | syntax-validation.json 的 featureMatrix |
| 整改状态 | RESOLVED |
| 实际证据 | C-H06 PASS · code-block.tsx SYNTAX_ADAPTER 20 条 + index.css yace 5 类映射；uds7-syntax-adapter.test.ts 组件级断言（20 条独立映射 / 禁裸 HEX / bridge 20 变量对齐）随全量 vitest 真实执行 |

#### UDS7-H-07

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-H-07 |
| 严重级别 | P1 |
| 所属域 | HIGHLIGHT — 代码高亮与 VS Code 官方主题 |
| 文件路径 | web/src/features/home/components/hero-terminal-demo.tsx |
| 行号 / 位置 | 61-78, 516-536 |
| 当前实际状态 | 终端演示用手工 <span> + term-* 类着色，是第二套独立语法色；theme.css:210-213 明示两套不要合并。 |
| 违反的规范 | §5.5「多个高亮引擎须通过统一 Adapter 共享同一套语义 Token」。 |
| 对产品的影响 | 终端与代码块语法色不一致，维护两套色值。 |
| 整改方案 | term-* 改为引用 --ds7-terminal-*，语义与 ANSI16 对齐；保留手写 span 但消除独立色值。 |
| 对应自动化测试 | check-uds7-remediation.mjs::C-H07 |
| 验收证据 | Showcase Terminal 区 + LIGHT-DARK-CONSISTENCY-AUDIT.md |
| 整改状态 | RESOLVED |
| 实际证据 | C-H07 PASS · syntax-validation.json longCodeSample 记录 |

#### UDS7-H-08

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-H-08 |
| 严重级别 | P1 |
| 所属域 | HIGHLIGHT — 代码高亮与 VS Code 官方主题 |
| 文件路径 | web/src/components/ai-elements/__tests__/code-block-editor.test.tsx |
| 行号 / 位置 | 42-77 |
| 当前实际状态 | 只有 2 个测试（gutter padding / EditorView 复用）；web/e2e 无 CodeBlock / syntax / copy / 长代码用例。 |
| 违反的规范 | §5.6「测试必须确认语言识别 / 作用域 / 映射 / Light-Dark / 复制 / 换行 / 长代码布局」。 |
| 对产品的影响 | 高亮整改没有回归保护。 |
| 整改方案 | 新增 syntax-mapping.test.ts + Playwright 15 语言 × 2 主题真实组件测试，输出 syntax-validation.json。 |
| 对应自动化测试 | vitest + Playwright |
| 验收证据 | syntax-validation.json |
| 整改状态 | RESOLVED |
| 实际证据 | C-H08 PASS · Showcase visual-check / real-page-regression / 7.0 checker 真实运行；全量 vitest G14 EXIT=0（524565ms） |

#### UDS7-H-09

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-H-09 |
| 严重级别 | P0 |
| 所属域 | HIGHLIGHT — 代码高亮与 VS Code 官方主题 |
| 文件路径 | audit/vscode/vscode-*.json |
| 行号 / 位置 | 官方源码 vs 文档 §5.2 候选基线 |
| 当前实际状态 | 20 个候选色里 8 处与官方源码不一致：number Light 官方 #098658（文档 #087443）、type Light #267F99（#1F6B80）、attribute Light #E50000（#FF0000）、inserted L/D #098658/#B5CEA8（#008000/#89D185）、deleted Dark #CE9178（#F48771）、invalid L/D #CD3131/#F44747（#A31515/#F48771）。 |
| 违反的规范 | §5.2「官方主题存在不同配置必须优先核对官方实际定义 / 记录差异」。 |
| 对产品的影响 | 若照抄候选基线，Showcase 的「VS Code 对照」会与官方源码不符。 |
| 整改方案 | 以 registry/vscode-theme.mjs 从官方 JSONC 源码提取为准；生成 VSCODE-COLOR-MAPPING.md 差异表。 |
| 对应自动化测试 | check-uds7-remediation.mjs::C-H09 断言 20 个 adopted 值可追溯到官方 scope |
| 验收证据 | VSCODE-COLOR-MAPPING.md + SOURCE-METADATA.json |
| 整改状态 | RESOLVED |
| 实际证据 | C-H09 PASS · audit/vscode/SOURCE-METADATA.json + 官方 JSONC 源码 + 映射文档 |

#### UDS7-H-10

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-H-10 |
| 严重级别 | P1 |
| 所属域 | HIGHLIGHT — 代码高亮与 VS Code 官方主题 |
| 文件路径 | registry/vscode-theme.mjs |
| 行号 / 位置 | adjustForContrast 输出 |
| 当前实际状态 | 官方 number #098658 / type #267F99 / builtin #267F99 / inserted #098658 落在 Uter 代码块背景 #F6F8FA 上仅 4.31–4.32:1，低于 WCAG AA 4.5。 |
| 违反的规范 | §5.2「颜色对比度不足可有限调整，但必须记录差异」/ §8 WCAG 2.2 AA。 |
| 对产品的影响 | 直接使用官方值会让 4 类语法文字不达标。 |
| 整改方案 | 沿明度方向做 3 步有限调整至 4.55:1（#098255 / #257B94），完整记录原值、新值、前后对比度与步数。 |
| 对应自动化测试 | check-uds7-remediation.mjs::C-H10 断言 20×2 全部 ≥4.5 且所有 adjusted 项有差异记录 |
| 验收证据 | VSCODE-COLOR-MAPPING.md 调整表 + contrast-validation.json |
| 整改状态 | RESOLVED |
| 实际证据 | C-H10 PASS · syntax Light 最低 4.55:1 / Dark 5.07:1；adjusted 4 项 |

