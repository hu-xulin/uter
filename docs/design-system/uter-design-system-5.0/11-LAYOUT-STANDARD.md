# 11 · 布局规范（Layout Standard）

> UTER Design System 5.0 · 分册 S11。本规范定义「App Shell 到内容区的层级、容器最大宽度、Sidebar/Header/Footer 的职责、粘性头与滚动容器、响应式容器口径」，并把每个结构落到真实代码位置。**5.0 为当前唯一正式体系，3.0 保留为历史**，本文引用 3.0 §16 仅用于溯源。除标明已核实的真源代码位置外，未宣称任何测试通过或平台验收。

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S11` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01`（UTER Design System 5.0 总纲） |
| 生效日期 | `2026-11-14` |
| 适用范围 | `web/src/routes/`、 `web/src/components/layout/`、`web/src/features/` 的页面骨架；后台 / 营销 / H5 与 Electron 桌面封装一致适用 |
| 验证状态 | `NOT_VERIFIED` |

---

## 1. 总则

| 编号 | 原则 | 说明 |
|---|---|---|
| L-1 | 单一 App Shell | 根路由唯一注入全局 Provider 与全局浮层；鉴权 / 公开两套布局各自单一实现。 |
| L-2 | 判据分宽 | 内容区宽度按「用户在里面干活（后台）」还是「用户在里面被说服（营销）」判定（3.0 §16.2:2297）。 |
| L-3 | 不无限拉伸 | 页面内容不得无限拉伸；主要内容区必须有合理最大宽度。 |
| L-4 | 关系稳定 | Sidebar 与 Main Content 关系在断点间保持稳定；表格须有最小宽度或自适应策略。 |
| L-5 | 层级单一 | 每个结构层有唯一实现根，禁止 3 处同名 `EmptyState` 式的重复骨架（BASELINE-AUDIT §5）。 |
| L-6 | 品牌基线不动 | 后台 1280px / 营销 1800px、5 档断点、4pt 间距属 3.0 已定案基线，5.0 继承。 |
| L-7 | 不触碰业务契约 | 布局调整只允许改视觉与组件复用，不得改 API 契约、资金逻辑、数据库结构或安全约束（BASELINE-AUDIT §6 业务红线）。 |

---

## 2. 结构层级（从外到内）

| 层 | 定义 | 真实实现 |
|---|---|---|
| L0 根路由 | 全局 Provider / 全局浮层 / 错误边界 / 系统配置加载 | `web/src/routes/__root.tsx` |
| L1 App Shell | 鉴权态 / 公开态两套外壳 | `components/layout/components/authenticated-layout.tsx`、`public-layout.tsx` |
| L2 Page Container | 页面级外壳（分区标题、背景装饰、页脚） | `section-page-layout.tsx`、`public-page-glow.tsx`、`page-footer.tsx` |
| L3 Content Container | 主内容渲染出口 | `main.tsx` |
| L4 Header / Sidebar / Footer | 持久框架件 | `app-header.tsx` / `app-sidebar.tsx` / `footer.tsx` 等 |
| L5 Content Area | 具体路由内容（73 个路由源码） | `web/src/routes/**`、`web/src/features/**` |

### 2.1 根路由 `__root.tsx`（已核实）

`web/src/routes/__root.tsx:19-50` 的真实职责：

| 项 | 内容 |
|---|---|
| 路由创建 | `createRootRouteWithContext`（`:22`）+ `<Outlet />`（`:23`） |
| 全局 Provider | `ThemeCustomizationProvider`（`:36`，S10 主题注入） |
| 全局浮层 | `<Toaster />`（`components/ui/sonner.tsx`，`:35`） |
| 错误边界 | `ErrorBoundary` / `GeneralError` / `NotFoundError`（`:34,39-40`） |
| 系统配置 | `useSystemConfig({ autoLoad: true })`（`:57`，logo / 系统名） |
| 认证引导 | `bootstrapAuthentication` / `subscribeAuthSessionEvents` / `useAuthStore`（`:43-50`） |
| 停用项 | 顶部加载进度条当前停用（`:30-33`），组件与依赖保留、勿删 |

---

## 3. App Shell / Page Container / Content Container

