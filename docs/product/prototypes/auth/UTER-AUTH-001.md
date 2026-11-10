# UTER-AUTH-001 · 邮箱密码登录 — 交互式原型说明

> **投影文档 · 禁止直接手工编辑**。原型事实源与 PRD 相同：`docs/product/registry/product-model.json`。
> 模型版本 **v1** · 渲染于 2026-11-09T15:47:41.675Z · 设计基线 UTER Design System 3.0

> **`DEMO / MOCK`**：本原型仅使用合成数据，不发起真实支付、退款、余额变更、账户操作或写生产数据；所有订单、金额、响应均为模拟值。
> **实现状态 `IMPLEMENTED`**：已实现（前后端均有证据）

打开可操作原型（推荐）：**交互式 HTML 原型** `docs/product/prototypes/auth/UTER-AUTH-001.html` —— 自包含网页，左原型 / 右 PRD 同源双栏，浏览器直接打开即可操作；或产品规格中心 `http://127.0.0.1:7788/` → Feature Catalog → `UTER-AUTH-001` → 左侧 Prototype 面板。支持 PC / H5 视口、表单校验、弹窗 / 抽屉、列表 / 详情、加载 / 空 / 错误 / 成功 / 禁用 / 权限不足状态、页面跳转与状态恢复。

对应 PRD：[`docs/product/prd/auth/UTER-AUTH-001.md`](../../prd/auth/UTER-AUTH-001.md)

## 页面总览

