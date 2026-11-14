# DESIGN-SYSTEM-CHANGELOG — 设计系统变更日志

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S26` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01` |
| 生效日期 | `2026-11-14` |
| 适用范围 | UTER Design System 3.0 → 5.0 的版本演进记录；规范、Token、组件、页面、工程、平台的事实性变更台账 |
| 验证状态 | `NOT_VERIFIED`（本轮仅撰写变更日志，未执行版本变更与验证） |

---

## 1. 记录原则

1. **只记事实，不虚构 commit SHA**：本日志不转录、不编造任何 commit SHA / 分支操作记录；审计基线 HEAD 见 `UDS5-AUDIT-01` 头部，本日志不引用其具体值。
2. **证据来源逐条标注 `BASELINE-AUDIT.md`（`UDS5-AUDIT-01`）章节号**；凡审计报告未逐字记载的日期或事件，明确注明来源边界，不伪装为审计结论。
3. **五类动作固定口径**：`新增` / `继承` / `合并` / `废弃` / `待办`，每个时间节点均逐条列出。
4. 3.0 全文作为**历史版本完整保留**，不删除、不改写；本日志不宣称 3.0 已 `FULLY_IMPLEMENTED_AND_VERIFIED`。
5. 所有「已 / 已验证」类结论均以审计只读实测为准；未执行项标 `NOT_VERIFIED` / `NOT_EXECUTED`。

---

## 2. 时间线总览

| 日期 (GMT+8) | 里程碑 | 关键事实 | 证据来源 |
|---|---|---|---|
| 2026-11-03 | 3.0 定版（基线快照） | `docs/design-system/audit/evidence/` 共 **16 个内容文件**（12:34–15:01），含逐路由 `05-pages.md`（194 行）与逐组件 `04-components.md`（141 行） | `UDS5-AUDIT-01` §3（既有审计证据行）、§3（证据时效） |
| 2026-11-12 | 域规范退役与 UAP 上线 | 仓库侧 UAP 体系（`.uap/README.md`、`.uap/config/*.yaml`、`permission-policy.yaml`）与并发会话写入 `.uap/evidence/` 的事实 | `UDS5-AUDIT-01` §1、§12、§13；**该具体日期由 5.0 立项时间线给定，审计报告未逐字记载该日期**（见 §4） |
| 2026-11-13 | 3.0 终版（197 KB） | `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md` **4,111 行 / 197,053 B**，16:54 最后更新；§0→§28 共 29 章；§28.5 TOKEN-MANIFEST `version 3.0.1` / `updated 2026-11-13` | `UDS5-AUDIT-01` §3、§3（Spec SSOT） |
| 2026-11-14 | 5.0 建立 | 基线审计（`UDS5-AUDIT-01`）、Clerk 参考核实（`UDS5-AUDIT-02`）、`docs/design-system/uter-design-system-5.0/` 规范体系建立 | `UDS5-AUDIT-01` 头部（审计日期 2026-11-14）、§9 决策 D1–D8、§14 |
| 2026-11-14 | 业务域蓝图合并 | 28 份业务域蓝图按维度择取并入 5.0：新增 `UDS5-S29`..`UDS5-S32` 四份业务域分册；13 份既有分册补入结构性规则与逐条差异登记；注册表补登 4 条 | §6.1 节点五（**本节点**） |

---

## 3. 节点一：2026-11-03 · 3.0 定版（基线快照）

| 动作 | 逐条内容 | 证据来源 |
|---|---|---|
| 新增 | 建立 `docs/design-system/audit/evidence/` 审计证据集（16 个内容文件）；逐路由 `05-pages.md`（194 行）、逐组件 `04-components.md`（141 行） | `UDS5-AUDIT-01` §3 |
| 新增 | 3.0 规范主体框架（§0 规范效力 → §28 Token Manifest，共 29 章） | `UDS5-AUDIT-01` §3 |
| 继承 | 品牌色全套（Light `#5B5EE6` / `#494CC7` / `#3F42B0`；Dark `#8B8DF5` / `#A1A3F7` / `#B7B8FA`）与 DTCG 真源 `source/brand.tokens.json` | `UDS5-AUDIT-01` §11.1 第 1 条 |
| 继承 | Inter Variable + Noto Sans SC Variable；正文 14/22、caption 12/18、长文本 16/26、最小 12px、H5 输入 ≥16px | `UDS5-AUDIT-01` §2（字体基线核实）、§11.1 第 2 条 |
| 继承 | 4pt 间距、1px 边框、圆角八档（5.0 纠正，3.0 早期自称七档）、2px 焦点环（`ring-2`，已裁决，取代 1px）、表面色差优先于重阴影 | `UDS5-AUDIT-01` §11.1 第 3 条（圆角/焦点环口径以 5.0 裁决为准） |
| 合并 | （本节点无合并动作记录） | `UDS5-AUDIT-01` §11.2 为 5.0 决定，非 11-03 事实 |
| 废弃 | （本节点无废弃动作记录） | — |
| 待办 | 证据 mtime（11-03）**早于** 3.0 终版（11-13），属基线快照、非 3.0 终版复核；不得直接作为 5.0 验收依据 | `UDS5-AUDIT-01` §3（证据时效） |
| 待办 | §22 验收清单在本阶段即已存在 73 个 `- [ ]`、0 个 `- [x]`（终版仍未勾选） | `UDS5-AUDIT-01` §3.1 |

---

## 4. 节点二：2026-11-12 · 域规范退役与 UAP 上线

> **来源边界声明**：该日期与「域规范退役 / UAP 上线」事件由 5.0 立项时间线给定；`BASELINE-AUDIT.md` 未逐字记载该具体日期，也未记录退役清单本身。本节仅关联审计报告中可核实的 UAP 侧事实，**不虚构 commit SHA、退役域规范文件名或迁移记录**。

| 动作 | 逐条内容 | 证据来源 |
|---|---|---|
| 新增 | UAP 体系进入项目：`.uap/README.md`、`.uap/config/*.yaml`（含 `permission-policy.yaml`）成为上游依据 | `UDS5-AUDIT-01` §3 头部「上游依据」列 |
| 新增 | 并发 UAP 会话持续写入 `.uap/evidence/`；审计开始时脏区 42 项，复查增至 211 项，其中 **152 项未跟踪文件位于 `.uap/`** | `UDS5-AUDIT-01` §1、§12 |
| 继承 | `AGENTS.md` / `CLAUDE.md` / `web/AGENTS.md` 的项目约定继续有效（尤其「不得在 `docs/` 新增文件，除非用户明确要求」`AGENTS.md:359`） | `UDS5-AUDIT-01` §3 头部、§9 D2 |
| 继承 | 权限策略：`branch_creation` / `branch_switch` / `force_push` / `destructive_git` 均为 `deny` | `UDS5-AUDIT-01` §1 第 4 条、§13 第 5 条 |
| 合并 | （本节点无审计可核实的合并动作） | — |
| 废弃 | 域规范退役（时间线事件）；**退役清单与具体文件未在审计报告中逐字列出，5.0 不在本日志虚构** | `UDS5-AUDIT-01` §1 / §12（仅 UAP 目录事实） |
| 待办 | 并发 WIP 属其他会话进行中工作：不读取其内容作为依据、不暂存、不提交、不覆盖 | `UDS5-AUDIT-01` §1 第 1–2 条 |
| 待办 | 12 个已脏文件禁止改动（含 `web/src/styles/theme.css`、`system-brand.tsx`、`quota-details-popover.tsx`、`search.tsx`、`api-keys-cells.tsx`、`e2e/visual/*` 6 个、`.uap/**` 全部） | `UDS5-AUDIT-01` §1 第 2 条 |
| 待办 | 不执行全量构建（`./rebuild-all.sh`、`bun run build:check`、`./scripts/verify-all.sh`）与 `./uap *` 写状态命令，改只读门禁验证 | `UDS5-AUDIT-01` §1 第 3 条、§13 |

