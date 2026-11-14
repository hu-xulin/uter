# 触达与本地化规范（Comms and Localization Standard）

> UTER Design System 5.0 · 分册 S32。本规范定义「邮件/短信触达的结构与安全边界，以及 7 locale 的国际化实施约束」。**核心口径：站内通知与邮件/短信严格分工——站内反馈归 `UDS5-S20`，站外触达归本册；邮件为独立渲染体系（独立字体栈 + 内联样式 + 不消费 Web Token），不受 `--ds-*` / `--text-*` 约束；短信能力在仓库中不存在，一律标 `NOT_IMPLEMENTED`，不写 provider**。**5.0 为当前唯一正式体系，3.0 保留为历史**，本文引用上游蓝图仅用于溯源与规则取舍。除标明已核实的真源代码位置外，未宣称任何测试通过或平台验收。

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S32` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01`（UTER Design System 5.0 总纲） |
| 生效日期 | `2026-11-14` |
| 适用范围 | 邮件触达（`common/email*.go`、`controller/misc.go`、`controller/secure_verification.go`、`service/{user_notify,email_binding,account_security,security_verification}.go`）与 7 locale 国际化实施（`web/src/i18n/**`、`i18n/**`、`web/scripts/{check-i18n-keys,sync-i18n}.mjs`、`web/scripts/oxlint/intl-locale.mjs`）；**不含**站内 Toast / Alert / 通知中心（归 `UDS5-S20`）、不含 Web 端组件视觉（归 `UDS5-S14`）、不含资金与配额业务语义 |
| 验证状态 | `NOT_VERIFIED` |

---

## 1. 总则

| 编号 | 原则 | 说明 |
|---|---|---|
| CL-1 | 站内与站外不混谈 | 站内操作反馈走 `sonner` / `ui/alert.tsx` / 通知中心，归属 `UDS5-S20`；邮件与短信是站外触达，归属本册。两者不得共用文案常量、不得互相替代 |
| CL-2 | 邮件是独立渲染体系 | 邮件 HTML **不消费**任何 `--ds-*` / `--text-*` Token（`common/email_template.go` 中 `var(--ds-`/`var(--text-` 出现次数为 **0**），字体栈为 `brandEmailFont`（Roboto 起），与 Web 端 Inter + Noto Sans SC **不同**；Web 端 Token 变更**不自动传导**到邮件 |
| CL-3 | 不引入模板引擎 | 邮件渲染一律走 `common/email_template.go` 的 `BuildBrandEmailHTML(BrandEmail)` + 内联样式拼接；不得引入任何模板引擎 / 第三方邮件 SDK |
| CL-4 | 一切事实来自仓库 | 主题格式、品牌名、验证码时效、locale 清单、键序规则均以仓库真源为准；蓝图数值（如 420px、6 位验证码等）只作规则参考，不作 Uter 规范值 |
| CL-5 | 短信未实现即不写 | 仓库**无独立短信网关**（全仓 `.go` / `.ts` / `.tsx` 排除测试文件后 `\bSMS\b` / `短信` 命中 **0**）；短信章节一律 `NOT_IMPLEMENTED`，**禁止虚构服务商、费率、模板、频次** |
| CL-6 | 触达内容不泄密 | 邮件/短信正文与链接**不得**含密码、API Secret、完整密钥、他人或他组织数据；验证码与重置链接须有时效、一次性/重放防护 |
| CL-7 | i18n 铁律 | 所有用户可见文本进 i18next 资源，禁止业务组件散落硬编码；**key 用英文原文**，禁止以中文原文作为唯一 key；变量用命名占位符；改文案必须同步 7 份 locale 并按需登记 `static-keys.ts` |
| CL-8 | 语言标识两套 | 界面语言码（`zhCN` / `zhTW` / `en` / `fr` / `ru` / `ja` / `vi`）**不是** BCP 47 标签；进入 `Intl.*` 前必须经 `toIntlLocale()` 转成 `zh-CN` / `zh-TW` 等合法标签 |
| CL-9 | 不改其他文件 | 本轮只产出本文件；不改代码、不改注册表、不执行 git 写操作 |
| CL-10 | 不勾选通过 | 所有验证项一律 `NOT_VERIFIED` / `NOT_EXECUTED`；不得以「文档已写」宣称「能力可用」 |
| CL-11 | 站内通知优先级 | 同一事件若既有站内反馈又有邮件，两者文案源各自独立（站内走 `t()`，邮件走后端 `i18n.Translate`），**不得**互相 import |
| CL-12 | 记录差异而非抹平 | 仓库事实与蓝图/其他分册冲突时，按真值写并登记差异，不改代码值、不静默统一 |

---

## 2. 事实基线（引自审计报告与参考分析，不得假设）

### 2.1 邮件链路

| 项 | 真实值 | 来源 |
|---|---|---|
| 发送入口 | `common.SendEmail(subject string, receiver string, content string) error` | `common/email.go:96` |
| 传输选择 | 单一选择器 `OptionMap["EmailProvider"]`：`"resend"` → `sendResendEmail`；`""` / `"smtp"` → SMTP；其他值报错「Email sending method must be SMTP or Resend」。**失败不回落第二 provider** | `common/email.go:98-110` |
| SMTP 传输 | `net/smtp`；隐式 TLS（465）/ STARTTLS / 明文三档由 `SMTPSSLEnabled`、`SMTPStartTLSEnabled`、`SMTPPort` 决定 | `common/email.go:44-76` |
| SMTP 认证 | `AutoSMTPAuth` 自动协商 `PLAIN` / `LOGIN` / `NTLM`；Outlook / onmicrosoft 域强制 `LOGIN` | `common/email_ntlm_auth.go`、`common/email-outlook-auth.go` |
| Resend 传输 | `POST https://api.resend.com/emails`，20s 超时，**禁重定向**（`CheckRedirect` 返回 `ErrUseLastResponse`）；单次最多 50 收件人 | `common/email_resend.go:13-56` |
| 邮件头 | `From: <SystemName> <smtpFrom>`；`Subject` 用 RFC 2047 Base64（`=?UTF-8?B?...?=`）；`Content-Type: text/html; charset=UTF-8`；附 `Date`、`Message-ID` | `common/email.go:125-132` |
| 品牌名常量 | `EmailBrandName = "Uter.ai 优特智能"` | `common/email_template.go:9` |
| **标题规则** | `BrandEmailSubject(purpose) = purpose + "-" + EmailBrandName`。`purpose` 是**已本地化**的标题（如 `Uter.ai email verification`），故实际标题形如 `Uter.ai email verification-Uter.ai 优特智能` | `common/email_template.go:14-16`；测试断言 `common/email_template_test.go:13-16` |
| 模板渲染 | `BuildBrandEmailHTML(email BrandEmail) string`；入参 `Heading` / `Paragraphs` / `Code` / `Note`；空段落被跳过 | `common/email_template.go:19-24, 57-95` |
| 邮件字体栈 | `brandEmailFont = "Roboto,'Helvetica Neue',Arial,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif"` | `common/email_template.go:26` |
| 邮件字号 | 标题 `26px` / 正文 `14px` / 验证码 `40px` / 页脚 `12px`（**未低于 Web 端 12px 下限**） | `common/email_template.go:63-91` |
| 邮件色值 | `#202124`（标题）`#3c4043`（正文）`#80868b`（页脚）`#1a73e8`（链接）`#dadce0`（卡片描边）`#e8eaed`（分隔线）`#ffffff`（底色）——**硬编码、非品牌 Token** | `common/email_template.go:63-92` |
| 链接样式 | `ensureLinkNoUnderline(html)` 为未自带 `text-decoration` 的 `<a>` 注入 `text-decoration:none;color:#1a73e8;` | `common/email_template.go:34-46` |
| 邮件 Logo | `brandEmailLogoBase64`（base64 内嵌 PNG，`width=64 height=64 alt="Uter.ai"`）；有测试守其与 `web/public/logo.png` 字节一致 | `common/email_template.go:51, 80`；`common/email_template_test.go:79-91` |
| 多账号 SMTP | `SMTPAccounts` 选项存 JSON 数组（顺序即轮换顺序）；`common.ParseSMTPAccounts` / `common.DefaultSMTPDailySendLimit = 400`（封/天）/ `service.SelectSMTPSender` 选号 / `model.GetSMTPAccountUsageView` 取当日用量 | `common/smtp_accounts.go:11, 49`；`service/smtp_accounts.go:19`；`model/email_quota.go:69` |
| 凭据掩码 | `SMTPAccounts` 整条在 `GET /api/option/` 被剔除（掩码会破坏 JSON 结构），仅暴露派生的 `SMTPAccountsView`（`Token` 经 `common.MaskSecretValue` 掩码） | `common/secret_option_keys.go:172-175`；`controller/option.go:89-121`；`common/secret_mask.go:48` |
| 发信调用点 | `common.SendEmail` 共 8 处调用：`controller/misc.go:271,310,381`、`service/email_binding.go:209,221`、`service/security_verification.go:746`、`service/account_security.go:58`、`service/user_notify.go:139` | 只读核实 |
| 品牌回归守卫 | `TestUserFacingMailTemplatesStayBranded`：4 个发信入口文件不得出现裸 `<p>` 拼接；调 `SendEmail` 必须同文件调 `BuildBrandEmailHTML` | `common/email_coverage_test.go:21` |
| 主题与正文语言 | 邮件文案由**后端** `i18n.Translate(lang, key, args)` 产出，语言取「账号偏好语言 → 请求声明语言」 | `controller/misc.go:349-361, 371`；`service/account_security.go:32-38` |

