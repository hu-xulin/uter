# 优特-精选渠道大模型价格获取逻辑全方位审计

> 审计时间：2026-11-28 12:15 GMT+8
> 渠道：优特-精选（id=1262, type=65, provider=uterroute）
> 性质：只读审计，未修改任何产品代码、未提交、未 rebuild。
> 证据：真实 `/api/pricing` 接口数据、`one-api.db`（只读）channel_model_pricing 表、源码静态审查。

---

## 一、价格获取全链路

```
上游 UterRoute/DreamRouter  /api/pricing (FetchUterRouteUpstream)
  → 解析每条模型官方价 (uterRouteOfficialLine):
       billing_expr 系数(DERIVED_FROM_EXPR) > model_price(OFFICIAL_API)
       > model_ratio*2(DERIVED_FROM_RATIOS) > 历史快照(HISTORICAL_SNAPSHOT)
  → 快照 UterRouteUpstreamSnapshot (options 表)
  → 生成渠道记录 (UterRouteChannelPricingRecordsWithMapping):
       支持 model_mapping 重定向，按请求别名落库
       official_pricing / normalized_pricing / internal_pricing 三份 JSON
  → 分组折扣倍率 (UterRouteDiscountForModel, auto_groups ∩ enable_groups)
  → 交叉校验 (applyOfficialCrossCheck) → UpsertChannelOfficialPricing 落库
  → 后端定价视图 (controller/pricing.go GetPricing):
       resolveOfficialPrices → overlayChannelOfficialPrices → channel_price_display_view
  → 前端 (index.tsx → applyChannelView → ModelCard):
       applyChannelPrice 覆盖字段，getDiscountInfo 算角标
```

关键文件：
- `service/upstream_uterroute.go`：抓取(845)、官方价解析(254)、渠道记录(1271)、分组折扣(1506)、review 门禁(1669)
- `service/uterroute_pricing_expr.go`：表达式系数解析（token/duration/image）
- `model/channel_official_crosscheck.go`：交叉校验(189,330)
- `model/channel_model_pricing.go`：落库(1125)与 owner 规则(1062)
- `controller/pricing.go`：GetPricing(40)、official_prices 来源(167)、overlay(221)
- `model/pricing.go`：channelPriceDisplayView(560) 唯一显示契约
- `web/src/features/pricing/lib/channel-view.ts`：applyChannelView(28)
- `web/src/features/pricing/lib/price.ts`：getDiscountInfo(651)、getTaskPerSecondUSD(541)

---

## 二、核心数据健康度（真实数据）

渠道 1262 共 85 个模型定价行，全部 `pricing_status=configured` / `ACTIVE` / `source=uterroute-official` / `owner=BATCH`。

| 指标 | 数值 |
|---|---|
| 官方表达式可执行 | 45 |
| needs_review | **43（50.6%）** |
| review 原因：official input price disagrees | 35 |
| review 原因：DERIVED_FROM_RATIOS | 32 |
| 输出/缓存/cache-write/per-call 不一致 | 4/2/1/1 |
| needs_review 但仍保留 internal_pricing | **43（100%）** |

---

## 三、审计发现（按严重度）

### P0-1 交叉校验把两种价格口径当成错误，43/85 模型被误标 needs_review

- 文件：`model/channel_official_crosscheck.go:189-266`（crossCheckOfficialPrice）、`:330-358`（applyOfficialCrossCheck）
- 现象：`deepseek-v4-flash-0731` 官方价 0.445 USD/1M，与上游 `model_ratio*2=0.445` 完全一致，却因 baseline（Uter 同步定价 `ModelRatio`）为 0.44 被标 "official input price disagrees"。`deepseek-v4-pro` 1.333 vs 0.28、`doubao-seedance-2-0-260128` 7.29 vs 6.561 同理。
- 根因：baseline 取自 `GetModelPricingSnapshot`（Uter 同步售卖价 options.ModelRatio），而 UterRoute 官方价是上游原价/表达式系数，二者是**不同度量**。代码对百炼 `OFFICIAL_LIST` 已在 `authoritativeOfficialList()`(:158) 做了豁免，但 UterRoute 的 `RATIO_ONLY`/`BILLING_EXPRESSION`/`HISTORICAL_SNAPSHOT` 未豁免，全部走严格数值相等。
- 影响：过半模型进入 review 状态；一旦门禁生效，其自动计费价会被清空（`applyOfficialCrossCheck:356`），存在大面积计费中断风险。
- 建议：对 UterRoute 的官方价行比照 `authoritativeOfficialList` 增加"不同度量豁免"，或按 price_kind 分流 baseline；仅在同源口径内做数值相等校验。

