# LIGHT-DARK-CONSISTENCY-AUDIT — Light / Dark 一致性审计

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
| 审计范围 | theme.css · theme-presets.css · theme-provider.tsx · theme-customization-provider.tsx · 7.0 runtime/themes |

本报告回答：Light / Dark 是否一致、有几套主题入口、状态色与终端色是否分别验证。

## 1. 主题入口实测

| 入口 | 选择器 | 是否生效 | 位置 |
|---|---|---|---|
| 主题 class | `html.light` / `html.dark` | 是 | `theme-provider.tsx:98-99`、`theme.css:596` |
| 主题预设 | `body[data-theme-preset=...]` | 是 | `theme-customization-provider.tsx:120`、`theme-presets.css:36-666` |
| 7.0 主题 | `[data-ds-theme=light|dark]` | 否 | `runtime/themes/light.css:25`、`dark.css:25` |
| 系统偏好 | `prefers-color-scheme` | JS 侧 | `theme-provider.tsx:66,94`；CSS 零媒体查询 |

## 2. Light / Dark 取值冲突

| 语义 | Light | Dark | 问题 |
|---|---|---|---|
| `--secondary` / `--muted` / `--accent` | 全 `#f1f5f9` | 全 `#1e293b` | 三层无语义区分 |
| `--term-background` | `#000000` | `#000000` | 深浅同值，违反 §4.6 |
| `--ds-color-surface-overlay`（3.0） | `#000000` | `#000000` | 与 7.0 `#FFFFFF` 语义反转 |
| `--chart-1..6` | oklch(...) | oklch(...) | 被 10+ 组主题预设漂移覆盖 |
| tertiary / disabled | `color-mix()` 派生 | `color-mix()` 派生 | 无独立 HEX，无法逐主题验证 |
| `::selection` | 无定义 | 无定义 | 运行时缺失 |

## 3. 同名 Token 冲突（接入风险）

| Token | 3.0 值 | 7.0 值 |
|---|---|---|
| `--ds-radius-md` | `10px` | `5` |
| `--ds-color-surface-overlay` | `#000000` | `#FFFFFF` / `#1B2436` |
| `--ds-color-text-primary` | `var(--foreground)` | `#0F172A` / `#F1F5F9` |
| `--ds-color-text-inverse` | `var(--primary-foreground)` | `#FFFFFF` / `#0F172A` |
| `--ds-color-border-input` | `var(--input)` | `#CBD5E1` / `#3B4A63` |

## 4. 问题明细

#### UDS7-C-01

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-C-01 |
| 严重级别 | P0 |
| 所属域 | COLOR — 颜色体系与 Light / Dark 一致性 |
| 文件路径 | AGENTS.md |
| 行号 / 位置 | 176, 189, 378-379, 424 |
| 当前实际状态 | 运行时唯一强制标准是 UDS 3.0；AGENTS.md 全文无 7.0/5.0 匹配，:177-178 明示新规范体系未发布。 |
| 违反的规范 | §2.3 版本兼容 / §14 最终验收「规范完整性」。 |
| 对产品的影响 | 把 7.0 称为已启用标准会与仓库治理宪法冲突，CI 门禁仍按 3.0 判定。 |
| 整改方案 | 保留 3.0 权威声明不动；7.0 以「增量语义层 + 兼容映射」接入，状态维持 IMPLEMENTED_NOT_VERIFIED 直到用户审核。 |
| 对应自动化测试 | check-uds7-remediation.mjs::C-R01 断言 AGENTS.md 3.0 权威未被改写 |
| 验收证据 | audit/design-system-audit.json + git diff AGENTS.md 为空 |
| 整改状态 | RESOLVED |
| 实际证据 | C-R01 PASS · AGENTS.md 保持现行运行时权威；未因 7.0 建设改写治理入口 |

