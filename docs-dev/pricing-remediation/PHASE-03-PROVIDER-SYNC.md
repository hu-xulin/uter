# PHASE 03 — 供应商模型与价格同步

状态：**PARTIALLY_BUILT**
（Uter Route / 百炼 / Uter.api / New API 兼容已实现并通过本地测试；
其余云厂商无公开价格接口或授权凭据，标记 EXTERNAL_BLOCKED，不伪造自动同步）

> 2026-11-23 状态更正：Apiko 已由 Uter.api 替代。运行时代码、路由、后台任务和
> 渠道类型均已删除；仅保留 `apiko-` 价格来源前缀用于识别并审计历史价格行。
> 本文中 Apiko 的旧描述仅作为历史记录，不再是当前能力声明。

## 1. 统一 Adapter 注册

`service/upstream_provider.go:21`：

```go
type UpstreamProviderAdapter interface {
    Descriptor() UpstreamProvider
    Fetch(ctx context.Context, cfg UpstreamFetchConfig) (any, error)
}
```

- 已注册：UterRoute、阿里百炼、Uter.api（New API 兼容价格文档）、手动定价供应商。
- `UpstreamProviders()` 返回真实能力声明。
- 能力结构（`service/upstream_uterroute.go:51`）：模型发现、元数据、官方价、
  渠道价、折扣、区域价、阶梯价、媒体价、定时同步。

未实现的一体化方法（FetchContractPricing / FetchRegionalPricing 等）没有独立
函数签名，能力由各 provider 的 Fetch 结果与 Descriptor 表达能力体现。此差异
记录为架构债，不影响当前已接入供应商的正确性。

## 2. 各供应商状态

| 供应商 | 模型目录 | 官方价 | 渠道/折扣价 | 自动同步 | 证据 |
|---|---|---|---|---|---|
| Uter Route | `/api/pricing` | 有绝对价时用绝对价；仅倍率时保留倍率语义 | 按折扣组反推 | `UterRouteUpstreamSyncTask` | `service/upstream_uterroute.go` |
| 阿里百炼 | `/api/v1/models` 分页 | 解析 CNY 价格项并转 USD | 目录报价作为渠道价 | `BailianUpstreamSyncTask` | `service/bailian_provider.go` |
| Uter.api | `/api/pricing`（需渠道 API Key） | 上游表达式 | 分组倍率后的渠道价 | 创建时 `SyncUter.apiChannelPricing`；定时走 `GenericUpstreamSyncTask` | `service/Uter.api_catalog.go` |
| New API 兼容 | `/api/pricing` | 仅在有绝对价时 | ratio 标记为 `CHANNEL_RATIO` | `GenericUpstreamSyncTask` | `service/generic_upstream_pricing.go` |
| OpenAI / Anthropic / Gemini | 无授权价格接口 | 人工维护 | 人工 | 无 | EXTERNAL_BLOCKED |
| Azure OpenAI | 区域/部署价需订阅 | 人工 | 人工 | 无 | EXTERNAL_BLOCKED |
| AWS Bedrock | 定价页/需凭据 | 人工 | 人工 | 无 | EXTERNAL_BLOCKED |
| 腾讯云 / 火山引擎 | 需账号或定价页 | 人工 | 人工 | 无 | EXTERNAL_BLOCKED |

## 3. Uter.api 自动同步

- `SyncUter.apiChannelPricing` 必须携带渠道 API Key；缺少可用密钥时直接失败，
  不再请求匿名价格接口。
- 价格身份为渠道、分组、模型三者组合；分组倍率来自上游 `/api/pricing`
  的 `group_ratio`，渠道价 = 上游表达式 × 分组倍率。
- 优特售价 = 渠道价 × 1.10（未人工配置时）；人工价与批量价不被同步覆盖。
- 定时同步复用 `GenericUpstreamSyncTask`，并重新应用分组倍率；创建路径使用
  Uter.api 专属同步函数，两条路径写入同一价格结构。
- 跨实例互斥使用 `system_task_locks`；手动与后台同步不会并发写同一渠道。
- `apiko-` 前缀仅保留在自动价格来源识别列表中，用于历史行审计与迁移，
  不对应任何运行时 Provider。

## 4. 未实现

- OpenAPI/云厂商官方价格抓取（无公开稳定接口或凭据）。
- 供应商合同采购价同步（无接口）。
- 区域/部署级价格自动发现（Azure/AWS）。
- 同步失败退避与最大重试次数：当前依赖下一轮定时重试并记录 `SysError`。

## 5. 验证

```bash
go test ./service/ -run 'Uter.api|Generic' -count=1  # 通过
GOWORK=off go test ./...                          # exit 0
```

未执行真实供应商接口调用（无测试凭据），因此不声明真实验证通过。