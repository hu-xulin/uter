# PHASE 08 — 多币种与财务核算

状态：**PARTIALLY_BUILT**
（币种/汇率、合同成本、表达式一致性校验与用量样本对账已实现；
供应商发票导入与真实账单对账仍为 BLOCKED）

## 1. 已实现

- `ChannelOfficialPricing`：`Currency`、`FXRateToUSD`、`FXSource`、`FXTimestamp`。
- `ChannelPricingRawComponent`：原始金额、原始币种、原始单位、换算 USD、汇率、
  汇率来源/时间、是否推断币种、价格来源、生效时间。
- `ChannelBillingPricing`：`Currency`、`FXRate`，进入消费日志 admin 字段。
- 百炼 CNY 报价经 `USDExchangeRate` 转换为 USD 后存储；原始组件保留。

## 2. 合同成本（本轮新增）

- `ChannelModelPricing.PurchasePricing` 保存操作员录入的合同成本，与公开报价隔离。
- 编辑弹窗可录入 input/output（token 模式）或 per-call/second/minute，并设置
  “Cost verified”。
- 计费快照 `PurchaseUSD` 优先取合同成本，并记录 verified/source。
- 批量毛利在合同成本存在时以其比较；未验证时 `MarginVerified=false`。

## 2.1 上游计费对账（工作区已有实现）

- `service.ReconcileChannelUpstreamBilling`：对渠道每个可执行表达式运行确定性
  用量样本，报告 `RULES_PASSED / RULE_FAILED / NO_EXPRESSION_RULE`。
- `service.ReconcileUpstreamBillingSamples`：接收上游账单样本用量与成本，计算
  Uter 按当前售价应收金额、差额与差额百分比，状态 `MATCHED / MISMATCHED /
  NO_PRICE / UNSUPPORTED`。
- 管理入口：`GET /api/channel/:id/upstream_reconciliation`、
  `POST /api/channel/:id/upstream_reconciliation/samples`，前端渠道定价面板
  展示对账结果。
- 供应商发票对账仍返回 `BLOCKED`，因为没有授权账单导出。

仍未实现：

- 供应商发票导入/模型映射/赠送额度/合同折扣/账单周期解析。
- 采购币种、销售币种、结算币种三分法：当前只记录来源币种与换算 USD。
- 汇率历史版本表：只保存当前汇率快照，无按生效时间查询的历史序列。
- 发票级账单差异与未匹配记录（样本级对账已实现）。
- 实际结算毛利：没有账单数据，无法计算。
- Decimal 财务账本：使用 int 配额与受检浮点转换。

## 3. 毛利口径（当前可声明）

| 口径 | 是否可计算 | 依据 |
|---|---|---|
| 理论毛利 | 可 | 销售价 - 上游公开报价 |
| 预估毛利 | 可 | 同上，且标记报价来源 |
| 已验证毛利 | 可（仅当合同成本标记 verified） | 销售价 - 合同成本 |
| 实际结算毛利 | 否 | 缺供应商账单 |

界面/API 不得把前两者表述为“已验证”或“实际”。

## 4. 外部依赖

供应商账单通常需要：
- 供应商账户授权或账单导出权限；
- 账单周期与用量明细；
- 合同折扣/赠送额度规则。

当前环境没有这些凭据，故不对账功能做任何“模拟通过”声明。

## 5. 验证

币种/汇率字段的正确性由现有百炼同步与计费测试覆盖（包含在
`GOWORK=off go test ./...` exit 0 中）。对账功能无实现，无测试可执行。