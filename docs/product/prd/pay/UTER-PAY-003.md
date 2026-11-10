# UTER-PAY-003 · 支付回调、幂等与对账 — 产品需求文档（PRD）

> **投影文档 · 禁止直接手工编辑**。唯一权威数据源为 `docs/product/registry/product-model.json`（Single Source of Truth）。
> 请在产品规格中心（`http://127.0.0.1:7788/`）通过 PRD 或 Prototype 视图编辑；所有有效变更经统一模型事务化双写，并自动重渲染 PRD 与原型投影。
> 模型版本 **v1** · PRD 版本 v1 · 渲染于 2026-11-09T15:47:41.710Z · 设计基线 UTER Design System 3.0

> **实现状态：`BACKEND_ONLY` — 仅后端（未发现用户侧页面）**。
> 状态证据说明：后端已实现并具备测试，未发现独立的前端回调管理页面，因此状态为 BACKEND_ONLY。

## 1. 基础信息

| 字段 | 值 |
| --- | --- |
| Feature ID | `UTER-PAY-003` |
| 功能名称 | 支付回调、幂等与对账 |
| 业务模块 | pay |
| 领域 / Domain | PAY |
| 实现状态 | `BACKEND_ONLY` |
| 优先级 | P0 |
| 用户角色 | `system` |
| PRD ID / 版本 | PRD-PAY-003 / v1 |
| 原型 ID | PROTO-PAY-003 |
| 原型文档 | `docs/product/prototypes/pay/UTER-PAY-003.md` |
| 交互式原型（HTML） | `docs/product/prototypes/pay/UTER-PAY-003.html` |
| 同步状态 | `SYNCED` |
| 最近同步 | 2026-11-09T00:00:00+08:00 |
| 最近变更来源 | INITIAL_SCAN |
| 权威数据模型 | `docs/product/registry/product-model.json` |
| 关联 Change ID | — |

## 2. 产品背景

- **目标**：安全处理支付回调，保证不重复入账并可补偿异常订单。
- **问题**：回调可能重复、乱序或伪造，资金操作必须幂等。
- **使用场景**：
- 正常回调入账
- 重复回调
- 签名错误
- 对账补偿
- **边界 / 不含范围**：
- 无独立前端页面；管理员通过充值记录间接查看

## 3. 用户角色

| 角色 | 可见性 / 权限 | 来源 |
| --- | --- | --- |
| system | 具备「支付回调、幂等与对账」访问权限 | 统一需求模型 roles 字段 |

- 权限约束：
- 仅 system 可访问
- 前后端双重权限校验
## 4. 用户故事

| 角色 | 行为 | 价值 | 完整描述 |
| --- | --- | --- | --- |
| 系统 | 幂等处理支付回调 | 保证用户额度准确 | 作为系统，我希望幂等处理支付回调，从而保证用户额度准确。 |

## 5. 功能范围

### 5.1 范围内

- 正常回调入账
- 重复回调
- 签名错误
- 对账补偿
### 5.2 范围外

- 无独立前端页面；管理员通过充值记录间接查看
### 5.3 上游依赖

`POST /api/user/epay/notify`, `GET /api/user/epay/notify`
### 5.4 下游依赖

`model/accounting_tx.go`, `model/topup.go`

## 6. 业务流程

### 6.1 主流程

1. 进入 支付回调、幂等与对账 · 主页面
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

