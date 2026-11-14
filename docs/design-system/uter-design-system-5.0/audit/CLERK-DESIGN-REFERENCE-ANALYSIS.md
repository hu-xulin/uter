# CLERK-DESIGN-REFERENCE-ANALYSIS — Clerk 官方设计参考核实报告

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-AUDIT-02` |
| 版本 | `5.0.0-draft` |
| 状态 | `IMPLEMENTED`（研究完成；`Decision` 列中的代码实施状态见各条 `Uter Adaptation`） |
| 核实日期 | 2026-11-14 (GMT+8) |
| 核实方式 | 对 Clerk 官方页面逐页取回并提取原文；**不使用截图、旧教程或第三方解读作为事实来源** |
| 约束 | 用户 PART 1.3 / PART 5：不得把 Clerk 不具备的能力描述为 Clerk 官方能力；不得照搬品牌 |

---

## 1. 官方资料清单与核实结果

| # | URL | 官方标题 / 状态 | 本次提取的关键事实 |
|---|---|---|---|
| 1 | `https://clerk.com/` | *Clerk \| Authentication and User Management* | 主标题「Everything you need for authentication」、副标题「More than APIs. The complete user layer for modern apps.」；产品定位 4 类：User Authentication / Multi-tenancy / Enterprise Authentication / Agent Authentication；首页以真实组件样本（Manage Account / Profile / Billing / Organization / Members / Roles & Permissions / OAuth Consent / Waitlist）演示，而非静态截图；**营销首页本身不声明品牌色值或字号 Token，但官方 Variables 文档（来源 4）另行公布了 24 个主题变量与默认值——含 `colorPrimary` 示例值 `#6c47ff`——故「Clerk 未公布任何 Token」的表述不准确，本文 §2.3 已据实补充** |
| 2 | `https://clerk.com/docs/guides/customizing-clerk/overview` | *Customizing Clerk* | 官方定义 **4 层定制**：Themes → `appearance` prop（variables）→ Bring your own CSS（`appearance.elements` + `cl-*` 稳定类）→ Build your own UI（低层 primitives / custom flows）；另有 Theme editor / Custom menu items / Email & SMS templates / Localization；明确注明 **原生 iOS / Android 使用独立的 `ClerkTheme` 主题系统** |
| 3 | `https://clerk.com/docs/guides/customizing-clerk/appearance-prop` | *`Appearance` prop*（自动落到 Next.js 版 `overview.md`） | `appearance` 属性共 6 个：`captcha?` / `cssLayerName?` / `elements?` / `options?` / `theme?` / `variables?`；`variables` = 全局主题覆盖（颜色、字体），`elements` = 细粒度元素覆盖，`theme` = 基础主题，`options` = 难以纯 CSS 实现的布局配置，`cssLayerName` = 控制 CSS 层叠；可作用于 `ClerkProvider`（全局）、按组件名（该类组件全部实例）、单组件实例三个层级；嵌套组件需经 `userProfileProps.appearance` 等专用 prop 传递 |
| 4 | `https://clerk.com/docs/guides/customizing-clerk/appearance-prop/variables` | *`Variables` prop* | **扁平 24 个变量**（非 primitive/semantic 两层）：`borderRadius, colorBackground, colorBorder, colorDanger, colorForeground, colorInput, colorInputForeground, colorModalBackdrop, colorMuted, colorMutedForeground, colorNeutral, colorPrimary, colorPrimaryForeground, colorRing, colorShadow, colorShimmer, colorSuccess, colorWarning, fontFamily, fontFamilyButtons, fontFamilyMono, fontSize, fontWeight, spacing`；默认 `borderRadius 0.375rem`、`fontSize 0.8125rem`、`spacing 1rem`、`fontFamily inherit`、`fontWeight {400,500,600,700}`；全部映射为 `--clerk-*` kebab-case CSS 变量；**2025-07-15 起 6 个键弃用**：`colorText→colorForeground`、`colorTextOnPrimaryBackground→colorPrimaryForeground`、`colorTextSecondary→colorMutedForeground`、`spacingUnit→spacing`、`colorInputText→colorInputForeground`、`colorInputBackground→colorInput`；主题系统用 `color-mix()`（Chrome 111+/FF 113+/Safari 16.2+）与相对颜色语法（Chrome 119+/FF 120+/Safari 16.4+）自动派生色阶，故官方建议传直接色值而非 CSS 变量以兼容旧浏览器 |
| 5 | `https://clerk.com/docs/guides/customizing-clerk/appearance-prop/themes` | *Themes* | **6 套预置主题**：default / simple / shadcn / dark / shadesOfPurple / neobrutalism（`@clerk/ui/themes`）；`theme` 可传数组叠加，「后定义者优先」；`variables` 与 `theme` 可组合；default 主题同时支持 light/dark，靠 CSS `color-scheme: light dark`、`.dark` 类、`[data-theme='dark']` 或 `prefers-color-scheme` 切换；**`shadcn` 主题明确兼容 Tailwind CSS v4**（v3 需手工传 variables），并要求在 `global.css` 中 `@import '@clerk/ui/themes/shadcn.css'` 以便 Tailwind 扫描类名 |
| 6 | `https://clerk.com/docs/guides/customizing-clerk/appearance-prop/bring-your-own-css` | *Bring your own CSS* | 组件 DOM 带稳定类 `cl-formButtonPrimary cl-button 🔒 cl-internal-*`：**锁图标之前**的类可依赖，之后为内部类禁止依赖；`appearance.elements` 的键 = 去掉 `cl-` 前缀的类名（如 `formButtonPrimary`），值可为类名字符串、Tailwind 类、CSS Modules 或内联 CSS 对象（支持 `'&:hover, &:focus, &:active'` 嵌套）；`simple` 主题用于移除高级样式便于自定义；**Tailwind v4 必须设置 `cssLayerName`** 才能让 Tailwind 工具类在 Clerk 样式之后生效 |
| 7 | `https://clerk.com/docs/guides/customizing-clerk/elements` | ***Clerk Elements, Deprecated*** | ⚠️ **已弃用**。随 **Clerk Core 3（2026-03-03）** 发布，官方推荐改用 redesigned hooks（暴露 stateful objects / step methods / structured field-level errors）。原定义：unstyled、composable、内置行为（可访问的 OTP 分段输入、即时密码校验）、支持 `className` 与 `asChild` 组合；历史上仅支持 Next.js App Router + Core 2。本次 **不把 Elements 当作现行 API 引入或描述** |
| 8 | `https://clerk.com/docs/guides/customizing-clerk/localization` | ***Localization prop, Experimental*** | ⚠️ **Experimental**。官方明确标记「may change or be removed without notice」；`@clerk/localizations` 约 50 个 BCP 47 语言（含 `zhCN` / `zhTW` / `frFR` / `jaJP` / `ruRU` / `viVN`），tree-shakeable、支持子路径与动态 import 懒加载；自定义方式 = 覆盖键（`formButtonPrimary`、嵌套 `signUp.start.subtitle`）、`unstable__errors` 错误文案、管道修饰符 `{{ date \| timeString('en-US') }}` 与链式管道；**Account Portal 保持英文，不受 localization 影响** |
| 9 | `https://clerk.com/docs/reference/components/overview` | *Component Reference* | 官方组件目录：Authentication 8（SignIn / SignUp / GoogleOneTap / OAuthConsent / TaskChooseOrganization / TaskResetPassword / TaskSetupMFA / Waitlist）、User 3（UserAvatar / UserButton / UserProfile）、Organization 5（CreateOrganization / OrganizationProfile / OrganizationSwitcher / OrganizationList / InviteMembersButton）、Billing 4（PricingTable / CheckoutButton / PlanDetailsButton / SubscriptionDetailsButton）、Control 12（ClerkLoaded / ClerkLoading / ClerkFailed / ClerkDegraded / Show / RedirectTo* 等）、Unstyled 4、Utilities 1（UNSAFE_PortalProvider）；另有「Secured by Clerk」品牌徽标（生产环境移除需付费方案） |

