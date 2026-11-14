# 16 — 页面模板标准（PAGE TEMPLATE STANDARD）

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S16` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01` |
| 生效日期 | `2026-11-14` |
| 适用范围 | `web/src/routes/` 下 73 个路由源码、`web/src/features/`（30 个 feature）、`web/src/components/layout/` 的 App Shell / Sidebar / Content Container |
| 验证状态 | `NOT_VERIFIED` |

> 本规范定义 12 类页面模板的区域契约与 73 个真实路由的归类。它是「规范层」文档，不代表页面已完成适配或已通过视觉回归。本轮不修改任何业务代码、不引入依赖、不执行 git 操作。

---

## 1. 目的与效力

1. 把 `web/src/routes/` 的 73 个路由源码归入 12 类页面模板，为每类定义 12 个区域的必备/可选/不适用契约。
2. 统一「空 / 加载 / 错误三态齐全」的页面级要求，避免每个 feature 各自拼装。
3. 显式继承 3.0 未闭合项：**PageHeader 尚无独立组件**（3.0 `:3339`），页面按 3.0 §3 + §6 组合，本规范列为 5.0 补齐候选（见 §7）。
4. 与 `web/AGENTS.md` 3.8（TanStack Router、`beforeLoad` 鉴权、`<Outlet />`）一致；权限由后端 Casbin + 路由守卫决定，不引入 Clerk `<Show />`。

---

## 2. 事实基线（引自 `BASELINE-AUDIT.md`，不得假设）

| 项 | 真实值 | 来源 |
|---|---|---|
| 路由源码总数 | **73 个** | §6 |
| 路由分组 | `_authenticated 41 / _public 13 / (auth) 9 / (errors) 5 / __tests__ 2 / oauth 1 / setup 1 / __root.tsx 1` | §6 |
| feature 目录 | 30 个（非 34）；最大 6 个 `system-settings 192 / channels 117 / usage-logs 80 / pricing 69 / playground 63 / models 55` | §6 |
| 系统设置 | `_authenticated/system-settings/` **18 个文件 / 9 个子域**（auth/billing/content/models/operations/request-policies/security/site） | §6.1 |
| 单测 | `web/src` 下 `*.test.ts(x)` 288 个、`__tests__` 目录 75 个 | §6 |
| E2E | `business 1 spec` / `visual 3 spec` + 44 张 PNG（22 页 × 2 视口）/ `axe 2 spec` | §6 |
| 视觉基线覆盖 | 公开 13 页 + 鉴权 9 页 = **22 页**；73 路由中仅 22 页有基线 | §6 |
| 未覆盖路由 | `system-settings/*` 18 个、`*/$section` 动态段、`usage-logs/audit`、`oauth/$provider`、`setup`、`chat/$chatId` 等 | §6 |
| 断点 | 3.0 §16 五档 `sm640 / md768 / lg1024 / xl1280 / 2xl1536` | §2 / §8 |
| 容器宽度 | 后台最大 1280px、营销页 1800px（保持不变） | Clerk 分析 2.2 |
| PageHeader | 3.0 §13.1 定义，`:3339` **尚无独立组件** | §3.1 |
| 3.0 §22 验收 | 73 个 `- [ ]`、0 个 `- [x]` | §3.1 |
| 业务红线 | 支付 / 充值 / 退款 / 余额 / 订单 / 认证 / 授权模块只允许改视觉与组件复用，不得改 API 契约、资金逻辑、数据库结构或安全约束 | §6.1 注、§13 |

---

## 3. 12 个区域通用定义

