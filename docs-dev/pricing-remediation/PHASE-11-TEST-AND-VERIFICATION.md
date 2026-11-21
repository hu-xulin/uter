# PHASE 11 — 自动化测试与真实验证

状态：**PARTIALLY_VERIFIED**
（本地自动化测试全绿；供应商真实接口与三库矩阵未执行）

## 1. 本轮新增/扩展测试

| 测试 | 文件 | 断言 |
|---|---|---|
| `TestNormalizeModalityPricesBuildExpression` | `model/channel_model_pricing_test.go` | 平铺/阶梯思考与图片价生成 `img *`、`rt > 0 ?` 表达式 |
| `TestBatchPricingScalesThinkingAndImageDimensions` | `service/channel_batch_pricing_integration_test.go` | 只调 thinking_output；input/image 保持；写入表达式正确 |
| `TestResolveCurrentBatchBasePriceCarriesModalityDimensions` | `service/channel_batch_pricing_test.go` | 8 个新维度从当前售价读取 |
| `TestResolveBatchBasePriceRejectsChannelRatioAsOfficial` | 同上 | 渠道倍率不能作为官方基准 |
| `TestGenericChannelPricingRecordsClassifyPriceSources` | `service/generic_upstream_pricing_test.go` | CHANNEL_RATIO / OFFICIAL_RATIO / UNKNOWN / per-call 分类与换算记录 |
| `TestPurchaseCostIsSeparateFromQuoteAndFeedsSnapshot` | `model/channel_model_pricing_test.go` | 合同成本独立存储、覆盖公开报价、传递 verified 标记 |
| `TestBatchPricingUsesContractCostAndMarksVerification` | `service/channel_batch_pricing_integration_test.go` | 批量毛利使用合同成本；未验证时不得标为已验证 |
| `TestBillingPriceSnapshotIsImmutablePerIdentity` | `model/channel_model_pricing_test.go` | 同一 request 重复写入保留首条价格版本 |
| `TestRecordBillingPriceSnapshotCapturesIdentityAndVersion` | `service/billing_snapshot_test.go` | 渠道身份/销售版本/采购版本/组倍率写入快照；纯全局价不写 |

## 2. 实际执行的命令与结果

| 命令 | 结果 |
|---|---|
| `GOWORK=off go test ./...` | **exit 0** |
| `go test ./pkg/billingexpr ./model ./service -count=1` | 全部 `ok` |
| `go test ./model -run TestNormalizeModalityPricesBuildExpression -count=1` | `ok` |
| `go test ./service -run TestBatchPricingScalesThinkingAndImageDimensions -count=1` | `ok` |
| `go test ./controller -run Apiko -count=1` | `ok` |
| `gofmt -l model service controller pkg main.go` | 无输出 |
| `go vet ./model/... ./service/... ./controller/... ./pkg/billingexpr/...` | 无错误 |
| `cd web && bun run typecheck` | exit 0 |
| `cd web && bun run lint` | exit 0（0 warnings / 0 errors） |
| `cd web && bun run typecheck`（快照 UI 后复跑） | exit 0 |
| `cd web && bun run lint:design:strict` | exit 0 |
| `cd web && bun run i18n:sync` | 7 语言 missing/extras = 0；二次执行 sha256 一致 |

## 3. 真实供应商与三库验证（本轮实际执行）

| 验证 | 命令 | 结果 |
|---|---|---|
| 阿里百炼真实目录 | `BAILIAN_LIVE=1 go test -tags bailian_live ./service -run TestPullBailianCatalogLive -v` | PASS：275 个模型、266 个有价格、940 条参考价、region=cn-beijing |
| DreamRouter 真实价格 | `UPSTREAM_LIVE=1 go test -tags upstream_live ./service -run TestPullDreamRouterUpstreamLive -v` | PASS：86 个模型、44 个组、84/84 渠道价；样例官方 8 × 折扣 0.6 = 渠道 4.8 |
| Apiko 公开目录 | 临时只读探针（运行后已删除） | PASS：68 个模型、68 个可定价记录、29 条跳过原因 |
| MySQL 8.0 / PostgreSQL 16 | `UTER_TEST_MYSQL_DSN=... UTER_TEST_POSTGRES_DSN=... go test ./model -run TestChannelPricingTablesAcrossDatabases` | sqlite / mysql / postgres 全部 PASS |

- 真实请求只读取目录/价格并保存快照 option，没有修改用户、渠道或已配置售价。
- OpenAI/Anthropic/Gemini/Azure/AWS/腾讯/火山仍无公开价格接口或授权，未验证。

## 4. 未执行

- 其余云厂商真实接口。
- 旧库升级与两次启动迁移幂等。
- 供应商真实接口验证（无授权凭据；`bailian_live` 构建标签未启用）。
- 浏览器端 E2E/视觉回归（需要完整前后端栈）。
- 前端全量 `bun run test`；本轮只运行类型与设计门禁。

## 5. 真实数据声明

本轮**没有**调用任何真实供应商价格接口，也没有把 Mock 测试描述为真实验证。
因此：Model 同步、官方价格、折扣价格的“真实验证”状态为 EXTERNAL_BLOCKED。

## 6. 覆盖缺口

- 视频分辨率/时长组合计费未逐组合回归。
- 多模态输入（图像 token + 文本 token）真实用量拆分未回放。
- 退款与价格变更交叉场景只覆盖幂等键单测，缺端到端账本测试。