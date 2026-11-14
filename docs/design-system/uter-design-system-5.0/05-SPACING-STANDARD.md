# UTER Design System 5.0 — Spacing 规范

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S05` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01` |
| 生效日期 | `2026-11-14` |
| 适用范围 | 全部间距值、4pt 栅格、Padding / Margin / Gap / Stack / Inline / Section / Form / Table / Page / Responsive Spacing、`[data-theme-scale]` 三档密度、T17 门禁 |
| 验证状态 | `NOT_VERIFIED` |

> **状态声明**：本文定义间距规则与取值，**不声明任何测试已通过、任何组件已 `FULLY_VERIFIED`、任何平台已验收**。本轮未执行验证命令，`验证状态` 为 `NOT_VERIFIED`。事实依据为 `audit/BASELINE-AUDIT.md`、`audit/CLERK-DESIGN-REFERENCE-ANALYSIS.md` 与对 `web/src/design-system/tokens/spacing.css`、`typography.css`、`semantic.css`、`web/scripts/check-design-tokens.mjs` 的只读核实。**下级规范一律遵循 `UDS5-S01` 总纲**。

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

## 1. 4pt 基础单位

| 项 | 规定 |
|---|---|
| 基础单位 | **4pt**（Tailwind CSS 的默认 spacing 单位，1 单位 = 4px） |
| 单一来源 | `web/src/design-system/tokens/spacing.css` 明确「间距阶梯就是 Tailwind 的 4px 单位，因此这里**不再重复声明一套 `--spacing-*`**」 |
| 合法值 | 4 的整数倍：`0 / 4 / 8 / 12 / 16 / 20 / 24 / 28 / 32 / 36 / 40 / 44 / 48 …` px，就近取整档 |
| 非法值 | 任意值 `p-[3px]` / `m-[7px]` / `gap-[2px]` / `gap-[5.25]` 一律违规（T17） |
| 唯一受控例外 | `--ds-chip-height: 1.3125rem`（21px）：内联胶囊高度，由 `text-xs(12/16)` + 上下各 2.5px 光学补正得出，**不是 4pt 栅格整数倍**，属胶囊专用档，禁止并入 `--ds-control-height-*`（表单控件 24/32/44 三档） |
| 禁止 | 不得为「差 1px」新增任意值档；不得靠缩字号解决布局不够（T16 配套） |
| 配套基线 | 1px 边框、焦点环 2px（`ring-2`，已裁决）、正文 14/22、caption 12/18、长文本 16/26、最小 12px、优先表面色差而非重阴影 |

> 21px 例外此前曾在 4 个文件里各写一遍 `h-[calc(--spacing(5.25))]`，改一处即错位；现统一由 `--ds-chip-height` 收口，禁止再散写任意计算值。

---

## 2. T17 门禁（真实规则）

| 项 | 内容 |
|---|---|
| 编号 | **T17**（`web/scripts/check-design-tokens.mjs` 的 `RULES.T17`） |
| 规则原文 | 「任意间距（`p-/m-/gap-[…]`，间距阶梯就是 Tailwind 4px 单位，就近取整档）」 |
| 违规样例 | `p-[3px]`、`m-[7px]`、`gap-[2px]`、`px-[13px]`、`space-x-[5px]`、`h-[calc(--spacing(5.25))]` |
| 合法替代 | `p-1`(4) / `p-2`(8) / `p-3`(12) / `p-4`(16) / `p-6`(24) / `gap-2`(8) / `gap-3`(12) 等整档；或 §3 的 `--ds-*` 语义尺寸 |
| 放行 | 无专门 ALLOWLIST；`ALLOWLIST=[]`，基线只减不增（`web/design-tokens.baseline.json` 当前 0 条） |
| 处置 | `--strict` 非零退出即阻断；不得降级阈值、不得扩 baseline、不得 lint-disable 绕过 |
| 配套 | T10（任意圆角）、T11（未登记动效）、T16（低于最小字号）同属「任意值」类门禁；布局不够改布局，不许缩字号或缩间距到非整档 |