| # | 区域 | 职责 | 必备元素 | 复用组件 / 来源 |
|---|---|---|---|---|
| 1 | Page Header | 页面标题、副标题、层级归属 | 标题（22/600/30）、描述、状态标签 | 当前**无独立组件**，按 §7 组合 |
| 2 | Breadcrumb | 当前位置与返回路径 | 层级链、当前项不可点 | `ui/` navigation 类（§2 计 8 个） |
| 3 | Page Actions | 页面级主/次操作 | 主操作 1 个、次操作折叠 | `ui/button.tsx`（`UDS5-S14`） |
| 4 | Main Content | 页面主体容器 | 最大宽度 1280px / 1800px | `components/layout/` |
| 5 | Sidebar | 持久二级/三级导航 | 选中态、权限过滤 | `components/layout/`（Clerk 分析 2.2 / 2.3） |
| 6 | Toolbar | 内容区上方操作条 | 批量操作、列可见性、刷新 | `components/data-table/toolbar/` |
| 7 | Filter | 筛选条件 | 搜索、下拉、日期、重置 | `components/data-table/toolbar/` |
| 8 | Content Area | 实际数据/表单/卡片区 | 语义化 `main` / `section` | 各模板差异点 |
| 9 | Empty | 无数据态 | 图标 + 一句话 + 主行动 | `components/empty-state.tsx`（唯一正式封装） |
| 10 | Loading | 首屏/局部加载 | Skeleton / Spinner，Reduce Motion | `loading-state.tsx` / `ui/skeleton.tsx` |
| 11 | Error | 路由级/局部错误 | `errorComponent`、重试、友好文案 | `components/error-state.tsx`；`web/AGENTS.md` §3.9 |
| 12 | Responsive Behavior | 五档断点下的降级 | 移动优先、表格转列表、命中区 ≥24px | 3.0 §16；`UDS5-S12` / `UDS5-S17` |

> **三态齐全**：每个含数据的模板（Dashboard / List / Detail / Analytics / Billing）必须同时定义 #9 Empty / #10 Loading / #11 Error，不得只实现「有数据」路径（`web/AGENTS.md` 3.14 第 8 条）。

---

## 4. 12 类页面模板 × 12 区域矩阵

图例：`●` 必备 / `○` 可选 / `—` 不适用或由上级布局承担。单元格后缀为差异关键词。

| 模板 \ 区域 | 1 Header | 2 Crumb | 3 Actions | 4 Main | 5 Sidebar | 6 Toolbar | 7 Filter | 8 Content | 9 Empty | 10 Loading | 11 Error | 12 Responsive |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Dashboard | ● 标题+时间范围 | ○ | ○ 导出 | ● 1280 | ● App Shell | ○ | ● 时间 | ● 指标卡/图表 | ● | ● Skeleton | ● | ● 卡片堆叠 |
| List | ● | ● | ● 新建 | ● | ● | ● 批量 | ● 搜索/筛选 | ● 表格/列表 | ● | ● 骨架行 | ● 重试 | ● 转移动列表 |
| Detail | ● 标题+状态 | ● 返回 | ● 编辑/删除 | ● | ○ | ○ | — | ● 描述列表/分区 | ○ | ● | ● | ● 分区折行 |
| Create | ● 新建标题 | ● 返回 | ● 提交/取消 | ● | — | — | — | ● 表单分步 | — | ● 提交中 | ● 服务端错误 | ● 单列 |
| Edit | ● 编辑标题 | ● 返回 | ● 保存/取消 | ● | — | — | — | ● 预填表单 | — | ● 保存中 | ● + 未保存提醒 | ● 单列 |
| Settings | ● 子域标题 | ● 设置根 | ● 保存 | ● | ● 9 子域导航 | ○ | — | ● 分组表单 | — | ● | ● | ● 导航抽屉化 |
| Profile | ● 分区标题 | ● | ● 编辑 | ● | ● 分区导航 | — | — | ● 卡片分区 | ○ | ● | ● | ● 分区堆叠 |
| Authentication | ○ 品牌区 | — | — | ● 居中窄卡 | — | — | — | ● 分步表单 | — | ● | ● 限流/验证码 | ● 输入 ≥16px |
| Analytics | ● 标题+范围 | ○ | ○ 导出 | ● | ● | ● | ● 维度 | ● 图表 | ● | ● | ● | ● 图表降密度 |
| Billing | ● 标题+账期 | ● | ● 充值 | ● | ○ | ● | ● 账期 | ● 账单表格 | ● | ● | ● 资金只读 | ● 表格转列表 |
| Error | — 错误页头 | — | ○ 返回首页 | ● 居中 | — | — | — | ● 错误码+文案 | — | — | ● `errorComponent` | ● |
| Empty | ● 引导标题 | — | ● 主行动 | ● 居中 | — | — | — | ● 引导插画 | ● 即默认态 | — | — | ● |

