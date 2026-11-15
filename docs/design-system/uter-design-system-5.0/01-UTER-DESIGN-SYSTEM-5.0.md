# UTER Design System 5.0 — 总纲

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S01` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01`（本文件即总纲，自引用；无更上级设计规范） |
| 生效日期 | `2026-11-14` |
| 适用范围 | `web/` 前端工程（PC Web / H5 响应式 / Electron 桌面外壳）的全部 UI 实现、Design Token、组件、页面模板、自动化门禁与规范文本；后端 Go 工程、资金/认证/授权业务逻辑不在视觉规范范围内 |
| 验证状态 | `NOT_VERIFIED` |

> **状态声明（阅读前必读）**：本文为 UTER Design System 5.0 的规范文本，不是验收报告。本轮工作仅撰写 `docs/design-system/uter-design-system-5.0/` 下的规范文档，**未执行任何构建、门禁、测试、视觉回归或平台验收命令**。本文所有 `验证状态` 一律为 `NOT_VERIFIED`；文中不得解读出「测试已通过」「组件已 FULLY_VERIFIED」「平台已验收」等结论。涉及仓库事实的数值、路径、脚本名，唯一依据是 `audit/BASELINE-AUDIT.md`（`UDS5-AUDIT-01`）与 `audit/CLERK-DESIGN-REFERENCE-ANALYSIS.md`（`UDS5-AUDIT-02`），并辅以对仓库内已存在文件的只读核实。

---

## 0. 术语、效力与版本口径

### 0.1 版本口径（强制）

| 项 | 5.0 口径 |
|---|---|
| 当前唯一正式设计体系 | **UTER Design System 5.0**，本总纲及 `UDS5-S02`–`UDS5-S0N` 下级规范 |
| 3.0 的地位 | `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md` **全文保留为历史版本**，不删除、不改写、不激活；不得再被称为「当前正式规范」「唯一标准」「唯一权威文件」 |
| 历史称谓处置 | `AGENTS.md` §1 规则加载表、`web/AGENTS.md`、`component-registry.json`、`source/brand.tokens.json` 中残留的 3.0 称谓属**历史文本**，须按本总纲 §15 的变更流程分期校正，校正前不得据其宣称 3.0 现行 |
| 混用禁令 | 禁止在同一条款中无说明地混用 3.0 / 3.1 / 5.0 数值；引用历史数值必须显式标注「历史版本 3.0 记录值」，并说明 5.0 是否沿用 |
| 5.0 定位 | **继承 + 统一版本 + 补齐证据与治理结构**，不是推倒重建（`BASELINE-AUDIT` §14 结论 A） |
| 未闭合项继承 | 3.0 §22 的 73 项未勾选验收、65 个组件 `VERIFIED=0`、E24 / P1–P3 / 字体轴 / PageHeader 等待办，全部显式继承为 5.0 待办与风险，不继承「已完成」结论 |

### 0.2 效力层级（冲突时从严）

| 层级 | 依据 | 管辖范围 |
|---|---|---|
| 1 | `AGENTS.md`（仓库级约定）、`web/AGENTS.md`（前端约定） | 工程纪律、安全、数据库、认证、资金红线、测试与构建门禁 |
| 2 | `.uap/` 治理规范与 `permission-policy.yaml` | 任务契约、权限、证据状态机；`branch_creation` / `branch_switch` / `force_push` / `destructive_git` 均为 `deny` |
| 3 | **上游 clerk.com 官方已公布的设计值** | 2026-11-15 裁决：5.0 规范值的最高依据。凡 5.0 与 clerk.com 已公布值不一致，一律以 clerk.com 为准（见 §4.3 G1 组） |
| 4 | **本总纲 `UDS5-S01` 及 5.0 下级规范** | 设计规则、边界、Token 语义、组件契约、验收口径；clerk.com 未公布项由本层给出唯一规范值（见 §4.3 G2 组） |
| 5 | 运行时代码（`web/src/design-system/tokens/`、`web/src/styles/theme.css`） | **实现现状**，不再是规范数值的裁定来源；规范与实现不一致时以规范为准，实现按 §19 分期迁移 |
| 6 | 历史版本 `UTER-DESIGN-SYSTEM-3.0.md` | 仅作历史追溯与差异比对，不产生现行约束 |

冲突裁决原则（`AGENTS.md` §8「Where rules differ, the stricter rule wins」、§「Design System Enforcement」与 2026-11-15 上级裁决）：

- **上游优先、唯一规范值**：clerk.com 已公布的设计值为唯一规范值；其未公布的设计元素，唯一规范值取 5.0 基线表（§4.3 G2 组，来自运行时实现现状）。任何条款、分册、差异台账中出现的第二套设计值（优化方案建议值、业务域蓝图建议值、3.0 历史值、审计时点快照）**一律不再是规范值**，仅可作历史记录保留，不得与唯一规范值并列。
- **规范与实现分离**：`AGENTS.md` 的「设计数值来自代码」仍约束运行时工程纪律，但 2026-11-15 裁决把规范值的裁定权上移到 clerk.com 上游；本轮**只改规范文本、不改 `web/src`**，由此产生的规范—实现差异统一登记为「待迁移」，按 §19 变更流程分期推进，不得静默抹平，也不得反过来把实现值写成规范基线。
- **下级规范一律遵循本总纲**：`UDS5-S02` 及之后所有下级规范、组件契约、页面模板、例外台账，若与本总纲冲突，以本总纲为准；下级规范只能细化，不得放宽或另立版本口径。
- **UAP 状态机**：只用 `NOT_BUILT` / `PARTIALLY_BUILT` / `IMPLEMENTED_NOT_VERIFIED` / `PARTIALLY_VERIFIED` / `FULLY_VERIFIED` / `FULLY_OPERATIONAL` / `BLOCKED` / `FAILED`；文档、文件或报告本身不证明能力可用，禁止伪造 `PASS` 或 `FULLY_OPERATIONAL`。

### 0.3 适用范围补充

「与其他规范的关系」「代码实施位置」「自动化验证」「验证状态」统一在文末四个标准专节给出，本节不重复定义，避免双份口径。

---

## 1. 设计系统定位

| 维度 | 定义 |
|---|---|
| 系统名称 | UTER Design System 5.0（UDS 5.0） |
| 服务对象 | Uter AI API 网关控制台：渠道 / 模型 / 计费 / 钱包 / 消费日志 / 系统设置 / 用户与组织管理等高信息密度后台 |
| 系统性质 | 面向单一产品的**规范 + Token + 组件 + 门禁**一体化体系，不是通用组件发行包 |
| 真源结构 | Spec SSOT（3.0 §28 Manifest，历史）→ Runtime SSOT（`web/src/design-system/tokens/` + `web/src/styles/theme.css`）→ 派生产物（`showcase.html` 内联快照 + `showcase.tokens.js` 兼容回退） |
| 5.0 的治理增量 | 统一版本口径、建立五层架构与组件元数据注册表、补齐「规范 ↔ 代码 ↔ 注册 ID ↔ 证据」双向关联、把 3.0 未闭合项转为带退出条件的台账 |
| 不做的事 | 不重建 Token 体系（Primitive/Semantic 已分离）、不引入新依赖、不批量重写全站 UI、不改业务契约（`BASELINE-AUDIT` §13、§14 结论 B） |

---

## 2. 设计目标

| # | 目标 | 可判定标准 | 当前状态 |
|---|---|---|---|
| G1 | 单一版本口径 | 全仓现行文档只指向 5.0；3.0 仅以「历史版本」出现 | `NOT_VERIFIED`（历史称谓待分期校正） |
| G2 | 数值单一来源 | `--text-*` 只在 `tokens/typography.css` 声明（T1）；颜色只有 `theme.css` 与 `--ds-color-*` 两条合法路径 | `NOT_VERIFIED` |
| G3 | 视觉一致性 | 品牌基线（§4）在全站无偏差；组件八态齐备 | `NOT_VERIFIED`（65 组件 `VERIFIED=0`） |
| G4 | 无障碍 | WCAG 2.2 AA 为目标；E24 两处对比度缺陷保持 P1 待修 | `NOT_VERIFIED` |
| G5 | 可验证 | 每条规则有对应门禁脚本与证据路径；`--strict` 为 CI 唯一阻断模式 | `NOT_VERIFIED` |
| G6 | 可扩展 | 扩展只走 variant / slot / composition，不引入 `appearance` 式全局覆写 | `NOT_VERIFIED` |
| G7 | 跨平台一致 | PC Web / H5 / Electron 共享同一套 Token 与类型阶梯 | 部分实现，`NOT_VERIFIED` |
| G8 | 业务安全 | 支付 / 充值 / 退款 / 余额 / 订单 / 认证 / 授权只改视觉与组件复用，零改 API 契约、资金逻辑、数据库结构、安全约束 | 边界成立，验收 `NOT_VERIFIED` |

---

## 3. 适用项目与平台

