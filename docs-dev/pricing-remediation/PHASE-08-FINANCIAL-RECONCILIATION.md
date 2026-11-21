# PHASE 08 — 多币种与财务核算

状态：**PARTIALLY_BUILT**
（币种、汇率来源/时间、换算后 USD 价格、账单币种快照已实现；
供应商账单导入与对账未实现，标记 NOT_BUILT）

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

仍未实现：

- 采购币种、销售币种、结算币种三分法：当前只记录来源币种与换算 USD。
- 汇率历史版本表：只保存当前汇率快照，无按生效时间查询的历史序列。
- 供应商账单导入/用量匹配/模型映射/赠送额度/合同折扣/账单差异/未匹配记录。
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