### 2.2 验证码与重置链接

| 项 | 真实值 | 来源 |
|---|---|---|
| 有效期 | `VerificationValidMinutes = 10`（10 分钟） | `common/verification.go:42` |
| 一次性 | 校验成功即 `delete(verificationMap, mapKey)` | `common/verification.go:105` |
| 防爆破 | 同一 key 失败达 `maxVerificationAttempts = 5` 即作废 | `common/verification.go:36, 108-111` |
| 时序安全 | `subtle.ConstantTimeCompare` 常量时间比较 | `common/verification.go:104` |
| 用途隔离 | 4 个 purpose：`v` 注册验证 / `r` 密码重置 / `l` 登录验证码 / `s` step-up（key 为操作上下文 HMAC 哈希） | `common/verification.go:22-33` |
| 码形态 | 登录与 step-up 用 `GenerateNumericCode(6)`（**纯数字**）；注册验证用 `GenerateVerificationCode(6)`（**十六进制**）；密码重置 token 用 `GenerateVerificationCode(0)`（完整 32 位 hex） | `common/verification.go:44-76`；`controller/misc.go:256, 290, 363`；`service/security_verification.go:730` |
| 重置链接 | `fmt.Sprintf("%s/user/reset?email=%s&token=%s", system_setting.ServerAddress, email, code)`——域名单一来自服务端配置项，链接内**不含**用户可控跳转目标 | `controller/misc.go:292` |
| 前端重置页 | `web/src/features/auth/reset-password-confirm/index.tsx` 只读 `email` / `token` 两个 query 参数，**无 redirect / next 参数** | `web/src/features/auth/reset-password-confirm/index.tsx:42-49` |
| 重置后置行为 | 重置成功由服务端生成随机新密码并回传，页面自动复制到剪贴板（`Password reset and copied to clipboard: {{password}}`） | `controller/misc.go:403-418`；`web/src/features/auth/reset-password-confirm/index.tsx:74-95` |
| 绑定码 TTL | `model.EmailBindingTTL = 10 * time.Minute` | `model/email_binding.go:13` |
| 发码限流 | `EmailVerificationRateLimit`：30 秒窗口最多 **2** 次（按 IP，Redis 优先 + 内存兜底）；挂载于 `/api/verification`(GET)、`/api/user/login/email-code`(GET)、`/api/verify/email_code`(POST)、`/api/oauth/email/bind/{start,resend}`(POST) | `middleware/email-verification-rate-limit.go:12-14`；`router/api-router.go:57, 62-63, 95, 106` |
| 重置发码限流 | `/api/user/reset_password`(GET) 走 `CriticalRateLimit`（20 次 / 20 分钟）+ Turnstile | `router/api-router.go:58`；`common/constants.go:265-266` |

### 2.3 国际化

| 项 | 真实值 | 来源 |
|---|---|---|
| 前端 locale | **7 份**：`web/src/i18n/locales/{en,zh,zh-TW,fr,ru,ja,vi}.json`，各 7796 行（`zh.json` 7797 行），合计 **54,573 行**；结构为单一 `translation` 命名空间的**扁平 JSON** | 只读核实；审计 §2 |
| 前端键量 | `en` / `zh-TW` / `fr` / `ru` / `ja` / `vi` 各 **7791** 个叶子键；`zh` 为 **7792**（多出 `Invalid channel ID`，其余 6 份均无） | 逐份解析核实 |
| key 形态 | **key 即英文原文**（flat JSON，英文原文作键）；7 份中仅 31 个键为严格点分层级式（`auth.resetPasswordConfirm.*` 等），主体为英文句子键 | `AGENTS.md:156, 372`；只读核实 |
| 界面语言码 | `INTERFACE_LANGUAGE_OPTIONS`：`zhCN` / `en` / `fr` / `ru` / `ja` / `vi` / `zhTW`；`i18next.supportedLngs` 同 7 值 | `web/src/i18n/languages.ts:19-27`；`web/src/i18n/config.ts:86` |
| BCP 47 转换 | `toIntlLocale(value?)`：`zhCN` → `zh-CN`，`zhTW` → `zh-TW`，其余经 `Intl.getCanonicalLocales`，非法值返回 `undefined` | `web/src/i18n/languages.ts:116-131` |
| `Intl` 强制规则 | 任何来自界面语言的参数进入 `Intl.*` / `toLocale*` / 公共格式化函数前必须 `toIntlLocale()`；oxlint 自定义规则 `project/intl-locale` 以 **error** 级别检查，禁止 lint-disable 绕过 | `web/AGENTS.md:76-78`；`web/scripts/oxlint/intl-locale.mjs:143` |
| 数字格式化 | 统一走 `@/lib/format` 的 `formatNumber`（`maximumFractionDigits: 2`）/ `formatCompactNumber`（`notation: 'compact'`, `maximumFractionDigits: 1`）；金额走 `@/lib/currency` | `web/src/lib/format.ts:32-51` |
| 计数与复数 | 计数文案用命名占位符 `{{count}}` + `t(key, { count })`；**7 份 locale 中 `_one` / `_other` / `_plural` 后缀键数量为 0**，仓库未接 ICU 插件（`i18next-icu` / `intl-messageformat` 均不在 `web/package.json`） | 只读核实 |
| 静态键登记 | `web/src/i18n/static-keys.ts` 的 `STATIC_I18N_KEYS`：707 条单行字面量条目，**去重后 701 个键**（按 `check-i18n-keys.mjs` 同口径） | 只读核实 |
| 键覆盖门禁 | `web/scripts/check-i18n-keys.mjs`：扫描 `src/` 下静态 `t('字面量')` 与 `t(CONST)`（`['a','b'].join('.')` 形式），外加 `static-keys.ts` 登记键；7 份 locale 任一缺键即 `exit 1`。**不覆盖**模板字符串插值键、运行时拼接键、变量传入键 | `web/scripts/check-i18n-keys.mjs:20-35, 44-46, 147-195` |
| 门禁接线 | `i18n:check` 已被 `bun run lint` **前置调用**（`"lint": "node scripts/check-i18n-keys.mjs && oxlint ..."`）；`i18n:sync` **未接 CI** | `web/package.json:15, 37, 39`；`DESIGN-SYSTEM-AUTOMATION-STANDARD.md:147, 175` |
| 同步脚本 | `web/scripts/sync-i18n.mjs`：base locale **按叶子键数自动选取**（当前实测将选中 `zh.json`，7792 > `en.json` 7791；已提交的 `_reports/_sync-report.json` 仍记 `base: en.json`）；键集合取**并集**，只补键 + 重排，结构上不删键；缺键用 `en`（`FALLBACK_COMPARE_LOCALE`）补值；多余键进 `_extras`；未翻译项写 `_reports/<locale>.untranslated.json` | `web/scripts/sync-i18n.mjs:26, 128-149, 279-295, 303-316` |
| 未翻译存量 | `_reports/_sync-report.json` 记录：`en` 0、`fr` 70、`ja` 192、`ru` 192、`vi` 70、`zh-TW` 174、`zh` 162 | `web/src/i18n/locales/_reports/_sync-report.json` |
| 后端 locale | `i18n/locales/*.yaml` 共 7 份；`i18n.Init()` **只加载 `zh-CN.yaml` / `zh-TW.yaml` / `en.yaml` 三份**；`SupportedLanguages()` 返回 `[zh-CN zh-TW en]`。实测 `Translate("fr"/"ja"/"ru"/"vi", …)` **回落英文原文** | `i18n/i18n.go:44-56, 219-223`；只读运行核实 |
| 后端 yaml 键量 | `en` / `zh-CN` / `zh-TW` 各 **458** 键；`fr` / `ja` / `ru` / `vi` 各 **443** 键，缺 15 个 `email.*` 键（`email.binding.*` 6 个、`email.security_notice.*` 3 个、`email.security_event.*` 6 个） | 逐份解析核实 |
| 后端消息通道 | 后端以**英文原文**作 `message_key` + `message_params` 下发，前端 `getServerMessage` 用 `i18next.t(message_key, params)` 翻译 | `common/message.go:43-50`；`common/gin.go:275-289`；`web/src/lib/server-error-message.ts:163-176` |
| 运行时热加载 | 后端 `GET /api/i18n/:file` 暴露 locale JSON（文件名白名单 `en/zh/zh-TW/fr/ru/ja/vi.json`），依赖 `UTER_I18N_DIR`；前端 `runtime-locale.ts` 启动与切换语言时拉取并覆盖内置包 | `controller/i18n.go:35-43, 62-83`；`router/api-router.go:38`；`web/src/i18n/runtime-locale.ts:32-38, 97-133` |
| RTL | **无 RTL 语种**：7 locale 全为 LTR；但已有 `DirectionProvider`（cookie `dir`，默认 `ltr`）与 `ltr:`/`rtl:` 变体选择器 | `web/src/context/direction-provider.tsx:22-56`；`web/src/main.tsx:124` |
| 界面语言落库 | 用户语言偏好存 `setting.language`，取值形如 `en` / `zh-CN` / `zh-TW` / `fr` / `ja` / `ru` / `vi` | `relaykit/dto/user_settings.go:20` |

