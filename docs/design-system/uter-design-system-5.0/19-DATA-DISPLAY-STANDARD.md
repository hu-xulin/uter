# 19 — 数据展示标准（DATA DISPLAY STANDARD）

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S19` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01` |
| 生效日期 | `2026-11-14` |
| 适用范围 | `web/src/components/data-table/`（24 条公开导出）、`web/src/lib/format` / `@/lib/currency`、`web/src/i18n/languages` 的 `toIntlLocale()`、`ui/badge.tsx` 族、全部含数据展示的页面模板（List / Detail / Dashboard / Analytics / Billing） |
| 验证状态 | `NOT_VERIFIED` |

> 本规范定义数据密度、表格布局、数值/货币/时间格式、状态标签、空/加载/错误/刷新/筛选/排序，以及 DataTable 的 11 项必备能力。**Clerk 官方未提供通用 Data Table 能力，本规范为 Uter 自有定义**（`CLERK-DESIGN-REFERENCE-ANALYSIS.md` §1.1 / 2.9）。本轮不修改代码、不改资金逻辑、不引入依赖、不执行 git 操作。

---

## 1. 目的与效力

1. 统一数据展示的 12 项契约，避免各 feature 各自拼装表格与格式化逻辑。
2. 固化红线：**数字/日期的 Intl 语言参数必须经 `toIntlLocale()` 转换，禁止 `zhCN` / `zhTW` 等界面语言码直接进 `Intl.*`**。
3. 把 DataTable 的 11 项能力落到 `web/src/components/data-table/` 的 24 条公开导出，明确「同一封装、不在 feature 内重拼」。
4. 与 `web/AGENTS.md` 3.1（数字格式化与 Intl 语言参数·强制）、3.3（表格复用入口）、3.9（错误处理）、3.14（测试）一致；冲突时以 `web/AGENTS.md` 为准。

---

## 2. 事实基线（可核验，禁止假设）

| 项 | 真实值 | 来源 |
|---|---|---|
| 数字格式化 | `@/lib/format` 的 `formatNumber` / `formatCompactNumber`；金额/余额/额度用 `@/lib/currency` 或业务封装，保留精度、单位与换算语义 | `web/AGENTS.md` 3.1 |
| Intl 语言参数 | `zhCN` / `zhTW` 是界面语言码，**不是合法 BCP 47 标签**；须用 `@/i18n/languages` 的 `toIntlLocale()` 转换；禁止自写映射（只处理简体中文会遗漏繁体中文） | `web/AGENTS.md` 3.1 |
| 组件订阅 | `useTranslation()` 订阅，渲染时 `const locale = toIntlLocale(i18n.resolvedLanguage \|\| i18n.language)`；不得把语言固定在模块常量或初始 state | `web/AGENTS.md` 3.1 |
| Lint 门禁 | `bun run lint` 启用 **`project/intl-locale` error**；不得 lint-disable 绕过 | `web/AGENTS.md` 3.1 |
| 回归覆盖 | `zhCN`、`zhTW`、其余五种界面语言、非法语言降级、语言切换 | `web/AGENTS.md` 3.1 |
| 7 份 locale | `en,fr,ja,ru,vi,zh-TW,zh`，合计 54,573 行 | 审计 §2 |
| 表格技术栈 | `@tanstack/react-table ^8.21.3`、`@tanstack/react-virtual` | 审计 §2 / `web/AGENTS.md` 3.4 |
| DataTable 封装 | `web/src/components/data-table/` **24 条公开导出**；`README.md` 分 `core/ layout/ toolbar/ static/ hooks/` 五子目录 | 审计 §5；已读 `README.md` |
| README | 全仓仅 `web/src/components/data-table/README.md` 1 份 | 审计 §5 |
| 状态标签 | `ui/badge.tsx` 族；E24 浅色溢价 3.76:1 / 深色折扣 3.30:1 低于 4.5:1，P1 待修 | 审计 §3.1 |
| 守卫测试 | 10 个（`web/src/design-system/__tests__/`），含 `status-badge-contrast.test.ts` | 审计 §12；Clerk 分析 2.21 |
| 图表 | `@visactor/vchart ^2.1.2` / `@visactor/react-vchart ^2.1.2` / `recharts 3.9.1`；P2「图表独立 Token 未定义」保持 Pending | 审计 §2 / §3.1 |
| 证据状态 | `VERIFIED 0 / PARTIAL 9 / NOT_VERIFIED 56`；`components:registry:strict EXIT=1` | 审计 §5 |
| **Clerk 无表格能力** | 官方组件目录无表格组件；首页「Members」「Roles & Permissions」为产品演示内容，**不是可复用表格规范** | Clerk 分析 §1.1 / 2.9 |