| 平台 | 真实实现 | 证据 | 5.0 验收状态 |
|---|---|---|---|
| PC Web | 有 | `web/` 完整工程；`.github/workflows/ci.yml` 的 `frontend` job；desktop 1440×900 × 22 张视觉基线 | `NOT_VERIFIED`（未执行双轨视觉回归） |
| H5 | 有（同一套代码的响应式分支，**非独立工程**） | 3.0 §16 断点 `sm640/md768/lg1024/xl1280/2xl1536`；mobile 390×844 × 22 张基线；`detectPayClient()` UA 判定 | `NOT_VERIFIED` |
| Electron 桌面 | 有（补充平台，不属 5 平台） | `electron/main.js` 加载同一 `web/dist` | `NOT_VERIFIED` |
| Android | **无** | 无 `android/`、无 `*.kt/.java`、无 Capacitor/Flutter/RN/uni-app | `NOT_VERIFIED` |
| iOS | **无** | 无 `ios/`、无 `*.swift/.m/.mm` | `NOT_VERIFIED` |
| HarmonyOS | **无** | 无 `harmony/`；仅 `web/src/features/wallet/lib/payment.ts:224` 存在 UA 正则字面量 | `NOT_VERIFIED` |

全仓 `*.kt / *.swift / *.java / *.m / *.mm` 计数为 **0**（`BASELINE-AUDIT` §8）。适用项目还包括 7 份 i18n locale（合计 54,573 行）与 Electron 外壳，但二者不改变「仅 2 个可验证 UI 平台、3 个平台无实现」的事实。

---

## 4. 品牌原则与品牌基线（必须保留）

### 4.1 品牌原则

| # | 原则 | 判定 |
|---|---|---|
| B1 | 上游对齐 | **2026-11-15 裁决（原「品牌自主 / 不采用 Clerk 紫色」红线废止）**：5.0 与上游 clerk.com 已公布设计值不一致时一律以 clerk.com 为准；品牌主色采用 clerk.com `colorPrimary` 官方值 `#6c47ff`。徽标、「Secured by Clerk」文案与 Clerk SDK / 主题包仍不引入（见 `UDS5-S21` §3 P2） |
| B2 | 克制专业 | 信任感优先于装饰；层级靠表面色差与 1px 描边建立，不靠重阴影 |
| B3 | 密度优先 | 网关控制台信息密度高于身份类组件；基准字号按上游 `0.8125rem`(13px)，字号刻度与最小 12px 下限按 §4.3 G2 |
| B4 | 单一强调色 | 品牌主色只承担主操作与选中态，不铺满大面积表面 |
| B5 | 深浅成对 | Light/Dark 成对定义；品牌渐变深浅同值，不随 `.dark` 覆盖 |

### 4.2 唯一规范值基线表（2026-11-15 上游对齐裁决，全 5.0 唯一取值入口）

> **效力**：本表是 5.0 全体系**唯一**的规范值入口。所有下级分册、组件契约、页面模板、例外台账中出现的第二套设计值一律不再是规范值。`audit/` 两份报告为历史快照，其数值仅作追溯，不得与本表并列成第二套口径。
>
> **分组**：`G1` = clerk.com 官方已公布 → 取 clerk.com 值（用户 2026-11-15 指令「不一致处以 clerk.com 为准」）；`G2` = clerk.com 未公布 → 取运行时实现现状为唯一规范值。**任一项在 5.0 中只存在一个值。**

| 组 | 属性 | **5.0 唯一规范值** | 依据 |
|---|---|---|---|
| G1 | 品牌主色 `colorPrimary` | `#6c47ff` | clerk.com `appearance.variables` 官方示例值（原 Uter `#5B5EE6` 基线废止） |
| G1 | 基准字号 `fontSize` | `0.8125rem`（13px） | clerk.com 官方默认值 |
| G1 | 圆角 `borderRadius` | `0.375rem`（6px） | clerk.com 官方默认值 |
| G1 | 间距 `spacing` | `1rem`（16px） | clerk.com 官方默认值 |
| G1 | 字重 `fontWeight` | `{normal:400, medium:500, semibold:600, bold:700}` | clerk.com 官方默认值 |
| G1 | 字体族 `fontFamily` / `fontFamilyButtons` | `inherit` | clerk.com 官方默认值（变量契约） |
| G1 | 字体族 `fontFamilyMono` | 系统 mono 栈 | clerk.com 官方默认值 |
| G1 | 主题变量结构 | 扁平单层 **24 键** `--clerk-*` 语义键（18 颜色 + 6 非颜色） | clerk.com `variables` 文档；原「Primitive→Semantic 两层 / 245 变量」不再是 5.0 规范口径 |
| G1 | 6 个弃用键 | `colorText→colorForeground` / `colorTextOnPrimaryBackground→colorPrimaryForeground` / `colorTextSecondary→colorMutedForeground` / `spacingUnit→spacing` / `colorInputText→colorInputForeground` / `colorInputBackground→colorInput`（2025-07-15） | clerk.com 官方弃用清单 |
| G1 | 主题切换 | `color-scheme: light dark` / `.dark` / `[data-theme='…']` / `prefers-color-scheme` | clerk.com 官方 |
| G1 | 预置主题 | 6 套：`default` / `simple` / `shadcn` / `dark` / `shadesOfPurple` / `neobrutalism`；数组叠加后定义者优先 | clerk.com 官方 |
| G1 | 运行时色阶派生 | `color-mix()` + 相对颜色语法；浏览器下限 Chrome 111+ / FF 113+ / Safari 16.2+（mix）、Chrome 119+ / FF 120+ / Safari 16.4+（相对色） | clerk.com 官方 |
| G1 | 定制分层 | 4 层：Themes → `appearance.variables` → BYO CSS（`cl-*` 稳定类）→ Build your own UI | clerk.com 官方 |
| G1 | 时效性事实 | Clerk Elements 已弃用（Core 3 / 2026-03-03）；`localization` prop 为 Experimental | clerk.com 官方 |
| G2 | Hover / Active（Light） | `#4F52D1` / `#4A4DC5` | clerk.com 未公布 → 运行时 `brand.tokens.json` / `generated/brand.css` |
| G2 | Dark primary / hover / active | `#A1A3F7` / `#B1B3FF` / `#9294F7` | 同上 |
| G2 | 实际字体文件 | `Inter Variable` + `Noto Sans SC Variable`（`@fontsource-variable/inter` / `@fontsource-variable/noto-sans-sc`） | clerk.com 未公布品牌字体族；不虚称引入 Source Han Sans 文件 |
| G2 | 字号刻度 | `@theme --text-*` 18 档：h1 `30/38`、h2 `24/32`、h3 `18/26`、display `36/44`、正文 `14/22`、caption `12/18`、长文本 `16/26` | 运行时 `tokens/typography.css` |
| G2 | 最小可见字号 | `12px` | clerk.com 未规定下限；与 13px 基准不冲突（基准为默认、12px 为下限） |
| G2 | 间距刻度 | `4pt` 网格：4 / 8 / 12 / 16 / 24 / 32 / 40 / 48 | 运行时 `tokens/spacing.css` |
| G2 | 圆角刻度 | 8 档 `calc(var(--radius)*N)`：6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 px + `full` | 运行时 `styles/theme.css` |
| G2 | 描边 / 焦点环 | 边框 `1px`；焦点环 `2px` / `ring-2` / `--ds-focus-ring-width: 2px` | 运行时 `tokens/semantic.css`；装饰性 `ring-1` 描边 1px 独立保留，不承载焦点语义 |
| G2 | 颜色语义 / 状态 / 图表 / 双主题映射 | 17 类 `--ds-color-*`、状态四层、图表 6 色 `oklch()`、Light/Dark Surface·Text·Border 映射 | clerk.com 未公布完整色阶 hex 与图表色板；详见 `UDS5-S03` §3 / §12 / §14 |
| G2 | 组件 / 元素 / 模板 / 断点 / 动效 / 层级 | 65 组件、20 元素、12 页面模板、5 档断点（640/768/1024/1280/1536）、6 档动效、6 档 elevation | clerk.com 官方未提供这些通用能力，全部由 Uter 自有规范定义 |
| G2 | 无障碍目标 | WCAG 2.2 AA：正文 ≥4.5:1、大字与必要图形 ≥3:1；31 条 `verify-contrast.mjs` 断言 | clerk.com 未公布条款级对照与数值表 |

**规范—实现差异（唯一有意保留项，登记为待迁移）**：本轮按上级指令**只改规范文本、不改 `web/src`**。运行时代码中仍为 `#5B5EE6` 主色、`14/22` 正文、`--radius: 0.625rem`、两层 245 变量；这些值与 `G1` 冲突，属**实现待迁移**，须按 §19 变更流程分期推进（先写回归测试、补对比度与视觉回归证据、再改代码），不得静默抹平，也不得反过来把实现值写成规范基线。迁移完成前，运行时守卫（`T1`–`T17`、`verify-contrast.mjs`、`check-clerk-boundary.mjs` C3）仍按现行代码值执行，属**过渡期双轨**，不是两套规范值。

**被废止的历史口径**（仅作追溯，不再是规范值）：品牌基线六色 `#5B5EE6` / `#494CC7` / `#3F42B0` / `#8B8DF5` / `#A1A3F7` / `#B7B8FA`；`14/22 + 4pt` 作为「基准」；`1px` 焦点环；「Primitive→Semantic 两层为 5.0 强制架构」；「不采用任何 Clerk 色值 / 13px 基准」。对应旧裁决 `D1`–`D8` 中与本表冲突者以本表为准。

