# UTER Design System 5.0 — Color 规范

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S03` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01` |
| 生效日期 | `2026-11-14` |
| 最近修订 | `2026-11-15`（上游对齐 + 差异合并：按 `UDS5-S01` §4.2 唯一规范值基线表收敛 §2 / §7–§16，删除全部第二套建议值；版本仍为 `5.0.0`，见 `UDS5-S26` 节点十一） |
| 适用范围 | 全部颜色语义 Token、品牌 DTCG 真源与生成链、Light/Dark 成对定义、图表与渐变色、业务组件的颜色引用方式；Primitive 色板、业务状态映射、交互状态色、数据可视化系列顺序与组件颜色出口 |
| 验证状态 | `NOT_VERIFIED` |

> **状态声明**：本文定义颜色语义与引用规则，**不声明任何测试已通过、任何组件已 `FULLY_VERIFIED`、任何平台已验收**。2026-11-15 执行的 7 条命令均为**只读结构 / 静态门禁**（见 §16.4），不构成颜色实现、对比度实测、视觉回归或平台验收证据，`验证状态` 仍为 `NOT_VERIFIED`。事实依据为 `audit/BASELINE-AUDIT.md`、`audit/CLERK-DESIGN-REFERENCE-ANALYSIS.md` 与对仓库内已存在文件的只读核实。
>
> **唯一规范值口径（2026-11-15 裁决）**：本文任一颜色属性**只存在一个规范值**，统一取 `UDS5-S01` §4.2 基线表——`G1`（clerk.com 已公布）取上游值、`G2`（上游未公布）取运行时实现现状。《Color System 优化方案》建议值、《业务域蓝图 Color Standard》建议值、3.0 历史值、审计时点快照**一律不再是规范值**，本文已删除全部并列的第二套色值表；`E24` / `E28` / `NOT_VERIFIED` 等状态与待办原样保留（状态不是设计值）。**本轮只改规范文本、不改 `web/src`**，规范—实现差异按 `UDS5-S01` §19 登记为待迁移。

---

## 1. 颜色真源链（必须遵守的单向路径）

| 步 | 真实路径 | 职责 | 约束 |
|---|---|---|---|
| ① DTCG 真源 | `web/src/design-system/source/brand.tokens.json`（配套 `brand.tokens.schema.json`） | 品牌原色、`provenance`、`status: DRAFT` / `decision: AUTO_BLOCKED` / `changeApproval: NOT_VERIFIED` | 不得手写生成物；状态变更须 `verify-contrast.mjs` + 视觉回归证据链齐备 |
| ② 生成物 | `web/src/design-system/tokens/generated/brand.css` | 由 `scripts/generate-design-tokens.mjs` 生成，Light 8 色 + Dark 8 色（`--uter-brand-*`） | 文件头 `GENERATED FILE — DO NOT EDIT`；改值必须回改 ① |
| ③ 基础调色板 | `web/src/styles/theme.css` | `--background` / `--foreground` / `--card` / `--popover` / `--muted` / `--secondary` / `--accent` / `--sidebar` / `--primary` / `--destructive` / `--success` / `--warning` / `--info` / `--border` / `--input` / `--ring` 等原值 | `@custom-variant dark (&:is(.dark *))`（`theme.css:19`）与 `.dark`（`:590`）驱动全局深浅 |
| ④ 语义映射 | `web/src/design-system/tokens/colors.css`（45 处定义）、`tokens/semantic.css`（63 处定义）、`tokens/elevation.css`（27 处定义） | 把 ③ 映射为 `--ds-color-*` / `--ds-stroke-*` / `--ds-focus-ring-*`，**不新建调色板** | 见 §1.1 合法路径 |
| ⑤ 消费 | `web/src/design-system/foundations/`（6 份 `@utility` / `@layer`）、`web/src/components/ui/`、`web/src/components/data-table/`、`web/src/routes/` | 组件只引用语义 Token | 禁止跨越 ④ 直写 ③ 之外的裸值 |

> 上级约定的真源链表述为：`web/src/design-system/source/brand.tokens.json` → `tokens/generated/brand.css` → `tokens/colors.css` / `semantic.css` → `web/src/styles/theme.css`。按只读核实，**运行时的数据方向是 `theme.css` 基础调色板在前、`colors.css` 语义映射在后**（`tokens/colors.css:19-29` 明确写「不新建调色板，只把业务语义映射到既有 Token」；新增颜色的唯一合法路径是先在 `theme.css` 定义原值，再在 `colors.css` 映射 `--ds-color-*`）。本规范同时保留两种表述：①→② 为品牌 DTCG 生成链，③→④→⑤ 为运行时消费链，二者不得混为一条单向流水线。

### 1.1 新增颜色的唯一合法路径

| 步 | 动作 | 违规判定 |
|---|---|---|
| 1 | 在 `web/src/styles/theme.css` 的 `:root` / `.dark` 定义原始颜色 | 跳过此步直接写组件色值 → T8 |
| 2 | 在 `tokens/colors.css` 映射出一条 `--ds-color-*` 语义 | 用 `*-soft`、`*-hover`、`*-subtle` 之外的临时命名 → 规范审查违规 |
| 3 | 在 5.0 规范（`UDS5-S03`）登记用途与对比度要求 | 未登记即使用 → 规范审查违规 |

`tokens/colors.css:29` 明确：组件里直接写 `#0F172A`、`rgb(...)`、`text-[#333]` 都是违规的。

---

## 2. 品牌主色（唯一规范值）

| 属性 | **5.0 唯一规范值** | 组别 | 依据 |
|---|---|---|---|
| 品牌主色 `colorPrimary` | **`#6c47ff`** | `G1` | clerk.com `appearance.variables` 官方示例值（2026-11-15 上级裁决，以 clerk.com 为准） |
| Light Hover / Active | `#4F52D1` / `#4A4DC5` | `G2` | 上游未公布态位值 → 运行时 DTCG 实现现状 |
| Dark Primary / Hover / Active | `#A1A3F7` / `#B1B3FF` / `#9294F7` | `G2` | 同上 |

> 唯一取值入口为 `UDS5-S01` §4.2 基线表。原「5.0 规范基线六色」与「《优化方案》9 档色阶中的 brand-500」等历史口径**均不再是规范值**，本文不再并列。

配套唯一基线（`UDS5-S01` §4.2）：基准字号 `0.8125rem`(13px)、圆角 `0.375rem`(6px)、间距 `1rem`(16px)、字重 400/500/600/700、字体族变量 `inherit`；`G2` 项为字号刻度 18 档、最小 `12px`、间距 4pt 网格、圆角 8 档派生、`1px` 边框、焦点环 `2px` / `ring-2`、优先表面色差而非重阴影。

### 2.1 实现现状与迁移状态（不是第二套规范值）

本轮按上级指令**只改规范文本、不改 `web/src`**。运行时代码中仍为旧品牌色、旧正文基准与旧圆角值，与 `G1` 冲突，统一登记为**待迁移**（`UDS5-S01` §4.2 / `S01-D9`）：须走 §19 变更流程，先写回归测试、补对比度与视觉回归证据，再改 `source/brand.tokens.json` → `generated/brand.css` → `theme.css` 生成链。

- `brand.tokens.json` 仍为 `status: DRAFT` / `decision: AUTO_BLOCKED` / `changeApproval: NOT_VERIFIED`；状态与值变更**未获授权**，不得擅自改。
- 迁移完成前 `verify-contrast.mjs` / T1–T17 仍按现行代码值执行；这是**过渡期实现双轨**，不是两套规范值。
- 焦点环唯一值 `2px` / `ring-2`（`UDS5-S01` §4.2.1）；装饰性 `ring-1` 描边 1px 与 `1px` 边框为独立有效值，原样保留。
- `验证状态 NOT_VERIFIED`：未执行浏览器级守卫复核与代码迁移。

