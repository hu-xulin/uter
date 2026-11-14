# BUSINESS-UI-ADAPTATION-STANDARD — 业务 UI 适配规范

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S22` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01` |
| 生效日期 | `2026-11-14` |
| 适用范围 | UTER 全部业务模块的前端页面视觉、组件复用与交互改造；PC Web / H5 两端；不适用于后端 API、资金、订单、认证、授权逻辑 |
| 验证状态 | `NOT_VERIFIED`（本轮仅撰写规范，未执行任何页面改造与测试） |

---

## 1. 改造边界与业务红线（最高优先级）

### 1.1 本次改造允许的范围

1. **只允许改前端视觉、组件复用与交互表现**：颜色 / 字号 / 间距 / 圆角 / 层级 Token 的统一、基础组件复用、状态（加载 / 错误 / 空）补齐、响应式与无障碍修正、组件注册与文档关联。
2. 允许按 5.0 规范替换「绕过基础组件的自绘 UI」为已登记基础组件，但不得改变组件的 props 契约所承载的业务语义。

### 1.2 本次改造严禁触碰的红线

| # | 红线 | 依据 |
|---|---|---|
| R1 | 支付 / 充值 / 余额 / 退款 / 订单的**资金逻辑、API 契约、数据库结构、状态机零改动** | `UDS5-AUDIT-01` §6.1 业务红线、§13 升级边界；用户 PART 0 原则 C、PART 15 第 10–13 条；`AGENTS.md` §4 / §5 |
| R2 | 认证 / 授权 / 权限判定逻辑零改动（Go 后端 + Casbin + 路由 `beforeLoad` + `ROLE.ADMIN` / `SUPER_ADMIN` 守卫） | `UDS5-AUDIT-01` §8 / §9 D8 |
| R3 | 不新增、不删除、不改写任何业务数据字段、接口路径、计费规则 | 同上 |
| R4 | 不因适配引入新依赖（不引入 Clerk SDK、Storybook 等） | `UDS5-AUDIT-01` §13 |
| R5 | 不虚构不存在的路由 / 页面（尤其退款、订单） | `UDS5-AUDIT-01` §6.1 |

> **判定口径**：任何一次改动，若其 diff 触及 `web/src/features/wallet/lib/payment.ts`、认证与授权守卫、API 请求契约、数据库迁移或资金字段，即视为越界，必须回退。本节为 `UDS5-S24`（自动化规范）「页面检查」与「规范一致性」拦截器提供判定依据。

---

## 2. 现有页面与模块映射事实（依据 `UDS5-AUDIT-01` §6.1）

| 事实 | 值 |
|---|---|
| 路由源码 | **73 个**（`_authenticated 41` / `_public 13` / `(auth) 9` / `(errors) 5` / `__tests__ 2` / `oauth 1` / `setup 1` / `__root.tsx 1`） |
| feature 目录 | **30 个**（非 34）；最大 6 个：`system-settings 192`、`channels 117`、`usage-logs 80`、`pricing 69`、`playground 63`、`models 55` |
| 视觉基线覆盖 | 公开 13 页 + 鉴权 9 页；**未覆盖** `system-settings/*` 18 个路由、`*/$section` 动态段、`usage-logs/audit`、`oauth/$provider`、`setup`、`chat/$chatId` |
| 单测 | `web/src` 下 `*.test.ts(x)` **288 个** |
| E2E | `business` 1 spec / `visual` 3 spec + 44 张 PNG（22 页 × 2 视口）/ `axe` 2 spec |

> 下表 `现有页面` 列全部取自 `UDS5-AUDIT-01` §6.1 的真实路由路径；`使用组件` 列取自 §5 已核实的组件与业务封装；凡仓库中无独立路由 / 独立页面者，按事实写明「无」，不得虚构。

---

## 3. 业务模块逐行适配表（PART 6 全部模块）

