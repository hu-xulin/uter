# CLERK-DESIGN-REFERENCE-STANDARD — Clerk 外部设计参考规范

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S21` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01` |
| 生效日期 | `2026-11-14` |
| 适用范围 | UTER Design System 5.0 全体规范、PC Web / H5 前端视觉与组件设计、认证 / 账户 / 组织相关页面的信息架构参考；不适用于后端认证、资金、授权逻辑 |
| 验证状态 | `NOT_VERIFIED`（本规范为参考与治理类文档，未执行代码改造与自动化验证） |

---

## 1. 文档定位与效力

1. **Clerk 仅为外部设计参考**。本文记录 Clerk 官方设计体系中可被 Uter 借鉴的「理念、信息架构、状态完整性」经验，用于改进 Uter 自有设计系统的组织方式与组件规范；Clerk **不是** Uter 5.0 的规范来源、不是依赖、不是运行时组件、也不是验收基准。
2. Uter 5.0 的唯一权威规范是 `UDS5-S01` 及其下 `UDS5-S02`..`UDS5-S28` 分册；任何与本文冲突之处，以 Uter 自有规范为准。
3. 本文事实依据为 `audit/CLERK-DESIGN-REFERENCE-ANALYSIS.md`（`UDS5-AUDIT-02`，首轮 9 个官方文档来源逐页核实）与 §2.4 本轮补充核对的 4 个官方来源（合计 13 个）与 `audit/BASELINE-AUDIT.md`（`UDS5-AUDIT-01`）；**不使用截图、旧教程、第三方解读作为事实来源**。
4. 本文只描述「借鉴什么、禁止什么、落到哪里」，不声明任何 Uter 代码已实现；所有 `代码实施位置` 与 `测试证据` 均标注当前状态，未执行项一律 `NOT_VERIFIED`。

---

## 2. 事实边界（基于已核实事实，禁止越界描述）

### 2.1 时效性与架构硬事实（必须如实写入规范）

| # | 事实 | 核实来源 | 对 5.0 的约束 |
|---|---|---|---|
| F1 | **Clerk Elements 已弃用**：随 **Clerk Core 3（2026-03-03）** 发布，官方页标题为「Clerk Elements, Deprecated」，推荐改用 redesigned hooks（stateful objects / step methods / structured field-level errors），历史上仅支持 Next.js App Router + Core 2 | `UDS5-AUDIT-02` §1 来源 7、§5 结论 3 | 5.0 **不得**把 Elements 当作现行 API 引入、不得描述为可依赖的定制路径；只借鉴其「分层定制 / 组合」理念（见 §4.3） |
| F2 | **localization prop 为 Experimental**：官方明确「may change or be removed without notice」；`@clerk/localizations` 约 50 个 BCP 47 语言，Account Portal 不受其影响 | `UDS5-AUDIT-02` §1 来源 8 | 5.0 **不得**把该机制作为稳定 i18n 契约引用；Uter 沿用自有 i18next 7 locale 体系（见 §4.8） |
| F3 | **Clerk 变量是扁平单层 24 键 `--clerk-*`**，**非** primitive/semantic 两层；默认 `borderRadius 0.375rem`、`fontSize 0.8125rem`、`spacing 1rem`；用 `color-mix()` 与相对颜色语法运行时派生色阶；2025-07-15 起 6 个键弃用；`colorPrimary` 以 `#6c47ff` 为官方示例值、默认 `fontFamily=inherit`（品牌字体非变量契约）；完整 24 键与弃用清单见 §2.3 | `UDS5-AUDIT-02` §1 来源 4、§5 结论 2 | 5.0 **不得**倒退为扁平单层；保留 Uter 的 Primitive → Semantic 两层、245 个唯一变量与静态门禁（见 §4.1） |
| F4 | **Clerk 官方不提供通用表格 / 图表 / 日期 / 上传 / 通知能力**：Data Table、Charts、DatePicker/Calendar、FileUpload/Dropzone、Image/Lightbox、Toast/Banner 通用规范、Drawer/Sheet、CommandMenu、Stepper、Timeline/Tree/Transfer、Skeleton/EmptyState 通用规范、Z-index/Elevation 分层、WCAG 2.2 AA 条款级对照、HarmonyOS 支持均未提供 | `UDS5-AUDIT-02` §1.1（来源 9 组件目录 + 来源 2 四层定制说明）、§5 结论 4 | 这些能力**必须全部由 Uter 自有规范定义**，不得写成「Clerk 的表格/图表/日期/上传/通知设计是……」（见 §4.10、§4.11） |

### 2.2 Clerk 官方「未提供」能力清单（严禁虚构为 Clerk 能力）

| 能力类别 | 官方是否提供 | Uter 自有规范归属（5.0） |
|---|:--:|---|
| Data Table / 排序 / 筛选 / 分页 | 否 | 数据展示规范 + `web/src/components/data-table/`（24 条导出） |
| Charts（折线 / 柱 / 饼 / 面积） | 否 | 数据展示规范 + `@visactor/vchart` / `recharts` |
| DatePicker / DateRangePicker / Calendar | 否 | 表单与日期规范 + `react-day-picker` |
| FileUpload / Dropzone | 否 | 表单规范 + Uter 自有上传组件 |
| Toast / Snackbar / Banner 通用规范 | 否 | 通知规范（`sonner` / `ui/alert.tsx`） |
| Image / Lightbox / 媒体 | 否 | 媒体组件规范（5.0 待补齐候选） |
| Drawer / Sheet / CommandMenu / Stepper | 否 | 交互与导航规范 |
| Timeline / Tree / Transfer / Skeleton / Empty State 通用规范 | 否 | 组件规范 + 反馈组件规范 |
| Z-index / Elevation 分层规范 | 否 | 层级与边框规范 |
| WCAG 2.2 AA 条款级对照 / 对比度数值表 | 否 | 无障碍规范（`verify-contrast.mjs` 31 条） |
| HarmonyOS / 原生平台支持 | 否 | 平台验收一律 `NOT_VERIFIED` |

> 说明：Clerk 官网首页的「Members」「Roles & Permissions」「Billing」为**产品演示内容**，不是可复用的组件规范，不得据此推断色值、字号或表格设计。

### 2.3 Clerk 官方**已公布**的设计 Token（OBSERVED，来自 `appearance.variables` 文档）

> **纠正说明**：本文与审计中曾出现「官方未公布色值/字号 Token」的表述，经核对 Clerk 官方 `appearance.variables` 文档（来源 4）**不准确**——该文档实际公布了一套扁平单层主题变量（共 24 个，全部映射为 `--clerk-*` kebab-case CSS 变量），并给出默认值、弃用清单与浏览器兼容说明。以下为据实补充。

| 变量 | CSS 变量 | 默认值 / 说明 |
|---|---|---|
| `colorPrimary` | `--clerk-color-primary` | 主色；文档以 `#6c47ff` 作为 `colorPrimary` 示例值（即 Clerk 品牌紫，OBSERVED） |
| `colorPrimaryForeground` | `--clerk-color-primary-foreground` | 主色上的文字色 |
| `colorBackground` | `--clerk-color-background` | 卡片容器背景 |
| `colorForeground` | `--clerk-color-foreground` | 文字色 |
| `colorBorder` | `--clerk-color-border` | 基础边框色 |
| `colorInput` | `--clerk-color-input` | 输入框背景（2025-07-15 起取代 `colorInputBackground`） |
| `colorInputForeground` | `--clerk-color-input-foreground` | 输入框文字（取代 `colorInputText`） |
| `colorMuted` | `--clerk-color-muted` | 静默背景 |
| `colorMutedForeground` | `--clerk-color-muted-foreground` | 次要文字（取代 `colorTextSecondary`） |
| `colorNeutral` | `--clerk-color-neutral` | 由它派生 hover / 边框 / 下拉色阶 |
| `colorDanger` | `--clerk-color-danger` | 错误态 |
| `colorSuccess` | `--clerk-color-success` | 成功态 |
| `colorWarning` | `--clerk-color-warning` | 警告态 |
| `colorRing` | `--clerk-color-ring` | **焦点环颜色**（对应 Uter `--ds-focus-ring-color`，见 `UDS5-S13` §7） |
| `colorShadow` | `--clerk-color-shadow` | 阴影基色 |
| `colorShimmer` | `--clerk-color-shimmer` | avatar shimmer 色 |
| `colorModalBackdrop` | `--clerk-color-modal-backdrop` | 模态背板 |
| `borderRadius` | `--clerk-border-radius` | `0.375rem`（6px） |
| `spacing` | `--clerk-spacing` | `1rem`（取代 `spacingUnit`） |
| `fontSize` | `--clerk-font-size` | `0.8125rem`（13px） |
| `fontWeight` | `--clerk-font-weight` | `{normal:400, medium:500, semibold:600, bold:700}` |
| `fontFamily` | `--clerk-font-family` | **`inherit`**（默认不指定；Geist / Suisse / Inter 等品牌字体由 Clerk 自有 CSS 注入，**非变量契约**） |
| `fontFamilyButtons` | `--clerk-font-family-buttons` | `inherit` |
| `fontFamilyMono` | `--clerk-font-family-mono` | 系统 mono 栈 |

