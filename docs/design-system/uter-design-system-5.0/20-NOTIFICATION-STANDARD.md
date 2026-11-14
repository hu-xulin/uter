# 20 — 通知标准（NOTIFICATION STANDARD）

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S20` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01` |
| 生效日期 | `2026-11-14` |
| 适用范围 | `sonner`（`^2.0.7`）、`web/src/components/ui/alert.tsx`、`web/src/components/empty-state.tsx` / `loading-state.tsx` / `error-state.tsx`、`web/src/components/notification-popover.tsx`、全部含操作反馈的页面与 Mutation |
| 验证状态 | `NOT_VERIFIED` |

> 本规范定义 6 类通知组件与 5 类反馈语义，并固化 `web/AGENTS.md` §3.9 的错误处理归属。**Clerk 官方无通用通知规范**（`CLERK-DESIGN-REFERENCE-ANALYSIS.md` §1.1 / 2.14）。本轮不修改代码、不引入依赖、不执行 git 操作。

---

## 1. 目的与效力

1. 区分「成功反馈 / 普通信息 / 警告 / 可恢复错误 / 不可恢复错误」五类反馈，给出组件映射与生命周期，避免所有失败都用一个 `toast.error`。
2. 把 `web/AGENTS.md` §3.9 的提示归属写成可评审规则：**拦截器不弹 Toast**、**Mutation 自定义 `onError` 负责提示**、**`meta.errorToast: false` 关闭自动提示**。
3. 明确 6 类通知（Toast / Snackbar / Alert / Banner / System Notification / Notification Center）的适用边界与 Uter 真实落点。
4. 与 `UDS5-S14` §5.3 重复实现合并决定一致：`components/notification-popover.tsx:156` 的局部 `EmptyState` 应复用 `components/empty-state.tsx`。

---

## 2. 事实基线（可核验，禁止假设）

| 项 | 真实值 | 来源 |
|---|---|---|
| Toast | `sonner ^2.0.7`；`toast.success` / `toast.error` 等统一方式 | 审计 §2；`web/AGENTS.md` §3.9 / 3.1 |
| 内联提示 | `ui/alert.tsx` | Clerk 分析 2.14 |
| 状态封装 | `components/empty-state.tsx` / `loading-state.tsx` / `error-state.tsx` | Clerk 分析 2.14 / `web/AGENTS.md` 3.3 表 |
| 通知中心 | `web/src/components/notification-popover.tsx`（`:156` 有局部同名 `EmptyState`） | 审计 §5 |
| 错误归属 | 普通请求拦截器**不弹 Toast**；`createAppQueryClient` 在 Query/Mutation 最终失败时提示；Mutation 自定义 `onError` 负责自己的提示或表单错误；自动重试期间与主动取消不报错；`meta.errorToast: false` 关闭自动提示 | `web/AGENTS.md` §3.9 |
| 错误函数 | `handleServerError(error, fallbackMessage?)`；相同失败沿 `cause` 传播时只提示一次；不同操作即使文案相同也分别提示；禁止把完整 Axios 错误对象写入管理 | `web/AGENTS.md` §3.9 |
| 业务失败 | `requireServerSuccess` 检查 `success:false`；`createServerError`；`AuthOperationError` 安全消息 | `web/AGENTS.md` §3.9 |
| 路由级错误 | 由 `errorComponent` 承接，提供友好错误页并记录排查信息 | `web/AGENTS.md` §3.9 |
| 文案 | 常量只存 i18n 键，展示用 `t()`；7 份 locale 同步 + `static-keys.ts` | `web/AGENTS.md` 3.1；`UDS5-S18` |
| i18n 基线 | 7 份 locale（`en,fr,ja,ru,vi,zh-TW,zh`），54,573 行 | 审计 §2 |
| **Clerk 无通用通知规范** | `ClerkLoaded/ClerkLoading/ClerkFailed/ClerkDegraded` 是**认证状态控制组件**，不是通用 Toast / Alert / Banner 规范；§1.1 明确无 Toast/Snackbar/Banner 通用规范 | Clerk 分析 §1.1 / 2.14 |
| 证据状态 | `VERIFIED 0 / PARTIAL 9 / NOT_VERIFIED 56`；`components:registry:strict EXIT=1` | 审计 §5 |

