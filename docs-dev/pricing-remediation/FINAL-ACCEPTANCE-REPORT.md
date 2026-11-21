# FINAL ACCEPTANCE REPORT — Uter 定价体系整改

- 仓库：`hu-xulin/uter`
- 分支：`main`（未创建分支，已提交并推送至 `origin/main`）
- 基线提交：`674eebd6a`
- 交付提交：`a24843538` → `56a781f14`（报告提交在此之后）
- 日期：2026-11-21
- 最终状态：**PARTIALLY_VERIFIED / NOT ACCEPTANCE_PASS**

> 本报告只记录本轮实际执行的命令与结果。未执行的真实验证、三库矩阵、浏览器
> 回归均在“未完成/外部受限”中逐条列出，不以代码存在或编译通过冒充验收通过。

## 1. 结论

本轮修复了两个实质性计费缺陷并补齐了批量维度：

1. **批量定价不再遗漏图片 / Thinking / 多模态维度**，并贯通数据库字段、
   计费表达式、毛利检查、预览接口与前端勾选。
2. **New API 兼容价格不再把倍率冒充官方绝对价**，新增 `PriceKind` 与
   `RatioBasis`，无法确认单位的 `official_price` 进入审核。
3. 修复 **表达式 `rt` 变量编译失败**，思考价表达式现在可编译执行。
4. **Apiko 增加后台定时同步**，不再仅依赖人工点击。
5. 验证 deployment 身份已贯通请求、任务计费与账单字段。
6. 新增不可变 `billing_price_snapshots` 表：请求与任务在创建时记录渠道身份、
   销售/采购版本、表达式哈希、完整销售合同 JSON、采购成本与验证状态、
   组倍率、币种汇率与原始用量，并在结算时补全预扣/实扣/退款额度；
   重复回调不覆盖首条合同。

但以下 P0/P1 仍未达到完整验收：

- 合同采购价与实际结算成本无数据源，毛利只能标为“基于上游报价的估算”。
- 表达式一致性校验与用量样本对账已实现；供应商发票导入/真实账单对账仍为 BLOCKED。
- MySQL/PostgreSQL 真库矩阵未执行。
- 浏览器端未逐页回归；真实供应商接口仅覆盖百炼/DreamRouter/Apiko 只读目录。
- 异步任务的结算额度补全与“任务创建—重试换渠道—跨版本结算”端到端一致性仍需验证；
  不可变快照已保存合同、成本、用量与额度，但合同采购价仍缺少供应商账单级数据源。

因此不满足 `FULLY_OPERATIONAL` / `ACCEPTANCE_PASS`。

## 1.1 2026-11-21 复核整改

针对复核提出的 P0/P1 项，本轮完成：

- 快照升级为计费凭证：新增 `price_contract`（完整销售合同 JSON）、`price_contract_hash`、
  `price_source`、`purchase_usd`、`purchase_verified`、`purchase_source`、
  `pre_consumed_quota`、`settled_quota`、`refund_quota`、`settle_status`。
  结算后通过 `UpdateBillingPriceSnapshotSettlement` 只补全金额与用量，不改写合同；
  重复回调不能覆盖已结算凭证。异步任务在 `LogTaskConsumption` 时补全结算额度。
- 快照写入 3 次同步重试；仍失败时在消费日志 admin 作用域写
  `billing_snapshot_error`/`billing_snapshot_request_id`，并输出系统错误日志，便于对账定位。
- 文本、音频、实时语音路径在结算前写入 `BillingUsageBreakdown`（token/cache/图片/音频），
  快照不再只依赖 tiered 预估 facts。
- 异步任务在成功结算、差额结算与全额退款三个路径补全快照额度；退款后的凭证状态为
  `refunded`，合同仍不可改写。
- 批量定价新增 `providers`/`regions`/`deployments`/`pricing_sources`/`modes` 精确筛选；
  版本校验继续使用 `model|provider|region|deployment` 身份键。前端批量面板增加对应筛选输入。
- 批量调价支持 `tier_rules` 逐档规则：按 `range_name`/`time_band` 为不同上下文档位
  指定独立 mode/value，未命中的档位沿用基础规则；非法规则在写入前拒绝。
