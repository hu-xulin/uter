# UDS 8.0.0 全面合规检查报告

> 检查编号 `UDS8-AUDIT-2026-11-24` · 设计系统 UTER DESIGN SYSTEM 8.0.0 · 检查时间 2026-11-24 15:18–15:33 (GMT+8)
> 检查 HEAD `33def7a5a` · 分支 `main` · 权威来源 `AGENTS.md` §1 → `docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md`
> 本报告全部结论来自真实命令退出码、磁盘产物与源码抽查；未执行项如实标记，不以文档存在替代运行证据。

---

## 0. 检查结论（先看这里）

**总判定：PARTIALLY_VERIFIED（实现层合规，验收层未关闭）。**

UDS 8.0.0 的自动化门禁层与 Token 派生链**全部通过**：22 项设计系统检查 C01–C22 全 PASS、18 项设计令牌规则 T1–T18 在 1336 个前端文件上零违规、8 项设计相关门禁退出码均为 0。业务代码对规范的静态遵守度很高。

但"门禁全绿"不能等价为"规范每条都已满足"。逐条核对后，真实未关闭项集中在**验收状态层、证据时效层、组件证据层**，以及**3 处门禁未覆盖的手工可判定条款**。按可处置性分为三类：

| 类别 | 数量 | 处置方式 | 本次是否已动 |
|---|---|---|---|
| A. 可自动判定且通过 | 22(C)+18(T)+8(门禁)+7(注册表计数) | 无需修复，保留证据 | 证据已刷新 |
| B. 已经修复 | 1（验收证据过期） | 真实重跑生成器，可回滚 | ✅ 已修复 |
| C. 规范强制挂起，禁止 AI 改动 | 4（accepted=false、视觉审核、产品迁移、Git 历史清理） | 需项目所有者显式授权 | ⛔ 未动，附授权清单 |
| D. 已登记合规例外 | 4（EX-001~004） | 按失效条件复评 | 未动，状态如实 |
| E. 门禁未覆盖的代码层条款 | 3（Sidebar 宽度 220px、2 处金额缺 tabular-nums、OTP 激活环 1px） | 需先确认是否触碰 ADR-0002 保护的旧版运行时兼容边界 | ⚠️ 逐条列出，未擅改 |

**关键纪律声明**：依 `AGENTS.md` 与 `ADR-0002`，UDS 8.0.0 当前为 `ACCEPTANCE_READY` / `accepted=false`，UDS 3.0 runtime compatibility boundary 受保护，未经项目所有者显式授权不得迁移或改动既有运行时值。因此 C 类、E 类中涉及既有运行时视觉值的项**未被自动修改**，仅给出精确定位与修复方案。

---

## 1. 检查范围与方法

| 维度 | 权威文件 | 判定手段 |
|---|---|---|
| 仓库/前端规则 | `AGENTS.md`、`web/AGENTS.md` | 会话开始已通读 |
| 设计系统总纲/治理 | `00-UTER-DESIGN-SYSTEM-OVERVIEW.md`、`35-DESIGN-GOVERNANCE-STANDARD.md` | 通读 + 逐条对照 |
| 38 份规范硬性条款 | `00`–`35` + `24-S`/`01-S` 共 38 份 md | 只读代理逐份提取 §2 Rules / §11 Acceptance / §7 Do / §8 Don't |
| 设计系统产物一致性 | `check-design-system-8.0.0.mjs` | `bun run design:8:check --json` |
| 业务代码静态规则 | `check-design-tokens.mjs` | `bun run lint:design:strict` |
| Token 派生链 | `generate-design-tokens.mjs`、`sync-design-showcase.mjs` | `--check` 模式 |
| 组件/页面注册表 | `COMPONENT-REGISTRY.json`、`PAGE-REGISTRY.json` | `components:registry:check` |
| i18n / 版权 / 文档截图 | `check-i18n-keys.mjs`、`add-copyright.mjs`、`resolve-docs-screenshots.mjs` | `--check` 模式 |
| 无障碍 / 对比度 | `axe-audit.mjs`、`contrast-engine.mjs` | 读取真实日志 + 实时计算 |
| 代码层手工可判定条款 | `web/src` 业务组件 | 只读代理 + 主代理抽查，带文件:行号证据 |

