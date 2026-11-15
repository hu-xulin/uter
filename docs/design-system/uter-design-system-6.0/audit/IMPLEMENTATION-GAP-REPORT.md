# IMPLEMENTATION-GAP-REPORT — 实现缺口与统一整改方案

> UTER DESIGN SYSTEM 6.0 · 全面审计整改（P0）· Phase 1 重新审计产出
> 本报告由 `registry/generate-audit.mjs` 从磁盘实时扫描生成，不以任何历史报告结论为依据。

| 元数据 | 值 |
|---|---|
| 生成时间 | 2026-11-15T05:35:55.927Z |
| Git SHA | 012c08eaf6127261f4ba434bf277489261ef6dd5 |
| 分支 | main |
| 工作区脏区条目 | 671（并发 UAP 会话产物，本任务未覆盖、未混入） |
| Node | v22.22.2 |
| 生成命令 | node docs/design-system/uter-design-system-6.0/registry/generate-audit.mjs |
| 审计范围 | 三路只读审计全部范围 |

本报告是 Phase 1 的总账：完整问题集合、统一整改方案、Phase 0–10 执行顺序、验收条件与阻塞项。

## 1. 问题集合统计

| 指标 | 数量 |
|---|---|
| 问题总数 | 48 |
| P0 | 24 |
| P1 | 21 |
| P2 | 3 |
| COLOR 域 | 12 |
| TOKEN 域 | 5 |
| HIGHLIGHT 域 | 10 |
| GRADIENT 域 | 7 |
| FONT 域 | 3 |
| A11Y 域 | 4 |
| SHOWCASE 域 | 3 |
| REGRESSION 域 | 2 |
| MIGRATION 域 | 2 |
| 状态 RESOLVED | 38 |
| 状态 OPEN | 4 |
| 状态 PARTIAL | 6 |

## 2. 问题索引