---

## 5. 节点三：2026-11-13 · 3.0 终版（197 KB）

| 动作 | 逐条内容 | 证据来源 |
|---|---|---|
| 新增 | 3.0 终版定稿：**4,111 行 / 197,053 B**，16:54 最后更新；§0→§28 共 29 章 | `UDS5-AUDIT-01` §3 |
| 新增 | §19.5 T1–T17 静态扫描规则表、§26 例外台账、§28.5 机器可读 `TOKEN-MANIFEST`（`version 3.0.1`） | `UDS5-AUDIT-01` §3 |
| 新增 | 三层 Token 架构统计定格：14 个 CSS / 1,518 行 / 319 处定义 / 245 个唯一变量名 | `UDS5-AUDIT-01` §4.1 |
| 新增 | 派生产物：`showcase.html` 内联快照 + `showcase.tokens.js`（1,241 行兼容回退） | `UDS5-AUDIT-01` §3、§4.1 |
| 继承 | 组件单一实现根（65 个 `ui/` 组件）、`data-table/` 唯一表格封装、`component-registry.json` 双向一致性检查 | `UDS5-AUDIT-01` §11.1 第 6 条 |
| 继承 | T1–T17 门禁、`ALLOWLIST=[]`、基线只减不增、`--strict` 作为 CI 唯一阻断模式 | `UDS5-AUDIT-01` §11.1 第 5 条 |
| 继承 | `brand-colors.ts`（T8 唯一裸色值所有者）与 `chart-typography.ts`（T4 TS 镜像）两个收口文件 | `UDS5-AUDIT-01` §11.1 第 7 条 |
| 合并 | （本节点为定稿，不执行合并；合并决定属于 5.0，见 §6） | `UDS5-AUDIT-01` §11.2 |
| 废弃 | （本节点不执行删除；以下为终版中保留的 Pending / 例外登记，非已废弃） | `UDS5-AUDIT-01` §3.1、§11.4 |
| 待办 | §22 验收清单 **73 个 `- [ ]`、0 个 `- [x]`**，§22.1–22.5 全部未勾选 | `UDS5-AUDIT-01` §3.1 |
| 待办 | E24 残留缺陷：浅色溢价 **3.76:1**、深色折扣 **3.30:1** 低于 4.5:1；编号注销但缺陷须保持待修 | `UDS5-AUDIT-01` §3.1 |
| 待办 | E28 有意例外：首屏品牌渐变标题 2.54 / 2.72 / 3.96:1（B 类验收口径），不进 ALLOWLIST | `UDS5-AUDIT-01` §3.1 |
| 待办 | P1 Terminal ANSI 0–15 全色板未落地（早期 20 个 `...` 占位符）；P2 图表 text/axis/label/grid 独立 Token 未定义；P3 `--ds-decor-*` 未纳入 `colors.decoration` | `UDS5-AUDIT-01` §3.1 |
| 待办 | 字体轴 `data-theme-font`（system/sans/serif）未落地；§13.1 定义的 PageHeader 尚无独立组件 | `UDS5-AUDIT-01` §3.1 |
| 待办 | 构建缺陷：`foundations/typography.css:55-66` 的 3 个纯别名在生产构建压缩后消失，靠 `var(--x, fallback)` 缓解，未根治 | `UDS5-AUDIT-01` §3.1 |
| 待办 | 组件证据：`VERIFIED 0` / `PARTIAL 9` / `NOT_VERIFIED 56`；`--strict` **EXIT=1** | `UDS5-AUDIT-01` §3.1、§5 |

---

## 6. 节点四：2026-11-14 · 5.0 建立

| 动作 | 逐条内容 | 证据来源 |
|---|---|---|
| 新增 | 基线审计 `audit/BASELINE-AUDIT.md`（`UDS5-AUDIT-01`）与 Clerk 参考核实 `audit/CLERK-DESIGN-REFERENCE-ANALYSIS.md`（`UDS5-AUDIT-02`） | `UDS5-AUDIT-01` 头部、`UDS5-AUDIT-02` 头部 |
| 新增 | `docs/design-system/uter-design-system-5.0/` 规范体系（`UDS5-S01`..`UDS5-S28`），构成对 `AGENTS.md:359` 的明确授权例外（决策 D2） | `UDS5-AUDIT-01` §9 D2 |
| 新增 | 8 项冲突决策 D1–D8（Adapt / Adopt / Reject / 分期） | `UDS5-AUDIT-01` §9 |
| 新增 | 5.0 五层架构 L1–L5、「规范 ↔ 代码 ↔ 注册 ID」双向关联、8 状态验收口径、废弃治理注册表机制（规范层） | `UDS5-AUDIT-01` §5.2 口径、`UDS5-S21`/`S23`/`S25`/`S28` |
| 继承 | 3.0 全文作为历史版本**完整保留**，不删除、不改写；品牌 / 字体 / 间距 / 三层 Token / 17 条 showcase 校验 / T1–T17 / 组件单一实现根全部继承 | `UDS5-AUDIT-01` §11.1 第 8 条、§11.1 第 1–7 条 |
| 继承 | 3.0 §22 的 73 项未勾选状态**不得**被继承为「已通过」；E24 / P1–P3 / 字体轴 / PageHeader 继承为 5.0 待办 | `UDS5-AUDIT-01` §11.4 第 2 / 4 条 |
| 合并 | 3 处同名 `EmptyState` → 统一到 `components/empty-state.tsx`（决定，未执行） | `UDS5-AUDIT-01` §11.2 第 1 条 |
| 合并 | `theme.css` / `theme-presets.css` 的 52 个同名基础调色板 → 单一 `:root` 基础层 + 预设只列差异键（决定，未执行） | `UDS5-AUDIT-01` §11.2 第 2 条、§4.1 |
| 合并 | `tokens/typography.css`（值）与 `foundations/typography.css`（工具类）→ 补「L1 声明 ↔ L3 消费」机器可校验映射表（决定，未执行） | `UDS5-AUDIT-01` §11.2 第 3 条 |
| 合并 | `showcase.tokens.js` 兼容回退与内联快照 → 统一「主交付=内联快照，回退=可选产物」（须先同步 17 条校验契约） | `UDS5-AUDIT-01` §11.2 第 4 条 |
| 合并 | 组件注册表「契约 + 证据」模型 与 5.0「路径 / 文档 / 展示」模型 → 生成式 YAML 投影合并，JSON 仍为唯一真源 | `UDS5-AUDIT-01` §11.2 第 5 条 |
| 废弃 | 列候选、不删除：约 93 个零静态引用 Token 中的 `primitives.css` 字号 / 行高 / 间距三组（25 个） | `UDS5-AUDIT-01` §11.4 第 1 条 |
| 修正 | `showcase-3.0.html` 退役更名 → `showcase.html`（`9a7234787` / `412f0a28b`），遗留引用已在 `visual-regression.mjs` / `tokens.test.ts` 修正（2026-11-14） | `UDS5-AUDIT-01` §11.4 第 3 条 |
| 废弃 | E24 / P1–P3 / 字体轴 / PageHeader 的「临时状态」→ 5.0 给出明确退出条件，未达成前保持 Pending | `UDS5-AUDIT-01` §11.4 第 4 条、`UDS5-S28` |
| 待办 | `component-registry.json` 的 `designSystem` 由 `3.0` 升级为 `5.0` 并同步 `check-component-registry.mjs:45` 硬编码校验（**必须同变更内完成，否则门禁失败**） | `UDS5-AUDIT-01` §11.3 第 4 条 |
| 待办 | 定位并根治 3 个纯别名构建消失问题；`dropdown-menu.test.tsx` 移入 `__tests__/` 并同步 `evidence.tests` | `UDS5-AUDIT-01` §11.3 第 1–2 条 |
| 待办 | `showcase.html` 增 Props / 注册 ID / 组件级 a11y / 状态切换面板；补齐区域 23、24 锚点；清理 2 个过时注释 | `UDS5-AUDIT-01` §11.3 第 3 条 |
| 待办 | Android / iOS / HarmonyOS 标 `NOT_VERIFIED`，不得用 Web 结果代替；`brand.tokens.json` 的 `status: DRAFT` 与 `decision: AUTO_BLOCKED` 待证据链齐备后变更 | `UDS5-AUDIT-01` §8、§9 D4、§11.4 第 5 条 |
| 待办 | 全量构建、视觉回归双轨、`test:axe`、`test:business:e2e`、`./uap validate --all`、原生平台验收标 `NOT_EXECUTED` / `NOT_VERIFIED` | `UDS5-AUDIT-01` §14 |