### 1.1 Clerk **不提供**的官方能力（严禁虚构）

依据来源 9 的完整目录与来源 2 的四层定制说明，Clerk 官方文档**没有**定义或提供以下通用组件/规范：Data Table / DataTable 排序筛选分页、Charts（折线/柱/饼/面积）、DatePicker / DateRangePicker / Calendar、FileUpload / Dropzone、Image / Lightbox、Toast / Snackbar / Banner 通用规范、Drawer / Sheet、CommandMenu、Stepper、Timeline、Tree、Transfer、Timeline、Skeleton / Empty State 通用规范、Z-index / Elevation 分层规范、WCAG 2.2 AA 条款级对照、HarmonyOS 支持。

> 这些内容在 PART 1.3 中仍要求逐项分析，因此下表对它们的 `Reference` 统一写「Clerk 官方未提供该能力（已核实）」，`Decision` 统一为 `Reject`，`Uter Adaptation` 写 Uter 自有规范来源。**不得写成「Clerk 的表格设计是……」**。

---

## 2. 逐项参考分析（23 项，字段严格按 PART 1.3）

### 2.1 品牌与视觉语言

| 字段 | 内容 |
|---|---|
| Reference | 来源 1：定位「the complete user layer for modern apps」，四类认证产品；首页用真实组件样本演示；来源 9 有「Secured by Clerk」品牌徽标规则 |
| Design Principle | 以身份/账户为中心的克制、专业 B2B SaaS 语言；信任感优先于装饰 |
| Visual Behavior | 卡片式账户面板、清晰分区标题、低饱和中性底 + 单一强调色；官方 Variables 文档公布了 24 个主题变量与默认值（`borderRadius 0.375rem`、`spacing 1rem`、`fontSize 0.8125rem`=13px、`fontWeight {400,500,600,700}`），并以 `colorPrimary: '#6c47ff'` 作为主色示例；但默认 `fontFamily` 为 `inherit`、未公布品牌字体族与完整色阶 hex（见 §2.3） |
| Interaction | 组件内联展开账户/组织/计费管理，避免整页跳转 |
| Uter Adaptation | 保留 Uter 自有品牌色（`#5B5EE6` 系列）、Inter + Noto Sans SC、优特智能品牌名；只借鉴「克制 + 表面色差建立层级」 |
| Difference | Uter 是 API 网关控制台（含渠道/模型/计费/日志），信息密度远高于身份组件；Uter 品牌为靛紫，不采用 Clerk 紫色或任何 Clerk 标识 |
| Decision | **Adapt** |

