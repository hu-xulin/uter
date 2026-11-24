# Uter 定价系统——最新代码审计结论（2026-11-24，HEAD `8c1e9139c`）

审计输入声明的基线 `33def7a5` 落后当前 HEAD 10 个提交，因此本轮逐项重新核验。

| 缺陷 ID | 严重度 | 文件 / 函数 | 当前结论 |
| --- | --- | --- | --- |
| P0-1 | P0 | `controller/channel_uterapi.go` / `CreateUterAPIChannels` | 确认：价格同步失败后渠道仍启用；已修复 |
| P0-2 | P0 | `service/generic_upstream_pricing.go` / `FilterModelNamesByUpstreamGroup` | 确认：按名称推断分组；已替换为授权目录交集 |
| P0-4 | P0 | `controller/channel_draft.go` / `draftPublishBlockers` | 确认：以价格行为基准导致漏检；已改为选中模型差集 |
| P0-5 | P0 | `model/channel_model_pricing.go` / `ChannelUsesScopedPricing` | 确认：行数决定隔离；已加显式定价模式 |
| P0-3 | P0 | `service/bailian_provider.go` | 未核验修复，未实施 |
| P0-6 | P0 | 价格所有权规则 | 未实施 |
| P1-1/P1-2/P1-3 | P1 | 精度 / Provider 标签 / Apiko 残留 | 未实施 |

详细根因与证据见 `UTER-PRICING-ROOT-CAUSE-REPORT.md`；执行见 `UTER-PRICING-EXECUTION-REPORT.md`。
