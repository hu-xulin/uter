# 用户组件规范（User Component Standard）

> UTER Design System 5.0 · 分册 S30。本规范定义「用户身份展示、账户资料、API Key、额度用量、安全设置的界面约束」。**核心口径：API Key 默认只返回掩码，明文仅经二次验证的专用端点按需取回；额度与用量一律走 `@/lib/format` / `@/lib/currency` 并配 `tabular-nums`；身份展示禁止暴露内部数字 ID**。**5.0 为当前唯一正式体系，3.0 保留为历史**，本文引用 3.0 §1.14 / §12.3 仅用于溯源。除标明已核实的真源代码位置外，未宣称任何测试通过或平台验收。

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S30` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01`（UTER Design System 5.0 总纲） |
| 生效日期 | `2026-11-14` |
| 适用范围 | `web/src/features/profile/`、`web/src/features/security/`、`web/src/features/keys/`、`web/src/features/users/`、`web/src/features/usage-logs/`（用户与用量相关部分）、`web/src/components/ui/{avatar,badge,table,dialog,alert-dialog,form}.tsx`、用户身份与用量相关的后端响应构造（`model/token.go`、`controller/token.go`） |
| 验证状态 | `NOT_VERIFIED` |

---

## 1. 总则

| 编号 | 原则 | 说明 |
|---|---|---|
| U-1 | 身份唯一 | 一个用户在界面上只有一个主身份标识；主标识优先级由业务规则固定，不得由各页面自行决定（见 §4）。 |
| U-2 | 内部 ID 不外露 | 数据库自增 id 是内部标识，界面须用展示编号（`formatUserId`），不得把裸数字 id 当作用户可读名称。 |
| U-3 | 密钥默认掩码 | 任何列表、详情、搜索结果、日志与错误文案中，API Key 一律以掩码形态出现；明文只允许经二次验证的专用端点按需取回。 |
| U-4 | 明文最小暴露 | 明文密钥不得写入 URL、查询串、日志、审计表、分析事件、前端持久化存储；不得进入组件 state 的长期缓存。 |
| U-5 | 危险操作可确认 | 删除 / 撤销 / 额度调整 / 账户注销必须二次确认，并在确认文案中展示受影响对象的名称与影响面。 |
| U-6 | 数值可读 | 一切额度、余额、用量、计数走统一格式化封装；数字与金额列必须 `tabular-nums`，禁止手写 `toFixed` 拼装展示值。 |
| U-7 | 状态先于操作 | 安全设置、令牌状态、额度状态须先显示当前状态，再给操作入口；不得让用户从「可点」推断「已生效」。 |
| U-8 | 三态齐备 | 用户与用量相关页面必须具备加载 / 空 / 错误三态；失败不得渲染为「暂无数据」。 |
| U-9 | 只改界面 | 本规范只约束视觉、组件复用与交互表现；认证、授权、资金、计费、密钥生成与校验契约零改动（`UDS5-S22` R1–R3）。 |

---

## 2. 事实基线（引自审计报告与参考分析，不得假设）

