# UTER Design System 5.0 — Typography 规范

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S04` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01` |
| 生效日期 | `2026-11-14` |
| 适用范围 | 全部字排语义、`@theme` 字号阶梯、Heading / Body / Label / Caption / Code / Numeric / Link / Button Text / Table Text / Form Text、H5 输入字号规则、`--ds-font-*` 语义别名 |
| 验证状态 | `NOT_VERIFIED` |

> **状态声明**：本文定义字排规则与阶梯，**不声明任何测试已通过、任何组件已 `FULLY_VERIFIED`、任何平台已验收**。本轮未执行验证命令，`验证状态` 为 `NOT_VERIFIED`。事实依据为 `audit/BASELINE-AUDIT.md`、`audit/CLERK-DESIGN-REFERENCE-ANALYSIS.md` 与对 `web/src/design-system/tokens/typography.css`、`semantic.css`、`spacing.css`、`web/scripts/check-design-tokens.mjs` 的只读核实。**下级规范一律遵循 `UDS5-S01` 总纲**。

---

## 品牌基线（引用 `UDS5-S01` §4.2，本规范遵守不偏离）

| 类别 | 5.0 规范基线值 |
|---|---|
| Primary Light | `#5B5EE6` / Hover `#494CC7` / Active `#3F42B0` |
| Primary Dark | `#8B8DF5` / Hover `#A1A3F7` / Active `#B7B8FA` |
| 字体 | `Inter Variable` + `Noto Sans SC Variable` |
| 正文 / Caption / 长文本 / 最小字号 | `14/22` / `12/18` / `16/26` / `12px` |
| 间距 / 边框 / 焦点环 | `4pt` / `1px` / `2px`（`ring-2`，已裁决） |
| 层级手段 | 优先表面色差而非重阴影 |

> 焦点环口径**已由 team-lead 裁决**：5.0 采用 `2px` / `ring-2`（运行时真值 `tokens/semantic.css:120-123`，与 3.0 §15.1 一致）。作废的是「把 `1px` / `ring-1` 当作**焦点环宽度**」这一过时记忆，`1px` 不再是焦点环可选基线；**装饰性 `ring-1` 描边 1px 与 `1px` 边框均为真实有效值**（不承载焦点语义，3.0 §15.1 分类，07 分册按 1px 登记），须原样保留、不得改成 2px，也不得把「1px」无差别替换。依据 `AGENTS.md`「设计值来自代码」及用户 PART 0 原则 A 未规定焦点环宽度；运行时代码本身已是 `2px`，本轮不改任何代码值。详见 `UDS5-S01` §4.2.1。验证状态 `NOT_VERIFIED`（未执行浏览器级守卫复核）。

---

## 1. 品牌字排基线（必须保留）

| 项 | 基线值 |
|---|---|
| 字体 | `Inter Variable` + `Noto Sans SC Variable`（`@fontsource-variable/inter ^5.3.0` + `@fontsource-variable/noto-sans-sc ^5.3.0`） |
| 正文 | `14 / 22` |
| Caption / Small | `12 / 18` |
| 长文本 | `16 / 26` |
| 最小字号 | `12px`（全站可见文本下限） |
| 间距 | `4pt` 基础单位 |
| 描边 | `1px` 边框 |
| 焦点环 | `2px` / `ring-2`（已裁决，见 `UDS5-S01` §4.2.1） |
| 层级手段 | 优先表面色差而非重阴影 |

字体真实性说明：Noto Sans SC 与 Source Han Sans（思源黑体）为同一字体家族的 Adobe / Google 双发行版，字符覆盖一致；品牌基线成立，但规范文本**必须写成实际包名，不得虚称引入了 `Source Han Sans` 字体文件**（`BASELINE-AUDIT` §2）。`data-theme-font`（system/sans/serif）字体轴未落地，保持 Pending，不得宣称可用。

---

## 2. 十五类字排规定