工作树基线：检查开始时 `git status --short` 记录 15 处并发 WIP（`model/channel.go`、`setting/user_usable_group.go`、用户指南截图删除、`usage-logs/constants.ts` 等），**全部未触碰、未混入本次改动**。

---

## 2. 逐条表：设计系统产物检查 C01–C22

命令：`cd web && bun run design:8:check` → `VERDICT PASS · 22/22 checks · 0 errors`，EXIT=0。

| 编号 | 检查项 | 当前结果 | 实测证据（detail） | 判定 |
|---|---|---|---|---|
| C01 | TOKEN-MANIFEST 结构与 Token 唯一性 | PASS | 383 tokens, 3 layers | ✅ 满足 |
| C02 | 36 + 2 规范模块文件与唯一编号 | PASS | 36 numbered + 2 special, ids 00..35 | ✅ 满足 |
| C03 | 规范正文禁止占位词/未决表述/模糊数值 | PASS | 42 md scanned, 0 placeholder | ✅ 满足 |
| C04 | tokens.css 与 manifest Light 值逐项一致 | PASS | 383 declarations matched | ✅ 满足 |
| C05 | light.css / dark.css 覆盖全部主题相关 Token | PASS | 230 themed tokens × 2 | ✅ 满足 |
| C06 | tokens.ts 与 manifest 一致且无第二套数值 | PASS | 383 TS token entries | ✅ 满足 |
| C07 | Light/Dark 使用同名 Token，无主题特例缺失 | PASS | 230 themed, 153 theme-independent | ✅ 满足 |
| C08 | 7 份注册表存在且计数与真源一致 | PASS | 7 registries, 65 components, 76 routes, 38 modules | ✅ 满足 |
| C09 | contrast-engine 真实计算 VERDICT=PASS | PASS | 2002 gradient samples + 40 syntax + 16 text + 6 brand-solid, all ≥4.5:1 | ✅ 满足 |
| C10 | 20 个 Syntax Token 有 Light/Dark 定值 | PASS | 20 × 2 HEX values | ✅ 满足 |
| C11 | 全库渐变文字单一 owner | PASS | 1644 files scanned, 0 offenders | ✅ 满足 |
| C12 | Uter 字体体系逐字保留，未引入新字体 | PASS | font-ui + font-mono identical to theme.css:301-328 | ✅ 满足 |
| C13 | chart 色不得作 syntax 色，色系隔离 | PASS | 14 color groups isolated | ✅ 满足 |
| C14 | Showcase 覆盖 38 模块/全 Token/≥10 语言/零外链 | PASS | 38 modules, 18 languages, 914163 chars, 6 sections | ✅ 满足 |
| C15 | 状态未被误标 VERIFIED/ACCEPTED | PASS | status=ACCEPTANCE_READY, ACCEPTED=false | ✅ 满足（且刻意保持 false） |
| C16 | 产物不出现 manifest 之外的 --ds-* 定义 | PASS | 383 declared = manifest 383 | ✅ 满足 |
| C17 | 交付报告齐全 | PASS | 3 份报告存在 | ✅ 满足 |
| C18 | 8 份机器可读验证报告齐全且 verdict 真实 | PASS | 8 reports, final=PARTIALLY_VERIFIED, checker=22/22 | ✅ 满足 |
| C19 | 语法 Adapter 15 语言/20 Token，如实登记未覆盖 | PASS | 15 languages, 29 grammars, 19/20 covered | ⚠️ 满足但见 §7 例外 |
| C20 | 旧版本设计系统描述/引用/资产零残留 | PASS | 3094 files scanned, 0 legacy references | ✅ 满足 |
| C21 | 真实页面回归 + 渐变像素 + axe 零违规 | PASS | 8 real-page scenarios, axe 0 violations | ✅ 满足 |
| C22 | Clerk 外部参考边界零引入 | PASS | 1644 src files scanned, 0 Clerk references | ✅ 满足 |

---

## 3. 逐条表：业务代码设计令牌规则 T1–T18

命令：`cd web && bun run lint:design:strict` → `通过。扫描 1336 个文件`，EXIT=0。baseline `web/design-tokens.baseline.json` 的 `entries` 为空（零豁免）。

