# 17 — 交互标准（INTERACTION STANDARD）

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S17` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01` |
| 生效日期 | `2026-11-14` |
| 适用范围 | `web/src/components/ui/`（交互基础组件）、浮层组件（`ui/dialog.tsx` / `alert-dialog.tsx` / `popover.tsx` / `hover-card.tsx`）、`web/src/components/` 业务封装、全部 73 个路由页面 |
| 验证状态 | `NOT_VERIFIED` |

> 本规范定义 15 种交互在「成功 / 失败 / 取消 / 加载 / 异常」五态下的行为契约，以及焦点环、hover Token、嵌套浮层外观作用域三条硬约束。本轮不修改任何代码、不引入依赖（含 Clerk SDK）、不执行 git 操作。

---

## 1. 目的与效力

1. 把「状态必须显式定义」的原则（Clerk 参考分析 2.7 Buttons，官方示例同时写 hover/focus/active 三态）落到 Uter 的 15 种交互 × 五态矩阵。
2. 固化三条不可绕过红线：**2px 焦点环（`ring-2`，已裁决）**、**hover 必须走 `*-hover` Token（T14 禁止 `hover:bg-X/NN`）**、**嵌套浮层外观作用域边界**。
3. 与 `UDS5-S14` §6「组件状态矩阵」互补：S14 定义状态「存在性」，本规范定义交互「过程」。
4. 参考 Clerk 的分层定制与浮层作用域理念，但**不引入** `appearance` 对象、`cl-*` 类体系或任何 Clerk SDK（审计 §9 D8 / §13 第 3 条）。

---

## 2. 事实基线（引自审计报告与参考分析，不得假设）

| 项 | 真实值 | 来源 |
|---|---|---|
| 焦点环红线 | **2px 焦点环（`ring-2`，已裁决）**；H5 输入 ≥16px 防 iOS 缩放 | `UDS5-S13` §7（2026-11-14 裁决为 2px，`--ds-focus-ring-width: 2px`），与 `ui/button.tsx:31` 的 `focus-visible:ring-2` 一致；装饰性 `ring-1` 描边 1px 为独立保留值，不承载焦点语义 |
| Button 现状 | `ui/button.tsx:31` 基类为 `focus-visible:ring-2`，`focus-visible:border-ring`；`:52` destructive 有 `focus-visible:ring-destructive/20` | 已读 `ui/button.tsx`，与 §6 裁决的 2px 焦点环口径一致，无遗留差距（装饰性 `ring-1` 描边 1px 为独立保留值，见 `UDS5-S07`） |
| Hover Token | `bg-primary-hover` / `bg-secondary-hover` / `bg-destructive-subtle-hover` 等专用 `*-hover` Token | `ui/button.tsx:44-55`、Clerk 分析 2.12 |
| T14 禁令 | **禁止 `hover:bg-X/NN` 透明度凑态**；浅色底会泛白而非变深 | `ui/button.tsx:41-43` 注释、审计 §11.1、Clerk 分析 2.12 |
| Disabled 禁令 | 禁止仅依赖 `opacity`，须底色 + 文字双重信号（3.0 §10.5） | `ui/button.tsx:34-37` |
| 命中区 | WCAG 2.2 AA 2.5.8：24×24 下限；H5 推荐 44px；`.ds-touch-target` 扩展命中区不改盒子 | `ui/button.tsx:86-89`、Clerk 分析 2.20 |
| 动效 | `web/src/design-system/foundations/motion.css` 7 个 `ds-motion-*` utility；`foundations/accessibility.css` | Clerk 分析 2.15 / 2.21 |
| 浮层组件 | `ui/dialog.tsx` / `alert-dialog.tsx` / `popover.tsx` / `hover-card.tsx`；`components/dialog.tsx` / `confirm-dialog.tsx` | Clerk 分析 2.11 / 2.13 |
| 浮层作用域理念 | 顶层 `appearance` 只作用于接收它的组件；「组件打开另一个组件」须经 `userProfileProps.appearance` 等专用 prop 传递外观 | Clerk 分析 2.3 / 2.11 / 2.13 |
| 错误处理归属 | 拦截器不弹 Toast；Query/Mutation 最终失败由 `createAppQueryClient` 提示；Mutation 自定义 `onError` 负责自己的提示；`meta.errorToast: false` 关闭自动提示；自动重试与主动取消不报错 | `web/AGENTS.md` §3.9 |
| 证据状态 | `VERIFIED 0 / PARTIAL 9 / NOT_VERIFIED 56`；`components:registry:strict EXIT=1` | 审计 §5 |
| 门禁 | T1–T17 静态扫描；`ALLOWLIST=[]`；`--strict` 唯一阻断模式 | 审计 §11.1 |

