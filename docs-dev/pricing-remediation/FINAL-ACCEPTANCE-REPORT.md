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
- 任务价格合同改为“任务持久化成功后”写入：失败的重试尝试不再占用快照唯一键，
  快照使用成功尝试的渠道身份与真实 task_id；结算按提交时固化的 `BillingContext`
  计价，并在 `TaskBillingContext` 中保存 `billing_model_name`，保证计价别名下仍能匹配。
- Apiko 定时同步补齐指数退避（1m→1h 封顶）与官方输入价变更检测；启用价格计划时，
  超过阈值的变更写入 `channel_pricing_reviews`，进入人工审批而不是直接采用。
- 价格审阅升级为状态机：`pending → approved / rejected`，记录审批人、备注与决策时间；
  已决记录保留为审计历史，后续同步只替换新的 pending 条目。审阅产生时向开启渠道通知
  的管理员发送提醒；审批成功后才应用计划规则，拒绝不改变价格。
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

## 1.2 2026-11-22 复核整改（P0/P1 第二轮）

基于 `39ca163a3` 的工作区改动（本轮未提交），针对复核的 P0/P1 项完成：

- **P0-01 异步任务价格漂移**：`RecalculateTaskQuotaByTokens` 只使用提交时
  `TaskBillingContext` 的 `ModelRatio`/`GroupRatio`/`OtherRatios`/`PerCallBilling`，
  不再读取当前渠道价、模型倍率、用户组或月消费。结算期间修改倍率/分组/渠道价
  不影响最终费用；缺快照的历史任务保持预扣额度并告警。
- **P0-02 快照终态不可逆**：`UpdateBillingPriceSnapshotSettlement` 改为带来源状态
  集合的条件更新（CAS）：`pending → settled/refunded/settle_failed`；
  `settled`/`refunded` 不可再被自动改写；同状态重复回调仅金额一致时幂等；
  并发回调只有一个能成功。失败任务凭证由退款路径收口为 `refunded`。
- **P0-03 逐维采购成本与独立财务账本**：新增 `billing_cost_breakdowns`
  （维度/档位/数量/单位/单价/金额/币种/汇率/来源/验证状态/问题码）与
  `billing_financial_ledgers`（sale / refund / purchase_cost / supplier_invoice），
  Quota 与货币金额分离；`SummarizeBillingFinancials` 区分已验证毛利与待核对毛利。
  快照冻结 `purchase_contract`/`hash` 与 `quota_per_unit`。
- **P1-01 批量版本身份**：调用方提交模型名版本键且同名模型存在多个
  身份时拒绝回退，返回完整身份键并要求重跑预览；未提交版本键的旧调用保持兼容；
  版本冲突信息返回完整身份。
- **P1-03 同步一致性**：Apiko 价格同步/目录同步使用 `system_task_locks`
  跨实例锁（同渠道互斥）；后台任务遇到锁占用不计失败、不进退避。
  已批准/已拒绝的相同价格变化不再重复进入待审队列。
- **P1-04 显式零价**：目录中存在的 0 价字段视为真实免费模型并生成零价表达式；
  字段缺失才判定为未定价。
- **P1-05 非 USD 发票**：缺少 `fx_rate` 的非 USD 发票直接拒绝；有汇率时逐行换算后
  对账，`original_total`/`currency`/`fx_rate` 与换算金额分别留痕，并写供应商账单流水。
- **P1-03(3) 审批版本绑定**：审核条目记录生成时的 `provider/region/deployment` 与
  `pricing_version`；审批前校验当前价格行版本未变化，变化则拒绝并要求重新同步审核。
  跨实例锁新增互斥/过期回收测试；Apiko 拉取失败时同步状态记录错误且不伪造成功时间。
- **P1-07 历史汇率**：新增 `billing_exchange_rates`（币种对、生效时间、汇率、来源、版本），
  发票导入优先使用显式汇率，其次使用已登记的历史汇率；两者都没有时拒绝导入。
  显式汇率会写入历史表，发票保存 `fx_source`/`fx_version`。
- **P1-06 多模态用量回放**：新增混合请求回放测试（文本 + 图片 + 图片缓存 + 音频输入/输出
  + 思考 tokens 同一请求），逐维断言归一化结果与最终额度；`rt` 仅作为思考价选择器，
  生成表达式为 `c * (rt > 0 ? 思考价 : 普通价)`，不会重复计费。按张计费覆盖默认 1 张、
  指定数量与非法数量拒绝。仍无真实上游供应商账单回放。
