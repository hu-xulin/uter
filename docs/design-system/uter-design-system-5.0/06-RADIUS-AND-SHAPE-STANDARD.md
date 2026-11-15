# 06 · 圆角与形态规范（Radius & Shape Standard）

> UTER Design System 5.0 · 分册 S06。本规范定义全站「圆角值从哪来、形状怎么分类、各类控件用哪一档」，是形状层唯一正式依据。**5.0 为当前唯一正式体系，`UTER-DESIGN-SYSTEM-3.0.md` 完整保留为历史版本**，本文引用 3.0 章节仅用于溯源，不构成 3.0 继续生效。本文所有条款均为规范声明，除明确标注已由审计核实的真源代码位置外，**未宣称任何测试已通过或平台已验收**。

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S06` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01`（UTER Design System 5.0 总纲） |
| 生效日期 | `2026-11-14` |
| 适用范围 | `web/` 全部 React/TSX 组件、design-system tokens/foundations、`showcase.html` 展示快照；后台、营销、H5 响应式分支一致适用 |
| 验证状态 | `NOT_VERIFIED` |

---

## 1. 目的与总则

| 编号 | 原则 | 说明 |
|---|---|---|
| R-1 | 单一基准 | 所有圆角由单一 `--radius` 基准派生，禁止在各组件内写死像素圆角值。 |
| R-2 | 封闭集合 | 圆角只能是本文登记的命名档或 Tailwind 全圆角类，任意值 `rounded-[…]` 由门禁 T10 拦截。 |
| R-3 | 语义优先 | 形态（圆 / 胶囊 / 方 / 圆角）表达语义，不用于装饰性微调。 |
| R-4 | 表面优先 | 层级靠 1px 描边与表面色差建立，圆角不承担投影职责（见 `UDS5-S07`）。 |
| R-5 | **上游对齐·唯一值** | 圆角基准唯一规范值 `0.375rem`(6px)（`UDS5-S01` §4.2 `G1`）；8 档 calc 派生与 `rounded-full` 属 `G2` 刻度，不是第二套基准。运行时迁移按 §19 待办 |
| R-6 | 可整体缩放 | 圆角通过 `data-theme-radius` 改基准整体缩放，不逐档改值。 |

---

## 2. 圆角基准与派生真源（唯一可信来源）

运行时唯一基准声明在 `web/src/styles/theme.css:276`：

```css
:root {
  --radius: 0.625rem;   /* = 10px，默认控件档 r-md */
}
```

派生档唯一声明在 `web/src/styles/theme.css:264-271`，**真源写法为 `calc(var(--radius) * N)`**（不是硬编码 px）：

```css
--radius-xs:  calc(var(--radius) * 0.6);
--radius-sm:  calc(var(--radius) * 0.8);
--radius-md:  var(--radius);
--radius-lg:  calc(var(--radius) * 1.2);
--radius-xl:  calc(var(--radius) * 1.4);
--radius-2xl: calc(var(--radius) * 1.6);
--radius-3xl: calc(var(--radius) * 1.8);
--radius-4xl: calc(var(--radius) * 2);
```

### 2.1 八档真实值对照表

以 `--radius = 0.625rem = 10px`（根字号 16px）为基准换算：

| 档位 Token | 派生表达式 | 倍率 N | 实际值 | 主要用途（theme.css:261-262 原注） |
|---|---|---:|---:|---|
| `--radius-xs` | `calc(var(--radius) * 0.6)` | 0.6 | 6px | 极小元素、气泡尖角收口 |
| `--radius-sm` | `calc(var(--radius) * 0.8)` | 0.8 | 8px | 紧凑控件、小徽章、紧凑输入 |
| `--radius-md` | `var(--radius)` | 1.0 | 10px | 输入框 / 按钮 / 标签页触发器 |
| `--radius-lg` | `calc(var(--radius) * 1.2)` | 1.2 | 12px | 卡片 / 弹窗 / 图标按钮 |
| `--radius-xl` | `calc(var(--radius) * 1.4)` | 1.4 | 14px | 强调容器 |
| `--radius-2xl` | `calc(var(--radius) * 1.6)` | 1.6 | 16px | 展示型卡片 |
| `--radius-3xl` | `calc(var(--radius) * 1.8)` | 1.8 | 18px | 超大容器 |
| `--radius-4xl` | `calc(var(--radius) * 2)` | 2.0 | 20px | 全幅面板 |

