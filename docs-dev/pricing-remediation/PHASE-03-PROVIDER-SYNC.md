# PHASE 03 — 供应商模型与价格同步

状态：**PARTIALLY_BUILT**
（DreamRouter / 百炼 / Apiko / New API 兼容已实现并通过本地测试；
其余云厂商无公开价格接口或授权凭据，标记 EXTERNAL_BLOCKED，不伪造自动同步）

## 1. 统一 Adapter 注册

`service/upstream_provider.go:21`：

```go
type UpstreamProviderAdapter interface {
    Descriptor() UpstreamProvider
    Fetch(ctx context.Context, cfg UpstreamFetchConfig) (any, error)
}
```

- 已注册：DreamRouter、阿里百炼、New API 兼容、手动定价供应商。
- `UpstreamProviders()` 返回真实能力声明。
- 能力结构（`service/upstream_dreamrouter.go:51`）：模型发现、元数据、官方价、
  渠道价、折扣、区域价、阶梯价、媒体价、定时同步。

未实现的一体化方法（FetchContractPricing / FetchRegionalPricing 等）没有独立
函数签名，能力由各 provider 的 Fetch 结果与 Descriptor 表达能力体现。此差异
记录为架构债，不影响当前已接入供应商的正确性。

## 2. 各供应商状态

| 供应商 | 模型目录 | 官方价 | 渠道/折扣价 | 自动同步 | 证据 |
|---|---|---|---|---|---|
| DreamRouter | `/api/pricing` | 有绝对价时用绝对价；仅倍率时保留倍率语义 | 按折扣组反推 | `DreamRouterUpstreamSyncTask` | `service/upstream_dreamrouter.go` |
| 阿里百炼 | `/api/v1/models` 分页 | 解析 CNY 价格项并转 USD | 目录报价作为渠道价 | `BailianUpstreamSyncTask` | `service/bailian_provider.go` |
| Apiko | `/api/public/models?billing=all` | 公开 USD 价/表达式 | 公开目录价 | **本轮新增** `ApikoUpstreamSyncTask` | `controller/upstream_catalog_apiko.go:819` |
| New API 兼容 | `/api/pricing` | 仅在有绝对价时 | ratio 标记为 `CHANNEL_RATIO` | `GenericUpstreamSyncTask` | `service/generic_upstream_pricing.go` |
| OpenAI / Anthropic / Gemini | 无授权价格接口 | 人工维护 | 人工 | 无 | EXTERNAL_BLOCKED |
| Azure OpenAI | 区域/部署价需订阅 | 人工 | 人工 | 无 | EXTERNAL_BLOCKED |
| AWS Bedrock | 定价页/需凭据 | 人工 | 人工 | 无 | EXTERNAL_BLOCKED |
| 腾讯云 / 火山引擎 | 需账号或定价页 | 人工 | 人工 | 无 | EXTERNAL_BLOCKED |

## 3. Apiko 自动同步

- `syncApikoChannelPricing` 由手动接口与后台任务共用，保证两条路径写入一致。
- 后台任务每分钟检查一次；只有渠道启用了 `ChannelPricingSchedule` 才运行，
  按 `official_sync_interval_minutes` 节流；状态持久化在
  `ApikoUpstreamSyncState` option。
- 手动价保护：仅覆盖 `source` 以 `apiko-official` 开头的派生销售价。
- 全局互斥锁避免手动与后台并发写同一批记录。

## 4. 未实现

- OpenAPI/云厂商官方价格抓取（无公开稳定接口或凭据）。
- 供应商合同采购价同步（无接口）。
- 区域/部署级价格自动发现（Azure/AWS）。
- 同步失败退避与最大重试次数：当前依赖下一轮定时重试并记录 `SysError`。

## 5. 验证

```bash
go test ./controller/ -run Apiko -count=1       # 通过
go test ./service/ -run Generic -count=1        # 通过
GOWORK=off go test ./...                        # exit 0
```

未执行真实供应商接口调用（无测试凭据），因此不声明真实验证通过。