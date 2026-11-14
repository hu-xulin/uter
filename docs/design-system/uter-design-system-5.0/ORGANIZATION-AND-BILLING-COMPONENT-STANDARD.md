# 组织与账单组件规范（Organization and Billing Component Standard）

> UTER Design System 5.0 · 分册 S31。本规范定义「组织切换/成员/权限与账单/订单/退款/余额的界面契约与状态真实性要求」。**核心口径：资金链路真实性与组织范围标注优先**——订单最终状态必须来自服务端确认；第三方支付返回页面不是支付成功的权威来源；组织级额度/账单/用量必须显式标注组织范围，防止个人与组织数据混淆。**5.0 为当前正式体系，3.0 保留为历史**。除标明已核实的真源代码位置外，未宣称任何测试通过或平台验收。

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S31` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01`（UTER Design System 5.0 总纲） |
| 生效日期 | `2026-11-14` |
| 适用范围 | `web/src/features/organization/`（8 文件）、`web/src/routes/_authenticated/organization/index.tsx`、`web/src/features/wallet/`（40 文件）、`web/src/features/usage-logs/`（80 文件）中与组织范围、余额、充值、订单、支付、账单明细相关的**界面与状态呈现**；不适用于后端资金逻辑、订单状态机、授权判定、配额扣减 |
| 验证状态 | `NOT_VERIFIED` |

---

## 1. 总则

| # | 原则 | 规则 | 判定依据 |
|---|---|---|---|
| OB-1 | 资金状态真实性优先于视觉一致性 | 任何界面不得在服务端未确认时展示「成功/已到账/已退款」；等待期只显示「处理中 / 确认中」 | `UDS5-S22` §1.2 R1；§4 退款与订单专项说明 |
| OB-2 | 订单状态以仓库枚举为准 | 界面状态集合必须等于 `common.TopUpStatus*` 真值，不得自行扩项或照搬蓝图枚举 | `common/constants.go:346-349`；§2 事实基线 |
| OB-3 | 组织范围必须显式标注 | 展示组织级额度、账单、成员用量时必须带组织名称或显式「组织范围」标识；个人数据与组织数据不得同屏混排且不加区分 | `UDS5-S22` §3 其他现有模块行；`middleware/org_scope.go` |
| OB-4 | 权限名称与后端逐字一致 | 界面角色标签集合必须等于 `model.OrgRole*`；`owner`/`admin`/`department_admin`/`member` 不得增删改名 | `model/organization.go:17-20`；§2 事实基线 |
| OB-5 | 危险操作二次确认 | 角色提升/转移、成员移除、额度上限变更等操作必须走 `ConfirmDialog` + 服务端校验；不得使用浏览器原生 `window.confirm` | `web/AGENTS.md` 3.3；`components/confirm-dialog.tsx` |
| OB-6 | 金额呈现唯一真源 | 金额一律走 `@/lib/format` / `@/lib/currency` / `features/wallet/lib/format.ts` 的既有封装；禁止手写 `toFixed` 拼币种 | `web/AGENTS.md` 3.1；`UDS5-S19` §4.2；§8 |
| OB-7 | 只约束呈现，不改业务 | 本规范**零改动** `org_role` / `sub_quota_limit` / `EnforceOrgQuota` / `IncrOrgUsedQuota` / 订单状态机 / 支付契约 / 授权判定 | `UDS5-S22` §1.2 R1/R2/R3 |
| OB-8 | 不虚构页面与流程 | 仓库中不存在的组织切换器、邀请流程、订单页、退款页、发票功能、组织级 API Key、组织级账单，一律不得在界面文案、导航、验收清单中声称存在 | `UDS5-S22` §4；§13 差异登记 S31-D01、S31-D08…S31-D13 |
| OB-9 | 视觉与组件复用既有封装 | 组织与账单页面优先复用 `ui/`（66 实现）、`data-table/`（24 导出）、`status-badge.tsx`、`confirm-dialog.tsx`；禁止绕过基础组件自绘 | `UDS5-S14` §3；`UDS5-S19` §5 |

---

## 2. 事实基线（引自审计报告与参考分析，不得假设）

