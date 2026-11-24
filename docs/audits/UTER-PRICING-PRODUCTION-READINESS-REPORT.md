# Uter 价格体系生产级审计报告 — Uter Route 深度验证与整改

> 本报告由本次实际执行生成，所有结论均带工具证据。未执行的验证一律标记 `NOT_EXECUTED` / `BLOCKED`，不写成 PASS。

## A. 审计基线

| 项 | 值 |
| --- | --- |
| 仓库 | `/Users/lincolnhu/uter`（本地 main 工作区） |
| 价格代码审计 HEAD | `b63e9c20293c1e8cd053bffcad3a57f5080c0e5b`（首轮审计开始时 HEAD） |
| 首轮报告写成时 HEAD | `3fb493a83ab11ed5e24474f729053a131343401b`（并发会话后续两次提交：`3197c741` design-system 文档、`3fb493a83` channel 草稿修复，**均不含**本次价格代码变更） |
| 最新复审起点 HEAD | `829bfa9`（用户指定；指令要求若 HEAD 更新则以最新 main 为准） |
| 最新复审与报告写成时 HEAD | `d5c9796068c9704276d3d542f398a00c5a9ce85a` |
| 分支 | `main`（未创建/切换分支） |
| 审计时间 | 2026-11-24 23:10 – 2026-11-25 02:12 GMT+8（含最新 HEAD 复审） |
| 审计开始时工作区 | `M VERSION`（保留未动） |
| 报告写成时工作区 | 49 个变更条目：本轮价格整改与并发会话改动并存，**均未提交** |
| 唯一审计依据 | 上述工作区实际代码；未引用历史审计报告作为当前实现证据 |

**并发会话说明**：执行期间另有会话提交了 `3197c741`（design-system 文档）与 `3fb493a83`（channel 草稿向导修复，5 文件）。这些均**非本次审计改动**，本次未触碰、未提交；价格整改全部留在本工作区未提交状态，便于逐项复核。最新复审期间工作区还存在并发会话写入的 `controller/channel_upstream_update.go`、`router/channel-router.go`、`controller/channel_uterapi_preview.go`、`service/uterapi_price_preview.go`、多份 i18n 与 channel 前端文件，均已排除出本轮改动范围。

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

**残余风险（首轮记录，已在最新复审关闭）**：首轮发现 `uterRouteChannelOfficialPricing()` 会在倍率/历史快照价格成功生成内部售价后清除 `NeedsReview`，使这类模型进入自动计费。该行为在最新 HEAD 复审中已推翻：倍率/历史参考价默认 `NEEDS_REVIEW` 且不生成 `InternalPricing`，原因码 `REFERENCE_PRICE_BILLING_NOT_AUTHORIZED` 落盘，详见 H 节 P0-01。

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

