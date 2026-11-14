# 15 — 组件 API 标准（COMPONENT API STANDARD）

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S15` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01` |
| 生效日期 | `2026-11-14` |
| 适用范围 | `web/src/components/ui/` 全部基础组件、`web/src/components/` 业务封装、`web/src/design-system/components/typography/`，以及所有新增/修改组件 API 的变更 |
| 验证状态 | `NOT_VERIFIED` |

> 本规范定义「组件 API 怎么命名、怎么扩展、怎么废弃」。它是 `UDS5-S14`（组件必须定义什么）的下位细化，不重述组件清单与状态矩阵。本轮不修改任何代码、不新增依赖、不执行 git 操作。

---

## 1. 目的与效力

1. 统一 65 个基础组件与业务封装的 API 形态，消除「同类组件属性命名无理由差异」。
2. 把 `web/AGENTS.md` 3.2 / 3.3 的强制约束（**props 非必要不解构，直接用 `props.xxx`**；**先检索，再复用，最后才新增**）升级为可评审的 API 规则。
3. 明确组件定制的**唯一合法路径**：`props + cva() variant + 语义 Token + composition`；禁止 `appearance` 式全局覆写绕过 T1–T17 门禁。
4. 与 Clerk 参考分析 §2.23 的分层定制理念同构但不等价：Uter 组件是自有 React / `@base-ui/react` 实现，扩展走 props 与 `cva()`，不引入 `appearance` 对象、`cl-*` 稳定类体系或任何 Clerk SDK。

---

## 2. 事实基线（可核验，禁止假设）

| 项 | 真实值 | 来源 |
|---|---|---|
| 组件实现根 | `web/src/components/ui/`（65 实现） | `BASELINE-AUDIT.md` §5 |
| 注册表字段 | 顶层仅 `id,name,file,category,status,contract`；无 `variants` / `deprecated` / `replacement` 字段 | schema、`BASELINE-AUDIT.md` §5 |
| ID 正则 | `^UTER-CMP-[A-Z0-9_]+$`（`component-registry.schema.json:69`） | 已读 schema |
| 证据状态 | `VERIFIED 0 / PARTIAL 9 / NOT_VERIFIED 56`；`components:registry:strict EXIT=1` | `BASELINE-AUDIT.md` §5 |
| 样式引擎 | `class-variance-authority`（`cva`）、`clsx`、`tailwind-merge`，合并工具 `cn()` | `web/package.json`、`ui/button.tsx:20-24` |
| 单一 Button 实现 | `ui/button.tsx:26-108` 一个 `cva()`：6 variant × 9 size + `loading` prop | 已读 `ui/button.tsx` |
| Tailwind | v4.3.3，`@theme` 注册 `--text-*`；动态类名用 `cn()` 合并 | `BASELINE-AUDIT.md` §2 / §4.2；`web/AGENTS.md` 3.10 |
| props 约束 | 「对象非必要不要进行解构，特别是组件的 props；直接使用 `props.xxx` 更清晰」 | `web/AGENTS.md` 3.2 第 88 行、3.3 第 117 行 |
| 复用约束 | 「先检索，再复用，最后才新增」；新增前必须记录候选组件缺少的具体能力 | `web/AGENTS.md` 3.3 第 92–103 行 |
| 门禁 | T1–T17 静态扫描规则，`ALLOWLIST=[]`，`--strict` 为唯一阻断模式 | `BASELINE-AUDIT.md` §11.1 |

> **历史实现说明**：`ui/button.tsx:118-128` 的 `Button` 目前采用参数解构（`{ className, variant, size, ...props }`）。这是既有实现，不是本规范的反例豁免；新增或大幅重写组件须按 §4 逐步向 `props.xxx` 过渡，本轮**不批量重写**既有组件（审计 §9 D7）。

---

## 3. 命名规范