### P0-2 needs_review 的内部计费价（BATCH owner）未被清除，与硬门禁语义冲突

- 文件：`model/channel_model_pricing.go:1256-1266`、`pricingReplaceableByOwner:1062`
- 现象：43 个 needs_review 记录 100% 携带 `internal_pricing`（source=batch, owner=BATCH）。代码虽在 `applyOfficialCrossCheck:356` 清空 record.InternalPricing，但 Upsert 更新既有行时 line1259 仅在 `pricingReplaceableByOwner` 为真才清；BATCH owner 返回 false，故旧价被保留。
- 根因：owner 规则把 BATCH 视为"显式决策"予以保护，但本渠道 85 行的 internal_pricing 全部是 `source=batch` 的批量同步产物，并非人工定价。owner 分类与 needs_review 门禁语义冲突。
- 影响：官方源已判定价格不可信（needs_review），系统却仍用旧的批量价计费，违背了 fail-closed 设计意图。
- 建议：区分"人工批量导入 BATCH"与"同步批量写入 BATCH"；对 needs_review 行，无论 owner 都不得作为自动计费价（保留展示但置 `PricingStatus=needs_review` 且计费路径拒绝）。

### P1-1 交叉校验 baseline 归一化后存在 296 组价格冲突，取值依赖排序

- 文件：`model/channel_official_crosscheck.go:119-142`（synchronizedOfficialBaseline）、`model/model_name_match.go:15`（normalizeModelMatchName）
- 现象：`ModelRatio` 中 `DeepSeek-V4-1-Flash-fast`(0.125) 与 `DeepSeek-V4-1-Flash-Fast`(0.3)、`anthropic-claude-opus-4.5`(2.14645) 与 `anthropic-claude-opus-4-5`(2.5) 等归一化后同名但值不同，共 296 组。baseline 用 `if exists continue` 取排序后第一个。
- 影响：baseline 可能取到旧别名/错误值，直接造成 P0-1 的误报；结果对名称排序敏感，不可审计。
- 建议：冲突时按权威源优先级选取并落日志；或放弃跨分隔符模糊匹配，改用精确模型 ID + 白名单别名。

### P1-2 参考价计费门禁默认放开（fail-open）

- 文件：`service/upstream_uterroute.go:132-140`（uterRouteReferencePriceBillingAuthorized）
- 现象：2026-11-25 运营决策改为"默认授权"，仅 option 显式设为 `false`/`0` 才恢复 fail-closed。当前 8 个 `RATIO_ONLY` 模型（gemini-3.5-flash 等）已自动启用计费。
- 风险：DERIVED_FROM_RATIOS / HISTORICAL_SNAPSHOT 是重建的参考价而非核验过的采购成本，默认计费与项目记忆"参考价受 REFERENCE_PRICE_BILLING_NOT_AUTHORIZED 门禁，未明确授权不得自动启用"的约定存在张力。
- 建议：确认当前授权是否为有效书面决策；若为临时，恢复默认 fail-closed；至少在详情页明确标注参考价来源。

### P2-1 顶层"所有渠道"视图与渠道视图可能不同源

- 文件：`model/pricing.go:543-550`、`controller/pricing.go:221`
- 现象：顶层取跨渠道 best，表达式行永输 absolute 行；`channelPriceDisplayView` 虽是唯一契约，但顶层输入与 channel_prices 输入不同。
- 风险：项目记忆要求"顶层与 channel_prices 字段级一致"，此处仅函数同源、输入不同源，边界情况下可能不一致。
- 建议：补一条"顶层 = 所有渠道视图中的最优行"的一致性断言测试。

### P2-2 分组倍率口径需持续校验

- 文件：`service/upstream_uterroute.go:1506`、`model/pricing.go` channelPriceDisplayView
- 现象：折扣从 `auto_groups ∩ enable_groups` 首个交集分组取 `group_group_ratio.default`，缺项回退 `group_ratio`。项目记忆强调禁止从多分组猜最低价。
- 建议：为"交集为空/多交集/缺 group_group_ratio"三种边界补测试；当前有 45 个可执行表达式模型，需确认倍率来源均可追溯。

---

## 四、正面结论（无问题）

- 抓取层：URL 白名单校验、8MB 响应上限、`vendor_id<=0` 隐藏模型过滤、mapping-aware 重命名、循环 mapping 检测均完备。
- 表达式解析：token/duration/按次/按张多形态齐备；duration 正则已与后端同口径（裸 `duration * x` 与 `(…duration…) * x` 均支持）。
- 前端角标：全量 419 模型 × 11 渠道扫描，"价格行有折扣但无角标"=0，角标%与价格行%分叉=0（上一轮审计已验证）。
- 落库身份：`ChannelPricingIdentity` 含 provider/region/deployment，模糊匹配歧义时 fail-closed 拒绝合并（:1178-1189）。

