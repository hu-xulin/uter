# UTER-REFUND-001 · 通用用户退款申请与审核 — 产品需求文档（PRD）

> **投影文档 · 禁止直接手工编辑**。唯一权威数据源为 `docs/product/registry/product-model.json`（Single Source of Truth）。
> 请在产品规格中心（`http://127.0.0.1:7788/`）通过 PRD 或 Prototype 视图编辑；所有有效变更经统一模型事务化双写，并自动重渲染 PRD 与原型投影。
> 模型版本 **v1** · PRD 版本 v1 · 渲染于 2026-11-09T15:47:41.713Z · 设计基线 UDS 8.0.0

> **实现状态：`NOT_IMPLEMENTED` — 未实现（仅规划原型，非已上线功能）**。本文描述的是规划需求与规划原型，不代表该能力已上线。
> 状态证据说明：经全仓扫描 router/controller/service/model 与 web/src/routes（含 /wallet、/subscriptions、/usage-logs、(auth)/*），未发现用户侧退款申请入口、退款 API 或退款审核后台；Midjourney 任务失败自动退款由后端事务处理，见 UTER-REFUND-002，不在此 Feature 范围。
> **待产品决策（3）**：退款适用范围（充值余额 / 订阅 / 任务扣费）；退款时效与审核流；退款与会计事务的冲正规则

## 1. 基础信息

| 字段 | 值 |
| --- | --- |
| Feature ID | `UTER-REFUND-001` |
| 功能名称 | 通用用户退款申请与审核 |
| 业务模块 | refund |
| 领域 / Domain | REFUND |
| 实现状态 | `NOT_IMPLEMENTED` |
| 优先级 | P1 |
| 用户角色 | `user`, `admin` |
| PRD ID / 版本 | PRD-REFUND-001 / v1 |
| 原型 ID | PROTO-REFUND-001 |
| 原型文档 | `docs/product/prototypes/refund/UTER-REFUND-001.md` |
| 交互式原型（HTML） | `docs/product/prototypes/refund/UTER-REFUND-001.html` |
| 同步状态 | `SYNCED` |
| 最近同步 | 2026-11-09T00:00:00+08:00 |
| 最近变更来源 | INITIAL_SCAN |
| 权威数据模型 | `docs/product/registry/product-model.json` |
| 关联 Change ID | — |

> 盘点证据备注：全仓扫描 (auth)/ 到 /api/* 路由与 controller/*.go，未发现用户退款申请/审核 API 或页面；不虚构实现。

## 2. 产品背景

- **目标**：允许用户针对充值订单发起退款申请，管理员审核后执行退款。
- **问题**：当前仓库未发现面向用户的退款申请页面、退款 API 与退款审核后台。
- **使用场景**：
- 【规划】用户发起退款
- 【规划】管理员审核
- 【规划】退款状态通知
- **边界 / 不含范围**：
- 当前仅有 Midjourney 任务失败自动退款的后端实现，见 UTER-REFUND-002

## 3. 用户角色

| 角色 | 可见性 / 权限 | 来源 |
| --- | --- | --- |
| user | 具备「通用用户退款申请与审核」访问权限 | 统一需求模型 roles 字段 |
| admin | 具备「通用用户退款申请与审核」访问权限 | 统一需求模型 roles 字段 |

- 权限约束：
- 仅 user / admin 可访问
- 前后端双重权限校验
## 4. 用户故事

| 角色 | 行为 | 价值 | 完整描述 |
| --- | --- | --- | --- |
| 用户 | 【规划】对可退订单发起退款 | 获得退款处理结果 | 作为用户，我希望【规划】对可退订单发起退款，从而获得退款处理结果。 |

## 5. 功能范围

### 5.1 范围内

- 【规划】用户发起退款
- 【规划】管理员审核
- 【规划】退款状态通知
### 5.2 范围外

- 当前仅有 Midjourney 任务失败自动退款的后端实现，见 UTER-REFUND-002
### 5.3 上游依赖

—
### 5.4 下游依赖

—

## 6. 业务流程

### 6.1 主流程

1. 进入 通用用户退款申请与审核 · 主页面
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

### <a id="REQ-REFUND-001-01"></a>REQ-REFUND-001-01 · 【规划】退款申请入口

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | PLANNED / P1 |
| 描述 | 【规划】在充值记录中提供退款申请入口；当前无实现证据。 |
| 页面入口 | `null` |
| 输出 | 操作结果与状态反馈 |
| 权限 | user, admin |
| 数据变更 | UTER-REFUND-001 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-REFUND-001-01` |
| 关联组件 | `CMP-REFUND-001-01`, `CMP-REFUND-001-02`, `CMP-REFUND-001-03`, `CMP-REFUND-001-04` |
| 关联交互 | `INT-REFUND-001-01` |
| 关联验收标准 | `AC-REFUND-001-01`, `AC-REFUND-001-02`, `AC-REFUND-001-03` |
| 关联测试用例 | `TC-REFUND-001-01` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-REFUND-001-01-01 | NEEDS_PRODUCT_DECISION：可退条件与时效待产品确认 | — | — | NEEDS_PRODUCT_DECISION |

**错误提示**

—
### <a id="REQ-REFUND-001-02"></a>REQ-REFUND-001-02 · 【规划】退款审核

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | PLANNED / P1 |
| 描述 | 【规划】管理员审核退款并留痕；当前无实现证据。 |
| 页面入口 | `null` |
| 输出 | 操作结果与状态反馈 |
| 权限 | user, admin |
| 数据变更 | UTER-REFUND-001 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-REFUND-001-01` |
| 关联组件 | — |
| 关联交互 | `INT-REFUND-001-02` |
| 关联验收标准 | `AC-REFUND-001-04`, `AC-REFUND-001-05`, `AC-REFUND-001-06` |
| 关联测试用例 | `TC-REFUND-001-02` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-REFUND-001-02-01 | NEEDS_PRODUCT_DECISION：审核权限与资金安全边界待确认 | — | — | NEEDS_PRODUCT_DECISION |

**错误提示**

—
## 8. 页面交互

| Prototype Page ID | 页面 | 布局 | 入口 | 状态 | 关联需求 |
| --- | --- | --- | --- | --- | --- |
| [PP-REFUND-001-01](docs/product/prototypes/refund/UTER-REFUND-001.md#PP-REFUND-001-01) | 通用用户退款申请与审核 · 主页面 | single-column-form | `（未发现对应前端页面：NOT_IMPLEMENTED）` | PLANNED（规划原型） | `REQ-REFUND-001-01`, `REQ-REFUND-001-02` |

**交互清单**

| 页面 | Interaction ID | 名称 | 触发 | 动作 | 步骤 | 目标页面 |
| --- | --- | --- | --- | --- | --- | --- |
| PP-REFUND-001-01 | INT-REFUND-001-01 | 表单校验 | `submit:form` | `validate_form` | - submit:form<br>- validate_form | — |
| PP-REFUND-001-01 | INT-REFUND-001-02 | 提交并反馈 | `click:submit` | `open_modal_then_save` | - click:submit<br>- open_modal_then_save | — |

> 完整可操作原型（表单、按钮、弹窗、抽屉、列表、状态切换、跳转、状态恢复）见 **交互式 HTML 原型** `docs/product/prototypes/refund/UTER-REFUND-001.html`（可直接用浏览器打开，左原型 / 右 PRD 同源双栏）、产品规格中心左侧 Prototype 面板，及 `docs/product/prototypes/refund/UTER-REFUND-001.md`。

## 9. API 和数据模型

### 9.1 API

—

### 9.2 数据模型

—

### 9.3 代码证据

—

## 10. 验收标准（Given / When / Then）

| Acceptance ID | 类型 | Given | When | Then | 原型页面 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| AC-REFUND-001-01 | normal | 用户具有 user / admin 角色且已进入 通用用户退款申请与审核 · 主页面 | 执行「【规划】退款申请入口」的正常操作 | 系统返回成功结果，且原型 PP-REFUND-001-01 可复现相同行为 | PP-REFUND-001-01 | ACTIVE |
| AC-REFUND-001-02 | exception | 输入不满足业务规则或上游返回错误 | 执行「【规划】退款申请入口」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-REFUND-001-01 | ACTIVE |
| AC-REFUND-001-03 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-REFUND-001-01 | ACTIVE |
| AC-REFUND-001-04 | normal | 用户具有 user / admin 角色且已进入 通用用户退款申请与审核 · 主页面 | 执行「【规划】退款审核」的正常操作 | 系统返回成功结果，且原型 PP-REFUND-001-01 可复现相同行为 | PP-REFUND-001-01 | ACTIVE |
| AC-REFUND-001-05 | exception | 输入不满足业务规则或上游返回错误 | 执行「【规划】退款审核」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-REFUND-001-01 | ACTIVE |
| AC-REFUND-001-06 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-REFUND-001-01 | ACTIVE |

## 11. 测试追溯

| Test Case ID | 名称 | 关联需求 | 关联验收 | 测试路径 | 类型 | 结果 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-REFUND-001-01 | REQ-REFUND-001-01 需求-原型-验收-测试追溯 | REQ-REFUND-001-01 | `AC-REFUND-001-01`, `AC-REFUND-001-02`, `AC-REFUND-001-03` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |
| TC-REFUND-001-02 | REQ-REFUND-001-02 需求-原型-验收-测试追溯 | REQ-REFUND-001-02 | `AC-REFUND-001-04`, `AC-REFUND-001-05`, `AC-REFUND-001-06` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |

**代码层测试证据**

—
**页面 / API 证据**

—

## 12. 版本变更

| 版本 | 来源 | Change ID | 操作 | 同步状态 | 说明 |
| --- | --- | --- | --- | --- | --- |
| v1 | 基线 | INITIAL_BASELINE | 全量功能盘点建模 | SYNCED | 由真实代码证据建立初始统一需求模型 |
| v1 | System Generated | CHG-INIT-0001 | initial_scan | SYNCED | 基于真实代码盘点建立统一需求模型 |

> 版本快照：`docs/product/history/vN.json`。历史恢复会生成新的 Change ID 与快照，不覆盖既有历史。