---

## 3. 五态通用定义

| 态 | 定义 | UI 通则 | 反馈通道 |
|---|---|---|---|
| 成功 | 动作完成且达到预期结果 | 结果可见、可访问名称稳定；成功态有独立视觉信号 | `toast.success` / 内联成功提示（`UDS5-S20`） |
| 失败 | 动作已执行但未达预期（可恢复） | 保留用户已输入内容；就近给出原因与重试入口 | `toast.error` / 字段级错误（`UDS5-S18`） |
| 取消 | 用户或系统主动中止 | **不视为错误**；不弹错误提示；恢复触发前状态 | 无 Toast（`web/AGENTS.md` §3.9） |
| 加载 | 动作进行中、结果未定 | `aria-busy`；不得改变组件尺寸、不得丢失可访问名称 | Spinner / Skeleton（`ui/button.tsx:130-161`） |
| 异常 | 非预期错误 / 降级 / 超时 / 网络中断 | 明确区分「可恢复」与「不可恢复」；不可恢复须给升级路径 | `errorComponent` / `error-state`（`UDS5-S20`） |

> 五态适用于全部 15 种交互；某态对某交互不适用时，须在矩阵中显式写 `N/A` 并给出理由，不得留空。

---

## 4. 15 种交互 × 五态矩阵

| 交互 | 成功 | 失败 | 取消 | 加载 | 异常 | 反馈归属 / 组件 |
|---|---|---|---|---|---|---|
| Click | 触发目标动作、结果可见 | 保留上下文、可重试 | 外部点击/Esc 视为取消，不报错 | 点击后 `aria-busy`、防重复 | 超时/网络中断给 `error-state` | Button `cva()`；`web/AGENTS.md` §3.9 |
| Hover | 显示 `*-hover` Token 态 / Tooltip | 悬浮内容加载失败给占位 | 指针移出即恢复 Default | Tooltip 内容异步时 Skeleton | 悬浮层定位异常降级为不显示 | `ui/hover-card.tsx`；**T14** |
| Focus | 2px 焦点环（`ring-2`，已裁决）、键盘可达 | 焦点陷阱失效须可退出 | 失焦（blur）恢复 Default | 焦点不因加载丢失 | 焦点被遮挡时滚动到可见 | `focus-visible:ring-2`；`aria-*` |
| Press | `active:` 态显式（如 `active:bg-primary-active`） | 长按误触不提交 | 指针移出/抬起前取消，`active:` 撤销 | 按下期间禁用二次提交 | — | `ui/button.tsx:44` 等 |
| Drag | 拖拽预览跟随、放置目标高亮 | 不可放置目标给禁止光标 | Esc / 拖出区域取消并回位 | 拖拽数据异步时占位 | 拖拽中断清理幽灵元素 | `data-state` / ARIA |
| Drop | 数据落入目标、顺序/位置更新 | 目标拒绝、数据回滚、原因可见 | 放置前取消、无副作用 | 放置后 `aria-busy`、乐观更新 | 服务端拒绝时回滚 + 提示 | Mutation `onError`（§3.9） |
| Keyboard | Enter/Space/Esc/方向键按定义生效 | 无效键不触发副作用 | Esc 关闭浮层、焦点归还 | 快捷键在加载期间禁用 | 焦点顺序错乱须可恢复 | `aria-expanded/selected` |
| Touch | 命中区 ≥24×24（推荐 44px） | 误触不提交 | 触摸取消（touchcancel）回位 | 触摸后 `aria-busy` | 多点触控冲突降级为单击 | `.ds-touch-target` |
| Double Click | 触发二级动作 | 与单击冲突时不产生双重副作用 | — | 首次单击后短暂等待态 | — | 与 Click 互斥定义 |
| Long Press | 触发上下文菜单 | 未达阈值按普通 Click 处理 | 提前抬手取消 | 阈值内显示进度指示 | — | H5 专有；Reduce Motion 兼容 |
| Submit | 提交成功、重置/关闭、成功反馈 | 服务端错误映射字段、保留输入 | 取消回表单、不丢弃输入 | 提交中禁用 + Spinner + 防重复 | 网络异常给可重试错误 | `react-hook-form`；`UDS5-S18` |
| Cancel | 关闭流程、恢复初始态 | — | 即取消语义本身 | 取消请求期间禁用二次取消 | 取消失败须回到可操作态 | 不弹错误 Toast（§3.9） |
| Retry | 重试成功、清除错误态 | 重试仍失败、保留重试次数 | 用户放弃重试 | 重试中 `aria-busy` | 指数退避/限流（如登录 429） | `error-state` / `ui/button.tsx` |
| Undo | 撤销成功、恢复前态、可 Redo | 撤销失败保留原状 | 取消撤销、无副作用 | 撤销中禁用 | 服务端不可撤销时明确告知 | `toast` action（`UDS5-S20`） |
| Confirm | 确认后执行主动作 | 确认后执行失败按主动作失败处理 | 取消关闭确认框、不执行 | 确认后 `aria-busy` | 二次确认不可被绕过 | `components/confirm-dialog.tsx` / `ui/alert-dialog.tsx` |

