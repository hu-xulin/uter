# Uter 多渠道价格与模型信息架构方案

> 状态：方案讨论稿（待决策，不直接实施）  
> 目标：接入 new-api 聚合渠道、阿里百炼、腾讯云、火山引擎、AWS、Azure、Google Vertex AI 等；按渠道规则同步模型信息、官方原始价、渠道价，并支持渠道级与模型级折扣。  
> 适用计费：按 Token、按次、按秒、按图片、按积分、任务表达式、缓存、图片/音频等。

---

## 1. 目标拆解

### 1.1 必须满足

1. **模型信息**：从每个渠道同步模型列表、上下文长度、模态、端点、能力等，并保留来源与版本。
2. **官方原始价**：记录模型在厂商官网的原始价格（币种、单位、区域、阶梯）。
3. **渠道价**：记录该渠道实际给出的价格/折扣/倍率，支持不同表达方式。
4. **Uter 默认价**：默认与渠道价一致，不额外加价，除非运营显式设置。
5. **渠道统一折扣**：对整个渠道所有模型生效。
6. **模型级折扣/价格**：对某渠道的某个模型单独设置。
7. **折扣叠加**：渠道折扣与模型折扣按明确规则相乘，同时能看到最终价。
8. **可上调/下调**：渠道价是 6 折时，可以调成 7 折，也可以整体调高/调低。
9. **审计与回滚**：每次同步、改价、折扣变更可追溯、可回滚。

### 1.2 不能做的事

- 不能把渠道价、官方价、Uter 售价混成一个字段。
- 不能用浮点数直接做金额乘除。
- 不能在请求中途切换价格版本。
- 不能自动覆盖运营手工设置的模型价格。
- 不能凭空生成未知模型的官方价。

---

## 2. 现状与缺口

### 2.1 已有能力

- `ChannelPriceSetting`：支持渠道级 `ratio` 和模型级 `ratio` / `price`。
- `PricingEngine`：实例默认 + 渠道覆盖（Uter/upstream）。
- `ModelPrice` / `ModelRatio` / `billing_setting`：模型级按次价格、倍率、表达式。
- 任务插件 `usageSchema`：声明 seconds/images/credits/tokens 等计费维度。
- 上游价格同步：可拉取上游价格并选择来源同步。
- 定价问题检测：发现未配置/不兼容/过期价格。

### 2.2 缺口

| 缺口 | 影响 |
|---|---|
| 没有“官方原始价”和“渠道价”分层 | 无法看渠道折扣力度、无法审计渠道成本 |
| 渠道价表达方式不统一 | `x0.6` / `-40%` / `6折` / 固定价无法统一解析 |
| 渠道折扣只乘在 Uter 模型价上 | 不能以渠道价为基础计算 |
| 模型折扣语义不明确 | 不知道是“在渠道价上乘”还是“直接设最终折扣” |
| 插件模型不在 models 表 | 无法在现有模型定价页配置 |
| 多渠道同一模型价格不同 | 公开展示与计费取哪个价格未定义 |
| 价格同步没有版本/审批 | 自动同步可能瞬间改变线上售价 |

---

## 3. 价格分层模型

每个渠道+模型维护五层：

```text
L0 官方原始价 List Price
        │  （厂商官网/官方价格目录）
        ▼
L1 渠道价 Channel Quote
        │  （聚合渠道实际给的价格，可能已经是 6 折）
        ▼
L2 Uter 基础价 Base Price
        │  = L1（默认不额外加价）；可被“模型固定基础价”覆盖
        ▼
L3 渠道调整 Channel Adjustment
        │  整个渠道统一折扣/加价，默认 1.0
        ▼
L4 模型调整 Model Adjustment
        │  单模型折扣/加价/固定价，默认 1.0
        ▼
L5 最终价 Effective Price
           = Base × ChannelAdjustment × ModelAdjustment
           （固定价模式下按第 5 节规则）
```

下游仍保留：

- 用户分组倍率；
- 充值/货币换算；
- 用户月度消费阶梯（UserPriceSetting）；
- 请求规则倍率；
- 任务用量的实际计量。

这些不并入 L3/L4，避免渠道折扣与用户优惠互相污染。

---