### 2.2 页面布局

| 字段 | 内容 |
|---|---|
| Reference | 来源 1 的账户/组织面板为「左侧分区导航 + 右侧内容」；来源 9 的 UserProfile / OrganizationProfile 支持自定义页面项 |
| Design Principle | 账户类信息用持久二级导航，减少上下文丢失 |
| Visual Behavior | 卡片容器 + 分组标题 + 分隔线；内容区窄而居中 |
| Interaction | 分区切换不重载整页 |
| Uter Adaptation | 落入 5.0 `11-LAYOUT-STANDARD.md` 的 App Shell / Sidebar / Content Container；Uter 后台最大宽度 1280px、营销页 1800px 保持不变 |
| Difference | Uter 已有 9 个子域的 `system-settings` 路由树，需三级导航；Clerk 只覆盖账户/组织两级 |
| Decision | **Adapt** |

### 2.3 导航

| 字段 | 内容 |
|---|---|
| Reference | 来源 2「Custom menu items」：UserButton / UserProfile / OrganizationProfile 支持自定义菜单项与排序；来源 9 Control 组件用 `<Show />` 按认证/授权状态控制可见性 |
| Design Principle | 导航项可插拔、按权限渲染 |
| Visual Behavior | 菜单分组、紧凑行高、状态区分 |
| Interaction | 点击展开、键盘可达 |
| Uter Adaptation | 沿用 Uter 既有 Sidebar 选中态（靛蓝文字 + `bg-primary/10` + 图标变蓝、去粗体）与 `ROLE.ADMIN` / `SUPER_ADMIN` 守卫；补「按注册组件 ID 定位导航实现」 |
| Difference | Uter 权限由后端 Casbin + 路由 `beforeLoad` 决定，不得因参考 Clerk 改为前端 `<Show />` |
| Decision | **Adapt** |

### 2.4 Typography

| 字段 | 内容 |
|---|---|
| Reference | 来源 4：`fontFamily`（默认 `inherit`）、`fontFamilyButtons`、`fontFamilyMono`（默认系统 mono 栈）、`fontSize`（默认 `0.8125rem` = 13px，可为 `{xs,sm,md,lg,xl}`）、`fontWeight`（`{normal:400,medium:500,semibold:600,bold:700}`） |
| Design Principle | 极少量全局变量控制整套组件排版 |
| Visual Behavior | 13px 基准、四级字重、按钮可独立字体 |
| Interaction | 无 |
| Uter Adaptation | **不采用 13px 基准**（Uter 正文 14/22、最小 12px、长文本 16/26 是已定案红线）；采纳「按钮字体可独立配置」理念，落到 5.0 `--ds-font-*` 语义别名；`@theme --text-*` 保留 |
| Difference | Uter 有 18 档 `@theme` 字号阶梯 + 密度档 + `simple-large` 大字预设，Clerk 为单一 5 档对象；Uter 禁止任意 `text-[15px]` |
| Decision | **Adapt** |

### 2.5 Colors