---

## 3. 十七类语义 Token（全量建立）

> 下表 `语义 Token` 列中的名称均为仓库内已存在或已被引用的真实变量名；`取值来源` 列给出其映射的 `theme.css` 基础变量或固定值。未在本表出现的颜色变量不得在业务组件中新增使用。

| # | 类别 | 语义 Token（真实） | 取值来源 / 用途 |
|---|---|---|---|
| 1 | **Brand** | `--uter-brand-primary` / `--uter-brand-primary-foreground` / `--uter-brand-hover` / `--uter-brand-active` / `--uter-brand-soft` / `--uter-brand-soft-foreground` / `--uter-brand-border` / `--uter-brand-subtle-surface`（`generated/brand.css`，Light/Dark 各 8） | DTCG 生成；另有 `--ds-color-brand-gradient-from` `#60a5fa` / `--ds-color-brand-gradient-via` `#a78bfa` / `--ds-color-brand-gradient-to` `#a855f7` |
| 2 | **Primary** | `--ds-color-action-primary`（`var(--primary)`）、`--ds-color-action-primary-strong`（`var(--primary-strong, var(--primary))`）、`--ds-color-action-primary-foreground`（`var(--primary-foreground)`）、`--ds-color-primary-subtle`（`var(--primary-subtle, var(--accent))`）、`--ds-color-primary-border`（`var(--primary-border, var(--border))`） | 实心主按钮底须用 `primary-strong`，深色下与 `primary` 取值不同，不得直接复用 |
| 3 | **Secondary** | `--ds-color-surface-secondary`（`var(--secondary)`）、`--ds-color-surface-accent`（`var(--accent)`） | 次级容器 / 强调容器表面 |
| 4 | **Neutral** | `--ds-color-surface-muted`（`var(--muted)`）、`--ds-color-text-secondary`（`var(--muted-foreground)`）、`--ds-color-text-tertiary`（`color-mix(in oklch, var(--muted-foreground) 88%, var(--background))`） | 三级文字须写成 `color-mix()` 本身，才能在 `data-theme-preset` 覆盖调色板时跟随变化 |
| 5 | **Surface** | `--ds-color-surface-page`（`--background`）、`--ds-color-surface-card`（`--card`）、`--ds-color-surface-popover`（`--popover`）、`--ds-color-surface-muted`（`--muted`）、`--ds-color-surface-secondary`（`--secondary`）、`--ds-color-surface-accent`（`--accent`）、`--ds-color-surface-sidebar`（`--sidebar`）、`--ds-color-surface-overlay`（`#000000`，恒黑、深浅同值）、`--ds-color-surface-pure`（`#ffffff`，二维码底 / 滑块手柄等必须恒白的表面） | 遮罩浓淡由调用方透明度修饰表达，不拆成两个 Token |
| 6 | **Text** | `--ds-color-text-primary`（`--foreground`）、`--ds-color-text-secondary`（`--muted-foreground`）、`--ds-color-text-tertiary`、`--ds-color-text-disabled`（`color-mix(... 55%, transparent)`）、`--ds-color-text-inverse`（`--primary-foreground`）、`--ds-color-text-on-emphasis`（`#ffffff`）、`--ds-color-text-danger`（`--destructive`）、`--ds-color-text-success`（`--success`）、`--ds-color-text-warning`（`--warning`）、`--ds-color-text-info`（`--info`） | `--ds-color-text-on-emphasis` 用于替代散落的 `text-white`（C-03 禁止手写白字） |
| 7 | **Border** | `--ds-color-border`（`--border`）、`--ds-color-border-input`（`--input`）、`--ds-color-border-sidebar`（`--sidebar-border`）、`--ds-color-border-destructive`（`--destructive`）、`--ds-color-primary-border` | `--ds-stroke-width: 1px`；焦点环色不在这里，唯一来源是 `--ds-focus-ring-color`（`var(--ring)`） |
| 8 | **Semantic** | `--ds-color-*` / `--ds-stroke-*` / `--ds-focus-ring-*` 整套（`semantic.css` 63 处 + `colors.css` 45 处定义） | 语义层是组件**唯一**可直接引用的设计值来源 |
| 9 | **Success** | `--ds-color-text-success`、`--ds-color-success-soft`（`--success-soft`）、`--ds-color-success-soft-foreground`（`--success-soft-foreground`）、`--ds-color-action-success`（`--success`）、`--ds-color-action-success-hover`（`--hover-success`） | soft 态取值等于现状渲染值，迁移零视觉变化，避免「底色加透明度 + 满色文字」导致可访问性回归 |
| 10 | **Warning** | `--ds-color-text-warning`、`--ds-color-warning-soft`、`--ds-color-warning-soft-foreground` | 同上 |
| 11 | **Error** | `--ds-color-text-danger`、`--ds-color-action-destructive`（`--destructive`）、`--ds-color-action-destructive-hover`（`--hover-destructive`）、`--ds-color-destructive-soft`、`--ds-color-destructive-soft-foreground`、`--ds-color-border-destructive` | 危险操作与字段级错误 |
| 12 | **Info** | `--ds-color-text-info`、`--ds-color-info-soft`、`--ds-color-info-soft-foreground` | 信息提示 |
| 13 | **Interactive** | `--ds-color-action-primary-hover`（`--hover-primary`）、`--ds-color-action-primary-active`（`--primary-active`）、`--ds-color-action-destructive-hover`、`--ds-color-action-success-hover` | 悬停 / 按下必须走专用 `*-hover` / `*-active` Token，禁止 `hover:bg-primary/90`（T14） |
| 14 | **Overlay** | `--ds-color-surface-overlay`（`#000000`）、`--ds-color-surface-popover` | 遮罩恒黑、深浅同值；深色模式变浅等于没有遮罩 |
| 15 | **Chart** | `--color-chart-N` 语义色板（`theme.css` / 主题预设）、`tokens/chart-typography.ts`（T4 TS 镜像） | `chart-*` 是语义 Token，不属 T7 调色板直用匹配范围；图表 text / axis / label / grid 独立 Token 仍为 P2 Pending（`BASELINE-AUDIT` §3.1） |
| 16 | **Light** | `:root` 全套基础调色板 + `generated/brand.css` 的 8 个 `--uter-brand-*` | `data-theme-preset` / `data-theme-radius` / `data-theme-scale` 三维正交 |
| 17 | **Dark** | `.dark` 覆盖（`theme.css:590`）、`generated/brand.css` `.dark` 8 色、`elevation.css` 2 档 Dark 阴影、`@custom-variant dark (&:is(.dark *))`（`theme.css:19`） | design-system 内部 Dark 覆盖只有 `generated/brand.css`（8 色）与 `elevation.css`（2 档）；品牌渐变按深浅同值，禁止 `.dark` 覆盖 |

### 3.1 语义层的补充约束

| 项 | 规则 |
|---|---|
| 单向引用 | 组件 → `--ds-*` → `--background` / `--primary` 等基础变量；不得反向 |
| 别名压缩问题 | `--ds-color-text-primary` / `--ds-color-text-secondary` / `--ds-color-success-soft` 三个纯别名在生产构建压缩后消失，当前靠 `var(--x, fallback)` 兜底缓解；5.0 须定位压缩器根因，不得永久保留双轨 |
| 主题预设 | `theme.css` 与 `theme-presets.css` 之间有 52 个同名变量（基础 `:root` 声明 + 预设覆盖），属设计意图而非缺陷；但预设重抄整组是 5.0 合并候选 |
| 装饰层 | `--ds-decor-*` 未纳入 `colors.decoration`，保持 P3 Pending |
| Terminal ANSI | ANSI 0–15 全色板未落地（早期 20 个 `...` 占位符），保持 P1 Pending + 退出条件 |

---

## 4. 业务组件禁止硬编码颜色