### 4.2.1 焦点环唯一值

**5.0 唯一规范值：`2px` / `ring-2` / `--ds-focus-ring-width: 2px`**（§4.2 G2）。原生元素兜底与组件层 `focus-visible:ring-2` 同读该变量，全站只此一档（`UDS5-S02` §5.6）。

- 装饰性 `ring-1` 描边 `1px` 与 `1px` 边框是**独立有效值**，不承载焦点语义，原样保留；不得把全文「1px」无差别替换为 2px。
- 「`1px` / `ring-1` 作为焦点环宽度」为已作废的过时记忆，**不再是任何可选基线**；本表不再并列该历史值。
- 验证状态 `NOT_VERIFIED`：本轮未执行浏览器级守卫复核（回归测试、组件层与原生兜底同步、视觉 / 无障碍验收均未跑），不得据裁决宣称已验证。

---

## 4A. 业务风险分级（RISK 体系）

> 来源：业务域蓝图《Uter Design System Overview》（`UTER-DS-00`）§8「业务风险分级」。

### 4A.1 编号命名空间隔离（强制）

| 编号族 | 含义 | 定义位置 | 用途 |
|---|---|---|---|
| `RISK-P0` / `RISK-P1` / `RISK-P2` | **业务操作风险等级**（本节） | 本节 | 决定界面交互强度：确认方式、反馈密度、可否即时生效 |
| `P1` / `P2` / `P3`（裸写） | **仓库历史待办优先级** | `BASELINE-AUDIT` §3.1（E24 / ANSI 色板 / 图表 Token / `--ds-decor-*` 等） | 决定实现批次先后，**与业务风险无关** |
| `E24` / `E28` | 历史缺陷 / 例外编号 | `BASELINE-AUDIT` §3.1 | 缺陷台账 |

> 🔴 **强制口径**：同一份文档内出现裸写 `P1` / `P2` 时，一律指**仓库历史待办优先级**；指业务风险等级时**必须**写成 `RISK-P0` / `RISK-P1` / `RISK-P2`。两者不得混用、不得省略 `RISK-` 前缀。历史文档中的 `P1 待修`（如 E24 对比度缺陷）指待办优先级，**不是** `RISK-P1`。

### 4A.2 三级定义

| 等级 | 适用范围 | 强制交互要求 |
|---|---|---|
| `RISK-P0` | 支付、退款、余额变更（含管理员调整他人额度）、API Key 明文展示、权限提升、账户删除 | **必须**二次确认或强验证；**必须**显示影响与结果；**不得**在服务端确认前断言结果 |
| `RISK-P1` | 渠道启停、模型价格、限额、组织成员角色变更、批量操作 | **必须**提供明确反馈、审计信息与撤销 / 恢复策略（业务允许时） |
| `RISK-P2` | 普通偏好、筛选、排序、展示密度 | 允许即时生效，并提供可恢复体验 |

### 4A.3 按条目归属（强制口径：不得整节一刀切）

> 上一条 §4A.2 的适用范围是**按操作**判定的，不是按章节判定的。同一章节内既有高风险动作也有纯展示规则，**必须逐条标注**，禁止整节标为同一等级。

| 判据 | 归属 |
|---|---|
| 触及**资金 / 凭据 / 权限 / 账户**的写操作 | `RISK-P0` |
| 触及**配置 / 额度 / 批量 / 状态**的写操作 | `RISK-P1` |
| 纯展示、只读、布局、格式化 | `RISK-P2` |

### 4A.4 与既有规范的映射

| 蓝图要求 | 仓库落点 | 状态 |
|---|---|---|
| `RISK-P0` 二次确认 + 说明影响 | `UDS5-S16` §5.1.5 `DP-1`（对象 / 影响 / 不可逆性三要素）、`DP-2`（确认按钮动作词）、`DP-4`（焦点陷阱 + 默认不聚焦确认键） | 已覆盖 ✓ |
| `RISK-P0` 不得自行断言结果 | `UDS5-S19` §4.4 `CP-1`..`CP-7`（文案禁区）；`UDS5-S31` §9 资金真实性红线 `OB-9.1`..`OB-9.8` | 已覆盖 ✓ |
| `RISK-P0` 强验证（认证域） | `UDS5-S29` §7 `SEC-1`..`SEC-13`（验证码生命周期、会话与跳转安全、人机校验不可绕过、密码传输与本地处理、不得泄露账户存在性）；step-up 强验证 scope 清单见 `service/security_verification.go:26-54` | 已覆盖 ✓ |
| `RISK-P0` 强验证（API Key 明文域） | `UDS5-S30` §5（`TokenKeySecureVerificationRequired()` + `CriticalRateLimit()` + `DisableCache()` + 审计；scope `token.key.read`） | 已覆盖 ✓ |
| `RISK-P0` 强验证（账户 / 用户管理域） | `UDS5-S30` §7（`account.delete` / `admin.user.delete` 二次验证）；scope 清单 `service/security_verification.go:26-54` | 已覆盖 ✓ |
| `RISK-P1` 明确反馈 + 审计 + 可撤销 | `UDS5-S17` §10.3 操作反馈分类；`UDS5-S16` §5.1.2 `LF-3` / `LF-4`（批量选中数量 + 高风险批量二次确认） | 已覆盖 ✓ |
| `RISK-P2` 即时生效 + 可恢复 | `UDS5-S17` §10.1 通用状态模型；`UDS5-S17` §10.2 状态一致性 `ST-1`..`ST-4` | 已覆盖 ✓ |
| 蓝图 §7 组件六层分层 | `UDS5-S01` §6 五层架构（L1–L5） | **Adapt**（仓库为五层，蓝图为六层；Domain 层由 `UDS5-S29`..`S32` 承接） |

### 4A.5 仓库现状（如实登记）

| 项 | 结论 | 状态 |
|---|---|---|
| `RISK-P0` 操作是否**全部**走二次确认 | **未逐处核实**（删除 / 吊销 / 退款 / 权限变更入口散落各 feature） | `NOT_VERIFIED`（登记 `S01-D1`） |
| `RISK-P1` 批量操作是否**全部**有撤销 / 恢复路径 | **未逐处核实** | `NOT_VERIFIED`（登记 `S01-D2`） |
| 风险等级是否在代码中显式标注 | **未实现**——仓库无 `RISK-P0/P1/P2` 标记或元数据字段；本节目前只是**规范侧分级**，UI 无法按等级自动增强交互 | `NOT_IMPLEMENTED`（登记 `S01-D3`） |
| 认证域逐条风险归属 | `UDS5-S29` §7 已按条目分三组标注（`RISK-P0` / `RISK-P1` / `RISK-P2`），见该分册 §7 归属表 | 已覆盖 ✓（`UDS5-S29` §7） |
| API Key 域逐条风险归属 | `UDS5-S30` §5 已按条目分**三组**标注（`RISK-P0` 明文取回 / 撤销、`RISK-P1` U-5.13 权限提示、`RISK-P2` 展示类），见该分册 §5 归属表 | 已覆盖 ✓（`UDS5-S30` §5） |

---

## 5. Clerk 参考原则

| # | 原则 | 依据 | 5.0 落地 |
|---|---|---|---|
| C1 | **上游架构为准**（原「只借鉴理念」废止） | `CLERK-DESIGN-REFERENCE-ANALYSIS` §2.23：Themes → `appearance.variables` → BYO CSS（`cl-*` 稳定类）→ Build your own UI 四层 | 四层定制架构与扁平单层 24 键变量结构列为 §4.2 `G1` 唯一规范口径；`appearance` 式全局覆写在运行时迁移前仍由 T1–T17 约束（过渡期待办，见 §4.2） |
| C2 | 不引入 Clerk 运行时 | Elements 已随 Clerk Core 3（2026-03-03）弃用，推荐 redesigned hooks；`localization` 仍为 Experimental | 本轮不改 `web/src`，不引入 Clerk SDK / `@clerk/ui` / `@clerk/elements` / Storybook；规范对齐与运行时依赖引入是两件事 |
| C3 | 不把 Clerk 不具备的能力写成官方能力 | 官方未提供 Data Table / Charts / DatePicker / FileUpload / Toast 通用规范 / Drawer / Empty State 等 11 类能力 | 这类组件全部由 Uter 自有规范定义（§4.2 `G2`） |
| C4 | 严格限视觉 | `CLERK-DESIGN-REFERENCE-ANALYSIS` §2.17–2.19：认证 / 用户 / 组织管理仅参考信息架构与视觉密度 | 不替换 Uter 自建认证、`(auth)/` 9 路由、Casbin 权限、`org_role` / `sub_quota_limit` / `EnforceOrgQuota` / `ReserveOrgQuota` / `IncrOrgUsedQuota` |
| C5 | **品牌与数值以上游为准**（原「不照搬品牌与数值」红线废止） | 官方 `variables` 文档公布 24 键与默认值（`borderRadius 0.375rem`、`spacing 1rem`、`fontSize 0.8125rem`=13px、`fontWeight {400,500,600,700}`、`colorPrimary #6c47ff`、`fontFamily inherit`），未公布品牌字体族与完整色阶 hex | 主色 `#6c47ff`、13px 基准、6px 圆角、16px 间距、24 键扁平变量结构按 §4.2 `G1` 取为唯一规范值；未公布项按 `G2`；运行时迁移按 §19 分期，本轮不改代码 |
| C6 | 状态必须显式定义 | 官方示例同时写 hover / focus / active 三态 | 组件补齐 default/hover/focus/pressed/disabled/loading/error/success 八态 |
| C7 | 组件扩展走稳定契约 | `cl-*` 稳定类与内部类分界 | 扩展只走 variant / slot / composition，禁止依赖内部类 |

