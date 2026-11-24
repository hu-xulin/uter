# Uter 定价整改——回归测试记录（2026-11-24，HEAD `8c1e9139c`）

## 新增或强化的测试

| 测试 | 覆盖点 | 结果 |
| --- | --- | --- |
| `TestChannelScopedPricingRequiredHonoursExplicitMode` | 显式 PENDING/ACTIVE/GLOBAL_LEGACY 压过价格行推断；旧渠道回退 | PASS |
| `TestDraftPublishBlockersRejectMissingSelectedPrice` | 选中 2 个模型、价格表为空 → 必须阻塞 | PASS |
| `TestDraftPublishBlockersRejectPartialPricing` | 20 个模型只写 10 行 → 缺口必须阻塞 | PASS |
| `TestDraftPublishBlockersRejectDuplicateIdentity` | 重复价格身份 → 阻塞 | PASS |
| `TestDraftPublishBlockersRejectEmptySalePriceAndVersion` | 销售价为空 / 版本缺失 → 阻塞 | PASS |
| `TestCreateUterAPIChannelsKeepsChannelDisabledWhenPricingFails` | 渠道创建后同步失败 → 渠道仍禁用、模式 PENDING | PASS |
| `TestCreateUterAPIChannelsCreatesOneChannelPerSlot` | 成功路径：分组倍率、状态启用、模式 ACTIVE | PASS |
| `TestAuthorizedUterAPIModelsUsesEnableGroups` | 分组归属来自 `enable_groups`，不按名称推断 | PASS |
| `TestAuthorizedUterAPIModelsFailsClosedWithoutGroupMetadata` | 无分组元数据时不放行 | PASS |
| `TestBailianCurrencyProvenanceIsExplicit` | 原始/标准化币种分离、推断标记、汇率换算 | PASS |
| `TestBailianUnconfirmedCurrencyNeedsReview` | 币种不明或 CNY 无汇率 → 待审核 | PASS |
| `TestGenericPricingProviderIdentityComesFromCaller` | Provider 不再固定写死 | PASS |
| `TestUpsertAdoptsStaleGenericProviderIdentity` | 旧 Provider 行被接管，不产生双份价格 | PASS |
| `TestPricingOwnerMapping` | 历史 Source 正确映射到四态 owner，未知来源默认人工 | PASS |
| `TestPricingOwnerProtectsOperatorPriceFromSync` | OPERATOR / BATCH / APPROVED 价格不被自动同步覆盖 | PASS |
| `TestStaleAutoOwnerDoesNotOverwriteManualPrice` | 原始 SQL 改价后过期 AUTO owner 不保护人工价 | PASS |
| `TestPricingOwnerRefreshesAutoAndKeepsApproved` | AUTO 自动价可刷新、APPROVED 价格保留 | PASS |
| `TestBillingFinancialSummaryUsesDecimalAccumulation` | 0.1+0.2 财务汇总精确为 0.3，退款/成本/毛利不再漂移 | PASS |
| `TestBillingFinancialsCostUsesDecimalForTokenPrices` | 百万 token 单价乘算与成本累计使用 decimal | PASS |

原有 `TestDraftPublishBlockersRequireBillablePrices`、`TestPublishChannelDraftReturnsTranslatablePricingBlocker` 等测试保留，未删除、未放宽断言；其中 synthetic 行补齐了销售价与版本字段以符合新的发布契约。

## 执行命令与结果

```
GOWORK=off go build ./...                                          # exit 0
GOWORK=off go test ./model/ ./controller/ ./service/ -count=1      # exit 0
GOWORK=off make test                                                # exit 0（全量门禁，续做批次后重跑）
GOWORK=off go test ./model -run 'TestPricingOwner|TestStaleAutoOwner' -count=1  # exit 0（P0-6）
GOWORK=off go test ./controller -run 'TestUterRouteEditFlow_StepByStep|TestPublishChannelDraftEnablesAbilitiesForPricingVisibility' -count=1  # exit 0（P0-6）
GOWORK=off go test ./model/ ./controller/ ./service/ -count=1      # exit 0（P0-6 完整复跑，首轮受并发临时测试干扰）
GOWORK=off make test                                                # exit 0（P0-6 后再次全量通过）
git diff --check                                                    # exit 0
GOWORK=off go test ./service -run 'TestBillingFinancial|TestBillingFinancialSummaryUsesDecimalAccumulation|TestBillingFinancialsCostUsesDecimalForTokenPrices' -count=1  # exit 0（P1-1）
GOWORK=off go test ./model/ ./controller/ ./service/ -count=1      # exit 0（P1-1 完整复跑）
GOWORK=off make test                                                # exit 0（P1-1 后再次全量通过）
GOWORK=off go test ./model -run TestPricingChannelViewsShareOnePriceContract -count=1  # exit 0
GOWORK=off go test ./controller -run 'TestResolveOfficialPrices|TestMergeOfficialPriceSources|TestNormalizePricingSource|TestOverlayChannelOfficialPrices' -count=1  # exit 0
cd web && bun run test -- src/features/pricing                     # exit 0, 18 files / 309 tests
cd web && bun run typecheck                                        # exit 0
cd web && bun test -- src/features/pricing                         # exit 1（39 失败，缺 jsdom，非本项目测试入口）
```

## 未执行的测试（不得视为通过）

- `GOWORK=off go test -race ./model ./service ./relay ./relay/helper`：未执行。
- `bun run lint`、`bun run format:check`、`bun run build`：未执行。
- SQLite / MySQL / PostgreSQL 定价矩阵：未执行（历史证据不代表当前 HEAD）。
- 真实上游验证（Uter Route / 百炼 / Uter.api）：BLOCKED，缺少授权密钥，未伪造 PASS。
