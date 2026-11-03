# 04 · 组件合规审计（components/ui + design-system/components）

审计范围：`web/src/components/ui/`（66 个组件文件）、`web/src/design-system/components/`（typography/heading、text）。
审计标准：`docs/design-system/UTER-DESIGN-SYSTEM-3.0.md` §1 Typography、§5 Radius、§10 Button、§11 Control、§12 Icon、§13 Component、§14 Navigation、§15 Focus/Accessibility。
方法：Grep 批量扫描（硬编码色 / rounded 档位 / 任意字号 / 原生元素绕过）+ 关键组件逐个精读（button/input/select/textarea/checkbox/radio/switch/dialog/table/card/badge/tabs/toggle/label/form/field/alert/empty/skeleton/progress/sonner/pagination/tooltip/popover/navigation-menu）。

## 0. 批量扫描结论

| 扫描项 | 结果 |
|---|---|
| 硬编码色 `[#xxx]` / `rgb(` / `hsl(`（ui + design-system） | **0 处**，全部走语义 Token |
| `bg-white` / `text-white` / `bg-black` / `text-black` | **0 处** |
| `style={{}}` 内联样式（ui） | 3 处：chart.tsx / combobox-input.tsx / toggle-group.tsx（均为 CSS 变量透传，非硬编码色）|
| 任意字号 `text-[Npx]`（ui + features） | **0 处**，字号全部走 `--text-*` Token（typography.css 单一来源）|
| 原生 `<button>/<input>/<select>/<textarea>`（features，非测试） | 31 个文件，逐项判定见 §3 |
| prefers-reduced-motion | foundations/accessibility.css:57 全局兜底 + index.css:167 skeleton 单独处理，PASS |
| Focus-visible | 全部交互组件统一 `focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-1`（1px 外扩，2026-10-28 决策，与 foundations/accessibility.css 原生元素视觉一致）|
| Disabled 态 | 全组件统一 `disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed`（仅 opacity，见 §1 Button 备注：规范 §10.5「禁止只依赖 opacity」，但文字仍为 muted-foreground 可辨认，判 P3 观察项）|

## 1. 组件逐个判定

### Button — PASS（附 2 条 P3）
- 六变体齐全：default(Primary)/outline/secondary/ghost/destructive/link（button.tsx:33-51）。
- 九尺寸齐全：default/sm/lg + icon/icon-xs/icon-sm/icon-lg + inline/wrap（button.tsx:62-95），高度全部走 `--ds-button-height-*` Token。
- 七状态：hover（每变体独立 Token，如 primary-hover/active）✓、active:translate-y-px + active:bg-primary-active ✓、focus-visible ✓、disabled ✓、loading（内置 loading prop：文字保留 DOM 宽度不塌缩、自动 disabled + aria-busy、spinner aria-hidden 保名稳定，button.tsx:113-156，优于规范最低要求）✓、error（aria-invalid:border-destructive）✓、selected/pressed → 由 Toggle（aria-pressed:bg-primary）承担，分工清晰 ✓。
- 圆角：普通钮 rounded-md(10px) 与规范 §5「Button 默认 10px」一致。
- P3：button.tsx:27-29 注释写「普通按钮 r-md（8px）」，与 §5 radius-md=10px 不符——代码正确、注释陈旧。
- P3：disabled 只用 opacity-50（§10.5 建议补充边框/底色区分）。
- P3：icon 档 rounded-lg=12px，规范 §5 映射「Icon Button 14px(radius-xl)」不一致（与 §2.1 旧版注释自洽，属规范版本漂移）。

### Input — PASS（附 1 条 P2/P3）
- 高度 `--ds-control-height-md`、padding 12×10px、bg-background（深色 bg-input/30）✓；focus-visible 1px ✓；disabled:cursor-not-allowed + bg-input/50 ✓；error：aria-invalid 双主题 ✓；placeholder token ✓；mono 选项默认 type=url 等宽（规范一致）✓。
- P2：**无 hover 态**（§11.2 要求 Hover；仅 Select 触发器在 dark 下有 hover:bg-input/50，Light 下 Input/Select 均无）。
- P3：§11.2 的 Filled / Success 态未显式实现（filled 可由 :placeholder-shown 区分，低风险）。

