# UTER Design System 5.0 — Foundation 规范

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S02` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01` |
| 生效日期 | `2026-11-14` |
| 适用范围 | L1 Foundation / L2 Primitives 的全部设计值、语义 Token、消费工具，以及 L3 组件对设计值的引用方式；覆盖 PC Web / H5 / Electron 三端 |
| 验证状态 | `NOT_VERIFIED` |

> **状态声明**：本文只定义规则与可执行判定，**不声明任何门禁、测试或平台已通过**。本轮未执行任何验证命令，`验证状态` 为 `NOT_VERIFIED`。仓库事实依据为 `audit/BASELINE-AUDIT.md`（`UDS5-AUDIT-01`）、`audit/CLERK-DESIGN-REFERENCE-ANALYSIS.md`（`UDS5-AUDIT-02`）与对已存在文件的只读核实。**下级规范一律遵循 `UDS5-S01` 总纲**。

---

## 0. 门禁编号约定

下文「门禁映射」列的 `T1`–`T17` 均指 `web/scripts/check-design-tokens.mjs` 中 `RULES` 常量定义的真实规则，非自拟编号。规则原文见 §10 总表。`--strict` 为非零退出即阻断的 CI 唯一模式；`web/design-tokens.baseline.json` 基线只减不增（当前 0 条），`ALLOWLIST=[]`。

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

> 与运行时代码的差异登记见 `UDS5-S01` §4.2 与 `UDS5-S03` §2.1，统一前一律 `NOT_VERIFIED`。焦点环口径**已由 team-lead 裁决**：5.0 采用 `2px` / `ring-2`（运行时真值 `tokens/semantic.css:120-123`，与 3.0 §15.1 一致）。作废的是「把 `1px` / `ring-1` 当作**焦点环宽度**」这一过时记忆，`1px` 不再是焦点环可选基线；**装饰性 `ring-1` 描边 1px 与 `1px` 边框均为真实有效值**（不承载焦点语义，3.0 §15.1 分类，07 分册按 1px 登记），须原样保留、不得改成 2px，也不得把「1px」无差别替换。依据 `AGENTS.md`「设计值来自代码」及用户 PART 0 原则 A 未规定焦点环宽度；运行时代码本身已是 `2px`，本轮不改任何代码值。详见 `UDS5-S01` §4.2.1。验证状态 `NOT_VERIFIED`（未执行浏览器级守卫复核）。

---

## 1. 品牌基础

| # | 可执行判定 | 门禁映射 | 真实落点 |
|---|---|---|---|
| 1.1 | Primary Light 必须取 `#5B5EE6`，Hover `#494CC7`，Active `#3F42B0`；Primary Dark `#8B8DF5` / `#A1A3F7` / `#B7B8FA`（5.0 规范基线口径） | T8（裸色值只允许出现在 Token 所有者文件） | `source/brand.tokens.json`、`tokens/generated/brand.css` |
| 1.2 | 业务组件出现 `#hex` / `rgba()` / `rgb()` 即判违规；唯一裸色值所有者为 `tokens/brand-colors.ts` | T8 | `tokens/brand-colors.ts` |
| 1.3 | 品牌字体必须走 `@fontsource-variable/inter` + `@fontsource-variable/noto-sans-sc`，不得虚称引入 Source Han Sans 字体文件 | T1 / T2 / T5（字体变量与字号声明受控） | `web/package.json`、`tokens/typography.css` |
| 1.4 | 正文 `14/22`、caption `12/18`、长文本 `16/26`、最小 `12px`；任何可见文本低于 12px 判违规 | T16 | `tokens/typography.css`、`tokens/semantic.css` |
| 1.5 | 品牌渐变三停靠站深浅同值，禁止 `.dark` 覆盖；消费出口唯一为 `@utility ds-text-gradient-brand` | T8 / T7 | `tokens/colors.css:119-121`、`foundations/` |
| 1.6 | 不得采用 Clerk 紫色、徽标、「Secured by Clerk」文案或任何第三方品牌资产 | 人工审查 + T7 | `audit/CLERK-DESIGN-REFERENCE-ANALYSIS.md` §4 |

> 1.1 的运行时差异已在 `UDS5-S01` §4.2 登记为 `Adapt` / `NOT_VERIFIED`；本轮不改写代码，不得据运行时值反推修改规范基线。

---

## 2. 视觉语言