**弃用键（2025-07-15，下个大版本移除）**：`colorText→colorForeground`、`colorTextOnPrimaryBackground→colorPrimaryForeground`、`colorTextSecondary→colorMutedForeground`、`spacingUnit→spacing`、`colorInputText→colorInputForeground`、`colorInputBackground→colorInput`。

**浏览器兼容（官方明示）**：主题系统依赖 `color-mix()`（Chrome 111+ / FF 113+ / Safari 16.2+）与相对颜色语法（Chrome 119+ / FF 120+ / Safari 16.4+），故官方建议传直接色值而非 CSS 变量以兼容旧浏览器。

**对 5.0 的约束（澄清）**：
- Clerk **确实公布了**变量默认值与 24 键结构，但**未公布品牌字体族**（默认 `fontFamily=inherit`，Geist 等由 Clerk 自有 CSS 注入，不构成可移植变量）与**完整默认色阶 hex**（文档示例用 `#0000ff` 占位，真实品牌紫为 `#6c47ff`）。
- 故「Uter 不采用 13px 基准、不引入 `color-mix()` 运行时派生」的结论**不变**（见 §4.1 / §4.4）；此前「Clerk 未公布 Token」表述已在 §2.1 / §2.2 与审计 §1 来源 1 / §2.1 据实纠正。
- 品牌色 `#6c47ff` 仅作**对照参考**，Uter 品牌靛紫 `#5B5EE6` 保持不变（禁止照搬，见 §3 P1）。

### 2.4 本轮补充核对的官方维度（2026-11-14，新增 4 个官方来源）

> 首轮审计（`UDS5-AUDIT-02`，9 个官方来源）覆盖了 14 项逐项规范（§4.1–§4.14）。本轮再次核对 clerk.com 官方文档，发现 `Customization overview`、Email/SMS templates、Bring your own CSS、CSS variables changelog 四处存在**首轮未纳入的官方维度**。以下逐项据实补充，并按 §3 红线给出处置判定；**全部只借鉴理念 / 信息架构，不引入任何 Clerk 运行时**。

| # | 官方维度（OBSERVED） | 官方来源 | 处置判定 | 5.0 落点 |
|---|---|---|---|---|
| N1 | **Theme editor**：交互式工具，可在一组预置组件上实时预览不同主题效果 | `clerk.com/docs/components/customization/overview` → Other customization options | `Adapt`（理念） | §4.15；Uter 以 `showcase.html` + `sync-design-showcase.mjs --check`（17 条）承担「可预览、可校验」，**不引入交互编辑器** |
| N2 | **Custom menu items**：`OrganizationProfile` / `UserButton` / `UserProfile` 三个导航组件支持自定义菜单项与排序 | 同上 | `Adapt`（严格限信息架构） | §4.9 补入三组件清单与「导航项按注册组件 ID 可定位」；**不改权限模型** |
| N3 | **Email and SMS templates**：Dashboard 模板编辑器，含 Edit / Preview / Reset / Revert / Copy to another instance；邮件 WYSIWYG 工具栏 + HTML 模式；每模板可关 `Delivered by Clerk` 改由 `emails.created` / `sms.created` webhook 自送 | `clerk.com/docs/authentication/configuration/email-options` | `Adapt`（仅治理理念） | §4.16；Uter 邮件模板真源为 `common/email_template.go`（硬编码 HTML）、**无预览 / 回滚 / 多环境复制 / 短信网关**，逐项登记 `NOT_IMPLEMENTED`；**不引入 Clerk 模板系统** |
| N4 | **Build your own UI**：low-level primitives 包装「与预置组件相同的 API 端点」，允许完全自建 UI；官方仍推荐优先用预置组件 | `clerk.com/docs/components/customization/overview` → Customization layers | `Adapt`（理念）/ `Reject`（依赖） | §4.17；Uter 走 `props + cva() + 语义 Token` 自有组件层，不引入 headless 原语包 |
| N5 | **simple theme 定位**：移除高级样式、作为 Bring-your-own-CSS 的干净起点；`cl-*` 锁图标之前的类可依赖，之后为内部类 | `clerk.com/docs/.../appearance-prop/bring-your-own-css` | `Adapt`（理念） | §4.4 / §4.11 补入「干净起点 + 稳定类边界」；Uter 预设重构方向为「单一 `:root` 基础层 + 预设只列差异键」 |
| N6 | **CSS 变量驱动动态主题**（2025-07-08）：`appearance.variables` 支持 `var(--ds-color-brand-primary)` 等既有设计系统变量；`prefers-color-scheme` / `[data-theme='…']` 驱动主题自动切换，无需换主题或改 JS 配置；依赖 `color-mix()` 与相对颜色语法 | `clerk.com/changelog/2025-07-08-css-variables-support` | `Reject`（倒退风险） | §4.18；Uter 已有 `data-theme-preset` / `data-theme-radius` / `data-theme-scale` **三维正交** + 静态两层 Token，**不得**引入运行时 `color-mix()` 派生（见 §4.1 / F3） |
| N7 | **Localization prop 的键机制**：从英文 localization 文件查键（如 `formButtonPrimary`），支持嵌套键 `signUp.start.subtitle` 与 `{{applicationName}}` 插值；prop 仍为 Experimental（F2） | `clerk.com/docs/customization/localization` | `Reject`（作依赖）/ `Adapt`（理念） | §4.8 补入；与 Uter「英文原文作 key + 7 份 locale + `static-keys.ts` 登记」铁律同构，**不得**把 Experimental 机制当稳定契约 |

> **时效性补充**：N3 的模板编辑器是 **Clerk Dashboard 产品能力**，不是可移植的前端组件规范；N6 的 CSS 变量支持是 2025-07-08 的增量能力，不改变 F3「扁平单层 24 键」的结构判定。二者均**不得**被写成 Uter 已具备或应当引入的依赖。

---

## 3. 禁止事项（PART 5 红线）

| # | 禁止项 | 5.0 约束 |
|---|---|---|
| P1 | 照搬 Clerk 品牌样式 | 不采用任何 Clerk 色值、字体、徽标、「Secured by Clerk」文案；Uter 品牌色（`#5B5EE6` 系列）、Inter + Noto Sans SC、优特智能品牌名保持不变 |
| P2 | 引入 Clerk SDK / 运行时依赖 | 不引入 `ClerkProvider`、`@clerk/ui`、`@clerk/elements`、`@clerk/localizations`、Clerk 主题包；不新增任何 Clerk 依赖 |
| P3 | 替换 Uter 认证 / 用户 / 组织 / 权限逻辑 | 认证（Go 后端 + Casbin）、`(auth)/` 9 路由、邮箱验证码 / step-up / WebAuthn / TOTP / 微信网页授权 / 登录 429 限流、`org_role` / `sub_quota_limit` / `EnforceOrgQuota` 等**零改动** |
| P4 | 把 Clerk 不具备的能力写成官方能力 | 逐类按 §2.2 标注 `Reject`，`Reference` 直接写「Clerk 官方未提供该能力（已核实）」 |
| P5 | 依据旧教程 / 截图研究 | 全部事实以 `UDS5-AUDIT-02` 的 9 个官方来源为准，并主动记录 F1 / F2 两项时效性事实 |

---

## 4. 逐项参考规范（PART 5 的 14 项 + 本轮补充 4 项 = 18 项，每项 6 字段）

> 字段固定为：`Clerk 原始设计特点` / `Uter 当前设计情况` / `Uter 需要改进的地方` / `5.0 最终规范` / `代码实施位置` / `测试证据`。所有 `测试证据` 未执行验证者标注 `NOT_VERIFIED`。
>
> **本轮扩展**：首轮 14 项（§4.1–§4.14）之外，按 §2.4 的 N1 / N3 / N4 / N6 补充 4 项（§4.15–§4.18），合计 **18 项**；N2 / N5 / N7 分别并入 §4.9 / §4.4 与 §4.11 / §4.8 的既有条目，不另立节。

