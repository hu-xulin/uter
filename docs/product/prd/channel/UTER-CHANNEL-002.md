# UTER-CHANNEL-002 · 渠道选择、优先级与亲和性 — 产品需求文档（PRD）

> **投影文档 · 禁止直接手工编辑**。唯一权威数据源为 `docs/product/registry/product-model.json`（Single Source of Truth）。
> 请在产品规格中心（`http://127.0.0.1:7788/`）通过 PRD 或 Prototype 视图编辑；所有有效变更经统一模型事务化双写，并自动重渲染 PRD 与原型投影。
> 模型版本 **v1** · PRD 版本 v1 · 渲染于 2026-11-09T15:47:41.733Z · 设计基线 UDS 8.0.0

> **实现状态：`BACKEND_ONLY` — 仅后端（未发现用户侧页面）**。

## 1. 基础信息

| 字段 | 值 |
| --- | --- |
| Feature ID | `UTER-CHANNEL-002` |
| 功能名称 | 渠道选择、优先级与亲和性 |
| 业务模块 | channel |
| 领域 / Domain | CHANNEL |
| 实现状态 | `BACKEND_ONLY` |
| 优先级 | P0 |
| 用户角色 | `system` |
| PRD ID / 版本 | PRD-CHANNEL-002 / v1 |
| 原型 ID | PROTO-CHANNEL-002 |
| 原型文档 | `docs/product/prototypes/channel/UTER-CHANNEL-002.md` |
| 交互式原型（HTML） | `docs/product/prototypes/channel/UTER-CHANNEL-002.html` |
| 同步状态 | `SYNCED` |
| 最近同步 | 2026-11-09T00:00:00+08:00 |
| 最近变更来源 | INITIAL_SCAN |
| 权威数据模型 | `docs/product/registry/product-model.json` |
| 关联 Change ID | — |

## 2. 产品背景

- **目标**：按模型、分组、优先级与亲和性选择可用渠道。
- **问题**：多渠道场景下需要稳定且可解释的路由。
- **使用场景**：
- 按模型选择
- 优先级回退
- 亲和性缓存
- 全部不可用
- **边界 / 不含范围**：
- 无独立前端页面

## 3. 用户角色

| 角色 | 可见性 / 权限 | 来源 |
| --- | --- | --- |
| system | 具备「渠道选择、优先级与亲和性」访问权限 | 统一需求模型 roles 字段 |

- 权限约束：
- 仅 system 可访问
- 前后端双重权限校验
## 4. 用户故事

| 角色 | 行为 | 价值 | 完整描述 |
| --- | --- | --- | --- |
| 系统 | 为每个请求选择最优渠道 | 提高成功率 | 作为系统，我希望为每个请求选择最优渠道，从而提高成功率。 |

## 5. 功能范围

### 5.1 范围内

- 按模型选择
- 优先级回退
- 亲和性缓存
- 全部不可用
### 5.2 范围外

- 无独立前端页面
### 5.3 上游依赖

`POST /v1/chat/completions`, `GET /api/channel_affinity_cache`
### 5.4 下游依赖

`model/channel_priority.go`, `model/channel_satisfy.go`

## 6. 业务流程

### 6.1 主流程

1. 进入 渠道选择、优先级与亲和性 · 主页面
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