> **数值口径澄清（重要，防止 3.0/5.0 混用）**：`web/src/styles/theme.css:258-260` 明确记录——「旧版只登记到 16px 并自称『七档』，属文档滞后；3xl / 4xl 由 `primitives.css` 与 `semantic.css` 长期持有，这里补齐后三处口径才一致」。因此：
> - 指令中「圆角七档 6/8/10/12/14/16/18/20px」的**八个真实数值**，对应代码里 `xs→4xl` 共 **8 个命名档**；
> - 「七档」是 3.0 早期文档只登记到 16px（`2xl`）时的历史称谓；
> - 5.0 以运行时真源为准，登记为 **8 个命名派生档**，值域完整覆盖 `6 / 8 / 10 / 12 / 14 / 16 / 18 / 20px`，不多一档、不少一档；`rounded-full` 为 T10 额外放行的**特殊档**（运行时 `theme.css:257` 称「第九档」），不属于这 8 个 calc 派生档，故「8 档」与「9 种合法写法」不矛盾。

---

## 3. Shape 形态分类总表

| 形态 | 判定 | 允许写法 | 典型组件 | 禁止 |
|---|---|---|---|---|
| Rectangle（直角矩形） | 无圆角 | `rounded-none` / 不写圆角类 | 表格分隔、分割线容器、全幅条带 | 用 `rounded-[0]` 任意值表达 |
| Rounded（圆角矩形） | 四角等半径 | 引用 8 个 `--radius-*` 档 | 输入框、按钮、卡片、弹窗、容器 | `rounded-[3px]` 等任意值 |
| Circle（正圆） | 宽高相等 + 全圆 | `rounded-full` + 固定 1:1 尺寸 | 头像、状态点、圆形图标按钮、色板点 | 用 `rounded-[50%]` 任意值 |
| Pill（胶囊） | 高度固定、两端半圆 | `rounded-full` + 固定高度 | Badge / Tag / Chip / 筛选标签 / 开关轨道 | 用超大 `rounded-4xl` 伪装胶囊 |

> Circle 与 Pill 均使用 Tailwind 内建 `rounded-full`（`border-radius: 9999px`），属于封闭集合内的已登记写法，**不受 T10 拦截**（T10 只拦 `rounded-[…]` 任意值）。判定「是不是 Circle / Pill」看**宽高比与高度是否固定**，不看圆角数值。

---

## 4. Circle（正圆）规定

| 项 | 规定 |
|---|---|
| 几何 | 宽度 = 高度，`aspect-ratio: 1 / 1`，`rounded-full`。 |
| 尺寸来源 | 尺寸走 `size-*` 与间距阶梯（4px 单位，T17），圆角本身只用 `rounded-full`。 |
| 头像 | 使用 `ui/avatar.tsx`；镂空环属视觉分隔，不承载焦点语义（3.0 §15.1 分类）。 |
| 状态点 | 在线状态辉光为 `--ds-glow-online`（S07），不得用 glow 代替品牌色。 |
| 图标命中区 | 视觉可 16/18/24px，但命中区须 ≥24px（S13），圆面积不得压缩命中区。 |
| 禁止 | 禁止用 `calc(var(--radius) * N)` 拼凑「接近圆」的方角；正圆只能 `rounded-full`。 |

---

## 5. Pill（胶囊）规定

| 项 | 规定 |
|---|---|
| 几何 | 固定高度 + `rounded-full`，两端为半圆；横向随内容延展。 |
| 高度 | 高度由 `data-theme-scale` 对应的控件尺寸档决定，不在组件内写死 px。 |
| Padding | 左右内边距 > 上下内边距，走间距阶梯（T17）。 |
| 适用 | Badge、Tag、Chip、筛选标签、开关（Switch）轨道、计数徽标。 |
| 与 Circle 区分 | 宽高相等的胶囊是 Circle；宽 > 高且高度固定的是 Pill。 |
| 禁止 | 禁止用 `rounded-4xl`（20px）假装胶囊；禁止仅靠缩小字号适配胶囊高度（T16 下限 12px）。 |