### 4.1 Clerk Design Tokens

| 字段 | 内容 |
|---|---|
| Clerk 原始设计特点 | `variables` prop 为**扁平单层 24 个变量**（`borderRadius / colorBackground / colorPrimary / fontSize / fontWeight / spacing` 等），全部映射为 `--clerk-*` kebab-case CSS 变量；18 个颜色变量用 `color-mix()` 与相对颜色语法运行时派生悬停 / 边框 / 下拉色阶；默认 `fontSize 0.8125rem`（13px）、`spacing 1rem`、`borderRadius 0.375rem`；2025-07-15 起 6 个键弃用；`colorPrimary` 以 `#6c47ff` 作为官方示例值（品牌紫，OBSERVED）；**默认 `fontFamily` 为 `inherit`，品牌字体 Geist 等由 Clerk 自有 CSS 注入、非变量契约**；完整 24 键、弃用清单与浏览器兼容性见 §2.3 |
| Uter 当前设计情况 | 已是 **Primitive → Semantic 两层**：14 个 CSS / 1,518 行 / 319 处定义 / 245 个唯一变量名；`tokens/primitives.css`(47)、`typography.css`(76)、`spacing.css`(45)、`generated/brand.css`(16)、`semantic.css`(63)、`colors.css`(45)、`elevation.css`(27)；`@theme --text-*` 为 v4.3.3 自定义字号注册机制；DTCG 品牌真源 `source/brand.tokens.json`；T1–T17 严格门禁 |
| Uter 需要改进的地方 | 约 93 个零静态引用变量为候选清理上限（非死代码结论）；`theme-presets.css` 对每套预设重抄 52 个同名键；`showcase.tokens.js` 与内联快照双产物并存；需补「Token 元数据注册表 + 校验器」而非重建第二套 TS 值 Token |
| 5.0 最终规范 | **保留两层静态体系，禁止倒退为扁平单层**；不采用 13px 基准（Uter 正文 14/22、最小 12px、长文本 16/26 为红线）；仅借鉴「运行时派生须有单一出口」补进颜色规范；`--text-*` 保留，另立 `--ds-font-*` 语义别名用于文档与跨端映射（决策 D1 / D6） |
| 代码实施位置 | `web/src/design-system/tokens/*.css`、`web/src/styles/theme.css`、`web/src/styles/theme-presets.css`、`web/scripts/check-design-tokens.mjs`、`web/scripts/generate-design-tokens.mjs`；本轮仅撰写规范，未执行代码改造 |
| 测试证据 | 既有：`check-design-tokens.mjs --strict` 违规 0 / EXIT=0、`generate-design-tokens.mjs --check` EXIT=0、`sync-design-showcase.mjs --check` 17 PASS / 0 FAIL；5.0 新增校验器 `NOT_VERIFIED` |

### 4.2 Appearance API 理念

| 字段 | 内容 |
|---|---|
| Clerk 原始设计特点 | `appearance` 属性共 6 个：`captcha? / cssLayerName? / elements? / options? / theme? / variables?`；可作用于 `ClerkProvider`（全局）、按组件名、单组件实例三个层级；嵌套组件须经 `userProfileProps.appearance` 等专用 prop 传递；Tailwind v4 需 `cssLayerName` 才能让工具类在 Clerk 样式之后生效 |
| Uter 当前设计情况 | Uter 组件为自有 React / Base UI 实现，扩展走 `props + cva() + 语义 Token`：`ui/button.tsx` 用 `cva()` 定义 6 variant × 9 size；无 `appearance` 对象、无 `ClerkProvider` 外观传递链；样式作用域由 React props / Portal 决定 |
| Uter 需要改进的地方 | 缺少「分层定制」的显式规范边界；`appearance` 式全局覆写会绕过 T1–T17 门禁，必须明令禁止；组件扩展路径需统一为 variant / slot / composition |
| 5.0 最终规范 | 建立五层架构 L1 Foundation → L2 Primitives → L3 Components → L4 Patterns → L5 Templates & Applications（与 Clerk 四层理念同构但按 Uter 工程划分）；组件 API 规范规定 variant / slot / composition 为**唯一**扩展路径，禁止全局覆写式 API |
| 代码实施位置 | `web/src/components/ui/*.tsx`、`web/src/design-system/components/`、`web/src/design-system/foundations/*.css`；组件 API 规范分册 `UDS5` 系列；本轮未执行代码改造 |
| 测试证据 | 既有：`components:registry:check`（`registered=65 / discovered=65 / errors=0`）；五层架构校验器与扩展路径门禁 `NOT_VERIFIED` |

### 4.3 Elements 定制理念

| 字段 | 内容 |
|---|---|
| Clerk 原始设计特点 | ⚠️ **已弃用（F1）**：随 Core 3（2026-03-03）弃用，官方推荐 redesigned hooks；历史定义为 unstyled、composable、内置可访问 OTP 分段输入与即时密码校验、支持 `className` 与 `asChild` 组合，历史上仅支持 Next.js App Router + Core 2 |
| Uter 当前设计情况 | Uter 已有等价自有能力：`input-otp.tsx`、`ui/form.tsx` / `field.tsx` / `form-label-tier.tsx`、`react-hook-form + zod`、`handleServerError`；组件组合走自有 props，不依赖任何 Clerk 包 |
| Uter 需要改进的地方 | 需在规范层显式记录「Elements 弃用」事实，防止后续会话误把它当作现行可引入 API；组合式 UI 的「行为内建、样式可替换」理念需落到 Uter 组件规范 |
| 5.0 最终规范 | **只借鉴「分层定制 / 组合」理念，不引入、不描述为现行 API**；`asChild` / slot / composition 的组合方式由 Uter 组件 API 规范自行定义；任何引用 Clerk Elements 作为现行依赖的提案一律 `Reject`（决策 D5） |
| 代码实施位置 | `web/src/components/ui/input-otp.tsx`、`web/src/components/ui/form.tsx` 等；组件 API 与组合规范分册；本轮未执行代码改造 |
| 测试证据 | 现有 `input-otp` / 表单相关单测（288 个 `*.test.ts(x)` 中）；5.0「Elements 误引入」静态拦截校验 `NOT_VERIFIED` |

### 4.4 Theme 继承

| 字段 | 内容 |
|---|---|
| Clerk 原始设计特点 | 6 套预置主题（default / simple / shadcn / dark / shadesOfPurple / neobrutalism，`@clerk/ui/themes`）；`theme` 可传数组叠加「后定义者优先」；`variables` 与 `theme` 可组合；default 同时支持 light/dark（`color-scheme` / `.dark` / `[data-theme]` / `prefers-color-scheme`）；`shadcn` 主题兼容 Tailwind v4 |
| Uter 当前设计情况 | 已有 7+ 套 `theme-presets.css` 预设、`.dark` 变体、`data-theme-preset` / `data-theme-radius` / `data-theme-scale` **三维正交独立**；品牌渐变按深浅同值为刻意例外（E28）；Light/Dark 全局由 `theme.css:19` `@custom-variant dark` 与 `:590 .dark` 驱动 |
| Uter 需要改进的地方 | 预设对每套重抄整组 52 个同名键（合并候选）；缺 Light/Dark 变量成对校验器；品牌渐变的深浅同值例外需持续登记边界 |
| 5.0 最终规范 | 采纳「主题继承 + 局部覆盖」理念，补 Light/Dark 变量成对校验器；**不引入 `@clerk/ui` 主题包**（`Adopt` 理念 / `Reject` 包）；预设重构为「单一 `:root` 基础层 + 预设只列差异键」；品牌渐变深浅同值保留为登记例外。**N5 补充**：官方 `simple` theme 的定位是「移除高级样式、作为 Bring-your-own-CSS 的干净起点」，与上述「基础层 + 差异键」方向同构，仅借鉴其分层边界意识，不引入该主题包；`cl-*` 锁图标之前为稳定类、之后为内部类，对应 Uter「variant / slot / composition 为唯一扩展路径」 |
| 代码实施位置 | `web/src/styles/theme.css`、`web/src/styles/theme-presets.css`、`web/src/design-system/tokens/generated/brand.css`、`web/scripts/verify-contrast.mjs`；本轮未执行代码改造 |
| 测试证据 | 既有：`verify-contrast.mjs` 31 PASS / 0 FAIL（含 E28 渐变锚定与负例拒绝）；Light/Dark 成对校验器 `NOT_VERIFIED` |

### 4.5 Authentication UI

