# UTER-AUTH-003 · 密码找回与重置 — 产品需求文档（PRD）

> **投影文档 · 禁止直接手工编辑**。唯一权威数据源为 `docs/product/registry/product-model.json`（Single Source of Truth）。
> 请在产品规格中心（`http://127.0.0.1:7788/`）通过 PRD 或 Prototype 视图编辑；所有有效变更经统一模型事务化双写，并自动重渲染 PRD 与原型投影。
> 模型版本 **v1** · PRD 版本 v1 · 渲染于 2026-11-09T15:47:41.685Z · 设计基线 UTER Design System 3.0

> **实现状态：`IMPLEMENTED` — 已实现（前后端均有证据）**。

## 1. 基础信息

| 字段 | 值 |
| --- | --- |
| Feature ID | `UTER-AUTH-003` |
| 功能名称 | 密码找回与重置 |
| 业务模块 | auth |
| 领域 / Domain | AUTH |
| 实现状态 | `IMPLEMENTED` |
| 优先级 | P0 |
| 用户角色 | `guest`, `user` |
| PRD ID / 版本 | PRD-AUTH-003 / v1 |
| 原型 ID | PROTO-AUTH-003 |
| 原型文档 | `docs/product/prototypes/auth/UTER-AUTH-003.md` |
| 交互式原型（HTML） | `docs/product/prototypes/auth/UTER-AUTH-003.html` |
| 同步状态 | `SYNCED` |
| 最近同步 | 2026-11-09T00:00:00+08:00 |
| 最近变更来源 | INITIAL_SCAN |
| 权威数据模型 | `docs/product/registry/product-model.json` |
| 关联 Change ID | — |

## 2. 产品背景

- **目标**：用户忘记密码时可通过验证流程重置密码。
- **问题**：需要保证重置链接/验证码不可被滥用。
- **使用场景**：
- 发起找回
- 校验验证码
- 设置新密码
- 已登录后修改密码
- **边界 / 不含范围**：
- 不含管理员强制重置用户密码

## 3. 用户角色

| 角色 | 可见性 / 权限 | 来源 |
| --- | --- | --- |
| guest | 具备「密码找回与重置」访问权限 | 统一需求模型 roles 字段 |
| user | 具备「密码找回与重置」访问权限 | 统一需求模型 roles 字段 |

- 权限约束：
- 仅 guest / user 可访问
- 前后端双重权限校验
## 4. 用户故事

| 角色 | 行为 | 价值 | 完整描述 |
| --- | --- | --- | --- |
| 忘记密码的用户 | 通过邮箱验证重置密码 | 重新登录账号 | 作为忘记密码的用户，我希望通过邮箱验证重置密码，从而重新登录账号。 |

## 5. 功能范围

### 5.1 范围内

- 发起找回
- 校验验证码
- 设置新密码
- 已登录后修改密码
### 5.2 范围外

- 不含管理员强制重置用户密码
### 5.3 上游依赖

`GET /api/reset_password`, `POST /api/user/reset_password`
### 5.4 下游依赖

`model/password_crypto.go`, `model/user.go`

## 6. 业务流程

### 6.1 主流程

1. 进入 密码找回与重置 · 主页面
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

### <a id="REQ-AUTH-003-01"></a>REQ-AUTH-003-01 · 发起密码找回

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P0 |
| 描述 | 输入邮箱后发送重置验证码/链接。 |
| 页面入口 | `web/src/routes/(auth)/forgot-password.tsx` |
| 输出 | 操作结果与状态反馈 |
| 权限 | guest, user |
| 数据变更 | UTER-AUTH-003 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-AUTH-003-01` |
| 关联组件 | `CMP-AUTH-003-01`, `CMP-AUTH-003-02`, `CMP-AUTH-003-03`, `CMP-AUTH-003-04`, `CMP-AUTH-003-05` |
| 关联交互 | `INT-AUTH-003-01` |
| 关联验收标准 | `AC-AUTH-003-01`, `AC-AUTH-003-02`, `AC-AUTH-003-03` |
| 关联测试用例 | `TC-AUTH-003-01` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-AUTH-003-01-01 | 统一错误提示避免邮箱枚举 | — | — | ACTIVE |
| BR-AUTH-003-01-02 | 发送频率受限 | — | — | ACTIVE |

**错误提示**

- 统一错误提示避免邮箱枚举
### <a id="REQ-AUTH-003-02"></a>REQ-AUTH-003-02 · 重置密码

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P0 |
| 描述 | 校验验证码后设置新密码并使旧会话失效。 |
| 页面入口 | `web/src/routes/(auth)/forgot-password.tsx` |
| 输出 | 操作结果与状态反馈 |
| 权限 | guest, user |
| 数据变更 | UTER-AUTH-003 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-AUTH-003-01` |
| 关联组件 | — |
| 关联交互 | `INT-AUTH-003-02`, `INT-AUTH-003-03` |
| 关联验收标准 | `AC-AUTH-003-04`, `AC-AUTH-003-05`, `AC-AUTH-003-06` |
| 关联测试用例 | `TC-AUTH-003-02` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-AUTH-003-02-01 | 新密码需满足密码策略 | — | — | ACTIVE |
| BR-AUTH-003-02-02 | 验证码一次性 | — | — | ACTIVE |

**错误提示**

—
## 8. 页面交互