| 编号 | 规则 | 违规数 | 判定 |
|---|---|---|---|
| T1 | 字号阶梯重复声明（--text-* 唯一来源） | 0 | ✅ 满足 |
| T2 | 任意字号工具类（text-[…px]） | 0 | ✅ 满足 |
| T3 | 裸色值整数类 | 0 | ✅ 满足 |
| T4 | 内联字号数值（fontSize: N） | 0 | ✅ 满足 |
| T5 | CSS 硬编码字号（font-size: Npx） | 0 | ✅ 满足 |
| T6 | 非浮层投影（弹窗/浮层除外，规范允许 20 处） | 0 | ✅ 满足 |
| T7 | 调色板直用颜色（未走语义 Token） | 0 | ✅ 满足 |
| T8 | Token 定义处裸色值（638 处属颜色落点，不计违规） | 0 | ✅ 满足 |
| T9 | 行高覆盖（leading-*，由字号 Token 自带） | 0 | ✅ 满足 |
| T10 | 任意圆角（rounded-[…]） | 0 | ✅ 满足 |
| T11 | 未登记动效节奏（duration-N / ease-[…]） | 0 | ✅ 满足 |
| T12 | 字距类（tracking-*，统一移除） | 0 | ✅ 满足 |
| T13 | 透明度冒充文字层级（text-foreground/NN） | 0 | ✅ 满足 |
| T14 | 透明度凑悬停（hover:bg-*/NN） | 0 | ✅ 满足 |
| T15 | 透明度凑浅底（bg-success/warning/info /NN） | 0 | ✅ 满足 |
| T16 | 低于最小字号（全站下限 12px） | 0 | ✅ 满足 |
| T17 | 任意间距（p-/m-/gap-[…]） | 0 | ✅ 满足 |
| T18 | 文本变量未标注类型（text-[var(--…)] 按颜色解析） | 0 | ✅ 满足 |

---

## 4. 逐条表：CI Gate 与设计相关门禁

| 命令 | 退出码 | 证据摘要 | 判定 |
|---|---|---|---|
| `bun run design:8:check` | 0 | 22/22 PASS | ✅ 满足 |
| `bun run lint:design:strict` | 0 | 1336 文件零违规 | ✅ 满足 |
| `bun run design:tokens:check` | 0 | source and generated CSS in sync | ✅ 满足 |
| `bun run design:showcase:check` | 0 | 914163 chars 同步 | ✅ 满足 |
| `bun run components:registry:check` | 0 | 结构/文件清单有效，65 组件；24+ WARN 见 §6 | ⚠️ 退出 0 但有证据 WARN |
| `bun run i18n:check` | 0 | 7918 静态键 + 701 登记键，7 语言包齐全 | ✅ 满足 |
| `bun run copyright:check` | 0 | 1665 checked, added 0 | ✅ 满足 |
| `bun run docs:assets:check` | 0 | 686 截图标签全部解析 | ✅ 满足 |
| `bun run lint`（oxlint+i18n） | 0 | 无违规 | ✅ 满足 |
| `bun run typecheck` | **1** | `usage-logs/.../log-type-filter.test.tsx` 两个未使用导入 | ⚠️ 并发 WIP 所致，非本次范围 |
| `bun run format:check` | **1** | 9 个文件（channels + usage-logs 测试）格式问题 | ⚠️ 多为既有提交 `2fbbe4d43`，非本次范围 |

> typecheck / format 失败项均经 `git status` + `git log` 溯源：失败文件分属未提交 WIP（`log-type-filter.test.tsx`）与 2026-11-24 既有提交 `2fbbe4d43`，**与 UDS 8.0.0 设计规范无关，且不得混入本次改动**。如实记录为环境状态，不判定为设计规范违反。

---

## 5. 逐条表：38 份规范模块登记状态

全部 38 份模块 `implementation=IMPLEMENTED`、`verification=PARTIAL`，`outstanding` 一致为「真实产品页面迁移（Phase 6）」与「全站视觉回归（Phase 8）」。此为规范刻意状态（对齐 C15），不是缺陷。