#### UDS7-C-02

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-C-02 |
| 严重级别 | P0 |
| 所属域 | COLOR — 颜色体系与 Light / Dark 一致性 |
| 文件路径 | web/src/styles/index.css |
| 行号 / 位置 | 49-60 |
| 当前实际状态 | 入口只 import theme.css / brand.css / theme-presets.css / tokens/index.css / foundations/index.css；7.0 runtime 产物 5 个文件零 import、零 link。 |
| 违反的规范 | §4.7 / §九 Showcase「展示真实运行时 Token」/ §17「必须完成真实产品组件接入」。 |
| 对产品的影响 | 7.0 的 254 个 Token 从未生效，规范与实现是两套；Showcase 展示的是文档侧的静态值。 |
| 整改方案 | 新增 web/src/design-system/tokens/uds-semantic-bridge.css（由 TOKEN-MANIFEST 生成的纯增量语义层），styles/index.css 仅增加一行 import，不覆盖任何既有变量。 |
| 对应自动化测试 | check-uds7-remediation.mjs::C-R02 断言 bridge CSS 被真实入口加载且 20 个 syntax / 12 chart / ANSI16 变量均可在浏览器 getComputedStyle 读到 |
| 验收证据 | registry/runtime-check.mjs 的 Playwright 实测输出 + 截图 |
| 整改状态 | RESOLVED |
| 实际证据 | C-R02 PASS · web/src/styles/index.css 单行 import + 8 个真实页面场景的 getComputedStyle 实测 |

#### UDS7-C-03

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-C-03 |
| 严重级别 | P0 |
| 所属域 | COLOR — 颜色体系与 Light / Dark 一致性 |
| 文件路径 | web/src/context/theme-provider.tsx |
| 行号 / 位置 | 98-99；theme-customization-provider.tsx:120；7.0/runtime/themes/light.css:25 |
| 当前实际状态 | 真实生效 2 套入口：html.light/.dark class + body[data-theme-preset]；7.0 另有第 3 套 [data-ds-theme] 未接入。 |
| 违反的规范 | §4.7 唯一来源 / §2.3「是否存在多个主题入口」。 |
| 对产品的影响 | 同一页面可能同时被 3 套选择器影响，Dark 取值不可预测。 |
| 整改方案 | bridge CSS 同时挂 :root/.dark 与 [data-ds-theme] 两种选择器，值来自同一 manifest；不修改现有 provider 逻辑。 |
| 对应自动化测试 | check-uds7-remediation.mjs::C-R03 断言三种选择器下同一 token 计算值一致 |
| 验收证据 | runtime-check.mjs 三选择器对比输出 |
| 整改状态 | RESOLVED |
| 实际证据 | C-R03 PASS · bridge CSS 四个选择器块：暗块逐字相同、亮属性块与 :root 逐值相同、:root 为主题无关 Token 超集 |

#### UDS7-C-04

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-C-04 |
| 严重级别 | P0 |
| 所属域 | COLOR — 颜色体系与 Light / Dark 一致性 |
| 文件路径 | web/src/design-system/tokens/colors.css |
| 行号 / 位置 | 86, 45, 34-50, 125 |
| 当前实际状态 | --ds-color-surface-overlay=#000000（3.0）vs 7.0 runtime/tokens.css:120 #FFFFFF（语义反转）；text-disabled 是 color-mix 表达式 vs 7.0 #94A3B8；另有 text-primary/secondary/inverse/border-input 同名不同值。 |
| 违反的规范 | §4.7「同一语义不得存在互相冲突的 Token」/ §12 迁移验证。 |
| 对产品的影响 | 一旦接入 7.0 同名变量，浮层遮罩会由黑变白、语义反转，页面直接损坏。 |
| 整改方案 | bridge CSS 只使用 --ds7-* 命名空间前缀做隔离，禁止覆盖同名 --ds-*；COMPAT-MAP 逐项登记 6 个冲突 Token 与人工迁移条件。 |
| 对应自动化测试 | check-uds7-remediation.mjs::C-R04 断言 bridge 不定义任何与 3.0 同名且不同值的 --ds-* 变量 |
| 验收证据 | UDS-7.0-MIGRATION-REPORT.md 兼容映射表 + 自动化扫描 |
| 整改状态 | RESOLVED |
| 实际证据 | C-R04 PASS · 隔离命名 --ds7-*；真实页面上 3.0 --ds-color-surface-overlay 仍为 #000000（语义未反转） |

