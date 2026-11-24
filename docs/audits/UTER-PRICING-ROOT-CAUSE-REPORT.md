# Uter 定价系统根因分析报告（当前 HEAD 实测）

基线：`8c1e9139c`，核验时间 2026-11-24。所有“确认”均来自当前代码实读与测试复现，不沿用历史审计结论。

## P0-1 确认：渠道创建成功不等于价格配置成功

- 文件与函数：`controller/channel_uterapi.go` → `CreateUterAPIChannels`
- 原行为（行号以修改前代码为准）：`status` 默认 `common.ChannelStatusEnabled`（73–76）；渠道以启用状态写入（100–104）；随后才同步价格（138）；同步失败仅写 `pricing_error`（152–154），接口仍返回成功（167）。
- 附加放大因素：`Channel.Status` 的 GORM 默认值为 1，零值插入会被数据库改回启用。
- 根因：创建、价格同步、价格验证、启用四个动作没有状态机约束，启用发生在验证之前。
- 修复：渠道一律先落库为禁用并显式写回 `status=0`；同步后逐模型调用 `ResolveEffectiveChannelPricing` 验证可计费；全部通过才启用并升级定价模式为 `CHANNEL_SCOPED_ACTIVE`，失败保持禁用 + `CHANNEL_SCOPED_PENDING` 并返回 `pricing_error`。
- 证据：`TestCreateUterAPIChannelsKeepsChannelDisabledWhenPricingFails`、`TestCreateUterAPIChannelsCreatesOneChannelPerSlot`。

## P0-2 确认：Uter.api 分组靠模型名称推断

- 文件与函数：`service/generic_upstream_pricing.go` → `FilterModelNamesByUpstreamGroup`
- 原行为：组名以 `claude`/`codex`/`gpt` 前缀推断模型族，再按名称包含关系过滤；无法匹配时反而保留全部模型。
- 根因：把展示用名称模式当成授权事实；`GenericPricingEntry.EnableGroups` 等身份字段未被使用。
- 修复：新增 `service.AuthorizedUterAPIModels`，以每个 Key 实际可见模型 ∩ `/api/pricing` 中 `enable_groups` 包含所选分组的模型为准；没有分组元数据的模型被排除（fail-closed），不再使用名称推断。多 Key 渠道改为取各 Key 模型目录交集，避免轮询到无权调用的模型。
- 证据：`TestAuthorizedUterAPIModelsUsesEnableGroups`、`TestAuthorizedUterAPIModelsFailsClosedWithoutGroupMetadata`。

## P0-4 确认：草稿发布只遍历已有价格行

- 文件与函数：`controller/channel_draft.go` → `draftPublishBlockers`
- 原行为：遍历价格表，仅检查“已存在行是否 configured”；价格行为空时循环不执行，发布通过。
- 根因：校验基准选错——应以 `channel.GetModels()` 选中的模型为基准，而不是以价格表行为基准。
- 修复：改为以选中模型为准的差集校验；缺行 `PRICE_MISSING`、重复身份 `PRICE_IDENTITY_AMBIGUOUS`、状态非 configured、销售价为空、表达式不可执行、版本缺失均阻止发布；发布成功后才把模式升级为 `CHANNEL_SCOPED_ACTIVE`。
- 证据：`TestDraftPublishBlockersRejectMissingSelectedPrice`、`RejectPartialPricing`、`RejectDuplicateIdentity`、`RejectEmptySalePriceAndVersion` 及原有发布 blocker 测试。

## P0-5 确认：价格隔离依赖价格行是否存在

- 文件与函数：`model/channel_model_pricing.go` → `ChannelUsesScopedPricing`
- 原行为：用 `COUNT(channel_id)` 是否有行决定是否隔离；无行即允许回退全局价。
- 根因：把“尚未同步成功”解释为“允许使用旧价格”。
- 修复：在 `relaykit/dto.ChannelOtherSettings` 增加显式 `pricing_mode`，定义 `GLOBAL_LEGACY` / `CHANNEL_SCOPED_PENDING` / `CHANNEL_SCOPED_ACTIVE`；新增 `model.ChannelScopedPricingRequired`，显式模式压过行数推断；Token、按次、任务三条计费入口改走新门禁。未打标签的旧渠道保留历史行为，不影响存量业务。
- 证据：`TestChannelScopedPricingRequiredHonoursExplicitMode`。

## 尚未修复的审计项（如实标注）