## 4. 关键语义

### 4.1 官方原始价

- 来源：厂商官方价格目录、官方 API、维护的官方价格表。
- 字段：模型、区域、币种、单位（USD/1M tokens、CNY/1K tokens、USD/秒、USD/张）、阶梯、生效时间。
- 对聚合渠道（uterroute 等）：如果上游不提供官方价，则使用 Uter 自维护的官方目录；聚合渠道只负责提供渠道价。
- 官方价只用于展示、折扣基准和审计，不直接作为计费价（除非没有渠道价）。

### 4.2 渠道价

渠道价的原始表达可能为：

```text
x0.6
×0.6
*0.6
-40%
60%
6折
六折
0.6
¥0.012 / 1K tokens
$0.003 / 1K tokens
按秒 0.05 USD
按张 0.02 USD
```

解析为：

```text
raw_expression        原始字符串
normalized_amount     十进制金额
normalized_unit       USD/1M tokens、USD/次、USD/秒、USD/张…
normalized_currency   USD
conversion_rate       解析时的汇率快照
parser_version        解析器版本
```

无法解析或存在歧义时，标为 `needs_review`，不自动用于计费。

### 4.3 渠道折扣

```text
channel_multiplier = 0.6   // 6 折
```

- 默认 `1.0`。
- 对所有没有“模型固定价”的模型生效。
- 支持按生效时间、优先级、启停和备注。
- 支持整体上调/下调，例如 0.6 → 0.7。

### 4.4 模型级调整

必须支持三种模式，避免“6 折改成 7 折”产生歧义：

| 模式 | 含义 | 公式 |
|---|---|---|
| `multiplier` | 在渠道调整后的价格上再乘 | final = base × channel × model |
| `target_final_discount` | 运营直接填写希望达到的最终折扣（相对官方价） | model = target / (quote_ratio × channel)；final = target |
| `fixed_base` | 指定模型基础价，替代渠道价；渠道折扣仍生效 | final = fixed_base × channel |

推荐 UI 默认展示“目标最终折扣”，后台保存为 `multiplier` 或 `target_final_discount`，并在保存前显示最终价。

### 4.5 示例：uterroute

假设官方价 100 元/单位，uterroute 渠道价为：

```text
原始表达式：-40%（6 折）
渠道价：60
```

#### 场景 A：渠道折扣 6 折，模型折扣 7 折，两者相乘

```text
final = 100 × 0.6(渠道价) × 0.6(渠道折扣) × 0.7(模型折扣)
      = 25.2
```

最终相当于官方 2.52 折。

#### 场景 B：希望最终是 7 折（不是乘出 4.2 折）

运营在模型上选择 `target_final_discount = 0.7`：

```text
target = 0.7 × 100 = 70
系统计算 model_multiplier = 0.7 / (0.6 × channel_multiplier)
最终价 = 70
```

如果渠道折扣是 0.6，则：

```text
model_multiplier = 0.7 / (0.6 × 0.6) = 1.9444
final = 100 × 0.6 × 0.6 × 1.9444 = 70
```

#### 场景 C：只把渠道价 6 折上调到 7 折

渠道价本身是 6 折，渠道折扣保持 1.0，模型选择 `target_final_discount = 0.7`：

```text
final = 70
```

这就是“在渠道价基础上上调到 7 折”。

#### 场景 D：固定模型价

```text
fixed_base = 80
channel_multiplier = 0.6
final = 48
```

如果希望固定价是最终价：

```text
fixed_final = 80
final = 80（不再乘渠道折扣）
```

两种固定价语义必须在 UI 明确选择，不能默认。

---

## 5. 优先级与公式

### 5.1 解析顺序

```text
1. 渠道+模型 policy（模型级）
2. 渠道 policy（渠道级）
3. 渠道 quote（渠道价）
4. 官方 list price
5. Uter builtin / legacy 模型价
6. 无价 → 标记 Pricing Issue，拒绝计费或按策略阻止请求
```

### 5.2 公式