| 模块 | 规范 | 实施 | 验证 | 检查数 | 未决项 |
|---|---|---|---|---|---|
| 00 | Design System Overview | IMPLEMENTED | PARTIAL | 6 | Phase 6 / Phase 8 |
| 01 | Brand Identity Standard | IMPLEMENTED | PARTIAL | 6 | Phase 6 / Phase 8 |
| 02 | Design Principles Standard | IMPLEMENTED | PARTIAL | 5 | Phase 6 / Phase 8 |
| 03 | Color System Standard | IMPLEMENTED | PARTIAL | 6 | Phase 6 / Phase 8 |
| 04 | Typography Standard | IMPLEMENTED | PARTIAL | 6 | Phase 6 / Phase 8 |
| 05 | Spacing and Sizing Standard | IMPLEMENTED | PARTIAL | 6 | Phase 6 / Phase 8 |
| 06 | Layout and Grid Standard | IMPLEMENTED | PARTIAL | 5 | Phase 6 / Phase 8 |
| 07 | Shape and Radius Standard | IMPLEMENTED | PARTIAL | 5 | Phase 6 / Phase 8 |
| 08 | Border and Divider Standard | IMPLEMENTED | PARTIAL | 5 | Phase 6 / Phase 8 |
| 09 | Elevation and Shadow Standard | IMPLEMENTED | PARTIAL | 5 | Phase 6 / Phase 8 |
| 10 | Iconography Standard | IMPLEMENTED | PARTIAL | 5 | Phase 6 / Phase 8 |
| 11 | Motion and Animation Standard | IMPLEMENTED | PARTIAL | 6 | Phase 6 / Phase 8 |
| 12 | Responsive Design Standard | IMPLEMENTED | PARTIAL | 6 | Phase 6 / Phase 8 |
| 13 | Accessibility Standard | IMPLEMENTED | PARTIAL | 6 | Phase 6 / Phase 8 |
| 14 | Content and Writing Standard | IMPLEMENTED | PARTIAL | 5 | Phase 6 / Phase 8 |
| 15 | Data Visualization Standard | IMPLEMENTED | PARTIAL | 6 | Phase 6 / Phase 8 |
| 16 | Density and Info Hierarchy Standard | IMPLEMENTED | PARTIAL | 5 | Phase 6 / Phase 8 |
| 17 | Navigation Standard | IMPLEMENTED | PARTIAL | 5 | Phase 6 / Phase 8 |
| 18 | Button Standard | IMPLEMENTED | PARTIAL | 5 | Phase 6 / Phase 8 |
| 19 | Form and Input Standard | IMPLEMENTED | PARTIAL | 5 | Phase 6 / Phase 8 |
| 20 | Selection Controls Standard | IMPLEMENTED | PARTIAL | 5 | Phase 6 / Phase 8 |
| 21 | Feedback and Status Standard | IMPLEMENTED | PARTIAL | 6 | Phase 6 / Phase 8 |
| 22 | Overlay and Floating Standard | IMPLEMENTED | PARTIAL | 5 | Phase 6 / Phase 8 |
| 23 | Data Display Standard | IMPLEMENTED | PARTIAL | 5 | Phase 6 / Phase 8 |
| 24 | Code and Developer UI Standard | IMPLEMENTED | PARTIAL | 7 | Phase 6 / Phase 8 |
| 24-S | Code Syntax Highlighting（专项） | IMPLEMENTED | PARTIAL | 6 | Phase 6 / Phase 8 |
| 25 | Authentication Standard | IMPLEMENTED | PARTIAL | 5 | Phase 6 / Phase 8 |
| 26 | User and Organization Standard | IMPLEMENTED | PARTIAL | 5 | Phase 6 / Phase 8 |
| 27 | Billing and Payments Standard | IMPLEMENTED | PARTIAL | 6 | Phase 6 / Phase 8 |
| 28 | API and Token Management Standard | IMPLEMENTED | PARTIAL | 5 | Phase 6 / Phase 8 |
| 29 | Model and Channel Management Standard | IMPLEMENTED | PARTIAL | 5 | Phase 6 / Phase 8 |
| 30 | Dashboard Standard | IMPLEMENTED | PARTIAL | 5 | Phase 6 / Phase 8 |
| 31 | Page Templates Standard | IMPLEMENTED | PARTIAL | 6 | Phase 6 / Phase 8 |
| 32 | Empty, Loading and Error Standard | IMPLEMENTED | PARTIAL | 5 | Phase 6 / Phase 8 |
| 33 | Localization Standard | IMPLEMENTED | PARTIAL | 6 | Phase 6 / Phase 8 |
| 34 | Cross-Platform Design Standard | IMPLEMENTED | PARTIAL | 5 | Phase 6 / Phase 8 |
| 35 | Design Governance Standard | IMPLEMENTED | PARTIAL | 6 | Phase 6 / Phase 8 |
| 01-S | Gradient Typography（专项） | IMPLEMENTED | PARTIAL | 6 | Phase 6 / Phase 8 |