---

## 6. 五层架构（治理层模型）

### 6.1 层定义

| 层 | 名称 | 职责 | 允许依赖 | 禁止事项 |
|---|---|---|---|---|
| **L1 Foundation** | 设计基础层 | 定义颜色、字排、间距、圆角、描边、动效、图标、无障碍的**原始值与语义 Token** | 仅 DTCG 真源与基础 CSS 变量 | 不写组件结构，不写业务文案 |
| **L2 Primitives** | 原语与消费工具层 | 把 L1 值编译为可复用工具类 / `@utility` / 收口文件，提供唯一的消费出口 | L1 | 不新增第二套数值 Token，不写业务逻辑 |
| **L3 Components** | 组件层 | 无业务语义的通用 UI 实现（variant / size / state / a11y 契约） | L2 | 不硬编码色值、字号、间距；不重复实现 |
| **L4 Patterns** | 模式层 | 由 L3 组合出的可复用业务交互模式（表格工具栏、确认弹窗、空/加载/错误三态、复制、表单字段组） | L3 | 不承载具体页面路由，不绕过 L3 封装 |
| **L5 Templates & Applications** | 模板与应用层 | 页面骨架（App Shell / 内容容器 / 分区导航）与具体路由页面、业务模块组装 | L4 + L3 | 不定义新设计值；不改 API 契约与资金逻辑 |

### 6.2 每层真实代码落点

| 层 | 真实路径（均已核实存在） | 关键内容 |
|---|---|---|
| L1 Foundation | `web/src/design-system/tokens/` | `primitives.css`、`typography.css`、`spacing.css`、`semantic.css`、`colors.css`、`elevation.css`、`generated/brand.css`、`index.css`（唯一入口，6 条 `@import` 顺序不可重排） |
| L1 Foundation（真源） | `web/src/design-system/source/brand.tokens.json`、`brand.tokens.schema.json` | DTCG 品牌真源，`status: DRAFT` |
| L2 Primitives | `web/src/design-system/foundations/` | `accessibility.css`、`decoration.css`、`icons.css`、`index.css`、`motion.css`、`typography.css`（6 份 `@utility` / `@layer` 消费层）；另有 `tokens/brand-colors.ts`（T8 唯一裸色值所有者）、`tokens/chart-typography.ts`（T4 TS 镜像） |
| L2 Primitives（主题运行时） | `web/src/styles/theme.css`、`theme-presets.css` | `@custom-variant dark`、`--background` / `--foreground` / `--card` 等基础调色板、`data-theme-preset` / `data-theme-radius` / `data-theme-scale` 三维正交 |
| L3 Components | `web/src/components/ui/` | 单一实现根；`web/src/design-system/component-registry.json` 为注册真源；`web/src/design-system/components/typography/`（`heading.tsx` / `text.tsx` / `index.ts`）为字排组件 |
| L4 Patterns | `web/src/components/data-table/` | 唯一表格业务封装（`README.md` / `core` / `hooks` / `layout` / `static` / `toolbar` / `index.ts`，24 条公开导出）；另有 `web/src/components/` 下 `dialog` / `confirm-dialog` / `copy-button` / `empty-state` / `loading-state` / `error-state` 等封装 |
| L5 Templates & Applications | `web/src/routes/` | 文件路由（`__root.tsx`、`_authenticated/`、`_public/`、`(auth)/`、`(errors)/`、`oauth/`、`setup/`、`__tests__/`）；`web/src/features/` 承载业务模块；`web/src/components/layout/` 承载 App Shell；`electron/` 复用同一 `web/dist` |

### 6.3 与运行时 Token 三层的映射（防混淆）

`BASELINE-AUDIT` §4.1 记录的是**运行时 Token 分层**（L1 Primitive → L2 Semantic → L3 消费），与本节**规范治理五层**是两套不同维度，不得混为一谈：

| 运行时 Token 层 | 文件 | 对应治理层 |
|---|---|---|
| L1 Primitive | `tokens/primitives.css` / `typography.css` / `spacing.css` / `generated/brand.css` | 治理 L1 Foundation |
| L2 Semantic | `tokens/semantic.css`（63）/ `colors.css`（45）/ `elevation.css`（27） | 治理 L1 Foundation（语义部分） |
| L3 消费 | `foundations/*.css`（6 份，0 个 `--name:` 定义） | 治理 L2 Primitives |

引用方向恒为单向：**组件 → `--ds-*`（语义）→ `--text-*` / `--primitive-*`（原始）**。

---

## 7. Foundation 规范

- 管辖：颜色、字排、间距、圆角、描边、动效、图标、无障碍、主题、密度。
- 下级文件：`UDS5-S02`（Foundation 总规则）、`UDS5-S03`（Color）、`UDS5-S04`（Typography）、`UDS5-S05`（Spacing），及 5.0 后续 `ELEVATION-AND-BORDER` / `THEME` / `ACCESSIBILITY` / `RESPONSIVE` 等专题规范。
- 硬约束：三层单向引用；Primitive/Semantic 已分离，无需重建；`--text-*` 唯一来源（T1）；ALLOWLIST 为空，基线只减不增。

## 8. Component 规范

- 单一实现根：`web/src/components/ui/`；新增前必须按 `web/AGENTS.md` §3.3 先检索、再复用、最后才新增，并记录能力缺口。
- 八态齐备：default / hover / focus / pressed / disabled / loading / error / success（C6）。
- 扩展路径：variant（`cva()`）/ slot / composition；禁止 `appearance` 全局覆写，禁止依赖内部类，禁止绕过 `components/ui/` 手写同等控件。
- 已知缺口（继承为待办）：3 处同名 `EmptyState`（`components/empty-state.tsx` 正式、`components/notification-popover.tsx` 局部、`features/pricing/components/empty-state.tsx` feature 内）须统一；`ui/empty.tsx:95` 曾使用不存在的 `text-sm.5` 类。

## 9. Pattern 规范

| 模式 | 真实落点 | 规则 |
|---|---|---|
| 数据表格模式 | `web/src/components/data-table/` | 排序 / 筛选 / 搜索 / 分页 / 行选 / 批量 / 列可见性 / 响应式 / 空 / 加载 / 错误；不得在 feature 内重拼 |
| 确认与危险操作 | `components/confirm-dialog`、`components/dialog` | 二次确认、焦点陷阱、嵌套弹层外观作用域 |
| 状态三态 | `components/empty-state` / `loading-state` / `error-state` | 每页空 / 加载 / 错误三态齐全；合并 3 处同名重复实现 |
| 复制 | `components/copy-button`、`hooks/use-copy-to-clipboard` | 不直接用 `Button` 代替 |
| 表单模式 | `ui/form.tsx` / `field.tsx` / `form-label-tier.tsx` / `input-otp.tsx` | react-hook-form + zod；错误就近展示；防重复提交 |

## 10. Page Template 规范

- 骨架：App Shell（`web/src/components/layout/`）+ 持久二级导航 + 内容容器；后台内容区 `--ds-content-max: 80rem`（1280px），宽表模式 `--ds-content-max-wide: 112.5rem`（1800px）。
- 分区：系统设置 9 个子域 / 18 个路由需三级导航；账户类页面用「左侧分区导航 + 右侧内容」减少上下文丢失。
- `PageHeader`：3.0 §13.1 定义但**尚无独立组件**，页面按 §3 + §6 组合，5.0 列为补齐候选（`BASELINE-AUDIT` §3.1）。
- 标题层级：分区标题 22/600/30、卡片标题 18/600/26（规范目标口径；运行时真值差异见 `04-TYPOGRAPHY-STANDARD.md` §4.3，按 Adapt 登记 `NOT_VERIFIED`，不得改代码值）。

## 11. Application 规范

| 业务模块 | 路由落点 | 边界 |
|---|---|---|
| Dashboard / 统计 | `_authenticated/dashboard/{index,$section}.tsx` | 仅视觉与组件复用 |
| 用户 / API Key / 模型 / 渠道 | `_authenticated/users`、`keys`、`models`、`channels` | `ROLE.ADMIN` 守卫散布在 11 个路由文件，不改权限逻辑 |
| 钱包 / 充值 / 价格 | `_authenticated/wallet`、`_public/recharge-agreement.tsx`、`_public/pricing/` | **业务红线**：不改 API 契约、资金逻辑、数据库结构、安全约束 |
| 退款 / 订单 | **无独立路由**、无独立 refund 文件 | 账单历史为 `features/wallet/.../billing-history-dialog.tsx` 弹窗；不得虚构页面 |
| 消费记录 | `_authenticated/usage-logs/{index,$section,audit}.tsx` | 仅视觉 |
| 系统设置 | `_authenticated/system-settings/` 18 文件 / 9 子域 | 18 个路由无 E2E 视觉基线，登记为覆盖缺口 |

