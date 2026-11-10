# UX-INTERACTION-STANDARD
# Uter 用户体验与交互规范

**项目：** Uter  
**文档类型：** UX 与交互行为标准  
**适用范围：** PC Web、H5 及其他实际支持的用户界面  
**规范级别：** 强制执行
**规范版本：** 1.0.0（统一版本登记）  
**规范状态：** Active  
**最后更新：** 2026-11-05  
**下次复核：** 2027-02-03  
**维护责任：** Uter Engineering Maintainers  
**版本追溯：** 以 Git 文件历史及对应 Commit SHA 为准  

---

## 1. 规范目标

统一 Uter 所有页面和组件的交互行为，确保用户能够清晰理解系统状态、操作结果和异常原因。

本规范负责交互行为，不替代 design-system 的视觉设计规则（见 `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md`）。

## 2. 基本原则

- 操作结果必须明确。
- 状态变化必须可见。
- 错误信息必须可理解。
- 重要操作必须有保护机制。
- 不得让用户重复猜测操作结果。
- 网络异常时应提供合理反馈。
- 用户输入应尽量得到保留。
- 页面行为应保持一致。

## 3. 统一交互状态

适用组件应根据实际场景支持：

- Default。
- Hover。
- Focus。
- Active。
- Disabled。
- Loading。
- Success。
- Error。
- Empty。

不能让组件只实现视觉样式而缺少真实状态逻辑。

## 4. 页面状态

每个数据驱动页面必须考虑：

### Loading

数据加载中应提供明确反馈。

避免页面无反馈地长时间空白。

### Empty

无数据时应：

- 明确说明当前没有数据。
- 在适当场景说明原因。
- 提供合理的下一步操作。

### Error

请求失败时应：

- 说明操作未成功。
- 提供可理解的信息。
- 在适用时提供重试。
- 不暴露内部敏感信息。

### Partial Failure

多个区域分别请求时，应允许合理的局部失败处理，避免一个非关键请求失败导致整个页面不可用。

## 5. 表单交互

表单必须考虑：

- 必填提示。
- 输入格式。
- 长度限制。
- 实时或提交时校验。
- 错误定位。
- 提交 Loading。
- 重复提交防护。
- 提交失败后的输入保留。
- 成功后的状态反馈。

校验规则必须与后端保持一致。

## 6. 防重复操作

涉及以下操作时必须考虑重复提交：

- 充值。
- 支付。
- 退款。
- 余额调整。
- 删除。
- 创建订单。
- 发送请求。
- 创建 API Key。

前端防重复点击不能代替后端幂等控制。

## 7. 支付和充值交互

必须明确展示：

- 订单金额。
- 支付渠道。
- 订单状态。
- 支付处理中状态。
- 支付成功状态。
- 支付失败状态。
- 超时状态。
- 余额到账状态。

必须区分：

- 已创建订单。
- 已发起支付。
- 支付处理中。
- 支付平台确认成功。
- 系统确认入账。
- 充值完成。

不得将支付页面跳转成功直接显示为充值到账成功。

当状态尚未确认时，应提供合理的查询或等待机制。

## 8. Token 使用交互

展示 Token 或费用时必须明确：

- 输入 Token。
- 输出 Token。
- 缓存 Token（如适用）。
- 使用量。
- 费用。
- 统计周期。
- 数据更新时间。

预估费用与最终费用必须明确区分。

## 9. 异步操作

涉及后台任务的操作应展示：

- 等待中。
- 处理中。
- 已完成。
- 失败。
- 已取消（如支持）。

不得将任务提交成功直接显示为任务执行成功。

## 10. 网络异常

必须考虑：

- 网络断开。
- 请求超时。
- 请求取消。
- 请求重复。
- 页面刷新。
- 浏览器返回。
- 用户切换页面。

对于不可安全重试的操作，不能直接自动重复提交。

## 11. 确认与撤销

以下操作通常需要确认：

- 删除重要资源。
- 撤销 API Key。
- 修改重要配置。
- 余额调整。
- 退款。
- 不可逆操作。

如业务支持撤销，应明确撤销窗口和结果。

## 12. 响应式交互

PC Web 与 H5 应保持一致的业务逻辑，同时根据设备特点调整交互：

