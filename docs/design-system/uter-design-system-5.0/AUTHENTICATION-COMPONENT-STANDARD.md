# 认证组件规范（Authentication Component Standard）

> UTER Design System 5.0 · 分册 S29。本规范定义「认证相关界面从字段到状态到安全边界的完整约束」。**核心口径：认证域严格限视觉**——Uter 自建认证（Go 后端 + Casbin + `(auth)/` 9 路由）零改动，5.0 只统一视觉密度、信息架构、状态完整性与字段级错误表达；**不引入 Clerk SDK**（`UDS5-S21` §3 禁止项 P2），仅借鉴其分步流程与字段级错误的信息架构理念。**5.0 为当前唯一正式体系，3.0 保留为历史**，本文引用 3.0 §x 仅用于溯源。除标明已核实的真源代码位置外，未宣称任何测试通过或平台验收。

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S29` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01`（UTER Design System 5.0 总纲） |
| 生效日期 | `2026-11-14` |
| 适用范围 | `web/src/routes/(auth)/` 9 个路由、`web/src/features/auth/` 全部 feature（登录 / 注册 / 邮箱验证码 / 忘记密码 / 密码重置确认 / OTP 安全验证 / step-up / WebAuthn Passkey / OAuth 回调）、`web/src/components/ui/` 中的认证域字段组件（`form.tsx` / `field.tsx` / `form-label-tier.tsx` / `input-otp.tsx` / `secret-input.tsx` / `input.tsx`）；**不含**后端认证逻辑、数据库结构、授权判定与资金逻辑 |
| 验证状态 | `NOT_VERIFIED` |

---

## 1. 总则

| # | 原则 | 说明 |
|---|---|---|
| A-1 | **只改视觉，不改认证语义** | 认证是业务红线（R2）。字段集合、验证码位数与用途、登录方式、限流档位、账号状态判定、API 契约一律不动；5.0 只调布局、间距、字号、状态表达与错误呈现方式 |
| A-2 | **不引入 Clerk SDK** | Uter **不集成 Clerk SDK**（`ClerkProvider` / `@clerk/ui` / `@clerk/elements` / `@clerk/localizations` 一律不引入）；认证 / 用户 / 组织业务逻辑零改动（`UDS5-S21` §3 P3）。**2026-11-15 裁决**：clerk.com 是 5.0 规范值的上游权威（`UDS5-S01` §4.2 `G1`），本分册只借鉴分步流程、字段级错误与状态完整性三项信息架构理念；Clerk 仍**不是运行时组件、不是依赖、不是验收基准**（`UDS5-S21` §3 P2 / §4.5） |
| A-3 | **服务端为状态唯一权威** | 账号是否存在、验证码是否有效、是否限流、是否锁定、是否需要二次验证，全部由服务端判定。前端不得据本地状态推断安全结论 |
| A-4 | **不泄露账户存在性** | 「该邮箱/账号不存在」与「凭据错误」必须返回同一文案、同一视觉、同一错误层级；禁止用差异化文案做账户枚举 |
| A-5 | **字段级错误就近展示** | 认证表单的校验与服务端错误一律落到具体字段下方（`form.setError` → `FormMessage`），不堆在页首（`UDS5-S18` §4.1） |
| A-6 | **防重复提交 + 防重复发信** | 提交中按钮 `disabled + aria-busy`；验证码重发须有倒计时与服务端频次限制双保险 |
| A-7 | **不擅自增删字段或认证方式** | 登录方式（密码 / 邮箱验证码 / OAuth / Passkey）由服务端 `status` 与管理员开关决定；前端只渲染「真实启用的提供方」，不展示未配置的入口 |
| A-8 | **7 份 locale 同步** | 所有认证可见文案经 `t()` 输出，同步 `en / fr / ja / ru / vi / zh-TW / zh` 7 份语言包，并在 `web/src/i18n/static-keys.ts` 登记（`web/AGENTS.md` 3.1） |
| A-9 | **不在前端留存凭据** | 密码、完整验证码、会话密钥不得写入 `localStorage` / `sessionStorage` / 日志 / 埋点 / 错误信息（`web/AGENTS.md` 3.13） |

---

## 2. 事实基线（引自审计报告与参考分析，不得假设）