| 项 | 真实值 | 来源 |
|---|---|---|
| 掩码算法 | `MaskTokenKey`：`len==0` → `""`；`len<=4` → 全部 `*`；`len<=8` → `key[:2] + "****" + key[len-2:]`；否则 → `key[:4] + "**********" + key[len-4:]` | `model/token.go:64-75`（`GetMaskedKey` 委托之，`model/token.go:81-83`） |
| 密钥本体长度 | `common.GenerateKey()` → `GenerateRandomCharsKey(48)`，48 位随机串；前端展示统一加 `sk-` 前缀 | `common/utils.go:229-232`、`common/utils.go:206-218`；`web/src/features/keys/components/api-keys-cells.tsx:58` |
| 列表 / 详情 / 搜索返回 | `buildMaskedTokenResponse` / `buildMaskedTokenResponses` 覆写 `Key` 为掩码值后再返回 | `controller/token.go:58-81`；调用点 `controller/token.go:143,160,191,207,576` |
| 创建返回 | `AddToken` 成功响应体只有 `{"success":true,"message":""}`，**不含明文** | `controller/token.go:429-432` |
| 明文取回端点 | `POST /api/token/:id/key`（单条）与 `POST /api/token/batch/keys`（批量，上限 100）返回明文；两者均挂 `middleware.TokenKeySecureVerificationRequired()` + `CriticalRateLimit()` + `DisableCache()` + `TokenOperationAudit()` | `controller/token.go:222-240`、`controller/token.go:609-641`；路由 `router/api-router.go:373,378` |
| 明文取回门禁 | `RequireSecurityProof` 校验 `X-Security-Proof` 头，scope `token.key.read`；失败返回 `SECURITY_PROOF_REQUIRED / INVALID / EXPIRED / CONSUMED / SCOPE_MISMATCH` | `middleware/secure_verification.go:40-93`；scope 常量 `service/security_verification.go:31` |
| 明文取回审计 | `TokenOperationAudit` 将 `POST /api/token/:id/key` 记为 `token.key_view`、`/batch/keys` 记为 `token.key_view_batch` | `middleware/audit.go:210-232` |
| 前端明文取回链路 | `resolveRealKey(id)` / `resolveRealKeysBatch(ids)` 先 `requestVerification({scope:'token.key.read'})` 取一次性 proof，再带 `X-Security-Proof` 调后端；明文仅存于 React state `resolvedKeys` | `web/src/features/keys/components/api-keys-provider.tsx:84-160`；`web/src/features/keys/api.ts:117-145` |
| 密钥展示形态 | 表格内显示 `sk-<掩码>`，点击展开 Popover 显示完整值 + 复制按钮；弹层内明文走 `Input mono`（`font-mono` + `text-long` 16px） | `web/src/features/keys/components/api-keys-cells.tsx:44-119`；`web/src/components/masked-value-display.tsx` |
| 掩码触发器实际渲染 | 表格内的掩码触发器 `MaskedValueTrigger` 以 `<Button size='sm'>` 渲染，**静态态实际字号为 12px（`text-xs` 胜出）而非预期的 13px**；且 `text-mono` 归入 tailwind-merge 颜色组，会把 `text-muted-foreground` 挤掉，静态态文字色回落继承 `var(--foreground)`（`#0f172a`）而非 muted（`#64748b`）——**属真实代码缺陷，见 S30-D15，修复前不得当作 13px 等宽正文的可复用源** | `web/src/components/masked-value-display.tsx:30-42`；`web/src/components/ui/button.tsx:69`；`web/src/lib/utils.ts:19-23` |
| 密钥筛选不进 URL | 密钥页按密钥筛选走 `POST /api/token/search`（请求体），不用 GET 查询串；注释明示原因（地址栏 / 历史 / Referer / 网关日志） | `controller/token.go:164-193`；`web/src/features/keys/api.ts:44-60` |
| 控制台访问令牌 | 前缀 `nap_`，后缀 43 位随机；库内只存 `TokenHash`（SHA-256）与 `TokenHint`（后 4 位）；创建响应一次性返回明文 `{"token": raw, ...}`，列表只显示 `nap_…<hint>` | `model/user_access_token.go:17,225-231`、`model/audit_log.go:66-75`；`controller/access_token.go:154-186`；`web/src/features/security/components/access-token-item.tsx:85` |
| 访问令牌数量 / 有效期上限 | 单用户最多 20 个；过期时间距今至少 3600 秒（1 小时） | `service/access_token_scope.go:18`、`controller/access_token.go:18,133` |
| 用户展示编号 | `formatUserId`：`U` + `100000000 + id`，如 id=1 → `U100000001`；旧前缀 `uter100000001` 已废弃（2026-10-28）但解析侧仍接受 | `web/src/lib/format.ts`（`USER_ID_DISPLAY_BASE = 100_000_000`、`USER_ID_DISPLAY_PREFIX = 'U'`） |
| 显示名优先级 | `getDisplayName`：`display_name \|\| username`；头像首字母取 `username \|\| displayName`，取名首字符大写，空则 `?` | `web/src/features/profile/lib/format.ts:41-44`；`web/src/lib/avatar.ts:93-95` |
| 头像尺寸档 | `web/src/components/ui/avatar.tsx`：`size` 取 `default \| sm \| lg`；基线 `size-8`（32px）、`sm` → `size-6`（24px）、`lg` → `size-10`（40px）；与 3.0 §12.3「头像 24/32/40px 三档」一致 | `web/src/components/ui/avatar.tsx:26-46`；3.0 §12.3（`docs/design-system/UTER-DESIGN-SYSTEM-3.0.md:1790`） |
| 头像底色对比 | 头像底色按用户名哈希取色相，亮度逐档压暗直到白字 ≥ 4.5:1（`MIN_WHITE_CONTRAST = 4.5`） | `web/src/lib/avatar.ts`（`getUserAvatarStyle`） |
| 额度字段 | API Key：`remain_quota`（剩余）、`used_quota`（已用）、`unlimited_quota`（无限额）、`expired_time`（`-1` 为永不过期） | `model/token.go:17-27`；`web/src/features/keys/types.ts`（`apiKeySchema`） |
| 额度口径 | 总额 = 已用 + 剩余；**不是初始分配也不是周期预算**；改剩余会同步改总额与百分比 | `web/src/features/keys/components/api-key-quota-cell.tsx`（Popover description 原文） |
| 额度展示位置 | 密钥表 `Quota` 列 → `ApiKeyQuotaCell`（剩余 / 已用 + 百分比进度条）；用户表 `Available Balance` 列 → `UserQuotaCell`；用量日志 `Cost` 列 → `LogCostDisplay` | `web/src/features/keys/components/api-keys-columns.tsx:158-165`、`web/src/features/users/components/users-columns.tsx:181`、`web/src/features/usage-logs/components/columns/common-logs-columns.tsx:776-794` |
| 额度告警阈值 | 剩余百分比 ≤ 10% → `text-destructive`；≤ 30% → `text-warning`；其余 `text-success`；失效态 `text-muted-foreground` | `web/src/features/keys/components/api-key-quota-cell.tsx`（`progressColor` 分支） |
| 额度格式化 | 金额走 `@/lib/currency` 的 `formatQuotaWithCurrency`；日志费用走 `@/lib/format` 的 `formatLogQuota`（大数 4 位 / 小数 6 位、不缩写）；`formatNumber` / `formatCompactNumber` 供普通计数 | `web/src/lib/format.ts`、`web/src/lib/currency.ts`；`web/src/features/usage-logs/components/log-cost-display.tsx:30,122` |
| 额度单位 | `common.QuotaPerUnit = 500 * 1000.0`（500,000 单位 = 1 USD） | `common/constants.go:27` |
| 子额度月度口径 | 组织子额度：`sub_quota_limit` 为上限，`month_consumed` 为自然月内累计（已扣退款）；二者不可混用 | `web/src/features/profile/components/profile-header.tsx:100-115` |
| 密钥状态 | `1` 启用 / `2` 禁用 / `3` 过期 / `4` 额度耗尽 | `web/src/features/keys/constants.ts:26-31` |
| 状态标签 | `web/src/components/ui/badge.tsx` 的 `cva()` 提供 `default / secondary / destructive / warning / outline / ghost / link` 七变体，高 24px、字 `text-xs`；状态语义色由 `web/src/components/status-badge.tsx` 的 `StatusBadge` 承担 | `web/src/components/ui/badge.tsx:25-58`；`web/src/components/status-badge.tsx:57-105` |
| 危险操作封装 | `web/src/components/confirm-dialog.tsx`（`ConfirmDialog`，含 `destructive` 变体）+ `web/src/components/ui/alert-dialog.tsx`；密钥删除已用 `AlertDialog` 并在正文展示密钥名称 | `web/src/components/confirm-dialog.tsx:36-82`；`web/src/features/keys/components/api-keys-delete-dialog.tsx:71-87` |
| 二次验证 | 账户删除需输入用户名 + `scope: 'account.delete'`；管理员删用户需 `scope: 'admin.user.delete'` + `user_id` 上下文 | `web/src/features/security/components/dialogs/delete-account-dialog.tsx:45-103`；`web/src/features/users/components/users-delete-dialog.tsx:45-90` |
| 数字格式红线 | 普通 / 紧凑数字优先 `@/lib/format`；`Intl.*` 语言参数须经 `toIntlLocale()`（`zhCN→zh-CN`、`zhTW→zh-TW`）；lint 规则 `project/intl-locale` 为 error | `web/AGENTS.md` §3.1；`web/src/i18n/languages.ts:116-131` |
| i18n | 7 份 locale：`en / fr / ja / ru / vi / zh-TW / zh`；`web/scripts/check-i18n-keys.mjs` 校验静态 `t('...')` 键覆盖 | `web/src/i18n/locales/`；`web/scripts/check-i18n-keys.mjs`（接入 `bun run lint` / `i18n:check`） |
| 最小字号 | 全站可见文本下限 12px（T16 门禁）；正文 14/22、caption 12/18、长文本 16/26 | `docs/design-system/uter-design-system-5.0/02-FOUNDATION-STANDARD.md`；`web/scripts/check-design-tokens.mjs`（T16） |
| 焦点环 | 2px（`ring-2`，`--ds-focus-ring-width: 2px`），已裁决 | `web/src/design-system/tokens/semantic.css:123`；`UDS5-S13` §7 |
| 证据状态 | 65 条注册 `VERIFIED 0 / PARTIAL 9 / NOT_VERIFIED 56`；`components:registry:strict EXIT=1` | `docs/design-system/uter-design-system-5.0/audit/BASELINE-AUDIT.md` §5 |
| 视觉基线覆盖 | 鉴权基线 9 页 × 2 视口 = 18 张 PNG，其中与本分册相关的是 `/keys`、`/profile`、`/usage-logs`（各 2 张）；`/security`、`/users` **不在** `AUTHENTICATED_ROUTES` 清单内，无基线 | `web/e2e/visual/lib/pages.ts:44-62`；`web/e2e/visual/authed.spec.ts-snapshots/` |

---

## 3. 范围与边界

| 维度 | 内容 |
|---|---|
| 覆盖 | 用户身份展示（头像 / 显示名 / 展示编号 / 邮箱 / 用户组 / 角色）、账户资料页、API Key 管理、额度与用量展示、安全设置（密码 / 2FA / Passkey / 会话 / 访问令牌 / 隐私）、用户管理（管理员视角）。 |
| 不覆盖 | 钱包余额与充值、计费与账单历史、模型 / 渠道配置、审计日志详情页、系统设置其他子域 —— 这些由 `UDS5-S22` 与各自分册管辖；本分册只在「用户身份 / 额度口径」维度提出约束。 |
| 与组织域的分界 | **组织结构、`org_role`、组织钱包、组织成员配额归 `UDS5-S31`**；本分册只覆盖个人域 API Key、身份展示与用量呈现。组织子额度仅在**本人资料页**作为「累计账本 vs 自然月用量」的口径引用（U-6.9），不定义组织侧展示规则。 |
| 硬边界 | 认证、授权、Casbin 策略、`ROLE.ADMIN` 守卫、密钥生成与校验、计费规则、数据库结构**零改动**；本分册只约束视觉、组件复用与交互表现（`UDS5-S22` §1.2 R1–R3）。 |
| 平台 | PC Web / H5 一致适用；Android / iOS / HarmonyOS 无实现，一律 `NOT_VERIFIED`（`docs/design-system/uter-design-system-5.0/audit/BASELINE-AUDIT.md` §8）。 |

