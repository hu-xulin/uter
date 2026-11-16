# UTER-RELAY-002 · 多协议中继适配 — 交互式原型说明

> **投影文档 · 禁止直接手工编辑**。原型事实源与 PRD 相同：`docs/product/registry/product-model.json`。
> 模型版本 **v1** · 渲染于 2026-11-09T15:47:41.744Z · 设计基线 UDS 8.0.0

> **`DEMO / MOCK`**：本原型仅使用合成数据，不发起真实支付、退款、余额变更、账户操作或写生产数据；所有订单、金额、响应均为模拟值。
> **实现状态 `IMPLEMENTED`**：已实现（前后端均有证据）

打开可操作原型（推荐）：**交互式 HTML 原型** `docs/product/prototypes/relay/UTER-RELAY-002.html` —— 自包含网页，左原型 / 右 PRD 同源双栏，浏览器直接打开即可操作；或产品规格中心 `http://127.0.0.1:7788/` → Feature Catalog → `UTER-RELAY-002` → 左侧 Prototype 面板。支持 PC / H5 视口、表单校验、弹窗 / 抽屉、列表 / 详情、加载 / 空 / 错误 / 成功 / 禁用 / 权限不足状态、页面跳转与状态恢复。

对应 PRD：[`docs/product/prd/relay/UTER-RELAY-002.md`](../../prd/relay/UTER-RELAY-002.md)

## 页面总览

