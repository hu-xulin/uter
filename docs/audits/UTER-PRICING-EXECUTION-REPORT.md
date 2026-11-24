# UTER Pricing Execution Report

- Audit baseline: `3c09cd030d6eed331b191b23b35993f8f7d6e37b`
- Report date: 2026-11-23
- Overall status: **PARTIALLY_VERIFIED / NOT PRODUCTION READY**

## Commits in this remediation batch

| Commit | Change |
|---|---|
| `cb87d0d93` | Isolate channel price fallback; Uter.api auth; parity source split |
| `3b7015420` | Full upstream catalog parity and Uter.api live verification |
| `39fc636a9` | Live audit uses real usage keys |
| `5c59113c5` | Reject incomplete Bailian pagination |
| `40e6258d5` | Cross-instance channel price-sync lock |
| `f532239dd` | Uter Route manual sync reuses the channel lock |
| `032bcfa83` | Generic/Uter.api scheduled review and pricing rules |
| `16d20b426` | Review entries carry pricing version |
| `bb18b1501` | Post-sync catalog completeness verification |
| `8035ddf94` | Parity counts unverified purchase cost |
| `c827d5d71` | Generic upstream price history |
| `ef608ed81` | Orphan/Apiko historical data audit |

## Problems closed

1. Automatic source recognition divergence (`generic:`/`Uter.api-`/legacy `apiko-`).
2. Official vs channel vs estimate conflation in parity.
3. Uter.api price sync missing API key; Uter.api absent from adapter registry.
4. Silent global fallback for channels that already have scoped pricing.
5. Missing upstream models invisible to parity.
6. Generic/Uter.api scheduled sync ignored review/threshold/rules.
7. No cross-instance lock for generic/Uter.api/Uter Route manual sync.
8. Incomplete Bailian catalogs accepted.
9. Review approval could use a stale price state (version now checked).
10. Orphan and Apiko historical rows invisible.

## Verification evidence

| Command | Result |
|---|---|
| `go build ./...` | exit 0 |
| `make test` | exit 0 |
| `go test ./model ./service ./relay/helper ./relay -count=1` | passed |
| `PRICING_AUDIT=1 go test -tags pricing_audit_live ./service -run TestAuditUter.apiLive` | 51 models, 51 executable |
| `PRICING_AUDIT=1 go test -tags pricing_audit_live ./service -run TestAuditUterRouteLive` | 86 records, 54 executable, 32 review, 0 failures |
| `PRICING_AUDIT=1 go test -tags pricing_audit_live ./service -run TestAuditBailianLive` | 275 catalog, 134 records, 105 executable |
| `bun run typecheck` / `lint` / `format:check` | passed at last run |
| `./scripts/verify-all.sh --quick` | 9 PASS / 0 FAIL / 4 SKIP at last run |

## Model/price counts (live snapshot)

- Uter.api: 51 models, 51 records, 51 executable expressions.
- UterRoute: 86 records, 54 executable, 32 intentional review.
- Bailian: 275 catalog models, 134 records, 105 internal prices.

## Three-channel live validation (2026-11-23)

Definition used: official price = model vendor's published list price; channel
price = the selected upstream channel's published price after its group
discount; Uter price = channel price × 1.10 unless an operator price exists.

| Channel | Rows | Configured / review | Evidence |
|---|---:|---:|---|
| Uter Route `32` (优特渠道) | 86 | 86 / 0 | `claude-fable-5`: expression `p*10+c*50+cr*1+cc*12.5+cc1h*20`, group `default` 0.6 → channel `6 / 30`, cache `0.6`, cache write `7.5`; Uter `6.6 / 33`, cache `0.66`, cache write `8.25` |
| Alibaba Bailian `34` | 134 | 122 / 12 | 33 auto `bailian-channel` prices plus 89 operator `batch` prices; auto flat and tiered prices all include the 1.10 markup |
| Alibaba Bailian `62` (new draft channel) | 3 | 1 / 2 | `MiniMax-M2.5`: channel `0.31390134529147984 / 1.2556053811659194`, Uter `0.34529147982062786 / 1.3811659192825114` (exact ×1.10); `qwen-plus` / `qwen-flash` stay review-only because the catalogue publishes both implicit cache-hit and explicit cache-read prices |
| Uter.api `54`–`60` | 68 | 68 / 0 | All executable expressions refreshed to `(base × 1.10) × group`; `54` (`Claude-kiro` 0.9): channel `1.8 / 9`, Uter `(base × 1.10) × 0.9` = `1.98 / 9.9` |