| 字段 | 内容 |
|---|---|
| Clerk 原始设计特点 | 8 个认证组件（SignIn / SignUp / GoogleOneTap / OAuthConsent / TaskChooseOrganization / TaskResetPassword / TaskSetupMFA / Waitlist）；分步表单、社交登录优先、分隔线、次要链接、MFA / 验证码 / 魔法链接；居中窄卡片 |
| Uter 当前设计情况 | `(auth)/` 9 个路由自建：邮箱验证码登录、step-up、WebAuthn / TOTP、微信网页授权、登录 429 限流、iframe 沙箱；由 Go 后端 + Casbin 控制，架构与 Clerk 托管身份服务不可互换 |
| Uter 需要改进的地方 | 仅可改进信息架构与视觉密度（分区标题、卡片分组、状态完整性），不得改任何认证流程、API 契约或安全约束 |
| 5.0 最终规范 | **仅限视觉与信息架构参考**（`Adapt（严格限视觉）`）；统一认证页卡片分组、字段级错误就近展示、加载 / 错误 / 空态齐备；**不引入 Clerk SDK、不替换 Uter 自建认证**（PART 5 / 决策 D8） |
| 代码实施位置 | `web/src/routes/(auth)/*`（9 个路由，仅视觉层）、`web/src/features/auth` 相关视图组件；后端认证逻辑**零改动**；本轮未执行代码改造 |
| 测试证据 | 认证相关单测与 E2E（`(errors)` / `oauth` 路由）；5.0 认证页视觉回归 `NOT_VERIFIED`（`test:visual:e2e` 未接 CI） |

### 4.6 User Profile UI

| 字段 | 内容 |
|---|---|
| Clerk 原始设计特点 | `UserAvatar` / `UserButton` / `UserProfile`；`UserProfile` 支持自定义页面项；分区演示 Profile / Security / Billing / API keys，采用「左分区导航 + 右详情卡片」 |
| Uter 当前设计情况 | `features/profile`（17 文件）、`features/security`（37 文件）、`_authenticated/profile` / `security` 路由已覆盖；另有 API Key、钱包、消费日志等网关特有分区 |
| Uter 需要改进的地方 | 分区标题、卡片标题层级口径需统一（分区标题 22/600/30、卡片标题 18/600/26）；账户自助管理分区化的信息架构需规范化 |
| 5.0 最终规范 | 参考「账户自助管理分区化」信息架构，统一分区标题与卡片标题字号 / 字重 / 行高；仅改视觉与组件复用，不改用户数据模型与 API 契约 |
| 代码实施位置 | `web/src/features/profile/`、`web/src/features/security/`、`web/src/routes/_authenticated/profile*` / `security*`；本轮未执行代码改造 |
| 测试证据 | 现有 profile / security 相关单测；5.0 分区标题字号一致性校验 `NOT_VERIFIED` |

### 4.7 Organization UI

| 字段 | 内容 |
|---|---|
| Clerk 原始设计特点 | `CreateOrganization` / `OrganizationProfile` / `OrganizationSwitcher` / `OrganizationList` / `InviteMembersButton`；演示 Members / Roles & Permissions / Verified domains / Billing / API keys 与 `org:member` / `org:admin` 角色 |
| Uter 当前设计情况 | `features/organization`（8 文件）与 `_authenticated/organization/index.tsx`；正在推进 org/tenant 四项需求（配额可见性 / 组织钱包计费 / 角色数据视图 / 部门名）；组织与配额 / 计费强耦合 |
| Uter 需要改进的地方 | 仅缺 UI 规范映射（成员列表、角色视图、切换器的视觉与状态规范）；业务逻辑不得触碰 |
| 5.0 最终规范 | **严格限视觉**（`Adapt（严格限视觉）`）；只做成员表格、角色列表、组织切换器的 UI 规范映射；**不改 `org_role` / `sub_quota_limit` / `EnforceOrgQuota` 等业务逻辑**（决策 D8） |
| 代码实施位置 | `web/src/features/organization/`、`web/src/routes/_authenticated/organization/index.tsx`（仅视觉层）；本轮未执行代码改造 |
| 测试证据 | `features/users/components/__tests__/permissions.test.tsx` 等权限相关单测；5.0 组织页 UI 规范验证 `NOT_VERIFIED` |

### 4.8 表单体验

| 字段 | 内容 |
|---|---|
| Clerk 原始设计特点 | 表单逻辑内建、错误结构化、布局可配置（`options`）；`unstable__errors` 覆盖字段错误文案；垂直字段栈、字段级错误就近展示、即时校验、分步流程；localization 为 Experimental（F2） |
| Uter 当前设计情况 | `react-hook-form ^7.91.0` + `zod 4.6.7` + `@hookform/resolvers`；`ui/form.tsx` / `field.tsx` / `form-label-tier.tsx` / `input-otp.tsx` / `secret-input.tsx` / `input-group.tsx`；`handleServerError`；i18n 为 i18next 7 locale / 54,573 行自建体系 |
| Uter 需要改进的地方 | 错误优先级、未保存提醒、防重复提交三项体验规则需补齐；不得引用 Experimental 的 localization 机制作为稳定 i18n 契约 |
| 5.0 最终规范 | 补「错误优先级 / 未保存提醒 / 防重复提交」；错误来自后端 API 契约，**不得替换 Uter 认证流程**；i18n 沿用自有 i18next 体系，F2 机制仅作背景记录、不作依赖；H5 输入 ≥16px 防 iOS 缩放、焦点环 2px（`ring-2`，已裁决，见 `UDS5-S13` §7）。**N7 补充**：官方 `localization` prop 的键机制为「查英文 localization 文件取键 → 支持嵌套键 `signUp.start.subtitle` → `{{applicationName}}` 插值」，与 Uter「英文原文作 key + 7 份 locale 同步 + `static-keys.ts` 登记 prop/变量形式键」铁律同构；**该 prop 仍是 Experimental（F2），严禁作为稳定 i18n 契约或依赖引用** |
| 代码实施位置 | `web/src/components/ui/form.tsx` 等表单组件、`web/src/features/*/components/*` 表单视图；i18n `web/src/i18n/locales/*.json`；本轮未执行代码改造 |
| 测试证据 | 现有表单相关单测与 `check-i18n-keys.mjs`；5.0 错误优先级 / 防重复提交校验 `NOT_VERIFIED` |

### 4.9 导航设计

| 字段 | 内容 |
|---|---|
| Clerk 原始设计特点 | `UserButton` / `UserProfile` / `OrganizationProfile` 支持自定义菜单项与排序；`<Show />` 等 Control 组件按认证 / 授权状态控制可见性；菜单分组、紧凑行高、键盘可达 |
| Uter 当前设计情况 | 既有 Sidebar 选中态（靛蓝文字 + `bg-primary/10` + 图标变蓝、去粗体）；`ROLE.ADMIN` / `SUPER_ADMIN` 守卫散布在 11 个路由文件；权限由后端 Casbin + 路由 `beforeLoad` 决定；`system-settings` 有 9 个子域 / 18 文件需三级导航 |
| Uter 需要改进的地方 | 需补「按注册组件 ID 定位导航实现」的双向关联；导航项可插拔 / 按权限渲染的规范要求显式化 |
| 5.0 最终规范 | 沿用 Uter 既有 Sidebar 选中态与后端守卫；补「导航项按注册组件 ID 可定位、按权限渲染」规范；**不得因参考 Clerk 改为前端 `<Show />` 授权**。**N2 补充**：官方 Custom menu items 仅对 `OrganizationProfile` / `UserButton` / `UserProfile` 三个导航组件开放自定义菜单项与排序；Uter 侧导航项聚合自 `section-registry`（`UDS5-S11`），「导航项 ↔ 注册组件 ID 双向可定位」仍为 `S21-D08` 待办（`NOT_STARTED`），本轮不改导航实现 |
| 代码实施位置 | `web/src/components/layout/`（App Shell / Sidebar）、`web/src/routes/_authenticated/system-settings/*`；本轮未执行代码改造 |
| 测试证据 | 现有路由守卫与权限单测；5.0「导航 ↔ 组件注册 ID」关联校验 `NOT_VERIFIED` |

### 4.10 反馈组件

