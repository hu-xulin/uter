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