### 2.4 短信与站内通知

| 项 | 真实值 | 来源 |
|---|---|---|
| **短信网关** | **不存在**。全仓 `.go` / `.ts` / `.tsx`（排除测试文件与 `common/email_template.go` 的 base64 常量）检索 `\bSMS\b` / `短信` / `SendSms` / `twilio` / `aliyun.*sms` / `tencent.*sms` 命中 **0**；无 `model/`、无 `service/`、无 `controller/` 短信端点 | 只读检索核实 |
| 现有触达通道 | 邮件（`dto.NotifyTypeEmail`）、Webhook、Bark、Gotify 四种 | `relaykit/dto/user_settings.go:23-28`；`service/user_notify.go:69-120` |
| 站内通知 | `sonner` Toast / Snackbar、`ui/alert.tsx`、`components/notification-popover.tsx`（通知中心，含 Notice + Announcements 两 tab）、`components/{empty,loading,error}-state.tsx` | `UDS5-S20` §3；`web/src/components/notification-popover.tsx` |
| 站内公告 | 公告数据来自 `console_setting.GetAnnouncements()`，经 `GET /api/status` 的 `announcements` 字段下发 | `controller/misc.go:158-159` |

---

## 3. 范围与边界（邮件/短信与站内通知的分工）

| 维度 | 站内通知（`UDS5-S20`） | 邮件（本文） | 短信（本文，仅规范位） |
|---|---|---|---|
| 载体 | SPA 内浮层 / 通知中心 | 邮件客户端（HTML） | 运营商短信通道 |
| 触发 | 用户在当前会话内的操作结果 | 跨会话、需脱离浏览器的凭证与安全事件 | 跨会话、需即时到达的凭证 |
| 文案源 | 前端 `t()` + 7 份 locale JSON | 后端 `i18n.Translate` + `i18n/locales/*.yaml` | — |
| 反馈归属 | Toast / Alert / ErrorState / 通知中心；拦截器不弹 Toast，Mutation `onError` 负责 | 邮件模板 `BuildBrandEmailHTML` | — |
| 错误呈现 | 五类反馈 × 组件映射（`UDS5-S20` §4） | 安全通知 / 验证 / 账单类邮件 | — |
| 本册不覆盖 | Toast 时长、通知中心交互、`sonner` 用法 | 组件视觉、Token 值、页面布局 | provider 选型与实际发送 |

**归属判定规则**：一次操作**在当前页面内即可闭环** → 站内通知；一次操作**需要用户离开当前设备/会话**（登录、验证、重置、安全告警、额度告警）→ 邮件。同一事件两者并存时，各自文案源独立，**不得**互相 import，也**不得**把站内 Toast 文案直接塞进邮件正文。

---

## 4. 邮件结构

### 4.1 必备与禁用

| 位 | 规则 | 仓库落点 |
|---|---|---|
| 主题（Subject） | 必须存在且**唯一**；格式 = `<已本地化目的>-Uter.ai 优特智能`，由 `BrandEmailSubject` 生成，**不得**在调用方手工拼接后缀 | `common/email_template.go:14-16` |
| 发件人（From） | 显示名 = `SystemName`，地址 = `SMTPFrom`（可被多账号轮换覆盖）；SMTP 侧 `From: <SystemName> <smtpFrom>` | `common/email.go:127, 132`；`common/email_resend.go:45-47` |
| 预览文本（Preview text） | **规范要求**，仓库**未实现**：`BuildBrandEmailHTML` 无预映像文本 / 隐藏摘要块，客户端将回退显示正文首段 | `common/email_template.go:57-95`（无实现） |
| 主标题（Heading） | 必填，居中 `26px`；由调用方传入**已本地化**标题（与 Subject 同源） | `BrandEmail.Heading`；`common/email_template.go:82` |
| 正文（Paragraphs） | 必填段落数组；**空段落被跳过**，不留空 `<p>`；动态值由调用方**自行转义**（如 `html.EscapeString`） | `BrandEmail.Paragraphs`；`common/email_template.go:59-64` |
| 验证码（Code） | 可选；居中 `40px` 独立段，仅用于验证码类邮件；**不得**与链接混排 | `BrandEmail.Code`；`common/email_template.go:65-68` |
| 补充说明（Note） | 可选；用于时效 / 非本人操作提示；`14px` | `BrandEmail.Note`；`common/email_template.go:69-72` |
| 主操作 | 邮件**不设按钮式主操作**；主操作以正文锚点链接表达（链接统一去下划线 + 统一着色 `#1a73e8`） | `ensureLinkNoUnderline`；`common/email_template.go:34-46, 86` |
| 页脚 | 两行 `12px`：固定说明文案 + `© 2026 深圳优特网络有限公司`；**当前为硬编码中文**，不受语言影响 | `common/email_template.go:90-91` |
| 卡片 | `max-width: 600px`，描边 `1px #dadce0`，圆角 `8px`，内距 `40px 48px 36px` | `common/email_template.go:78` |
| 纯文本版本 | **规范要求**，仓库**未实现**：SMTP 侧只发 `Content-Type: text/html`，**无** `multipart/alternative` / `text/plain` 分支；Resend 侧 payload 只有 `html` 字段，**无** `text` 字段 | `common/email.go:131`；`common/email_resend.go:57-62` |
| 移动端 | `viewport` 已声明；单列表格布局，窄屏由 `max-width` + `padding` 兜底 | `common/email_template.go:75-76` |

