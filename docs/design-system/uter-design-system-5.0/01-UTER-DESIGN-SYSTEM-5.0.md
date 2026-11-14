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
| 3 | **本总纲 `UDS5-S01` 及 5.0 下级规范** | 设计规则、边界、Token 语义、组件契约、验收口径 |
| 4 | 运行时代码（`web/src/design-system/tokens/`、`web/src/styles/theme.css`） | 设计**数值真值** |
| 5 | 历史版本 `UTER-DESIGN-SYSTEM-3.0.md` | 仅作历史追溯与差异比对，不产生现行约束 |

冲突裁决原则（`AGENTS.md` §8「Where rules differ, the stricter rule wins」与 §「Design System Enforcement」）：

- **数值以代码为准，规则与边界以规范为准**：文档与实现冲突时不得静默二选一；设计数值取自 `tokens/` 与 `theme.css`，规则与边界取自 5.0 规范。
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
| B1 | 品牌自主 | 保留 Uter 靛紫品牌与「优特智能」品牌名；不采用 Clerk 紫色、徽标或「Secured by Clerk」文案 |
| B2 | 克制专业 | 信任感优先于装饰；层级靠表面色差与 1px 描边建立，不靠重阴影 |
| B3 | 密度优先 | 网关控制台信息密度远高于身份类组件，字号与间距以 14/22 + 4pt 为基准 |
| B4 | 单一强调色 | 品牌主色只承担主操作与选中态，不铺满大面积表面 |
| B5 | 深浅成对 | Light/Dark 成对定义；品牌渐变深浅同值，不随 `.dark` 覆盖 |

### 4.2 品牌基线（5.0 规范口径，必须保留）

| 类别 | 规范基线值 |
|---|---|
| Primary Light | `#5B5EE6` / Hover `#494CC7` / Active `#3F42B0` |
| Primary Dark | `#8B8DF5` / Hover `#A1A3F7` / Active `#B7B8FA` |
| 字体 | `Inter Variable` + `Noto Sans SC Variable`（`@fontsource-variable/inter` / `@fontsource-variable/noto-sans-sc`）；Noto Sans SC 与 Source Han Sans 为同一字体家族双发行版，规范文本不得虚称引入了 Source Han Sans 字体文件 |
| 正文 | `14/22`（即 `14 / 22`） |
| Caption / Small | `12/18`（即 `12 / 18`） |
| 长文本 | `16/26`（即 `16 / 26`） |
| 最小字号 | `12px`（全站可见文本下限） |
| 间距 | `4pt` 基础单位 |
| 描边 | `1px` 边框 |
| 焦点环 | `2px` / `ring-2`（team-lead 已裁决采用运行时真值；「1px 焦点环」为已作废的过时记忆；装饰性 `ring-1` 描边 1px 与 `1px` 边框原样保留，见 §4.2.1） |
| 层级手段 | 优先表面色差，而非重阴影 |