```text
base =
  fixed_base                 // 模型固定基础价
  ?? channel_quote           // 渠道价
  ?? official_list           // 官方价
  ?? legacy_model_price      // 现有 ModelPrice/比例

channel_factor = channel_policy.multiplier ?? 1
model_factor   = model_policy.multiplier ?? 1

if model_policy.mode == target_final_discount:
    model_factor = target / (channel_quote_ratio × channel_factor)

effective = base × channel_factor × model_factor
```

固定最终价：

```text
if model_policy.mode == fixed_final:
    effective = fixed_final
```

### 5.3 计费形状

价格不是永远一个数字：

- 按 Token：输入/输出/缓存/图片/音频分别有价格；
- 按次：固定价；
- 按秒/张/积分：任务插件 usage；
- 阶梯表达式：tier(...)；
- 缓存 TTL：1h/12h；
- 区域/分辨率/音频：同一模型多个价格。

因此 policy 不能只存 `float64`，必须存：

```text
pricing_shape:
  mode: token | per_call | task_expr | tiered_expr
  unit_prices: { input, output, cache, ... }
  expression: ...
  factor: 渠道/模型折扣因子
```

折扣因子作用于**最终计费金额**，不重写厂商表达式，避免破坏阶梯/条件。

---

## 6. 数据模型

建议新增以下表（GORM，SQLite/MySQL/PostgreSQL 兼容；金额用字符串十进制，避免浮点误差）：

### 6.1 `provider_price_catalog`

```text
id
provider_key              // openai / aliyun / tencent / volcengine / aws / azure / vertex / uterroute
model_key
region
currency                  // USD / CNY
unit                      // 1M_token / 1K_token / call / second / image / credit
amount_decimal            // string
billing_shape             // token / per_call / tiered / task_expr
tier_json                 // 阶梯/条件价格
source_type               // official_api / official_page / manual
source_url
effective_at
fetched_at
version
raw_hash
```

### 6.2 `channel_model_catalog`

```text
id
channel_id
provider_model            // 上游真实模型名
canonical_model           // Uter 规范模型名
context_length
input_modalities
output_modalities
endpoints
capabilities_json
source
fetched_at
hash
```

### 6.3 `channel_price_quote`

```text
id
channel_id
provider_model
canonical_model
currency
unit
raw_expression            // x0.6 / -40% / 6折 / ¥0.012/1K
normalized_amount         // decimal string
normalized_unit
fx_rate                   // 到 USD 的汇率快照
official_price_id         // 对应官方价，可空
source_type
source_url
fetched_at
quote_version
parser_version
status                    // ok / needs_review / stale / removed
raw_payload_hash
```

### 6.4 `channel_pricing_policy`

```text
id
channel_id
model_key                 // NULL = 渠道级
scope                     // channel / model
mode                      // multiplier / target_final_discount / fixed_base / fixed_final
value_decimal             // 0.6 / 0.7 / 80
currency
effective_from
effective_to
enabled
priority
reason
created_by
version
```

约束：

```text
channel_id + model_key + scope + effective_from 唯一
```

### 6.5 `pricing_resolution_snapshot`

```text
id
channel_id
model_key
quote_id
channel_policy_id
model_policy_id
official_amount
quote_amount
channel_factor
model_factor
effective_amount
currency
fx_rate
formula
resolved_at
hash
```

请求日志写入 `pricing_snapshot_id`，保证预扣与结算使用同一版价格。

### 6.6 `pricing_sync_run`

```text
id
channel_id
source
started_at
finished_at
status
added / changed / removed / failed counts
diff_json
operator
report
```

---

## 7. 渠道适配器

统一接口：

```text
PriceSource
  ListModels(ctx) -> []ModelInfo
  ListOfficialPrices(ctx, models) -> []OfficialPrice
  ListChannelQuotes(ctx, models) -> []ChannelQuote
```

### 7.1 new-api 聚合渠道（uterroute 等）

- 认证：`Authorization: Bearer <channel key>`；
- 模型：`GET /v1/models` 或上游 `/api/models`；
- 渠道价：`GET /api/pricing`、`/api/ratio_config` 或上游声明的价格接口；
- 官方价：
  - 上游若返回 official/list price，优先采用；
  - 否则用 Uter 官方目录按 canonical model 匹配；
- 解析：
  - `model_ratio`、`completion_ratio`、`model_price`、`billing_expr`；
  - 折扣表达式 `x0.6` / `-40%` / `6折`；
  - 分组倍率是否已含在渠道价中，必须在源配置中明确，避免二次折扣。

