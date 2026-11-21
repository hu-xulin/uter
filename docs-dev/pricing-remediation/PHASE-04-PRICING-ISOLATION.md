# PHASE 04 — 渠道价格隔离与身份一致性

状态：**IMPLEMENTED_AND_VERIFIED**（本地单库测试；三库矩阵见 Phase 10）

## 1. 统一身份

```go
type ChannelPricingIdentity struct {
    ChannelId    int
    Provider     string
    Region       string
    DeploymentId string
    ModelName    string
}
```

- 唯一索引：`idx_channel_model_pricing_identity`
  `(channel_id, provider, region, deployment_id, model_name)`。
- 查询、写入、回滚、缓存键都使用该五元组：
  `normalizePricingIdentity` / `channelPricingCacheKey`
  （`model/channel_model_pricing.go:329`、`:337`）。

## 2. 请求链路传递

- `service.ChannelPricingIdentityForRequest`（`service/upstream_capability.go:117`）
  解析 channel type、base URL、deployment、model。
- `relay/helper/price.go:64` 从 `info.ChannelMeta.ChannelOtherSettings.DeploymentID`
  取 deployment 并传入身份；预扣路径不再使用空 deployment。
- `relay/relay_task.go:280` 在任务计费中同样取 deployment，并在
  `:313`、`:362`、`:410` 写入 `ChannelPricingDeployment`，最终进入账单 admin 字段
  `service/log_info_generate.go:84`。
- 多区域/多部署记录存在时，无法匹配的身份返回
  `ErrChannelPricingIdentityRequired`，不会回退到其他部署价格。
- 不精确匹配时返回 `MsgRelayChannelPriceIdentityUnmatched`，禁止静默使用其他渠道价格。

## 3. 隔离保证

| 场景 | 行为 | 测试 |
|---|---|---|
| 同模型不同渠道 | 独立行、独立销售价 | `TestChannelPricingIsolatedPerChannel` |
| 同模型不同区域/部署 | 唯一键隔离，更新互不影响 | `TestUpsertKeepsRegionAndDeploymentIsolated` |
| 解析用完整身份 | 缺字段或候选多行时拒绝 | `TestResolveEffectiveChannelPricingUsesFullIdentity` |
| 渠道删除 | 价格行保留，历史账单引用版本/快照 | 删除渠道不级联删除价格行 |
| 批量写入 | 使用 `row.Provider/Region/DeploymentId` 完整身份 | `service/channel_batch_pricing.go:659` |

## 4. 未覆盖

- Azure/AWS 的“实际路由选中的 deployment”依赖渠道配置字段；若上游路由层
  未把最终 deployment 写入 `ChannelOtherSettings.DeploymentID`，计费侧无法凭空
  推断。该字段的来源属于渠道配置责任，本轮未新增自动发现。
- 历史账单只在 admin 日志中记录价格身份；没有独立的不可变快照表（Phase 7）。

## 5. 验证

```bash
go test ./model/ -run 'TestChannelPricingIsolatedPerChannel|TestUpsertKeepsRegionAndDeploymentIsolated|TestResolveEffectiveChannelPricingUsesFullIdentity' -count=1
```

通过（包含在 `GOWORK=off go test ./...` 的 exit 0 中）。