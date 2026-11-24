# Uter 价格体系生产级审计报告 — Uter Route 深度验证与整改

> 本报告由本次实际执行生成，所有结论均带工具证据。未执行的验证一律标记 `NOT_EXECUTED` / `BLOCKED`，不写成 PASS。

## A. 审计基线

| 项 | 值 |
| --- | --- |
| 仓库 | `/Users/lincolnhu/uter`（本地 main 工作区） |
| 价格代码审计 HEAD | `b63e9c20293c1e8cd053bffcad3a57f5080c0e5b`（审计开始时 HEAD） |
| 报告写成时 HEAD | `3fb493a83ab11ed5e24474f729053a131343401b`（并发会话后续两次提交：`3197c741` design-system 文档、`3fb493a83` channel 草稿修复，**均不含**本次价格代码变更） |
| 分支 | `main`（未创建/切换分支） |
| 审计时间 | 2026-11-24 23:10 – 23:57 GMT+8 |
| 审计开始时工作区 | `M VERSION`（保留未动） |
| 唯一审计依据 | 上述工作区实际代码；未引用历史审计报告作为当前实现证据 |

**并发会话说明**：执行期间另有会话提交了 `3197c741`（design-system 文档）与 `3fb493a83`（channel 草稿向导修复，5 文件）。这些均**非本次审计改动**，本次未触碰、未提交；价格整改全部留在本工作区未提交状态，便于逐项复核。每次提交前后均已用 `git show --stat HEAD` 核对，确认本次价格文件没有被并发会话一并提交。

### 本次修改文件（12 个，均为价格/测试代码）

`model/channel_model_pricing.go`、`model/channel_model_pricing_test.go`、`service/upstream_uterroute.go`、`service/upstream_uterroute_test.go`、`service/default_sale_markup.go`、`service/channel_pricing_audit.go`、`service/channel_pricing_audit_test.go`、`service/upstream_parity_test.go`、`service/uterapi_catalog.go`、`service/uterapi_catalog_test.go`、`relay/helper/price_test.go`、`relay/per_second_pricing_test.go`。

---

## B. 问题清单与整改