| # | 可执行判定 | 门禁映射 | 真实落点 |
|---|---|---|---|
| 2.1 | 层级优先由表面色差 + 1px 描边建立；非浮层元素出现 `shadow-sm` / `shadow-[…]` 判违规 | T6（弹窗与浮层除外，`OVERLAY_ALLOWLIST`） | `web/src/styles/theme.css`、`tokens/elevation.css` |
| 2.2 | 不使用 `text-foreground/60` 之类透明度凑文字层级，改用 `text-fg-secondary` / `text-fg-tertiary` 或 `--ds-color-text-secondary` / `--ds-color-text-tertiary` | T13 | `tokens/colors.css:34-49` |
| 2.3 | 不使用 `hover:bg-primary/90` 凑悬停，改用专用 `*-hover` Token | T14 | `tokens/colors.css:97-98`、`--ds-color-action-primary-hover` |
| 2.4 | 不使用 `bg-warning/10` 凑浅底，改用 `*-soft` / `*-subtle` | T15 | `tokens/colors.css:64-71`、`--ds-color-warning-soft` |
| 2.5 | 不使用 `bg-emerald-500` 等调色板直用颜色；`chart-*` 是 `--color-chart-N` 语义 Token，不属 T7 匹配范围 | T7 | `web/scripts/check-design-tokens.mjs` |
| 2.6 | 品牌渐变标题的对比度不足属 B 类验收口径有意例外（E28），只登记例外台账，**不进 `ALLOWLIST`** | `verify-contrast.mjs` 负例拒绝 | `audit/BASELINE-AUDIT.md` §3.1 |

---

## 3. 设计原则

| # | 原则 | 可执行判定 | 门禁映射 |
|---|---|---|---|
| 3.1 | 克制专业 | 单一主操作色主导；大面积表面不得用饱和品牌色铺满 | T7 / T15 |
| 3.2 | 数值单一来源 | `--text-*` 只在 `tokens/typography.css` 声明；其他文件出现即违规 | T1 |
| 3.3 | 不造第二套值 | 禁止新建 `tokens/*.ts` 值 Token（D6）；TS 侧仅保留 `brand-colors.ts` 与 `chart-typography.ts` 两个收口文件 | T4 / T8 |
| 3.4 | 就近取整 | 任意间距 `p-[3px]` / `gap-[2px]` 判违规，就近取 4pt 整档 | T17 |
| 3.5 | 状态显式 | 组件必须齐备 default / hover / focus / pressed / disabled / loading / error / success 八态 | 人工 + `web/e2e/` 回归（未验证） |
| 3.6 | 单向引用 | 组件 → `--ds-*` → `--text-*` / `--primitive-*`，禁止反向或跨层直连 | T1 / T7 / T8 |
| 3.7 | 不绕过门禁 | 不得 lint-disable、不得降阈值、不得扩 baseline、不得删除测试换通过 | `AGENTS.md` §2 |

---

## 4. 设计层级

| 层 | 定义 | 可执行判定 | 门禁映射 |
|---|---|---|---|
| L1 Primitive | 原始值：色值、字号、行高、字重、间距、圆角、动效时长 | 只在 `tokens/primitives.css` / `typography.css` / `spacing.css` / `generated/brand.css` 声明 | T1 / T8 |
| L2 Semantic | `--ds-*` 语义映射 | 组件只引用 `--ds-*`；不得直接引用 `--primitive-*` | T7 / T13–T15 |
| L3 消费 | `foundations/*.css` 的 `@utility` / `@layer` | 该层 0 个 `--name:` 定义（审计时点），不得在此新增值 Token | T1 |
| 规范治理五层 | L1 Foundation → L2 Primitives → L3 Components → L4 Patterns → L5 Templates & Applications | 见 `UDS5-S01` §6；**与运行时 Token 三层是不同维度，禁止混用** | 规范审查 |

层级判定补充：

- `--ds-text-*` / `--ds-line-*` / `--ds-weight-*` / `--ds-color-*` / `--ds-radius-*` / `--ds-stroke-*` 属 L2 Semantic，定义于 `tokens/semantic.css` 与 `tokens/colors.css`。
- 行高统一用 `var(--text-*--line-height, <兜底>)` 引用；兜底值与 `typography.css` 必须一致，由 `web/src/design-system/__tests__/tokens.test.ts` 断言。
- 禁止 `leading-*` 单独覆盖行高（T9），行高由字号 Token 自带。

---

## 5. 视觉一致性