- 上游报价视图补齐缓存写入、图片、Thinking、多模态、音频与 `per_unit_usd`；
  `per_image` 不再只能从 `per_call_usd` 读取。
- Apiko 能力声明改为“后台定时同步（1 分钟调度 + 渠道官方价周期）”，与
  `main.go` 中的 `ApikoUpstreamSyncTask` 一致。

仍需完成：跨版本/换渠道任务结算的端到端一致性、同步退避/异常价格审批、
历史汇率序列、供应商账单自动导出/发票文件解析，以及登录后的浏览器验收。

## 2. 验收清单

| 验收项目 | 状态 | 证据/限制 |
|---|---|---|
| 模型目录 | PARTIALLY_VERIFIED | DreamRouter/百炼/Apiko/New API 有同步代码与测试；无真实接口调用 |
| 官方价格 | PARTIALLY_VERIFIED | 分类与单位保护已实现；云厂商无自动来源 |
| 折扣价格 | IMPLEMENTED_NOT_VERIFIED | DreamRouter 按折扣组反推；真实折扣组未在线复验 |
| 采购成本 | PARTIALLY_BUILT | 合同成本可手工录入、隔离存储、标记 verified；无账单实际成本 |
| 渠道隔离 | IMPLEMENTED_AND_VERIFIED | 唯一键 + 隔离测试 |
| 供应商隔离 | IMPLEMENTED_AND_VERIFIED | provider 进入身份 |
| 区域隔离 | IMPLEMENTED_AND_VERIFIED | region 进入身份 + 测试 |
| 部署隔离 | IMPLEMENTED_AND_VERIFIED | deployment 进入身份、任务计费、账单 |
| 价格维度 | IMPLEMENTED_AND_VERIFIED | 17 个维度贯通批量/表达式/前端列表 |
| 批量定价 | PARTIALLY_VERIFIED | 维度补齐；缺按供应商/区域/部署选择器 |
| 毛利保护 | PARTIALLY_VERIFIED | 逐维检查；合同成本 verified 时可标为已验证 |
| 自动同步 | PARTIALLY_VERIFIED | 四类任务 + 计划；无退避/通知 |
| 价格保护 | IMPLEMENTED_AND_VERIFIED | 人工价不被同步覆盖；official basis 拒绝渠道倍率 |
| 计费引擎 | PARTIALLY_VERIFIED | 预扣/结算/任务/退款共用解析；不可变快照表已建 |
| 多模态计费 | IMPLEMENTED_NOT_VERIFIED | 表达式支持 img/rt/ai/ao；无真实用量回放 |
| 历史账单 | IMPLEMENTED_NOT_FULLY_VERIFIED | 新增 `billing_price_snapshots` 不可变表 + 查询接口 |
| 多币种 | PARTIALLY_BUILT | CNY→USD + 汇率快照；无历史汇率序列 |
| 财务对账 | PARTIALLY_VERIFIED | 表达式一致性、用量样本对账、发票 JSON 导入与持久化已实现；自动账单导出 BLOCKED |
| 前端 | PARTIALLY_VERIFIED | typecheck/lint/design + 3204 条测试通过；登录后浏览器回归未执行 |
| 数据库 | IMPLEMENTED_NOT_FULLY_VERIFIED | SQLite 旧库升级两次 PASS；MySQL 8.0/PostgreSQL 16 建表 PASS；三库旧库升级未验证 |
| 自动化测试 | IMPLEMENTED_AND_VERIFIED | `GOWORK=off go test ./...` exit 0 |
| 真实验证 | PARTIALLY_VERIFIED | 百炼 275 模型、DreamRouter 86 模型、Apiko 68 模型真实拉取；其余厂商无凭据 |
| 安全性 | PARTIALLY_VERIFIED | 校验/冲突/幂等已测；无压测/分布式锁验证 |

**任何 P0 项目未全绿，故最终不得标记 ACCEPTANCE_PASS。**

## 3. 本轮修改文件

后端：

