# UTER-AUTH-002 · 用户注册与邮箱验证 — 产品需求文档（PRD）

> **投影文档 · 禁止直接手工编辑**。唯一权威数据源为 `docs/product/registry/product-model.json`（Single Source of Truth）。
> 请在产品规格中心（`http://127.0.0.1:7788/`）通过 PRD 或 Prototype 视图编辑；所有有效变更经统一模型事务化双写，并自动重渲染 PRD 与原型投影。
> 模型版本 **v1** · PRD 版本 v1 · 渲染于 2026-11-09T15:47:41.680Z · 设计基线 UTER Design System 3.0

> **实现状态：`IMPLEMENTED` — 已实现（前后端均有证据）**。

## 1. 基础信息

| 字段 | 值 |
| --- | --- |
| Feature ID | `UTER-AUTH-002` |
| 功能名称 | 用户注册与邮箱验证 |
| 业务模块 | auth |
| 领域 / Domain | AUTH |
| 实现状态 | `IMPLEMENTED` |
| 优先级 | P0 |
| 用户角色 | `guest` |
| PRD ID / 版本 | PRD-AUTH-002 / v1 |
| 原型 ID | PROTO-AUTH-002 |
| 原型文档 | `docs/product/prototypes/auth/UTER-AUTH-002.md` |
| 交互式原型（HTML） | `docs/product/prototypes/auth/UTER-AUTH-002.html` |
| 同步状态 | `SYNCED` |
| 最近同步 | 2026-11-09T00:00:00+08:00 |
| 最近变更来源 | INITIAL_SCAN |
| 权威数据模型 | `docs/product/registry/product-model.json` |
| 关联 Change ID | — |

## 2. 产品背景

- **目标**：允许新用户注册账号并完成邮箱验证。
- **问题**：需要在注册阶段限制邮箱策略、验证码与重复注册。
- **使用场景**：
- 填写邮箱密码注册
- 邮箱验证码校验
- 注册开关关闭时禁止注册
- **边界 / 不含范围**：
- 不含 OAuth 注册时的邮箱策略差异细节

## 3. 用户角色

| 角色 | 可见性 / 权限 | 来源 |
| --- | --- | --- |
| guest | 具备「用户注册与邮箱验证」访问权限 | 统一需求模型 roles 字段 |

- 权限约束：
- 仅 guest 可访问
- 前后端双重权限校验
## 4. 用户故事

| 角色 | 行为 | 价值 | 完整描述 |
| --- | --- | --- | --- |
| 访客 | 注册并完成邮箱验证 | 获得可用账号 | 作为访客，我希望注册并完成邮箱验证，从而获得可用账号。 |

## 5. 功能范围

### 5.1 范围内

- 填写邮箱密码注册
- 邮箱验证码校验
- 注册开关关闭时禁止注册
### 5.2 范围外

- 不含 OAuth 注册时的邮箱策略差异细节
### 5.3 上游依赖

`POST /api/user/register`, `GET /api/verification`
### 5.4 下游依赖

`model/user.go`, `model/email_binding.go`

## 6. 业务流程

### 6.1 主流程

1. 进入 用户注册与邮箱验证 · 主页面
2. 填写/选择必要输入
3. 提交并校验
4. 展示成功结果与状态
### 6.2 异常流程

- 输入校验失败并提示
- 上游错误时展示错误状态
- 权限不足时展示 403 / 权限状态
### 6.3 边界流程

- 空数据展示空状态
- 加载中展示骨架/禁用态
- 重复提交被拦截
### 6.4 页面状态集合

`idle`, `loading`, `error`, `success`, `disabled`, `permission_denied`
### 6.5 状态恢复

- 失败后可重试
- 返回时恢复表单状态
- 变更可从历史版本恢复

## 7. 功能需求