| 字段 | 内容 |
|---|---|
| Reference | 来源 4：扁平 18 个颜色变量（primary / foreground / background / muted / mutedForeground / border / input / inputForeground / danger / success / warning / neutral / ring / shadow / shimmer / modalBackdrop / primaryForeground）→ `--clerk-*`；`colorNeutral` 用 `color-mix()` 与相对颜色语法自动派生悬停/边框/下拉色阶 |
| Design Principle | 少量语义变量 + 运行时派生，避免维护大量色阶 |
| Visual Behavior | 中性底 + 单一强调色 + 状态色 |
| Interaction | hover 由派生色阶表达 |
| Uter Adaptation | Uter 已有 **Primitive → Semantic 两层** + 45 个 `--ds-color-*` + DTCG 品牌真源，且 T13–T15 明令禁止用透明度凑层级；保留现有体系，仅借鉴「运行时派生需有单一出口」补进 5.0 `03-COLOR-STANDARD.md` |
| Difference | Clerk 是扁平单层（无 primitive/semantic 分离），且依赖较新 CSS 颜色函数（有浏览器下限）；Uter 静态声明、无运行时依赖、兼容面更宽 |
| Decision | **Adapt** |

### 2.6 Forms

| 字段 | 内容 |
|---|---|
| Reference | 来源 7（历史）Clerk Elements 提供可访问 OTP 分段输入与即时密码校验；来源 3 `options` 配置 SignIn/SignUp 布局与链接；来源 8 `unstable__errors` 可覆盖字段错误文案 |
| Design Principle | 表单逻辑内建、错误结构化、布局可配置 |
| Visual Behavior | 垂直字段栈、字段级错误就近展示 |
| Interaction | 即时校验、分步流程 |
| Uter Adaptation | Uter 已有 `react-hook-form + zod`、`ui/form.tsx` / `field.tsx` / `form-label-tier.tsx`、`input-otp.tsx`、`handleServerError`；5.0 `18-FORM-AND-VALIDATION-STANDARD.md` 补「错误优先级 / 未保存提醒 / 防重复提交」 |
| Difference | Uter 错误来自后端 API 契约，Clerk 错误来自其身份服务；不得替换 Uter 的认证流程 |
| Decision | **Adapt** |

### 2.7 Buttons

| 字段 | 内容 |
|---|---|
| Reference | 来源 6：`cl-formButtonPrimary` 为稳定类，`appearance.elements.formButtonPrimary` 可覆写；支持 `&:hover, &:focus, &:active` 嵌套选择器 |
| Design Principle | 主操作有稳定可覆写钩子，且**状态必须显式定义** |
| Visual Behavior | 单一主按钮主导，其余为次级 |
| Interaction | hover / focus / active 三态齐备（官方示例同时写三态） |
| Uter Adaptation | Uter `ui/button.tsx` 已用 `cva()` 定义 6 variant × 9 size + `loading` prop；5.0 `14-COMPONENT-STANDARD.md` 要求每个组件补齐 default/hover/focus/pressed/disabled/loading/error/success 八态并登记证据 |
| Difference | Uter 用 variant 组合而非 `appearance.elements` 覆写；不引入 `cl-*` 类体系 |
| Decision | **Adopt**（仅采纳「状态必须齐备」的原则） |

### 2.8 Inputs

| 字段 | 内容 |
|---|---|
| Reference | 来源 4：`colorInput` / `colorInputForeground` / `colorBorder` / `colorRing`；来源 7（历史）可访问 OTP 输入与即时密码校验 |
| Design Principle | 输入底色、文字、边框、焦点环四个变量独立 |
| Visual Behavior | 1px 边框、聚焦环、字段级提示 |
| Interaction | 聚焦环 + 即时校验 |
| Uter Adaptation | Uter 有 `ui/input.tsx` / `secret-input.tsx` / `input-otp.tsx` / `input-group.tsx`；H5 输入 ≥16px 防 iOS 缩放；焦点环 2px `ring-2` 为现行裁决（见 `UDS5-S13` §7，2026-11-14 裁决），装饰性 `ring-1` 描边 1px 为独立保留值、不承载焦点语义 |
| Difference | Uter 输入类型更多（密钥、文件、OTP、组合输入），且需满足 12px 最小字号与 T1–T17 |
| Decision | **Adapt** |

### 2.9 Tables