---

## 3. 12 项数据展示契约

| # | 主题 | 规则 | 代码落点 | 判定规则 |
|---|---|---|---|---|
| 1 | 数据密度 | 三档密度（对应 `tokens/spacing.css` 3 档覆盖）由容器统一控制；行高/内边距走 `--ds-*` 变量，禁止逐页自造 | 语义 Token + `data-table/layout/` | 密度切换不破坏对齐 |
| 2 | 表格布局 | 桌面表格 / 移动列表双形态；固定列（pinned）、溢出滚动、粘性表头由 `core/` / `layout/` 承担 | `data-table/core/` / `layout/` | 窄视口可完整操作 |
| 3 | 数值格式 | 普通/紧凑数字优先 `@/lib/format` 的 `formatNumber` / `formatCompactNumber`；不得为统一调用改变显示精度 | `web/src/lib/format` | 语言切换后格式更新 |
| 4 | 货币格式 | 设计展示基线默认 `¥`；**Uter 业务（钱包/充值/定价/账单）保留既有 USD 语义**，由业务币种字段 + `@/lib/currency` 决定，规范不改资金逻辑、不硬编码符号 | `@/lib/currency` 或业务封装 | 精度、单位、换算语义不丢失 |
| 5 | 时间格式 | 日期/时间用 `Day.js` 或 `toLocaleDateString` 等；语言参数必须 `toIntlLocale()` 转换；账期/日志时间带时区口径 | `@/i18n/languages` + 业务封装 | 7 语言格式化一致 |
| 6 | 状态标签 | `ui/badge.tsx` 族，语义色 Token；`aria-*` 与视觉一致；E24 两处对比度缺陷待修，不得勾选通过 | `ui/badge.tsx` / `status-badge-contrast.test.ts` | 对比度 ≥4.5:1（E24 除外登记） |
| 7 | 空数据 | `components/empty-state.tsx`（唯一正式封装）：图标 + 一句话 + 主行动；禁止复用 3 处同名重复实现 | `components/empty-state.tsx`；`ui/empty.tsx` | 空态必有行动入口 |
| 8 | 加载 | 首屏 Skeleton / 局部 Spinner；`aria-busy`；Reduce Motion 兼容 | `loading-state.tsx` / `ui/skeleton.tsx` | 加载不丢列结构 |
| 9 | 错误 | 局部错误给重试；路由级由 `errorComponent` 承接；失败不得渲染为「空数据」 | `error-state.tsx`；`web/AGENTS.md` §3.9 | 错误不与空态混淆 |
| 10 | 刷新 | 刷新保留筛选/排序/分页/行选状态；`invalidateQueries` 后不重置视图状态 | TanStack Query + `data-table/hooks/` | 刷新后视图状态保持 |
| 11 | 筛选 | 搜索/下拉/日期/重置归 `toolbar/`；筛选条件可组合、可清除、可回显 | `data-table/toolbar/` | 条件可清除 |
| 12 | 排序 | 单列/多列排序，表头 `aria-sort` 与视觉一致；升序/降序/无排序三态 | `data-table/core/` 的 ColumnHeader | `aria-sort` 正确 |

---

## 4. 数值 / 货币 / 时间格式（专节）

### 4.1 `Intl` 语言参数红线

