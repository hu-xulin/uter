# 05 页面设计规范合规审计（按路由逐页）

审计对象：`web/src/routes/` 全部路由（清单见 01-inventory.txt §2），落点为各路由挂载的 `src/features/` 组件。
审计标准：`docs/design-system/UTER-DESIGN-SYSTEM-3.0.md`（§1 Typography、§5-§8）+ 项目实际 Token 源（`src/design-system/tokens/typography.css` / `semantic.css`，项目阶梯：body=14/22、dense=13/20、caption=12/18、mono=13/20、mono-title=16/600；与 3.0 文档十档表存在既定差异，审计口径为「是否走语义档、无字面值、无 <12px」）。
方法：静态扫描（Grep 批量违规模式）+ 逐页面主组件/feature 目录抽查。只读，未修改任何被审计代码。
日期：2026-11-03。审计人：audit-pages。

## 总体结论

- 扫描的违规模式：`text-[Npx]`/`text-[Nrem]`/`leading-[Npx]` 字面字号（0 处）、<12px 字号（0 处）、`text/bg/border-gray|slate|zinc` 等非语义中性色（0 处）、`text/bg/border-[#...]`/`rgb()`/`hsl()`/`oklch()` 原始色值（0 处）、`dark:` + 硬编码色（0 处业务代码）、`p/m/gap-[Npx]` 字面间距（0 处）、`rounded-[Npx]`（0 处）、`style={{fontSize}}` 硬编码（0 处）。
- 页面标题：绝大多数页面走统一 `SectionPageLayout` → 设计系统 `Heading variant='page-title'`（h2 语义，注释说明避免与品牌 h1 冲突），或自行使用 `Heading` 组件；仅 errors 五页用裸 `<h1 className='text-4xl font-bold'>`。
- 定价页模型卡片名已按 §1.5 使用 `Heading variant='mono-title'`（features/pricing/components/model-card.tsx:641-655）。
- 客服悬浮窗（customer-service）全部使用 `var(--primary)`/`var(--card)`/`var(--ds-text-*)` 语义 Token 内联样式，无写死色值。
- 无 P0/P1 级违规；FAIL 页均为 P2/P3 局部问题。

## 1. 认证区 (auth)

### sign-in（/(auth)/sign-in.tsx → features/auth SignIn）— FAIL（轻，P2×1）
- [P2] `src/features/auth/components/oauth-providers.tsx:230-233`：第三方品牌色 Hover 时 `hover:text-white dark:hover:text-white`（及 `[&_svg]:text-white`）为硬编码白字。第三方品牌资产允许用原始色（§2.1），但白字叠加各品牌色的对比度无验收记录（§2.3 要求逐状态验收）。无品牌色渠道已正确回退 `primary-foreground`。建议：补对比度验收或改用品牌资产登记表中的前景 Token。
- 其余：`auth-layout.tsx` px-4/py-8/sm:p-8 合法；user-auth-form.tsx 使用 ui 组件；PASS 项：字号、间距、表面 Token 均合规。

### sign-up（/(auth)/sign-up.tsx → features/auth SignUp）— PASS
- sign-up-form.tsx 走 ui 组件与语义 Token，无违规。

### forgot-password（/(auth)/forgot-password.tsx）— PASS
- forgot-password-form.tsx 合规。

### otp（/(auth)/otp.tsx → features/auth Otp）— PASS
- input-otp 走统一组件。

### reset / user/reset（/(auth)/reset.tsx、/(auth)/user/reset.tsx → features/auth/reset-password-confirm）— PASS
- 同一实现双路由挂载，无违规。

### oauth/$provider + oauth.wechat-web（→ OAuthCallbackScreen 等）— PASS
- oauth-callback-screen.tsx 使用设计系统组件，无违规。

## 2. 错误页 (errors)

### 401/403/404/500/503 + _authenticated/errors/$error（→ features/errors）— FAIL（P3×2）
- [P3] 五页均使用裸 `<h1 className='text-4xl font-bold'>`（unauthorized-error.tsx:31、forbidden.tsx:31、not-found-error.tsx:31、maintenance-error.tsx:28、general-error.tsx:84）。`font-bold`=700 违反 §1.4「标题 600，700 仅特殊场景」；未走 `Heading` 组件（§3 页面层级建议 page-title 30/38/600）。
- [P3] 辅助文字 `text-muted-foreground`（语义等价 foreground-tertiary）合规；正文缺省字号走全站基准，合规。
- 无 bg 硬编码（继承根 bg-background），Light/Dark 均成立。