| # | 可执行判定 | 门禁映射 | 真实落点 |
|---|---|---|---|
| 5.1 | 同类控件高度必须一致；内联胶囊高度统一 `--ds-chip-height: 1.3125rem`（21px，非 4pt 整数倍，属专用档，禁止并入控件高度档） | T17 | `tokens/spacing.css:57` |
| 5.2 | 圆角只用受控档 `xs → 4xl`（**8 个命名档**：6/8/10/12/14/16/18/20px）+ Tailwind 内建 `full`，禁止 `rounded-[3px]`；基准 `--radius: 0.625rem`(10px) 见 `web/src/styles/theme.css:274-276`，8 档 `calc(var(--radius)*N)` 见 `:264-271`；「圆角七档」是 3.0 早期只登记到 16px 的历史称谓（`theme.css:258-260` 自述「属文档滞后」），5.0 **不得沿用** | T10 | `tokens/semantic.css:94-110`、`web/src/styles/theme.css:264-276` |
| 5.3 | 动效节奏只用五组登记时长，禁止 `duration-300` / `ease-[cubic-bezier(…)]` | T11 | `foundations/motion.css`（7 个 `ds-motion-*` utility） |
| 5.4 | 字距由字号 Token 自带，禁止 `tracking-*`；仅 `tracking-normal` 放行 | T12 | `tokens/typography.css` |
| 5.5 | 图标描边统一 2px，尺寸固定 16 / 18 / 24 / 32 / 48；颜色跟随父级 `currentColor`，不设 `--ds-icon-color` | 人工审查 | `tokens/semantic.css:126-164` |
| 5.6 | 焦点环全站只有一档（`--ds-focus-ring-width: 2px`，已裁决），原生元素兜底与组件层 `focus-visible:ring-2` 同读该 Token，改值须两处同步 | 人工 + a11y 测试（未验证） | `tokens/semantic.css:117-124` |
| 5.7 | 3 处同名 `EmptyState` 必须统一到 `components/empty-state.tsx`；禁止新增同名实现 | 人工审查 | `web/src/components/` |

> **已裁决（`UDS5-S01` §4.2.1）**：5.0 焦点环采用 `2px` / `ring-2`，即 `semantic.css:120-123` 的运行时真值（与 3.0 §15.1 恒 `2px` / `ring-2` 一致）；运行时代码本身已是 `2px`，本轮不改任何代码值。作废的是「把 `1px` / `ring-1` 当作**焦点环宽度**」这一过时记忆（用户 PART 0 原则 A 只规定边框 1px，未规定焦点环宽度），`1px` 不再是焦点环可选基线；**装饰性 `ring-1` 描边 1px 与 `1px` 边框均为真实有效值**（不承载焦点语义，3.0 §15.1 分类，07 分册按 1px 登记），须原样保留、不得改成 2px，也不得把「1px」无差别替换。依据 `AGENTS.md`「设计值来自代码」。验证状态 `NOT_VERIFIED`（未执行浏览器级守卫复核）。

---

## 6. 组件基础规则

| # | 可执行判定 | 门禁映射 |
|---|---|---|
| 6.1 | 新增 / 修改 UI 前先检索 `web/src/components/` 与相关 `web/src/features/`，记录候选路径与能力缺口 | 人工审查 |
| 6.2 | 已有基础组件覆盖的按钮 / 输入 / 选择器 / 弹层必须使用项目组件，不得手写同等控件 | 人工审查 |
| 6.3 | 组件内不得出现 `text-[15px]`、`leading-[26px]`、`style={{ fontSize: 13 }}`、`font-size: 15px` | T2 / T3 / T4 / T5 |
| 6.4 | 组件内不得出现任意圆角、任意动效、任意间距 | T10 / T11 / T17 |
| 6.5 | 变体用 `cva()` 定义（如 `ui/button.tsx` 的 6 variant × 9 size + `loading`）；扩展只走 variant / slot / composition | 人工审查 |
| 6.6 | 禁止 `appearance` 式全局覆写（会绕过 T1–T17 门禁）；禁止依赖组件内部类 | 人工审查 |
| 6.7 | 组件必须实现 `aria-expanded` / `aria-selected` / `aria-disabled` / `aria-invalid` 与视觉状态一致 | `web/e2e/axe/`（未验证） |
| 6.8 | 表格排序 / 筛选 / 分页等模式只用 `components/data-table/`（24 条公开导出），不得在 feature 内重拼 | 人工审查 |

---

## 7. 平台一致性