### <a id="REQ-CHANNEL-002-01"></a>REQ-CHANNEL-002-01 · 渠道选择

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P0 |
| 描述 | 按模型、分组、权重与优先级选择渠道。 |
| 页面入口 | `null` |
| 输出 | 操作结果与状态反馈 |
| 权限 | system |
| 数据变更 | UTER-CHANNEL-002 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-CHANNEL-002-01` |
| 关联组件 | `CMP-CHANNEL-002-01`, `CMP-CHANNEL-002-02`, `CMP-CHANNEL-002-03`, `CMP-CHANNEL-002-04`, `CMP-CHANNEL-002-05` |
| 关联交互 | `INT-CHANNEL-002-01` |
| 关联验收标准 | `AC-CHANNEL-002-01`, `AC-CHANNEL-002-02`, `AC-CHANNEL-002-03` |
| 关联测试用例 | `TC-CHANNEL-002-01` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-CHANNEL-002-01-01 | 不满足约束的渠道不得入选 | — | — | ACTIVE |

**错误提示**

- 不满足约束的渠道不得入选
### <a id="REQ-CHANNEL-002-02"></a>REQ-CHANNEL-002-02 · 失败回退

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P0 |
| 描述 | 首选渠道失败时按策略回退。 |
| 页面入口 | `null` |
| 输出 | 操作结果与状态反馈 |
| 权限 | system |
| 数据变更 | UTER-CHANNEL-002 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-CHANNEL-002-01` |
| 关联组件 | — |
| 关联交互 | `INT-CHANNEL-002-02` |
| 关联验收标准 | `AC-CHANNEL-002-04`, `AC-CHANNEL-002-05`, `AC-CHANNEL-002-06` |
| 关联测试用例 | `TC-CHANNEL-002-02` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-CHANNEL-002-02-01 | 回退次数受限 | — | — | ACTIVE |
| BR-CHANNEL-002-02-02 | 全部失败返回明确错误 | — | — | ACTIVE |

**错误提示**