### 4.1 矩阵适用口径

- 「反馈归属」列统一遵循 `web/AGENTS.md` §3.9：**普通请求拦截器不弹 Toast**，提示由 Query/Mutation 最终失败回调或 Mutation 自定义 `onError` 负责；`meta.errorToast: false` 关闭自动提示；自动重试期间与主动取消时不报错。
- 失败与异常的区分：失败=业务预期内可恢复（如校验不通过），异常=非预期（超时/网络/降级）；二者映射到 `UDS5-S20` 的「可恢复错误 / 不可恢复错误」两类。
- 所有交互的 `aria-*` 与视觉状态必须一致（Clerk 分析 2.12 / 2.14）。

---

## 5. 分组逐项规则

### 5.1 指针类（Click / Hover / Focus / Press / Double Click）

| 规则 | 内容 |
|---|---|
| 三态齐备 | hover / focus / active 必须同时显式定义，不得由 opacity 推断（Clerk 分析 2.7） |
| 链接类反馈 | 文字链接 hover / focus 必须提供**颜色以外**的反馈（下划线，`ui/button.tsx:53-55`） |
| 防重复 | Click 提交后进入加载态并禁用，避免重复提交（≠ `UDS5-S18` 的表单提交防重） |
| 焦点稳定 | 加载/错误不得使焦点丢失或可访问名称改变（`ui/button.tsx:150-159`） |

### 5.2 拖拽与触摸类（Drag / Drop / Touch / Long Press）

| 规则 | 内容 |
|---|---|
| 命中区 | ≥24×24（WCAG 2.2 AA 2.5.8），H5 推荐 44px；`.ds-touch-target` 用伪元素扩展不改盒子 |
| 取消无副作用 | touchcancel / Esc / 拖出区域必须回位，不产生提交 |
| 状态暴露 | 拖拽与放置目标用 `data-state` / ARIA 表达，供测试与辅助技术读取 |
| 降级 | 触摸冲突 / 拖拽中断降级为单击或清理幽灵元素，不留残影 |

### 5.3 流程类（Keyboard / Submit / Cancel / Retry / Undo / Confirm）

