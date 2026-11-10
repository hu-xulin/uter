# UTER-PAY-001 · 充值金额选择与充值下单 — 交互式原型说明

> **投影文档 · 禁止直接手工编辑**。原型事实源与 PRD 相同：`docs/product/registry/product-model.json`。
> 模型版本 **v1** · 渲染于 2026-11-09T15:47:41.706Z · 设计基线 UTER Design System 3.0

> **`DEMO / MOCK`**：本原型仅使用合成数据，不发起真实支付、退款、余额变更、账户操作或写生产数据；所有订单、金额、响应均为模拟值。
> **实现状态 `IMPLEMENTED`**：已实现（前后端均有证据）

打开可操作原型（推荐）：**交互式 HTML 原型** `docs/product/prototypes/pay/UTER-PAY-001.html` —— 自包含网页，左原型 / 右 PRD 同源双栏，浏览器直接打开即可操作；或产品规格中心 `http://127.0.0.1:7788/` → Feature Catalog → `UTER-PAY-001` → 左侧 Prototype 面板。支持 PC / H5 视口、表单校验、弹窗 / 抽屉、列表 / 详情、加载 / 空 / 错误 / 成功 / 禁用 / 权限不足状态、页面跳转与状态恢复。

对应 PRD：[`docs/product/prd/pay/UTER-PAY-001.md`](../../prd/pay/UTER-PAY-001.md)

## 页面总览