### Textarea — PASS（同 Input 的 hover 缺口）
- field-sizing-content 自动扩展 + max-h-96 上限 + min-h-18(72px≈3行) 满足 §11.4；字号二选一防 twMerge 冲突；aria-invalid/disabled/focus-visible 齐全。
- P2：无 hover 态（同 Input）。

### Select — PASS
- 触发器与 Input 同视觉（规范 2.1）、default/sm 双高度 Token、data-placeholder 态、disabled、aria-invalid、focus-visible 1px；Popup 走 bg-popover Token + max-h(--available-height) + 滚动按钮；BaseUI 键盘导航完整；移动端 useMediaQuery 适配。
- P2：Light 主题触发器无 hover 态（dark 有 hover:bg-input/50）。
- P3：Open 态无独立样式（依赖 Popup 定位反馈）。

### Checkbox / Radio — PASS
- focus-visible、data-checked:bg-primary + Check 图标/圆点标记（不只靠颜色，§11.5 ✓）、disabled、aria-invalid、暗色变体、命中区 after:-inset 扩到 24px+（§15.3 ✓）。
- P2：无 hover 态（§11.5 要求）。
- P3：aria-invalid:aria-checked:border-primary 处理了「选中即错误」的边界，好。

### Switch — PASS（附 P2/P3）
- focus-visible、data-checked/data-unchecked 轨道色、Thumb 位移（位置反馈非纯色 ✓）、data-disabled、aria-invalid、after: 扩大命中区。
- P2：无 hover 态。
- P3：data-[size=default]:h-[18.4px] w-[32px] 为任意值，未走 Control 尺寸 Token。

### Label / Form / Field — PASS
- Label 支持 required 星号（text-destructive）+ FormLabelTier 档位系统（form-label-tier.tsx，设置页 16/600 自动下发）。
- Form：htmlFor 关联、aria-describedby（description+message）、aria-invalid 注入、FormValidationFocus 提交后滚动+聚焦首个错误字段（§11.6 全部 10 条覆盖，含 i18n 错误消息）。
- Field 组件族（field.tsx）含 field-error 描述关联。Placeholder 不做 Label 的模式未见违例。

### Card — PASS
- rounded-lg(12px) ✓ §5；padding 全部走 `--ds-card-padding`（三档密度生效）；CardTitle 18/600 = §1.3 card-title ✓；sm 档按 0.75 比例不另设死值；ring-foreground/10 边界 Token ✓。

### Dialog / AlertDialog — PASS（附 1 条 P3）
- rounded-lg(12px) ✓；宽 26.25rem(420px) 按 §2.1；bg-popover Token；overlay bg-surface-overlay/10 + backdrop-blur；关闭钮 Button ghost icon-sm + sr-only「Close」可访问名 ✓；BaseUI 焦点陷阱/归还内置 ✓；max-h/dvh 防溢出 ✓。
- P3：dialog.tsx:137 DialogFooter showCloseButton 的「Close」为硬编码英文，未走 t()（与 97 行 sr-only 用 t('Close') 不一致，i18n 漏网）。

### Popover / HoverCard / Tooltip — PASS
- bg-popover Token、rounded-lg、ring-1、shadow、side 动画、origin(--transform-origin)、z-50 不裁切。Tooltip 用 bg-foreground/text-background 反色 Token（双主题成立），含 kbd 插槽。

### Table — PASS
- 密集档 text-dense(13px)+表头 text-xs/500 符合规范表格密度；TableBody h-12、hover 与 expanded 用 color-mix(muted 50%, background) Token 派生（非硬编码）✓；data-state=selected:bg-muted 选中态 ✓；容器 overflow-x-auto 满足 §16.2 表格自适应；tabular-nums 数字排版 ✓。

