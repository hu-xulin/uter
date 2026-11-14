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
| E-6 | 品牌基线不动 | 1px 边框、8 个命名派生档 + `rounded-full` 特殊档（运行时 T10 称「圆角九档」）、表面优先均属 3.0 已定案基线（BASELINE-AUDIT §11.1 第 3 条），5.0 继承并纠正为 8 个命名档（见 `UDS5-S06` §2.1）。 |
| E-7 | 投影不是层级替代品 | 不得用阴影代替必要边框，不得用大范围 Glow 代替品牌色。 |

> 该口径由 `web/src/design-system/tokens/elevation.css:19-45` 的文件头注释固化，并由 3.0 §8.3「使用限制」与 T6 门禁共同保证。

---

## 2. Border（边框）

### 2.1 Border Width

| 项 | 规定 | 真源 |
|---|---|---|
| 标准描边宽度 | **1px** | `web/src/design-system/tokens/semantic.css:113` 的 `--ds-stroke-width: 1px` |
| 焦点环宽度 | 见 `UDS5-S13` §7：**已裁决 2px `ring-2`，无规范—代码漂移** | `semantic.css:123` 运行时为 2px |
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

### 6.1 现状事实（只读核查结论）

| 项 | 现状 | 5.0 规定 |
|---|---|---|
| 专用 z-index Token | **只读核查未发现** `web/src/design-system/tokens/` 下存在 `--ds-z-*` / `--z-*` 之类的封闭 z-index 档（该目录下仅 `brand-colors.ts`、`chart-typography.ts`、`colors.css`、`elevation.css`、`index.css`、`primitives.css`、`semantic.css`、`spacing.css`、`typography.css`，全文检索 `z-index` / `--ds-z` / `--z-` **零命中**） | 5.0 目标：z-index 应收敛为封闭命名档并由单一出口声明；**当前未落地，登记为 `NOT_VERIFIED`**，不虚构档名与数值 |
| 当前实现 | 层叠顺序由组件 / Portal / Tailwind `z-*` 工具类与 DOM 顺序承担 | 允许沿用，但禁止以「裸 `z-[9999]`」制造不可控层叠 |
| Stacking Context | 由 `transform` / `opacity` / `position` / `isolation` 等属性隐式创建；`foundations/motion.css` 的 transform 动画会创建局部层叠上下文 | 浮层须在最外层 Portal 容器内建立独立 Stacking Context，避免被祖先 `overflow` / `transform` 裁切 |
| 焦点环不被裁切 | 焦点环不得被父容器圆角裁切或浮层覆盖（3.0 §15.1 / S13） | 由 Popover / Dialog 的 Portal 层级保证 |
| 禁止 | 用 z-index 表达视觉层级、跨 Stacking Context 硬压浮层 | 违反 E-1 / Layer 定义 |

### 6.2 目标 z-index 分层（5.0 目标档，**未落地**）

> 来源：业务域蓝图《Shape, Border and Elevation Standard》§4「层叠顺序」。该蓝图给出的是**分层语义**，不是仓库已实现的 Token——本节只把它登记为**目标档**，Token 落地前不得被引用为现行真值。

| 语义档 | 目标 Token 名（未落地） | 目标值 | 典型宿主 | 与 §4 Layer 的关系 |
|---|---|---:|---|---|
| 基础层 | `--ds-z-base` | 0 | 页面根、文档流内容 | L0 |
| 粘性层 | `--ds-z-sticky` | 100 | 粘性表头 / 粘性页头 | L1–L2（视觉重量不变，仅解决滚动重叠） |
| 下拉层 | `--ds-z-dropdown` | 200 | Select / Combobox 触发层 | L3 |
| 浮出层 | `--ds-z-popover` | 300 | Popover / HoverCard / Tooltip / Menu | L3 |
| 遮罩层 | `--ds-z-overlay` | 400 | Dialog / Sheet / Drawer 的 backdrop | L4 |
| 模态层 | `--ds-z-modal` | 500 | Dialog / Sheet / Drawer 内容面板 | L4 |
| 轻提示层 | `--ds-z-toast` | 600 | Toast / Sonner 通知 | L4（瞬时） |
| 关键系统层 | `--ds-z-critical` | 700 | 全局阻断遮罩、必须置顶的系统提示 | L4 |

**分档规则（收敛口径）**

1. **步长 100**：档位之间预留 ≥100 的间隔，使第三方插入层叠不必重排全表。
2. **相邻档不混用**：同一交互族（backdrop 与内容面板、popover 与 tooltip）必须相邻成对，不允许出现「遮罩 400 / 内容面板 600」这种中间无主的空洞。
3. **视觉层级 ≠ z-index**：§4 的 L0–L6 是视觉重量，§6.2 是重叠顺序。**不得**用更高 z-index 假装更高 Layer（E-1）。
4. **单一出口**：目标档落地时，须在 `web/src/design-system/tokens/` 内单点声明并由守卫测试锁定白名单，参照 `elevation-motion.test.ts` 对 `ELEVATION_TOKENS` 的做法；不得让组件各自写 `z-[…]`。
5. **禁止任意值**：落地后 `z-[…]` 任意 z-index 与超出最高档的裸数值一律拦截（建议归入 T 系列门禁，落地前登记为治理候选，不虚构已存在的检查项）。

