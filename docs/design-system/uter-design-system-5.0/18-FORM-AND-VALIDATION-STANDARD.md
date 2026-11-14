# 18 — 表单与验证标准（FORM AND VALIDATION STANDARD）

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S18` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01` |
| 生效日期 | `2026-11-14` |
| 适用范围 | 全部含表单的页面（12 类模板中的 Create / Edit / Settings / Profile / Authentication / Billing）、`web/src/components/ui/form.tsx` / `field.tsx` / `form-label-tier.tsx` / `input-otp.tsx`、各 feature 的 `lib/` schema |
| 验证状态 | `NOT_VERIFIED` |

> 本规范定义表单验证、错误展示与提交生命周期的 12 项契约。它是规范层文档，不代表表单已完成适配或已通过验证；本轮不修改任何业务代码、不改认证/授权/资金逻辑、不引入依赖、不执行 git 操作。

---

## 1. 目的与效力

1. 统一「字段验证 → 即时验证 → 提交验证 → 服务端错误 → 错误位置/优先级」的完整链路，落到项目既有 `react-hook-form + zod` 实现。
2. 固化「未保存提醒」「防重复提交」「i18n 文案 7 份 locale 同步」三项常被遗漏的约束。
3. 与 `web/AGENTS.md` 3.1（i18n）、3.7（表单）、3.9（错误处理）、3.13（安全）、3.14（测试）一致；冲突时以 `web/AGENTS.md` 为准。
4. 认证相关流程（`(auth)/` 9 个路由、邮箱验证码、step-up、WebAuthn/TOTP、登录 429 限流）为自建已定案，**只做 UI 规范映射，一律不替换、不改业务逻辑**（审计 §9 D8 / §6.1 红线）。

---

## 2. 事实基线（可核验，禁止假设）

| 项 | 真实值 | 来源 |
|---|---|---|
| 表单技术栈 | `react-hook-form ^7.91.0` + `zod 4.6.7` + `@hookform/resolvers` | 审计 §2 |
| 表单组件 | `ui/form.tsx` / `field.tsx` / `form-label-tier.tsx` / `input-otp.tsx`；另有 `ui/input.tsx` / `secret-input.tsx` / `input-group.tsx` | Clerk 分析 2.6 / 2.8 |
| schema 约定 | 功能模块 `lib/` 下定义 schema，`z.infer` 导出类型，`useForm` + `@hookform/resolvers/zod` 校验，提交逻辑放 `onSubmit` | `web/AGENTS.md` 3.7 |
| 服务端错误 | `handleServerError(error, fallbackMessage?)`；`form.setError` 映射字段；「相同失败沿 `cause` 传播时只提示一次；不同操作即使文案相同也分别提示」 | `web/AGENTS.md` §3.9 |
| 错误处理归属 | 拦截器不弹 Toast；`createAppQueryClient` 在 Query/Mutation 最终失败时提示；Mutation 自定义 `onError` 负责自己的提示或表单错误；自动重试与主动取消不报错；`meta.errorToast: false` 关闭自动提示 | `web/AGENTS.md` §3.9 |
| 业务失败契约 | `requireServerSuccess` 检查 `success:false`；`createServerError(response, fallbackMessage?)`；`AuthOperationError` 安全消息 | `web/AGENTS.md` §3.9 |
| i18n | 7 份 locale（`en,fr,ja,ru,vi,zh-TW,zh`），合计 54,573 行 | 审计 §2 |
| 文案 key | `src/i18n/static-keys.ts` 登记；常量只存 i18n 键，展示用 `t()` | `web/AGENTS.md` 3.1 |
| 前后端校验 | 前后端均做数据校验（Zod），不信任仅前端校验 | `web/AGENTS.md` 3.13 |
| 输入红线 | H5 输入 ≥16px 防 iOS 缩放；2px 焦点环（`ring-2`，已裁决） | `UDS5-S13` §7；`UDS5-S17` |
| 证据状态 | `VERIFIED 0 / PARTIAL 9 / NOT_VERIFIED 56`；`components:registry:strict EXIT=1` | 审计 §5 |