---

## 6.1 节点五：2026-11-14 · 业务域蓝图合并（28 份蓝图 → 5.0 增补）

> 本节点的输入是 `~/Downloads/UTER-Design-System-5.0/` 下 **28 份业务域蓝图**（`UTER-DS-00`..`27` + README）。**蓝图与仓库 5.0 是互补分解而非竞争版本**（蓝图按业务域切分，仓库按基础层切分），因此本节点的口径是「**按维度择取、不整体照搬**」。

| 动作 | 逐条内容 | 证据来源 |
|---|---|---|
| 新增 | **4 份业务域分册**：`AUTHENTICATION-COMPONENT-STANDARD.md`（`UDS5-S29`）、`USER-COMPONENT-STANDARD.md`（`UDS5-S30`）、`ORGANIZATION-AND-BILLING-COMPONENT-STANDARD.md`（`UDS5-S31`）、`COMMS-AND-LOCALIZATION-STANDARD.md`（`UDS5-S32`）—— 补齐**认证 / 用户与 API Key / 组织与账单 / 触达与本地化**四个此前无对应分册的维度 | 本节点 |
| 新增 | **注册表补登** `UDS5-S29`..`UDS5-S32` 四条（`category: business-vertical`），并补齐 `UDS5-S29` / `UDS5-S30` 的 `dependencies`（S11 / S14 / S15 等正文引用项） | `DESIGN-STANDARD-REGISTRY.yaml` |
| 继承 | **运行时真值优先**原则贯穿全部合并：蓝图在 8 个数值轴上与仓库冲突，一律**以仓库为准**并逐条登记（字号 11px↔12px、图标 7 档↔5 档、图标描边 1.75–2px↔恒 2px、动效 6 档↔14 档、圆角 9 档↔8+full、断点 480/1440↔640/1536、Button 7 档↔3+4+2 档、Input 5 档↔2 档） | `UDS5-S07` `S07-D8`/`S07-D9`、`UDS5-S08` `S08-D5`/`S08-D6`、`UDS5-S09` `S09-D5`、`UDS5-S02` `S02-D2`、`UDS5-S12` `S12-D9`、`UDS5-S14` `S14-D1`/`S14-D2`、`UDS5-S04` `S04-D2`/`S04-D3` |
| 合并 | **`UDS5-S07` z-index 分层**：蓝图 §4 的 8 档 scale 补齐仓库已登记缺口 `S07-D3`（运行时无专用 `--ds-z-*` Token）——补目标档 + 存量分布（`z-50` 30 处 / `z-100` 1 处 / 局部 `z-10` 35 处 / 图表绘制顺序豁免）+ 五步落地路径；**Token 未落地，状态仍 `NOT_VERIFIED`** | `UDS5-S07` §6.1–§6.4 |
| 合并 | **`UDS5-S03` 色彩**：补中性色 8 项与语义状态色 4 项的「蓝图建议 ↔ 运行时真值」逐值对照（4 项一致 / 3 项冲突 / 1 项不可映射 / 状态色 2 项一致 2 项冲突）；补表单交互九项出口核对与 `--fg-*` 前缀口径 | `UDS5-S03` §7.1–§7.4 |
| 合并 | **`UDS5-S11` 栅格**：蓝图 12/8/4 列与列间距 24/16/12 **与仓库 4px 阶梯零冲突**，整条采纳为规则；补页面框架尺寸对照（侧栏 240↔220、顶栏 64↔48、页面内边距无单一出口）与内容行长 60–90 字符 | `UDS5-S11` §4.1 / §4.2 |
| 合并 | **`UDS5-S13` 无障碍**：补 Reflow / 200% 缩放、拖拽非拖拽替代、live region 播报去重、平台语义优先级、「自动化 ≠ 完整验收」五节；**新登记 5 条缺口**（`S13-D8`..`S13-D12`），其中 `S13-D8`（Reflow 基准 320px vs 仓库最小断点 640px）为真实口径缺口 | `UDS5-S13` §3.13–§3.17 |
| 合并 | **`UDS5-S18` 表单**：补四阶段验证时机（V-1 输入中 / V-2 失焦 / V-3 提交 / V-4 服务端）、字段四要素与布局约束、异步验证竞态保护（A-1..A-5）、错误文案与提交细则（E-1..E-4） | `UDS5-S18` §3.1–§3.4 |
| 合并 | **`UDS5-S17` 交互**：补通用状态模型（元素类型分层）、状态一致性共享常量（ST-1..ST-4）、操作反馈分类、加载三规则、**空状态五类**（EM-1 首次为空 / EM-2 筛选无结果 / EM-3 权限不足 / EM-4 尚未配置 / EM-5 加载失败）、错误三要素 | `UDS5-S17` §10.1–§10.7 |
| 合并 | **`UDS5-S16` 页面与流程**：补列表 / 详情 / 创建编辑流程通则与**破坏性流程硬约束**（DP-1 三要素 / DP-2 确认按钮动作词 / DP-4 默认焦点 / DP-5 不得预先断言退款结果） | `UDS5-S16` §5.1.1–§5.1.6 |
| 合并 | **`UDS5-S12` 响应式**：补蓝图断点逐档对照（`bp.sm 480`↔640、`bp.2xl 1440`↔1536）、导航尺寸对照、窄屏表格禁止静默隐藏（RT-1..RT-5）、安全区与软键盘、**8 视口验收矩阵**（仓库仅 2 视口，缺口 6 档登记 `S12-D8`） | `UDS5-S12` §2.1 / §2.2 / §4.1–§4.3 |
| 合并 | **`UDS5-S02` 品牌标识**：补标识使用规则（BI-1..BI-8）、品牌命名规则（BN-1..BN-4）、图形语言（GL-1..GL-3）与品牌定位调性（1.7） | `UDS5-S02` §5.1–§5.3 / §1.7 |
| 合并 | **`UDS5-S14` 组件尺寸档**：蓝图 7 档 Button / 5 档 Input / 3 档 Switch / 6 档 Avatar ↔ 仓库真值逐项对照（Checkbox 16px、Radio 16px **一致**；其余四处冲突），并登记蓝图 Storybook 要求**不采纳**（仓库 D3 决定） | `UDS5-S14` §3.2.1–§3.2.4 |
| 合并 | **`UDS5-S15` 组件 API**：补 API 面验收清单（A-1..A-7 / B-1..B-6）与差异登记（`asChild` / polymorphic **不采纳**、codemod 无设施）；**同时修复该分册 §15 表格的历史字符错乱** | `UDS5-S15` §16 |
| 合并 | **`UDS5-S19` 数据展示**：补金额与计量单位 8 条规则（AM-1..AM-8）、**文案禁区 7 条**（CP-1..CP-7，不得先行断言支付成功 / 退款到账 / 额度恢复 / 密钥撤销）、文案长度与状态措辞 | `UDS5-S19` §4.3–§4.5 |
| 合并 | **`UDS5-S10` 主题**：补高对比与系统强制对比（`forced-colors` **未实现**，登记 `S10-D8`/`S10-D9`）与样式架构优先级（ST-1..ST-6；仓库 `!important` 12 处命中 / 实际生效 11 处经核查**均属基础重置与 Reduce Motion 降级**，组件层 0 处，**不判违规**） | `UDS5-S10` §8.1 / §9.1 |
| 合并 | **`UDS5-S04` 排版**：补蓝图 12 档字号 ↔ 仓库 18 档逐档对照、行高 ratio ↔ 绝对 px 表达法差异、字体栈差异（**Source Han Sans SC ≠ Noto Sans SC**）、字距蓝图建议**不采纳**（会引入 T12 违规） | `UDS5-S04` §7.1–§7.5 |
| 合并 | **`UDS5-S08` / `S09`**：图标 7 档↔5 档、描边 1.75–2px↔恒 2px、动效 6 档↔14 档差异逐条登记 | `UDS5-S08` `S08-D5`–`S08-D9`、`UDS5-S09` `S09-D5`–`S09-D8` |
| 合并 | **`UDS5-S23` 文档治理**：补**规范性语言 MUST / SHOULD / MAY** 四档定义与**文档状态机**（Draft / ACTIVE / DEPRECATED / ARCHIVED）、结构化信息须有机器可读来源、变更影响识别要求 | `UDS5-S23` §6.1 / §6.2 |
| 合并 | **`UDS5-S25` 验收**：补**十字段交叉验收矩阵**（Token / 组件 / 页面 / 视觉 / 响应式 / 主题 / 内容 / 国际化 / 安全 / 跨平台），10 维当前 **0 维达 `VERIFIED`** | `UDS5-S25` §3.7 |
| 废弃 | 蓝图的 **Storybook 要求**：不引入（仓库 D3 已决定用 `showcase.html` + 快照校验） | `UDS5-S14` `S14-D7`、`UDS5-S23` §1 |
| 废弃 | 蓝图的 **Clerk SDK 表述**：改写为「Uter 不集成 Clerk SDK；仅借鉴分步流程 / 字段级错误的信息架构理念」 | `UDS5-S29` `D-03` |
| 废弃 | 蓝图的 **短信能力**：仓库**无独立短信网关**（全仓 grep 0 命中），标 `NOT_IMPLEMENTED`，**不写 provider / 费率 / 模板 / 频次** | `UDS5-S32`（短信章节） |
| 修正 | **独立复核发现**：`common/constants.go:346-349` 后端订单状态为**四态**（含 `failed`），而前端 `web/src/features/wallet/types.ts:287` 的 `TopupStatus` 仅**三态**（缺 `'failed'`），`STATUS_CONFIG` 亦只映射三态——**失败订单落库后前端无对应状态分支**，属真实代码缺陷（须走 `UDS5-S01` §19 变更流程） | `UDS5-S31` `D-03`（team-lead 独立复核） |
| 补全 | **业务风险分级补齐**（蓝图总纲 §8）：`UDS5-S01` 新增 **§4A 业务风险分级（RISK 体系）**——三级定义（`RISK-P0` 支付/退款/余额/API Key 明文/权限提升/账户删除；`RISK-P1` 渠道启停/模型价格/限额/角色变更/批量；`RISK-P2` 偏好/筛选/排序/密度）+ **§4A.1 编号命名空间隔离**（`RISK-P*` 业务风险 vs 裸写 `P1`–`P3` 仓库待办优先级，同符号不同义）+ §4A.3 与既有 6 份分册的映射 + §4A.4 仓库现状；并回写 `S16` §5.1.5、`S29` §7、`S30` §5、`S31` §9.1 四处 `RISK-P0` 归属标注 | `UDS5-S01` §4A / §21；`UDS5-S16` §5.1.5；`UDS5-S29` §7；`UDS5-S30` §5；`UDS5-S31` §9.1 |
| 修正 | **守卫测试数量事实偏差**：`web/src/design-system/__tests__/` **实测 11 个**（第 11 个 `design-system-5-governance.test.ts` 为 5.0 建立时新增），而 `BASELINE-AUDIT` §12 / `CLERK-DESIGN-REFERENCE-ANALYSIS` §2.21 / 12 份分册均记 10 个——已统一修正 12 份分册的 19 处表述为 11 个；**两份审计报告保持原样**（历史基线快照），差异登记 `S13-D13` | `UDS5-S13` §4.1 / `S13-D13` |
| 修正 | **风险等级归属由「整节」改为「按条」**（teammate 独立复核驱动）：`UDS5-S01` §4A 新增 **§4A.3 按条目归属判据**（资金/凭据/权限/账户写操作 → `RISK-P0`；配置/额度/批量/状态写操作 → `RISK-P1`；纯展示只读 → `RISK-P2`），并修正 §4A.4 三处归属偏差（原 §4A.3 把 step-up / `TokenKeySecureVerificationRequired` / `CriticalRateLimit` 一并归入 `S29` §7，实测 `S29` §7 **不含** step-up 与 API Key 强验证——前者 scope 清单真源为 `service/security_verification.go:26-54`，后者归 `S30` §5）。`S29` §7 改为 13 条逐条分级（`RISK-P0` 6 条 / `RISK-P1` 2 条 / `RISK-P2` 5 条），`S30` §5 改为 13 条逐条分级（§5.1 掩码与明文边界 8 条全 `RISK-P0`；§5.2 展示与交互 5 条 = `RISK-P0` 1 / `RISK-P1` 1 / `RISK-P2` 3）、`S30` §6 新增「风险等级」列（11 条 = `RISK-P0` 1（U-6.11 额度调整）/ `RISK-P2` 10）、`S30` §7 新增「风险等级」列（10 条 = `RISK-P0` 5 / `RISK-P1` 3 / `RISK-P2` 2） | `UDS5-S01` §4A.3 / §4A.4；`UDS5-S29` §7；`UDS5-S30` §5 / §7 |
| 修正 | **差异编号体系统一**：四份新分册原用两套编号（`S29`/`S31` 用裸 `D-01`…`D-13`，`S30`/`S32` 用 `S30-D1`…`S32-D17`）——统一为 **`Sxx-Dxx` 两位数**形式（`S29-D01`…`S29-D13`、`S30-D01`…`S30-D12`、`S31-D01`…`S31-D13`、`S32-D01`…`S32-D17`），与 `UDS5-S28` §1「编号全局唯一」要求对齐；既有 20 份分册的单数字形式**保持原样**（历史编号不重写） | `UDS5-S29` §9、`UDS5-S30` §9、`UDS5-S31` §10、`UDS5-S32` §10 |
| 修正 | **`UDS5-S31` 悬空引用**：`§8.2` 订单状态表把前端缺 `failed` 态误登记为 `D-02`，实为 **`D-03`**（`D-02` 是「无退款路由」）——已更正为 `S31-D03` | `UDS5-S31` §8.2 |
| 修正 | **`UDS5-S31` 验证状态自相矛盾**：「门禁脚本」行原写「本轮未运行任何命令」，与同表上一行「已执行 `design:5:check` → PASS」矛盾——改为「本轮**仅执行** `design:5:check`（PASS）；`lint:design:strict` / `design:tokens:check` / `verify:contrast` / `components:registry:strict` **未运行**」；同时把 `standards: 36` / `registeredDocIds: 36` 更新为实测 `37` / `37`，并补齐 `dependencies` 描述（S13 / S14 / S15 / S24） | `UDS5-S31` §12 |
| 修正 | **`text-fg-primary` 为死类（真实代码缺陷，独立复核发现）**：`theme.css:550`（Light）与 `:749`（Dark）均声明 `--fg-primary`，但 `theme.css:183-188` 的 `--color-fg-*` 映射**只含 6 项**（`secondary` / `tertiary` / `disabled` / `link` / `placeholder` / `inverse`），**缺 `--color-fg-primary`**。Tailwind v4 未注册的 `--color-*` 不生成工具类——实测构建产物 `web/dist/static/css/index.51e0d1c6a1.css` 中 `.text-fg-primary` 计数为 **0**（对照 `.text-fg-secondary{color:var(--fg-secondary)}` 正常生成）。全仓 `web/src` 有 **12 处**使用 `text-fg-primary`（**基础类 8 处**——`features/about/about-viewer.tsx` 6 处 + `features/docs/native/page-nav.tsx` 1 处 + `features/docs/native/content-card.tsx` 1 处；**`hover:` 变体 4 处**——`about-viewer.tsx` 1 处 + `docs-toc.tsx` 1 处 + `docs-shell.tsx` 2 处），这些点的颜色声明**被静默丢弃**、回落到继承色。修复需在 `theme.css` 补 `--color-fg-primary: var(--fg-primary);` 一行并重建；本轮**不改代码** | `UDS5-S03` §8 `S03-D11` |
| 修正 | **管理员额度调整缺强验证（真实代码缺陷）**：`controller/user.go:1367` 的 `delete` 分支挂 `requireAdminUserProof(c, service.VerificationScopeAdminUserDelete, ...)`（`controller/secure_verification.go:149`），而同函数 `add_quota` 分支（`controller/user.go:1336-1338` → `controller/user_quota.go:13` `manageUserQuota`）**未挂任何 `requireAdminUserProof`**，也未见 `CriticalRateLimit`。按 §4A.2「余额变更」= `RISK-P0`，仓库实现未达该级（该端点**有**审计记录 `user.quota_add` / `user.quota_subtract` / `user.quota_override`，故审计维度满足 `RISK-P1`，缺的是强验证维度）。同一发现的两个视角分别登记于 `UDS5-S01` `S01-D6` 与 `UDS5-S30` `S30-D13`；本轮**不改代码** | `UDS5-S01` `S01-D6`；`UDS5-S30` `S30-D13` |
| 修正 | **`UDS5-S07` `S07-D6` 补齐宿主定位**：`z-60` → `web/src/components/ui/sidebar.tsx:211`（侧栏移动端抽屉浮层）；`z-999` → `web/src/components/skip-to-main.tsx:25`（跳过导航跳转按钮，须始终最上层可达）。两者均未映射到目标八档，落地 Token 时需决策归档 | `UDS5-S07` §10 `S07-D6` |
| 修正 | **负 z-index 缺口**（独立复核发现）：`web/src` 有 **3 处** `-z-10`（`features/home/components/sections/hero.tsx:83,87`、`cta.tsx:44`，均为 `ds-decor-mesh-*` / `ds-decor-grid` 装饰层置于内容之下），而 §6.2 目标八档（`base=0` 起）**无负值档**。新增 `S07-D10` 登记该分层缺口 | `UDS5-S07` §10 `S07-D10` |
| 核实 | **掩码位数口径无误（复核怀疑不成立）**：`MaskTokenKey`（`model/token.go:64-75`）在 `len>8` 时返回 4 + 10 + 4 = **18 位**；加 `sk-` 前缀（`api-keys-cells.tsx:58`）共 **21 字符**；密钥列宽实测 `size: 208`（`api-keys-columns.tsx:155`）。`UDS5-S30` U-5.11 表述**与代码一致**，已新增 `S30-D14` 记录「若有人主张 11 位，该主张不成立、不得据此改文档」。同时 U-5.10 补入 `MaskedValueTrigger`（`web/src/components/masked-value-display.tsx:30-42`）为首选复用源 | `UDS5-S30` U-5.10 / U-5.11 / `S30-D14` |
| 修正 | **`text-fg-primary` 死类的事实细节校正**（独立复核发现）：使用点精确分布为**基础类 8 处 + `hover:` 变体 4 处**（原记「6 + 5」有误）；且 Tailwind v4 由同一 `--color-*` 变量派生静态与 hover 两种变体，故**补 `--color-fg-primary: var(--fg-primary);` 一行可同时救活全部 12 处**，重建后须验证产物出现 `.text-fg-primary` 与 `.hover\:text-fg-primary` 两条规则 | `UDS5-S03` `S03-D11` |
| 登记 | **门禁脚本输出路径逃逸缺口**（独立复核发现）：`web/scripts/generate-design-showcase.mjs:53-56` 的 `path.resolve(WEB_ROOT, args[outIdx + 1])` 遇**绝对路径**即返回该路径本身，`--out /tmp/x.html` **不受 `WEB_ROOT` 约束**；`web/scripts/axe-audit.mjs:38-41` 更直接用 `args[i + 1]` 原值直用（连 `path.resolve` 都不做）。两处写入前均无路径白名单断言，可覆盖仓内任意文件。新增 §9.1 登记修复方向（showcase 限 `REPO_ROOT/docs/design-system/`；axe 限 `os.tmpdir()`）；本轮**不改代码** | `UDS5-S26` §9.1 |
| 修正 | **强验证 scope 行号修正**：独立复核实测 `service/security_verification.go` 的 scope 常量块为 `:26-54`（含 `:53` `admin.user.2fa.disable` 与 `:54` `admin.user.binding.clear`），原记 `:26-52` 漏两条——已在 4 处引用（`S01` §4A.4 两处 / `S29` §7 / `S30` §5）统一改为 `:26-54` | `UDS5-S01` §4A.4；`UDS5-S29` §7；`UDS5-S30` §5 |
| 修正 | **组织域成员权限 / 额度写操作缺强验证与审计留痕（真实代码缺陷，teammate 独立复核发现）**：`controller/organization.go` **全文**无 `requireAdminUserProof` / `CriticalRateLimit` / `VerificationScope` 任一调用；`UpdateOrganizationMember`（`router/api-router.go:230`，`orgAdminRoute.PUT /:id/members/:uid`）可**同时**写 `sub_quota_limit`（`:554`）与 `org_role`（`:560`），既无 step-up 强验证也无审计记录——对照同文件 `AddOrganizationMembers`（`:181`）走 `recordManageAuditFor(c, 0, "organization.member_add", ...)`（`:276`），**成员新增有审计而成员变更无**；`RemoveOrganizationMember`（`:603`，`router/api-router.go:231`）同理。按 §4A.2，角色提升属 `RISK-P0`、子额度上限变更属 `RISK-P1`（配置类写操作），仓库实现未达该级。与 `S01-D6` / `S30-D13`（平台超管 `add_quota` 分支）为**不同代码路径**，非重复登记。新增 `S31-D14` 登记；本轮**不改代码** | `UDS5-S31` §5.1 `OB-5.4` / §6.2 `OB-6.3` / §10 `S31-D14` |
| 补全 | **`UDS5-S30` §4 用户身份展示补风险等级列**（teammate 复核驱动）：§4 原 8 条（`U-4.1`–`U-4.8`）为纯展示只读规则，按 §4A.3 判据一律归 `RISK-P2`，逐条补入「风险等级」列；同时 `U-5.9`–`U-5.13` 的编号在表中显式化，消除 §5 与 §5.1 的编号重叠 | `UDS5-S30` §4 / §5 |
| 修正 | **`UDS5-S31` §5.1 裸写 `P0` 的命名空间歧义**：`§5.1` 风险归属导语原写「蓝图 §8 明列…为 P0」，按 `UDS5-S01` §4A.1 命名空间隔离（裸写 `P1`–`P3` = 仓库待办优先级，业务风险一律写 `RISK-*`），已改为「业务风险 P0 档〔本分册一律写作 `RISK-P0`〕」 | `UDS5-S31` §5.1 |
| 修正 | **`UDS5-S30` 表格单元格竖线转义**：§2 事实基线表「显示名优先级」行的 `display_name \|\| username` 未转义竖线，会导致 Markdown 表格被多切一列（渲染错位）；已改为 `\|\|` | `UDS5-S30` §2 |
| 修正 | **`UDS5-S30` 验证状态词自相矛盾**：§12「最终状态」原写 `FULLY_IMPLEMENTED`，与同节「用户组件域相关全部验证项均为 `NOT_VERIFIED` / `NOT_EXECUTED`」矛盾——已改为「最终状态**低于** `FULLY_IMPLEMENTED_AND_VERIFIED`」，并明确唯一例外是 `design:5:check` 注册表**结构**一致性检查（只读、不替代功能 / 视觉 / 平台验收结论） | `UDS5-S30` §12 |
| 修正 | **`MaskedValueTrigger` 实际渲染 12px 而非 13px（真实代码缺陷，teammate 复核发现 + team-lead 独立实测确认）**：`MaskedValueTrigger`（`web/src/components/masked-value-display.tsx:30-42`）以 `<Button size='sm'>` 渲染并叠加 `font-mono text-mono`，但 `Button` 的 `sm` 档自带 `text-xs`（`web/src/components/ui/button.tsx` size 档 `sm`），而**自定义 `text-mono` 不被 tailwind-merge 识别为字号类**——实测 `twMerge('text-xs text-mono')` 返回 `'text-xs text-mono'`（两者并存未合并），最终由**CSS 源码顺序**决定：`web/dist/static/css/index.51e0d1c6a1.css` 中 `.text-mono` 偏移 107303、`.text-xs` 偏移 108148（**更靠后**，同在 `@layer utilities` 同层同特异性）→ **`text-xs`（12px）胜出**，`--text-mono`（13px）被静默覆盖。对照 `web/src/components/ui/input.tsx:65-69` 的既有正确做法（字号档与字形族拆开指定，只用 tailwind-merge 认可的字号类）。`UDS5-S30` U-5.10 / U-5.11 已按实测口径改写（U-5.11 给出 14px / 13px / 实际 12px 三档估算，208px 列宽下限结论不变）；新增 `S30-D15` 登记；本轮**不改代码** | `UDS5-S30` U-5.10 / U-5.11 / `S30-D15` |
| 修正 | **`text-fg-primary` 使用点分布口径校正**：CHANGELOG 原写「`about-viewer.tsx` 6 处、`features/docs/native/` 5 处等」，但 `about-viewer.tsx` 实为 **7 处**（含 1 处 `hover:` 变体）。精确分布为**基础类 8 处**（`about-viewer.tsx` 190/217/243/287/295/316 共 6 处 + `page-nav.tsx:58` + `content-card.tsx:34`）+ **`hover:` 变体 4 处**（`about-viewer.tsx:91` + `docs-toc.tsx:77` + `docs-shell.tsx:71,104`）= **12 处**。`UDS5-S03` `S03-D11` 的 12 条行号引用经逐条核对**全部命中**，无需修改 | `UDS5-S03` `S03-D11`；`DESIGN-SYSTEM-CHANGELOG.md` §6.1 |
| 修正 | **`UDS5-S30` 差异编号去重**：删除与 `S30-D07` 语义重复的占位条目（原 `S30-D13`），后续条目顺次前移，编号恢复连续无重复（`S30-D01`..`S30-D14`） | `UDS5-S30` §9 |
| 修正 | **`UDS5-S15` §15 表格字符错乱**：`appearance` 禁令表的「禁止项 / 原因 / 替代」三列存在历史乱码（`cl-*` 行、`color-mix()` 行、`hover:bg-X/NN` 行、`text-[15px]` 行），已按 `UDS5-S21` / `UDS5-S14` 原文恢复 | `UDS5-S15` §15 |
| 待办 | **z-index 封闭 Token 未落地**：`S07-D3` 的五步落地路径（声明点 → 30 处 `z-50` 拆分 → 守卫白名单 → 任意值拦截 → 回填基线）本轮**未执行**（未改 `web/src` 运行时代码） | `UDS5-S07` §6.4 |
| 待办 | **视觉回归视口矩阵**从 2 档扩到 8 档（`S12-D8`）—— 属基线维护成本决策，未执行 | `UDS5-S12` §4.3 |
| 待办 | **高对比维度**（`forced-colors` + `data-theme-contrast`）未实现 | `UDS5-S10` §8.1 |
| 待办 | **状态映射跨域共享常量表**、**领域词汇表**、**Token → 引用方反向索引** 三项治理能力未建立 | `UDS5-S17` `S17-D1`、`UDS5-S19` `S19-D1`、`UDS5-S23` `S23-D2` |
| 待办 | 本节点**仅执行** `bun run design:5:check`（`web/scripts/check-design-system-5.0.mjs`）——实测 `verdict: PASS` / `errors: 0` / `checksPassed: 7` / `standards: 37` / `registeredDocIds: 37` / `scannedMarkdown: 35`（「文档 ID 反向登记」双向检查通过）。**未执行** `lint:design:strict`、`verify:contrast`、`i18n:check`、`components:registry:*`、单元测试、构建、视觉回归与平台验收；所有新增验证项一律 `NOT_VERIFIED` / `NOT_EXECUTED`。`gaps: 74` 为既有组件证据缺口（`VERIFIED 0 / PARTIAL 9 / NOT_VERIFIED 56`），**本节点未新增亦未消除** | `UDS5-AUDIT-01` §14 |