- **P1-04 同步状态分离**：新增 `channel_sync_states`，按渠道 + `models`/`prices`
  分别记录最近尝试时间、最近成功时间、错误、抓取/写入/跳过/下架数量与有界变更摘要
  （新增/下架模型、价格变动）。目录同步成功而价格同步失败时，两条状态独立可见。
  已接入 Apiko、DreamRouter、百炼；新增 `GET /api/channel/:id/sync_states`。
- **P1-05 账单行逐行匹配**：发票行可携带 `request_id`/`billing_line_id`。带请求号的行
  直接匹配不可变凭证与冻结的逐维采购成本，不再按当前目录价重估；用量与凭证不一致、
  渠道不符、无凭证、无成本分别返回 `MISMATCHED`/`NO_REQUEST`/`NO_COST` 进入人工核对。
  未携带请求号的行仍走原有模型级估算。
- **P1-02 逐档毛利边界**：新增三档回放（0–32K 33%、32K–128K 9.1%、128K–256K -14.3%，
  最低 10%）：第二、第三档均标记 `below_min_margin` 并阻止整批写入；采购成本齐全时
  `cost_verified=true`，区分“毛利不达标”与“成本缺失”。
- **审批与同步关联**：审核条目保存 `sync_started_at`，与 `channel_sync_states.last_started_at`
  对应，并保留 `pricing_version` 供审批前版本校验。
- **上游分组采购成本**：New API 兼容渠道（如 xxapi）可选择上游分组
  （`GET/PUT /api/channel/:id/upstream_billing_group`）；同步时把该渠道的
  `group_ratio` 冻结进表达式采购合同 `(<billing_expr>) * <ratio>`，标记未验证，
  成本按真实用量求值，毛利保持 `pending_purchase` 直到运营确认。
- **真实 HTTP 计费闭环（隔离实例 + 本地 mock 上游）**：四类场景全部打通——
  Token 请求 `p*1+c*2`、1000/500 tokens → 1000 quota / $0.002；图片请求 `n=2`、
  `fixed(0.04)*image_count` → 40000 quota / $0.08；同一模型 VIP0 与 VIP2
  分别扣 1000 / 800；Sora 任务插件（`task_plugin_key=sora`）提交 `/v1/videos`
  后轮询完成，按 `duration*1` 每秒计价 → 预扣与结算均为 1,600,000 quota / $3.2。
  四类场景的计费快照均 `settled`，财务流水销售金额与额度一致。
- **四类渠道同步矩阵**：DreamRouter/百炼/Apiko/xxapi 统一矩阵测试覆盖
  「模型信息 → 价格 → 计费表达式可执行」；实拉验证 86/275/71/51 个模型，
  表达式 0 编译失败。矩阵同时发现并修复百炼 `per_1k_tokens` 无法生成渠道价的问题。
- **纯倍率异步任务凭证**：任务即使没有渠道合同或表达式，也冻结当时的倍率组合
  （`mode=ratio`/`fixed_price`，含模型/输出/缓存/图片/音频倍率与组倍率）；零价插件任务
  不写无意义凭证。成功任务在零差额、按次计费、无 adaptor 三种路径下都会把凭证收口为
  `settled`；无扣费失败收口为 `refunded`。销售/退款金额进入财务流水，采购成本未知时
  毛利保持 `pending_purchase`。同步请求仍不写凭证，避免写放大。

本轮的验证证据（命令与结果）：

```bash
go build ./...                                  # 通过
go vet ./model/ ./service/ ./relay/...          # 通过
gofmt -l <本轮改动文件>                          # 无输出
go test ./model/ -count=1                       # ok
go test ./controller/ -count=1                  # ok
go test ./service/ -count=1                     # FAIL: TestUpstreamHTTPClientBlocksMetadataAddress
```

`TestUpstreamHTTPClientBlocksMetadataAddress` 在 `git archive HEAD` 的干净快照中同样失败
（本机无 169.254.169.254 路由，返回超时而非 `blocked address`），为存量环境相关失败。

本轮仍未验证：MySQL/PostgreSQL 的建表与升级（本机 docker 不可用，新表仅 SQLite 实测）、
真实 HTTP 端到端闭环、登录后浏览器回归、历史汇率序列表。

## 2. 验收清单