| # | 类别 | 规定 | 语义 Token / 落点 | 门禁 |
|---|---|---|---|---|
| 1 | **Font Family** | 主字体 `Inter Variable` + `Noto Sans SC Variable`；等宽用系统 mono 栈；5.0 规范层用 `--ds-font-*` 语义别名表达家族 / 场景，不新建第二套数值 Token | `tokens/typography.css`、`web/package.json` | T1 / T2 / T5 |
| 2 | **Weight** | 全站只用四档：`400 normal` / `500 medium` / `600 semibold` / `700 bold`；由 `@theme` 的 `--font-weight-normal` / `--font-weight-medium` / `--font-weight-semibold` / `--font-weight-bold` 注册 | `--ds-weight-regular/medium/semibold/bold`（`semantic.css:88-91`） | T1 |
| 3 | **Size** | 只能用 §3 的 18 档 `@theme` 阶梯；禁止 `text-[15px]`、`font-size: 15px`；正文基准 `14/22` | `--text-*` | T2 / T4 / T5 / T16 |
| 4 | **Line Height** | 行高由字号 Token 自带（`--text-*--line-height`），禁止 `leading-*` 覆盖（T9）；语义层用 `var(--text-*--line-height, <兜底>)`，兜底值须与 `typography.css` 一致（由 `tokens.test.ts` 断言）；多行 display 用 `--ds-line-display-multiline: 1.5` | `--ds-line-*`（`semantic.css:63-85`） | T3 / T9 |
| 5 | **Letter Spacing** | 字距由字号 Token 自带，禁止 `tracking-*`；仅 `tracking-normal` 放行；不得用 `letter-spacing` 内联值凑视觉 | `tokens/typography.css` | T12 |
| 6 | **Heading** | display / h1 / h2 / h3 / group-title 五层，具体值见 §4；字重 600；卡片与弹窗标题 `18/600/26` | `--ds-text-display` / `--ds-text-page-title` / `--ds-text-section-title` / `--ds-text-card-title` / `--ds-text-dialog-title` / `--ds-text-group-title` | T1 / T2 / T9 |
| 7 | **Body** | 常规正文 `14/22`（`--text-sm` / `--ds-text-body`）；连续阅读长文本 `16/26`（`--text-long` / `--ds-text-long`）；`body` 与 `body-sm` 同为 `14/22`，只是语义不同，不是两档字号 | `--ds-text-body` / `--ds-text-body-sm` / `--ds-text-long` | T16 |
| 8 | **Label** | 按钮文字 / 表单标签 / 导航项：`14 / 500 / 22` | `--ds-text-label`（`var(--text-sm)`） | T2 / T9 |
| 9 | **Caption** | 说明 / 占位符 / 徽标 / 时间：`12 / 18`；`small` 与 `caption` 同值 | `--ds-text-caption`（`var(--text-xs)`）、`--text-mono-xs` | T16 |
| 10 | **Code** | 正文等宽 `13/20`（`--text-mono`）；小型 ID `12/18`（`--text-mono-xs`）；代码 / 技术信息 `14/22`（`--text-mono-base`）；固定高度代码容器 `13/20`（`--text-mono-code`）；等宽卡片标题 `16/600/22`（`--text-mono-title`）；密集等宽行高 22px（例外 E2，`--ds-line-mono-dense`） | `--ds-text-mono*` / `--ds-line-mono*` | T1 / T2 / T9 |
| 11 | **Numeric** | 指标数值 / 行标题 / 设置字段 `16/24`（`--text-base`），**不是正文**；数字格式化须复用 `@/lib/format` 的 `formatNumber` / `formatCompactNumber`，`zhCN`/`zhTW` 进入 `Intl.*` 前经 `toIntlLocale()` | `--text-base`；`web/AGENTS.md` §3.1 | T2 / lint `project/intl-locale` |
| 12 | **Link** | 继承正文 `14/22`；用语义状态色与 2px 焦点环（`ring-2`，已裁决）表达可交互，不用字距或下划线变体凑层级；须键盘可达、可访问名称明确 | `--ds-color-*` / `--ds-focus-ring-color` / `--ds-focus-ring-width` | T12 / T13 |
| 13 | **Button Text** | `14 / 500 / 22`（label 档）；按钮字体可独立配置（借鉴 Clerk `fontFamilyButtons` 理念）落到 `--ds-font-*` 别名；`ui/button.tsx` 以 `cva()` 定义 6 variant × 9 size + 内置 `loading`；八态齐备 | `web/src/components/ui/button.tsx` | T2 / T9 / T12 |
| 14 | **Table Text** | 表格单元格 / 二级导航 / 分页用密集数据档 `13 / 20`（`--text-dense` / `--ds-text-dense`），仅限以扫读为主的密集数据，普通说明文字仍是 14px；表格行内边距由 `--ds-table-row-padding-y` 控制，不靠缩字号 | `tokens/spacing.css` | T16 / T17 |
| 15 | **Form Text** | 标签 `14/500/22`；输入文本 `14/22`；**H5 输入 ≥16px**；字段级错误就近展示；1px 边框 + 2px 焦点环（单档 `--ds-focus-ring-width`，已裁决）；错误态与 `aria-invalid` 一致 | `ui/input.tsx` / `form.tsx` / `field.tsx` / `form-label-tier.tsx` / `input-otp.tsx` | T16 / `web/e2e/axe/`（未验证） |