---

## 6.2 节点六：2026-11-14 · Clerk 上游复对比与边界安全引入

> 用户指令：「跟上游 clerk.com 对比，检查还有哪些缺少的，全部安全引入；测试通过后，将全部改动提交 GitHub」。本节点按「设计值来自代码，规则来自规范」执行，**零 Clerk 运行时引入、零业务 / 资金 / 认证 / 授权逻辑改动**。

| 类型 | 动作 | 落点 |
|---|---|---|
| 核对 | **新增 4 个官方来源**（首轮 9 → 合计 13）：`Customizing Clerk` overview、`Email and SMS templates`、`Bring your own CSS`、`2025-07-08 CSS variables support` changelog；补出首轮未纳入的 **N1–N7 七个官方维度**（Theme editor / Custom menu items 三组件 / Email & SMS 模板治理 / Build your own UI headless primitives / simple theme 稳定类边界 / CSS 变量驱动动态主题 / localization 键机制） | `UDS5-S21` §2.4 |
| 补全 | `UDS5-S21` 由 14 项扩到 **18 项**逐项参考规范：新增 §4.15（Theme editor）、§4.16（Email/SMS templates）、§4.17（Build your own UI）、§4.18（CSS 变量动态主题）；N2 / N5 / N7 分别并入 §4.9 / §4.4 + §4.11 / §4.8；新增 **§10 差异与例外登记 `S21-D01`…`S21-D12`** | `UDS5-S21` §4 / §10 |
| 安全引入 | 落地首轮 §8 三项「未建立」校验器中的**两项**：新增 `web/scripts/check-clerk-boundary.mjs`（C1 依赖零引入 / C2 运行时零引用 / C3 品牌值零照搬 / C4 能力归属一致性），接入 `bun run design:clerk:check`；纯静态只读、默认 `generated: false` | `web/scripts/check-clerk-boundary.mjs`、`web/package.json` |
| 测试 | 按「先写回归测试」约定先落 `web/src/design-system/__tests__/clerk-boundary.test.ts`（8 用例）：脚本未创建时**红色 8/8 失败**，实现后**绿色 8/8 通过**；覆盖依赖注入、`ClerkProvider` 注入、`cl-*` 稳定类、`#6c47ff` 品牌色、`--clerk-*` 变量、能力清单删减、`__tests__` 自身排除 | `web/src/design-system/__tests__/clerk-boundary.test.ts` |
| 实测 | `node scripts/check-clerk-boundary.mjs` → `verdict: PASS` / `errors: 0` / `checksPassed: 4`，扫描 **84** 个依赖、**1,287** 个生产源文件、**11** 类能力；`bun run design:5:check` → `verdict: PASS` / `errors: 0` / `standards: 37` | `UDS5-S21` §8 / §9 |
| 修正 | `DESIGN-SYSTEM-AUTOMATION-STANDARD.md` §8「真实脚本清单」原**漏登** `check-design-system-5.0.mjs`，本轮补回，并登记新守卫（**未接 CI**） | `UDS5-S26` §8 |
| 废弃 | **N6 CSS 变量驱动动态主题**判 `REJECT_REGRESSION`：Uter 已有静态两层 Token + 三维 `data-theme-*` 正交，引入 `color-mix()` / 相对颜色语法运行时派生会绕过 T1–T17 | `UDS5-S21` `S21-D06` |
| 废弃 | Clerk Dashboard 模板系统 / webhook 契约、headless 原语包、`cl-*` 稳定类、`appearance.elements`、Experimental `localization` prop 作契约 —— 全部 `Reject`，零依赖引入 | `UDS5-S21` §3 / §10 |
| 待办 | 第三项未建立校验器「业务红线零改动」**未自动化**，仍靠提交范围 + §3 P3 人工把关（`S21-D10`）；交互主题预览、导航 ↔ 注册 ID、Light/Dark 成对校验扩展、邮件预览/回滚/跨环境复制均 `NOT_STARTED`（`S21-D01` / `D02` / `D07` / `D08`） | `UDS5-S21` §10 |
| 待办 | `design:clerk:check` **尚未接入 CI**；接入需单独授权 | `UDS5-S26` §8 |

