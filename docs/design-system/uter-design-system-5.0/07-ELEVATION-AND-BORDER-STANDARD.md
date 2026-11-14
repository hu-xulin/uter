# 07 · 高度与描边规范（Elevation & Border Standard）

> UTER Design System 5.0 · 分册 S07。本规范定义「层级靠什么建立、边框用什么、投影何时允许、浮层怎么叠」。**核心口径不变：优先表面色差与 1px 边框，不滥用阴影**；投影只在元素确实离开文档流时出现。**5.0 为当前唯一正式体系，3.0 保留为历史**，本文引用 3.0 §8 仅用于溯源。除标明已核实的真源代码位置外，未宣称任何测试通过或平台验收。

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S07` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01`（UTER Design System 5.0 总纲） |
| 生效日期 | `2026-11-14` |
| 适用范围 | `web/` 全部组件与浮层、design-system tokens、`showcase.html` 第 14 区（Shadow）；Light / Dark 双主题一致适用 |
| 验证状态 | `NOT_VERIFIED` |

---

## 1. 总则：层级的第一原则

| 编号 | 原则 | 说明 |
|---|---|---|
| E-1 | 表面优先 | 层级首先靠**表面色差**（background / surface）与 **1px 边框**表达，阴影是最后手段。 |
| E-2 | 离开文档流才投影 | 判据是「这块面还有没有一个自己的平面位置」：`popover / overlay / raised / marketing` 才是离开文档流的浮起面。 |
| E-3 | 不滥用阴影 | 表格、侧边栏、页面容器、按钮、徽标一律不加阴影；Card 常态不投影。 |
| E-4 | 封闭集合 | 投影只能是 §3 登记的 6 个 `--ds-*` 档，任意 `shadow-*` 由 T6 拦截。 |
| E-5 | Dark 单独定义 | Dark 不得直接复制 Light 阴影值，须结合更深的阴影 + 表面色差 + 边框三层共同生效。 |
| E-6 | 品牌基线不动 | 1px 边框、圆角八档、表面优先均属 3.0 已定案基线（BASELINE-AUDIT §11.1 第 3 条），5.0 继承并纠正为 8 个命名档（见 `UDS5-S06` §2.1）。 |
| E-7 | 投影不是层级替代品 | 不得用阴影代替必要边框，不得用大范围 Glow 代替品牌色。 |

> 该口径由 `web/src/design-system/tokens/elevation.css:19-45` 的文件头注释固化，并由 3.0 §8.3「使用限制」与 T6 门禁共同保证。

---

## 2. Border（边框）

### 2.1 Border Width

| 项 | 规定 | 真源 |
|---|---|---|
| 标准描边宽度 | **1px** | `web/src/design-system/tokens/semantic.css:113` 的 `--ds-stroke-width: 1px` |
| 焦点环宽度 | 见 `UDS5-S13`（口径差异已登记） | `semantic.css:123` 当前运行时为 2px |
| 装饰性描边 | 1px `ring-1`（弹层 / 卡片 / 日历格），不承载焦点语义 | 3.0 §15.1 分类表 |
| 禁止 | 2px 以上常规描边、用描边宽度变化表达 hover/层级 | T13–T15 / S07 |

### 2.2 Border Color

| 项 | 规定 |
|---|---|
| 来源 | 边框色由**语义色层**提供：`colors.css` 的 `--ds-color-*` 与 `web/src/styles/theme.css` 的 `--border` / `--ring` 等语义变量；组件不得写裸 `#hex` / `rgba()`（T8）。 |
| 层级表达 | Card / 容器用「1px 描边 + 表面色差」建立层级，不用透明度凑边框（T13–T15 拦截 `bg-X/NN` 类）。 |
| 状态表达 | hover / active / error 走专用 `*-hover` / `destructive` 语义 Token（T14），不靠改变边框宽度。 |
| Light / Dark | 边框色随 `.dark` 翻转（S10），Dark 下不得靠「加深阴影透明度」替代边框。 |
| 焦点环色 | `--ds-focus-ring-color: var(--ring)`（`semantic.css:124`）；错误态色为 `destructive`。 |

> 说明：本轮未逐一枚举 `colors.css` 中 45 个 `--ds-color-*` 的精确边框键名，故不虚构具体 Token 名；实现以运行时语义变量为准，精确清单登记为 `NOT_VERIFIED`（见 §11）。

