# PHASE 01 — 统一价格数据标准

状态：**PARTIALLY_BUILT**
（价格类型分层已实现；合同采购成本/实际结算成本缺少可信数据源）

## 1. 已实现的类型分层

`model/channel_model_pricing.go`：

| 概念 | 存储位置 | 说明 |
|---|---|---|
| 官方绝对价 | `ChannelOfficialPricing.Tiers` + `PriceKind=OFFICIAL_ABSOLUTE` | 上游公开列表价 |
| 官方倍率 | `PriceKind=OFFICIAL_RATIO` + `RatioBasis` | 明确记录倍率、换算基准、公式、版本、结果 |
| 渠道报价/折扣价 | `ChannelOfficialPricing.ChannelPrice` / `ChannelPriceTiers` | 与官方价分开保存，不互相覆盖 |
| 销售价 | `ChannelInternalPricing` | 人工或显式派生；同步不覆盖人工价 |
| 计费表达式 | `BillingExpr` + `ExpressionHash` + `ExpressionStatus` | 编译通过才可执行 |
| 无法识别 | `PriceKind=UNKNOWN` + `NeedsReview` | 不生成猜测价格 |

本轮新增：

- `PriceKind`：`OFFICIAL_ABSOLUTE` / `OFFICIAL_RATIO` / `CHANNEL_RATIO` /
  `OFFICIAL_QUOTE` / `BILLING_EXPRESSION` / `UNKNOWN`。
- `ChannelRatioBasis`：`raw_ratio`、`basis_usd_per_million`、`formula`、
  `formula_version`、`result_input/output_usd_per_million`。

## 2. New API 兼容价格解析修正

`service/generic_upstream_pricing.go:191`：

- `model_ratio` → `CHANNEL_RATIO`，按 1 ratio = 2 USD/1M 换算，并写入换算记录；
  不再冒充官方绝对价。
- `official_ratio` → `OFFICIAL_RATIO`，同样保留换算记录。
- token 模型只给 `official_price` 而无单位 → `UNKNOWN` +
  `OFFICIAL_PRICE_UNIT_UNKNOWN`，不生成 tiers。
- `official_price` 与 ratio 同时出现 → `OFFICIAL_PRICE_AND_RATIO_CONFLICT`。
- 按次模型：有 `official_price` 时标记 `OFFICIAL_ABSOLUTE`；否则
  `ModelPrice` 为 `CHANNEL_QUOTE`。

批量调价的 official basis 会拒绝 `CHANNEL_RATIO` 等非官方类型
（`service/channel_batch_pricing.go:922`），防止用渠道倍率冒充官方价调价。

## 3. 合同采购成本（本轮新增）

`ChannelModelPricing.PurchasePricing` 独立保存 `ChannelPurchaseCost`：

```json
{"pricing": {...ChannelInternalPricing...}, "verified": true,
 "source": "...", "note": "...", "updated_at": 0}
```

- 与官方价、渠道报价、销售价完全分开存储；同步不会覆盖。
- 手工录入入口：渠道模型定价编辑弹窗的 “Contract purchase cost”。
- `verified=true` 只能在合同/账单确认后勾选。
- `ChannelBillingPricing.PurchaseUSD` 优先使用合同成本，并记录
  `PurchaseVerified` / `PurchaseSource` 到账单 admin 字段。
- 批量毛利：有合同成本时以其比较；未验证时 `MarginVerified=false`。

## 4. 未实现/外部受限

- **实际结算成本（EFFECTIVE_PURCHASE_COST）**：需要供应商账单导入与对账
  （Phase 8），当前未建。
- **估算价（ESTIMATED_PRICE）**：仅通过 `NeedsReview`/审核原因表达，无独立类型。
- 汇率历史版本：只保存当前汇率与来源/时间，未保存历史序列。
- 合同成本批量导入/CSV：当前仅单模型录入。

没有已验证合同成本时，毛利只能标记为“基于上游报价的估算”；只有
`PurchaseVerified=true` 的比较才可标为已验证成本毛利；实际结算毛利仍需账单。

## 4. 验证

```bash
go test ./service/ -run TestGenericChannelPricingRecordsClassifyPriceSources -count=1
go test ./service/ -run TestResolveBatchBasePriceRejectsChannelRatioAsOfficial -count=1
```

两条测试均通过（见 PHASE-11）。