| 项 | 真实值 | 来源 |
|---|---|---|
| 认证路由 | `(auth)` 下 **9 个** `.tsx`：`route.tsx` / `sign-in.tsx` / `sign-up.tsx` / `register.tsx` / `forgot-password.tsx` / `reset.tsx` / `user/reset.tsx` / `otp.tsx` / `oauth.wechat-web.tsx` | `web/src/routes/(auth)/`（已 ls 核实 9 个文件） |
| **认证容器实际宽度** | **`sm:w-[480px]`**（`sm` 断点 640px 起）；移动端 `px-4`（左右 16px）、`py-8`；`sm:p-8`。外层 `relative grid h-svh max-w-none` | `web/src/features/auth/auth-layout.tsx:34,62`（已读原文核实） |
| 认证页标题层级 | 标题用 `Heading variant='page-title' level={1}`；品牌锁定区（logo + 站名）用 `span` + `text-lg font-semibold`，**明确不使用 `h1`**（页面标题由登录卡自身承担） | `web/src/features/auth/auth-layout.tsx:53-58`、`web/src/features/auth/sign-in/index.tsx:36-41` |
| 验证码位数与形态（**两套生成器，须区分**） | **①纯数字 6 位**：`common.GenerateNumericCode(6)`，`crypto/rand` + `math/big` 生成并**补前导零**（如 `000123`）——用于**登录邮箱验证码**与 **step-up 邮箱验证码**。**②十六进制 6 位**：`common.GenerateVerificationCode(6)`，UUID 去连字符后切片（**含 a–f 字母**）——用于**注册邮箱验证码**。密码重置链接 token 为 `GenerateVerificationCode(0)`（完整 32 位 hex，**不是 6 位码**） | `common/verification.go:44-76`、`controller/misc.go:256,290,363`、`service/security_verification.go:730` |
| 注册验证码输入未做字符过滤 | 注册流程的验证码输入为**普通 `Input`，无 `maxLength`、无 `inputMode='numeric'`、无非数字过滤**，与十六进制码形态一致；登录流程则 `maxLength={6}` + `inputMode='numeric'` + `replaceAll(/\D/g,'')` | `web/src/features/auth/sign-up/components/sign-up-form.tsx:307-311`、`web/src/features/auth/sign-in/components/user-auth-form.tsx:508-517` |
| 验证码有效期 | **10 分钟**（`common.VerificationValidMinutes = 10`），过期判定为 `now - issueTime >= 600s` | `common/verification.go:42,101` |
| 验证码单次使用 | 校验成功即 `delete(verificationMap, mapKey)`，同一码不可复用 | `common/verification.go:105` |
| 验证码常量时间比较 | `crypto/subtle.ConstantTimeCompare`，避免时序侧信道 | `common/verification.go:104` |
| 验证码失败作废 | 同一 key 失败达 **`maxVerificationAttempts = 5`** 即删除该码 | `common/verification.go:36,108-113` |
| 验证码用途隔离 | 4 个 purpose 互不相通：`"v"` 注册邮箱验证 / `"r"` 密码重置 / `"l"` 邮箱验证码登录 / `"s"` step-up 再验证（step-up 的 key 为 scope+context 的 HMAC 哈希，非邮箱） | `common/verification.go:21-37`、`controller/misc.go:368`、`service/security_verification.go:734` |
| **登录限流（429）位置** | **登录类端点走 `middleware.CriticalRateLimit()`**：默认 **20 次 / 20 分钟**，按客户端 IP 计数，标记 `CT`；`router/api-router.go:103,107,108,109,110,111,112,113` | `middleware/rate-limit.go:471-483`、`common/constants.go:264-266`、`common/init.go:162-164` |
| **发信限流（429）位置** | **发验证码走 `middleware.EmailVerificationRateLimit()`**：**30 秒内最多 2 次**（`EmailVerificationMaxRequests = 2`、`EmailVerificationDuration = 30`），按 IP；Redis 固定窗口 + 内存兜底两条实现 | `middleware/email-verification-rate-limit.go:11-15,17-65`、`router/api-router.go:57,106` |
| 429 响应形态 | `CriticalRateLimit` 路径：写 `Retry-After` 头 + 空体 429（`writeRateLimited`）；`EmailVerificationRateLimit` 路径：429 + JSON `{success:false,message}`，Redis 分支的 message 内嵌剩余秒数 | `middleware/rate-limit.go:191-202`、`middleware/email-verification-rate-limit.go:38,46` |
| 登录成功退限流配额 | 登录成功调用 `RefundIPRateLimit` 退回本次计数；失败尝试照常计数 | `middleware/rate-limit.go:167-188`、`controller/user.go` 登录成功路径 |
| 邮箱验证码登录语义 | **登录即注册**：未注册邮箱同样发码（验证码本身即邮箱所有权证明），验证通过后 `provisionEmailCodeUser` 自动建号；已注册但被禁用账号**静默不发**（响应仍 `success:true`） | `controller/misc.go:328-385`、`controller/user.go:118-161` |
| 登录失败统一文案 | `Username or password is incorrect, or user has been banned`（密码登录与验证码登录共用），不区分「不存在」与「密码错」 | `controller/user.go:73,94,155` |
| 功能开关 | `PasswordLoginEnabled=true`、`PasswordRegisterEnabled=true`、`RegisterEnabled=true`、`EmailCodeLoginEnabled=false`、`EmailVerificationEnabled=false`、`TurnstileCheckEnabled=false`（均为**默认关闭/开启态**，管理员可改） | `common/constants.go:82-91` |
| 登录二次验证 | 密码登录后可要求 2FA / Passkey；挑战令牌 `LoginVerificationTTL = 5 分钟`（`service/login_verification.go:11`）；Passkey 流程 TTL 亦为 5 分钟（`service/passkey/session.go:14`） | `controller/login_verification.go:17,42,76-113`、`service/login_verification.go:11,80-88` |
| 2FA 锁定 | 因子级 `locked_until` 生效时返回 `ErrVerificationLocked`（Two-factor authentication is temporarily locked），Passkey 可作为替代路径 | `service/security_verification.go:63-69,366`、`model/account_security.go` |
| Turnstile 人机校验 | `middleware.TurnstileCheck()` 挂在登录 / 发码 / 注册 / 重置密码端点；前端 `useTurnstile` 依据 `status.turnstile_check` + `turnstile_site_key` 决定是否渲染 | `router/api-router.go:57,58,101,103,106,107`、`middleware/turnstile-check.go`、`web/src/features/auth/hooks/use-turnstile.ts:28-57` |
| 第三方登录入口 | `oauth-providers.tsx` 按 `status.wechat_web_login / github_oauth / discord_oauth / oidc_enabled / linuxdo_oauth / telegram_oauth / custom_oauth_providers` 逐个 push；**数组为空时 `return null`，不渲染任何入口** | `web/src/features/auth/components/oauth-providers.tsx:81-152` |
| 认证表单技术栈 | `react-hook-form` + `zod`（`@hookform/resolvers/zod`）；schema 定义在 `web/src/features/auth/constants.ts`：`loginFormSchema` / `registerFormSchema` / `forgotPasswordFormSchema` | `web/src/features/auth/constants.ts:30-66`、`web/src/features/auth/sign-in/components/user-auth-form.tsx:249-250` |
| 密码策略 | 长度 **8–128**（`ACCOUNT_PASSWORD_MIN_LENGTH = 8`、`ACCOUNT_PASSWORD_MAX_LENGTH = 128`）；另含字符多样性、常见弱口令、包含账号标识等规则 | `web/src/lib/password-policy.ts:31-49`、`web/src/features/auth/constants.ts:35-60` |
| 密码字段实现 | 登录 / 注册 / 重置密码确认使用 `web/src/components/password-input.tsx`（`Eye` / `EyeOff` 显隐切换），非 `ui/secret-input.tsx`（后者面向 API Key 遮罩） | `web/src/features/auth/sign-in/components/user-auth-form.tsx:28,434`、`web/src/components/password-input.tsx:51-70` |
| 验证码输入实现 | **登录 / step-up 的纯数字 6 位验证码使用普通 `Input`**（`maxLength={6}` + `inputMode='numeric'` + `autoComplete='one-time-code'`），**注册用 hex 6 位验证码使用普通 `Input` 且无 `maxLength` / 无数字过滤**；两者**均未使用** `ui/input-otp.tsx` 的分段 OTP 组件。该组件已登记于组件注册表但全仓无业务引用 | `web/src/features/auth/sign-in/components/user-auth-form.tsx:508-517`、`web/src/features/auth/secure-verification/components/secure-verification-dialog.tsx:112-119`、`web/src/features/auth/sign-up/components/sign-up-form.tsx:307-311`、`web/src/components/ui/input-otp.tsx`、`web/src/design-system/component-registry.json:1008` |
| 重发倒计时 | 前端：邮箱验证 `EMAIL_VERIFICATION_COUNTDOWN = 30` 秒、密码重置 `PASSWORD_RESET_COUNTDOWN = 30` 秒（`web/src/features/auth/constants.ts:78-79`）；**登录验证码重发倒计时为 60 秒**（`setCodeResendSeconds(60)`，本地 state，与前两个常量不同源） | `web/src/features/auth/constants.ts:78-79`、`web/src/features/auth/hooks/use-email-verification.ts:45`、`web/src/features/auth/forgot-password/components/forgot-password-form.tsx:68`、`web/src/features/auth/sign-in/components/user-auth-form.tsx:93,196` |
| 输入框字号 | `ui/input.tsx` 统一 `text-long`（16px），满足 H5 输入 ≥16px 防 iOS 缩放 | `web/src/components/ui/input.tsx:64-69` |
| 焦点环 | **2px**（`ring-2`，已裁决）；`ui/input.tsx` 用 `focus-visible:ring-2` | `web/src/design-system/tokens/semantic.css:120-123`、`web/src/components/ui/input.tsx:64` |
| 错误呈现 | `handleServerError(error, fallbackMessage?)` + `AuthOperationError.from(...)`；`AuthOperationError` 带安全消息，不解开被屏蔽细节 | `web/src/lib/handle-server-error.ts:35`、`web/src/lib/secure-verification.ts:27-57` |
| 守卫测试 | `web/src/design-system/__tests__/` 下 **11 个** `*.test.ts`（含 `accessibility.test.ts`、`design-system-5-governance.test.ts`） | 已 ls 核实（`S13` §4.1 记为 10 个，差异见 §9 S29-D07） |
| i18n | 7 份 locale（`en / fr / ja / ru / vi / zh-TW / zh`），合计 **54,573 行**；键登记于 `web/src/i18n/static-keys.ts`；门禁 `web/scripts/check-i18n-keys.mjs`（`bun run i18n:check`） | `web/src/i18n/locales/*.json`（已 wc 核实）、`web/src/i18n/static-keys.ts`、`web/scripts/check-i18n-keys.mjs` |
| Clerk 依赖现状 | `web/package.json` **无任何 Clerk 依赖**；`web/src` 中仅 `features/about/about-viewer.tsx`、`features/docs/native/*` 的注释以 Clerk 文档站作类比 | `web/package.json`、`web/src/features/about/about-viewer.tsx:330` |
| 短信能力 | **无独立短信网关**。全仓 `.go` / `.ts` / `.tsx` 中 `\bSMS\b` / `短信` / `SendSms` / `smsProvider` 零命中；`model/account_security.go` 仅描述管理员启用的登录方式快照，不含短信通道 | 已 grep 核实（全仓 0 命中）；`model/account_security.go:66-74` |

