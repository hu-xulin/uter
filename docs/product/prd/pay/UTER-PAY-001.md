# UTER-PAY-001 · 充值金额选择与充值下单 — 产品需求文档（PRD）

> **投影文档 · 禁止直接手工编辑**。唯一权威数据源为 `docs/product/registry/product-model.json`（Single Source of Truth）。
> 请在产品规格中心（`http://127.0.0.1:7788/`）通过 PRD 或 Prototype 视图编辑；所有有效变更经统一模型事务化双写，并自动重渲染 PRD 与原型投影。
> 模型版本 **v1** · PRD 版本 v1 · 渲染于 2026-11-09T15:47:41.705Z · 设计基线 UTER Design System 3.0

> **实现状态：`IMPLEMENTED` — 已实现（前后端均有证据）**。
> 状态证据说明：最低金额 10 元为代码基线值；若在 PRD 中修改该业务规则，同步引擎会同步更新原型校验、错误提示与验收标准。

## 1. 基础信息

| 字段 | 值 |
| --- | --- |
| Feature ID | `UTER-PAY-001` |
| 功能名称 | 充值金额选择与充值下单 |
| 业务模块 | pay |
| 领域 / Domain | PAY |
| 实现状态 | `IMPLEMENTED` |
| 优先级 | P0 |
| 用户角色 | `user` |
| PRD ID / 版本 | PRD-PAY-001 / v1 |
| 原型 ID | PROTO-PAY-001 |
| 原型文档 | `docs/product/prototypes/pay/UTER-PAY-001.md` |
| 交互式原型（HTML） | `docs/product/prototypes/pay/UTER-PAY-001.html` |
| 同步状态 | `SYNCED` |
| 最近同步 | 2026-11-09T00:00:00+08:00 |
| 最近变更来源 | INITIAL_SCAN |
| 权威数据模型 | `docs/product/registry/product-model.json` |
| 关联 Change ID | — |

## 2. 产品背景

- **目标**：用户选择预设或自定义金额，创建充值订单。
- **问题**：充值入口需要把金额、最低限额与配额规则统一校验。
- **使用场景**：
- 选择预设金额
- 输入自定义金额
- 低于最低金额时拦截
- 创建订单
- **边界 / 不含范围**：
- 不含支付渠道跳转与回调（UTER-PAY-002/003）

## 3. 用户角色

| 角色 | 可见性 / 权限 | 来源 |
| --- | --- | --- |
| user | 具备「充值金额选择与充值下单」访问权限 | 统一需求模型 roles 字段 |

- 权限约束：
- 仅 user 可访问
- 前后端双重权限校验
## 4. 用户故事

| 角色 | 行为 | 价值 | 完整描述 |
| --- | --- | --- | --- |
| 用户 | 选择充值金额并下单 | 为账户增加额度 | 作为用户，我希望选择充值金额并下单，从而为账户增加额度。 |

## 5. 功能范围

### 5.1 范围内

- 选择预设金额
- 输入自定义金额
- 低于最低金额时拦截
- 创建订单
### 5.2 范围外

- 不含支付渠道跳转与回调（UTER-PAY-002/003）
### 5.3 上游依赖

`GET /api/user/topup/info`, `POST /api/user/topup`
### 5.4 下游依赖

`model/topup.go`, `model/option.go`

## 6. 业务流程

### 6.1 主流程

1. 进入 充值金额选择与充值下单 · 主页面
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

### <a id="REQ-PAY-001-01"></a>REQ-PAY-001-01 · 预设充值金额

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P0 |
| 描述 | 展示系统配置的预设充值档位供用户选择。 |
| 页面入口 | `web/src/routes/_authenticated/wallet/index.tsx` |
| 输出 | 操作结果与状态反馈 |
| 权限 | user |
| 数据变更 | UTER-PAY-001 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-PAY-001-01` |
| 关联组件 | `CMP-PAY-001-01`, `CMP-PAY-001-02`, `CMP-PAY-001-04`, `CMP-PAY-001-05`, `CMP-PAY-001-06`, `CMP-PAY-001-07` |
| 关联交互 | `INT-PAY-001-01` |
| 关联验收标准 | `AC-PAY-001-01`, `AC-PAY-001-02`, `AC-PAY-001-03` |
| 关联测试用例 | `TC-PAY-001-01` |
| 关联 Change ID | — |

**输入字段**

| 字段名 | 类型 | 必填 | 校验规则 |
| --- | --- | --- | --- |
| amount | number | 是 | - 档位来自 GET /api/user/topup/info<br>- 未配置档位时展示空状态 |

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-PAY-001-01-01 | 档位来自 GET /api/user/topup/info | — | — | ACTIVE |
| BR-PAY-001-01-02 | 未配置档位时展示空状态 | — | — | ACTIVE |

**错误提示**

—
### <a id="REQ-PAY-001-02"></a>REQ-PAY-001-02 · 最低充值金额校验

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P0 |
| 描述 | 提交金额不得低于系统最低充值金额（当前基线 10 元，实际值来自后端配置）。 |
| 页面入口 | `web/src/routes/_authenticated/wallet/index.tsx` |
| 输出 | 操作结果与状态反馈 |
| 权限 | user |
| 数据变更 | UTER-PAY-001 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-PAY-001-01` |
| 关联组件 | `CMP-PAY-001-03` |
| 关联交互 | `INT-PAY-001-02` |
| 关联验收标准 | `AC-PAY-001-04`, `AC-PAY-001-05`, `AC-PAY-001-06`, `AC-PAY-001-07` |
| 关联测试用例 | `TC-PAY-001-02` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-PAY-001-02-01 | 最小金额 10 | min_amount | 10 | ACTIVE |
| BR-PAY-001-02-02 | 金额必须为正数 | min_amount | — | ACTIVE |
| BR-PAY-001-02-03 | 金额精度按支付渠道约束 | min_amount | — | ACTIVE |

