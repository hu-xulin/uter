# PHASE 06 — 自动同步与价格变更治理

状态：**PARTIALLY_BUILT**
（定时同步、手动同步、互斥、失败记录、人工价保护已实现；
退避重试、差异通知、审核队列 UI 未完整实现）

> 2026-11-23 状态更正：Apiko 已被 XXAPI 替代，`ApikoUpstreamSyncTask` 与
> `controller/upstream_catalog_apiko.go` 已不存在。XXAPI 的创建同步走
> `SyncXXAPIChannelPricing`，定时同步由 `GenericUpstreamSyncTask` 覆盖并重新
> 应用分组倍率。

## 1. 调度现状

| 任务 | 入口 | 触发 |
|---|---|---|
| DreamRouter | `service.DreamRouterUpstreamSyncTask` | 每分钟检查，按渠道计划 |
| 阿里百炼 | `service.BailianUpstreamSyncTask` | 每分钟检查，按渠道计划 |
| XXAPI | 创建时 `service.SyncXXAPIChannelPricing`；定时 `service.GenericUpstreamSyncTask` | 每分钟检查，按渠道计划 |
| New API 兼容 | `service.GenericUpstreamSyncTask` | 每分钟检查，按渠道计划 |
| 手动立即同步 | 各渠道价格同步接口 | 管理员操作 |

- 渠道计划：`ChannelPricingSchedule{Enabled, Model/Official/ChannelSyncIntervalMinutes}`，
  默认关闭，默认官方价间隔 1440 分钟。
- 互斥：`acquireUpstreamSyncLock` / `acquireChannelPricingSyncLock` 防止多实例并发。
- 状态：各 provider 用 option 持久化上次成功时间，重启后不会立即重复全量同步。
- 失败：记录 `common.SysError`，下一轮继续；不会清空已有有效价格。

## 2. 价格变更保护

- `UpsertChannelOfficialPricing` 只覆盖自动派生销售价
  （`source` 前缀匹配 provider），人工价保留。
- 批量调价默认不覆盖人工价（`OverwriteManual=false`）。
- 同步成功后 `PricingVersion` 变化；历史账单引用当时版本。

## 3. 未实现

- 指数退避/最大重试次数：当前是固定下一轮重试。
- 价格上涨/下降/新模型/下架/来源失效/毛利阈值通知：DreamRouter/百炼有差异
  记录结构（`UpstreamPriceChange`），但没有统一通知渠道。
- 审核队列：`NeedsReview` 记录可查询，但缺少“批准/拒绝”状态机与专用处理页。
- XXAPI 的模型上下架差异与价格变更历史尚未形成独立差异报告。
- 多实例同步竞争：依赖数据库锁；未验证锁在跨区域高延迟场景下的行为。

## 4. 验证

```bash
go test ./service/ -run 'XXAPI|Sync|Schedule' -count=1
GOWORK=off go test ./...   # exit 0
```

未执行多实例并发同步压测，也未做真实供应商定时触发验证。