> 字段固定为：`现有页面` / `使用组件` / `设计问题` / `5.0 改造要求` / `改造文件` / `测试结果`。所有 `测试结果` 本轮未跑，一律 `NOT_VERIFIED`。

| 模块 | 现有页面（真实路由路径） | 使用组件 | 设计问题 | 5.0 改造要求 | 改造文件 | 测试结果 |
|---|---|---|---|---|---|---|
| Dashboard | `web/src/routes/_authenticated/dashboard/index.tsx`、`dashboard/$section.tsx` | `ui/card.tsx`、`titled-card.tsx`、`Badge`、`@visactor/react-vchart` / `recharts`、`skeleton.tsx` | 统计卡 / 指标卡尺寸与标题层级未统一；`performance-metrics/` 无独立路由、数据视图分散；仅部分页面有视觉基线 | 统一统计卡表面色差与边框、指标字号阶梯（分区标题 22/600/30、卡片标题 18/600/26）；图表 text/axis/label/grid Token 化（关联 P2 待办）；补齐加载 / 空 / 错误三态 | `web/src/features/dashboard/`、`web/src/routes/_authenticated/dashboard/*` | `NOT_VERIFIED` |
| 用户管理 | `web/src/routes/_authenticated/users/index.tsx`（`:45` `ROLE.ADMIN` 守卫） | `data-table/`（24 导出）、`ui/dialog.tsx`、`ui/form.tsx`、`Badge`、`confirm-dialog.tsx` | 表格列密度与操作区未统一；角色 / 状态徽标对比度需复核；`ROLE.ADMIN` 守卫视觉提示不足 | 统一 DataTable 排序 / 筛选 / 分页 / 行选 / 批量 / 列可见性；角色徽标走状态 Token（关联 E24 对比度缺陷）；守卫仅补充视觉提示，**不改权限判定** | `web/src/features/users/`、`web/src/routes/_authenticated/users/index.tsx` | `NOT_VERIFIED` |
| API Key | `web/src/routes/_authenticated/keys/index.tsx` | `components/../features/keys/components/api-keys-cells.tsx`、`secret-input.tsx`、`copy-button.tsx`、`ui/dialog.tsx`、`Badge` | 密钥展示 / 复制 / 遮罩交互不统一；创建成功态与错误态提示分散；`api-keys-cells.tsx` 属并发 WIP 禁改文件 | 统一密钥字段（SecretInput + CopyButton）与创建结果反馈；补齐空态与复制成功 Toast；仅改视觉，**不改密钥生成 / 校验契约** | `web/src/features/keys/`、`web/src/routes/_authenticated/keys/index.tsx` | `NOT_VERIFIED` |
| 模型 | `web/src/routes/_authenticated/models/index.tsx`、`models/$section.tsx`（管理员守卫） | `ui/card.tsx`、`data-table/`、`model-group-selector/`、`Badge`、`ui/tabs` 类组件 | 模型卡片与分组选择器视觉不统一；`$section` 动态段无视觉基线覆盖 | 统一模型卡片、分组选择器与状态徽标；动态段纳入响应式与三态检查；管理员守卫仅补视觉提示 | `web/src/features/models/`、`web/src/routes/_authenticated/models/*` | `NOT_VERIFIED` |
| 渠道 | `web/src/routes/_authenticated/channels/index.tsx`（管理员守卫，feature 117 文件） | `ui/form.tsx`、`ui/dialog.tsx`、`data-table/`、`ui/switch` 类组件、`Badge` | 渠道配置表单字段密度高、错误就近展示不足；编辑抽屉 / 弹层外观作用域未统一 | 按表单规范补错误就近展示与防重复提交；嵌套弹层外观继承规则统一；渠道状态走状态 Token | `web/src/features/channels/`、`web/src/routes/_authenticated/channels/index.tsx` | `NOT_VERIFIED` |
| Token 余额 | `web/src/routes/_authenticated/wallet/index.tsx`；`components/quota-details-popover.tsx` | `ui/card.tsx`、`quota-details-popover.tsx`、`progress.tsx`、`Badge` | 余额 / 配额数字层级不统一；`quota-details-popover.tsx` 属并发 WIP 禁改文件；浮层与卡片层级 Token 未统一 | 统一余额数值字号与配额浮层的层级 / 圆角 / 阴影 Token；**余额读取与展示数值逻辑零改动** | `web/src/features/wallet/`、`web/src/routes/_authenticated/wallet/index.tsx` | `NOT_VERIFIED` |
| 充值 | `web/src/routes/_authenticated/wallet/index.tsx`（充值入口）、`web/src/routes/_public/recharge-agreement.tsx` | `ui/card.tsx`、`ui/button.tsx`、`ui/form.tsx`、`sonner` | 充值金额档位卡片与协议页视觉不统一；金额输入校验反馈分散 | 统一金额档位卡片选中态、主按钮八态与协议页排版；**充值金额计算、渠道与风控逻辑零改动**（R1） | `web/src/features/wallet/`、`web/src/routes/_public/recharge-agreement.tsx` | `NOT_VERIFIED` |
| 支付 | `web/src/routes/_authenticated/wallet/index.tsx`、`web/src/routes/_authenticated/system-settings/billing/*`、`web/src/features/wallet/lib/payment.ts:224`（`detectPayClient()` UA 判定） | `ui/button.tsx`、`ui/dialog.tsx`、`sonner`、`qrcode.react` | 支付结果状态（成功 / 处理中 / 失败 / 降级）视觉不统一；`payment.ts` 仅含 UA 正则字面量，无 HarmonyOS 实现 | 统一支付状态反馈为五类通知；支付方式选择走基础组件；**支付 API 契约、状态机、UA 判定与资金逻辑零改动**（R1 / R3） | `web/src/features/wallet/`（仅视图组件）、`web/src/routes/_authenticated/system-settings/billing/*` | `NOT_VERIFIED` |
| 退款 | **仓库中无独立路由、无独立页面、无独立 refund 文件**（全仓 17 处 `refund/退款` 均为消费日志 / 类型 / 设置字段） | 无独立组件；相关字段散落于 `usage-logs` 类型与系统设置 | **不得虚构退款页面**；退款仅作为消费日志字段 / 类型 / 设置项存在 | 仅在既有「消费日志 / 系统设置」字段呈现上统一标签与状态文案的视觉；**不新建退款路由、不新建退款页面、不改资金逻辑**（R1 / R5） | `web/src/features/usage-logs/`（字段展示层）、`web/src/routes/_authenticated/system-settings/*`（设置字段展示层） | `NOT_VERIFIED` |
| 消费记录 | `web/src/routes/_authenticated/usage-logs/index.tsx`、`usage-logs/$section.tsx`、`usage-logs/audit.tsx` | `data-table/`（24 导出）、`Badge`、`ui/date` 类组件、`empty-state.tsx` | 80 文件大 feature；表格密度 / 时间范围筛选不统一；`usage-logs/audit` 与 `$section` 动态段无视觉基线覆盖 | 统一日志表格与筛选器；动态段纳入响应式与三态检查；合并重复 `EmptyState` 为 `components/empty-state.tsx` | `web/src/features/usage-logs/`、`web/src/routes/_authenticated/usage-logs/*` | `NOT_VERIFIED` |
| 订单 | **仓库中无独立订单路由、无独立订单页面**（账单历史为 `web/src/features/wallet/.../billing-history-dialog.tsx` 弹窗） | `billing-history-dialog.tsx` 弹窗、`ui/dialog.tsx`、`data-table/` 风格表格 | **不得虚构订单页面**；账单历史以弹窗形式承载，无独立路由 | 仅在既有账单历史弹窗内统一表格 / 状态 / 空态视觉；**不新建订单路由、不改订单数据结构与状态机**（R1 / R5） | `web/src/features/wallet/.../billing-history-dialog.tsx`（弹窗视图层） | `NOT_VERIFIED` |
| 价格管理 | `web/src/routes/_public/pricing/index.tsx`、`pricing/$modelId/index.tsx`；`web/src/features/pricing/`（69 文件）+ `model-pricing`（11 文件） | `ui/card.tsx`、`Badge`、`ui/button.tsx`、`data-table/` 风格 | 价格卡 / 模型价目层级不统一；`features/pricing/components/empty-state.tsx` 为 3 处同名 `EmptyState` 之一（重复实现） | 统一价格卡与价目表视觉；合并 3 处同名 `EmptyState` 到 `components/empty-state.tsx`；**价格数值与计费规则零改动**（R1） | `web/src/features/pricing/`、`web/src/features/model-pricing/`、`web/src/routes/_public/pricing/*` | `NOT_VERIFIED` |
| 统计分析 | `web/src/routes/_authenticated/dashboard/{index,$section}.tsx`（`features/dashboard/lib/stats.ts`）；`performance-metrics/` **无独立路由** | `@visactor/vchart` / `react-vchart`、`recharts 3.9.1`、`chart-typography.ts`、`ui/card.tsx` | 图表 text/axis/label/grid 独立 Token 未定义（P2 待办）；性能视图无独立路由、分散在 Dashboard | 定义图表四通道独立 Token（关联 P2）；统一图表配色走品牌与语义 Token；补齐空 / 加载 / 错误态 | `web/src/features/dashboard/`、`web/src/features/performance-metrics/`、`web/src/design-system/chart-typography.ts` | `NOT_VERIFIED` |
| 系统设置 | `web/src/routes/_authenticated/system-settings/` **18 个文件 / 9 个子域**（auth / billing / content / models / operations / request-policies / security / site） | `ui/form.tsx`、`ui/tabs` 类组件、`ui/switch` 类组件、`ui/card.tsx`、`data-table/` | 9 子域设置项密度差异大；18 个路由**无 E2E 覆盖**；三级导航层级与表单提示不统一 | 统一设置分区导航（三级）、表单字段 / 提示 / 错误就近展示；补齐 18 路由响应式与三态检查；**认证 / 授权 / 计费设置项的业务行为零改动**（R1 / R2） | `web/src/routes/_authenticated/system-settings/*`、`web/src/components/layout/`（导航） | `NOT_VERIFIED` |
| 权限管理 | **无独立路由**；`ROLE.ADMIN` / `SUPER_ADMIN` 守卫散布在 **11 个路由文件** | `Badge`、`ui/select.tsx`、`data-table/` 风格（角色数据视图） | 权限视觉提示分散、无统一角色 / 权限组件；`features/users/components/__tests__/permissions.test.tsx` 为既有测试 | 统一角色 / 权限徽标与选择器的视觉，补「按注册组件 ID 定位」关联；**守卫判定、Casbin 策略与角色数据零改动**（R2） | 11 个含守卫的路由文件（仅视觉层）、`web/src/features/users/components/` | `NOT_VERIFIED` |
| 管理员功能 | **无独立路由**；管理员能力由 11 个路由文件的守卫 + `system-settings` 子域 + `models/channels` 管理员视图组成 | `ui/card.tsx`、`data-table/`、`ui/dialog.tsx`、`confirm-dialog.tsx` | 管理员专属操作入口视觉不统一；危险操作二次确认样式不一致 | 统一危险操作（Destructive variant）与 `confirm-dialog.tsx` 二次确认；补齐操作结果反馈；**不改任何权限判定**（R2） | `web/src/routes/_authenticated/{models,channels,users}/*`、`web/src/components/confirm-dialog.tsx` | `NOT_VERIFIED` |
| 其他现有模块 | `web/src/features/playground/`（63 文件）、`organization/`（8 文件）、`profile/`（17 文件）、`security/`（37 文件）；`web/src/routes/_authenticated/organization/index.tsx`、`profile*`、`security*`；`oauth/$provider.tsx`、`setup.tsx`、`chat/$chatId.tsx`、`(errors)/*`、`performance-metrics/`（无独立路由） | `multi-select/`、`json-code-editor/`、`floating-window/`、`ai-elements/`、`ui/alert.tsx`、`sonner`、`input-otp.tsx`、`skeleton.tsx` | `oauth/$provider` / `setup` / `chat/$chatId` / `(errors)` 均无视觉基线覆盖；组织 / 账户 / 安全分区标题层级未统一；Playground 自绘面板多 | 统一分区标题层级与卡片分组；组织 / 账户 / 安全仅做 UI 规范映射（关联 `UDS5-S21` §4.6 / §4.7）；逐页补三态与响应式检查；**认证 / 组织 / 配额业务逻辑零改动**（R2 / R3） | `web/src/features/{playground,organization,profile,security}/`、对应路由视图层 | `NOT_VERIFIED` |