| 项 | 真实值 | 来源 |
|---|---|---|
| 组织角色枚举 | `owner` / `admin` / `department_admin` / `member`（4 值） | `model/organization.go:17-20`；前端 `features/organization/types.ts:23` 的 `OrgRole`（含 `''` 无归属） |
| 前端角色标签 | `ROLE_LABEL_KEY` 映射 `Owner`/`Admin`/`Department Admin`/`Member`（空值渲染 `Member`） | `features/organization/index.tsx:82-88` |
| 组织管理角色白名单 | `ORG_MANAGE_ROLES = ['owner', 'admin', 'department_admin']`；`member` 无任何组织管理权 | `web/src/lib/roles.ts:54-55`；后端 `middleware.OrgAdminAuth()` 放行清单逐字一致 |
| 组织状态枚举 | `1 = 启用`（`OrgStatusEnabled`）、`2 = 停用`（`OrgStatusDisabled`）；`OrgStatusUnchanged = -1` 为「不修改」哨兵 | `model/organization.go:62-73`；前端 `ORG_STATUS_ENABLED/DISABLED` |
| **充值订单状态枚举** | **仅 4 值**：`pending` / `success` / `failed` / `expired` | `common/constants.go:346-349` |
| 订阅记录状态枚举 | `active` / `consumed` / `refunded` / `cancelled` / `expired`（与订单状态是**两套独立集合**） | `model/subscription.go:470,556,1087,1312,1514,1594` |
| 前端订单状态类型 | `TopupStatus = 'success' \| 'pending' \| 'expired'`（**未含 `failed`**）；`STATUS_CONFIG` 仅映射 3 项，`getStatusConfig` 兜底回 `pending` | `features/wallet/types.ts:287`、`features/wallet/lib/billing.ts:36-50,53-56` |
| 支付宝查单状态 | `success` / `pending` / `unpaid` / `closed`（**查单接口返回值集合，非订单状态机**） | `features/wallet/lib/alipay-return.ts:24` |
| 订单幂等迁移 | `claimPendingTopUp` 以 `WHERE status = 'pending'` 条件更新决定胜者，只有胜者入账；并发重复回调按幂等重复处理 | `model/topup.go:172-201`、`363-371` |
| 订单失败原因 / 过期迁移 | `FailReason` 字段（`varchar(255)`）持久化失败原因，`MarkFailed(reason)` 截断至 255；`UpdatePendingTopUpStatus(tradeNo, provider, TopUpStatusExpired)`，订阅订单过期时同步 `transitionLinkedSubscriptionTopUpTx` | `model/topup.go:29-33,203-238,263-307`、`controller/topup_alipay.go:346`、`controller/topup_wechat.go:524`、`controller/topup_stripe.go:477`、`model/subscription.go:809-812` |
| 对账窗口 | `topUpQueryWindowSeconds = 30 * 24 * 60 * 60`（30 天）；`ListPendingTopUpsForReconcile` 按 `status = pending AND payment_provider = ? AND create_time >= ?` 取待对账单 | `model/topup.go:548-553,573-590` |
| 管理员手工补单 | **已禁用**：`AdminCompleteTopUp` 恒返回 `ErrManualTopUpDisabled`，仅「已验证的支付回调」或「自动对账」可结算订单并改余额 | `controller/topup.go:889-901`、`model/topup.go:695` |
| 充值金额边界 | `getMinTopup` / `getMaxTopUpAmount` / `validateTopUpQuota` / `rejectInvalidTopUpAmount`（超两位小数拦截）/ `formatTopUpAmount`（`FormatFloat 'f' -1`） | `controller/topup.go:294-372,397-404` |
| 配额入口 | `EnforceOrgQuota`（准入校验）、`ReserveOrgQuota`（原子预扣）、`IncrOrgUsedQuota`（成功后累加），三者均以 `quota <= 0` 表示不限量 | `model/organization.go:749-772,836-907,958-984` |
| 组织数据隔离 | `OrgDataScope{OrgID, Department, NoDepartment}`；`OrgID == 0` 为平台视角；部门管理员未分配部门时 **fail-closed 返回空集哨兵** | `middleware/org_scope.go:15-40,44-60,140-160` |
| 组织 API 端点 | `GET /api/organization/self`（UserAuth）；`OrgAdminAuth` 组 15 个 `/:id/*` 端点（`orgAdminRoute`，含 `stats` / `members` / `logs` / `quota-dates` / `flow` / `tasks` / `drawings` / `audit`）；`RootAuth` 组 `GET/POST /api/organizations` | `router/api-router.go:218-250` |
| 前端组织 API | `getMyOrganization` / `createOrganization` / `getOrganizationStats` / `getOrganizationMembers` / `addOrganizationMembers` / `updateOrganizationMember` / `removeOrganizationMember` / `updateOrganization`（8 个） | `features/organization/api.ts:35-127` |
| 组织页面结构 | `OrganizationPage` + `CreateOrganizationCard` / `LoadErrorCard` / `NoOrganizationCard` / `MyQuotaCard` / `OrgOverviewCard` / `AddMemberCard` / `MembersCard` / `EditMemberDialog` / `SubQuotaInput`（全文 1505 行） | `features/organization/index.tsx:111,126,197,442,619,641,664,716,938,1142,1383` |
| 组织路由守卫 | `beforeLoad` 调 `canManageOrganization(auth.user)`，不通过则 `redirect('/403')` | `routes/_authenticated/organization/index.tsx:26-38` |
| 组织权限梯度 | `canManageMembers`（超管/owner/admin）、`canAdjustSubQuota`（+department_admin）、`canGrantOwner`（超管/owner）；`roleOptions` 随梯度收敛为 4/3/2 项 | `features/organization/index.tsx:221-233,1190-1192` |
| 钱包组件清单（40 文件） | 顶层 4（`index.tsx` / `api.ts` / `types.ts` / `constants.ts`）；`components/` 12（`wallet-stats-card` / `recharge-form-card` / `subscription-plans-card` / `affiliate-rewards-card` / `creem-products-section` + `dialogs/` 6：`billing-history-dialog` / `cn-pay-web-dialog` / `payment-confirm-dialog` / `creem-confirm-dialog` / `transfer-dialog` + 1 测试）；`hooks/` 10（8 实现 + `index.ts` + 1 测试）；`lib/` 13（8 实现：`affiliate` / `alipay-return` / `billing` / `format` / `payment-redirect` / `payment` / `ui` + `index.ts` + 5 测试）；`__tests__/` 1 | `features/wallet/` 目录实测 |
| 金额格式化真源 | `@/lib/format`（`formatNumber` / `formatCompactNumber` / `formatQuota` / `formatTimestamp` / `formatUserId`）、`@/lib/currency`（`formatCurrencyFromUSD` / `formatBillingCurrencyFromUSD` / `formatLocalCurrencyAmount` / `formatQuotaWithCurrency` / `getCurrencyLabel`）、`features/wallet/lib/format.ts`（`formatCNYAmount` / `formatCreemPrice` / `formatQuotaShort`）、`features/wallet/lib/payment.ts:184`（`formatPaymentAmount`） | 上述文件实测；`web/AGENTS.md` 3.1 |
| 组织级数据入口 | 组织级用量仅经 `/api/organization/{id}/logs` / `stat` / `quota-dates` / `quota-dates/users` / `flow` / `tasks` / `drawings` / `audit` 只读端点暴露；**无组织级账单、API Key、充值入口** | `router/api-router.go:233-240`；S31-D08、S31-D09 |
| 订单无独立路由 | 无订单路由、无退款路由、无独立 refund 文件；账单历史以 `billing-history-dialog.tsx` 弹窗承载 | `UDS5-AUDIT-01` §6.1；`UDS5-S22` §4 |
| 仓库无发票 / 无组织切换器 / 无邀请流程 | 全仓无 invoice 实现（仅 `lib/currency.ts:488` 注释提及 "Billing/invoice amounts"）；全仓无 `org-switcher` / `switchOrg` / 组织列表选择器，用户仅有一个 `organization_id`；`features/organization/` 无 invite 相关代码（`QuotaForInviter`/`QuotaForInvitee` 属系统设置中的推广奖励，与组织邀请无关） | 全仓 grep 实测；`features/system-settings/general/quota-settings-section.tsx:57-58` |
| 组织级 API Key | `features/keys/` 无 `organization_id` 概念，API Key 无组织归属 | `features/keys/` 目录实测 |

---

## 3. 范围与业务红线

### 3.1 本规范允许的动作

1. 仅规范**界面契约**：组织/成员/权限的标签、层级、状态呈现、金额格式、订单状态文案、等待期反馈、二次确认入口。
2. 允许复用 `ui/`、`data-table/`、`status-badge.tsx`、`confirm-dialog.tsx` 等既有封装统一视觉。
3. 允许补齐加载 / 错误 / 空三态与响应式断点。

### 3.2 本规范严禁的动作（红线，与 `UDS5-S22` §1.2 一致）

| # | 红线 | 依据 |
|---|---|---|
| R-B1 | 零改动资金逻辑：`common.TopUpStatus*`、`claimPendingTopUp`、`MarkFailed`、`FailReason`、`getTopUpQuota`、`getMaxTopUpAmount`、`validateTopUpQuota`、`rejectInvalidTopUpAmount`、`formatTopUpAmount` 全部只读 | `UDS5-S22` §1.2 R1 |
| R-B2 | 零改动授权与配额：`org_role` 判定、`sub_quota_limit`、`EnforceOrgQuota` / `ReserveOrgQuota` / `IncrOrgUsedQuota`、`OrgAdminAuth`、`OrgDataScope` | `UDS5-S22` §1.2 R2 |
| R-B3 | 不新增 / 不虚构订单页、退款页、发票功能、组织切换器、邀请流程；界面文案与验收清单不得声称其存在 | `UDS5-S22` §1.2 R5；`UDS5-S01` §11 |
| R-B4 | 不新增依赖（不引入 Clerk SDK / Storybook / 支付 SDK） | `UDS5-S22` §1.2 R4 |
| R-B5 | 不新增 / 不改写业务数据字段、接口路径、计费规则 | `UDS5-S22` §1.2 R3 |

> **判定口径**：任何改动若 diff 触及 `model/topup.go`、`controller/topup.go`、`model/organization.go`、`middleware/org_scope.go`、`features/wallet/lib/payment.ts` 的资金语义，或触及 `org_role` / `sub_quota_limit` 的判定，即视为越界，必须回退。

---

## 4. 组织切换器

### 4.1 现状与边界

仓库**不存在组织切换器**：用户账号仅绑定单一 `organization_id`，`GET /api/organization/self` 返回唯一组织。本节因此**不是**「实现一个切换器」的规范，而是**禁止虚构切换器**并规定「组织上下文」在既有页面中的呈现方式。

| 项 | 规则 |
|---|---|
| OB-4.1 | 不得在顶栏、侧边栏、设置页出现「切换组织」入口、当前组织下拉或多组织列表（仓库无此数据与接口） |
| OB-4.2 | 页面须显式标注**当前组织上下文**：组织页所有卡片标题使用 `org.name`；`MyQuotaCard` 保留「You belong to this organization. Your consumption is billed to the organization budget; you can only view your own data.」这一范围说明文案 |
| OB-4.3 | 「无组织」状态渲染 `NoOrganizationCard`，提供的是**加入/等待开通**指引，不得提供「切换到其他组织」文案 |
| OB-4.4 | 超管视角（`canManageOrganization` 对 `role >= ROLE.SUPER_ADMIN` 返回 `true`）进入组织页时，展示的是**被管理组织**的上下文，卡片标题必须是该组织名，不得显示为「我的组织」 |
| OB-4.5 | 组织级日志/统计查询走 `/api/organization/{orgId}/logs` 等组织端点（`features/usage-logs/api.ts:170,175,210,215`），界面须标注所用组织 id 或名称 |

### 4.2 差异登记（对照蓝图 ORGANIZATION-COMPONENT-STANDARD §2）