### 2.3 Border 与圆角的配合

| 项 | 规定 |
|---|---|
| 裁切 | 圆角由容器统一裁切（S06），描边与圆角同步，不出现「直角描边 + 圆角内容」。 |
| 组合输入 | 组合段共享同一 1px 描边，接缝处不出现双线。 |
| 表格 | 表格分隔线用 1px，不加投影（E-3）。 |

---

## 3. Shadow / Elevation：6 档真实名（运行时唯一真源）

真源为 `web/src/design-system/tokens/elevation.css:48-63`。**当前运行时以 `--ds-elevation-*` 命名**（3.0 §8.1 的 `--shadow-xs/sm/md/lg/xl` + `--shadow-brand-glow` 属文档历史命名，见 §3.3 溯源，不得混用为现行实现）。

### 3.1 六档对照表

| # | Token（真实名） | Light 值（elevation.css） | 用途 |
|---|---|---|---|
| 1 | `--ds-elevation-none` | `none` | 静止的页面内元素（默认） |
| 2 | `--ds-elevation-popover` | `0 1px 2px 0 rgb(0 0 0 / 0.06)` | 下拉面板 / 气泡 / 悬浮提示 |
| 3 | `--ds-elevation-overlay` | `0 4px 6px -4px rgb(0 0 0 / 0.1), 0 10px 15px -3px rgb(0 0 0 / 0.1)` | 弹窗 / 抽屉 / 浮层 |
| 4 | `--ds-elevation-raised` | `0 12px 24px -12px rgb(0 0 0 / 0.18), 0 2px 6px -2px rgb(0 0 0 / 0.1)` | 拖拽中的元素（瞬时离开文档流） |
| 5 | `--ds-elevation-marketing` | `0 20px 50px -25px rgb(15 23 42 / 0.18)` | 营销展示卡片（脱离页面平面） |
| 6 | `--ds-glow-online` | `0 0 8px rgb(16 185 129 / 0.45)` | 在线状态点（**状态语义，不是层级**） |

> 「6 档」口径说明：其中 1–5 为层级投影档，第 6 档 `--ds-glow-online` 是状态辉光、不参与层级排序（3.0 §8.1 亦称「五个 Elevation 阴影 Token 和一个独立品牌 Glow Token，不是六档普通阴影」）。守卫白名单 `web/src/design-system/__tests__/elevation-motion.test.ts:64-68` 登记的 5 个 `--ds-elevation-*` 即上表 1–5。

### 3.2 Dark 覆盖（成对生效）

`web/src/design-system/tokens/elevation.css:127-131` 的 `.dark` 覆盖 2 档：

| Token | Dark 值 | 理由 |
|---|---|---|
| `--ds-elevation-marketing` | `0 20px 60px -25px rgb(0 0 0 / 0.7)` | 浅色 0.18 在黑底上不可见 |
| `--ds-elevation-raised` | `0 12px 24px -12px rgb(0 0 0 / 0.6), 0 2px 6px -2px rgb(0 0 0 / 0.4)` | 拖拽瞬时抬升在深色下需更黑 |

3.0 §8.2（`:1309-1320`）另登记 popover / overlay 的 Dark 取值（`0 1px 2px 0 rgb(0 0 0 / 0.6)`、`0 8px 24px -8px rgb(0 0 0 / 0.8)` 等）；**运行时 `.dark` 块当前只覆盖 marketing / raised 两档**，二者口径差异登记为 `NOT_VERIFIED`（见 §11 S07-D2），5.0 不擅自补写运行时未声明的值。

### 3.3 3.0 历史命名溯源（不得作为现行实现引用）

| 3.0 §8.1 命名 | 值 | 5.0 处置 |
|---|---|---|
| `--shadow-xs` | `0 1px 2px rgb(15 23 42 / 0.04)` | 文档历史展示档，运行时以 `--ds-elevation-popover` 为准 |
| `--shadow-sm` | 双层 `0 1px 3px / 0 1px 2px` | 同上 |
| `--shadow-md` | 双层 `0 4px 8px / 0 2px 4px` | 同上 |
| `--shadow-lg` | `0 10px 24px rgb(15 23 42 / 0.12)` | 同上 |
| `--shadow-xl` | `0 20px 40px rgb(15 23 42 / 0.16)` | 同上 |
| `--shadow-brand-glow` | `0 0 24px rgb(85 88 216 / 0.18)` | 对应运行时 `--ds-glow-online` 的状态辉光语义 |

