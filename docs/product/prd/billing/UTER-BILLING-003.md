# UTER-BILLING-003 · 模型倍率与价格配置 — 产品需求文档（PRD）

> **投影文档 · 禁止直接手工编辑**。唯一权威数据源为 `docs/product/registry/product-model.json`（Single Source of Truth）。
> 请在产品规格中心（`http://127.0.0.1:7788/`）通过 PRD 或 Prototype 视图编辑；所有有效变更经统一模型事务化双写，并自动重渲染 PRD 与原型投影。
> 模型版本 **v1** · PRD 版本 v1 · 渲染于 2026-11-09T15:47:41.725Z · 设计基线 UTER Design System 3.0

> **实现状态：`IMPLEMENTED` — 已实现（前后端均有证据）**。

## 1. 基础信息

| 字段 | 值 |
| --- | --- |
| Feature ID | `UTER-BILLING-003` |
| 功能名称 | 模型倍率与价格配置 |
| 业务模块 | billing |
| 领域 / Domain | BILLING |
| 实现状态 | `IMPLEMENTED` |
| 优先级 | P0 |
| 用户角色 | `super_admin` |
| PRD ID / 版本 | PRD-BILLING-003 / v1 |
| 原型 ID | PROTO-BILLING-003 |
| 原型文档 | `docs/product/prototypes/billing/UTER-BILLING-003.md` |
| 交互式原型（HTML） | `docs/product/prototypes/billing/UTER-BILLING-003.html` |
| 同步状态 | `SYNCED` |
| 最近同步 | 2026-11-09T00:00:00+08:00 |
| 最近变更来源 | INITIAL_SCAN |
| 权威数据模型 | `docs/product/registry/product-model.json` |
| 关联 Change ID | — |

## 2. 产品背景

- **目标**：管理员维护模型价格、分组倍率与补全倍率。
- **问题**：价格变更需要统一配置入口与校验。
- **使用场景**：
- 配置价格
- 倍率同步
- 价格刷新
- 非法值拦截
- **边界 / 不含范围**：
- 不含模型元数据同步（UTER-MODEL-002）

## 3. 用户角色

| 角色 | 可见性 / 权限 | 来源 |
| --- | --- | --- |
| super_admin | 具备「模型倍率与价格配置」访问权限 | 统一需求模型 roles 字段 |

- 权限约束：
- 仅 super_admin 可访问
- 前后端双重权限校验
## 4. 用户故事

| 角色 | 行为 | 价值 | 完整描述 |
| --- | --- | --- | --- |
| 超级管理员 | 维护模型价格与倍率 | 让计费准确 | 作为超级管理员，我希望维护模型价格与倍率，从而让计费准确。 |

## 5. 功能范围

### 5.1 范围内

- 配置价格
- 倍率同步
- 价格刷新
- 非法值拦截
### 5.2 范围外

- 不含模型元数据同步（UTER-MODEL-002）
### 5.3 上游依赖

`GET /api/ratio_config`, `PATCH /api/ratio_config`
### 5.4 下游依赖

`model/pricing.go`, `model/model_pricing_config.go`

## 6. 业务流程

### 6.1 主流程

1. 进入 模型倍率与价格配置 · 主页面
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

### <a id="REQ-BILLING-003-01"></a>REQ-BILLING-003-01 · 价格配置

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P0 |
| 描述 | 配置模型单价、输入/输出价格与倍率。 |
| 页面入口 | `web/src/routes/_authenticated/system-settings/billing/$section.tsx` |
| 输出 | 操作结果与状态反馈 |
| 权限 | super_admin |
| 数据变更 | UTER-BILLING-003 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-BILLING-003-01` |
| 关联组件 | `CMP-BILLING-003-01`, `CMP-BILLING-003-02`, `CMP-BILLING-003-03`, `CMP-BILLING-003-04`, `CMP-BILLING-003-05`, `CMP-BILLING-003-06` |
| 关联交互 | `INT-BILLING-003-01` |
| 关联验收标准 | `AC-BILLING-003-01`, `AC-BILLING-003-02`, `AC-BILLING-003-03` |
| 关联测试用例 | `TC-BILLING-003-01` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-BILLING-003-01-01 | 非法数值不得保存 | — | — | ACTIVE |
| BR-BILLING-003-01-02 | 保存写入变更记录 | — | — | ACTIVE |

**错误提示**

- 非法数值不得保存
### <a id="REQ-BILLING-003-02"></a>REQ-BILLING-003-02 · 倍率同步

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P0 |
| 描述 | 按模型名同步倍率并处理别名。 |
| 页面入口 | `web/src/routes/_authenticated/system-settings/billing/$section.tsx` |
| 输出 | 操作结果与状态反馈 |
| 权限 | super_admin |
| 数据变更 | UTER-BILLING-003 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-BILLING-003-01` |
| 关联组件 | — |
| 关联交互 | `INT-BILLING-003-02`, `INT-BILLING-003-03` |
| 关联验收标准 | `AC-BILLING-003-04`, `AC-BILLING-003-05`, `AC-BILLING-003-06` |
| 关联测试用例 | `TC-BILLING-003-02` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-BILLING-003-02-01 | 别名冲突需提示 | — | — | ACTIVE |

**错误提示**

—
## 8. 页面交互