---

## 3. 范围与边界

| 类别 | 内容 |
|---|---|
| **在范围内（可改视觉）** | 认证页容器宽度与内边距、标题 / 说明 / 字段 / 主操作 / 辅助操作的顺序与间距、字段标签层级与错误位置、验证码输入形态与重发倒计时展示、第三方登录按钮的呈现与分隔、加载 / 禁用 / 错误 / 成功态的视觉表达、加载与错误三态的齐备 |
| **在范围内（只读引用）** | 后端限流档位、验证码生命周期与用途隔离、账号状态判定、登录挑战有效期、Turnstile 校验、密码策略、2FA / Passkey / step-up 流程。**只用于确定 UI 该展示什么状态、什么文案层级，不改判定逻辑** |
| **不在范围内（禁止触碰）** | 后端认证逻辑与 API 契约、`Casbin` 授权、`(auth)/` 路由结构与守卫、验证码存储与校验实现、限流档位数值、`model/` 数据库结构、`org_role` / `sub_quota_limit` / `EnforceOrgQuota` 等组织与配额逻辑 |
| **不在范围内（无实现，不得虚构）** | **短信验证 / 短信登录**：仓库无短信网关、无短信 provider 配置、无短信相关端点。规范保留位标 `NOT_IMPLEMENTED`，不得写入任何具体渠道、费率或服务商 |
| **不在范围内（无实现，不得虚构）** | 第三方身份提供方（IdP）回调的**标准协议层**：仓库只有 WeChat 网页授权、GitHub / Discord / LinuxDO / Telegram / OIDC / 自定义 OAuth 的既有实现，本规范不定义新的 IdP 接入规范 |
| **平台边界** | PC Web / H5 为真实可测平台；Android / iOS / HarmonyOS **无任何实现**（审计 §8、决策 D4），认证页验收一律 `NOT_VERIFIED`，不得用 Web 结果代替 |

---

## 4. 视觉与布局约束

| # | 约束 | 规范值 | 依据 / 真值位置 |
|---|---|---|---|
| V-1 | 认证容器最大宽度 | **`sm:w-[480px]`**（`sm` = 640px 断点起）；< 640px 时 `w-full` + `px-4` | `auth-layout.tsx:62`（运行时真值，**优先于蓝图 420px**） |
| V-2 | 移动端左右边距 | **16px**（`px-4`）；纵向 `py-8`；`sm` 起 `p-8` | `auth-layout.tsx:62` |
| V-3 | 页面外框 | `relative grid h-svh max-w-none`——认证页**不套用后台内容区宽度**（`--ds-content-max: 80rem` 不适用于认证页） | `auth-layout.tsx:34` |
| V-4 | 品牌锁定区 | 绝对定位 `top-4 left-4`（`sm:top-8 sm:left-8`），logo 32×32 圆角图 + 站名 `text-lg font-semibold`；**不得用 `h1`** | `auth-layout.tsx:37-58` |
| V-5 | 页面标题 | `Heading variant='page-title' level={1}`，`text-center sm:text-left`；说明文字 `text-sm text-muted-foreground` | `sign-in/index.tsx:36-51`、`otp/index.tsx:35-45` |
| V-6 | 区块节奏 | 标题区与表单区之间 `space-y-8`；标题区内部 `space-y-2` / `space-y-3` | `sign-in/index.tsx:34,37`、`otp/index.tsx:32,33` |
| V-7 | 字段节奏 | 表单字段纵向 `space-y-2`；验证码输入与发送按钮同行 `flex gap-2`，发送按钮 `shrink-0` 且高度对齐输入框（`h-(--ds-control-height-md)`） | `user-auth-form.tsx:503-527`、`sign-up-form.tsx:305-312` |
| V-8 | 字段层级 | 标签走 `FormLabel`（`ui/form.tsx`）；`ui/form-label-tier.tsx` 提供 `default / field / group / row` 四档标签层级，认证表单统一使用 `field` 档 | `web/src/components/ui/form-label-tier.tsx:45-79` |
| V-9 | 输入字号 | 统一 `text-long`（16px），满足 H5 输入 ≥16px 防 iOS 缩放 | `ui/input.tsx:64-69` |
| V-10 | 焦点环 | **2px `ring-2`**（已裁决），`focus-visible:ring-ring`；不得改用 `ring-1` 承载焦点语义 | `UDS5-S13` §7、`ui/input.tsx:64` |
| V-11 | 错误边框 | `aria-invalid:border-destructive` + `aria-invalid:ring-destructive/20`（暗色 `ring-destructive/40`） | `ui/input.tsx:64` |
| V-12 | 辅助链接 | 「忘记密码?」「没有账号?去注册」「会话过期?重新登录」等次级操作用 `text-sm font-medium` + `hover:opacity-75`（**透明度凑态**：`hover:bg-X/NN` 属 T14 禁令），并与主操作在视觉层级上明确区分 | `user-auth-form.tsx:442,479,574`、`sign-in/index.tsx:47-50` |
| V-13 | 认证页栅格 | 认证页**不使用**后台 Sidebar / 三级导航 / 面包屑；`data-auth-surface` 为认证页专属作用域标记，样式不得由后台容器后代选择器隐式灌入 | `auth-layout.tsx:34`；嵌套浮层作用域见 `UDS5-S17` §8 |
| V-14 | 响应式断点 | 五档 `sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536` 固定不改；认证页使用 `sm:` 做居中 → 左对齐切换 | `UDS5-S12` §3、`sign-in/index.tsx:40` |
| V-15 | 命中区 | 可交互元素 ≥24×24（WCAG 2.2 AA 2.5.8），H5 推荐 44px；`.ds-touch-target` 扩展命中区不改盒子 | `UDS5-S17` §5.2 |

---

## 5. 字段规范