| ID | 级别 | 文件与函数 | 问题与证据 | 影响 | 修复 | 测试证据 |
| --- | --- | --- | --- | --- | --- | --- |
| P0-1 | P0 | `service/upstream_uterroute.go:uterRouteChannelExpressionPricing`、`service/default_sale_markup.go:applyDefaultSaleMarkup` | 含 `fixed()` 的混合表达式用 `scaled = ReplaceAllStringFunc(raw,...)` **覆盖**已整体缩放的表达式，token 档位完全未折扣。**实测**：`len<=100 ? tier("short", p*1) : tier("long", fixed(0.05))` 折扣 0.6 后 short 分支比率=1.0（应 0.6），long 分支=0.66。而整体乘 `(expr)*factor` 被引擎拒绝（fixed 规则），不是可行替代。 | 短上下文请求按未折扣价收费 → 多扣用户；金额与账单快照不一致 | 新增 `scaleBillingExprByFactor()`：逐项原地缩放 fixed 金额与 `<var>*n` 单价系数，跳过 `image_count` 数量乘数，用 `roundRatioValue` 消除浮点毛刺，并验证缩放后可编译。两处调用方统一改用该函数。 | 实测 4 类表达式各档位比率恒为预期；`TestUterRouteMixedFixedExpressionDiscountPreservesAllTerms` 通过 |
| P0-2 | P0 | `service/upstream_uterroute.go:UterRouteDiscountForModel` | 从模型多个 `enable_groups` 中无条件选最低正倍率。**实测/代码证据**：`{"default":{"claude":0.6,"claude-aws":0.9}}` 时选 0.6，但目录无证据证明 0.6 对应本渠道真实结算组。 | 选错结算组 → 采购成本与毛利全错 | 新增 `resolveUterRouteGroupRatio()`：任一渠道组下两个启用组倍率**不同**即返回不可判定（`ok=false`）→ 调用方标 `NO_UPSTREAM_DISCOUNT`/NEEDS_REVIEW；倍率相同则无歧义，并按组名字典序选身份，消除数组顺序依赖。另拒绝 0/负/NaN/Inf 倍率。 | `TestUterRouteMultipleEnableGroupsAmbiguous`、`TestUterRouteDiscountSelectionIgnoresEnableGroupOrder`、`TestUterRouteDiscountRejectsInvalidRatios` 通过 |
| P0-3 | P0 | `service/channel_pricing_audit.go:BuildUpstreamParityReport` | 倍率参考价（`RATIO_ONLY`/`DERIVED_FROM_RATIOS`）因自动生成了 ChannelPrice+InternalPricing，被报 `FULLY_MATCHED`，把采购成本未验证藏在成功计数里。 | 审计页给出虚假"完全匹配"，毛利数字不可信 | 新增 `PURCHASE_UNVERIFIED` 等状态；有售价但采购成本未 `Verified` 时一律不得 FULLY_MATCHED，`PurchaseUnverified` 计数与逐模型状态一致，并给出可追溯原因。 | `TestParityAuditDetectsPurchaseUnverified`、全部 parity 测试通过 |
| P0-4 | P0 | `service/channel_pricing_audit.go:BuildChannelPricingAudit` | 按"是否有价格行"判断 authority；运行时 `ChannelScopedPricingRequired()` 识别 PENDING/ACTIVE/GLOBAL_LEGACY，导致审计页显示 global 而运行时已阻断计费。 | 运营看到错误的定价来源 | 签名新增 pricingMode 参数，authority 改由 `ChannelScopedPricingRequired` 决定；PENDING 模式所有行不可计费；空价格表的 scoped 渠道给出显式告警。两处调用方读取 `channel.GetOtherSettings().PricingMode`。 | `TestPricingAuditRespectsExplicitPricingMode` 通过（三模式 + 空表场景） |
| P0-5 | P0 | `model/channel_model_pricing.go:UpsertChannelOfficialPricing` | 末级兼容匹配 `WHERE channel_id+region+deployment+model_name`（不带 provider）用 `First()`，多个候选身份时任意合并一条。 | 两个价格身份被合并，跨渠道/跨 Provider 串价 | 改为 `Find()` 取全部候选：0 条→未找到；1 条→采纳；>1 条→返回 `ambiguous channel pricing identity` 错误 fail-closed。 | `TestProviderIdentityMigrationDetectsConflict` 通过 |
| P0-6 | P0 | `service/uterapi_catalog.go:applyGroupRatioToRecord` | 渠道折扣报价（ChannelPrice）用**含 Uter markup 的售价表达式**反推，导致上游折扣价被污染：期望 5/25，实测 5.5/27.5。 | 上游采购报价与售价语义混淆，毛利计算起点错误 | 改用 `official.BillingExpr`（原始上游表达式）作报价基准，仅在其缺失时回退；售价表达式保持含 markup 不变。 | `TestUterAPIGroupRatioUpdatesChannelPriceAndUterMarkup`（升级为语义级断言）通过 |
| P0-7 | P0（基线阻塞） | `relay/helper/price_test.go`、`relay/per_second_pricing_test.go` | HEAD 上 `relay` 与 `relay/helper` 测试包因 Money 迁移遗留而**编译失败**（`floatPtr` 返回 `*float64` 但字段期望 `*model.Money`），使 `go test ./relay/...` 全部无法运行。 | 端到端扣费测试无法执行 | 测试辅助 `floatPtr` 改为返回 `*model.Money`；3 处 `&float64` 直接量改 `model.MoneyFromFloatPtr`。仅类型适配，**未删测试、未放宽断言**。 | `go test ./relay/... ./relay/helper/ -run '^$'` 编译通过 |

### 关于用户点名的"倍率参考被误当真实采购成本"（五个重点验收第 1 项）

**代码事实**：采购成本 `ChannelPurchaseCost` 是与销售价 `InternalPricing` **完全独立**的字段；`SetChannelPurchaseCostFor` 是唯一写入口（operator 合同价），自动同步不写它；`DERIVED_FROM_RATIOS` 价格保留 `PriceKind=RATIO_ONLY`、`Source=uterroute-ratio-reference`、`RatioBasis.Formula="reference_only: usd_per_1m = model_ratio * 2"`，**不写入 PurchasePricing**。审计层经 P0-3 修复后，此类模型即使自动生成售价也不再报 FULLY_MATCHED。

