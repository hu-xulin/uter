# UTER-BILLING-001 · Token 用量统计与计费 — 产品需求文档（PRD）

> **投影文档 · 禁止直接手工编辑**。唯一权威数据源为 `docs/product/registry/product-model.json`（Single Source of Truth）。
> 请在产品规格中心（`http://127.0.0.1:7788/`）通过 PRD 或 Prototype 视图编辑；所有有效变更经统一模型事务化双写，并自动重渲染 PRD 与原型投影。
> 模型版本 **v1** · PRD 版本 v1 · 渲染于 2026-11-09T15:47:41.722Z · 设计基线 UTER Design System 3.0

> **实现状态：`IMPLEMENTED` — 已实现（前后端均有证据）**。

## 1. 基础信息

| 字段 | 值 |
| --- | --- |
| Feature ID | `UTER-BILLING-001` |
| 功能名称 | Token 用量统计与计费 |
| 业务模块 | billing |
| 领域 / Domain | BILLING |
| 实现状态 | `IMPLEMENTED` |
| 优先级 | P0 |
| 用户角色 | `user`, `admin` |
| PRD ID / 版本 | PRD-BILLING-001 / v1 |
| 原型 ID | PROTO-BILLING-001 |
| 原型文档 | `docs/product/prototypes/billing/UTER-BILLING-001.md` |
| 交互式原型（HTML） | `docs/product/prototypes/billing/UTER-BILLING-001.html` |
| 同步状态 | `SYNCED` |
| 最近同步 | 2026-11-09T00:00:00+08:00 |
| 最近变更来源 | INITIAL_SCAN |
| 权威数据模型 | `docs/product/registry/product-model.json` |
| 关联 Change ID | — |

## 2. 产品背景

- **目标**：统计输入/输出/缓存 Token 并按模型倍率计算费用。
- **问题**：多模型中继需要准确的用量与成本归因。
- **使用场景**：
- 请求完成结算
- 缓存 Token 计价
- 流式请求结算
- **边界 / 不含范围**：
- 不含账单导出（UTER-BILLING-002）

## 3. 用户角色

| 角色 | 可见性 / 权限 | 来源 |
| --- | --- | --- |
| user | 具备「Token 用量统计与计费」访问权限 | 统一需求模型 roles 字段 |
| admin | 具备「Token 用量统计与计费」访问权限 | 统一需求模型 roles 字段 |

- 权限约束：
- 仅 user / admin 可访问
- 前后端双重权限校验
## 4. 用户故事

| 角色 | 行为 | 价值 | 完整描述 |
| --- | --- | --- | --- |
| 用户 | 查看用量与费用 | 了解成本构成 | 作为用户，我希望查看用量与费用，从而了解成本构成。 |

## 5. 功能范围

### 5.1 范围内

- 请求完成结算
- 缓存 Token 计价
- 流式请求结算
### 5.2 范围外

- 不含账单导出（UTER-BILLING-002）
### 5.3 上游依赖

`GET /api/log/token`, `GET /api/usage/token`
### 5.4 下游依赖

`model/log.go`, `model/pricing.go`

## 6. 业务流程

### 6.1 主流程

1. 进入 Token 用量统计与计费 · 主页面
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

### <a id="REQ-BILLING-001-01"></a>REQ-BILLING-001-01 · Token 统计

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P0 |
| 描述 | 记录 prompt / completion / cache Token 数。 |
| 页面入口 | `web/src/routes/_authenticated/usage-logs/$section.tsx` |
| 输出 | 操作结果与状态反馈 |
| 权限 | user, admin |
| 数据变更 | UTER-BILLING-001 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-BILLING-001-01` |
| 关联组件 | `CMP-BILLING-001-01`, `CMP-BILLING-001-02`, `CMP-BILLING-001-03`, `CMP-BILLING-001-04`, `CMP-BILLING-001-05`, `CMP-BILLING-001-06`, `CMP-BILLING-001-07` |
| 关联交互 | `INT-BILLING-001-01` |
| 关联验收标准 | `AC-BILLING-001-01`, `AC-BILLING-001-02`, `AC-BILLING-001-03` |
| 关联测试用例 | `TC-BILLING-001-01` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-BILLING-001-01-01 | 缺失用量时按渠道回退规则处理 | — | — | ACTIVE |

**错误提示**

—
### <a id="REQ-BILLING-001-02"></a>REQ-BILLING-001-02 · 费用计算

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P0 |
| 描述 | 按模型价格与倍率计算本次消费。 |
| 页面入口 | `web/src/routes/_authenticated/usage-logs/$section.tsx` |
| 输出 | 操作结果与状态反馈 |
| 权限 | user, admin |
| 数据变更 | UTER-BILLING-001 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-BILLING-001-01` |
| 关联组件 | — |
| 关联交互 | `INT-BILLING-001-02`, `INT-BILLING-001-03` |
| 关联验收标准 | `AC-BILLING-001-04`, `AC-BILLING-001-05`, `AC-BILLING-001-06` |
| 关联测试用例 | `TC-BILLING-001-02` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-BILLING-001-02-01 | 金额按计费精度取整 | — | — | ACTIVE |
| BR-BILLING-001-02-02 | 计费异常不得重复扣费 | — | — | ACTIVE |

**错误提示**

- 计费异常不得重复扣费
## 8. 页面交互