蓝图要求「展示当前组织名称和可用组织列表；切换时明确当前上下文变化。切换失败应保留原组织上下文并提示原因。无组织状态应提供符合权限的创建/加入入口。」——**可落地部分**（当前组织名称展示、无组织状态指引）已在仓库存在（`OrgOverviewCard` / `MyQuotaCard` / `NoOrganizationCard`）；**不可落地部分**（组织列表与切换、切换失败回滚）因仓库无多组织数据模型与切换接口，登记为 S31-D01，不得在界面中虚构。

---

## 5. 成员与邀请

> **风险等级归属**：§5.1 的成员移除（`OB-5.6`）属 `UDS5-S01` §4A 的 **`RISK-P0`**（蓝图 §8 明列「权限提升、账户删除」为业务风险 P0 档〔本分册一律写作 `RISK-P0`〕，成员移除属组织内权限撤销，同级处理）；§5.1 其余展示类规则属 `RISK-P2`；§5.2 邀请流程在仓库**不存在**，整体标 `NOT_IMPLEMENTED`（见 §2 与 §4.2）。

### 5.1 成员列表（仓库真实存在）

| 项 | 规则 |
|---|---|
| OB-5.1 | 成员列表展示身份（`formatUserId` 对外编号，禁止裸数字 id）、角色（`OrgRole`）、部门、用量；**不得展示「邀请状态」列**（仓库无邀请实体） |
| OB-5.2 | 成员角色徽标/下拉的取值集合必须严格等于 `OrgRole`；空值渲染为 `Member` 标签（`ROLE_LABEL_KEY[''] = 'Member'`） |
| OB-5.3 | 可操作范围必须与 `canManageMembers` / `canAdjustSubQuota` / `canGrantOwner` 及 `canEditRoleOf` / `canEditSubQuotaOf` / `canEditMemberOf` 的服务端判据一致；**界面禁用态不得弱于服务端**（如 admin 不可改 owner 行、department_admin 不可改自己与上级） |
| OB-5.4 | 成员子额度（`sub_quota_limit`）以**金额**展示与输入，不得展示裸 quota 整数（`fmtQuota` 已按 `quotaPerUnit` 换算；`parseSubQuotaAmount` 以 `Math.ceil` 向上取整并对不安全整数拒绝）。**仓库现状**：上限变更走 `UpdateOrganizationMember`，未挂强验证、无审计留痕（登记为 S31-D14） |
| OB-5.5 | 「0 = 不限」必须显示为 `Unlimited` 文字，不得渲染为 `0` 或 `$0.00` |
| OB-5.6 | 成员移除属破坏性操作，须走 `ConfirmDialog`（`components/confirm-dialog.tsx`）二次确认；**不得使用 `window.confirm`**（现状 `features/organization/index.tsx:411` 使用 `window.confirm`，登记为 S31-D07） |
| OB-5.7 | 成员操作失败须保留列表上下文并就近提示，不得渲染为「空列表」（`UDS5-S20` §4） |

### 5.2 邀请（仓库不存在）

| 项 | 规则 |
|---|---|
| OB-5.8 | **禁止**出现邀请状态机（`pending` / `accepted` / `expired` / `revoked`）、邀请链接、邀请过期倒计时等任何界面元素——仓库无邀请数据模型、无邀请 API、无邀请组件 |
| OB-5.9 | 成员加入的真实路径是「按用户名/用户 ID 直接添加」（`POST /api/organization/:id/members`，payload 含 `user_id` / `sub_quota_limit` / `department_name`）；界面须按此语义表述为「添加成员」而非「邀请成员」 |
| OB-5.10 | `AddMemberCard` 的新增行须给出可移除反馈与重复添加失败原因；重复添加以服务端返回为准，界面不得自行判定「已存在」 |

---

## 6. 角色与权限（后端模型一致性）

### 6.1 角色集合（唯一真值）

| 角色 | 后端常量 | 界面标签 | 后端放行范围（已核实） |
|---|---|---|---|
| owner | `model.OrgRoleOwner` | `Owner` | 组织全部管理权；唯一可授予 owner（超管或当前所有者） |
| admin | `model.OrgRoleAdmin` | `Admin` | 管理本组织成员；**不可**作用于 owner 及其他 admin（防越权互踢） |
| department_admin | `model.OrgRoleDepartmentAdmin` | `Department Admin` | 仅本部门成员；未分配部门时 fail-closed 可见空集 |
| member | `model.OrgRoleMember` | `Member` | 无组织管理权；仅见自身额度 |

### 6.2 权限呈现规则

> **风险等级归属**：`OB-6.3`（角色提升 / 转移，授予或变更 `owner` / `admin`）属 `UDS5-S01` §4A.2 明列的「**权限提升**」→ **`RISK-P0`**（必须二次确认 + 显式说明影响范围 + 服务端最终裁决）；`OB-6.4`（权限编辑入口的选项收敛）触及配置类写操作入口，属 **`RISK-P1`**；`OB-6.1` / `OB-6.2` / `OB-6.5` / `OB-6.6` 为角色标签呈现与可见性收敛，属 `RISK-P2`。

| 项 | 规则 |
|---|---|
| OB-6.1 | 角色名称、徽标、筛选值必须与上表逐字一致；禁止使用「管理员 / 超级管理员 / 员工」等后端不存在的同义写法 |
| OB-6.2 | `member` 的组织模块入口不得对用户可见（与 `canManageOrganization` 返回 `false` 一致）；普通成员进入 `/organization` 被 `beforeLoad` 重定向 `/403`，界面须给出该结果的解释性文案 |
| OB-6.3 | **角色提升/转移（授予或变更 `owner`/`admin`）属高风险操作**：必须二次确认（`ConfirmDialog`，`destructive` 变体）并显式说明影响范围（该成员将获得的组织级权限、影响的成员范围）；服务端 `UpdateOrganizationMember` 仍是最终裁决（`model.IsValidOrgRole` + 授予 owner 判据 + 非超管不得降权 owner）。**仓库现状**：该写操作未挂 step-up 强验证、亦无审计留痕，登记为 S31-D14，本规范不得据此降低界面侧的确认强度 |
| OB-6.4 | 权限编辑入口须标注「可选项随当前身份收敛」：`roleOptions` 分别为 4 / 3 / 2 项（`canGrantOwner` / `canManageMembers` / `canAdjustSubQuota`），界面不得展示越权选项后再依赖失败回显 |
| OB-6.5 | 平台超管（`ROLE.SUPER_ADMIN`）身份在组织页须显式标注，避免与组织内 owner 混淆 |
| OB-6.6 | 任何权限相关的失败提示不得暴露他人敏感信息；`UDS5-S20` §5 保留服务端 `message` 原因 |

---

## 7. 组织级数据范围标注

| 项 | 规则 |
|---|---|
| OB-7.1 | **组织级额度**（`organizations.quota` / `used_quota` / 剩余）须带组织名与币种标签，渲染口径沿用 `OrgOverviewCard` 的 `Total Budget ({currency})` / `Remaining ({currency})` + `fmtQuota` |
| OB-7.2 | **个人额度**与**组织额度**必须分卡呈现，不得合并为一个数字：仓库已分为 `MyQuotaCard`（个人子额度）与 `OrgOverviewCard`（组织总预算），此划分不得合并 |
| OB-7.3 | **组织成员用量**（`OrgMember.used_quota` / `sub_quota_limit`）在成员表内展示时，表头须写明「Sub-quota Limit ($)」口径（金额而非 token 数） |
| OB-7.4 | **组织级账单**在仓库中不存在独立入口（组织路由组无任何 topup / billing 端点）；因此界面**不得**出现「组织账单」入口或组织维度的充值记录列表 |
| OB-7.5 | **组织级 API Key** 在仓库中不存在（`features/keys/` 无 `organization_id`）；组织页面**不得**展示「组织 API Key」区块 |
| OB-7.6 | **组织级用量**（`/api/organization/{id}/logs` / `stat` / `tasks` / `drawings` / `flow` / `audit`）在 `usage-logs` 页面须标注组织范围来源；组织管理者视角由 `useOrgManagerScope` 的 `isOrgManager` + `organization_id` 决定（平台管理员即使属于某组织也走全局接口，二者正交） |
| OB-7.7 | 跨组织数据隔离由 `OrgDataScope` 保证；界面**不得**提供「查看全部组织」的人工入口来绕过 `NoDepartment` 的 fail-closed 空集语义 |
| OB-7.8 | 所有用户 ID 展示必须走 `formatUserId`（`U` + 偏移基数），避免「同一个人两个 ID」 |