---

## 7. 5.0 累计变更分类总表（新增 / 继承 / 合并 / 废弃 / 待办）

| 类别 | 条目 | 证据来源 |
|---|---|---|
| 新增 | 5.0 规范体系 `UDS5-S01`..`UDS5-S28`（28 份） | §9 D2、头部 |
| 新增 | 业务域分册 `UDS5-S29`..`UDS5-S32`（4 份：认证 / 用户与 API Key / 组织与账单 / 触达与本地化） | §6.1 节点五 |
| 新增 | 两份审计事实源（`UDS5-AUDIT-01` / `UDS5-AUDIT-02`） | 头部 |
| 新增 | 冲突决策 D1–D8、五层架构、双向关联、8 状态、废弃治理机制 | §9、`UDS5-S21`..`UDS5-S28` |
| 继承 | 品牌色 / 字体 / 间距 / 三层 Token / 17 条校验 / T1–T17 / 组件单一实现根 / 3.0 全文 | §11.1 |
| 继承 | 3.0 未闭合项（73 项验收、E24、P1–P3、字体轴、PageHeader、65 组件 0 VERIFIED）作为待办 | §3.1、§11.4 |
| 合并 | 3 处 `EmptyState`、52 个同名调色板、typography 值/工具类映射、双产物统一、注册表模型投影 | §11.2 |
| 合并 | 蓝图结构并入 13 份既有分册（z-index / 栅格 / 断点 / 验证时机 / 竞态 / 破坏性流程 / 空状态五类 / 品牌标识 / 组件尺寸档 / API 面 / 金额与文案禁区 / 高对比 / 排版 / 规范性语言 / 十字段验收矩阵） | §6.1 节点五 |
| 废弃 | 25 个零引用 Token 候选（不删除）、2 个过时文件叙述、临时状态退出条件 | §11.4 |
| 待办 | registry 版本升级（含 `:45` 同变更）、纯别名根治、测试文件归位、展示中心补齐、三平台 `NOT_VERIFIED`、未执行验证项 | §11.3、§11.4、§14 |
| 待办 | z-index 封闭 Token 落地、视觉回归 8 视口扩展、高对比维度、状态映射共享表、领域词汇表、Token 反向索引、前端订单 `failed` 态补齐 | §6.1 节点五 |
| 待办 | **`text-fg-primary` 死类修复**（`theme.css` 补 `--color-fg-primary` 一行 + 重建；影响 12 处使用点）、**管理员额度调整补强验证**（`manageUserQuota` 挂 `requireAdminUserProof` + 临界限流）、**组织域成员权限 / 额度写操作补强验证与审计**（`UpdateOrganizationMember` / `RemoveOrganizationMember` 挂 `requireAdminUserProof` + 临界限流 + 审计补齐）、**`MaskedValueTrigger` 字号覆盖修复**（拆开字号档与 `font-mono` 字形族，参照 `input.tsx:65-69`）、**风险分级落到代码**（`RISK-P0/P1/P2` 元数据） | §6.1 节点五（`S03-D11` / `S01-D6` / `S30-D13` / `S31-D14` / `S30-D15` / `S01-D3`） |
| 待办 | **Clerk 上游复对比后续**：`design:clerk:check` 接入 CI、业务红线零改动专用拦截、交互主题预览、导航 ↔ 注册 ID 双向关联、Light/Dark 成对校验扩展、邮件模板预览/回滚/跨环境复制 | §6.2 节点六（`UDS5-S21` §10） |

