# PHASE 07 — 统一计费引擎与价格快照

状态：**PARTIALLY_VERIFIED**
（预扣/结算/任务/退款使用同一价格解析与配额安全函数，重复结算有幂等键；
本轮新增独立不可变 `billing_price_snapshots` 表）

## 1. 价格解析入口

`model.ResolveEffectiveChannelPricingFor(identity)` 是唯一决策点，返回：

```go
ChannelBillingPricing{
  Mode, ModelRatio, CompletionRatio, CacheRatio, CreateCacheRatio,
  AudioRatio, AudioCompletionRatio, ModelPrice, BillingExpr,
  UsePrice, UsePerSecond, PerSecondPrice,
  Version, Source, PurchaseUSD, Currency, FXRate,
}
```

- 正常 token 请求：`relay/helper/price.go:182` 起。
- 渠道阶梯表达式：`:224` 走 `modelPriceHelperChannelTiered`。
- 任务按秒/按次/阶梯：`relay/relay_task.go` 三个任务分支均先解析渠道价，
  再写 `ChannelPricingVersion/Deployment/PurchaseUSD`。
- 音频：`service/quota.go` 优先使用渠道 `AudioRatio/AudioCompletionRatio`。
- 表达式变量：`p/c/len/cr/cc/cc1h/cc12h/img/img_cr/img_o/ai/ao/rt`；
  `rt` 本轮补入编译原型。

## 2. 配额与金额安全

- 转换统一走 `common.QuotaFromFloatStrict` / `QuotaRoundStrict` /
  `QuotaFromDecimal*`，禁止裸 `int(float64)`。
- 饱和事件通过 `*Checked` 变体返回 `QuotaClamp`，并在日志中
  `admin_info.quota_saturation` 审计。
- 表达式结算：`billingexpr.QuotaRoundStrict`；档位/单位/固定价有 trace。

## 3. 幂等与退款

`service/task_billing.go`：

- 结算与退款都有 `TaskBillingIdempotencyKey(taskID, operation, quota)`。
- 原子 claim：`WHERE status = ...` CAS；重复回调/重试跳过，不重复动账。
- 已结算账单不会因后续价格修改而改变：结算参数来自任务创建时的快照/任务记录。

## 4. 快照能力现状

`pkg/billingexpr.BillingSnapshot`（`:73`）保存：

- billing_mode、model_name、expr_string、expr_hash、expr_version
- group_ratio、估算 quota、tier、billing unit、fixed price
- `TaskUsageBilling`、`UsageFacts`（任务实际用量）

`service/log_info_generate.go:79` 额外记录：

- `channel_pricing_version/mode/provider/region/deployment`
- 渠道 ratio、model price、purchase_usd、currency、fx_rate
- `billing_expr_version/hash`

## 5. 不可变价格快照表（本轮新增）

`model/billing_price_snapshot.go` + AutoMigrate：

- 表 `billing_price_snapshots`，唯一键
  `(request_id, task_id, model_name)`，重复写入忽略，首条即权威。
- 字段：channel/provider/region/deployment、sale `pricing_version`、
  purchase `purchase_version`、billing mode/expression/hash、group ratio、
  user pricing ratio、currency、FX、usage facts、created_at。
- 请求路径在日志生成时写入；异步任务在创建定价后立即写入，结算不会覆盖。
- 管理查询：`GET /api/channel/:id/billing_snapshots?limit=100`。

## 6. 未实现/风险

- official/purchase/sale 三个版本中，official 与 sale 共用行级 `pricing_version`
  （该哈希已包含官方与销售负载）；没有单独拆成三列。
- `billing_price_snapshots` 在 MySQL/PostgreSQL 上的建表由三库矩阵覆盖，
  但历史数据回填未实现。
- 未引入 Decimal 金额账本；当前是 int 配额 + 受检浮点转换。
- 流式真实用量、缓存、Thinking、图片、音频、视频的任务级回归只覆盖现有
  单测/集成测试，缺少全部供应商的真实响应重放。
- 管理员改价不会影响已发生请求，但无法从专用快照表一键还原整笔计算过程。

## 7. 验证

```bash
GOWORK=off go test ./relay/... ./service/... ./pkg/billingexpr/... -count=1
GOWORK=off go test ./...     # exit 0
```

未执行真实供应商流式/异步任务的端到端财务对账。