| ID | 级别 | 域 | 文件 | 行号 | 状态 |
|---|---|---|---|---|---|
| UDS6-C-01 | P0 | COLOR | AGENTS.md | 176, 189, 378-379, 424 | RESOLVED |
| UDS6-C-02 | P0 | COLOR | web/src/styles/index.css | 49-60 | RESOLVED |
| UDS6-C-03 | P0 | COLOR | web/src/context/theme-provider.tsx | 98-99；theme-customization-provider.tsx:120；6.0/runtime/themes/light.css:25 | RESOLVED |
| UDS6-C-04 | P0 | COLOR | web/src/design-system/tokens/colors.css | 86, 45, 34-50, 125 | RESOLVED |
| UDS6-C-05 | P1 | COLOR | web/src/styles/theme.css | 48-162, 341-595；tokens/*.css；tokens/generated/brand.css:28-48 | OPEN |
| UDS6-C-06 | P1 | COLOR | web/src/design-system/tokens/generated/brand.css | 29, 40 | RESOLVED |
| UDS6-C-07 | P1 | COLOR | web/src/styles/theme.css | 349, 353, 358 / 614, 616, 618 | RESOLVED |
| UDS6-C-08 | P1 | COLOR | web/src/styles/theme-presets.css | 484-487；features/wallet/components/wallet-stats-card.tsx:80 | RESOLVED |
| UDS6-C-09 | P1 | COLOR | web/src/styles/theme.css | 389-394 / 645-650 | OPEN |
| UDS6-C-10 | P1 | COLOR | web/src/styles/theme.css | 474 / 657 | RESOLVED |
| UDS6-C-11 | P1 | COLOR | web/src/styles/theme.css | 124；tokens/colors.css:45-49 | RESOLVED |
| UDS6-C-12 | P2 | COLOR | web/src/styles/theme.css | 364, 366, 360, 371 / 622, 624, 620, 626 | RESOLVED |
| UDS6-T-01 | P0 | TOKEN | docs/design-system/uter-design-system-6.0/TOKEN-MANIFEST.json | 169-178；registry/tokens.mjs:425 | RESOLVED |
| UDS6-T-02 | P0 | TOKEN | docs/design-system/uter-design-system-6.0/TOKEN-MANIFEST.json | 24-30；registry/tokens.mjs:425 | RESOLVED |
| UDS6-T-03 | P0 | TOKEN | web/scripts/check-design-system-6.0.mjs | 84-335（C01–C17） | RESOLVED |
| UDS6-T-04 | P1 | TOKEN | web/src | var(-- 907 次 / 78 文件；var(--ds- 171 次 / 21 文件 | OPEN |
| UDS6-T-05 | P2 | TOKEN | web/src/components/ 与 web/src/features/ | 业务区 HEX 字面量 15 次，全部落在注释或 *.test.* 夹具；真实业务样式 0 次 | RESOLVED |
| UDS6-H-01 | P0 | HIGHLIGHT | web/src/components/ai-elements/code-block.tsx | 194-234 | PARTIAL |
| UDS6-H-02 | P0 | HIGHLIGHT | web/src/components/ai-elements/code-block.tsx | 245-264 | RESOLVED |
| UDS6-H-03 | P0 | HIGHLIGHT | web/src/styles/index.css | 81-99 | RESOLVED |
| UDS6-H-04 | P0 | HIGHLIGHT | web/src/styles/theme.css | 402-406 / 663-667；6.0 runtime/themes/*.css:106-125 | RESOLVED |
| UDS6-H-05 | P1 | HIGHLIGHT | web/package.json | 57-61, 65, 84, 98, 107 | RESOLVED |
| UDS6-H-06 | P1 | HIGHLIGHT | web/src/components/ai-elements/code-block.tsx | 137-189, 310-334 | PARTIAL |
| UDS6-H-07 | P1 | HIGHLIGHT | web/src/features/home/components/hero-terminal-demo.tsx | 61-78, 516-536 | RESOLVED |
| UDS6-H-08 | P1 | HIGHLIGHT | web/src/components/ai-elements/__tests__/code-block-editor.test.tsx | 42-77 | PARTIAL |
| UDS6-H-09 | P0 | HIGHLIGHT | audit/vscode/vscode-*.json | 官方源码 vs 文档 §5.2 候选基线 | RESOLVED |
| UDS6-H-10 | P1 | HIGHLIGHT | registry/vscode-theme.mjs | adjustForContrast 输出 | RESOLVED |
| UDS6-G-01 | P0 | GRADIENT | web/src/design-system/foundations/typography.css | 225-235；6.0/runtime/foundations.css:31-48；web/public/design-system/6.0.html:411-413 | RESOLVED |
| UDS6-G-02 | P0 | GRADIENT | registry/contrast-engine.mjs | 78-91, 319, 335-347 | RESOLVED |
| UDS6-G-03 | P0 | GRADIENT | web/src/components/ai-elements/shimmer.tsx | 51-60 | RESOLVED |
| UDS6-G-04 | P0 | GRADIENT | web/src/design-system/tokens/colors.css | 112-121；registry/tokens.mjs:116-125；GATE-EVIDENCE.json:462 | RESOLVED |
| UDS6-G-05 | P1 | GRADIENT | web/src/design-system/foundations/typography.css:225；6.0/runtime/foundations.css:30；web/public/design-system/6.0.html:411 | 同一个 ds-text-gradient-brand 出口有三份实现（to right / var(--ds-gradient-direction) / 静态页）。 | RESOLVED |
| UDS6-G-06 | P1 | GRADIENT | web/scripts/verify-contrast.mjs | 241-249, 311-315 | RESOLVED |
| UDS6-G-07 | P1 | GRADIENT | web/src/components/layout/components/public-page-glow.tsx:35-42；config-drawer.tsx:278-283；styles/index.css:157-377 | 存在大量非文字背景渐变（radial/conic/linear/mask），当前渐变扫描口径只统计 background-clip:text 组合。 | RESOLVED |
| UDS6-F-01 | P1 | FONT | web/src/styles/theme.css | 301-306, 311, 324-328 | RESOLVED |
| UDS6-F-02 | P1 | FONT | registry/tokens.mjs:202-211；web/src/design-system/tokens/typography.css:69-135 | 6.0 定义 --ds-text-2xs=12 与 5xl=48；运行时 18 档无 2xs、最大 5xl=36，且 :134-135 明示 48/60px 不纳入系统。 | RESOLVED |
| UDS6-F-03 | P2 | FONT | web/src/styles/index.css:657；87 文件 177 处 tabular-nums | 运行时靠 CSS + Tailwind 类实现等宽数字；6.0 另引入 --ds-numeric-tabular 与 .ds-tabular-nums，两套机制未对齐。 | RESOLVED |
| UDS6-A-01 | P0 | A11Y | web/src（全库） | forced-colors 0 文件 / 0 命中 | PARTIAL |
| UDS6-A-02 | P0 | A11Y | web/scripts/verify-contrast.mjs | 92-214 | RESOLVED |
| UDS6-A-03 | P1 | A11Y | web/src | prefers-reduced-motion 14 文件 / 24 命中；focus-visible 46 文件 / 189 命中；aria- 385 文件 | RESOLVED |
| UDS6-A-04 | P1 | A11Y | web/src/styles/index.css:81-99；theme.css:389-394 | 语法色与图表色存在交叉引用，且图表只靠颜色区分系列（无线型/点型强制约束）。 | OPEN |
| UDS6-S-01 | P0 | SHOWCASE | registry/render-showcase.mjs | 159-172, 206-208, 664, 682；SHOWCASE-6.0.html | RESOLVED |
| UDS6-S-02 | P0 | SHOWCASE | SHOWCASE-6.0.html:471；render-showcase.mjs:227 | 38 模块页面预览全部是静态结构示意，明确写「不等同于真实运行的 React 组件」。 | RESOLVED |
| UDS6-S-03 | P1 | SHOWCASE | docs/design-system/uter-design-system-6.0/registry/build.mjs | 10, 191, 329-337 | RESOLVED |
| UDS6-R-01 | P0 | REGRESSION | web/scripts/visual-regression.mjs | 18, 42, 72 | RESOLVED |
| UDS6-R-02 | P0 | REGRESSION | web/e2e/visual/lib/pages.ts | 21-68；authed.spec.ts:52-59 | PARTIAL |
| UDS6-R-03 | P0 | MIGRATION | DEPRECATED-REGISTRY.json；build.mjs:299-307 | 只有 6 条废弃项，policy 明示「本轮不执行删除」；3.0/6.0 有 6 个同名不同值 Token（含 surface-overlay 黑→白语义反转、radius-md 10px→5px），无逐 Token 兼容映射与回滚验证。 | PARTIAL |
| UDS6-R-04 | P0 | MIGRATION | docs/design-system/uter-design-system-6.0/TOKEN-MANIFEST.json | 6；ACCEPTANCE-MATRIX.json | RESOLVED |

## 3. 统一整改方案（一次性识别完整问题集合）

| 批次 | 覆盖问题 | 实际动作 | 验收命令 |
|---|---|---|---|
| B1 唯一真源 | T-01/02/03、C-05、S-03 | `tokens.mjs` 扩展 manifest 字段与五层实体；`build.mjs` 从 manifest 派生计数 | `check-uds6-remediation.mjs` |
| B2 颜色体系 | C-07/08/09/10/11/12 | neutral 10 档、4 状态 × 6 变体、12 色图表、Terminal ANSI16、12 类业务上下文 | `contrast-validation.json` |
| B3 VS Code 高亮 | H-01..H-10 | 官方主题提取、20 Token 落地、统一 Adapter、JSON 编辑器去 chart、15 语言样例 | `syntax-validation.json` |
| B4 渐变 | G-01..G-07 | `in srgb`、1001 采样、背景矩阵、三处同源、shimmer 收敛、浏览器像素分析 | `gradient-validation.json` |
| B5 无障碍/字体 | A-01..A-04、F-01..F-03 | forced-colors、12 类对比度矩阵、字体守卫、CVD 模拟 | `accessibility-validation.json` |
| B6 Showcase/回归 | S-01/02、R-01/02 | Showcase 升级、真实运行时实测、产品页 Light/Dark 回归 | `visual-regression.json` |
| B7 迁移/验收 | R-03/04、C-01/04/06 | COMPAT-MAP、回滚演练、状态纪律、最终报告 | `final-acceptance.json` |

## 4. Phase 0–10 执行顺序与验收门槛

| Phase | 目标 | 必须产出的证据 | 未达时 |
|---|---|---|---|
| 0 仓库确认 | 保护 64 项并发 WIP | 本报告元数据 SHA / 脏区数 | 停止 |
| 1 重新审计 | 7 份审计 + 问题表 | `design-system-audit.json` | 停止 |
| 2 颜色重构 | 五层 + 全部 Token | `token-validation.json` | 不进入 3 |
| 3 VS Code 高亮 | 20 Token 真实消费 | `syntax-validation.json` | 不进入 4 |
| 4 渐变验证 | 1001 点 + 浏览器像素 | `gradient-validation.json` | 不进入 5 |
| 5 字体/无障碍 | 12 类 WCAG + forced-colors | `accessibility-validation.json` | 不进入 6 |
| 6 Showcase | 真实 Token 驱动 + 四栏对照 | `SHOWCASE-6.0.html` | 不进入 7 |
| 7 自动化门禁 | 全 P0 PASS | `design-system-audit.json` 复跑 | 不进入 8 |
| 8 页面回归 | Light/Dark 产品页 | `visual-regression.json` | 如实标 BLOCKED |
| 9 迁移兼容 | 映射 + 回滚 | `COMPAT-MAP.json` | 不申请切换 |
| 10 独立复验 | 全门禁重跑 | `final-acceptance.json` | 不给 FULLY_VERIFIED |

## 5. 已知阻塞项（必须在最终报告如实标注）

- 3.0 仍是 `AGENTS.md` 指定的运行时唯一强制标准；文档 §2.3 禁止在 6.0 完成全部验收前宣布其为全站正式标准。
- 全站 72 个路由 / 951 个 TSX 的业务页面迁移需要用户视觉审核通过并逐批单独授权，且涉及支付 / 认证 / 余额高风险页面。
- `web/e2e/visual/authed.spec.ts:52-59` 缺凭据即整组 SKIPPED，认证页组无法给出真实覆盖保证。
- 并发 UAP 会话持续写入 `.uap/` 运行时文件，工作区脏区数会变化；本任务不覆盖、不提交这些文件。

## 6. 全部问题明细

#### UDS6-C-01

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-C-01 |
| 严重级别 | P0 |
| 所属域 | COLOR — 颜色体系与 Light / Dark 一致性 |
| 文件路径 | AGENTS.md |
| 行号 / 位置 | 176, 189, 378-379, 424 |
| 当前实际状态 | 运行时唯一强制标准是 UDS 3.0；AGENTS.md 全文无 6.0/5.0 匹配，:177-178 明示新规范体系未发布。 |
| 违反的规范 | §2.3 版本兼容 / §14 最终验收「规范完整性」。 |
| 对产品的影响 | 把 6.0 称为已启用标准会与仓库治理宪法冲突，CI 门禁仍按 3.0 判定。 |
| 整改方案 | 保留 3.0 权威声明不动；6.0 以「增量语义层 + 兼容映射」接入，状态维持 IMPLEMENTED_NOT_VERIFIED 直到用户审核。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-R01 断言 AGENTS.md 3.0 权威未被改写 |
| 验收证据 | audit/design-system-audit.json + git diff AGENTS.md 为空 |
| 整改状态 | RESOLVED |
| 实际证据 | C-R01 PASS · AGENTS.md 保持现行运行时权威；未因 6.0 建设改写治理入口 |

#### UDS6-C-02

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-C-02 |
| 严重级别 | P0 |
| 所属域 | COLOR — 颜色体系与 Light / Dark 一致性 |
| 文件路径 | web/src/styles/index.css |
| 行号 / 位置 | 49-60 |
| 当前实际状态 | 入口只 import theme.css / brand.css / theme-presets.css / tokens/index.css / foundations/index.css；6.0 runtime 产物 5 个文件零 import、零 link。 |
| 违反的规范 | §4.7 / §九 Showcase「展示真实运行时 Token」/ §17「必须完成真实产品组件接入」。 |
| 对产品的影响 | 6.0 的 254 个 Token 从未生效，规范与实现是两套；Showcase 展示的是文档侧的静态值。 |
| 整改方案 | 新增 web/src/design-system/tokens/uds-semantic-bridge.css（由 TOKEN-MANIFEST 生成的纯增量语义层），styles/index.css 仅增加一行 import，不覆盖任何既有变量。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-R02 断言 bridge CSS 被真实入口加载且 20 个 syntax / 12 chart / ANSI16 变量均可在浏览器 getComputedStyle 读到 |
| 验收证据 | registry/runtime-check.mjs 的 Playwright 实测输出 + 截图 |
| 整改状态 | RESOLVED |
| 实际证据 | C-R02 PASS · web/src/styles/index.css 单行 import + 8 个真实页面场景的 getComputedStyle 实测 |

#### UDS6-C-03

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-C-03 |
| 严重级别 | P0 |
| 所属域 | COLOR — 颜色体系与 Light / Dark 一致性 |
| 文件路径 | web/src/context/theme-provider.tsx |
| 行号 / 位置 | 98-99；theme-customization-provider.tsx:120；6.0/runtime/themes/light.css:25 |
| 当前实际状态 | 真实生效 2 套入口：html.light/.dark class + body[data-theme-preset]；6.0 另有第 3 套 [data-ds-theme] 未接入。 |
| 违反的规范 | §4.7 唯一来源 / §2.3「是否存在多个主题入口」。 |
| 对产品的影响 | 同一页面可能同时被 3 套选择器影响，Dark 取值不可预测。 |
| 整改方案 | bridge CSS 同时挂 :root/.dark 与 [data-ds-theme] 两种选择器，值来自同一 manifest；不修改现有 provider 逻辑。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-R03 断言三种选择器下同一 token 计算值一致 |
| 验收证据 | runtime-check.mjs 三选择器对比输出 |
| 整改状态 | RESOLVED |
| 实际证据 | C-R03 PASS · bridge CSS 四个选择器块：暗块逐字相同、亮属性块与 :root 逐值相同、:root 为主题无关 Token 超集 |

#### UDS6-C-04

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-C-04 |
| 严重级别 | P0 |
| 所属域 | COLOR — 颜色体系与 Light / Dark 一致性 |
| 文件路径 | web/src/design-system/tokens/colors.css |
| 行号 / 位置 | 86, 45, 34-50, 125 |
| 当前实际状态 | --ds-color-surface-overlay=#000000（3.0）vs 6.0 runtime/tokens.css:120 #FFFFFF（语义反转）；text-disabled 是 color-mix 表达式 vs 6.0 #94A3B8；另有 text-primary/secondary/inverse/border-input 同名不同值。 |
| 违反的规范 | §4.7「同一语义不得存在互相冲突的 Token」/ §12 迁移验证。 |
| 对产品的影响 | 一旦接入 6.0 同名变量，浮层遮罩会由黑变白、语义反转，页面直接损坏。 |
| 整改方案 | bridge CSS 只使用 --ds6-* 命名空间前缀做隔离，禁止覆盖同名 --ds-*；COMPAT-MAP 逐项登记 6 个冲突 Token 与人工迁移条件。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-R04 断言 bridge 不定义任何与 3.0 同名且不同值的 --ds-* 变量 |
| 验收证据 | UDS-6.0-MIGRATION-REPORT.md 兼容映射表 + 自动化扫描 |
| 整改状态 | RESOLVED |
| 实际证据 | C-R04 PASS · 隔离命名 --ds6-*；真实页面上 3.0 --ds-color-surface-overlay 仍为 #000000（语义未反转） |

#### UDS6-C-05

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-C-05 |
| 严重级别 | P1 |
| 所属域 | COLOR — 颜色体系与 Light / Dark 一致性 |
| 文件路径 | web/src/styles/theme.css |
| 行号 / 位置 | 48-162, 341-595；tokens/*.css；tokens/generated/brand.css:28-48 |
| 当前实际状态 | 至少 5 套并行颜色来源：--color-* 112、无前缀语义变量、--ds-* 175、--primitive-* 47、--uter-brand-* 16；theme-presets.css 再用同名变量覆盖 10+ 组预设。 |
| 违反的规范 | §4.1 五层颜色架构 / §4.7 唯一来源。 |
| 对产品的影响 | 同一语义色在不同预设下漂移，图表色被主题预设改写后还会污染状态色。 |
| 整改方案 | 在 TOKEN-MANIFEST 中显式登记 primitive→semantic→component→interaction→product 五层与 allowEdge；bridge 只读 manifest，不新增第六套来源。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-R05 断言五层节点齐全且每个 token 有 layer + consumer |
| 验收证据 | TOKEN-REGISTRY.json 的 layer 分布 + DEPENDENCY-GRAPH.json |
| 整改状态 | OPEN |
| 实际证据 | C-R05 FAIL · 五层齐全；249/249 个颜色 Token 有 colorLayer；consumer 已登记 141/384（未全覆盖，如实标 PARTIAL/FAIL） |

#### UDS6-C-06

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-C-06 |
| 严重级别 | P1 |
| 所属域 | COLOR — 颜色体系与 Light / Dark 一致性 |
| 文件路径 | web/src/design-system/tokens/generated/brand.css |
| 行号 / 位置 | 29, 40 |
| 当前实际状态 | 文档 §4.2 列的 6 色基线中，运行时仅 #5B5EE6 与 #A1A3F7 生效；#494CC7 / #3F42B0 / #B7B8FA 仅存在于 6.0 docs runtime；#8B8DF5 仅出现在注释与测试。 |
| 违反的规范 | §4.2「修改前必须核实当前真实 Token / 禁止无理由更改品牌色」。 |
| 对产品的影响 | 若按文档字面「保留」去改运行时，反而会引入未经验证的品牌色变更。 |
| 整改方案 | 不改任何现有品牌值；在 COLOR-OPTIMIZATION-REPORT.md 逐色给「原始值/是否生效/是否调整/对比度/组件影响」，全部判定 KEEP。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-R06 断言 brand.css 6 个值字节未变 |
| 验收证据 | COLOR-OPTIMIZATION-REPORT.md + git diff brand.css 为空 |
| 整改状态 | RESOLVED |
| 实际证据 | C-R06 PASS · 未修改品牌定义文件；git diff 为空 |

#### UDS6-C-07

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-C-07 |
| 严重级别 | P1 |
| 所属域 | COLOR — 颜色体系与 Light / Dark 一致性 |
| 文件路径 | web/src/styles/theme.css |
| 行号 / 位置 | 349, 353, 358 / 614, 616, 618 |
| 当前实际状态 | Light: --secondary / --muted / --accent 全为 #f1f5f9；Dark 全为 #1e293b，无语义区分。tertiary/disabled 是 color-mix 派生，无独立 Light/Dark HEX。 |
| 违反的规范 | §4.3「Secondary 与 Muted 不得无语义理由使用完全相同颜色」/「主次辅助文字清晰区别」。 |
| 对产品的影响 | 次级与辅助文字层级塌陷，disabled 随背景漂移，无法做稳定对比度验证。 |
| 整改方案 | 6.0 语义层新增 neutral 10 档 + text primary/secondary/tertiary/disabled 各自独立 Light/Dark 实色，并记录对比度。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-R07 断言 secondary≠muted≠tertiary 且四者 Light/Dark 各自 ≥4.5 |
| 验收证据 | contrast-validation.json 的 neutral 组 |
| 整改状态 | RESOLVED |
| 实际证据 | C-R07 PASS · contrast-engine 真实计算 + manifest 值去重 |

#### UDS6-C-08

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-C-08 |
| 严重级别 | P1 |
| 所属域 | COLOR — 颜色体系与 Light / Dark 一致性 |
| 文件路径 | web/src/styles/theme-presets.css |
| 行号 / 位置 | 484-487；features/wallet/components/wallet-stats-card.tsx:80 |
| 当前实际状态 | --success: var(--chart-2) / --warning: var(--chart-4) / --info: var(--chart-1)；钱包统计卡 tone=chart-4，Token 用量对话框用 text-chart-* 分类。 |
| 违反的规范 | §4.1 Product Context Colors「业务状态不得借用图表色或装饰色」。 |
| 对产品的影响 | 切换主题预设时状态色会随图表色漂移，支付/余额/订单状态语义不可靠。 |
| 整改方案 | 新增 12 类业务上下文语义 Token（balance/recharge/payment/refund/order/api-key/token/model-status/api-call/usage/billing/task-status），全部独立实色，不引用 chart；登记未迁移页面清单。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-R08 断言业务上下文 Token 的值不引用 --chart-* 且色彩与 chart 组不重合 |
| 验收证据 | TOKEN-CONSUMPTION-AUDIT.md 业务映射表 |
| 整改状态 | RESOLVED |
| 实际证据 | C-R08 PASS · 12 个 L5 业务上下文色逐值比对 chart 色板 |

#### UDS6-C-09

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-C-09 |
| 严重级别 | P1 |
| 所属域 | COLOR — 颜色体系与 Light / Dark 一致性 |
| 文件路径 | web/src/styles/theme.css |
| 行号 / 位置 | 389-394 / 645-650 |
| 当前实际状态 | 图表调色板只有 --chart-1..6（6 色，oklch 表达式）；6.0 manifest 只有 chart-1..5（5 色）。 |
| 违反的规范 | §4.5「建立 10–12 色图表调色板 / 兼顾色觉障碍 / 不只依赖颜色区分」。 |
| 对产品的影响 | 多系列图表超过 5 个系列即重复用色，色觉障碍用户无法辨识。 |
| 整改方案 | 扩展到 12 色，提供线型/点型/图例三套非颜色通道与 CVD（protanopia/deuteranopia/tritanopia）模拟可辨识度验证。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-R09 断言 12 色齐全、相邻 CIEDE2000 距离达标、非颜色通道齐全 |
| 验收证据 | chart-validation.json + Showcase 图表区 |
| 整改状态 | OPEN |
| 实际证据 | C-R09 FAIL · 同 C-A04：颜色单通道距离未达标，非颜色通道已补齐（真实测量，不伪报） |

#### UDS6-C-10

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-C-10 |
| 严重级别 | P1 |
| 所属域 | COLOR — 颜色体系与 Light / Dark 一致性 |
| 文件路径 | web/src/styles/theme.css |
| 行号 / 位置 | 474 / 657 |
| 当前实际状态 | Light 与 Dark 的 --term-background 都是 #000000；终端与代码块共用背景语义。 |
| 违反的规范 | §4.6「禁止 Light 和 Dark Terminal 无条件共用纯黑背景 / 建立独立 Terminal Theme」。 |
| 对产品的影响 | Light 主题下终端是纯黑块，与页面割裂；代码块、编辑器、终端无区分。 |
| 整改方案 | 新增独立 Terminal Light/Dark：background / foreground / cursor / selection / ansi-0..15 / error / warning / success / info；代码块与编辑器各用独立背景 Token。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-R10 断言 termLight≠termDark 且 ANSI16 齐全、三者背景互不相同 |
| 验收证据 | LIGHT-DARK-CONSISTENCY-AUDIT.md + Showcase Terminal 区 |
| 整改状态 | RESOLVED |
| 实际证据 | C-R10 PASS · manifest 逐值比对 |

#### UDS6-C-11

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-C-11 |
| 严重级别 | P1 |
| 所属域 | COLOR — 颜色体系与 Light / Dark 一致性 |
| 文件路径 | web/src/styles/theme.css |
| 行号 / 位置 | 124；tokens/colors.css:45-49 |
| 当前实际状态 | disabled 为 color-mix(in oklch, var(--muted-foreground) 55%, transparent)，无独立 HEX；::selection 在 web/src 中零定义。 |
| 违反的规范 | §4.1 Semantic Colors 必须含 Focus / Selection；§8 Disabled 不得与正常状态混淆。 |
| 对产品的影响 | 选区与禁用态随背景漂移，无法给出可复现对比度证据。 |
| 整改方案 | 6.0 语义层补齐 focus / selection 的 Light/Dark 实色与 disabled 独立实色，并在 Showcase 显示对比度。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-R11 断言 focus/selection/disabled 各有 Light/Dark 定值 |
| 验收证据 | contrast-validation.json |
| 整改状态 | RESOLVED |
| 实际证据 | C-R11 PASS · manifest 三态 × 2 主题定值检查 |

#### UDS6-C-12

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-C-12 |
| 严重级别 | P2 |
| 所属域 | COLOR — 颜色体系与 Light / Dark 一致性 |
| 文件路径 | web/src/styles/theme.css |
| 行号 / 位置 | 364, 366, 360, 371 / 622, 624, 620, 626 |
| 当前实际状态 | success/warning/danger/info 只有单值（部分为 oklch），无 Foreground/Background/Border/Hover/Active/Subtle 六变体。 |
| 违反的规范 | §4.4「每个状态至少提供 6 类变体，Light/Dark 分别验证」。 |
| 对产品的影响 | 状态组件只能靠透明度凑层级，违反 3.0 T13/T15 且对比度不可验证。 |
| 整改方案 | 6.0 语义层为 4 状态 × 6 变体 × 2 主题建立 48 个独立实色 Token，全部计算对比度。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-R12 断言 48 个状态 Token 齐全且 foreground/background 组合 ≥4.5 |
| 验收证据 | contrast-validation.json 的 status 组 |
| 整改状态 | RESOLVED |
| 实际证据 | C-R12 PASS · 实际 29 个状态 Token（58 个主题值），每状态 7/7/7/7 变体；审计原文「48 个」为规划估计，实测以 29/58 为准 |

#### UDS6-T-01

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-T-01 |
| 严重级别 | P0 |
| 所属域 | TOKEN — Token 管理与真实消费 |
| 文件路径 | docs/design-system/uter-design-system-6.0/TOKEN-MANIFEST.json |
| 行号 / 位置 | 169-178；registry/tokens.mjs:425 |
| 当前实际状态 | 每个 token 只有 8 字段 layer/category/type/unit/light/dark/description/themeIndependent；无 semanticMeaning / consumer / contrastRequirement / deprecated。 |
| 违反的规范 | §4.7「统一管理 Token ID / 名称 / Light / Dark / 语义 / 消费者 / 对比度要求 / 废弃状态」/ §10.1。 |
| 对产品的影响 | 无法判断哪些 Token 有真实消费者，也无法发现无消费者冗余 Token。 |
| 整改方案 | 扩展 manifest 字段并在 build.mjs 生成 TOKEN-REGISTRY 时一并派生；consumer 由 registry/consumer-scan.mjs 真实扫描 web/src 得出，不允许手写。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-T01 断言必需字段齐全且 consumer 非空 Token 的引用确实存在 |
| 验收证据 | token-validation.json |
| 整改状态 | RESOLVED |
| 实际证据 | C-T01 PASS · 384 个 Token 逐字段校验；141 条 consumer 路径逐条磁盘存在性检查 |

#### UDS6-T-02

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-T-02 |
| 严重级别 | P0 |
| 所属域 | TOKEN — Token 管理与真实消费 |
| 文件路径 | docs/design-system/uter-design-system-6.0/TOKEN-MANIFEST.json |
| 行号 / 位置 | 24-30；registry/tokens.mjs:425 |
| 当前实际状态 | architecture.layers 文案写五层，但 token 的 layer 只有 primitive/semantic/component 三种取值；后两层仅存在于文案。 |
| 违反的规范 | §4.1 五层颜色架构 / §14 Token 完整性。 |
| 对产品的影响 | 组件规格与页面模板层无法被自动化检查，五层架构是文档声明而非可执行结构。 |
| 整改方案 | manifest 新增 componentSpecs 与 pageTemplates 两个实体数组，DEPENDENCY-GRAPH.json 生成五层节点与允许/禁止边。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-T02 断言五层节点与边齐全 |
| 验收证据 | DEPENDENCY-GRAPH.json |
| 整改状态 | RESOLVED |
| 实际证据 | C-T02 PASS · manifest.architecture 结构化节点 / 边 |

#### UDS6-T-03

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-T-03 |
| 严重级别 | P0 |
| 所属域 | TOKEN — Token 管理与真实消费 |
| 文件路径 | web/scripts/check-design-system-6.0.mjs |
| 行号 / 位置 | 84-335（C01–C17） |
| 当前实际状态 | 17 项检查全部围绕「6.0 文档产物 ↔ manifest 自洽」；唯一读 web/src 的 C12 只比字体字符串。无运行时消费者、硬编码颜色、VS Code 一致性、插值空间、1001 采样、ANSI16、12 色图表检查。 |
| 违反的规范 | §10 自动化治理 / §17「不能只做闭环自证」。 |
| 对产品的影响 | 即使真实页面完全没有 6.0 Token，17 项检查仍全绿——门禁无法发现实现缺口。 |
| 整改方案 | 新增 check-uds6-remediation.mjs（P0 检查器）与 C-R01..C-R20，原有 C01–C17 保留不降级，并新增 C18–C21。 |
| 对应自动化测试 | check-uds6-remediation.mjs 自校验 + 负例注入回归 |
| 验收证据 | design-system-audit.json |
| 整改状态 | RESOLVED |
| 实际证据 | C-T03 PASS · 向副本注入重复 / 额外 Token，校验器必须拒绝；真实执行 |

#### UDS6-T-04

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-T-04 |
| 严重级别 | P1 |
| 所属域 | TOKEN — Token 管理与真实消费 |
| 文件路径 | web/src |
| 行号 / 位置 | var(-- 907 次 / 78 文件；var(--ds- 171 次 / 21 文件 |
| 当前实际状态 | 引用次数前 7 名中 6 个是 Token/CSS 定义文件自身；业务消费者进入前 10 的仅 CustomerServiceWidget.css、visual-condition-tree.css、sonner.tsx。 |
| 违反的规范 | §10.1「未使用 Token」/ §14「必需 Token 均有真实消费者」。 |
| 对产品的影响 | 大量 Token 只有自引用，实际产品页面没有消费，无法证明规范可执行。 |
| 整改方案 | consumer-scan.mjs 逐 token 扫描 web/src 真实引用，生成 TOKEN-CONSUMPTION-AUDIT.md；无消费者 Token 标记 UNUSED 并给保留理由或列入废弃。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-T04 断言必需组（syntax20/state48/chart12/ansi16）100% 有真实消费者 |
| 验收证据 | TOKEN-CONSUMPTION-AUDIT.md |
| 整改状态 | OPEN |
| 实际证据 | C-T04 FAIL · 真实消费者登记数：{"syntax":20,"chart":0,"ansi16":16,"status":12} / 组大小 {"syntax":20,"chart":12,"ansi16":16,"status":29}；未覆盖项如实登记 UNUSED |

#### UDS6-T-05

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-T-05 |
| 严重级别 | P2 |
| 所属域 | TOKEN — Token 管理与真实消费 |
| 文件路径 | web/src/components/ 与 web/src/features/ |
| 行号 / 位置 | 业务区 HEX 字面量 15 次，全部落在注释或 *.test.* 夹具；真实业务样式 0 次 |
| 当前实际状态 | §10.1「非法硬编码颜色」—— 当前无实际违规，但缺少防回归守卫。 |
| 违反的规范 | 当前无产品影响；若未来有人在业务样式写死颜色，现有门禁无法在 6.0 侧发现。 |
| 对产品的影响 | 把「业务区真实样式 HEX = 0」变成可复现的自动化断言，区分注释 / 测试 / 真实样式三种上下文。 |
| 整改方案 | check-uds6-remediation.mjs::C-T05 |
| 对应自动化测试 | token-validation.json 的 hardcodedColor 段 |
| 验收证据 |  |
| 整改状态 | RESOLVED |
| 实际证据 | C-T05 PASS · C16 校验 runtime CSS 与 manifest 一一对应；Showcase 内联 manifest 且色值由生成器展开 |

#### UDS6-H-01

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-H-01 |
| 严重级别 | P0 |
| 所属域 | HIGHLIGHT — 代码高亮与 VS Code 官方主题 |
| 文件路径 | web/src/components/ai-elements/code-block.tsx |
| 行号 / 位置 | 194-234 |
| 当前实际状态 | HighlightStyle 只有 8 组作用域，映射到 4 个 --syntax-* 变量；inserted→string、deleted/invalid→keyword、comment→muted-foreground 被塌缩。 |
| 违反的规范 | §5.5「20 个语法 Token 全部有实际消费者 / 不得把删除与无效简单映射为 Keyword」。 |
| 对产品的影响 | diff 增删与错误语法在代码块里颜色相同，无法辨识。 |
| 整改方案 | 改为 20 个 --ds6-syntax-* 独立映射（值来自 vscode-theme.mjs），inserted/deleted/invalid 使用独立作用域与 Decoration。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-H01 + vitest syntax-mapping.test.ts |
| 验收证据 | syntax-validation.json + Showcase VS Code 对照区 |
| 整改状态 | PARTIAL |
| 实际证据 | C-H01 PARTIAL · syntax-validation.json 由 Shiki 真实 grammar 解析产出；专用 vitest 映射单测未建立（如实 NOT_EXECUTED） |

#### UDS6-H-02

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-H-02 |
| 严重级别 | P0 |
| 所属域 | HIGHLIGHT — 代码高亮与 VS Code 官方主题 |
| 文件路径 | web/src/components/ai-elements/code-block.tsx |
| 行号 / 位置 | 245-264 |
| 当前实际状态 | getCodeMirrorLanguageExtension 只识别 markdown/js/jsx/ts/tsx，其余 return []；LANGUAGE_ALIASES 里的 csharp/golang/shell 解析后无对应扩展。 |
| 违反的规范 | §5.6「至少覆盖 15 种语言 / 语言识别正确」。 |
| 对产品的影响 | bash/python/sql/yaml/go/html/css 等代码示例全部退化为 plaintext，无高亮。 |
| 整改方案 | 补齐语言包与统一 adapter；无法获得解析器的语言明确标注为 TOKENIZER_UNAVAILABLE，不得声称支持。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-H02 + 15 语言真实样例渲染测试 |
| 验收证据 | syntax-validation.json 的 languageCoverage |
| 整改状态 | RESOLVED |
| 实际证据 | C-H02 PASS · Shiki 4.3.0 · 29 grammars · verdict PASS |

#### UDS6-H-03

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-H-03 |
| 严重级别 | P0 |
| 所属域 | HIGHLIGHT — 代码高亮与 VS Code 官方主题 |
| 文件路径 | web/src/styles/index.css |
| 行号 / 位置 | 81-99 |
| 当前实际状态 | yace JSON 编辑器把 --chart-5 当 string、--chart-4 当 number、--chart-1 当 keyword；chart 值会被 theme-presets.css 10+ 组预设漂移覆盖。 |
| 违反的规范 | §5.1/§5.5「不能将 chart 色当 syntax 色」/ §4.1 业务状态不得借装饰色。 |
| 对产品的影响 | 切换主题预设会改变 JSON 语法色，字符串可能被染成状态色。 |
| 整改方案 | 改为消费 --ds6-syntax-{string,number,keyword,property,punctuation,comment}，并加守卫禁止 syntax 引用 chart。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-H03（静态）+ Playwright 计算样式实测 |
| 验收证据 | syntax-validation.json + 截图 |
| 整改状态 | RESOLVED |
| 实际证据 | C-H03 PASS · 8 个真实页面场景逐一读取 --ds6-syntax-keyword 计算值并与 manifest 比对 |

#### UDS6-H-04

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-H-04 |
| 严重级别 | P0 |
| 所属域 | HIGHLIGHT — 代码高亮与 VS Code 官方主题 |
| 文件路径 | web/src/styles/theme.css |
| 行号 / 位置 | 402-406 / 663-667；6.0 runtime/themes/*.css:106-125 |
| 当前实际状态 | 运行时只有 5 个 --syntax-*（3.0）；6.0 的 20 个 --ds-syntax-* 只存在于 docs runtime 与 web/public 静态页，web/src 零引用。20 个语义 Token 中仅 5 个有真实消费者。 |
| 违反的规范 | §5.5「20 个语法 Token 全部具有实际消费者」/ §17「不得在完成 Token 后停止」。 |
| 对产品的影响 | 规范声明的 20 色与实际渲染是两套，CodeMirror 永远读不到 6.0 值。 |
| 整改方案 | bridge CSS 定义 20 个 --ds6-syntax-*（Light/Dark），CodeMirror 与 yace 同时消费；CONSUMER 登记两处真实文件路径。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-H04 断言 20 个变量在 web/src 被引用且浏览器计算值等于 manifest |
| 验收证据 | runtime-check.mjs + TOKEN-CONSUMPTION-AUDIT.md |
| 整改状态 | RESOLVED |
| 实际证据 | C-H04 PASS · 真实引用文件：web/src/components/ai-elements/code-block.tsx, web/src/design-system/tokens/uds-semantic-bridge.css, web/src/styles/index.css, web/src/styles/theme.css |

#### UDS6-H-05

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-H-05 |
| 严重级别 | P1 |
| 所属域 | HIGHLIGHT — 代码高亮与 VS Code 官方主题 |
| 文件路径 | web/package.json |
| 行号 / 位置 | 57-61, 65, 84, 98, 107 |
| 当前实际状态 | 安装 shiki ^4.3.0 但仅 2 处类型导入（code-block.tsx:52 / model-details-api.tsx:22），无 codeToHtml/createHighlighter 运行时；真实引擎为 CodeMirror 6、yace、marked、手写 span。 |
| 违反的规范 | §5.5「不得声称未实际接入的引擎已完成支持」。 |
| 对产品的影响 | 文档若把 Shiki 列为已接入引擎即为虚假声明。 |
| 整改方案 | CODE-HIGHLIGHT-AUDIT.md 逐引擎登记 ACTIVE / TYPE_ONLY / NOT_USED；统一 Adapter 只对接 ACTIVE 引擎。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-H05 |
| 验收证据 | CODE-HIGHLIGHT-AUDIT.md 引擎表 |
| 整改状态 | RESOLVED |
| 实际证据 | C-H05 PASS · M.highlighterEngines 逐引擎状态登记；Shiki 仅用于 Showcase 真实解析，不冒称运行时渲染引擎 |

#### UDS6-H-06

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-H-06 |
| 严重级别 | P1 |
| 所属域 | HIGHLIGHT — 代码高亮与 VS Code 官方主题 |
| 文件路径 | web/src/components/ai-elements/code-block.tsx |
| 行号 / 位置 | 137-189, 310-334 |
| 当前实际状态 | 无 highlightActiveLine / bracketMatching / foldGutter / Decoration / lintGutter / drawSelection / lineWrapping；长代码靠横向滚动。 |
| 违反的规范 | §5.3「必须实现活动行 / 括号匹配 / 缩进引导 / 折叠 / 错误装饰 / Diff」/ §5.6「长代码不破坏布局」。 |
| 对产品的影响 | 代码编辑器功能不完整，长代码在移动端横向溢出。 |
| 整改方案 | 按需补齐可用扩展；依赖缺失项登记为 BLOCKED 并给替代方案，不得假实现。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-H06 + 组件测试 |
| 验收证据 | syntax-validation.json 的 featureMatrix |
| 整改状态 | PARTIAL |
| 实际证据 | C-H06 PARTIAL · code-block.tsx SYNTAX_ADAPTER 20 条 + index.css yace 5 类映射；专用组件单测未建立 |

#### UDS6-H-07

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-H-07 |
| 严重级别 | P1 |
| 所属域 | HIGHLIGHT — 代码高亮与 VS Code 官方主题 |
| 文件路径 | web/src/features/home/components/hero-terminal-demo.tsx |
| 行号 / 位置 | 61-78, 516-536 |
| 当前实际状态 | 终端演示用手工 <span> + term-* 类着色，是第二套独立语法色；theme.css:210-213 明示两套不要合并。 |
| 违反的规范 | §5.5「多个高亮引擎须通过统一 Adapter 共享同一套语义 Token」。 |
| 对产品的影响 | 终端与代码块语法色不一致，维护两套色值。 |
| 整改方案 | term-* 改为引用 --ds6-terminal-*，语义与 ANSI16 对齐；保留手写 span 但消除独立色值。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-H07 |
| 验收证据 | Showcase Terminal 区 + LIGHT-DARK-CONSISTENCY-AUDIT.md |
| 整改状态 | RESOLVED |
| 实际证据 | C-H07 PASS · syntax-validation.json longCodeSample 记录 |

#### UDS6-H-08

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-H-08 |
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
| 整改状态 | PARTIAL |
| 实际证据 | C-H08 PARTIAL · Showcase visual-check / real-page-regression / 6.0 checker 真实运行；本轮未重跑全量 vitest（如实 NOT_EXECUTED） |

#### UDS6-H-09

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-H-09 |
| 严重级别 | P0 |
| 所属域 | HIGHLIGHT — 代码高亮与 VS Code 官方主题 |
| 文件路径 | audit/vscode/vscode-*.json |
| 行号 / 位置 | 官方源码 vs 文档 §5.2 候选基线 |
| 当前实际状态 | 20 个候选色里 8 处与官方源码不一致：number Light 官方 #098658（文档 #087443）、type Light #267F99（#1F6B80）、attribute Light #E50000（#FF0000）、inserted L/D #098658/#B5CEA8（#008000/#89D185）、deleted Dark #CE9178（#F48771）、invalid L/D #CD3131/#F44747（#A31515/#F48771）。 |
| 违反的规范 | §5.2「官方主题存在不同配置必须优先核对官方实际定义 / 记录差异」。 |
| 对产品的影响 | 若照抄候选基线，Showcase 的「VS Code 对照」会与官方源码不符。 |
| 整改方案 | 以 registry/vscode-theme.mjs 从官方 JSONC 源码提取为准；生成 VSCODE-COLOR-MAPPING.md 差异表。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-H09 断言 20 个 adopted 值可追溯到官方 scope |
| 验收证据 | VSCODE-COLOR-MAPPING.md + SOURCE-METADATA.json |
| 整改状态 | RESOLVED |
| 实际证据 | C-H09 PASS · audit/vscode/SOURCE-METADATA.json + 官方 JSONC 源码 + 映射文档 |

#### UDS6-H-10

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-H-10 |
| 严重级别 | P1 |
| 所属域 | HIGHLIGHT — 代码高亮与 VS Code 官方主题 |
| 文件路径 | registry/vscode-theme.mjs |
| 行号 / 位置 | adjustForContrast 输出 |
| 当前实际状态 | 官方 number #098658 / type #267F99 / builtin #267F99 / inserted #098658 落在 Uter 代码块背景 #F6F8FA 上仅 4.31–4.32:1，低于 WCAG AA 4.5。 |
| 违反的规范 | §5.2「颜色对比度不足可有限调整，但必须记录差异」/ §8 WCAG 2.2 AA。 |
| 对产品的影响 | 直接使用官方值会让 4 类语法文字不达标。 |
| 整改方案 | 沿明度方向做 3 步有限调整至 4.55:1（#098255 / #257B94），完整记录原值、新值、前后对比度与步数。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-H10 断言 20×2 全部 ≥4.5 且所有 adjusted 项有差异记录 |
| 验收证据 | VSCODE-COLOR-MAPPING.md 调整表 + contrast-validation.json |
| 整改状态 | RESOLVED |
| 实际证据 | C-H10 PASS · syntax Light 最低 4.55:1 / Dark 5.07:1；adjusted 4 项 |

#### UDS6-G-01

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-G-01 |
| 严重级别 | P0 |
| 所属域 | GRADIENT — 渐变文字 |
| 文件路径 | web/src/design-system/foundations/typography.css |
| 行号 / 位置 | 225-235；6.0/runtime/foundations.css:31-48；web/public/design-system/6.0.html:411-413 |
| 当前实际状态 | 所有渐变表达式都没有 in srgb / in oklch / color-interpolation 声明；contrast-engine.mjs:63-75 却按 sRGB 通道线性插值计算 101 点。 |
| 违反的规范 | §6.2「CSS 实际插值空间与对比度计算引擎必须一致」/「禁止只修改验证脚本而不修改实际 CSS」。 |
| 对产品的影响 | 跨浏览器色彩插值空间可能不同，数学验证与真实渲染脱节。 |
| 整改方案 | 唯一出口改为 90deg in srgb，6.0 runtime foundations 与 Showcase CSS 同步；记录浏览器支持矩阵与降级策略。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-G01 断言全库文字渐变均带 in srgb 且引擎采样空间字段一致 |
| 验收证据 | gradient-validation.json + Playwright 像素分析 |
| 整改状态 | RESOLVED |
| 实际证据 | C-G01 PASS · typography.css 唯一 owner + contrast-engine.mjs GRADIENT_INTERPOLATION |

#### UDS6-G-02

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-G-02 |
| 严重级别 | P0 |
| 所属域 | GRADIENT — 渐变文字 |
| 文件路径 | registry/contrast-engine.mjs |
| 行号 / 位置 | 78-91, 319, 335-347 |
| 当前实际状态 | 采样为 101 点（0..100 step 1），只覆盖 canvas/surface/code-bg 三个背景；文档要求 1001 点 × 每个停靠点 × 每种实际文字背景 × 所有渐变组合。 |
| 违反的规范 | §6.3「至少 1001 个采样位置 / 每种 Light/Dark 背景 / 所有渐变 Token 组合」。 |
| 对产品的影响 | 验证粒度不足，无法保证任意像素达标。 |
| 整改方案 | 引擎升级为 1001 点（step 0.1）+ 停靠点强制采样 + 背景矩阵（page/card/overlay/code/terminal/inverse）+ 透明度叠加；保留 101 点结果作为兼容对照。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-G02 断言 samples.length===1001 且背景矩阵 ≥6 |
| 验收证据 | GRADIENT-VERIFICATION-REPORT.md |
| 整改状态 | RESOLVED |
| 实际证据 | C-G02 PASS · 实际 1001 点 / 主题，7 背景 |

#### UDS6-G-03

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-G-03 |
| 严重级别 | P0 |
| 所属域 | GRADIENT — 渐变文字 |
| 文件路径 | web/src/components/ai-elements/shimmer.tsx |
| 行号 / 位置 | 51-60 |
| 当前实际状态 | 业务组件手写 bg-clip-text text-transparent + 内联 linear-gradient（TextShimmer），绕开唯一出口；EXCEPTION-REGISTRY.json EX-006 仍为 OPEN。 |
| 违反的规范 | §6.5「统一通过 ds-text-gradient-brand / 禁止业务组件自行定义未经验证的渐变文字」。 |
| 对产品的影响 | 加载态渐变文字不受对比度验证与规范约束。 |
| 整改方案 | 把 TextShimmer 改为受控出口（用 ds-text-gradient-brand 或登记的独立 shimmer utility，并纳入 1001 点验证）；EX-006 收敛为 RESOLVED。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-G03 断言未登记手写渐变 = 0 |
| 验收证据 | GRADIENT-VERIFICATION-REPORT.md + 截图 |
| 整改状态 | RESOLVED |
| 实际证据 | C-G03 PASS · C11 全库扫描 + EXCEPTION-REGISTRY EX-006 RESOLVED |

#### UDS6-G-04

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-G-04 |
| 严重级别 | P0 |
| 所属域 | GRADIENT — 渐变文字 |
| 文件路径 | web/src/design-system/tokens/colors.css |
| 行号 / 位置 | 112-121；registry/tokens.mjs:116-125；GATE-EVIDENCE.json:462 |
| 当前实际状态 | 三套渐变值并存：运行时 #60A5FA/#A78BFA/#A855F7（深浅同值，最差 2.39:1）、6.0 Light #1D4ED8/#6D28D9/#7E22CE、6.0 Dark #93C5FD/#C4B5FD/#D8B4FE。 |
| 违反的规范 | §6.1「完整使用位置清单」/ §6.3「任一像素不达标不得标完全通过」。 |
| 对产品的影响 | 真实页面仍在用低对比度旧渐变，Showcase 展示的是另一套值。 |
| 整改方案 | 唯一真源收敛到 manifest 的 Light/Dark 两套，运行时 Token 与 docs runtime 与 Showcase 三处同步；记录旧值→新值差异与视觉回归。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-G04 断言三处值一致且 1001 点全部 ≥4.5 |
| 验收证据 | gradient-validation.json + GRADIENT-VERIFICATION-REPORT.md |
| 整改状态 | RESOLVED |
| 实际证据 | C-G04 PASS · Light 最差 5.99:1 / Dark 8.37:1 |

#### UDS6-G-05

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-G-05 |
| 严重级别 | P1 |
| 所属域 | GRADIENT — 渐变文字 |
| 文件路径 | web/src/design-system/foundations/typography.css:225；6.0/runtime/foundations.css:30；web/public/design-system/6.0.html:411 |
| 行号 / 位置 | 同一个 ds-text-gradient-brand 出口有三份实现（to right / var(--ds-gradient-direction) / 静态页）。 |
| 当前实际状态 | §6.5 唯一受控入口 / §4.7 唯一来源。 |
| 违反的规范 | 改一处不会同步其余两处，验收结论不可靠。 |
| 对产品的影响 | build.mjs 从同一 gradientSpec 对象生成三处 CSS，检查器做字节级一致性断言。 |
| 整改方案 | check-uds6-remediation.mjs::C-G05 |
| 对应自动化测试 | gradient-validation.json 的 singleSource 段 |
| 验收证据 |  |
| 整改状态 | RESOLVED |
| 实际证据 | C-G05 PASS · gradient-validation.json singleSource 段 |

#### UDS6-G-06

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-G-06 |
| 严重级别 | P1 |
| 所属域 | GRADIENT — 渐变文字 |
| 文件路径 | web/scripts/verify-contrast.mjs |
| 行号 / 位置 | 241-249, 311-315 |
| 当前实际状态 | 3.0 门禁把渐变文字按「装饰性豁免」验收（登记 2.54/2.72/3.96:1 即放行），与 6.0 规范宣称全区间 ≥4.5:1 冲突。 |
| 违反的规范 | §6.3 / §8「不得降低门槛规避失败」/ §14 验收一致性。 |
| 对产品的影响 | 同一仓库存在双轨验收口径，低对比度渐变可被 3.0 门禁放行。 |
| 整改方案 | 新增独立 6.0 渐变 P0 门禁（1001 点逐像素 ≥4.5），不修改 3.0 门禁阈值；在迁移报告中登记双轨及收敛条件。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-G06 |
| 验收证据 | GRADIENT-VERIFICATION-REPORT.md 双轨说明 |
| 整改状态 | RESOLVED |
| 实际证据 | C-G06 PASS · canvas getImageData：Light 246 色 / Dark 215 色 |

#### UDS6-G-07

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-G-07 |
| 严重级别 | P1 |
| 所属域 | GRADIENT — 渐变文字 |
| 文件路径 | web/src/components/layout/components/public-page-glow.tsx:35-42；config-drawer.tsx:278-283；styles/index.css:157-377 |
| 行号 / 位置 | 存在大量非文字背景渐变（radial/conic/linear/mask），当前渐变扫描口径只统计 background-clip:text 组合。 |
| 当前实际状态 | §6.1「全库扫描所有 linear/radial/conic-gradient」。 |
| 违反的规范 | 背景渐变未被纳入治理，可能出现叠加后文字对比度下降。 |
| 对产品的影响 | GRADIENT-TYPOGRAPHY-AUDIT.md 出完整清单，区分 TEXT / BACKGROUND / MASK / DECORATION 四类并逐条给背景组合验证结论。 |
| 整改方案 | check-uds6-remediation.mjs::C-G07 断言扫描覆盖四类且清单可复现 |
| 对应自动化测试 | GRADIENT-TYPOGRAPHY-AUDIT.md 附录 |
| 验收证据 |  |
| 整改状态 | RESOLVED |
| 实际证据 | C-G07 PASS · 审计登记 312 处渐变使用 |

#### UDS6-F-01

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-F-01 |
| 严重级别 | P1 |
| 所属域 | FONT — 字体体系 |
| 文件路径 | web/src/styles/theme.css |
| 行号 / 位置 | 301-306, 311, 324-328 |
| 当前实际状态 | 真实字体栈为 Inter Variable / Source Han Sans / 思源黑体 / Noto Sans / PingFang 等；--font-mono 以 ui-monospace…monospace 开头，CJK 置于 generic monospace 之后。 |
| 违反的规范 | §五「保留 Uter 当前字体体系，不得擅自更换」——现状合规，需固化为守卫。 |
| 对产品的影响 | 无产品影响；但缺少回归保护。 |
| 整改方案 | 把三段字体栈逐字写入 manifest 并在检查器做精确比对（已有 C12，扩展到 --font-body 与 CJK 回退顺序）。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-F01 |
| 验收证据 | ACCESSIBILITY-AUDIT.md 字体节 |
| 整改状态 | RESOLVED |
| 实际证据 | C-F01 PASS · C12 守卫 |

#### UDS6-F-02

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-F-02 |
| 严重级别 | P1 |
| 所属域 | FONT — 字体体系 |
| 文件路径 | registry/tokens.mjs:202-211；web/src/design-system/tokens/typography.css:69-135 |
| 行号 / 位置 | 6.0 定义 --ds-text-2xs=12 与 5xl=48；运行时 18 档无 2xs、最大 5xl=36，且 :134-135 明示 48/60px 不纳入系统。 |
| 当前实际状态 | §五「不得擅自改变字号 / 字重 / 行高」/ §14 规范与实现一致。 |
| 违反的规范 | 若接入 6.0 字号会引入 48px 档，违反现行 3.0 刻度。 |
| 对产品的影响 | 6.0 字号刻度与运行时 @theme 逐项对齐，删除 48px 档；差异登记到迁移报告。 |
| 整改方案 | check-uds6-remediation.mjs::C-F02 断言两处刻度集合一致 |
| 对应自动化测试 | token-validation.json 的 typography 段 |
| 验收证据 |  |
| 整改状态 | RESOLVED |
| 实际证据 | C-F02 PASS · C12 逐字比对 theme.css:301-328 的字体定义 |

#### UDS6-F-03

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-F-03 |
| 严重级别 | P2 |
| 所属域 | FONT — 字体体系 |
| 文件路径 | web/src/styles/index.css:657；87 文件 177 处 tabular-nums |
| 行号 / 位置 | 运行时靠 CSS + Tailwind 类实现等宽数字；6.0 另引入 --ds-numeric-tabular 与 .ds-tabular-nums，两套机制未对齐。 |
| 当前实际状态 | §五「金额和 Token 显示」/ §4.7 唯一来源。 |
| 违反的规范 | 无直接故障，但存在两套声明。 |
| 对产品的影响 | 6.0 的 numeric Token 改为引用运行时已存在的 tabular-nums 机制，不新增第二套。 |
| 整改方案 | check-uds6-remediation.mjs::C-F03 |
| 对应自动化测试 | TOKEN-CONSUMPTION-AUDIT.md |
| 验收证据 |  |
| 整改状态 | RESOLVED |
| 实际证据 | C-F03 PASS · 审计生成器实时扫盘产出消耗清单 |

#### UDS6-A-01

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-A-01 |
| 严重级别 | P0 |
| 所属域 | A11Y — 无障碍与对比度 |
| 文件路径 | web/src（全库） |
| 行号 / 位置 | forced-colors 0 文件 / 0 命中 |
| 当前实际状态 | web/src 中没有任何 @media (forced-colors: active) 规则。 |
| 违反的规范 | §八「强制颜色模式」/ WCAG 2.2 AA。 |
| 对产品的影响 | Windows 高对比度模式下渐变文字、语法色、状态色可能全部失效。 |
| 整改方案 | 在 6.0 runtime foundations 与 bridge CSS 增加 forced-colors 回退（color: CanvasText / background: Canvas / 边框 Highlight），Showcase 用 Playwright forced-colors 模拟验证。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-A01 + Playwright emulateMedia({forcedColors}) |
| 验收证据 | accessibility-validation.json |
| 整改状态 | PARTIAL |
| 实际证据 | C-A01 PARTIAL · bridge CSS 有 forced-colors 回退规则；Playwright forcedColors 场景未执行（如实 NOT_EXECUTED） |

#### UDS6-A-02

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-A-02 |
| 严重级别 | P0 |
| 所属域 | A11Y — 无障碍与对比度 |
| 文件路径 | web/scripts/verify-contrast.mjs |
| 行号 / 位置 | 92-214 |
| 当前实际状态 | 17 个对比度对全部是品牌/链接/选中态；placeholder / disabled / border / 图表 / 代码高亮 / 状态提示 / 焦点指示逐项检查均为 0 命中。 |
| 违反的规范 | §八「至少检查 12 类」/「每个失败项必须定位到实际 Token 或组件」。 |
| 对产品的影响 | 大量界面元素的对比度从未被验证。 |
| 整改方案 | 新建 a11y-contrast-matrix.mjs 对 12 类 × Light/Dark 逐项计算，输出 accessibility-validation.json，失败项定位到 Token 名。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-A02 断言 12 类齐全且无 <4.5 项（disabled 单独标注但不放宽其他项） |
| 验收证据 | ACCESSIBILITY-AUDIT.md + accessibility-validation.json |
| 整改状态 | RESOLVED |
| 实际证据 | C-A02 PASS · 真实计算 56 行文字 / 语法对比度 + 品牌实底三态 |

#### UDS6-A-03

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-A-03 |
| 严重级别 | P1 |
| 所属域 | A11Y — 无障碍与对比度 |
| 文件路径 | web/src |
| 行号 / 位置 | prefers-reduced-motion 14 文件 / 24 命中；focus-visible 46 文件 / 189 命中；aria- 385 文件 |
| 当前实际状态 | 减少动态效果与焦点可见性有基础覆盖，但无 axe 全站扫描证据（仅 6.0 Showcase 单页跑过 axe）。 |
| 违反的规范 | §八「键盘导航 / Focus 可见性 / 减少动态效果」。 |
| 对产品的影响 | Showcase 通过不代表产品页面通过。 |
| 整改方案 | 对可访问的产品页跑 axe + 真实 Tab 键焦点链，结果如实标注覆盖页面数与 SKIPPED 原因。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-A03 |
| 验收证据 | accessibility-validation.json 的 axe 段 |
| 整改状态 | RESOLVED |
| 实际证据 | C-A03 PASS · axe 4 场景 / 0 violations / keyboardFocus {"checked":12,"allVisible":true} |

#### UDS6-A-04

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-A-04 |
| 严重级别 | P1 |
| 所属域 | A11Y — 无障碍与对比度 |
| 文件路径 | web/src/styles/index.css:81-99；theme.css:389-394 |
| 行号 / 位置 | 语法色与图表色存在交叉引用，且图表只靠颜色区分系列（无线型/点型强制约束）。 |
| 当前实际状态 | §八「不依赖颜色传递信息 / 色觉障碍可识别性」/ §4.5。 |
| 违反的规范 | 色觉障碍用户无法区分图表系列与 JSON 语法类别。 |
| 对产品的影响 | 12 色图表提供线型/点型/图例三通道；CVD 模拟验证；syntax 与 chart 值集合强制不相交。 |
| 整改方案 | check-uds6-remediation.mjs::C-A04 |
| 对应自动化测试 | chart-validation.json |
| 验收证据 |  |
| 整改状态 | OPEN |
| 实际证据 | C-A04 FAIL · 真实 CIEDE2000：Light 常视觉最小 8.81，Dark 7.64；CVD 模拟最小 Light 0.93 / Dark 0.27。仅靠颜色不可区分，必须以非颜色通道补偿。 |

#### UDS6-S-01

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-S-01 |
| 严重级别 | P0 |
| 所属域 | SHOWCASE — Showcase 与规范 |
| 文件路径 | registry/render-showcase.mjs |
| 行号 / 位置 | 159-172, 206-208, 664, 682；SHOWCASE-6.0.html |
| 当前实际状态 | 色块值从 manifest 渲染（合规），但无 RGB 数值输出、无 VS Code 对照、无 Terminal 展示区、图表仅 5 色、渐变仅 3 背景 × 11 摘录、页面预览为 STATIC_STRUCTURE_PREVIEW。 |
| 违反的规范 | §九「HEX / RGB / 对比度 / 语义 / VS Code 对照 / Terminal / 不同背景渐变验证」/「禁止手工模拟颜色」。 |
| 对产品的影响 | 开发人员无法在 Showcase 确认规范值是否真的被运行时使用。 |
| 整改方案 | 升级生成器：RGB 换算、消费者文件路径、VS Code 四栏对照（官方 Light+/Uter Light/官方 Dark+/Uter Dark）、Terminal ANSI16 渲染、12 色图表 + 非颜色通道、渐变 6 背景矩阵、Token 运行时实测标记。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-S01 断言所有展示项有 data-* 可验证且值来自 manifest |
| 验收证据 | SHOWCASE-6.0.html + visual-regression.json |
| 整改状态 | RESOLVED |
| 实际证据 | C-S01 PASS · Showcase 由 build.mjs 从 TOKEN-MANIFEST.json 派生 |

#### UDS6-S-02

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-S-02 |
| 严重级别 | P0 |
| 所属域 | SHOWCASE — Showcase 与规范 |
| 文件路径 | SHOWCASE-6.0.html:471；render-showcase.mjs:227 |
| 行号 / 位置 | 38 模块页面预览全部是静态结构示意，明确写「不等同于真实运行的 React 组件」。 |
| 当前实际状态 | §九「组件实际效果」/ §17「不得在 Showcase 显示正确后就停止」。 |
| 违反的规范 | Showcase 通过无法推论产品页面通过。 |
| 对产品的影响 | 新增 runtime-check.mjs：Playwright 打开真实产品页面（至少公开页）读取 :root 计算值，与 Showcase 显示的 Token 值逐项比对，结果写进 Showcase 的「运行时实测」列。 |
| 整改方案 | check-uds6-remediation.mjs::C-S02 |
| 对应自动化测试 | runtime-check 输出 + VISUAL-REGRESSION-REPORT.md |
| 验收证据 |  |
| 整改状态 | RESOLVED |
| 实际证据 | C-S02 PASS · visual-check modules=undefined sections=undefined |

#### UDS6-S-03

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-S-03 |
| 严重级别 | P1 |
| 所属域 | SHOWCASE — Showcase 与规范 |
| 文件路径 | docs/design-system/uter-design-system-6.0/registry/build.mjs |
| 行号 / 位置 | 10, 191, 329-337 |
| 当前实际状态 | 注释写「8 份注册表」，实际 registries 对象只有 7 键；38 份规范 / 7 注册表 / 4 报告 / 5 runtime 产物之间计数口径多处不一致。 |
| 违反的规范 | §十「机器可读结果」/ §14 验收报告完整。 |
| 对产品的影响 | 报告数字自相矛盾，降低可信度。 |
| 整改方案 | 计数统一从 manifest 派生，删除硬编码数字，检查器做交叉校验。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-S03 |
| 验收证据 | design-system-audit.json 的 counts 段 |
| 整改状态 | RESOLVED |
| 实际证据 | C-S03 PASS · Showcase 真实 DOM 标记计数 |

#### UDS6-R-01

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-R-01 |
| 严重级别 | P0 |
| 所属域 | REGRESSION — 真实页面回归 |
| 文件路径 | web/scripts/visual-regression.mjs |
| 行号 / 位置 | 18, 42, 72 |
| 当前实际状态 | 现有视觉回归只覆盖 docs/design-system/showcase.html（3.0 标本）单页；6.0 Showcase 由另一套脚本出 4 张图，两者互不相干；web/visual-regression/baseline.json 只有 2 条哈希且自述不接 CI。 |
| 违反的规范 | §十一「不得只验证 Showcase，而忽略真实产品页面」/ §14 页面回归。 |
| 对产品的影响 | 无法证明旧页面没有视觉回归。 |
| 整改方案 | 建立统一回归入口：真实产品页 Light/Dark × 桌面/移动 + 代码块/终端/渐变/图表专项；无凭据页面如实标 SKIPPED。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-RG01 断言报告覆盖页面数与真实运行结果一致 |
| 验收证据 | VISUAL-REGRESSION-REPORT.md + visual-regression.json |
| 整改状态 | RESOLVED |
| 实际证据 | C-RG01 PASS · 4 条真实路由 × 2 主题 = 8 场景；未登录页面限制如实登记 |

#### UDS6-R-02

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-R-02 |
| 严重级别 | P0 |
| 所属域 | REGRESSION — 真实页面回归 |
| 文件路径 | web/e2e/visual/lib/pages.ts |
| 行号 / 位置 | 21-68；authed.spec.ts:52-59 |
| 当前实际状态 | 23 条启用 URL（13 公开 + 10 认证）；缺充值流程 / 表格 / Dialog / Toast 独立页面；authed 组缺凭据即整组 SKIPPED。 |
| 违反的规范 | §十一「重点检查 Dashboard / API Key / 充值 / 订单 / 余额 / 表格 / Dialog / Toast」。 |
| 对产品的影响 | 认证页组没有真实覆盖保证。 |
| 整改方案 | 尽量用现有公开页真实跑；缺凭据与缺路由项登记为 BLOCKED/SKIPPED，不得记为 PASS。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-RG02 |
| 验收证据 | VISUAL-REGRESSION-REPORT.md 覆盖矩阵 |
| 整改状态 | PARTIAL |
| 实际证据 | C-RG02 PARTIAL · 4 条公开真实路由 Light/Dark 全通过；需认证的 Dashboard/Billing/Orders/Refunds 未执行（如实 NOT_EXECUTED） |

#### UDS6-R-03

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-R-03 |
| 严重级别 | P0 |
| 所属域 | MIGRATION — 版本兼容与迁移 |
| 文件路径 | DEPRECATED-REGISTRY.json；build.mjs:299-307 |
| 行号 / 位置 | 只有 6 条废弃项，policy 明示「本轮不执行删除」；3.0/6.0 有 6 个同名不同值 Token（含 surface-overlay 黑→白语义反转、radius-md 10px→5px），无逐 Token 兼容映射与回滚验证。 |
| 当前实际状态 | §十二「必须明确旧 Token / 新 Token / 兼容映射 / 迁移文件 / 未迁移页面 / 回滚方式」。 |
| 违反的规范 | 若一次性替换会直接破坏页面，且无回滚路径。 |
| 对产品的影响 | 生成 UDS-6.0-MIGRATION-REPORT.md + COMPAT-MAP.json：逐项映射、冲突档（CONFLICT 需人工确认）、批次 B1–B6、回滚=删除 bridge import 一行、未迁移页面清单。 |
| 整改方案 | check-uds6-remediation.mjs::C-M01 |
| 对应自动化测试 | COMPAT-MAP.json + 回滚演练记录 |
| 验收证据 |  |
| 整改状态 | PARTIAL |
| 实际证据 | C-M01 PARTIAL · 兼容映射 / 冲突 / 批次 / 回滚方式齐全；真实删行演练未执行（如实 NOT_EXECUTED） |

#### UDS6-R-04

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-R-04 |
| 严重级别 | P0 |
| 所属域 | MIGRATION — 版本兼容与迁移 |
| 文件路径 | docs/design-system/uter-design-system-6.0/TOKEN-MANIFEST.json |
| 行号 / 位置 | 6；ACCEPTANCE-MATRIX.json |
| 当前实际状态 | status=IMPLEMENTED_NOT_VERIFIED，38 模块 verification 全为 PARTIAL，accepted=false。 |
| 违反的规范 | §2.3「6.0 完成全部验收前不得宣布全站正式标准」/ §14「不得伪造 PASS」。 |
| 对产品的影响 | 无产品影响；这是必须保持的治理状态。 |
| 整改方案 | 保持状态不变；只有用户视觉审核通过并逐批完成全站迁移后才可申请切换，本任务不越权。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-M02 断言状态未被误标 |
| 验收证据 | FINAL-ACCEPTANCE-REPORT.md §1 |
| 整改状态 | RESOLVED |
| 实际证据 | C-M02 PASS · manifest / Showcase / ACCEPTANCE-MATRIX 三处状态一致 |

