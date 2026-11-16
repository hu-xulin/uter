# 交互式 Prototype 建设规范

> UTER 产品原型与 PRD 一体化系统 · 规范编号 STD-PROTO-01 · 生效版本 v1 · 2026-11-09T15:47:41.777Z
> 本规范由统一需求模型驱动；唯一事实源 `docs/product/registry/product-model.json`。设计基线：UDS 8.0.0。

## 1. 覆盖要求
- 每个 Feature 至少一个 Prototype Page；按功能类型覆盖表单、按钮、弹窗、抽屉、列表、详情、搜索、筛选、分页。
- 页面必须具备并可在规格中心切换：`idle / loading / empty / error / success / disabled / permission_denied`。
- 必填输入必须带 `props.error_message` 或 `props.min` 或 `input_type`（检查项 `V-PROTO-FORM`）。
- 每个 button 组件必须有 `action`；每个 interaction 必须归属有效需求，跳转目标必须是本 Feature 内页面（`V-PROTO-BTN / INT / NAV`）。
- 支持页面跳转、返回、表单状态恢复；PC 与 H5 两种视口。

## 1.1 交互式 HTML 原型（主载体）
- 每个 Feature 必须生成 `prototypes/{domain}/<Feature ID>.html`（由统一模型渲染，检查项 `V-FILE-PROTO-HTML`），与同目录 `.md` 原型说明同名对应。
- HTML 为自包含单文件（内联 CSS / JS，零外部依赖），浏览器直接打开即可操作；左侧原型 / 右侧 PRD 同源双栏，共用同一 `Feature ID`。
- 组件必须携带 `data-component-id` 与 `data-requirement-id`，右侧 PRD 需求块 `id="req-<Requirement ID>"`；双向定位必须可点（`V-HTML-LINK-*`）。
- 表单校验规则（min / error_message）必须来自 PRD 业务规则同源字段；HTML 在每次有效变更后随两侧投影一起重渲染。

## 2. 数据安全（强制）
- 所有模拟交易、支付、退款、余额、订单、账户数据必须标注 `DEMO` 或 `MOCK`。
- 禁止发起真实支付 / 退款 / 余额变更 / 账户操作，禁止写生产数据。
- `NOT_IMPLEMENTED` 页面必须标记 `planned: true` 并显示规划提示，不得冒充上线功能。

## 3. 视觉基线
UDS 8.0.0：品牌主色 `#5B5EE6`、PC 正文 14px、基础圆角 10px、4px 间距网格、Light / Dark 主题；不得使用已废弃的 2.1 基线。
