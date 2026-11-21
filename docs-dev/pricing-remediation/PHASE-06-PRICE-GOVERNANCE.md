# PHASE 06 — 自动同步与价格变更治理

状态：**PARTIALLY_BUILT**
（定时同步、手动同步、互斥、失败记录、人工价保护已实现；
退避重试、差异通知、审核队列 UI 未完整实现）

## 1. 调度现状

| 任务 | 入口 | 触发 |
|---|---|---|
| DreamRouter | `service.DreamRouterUpstreamSyncTask` | 每分钟检查，按渠道计划 |
| 阿里百炼 | `service.BailianUpstreamSyncTask` | 每分钟检查，按渠道计划 |
| Apiko | `controller.ApikoUpstreamSyncTask`（本轮新增，`main.go:201` 启动） | 每分钟检查，按渠道计划 |
| New API 兼容 | `service.GenericUpstreamSyncTask` | 每分钟检查，按渠道计划 |
| 手动立即同步 | 各渠道价格同步接口 | 管理员操作 |

- 渠道计划：`ChannelPricingSchedule{Enabled, Model/Official/ChannelSyncIntervalMinutes}`，
  默认关闭，默认官方价间隔 1440 分钟。
- 互斥：`acquireUpstreamSyncLock` 防止多实例并发；Apiko 另有进程内互斥锁。
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
- Apiko 的模型上下架差异与价格变更历史未形成统一差异报告。
- 多实例同步竞争：依赖文件锁；未验证分布式锁在 NFS/容器卷上的行为。

## 4. 验证

```bash
go test ./controller/ -run Apiko -count=1
go test ./service/ -run 'Sync|Schedule' -count=1
GOWORK=off go test ./...   # exit 0
```

未执行多实例并发同步压测，也未做真实供应商定时触发验证。