### <a id="REQ-PAY-003-01"></a>REQ-PAY-003-01 · 回调签名校验

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P0 |
| 描述 | 所有支付回调必须验证签名与订单归属。 |
| 页面入口 | `null` |
| 输出 | 操作结果与状态反馈 |
| 权限 | system |
| 数据变更 | UTER-PAY-003 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-PAY-003-01` |
| 关联组件 | `CMP-PAY-003-01`, `CMP-PAY-003-02`, `CMP-PAY-003-03`, `CMP-PAY-003-04`, `CMP-PAY-003-05` |
| 关联交互 | `INT-PAY-003-01` |
| 关联验收标准 | `AC-PAY-003-01`, `AC-PAY-003-02`, `AC-PAY-003-03` |
| 关联测试用例 | `TC-PAY-003-01` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-PAY-003-01-01 | 签名不合法直接拒绝 | — | — | ACTIVE |
| BR-PAY-003-01-02 | 订单号与金额必须一致 | — | — | ACTIVE |

**错误提示**

- 签名不合法直接拒绝
- 订单号与金额必须一致
### <a id="REQ-PAY-003-02"></a>REQ-PAY-003-02 · 重复回调幂等

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P0 |
| 描述 | 同一订单重复回调只入账一次。 |
| 页面入口 | `null` |
| 输出 | 操作结果与状态反馈 |
| 权限 | system |
| 数据变更 | UTER-PAY-003 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-PAY-003-01` |
| 关联组件 | — |
| 关联交互 | `INT-PAY-003-02` |
| 关联验收标准 | `AC-PAY-003-04`, `AC-PAY-003-05`, `AC-PAY-003-06` |
| 关联测试用例 | `TC-PAY-003-02` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-PAY-003-02-01 | 以订单号 + 状态机控制 | — | — | ACTIVE |
| BR-PAY-003-02-02 | 重复回调返回幂等成功 | — | — | ACTIVE |

**错误提示**