### 7.2 阿里百炼

- 模型列表：百炼模型目录；
- 官方价：官方计费文档/价格 API，CNY/1K tokens、图片/秒；
- 渠道价：官方价 × 商务折扣（若合同价），或手工维护；
- 区域：北京/新加坡等，价格可能不同；
- 币种：CNY，需按汇率快照转 USD。

### 7.3 腾讯云 / 火山引擎

- 官方价：按模型、区域、输入/输出、图片/视频时长；
- 火山方舟：Seedream/Seedance 按图片/Token/秒，需保留 usageSchema；
- 渠道价：合同折扣或代理折扣；
- 任务模型走任务插件 usageSchema。

### 7.4 AWS Bedrock / Azure OpenAI / Vertex AI

- 官方价：区域化、按 1K/1M tokens、图片/音频；
- 币种：USD；
- Azure 部署名与模型名映射；
- Vertex 区域（global/us/eu）与 publisher（Google/Anthropic）；
- 某些价格来自官方价格 API，某些需维护目录；
- 渠道折扣单独配置，不修改官方目录。

### 7.5 Provider 插件扩展

现有 provider 插件可增加可选 `pricing` 部件：

```js
pricing: {
  currency: "USD",
  listPrices: { ... },
  channelDiscount: "x0.8",
  units: { ... }
}
```

插件只返回原始表达与来源；归一化与最终解析由 Uter 内核完成，避免每个插件各自实现金额规则。

---

## 8. 同步流程

```text
1. 读取渠道价格源配置（base_url / key / provider / region）
2. 拉取模型列表
3. 拉取官方价（可选）
4. 拉取渠道价/折扣
5. 解析、归一化、别名匹配
6. 与上一版本 diff
7. 标记 added / changed / removed / needs_review
8. 人工确认或按策略自动应用
9. 写入 quote/policy 版本
10. 失效解析缓存
11. 记录审计与告警
```

要求：

- 幂等；
- 不覆盖手工 policy；
- 价格变动超过阈值（如 ±20%）默认进入待确认；
- 删除的模型只标记 `stale`，不立刻删除历史订单价格；
- 同步失败保留上一版，不影响线上计费；
- 支持手动“立即同步”和定时同步（如每 6 小时）。

---

## 9. 运行时解析

每个请求开始时解析一次：

```text
channel + model + now
  -> quote（当前有效版本）
  -> channel policy
  -> model policy
  -> pricing_snapshot
  -> PriceData / task PriceData
```

预扣与结算必须使用同一个 `pricing_snapshot_id`。

对于任务表达式：

- 表达式本身保持不变；
- 折扣因子作用于最终 `quota`；
- 结算时同样应用快照因子；
- 记录 `effective_factor` 和 `snapshot_id` 到日志。

---

## 10. 管理与展示

### 10.1 渠道详情 → 定价

表格列：

```text
模型
官方价
渠道价（原始表达）
渠道价（USD）
渠道折扣
模型调整
最终价
最终折扣
同步状态
更新时间
```

操作：

- 渠道统一折扣：输入 6 折 / 0.6 / -40%，三者等价；
- 模型调整：跟随渠道 / 目标最终折扣 / 固定基础价 / 固定最终价；
- 批量设置、清除、复制到其他渠道；
- 价格预览：输入 tokens/秒/张/积分，计算最终费用；
- 同步差异：新增/变更/删除；
- 历史版本与回滚。

### 10.2 公开展示

- 管理员看到：官方价、渠道价、成本、最终价、折扣、毛利。
- 用户看到：Uter 最终价（最低价/区间/当前渠道价），不显示渠道成本。
- 多渠道同一模型：默认展示所有启用渠道的最低最终价，并标注可用渠道；或按运营选定“展示渠道”。

### 10.3 定价问题

- `no_official_price`：缺官方价；
- `no_channel_quote`：缺渠道价；
- `needs_review`：表达式无法解析；
- `incompatible_shape`：价格形状与 usageSchema 不匹配；
- `stale`：模型已从渠道移除；
- `below_floor`：最终价低于保护下限。