---

## 3. 12 项表单契约

| # | 主题 | 规则 | 代码落点 | 判定规则 |
|---|---|---|---|---|
| 1 | 字段验证 | 每个字段有 Zod schema、类型由 `z.infer` 导出；服务端与前端共用同一套约束语义 | feature `lib/` schema、`@hookform/resolvers/zod` | schema 存在且通过 `typecheck` |
| 2 | 即时验证 | 失焦（blur）或输入达阈值后校验；不得每次按键全表校验造成抖动 | `useForm` `mode` 配置 | 失焦触发、错误就近出现 |
| 3 | 提交验证 | `onSubmit` 前整表校验；不合法则阻断提交并聚焦首个错误字段 | `onSubmit`、`ui/form.tsx` | 非法提交不发起请求 |
| 4 | 服务端错误 | `handleServerError` 处理后，用 `form.setError` 映射到对应字段；不同操作分别提示 | `handleServerError` / `form.setError` | 字段级错误与 API 契约一致 |
| 5 | 错误位置 | 字段下方就近展示；`aria-invalid` + 错误边框/环同时生效 | `ui/form.tsx` / `field.tsx` | 错误可见且可访问 |
| 6 | 错误优先级 | 提交后服务端错误 > 提交时整表校验 > 即时字段校验 > 页面级提示 > 全局 Toast；同字段只显示最高优先级一条 | 表单错误聚合逻辑 | 不出现多条冲突错误 |
| 7 | 输入格式 | 数值走 `@/lib/format`；金额走 `@/lib/currency`；OTP 分段输入用 `ui/input-otp.tsx`；密钥用 `secret-input.tsx` | `ui/input-otp.tsx` 等 | 格式与 `UDS5-S19` 一致 |
| 8 | 自动填充 | 用原生 `autoComplete` 语义；密码/密钥/凭据不落前端存储 | 原生属性 + `web/AGENTS.md` 3.13 | 无敏感信息落 localStorage |
| 9 | 表单禁用 | 整表/逐字段 `disabled`；提交期间禁用输入与提交按钮；禁用态不得仅靠 `opacity` | `disabled` + `aria-busy` | 禁用可见且不可提交 |
| 10 | 表单保存 | 成功后按场景重置表单或关闭弹窗；**Mutation 失败不得当作保存成功** | `onSuccess` / `onError` | 失败时保留输入、不关闭 |
| 11 | 未保存提醒 | 有脏数据时离开/关闭需确认；路由级用 `beforeLoad` 之外的离开拦截，不改认证逻辑 | 路由离开拦截 + `confirm-dialog.tsx` | 脏数据离开必弹确认 |
| 12 | 防重复提交 | 提交中 `disabled + aria-busy`，Spinner 不改变按钮尺寸、不丢可访问名称 | `ui/button.tsx` `loading` | 连点不产生多次请求 |

---

## 3.1 验证时机四阶段（业务域蓝图补充）

> 来源：业务域蓝图《Form and Validation Standard》§3「验证时机」。**本节把 §3 契约第 2 / 3 条展开为可执行的阶段表**，不新增规则、不改契约编号。

| 阶段 | 触发时机 | 允许的校验范围 | 禁止 | 呈现方式 |
|---|---|---|---|---|
| V-1 输入中 | 每次按键 | **仅**安全的格式提示 / 轻量校验（长度上限、字符集、密码强度条等**不产生阻断**的提示） | 不得每次按键触发全表校验（抖动）；不得在输入中阻断提交 | 非阻断提示，不标红 |
| V-2 失焦 | `blur` | **字段级**校验（必填、格式、长度、范围） | 不得因失焦触发整表校验 | 就近错误（`aria-invalid` + 文字） |
| V-3 提交 | `onSubmit` 前 | **完整客户端校验**（整表 Zod），不合法则**阻断提交并聚焦首个错误字段** | 不得跳过客户端校验直接发请求 | 焦点移到首个错误字段 + 错误汇总 |
| V-4 服务端 | 响应返回 | **服务端再次校验**（客户端校验**不是安全边界**） | 不得信任仅前端校验的结果 | `form.setError` 映射到字段，或表单级 / 全局提示 |