Commands used:

```bash
go run /tmp/uter_Uter.api_refresh.go      # refresh Uter.api with the application sync path
go run /tmp/uter_uterroute_refresh.go # refresh Uter Route channel 32
bunx vitest run src/features/channels/components/__tests__/channel-pricing-panel.test.tsx
make test
./scripts/verify-all.sh --quick
```

Results: `make test` exit 0; quick gates 9 PASS / 0 FAIL / 4 SKIP; the frontend
pricing panel test 5/5 passed. A workspace-enabled `go test ./controller`
selection still fails `TestManageUserQuotaMiddlewareKeepsOneOperationPerRequest`
because a legacy token is rejected; the same package passes under the project
gate (`GOWORK=off`, as used by `make test`). It is unrelated to pricing.

## Runtime rebuild and Apiko documentation cleanup (2026-11-23)

- `web/` production build: exit 0; the served `index.html` references the newly
  generated asset hashes, so port 3000 now uses the current UI bundle.
- Root Go build with `GOWORK=off`: exit 0; local `uter-bin` rebuilt and
  restarted after backing up the previous binary to `/tmp/uter-bin.prev`.
- Browser verification of `/pricing` is **BLOCKED**: the unauthenticated
  isolated session redirects to email-code sign-in, and no authorized session
  credential is available. Data and unit-level rendering remain verified;
  this is not reported as a visual pass.
- Repository-wide runtime grep for `Apiko`/`apiko` finds no provider, route,
  task, controller or model code. Only the `apiko-` prefix in the automatic
  source classifier remains, intentionally, for historical-row audit.
- `docs-dev/pricing-remediation/PHASE-03-PROVIDER-SYNC.md` and
  `PHASE-06-PRICE-GOVERNANCE.md` now describe Uter.api in place of the removed
  Apiko runtime and state the historical-prefix boundary.

## Uter Route official-price display fix (2026-11-23)

Root cause: Uter Route expression models only wrote a discounted
`channel_price`; the expression coefficients were never copied into `tiers`, so
the page's "Upstream official price" stayed empty. Ratio-only rows also had the
upstream-provided `official_price` deliberately discarded.

The parser now:

- writes the undiscounted expression coefficients as the official tier while
  keeping the group-discounted tier as `channel_price`;
- exposes the upstream `official_price` as a reference tier for ratio-only and
  historical rows, while keeping `PriceKind`, `NeedsReview` and the review
  reason unchanged so neither can auto-enable billing;
- leaves `HasOfficial`/`HasOfficialEstimate` semantics unchanged.

Live channel `61` now has 84/84 Uter Route rows with both official and channel
prices. A second set of 84 duplicate `newapi-compatible` rows with the same
model identities had no official price and made the page look inconsistent;
they were removed after the database backup, leaving only the Uter Route rows.
Examples:

| Model | Official | Channel | Uter | State |
|---|---|---|---|---|
| `claude-fable-5` | `$10 / $50`, cache `$1`, cache write `$12.5` | `$6 / $30` | `$6.6 / $33` | configured |
| `MiniMax-M2.5` | `$0.3 / $1.2` | `$0.285 / $1.14` | `$0.3135 / $1.254` | configured (`RATIO_ONLY` source preserved) |

Tests: `TestUterRouteRatioDerivedPriceStaysReviewOnly`,
`TestUterRouteExpressionKeepsAllTiersAndReviewGate`, and the UterRoute
pricing suite pass. The database was backed up to
`/tmp/one-api.before-uterroute-official.db` before the refresh.

## Post-rebuild live verification (2026-11-23)

| Check | Result |
|---|---|
| `PRICING_AUDIT=1 ... TestAuditUterRouteLive` | 86 records, 54 executable, 32 review, 0 failures |
| `PRICING_AUDIT=1 ... TestAuditBailianLive` | 275 catalog, 134 records, 105 executable, 29 review, 0 stale |
| `PRICING_AUDIT=1 ... TestAuditUter.apiLive` | 51 models, 14 groups, 51 executable, 0 failures |
| `GOWORK=off go test -race ./service -run 'Uter.api\|Bailian\|Pricing\|Markup\|Upstream'` | PASS |
| `GOWORK=off go test -race ./model -run 'ChannelPricing\|ScopedPricing\|Purchase\|BillingSnapshot'` | PASS |
| `TestChannelPricing*AcrossDatabases` | SQLite PASS; MySQL/PostgreSQL skipped without DSN |