---

## 4. 用户身份展示

> **风险等级归属（按条）**：本节 8 条按 `UDS5-S01` §4A.3 判据**逐条**标注——全部为**纯展示 / 只读**（身份标识、头像、遮蔽），无资金 / 凭据 / 权限 / 账户的写操作，故均属 **`RISK-P2`**。逐条归属见下表「风险等级」列。裸写 `P1` / `P2` 在本分册一律指 `UDS5-S01` §4A.1 定义的**待办优先级**，非业务风险等级。

| 编号 | 风险等级 | 规则 | 内容 | 判定 |
|---|---|---|---|---|
| U-4.1 | `RISK-P2` | 主标识优先级 | 固定为 **显示名（`display_name`）→ 用户名（`username`）→ 展示编号（`formatUserId`）**；已有实现 `getDisplayName` 与头像取名顺序须保持，不得在单页另立优先级。 | 同一用户在不同页面主标识一致 |
| U-4.2 | `RISK-P2` | 展示编号 | 界面上的用户 ID 一律经 `formatUserId`（`U100000001` 形式），可复制；**禁止**直接渲染裸 `id` 数字，也禁止把展示编号当接口参数回传（回传走 `parseUserId`）。 | 无裸数字 id 外露 |
| U-4.3 | `RISK-P2` | 内部标识分离 | 用户名以 `@username` 形式与显示名同行区分；邮箱仅在归属本人或管理员必要场景显示，不得作为列表主键或排序依据。 | 列表主键稳定 |
| U-4.4 | `RISK-P2` | 头像三档 | 只用 `web/src/components/ui/avatar.tsx` 的 `default`（32px）/ `sm`（24px）/ `lg`（40px）三档；不得另造第四档。 | 无自造尺寸 |
| U-4.5 | `RISK-P2` | 头像回退 | 缺头像时用 `AvatarFallback` 显示名首字符（大写，空则 `?`）；底色由 `getUserAvatarStyle` 按名哈希生成，白字对比 ≥ 4.5:1。 | 首字母可读 |
| U-4.6 | `RISK-P2` | 头像可访问名称 | 头像容器须有可访问名称（承载用户名或显示名）；纯装饰头像加 `aria-hidden="true"`。 | 辅助技术可读 |
| U-4.7 | `RISK-P2` | 超长与窄屏 | 用户名 / 显示名 / 邮箱一律截断展示（`truncate` / `LongText`），不得撑破表格列宽；窄屏走 `data-table` 的移动列表形态。 | 窄屏不溢出 |
| U-4.8 | `RISK-P2` | 状态与角色 | 角色、用户组、状态用 `StatusBadge` / `web/src/components/ui/badge.tsx` 语义变体表达；不用原始色值。 | 色值走 Token |

> 头像尺寸档以运行时真值 32/24/40px 为准，与 3.0 §12.3「头像 24/32/40px 三档」一致；3.0 §1.14 的 12px 下限适用于 `AvatarFallback` 文字（现行 `text-sm` / `sm` 档 `text-xs`，均为 ≥ 12px，合规）。

---

## 5. API Key 管理（掩码 / 明文取回 / 复制 / 撤销）

> **风险等级归属（按条，非整节）**：本节 13 条规则按 `UDS5-S01` §4A.3 的判据**逐条**分级，归属列见下表第 2 列。**不得**把整节视为同一等级。
>
> - **`RISK-P0`**（触及凭据本体 / 撤销 / 明文外泄路径）：U-5.1、U-5.2、U-5.3、U-5.4、U-5.5、U-5.6、U-5.7、U-5.8、U-5.9
> - **`RISK-P1`**（权限可见性）：U-5.13
> - **`RISK-P2`**（展示形态与布局）：U-5.10、U-5.11、U-5.12
>
> 蓝图 §8 明列 `RISK-P0` 的是「**API Key 明文展示**」，故凡触及**明文本体生命周期**（取回、驻留、持久化、掩码边界）者归 `RISK-P0`；纯展示形态与交互反馈归 `RISK-P2`。**边界说明**：强验证 scope `token.key.read` 的完整清单以 `service/security_verification.go:26-54` 为真源。裸写 `P1` / `P2` 在本分册一律指 `UDS5-S01` §4A.1 定义的**待办优先级**，非业务风险等级。

### 5.1 掩码与明文边界（高敏感）

| 编号 | 风险等级 | 规则 | 内容 |
|---|---|---|---|
| U-5.1 | `RISK-P0` | 默认只给掩码 | 列表、详情、搜索、批量操作结果、错误文案、审计记录一律掩码；掩码格式以 `MaskTokenKey` 为唯一真源，前端展示加 `sk-` 前缀。 |
| U-5.2 | `RISK-P0` | 创建不返回明文 | 创建成功响应不得携带明文密钥（现行 `AddToken` 响应体只有 `success` / `message`）。前端**不得**依赖创建响应拿到明文。 |
| U-5.3 | `RISK-P0` | 明文按需取回 | 明文只能来自 `POST /api/token/:id/key`（单条）与 `POST /api/token/batch/keys`（批量，上限 100）；调用前必须先取 `scope: 'token.key.read'` 的一次性 proof 并置于 `X-Security-Proof` 头。 |
| U-5.4 | `RISK-P0` | 安全窗口边界 | **目标口径**：明文**每次可见**都必须是一次通过当次强验证的交互；**缓存不得使未验证的明文再次可见**，关闭 Popover 后明文即失效，下次查看须重新走二次验证。**仓库现状（与目标口径存在差距，见 S30-D11）**：同页会话内按密钥维度缓存明文（`resolvedKeys`），再次打开 Popover 复用缓存而不重新验证；缓存不落 `localStorage` / `sessionStorage` / 持久化 store，provider 卸载即失效。**缓存边界仍然合规**（不跨页面 / 跨会话 / 不持久化），故**不是** `RISK-P0` 合规缺口，仅是「关闭即失效」体验目标未达；本分册要求缓存**不得扩大到跨页面、跨会话或持久化存储**；收敛到「关闭即失效」属待办，本轮不改代码。 |
| U-5.5 | `RISK-P0` | 明文不落持久化 | 禁止把明文写入 URL / 查询串 / `localStorage` / `sessionStorage` / Zustand persist / 分析事件 / 埋点 / 前端日志；按密钥筛选必须走请求体（`POST /api/token/search`），不得退回 GET 查询串。 |
| U-5.6 | `RISK-P0` | 明文不长期驻留 | 明文只允许存在组件内存态（`resolvedKeys`）且不落持久化；批量取回后按密钥维度缓存，页面离开即失效。**禁止**把明文写入审计表（审计只记 `token.key_view` / `token.key_view_batch` 动作与 id / name，不记密钥本体）。 |
| U-5.7 | `RISK-P0` | 复制反馈明确 | 复制按钮须有可访问名称与成功反馈（图标切换 + 文案，如 `Copied!`），失败要有错误提示；复制能力走 `@/lib/copy-to-clipboard` 的 `copyToClipboard` 或 `@/hooks/use-copy-to-clipboard`，弹层 / 对话框内的复制入口**优先复用** `@/components/copy-button` 的 `CopyButton`（自带 `aria-label` 随状态切换为 `Copied`）。仓库现状：密钥表格单元格内为 `Button` + `Tooltip` 手写实现（`aria-label` 随 `Copy` / `Loading...` / `Copied!` 同步），未走 `CopyButton`（见 S30-D12）。 |
| U-5.8 | `RISK-P0` | 撤销需二次确认 | 删除 / 撤销必须走 `ConfirmDialog` 或 `AlertDialog` 的 `destructive` 变体，**正文必须展示密钥名称**与不可逆说明（现行 `web/src/features/keys/components/api-keys-delete-dialog.tsx` 已展示 `currentRow.name`）；批量撤销展示数量。 |

