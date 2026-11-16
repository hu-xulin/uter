# UTER-MISC-004 · 文档站与协议页面 — 产品需求文档（PRD）

> **投影文档 · 禁止直接手工编辑**。唯一权威数据源为 `docs/product/registry/product-model.json`（Single Source of Truth）。
> 请在产品规格中心（`http://127.0.0.1:7788/`）通过 PRD 或 Prototype 视图编辑；所有有效变更经统一模型事务化双写，并自动重渲染 PRD 与原型投影。
> 模型版本 **v1** · PRD 版本 v1 · 渲染于 2026-11-09T15:47:41.768Z · 设计基线 UDS 8.0.0

> **实现状态：`IMPLEMENTED` — 已实现（前后端均有证据）**。

## 1. 基础信息

| 字段 | 值 |
| --- | --- |
| Feature ID | `UTER-MISC-004` |
| 功能名称 | 文档站与协议页面 |
| 业务模块 | misc |
| 领域 / Domain | MISC |
| 实现状态 | `IMPLEMENTED` |
| 优先级 | P2 |
| 用户角色 | `guest`, `user` |
| PRD ID / 版本 | PRD-MISC-004 / v1 |
| 原型 ID | PROTO-MISC-004 |
| 原型文档 | `docs/product/prototypes/misc/UTER-MISC-004.md` |
| 交互式原型（HTML） | `docs/product/prototypes/misc/UTER-MISC-004.html` |
| 同步状态 | `SYNCED` |
| 最近同步 | 2026-11-09T00:00:00+08:00 |
| 最近变更来源 | INITIAL_SCAN |
| 权威数据模型 | `docs/product/registry/product-model.json` |
| 关联 Change ID | — |

## 2. 产品背景

- **目标**：提供开发文档、用户协议、隐私政策与充值协议。
- **问题**：合规与接入说明需要可访问的公开页面。
- **使用场景**：
- 浏览文档
- 查看协议
- 多语言
- **边界 / 不含范围**：
- 不含后台内容编辑实现细节

## 3. 用户角色

| 角色 | 可见性 / 权限 | 来源 |
| --- | --- | --- |
| guest | 具备「文档站与协议页面」访问权限 | 统一需求模型 roles 字段 |
| user | 具备「文档站与协议页面」访问权限 | 统一需求模型 roles 字段 |

- 权限约束：
- 仅 guest / user 可访问
- 前后端双重权限校验
## 4. 用户故事

| 角色 | 行为 | 价值 | 完整描述 |
| --- | --- | --- | --- |
| 访客 | 阅读接入文档 | 完成 API 接入 | 作为访客，我希望阅读接入文档，从而完成 API 接入。 |

## 5. 功能范围

### 5.1 范围内

- 浏览文档
- 查看协议
- 多语言
### 5.2 范围外

- 不含后台内容编辑实现细节
### 5.3 上游依赖

`GET /api/user-agreement`, `GET /api/privacy-policy`
### 5.4 下游依赖

`model/option.go`

## 6. 业务流程

### 6.1 主流程

1. 进入 文档站与协议页面 · 主页面
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