The live audits fetch the current upstream documents; they do not write database
rows. Uter Route ratio-only and historical rows now use the upstream
`official_price` reference to generate a configured sale price
(`channel price × 1.10`) while retaining `RATIO_ONLY` / `HISTORICAL_SNAPSHOT` as
the price-kind marker. Unsupported or missing shapes still stop at review.

Current channel `61` parity: `FULLY_MATCHED: 84`, `MANUAL_REVIEW: 0`,
`PRICE_MISMATCH: 0`. The 44 expression, 24 ratio-only, 8 historical and 8
absolute records are all `configured`.

A new guard rejects scheduled generic sync for an Uter.api channel that has
no stored billing group, instead of silently syncing the undiscounted catalogue
price (`TestUterAPIGenericSyncRequiresBillingGroup`).

## Request-level billing reconciliation samples (2026-11-23)

Two real consume logs were matched to their written price contracts by channel,
model and identical `created_at` (the supplier-side request ids are not the
same, so the nearest-time mapping is used).

| Log | Model / channel | Snapshot contract | Recalculation | Logged quota |
|---|---|---|---|---:|
| `8732` | `claude-fable-5` / `32` | `per_1m_token`, ratio `3.3`, completion `5` | `8×3.3 + 14×3.3×5 = 257.4` | `257` |
| `8733` | `qwen3-coder-flash-2025-07-28` / `34` | tiered expression, first tier `p×0.149476831 + c×0.597907324`, then `×1.1` | `(9×0.149476831 + 9×0.597907324)×1.1 / 1e6 × 500000 ≈ 3.70` | `4` |

Both snapshots carry the purchase price separately from the sale contract and
mark `PurchaseVerified=false`, so the public quote is not presented as a
verified contract. These samples close the flat-ratio and tiered-expression
request-level checks; supplier invoice reconciliation still needs the vendor
export and a supplier→Uter request-id mapping.

## Active local DB drift (2026-11-23 10:17)

The shared local `one-api.db` changed outside this task after the pricing
validation. Channels `32`, `34` and `54`–`60` disappeared from the active
channel table and a draft channel `61` appeared; pricing rows for the removed
channels still exist and are now orphaned. This task did not delete any channel
or run a database reset. The pre-change database backup is
`/tmp/one-api.before-Uter.api-refresh.db`; it was not restored because restoring
could overwrite concurrent user work. The counts and channel evidence above
describe the validated snapshot, not the current drifted database. Re-sync and
re-validate the active channels before release.

## Three-database matrix (2026-11-23)

MySQL 8.4.13 and PostgreSQL 16.16 were installed locally and started as
temporary instances; SQLite runs in memory.

```bash
export UTER_TEST_MYSQL_DSN='uter:uter@tcp(127.0.0.1:3306)/uter?parseTime=true&charset=utf8mb4'
export UTER_TEST_POSTGRES_DSN='postgres://uter:uter@127.0.0.1:5432/uter?sslmode=disable'
GOWORK=off go test -count=1 ./model \
  -run 'TestChannelPricing.*AcrossDatabases|TestMultiDBDialectCompat' -v
```

| Test | SQLite | MySQL 8.4.13 | PostgreSQL 16.16 |
|---|---|---|---|
| `TestChannelPricingTablesAcrossDatabases` | PASS | PASS | PASS |
| `TestChannelPricingIdentityMigrationAcrossDatabases` | PASS | PASS | PASS |
| `TestMultiDBDialectCompat` | PASS | PASS | PASS |

The pricing tests migrate every pricing/snapshot/invoice table twice to prove
idempotency, assert the full identity unique constraint, assert a second region
is a separate identity, and reproduce a pre-migration duplicate identity to
prove the merge and index swap. The expected `Duplicate entry` log lines are
negative assertions. ClickHouse is a log-database dialect and is not used by
these primary-database pricing tables, so its subtest remains skipped.

A full application startup matrix was then run against fresh databases:

