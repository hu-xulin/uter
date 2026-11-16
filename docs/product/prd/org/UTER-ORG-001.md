# UTER-ORG-001 · 组织与成员管理 — 产品需求文档（PRD）

> **投影文档 · 禁止直接手工编辑**。唯一权威数据源为 `docs/product/registry/product-model.json`（Single Source of Truth）。
> 请在产品规格中心（`http://127.0.0.1:7788/`）通过 PRD 或 Prototype 视图编辑；所有有效变更经统一模型事务化双写，并自动重渲染 PRD 与原型投影。
> 模型版本 **v1** · PRD 版本 v1 · 渲染于 2026-11-09T15:47:41.763Z · 设计基线 UDS 8.0.0

> **实现状态：`IMPLEMENTED` — 已实现（前后端均有证据）**。

## 1. 基础信息

| 字段 | 值 |
| --- | --- |
| Feature ID | `UTER-ORG-001` |
| 功能名称 | 组织与成员管理 |
| 业务模块 | org |
| 领域 / Domain | ORG |
| 实现状态 | `IMPLEMENTED` |
| 优先级 | P1 |
| 用户角色 | `user`, `admin` |
| PRD ID / 版本 | PRD-ORG-001 / v1 |
| 原型 ID | PROTO-ORG-001 |
| 原型文档 | `docs/product/prototypes/org/UTER-ORG-001.md` |
| 交互式原型（HTML） | `docs/product/prototypes/org/UTER-ORG-001.html` |
| 同步状态 | `SYNCED` |
| 最近同步 | 2026-11-09T00:00:00+08:00 |
| 最近变更来源 | INITIAL_SCAN |
| 权威数据模型 | `docs/product/registry/product-model.json` |
| 关联 Change ID | — |

## 2. 产品背景

- **目标**：创建组织、管理成员与组织级配额。
- **问题**：团队场景需要共享额度与权限边界。
- **使用场景**：
- 创建组织
- 邀请成员
- 调整成员额度
- 组织隔离
- **边界 / 不含范围**：
- 不含个人资料（UTER-USER-001）

## 3. 用户角色

| 角色 | 可见性 / 权限 | 来源 |
| --- | --- | --- |
| user | 具备「组织与成员管理」访问权限 | 统一需求模型 roles 字段 |
| admin | 具备「组织与成员管理」访问权限 | 统一需求模型 roles 字段 |

- 权限约束：
- 仅 user / admin 可访问
- 前后端双重权限校验
## 4. 用户故事

| 角色 | 行为 | 价值 | 完整描述 |
| --- | --- | --- | --- |
| 组织管理员 | 管理成员与额度 | 支撑团队协作 | 作为组织管理员，我希望管理成员与额度，从而支撑团队协作。 |

## 5. 功能范围

### 5.1 范围内

- 创建组织
- 邀请成员
- 调整成员额度
- 组织隔离
### 5.2 范围外

- 不含个人资料（UTER-USER-001）
### 5.3 上游依赖

`GET /api/organization`, `POST /api/organization`
### 5.4 下游依赖

`model/organization.go`

## 6. 业务流程

### 6.1 主流程

1. 进入 组织与成员管理 · 主页面
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

`idle`, `loading`, `empty`, `error`, `success`, `disabled`, `permission_denied`
### 6.5 状态恢复

- 失败后可重试
- 返回时恢复表单状态
- 变更可从历史版本恢复

## 7. 功能需求

### <a id="REQ-ORG-001-01"></a>REQ-ORG-001-01 · 组织与成员

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P1 |
| 描述 | 创建组织并管理成员。 |
| 页面入口 | `web/src/routes/_authenticated/organization/index.tsx` |
| 输出 | 操作结果与状态反馈 |
| 权限 | user, admin |
| 数据变更 | UTER-ORG-001 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-ORG-001-01` |
| 关联组件 | `CMP-ORG-001-01`, `CMP-ORG-001-02`, `CMP-ORG-001-03`, `CMP-ORG-001-04`, `CMP-ORG-001-05`, `CMP-ORG-001-06`, `CMP-ORG-001-07` |
| 关联交互 | `INT-ORG-001-01` |
| 关联验收标准 | `AC-ORG-001-01`, `AC-ORG-001-02`, `AC-ORG-001-03` |
| 关联测试用例 | `TC-ORG-001-01` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-ORG-001-01-01 | 仅组织管理员可修改成员 | — | — | ACTIVE |

**错误提示**

—
### <a id="REQ-ORG-001-02"></a>REQ-ORG-001-02 · 组织级额度

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P1 |
| 描述 | 按组织分配额度并隔离计费。 |
| 页面入口 | `web/src/routes/_authenticated/organization/index.tsx` |
| 输出 | 操作结果与状态反馈 |
| 权限 | user, admin |
| 数据变更 | UTER-ORG-001 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-ORG-001-01` |
| 关联组件 | — |
| 关联交互 | `INT-ORG-001-02`, `INT-ORG-001-03`, `INT-ORG-001-04`, `INT-ORG-001-05` |
| 关联验收标准 | `AC-ORG-001-04`, `AC-ORG-001-05`, `AC-ORG-001-06` |
| 关联测试用例 | `TC-ORG-001-02` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-ORG-001-02-01 | 不得跨组织读取数据 | — | — | ACTIVE |

**错误提示**

- 不得跨组织读取数据
## 8. 页面交互