---

## 3. `tokens/spacing.css` 三档密度（真实取值）

文件：`web/src/design-system/tokens/spacing.css`（103 行，45 处定义）。默认值为 `comfortable`；`[data-theme-scale]` 是**既有的无障碍字号档位，被扩展来同时承载密度**，而不是另造 `data-density` 属性去和它打架（`spacing.css:24-27`）。

| Token | 含义 | `sm`（紧凑） | `lg`（默认 comfortable） | `xl`（宽松） |
|---|---|---|---|---|
| `--ds-table-row-padding-y` | 表格行上下内边距 | 8px (`0.5rem`) | 12px (`0.75rem`) | 14px (`0.875rem`) |
| `--ds-table-cell-padding-x` | 表格单元格左右内边距 | 8px | 12px | 14px |
| `--ds-control-height-md` | 表单控件中档高度 | 36px (`2.25rem`) | 40px (`2.5rem`) | 44px (`2.75rem`) |
| `--ds-control-height-sm` | 表单控件小档高度 | 32px (`2rem`) | 36px (`2.25rem`) | 40px (`2.5rem`) |
| `--ds-button-height-md` | 按钮中档高度 | 32px (`2rem`) | 36px (`2.25rem`) | 40px (`2.5rem`) |
| `--ds-button-height-sm` | 按钮小档高度 | 28px (`1.75rem`) | 32px (`2rem`) | 36px (`2.25rem`) |
| `--ds-button-height-lg` | 按钮大档高度 | 36px (`2.25rem`) | 40px (`2.5rem`) | 44px (`2.75rem`) |
| `--ds-nav-height-md` | 侧边栏 / 导航菜单项中档 | 28px (`1.75rem`) | 32px (`2rem`) | 36px (`2.25rem`) |
| `--ds-nav-height-sm` | 导航小档（触控下限） | 24px (`1.5rem`) | 28px (`1.75rem`) | 32px (`2rem`) |
| `--ds-nav-height-lg` | 导航大档 | 40px (`2.5rem`) | 48px (`3rem`) | 52px (`3.25rem`) |
| `--ds-form-field-gap` | 表单字段间距 | 6px (`0.375rem`) | 8px (`0.5rem`) | 10px (`0.625rem`) |
| `--ds-card-padding` | 卡片内边距 | 16px (`1rem`) | 24px (`1.5rem`) | 28px (`1.75rem`) |
| `--ds-page-gutter` | 页面左右留白 | 16px (`1rem`) | 24px (`1.5rem`) | 32px (`2rem`) |
| `--ds-section-gap` | 区块间距 | 16px (`1rem`) | 24px (`1.5rem`) | 32px (`2rem`) |
| `--ds-chip-height` | 内联胶囊高度（不随密度变） | 21px (`1.3125rem`) | 21px | 21px |
| `--ds-content-max` | 标准内容区宽度（不随密度变） | 1280px (`80rem`) | 1280px | 1280px |
| `--ds-content-max-wide` | 宽表模式宽度（不随密度变） | 1800px (`112.5rem`) | 1800px | 1800px |

选择器真实形态：`:root, [data-theme-scale='lg']`（默认）、`[data-theme-scale='sm']`、`[data-theme-scale='xl']`。

### 3.1 三档密度的既有约束（必须保留）