| 门禁 | 规则原文 | 禁止写法 | 合法替代 |
|---|---|---|---|
| **T8** | 裸色值（`#hex` / `rgba()`，未走 Token） | `'#6366f1'`、`rgba(15,23,42,…)`、`#0F172A`、`text-[#333]` | 走 `tokens/brand-colors.ts`（T8 唯一裸色值所有者）或 §1.1 三步路径 |
| **T13** | 透明度冒充文字层级 | `text-foreground/60` | `text-fg-secondary` / `text-fg-tertiary` / `--ds-color-text-secondary` / `--ds-color-text-tertiary` |
| **T14** | 透明度凑悬停 | `hover:bg-primary/90` | `--ds-color-action-primary-hover` 等 `*-hover` Token |
| **T15** | 透明度凑浅底 | `bg-warning/10` | `--ds-color-warning-soft` / `*-subtle` |
| **T7** | 调色板直用颜色 | `bg-emerald-500`、`text-slate-600` | `--ds-color-*` 语义 Token；`chart-*` 例外（语义 Token） |

补充真实机制（`check-design-tokens.mjs`）：

- T8 对 `RAW_COLOR_OWNERS` 放行，并跳过 `*.test.ts(x)` 中的断言夹具色值。
- T15 只管 ≤20% 浅底；`/70`、`/90` 属有意的半透明实心填充，不判违规。
- `T8` 在 Token 定义处的色值（审计时点记录 183 处）与浮层投影（20 处）不计违规。
- 禁止用 `text-white` 手写白字，统一 `--ds-color-text-on-emphasis`。
- **2026-11-15 上游对齐**：规范层变量结构口径为 `UDS5-S01` §4.2 `G1` 的扁平单层 24 键 + `color-mix()` / 相对颜色语法派生；运行时静态两层体系为过渡期实现现状，按 §19 待迁移。迁移前 T7 / T8 / T13 / T14 / T15 与 T1–T17 静态门禁仍按现行代码执行，不得据规范宣称代码已对齐。

---

## 5. 对比度缺陷登记（E24，P1 待修）

| 编号 | 位置（历史版本 3.0 记录） | 实测对比度 | 要求 | 5.0 处置 |
|---|---|---|---|---|
| E24-1 | 浅色溢价 | **3.76:1** | 正文 ≥ 4.5:1（WCAG 2.1 AA / 5.0 目标 WCAG 2.2 AA） | 编号已注销但缺陷须保持待修；5.0 **不得勾选通过** |
| E24-2 | 深色折扣 | **3.30:1** | 同上 | 同上 |

处置规则：

1. 两项均为 P1 无障碍缺陷，`验证状态` `NOT_VERIFIED`；修复验证须由 `web/scripts/verify-contrast.mjs` 与视觉回归证据链共同支撑，本轮未执行。
2. 不得通过压深品牌渐变值来「修对比度」——那等于改对外观感（见 §6）。
3. `web/src/design-system/__tests__/status-badge-contrast.test.ts` 与 `web/e2e/axe/` 为相关回归位置（均未在本轮执行）。
4. 3.0 §22 的 73 个未勾选验收项不得继承为已通过，E24 是其中必须显式保留的待修项。

---

## 6. 渐变有意例外（E28）

| 项 | 内容 |
|---|---|
| 位置 | 首屏品牌渐变标题（3.0 §17.5 / `:3524-3532`） |
| 实测对比度 | **2.54 / 2.72 / 3.96:1**（三个停靠站） |
| 性质 | **有意例外，B 类验收口径** |
| 例外边界 | 只限首屏品牌渐变标题 / CTA，不得扩展到普通文本、表格、表单或状态色 |
| ALLOWLIST | **不进 `ALLOWLIST`**（B 类例外只登记例外台账；A 类扫描例外才进 `ALLOWLIST` 并须同步校验契约） |
| 深浅规则 | 品牌渐变三停靠站逐值锚定，`#60a5fa` / `#a78bfa` / `#a855f7` 深浅同值，**禁止 `.dark` 覆盖**，也不接 `chart-*`（后者随主题预设漂移） |
| 消费出口 | 唯一为 `@utility ds-text-gradient-brand`；组件里不得手写渐变 |
| 深色补偿 | 深色主题靠更暗背景自然获得更高对比度（记录值 **7.02 / 6.56 / 4.51:1**，与运行时 `verify-contrast.mjs` 真值一致，深色背景 `#0F172A`；与 `UDS5-S13` §6 逐值成对锚定一致），不靠改渐变值 |
| 验证 | `web/scripts/verify-contrast.mjs` 含 E28 渐变锚定与负例拒绝；本轮未执行，`NOT_VERIFIED` |

---

## 7. 中性色与状态色唯一规范值（`UDS5-S01` §4.2 `G2`）

> clerk.com 未公布完整色阶 hex、状态色四层具体值与双主题表面映射，按 `G2` 取运行时实现现状为**唯一规范值**。下表为 2026-11-15 对 `web/src/styles/theme.css` `:root` / `.dark` 的只读提取真值。《业务域蓝图 Color Standard》建议值、《Color System 优化方案》建议值、3.0 历史值与审计时点快照**一律不是规范值**，原有逐值对照表已按差异合并裁决删除（见 §9）。

### 7.1 表面、文字与边框（10 项）

| 语义 | 运行时变量 | Light | Dark |
|---|---|---|---|
| canvas 页面底色 | `--background` | `#ffffff` | `#020617` |
| surface 卡片 | `--card` | `#ffffff` | `#020617` |
| surface-raised 浮层 | `--popover` | `#ffffff` | `#020617` |
| surface-secondary 次级容器 | `--muted` | `#f1f5f9` | `#1e293b` |
| fg-primary 主文字 | `--foreground` | `#0f172a` | `#f8fafc` |
| fg-secondary 次级文字 | `--muted-foreground` | `#5f6d80` | `#94a3b8` |
| fg-tertiary 辅助文字 | `--ds-color-text-tertiary` | `color-mix(in oklch, var(--muted-foreground) 88%, var(--background))` | 同式（跟随 `.dark` 变量） |
| fg-disabled 禁用文字 | `--ds-color-text-disabled` | `color-mix(in oklch, var(--muted-foreground) 55%, transparent)` | 同式 |
| border 标准边框 | `--border` | `#e2e8f0` | `#334155` |
| border-strong 强调边框 | `--border-strong` | `#cbd5e1` | `#475569` |

> **时点说明**：`--muted-foreground` Light 当前为 `#5f6d80`、`--info` Light 当前为 `#0073b8`，均为 2026-11-14 axe 对比度收敛后的运行时真值；历史审计快照记录的旧值不再作为规范值，也不再并列登记。
>
> **已登记缺口（状态，非设计值）**：Dark 下 `--card` / `--popover` / `--background` 同为 `#020617`，无独立抬升面，层级靠 1px 边框与 Dark 投影表达，登记为 `S03-D2` 治理候选，本轮不改值。

### 7.2 状态色（4 项）

| 状态 | 运行时变量 | Light | Dark |
|---|---|---|---|
| Success | `--success` | `#15803d` | `#22c55e` |
| Warning | `--warning` | `oklch(0.681 0.162 75.834)` | `oklch(0.769 0.188 70.08)` |
| Danger | `--destructive` | `#dc2626` | `#7f1d1d` |
| Info | `--info` | `#0073b8` | `oklch(0.613 0.14 239.919)` |

> `oklch()` 值多数超出 sRGB 色域、浏览器需 gamut mapping，**不得宣称与任何 hex 值等值**；精确验收以 `verify-contrast.mjs` 运行时实测为准。状态色四层结构见 §12.1。

### 7.3 表单与交互颜色九项出口

