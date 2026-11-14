# 12 · 响应式规范（Responsive Standard）

> UTER Design System 5.0 · 分册 S12。本规范定义五档断点、Compact Mobile / Large Screen 两端策略、各平台真实支持结论。**最重要的口径：Android / iOS / HarmonyOS 无任何原生实现，依据 BASELINE-AUDIT §8 一律标记 `NOT_VERIFIED`，不得伪造 PASS**。**5.0 为当前唯一正式体系，3.0 保留为历史**，本文引用 3.0 §16 仅用于溯源。除标明已核实的真源代码位置外，未宣称任何测试通过或平台验收。

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S12` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01`（UTER Design System 5.0 总纲） |
| 生效日期 | `2026-11-14` |
| 适用范围 | `web/` 全部路由与组件、H5 响应式分支、`showcase.html` 断点区（第 23 区）；平台支持结论以 BASELINE-AUDIT §8 为准 |
| 验证状态 | `NOT_VERIFIED` |

---

## 1. 总则与不可达项声明

| 编号 | 原则 | 说明 |
|---|---|---|
| P-1 | 响应式不是缩小 | **不能仅靠缩小 PC 页面实现移动端**（3.0 §16.4 / 用户 PART 12）。 |
| P-2 | 五档断点 | 断点固定为 `sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536`，不新增、不改值。 |
| P-3 | 同一套代码 | H5 是 `web/` 同一套代码的响应式分支，**非独立工程**（BASELINE-AUDIT §8）。 |
| P-4 | 如实标记 | 某平台无真实实现或可用测试环境，必须标 `NOT_VERIFIED`，**不能伪造 PASS**（PART 12.6）。 |
| P-5 | 五平台口径 | 五平台 = PC Web / H5 / Android / iOS / HarmonyOS；Electron 桌面封装存在但**不属五平台**。 |
| P-6 | 最终状态受限 | 因 3 个平台不可验证，5.0 最终状态**不可能**为 `FULLY_IMPLEMENTED_AND_VERIFIED`（BASELINE-AUDIT §9 D4、§14 结论 C）。 |
| P-7 | 品牌基线不动 | 1280px / 1800px、5 档断点、H5 输入 ≥16px、24/44px 命中区属 3.0 已定案基线，5.0 继承。 |

---

## 2. 五档断点（真实值）

真源 3.0 §16.1（`UTER-DESIGN-SYSTEM-3.0.md:2257-2265`），BASELINE-AUDIT §8 H5 证据复核：

| Token | 宽度 | 典型设备 / 语义 |
|---|---:|---|
| `sm` | 640px | Compact Mobile 上界 / 大屏手机横屏 |
| `md` | 768px | 平板竖屏转横屏、Sidebar 开始常驻、指标数值放大分界 |
| `lg` | 1024px | 小桌面 / 平板横屏 |
| `xl` | 1280px | 后台内容区上限（S11） |
| `2xl` | 1536px | Large Screen 起点（1440/1920 营销宽屏） |

| 规则 | 内容 |
|---|---|
| 全宽度可用 | 全部页面必须在不同宽度下正确工作（3.0 §16.1:2267）。 |
| 指标数值缩放 | 指标数值统一 `text-2xl md:text-3xl`（24→30px，768px 起放大），**禁止 `text-2xl sm:text-3xl`**：`sm` 在 640–768px 会把数字放大到 30px 压过标题（3.0 §16.2:2299-2303）。 |
| 断点作用域 | 断点只用于布局与可见性，不得用于改变圆角档（S06）、字号阶梯（S04）或主题维度（S10）。 |

---

## 2.1 断点对照：业务域蓝图建议 vs 仓库五档（差异登记）

> 来源：业务域蓝图《Responsive Standard》§1。**仓库五档断点为 3.0 §16.1 已定案基线，不改值**；此处只做逐档对照并登记差异。