| 禁止 | 必须 |
|---|---|
| `zhCN` / `zhTW` 直接进 `Intl.NumberFormat`、`toLocaleString` / `toLocaleDateString` / `toLocaleTimeString` 或公共格式化函数 | 用 `@/i18n/languages` 的 `toIntlLocale()` 转换后再传入 |
| 解构、变量别名、函数透传等任何形式绕过转换 | `const locale = toIntlLocale(i18n.resolvedLanguage \|\| i18n.language)` |
| 自行编写 `zhCN` 等语言码映射 | 只处理简体中文会遗漏繁体中文，一律用统一转换 |
| 把语言固定在模块常量或初始 state | React 组件用 `useTranslation()` 订阅，渲染时计算 |
| lint-disable 绕过 `project/intl-locale` | 修复调用点 |

> 已有封装无法表达的格式选项才可直接使用 `Intl.NumberFormat`，且**不能为统一调用方式改变数值显示精度**（`web/AGENTS.md` 3.1）。回归测试须覆盖 `zhCN`、`zhTW`、其余五种界面语言、非法语言降级与语言切换。

### 4.2 货币口径

| 项 | 口径 |
|---|---|
| 设计基线 | 展示默认以 `¥`（人民币符号）作为设计稿基线示例 |
| 业务真实语义 | Uter 为 API 网关控制台，钱包 / 充值 / 定价 / 账单沿用既有 **USD 语义**，由业务币种字段 + `@/lib/currency` 或对应业务封装决定 |
| 规范边界 | **不硬编码符号、不改资金逻辑、不改 API 契约、不改数据库结构**（审计 §6.1 红线 / §13 第 2 条）；¥ 与 USD 的差异属业务数据，不属视觉规范强制统一项 |
| 精度 | 保留精度、单位与换算语义，不得为格式统一而截断 |

### 4.3 金额与计量单位的呈现规则（业务域蓝图补充）

> 来源：业务域蓝图《Content and Microcopy Standard》§4「金额与计量单位」+《Billing Component Standard》。**本节只约束界面呈现，不改资金逻辑**（审计 §6.1 红线）。

| # | 规则 | 说明 |
|---|---|---|
| AM-1 | **必须标注计量单位**：金额标注货币单位（如 `USD` / `$`）；Token 数量标注 Token 单位；时间区间标注起止；配额 / 速率标注计量口径（如「每 1K tokens」）。 | 缺单位的数字不得单独出现 |
| AM-2 | **`1K` / `1M` 等缩写**只在有明确上下文且**不损失精度**时使用；**账单与结算信息显示完整精确值**。 | 账单 / 充值 / 定价页禁用缩写；列表页可用缩写但须提供 tooltip 精确值（tooltip 不得成为唯一关键信息来源，S13 §3.12） |
| AM-3 | **金额数值与货币单位保持视觉关联**：不得把符号与数字拆到两行或跨列。 | 与 S11 §4.1 G-4「金额列右对齐」一致 |
| AM-4 | 金额列**右对齐**并使用 **`tabular-nums`**（等宽数字），保证纵向小数点对齐。 | 与 S11 §4.1 G-4、S04 数字规范一致 |
| AM-5 | **不得**在展示层做汇率换算、税额计算、折扣计算或四舍五入；换算由服务端完成，展示层只呈现服务端给出的值与单位。 | 资金链路红线：展示层不是计算层 |
| AM-6 | **最终状态以服务端确认为准**：充值 / 退款 / 额度恢复的文案**不得**在服务端确认前宣称结果（详见 §4.4 与 S20）。 | 资金真实性红线 |
| AM-7 | 大额金额若需缩写，须同时给出**完整值**（tooltip 或展开），不得只给缩写。 | 与 AM-2 互为补充 |
| AM-8 | 配额 / 用量类数字须标注**计量口径与时间窗口**（如「近 7 天」「本月累计」），避免口径歧义。 | |

### 4.4 文案禁区：不得先行断言结果（业务域蓝图补充）

> 来源：业务域蓝图《Content and Microcopy Standard》§5「文案禁区」。**这是资金真实性红线在文案层的落地**，与既有 3.0 治理一致。