| 字段 | 内容 |
|---|---|
| Reference | **Clerk 官方未提供通用 Data Table 能力**（来源 9 组件目录无表格组件；来源 2 四层定制仅针对身份组件）。首页「Members」「Roles & Permissions」为产品演示内容，不是可复用表格组件规范 |
| Design Principle | 不适用 |
| Visual Behavior | 不适用（不描述为 Clerk 规范） |
| Interaction | 不适用 |
| Uter Adaptation | 由 5.0 `19-DATA-DISPLAY-STANDARD.md` + `web/src/components/data-table/`（24 条导出）自主定义：排序 / 筛选 / 搜索 / 分页 / 行选 / 批量 / 列可见性 / 响应式 / 空 / 加载 / 错误 |
| Difference | Uter 表格是核心业务控件，Clerk 无对应能力 |
| Decision | **Reject** |

### 2.10 Cards

| 字段 | 内容 |
|---|---|
| Reference | 来源 1 账户/组织/计费面板以卡片容器呈现；来源 4 `colorBackground` 定义为「card container 背景色」 |
| Design Principle | 卡片是账户信息的默认容器 |
| Visual Behavior | 表面色差 + 细边框建立层级，不依赖重阴影 |
| Interaction | 卡片内内联操作 |
| Uter Adaptation | 与 Uter 既有「优先表面色差与边框、限制阴影」原则一致；`ui/card.tsx` / `titled-card.tsx` 保留；5.0 `07-ELEVATION-AND-BORDER-STANDARD.md` 固化 |
| Difference | Uter 另有统计卡、指标卡、渠道卡等业务变体，需 5.0 单独定义 |
| Decision | **Adopt** |

### 2.11 Dialogs

| 字段 | 内容 |
|---|---|
| Reference | 来源 9 `OAuthConsent` 为授权确认界面；来源 3 说明「组件打开另一个组件」时须经 `userProfileProps.appearance` 等专用 prop 传递外观（嵌套弹层样式作用域） |
| Design Principle | 嵌套弹层有明确的外观作用域边界 |
| Visual Behavior | 居中卡片 + 遮罩 |
| Interaction | 确认 / 取消、焦点管理 |
| Uter Adaptation | Uter `ui/dialog.tsx` / `alert-dialog.tsx` / `components/dialog.tsx` / `confirm-dialog.tsx` 已覆盖；5.0 补「嵌套弹层外观继承规则」与焦点陷阱测试用例要求 |
| Difference | Uter 基于 Base UI，无 `ClerkProvider` 外观传递链 |
| Decision | **Adapt** |

### 2.12 Dropdowns

| 字段 | 内容 |
|---|---|
| Reference | 来源 9 `UserButton` / `OrganizationSwitcher` 为下拉型组件；来源 2 支持自定义菜单项与排序；来源 6 `cl-*` 稳定类可覆写 |
| Design Principle | 菜单项可扩展、顺序可调整 |
| Visual Behavior | 紧凑菜单、悬停态由 `colorNeutral` 派生 |
| Interaction | 点击/键盘展开、选中 |
| Uter Adaptation | Uter `ui/dropdown-menu.tsx` / `select.tsx` / `combobox.tsx` / `menubar.tsx` 已覆盖；5.0 要求 `aria-expanded` / `aria-selected` 与视觉状态一致 |
| Difference | Uter hover 态走专用 `*-hover` Token（T14），禁止 `hover:bg-X/NN` |
| Decision | **Adapt** |

### 2.13 Popovers

| 字段 | 内容 |
|---|---|
| Reference | 来源 9 `UserButton` 点击后展开 `UserProfile`；来源 3 明确顶层 `appearance` 只作用于接收它的组件，被打开组件需专用 prop 传外观 |
| Design Principle | 浮层作用域显式、不隐式继承 |
| Visual Behavior | 小型浮层卡片 |
| Interaction | 点击展开、外部点击关闭 |
| Uter Adaptation | Uter `ui/popover.tsx` / `hover-card.tsx` 已有；5.0 把「浮层外观作用域」写入 `17-INTERACTION-STANDARD.md` |
| Difference | Uter 无 appearance 对象，作用域由 React props / Portal 决定 |
| Decision | **Adapt** |

### 2.14 Feedback

| 字段 | 内容 |
|---|---|
| Reference | 来源 9 `ClerkLoaded` / `ClerkLoading` / `ClerkFailed` / `ClerkDegraded` 是**认证状态控制组件**，不是通用 Toast / Alert / Banner 规范；来源 4 `colorDanger` / `colorSuccess` / `colorWarning` 为状态色变量 |
| Design Principle | 按加载 / 失败 / 降级状态分离渲染 |
| Visual Behavior | 状态色区分 |
| Interaction | 状态切换自动渲染 |
| Uter Adaptation | Uter 有 `sonner` / `ui/alert.tsx` / `empty-state` / `error-state` / `loading-state`；5.0 `20-NOTIFICATION-STANDARD.md` 区分成功 / 信息 / 警告 / 可恢复错误 / 不可恢复错误五类 |
| Difference | Clerk 无通用通知规范；Uter 需覆盖业务操作反馈（远超认证状态） |
| Decision | **Adapt**（仅限状态分离原则） |

