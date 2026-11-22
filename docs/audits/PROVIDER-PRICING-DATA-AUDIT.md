# PROVIDER PRICING DATA AUDIT — DreamRouter / 阿里百炼 / XXAPI

- 审计基线：`0c5368177` + 本轮未提交整改（main，无分支）
- 审计日期：2026-11-22
- 数据来源：真实上游接口 + 本地 `one-api.db` 只读查询
- 结论：**PARTIALLY_VERIFIED**；发现并修复多项计价口径问题，仍有需人工审批的数据库状态

## 1. DreamRouter

真实请求：`/api/pricing` 成功。

| 指标 | 结果 |
|---|---|
| 上游模型 | 86 |
| 折扣组 | 44，组覆盖 6 |
| 渠道 32 记录 | 84 |
| 可执行内部价 | 52（44 表达式 + 8 绝对价） |
| 待审核/不可计费 | 32（24 RATIO_ONLY + 8 HISTORICAL_SNAPSHOT） |
| 内部价执行失败 | 0 |

发现与修复：

1. **多档表达式被压平**：原解析只保留首个 `p/c/cr` 系数。现完整保留表达式，
   折扣以 `fixed()` 内缩放或整体乘数方式应用，所有档位参与计费。
2. **待审核仍可计费**：`NeedsReview=true` 时不再返回内部售价；
   `UpsertChannelOfficialPricing` 统一硬门禁，review 行不会被置为 `configured`。
3. **倍率语义**：`RATIO_ONLY`/`HISTORICAL_SNAPSHOT` 不再自动生成售价；
   记录 `PriceKind` 与 `RatioBasis`，仅作参考。
4. **模型元数据**：8 个缺失，自动补全成功 2 个；`seedance-2.0*` 等 6 个
   上游目录暂无资料，保留缺失，不伪造描述。

## 2. 阿里百炼

真实请求：渠道 31 的 `/api/v1/models` 分页成功。

| 指标 | 结果 |
|---|---|
| 上游目录 | 275 模型，266 有价格，940 条参考价 |
| 区域 | cn-beijing |
| 渠道 31 模型 | 23 |
| 新解析记录 | 17（6 个渠道模型未在目录中匹配） |
| 可生成内部价 | 15 |
| 待审核 | 2（多个 cache read / cache creation 价格冲突） |
| 内部价执行失败 | 0 |
| 渠道元数据缺失 | 0 |
| 库内历史遗留行 | 158（其中 136 行不在当前渠道模型列表，保留历史） |

发现与修复：

1. 补充 `dashscope-us.aliyuncs.com` → `us-east-1`；未知区域不再默认北京，
   返回 UNSPECIFIED 并阻止价格记录生成。
2. 未知区域不再推断币种。
3. 缺失 Output 价格不再写 0：chat 模型保持待审核；TTS/embedding/图片等无
   output 维度的模型按 N/A 处理。
4. 同一维度存在多个不同缓存价格时不再取第一条，直接阻止自动播种。
5. `PriceKind` 标记为 `CHANNEL_QUOTE`，不与官方绝对价混用。

## 3. XXAPI

- 公开 `https://xxapi.ai/api/pricing` 在无鉴权下返回 **404**。
- 仓库无 XXAPI 密钥，创建渠道、模型发现、分组价格同步无法做真实调用，
  标记 **BLOCKED（缺少授权密钥）**。
- 表达式/倍率解析已用确定性 fixture 覆盖：
  - QuotaPerUnit 250000/500000/1000000 → ratio 1 分别为 $4/$2/$1。
  - 无 QuotaPerUnit → `RATIO_ONLY` + `RATIO_BASIS_UNKNOWN`，不生成美元价。
  - 双密钥创建、分组倍率、表达式同步测试通过。

## 4. 数据库硬门禁迁移（已执行）

预览：98 行 `needs_review=true` 且内部价非空、状态 `configured`。
其中 DreamRouter 76 行来源为 `batch`（运营批量价），百炼 22 行为
`bailian-channel` 自动价。

执行：

1. 备份：`/tmp/one-api-before-review-gate-20261122-163601.db`。
2. `EnforcePricingReviewGate` 只清理自动来源：首次 22 行，旧进程回写后再次 20 行。
3. 百炼重新同步：清理 131 条过期自动价，写入 17 条官方记录，播种 21 条售价。
4. 修复后台任务 `AutoConfigureBailianPrices` 使用 nil 模型列表导致为已下架模型
   重新播种的问题，并清理不在当前渠道模型列表中的自动售价。
5. 重建并重启后端后复核：渠道 31 稳定 21 条内部价，不再被旧价格回写。

`batch`/人工价格按策略保留，不因官方 review 标记被暂停；自动来源价格
不得在 review 状态下计费。

复核：

| channel | 内部价 | 可计费 | 执行失败 |
|---|---|---|---|
| 31 百炼 | 21 | 15 | 0 |
| 32 DreamRouter | 84（均为 batch；官方 44 表达式 + 8 绝对价已刷新） | 84 | 0 |
| 33 Apiko | 52 | 52 | 0（fixed 表达式在任务路径可执行） |

百炼 6 条内部价对应模型已不在上游目录，生命周期为 DISABLED，不计费。
数据库中已无 `bailian-`/`dreamrouter-` 自动价同时处于 review + configured。

## 5. 计费一致性

- 52 个 DreamRouter 可执行内部价、15 个百炼内部价均通过确定性用量执行，
  无零额度/异常值。
- 任务/退款/重复回调的计费合同测试通过（`go test ./model ./service ./controller`）。
- 页面展示、数据库归一化价与内部售价来自同一 `NormalizedPricing`；
  实际扣费由 `ResolveEffectiveChannelPricingFor` 读取同一版本。

## 6. 未完成/外部受限

- XXAPI 真实创建与同步：缺少密钥（公开 `/api/pricing` 无鉴权返回 404）。
- DreamRouter 6 个 seedance 模型：上游无元数据。
- 百炼推理服务过滤是否需覆盖 `alibaba-cloud-modelstudio`：需官方接口确认，
  未擅自扩大过滤条件。