| # | 禁止文案（未获服务端确认前） | 允许的写法 | 说明 |
|---|---|---|---|
| CP-1 | 「支付成功」「充值成功」「已到账」 | 「支付处理中，正在确认」「已提交，等待确认」 | **第三方支付返回页不是支付成功的权威来源**；到账以服务端幂等入账与对账为准 |
| CP-2 | 「退款已到账」「退款成功」 | 「退款申请已提交，预计 X 个工作日到账」 | 退款以服务端退款状态机为准；部分退款与全额退款必须区分 |
| CP-3 | 「额度已恢复」「余额已退回」 | 「额度恢复处理中」 | 与 `EnforceOrgQuota` / `IncrOrgUsedQuota` 流水一致；组织级额度须显式标注组织范围 |
| CP-4 | 「密钥已撤销」「令牌已删除」 | 「撤销请求已提交」 | 撤销以服务端确认结果为准；撤销后不得再能取回明文 |
| CP-5 | 「已通过安全认证」「已获得 XX 认证」 | 展示真实的、已获授权的认证信息 | **不得展示虚假安全认证、未经证实的 SLA 或模型能力承诺** |
| CP-6 | 「保证 99.9% 可用」等未证实承诺 | 只陈述已生效的服务条款 | 未经证实的能力承诺属文案禁区 |
| CP-7 | 用省略号隐藏关键金额、对象或风险 | 完整呈现 | 蓝图 §6「不得以省略号隐藏关键金额、对象或风险」 |

### 4.5 文案长度与状态措辞（业务域蓝图补充）

| # | 规则 | 说明 |
|---|---|---|
| CW-1 | 按钮文案通常 **2–8 个汉字**（英文 1–3 词）；标题尽量简洁；错误说明优先 **1–2 句**。 | 蓝图 §6 |
| CW-2 | 长内容拆分为段落与列表，不得堆成长段落。 | 蓝图 §6 |
| CW-3 | 状态文案必须与**领域词汇表**一致，同一状态**不得**出现多种译法；蓝图建议映射：pending → 待处理 / 等待确认；processing → 处理中；success → 已完成；failed → 失败；expired → 已过期。 | 蓝图 §3；**具体译法以仓库领域词汇表为准**，蓝图映射仅作对照 |
| CW-4 | 状态文案**必须**与实际状态机一致，不得把「处理中」写成「已完成」。 | 资金真实性红线 |
| CW-5 | 术语表须覆盖中英文，且与 7 份 locale 同步；新增术语须登记 `static-keys.ts`。 | S18 §6 + `web/AGENTS.md` 3.1 |

> **仓库现状**：仓库已有 `@/lib/format` / `@/lib/currency` 数值与货币封装（S19 §4.1 / §4.2），但**是否存在统一的中英文术语表（领域词汇表）未核实**，登记为 `S19-D1`。

---

## 5. DataTable 11 项必备能力

| # | 能力 | 落点（`web/src/components/data-table/`） | 判定 |
|---|---|---|---|
| 1 | 排序 | `core/`（ColumnHeader / TanStack sorting） | `aria-sort` 三态正确 |
| 2 | 筛选 | `toolbar/` | 条件可组合/可清除/可回显 |
| 3 | 搜索 | `toolbar/` | 全局搜索与筛选协同 |
| 4 | 分页 | `core/` / `layout/` | 页码/页大小/总数一致 |
| 5 | 行选 | `core/`（selection） | 单选/全选/跨页语义明确 |
| 6 | 批量 | `layout/`（bulk actions） | 批量操作前确认、不可绕过 |
| 7 | 列可见性 | `toolbar/`（view options） | 隐藏列不影响排序/导出语义 |
| 8 | 响应式 | `layout/`（桌面表格 + 移动列表） | 窄视口完整可操作 |
| 9 | 空 | `core/`（empty states） + `components/empty-state.tsx` | 空态有主行动 |
| 10 | 加载 | `core/`（loading / skeleton） | 加载不丢列结构 |
| 11 | 错误 | `error-state.tsx` + 重试 | 错误不渲染为空态 |

### 5.1 24 条导出与五子目录（源自 `README.md`）

| 子目录 | 职责（`README.md` 原文口径） |
|---|---|
| `core/` | TanStack table 渲染原语、表头、行、分页、加载、空态、固定列行为 |
| `layout/` | 页面级响应式组合：toolbar + 桌面表格 + 移动列表 + 批量操作 + 分页位置 |
| `toolbar/` | 筛选/搜索/视图选项控件与选中操作工具栏 |
| `static/` | 本地静态数组的轻量表格渲染（无需 TanStack state） |
| `hooks/` | 表格状态与筛选 hooks |