### 2.15 Loading

| 字段 | 内容 |
|---|---|
| Reference | 来源 9 `ClerkLoading` / `ClerkLoaded` 控制组件；来源 4 `colorShimmer` 定义为「avatar shimmer 颜色」 |
| Design Principle | 加载状态是一等渲染分支 |
| Visual Behavior | shimmer / 骨架 |
| Interaction | 状态切换 |
| Uter Adaptation | Uter `ui/spinner.tsx` / `skeleton.tsx` / `progress.tsx` / `loading-state.tsx` 已有；5.0 补 Skeleton 动效、Reduce Motion 与「空/加载/错误三态齐全」页面检查 |
| Difference | Clerk 只针对身份组件；Uter 有 `foundations/motion.css` 的 7 个 `ds-motion-*` utility |
| Decision | **Adapt** |

### 2.16 Empty States

| 字段 | 内容 |
|---|---|
| Reference | **Clerk 官方未提供通用 Empty State 规范**（来源 9 无该组件；首页「No invitations to display」为产品文案，不是规范） |
| Design Principle | 不适用 |
| Visual Behavior | 不适用（不描述为 Clerk 规范） |
| Interaction | 不适用 |
| Uter Adaptation | 由 Uter `components/empty-state.tsx`（唯一正式封装）+ `ui/empty.tsx` 定义；5.0 要求合并 3 处同名重复实现 |
| Difference | Uter 存在重复实现问题，Clerk 无对应参照 |
| Decision | **Reject** |

### 2.17 Authentication

| 字段 | 内容 |
|---|---|
| Reference | 来源 9：SignIn / SignUp / GoogleOneTap / OAuthConsent / Waitlist / TaskResetPassword / TaskSetupMFA 等 8 个认证组件；来源 1 演示「Continue with Google/GitHub」「or」「Email address」「Password」分步表单 |
| Design Principle | 完整身份流程产品化、开箱即用、安全默认内建 |
| Visual Behavior | 居中窄卡片、社交登录优先、分隔线、次要链接 |
| Interaction | 分步、MFA、验证码、魔法链接 |
| Uter Adaptation | **仅参考信息架构与视觉密度**。Uter 的 `(auth)/` 9 个路由、邮箱验证码登录、step-up、WebAuthn/TOTP、微信网页授权、登录 429 限流、iframe 沙箱均为自建且已定案，**一律不替换、不引入 Clerk SDK** |
| Difference | Uter 认证由 Go 后端 + Casbin 控制，Clerk 是托管身份服务；二者架构不可互换 |
| Decision | **Adapt（严格限视觉）** |

### 2.18 User Management

| 字段 | 内容 |
|---|---|
| Reference | 来源 9 `UserAvatar` / `UserButton` / `UserProfile`；来源 2 支持给 `UserProfile` 添加自定义页面；来源 1 演示 Profile / Security / Billing / API keys 分区 |
| Design Principle | 账户自助管理分区化 |
| Visual Behavior | 左分区导航 + 右详情卡片（Profile details / Email Addresses / Connected accounts） |
| Interaction | 内联编辑、添加邮箱、连接账号 |
| Uter Adaptation | Uter `features/profile`（17 文件）、`features/security`（37 文件）、`_authenticated/profile` / `security` 路由已覆盖；5.0 统一分区标题 22/600/30 与卡片标题 18/600/26 |
| Difference | Uter 还有 API Key、钱包、消费日志等网关特有分区 |
| Decision | **Adapt** |

### 2.19 Organization Management

| 字段 | 内容 |
|---|---|
| Reference | 来源 9 `CreateOrganization` / `OrganizationProfile` / `OrganizationSwitcher` / `OrganizationList` / `InviteMembersButton`；来源 1 演示 Members / Roles & Permissions / Verified domains / Billing / API keys 分区与 `org:member` / `org:admin` 角色 |
| Design Principle | 多租户与角色权限产品化 |
| Visual Behavior | 成员表格、角色列表、邀请按钮 |
| Interaction | 创建组织、邀请成员、切换组织 |
| Uter Adaptation | Uter 有 `features/organization`（8 文件）与 `_authenticated/organization/index.tsx`，正在推进 org/tenant 四项需求（配额可见性 / 组织钱包计费 / 角色数据视图 / 部门名）；**5.0 只做 UI 规范映射，不改 `org_role` / `sub_quota_limit` / `EnforceOrgQuota` 等业务逻辑** |
| Difference | Uter 组织与配额/计费强耦合，Clerk 组织为身份侧多租户 |
| Decision | **Adapt（严格限视觉）** |

