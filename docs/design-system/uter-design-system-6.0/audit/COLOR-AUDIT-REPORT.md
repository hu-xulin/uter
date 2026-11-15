# COLOR-AUDIT-REPORT — 颜色体系完整审计

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
| 审计范围 | docs/design-system/uter-design-system-6.0/ · web/src/design-system/ · web/src/styles/ · web/src/components/ · web/src/features/ |

本报告回答：颜色体系是否完整、Light / Dark 是否一致、品牌基线真实值是什么、是否存在多套颜色来源与硬编码颜色。

## 1. 真实运行时权威结论

```text
AGENTS.md:176       → UDS 3.0 仍是唯一运行时强制标准
AGENTS.md:378-379   → The approved design system is the single source of truth
web/src/styles/index.css:49-60 → 只加载 3.0 Token 文件，6.0 runtime 零 import
6.0/TOKEN-MANIFEST.json:6     → status = IMPLEMENTED_NOT_VERIFIED

结论：6.0 的 254 个 Token 从未在真实页面生效；现有 17 项检查是「文档产物 ↔ manifest」闭环自证。
```

## 2. 并行颜色来源实测

| 前缀 / 来源 | 定义数 | 位置 |
|---|---|---|
| `--color-*` | 112 | `web/src/styles/theme.css:48-252` |
| 无前缀语义变量 | 大量 | `theme.css:341-595` |
| `--ds-*` | 175 | `design-system/tokens/{spacing,semantic,colors,elevation}.css` |
| `--primitive-*` | 47 | `design-system/tokens/primitives.css` |
| `--uter-brand-*` | 16 | `design-system/tokens/generated/brand.css:29-47` |
| `--text-*` | 76 | `design-system/tokens/typography.css` |
| `--clerk-*` | 0（运行时） | 仅测试禁项 |

## 3. 品牌基线核实（§4.2 要求修改前必须核实）

| 色值 | 文档声称的角色 | 运行时是否生效 | 真实位置 |
|---|---|---|---|
| `#5B5EE6` | Light Primary | 是 | `generated/brand.css:29` |
| `#494CC7` | Light Primary Hover | 否 | 仅 6.0 `runtime/tokens.css:53,57` |
| `#3F42B0` | Light Primary Active | 否 | 仅 6.0 `runtime/tokens.css:54,56` |
| `#8B8DF5` | Dark Primary | 否（仅注释/测试） | `theme-presets.css:442-443,667` |
| `#A1A3F7` | Dark Primary Hover | 是（作为 `--uter-brand-primary`） | `generated/brand.css:40` |
| `#B7B8FA` | Dark Primary Active | 否 | 仅 6.0 `themes/dark.css:38` |

**裁决**：全部 `KEEP`，不得按文档字面去「恢复」未生效的值；任何调整须走 `COLOR-OPTIMIZATION-REPORT.md` 的六项变更记录。

## 4. 问题明细

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