---

## 6. 逐条表：验收状态层 / 证据层 / 组件证据层缺口

| 编号 | 条款来源 | 规范要求 | 当前实测 | 判定 | 处置 |
|---|---|---|---|---|---|
| A-01 | `00` §11 / `35` §9 / UAP README §6 | 状态四级严格区分；ACCEPTED 只能用户显式给出 | `status=ACCEPTANCE_READY`、`accepted=false`、`visual=PENDING_USER_REVIEW` | ⛔ 未满足"最终接受"，但**符合规范纪律** | 需用户审核 Showcase 与视觉基线后显式授权，AI 不得改 |
| A-02 | `00` §11 / `UDS-8.0.0-…REPORT` §20 | 产品迁移 Phase 6 需视觉冻结后启动 | `产品迁移=NOT_STARTED` | ⛔ 挂起 | 需项目所有者授权迁移范围/目标 HEAD/验收条件（见 ADR-0002） |
| A-03 | `UDS-8.0.0-…REPORT` §20–21 | 视觉 track 2 基线 26 张差异需人工批准，禁止自动覆盖 | `web/e2e/visual/__screenshots__` 保持原基线，26 张待批 | ⛔ 挂起 | 需人工逐张审核，不得脚本覆盖 |
| A-04 | UAP README §6 | Git 历史对象级旧版清除需单独授权 | 仅清理工作树，未重写历史 | ⛔ 挂起 | 需显式授权重写历史 |
| B-01 | `35` Rule 9 / UAP README §6 | 验收报告必须绑定当前 HEAD；历史报告不代表当前 HEAD | **发现缺口**：检查前 `GATE-EVIDENCE.json` 生成于 2026-11-16，记 389 tokens/943134 chars/2952 files，与当前 HEAD 的 383/914163/3094 不符 | ✅ **已修复** | 真实重跑 `finalize.mjs`（checker/adapter/contrast 全实算），刷新至 2026-11-24；复验 design:8:check 仍 22/22 EXIT=0 |
| C-01 | `35` Rule 4 / `components:registry:check` | 65 组件 evidence 应逐一 VERIFIED | 65 组件中 **0 个 VERIFIED**：web 侧 56 `NOT_VERIFIED` + 9 `PARTIAL`；docs 侧 65 个状态计数为 0 | ⚠️ 未满足（WARN，非 error） | strict 模式 EXIT=1；需为每个组件补真实测试/manual review 证据，不得批量标记 VERIFIED 换 PASS |
| C-02 | `35` Rule 4 | 8 基础状态登记到 ACCEPTANCE-MATRIX | docs 侧 65 组件均登记 8 状态；web 侧实现契约仅 1/3/4 状态 | ⚠️ 部分满足 | 实现契约状态少于规范登记，属描述粒度差异，需人工确认是否补齐 |

---

## 7. 逐条表：已登记合规例外与覆盖缺口