### <a id="REQ-AUTH-002-01"></a>REQ-AUTH-002-01 · 注册表单

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P0 |
| 描述 | 收集邮箱、密码，按系统开关决定是否开放注册。 |
| 页面入口 | `web/src/routes/(auth)/sign-up.tsx` |
| 输出 | 操作结果与状态反馈 |
| 权限 | guest |
| 数据变更 | UTER-AUTH-002 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-AUTH-002-01` |
| 关联组件 | `CMP-AUTH-002-01`, `CMP-AUTH-002-02`, `CMP-AUTH-002-03`, `CMP-AUTH-002-04`, `CMP-AUTH-002-05` |
| 关联交互 | `INT-AUTH-002-01` |
| 关联验收标准 | `AC-AUTH-002-01`, `AC-AUTH-002-02`, `AC-AUTH-002-03` |
| 关联测试用例 | `TC-AUTH-002-01` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-AUTH-002-01-01 | 邮箱唯一 | — | — | ACTIVE |
| BR-AUTH-002-01-02 | 密码长度受系统策略约束 | — | — | ACTIVE |
| BR-AUTH-002-01-03 | 关闭注册时禁止提交 | — | — | ACTIVE |

**错误提示**

—
### <a id="REQ-AUTH-002-02"></a>REQ-AUTH-002-02 · 邮箱验证码

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P0 |
| 描述 | 发送并校验邮箱验证码，防止任意邮箱注册。 |
| 页面入口 | `web/src/routes/(auth)/sign-up.tsx` |
| 输出 | 操作结果与状态反馈 |
| 权限 | guest |
| 数据变更 | UTER-AUTH-002 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-AUTH-002-01` |
| 关联组件 | — |
| 关联交互 | `INT-AUTH-002-02` |
| 关联验收标准 | `AC-AUTH-002-04`, `AC-AUTH-002-05`, `AC-AUTH-002-06` |
| 关联测试用例 | `TC-AUTH-002-02` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-AUTH-002-02-01 | 验证码有时效 | — | — | ACTIVE |
| BR-AUTH-002-02-02 | 重发有频率限制 | — | — | ACTIVE |

**错误提示**