1. **真实上游逐模型验证 BLOCKED**（P0，环境/授权，仍未关闭）：需要只读、已授权的 Uter Route 测试 Key 与隔离测试库。新增只读测试在未授权时明确 `SKIP/BLOCKED`，不写快照、不伪造 PASS；`production_pass=FALSE`。
2. **一致性审计逐维金额/规则比较**（P0，已在最新 HEAD 关闭）：首轮记录为部分完成；最新实现已比较 official/channel/purchase/sale 各维度、币种、单位、折扣组/倍率、表达式 hash、身份与时间，详见 H 节 P0-04。
3. **倍率来源模型自动计费策略**（P0，已在最新 HEAD 关闭）：首轮记录为待决策；最新实现默认 NEEDS_REVIEW、无 `InternalPricing`、不自动计费，详见 H 节 P0-01。
4. **规范列出但未补齐的测试**（P1，仍未逐条核验）：用户第十四节 40+ 个测试用例中，两轮累计新增/升级多项；但 `TestScopedPricingEmptyChannelCannotFallbackGlobal`、`TestChannelPriceSnapshotSurvivesPriceChange`、`TestSyncFailureKeepsPreviousValidPrice`、`TestConcurrentSyncIsSerialized` 等仍未逐项确认命名存在，完整覆盖矩阵未逐条核验。
5. **金额精度全面排查**（P1，部分关闭）：自动加价已改为 `decimal.RequireFromString("1.10")` + `Money.MulDecimal()`，无 float64 金额往返；billing_expr 字符串系数仍受表达式引擎限制使用 float64 计算并经 `roundRatioValue()` 限精度，全仓库 float64 金额残留未逐项清点。
6. **生产数据迁移/Dry Run**（P1）：本次无 schema 变更故未做；未对生产库做任何写入。
7. **并发会话文件**（非本轮改动）：`controller/channel_draft_test.go`、`controller/channel_upstream_update.go`、`router/channel-router.go`、`controller/channel_uterapi_preview.go`、`service/uterapi_price_preview.go`、多份 i18n 与 channel 前端文件均由并发会话写入，已排除在本轮改动与提交范围之外。
8. **前端全量测试/lint 未清零**（非本轮价格代码）：`pnpm test` 全量 3287 项中 1 项失败，位于并发会话修改的 `channel-configuration.test.tsx`（`Uter.api fetch-prices step shows the selected group official and channel prices`，重复匹配 `/Claude Standard/`）；`pnpm lint` 仍报 28 warnings / 222 errors，本轮修改的 `lobe-icon.tsx`、`api.ts` 未出现在错误列表中。定价模块定向测试 309/309 通过。

---

## G. 最终状态

**NOT_PRODUCTION_READY**（截至最新 HEAD `d5c9796068c9704276d3d542f398a00c5a9ce85a`）

理由（最新复审后）：代码层的三个历史 P0（倍率来源自动计费、审计 Billable 与运行时不一致、一致性审计未逐维比较）已关闭，自动加价 Decimal 精度与折扣组/身份隔离也已修复；完整 Go build/test/race/diff 校验链全部 exit 0。但按用户验收标准仍不能宣布生产通过：

1. 真实 Uter Route 上游逐模型验证仍为 `BLOCKED/OBSERVED_ONLY`，未授权 Key 与隔离库，只读测试明确 `production_pass=FALSE`；
2. 前端全量测试仍有 1 项并发会话写入的 Uter.api 预览用例失败，前端 lint 仍有大量既有错误；
3. 用户第十四节完整测试覆盖矩阵尚未逐条核验。

首轮 7 项缺陷与最新复审 5 项 P0/P1 整改代码均留在工作区未提交，供逐项 diff 复核；并发会话文件未被触碰。

---

## H. 最新 HEAD 生产验收复审（用户第四轮指令）

### H.1 复审基线与方法

用户指定从 `829bfa9` 起审，并明确“若 HEAD 更新则用最新 main”。实际复审与报告写成时 HEAD 为 `d5c9796068c9704276d3d542f398a00c5a9ce85a`。本轮**未继承**首轮结论：重新检查七项历史修复是否仍有效，重新打开三个未关闭 P0，新增四项风险检查，并在修复后执行完整 Go 与前端校验。

### H.2 未关闭 P0 与新增风险关闭结果