### 3.4 消费写法与 T6

| 项 | 规定 |
|---|---|
| 允许 | `shadow-(--ds-elevation-overlay)`、`shadow-(--ds-elevation-raised)` 等引用登记档。 |
| 禁止 | `shadow-sm` / `shadow-lg` / `shadow-[…]` 任意阴影（T6）。 |
| 禁止 | 引用不存在的 elevation 档位（T6 第二半条）；新增档须同步 `elevation-motion.test.ts` 的 `ELEVATION_TOKENS` 白名单，否则守卫失败。 |
| Card | `elevation.css:58-61` 已移除 `--ds-elevation-card-hover` 与 `--ds-motion-card-hover`；业务组件不得自行新增悬停投影，回到「全站不投影（营销卡除外）」口径。 |

---

## 4. Layer（表面层级）

| 层 | 表达手段 | 是否投影 |
|---|---|---|
| L0 页面底 | `background` | 否 |
| L1 内容表面 | 表面色差 + 1px 描边 `ring-1` | 否 |
| L2 容器 / Card | 表面色差 + 1px 描边 + 登记圆角（S06） | 否（营销展示卡除外） |
| L3 浮层（Popover / Dropdown / Tooltip / HoverCard） | `--ds-elevation-popover` | 允许（唯一放行） |
| L4 覆盖层（Dialog / Drawer / AlertDialog / Sheet） | `--ds-elevation-overlay` + 遮罩 | 允许（唯一放行） |
| L5 瞬时抬升（拖拽中） | `--ds-elevation-raised` | 允许（瞬时） |
| L6 营销脱离面（展示卡） | `--ds-elevation-marketing` | 允许（静态展示） |

> Layer 不等于 z-index：Layer 是**视觉重量**分级，靠色差/描边/投影表达；z-index 只解决**重叠顺序**，不得用更高 z-index 假装更高 Layer。

---

## 5. Overlay（遮罩）

| 项 | 规定 |
|---|---|
| 作用域 | 遮罩与浮层由 Portal 承载，外观作用域显式、不隐式继承（Clerk 参考分析 2.13，S10/S17）。 |
| 背板色 | 走语义变量（如 `colorModalBackdrop` 类语义），不写裸 `rgba()`（T8）。 |
| 嵌套弹层 | 组件打开另一组件时，外观经专用 props / Portal 传递，禁止 `appearance` 式全局覆写（S15）。 |
| 焦点 | 打开后焦点管理、关闭后焦点返回见 `UDS5-S13`。 |
| 投影 | 遮罩本身不加投影；面板用 `--ds-elevation-overlay`。 |

---

## 6. Z-index / Stacking Context（如实登记现状）

| 项 | 现状 | 5.0 规定 |
|---|---|---|
| 专用 z-index Token | **本轮只读核查未发现** `design-system/tokens/` 下存在 `--ds-z-*` / `--z-*` 之类的封闭 z-index 档（对 `web/src/design-system` 的检索无命中） | 5.0 目标：z-index 应收敛为封闭命名档并由单一出口声明；**当前未落地，登记为 `NOT_VERIFIED`**，不虚构档名与数值 |
| 当前实现 | 层叠顺序由组件 / Portal / Tailwind `z-*` 工具类与 DOM 顺序承担 | 允许沿用，但禁止以「裸 `z-[9999]`」制造不可控层叠 |
| Stacking Context | 由 `transform` / `opacity` / `position` / `isolation` 等属性隐式创建；`foundations/motion.css` 的 transform 动画会创建局部层叠上下文 | 浮层须在最外层 Portal 容器内建立独立 Stacking Context，避免被祖先 `overflow` / `transform` 裁切 |
| 焦点环不被裁切 | 焦点环不得被父容器圆角裁切或浮层覆盖（3.0 §15.1 / S13） | 由 Popover / Dialog 的 Portal 层级保证 |
| 禁止 | 用 z-index 表达视觉层级、跨 Stacking Context 硬压浮层 | 违反 E-1 / Layer 定义 |

> 说明：本表如实反映「运行时未提供专用 z-index Token」这一事实；5.0 将其列为治理候选（见 §11 S07-D3），**在补齐证据前不描述为已实现的封闭集合**。

---