| 蓝图 Token | 蓝图 Min width | 蓝图目标 | 仓库对应 | 仓库宽度 | 判定 |
|---|---:|---|---|---:|---|
| `bp.xs` | 0px | 小屏手机 | **无对应档** | — | **仓库缺口**：仓库最小档为 `sm 640`，`<640px` 属「Compact Mobile」区间但无独立断点档 |
| `bp.sm` | 480px | 大屏手机 / 横屏 | `sm` | **640px** | **冲突**：仓库 `sm` 上界比蓝图高 160px；仓库 480–639px 落入 Compact Mobile（`<640px`）区间 |
| `bp.md` | 768px | 平板 | `md` | **768px** | **完全一致** ✓ |
| `bp.lg` | 1024px | 小桌面 | `lg` | **1024px** | **完全一致** ✓ |
| `bp.xl` | 1280px | 桌面 | `xl` | **1280px** | **完全一致** ✓ |
| `bp.2xl` | 1440px | 宽屏 | `2xl` | **1536px** | **冲突**：仓库 `2xl` 比蓝图高 96px（1440–1535px 在仓库属 `xl` 区间） |

**裁决与影响**

| 项 | 结论 |
|---|---|
| 处置 | **保留仓库五档**。3.0 §16.1 已定案且 P-2 明确「不新增、不改值」。 |
| `bp.sm` 差异影响 | 仓库 `sm` 语义为「Compact Mobile 上界 / 大屏手机横屏」。蓝图把 480px 作为独立档，仓库把 480–639px 归入 Compact Mobile 的「小屏手机」——**两者的设备语义一致，仅分界点不同**，影响面限于 `sm:` 前缀样式的生效区间。 |
| `bp.2xl` 差异影响 | 仓库 `2xl = 1536px` 的语义是「Large Screen 起点（1440/1920 营销宽屏）」（§2 表）。蓝图 `1440px` 对应的是仓库的 `xl`（1280–1535）上段。**营销页在 1440 屏仍须走 `xl` 档**，不得因蓝图数值而在 1440px 触发 `2xl:` 分支。 |
| 蓝图「不得为适配设备型号增加大量设备专属断点」 | **与仓库 P-2 一致**，采纳为既有原则，无冲突。 |
| 蓝图「断点按内容需要使用」 | 仓库五档即为内容驱动（Sidebar 常驻 768、指标放大 768、内容上限 1280、营销突破 1536），一致 ✓ |

## 2.2 导航尺寸对照（蓝图 §3）

| 项 | 蓝图建议 | 运行时真值 | 真源 | 判定 |
|---|---|---|---|---|
| Desktop sidebar（展开） | 240px | **220px**（`13.75rem`） | `web/src/components/ui/sidebar.tsx:50` | **冲突**（已由 S11 §4.2 / `S11-D8` 登记，本文不重复裁决） |
| Desktop sidebar（折叠） | 72px | **44px**（`2.75rem`） | `sidebar.tsx:52` | **冲突**（同上） |
| Desktop topbar | 64px | **48px**（`3rem`） | `web/src/styles/theme.css:277` `--app-header-height` | **冲突**（同上） |
| Mobile topbar | 56px | **48px**（未按断点分档） | `theme.css:277` | **冲突**（同上） |

> 结论：与 `UDS5-S11` §4.2 一致，**保留仓库真值**；蓝图数值不采纳。移动端导航须保证**当前页面位置与返回路径清晰**（蓝图 §3），该条**采纳**（与 §4 变换 2「提供等价可达入口」一致）。

---

## 3. Compact Mobile / Large Screen

### 3.1 Compact Mobile（< 640px）

| 项 | 规定 | 依据 |
|---|---|---|
| 基线视口 | mobile 390×844 × 22 张视觉基线 | BASELINE-AUDIT §8 |
| Gutter | 默认左右 16px | 3.0 §16.3 |
| 横向溢出 | 页面不能出现非预期横向溢出 | 3.0 §16.3 |
| 卡片 | 必须自适应 | 3.0 §16.3 |
| 输入 | 文本默认 **≥16px**（防 iOS 缩放） | 3.0 §16.3 / 品牌基线 |
| 命中区 | 重要操作 ≥44×44px；触控最小 24px | 3.0 §15.3 / S13 |
| 表格 | 横向滚动 / 转卡片 / 隐藏非核心列 | 3.0 §16.3 / §4 |
| Sidebar | 桌面 Sidebar 必须转换为适合移动端的导航方式 | 3.0 §16.3 / §4 |
| Dialog | 必须适配移动端，不得出现无法操作的弹窗 | 3.0 §16.3 / §16.4 |
| 支付分支 | `detectPayClient()` 按 UA 判定支付客户端 | BASELINE-AUDIT §8 H5 证据 |