---

## 11. 计费安全

- 金额全部用 `decimal` / 字符串存储，计算使用现有 `common.QuotaFromDecimal`、`QuotaRound`、`QuotaFromFloatChecked`；
- 禁止 `int(float64)`；
- 最终价不能为负、NaN、Inf；
- 设置最低保护价/最高价；
- 价格版本在请求期间不可变；
- 预扣、结算、日志、任务结算使用同一快照；
- 同步与改价写审计日志（操作人、来源、旧值、新值、原因）；
- 多实例通过 `node sync` 或版本号刷新缓存；
- SQLite/MySQL/PostgreSQL 三库测试。

---

## 12. API 草案

```text
GET    /api/channel/:id/pricing
POST   /api/channel/:id/pricing/sync
GET    /api/channel/:id/pricing/quotes
PUT    /api/channel/:id/pricing/policy
GET    /api/channel/:id/pricing/preview
GET    /api/channel/:id/pricing/history
GET    /api/pricing/catalog?provider=&model=
GET    /api/pricing/effective?channel=&model=
```

权限：仅管理员；价格同步密钥单独加密；访问令牌 scope 细分。

---

## 13. 分阶段实施

### Phase 1：基础架构 + uterroute

- 新增数据表与解析器；
- 渠道定价页面；
- 渠道统一折扣、模型目标折扣/固定价；
- new-api 聚合渠道适配器；
- 预览、同步 diff、审计；
- 与现有 `ChannelPriceSetting` 兼容。

### Phase 2：阿里百炼 + 腾讯 + 火山

- 官方价格目录适配；
- CNY 汇率快照；
- 图片/视频/任务模型 usageSchema；
- 区域价格。

### Phase 3：AWS / Azure / Vertex

- 区域化价格；
- 模型别名/部署名映射；
- USD 官方目录；
- 渠道折扣。

### Phase 4：任务插件与高级计费

- 任务表达式因子；
- 缓存/图片/音频/阶梯；
- 自动同步与审批；
- 多渠道展示策略。

---

## 14. 测试与验收

- 解析器单测：`x0.6`、`-40%`、`60%`、`6折`、`¥0.012/1K`、非法输入；
- 解析优先级单测：官方/渠道/渠道折扣/模型折扣/固定价；
- 计费回归：预扣=结算、无负数、溢出、任务表达式；
- 同步幂等、并发、回滚；
- 三库迁移与查询；
- UI 预览与实际账单一致；
- 价格同步失败不影响现有价格；
- 多渠道同模型按实际渠道计费；
- 7 语言与 UDS 设计门禁。

---

## 15. 需要你决策的事项

| 编号 | 决策 | 建议 |
|---|---|---|
| D1 | 模型折扣默认是“相乘”还是“目标最终折扣” | 两者都支持；UI 默认目标最终折扣，底层保存为乘数 |
| D2 | 固定模型价是“基础价”还是“最终价” | 默认基础价，渠道折扣仍生效；另提供固定最终价 |
| D3 | 渠道折扣是否作用于固定模型价 | 建议默认作用；可关闭 |
| D4 | 多渠道同模型公开价 | 展示最低最终价 + 渠道；管理员看全部 |
| D5 | 同步是否自动生效 | 默认差异审批；超过阈值禁止自动 |
| D6 | 聚合渠道无官方价时 | 用 Uter 官方目录，不阻塞渠道价 |
| D7 | 币种与汇率 | 官方/渠道价保留原币，按日汇率快照转 USD |
| D8 | 最低保护价 | 建议按模型配置 floor，低于 floor 阻止 |
| D9 | 渠道折扣与用户分组/阶梯 | 保持独立，依次相乘，不合并 |
| D10 | 任务插件价格形状 | 用统一 `pricing_shape`，折扣作用最终金额 |

---

## 16. 结论

核心不是“同步一个价格数字”，而是建立：

```text
官方价 → 渠道价 → 渠道调整 → 模型调整 → 最终价
```

四层可追溯、可版本化、可回滚的价格链。  
这样既能表达 uterroute 的 `-40%`，也能在其上做渠道 6 折、模型 7 折、固定价、上调/下调，并保证 Uter 的计费与上游渠道一致。