---

## 3. 6 类通知组件定义

| 类型 | 定义 | 位置 | 时长 | 可操作性 | Uter 真实映射 |
|---|---|---|---|---|---|
| Toast | 短暂、非阻塞的全局操作反馈 | 视口角落浮层 | 自动消失 | 可带 action | `sonner`（`toast.success/error/info/warning`） |
| Snackbar | 底部条状反馈，可承载一个撤销动作 | 视口底部 | 自动/手动消失 | **必须带 action**（如 Undo） | `sonner` 的 action 能力（不另引组件库） |
| Alert | 页面内、与内容同流的持久提示 | 内容区 / 表单顶部 | 常驻至关闭或状态解除 | 可带链接/操作 | `ui/alert.tsx` |
| Banner | 页面级、跨会话的系统性告知（维护 / 配额 / 版本） | Page Header 上方 | 常驻至 dismissed | 可带链接 | `ui/alert.tsx` 组合（无独立 Banner 组件，属规范保留位） |
| System Notification | 浏览器 / 操作系统级通知 | 系统通知区 | 由 OS 管理 | 点击可回应用 | **当前无独立实现**，列为规范保留位；引入需评估依赖与权限，本轮不落地 |
| Notification Center | 站内消息聚合入口 | 顶栏图标 + 浮层 | 常驻 | 已读/清空/跳转 | `web/src/components/notification-popover.tsx` |

> **不虚构声明**：Uter 无独立 `Banner` / `System Notification` 组件，上表以「规范保留位 / 现有组件组合」如实标注；`snackbar` 由 `sonner` 的 action 能力承担，不引入新依赖。

---

## 4. 五类反馈 × 组件映射

| 类别 | 语义 | 组件映射 | 文案来源 | 生命周期 | 禁止 |
|---|---|---|---|---|---|
| 成功反馈 | 操作完成且达到预期结果 | `sonner` `toast.success`；或内联 `ui/alert.tsx` 成功态 | `t(SUCCESS_MESSAGES.xxx)` | 自动消失（Toast）/ 常驻（Alert） | 禁止把常量当最终文案；禁止多操作合并为一条 |
| 普通信息 | 中性、无需行动的告知 | `sonner` `toast.info` / `ui/alert.tsx` info 态 / Banner | `t()` | 自动消失或可关闭 | 禁止用错误色表达普通信息 |
| 警告 | 可继续但有风险（配额将满 / 弃用提示） | `ui/alert.tsx` warning 态 / Banner / `toast.warning` | `t()` | 常驻至解除 | 禁止与「可恢复错误」混用同一视觉 |
| 可恢复错误 | 业务预期内失败，用户可重试或修正 | `toast.error`（无字段归属时）/ 字段级错误（`form.setError`，`UDS5-S18`）/ `error-state.tsx` 带重试 | `handleServerError` 保留服务端原因，`t()` | 用户修正或重试后清除 | 禁止自动重试期间报错；禁止主动取消报错 |
| 不可恢复错误 | 非预期错误 / 降级 / 超时，用户无法自助恢复 | `error-state.tsx` / `errorComponent` 友好错误页 / `empty-state.tsx`（仅当无可展示内容） | `t()` + 排查信息 | 常驻至刷新/升级路径 | 禁止伪装成「空数据」；禁止把 Axios 错误对象写入管理或展示 |

### 4.1 映射口径

- **空态不等于错误态**：`components/empty-state.tsx` 只承载「无数据 / 引导」，不可用于渲染请求失败；`components/error-state.tsx` / `loading-state.tsx` 分别承载错误与加载（`web/AGENTS.md` 3.3 入口表）。
- **常量即键**：`SUCCESS_MESSAGES` / `ERROR_MESSAGES` 的值仅表示 i18n 键，展示必须 `toast.success(t(...))` / `toast.error(t(...))`（`web/AGENTS.md` 3.1）。
- **去重**：相同失败沿 `cause` 传播只提示一次；不同操作即使文案相同也分别提示（§3.9）。
- **可访问性**：Toast / Alert 须有可访问名称与合适的 `role`（status / alert），装饰图标 `aria-hidden`（`web/AGENTS.md` 3.12）。