- 全部失败返回明确错误
### <a id="REQ-CHANNEL-002-03"></a>REQ-CHANNEL-002-03 · 亲和性缓存

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P0 |
| 描述 | 对同一会话尽量复用渠道。 |
| 页面入口 | `null` |
| 输出 | 操作结果与状态反馈 |
| 权限 | system |
| 数据变更 | UTER-CHANNEL-002 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-CHANNEL-002-01` |
| 关联组件 | — |
| 关联交互 | — |
| 关联验收标准 | `AC-CHANNEL-002-07`, `AC-CHANNEL-002-08`, `AC-CHANNEL-002-09` |
| 关联测试用例 | `TC-CHANNEL-002-03` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-CHANNEL-002-03-01 | 缓存可失效 | — | — | ACTIVE |

**错误提示**

—
## 8. 页面交互

| Prototype Page ID | 页面 | 布局 | 入口 | 状态 | 关联需求 |
| --- | --- | --- | --- | --- | --- |
| [PP-CHANNEL-002-01](docs/product/prototypes/channel/UTER-CHANNEL-002.md#PP-CHANNEL-002-01) | 渠道选择、优先级与亲和性 · 主页面 | detail | `（未发现对应前端页面：BACKEND_ONLY）` | ACTIVE | `REQ-CHANNEL-002-01`, `REQ-CHANNEL-002-02`, `REQ-CHANNEL-002-03` |

**交互清单**

| 页面 | Interaction ID | 名称 | 触发 | 动作 | 步骤 | 目标页面 |
| --- | --- | --- | --- | --- | --- | --- |
| PP-CHANNEL-002-01 | INT-CHANNEL-002-01 | 切换分组 | `click:tabs` | `switch_tab` | - click:tabs<br>- switch_tab | — |
| PP-CHANNEL-002-01 | INT-CHANNEL-002-02 | 返回 | `click:back` | `restore_form_state` | - click:back<br>- restore_form_state | — |

> 完整可操作原型（表单、按钮、弹窗、抽屉、列表、状态切换、跳转、状态恢复）见 **交互式 HTML 原型** `docs/product/prototypes/channel/UTER-CHANNEL-002.html`（可直接用浏览器打开，左原型 / 右 PRD 同源双栏）、产品规格中心左侧 Prototype 面板，及 `docs/product/prototypes/channel/UTER-CHANNEL-002.md`。

## 9. API 和数据模型

### 9.1 API

| API ID | 方法 | 路径 | 请求 | 响应 | 错误码 | 证据来源 |
| --- | --- | --- | --- | --- | --- | --- |
| API-CHANNEL-002-01 | POST | `/v1/chat/completions` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-CHANNEL-002-02 | GET | `/api/channel_affinity_cache` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |

### 9.2 数据模型

| Data Model ID | 模型 | 字段 | 证据来源 |
| --- | --- | --- | --- |
| DM-CHANNEL-002-01 | channel_priority.go | 见源码 | model/channel_priority.go |
| DM-CHANNEL-002-02 | channel_satisfy.go | 见源码 | model/channel_satisfy.go |
| DM-CHANNEL-002-03 | channel_cache.go | 见源码 | model/channel_cache.go |

### 9.3 代码证据

- service/channel_select.go
- service/channel_affinity.go
- controller/channel_affinity_cache.go
- controller/channel_priority.go
- model/channel_priority.go
- model/channel_satisfy.go
- model/channel_cache.go

## 10. 验收标准（Given / When / Then）

| Acceptance ID | 类型 | Given | When | Then | 原型页面 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| AC-CHANNEL-002-01 | normal | 用户具有 system 角色且已进入 渠道选择、优先级与亲和性 · 主页面 | 执行「渠道选择」的正常操作 | 系统返回成功结果，且原型 PP-CHANNEL-002-01 可复现相同行为 | PP-CHANNEL-002-01 | ACTIVE |
| AC-CHANNEL-002-02 | exception | 输入不满足业务规则或上游返回错误 | 执行「渠道选择」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-CHANNEL-002-01 | ACTIVE |
| AC-CHANNEL-002-03 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-CHANNEL-002-01 | ACTIVE |
| AC-CHANNEL-002-04 | normal | 用户具有 system 角色且已进入 渠道选择、优先级与亲和性 · 主页面 | 执行「失败回退」的正常操作 | 系统返回成功结果，且原型 PP-CHANNEL-002-01 可复现相同行为 | PP-CHANNEL-002-01 | ACTIVE |
| AC-CHANNEL-002-05 | exception | 输入不满足业务规则或上游返回错误 | 执行「失败回退」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-CHANNEL-002-01 | ACTIVE |
| AC-CHANNEL-002-06 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-CHANNEL-002-01 | ACTIVE |
| AC-CHANNEL-002-07 | normal | 用户具有 system 角色且已进入 渠道选择、优先级与亲和性 · 主页面 | 执行「亲和性缓存」的正常操作 | 系统返回成功结果，且原型 PP-CHANNEL-002-01 可复现相同行为 | PP-CHANNEL-002-01 | ACTIVE |
| AC-CHANNEL-002-08 | exception | 输入不满足业务规则或上游返回错误 | 执行「亲和性缓存」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-CHANNEL-002-01 | ACTIVE |
| AC-CHANNEL-002-09 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-CHANNEL-002-01 | ACTIVE |

## 11. 测试追溯

| Test Case ID | 名称 | 关联需求 | 关联验收 | 测试路径 | 类型 | 结果 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-CHANNEL-002-01 | REQ-CHANNEL-002-01 需求-原型-验收-测试追溯 | REQ-CHANNEL-002-01 | `AC-CHANNEL-002-01`, `AC-CHANNEL-002-02`, `AC-CHANNEL-002-03` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |
| TC-CHANNEL-002-02 | REQ-CHANNEL-002-02 需求-原型-验收-测试追溯 | REQ-CHANNEL-002-02 | `AC-CHANNEL-002-04`, `AC-CHANNEL-002-05`, `AC-CHANNEL-002-06` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |
| TC-CHANNEL-002-03 | REQ-CHANNEL-002-03 需求-原型-验收-测试追溯 | REQ-CHANNEL-002-03 | `AC-CHANNEL-002-07`, `AC-CHANNEL-002-08`, `AC-CHANNEL-002-09` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |

**代码层测试证据**

`service/channel_select_test.go`, `model/channel_priority_test.go`, `service/channel_affinity_template_test.go`, `controller/channel_priority_error_code_test.go`
**页面 / API 证据**

`POST /v1/chat/completions`, `GET /api/channel_affinity_cache`

## 12. 版本变更

| 版本 | 来源 | Change ID | 操作 | 同步状态 | 说明 |
| --- | --- | --- | --- | --- | --- |
| v1 | 基线 | INITIAL_BASELINE | 全量功能盘点建模 | SYNCED | 由真实代码证据建立初始统一需求模型 |
| v1 | System Generated | CHG-INIT-0001 | initial_scan | SYNCED | 基于真实代码盘点建立统一需求模型 |

> 版本快照：`docs/product/history/vN.json`。历史恢复会生成新的 Change ID 与快照，不覆盖既有历史。