## 12. Token 管理

| 项 | 规则 |
|---|---|
| 真源 | `source/brand.tokens.json`（DTCG）→ `scripts/generate-design-tokens.mjs` → `tokens/generated/brand.css`（GENERATED FILE — DO NOT EDIT） |
| 基础调色板 | `web/src/styles/theme.css` 的 `:root` / `.dark`；`tokens/colors.css` 只做 `--ds-color-*` 语义映射，不新建调色板 |
| 唯一入口 | `tokens/index.css`（6 条 `@import`，顺序不可重排） |
| 新增颜色合法路径 | ① `theme.css` 定义原始颜色 → ② `colors.css` 映射 `--ds-color-*` → ③ 5.0 规范登记用途 |
| 数量基线 | 319 处定义 / 245 个唯一变量名 / 14 个 CSS / 1,518 行（`BASELINE-AUDIT` §4.1，审计时点快照） |
| 清理约束 | 约 93 个零静态引用变量是候选清理上限，**不是死代码结论**；`@theme` 变量经 `text-sm` 等工具类间接消费，删除前必须逐项验证构建产物 |
| 禁止 | 组件内 `#hex` / `rgb()` / `text-[#333]`（T8）；`text-foreground/60`（T13）；`hover:bg-primary/90`（T14）；`bg-warning/10`（T15） |
| 元数据 | 5.0 以「Token 元数据注册表 + 校验器」替代新建 `tokens/*.ts` 值 Token（D6，避免产生重复 Token） |

## 13. 组件注册

| 项 | 事实 / 规则 |
|---|---|
| 注册真源 | `web/src/design-system/component-registry.json`，`registryVersion 1.0.0` |
| 双向一致性 | 由 `scripts/check-component-registry.mjs` 校验 `registered` / `discovered` / `errors` |
| 证据现状 | 65 条注册：`VERIFIED 0` / `PARTIAL 9` / `NOT_VERIFIED 56` / `EXCEPTION 0`；`warnings=65`；`--strict` EXIT=1（审计时点记录，非本轮结果） |
| 缺失字段（相对上级 PART 3.4） | `layer` / `source` / `implementation_path` / `specification_path` / `test_path` / `story_path` / `variants` / 顶层 `states` / 顶层 `accessibility` / `deprecated` / `replacement` 全部缺失，须由生成式 YAML 投影合并，JSON 仍为唯一真源；YAML 顶层 `tokens` 为 JSON `contract.tokens` 的投影别名，YAML 顶层 `states` 为 `contract.states` 的原样投影（现状 1–4 态，八态为目标，见 `UDS5-S14` §6） |
| 计数差异 | `ui/*.tsx` 与 65 条注册的差异来自平铺测试 `dropdown-menu.test.tsx`；schema `file` 正则不含点号且脚本显式排除测试文件，**不是漏注册，禁止补注册** |
| 版本字段 | `component-registry.json` 的 `designSystem` 为 `3.0`，升级为 `5.0` 必须与 `check-component-registry.mjs:45` 的硬编码校验在**同一变更内**完成，否则门禁失败 |
| 展示关联 | 扩展既有 `docs/design-system/showcase.html`（24 区、真实 DOM、数据驱动），补 Props / 注册 ID / 组件级 a11y / 状态切换面板；不引入 Storybook（D3） |

## 14. 设计与开发协作

| 环节 | 规则 |
|---|---|
| 变更前置 | 先 `git status --short` 记录已脏文件；不折叠他人 WIP；`git add <path>` 显式暂存，禁 `git add -A` / `-u` |
| 规则加载 | 新会话 / 切换任务 / 进入带 `AGENTS.md` 的子目录时必须重读对应规范文件，不依赖记忆 |
| 实现顺序 | 先检索 `web/src/components/` 与对应 `features/`，再评估复用 / 组合 / 兼容扩展，最后才新增并记录能力缺口 |
| 测试先行 | 每处改动先写回归测试（`web/AGENTS.md` §3.14）；Bug 修复先写可稳定复现的失败用例 |
| 验证证据 | 完成报告必须列出精确命令、真实退出码 / 通过失败数、改动文件、已知失败或跳过项；「已检查」「tests passed」等表述视为无效 |
| 并发约束 | 审计期间存在 211 项并发 WIP（51 `M` + 160 `??`，152 项在 `.uap/`）；本轮不执行全量构建、不执行 `./uap *` 写状态命令 |
| 审查 | 代码审查 + 自动化测试 + 安全验证 + 质量门禁；关键失败阻断完成（`AGENTS.md` §5） |
| i18n | 用户可见文案走 `useTranslation()` / `t()`，7 份 locale 同步；`zhCN`/`zhTW` 进入 `Intl.*` 前须 `toIntlLocale()` |

## 15. 版本管理

| 项 | 规则 |
|---|---|
| 当前版本 | 仅 `5.0.0`；本总纲及下级规范 `状态 ACTIVE` |
| 历史版本 | `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md`（4,111 行 / 197,053 B / 29 章）全文保留，标记「历史版本」，不再作为现行验收依据 |
| 机器可读声明 | 3.0 §28.5 `TOKEN-MANIFEST`（`version 3.0.1`）为历史 Spec SSOT；`sync-design-showcase.mjs --check` 的 17 条校验与其哈希自洽 |
| 版本号升级 | 由 §19 变更流程驱动；`component-registry.json`、`source/brand.tokens.json`、`generated/brand.css` 头部注释中的 3.0 称谓须分期同步，且不得单独改动任一处导致门禁失败 |
| 状态字段 | `验证状态` 只允许 `NOT_VERIFIED`（未跑）或带证据链的实测结论；禁止填写 `PASS` / `已验证` / `FULLY_VERIFIED` 而无命令证据 |
| 状态机 | UAP §7 八态；本轮规范文本状态为 `IMPLEMENTED_NOT_VERIFIED` |

## 16. 废弃规范

| 项 | 处置 | 退出条件 |
|---|---|---|
| 3.0 作为现行规范 | 废弃「现行」地位，全文保留为历史版本 | 已完成（文本层面）；引用清理为待办 |
| 3.0 §22 的 73 个未勾选项 | 不得继承为「已通过」，转为 5.0 逐项证据台账 | 每项补齐命令与证据 |
| `primitives.css` 字号/行高/间距三组（25 个）零引用变量 | 列为废弃候选，**本轮不删除** | 逐项验证构建产物后方可处置 |
| `showcase-3.0.html` / `showcase-3.0.generated.html` 叙述 | 属过时注释（`generate-design-showcase.mjs`），实际不存在 | 清理注释并同步 17 条校验契约 |
| E24 / P1–P3 / 字体轴 / PageHeader 的「临时状态」 | 保持 Pending，不得勾选通过 | 见各项退出条件 |
| `brand.tokens.json` 的 `status: DRAFT` / `decision: AUTO_BLOCKED` | 不得擅自变更 | `verify-contrast.mjs` + 视觉回归证据链齐备 |

## 17. 自动化验收

| 门禁 / 脚本（真实存在） | 作用 | CI 接入（`.github/workflows/ci.yml` `frontend` job） |
|---|---|---|
| `web/scripts/check-design-tokens.mjs`（`lint:design:strict`） | T1–T17 静态扫描，`--strict` 为唯一阻断模式 | 已接入 `:417` |
| `web/scripts/generate-design-tokens.mjs --check`（`design:tokens:check`） | DTCG 真源与生成 CSS 同步 | 已接入 `:406` |
| `web/scripts/sync-design-showcase.mjs --check`（`design:showcase:check`） | 17 条 Manifest 一致性校验 | 已接入 `:411` |
| `web/scripts/verify-contrast.mjs`（`verify:contrast`） | 对比度与 E28 渐变锚定 | 已接入 `:414` |
| `web/scripts/check-component-registry.mjs`（`components:registry:check`） | 组件注册双向一致性 | 已接入 `:427`；`--strict` 未接入 |
| `web/scripts/visual-regression.mjs`（`test:visual`） | showcase 像素基线（已接入 ci.yml :423） | `test:visual` 已接入 CI（ci.yml :422 步骤 / :423 run 行）；E2E 双轨刻意不接 CI |
| `web/scripts/add-showcase-anchors.mjs`、`generate-design-showcase.mjs` | 展示页锚点与生成 | 辅助脚本 |
| `bun run typecheck` / `test` / `lint` / `copyright:check` / `build:check` | 前端基础门禁 | 已接入 `:387`–`:438` |
| `web/e2e/{axe,business,visual}/playwright.config.ts` | 三条 E2E 轨 | **刻意不接 CI**（像素基线依赖本机字体渲染与 GPU 合成、需完整服务栈），只能开发机手动执行 |
| `web/design-tokens.baseline.json` | 基线只减不增（0 条） | `--strict` 使用 |