| Prototype Page ID | 页面 | 布局 | 入口 | 状态 | 关联需求 |
| --- | --- | --- | --- | --- | --- |
| [PP-AUTH-003-01](docs/product/prototypes/auth/UTER-AUTH-003.md#PP-AUTH-003-01) | 密码找回与重置 · 主页面 | center-form | `web/src/routes/(auth)/forgot-password.tsx` | ACTIVE | `REQ-AUTH-003-01`, `REQ-AUTH-003-02` |
| [PP-AUTH-003-02](docs/product/prototypes/auth/UTER-AUTH-003.md#PP-AUTH-003-02) | 密码找回与重置 · 登录后落地页 | result | `由 PP-AUTH-003-01 的页面跳转进入` | ACTIVE | `REQ-AUTH-003-01` |

**交互清单**

| 页面 | Interaction ID | 名称 | 触发 | 动作 | 步骤 | 目标页面 |
| --- | --- | --- | --- | --- | --- | --- |
| PP-AUTH-003-01 | INT-AUTH-003-01 | 表单校验 | `submit:form` | `validate_form` | - submit:form<br>- validate_form | — |
| PP-AUTH-003-01 | INT-AUTH-003-02 | 打开安全验证弹窗 | `click:submit` | `open_modal` | - click:submit<br>- open_modal | — |
| PP-AUTH-003-01 | INT-AUTH-003-03 | 成功后跳转控制台 | `success` | `navigate` | - success<br>- navigate | PP-AUTH-003-02 |
| PP-AUTH-003-02 | INT-AUTH-003-100 | 返回主页面并恢复状态 | `click:back` | `restore_form_state` | - click:back<br>- restore_form_state | PP-AUTH-003-01 |

> 完整可操作原型（表单、按钮、弹窗、抽屉、列表、状态切换、跳转、状态恢复）见 **交互式 HTML 原型** `docs/product/prototypes/auth/UTER-AUTH-003.html`（可直接用浏览器打开，左原型 / 右 PRD 同源双栏）、产品规格中心左侧 Prototype 面板，及 `docs/product/prototypes/auth/UTER-AUTH-003.md`。

## 9. API 和数据模型

### 9.1 API

| API ID | 方法 | 路径 | 请求 | 响应 | 错误码 | 证据来源 |
| --- | --- | --- | --- | --- | --- | --- |
| API-AUTH-003-01 | GET | `/api/reset_password` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-AUTH-003-02 | POST | `/api/user/reset_password` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |

### 9.2 数据模型

| Data Model ID | 模型 | 字段 | 证据来源 |
| --- | --- | --- | --- |
| DM-AUTH-003-01 | password_crypto.go | 见源码 | model/password_crypto.go |
| DM-AUTH-003-02 | user.go | 见源码 | model/user.go |

### 9.3 代码证据

- controller/user.go
- model/password_crypto.go
- model/password_crypto.go
- model/user.go

## 10. 验收标准（Given / When / Then）

| Acceptance ID | 类型 | Given | When | Then | 原型页面 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| AC-AUTH-003-01 | normal | 用户具有 guest / user 角色且已进入 密码找回与重置 · 主页面 | 执行「发起密码找回」的正常操作 | 系统返回成功结果，且原型 PP-AUTH-003-01 可复现相同行为 | PP-AUTH-003-01 | ACTIVE |
| AC-AUTH-003-02 | exception | 输入不满足业务规则或上游返回错误 | 执行「发起密码找回」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-AUTH-003-01 | ACTIVE |
| AC-AUTH-003-03 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-AUTH-003-01 | ACTIVE |
| AC-AUTH-003-04 | normal | 用户具有 guest / user 角色且已进入 密码找回与重置 · 主页面 | 执行「重置密码」的正常操作 | 系统返回成功结果，且原型 PP-AUTH-003-01 可复现相同行为 | PP-AUTH-003-01 | ACTIVE |
| AC-AUTH-003-05 | exception | 输入不满足业务规则或上游返回错误 | 执行「重置密码」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-AUTH-003-01 | ACTIVE |
| AC-AUTH-003-06 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-AUTH-003-01 | ACTIVE |

## 11. 测试追溯

| Test Case ID | 名称 | 关联需求 | 关联验收 | 测试路径 | 类型 | 结果 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-AUTH-003-01 | REQ-AUTH-003-01 需求-原型-验收-测试追溯 | REQ-AUTH-003-01 | `AC-AUTH-003-01`, `AC-AUTH-003-02`, `AC-AUTH-003-03` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |
| TC-AUTH-003-02 | REQ-AUTH-003-02 需求-原型-验收-测试追溯 | REQ-AUTH-003-02 | `AC-AUTH-003-04`, `AC-AUTH-003-05`, `AC-AUTH-003-06` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |

**代码层测试证据**

`controller/user_test.go`, `model/password_crypto.go`
**页面 / API 证据**

`web/src/routes/(auth)/forgot-password.tsx`, `web/src/routes/(auth)/reset.tsx`, `web/src/routes/(auth)/user/reset.tsx`, `GET /api/reset_password`, `POST /api/user/reset_password`

## 12. 版本变更

| 版本 | 来源 | Change ID | 操作 | 同步状态 | 说明 |
| --- | --- | --- | --- | --- | --- |
| v1 | 基线 | INITIAL_BASELINE | 全量功能盘点建模 | SYNCED | 由真实代码证据建立初始统一需求模型 |
| v1 | System Generated | CHG-INIT-0001 | initial_scan | SYNCED | 基于真实代码盘点建立统一需求模型 |

> 版本快照：`docs/product/history/vN.json`。历史恢复会生成新的 Change ID 与快照，不覆盖既有历史。