## 7. Shadow 使用限制（继承 3.0 §8.3）

1. 不得给所有 Card 自动添加 Shadow。
2. 不得使用大范围 Glow 代替品牌色。
3. 不得使用阴影代替必要边框。
4. 不得创建未登记的任意阴影。
5. 普通表单、普通表格和常规内容容器优先使用 Border。
6. 不得因 hover 态为业务组件新增悬停投影（elevation.css 复裁定已删）。

---

## 8. T6 门禁：只放行浮层投影与已登记 6 档

规则登记于 3.0 §19.5（`UTER-DESIGN-SYSTEM-3.0.md:2947`），由 `check-design-tokens.mjs`（T1–T17）执行，5.0 继承：

| 项 | 内容 |
|---|---|
| 拦截（一） | 非浮层投影 `shadow-sm` / `shadow-lg` / `shadow-[…]`。 |
| 拦截（二） | 引用不存在的 elevation 档位（防「加一档 `--ds-elevation-card`」绕过白名单）。 |
| 放行 | 仅 §3 登记的 6 档 `--ds-elevation-*` / `--ds-glow-online`，且仅用于 §4 中 L3–L6 的浮起面。 |
| 审计事实 | BASELINE-AUDIT §4.4：`check-design-tokens.mjs --strict` 曾记录「浮层投影 20 处」不计违规——即浮层引用登记档属合法放行，而非违规豁免。 |
| ALLOWLIST | `ALLOWLIST=[]`（§11.1 第 5 条），无静态扫描例外。 |
| 阻断 | CI 仅以 `--strict` 为唯一阻断模式，基线只减不增。 |

---

## 9. 禁止事项汇总

1. 禁止 `shadow-sm` / `shadow-lg` / `shadow-[…]` 等非登记阴影。
2. 禁止给表格 / 侧边栏 / 页面容器 / 按钮 / 徽标加阴影。
3. 禁止用阴影替代 1px 边框或用大 Glow 替代品牌色。
4. 禁止 Light / Dark 共用同一套阴影值（E-5）。
5. 禁止用更高 z-index 假装更高视觉层级。
6. 禁止裸 `rgba()` 背板 / 裸 `#hex` 边框色（T8）。
7. 禁止用透明度凑边框 / 悬停 / 浅底层级（T13–T15）。

---

## 10. 差异与例外登记

| 编号 | 内容 | 状态 |
|---|---|---|
| S07-D1 | 3.0 §8.1 `--shadow-*` 与运行时 `--ds-elevation-*` 命名差异，见 §3.3 | 已按运行时真源说明 |
| S07-D2 | 3.0 §8.2 登记 popover/overlay 的 Dark 值，但运行时 `.dark` 仅覆盖 marketing/raised 两档 | `NOT_VERIFIED`（口径待复核） |
| S07-D3 | 运行时未提供专用 z-index 封闭 Token 档 | `NOT_VERIFIED`（治理候选，未落地） |
| S07-D4 | 边框色精确 `--ds-color-*` 键名未逐一枚举 | `NOT_VERIFIED`（不虚构键名） |
| S07-D5 | Card 悬停投影已于 2026-11-03 复裁定删除 | 已核实（elevation.css:58-61） |

---

## 与其他规范的关系

| 规范 | 关系 | 边界 |
|---|---|---|
| `UDS5-S01`（总纲） | 上级 | 5.0 效力、五层架构 |
| `UDS5-S06`（Radius） | 互补 | 圆角裁切与 1px 描边同步；Card 不加阴影 |
| `UDS5-S03`（Color） | 依赖 | 表面色差、边框色、`*-hover` 语义色由颜色规范定义 |
| `UDS5-S08`（Icon） | 约束 | 在线状态辉光 `--ds-glow-online` 不用于图标装饰 |
| `UDS5-S09`（Motion） | 关联 | transform 动画会创建 Stacking Context；`--default-transition-duration` 声明在 elevation.css |
| `UDS5-S10`（Theme） | 依赖 | `.dark` 覆盖 2 档；品牌渐变深浅同值例外不属投影 |
| `UDS5-S13`（Accessibility） | 约束 | 焦点环宽度口径、非文本对比度 3:1、不被裁切 |
| `UDS5-S14`（Component） | 落地 | 浮层组件（Dialog/Popover/Drawer）引用登记档 |
| 3.0 §8 / §19.5 T6 | 历史溯源 | 3.0 保留为历史，仅用于真源定位 |