---

## 8. 证据来源索引（BASELINE-AUDIT 章节号映射）

| 章节 | 内容 | 本日志引用位置 |
|---|---|---|
| §1 | 变更保护与并发 WIP（42→211 项、12 个禁改文件、不执行全量构建、不建分支） | §4、§6 |
| §2 | 项目实际结构（Bun / React 19 / Tailwind 4.3.3 / 字体基线核实） | §3 |
| §3 | 3.0 审计（4,111 行 / 197,053 B / 29 章 / Spec SSOT / 派生产物 / 证据时效） | §2、§3、§5 |
| §3.1 | 3.0 自身未闭合项（73 项、E24、E28、P1–P3、字体轴、PageHeader、构建缺陷、组件证据） | §3、§5、§6、§7 |
| §4.1 | Token 数量与分层（14 CSS / 1,518 行 / 245 唯一变量 / 52 同名键） | §5、§6 |
| §4.4 | Token 门禁实测（违规 0 / 17 PASS / 31 PASS / baseline 0 条） | §5、§7 |
| §5 | 组件体系审计（65 组件 / registry 缺 8 类字段 / 3 处同名 EmptyState） | §5、§6 |
| §5.1 | 展示中心真实能力（24 区 / 静态并排 / Props 0 / 注册 ID 0 / 22 锚点漏 2 区 / 2 个过时注释） | §6 |
| §6 | 页面与业务模块审计（73 路由 / 30 feature / 22 页基线） | §6、§7 |
| §6.1 | 业务模块 → 路由映射（退款 / 订单无独立页面） | §7 |
| §7 | 测试与 CI 审计（已接 / 未接清单） | §6、§7 |
| §8 | 平台支持核实（PC Web / H5 可测，三平台无实现，计数 0） | §6、§7 |
| §9 | 冲突清单与决策 D1–D8 | §2、§4、§6、§7 |
| §11.1 | 保留（Keep）8 条 | §3、§5、§6、§7 |
| §11.2 | 合并（Merge）5 条 | §6、§7 |
| §11.3 | 重构（Refactor）4 条（含 registry `:45` 同变更） | §6、§7 |
| §11.4 | 废弃（Deprecate）5 条 | §5、§6、§7 |
| §12 | 基线量化汇总（并发 WIP 211 项、152 项在 `.uap/`） | §4 |
| §13 | 升级边界（本轮禁止事项） | §4 |
| §14 | 审计结论 A / B / C 与 `NOT_EXECUTED` 清单 | §2、§6、§7 |