| 字段 | 内容 |
|---|---|
| Clerk 原始设计特点 | `ClerkLoaded` / `ClerkLoading` / `ClerkFailed` / `ClerkDegraded` 为**认证状态控制组件**，不是通用 Toast / Alert / Banner 规范；`colorDanger` / `colorSuccess` / `colorWarning` 为状态色变量；⚠️ **官方未提供通用 Toast / Banner / Snackbar 规范（F4）** |
| Uter 当前设计情况 | `sonner` / `ui/alert.tsx` / `empty-state` / `error-state` / `loading-state` / `spinner` / `skeleton` / `progress`；`foundations/motion.css` 有 7 个 `ds-motion-*` utility |
| Uter 需要改进的地方 | 仅借鉴「按加载 / 失败 / 降级状态分离渲染」原则；通用通知规范须由 Uter 自有规范定义（不得归为 Clerk 能力） |
| 5.0 最终规范 | 区分成功 / 信息 / 警告 / 可恢复错误 / 不可恢复错误五类反馈；页面必须具备空 / 加载 / 错误三态；Skeleton 动效与 Reduce Motion 纳入无障碍；Clerk 无通用通知规范，本节 `Reference` 按 F4 标注「未提供」 |
| 代码实施位置 | `web/src/components/ui/alert.tsx` 等反馈组件、`web/src/components/{empty,error,loading}-state.tsx`、`web/src/design-system/foundations/motion.css`；本轮未执行代码改造 |
| 测试证据 | 现有反馈组件单测；5.0 五类反馈与三态齐全页面检查 `NOT_VERIFIED` |

### 4.11 组件组合

| 字段 | 内容 |
|---|---|
| Clerk 原始设计特点 | 四层定制（Themes → variables → 稳定类 BYO CSS → 自建 UI）；`cl-*` 稳定类 + `elements` 键映射（锁图标之前的类可依赖）；组件 variant 由 **CVA（class-variance-authority）+ Radix UI 原语**实现（OBSERVED，来自 clerk.com 实现，非 9 个官方文档页）；⚠️ **官方未提供通用表格 / 图表 / 日期 / 上传 / 空态 / 骨架 / Stepper / Timeline / Tree / Transfer 组件（F4）** |
| Uter 当前设计情况 | `ui/` 65 个实现、`data-table/` 24 条导出、`react-day-picker` / `@visactor/vchart` / `recharts`；3 处同名 `EmptyState` 重复实现（`components/empty-state.tsx` 正式 + 2 处局部）；约 8 项待补齐候选（Transfer / ColorPicker / Timeline / Tree / VirtualTable / Image / Lightbox / Rate） |
| Uter 需要改进的地方 | 需统一组件扩展路径与「稳定类 / 内部类」边界意识；合并 3 处同名 `EmptyState`；通用组件能力全部由 Uter 自有规范定义并逐类标注 Clerk 未提供 |
| 5.0 最终规范 | 组件 API 规范规定 variant / slot / composition 唯一扩展路径；`ui/button.tsx` 的 `cva()` 聚合已覆盖 ≥10 个按钮名称，不必按 Clerk 名称逐一实现；通用组件按 §2.2 由 Uter 自有规范定义，`Decision` 为 `Reject`（不归为 Clerk 能力）。**N5 补充**：借鉴官方「稳定类 / 内部类」边界（锁图标之前的 `cl-*` 可依赖、之后不可），在 Uter 侧落为「公开 props = 稳定契约、组件内部 DOM 结构与类名不可依赖」；不引入 `cl-*` 类与 `appearance.elements` 机制 |
| 代码实施位置 | `web/src/components/ui/*.tsx`、`web/src/components/data-table/`、`web/src/design-system/component-registry.json`；本轮未执行代码改造 |
| 测试证据 | 既有：`components:registry:check` 结构自洽（65/65/0 errors）、`--strict` EXIT=1（证据未验证）；5.0 组件合并与扩展路径校验 `NOT_VERIFIED` |

### 4.12 状态管理

| 字段 | 内容 |
|---|---|
| Clerk 原始设计特点 | 组件内置状态机（认证流程 step / 加载 / 失败 / 降级），`ClerkLoaded` 等按状态自动渲染；redesigned hooks 暴露 stateful objects / step methods / structured field-level errors；定制不改动组件状态机与业务逻辑 |
| Uter 当前设计情况 | 状态 / 数据用 Zustand `^5`、TanStack Query `^5.101.2`、TanStack Table `^8.21.3`、axios；`ui/button.tsx` 内置 `loading` prop；65 组件 contract 内有 `states` 字段但顶层 `states` 缺失 |
| Uter 需要改进的地方 | 组件须补齐 default / hover / focus / pressed / disabled / loading / error / success 八态并登记证据；registry 缺顶层 `states` 等 8 类字段 |
| 5.0 最终规范 | 采纳「状态是一等渲染分支、状态机与业务逻辑不被定制改动」原则；组件规范要求八态齐备并登记证据；组件注册模型补齐 `layer / source / implementation_path / specification_path / test_path / story_path / variants / states / accessibility / deprecated / replacement` 字段 |
| 代码实施位置 | `web/src/components/ui/*.tsx`、`web/src/design-system/component-registry.json`、`web/src/stores/` 与 TanStack Query 层；本轮未执行代码改造 |
| 测试证据 | 既有：`--strict` EXIT=1（65 组件 `VERIFIED=0` / `PARTIAL=9` / `NOT_VERIFIED=56`）；5.0 八态证据登记与 registry 字段补齐校验 `NOT_VERIFIED` |

### 4.13 可访问性

| 字段 | 内容 |
|---|---|
| Clerk 原始设计特点 | Elements（历史）自述「accessible segmented OTP input」；本次核实页面**无独立无障碍规范页、无 WCAG 2.2 AA 条款级对照或对比度数值表（F4）**；理念为「可访问性内建而非后置补丁」 |
| Uter 当前设计情况 | `foundations/accessibility.css`、11 个守卫测试（含 `status-badge-contrast.test.ts` / `accessibility.test.ts`）、`verify-contrast.mjs` 31 条、`test:axe` 2 个 spec；E24 两处对比度不达标（浅色溢价 3.76:1、深色折扣 3.30:1）为 P1 待修 |
| Uter 需要改进的地方 | E24 缺陷须保持待修、不得勾选通过；E28 有意例外需持续登记；`aria-expanded` / `aria-selected` 需与视觉状态一致；官方无等价数值证据，Uter 需以自有门禁为准 |
| 5.0 最终规范 | 以 WCAG 2.2 AA 为目标，保留 E24 待修登记与 E28 例外边界；组件级 a11y 要求须登记到展示中心与注册 ID；键盘可达、焦点管理、Reduce Motion 纳入规范；**不得虚构 Clerk 对比度数值** |
| 代码实施位置 | `web/src/design-system/foundations/accessibility.css`、`web/src/design-system/__tests__/`、`web/scripts/verify-contrast.mjs`、`web/e2e/axe/`；本轮未执行代码改造 |
| 测试证据 | 既有：`verify-contrast.mjs` 31 PASS / 0 FAIL、`test:axe` 2 spec（**未接 CI**）；E24 修复验证与 5.0 a11y 登记校验 `NOT_VERIFIED` |

### 4.14 响应式

| 字段 | 内容 |
|---|---|
| Clerk 原始设计特点 | 官方明确「原生应用（iOS / Android）使用独立 `ClerkTheme` 主题系统」；default 主题支持 `prefers-color-scheme`；**官方文档未公布断点数值或 H5 专属断点表（F4）** |
| Uter 当前设计情况 | 3.0 §16 五档断点 `sm640 / md768 / lg1024 / xl1280 / 2xl1536`；H5 输入 ≥16px、命中区 24px 最小 / 44px 推荐、后台 1280px；`detectPayClient()` UA 判定；H5 为同一套代码响应式分支，非独立工程 |
| Uter 需要改进的地方 | 不得照搬 Clerk 的「原生主题分离」结论（Uter 无原生应用）；Android / iOS / HarmonyOS 无任何实现，须标 `NOT_VERIFIED`；73 路由中仅 22 页有视觉基线 |
| 5.0 最终规范 | 保持 Uter 五档断点与 H5 红线；响应式规范明确 Android / iOS / HarmonyOS 为 `NOT_VERIFIED`；**不得用 Web 测试结果代替原生平台验收**；系统主题跟随与 Light/Dark 成对校验纳入主题规范 |
| 代码实施位置 | `web/src/styles/theme.css`、断点相关 Tailwind 配置、`web/src/features/wallet/lib/payment.ts:224`（UA 正则）、`web/e2e/visual/` 视觉基线；本轮未执行代码改造 |
| 测试证据 | 既有：`test:visual`（PC 1440×900 + mobile 390×844 × 22 页 × 2 视口 = 44 张 PNG）、`test:visual` 已接 CI；原生三平台验收 `NOT_VERIFIED`（无实现） |

### 4.15 Theme editor 理念（N1，本轮补充）