| Prototype Page ID | 页面 | 布局 | 入口 | 状态 | 关联需求 |
| --- | --- | --- | --- | --- | --- |
| [PP-ORG-001-01](docs/product/prototypes/org/UTER-ORG-001.md#PP-ORG-001-01) | 组织与成员管理 · 主页面 | table-with-toolbar | `web/src/routes/_authenticated/organization/index.tsx` | ACTIVE | `REQ-ORG-001-01`, `REQ-ORG-001-02` |
| [PP-ORG-001-02](docs/product/prototypes/org/UTER-ORG-001.md#PP-ORG-001-02) | 组织与成员管理 · 详情 | detail | `由 PP-ORG-001-01 的页面跳转进入` | ACTIVE | `REQ-ORG-001-01` |

**交互清单**

| 页面 | Interaction ID | 名称 | 触发 | 动作 | 步骤 | 目标页面 |
| --- | --- | --- | --- | --- | --- | --- |
| PP-ORG-001-01 | INT-ORG-001-01 | 关键字搜索 | `input:keyword` | `filter_list` | - input:keyword<br>- filter_list | — |
| PP-ORG-001-01 | INT-ORG-001-02 | 状态筛选 | `change:status_filter` | `filter_list` | - change:status_filter<br>- filter_list | — |
| PP-ORG-001-01 | INT-ORG-001-03 | 翻页 | `click:page` | `paginate` | - click:page<br>- paginate | — |
| PP-ORG-001-01 | INT-ORG-001-04 | 打开详情抽屉 | `click:row` | `open_drawer` | - click:row<br>- open_drawer | — |
| PP-ORG-001-01 | INT-ORG-001-05 | 查看详情页 | `click:detail` | `navigate` | - click:detail<br>- navigate | PP-ORG-001-02 |
| PP-ORG-001-02 | INT-ORG-001-100 | 返回主页面并恢复状态 | `click:back` | `restore_form_state` | - click:back<br>- restore_form_state | PP-ORG-001-01 |

> 完整可操作原型（表单、按钮、弹窗、抽屉、列表、状态切换、跳转、状态恢复）见 **交互式 HTML 原型** `docs/product/prototypes/org/UTER-ORG-001.html`（可直接用浏览器打开，左原型 / 右 PRD 同源双栏）、产品规格中心左侧 Prototype 面板，及 `docs/product/prototypes/org/UTER-ORG-001.md`。

## 9. API 和数据模型

### 9.1 API

| API ID | 方法 | 路径 | 请求 | 响应 | 错误码 | 证据来源 |
| --- | --- | --- | --- | --- | --- | --- |
| API-ORG-001-01 | GET | `/api/organization` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-ORG-001-02 | POST | `/api/organization` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-ORG-001-03 | GET | `/api/organizations` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-ORG-001-04 | GET | `/api/organization/:id/members` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |

### 9.2 数据模型

| Data Model ID | 模型 | 字段 | 证据来源 |
| --- | --- | --- | --- |
| DM-ORG-001-01 | organization.go | 见源码 | model/organization.go |

### 9.3 代码证据

- controller/organization.go
- router/api-router.go:218-251
- model/organization.go

## 10. 验收标准（Given / When / Then）

| Acceptance ID | 类型 | Given | When | Then | 原型页面 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| AC-ORG-001-01 | normal | 用户具有 user / admin 角色且已进入 组织与成员管理 · 主页面 | 执行「组织与成员」的正常操作 | 系统返回成功结果，且原型 PP-ORG-001-01 可复现相同行为 | PP-ORG-001-01 | ACTIVE |
| AC-ORG-001-02 | exception | 输入不满足业务规则或上游返回错误 | 执行「组织与成员」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-ORG-001-01 | ACTIVE |
| AC-ORG-001-03 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-ORG-001-01 | ACTIVE |
| AC-ORG-001-04 | normal | 用户具有 user / admin 角色且已进入 组织与成员管理 · 主页面 | 执行「组织级额度」的正常操作 | 系统返回成功结果，且原型 PP-ORG-001-01 可复现相同行为 | PP-ORG-001-01 | ACTIVE |
| AC-ORG-001-05 | exception | 输入不满足业务规则或上游返回错误 | 执行「组织级额度」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-ORG-001-01 | ACTIVE |
| AC-ORG-001-06 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-ORG-001-01 | ACTIVE |

## 11. 测试追溯

| Test Case ID | 名称 | 关联需求 | 关联验收 | 测试路径 | 类型 | 结果 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-ORG-001-01 | REQ-ORG-001-01 需求-原型-验收-测试追溯 | REQ-ORG-001-01 | `AC-ORG-001-01`, `AC-ORG-001-02`, `AC-ORG-001-03` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |
| TC-ORG-001-02 | REQ-ORG-001-02 需求-原型-验收-测试追溯 | REQ-ORG-001-02 | `AC-ORG-001-04`, `AC-ORG-001-05`, `AC-ORG-001-06` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |

**代码层测试证据**

`model/organization_test.go`, `controller/organization_authority_test.go`, `service/org_billing_test.go`, `service/org_admission_atomic_test.go`
**页面 / API 证据**

`web/src/routes/_authenticated/organization/index.tsx`, `web/src/features/organization`, `GET /api/organization`, `POST /api/organization`, `GET /api/organizations`, `GET /api/organization/:id/members`

## 12. 版本变更

| 版本 | 来源 | Change ID | 操作 | 同步状态 | 说明 |
| --- | --- | --- | --- | --- | --- |
| v1 | 基线 | INITIAL_BASELINE | 全量功能盘点建模 | SYNCED | 由真实代码证据建立初始统一需求模型 |
| v1 | System Generated | CHG-INIT-0001 | initial_scan | SYNCED | 基于真实代码盘点建立统一需求模型 |

> 版本快照：`docs/product/history/vN.json`。历史恢复会生成新的 Change ID 与快照，不覆盖既有历史。
