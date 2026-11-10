# UTER-ADMIN-002 · 数据统计看板 — 产品需求文档（PRD）

> **投影文档 · 禁止直接手工编辑**。唯一权威数据源为 `docs/product/registry/product-model.json`（Single Source of Truth）。
> 请在产品规格中心（`http://127.0.0.1:7788/`）通过 PRD 或 Prototype 视图编辑；所有有效变更经统一模型事务化双写，并自动重渲染 PRD 与原型投影。
> 模型版本 **v1** · PRD 版本 v1 · 渲染于 2026-11-09T15:47:41.758Z · 设计基线 UTER Design System 3.0

> **实现状态：`IMPLEMENTED` — 已实现（前后端均有证据）**。

## 1. 基础信息

| 字段 | 值 |
| --- | --- |
| Feature ID | `UTER-ADMIN-002` |
| 功能名称 | 数据统计看板 |
| 业务模块 | admin |
| 领域 / Domain | ADMIN |
| 实现状态 | `IMPLEMENTED` |
| 优先级 | P1 |
| 用户角色 | `admin`, `super_admin` |
| PRD ID / 版本 | PRD-ADMIN-002 / v1 |
| 原型 ID | PROTO-ADMIN-002 |
| 原型文档 | `docs/product/prototypes/admin/UTER-ADMIN-002.md` |
| 交互式原型（HTML） | `docs/product/prototypes/admin/UTER-ADMIN-002.html` |
| 同步状态 | `SYNCED` |
| 最近同步 | 2026-11-09T00:00:00+08:00 |
| 最近变更来源 | INITIAL_SCAN |
| 权威数据模型 | `docs/product/registry/product-model.json` |
| 关联 Change ID | — |

## 2. 产品背景

- **目标**：展示请求量、消费、模型分布与用户统计。
- **问题**：运营需要可视化的数据概览。
- **使用场景**：
- 按时间筛选
- 查看模型/用户分布
- 数据为空
- 加载失败
- **边界 / 不含范围**：
- 不含明细日志导出（UTER-BILLING-002）

## 3. 用户角色

| 角色 | 可见性 / 权限 | 来源 |
| --- | --- | --- |
| admin | 具备「数据统计看板」访问权限 | 统一需求模型 roles 字段 |
| super_admin | 具备「数据统计看板」访问权限 | 统一需求模型 roles 字段 |

- 权限约束：
- 仅 admin / super_admin 可访问
- 前后端双重权限校验
## 4. 用户故事

| 角色 | 行为 | 价值 | 完整描述 |
| --- | --- | --- | --- |
| 管理员 | 查看统计看板 | 了解平台运行状况 | 作为管理员，我希望查看统计看板，从而了解平台运行状况。 |

## 5. 功能范围

### 5.1 范围内

- 按时间筛选
- 查看模型/用户分布
- 数据为空
- 加载失败
### 5.2 范围外

- 不含明细日志导出（UTER-BILLING-002）
### 5.3 上游依赖

`GET /api/data/`, `GET /api/data/users`
### 5.4 下游依赖

`model/log.go`, `model/user.go`

## 6. 业务流程

### 6.1 主流程

1. 进入 数据统计看板 · 主页面
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

### <a id="REQ-ADMIN-002-01"></a>REQ-ADMIN-002-01 · 统计概览

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P1 |
| 描述 | 展示核心指标卡片与趋势。 |
| 页面入口 | `web/src/routes/_authenticated/dashboard/index.tsx` |
| 输出 | 操作结果与状态反馈 |
| 权限 | admin, super_admin |
| 数据变更 | UTER-ADMIN-002 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-ADMIN-002-01` |
| 关联组件 | `CMP-ADMIN-002-01`, `CMP-ADMIN-002-02`, `CMP-ADMIN-002-03`, `CMP-ADMIN-002-04`, `CMP-ADMIN-002-05`, `CMP-ADMIN-002-06`, `CMP-ADMIN-002-07` |
| 关联交互 | `INT-ADMIN-002-01` |
| 关联验收标准 | `AC-ADMIN-002-01`, `AC-ADMIN-002-02`, `AC-ADMIN-002-03` |
| 关联测试用例 | `TC-ADMIN-002-01` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-ADMIN-002-01-01 | 时间范围受接口约束 | — | — | ACTIVE |

**错误提示**

—
### <a id="REQ-ADMIN-002-02"></a>REQ-ADMIN-002-02 · 维度切换

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P1 |
| 描述 | 在模型、用户、渠道维度间切换。 |
| 页面入口 | `web/src/routes/_authenticated/dashboard/index.tsx` |
| 输出 | 操作结果与状态反馈 |
| 权限 | admin, super_admin |
| 数据变更 | UTER-ADMIN-002 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-ADMIN-002-01` |
| 关联组件 | — |
| 关联交互 | `INT-ADMIN-002-02`, `INT-ADMIN-002-03` |
| 关联验收标准 | `AC-ADMIN-002-04`, `AC-ADMIN-002-05`, `AC-ADMIN-002-06` |
| 关联测试用例 | `TC-ADMIN-002-02` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-ADMIN-002-02-01 | 无数据时展示空状态 | — | — | ACTIVE |

**错误提示**

—
## 8. 页面交互