| 字段 | 内容 |
|---|---|
| Clerk 原始设计特点 | Theme editor 是交互式工具，在一组预置组件上实时预览不同主题，用于快速试验主题对各组件 UI 的影响；属 Dashboard 侧的产品能力，非可移植组件规范 |
| Uter 当前设计情况 | 已有 `showcase.html` 静态展示中心 + `showcase.tokens.js` 派生快照 + `sync-design-showcase.mjs --check`（17 条校验），`design:showcase:check` 已接入 npm script；**无交互式主题编辑器** |
| Uter 需要改进的地方 | 「可预览」与「可校验」已具备，但**主题预设切换的即时预览**未做成交互工具；且 `showcase.tokens.js` 与内联快照双产物并存，存在漂移风险（已在 `UDS5-S01` §28 登记） |
| 5.0 最终规范 | **只借鉴「主题变更必须可见、可校验」的治理原则**，不引入交互编辑器、不新增运行时依赖；展示中心仍以 `showcase.html` + `--check` 17 条为单一出口；交互预览能力登记为 `S21-D05`（`NOT_STARTED`），不作验收要求 |
| 代码实施位置 | `web/scripts/sync-design-showcase.mjs`、`web/scripts/generate-design-showcase.mjs`、`docs/design-system/showcase.html`（只读）；本轮未执行代码改造 |
| 测试证据 | 既有：`sync-design-showcase.mjs --check` 17 PASS / 0 FAIL（来自 `UDS5-AUDIT-01` 只读结论，本轮未复跑）；交互预览 `NOT_STARTED` |

### 4.16 Email and SMS templates 理念（N3，本轮补充）

| 字段 | 内容 |
|---|---|
| Clerk 原始设计特点 | Dashboard 模板编辑器支持 Edit / **Preview**（预览时 `app_logo`、`copyright` 与模板变量替换为样例值）/ Reset（撤销上次保存后的改动）/ Revert（回滚到系统默认，需二次确认）/ Copy to another instance（跨开发→预发→生产复制，需二次确认）；邮件 WYSIWYG 含工具栏、移动视图开关、HTML 模式；每模板可关 `Delivered by Clerk`，改由 `emails.created` / `sms.created` webhook 自行投递 |
| Uter 当前设计情况 | 邮件模板由 `common/email_template.go` 的 `BuildBrandEmailHTML` 硬编码生成（`EmailBrandName` / `BrandEmail{Subject,Heading,Paragraphs,Code,Note}` / `brandEmailFont` / `ensureLinkNoUnderline`）；**无模板编辑器、无预览、无版本回滚、无多环境复制**；全仓**无独立短信网关**（`UDS5-S32` §6 整节 `NOT_IMPLEMENTED`）；邮件 HTML 不消费任何 `--ds-*` / `--text-*` Token |
| Uter 需要改进的地方 | 可借鉴「预览 / 回滚 / 跨环境复制 / 危险操作二次确认」四项治理理念，但**不得**引入 Clerk 模板系统或新增 `emails.created` 类 webhook 契约；邮件页脚与 `lang` 固定中文、暗色模式缺失等既有缺陷优先按 `UDS5-S32` 处理 |
| 5.0 最终规范 | 以 `UDS5-S32`（触达与本地化规范）为唯一落点；模板真源继续为 `common/email_template.go`，**任何模板改动须走代码评审而非运行时编辑器**；「预览 / 回滚 / 跨环境复制」登记为 `S21-D06`（`NOT_STARTED`），短信模板整节保持 `NOT_IMPLEMENTED`；不改变任何认证 / 资金逻辑 |
| 代码实施位置 | `common/email_template.go`、`common/verification.go`（只读）；`UDS5-S32` §4–§6；本轮未执行代码改造 |
| 测试证据 | `NOT_VERIFIED`——本轮未执行邮件渲染或模板相关测试；`UDS5-S32` 已登记邮件能力默认关闭（`EmailCodeLoginEnabled` / `EmailVerificationEnabled` = `false`） |

### 4.17 Build your own UI 理念（N4，本轮补充）

| 字段 | 内容 |
|---|---|
| Clerk 原始设计特点 | 官方提供包装「与预置组件相同 API 端点」的 low-level primitives，允许完全自建 UI；同时明确**推荐优先使用预置组件**以获得持续更新与更低维护成本；原生 iOS / Android 另用 `ClerkTheme` 独立主题系统 |
| Uter 当前设计情况 | 无 headless 原语层；组件为自有 React / Base UI 实现，扩展走 `props + cva() + 语义 Token`（`ui/button.tsx` 6 variant × 9 size）；`UDS5-S15` 已规定 variant / slot / composition 为唯一扩展路径，五层架构 L1–L5 见 `UDS5-S01` §6 |
| Uter 需要改进的地方 | 需在规范层明确「优先复用既有组件、不得为单页另造平行实现」；已知 3 处同名 `EmptyState` 重复实现、`CopyButton` 未复用等收敛项分别登记于 `UDS5-S14` / `UDS5-S30` |
| 5.0 最终规范 | **只借鉴「优先复用 + 分层可替换」的治理原则**；`Reject` 引入任何 headless 原语包或 Clerk 主题包；组件扩展路径仍以 `UDS5-S15` 为唯一口径；原生三平台保持 `NOT_VERIFIED`，不得用 Web 结果代替 |
| 代码实施位置 | `web/src/components/ui/*.tsx`、`web/src/components/{empty,error,loading}-state.tsx`（只读）；`UDS5-S15` / `UDS5-S01` §6；本轮未执行代码改造 |
| 测试证据 | 既有：`components:registry:check`（65/65/0 errors，来自审计只读结论）；`--strict` EXIT=1 保持；本轮未复跑 |

### 4.18 CSS 变量驱动动态主题（N6，本轮补充）

| 字段 | 内容 |
|---|---|
| Clerk 原始设计特点 | 2025-07-08 起 `appearance.variables` 允许直接传 CSS 自定义属性（如 `var(--ds-color-brand-primary)`），可对接既有设计系统；`prefers-color-scheme` 媒体查询与 `[data-theme='…']` 数据属性可驱动主题自动切换，无需换主题或改 JS 配置；该能力依赖 `color-mix()` 与相对颜色语法（Chrome 119+ / Safari 16.4+ / FF 128+） |
| Uter 当前设计情况 | 已有 **Primitive → Semantic 两层静态 Token**（245 个唯一变量）、`data-theme-preset` / `data-theme-radius` / `data-theme-scale` **三维正交独立**、`.dark` 变体与 `@custom-variant dark`（`theme.css:19` / `:590`）；`theme-presets.css` 7+ 套预设；Light/Dark 品牌渐变深浅同值为登记例外（E28） |
| Uter 需要改进的地方 | 预设对每套重抄 52 个同名键（合并候选）；Light/Dark 变量成对校验器仅覆盖 `generated/brand.css`（`UDS5-S10` `S10-D4` 仍标 `NOT_VERIFIED`） |
| 5.0 最终规范 | **Uter 现状强于 Clerk 方案，不得倒退**：保留静态两层 Token 与三维 `data-theme-*`；**禁止**引入 `color-mix()` / 相对颜色语法做运行时色阶派生（会绕过 T1–T17 静态门禁）；预设重构方向「单一 `:root` 基础层 + 预设只列差异键」保持；Light/Dark 成对校验器扩展登记为 `S21-D07`（`NOT_STARTED`） |
| 代码实施位置 | `web/src/styles/theme.css`、`web/src/styles/theme-presets.css`、`web/src/design-system/tokens/*.css`、`web/scripts/check-design-system-5.0.mjs`（只读）；本轮未执行代码改造 |
| 测试证据 | 既有：`check-design-tokens.mjs --strict` 违规 0 / EXIT=0（审计只读结论）；`bun run design:5:check` 本轮实测 `tokenFiles: 8` / `uniqueTokenVariables: 245` / `crossFileTokenDuplicates: 0`（2026-11-14，见 CHANGELOG）；成对校验器扩展 `NOT_STARTED` |

---

## 5. 决策一致性自检（与 `UDS5-AUDIT-02` §3 对齐）