| 对象 | 规则 | 正例 | 反例 |
|---|---|---|---|
| Component ID | 沿用真实 `UTER-CMP-*`；已在册不重命名；5.0 新提案 `UTER-CMP-5-XX`（见 `UDS5-S14` §5.2 正则约束） | `UTER-CMP-ACCORDION` | `Btn` / `uter-cmp-01` |
| 文件名 | kebab-case `.tsx`，与 `component-registry.json:file` 一致 | `dropdown-menu.tsx` | `DropdownMenu.tsx` |
| 组件导出名 | PascalCase，与文件名可推导映射 | `DropdownMenu` | `DM` / `DropdownMenuComponent` |
| `variant` 取值 | 小写语义词，稳定不复用他义 | `default / outline / secondary / ghost / destructive / link` | `primary`（与 `default` 双轨）、`type1` |
| `size` 取值 | 有序档位名，禁止数值档 | `default / sm / lg / icon-xs / inline / wrap` | `size-3` / `xs`（已删，`ui/button.tsx:64-66`） |
| `data-slot` | 组件根与子槽统一 `data-slot='<name>'`，供 `cva()` 选择器与测试定位 | `data-slot='button'`、`data-slot='button-spinner'` | 无槽位、随意 `data-id` |
| CSS 变量 | 语义层 `--ds-*`，禁止裸色值（T8 唯一所有者 `brand-colors.ts`） | `--ds-button-height-md` | `#5B5EE6` 写进组件 |
| 布尔属性 | `is*` / `has*` 仅用于状态形容；动作开关用原形 | `disabled` / `loading` / `defaultOpen` | `isDisabled` / `showLoading` |

**唯一性规则**：同一 `category` 下不得出现同义不同名的属性（如 `value` 与 `selectedValue` 并存）。命名冲突以 §5 的「统一属性词典」为准。

---

## 4. Props 命名与「不解构」约束

### 4.1 统一属性词典（同类组件强制一致）

| 语义 | 统一属性名 | 类型 | 默认 | 适用组件类 |
|---|---|---|---|---|
| 受控值 | `value` | `T` | — | Input / Selection / Overlay(open) |
| 非受控初值 | `defaultValue` | `T` | — | Input / Selection |
| 值变更 | `onValueChange(value)` | `(v: T) => void` | — | Input / Selection |
| 开合 | `open` / `defaultOpen` / `onOpenChange(open)` | `boolean` | `false` | Overlay / Disclosure |
| 禁用 | `disabled` | `boolean` | `false` | 全部可交互组件 |
| 加载 | `loading` | `boolean` | `false` | Button / Form / Data Table |
| 视觉变体 | `variant` | `VariantProps<typeof cva>` | 见 `defaultVariants` | 有 `cva()` 的组件 |
| 尺寸 | `size` | `VariantProps<typeof cva>` | 见 `defaultVariants` | 有 `cva()` 的组件 |
| 错误 | `invalid` / `aria-invalid` | `boolean` | `false` | Input / Form |
| 透传原生属性 | `...props`（组件 Props 继承原生 `ButtonPrimitive.Props` 等） | — | — | 全部 |

**禁止**：同类组件无理由的属性命名差异（如 A 用 `onChange`、B 用 `onValueChange` 表达同一「值变更」语义）；命名差异必须有能力差异依据并写入变更说明。

### 4.2 `props.xxx` 直接访问（强制）

- 组件内部**非必要不解构**，直接 `props.className`、`props.disabled`、`props.children`；与 `web/AGENTS.md` 3.2 第 88 行、3.3 第 117 行一致。
- 例外仅限：`cva()` 调用需要把 `variant/size/className` 一次性传入时局部取值；`...props` 透传剩余原生属性时的一次性展开。除此之外不得以「写法简洁」为由整体解构。
- 复杂逻辑拆成小函数/自定义 Hook（`web/AGENTS.md` 3.2），不得靠解构堆叠降低可读性。
- 评审口径：新增/重写组件的参数列表若出现与上文不一致的整段解构，需给出「`cva()` 传参 / 原生透传」的具体理由，否则判定为不合规。