### 5.2 展示与交互

| 编号 | 风险等级 | 规则 | 内容 |
|---|---|---|---|
| U-5.9 | `RISK-P0` | 展示形态 | 表格内显示 `sk-<掩码>`（`truncate` 截断）；完整值在 Popover 内以等宽字体呈现并提供一键复制（现行用 `Input mono` 只读框 + `autoFocus` + `onFocus` 全选）。不得在表格单元格内直接铺开明文。 |
| U-5.10 | `RISK-P2` | 等宽字体 | 掩码与明文一律走等宽字形族（`font-mono`）+ 对应语义字号档，**且字号档与字形族必须拆开指定**：弹层内明文用 `Input mono`（`font-mono` + `text-long` 16px），`MaskedValueDisplay` 的 `<pre>` 用 `text-mono font-mono`（13px，`web/src/components/masked-value-display.tsx:73-78`）。**表格内掩码触发器 `MaskedValueTrigger` 当前实际渲染 12px 而非 13px，且静态态文字色回落为继承色而非 muted**（它以 `<Button size='sm'>` 渲染，Button sm 档自带 `text-xs`，而自定义 `text-mono` 不被 tailwind-merge 识别为字号类、两者同层共存后由源码顺序决定 `text-xs` 胜出；同一根因下 `text-mono` 归入颜色组会挤掉 `text-muted-foreground`，详见 S30-D15），**修复前不得把它当作 13px 等宽正文的可复用源**。**禁止**用 `text-xs`（12px）冒充等宽正文，**禁止**硬编码字号数值绕过语义档（3.0 §1.5 mono 四档；§1.14 控件与说明文字下限）；字号与字形拆分做法参照 `web/src/components/ui/input.tsx:65-69` 的既有约定。 |
| U-5.11 | `RISK-P2` | 列宽约束 | 掩码列按 **21 个等宽字符**（`sk-` + 掩码主体 18 位）预留宽度；按等宽字形族字符宽约 0.6em 估算，**14px 字号下约 176px**（与源码注释 `api-keys-columns.tsx:152-154` 一致）、13px 下约 164px、当前实际 12px 下约 151px（见 S30-D15）。加复制按钮（28px）与间距后列宽下限取 **208px**（现行 `size: 208`）——该值按最大字号前提推导，**偏保守、对三种字号均成立**。低于 208px 会截断成 `sk-3Enj****…` 并把复制按钮挤出单元格。 |
| U-5.12 | `RISK-P2` | 状态并列 | 密钥状态（启用 / 禁用 / 过期 / 额度耗尽）、分组、模型限制、IP 限制、到期时间分列表达，不用单个复合字符串。 |
| U-5.13 | `RISK-P1` | 权限提示 | 管理员守卫不足时只补**视觉提示**（如权限说明文案），**不改 `ROLE.ADMIN` 判定与路由重定向**。 |

---

## 6. 额度与用量

> **风险等级归属（按条）**：本节以**额度展示与口径**为主，属 `RISK-P2`；**U-6.11 管理员额度调整**属 `UDS5-S01` §4A 的 **`RISK-P0`**（蓝图 §8 明列「余额变更」为业务风险 P0 档，本分册一律写作 `RISK-P0`；调整他人额度即余额变更）。逐条归属见下表「风险等级」列。裸写 `P1` / `P2` 在本分册一律指 `UDS5-S01` §4A.1 定义的**待办优先级**，非业务风险等级。

| 编号 | 风险等级 | 规则 | 内容 | 判定 |
|---|---|---|---|---|
| U-6.1 | `RISK-P2` | 口径显式 | 每个额度展示必须说明口径：总额 = 已用 + 剩余，且**不是初始分配、不是周期预算**；改剩余会同步改总额与百分比。该说明必须出现在可查看详情的浮层内。 | 口径可查 |
| U-6.2 | `RISK-P2` | 区分三态 | 「无限额」「无额度」「额度为 0」必须区分展示：无限额显式标注；无额度用 `No Quota` 类中性标签；0 额度用中性色而非销毁态色。 | 三态可辨 |
| U-6.3 | `RISK-P2` | 进度条有文本 | 百分比进度条必须同时给出文本数值（`Remaining percentage`），并带 `aria-label`；不得只用颜色表达进度。 | 文本 + ARIA 齐备 |
| U-6.4 | `RISK-P2` | 告警阈值 | 剩余 ≤ 10% 用 `text-destructive`，≤ 30% 用 `text-warning`，其余 `text-success`；密钥失效（禁用 / 剩余 ≤ 0 / 已过期）统一 `text-muted-foreground`。 | 阈值一致 |
| U-6.5 | `RISK-P2` | 等宽数字 | 所有额度、余额、用量、计数展示加 `tabular-nums`，保证纵向小数点对齐。 | 数字对齐 |
| U-6.6 | `RISK-P2` | 统一格式化 | 金额与额度走 `@/lib/currency`（`formatQuotaWithCurrency`）；普通数字 / 紧凑数字走 `@/lib/format`（`formatNumber` / `formatCompactNumber`）；日志费用走 `formatLogQuota`。**禁止**手写 `toFixed` 拼装展示值。 | 无手写格式化 |
| U-6.7 | `RISK-P2` | 语言参数 | 数字 / 日期 / 时间进 `Intl.*` 前必须经 `toIntlLocale()`；`zhCN` / `zhTW` 不得直接传入；语言取自 `useTranslation()` 的 `i18n.resolvedLanguage \|\| i18n.language`，不得固化为模块常量。 | 语言切换即更新 |
| U-6.8 | `RISK-P2` | 币种不硬编码 | 展示基线默认 `¥`，但钱包 / 充值 / 定价 / 账单保留既有 USD 语义，由业务币种字段 + `@/lib/currency` 决定；规范不改资金逻辑、不硬编码符号。 | 资金零改动 |
| U-6.9 | `RISK-P2` | 子额度月度口径 | 组织子额度须区分「累计账本」（`sub_quota_limit` / `used_quota`）与「自然月内用量」（`month_consumed`）；「当月」字样只能配 `month_consumed`。 | 口径不混 |
| U-6.10 | `RISK-P2` | 用量日志 | 用量日志的 `Cost` 列走 `LogCostDisplay` + `formatLogQuota`，百分比 / 比例类数值保留既有精度语义；时间与费用均按语言参数格式化。 | 精度不丢 |
| U-6.11 | `RISK-P0` | 额度调整反馈 | 管理员调整额度（加 / 减 / 覆盖）须先展示**变更前后预览**再提交；失败保留输入并提示，不当作成功。 | 预览 + 失败可恢复 |

---

## 7. 用户安全设置（会话 / 密码 / MFA / 敏感资料）

> **风险等级归属（按条）**：本节涉及**凭据、账户与权限**的条目属 `UDS5-S01` §4A 的 **`RISK-P0`**（蓝图 §8 明列「权限提升、账户删除」为 P0；密码 / 2FA / 访问令牌同属凭据与账户边界）；**会话撤销、令牌授权变更**等可撤销操作属 **`RISK-P1`**；纯展示与状态呈现属 **`RISK-P2`**。逐条归属见下表「风险等级」列。裸写 `P1` / `P2` 在本分册一律指 `UDS5-S01` §4A.1 定义的**待办优先级**，非业务风险等级。