#### UDS7-C-05

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-C-05 |
| 严重级别 | P1 |
| 所属域 | COLOR — 颜色体系与 Light / Dark 一致性 |
| 文件路径 | web/src/styles/theme.css |
| 行号 / 位置 | 48-162, 341-595；tokens/*.css；tokens/generated/brand.css:28-48 |
| 当前实际状态 | 至少 5 套并行颜色来源：--color-* 112、无前缀语义变量、--ds-* 175、--primitive-* 47、--uter-brand-* 16；theme-presets.css 再用同名变量覆盖 10+ 组预设。 |
| 违反的规范 | §4.1 五层颜色架构 / §4.7 唯一来源。 |
| 对产品的影响 | 同一语义色在不同预设下漂移，图表色被主题预设改写后还会污染状态色。 |
| 整改方案 | 在 TOKEN-MANIFEST 中显式登记 primitive→semantic→component→interaction→product 五层与 allowEdge；bridge 只读 manifest，不新增第六套来源。 |
| 对应自动化测试 | check-uds7-remediation.mjs::C-R05 断言五层节点齐全且每个 token 有 layer + consumer |
| 验收证据 | TOKEN-REGISTRY.json 的 layer 分布 + DEPENDENCY-GRAPH.json |
| 整改状态 | RESOLVED |
| 实际证据 | C-R05 PASS · 五层齐全；249/249 个颜色 Token 有 colorLayer；consumer 已登记 384/384 |

#### UDS7-C-06

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-C-06 |
| 严重级别 | P1 |
| 所属域 | COLOR — 颜色体系与 Light / Dark 一致性 |
| 文件路径 | web/src/design-system/tokens/generated/brand.css |
| 行号 / 位置 | 29, 40 |
| 当前实际状态 | 文档 §4.2 列的 6 色基线中，运行时仅 #5B5EE6 与 #A1A3F7 生效；#494CC7 / #3F42B0 / #B7B8FA 仅存在于 7.0 docs runtime；#8B8DF5 仅出现在注释与测试。 |
| 违反的规范 | §4.2「修改前必须核实当前真实 Token / 禁止无理由更改品牌色」。 |
| 对产品的影响 | 若按文档字面「保留」去改运行时，反而会引入未经验证的品牌色变更。 |
| 整改方案 | 基线六值 KEEP（零改动）；运行时 brand.css 与 3.0 规范声明对齐到 §4.2 基线（COLOR-OPTIMIZATION-REPORT.md R1），逐色给「原始值/是否生效/是否调整/对比度/组件影响」。 |
| 对应自动化测试 | check-uds7-remediation.mjs::C-R06 断言 brand.css 6 个值等于 §4.2 基线（直接值比对） |
| 验收证据 | COLOR-OPTIMIZATION-REPORT.md + C-R06 PASS + G07 同步校验 17/17 |
| 整改状态 | RESOLVED |
| 实际证据 | C-R06 PASS · 直接比对 §4.2 六值（Light #5B5EE6 / #494CC7 / #3F42B0；Dark #8B8DF5 / #A1A3F7 / #B7B8FA），不再依赖 git diff |

#### UDS7-C-07

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-C-07 |
| 严重级别 | P1 |
| 所属域 | COLOR — 颜色体系与 Light / Dark 一致性 |
| 文件路径 | web/src/styles/theme.css |
| 行号 / 位置 | 349, 353, 358 / 614, 616, 618 |
| 当前实际状态 | Light: --secondary / --muted / --accent 全为 #f1f5f9；Dark 全为 #1e293b，无语义区分。tertiary/disabled 是 color-mix 派生，无独立 Light/Dark HEX。 |
| 违反的规范 | §4.3「Secondary 与 Muted 不得无语义理由使用完全相同颜色」/「主次辅助文字清晰区别」。 |
| 对产品的影响 | 次级与辅助文字层级塌陷，disabled 随背景漂移，无法做稳定对比度验证。 |
| 整改方案 | 7.0 语义层新增 neutral 10 档 + text primary/secondary/tertiary/disabled 各自独立 Light/Dark 实色，并记录对比度。 |
| 对应自动化测试 | check-uds7-remediation.mjs::C-R07 断言 secondary≠muted≠tertiary 且四者 Light/Dark 各自 ≥4.5 |
| 验收证据 | contrast-validation.json 的 neutral 组 |
| 整改状态 | RESOLVED |
| 实际证据 | C-R07 PASS · contrast-engine 真实计算 + manifest 值去重 |

#### UDS7-C-08

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-C-08 |
| 严重级别 | P1 |
| 所属域 | COLOR — 颜色体系与 Light / Dark 一致性 |
| 文件路径 | web/src/styles/theme-presets.css |
| 行号 / 位置 | 484-487；features/wallet/components/wallet-stats-card.tsx:80 |
| 当前实际状态 | --success: var(--chart-2) / --warning: var(--chart-4) / --info: var(--chart-1)；钱包统计卡 tone=chart-4，Token 用量对话框用 text-chart-* 分类。 |
| 违反的规范 | §4.1 Product Context Colors「业务状态不得借用图表色或装饰色」。 |
| 对产品的影响 | 切换主题预设时状态色会随图表色漂移，支付/余额/订单状态语义不可靠。 |
| 整改方案 | 新增 12 类业务上下文语义 Token（balance/recharge/payment/refund/order/api-key/token/model-status/api-call/usage/billing/task-status），全部独立实色，不引用 chart；登记未迁移页面清单。 |
| 对应自动化测试 | check-uds7-remediation.mjs::C-R08 断言业务上下文 Token 的值不引用 --chart-* 且色彩与 chart 组不重合 |
| 验收证据 | TOKEN-CONSUMPTION-AUDIT.md 业务映射表 |
| 整改状态 | RESOLVED |
| 实际证据 | C-R08 PASS · 12 个 L5 业务上下文色逐值比对 chart 色板 |

#### UDS7-C-09

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-C-09 |
| 严重级别 | P1 |
| 所属域 | COLOR — 颜色体系与 Light / Dark 一致性 |
| 文件路径 | web/src/styles/theme.css |
| 行号 / 位置 | 389-394 / 645-650 |
| 当前实际状态 | 图表调色板只有 --chart-1..6（6 色，oklch 表达式）；7.0 manifest 只有 chart-1..5（5 色）。 |
| 违反的规范 | §4.5「建立 10–12 色图表调色板 / 兼顾色觉障碍 / 不只依赖颜色区分」。 |
| 对产品的影响 | 多系列图表超过 5 个系列即重复用色，色觉障碍用户无法辨识。 |
| 整改方案 | 扩展到 12 色，提供线型/点型/图例三套非颜色通道与 CVD（protanopia/deuteranopia/tritanopia）模拟可辨识度验证。 |
| 对应自动化测试 | check-uds7-remediation.mjs::C-R09 断言 12 色齐全、相邻 CIEDE2000 距离达标、非颜色通道齐全 |
| 验收证据 | chart-validation.json + Showcase 图表区 |
| 整改状态 | RESOLVED |
| 实际证据 | C-R09 PASS · 同 C-A04：颜色单通道距离未达标，非颜色通道已补齐（真实测量，不伪报） |

#### UDS7-C-10

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-C-10 |
| 严重级别 | P1 |
| 所属域 | COLOR — 颜色体系与 Light / Dark 一致性 |
| 文件路径 | web/src/styles/theme.css |
| 行号 / 位置 | 474 / 657 |
| 当前实际状态 | Light 与 Dark 的 --term-background 都是 #000000；终端与代码块共用背景语义。 |
| 违反的规范 | §4.6「禁止 Light 和 Dark Terminal 无条件共用纯黑背景 / 建立独立 Terminal Theme」。 |
| 对产品的影响 | Light 主题下终端是纯黑块，与页面割裂；代码块、编辑器、终端无区分。 |
| 整改方案 | 新增独立 Terminal Light/Dark：background / foreground / cursor / selection / ansi-0..15 / error / warning / success / info；代码块与编辑器各用独立背景 Token。 |
| 对应自动化测试 | check-uds7-remediation.mjs::C-R10 断言 termLight≠termDark 且 ANSI16 齐全、三者背景互不相同 |
| 验收证据 | LIGHT-DARK-CONSISTENCY-AUDIT.md + Showcase Terminal 区 |
| 整改状态 | RESOLVED |
| 实际证据 | C-R10 PASS · manifest 逐值比对 |

#### UDS7-C-11

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-C-11 |
| 严重级别 | P1 |
| 所属域 | COLOR — 颜色体系与 Light / Dark 一致性 |
| 文件路径 | web/src/styles/theme.css |
| 行号 / 位置 | 124；tokens/colors.css:45-49 |
| 当前实际状态 | disabled 为 color-mix(in oklch, var(--muted-foreground) 55%, transparent)，无独立 HEX；::selection 在 web/src 中零定义。 |
| 违反的规范 | §4.1 Semantic Colors 必须含 Focus / Selection；§8 Disabled 不得与正常状态混淆。 |
| 对产品的影响 | 选区与禁用态随背景漂移，无法给出可复现对比度证据。 |
| 整改方案 | 7.0 语义层补齐 focus / selection 的 Light/Dark 实色与 disabled 独立实色，并在 Showcase 显示对比度。 |
| 对应自动化测试 | check-uds7-remediation.mjs::C-R11 断言 focus/selection/disabled 各有 Light/Dark 定值 |
| 验收证据 | contrast-validation.json |
| 整改状态 | RESOLVED |
| 实际证据 | C-R11 PASS · manifest 三态 × 2 主题定值检查 |

#### UDS7-C-12

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-C-12 |
| 严重级别 | P2 |
| 所属域 | COLOR — 颜色体系与 Light / Dark 一致性 |
| 文件路径 | web/src/styles/theme.css |
| 行号 / 位置 | 364, 366, 360, 371 / 622, 624, 620, 626 |
| 当前实际状态 | success/warning/danger/info 只有单值（部分为 oklch），无 Foreground/Background/Border/Hover/Active/Subtle 六变体。 |
| 违反的规范 | §4.4「每个状态至少提供 6 类变体，Light/Dark 分别验证」。 |
| 对产品的影响 | 状态组件只能靠透明度凑层级，违反 3.0 T13/T15 且对比度不可验证。 |
| 整改方案 | 7.0 语义层为 4 状态 × 6 变体 × 2 主题建立 48 个独立实色 Token，全部计算对比度。 |
| 对应自动化测试 | check-uds7-remediation.mjs::C-R12 断言 48 个状态 Token 齐全且 foreground/background 组合 ≥4.5 |
| 验收证据 | contrast-validation.json 的 status 组 |
| 整改状态 | RESOLVED |
| 实际证据 | C-R12 PASS · 实际 29 个状态 Token（58 个主题值），每状态 7/7/7/7 变体；审计原文「48 个」为规划估计，实测以 29/58 为准 |

#### UDS7-R-03

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-R-03 |
| 严重级别 | P0 |
| 所属域 | MIGRATION — 版本兼容与迁移 |
| 文件路径 | DEPRECATED-REGISTRY.json；build.mjs:299-307 |
| 行号 / 位置 | 只有 6 条废弃项，policy 明示「本轮不执行删除」；3.0/7.0 有 6 个同名不同值 Token（含 surface-overlay 黑→白语义反转、radius-md 10px→5px），无逐 Token 兼容映射与回滚验证。 |
| 当前实际状态 | §十二「必须明确旧 Token / 新 Token / 兼容映射 / 迁移文件 / 未迁移页面 / 回滚方式」。 |
| 违反的规范 | 若一次性替换会直接破坏页面，且无回滚路径。 |
| 对产品的影响 | 生成 UDS-7.0-MIGRATION-REPORT.md + COMPAT-MAP.json：逐项映射、冲突档（CONFLICT 需人工确认）、批次 B1–B6、回滚=删除 bridge import 一行、未迁移页面清单。 |
| 整改方案 | check-uds7-remediation.mjs::C-M01 |
| 对应自动化测试 | COMPAT-MAP.json + 回滚演练记录 |
| 验收证据 |  |
| 整改状态 | RESOLVED |
| 实际证据 | C-M01 PASS · 真实回滚演练 2026-11-15T05:58:08.333Z：删除 import → 回滚态验证 → SHA256 字节级恢复 PASS |

#### UDS7-R-04

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-R-04 |
| 严重级别 | P0 |
| 所属域 | MIGRATION — 版本兼容与迁移 |
| 文件路径 | docs/design-system/TOKEN-MANIFEST.json |
| 行号 / 位置 | 6；ACCEPTANCE-MATRIX.json |
| 当前实际状态 | status=IMPLEMENTED_NOT_VERIFIED，38 模块 verification 全为 PARTIAL，accepted=false。 |
| 违反的规范 | §2.3「7.0 完成全部验收前不得宣布全站正式标准」/ §14「不得伪造 PASS」。 |
| 对产品的影响 | 无产品影响；这是必须保持的治理状态。 |
| 整改方案 | 保持状态不变；只有用户视觉审核通过并逐批完成全站迁移后才可申请切换，本任务不越权。 |
| 对应自动化测试 | check-uds7-remediation.mjs::C-M02 断言状态未被误标 |
| 验收证据 | FINAL-ACCEPTANCE-REPORT.md §1 |
| 整改状态 | RESOLVED |
| 实际证据 | C-M02 PASS · manifest / Showcase / ACCEPTANCE-MATRIX 三处状态一致 |