| 编号 | 范围 | 原因 | 失效条件 | 状态 | 判定 |
|---|---|---|---|---|---|
| EX-001 | WCAG 1.4.3 disabled controls | WCAG 明确豁免禁用控件 | 控件恢复可用时 | ALLOWED | ✅ 合规例外 |
| EX-002 | PAGE-REGISTRY ROUTE_NOT_FOUND 模板 | 文档列出但仓库无独立路由 | 对应路由被真实创建时 | OPEN | ⚠️ 开放例外，按条件复评 |
| EX-003 | Android/iOS/HarmonyOS 未实现 | 仓库无原生工程源码 | 原生工程入库时 | OPEN | ⚠️ 开放例外，与 ADR-0002 一致 |
| EX-004 | RTL 未支持 | 本版只覆盖 zh-CN/en LTR | 新增 RTL locale 时 | OPEN | ⚠️ 开放例外 |
| C19-GAP | 语法 Token `invalid` 未被样本覆盖 | 15 语言/29 grammar 中 19/20 Token 被真实样本命中 | — | 已登记 | ✅ 规范 C19 允许"如实登记未覆盖项" |

---

## 8. 逐条表：门禁未覆盖的代码层手工可判定条款

来源：只读代理 + 主代理抽查 `web/src`，带文件:行号证据。这些条款不在 T1–T18 静态规则内，需人工判定。

| 编号 | 规范条款 | 实测证据 | 判定 | 处置建议 |
|---|---|---|---|---|
| M-01 | `06` Rule 3 / `17` Rule 2：Sidebar 展开 **240px**、收起 **64px** | `web/src/components/ui/sidebar.tsx:50` `SIDEBAR_WIDTH='13.75rem' // 220px`；`:52` `SIDEBAR_WIDTH_ICON='2.75rem'`（44px）；主导航经 `app-sidebar.tsx` 使用 | ⚠️ **实测违反**（220≠240、44≠64） | 涉及 ADR-0002 保护的旧版运行时兼容边界与冻结视觉基线（VISUAL-BASELINE frozen_at 2026-11-16），改动会触发 26 张待批差异扩大。**需所有者授权后**改常量并补 `sidebar-layout.test.tsx`；本次未擅改 |
| M-02 | `27` Rule 1 / `23` Rule 3 / `30` Rule 49：金额强制 `tabular-nums` + `--ds-font-mono` | `web/src/features/wallet/components/dialogs/cn-pay-web-dialog.tsx:258,268` 金额 `<span className='font-semibold'>` 无 tabular-nums/mono（另有 1 处同类） | ⚠️ 实测缺 2–3 处 | 属金额展示条款，低视觉风险但会改渲染；需先写回归测试再补 `tabular-nums font-mono`，本次未擅改 |
| M-03 | `13` Rule 3 / `18` Rule 7：Focus Visible 焦点环 **2px + 2px offset** | button/input/textarea/select/switch/checkbox 均 `focus-visible:ring-2`（25 处），零 `focus-visible:ring-1`；`input-otp.tsx:74` 的 `ring-1` 是 `data-[active=true]` 激活态非焦点态 | ✅ 满足（OTP 激活环非焦点环，不计违反） | 无需修复 |
| M-04 | `04` Rule 9：代码/API Key/模型标识/Request ID 强制 `--ds-font-mono` | 实测 `text-mono`/`font-mono` 广泛使用（如 usage-logs/audit 列）；T 规则未覆盖但抽查命中 | ✅ 满足 | 无需修复 |
| M-05 | `06` Rule 3：桌面内容最大宽 **1440px** | `max-w-7xl`(1280px) 9 处、`max-w-[1280px]` 3 处用于内容容器；未见 `max-w-[1440px]` | ⚠️ 需人工确认 | 规范同时定义 1440 为上限；1280 容器未超上限，属内容宽度选择而非违反。列为待确认 |
| M-06 | `07` 圆角九档 / `08` 边框 | T10 零违规；抽查 `rounded-2xl`/`rounded-lg` 等均为登记档 | ✅ 满足 | 无需修复 |
| M-07 | 裸 #HEX 直用（T7/T8） | 业务 tsx 命中 35 处：绝大部分为注释（如 `badge.tsx:43`、`discount-badge.tsx:42`）与品牌 SVG 原生色（`icon-*.tsx`），非界面裸色值 | ✅ 合规（注释/品牌资产不属界面 token 违规） | 无需修复 |
| M-08 | 渐变文字单一出口（`01-S`） | `shimmer.tsx` 用 `ds-text-shimmer` 出口，不含 `linear-gradient` 手写；C11 判定 0 offenders | ✅ 满足 | 无需修复 |

---

## 9. 本次已执行的修复（可回滚）