| 平台 | 可执行判定 | 门禁映射 | 状态 |
|---|---|---|---|
| PC Web | 共享同一套 Token 与类型阶梯；1280px 标准内容区 / 1800px 宽表模式 | T1–T17 全量 | `NOT_VERIFIED` |
| H5 | 同一套代码的响应式分支；断点 `sm640/md768/lg1024/xl1280/2xl1536`；桌面与移动共享一套类型阶梯 | T16 / T17 | `NOT_VERIFIED` |
| H5 输入 | 表单输入文本 ≥16px（iOS Safari 自动缩放防护），普通正文仍 14px；命中区最小 24px、推荐 44px | T16 | `NOT_VERIFIED` |
| Electron | 复用同一 `web/dist`，不得另立 Token 体系 | T1 | `NOT_VERIFIED` |
| Android / iOS / HarmonyOS | 无真实实现（全仓 `*.kt/*.swift/*.java/*.m/*.mm` = 0），一律 `NOT_VERIFIED`，不得伪造 PASS | 无 | `NOT_VERIFIED` |
| i18n | 7 份 locale；`zhCN`/`zhTW` 进入 `Intl.*` 前须 `toIntlLocale()` 转换 | `check-i18n-keys.mjs` / `lint` 规则 | `NOT_VERIFIED` |

---

## 8. 设计约束

| # | 约束 | 可执行判定 | 门禁映射 |
|---|---|---|---|
| 8.1 | 4pt 间距基础单位 | 任意值判违规，就近取整档 | T17 |
| 8.2 | 1px 边框 | `--ds-stroke-width: 1px`；不得用更粗描边表达强调 | 人工审查 |
| 8.3 | 焦点环 `2px` / `ring-2`（已裁决） | 全站单档 `--ds-focus-ring-width`；装饰性 `ring-1` 描边 1px 与 `1px` 边框原样保留（不承载焦点语义，07 分册按 1px 登记），不得改成 2px、不得无差别替换「1px」；依据见 `UDS5-S01` §4.2.1 | 人工 + 浏览器级守卫复核（未执行） |
| 8.4 | 最小字号 12px | `text-[11px]` / `font-size: 10px` 判违规；布局不够改布局，不许缩字号 | T16 |
| 8.5 | 行高由字号 Token 决定 | 禁止 `leading-*` 覆盖 | T9 |
| 8.6 | 字距不单独设置 | 禁止 `tracking-*` | T12 |
| 8.7 | 非浮层不投影 | 禁止 `shadow-…`（浮层除外） | T6 |
| 8.8 | 圆角 / 动效受控 | 禁止 `rounded-[…]` / `duration-N` / 自定义 `ease-*` | T10 / T11 |
| 8.9 | 颜色只用语义 Token | 禁止裸色值、调色板直用、透明度凑层级 / 悬停 / 浅底 | T7 / T8 / T13 / T14 / T15 |
| 8.10 | 业务红线 | 支付 / 充值 / 退款 / 余额 / 订单 / 认证 / 授权 / 数据库契约零改动 | `AGENTS.md` §4 / §5 |

---

## 9. Token 使用约束

| # | 规则 | 门禁映射 | 真实落点 |
|---|---|---|---|
| 9.1 | 引用方向恒为单向：组件 → `--ds-*` → `--text-*` / `--primitive-*` | T1 / T7 / T8 | `tokens/semantic.css:19-33` |
| 9.2 | `@theme --text-*` 是 Tailwind v4.3.3 自定义字号注册机制，**禁止删除或禁用**（D1 / Adapt） | T1 | `tokens/typography.css` |
| 9.3 | `--text-*` 只能出现在唯一来源文件；写在 `:root` 会导致工具类静默回退 | T1 | `tokens/typography.css:58-63` |
| 9.4 | 5.0 在规范层另立 `--ds-font-*` 语义别名，不新建第二套数值 Token | 规范审查（别名未落地） | `UDS5-S04` |
| 9.5 | 新增颜色合法路径：① `theme.css` 定义原值 → ② `colors.css` 映射 `--ds-color-*` → ③ 5.0 规范登记用途 | T8 | `tokens/colors.css:25-29` |
| 9.6 | `tokens/index.css` 是唯一入口，6 条 `@import` 顺序不可重排 | 规范审查 | `tokens/index.css` |
| 9.7 | `generated/brand.css` 为 GENERATED FILE — DO NOT EDIT，改值须改 `source/brand.tokens.json` 再生成 | `design:tokens:check` | `tokens/generated/brand.css:21-27` |
| 9.8 | 密度 `[data-theme-scale]` 只改 `--ds-*` 控件尺寸与间距，**不缩放 `--text-*`** | 规范审查 | `tokens/spacing.css:19-27`、`typography.css:65-66` |
| 9.9 | 零静态引用变量是候选清理上限而非死代码；删除前逐项验证构建产物 | 规范审查 | `audit/BASELINE-AUDIT.md` §4.3 |
| 9.10 | 3 个纯别名 `--ds-color-text-primary` / `--ds-color-text-secondary` / `--ds-color-success-soft` 在生产构建压缩后消失，靠 `var(--x, fallback)` 兜底缓解，须定位压缩器根因，不得永久保留双轨 | 规范审查 | `audit/BASELINE-AUDIT.md` §3.1 |