---

## 8. 金额呈现与订单状态

### 8.1 金额呈现

| 项 | 规则 |
|---|---|
| OB-8.1 | 金额**必须**带货币单位，禁止只显示数字省略币种（`UDS5-S19` §4.2；蓝图账单规范 §2） |
| OB-8.2 | 金额一律走既有封装：`@/lib/format`（`formatNumber` / `formatCompactNumber` / `formatQuota`）、`@/lib/currency`（`formatCurrencyFromUSD` / `formatBillingCurrencyFromUSD` / `formatLocalCurrencyAmount`）、`features/wallet/lib/format.ts`（`formatCNYAmount`）、`features/wallet/lib/payment.ts:184`（`formatPaymentAmount`）；**禁止手写 `toFixed` 拼币种**（现状 `features/wallet/components/subscription-plans-card.tsx:542` 与 `features/wallet/lib/format.ts:35` 使用 `toFixed(2)`，登记为 S31-D05） |
| OB-8.3 | 精度不得为格式统一而截断：钱包余额与总用量用 `fixedFractionDigits: 2`（`wallet-stats-card.tsx:52` 的 `moneyFormat`）；「≥1 两位、<1 四位」是 `formatQuota` 默认口径（`web/src/lib/format.ts:65-75`） |
| OB-8.4 | **币种语义按通道区分**：官方直连支付宝 / 微信支付的应付金额恒为人民币，必须用 `formatCNYAmount` 强制 `¥`，不得跟随 `quotaDisplayType` 显示成 `$`（`features/wallet/lib/format.ts:52-88`、`payment.ts:184-211`）；Stripe / Waffo / Waffo Pancake / Creem 走 `formatPaymentAmount` 的 USD 分支 |
| OB-8.5 | 「充值额度（额度单位）」与「实付金额（通道币种）」必须**分字段呈现**，不得合并成一个数字：仓库已分列 `Topup Amount` 与 `You Pay`（`payment-confirm-dialog.tsx:135-155`、`cn-pay-web-dialog.tsx:258-275`）；`Amount`（额度）与 `Payment`（实付）在账单历史中同样分列（`billing-history-dialog.tsx:196-209`） |
| OB-8.6 | 折扣、手续费、原价、实付必须区分：仓库已有 `You save` 折扣行（`payment-confirm-dialog.tsx:161-172`）与 `PresetDiscountBadge`；新增文案不得复用「金额」一词承载多义 |
| OB-8.7 | **负数与退款金额**必须使用明确符号与文字（`-` 或 `−` + 文字说明），禁止仅靠颜色区分；`formatQuota` / `formatCurrencyFromUSD` 的负号输出必须保留 |
| OB-8.8 | 「不限」用文字 `Unlimited`，禁止显示 `0` / `$0.00` / `∞`（`features/organization/index.tsx:694`、`sub-quota.ts:41,49` 的 `unlimited` 语义） |
| OB-8.9 | 金额零值区分「0 元」与「-」（`formatTimestamp` 系列以 `-` 表示无值，金额字段不得复用该约定，须显式写 `0.00` 或业务文案） |

### 8.2 订单状态（以仓库枚举为准）

**真实状态集合（4 值，`common/constants.go:346-349`）**：

| 后端常量 | 字面量 | 语义 | 前端呈现要求 |
|---|---|---|---|
| `TopUpStatusPending` | `pending` | 已创建、等待支付或等待服务端确认 | 必须显示「处理中 / 确认中」语义，**不得**显示成功；徽标走 `warning`（`billing.ts:41-44`） |
| `TopUpStatusSuccess` | `success` | 服务端已幂等入账 | 显示成功 + 服务端完成时间（`complete_time`），徽标走 `success`（`billing.ts:37-40`） |
| `TopUpStatusFailed` | `failed` | 订单失败，附 `FailReason` | 显示失败 + 失败原因文本，徽标走 `danger`；**前端 `TopupStatus` 与 `STATUS_CONFIG` 当前缺此值**（登记为 S31-D03） |
| `TopUpStatusExpired` | `expired` | 订单过期（窗口由 `UpdatePendingTopUpStatus` / 渠道回调触发） | 显示过期 + 「需重新下单」指引，徽标走 `danger`（`billing.ts:45-48`） |

**不得出现在订单状态集合中的字面量**（蓝图枚举中的其余 5 项在仓库中不存在）：

| 蓝图枚举 | 仓库事实 | 处理 |
|---|---|---|
| `processing` | 不存在 | 等待期用 `pending` 的「处理中 / 确认中」文案表达，不得虚构独立状态 |
| `paid` | 不存在 | 仓库用 `success`；界面文案可写「支付成功」但**数据属性 / 筛选值必须是 `success`** |
| `cancelled` | 不存在 | 仓库无「用户取消订单」状态；`model/subscription.go:1087` 的 `"cancelled"` 属**订阅记录**，不是订单 |
| `refunding` | 不存在 | 仓库无退款单据 |
| `partially_refunded` | 不存在 | 仓库无部分退款 |
| `refunded` | **仅存在于订阅记录**（`model/subscription.go:1594,1600`，为预扣退款的内部记录），不是充值订单状态 | 不得在订单状态筛选/徽标中出现 |

> **状态来源规则（OB-2 落地）**：订单状态**只能**来自服务端返回的 `status` 字段或服务端查单接口结果；禁止由前端根据「是否跳转成功」「是否收到回调参数」「本地是否已提交」推断。前端可读的查单状态集合是 `success`/`pending`/`unpaid`/`closed`（`features/wallet/lib/alipay-return.ts:24`），其中 `unpaid` 与 `closed` 是**终态**（立即停止轮询），`pending` 继续等待，只有 `success` 才可展示成功。

---

## 9. 支付流程（5 步）

> 蓝图账单规范 §4 的五步在仓库中的真实落点如下；每步均标注「等待期不得提前展示成功」的要求。

| 步 | 蓝图要求 | 仓库真实实现 | 界面契约 |
|---|---|---|---|
| 1 | 展示订单金额、币种、支付方式和有效期 | 金额与币种由 `PaymentConfirmDialog` 呈现（`Topup Amount` / `You Pay` / `Payment Method`）；**订单有效期仓库无字段**，不得虚构倒计时 | 有效期缺失时不得编造截止时间文案 |
| 2 | 用户确认后创建订单 | 确认弹窗为 `AlertDialog`（`payment-confirm-dialog.tsx:120`），创建订单在 `cn-pay-web-dialog.tsx:109-158` 的 `createOrder()`；金额由服务端 `requestPaymentAmount` 计算 | 计价失败（`calculatingError`）**不得**打开确认框并显示「应付 0 元」（`features/wallet/index.tsx:279-283` 已阻断） |
| 3 | 展示服务端返回的支付指引 / 二维码 / 跳转入口 | 二维码来自服务端 `code_url`；移动端跳转 `pay_url` / `h5_url`；跳转与二维码**均由服务端下发**，前端不得自造 | 二维码渲染失败给出可重试错误，不得渲染为空 |
| 4 | 等待服务端通知或查询确认 | `pollAlipayOrder` 有限次轮询（`attempts = ALIPAY_RETURN_QUERY_ATTEMPTS = 4`，`intervalMs = ALIPAY_RETURN_QUERY_INTERVAL_MS = 2000`），查单接口为服务端 `queryAlipayOrder` / `queryWechatOrder`；另有服务端读时对账 `reconcileUserPendingAlipayOrders` / `reconcileUserPendingWechatOrders`（`controller/topup.go:820-829`） | 等待期文案用 `Waiting for payment confirmation...`（`cn-pay-web-dialog.tsx:287`）；**只有服务端返回 `success` 才显示 `Payment successful`**（`:281`） |
| 5 | 展示最终状态和后续操作 | 最终状态来自账单历史列表的 `status`（服务端读时对账后给出）；`GetUserTopUps` 30 天窗口内可见 | 终态提供「查看账单记录 / 重新下单」出口；`unpaid`/`closed` 提示重新下单 |