**修复项 B-01：验收证据过期。**

- 问题：`GATE-EVIDENCE.json` 等 8 份机器可读报告停留在 2026-11-16 快照，数值（389 tokens / 943134 chars / 2952 files）与当前 HEAD 实测（383 / 914163 / 3094）不一致，违反 `35` Rule 9 与 UAP README §6「历史报告不代表当前 HEAD」。
- 动作：先备份并发 WIP 文件 `audit/syntax-validation.json` 至 `/tmp/uds8-syntax-validation.WIP.bak`，真实执行 `node docs/design-system/registry/finalize.mjs`（内部真实调用 checker `--json`、syntax-adapter、contrast-engine），再恢复 WIP 文件。全程未伪造任何 verdict。
- 结果：`finalize: checker=PASS(22/22), visual=PASS, a11y=PASS, real-pages=PASS, contrast=PASS`；`GATE-EVIDENCE.json.generated_at` 更新为 `2026-11-24T07:32:38.718Z`，`legacy_scan=3094 files scanned`。
- 复验：重跑 `bun run design:8:check` → EXIT=0，22/22 PASS。
- 变更文件（均 git-tracked，可 `git checkout` 回滚）：

| 文件 | 变化 |
|---|---|
| `docs/design-system/GATE-EVIDENCE.json` | 时间戳与统计刷新 |
| `docs/design-system/VISUAL-REGRESSION-REPORT.md` | 生成时间刷新 |
| `docs/design-system/audit/{accessibility,contrast,final-acceptance,gradient,token,visual-regression}-validation.json` | 时间戳刷新，verdict 保持真实 |

> 未触碰：`audit/syntax-validation.json` 的并发 WIP（检查开始时其 generated_at 已被并发会话改为 07:21），已原样保留。

---

## 10. 需项目所有者授权的事项清单（AI 不得自行执行）

| 序号 | 事项 | 依据 | 授权后动作 |
|---|---|---|---|
| 1 | 视觉审核并批准 UDS 8.0.0 视觉基线（含 26 张 track 2 差异） | `00` §11、`REPORT` §21 | 人工逐张审核；批准后方可更新基线 |
| 2 | 显式给出 `accepted=true` | `35` Rule 9、C15 | 用户确认后由治理流程写入，AI 不代写 |
| 3 | 授权 Phase 6 产品迁移（范围/目标 HEAD/验收条件） | ADR-0002、`REPORT` §20 | 真实消费者盘点 + 行为/视觉/兼容回归后迁移 |
| 4 | 确认是否将 Sidebar 220px/44px 收敛到规范 240px/64px（M-01） | `06`/`17` Rule 3 vs 兼容边界 | 授权后改常量 + 补回归测试 + 重跑视觉回归 |
| 5 | 确认金额 `tabular-nums`/mono 补齐（M-02） | `27`/`23`/`30` | 授权后补测试与 class 并重跑门禁 |
| 6 | 如需 Git 历史对象级清除旧版引用 | UAP README §6、`REPORT` §21 | 单独授权重写历史 |

---

## 11. 验收状态判定（UAP §7 口径）

- 设计系统产物一致性：**FULLY_VERIFIED**（C01–C22 真实命令 EXIT=0，可回滚证据已刷新）。
- 业务代码静态规范遵守：**FULLY_VERIFIED**（T1–T18 零违规，baseline 0 豁免）。
- CI Gate 设计相关项：**FULLY_VERIFIED**（8 项 EXIT=0）；全局 typecheck/format 因并发 WIP 失败，记 **BLOCKED（非设计范围）**。
- 验收最终状态：**PARTIALLY_VERIFIED**（A-01~A-04 挂起，accepted=false）。
- 代码层手工条款：**PARTIALLY_VERIFIED**（M-01/M-02 待授权，M-03~M-08 满足）。

> 本报告不宣称 PASS 或 FULLY_OPERATIONAL 的整体设计系统最终接受；UDS 8.0.0 仍为 `ACCEPTANCE_READY`、`accepted=false`。

---

*生成方式：本报告由真实命令退出码、磁盘产物与源码抽查汇编；证据文件路径见各节。禁止以本报告替代用户人工视觉审核或迁移授权。*