| 编号 | 事项 | 状态 |
| --- | --- | --- |
| P0-3 | 百炼币种语义 | PARTIALLY_BUILT：已拆分 `source_currency` / `normalized_currency`，记录推断标记与汇率来源；未知币种或缺汇率进入 `needs_review`。上游无币种字段，来源仍为地域推断，完整币种证明需真实账单/文档 |
| P0-6 | `pricing_owner`（AUTO/OPERATOR/BATCH/APPROVED）显式所有权 | CODE_FIXED / TESTS_PASSED：`ChannelModelPricing.PricingOwner` 落库，写入路径赋值，覆盖规则改由所有权判定并保留 Source 审计；旧行与过期 owner 由 Source 兜底 |
| P1-1 | float64 → 精确十进制金额 | PARTIALLY_BUILT：财务账本/成本明细/账单快照的 PurchaseUSD 已改为 decimal-backed `model.Money` 结构；计算层统一 decimal。TopUp、Subscription、渠道价格 JSON 字段仍为 float64，全局迁移未做 |
| P1-2 | `GenericChannelPricingRecords` 固定写 `newapi-compatible` | CODE_FIXED / TESTS_PASSED：Provider ID 改由调用方传入，Uter.api 传 `uterapi`；旧身份行按渠道+模型身份接管，不产生双份价格 |
| P1-3 | Apiko 运行时/价格来源前缀/历史数据清理 | NOT_BUILT；需先备份并获授权 |
| 第十至十六部分 | 全量状态机、对账、真实验证、数据库迁移 | NOT_BUILT / BLOCKED |

### P0-3 / P1-2 修复证据

- `model/channel_model_pricing.go`：`ChannelOfficialPricing` 与 `ChannelPricingRawComponent` 增加 `source_currency`、`normalized_currency`、`currency_inferred`；`UpsertChannelOfficialPricing` 可接管旧 Provider 行。
- `service/bailian_provider.go`：百炼价格记录同时保存原始与标准化币种、汇率来源与推断标记；币种无法确认或 CNY 无有效汇率时 `needs_review=true`。
- `service/generic_upstream_pricing.go`：三个公开转换函数新增可选 Provider ID 参数，默认仍为 `newapi-compatible`。
- `service/uterapi_catalog.go`：Uter.api 价格行写入 `uterapi`。
- 测试：`TestBailianCurrencyProvenanceIsExplicit`、`TestBailianUnconfirmedCurrencyNeedsReview`、`TestGenericPricingProviderIdentityComesFromCaller`、`TestUpsertAdoptsStaleGenericProviderIdentity`。

### P0-6 修复证据

- `ChannelModelPricing.PricingOwner` 新增四态所有权；`PricingOwnerForSource` 保留 Source 作为审计信息。
- `pricingReplaceableByOwner` / `IsAutoDerivedPricingRowFor` 成为同步覆盖、审核清理、Provider 切换的统一判定；显式非 AUTO 所有权不可覆盖，AUTO 仍要求 Source 也表现为自动来源，避免原始 SQL 留下的过期 owner 把人工价误判为可覆盖。
- 人工、批量、审核写入路径均写入对应 owner；清空价格时一并清空 owner。
- 测试：`TestPricingOwnerMapping`、`TestPricingOwnerProtectsOperatorPriceFromSync`、`TestPricingOwnerRefreshesAutoAndKeepsApproved`、`TestStaleAutoOwnerDoesNotOverwriteManualPrice`。
- 回归：`GOWORK=off go test ./model/ ./controller/ ./service/ -count=1` 与 `GOWORK=off make test` 均退出码 0；前端定价测试 18 文件 / 309 用例通过。

### P1-1 修复证据

- `service/billing_financials.go`：采购成本逐维度金额、无合同时的单维估算、额度折 USD、表达式成本除以 1e6 与总成本累加统一走 `shopspring/decimal`，最终写回既有 float64 列。
- `model/billing_ledger.go`：`SummarizeBillingFinancials` 用 decimal 累加 Sale / Refund / Cost 并计算毛利，消除多次 float64 加法误差；NaN/Inf 按 0 处理，保持 fail-closed。
- 测试：`TestBillingFinancialSummaryUsesDecimalAccumulation`（0.1+0.2 精确为 0.3、退款与毛利）、`TestBillingFinancialsCostUsesDecimalForTokenPrices`（百万 token 单价乘算与累计）。
- 边界：计算层已全量 decimal；随后新增 `model.Money`（decimal-backed，JSON 数字、DB decimal 字符串）并把 `BillingCostBreakdown.UnitPriceUSD/AmountUSD`、`BillingFinancialLedger.AmountUSD/OriginalAmount`、`BillingFinancialSummary.*USD`、`BillingPriceSnapshot.PurchaseUSD` 升级为 Money。TopUp / Subscription / 渠道价格 JSON 字段仍为 float64，不能报全局完成。