| 规则 | 内容 |
|---|---|
| Esc 语义 | 关闭浮层并把焦点归还触发元素；不弹错误提示 |
| 取消非错误 | 主动取消不报错（`web/AGENTS.md` §3.9） |
| 危险操作 | 删除/资金相关操作走 `confirm-dialog.tsx` 二次确认，确认不可被键盘绕过 |
| 服务端错误 | `handleServerError` → `form.setError` 字段级展示；不同操作即使文案相同也分别提示（§3.9） |
| 防重复提交 | 提交中 `disabled + aria-busy`，成功后重置或关闭（`UDS5-S18`） |

---

## 6. 焦点环（硬约束，已裁决为 2px）

> **口径已裁决**：焦点环宽度采用 **2px `ring-2`**（`--ds-focus-ring-width: 2px`，见 `UDS5-S13` §7 / `UDS5-S01` §4.2.1，2026-11-14 裁决）。运行时代码本身已是 2px（`ui/button.tsx:31` 基类 `focus-visible:ring-2`），文档与代码无漂移。**装饰性 `ring-1` 描边 1px 是独立保留值**（弹层 / 卡片 / 日历格，3.0 §15.1 分类），不承载焦点语义，不得与焦点环混淆，也不得改成 2px。

| 项 | 规范 | 现状核对 |
|---|---|---|
| 宽度 | **2px 焦点环（`ring-2`）**，键盘 `:focus-visible` 触发，鼠标点击不触发 | 与 `ui/button.tsx:31` 的 `focus-visible:ring-2` 一致；原生元素兜底同读 `--ds-focus-ring-width`，全站单档 |
| 颜色 | `border-ring` / `ring-ring` 语义 Token；destructive 用 `ring-destructive/*` | `ui/button.tsx:31,52` |
| 可达性 | 所有可交互组件键盘可达、焦点顺序合理（`web/AGENTS.md` 3.12） | 由 `contract.accessibility.focusVisible=REQUIRED` 约束 |
| 浮层 | Dialog / AlertDialog 须焦点陷阱，关闭后焦点归还 | Clerk 分析 2.11 |
| 一致性 | `aria-expanded` / `aria-selected` / `aria-invalid` / `aria-busy` 与视觉一致 | Clerk 分析 2.12 / 2.14 |

> **处置**：本规范以 2px 为红线；装饰性 `ring-1` 描边 1px 为另一回事，单独保留（见 `UDS5-S07`）。本轮不改代码值，因代码本身已是正确的 2px；浏览器级守卫复核仍 `NOT_VERIFIED`。

---

## 7. hover 必须走 `*-hover` Token（T14）

| 规则 | 内容 |
|---|---|
| 唯一路径 | hover 态由专用 `*-hover` 语义 Token 表达：`bg-primary-hover`、`bg-secondary-hover`、`bg-destructive-subtle-hover` 等（`ui/button.tsx:44-55`） |
| **T14 禁止** | **禁止 `hover:bg-X/NN` 透明度凑态**；常态色 + 透明度在浅色底会泛白而非变深（`:41-43` 注释） |
| 例外 | `dark:hover:bg-input/50`、`dark:hover:bg-muted/50`（`:46,50`）为 Dark 主题下既有实现，属注册在 `cva()` 内的显式声明，不属调用点临时拼装；是否收敛由 T14 门禁复核 |
| 禁止绕过 | 不得用内联 `style`、`appearance` 对象、`cl-*` 类实现 hover（绕过 T1–T17 静态扫描） |
| pressed | `active:bg-primary-active` 等独立 `*-active` Token，与 hover 分离，不得共用 |
| 反馈叠加 | 链接类 hover 须叠加下划线等「非颜色」反馈（`ui/button.tsx:53-55`） |

---

## 8. 嵌套浮层外观作用域边界

> 参考 Clerk 分析 2.3 / 2.11 / 2.13 的**理念**：顶层外观只作用于接收它的组件，「组件打开另一个组件」时须经专用 prop 传递外观，浮层作用域显式、不隐式继承。**Uter 不引入 Clerk SDK、不引入 `appearance` 对象或 `cl-*` 类体系**（审计 §9 D8 / §13 第 3 条）。