---

## 4. 「退款」与「订单」专项说明（防虚构）

| 项 | 退款 | 订单 |
|---|---|---|
| 独立路由 | **无** | **无** |
| 独立页面 / 文件 | **无独立 refund 文件** | **无独立订单页面**；账单历史为 `billing-history-dialog.tsx` 弹窗 |
| 仓库实际形态 | 全仓 17 处 `refund/退款` 均为消费日志 / 类型 / 设置字段 | 账单历史以弹窗承载，挂在 `features/wallet/` 下 |
| 依据 | `UDS5-AUDIT-01` §6.1「退款」行、§6.1 业务红线 | `UDS5-AUDIT-01` §6.1「订单」行 |
| 5.0 允许动作 | 仅在既有字段展示层统一标签 / 状态文案视觉 | 仅在既有账单历史弹窗内统一表格 / 状态 / 空态视觉 |
| 5.0 禁止动作 | **不新建退款路由 / 页面、不改资金逻辑** | **不新建订单路由 / 页面、不改订单数据结构与状态机** |

> 任何验收清单或迁移台账中若出现「退款页」「订单页」的独立路由 / 视觉基线 / E2E 用例，均视为**虚构**，须按 `UDS5-S24` 规范一致性检查拦截。

---

## 5. 改造通用要求（视觉 / 组件 / 交互三层）