| # | 约束 | 依据 |
|---|---|---|
| 3.1.1 | 密度**只允许改变上表明确列出的尺寸**，不能顺手把正文改小 | `spacing.css:19-23` 注释 |
| 3.1.2 | `[data-theme-scale]` **不缩放 `--text-*`**；字号、行高、字重、字体由 Typography 统一管理（主题维度独立性） | `typography.css:65-66`（§7.2 / §17.7）、`spacing.css` 注释 |
| 3.1.3 | 放大文字走 `simple-large` 预设（`[data-theme-preset='simple-large']`，`typography.css:159-196`），它是同一套阶梯的 ~1.35× 放大档，**不是第二套字号体系**，且声明在 `@theme` 之外 | `typography.css:144-158` |
| 3.1.4 | `theme.css` / `theme-presets.css` 的 `data-theme-preset` / `data-theme-radius` / `data-theme-scale` 是**三维正交**；密度改行高与内边距，宽度是另一个维度 | `BASELINE-AUDIT` §4.1、`spacing.css:59-66` |
| 3.1.5 | 内容区宽度不跟密度档走：标准 1280px（14px 正文单行字数舒适区），宽表 1800px 只给「模型 × 价格 × 供应商」横向比较页 | `spacing.css:59-66` |
| 3.1.6 | 侧边栏 / 导航高度曾写死 `h-8 / h-7 / h-12` 导致密度档对导航完全无效，现由 `--ds-nav-height-*` 分档贯通 | `spacing.css:39-43` |
| 3.1.7 | 密度档不得用于替代响应式断点，也不得用于替代 H5 命中区规则 | 本规范 §5 |

---

## 4. 十类间距规定

| # | 类别 | 规定 | 语义 Token / 落点 | 门禁 |
|---|---|---|---|---|
| 1 | **Padding** | 卡片 / 弹窗 / 容器用 `--ds-card-padding`（16/24/28 按密度）；表格单元格用 `--ds-table-cell-padding-x` + `--ds-table-row-padding-y`；禁止 `p-[3px]` | `tokens/spacing.css` | T17 |
| 2 | **Margin** | 只用 4pt 整档 `m-* / mx-* / my-* / mt-*`；外边距不承载组件内部间距（内部用 padding / gap）；禁止 `m-[7px]` | Tailwind 4px 阶梯 | T17 |
| 3 | **Gap** | 相邻同级元素优先 `gap-*` 整档；表单字段间距用 `--ds-form-field-gap`（6/8/10）；禁止 `gap-[2px]` / `gap-[5.25]` | `tokens/spacing.css` | T17 |
| 4 | **Stack** | 垂直堆叠用 `--ds-section-gap`（16/24/32）分隔区块，字段栈用 `--ds-form-field-gap`；垂直列表行高由控件 / 表格高度档决定，不靠任意 `space-y-[…]` | `tokens/spacing.css` | T17 |
| 5 | **Inline** | 同行并排元素（按钮组、标签、图标 + 文字）用 4pt 整档 gap；内联胶囊高度统一 `--ds-chip-height`（21px）以保证「+N more」/「Collapse」/ 多选值胶囊逐像素对齐 | `tokens/spacing.css:49-57` | T17 |
| 6 | **Section** | 页面内区块间距 `--ds-section-gap`；深色 / 浅色分区靠表面色差与 1px 描边，不靠加大阴影或任意留白 | `tokens/colors.css` | T17 / T6 |
| 7 | **Form** | 字段栈 `--ds-form-field-gap`；控件高度 `--ds-control-height-{sm,md}`；标签与控件、字段级错误就近排布；H5 输入 ≥16px；焦点环单档 `--ds-focus-ring-width: 2px`（已裁决） | `tokens/spacing.css`、`tokens/semantic.css` | T17 / T16 |
| 8 | **Table** | 行列内边距 `--ds-table-row-padding-y` / `--ds-table-cell-padding-x`；密集数据文字用 `--text-dense`(13/20)，但**不得靠缩字号解决列宽**；宽表走 `--ds-content-max-wide`(1800px) | `web/src/components/data-table/` | T17 / T16 |
| 9 | **Page** | 页面留白 `--ds-page-gutter`（16/24/32）；内容区 `--ds-content-max`(1280px) / `--ds-content-max-wide`(1800px)；后台最大宽度 1280px、营销页 1800px 保持不变 | `tokens/spacing.css:59-66` | T17 |
| 10 | **Responsive Spacing** | 移动优先，断点 `sm640 / md768 / lg1024 / xl1280 / 2xl1536`（历史版本 3.0 §16 记录值，5.0 沿用）；H5 命中区最小 24px、推荐 44px；桌面与移动共享同一套间距阶梯与类型阶梯；响应式只改整档组合，不改基础单位 | `web/src/routes/`、`web/src/components/layout/` | T17 |