| 要求项 | 运行时出口 | 状态 |
|---|---|---|
| input background | `--ds-color-surface-muted`（`var(--muted)`） | 已有 |
| input foreground | `--ds-color-text-primary`（`var(--foreground)`） | 已有 |
| placeholder | `--fg-placeholder` + `--color-fg-placeholder` | 已有 |
| input border | `--ds-stroke-color-input`（`var(--input)`）+ `--ds-color-border-input` | 已有 |
| hover border | 复用 `--ds-color-border-input` / `hover:border-*` 语义类 | `S03-D5`（非阻断，未单列 Token） |
| focus ring | `--ds-focus-ring-width: 2px` + `--ds-focus-ring-color: var(--ring)` | 已有；`S03-D6` 外偏移量待裁决 |
| disabled foreground | `--ds-color-text-disabled` | 已有 |
| disabled background | `--muted`（组件层 `disabled:bg-muted`） | 已有 |
| selected background | `--accent` + `--ds-color-surface-accent` | 已有 |

### 7.4 前景色前缀唯一口径

| 项 | 唯一口径 |
|---|---|
| 文字色前缀 | `--fg-*` / `--color-fg-*` / `--ds-color-text-*`；**禁止**用 `--text-*` 定义颜色 |
| `--text-*` | Tailwind v4.3.3 的 `@theme` 自定义**字号注册机制**，不是颜色命名空间；T1 门禁守护，保留不得删除 |
| 已知缺陷 | `text-fg-primary` 为死类（`--color-fg-primary` 未注册，构建产物中该规则计数 0，全仓 12 处使用被静默丢弃）。修复只需在 `theme.css:183` 前补 `--color-fg-primary: var(--fg-primary);` 并重建，登记 `S03-D11`，本轮不改代码 |

---

## 8. 状态与例外登记（不含第二套设计值）

> 差异合并裁决（`UDS5-S01` §4.2 / `S01-D8`）：以下编号只承载**缺陷、状态与待办**，不再承载任何第二个设计值；历史建议值已从本文全部表格删除。

| 编号 | 内容 | 状态 |
|---|---|---|
| S03-D1 / D2 / D3 | canvas 与 surface 的 Dark 抬升面缺口、`fg.muted` 层级 | `S03-D2` 治理候选；其余已按 `G2` 唯一值收敛 |
| S03-D4 | 三级文字采用 `color-mix()` 运行时派生，随主题预设跟随 | **规范口径**（`G2`），固定 hex 写法不再考虑 |
| S03-D5 | hover border 无独立 Token | `NOT_VERIFIED`（非阻断） |
| S03-D6 | 焦点环外偏移量未声明为独立语义 Token | `NOT_VERIFIED`（待设计侧裁决，不得擅自加 `ring-offset`） |
| S03-D7 / D8 | 深色状态色取向（深红 / green-500） | 已按 `G2` 唯一值收敛 |
| S03-D9 / D18 | `oklch()` 与 hex 表示法差异、超 sRGB 色域 | 不虚构等值声明；精确验收以运行时实测为准 |
| S03-D10 | 品牌前景值随 DTCG 生成 | `NOT_VERIFIED` |
| S03-D11 | `text-fg-primary` 死类（12 处使用） | **真实代码缺陷**，修复待办，见 §7.4 |
| S03-D12 | 品牌色阶仅 9 档（50–800），方案文本声称「50–900」但未提供 900 | 按 9 档登记，900 **待定义**，不臆造色值 |
| S03-D13 | `web/src` 不存在 `--slate-*` 变量；3.0 §17.2 仅为结构示意 | §10.2 为规范层首次显式成表，不得宣称运行时已落地 |
| S03-D14–D16 | 双主题映射 / Light 文字层级双轨 | 已按 §7.1 / §11 唯一值收敛，不再并列 |
| S03-D17 / D17-b | 状态色对比度：`--success` + `--success-foreground` 字面配对 2.18:1 不达 AA | **待核候选**：组件是否真实使用该配对未逐处核实，**不判已确认缺陷、不擅自修**，须走 §19 专项复核 |
| S03-D19 | 3.0 §28.5 TOKEN-MANIFEST 与运行时已分叉 | 3.0 全文保留为历史版本，不作现行依据 |
| S03-D20 | 焦点环色值 | 按 `G2` 唯一值 `--ring` 收敛；低于 3:1 的建议色已删除 |
| S03-D21 | 规范层缺口：selection-bg / selection-fg、border-subtle、surface-tertiary、disabled-border、hover border、Secondary / Ghost / Text Link 三态、面积填充 Token | `NOT_IMPLEMENTED`，落地须走 §1.1 三步路径 |
| S03-D22 | 图表板 | 按 `G2` 运行时 6 色 `oklch()` 收敛为唯一值 |
| S03-D23 | 方案 L1–L4 颜色架构 | **Adapt** 映射，不另立体系（§15.1） |
| S03-D24 | 三级文字对比度、Disabled 透明度派生与「Disabled 不应仅靠透明度」的张力 | 待设计侧裁决，`NOT_VERIFIED` |
| S03-D25 | Dashboard「`+12.8%`」运营指标配色适用范围 | 沿用语义 Token + 文字 / 箭头图标，不引入涨跌专用语义 |
| S03-D26 | 自动验证缺口：「主题成对完整性」与「未定义颜色引用」未见专门校验器 | `NOT_IMPLEMENTED`，登记为 `UDS5-S24` 候选，不虚构脚本 |

---

## 9. 上游对齐与差异合并裁决（2026-11-15）

> 上级指令：① 5.0 中所有与上游 clerk.com 不一致的地方以 clerk.com 为准；② 合并差异只保留唯一规范值；③ 生成全量 Showcase。本节为 `UDS5-S03` 的落实记录。

| 项 | 唯一口径 |
|---|---|
| 唯一规范值入口 | `UDS5-S01` §4.2 基线表：`G1` 取 clerk.com 官方已公布值、`G2` 取运行时实现现状 |
| 本文主色 | `#6c47ff`（`G1`），见 §2；运行时迁移按 §19 待办 |
| 双值处置 | 删除 §2.1 / §7 / §10–§14 中全部第二套建议值表格与逐值对照列；任一属性在本文只出现一个规范值 |
| 保留内容 | Primitive 色板、双主题映射、状态四层结构、19 项业务状态映射、交互规范、图表系列顺序与统一规则、组件颜色出口、L1–L4 阅读视图、治理约束与门禁证据 |
| 状态保留 | `E24` 两处对比度缺陷、`E28` 渐变有意例外、`NOT_VERIFIED` / `NOT_IMPLEMENTED` / `PENDING` 全部原样保留（状态不是设计值） |
| 本轮动作 | 只改规范文本；零 `web/src` / `.uap` / CI / `package.json` / 运行时色值改动；不建分支、不暂存、不提交 |
| 已废止口径 | 「品牌基线六色必须保留」「方案建议值 vs 运行时真值并列登记」「以运行时真值为规范基线」「Clerk 色值一律 Reject」 |

> **对比度数据来源**：§10 / §16 标注「实算」的数值按 WCAG 2.x 相对亮度公式对**纯 HEX 值**计算（临时脚本不入仓库）。`oklch()` 值的 hex 换算仅作近似参考，**不得据此宣称逐值等值**；精确验收以 `verify-contrast.mjs` 为准，本轮未对新增色值执行该验收。

---

## 10. Primitive 原始色板（唯一规范值）

> clerk.com 未公布完整色阶 hex，按 `G2` 由 5.0 规范层显式成表。组件**不得直接引用** Primitive 色板（`UDS5-S01` §6.3、T7 / T8），只能引用 `--ds-color-*`。

### 10.1 品牌色阶（9 档）