| Prototype Page ID | 页面名称 | 布局 | 入口 | 状态 | 规划标记 | 关联需求 |
| --- | --- | --- | --- | --- | --- | --- |
| [PP-PAY-001-01](#PP-PAY-001-01) | 充值金额选择与充值下单 · 主页面 | two-column-form | `web/src/routes/_authenticated/wallet/index.tsx` | ACTIVE | ACTIVE | `REQ-PAY-001-01`, `REQ-PAY-001-02`, `REQ-PAY-001-03` |
| [PP-PAY-001-02](#PP-PAY-001-02) | 充值金额选择与充值下单 · 订单结果与状态 | result | `由 PP-PAY-001-01 的页面跳转进入` | ACTIVE | ACTIVE | `REQ-PAY-001-01` |

## <a id="PP-PAY-001-01"></a>页面 1：PP-PAY-001-01 · 充值金额选择与充值下单 · 主页面

| 属性 | 值 |
| --- | --- |
| 布局 | two-column-form |
| 入口 | `web/src/routes/_authenticated/wallet/index.tsx` |
| 状态 | ACTIVE |
| Demo 声明 | DEMO / MOCK：本原型只使用合成数据，不会发起真实支付、退款或余额变更。 |
| 规划提示 | — |
| 关联需求 | `REQ-PAY-001-01`, `REQ-PAY-001-02`, `REQ-PAY-001-03` |

### 组件清单

| Component ID | 类型 | 名称 / 文案 | 字段 | 必填 | 选项 | 动作 / 触发 | 校验 / 属性 | 关联需求 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CMP-PAY-001-01 | badge | DEMO / MOCK：本原型只使用合成数据，不会发起真实支付、退款或余额变更。 | — | 否 | — | — | — | REQ-PAY-001-01 | ACTIVE |
| CMP-PAY-001-02 | radio_group | 充值金额 | amount_preset | 否 | `10`, `50`, `100`, `500` | — | `{"rule_field":"amount"}` | REQ-PAY-001-01 | ACTIVE |
| CMP-PAY-001-03 | input | 自定义金额 | amount | 是 | — | — | `{"rule_field":"min_amount","min":10,"error_message":"充值金额不得低于 10 元"}` | REQ-PAY-001-02 | ACTIVE |
| CMP-PAY-001-04 | select | 支付方式 | payment_method | 否 | `微信支付`, `支付宝`, `易支付`, `Stripe` | — | — | REQ-PAY-001-01 | ACTIVE |
| CMP-PAY-001-05 | button | 创建 MOCK 订单 | — | 否 | — | `create_order` | — | REQ-PAY-001-01 | ACTIVE |
| CMP-PAY-001-06 | alert | 金额校验错误提示 | — | 否 | — | — | `{"rule_field":"min_amount"}` | REQ-PAY-001-01 | ACTIVE |
| CMP-PAY-001-07 | modal | 订单确认 | — | 否 | — | `create_order` | — | REQ-PAY-001-01 | ACTIVE |

### 交互与页面跳转

| Interaction ID | 名称 | 触发 | 动作 | 步骤 | 目标页面 | 关联需求 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="INT-PAY-001-01"></a>INT-PAY-001-01 | 选择预设金额 | `click:amount_preset` | `set_amount` | - click:amount_preset<br>- set_amount | — | REQ-PAY-001-01 | ACTIVE |
| <a id="INT-PAY-001-02"></a>INT-PAY-001-02 | 校验自定义金额 | `input:amount` | `validate_min_amount` | - input:amount<br>- validate_min_amount | — | REQ-PAY-001-02 | ACTIVE |
| <a id="INT-PAY-001-03"></a>INT-PAY-001-03 | 创建订单并跳转结果页 | `click:create_order` | `open_modal_then_navigate` | - click:create_order<br>- open_modal_then_navigate | PP-PAY-001-02 | REQ-PAY-001-03 | ACTIVE |
| <a id="INT-PAY-001-04"></a>INT-PAY-001-04 | 返回并恢复表单 | `click:back` | `restore_form_state` | - click:back<br>- restore_form_state | — | REQ-PAY-001-03 | ACTIVE |

### 页面状态

| State ID | Kind | 说明 |
| --- | --- | --- |
| ST-PAY-001-01-01 | idle | idle 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-PAY-001-01-02 | loading | loading 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-PAY-001-01-03 | empty | empty 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-PAY-001-01-04 | error | error 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-PAY-001-01-05 | success | success 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-PAY-001-01-06 | disabled | disabled 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-PAY-001-01-07 | permission_denied | permission_denied 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |

### 表单校验（与 PRD 业务规则同源）

| 字段 | 组件 | 校验规则来源 | 错误提示 |
| --- | --- | --- | --- |
| amount | CMP-PAY-001-03 | `min_amount` min=10 | 充值金额不得低于 10 元 |


## <a id="PP-PAY-001-02"></a>页面 2：PP-PAY-001-02 · 充值金额选择与充值下单 · 订单结果与状态

| 属性 | 值 |
| --- | --- |
| 布局 | result |
| 入口 | `由 PP-PAY-001-01 的页面跳转进入` |
| 状态 | ACTIVE |
| Demo 声明 | DEMO / MOCK：本原型只使用合成数据，不会发起真实支付、退款或余额变更。 |
| 规划提示 | — |
| 关联需求 | `REQ-PAY-001-01` |

### 组件清单

| Component ID | 类型 | 名称 / 文案 | 字段 | 必填 | 选项 | 动作 / 触发 | 校验 / 属性 | 关联需求 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CMP-PAY-001-101 | badge | MOCK 订单 · 无真实资金变动 | — | 否 | — | — | — | REQ-PAY-001-01 | ACTIVE |
| CMP-PAY-001-102 | stat_card | 订单金额 | order_amount | 否 | — | — | — | REQ-PAY-001-01 | ACTIVE |
| CMP-PAY-001-103 | stat_card | 订单状态 | order_status | 否 | — | — | — | REQ-PAY-001-01 | ACTIVE |
| CMP-PAY-001-104 | button | 返回充值页 | — | 否 | — | `back` | — | REQ-PAY-001-01 | ACTIVE |
| CMP-PAY-001-105 | alert | 支付失败提示 | — | 否 | — | — | — | REQ-PAY-001-01 | ACTIVE |

### 交互与页面跳转

| Interaction ID | 名称 | 触发 | 动作 | 步骤 | 目标页面 | 关联需求 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="INT-PAY-001-100"></a>INT-PAY-001-100 | 返回主页面并恢复状态 | `click:back` | `restore_form_state` | - click:back<br>- restore_form_state | PP-PAY-001-01 | REQ-PAY-001-01 | ACTIVE |

### 页面状态

| State ID | Kind | 说明 |
| --- | --- | --- |
| ST-PAY-001-02-01 | loading | loading 状态。 |
| ST-PAY-001-02-02 | success | success 状态。 |
| ST-PAY-001-02-03 | error | error 状态。 |
| ST-PAY-001-02-04 | empty | empty 状态。 |

### 表单校验（与 PRD 业务规则同源）

本页无必填输入组件。


## 双向定位与同步

| 方向 | 定位键 | 目标 |
| --- | --- | --- |
| PRD → Prototype | Requirement ID | 本文档组件清单 / 交互清单中的「关联需求」列 |
| Prototype → PRD | Prototype Page ID | `docs/product/prd/pay/UTER-PAY-001.md` §8 页面与交互 |
| Prototype → PRD | Interaction ID | PRD §6 业务流程 / §8 交互清单 |
| Prototype → PRD | Component ID | PRD §7 功能需求「关联组件」列 |

> 在产品规格中心中点击任一 ID 会在另一侧高亮定位；功能切换时两侧依据统一映射注册表重新加载。

## 原型 Mock 数据约束

- 所有金额、订单号、支付结果、余额、用户信息均为合成值，标记 `MOCK`。
- 不调用真实支付网关、退款接口、余额写入接口或账户管理接口。
- 不修改数据库、不写生产数据、不产生真实资金流水。
- 业务规则（例如最低充值金额）来自 PRD 业务规则字段，原型校验由双向同步引擎按 `rule_field` 自动更新。