| Engine | First start | Second start | Marker rows |
|---|---|---|---|
| MySQL 8.4.13 | `/api/status` 200 | `/api/status` 200 | 1 |
| PostgreSQL 16.16 | `/api/status` 200 | `/api/status` 200 | 1 |

This exposed a real MySQL-only defect: the log-cache backfill marker used the
reserved word `key` unquoted in raw SQL, so every MySQL start logged
`Error 1064`. `model/main.go` now builds the statement with `commonKeyCol`; the
second MySQL start wrote exactly one marker row and logged no SQL error. Both
temporary database servers were stopped after the matrix.

## DreamRouter/UterRoute channel-price correction (2026-11-23 21:13)

Channels 63–66 had been populated by the generic New API sync with provider
`newapi-compatible`. That path has no model-group discount context, so the
undiscounted expression price was written into `channel_price`: the official
price was presented as the channel price and the real discounted channel price
was missing.

The fix:

- Generic sync now routes every UterRoute host channel to
  `UterRouteChannelPricingRecords`; it no longer writes generic New API price
  rows for those channels.
- Discount selection ignores unstable `enable_groups` order and deterministically
  chooses the lowest positive published model-group ratio.
- 332 erroneous `newapi-compatible` rows were deleted after backing up the
  database to `/tmp/one-api.before-uterroute-fix.db`.
- Channels 61, 63, 64, 65 and 66 were re-synced. Each now has 83 UterRoute rows
  with both official and channel prices.
- `claude-fable-5` is consistent across all five channels: official `$10/$50`,
  channel `$6/$30`, Uter sale `$6.6/$33`.

Tests:

- `TestGenericSyncPrunesUterRouteModelsWithoutVendor` now asserts the provider
  route and `discount_model_group=claude`.
- `TestUterRouteDiscountSelectionIgnoresEnableGroupOrder` proves both group
  orderings select `claude` at 0.6.
- `GOWORK=off go test -count=1 ./service` and `make test`: exit 0.

## Historical data snapshot

- 711 channel pricing rows total.
- 413 rows belong to deleted channels (IDs 26, 31, 33, 35, 36).
- 69 rows are Apiko residue.

No production data was deleted or rewritten.

## Outstanding blockers

1. Authorized supplier invoice exports.
2. Backup/preview/approval for orphan and Apiko rows.
3. Decimal/FX migration.
4. Runtime image-task usage facts.
5. Production release-candidate smoke on the real deployment topology (local full startup matrix now passes on SQLite/MySQL/PostgreSQL).
6. Real token/image/video/B-C group request closure.

## Final status

The code defects in this batch are implemented and covered by tests. The full
release gate is not met. Use `PARTIALLY_VERIFIED`, not `FULLY_OPERATIONAL`.

---

## 本轮整改：2026-11-24（HEAD `8c1e9139c`）

状态：**PARTIALLY_VERIFIED**。本轮只处理审计输入中明确要求最优先的 P0-1、P0-2、P0-4、P0-5；上文历史证据不代表当前 HEAD。

### 实际修改文件

| 文件 | 修改内容 |
| --- | --- |
| `relaykit/dto/channel_settings.go` | 新增 `PricingMode` 字段与三个模式常量 |
| `model/channel_model_pricing.go` | 新增 `ChannelScopedPricingRequired`，显式模式优先于行数推断 |
| `relay/helper/price.go` | Token / 按次计费入口改走新门禁 |
| `relay/relay_task.go` | 任务计费入口改走新门禁 |
| `controller/channel_draft.go` | 草稿创建设 PENDING；发布改为“选中模型 − 已配置价格”差集校验；通过后设 ACTIVE |
| `controller/channel_uterapi.go` | 创建即禁用并显式写回 `status=0`；按 `enable_groups` 授权模型；验证通过才启用 |
| `service/uterapi_catalog.go` | 新增 `AuthorizedUterAPIModels` |
| 对应的 4 个 `_test.go` | 新增/强化回归测试 |

用户原有未提交改动 `M VERSION` 保持不变；本轮未执行 `git add`、未提交。执行期间还检测到并发会话对 `service/channel_batch_pricing.go` 与 `service/channel_batch_pricing_integration_test.go` 的修改（批量折扣加表达式规则），这些改动不是本轮产生，未纳入本轮变更清单；`make test` 后又单独复核 `GOWORK=off go test ./service -count=1`，退出码 0。