---

## 6. Input（输入框）规定

| 项 | 规定 |
|---|---|
| 默认圆角 | `--radius-md`（10px），见 theme.css 用途注。 |
| 紧凑变体 | `input-group` / 组合输入内可用 `--radius-sm`（8px），须同一组件内统一。 |
| 组合输入 | 前置/后置附加段与主体**共享同一圆角**，仅外侧两角保留圆角、内侧角为直角；由容器统一裁切，不得各段独立写不同 `rounded-*`。 |
| 焦点 | 焦点环口径见 `UDS5-S13`；输入舱「容器承担焦点环」时基态须有透明环占位，避免过渡跳变。 |
| 边框 | 1px 描边（`--ds-stroke-width: 1px`，见 S07），圆角与描边同步裁切。 |
| H5 | 输入文本 ≥16px 防 iOS 缩放（S12），圆角不随断点改变。 |

---

## 7. Button（按钮）规定

| 项 | 规定 |
|---|---|
| 默认圆角 | `--radius-md`（10px）。 |
| 图标按钮 | 圆形图标按钮用 `rounded-full` + 1:1；方形图标按钮用 `--radius-lg`（12px，theme.css 用途注）。 |
| 尺寸 | 9 档尺寸由 `ui/button.tsx` 的 `cva()` 管理；圆角不随 size 逐档改值。 |
| 变体 | 6 variant 共享同一圆角，禁止按 variant 切不同圆角档。 |
| 状态 | default / hover / focus / pressed / disabled / loading / error / success 八态圆角保持一致（S14）。 |
| 禁止 | 禁止 `rounded-[…]`；禁止按钮组相邻按钮各自独立圆角导致中缝双圆角。 |

---

## 8. Card（卡片）规定

| 项 | 规定 |
|---|---|
| 默认圆角 | `--radius-lg`（12px），theme.css 用途注。 |
| 强调容器 | `--radius-xl`（14px）；展示型卡片 `--radius-2xl`（16px）。 |
| 层级 | 常态分层只靠 1px 描边（`ring-1`）+ 表面色差；**Card 不加阴影**（elevation.css:58-61 已移除 Card 悬停投影，S07）。 |
| 内部裁切 | 卡片内媒体/表头贴边时由卡片 `overflow-hidden` 统一裁切圆角，子元素不重复声明圆角。 |
| 营销展示卡 | 属唯一允许登记投影的静态展示物（`--ds-elevation-marketing`，S07），圆角可用大档但不得突破 8 档集合。 |

---

## 9. Modal / Dialog（弹窗）规定

| 项 | 规定 |
|---|---|
| 默认圆角 | `--radius-lg`（12px），theme.css 用途注。 |
| 遮罩 | 背板本身无圆角；弹窗面板用登记档。 |
| 嵌套弹层 | 嵌套弹层外观作用域显式继承，不隐式漂移（Clerk 参考分析 2.11，S10/S17）。 |
| 移动端 | 底部抽屉（vaul Drawer）上两角可用登记大档，下两角贴边为直角，由容器裁切。 |
| 投影 | 用 `--ds-elevation-overlay`（S07），不得用 `shadow-lg`。 |

---

## 10. Container（容器）规定

| 容器类型 | 圆角 | 依据 |
|---|---|---|
| 页面内容容器 / App Shell | 直角 `rounded-none` | 全幅结构，不引入圆角 |
| 强调容器 / 分组面板 | `--radius-xl`（14px） | theme.css 用途注 |
| 超大容器 | `--radius-3xl`（18px） | theme.css 用途注 |
| 全幅面板（营销宽屏展示） | `--radius-4xl`（20px） | theme.css 用途注 |
| 气泡尖角收口 | `--radius-xs`（6px） | 用于 CustomerServiceWidget 类非对称收口 |
| 非对称圆角 | 允许单角/对角引用登记档（如气泡 `var(--radius-xl) var(--radius-xl) var(--radius-xs)`），见 `web/src/features/customer-service/CustomerServiceWidget.css:121-122` | 值必须来自 8 档 |

---

## 11. `data-theme-radius` 整体缩放