### Navigation — PASS
- navigation-menu.tsx：trigger h-9、hover:bg-muted、focus-visible:ring-1、data-open/data-popup-open 态、popup bg-popover Token + viewport 双模式。选中态 token 依赖 sidebar-active-foreground（theme.css:246 注释明确 4.93:1 AA 验收）✓ §14.3。
- P3：trigger h-9(36px) 与 §14.2 nav 档（28/32/48）无直接对应，由 Density 层控制可接受。

### Tabs — PASS
- 容器 h-10(40px) p-1 符合 §2.1；bg-secondary 底 + 激活触发器 bg-primary（选中态含背景+文字双重反馈，非仅变色 ✓）；line 变体 after: 下划线；disabled/aria-disabled、focus-visible、hover 齐全；垂直模式完整。

### Toast（Sonner）— PASS
- sonner.tsx 全部走 CSS 变量映射（--normal-bg: var(--popover) 等），成功/信息/警告/错误四态用 color-mix 从语义 Token 派生，--border-radius: var(--radius-lg)；主题跟随 resolvedTheme；图标 size-4.5。无硬编码。

### Alert — PASS（附 1 条 P2）
- role='alert'、destructive 变体、AlertTitle 档位系统、AlertAction。rounded-lg、Token 化。
- P2：仅 default/destructive 两变体，缺 success/warning/info（§2.7 语义状态色在 Badge 有 warning，Alert 未对齐；Toast 有四态，组件间不一致）。

### EmptyState — FAIL（1 处 P2）
- 结构完整（Header/Media/Title/Description/Content），图标 32px 档符合 §12.1 icon-lg。
- **FAIL**：empty.tsx:95 `text-sm.5` —— 该字号 Token 不存在于 typography.css（无 --text-sm.5 / --text-sm-5 定义），Tailwind v4 下是静默无效类，描述文字实际回退继承字号，违反「字号只能来自九/十档 Token」。

### Skeleton — PASS
- bg-muted + animate-pulse + rounded-md；index.css:167-170 为 prefers-reduced-motion 单独关闭 shimmer（§9.4 ✓）。

### Progress — PASS
- bg-muted 轨道 + bg-primary 指示条 + rounded-full；BaseUI 自带 value/label 可访问性；text-sm/tabular-nums。

### Badge — PASS
- h-6(24px)、px-3 py-1(12×4)、rounded-full 胶囊（§2.1 注释记录了 20px→24px 的修正过程）；七变体含 warning（并用 warning-soft-foreground 修复 12px 小字 AA 对比度）；focus-visible 齐全。

### 其他快速核验（PASS）
- Toggle：aria-pressed 选中态 + hover + focus-visible + disabled ✓（P3：h-8/h-7/h-9 未走 --ds-button-height Token）。
- Pagination：复用 Button、aria-current='page'、sr-only「More pages」、i18n aria-label ✓。
- DropdownMenu：focus:bg-accent、data-disabled、destructive 变体、Token 化 ✓。
- Sheet：sr-only Close ✓；Drawer：DrawerClose 未强制 sr-only（依赖调用方）。
- Spinner、Kbd、Separator、Avatar、Breadcrumb、ScrollArea、Slider、InputOTP（has-aria-invalid 双主题）、Combobox、Command（sr-only DialogHeader）均为 Token 化实现，未见硬编码。
- design-system/components/typography（Text/Heading）：变体白名单强制字号走 Token、禁止调用处覆盖 font-size 的语义（注释明确），CSS 类由 foundations + tokens/typography.css 提供 → PASS。

## 2. 主题（Light/Dark）核验 — PASS
- 全部组件用语义 Token（bg-*/text-*/border-*/ring-*），dark: 变体仅在 token 值需要偏移处出现（如 dark:bg-input/30、dark:aria-invalid），无 dark: 冗余堆叠的明显坏味道。
- 无 white/black 硬编码；Tooltip 反色用 bg-foreground/text-background，双主题自动成立。
- theme.css 提供完整 Light/Dark/soft/border 状态色体系；brand-colors.ts 集中管理第三方品牌色（唯一所有者，由 check-design-tokens.mjs T8 规则守护）→ 合规例外，非违规。