### 5.1 视觉层

1. 全部颜色、字号、间距、圆角、层级（elevation）走 5.0 Token，禁止硬编码设计值（关联 `UDS5-S24` Token 检查「硬编码颜色 / 间距 / 圆角」）。
2. 分区标题 22/600/30、卡片标题 18/600/26、正文 14/22、caption 12/18、长文本 16/26、最小 12px；H5 输入 ≥16px。
3. 优先「表面色差 + 细边框」建立层级，限制重阴影；品牌渐变深浅同值为登记例外（E28）。
4. E24 两处对比度缺陷（浅色溢价 3.76:1、深色折扣 3.30:1）保持 P1 待修，5.0 不得勾选通过。

### 5.2 组件层

1. 优先复用已登记基础组件（`ui/*.tsx` 65 实现）与 `data-table/` 唯一表格业务封装（24 导出），禁止绕过基础组件自绘。
2. 合并 3 处同名 `EmptyState`（`components/empty-state.tsx` 正式、`notification-popover.tsx:156` 局部、`features/pricing/components/empty-state.tsx:29` feature 内）到唯一正式封装。
3. 每个组件补齐 default / hover / focus / pressed / disabled / loading / error / success 八态并登记证据。
4. `ui/button.tsx` 的 `cva()`（6 variant × 9 size）已覆盖多种按钮名称，不按名称重复实现。