### 4.3 先检索，再复用，最后才新增（强制）

| 步骤 | 动作 | 依据 |
|---|---|---|
| 1 | 读取项目 `shadcn-ui` 技能，用 `rg --files` / `rg` 检索 `src/components/` 与相关 `src/features/`；通用交互同时查 `src/hooks/` | `web/AGENTS.md` 3.3 |
| 2 | 按用途与行为查找候选，阅读实现、props、实际调用示例，不能只查准备新增的组件名 | 同上 |
| 3 | 优先业务封装 → 现有 props / 插槽 / 组合 / 兼容扩展 → `ui/` 基础组件组合 | 同上 |
| 4 | 确有缺口才新增，并在变更说明记录候选路径与「不能复用/组合/扩展」的具体能力缺口 | 同上 |
| 5 | 文案、图标、尺寸、颜色、所在页面不同，**不构成**重复实现理由 | 同上 |

---

## 5. TS 类型

| 规则 | 内容 |
|---|---|
| 显式类型 | 参数与返回值显式标注；组件 props 用 `interface` 或 `type` 明确定义（`web/AGENTS.md` 3.3） |
| 禁止 `any` | 优先具体类型或 `unknown`（`web/AGENTS.md` 3.2） |
| 仅类型导入 | `import type { VariantProps } from 'class-variance-authority'`（`ui/button.tsx:20` 范式） |
| 变体类型来源 | 组件变体类型由 `VariantProps<typeof buttonVariants>` 推导，不手写字符串联合副本 |
| 原生继承 | 基础组件 Props 继承底层原语类型（如 `ButtonPrimitive.Props`），再交叉自定义属性 |
| 类型检查 | 每次改动 TS/TSX 后执行 `bun run typecheck` 至无错误（`web/AGENTS.md` 3.2） |
| 导出 | 组件与 `cva()` 变体函数具名导出（`export { Button, buttonVariants }`，`ui/button.tsx:165`） |

---

## 6. 默认属性

| 规则 | 内容 |
|---|---|
| 单一来源 | 默认值只在 `cva()` 的 `defaultVariants` 或组件函数默认参数中定义一处，禁止多处重复 |
| Button 范式 | `defaultVariants: { variant: 'default', size: 'default' }`（`ui/button.tsx:103-106`） |
| 布尔默认 | `loading = false`、`disabled` 未传即 `false`，不得默认 `true` 制造隐式行为 |
| 尺寸地板 | 文字按钮最低 `sm`，需更小用 `icon-xs`（24px 方形），禁止自造 `xs`（`ui/button.tsx:64-66`） |
| 不得覆盖语义 | 默认值不得使组件进入 `disabled` / `invalid` / `loading` 态 |

---

## 7. 受控与非受控

| 规则 | 内容 |
|---|---|
| 成对暴露 | 受控 `value` + `onValueChange`；非受控 `defaultValue`；二者不得同时作为唯一数据源 |
| 单一真源 | 组件内部不得同时维护受控与非受控 state；`value !== undefined` 即判定为受控 |
| `open` 族 | Overlay / Disclosure 用 `open / defaultOpen / onOpenChange`，与 §4.1 词典一致 |
| 与表单库协同 | 表单场景由 `react-hook-form` 的 `Controller` / `register` 承担受控，组件不再自建影子 state（见 `UDS5-S18`） |
| 禁止 | 通过 `key` 强制重置内部状态来「模拟」受控；不得静默吞掉 `onValueChange` |

---

## 8. Callback

| 规则 | 内容 |
|---|---|
| 命名 | `on<动作>`，过去式/现在式统一：`onValueChange` / `onOpenChange` / `onSubmit`，禁止 `handleX` 作为对外 prop |
| 签名稳定性 | 回调参数为单一值或结构化对象，禁止透传完整原生事件再让调用方解包（除非原生事件本身是契约） |
| 触发时机 | 只在**用户可见行为或状态实际变化**时触发；`loading` / `disabled` 下不得触发 |
| 幂等 | 同一状态重复设置不得重复触发；`onOpenChange` 与实际 `open` 一致 |
| 取消 | 异步取消（`web/AGENTS.md` §3.9「主动取消时不报错」）不得触发错误回调 |