**本轮未执行上述任何命令**，全部标 `NOT_VERIFIED`。

## 18. 违规处理

| 违规类型 | 处置 |
|---|---|
| T1–T17 静态违规 | `--strict` 非零退出即阻断；不得降级阈值、不扩 baseline、不动 `ALLOWLIST=[]`、不用 lint-disable 绕过 |
| 裸色值 / 硬编码字号 / 任意间距 / 任意圆角 | 回到 §12 合法路径或就近取整 4pt 档；不得靠「视觉看起来一致」放行 |
| 重复实现 | 按 `web/AGENTS.md` §3.3 合并到既有封装，记录 feature 侧能力缺口 |
| 例外 | A 类扫描例外登记 `ALLOWLIST` 且须同步校验契约；B 类验收口径例外（E28 渐变）只登记例外台账，**不进 ALLOWLIST** |
| 证据伪造 | 未跑即写 PASS、把 `BLOCKED` 写成通过、把文档存在当作能力可用，一律视为无效并回退 |
| 业务红线越界 | 触及支付 / 充值 / 退款 / 余额 / 订单 / 认证 / 授权 / 数据库契约的改动不予接受 |

## 19. 变更流程

| 步 | 动作 | 约束 |
|---|---|---|
| 1 | 记录基线：`git status --short`，列明已脏文件 | 不得覆盖并发 WIP；`web/src/styles/theme.css` 等 12 个已脏文件禁止改动 |
| 2 | 定位规范条款与运行时真值，列出冲突 | 数值看代码，规则看规范；冲突不得静默二选一 |
| 3 | 判定 `Adopt` / `Adapt` / `Reject` | 见 §19.2 决策清单；`Adapt` 必须写明「指令原文与仓库事实冲突」及处置 |
| 4 | 先写回归测试，再改实现 | 每个改动有对应测试；测试放模块 `__tests__/` |
| 5 | 只读门禁验证 | 本轮受并发 WIP 约束，不执行全量构建与 `./uap *` 写状态命令 |
| 6 | 同步校正下游引用（注册表 / Manifest / showcase / 脚本硬编码） | 强耦合项必须同一变更内完成 |
| 7 | 产出证据化报告 | 命令、退出码、通过失败数、改动文件、未执行项齐备 |
| 8 | 例外与待办入账 | E24 / P1–P3 / 平台缺口保持 `NOT_VERIFIED` 并给退出条件 |
| 禁止 | 创建 / 切换分支、暂存、提交、推送、合并、引入新依赖、删除组件或 Token | `AGENTS.md` §2 / `.uap/config/permission-policy.yaml` |

### 19.2 已登记的决策清单（`BASELINE-AUDIT` §9）

| ID | 冲突 | 决策 |
|---|---|---|
| D1 | 指令要求「不得用 `--text-*` 定义自有字体 Token」；v4.3.3 中 `@theme --text-*` 是自定义字号注册机制，T1 / 17 条 showcase 校验 / `tokens.test.ts` 均依赖它 | **Adapt**（详见 §20） |
| D2 | `AGENTS.md:359` 禁止在 `docs/` 新增文件，但上级指令明确要求创建 `docs/design-system/uter-design-system-5.0/` | **Adopt（明确授权例外）** |
| D3 | 「已有展示系统优先扩展」；`showcase.html` 无 React 实例 / Props / 注册 ID | **Adapt**：扩展既有展示，不引入 Storybook |
| D4 | PART 12.6 要求 5 平台分别验证、PART 13 要求全平台通过；Android/iOS/HarmonyOS 无实现 | **Reject（不可达）→ 如实标 `NOT_VERIFIED`** |
| D5 | 「研究 Clerk Elements」；官方页标题为 *Clerk Elements, Deprecated* | **Adapt**：只借鉴分层定制理念 |
| D6 | 建议 `tokens/*.ts`；实际真源为 CSS + `@theme` + Manifest 三层 | **Adapt**：以实际工程架构为准，不新建第二套值 Token |
| D7 | 「规范/代码/组件/页面/测试必须一致」；3.0 未闭合、65 组件 0 VERIFIED、73 路由仅 22 页有视觉基线 | **Adapt + 分期**：建差距台账，不批量重写 UI |
| D8 | 「研究 Clerk Authentication/User/Organization UI」但不得改认证逻辑 | **Adopt（严格边界）**：仅参考视觉与信息架构 |
| D9 | 用户 2026-11-15 指令「5.0 中所有与上游 clerk.com 不一致的地方以 clerk.com 为准；合并差异只保留唯一规范值」↔ 5.0 首轮「Clerk 仅为参考、不照搬品牌与数值、两层 Token 不倒退」红线 | **Adopt（上级裁决，红线废止）**：§0.2 效力层级上移 clerk.com、§4.2 建 `G1`/`G2` 唯一规范值基线表、§4.1 B1 / §5 C5 改写；`D5` / `D6` / `D8` 中与本裁决冲突处以 `D9` 为准。仅改规范文本，运行时代码差异登记为「待迁移」，按 §19 分期推进 |

## 20. 关键决策 D1（必须遵守）

**审计结论**：Tailwind CSS **4.3.3** 中，`@theme { --text-sm: ...; --text-sm--line-height: ... }` 是 v4 提供的**自定义字号注册机制**——在 `@theme` 内声明即注册 `text-sm` 工具类并覆盖内置默认值，同时作为运行时可读 CSS 变量；写在 `:root` 则会导致 `text-sm` 等工具类静默回退到 Tailwind 内置默认值。`web/src/design-system/tokens/typography.css:58-63` 已记录该历史陷阱。

**依赖面**：18 个 `--text-*` 档 + 18 个行高 + 4 个 `--font-weight-*` 由此生成；T1 门禁（「`--text-*` 只能出现在唯一来源」）、`sync-design-showcase.mjs` 的 17 条校验、`src/design-system/__tests__/tokens.test.ts` 的断言、`foundations/typography.css` 的消费，全部依赖该机制。

| 项 | 5.0 规定 |
|---|---|
| 运行时 | **保留 `@theme --text-*`，禁止删除或禁用**；删除会使全站字号静默回退并打破 T1 门禁 |
| 规范层 | 另立 `--ds-font-*` 语义别名体系，用于文档表述、跨端映射与组件契约；别名只做语义命名，不新建第二套数值 Token |
| 冲突处理 | 上级指令原文「不得使用 Tailwind v4 保留的 `--text-*` 命名空间定义自有字体 Token」与仓库事实冲突，处置为 **Adapt**，不是 `Adopt` 照抄、也不是 `Reject` 删码 |
| 记录义务 | 本结论须在 `04-TYPOGRAPHY-STANDARD.md` 复述，并写明「指令原文与仓库事实冲突 → Adapt」的完整推理链 |
| 验证状态 | 别名方案为规范层设计，**尚未落地代码、尚未验证**，`NOT_VERIFIED` |

---

## 21. 差异与例外登记

| 编号 | 内容 | 状态 |
|---|---|---|
| S01-D1 | 蓝图 §8 `RISK-P0` 要求「支付、退款、余额变更、API Key 明文展示、权限提升、账户删除**必须**二次确认或强验证」；仓库删除 / 吊销 / 退款 / 权限变更入口散落各 feature，**未逐处核实**是否全部走二次确认 | `NOT_VERIFIED`（见 §4A.4） |
| S01-D2 | 蓝图 §8 `RISK-P1` 要求「撤销 / 恢复策略（如业务允许）」；仓库**未逐处核实**批量操作是否具备撤销路径 | `NOT_VERIFIED`（见 §4A.4） |
| S01-D3 | 蓝图 §8 风险分级**未在代码中显式标注**——仓库无 `RISK-P0/P1/P2` 元数据或标记，UI 无法按等级自动增强交互强度 | `NOT_IMPLEMENTED`（见 §4A.4） |
| S01-D4 | 蓝图 §7 组件分层为**六层**（Foundations / Primitives / Composite / Domain / Patterns / Templates）；仓库 §6 为**五层**（L1–L5），Domain 层由 `UDS5-S29`..`S32` 四份业务域分册承接 | **Adapt**（见 §4A.3） |
| S01-D5 | 蓝图 §8 使用 `P0` / `P1` / `P2` 表示业务风险，与仓库 `BASELINE-AUDIT` §3.1 的 `P1`–`P3` **待办优先级同符号不同义** | **Adapt**（已做 `RISK-` 前缀命名空间隔离，见 §4A.1；`BASELINE-AUDIT` §10 等历史快照的裸写 P* 按本节裁决表标注时点，不代表现行口径） |
| S01-D6 | **`RISK-P0` 强验证存在代码不对称**：`controller/user.go:1367` 的 `delete` 分支挂 `requireAdminUserProof(c, service.VerificationScopeAdminUserDelete, ...)`，而同函数 `add_quota` 分支（`:1336-1338` → `controller/user_quota.go:13` `manageUserQuota`）**未挂任何强验证**。按 §4A.2，管理员调整他人额度属「余额变更」= `RISK-P0`，但仓库实现未达该级 | **真实代码缺陷**。修复须挂 `requireAdminUserProof` + `CriticalRateLimit` 并走 `UDS5-S01` §19 变更流程；本轮**不改代码**，登记待办 |
| S01-D7 | 蓝图 §8 的 `RISK-P0` / `RISK-P1` / `RISK-P2` **未在代码中标注**（`S01-D3`），本轮已按条目落到规范文本（`S29` §7 / `S30` §5 / §7），但「规范分级 → UI 自动增强交互」的链路**仍不存在** | `NOT_IMPLEMENTED`（`S01-D3` 的延续，不重复登记） |
| S01-D8 | **全 5.0 差异合并裁决（2026-11-15）**：各分册「差异与例外登记」章节中的第二套设计值（优化方案建议基线、业务域蓝图建议值、3.0 历史值、审计时点快照）一律不再是规范值 | **唯一规范值入口 = §4.2 基线表**（`G1` 取 clerk.com、`G2` 取运行时实现现状）。差异编号仅保留「实现状态 / 待办 / 缺陷」语义，不再承载第二个规范值；`E24` 两处对比度缺陷、`E28` 渐变有意例外、`NOT_VERIFIED` / `NOT_IMPLEMENTED` 状态**原样保留**（属状态而非设计值） |
| S01-D9 | **规范—实现待迁移**：`G1` 的 `#6c47ff` / 13px / 6px / 16px / 24 键结构与 `web/src` 现行值冲突；本轮按上级指令只改规范文本 | `NOT_IMPLEMENTED`（过渡期双轨）。迁移须走 §19：先写回归测试 → 补对比度与视觉回归证据 → 再改代码；迁移完成前运行时守卫仍按现行代码值执行，不得据本表宣称代码已对齐 |

