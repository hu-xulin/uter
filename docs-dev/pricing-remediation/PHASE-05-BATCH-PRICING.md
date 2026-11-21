# PHASE 05 — 批量定价与毛利保护

状态：**PARTIALLY_BUILT → 本轮补齐维度**
（维度、逐档/逐维毛利、版本冲突、回滚已实现；按供应商/区域/部署/价格来源/
计费模式的选择器尚未全部暴露为批量选项）

## 1. 本轮修复的核心缺陷

修复前 `BatchPricingDimensions` 只有 9 个维度，官方侧已有的图片、Thinking、
多模态价格无法通过批量规则调整，也不参与逐维毛利检查。

修复后（`service/channel_batch_pricing.go:237`）增加：

```
image_input, thinking_input, thinking_output, thinking_cache,
thinking_create_cache, thinking_image_input,
multi_input_output, thinking_multi_input_output
```

贯通点：

1. `model.ChannelInternalPricing` / `ChannelInternalPricingTier` 新增对应字段。
2. 平铺 token 价设置这些字段时自动生成可执行表达式
   （`model/channel_model_pricing.go:603`）。
3. 批量基础价从官方 tier、渠道价或当前销售价完整读取这些维度。
4. 批量规则按维度选择性应用；未选中的维度保留原价（测试断言 input 不变）。
5. 预览返回新维度金额与逐维毛利。
6. 写入后 `ResolveEffectiveChannelPricingFor` 的表达式包含新价格。

## 2. 已有能力

- 选择：模型列表、模型前缀、模型分类。
- 方式：固定金额、折扣、加价、乘法、保持原价。
- 预览：`dry_run` 不写库；显示预计售价、变化百分比、采购对比、毛利率。
- 毛利保护：`strict`（整批阻止）、`partial`（跳过亏损模型）、`approval`
  （带审批备注写入）。
- 逐档检查：每个 `BatchPricingTier` 独立参与毛利比较。
- 版本冲突：`ExpectedVersions` 与行 `PricingVersion` 不一致时返回冲突，不写入。
- 身份：写入使用 `(channel, provider, region, deployment, model)`。
- 历史与回滚：`SetChannelPricingWithHistory` + 回滚接口
  `POST /api/channel/:id/model_pricing/history/:history_id/rollback`。

## 3. 未实现/限制

- 按供应商、区域、部署、计费模式、价格来源、模型能力的选择器：当前批量 API
  只接受 models/prefixes/categories。渠道内多区域/多部署记录可通过模型名选中，
  但不能单独按部署过滤；属于接口缺口，未在市场界面提供。
- 阶梯规则调价（按档位分别给不同规则）：当前一条规则统一作用于所有档位。
- 毛利“成本”优先使用手工合同成本（`purchase_pricing`）；没有时回退到上游公开
  报价，但 `CostVerified/MarginVerified=false`。只有合同成本且标记 verified 时
  才可表述为已验证成本毛利。

## 4. 验证

```bash
go test ./service/ -run 'TestApplyChannelBatchPricing|TestBatchPricing|TestResolveBatchBasePrice|TestResolveCurrentBatchBasePrice' -count=1
```

全量 `GOWORK=off go test ./...` exit 0。新增用例：

- `TestBatchPricingScalesThinkingAndImageDimensions`：只调 thinking_output，
  input/image 保持不变，写入表达式为 `rt > 0 ? 4.5 : 6`。
- `TestResolveCurrentBatchBasePriceCarriesModalityDimensions`：8 个新维度全部读取。
- `TestResolveBatchBasePriceRejectsChannelRatioAsOfficial`：渠道倍率不能作为官方基准。