### 3.2 Large Screen（≥ 1536px）

| 项 | 规定 |
|---|---|
| 后台 | 内容区仍限 1280px（S11），不随大屏无限拉伸 |
| 营销 | 允许突破 1280px，上限 1800px（`--ds-content-max-wide`，S11 §6.1） |
| 多列 | 首屏主视觉与多列价格卡在 1440/1920 屏按营销宽屏展示 |
| 三栏文档 | 外壳 `max-w-[1440px]`，正文仍限 `max-w-3xl`（3.0 §16.2:2295） |
| 禁止 | 把三栏总宽 1440px 当成内容区破例 |

---

## 4. 关键响应式变换（明令）

| # | 变换 | 规定 | 禁止 |
|---:|---|---|---|
| 1 | 表格 | 横向滚动 / 转卡片 / 隐藏非核心列三选一，核心数据不得丢失 | 固定桌面宽度导致 H5 横向溢出 |
| 2 | Sidebar | 转移动导航（抽屉 / 底部导航 / 汉堡菜单），提供等价可达入口 | 简单隐藏 Sidebar 而不给替代 |
| 3 | 输入 | ≥16px、易触控、Dialog 内不缩放 | 缩小字号低于规定值解决布局 |
| 4 | 组件 | 按断点重排，不是整体等比缩小 | 「简单缩小所有组件」 |
| 5 | 操作 | 重要操作保留，隐藏须提供替代入口 | 隐藏重要操作而不提供替代 |
| 6 | 弹窗 | 移动端适配、不超可视区 | 小屏中出现无法操作的弹窗 |
| 7 | 页面 | PC Web 与 H5 各自正确工作 | 仅靠缩小 PC 页面实现移动端 |

> 以上禁止项逐条对应 3.0 §16.4（`:2317-2323`）。

### 4.1 窄屏表格策略：禁止静默隐藏（业务域蓝图补充）

> 来源：业务域蓝图《Responsive Standard》§4。

| # | 规则 | 说明 |
|---|---|---|
| RT-1 | 窄屏优先采用：**列优先级**（保留核心列，其余降级）→ **横向滚动** → **行详情** → **卡片化视图**。 | 蓝图 §4 |
| RT-2 | **禁止静默隐藏**金额、状态、关键 ID、主要操作。 | 蓝图 §4（硬约束） |
| RT-3 | 隐藏非核心列时，**必须**提供该信息的替代可达路径（行详情 / 展开行 / 卡片视图），不得直接消失。 | 与 §4 变换 5「隐藏须提供替代入口」一致 |
| RT-4 | 横向滚动容器须**可被键盘访问**并提供**可感知提示**（如边缘渐隐 + `aria-label`），不得只靠鼠标拖拽。 | 蓝图 §4 |
| RT-5 | 表格横向滚动 / 转卡片 / 隐藏非核心列三选一，**核心数据不得丢失**。 | §4 变换 1（既有） |

### 4.2 安全区与软键盘（业务域蓝图补充）

> 来源：业务域蓝图《Responsive Standard》§6。

| # | 规则 | 状态 |
|---|---|---|
| SF-1 | 移动端须考虑**刘海、圆角屏、底部 Home Indicator**（`env(safe-area-inset-*)`）。 | `NOT_VERIFIED`（未核实仓库是否使用 `env(safe-area-inset-*)`）；登记为 `S12-D6` |
| SF-2 | **软键盘**弹出不得遮挡当前输入框与错误提示。 | `NOT_VERIFIED`；登记为 `S12-D7` |
| SF-3 | **固定底部操作栏不得遮挡**输入框、错误提示或**最后一个表单字段**。 | `NOT_VERIFIED`；登记为 `S12-D7` |
| SF-4 | 移动端表单输入控件宽度默认 **100%**；按钮触控目标建议 ≥44px；提交失败时提供**错误汇总定位**。 | 前两项与 §3.1 / S13 §3.10 一致；错误汇总定位与 S18 §3.1 V-3「聚焦首个错误字段」一致 |