**残余风险（未改，需决策）**：`uterRouteChannelOfficialPricing()` 约 1361–1370 行仍会在倍率/历史快照价格成功生成内部售价后清除 `NeedsReview`，使这类模型进入自动计费（现有测试 `TestUterRouteRatioDerivedPriceIsAutoConfigured` 明确保护此行为）。这**不是**把倍率价标成"已验证采购成本"（采购成本字段始终未验证），但确实让倍率推算价成为可售卖价格。是否将倍率来源模型一律锁定为 NEEDS_REVIEW、禁止自动计费，属于产品定价策略决策，本次**未擅自推翻**已受测试保护的行为，作为剩余风险列出（见 F）。

---

## C. Uter Route 逐模型验证

真实上游逐模型验证（用户第十五节要求的 10 类模型）**未执行：BLOCKED**。原因：唯一可用的 live 测试 `TestPullUterRouteUpstreamLive` 会调用 `SaveUterRouteUpstreamSnapshot()` **写生产快照**，且依赖 `.env` 中的上游地址与生产库 `one-api.db`，超出只读授权范围；权限策略 `production_write: deny`、`real_payment: deny`。未提供可只读拉取的授权测试 Key。

改用受控 fixture 完成了可离线复现的计算级验证（均通过）：

| 场景 | 原始参数 | 折扣/加价 | 计算结果 | 预期 | 匹配 |
| --- | --- | --- | --- | --- | --- |
| 混合固定+token 多档 | `p*1` / `fixed(0.05)` | 0.6 | short=30（50×0.6）、long=30000（50000×0.6） | 各档 ×0.6 | ✅ |
| 固定费按次任务 | `tier("image", fixed(0.04))*image_count`，count=2 | 0.5 | `fixed(0.02)`，结果=原价×0.5，数量未被缩放 | ×0.5 | ✅ |
| 多档 token | `p*1.25+c*10+cr*0.13` / `p*2.5+c*15+cr*0.25` | 0.6×1.1 | 三个 usage 探针比率均 0.66 | ×0.66 | ✅ |
| 折扣组歧义 | `claude:0.6`、`claude-aws:0.9` | — | `ok=false` → 阻断 | 不猜测 | ✅ |
| 渠道折扣报价隔离 | `tier("base", p*10+c*50)` | group 0.5 | ChannelPrice input=5、output=25；售价=(10+50)×0.5×1.1=33 | 报价不含 markup | ✅ |

---

## D. 价格链路测试结果

| 链路环节 | 状态 | 依据 |
| --- | --- | --- |
| 上游模型目录解析 | 离线 fixture 覆盖；真实上游 BLOCKED | `FetchUterRouteUpstream` 相关测试通过 |
| 官方价/RATIO_ONLY 分类 | 已验证 | `TestUterRouteOfficialLine*`、`RatioDerived/Historical` 测试通过 |
| 渠道折扣与组匹配 | 已验证（含歧义阻断） | P0-2 三项测试通过 |
| 销售价与默认加价 | 已验证 | P0-1、P0-6 测试通过 |
| 折扣组渠道隔离 | 已验证 | `TestUterRouteDiscountGroupChangeIsChannelIsolated` 通过 |
| 采购成本未验证审计 | 已验证 | P0-3 测试通过 |
| 定价模式一致性 | 已验证 | P0-4 测试通过 |
| 预扣/补扣/退款/任务结算 | 已有测试套件存在并全绿；本次未新增场景 | `realtime_billing_test.go`、`task_billing_*`、`tiered_settle_test.go`、`billing_snapshot_test.go` 等；全量 `go test` 通过 |
| 账单快照不可变 | 审计确认（未改代码） | `billing_snapshot.go` 存 contract hash/version/汇率/usage/预扣/结算/退款；`UpdateBillingPriceSnapshotSettlement` 仅补结算字段，不重算价格 |
| 上游账单对账 | 已有能力，未做真实供应商对账 | `upstream_reconciliation.go`、`upstream_invoice.go`；真实账单 BLOCKED |
| 生产数据迁移 | 未执行（无需结构变更） | 本次改动不涉及 DB schema / 历史价格数据 |

---

## E. 测试证据