| 字段 | 形态与规则 | 校验 / 错误 | 自动化 | 真值位置 |
|---|---|---|---|---|
| **用户名 / 邮箱** | `Input` + `FormLabel`；`type='email'`（邮箱码登录分支）/`autoComplete='email'`；占位符 `name@example.com` | Zod：登录分支 `loginFormSchema.username` 最小 1；注册分支 `registerFormSchema.username` 最小 1 | `autoComplete` 原生语义，不得阻断密码管理器 | `sign-in/components/user-auth-form.tsx:416-425,493-501`、`sign-up/components/sign-up-form.tsx:286-297` |
| **密码** | `PasswordInput`（`Eye`/`EyeOff` 显隐切换，图标 `aria-hidden`）；不得使用 `ui/secret-input.tsx`（那是 API Key 遮罩） | Zod：`loginFormSchema.password` 最小 1；注册走 `accountPasswordSchema`（8–128 + 多样性 + 弱口令 + 含账号标识检查）+ `confirmPassword` 一致性 `superRefine` | 不落前端存储；不得写入日志 / 埋点 / 错误信息 | `web/src/components/password-input.tsx:51-70`、`web/src/features/auth/constants.ts:35-60`、`web/src/lib/password-policy.ts:31-49` |
| **验证码（6 位，按用途分两类）** | **①登录邮箱验证码 / step-up 验证码（纯数字 6 位）**：普通 `Input` + `maxLength={6}` + `inputMode='numeric'` + `autoComplete='one-time-code'`，登录分支 `onChange` 过滤非数字 `.replaceAll(/\D/g,'')`。**②注册邮箱验证码（十六进制 6 位）**：普通 `Input`，**无 `maxLength`、无 `inputMode='numeric'`、无非数字过滤**——因码含 a–f 字母，过滤会破坏输入。③`ui/input-otp.tsx` 分段组件（已登记但**当前无业务引用**，见 §9 S29-D05）。**粘贴与自动填充必须放行**，不得 `onPaste` 拦截、不得禁止 `autoComplete` | 服务端权威：`VerifyCodeWithKey` 校验、10 分钟有效、单次使用、常量时间比较、5 次失败作废；purpose 隔离（`v`/`r`/`l`/`s`） | `autoComplete='one-time-code'` 是浏览器短信/邮件码自动填充的唯一入口，**不得改写**；数字过滤**只施加于纯数字码场景**，不得施加于注册 hex 码 | `user-auth-form.tsx:508-517`、`secure-verification-dialog.tsx:112-119`、`sign-up-form.tsx:307-311`、`common/verification.go:91-115` |
| **验证码重发按钮** | 与验证码输入同行；发送中显示 `Loader2` spinner；倒计时期间**禁用**并显示剩余秒数 | 客户端倒计时：邮箱验证 **30 秒**、密码重置 **30 秒**、**登录验证码 60 秒**；服务端 IP 级频次：**30 秒 2 次**（发码类端点） | 倒计时与发送禁用状态须同时生效，防连点 | `web/src/features/auth/constants.ts:78-79`、`user-auth-form.tsx:93,196,521-540`、`middleware/email-verification-rate-limit.go:11-15` |
| **邮箱（发信目标）** | 注册流程中邮箱为「验证必需」字段，标签 `Email (required for verification)`；后端 `model.NormalizeEmail` 归一化后比对 | Zod：`forgotPasswordFormSchema.email` 必须合法邮箱；已占用邮箱返回 `Email address is already in use` | 未注册 / 已注册在**发码响应**上不可区分（防枚举） | `sign-up/components/sign-up-form.tsx:286-297`、`constants.ts:62-66`、`controller/misc.go:245-256` |
| **第三方提供方按钮** | 由 `status.*` 开关逐个生成；空数组时**整块不渲染**（`return null`）；自定义提供方按 `slug` 生成 key | 只展示真实启用的提供方；未配置入口不得以置灰形式预留在页面上 | OIDC 显示名取 `status.oidc_display_name`，缺省回退 `OIDC` | `web/src/features/auth/components/oauth-providers.tsx:81-152` |
| **人机校验（Turnstile）** | 仅在 `status.turnstile_check` 且存在 `turnstile_site_key` 时渲染；不发码 / 不提交前须通过 | 服务端 `middleware.TurnstileCheck()` 为权威；前端 `validateTurnstile()` 仅作前置拦截 | 不在前端硬编码 site key | `web/src/features/auth/hooks/use-turnstile.ts:28-57`、`middleware/turnstile-check.go` |
| **法律条款勾选** | `components/legal-consent.tsx`；未勾选时阻止提交并提示 | 提示文案走 `t()`，不得硬编码 | 与提供方按钮共用前置校验 | `web/src/features/auth/components/legal-consent.tsx`、`user-auth-form.tsx:176,215,259,297` |
| **新密码 / 确认密码（重置确认）** | `reset-password-confirm` 流程；密码由后端生成并通过邮件下发（`common.GenerateAccountPassword(16)`），新密码须满足与用户自选密码同等策略 | 服务端校验为权威；前端表单映射错误 | 重置邮件链接校验走 `VerifyCodeWithKey(req.Email, req.Token, PasswordResetPurpose)` | `controller/misc.go:387-419`、`web/src/features/auth/reset-password-confirm/index.tsx` |

---

## 6. 状态机（11 态）

> 每态必须同时具备：可判定文案、UI 表现、可执行的恢复动作、服务端权威来源。**未建立对应态的分支不得以空态或静默失败代替。**

| 状态 | 触发条件 | UI 表现 | 用户可执行的恢复动作 | 服务端权威来源 |
|---|---|---|---|---|
| **idle** | 表单初次渲染，尚未提交 | 输入框可用、提交按钮可点、错误区为空 | 直接输入 | 无（纯前端态） |
| **validating** | 失焦或提交前的 Zod 校验 | 错误就近显示在字段下方（`FormMessage`），`aria-invalid` + 错误边框/环同时生效 | 修正该字段后即时清除 | 前端 `zodResolver` + `constants.ts` schema（**仅格式层**，不判安全） |
| **submitting** | 请求在途 | 提交按钮 `disabled + aria-busy`，显示 spinner，尺寸与可访问名称不变；输入项禁用防重复提交 | 无（等待或取消） | 请求在途状态 |
| **verification-required** | 凭据通过但要求二次验证（2FA / Passkey / step-up） | 跳转 `(auth)/otp` 或弹出 `SecureVerificationDialog`；提供 `flow_token` + `expires_at`，挑战 **5 分钟**过期 | 选 2FA / Passkey 完成验证；可「取消」回登录页 | `LoginChallenge{RequireVerification, FlowToken, ExpiresAt, Methods}`；`service/login_verification.go:80-88`；`controller/login_verification.go:17,42` |
| **success** | 服务端返回成功并建立会话 | 成功 Toast（`toast.success`）后按 `redirectTo` 跳转（经 `sanitizeAuthRedirect` 白名单校验，默认 `/dashboard`）；页面标题 / 描述用 `t()` | 无 | `setupLogin` / `AuthBundle`；`web/src/features/auth/hooks/use-auth-redirect.ts:53-70` |
| **invalid-credentials** | 用户名/邮箱或密码错误，或账号被禁用 | 统一文案 `Username or password is incorrect, or user has been banned`；错误落到对应字段；**不得提示「账号不存在」** | 重新输入；可点「忘记密码?」 | `controller/user.go:73,94,155`（密码与验证码登录共用同一句） |
| **rate-limited** | 触发限流档位（登录 20 次/20 分钟；发码 30 秒 2 次） | 提示「请稍后重试」；发码分支带剩余秒数；**按钮保持禁用直到倒计时结束**，不得让用户反复点击 | 等待倒计时；或先完成人机校验 | `middleware.CriticalRateLimit()` / `EmailVerificationRateLimit()` 返回 429（登录档带 `Retry-After` 头） |
| **network-error** | 网络中断、超时、5xx | 「可恢复错误」提示 + 重试入口；保留用户已填内容；不丢失焦点与可访问名称 | 重试；自动重试期间不报错 | `handleServerError` / `AuthOperationError.from`（≥500 时归一为 `Please try again later.`） |
| **expired** | 验证码超 10 分钟；登录挑战超 5 分钟；`flow_token` 过期 | 明确提示「已过期」并提供重新获取路径（重发码 / 重新登录），**不得静默失败或只提示「错误」** | 重新发码或重新登录 | `common.VerificationValidMinutes = 10`；`AuthOperationError('Login flow expired. Please sign in again.', 'AUTH_FLOW_INVALID')`（`web/src/features/auth/secure-verification/api.ts:161-166`） |
| **locked** | 2FA 因子处于 `locked_until` 窗口；账号状态非 enabled | 明确提示「二次验证暂时锁定」并给出替代路径（改用 Passkey）或等待 | 改用其他可用验证方式 / 等待锁定解除 | `ErrVerificationLocked`（`service/security_verification.go:63-69,366`）；账号状态 `UserStatusEnabled=1` / `UserStatusDisabled=2` |
| **recovery-required** | 忘记密码 / 账号找回 / 需要重置凭据 | 提供「忘记密码?」入口 → `(auth)/forgot-password` → 邮件下发重置链接 → `(auth)/user/reset` 设置新密码 | 走完整找回链路；重置邮件不可达时引导联系管理员 | `controller/misc.go:387-419`（`VerifyCodeWithKey` + `PasswordResetPurpose`）；`common.ResetUserPasswordByEmail` |