### 4.3 验收视口矩阵（蓝图 §7 vs 仓库现状）

| 视口 | 蓝图要求 | 仓库视觉回归 | 状态 |
|---|---:|---|---|
| 360×800 | ✅ 要求 | ❌ 未覆盖 | `NOT_EXECUTED` |
| 390×844 | ✅ 要求 | ✅ `scripts/visual-regression.mjs:24`（mobile） | 已覆盖 |
| 480×900 | ✅ 要求 | ❌ 未覆盖 | `NOT_EXECUTED` |
| 768×1024 | ✅ 要求 | ❌ 未覆盖 | `NOT_EXECUTED` |
| 1024×768 | ✅ 要求 | ❌ 未覆盖 | `NOT_EXECUTED` |
| 1280×800 | ✅ 要求 | ❌ 未覆盖 | `NOT_EXECUTED` |
| 1440×900 | ✅ 要求 | ✅ `scripts/visual-regression.mjs:23`（desktop） | 已覆盖 |
| 1920×1080 | ✅ 要求 | ❌ 未覆盖（营销宽屏 1800px 上限仅在 1440 屏间接体现） | `NOT_EXECUTED` |

**覆盖结论**：仓库视觉回归为 **2 视口 / 22 页 = 44 张基线**，蓝图要求 **8 视口**。缺口 6 档登记为 `S12-D8`（治理候选：扩矩阵会成倍增加基线维护成本，须由设计侧决定采样策略）。**本轮未扩展视口矩阵，不得宣称已覆盖 8 视口。**

---

## 5. PC Web（平台结论 1/5）

| 字段 | 内容 |
|---|---|
| 真实实现 | ✅ 有 | 
| 证据 | `web/` 完整工程；CI `frontend` job（BASELINE-AUDIT §7）；desktop **1440×900 × 22 张基线** |
| 断点 | `lg 1024` / `xl 1280` / `2xl 1536` 为主；后台 1280px、营销 1800px |
| 结论 | 结构自洽、已有视觉基线 | 
| 未覆盖 | 73 路由中仅 22 页有视觉基线；`system-settings/*` 18 路由、`*/$section` 动态段、`usage-logs/audit` 等未覆盖（BASELINE-AUDIT §6） |
| 验证状态 | `NOT_VERIFIED`（`test:visual` / `test:visual:e2e` 本轮 `NOT_EXECUTED`） |

PC Web 具体约束（3.0 §16.2）：

| 项 | 规定 |
|---|---|
| 内容拉伸 | 页面内容不得无限拉伸，主要内容区有合理最大宽度 |
| Sidebar / Main | 关系保持稳定 |
| 表格 | 必须有合理的最小宽度或自适应策略 |
| 弹窗 | 不得超出可视区域 |

---

## 6. H5（平台结论 2/5）

| 字段 | 内容 |
|---|---|
| 真实实现 | ✅ 有（**同一套代码的响应式分支，非独立工程**） |
| 证据 | 3.0 §16（`:2255-2323`）五档断点；mobile **390×844 × 22 张基线**；`detectPayClient()` UA 判定 |
| 断点 | `sm 640` / `md 768` 为主（Compact Mobile） |
| 关键约束 | 输入 ≥16px、Gutter 16px、表格转卡片/横滚、Sidebar 转移动导航、44px 命中区 |
| 结论 | 响应式分支存在，但「不能仅靠缩小 PC 页面」须按 §4 逐项复核 |
| 验证状态 | `NOT_VERIFIED`（视觉回归双轨本轮 `NOT_EXECUTED`） |

---

## 7. Android / iOS / HarmonyOS（平台结论 3/5、4/5、5/5）—— 无任何原生实现

> **本节依据 BASELINE-AUDIT §8（决定最终状态的关键事实）逐字落地，是本分册最重要的结论。**

