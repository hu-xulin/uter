# PHASE 02 — 统一价格维度注册表

状态：**IMPLEMENTED_AND_VERIFIED**（数据库、后端、表达式、批量、前端列表一致；
图片分辨率/画质、视频分档等供应商特有维度仍按审核处理）

## 1. 单一维度清单

`service/channel_batch_pricing.go:232` `BatchPricingDimensions`：

```
input, output, cache_read, cache_write,
audio_input, audio_output,
image_input, thinking_input, thinking_output, thinking_cache,
thinking_create_cache, thinking_image_input,
multi_input_output, thinking_multi_input_output,
per_call, per_second, per_minute
```

`model.ChannelInternalPricing` / `ChannelInternalPricingTier` 新增同名字段：

| 维度 | JSON 字段 | 表达式变量 |
|---|---|---|
| input | `input_per_million_usd` | `p`（思考模式用 `rt > 0` 选思考输入价） |
| output | `output_per_million_usd` | `c`（思考/多模态按条件选价） |
| cache_read | `cache_per_million_usd` | `cr` |
| cache_write | `create_cache_per_million_usd` | `cc` |
| audio_input | `audio_input_per_million_usd` | `ai` |
| audio_output | `audio_output_per_million_usd` | `ao` |
| image_input | `image_input_per_million_usd` | `img` |
| thinking_input | `thinking_input_per_million_usd` | `p * (rt > 0 ? ... )` |
| thinking_output | `thinking_output_per_million_usd` | `c * (rt > 0 ? ... )` |
| thinking_cache | `thinking_cache_per_million_usd` | `cr * (rt > 0 ? ... )` |
| thinking_create_cache | `thinking_create_cache_per_million_usd` | `cc * (rt > 0 ? ... )` |
| thinking_image_input | `thinking_image_input_per_million_usd` | `img * (rt > 0 ? ... )` |
| multi_input_output | `multi_input_output_per_million_usd` | `c * (img > 0 ? ... )` |
| thinking_multi_input_output | `thinking_multi_input_output_per_million_usd` | 组合条件 |
| per_call / per_second / per_minute | `per_call_usd` / `per_second_usd` / `per_minute_usd` | 任务计费路径 |

官方侧 `model.ChannelPricingTier` 原有字段（image/thinking/multi/audio）保持不变，
百炼同步直接填充。

## 2. 表达式生成

- `NormalizeChannelInternalPricing`：平铺 token 价只要设置了任一思考/图片/多模态
  维度，就生成可执行 `BillingExpr`（`model/channel_model_pricing.go:603`）。
- `buildFlatInternalExpression`（:735）：单档表达式。
- `buildInternalTierExpression`（:828）：多档表达式，逐档调用
  `tierTokenExpressionTerms`，保留 `len <= N` 阶梯条件。
- 未设置的维度不出现，不会按文本价补零。
- 编译期 `rt` 变量注册修复（`pkg/billingexpr/compile.go:127`），否则思考价表达式
  无法通过编译。

## 3. 前后端一致性

- 批量面板维度勾选：`web/src/features/channels/components/channel-pricing-panel.tsx:116`
  新增 8 个维度。
- 预览列展示：同一文件预览表格逐维显示 `/1M` 价格。
- 新 i18n 键 7 个，7 个语言全部翻译，`bun run i18n:sync` 报告 0/0/0（zh 的 1 条
  为 “Sync Apiko models” 已翻译但启发式误报）。

## 4. 明确 UNSUPPORTED 的维度

- 图片分辨率/画质矩阵、视频分辨率/时长组合：官方侧以多档 `ChannelPricingTier` 或
  表达式保存；无法无损压成平铺销售价的记录进入 `NeedsReview`，不猜测。
- `per_request` / `per_task`：当前任务计费以 `per_call` 表达，未单列维度。

## 5. 验证

```bash
go test ./model/ -run TestNormalizeModalityPricesBuildExpression -count=1
go test ./service/ -run TestBatchPricingScalesThinkingAndImageDimensions -count=1
```

均通过，断言了 `img *`、`rt > 0 ? ...`、维度选择性调价与写入后的表达式。