### 命令与退出码（均为本轮实际执行）

| 命令 | 退出码 | 结果 |
| --- | --- | --- |
| `GOWORK=off go build ./...` | 0 | 通过 |
| `GOWORK=off go test ./model/ ./controller/ ./service/ -count=1` | 0 | model 13.5s、controller 88.3s、service 15.9s 全通过 |
| `GOWORK=off make test` | 0 | 全量门禁通过（含 relaykit / tokenkit 子模块） |
| `GOWORK=off go test ./model -run TestPricingChannelViewsShareOnePriceContract -count=1` | 0 | 通过 |
| `GOWORK=off go test ./controller -run 'TestResolveOfficialPrices\|TestMergeOfficialPriceSources\|TestNormalizePricingSource\|TestOverlayChannelOfficialPrices' -count=1` | 0 | 通过 |
| `cd web && bun run test -- src/features/pricing` | 0 | 18 文件 / 309 测试通过（项目正式脚本 vitest + jsdom） |
| `cd web && bun run typecheck` | 0 | 通过 |
| `cd web && bun test -- src/features/pricing` | 1 | 39 失败：裸 `bun test` 无 jsdom，`document is not defined`；与本轮改动无关 |

### 行为变化

1. Uter.api 创建接口返回 `status:0`、`pricing_verified:false`；验证通过后返回 `status:1`、`pricing_verified:true`。仅读 `created` 的调用方兼容。
2. 上游未发布 `enable_groups` 时，Uter.api 不再自动加入任何模型（fail-closed）。
3. 多 Key 槽位取各 Key 模型目录交集，不再取并集。
4. 草稿向导发布的渠道均为 `CHANNEL_SCOPED_ACTIVE`；未打标签的旧渠道行为不变。

### 未完成

百炼币种/单位、十进制精度、Provider 身份标签、Apiko 清理、真实上游验证、数据库历史迁移与对账系统均未实施；详见 `UTER-PRICING-FINAL-ACCEPTANCE.md`。

## 续做批次：P0-3 与 P1-2（同日 18:45+）

### 修改文件

| 文件 | 修改内容 |
| --- | --- |
| `model/channel_model_pricing.go` | 价格对象与原始分量新增 `source_currency` / `normalized_currency` / `currency_inferred`；Upsert 可按渠道+模型接管旧 Provider 行 |
| `service/bailian_provider.go` | 百炼价格同时记录原始/标准化币种、汇率来源与推断标记；未知币种或无汇率进入 `needs_review` |
| `service/generic_upstream_pricing.go` | 三个转换函数新增可选 Provider ID 参数，默认 `newapi-compatible` |
| `service/uterapi_catalog.go` | Uter.api 价格行写 `uterapi`，不再写通用 Provider |
| `model/channel_model_pricing_test.go`、`service/bailian_provider_test.go`、`service/generic_upstream_pricing_test.go` | 新增币种溯源、待审核与 Provider 身份回归测试 |

### 命令与退出码

| 命令 | 退出码 |
| --- | --- |
| `GOWORK=off go build ./...` | 0 |
| `GOWORK=off go test ./service -run 'TestBailianCurrencyProvenanceIsExplicit\|TestBailianUnconfirmedCurrencyNeedsReview\|TestGenericPricingProviderIdentityComesFromCaller\|TestBailianPriceNormalization' -count=1` | 0 |
| `GOWORK=off go test ./model -run 'TestUpsertAdoptsStaleGenericProviderIdentity\|TestUpsertAdoptsLegacyBailianModelProviderIdentity' -count=1` | 0 |
| `GOWORK=off go test ./model/ ./controller/ ./service/ -count=1` | 0 |
| `GOWORK=off make test` | 0 |

### 行为变化与边界

- 百炼北京/香港 CNY、海外 USD 仍由地域推断（上游没有币种字段），但现在显式标记 `currency_inferred=true`；币种无法确认或 CNY 无有效汇率时进入 `needs_review`，不会自动发布。
- Uter.api 历史 `newapi-compatible` 价格行在下次同步时被就地改为 `uterapi`，不会新增重复身份；人工价格保留。
- 仍未完成：单位/阶梯/多模态专项验证、十进制精度、Apiko 清理、真实上游与数据库迁移。