| 平台 | 真实实现 | BASELINE-AUDIT §8 证据 | 5.0 结论 |
|---|:--:|---|---|
| Android | ❌ | 无 `android/`、无 `*.kt` / `*.java`、无 Capacitor / Flutter / RN / uni-app | `NOT_VERIFIED` |
| iOS | ❌ | 无 `ios/`、无 `*.swift` / `*.m` / `*.mm` | `NOT_VERIFIED` |
| HarmonyOS | ❌ | 无 `harmony/`；仅 `web/src/features/wallet/lib/payment.ts:224` 的 **UA 正则字面量**（不构成平台实现） | `NOT_VERIFIED` |

| 补充事实 | 内容 |
|---|---|
| 全仓计数 | `*.kt / *.swift / *.java / *.m / *.mm` 计数 **0**（BASELINE-AUDIT §8:233） |
| 逻辑冲突 | 用户 PART 12.6 要求 5 平台分别验证；PART 13 要求「所有适用平台完成验证」才可 `FULLY_IMPLEMENTED_AND_VERIFIED`——与仓库事实构成**不可消除的逻辑冲突**（BASELINE-AUDIT §9 D4）。 |
| 决策 | **Reject（不可达）→ 如实标记**：三平台必须标 `NOT_VERIFIED`，**不得伪造 PASS**。 |
| 最终状态 | 因此 5.0 最终状态**必须低于** `FULLY_IMPLEMENTED_AND_VERIFIED`，并在验收报告中逐条列出未通过项（BASELINE-AUDIT §14 结论 C）。 |
| HarmonyOS 特别注意 | 「UA 正则字面量」只说明支付页能识别鸿蒙 UA，**不等于存在鸿蒙原生实现或可用测试环境**，不得据此勾选通过。 |

### 7.1 Electron 桌面封装（补充，不属五平台）

| 字段 | 内容 |
|---|---|
| 真实实现 | ✅ 有（补充项） |
| 证据 | `electron/`（Electron `42.11.18`），复用同一 `web/dist`（`electron/package.json:2-29`、`electron/main.js:1`） |
| 口径 | **不属 PC Web / H5 / Android / iOS / HarmonyOS 五平台**，不参与五平台验收计数；复用 Web 产物，断点与 H5/PC Web 同源 |
| 验证状态 | `NOT_VERIFIED`（未在本轮对桌面封装做独立验收） |

---

## 8. 五平台结论汇总（禁止勾选通过）

| 平台 | 实现 | 断点 / 视口 | 证据 | 验证状态 |
|---|:--:|---|---|---|
| PC Web | ✅ | 1440×900 / lg-xl-2xl | `web/` + CI + 22 张基线 | `NOT_VERIFIED` |
| H5 | ✅（响应式分支） | 390×844 / sm-md | 3.0 §16 + 22 张基线 + `detectPayClient()` | `NOT_VERIFIED` |
| Android | ❌ | 无 | 无 `android/`、无原生源码 | `NOT_VERIFIED` |
| iOS | ❌ | 无 | 无 `ios/`、无原生源码 | `NOT_VERIFIED` |
| HarmonyOS | ❌ | 无 | 无 `harmony/`，仅 UA 正则字面量 | `NOT_VERIFIED` |
| Electron（补充） | ✅ | 复用 web/dist | `electron/` | `NOT_VERIFIED`（不属五平台） |

> **可验证 2（PC Web / H5）、不可验证 3（Android / iOS / HarmonyOS）**（BASELINE-AUDIT §12）。三平台无实现 → 本轮**不得**标记为 PASS、`FULLY_IMPLEMENTED_AND_VERIFIED` 或任何等价验收态。

---

## 9. 禁止事项汇总