**补充规则**

| # | 规则 |
|---|---|
| V-A | 客户端校验**不是安全边界**，服务端必须重复验证（与 §3 契约第 1、4 条、`web/AGENTS.md` 3.13「不信任仅前端校验」一致）。 |
| V-B | 校验**顺序不得倒置**：V-2 的过期结果必须被 V-3 覆盖（§4.2 优先级第 2 条）。 |
| V-C | **不得**在 V-1 阶段把「未验证」显示为「错误」；用户尚未离开字段时不应看到红色边框。 |
| V-D | V-4 的服务端错误**不得**覆盖 V-3 已修正的字段，除非服务端返回该字段的新错误。 |

## 3.2 字段结构与布局约束（业务域蓝图补充）

> 来源：业务域蓝图《Form and Validation Standard》§1–§2。

| 项 | 规则 | 仓库落点 / 状态 |
|---|---|---|
| 字段四要素 | 每个字段由 **Label + Control + Description（可选）+ Error（可选）** 组成 | `ui/form.tsx` / `field.tsx` / `form-label-tier.tsx`；`NOT_VERIFIED`（未逐字段核对） |
| 必填表达 | 必填状态必须通过**文本或语义标识**表达 | `NOT_VERIFIED` |
| Placeholder 禁令 | **placeholder 不得替代 Label** | `ui/input.tsx` 有 placeholder 支持，但**未核实**是否存在无 Label 用法；登记为 `S18-D1` |
| 默认布局 | 默认**垂直**表单 | `NOT_VERIFIED` |
| 字段组间距 | 16–24px（走 4px 阶梯 `gap-4` / `gap-6`） | 与 S05 一致 |
| 标签与控件间距 | 6–8px（走 `gap-1.5` / `gap-2`） | 与 S05 一致 |
| 错误位置 | 错误信息**紧邻字段** | 与 §4.1 一致 |
| 长表单 | 按任务分组，并显示**进度 / 步骤** | 蓝图 §2；仓库多步流程能力**未核实**；登记为 `S18-D2` |

## 3.3 异步验证的竞态保护（业务域蓝图补充）

> 来源：业务域蓝图《Form and Validation Standard》§5「异步校验应有 loading 状态、取消/过期处理和竞态保护。旧请求返回不得覆盖新输入的验证结果。」

| # | 规则 | 说明 |
|---|---|---|
| A-1 | **状态令牌 / 请求序号**：每次异步校验发起时递增一个单调序号；响应回来时**仅当序号仍为最新**才允许写入结果。旧响应一律丢弃。 | 防止「用户改了输入 → 旧请求后到 → 用旧结果覆盖新输入」 |
| A-2 | **过期与取消**：输入再次变化时，上一次在途请求应**取消**（`AbortController`）或至少标记为过期；组件卸载时必须取消在途请求。 | 避免竞态与内存泄漏 |
| A-3 | **Loading 状态**：异步校验期间字段显示处理中状态；**不得**因 loading 清除用户已输入内容。 | 与 §3 契约第 9 条「禁用态不得仅靠 opacity」一致 |
| A-4 | **客户端不判权威**：异步校验（账号唯一性、余额充足性等）结果**只是提示**，最终以提交时的服务端校验为准。 | 与 V-4 一致 |
| A-5 | **不得泄露账户存在性**：异步校验的错误文案**不得**透露「该账号 / 手机号 / 邮箱已存在」；须用不区分存在性的通用文案（登录、注册、找回密码场景尤其严格）。 | 蓝图 §4「不得泄露账户存在性」；与既有登录形态红线一致 |

**仓库现状（只读核查）**