| 编号 | 风险等级 | 规则 | 内容 | 判定 |
|---|---|---|---|---|
| U-7.1 | `RISK-P2` | 先状态后操作 | 密码、2FA、Passkey、访问令牌、隐私项均先显示当前状态徽标（启用 / 禁用 / 已锁定 / 已备份 / 未备份）再给操作入口。 | 状态先行 |
| U-7.2 | `RISK-P1` | 会话撤销 | 会话项须展示设备 / 浏览器、IP、方法、最后活跃与到期时间；当前会话与其他会话用不同文案（`Sign out` / `Revoke`）；撤销走 `ConfirmDialog`；支持「撤销其他全部会话」并单独确认。 | 信息齐 + 有确认 |
| U-7.3 | `RISK-P1` | 密码规则 | 密码表单须展示规则提示（如长度区间）、密码确认字段、服务端错误就近展示；修改成功与「服务端已生效」不得由客户端单方面宣称。 | 规则可见 |
| U-7.4 | `RISK-P0` | 2FA 与备份码 | 2FA 状态区分启用 / 禁用 / 已锁定；备份码剩余数量必须可见；启用 / 禁用均需确认流程。 | 状态 + 数量可见 |
| U-7.5 | `RISK-P0` | 访问令牌 | 列表只显示 `nap_…<后 4 位>`，**不显示明文**；创建成功在一次性窗口内展示完整值并提供复制，窗口关闭后不可再取（库内仅存哈希与尾号）。 | 一次性窗口 |
| U-7.6 | `RISK-P1` | 令牌权限 | 令牌权限用分组徽标展示（`personal` / `admin` / `system`），超出可见数量用 `+N` 折叠徽标；撤销须说明影响（使用该令牌的脚本立即失效）。 | 权限可辨 + 影响说明 |
| U-7.7 | `RISK-P0` | 账户注销 | 注销账户须二次确认 + 输入用户名 + 二次验证（`scope: 'account.delete'`），并明示不可逆。 | 三重确认要素 |
| U-7.8 | `RISK-P0` | 管理员删用户 | 管理员删除用户须 `scope: 'admin.user.delete'` 二次验证并带 `user_id` 上下文，确认文案展示被删用户名。 | 验证 + 名称 |
| U-7.9 | `RISK-P2` | 敏感资料遮蔽 | 邮箱 / 手机号 / 令牌值在**列表与非归属本人场景**按遮蔽形态展示；确需完整值时走受控入口，不得默认平铺。仓库现状：`web/src/features/profile/components/profile-header.tsx` 在本人资料页平铺完整邮箱与用户名（本人场景，允许）；`web/src/features/users/components/users-columns.tsx` 的用户管理表**只展示用户名与显示名，不展示邮箱**（非本人 / 管理员列表场景，已遮蔽）。本分册沿用该口径，不得在列表新增邮箱平铺。 | 默认遮蔽 |
| U-7.10 | `RISK-P0` | 服务端为准 | 任何「已生效」结论必须以服务端返回为准；客户端成功提示不得替代服务端确认。 | 结论以服务端为准 |

---

## 8. 禁止事项汇总

1. 禁止在任何响应、日志、审计表、分析事件中返回或记录 API Key 明文（除 §5.3 受控端点的一次性响应）。
2. 禁止把明文密钥写入 URL / 查询串 / `localStorage` / `sessionStorage` / 持久化 store / 埋点 / 前端日志。
3. 禁止把 `sk-` 前缀之外的密钥主体完整展示在表格单元格内；禁止绕过 Popover 直接铺开。
4. 禁止未经二次验证直接调明文端点；禁止复用已消费的 proof（服务端按一次性消费，`SECURITY_PROOF_CONSUMED`）。
5. 禁止在界面暴露数据库裸数字用户 id；禁止把展示编号当接口参数。
6. 禁止绕过 `@/lib/format` / `@/lib/currency` 手写 `toFixed` 拼装额度、余额、用量展示值。
7. 禁止数字 / 金额列不使用 `tabular-nums`；禁止用颜色单独表达额度进度而缺文本数值。
8. 禁止把「无限额」「无额度」「额度为 0」合并为同一展示。
9. 禁止在删除 / 撤销 / 额度调整 / 账户注销中省略名称、数量与影响说明，或省略二次确认。
10. 禁止在禁用 / 过期 / 无权限等状态下仍显示可操作但无反馈的按钮。
11. 禁止用空态组件渲染请求失败；禁止在加载中丢失列结构或可访问名称。
12. 禁止把内部数值 Token、裸色值、任意字号写进用户组件（沿用 `UDS5-S01` §12 与 T1–T17 门禁）。
13. 禁止修改认证、授权、密钥生成、计费与数据库契约来「适配」本规范。
14. 禁止声称本分册相关的任何测试、门禁或平台验收已通过。

---

## 9. 差异与例外登记

