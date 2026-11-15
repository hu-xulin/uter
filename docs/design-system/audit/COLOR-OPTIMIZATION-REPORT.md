# UDS 7.0 颜色优化报告（COLOR-OPTIMIZATION-REPORT）

- 生成日期：2026-11-15
- 依据：《UTER DESIGN SYSTEM 7.0 全面审计整改与视觉体系升级执行规范》§4（颜色体系）/ §5（代码高亮）/ §6（渐变文字）；`audit/COLOR-AUDIT-REPORT.md` 的品牌裁决（全部 KEEP，任何调整须走本报告六项变更记录）
- 机器可读证据：`audit/contrast-validation.json`、`audit/gradient-validation.json`、`audit/accessibility-validation.json`、`audit/syntax-validation.json`、`audit/token-validation.json`、`TOKEN-MANIFEST.json`
- 门禁证据：`registry/check-uds7-remediation.mjs`（C-R06…C-R14）、`GATE-EVIDENCE.json`（G07/G08/G13/G19）

## 1. 结论摘要

1. 品牌基线六值（Light `#5B5EE6 / #494CC7 / #3F42B0`；Dark `#8B8DF5 / #A1A3F7 / #B7B8FA`）**全部 KEEP**：基线值本身零调整；整改只把「运行时实际值」与「3.0 规范声明」对齐到该基线（见 R1）。
2. 六项变更记录 R1–R6 覆盖本轮全部颜色改动：品牌基线对齐与文档同步、图表色板 v5、渐变停靠站、代码高亮体系（syntax 20 + chrome 24）、终端独立色板、状态色变体族。
3. 对比度结论（WCAG 2.2 AA，正文阈值 4.5:1）：文本 8 Token × 2 主题全过（Light 最低 4.79、Dark 最低 6.92）；syntax 20 × 2 全过（Light 最低 4.55、Dark 最低 5.07）；品牌实心白字最低 5.01；代码 gutter/foreground 全过。渐变 1001 采样 × 7 背景 × 2 主题全过（Light 最差 5.99、Dark 最差 8.37）。
4. 图表 12 系列以 ΔE00（CVD 模拟）为度量：正常视觉 Light 最小 13.14 / Dark 15.09；三类色觉模拟下最小 10.50 / 10.51，均 ≥ 阈值 10。
5. 遗留事项（不伪造 PASS）：G19 四个暗色真实页面场景相对冻结基线漂移，根因为 R1 的品牌对齐，**重新冻结基线待用户明确授权**；chart-1..12 尚无业务消费者（Phase 9 迁移项）。

## 2. 品牌基线逐色裁决表（§4.2）

「原始值」= 整改前运行时 `generated/brand.css` 实际值；「是否生效」分审计时点（Phase 1）与当前；「是否调整」指**基线值**是否被改动（六值皆否），运行时对齐动作单独登记于 R1。

| Token | §4.2 基线 | 整改前运行时值 | 审计时生效 | 当前生效 | 基线是否调整 | 对比度（前景文字） | 组件影响 |
|---|---|---|---|---|---|---|---|
| Light primary | `#5B5EE6` | `#5B5EE6` | 是 | 是 | 否 KEEP | 白字 5.01:1 | 主按钮、品牌链接、首屏光晕 |
| Light hover | `#494CC7` | `#4F52D1` | 否（仅 7.0 runtime） | 是 | 否 KEEP | 白字 6.68:1 | 按钮/链接 hover |
| Light active | `#3F42B0` | `#4A4DC5` | 否（仅 7.0 runtime） | 是 | 否 KEEP | 白字 8.02:1 | 按钮/链接 active |
| Dark primary | `#8B8DF5` | `#A1A3F7` | 否（仅注释/测试） | 是 | 否 KEEP | 深字 `#020617` 6.94:1 | 暗色主色强调、按钮、光晕 |
| Dark hover | `#A1A3F7` | `#B1B3FF` | 是（误占 primary 槽） | 是（归位 hover） | 否 KEEP | 深字 8.74:1 | 暗色 hover |
| Dark active | `#B7B8FA` | `#9294F7` | 否（仅 7.0 themes） | 是 | 否 KEEP | 深字 10.81:1 | 暗色 active |