### 6.1 状态迁移的通用约束

1. **可恢复 vs 不可恢复**：可恢复 = 校验不通过、凭据错误、限流、过期、网络异常、锁定；不可恢复 = 账号被禁用且无替代路径、服务端不可用。映射到 `UDS5-S20` 的「可恢复错误 / 不可恢复错误」两类。
2. **错误位置优先级**（`UDS5-S18` §4.2）：服务端字段错误 > 提交时整表校验 > 即时校验 > 表单级 > 全局 Toast；同字段只显示最高优先级一条。
3. **提示归属**（`web/AGENTS.md` §3.9）：拦截器不弹 Toast；由 `createAppQueryClient` 最终失败回调或 Mutation `onError` 负责；认证侧统一走 `handleServerError` + `AuthOperationError`。
4. **不泄露账户存在性**：发码端点对「未注册 / 已注册 / 已禁用」返回**同一响应形态**；`invalid-credentials` 对「账号不存在 / 密码错误 / 已封禁」返回**同一文案**。

---

## 7. 安全约束

> **风险等级归属（按条，非整节）**：本节 13 条规则按 `UDS5-S01` §4A.3 的判据**逐条**分级，归属列见下表第 2 列（`风险等级`）。**不得**把整节视为同一等级。
>
> - **`RISK-P0`**（触及凭据 / 账户 / 会话）：SEC-1、SEC-2、SEC-3、SEC-5、SEC-9、SEC-10
> - **`RISK-P1`**（触及发码链路 / 账户存在性）：SEC-4、SEC-8
> - **`RISK-P2`**（展示与治理约束）：SEC-6、SEC-7、SEC-11、SEC-12、SEC-13
>
> **边界说明**：API Key 明文取回（scope `token.key.read`）虽同属强验证机制，但**归 `UDS5-S30` §5**（`RISK-P0`），本分册不重复定义；本分册 step-up 相关 scope 清单以 `service/security_verification.go:26-54` 为真源（`auth.login` / `account.password.set` / `account.password.change` / `account.delete` / `admin.user.*` / `2fa.*` / `passkey.*` / `access_token.*` / `account.binding.*` 等）。裸写 `P1` / `P2` 在本分册一律指 `UDS5-S01` §4A.1 定义的**待办优先级**（如 `UDS5-S21` §3 P2「不引入 Clerk SDK」），**非**业务风险等级；`UDS5-S21` §3 的 P1–P5 是**禁止项编号**，引用时必须带章节前缀，不与待办优先级混用。

| # | 风险等级 | 规则 | 依据 / 真值位置 |
|---|---|---|---|
| SEC-1 | `RISK-P0` | **不得在前端日志、埋点、错误信息中记录密码、完整验证码、会话密钥**；不得把完整 Axios 错误对象（可能含凭据）写入管理或展示 | `web/AGENTS.md` §3.9 / 3.13 |
| SEC-2 | `RISK-P0` | **验证码不得在前端持久化**：`localStorage` / `sessionStorage` 只允许存 affiliate code 等非凭据信息（`lib/storage.ts` 仅 `AFFILIATE`） | `web/src/features/auth/lib/storage.ts:37-56` |
| SEC-3 | `RISK-P0` | **验证码生命周期由服务端裁定**：6 位（**纯数字 or 十六进制，按用途区分，见 §2**）、10 分钟、单次使用、常量时间比较、5 次失败作废、4 个 purpose 互隔离；前端不得延长有效期、不得缓存复用 | `common/verification.go:21-115` |
| SEC-4 | `RISK-P1` | **验证码重发须双层限流**：客户端倒计时（30 / 30 / 60 秒）+ 服务端 IP 级 30 秒 2 次；两层缺一即视为不合规 | `web/src/features/auth/constants.ts:78-79`、`user-auth-form.tsx:196`、`middleware/email-verification-rate-limit.go:11-15` |
| SEC-5 | `RISK-P0` | **登录失败、设备风险、会话失效由服务端判定**：前端不得据本地计时或输入形态推断「是否已被锁」 | `UDS5-S01` §0.2；`middleware/rate-limit.go` |
| SEC-6 | `RISK-P2` | **不得阻止密码管理器**：`autoComplete` 使用原生语义（`email` / `current-password` / `one-time-code`），不得置 `autocomplete='off'`、不得拦截 `paste` 事件 | `web/AGENTS.md` 3.13；`secure-verification-dialog.tsx:292` |
| SEC-7 | `RISK-P2` | **不得展示未配置的第三方认证入口**：提供方按钮数组为空时整块不渲染 | `web/src/features/auth/components/oauth-providers.tsx:152` |
| SEC-8 | `RISK-P1` | **错误提示不得泄露账户是否存在**：除非安全策略明确允许（如「该邮箱已被占用」为注册场景的必要提示），否则统一文案 | `controller/user.go:73,94,155` |
| SEC-9 | `RISK-P0` | **密码传输与本地处理**：登录走 `lib/password-encryption.ts`（`encryptPassword`）；密码不得落盘、不得进入 URL 查询串、不得写入埋点 | `web/src/features/auth/lib/password-encryption.ts:43`、`web/src/features/auth/api.ts:58` |
| SEC-10 | `RISK-P0` | **会话与跳转安全**：登录后跳转目标经 `sanitizeAuthRedirect(redirectTo, window.location.origin)` 白名单校验，默认 `/dashboard`；不得接受未校验的 `redirect` 参数 | `web/src/features/auth/lib/auth-redirect.ts`、`web/src/features/auth/hooks/use-auth-redirect.ts:67` |
| SEC-11 | `RISK-P2` | **人机校验不可绕过**：Turnstile 未就绪时前端阻止发码 / 提交，服务端 `TurnstileCheck()` 为最终判定 | `web/src/features/auth/hooks/use-turnstile.ts:40-45`、`middleware/turnstile-check.go` |
| SEC-12 | `RISK-P2` | **不得引入 Clerk SDK 或任何新的运行时认证依赖**；认证行为以仓库既有实现与后端配置为准 | `UDS5-S21` §3 P2；`web/package.json` 无 Clerk 依赖 |
| SEC-13 | `RISK-P2` | **不引入短信通道**：仓库无短信网关，本规范不得写入短信 provider、短信模板或短信频次规则 | 全仓 grep 0 命中（见 §2 短信能力行） |