### 4.1 矩阵适用口径

- `●` 表示该模板**必须**定义该区域的具体实现或显式降级策略；`○` 表示按页面需要可选；`—` 表示由 App Shell / 上级路由承担或该模板无此语义。
- `Sidebar` 在 Create / Edit / Authentication / Error / Empty 中为 `—`，因这些页面处于聚焦流程，由 `_authenticated` 布局或全屏容器承担导航。
- `Filter` 在表单类（Create / Edit / Settings / Profile）为 `—`，筛选语义由 Toolbar / 表单字段承担，不另立区域。

---

## 5. 12 类模板逐类说明

| 模板 | 定义 | 典型 Content Area | 关键约束 |
|---|---|---|---|
| Dashboard | 聚合指标与趋势的入口页 | 指标卡 + 图表 + 最近记录 | 时间范围筛选为必备；图表 Token 缺口 P2 保持 Pending |
| List | 同类资源的可检索集合 | `data-table/`（24 导出）或移动列表 | 11 项能力见 `UDS5-S19`；批量操作归 Toolbar |
| Detail | 单个资源的只读/分区展示 | 描述列表 + 关联分区 | 状态标签与 `aria-*` 一致 |
| Create | 新建资源的表单流程 | 分步/分组表单 | 防重复提交、服务端错误映射（`UDS5-S18`） |
| Edit | 编辑既有资源的表单流程 | 预填表单 | **未保存提醒**为必备（`UDS5-S18`） |
| Settings | 9 子域系统设置 | 分组表单 + 保存条 | 三级导航；`system-settings/*` 18 路由无 E2E 覆盖 |
| Profile | 用户自助账户分区 | 卡片分区（Profile/Security/…） | 分区标题 22/600/30、卡片标题 18/600/26（Clerk 分析 2.18） |
| Authentication | 登录/注册/MFA 等 | 居中窄卡片 + 社交登录 | 仅参考信息架构与视觉密度，**不替换自建认证**（审计 §9 D8） |
| Analytics | 多维分析与可视化 | 图表 + 维度筛选 | 不引入 Clerk Charts（官方未提供） |
| Billing | 钱包/账单/充值/价格 | 账单表格 + 账期筛选 | **只做 UI 规范映射**，不改资金逻辑（审计 §6.1 红线） |
| Error | 路由级错误承接 | 错误码 + 友好文案 + 排查信息 | 由 `errorComponent` 承接（`web/AGENTS.md` §3.9） |
| Empty | 无数据引导页 | 引导插画 + 主行动 | 复用 `components/empty-state.tsx`，不新建重复实现（`UDS5-S14` §5.3） |

---

## 5.1 页面与流程通则（业务域蓝图补充）

> 来源：业务域蓝图《Page and Flow Standard》§1–§7。**本节是 §5 十二类模板的横向通则**，不新增模板类型、不改 §4 矩阵。

### 5.1.1 页面结构通则

| # | 规则 | 说明 |
|---|---|---|
| PF-1 | 页面须包含清晰的**标题区**、**主要内容区**和必要的**操作区**。 | 蓝图 §1 |
| PF-2 | 标题区须说明**当前对象 / 范围**（例如「渠道 · Acme Cloud」而非仅「渠道」）。 | 蓝图 §1 |
| PF-3 | 主要操作位于**用户预期位置**；**次要操作不得与主操作争夺视觉权重**。 | 蓝图 §1 |
| PF-4 | 与 §3 的 12 区域定义对应：标题区 → Header 区，主要内容区 → Content 区，操作区 → Action 区。 | 内部一致性 |

### 5.1.2 列表流程（List）