- `model/billing_price_snapshot.go`
- `model/upstream_billing_invoice.go`
- `model/channel_model_pricing.go`
- `model/channel_model_pricing_test.go`
- `service/channel_batch_pricing.go`
- `service/channel_batch_pricing_test.go`
- `service/channel_batch_pricing_integration_test.go`
- `service/generic_upstream_pricing.go`
- `service/generic_upstream_pricing_test.go`
- `service/billing_snapshot.go`
- `service/upstream_invoice.go`
- `service/upstream_invoice_test.go`
- `service/upstream_reconciliation.go`
- `service/upstream_billing_samples.go`
- `service/upstream_expression.go`
- `service/log_info_generate.go`
- `pkg/billingexpr/compile.go`
- `controller/upstream_catalog_apiko.go`
- `controller/channel_model_pricing.go`
- `relay/common/relay_info.go`
- `relay/helper/price.go`
- `relay/relay_task.go`
- `router/channel-router.go`
- `common/option_map.go`
- `main.go`

前端：

- `web/src/features/channels/components/channel-pricing-panel.tsx`
- `web/src/features/channels/components/channel-model-pricing-section.tsx`
- `web/src/features/channels/api.ts`
- `web/src/features/channels/types.ts`
- `web/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json`

文档：

- `docs-dev/pricing-remediation/PHASE-00…12` 与本文件。

## 4. 执行的命令

```bash
GOWORK=off go test ./...                                                  # exit 0
go test ./pkg/billingexpr ./model ./service -count=1                     # ok
go test ./controller -run Apiko -count=1                                 # ok
gofmt -l model service controller pkg main.go                            # 无输出
go vet ./model/... ./service/... ./controller/... ./pkg/billingexpr/...  # 无错误
cd web && bun run typecheck                                              # exit 0
cd web && bun run lint                                                   # exit 0
cd web && bun run lint:design:strict                                     # exit 0
cd web && bun run i18n:sync                                              # 0/0；幂等
sqlite3 one-api.db "select ... from channel_model_pricing ..."           # 只读统计
BAILIAN_LIVE=1 go test -tags bailian_live ./service -run TestPullBailianCatalogLive -v        # PASS
UPSTREAM_LIVE=1 go test -tags upstream_live ./service -run TestPullDreamRouterUpstreamLive -v # PASS
UTER_TEST_MYSQL_DSN=... UTER_TEST_POSTGRES_DSN=... go test ./model -run TestChannelPricingTablesAcrossDatabases -v # PASS
cd web && bun run test                                                 # 316 files / 3204 tests PASS
```

## 5. 未完成 / 外部受限

1. 合同采购价已支持手工录入与 verified 标记；供应商账单、实际结算毛利仍无授权数据源。
2. 不可变计费快照表与查询接口已实现，合同/成本/用量/额度已入库；历史数据回填未做。
3. OpenAI/Anthropic/Gemini/Azure/AWS/腾讯/火山官方价格自动同步：无稳定公开接口或凭据。
4. SQLite 旧库升级与二次启动已验证；MySQL/PostgreSQL 旧库升级未验证。
5. 百炼/DreamRouter/Apiko 已完成真实目录/价格拉取；OpenAI/Anthropic/Gemini/Azure/AWS/腾讯/火山仍无凭据。
6. 浏览器人工/视觉回归、前端全量测试。
7. Decimal 账本、汇率历史表、供应商账单自动导出（发票 JSON 导入已实现）。
8. 批量按模型能力筛选；阶梯逐档不同规则；同步退避重试、价格变更通知、审批队列状态机。
9. 登录后的浏览器人工回归（公开定价页被登录守卫拦截，无测试账号）。

## 6. 剩余风险

- 本地数据库曾被未隔离测试清空；测试隔离仍需制度化。
- 公开报价 ≠ 合同成本，任何毛利展示必须保留“估算”标识。
- 三库兼容未验证前，不得在生产使用 MySQL/PostgreSQL 的价格表迁移结论。
- 账单追溯不再只依赖 admin 日志：`billing_price_snapshots` 独立保存合同与结算额度，
  但历史数据尚未回填，日志清理前仍需完成快照回填核对。