| 验收项目 | 状态 | 证据/限制 |
|---|---|---|
| 模型目录 | PARTIALLY_VERIFIED | DreamRouter/百炼/Apiko/New API 有同步代码与测试；无真实接口调用 |
| 官方价格 | PARTIALLY_VERIFIED | 分类与单位保护已实现；云厂商无自动来源 |
| 折扣价格 | IMPLEMENTED_NOT_VERIFIED | DreamRouter 按折扣组反推；真实折扣组未在线复验 |
| 采购成本 | PARTIALLY_VERIFIED | 合同成本可手工录入、隔离存储、标记 verified；已按请求逐维落成本明细与账本条目；仍无供应商账单级实际成本 |
| 渠道隔离 | IMPLEMENTED_AND_VERIFIED | 唯一键 + 隔离测试 |
| 供应商隔离 | IMPLEMENTED_AND_VERIFIED | provider 进入身份 |
| 区域隔离 | IMPLEMENTED_AND_VERIFIED | region 进入身份 + 测试 |
| 部署隔离 | IMPLEMENTED_AND_VERIFIED | deployment 进入身份、任务计费、账单 |
| 价格维度 | IMPLEMENTED_AND_VERIFIED | 17 个维度贯通批量/表达式/前端列表 |
| 批量定价 | PARTIALLY_VERIFIED | 维度补齐；供应商/区域/部署筛选已实现；多身份模型禁止模型名版本回退；真实数据验收未完成 |
| 毛利保护 | PARTIALLY_VERIFIED | 逐维/逐档检查；三档边界（含 9.1%/-14.3%）回放阻止写入；合同成本 verified 时可标为已验证；缺价维度标 `purchase_missing` |
| 自动同步 | PARTIALLY_VERIFIED | 四类任务 + 计划 + 指数退避 + 价格审批 + 管理员通知 + 跨实例锁；模型/价格同步状态按渠道分别入库并可查询；无真实长周期验证 |
| 价格保护 | IMPLEMENTED_AND_VERIFIED | 人工价不被同步覆盖；official basis 拒绝渠道倍率 |
| 计费引擎 | PARTIALLY_VERIFIED | 预扣/结算/任务/退款共用解析；不可变快照表已建 |
| 多模态计费 | PARTIALLY_VERIFIED | 表达式支持 img/rt/ai/ao；混合多模态归一化与按张计费边界已回放；无真实上游账单回放与视频帧数维度 |
| 历史账单 | IMPLEMENTED_NOT_FULLY_VERIFIED | 新增 `billing_price_snapshots` 不可变表 + 查询接口 |
| 多币种 | PARTIALLY_VERIFIED | 非 USD 发票必须提供或登记汇率，原始金额/币种/汇率与 USD 金额分别留痕；已有历史汇率表（按币种对+生效时间+版本），尚无自动汇率源与维护界面 |
| 财务对账 | PARTIALLY_VERIFIED | 表达式一致性、用量样本对账、发票 JSON 导入、逐维采购成本与财务流水已实现；账单行可按 request_id 匹配凭证与成本；自动账单导出 BLOCKED |
| 前端 | PARTIALLY_VERIFIED | typecheck/lint/design + 3204 条测试通过；登录后浏览器回归未执行 |
| 数据库 | IMPLEMENTED_NOT_FULLY_VERIFIED | SQLite 旧库升级两次 PASS；MySQL 8.0/PostgreSQL 16 建表 PASS；三库旧库升级未验证；2026-11-22 新增的成本/账本表仅 SQLite 实测 |
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
8. ~~批量按模型能力筛选；阶梯逐档不同规则；同步退避重试、价格变更通知、审批队列状态机。~~
   以上已于 2026-11-21/22 实现。审批会校验审核版本未变化，但审批本身仍应用“当前”
   计划规则而不是回写审核时的候选价；审批条目通过 sync_started_at 与同步状态行关联。
9. 登录后的浏览器人工回归（公开定价页被登录守卫拦截，无测试账号）。

## 6. 剩余风险

- 本地数据库曾被未隔离测试清空；测试隔离仍需制度化。
- 公开报价 ≠ 合同成本，任何毛利展示必须保留“估算”标识。
- 三库兼容未验证前，不得在生产使用 MySQL/PostgreSQL 的价格表迁移结论。
- 账单追溯不再只依赖 admin 日志：`billing_price_snapshots` 独立保存合同与结算额度，
  但历史数据尚未回填，日志清理前仍需完成快照回填核对。