1. 禁止仅靠缩小 PC 页面实现移动端（P-1）。
2. 禁止固定桌面宽度导致 H5 横向溢出、禁止简单缩小所有组件。
3. 禁止隐藏重要操作而不提供替代入口、禁止缩小字号低于规定值解决布局。
4. 禁止在小屏中出现无法操作的弹窗。
5. 禁止把 `sm` 用作指标数值放大断点（应用 `md`）。
6. 禁止因 HarmonyOS 存在 UA 正则字面量就宣称有原生实现。
7. 禁止把 Electron 桌面封装计入五平台验收、或用它替代 Android/iOS 结论。
8. 禁止伪造 PASS 或勾选 `FULLY_IMPLEMENTED_AND_VERIFIED`（P-4 / P-6）。

---

## 10. 差异与例外登记

| 编号 | 内容 | 状态 |
|---|---|---|
| S12-D1 | 三平台无实现与 PART 13 全平台通过条件的逻辑冲突（D4） | 已按 §7 如实标记，`NOT_VERIFIED` |
| S12-D2 | `web/e2e/visual/` 像素基线依赖本机字体渲染与 GPU 合成，刻意不接 CI（BASELINE-AUDIT §7） | `NOT_EXECUTED` |
| S12-D3 | `system-settings/*` 18 路由、`*/$section` 动态段等无视觉基线覆盖 | `NOT_VERIFIED` |
| S12-D4 | showcase 区域 23 `breakpoints`、24 `token-layers` 的锚点未覆盖（BASELINE-AUDIT §5.1） | `NOT_VERIFIED` |
| S12-D5 | H5 支付 UA 判定 `detectPayClient()` 未在真机复核 | `NOT_VERIFIED` |
| S12-D6 | 蓝图 §6 要求移动端考虑刘海 / 圆角屏 / Home Indicator，仓库是否使用 `env(safe-area-inset-*)` 未核实 | `NOT_VERIFIED`（见 §4.2 SF-1） |
| S12-D7 | 蓝图 §6 要求软键盘 / 固定底部操作栏不得遮挡输入框与最后一个表单字段，仓库未核实 | `NOT_VERIFIED`（见 §4.2 SF-2 / SF-3） |
| S12-D8 | 蓝图 §7 要求 8 视口验收，仓库视觉回归仅 **2 视口**（1440×900 / 390×844），缺 6 档 | **治理候选**（见 §4.3；扩矩阵属运行时 / 基线维护改动，本轮不执行） |
| S12-D9 | 蓝图断点 `bp.sm 480` / `bp.2xl 1440` ↔ 仓库 `sm 640` / `2xl 1536` | 已登记（**保留仓库真值**，见 §2.1） |
| S12-D10 | 蓝图导航尺寸 240 / 72 / 64 / 56px ↔ 仓库 220 / 44 / 48 / 48px | 已登记（**保留仓库真值**，与 `UDS5-S11` §4.2 / `S11-D8` 同源，本文不重复裁决） |

---

## 与其他规范的关系

| 规范 | 关系 | 边界 |
|---|---|---|
| `UDS5-S01`（总纲） | 上级 | 5.0 效力、最终状态治理 |
| `UDS5-S04`（Typography） | 约束 | H5 输入 ≥16px、最小 12px、禁止缩字号破布局 |
| `UDS5-S05`（Spacing） | 依赖 | Gutter 16px、4px 阶梯 |
| `UDS5-S06`（Radius） | 约束 | 断点切换不得改变圆角档 |
| `UDS5-S10`（Theme） | 约束 | 主题切换不改变断点行为 |
| `UDS5-S11`（Layout） | 依赖 | 1280/1800px、App Shell、Sidebar / 表格策略 |
| `UDS5-S13`（Accessibility） | 依赖 | 24px 最小 / 44px 推荐命中区、缩放与动态文本 |
| `UDS5-S14`（Component） | 落地 | Dialog / 表格 / 卡片在小屏的表现 |
| 3.0 §16 / §16.4 / BASELINE-AUDIT §8 | 历史 / 事实源 | 3.0 保留为历史；平台结论以 BASELINE-AUDIT §8 为准 |

---

## 代码实施位置