| 编号 | 内容 | 状态 |
|---|---|---|
| S30-D01 | 蓝图「创建成功时如业务允许，仅在一次性安全窗口展示完整密钥」与仓库真值不同：现行 `AddToken` 响应**不含明文**，明文一律经二次验证的 `POST /api/token/:id/key` 按需取回。处置：**以仓库为准**——本规范改为「默认只给掩码 + 按需取回 + 关闭后不可再显示」，并保留蓝图「不重复展示、不写入 URL/日志/分析事件」的约束。蓝图版本「一次性创建窗口」在本仓库无对应实现。 | 已登记 / 仓库为准 |
| S30-D02 | 蓝图「关闭或离开后不得再次显示明文」在仓库中的机制是「**首次**取回需重新二次验证」，而非「每次 reveal 都需新 proof」——同一 provider 生命周期内命中 `resolvedKeys` 缓存时不再触发验证（详见 S30-D11）。本规范按仓库真值描述缓存边界（不落持久化、provider 卸载即失效），并把「关闭即失效」列为待收敛项，不沿用蓝图的字面表述。 | 已登记 / 仓库为准 |
| S30-D03 | 蓝图「额度必须标注重置时间」与仓库真值冲突：API Key 额度在模型与接口层均无重置字段，界面说明明确「不是初始分配也不是周期预算」；仅组织子额度存在「月度」口径（`sub_quota_limit` / `month_consumed`，文案 `Resets monthly`）。处置：**以仓库为准**，本分册只要求在可查看详情处说明口径，不虚构重置时间字段。 | 已登记 / 仓库为准 |
| S30-D04 | 蓝图「姓名 / 邮箱 / 用户 ID 的优先级由业务规则确定」在仓库已固化为 `display_name → username → formatUserId`，且存在展示编号 `U100000001` 这一层「内部 id 的对外包装」。本分册采用仓库优先级并补齐「展示编号不得回传为接口参数」的约束。 | 已登记 / 仓库为准 |
| S30-D05 | 蓝图未区分 API Key 与控制台访问令牌两类凭据；仓库中二者边界不同（API Key 48 位主体 + `sk-` 前缀 + 可按需取回；访问令牌 `nap_` 前缀 + 43 位后缀 + 库内只存哈希 + 尾号 + 创建时一次性返回）。本分册分别定义（§5 与 U-7.5），不合并为同一套规则。 | 已登记 / 仓库为准 |
| S30-D06 | 3.0 §1.14 记「`AvatarFallback` 12px」，现行 `web/src/components/ui/avatar.tsx` 为 `text-sm`（14px）/ `sm` 档 `text-xs`（12px）。两者均 ≥ 12px 下限，不判违规；本分册只约束「不新增 < 12px 档」。 | 已登记 / 合规 |
| S30-D07 | 本分册文档 ID `UDS5-S30` **已登记入** `docs/design-system/uter-design-system-5.0/DESIGN-STANDARD-REGISTRY.yaml`（`category: business-vertical`，`status: ACTIVE`，`dependencies` 含 S01 / S03 / S11 / S13 / S14 / S15 / S17 / S18 / S19 / S20 / S22）。**已执行** `bun run design:5:check`（`web/scripts/check-design-system-5.0.mjs`，默认模式、不带 `--generate` / `--strict`），2026-11-14 复跑结果 `verdict: PASS` / `errors: 0` / `standards: 37` / `registeredDocIds: 37` / `scannedMarkdown: 35`——「文档 ID 反向登记」检查已通过。**该结论仅覆盖注册表与文档 ID 的结构一致性**，不构成用户组件域功能 / 视觉 / 门禁 / 平台验收；`gaps: 74` 为组件级证据缺口，与本文无关。（只读性已核实：该脚本的 `writeFileSync` 仅存在于 `--generate` 分支，默认模式不写任何文件） | 已闭合（2026-11-14 只读实测 `errors: 0`；结构层 `PARTIALLY_VERIFIED`） |
| S30-D08 | 额度百分比告警阈值（10% / 30%）与告警色（destructive / warning / success）是现行 `ApiKeyQuotaCell` 的实现口径；蓝图未给出数值。本分册按仓库真值登记，不另立阈值。 | 已登记 / 仓库为准 |
| S30-D09 | E24 两处对比度缺陷（浅色溢价 3.76:1、深色折扣 3.30:1）属 `UDS5-S13` P1 待修，未闭合；用户状态标签若落到该两处，不得据本分册勾选通过。 | 继承 P1 待修 |
| S30-D10 | 用户相关页面的视觉基线覆盖**不完整**：`web/e2e/visual/lib/pages.ts` 的 `AUTHENTICATED_ROUTES` 含 `/keys`、`/profile`、`/usage-logs`，对应基线 PNG 已存在（各 2 张：desktop + mobile）；但 **`/security`（安全设置）与 `/users`（用户管理）不在鉴权路由清单内**，无任何视觉基线；`usage-logs/audit` 子路由亦未覆盖。处置：**以仓库真值为准**，本分册不宣称这些页面已有视觉一致性证据；`/security` 与 `/users` 明确登记为覆盖缺口（`NOT_VERIFIED`），其余三页的基线仅说明「存在可比对快照」，不构成本分册规则的通过证据。 | 部分覆盖（`/security`、`/users` 为缺口） |
| S30-D11 | 蓝图「关闭或离开后不得再次显示明文」与仓库现行实现有差距：`web/src/features/keys/components/api-keys-provider.tsx` 的 `resolvedKeys` 在**同一 provider 生命周期内**缓存明文，关闭 Popover 后再次打开会直接复用缓存（不重新走二次验证）。缓存不落 `localStorage` / `sessionStorage` / 持久化 store，provider 卸载即失效。**分级判定（2026-11-14 team-lead 复核）**：缓存**边界**（不跨页面 / 跨会话 / 不持久化）符合 `RISK-P0` 的「明文不落持久化」要求，故**不构成 `RISK-P0` 合规缺口**，仅是「关闭即失效」体验目标未达。处置：**以仓库为准并登记为待收敛**——收敛到「关闭即失效」需另行改码，本轮不改代码。 | 未实现（待收敛，**非 `RISK-P0` 合规缺口**） |
| S30-D12 | 密钥表格的复制按钮未复用 `CopyButton`：`web/src/features/keys/components/api-keys-cells.tsx` 用裸 `Button` + `Tooltip` 手写图标切换（`aria-label` 随 `Copy` / `Loading...` / `Copied!` 同步），复制走 `@/lib/copy-to-clipboard` 的 `copyToClipboard`；而 `web/src/components/copy-button.tsx` 的 `CopyButton` 已封装 `aria-label` → `Copied` 切换与成功 / 失败提示，且已被 `web/src/features/keys/components/api-keys-primary-buttons.tsx`、安全设置多个弹窗复用。另一处差距：`handleCopy` 对 `copyToClipboard` 返回 `false` 无失败提示（仅 `ok` 为真时切换图标）。处置：**以仓库为准**——本分册把「弹层 / 对话框内优先复用 `CopyButton`」定为目标口径，表格单元格的手写实现与失败提示缺失登记为待收敛项，本轮不改代码。 | 未实现（待收敛） |
| S30-D13 | **管理员额度调整缺强验证（真实代码缺陷）**：`controller/user.go:1367` 的 `delete` 分支挂 `requireAdminUserProof(c, service.VerificationScopeAdminUserDelete, ...)`（`controller/secure_verification.go:149`），而同函数 `add_quota` 分支（`controller/user.go:1336-1338` → `controller/user_quota.go:13` `manageUserQuota`）**未挂任何 `requireAdminUserProof`**，也未见 `CriticalRateLimit`。按 `UDS5-S01` §4A.2，管理员调整他人额度属「余额变更」= `RISK-P0`，仓库实现未达该级（与 `S01-D6` 为同一发现的两个视角）。该端点**有**审计记录（`model.RecordOperationAuditLog`，动作 `user.quota_add` / `user.quota_subtract` / `user.quota_override`），故**审计维度满足 `RISK-P1`，缺的是强验证维度**。修复须挂强验证 + 临界限流并走 `UDS5-S01` §19 变更流程；本轮**不改代码** | **真实代码缺陷**（待修） |
| S30-D14 | **掩码位数口径已核实（2026-11-14 独立复核后确认原文无误）**：`MaskTokenKey`（`model/token.go:64-75`）在 `len>8` 时返回 `key[:4] + "**********" + key[len-4:]` = **4 + 10 + 4 = 18 位**；加 `sk-` 前缀（`features/keys/components/api-keys-cells.tsx:58` `const maskedKey = \`sk-${apiKey.key}\``）共 **21 个等宽字符**；密钥列宽实测 `size: 208`（`api-keys-columns.tsx:155`）。**本分册 U-5.11 的「18 位掩码 + `sk-` = 21 字符 / 列宽下限 208px」表述与代码一致，不构成缺陷**；若后续有人主张「掩码是 11 位」，该主张**不成立**，不得据此改文档 | 已核实（**非缺陷**） |
| S30-D15 | **`MaskedValueTrigger` 实际渲染 12px 而非 13px，且静默丢失 muted 文字色（真实代码缺陷；2026-11-14 由 `general-purpose-5` 复核发现、本分册独立实测复现）**：**① 字号错档** —— `MaskedValueTrigger`（`web/src/components/masked-value-display.tsx:30-42`）以 `<Button size='sm'>` 渲染并叠加类名 `font-mono text-mono`，但 `Button` 的 `sm` 档自带 `text-xs`（`web/src/components/ui/button.tsx:69`：`h-(--ds-button-height-sm) … text-xs`），而**自定义 `text-mono` 不被 tailwind-merge 识别为字号类**——实测 `twMerge('text-xs text-mono')` 返回 `'text-xs text-mono'`（两者**并存**，未合并），最终由 **CSS 源码顺序**决定：生产构建产物 `web/dist/static/css/`（本地构建输出，目录已被 `.gitignore` 忽略、文件名含内容哈希，**仅作本次层叠顺序的实测依据，不作为长期可引用路径**）实测 `.text-mono` 位于偏移 107303、`.text-xs` 位于偏移 108148（**更靠后**），二者同在 `@layer utilities` 同层同特异性，故 **`text-xs`（12px）胜出**，`--text-mono`（13px）被静默覆盖。**② 颜色丢失（同一根因的第二个副作用）** —— `text-mono` 因不在 tailwind-merge 的字号表内，被归入**颜色组**，故会把同组且在前的 `text-muted-foreground` **一并挤掉**：实测 `twMerge('text-muted-foreground text-mono')` 返回 `'text-mono'`；而生产 CSS 中 `.text-mono{font-size:var(--text-mono);line-height:…}` **只声明字号、不声明颜色**，故该元素最终**无任何文字色工具类**，静态态回落继承 `body` 的 `var(--foreground)`（`#0f172a`）而非 muted 的 `#64748b`。**处置**：对照 `web/src/components/ui/input.tsx:65-69` 的既有正确做法（`useMono ? 'font-mono text-long' : 'text-long'`，把**字号档**与**字形族**拆开指定，且只用 tailwind-merge 认可的字号类），`MaskedValueTrigger` 应改为把字号档与 `font-mono` 分离、并显式保留颜色类，而不是依赖 `text-mono` 与 `text-xs` 竞序。**本分册 U-5.10 / U-5.11 已按此实测口径改写**（U-5.11 的列宽推导同时给出 14px / 13px / 实际 12px 三档估算，结论 208px 下限不变）。修复须改 `web/src/components/masked-value-display.tsx` 并走 `UDS5-S01` §19 变更流程；本轮**不改代码** | **真实代码缺陷**（待修） |