### 9.1 资金真实性红线（最高优先级）

> **风险等级归属**：本节 8 条全部属 `UDS5-S01` §4A 的 **`RISK-P0`**（支付 / 退款 / 余额变更）。裸写 `P1` / `P2` 在本分册一律指 `UDS5-S01` §4A.1 定义的**待办优先级**，非业务风险等级。

| # | 规则 | 依据 |
|---|---|---|
| OB-9.1 | **最终状态必须来自服务端确认**。前端轮询 / 回调等待期只显示「处理中 / 确认中」，**不得提前展示成功** | 蓝图账单规范 §3；`UDS5-S22` §4 |
| OB-9.2 | **第三方支付返回页面不是支付成功的权威来源**。支付回跳 URL 上的任何成功参数不得直接驱动「已到账」；到账以**服务端幂等入账与对账结果**为准 | 蓝图账单规范 §4 |
| OB-9.3 | **不得在客户端仅凭支付渠道跳转成功增加余额**。余额刷新只能来自服务端返回的用户额度（`fetchUser` / 服务端响应） | 蓝图账单规范 §6 |
| OB-9.4 | **重复点击不得创建重复订单**：提交中按钮禁用（`paymentLoading` / `processing`），下单入口在 `processing` 或 `calculating` 期间禁用（`payment-confirm-dialog.tsx:193`） | 蓝图账单规范 §4；`UDS5-S18` 防重复提交 |
| OB-9.5 | **刷新后须能恢复订单状态**：页面重进后从服务端列表 / 查单接口恢复，不依赖内存态（`cn-pay-web-dialog` 以 `trade_no` 为主键重新查单） | 蓝图账单规范 §4 |
| OB-9.6 | **重试不得重复扣款**：重试必须复用同一 `trade_no` 的服务端幂等路径（`claimPendingTopUp` 的 `status = 'pending'` 条件更新保证只有胜者入账），不得在前端重发一次「付款」 | `model/topup.go:172-201` |
| OB-9.7 | **管理员手工补单按钮不得作为可用资金入口展示**。后端 `AdminCompleteTopUp` 恒返回 `ErrManualTopUpDisabled`（`controller/topup.go:889-901`），前端 `billing-history-dialog.tsx:210-218` 仍对 `isAdmin && status === 'pending'` 渲染「Complete Order」按钮——该路径**必然失败**，属已知不一致（登记为 S31-D04），5.0 规范要求界面不得把它呈现为可结算通道 | `model/topup.go:695` |
| OB-9.8 | **支付失败原因可见**：`FailReason` 由服务端持久化，界面失败态应展示服务端原因而非本地推断 | `model/topup.go:29-33` |

---

## 10. 退款流程

### 10.1 现状：仓库无用户可发起的退款流程

| 项 | 仓库事实 | 来源 |
|---|---|---|
| 独立退款路由 / 页面 / 文件 | **无** | `UDS5-AUDIT-01` §6.1；`UDS5-S22` §4 |
| 退款 API | 充值订单**无**退款端点（`router/api-router.go` 中 `/api/user/topup/*` 无 refund 路由） | `router/api-router.go:192` 附近实测 |
| `refunded` 真实语义 | 仅 `model/subscription.go:1594,1600` 的**订阅预扣退款内部记录**（`refundSubscriptionPreConsumeForUserTx`），不可见用户主动退款 | `model/subscription.go:1587-1600` |
| 消费日志 `Refund` | `LOG_TYPE_ENUM.REFUND = 6`，即**异步任务退款**日志（`Async task refund`），携带 `task_id` / `reason` | `features/usage-logs/constants.ts:63`、`features/usage-logs/components/columns/common-logs-columns.tsx:146`、`features/usage-logs/components/dialogs/details-dialog.tsx:881-895` |
| 发票 / 凭证 | 无实现 | 全仓 grep 实测 |

### 10.2 界面契约

| # | 规则 |
|---|---|
| OB-10.1 | **禁止**新建退款路由、退款页、退款按钮或「申请退款」文案 |
| OB-10.2 | 消费日志中的 `type = 6` 须标注为「异步任务退款 / Async task refund」，展示 `task_id` 与 `reason`，**不得**表述为「订单退款」或「已退款 X 元」 |
| OB-10.3 | 「部分退款 / 全额退款」在仓库无对应业务对象；若业务新增退款能力，须先定义服务端状态枚举与 API，再由本规范补界面契约，**不得先做界面** |
| OB-10.4 | 订阅退款（预扣退回）属内部账本，界面不暴露为「退款成功」；用户可见金额变化以服务端额度为准 |
| OB-10.5 | 任何界面不得以「已提交退款申请」暗示进行中的退款流程（无该状态） |

---

## 11. 余额与到账

| # | 规则 | 依据 |
|---|---|---|
| OB-11.1 | 余额变更须显示**账本口径**（额度单位 / 金额换算口径）、发生时间、关联订单号与状态 | 蓝图账单规范 §6 |
| OB-11.2 | 余额与总用量卡片必须固定两位小数（`moneyFormat = { fixedFractionDigits: 2, abbreviate: false }`），避免 `$199` 掩盖 `$199.4` | `features/wallet/components/wallet-stats-card.tsx:52` |
| OB-11.3 | 兑换码到账以服务端返回的 `response.data` 为准并用 `formatQuota` 呈现（`features/wallet/hooks/use-redemption.ts:46-50`）；后端 `Redeem` 采用状态 CAS 保证同码仅一次入账（`model/redemption.go:155-168`） | 上述文件 |
| OB-11.4 | 兑换码状态集合为 `1 = 启用` / `2 = 停用` / `3 = 已使用`（`common.RedemptionCodeStatus*`），界面不得虚构「已过期」状态；过期由 `expired_time` 判定 | `common/constants.go:333-335` |
| OB-11.5 | 充值到账以**服务端幂等入账与对账结果**为准；对账窗口 30 天内仍为 `pending` 的订单在读时对账（`reconcileUserPendingAlipayOrders` / `reconcileUserPendingWechatOrders`） | `model/topup.go:548-553,573-590`；`controller/topup.go:820-829` |
| OB-11.6 |  affiliate 转账（`transferAffiliateQuota` → `POST /api/user/aff_transfer`）到账后同样以服务端余额为准，界面显示「Pending」与「Total Earned」两个独立口径（`affiliate-rewards-card.tsx:86-87`） | 上述文件 |
| OB-11.7 | 余额刷新后不得出现「负余额未解释」：若服务端返回额度异常，界面按错误态渲染，不得以 `0` 掩盖 | `UDS5-S19` §3 第 9 条 |

---

## 12. 禁止事项汇总

| # | 禁止 | 判定 |
|---|---|---|
| F-01 | 禁止虚构订单页 / 退款页 / 发票功能 / 组织切换器 / 成员邀请流程 / 组织级账单 / 组织级 API Key | 仓库无对应路由、组件、API；出现即为虚构（S31-D01、S31-D08…S31-D13） |
| F-02 | 禁止在服务端未确认时展示「成功 / 已到账 / 已退款 / 已结算」 | OB-1、OB-9.1 |
| F-03 | 禁止仅凭支付渠道跳转成功或回跳 URL 参数增加余额 / 显示成功 | OB-9.2、OB-9.3 |
| F-04 | 禁止手写 `toFixed` / 拼接币种符号展示金额；禁止只显示数字省略币种 | OB-6、OB-8.2、OB-8.1 |
| F-05 | 禁止个人数据与组织数据同屏混排且不加范围标注 | OB-3、OB-7.2 |
| F-06 | 禁止在界面展示仓库不存在的组织角色、组织状态、订单状态、兑换码状态 | OB-2、OB-4、§8.2 |
| F-07 | 禁止用 `window.confirm` 做危险操作二次确认；必须走 `ConfirmDialog` | OB-5、OB-5.6 |
| F-08 | 禁止绕过 `components/ui/` 与 `components/data-table/` 自绘同等控件（现状 `features/wallet/` 与 `features/organization/` 均未复用 `data-table`，登记 S31-D06） | OB-9、`web/AGENTS.md` 3.3 |
| F-09 | 禁止改动 `org_role` / `sub_quota_limit` / `EnforceOrgQuota` / `IncrOrgUsedQuota` / 订单状态机 / 支付契约 | OB-7、§3.2 |
| F-10 | 禁止把管理员「Complete Order」呈现为可用的资金结算通道（后端已禁用） | OB-9.7 |
| F-11 | 禁止在余额、订单、成员额度处把「不限」显示为 `0` | OB-8.8 |
| F-12 | 禁止新增依赖（Clerk SDK / Storybook / 支付 SDK / 发票库） | OB-7、§3.2 R-B4 |

