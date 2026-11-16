# UTER-BALANCE-003 · 额度预占与并发扣减 — 产品需求文档（PRD）

> **投影文档 · 禁止直接手工编辑**。唯一权威数据源为 `docs/product/registry/product-model.json`（Single Source of Truth）。
> 请在产品规格中心（`http://127.0.0.1:7788/`）通过 PRD 或 Prototype 视图编辑；所有有效变更经统一模型事务化双写，并自动重渲染 PRD 与原型投影。
> 模型版本 **v1** · PRD 版本 v1 · 渲染于 2026-11-09T15:47:41.720Z · 设计基线 UDS 8.0.0

> **实现状态：`BACKEND_ONLY` — 仅后端（未发现用户侧页面）**。

## 1. 基础信息

| 字段 | 值 |
| --- | --- |
| Feature ID | `UTER-BALANCE-003` |
| 功能名称 | 额度预占与并发扣减 |
| 业务模块 | balance |
| 领域 / Domain | BALANCE |
| 实现状态 | `BACKEND_ONLY` |
| 优先级 | P0 |
| 用户角色 | `system` |
| PRD ID / 版本 | PRD-BALANCE-003 / v1 |
| 原型 ID | PROTO-BALANCE-003 |
| 原型文档 | `docs/product/prototypes/balance/UTER-BALANCE-003.md` |
| 交互式原型（HTML） | `docs/product/prototypes/balance/UTER-BALANCE-003.html` |
| 同步状态 | `SYNCED` |
| 最近同步 | 2026-11-09T00:00:00+08:00 |
| 最近变更来源 | INITIAL_SCAN |
| 权威数据模型 | `docs/product/registry/product-model.json` |
| 关联 Change ID | — |

## 2. 产品背景

- **目标**：在请求准入阶段预占额度并在结算时准确扣减或释放。
- **问题**：并发请求可能导致超额消费。
- **使用场景**：
- 请求前预占
- 结算扣减
- 失败释放
- 超额拒绝
- **边界 / 不含范围**：
- 无独立前端页面

## 3. 用户角色

| 角色 | 可见性 / 权限 | 来源 |
| --- | --- | --- |
| system | 具备「额度预占与并发扣减」访问权限 | 统一需求模型 roles 字段 |

- 权限约束：
- 仅 system 可访问
- 前后端双重权限校验
## 4. 用户故事

| 角色 | 行为 | 价值 | 完整描述 |
| --- | --- | --- | --- |
| 系统 | 预占并在结算时释放/扣减额度 | 避免并发超扣 | 作为系统，我希望预占并在结算时释放/扣减额度，从而避免并发超扣。 |

## 5. 功能范围

### 5.1 范围内

- 请求前预占
- 结算扣减
- 失败释放
- 超额拒绝
### 5.2 范围外

- 无独立前端页面
### 5.3 上游依赖

`POST /v1/chat/completions`
### 5.4 下游依赖

`model/quota_reserve.go`, `model/locking.go`

## 6. 业务流程

### 6.1 主流程

1. 进入 额度预占与并发扣减 · 主页面
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

### <a id="REQ-BALANCE-003-01"></a>REQ-BALANCE-003-01 · 准入额度检查

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P0 |
| 描述 | 请求前检查可用额度并预占。 |
| 页面入口 | `null` |
| 输出 | 操作结果与状态反馈 |
| 权限 | system |
| 数据变更 | UTER-BALANCE-003 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-BALANCE-003-01` |
| 关联组件 | `CMP-BALANCE-003-01`, `CMP-BALANCE-003-02`, `CMP-BALANCE-003-03`, `CMP-BALANCE-003-04`, `CMP-BALANCE-003-05` |
| 关联交互 | `INT-BALANCE-003-01` |
| 关联验收标准 | `AC-BALANCE-003-01`, `AC-BALANCE-003-02`, `AC-BALANCE-003-03` |
| 关联测试用例 | `TC-BALANCE-003-01` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-BALANCE-003-01-01 | 不足时拒绝请求 | — | — | ACTIVE |
| BR-BALANCE-003-01-02 | 预占有超时 | — | — | ACTIVE |

**错误提示**

- 不足时拒绝请求
### <a id="REQ-BALANCE-003-02"></a>REQ-BALANCE-003-02 · 结算与释放

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P0 |
| 描述 | 成功结算扣减，失败释放预占。 |
| 页面入口 | `null` |
| 输出 | 操作结果与状态反馈 |
| 权限 | system |
| 数据变更 | UTER-BALANCE-003 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-BALANCE-003-01` |
| 关联组件 | — |
| 关联交互 | `INT-BALANCE-003-02` |
| 关联验收标准 | `AC-BALANCE-003-04`, `AC-BALANCE-003-05`, `AC-BALANCE-003-06` |
| 关联测试用例 | `TC-BALANCE-003-02` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-BALANCE-003-02-01 | 释放需幂等 | — | — | ACTIVE |

**错误提示**