---

## 9. Ref

| 规则 | 内容 |
|---|---|
| 转发 | 基础组件须把 `ref` 转发到真实 DOM 根元素（或 Base UI 原语根），保证焦点管理 / 测量 / 滚动可用 |
| 类型 | `ref` 类型与根元素一致，不使用 `any`；命令式句柄须单独命名并说明用途 |
| 焦点环 | `ref` 转发不得破坏 2px 焦点环（`ring-2`，已裁决）与 `focus-visible:ring-2` |
| 禁止 | 用 `ref` 直接改内联样式覆写主题（绕过 T1–T17）；用 `ref` 读取视觉状态代替 `aria-*` |

---

## 10. Composition / Slot / Children

| 规则 | 内容 |
|---|---|
| Composition 优先 | 复杂 UI 由基础组件组合而成，禁止在 feature 内重新拼装同一套交互、状态与样式（`web/AGENTS.md` 3.3） |
| Slot | 通过 `data-slot` 命名子槽（root / trigger / content / icon / label），`cva()` 可用 `[&>[data-slot=...]]` 选择器（`ui/button.tsx:31` 范式） |
| `asChild` / `render` | 使用底层原语提供的 `render` / `nativeButton` 语义（`ui/button.tsx:110-116, 146`），不手写 `cloneElement` |
| Children | `children` 保持可组合；加载态不得丢弃 `children` 宽度与可访问名称（`ui/button.tsx:130-161`） |
| 业务数据 | 允许新增承载业务数据/权限/事件的 feature 组件，但其中通用 UI 必须继续复用 `ui/` 与业务封装 |
| 禁止反模式 | 为单页塞入无关业务逻辑、为消除少量相似代码建立过度通用抽象（`web/AGENTS.md` 3.3） |

---

## 11. Event

| 规则 | 内容 |
|---|---|
| 语义化 | 优先原生事件语义（`onClick` / `onKeyDown`），不另造平行事件系统 |
| 键盘 | `Enter` / `Space` / `Esc` / 方向键行为由原语或组件显式定义，`aria-expanded` / `aria-selected` 与视觉一致（Clerk 分析 2.12） |
| 冒泡 | 浮层内部点击不得意外关闭上层；事件边界由 Portal / 原语决定（`UDS5-S17`） |
| 状态暴露 | 事件引起的状态变化须同步到 `data-state` / `aria-*`，供测试与辅助技术读取 |
| 禁止 | 在事件处理器里直接写裸色值或任意 `text-[15px]` 等任意值类 |

---

## 12. Validation

| 规则 | 内容 |
|---|---|
| 归属 | 字段级校验由 `react-hook-form + zod` 承担，组件只暴露 `invalid` / `aria-invalid` 与错误文案槽（详见 `UDS5-S18`） |
| 前后端 | 前后端均校验，不信任仅前端校验（`web/AGENTS.md` 3.13） |
| 服务端错误 | `handleServerError` → `form.setError` 映射到字段，组件不自行解析 Axios 错误对象（`web/AGENTS.md` §3.9） |
| 展示 | 字段下方就近展示；`aria-invalid` 与错误边框/环同时生效 |
| 禁止 | 组件内部发起校验请求、缓存服务端错误文案、把完整 Axios 错误对象写入管理（`web/AGENTS.md` §3.9） |

---

## 13. Deprecation