---

## 与其他规范的关系

| 规范 | 关系 | 边界 |
|---|---|---|
| `UDS5-S01`（总纲） | 效力来源 | 不重述总则；冲突以总纲为准 |
| `UDS5-S02`（Foundation） | 提供 12px 最小字号、正文 14/22、caption 12/18、间距与描边 Token | 本分册只消费，不定义 |
| `UDS5-S03`（Color） | 提供语义色 Token（`--ds-color-text-success` / `-warning` / `-danger` / `-info`、`*-soft` / `*-soft-foreground`）与 E24 对比度待修口径 | 额度告警色、角色 / 状态徽标色只经语义 Token 引用，不定义色值 |
| `UDS5-S11`（Layout） | 提供内容区宽度（后台 1280px / 营销 1800px）、App Shell 骨架与页面落点；其 §8 已含「用户管理 / API Key / 消费记录」三模块的布局约束 | 用户表格列宽、抽屉 / 弹层布局按其内容容器与模块落点规则落地 |
| `UDS5-S13`（无障碍） | 提供焦点环 2px、命中区 24/44px、对比度 4.5:1、E24 待修 | 本分册的可访问名称与 `aria-label` 约束须与其一致 |
| `UDS5-S14`（组件） | 提供 `Avatar` / `Badge` / `Dialog` / `AlertDialog` / `Form` / `Table` 的八态与组件清单 | 本分册只给用户域用法，不新增组件 |
| `UDS5-S15`（组件 API） | 提供 `cva()` 扩展路径、props 命名、`props.xxx` 直接访问 | 本分册不改组件 API |
| `UDS5-S17`（交互） | 提供五态矩阵、Confirm 交互、焦点环、T14 hover Token | 本分册的 reveal / 撤销 / 确认交互复用其契约 |
| `UDS5-S18`（表单与验证） | 提供字段验证、错误优先级、防重复提交、未保存提醒 | 密码 / 2FA / 额度表单细节在 S18 |
| `UDS5-S19`（数据展示） | 提供数值 / 货币 / 时间格式、`toIntlLocale()` 红线、DataTable 11 项能力 | 本分册的额度与用量口径引用其格式规则 |
| `UDS5-S20`（通知） | 提供五类反馈与提示归属（拦截器不弹 Toast） | 本分册的成功 / 失败提示走 S20 映射 |
| `UDS5-S22`（业务适配） | 提供业务红线 R1–R3 与模块适配表 | 本分册**不得与之矛盾**：只改视觉 / 组件复用 / 交互表现，资金与认证逻辑零改动 |
| `UDS5-S31`（组织与账单） | **分界规范** | 组织结构、`org_role`、组织钱包与组织成员配额归 S31；本分册只覆盖个人域 API Key、身份展示与用量呈现，组织子额度仅在本人资料页作为口径引用（U-6.9） |
| `UDS5-S32`（触达与本地化） | **分界规范** | S32 负责 i18n / locale 实施层（键覆盖门禁、同步脚本、后端 yaml、邮件与短信）；本分册只约束**用户组件域的文案使用方式**（用户可见文案走 `t()`、`toIntlLocale()` 转换、金额与计数格式），不定义 locale 资源与触达通道 |
| `web/AGENTS.md` | **强制上位约束**：§3.1 数字格式化与 Intl 语言参数、§3.3 组件复用、§3.9 错误处理、§3.12 可访问性、§3.13 安全、§3.14 测试 | 冲突时以 `web/AGENTS.md` 为准 |

> 上表覆盖注册表 `UDS5-S30` 条目 `dependencies` 列出的全部规范（S01 / S03 / S11 / S13 / S14 / S15 / S17 / S18 / S19 / S20 / S22），并额外补充 `UDS5-S02`（字号与间距下限来源）、`UDS5-S31`（与组织域的分界）与 `UDS5-S32`（与触达 / 本地化实施层的分界）。注册表 `dependencies` 只要求所列 ID 已存在、不校验与本文的一致性，故此处以本文为准并显式说明增减项。

---

## 代码实施位置

| 用途 | 真实路径 | 本轮动作 |
|---|---|---|
| 掩码算法真源 | `model/token.go`（`MaskTokenKey`、`GetMaskedKey`、`GetFullKey`） | **只读** |
| 密钥响应构造 | `controller/token.go`（`buildMaskedTokenResponse`、`buildMaskedTokenResponses`、`AddToken`、`GetTokenKey`、`GetTokenKeysBatch`） | **只读** |
| 密钥路由与中间件 | `router/api-router.go`（`/api/token` 组）、`middleware/secure_verification.go`、`middleware/audit.go`、`middleware/disable-cache.go` | **只读** |
| 访问令牌 | `controller/access_token.go`、`model/user_access_token.go`、`model/audit_log.go` | **只读** |
| 密钥前端 | `web/src/features/keys/`（`web/src/features/keys/api.ts`、`web/src/features/keys/types.ts`、`web/src/features/keys/constants.ts`、`web/src/features/keys/components/api-keys-provider.tsx`、`web/src/features/keys/components/api-keys-cells.tsx`、`web/src/features/keys/components/api-keys-columns.tsx`、`web/src/features/keys/components/api-key-quota-cell.tsx`、`web/src/features/keys/components/api-keys-delete-dialog.tsx`、`web/src/features/keys/components/api-keys-multi-delete-dialog.tsx`） | **只读** |
| 用户管理 | `web/src/features/users/`（`web/src/features/users/components/users-columns.tsx`、`web/src/features/users/components/user-quota-cell.tsx`、`web/src/features/users/components/user-quota-dialog.tsx`、`web/src/features/users/components/users-delete-dialog.tsx`、`web/src/features/users/types.ts`） | **只读** |
| 个人资料 | `web/src/features/profile/`（`web/src/features/profile/components/profile-header.tsx`、`web/src/features/profile/components/profile-settings-card.tsx`、`web/src/features/profile/lib/format.ts`、`web/src/features/profile/hooks/use-profile.ts`、`web/src/features/profile/types.ts`） | **只读** |
| 安全设置 | `web/src/features/security/`（`web/src/features/security/index.tsx`、`web/src/features/security/components/login-sessions-card.tsx`、`web/src/features/security/components/login-session-item.tsx`、`web/src/features/security/components/login-session-dialogs.tsx`、`web/src/features/security/components/two-fa-card.tsx`、`web/src/features/security/components/passkey-card.tsx`、`web/src/features/security/components/privacy-card.tsx`、`web/src/features/security/components/access-tokens-card.tsx`、`web/src/features/security/components/dialogs/`、`web/src/features/security/lib/access-token-catalog.ts`） | **只读** |
| 用量展示 | `web/src/features/usage-logs/`（`web/src/features/usage-logs/components/log-cost-display.tsx`、`web/src/features/usage-logs/components/columns/common-logs-columns.tsx`、`web/src/features/usage-logs/components/common-logs-stats.tsx`） | **只读** |
| 基础组件 | `web/src/components/ui/avatar.tsx`、`web/src/components/ui/badge.tsx`、`web/src/components/ui/table.tsx`、`web/src/components/ui/dialog.tsx`、`web/src/components/ui/alert-dialog.tsx`、`web/src/components/ui/form.tsx`、`web/src/components/ui/progress.tsx`、`web/src/components/ui/secret-input.tsx`；`web/src/components/status-badge.tsx`、`web/src/components/masked-value-display.tsx`、`web/src/components/confirm-dialog.tsx`、`web/src/components/copy-button.tsx`、`web/src/components/quota-details-popover.tsx`、`web/src/components/table-id.tsx`、`web/src/components/long-text.tsx` | **只读** |
| 格式化与语言 | `web/src/lib/format.ts`、`web/src/lib/currency.ts`、`web/src/lib/avatar.ts`、`web/src/i18n/languages.ts`、`web/src/i18n/static-keys.ts` | **只读** |
| i18n 资源 | `web/src/i18n/locales/{en,fr,ja,ru,vi,zh-TW,zh}.json` | **只读** |
| 门禁脚本 | `web/scripts/check-design-tokens.mjs`、`web/scripts/check-i18n-keys.mjs`、`web/scripts/check-component-registry.mjs`、`web/scripts/verify-contrast.mjs`、`web/scripts/check-design-system-5.0.mjs` | **只读** |
| 规范输出 | `docs/design-system/uter-design-system-5.0/USER-COMPONENT-STANDARD.md` | **本文件（新建）** |