补充：十类间距统一遵守「组件 → `--ds-*` → 4pt 阶梯」的单向引用；`spacing.css` 中 45 处定义中约含 3 档密度覆盖造成的同文件多次定义，属设计意图而非重复缺陷（`BASELINE-AUDIT` §4.3）。

---

## 5. 响应式与平台边界

| 平台 | 规则 | 状态 |
|---|---|---|
| PC Web | 1440×900 桌面基线；`--ds-content-max` 1280px / 宽表 1800px | `NOT_VERIFIED`（双轨视觉回归未执行） |
| H5 | 390×844 移动基线；断点五档；H5 输入 ≥16px；命中区 24px 最小 / 44px 推荐；`detectPayClient()` UA 判定 | `NOT_VERIFIED` |
| Electron | 复用同一 `web/dist`，不另立间距体系 | `NOT_VERIFIED` |
| Android / iOS / HarmonyOS | **无真实实现**（全仓 `*.kt/*.swift/*.java/*.m/*.mm` = 0），一律 `NOT_VERIFIED`，不得伪造 PASS | `NOT_VERIFIED` |

密度档与响应式的关系：`[data-theme-scale]` 是用户可切换的密度 / 无障碍维度，**不是**断点；断点由媒体查询 / Tailwind `sm:` `md:` `lg:` 等承担。二者不得互相替代。Clerk 官方明确「原生应用使用独立 `ClerkTheme` 主题系统」且未公布断点数值，5.0 不照搬该结论（`CLERK-DESIGN-REFERENCE-ANALYSIS` §2.20）。

---

## 与其他规范的关系

| 对象 | 关系 |
|---|---|
| `UDS5-S01` 总纲 | **上级规范，一律遵循**；4pt 基线、版本口径、D1 / D4 决策、PART 13 不可达结论均继承自总纲 |
| `UDS5-S02` Foundation | 本文是 S02 §8.1 / §8.8 / §9.8 / T17 的展开；门禁编号以 S02 §10 的 T1–T17 总表为准 |
| `UDS5-S03` Color | 并列下级规范；Section 分区的表面色差与 1px 描边引用 S03 语义 Token |
| `UDS5-S04` Typography | 并列下级规范；`[data-theme-scale]` 不缩放 `--text-*`、放大走 `simple-large` 的约束在 S04 §3 / §5.3 定义，本文 §3.1 引用且不得与之冲突 |
| 5.0 后续 `LAYOUT` / `RESPONSIVE` / `COMPONENT` / `DATA-DISPLAY` / `THEME` 专题 | 只可细化本文，不得放宽 T17，不得新增任意间距档，不得另立 `--spacing-*` 第二套阶梯 |
| `AGENTS.md` / `web/AGENTS.md` | 上位工程约定；遵守「数值以代码为准、规则以规范为准」、组件复用、测试先行与资金 / 认证红线 |
| `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md` | **历史版本**；§8 间距、§16 断点、§17.7 主题维度独立性仅作追溯，不作现行验收依据 |
| `audit/BASELINE-AUDIT.md` / `audit/CLERK-DESIGN-REFERENCE-ANALYSIS.md` | 本文数值、断点与平台结论的唯一事实源 |

## 代码实施位置