| 编号 | 状态 | 根因与修复 | 关键证据 |
| --- | --- | --- | --- |
| P0-01 Ratio 来源自动计费 | **CLOSED** | `service/upstream_uterroute.go` 对 `DERIVED_FROM_RATIOS`、`HISTORICAL_SNAPSHOT` 保留展示用 tiers，但设置 `NeedsReview=true`、追加 `REFERENCE_PRICE_BILLING_NOT_AUTHORIZED`、返回空 `internalPricing`，不再自动计费；采购成本 `Verified` 不被倍率参考价提升。 | `TestUterRouteRatioDerivedPriceStaysReviewOnly`、`TestUterRouteHistoricalSnapshotStaysReviewOnly`、`TestUterRouteExpressionKeepsAllTiersAndParksRatioReference`；`controller/provider_sync_matrix_test.go` 断言 `PricingStatus=NeedsReview` 且 `ResolveChannelBillingPricing` 不可计费。 |
| P0-02 审计 Billable 与运行时不一致 | **CLOSED** | `model.ChannelPricingBillableReason()` 成为审计页与 Relay 运行时共享 row-level gate；过期检查仅适用于自动同步价，operator/batch/approved 人工价不因上游快照旧而失效；Relay 身份错误追加稳定原因码。 | `model/channel_model_pricing_test.go:TestChannelPricingBillableReasonGate`（含人工价不过期 case）、`TestSelectChannelPricingRowIdentityIsolation`、`relay/helper/price_test.go`。 |
| P0-03 自动加价 Decimal 精度 | **CLOSED** | 自动加价改为 `decimal.RequireFromString("1.10")` 与 `Money.MulDecimal()`，避免 `Float64()` 往返；表达式层新增科学计数法拒绝、`fixed()`/token/duration 逐项缩放与 `scaledAny` fail-closed。 | `TestDefaultSaleMarkupExactDecimalPrecision`、`TestDefaultSaleMarkupAppliedOnceInProductionPaths`、`TestScaleBillingExprByFactorCoverageMatrix`。 |
| P0-04 上游价格逐维一致性审计 | **CLOSED** | `service/channel_pricing_audit.go` 新增 `UpstreamParityDimension`，逐维比较 official/expected channel/channel/purchase/expected sale/sale USD，并记录币种、单位、折扣组、折扣倍率、表达式 hash、身份与时间；`web/src/features/channels/api.ts` 同步类型。 | `TestParityAuditComparesEveryPriceDimension`、`TestParityAuditDetectsUnitAndTierShapeMismatch`、`TestParityAuditDoesNotOverrideExplicitOperatorSalePrice`、`TestPricingAuditRespectsExplicitPricingMode`。 |
| P0-05 折扣组回退与身份隔离 | **CLOSED** | `GroupGroupRatio` 已出现多组不同倍率时返回 `ambiguous=true`，禁止 `GroupRatio` 扁平表回退掩盖歧义；价格身份四元组缺一即阻断，多候选 fail-closed。 | `UterRouteDiscountForModel` flat fallback 不得覆盖歧义断言、`TestSelectChannelPricingRowIdentityIsolation`、`TestModelPriceHelperUsesRequestRegionIdentity`（`identity_missing` 原因码可见）。 |
| 历史七项修复回归复审 | **仍有效** | 混合表达式逐项缩放、折扣组歧义阻断、倍率价非已验证采购成本、审计定价模式一致性、价格身份冲突 fail-closed、渠道折扣报价不含 markup、relay 测试类型适配均未发现回归。 | 完整 Go 全量测试与 race 均 exit 0；定向 `service`/`controller` UterRoute 测试均通过。 |

### H.3 真实上游验证（仍 BLOCKED，未伪造 PASS）

新增 `service/upstream_uterroute_readonly_live_test.go`（build tag `uterroute_live_readonly`）：

* 未设置 `UTER_ROUTE_LIVE_AUTHORIZED=1` 与 `UTER_ROUTE_LIVE_BASE_URL` 时直接 `SKIP/BLOCKED`；
* 不打开 DB、不写 snapshot、不 upsert pricing；
* 即使授权执行，也只输出 `REPORT status=OBSERVED_ONLY database_comparison=NOT_PERFORMED production_pass=FALSE`；
* 实测命令退出码 0，但测试结果为 `SKIP`，原因是 `BLOCKED: set UTER_ROUTE_LIVE_AUTHORIZED=1 only with operator authorization`。

**结论**：真实 Uter Route 上游逐模型验证与数据库逐维对账仍未执行；`production_pass=FALSE`，不得写成 live PASS。

### H.4 前端与构建阻塞处理