---

## 13. 差异与例外登记

| 编号 | 内容 | 状态 |
|---|---|---|
| S31-D01 | **蓝图组织切换器在仓库不存在**。蓝图 ORGANIZATION-COMPONENT-STANDARD §2 要求「可用组织列表 + 切换 + 切换失败回滚」；仓库为单组织归属模型（`users.organization_id` 唯一，`GET /api/organization/self`），全仓无 `org-switcher` / `switchOrg`。规范按「仅标注当前组织上下文、禁止虚构切换器」落地，不实现切换 | `REGISTERED_NOT_IMPLEMENTED` |
| S31-D02 | **蓝图九项订单状态与仓库四项不一致**。蓝图列举 `pending`/`processing`/`paid`/`failed`/`cancelled`/`expired`/`refunding`/`partially_refunded`/`refunded`；仓库 `common/constants.go:346-349` 仅 `pending`/`success`/`failed`/`expired`。`paid` ↔ 仓库 `success`；`processing` 由 `pending` 的「处理中 / 确认中」文案表达；`cancelled` 属订阅记录状态；`refunding`/`partially_refunded`/`refunded` 在订单域不存在 | `REGISTERED` |
| S31-D03 | **前端 `TopupStatus` 与 `STATUS_CONFIG` 缺 `failed`**。`features/wallet/types.ts:287` 仅 `'success' \| 'pending' \| 'expired'`，`features/wallet/lib/billing.ts:36-50` 仅映射 3 项，`getStatusConfig` 对未知值兜底回 `pending`；而后端 `MarkFailed` 会写入 `failed`。结果是服务端「失败」订单在账单历史中可能显示为「Pending / 警告色」。本规范要求界面支持 `failed`（徽标 `danger` + 展示 `FailReason`），但**前端类型与常量属于代码改动，本轮零改动**，登记为待办 | `REGISTERED_NOT_IMPLEMENTED` |
| S31-D04 | **管理员手工补单前后端不一致**。前端 `billing-history-dialog.tsx:210-218` 对 `isAdmin && status === 'pending'` 渲染「Complete Order」按钮并有二次确认弹窗（`:322-341`），但后端 `AdminCompleteTopUp` 恒返回 `ErrManualTopUpDisabled`（`controller/topup.go:889-901`、`model/topup.go:695`），该操作必然失败且不应存在 | `REGISTERED_NOT_IMPLEMENTED` |
| S31-D05 | **存在手写 `toFixed` 拼金额**：`features/wallet/components/subscription-plans-card.tsx:542`（`Number(plan.price_amount \|\| 0).toFixed(2)`）与 `features/wallet/lib/format.ts:35`（`formatCreemPrice` 的 `price.toFixed(2)` + 手写 `$`/`€` 符号）。与 OB-8.2 冲突，登记为待整改项 | `REGISTERED_NOT_IMPLEMENTED` |
| S31-D06 | **钱包与组织页面未复用 `data-table/`**。`features/wallet/` 与 `features/organization/` 全目录无 `data-table` 引用；账单历史以 `div` + `Label` 手搓网格（`billing-history-dialog.tsx:177-208`），成员表同理。与 OB-9 / F-08 冲突，登记为 5.0 分期改造待办（`usage-logs/` 已复用，可作样板） | `REGISTERED_NOT_IMPLEMENTED` |
| S31-D07 | **成员移除使用 `window.confirm`**（`features/organization/index.tsx:411`），而非 `components/confirm-dialog.tsx`；与 OB-5.6 / F-07 冲突 | `REGISTERED_NOT_IMPLEMENTED` |
| S31-D08 | **蓝图「组织级 API Key」在仓库不存在**。`features/keys/` 无 `organization_id` 概念；蓝图 ORGANIZATION-COMPONENT-STANDARD §5 要求「组织级额度、账单、API Key 和用量必须显式标注组织范围」，其中 API Key 一项在仓库无对应对象，规范按 OB-7.5 明确禁止展示 | `REGISTERED_NOT_IMPLEMENTED` |
| S31-D09 | **蓝图「组织级账单」在仓库不存在**。组织路由组 15 个端点中无任何 topup / billing / payment 相关接口；充值与账单历史均为用户级（`/api/user/topup/*`）。规范按 OB-7.4 禁止组织页出现账单入口 | `REGISTERED_NOT_IMPLEMENTED` |
| S31-D10 | **蓝图「订单有效期」字段在仓库不存在**。蓝图账单规范 §4 第 1 步要求展示有效期；`model/topup.go` 的 `TopUp` 结构体无有效期字段（仅 `CreateTime` / `CompleteTime`）。规范按 §9 第 1 步禁止虚构倒计时 | `REGISTERED_NOT_IMPLEMENTED` |
| S31-D11 | **蓝图「邀请状态机」在仓库不存在**。蓝图 ORGANIZATION-COMPONENT-STANDARD §3 要求至少区分 `pending`/`accepted`/`expired`/`revoked`；仓库成员加入为直接添加（`POST /api/organization/:id/members`），无邀请实体、无邀请 API、无邀请组件。规范按 OB-5.8 / OB-5.9 以「添加成员」语义落地 | `REGISTERED_NOT_IMPLEMENTED` |
| S31-D12 | **蓝图「部分退款 / 全额退款必须区分」在仓库无对应业务对象**。仓库无订单退款端点；`model/subscription.go` 的 `refunded` 为订阅预扣内部记录；消费日志 `type = 6` 为异步任务退款。规范按 §10 禁止虚构退款流程 | `REGISTERED_NOT_IMPLEMENTED` |
| S31-D13 | **蓝图「发票 / 凭证（若产品支持）」在仓库无实现**。全仓仅 `web/src/lib/currency.ts:488` 注释提及 "Billing/invoice amounts"。规范按 F-01 禁止呈现 | `REGISTERED_NOT_IMPLEMENTED` |
| S31-D14 | **组织域成员权限 / 额度写操作缺强验证与审计留痕**。`controller/organization.go` 全文无 `requireAdminUserProof` / `CriticalRateLimit` / `VerificationScope` 任一调用；`UpdateOrganizationMember`（`router/api-router.go:230`，`orgAdminRoute.PUT /:id/members/:uid`）可同时写 `sub_quota_limit`（`:553-554`）与 `org_role`（`:558-560`），既无 step-up 强验证也无审计记录——对照同文件 `:275-280` 的 `AddOrganizationMembers` 走 `recordManageAuditFor(c, 0, "organization.member_add", ...)`，成员**新增**有审计而成员**变更**无；`RemoveOrganizationMember`（`router/api-router.go:231`）同理。按 `UDS5-S01` §4A.2，角色提升属 `RISK-P0`、子额度上限变更属 `RISK-P1`（配置类写操作），仓库实现未达该级 | `REGISTERED_NOT_IMPLEMENTED`（真实代码缺陷；修复须挂 `requireAdminUserProof` + `CriticalRateLimit` + 审计补齐，并走 `UDS5-S01` §19 变更流程；**本轮零代码改动**） |

---

## 与其他规范的关系