### 6.3 存量 z 值分布（收敛基线，如实登记）

> 数据来源：`web/src` 全量 `z-[0-9]+` 检索（排除测试文件），统计时点 2026-11-14。**这是存量事实，不是合规证明。**

| 工具类 | 出现次数 | 主要位置 | 收敛映射（目标） | 状态 |
|---|---:|---|---|---|
| `z-50` | 30（其中 `components/ui/` 24） | `ui/alert-dialog.tsx:51,77`、`ui/popover.tsx:63,68`、`ui/hover-card.tsx:54,59`、`ui/sheet.tsx:50,81`、`ui/drawer.tsx:59`、`ui/dialog.tsx`、`ui/navigation-menu.tsx:132` | 遮罩 → `--ds-z-overlay`；内容面板 → `--ds-z-modal`；Popover/HoverCard → `--ds-z-popover` | **冲突**：单一 `z-50` 同时承载 overlay / modal / popover 三种语义，目标档须拆分 | 
| `z-100` | 1 | `ui/combobox-input.tsx:299` | `--ds-z-dropdown` | 语义已越出 `z-50` 族，属未登记例外 |
| `z-60` | 1 | `components/ui/`（非浮层） | 待核 | `NOT_VERIFIED`（未定位到唯一宿主，见 §11 S07-D6） |
| `z-999` | 1 | 非 `ui/` 目录 | 待核 | `NOT_VERIFIED`（同 S07-D6） |
| `z-30` / `z-20` / `z-10` / `z-1` / `z-0` | 2 / 2 / 35 / 1 / 2 | 页面局部装饰与粘性表头（`features/home/**`、`features/channels/**`、`system-settings/models/channel-sync-models-table.tsx:103` 等） | 页面局部层级，属**组件内部层叠**，原则上不进全局档表 | 局部用法，与全局浮层档不构成冲突；需在组件层约定「局部层叠不得越过全局档基线」 |
| 内联 `zIndex` 数值 | — | `features/dashboard/lib/flow.ts:1179-1183`（`100_000 + index` / `1_000_000 + index`） | 图表内部绘制顺序（SVG/Canvas），不属于 UI 层叠 | **豁免**：图表绘制顺序不属于 z-index 治理范围（需在组件层约定「局部层叠不得越过全局档基线」） |
| 内联 `z-index: 2147483000` | 2 | `features/customer-service/CustomerServiceWidget.css:29`（`.cs-fab`）、`:51`（`.cs-panel`） | 客服挂件为**全局常驻悬浮控件**，必须恒在最上 | **登记例外**（见 §11 S07-D7）：该组件为 Uter 自研（非第三方 iframe），其「必须不被任何浮层遮挡」的产品诉求与目标档 `critical=700` 冲突，需在落地时保留独立「常驻全局控件」位 |

### 6.4 落地路径（治理候选，非既成事实）

1. 在 `web/src/design-system/tokens/` 内新增单一 z-index 声明点，落地 §6.2 八档目标 Token。
2. 将全库 30 处 `z-50`（其中 `ui/` 下 24 处） 按「overlay / modal / popover / dropdown」语义拆分替换。
3. 增加守卫测试锁定档位白名单（参照 `elevation-motion.test.ts` 的白名单范式）。
4. 为 `z-[…]` 任意值与超档裸数值补静态拦截（登记为治理候选，**当前无对应检查项，不得宣称已生效**）。
5. 完成 1–4 后，将 §10 的 `S07-D3` 由 `NOT_VERIFIED` 改为已落地，并回填本节存量分布为收敛后基线。

> 说明：本表如实反映「运行时未提供专用 z-index Token」这一事实；§6.2 是**目标档**（来自业务域蓝图的结构性分层），**不是**已实现真值。

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
8. 禁止在组件内写任意 z-index（`z-[…]`）或超出 §6.2 最高档的裸数值（§6.2 规则 5；**该拦截当前为治理候选，未落地，见 §6.4**）。
9. 禁止用 `z-50` 单一值同时承载遮罩 / 模态 / 浮出三种语义（§6.3 收敛映射；当前存量 30 处，落地前属已知债务）。
10. 禁止页面局部层叠越过全局浮层档基线（§6.3 局部用法口径）；图表内部绘制顺序（`features/dashboard/lib/flow.ts`）不属本条范围。

---

## 10. 差异与例外登记