**错误提示**

- 金额必须为正数
### <a id="REQ-PAY-001-03"></a>REQ-PAY-001-03 · 创建充值订单

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P0 |
| 描述 | 调用 POST /api/user/topup 创建订单并返回支付信息。 |
| 页面入口 | `web/src/routes/_authenticated/wallet/index.tsx` |
| 输出 | 操作结果与状态反馈 |
| 权限 | user |
| 数据变更 | UTER-PAY-001 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-PAY-001-01` |
| 关联组件 | — |
| 关联交互 | `INT-PAY-001-03`, `INT-PAY-001-04` |
| 关联验收标准 | `AC-PAY-001-08`, `AC-PAY-001-09`, `AC-PAY-001-10` |
| 关联测试用例 | `TC-PAY-001-03` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-PAY-001-03-01 | 重复点击需防重复提交 | — | — | ACTIVE |
| BR-PAY-001-03-02 | 订单号唯一 | — | — | ACTIVE |

**错误提示**

—
## 8. 页面交互

| Prototype Page ID | 页面 | 布局 | 入口 | 状态 | 关联需求 |
| --- | --- | --- | --- | --- | --- |
| [PP-PAY-001-01](docs/product/prototypes/pay/UTER-PAY-001.md#PP-PAY-001-01) | 充值金额选择与充值下单 · 主页面 | two-column-form | `web/src/routes/_authenticated/wallet/index.tsx` | ACTIVE | `REQ-PAY-001-01`, `REQ-PAY-001-02`, `REQ-PAY-001-03` |
| [PP-PAY-001-02](docs/product/prototypes/pay/UTER-PAY-001.md#PP-PAY-001-02) | 充值金额选择与充值下单 · 订单结果与状态 | result | `由 PP-PAY-001-01 的页面跳转进入` | ACTIVE | `REQ-PAY-001-01` |

**交互清单**

| 页面 | Interaction ID | 名称 | 触发 | 动作 | 步骤 | 目标页面 |
| --- | --- | --- | --- | --- | --- | --- |
| PP-PAY-001-01 | INT-PAY-001-01 | 选择预设金额 | `click:amount_preset` | `set_amount` | - click:amount_preset<br>- set_amount | — |
| PP-PAY-001-01 | INT-PAY-001-02 | 校验自定义金额 | `input:amount` | `validate_min_amount` | - input:amount<br>- validate_min_amount | — |
| PP-PAY-001-01 | INT-PAY-001-03 | 创建订单并跳转结果页 | `click:create_order` | `open_modal_then_navigate` | - click:create_order<br>- open_modal_then_navigate | PP-PAY-001-02 |
| PP-PAY-001-01 | INT-PAY-001-04 | 返回并恢复表单 | `click:back` | `restore_form_state` | - click:back<br>- restore_form_state | — |
| PP-PAY-001-02 | INT-PAY-001-100 | 返回主页面并恢复状态 | `click:back` | `restore_form_state` | - click:back<br>- restore_form_state | PP-PAY-001-01 |

> 完整可操作原型（表单、按钮、弹窗、抽屉、列表、状态切换、跳转、状态恢复）见 **交互式 HTML 原型** `docs/product/prototypes/pay/UTER-PAY-001.html`（可直接用浏览器打开，左原型 / 右 PRD 同源双栏）、产品规格中心左侧 Prototype 面板，及 `docs/product/prototypes/pay/UTER-PAY-001.md`。

## 9. API 和数据模型

### 9.1 API

| API ID | 方法 | 路径 | 请求 | 响应 | 错误码 | 证据来源 |
| --- | --- | --- | --- | --- | --- | --- |
| API-PAY-001-01 | GET | `/api/user/topup/info` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-PAY-001-02 | POST | `/api/user/topup` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-PAY-001-03 | GET | `/api/user/topup/self` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |

### 9.2 数据模型

| Data Model ID | 模型 | 字段 | 证据来源 |
| --- | --- | --- | --- |
| DM-PAY-001-01 | topup.go | 见源码 | model/topup.go |
| DM-PAY-001-02 | option.go | 见源码 | model/option.go |
| DM-PAY-001-03 | accounting_tx.go | 见源码 | model/accounting_tx.go |

### 9.3 代码证据

- controller/topup.go
- service/billing.go
- router/api-router.go:152-154
- model/topup.go
- model/option.go
- model/accounting_tx.go

## 10. 验收标准（Given / When / Then）

| Acceptance ID | 类型 | Given | When | Then | 原型页面 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| AC-PAY-001-01 | normal | 用户具有 user 角色且已进入 充值金额选择与充值下单 · 主页面 | 执行「预设充值金额」的正常操作 | 系统返回成功结果，且原型 PP-PAY-001-01 可复现相同行为 | PP-PAY-001-01 | ACTIVE |
| AC-PAY-001-02 | exception | 输入不满足业务规则或上游返回错误 | 执行「预设充值金额」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-PAY-001-01 | ACTIVE |
| AC-PAY-001-03 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-PAY-001-01 | ACTIVE |
| AC-PAY-001-04 | normal | 用户具有 user 角色且已进入 充值金额选择与充值下单 · 主页面 | 执行「最低充值金额校验」的正常操作 | 系统返回成功结果，且原型 PP-PAY-001-01 可复现相同行为 | PP-PAY-001-01 | ACTIVE |
| AC-PAY-001-05 | exception | 输入不满足业务规则或上游返回错误 | 执行「最低充值金额校验」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-PAY-001-01 | ACTIVE |
| AC-PAY-001-06 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-PAY-001-01 | ACTIVE |
| AC-PAY-001-07 | boundary | 系统最低充值金额为 10 元 | 输入 9 元并提交 | 校验失败并提示「不得低于 10 元」；输入 10 元时校验通过 | PP-PAY-001-01 | ACTIVE |
| AC-PAY-001-08 | normal | 用户具有 user 角色且已进入 充值金额选择与充值下单 · 主页面 | 执行「创建充值订单」的正常操作 | 系统返回成功结果，且原型 PP-PAY-001-01 可复现相同行为 | PP-PAY-001-01 | ACTIVE |
| AC-PAY-001-09 | exception | 输入不满足业务规则或上游返回错误 | 执行「创建充值订单」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-PAY-001-01 | ACTIVE |
| AC-PAY-001-10 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-PAY-001-01 | ACTIVE |

## 11. 测试追溯

| Test Case ID | 名称 | 关联需求 | 关联验收 | 测试路径 | 类型 | 结果 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-PAY-001-01 | REQ-PAY-001-01 需求-原型-验收-测试追溯 | REQ-PAY-001-01 | `AC-PAY-001-01`, `AC-PAY-001-02`, `AC-PAY-001-03` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |
| TC-PAY-001-02 | REQ-PAY-001-02 需求-原型-验收-测试追溯 | REQ-PAY-001-02 | `AC-PAY-001-04`, `AC-PAY-001-05`, `AC-PAY-001-06`, `AC-PAY-001-07` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |
| TC-PAY-001-03 | REQ-PAY-001-03 需求-原型-验收-测试追溯 | REQ-PAY-001-03 | `AC-PAY-001-08`, `AC-PAY-001-09`, `AC-PAY-001-10` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |

**代码层测试证据**

`controller/topup_test.go`, `controller/topup_amount_match_test.go`, `controller/topup_quota_limit_test.go`, `controller/topup_pay_money_rounding_test.go`
**页面 / API 证据**

`web/src/routes/_authenticated/wallet/index.tsx`, `web/src/features/wallet`, `GET /api/user/topup/info`, `POST /api/user/topup`, `GET /api/user/topup/self`

## 12. 版本变更

| 版本 | 来源 | Change ID | 操作 | 同步状态 | 说明 |
| --- | --- | --- | --- | --- | --- |
| v1 | 基线 | INITIAL_BASELINE | 全量功能盘点建模 | SYNCED | 由真实代码证据建立初始统一需求模型 |
| v1 | System Generated | CHG-INIT-0001 | initial_scan | SYNCED | 基于真实代码盘点建立统一需求模型 |

> 版本快照：`docs/product/history/vN.json`。历史恢复会生成新的 Change ID 与快照，不覆盖既有历史。
