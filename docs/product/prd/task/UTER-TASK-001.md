# UTER-TASK-001 · 异步任务创建、查询与产物 — 产品需求文档（PRD）

> **投影文档 · 禁止直接手工编辑**。唯一权威数据源为 `docs/product/registry/product-model.json`（Single Source of Truth）。
> 请在产品规格中心（`http://127.0.0.1:7788/`）通过 PRD 或 Prototype 视图编辑；所有有效变更经统一模型事务化双写，并自动重渲染 PRD 与原型投影。
> 模型版本 **v1** · PRD 版本 v1 · 渲染于 2026-11-09T15:47:41.746Z · 设计基线 UTER Design System 3.0

> **实现状态：`IMPLEMENTED` — 已实现（前后端均有证据）**。

## 1. 基础信息

| 字段 | 值 |
| --- | --- |
| Feature ID | `UTER-TASK-001` |
| 功能名称 | 异步任务创建、查询与产物 |
| 业务模块 | task |
| 领域 / Domain | TASK |
| 实现状态 | `IMPLEMENTED` |
| 优先级 | P1 |
| 用户角色 | `user`, `developer` |
| PRD ID / 版本 | PRD-TASK-001 / v1 |
| 原型 ID | PROTO-TASK-001 |
| 原型文档 | `docs/product/prototypes/task/UTER-TASK-001.md` |
| 交互式原型（HTML） | `docs/product/prototypes/task/UTER-TASK-001.html` |
| 同步状态 | `SYNCED` |
| 最近同步 | 2026-11-09T00:00:00+08:00 |
| 最近变更来源 | INITIAL_SCAN |
| 权威数据模型 | `docs/product/registry/product-model.json` |
| 关联 Change ID | — |

## 2. 产品背景

- **目标**：提交异步任务、查询状态、获取结果与产物。
- **问题**：长耗时生成类请求不能同步等待。
- **使用场景**：
- 提交任务
- 轮询状态
- 失败重试
- 下载产物
- **边界 / 不含范围**：
- 不含插件管理（UTER-TASK-002）

## 3. 用户角色

| 角色 | 可见性 / 权限 | 来源 |
| --- | --- | --- |
| user | 具备「异步任务创建、查询与产物」访问权限 | 统一需求模型 roles 字段 |
| developer | 具备「异步任务创建、查询与产物」访问权限 | 统一需求模型 roles 字段 |

- 权限约束：
- 仅 user / developer 可访问
- 前后端双重权限校验
## 4. 用户故事

| 角色 | 行为 | 价值 | 完整描述 |
| --- | --- | --- | --- |
| 用户 | 提交并跟踪异步任务 | 获取生成结果 | 作为用户，我希望提交并跟踪异步任务，从而获取生成结果。 |

## 5. 功能范围

### 5.1 范围内

- 提交任务
- 轮询状态
- 失败重试
- 下载产物
### 5.2 范围外

- 不含插件管理（UTER-TASK-002）
### 5.3 上游依赖

`POST /api/task/:key`, `GET /api/task/:key`
### 5.4 下游依赖

`model/task.go`, `model/midjourney.go`

## 6. 业务流程

### 6.1 主流程

1. 进入 异步任务创建、查询与产物 · 主页面
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

`idle`, `loading`, `empty`, `error`, `success`, `permission_denied`
### 6.5 状态恢复

- 失败后可重试
- 返回时恢复表单状态
- 变更可从历史版本恢复

## 7. 功能需求