| # | 规则 | 说明 |
|---|---|---|
| LF-1 | **保留筛选条件与分页状态**（返回列表不丢上下文）。 | 蓝图 §3 |
| LF-2 | **「无结果」与「无数据」必须区分**（与 S17 §10.5 EM-1 / EM-2 一致）。 | 蓝图 §3 |
| LF-3 | 批量操作须展示**选中数量**与**影响范围**。 | 蓝图 §3 |
| LF-4 | **高风险批量操作必须二次确认**，确认内容须包含对象范围与后果。 | 蓝图 §3 |
| LF-5 | 数据表 11 项能力（排序 / 筛选 / 分页 / 行选择 / 窄屏策略等）归 `UDS5-S19`；本节只约束流程语义。 | 边界 |

### 5.1.3 详情流程（Detail）

| # | 规则 | 说明 |
|---|---|---|
| DF-1 | **状态、金额、时间和对象身份优先展示**（首屏可见，不必滚动）。 | 蓝图 §4 |
| DF-2 | 历史记录按**时间排序**。 | 蓝图 §4 |
| DF-3 | 操作按钮按**服务端权限与状态**显示；**不得只在前端隐藏而缺少后端鉴权**（前端隐藏只是体验，鉴权必须在服务端）。 | 蓝图 §4；与既有「后端 Casbin + 路由 `beforeLoad`」口径一致（S11 §5.1） |

### 5.1.4 创建 / 编辑流程（Create / Edit）

| # | 规则 | 说明 |
|---|---|---|
| CF-1 | 明确**必填字段**、**默认值**、**保存结果**与**失败恢复路径**。 | 蓝图 §5 |
| CF-2 | 多步骤流程提供**步骤指示**与**返回能力**；除非业务明确要求，**不得丢失已填数据**（与 S18 §3 契约第 11 条「未保存提醒」一致）。 | 蓝图 §5 |

### 5.1.5 破坏性流程（硬约束）

> 蓝图 §6。**这是本节最关键的补充**，直接服务于资金与权限安全。
> **风险等级归属**：本节全部 6 条规则对应 `UDS5-S01` §4A 的 **`RISK-P0`**（高风险操作）；`RISK-P1`（可撤销的批量 / 配置类）见 §5.1.2 `LF-3` / `LF-4`。裸写 `P1` / `P2` 在本分册一律指 `UDS5-S01` §4A.1 定义的**待办优先级**，非业务风险等级。

| # | 规则 | 说明 |
|---|---|---|
| DP-1 | **删除、吊销、退款、权限变更**等破坏性操作**必须**说明：① **对象**（具体是哪一个）、② **影响**（会发生什么）、③ **不可逆性**（能否撤销 / 如何恢复）。 | 蓝图 §6 |
| DP-2 | **确认按钮使用动作词**，**禁止**使用模糊的「确定」「OK」「是」。正确示例：`吊销令牌`、`删除渠道`、`确认退款`、`移除成员`。 | 蓝图 §6 |
| DP-3 | **取消按钮**使用「取消」「返回」等中性词，不得与确认按钮同形同色；Destructive 变体只在主操作位使用。 | 蓝图 §6 + S03 §3 第 11 类 / S07 §9 |
| DP-4 | 破坏性确认**不得**被键盘绕过（`confirm-dialog.tsx` 焦点陷阱），且确认按钮**默认不聚焦**（避免回车误触），须显式聚焦到「取消」或对话框容器。 | S17 §5.3 + S18 契约第 11 条 |
| DP-5 | **退款 / 额度 / 余额**类确认文案**不得**预先断言结果（不得写「已退款」「额度已恢复」）——最终状态以服务端确认结果为准。 | 资金链路真实性红线（既有 3.0 治理） |
| DP-6 | **权限变更 / 吊销**类操作须展示**受影响对象的身份**（用户名 / 渠道名 / 令牌名），不得只显示 ID。 | 蓝图 §6 + `UDS5-S30`（用户组件） |

**仓库现状（如实登记）**

| 项 | 结论 |
|---|---|
| 二次确认组件 | `web/src/components/confirm-dialog.tsx` 已存在（S18 §3 契约第 11 条引用）。 |
| 确认按钮动作词 | **未逐处核实**是否全部使用动作词、是否存在「确定」文案，登记为 `S16-D1`。 |
| 破坏性流程的对象 / 影响 / 不可逆性三要素 | **未逐处核实**，登记为 `S16-D2`。 |
| 默认焦点落在「取消」 | **未核实**；登记为 `S16-D3`。 |
| 批量高风险二次确认 | **未核实**是否存在批量操作的二次确认封装，登记为 `S16-D4`。 |