| 档 | 唯一规范值 | 用途 | 白底对比度（实算） | 使用约束 |
|---|---|---|---|---|
| brand-50 | `#F0F0FF` | 极浅品牌背景 | 1.13:1 | 仅背景 / 选中底，禁作文字 |
| brand-100 | `#E0E1FF` | 浅色选中背景 | 1.28:1 | 仅背景 |
| brand-200 | `#C7C8FF` | 浅色装饰、图形 | 1.60:1 | 仅非必要装饰 |
| brand-300 | `#A1A3F7` | 深色主题强调 | 2.31:1 | 仅装饰 / 图形 |
| brand-400 | `#8B8DF5` | 深色主题主品牌色 | 2.91:1 | 仅装饰 / 图形 |
| brand-500 | `#5B5EE6` | 色阶中阶（**非 5.0 主色**，主色见 §2） | 5.01:1 | 可作文字 / 链接 / 实心底 |
| brand-600 | `#494CC7` | 色阶深阶 | 6.68:1 | 文字 / 实心底均可 |
| brand-700 | `#3F42B0` | 色阶深阶 | 8.02:1 | 同上 |
| brand-800 | `#30338E` | 深色强调 | 10.55:1 | 同上 |

1. `brand-50`–`brand-400` 白底对比度 1.13–2.91:1，全部低于 WCAG 大文字 / 非文本 3:1 门槛，**不得用作文字色、必要图形或组件识别边界**。
2. `brand-500` 白底 5.01:1；`brand-600`–`800` 均 ≥ 4.5:1。
3. 色阶登记不等于获得组件使用权；落地须走 §1.1 三步路径并登记用途与对比度配对。
4. 900 档**未提供**，标「待定义」，不臆造色值（`S03-D12`）。

> **主色与色阶的关系**：§2 的 `#6c47ff` 是 `G1` 唯一主色；本表 9 档是 `G2` 显式色板（上游未公布色阶）。二者不是「两个主色」——色阶是可供派生的原始色板，`colorPrimary` 是唯一语义主色出口。

### 10.2 中性 Slate 色阶（11 档）

| 档 | 唯一规范值 | 语义 | 运行时对应出口 |
|---|---|---|---|
| Slate 50 | `#F8FAFC` | canvas Light / 极浅表面 | `--subtle` Light（近似） |
| Slate 100 | `#F1F5F9` | surface-secondary | `--muted` / `--secondary` / `--accent` Light |
| Slate 200 | `#E2E8F0` | surface-tertiary / border | `--border` Light |
| Slate 300 | `#CBD5E1` | fg-disabled / border-strong | `--border-strong` Light |
| Slate 400 | `#94A3B8` | fg-tertiary | `--fg-disabled` Light；Dark 侧的多项 `--fg-*` / `--muted-foreground` |
| Slate 500 | `#64748B` | fg-secondary | `--fg-tertiary` / `--fg-placeholder` Light |
| Slate 600 | `#475569` | border-strong Dark | `--border-strong` Dark |
| Slate 700 | `#334155` | border Dark | `--border` Dark、`--fg-secondary` Light |
| Slate 800 | `#1E293B` | surface-secondary Dark | `--muted` / `--secondary` / `--accent` Dark |
| Slate 900 | `#0F172A` | surface Dark / fg-primary Light | `--foreground` / `--fg-primary` Light；E28 深色渐变实测背景（§6） |
| Slate 950 | `#020617` | canvas Dark | `--background` / `--card` / `--popover` Dark |

> Slate 50–950 是运行时实际在用的色值集合，本表收敛为可复用 Primitive 色板。全仓只读检索确认 `web/src` **不存在任何 `--slate-*` 变量**，故本表是规范层首次显式成表，不得宣称运行时已落地（`S03-D13`）。

---

## 11. Light / Dark 双主题语义映射（唯一规范值）

| Token | Light | Dark | 用途 |
|---|---|---|---|
| canvas | `#ffffff` | `#020617` | 页面底色（`--background`） |
| surface | `#ffffff` | `#020617` | 卡片、面板（`--card`） |
| surface-secondary | `#f1f5f9` | `#1e293b` | 次级容器（`--muted`） |
| surface-tertiary | `#e2e8f0` | `#334155` | 第三级表面（无专用表面 Token，同值者为 `--border`） |
| fg-primary | `#0f172a` | `#f8fafc` | 主文字（`--foreground`） |
| fg-secondary | `#5f6d80` | `#94a3b8` | 次级文字（`--muted-foreground`） |
| fg-tertiary | `color-mix()` 派生 | `color-mix()` 派生 | 辅助文字（随主题预设跟随） |
| fg-disabled | `color-mix()` 派生 | `color-mix()` 派生 | 禁用文字 |
| border | `#e2e8f0` | `#334155` | 标准边框 |
| border-strong | `#cbd5e1` | `#475569` | 强调边框 |
| border-subtle | — | — | `NOT_IMPLEMENTED`（`S03-D21`），落地须走 §1.1 |

**「Dark 不是 Light 的简单反转」原则（Adopt）**：`:root`（`theme.css:341+`）与 `.dark`（`theme.css:596+`）各自独立声明，`generated/brand.css` 亦 Light / Dark 各 8 色。深浅主题必须有独立的表面、文字与边框层级；Dark 缺独立抬升面为 `S03-D2` 治理候选，本轮不裁决、不改值。

**文字层级可读性约束**：正文与必要图形按 WCAG 2.2 AA（`UDS5-S13` §3.7）验收；§16.2 要求每个语义色成对定义并记录前景 / 背景配对实算结果。

---

## 12. 语义状态色与业务状态映射

### 12.1 四层结构（唯一规范出口）

| 方案层 | 运行时唯一出口 | 状态 |
|---|---|---|
| `*-solid` | `--success` / `--warning` / `--destructive` / `--info`（Light + Dark 各 4，见 §7.2） | 已有 |
| `*-bg` | `--{status}-soft`（4 族 × 2 主题 = 8 个 `--ds-color-{status}-soft` 映射） | 已有 |
| `*-border` | `--success-border` / `--warning-border` / `--info-border`（`color-mix` 派生）；危险态由 `--border-destructive-subtle` 承担 | 已有 |
| `*-fg` | `--{status}-foreground`（实心底上的文字）+ `--{status}-soft-foreground`（soft 底上的文字） | 已有，比四层结构更细 |

### 12.2 Uter 业务状态语义映射（19 项，只做语义映射）

| 业务状态 | 颜色语义 | 仓库 Token 出口 |
|---|---|---|
| API 请求成功 | Success | `--ds-color-text-success` / `--ds-color-success-soft` + `-soft-foreground` |
| API 请求失败 | Danger | `--ds-color-text-danger` / `--ds-color-destructive-soft` + `-soft-foreground` |
| API 请求处理中 | Info | `--ds-color-text-info` / `--ds-color-info-soft` + `-soft-foreground` |
| API 请求超时 | Warning | `--ds-color-text-warning` / `--ds-color-warning-soft` + `-soft-foreground` |
| 模型渠道在线 | Success | 同上 Success 族 |
| 模型渠道离线 | Danger | 同上 Danger 族 |
| 模型渠道降级 | Warning | 同上 Warning 族 |
| 余额充足 | Success | 同上 Success 族 |
| 余额不足 | Warning | 同上 Warning 族 |
| 余额耗尽 | Danger | 同上 Danger 族 |
| 充值成功 | Success | 同上 Success 族 |
| 退款处理中 | Warning | 同上 Warning 族 |
| 退款完成 | Success | 同上 Success 族 |
| 退款失败 | Danger | 同上 Danger 族 |
| Token 使用中 | Brand | `--ds-color-primary-subtle` + `--uter-brand-soft-foreground` + `--ds-color-primary-border` |
| Token 已禁用 | Neutral | `--ds-color-text-disabled` / `--ds-color-surface-muted` |
| 任务排队中 | Info | 同上 Info 族 |
| 任务执行中 | Brand | 同「Token 使用中」 |
| 任务失败 | Danger | 同上 Danger 族 |