| 结构 | 规定 | 真实位置 |
|---|---|---|
| App Shell（鉴权） | 持久 Sidebar + Header + 内容区；Sidebar 选中态靛蓝文字 + `bg-primary/10` + 图标变蓝、去粗体（Clerk 参考分析 2.3） | `authenticated-layout.tsx` |
| App Shell（公开） | 公开页 Header/Footer + 营销宽屏展示面 | `public-layout.tsx`、`public-header.tsx`、`public-header-variant.ts` |
| Page Container | 分区标题 22/600/30、卡片标题 18/600/26（Clerk 参考分析 2.18）；背景装饰只经 `ds-decor-*`；运行时 `@theme` 真值差异（h1 `--text-4xl` 30/38、h2 `--text-3xl` 24/32）见 `04 §4.3`（Adapt / `NOT_VERIFIED`，不改代码值） | `section-page-layout.tsx`、`public-page-glow.tsx` |
| Content Container | 只负责主内容出口与内边距，不承担圆角/投影 | `main.tsx` |
| Content Area | 后台 1280px 上限、营销 1800px 上限（§6） | 各路由文件 |
| 禁止 | 页面各自实现第二套 Shell；根路由重复注入 Provider / Toaster | L-1 |

---

## 4. Grid / Columns（如实登记现状）

| 项 | 现状 / 规定 |
|---|---|
| 专用组件 | **本轮只读核查未发现** `web/src/components/layout/` 下存在专用 `Grid` / `Column` 组件；网格由 Tailwind `grid` / `flex` 工具类 + 4px 间距阶梯（T17）+ 断点（S12）表达。 |
| 间距 | 列间距走 `gap-*` 阶梯，禁止 `gap-[…]` 任意值（T17）。 |
| 列数 | 列数随断点降级（S12）；营销多列价格卡在 1440/1920 屏允许突破 1280px（3.0 §16.2）。 |
| 指标数值 | 仪表盘大数字统一 `text-2xl md:text-3xl`（24→30px，768px 起放大），**用 `md` 不用 `sm`**（3.0 §16.2:2299-2303）。 |
| 三栏文档页 | `max-w-[1440px]` 是「左导航 + 正文 + 右目录」总宽，正文仍限 `max-w-3xl`；不要当成内容区破例（3.0 §16.2:2295）。 |
| 状态 | 网格实现未逐路由核对，登记为 `NOT_VERIFIED`（§12 S11-D3），不虚构组件名。 |

### 4.1 栅格规格（业务域蓝图建议 → 5.0 采纳为**规则**，数值走仓库阶梯）

> 来源：业务域蓝图《Spacing and Layout Standard》§3。蓝图的**结构性规则**（列数随视口降级、列间距随视口收窄、复杂数据表可突破栅格但须保持页面边界）**予以采纳**；蓝图的**绝对像素值**与仓库 4px 阶梯对照后按 §4.2 登记差异。

| 视口 | 蓝图列数 | 5.0 采纳 | 蓝图列间距 | 5.0 采纳 | 说明 |
|---|---:|---|---:|---|---|
| Desktop（≥ `lg 1024`） | 12 列 | **12 列** | 24px | **24px**（`gap-6`） | 仓库 4px 阶梯恰好含 24px，**无冲突**，直接采纳 |
| Tablet（`md 768` – `lg 1024`） | 8 列 | **8 列** | 16px | **16px**（`gap-4`） | 无冲突，直接采纳 |
| Mobile（< `md 768`） | 4 列 | **4 列** | 12px | **12px**（`gap-3`） | 无冲突，直接采纳 |

**规则条款**

| # | 规则 | 依据 |
|---|---|---|
| G-1 | 列间距必须取自 4px 阶梯（`gap-3` / `gap-4` / `gap-6`），**禁止** `gap-[…]` 任意值 | T17 |
| G-2 | 列数随视口降级：桌面 12 → 平板 8 → 移动 4；降级由断点（S12 五档）驱动，不得新增设备专属断点 | 蓝图 §3 + S12 |
| G-3 | 复杂数据表允许突破栅格，但**必须保持页面边界与对齐关系**（表格不得撑破 Content Area 的 1280px 上限） | 蓝图 §3 |
| G-4 | 金额列右对齐；文本列左对齐；状态列保持一致宽度（同一列的状态徽标不得因文案长度抖动） | 蓝图 §4 |
| G-5 | 表单标签 / 输入框 / 说明 / 错误提示形成**稳定垂直组**；按钮组按主次顺序排列，移动端必要时纵向堆叠 | 蓝图 §4 |
| G-6 | 页面主滚动区应**唯一且可预期**；表格内部滚动必须明确提示；固定页头 / 页脚不得遮挡焦点元素或错误提示 | 蓝图 §6 |
| G-7 | 内容行长：长篇说明建议每行 **60–90 个拉丁字符等效宽度**；登录、支付确认等任务页须减少无关侧栏与导航干扰；宽屏不得无节制拉伸正文 | 蓝图 §5 |
| G-8 | 移动端底部安全区（Home Indicator）必须纳入布局 | 蓝图 §6 + S12 |