—
### <a id="REQ-PAY-003-03"></a>REQ-PAY-003-03 · 对账与异常补偿

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P0 |
| 描述 | 定时任务扫描异常订单并补偿或告警。 |
| 页面入口 | `null` |
| 输出 | 操作结果与状态反馈 |
| 权限 | system |
| 数据变更 | UTER-PAY-003 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-PAY-003-01` |
| 关联组件 | — |
| 关联交互 | — |
| 关联验收标准 | `AC-PAY-003-07`, `AC-PAY-003-08`, `AC-PAY-003-09` |
| 关联测试用例 | `TC-PAY-003-03` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-PAY-003-03-01 | 资金相关操作保留审计记录 | — | — | ACTIVE |

**错误提示**

—
## 8. 页面交互

| Prototype Page ID | 页面 | 布局 | 入口 | 状态 | 关联需求 |
| --- | --- | --- | --- | --- | --- |
| [PP-PAY-003-01](docs/product/prototypes/pay/UTER-PAY-003.md#PP-PAY-003-01) | 支付回调、幂等与对账 · 主页面 | detail | `（未发现对应前端页面：BACKEND_ONLY）` | ACTIVE | `REQ-PAY-003-01`, `REQ-PAY-003-02`, `REQ-PAY-003-03` |

**交互清单**

| 页面 | Interaction ID | 名称 | 触发 | 动作 | 步骤 | 目标页面 |
| --- | --- | --- | --- | --- | --- | --- |
| PP-PAY-003-01 | INT-PAY-003-01 | 切换分组 | `click:tabs` | `switch_tab` | - click:tabs<br>- switch_tab | — |
| PP-PAY-003-01 | INT-PAY-003-02 | 返回 | `click:back` | `restore_form_state` | - click:back<br>- restore_form_state | — |

> 完整可操作原型（表单、按钮、弹窗、抽屉、列表、状态切换、跳转、状态恢复）见 **交互式 HTML 原型** `docs/product/prototypes/pay/UTER-PAY-003.html`（可直接用浏览器打开，左原型 / 右 PRD 同源双栏）、产品规格中心左侧 Prototype 面板，及 `docs/product/prototypes/pay/UTER-PAY-003.md`。

## 9. API 和数据模型

### 9.1 API

| API ID | 方法 | 路径 | 请求 | 响应 | 错误码 | 证据来源 |
| --- | --- | --- | --- | --- | --- | --- |
| API-PAY-003-01 | POST | `/api/user/epay/notify` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-PAY-003-02 | GET | `/api/user/epay/notify` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-PAY-003-03 | POST | `/api/user/alipay/notify` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-PAY-003-04 | POST | `/api/creem/webhook` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-PAY-003-05 | POST | `/api/waffo/webhook` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-PAY-003-06 | POST | `/api/user/topup/complete` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |

### 9.2 数据模型

| Data Model ID | 模型 | 字段 | 证据来源 |
| --- | --- | --- | --- |
| DM-PAY-003-01 | accounting_tx.go | 见源码 | model/accounting_tx.go |
| DM-PAY-003-02 | topup.go | 见源码 | model/topup.go |
| DM-PAY-003-03 | locking.go | 见源码 | model/locking.go |

### 9.3 代码证据

- controller/payment_compliance.go
- controller/payment_reconcile_task.go
- controller/payment_webhook_availability.go
- service/cn_pay_notify_verify_test.go
- router/api-router.go:115-117
- model/accounting_tx.go
- model/topup.go
- model/locking.go

## 10. 验收标准（Given / When / Then）

| Acceptance ID | 类型 | Given | When | Then | 原型页面 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| AC-PAY-003-01 | normal | 用户具有 system 角色且已进入 支付回调、幂等与对账 · 主页面 | 执行「回调签名校验」的正常操作 | 系统返回成功结果，且原型 PP-PAY-003-01 可复现相同行为 | PP-PAY-003-01 | ACTIVE |
| AC-PAY-003-02 | exception | 输入不满足业务规则或上游返回错误 | 执行「回调签名校验」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-PAY-003-01 | ACTIVE |
| AC-PAY-003-03 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-PAY-003-01 | ACTIVE |
| AC-PAY-003-04 | normal | 用户具有 system 角色且已进入 支付回调、幂等与对账 · 主页面 | 执行「重复回调幂等」的正常操作 | 系统返回成功结果，且原型 PP-PAY-003-01 可复现相同行为 | PP-PAY-003-01 | ACTIVE |
| AC-PAY-003-05 | exception | 输入不满足业务规则或上游返回错误 | 执行「重复回调幂等」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-PAY-003-01 | ACTIVE |
| AC-PAY-003-06 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-PAY-003-01 | ACTIVE |
| AC-PAY-003-07 | normal | 用户具有 system 角色且已进入 支付回调、幂等与对账 · 主页面 | 执行「对账与异常补偿」的正常操作 | 系统返回成功结果，且原型 PP-PAY-003-01 可复现相同行为 | PP-PAY-003-01 | ACTIVE |
| AC-PAY-003-08 | exception | 输入不满足业务规则或上游返回错误 | 执行「对账与异常补偿」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-PAY-003-01 | ACTIVE |
| AC-PAY-003-09 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-PAY-003-01 | ACTIVE |

## 11. 测试追溯

| Test Case ID | 名称 | 关联需求 | 关联验收 | 测试路径 | 类型 | 结果 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-PAY-003-01 | REQ-PAY-003-01 需求-原型-验收-测试追溯 | REQ-PAY-003-01 | `AC-PAY-003-01`, `AC-PAY-003-02`, `AC-PAY-003-03` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |
| TC-PAY-003-02 | REQ-PAY-003-02 需求-原型-验收-测试追溯 | REQ-PAY-003-02 | `AC-PAY-003-04`, `AC-PAY-003-05`, `AC-PAY-003-06` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |
| TC-PAY-003-03 | REQ-PAY-003-03 需求-原型-验收-测试追溯 | REQ-PAY-003-03 | `AC-PAY-003-07`, `AC-PAY-003-08`, `AC-PAY-003-09` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |

**代码层测试证据**

`controller/topup_callback_security_matrix_test.go`, `controller/payment_reconcile_task_test.go`, `controller/payment_webhook_availability_test.go`, `controller/topup_epay_order_consistency_test.go`
**页面 / API 证据**

`POST /api/user/epay/notify`, `GET /api/user/epay/notify`, `POST /api/user/alipay/notify`, `POST /api/creem/webhook`, `POST /api/waffo/webhook`, `POST /api/user/topup/complete`

## 12. 版本变更

| 版本 | 来源 | Change ID | 操作 | 同步状态 | 说明 |
| --- | --- | --- | --- | --- | --- |
| v1 | 基线 | INITIAL_BASELINE | 全量功能盘点建模 | SYNCED | 由真实代码证据建立初始统一需求模型 |
| v1 | System Generated | CHG-INIT-0001 | initial_scan | SYNCED | 基于真实代码盘点建立统一需求模型 |

> 版本快照：`docs/product/history/vN.json`。历史恢复会生成新的 Change ID 与快照，不覆盖既有历史。