---

## 代码实施位置

| 路径 | 职责 |
|---|---|
| `web/src/design-system/tokens/elevation.css:48-63` | 6 档 `--ds-elevation-*` / `--ds-glow-online` 唯一声明 |
| `web/src/design-system/tokens/elevation.css:127-131` | `.dark` 覆盖 marketing / raised 两档 |
| `web/src/design-system/tokens/elevation.css:121-124` | `@theme --default-transition-duration` 声明（S09 引用） |
| `web/src/design-system/tokens/semantic.css:113,123-124` | `--ds-stroke-width: 1px`、`--ds-focus-ring-width` / `--ds-focus-ring-color` |
| `web/src/design-system/tokens/colors.css` | `--ds-color-*` 语义色（边框色 / 表面色差来源） |
| `web/src/styles/theme.css` | `--border` / `--ring` 语义变量、`.dark` 颜色翻转 |
| `web/src/design-system/__tests__/elevation-motion.test.ts:61-82` | `ELEVATION_TOKENS` 白名单 + `shadow-(--ds-elevation-*)` 消费校验 |
| `web/src/components/ui/dialog.tsx` / `alert-dialog.tsx` / `popover.tsx` / `hover-card.tsx` | L4 / L3 浮层落地 |
| `web/src/components/dialog.tsx` / `confirm-dialog.tsx` | 业务封装浮层 |
| `web/scripts/check-design-tokens.mjs` | T1–T17 静态门禁（T6） |
| `web/scripts/verify-contrast.mjs` | 对比度与非文本对比度校验（S13 引用） |

---

## 自动化验证

| 脚本 / npm 脚本 | 关联 | 说明 |
|---|---|---|
| `check-design-tokens.mjs` | T6 | 拦截非浮层 `shadow-*` 与不存在的 elevation 档；T1–T17 统一扫描 |
| `lint:design:strict` | 门禁 | CI 唯一阻断模式 |
| `generate-design-tokens.mjs` | 真源同步 | `--check` 校验生成 CSS 与源同步 |
| `sync-design-showcase.mjs` | 展示一致 | `--check` 的 17 条校验含 Shadow 区（showcase 第 14 区）快照 |
| `verify:contrast`（`verify-contrast.mjs`） | 对比度 | 边框色 / 非文本对比度 3:1 校验 |
| `visual-regression.mjs` / `test:visual` | 视觉 | 投影/边框变更需复核 22 页 × 2 视口基线 |
| `elevation-motion.test.ts` | 守卫测试 | `web/src/design-system/__tests__/` 10 个守卫之一，守 6 档白名单与 Dark 覆盖 |

> 说明：`elevation-motion.test.ts` 为守卫测试文件；门禁脚本以上表所列 `.mjs` 与 npm 脚本为限。

---

## 验证状态

| 项 | 状态 | 依据 / 备注 |
|---|---|---|
| 6 档真值与 Dark 覆盖 | `NOT_VERIFIED` | 已读取 `elevation.css` 核实声明，本轮**未执行** `check-design-tokens.mjs --strict` |
| 边框色精确 Token 清单 | `NOT_VERIFIED` | 未逐一枚举 `colors.css` 45 个 `--ds-color-*`，不虚构键名 |
| z-index 封闭集合 | `NOT_VERIFIED` | 运行时未提供专用 Token，治理候选未落地 |
| Light / Dark 阴影三层共同生效 | `NOT_VERIFIED` | 未在真实渲染下复核 |
| 65 个组件投影引用合规 | `NOT_VERIFIED` | BASELINE-AUDIT §5 记 65 组件证据 0 VERIFIED |
| `verify:contrast` 31 条 / `test:axe` | `NOT_VERIFIED` | 审计记录曾 31 PASS / 0 FAIL，但本轮未执行，不继承为通过 |
| 视觉回归双轨 / 全量构建 | `NOT_EXECUTED` | BASELINE-AUDIT §14 明确未执行，不得伪装 PASS |
| 平台验收（Android / iOS / HarmonyOS） | `NOT_VERIFIED` | 见 `UDS5-S12` 与 BASELINE-AUDIT §8 |

**结论**：本分册为规范声明，所有验证项均为 `NOT_VERIFIED` / `NOT_EXECUTED`，**未勾选任何测试通过或平台验收**。