---

## 9. 与其他规范的关系

| 规范 ID | 关系 | 说明 |
|---|---|---|
| `UDS5-S01` | 上级 | 服从总纲效力、ID 体系与验证状态口径 |
| `UDS5-AUDIT-01` | 主要事实依据 | 全文证据来源均标注其章节号（见 §8） |
| `UDS5-AUDIT-02` | 辅助事实依据 | 2026-11-14 Clerk 参考核实的时间线事实 |
| `UDS5-S21` | 关联 | Clerk 仅作外部参考、Elements 弃用等时效性事实的时间线背景 |
| `UDS5-S24` | 关联 | 门禁铁律与 CI 已接 / 未接清单的变更事实 |
| `UDS5-S25` | 下游 | 8 状态与 12 必要条件是「3.0 未闭合 → 5.0 待办」的验收口径 |
| `UDS5-S27` | 关联 | 本日志的「合并 / 废弃 / 版本统一」动作由迁移指南执行 |
| `UDS5-S28` | 关联 | 废弃登记格式与退出条件由废弃治理标准定义 |

---

## 10. 代码实施位置

| 类别 | 真实路径 | 本文关联 | 本轮状态 |
|---|---|---|---|
| 3.0 历史版本 | `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md`（4,111 行 / 197,053 B） | §2 / §5 | 存在，未改动（完整保留） |
| 3.0 审计证据 | `docs/design-system/audit/evidence/`（16 个文件，2026-11-03） | §3 | 存在，未改动 |
| 5.0 规范目录 | `docs/design-system/uter-design-system-5.0/`（含 `audit/` 与 `evidence/`） | §6 | 撰写中 |
| UAP 体系 | `.uap/README.md`、`.uap/config/*.yaml`、`.uap/evidence/` | §4 | 存在，属并发 WIP 禁改 |
| 组件注册 | `web/src/design-system/component-registry.json`（`designSystem "UTER Design System 3.0"`） | §6 待办 | 存在，未改造 |
| 注册校验 | `web/scripts/check-component-registry.mjs:45`（硬编码校验） | §6 待办 | 存在，未改造 |
| 展示中心 | `docs/design-system/showcase.html`、`showcase.tokens.js` | §5 / §6 | 存在，未改造 |
| 生成脚本 | `web/scripts/generate-design-showcase.mjs:25-29`（过时注释） | §6 废弃 | 存在，未改造 |
| CI | `.github/workflows/ci.yml:356-438` | §6 | 存在，未改造 |

