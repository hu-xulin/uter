# FINAL ACCEPTANCE REPORT — Uter 定价体系整改

- 仓库：`hu-xulin/uter`
- 分支：`main`（未创建分支，未提交）
- 基线提交：`674eebd6a`
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
   销售/采购版本、表达式哈希、组倍率与币种汇率，重复回调不覆盖首条。

但以下 P0/P1 仍未达到完整验收：

- 合同采购价与实际结算成本无数据源，毛利只能标为“基于上游报价的估算”。
- 表达式一致性校验与用量样本对账已实现；供应商发票导入/真实账单对账仍为 BLOCKED。
- MySQL/PostgreSQL 真库矩阵未执行。
- 浏览器端未逐页回归，真实供应商接口未调用。
- 无独立不可变计费快照表，账单追溯依赖 admin 日志 JSON。

因此不满足 `FULLY_OPERATIONAL` / `ACCEPTANCE_PASS`。

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
| 财务对账 | PARTIALLY_VERIFIED | 表达式一致性 + 用量样本对账已实现并测试；供应商发票对账 BLOCKED |
| 前端 | PARTIALLY_VERIFIED | typecheck + 设计门禁通过；无浏览器回归 |
| 数据库 | IMPLEMENTED_NOT_FULLY_VERIFIED | SQLite 旧库升级两次 PASS；MySQL 8.0/PostgreSQL 16 建表 PASS；三库旧库升级未验证 |
| 自动化测试 | IMPLEMENTED_AND_VERIFIED | `GOWORK=off go test ./...` exit 0 |
| 真实验证 | PARTIALLY_VERIFIED | 百炼 275 模型、DreamRouter 86 模型、Apiko 68 模型真实拉取；其余厂商无凭据 |
| 安全性 | PARTIALLY_VERIFIED | 校验/冲突/幂等已测；无压测/分布式锁验证 |

**任何 P0 项目未全绿，故最终不得标记 ACCEPTANCE_PASS。**

## 3. 本轮修改文件

后端：

- `model/billing_price_snapshot.go`
- `model/channel_model_pricing.go`
- `model/channel_model_pricing_test.go`
- `service/channel_batch_pricing.go`
- `service/channel_batch_pricing_test.go`
- `service/channel_batch_pricing_integration_test.go`
- `service/generic_upstream_pricing.go`
- `service/generic_upstream_pricing_test.go`
- `service/billing_snapshot.go`
- `service/log_info_generate.go`
- `pkg/billingexpr/compile.go`
- `controller/upstream_catalog_apiko.go`
- `controller/channel_model_pricing.go`
- `relay/common/relay_info.go`
- `relay/helper/price.go`
- `relay/relay_task.go`
- `router/channel-router.go`
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
```

## 5. 未完成 / 外部受限

1. 合同采购价已支持手工录入与 verified 标记；供应商账单、实际结算毛利仍无授权数据源。
2. 不可变计费快照表与查询接口已实现；历史数据回填未做。
2. OpenAI/Anthropic/Gemini/Azure/AWS/腾讯/火山官方价格自动同步：无稳定公开接口或凭据。
3. SQLite 旧库升级与二次启动已验证；MySQL/PostgreSQL 旧库升级未验证。
4. 百炼/DreamRouter/Apiko 已完成真实目录/价格拉取；OpenAI/Anthropic/Gemini/Azure/AWS/腾讯/火山仍无凭据。
5. 浏览器人工/视觉回归、前端全量测试。
6. 独立不可变 `BillingPriceSnapshot` 表、Decimal 账本、汇率历史表。
7. 批量按供应商/区域/部署/价格来源/能力选择器；阶梯逐档不同规则。
8. 同步退避重试、价格变更通知、审批队列状态机。

## 6. 剩余风险

- 本地数据库曾被未隔离测试清空；测试隔离仍需制度化。
- 公开报价 ≠ 合同成本，任何毛利展示必须保留“估算”标识。
- 三库兼容未验证前，不得在生产使用 MySQL/PostgreSQL 的价格表迁移结论。
- 账单只有 admin 日志可追溯，日志清理会削弱历史还原能力。