| 规范 | 关系 | 边界 |
|---|---|---|
| `UDS5-S01` | 上级 / 效力来源 | 服从总纲效力、ID 体系、验证状态口径；本文不重述总则 |
| `UDS5-S14` / `UDS5-S15` / `UDS5-S13` | 被引用 | 组件复用、唯一扩展路径与 API 命名（本文 §12 F-08 的判定依据）；WCAG 2.2 AA 与对比度：状态徽标对比度、金额文本可读性、危险操作确认的可达性 |
| `UDS5-S16` | 被引用 | Billing 模板（钱包 / 账单 / 充值 / 价格）的 Content Area 契约；本文只补组织与资金真实性约束 |
| `UDS5-S17` / `UDS5-S18` / `UDS5-S20` | 被引用 | 交互五态（成功 / 失败 / 取消 / 加载 / 异常）与 15 种交互矩阵（§9 等待期属「加载」态，失败属「可恢复错误」）；表单错误优先级、未保存提醒、防重复提交（充值金额输入与成员额度输入共用）；六类通知组件与五类反馈映射（§9.1、§11 的等待 / 失败提示归属） |
| `UDS5-S19` | 被引用 | 金额 / 货币 / 时间格式与 DataTable 11 项能力；§8.1 引用其 §4.2 货币口径（¥ 为设计基线、Uter 业务保留 USD 语义由业务币种字段决定） |
| `UDS5-S22` | 被引用（**关键**） | §1.2 严禁触碰红线、§4「退款与订单专项说明（防虚构）」为**已定案口径**：退款与订单均无独立路由与页面，本文不得推翻，只在既有弹窗 / 字段展示层细化视觉与状态文案 |
| `UDS5-S24` | 下游 | 本文的资金真实性红线、组织范围标注、禁止虚构页面三类判定，供其页面检查与规范一致性拦截器落地 |
| `web/AGENTS.md` | **强制** | 3.1 数字格式化与 `toIntlLocale()`、3.3 组件先检索后复用、3.9 错误处理、3.14 测试；冲突时以 `web/AGENTS.md` 为准 |
| `UDS5-AUDIT-01` | 事实依据 | §6.1 提供「退款 / 订单无独立页面」与业务红线结论 |

---

## 代码实施位置

| 用途 | 真实路径 | 本文关联 | 本轮状态 |
|---|---|---|---|
| 组织 feature | `web/src/features/organization/`（8 文件：`api.ts` / `index.tsx` / `types.ts` / `use-org-manager.ts` / `org-user-filter.tsx` / `sub-quota.ts` + 2 测试） | §4–§7 | 只读，未改造 |
| 组织路由 | `web/src/routes/_authenticated/organization/index.tsx` | §4.2、§6.2 | 只读 |
| 组织后端模型 | `model/organization.go`（`OrgRole*` / `OrgStatus*` / `EnforceOrgQuota` / `ReserveOrgQuota` / `IncrOrgUsedQuota`） | §2、§6.1、§11 | 只读，**零改动** |
| 组织范围中间件 | `middleware/org_scope.go`（`OrgDataScope` / `OrgAdminAuth`） | §2、§7 | 只读，**零改动** |
| 组织 API 端点 | `router/api-router.go:218-250` | §2 | 只读 |
| 钱包 feature | `web/src/features/wallet/`（40 文件） | §8–§11 | 只读，未改造 |
| 钱包路由 / 充值协议页 | `web/src/routes/_authenticated/wallet/index.tsx`、`web/src/routes/_public/recharge-agreement.tsx` | §9 | 只读 |
| 账单历史弹窗 | `web/src/features/wallet/components/dialogs/billing-history-dialog.tsx` | §8.2、§9 第 5 步、S31-D04 | 只读 |
| 支付弹窗与查单 helper | `wallet/components/dialogs/payment-confirm-dialog.tsx`、`wallet/components/dialogs/cn-pay-web-dialog.tsx`、`wallet/lib/alipay-return.ts` | §8.1、§9 第 4 步 | 只读 |
| 支付与金额格式化库 | `wallet/lib/payment.ts:184`（`formatPaymentAmount`）、`wallet/lib/format.ts`（`formatCNYAmount`）、`web/src/lib/format.ts`、`web/src/lib/currency.ts` | §8.1 | 只读 |
| 订单后端 | `model/topup.go`（`claimPendingTopUp` / `MarkFailed` / `FailReason` / `UpdatePendingTopUpStatus` / `ListPendingTopUpsForReconcile`）、`controller/topup.go`（`GetTopUpInfo` / `formatTopUpAmount` / `getTopUpQuota` / `getMaxTopUpAmount` / `validateTopUpQuota` / `rejectInvalidTopUpAmount` / `AdminCompleteTopUp` / `GetUserTopUps` / `GetAllTopUps`）、`controller/payment_reconcile_task.go`（`reconcileUserPendingAlipayOrders` / `reconcileUserPendingWechatOrders`） | §2、§8.2、§9 | 只读，**零改动** |
| 订阅状态 | `model/subscription.go`（`"active"` / `"consumed"` / `"refunded"` / `"cancelled"` / `"expired"`） | §2、§8.2、§10.1 | 只读 |
| 消费日志 | `web/src/features/usage-logs/`（80 文件；`constants.ts` 的 `LOG_TYPE_ENUM.REFUND = 6`、`components/columns/common-logs-columns.tsx`、`components/dialogs/details-dialog.tsx`） | §7.6、§10.1 | 只读 |
| 金额格式化真源 | `web/src/lib/format.ts`、`web/src/lib/currency.ts` | §8.1 | 只读 |
| 角色与权限 | `web/src/lib/roles.ts`（`ORG_MANAGE_ROLES` / `canManageOrganization`）、`web/src/features/users/components/__tests__/permissions.test.tsx` | §6 | 只读 |
| 基础组件 | `web/src/components/ui/`（共 66 个 `.tsx`：`table.tsx` / `dialog.tsx` / `alert-dialog.tsx` / `badge.tsx` / `form.tsx` / `alert.tsx` / `skeleton.tsx` 等） | §12 F-08 | 只读 |
| 业务封装 | `web/src/components/confirm-dialog.tsx`、`web/src/components/status-badge.tsx`、`web/src/components/data-table/`（24 导出） | §5.6、§6.3、§8.2 | 只读 |
| 门禁脚本 | `web/scripts/check-design-tokens.mjs`、`check-component-registry.mjs`、`check-design-system-5.0.mjs`、`verify-contrast.mjs`、`visual-regression.mjs` | 自动化验证 | 只读 |
| 规范输出 | `docs/design-system/uter-design-system-5.0/ORGANIZATION-AND-BILLING-COMPONENT-STANDARD.md` | 全文 | **本文件（新建）** |

> 本分册为规范声明，**不新增、不修改任何代码文件**；表中路径全部经 `ls` / `grep` 核实存在。

---

## 自动化验证

| 验证项 | 真实脚本 / npm 脚本 | 关联 | 说明 |
|---|---|---|---|
| 金额格式化合规（禁手写 `toFixed` 拼币种）+ 订单状态枚举与后端一致（`failed` 缺失） | 无现成统一脚本；`bun run lint`（`project/intl-locale` error）为相关但不等价的门禁，且不覆盖类型联合与常量表 | OB-8.2 / OB-2、S31-D05 / S31-D03 | 未建立，`NOT_VERIFIED` |
| 禁止虚构页面（退款页 / 订单页 / 组织切换器 / 邀请流程）+ 危险操作二次确认（禁 `window.confirm`） | 无现成脚本；`UDS5-S24` 规范一致性检查为规划项 | OB-8 / F-01、OB-5.6 / S31-D07 | 未建立，`NOT_VERIFIED` |
| 资金逻辑零改动（diff 拦截）+ 组织范围标注 | 无现成脚本 | §3.2 R-B1/R-B2、OB-3 / §7 | 未建立，`NOT_VERIFIED` |
| 组件注册表一致性 | `bun run components:registry:check`（`web/scripts/check-component-registry.mjs`） | §12 F-08 | 本轮未运行 |
| 规范一致性（文档 ID / 路径 / 非空） | `bun run design:5:check`（`web/scripts/check-design-system-5.0.mjs`；含「文档 ID 反向登记」检查，本文件声明 `UDS5-S31`） | 全文 | **已执行**（2026-11-14，team-lead 复跑）→ `verdict: PASS` / `errors: 0`；`UDS5-S31` **已登记**入 `DESIGN-STANDARD-REGISTRY.yaml`（`category: business-vertical`；`dependencies` 含 S01 / S13 / S14 / S15 / S16 / S17 / S18 / S19 / S20 / S22 / S24），本文件不再登记为待办 |
| 设计 Token 硬编码检查 | `bun run lint:design:strict`（`web/scripts/check-design-tokens.mjs --strict`） | §12 F-08 | 本轮未运行 |
| 对比度 | `bun run verify:contrast`（`web/scripts/verify-contrast.mjs`） | `UDS5-S13`；E24 两处缺陷保持 P1 待修 | 本轮未运行 |
| 单元测试 | `bun run test`（`vitest run`） | §2 事实基线引用的既有测试（`features/organization/org-budget.test.ts` / `sub-quota.test.ts`、`features/users/components/__tests__/permissions.test.tsx`、`features/wallet/lib/__tests__/`） | 本轮未运行 |
| 视觉回归 / a11y | `bun run test:visual` / `bun run test:axe` | §4–§11 界面契约 | 本轮未运行；`test:axe` 未接 CI |