> **差异登记（Adapt，`NOT_VERIFIED`）**：上述基线为规范层口径，来自 `BASELINE-AUDIT` §11.1 与上级指令。对仓库内已存在文件的只读核实发现若干运行时取值与基线不完全一致，已按 §9「指令原文与仓库事实冲突 → Adapt」登记，**本轮不擅自改写代码、不宣称二者一致**。其中焦点环一项已由 team-lead 裁决定案（见 §4.2.1），其余项仍待解：
>
> | 项 | 5.0 规范口径 | 运行时文件记录值 | 处置 |
> |---|---|---|---|
> | 焦点环宽度 | **已裁决采用 `2px` / `ring-2`**；「`1px` / `ring-1` 作为焦点环宽度」为**已作废的过时记忆** | `web/src/design-system/tokens/semantic.css:120-123` 为 `--ds-focus-ring-width: 2px`（注释记录 2026-11-13 变更）；3.0 §15.1 亦为恒 `2px` / `ring-2` | **已裁决**：按 `AGENTS.md`「设计值来自代码」采用 `2px`；运行时代码本身已是 2px，**本轮不改任何代码值**；装饰性 `ring-1` 描边 1px 与 `1px` 边框为真实有效值、原样保留（07 分册按 1px 登记），不得改成 2px；验证状态 `NOT_VERIFIED`（未执行浏览器级守卫复核） |
> | h1 / h2 字号 | 用户基线 h1 `28/600/36`、h2 `22/600/30` | `@theme` 运行真值 h1 `--text-4xl` `30/38`、h2 `--text-3xl` `24/32`（h3 `18/26`、display `36/44` 一致） | **Adapt** / `NOT_VERIFIED`；数值以代码为准，**不得改代码值**，与品牌三态色值差异同样处理；若统一须走 §19 变更流程并补回归测试，详见 `04-TYPOGRAPHY-STANDARD.md` §4.3 |
> | Light hover / active | `#494CC7` / `#3F42B0` | `source/brand.tokens.json` 与 `tokens/generated/brand.css` 为 `#4F52D1` / `#4A4DC5` | 仍待解，`NOT_VERIFIED`；`brand.tokens.json` 为 `status: DRAFT` / `decision: AUTO_BLOCKED`，**值 / 状态变更未获授权**（差异登记已获 team-lead 授权并在 `10-THEME-STANDARD.md` §10.1 / `S10-D7` 落地）；**不得改代码值** |
> | Dark primary / hover / active | `#8B8DF5` / `#A1A3F7` / `#B7B8FA` | `tokens/generated/brand.css` 的 `.dark` 为 `#A1A3F7` / `#B1B3FF` / `#9294F7` | 仍待解，`NOT_VERIFIED`；同上，值 / 状态变更未获授权；**不得改代码值** |
>
> 除焦点环已按裁决采用运行时真值 `2px` 外，其余差异不得被静默抹平，也不得反过来把运行时值写成本规范基线；**所有差异项一律不得改代码值**。品牌基线六色值（Light `#5B5EE6` / `#494CC7` / `#3F42B0`、Dark `#8B8DF5` / `#A1A3F7` / `#B7B8FA`）本身保持原样不改。品牌色值差异已由 team-lead 授权在 `10-THEME-STANDARD.md` §10.1 / `S10-D7` 同步登记（Adapt + `NOT_VERIFIED`），其态位对应按 DTCG 键名读取、**语义等价未逐一独立核实**，不得宣称逐值一一对应已验证。详见 `03-COLOR-STANDARD.md` §差异登记与 `04-TYPOGRAPHY-STANDARD.md` §4.3。

### 4.2.1 焦点环裁决（已定案，验证状态 `NOT_VERIFIED`）

| 口径来源 | 取值 | 5.0 判定 |
|---|---|---|
| 用户 PART 0 原则 A | 只规定「边框 1px」，**未规定焦点环宽度** | 不构成 `1px` 焦点环的依据 |
| 过时长期记忆（旧 `MEMORY.md`） | 「`1px` / `ring-1` 勿回 2px」作为**焦点环宽度** | **已作废**，不再作为焦点环可选基线；但**装饰性 `ring-1` 描边 1px 是真实有效值**，不承载焦点语义（3.0 §15.1 分类，07 分册按 1px 登记），须原样保留、不得改成 2px；`1px` 边框（PART 0 原则 A）亦保留，不得把全文「1px」无差别替换 |
| 运行时真值 | `tokens/semantic.css:120-123` 的 `--ds-focus-ring-width: 2px`（2026-11-13 代码变更） | **5.0 采用**；运行时代码本身已是 2px，本轮不改任何代码值 |
| 历史版本 3.0 §15.1 | 恒 `2px` / `ring-2` | 与运行时一致，佐证裁决 |
| **5.0 裁决结论** | `2px` / `ring-2` / `--ds-focus-ring-width: 2px` | **统一采用**；装饰性描边仍为 1px |

裁决依据：`AGENTS.md` §「Design System Enforcement」——「文档与实现冲突时，设计数值来自代码（`tokens/`、`theme.css`），规则与边界来自规范」。原生元素兜底与组件层 `focus-visible:ring-2` 同读 `--ds-focus-ring-width`，全站仍只有一档（`UDS5-S02` §5.6）。