### 5.1.6 流程验收（蓝图 §7）

| 项 | 要求 |
|---|---|
| 交付物清单 | 每个核心业务流程须有：**流程图 + 页面清单 + 状态清单 + 异常路径 + 权限矩阵 + 端到端测试**。 |
| 仓库现状 | 仓库现状：73 个路由已有路由树与分组清单（§6），**流程图 / 权限矩阵 / E2E 覆盖**不完整——`system-settings/*` 18 路由无 E2E 覆盖（§6.3），视觉基线 22/73（§6.3）。登记为 `S16-D5`。 |

---

## 6. 73 个真实路由：分组与代表路径

### 6.1 路由分组（合计 73）

| 分组 | 数量 | 主要模板 | 说明 |
|---|--:|---|---|
| `_authenticated` | 41 | Dashboard / List / Detail / Settings / Profile / Analytics / Billing | 需 `beforeLoad` 鉴权；含 `system-settings/*` 18 个 |
| `_public` | 13 | Authentication / Billing(价格) / Detail | 公开页；`pricing` 11 文件 |
| `(auth)` | 9 | Authentication | 邮箱验证码、step-up、WebAuthn/TOTP、微信网页授权等自建流程 |
| `(errors)` | 5 | Error | 路由级错误页 |
| `__tests__` | 2 | — | 路由测试文件，非页面模板 |
| `oauth` | 1 | Authentication | `oauth/$provider` |
| `setup` | 1 | Create | 初始化向导 |
| `__root.tsx` | 1 | App Shell | 根布局，`<Outlet />` |
| **合计** | **73** | — | 与 §2 基线一致 |

### 6.2 代表路径（引自 `BASELINE-AUDIT.md` §6.1）

| 模板 | 代表路由 | 备注 |
|---|---|---|
| Dashboard | `_authenticated/dashboard/{index,$section}.tsx` | `features/dashboard/lib/stats.ts`；`performance-metrics/` 无独立路由 |
| List | `_authenticated/users/index.tsx`、`_authenticated/keys/index.tsx` | `:45` `ROLE.ADMIN`；`features/keys/` 33 文件 |
| List | `_authenticated/models/{index,$section}.tsx`、`channels/index.tsx` | 管理员守卫 |
| List | `_authenticated/usage-logs/{index,$section,audit}.tsx` | `features/usage-logs/` 80 文件 |
| Billing | `_authenticated/wallet/index.tsx`、`_public/recharge-agreement.tsx`、`system-settings/billing/*` | `features/wallet/` 40 文件；账单历史为 `billing-history-dialog.tsx` 弹窗 |
| Billing | `_public/pricing/{index,$modelId/index}.tsx` | `features/pricing` 69 + `model-pricing` 11 |
| Detail | `_authenticated/organization/index.tsx`、`_authenticated/profile`、`security` | `features/organization` 8 文件、`features/profile` 17、`features/security` 37 |
| Settings | `_authenticated/system-settings/`（18 文件 / 9 子域） | auth/billing/content/models/operations/request-policies/security/site |
| Error | `(errors)/*`（5） | 由 `errorComponent` 承接 |
| — | **退款** | **无独立路由、无独立 refund 文件**；17 处均为消费日志/类型/设置字段 |
| — | **订单** | **无独立订单路由** |

> 上游路由一律以 `web/src/routes/` 实际文件为准；本表未列出的路径不在本规范中虚构。`__tests__` 2 个与 `__root.tsx` 不承担页面模板语义。

### 6.3 视觉基线覆盖差距