---

## 10. T1–T17 门禁总表（真实规则原文）

| 编号 | 规则（`check-design-tokens.mjs` 的 `RULES`） | 违规样例 |
|---|---|---|
| T1 | 字号阶梯重复声明（`--text-*` 只能出现在唯一来源） | 在 `theme-presets.css` 里再声明 `--text-sm` |
| T2 | 任意字号工具类（`text-[…px]`） | `text-[15px]` |
| T3 | 任意行高工具类（`leading-[…px]`） | `leading-[26px]` |
| T4 | 内联字号数值（`fontSize: N`） | `style={{ fontSize: 13 }}` |
| T5 | CSS 硬编码字号（`font-size: Npx`） | `font-size: 15px` |
| T6 | 非浮层投影（`shadow-…`，弹窗与浮层除外） | `shadow-sm` / `shadow-[…]` |
| T7 | 调色板直用颜色（未走语义 Token） | `bg-emerald-500` |
| T8 | 裸色值（`#hex` / `rgba()`，未走 Token） | `'#6366f1'` / `rgba(15,23,42,…)` |
| T9 | 行高覆盖（`leading-…`，行高应由字号 Token 决定） | `leading-tight` |
| T10 | 任意圆角（`rounded-[…]`，受控档 `xs→4xl + full`） | `rounded-[3px]` |
| T11 | 未登记动效节奏（`duration-N` / `ease-[cubic-bezier(…)]`，五组时长） | `duration-300` |
| T12 | 字距类（`tracking-*`，统一移除，`tracking-normal` 放行） | `tracking-wide` |
| T13 | 透明度冒充文字层级（改用 `text-fg-secondary` / `text-fg-tertiary`） | `text-foreground/60` |
| T14 | 透明度凑悬停（改用 `*-hover` Token） | `hover:bg-primary/90` |
| T15 | 透明度凑浅底（`*-soft` / `*-subtle`） | `bg-warning/10` |
| T16 | 低于最小字号（全站可见文本下限 12px） | `text-[11px]` / `font-size: 10px` |
| T17 | 任意间距（间距阶梯就是 Tailwind 4px 单位，就近取整档） | `p-[3px]` / `gap-[2px]` |

约束补充（脚本内已存在的真实机制）：`T8` 对 `tokens/brand-colors.ts` 等 `RAW_COLOR_OWNERS` 放行，且跳过 `*.test.ts(x)` 断言夹具；`T6` 对 `OVERLAY_ALLOWLIST` 浮层放行；`T4` 对图表 `fontSize` 走 ALLOWLIST 的收口文件 `tokens/chart-typography.ts`；`T15` 只管 ≤20% 浅底，`/70`、`/90` 属有意的半透明实心填充。

---

## 与其他规范的关系

| 对象 | 关系 |
|---|---|
| `UDS5-S01` 总纲 | **上级规范，一律遵循**；本文只细化 L1/L2 的可执行判定与门禁映射，不放宽任何条款 |
| `UDS5-S03` Color | 本文 §2 / §8.9 / §9.5 的颜色约束在 S03 展开为 17 类语义 Token |
| `UDS5-S04` Typography | 本文 §1.4 / §4 / §8.4–8.6 / §9.2–9.4 的字排约束在 S04 展开为 18 档阶梯与 D1 决策 |
| `UDS5-S05` Spacing | 本文 §8.1 / §8.8 / §9.8 / T17 在 S05 展开为 4pt 体系与三档密度 |
| 5.0 后续专题规范（Elevation / Theme / A11y / Responsive / Component / API 等） | 只可细化本文，不得另立版本口径或放宽门禁 |
| `AGENTS.md` / `web/AGENTS.md` | 上位工程约定；本文遵守其组件复用、测试先行、验证证据、资金与认证红线 |
| `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md` | **历史版本**，仅作 T1–T17 规则来源的追溯，不作现行约束或验收依据 |
| `audit/BASELINE-AUDIT.md` / `audit/CLERK-DESIGN-REFERENCE-ANALYSIS.md` | 本文数值与冲突结论的唯一事实源 |

