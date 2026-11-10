# UTER-MISC-010 · 首次安装与初始化 — 交互式原型说明

> **投影文档 · 禁止直接手工编辑**。原型事实源与 PRD 相同：`docs/product/registry/product-model.json`。
> 模型版本 **v1** · 渲染于 2026-11-09T15:47:41.775Z · 设计基线 UTER Design System 3.0

> **`DEMO / MOCK`**：本原型仅使用合成数据，不发起真实支付、退款、余额变更、账户操作或写生产数据；所有订单、金额、响应均为模拟值。
> **实现状态 `IMPLEMENTED`**：已实现（前后端均有证据）

打开可操作原型（推荐）：**交互式 HTML 原型** `docs/product/prototypes/misc/UTER-MISC-010.html` —— 自包含网页，左原型 / 右 PRD 同源双栏，浏览器直接打开即可操作；或产品规格中心 `http://127.0.0.1:7788/` → Feature Catalog → `UTER-MISC-010` → 左侧 Prototype 面板。支持 PC / H5 视口、表单校验、弹窗 / 抽屉、列表 / 详情、加载 / 空 / 错误 / 成功 / 禁用 / 权限不足状态、页面跳转与状态恢复。

对应 PRD：[`docs/product/prd/misc/UTER-MISC-010.md`](../../prd/misc/UTER-MISC-010.md)

## 页面总览

| Prototype Page ID | 页面名称 | 布局 | 入口 | 状态 | 规划标记 | 关联需求 |
| --- | --- | --- | --- | --- | --- | --- |
| [PP-MISC-010-01](#PP-MISC-010-01) | 首次安装与初始化 · 主页面 | single-column-form | `web/src/routes/setup/index.tsx` | ACTIVE | ACTIVE | `REQ-MISC-010-01`, `REQ-MISC-010-02` |

## <a id="PP-MISC-010-01"></a>页面 1：PP-MISC-010-01 · 首次安装与初始化 · 主页面

| 属性 | 值 |
| --- | --- |
| 布局 | single-column-form |
| 入口 | `web/src/routes/setup/index.tsx` |
| 状态 | ACTIVE |
| Demo 声明 | DEMO / MOCK：本原型只使用合成数据，不会发起真实支付、退款或余额变更。 |
| 规划提示 | — |
| 关联需求 | `REQ-MISC-010-01`, `REQ-MISC-010-02` |

### 组件清单

| Component ID | 类型 | 名称 / 文案 | 字段 | 必填 | 选项 | 动作 / 触发 | 校验 / 属性 | 关联需求 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CMP-MISC-010-01 | input | 输入项 | field | 是 | — | — | `{"error_message":"该字段不得为空"}` | REQ-MISC-010-01 | ACTIVE |
| CMP-MISC-010-02 | button | 提交 | — | 否 | — | `submit` | — | REQ-MISC-010-01 | ACTIVE |
| CMP-MISC-010-03 | modal | 结果确认 | — | 否 | — | `submit` | — | REQ-MISC-010-01 | ACTIVE |
| CMP-MISC-010-04 | alert | 错误提示 | — | 否 | — | — | — | REQ-MISC-010-01 | ACTIVE |

### 交互与页面跳转

| Interaction ID | 名称 | 触发 | 动作 | 步骤 | 目标页面 | 关联需求 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="INT-MISC-010-01"></a>INT-MISC-010-01 | 表单校验 | `submit:form` | `validate_form` | - submit:form<br>- validate_form | — | REQ-MISC-010-01 | ACTIVE |
| <a id="INT-MISC-010-02"></a>INT-MISC-010-02 | 提交并反馈 | `click:submit` | `open_modal_then_save` | - click:submit<br>- open_modal_then_save | — | REQ-MISC-010-02 | ACTIVE |

### 页面状态

| State ID | Kind | 说明 |
| --- | --- | --- |
| ST-MISC-010-01-01 | idle | idle 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-MISC-010-01-02 | loading | loading 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-MISC-010-01-03 | error | error 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-MISC-010-01-04 | success | success 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-MISC-010-01-05 | disabled | disabled 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-MISC-010-01-06 | permission_denied | permission_denied 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |

### 表单校验（与 PRD 业务规则同源）

| 字段 | 组件 | 校验规则来源 | 错误提示 |
| --- | --- | --- | --- |
| field | CMP-MISC-010-01 | PRD 业务规则 | 该字段不得为空 |


## 双向定位与同步

| 方向 | 定位键 | 目标 |
| --- | --- | --- |
| PRD → Prototype | Requirement ID | 本文档组件清单 / 交互清单中的「关联需求」列 |
| Prototype → PRD | Prototype Page ID | `docs/product/prd/misc/UTER-MISC-010.md` §8 页面与交互 |
| Prototype → PRD | Interaction ID | PRD §6 业务流程 / §8 交互清单 |
| Prototype → PRD | Component ID | PRD §7 功能需求「关联组件」列 |

> 在产品规格中心中点击任一 ID 会在另一侧高亮定位；功能切换时两侧依据统一映射注册表重新加载。

## 原型 Mock 数据约束

- 所有金额、订单号、支付结果、余额、用户信息均为合成值，标记 `MOCK`。
- 不调用真实支付网关、退款接口、余额写入接口或账户管理接口。
- 不修改数据库、不写生产数据、不产生真实资金流水。
- 业务规则（例如最低充值金额）来自 PRD 业务规则字段，原型校验由双向同步引擎按 `rule_field` 自动更新。