---

## 8. 禁止事项汇总

| # | 禁止项 | 说明 |
|---|---|---|
| F-1 | 引入 Clerk SDK / `ClerkProvider` / `@clerk/ui` / `@clerk/elements` / `@clerk/localizations` | `UDS5-S21` §3 禁止项 P2 |
| F-2 | 引入或虚构短信验证 / 短信登录 / 短信 provider | 仓库无短信网关；无实现不得写成已实现 |
| F-3 | 修改后端认证逻辑、API 契约、验证码存储与校验、限流档位数值 | 业务红线 R2 / R3 |
| F-4 | 新增或删除 `(auth)/` 路由、擅自增加注册字段或认证方式 | A-7；由服务端开关与产品决策决定 |
| F-5 | 在前端记录或持久化密码、验证码、会话密钥 | SEC-1 / SEC-2 |
| F-6 | 用差异化文案暴露账户是否存在 | A-4 / SEC-8 |
| F-7 | 硬编码颜色 / 字号 / 间距 / 圆角，或在认证页使用后台内容区宽度 | T1–T17 门禁；`UDS5-S12` §6 |
| F-8 | 用 `hover:bg-X/NN` 透明度凑态（T14 禁令），或用仅 `opacity` 表达禁用 | `UDS5-S17` §7；`UDS5-S14` |
| F-9 | 认证页使用后台 Sidebar / 三级导航 / 面包屑 | V-13 |
| F-10 | 阻止 `autoComplete`、拦截验证码粘贴、禁止密码管理器 | SEC-6 |
| F-11 | 硬编码用户可见文案而不走 `t()`，或只同步部分 locale | A-8；`web/scripts/check-i18n-keys.mjs` |
| F-12 | 用后台布局容器或后代选择器把样式隐式灌入认证页 / 认证浮层 | `UDS5-S17` §8 嵌套浮层作用域 |
| F-13 | 声称任何测试通过、门禁通过或平台已验收 | `UDS5-S01` §15；本文全部验证项为 `NOT_VERIFIED` / `NOT_EXECUTED` |

---

## 9. 差异与例外登记

| 编号 | 内容 | 状态 |
|---|---|---|
| **S29-D01** | **表单容器宽度冲突**：蓝图 §2 写「表单容器建议最大宽度 420px」，仓库真值为 `sm:w-[480px]`（`web/src/features/auth/auth-layout.tsx:62`）。按「数值以代码为准」（`UDS5-S01` §0.2 效力层级 4），**5.0 采用 480px**，并按 §4 V-1 登记。蓝图 420px 为**上游建议值，不采纳为 Uter 规范值** | `ADOPT_REPO_TRUTH` / `NOT_VERIFIED` |
| **S29-D02** | **移动端左右边距**：蓝图 16px 与仓库 `px-4`（16px）一致，无冲突 | `ALIGNED` |
| **S29-D03** | **Clerk SDK 表述冲突**：蓝图 §6 原文含「若 Uter 集成 Clerk SDK，认证行为以实际 SDK 与后端配置为准」。**改写为**：Uter **不集成 Clerk SDK**；仅借鉴其分步流程、字段级错误与状态完整性的**信息架构理念**，外观仍遵守 Uter Token（`UDS5-S21` §3 P2 / §4.5） | `REJECT_BLUEPRINT` |
| **S29-D04** | **短信能力**：蓝图 §1 把「短信验证」列入范围。仓库核实结论——**无独立短信网关**（全仓 `.go/.ts/.tsx` 中 `\bSMS\b`/`短信`/`SendSms`/`smsProvider` 0 命中；仅有 `common/email*.go` 邮件体系与 `model/account_security.go` 的登录方式快照）。短信章节标 `NOT_IMPLEMENTED`，**不写 provider、费率、模板与频次** | `NOT_IMPLEMENTED` |
| **S29-D05** | **OTP 组件与实际用法不一致**：蓝图 §3 要求「验证码输入支持粘贴和自动填充」。仓库真值——`ui/input-otp.tsx`（分段 OTP）已在组件注册表登记，但**全仓无业务引用**；认证域实际使用普通 `Input`（登录 / step-up：`maxLength={6}` + `inputMode='numeric'` + `autoComplete='one-time-code'`；注册：无 `maxLength`、无数字过滤——形态差异见 S29-D13）。规范按真值写「形态三选一（两类普通 Input + 分段组件）」，**不宣称分段 OTP 已落地** | `ADOPT_REPO_TRUTH` / `NOT_VERIFIED` |
| **S29-D06** | **重发倒计时三处不同源**：邮箱验证 30 秒、密码重置 30 秒（`constants.ts:78-79`）与**登录验证码 60 秒**（`user-auth-form.tsx:196` 本地 state，未走常量）。规范如实登记三个值并标注来源差异，**不改代码统一**（统一需走 `UDS5-S01` §19 变更流程） | `REGISTERED` / `NOT_VERIFIED` |
| **S29-D07** | **守卫测试计数差异**：`UDS5-S13` §4.1 与审计 §12 记 10 个，`web/src/design-system/__tests__/` 实际为 **11 个** `*.test.ts`（多出 `design-system-5-governance.test.ts`）。本文按真值写 11，**不改其他分册文本** | `REGISTERED` |
| **S29-D08** | **认证相关端点挂载的限流档位不统一**：`/api/user/login/email-code` 的 **GET（发码）** 走 `EmailVerificationRateLimit`（30s/2 次），**POST（校验登录）** 走 `CriticalRateLimit`（20 次/20 分钟）；`/api/verification`（注册发码）同样走 `EmailVerificationRateLimit`。前端限流提示须按返回档位区分文案，本文 §5 / §6 按此登记，**不改后端** | `REGISTERED` / `NOT_VERIFIED` |
| **S29-D09** | **429 响应形态差异**：`CriticalRateLimit` 返回 `Retry-After` 头 + 空体；`EmailVerificationRateLimit` 返回 429 + JSON `{success:false,message}`（Redis 分支 message 内嵌剩余秒数）。前端「等待 N 秒」文案只能取自服务端 message，**不得前端硬编码秒数** | `REGISTERED` / `NOT_VERIFIED` |
| **S29-D10** | **step-up 验证码的 key 不是邮箱**：`StepUpEmailCodePurpose = "s"` 的存储 key 是操作上下文 HMAC 哈希，purpose 与 `v`/`r`/`l` 隔离。规范按真值写「用途隔离」而非「按邮箱」 | `ADOPT_REPO_TRUTH` |
| **S29-D11** | **挑战有效期 5 分钟**：蓝图未给数值。仓库真值 `LoginVerificationTTL = 5 * time.Minute`（`service/login_verification.go:11`）与 `passkeyFlowTTL = 5 * time.Minute`（`service/passkey/session.go:14`）。本文写入 §6 `verification-required` / `expired` 两态 | `ADOPT_REPO_TRUTH` |
| **S29-D12** | **本分册已登记入规范注册表**：`DESIGN-STANDARD-REGISTRY.yaml` 已补登 `UDS5-S29`（`category: business-vertical`，`status: ACTIVE`，`dependencies: [UDS5-S01, UDS5-S11, UDS5-S12, UDS5-S13, UDS5-S14, UDS5-S15, UDS5-S17, UDS5-S18, UDS5-S20, UDS5-S21, UDS5-S22]`）——与本文「与其他规范的关系」表逐项一致。**已执行** `bun run design:5:check`（`web/scripts/check-design-system-5.0.mjs`，**默认模式、不带 `--generate` / `--strict`**），结果 `verdict: PASS` / `errors: 0` / `standards: 37` / `registeredDocIds: 37` / `scannedMarkdown: 35`——「文档 ID 反向登记」检查已通过。**该结论仅覆盖注册表与文档 ID 的结构一致性，不构成认证域功能 / 视觉 / 门禁 / 平台验收**；`gaps: 74` 为组件级证据缺口，与本文无关。（只读性已核实：该脚本的 `writeFileSync` 仅在 `--generate` 分支，默认模式不写任何文件） | `CLOSED`（2026-11-14 只读实测 `errors: 0`；结构层 `PARTIALLY_VERIFIED`） |
| **S29-D13** | **验证码存在两套生成器，形态不同**：登录邮箱验证码与 step-up 用 `GenerateNumericCode(6)`（**纯数字**，可过滤非数字字符）；注册邮箱验证码用 `GenerateVerificationCode(6)`（**十六进制，含 a–f 字母**），故注册输入框**未做数字过滤、未设 `maxLength`**；密码重置链接 token 为 `GenerateVerificationCode(0)`（完整 32 位 hex，**不是 6 位码**）。蓝图 §3 只写「验证码」，未区分形态。本文按真值**分三类登记**，并明确「数字过滤只施加于纯数字码场景」 | `ADOPT_REPO_TRUTH` / `NOT_VERIFIED` |