实心按钮架构：`brand-solid` 在两主题均使用 Light 三值 + 白字（5.01 / 6.68 / 8.02:1），暗色 primary 三值只承担「深字浅底」强调场景，避免暗色浅紫底配白字的不达标组合（`contrast-validation.json::brandSolid`，8 行全 PASS）。

## 3. 六项变更记录

### R1 品牌基线 KEEP + 运行时/文档对齐（无基线色值改动）

- 背景：Phase 1 审计发现运行时与文档声明均偏离任务 §4.2 基线（见 §2 表）。
- 动作：`source/brand.tokens.json` → `generate-design-tokens.mjs` → `generated/brand.css` 全链路对齐基线；3.0 规范品牌表与 §28 manifest 的 5 个滞后声明同步为基线值（`UTER-DESIGN-SYSTEM-3.0.md:566-580,3842,3847`），并重生成 `showcase.tokens.js` 快照。
- 是否生效：是（C-R06 直接值比对 PASS；G07 同步校验 17 PASS / 0 FAIL）。
- 对比度：见 §2 表，全部 ≥ 4.5:1。
- 组件影响：暗色主按钮/链接/首屏光晕色相由 `#A1A3F7` 系变为 `#8B8DF5` 系 —— 这是 G19 四个暗色场景漂移的唯一根因（冻结基线早于本次对齐）。**基线重冻结需用户授权**（`freeze-baseline.mjs --force`），未授权前 G19 保持 FAIL 并登记为阻塞项。
- 证据：C-R06、G07、`git diff brand.css`（仅 5 槽对齐基线）、`audit/visual-baseline-check.json`。

### R2 图表色板 v5（12 系列重建）

- 原始值：v4 色板在色觉模拟下系列间 ΔE00 不足（相邻系列混淆）。
- 是否调整：是，12 系列 Light/Dark 全量重建（值见 §4.3）。
- 度量：ΔE00（非对比度——图表系列区分度用色距度量），66 对组合 × 2 主题 × 4 视觉条件。正常：Light 13.14 / Dark 15.09；protanopia：10.54 / 10.53；deuteranopia：10.51 / 10.51；tritanopia：10.50 / 10.51；阈值 10，全过。
- 非颜色通道：4 线型 + 6 点标记 + 图例强制 + >6 系列直接标注（`accessibility-validation.json::wcagCoverage.chartSeries`）。
- 组件影响：Showcase 图表区 12 系列真实渲染；**业务图表仍走 3.0 `--chart-1..6`，7.0 chart Token 尚无业务消费者**（`token-validation.json::chartConsumerStatus`），迁移登记于 Phase 9 / COMPAT-MAP B4。
- 证据：C-R08（product 色不引用/不撞 chart）、`accessibility-validation.json`、G13。

### R3 渐变文字停靠站重建（受控出口唯一）

- 原始值：旧调色板类名渐变（`from-blue-400 via-violet-400 to-purple-500`），Light 最差 2.27:1、Dark 最差 3.92:1，均 FAIL。
- 是否调整：是。Light `#1D4ED8 → #6D28D9 → #7E22CE`；Dark `#93C5FD → #C4B5FD → #D8B4FE`（0/50/100%）。
- 是否生效：是。唯一出口 `typography.css:225 @utility ds-text-gradient-brand`（`90deg in srgb`）+ `:241 .dark` 覆写；消费者仅 `hero.tsx:157`、`cta.tsx:58`；shimmer 收敛为第二受控出口 `ds-text-shimmer`（`typography.css:256`）。
- 对比度：1001 采样 × 7 背景 × 2 主题全过；Light 最差 5.99:1（0% 处 hero-glow）、Dark 最差 8.37:1（45.4% 处 raised）。
- 浏览器像素：Playwright 实测 491×113 = 55483 像素、246/215 种颜色，computed gradient 与引擎同源（`gradient-validation.json::pixelValidation`）。
- 组件影响：仅首屏主标题渐变行与 CTA 副标题；正文/表格/表单/余额/订单/支付/API Key/代码/错误信息禁用渐变（§6.5，C11/T 门禁拦截）。
- 证据：`GRADIENT-VERIFICATION-REPORT.md`、C-R09/C11、G17 像素断言、G19 gradient-hero 两场景字节级 PASS。

