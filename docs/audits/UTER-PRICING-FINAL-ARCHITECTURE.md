# Uter 定价系统——本轮落地架构（PARTIAL）

本轮未重建平行计费系统，只在现有 New API 计费体系上补出四个强制门禁。

## 渠道定价模式（本轮新增）

| 模式 | 行为 |
| --- | --- |
| `CHANNEL_SCOPED_PENDING` | 禁止计费；等待价格配置与验证 |
| `CHANNEL_SCOPED_ACTIVE` | 只允许本渠道已配置价格；缺价不回退 |
| `GLOBAL_LEGACY` | 明确允许旧版全局价格 |
| 空值 | 未打标签的存量渠道，保留历史行数推断 |

模式存在 `relaykit/dto.ChannelOtherSettings.PricingMode`（渠道 `settings` JSON），无需新增数据库列。Token、按次、任务三条计费入口统一通过 `model.ChannelScopedPricingRequired` 判定。

## Uter.api 创建状态流（本轮落地）

```
DRAFT(status=0, PENDING)
  -> 认证并发现每个 Key 可见模型（交集）
  -> /api/pricing 的 enable_groups ∩ Key 可见模型
  -> 落库渠道（显式 status=0）
  -> 同步价格 + AutoVerify
  -> 逐模型验证 configured / 可执行 / 有版本
  -> ACTIVE(status=1, CHANNEL_SCOPED_ACTIVE)
任意失败 -> 保持禁用 + PENDING + pricing_error
```

草稿向导发布共用同一模式升级规则：发布前以选中模型为基准校验，通过后升级 ACTIVE。

## 币种溯源（本轮落地）

`ChannelOfficialPricing` 与 `ChannelPricingRawComponent` 同时保存 `source_currency`、`normalized_currency`、`currency_inferred`、汇率与来源。`Currency` 仅为兼容旧数据保留为原始币种，不再用于推断标准化金额。百炼目录没有币种字段，地域推断结果会明确标记；币种无法确认或 CNY 无有效汇率时进入 `needs_review`。

## 仍缺的架构层

完整状态机（CONNECTED/CATALOG_SYNCED/PRICING_SYNCED/SALE_CONFIGURED/PRICING_VERIFIED）、同步 RunID 与版本绑定、对账系统：仍未实施。`pricing_owner` 已落地并通过回归；财务金额计算层已改用 decimal，但数据库列、定价 JSON 字段与表达式输入仍为 float64，完整十进制结构迁移未实施。