> G-7 与仓库现状的关系：仓库三栏文档页为「总宽 1440px + 正文 `max-w-3xl`」（§6.1），`max-w-3xl` = 48rem = 768px，在 14–16px 正文下约 **85–95 个拉丁字符**，**略高于蓝图建议上限 90**，登记为 `S11-D6`（待复核，不擅自改 `max-w-3xl`）。

### 4.2 页面框架尺寸：蓝图建议 vs 运行时真值（逐项对照）

| 项 | 蓝图建议 | 运行时真值 | 真源 | 判定 |
|---|---|---|---|---|
| Desktop sidebar（展开） | 240px | **220px**（`13.75rem`） | `web/src/components/ui/sidebar.tsx:50` `const SIDEBAR_WIDTH = '13.75rem'` | **冲突**：仓库比蓝图窄 20px |
| Desktop sidebar（折叠 / icon） | 72px | **44px**（`2.75rem`） | `sidebar.tsx:52` `SIDEBAR_WIDTH_ICON = '2.75rem'` | **冲突**：仓库折叠态比蓝图窄 28px |
| Mobile sidebar（Sheet） | — | `17rem` = 272px | `sidebar.tsx:51` `SIDEBAR_WIDTH_MOBILE` | 蓝图未给，移动端抽屉宽度仓库自定 |
| Desktop topbar | 64px | **48px**（`3rem`） | `web/src/styles/theme.css:277` `--app-header-height: 3rem` | **冲突**：仓库比蓝图矮 16px |
| Mobile topbar | 56px | **48px**（同一 `--app-header-height`，未按断点分档） | `theme.css:277` | **冲突**：仓库未区分桌面 / 移动顶栏高度 |
| 页面内边距 | Desktop 32px / Tablet 24px / Mobile 16px | 无统一 Token；实际以 Tailwind `px-*` 分散在各页面（`px-3` 95 处 / `px-4` 45 处 / `px-2` 23 处 / `px-6` 4 处） | `web/src` 全量 `px-* py-*` 统计 | **部分冲突**：仓库无「页面级内边距」单一出口；Mobile 16px 与 `px-4` 一致，Desktop 32px（`px-8`）**在仓库无对应用法** |
| 内容区块间距 | 24–32px | 走 4px 阶梯（`gap-6` / `gap-8`） | Tailwind 阶梯 + T17 | 一致 ✓ |
| 卡片内边距 | 16–24px | 走 4px 阶梯（`p-4` / `p-6`） | Tailwind 阶梯 | 一致 ✓ |
| 密度适配 | Compact 减行高 / 单元间距 / 控件高度；不得仅靠整体 scale 缩小界面 | `data-theme-scale` 改 `--spacing` 与控件尺寸 | S05 / S10 | 一致 ✓（仓库实现方式与蓝图一致） |

**裁决**：全部**保留仓库真值**。理由：① 侧栏 / 顶栏宽度是已上线外观的组成部分，改动会重置 22 页 × 2 视口视觉回归基线；② 仓库的 220px / 44px / 48px 来自 3.0 §13.3 组件尺寸表，**属已定案基线**，蓝图建议值不属于 Uter 品牌基线；③ 页面内边距缺单一出口是**真实治理缺口**（登记为 `S11-D7`），但补 Token 属运行时改动，不在「补全规范」授权范围。

---

## 5. Sidebar / Header / Footer / Sticky Header

### 5.1 Sidebar