> 状态说明：口径**已裁决定案**；运行时代码本身已是 `2px`，**本轮不改任何代码值，只改规范登记**。但本轮**未执行浏览器级守卫复核**（回归测试、组件层与原生兜底同步、视觉 / 无障碍验收均未跑），故 `验证状态` 仍为 `NOT_VERIFIED`，不得据裁决宣称已验证。装饰性 `ring-1` 描边 1px 与 `1px` 边框均为真实有效值，原样保留。原任务书「品牌基线（必须保留）…焦点环 1px」一条以本裁决为准，**仅作历史记录保留，不再作为现行基线**。

---

## 5. Clerk 参考原则

| # | 原则 | 依据 | 5.0 落地 |
|---|---|---|---|
| C1 | 只借鉴「分层定制」理念 | `CLERK-DESIGN-REFERENCE-ANALYSIS` §2.23：Themes → variables → BYO CSS → 自建 UI 四层 | 建立 §6 五层架构；禁止引入 `appearance` 式全局覆写 |
| C2 | 不引入 Clerk 运行时 | Elements 已随 Clerk Core 3（2026-03-03）弃用，推荐 redesigned hooks；`localization` 仍为 Experimental | 不引入 Clerk SDK / `@clerk/ui` / `@clerk/elements` / Storybook |
| C3 | 不把 Clerk 不具备的能力写成官方能力 | 官方未提供 Data Table / Charts / DatePicker / FileUpload / Toast 通用规范 / Drawer / Empty State 等 11 类能力 | 这类组件全部由 Uter 自有规范定义 |
| C4 | 严格限视觉 | `CLERK-DESIGN-REFERENCE-ANALYSIS` §2.17–2.19：认证 / 用户 / 组织管理仅参考信息架构与视觉密度 | 不替换 Uter 自建认证、`(auth)/` 9 路由、Casbin 权限、`org_role` / `sub_quota_limit` / `EnforceOrgQuota` |
| C5 | 不照搬品牌与数值 | 官方 Variables 文档已公布 24 个主题变量与默认值（`borderRadius 0.375rem`、`spacing 1rem`、`fontSize 0.8125rem`=13px、`fontWeight {400,500,600,700}`、`colorPrimary` 示例值 `#6c47ff`），但默认 `fontFamily` 为 `inherit`、未公布品牌字体族（Geist/Suisse/Inter 由 Clerk 自有 CSS 注入）与完整色阶 hex；Uter 不采用其 13px 基准（详见 `CLERK-DESIGN-REFERENCE-ANALYSIS` §2.4 / §2.5） | 保留 14/22 正文基线；只采纳「按钮字体可独立配置」理念到 `--ds-font-*` |
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
| 缺失字段（相对上级 PART 3.4） | `layer` / `source` / `implementation_path` / `specification_path` / `test_path` / `story_path` / `variants` / 顶层 `states` / 顶层 `accessibility` / `deprecated` / `replacement` 全部缺失，须由生成式 YAML 投影合并，JSON 仍为唯一真源 |
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
| `web/scripts/visual-regression.mjs`（`test:visual`） | showcase 像素基线（本地专用） | `test:visual` 已接入 `:422`；E2E 双轨刻意不接 CI |
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
| Clerk 官方文档 | 仅参考分层定制理念与信息架构；不引入运行时依赖、不照搬品牌 |

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
| 测试 | `web/src/design-system/__tests__/`（10 个守卫测试）、`web/e2e/{axe,business,visual}/` |
| 视觉标本 | `docs/design-system/showcase.html`、`showcase.tokens.js` |

## 自动化验证

| 脚本 / 命令（真实存在） | 归属 |
|---|---|
| `web/scripts/check-design-tokens.mjs`（`bun run lint:design:strict`） | T1–T17 Token 门禁 |
| `web/scripts/generate-design-tokens.mjs`（`bun run design:tokens:check`） | DTCG 同步 |
| `web/scripts/sync-design-showcase.mjs`（`bun run design:showcase:check`） | 17 条 Manifest 校验 |
| `web/scripts/verify-contrast.mjs`（`bun run verify:contrast`） | 对比度与 E28 |
| `web/scripts/check-component-registry.mjs`（`bun run components:registry:check`） | 组件注册一致性 |
| `web/scripts/visual-regression.mjs`（`bun run test:visual`） | showcase 像素基线（本地专用） |
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