| Prototype Page ID | 页面 | 布局 | 入口 | 状态 | 关联需求 |
| --- | --- | --- | --- | --- | --- |
| [PP-ADMIN-002-01](docs/product/prototypes/admin/UTER-ADMIN-002.md#PP-ADMIN-002-01) | 数据统计看板 · 主页面 | stat-grid | `web/src/routes/_authenticated/dashboard/index.tsx` | ACTIVE | `REQ-ADMIN-002-01`, `REQ-ADMIN-002-02` |
| [PP-ADMIN-002-02](docs/product/prototypes/admin/UTER-ADMIN-002.md#PP-ADMIN-002-02) | 数据统计看板 · 指标明细 | detail | `由 PP-ADMIN-002-01 的页面跳转进入` | ACTIVE | `REQ-ADMIN-002-01` |

**交互清单**

| 页面 | Interaction ID | 名称 | 触发 | 动作 | 步骤 | 目标页面 |
| --- | --- | --- | --- | --- | --- | --- |
| PP-ADMIN-002-01 | INT-ADMIN-002-01 | 切换时间范围 | `change:range` | `reload_stats` | - change:range<br>- reload_stats | — |
| PP-ADMIN-002-01 | INT-ADMIN-002-02 | 刷新数据 | `click:refresh` | `reload_stats` | - click:refresh<br>- reload_stats | — |
| PP-ADMIN-002-01 | INT-ADMIN-002-03 | 查看明细 | `click:metric` | `navigate` | - click:metric<br>- navigate | PP-ADMIN-002-02 |
| PP-ADMIN-002-02 | INT-ADMIN-002-100 | 返回主页面并恢复状态 | `click:back` | `restore_form_state` | - click:back<br>- restore_form_state | PP-ADMIN-002-01 |

> 完整可操作原型（表单、按钮、弹窗、抽屉、列表、状态切换、跳转、状态恢复）见 **交互式 HTML 原型** `docs/product/prototypes/admin/UTER-ADMIN-002.html`（可直接用浏览器打开，左原型 / 右 PRD 同源双栏）、产品规格中心左侧 Prototype 面板，及 `docs/product/prototypes/admin/UTER-ADMIN-002.md`。

## 9. API 和数据模型

### 9.1 API

| API ID | 方法 | 路径 | 请求 | 响应 | 错误码 | 证据来源 |
| --- | --- | --- | --- | --- | --- | --- |
| API-ADMIN-002-01 | GET | `/api/data/` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-ADMIN-002-02 | GET | `/api/data/users` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-ADMIN-002-03 | GET | `/api/dashboard/billing/usage` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-ADMIN-002-04 | GET | `/api/status` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |

### 9.2 数据模型

| Data Model ID | 模型 | 字段 | 证据来源 |
| --- | --- | --- | --- |
| DM-ADMIN-002-01 | log.go | 见源码 | model/log.go |
| DM-ADMIN-002-02 | user.go | 见源码 | model/user.go |

### 9.3 代码证据

- controller/usedata.go
- controller/dashboard.go
- router/dashboard.go
- model/log.go
- model/user.go

## 10. 验收标准（Given / When / Then）

| Acceptance ID | 类型 | Given | When | Then | 原型页面 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| AC-ADMIN-002-01 | normal | 用户具有 admin / super_admin 角色且已进入 数据统计看板 · 主页面 | 执行「统计概览」的正常操作 | 系统返回成功结果，且原型 PP-ADMIN-002-01 可复现相同行为 | PP-ADMIN-002-01 | ACTIVE |
| AC-ADMIN-002-02 | exception | 输入不满足业务规则或上游返回错误 | 执行「统计概览」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-ADMIN-002-01 | ACTIVE |
| AC-ADMIN-002-03 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-ADMIN-002-01 | ACTIVE |
| AC-ADMIN-002-04 | normal | 用户具有 admin / super_admin 角色且已进入 数据统计看板 · 主页面 | 执行「维度切换」的正常操作 | 系统返回成功结果，且原型 PP-ADMIN-002-01 可复现相同行为 | PP-ADMIN-002-01 | ACTIVE |
| AC-ADMIN-002-05 | exception | 输入不满足业务规则或上游返回错误 | 执行「维度切换」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-ADMIN-002-01 | ACTIVE |
| AC-ADMIN-002-06 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-ADMIN-002-01 | ACTIVE |

## 11. 测试追溯

| Test Case ID | 名称 | 关联需求 | 关联验收 | 测试路径 | 类型 | 结果 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-ADMIN-002-01 | REQ-ADMIN-002-01 需求-原型-验收-测试追溯 | REQ-ADMIN-002-01 | `AC-ADMIN-002-01`, `AC-ADMIN-002-02`, `AC-ADMIN-002-03` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |
| TC-ADMIN-002-02 | REQ-ADMIN-002-02 需求-原型-验收-测试追溯 | REQ-ADMIN-002-02 | `AC-ADMIN-002-04`, `AC-ADMIN-002-05`, `AC-ADMIN-002-06` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |

**代码层测试证据**

`controller/usedata_flow_test.go`, `web/src/features/dashboard/lib`
**页面 / API 证据**

`web/src/routes/_authenticated/dashboard/index.tsx`, `web/src/routes/_authenticated/dashboard/$section.tsx`, `web/src/features/dashboard`, `GET /api/data/`, `GET /api/data/users`, `GET /api/dashboard/billing/usage`, `GET /api/status`

## 12. 版本变更

| 版本 | 来源 | Change ID | 操作 | 同步状态 | 说明 |
| --- | --- | --- | --- | --- | --- |
| v1 | 基线 | INITIAL_BASELINE | 全量功能盘点建模 | SYNCED | 由真实代码证据建立初始统一需求模型 |
| v1 | System Generated | CHG-INIT-0001 | initial_scan | SYNCED | 基于真实代码盘点建立统一需求模型 |

> 版本快照：`docs/product/history/vN.json`。历史恢复会生成新的 Change ID 与快照，不覆盖既有历史。