> **登记口径（2026-11-14 更新）**：本轮未改动任何脚本与配置。**唯一已执行的验证命令**是 `bun run design:5:check`（2026-11-14 由 team-lead 在蓝图合并收口时复跑、随后由本分册作者二次复跑，两次结果一致 → `verdict: PASS` / `errors: 0` / `checksPassed: 7` / `standards: 37` / `registeredDocIds: 37`），该次运行同时完成了 `UDS5-S31` 的注册表登记；上表「规范一致性」一行据此更新，其余各行「本轮未运行」/「未建立」为如实声明。

---

### 自动化验证 — 蓝图验收场景对照

蓝图两份规范各有一节「验收」（组织 §6 / 账单 §8）。下表逐条对照仓库是否具备可测对象；**全部未执行**。

| 蓝图验收场景 | 仓库可测对象 | 对应规范条款 | 状态 |
|---|---|---|---|
| 无权限 / 跨组织数据隔离 | `middleware.OrgAdminAuth` + `OrgDataScope`（部门管理员未分配部门时 fail-closed 空集）；前端 `routes/_authenticated/organization/index.tsx` 的 `beforeLoad` → `/403`；`GetAllTopUps` 的组织范围收敛 | §6.2 OB-6.2、§7 OB-7.6 / OB-7.7 | `NOT_EXECUTED` |
| 成员移除 / 并发角色变更 | `DELETE /api/organization/:id/members/:uid` + `removeOrganizationMember`；`UpdateOrganizationMember` 的 owner 授予判据 + 非超管不得降权 owner | OB-5.6、OB-5.7、OB-6.3 | `NOT_EXECUTED` |
| 退款部分成功 / 邀请过期 / 组织切换失败 | **无对应对象**（仓库无订单退款、无邀请流程、无组织切换器） | OB-10.3、OB-4.1、OB-5.8；S31-D01、S31-D11、S31-D12 | `NOT_EXECUTED`（无对象可测） |
| 移动端成员操作 | `features/organization/index.tsx` 的成员操作区 | §7 范围；`UDS5-S12` 断点 | `NOT_EXECUTED` |
| 重复通知 / 延迟通知 / 支付取消 / 超时 / 订单刷新恢复 | `claimPendingTopUp` 的条件更新幂等 + `ListPendingTopUpsForReconcile` 对账；`TopUpStatusExpired` + `UpdatePendingTopUpStatus`；`pollAlipayOrder` 的 `unpaid`/`closed` 终态；`GetUserTopUps` 30 天窗口 + 读时对账 `reconcileUserPending*Orders` | OB-9.5、OB-9.6、OB-11.5、§8.2、OB-9.1 | `NOT_EXECUTED` |
| 渠道不可用 / 币种格式 / 零金额 / 金额精度 | `recharge-form-card.tsx:530` 的「No payment methods available」分支；`formatPaymentAmount`（USD / CNY 分支）、`formatCNYAmount`；`rejectInvalidTopUpAmount`（超两位小数拦截）、`getMinTopup` / `getMaxTopUpAmount` 边界；`formatQuota` 两档精度口径 | OB-9.4、OB-8.3、OB-8.4、OB-8.9 | `NOT_EXECUTED` |

---

## 验证状态

| 项 | 状态 | 说明 |
|---|---|---|
| 本规范文本 | `ACTIVE` | 已撰写，供评审 |
| §2 事实基线（订单状态枚举、组织角色、钱包组件清单、金额格式化真源） | `IMPLEMENTED` | 全部经 `ls` / `grep` 逐条核实，来源列已注明文件与行号 |
| 资金真实性红线（OB-9.1…OB-9.8） | `IMPLEMENTED` | 规范层定义；落地拦截器未建立 |
| 14 项差异登记（S31-D01…S31-D14） | `IMPLEMENTED` | 已逐条写明蓝图条款与仓库事实的对应关系 |
| 界面改造（组织页 / 钱包页 / 账单弹窗） | `NOT_STARTED` | 本轮零代码改动 |
| S31-D03 前端订单状态补 `failed` | `NOT_STARTED` | 属代码改动，本轮不执行。**team-lead 已独立复核属实**：后端 `common/constants.go:346-349` 定义 `TopUpStatusPending` / `TopUpStatusSuccess` / `TopUpStatusFailed` / `TopUpStatusExpired` **四态**，而前端 `web/src/features/wallet/types.ts:287` 的 `TopupStatus` 仅有 `'success' \| 'pending' \| 'expired'` **三态**，缺 `'failed'`；`web/src/features/wallet/lib/billing.ts` 的 `STATUS_CONFIG` 亦只映射三态——**失败订单落库后前端无对应状态分支**。该缺口属**真实代码缺陷**，修复须走 `UDS5-S01` §19 变更流程 |
| S31-D04 管理员补单入口一致性 / S31-D05 金额 `toFixed` 整改 | `NOT_STARTED` | 均属代码改动，本轮不执行 |
| S31-D06 钱包 / 组织复用 `data-table` / S31-D07 `window.confirm` 替换为 `ConfirmDialog` | `NOT_STARTED` | 均属代码改动，本轮不执行 |
| S31-D14 组织域成员权限 / 额度写操作缺强验证与审计 | `NOT_STARTED` | 属代码改动，本轮不执行。真实代码缺陷：`controller/organization.go` 全文无 `requireAdminUserProof` / `CriticalRateLimit` 调用，`UpdateOrganizationMember` 可同时写 `sub_quota_limit` 与 `org_role` 而无审计留痕（成员新增有审计、成员变更无）。与 `S01-D6` / `S30-D13`（平台超管 `add_quota` 分支）为**不同代码路径**，非重复登记；修复须走 `UDS5-S01` §19 变更流程 |
| `UDS5-S31` 登记入 `DESIGN-STANDARD-REGISTRY.yaml` | `PARTIALLY_VERIFIED`（2026-11-14 实测） | **已补登**（`category: business-vertical`；`dependencies` 含 S01 / S13 / S14 / S15 / S16 / S17 / S18 / S19 / S20 / S22 / S24）。**已执行** `bun run design:5:check` → `verdict: PASS` / `errors: 0` / `checksPassed: 7` / `standards: 37` / `registeredDocIds: 37`（team-lead 于 2026-11-14 蓝图合并收口时复跑，含 S29–S32 四条新登记）；**仅**注册一致性一项达 PASS，本文其余验证项仍为 `NOT_VERIFIED` / `NOT_EXECUTED` |
| 门禁脚本（lint / tokens / contrast / registry / design:5:check） | `NOT_EXECUTED`（除 `design:5:check` 外） | 本轮**仅执行** `bun run design:5:check`（team-lead 复跑 + 本分册作者二次复跑，均 PASS）；`lint:design:strict` / `design:tokens:check` / `verify:contrast` / `components:registry:strict` **未运行** |
| 单元测试 / 视觉回归 / a11y 回归 / PC Web / H5 | `NOT_EXECUTED` / `NOT_VERIFIED` | 本轮未运行；未针对本分册重跑 PC Web / H5 回归 |
| Android / iOS / HarmonyOS | `NOT_VERIFIED` | 无实现，不得用 Web 结果代替 |

**结论**：本分册为规范声明，所有验证项均为 `NOT_VERIFIED` / `NOT_EXECUTED`，**未勾选任何测试通过或平台验收**。本规范只约束界面与状态呈现，不改资金、授权与配额业务逻辑。