| Prototype Page ID | 页面 | 布局 | 入口 | 状态 | 关联需求 |
| --- | --- | --- | --- | --- | --- |
| [PP-BILLING-003-01](docs/product/prototypes/billing/UTER-BILLING-003.md#PP-BILLING-003-01) | 模型倍率与价格配置 · 主页面 | settings-tabs | `web/src/routes/_authenticated/system-settings/billing/$section.tsx` | ACTIVE | `REQ-BILLING-003-01`, `REQ-BILLING-003-02` |

**交互清单**

| 页面 | Interaction ID | 名称 | 触发 | 动作 | 步骤 | 目标页面 |
| --- | --- | --- | --- | --- | --- | --- |
| PP-BILLING-003-01 | INT-BILLING-003-01 | 切换配置分组 | `click:tabs` | `switch_tab` | - click:tabs<br>- switch_tab | — |
| PP-BILLING-003-01 | INT-BILLING-003-02 | 配置校验 | `submit:form` | `validate_form` | - submit:form<br>- validate_form | — |
| PP-BILLING-003-01 | INT-BILLING-003-03 | 保存配置 | `click:save` | `open_modal_then_save` | - click:save<br>- open_modal_then_save | — |

> 完整可操作原型（表单、按钮、弹窗、抽屉、列表、状态切换、跳转、状态恢复）见 **交互式 HTML 原型** `docs/product/prototypes/billing/UTER-BILLING-003.html`（可直接用浏览器打开，左原型 / 右 PRD 同源双栏）、产品规格中心左侧 Prototype 面板，及 `docs/product/prototypes/billing/UTER-BILLING-003.md`。

## 9. API 和数据模型

### 9.1 API

| API ID | 方法 | 路径 | 请求 | 响应 | 错误码 | 证据来源 |
| --- | --- | --- | --- | --- | --- | --- |
| API-BILLING-003-01 | GET | `/api/ratio_config` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-BILLING-003-02 | PATCH | `/api/ratio_config` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-BILLING-003-03 | GET | `/api/model_pricing` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-BILLING-003-04 | PATCH | `/api/model_pricing` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-BILLING-003-05 | GET | `/api/pricing` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |

### 9.2 数据模型

| Data Model ID | 模型 | 字段 | 证据来源 |
| --- | --- | --- | --- |
| DM-BILLING-003-01 | pricing.go | 见源码 | model/pricing.go |
| DM-BILLING-003-02 | model_pricing_config.go | 见源码 | model/model_pricing_config.go |
| DM-BILLING-003-03 | option.go | 见源码 | model/option.go |

### 9.3 代码证据

- controller/ratio_config.go
- controller/ratio_sync.go
- controller/model_pricing_config.go
- controller/pricing.go
- model/pricing.go
- model/model_pricing_config.go
- model/option.go

## 10. 验收标准（Given / When / Then）

| Acceptance ID | 类型 | Given | When | Then | 原型页面 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| AC-BILLING-003-01 | normal | 用户具有 super_admin 角色且已进入 模型倍率与价格配置 · 主页面 | 执行「价格配置」的正常操作 | 系统返回成功结果，且原型 PP-BILLING-003-01 可复现相同行为 | PP-BILLING-003-01 | ACTIVE |
| AC-BILLING-003-02 | exception | 输入不满足业务规则或上游返回错误 | 执行「价格配置」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-BILLING-003-01 | ACTIVE |
| AC-BILLING-003-03 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-BILLING-003-01 | ACTIVE |
| AC-BILLING-003-04 | normal | 用户具有 super_admin 角色且已进入 模型倍率与价格配置 · 主页面 | 执行「倍率同步」的正常操作 | 系统返回成功结果，且原型 PP-BILLING-003-01 可复现相同行为 | PP-BILLING-003-01 | ACTIVE |
| AC-BILLING-003-05 | exception | 输入不满足业务规则或上游返回错误 | 执行「倍率同步」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-BILLING-003-01 | ACTIVE |
| AC-BILLING-003-06 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-BILLING-003-01 | ACTIVE |

## 11. 测试追溯

| Test Case ID | 名称 | 关联需求 | 关联验收 | 测试路径 | 类型 | 结果 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-BILLING-003-01 | REQ-BILLING-003-01 需求-原型-验收-测试追溯 | REQ-BILLING-003-01 | `AC-BILLING-003-01`, `AC-BILLING-003-02`, `AC-BILLING-003-03` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |
| TC-BILLING-003-02 | REQ-BILLING-003-02 需求-原型-验收-测试追溯 | REQ-BILLING-003-02 | `AC-BILLING-003-04`, `AC-BILLING-003-05`, `AC-BILLING-003-06` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |

**代码层测试证据**

`controller/ratio_sync_test.go`, `controller/ratio_sync_alias_test.go`, `model/pricing_endpoint_test.go`, `model/channel_price_test.go`
**页面 / API 证据**

`web/src/routes/_authenticated/system-settings/billing/$section.tsx`, `web/src/features/model-pricing`, `GET /api/ratio_config`, `PATCH /api/ratio_config`, `GET /api/model_pricing`, `PATCH /api/model_pricing`, `GET /api/pricing`

## 12. 版本变更

| 版本 | 来源 | Change ID | 操作 | 同步状态 | 说明 |
| --- | --- | --- | --- | --- | --- |
| v1 | 基线 | INITIAL_BASELINE | 全量功能盘点建模 | SYNCED | 由真实代码证据建立初始统一需求模型 |
| v1 | System Generated | CHG-INIT-0001 | initial_scan | SYNCED | 基于真实代码盘点建立统一需求模型 |

> 版本快照：`docs/product/history/vN.json`。历史恢复会生成新的 Change ID 与快照，不覆盖既有历史。