### 2.20 Responsive

| 字段 | 内容 |
|---|---|
| Reference | 来源 2 明确「原生应用（iOS / Android）使用自己的主题系统 `ClerkTheme`」；来源 5 的 default 主题支持 `prefers-color-scheme`；官方文档**未公布断点数值或 H5 专属断点表** |
| Design Principle | Web 与原生分离，各自主题体系 |
| Visual Behavior | 未公布数值 |
| Interaction | 系统主题跟随 |
| Uter Adaptation | Uter 保持 3.0 §16 五档断点（640/768/1024/1280/1536）、H5 输入 ≥16px、命中区 24px 最小 / 44px 推荐、后台 1280px；5.0 `12-RESPONSIVE-STANDARD.md` 明确 Android/iOS/HarmonyOS 为 `NOT_VERIFIED` |
| Difference | Uter 无原生应用，不能照搬 Clerk 的原生主题分离结论 |
| Decision | **Adapt** |

### 2.21 Accessibility

| 字段 | 内容 |
|---|---|
| Reference | 来源 7（历史）Clerk Elements 自述提供「accessible segmented OTP input」；来源 9 无独立无障碍规范页；**官方未在本次核实的页面中给出 WCAG 2.2 AA 条款级对照或对比度数值表** |
| Design Principle | 可访问性内建于组件而非后置补丁 |
| Visual Behavior | 不适用（不得虚构数值） |
| Interaction | 键盘可达、OTP 分段可访问 |
| Uter Adaptation | Uter 已有 `foundations/accessibility.css`、10 个守卫测试（含 `status-badge-contrast.test.ts` / `accessibility.test.ts`）、`verify-contrast.mjs` 31 条、`test:axe` 2 个 spec；5.0 `13-ACCESSIBILITY-STANDARD.md` 以 WCAG 2.2 AA 为目标，保留 E24 待修登记 |
| Difference | Uter 有可执行的对比度门禁与数值证据，Clerk 本次核实页面未提供等价物 |
| Decision | **Adapt** |

### 2.22 Themes

| 字段 | 内容 |
|---|---|
| Reference | 来源 5：6 套预置主题、`theme: [dark, neobrutalism]` 数组叠加（后者优先）、`variables` 覆盖基础主题、default 支持 light/dark 且由 `color-scheme` / `.dark` / `[data-theme]` / media query 切换；来源 3 `cssLayerName` 控制层叠 |
| Design Principle | 主题可继承、可叠加、可局部覆盖；同一组件在不同作用域可有不同外观 |
| Visual Behavior | Light / Dark 成对 |
| Interaction | 跟随系统或显式切换 |
| Uter Adaptation | Uter 已有 7+ 套 `theme-presets.css` 预设、`.dark` 变体、`data-theme-preset` / `data-theme-radius` / `data-theme-scale` 三维独立；5.0 `10-THEME-STANDARD.md` 采纳「主题继承 + 局部覆盖」并补 Light/Dark 变量成对校验器 |
| Difference | Uter 预设是维度正交（preset/radius/scale 独立），Clerk 是主题对象叠加；Uter 品牌渐变深浅同值是刻意例外 |
| Decision | **Adopt**（理念）/ **Reject**（不引入 `@clerk/ui` 主题包） |

### 2.23 Component Customization

| 字段 | 内容 |
|---|---|
| Reference | 来源 2 四层；来源 3 六个 `appearance` 属性与三个作用域层级；来源 6 `cl-*` 稳定类 + `elements` 键映射 + Tailwind v4 需 `cssLayerName`；来源 7 **Elements 已弃用**；来源 8 localization 为 **Experimental** |
| Design Principle | 定制能力分层递进，越往下控制力越强、维护成本越高；稳定类与内部类明确分界 |
| Visual Behavior | 从变量换色到完全自建 UI |
| Interaction | 定制不改动组件状态机与业务逻辑 |
| Uter Adaptation | 5.0 建立**五层架构 L1 Foundation → L2 Primitives → L3 Components → L4 Patterns → L5 Templates & Applications**，与 Clerk 四层理念同构但按 Uter 工程划分；`15-COMPONENT-API-STANDARD.md` 规定 variant / slot / composition 为唯一扩展路径，禁止 `appearance` 式全局覆写（会绕过 T1–T17 门禁） |
| Difference | Uter 组件是自有 React/Base UI 实现，扩展走 props + cva + 语义 Token；Clerk 是第三方预置组件，扩展走 appearance 对象 |
| Decision | **Adapt** |