---

## 3. 18 档 `@theme` 字号阶梯（运行时真值）

来源：`web/src/design-system/tokens/typography.css` 的 `@theme {}` 块（`:68-142`），共 **18 个 `--text-*` 档 + 18 个行高 + 4 个 `--font-weight-*`**。

| # | 变量 | 字号 | 行高 | 语义用途 |
|---|---|---|---|---|
| 1 | `--text-xs` | 12px (`0.75rem`) | 18px (`1.125rem`) | small / caption |
| 2 | `--text-sm` | 14px (`0.875rem`) | 22px (`1.375rem`) | body / body-sm / label（全站基准） |
| 3 | `--text-mono-xs` | 12px | 18px | 小型 ID、标签 |
| 4 | `--text-mono` | 13px (`0.8125rem`) | 20px (`1.25rem`) | 正文里的等宽文本（模型 ID、密钥、行内代码） |
| 5 | `--text-mono-base` | 14px | 22px | 代码、技术信息 |
| 6 | `--text-mono-code` | 13px | 20px | 固定高度等宽代码容器 |
| 7 | `--text-mono-title` | 16px (`1rem`) | 22px | 等宽卡片标题（定价卡片模型名） |
| 8 | `--text-dense` | 13px | 20px | 表格单元格 / 二级导航 / 分页（Inter 字形密度档，不与 mono 系混用） |
| 9 | `--text-long` | 16px | 26px (`1.625rem`) | 长文本连续阅读 |
| 10 | `--text-base` | 16px | 24px (`1.5rem`) | 行标题 / 设置字段 / 指标数值 / body-long 原始值，**不是正文** |
| 11 | `--text-lg` | 18px (`1.125rem`) | 26px | h3 / 卡片标题 / 弹窗标题 |
| 12 | `--text-xl` | 18px | 26px | 卡片及次级标题（500） |
| 13 | `--text-2xl` | 20px (`1.25rem`) | 28px | 小型区块标题 |
| 14 | `--text-3xl` | 24px (`1.5rem`) | 32px (`2rem`) | 区块标题 |
| 15 | `--text-4xl` | 30px (`1.875rem`) | 38px (`2.375rem`) | 页面标题 |
| 16 | `--text-5xl` | 36px (`2.25rem`) | 44px (`2.75rem`) | 营销展示 / display / 特殊大标题 |
| 17 | `--text-md` | 15px (`0.9375rem`) | 24px | 次级正文 |
| 18 | `--text-group` | 16px | 24px | group-title 分组标题（页面层级第 4 层） |

补充约束：