| 路径 | 职责 |
|---|---|
| `web/src/routes/` | 73 个路由源码，响应式分支落点 |
| `web/src/components/layout/` | App Shell / Sidebar / Header（S11），Sidebar 转移动导航的实现根 |
| `web/src/features/wallet/lib/payment.ts:224` | HarmonyOS UA 正则字面量（非平台实现） |
| `web/src/styles/theme.css:277` | `--app-header-height: 3rem`（Sticky Header） |
| `web/src/design-system/tokens/spacing.css` | 密度 / Gutter 相关间距 |
| `web/src/design-system/__tests__/` | 11 个守卫测试（断点相关守卫） |
| `web/e2e/visual/` | 22 页 × 2 视口（1440×900 / 390×844）共 44 张 PNG |
| `web/playwright` 配置 `web/e2e/visual/playwright.config.ts` | 注释明确「刻意不接 CI」 |
| `electron/` | 桌面封装（补充，不属五平台） |
| `docs/design-system/showcase.html` | 区域 23 `breakpoints` / 24 `token-layers` |
| `web/scripts/visual-regression.mjs` | 视觉回归脚本 |
| `web/scripts/check-design-tokens.mjs` | T1–T17（T16 最小字号、T17 间距） |

---

## 自动化验证

| 脚本 / npm 脚本 | 关联 | 说明 |
|---|---|---|
| `visual-regression.mjs` / `test:visual` | 视觉 | 22 页 × 2 视口（desktop 1440×900 / mobile 390×844）基线 |
| `test:visual:e2e` | E2E | 视觉 E2E 轨（BASELINE-AUDIT §7：刻意不接 CI，需完整服务栈） |
| `test:axe`（`axe-audit.mjs`） | 无障碍 | 小屏命中区 / 动态文本 / 焦点不遮挡（S13 引用） |
| `check-design-tokens.mjs` | T16 / T17 | 守最小字号 12px 与 4px 间距阶梯，防「缩字号破布局」 |
| `sync-design-showcase.mjs`（`design:showcase:check`） | 展示一致 | `--check` 17 条校验含断点快照；区域 23/24 锚点缺失见 S12-D4 |
| `lint:design:strict` | 门禁 | CI 唯一阻断模式 |
| `check-component-registry.mjs` | 组件注册 | 65 组件在小屏的状态完整性 |

> 说明：以上为真实脚本名 / npm 脚本；守卫测试文件位于 `web/src/design-system/__tests__/`，非门禁脚本。

---

## 验证状态

| 项 | 状态 | 依据 / 备注 |
|---|---|---|
| 五档断点真值 | `NOT_VERIFIED` | 已读取 3.0 §16.1 核实，本轮未跑断点相关守卫 |
| PC Web（1440×900）布局 | `NOT_VERIFIED` | `test:visual` 本轮 `NOT_EXECUTED`（BASELINE-AUDIT §14） |
| H5（390×844）布局与变换 | `NOT_VERIFIED` | 视觉回归双轨未执行，不继承既有基线为通过 |
| 表格 / Sidebar / Dialog / 输入 ≥16px 变换 | `NOT_VERIFIED` | 未逐路由核对（BASELINE-AUDIT §6：仅 22 页有基线） |
| **Android** | `NOT_VERIFIED` | **无任何原生实现**（BASELINE-AUDIT §8），不得伪造 PASS |
| **iOS** | `NOT_VERIFIED` | **无任何原生实现**（BASELINE-AUDIT §8），不得伪造 PASS |
| **HarmonyOS** | `NOT_VERIFIED` | **无原生实现**，仅 UA 正则字面量（BASELINE-AUDIT §8），不得伪造 PASS |
| Electron 桌面封装 | `NOT_VERIFIED` | 补充项，不属五平台，未独立验收 |
| `test:axe` / `test:visual:e2e` / 全量构建 | `NOT_EXECUTED` | BASELINE-AUDIT §14 明确未执行 |
| 最终状态 | **低于 `FULLY_IMPLEMENTED_AND_VERIFIED`** | 三平台不可验证（D4 / 结论 C） |

**结论**：本分册为规范声明。可验证平台 2 个、不可验证平台 3 个；**所有验证项均为 `NOT_VERIFIED` / `NOT_EXECUTED`，未勾选任何测试通过或平台验收，未宣称 `FULLY_IMPLEMENTED_AND_VERIFIED`**。