---

## 5. 错误处理归属（`web/AGENTS.md` §3.9，强制）

| 主体 | 职责 | 明确不做 |
|---|---|---|
| 普通请求拦截器 | 认证刷新、请求重试、去重（`web/AGENTS.md` 3.6） | **不弹 Toast** |
| `createAppQueryClient` | 在 Query / Mutation **最终失败**时统一提示 | 不在自动重试期间提示 |
| Mutation 自定义 `onError` | 负责自己的提示或表单错误映射（`form.setError`） | 不把失败结果当作保存成功 |
| `meta.errorToast: false` | 关闭自动提示，页面仍可主动调用错误处理函数 | 不得借此吞掉错误 |
| `handleServerError(error, fallbackMessage?)` | 优先保留服务端具体原因；`cause` 传播去重 | 禁止写入完整 Axios 错误对象 |
| `errorComponent` | 路由级错误：友好错误页 + 排查信息 | 不暴露凭据 |
| 自动重试 / 主动取消 | 静默 | **不报错**（`UDS5-S17` Cancel / Retry 五态） |

### 5.1 提示链路

| 步骤 | 动作 |
|---|---|
| 1 | 请求失败 → 判定是否自动重试 / 主动取消；是则静默 |
| 2 | 否 → `handleServerError` 保留原因并去重 |
| 3 | 有字段归属 → `form.setError` 字段级展示（可恢复错误） |
| 4 | 无字段归属 → `createAppQueryClient` 最终失败回调或 Mutation `onError` 决定 Toast / `error-state` |
| 5 | 自定义提示 → 设 `meta.errorToast: false`，由页面主动处理 |
| 6 | 路由级 → `errorComponent`（不可恢复错误） |
| 7 | 全部文案经 `t()`，7 份 locale 同步 + `static-keys.ts` 登记（`UDS5-S18`） |

> 支付 / 充值 / 退款 / 余额 / 订单 / 认证 / 授权相关错误提示**只改视觉与复用**，不改 API 契约、资金逻辑或安全约束（审计 §6.1 红线 / §13 第 2 条）；`AuthOperationError` 的安全消息不得解开来源展示被屏蔽细节。

---

## 6. Clerk 无通用通知规范（明确声明）

> 依据 `CLERK-DESIGN-REFERENCE-ANALYSIS.md` §1.1 与 2.14：Clerk 官方组件目录中的 `ClerkLoaded` / `ClerkLoading` / `ClerkFailed` / `ClerkDegraded` 是**认证状态控制组件**，不是通用 Toast / Alert / Banner 规范；官方未提供 Toast / Snackbar / Banner 通用规范，也未提供通用 Empty State / Skeleton 规范（Decision = `Reject`）。因此本规范的 6 类通知与 5 类反馈**全部为 Uter 自有定义**，仅借鉴「按加载 / 失败 / 降级状态分离渲染」的原则（2.14），不引入 Clerk SDK 或 `@clerk/ui` 主题包。

---

## 与其他规范的关系

| 规范 | 关系 | 边界 |
|---|---|---|
| `UDS5-S01` | 效力来源 | 不重述总则 |
| `UDS5-S03`–`S13` | 状态色 / 对比度 / 动效 / 无障碍 Token | 通知只消费语义色，不定义 Token |
| `UDS5-S14` | H 类 Feedback 组件清单、`EmptyState` 3 处重复合并决定 | 本规范给组件映射与提示归属 |
| `UDS5-S15` | 组件 API 与事件约定 | 通知不改 API |
| `UDS5-S16` | 页面 Empty / Loading / Error 三态 | 模板消费本规范映射 |
| `UDS5-S17` | 交互五态（成功/失败/取消/加载/异常） | 反馈通道在 S17 矩阵，组件映射在本规范 |
| `UDS5-S18` | 字段级错误、`handleServerError`、i18n 7 locale 同步 | 表单错误细化在 S18 |
| `UDS5-S19` | 数据展示的空/加载/错误态 | 空态不等于错误态的口径一致 |
| `web/AGENTS.md` | **强制上位约束**：§3.9 错误处理、3.1 i18n、3.12 可访问性、3.14 测试 | 冲突时以 `web/AGENTS.md` 为准 |
| `CLERK-DESIGN-REFERENCE-ANALYSIS.md` | §1.1 / 2.14 明确官方无通用通知规范 | 不归为 Clerk 能力 |