- `body` 与 `body-sm` **同为 14/22**；把 `body` 当 16px 用是 2026-10-27 之前的旧写法，已废止。需要 16px 连续阅读一律走 `body-long`（`--text-long`）。
- 正文等宽定为 13px（规范 v1.2）：与 `dense` 同高，等宽字形比 Inter 宽，13px 等宽与 14px 正文并排视觉等重。
- 行高 2026-10-30 v1.2 放宽：正文 14px 由 20 → 22（1.57），12px 由 16 → 18（1.50）；控件文本落在固定高度容器（按钮 h-9、输入框 h-9），行高变化不改变控件实际高度。
- 阶梯到 36px 为止；更大尺寸（48/60px）不纳入系统，需要时先确认必要性并按例外流程登记。
- `simple-large` 预设（`[data-theme-preset='simple-large']`，`typography.css:159-196`）是**同一套阶梯的 ~1.35× 放大档**，不是第二套字号体系；声明在 `@theme` **之外**（运行时按 data 属性切换的覆盖值，放进 `@theme` 会被当成默认值再生成一遍工具类）。
- 密度档 `[data-theme-scale]` **只**改 `--spacing` 与 `--ds-*` 控件尺寸，**不缩放 `--text-*`**（`typography.css:65-66`、`spacing.css:19-27`）；放大文字走 `simple-large` 预设。

---

## 4. Heading 具体值与差异处置（Adapt）

### 4.1 5.0 规范目标口径（上级指令给定，必须保留）

| 层级 | 字号 | 字重 | 行高 |
|---|---|---|---|
| display | `36` | `600` | `44` |
| h1 | `28` | `600` | `36` |
| h2 | `22` | `600` | `30` |
| h3 | `18` | `600` | `26` |
| 正文 | `14` | `400` | `22` |
| caption / small | `12` | `400` | `18` |

### 4.2 运行时 `@theme` 真值（只读核实）

| 层级 | 语义 Token | 映射变量 | 真实字号 / 行高 | `typography.css` 注释记录 |
|---|---|---|---|---|
| display | `--ds-text-display` | `--text-5xl` | `36 / 44` | `display 36/600/44` |
| 页面标题 h1 | `--ds-text-page-title` | `--text-4xl` | `30 / 38` | `h1 30/600/38` |
| 区块标题 h2 | `--ds-text-section-title` | `--text-3xl` | `24 / 32` | `h2 24/600/32` |
| 卡片 / 弹窗标题 h3 | `--ds-text-card-title` / `--ds-text-dialog-title` | `--text-lg` | `18 / 26` | `h3 18/600/26` |
| 分组标题 | `--ds-text-group-title` | `--text-group` | `16 / 24` | 页面层级第 4 层 |
| 正文 | `--ds-text-body` | `--text-sm` | `14 / 22` | 全站基准 |
| caption | `--ds-text-caption` | `--text-xs` | `12 / 18` | small / caption |

### 4.3 冲突处置：指令原文与仓库事实冲突 → **Adapt**

| 项 | 指令原文（§4.1） | 仓库事实（§4.2） | 决策 |
|---|---|---|---|
| h1 | `28 / 600 / 36` | `30 / 600 / 38`（`--text-4xl`） | **Adapt** |
| h2 | `22 / 600 / 30` | `24 / 600 / 32`（`--text-3xl`） | **Adapt** |
| h3 | `18 / 600 / 26` | `18 / 600 / 26`（`--text-lg`） | 一致，直接沿用 |
| display | `36 / 600 / 44` | `36 / 600 / 44`（`--text-5xl`） | 一致，直接沿用 |
| 正文 / caption | `14/22`、`12/18` | `14/22`、`12/18` | 一致，直接沿用 |

处置规则（`UDS5-S01` §0.2 / §19 / §20 与 `AGENTS.md`「Design System Enforcement」）：

1. **数值以代码为准，规则与边界以规范为准**：文档与实现冲突时不得静默二选一。§4.1 作为 5.0 规范目标口径保留登记；**实际实现与验收一律按 §4.2 的 `@theme` 运行时真值**，不得以 §4.1 去改 `typography.css`，也不得把 §4.2 反写成规范基线。
2. 差异两项（h1 / h2）登记为 `NOT_VERIFIED`；若要将统一后的目标值落地，必须走 `UDS5-S01` §19 变更流程：先写回归测试 → 改 `tokens/typography.css` → 同步 `tokens/semantic.css` 的 `--ds-line-*`、17 条 showcase 校验契约、`tokens.test.ts` 断言及 3.0 历史文档引用 → 补命令证据。
3. 本轮**不修改 `web/src`**、不执行任何验证、不宣称二者已一致。
4. 该 Adapt 与 D1 属同一类处置：「指令原文与仓库事实冲突 → Adapt」，不是 `Adopt` 照抄、也不是 `Reject` 删码。
5. 与 `UDS5-S01` §4.2 的品牌三态色值差异**同样处理**：h1 `28/600/36` / h2 `22/600/30` 与运行真值 `30/38` / `24/32` 均按 Adapt 登记 `NOT_VERIFIED`，**不得改代码值**（`tokens/typography.css`、`brand.tokens.json`、`generated/brand.css` 一律保持原样）；品牌基线六色值本身不改；若统一须走 §19 变更流程并补回归测试与命令证据。

