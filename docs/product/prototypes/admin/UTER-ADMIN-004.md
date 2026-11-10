# UTER-ADMIN-004 · 权限与请求策略 — 交互式原型说明

> **投影文档 · 禁止直接手工编辑**。原型事实源与 PRD 相同：`docs/product/registry/product-model.json`。
> 模型版本 **v1** · 渲染于 2026-11-09T15:47:41.761Z · 设计基线 UTER Design System 3.0

> **`DEMO / MOCK`**：本原型仅使用合成数据，不发起真实支付、退款、余额变更、账户操作或写生产数据；所有订单、金额、响应均为模拟值。
> **实现状态 `IMPLEMENTED`**：已实现（前后端均有证据）

打开可操作原型（推荐）：**交互式 HTML 原型** `docs/product/prototypes/admin/UTER-ADMIN-004.html` —— 自包含网页，左原型 / 右 PRD 同源双栏，浏览器直接打开即可操作；或产品规格中心 `http://127.0.0.1:7788/` → Feature Catalog → `UTER-ADMIN-004` → 左侧 Prototype 面板。支持 PC / H5 视口、表单校验、弹窗 / 抽屉、列表 / 详情、加载 / 空 / 错误 / 成功 / 禁用 / 权限不足状态、页面跳转与状态恢复。

对应 PRD：[`docs/product/prd/admin/UTER-ADMIN-004.md`](../../prd/admin/UTER-ADMIN-004.md)

## 页面总览

| Prototype Page ID | 页面名称 | 布局 | 入口 | 状态 | 规划标记 | 关联需求 |
| --- | --- | --- | --- | --- | --- | --- |
| [PP-ADMIN-004-01](#PP-ADMIN-004-01) | 权限与请求策略 · 主页面 | settings-tabs | `web/src/routes/_authenticated/system-settings/request-policies/$section.tsx` | ACTIVE | ACTIVE | `REQ-ADMIN-004-01`, `REQ-ADMIN-004-02` |

## <a id="PP-ADMIN-004-01"></a>页面 1：PP-ADMIN-004-01 · 权限与请求策略 · 主页面

| 属性 | 值 |
| --- | --- |
| 布局 | settings-tabs |
| 入口 | `web/src/routes/_authenticated/system-settings/request-policies/$section.tsx` |
| 状态 | ACTIVE |
| Demo 声明 | DEMO / MOCK：本原型只使用合成数据，不会发起真实支付、退款或余额变更。 |
| 规划提示 | — |
| 关联需求 | `REQ-ADMIN-004-01`, `REQ-ADMIN-004-02` |

### 组件清单

| Component ID | 类型 | 名称 / 文案 | 字段 | 必填 | 选项 | 动作 / 触发 | 校验 / 属性 | 关联需求 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CMP-ADMIN-004-01 | tabs | 配置分组 | tabs | 否 | `基础`, `安全`, `高级` | — | — | REQ-ADMIN-004-01 | ACTIVE |
| CMP-ADMIN-004-02 | input | 配置项 | config_value | 是 | — | — | `{"error_message":"配置值不合法"}` | REQ-ADMIN-004-01 | ACTIVE |
| CMP-ADMIN-004-03 | toggle | 启用开关 | enabled | 否 | — | — | — | REQ-ADMIN-004-01 | ACTIVE |
| CMP-ADMIN-004-04 | button | 保存 | — | 否 | — | `save` | — | REQ-ADMIN-004-01 | ACTIVE |
| CMP-ADMIN-004-05 | modal | 保存确认 | — | 否 | — | `save` | — | REQ-ADMIN-004-01 | ACTIVE |
| CMP-ADMIN-004-06 | alert | 权限不足提示 | — | 否 | — | — | — | REQ-ADMIN-004-01 | ACTIVE |

### 交互与页面跳转

| Interaction ID | 名称 | 触发 | 动作 | 步骤 | 目标页面 | 关联需求 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="INT-ADMIN-004-01"></a>INT-ADMIN-004-01 | 切换配置分组 | `click:tabs` | `switch_tab` | - click:tabs<br>- switch_tab | — | REQ-ADMIN-004-01 | ACTIVE |
| <a id="INT-ADMIN-004-02"></a>INT-ADMIN-004-02 | 配置校验 | `submit:form` | `validate_form` | - submit:form<br>- validate_form | — | REQ-ADMIN-004-02 | ACTIVE |
| <a id="INT-ADMIN-004-03"></a>INT-ADMIN-004-03 | 保存配置 | `click:save` | `open_modal_then_save` | - click:save<br>- open_modal_then_save | — | REQ-ADMIN-004-02 | ACTIVE |

### 页面状态

| State ID | Kind | 说明 |
| --- | --- | --- |
| ST-ADMIN-004-01-01 | idle | idle 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-ADMIN-004-01-02 | loading | loading 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-ADMIN-004-01-03 | error | error 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-ADMIN-004-01-04 | success | success 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-ADMIN-004-01-05 | disabled | disabled 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-ADMIN-004-01-06 | permission_denied | permission_denied 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |

### 表单校验（与 PRD 业务规则同源）

| 字段 | 组件 | 校验规则来源 | 错误提示 |
| --- | --- | --- | --- |
| config_value | CMP-ADMIN-004-02 | PRD 业务规则 | 配置值不合法 |


## 双向定位与同步

| 方向 | 定位键 | 目标 |
| --- | --- | --- |
| PRD → Prototype | Requirement ID | 本文档组件清单 / 交互清单中的「关联需求」列 |
| Prototype → PRD | Prototype Page ID | `docs/product/prd/admin/UTER-ADMIN-004.md` §8 页面与交互 |
| Prototype → PRD | Interaction ID | PRD §6 业务流程 / §8 交互清单 |
| Prototype → PRD | Component ID | PRD §7 功能需求「关联组件」列 |

> 在产品规格中心中点击任一 ID 会在另一侧高亮定位；功能切换时两侧依据统一映射注册表重新加载。

## 原型 Mock 数据约束

- 所有金额、订单号、支付结果、余额、用户信息均为合成值，标记 `MOCK`。
- 不调用真实支付网关、退款接口、余额写入接口或账户管理接口。
- 不修改数据库、不写生产数据、不产生真实资金流水。
- 业务规则（例如最低充值金额）来自 PRD 业务规则字段，原型校验由双向同步引擎按 `rule_field` 自动更新。