| 项 | 真实值 |
|---|---|
| 有基线页面 | 公开 13 + 鉴权 9 = **22 页** |
| 双视口 PNG | 44 张（desktop 1440×900 / mobile 390×844 各 22） |
| 未覆盖 | `system-settings/*` 18 个、`*/$section` 动态段、`usage-logs/audit`、`oauth/$provider`、`setup`、`chat/$chatId` 等 |
| E2E 接入 | `test:visual` 已进 CI；`test:axe` / `test:business:e2e` / `test:visual:e2e` 刻意不接 CI（审计 §7） |

---

## 7. PageHeader 未闭合项（3.0 §3339）

| 字段 | 内容 |
|---|---|
| 来源 | 3.0 §13.1 定义了 PageHeader；`:3339` 明确「尚无独立组件，页面按 §3 + §6 组合」 |
| 5.0 判定 | **NOT_VERIFIED** / 补齐候选，与审计 §3.1 表格一致 |
| 现状 | 12 类模板的 #1 Page Header 区域由各页面用标题 + 描述 + 按钮临时组合，无 `UTER-CMP-*` 注册 ID |
| 影响 | 12 类模板的标题层级、描述、状态标签、Page Actions 排布无法一致性校验；22 页视觉基线无法覆盖该组件的独立回归 |
| 补齐前置 | ① 按 `UDS5-S14` §3 的 22 项定义；② 按 `UDS5-S15` 的 API 命名；③ 注册 ID 与 schema 校验同步；④ 先写回归测试（`web/AGENTS.md` 3.14） |
| 退出条件 | 组件落地 + 注册 + `evidence.tests[]` 非空 + 12 类模板引用一致 + 视觉基线补入，方可从 Pending 迁移；**本轮不落地** |
| 禁止 | 3.0 §22 的 73 个未勾选状态不得被继承为「已通过」（审计 §11.4 第 2 条） |

---

## 8. 差异与例外登记

| 编号 | 内容 | 状态 |
|---|---|---|
| S16-D1 | 蓝图 §6 要求确认按钮使用**动作词**、禁止模糊「确定」；仓库 `confirm-dialog.tsx` 现有文案未逐处核实 | `NOT_VERIFIED`（见 §5.1.5 DP-2） |
| S16-D2 | 破坏性确认的「对象 / 影响 / 不可逆性」三要素未逐处核实 | `NOT_VERIFIED`（见 §5.1.5 DP-1） |
| S16-D3 | 破坏性对话框的**默认焦点**是否落在「取消」未核实 | `NOT_VERIFIED`（见 §5.1.5 DP-4） |
| S16-D4 | 批量高风险操作的**二次确认封装**是否存在未核实 | `NOT_VERIFIED`（见 §5.1.2 LF-4） |
| S16-D5 | 蓝图 §7 要求每个核心业务流程具备流程图 / 页面清单 / 状态清单 / 异常路径 / 权限矩阵 / E2E；仓库现状为 73 路由清单齐备、**流程图与权限矩阵缺失**、`system-settings/*` 18 路由无 E2E、视觉基线 22/73 | `NOT_VERIFIED`（见 §5.1.6、§6.3） |
| S16-D6 | 蓝图 §2 页面类型（Overview / List / Detail / Create / Edit / Transaction / Settings）与仓库 §5 十二类模板**命名与切分不一致**（仓库有 Dashboard / Analytics / Billing / Profile / Error / Empty，缺独立 Transaction 类；Billing 覆盖资金交易） | 已登记（**不重命名、不新增模板**，以仓库 §4 矩阵为准；蓝图类型作为语义对照） |

---

## 与其他规范的关系

| 规范 | 关系 | 边界 |
|---|---|---|
| `UDS5-S01` | 效力来源 | 不重述总则 |
| `UDS5-S03`–`S13` | 提供 Token / 断点 / 主题 / 无障碍 / 动效 | 模板只消费，不定义 Token |
| `UDS5-S11`（Layout） | App Shell / Sidebar / Content Container 的上位规范 | 本规范只定义页面内 12 区域 |
| `UDS5-S14` | 组件清单与状态矩阵 | 模板复用组件，不重复定义 |
| `UDS5-S15` | 组件 API 命名 | PageHeader 补齐须遵循 |
| `UDS5-S17` | 交互五态、焦点环、hover Token | 页面级交互过程在 S17 细化 |
| `UDS5-S18` | 表单验证 / 未保存提醒 / 防重复提交 | Create / Edit / Settings 依赖 |
| `UDS5-S19` | DataTable 11 项能力 | List / Analytics / Billing 的 Content Area 依赖 |
| `UDS5-S20` | 通知与错误处理归属 | Empty / Error / 提交反馈依赖 |
| `web/AGENTS.md` | 3.8 路由 / 3.9 错误处理 / 3.14 测试 | 冲突时以 `web/AGENTS.md` 为准 |