---

## 5. 关键决策 D1（必须遵守）

### 5.1 审计结论

Tailwind CSS **4.3.3** 中，`@theme { --text-sm: ...; --text-sm--line-height: ... }` 是 v4 提供的**自定义字号注册机制**：在 `@theme` 内声明即注册 `text-sm` 工具类并覆盖内置默认值，同时作为运行时可读 CSS 变量；写在 `:root` 则 `text-sm` 等工具类会静默回退到 Tailwind 内置默认值（`typography.css:58-63` 已记录该历史陷阱，此前项目出现过「改了刻度、页面没变」）。`@theme`（非 inline）同时把变量输出到 `:root`，所以 `var(--text-sm)` 写法仍可用。

依赖面：18 个工具类字号由此生成；**T1 门禁**（「`--text-*` 只能出现在唯一来源」）、`sync-design-showcase.mjs` 的 17 条校验、`web/src/design-system/__tests__/tokens.test.ts` 的断言、`foundations/typography.css` 的消费，全部依赖该机制。

### 5.2 冲突与 Adapt 处理

| 项 | 内容 |
|---|---|
| 指令原文 | 「不得使用 Tailwind v4 保留的 `--text-*` 命名空间定义自有字体 Token」 |
| 仓库事实 | v4.3.3 的 `@theme --text-*` 是自定义字号注册机制，不是被占用的保留命名空间；T1 / 17 条校验 / `tokens.test.ts` 均依赖它（`BASELINE-AUDIT` §4.2 / §9 D1） |
| 决策 | **Adapt**（`BASELINE-AUDIT` §9 D1） |
| 运行时 | **保留 `@theme --text-*`，禁止删除或禁用**；删除会使全站字号静默回退并打破 T1 门禁 |
| 规范层 | 5.0 另立 `--ds-font-*` 语义别名体系，用于文档表述、跨端映射与组件契约 |
| 禁止 | 不 `Adopt` 照抄指令删码、不 `Reject` 禁用门禁、不把 `@theme` 变量迁到 `:root`、不新建第二套数值 Token |
| 记录义务 | 本结论在 `UDS5-S01` §20 与本文同步记录 |

### 5.3 `--ds-font-*` 语义别名方案（规范层设计）

| 别名组 | 语义 | 映射到的运行时真值 | 用途 |
|---|---|---|---|
| `--ds-font-family-sans` | 主字体族 | `Inter Variable` + `Noto Sans SC Variable` | 跨端映射、文档表述 |
| `--ds-font-family-mono` | 等宽族 | 系统 mono 栈 | 代码 / ID / 密钥 |
| `--ds-font-family-button` | 按钮独立字体 | 默认继承 `--ds-font-family-sans` | 借鉴 Clerk `fontFamilyButtons`「按钮字体可独立配置」理念 |
| `--ds-font-size-*` | 字号语义名 | `--text-*` 对应档（如 `--ds-font-size-body` → `var(--text-sm)`） | 组件契约命名，不产生新数值 |
| `--ds-font-line-*` | 行高语义名 | `--ds-line-*` / `--text-*--line-height` | 组件契约命名 |
| `--ds-font-weight-*` | 字重语义名 | `--font-weight-{normal,medium,semibold,bold}` | 组件契约命名 |