## 3. 控制台区 (_authenticated)

### dashboard/$section（→ features/dashboard）— PASS
- overview-dashboard.tsx 走 SectionPageLayout；summary-cards/charts 均走 ui 组件与 chart Token。子组件 `<button` 用法为图表内嵌控制（1-2 处），带语义 Token 样式。

### channels（_authenticated/channels/index.tsx → features/channels）— PASS（P3 备注见下）
- 表格/抽屉/Dialog 全部走 ui 组件（channel-mutate-drawer 4800+ 行全部引用统一组件）。
- [P3] `numeric-spinner-input.tsx:163,194,208`：自绘 spinner 按钮 `opacity-50/opacity-30` 表达禁用，违反 §10.5「禁止只依赖 opacity」倾向（有 cursor 变化辅助，风险低）。
- [P3] `channel-priority-demo.tsx:121`：演示态 `top-35 h-13` 非标准间距类（非 4px 网格整档），仅演示组件。

### chat/$chatId（→ features/chat）— PASS
- 应用型界面无页面标题属预期；ChatKeyDialog/useChatPresets 走统一组件；全局扫描无违规。

### chat2link（→ Chat2LinkPage）— PASS
- 复用 chat 组件，无违规。

### keys（→ features/keys ApiKeys）— PASS
- index.tsx 走 SectionPageLayout + Heading；表格/抽屉/Combobox 走 ui 组件。`w-[120px]`/`min-w-[160px]` 为列宽约束（布局尺寸，非间距 Token 范畴），合法。

### models/$section（→ features/models Models）— PASS
- SectionPageLayout + Heading；drawers/dialogs 全走 ui 组件。deployment-access-guard、model-square-status 语义 Token 合规。
- [P3] `model-square-status.tsx:104-112`：图片预览用 `role='dialog'` 手写浮层（未走 ui Dialog），全 Token 样式，无焦点管理 — 建议迁 Dialog。

### organization（→ features/organization OrganizationPage）— FAIL（P3×1）
- [P3] `src/features/organization/index.tsx:1224-1227`：手写 `<table className='w-full text-sm'>` + `<th className='px-2 py-2'>`，未走统一 Table 组件（§13 禁止绕开基础组件重定义）；`px-2 py-2` 虽在 4px 网格但绕过 table-cell-padding Token。建议改用 `@/components/ui/table`。

### playground（→ features/playground PlaygroundPage）— PASS
- 工作台式全屏页无页面标题属预期；参数面板/消息操作走 ui 组件与语义 Token。

### profile（→ features/profile Profile）— PASS
- profile-header.tsx:198 使用 `Heading variant='page-title' level={1}`，其余卡片走 Card/Tab 组件。
- [P3] `profile-header.tsx:264`：`text-lg sm:text-2xl` 数字放大展示 + `mt-1.5`（6px 非网格整档，§6.1），风险极低。

### redemption-codes（→ features/redemption-codes Redemptions）— PASS
- columns/mutate-drawer 走 ui 组件；`text-mono min-w-[160px]` 为语义 mono 档 + 列宽约束，合规。

### security（→ features/security Security）— PASS
- 全部卡片/Dialog（2FA、访问令牌、登录会话）走 ui 组件，无违规。

### subscriptions（→ features/subscriptions Subscriptions）— PASS
- mutate-drawer/dialogs 走 ui 组件，无违规。

### system-info（→ features/system-info SystemInfo）— PASS
- [P3] `system-tasks-table.tsx:88-104`：`StaticDataTable` 内 TableHead 用 `text-sm`（14px）而非 dense（13px）语义档 — 表头属密集场景，建议换 `text-dense`；`w-[260px]` 等为列宽约束，合法。