| 项 | 真实位置 / 规定 |
|---|---|
| 主实现 | `components/layout/components/app-sidebar.tsx` |
| 导航分组 | `nav-group.tsx`；分组标题 / 紧凑行高 / 状态区分 |
| 视图注册 | `lib/sidebar-view-registry.ts`、`sidebar-view-header.tsx` |
| 导航配置 | `config/top-nav.config.ts`、`config/system-settings.config.ts`、`lib/url-utils.ts` |
| 类型 | `types.ts`（`NavGroup` / `SidebarView`）、`index.ts` 导出收口 |
| 系统设置导航 | `config/system-settings.config.ts:19-38` 从 8 个 `features/system-settings/*/section-registry` 聚合导航项；`:20-29` 从 `lucide-react` 导入 `Box/Route/CreditCard/Layout/Settings/Shield/ShieldAlert/Wrench`（S08） |
| 选中态 | 靛蓝文字 + `bg-primary/10` + 图标变蓝、去粗体；权限由后端 Casbin + 路由 `beforeLoad` 决定，不得改为前端 `<Show />`（Clerk 参考分析 2.3） |
| H5 | 桌面 Sidebar 必须转换为适合移动端的导航方式（S12 / 3.0 §16.3） |

### 5.2 Header

| 项 | 真实位置 |
|---|---|
| 后台头 | `app-header.tsx`、`header.tsx`、`top-nav.tsx`、`header-logo.tsx`、`system-brand.tsx` |
| 公开头 | `public-header.tsx`、`public-header-variant.ts` |
| 品牌 | `system-brand.tsx` / `header-logo.tsx` 承载 Uter 自有品牌资产（S08） |

### 5.3 Footer

| 项 | 真实位置 |
|---|---|
| 公开页脚 | `footer.tsx` |
| 页面级页脚 | `page-footer.tsx` |

### 5.4 Sticky Header / Scroll Container

| 项 | 规定 | 真源 |
|---|---|---|
| Header 高度 | `--app-header-height: 3rem` | `web/src/styles/theme.css:277` |
| Sticky | 粘性头随内容滚动保持可见；焦点环不得被粘性头或浮层覆盖（S13） | 3.0 §15.1 |
| Scroll Container | 滚动容器需独立裁切与滚动语义；跑马灯 `.scroll-container:hover` 暂停动画 | `web/src/styles/index.css:455-456`（S09） |
| 表格横滚 | 表格横向滚动 / 转卡片 / 隐藏非核心列（S12） | 3.0 §16.3 |
| 弹窗 | 弹窗不得超出可视区域（3.0 §16.2） | S07 / S17 |

---

## 6. Content Area / Max Width / Min Width

### 6.1 最大宽度（品牌基线，真实值）

| 场景 | 最大宽度 | 真源 / 表达 |
|---|---:|---|
| 后台内容区（仪表盘 / 设置 / 日志 / 定价管理） | **1280px** | `max-width: 1280px; margin-inline: auto;`（3.0 §16.2:2283-2285） |
| 营销页（首页 / 定价展示 / 关于页） | **1800px** | `--ds-content-max-wide` / `max-w-container-wide`，唯一声明在 §28 `meta.contentMaxWide`（3.0 §16.2:2289-2293），原 E19 编号已注销 |
| 三栏文档外壳 | 1440px（总宽，正文 `max-w-3xl`） | 3.0 §16.2:2295 |

> 判据：**这个页面是「用户在里面干活」还是「用户在里面被说服」？** 前者 1280px，后者按 1800px 登记值（3.0 §16.2:2297）。营销页被压进 1280px 会在 1440/1920 屏留下大片空白，反而更差。

### 6.2 最小宽度 / 自适应

| 项 | 规定 |
|---|---|
| 表格 | 必须具有合理的最小宽度或自适应策略（3.0 §16.2:2274）；H5 可横滚 / 转卡片 / 隐藏非核心列（S12）。 |
| 弹窗 | 不得超出可视区域；移动端 Dialog 必须适配（3.0 §16.2 / §16.3）。 |
| 卡片 | 必须自适应（3.0 §16.3）。 |
| 禁止 | 固定桌面宽度导致 H5 横向溢出（3.0 §16.4）；用缩小字号（低于 12px / H5 输入低于 16px）解决布局问题。 |

### 6.3 Responsive Container

| 项 | 规定 |
|---|---|
| 断点 | 五档 `sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536`（S12 / 3.0 §16.1）。 |
| Gutter | H5 默认左右 16px（3.0 §16.3）。 |
| 密度 | `data-theme-scale` 改 `--spacing` 与控件尺寸（S05 / S10），不改断点定义。 |
| 禁止 | 仅靠缩小 PC 页面实现移动端（S12 / 3.0 §16.4）。 |