`验证状态 NOT_VERIFIED`（逐页引用一致性未核查）。

### 12.3 四条强制约束

1. **颜色不得作为唯一信息载体**：余额、订单、渠道、退款、任务、API 状态必须同时具备文字或图标（WCAG 1.4.1）。
2. **资金真实性**：余额、充值、退款状态不得在服务端确认前用 Success 色断言结果，遵守 `UDS5-S31` §9 `OB-9.1`..`OB-9.8`。
3. **Brand 边界**：Brand 用于状态标识时只承担图标 / 描边 / 小面积标记，不得作为状态底大面积填充（B4）。
4. **Neutral 语义**：「已禁用」走 `--ds-color-text-disabled`，不得与「次要但可用」的 `--ds-color-text-tertiary` 混用。

---

## 13. 交互状态颜色

### 13.1 交互 Token 唯一出口

| 交互态 | 唯一规范出口 | 状态 |
|---|---|---|
| Primary default | `--ds-color-action-primary-strong` / `--ds-color-action-primary-foreground` | 已有 |
| Primary hover | `--ds-color-action-primary-hover`（`--hover-primary`） | 已有 |
| Primary active | `--ds-color-action-primary-active`（`--primary-active`） | 已有 |
| Destructive hover | `--ds-color-action-destructive-hover`（`--hover-destructive`） | 已有 |
| Success hover | `--ds-color-action-success-hover`（`--hover-success`） | 已有 |
| focus ring | `--ds-focus-ring-color: var(--ring)` + `--ds-focus-ring-width: 2px` | 已有；外偏移量 `S03-D6` 待裁决 |
| selection-bg / selection-fg | — | `NOT_IMPLEMENTED`（`S03-D21`）；**必须成对定义**，不得只补背景 |
| overlay | `--ds-color-surface-overlay: #000000`（恒黑、深浅同值）+ 调用方透明度修饰 | 已有 |
| disabled-bg | `--muted` + 组件 `disabled:bg-muted` | 已有 |
| disabled-border | `--border`（无独立 Token） | 部分覆盖（`S03-D21`） |
| Secondary / Ghost / Text Link 三态 | 无独立三态 Token | `NOT_IMPLEMENTED`（`S03-D21`） |

> 悬停 / 按下必须走专用 `*-hover` / `*-active` Token，禁止 `hover:bg-primary/90`（T14）。`verify-contrast.mjs` 的 `NEGATIVE_OLD_SELECTED_STATE` 已拒绝 `#5B5EE6` on `#F0F0FF` = 4.44:1 的旧选中态，选中色改动须重跑该守卫。

### 13.2 交互规范五条

| 规则 | 仓库落点 | 状态 |
|---|---|---|
| 所有可键盘访问元素须有明显 Focus Ring | `foundations/accessibility.css`、`--ds-focus-ring-width: 2px`、`:focus-visible` | 已有；逐组件覆盖 `NOT_VERIFIED` |
| Hover 不应导致布局变化 | `*-hover` Token 只换色不换几何；`UDS5-S17` | 规则已覆盖，逐组件未核 |
| Active 不应仅靠改变文字颜色表达 | `--ds-color-action-primary-active` 等专用 Token（T14） | 已有 |
| Disabled 不应仅依赖降低透明度 | `--ds-color-text-disabled` + `disabled-bg` / `disabled-border` + `aria-disabled` | **部分**：文案禁用色为 `color-mix()` 透明度派生，与规则有张力 → `S03-D24` 待裁决 |
| Selected 须有背景 / 边框 / 图标之一 | `--accent` / `--ds-color-surface-accent` / `--ds-color-primary-subtle` / `--ds-color-primary-border` | 已有 |

---

## 14. 数据可视化颜色

### 14.1 六色唯一规范值（`G2`，运行时 `oklch()` 双主题）

`theme.css:389-394`（Light）与 `:645-650`（Dark）；`--color-chart-1..6` 注册于 `theme.css:189-194`；`tokens/chart-typography.ts` 为 T4 TS 镜像。

| Token | Light | Dark |
|---|---|---|
| `--chart-1` | `oklch(0.72 0.18 250)` | `oklch(0.76 0.14 250)` |
| `--chart-2` | `oklch(0.65 0.15 200)` | `oklch(0.76 0.13 200)` |
| `--chart-3` | `oklch(0.7 0.12 280)` | `oklch(0.76 0.13 285)` |
| `--chart-4` | `oklch(0.68 0.19 325)` | `oklch(0.75 0.16 325)` |
| `--chart-5` | `oklch(0.68 0.16 155)` | `oklch(0.76 0.14 155)` |
| `--chart-6` | `oklch(0.7 0.15 30)` | `oklch(0.75 0.13 30)` |

> 换算近似仅供阅读，多数超出 sRGB 色域，**不是运行时实测值**；不得宣称与任何 hex 值等值。

### 14.2 固定数据系列顺序

| 序 | 业务系列 | 仓库 Token |
|---|---|---|
| 1 | Token 使用量 | `--chart-1` |
| 2 | 成功请求量 | `--chart-2` |
| 3 | 成本与消费 | `--chart-3` |
| 4 | 错误与异常趋势 | `--chart-4` |
| 5 | 请求总量 / 辅助指标 | `--chart-5` |
| 6 | 保留槽位（分类标识） | `--chart-6` |

> `--chart-4` 只表示「第 4 系列」，**不得固定解释为错误色**；错误 / 成败仍走 `--success` / `--warning` / `--destructive` / `--info` 及其 `-soft` 变体。图表色独立于状态色，不得混用。

### 14.3 图表统一规则

| 元素 | 应引用 Token | 运行时状态 |
|---|---|---|
| 网格线 | `border-subtle` → 无独立 Token 时退用 `--ds-color-border` | 待落地（`S03-D21`） |
| 坐标轴文字 | `fg-tertiary` → `--ds-color-text-tertiary` | 语义层已有 |
| Tooltip 背景 | `surface` → `--ds-color-surface-popover` | 已有 |
| Tooltip 边框 | `border` → `--ds-color-border` | 已有 |
| Tooltip 标题 | `fg-primary` → `--ds-color-text-primary` | 已有 |
| 数据点描边 | 对应 `--chart-N` | 已有 |
| 面积图填充 | 系列色叠加 **12%–20%** 透明度 | 无独立 Token，`S03-D21` |
| 图例 / 线型 / 点形标记 | 非颜色编码，必须同时提供 | 3.0 §2.8 已要求 |

> `UDS5-S19` 的 P2「图表独立 Token 未定义」保持 **Pending**；本节只补齐语义映射与固定顺序，**代码落地仍为 Pending**，不得据本节勾选通过。

---

## 15. 颜色架构层级与组件颜色出口

### 15.1 L1–L4 阅读视图（Adapt，不另立体系）

| 方案层 | 5.0 对应 | 裁决 |
|---|---|---|
| L1 Primitive | `UDS5-S01` §6.3 运行时 L1 Primitive / 治理 L1 Foundation | **Adapt** |
| L2 Brand / Neutral / Semantic / Chart | `UDS5-S01` §6.3 运行时 L2 Semantic + 治理 L1 | **Adapt** |
| L3 Background / Foreground / Border / Interactive / DataViz | `--ds-color-*` / `--ds-stroke-*` / `--ds-focus-ring-*` | **Adapt** |
| L4 Component Tokens | `UDS5-S14` 组件契约 + `UDS5-S01` 治理 L3–L5 | **Adapt**（仓库无独立组件色 Token 层，由组件 variant 表达） |

> `UDS5-S01` §6 已定义治理五层、§6.3 已定义运行时 Token 三层；本表只作颜色系统内部阅读视图，不新建第二套 Token 体系。**注意**：按 2026-11-15 上游裁决，规范层的变量结构口径为 `G1` 扁平单层 24 键（§4.2），运行时三层为过渡期实现现状。