### 4.2 邮件类型与调用点

| 类型 | 入口 | 语言来源 | Subject 键 |
|---|---|---|---|
| 注册/邮箱验证 | `controller/misc.go:245 SendEmailVerification` | 请求声明语言 | `email.verification.subject` |
| 密码重置 | `controller/misc.go:283 SendPasswordResetEmail` | 账号偏好 → 请求语言 | `email.password_reset.subject` |
| 登录验证码 | `controller/misc.go:338 SendLoginEmailCode` | 账号偏好 → 请求语言；被禁账号静默跳过 | `email.login_code.subject` |
| step-up 安全再验证 | `controller/secure_verification.go:162` → `service/security_verification.go:715` | 账号语言 | `email.step_up_code.subject` |
| 邮箱绑定确认 | `service/email_binding.go:198` | 传入 `lang` | `email.binding.subject` |
| 安全设置变更通知 | `service/account_security.go:45` | 账号语言 → 请求语言 | `email.security_notice.subject` |
| 通用通知（额度 / 通道 / 巡检） | `service/user_notify.go:125` | 调用方传入标题与正文 | 标题即 `purpose` |

> **能力开关事实**：`common.EmailCodeLoginEnabled` 与 `common.EmailVerificationEnabled` 默认均为 `false`（`common/constants.go:85-86`）；关闭时相关端点直接返回「已被管理员禁用」。邮件能力因此**不是默认开启**。

---

## 5. 邮件品牌与兼容

| 规则 | 内容 | 依据 |
|---|---|---|
| M-1 | 品牌名常量唯一来源为 `EmailBrandName`；**禁止**在发信处再写第二套品牌字符串 | `common/email_template.go:9` |
| M-2 | 邮件品牌名为**固定**「Uter.ai 优特智能」，**不做本地化**（与 Web 端 `localizedBrandName()` 的 `优特智能`/`優特智能`/`Uter.ai` 三态不同） | `common/email_template.go:9`；`web/src/lib/brand.ts:36-44` |
| M-3 | 邮件字体栈独立：`brandEmailFont`（Roboto → Helvetica Neue → Arial → PingFang SC → Hiragino Sans GB → Microsoft YaHei → sans-serif）。**不适用** `UDS5-S04` 的 Inter + Noto Sans SC，也不引用 `--ds-font-*` | `common/email_template.go:26`；`UDS5-S04` §2 |
| M-4 | 邮件最小字号 `12px`（页脚），满足 `UDS5-S04` 的 12px 可见文本下限；字号阶梯为邮件自有集合（26 / 14 / 12 / 40），与 `--text-*` 阶梯无映射关系 | `common/email_template.go:63-91` |
| M-5 | 邮件色值为硬编码，**不是** `--ds-*` 语义色：链接 `#1a73e8` ≠ 品牌主色 `#5B5EE6`（Light）/ `#8B8DF5`（Dark）。品牌 Token 变更**不会**传导到邮件 | `common/email_template.go:63-92`；`UDS5-S01` §4.2 |
| M-6 | Logo 必须 base64 内嵌（不依赖远程图片），`width=64 height=64`，`alt="Uter.ai"`；换站点 logo 时必须同步 `brandEmailLogoBase64`（有字节级测试守住） | `common/email_template.go:51, 80`；`common/email_template_test.go:79-91` |
| M-7 | 客户端兼容：全部样式内联；`ensureLinkNoUnderline` 强制去链接下划线；模板**不含** `@media` / `prefers-color-scheme` / `mso-` 条件注释（命中数 0），即**无暗色模式适配、无 Outlook 条件分支** | `common/email_template.go:34-46, 75-93` |
| M-8 | 重要信息不得仅靠背景图呈现：Logo 为装饰性识别，正文与验证码均为**文本**，图片关闭不影响可读 | `common/email_template.go:60-72` |
| M-9 | 邮件模板渲染**不引入任何依赖**（无模板引擎、无邮件 SDK）；新增模板能力一律在 `common/email_template.go` 内扩展 | `common/email_template.go` |

---

## 6. 短信结构（未实现）

> **状态：`NOT_IMPLEMENTED`。** 仓库无独立短信网关（§2.4 检索命中 0），因此本节**只保留规则位**，不写服务商、费率、模板、频次与通道参数。

| 编号 | 规则（未来接入时必须满足） | 当前状态 |
|---|---|---|
| SM-1 | 先表达品牌身份与消息目的，再给验证码或关键状态 | `NOT_IMPLEMENTED` |
| SM-2 | 必须说明验证码有效期与非本人操作的处理方式 | `NOT_IMPLEMENTED` |
| SM-3 | 不得在短信中放入完整密钥、密码或敏感账单详情 | `NOT_IMPLEMENTED` |
| SM-4 | 验证码 / 链接须有时效、一次性或重放防护（与 §7 同一套约束） | `NOT_IMPLEMENTED` |
| SM-5 | 链接使用可信 HTTPS 域名，避免开放重定向 | `NOT_IMPLEMENTED` |
| SM-6 | 内容不得泄露其他用户或组织数据 | `NOT_IMPLEMENTED` |
| SM-7 | 短信正文必须按用户语言本地化（7 locale 口径，见 §8） | `NOT_IMPLEMENTED` |

**接入前置条件**：必须先落地真实网关 + 发送端点 + 存储与频控 + 本地化资源，再依 §10 登记差异把本节从 `NOT_IMPLEMENTED` 迁移为正式规范；**本轮不写任何 provider 名称**。

---

## 7. 触达安全

| 编号 | 规则 | 仓库现状 / 落点 |
|---|---|---|
| SEC-1 | 验证码与重置链接**必须**有时效 | `VerificationValidMinutes = 10`；绑定码 `EmailBindingTTL = 10 * time.Minute` |
| SEC-2 | 校验成功即作废（一次性），杜绝 10 分钟内无限复用 | `VerifyCodeWithKey` 成功即 `delete` |
| SEC-3 | 重放 / 爆破防护 | 单 key 失败 5 次作废；常量时间比较；4 个 purpose 隔离（`v`/`r`/`l`/`s`） |
| SEC-4 | 不得在邮件 / 短信中发送密码、API Secret、完整密钥 | 模板无密码字段；重置流程的密码由**服务端生成后一次性回传**（`controller/misc.go:403-418`），不经邮件 |
| SEC-5 | 链接使用**可信** HTTPS 域名；避免开放重定向 | 重置链接域名单一取自服务端 `system_setting.ServerAddress`；链接内**不含**用户可控跳转参数；前端重置页只读 `email`/`token`，无 `redirect`/`next` 参数 |
| SEC-6 | 邮件不得泄露其他用户或组织数据 | 邮件正文只含**收件人本人**的验证码 / 链接 / 事件描述；账号安全通知的事件字段经 `html.EscapeString` 转义 |
| SEC-7 | 验证码 / 重置链接**不得**写入服务端错误信息与日志 | Resend 通道的注释与实现明确「不暴露凭据、验证码、重置链接」；失败原因只进服务端日志（`common/email_resend.go:36-39, 76-89`） |
| SEC-8 | 前端日志 / 埋点**不得**记录验证码 | 前端无埋点 SDK 接入记录；验证码只在请求体/链接中流转，页面不落日志 |
| SEC-9 | SMTP / Resend 凭据不得出现在邮件内容或设置回显中 | `SMTPAccounts` 整条剔除；视图层 `Token` 经 `MaskSecretValue` 掩码；Resend API Key 以「是否已配置」布尔位 + 仅新值输入框呈现 |
| SEC-10 | 发码频控 | IP 级 30 秒 2 次（`EmailVerificationRateLimit`）；重置发码另受 `CriticalRateLimit`（20 次 / 20 分钟）+ Turnstile |
| SEC-11 | 悬停账号不得触发发信 | `SendLoginEmailCode` 对非启用状态账号**静默跳过**（返回 `success: true` + 空 message），不泄露账号状态 |
| SEC-12 | 邮件不得引入第三方可追踪像素 | 模板内唯一图片为 base64 内嵌 Logo，无外链 `http(s)` 图片 |