---

## 与其他规范的关系

| 规范 | 关系 | 边界 |
|---|---|---|
| `UDS5-S01` | 效力来源 | 不重述总则；本文遵守其版本口径、效力层级与「文档存在不证明能力可用」原则 |
| `UDS5-S17` | 交互五态（成功/失败/取消/加载/异常）与本文 11 态的映射 | 交互过程在 S17；认证域态的具体文案与恢复路径在本文 |
| `UDS5-S18` | 表单 12 项契约：字段验证、错误位置与优先级、防重复提交、i18n 同步 | 表单细节在 S18；本文只补认证域特例 |
| `UDS5-S20` | 五类反馈（成功/信息/警告/可恢复错误/不可恢复错误）与提示归属 | 反馈组件映射在 S20；本文给认证态到五类的映射 |
| `UDS5-S22` | 业务 UI 适配的红线 R2（认证逻辑零改动） | 本文必须与 R2 一致：只改视觉 |
| `UDS5-S21` | Clerk 参考边界：严格限视觉、不引入 SDK | 本文 §1 A-2 / §8 F-1 与其 P2 一致 |
| `UDS5-S13` | 无障碍：2px 焦点环、H5 输入 ≥16px、命中区、错误播报 | 认证页的可访问名称、键盘可达、错误播报须满足 |
| `UDS5-S12` | 响应式五档断点 | 认证页断点不改值 |
| `UDS5-S11` | 后台内容容器 `--ds-content-max` | **认证页不适用**（V-3） |
| `UDS5-S14` / `UDS5-S15` | 组件八态与唯一扩展路径（variant / slot / composition） | 认证域组件不得绕过 `components/ui/` 自绘同等控件 |
| `web/AGENTS.md` | **强制上位约束**：3.1 i18n / 3.7 表单 / 3.9 错误处理 / 3.13 安全 / 3.14 测试 | 冲突时以 `web/AGENTS.md` 为准 |

---

## 代码实施位置

> 下表路径均已 `ls` / `grep` 逐条核实存在。本轮**全部只读**，未修改任何代码。

| 用途 | 真实路径 | 本轮动作 |
|---|---|---|
| 认证路由（9 个） | `web/src/routes/(auth)/route.tsx`、`sign-in.tsx`、`sign-up.tsx`、`register.tsx`、`forgot-password.tsx`、`reset.tsx`、`user/reset.tsx`、`otp.tsx`、`oauth.wechat-web.tsx` | **只读** |
| 认证 feature 根 | `web/src/features/auth/api.ts`、`api.test.ts`、`auth-layout.tsx`、`constants.ts`、`types.ts` | **只读** |
| 认证 feature 子模块 | `web/src/features/auth/{sign-in,sign-up,forgot-password,otp,passkey,reset-password-confirm,secure-verification}/`、`web/src/features/auth/{components,hooks,lib}/` | **只读** |
| 认证表单组件 | `web/src/features/auth/sign-in/components/user-auth-form.tsx`、`sign-up/components/sign-up-form.tsx`、`forgot-password/components/forgot-password-form.tsx`、`otp/components/otp-form.tsx` | **只读** |
| 认证共享组件 | `web/src/features/auth/components/oauth-providers.tsx`、`oauth-callback-screen.tsx`、`legal-consent.tsx` | **只读** |
| 认证 hooks / lib | `web/src/features/auth/hooks/{use-auth-redirect,use-email-verification,use-oauth-login,use-turnstile}.ts`、`web/src/features/auth/lib/{auth-redirect,password-encryption,storage,oauth,oauth-popup,oauth-bind-window,oauth-callback-mode,telegram-login}.ts` | **只读** |
| 字段与表单基础组件 | `web/src/components/ui/form.tsx`、`field.tsx`、`form-label-tier.tsx`、`input-otp.tsx`、`secret-input.tsx`、`input.tsx`、`web/src/components/password-input.tsx` | **只读** |
| 认证错误与安全工具 | `web/src/lib/secure-verification.ts`（`AuthOperationError`）、`web/src/lib/handle-server-error.ts`、`web/src/lib/password-policy.ts`、`web/src/lib/auth-session.ts` | **只读** |
| 后端验证码与限流 | `common/verification.go`、`common/constants.go`、`common/email.go`、`middleware/email-verification-rate-limit.go`、`middleware/rate-limit.go`、`middleware/turnstile-check.go` | **只读**，不改 |
| 后端认证端点 | `controller/user.go`（`Login` / `LoginByEmailCode`）、`controller/misc.go`（`SendLoginEmailCode` / `SendEmailVerification` / `ResetPassword`）、`controller/secure_verification.go`（`SendVerificationEmailCode`）、`controller/login_verification.go`、`service/security_verification.go`、`router/api-router.go` | **只读**，不改 |
| i18n | `web/src/i18n/locales/{en,fr,ja,ru,vi,zh-TW,zh}.json`、`web/src/i18n/static-keys.ts`、`web/scripts/check-i18n-keys.mjs` | **只读** |
| 守卫测试 | `web/src/design-system/__tests__/`（11 个 `*.test.ts`，含 `accessibility.test.ts`、`design-system-5-governance.test.ts`） | **只读** |
| 规范输出 | `docs/design-system/uter-design-system-5.0/AUTHENTICATION-COMPONENT-STANDARD.md` | **本文件（新建）** |