---

## 7. system-settings 路由树（真实落点）

`web/src/routes/_authenticated/system-settings/` 下共 **18 个 `.tsx` 文件 / 9 个子域**，是 Uter 三级导航的代表（Clerk 参考分析 2.2 指出 Uter 需三级而 Clerk 只覆盖两级）：

| # | 子域 | 文件 |
|---:|---|---|
| 1 | 根 | `index.tsx`、`route.tsx` |
| 2 | auth | `auth/index.tsx`、`auth/$section.tsx` |
| 3 | billing | `billing/index.tsx`、`billing/$section.tsx` |
| 4 | content | `content/index.tsx`、`content/$section.tsx` |
| 5 | models | `models/index.tsx`、`models/$section.tsx` |
| 6 | operations | `operations/index.tsx`、`operations/$section.tsx` |
| 7 | request-policies | `request-policies/index.tsx`、`request-policies/$section.tsx` |
| 8 | security | `security/index.tsx`、`security/$section.tsx` |
| 9 | site | `site/index.tsx`、`site/$section.tsx` |

| 关联真源 | 内容 |
|---|---|
| `web/src/components/layout/config/system-settings.config.ts` | `getSystemSettingsNavGroups(t)` 聚合 8 个 `section-registry` 的导航项 |
| `web/src/features/system-settings/` | 9 个子域的 feature 实现（BASELINE-AUDIT §6 记该目录 192 文件） |
| `web/src/routeTree.gen.ts` | 自动生成的路由树；`system-settings` 相关声明 181 处命中 |
| `web/src/routes/_authenticated/system-settings/route.tsx` | 子路由外壳（`beforeLoad` 管理员守卫） |

### 7.1 「92 处」数字口径澄清（防止误记）

| 说法 | 核实结论 |
|---|---|
| 「92 处 `system-settings` 路由树」 | **与仓库事实不符，5.0 不采信**。system-settings 路由树为 18 个 `.tsx` / 9 子域；`routeTree.gen.ts` 中 181 处命中；feature 目录 192 文件。 |
| 「92」的真实出处 | `UTER-DESIGN-SYSTEM-3.0.md:2962`（§19.5）记录：T13–T15 补拦截面之前「全库攒了 **92 处**无人发现的（透明度）违规」——这是**静态扫描违规计数**，与 system-settings 路由规模无关。 |
| 处置 | 本文按审计真源登记 18 / 9 / 181 / 192；如需保留「92」表述，只能用于描述 §19.5 的历史违规数，不得标为路由树规模。该差异已同步 team-lead 裁决（S11-D1）。 |

---

## 8. 页面与业务模块落点（S01 五层架构 L5）

| 模块 | 路由（BASELINE-AUDIT §6.1） | 布局约束 |
|---|---|---|
| Dashboard / 统计 | `_authenticated/dashboard/{index,$section}.tsx` | 后台 1280px；指标数值用 `md` |
| 用户管理 | `_authenticated/users/index.tsx` | 后台内容区 |
| API Key | `_authenticated/keys/index.tsx` | 后台内容区 |
| 模型 / 渠道 | `_authenticated/models/{index,$section}.tsx`、`channels/index.tsx` | 管理员守卫 |
| 钱包 / 充值 | `_authenticated/wallet/index.tsx`、`_public/recharge-agreement.tsx` | 业务红线：仅改视觉 |
| 消费记录 | `_authenticated/usage-logs/{index,$section,audit}.tsx` | 表格最小宽度 |
| 价格 | `_public/pricing/{index,$modelId/index}.tsx` | 营销 1800px |
| 系统设置 | `_authenticated/system-settings/` 18 文件 | 三级导航（§7） |
| 认证 | `(auth)/` 9 路由 | 居中窄卡片（Clerk 参考 2.17，仅视觉） |

---

## 9. 禁止事项汇总