> **合规边界**：SEC-1…SEC-12 为规范要求与仓库现状的对照，**未做独立安全审计**；本轮未运行任何后端测试。

---

## 8. 国际化实施

### 8.1 Locale 清单与标识

| 界面语言码 | locale 文件 | BCP 47（`toIntlLocale` 输出） | 后端 yaml | 后端 `SupportedLanguages()` |
|---|---|---|---|---|
| `en` | `en.json` | `en` | `en.yaml` | ✅ |
| `zhCN` | `zh.json` | `zh-CN` | `zh-CN.yaml` | ✅ |
| `zhTW` | `zh-TW.json` | `zh-TW` | `zh-TW.yaml` | ✅ |
| `fr` | `fr.json` | `fr` | `fr.yaml` | ❌ 未加载 |
| `ru` | `ru.json` | `ru` | `ru.yaml` | ❌ 未加载 |
| `ja` | `ja.json` | `ja` | `ja.yaml` | ❌ 未加载 |
| `vi` | `vi.json` | `vi` | `vi.yaml` | ❌ 未加载 |

> **重要口径差异**：**前端 7 locale 全量生效**；**后端邮件文案实际只支持 3 种**（`en` / `zh-CN` / `zh-TW`），`fr`/`ru`/`ja`/`vi` 请求在后端回落英文原文（`i18n.Init()` 只加载 3 份 yaml，`SupportedLanguages()` 只返回 3 项）。且磁盘上的 `fr/ja/ru/vi.yaml` 各缺 15 个 `email.*` 键（`email.binding.*`、`email.security_notice.*`、`email.security_event.*`）。详见 §10 S32-D05。

### 8.2 key 与占位符铁律

| 编号 | 规则 |
|---|---|
| I-1 | 所有用户可见文本必须进入 i18next 资源（前端 JSON / 后端 YAML），**禁止**在业务组件中散落硬编码文案 |
| I-2 | **key 即英文原文**（flat JSON，英文原文作键）；**禁止**以中文原文作为唯一 key；禁止用中文原文作为 `static-keys.ts` 登记项 |
| I-3 | 常量只存 i18n 键：`SUCCESS_MESSAGES` / `ERROR_MESSAGES` / `labelKey` 的值是**键**，展示必须 `t()`；禁止把常量当最终文案 |
| I-4 | 变量用**命名占位符**：前端 `{{count}}` / `{{model}}` / `{{max}}` / `{{error}}`；后端 `{{.SystemName}}` / `{{.Minutes}}` / `{{.Link}}`（go-i18n 模板语法）。禁止字符串拼接式插值 |
| I-5 | 复数 / 性别 / 上下文差异：仓库**当前无 ICU 插件**（`i18next-icu`、`intl-messageformat` 均不在 `web/package.json`），且 7 份 locale 的 `_one`/`_other`/`_plural` 键数量为 **0**。因此**现状口径**是：计数文案用 `{{count}}` + `t(key, { count })` 的**单数表述**；**不得**在无插件前提下声称已按 ICU MessageFormat 处理。引入 ICU 需先走依赖评审（本轮禁止引入依赖） |
| I-6 | **改文案必须同步 7 份 locale**（`en` / `zh` / `zh-TW` / `fr` / `ru` / `ja` / `vi`），缺一即不合规；`prop` / 变量形式的键（如 `t(option.labelKey)`）**同样必须同补 7 份** |
| I-7 | **非 `t('字面量')` 形式**的键（常量、props、配置）必须在 `web/src/i18n/static-keys.ts` 的 `STATIC_I18N_KEYS` 登记；`check-i18n-keys.mjs` 会把登记键一并纳入 7 份覆盖检查 |
| I-8 | `en` 键序保持历史插入序：**现状为「脚本自动选 base + 并集重排」**。`sync-i18n.mjs` 按叶子键数自动选 base，键集合取并集后按 base 顺序重排；已提交报告记 `base: en.json`，但按当前文件状态复算将选中 `zh.json`（7792 > 7791）。**在 base 归属变更前，不得声称 `en` 键序稳定** |
| I-9 | 后端邮件文案（`i18n/locales/*.yaml`）的键是**点分语义键**（如 `email.verification.subject`），与前端「英文原文作键」是两套体系，**不可互换** |

### 8.3 数字、货币、日期与时区

| 编号 | 规则 | 仓库落点 |
|---|---|---|
| I-10 | 普通数字 / 紧凑数字一律走 `@/lib/format` 的 `formatNumber` / `formatCompactNumber`，传 `toIntlLocale(i18n.resolvedLanguage \|\| i18n.language)` | `web/src/lib/format.ts:32-51` |
| I-11 | 金额、余额、额度走 `@/lib/currency`（`formatCurrencyFromUSD` / `formatQuotaWithCurrency` / `getCurrencyFractionDigits`），**保留币种与精度**；不得为统一调用方式改变显示精度 | `web/src/lib/currency.ts` |
| I-12 | 缩写不得造成结算歧义：Token 数量与费率的紧凑展示须同时可回溯精确值 | `formatCompactNumber` 仅用于概览位；明细位用 `formatNumber` |
| I-13 | 账单 / 订单 / 审计时间须展示精确时间与时区信息；账单时间字段使用 `Intl.DateTimeFormat` 并显式 `timeZone: 'UTC'` | `web/src/features/system-settings/models/billing-time-fields.tsx:128`；`web/src/features/pricing/lib/billing-expression/condition-display.ts:109` |
| I-14 | 时间**存储**用明确时区策略（UTC）；**展示**按用户 locale 与时区转换。前端日期格式化基线为 `dayjs`（`@/lib/dayjs`，仅扩展 `relativeTime`，**无 timezone 插件**） | `web/src/lib/dayjs.ts` |
| I-15 | 进入 `Intl.*` / `toLocale*` 的 locale 参数必须是合法 BCP 47；`zhCN` / `zhTW` 必须先经 `toIntlLocale()`；**禁止**自行编写中文语言码映射 | `web/AGENTS.md:76-78`；oxlint `project/intl-locale` |

### 8.4 布局与 RTL

| 编号 | 规则 | 仓库落点 |
|---|---|---|
| I-16 | 预留文本扩展空间；不得固定按钮宽度导致翻译截断；长词换行、姓名与地址长内容需可容纳 | `UDS5-S11` / `UDS5-S12` 约束；本册不新增数值 |
| I-17 | 逻辑属性优先（`start` / `end` / `ms` / `me` / `ps` / `pe`），不硬编码 `left` / `right` | `web/src/components/ui/sidebar.tsx` 等已用 `ms-`/`me-`/`start-` |
| I-18 | **当前 7 locale 无 RTL 语种**，故 RTL 本轮**不作为验收项**；`DirectionProvider` 与 `ltr:`/`rtl:` 变体为**已具备的基础设施**，不构成 RTL 内容能力 | `web/src/context/direction-provider.tsx`；`web/src/features/system-settings/general/...` 无 RTL 文案 |

### 8.5 验收口径（全部 `NOT_EXECUTED`）