### 5.3 交互层

1. 每个页面 / 视图必须具备加载、错误、空三态；危险操作二次确认统一走 `confirm-dialog.tsx`。
2. 表单按 5.0 规范补「错误优先级 / 未保存提醒 / 防重复提交」；字段级错误就近展示。
3. 浮层（Popover / Dialog / Drawer）外观作用域显式，不隐式继承；`aria-expanded` / `aria-selected` 与视觉状态一致。
4. 响应式覆盖五档断点（640 / 768 / 1024 / 1280 / 1536）与 H5 命中区（24px 最小 / 44px 推荐）。

---

## 6. 分期推进与基线约束

| 约束 | 内容 | 依据 |
|---|---|---|
| 并发 WIP | 审计开始时 42 项脏区，复查增至 211 项（51 `M` + 160 `??`），152 项在 `.uap/`；12 个已脏文件禁止改动（含 `theme.css`、`system-brand.tsx`、`quota-details-popover.tsx`、`search.tsx`、`api-keys-cells.tsx`、`e2e/visual/*`、`.uap/**`） | `UDS5-AUDIT-01` §1 |
| 不批量重写 | 3.0 自身 73 项验收未勾选、65 组件 0 VERIFIED，禁止一次性批量重写全站 UI | `UDS5-AUDIT-01` §9 D7 / §14 结论 B |
| 先写回归测试 | 每处改动先写回归测试，按项目约定分期推进 | `UDS5-AUDIT-01` §9 D7 |
| 不执行全量构建 | 存在并发 WIP，改用只读门禁验证，全量构建标 `NOT_EXECUTED` | `UDS5-AUDIT-01` §1 / §14 |
| 平台 | PC Web / H5 真实可测；Android / iOS / HarmonyOS 无实现，标 `NOT_VERIFIED` | `UDS5-AUDIT-01` §8 / §9 D4 |