### <a id="REQ-TASK-001-01"></a>REQ-TASK-001-01 · 任务提交

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P1 |
| 描述 | 通过任务插件 Key 提交任务并获取任务 ID。 |
| 页面入口 | `web/src/routes/_authenticated/usage-logs/$section.tsx` |
| 输出 | 操作结果与状态反馈 |
| 权限 | user, developer |
| 数据变更 | UTER-TASK-001 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-TASK-001-01` |
| 关联组件 | `CMP-TASK-001-01`, `CMP-TASK-001-02`, `CMP-TASK-001-03`, `CMP-TASK-001-04`, `CMP-TASK-001-05`, `CMP-TASK-001-06` |
| 关联交互 | `INT-TASK-001-01` |
| 关联验收标准 | `AC-TASK-001-01`, `AC-TASK-001-02`, `AC-TASK-001-03` |
| 关联测试用例 | `TC-TASK-001-01` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-TASK-001-01-01 | 无效 Key 拒绝 | — | — | ACTIVE |
| BR-TASK-001-01-02 | 参数按插件 schema 校验 | — | — | ACTIVE |

**错误提示**

- 无效 Key 拒绝
### <a id="REQ-TASK-001-02"></a>REQ-TASK-001-02 · 状态查询

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P1 |
| 描述 | 查询任务状态、进度与结果。 |
| 页面入口 | `web/src/routes/_authenticated/usage-logs/$section.tsx` |
| 输出 | 操作结果与状态反馈 |
| 权限 | user, developer |
| 数据变更 | UTER-TASK-001 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-TASK-001-01` |
| 关联组件 | — |
| 关联交互 | `INT-TASK-001-02` |
| 关联验收标准 | `AC-TASK-001-04`, `AC-TASK-001-05`, `AC-TASK-001-06` |
| 关联测试用例 | `TC-TASK-001-02` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-TASK-001-02-01 | 仅可查询自己或有权限的任务 | — | — | ACTIVE |

**错误提示**

