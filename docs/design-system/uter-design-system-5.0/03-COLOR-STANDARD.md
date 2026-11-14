# UTER Design System 5.0 — Color 规范

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S03` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01` |
| 生效日期 | `2026-11-14` |
| 适用范围 | 全部颜色语义 Token、品牌 DTCG 真源与生成链、Light/Dark 成对定义、图表与渐变色、业务组件的颜色引用方式 |
| 验证状态 | `NOT_VERIFIED` |

> **状态声明**：本文定义颜色语义与引用规则，**不声明任何测试已通过、任何组件已 `FULLY_VERIFIED`、任何平台已验收**。本轮未执行验证命令，`验证状态` 为 `NOT_VERIFIED`。事实依据为 `audit/BASELINE-AUDIT.md`、`audit/CLERK-DESIGN-REFERENCE-ANALYSIS.md` 与对仓库内已存在文件的只读核实。**下级规范一律遵循 `UDS5-S01` 总纲**。

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

## 2. 品牌基线（5.0 规范口径，必须保留）

| 状态 | Primary | Hover | Active |
|---|---|---|---|
| Light | `#5B5EE6` | `#494CC7` | `#3F42B0` |
| Dark | `#8B8DF5` | `#A1A3F7` | `#B7B8FA` |

配套基线：字体 `Inter Variable` + `Noto Sans SC Variable`；正文 `14/22`、caption `12/18`、长文本 `16/26`、最小 `12px`；`4pt` 间距；`1px` 边框；焦点环 `2px` / `ring-2`（已裁决）；**优先表面色差而非重阴影**。

> 焦点环口径**已由 team-lead 裁决**：5.0 采用 `2px` / `ring-2`（运行时真值 `tokens/semantic.css:120-123`，与 3.0 §15.1 一致）。作废的是「把 `1px` / `ring-1` 当作**焦点环宽度**」这一过时记忆，`1px` 不再是焦点环可选基线；**装饰性 `ring-1` 描边 1px 与 `1px` 边框均为真实有效值**（不承载焦点语义，3.0 §15.1 分类，07 分册按 1px 登记），须原样保留、不得改成 2px，也不得把「1px」无差别替换。依据 `AGENTS.md`「设计值来自代码」及用户 PART 0 原则 A 未规定焦点环宽度；运行时代码本身已是 `2px`，本轮不改任何代码值。详见 `UDS5-S01` §4.2.1。验证状态 `NOT_VERIFIED`（未执行浏览器级守卫复核）。

### 2.1 差异登记（Adapt，`NOT_VERIFIED`）

| 项 | 规范基线 | 仓库文件记录值 | 处置 |
|---|---|---|---|
| Light hover | `#494CC7` | `source/brand.tokens.json` / `generated/brand.css` 为 `#4F52D1` | 登记差异，统一前须走 `UDS5-S01` §19 变更流程并补证据 |
| Light active | `#3F42B0` | 同上为 `#4A4DC5` | 同上 |
| Dark primary | `#8B8DF5` | `generated/brand.css` `.dark` 为 `#A1A3F7` | 同上 |
| Dark hover | `#A1A3F7` | 同上为 `#B1B3FF` | 同上 |
| Dark active | `#B7B8FA` | 同上为 `#9294F7` | 同上 |
| 文件状态 | — | `brand.tokens.json` 为 `status: DRAFT` / `decision: AUTO_BLOCKED` / `changeApproval: NOT_VERIFIED`，`designSystem` 仍写 `3.0` | 不得擅自变更状态；不得据生成物反改规范基线 |

**处理口径**：这是「指令原文与仓库事实冲突 → **Adapt**」的又一处实例。规范层保留 5.0 基线值；运行时真值以代码为准；差异项一律 `NOT_VERIFIED`，本轮不改写 `web/src`、不宣称二者一致、不把差异静默抹平。`brand.tokens.json` 的 `decision: AUTO_BLOCKED` 明确「自动阻断，等待当前 CI 证据，不是人工审批队列」。

> 交叉引用与边界：该差异已在 `10-THEME-STANDARD.md` §10.1 / `S10-D7` 按 **Adapt + `NOT_VERIFIED`** 同步登记（team-lead 已授权**差异登记**，但**色值 / `DRAFT` 状态变更仍未授权**）。上表的态位对应按 `web/src/design-system/source/brand.tokens.json` 的 DTCG 键名（`primary` / `hover` / `active` 等）读取；**用户基线标签到 DTCG 键名的语义等价未逐一独立核实**，故不得宣称「逐值一一对应已验证」。运行时以 `web/src/design-system/tokens/generated/brand.css` 为准，本轮不改任何色值。

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
- 禁止 `color-mix()` 之外的运行时派生来凑层级；Uter 静态声明、无浏览器下限依赖，不倒退到 Clerk 式扁平单层 24 键 + `color-mix()` 运行时派生体系（D5 / `CLERK-DESIGN-REFERENCE-ANALYSIS` §2.5）。

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
| 深色补偿 | 深色主题靠更暗背景自然获得更高对比度（记录值 7.02 / 6.56 / 4.51:1），不靠改渐变值 |
| 验证 | `web/scripts/verify-contrast.mjs` 含 E28 渐变锚定与负例拒绝；本轮未执行，`NOT_VERIFIED` |

---

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
| `web/scripts/visual-regression.mjs`（`bun run test:visual`） | showcase 双视口像素基线 | 本地专用 |
| `web/e2e/axe/playwright.config.ts`（`bun run test:axe`） | 无障碍 E2E | **刻意不接 CI**，仅开发机手动 |
| `web/src/design-system/__tests__/`（Vitest） | 语义色 / 对比度守卫测试 | 随 `bun run test` |
| `web/design-tokens.baseline.json` | 基线只减不增（0 条） | `--strict` 使用 |
| `bun run typecheck` / `lint` / `test` / `build:check` | 前端基础门禁 | 已接入 |

**本轮未执行上述任何命令**。

## 验证状态

| 项 | 状态 |
|---|---|
| 文档 ID / 版本 / 状态 | `UDS5-S03` / `5.0.0` / `ACTIVE` |
| 本轮实际动作 | 仅撰写规范文本；未修改 `web/src`、`.uap`、CI、`package.json`；未执行 git 操作 |
| 本轮执行的验证命令 | **无** |
| 验证状态 | **`NOT_VERIFIED`** |
| 17 类语义 Token | 规范层已建立；实际组件引用逐项核验 `NOT_VERIFIED` |

**未验证 / 未执行清单**：E24 两处对比度修复（3.76:1 / 3.30:1）及其复测、焦点环 `2px`（已裁决）在组件层与原生兜底的同步及回归测试验证、`verify-contrast.mjs` 复跑、`lint:design:strict` 全量扫描复跑、`design:tokens:check` 与 `design:showcase:check` 复跑、`test:axe`、双轨视觉回归、全量构建、`brand.tokens.json` 的 `status: DRAFT` / `decision: AUTO_BLOCKED` 解封证据链、§2.1 五处色值差异的统一、Terminal ANSI 0–15 全色板落地（P1）、图表 text / axis / label / grid 独立 Token（P2）、`--ds-decor-*` 纳入 `colors.decoration`（P3）、3 个纯别名压缩消失根因定位、65 组件颜色引用逐项证据、Android / iOS / HarmonyOS 平台验收。