---

## 与其他规范的关系

| 对象 | 关系 |
|---|---|
| 下级 `UDS5-S02`–`UDS5-S05` 及后续专题规范 | **一律遵循本总纲**；只可细化，不可放宽，不可另立版本口径；冲突以本总纲为准 |
| `AGENTS.md` | 上位工程约定；§8 明确 UAP 不替代本仓库约定，冲突时从严；§「Design System Enforcement」规定数值以代码为准、规则以规范为准；本总纲遵守其变更保护、验证证据、安全与资金红线 |
| `web/AGENTS.md` | 前端实现纪律（组件复用、i18n、测试、样式）；本总纲不覆盖其工程要求 |
| `.uap/` 治理 | 提供任务契约、权限与状态机；本轮遵守 `branch_creation` / `branch_switch` / `force_push` / `destructive_git` = `deny`，不创建分支、不提交 |
| `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md` | **历史版本**，全文保留；仅作追溯与差异比对，不产生现行约束、不作 5.0 验收依据 |
| `docs/design-system/showcase.html` | 视觉标本与 Manifest 派生产物；是展示层，不是规范真源 |
| `audit/BASELINE-AUDIT.md` / `audit/CLERK-DESIGN-REFERENCE-ANALYSIS.md` | 本轮规范撰写的**唯一事实源**；其结论与未闭合项被本总纲继承 |
| Clerk 官方文档 | **上游权威**：已公布设计值一律以 clerk.com 为准（`UDS5-S01` §4.2 `G1`）；本轮不引入运行时依赖、不引入徽标与品牌背书文案 |

## 代码实施位置

| 类别 | 真实路径 |
|---|---|
| 规范文档 | `docs/design-system/uter-design-system-5.0/01-UTER-DESIGN-SYSTEM-5.0.md`、`02-FOUNDATION-STANDARD.md`、`03-COLOR-STANDARD.md`、`04-TYPOGRAPHY-STANDARD.md`、`05-SPACING-STANDARD.md`、`audit/BASELINE-AUDIT.md`、`audit/CLERK-DESIGN-REFERENCE-ANALYSIS.md` |
| Token 真源与生成 | `web/src/design-system/source/brand.tokens.json`、`brand.tokens.schema.json`、`web/src/design-system/tokens/generated/brand.css` |
| Token 运行时 | `web/src/design-system/tokens/{primitives,typography,spacing,semantic,colors,elevation,index}.css`、`brand-colors.ts`、`chart-typography.ts` |
| 消费工具层 | `web/src/design-system/foundations/{accessibility,decoration,icons,index,motion,typography}.css` |
| 主题层 | `web/src/styles/theme.css`、`theme-presets.css`、`index.css` |
| 组件层 | `web/src/components/ui/`、`web/src/design-system/components/typography/heading.tsx`、`text.tsx`、`index.ts`、`web/src/design-system/component-registry.json` |
| 模式层 | `web/src/components/data-table/`、顶层 `dialog` / `confirm-dialog` / `copy-button` / `empty-state` / `loading-state` / `error-state` |
| 应用层 | `web/src/routes/`、`web/src/features/`、`web/src/components/layout/`、`electron/` |
| 测试 | `web/src/design-system/__tests__/`（12 个守卫测试）、`web/e2e/{axe,business,visual}/` |
| 视觉标本 | `docs/design-system/showcase.html`、`showcase.tokens.js` |

## 自动化验证

| 脚本 / 命令（真实存在） | 归属 |
|---|---|
| `web/scripts/check-design-tokens.mjs`（`bun run lint:design:strict`） | T1–T17 Token 门禁 |
| `web/scripts/generate-design-tokens.mjs`（`bun run design:tokens:check`） | DTCG 同步 |
| `web/scripts/sync-design-showcase.mjs`（`bun run design:showcase:check`） | 17 条 Manifest 校验 |
| `web/scripts/verify-contrast.mjs`（`bun run verify:contrast`） | 对比度与 E28 |
| `web/scripts/check-component-registry.mjs`（`bun run components:registry:check`） | 组件注册一致性 |
| `web/scripts/visual-regression.mjs`（`bun run test:visual`） | showcase 像素基线（已接入 ci.yml :423） |
| `web/scripts/add-showcase-anchors.mjs`、`generate-design-showcase.mjs` | 展示页锚点与生成 |
| `bun run typecheck` / `lint` / `test` / `copyright:check` / `build:check` | 前端基础门禁 |
| `web/e2e/axe/playwright.config.ts`、`web/e2e/business/playwright.config.ts`、`web/e2e/visual/playwright.config.ts` | 三条 E2E 轨（刻意不接 CI） |
| `.github/workflows/ci.yml`、`release-gate.yml` | CI 编排 |
| `scripts/verify-all.sh`（仓库根） | 全量门禁入口（本轮受并发 WIP 约束不执行） |
| `web/design-tokens.baseline.json` | 基线只减不增 |

## 验证状态

| 项 | 状态 |
|---|---|
| 文档 ID / 版本 / 状态 | `UDS5-S01` / `5.0.0` / `ACTIVE` |
| 本轮实际动作 | 仅撰写规范文本；未修改 `web/src`、`.uap`、CI、`package.json`；未执行 git 操作 |
| 本轮执行的验证命令 | **无** |
| 验证状态 | **`NOT_VERIFIED`** |
| 规范文本整体状态（UAP 状态机） | `IMPLEMENTED_NOT_VERIFIED` |
| 设计体系整体最终状态 | 低于 `FULLY_IMPLEMENTED_AND_VERIFIED`（见 §25） |

**未验证 / 未执行清单（不得省略）**：全量构建（`./rebuild-all.sh`、`bun run build:check`、`scripts/verify-all.sh`）、`test:visual` 与 `test:visual:e2e` 双轨视觉回归、`test:axe`、`test:business:e2e`、`components:registry:strict`、`./uap validate --all`、Android / iOS / HarmonyOS 原生平台验收、65 个组件的逐项证据补齐、3.0 §22 的 73 项验收逐项复核、E24 两处对比度缺陷修复验证、焦点环 `2px` 在组件层与原生兜底的同步及回归测试验证（口径已裁决、实现未验证）、§4.2 差异登记的统一、`--ds-font-*` 语义别名落地验证、73 路由中未覆盖的视觉基线补齐。

---

## 25. 最终验收标准（PART 13）与不可达结论

### 25.1 最终验收条件

| # | 条件 | 现状 |
|---|---|---|
| F1 | 全部下级规范遵循本总纲、版本口径统一为 5.0 | 文本层面已建立；引用清理待办 |
| F2 | 全部 Token 单一来源、门禁 `--strict` 无新增违规 | `NOT_VERIFIED` |
| F3 | 全部组件已注册且逐项证据达 `VERIFIED` | 现状 `VERIFIED 0`，`NOT_VERIFIED` |
| F4 | 全部页面完成适配并有视觉基线 | 73 路由中仅 22 页有基线，`NOT_VERIFIED` |
| F5 | 规范、代码、组件、页面、测试一致 | 差距台账未闭合，`NOT_VERIFIED` |
| F6 | 所有适用平台完成验证 | 见 §25.2 |
| F7 | 无障碍缺陷清零（E24 3.76:1 / 3.30:1） | P1 待修，`NOT_VERIFIED` |
| F8 | 无未登记例外、基线只减不增、证据链齐备 | `NOT_VERIFIED` |

### 25.2 PART 13 最终状态不可达结论