约束：别名**只做语义命名与映射，不新建第二套数值 Token**（D6，避免产生无法解释的重复 Token）；别名不替代 `@theme --text-*` 的运行时注册；别名方案**尚未落地代码、尚未验证**，`NOT_VERIFIED`。落地时须补机器可校验的「L1 声明 ↔ L3 消费」映射表（`BASELINE-AUDIT` §11.2 第 3 条）。

---

## 6. 四类字号合法性与边界规则（明确）

| # | 规则 | 可执行判定 | 门禁 |
|---|---|---|---|
| 1 | **H5 输入 ≥16px** | H5 / 移动端表单输入文本至少 16px（iOS Safari 自动缩放防护），普通正文仍 14px；这是唯一合法的字号提升路径，不得借此把整页正文字号抬高 | T16 / `web/AGENTS.md` 响应式条款 |
| 2 | **禁用 `tracking-*`** | 任何 `tracking-wide` / `tracking-tight` / `tracking-[…]` 判违规；仅 `tracking-normal` 放行；字距由字号 Token 自带 | T12 |
| 3 | **`<12 → 12`** | 任何低于 12px 的可见文本一律抬到 12px（`--text-xs`）；布局不够改布局，不许缩字号 | T16 |
| 4 | **`text-base` 的合法用法** | `text-base` 是合法类（`16/24`），语义为「行标题 / 设置字段 / 指标数值 / body-long 原始值」，**不是正文**；禁止拿 `text-base` 当正文，连续阅读走 `text-long`（16/26） | T2 / T16 |

配套禁令：`text-[15px]`、`leading-[26px]`、`style={{ fontSize: 13 }}`、`font-size: 15px` 均违规（T2 / T3 / T4 / T5）；`fontSize` 图表场景须收敛到 `tokens/chart-typography.ts`（T4 ALLOWLIST 收口文件）；`ui/empty.tsx:95` 曾使用不存在的 `text-sm.5` 类，属已知缺陷，禁止复用该写法。

---

## 与其他规范的关系

| 对象 | 关系 |
|---|---|
| `UDS5-S01` 总纲 | **上级规范，一律遵循**；字排基线、D1 决策、版本口径、Adapt 处置、PART 13 不可达结论均继承自总纲（§4.2 / §20 / §25） |
| `UDS5-S02` Foundation | 本文是 S02 §1.4 / §4 / §8.4–8.6 / §9.2–9.4 字排约束的展开；门禁编号以 S02 §10 的 T1–T17 总表为准 |
| `UDS5-S03` Color | 并列下级规范；Link / Button 状态色引用 S03 的语义 Token |
| `UDS5-S05` Spacing | 并列下级规范；`[data-theme-scale]` 不缩放 `--text-*` 的约束在 S05 展开为三档密度 |
| 5.0 后续 `COMPONENT` / `FORM-AND-VALIDATION` / `DATA-DISPLAY` / `ACCESSIBILITY` / `RESPONSIVE` 专题 | 只可细化本文，不得放宽 T1 / T2 / T3 / T4 / T5 / T9 / T12 / T16 |
| `AGENTS.md` / `web/AGENTS.md` | 上位工程约定；遵守「数值以代码为准、规则以规范为准」、组件复用、测试先行、i18n `toIntlLocale()` 与资金 / 认证红线 |
| `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md` | **历史版本**；§1 字排、§1.5 mono 档位、§1.7 H5 输入、§7.2 / §17.7 主题维度独立性仅作追溯，不作现行验收依据 |
| `audit/BASELINE-AUDIT.md` / `audit/CLERK-DESIGN-REFERENCE-ANALYSIS.md` | 本文数值、D1 结论与 Clerk `fontSize 13px` 不采用判定的唯一事实源 |

## 代码实施位置