- 触摸目标。
- 弹窗布局。
- 导航行为。
- 表单输入。
- 滚动行为。
- 键盘行为。
- 设备安全区域。

不得仅缩小 PC 页面来替代移动端交互设计。

## 13. 无障碍要求

按实际组件类型提供：

- 键盘可操作性。
- 可见焦点。
- 语义化标签。
- 合理的 ARIA 属性。
- 可读的错误提示。
- 合理的对比度。
- 非颜色单一状态表达。

## 14. 交互一致性

相同业务操作应使用一致的：

- 按钮行为。
- 加载反馈。
- 错误提示。
- 成功提示。
- 弹窗行为。
- 表单校验。
- 状态展示。

不得在不同页面重复创造相互矛盾的交互规则。

## 15. 测试要求

按适用情况验证：

- 正常交互。
- Loading。
- Empty。
- Error。
- 重复点击。
- 网络中断。
- 页面刷新。
- 权限不足。
- H5 触摸操作。
- 键盘操作。

## 16. Uter 代码事实锚点（2026-11-01 校准）

### 16.1 视觉与交互的分工

视觉规则**不定义在本文件**，唯一真源是 `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md`（+ showcase-3.0.html），门禁为 `bun run lint:design:strict`（T1–T16，见下）。本文件只管交互行为。二者冲突时以 UTER-DESIGN-SYSTEM-3.0.md 为准。

### 16.2 前端结构事实

- 页面按 feature 组织：`web/src/features/`（31 个域：about、auth、channels、chat、dashboard、keys、models、playground、pricing、system-settings、users、wallet 等）；基础组件 `web/src/components/ui/`（66 个 .tsx，基于 **Base UI** 非 Radix）。
- 路由：TanStack Router 文件式（web/src/routes/，71 个 .tsx；`_authenticated`/`_public`/`(auth)`/`(errors)` 分组；路由树由插件生成）。
- 数据表：统一用 `@/components/data-table` 包（core/layout/toolbar/static/hooks 五层，公共 API 走 index.ts）；简单表格用 `components/ui/table.tsx`（dense 档：td 13px、th 12px）。
- 全局提示：sonner（components/ui/sonner.tsx）；图标：仅 lucide-react，尺寸只允许 16/18/24/32/48，默认 18px，stroke-width 统一 2（spec-guards 守护）。
- 状态：4 个 Zustand store；请求统一 axios 实例 `web/src/lib/http-client.ts`。
- i18n：7 语言，错误/提示文案必须走 key（后端错误回传 message_key/message_params 时前端用其翻译）。

### 16.3 设计门禁（lint:design:strict 的 T1–T16）

T1 字号阶梯重复声明 / T2 任意字号工具类 text-[…]px / T3 任意行高 / T4 内联字号数值 / T5 CSS 硬编码字号 / T6 非浮层投影 / T7 调色板直用色 / T8 裸色值 / T9 leading-* 行高覆盖 / T10 任意圆角 / T11 未登记动效节奏 / T12 tracking-* 字距 / T13 text-foreground/NN 透明度冒充层级 / T14 hover:bg-X/NN 凑悬停 / T15 bg-X/NN 凑浅底 / T16 低于 12px 最小字号。基线 `web/design-tokens.baseline.json` 当前 0 条，CI --strict 真阻断。

### 16.4 交互验收的既有设施

- spec-guards 测试：`web/src/design-system/__tests__/spec-guards.test.ts`（body baseline、card summary value、icon library、icon geometry 等守护用例）。
- 视觉回归双轨（不接 CI，缺栈=BLOCKED 绝不假通过）：`bun run test:visual[:update]`（showcase 哈希）+ `bun run test:visual:e2e`（Playwright PNG；refresh cookie 一次性，禁共享 storageState；登录限流整轮 ≤3 次）。
- 支付状态展示：充值 UI 必须区分「已创建订单 / 已发起支付 / 处理中 / 平台确认成功 / 系统确认入账」——真实后端提供订单查询接口（GetUserTopUps 含读时对账），前端不得把跳转返回当入账成功。

## 17. 完成定义

功能不仅需要视觉正确，还必须满足：

- 交互完整。
- 状态准确。
- 异常可恢复。
- 重复操作受控。
- 设备适配合理。
- 无障碍要求得到处理。

---

**所有 UI 功能必须同时满足视觉规范和交互规范。**