| 判定 | 本文涉及项 | 计数口径 |
|---|---|---|
| `Adopt`（仅理念 / 原则） | 主题继承理念、按钮状态齐备原则、卡片表面色差优先 | 与审计一致，不含引入主题包 |
| `Adapt`（含严格限视觉） | Design Tokens、Appearance、Authentication / User / Organization、表单、导航、反馈、组合、状态、a11y、响应式、Elements 理念；**本轮新增** N1 Theme editor 理念、N2 Custom menu items、N3 Email/SMS templates 治理理念、N4 Build your own UI、N5 simple theme 分层边界、N7 localization 键机制 | 主体处置；本轮新增 6 项均为理念 / 信息架构，不含运行时引入 |
| `Reject` | Clerk Elements 弃用 API、Clerk SDK / 主题包、通用表格 / 图表 / 日期 / 上传 / 通知 / 空态能力归为 Clerk；**本轮新增** N6 CSS 变量驱动动态主题（不得引入 `color-mix()` 运行时派生）、headless 原语包、`cl-*` 稳定类机制、`appearance.elements`、Clerk 模板系统 | 与 §2.2、§3 一致 |
| 明确「官方未提供」 | 11 类通用能力（§2.2） | 与 `UDS5-AUDIT-02` §1.1 / §5 结论 4 一致 |

> 本文未新增任何 `Adopt` 到「引入 Clerk 运行时」的方向；所有运行时依赖相关判定均为 `Reject` 或「不引入」。本轮补充的 7 个官方维度（N1–N7）中，**6 项 `Adapt`、1 项 `Reject`**，零依赖引入；详见 §10 `S21-D01`…`S21-D09`。

---

## 6. 与其他规范的关系

| 规范 ID | 关系 | 说明 |
|---|---|---|
| `UDS5-S01` | 上级 | 本文服从总纲的规范效力、ID 体系与验证状态口径 |
| `UDS5-AUDIT-01` | 事实依据 | `audit/BASELINE-AUDIT.md` 提供 Uter 当前设计情况、Token / 组件 / 页面 / CI / 平台全部基线数字与决策 D1–D8 |
| `UDS5-AUDIT-02` | 事实依据 | `audit/CLERK-DESIGN-REFERENCE-ANALYSIS.md` 提供首轮 9 个官方来源、23 项逐项分析、F1–F4 时效性事实与禁止事项复核；本轮另补 4 个官方来源（§2.4） |
| `UDS5-S03`（颜色规范） | 被引用 | §4.1 的「派生单一出口」、`--ds-font-*` 别名落地 |
| `UDS5-S04`（字体规范） | 被引用 | §4.1 / §4.2 的 `@theme --text-*` 保留与 13px 基准拒绝（决策 D1） |
| `UDS5-S10`（主题规范） | 被引用 | §4.4 主题继承、Light/Dark 成对校验 |
| `UDS5-S13`（无障碍规范） | 被引用 | §4.13 E24 / E28 登记与 WCAG 2.2 AA 目标 |
| `UDS5-S12`（响应式规范） | 被引用 | §4.14 五档断点与原生平台 `NOT_VERIFIED` |
| `UDS5-S14` / `UDS5-S15`（组件 / 组件 API 规范） | 被引用 | §4.2 / §4.3 / §4.11 五层架构与唯一扩展路径 |
| `UDS5-S18`（表单规范） | 被引用 | §4.8 错误优先级 / 未保存提醒 / 防重复提交 |
| `UDS5-S20`（通知规范） | 被引用 | §4.10 五类反馈 |
| `UDS5-S23`（组件展示规范） | 被引用 | §4.12 / §4.13 组件八态与 a11y 登记到展示中心 |
| `UDS5-S25`（验收规范） | 被引用 | 本文所有 `NOT_VERIFIED` 项纳入平台验收「不得用 Web 结果代替」口径 |
| `UDS5-S32`（触达与本地化规范） | 本轮新增引用 | §4.16 N3 邮件 / 短信模板治理理念的唯一落点；邮件模板真源、短信 `NOT_IMPLEMENTED`、i18n 铁律以 S32 为准 |
| `UDS5-S26`（自动化规范） | 本轮新增引用 | §8 的 `check-clerk-boundary.mjs` 四项静态守卫登记为可执行门禁 |
| `UDS5-S11`（布局规范） | 本轮新增引用 | §4.9 N2「导航项 ↔ 注册组件 ID 双向可定位」的落点（`section-registry`），当前为 `NOT_STARTED` |

> 上表规范 ID 引用以 5.0 分册编号体系为准；具体分册文件名由同级目录内 `UDS5-Sxx` 与文件名一一对应表确定，本文不虚构文件名。

---

## 7. 代码实施位置

| 类别 | 真实路径（来自审计事实） | 本文关联项 | 本轮状态 |
|---|---|---|---|
| Token 真源 | `web/src/design-system/tokens/*.css`（14 个 CSS） | §4.1 | 存在，未改造 |
| 主题 / 预设 | `web/src/styles/theme.css`、`web/src/styles/theme-presets.css` | §4.4 / §4.14 | 存在，未改造（属并发 WIP 禁改文件） |
| UI 组件根 | `web/src/components/ui/*.tsx`（65 实现） | §4.2 / §4.3 / §4.11 / §4.12 | 存在，未改造 |
| 业务封装 | `web/src/components/data-table/`、`web/src/components/{empty,error,loading}-state.tsx` | §4.10 / §4.11 | 存在，未改造 |
| 认证 / 账户 / 组织视图 | `web/src/routes/(auth)/*`、`web/src/features/{profile,security,organization}/` | §4.5 / §4.6 / §4.7 | 存在，仅允许视觉层改造，本轮未执行 |
| 组件注册 | `web/src/design-system/component-registry.json` | §4.12 | 存在，未改造 |
| 门禁脚本 | `web/scripts/check-design-tokens.mjs`、`sync-design-showcase.mjs`、`verify-contrast.mjs`、`generate-design-tokens.mjs`、`check-component-registry.mjs` | §4.1 / §4.13 | 存在，未改造 |
| Clerk 边界守卫（本轮新增） | `web/scripts/check-clerk-boundary.mjs`、`web/src/design-system/__tests__/clerk-boundary.test.ts`、`web/package.json` 的 `design:clerk:check` | §3 / §8 / §10 | **本轮新增**，纯静态只读；回归测试 8/8 通过 |
| i18n | `web/src/i18n/locales/*.json`（7 份 / 54,573 行） | §4.8 | 存在，未改造 |

> **本轮边界**：本文主体为外部参考与治理规范；本轮**唯一**的代码侧落地是按「每处改动先写回归测试」约定新增的**纯静态只读守卫** `web/scripts/check-clerk-boundary.mjs`（配套 `web/src/design-system/__tests__/clerk-boundary.test.ts` 与 `bun run design:clerk:check`）。该守卫只读取 `package.json` / `src/` / 本文 §2.2，**不修改任何业务、认证、资金、授权代码，不新增任何 Clerk 依赖**；先跑红色（8/8 失败）再跑绿色（8/8 通过）的实测记录见 §8 与 CHANGELOG。其余落地动作按 `UDS5-S27`（迁移指南）与 `UDS5-S26`（自动化规范）分期推进。

---

## 8. 自动化验证

| 验证项 | 现有可执行命令 / 脚本 | 本轮状态 | 实测结果（2026-11-14） |
|---|---|---|---|
| **Clerk 依赖零引入（C1）** | `bun run design:clerk:check` → `web/scripts/check-clerk-boundary.mjs` | **本轮已落地** | `PASS`：扫描 `package.json` 四组依赖共 **84** 项，零 Clerk 包 |
| **Clerk 运行时零引用（C2）** | 同上 | **本轮已落地** | `PASS`：扫描 `web/src` **1,287** 个生产源文件，零 `ClerkProvider` / `@clerk/*` / `cl-*` 稳定类 / 品牌背书文案；排除 `__tests__` 与 `*.test.*` 避免自命中 |
| **品牌值零照搬（C3）** | 同上 | **本轮已落地** | `PASS`：零 `#6c47ff`、零 `--clerk-*` 变量声明；Uter 品牌靛紫 `#5B5EE6` 不变 |
| **通用组件能力归属性（C4）** | 同上 | **本轮已落地** | `PASS`：校验本文 §2.2 的 **11** 类能力逐条标注「官方是否提供 = 否」，防止把 Uter 自有能力误写成 Clerk 能力 |
| 守卫自身回归测试 | `bun run test -- src/design-system/__tests__/clerk-boundary.test.ts` | **本轮已落地** | 红色阶段 **8/8 失败**（脚本未创建）→ 绿色阶段 **8/8 通过**；覆盖依赖注入、源码注入、品牌色注入、能力清单删减、自身排除 5 类负例 |
| Token 两层体系未倒退 | `check-design-tokens.mjs --strict` | 既有（本轮未复跑） | 审计只读结论：违规 0 / EXIT=0；`bun run design:5:check` 本轮实测 `tokenFiles: 8` / `uniqueTokenVariables: 245` / `crossFileTokenDuplicates: 0` |
| 主题 Light/Dark 成对 | `verify-contrast.mjs`；`check-design-system-5.0.mjs` 品牌变量成对检查 | 部分存在 | 审计只读结论 31 PASS / 0 FAIL；成对校验仅覆盖 `generated/brand.css`，扩展登记为 `S21-D07`（`NOT_STARTED`） |
| 组件八态 / a11y 登记 | `components:registry:check` / `--strict` | 既有（本轮未复跑） | `--strict` EXIT=1 保持；65 组件 `VERIFIED 0 / PARTIAL 9 / NOT_VERIFIED 56` |
| 业务红线零改动 | 无专用脚本；靠提交范围与 §3 P3 约束 | `NOT_STARTED` | 本轮新增文件仅限守卫脚本 / 守卫测试 / `package.json` 一行 / 规范文档；**认证、资金、授权、`org_role`、`sub_quota_limit`、`EnforceOrgQuota`、`IncrOrgUsedQuota` 零改动**，登记为 `S21-D09` |