**复用口径**：feature 代码统一从 `@/components/data-table` 导入（24 条公开导出保持稳定）；feature 专属列、操作、弹窗留在 feature 目录，只有跨 feature 复用的表格代码才进入 `data-table/`（`README.md`）。禁止在 feature 内重新拼装同一套分页/筛选/行选交互（`web/AGENTS.md` 3.3）。

### 5.2 Clerk 官方无表格能力（明确声明）

> 依据 `CLERK-DESIGN-REFERENCE-ANALYSIS.md` §1.1 与 2.9：Clerk 官方组件目录无 Data Table，四层定制仅针对身份组件；首页「Members」「Roles & Permissions」为产品演示内容，**不得描述为 Clerk 的表格规范**。本规范（含 11 项能力与 24 导出映射）**全部为 Uter 自有定义**，Decision = `Reject`。同样地，Charts / DatePicker / Timeline / Tree / Transfer / Skeleton / EmptyState 通用规范也均非 Clerk 官方能力。

---

## 6. 差异与例外登记

| 编号 | 内容 | 状态 |
|---|---|---|
| S19-D1 | 蓝图 §3 / §7 要求建立**中英文领域词汇表**；仓库有 i18n 7 份 locale 与 `static-keys.ts`，但**是否存在跨域统一术语表未核实** | `NOT_VERIFIED`（见 §4.5 CW-3 / CW-5） |
| S19-D2 | 蓝图 §4 要求金额标注计量单位、`1K`/`1M` 缩写仅在无损精度时使用、账单显示完整精确值；仓库有 `@/lib/format` / `@/lib/currency` 封装，**各调用点是否均标注单位未逐处核对** | `NOT_VERIFIED`（见 §4.3 AM-1 / AM-2） |
| S19-D3 | 蓝图 §5「文案禁区」对应仓库的资金真实性红线（最终状态以服务端确认、第三方支付返回页非权威来源）；仓库已有 `model/topup.go` 的条件状态迁移与 `controller/topup.go` 的金额校验，但**界面文案是否逐处符合 CP-1…CP-4 未逐处核对** | `NOT_VERIFIED`（见 §4.4） |
| S19-D4 | 蓝图 §3 状态译法映射（pending → 待处理 / 等待确认 等）；仓库以 i18n 键承载文案，**具体译法以仓库为准**，蓝图映射仅作对照，不构成规范值 | 已登记（对齐） |
| S19-D5 | 蓝图 §6「按钮 2–8 个汉字」的长度建议；仓库按钮文案长度**未逐处统计**，且 i18n 下英文长度口径不同（蓝图以中文字符计） | `NOT_VERIFIED`（见 §4.5 CW-1） |

---

## 与其他规范的关系

| 规范 | 关系 | 边界 |
|---|---|---|
| `UDS5-S01` | 效力来源 | 不重述总则 |
| `UDS5-S03`–`S13` | 语义 Token / 断点 / 主题 / 对比度门禁 | 数据展示只消费 Token；E24 待修登记不勾选 |
| `UDS5-S14` | J 类 Data Table 与 `VirtualTable` 补齐提案、重复 `EmptyState` 合并 | 本规范给 11 项能力细则 |
| `UDS5-S15` | 组件 API 命名与 `cva()` 扩展路径 | 表格 API 不另造平行命名 |
| `UDS5-S16` | List / Analytics / Billing 模板的 Content Area | 模板消费 DataTable |
| `UDS5-S17` | 排序/筛选/刷新交互五态 | 交互过程在 S17 |
| `UDS5-S18` | 表单输入格式、i18n 7 locale 同步 | 展示格式与输入格式共享 `toIntlLocale()` 口径 |
| `UDS5-S20` | 错误 / 加载 / 空态的反馈组件映射 | 提示归属在 S20 |
| `web/AGENTS.md` | **强制**：3.1 Intl 语言参数、3.3 表格复用、3.9 错误处理、3.14 测试 | 冲突时以 `web/AGENTS.md` 为准 |
| `CLERK-DESIGN-REFERENCE-ANALYSIS.md` | §1.1 / 2.9 明确官方无表格能力 | 不得归为 Clerk 规范 |