---

## 3. 决策汇总

| Decision | 数量 | 项目 |
|---|--:|---|
| **Adopt** | 3 | Buttons（仅状态齐备原则）、Cards、Themes（仅理念） |
| **Adapt** | 17 | 品牌与视觉语言、页面布局、导航、Typography、Colors、Forms、Inputs、Dialogs、Dropdowns、Popovers、Feedback、Loading、Authentication、User Management、Organization Management、Responsive、Accessibility、Component Customization（共 18，其中 Themes 计为 Adopt+Reject 双记，故本表 17 + 1 双记） |
| **Reject** | 4 | Tables、Empty States、Clerk Elements（弃用 API 不引入）、`@clerk/ui` 主题包 / Clerk SDK / Storybook |
| **不提供官方能力，明确标注** | 11 类 | Data Table、Charts、DatePicker/Calendar、FileUpload、Image/Lightbox、Toast/Banner 通用规范、Drawer/Sheet、CommandMenu、Stepper、Timeline/Tree/Transfer、Skeleton/EmptyState 通用规范 |

> 计数说明：Themes 一项同时含 `Adopt`（理念）与 `Reject`（不引入包）两个判定，故上表 Adapt 计 17 项 + Themes 双记 = 正文 18 项 Adapt 判定；总计 23 项均已给出判定。

---

## 4. 禁止事项复核（PART 5）

| 禁止项 | 本次遵守情况 |
|---|---|
| 照搬 Clerk 品牌样式 | ✅ 未采用任何 Clerk 色值、字体、徽标、「Secured by Clerk」文案；Uter 品牌色 / Inter + Noto Sans SC / 优特智能保持不变 |
| 因参考 Clerk 而替换 Uter 认证 / 用户管理 / 组织管理 / 业务权限逻辑 | ✅ 2.17 / 2.18 / 2.19 均明确「严格限视觉」；`org_role` / `sub_quota_limit` / `EnforceOrgQuota` / Casbin / 登录限流等零改动 |
| 把 Clerk 不具备的能力写成官方能力 | ✅ §1.1 逐类列明 11 类未提供能力；2.9 / 2.16 的 Reference 直接写「Clerk 官方未提供」 |
| 依据旧教程 / 截图研究 | ✅ 全部 9 个来源为官方文档；并主动发现 Elements 弃用、Localization 实验性两项时效性事实 |

---

## 5. 研究结论

1. Clerk 的价值不在于「通用组件库」，而在于**分层定制架构**（Themes → variables → 稳定类 BYO CSS → 自建 UI）与**身份域组件的产品化**（认证 / 用户 / 组织 / 计费 / 状态控制）。Uter 5.0 借鉴前者建立五层架构与组件 API 标准，借鉴后者改进认证/账户/组织页面的信息架构与状态完整性。
2. Clerk 官方变量体系是**扁平单层、24 键、依赖 `color-mix()` 运行时派生**；Uter 是 **Primitive/Semantic 两层、245 个唯一变量、静态声明 + 严格门禁**。Uter 的体系更严，5.0 保留，不倒退到扁平单层。**纠正**：Clerk 官方 `appearance.variables` 文档**确实公布了**这 24 个变量的默认值（`borderRadius 0.375rem`、`spacing 1rem`、`fontSize 0.8125rem`、字重 `{400,500,600,700}`）与 `colorPrimary` 示例值 `#6c47ff`（品牌紫），并列出 6 个弃用键与浏览器兼容说明；但默认 `fontFamily` 为 `inherit`、未把品牌字体族（Geist 等）与完整色阶 hex 作为变量契约公开。因此「官方未公布任何 Token」的早前表述不准确，已据实在 §1 来源 1、§2.1、§2.3（参考标准）纠正；这**不改变**「Uter 不采用 13px 基准、不引入 `color-mix()` 运行时派生」的结论。
3. 两项时效性事实必须写入规范：`Clerk Elements` 已随 Core 3 弃用（推荐 hooks）；`localization` prop 仍为 Experimental。因此 5.0 **不引入任何 Clerk 运行时依赖**。
4. 通用组件（表格 / 图表 / 日期 / 上传 / 通知 / 空态 / 骨架等）必须全部由 Uter 自有规范定义，本报告已明确不将其归为 Clerk 能力。