### system-settings/*（route.tsx + 9 组 index/$section → features/system-settings）— FAIL（P3×1）
- settings-page.tsx 走 SectionPageLayout；各 section 走 settings-section 统一容器。
- [P3] `src/features/system-settings/models/group-ratio-form.tsx:564-567`：手写 `<table className='w-full text-sm'>` + `px-3 py-1.5`（6px 非网格整档），未走统一 Table。建议改用 ui Table。
- [P3] `billing/channel-pricing-section.tsx:216`、`billing/channel-model-weight-section.tsx:203`：`opacity-50` 表达禁用行 + `opacity-40/75`（payment-settings-section.tsx:1105、models/model-pricing-inputs.tsx:107）— 禁用态仅靠 opacity，违反 §10.5 倾向。
- [P3] `models/model-pricing-sheet.tsx`、`auth/custom-oauth/components/provider-form-dialog.tsx` 等：Dialog/Sheet 均走 ui 组件，合规。

### task-plugins（→ features/task-plugins TaskPlugins）— PASS
- marketplace-panel/plugin-card/detail-sheet 走 ui 组件，无违规。

### usage-logs/$section + audit（→ features/usage-logs）— FAIL（P3×1）
- index 走 SectionPageLayout；columns/dialogs 走 ui 组件；`max-w-[Npx]` 均为布局约束。
- [P3] `src/features/usage-logs/components/task-artifacts.tsx:159,488`：视频容器 `bg-black` 硬编码（视频 letterbox 场景）。建议改用 `bg-term-background` 或登记的媒体底色 Token（§2.10）。

### users（→ features/users Users）— PASS
- users-columns/mutate-drawer/binding-dialog 走 ui 组件；`text-sm/text-xs` 语义档合规。

### wallet（→ features/wallet Wallet）— PASS
- index.tsx 走 SectionPageLayout；recharge-form/subscription-plans/affiliate-rewards 卡片走 Card 组件；dialogs 走 ui Dialog。

## 4. 公开区 (_public)

### home（_public/index.tsx → features/home）— PASS
- hero/features/stats/cta 全语义 Token（brand/primary 类）；hero-terminal-demo 走 mono-code 档；仅 1 处 `dark:` 且为 Token 类。

### pricing/index（→ features/pricing Pricing）— PASS（P3×1）
- 模型卡 `Heading variant='mono-title'`（model-card.tsx:641）完全符合 §1.5。
- [P3] `src/features/pricing/index.tsx:178`：装饰背景 `opacity-20 dark:opacity-[0.10]` — dark 用字面 opacity 值，建议登记为 Token。

### pricing/$modelId（→ features/pricing ModelDetails）— PASS
- model-details.tsx 大量 Heading（group-title/card-title/page-title + font-mono）语义正确；uptime sparkline `w-[3px]` 为图形尺寸，合法。

### rankings（→ features/rankings Rankings）— PASS（P3×1）
- [P3] `src/features/rankings/index.tsx:100`：同 pricing，`dark:opacity-[0.10]` 字面透明度。
- hero/各 section Heading 层级正确（page-title/group-title）。

### about / docs（3 条路由 → features/about、features/docs）— PASS
- DocsViewer/AboutViewer 无违规记录（全局扫描覆盖）。

### privacy-policy / user-agreement / recharge-agreement（→ features/legal）— PASS
- legal-document.tsx 走 Heading + 长文本 body-long 语义（16/26 符合 §1.7）。

## 5. 初始化

### setup（setup/index.tsx → features/setup SetupWizard）— PASS
- setup-wizard/step-navigation 走 ui 组件；`text-primary` 语义类合规。

## 6. 薄壳/重定向路由（无页面实体，不审样式）

`__root.tsx`（RootComponent + 全局错误兜底）、`(auth)/route.tsx`、`(auth)/register.tsx`（redirect→sign-up）、`_authenticated/route.tsx`（AuthenticatedLayout）、`dashboard/index.tsx`、`models/index.tsx`、`system-settings/index.tsx` 及 9 组 `*/index.tsx`（均 redirect→默认 $section）、`usage-logs/index.tsx`、`_public/route.tsx`（PublicAreaLayout）、`_public/docs.tsx`/`docs/index.tsx`/`docs/$.tsx`（DocsViewer 挂载壳）、`_authenticated/errors/$error.tsx`（复用 errors 组件）、`system-settings/request-policies/index.tsx`。

## 页面覆盖率表