---

## 7. 与其他规范的关系

| 规范 ID | 关系 | 说明 |
|---|---|---|
| `UDS5-S01` | 上级 | 本文服从总纲效力、ID 体系与验证状态口径 |
| `UDS5-AUDIT-01` | 事实依据 | §6.1 提供本文全部真实路由、退款 / 订单「无独立页面」结论与业务红线 |
| `UDS5-S21` | 被引用 | 认证 / 账户 / 组织页面仅做 UI 规范映射，业务零改动 |
| `UDS5-S14` / `UDS5-S15` | 被引用 | 组件复用、八态与唯一扩展路径 |
| `UDS5-S18` | 被引用 | 表单错误优先级 / 未保存提醒 / 防重复提交 |
| `UDS5-S19` | 被引用 | DataTable 与图表的数据展示统一 |
| `UDS5-S20` | 被引用 | 支付 / 充值 / 退款状态的五类反馈 |
| `UDS5-S24` | 下游 | 本文的页面检查（未登记组件 / 绕过基础组件 / 硬编码设计值 / 缺响应式 / 缺三态）由其 Validator 落地 |
| `UDS5-S25` | 下游 | 本文 17 个模块的适配结果作为页面验收清单的证据来源 |
| `UDS5-S27` | 关联 | 组件合并与版本统一动作按迁移指南执行 |

---

## 8. 代码实施位置

| 类别 | 真实路径 | 本文关联 | 本轮状态 |
|---|---|---|---|
| 路由源码 | `web/src/routes/_authenticated/*`、`_public/*`、`(auth)/*`、`(errors)/*`、`oauth/*`、`setup.tsx` | §3 全表 | 存在，未改造 |
| feature 视图 | `web/src/features/{dashboard,users,keys,models,channels,wallet,usage-logs,pricing,model-pricing,system-settings,playground,organization,profile,security,performance-metrics}/` | §3 全表 | 存在，未改造 |
| 基础组件 | `web/src/components/ui/*.tsx`（65 实现） | §5.2 | 存在，未改造 |
| 业务封装 | `web/src/components/data-table/`、`empty-state.tsx`、`error-state.tsx`、`loading-state.tsx`、`confirm-dialog.tsx`、`copy-button.tsx` | §5.2 / §5.3 | 存在，未改造 |
| 组件注册 | `web/src/design-system/component-registry.json` | §5.2 | 存在，未改造 |
| 视觉基线 | `web/e2e/visual/*`（44 张 PNG，22 页 × 2 视口） | §2 / §6 | 存在，未新增 |
| 门禁脚本 | `web/scripts/check-design-tokens.mjs`、`check-component-registry.mjs`、`visual-regression.mjs` | §6 / §8 | 存在，未改造 |

