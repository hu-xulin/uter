# UTER-AUTH-001 · 邮箱密码登录 — 产品需求文档（PRD）

> **投影文档 · 禁止直接手工编辑**。唯一权威数据源为 `docs/product/registry/product-model.json`（Single Source of Truth）。
> 请在产品规格中心（`http://127.0.0.1:7788/`）通过 PRD 或 Prototype 视图编辑；所有有效变更经统一模型事务化双写，并自动重渲染 PRD 与原型投影。
> 模型版本 **v1** · PRD 版本 v1 · 渲染于 2026-11-09T15:47:41.672Z · 设计基线 UDS 8.0.0

> **实现状态：`IMPLEMENTED` — 已实现（前后端均有证据）**。

## 1. 基础信息

| 字段 | 值 |
| --- | --- |
| Feature ID | `UTER-AUTH-001` |
| 功能名称 | 邮箱密码登录 |
| 业务模块 | auth |
| 领域 / Domain | AUTH |
| 实现状态 | `IMPLEMENTED` |
| 优先级 | P0 |
| 用户角色 | `guest` |
| PRD ID / 版本 | PRD-AUTH-001 / v1 |
| 原型 ID | PROTO-AUTH-001 |
| 原型文档 | `docs/product/prototypes/auth/UTER-AUTH-001.md` |
| 交互式原型（HTML） | `docs/product/prototypes/auth/UTER-AUTH-001.html` |
| 同步状态 | `SYNCED` |
| 最近同步 | 2026-11-09T00:00:00+08:00 |
| 最近变更来源 | INITIAL_SCAN |
| 权威数据模型 | `docs/product/registry/product-model.json` |
| 关联 Change ID | — |

## 2. 产品背景

- **目标**：让注册用户通过邮箱与密码安全进入 Uter 控制台。
- **问题**：控制台所有业务页面需要身份上下文，未登录用户不得访问。
- **使用场景**：
- 用户在登录页输入邮箱密码
- 密码错误或账号被禁用时给出明确提示
- 登录成功后跳转到控制台
- **边界 / 不含范围**：
- 不含注册、OAuth、Passkey，分别由 UTER-AUTH-002/004/005 覆盖

## 3. 用户角色

| 角色 | 可见性 / 权限 | 来源 |
| --- | --- | --- |
| guest | 具备「邮箱密码登录」访问权限 | 统一需求模型 roles 字段 |

- 权限约束：
- 仅 guest 可访问
- 前后端双重权限校验
## 4. 用户故事

| 角色 | 行为 | 价值 | 完整描述 |
| --- | --- | --- | --- |
| 访客 | 使用邮箱与密码登录 | 进入自己的控制台 | 作为访客，我希望使用邮箱与密码登录，从而进入自己的控制台。 |

## 5. 功能范围

### 5.1 范围内

- 用户在登录页输入邮箱密码
- 密码错误或账号被禁用时给出明确提示
- 登录成功后跳转到控制台
### 5.2 范围外

- 不含注册、OAuth、Passkey，分别由 UTER-AUTH-002/004/005 覆盖
### 5.3 上游依赖

`POST /api/user/login`, `GET /api/user/login/encryption-key`
### 5.4 下游依赖

`model/user.go`, `model/login_verification.go`

## 6. 业务流程

### 6.1 主流程

1. 进入 邮箱密码登录 · 主页面
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

### <a id="REQ-AUTH-001-01"></a>REQ-AUTH-001-01 · 邮箱密码登录

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P0 |
| 描述 | 登录页提供邮箱与密码输入，提交后调用 POST /api/user/login 建立会话。 |
| 页面入口 | `web/src/routes/(auth)/sign-in.tsx` |
| 输出 | 会话 Cookie / Token 与用户基本信息 |
| 权限 | guest |
| 数据变更 | UTER-AUTH-001 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-AUTH-001-01` |
| 关联组件 | `CMP-AUTH-001-01`, `CMP-AUTH-001-02`, `CMP-AUTH-001-03`, `CMP-AUTH-001-04`, `CMP-AUTH-001-05` |
| 关联交互 | `INT-AUTH-001-01` |
| 关联验收标准 | `AC-AUTH-001-01`, `AC-AUTH-001-02`, `AC-AUTH-001-03` |
| 关联测试用例 | `TC-AUTH-001-01` |
| 关联 Change ID | — |

**输入字段**

| 字段名 | 类型 | 必填 | 校验规则 |
| --- | --- | --- | --- |
| email | email | 是 | - 邮箱必须符合格式<br>- 密码不得为空<br>- 连续失败触发登录验证策略 |

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-AUTH-001-01-01 | 邮箱必须符合格式 | — | — | ACTIVE |
| BR-AUTH-001-01-02 | 密码不得为空 | — | — | ACTIVE |
| BR-AUTH-001-01-03 | 连续失败触发登录验证策略 | — | — | ACTIVE |

**错误提示**

- 邮箱必须符合格式
- 密码不得为空
### <a id="REQ-AUTH-001-02"></a>REQ-AUTH-001-02 · 登录失败反馈

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P0 |
| 描述 | 凭据错误、账号禁用、验证失败时展示可读错误，不泄露账号是否存在。 |
| 页面入口 | `web/src/routes/(auth)/sign-in.tsx` |
| 输出 | 操作结果与状态反馈 |
| 权限 | guest |
| 数据变更 | UTER-AUTH-001 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-AUTH-001-01` |
| 关联组件 | — |
| 关联交互 | `INT-AUTH-001-02` |
| 关联验收标准 | `AC-AUTH-001-04`, `AC-AUTH-001-05`, `AC-AUTH-001-06` |
| 关联测试用例 | `TC-AUTH-001-02` |
| 关联 Change ID | — |