| 项 | 结论 |
|---|---|
| 竞态保护机制 | 仓库使用 `@tanstack/react-query`（`createAppQueryClient`）+ `react-hook-form` + `zod`；**查询库自身提供请求去重 / 取消与 `enabled` 依赖机制**，表单层是否额外实现了「序号 / AbortController」竞态保护**未逐表单核实**，登记为 `S18-D3`。 |
| loading 态 | 提交期间 `disabled + aria-busy` 已有明确契约（§3 契约第 9、12 条）；**字段级**异步校验的 loading 呈现未核实。 |
| 账号存在性 | 登录 / 注册 / 找回密码的错误文案归属已有 `AuthOperationError` 安全消息（§2 事实基线「业务失败契约」），**方向与 A-5 一致**；具体文案未逐条核对。 |

## 3.4 错误文案与提交细则（业务域蓝图补充）

> 来源：业务域蓝图《Form and Validation Standard》§4 / §6。

| # | 规则 | 说明 |
|---|---|---|
| E-1 | 错误文案须说明**字段问题 + 修正方法**；禁止「输入错误」「失败」等**无行动价值**的泛化文案。 | 与 §4.2 定位一致 |
| E-2 | 错误文案**不得**泄露账户存在性、内部规则、堆栈、密钥或内部地址。 | 与 A-5、S13 §3.15 一致 |
| E-3 | 提交按钮显示 loading 并**防止重复提交**；**提交失败保留用户输入**；成功后**明确说明下一步**（跳转到哪里 / 还需做什么）。 | 与 §3 契约第 10、12 条一致 |
| E-4 | 离开页面可能丢失数据时提供提示。 | 与 §3 契约第 11 条一致 |

---

## 4. 错误位置与优先级（专节）

### 4.1 错误位置

| 层级 | 位置 | 组件 / 方式 |
|---|---|---|
| 字段级 | 该字段**正下方**就近展示，滚动到可见 | `field.tsx` / `FormMessage`；`form.setError` |
| 表单级 | 表单顶部汇总条（仅当错误无法归属单一字段） | `ui/form.tsx` + `ui/alert.tsx` |
| 页面级 | `errorComponent` 承接路由级错误 | `web/AGENTS.md` §3.9 |
| 全局 | `toast.error`（仅用于无归属的全局失败） | `sonner`（`UDS5-S20`） |

### 4.2 错误优先级

| 优先级 | 来源 | 覆盖关系 |
|---|---|---|
| 1（最高） | 提交后服务端字段错误 | 覆盖同字段的本地即时校验结果 |
| 2 | 提交时整表 Zod 校验 | 覆盖即时校验的过期结果 |
| 3 | 即时字段校验 | 用户修正后即时清除 |
| 4 | 表单级 / 页面级提示 | 不与字段级重复展示同一原因 |
| 5（最低） | 全局 Toast | 只承载无归属失败 |

**去重规则**：相同失败沿 `cause` 传播时只提示一次；不同操作即使文案相同也分别提示（`web/AGENTS.md` §3.9）。禁止把完整 Axios 错误对象（可能含凭据）直接写入管理或展示。

---

## 5. 服务端错误链路

| 步骤 | 动作 | 约束 |
|---|---|---|
| 1 | 请求失败 → `handleServerError(error, fallbackMessage?)` | 优先保留服务端具体原因 |
| 2 | 判定是否可映射到字段 | 能映射走 `form.setError`；不能映射走表单级/页面级 |
| 3 | 归属判定 | 拦截器**不弹 Toast**；由 `createAppQueryClient` 最终失败回调或 Mutation 自定义 `onError` 负责 |
| 4 | 关闭自动提示 | 需要自定义时设 `meta.errorToast: false`，页面仍可主动调用错误处理函数 |
| 5 | 静默场景 | 自动重试期间、主动取消 → 不报错 |
| 6 | 业务失败 | `requireServerSuccess` / `createServerError` 保留原始 API 响应契约；`AuthOperationError` 不解开被屏蔽细节 |
| 7 | 测试 | 覆盖异步失败、降级、字段映射、语言切换（`web/AGENTS.md` 3.14） |

