# UTER-TASK-002 · 任务插件管理与市场 — 交互式原型说明

> **投影文档 · 禁止直接手工编辑**。原型事实源与 PRD 相同：`docs/product/registry/product-model.json`。
> 模型版本 **v1** · 渲染于 2026-11-09T15:47:41.749Z · 设计基线 UTER Design System 3.0

> **`DEMO / MOCK`**：本原型仅使用合成数据，不发起真实支付、退款、余额变更、账户操作或写生产数据；所有订单、金额、响应均为模拟值。
> **实现状态 `IMPLEMENTED`**：已实现（前后端均有证据）

打开可操作原型（推荐）：**交互式 HTML 原型** `docs/product/prototypes/task/UTER-TASK-002.html` —— 自包含网页，左原型 / 右 PRD 同源双栏，浏览器直接打开即可操作；或产品规格中心 `http://127.0.0.1:7788/` → Feature Catalog → `UTER-TASK-002` → 左侧 Prototype 面板。支持 PC / H5 视口、表单校验、弹窗 / 抽屉、列表 / 详情、加载 / 空 / 错误 / 成功 / 禁用 / 权限不足状态、页面跳转与状态恢复。

对应 PRD：[`docs/product/prd/task/UTER-TASK-002.md`](../../prd/task/UTER-TASK-002.md)

## 页面总览