### R4 代码高亮体系（syntax 20 Token WCAG 微调 + chrome 24 Token 新建）

- syntax：以 VS Code Light+/Dark+ 官方值为原始值，20 Token × 2 主题落位；其中 4 个 Light 值微调（`number`/`inserted` `#098658→#098255`、`type`/`builtin` `#267F99→#257B94`，各 3 个明度步，4.32→4.55 / 4.31→4.55），其余 36 槽零调整；Dark 20 槽零调整。调整后 Light 最低 4.55、Dark 最低 5.07，全过。
- chrome：新建 24 个 `--ds-color-code-*` Token（编辑器/代码块/工具栏三背景分离，§5.4）；diff 行 gutter 文字改用 `code-foreground` 保证对比度（added：Light 16.26 / Dark 7.88；removed：Light 14.61 / Dark 13.10）；折叠标记为装饰性 `aria-hidden`。
- 是否生效：是。产品 CodeMirror 经 `syntax-adapter` 消费 20 syntax Token（23 项测试）；chrome 24 Token 在 Showcase Light/Dark 双面板以 `var()` 真实消费（`scopedCodeVars`）。
- 组件影响：代码块、编辑器、终端之外的代码 chrome 全场景；产品暂无 diff 界面，`diff-added/removed` 登记为预留 Token（诚实标注，不伪造消费者）。
- 证据：`syntax-validation.json`（20 行 adjusted 明细）、`VSCODE-COLOR-MAPPING.md`、C-R10/C-S03、G13 axe 0 violations。

### R5 终端独立色板（ANSI 16 + 背景/前景）

- 原始值：终端曾复用 syntax/正文色，暗色下 ANSI 亮色与背景对比不足且与代码高亮语义串色。
- 是否调整：是。35 个 `--ds-color-terminal-*` Token 独立成族（ANSI 16 × 2 主题 + background/foreground 等），与 syntax、code chrome 三族背景互不相同。
- 是否生效：是。bridge 注入 16 个 ANSI 变量浏览器实测可读（C-R02/C-R10）；Showcase 终端 Light/Dark 双面板各 1 个（C-S03）。
- 对比度：终端前景/背景组合经 contrast-engine 校验（`contrast-validation.json`），G13 axe 全过。
- 组件影响：终端面板与 ANSI 渲染；不影响编辑器/代码块（三族隔离）。
- 证据：C-R10、C-S03、G13、`audit/visual-regression.json::terminalBridgeLive`。

### R6 状态色变体族（4 状态 × 8 变体）

- 原始值：状态色仅有单值 success/warning/danger/info，软底/边框/深字/交互态缺失，组件各自硬编码派生色。
- 是否调整：是。每状态补齐 solid/soft/border/on/hover/active/subtle 变体（36 个状态族 Token），Light/Dark 双主题齐全。
- 对比度：「on 文字 × soft 底」「状态色 × 表面」组合逐组校验 ≥ 4.5:1（C-R12）。
- 组件影响：Badge、Alert、Toast、表单校验、订单/支付状态标签统一消费变体族，禁止再硬编码派生色。
- 证据：C-R12、`contrast-validation.json`、G02/T 门禁、G13。

## 4. 逐色明细表

### 4.1 渐变停靠站（6 Token）

| Token | 旧值（legacy） | 新值 | 最差对比度 | 组件影响 |
|---|---|---|---|---|
| gradient-light-from | `#60A5FA` | `#1D4ED8` | 5.99:1 @0% hero-glow | 首屏渐变行起点 |
| gradient-light-via | `#A78BFA` | `#6D28D9` | 见 1001 采样全过 | 渐变行中段 |
| gradient-light-to | `#A855F7` | `#7E22CE` | 见 1001 采样全过 | 渐变行终点 |
| gradient-dark-from | 旧暗色共用值 | `#93C5FD` | 8.37:1 @45.4% raised（全渐变最差） | 暗色渐变行起点 |
| gradient-dark-via | 旧暗色共用值 | `#C4B5FD` | 同上 | 暗色渐变行中段 |
| gradient-dark-to | `#A855F7`（legacy 最差 3.92:1） | `#D8B4FE` | 同上 | 暗色渐变行终点 |