| 类别 | 真实路径 |
|---|---|
| 字号阶梯唯一来源 | `web/src/design-system/tokens/typography.css`（`@theme` 块 `:68-142`、`simple-large` `:159-196`） |
| 字排语义层 | `web/src/design-system/tokens/semantic.css`（`--ds-text-*` / `--ds-line-*` / `--ds-weight-*`） |
| 消费工具层 | `web/src/design-system/foundations/typography.css` |
| 字排组件 | `web/src/design-system/components/typography/heading.tsx`、`text.tsx`、`index.ts` |
| 原始 / 主题 | `web/src/design-system/tokens/primitives.css`、`web/src/styles/theme.css`、`theme-presets.css` |
| 入口 | `web/src/design-system/tokens/index.css`（6 条 `@import`） |
| 图表字号收口 | `web/src/design-system/tokens/chart-typography.ts` |
| 组件实现 | `web/src/components/ui/button.tsx`、`input.tsx`、`form.tsx`、`field.tsx`、`form-label-tier.tsx`、`input-otp.tsx`、`web/src/components/data-table/` |
| 守卫测试 | `web/src/design-system/__tests__/tokens.test.ts`、`control-typography.test.ts`、`spec-guards.test.ts`、`token-source.test.ts`、`text-color-fallback.test.ts` |
| 门禁 | `web/scripts/check-design-tokens.mjs`、`web/design-tokens.baseline.json` |
| 展示产物 | `docs/design-system/showcase.html`、`showcase.tokens.js` |

## 自动化验证

| 脚本 / 命令（真实存在） | 用途 | CI 状态 |
|---|---|---|
| `web/scripts/check-design-tokens.mjs`（`bun run lint:design:strict`） | T1 / T2 / T3 / T4 / T5 / T9 / T12 / T16 静态门禁 | `ci.yml` `frontend` job 已接入 `:417` |
| `web/scripts/sync-design-showcase.mjs --check`（`bun run design:showcase:check`） | 17 条 Manifest 一致性校验（含字号阶梯） | 已接入 `:411` |
| `web/scripts/generate-design-tokens.mjs --check`（`bun run design:tokens:check`） | DTCG 真源与生成 CSS 同步 | 已接入 `:406` |
| `web/scripts/verify-contrast.mjs`（`bun run verify:contrast`） | 对比度（字排相关色） | 已接入 `:414` |
| `web/src/design-system/__tests__/`（`bunx vitest run src/design-system/__tests__`） | 10 个守卫测试，含 `tokens.test.ts` 兜底值断言 | 随 `bun run test` |
| `bun run typecheck` / `lint` / `test` / `build:check` | 前端基础门禁 | 已接入 |
| `web/scripts/visual-regression.mjs`（`bun run test:visual`） | showcase 双视口像素基线 | 本地专用 |
| `web/e2e/axe/playwright.config.ts` | 无障碍 E2E | **刻意不接 CI** |
| `web/design-tokens.baseline.json` | 基线只减不增（0 条） | `--strict` 使用 |

**本轮未执行上述任何命令**。

## 验证状态

| 项 | 状态 |
|---|---|
| 文档 ID / 版本 / 状态 | `UDS5-S04` / `5.0.0` / `ACTIVE` |
| 本轮实际动作 | 仅撰写规范文本；未修改 `web/src`、`.uap`、CI、`package.json`；未执行 git 操作 |
| 本轮执行的验证命令 | **无** |
| 验证状态 | **`NOT_VERIFIED`** |
| `--ds-font-*` 语义别名 | 规范层设计完成，代码落地与校验 `NOT_VERIFIED` |
| §4.3 的 h1 / h2 差异 | `Adapt` 登记完成，统一与验证 `NOT_VERIFIED` |

**未验证 / 未执行清单**：`lint:design:strict` 全量复跑、17 条 showcase 校验复跑、`tokens.test.ts` 等 10 个守卫测试执行、`--ds-font-*` 别名落地与「L1 声明 ↔ L3 消费」机器可校验映射表、§4.3 h1 `28/36` / h2 `22/30` 与运行时 `30/38` / `24/32` 的统一及回归测试、`simple-large` 放大档视觉复核、H5 输入 ≥16px 在 390×844 视口的实测、焦点环 `2px`（已裁决）在 Link / Form Text 等场景与原生兜底的同步及回归测试验证、`test:visual` / `test:visual:e2e` 双轨视觉回归、`test:axe`、全量构建（`build:check` / `scripts/verify-all.sh`）、`data-theme-font` 字体轴落地（Pending）、65 组件八态逐项证据、Android / iOS / HarmonyOS 平台验收。