| 项 | Uter 规则 | 与 Clerk 的差异 |
|---|---|---|
| 作用域载体 | 由 **React props 与 Portal** 决定，而非 `appearance` 对象 | Uter 无 `ClerkProvider` 外观传递链 |
| 嵌套浮层 | 父浮层打开的 Dialog / Popover / Select 必须**显式接收**所需的主题/尺寸上下文，不得假设继承父级 | Clerk 用 `userProfileProps.appearance` 等专用 prop；Uter 用 props/`Portal` |
| 焦点管理 | 每层浮层独立焦点陷阱，关闭时逐层归还焦点 | 二者均需，但 Uter 基于 Base UI |
| 叠层顺序 | 后打开者在最上层；Esc 只关闭最上层 | 与 Clerk 数组叠加「后定义者优先」理念同构但实现不同 |
| 主题 | 消费 `--ds-*` / `dark:` 语义 Token，Light/Dark 成对 | Clerk 用 `color-mix()` 运行时派生；Uter 静态声明 |
| 禁止 | 用全局 CSS 后代选择器把父浮层外观隐式灌入子浮层 | 会绕过 T1–T17 且破坏作用域边界 |
| 组件 | `ui/dialog.tsx` / `alert-dialog.tsx` / `popover.tsx` / `hover-card.tsx`、`components/dialog.tsx` / `confirm-dialog.tsx` | Clerk 为 `OAuthConsent` / `UserButton` 等身份组件 |

---

## 9. 动效与 Reduce Motion

| 规则 | 内容 |
|---|---|
| 单一来源 | 动效走 `web/src/design-system/foundations/motion.css` 的 7 个 `ds-motion-*` utility（Clerk 分析 2.15） |
| Reduce Motion | `prefers-reduced-motion` 下关闭非必要过渡；`foundations/accessibility.css` 配套（2.21） |
| 加载动效 | Skeleton shimmer 遵守 Reduce Motion；`aria-busy` 表达状态 |
| 禁止 | 用动效替代状态信号；用固定 `sleep` 制造竞态（`web/AGENTS.md` 3.14 第 13 条） |

---

## 10. 通用状态模型与状态一致性（业务域蓝图补充）

> 来源：业务域蓝图《Interaction and State Standard》§1–§6。**本节把 §4 的 15 种交互 × 五态矩阵扩展到「业务状态」维度**，不新增组件、不改 Token。

### 10.1 通用状态模型（按元素类型分层）

| 元素类型 | 必须考虑的状态 | 状态数 |
|---|---|---:|
| 通用组件 | `default` / `hover` / `active` / `focus-visible` / `disabled` / `loading` | 6 |
| 表单元素 | 通用 6 项 + `invalid` / `valid` / `readOnly` | +3 |
| 数据区域 | `empty` / `loading` / `partial` / `error` / `stale` | +5 |

**边界说明**：§3「五态通用定义」与 §4 的 15 × 5 矩阵**继续有效**；本节是**在业务语义层**的补充，不替代五态定义，也不新增 Token。

### 10.2 状态一致性（同一业务状态 → 同一映射）

| # | 规则 | 说明 |
|---|---|---|
| ST-1 | **同一业务状态**在 Badge、详情页、表格、通知、操作按钮中**必须使用同一状态映射**（同一颜色 / 同一文案 / 同一图标）。 | 蓝图 §2 |
| ST-2 | 状态映射**必须由共享常量 / 领域模型提供**，**禁止各页面自行翻译同一状态**。 | 蓝图 §2 的核心要求 |
| ST-3 | 状态**不得**只用颜色表达（须有文字或可访问名称）；这与 S08 图标、S13 §3.7 一致。 | 蓝图 §5 + S13 |
| ST-4 | 状态**不得**用更高 z-index / 更大阴影假装层级（见 S07 §4 / §6.2）。 | 内部一致性 |

**仓库现状（如实登记）**

| 项 | 结论 |
|---|---|
| 共享状态映射 | 仓库存在**领域级状态常量**的用法（如渠道状态、令牌状态、充值状态的 label / color 映射），但**是否形成统一的跨域共享常量表（单一 status-mapping 模块）本轮未核实**，登记为 `S17-D1`。**这是本节最重要的落地缺口**：状态映射分散在各 feature 的 `lib/` 时，同一业务状态在不同页面会出现文案 / 颜色漂移。 |
| 状态色来源 | 统一走 S03 §3 第 9–12 类的 success / warning / destructive / info 语义族，**禁止**页面自造色值（T7 / T8）。——已满足 |