### 4.2 syntax 微调（4 Token，其余 16 Token × 2 主题零调整）

| Token | 原始值（VS Code Light+） | 调整后 | 步数 | 对比度 before→after | 组件影响 |
|---|---|---|---|---|---|
| syntax-number | `#098658` | `#098255` | 3 | 4.32→4.55 | 数字字面量 |
| syntax-type | `#267F99` | `#257B94` | 3 | 4.31→4.55 | 类型标识 |
| syntax-builtin | `#267F99` | `#257B94` | 3 | 4.31→4.55 | 内建标识 |
| syntax-inserted | `#098658` | `#098255` | 3 | 4.32→4.55 | diff 插入行语法色 |

### 4.3 图表 v5（12 系列，度量 ΔE00 见 R2）

| # | Light | Dark | # | Light | Dark |
|---|---|---|---|---|---|
| 1 | `#0088FF` | `#11A0FF` | 7 | `#E94BAF` | `#E36CC0` |
| 2 | `#7F13F8` | `#7965E6` | 8 | `#0E21C1` | `#04F0E4` |
| 3 | `#009F80` | `#00A37B` | 9 | `#A88900` | `#FFF596` |
| 4 | `#EA315B` | `#FF4178` | 10 | `#AE005D` | `#BF8800` |
| 5 | `#29844A` | `#32D15C` | 11 | `#72007A` | `#98F600` |
| 6 | `#9D6013` | `#CD3503` | 12 | `#9D0000` | `#AFD49F` |

## 5. 验证过但未调整的颜色

- 文本 8 Token × 2 主题：零调整，Light 最低 4.79:1、Dark 最低 6.92:1（`contrast-validation.json::text`，16 行全 PASS）。
- code gutter / foreground × 2 主题：零调整（Light 5.39 / 16.77；Dark 见 `contrast-validation.json::code`）。
- syntax 其余 36 槽、品牌六值基线：零调整（R1/R4）。

## 6. 门禁与证据索引

| 门禁/探针 | 内容 | 最近结果 |
|---|---|---|
| C-R06 | brand.css 六值 = §4.2 基线（直接值比对） | PASS |
| C-R07 | 文本四档互异且 ≥4.5:1 | PASS |
| C-R08 | product 色不引用/不撞 chart | PASS |
| C-R10 / C-S03 | 终端独立 + ANSI16 + 双面板各 1 | PASS |
| C-R12 | 状态色 ≥6 变体/状态 + 组合对比度 | PASS |
| C-R14 | L1 原语隔离（业务组件 0 直引） | PASS |
| G07 | 3.0 规范 ↔ 代码 ↔ 快照同步 | 17 PASS / 0 FAIL（文档同步后） |
| G08 | 现行对比度门禁 | EXIT 0 |
| G13 | axe-core + 真实 Tab | EXIT 0，0 violations |
| G19 | 冻结基线比对 | 11 PASS / 4 FAIL（暗色真实页面，待重冻结授权） |

## 7. 诚实限制与待办

1. **G19 重冻结待授权**：4 个暗色场景漂移（90.47% / 91.08% / 95.16% / 92.22%）完全由 R1 品牌对齐解释（Light 场景因 primary 未变仅动态内容差 ≤1.44%）。未获用户授权前不执行 `freeze-baseline.mjs --force`，G19 保持 FAIL。
2. chart-1..12 无业务消费者：Showcase 真实渲染已验证，业务迁移属 Phase 9（COMPAT-MAP B4），当前不声称业务生效。
3. CVD 数据为模拟测量（protanopia/deuteranopia/tritanopia 矩阵），非真实色觉用户测试；像素验证仅 Chromium（跨浏览器降级走 `@supports not` 视觉等价块，NOT_EXECUTED）。
4. 本报告所有对比度/ΔE00 数值均出自上述机器可读证据文件或本次以 `contrast-engine.mjs` 复算（暗色品牌前景 6.94/8.74/10.81、diff gutter 16.26/7.88/14.61/13.10），无手填估值。