| 类别 | 真实路径 |
|---|---|
| 间距 / 密度唯一来源 | `web/src/design-system/tokens/spacing.css` |
| 字号阶梯（不随密度缩放） | `web/src/design-system/tokens/typography.css`（`@theme` 块、`simple-large` 预设） |
| 语义尺寸 / 描边 / 焦点环 | `web/src/design-system/tokens/semantic.css` |
| 原始值 / 主题 | `web/src/design-system/tokens/primitives.css`、`web/src/styles/theme.css`、`theme-presets.css` |
| 唯一入口 | `web/src/design-system/tokens/index.css`（6 条 `@import`） |
| 消费工具层 | `web/src/design-system/foundations/{accessibility,decoration,icons,index,motion,typography}.css` |
| 组件实现 | `web/src/components/ui/`、`web/src/components/data-table/`、`web/src/components/layout/` |
| 应用 | `web/src/routes/`、`web/src/features/`、`electron/` |
| 守卫测试 | `web/src/design-system/__tests__/`（11 个守卫测试） |
| 门禁 | `web/scripts/check-design-tokens.mjs`、`web/design-tokens.baseline.json` |
| 视觉基线 | `web/e2e/visual/`、`docs/design-system/showcase.html` |

## 自动化验证

| 脚本 / 命令（真实存在） | 用途 | CI 状态 |
|---|---|---|
| `web/scripts/check-design-tokens.mjs`（`bun run lint:design:strict`） | T17 任意间距门禁（及 T10 / T11 / T16 配套） | `ci.yml` `frontend` job 已接入 `:417` |
| `web/scripts/sync-design-showcase.mjs --check`（`bun run design:showcase:check`） | 17 条 Manifest 一致性校验 | 已接入 `:411` |
| `web/scripts/generate-design-tokens.mjs --check`（`bun run design:tokens:check`） | DTCG 真源与生成 CSS 同步 | 已接入 `:406` |
| `web/scripts/verify-contrast.mjs`（`bun run verify:contrast`） | 对比度 | 已接入 `:414` |
| `web/src/design-system/__tests__/`（`bunx vitest run src/design-system/__tests__`） | 11 个守卫测试 | 随 `bun run test` |
| `web/scripts/visual-regression.mjs`（`bun run test:visual`） | showcase 1440×900 / 390×844 双视口像素基线 | 本地专用 |
| `web/e2e/visual/playwright.config.ts` | 真实路由视觉 E2E（需完整服务栈） | **刻意不接 CI** |
| `bun run typecheck` / `lint` / `test` / `build:check` | 前端基础门禁 | 已接入 |
| `web/design-tokens.baseline.json` | 基线只减不增（0 条） | `--strict` 使用 |

**本轮未执行上述任何命令**。

## 验证状态

| 项 | 状态 |
|---|---|
| 文档 ID / 版本 / 状态 | `UDS5-S05` / `5.0.0` / `ACTIVE` |
| 本轮实际动作 | 仅撰写规范文本；未修改 `web/src`、`.uap`、CI、`package.json`；未执行 git 操作 |
| 本轮执行的验证命令 | **无** |
| 验证状态 | **`NOT_VERIFIED`** |
| 三档密度 `data-theme-scale` | 规范层已记录真实取值；跨档视觉一致性 `NOT_VERIFIED` |

**未验证 / 未执行清单**：`lint:design:strict` 全量复跑（T17 逐文件扫描）、17 条 showcase 校验复跑、11 个守卫测试执行、三档密度在 1440×900 与 390×844 的视觉一致性、`test:visual` / `test:visual:e2e` 双轨视觉回归、`test:axe`、全量构建（`build:check` / `scripts/verify-all.sh`）、`[data-theme-scale]` 不缩放 `--text-*` 的机器可校验断言、`--ds-chip-height` 21px 在 4 处调用点的对齐复核、`theme.css` / `theme-presets.css` 52 个同名变量的合并、73 路由中未覆盖的视觉基线补齐、65 组件八态逐项证据、E24 对比度缺陷修复验证、焦点环 `2px`（已裁决）在 Form 场景与原生兜底的同步及回归测试验证、Android / iOS / HarmonyOS 平台验收。
