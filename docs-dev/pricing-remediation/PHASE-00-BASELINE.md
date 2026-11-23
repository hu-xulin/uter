# PHASE 00 — 基线与扫描结果

- 仓库：`hu-xulin/uter`
- 分支：`main`（未创建/切换分支）
- 基线提交：`674eebd6a`
- 执行日期：2026-11-21
- 数据库：本地 `one-api.db`（只读查询，未写入）

## 1. 当前价格数据流

```
上游供应商
  ├─ Uter Route  /api/pricing + 折扣组
  ├─ 阿里百炼     /api/v1/models（分页，CNY→USD）
  ├─ Apiko        /api/public/models?billing=all（USD）
  └─ New API 兼容 /api/pricing（ratio / 表达式）
        ↓
model.ChannelModelPricing
  ├─ OfficialPricing     上游原始负载（原样保存）
  ├─ NormalizedPricing   ChannelOfficialPricing：官方/渠道价、阶梯、折扣、审核原因
  └─ InternalPricing     ChannelInternalPricing：Uter 销售价
        ↓
model.ResolveEffectiveChannelPricingFor → ChannelBillingPricing
        ↓
relay/helper/price.go → 预扣 / 计费
relay/relay_task.go   → 任务结算
service/log_info_generate.go → 账单快照（admin 字段）
```

价格身份：`(channel_id, provider, region, deployment_id, model_name)`，唯一索引
`idx_channel_model_pricing_identity`（`model/channel_model_pricing.go`）。

## 2. 本轮扫描确认的缺陷（按优先级）

| 编号 | 缺陷 | 位置 | 本轮处理 |
|---|---|---|---|
| P0-1 | 批量调价维度只覆盖 input/output/cache/audio/per_*，图片、思考、多模态维度无法批量调价与逐维毛利检查 | `service/channel_batch_pricing.go:237` | 已修复：新增 8 个维度并贯通内部价、表达式、预览、毛利 |
| P0-2 | New API 兼容价格把 `model_ratio` 直接当官方绝对价；`official_price` 单位未确认却参与换算 | `service/generic_upstream_pricing.go:191` | 已修复：`PriceKind` + `RatioBasis`；单位未知进入 needs_review |
| P0-3 | 公开渠道报价与真实采购成本未显式分层 | `NormalizedPricing.ChannelPrice*`、`PurchaseUSD` | 已实现手工合同成本：独立 `purchase_pricing` 列 + 验证标记；账单实际成本仍无数据源 |
| P0-4 | 请求链路未传 deployment_id | `relay/helper/price.go:64` | 已验证已修复：deployment 进入身份并写入账单 admin 字段 |
| P0-5 | 计费快照字段不完整 | `pkg/billingexpr/types.go:73`、`service/log_info_generate.go:79` | 已实现：新增不可变 `billing_price_snapshots` 表，请求/任务共享创建时价格版本 |
| P0-6 | 表达式 `rt` 变量在编译期未注册，思考价表达式无法通过编译 | `pkg/billingexpr/compile.go:127` | 已修复：加入编译原型 |
| P1-1 | Apiko 价格同步仅手动触发 | `controller/upstream_catalog_apiko.go` | 已修复：新增按渠道计划的后台同步任务 |

## 3. 数据库现状（只读查询）

```sql
select channel_id, provider, count(*),
       sum(case when internal_pricing!='' then 1 else 0 end)
from channel_model_pricing group by channel_id, provider;
```

结果：

| channel_id | provider | 行数 | 有销售价 |
|---|---|---|---|
| 26 | uterroute | 84 | 0（渠道已删除，历史保留） |
| 31 | alibaba-bailian | 158 | 153 |
| 32 | uterroute | 84 | 84 |

销售价模式分布：

| channel | 模式 | 数量 |
|---|---|---|
| 31 | per_1m_token | 99 |
| 31 | per_call | 9 |
| 31 | tiered_expr | 45 |
| 32 | per_1m_token | 73 |
| 32 | per_call | 9 |
| 32 | per_second | 2 |

## 4. 测试基线（本轮实际执行）

| 命令 | 结果 |
|---|---|
| `GOWORK=off go test ./...` | exit 0 |
| `cd web && bun run typecheck` | exit 0 |
| `cd web && bun run lint:design:strict` | exit 0 |
| `gofmt -l model service controller pkg main.go` | 无输出 |
| `go vet ./model/... ./service/... ./controller/... ./pkg/billingexpr/...` | exit 0 |

补充执行：MySQL 8.0/PostgreSQL 16 建表矩阵 PASS；百炼/UterRoute/Apiko
真实价格拉取 PASS；未执行旧库升级与浏览器人工回归。

## 5. 风险

1. 本地 `one-api.db` 曾被未隔离测试进程清空过；再次运行测试前应确认测试使用
   内存库或隔离 DSN。
2. 合同采购价、供应商账单对账缺少可信数据源，当前毛利仅是“基于上游公开报价
   的估算”，不能标记为已验证实际毛利。
3. 未做 MySQL/PostgreSQL 真库验证前，价格表迁移不能声明三库兼容完成。