1. 禁止各页面自建第二套 App Shell 或重复注入全局 Provider / Toaster。
2. 禁止后台内容区突破 1280px、营销页突破 1800px（除三栏文档 1440px 总宽口径）。
3. 禁止固定桌面宽度导致 H5 横向溢出、禁止仅缩小 PC 页面实现移动端。
4. 禁止 `gap-[…]` 任意列间距、禁止用低于规定字号解决布局。
5. 禁止把 `system-settings` 路由规模误记为 92（见 §7.1）。
6. 禁止因布局调整改动支付 / 认证 / 授权 / 数据库契约（L-7）。
7. 禁止 3 处同名 `EmptyState` 类重复骨架继续扩散（BASELINE-AUDIT §5 / §11.2 第 1 条）。

---

## 10. 差异与例外登记

| 编号 | 内容 | 状态 |
|---|---|---|
| S11-D1 | 「92 处 system-settings 路由树」与真源（18/9/181/192）冲突，见 §7.1 | 已按真源登记，待 team-lead 裁决 |
| S11-D2 | `theme.css` / `theme-presets.css` 52 个同名变量重抄（影响容器尺寸变量） | 合并候选，`NOT_VERIFIED` |
| S11-D3 | 未发现专用 Grid / Column 组件，网格走 Tailwind 工具类 | `NOT_VERIFIED`（未逐路由核对） |
| S11-D4 | 73 路由中仅 22 页有视觉基线，`system-settings/*` 18 路由无 E2E 覆盖 | `NOT_VERIFIED`（BASELINE-AUDIT §6 / §10） |
| S11-D5 | PageHeader 尚无独立组件（3.0 §3.1），页面按 §3+§6 组合 | 补齐候选，`NOT_VERIFIED` |
| S11-D6 | 蓝图 G-7 建议内容行长 60–90 拉丁字符，仓库三栏文档页正文 `max-w-3xl`（768px）约 85–95 字符，**略高于上限** | `NOT_VERIFIED`（待复核，不擅自改 `max-w-3xl`） |
| S11-D7 | 蓝图要求页面内边距统一出口（Desktop 32 / Tablet 24 / Mobile 16），仓库无页面级内边距单一 Token，实际 `px-*` 分散（`px-3` 95 / `px-4` 45 / `px-2` 23 处） | **治理候选**（补 Token 属运行时改动，本轮不执行） |
| S11-D8 | 蓝图侧栏 240/72px、顶栏 64/56px ↔ 仓库 220px / 44px / 48px（`sidebar.tsx:50-52`、`theme.css:277`） | 已登记（**保留仓库真值**；仓库值属 3.0 §13.3 已定案基线） |

---

## 与其他规范的关系

| 规范 | 关系 | 边界 |
|---|---|---|
| `UDS5-S01`（总纲） | 上级 | 5.0 效力、L1–L5 五层架构 |
| `UDS5-S05`（Spacing） | 依赖 | 4px 间距阶梯、Gutter 16px、列 `gap-*` |
| `UDS5-S06`（Radius） | 关联 | 容器圆角由内容容器统一裁切 |
| `UDS5-S07`（Elevation） | 关联 | 1px 描边 + 表面色差；Sticky Header 层叠 |
| `UDS5-S08`（Icon） | 关联 | Sidebar / 导航图标 |
| `UDS5-S10`（Theme） | 依赖 | 根路由注入 Provider、密度维度 |
| `UDS5-S12`（Responsive） | 依赖 | 五档断点、Compact Mobile、Sidebar 转移动导航 |
| `UDS5-S13`（Accessibility） | 约束 | 焦点不被 Sticky Header 覆盖、Skip Link / 语义 main |
| `UDS5-S14`（Component） | 落地 | 表格 / 卡片 / 弹窗组件在内容区的表现 |
| 3.0 §16 / §6 | 历史溯源 | 3.0 保留为历史，仅用于真源定位 |

---

## 代码实施位置