> 支付 / 充值 / 退款 / 余额 / 订单 / 认证 / 授权相关表单**只改视觉与组件复用**，不改 API 契约、资金逻辑、数据库结构或安全约束（审计 §6.1 注、§13 第 2 条）。

---

## 6. i18n 文案同步（7 份 locale + `static-keys.ts`）

| 规则 | 内容 |
|---|---|
| 7 份同步 | 任何新增/修改的表单校验文案、占位符、成功/错误消息，必须同步 `en / fr / ja / ru / vi / zh-TW / zh` 7 份 locale，缺一即判定不合规 |
| 键登记 | 在 `src/i18n/static-keys.ts` 登记对应 key（若项目用其做提取），或确保文案以 `t('...')` 字面量形式出现以便扫描 |
| 常量约定 | `SUCCESS_MESSAGES` / `ERROR_MESSAGES` 常量值**仅表示 i18n 键**；展示必须 `toast.success(t(SUCCESS_MESSAGES.API_KEY_CREATED))`，禁止把常量当最终文案 |
| 状态 label | 用 `labelKey` + `t(config.labelKey)`，同一 feature 内只用一种方式，不混用 |
| 组件订阅 | 子组件自行 `useTranslation()`，保证语言切换重渲染（`web/AGENTS.md` 3.1） |
| 测试 | i18n 文案测试通过角色 / label / 翻译键语义定位，覆盖语言切换与 fallback（`web/AGENTS.md` 3.14 第 12 条） |
| 数值格式 | 表单内数值展示的 Intl 语言参数须 `toIntlLocale()` 转换，禁止 `zhCN` 直入 Intl（详见 `UDS5-S19`） |

---

## 7. 差异与例外登记

| 编号 | 内容 | 状态 |
|---|---|---|
| S18-D1 | 蓝图 §1 禁止 placeholder 替代 Label；仓库 `ui/input.tsx` 支持 placeholder，但**是否存在无 Label 用法未逐处核实** | `NOT_VERIFIED`（见 §3.2） |
| S18-D2 | 蓝图 §2 要求长表单显示进度 / 步骤；仓库多步流程能力未核实 | `NOT_VERIFIED`（见 §3.2） |
| S18-D3 | 蓝图 §5 要求异步校验竞态保护（序号 / `AbortController`）；仓库依赖 `@tanstack/react-query` 的去重 / 取消机制，**表单层是否另有竞态保护未逐表单核实** | `NOT_VERIFIED`（见 §3.3） |
| S18-D4 | 蓝图 §5 要求「不得泄露账户存在性」；仓库 `AuthOperationError` 安全消息方向一致，**具体文案未逐条核对** | `NOT_VERIFIED`（见 §3.3 A-5） |
| S18-D5 | 蓝图 §2 字段组间距 16–24px、标签与控件间距 6–8px —— 仓库走 4px 阶梯（`gap-4` / `gap-6` / `gap-1.5` / `gap-2`），**数值一致**，但**未设单一出口** | 已登记（无冲突，规则层面对齐） |
| S18-D6 | 蓝图 §3 四阶段验证时机已落为 §3.1 V-1～V-4，与 §3 契约第 2 / 3 / 4 条一致，**未新增冲突规则** | 已登记（对齐） |

---

## 与其他规范的关系

| 规范 | 关系 | 边界 |
|---|---|---|
| `UDS5-S01` | 效力来源 | 不重述总则 |
| `UDS5-S14` | 组件 Error / Disabled / Loading 态的存在性 | 本规范给表单链路 |
| `UDS5-S15` | Validation API（`invalid` / `aria-invalid`） | 组件不自行解析服务端错误 |
| `UDS5-S16` | Create / Edit / Settings / Profile 模板 | 「未保存提醒」「防重复提交」由模板承载 |
| `UDS5-S17` | Submit / Cancel / Retry / Confirm 五态 | 交互过程在 S17 |
| `UDS5-S19` | 输入/展示的数值、货币、时间格式 | 本规范只引用格式口径 |
| `UDS5-S20` | 成功/错误反馈组件映射与提示归属 | 本规范 §5 引用 §3.9，细化在 S20 |
| `web/AGENTS.md` | **强制上位约束**：3.1 / 3.7 / 3.9 / 3.13 / 3.14 | 冲突时以 `web/AGENTS.md` 为准 |

