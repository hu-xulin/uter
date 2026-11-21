# PHASE 12 — 生产级安全与性能

状态：**PARTIALLY_BUILT**
（并发写保护、版本冲突、价格校验、表达式编译校验已实现；缺分布式锁验证与压测）

## 1. 并发与一致性

- 同步：`acquireUpstreamSyncLock` 跨实例互斥；Apiko 额外进程内互斥锁。
- 批量写入：写入前比较 `PricingVersion`，行已变化则返回冲突、不写。
- 价格更新：`SetChannelInternalPricingWithAudit` 事务写价格 + 历史。
- 缓存：写后失效渠道价缓存；读取有 30 秒 TTL。
- 已结算账单不因价格缓存变化而改变。

## 2. 输入与数值安全

- 价格指针统一校验：`validPricePointer` 拒绝 NaN/Inf/负数。
- 批量规则值限制：非有限值、负数（fixed/discount/multiply）拒绝。
- 最低毛利率限制 0..∞ 有限值。
- 表达式必须 `billingexpr.CompileFromCache` 通过才能成为销售价。
- 配额转换使用受检函数与饱和边界，不会溢出成负扣费。
- 思考/图片/多模态销售价必须非负，未设置不补零。

## 3. 价格保护

- 同步只覆盖自动派生销售价；人工价保留。
- official basis 拒绝 `CHANNEL_RATIO`/`UNKNOWN` 类型，防止把渠道倍率当官方价。
- 单位未知的 `official_price` 不自动成为售价。

## 4. 未实现/未验证

- 分布式锁在容器卷/多节点上的正确性未验证。
- 无并发批量调价压测；无同步任务超时/限流指标。
- 无价格表规模（百万行）查询性能测试。
- 无恶意表达式资源消耗测试（沙箱编译已有超时/复杂度限制，未做压力验证）。
- 价格回滚的事务边界只在单库测试；跨库未验证。

## 5. 验证

```bash
go test ./model -run 'Conflict|Version|Concurrent|Isolated' -count=1   # 通过
go test ./service -run 'BatchPricing.*(Strict|Approval|Version)' -count=1
GOWORK=off go test ./...                                               # exit 0
```

以上为功能级验证，不构成生产压测结论。