| 编号 | 内容 | 状态 |
|---|---|---|
| S07-D1 | 3.0 §8.1 `--shadow-*` 与运行时 `--ds-elevation-*` 命名差异，见 §3.3 | 已按运行时真源说明 |
| S07-D2 | 3.0 §8.2 登记 popover/overlay 的 Dark 值，但运行时 `.dark` 仅覆盖 marketing/raised 两档 | `NOT_VERIFIED`（口径待复核） |
| S07-D3 | 运行时未提供专用 z-index 封闭 Token 档 | `NOT_VERIFIED`（治理候选，未落地）；**本轮已补齐目标档与收敛路径**（§6.2 / §6.3 / §6.4），闭合条件见 §6.4 五步 |
| S07-D4 | 边框色精确 `--ds-color-*` 键名未逐一枚举 | `NOT_VERIFIED`（不虚构键名） |
| S07-D5 | Card 悬停投影已于 2026-11-03 复裁定删除 | 已核实（elevation.css:58-61） |
| S07-D6 | 存量 `z-60`（1 处）与 `z-999`（1 处）的宿主**已定位**（2026-11-14 独立复核）：`z-60` → `web/src/components/ui/sidebar.tsx:211`（侧栏移动端抽屉浮层，位于 `z-50` 之上）；`z-999` → `web/src/components/skip-to-main.tsx:25`（跳过导航跳转按钮，须始终在最上层可达）。两者均**不在**目标八档语义内（`z-60` 介于 `modal=500` 与 `toast=600` 之间；`z-999` 超 `critical=700`） | 已定位宿主（**未映射到目标档**）；落地 Token 时需决定：侧栏抽屉归 `overlay=400`/`modal=500`，跳过导航归 `critical=700`；`NOT_VERIFIED` |
| S07-D7 | 客服挂件 `CustomerServiceWidget.css:29,51` 使用 `z-index: 2147483000`，远超目标档最高位 `critical=700` | **登记例外**（产品诉求：常驻悬浮控件须不被任何浮层遮挡）；落地时需为其保留独立「常驻全局控件」位，不得简单压档 |
| S07-D8 | 业务域蓝图《Shape, Border and Elevation Standard》§3 的 `elevation.0`–`elevation.4` 五档命名与仓库 `--ds-elevation-*` 命名体系不一致（蓝图为 5 档含 `elevation.0` 无阴影，仓库为 5 档层级投影 + 1 档状态辉光） | 已按运行时真源说明（§3.1）；蓝图仅贡献分层语义，不改运行时命名与档数 |
| S07-D9 | 业务域蓝图 §1 圆角 9 档（0/4/6/8/12/16/20/24/9999）与仓库 8 命名档 + `rounded-full` 不一致 | 已按运行时真源说明（`UDS5-S06` §2.1）；蓝图值不采纳 |
| S07-D10 | **负 z-index 未进目标档位**：`web/src` 有 **3 处** `-z-10`（负值）——`features/home/components/sections/hero.tsx:83,87`、`features/home/components/sections/cta.tsx:44`，均为 `ds-decor-mesh-*` / `ds-decor-grid` 装饰层置于父容器内容之下。§6.2 目标八档（`base=0` 起）**无负值档**，未覆盖这一分层语义。落地 Token 时需决定：新增 `--ds-z-decoration: -10` 档，或明确「装饰层负 z 不进 Token、以 Tailwind `-z-10` 直用」 | **登记**（目标档位缺口）；`NOT_VERIFIED` |

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
| `elevation-motion.test.ts` | 守卫测试 | `web/src/design-system/__tests__/` 12 个守卫之一，守 6 档白名单与 Dark 覆盖 |

> 说明：`elevation-motion.test.ts` 为守卫测试文件；门禁脚本以上表所列 `.mjs` 与 npm 脚本为限。

---

## 验证状态

| 项 | 状态 | 依据 / 备注 |
|---|---|---|
| 6 档真值与 Dark 覆盖 | `NOT_VERIFIED` | 已读取 `elevation.css` 核实声明，本轮**未执行** `check-design-tokens.mjs --strict` |
| 边框色精确 Token 清单 | `NOT_VERIFIED` | 未逐一枚举 `colors.css` 45 个 `--ds-color-*`，不虚构键名 |
| z-index 封闭集合 | `NOT_VERIFIED` | 运行时未提供专用 Token；**本轮已给出目标八档（§6.2）与存量收敛基线（§6.3），但 Token 未落地**，治理候选未落地 |
| z-index 目标八档落地 | `NOT_EXECUTED` | §6.4 五步落地路径本轮未执行（未改 `web/src` 运行时代码） |
| Light / Dark 阴影三层共同生效 | `NOT_VERIFIED` | 未在真实渲染下复核 |
| 65 个组件投影引用合规 | `NOT_VERIFIED` | BASELINE-AUDIT §5 记 65 组件证据 0 VERIFIED |
| `verify:contrast` 31 条 / `test:axe` | `NOT_VERIFIED` | 审计记录曾 31 PASS / 0 FAIL，但本轮未执行，不继承为通过 |
| 视觉回归双轨 / 全量构建 | `NOT_EXECUTED` | BASELINE-AUDIT §14 明确未执行，不得伪装 PASS |
| 平台验收（Android / iOS / HarmonyOS） | `NOT_VERIFIED` | 见 `UDS5-S12` 与 BASELINE-AUDIT §8 |

**结论**：本分册为规范声明，所有验证项均为 `NOT_VERIFIED` / `NOT_EXECUTED`，**未勾选任何测试通过或平台验收**。