## 代码实施位置

| 类别 | 真实路径 |
|---|---|
| Token 定义 | `web/src/design-system/tokens/{primitives,typography,spacing,semantic,colors,elevation,index}.css` |
| DTCG 真源与生成物 | `web/src/design-system/source/brand.tokens.json`、`brand.tokens.schema.json`、`web/src/design-system/tokens/generated/brand.css` |
| 收口文件 | `web/src/design-system/tokens/brand-colors.ts`、`chart-typography.ts` |
| 消费工具层 | `web/src/design-system/foundations/{accessibility,decoration,icons,index,motion,typography}.css` |
| 主题运行时 | `web/src/styles/{theme,theme-presets,index}.css` |
| 组件实现根 | `web/src/components/ui/`、`web/src/design-system/components/typography/` |
| 守卫测试 | `web/src/design-system/__tests__/`（`tokens.test.ts`、`semantic-colors.test.ts`、`accessibility.test.ts`、`status-badge-contrast.test.ts`、`control-typography.test.ts`、`elevation-motion.test.ts`、`spec-guards.test.ts`、`token-source.test.ts`、`text-color-fallback.test.ts`、`sidebar-active-guard.test.ts`） |
| 门禁脚本 | `web/scripts/check-design-tokens.mjs`、`web/design-tokens.baseline.json` |
| 视觉标本 | `docs/design-system/showcase.html`、`showcase.tokens.js` |

## 自动化验证

| 脚本 / 命令（真实存在） | 用途 | CI 状态 |
|---|---|---|
| `web/scripts/check-design-tokens.mjs`（`bun run lint:design:strict`） | T1–T17 全量静态门禁 | `ci.yml` `frontend` job 已接入 `:417` |
| `web/scripts/generate-design-tokens.mjs --check`（`bun run design:tokens:check`） | DTCG 真源与生成 CSS 同步 | 已接入 `:406` |
| `web/scripts/sync-design-showcase.mjs --check`（`bun run design:showcase:check`） | 17 条 Manifest 一致性校验 | 已接入 `:411` |
| `web/scripts/verify-contrast.mjs`（`bun run verify:contrast`） | 对比度与 E28 渐变锚定 | 已接入 `:414` |
| `web/scripts/check-component-registry.mjs`（`bun run components:registry:check`） | 组件注册双向一致性 | 已接入 `:427` |
| `web/scripts/visual-regression.mjs`（`bun run test:visual`） | showcase 像素基线 | 本地专用 |
| `bun run typecheck` / `lint` / `test` / `copyright:check` / `build:check` | 前端基础门禁 | 已接入 |
| `web/src/design-system/__tests__/`（Vitest） | 10 个设计系统守卫测试 | 随 `bun run test` |
| `web/e2e/axe/playwright.config.ts` | 无障碍 E2E | **刻意不接 CI**，仅开发机手动 |
| `.github/workflows/ci.yml`、`release-gate.yml` | CI 编排 | — |

**本轮未执行上述任何命令**。

## 验证状态

| 项 | 状态 |
|---|---|
| 文档 ID / 版本 / 状态 | `UDS5-S02` / `5.0.0` / `ACTIVE` |
| 本轮实际动作 | 仅撰写规范文本；未修改 `web/src`、`.uap`、CI、`package.json`；未执行 git 操作 |
| 本轮执行的验证命令 | **无** |
| 验证状态 | **`NOT_VERIFIED`** |
| 下级规范遵循关系 | 一律遵循 `UDS5-S01`，已声明 |

**未验证 / 未执行清单**：`lint:design:strict` 全量扫描复跑、`design:tokens:check`、`design:showcase:check` 的 17 条校验复跑、`verify:contrast`、`components:registry:strict`、10 个守卫测试执行、全量构建（`build:check` / `scripts/verify-all.sh`）、`test:visual` 与 `test:visual:e2e` 双轨视觉回归、`test:axe`、Android / iOS / HarmonyOS 平台验收、65 组件逐项证据补齐、E24 两处对比度缺陷修复验证、焦点环 `2px` 在组件层与原生兜底的同步及回归测试验证（口径已裁决、实现未验证）、`UDS5-S01` §4.2 差异登记的统一、`--ds-font-*` 语义别名落地验证、3 处同名 `EmptyState` 合并验证、3 个纯别名压缩消失问题的根因定位。