### <a id="REQ-MISC-004-01"></a>REQ-MISC-004-01 · 文档访问

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P2 |
| 描述 | /docs 路由加载静态导出的文档站。 |
| 页面入口 | `web/src/routes/_public/docs.tsx` |
| 输出 | 操作结果与状态反馈 |
| 权限 | guest, user |
| 数据变更 | UTER-MISC-004 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-MISC-004-01` |
| 关联组件 | `CMP-MISC-004-01`, `CMP-MISC-004-02`, `CMP-MISC-004-03`, `CMP-MISC-004-04`, `CMP-MISC-004-05` |
| 关联交互 | `INT-MISC-004-01` |
| 关联验收标准 | `AC-MISC-004-01`, `AC-MISC-004-02`, `AC-MISC-004-03` |
| 关联测试用例 | `TC-MISC-004-01` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-MISC-004-01-01 | 匿名可访问 | — | — | ACTIVE |

**错误提示**

—
### <a id="REQ-MISC-004-02"></a>REQ-MISC-004-02 · 协议页面

| 字段 | 值 |
| --- | --- |
| 状态 / 优先级 | ACTIVE / P2 |
| 描述 | 用户协议/隐私政策/充值协议可访问。 |
| 页面入口 | `web/src/routes/_public/docs.tsx` |
| 输出 | 操作结果与状态反馈 |
| 权限 | guest, user |
| 数据变更 | UTER-MISC-004 相关业务数据按规则变更（MOCK 原型不写真实数据） |
| 关联原型页面 | `PP-MISC-004-01` |
| 关联组件 | — |
| 关联交互 | `INT-MISC-004-02` |
| 关联验收标准 | `AC-MISC-004-04`, `AC-MISC-004-05`, `AC-MISC-004-06` |
| 关联测试用例 | `TC-MISC-004-02` |
| 关联 Change ID | — |

**输入字段**

—

**业务规则**

| Rule ID | 规则 | 字段 | 值 | 状态 |
| --- | --- | --- | --- | --- |
| BR-MISC-004-02-01 | 内容来自后端配置或静态站点 | — | — | ACTIVE |

**错误提示**

—
## 8. 页面交互

| Prototype Page ID | 页面 | 布局 | 入口 | 状态 | 关联需求 |
| --- | --- | --- | --- | --- | --- |
| [PP-MISC-004-01](docs/product/prototypes/misc/UTER-MISC-004.md#PP-MISC-004-01) | 文档站与协议页面 · 主页面 | detail | `web/src/routes/_public/docs.tsx` | ACTIVE | `REQ-MISC-004-01`, `REQ-MISC-004-02` |

**交互清单**

| 页面 | Interaction ID | 名称 | 触发 | 动作 | 步骤 | 目标页面 |
| --- | --- | --- | --- | --- | --- | --- |
| PP-MISC-004-01 | INT-MISC-004-01 | 切换分组 | `click:tabs` | `switch_tab` | - click:tabs<br>- switch_tab | — |
| PP-MISC-004-01 | INT-MISC-004-02 | 返回 | `click:back` | `restore_form_state` | - click:back<br>- restore_form_state | — |

> 完整可操作原型（表单、按钮、弹窗、抽屉、列表、状态切换、跳转、状态恢复）见 **交互式 HTML 原型** `docs/product/prototypes/misc/UTER-MISC-004.html`（可直接用浏览器打开，左原型 / 右 PRD 同源双栏）、产品规格中心左侧 Prototype 面板，及 `docs/product/prototypes/misc/UTER-MISC-004.md`。

## 9. API 和数据模型

### 9.1 API

| API ID | 方法 | 路径 | 请求 | 响应 | 错误码 | 证据来源 |
| --- | --- | --- | --- | --- | --- | --- |
| API-MISC-004-01 | GET | `/api/user-agreement` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-MISC-004-02 | GET | `/api/privacy-policy` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-MISC-004-03 | GET | `/api/recharge-agreement` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |
| API-MISC-004-04 | GET | `/api/home_page_content` | 按实际接口定义 | 按实际接口定义 | `401`, `403`, `4xx/5xx 业务错误` | router/*.go |

### 9.2 数据模型

| Data Model ID | 模型 | 字段 | 证据来源 |
| --- | --- | --- | --- |
| DM-MISC-004-01 | option.go | 见源码 | model/option.go |

### 9.3 代码证据

- router/web-router.go
- docs-web/
- web/src/lib/docs-link.ts
- model/option.go

## 10. 验收标准（Given / When / Then）

| Acceptance ID | 类型 | Given | When | Then | 原型页面 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| AC-MISC-004-01 | normal | 用户具有 guest / user 角色且已进入 文档站与协议页面 · 主页面 | 执行「文档访问」的正常操作 | 系统返回成功结果，且原型 PP-MISC-004-01 可复现相同行为 | PP-MISC-004-01 | ACTIVE |
| AC-MISC-004-02 | exception | 输入不满足业务规则或上游返回错误 | 执行「文档访问」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-MISC-004-01 | ACTIVE |
| AC-MISC-004-03 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-MISC-004-01 | ACTIVE |
| AC-MISC-004-04 | normal | 用户具有 guest / user 角色且已进入 文档站与协议页面 · 主页面 | 执行「协议页面」的正常操作 | 系统返回成功结果，且原型 PP-MISC-004-01 可复现相同行为 | PP-MISC-004-01 | ACTIVE |
| AC-MISC-004-05 | exception | 输入不满足业务规则或上游返回错误 | 执行「协议页面」并触发校验失败 | 展示明确错误提示，不写入真实数据，原型错误状态可见 | PP-MISC-004-01 | ACTIVE |
| AC-MISC-004-06 | permission | 当前用户不具备该功能所需角色 | 访问该功能入口 | 展示权限不足状态或 403，不泄露受保护数据 | PP-MISC-004-01 | ACTIVE |

## 11. 测试追溯

| Test Case ID | 名称 | 关联需求 | 关联验收 | 测试路径 | 类型 | 结果 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-MISC-004-01 | REQ-MISC-004-01 需求-原型-验收-测试追溯 | REQ-MISC-004-01 | `AC-MISC-004-01`, `AC-MISC-004-02`, `AC-MISC-004-03` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |
| TC-MISC-004-02 | REQ-MISC-004-02 需求-原型-验收-测试追溯 | REQ-MISC-004-02 | `AC-MISC-004-04`, `AC-MISC-004-05`, `AC-MISC-004-06` | `tools/product-workspace/tests/requirements-trace.test.mjs` | automated | NOT_RUN |

**代码层测试证据**

`web/src/features/docs/__tests__`
**页面 / API 证据**

`web/src/routes/_public/docs.tsx`, `web/src/routes/_public/docs/$.tsx`, `web/src/routes/_public/user-agreement.tsx`, `web/src/routes/_public/privacy-policy.tsx`, `web/src/routes/_public/recharge-agreement.tsx`, `GET /api/user-agreement`, `GET /api/privacy-policy`, `GET /api/recharge-agreement`, `GET /api/home_page_content`

## 12. 版本变更

| 版本 | 来源 | Change ID | 操作 | 同步状态 | 说明 |
| --- | --- | --- | --- | --- | --- |
| v1 | 基线 | INITIAL_BASELINE | 全量功能盘点建模 | SYNCED | 由真实代码证据建立初始统一需求模型 |
| v1 | System Generated | CHG-INIT-0001 | initial_scan | SYNCED | 基于真实代码盘点建立统一需求模型 |

> 版本快照：`docs/product/history/vN.json`。历史恢复会生成新的 Change ID 与快照，不覆盖既有历史。