> 本文为变更日志，**不新增、不修改任何代码 / 配置 / 历史版本文件**；§6 / §7 的「合并 / 废弃 / 待办」均为 5.0 决定与规划，非本轮已执行。

---

## 11. 自动化验证

| 验证项 | 现有实现 | 5.0 拟补充 | 当前结果 |
|---|---|---|---|
| 变更日志证据可追溯 | 无 | 「每条变更标注 `UDS5-AUDIT-01` 章节号」一致性检查（`UDS5-S24` S04 / S05） | 未建立 `NOT_VERIFIED` |
| 无虚构 commit SHA | 全文人工核对 | 全文检索「SHA / commit」误报检查 | 未建立 `NOT_VERIFIED` |
| 3.0 全文完整保留 | 文件存在性 + 大小核对（4,111 行 / 197,053 B） | 定期基线核对 | 未复核 `NOT_VERIFIED` |
| registry 版本一致性 | `components:registry:check`（已接 CI） | `designSystem` 与 `:45` 同变更校验（S03） | 未执行 `NOT_VERIFIED` |
| 五类动作计数 | 无 | 按节点统计新增 / 继承 / 合并 / 废弃 / 待办条数 | 未建立 `NOT_VERIFIED` |

> 本轮未运行任何验证命令；本文所有数字均复述 `UDS5-AUDIT-01` 章节事实，不代表 5.0 已完成变更或验证。

---

## 12. 验证状态

| 项 | 状态 | 说明 |
|---|---|---|
| 4 个时间节点 + 五类动作台账 | `IMPLEMENTED_NOT_VERIFIED` | 变更日志已撰写，未执行版本变更 |
| 时间线来源边界声明（§4，11-12 节点） | `IMPLEMENTED` | 如实注明审计报告未逐字记载该日期，不虚构 |
| 不虚构 commit SHA / 退役清单 | `IMPLEMENTED` | §1 / §4 已声明 |
| 证据来源章节号索引（§8） | `IMPLEMENTED` | 逐章映射 |
| 3.0 全文保留 | `NOT_VERIFIED` | 未复核文件完整性 |
| 合并 / 废弃 / 版本统一动作 | `NOT_STARTED` | 见 `UDS5-S27` / `UDS5-S28` |
| 未执行验证项（全量构建 / 视觉双轨 / `test:axe` / `test:business:e2e` / 原生验收） | `NOT_EXECUTED` / `NOT_VERIFIED` | `UDS5-AUDIT-01` §14 |
| PC Web / H5 | `NOT_VERIFIED` | 未针对 5.0 重跑 |
| Android / iOS / HarmonyOS | `NOT_VERIFIED` | 无实现（决策 D4） |

**总体验证状态：`NOT_VERIFIED`**。本文不得被解读为 `FULLY_IMPLEMENTED_AND_VERIFIED`；版本演进的最终状态以 `UDS5-S25`（验收规范）与最终验收报告为准。