### 15.2 组件颜色出口（10 行）

| 组件 / 元素 | 状态 | 背景 | 文字 | 边框 / 描边 |
|---|---|---|---|---|
| Primary Button | default | `--ds-color-action-primary-strong` | `--ds-color-action-primary-foreground` | — |
| Primary Button | hover / active | `--ds-color-action-primary-hover` / `--ds-color-action-primary-active` | 同 default | — |
| Primary Button | focus | 不变 | 不变 | `--ds-focus-ring-color` / `--ds-focus-ring-width: 2px` |
| Primary Button | disabled | `--muted` | `--ds-color-text-disabled` | `--ds-color-border` |
| Status Badge | Success / Warning / Danger / Info | `--ds-color-{status}-soft` | `--ds-color-{status}-soft-foreground` | `--{status}-border` |
| Status Badge | 进行中 / 执行中（Brand） | `--ds-color-primary-subtle` | `--uter-brand-soft-foreground` | `--ds-color-primary-border` |
| Status Badge | 已禁用（Neutral） | `--ds-color-surface-muted` | `--ds-color-text-disabled` | `--ds-color-border` |
| Dashboard Card | 表面 | `--ds-color-surface-card` | 指标 `--ds-color-text-primary`；标签 `--ds-color-text-secondary` | `--ds-color-border`，`--ds-stroke-width: 1px` |
| 输入框 | default / hover / focus / error / disabled | 见 §7.3 九项出口 | 见 §7.3 | 见 §7.3 |
| 数据表格 | 行 / 表头 / 选中 / 悬浮 | `--ds-color-surface-card` / `--muted` / `--accent` | `--ds-color-text-primary` / `-secondary` | `--ds-color-border` |

> Dashboard「`+12.8%`」是 Token 消耗量运营指标，不是金融行情涨跌；沿用语义 Token 并强制配合文字与箭头图标，不引入涨跌专用语义（`S03-D25`）。

---

## 16. 治理规则、自动验证与证据

### 16.1 七条规范逐条落点

| # | 规范 | 5.0 落点 | 判定 |
|---|---|---|---|
| 1 | 对比度 WCAG 2.2 AA（正文 4.5:1 / 大字 3:1 / 边界与必要图形 3:1） | `UDS5-S13` §3.7；E24 两处 3.76:1 / 3.30:1 保持 P1 待修 | 已覆盖，**不得勾选通过** |
| 2 | 禁止直接使用原始色值 | T7 / T8 / T13 / T14 / T15 + §1.1 三步路径 + `brand-colors.ts` 唯一裸色值所有者 | 已覆盖 |
| 3 | Light / Dark 独立映射、组件不判断主题 | `:root` + `.dark` 独立声明；`UDS5-S10` ST-3 禁止组件写 `.dark` 分支 | 已覆盖（逐组件 `NOT_VERIFIED`） |
| 4 | 图表独立管理 | 3.0 §2.8 / 本文 §3 第 15 类 / §14 | 已覆盖 + 系列顺序与统一规则 |
| 5 | 状态一致性 | 本文 §12.2 的 19 项业务状态映射 | 规范层；逐页一致性 `NOT_VERIFIED` |
| 6 | 颜色不作为唯一信息载体 | 3.0 §2.7 / §2.8、本文 §12.3 / §14.3 | 已覆盖 + 重申 |
| 7 | 颜色变更必须自动验证（对比度 / Token 引用 / 主题完整性 / 未定义颜色） | `verify-contrast.mjs`、`generate-design-tokens.mjs --check`、`lint:design:strict`、`sync-design-showcase.mjs --check`；「主题成对完整性」与「未定义颜色引用」未见专门校验器 | **部分覆盖**，缺口 `S03-D26`，不虚构脚本 |

### 16.2 颜色变更的七条执行约束

1. 任何色值变更先走 `UDS5-S01` §19，且必须按 §1.1 三步路径落地。
2. 每个语义色必须 Light / Dark **成对**定义；单侧新增视为违规。
3. 新增色必须登记用途、对比度要求，以及至少一组前景 / 背景配对的实算结果。
4. 组件层禁止 `#hex` / `rgb()` / `oklch()` / Tailwind 调色板类（T7 / T8）。
5. 状态色与图表色不得互借；图表系列不得借用 Success / Warning / Danger 作常规序列色。
6. 品牌渐变 E28 三停靠站深浅同值、禁止 `.dark` 覆盖，唯一出口 `@utility ds-text-gradient-brand`。
7. 变更后必须复跑 §16.4 门禁清单并保留命令与退出码证据；未跑不得勾选通过。

### 16.3 唯一规范值与差异合并的验收断言

| 断言 | 判定方式 |
|---|---|
| 任一颜色属性在 §2 / §7 / §10–§14 中只出现一个规范值 | 全文不得存在任何第二套建议值的表头、对照列或「规范基线 vs 运行时值」双列结构；每个属性只有一个值 |
| `G1` 主色唯一 | §2 只出现 `#6c47ff` 作为主色；§10.1 色阶表是 `G2` 原始色板，不定义第二主色 |
| `E24` / `E28` / 状态标签保留 | §5 / §6 / §8 / §16.1 原样保留，未被当作设计值删除 |
| 规范—实现差异登记为待迁移 | §2.1 / §9 / `UDS5-S01` §4.2 一致，未宣称代码已对齐 |

### 16.4 本轮实际执行的命令与证据（2026-11-15）

> 全部命令在 `/Users/lincolnhu/uter/web` 下执行，均为**只读 / 静态门禁**；执行前后运行时文件零改动。

| 命令 | 退出码 | 关键输出 |
|---|---|---|
| `bun run design:5:check` | **0** | `verdict: PASS` / `standards 37` / `registeredDocIds 37` / `scannedMarkdown 35` / `errors 0` |
| `bun run design:showcase:5:check` | **0** | `errors 0` / `specIds 37` / `componentIds 65` / 全量 Token / 字体 / 组件样本覆盖断言 |
| `bun run design:tokens:check` | **0** | `Design token source and generated CSS are in sync.` |
| `bun run design:showcase:check` | **0** | `17 PASS / 0 FAIL / 0 SKIP` |
| `bun run verify:contrast` | **0** | `PASS; checks=31; failed=0` |
| `bun run lint:design:strict` | **0** | `通过。扫描 1276 个文件` |
| `bun run design:clerk:check` | **0** | `errors 0` / C4 能力清单 / C5 业务红线通过 |

**证据边界（不得省略）**：

1. 上述验证的是**注册表结构、DTCG 同步、静态扫描、既有对比度守卫与红线守卫**；**不验证**本轮上游对齐后的规范值已在运行时落地，也不验证新增色板、业务状态映射、图表系列顺序与交互规则已实现。§9–§16 全部 `NOT_VERIFIED`。
2. 规范基线主色 `#6c47ff` 与运行时代码值冲突，属**上级授权的待迁移项**；迁移前 `verify-contrast.mjs` / T1–T17 仍按现行代码值执行，不得据本规范宣称代码已对齐。
3. 临时换算脚本 `/tmp/uter-*.mjs` **不入仓库**，输出仅作规范登记依据，不是门禁证据。
4. **未执行**：`scripts/verify-all.sh` 全量门禁、`bun run typecheck` / `test` / `lint` / `build:check`、双轨视觉回归、`test:axe`、E24 两处对比度复测、新增色值的专项对比度验收、65 组件颜色引用逐项证据、Android / iOS / HarmonyOS 平台验收、运行时代码迁移。
5. 本轮**未执行任何 git 暂存 / 提交 / 推送 / 建分支操作**；工作区并发 WIP（含 `web/src/styles/theme.css`）全部隔离。

## 与其他规范的关系