`BASELINE-AUDIT` §8 与 §14 结论 C：Android / iOS / HarmonyOS **无任何真实实现**，按上级 PART 12.6 必须标 `NOT_VERIFIED`；而 PART 13 规定「所有适用平台完成验证」才可宣布 `FULLY_IMPLEMENTED_AND_VERIFIED`。二者构成**不可消除的逻辑冲突**（决策 D4，`Reject（不可达）→ 如实标记`）。

因此：

1. 三个无实现平台一律标 `NOT_VERIFIED`，不得以「同一套代码响应式」或 Electron 复用 `web/dist` 冒充原生平台验收。
2. **本轮最终状态必须低于 `FULLY_IMPLEMENTED_AND_VERIFIED`**；按 PART 13「只要有一项未通过就不能宣布」报告实际状态。
3. 逐条未通过项在最终验收报告中列明，不得省略、不得四舍五入、不得用 `PASS` / `FULLY_VERIFIED` 掩盖。
4. 该结论不因规范文本撰写完成而改变——文档存在本身不证明能力可用（`AGENTS.md` §7 与 UAP §7）。


---

## 26. 全局计数与口径裁决表（2026-11-14 统一，唯一裁决入口）

> 本节为 5.0 全部分册的**计数与口径单一真源**。凡分册、审计报告、验收报告、注册表与本表冲突，一律以本表为准；历史快照保留原值但必须显式标注时点，不得静默覆盖。裁决原则（2026-11-15 修订）：**规范设计值以 §4.2 唯一规范值基线表为准（`G1` 取 clerk.com 上游、`G2` 取运行时实现现状）；计数与磁盘事实以只读实测为准；规则与边界以规范为准**。本节各行的「唯一现行值」均为计数或状态口径，不另立第二套设计值。

| 项 | 唯一现行值 | 历史 / 子集口径 | 裁决依据 |
|---|---|---|---|
| **唯一规范值入口** | **§4.2 基线表**：`G1` 14 项取 clerk.com 官方值、`G2` 11 类取运行时实现现状；任一属性在全 5.0 只有一个值 | 各分册「差异与例外登记」中的建议基线 / 蓝图值 / 3.0 历史值 / 审计快照均为历史记录，不是规范值 | 2026-11-15 上级裁决 `D9` / `S01-D8` |
| **上游效力** | clerk.com 官方已公布值 > 5.0 分册 > 运行时实现现状（实现按 §19 迁移） | 首轮「Clerk 仅为参考、不照搬品牌与数值」红线已废止 | §0.2 效力层级 / §4.1 B1 / §5 C5 |
| 分册数 | **32 份**（`UDS5-S01`–`UDS5-S32` = 28 基础 + 4 业务域） | 28 = 仅基础分册 S01–S28 | 注册表 S29–S32 已 ACTIVE |
| 目录 `.md` 总数 | **35 份**（33 根目录 + 2 `audit/`） | — | `find` 实测 |
| 注册条目 | **37 条**（35 `.md` + 2 `.yaml` 注册表） | 33 / 36 为过时中间值 | `design:5:check` 实测 `standards: 37` / `registeredDocIds: 37` |
| 已注册组件 | **65 个** | `ui/*.tsx` 66 文件 = 65 实现 + 1 平铺测试 | `components:registry:check` 65/65/0 |
| 守卫测试 | **12 个**（`web/src/design-system/__tests__/*.test.ts`） | 审计快照 10 / 5.0 首轮 11 | 磁盘实测；`S13-D13` 登记差异 |
| 路由源码 / feature 目录 | **73 / 30** | 80 为无口径漂移值 | `find` 实测；`BASELINE-AUDIT` §6 逐项可加总 |
| Token CSS | **14 个**（8 `tokens/` + 6 `foundations/`） | `design:5:check` 的 `tokenFiles: 8` 仅计 `tokens/` | `find` 实测 |
| 圆角 | **8 个 calc 命名派生档 + `rounded-full` 特殊档 = 9 种合法写法** | 「圆角七档」为 3.0 早期滞后称谓 | `theme.css:254-276` + T10 |
| 焦点环 | **2px `ring-2`**（已裁决，无漂移） | 旧「1px 勿回 2px」记忆作废 | `semantic.css:123`；装饰性 `ring-1` 1px 保留 |
| `--text-xs` 行高 | **12/18** | 12/16 为 v1.2 前旧推导 | `typography.css:70` |
| 控件高度 | **`--ds-control-height-{sm,md}` 两档**（32/36/40、36/40/44） | 「24/32/44 三档」误记 | `spacing.css:34-35,73-74,91-92` |
| E28 深色对比度 | **7.02 / 6.56 / 4.51:1**（运行时 `verify-contrast.mjs` 真值，深色背景 `#0F172A`） | 7.93 / 7.41 / 5.10 为第二轮误按 `#020617` 对齐的旧值，已回正 | `UDS5-S13` §6 逐值成对锚定 |
| E28 浅色达标 | from 2.54 / via 2.72 **未达 3:1**，to 3.96 **达标** | 「三档全部未达」为算术错误 | 13 §3.7 阈值 3:1 |
| Clerk 来源 / 对照 / 决策 | **13 个核对入口（唯一 URL 去重 11）/ 18 项对照 / 30 项决策** | AUDIT-02 首轮 = 9 来源 / 23 小节 24 判定（历史快照） | `UDS5-S21` §2.4 / §5；CHANGELOG 节点六 |
| N1–N7 处置 | **7 维度 / 9 判定**（6 `Adapt` + 1 `Adopt`(N6 上游对齐) + 2 `Reject`，N4 / N7 双记） | 「6 Adapt + 3 Reject」为 2026-11-14 首轮口径；N6 已按上游裁决由 `Reject` 改 `Adopt` | `UDS5-S21` §2.4 / §5；`S21-D13` |
| 组件八态 | **8 态**（default/hover/focus/pressed/disabled/loading/error/success） | 五态 = 交互过程（S17）；6 态 = 展示中心现状（缺 error/success） | `UDS5-S14` §6 / `UDS5-S17` |
| registry 缺失字段 | **11 项**（含顶层 `accessibility`） | 「8 类」为分组旧称 | `UDS5-S01` §6 / `UDS5-S23` §3.12 |
| 通知组件 | **6 类**（含 2 类规范保留位） | 5 类漏 `System Notification` | `UDS5-S20` §3 |
| 业务模块 | **17 个** | 15 项为无独立路由子集 | `UDS5-S22` §3 |
| 业务红线唯一清单 | `org_role` / `sub_quota_limit` / `EnforceOrgQuota` / `ReserveOrgQuota` / `IncrOrgUsedQuota` **零改动** | 3 项 / 4 项枚举为不完整子集 | 本节 §5 C4 |
| 并发 WIP | **211 项**（51 `M` + 160 `??`，152 项在 `.uap/`） | 391 为未核对构成数 | `BASELINE-AUDIT` §1 带分解实测 |
| 状态枚举 | **4 值** `ACTIVE` / `DEPRECATED` / `PENDING` / `DRAFT` | `ARCHIVED` 为蓝图历史态，不进注册表 | 注册表 `status_values` |
| 状态机 | UAP 八态（能力判级）；验收八标签（验收记录），交集 4 态 | 「全局唯一口径」措辞已废止 | `AGENTS.md` §7 / `UDS5-S25` §1.1 |
| `test:visual` | **已接入 CI**（`ci.yml` :422 步骤 / :423 run 行） | 「本地专用」为旧称；E2E 双轨仍刻意不接 CI | `ci.yml:423` |
| `design:5:check` | **已接入 CI**（`ci.yml:434`） | §9 清单漏登已补齐 | `ci.yml:434` |
| RISK 命名空间 | 业务风险一律 `RISK-P0/P1/P2`；裸写 `P1–P3` = 待办优先级；S21 P1–P5 = 禁止项编号；S23 Phase 0–4 = 改造阶段 | 历史审计文本裸写 P* 已改写并加注 | §4A.1 / 本节 |
| 5.0 Showcase | `SHOWCASE-5.0.html`（规范全量验收视图）+ 既有 `showcase.html`（3.0 Token 中心） | D3 禁止的是第二套**组件实例**展示系统 | `UDS5-S23` §11 |
| YAML 投影字段 | `COMPONENT-REGISTRY.yaml` 的 `design_system: UTER Design System 5.0` 指**投影所属规范集**（由 `check-design-system-5.0.mjs:129` 生成），与真源 `component-registry.json:4` 的 `designSystem: "UTER Design System 3.0"` 是不同对象，不得据此判定「版本已统一」；顶层 `tokens` = `contract.tokens` 投影别名，顶层 `states` = `contract.states` 原样投影（现状 1–4 态，目标八态） | 二者均不改写数据，仅登记映射 | `UDS5-S14` §3 / `UDS5-S23` §4 A5 |
| Showcase 校验 | `design:showcase:5:check`（纯静态只读）+ `design-showcase-5.test.ts` 回归测试；`SHOWCASE-5.0.html` 覆盖 37 注册条目 / 65 组件 / 18 类元素 | 与本表全部计数联动 | `UDS5-S23` §11 |