| 规则 | 内容 |
|---|---|
| 标记 | 组件废弃时 `status` 用注册表枚举 `DEPRECATED`（`component-registry.schema.json:94`），并给出 `replacement` 指向 |
| 字段缺口 | 注册表当前**无** `deprecated` / `replacement` 字段（`BASELINE-AUDIT.md` §5 缺失字段），须先补字段与校验脚本再启用废弃流程 |
| 兼容期 | 废弃不立即删除；调用点按 `web/AGENTS.md` 3.3 逐步迁移到复用实现 |
| 禁止 | 直接删除组件、测试、Token 或业务代码；不降低门禁阈值、不扩 baseline、不动 `ALLOWLIST`（审计 §13） |
| ID 稳定 | 废弃组件的 `UTER-CMP-*` ID 保留，不回收给新组件复用 |

---

## 14. `cva()` variant 扩展为唯一路径

| 场景 | 唯一合法做法 | 禁止做法 |
|---|---|---|
| 新增视觉变体 | 在 `cva()` 的 `variants` 中新增取值 + `defaultVariants`，并登记到 `UDS5-S14` §3 第 6 项 | 调用点用 `className` 拼一组任意类「伪装」新变体 |
| 新增尺寸 | 在 `cva()` 的 `size` 中新增档位，绑定 `--ds-*` 变量 | 自造 `xs` / `size-[34px]`（`ui/button.tsx:64-66` 已删 `xs`） |
| 新增状态 | 在 `cva()` 内声明 `hover:` / `active:` / `disabled:` / `aria-invalid:` 态 | 用 `hover:bg-X/NN` 透明度凑态（T14） |
| 局部定制 | 通过 `className` 经 `cn()` 合并（仅覆盖非 Token 语义的布局差异） | 新增 `appearance` / `theme` 对象式全局覆写 |
| 组合扩展 | 通过 slot / children / `render` 组合已有组件 | 复制整份组件文件改名新建 |
| 主题切换 | 消费 `--ds-*` / `dark:` 语义 Token | 在组件内硬编码 Light/Dark 两套裸色值 |

**理由**：`appearance` 式全局覆写（Clerk `appearance.variables` / `appearance.elements`，参考分析 §2.23）会把样式决策移出静态扫描范围，绕过 T1–T17 门禁（`ALLOWLIST=[]`、基线只减不增）。Uter 组件是自有实现，扩展必须留在可被门禁扫描的 `cva()` / `cn()` / 语义 Token 链路内。**不引入 Clerk SDK、`@clerk/ui`、`@clerk/elements`**（审计 §13 第 3 条）。

---

## 15. 禁止 `appearance` 式全局覆写（T1–T17 边界）

| 禁止项 | 原因 | 替代 |
|---|---|---|
| `appearance={...}` 对象 | 动态样式脱离静态扫描，绕过 T1–T17 | `cva()` variant 取值 |
| `cl-*` 稳定类体系 | 属 Clerk DOM 契约，Uter 无此体系（Clerk 分析 2.12） | `data-slot` |
| `color-mix()` / 相对颜色语法运行时派生 | Uter 静态声明 Token，无运行时依赖（Clerk 分析 2.5） | `--ds-*` 成对 Light/Dark 变量 |
| `hover:bg-X/NN` 透明度凑态 | T14 明令禁止，浅色底会泛白而非变深（`ui/button.tsx:41-43`） | `bg-*-hover` 专用 Token |
| 任意值类 `text-[15px]` | 破坏 18 档 `@theme` 字号阶梯（Clerk 分析 2.4） | `--text-*` 注册档位 |
| 内联 `style` 覆写主题 | 绕过 `cn()` 合并与门禁 | `cn()` + 语义类 |

---

## 与其他规范的关系