---

## 代码实施位置

| 用途 | 真实路径 | 本轮动作 |
|---|---|---|
| 表单基础组件 | `web/src/components/ui/form.tsx` / `field.tsx` / `form-label-tier.tsx` | **只读** |
| 输入组件 | `web/src/components/ui/input.tsx` / `secret-input.tsx` / `input-otp.tsx` / `input-group.tsx` | **只读** |
| 提交按钮 | `web/src/components/ui/button.tsx`（`loading` → `disabled + aria-busy`） | **只读** |
| 二次确认 | `web/src/components/confirm-dialog.tsx` | **只读** |
| schema | 各 feature 的 `lib/`（Zod + `z.infer`） | **只读** |
| 错误处理 | `handleServerError` / `createAppQueryClient` / `requireServerError` 系列（`web/AGENTS.md` §3.9） | **只读**，不改 |
| i18n | `web/src/i18n/locales/{en,fr,ja,ru,vi,zh-TW,zh}.json`、`web/src/i18n/static-keys.ts` | **只读**，不改 |
| 前端规范 | `web/AGENTS.md` | **只读**，约束来源 |
| 规范输出 | `docs/design-system/uter-design-system-5.0/18-FORM-AND-VALIDATION-STANDARD.md` | **本文件（新建）** |

> 未列出的脚本、路径、测试结果不出现在本规范中；不宣称已运行 `typecheck` / `lint` / 门禁。

---

## 自动化验证

| 验证项 | 真实命令 / 门禁 | 基线结果 | 本规范状态 |
|---|---|---|---|
| 类型检查 | `bun run typecheck` | 本轮未运行 | `NOT_VERIFIED` |
| Lint（含 `project/intl-locale`） | `bun run lint` | 本轮未运行 | `NOT_VERIFIED` |
| i18n 同步 | `i18n:sync` | 审计 §7 列为**未接入 CI** | `NOT_VERIFIED` |
| 表单回归测试 | Vitest + RTL（288 个 `*.test.ts(x)` 为基线，引用审计 §6） | 未重跑 | `NOT_VERIFIED` |
| 注册表证据 | `components:registry:strict` | **`EXIT=1`**，`VERIFIED 0 / PARTIAL 9 / NOT_VERIFIED 56` | 未重跑 |
| 12 项契约覆盖 | 无现成脚本 | 不可判定 | `NOT_VERIFIED` |
| 全量构建 | `bun run build:check` 等 | 并发 WIP 211 项，审计标 `NOT_EXECUTED` | **不执行** |

---

## 验证状态

| 项 | 状态 | 说明 |
|---|---|---|
| 本规范文本 | `ACTIVE` | 已撰写，供评审 |
| 12 项表单契约落地 | `NOT_VERIFIED` | 规范层定义，未跑门禁或测试 |
| 错误优先级 / 未保存提醒 / 防重复提交 | `NOT_VERIFIED` | 无现成校验脚本 |
| 7 份 locale 同步 + `static-keys.ts` | `NOT_VERIFIED` | 未核对，不宣称一致 |
| 65 个组件证据 | `NOT_VERIFIED` | `VERIFIED 0 / PARTIAL 9 / NOT_VERIFIED 56`，`components:registry:strict EXIT=1` |
| 认证/资金相关表单 | `NOT_VERIFIED` | 只做 UI 映射，业务逻辑零改动 |
| 全量构建 / 视觉回归 / E2E | `NOT_EXECUTED` | 审计 §1 / §7 / §13 / §14 约束 |
| Android / iOS / HarmonyOS | `NOT_VERIFIED` | 无真实实现（审计 §8、结论 C） |

> **最终状态低于 `FULLY_IMPLEMENTED_AND_VERIFIED`**：本规范不宣称任何表单行为已通过验证。