## 续做批次：P0-6 价格所有权（同日 19:00+）

### 修改文件

| 文件 | 修改内容 |
| --- | --- |
| `model/channel_model_pricing.go` | 新增 `PricingOwner`（AUTO / OPERATOR / BATCH / APPROVED）落库字段；`PricingOwnerForSource`、`pricingReplaceableByOwner`、`IsAutoDerivedPricingRowFor` 成为统一覆盖判定；写入/清空路径维护 owner |
| `model/channel_model_pricing_test.go` | 新增所有权映射、人工价保护、过期 AUTO owner 保护、自动价刷新与已审核价保留测试 |

### 规则与边界

- 显式 `OPERATOR` / `BATCH` / `APPROVED` 价格永不被引擎同步覆盖；旧行无 owner 时继续按 `source` 判断，保持兼容。
- 显式 `AUTO` owner 还要求存储 price source 仍表现为自动来源，防止原始 SQL 改价后留下过期 owner，把人工价误判为可覆盖。
- Provider 身份清理、review gate、批量规则同样改用 owner-aware 判定；清空价格时同步清空 owner。
- `source` 字段继续保留为审计信息，不作为唯一真相源。

### 命令与退出码

| 命令 | 退出码 | 结果 |
| --- | --- | --- |
| `GOWORK=off go build ./...` | 0 | 通过 |
| `GOWORK=off go test ./model -run 'TestPricingOwner\|TestStaleAutoOwner' -count=1` | 0 | 通过 |
| `GOWORK=off go test ./controller -run 'TestUterRouteEditFlow_StepByStep\|TestPublishChannelDraftEnablesAbilitiesForPricingVisibility' -count=1` | 0 | 通过 |
| `GOWORK=off go test ./model/ ./controller/ ./service/ -count=1` | 0 | 首轮曾因并发会话临时存在的 `TestZZTemporaryVisibilityPreviewOnCopiedDB` 失败；该测试随后从工作区消失且定向复跑显示 `no tests to run`，完整复跑退出码 0 |
| `GOWORK=off make test` | 0 | 全量门禁通过（含 relaykit / tokenkit 子模块） |
| `cd web && bun run test -- src/features/pricing` | 0 | 18 文件 / 309 测试通过 |
| `cd web && bun run typecheck` | 0 | 通过 |
| `git diff --check` | 0 | 无空白错误 |

P0-6 已代码修复并通过本轮全量回归；仍未完成：十进制精度、Apiko 清理、真实上游验证、数据库历史迁移与计费对账。

## 续做批次：P1-1 财务金额 decimal 计算（同日 19:30+）

### 修改文件

| 文件 | 修改内容 |
| --- | --- |
| `service/billing_financials.go` | 额度折 USD、采购成本逐维度金额、无合同估算、表达式成本换算与总成本累加改用 decimal，写回时再转 float64 |
| `model/billing_ledger.go` | `SummarizeBillingFinancials` 用 decimal 累加 Sale / Refund / Cost 并计算毛利，NaN/Inf 归零 |
| `service/billing_snapshot_test.go` | 新增 0.1+0.2 汇总精度与百万 token 单价乘算精度回归 |

### 命令与退出码

| 命令 | 退出码 | 结果 |
| --- | --- | --- |
| `GOWORK=off go build ./...` | 0 | 通过 |
| `GOWORK=off go test ./service -run 'TestBillingFinancial\|TestBillingFinancialSummaryUsesDecimalAccumulation\|TestBillingFinancialsCostUsesDecimalForTokenPrices' -count=1` | 0 | 新增与既有财务测试通过 |
| `GOWORK=off go test ./model/ ./controller/ ./service/ -count=1` | 0 | model 13.6s、controller 81.5s、service 14.3s 全通过 |
| `GOWORK=off make test` | 0 | 全量门禁通过（含 relaykit / tokenkit 子模块） |
| `git diff --check` | 0 | 无空白错误 |

### 边界与状态

本次是**计算层 decimal 迁移**，不是数据库/API 全量 decimal 迁移：`BillingCostBreakdown`、`BillingFinancialLedger` 的 float64 列、渠道价格 JSON 字段、表达式引擎输入仍保持原状，以免触发生产库迁移和接口契约变更。状态为 **PARTIALLY_BUILT**，不得报 P1-1 完全关闭。