| 路径 | 职责 |
|---|---|
| `web/src/routes/__root.tsx` | 根路由 Shell、全局 Provider / Toaster / 错误边界 |
| `web/src/components/layout/components/authenticated-layout.tsx` | 鉴权态 App Shell |
| `web/src/components/layout/components/public-layout.tsx` | 公开态 App Shell |
| `web/src/components/layout/components/main.tsx` | Content Container |
| `web/src/components/layout/components/section-page-layout.tsx` | Page Container / 分区页 |
| `web/src/components/layout/components/app-sidebar.tsx` / `nav-group.tsx` | Sidebar 与导航分组 |
| `web/src/components/layout/components/app-header.tsx` / `header.tsx` / `top-nav.tsx` | Header / Sticky Header |
| `web/src/components/layout/components/public-header.tsx` / `public-header-variant.ts` | 公开页 Header |
| `web/src/components/layout/components/footer.tsx` / `page-footer.tsx` | Footer |
| `web/src/components/layout/components/sidebar-view-header.tsx` / `chat-presets-item.tsx` | Sidebar 视图头 / 预设项 |
| `web/src/components/layout/components/system-brand.tsx` / `header-logo.tsx` / `public-page-glow.tsx` | 品牌与背景装饰 |
| `web/src/components/layout/config/system-settings.config.ts` / `top-nav.config.ts` | 导航配置 |
| `web/src/components/layout/lib/sidebar-view-registry.ts` / `url-utils.ts` | 视图注册 / URL 工具 |
| `web/src/components/layout/types.ts` / `index.ts` | 类型与导出收口 |
| `web/src/routes/_authenticated/system-settings/` | 18 文件 / 9 子域三级导航 |
| `web/src/routeTree.gen.ts` | 自动生成的路由树 |
| `web/src/styles/theme.css:277` | `--app-header-height: 3rem` |
| `web/src/styles/index.css:455-456` | `.scroll-container` 悬停暂停 |
| `web/scripts/visual-regression.mjs` | 22 页 × 2 视口布局基线 |

---

## 自动化验证

| 脚本 / npm 脚本 | 关联 | 说明 |
|---|---|---|
| `visual-regression.mjs` / `test:visual` | 视觉 | 22 页 × 2 视口布局基线（desktop 1440×900 / mobile 390×844） |
| `test:visual:e2e` | E2E | 视觉 E2E 轨（BASELINE-AUDIT §7：刻意不接 CI，需完整服务栈） |
| `check-design-tokens.mjs` | T17 | 拦截任意 `p-` / `m-` / `gap-[…]` 破坏 4px 间距阶梯 |
| `lint:design:strict` | 门禁 | CI 唯一阻断模式 |
| `sync-design-showcase.mjs`（`design:showcase:check`） | 展示一致 | `--check` 17 条校验含断点 / 容器快照 |
| `check-component-registry.mjs` | 组件注册 | 65 组件双向一致性（布局组件归属） |
| `test:axe`（`axe-audit.mjs`） | 无障碍 | 语义 `main` / 焦点不被 Sticky Header 覆盖（S13 引用） |
| `sidebar-active-guard.test.ts` / `sidebar-config.test.tsx` | 守卫测试 | Sidebar 选中态 / 配置（非门禁脚本） |

> 说明：`sidebar-active-guard.test.ts` 等为测试文件；门禁脚本以上表所列 `.mjs` 与 npm 脚本为限。

---

## 验证状态

| 项 | 状态 | 依据 / 备注 |
|---|---|---|
| App Shell / Page / Content 三层真实路径 | `NOT_VERIFIED` | 已通过目录读取核实文件存在，未在本轮做结构一致性扫描 |
| 后台 1280px / 营销 1800px 落地 | `NOT_VERIFIED` | 未在 1440/1920 视口逐页复核 |
| system-settings 18 文件 / 9 子域 | `NOT_VERIFIED` | 已通过文件列表核实，未跑路由树一致性校验 |
| 73 路由布局适配 | `NOT_VERIFIED` | BASELINE-AUDIT §6：仅 22 页有视觉基线 |
| Grid / Columns 逐路由核对 | `NOT_VERIFIED` | 未发现专用组件，未逐项核对（S11-D3） |
| Sticky Header 焦点不遮挡 | `NOT_VERIFIED` | `test:axe` 本轮未执行 |
| `test:visual` / `test:visual:e2e` | `NOT_EXECUTED` | BASELINE-AUDIT §14：视觉回归双轨未执行 |
| 全量构建 / `build:check` | `NOT_EXECUTED` | 并发 WIP 约束下不执行（BASELINE-AUDIT §1） |
| 平台验收（Android / iOS / HarmonyOS） | `NOT_VERIFIED` | 见 `UDS5-S12` 与 BASELINE-AUDIT §8 |

**结论**：本分册为规范声明，所有验证项均为 `NOT_VERIFIED` / `NOT_EXECUTED`，**未勾选任何测试通过或平台验收**。