| 编号 | 验收项 | 现状 |
|---|---|---|
| I-19 | 伪本地化检查 | **仓库无伪本地化实现**（无 pseudo-locale 资源、无伪本地化脚本） |
| I-20 | 长文本 / 不同小数分隔符 / 货币位置 / 时区跨日 / RTL / 缺失翻译检查 | 仅有 `check-i18n-keys.mjs`（缺键）与 `sync-i18n.mjs`（未翻译报告）两项静态覆盖，**其余无现成脚本** |
| I-21 | 7 份 locale 键集合一致性 | 现存 1 处不一致：`zh.json` 多出 `Invalid channel ID`（其余 6 份无），来源为后端 `controller/channel.go:498` 的英文错误串；`check-i18n-keys.mjs` **只查缺键、不查多余键**，故该差异不被门禁捕获 |

---

## 9. 禁止事项汇总

| 编号 | 禁止 |
|---|---|
| F-1 | 禁止在业务组件中硬编码用户可见文案；禁止把 i18n 常量当最终文案直接展示 |
| F-2 | 禁止以中文原文作为唯一 key；禁止把中文原文登记进 `static-keys.ts` |
| F-3 | 禁止只改 `en` 而不同步其余 6 份 locale；禁止让 `prop` / 变量形式键只存在于部分 locale |
| F-4 | 禁止把 `zhCN` / `zhTW` 直接传给 `Intl.*` / `toLocale*`；禁止自行编写语言码映射；禁止用 lint-disable 绕过 `project/intl-locale` |
| F-5 | 禁止用 `toLocaleString()` 手工拼数字 / 货币 / 日期格式代替 `@/lib/format` / `@/lib/currency` |
| F-6 | 禁止在邮件 / 短信中发送密码、API Secret、完整密钥 |
| F-7 | 禁止在邮件 / 短信中放入他人或他组织的数据 |
| F-8 | 禁止把验证码、重置链接写入服务端错误信息或日志；禁止在前端日志 / 埋点记录验证码 |
| F-9 | 禁止使用用户可控参数构造重定向目标；禁止在邮件链接中拼接非服务端配置的域名 |
| F-10 | 禁止在发信处自行拼接主题后缀（必须走 `BrandEmailSubject`）；禁止引入第二套品牌名 |
| F-11 | 禁止引入邮件模板引擎、邮件 SDK 或任何新依赖；禁止在邮件中引用 `--ds-*` / `--text-*` Token 或 Inter 字体 |
| F-12 | 禁止虚构短信服务商、费率、模板与频次；禁止把短信写成「已实现」 |
| F-13 | 禁止把站内通知文案与邮件文案混用同一常量或互相 import |
| F-14 | 禁止宣称任何邮件 / 短信 / i18n 行为已通过测试或平台验收 |

---

## 10. 差异与例外登记

| 编号 | 内容 | 状态 |
|---|---|---|
| **S32-D01** | **邮件预览文本未实现**：蓝图要求邮件含「预览文本」，仓库 `BuildBrandEmailHTML` 无预映像文本 / 隐藏摘要块，客户端将回退显示正文首段 | `NOT_IMPLEMENTED` / `NOT_VERIFIED` |
| **S32-D02** | **邮件纯文本版本未实现**：蓝图要求「HTML 邮件必须提供纯文本版本」，仓库 SMTP 侧只发 `Content-Type: text/html`（无 `multipart/alternative` / `text/plain`），Resend payload 只有 `html` 字段（无 `text`） | `NOT_IMPLEMENTED` / `NOT_VERIFIED` |
| **S32-D03** | **邮件品牌色非品牌 Token**：邮件链接色 `#1a73e8`、标题 `#202124` 等为硬编码，**不是** `UDS5-S01` §4.2 的品牌主色 `#5B5EE6`（Light）/ `#8B8DF5`（Dark）；邮件与 Web 品牌色**不同源**。规范按真值写「邮件自有色板」，不改代码值 | `REGISTERED` / `NOT_VERIFIED` |
| **S32-D04** | **邮件字体栈独立于 Web**：邮件用 `brandEmailFont`（Roboto 起），Web 端用 Inter + Noto Sans SC（`UDS5-S04`）。**邮件不受 Web 端 Token 约束**，Web 字体/字号变更不传导到邮件 | `ADOPT_REPO_TRUTH` |
| **S32-D05** | **后端邮件文案只支持 3 种语言**：`i18n.Init()` 只加载 `zh-CN` / `zh-TW` / `en` 三份 yaml，`SupportedLanguages()` 只返回这 3 项；实测 `fr`/`ru`/`ja`/`vi` 请求回落英文原文。磁盘上 `fr/ja/ru/vi.yaml` 各缺 15 个 `email.*` 键（`email.binding.*` 6、`email.security_notice.*` 3、`email.security_event.*` 6）。**前端 7 locale 全量生效**，前后端口径不一致 | `REGISTERED` / `NOT_VERIFIED` |
| **S32-D06** | **验证码形态三套**：登录 / step-up 为 `GenerateNumericCode(6)`（纯数字）；注册邮箱验证为 `GenerateVerificationCode(6)`（十六进制，含 a–f）；密码重置 token 为 `GenerateVerificationCode(0)`（32 位 hex）。蓝图只写「验证码」。规范按真值分三类登记 | `ADOPT_REPO_TRUTH` / `NOT_VERIFIED` |
| **S32-D07** | **邮件页脚与 `lang` 属性不本地化**：页脚两行固定中文、`html lang="zh-CN"` 硬编码，非中文收件人收到的邮件仍是中文页脚且 `lang` 不准 | `REGISTERED` / `NOT_VERIFIED` |
| **S32-D08** | **邮件无暗色模式 / Outlook 条件分支**：模板中 `@media` / `prefers-color-scheme` / `mso-` / 条件注释命中数 **0**，客户端兼容仅靠内联样式 + 表格布局 | `REGISTERED` / `NOT_VERIFIED` |
| **S32-D09** | **复数未按 ICU 实现**：蓝图要求「复数、性别或上下文差异按 ICU MessageFormat」，仓库**未接 ICU 插件**，7 份 locale 的 `_one`/`_other`/`_plural` 键数量为 0，实际用 `{{count}}` 单数表述。本册按真值写 §8.2 I-5，**不宣称已按 ICU 处理**；引入 ICU 需先走依赖评审 | `REGISTERED` / `NOT_VERIFIED` |
| **S32-D10** | **locale 键集合 1 处不一致**：`zh.json` 多出 `Invalid channel ID`（其余 6 份无），来源为后端 `controller/channel.go:498` 的英文错误串；`check-i18n-keys.mjs` 只查缺键、不查多余键，故不被门禁捕获 | `REGISTERED` / `NOT_VERIFIED` |
| **S32-D11** | **`sync-i18n.mjs` 的 base locale 会漂移**：base 按叶子键数自动选取；已提交的 `_reports/_sync-report.json` 记 `base: en.json`，但按当前文件状态复算将选中 `zh.json`（7792 > 7791）。一旦 base 变更，7 份 locale 的键序会被整体重排，**`en` 键序的「历史插入序」不成立**。本册登记 §8.2 I-8 的口径，**不改脚本** | `REGISTERED` / `NOT_VERIFIED` |
| **S32-D12** | **未翻译存量**：`_reports/_sync-report.json` 记录 `en` 0 / `fr` 70 / `ja` 192 / `ru` 192 / `vi` 70 / `zh-TW` 174 / `zh` 162 条未翻译 | `REGISTERED` / `NOT_VERIFIED` |
| **S32-D13** | **守卫测试计数**：`web/src/design-system/__tests__/` 实际为 **11 个** `*.test.ts`（含 `design-system-5-governance.test.ts`），与 `UDS5-S13` §4.1 均为 11 个，**差异在审计基线 `BASELINE-AUDIT` §12 记 10 个**（第 11 个为 5.0 建立时新增、未计入审计基线；`UDS5-S13` 已按 `S13-D13` 同步为 11 个，审计基线保持历史快照原样）。本文按真值写 11，**不改审计报告**（与 `UDS5-S29` 的 `S29-D07` 同源） | `REGISTERED` |
| **S32-D14** | **邮件相关守卫仅覆盖 Go 侧**：`verify-contrast.mjs` 只扫描 `web/src`，**不覆盖** `common/email_template.go` 的邮件色值；邮件正文 `#3c4043` / 标题 `#202124` 在白底上对比度充足，但页脚 `#80868b` 在白底上约 **3.68:1**、低于普通文本 4.5:1，且邮件不在任何对比度门禁范围内 | `REGISTERED` / `NOT_VERIFIED` |
| **S32-D15** | **本分册已登记入规范注册表**：`DESIGN-STANDARD-REGISTRY.yaml` 已补登 `UDS5-S32`（`category: business-vertical`，`dependencies` 含 S01 / S03 / S04 / S13 / S18 / S19 / S20 / S22）。**已执行** `bun run design:5:check`（`web/scripts/check-design-system-5.0.mjs`，**默认模式、不带 `--generate` / `--strict`**），结果 `verdict: PASS` / `errors: 0` / `checks: 7` / `checksPassed: 7` / `standards: 37` / `registeredDocIds: 37` / `scannedMarkdown: 35`——「文档 ID 反向登记」检查已通过。**该结论仅覆盖注册表与文档 ID 的结构一致性，不构成邮件 / 短信 / i18n 域的功能 / 视觉 / 门禁 / 平台验收**；`gaps: 74` 为组件级证据缺口，与本文无关。（只读性已核实：该脚本的 `writeFileSync` 仅存在于 `--generate` 分支，默认模式不写任何文件） | `CLOSED`（2026-11-14 只读实测 `errors: 0`；结构层 `PARTIALLY_VERIFIED`） |
| **S32-D16** | **无短信网关**：全仓短信相关检索命中 0；本册短信章节整节标 `NOT_IMPLEMENTED`，不写 provider | `NOT_IMPLEMENTED` |
| **S32-D17** | **邮件能力默认关闭**：`common.EmailCodeLoginEnabled` 与 `common.EmailVerificationEnabled` 默认 `false`；邮件能力**不是默认开启** | `ADOPT_REPO_TRUTH` |