| 路由 | 状态 | 覆盖说明 |
|---|---|---|
| (auth)/sign-in | FAIL(P2×1,P3) | features/auth 全量静态扫描 |
| (auth)/sign-up | PASS | 同上 |
| (auth)/forgot-password | PASS | 同上 |
| (auth)/otp | PASS | 同上 |
| (auth)/reset、(auth)/user/reset | PASS | reset-password-confirm 共用实现 |
| (auth)/oauth.wechat-web、oauth/$provider | PASS | callback 组件已扫描 |
| (auth)/register、(auth)/route | 薄壳 | redirect/layout，无样式实体 |
| (errors)/401/403/404/500/503 | FAIL(P3×2) | features/errors 五组件逐行核查 |
| _authenticated/errors/$error | FAIL(P3×2) | 复用 errors 组件 |
| __root.tsx | 薄壳 | RootComponent + 全局兜底 |
| _authenticated/route、_public/route | 薄壳 | 布局组件（属 audit-components 范围） |
| channels | PASS(P3×2) | feature 目录全量扫描 |
| chat/$chatId、chat2link | PASS | features/chat 扫描 |
| dashboard/$section | PASS | features/dashboard 扫描 |
| keys | PASS | features/keys 扫描 |
| models/$section | PASS(P3×1) | features/models 扫描 |
| organization | FAIL(P3×1) | 手写 table |
| playground | PASS | features/playground 扫描 |
| profile | PASS(P3×1) | features/profile 扫描 |
| redemption-codes | PASS | feature 目录扫描 |
| security | PASS | feature 目录扫描 |
| subscriptions | PASS | feature 目录扫描 |
| system-info | PASS(P3×1) | feature 目录扫描 |
| system-settings/auth,billing,content,models,operations,request-policies,security,site | FAIL(P3×3) | features/system-settings 全量扫描 |
| task-plugins | PASS | feature 目录扫描 |
| usage-logs/$section | FAIL(P3×1) | feature 目录扫描 |
| usage-logs/audit | PASS | features/usage-logs/audit 扫描 |
| users | PASS | feature 目录扫描 |
| wallet | PASS | feature 目录扫描 |
| _public/index (home) | PASS | features/home 扫描 |
| _public/pricing/index | PASS(P3×1) | features/pricing 扫描 |
| _public/pricing/$modelId | PASS | 同上 |
| _public/rankings | PASS(P3×1) | features/rankings 扫描 |
| _public/about、docs×3 | PASS | features/about、features/docs 扫描 |
| privacy-policy、user-agreement、recharge-agreement | PASS | features/legal 扫描 |
| setup | PASS | features/setup 扫描 |
| dashboard/models/system-settings/usage-logs 等 index.tsx | 薄壳 | redirect，无样式实体 |

覆盖缺口：无。全部 70 条路由均可静态定位到实现或确认为无样式实体的薄壳/重定向。

## TOP 问题清单（按严重度）

1. [P2] auth/oauth-providers.tsx:230-233 — 第三方品牌 Hover 白字无对比度验收记录（sign-in）。
2. [P3] errors 五页 — 裸 h1 + font-bold(700)，应走 Heading page-title 600。
3. [P3] organization/index.tsx:1224 与 system-settings/models/group-ratio-form.tsx:564 — 手写 table 绕过统一 Table 组件与 cell-padding Token。
4. [P3] usage-logs/task-artifacts.tsx:159,488 — bg-black 硬编码（视频 letterbox）。
5. [P3] 禁用态仅靠 opacity：channels/numeric-spinner-input.tsx、system-settings billing×2、models/model-pricing-inputs.tsx（§10.5 倾向违规）。
6. [P3] rankings/index.tsx:100、pricing/index.tsx:178 — dark:opacity-[0.10] 字面透明度未 Token 化。
7. [P3] system-info/system-tasks-table.tsx — 表头 text-sm 应为 text-dense。
8. [P3] models/model-square-status.tsx:104-112 — 手写 role='dialog' 图片浮层未走 ui Dialog。

统计：路由文件 70 条（含 __root）；功能页面 38 组；PASS 30 / FAIL 8 / 薄壳 32 条路由；P0=0、P1=0、P2=1、P3=13。