### 10.3 操作反馈（按操作性质分类）

| 操作性质 | 反馈要求 | 仓库落点 / 状态 |
|---|---|---|
| 即时操作 | 在合理时间内反馈成功或失败 | `ui/sonner.tsx`（toast）；`NOT_VERIFIED`（时限未量化） |
| 异步操作 | 显示**处理中**、进度或**可查询状态** | `ui/button.tsx` `loading` → `disabled + aria-busy`（S18 §3 契约第 9 / 12 条）；满足 |
| 破坏性操作 | 确认**对象与影响** | `components/confirm-dialog.tsx`（S18 §3 契约第 11 条 / S16 §6）；满足 |
| 可撤销操作 | 提供**撤销期限或恢复入口** | `NOT_VERIFIED`（仓库是否存在撤销 / 恢复入口未核实）；登记为 `S17-D2` |
| 不可撤销操作 | **明确说明不可恢复** | `confirm-dialog.tsx` 文案需覆盖；`NOT_VERIFIED`；登记为 `S17-D3` |

### 10.4 加载状态

| # | 规则 |
|---|---|
| L-1 | 加载状态**必须保留布局**，避免页面跳动（骨架屏高度 = 真实内容高度）。 |
| L-2 | 超过短暂等待阈值时**提供进度或解释**；**不得无限显示 Spinner 而没有恢复策略**（须有超时、重试或取消路径）。 |
| L-3 | 加载动画须有**静态文本或进度语义**补充，不得只靠动效表达状态（与 §9「不得用动效替代状态信号」一致）。 |

> 仓库现状：`ui/button.tsx` 的 `loading` 态满足「不改变按钮尺寸、不丢可访问名称」（S18 契约第 12 条）；页面级 Skeleton 与超时 / 重试策略**未逐页核实**，登记为 `S17-D4`。

### 10.5 空状态五类（必须区分）

> 蓝图 §5：区分「首次为空 / 筛选无结果 / 权限不足 / 尚未配置 / 加载失败」。

| # | 类型 | 判定 | 文案要点 | 用户动作 |
|---|---|---|---|---|
| EM-1 | **首次为空** | 该对象从未被创建过 | 说明这里将来会有什么 | 主 CTA（如「创建第一个渠道」） |
| EM-2 | **筛选无结果** | 有数据，但当前筛选条件下无匹配 | **明确区分于 EM-1**，说明是筛选导致 | 「清除筛选条件」 |
| EM-3 | **权限不足** | 当前角色无权查看 | **不得**伪装成空数据（会误导用户以为是数据缺失） | 「申请权限」/ 联系管理员 |
| EM-4 | **尚未配置** | 前置配置缺失，功能未启用 | 说明需要先完成哪一步配置 | 「去配置」 |
| EM-5 | **加载失败** | 取数失败 | 说明发生了什么 + 是否可重试 | 「重试」 |

**规则**

| # | 规则 |
|---|---|
| EM-R1 | 五类**不得**用同一张空状态图 + 同一句文案糊弄；EM-1 与 EM-2 **必须**可区分。 |
| EM-R2 | 空状态文案须**解释原因并给出下一步操作**（蓝图 §5）。 |
| EM-R3 | **权限不足不得显示为无数据**（安全与信任红线）。 |
| EM-R4 | 「加载失败」属**错误态**，不得用空状态图标；须用 error 语义（`UDS5-S20`）。 |

> 仓库现状：`UDS5-S16` 已登记页面级 Empty / Loading / Error 三态模板；**五类空状态的细分是否在页面层落地未逐页核实**，登记为 `S17-D5`。

### 10.6 错误信息三要素