---

## 代码实施位置

| 用途 | 真实路径 | 本轮动作 |
|---|---|---|
| DataTable 封装 | `web/src/components/data-table/`（24 导出，`core/ layout/ toolbar/ static/ hooks/`） | **只读** |
| DataTable 文档 | `web/src/components/data-table/README.md` | **只读**（事实来源） |
| 数字格式化 | `web/src/lib/format`（`formatNumber` / `formatCompactNumber`） | **只读** |
| 货币格式化 | `@/lib/currency` 或对应业务封装 | **只读**，不改资金逻辑 |
| 语言转换 | `web/src/i18n/languages` 的 `toIntlLocale()` | **只读** |
| 7 份 locale | `web/src/i18n/locales/{en,fr,ja,ru,vi,zh-TW,zh}.json` | **只读** |
| 状态标签 | `web/src/components/ui/badge.tsx` 族 | **只读** |
| 空/加载/错误态 | `web/src/components/empty-state.tsx` / `loading-state.tsx` / `error-state.tsx` | **只读** |
| 守卫测试 | `web/src/design-system/__tests__/`（含 `status-badge-contrast.test.ts`） | **只读** |
| 规范输出 | `docs/design-system/uter-design-system-5.0/19-DATA-DISPLAY-STANDARD.md` | **本文件（新建）** |

> 未列出的脚本、路径、测试结果不出现在本规范中；不宣称已运行 lint / 门禁 / 构建。

---

## 自动化验证

| 验证项 | 真实命令 / 门禁 | 基线结果 | 本规范状态 |
|---|---|---|---|
| Intl 语言参数 lint | `bun run lint`（`project/intl-locale` error） | 本轮未运行 | `NOT_VERIFIED` |
| 对比度门禁 | `verify-contrast.mjs` | 31 PASS / 0 FAIL（引用审计 §4.4）；**E24 两处仍待修** | 未重跑 |
| 设计 Token 门禁 | `check-design-tokens.mjs --strict` | 违规 0 / EXIT=0（引用审计 §4.4） | 未重跑 |
| 注册表证据 | `components:registry:strict` | **`EXIT=1`**，`VERIFIED 0 / PARTIAL 9 / NOT_VERIFIED 56` | 未重跑 |
| 11 项能力覆盖 | 无现成统一脚本 | 不可判定 | `NOT_VERIFIED` |
| 7 语言格式化回归 | 无现成统一脚本（依赖 `*.test.ts(x)`） | 未重跑 | `NOT_VERIFIED` |
| 全量构建 | `bun run build:check` 等 | 并发 WIP 211 项，审计标 `NOT_EXECUTED` | **不执行** |

---

## 验证状态

| 项 | 状态 | 说明 |
|---|---|---|
| 本规范文本 | `ACTIVE` | 已撰写，供评审 |
| 12 项数据展示契约 / 11 项 DataTable 能力 | `NOT_VERIFIED` | 规范层定义，未跑门禁或测试 |
| `toIntlLocale()` 全量合规 | `NOT_VERIFIED` | 未跑 `project/intl-locale` lint |
| 货币 ¥ 基线 / USD 业务语义 | `NOT_VERIFIED` | 口径声明，资金逻辑零改动 |
| E24 对比度缺陷 | `NOT_VERIFIED` | 3.76:1 / 3.30:1 待修，P1，不得勾选通过 |
| P2 图表独立 Token | `NOT_VERIFIED` | 保持 Pending（审计 §3.1） |
| 65 个组件证据 | `NOT_VERIFIED` | `VERIFIED 0 / PARTIAL 9 / NOT_VERIFIED 56`，`components:registry:strict EXIT=1` |
| 全量构建 / 视觉回归 / E2E | `NOT_EXECUTED` | 审计 §1 / §7 / §13 / §14 约束 |
| Android / iOS / HarmonyOS | `NOT_VERIFIED` | 无真实实现（审计 §8、结论 C） |

> **最终状态低于 `FULLY_IMPLEMENTED_AND_VERIFIED`**：本规范为 Uter 自有定义，不宣称任何数据展示行为已通过验证。