---

## 五、建议优先级

1. 立即：P0-1（误标 43 个模型）、P0-2（review 仍计费）—— 影响计费正确性。
2. 短期：P1-1（baseline 冲突）、P1-2（门禁默认策略确认）。
3. 中期：P2-1/P2-2（一致性断言与边界测试）。

> 本次审计为只读；任何修复需单独授权后执行，并补齐失败用例先行。

---

## 六、修复与修复后审计（2026-11-28 12:55 GMT+8）

### 6.1 已修复项

| 编号 | 状态 | 修复内容 | 主要文件 |
|---|---|---|---|
| P0-1 | 已修复 | 对 UterRoute 来源（`uterroute-*`）的官方价行增加“不同度量豁免”，不再拿上游原价/表达式系数/比值重建价与 Uter 同步售卖价做数值相等校验；其他渠道仍严格比对 | `model/channel_official_crosscheck.go` |
| P0-2 | 已修复 | 定价视图把 `needs_review` 行视为无可用内部价，即使数据库仍保留旧批量价也不会下发可计费价格；计费侧原有 `ChannelPricingBillableReason` 门禁保持不变 | `model/pricing.go` |
| P1-1 | 已修复 | baseline 构造抽成纯函数；归一化后同名但价格冲突的条目整体丢弃并记录日志，不再依赖排序取第一行；完全相同的重复别名仍保留 | `model/channel_official_crosscheck.go` |
| P1-2 | 部分修复 | 参考价授权配置改为显式布尔解析：空值沿用 2026-11-25 运营决策的默认授权；`true/1/yes/on` 授权；`false/0/no/off` 与任何无法识别的值均 fail-closed | `service/upstream_uterroute.go` |
| P2-1 | 已补齐 | 新增顶层价格必须等于“所有渠道视图中的最优已配置价格”的断言，并覆盖表达式/绝对价、多渠道择优 | `model/pricing_channel_view_test.go` |
| P2-2 | 已补齐 | 新增“首个 auto_groups ∩ enable_groups 命中缺 group_group_ratio 时只回退 group_ratio，不继续找更便宜分组”的边界测试；原有空交集、多交集歧义、顺序无关用例保持不变 | `service/upstream_uterroute_test.go` |

先行失败用例均在修复前复现，再转绿：

- `TestCrossCheckOfficialPriceUterRoutePriceIsDifferentMeasure`：修复前 4 个子用例全部误判 `needs_review`，修复后通过。
- `TestPricingChannelViewsShareOnePriceContract`：修复前旧批量价下发 `QuotaType=0`、`ModelRatio=0.5`，修复后为 `-1 / 0`。
- `TestSynchronizedBaselineDropsAmbiguousNormalizedNames`：修复前缺少纯构造函数，修复后通过并断言冲突只记录一次。
- `TestUterRouteReferencePriceAuthorizationRejectsInvalidValue`：修复前拼错配置值仍自动授权，修复后 fail-closed。

### 6.2 修复后数据复核

只读查询 `one-api.db` 的渠道 1262：

- 85 行价格，来源分布：`uterroute-expression` 45、`uterroute-ratio-reference` 32、`uterroute-official-api` 8，全部命中新的 UterRoute 豁免条件。
- 修复前 43 行 `needs_review`，其中 **43/43** 都带 `official ... price disagrees with Uter synchronized pricing`，属于本次豁免消除的误标。
- 数据库未被修改；本地 3000 服务未重启、未 rebuild，因此浏览器当前看到的旧数据不会立即变化。

### 6.3 验证结果

| 命令 | 结果 |
|---|---|
| `go test ./model/ ./controller/ ./service/ -count=1` | `model` ok；`service` ok；`controller` FAIL：4 个 UterAPI 渠道发现用例报 `Uter.api upstream billing group is not configured` |
| `bun run --cwd web test -- src/features/pricing` | 26 files / 359 tests 全通过 |
| `bun run --cwd web typecheck` | 通过 |
| `bun run --cwd web lint` | 0 errors；10 warnings 均来自既有并发改动文件，不在本次修复范围 |
| `bun run --cwd web format:check` | 通过 |
| `git diff --check` | 通过 |

`controller` 的 4 个失败用例为：

- `TestFetchUterAPIModelsIgnoresStaleFormBaseURL`
- `TestFetchModelsUterAPIUsesConfiguredUpstreamWhenFormBaseURLIsEmpty`
- `TestCreateUterAPIChannelsReportsPerSlotFailure`
- `TestCreateUterAPIChannelsSupportsMultipleKeysInSlot`