| 命令 | 结果 | 数量 |
| --- | --- | --- |
| `go build ./...` | 通过，exit 0 | — |
| `go test ./model/... ./service/... ./relay/... ./controller/... -count=1` | **通过，exit 0** | 29 个包 ok，0 FAIL |
| `go test ./model ./service ./relay/helper ./relay ./controller -race -count=1` | **通过，exit 0** | 0 FAIL，0 DATA RACE |
| 定点回归：`TestUterRouteMixedFixed*`、`TestUterRouteMultipleEnableGroups*`、`TestPricingAuditRespectsExplicitPricingMode`、`TestParityAuditDetectsPurchaseUnverified`、`TestProviderIdentityMigrationDetectsConflict`、`TestUterAPIGroupRatio*` 等 | 全部通过 | — |
| 真实上游 Live Test | **BLOCKED，未执行** | 需生产写权限与授权 Key |
| 前端 `typecheck/lint/test/build` | 未执行（本次无前端代码改动） | — |

新增/升级的自动化测试（均在对应模块测试文件）：
`TestUterRouteMixedFixedExpressionDiscountPreservesAllTerms`、`TestUterRouteMultipleEnableGroupsAmbiguous`、`TestUterRouteDiscountSelectionIgnoresEnableGroupOrder`（改为等倍率无歧义）、`TestUterRouteDiscountRejectsInvalidRatios`、`TestUterRouteDiscountGroupChangeIsChannelIsolated`、`TestPricingAuditRespectsExplicitPricingMode`、`TestParityAuditDetectsPurchaseUnverified`、`TestProviderIdentityMigrationDetectsConflict`、`assertExprScaledBy`（语义级断言辅助）。

---

## F. 剩余问题（不隐藏）

1. **真实上游逐模型验证 BLOCKED**（P0，环境/授权）：需要只读、已授权的 Uter Route 测试 Key 与隔离测试库；当前 live 测试会写生产快照。15 节要求的 10 类模型真实拉取与计费验证未完成。
2. **一致性审计未逐维比较金额/规则**（P0，部分完成）：`GetChannelUpstreamParity` 仍只拉模型名列表并补缺失模型，`BuildUpstreamParityReportWithCatalog` 未把上游完整价格/折扣/表达式与 Uter 数据逐维比对。真实价格对账目前由 `upstream_reconciliation` / invoice 模块承担，两者尚未整合为单一审计视图。用户要求的 13 个审计维度、13 种状态中的 `PRICE_MISMATCH`、`RULE_MISMATCH`、`DISCOUNT_MISMATCH`（除新增常量外）、`IDENTITY_MISMATCH`、`STALE` 等真实比对逻辑仍不完整。
3. **倍率来源模型自动计费策略**（P0，产品决策）：见 B 节残余风险；未擅自推翻受测试保护的行为。
4. **规范列出但未补齐的测试**：用户第十四节 40+ 个测试用例中，本次新增/升级 9 项；其余多数已有既有测试覆盖，但 `TestScopedPricingEmptyChannelCannotFallbackGlobal`、`TestChannelPriceSnapshotSurvivesPriceChange`、`TestSyncFailureKeepsPreviousValidPrice`、`TestConcurrentSyncIsSerialized` 等未逐项确认命名存在，完整覆盖矩阵未逐条核验。
5. **金额精度全面排查**（P1）：`model.Money` 已在主要价格引擎落地，但 float64 系数在 billing_expr 内部仍存在（`scaleBillingExprByFactor` 用 float64 计算系数，经 `roundRatioValue` 限精度）。全仓库 float64 金额残留未逐项清点。
6. **生产数据迁移/Dry Run**（P1）：本次无 schema 变更故未做；未对生产库做任何写入。
7. **`controller/channel_draft_test.go` 中的 `TestCreateChannelDraftMultiKeyModeIsPersisted`、`TestBuildChannelListQueryIncludesDraftChannels`** —— 由并发会话写入，非本次审计改动，已排除在本次修改清单之外。

---

## G. 最终状态

**NOT_PRODUCTION_READY**

理由：存在未解决的 P0 项——真实上游数据验证 BLOCKED（第 15 节）、一致性审计逐维比价未完整实现（第 7 节）、倍率来源自动计费策略待决策（五个重点验收第 1 项）。虽然本次修复了 7 项确凿缺陷且全量测试（含 race）通过，但按用户验收标准，"真实上游数据验证完成"与"审计能证明真实价格一致"两项均不满足，不得宣布生产验收通过。

整改代码已全部留在工作区未提交，供逐项 diff 复核；并发会话文件未被触碰。