> 本文为适配规范，**不新增、不修改任何代码文件**；§3 `改造文件` 列为 5.0 分期改造的目标位置，非本轮已改动。属并发 WIP 禁改的文件（见 §6）在对应会话合入前不得触碰。

---

## 9. 自动化验证

| 检查项 | 现有实现 | 5.0 拟补充 | 当前结果 |
|---|---|---|---|
| 未登记组件被页面使用 | `components:registry:check`（65/65/0 errors） | 页面级「使用组件必须已登记」扫描 | 5.0 补充 `NOT_VERIFIED` |
| 绕过基础组件自绘 | 无 | 自绘 UI 检测 | 未建立 `NOT_VERIFIED` |
| 硬编码设计值 | `check-design-tokens.mjs --strict`（违规 0 / EXIT=0） | 页面级硬编码颜色 / 间距 / 圆角扫描 | 既有通过，5.0 补充 `NOT_VERIFIED` |
| 缺响应式 / 缺三态 | 无 | 页面加载 / 错误 / 空态与断点覆盖检查 | 未建立 `NOT_VERIFIED` |
| 业务红线零改动 | 无 | 支付 / 余额 / 订单 / 退款 / 认证 / 授权代码变更拦截 | 未建立 `NOT_VERIFIED` |
| 退款 / 订单虚构页面 | 无 | 「独立退款页 / 订单页」存在性误报检查 | 未建立 `NOT_VERIFIED` |
| 视觉回归 | `test:visual`（已接 CI）、`test:visual:e2e`（未接 CI） | 18 个 `system-settings` 路由与动态段基线补齐 | 部分覆盖，`NOT_VERIFIED` |
| a11y 回归 | `test:axe`（2 spec，未接 CI） | 逐页 WCAG 2.2 AA 检查 | 未接 CI `NOT_VERIFIED` |

> 本轮未运行任何验证命令；上表「既有通过」仅复述 `UDS5-AUDIT-01` §4.4 / §5 / §7 的只读门禁实测结论。CI `frontend` job 已接入 `typecheck / test / lint / design:tokens:check / design:showcase:check / verify:contrast / lint:design:strict / test:visual / components:registry:check / copyright:check / build:check`；**未接** `test:axe / test:business:e2e / test:visual:e2e / components:registry:strict / format:check`。

---

## 10. 验证状态

| 项 | 状态 | 说明 |
|---|---|---|
| 本文 17 个模块逐行适配表 | `IMPLEMENTED_NOT_VERIFIED` | 规范文本已撰写，未执行页面改造 |
| 退款 / 订单「无独立页面」事实登记 | `IMPLEMENTED` | 依据 `UDS5-AUDIT-01` §6.1，如实写入 §3 / §4 |
| 业务红线零改动声明 | `IMPLEMENTED` | §1 已声明，需由 §9 拦截器落地 |
| 页面视觉 / 组件 / 交互改造 | `NOT_STARTED` | 按 §6 分期推进 |
| `system-settings` 18 路由基线补齐 | `NOT_STARTED` | 当前无 E2E 覆盖 |
| 逐页测试（视觉 / a11y / 业务 E2E） | `NOT_VERIFIED` | 相关轨道未接 CI 或未执行 |
| PC Web / H5 | `NOT_VERIFIED` | 未针对 5.0 重跑回归 |
| Android / iOS / HarmonyOS | `NOT_VERIFIED` | 无实现，不得用 Web 结果代替 |

**总体验证状态：`NOT_VERIFIED`**。本文不得被解读为 `FULLY_IMPLEMENTED_AND_VERIFIED`；页面适配的最终状态以 `UDS5-S25`（验收规范）与最终验收报告为准。