失败原因是工作区并发改动的 UterAPI 上游计费组配置缺失，与本次定价交叉校验/展示门禁修改无关；未放宽或删除任何断言。

### 6.4 残留风险与未解决项

1. **历史数据未清理**：43 行仍保留 `needs_review` 标记与 `internal_pricing`。当前代码已保证它们不可计费、不在定价页显示售卖价，但数据库字段尚未订正。清理需单独授权并按备份 → 小批量 → 校验流程执行。
2. **默认授权未反转**：`P1-2` 的 fail-open 默认值来自 2026-11-25 明确运营决策；本次只修复“非法配置值误授权”。若要把缺省改为 fail-closed，会影响 32 个 `RATIO_ONLY` 模型的自动计费，需要单独授权与业务确认。
3. **UterRoute 数值二道防线减少**：豁免后，上游若发布明显错误的单价，不再由同步定价做数值交叉校验。建议改为“同源漂移阈值告警 + 人工确认”，而不是硬失败。
4. **baseline 覆盖率下降**：296 组归一化冲突条目被整体丢弃，相关模型暂时没有交叉校验基线。建议增加精确模型 ID + 显式别名白名单，逐步替代模糊分隔符归一化。
5. **生效条件**：修复只在源码中生效；需要在授权后 rebuild/重启本地 3000 服务，并在下一次上游同步后观察 43 个误标是否消失。

### 6.5 后续改进方案

1. 为 UterRoute 建立独立基线：按 `price_kind` 使用上游原价快照而非 Uter 售卖价；出售价与官方价之间只允许受控加价区间。
2. 在管理端渠道价格表增加“参考价来源 / 授权状态 / 上次授权人”三列，把 `DERIVED_FROM_RATIOS`、`HISTORICAL_SNAPSHOT` 与已核验采购价明确区分。
3. 对 `normalizeModelMatchName` 冲突生成可导出的别名冲突清单，按“精确 ID > 白名单别名 > 跳过”分级处理，避免静默丢基线。
4. 为 `needs_review` 历史行提供只读预览 + 显式确认的修复工具，沿用现有 `RejudgeBailianOfficialListCrossCheck` 的审计字段约束，但不得自动改库。
5. 将 UterAPI 渠道发现的计费组配置修复单独立项，先让 controller 测试集恢复全绿，再做本轮定价修复的浏览器端最终验收。

---

## 七、待执行事项落地记录（2026-11-28 13:50 GMT+8）

本节替代 6.4 中已完成的第 1、5 项和已执行的第 5 条“生效条件”。

### 7.1 已完成

| 事项 | 结果 | 证据 |
|---|---|---|
| controller 4 个 UterAPI 测试失败 | 已恢复全绿。单独运行、四例组合运行、全量 `go test ./controller/ -count=1 -v` 均通过（150.706s，退出码 0） | 失败在工作区并发改动期间出现，重跑后消失；未放宽或删除断言 |
| 历史 `needs_review` 数据清理 | 备份 `one-api.db.pre-uterroute-review-fix-20261128-133814`（`integrity_check=ok`）后，按 10 行/批清理 43 行：移除 crosscheck 原因，保留 `DERIVED_FROM_RATIOS` 作为审计来源。最终 `needs_review=0`、crosscheck 原因=0 | 逐批校验；`internal_pricing / pricing_status / pricing_owner / pricing_source / purchase_pricing` 与备份逐行一致；`pricing_version` 已重算；`integrity_check=ok` |
| 前端与后端重建 | `bun run --cwd web build` 成功；`go build -o /tmp/uter-verify-bin .` 成功 | 前端构建退出码 0；后端二进制 206MB |
| 隔离实例验证 | 在 `127.0.0.1:3001` 启动新二进制，未 kill/restart 3000；`/` 与 `/api/status` 返回 200，`/api/pricing` 按预期返回 401；数据库 85 行误标为 0 | 启动日志无异常；验证后已停止 3001；3000 原 PID 18605 仍在监听 |
| 提交 | commit `72707ed86`，仅含本次 9 个明确文件 | `git show --stat` 已核对；工作区其他并发改动未纳入 |

### 7.2 仍未执行 / 需业务确认

1. **默认参考价授权未反转**：仍沿用 2026-11-25 运营决策；非法配置值已 fail-closed。反转会影响 32 个 `RATIO_ONLY` 模型自动计费，需明确业务确认。
2. **UterRoute 漂移阈值告警**与**别名白名单治理**属于中期改进，未在本轮实现。
3. **3000 服务仍运行旧二进制**：本轮按要求未 restart/kill launchd 托管服务；新代码已通过 3001 隔离实例验证，正式生效仍需在运维窗口重启 3000。