---

## 代码实施位置

| 用途 | 真实路径 | 本轮动作 |
|---|---|---|
| Toast / Snackbar | `sonner`（`toast.success/error/info/warning` + action） | **只读** |
| 内联提示 / Banner | `web/src/components/ui/alert.tsx` | **只读** |
| 空 / 加载 / 错误态 | `web/src/components/empty-state.tsx` / `loading-state.tsx` / `error-state.tsx` | **只读**；合并决定见 `UDS5-S14` §5.3 |
| 通知中心 | `web/src/components/notification-popover.tsx` | **只读**（`:156` 局部 `EmptyState` 待合并） |
| 错误处理 | `handleServerError` / `createAppQueryClient` / `requireServerSuccess` / `createServerError` / `AuthOperationError` / `errorComponent`（`web/AGENTS.md` §3.9） | **只读**，不改 |
| i18n | `web/src/i18n/locales/{en,fr,ja,ru,vi,zh-TW,zh}.json`、`web/src/i18n/static-keys.ts` | **只读** |
| 前端规范 | `web/AGENTS.md`（§3.9 / 3.1 / 3.12 / 3.14） | **只读** |
| 规范输出 | `docs/design-system/uter-design-system-5.0/20-NOTIFICATION-STANDARD.md` | **本文件（新建）** |

> 未列出的组件（独立 Banner / System Notification）、脚本、测试结果不虚构为已存在；系统级通知引入属后续评估，本轮不落地。

---

## 自动化验证

| 验证项 | 真实命令 / 门禁 | 基线结果 | 本规范状态 |
|---|---|---|---|
| 类型 / Lint | `bun run typecheck` / `bun run lint` | 本轮未运行 | `NOT_VERIFIED` |
| i18n 同步 | `i18n:sync` | 审计 §7 列为**未接入 CI** | `NOT_VERIFIED` |
| 反馈交互回归 | Vitest + RTL（288 个 `*.test.ts(x)` 为基线，引用审计 §6） | 未重跑 | `NOT_VERIFIED` |
| 可访问性 | `test:axe`（2 spec） | 刻意不接 CI（审计 §7） | `NOT_EXECUTED` |
| 注册表证据 | `components:registry:strict` | **`EXIT=1`**，`VERIFIED 0 / PARTIAL 9 / NOT_VERIFIED 56` | 未重跑 |
| 6 类 / 5 类映射覆盖 | 无现成脚本 | 不可判定 | `NOT_VERIFIED` |
| 全量构建 | `bun run build:check` 等 | 并发 WIP 211 项，审计标 `NOT_EXECUTED` | **不执行** |

---

## 验证状态

| 项 | 状态 | 说明 |
|---|---|---|
| 本规范文本 | `ACTIVE` | 已撰写，供评审 |
| 6 类通知 / 5 类反馈组件映射 | `NOT_VERIFIED` | 规范层定义，未跑门禁或测试 |
| 独立 Banner / System Notification | `NOT_VERIFIED` | **当前无独立实现**，仅为规范保留位 |
| 错误处理归属（§3.9）落地 | `NOT_VERIFIED` | 未核对代码，不宣称一致 |
| `notification-popover.tsx` 局部 EmptyState 合并 | `NOT_VERIFIED` | 合并决定见 `UDS5-S14`，本轮不落地 |
| 7 份 locale 同步 + `static-keys.ts` | `NOT_VERIFIED` | 未核对 |
| 65 个组件证据 | `NOT_VERIFIED` | `VERIFIED 0 / PARTIAL 9 / NOT_VERIFIED 56`，`components:registry:strict EXIT=1` |
| 全量构建 / 视觉回归 / E2E | `NOT_EXECUTED` | 审计 §1 / §7 / §13 / §14 约束 |
| Android / iOS / HarmonyOS | `NOT_VERIFIED` | 无真实实现（审计 §8、结论 C） |

> **最终状态低于 `FULLY_IMPLEMENTED_AND_VERIFIED`**：本规范为 Uter 自有定义，不宣称任何通知行为已通过验证。