---

## 与其他规范的关系

| 规范 | 关系 | 边界 |
|---|---|---|
| `UDS5-S01` | 效力来源 | 不重述总则；本文遵守其版本口径、效力层级与「文档存在不证明能力可用」原则 |
| `UDS5-S20` | **站内通知与站外触达的分工边界** | Toast / Snackbar / Alert / 通知中心 / 五类反馈 × 组件映射 / 错误提示归属（拦截器不弹 Toast 等）**全部在 S20**；本文只定义邮件 / 短信的结构与安全边界 |
| `UDS5-S04` | 字体与字号 | Web 端 Inter + Noto Sans SC、12px 下限、字号阶梯**只约束 Web**；**邮件为独立字体栈，不受本规范 Token 约束**（S32-D04） |
| `UDS5-S02` | 品牌基线 | 品牌主色与 `localizedBrandName()` 三态**约束 Web**；邮件品牌名固定「Uter.ai 优特智能」，**不做本地化**（S32-D07） |
| `UDS5-S13` | 无障碍 | 12px 可见文本下限、对比度阈值**约束 Web**；邮件的对比度与色值**不在 `verify-contrast.mjs` 扫描范围**（S32-D14） |
| `UDS5-S25` | 验收状态机 | 本册所有验证项按其八状态口径标注 `NOT_VERIFIED` / `NOT_EXECUTED`；本文**不产生任何验收结论** |
| `UDS5-S18` | 表单级错误与 i18n 同步 | 字段级错误、`handleServerError`、7 locale 同步口径在 S18；本文补「站外触达」的文案与同步特例 |
| `UDS5-S17` | 交互五态 | 反馈通道矩阵在 S17；邮件 / 短信不在其通道矩阵内 |
| `UDS5-S24` | 自动化治理 | i18n 门禁接线状态在 S24（`i18n:check` 已接 lint、`i18n:sync` 未接 CI）；本文给出两脚本的准确职责边界 |
| `UDS5-S28` | 废弃治理 | 本册的 `NOT_IMPLEMENTED` 位（短信、预览文本、纯文本版本）按其口径登记例外，不冒充已实现 |
| `UDS5-S29` / `UDS5-S30` / `UDS5-S31` | 认证 / 用户 / 组织与账单 | 这些分册中的验证码、邮箱绑定、密钥掩码、通知偏好与本文的触达规则**必须一致**；冲突时以 `UDS5-S01` 效力层级为准 |
| `web/AGENTS.md` | **强制上位约束**：§3.1 国际化（key 即英文原文、`toIntlLocale` 强制、`project/intl-locale`）、§3.9 错误处理、§3.13 安全、§3.14 测试 | 冲突时以 `web/AGENTS.md` 为准 |
| `AGENTS.md` | **强制上位约束**：`## Internationalization (i18n)` 明确「flat JSON, keys are English source strings」 | 与 `web/AGENTS.md` §3.1 的「有层级、语义清晰的键名」示例表述不一致时，以本文 §8.2 I-2（英文原文作键，仓库真源）与 `AGENTS.md` 为准 |

---

## 代码实施位置

| 用途 | 真实路径 | 本轮动作 |
|---|---|---|
| 邮件发送与传输 | `common/email.go`（`SendEmail` / `resolveSMTPSender` / `newSMTPClient`） | **只读** |
| 邮件模板与品牌 | `common/email_template.go`（`EmailBrandName` / `BrandEmailSubject` / `BrandEmail` / `brandEmailFont` / `ensureLinkNoUnderline` / `brandEmailLogoBase64` / `BuildBrandEmailHTML`） | **只读** |
| Resend 通道 | `common/email_resend.go` | **只读** |
| SMTP 认证 | `common/email_ntlm_auth.go`、`common/email-outlook-auth.go` | **只读** |
| 多账号与配额 | `common/smtp_accounts.go`、`service/smtp_accounts.go`、`model/email_quota.go` | **只读** |
| 凭据掩码 | `common/secret_mask.go`、`common/secret_option_keys.go` | **只读** |
| 发信入口（controller） | `controller/misc.go`（`SendEmailVerification` / `SendPasswordResetEmail` / `SendLoginEmailCode`）、`controller/secure_verification.go`（`SendVerificationEmailCode`）、`controller/option.go`（`buildSMTPAccountsViewValue`） | **只读** |
| 发信入口（service） | `service/user_notify.go`、`service/email_binding.go`、`service/account_security.go`、`service/security_verification.go` | **只读** |
| 验证码与限流 | `common/verification.go`、`middleware/email-verification-rate-limit.go`、`middleware/rate-limit.go`、`model/email_binding.go` | **只读** |
| 后端 i18n | `i18n/i18n.go`、`i18n/keys.go`、`i18n/locales/{en,fr,ja,ru,vi,zh-CN,zh-TW}.yaml` | **只读** |
| 前端 i18n | `web/src/i18n/{config,languages,locale-loaders,runtime-locale,static-keys}.ts`、`web/src/i18n/locales/{en,fr,ja,ru,vi,zh-TW,zh}.json` | **只读** |
| 格式化 | `web/src/lib/format.ts`、`web/src/lib/currency.ts`、`web/src/lib/dayjs.ts`、`web/src/lib/brand.ts` | **只读** |
| i18n 门禁与同步 | `web/scripts/check-i18n-keys.mjs`、`web/scripts/sync-i18n.mjs`、`web/scripts/oxlint/intl-locale.mjs` | **只读** |
| 错误消息翻译通道 | `common/message.go`、`common/gin.go`、`web/src/lib/server-error-message.ts` | **只读** |
| 运行时 locale 接口 | `controller/i18n.go`、`router/api-router.go` | **只读** |
| 守卫测试 | `web/src/design-system/__tests__/`（**11 个** `*.test.ts`）、`common/email_template_test.go`、`common/email_coverage_test.go`、`common/email_test.go`、`i18n/i18n_test.go`、`i18n/i18n_integrity_test.go`、`web/src/i18n/__tests__/`（5 个） | **只读** |
| 规范输出 | `docs/design-system/uter-design-system-5.0/COMMS-AND-LOCALIZATION-STANDARD.md` | **本文件（新建）** |