—
### <a id="REQ-TASK-001-03"></a>REQ-TASK-001-03 · 产物获取

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P1 |
| 描述 | 按 artifact_key 获取任务产物。 |
| 页面入口 | `web/src/routes/_authenticated/usage-logs/$section.tsx` |
| 输出 | 操作结果与状态反馈 |
| 权限 | user, developer |
| 数据变更 | UTER-TASK-001 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-TASK-001-01` |
| 关联组件 | — |
| 关联交互 | `INT-TASK-001-03`, `INT-TASK-001-04` |
| 关联验收标准 | `AC-TASK-001-07`, `AC-TASK-001-08`, `AC-TASK-001-09` |
| 关联测试用例 | `TC-TASK-001-03` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-TASK-001-03-01 | 路径穿越必须拒绝 | — | — | ACTIVE |

**错误提示**

- 路径穿越必须拒绝
## 8. 页面交互

| Prototype Page ID | 页面 | 布局 | 入口 | 状态 | 关联需求 |
| --- | --- | --- | --- | --- | --- |
| [PP-TASK-001-01](docs/product/prototypes/task/UTER-TASK-001.md#PP-TASK-001-01) | 异步任务创建、查询与产物 · 主页面 | task-console | `web/src/routes/_authenticated/usage-logs/$section.tsx` | ACTIVE | `REQ-TASK-001-01`, `REQ-TASK-001-02`, `REQ-TASK-001-03` |
| [PP-TASK-001-02](docs/product/prototypes/task/UTER-TASK-001.md#PP-TASK-001-02) | 异步任务创建、查询与产物 · 任务产物 | detail | `由 PP-TASK-001-01 的页面跳转进入` | ACTIVE | `REQ-TASK-001-01` |

**交互清单**

| 页面 | Interaction ID | 名称 | 触发 | 动作 | 步骤 | 目标页面 |
| --- | --- | --- | --- | --- | --- | --- |
| PP-TASK-001-01 | INT-TASK-001-01 | 提交任务 | `click:submit_task` | `create_task` | - click:submit_task<br>- create_task | — |
| PP-TASK-001-01 | INT-TASK-001-02 | 轮询状态 | `timer` | `poll_status` | - timer<br>- poll_status | — |
| PP-TASK-001-01 | INT-TASK-001-03 | 失败重试 | `click:retry` | `retry` | - click:retry<br>- retry | — |
| PP-TASK-001-01 | INT-TASK-001-04 | 查看产物 | `click:artifact` | `navigate` | - click:artifact<br>- navigate | PP-TASK-001-02 |
| PP-TASK-001-02 | INT-TASK-001-100 | 返回主页面并恢复状态 | `click:back` | `restore_form_state` | - click:back<br>- restore_form_state | PP-TASK-001-01 |

> 完整可操作原型（表单、按钮、弹窗、抽屉、列表、状态切换、跳转、状态恢复）见 **交互式 HTML 原型** `docs/product/prototypes/task/UTER-TASK-001.html`（可直接用浏览器打开，左原型 / 右 PRD 同源双栏）、产品规格中心左侧 Prototype 面板，及 `docs/product/prototypes/task/UTER-TASK-001.md`。

## 9. API 和数据模型

### 9.1 API

| API ID | 方法 | 路径 | 请求 | 响应 | 错误码 | 证据来源 |
| --- | --- | --- | --- | --- | --- | --- |
| API-TASK-001-01 | POST | `/api/task/:key` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-TASK-001-02 | GET | `/api/task/:key` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-TASK-001-03 | GET | `/api/task/:key/artifacts` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-TASK-001-04 | GET | `/api/task/:key/artifacts/:artifact_key/content` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-TASK-001-05 | GET | `/api/task/:task_id` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |

### 9.2 数据模型

| Data Model ID | 模型 | 字段 | 证据来源 |
| --- | --- | --- | --- |
| DM-TASK-001-01 | task.go | 见源码 | model/task.go |
| DM-TASK-001-02 | midjourney.go | 见源码 | model/midjourney.go |

### 9.3 代码证据

- controller/task.go
- router/task-router.go
- controller/task_plugin.go
- service/file_service.go
- model/task.go
- model/midjourney.go

## 10. 验收标准（Given / When / Then）

| Acceptance ID | 类型 | Given | When | Then | 原型页面 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| AC-TASK-001-01 | normal | 用户具有 user / developer 角色且已进入 异步任务创建、查询与产物 · 主页面 | 执行「任务提交」的正常操作 | 系统返回成功结果，且原型 PP-TASK-001-01 可复现相同行为 | PP-TASK-001-01 | ACTIVE |
| AC-TASK-001-02 | exception | 输入不满足业务规则或上游返回错误 | 执行「任务提交」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-TASK-001-01 | ACTIVE |
| AC-TASK-001-03 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-TASK-001-01 | ACTIVE |
| AC-TASK-001-04 | normal | 用户具有 user / developer 角色且已进入 异步任务创建、查询与产物 · 主页面 | 执行「状态查询」的正常操作 | 系统返回成功结果，且原型 PP-TASK-001-01 可复现相同行为 | PP-TASK-001-01 | ACTIVE |
| AC-TASK-001-05 | exception | 输入不满足业务规则或上游返回错误 | 执行「状态查询」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-TASK-001-01 | ACTIVE |
| AC-TASK-001-06 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-TASK-001-01 | ACTIVE |
| AC-TASK-001-07 | normal | 用户具有 user / developer 角色且已进入 异步任务创建、查询与产物 · 主页面 | 执行「产物获取」的正常操作 | 系统返回成功结果，且原型 PP-TASK-001-01 可复现相同行为 | PP-TASK-001-01 | ACTIVE |
| AC-TASK-001-08 | exception | 输入不满足业务规则或上游返回错误 | 执行「产物获取」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-TASK-001-01 | ACTIVE |
| AC-TASK-001-09 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-TASK-001-01 | ACTIVE |

## 11. 测试追溯

| Test Case ID | 名称 | 关联需求 | 关联验收 | 测试路径 | 类型 | 结果 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-TASK-001-01 | REQ-TASK-001-01 需求-原型-验收-测试追溯 | REQ-TASK-001-01 | `AC-TASK-001-01`, `AC-TASK-001-02`, `AC-TASK-001-03` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |
| TC-TASK-001-02 | REQ-TASK-001-02 需求-原型-验收-测试追溯 | REQ-TASK-001-02 | `AC-TASK-001-04`, `AC-TASK-001-05`, `AC-TASK-001-06` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |
| TC-TASK-001-03 | REQ-TASK-001-03 需求-原型-验收-测试追溯 | REQ-TASK-001-03 | `AC-TASK-001-07`, `AC-TASK-001-08`, `AC-TASK-001-09` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |

**代码层测试证据**

`controller/task_generic_test.go`, `controller/task_log_view_test.go`, `router/task_router_test.go`
**页面 / API 证据**

`web/src/routes/_authenticated/usage-logs/$section.tsx`, `web/src/features/usage-logs`, `POST /api/task/:key`, `GET /api/task/:key`, `GET /api/task/:key/artifacts`, `GET /api/task/:key/artifacts/:artifact_key/content`, `GET /api/task/:task_id`

## 12. 版本变更

| 版本 | 来源 | Change ID | 操作 | 同步状态 | 说明 |
| --- | --- | --- | --- | --- | --- |
| v1 | 基线 | INITIAL_BASELINE | 全量功能盘点建模 | SYNCED | 由真实代码证据建立初始统一需求模型 |
| v1 | System Generated | CHG-INIT-0001 | initial_scan | SYNCED | 基于真实代码盘点建立统一需求模型 |

> 版本快照：`docs/product/history/vN.json`。历史恢复会生成新的 Change ID 与快照，不覆盖既有历史。