## 续做批次：Apiko 历史数据清理（同日 19:50+）

### 备份与审计

- 备份文件：`/tmp/one-api.db.bak-apiko-20261124-194856`（SQLite backup API 在线备份，包含 WAL 内容）。
- 全库只读扫描 55 张表后确认：`channel_model_pricing` 中已无 Apiko 价格行；残留仅存在于供应商同步状态与运营配置。
- 审计日志中的 14 条 Apiko 操作历史属于审计证据，不属于供应商配置或价格数据，按保留历史原则未删除。

### 已删除记录

| 表 | rowid | 值 |
| --- | ---: | --- |
| `channel_sync_states` | 21 | `provider='apiko'` |
| `options` | 294 | `key='ApikoCatalogSnapshot:33'` |
| `options` | 296 | `key='ApikoUpstreamSyncState'` |

### 验证结果

- `channel_model_pricing` / `channel_sync_states` / `options` / `channels` 的 Apiko 命中均为 0。
- `audit_logs` 保留 14 条历史操作记录，符合审计不可篡改要求。
- 运行时 Go 代码仅保留 `apiko-` 历史来源分类器，用于识别旧行；未发现供应商适配器、路由或配置项代码。

## 续做批次：历史迁移与孤儿价格清理（同日 20:10+）

### 代码与迁移

- `model/channel_model_pricing_migration.go`：新增 `PrepareChannelModelPricingOwner`，幂等添加/回填 `pricing_owner` 与索引；不可识别来源默认 `OPERATOR`，防止同步覆盖人工价。
- `model/main.go`：在 AutoMigrate / 版本化 schema 迁移后、review gate 前执行 owner 回填。
- `model/channel_model_pricing_test.go`：新增 `TestPrepareChannelModelPricingOwnerBackfillsHistory`。

### 本地库执行结果

- 备份：`/tmp/one-api.db.bak-migration-20261124-201209`。
- owner 回填 962 行，全部 `AUTO`（`uterroute-official` 828、`bailian-channel` 134）。
- 删除 715 条孤儿活动价格行，涉及已删除渠道 62 / 1235 / 63 / 64 / 65 / 1233 / 1234 / 1237。
- 复核：剩余活动价格 247 行，孤儿 0、空 owner 0、重复身份 0、owner 索引 1。
- 保留：`channel_pricing_history` 8,063 条、账单快照 26 条、账本 11 条、同步状态 24 条孤儿记录，作为历史/审计证据不参与活动计费。

### 验证

- `GOWORK=off go test ./model -run 'TestPrepareChannelModelPricingOwnerBackfillsHistory|TestPricingOwner' -count=1` → 0。
- 生产库未连接、未改写；未做生产回滚演练，不报生产就绪。

## 续做批次：decimal 结构化金额类型（同日 20:20+）

### 修改文件

| 文件 | 修改内容 |
| --- | --- |
| `model/money.go` | 新增 `model.Money`：decimal-backed 金额类型，SQL 存 decimal 字符串、JSON 输出为数字，NaN/Inf 归零 |
| `model/billing_ledger.go` | `UnitPriceUSD` / `AmountUSD` / `OriginalAmount` 及财务汇总字段改为 Money |
| `model/billing_price_snapshot.go` | `PurchaseUSD` 改为 `*Money`，新增 `*float64 → *Money` 转换助手 |
| `service/billing_financials.go` / `billing_snapshot.go` / `upstream_billing_samples.go` / `upstream_invoice.go` | 写入/累加/对账路径改用 Money 与 decimal |
| 相关 `_test.go` | 断言改为 Money 的精确字符串或 Float64 视图 |

### 验证

| 命令 | 退出码 |
| --- | --- |
| `GOWORK=off go build ./...` | 0 |
| `GOWORK=off go test ./model/ ./controller/ ./service/ -count=1` | 0 |
| `GOWORK=off make test` | 0 |
| `git diff --check` | 0 |

### 边界

计费账本、成本明细与账单快照的 PurchaseUSD 已完成 Money 结构化；TopUp、Subscription、渠道定价 JSON 金额字段和表达式引擎输入仍为 float64。状态为 **PARTIALLY_BUILT**，不得报告为全局 decimal 迁移完成。