| 项 | 说明 |
|---|---|
| 机制 | 主题预设通过改 `--radius` 基准值整体缩放 8 档，`data-theme-radius` 由 `web/src/context/theme-customization-provider.tsx:131` 写入 `<body>`。 |
| 预设真源 | `web/src/styles/theme-presets.css` 内各 `[data-theme-preset]` 声明不同 `--radius`（0.3 / 0.5 / 0.625 / 0.75 / 1rem 等），` web/src/styles/theme-presets.css:674-686` 另列 radius 维度档（0 / 0.3 / 0.5 / 0.75 / 1rem）。 |
| 消费 | 组件只写 `rounded-md` 等语义类 → 只读 `--radius-md` → 随基准缩放；`web/src/lib/theme-radius.ts:22,41` 默认读 `--radius-md`。 |
| 禁止 | 禁止为适配某预设而给单个组件补 `rounded-[…]`；缩放必须由基准统一表达。 |

---

## 12. T10 门禁：禁止任意圆角

规则登记于 3.0 §19.5（`UTER-DESIGN-SYSTEM-3.0.md:2951`），由 `check-design-tokens.mjs`（T1–T17）执行，5.0 继承为强制门禁：

| 项 | 内容 |
|---|---|
| 拦截 | 任意圆角 `rounded-[3px]`、`rounded-[0.35rem]`、任意 `border-radius: Npx` 硬编码。 |
| 放行 | `rounded-[inherit]`、`rounded-[var(--…)]`（引用登记 Token 变量）。 |
| 唯一例外 | 无 ALLOWLIST 例外；`ALLOWLIST=[]`（BASELINE-AUDIT §11.1 第 5 条）。 |
| 依据 | 本文 §2 的 8 档封闭集合；任意值会绕过 `data-theme-radius` 整体缩放并破坏三处口径一致。 |
| 阻断模式 | CI 仅以 `--strict` 作为唯一阻断模式，基线只减不增。 |

---

## 13. 禁止事项汇总

1. 禁止写死 `border-radius: 6px` / `rounded-[6px]` 等任意值。
2. 禁止在 `primitives.css` / `semantic.css` / 组件层重复声明 `--radius-*`（T1 守唯一来源的同类约束）。
3. 禁止同一功能（如两个 PrimaryButton）使用不同圆角档。
4. 禁止用 Circle/Pill 表达普通容器，或用 Rounded 表达正圆。
5. 禁止为「看起来更圆」新增第 9 档；新增档须先改 3.0 §28.5 TOKEN-MANIFEST（历史 Spec SSOT 追溯）与 5.0 变更流程 `UDS5-S01` §19 并同步守卫与快照，五者同提交（参照 3.0 §15.1 变更流程）。
6. 禁止因 H5 断点改变圆角档来「解决布局」（S12）。

---

## 14. 差异与例外登记

| 编号 | 内容 | 状态 |
|---|---|---|
| S06-D1 | 3.0 早期「七档」称谓与当前 8 个命名档的数值口径差异，见 §2.1 澄清 | 已按运行时真源统一说明 |
| S06-D2 | `theme-presets.css` 各预设重抄整组同名变量（BASELINE-AUDIT §4.1 记 52 个同名变量），属 5.0 合并候选 | `NOT_VERIFIED`（合并需同步 17 条 showcase 校验契约） |
| S06-D3 | 阴影/层级/Card 悬停投影归属 S07，本文不重复定义 | 正常 |

---

## 与其他规范的关系

| 规范 | 关系 | 边界 |
|---|---|---|
| `UDS5-S01`（总纲） | 上级 | 定义 5.0 效力、五层架构、版本治理 |
| `UDS5-S04`（Typography） | 约束 | 最小字号 12px（T16）不因圆角/胶囊高度被突破 |
| `UDS5-S07`（Elevation） | 互补 | 圆角裁切与 1px 描边、投影档配合；Card 阴影归属 S07 |
| `UDS5-S10`（Theme） | 依赖 | `data-theme-radius` 是 S10 三维独立之一，改基准即整体缩放 |
| `UDS5-S12`（Responsive） | 约束 | 断点切换不得改变圆角档 |
| `UDS5-S13`（Accessibility） | 约束 | 命中区 ≥24px、焦点环不被圆角裁切 |
| `UDS5-S14`（Component） | 落地 | 各组件八态圆角一致性由组件规范登记 |
| 3.0 §5 / §19.5 T10 | 历史溯源 | 3.0 保留为历史，仅用于真源定位，不作现行验收依据 |

