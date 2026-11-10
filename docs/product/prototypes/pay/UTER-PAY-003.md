# UTER-PAY-003 · 支付回调、幂等与对账 — 交互式原型说明

> **投影文档 · 禁止直接手工编辑**。原型事实源与 PRD 相同：`docs/product/registry/product-model.json`。
> 模型版本 **v1** · 渲染于 2026-11-09T15:47:41.711Z · 设计基线 UTER Design System 3.0

> **`DEMO / MOCK`**：本原型仅使用合成数据，不发起真实支付、退款、余额变更、账户操作或写生产数据；所有订单、金额、响应均为模拟值。
> **实现状态 `BACKEND_ONLY`**：仅后端（未发现用户侧页面）

打开可操作原型（推荐）：**交互式 HTML 原型** `docs/product/prototypes/pay/UTER-PAY-003.html` —— 自包含网页，左原型 / 右 PRD 同源双栏，浏览器直接打开即可操作；或产品规格中心 `http://127.0.0.1:7788/` → Feature Catalog → `UTER-PAY-003` → 左侧 Prototype 面板。支持 PC / H5 视口、表单校验、弹窗 / 抽屉、列表 / 详情、加载 / 空 / 错误 / 成功 / 禁用 / 权限不足状态、页面跳转与状态恢复。

对应 PRD：[`docs/product/prd/pay/UTER-PAY-003.md`](../../prd/pay/UTER-PAY-003.md)

## 页面总览

| Prototype Page ID | 页面名称 | 布局 | 入口 | 状态 | 规划标记 | 关联需求 |
| --- | --- | --- | --- | --- | --- | --- |
| [PP-PAY-003-01](#PP-PAY-003-01) | 支付回调、幂等与对账 · 主页面 | detail | `（未发现对应前端页面：BACKEND_ONLY）` | ACTIVE | ACTIVE | `REQ-PAY-003-01`, `REQ-PAY-003-02`, `REQ-PAY-003-03` |

## <a id="PP-PAY-003-01"></a>页面 1：PP-PAY-003-01 · 支付回调、幂等与对账 · 主页面

| 属性 | 值 |
| --- | --- |
| 布局 | detail |
| 入口 | `（未发现对应前端页面：BACKEND_ONLY）` |
| 状态 | ACTIVE |
| Demo 声明 | DEMO / MOCK：本原型只使用合成数据，不会发起真实支付、退款或余额变更。 |
| 规划提示 | — |
| 关联需求 | `REQ-PAY-003-01`, `REQ-PAY-003-02`, `REQ-PAY-003-03` |

### 组件清单

| Component ID | 类型 | 名称 / 文案 | 字段 | 必填 | 选项 | 动作 / 触发 | 校验 / 属性 | 关联需求 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CMP-PAY-003-01 | tabs | 信息分组 | tabs | 否 | `概览`, `关联`, `历史` | — | — | REQ-PAY-003-01 | ACTIVE |
| CMP-PAY-003-02 | timeline | 状态时间线 | timeline | 否 | — | — | — | REQ-PAY-003-01 | ACTIVE |
| CMP-PAY-003-03 | badge | 当前状态 | status | 否 | — | — | — | REQ-PAY-003-01 | ACTIVE |
| CMP-PAY-003-04 | button | 返回 | — | 否 | — | `back` | — | REQ-PAY-003-01 | ACTIVE |
| CMP-PAY-003-05 | alert | 加载失败提示 | — | 否 | — | — | — | REQ-PAY-003-01 | ACTIVE |

### 交互与页面跳转

| Interaction ID | 名称 | 触发 | 动作 | 步骤 | 目标页面 | 关联需求 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="INT-PAY-003-01"></a>INT-PAY-003-01 | 切换分组 | `click:tabs` | `switch_tab` | - click:tabs<br>- switch_tab | — | REQ-PAY-003-01 | ACTIVE |
| <a id="INT-PAY-003-02"></a>INT-PAY-003-02 | 返回 | `click:back` | `restore_form_state` | - click:back<br>- restore_form_state | — | REQ-PAY-003-02 | ACTIVE |

### 页面状态

| State ID | Kind | 说明 |
| --- | --- | --- |
| ST-PAY-003-01-01 | idle | idle 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-PAY-003-01-02 | loading | loading 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-PAY-003-01-03 | empty | empty 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-PAY-003-01-04 | error | error 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-PAY-003-01-05 | success | success 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-PAY-003-01-06 | permission_denied | permission_denied 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |

### 表单校验（与 PRD 业务规则同源）

本页无必填输入组件。


## 双向定位与同步

| 方向 | 定位键 | 目标 |
| --- | --- | --- |
| PRD → Prototype | Requirement ID | 本文档组件清单 / 交互清单中的「关联需求」列 |
| Prototype → PRD | Prototype Page ID | `docs/product/prd/pay/UTER-PAY-003.md` §8 页面与交互 |
| Prototype → PRD | Interaction ID | PRD §6 业务流程 / §8 交互清单 |
| Prototype → PRD | Component ID | PRD §7 功能需求「关联组件」列 |

> 在产品规格中心中点击任一 ID 会在另一侧高亮定位；功能切换时两侧依据统一映射注册表重新加载。

## 原型 Mock 数据约束

- 所有金额、订单号、支付结果、余额、用户信息均为合成值，标记 `MOCK`。
- 不调用真实支付网关、退款接口、余额写入接口或账户管理接口。
- 不修改数据库、不写生产数据、不产生真实资金流水。
- 业务规则（例如最低充值金额）来自 PRD 业务规则字段，原型校验由双向同步引擎按 `rule_field` 自动更新。