| 规范 | 关系 | 边界 |
|---|---|---|
| `UDS5-S01` | 效力来源 | 不重述总则 |
| `UDS5-S14` | 上位：定义组件必须定义的 22 项、14 类清单、状态矩阵 | 本规范只定义 API 命名与扩展规则 |
| `UDS5-S03`–`S13` | 提供语义 Token 与 T1–T17 门禁 | 组件只消费，不定义 Token |
| `UDS5-S16` | 页面模板消费组件 API | 模板不另造平行 API |
| `UDS5-S17` | 交互五态与键盘/hover 规则 | 本规范给事件与状态暴露的 API 约束 |
| `UDS5-S18` | 表单校验与 `handleServerError` 归属 | Validation 节（§12）细化到 S18 |
| `UDS5-S19` | DataTable 11 项能力的 API 面 | 不在本规范重复 |
| `web/AGENTS.md` | **强制上位约束**：3.2 不解构、3.3 先检索再复用、3.14 测试、§3.9 错误处理 | 冲突时以 `web/AGENTS.md` 为准 |
| `CLERK-DESIGN-REFERENCE-ANALYSIS.md` | 只借鉴「分层定制」理念（§2.23） | 不引入 SDK、不描述 Elements 为现行 API |

---

## 代码实施位置

| 用途 | 真实路径 | 本轮动作 |
|---|---|---|
| `cva()` 范式实现 | `web/src/components/ui/button.tsx`（6 variant × 9 size + `loading`） | **只读**（事实来源） |
| 样式合并 | `@/lib/utils` 的 `cn()`（`ui/button.tsx:24` 引用） | **只读** |
| 注册表与 schema | `web/src/design-system/component-registry.json`、`schemas/component-registry.schema.json` | **只读**，不改 |
| 基础组件根 | `web/src/components/ui/` | **只读** |
| 业务封装 | `web/src/components/dialog/`、`confirm-dialog/`、`copy-button/`、`empty-state/`、`data-table/` | **只读** |
| 前端规范真源 | `web/AGENTS.md` | **只读**（约束来源） |
| 规范输出 | `docs/design-system/uter-design-system-5.0/15-COMPONENT-API-STANDARD.md` | **本文件（新建）** |

> 未列出的脚本、依赖、测试结果不出现在本规范中；不宣称已运行 `typecheck` / `lint` / 门禁。

---

## 自动化验证

| 验证项 | 真实命令 / 门禁 | 基线结果 | 本规范状态 |
|---|---|---|---|
| 类型检查 | `bun run typecheck` | 本轮未运行 | `NOT_VERIFIED` |
| Lint（含 `project/intl-locale`） | `bun run lint` | 本轮未运行 | `NOT_VERIFIED` |
| 注册表结构 | `components:registry:check` | `registered=65 / discovered=65 / errors=0`（引用审计） | 未重跑 |
| 注册表证据严格门禁 | `components:registry:strict` | **`EXIT=1`**，`VERIFIED 0 / PARTIAL 9 / NOT_VERIFIED 56`（引用审计） | 未重跑 |
| 设计 Token 门禁 | `check-design-tokens.mjs --strict` | 违规 0 / EXIT=0（引用审计） | 未重跑 |
| API 命名一致性 | 无现成脚本（无 `variants` / `deprecated` 字段） | 不可判定 | `NOT_VERIFIED` |
| 全量构建 | `bun run build:check` 等 | 并发 WIP 211 项，审计标 `NOT_EXECUTED` | **不执行** |

---

## 验证状态

| 项 | 状态 | 说明 |
|---|---|---|
| 本规范文本 | `ACTIVE` | 已撰写，供评审 |
| API 命名一致性 / 受控非受控 / Ref / Deprecation 规则落地 | `NOT_VERIFIED` | 规范层要求，未跑门禁或测试 |
| 65 个组件证据 | `NOT_VERIFIED` | 真实基线 `VERIFIED 0 / PARTIAL 9 / NOT_VERIFIED 56`，`components:registry:strict EXIT=1` |
| 注册表 `deprecated` / `replacement` / `variants` 字段 | `NOT_VERIFIED` | 字段当前缺失，落地须同步校验脚本 |
| 全量构建 / 视觉回归 / E2E | `NOT_EXECUTED` | 审计 §1 / §13 / §14 约束 |
| Android / iOS / HarmonyOS | `NOT_VERIFIED` | 无真实实现（审计 §8、结论 C） |

> **最终状态低于 `FULLY_IMPLEMENTED_AND_VERIFIED`**：本规范不宣称任何组件或 API 规则已通过验证。