> 未列出的脚本、路径、测试结果不虚构为已存在；本轮不改任何代码、不新增依赖、不执行 git 操作。

---

## 自动化验证

| 验证项 | 真实命令 / 门禁 | 本规范状态 |
|---|---|---|
| 最小字号（T16） | `bun run lint:design:strict`（`web/scripts/check-design-tokens.mjs --strict`） | `NOT_EXECUTED` |
| i18n 键覆盖 | `bun run lint` / `bun run i18n:check`（`web/scripts/check-i18n-keys.mjs`） | `NOT_EXECUTED` |
| Intl 语言参数 lint | `bun run lint`（`project/intl-locale` 为 error） | `NOT_EXECUTED` |
| 类型检查 | `bun run typecheck` | `NOT_EXECUTED` |
| 单元测试 | `bun run test`（Vitest） | `NOT_EXECUTED` |
| 对比度 | `bun run verify:contrast` | `NOT_EXECUTED`（E24 未闭合） |
| 组件注册表 | `bun run components:registry:strict` | `NOT_EXECUTED`（基线 `EXIT=1`） |
| 规范一致性 | `bun run design:5:check`（`web/scripts/check-design-system-5.0.mjs`，默认模式） | **2026-11-14 已执行（只读）：`verdict: PASS` / `errors: 0` / `registeredDocIds: 37`**（`UDS5-S30` 已登记，见 S30-D07；仅注册表结构层） |
| 视觉回归 | `bun run test:visual` / `test:visual:e2e` | `NOT_EXECUTED`（`/security` 与 `/users` 无基线，见 S30-D10） |
| 可访问性 | `bun run test:axe` | `NOT_EXECUTED` |
| 业务 E2E | `bun run test:business:e2e` | `NOT_EXECUTED` |
| 全量构建 | `bun run build:check` | `NOT_EXECUTED` |

---

## 验证状态

| 项 | 状态 | 说明 |
|---|---|---|
| 本规范文本 | `ACTIVE` | 已撰写，供评审 |
| U-1 – U-9 原则落地 | `NOT_VERIFIED` | 规范层定义，未跑门禁或测试 |
| 掩码算法与明文边界一致性 | `NOT_VERIFIED` | 已只读核实 `model/token.go` / `controller/token.go` / `middleware/secure_verification.go`；未做运行时验证 |
| 额度与用量格式口径 | `NOT_VERIFIED` | 已只读核实 `web/src/features/keys/components/api-key-quota-cell.tsx` / `web/src/features/users/components/user-quota-cell.tsx` / `web/src/features/usage-logs/components/log-cost-display.tsx` / `web/src/lib/format.ts`；未跑 `project/intl-locale` 与单测 |
| 身份展示优先级与展示编号 | `NOT_VERIFIED` | 已只读核实 `web/src/features/profile/lib/format.ts` / `web/src/lib/format.ts` / `web/src/lib/avatar.ts`；未做跨页一致性复核 |
| 安全设置二次确认与验证链 | `NOT_VERIFIED` | 已只读核实 `web/src/features/security/` 与 `web/src/features/users/components/users-delete-dialog.tsx`；未跑测试 |
| 65 个组件证据 | `NOT_VERIFIED` | `VERIFIED 0 / PARTIAL 9 / NOT_VERIFIED 56`，`components:registry:strict EXIT=1` |
| 用户相关页面视觉基线 | `NOT_VERIFIED` | `/keys` / `/profile` / `/usage-logs` 有基线 PNG（各 2 张），但基线存在不等于本分册规则已验证；`/security`、`/users` 无基线（S30-D10） |
| E24 对比度缺陷 | `NOT_VERIFIED` | 3.76:1 / 3.30:1 待修，P1，不得勾选通过 |
| `S30-D13` 管理员额度调整补强验证 | `NOT_STARTED` | 属代码改动，本轮不执行。真实代码缺陷：`controller/user.go` 的 `add_quota` 分支未挂 `requireAdminUserProof` / `CriticalRateLimit`（`delete` 分支已挂）。修复须走 `UDS5-S01` §19 变更流程 |
| `S30-D15` `MaskedValueTrigger` 字号与颜色双错 | `NOT_STARTED` | 属代码改动，本轮不执行。真实代码缺陷：`MaskedValueTrigger` 以 `<Button size='sm'>` 渲染，Button sm 档自带 `text-xs`（12px），与自定义 `text-mono`（13px）在构建产物中同层共存、由源码顺序决定 `text-xs` 胜出，`--text-mono` 被静默覆盖；**同一根因的第二个副作用**是 `text-mono` 被 tailwind-merge 归入颜色组、挤掉 `text-muted-foreground`，而 `.text-mono` 只声明字号不声明颜色，故静态态文字色回落继承 `var(--foreground)` 而非 muted。修复须拆开字号档与 `font-mono` 字形族（参照 `web/src/components/ui/input.tsx:65-69`）并重建验证 |
| 规范注册表登记 | `PARTIALLY_VERIFIED`（2026-11-14 只读实测） | `bun run design:5:check` → `verdict: PASS` / `errors: 0` / `registeredDocIds: 37`（S30-D07 已闭合）；**仅**注册一致性一项达 `PARTIALLY_VERIFIED`（脚本原始输出为字面 `verdict: PASS`，此处不将其转写为业务验收结论），本文其余验证项仍为 `NOT_VERIFIED` / `NOT_EXECUTED`，按 `UDS5-S01` §15 词表不得表述为 `PASS` |
| 全量构建 / 视觉回归 / E2E | `NOT_EXECUTED` | 本轮除 `design:5:check`（只读、仅注册表结构层，见 S30-D07）外未执行任何构建 / 测试 / 门禁命令 |
| Android / iOS / HarmonyOS | `NOT_VERIFIED` | 无真实实现（`docs/design-system/uter-design-system-5.0/audit/BASELINE-AUDIT.md` §8） |

> **最终状态低于 `FULLY_IMPLEMENTED_AND_VERIFIED`**：本规范为 Uter 自有定义（蓝图仅作规则来源参考，未照抄其数值），不宣称任何用户组件行为已通过验证。**用户组件域相关的全部验证项均为 `NOT_VERIFIED` / `NOT_EXECUTED`，未勾选任何测试通过或平台验收**；唯一例外是上表末段标注的 `design:5:check` 注册表结构一致性检查（只读、仅结构层面），它**不替代**任何用户组件功能、视觉或平台验收结论。