| # | 规则 |
|---|---|
| ER-1 | 错误信息须包含：**发生了什么** + **用户可以做什么** + **是否需要联系支持**。 |
| ER-2 | **技术细节写入受控日志**，**不得**向普通用户暴露堆栈、密钥或内部地址（与 S18 §3.4 E-2、`web/AGENTS.md` §3.9 一致）。 |
| ER-3 | 错误文案**不得**出现无行动价值的泛化表述（与 S18 §3.4 E-1 一致）。 |

### 10.7 键盘与触控补充

| # | 规则 | 状态 |
|---|---|---|
| KB-1 | 所有交互**可键盘到达**；焦点顺序符合**视觉顺序** | 与 S13 §3.1 一致 |
| KB-2 | Esc 关闭适用浮层 | §5.3 已有 |
| KB-3 | 触控目标建议至少 **44×44px**（仓库口径：WCAG 2.2 AA 最低 24×24，Uter 推荐 44×44） | S13 §3.10 已有 |
| KB-4 | **不能只提供 hover 才可见的操作**（键盘与触屏无 hover） | `NOT_VERIFIED`；登记为 `S17-D6` |

---

## 11. 差异与例外登记

| 编号 | 内容 | 状态 |
|---|---|---|
| S17-D1 | **状态映射未形成跨域共享常量表**：同一业务状态在不同页面的文案 / 颜色映射是否一致未核实 | **治理候选**（蓝图 §2 ST-2 的核心要求；本轮未改运行时） |
| S17-D2 | 「可撤销操作须提供撤销期限或恢复入口」——仓库是否有撤销 / 恢复入口未核实 | `NOT_VERIFIED` |
| S17-D3 | 「不可撤销操作须明确说明不可恢复」——`confirm-dialog.tsx` 文案覆盖度未核实 | `NOT_VERIFIED` |
| S17-D4 | 页面级 Skeleton 保留布局（L-1）与超时 / 重试策略（L-2）未逐页核实 | `NOT_VERIFIED` |
| S17-D5 | 空状态五类（EM-1～EM-5）是否在页面层落地未逐页核实；`UDS5-S16` 目前只登记 Empty / Loading / Error 三态 | `NOT_VERIFIED` |
| S17-D6 | 「不能只提供 hover 才可见的操作」未做全量核查 | `NOT_VERIFIED` |
| S17-D7 | 蓝图 §1 通用状态模型（通用 6 / 表单 +3 / 数据 +5）与仓库 §3「五态通用定义」为**不同维度**（组件态 vs 元素态），**不合并、不互相覆盖** | 已登记（双轨并存，各自边界清晰） |

---

## 与其他规范的关系

| 规范 | 关系 | 边界 |
|---|---|---|
| `UDS5-S01` | 效力来源 | 不重述总则 |
| `UDS5-S03`–`S13` | 提供 `*-hover` / `*-active` / ring / 动效 / 响应式 / 无障碍 Token | 交互只消费 Token，不定义 Token |
| `UDS5-S14` | 组件状态矩阵（八态存在性）与 `cva()` 实现 | 本规范定义交互过程与五态 |
| `UDS5-S15` | `cva()` variant 为唯一扩展路径、事件与状态暴露 API | 交互不改 API |
| `UDS5-S16` | 12 类页面模板的交互承载 | 页面级 Empty/Loading/Error 依赖本规范 |
| `UDS5-S18` | Submit / Cancel / Retry 的表单验证与防重复提交 | 表单细节在 S18 |
| `UDS5-S20` | 五态的反馈组件映射与错误处理归属 | 提示归属在 S20 细化 |
| `web/AGENTS.md` | §3.9 错误处理、3.12 可访问性、3.14 测试 | 冲突时以 `web/AGENTS.md` 为准 |
| `CLERK-DESIGN-REFERENCE-ANALYSIS.md` | 只借鉴分层定制与浮层作用域理念（2.3/2.7/2.11/2.13） | 不引入 SDK、不把 Elements 描述为现行 API |

---

## 代码实施位置