---

## 代码实施位置

| 用途 | 真实路径 | 本轮动作 |
|---|---|---|
| 路由源码 | `web/src/routes/`（73 个） | **只读** |
| Feature 实现 | `web/src/features/`（30 个） | **只读** |
| 布局组件 | `web/src/components/layout/`（App Shell / Sidebar / Content Container） | **只读** |
| 表格封装 | `web/src/components/data-table/`（24 导出） | **只读** |
| 空/加载/错误态 | `web/src/components/empty-state.tsx` / `loading-state.tsx` / `error-state.tsx` | **只读** |
| 视觉基线 | `web/e2e/visual/`（44 张 PNG；审计列为禁止改动的已脏文件） | **只读**，不改 |
| 3.0 历史规范 | `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md`（§13.1 / `:3339` / §22） | **只读**，不改写、不删除 |
| 规范输出 | `docs/design-system/uter-design-system-5.0/16-PAGE-TEMPLATE-STANDARD.md` | **本文件（新建）** |

> 未列出的路径、脚本、测试结果不出现在本规范中；不宣称已运行构建或视觉回归。

---

## 自动化验证

| 验证项 | 真实命令 / 门禁 | 基线结果 | 本规范状态 |
|---|---|---|---|
| 路由文件计数 | `components:registry:check`（注册表）/ 路由静态统计 | 73 个路由（引用审计 §6） | 未重跑 |
| 视觉回归 | `test:visual` | 22 页 / 44 张 PNG（引用审计 §6） | 未重跑 |
| `test:visual:e2e` | Playwright 双轨 | 刻意不接 CI，需完整服务栈（审计 §7） | `NOT_EXECUTED` |
| `test:axe` | axe-core 2 spec | 刻意不接 CI（审计 §7） | `NOT_EXECUTED` |
| PageHeader 一致性 | 无现成脚本（组件不存在） | 不可判定 | `NOT_VERIFIED` |
| 12 类模板 12 区域落地 | 无现成脚本 | 不可判定 | `NOT_VERIFIED` |
| 全量构建 | `bun run build:check` 等 | 并发 WIP 211 项，审计标 `NOT_EXECUTED` | **不执行** |

---

## 验证状态

| 项 | 状态 | 说明 |
|---|---|---|
| 本规范文本 | `ACTIVE` | 已撰写，供评审 |
| 12 类模板 / 12 区域契约 | `NOT_VERIFIED` | 规范层定义，未跑门禁或测试 |
| 73 路由归类 | `NOT_VERIFIED` | 归类为口径映射，未做代码级一致性校验 |
| PageHeader 独立组件 | `NOT_VERIFIED` | 3.0 `:3339` 未闭合项，补齐候选 |
| 3.0 §22 73 项验收 | `NOT_VERIFIED` | 全部 `- [ ]`，不得继承为通过 |
| 视觉基线覆盖 | `NOT_VERIFIED` | 仅 22 / 73 页有基线 |
| 65 个组件证据 | `NOT_VERIFIED` | `VERIFIED 0 / PARTIAL 9 / NOT_VERIFIED 56`，`components:registry:strict EXIT=1` |
| 全量构建 / 视觉回归 / E2E | `NOT_EXECUTED` | 审计 §1 / §7 / §13 / §14 约束 |
| Android / iOS / HarmonyOS | `NOT_VERIFIED` | 无真实实现（审计 §8、结论 C） |

> **最终状态低于 `FULLY_IMPLEMENTED_AND_VERIFIED`**：本规范不宣称任何页面模板或路由已通过验证。