| Prototype Page ID | 页面名称 | 布局 | 入口 | 状态 | 规划标记 | 关联需求 |
| --- | --- | --- | --- | --- | --- | --- |
| [PP-TASK-002-01](#PP-TASK-002-01) | 任务插件管理与市场 · 主页面 | table-with-toolbar | `web/src/routes/_authenticated/task-plugins/index.tsx` | ACTIVE | ACTIVE | `REQ-TASK-002-01`, `REQ-TASK-002-02` |
| [PP-TASK-002-02](#PP-TASK-002-02) | 任务插件管理与市场 · 详情 | detail | `由 PP-TASK-002-01 的页面跳转进入` | ACTIVE | ACTIVE | `REQ-TASK-002-01` |

## <a id="PP-TASK-002-01"></a>页面 1：PP-TASK-002-01 · 任务插件管理与市场 · 主页面

| 属性 | 值 |
| --- | --- |
| 布局 | table-with-toolbar |
| 入口 | `web/src/routes/_authenticated/task-plugins/index.tsx` |
| 状态 | ACTIVE |
| Demo 声明 | DEMO / MOCK：本原型只使用合成数据，不会发起真实支付、退款或余额变更。 |
| 规划提示 | — |
| 关联需求 | `REQ-TASK-002-01`, `REQ-TASK-002-02` |

### 组件清单

| Component ID | 类型 | 名称 / 文案 | 字段 | 必填 | 选项 | 动作 / 触发 | 校验 / 属性 | 关联需求 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CMP-TASK-002-01 | search | 搜索 | keyword | 否 | — | — | `{"placeholder":"输入关键字"}` | REQ-TASK-002-01 | ACTIVE |
| CMP-TASK-002-02 | select | 状态筛选 | status_filter | 否 | `全部`, `启用`, `停用`, `异常` | — | — | REQ-TASK-002-01 | ACTIVE |
| CMP-TASK-002-03 | table | 数据列表 | records | 否 | — | — | `{"columns":["ID","名称","状态","时间"]}` | REQ-TASK-002-01 | ACTIVE |
| CMP-TASK-002-04 | pagination | 分页 | page | 否 | — | — | `{"pageSize":10}` | REQ-TASK-002-01 | ACTIVE |
| CMP-TASK-002-05 | button | 刷新 | — | 否 | — | `refresh` | — | REQ-TASK-002-01 | ACTIVE |
| CMP-TASK-002-06 | drawer | 详情抽屉 | — | 否 | — | `row_click` | — | REQ-TASK-002-01 | ACTIVE |
| CMP-TASK-002-07 | alert | 加载失败提示 | — | 否 | — | — | — | REQ-TASK-002-01 | ACTIVE |

### 交互与页面跳转

| Interaction ID | 名称 | 触发 | 动作 | 步骤 | 目标页面 | 关联需求 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="INT-TASK-002-01"></a>INT-TASK-002-01 | 关键字搜索 | `input:keyword` | `filter_list` | - input:keyword<br>- filter_list | — | REQ-TASK-002-01 | ACTIVE |
| <a id="INT-TASK-002-02"></a>INT-TASK-002-02 | 状态筛选 | `change:status_filter` | `filter_list` | - change:status_filter<br>- filter_list | — | REQ-TASK-002-02 | ACTIVE |
| <a id="INT-TASK-002-03"></a>INT-TASK-002-03 | 翻页 | `click:page` | `paginate` | - click:page<br>- paginate | — | REQ-TASK-002-02 | ACTIVE |
| <a id="INT-TASK-002-04"></a>INT-TASK-002-04 | 打开详情抽屉 | `click:row` | `open_drawer` | - click:row<br>- open_drawer | — | REQ-TASK-002-02 | ACTIVE |
| <a id="INT-TASK-002-05"></a>INT-TASK-002-05 | 查看详情页 | `click:detail` | `navigate` | - click:detail<br>- navigate | PP-TASK-002-02 | REQ-TASK-002-02 | ACTIVE |

### 页面状态

| State ID | Kind | 说明 |
| --- | --- | --- |
| ST-TASK-002-01-01 | idle | idle 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-TASK-002-01-02 | loading | loading 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-TASK-002-01-03 | empty | empty 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-TASK-002-01-04 | error | error 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-TASK-002-01-05 | success | success 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-TASK-002-01-06 | disabled | disabled 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |
| ST-TASK-002-01-07 | permission_denied | permission_denied 状态：按 UTER Design System 3.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。 |

### 表单校验（与 PRD 业务规则同源）

本页无必填输入组件。


## <a id="PP-TASK-002-02"></a>页面 2：PP-TASK-002-02 · 任务插件管理与市场 · 详情

| 属性 | 值 |
| --- | --- |
| 布局 | detail |
| 入口 | `由 PP-TASK-002-01 的页面跳转进入` |
| 状态 | ACTIVE |
| Demo 声明 | DEMO / MOCK：本原型只使用合成数据，不会发起真实支付、退款或余额变更。 |
| 规划提示 | — |
| 关联需求 | `REQ-TASK-002-01` |

### 组件清单

| Component ID | 类型 | 名称 / 文案 | 字段 | 必填 | 选项 | 动作 / 触发 | 校验 / 属性 | 关联需求 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CMP-TASK-002-101 | tabs | 详情分组 | tabs | 否 | `基本信息`, `关联记录`, `变更历史` | — | — | REQ-TASK-002-01 | ACTIVE |
| CMP-TASK-002-102 | timeline | 状态时间线 | timeline | 否 | — | — | — | REQ-TASK-002-01 | ACTIVE |
| CMP-TASK-002-103 | button | 返回列表 | — | 否 | — | `back` | — | REQ-TASK-002-01 | ACTIVE |

### 交互与页面跳转

| Interaction ID | 名称 | 触发 | 动作 | 步骤 | 目标页面 | 关联需求 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="INT-TASK-002-100"></a>INT-TASK-002-100 | 返回主页面并恢复状态 | `click:back` | `restore_form_state` | - click:back<br>- restore_form_state | PP-TASK-002-01 | REQ-TASK-002-01 | ACTIVE |

### 页面状态

| State ID | Kind | 说明 |
| --- | --- | --- |
| ST-TASK-002-02-01 | loading | loading 状态。 |
| ST-TASK-002-02-02 | success | success 状态。 |
| ST-TASK-002-02-03 | empty | empty 状态。 |
| ST-TASK-002-02-04 | error | error 状态。 |

### 表单校验（与 PRD 业务规则同源）

本页无必填输入组件。


## 双向定位与同步

| 方向 | 定位键 | 目标 |
| --- | --- | --- |
| PRD → Prototype | Requirement ID | 本文档组件清单 / 交互清单中的「关联需求」列 |
| Prototype → PRD | Prototype Page ID | `docs/product/prd/task/UTER-TASK-002.md` §8 页面与交互 |
| Prototype → PRD | Interaction ID | PRD §6 业务流程 / §8 交互清单 |
| Prototype → PRD | Component ID | PRD §7 功能需求「关联组件」列 |

> 在产品规格中心中点击任一 ID 会在另一侧高亮定位；功能切换时两侧依据统一映射注册表重新加载。

## 原型 Mock 数据约束

- 所有金额、订单号、支付结果、余额、用户信息均为合成值，标记 `MOCK`。
- 不调用真实支付网关、退款接口、余额写入接口或账户管理接口。
- 不修改数据库、不写生产数据、不产生真实资金流水。
- 业务规则（例如最低充值金额）来自 PRD 业务规则字段，原型校验由双向同步引擎按 `rule_field` 自动更新。