| 对象 | 关系 |
|---|---|
| `UDS5-S01` 总纲 | **上级规范，一律遵循**；品牌基线、版本口径、D1 / D4 决策、差异登记口径均继承自总纲 |
| `UDS5-S02` Foundation | 本文是 S02 §2 / §8.9 / §9.5 颜色约束的展开；T7 / T8 / T13 / T14 / T15 的门禁编号以 S02 §10 总表为准 |
| `UDS5-S04` Typography / `UDS5-S05` Spacing | 并列下级规范；颜色不介入字排与间距的数值定义 |
| 5.0 后续 `ELEVATION-AND-BORDER` / `THEME` / `ACCESSIBILITY` 专题 | 只可细化本文，不得放宽 T7 / T8 / T13–T15，不得另立颜色体系 |
| `AGENTS.md` / `web/AGENTS.md` | 上位工程约定；本文遵守「数值以代码为准、规则以规范为准」与资金 / 认证红线 |
| `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md` | **历史版本**；E24 / E28 / §17.5 / §26 仅为历史缺陷与例外台账的追溯来源，不作现行验收依据 |
| `audit/BASELINE-AUDIT.md` / `audit/CLERK-DESIGN-REFERENCE-ANALYSIS.md` | 本文数值与冲突结论的唯一事实源 |

## 代码实施位置

| 类别 | 真实路径 |
|---|---|
| 品牌 DTCG 真源 | `web/src/design-system/source/brand.tokens.json`、`brand.tokens.schema.json` |
| 生成物 | `web/src/design-system/tokens/generated/brand.css` |
| 语义映射 | `web/src/design-system/tokens/colors.css`、`semantic.css`、`elevation.css`、`primitives.css` |
| 基础调色板 | `web/src/styles/theme.css`、`theme-presets.css`、`index.css` |
| 唯一入口 | `web/src/design-system/tokens/index.css`（6 条 `@import`） |
| 收口文件 | `web/src/design-system/tokens/brand-colors.ts`、`chart-typography.ts` |
| 消费工具 | `web/src/design-system/foundations/{decoration,icons,motion,typography,accessibility,index}.css` |
| 组件与页面 | `web/src/components/ui/`、`web/src/components/data-table/`、`web/src/routes/` |
| 守卫测试 | `web/src/design-system/__tests__/semantic-colors.test.ts`、`status-badge-contrast.test.ts`、`text-color-fallback.test.ts`、`accessibility.test.ts`、`token-source.test.ts` |
| 展示产物 | `docs/design-system/showcase.html`、`showcase.tokens.js` |
| 本规范 | `docs/design-system/uter-design-system-5.0/03-COLOR-STANDARD.md` |

## 自动化验证

| 脚本 / 命令（真实存在） | 用途 | CI 状态 |
|---|---|---|
| `web/scripts/check-design-tokens.mjs`（`bun run lint:design:strict`） | T7 / T8 / T13 / T14 / T15 静态门禁 | `ci.yml` `frontend` job 已接入 `:417` |
| `web/scripts/generate-design-tokens.mjs --check`（`bun run design:tokens:check`） | DTCG 真源与 `generated/brand.css` 同步 | 已接入 `:406` |
| `web/scripts/verify-contrast.mjs`（`bun run verify:contrast`） | 对比度、E24 复测、E28 渐变锚定与负例拒绝 | 已接入 `:414` |
| `web/scripts/sync-design-showcase.mjs --check`（`bun run design:showcase:check`） | 17 条 Manifest 一致性校验 | 已接入 `:411` |
| `web/scripts/visual-regression.mjs`（`bun run test:visual`） | showcase 双视口像素基线 | 已接入 ci.yml :423（E2E 双轨刻意不接 CI） |
| `web/e2e/axe/playwright.config.ts`（`bun run test:axe`） | 无障碍 E2E | **刻意不接 CI**，仅开发机手动 |
| `web/src/design-system/__tests__/`（Vitest） | 语义色 / 对比度守卫测试 | 随 `bun run test` |
| `web/design-tokens.baseline.json` | 基线只减不增（0 条） | `--strict` 使用 |
| `bun run typecheck` / `lint` / `test` / `build:check` | 前端基础门禁 | 已接入 |

> **历史轮次说明**：首轮撰写（2026-11-14）未执行上述任何命令；2026-11-15 补充轮与上游对齐 / 差异合并轮均只执行只读 / 静态门禁，范围、退出码与证据边界见 §16.4，**不构成颜色实现、对比度实测或视觉验收**。本轮按上级裁决把规范基线对齐 clerk.com 并合并全部双值，运行时代码零改动。

## 验证状态

| 项 | 状态 |
|---|---|
| 文档 ID / 版本 / 状态 | `UDS5-S03` / `5.0.0` / `ACTIVE`（2026-11-15 上游对齐 + 差异合并：删除全部第二套建议值，版本不变） |
| 本轮实际动作 | 改写 `UDS5-S01` / `UDS5-S02`–`S12` / `UDS5-S15` / `UDS5-S21` / `UDS5-S24` / `UDS5-S32` / `FINAL-ACCEPTANCE-REPORT` / `UDS5-S26` 等规范文本与 Showcase 生成链；**未修改 `web/src` 运行时代码**、`.uap`、CI 业务配置、`package.json` 依赖；未执行 git 操作 |
| 本轮执行的验证命令 | 7 条只读 / 静态门禁，全部 `EXIT=0`（见 §16.4）；**均为结构类检查，不构成颜色实现验收** |
| 验证状态 | **`NOT_VERIFIED`** |
| 17 类语义 Token | 规范层已建立；实际组件引用逐项核验 `NOT_VERIFIED` |
| 上游对齐与差异合并（§9） | 规范层唯一值已建立（`UDS5-S01` §4.2 `G1`/`G2`）；主色 `#6c47ff` 与运行时代码的迁移、Primitive 色板落地、业务状态映射逐页一致性、图表规则落地、交互 Token 缺口补齐全部 `NOT_VERIFIED` / `NOT_IMPLEMENTED` |

**未验证 / 未执行清单**：E24 两处对比度修复（3.76:1 / 3.30:1）及其复测、焦点环 `2px`（已裁决）在组件层与原生兜底的同步及回归测试验证、`test:axe`、双轨视觉回归、全量构建、`brand.tokens.json` 的 `status: DRAFT` / `decision: AUTO_BLOCKED` 解封证据链、`G1` 主色与运行时代码的迁移（按 §19）、Terminal ANSI 0–15 全色板落地（P1）、图表 text / axis / label / grid 独立 Token（P2）、`--ds-decor-*` 纳入 `colors.decoration`（P3）、3 个纯别名压缩消失根因定位、65 组件颜色引用逐项证据、Android / iOS / HarmonyOS 平台验收。`verify-contrast.mjs` / `lint:design:strict` / `design:tokens:check` / `design:showcase:check` 已复跑且 `EXIT=0`（§16.4），但**仅覆盖既有守卫，不含本轮新增色值的专项验收**。

**本轮新增未验证项**：`G1` 主色 / 13px 基准 / 6px 圆角 / 16px 间距 / 24 键变量结构在 `web/src` 的迁移与专项对比度、视觉回归验收（按 `UDS5-S01` §19）；§10 Primitive 色板（Brand 9 档 / Slate 11 档）落地与逐档对比度专项验收、§11 双主题映射逐项落地、§12.2 的 19 项业务状态映射逐页引用一致性、`S03-D17-b` Dark Success 实心配对核实、§13 交互 Token 缺口（`S03-D21`）补齐、§14.2 / §14.3 固定系列顺序与图表统一规则落地（`UDS5-S19` P2 仍 Pending）、§15.2 组件颜色出口逐组件核验、`S03-D26` 两项自动校验器落地、全量 `scripts/verify-all.sh` 与 `bun run typecheck` / `test` / `lint` / `build:check`。