* `web/pnpm-workspace.yaml` 增加 `allowBuilds.chromedriver=false`，使 `pnpm install --ignore-scripts` 不被 `ERR_PNPM_IGNORED_BUILDS` 阻断。
* `web/src/lib/lobe-icon.tsx` 修复 `@lobehub/icons@5.23.1` 兼容：静态 toc 改为 `import { toc } from '@lobehub/icons/es/toc'`；动态变体改为受 `webpackInclude` 约束的实际 `.mjs` 文件路径，避免包 exports 无 `./es` 目录入口导致 Rspack 构建失败，同时保留按变体懒加载。
* `web/dist` 已生成（含 public 资源），解除 `main.go` 中 `//go:embed web/dist` 的构建阻塞。
* 前端全量测试 3287 项中 3286 通过；唯一失败为并发会话写入的 `channel-configuration.test.tsx > Uter.api fetch-prices step shows the selected group official and channel prices`（重复匹配 `/Claude Standard/`），非本轮价格代码。
* `pnpm lint` 仍有 28 warnings / 222 errors；本轮修改的 `lobe-icon.tsx`、`api.ts` 未出现在错误列表中，按既有阻塞记录，不擅自批量修改并发会话文件。

### H.5 命令与退出码

| 命令 | 退出码 | 结果摘要 |
| --- | --- | --- |
| `go build ./...` | 0 | `web/dist` 生成后通过 |
| `go test ./model/... ./service/... ./relay/... ./controller/... -count=1` | 0 | 29 个包 `ok`，0 FAIL |
| `go test ./service -run UterRoute -count=1` | 0 | 通过 |
| `go test ./controller -run UterRoute -count=1` | 0 | 通过 |
| `go test -race ./model ./service ./relay ./controller -count=1` | 0 | 4 个包 `ok`，0 DATA RACE |
| `git diff --check` | 0 | 无空白错误 |
| `pnpm typecheck` | 0 | 通过 |
| `pnpm exec vitest run src/features/pricing` | 0 | 18 files / 309 tests 全通过 |
| `pnpm test` | 1 | 335 files passed / 1 failed；3286/3287 tests passed |
| `pnpm lint` | 1 | 28 warnings / 222 errors（既有） |
| `UTER_SKIP_PUBLIC_COPY=1 pnpm exec rsbuild build && cp -R public/. dist/` | 0 | `web/dist` 生成 |
| `go test -tags uterroute_live_readonly ./service -run TestUterRouteUpstreamReadOnlyAcceptance -count=1 -v` | 0 | `SKIP/BLOCKED`，未授权，非 live PASS |

### H.6 本轮改动文件（未提交）

`model/channel_model_pricing.go`、`model/channel_model_pricing_test.go`、`model/money.go`、`service/upstream_uterroute.go`、`service/upstream_uterroute_test.go`、`service/default_sale_markup.go`、`service/default_sale_markup_test.go`、`service/channel_pricing_audit.go`、`service/channel_pricing_audit_test.go`、`service/upstream_parity_test.go`、`service/bailian_provider_test.go`、`service/verify_gptimage_batch_test.go`、`service/upstream_uterroute_readonly_live_test.go`（新增）、`controller/channel_uterroute_flow_test.go`、`controller/provider_sync_matrix_test.go`、`relay/helper/price.go`、`relay/helper/price_test.go`、`web/src/features/channels/api.ts`、`web/src/lib/lobe-icon.tsx`、`web/pnpm-workspace.yaml`、`web/pnpm-lock.yaml`（安装生成）。

本轮未执行 `git add`/`git commit`/`git push`；未触碰并发会话文件；未对生产库做任何写入。

### H.7 最新复审结论

代码层可安全修复的项目已全部闭环，Go 全链路与定价前端定向测试通过；但真实上游验证仍是环境/授权型 BLOCKED，前端全量套件与 lint 仍有非本轮失败。因此最终状态维持 **NOT_PRODUCTION_READY**，不给出 live PASS。