| Prototype Page ID | 页面名称 | 布局 | 入口 | 状态 | 规划标记 | 关联需求 |
| --- | --- | --- | --- | --- | --- | --- |
| [PP-RELAY-002-01](#PP-RELAY-002-01) | 多协议中继适配 · 主页面 | request-response | `web/src/routes/_authenticated/playground/index.tsx` | ACTIVE | ACTIVE | `REQ-RELAY-002-01`, `REQ-RELAY-002-02` |
| [PP-RELAY-002-02](#PP-RELAY-002-02) | 多协议中继适配 · 请求日志 | detail | `由 PP-RELAY-002-01 的页面跳转进入` | ACTIVE | ACTIVE | `REQ-RELAY-002-01` |

## <a id="PP-RELAY-002-01"></a>页面 1：PP-RELAY-002-01 · 多协议中继适配 · 主页面

| 属性 | 值 |
| --- | --- |
| 布局 | request-response |
| 入口 | `web/src/routes/_authenticated/playground/index.tsx` |
| 状态 | ACTIVE |
| Demo 声明 | DEMO / MOCK：本原型只使用合成数据，不会发起真实支付、退款或余额变更。 |
| 规划提示 | — |
| 关联需求 | `REQ-RELAY-002-01`, `REQ-RELAY-002-02` |

### 组件清单

| Component ID | 类型 | 名称 / 文案 | 字段 | 必填 | 选项 | 动作 / 触发 | 校验 / 属性 | 关联需求 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CMP-RELAY-002-01 | select | 模型 | model | 否 | `gpt-4o`, `claude-3-7`, `gemini-2.5` | — | — | REQ-RELAY-002-01 | ACTIVE |
| CMP-RELAY-002-02 | textarea | Prompt | prompt | 是 | — | — | `{"error_message":"Prompt 不得为空"}` | REQ-RELAY-002-01 | ACTIVE |
| CMP-RELAY-002-03 | toggle | 流式输出 | stream | 否 | — | — | — | REQ-RELAY-002-01 | ACTIVE |
| CMP-RELAY-002-04 | button | 发送请求 | — | 否 | — | `send` | — | REQ-RELAY-002-01 | ACTIVE |
| CMP-RELAY-002-05 | code_block | 响应 | response | 否 | — | — | — | REQ-RELAY-002-01 | ACTIVE |
| CMP-RELAY-002-06 | alert | 超时 / 错误提示 | — | 否 | — | — | — | REQ-RELAY-002-01 | ACTIVE |

### 交互与页面跳转

| Interaction ID | 名称 | 触发 | 动作 | 步骤 | 目标页面 | 关联需求 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="INT-RELAY-002-01"></a>INT-RELAY-002-01 | 模型选择 | `change:model` | `set_model` | - change:model<br>- set_model | — | REQ-RELAY-002-01 | ACTIVE |
| <a id="INT-RELAY-002-02"></a>INT-RELAY-002-02 | 发起请求 | `click:send` | `mock_relay` | - click:send<br>- mock_relay | — | REQ-RELAY-002-02 | ACTIVE |
| <a id="INT-RELAY-002-03"></a>INT-RELAY-002-03 | 失败重试 | `click:retry` | `retry` | - click:retry<br>- retry | — | REQ-RELAY-002-02 | ACTIVE |
| <a id="INT-RELAY-002-04"></a>INT-RELAY-002-04 | 查看请求日志 | `click:logs` | `navigate` | - click:logs<br>- navigate | PP-RELAY-002-02 | REQ-RELAY-002-02 | ACTIVE |

### 页面状态

| State ID | Kind | 说明 |
| --- | --- | --- |
| ST-RELAY-002-01-01 | idle | idle 状态：按 UDS 8.0.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-RELAY-002-01-02 | loading | loading 状态：按 UDS 8.0.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-RELAY-002-01-03 | error | error 状态：按 UDS 8.0.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-RELAY-002-01-04 | success | success 状态：按 UDS 8.0.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-RELAY-002-01-05 | disabled | disabled 状态：按 UDS 8.0.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-RELAY-002-01-06 | permission_denied | permission_denied 状态：按 UDS 8.0.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |

### 表单校验（与 PRD 业务规则同源）

| 字段 | 组件 | 校验规则来源 | 错误提示 |
| --- | --- | --- | --- |
| prompt | CMP-RELAY-002-02 | PRD 业务规则 | Prompt 不得为空 |


## <a id="PP-RELAY-002-02"></a>页面 2：PP-RELAY-002-02 · 多协议中继适配 · 请求日志

| 属性 | 值 |
| --- | --- |
| 布局 | detail |
| 入口 | `由 PP-RELAY-002-01 的页面跳转进入` |
| 状态 | ACTIVE |
| Demo 声明 | DEMO / MOCK：本原型只使用合成数据，不会发起真实支付、退款或余额变更。 |
| 规划提示 | — |
| 关联需求 | `REQ-RELAY-002-01` |

### 组件清单

| Component ID | 类型 | 名称 / 文案 | 字段 | 必填 | 选项 | 动作 / 触发 | 校验 / 属性 | 关联需求 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CMP-RELAY-002-101 | table | 请求记录 | logs | 否 | — | — | `{"columns":["时间","模型","Token","状态"]}` | REQ-RELAY-002-01 | ACTIVE |
| CMP-RELAY-002-102 | button | 返回 | — | 否 | — | `back` | — | REQ-RELAY-002-01 | ACTIVE |

### 交互与页面跳转

| Interaction ID | 名称 | 触发 | 动作 | 步骤 | 目标页面 | 关联需求 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="INT-RELAY-002-100"></a>INT-RELAY-002-100 | 返回主页面并恢复状态 | `click:back` | `restore_form_state` | - click:back<br>- restore_form_state | PP-RELAY-002-01 | REQ-RELAY-002-01 | ACTIVE |

### 页面状态

| State ID | Kind | 说明 |
| --- | --- | --- |
| ST-RELAY-002-02-01 | loading | loading 状态。 |
| ST-RELAY-002-02-02 | empty | empty 状态。 |
| ST-RELAY-002-02-03 | success | success 状态。 |

### 表单校验（与 PRD 业务规则同源）

本页无必填输入组件。


## 双向定位与同步

| 方向 | 定位键 | 目标 |
| --- | --- | --- |
| PRD → Prototype | Requirement ID | 本文档组件清单 / 交互清单中的「关联需求」列 |
| Prototype → PRD | Prototype Page ID | `docs/product/prd/relay/UTER-RELAY-002.md` §8 页面与交互 |
| Prototype → PRD | Interaction ID | PRD §6 业务流程 / §8 交互清单 |
| Prototype → PRD | Component ID | PRD §7 功能需求「关联组件」列 |

> 在产品规格中心中点击任一 ID 会在另一侧高亮定位；功能切换时两侧依据统一映射注册表重新加载。

## 原型 Mock 数据约束

- 所有金额、订单号、支付结果、余额、用户信息均为合成值，标记 `MOCK`。
- 不调用真实支付网关、退款接口、余额写入接口或账户管理接口。
- 不修改数据库、不写生产数据、不产生真实资金流水。
- 业务规则（例如最低充值金额）来自 PRD 业务规则字段，原型校验由双向同步引擎按 `rule_field` 自动更新。