| Prototype Page ID | 页面名称 | 布局 | 入口 | 状态 | 规划标记 | 关联需求 |
| --- | --- | --- | --- | --- | --- | --- |
| [PP-AUTH-001-01](#PP-AUTH-001-01) | 邮箱密码登录 · 主页面 | center-form | `web/src/routes/(auth)/sign-in.tsx` | ACTIVE | ACTIVE | `REQ-AUTH-001-01`, `REQ-AUTH-001-02`, `REQ-AUTH-001-03` |
| [PP-AUTH-001-02](#PP-AUTH-001-02) | 邮箱密码登录 · 登录后落地页 | result | `由 PP-AUTH-001-01 的页面跳转进入` | ACTIVE | ACTIVE | `REQ-AUTH-001-01` |

## <a id="PP-AUTH-001-01"></a>页面 1：PP-AUTH-001-01 · 邮箱密码登录 · 主页面

| 属性 | 值 |
| --- | --- |
| 布局 | center-form |
| 入口 | `web/src/routes/(auth)/sign-in.tsx` |
| 状态 | ACTIVE |
| Demo 声明 | DEMO / MOCK：本原型只使用合成数据，不会发起真实支付、退款或余额变更。 |
| 规划提示 | — |
| 关联需求 | `REQ-AUTH-001-01`, `REQ-AUTH-001-02`, `REQ-AUTH-001-03` |

### 组件清单

| Component ID | 类型 | 名称 / 文案 | 字段 | 必填 | 选项 | 动作 / 触发 | 校验 / 属性 | 关联需求 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CMP-AUTH-001-01 | input | 邮箱 | email | 是 | — | — | `{"error_message":"请输入有效邮箱"}` | REQ-AUTH-001-01 | ACTIVE |
| CMP-AUTH-001-02 | input | 密码 | password | 是 | — | — | `{"error_message":"密码不得为空"}` | REQ-AUTH-001-01 | ACTIVE |
| CMP-AUTH-001-03 | button | 提交 | — | 否 | — | `submit` | — | REQ-AUTH-001-01 | ACTIVE |
| CMP-AUTH-001-04 | modal | 安全验证 | — | 否 | — | `submit` | — | REQ-AUTH-001-01 | ACTIVE |
| CMP-AUTH-001-05 | alert | 错误提示 | — | 否 | — | — | — | REQ-AUTH-001-01 | ACTIVE |

### 交互与页面跳转

| Interaction ID | 名称 | 触发 | 动作 | 步骤 | 目标页面 | 关联需求 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="INT-AUTH-001-01"></a>INT-AUTH-001-01 | 表单校验 | `submit:form` | `validate_form` | - submit:form<br>- validate_form | — | REQ-AUTH-001-01 | ACTIVE |
| <a id="INT-AUTH-001-02"></a>INT-AUTH-001-02 | 打开安全验证弹窗 | `click:submit` | `open_modal` | - click:submit<br>- open_modal | — | REQ-AUTH-001-02 | ACTIVE |
| <a id="INT-AUTH-001-03"></a>INT-AUTH-001-03 | 成功后跳转控制台 | `success` | `navigate` | - success<br>- navigate | PP-AUTH-001-02 | REQ-AUTH-001-03 | ACTIVE |

### 页面状态

| State ID | Kind | 说明 |
| --- | --- | --- |
| ST-AUTH-001-01-01 | idle | idle 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-AUTH-001-01-02 | loading | loading 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-AUTH-001-01-03 | error | error 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-AUTH-001-01-04 | success | success 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-AUTH-001-01-05 | disabled | disabled 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-AUTH-001-01-06 | permission_denied | permission_denied 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |

### 表单校验（与 PRD 业务规则同源）

| 字段 | 组件 | 校验规则来源 | 错误提示 |
| --- | --- | --- | --- |
| email | CMP-AUTH-001-01 | PRD 业务规则 | 请输入有效邮箱 |
| password | CMP-AUTH-001-02 | PRD 业务规则 | 密码不得为空 |


## <a id="PP-AUTH-001-02"></a>页面 2：PP-AUTH-001-02 · 邮箱密码登录 · 登录后落地页

| 属性 | 值 |
| --- | --- |
| 布局 | result |
| 入口 | `由 PP-AUTH-001-01 的页面跳转进入` |
| 状态 | ACTIVE |
| Demo 声明 | DEMO / MOCK：本原型只使用合成数据，不会发起真实支付、退款或余额变更。 |
| 规划提示 | — |
| 关联需求 | `REQ-AUTH-001-01` |

### 组件清单

| Component ID | 类型 | 名称 / 文案 | 字段 | 必填 | 选项 | 动作 / 触发 | 校验 / 属性 | 关联需求 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CMP-AUTH-001-101 | badge | 登录成功（MOCK） | — | 否 | — | — | — | REQ-AUTH-001-01 | ACTIVE |
| CMP-AUTH-001-102 | stat_card | 会话状态 | session | 否 | — | — | — | REQ-AUTH-001-01 | ACTIVE |
| CMP-AUTH-001-103 | button | 返回 | — | 否 | — | `back` | — | REQ-AUTH-001-01 | ACTIVE |

### 交互与页面跳转

| Interaction ID | 名称 | 触发 | 动作 | 步骤 | 目标页面 | 关联需求 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="INT-AUTH-001-100"></a>INT-AUTH-001-100 | 返回主页面并恢复状态 | `click:back` | `restore_form_state` | - click:back<br>- restore_form_state | PP-AUTH-001-01 | REQ-AUTH-001-01 | ACTIVE |

### 页面状态

| State ID | Kind | 说明 |
| --- | --- | --- |
| ST-AUTH-001-02-01 | success | success 状态。 |
| ST-AUTH-001-02-02 | loading | loading 状态。 |

### 表单校验（与 PRD 业务规则同源）

本页无必填输入组件。


## 双向定位与同步

| 方向 | 定位键 | 目标 |
| --- | --- | --- |
| PRD → Prototype | Requirement ID | 本文档组件清单 / 交互清单中的「关联需求」列 |
| Prototype → PRD | Prototype Page ID | `docs/product/prd/auth/UTER-AUTH-001.md` §8 页面与交互 |
| Prototype → PRD | Interaction ID | PRD §6 业务流程 / §8 交互清单 |
| Prototype → PRD | Component ID | PRD §7 功能需求「关联组件」列 |

> 在产品规格中心中点击任一 ID 会在另一侧高亮定位；功能切换时两侧依据统一映射注册表重新加载。

## 原型 Mock 数据约束

- 所有金额、订单号、支付结果、余额、用户信息均为合成值，标记 `MOCK`。
- 不调用真实支付网关、退款接口、余额写入接口或账户管理接口。
- 不修改数据库、不写生产数据、不产生真实资金流水。
- 业务规则（例如最低充值金额）来自 PRD 业务规则字段，原型校验由双向同步引擎按 `rule_field` 自动更新。