- 重发有频率限制
### <a id="REQ-AUTH-002-03"></a>REQ-AUTH-002-03 · 重复注册拦截

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P0 |
| 描述 | 已存在邮箱不得重复创建账号。 |
| 页面入口 | `web/src/routes/(auth)/sign-up.tsx` |
| 输出 | 操作结果与状态反馈 |
| 权限 | guest |
| 数据变更 | UTER-AUTH-002 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-AUTH-002-01` |
| 关联组件 | — |
| 关联交互 | `INT-AUTH-002-03` |
| 关联验收标准 | `AC-AUTH-002-07`, `AC-AUTH-002-08`, `AC-AUTH-002-09` |
| 关联测试用例 | `TC-AUTH-002-03` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-AUTH-002-03-01 | 相同邮箱返回明确业务错误 | — | — | ACTIVE |

**错误提示**

- 相同邮箱返回明确业务错误
## 8. 页面交互

| Prototype Page ID | 页面 | 布局 | 入口 | 状态 | 关联需求 |
| --- | --- | --- | --- | --- | --- |
| [PP-AUTH-002-01](docs/product/prototypes/auth/UTER-AUTH-002.md#PP-AUTH-002-01) | 用户注册与邮箱验证 · 主页面 | center-form | `web/src/routes/(auth)/sign-up.tsx` | ACTIVE | `REQ-AUTH-002-01`, `REQ-AUTH-002-02`, `REQ-AUTH-002-03` |
| [PP-AUTH-002-02](docs/product/prototypes/auth/UTER-AUTH-002.md#PP-AUTH-002-02) | 用户注册与邮箱验证 · 登录后落地页 | result | `由 PP-AUTH-002-01 的页面跳转进入` | ACTIVE | `REQ-AUTH-002-01` |

**交互清单**

| 页面 | Interaction ID | 名称 | 触发 | 动作 | 步骤 | 目标页面 |
| --- | --- | --- | --- | --- | --- | --- |
| PP-AUTH-002-01 | INT-AUTH-002-01 | 表单校验 | `submit:form` | `validate_form` | - submit:form<br>- validate_form | — |
| PP-AUTH-002-01 | INT-AUTH-002-02 | 打开安全验证弹窗 | `click:submit` | `open_modal` | - click:submit<br>- open_modal | — |
| PP-AUTH-002-01 | INT-AUTH-002-03 | 成功后跳转控制台 | `success` | `navigate` | - success<br>- navigate | PP-AUTH-002-02 |
| PP-AUTH-002-02 | INT-AUTH-002-100 | 返回主页面并恢复状态 | `click:back` | `restore_form_state` | - click:back<br>- restore_form_state | PP-AUTH-002-01 |

> 完整可操作原型（表单、按钮、弹窗、抽屉、列表、状态切换、跳转、状态恢复）见 **交互式 HTML 原型** `docs/product/prototypes/auth/UTER-AUTH-002.html`（可直接用浏览器打开，左原型 / 右 PRD 同源双栏）、产品规格中心左侧 Prototype 面板，及 `docs/product/prototypes/auth/UTER-AUTH-002.md`。

## 9. API 和数据模型

### 9.1 API

| API ID | 方法 | 路径 | 请求 | 响应 | 错误码 | 证据来源 |
| --- | --- | --- | --- | --- | --- | --- |
| API-AUTH-002-01 | POST | `/api/user/register` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-AUTH-002-02 | GET | `/api/verification` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-AUTH-002-03 | GET | `/api/user/login/email-code` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |

### 9.2 数据模型

| Data Model ID | 模型 | 字段 | 证据来源 |
| --- | --- | --- | --- |
| DM-AUTH-002-01 | user.go | 见源码 | model/user.go |
| DM-AUTH-002-02 | email_binding.go | 见源码 | model/email_binding.go |
| DM-AUTH-002-03 | email_quota.go | 见源码 | model/email_quota.go |

### 9.3 代码证据

- controller/user.go
- controller/email_binding.go
- controller/secure_verification.go
- model/user.go
- model/email_binding.go
- model/email_quota.go

## 10. 验收标准（Given / When / Then）

| Acceptance ID | 类型 | Given | When | Then | 原型页面 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| AC-AUTH-002-01 | normal | 用户具有 guest 角色且已进入 用户注册与邮箱验证 · 主页面 | 执行「注册表单」的正常操作 | 系统返回成功结果，且原型 PP-AUTH-002-01 可复现相同行为 | PP-AUTH-002-01 | ACTIVE |
| AC-AUTH-002-02 | exception | 输入不满足业务规则或上游返回错误 | 执行「注册表单」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-AUTH-002-01 | ACTIVE |
| AC-AUTH-002-03 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-AUTH-002-01 | ACTIVE |
| AC-AUTH-002-04 | normal | 用户具有 guest 角色且已进入 用户注册与邮箱验证 · 主页面 | 执行「邮箱验证码」的正常操作 | 系统返回成功结果，且原型 PP-AUTH-002-01 可复现相同行为 | PP-AUTH-002-01 | ACTIVE |
| AC-AUTH-002-05 | exception | 输入不满足业务规则或上游返回错误 | 执行「邮箱验证码」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-AUTH-002-01 | ACTIVE |
| AC-AUTH-002-06 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-AUTH-002-01 | ACTIVE |
| AC-AUTH-002-07 | normal | 用户具有 guest 角色且已进入 用户注册与邮箱验证 · 主页面 | 执行「重复注册拦截」的正常操作 | 系统返回成功结果，且原型 PP-AUTH-002-01 可复现相同行为 | PP-AUTH-002-01 | ACTIVE |
| AC-AUTH-002-08 | exception | 输入不满足业务规则或上游返回错误 | 执行「重复注册拦截」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-AUTH-002-01 | ACTIVE |
| AC-AUTH-002-09 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-AUTH-002-01 | ACTIVE |

## 11. 测试追溯

| Test Case ID | 名称 | 关联需求 | 关联验收 | 测试路径 | 类型 | 结果 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-AUTH-002-01 | REQ-AUTH-002-01 需求-原型-验收-测试追溯 | REQ-AUTH-002-01 | `AC-AUTH-002-01`, `AC-AUTH-002-02`, `AC-AUTH-002-03` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |
| TC-AUTH-002-02 | REQ-AUTH-002-02 需求-原型-验收-测试追溯 | REQ-AUTH-002-02 | `AC-AUTH-002-04`, `AC-AUTH-002-05`, `AC-AUTH-002-06` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |
| TC-AUTH-002-03 | REQ-AUTH-002-03 需求-原型-验收-测试追溯 | REQ-AUTH-002-03 | `AC-AUTH-002-07`, `AC-AUTH-002-08`, `AC-AUTH-002-09` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |

**代码层测试证据**

`controller/oauth_registration_email_policy_test.go`, `controller/email_delivery_test.go`, `service/email_policy_test.go`
**页面 / API 证据**

`web/src/routes/(auth)/sign-up.tsx`, `web/src/routes/(auth)/register.tsx`, `POST /api/user/register`, `GET /api/verification`, `GET /api/user/login/email-code`

## 12. 版本变更

| 版本 | 来源 | Change ID | 操作 | 同步状态 | 说明 |
| --- | --- | --- | --- | --- | --- |
| v1 | 基线 | INITIAL_BASELINE | 全量功能盘点建模 | SYNCED | 由真实代码证据建立初始统一需求模型 |
| v1 | System Generated | CHG-INIT-0001 | initial_scan | SYNCED | 基于真实代码盘点建立统一需求模型 |

> 版本快照：`docs/product/history/vN.json`。历史恢复会生成新的 Change ID 与快照，不覆盖既有历史。