## 3. 业务页面绕开基础组件清单（features）

| 文件:行 | 现象 | 严重度 |
|---|---|---|
| features/customer-service/CustomerServiceWidget.tsx:307,406,499,541,572 | **整只悬浮客服组件绕开组件库**：原生 button×5 + 原生 input，全部 inline style 手写（含 mouseenter 模拟 hover）、无 focus-visible、无 disabled/loading 体系。虽取色走 var(--primary)/var(--border) 等 Token，但交互状态与规范 §10/§11 全部脱节 | **P1** |
| features/organization/index.tsx:1224 | 原生 `<table className='w-full text-sm'>` 手写表格（thead/tbody/td 全手写），未用 ui/Table 的密集档/hover/selected 体系 | P2 |
| features/system-settings/models/group-ratio-form.tsx:564 | 原生 `<table>` 手写双列表格，同上 | P2 |
| features/home/components/hero-terminal-demo.tsx:240 | 原生 `<button>` 实现 Tab 切换（手写 activeBorder/activeText、无 aria-selected/role=tablist），未用 ui/Tabs | P2 |
| features/auth/sign-in/components/user-auth-form.tsx:476,571 | 原生 `<button>` 做「切换登录方式」文字链接（hover 变色无焦点外反馈之外的态），未用 Button variant=link | P3 |
| features/usage-logs/components/columns/column-helpers.tsx:231 | 原生 `<button>` 做失败原因触发器（ds-touch-target 补命中区，但无 focus-visible 类）| P3 |
| features/channels/components/numeric-spinner-input.tsx:156-210 | 自研 spinner（原生 input + 4 个原生按钮）；颜色走 Token、有 aria-label，但 focus-visible:ring-ring 缺 focus-visible:border/宽度组合，态体系自成一派 | P3 |
| features/dashboard/components/flow/flow-node-filter.tsx:173 | style backgroundColor: option.color —— 动态数据色，应走 chart 分类色 Token（brand-colors.ts 序列）| P3 |
| features/wallet/lib/ui.tsx:117-177 | style color: PAYMENT_ICON_COLORS —— 已收敛到 design-system/tokens/brand-colors.ts 唯一来源，合规例外 | OK |
| features/task-artifacts.tsx / columns/*.tsx / dashboards 各文件 | grep 命中多为原生元素嵌在 Table 单元格文案或注释里，未构成独立控件复刻 | OK |

## 4. 规范-实现系统性漂移（文档层，非单组件缺陷）

1. **P2 · 字号阶梯双版本**：规范 §1.2 十档（base=14/md=15/lg=16/xl=18/2xl=20/3xl=24/4xl=30/5xl=36）与实现 `design-system/tokens/typography.css` 九档（sm=14 是正文、base=16、lg=18、2xl=22、3xl=28、4xl=36，无 md/5xl）不一致。实现自洽且组件全部走 Token，但按 3.0 验收属文档-实现漂移，需二选一对齐。
2. **P2 · hover 态系统性缺失**：Input/Textarea/Select(Light)/Checkbox/Radio/Switch 六个控件均无 hover 态类，§11.2/11.5 明确要求。
3. **P3 · Focus Ring 规格**：规范 §15.1 建议 2px/2px offset；实现统一 1px ring 无 offset（accessibility.css 注释记录为 2026-10-28 定版决策，双来源视觉统一），属有意偏差。
4. **P3 · Icon Button 圆角**：实现 rounded-lg(12px)，§5 映射为 14px。
5. **P3 · Button 圆角注释陈旧**：button.tsx:27 写「r-md=8px」，实际 Token=10px（代码正确）。

## 5. 统计

- 精读组件 26 个：**PASS 25 / FAIL 1**（Empty：text-sm.5 无效字号类）。
- 批扫组件 40 个（余量）：未发现硬编码色 / 任意字号 / 非标准圆角档。
- features 绕过实现：31 文件命中原生元素 → **P1×1、P2×3、P3×4**，其余为注释或文案误报。
- 规范漂移：P2×2（字号阶梯、控件 hover 缺失）、P3×3。