---

## 代码实施位置

| 路径 | 职责 |
|---|---|
| `web/src/styles/theme.css:264-276` | `--radius` 基准与 8 档 `calc(var(--radius) * N)` 唯一声明 |
| `web/src/styles/theme-presets.css` | 各主题预设 / radius 维度的 `--radius` 覆盖 |
| `web/src/lib/theme-radius.ts` | 运行时读取 `--radius-md` 的收口 |
| `web/src/context/theme-customization-provider.tsx:120-138` | 写入 `data-theme-preset` / `data-theme-radius` / `data-theme-scale` |
| `web/src/design-system/tokens/primitives.css` | 3xl / 4xl 档的历史持有者（口径对齐对象） |
| `web/src/design-system/tokens/semantic.css` | `--radius-*` 语义层持有者（口径对齐对象） |
| `web/src/design-system/__tests__/tokens.test.ts:251` | `var(--radius)` / `calc(var(--radius) * N)` 按基准值解析成 px 的守卫逻辑 |
| `web/src/components/ui/button.tsx` | 9 size × 6 variant 的圆角一致性落点 |
| `web/src/components/ui/avatar.tsx` | Circle 形态落地 |
| `web/src/features/customer-service/CustomerServiceWidget.css:103-152` | 非对称圆角引用登记档的实例 |
| `web/scripts/check-design-tokens.mjs` | T1–T17 静态门禁（T10） |
| `web/scripts/sync-design-showcase.mjs` | showcase 与 Manifest 的 17 条一致性校验 |

---

## 自动化验证

| 脚本 / npm 脚本 | 关联 | 说明 |
|---|---|---|
| `check-design-tokens.mjs` | T10 | 拦截任意圆角 `rounded-[…]`，放行 `rounded-[var(--…)]`；T1–T17 统一扫描 |
| `lint:design:strict` | 门禁 | CI 唯一阻断模式，含圆角违规检查 |
| `generate-design-tokens.mjs` | 真源同步 | `--check` 校验生成 CSS 与源同步，防止基准/派生档漂移 |
| `sync-design-showcase.mjs` | 展示一致 | `--check` 的 17 条校验含圆角快照一致性 |
| `visual-regression.mjs` | 视觉 | 22 页 × 2 视口基线，圆角变更需复核 |
| `tokens.test.ts` / `elevation-motion.test.ts` | 守卫测试 | `web/src/design-system/__tests__/` 内 12 个守卫之一，校验 `calc(var(--radius) * N)` 解析 |

> 说明：`tokens.test.ts`、`elevation-motion.test.ts` 等为 `web/src/design-system/__tests__/` 下的守卫测试文件，非门禁脚本；门禁脚本以上表所列 `.mjs` 与 npm 脚本为限。

---

## 验证状态

| 项 | 状态 | 依据 / 备注 |
|---|---|---|
| 8 档真值与 `calc` 表达式 | `NOT_VERIFIED` | 已读取 `theme.css:264-276` 核实声明，但**未在本轮执行** `check-design-tokens.mjs --strict` 复核 |
| 组件层圆角一致性（Button/Card/Modal/Input） | `NOT_VERIFIED` | 未在 65 个 `ui/` 组件上逐项核对（BASELINE-AUDIT §5 记 65 组件证据 0 VERIFIED） |
| `data-theme-radius` 缩放端到端 | `NOT_VERIFIED` | `theme-preferences.test.tsx` 存在但未在本轮运行 |
| 8 档在 showcase 的快照一致 | `NOT_VERIFIED` | 未跑 `sync-design-showcase.mjs --check` |
| 视觉回归双轨 | `NOT_EXECUTED` | BASELINE-AUDIT §14：视觉回归双轨、全量构建未执行，不得伪装 PASS |
| 平台验收（Android / iOS / HarmonyOS） | `NOT_VERIFIED` | 见 `UDS5-S12` 与 BASELINE-AUDIT §8 |

**结论**：本分册为规范声明，所有验证项均为 `NOT_VERIFIED` / `NOT_EXECUTED`，**未勾选任何测试通过或平台验收**。