| 用途 | 真实路径 | 本轮动作 |
|---|---|---|
| 交互状态范式 | `web/src/components/ui/button.tsx`（`cva()` 八态 + `loading`） | **只读** |
| 浮层组件 | `web/src/components/ui/dialog.tsx` / `alert-dialog.tsx` / `popover.tsx` / `hover-card.tsx` | **只读** |
| 业务浮层封装 | `web/src/components/dialog.tsx` / `confirm-dialog.tsx` | **只读** |
| 动效 / 无障碍基础 | `web/src/design-system/foundations/motion.css` / `accessibility.css` | **只读** |
| 命中区工具 | `.ds-touch-target`（`ui/button.tsx:89` 引用） | **只读** |
| 设计系统守卫测试 | `web/src/design-system/__tests__/`（10 个，含 `accessibility.test.ts`） | **只读** |
| 前端规范 | `web/AGENTS.md`（§3.9 / 3.12 / 3.14） | **只读** |
| 规范输出 | `docs/design-system/uter-design-system-5.0/17-INTERACTION-STANDARD.md` | **本文件（新建）** |

> 未列出的脚本、路径、测试结果不出现在本规范中；不宣称已运行门禁或视觉回归。

---

## 自动化验证

| 验证项 | 真实命令 / 门禁 | 基线结果 | 本规范状态 |
|---|---|---|---|
| 设计 Token 门禁（含 T14） | `check-design-tokens.mjs --strict` | 违规 0 / EXIT=0（引用审计 §4.4） | 未重跑 |
| 对比度门禁 | `verify-contrast.mjs` | 31 PASS / 0 FAIL（引用审计 §4.4）；E24 两处仍待修 | 未重跑 |
| 可访问性测试 | `test:axe`（2 spec） | 刻意不接 CI（审计 §7） | `NOT_EXECUTED` |
| 视觉回归 | `test:visual` | 22 页 / 44 张 PNG（引用审计 §6） | 未重跑 |
| 注册表证据 | `components:registry:strict` | **`EXIT=1`**，`VERIFIED 0 / PARTIAL 9 / NOT_VERIFIED 56` | 未重跑 |
| 15 交互 × 五态覆盖 | 无现成脚本 | 不可判定 | `NOT_VERIFIED` |
| 2px 焦点环一致性 | 口径已裁决为 `--ds-focus-ring-width: 2px`，与 `ui/button.tsx:31` 的 `focus-visible:ring-2` 一致；装饰性 `ring-1` 描边 1px 为独立保留值，不承载焦点语义 | 符合代码真值 | `NOT_VERIFIED`（浏览器级守卫复核未执行） |
| 全量构建 | `bun run build:check` 等 | 并发 WIP 211 项，审计标 `NOT_EXECUTED` | **不执行** |

---

## 验证状态

| 项 | 状态 | 说明 |
|---|---|---|
| 本规范文本 | `ACTIVE` | 已撰写，供评审 |
| 15 交互 × 五态契约 | `NOT_VERIFIED` | 规范层定义，未跑门禁或测试 |
| 2px 焦点环一致性 | `NOT_VERIFIED` | 口径已裁决为 2px，与 `ui/button.tsx:31` 的 `focus-visible:ring-2` 一致；装饰性 `ring-1` 描边 1px 为独立保留值（不承载焦点语义），不混为一谈 |
| hover `*-hover` Token 全量收敛 | `NOT_VERIFIED` | T14 门禁结论引用审计，未重跑 |
| 嵌套浮层作用域 | `NOT_VERIFIED` | 无现成校验脚本 |
| 65 个组件证据 | `NOT_VERIFIED` | `VERIFIED 0 / PARTIAL 9 / NOT_VERIFIED 56`，`components:registry:strict EXIT=1` |
| E24 对比度缺陷 | `NOT_VERIFIED` | 3.76:1 / 3.30:1 待修，P1 |
| 全量构建 / 视觉回归 / E2E | `NOT_EXECUTED` | 审计 §1 / §7 / §13 / §14 约束 |
| Android / iOS / HarmonyOS | `NOT_VERIFIED` | 无真实实现（审计 §8、结论 C） |

> **最终状态低于 `FULLY_IMPLEMENTED_AND_VERIFIED`**：本规范不宣称任何交互已通过验证。