> 未列出的路径、脚本与测试结果不出现于本规范；不宣称已运行门禁或回归。

---

## 自动化验证

| 验证项 | 真实命令 / 门禁 | 关联 | 说明 |
|---|---|---|---|
| i18n 键覆盖 | `bun run i18n:check`（`web/scripts/check-i18n-keys.mjs`）；亦被 `bun run lint` 前置调用 | §8.2 I-2 / I-6 / I-7 / §8.5 I-21 | 只覆盖**源码静态 `t()` 键** + `static-keys.ts` 登记键；模板字符串、运行时拼接、变量传入键**扫不到**，需人工同步；**只查缺键不查多余键** |
| i18n 同步 | `bun run i18n:sync`（`web/scripts/sync-i18n.mjs`） | §8.2 I-8 / §10 S32-D11 / S32-D12 | base 按叶子键数自动选取；键集合取并集；**未接 CI**；本轮未执行 |
| Intl 语言参数 | `bun run lint` 内的 `project/intl-locale`（`web/scripts/oxlint/intl-locale.mjs`） | §8.2 I-15 / §8.3 I-10 | error 级；检查原始 `language`/`resolvedLanguage`、本地变量别名与非法固定标签 |
| 类型 / Lint / 构建 | `bun run typecheck` / `bun run lint` / `bun run build:check` | 全文 | 本轮未执行 |
| 设计 Token 门禁 | `bun run lint:design:strict`（T1–T17） | §5 M-5 | **只覆盖 `web/src`**，不覆盖 `common/email_template.go` 的邮件色值与字号（S32-D14） |
| 对比度门禁 | `bun run verify:contrast` | §10 S32-D14 | 扫描范围为 `web/src`，**邮件不在其中**；本轮未执行 |
| 规范 / 注册表一致性 | `bun run design:5:check`（`web/scripts/check-design-system-5.0.mjs`） | §10 S32-D15 | 含「文档 ID 反向登记」；**本分册 `UDS5-S32` 已登记入注册表**，2026-11-14 实测 `verdict: PASS` / `errors: 0`（见 S32-D15） |
| 注册表严格模式 | `bun run design:5:strict` | §10 | 已知缺口升级为失败；本轮未执行 |
| 邮件单测 | `go test ./common/...`（`email_template_test.go` 5 例 / `email_coverage_test.go` 1 例 / `email_test.go` 14 例）、`go test ./i18n/...` | §2.1 / §2.2 | 本轮未执行；不宣称任何用例通过 |
| 守卫测试 | `bun run test`（Vitest） | 全文 | `web/src/design-system/__tests__/` 11 个 + `web/src/i18n/__tests__/` 5 个 + `web/src/i18n/languages.test.ts`；本轮未执行 |
| 无障碍 / 视觉回归 | `bun run test:axe` / `test:visual` / `test:visual:e2e` | §5 M-7 | 刻意不接 CI；本轮未执行 |
| 邮件客户端矩阵 | **无现成脚本** | §4.1 / §5 M-7 / §6 | Gmail / Outlook / Apple Mail / 移动客户端、暗色模式、图片关闭、纯文本、链接域名、验证码过期、本地化的**跨客户端验收在仓库中无自动化手段** |
| 伪本地化 / RTL 验收 | **无现成脚本、无 RTL 资源** | §8.4 I-18 / §8.5 I-19 | 不可判定 |

---

## 验证状态

| 项 | 状态 | 依据 / 备注 |
|---|---|---|
| 本分册文本 | `ACTIVE` | 已撰写，供评审；未修改任何代码 |
| 文档 ID / 版本 / 状态 | `UDS5-S32` / `5.0.0` / `ACTIVE` | **已登记入 `DESIGN-STANDARD-REGISTRY.yaml`**（S32-D15 已闭合） |
| 邮件结构规则（§4） | `NOT_VERIFIED` | 规范层定义；结构数值引自 `common/email_template.go` 只读核实，**未做跨客户端渲染复核** |
| 邮件品牌与兼容（§5） | `NOT_VERIFIED` | 字体栈 / 色值 / logo 为只读核实；**未执行**客户端矩阵与暗色模式检查 |
| 邮件预览文本 / 纯文本版本 | `NOT_IMPLEMENTED` | S32-D01 / S32-D02；仓库无对应实现 |
| 触达安全规则（§7） | `NOT_VERIFIED` | 引自 `common/verification.go` / `middleware/*` / `common/email_resend.go` 只读核实；**未做独立安全审计、未运行任何后端测试** |
| 短信能力（§6） | `NOT_IMPLEMENTED` | 仓库无短信网关（S32-D16）；**无 provider 可写、无短信验收项** |
| i18n 铁律（§8.2） | `NOT_VERIFIED` | 7 份 locale 与 `static-keys.ts` 已 ls / 解析核实；**未运行 `i18n:check`**，不宣称一致 |
| 7 份 locale 键集合一致性 | `NOT_VERIFIED` | 实测存在 1 处不一致（S32-D10：`zh.json` 多 1 键），门禁不覆盖该方向 |
| 复数 / ICU（§8.2 I-5） | `NOT_IMPLEMENTED` | 无 ICU 插件、无 `_one`/`_other` 键（S32-D09）；**不得宣称已按 ICU 处理** |
| 数字 / 货币 / 时区（§8.3） | `NOT_VERIFIED` | 引自 `@/lib/format`、`@/lib/currency`、账单时间字段只读核实；**未跑数值与时区回归** |
| RTL（§8.4） | `NOT_VERIFIED` | 7 locale 无 RTL 语种；基础设施存在但**未验证**渲染结果 |
| 伪本地化 / 长文本 / 跨时区验收（§8.5） | `NOT_EXECUTED` | 仓库无对应脚本与资源 |
| 邮件相关 Go 单测 | `NOT_EXECUTED` | 本轮未运行 `go test`；**不宣称任何用例通过** |
| 守卫测试 11 个 / i18n 测试 6 个 | `NOT_EXECUTED` | 已 ls 核实数量；**未执行** |
| `i18n:check` / `i18n:sync` / `lint` / `typecheck` / `build:check` | `NOT_EXECUTED` | 本轮未运行任何门禁 |
| `design:5:check` | **2026-11-14 已执行：`verdict: PASS` / `errors: 0` / `checksPassed: 7`**（`UDS5-S32` 已登记，见 S32-D15） | 注册一致性结构层达 `PARTIALLY_VERIFIED`（脚本字面 `verdict: PASS`，不转写为业务验收结论）；本文其余验证项仍为 `NOT_VERIFIED` / `NOT_EXECUTED` |
| 邮件客户端矩阵验收（Gmail / Outlook / Apple Mail / 移动端） | `NOT_EXECUTED` | 无现成脚本 |
| PC Web / H5 平台 | `NOT_VERIFIED` | 未针对 5.0 重跑回归 |
| Android / iOS / HarmonyOS | `NOT_VERIFIED` | 无真实实现（决策 D4），不得用 Web 结果代替 |

**结论**：本分册为规范声明，所有验证项均为 `NOT_VERIFIED` / `NOT_EXECUTED` / `NOT_IMPLEMENTED`，**未勾选任何测试通过或平台验收**；短信能力按仓库事实标 `NOT_IMPLEMENTED`，**不提供任何 provider 选型**。