—
## 8. 页面交互

| Prototype Page ID | 页面 | 布局 | 入口 | 状态 | 关联需求 |
| --- | --- | --- | --- | --- | --- |
| [PP-BALANCE-003-01](docs/product/prototypes/balance/UTER-BALANCE-003.md#PP-BALANCE-003-01) | 额度预占与并发扣减 · 主页面 | detail | `（未发现对应前端页面：BACKEND_ONLY）` | ACTIVE | `REQ-BALANCE-003-01`, `REQ-BALANCE-003-02` |

**交互清单**

| 页面 | Interaction ID | 名称 | 触发 | 动作 | 步骤 | 目标页面 |
| --- | --- | --- | --- | --- | --- | --- |
| PP-BALANCE-003-01 | INT-BALANCE-003-01 | 切换分组 | `click:tabs` | `switch_tab` | - click:tabs<br>- switch_tab | — |
| PP-BALANCE-003-01 | INT-BALANCE-003-02 | 返回 | `click:back` | `restore_form_state` | - click:back<br>- restore_form_state | — |

> 完整可操作原型（表单、按钮、弹窗、抽屉、列表、状态切换、跳转、状态恢复）见 **交互式 HTML 原型** `docs/product/prototypes/balance/UTER-BALANCE-003.html`（可直接用浏览器打开，左原型 / 右 PRD 同源双栏）、产品规格中心左侧 Prototype 面板，及 `docs/product/prototypes/balance/UTER-BALANCE-003.md`。

## 9. API 和数据模型

### 9.1 API

| API ID | 方法 | 路径 | 请求 | 响应 | 错误码 | 证据来源 |
| --- | --- | --- | --- | --- | --- | --- |
| API-BALANCE-003-01 | POST | `/v1/chat/completions` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |

### 9.2 数据模型

| Data Model ID | 模型 | 字段 | 证据来源 |
| --- | --- | --- | --- |
| DM-BALANCE-003-01 | quota_reserve.go | 见源码 | model/quota_reserve.go |
| DM-BALANCE-003-02 | locking.go | 见源码 | model/locking.go |

### 9.3 代码证据

- service/admission_quota_test.go
- model/quota_reserve.go
- service/billing_session.go
- model/quota_reserve.go
- model/locking.go

## 10. 验收标准（Given / When / Then）

| Acceptance ID | 类型 | Given | When | Then | 原型页面 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| AC-BALANCE-003-01 | normal | 用户具有 system 角色且已进入 额度预占与并发扣减 · 主页面 | 执行「准入额度检查」的正常操作 | 系统返回成功结果，且原型 PP-BALANCE-003-01 可复现相同行为 | PP-BALANCE-003-01 | ACTIVE |
| AC-BALANCE-003-02 | exception | 输入不满足业务规则或上游返回错误 | 执行「准入额度检查」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-BALANCE-003-01 | ACTIVE |
| AC-BALANCE-003-03 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-BALANCE-003-01 | ACTIVE |
| AC-BALANCE-003-04 | normal | 用户具有 system 角色且已进入 额度预占与并发扣减 · 主页面 | 执行「结算与释放」的正常操作 | 系统返回成功结果，且原型 PP-BALANCE-003-01 可复现相同行为 | PP-BALANCE-003-01 | ACTIVE |
| AC-BALANCE-003-05 | exception | 输入不满足业务规则或上游返回错误 | 执行「结算与释放」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-BALANCE-003-01 | ACTIVE |
| AC-BALANCE-003-06 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-BALANCE-003-01 | ACTIVE |

## 11. 测试追溯

| Test Case ID | 名称 | 关联需求 | 关联验收 | 测试路径 | 类型 | 结果 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-BALANCE-003-01 | REQ-BALANCE-003-01 需求-原型-验收-测试追溯 | REQ-BALANCE-003-01 | `AC-BALANCE-003-01`, `AC-BALANCE-003-02`, `AC-BALANCE-003-03` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |
| TC-BALANCE-003-02 | REQ-BALANCE-003-02 需求-原型-验收-测试追溯 | REQ-BALANCE-003-02 | `AC-BALANCE-003-04`, `AC-BALANCE-003-05`, `AC-BALANCE-003-06` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |

**代码层测试证据**

`model/quota_reserve_test.go`, `service/admission_quota_test.go`
**页面 / API 证据**

`POST /v1/chat/completions`

## 12. 版本变更

| 版本 | 来源 | Change ID | 操作 | 同步状态 | 说明 |
| --- | --- | --- | --- | --- | --- |
| v1 | 基线 | INITIAL_BASELINE | 全量功能盘点建模 | SYNCED | 由真实代码证据建立初始统一需求模型 |
| v1 | System Generated | CHG-INIT-0001 | initial_scan | SYNCED | 基于真实代码盘点建立统一需求模型 |

> 版本快照：`docs/product/history/vN.json`。历史恢复会生成新的 Change ID 与快照，不覆盖既有历史。