> 未列出的脚本、路径、测试结果不出现在本规范中；不宣称已运行门禁或视觉回归。

---

## 自动化验证

| 验证项 | 真实命令 / 门禁 | 关联 | 说明 |
|---|---|---|---|
| i18n 键覆盖 | `bun run i18n:check`（`web/scripts/check-i18n-keys.mjs`）；亦由 `bun run lint` 前置调用 | §5 / §7 A-8 | 覆盖源码中静态 `t('...')` 键与常量拼接键；模板字符串等无法静态解析的键需人工同步 |
| 规范 / 注册表一致性 | `bun run design:5:check`（`web/scripts/check-design-system-5.0.mjs`） | §9 S29-D12 | 含「文档 ID 反向登记」检查；**本文 `UDS5-S29` 已登记入注册表**，2026-11-14 只读实测（默认模式、不带 `--generate` / `--strict`）`verdict: PASS` / `errors: 0` / `standards: 37` / `registeredDocIds: 37`（见 S29-D12）。**仅覆盖注册表与文档 ID 结构层，非认证域功能验证** |
| 注册表严格模式 | `bun run design:5:strict` | §9 | 已知缺口升级为失败；本轮未执行 |
| 设计 Token 门禁 | `bun run lint:design:strict`（`web/scripts/check-design-tokens.mjs`，T1–T17） | §4 V-7–V-11 | 守硬编码色值 / 字号 / 间距 / 圆角与透明度禁令（T14） |
| 对比度门禁 | `bun run verify:contrast` | §4 V-11 | 认证页错误态与焦点环对比度纳入全站扫描 |
| 组件注册一致性 | `bun run components:registry:check` / `components:registry:strict` | §5 验证码字段、`ui/input-otp.tsx` | `input-otp.tsx` 已登记但无业务引用（S29-D05） |
| 单元测试 | `bun run test`（Vitest） | 全文 | 认证域既有测试：`web/src/features/auth/api.test.ts`、`components/__tests__/oauth-providers.test.tsx`、`otp/__tests__/login-verification.test.tsx`、`secure-verification/__tests__/verification-flow.test.tsx`、`secure-verification/__tests__/verification-api.test.ts`、`passkey/__tests__/domain-verification.test.tsx`、`lib/auth-redirect.test.ts`、`lib/oauth-bind-window.test.ts`、`lib/telegram-login.test.ts`、`lib/__tests__/{oauth-popup,oauth-callback-mode}.test.ts` |
| 无障碍回归 | `bun run test:axe`（`web/e2e/axe/`） | §4 / §7 | 2 个 spec；**刻意不接 CI**（像素基线依赖本机渲染与完整服务栈） |
| 视觉回归 | `bun run test:visual`（showcase）/ `test:visual:e2e`（`web/e2e/visual/`，含 `auth-setup` project） | §4 | E2E 轨刻意不接 CI；本轮未执行 |
| 类型 / Lint / 构建 | `bun run typecheck` / `bun run lint` / `bun run build:check` | 全文 | 本轮未执行 |

---

## 验证状态

| 项 | 状态 | 依据 / 备注 |
|---|---|---|
| 本分册文本 | `ACTIVE` | 已撰写，供评审；未修改任何代码 |
| 文档 ID / 版本 / 状态 | `UDS5-S29` / `5.0.0` / `ACTIVE` | **已登记入 `DESIGN-STANDARD-REGISTRY.yaml`**（S29-D12 已闭合） |
| 11 态状态机 | `NOT_VERIFIED` | 规范层定义；仓库中**无现成脚本**覆盖认证态到 UI 的完整映射 |
| 字段规范（6 类字段） | `NOT_VERIFIED` | 未跑 `typecheck` / `lint` / 单测 |
| 视觉与布局约束（V-1–V-15） | `NOT_VERIFIED` | 数值引自 `auth-layout.tsx` 等真源，但**未执行浏览器级复核或视觉回归** |
| 验证码规则（6 位 / 10 分钟 / 单次使用 / 常量时间比较 / 5 次作废 / 4 purpose 隔离） | `NOT_VERIFIED` | 引自 `common/verification.go` 只读核实；**未运行任何后端测试** |
| 限流规则（登录 20 次/20 分钟；发码 30 秒 2 次） | `NOT_VERIFIED` | 引自 `middleware/*.go` 与 `router/api-router.go` 只读核实；**未运行任何后端测试** |
| 安全约束 SEC-1–SEC-13 | `NOT_VERIFIED` | 未做代码审计结论；逐条为规范要求 |
| 短信能力 | `NOT_IMPLEMENTED` | 仓库无短信网关；无实现不得写成已实现（S29-D04） |
| Clerk SDK 零引入 | `NOT_VERIFIED` | 已核实 `web/package.json` 无 Clerk 依赖（只读事实）；**未执行依赖扫描门禁** |
| i18n 7 份 locale 同步 + `static-keys.ts` | `NOT_VERIFIED` | 已核实文件与行数存在；**未运行 `i18n:check`**，不宣称一致 |
| 守卫测试 11 个 | `NOT_VERIFIED` | 已 ls 核实数量；**未执行** |
| 认证域单测 / E2E / 视觉回归 / a11y | `NOT_EXECUTED` | 审计 §1 / §7 / §13 / §14 约束 |
| 注册表结构一致性 `design:5:check`（默认模式） | `PARTIALLY_VERIFIED`（**仅注册表结构层**，见 S29-D12） | 2026-11-14 只读实测：`verdict: PASS` / `errors: 0` / `standards: 37` / `registeredDocIds: 37` / `scannedMarkdown: 35`。**该项仅覆盖注册表与文档 ID 的结构一致性，不构成对认证域功能、视觉、门禁或平台验收的任何验证**；`gaps: 74` 为组件级证据缺口（`VERIFIED 0 / PARTIAL 9 / NOT_VERIFIED 56`），与本文无关。**只读性已核实**：该脚本的 `writeFileSync` 仅存在于 `--generate` 分支，本次以默认模式执行，未写入任何文件 |
| 注册表严格模式 `design:5:strict` | `NOT_EXECUTED` | 已知缺口未闭合 |
| 全量构建 / `scripts/verify-all.sh` | `NOT_EXECUTED` | 并发 WIP 约束，本轮不执行 |
| PC Web / H5 平台 | `NOT_VERIFIED` | 未针对 5.0 重跑回归 |
| Android / iOS / HarmonyOS | `NOT_VERIFIED` | 无真实实现（决策 D4），不得用 Web 结果代替 |

**结论**：本分册为规范声明。**认证域相关的全部验证项均为 `NOT_VERIFIED` / `NOT_EXECUTED`，未勾选任何测试通过或平台验收**；唯一例外是上表末段标注的 `design:5:check` 注册表结构一致性检查（只读、仅结构层面），它**不替代**任何认证域功能或平台验收结论。