| Prototype Page ID | 页面 | 布局 | 入口 | 状态 | 关联需求 |
| --- | --- | --- | --- | --- | --- |
| [PP-BILLING-001-01](docs/product/prototypes/billing/UTER-BILLING-001.md#PP-BILLING-001-01) | Token 用量统计与计费 · 主页面 | stat-grid | `web/src/routes/_authenticated/usage-logs/$section.tsx` | ACTIVE | `REQ-BILLING-001-01`, `REQ-BILLING-001-02` |
| [PP-BILLING-001-02](docs/product/prototypes/billing/UTER-BILLING-001.md#PP-BILLING-001-02) | Token 用量统计与计费 · 指标明细 | detail | `由 PP-BILLING-001-01 的页面跳转进入` | ACTIVE | `REQ-BILLING-001-01` |

**交互清单**

| 页面 | Interaction ID | 名称 | 触发 | 动作 | 步骤 | 目标页面 |
| --- | --- | --- | --- | --- | --- | --- |
| PP-BILLING-001-01 | INT-BILLING-001-01 | 切换时间范围 | `change:range` | `reload_stats` | - change:range<br>- reload_stats | — |
| PP-BILLING-001-01 | INT-BILLING-001-02 | 刷新数据 | `click:refresh` | `reload_stats` | - click:refresh<br>- reload_stats | — |
| PP-BILLING-001-01 | INT-BILLING-001-03 | 查看明细 | `click:metric` | `navigate` | - click:metric<br>- navigate | PP-BILLING-001-02 |
| PP-BILLING-001-02 | INT-BILLING-001-100 | 返回主页面并恢复状态 | `click:back` | `restore_form_state` | - click:back<br>- restore_form_state | PP-BILLING-001-01 |

> 完整可操作原型（表单、按钮、弹窗、抽屉、列表、状态切换、跳转、状态恢复）见 **交互式 HTML 原型** `docs/product/prototypes/billing/UTER-BILLING-001.html`（可直接用浏览器打开，左原型 / 右 PRD 同源双栏）、产品规格中心左侧 Prototype 面板，及 `docs/product/prototypes/billing/UTER-BILLING-001.md`。

## 9. API 和数据模型

### 9.1 API

| API ID | 方法 | 路径 | 请求 | 响应 | 错误码 | 证据来源 |
| --- | --- | --- | --- | --- | --- | --- |
| API-BILLING-001-01 | GET | `/api/log/token` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-BILLING-001-02 | GET | `/api/usage/token` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-BILLING-001-03 | GET | `/api/user/self/stat` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |

### 9.2 数据模型

| Data Model ID | 模型 | 字段 | 证据来源 |
| --- | --- | --- | --- |
| DM-BILLING-001-01 | log.go | 见源码 | model/log.go |
| DM-BILLING-001-02 | pricing.go | 见源码 | model/pricing.go |
| DM-BILLING-001-03 | accounting_tx.go | 见源码 | model/accounting_tx.go |

### 9.3 代码证据

- tokenkit/
- service/billing_usage.go
- controller/billing.go
- controller/log.go
- model/log.go
- model/pricing.go
- model/accounting_tx.go

## 10. 验收标准（Given / When / Then）

| Acceptance ID | 类型 | Given | When | Then | 原型页面 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| AC-BILLING-001-01 | normal | 用户具有 user / admin 角色且已进入 Token 用量统计与计费 · 主页面 | 执行「Token 统计」的正常操作 | 系统返回成功结果，且原型 PP-BILLING-001-01 可复现相同行为 | PP-BILLING-001-01 | ACTIVE |
| AC-BILLING-001-02 | exception | 输入不满足业务规则或上游返回错误 | 执行「Token 统计」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-BILLING-001-01 | ACTIVE |
| AC-BILLING-001-03 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-BILLING-001-01 | ACTIVE |
| AC-BILLING-001-04 | normal | 用户具有 user / admin 角色且已进入 Token 用量统计与计费 · 主页面 | 执行「费用计算」的正常操作 | 系统返回成功结果，且原型 PP-BILLING-001-01 可复现相同行为 | PP-BILLING-001-01 | ACTIVE |
| AC-BILLING-001-05 | exception | 输入不满足业务规则或上游返回错误 | 执行「费用计算」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-BILLING-001-01 | ACTIVE |
| AC-BILLING-001-06 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-BILLING-001-01 | ACTIVE |

## 11. 测试追溯

| Test Case ID | 名称 | 关联需求 | 关联验收 | 测试路径 | 类型 | 结果 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-BILLING-001-01 | REQ-BILLING-001-01 需求-原型-验收-测试追溯 | REQ-BILLING-001-01 | `AC-BILLING-001-01`, `AC-BILLING-001-02`, `AC-BILLING-001-03` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |
| TC-BILLING-001-02 | REQ-BILLING-001-02 需求-原型-验收-测试追溯 | REQ-BILLING-001-02 | `AC-BILLING-001-04`, `AC-BILLING-001-05`, `AC-BILLING-001-06` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |

**代码层测试证据**

`controller/billing_test.go`, `model/log_cache_token_stat_test.go`, `model/pricing_usage_schema_test.go`, `model/billing_integrity_test.go`
**页面 / API 证据**

`web/src/routes/_authenticated/usage-logs/$section.tsx`, `web/src/features/usage-logs`, `GET /api/log/token`, `GET /api/usage/token`, `GET /api/user/self/stat`

## 12. 版本变更

| 版本 | 来源 | Change ID | 操作 | 同步状态 | 说明 |
| --- | --- | --- | --- | --- | --- |
| v1 | 基线 | INITIAL_BASELINE | 全量功能盘点建模 | SYNCED | 由真实代码证据建立初始统一需求模型 |
| v1 | System Generated | CHG-INIT-0001 | initial_scan | SYNCED | 基于真实代码盘点建立统一需求模型 |

> 版本快照：`docs/product/history/vN.json`。历史恢复会生成新的 Change ID 与快照，不覆盖既有历史。