**输入字段**

| 字段名 | 类型 | 必填 | 校验规则 |
| --- | --- | --- | --- |
| password | password | 是 | - 错误提示统一走 i18n<br>- 失败时不写入用户会话 |

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-AUTH-001-02-01 | 错误提示统一走 i18n | — | — | ACTIVE |
| BR-AUTH-001-02-02 | 失败时不写入用户会话 | — | — | ACTIVE |

**错误提示**

- 错误提示统一走 i18n
### <a id="REQ-AUTH-001-03"></a>REQ-AUTH-001-03 · 登录成功后跳转

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P0 |
| 描述 | 登录成功后返回来源页或控制台首页，并恢复用户上下文。 |
| 页面入口 | `web/src/routes/(auth)/sign-in.tsx` |
| 输出 | 跳转到 /dashboard/overview 或 return_path |
| 权限 | guest |
| 数据变更 | UTER-AUTH-001 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-AUTH-001-01` |
| 关联组件 | — |
| 关联交互 | `INT-AUTH-001-03` |
| 关联验收标准 | `AC-AUTH-001-07`, `AC-AUTH-001-08`, `AC-AUTH-001-09` |
| 关联测试用例 | `TC-AUTH-001-03` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-AUTH-001-03-01 | 未认证访问受保护页面时先跳转登录 | — | — | ACTIVE |

**错误提示**

—
## 8. 页面交互

| Prototype Page ID | 页面 | 布局 | 入口 | 状态 | 关联需求 |
| --- | --- | --- | --- | --- | --- |
| [PP-AUTH-001-01](docs/product/prototypes/auth/UTER-AUTH-001.md#PP-AUTH-001-01) | 邮箱密码登录 · 主页面 | center-form | `web/src/routes/(auth)/sign-in.tsx` | ACTIVE | `REQ-AUTH-001-01`, `REQ-AUTH-001-02`, `REQ-AUTH-001-03` |
| [PP-AUTH-001-02](docs/product/prototypes/auth/UTER-AUTH-001.md#PP-AUTH-001-02) | 邮箱密码登录 · 登录后落地页 | result | `由 PP-AUTH-001-01 的页面跳转进入` | ACTIVE | `REQ-AUTH-001-01` |

**交互清单**

| 页面 | Interaction ID | 名称 | 触发 | 动作 | 步骤 | 目标页面 |
| --- | --- | --- | --- | --- | --- | --- |
| PP-AUTH-001-01 | INT-AUTH-001-01 | 表单校验 | `submit:form` | `validate_form` | - submit:form<br>- validate_form | — |
| PP-AUTH-001-01 | INT-AUTH-001-02 | 打开安全验证弹窗 | `click:submit` | `open_modal` | - click:submit<br>- open_modal | — |
| PP-AUTH-001-01 | INT-AUTH-001-03 | 成功后跳转控制台 | `success` | `navigate` | - success<br>- navigate | PP-AUTH-001-02 |
| PP-AUTH-001-02 | INT-AUTH-001-100 | 返回主页面并恢复状态 | `click:back` | `restore_form_state` | - click:back<br>- restore_form_state | PP-AUTH-001-01 |

> 完整可操作原型（表单、按钮、弹窗、抽屉、列表、状态切换、跳转、状态恢复）见 **交互式 HTML 原型** `docs/product/prototypes/auth/UTER-AUTH-001.html`（可直接用浏览器打开，左原型 / 右 PRD 同源双栏）、产品规格中心左侧 Prototype 面板，及 `docs/product/prototypes/auth/UTER-AUTH-001.md`。

## 9. API 和数据模型

### 9.1 API

| API ID | 方法 | 路径 | 请求 | 响应 | 错误码 | 证据来源 |
| --- | --- | --- | --- | --- | --- | --- |
| API-AUTH-001-01 | POST | `/api/user/login` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-AUTH-001-02 | GET | `/api/user/login/encryption-key` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-AUTH-001-03 | GET | `/api/user/self` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |

### 9.2 数据模型

| Data Model ID | 模型 | 字段 | 证据来源 |
| --- | --- | --- | --- |
| DM-AUTH-001-01 | user.go | 见源码 | model/user.go |
| DM-AUTH-001-02 | login_verification.go | 见源码 | model/login_verification.go |

### 9.3 代码证据

- controller/user.go
- controller/login_verification.go
- service/auth_token.go
- router/api-router.go
- model/user.go
- model/login_verification.go

## 10. 验收标准（Given / When / Then）

| Acceptance ID | 类型 | Given | When | Then | 原型页面 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| AC-AUTH-001-01 | normal | 用户具有 guest 角色且已进入 邮箱密码登录 · 主页面 | 执行「邮箱密码登录」的正常操作 | 系统返回成功结果，且原型 PP-AUTH-001-01 可复现相同行为 | PP-AUTH-001-01 | ACTIVE |
| AC-AUTH-001-02 | exception | 输入不满足业务规则或上游返回错误 | 执行「邮箱密码登录」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-AUTH-001-01 | ACTIVE |
| AC-AUTH-001-03 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-AUTH-001-01 | ACTIVE |
| AC-AUTH-001-04 | normal | 用户具有 guest 角色且已进入 邮箱密码登录 · 主页面 | 执行「登录失败反馈」的正常操作 | 系统返回成功结果，且原型 PP-AUTH-001-01 可复现相同行为 | PP-AUTH-001-01 | ACTIVE |
| AC-AUTH-001-05 | exception | 输入不满足业务规则或上游返回错误 | 执行「登录失败反馈」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-AUTH-001-01 | ACTIVE |
| AC-AUTH-001-06 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-AUTH-001-01 | ACTIVE |
| AC-AUTH-001-07 | normal | 用户具有 guest 角色且已进入 邮箱密码登录 · 主页面 | 执行「登录成功后跳转」的正常操作 | 系统返回成功结果，且原型 PP-AUTH-001-01 可复现相同行为 | PP-AUTH-001-01 | ACTIVE |
| AC-AUTH-001-08 | exception | 输入不满足业务规则或上游返回错误 | 执行「登录成功后跳转」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-AUTH-001-01 | ACTIVE |
| AC-AUTH-001-09 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-AUTH-001-01 | ACTIVE |

## 11. 测试追溯

| Test Case ID | 名称 | 关联需求 | 关联验收 | 测试路径 | 类型 | 结果 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-AUTH-001-01 | REQ-AUTH-001-01 需求-原型-验收-测试追溯 | REQ-AUTH-001-01 | `AC-AUTH-001-01`, `AC-AUTH-001-02`, `AC-AUTH-001-03` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |
| TC-AUTH-001-02 | REQ-AUTH-001-02 需求-原型-验收-测试追溯 | REQ-AUTH-001-02 | `AC-AUTH-001-04`, `AC-AUTH-001-05`, `AC-AUTH-001-06` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |
| TC-AUTH-001-03 | REQ-AUTH-001-03 需求-原型-验收-测试追溯 | REQ-AUTH-001-03 | `AC-AUTH-001-07`, `AC-AUTH-001-08`, `AC-AUTH-001-09` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |

**代码层测试证据**

`controller/email_code_login_test.go`, `controller/auth_flow_test.go`, `controller/login_verification.go`
**页面 / API 证据**

`web/src/routes/(auth)/sign-in.tsx`, `web/src/routes/(auth)/route.tsx`, `POST /api/user/login`, `GET /api/user/login/encryption-key`, `GET /api/user/self`

## 12. 版本变更

| 版本 | 来源 | Change ID | 操作 | 同步状态 | 说明 |
| --- | --- | --- | --- | --- | --- |
| v1 | 基线 | INITIAL_BASELINE | 全量功能盘点建模 | SYNCED | 由真实代码证据建立初始统一需求模型 |
| v1 | System Generated | CHG-INIT-0001 | initial_scan | SYNCED | 基于真实代码盘点建立统一需求模型 |

> 版本快照：`docs/product/history/vN.json`。历史恢复会生成新的 Change ID 与快照，不覆盖既有历史。