> **实测口径**：上表 C1–C4 与守卫回归测试均为本轮**真实执行**的命令与退出码，不是复述审计结论。`bun run design:clerk:check` 默认模式输出 `verdict: PASS` / `errors: 0` / `checksPassed: 4`，退出码 0。`test:axe` / `test:business:e2e` / `test:visual:e2e` / `components:registry:strict` / `format:check` 刻意未接 CI，相关轨道只能开发机手动执行；本轮未针对 5.0 重跑视觉 / a11y 回归。

---

## 9. 验证状态

| 项 | 状态 | 说明 |
|---|---|---|
| 本文 18 项逐项规范 | `IMPLEMENTED_NOT_VERIFIED` | 规范文本已撰写（首轮 14 项 + 本轮 4 项），未执行代码改造与验证 |
| F1 / F2 / F3 / F4 事实登记 | `IMPLEMENTED` | 如实写入 §2、§4 各相关项 |
| §2.4 本轮 N1–N7 官方维度核对 | `IMPLEMENTED` | 4 个新增官方来源逐项登记，6 `Adapt` / 1 `Reject`，见 §10 |
| Clerk 运行时依赖零引入 | **`PARTIALLY_VERIFIED`** | 本轮 `design:clerk:check` 静态扫描 C1 / C2 / C3 通过（84 依赖 / 1,287 源文件 / 0 违规）+ 回归测试 8/8；**仅静态门禁层，不等于运行时或平台验收通过** |
| 通用组件能力归属一致性 | **`PARTIALLY_VERIFIED`** | 本轮 C4 校验 §2.2 的 11 类能力清单通过；仅文档结构层 |
| Uter 组件 / Token / 主题改造 | `NOT_STARTED` | 按迁移指南分期推进 |
| 认证 / 账户 / 组织视觉改造 | `NOT_STARTED` | 仅允许视觉层，业务零改动 |
| 其余自动化校验器补充 | `NOT_STARTED` | 扁平单层回退检测、Light/Dark 成对扩展、导航 ↔ 注册 ID 关联，见 §10 |
| PC Web / H5 平台 | `NOT_VERIFIED` | 未针对 5.0 重跑视觉 / a11y 回归 |
| Android / iOS / HarmonyOS | `NOT_VERIFIED` | 无实现（决策 D4），不得用 Web 结果代替 |

**总体验证状态：`NOT_VERIFIED`**。本文不得被解读为 `FULLY_IMPLEMENTED_AND_VERIFIED`；C1–C4 的 `PASS` 仅代表静态边界守卫通过，不代表 Clerk 对照的功能 / 视觉 / 平台验收完成。最终状态以 `UDS5-S25`（验收规范）与最终验收报告为准。

---

## 10. 差异与例外登记（本轮新增）

| 编号 | 差异 / 例外 | 状态与处置 |
|---|---|---|
| S21-D01 | **N1 Theme editor**：Clerk 有交互式主题预览工具，Uter 只有静态 `showcase.html` + `--check` 17 条 | `REGISTERED_NOT_STARTED`：只借鉴「主题变更可见、可校验」原则，交互预览不作验收要求，不引入工具 |
| S21-D02 | **N2 Custom menu items**：官方仅对 `OrganizationProfile` / `UserButton` / `UserProfile` 开放；Uter 导航项聚合自 `section-registry` | `REGISTERED_NOT_STARTED`（`S21-D08`）：不改权限模型，不改为前端 `<Show />` 授权 |
| S21-D03 | **N3 Email/SMS templates**：官方 Dashboard 预览 / 回滚 / 跨环境复制 / 每模板投递开关 / webhook；Uter 邮件模板为 `common/email_template.go` 硬编码，且**无短信网关** | `REGISTERED_NOT_IMPLEMENTED`：治理理念落到 `UDS5-S32`，不引入 Clerk 模板系统与 webhook 契约；短信整节维持 `NOT_IMPLEMENTED` |
| S21-D04 | **N4 Build your own UI**：官方提供包装相同 API 端点的 headless primitives | `REJECT_DEPENDENCY`：只借鉴「优先复用 + 分层可替换」，组件扩展路径仍以 `UDS5-S15` 为唯一口径 |
| S21-D05 | **N5 simple theme / 稳定类边界**：官方以 `simple` theme 作 BYO CSS 干净起点，`cl-*` 锁图标前为稳定类 | `ADAPT_PRINCIPLE`：落为 Uter「公开 props 是稳定契约、内部 DOM/类名不可依赖」；不引入 `cl-*` 与 `appearance.elements` |
| S21-D06 | **N6 CSS 变量驱动动态主题**（2025-07-08）：`var(--ds-color-*)` + `prefers-color-scheme` / `[data-theme]` 自动切换，依赖 `color-mix()` | `REJECT_REGRESSION`：Uter 已有静态两层 Token + 三维 `data-theme-*` 正交，引入运行时派生会绕过 T1–T17；成对校验扩展登记为 `S21-D07` |
| S21-D07 | **Light/Dark 成对校验器覆盖不足**：`check-design-system-5.0.mjs` 仅校验 `generated/brand.css` 的品牌变量 | `REGISTERED_NOT_STARTED`：`UDS5-S10` `S10-D4` 仍标 `NOT_VERIFIED`，扩展到全量语义色待办 |
| S21-D08 | **导航项 ↔ 注册组件 ID 双向可定位** 缺实现：首轮 §4.9 仅建议文字，无落地校验器 | `REGISTERED_NOT_STARTED`：`UDS5-S11` 的 `section-registry` 为落点，本轮不改导航实现 |
| S21-D09 | **N7 localization prop 为 Experimental**（F2），官方键机制（英文文件查键 / 嵌套键 / `{{applicationName}}` 插值）与 Uter 铁律同构 | `REJECT_AS_CONTRACT`：仅作理念对照，严禁作为稳定 i18n 契约或依赖；Uter 维持英文原文作 key + 7 locale + `static-keys.ts` 登记 |
| S21-D10 | **首轮 §8 三项「未建立」校验器**：Clerk 依赖零引入、通用组件能力归属性、业务红线零改动 | **前两项本轮已闭合**（C1–C4 守卫 + 8/8 回归测试）；**第三项仍 `NOT_STARTED`**，改为「提交范围 + §3 P3 约束」人工把关，未新增专用脚本，不虚构为已自动化 |
| S21-D11 | **守卫脚本产物边界**：`check-clerk-boundary.mjs` 支持 `--root` / `--docs` 仅供回归测试注入沙箱，默认模式不写任何文件 | `VERIFIED`：默认模式 `generated: false`，扫描 84 依赖 / 1,287 源文件 / 11 能力，`errors: 0`；测试沙箱位于 `os.tmpdir()`，`afterAll` 清理 |
| S21-D12 | **业务红线零改动**：本轮新增 / 修改文件不含 `web/src` 运行时代码（守卫测试位于 `__tests__`）、不含 Go 后端、不含认证 / 资金 / 授权逻辑 | `VERIFIED_BY_SCOPE`：改动清单见 CHANGELOG §6.1；`org_role` / `sub_quota_limit` / `EnforceOrgQuota` / `IncrOrgUsedQuota` 零改动 |

> 本节编号采用 `S21-Dxx` 两位数形式，与 5.0 新分册体例一致；`UDS5-S21` 首轮无差异表，本节为本轮新增，历史审计报告 `UDS5-AUDIT-02` 保持原样作历史快照。

**总体验证状态：`NOT_VERIFIED`**。本文不得被解读为 `FULLY_IMPLEMENTED_AND_VERIFIED`；最终状态以 `UDS5-S25`（验收规范）与最终验收报告为准。
